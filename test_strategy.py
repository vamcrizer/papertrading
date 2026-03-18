# -*- coding: utf-8 -*-
"""
Đối chiếu chiến lược Supertrend BTC vs TradingView backtest (shit.pine)

Pine script logic:
  - Entry: close của signal bar (TV fills at next open, nhưng SL/TP ref từ close)
  - SL: low - atr14 * sl_buffer  (LONG) | high + atr14 * sl_buffer  (SHORT)
  - TP: entry + r * tp_rr
  - Break-even: khi high >= entry + r → sl dời về entry
  - Cooldown: lastTradeBar tracked, không trade nếu bar_index - lastTradeBar < cooldown
"""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'backend'))

import numpy as np
import ccxt
import pandas as pd
import time
from datetime import datetime, timezone

from strategy_engine import _calc_atr, _calc_supertrend, STRATEGIES

# ─── Fetch ──────────────────────────────────────────────────────────────────

def fetch_ohlcv(symbol='BTC/USDT:USDT', timeframe='1h', since_date='2025-01-01'):
    """
    Fetch từ since_date đến hiện tại, paginate forward.
    Binance futures trả tối đa 1000 bar/request với 1h timeframe.
    """
    ex = ccxt.binance({'options': {'defaultType': 'future'}, 'timeout': 15000})
    since_ms = int(pd.Timestamp(since_date, tz='UTC').timestamp() * 1000)
    now_ms   = int(time.time() * 1000)
    print(f"Tải {symbol} {timeframe} từ {since_date} → now (paginate forward)...")

    all_rows = {}   # ts → row (dedup tại chỗ)
    cur = since_ms

    while cur < now_ms:
        batch = ex.fetch_ohlcv(symbol, timeframe, since=cur, limit=1000)
        if not batch:
            break
        for row in batch:
            all_rows[row[0]] = row
        last_ts = batch[-1][0]
        if last_ts <= cur:            # không tiến được → dừng
            break
        cur = last_ts + 1            # nến tiếp theo

    unique = sorted(all_rows.values(), key=lambda x: x[0])
    t0 = pd.to_datetime(unique[0][0],  unit='ms', utc=True)
    t1 = pd.to_datetime(unique[-1][0], unit='ms', utc=True)
    print(f"  → {len(unique)} nến  {t0} → {t1}")

    df = pd.DataFrame(unique, columns=['ts','open','high','low','close','vol'])
    df['time'] = pd.to_datetime(df['ts'], unit='ms', utc=True)
    df.set_index('time', inplace=True)
    return df


def add_indicators(df, atr_period, factor):
    h = df['high'].to_numpy(dtype=np.float64)
    l = df['low'].to_numpy(dtype=np.float64)
    c = df['close'].to_numpy(dtype=np.float64)
    atr_main = _calc_atr(h, l, c, atr_period)
    atr_14   = _calc_atr(h, l, c, 14)
    st, direction = _calc_supertrend(h, l, c, atr_main, factor)
    df = df.copy()
    df['atr14'] = atr_14
    df['st']    = st
    df['dir']   = direction   # -1=bull, 1=bear
    return df


# ─── Backtest — bám sát Pine script logic ───────────────────────────────────
#
# Pine: signal detected on bar[0] (current), entry = close[0]
#       TV strategy fills at NEXT bar's open — but SL/TP anchored to close[0]
# Python equivalent:
#   signal on bar i → entry_ref = close[i], actual fill = open[i+1]
#   SL/TP calculated from entry_ref (= close[i]) like Pine
#   Break-even: khi high[j] >= entry_ref + r → sl = entry_ref (Pine: position_avg_price)

def backtest(df, cfg, verbose=True):
    sl_buf      = cfg['sl_buffer']
    tp_ratio    = cfg['tp_ratio']
    risk_pct    = cfg['risk_pct'] / 100
    capital     = cfg['initial_capital']
    fee         = cfg['taker_fee']
    cooldown_n  = cfg['cooldown']
    use_be      = cfg.get('break_even', False)

    arr_open  = df['open'].to_numpy()
    arr_high  = df['high'].to_numpy()
    arr_low   = df['low'].to_numpy()
    arr_close = df['close'].to_numpy()
    arr_st    = df['st'].to_numpy()
    arr_dir   = df['dir'].to_numpy()
    arr_atr14 = df['atr14'].to_numpy()
    times     = df.index

    trades  = []
    signals = []

    in_trade    = False
    entry_ref   = 0.0   # close of signal bar (Pine's `entry = close`)
    entry_fill  = 0.0   # open of next bar (actual execution price)
    sl = tp = r = 0.0
    entry_dir   = None
    entry_time  = None
    be_done     = False  # break-even already triggered

    last_trade_bar = -999  # Pine's lastTradeBar

    # Signal trên bar i → fill tại open[i+1] → dùng range(1, len-1)
    for i in range(1, len(df) - 1):
        can_trade = (i - last_trade_bar) >= cooldown_n

        # ── Kiểm tra đóng lệnh ──────────────────────────────────────────
        if in_trade:
            hi, lo = arr_high[i], arr_low[i]

            # Break-even: Pine dời sl về position_avg_price khi high >= entry_ref + r
            if use_be and not be_done and entry_dir == 'LONG'  and hi >= entry_ref + r:
                sl = entry_ref
                be_done = True
            if use_be and not be_done and entry_dir == 'SHORT' and lo <= entry_ref - r:
                sl = entry_ref
                be_done = True

            hit_sl = (entry_dir == 'LONG'  and lo <= sl) or \
                     (entry_dir == 'SHORT' and hi >= sl)
            hit_tp = (entry_dir == 'LONG'  and hi >= tp) or \
                     (entry_dir == 'SHORT' and lo <= tp)

            if hit_tp or hit_sl:
                exit_px = tp if hit_tp else sl
                # Pine: riskMoney = strategy.equity * riskPct / 100
                #       rawQty    = riskMoney / r
                #       levCap    = (strategy.equity * max_lev) / close  ← close of signal bar
                #       qty       = math.min(rawQty, levCap)
                # fee: Pine default = 0 (no commission_type set in strategy())
                risk_money = capital * risk_pct
                raw_qty    = risk_money / r
                lev_cap    = (capital * cfg['max_leverage']) / entry_ref   # Pine: /close
                qty        = min(raw_qty, lev_cap)
                if entry_dir == 'LONG':
                    gross = qty * (exit_px - entry_fill)
                else:
                    gross = qty * (entry_fill - exit_px)
                net      = gross   # Pine script: no commission set → fee = 0
                capital += net
                trades.append({
                    'entry_time': entry_time,
                    'exit_time':  times[i],
                    'dir':        entry_dir,
                    'entry_ref':  entry_ref,   # close of signal bar (Pine ref)
                    'entry_fill': entry_fill,  # actual open fill
                    'sl_init':    sl if not be_done else entry_ref,
                    'tp':         tp,
                    'exit':       exit_px,
                    'result':     'BE' if (hit_sl and be_done) else ('TP' if hit_tp else 'SL'),
                    'pnl':        net,
                    'capital':    capital,
                })
                in_trade = False

        # ── Phát hiện tín hiệu trên bar i ───────────────────────────────
        # Pine: tín hiệu ở bar[0] = bar i, vào lệnh tại open[i+1]
        if not in_trade and can_trade and i >= 1:
            prev_dir = int(arr_dir[i-1])
            curr_dir = int(arr_dir[i])

            # Pine: breakBuy = ta.change(dir) < 0  (dir đổi từ dương → âm = bull)
            break_buy  = prev_dir > 0 and curr_dir < 0
            break_sell = prev_dir < 0 and curr_dir > 0

            # Pine: firstTouchBuy = isUpTrend and low<=st and close>st and low[1]>st[1]
            touch_buy  = (curr_dir < 0
                          and arr_low[i]   <= arr_st[i]  and arr_close[i] > arr_st[i]
                          and arr_low[i-1] >  arr_st[i-1])
            touch_sell = (curr_dir > 0
                          and arr_high[i]   >= arr_st[i]  and arr_close[i] < arr_st[i]
                          and arr_high[i-1] <  arr_st[i-1])

            sig_dir  = None
            sig_type = None
            if break_buy  or touch_buy:  sig_dir, sig_type = 'LONG',  'BREAK' if break_buy  else 'TOUCH'
            if break_sell or touch_sell: sig_dir, sig_type = 'SHORT', 'BREAK' if break_sell else 'TOUCH'

            if sig_dir:
                # Pine: entry = close[i], sl = low[i]/high[i] ± atr*buffer
                ref_c  = arr_close[i]
                atr_v  = arr_atr14[i]
                fill_p = arr_open[i+1]   # TV executes at next open

                if sig_dir == 'LONG':
                    sl_  = arr_low[i]  - atr_v * sl_buf
                    r_   = ref_c - sl_
                    tp_  = ref_c + r_ * tp_ratio
                else:
                    sl_  = arr_high[i] + atr_v * sl_buf
                    r_   = sl_ - ref_c
                    tp_  = ref_c - r_ * tp_ratio

                valid    = r_ > 0
                filtered = '' if valid else 'r<=0'

                signals.append({
                    'bar':       times[i],
                    'fill_time': times[i+1],
                    'dir':       sig_dir,
                    'type':      sig_type,
                    'ref_close': ref_c,
                    'fill_px':   fill_p,
                    'sl':        sl_ if valid else None,
                    'tp':        tp_ if valid else None,
                    'filtered':  filtered,
                    'can_trade': can_trade,
                })

                if valid:
                    entry_ref   = ref_c
                    entry_fill  = fill_p
                    sl          = sl_
                    tp          = tp_
                    r           = r_
                    entry_dir   = sig_dir
                    entry_time  = times[i+1]
                    be_done     = False
                    in_trade    = True
                    last_trade_bar = i

    return trades, signals


def fmt(t):
    return str(t)[:16].replace('+00:00','')


def main():
    cfg = STRATEGIES['supertrend_btc']
    df  = fetch_ohlcv(since_date='2023-01-01')   # TV startDate = 2023-01-01
    print(f"Period : {df.index[0]} → {df.index[-1]}  ({len(df)} nến)")
    print(f"Params : ATR={cfg['atr_period']}, Factor={cfg['factor']}, "
          f"SL_buf={cfg['sl_buffer']}, TP_rr={cfg['tp_ratio']}, "
          f"Cooldown={cfg['cooldown']}, BreakEven={cfg.get('break_even')}")

    df = add_indicators(df, cfg['atr_period'], cfg['factor'])
    trades, signals = backtest(df, cfg)

    # ── Tất cả tín hiệu ─────────────────────────────────────────────────────
    print(f"\n{'═'*105}")
    print("TẤT CẢ TÍN HIỆU:")
    print(f"{'#':>3} {'Signal bar':16}  {'Fill bar':16}  {'Dir':5} {'Type':5}  "
          f"{'Ref(close)':>10}  {'Fill(open)':>10}  {'SL':>9}  {'TP':>9}  {'Note'}")
    print('─'*105)
    for n, s in enumerate(signals, 1):
        note = ''
        if not s['can_trade']: note += '[cooldown] '
        if s['filtered']:      note += f"[{s['filtered']}]"
        sl_s = f"{s['sl']:>9,.1f}" if s['sl'] else f"{'N/A':>9}"
        tp_s = f"{s['tp']:>9,.1f}" if s['tp'] else f"{'N/A':>9}"
        print(f"{n:>3} {fmt(s['bar']):16}  {fmt(s['fill_time']):16}  "
              f"{s['dir']:5} {s['type']:5}  "
              f"{s['ref_close']:>10,.1f}  {s['fill_px']:>10,.1f}  "
              f"{sl_s}  {tp_s}  {note}")

    # ── Giao dịch thực ──────────────────────────────────────────────────────
    print(f"\n{'═'*120}")
    print(f"GIAO DỊCH THỰC ({len(trades)} trades):")
    print(f"{'#':>3} {'Dir':5}  {'Entry fill':16}  {'Exit':16}  "
          f"{'Ref':>9}  {'Fill':>9}  {'SL':>9}  {'TP':>9}  {'Exit px':>9}  "
          f"{'Res':2}  {'PnL':>8}  {'Cap':>10}")
    print('─'*120)
    for n, t in enumerate(trades, 1):
        print(f"{n:>3} {t['dir']:5}  {fmt(t['entry_time']):16}  {fmt(t['exit_time']):16}  "
              f"{t['entry_ref']:>9,.1f}  {t['entry_fill']:>9,.1f}  "
              f"{t['sl_init']:>9,.1f}  {t['tp']:>9,.1f}  {t['exit']:>9,.1f}  "
              f"{t['result']:2}  {t['pnl']:>+8.2f}  {t['capital']:>10,.2f}")

    # ── Đối chiếu TV ────────────────────────────────────────────────────────
    tv = [
        # Aug-Nov 2025 (ảnh mới)
        (50, 'LONG',  '2025-08-28 01:00', 112931.1, '2025-08-28 21:00', 111722.8, -167.342),
        (51, 'LONG',  '2025-08-29 06:00', 109710.7, '2025-08-29 08:00', 110828.5, +369.216),
        (52, 'LONG',  '2025-09-02 10:00', 111113.4, '2025-09-16 22:00', 116988.9, +381.649),
        (53, 'SHORT', '2025-09-21 21:00', 114335.8, '2025-09-22 02:00', 111908.0, +394.462),
        (54, 'LONG',  '2025-09-28 19:00', 111881.4, '2025-09-29 20:00', 114524.4, +407.736),
        (55, 'SHORT', '2025-10-07 12:00', 121788.2, '2025-10-07 15:00', 121788.2,    0.000),
        (56, 'LONG',  '2025-10-10 18:00', 113253.6, '2025-11-04 12:00', 101015.5, -188.124),
        (57, 'SHORT', '2025-11-05 15:00', 103950.0, '2025-11-05 23:00', 103950.0,    0.000),
        # Feb-Mar 2026 (ảnh cũ)
        (84, 'SHORT', '2026-02-14 07:00',  70464.8, '2026-02-14 08:00',  69602.2, +877.766),
        (85, 'SHORT', '2026-02-15 00:00',  70156.9, '2026-02-15 02:00',  70615.7, -228.360),
        (86, 'LONG',  '2026-02-18 14:00',  66327.2, '2026-02-19 01:00',  67100.6, +503.708),
        (87, 'SHORT', '2026-02-24 21:00',  65860.4, '2026-02-25 07:00',  65860.4,    0.000),
        (88, 'LONG',  '2026-02-27 08:00',  65902.5, '2026-02-27 09:00',  65902.5,    0.000),
        (89, 'SHORT', '2026-02-28 16:00',  66918.6, '2026-02-28 17:00',  66918.6,    0.000),
        (90, 'SHORT', '2026-03-06 09:00',  69189.6, '2026-03-08 18:00',  66283.7, +520.598),
        (91, 'LONG',  '2026-03-09 23:00',  70242.0, '2026-03-10 14:00',  70242.0,    0.000),
    ]
    print(f"\n{'═'*110}")
    print("ĐỐI CHIẾU VỚI TRADINGVIEW:")
    print(f"{'TV#':>4} {'Dir':5}  {'TV entry':16}  {'TV entry px':>11}  "
          f"{'TV exit':16}  {'TV exit px':>10}  {'TV PnL':>9}  {'Match?'}")
    print('─'*110)
    for tv_n, tv_d, tv_et, tv_ep, tv_xt, tv_xp, tv_pnl in tv:
        m_tr  = next((t for t in trades  if abs(t['entry_fill']-tv_ep)<20 and t['dir']==tv_d), None)
        m_sig = next((s for s in signals if abs(s['fill_px']-tv_ep)<20    and s['dir']==tv_d), None)
        if m_tr:
            match = (f"✅ TRADE  fill={m_tr['entry_fill']:,.1f}  exit={m_tr['exit']:,.1f}  "
                     f"{m_tr['result']}  pnl={m_tr['pnl']:+.2f}")
        elif m_sig:
            reason = 'cooldown' if not m_sig['can_trade'] else m_sig['filtered'] or '?'
            match = f"⚠️  SIGNAL filtered [{reason}]  fill={m_sig['fill_px']:,.1f}"
        else:
            match = "❌ MISSING"
        print(f"{tv_n:>4} {tv_d:5}  {tv_et:16}  {tv_ep:>11,.1f}  "
              f"{tv_xt:16}  {tv_xp:>10,.1f}  {tv_pnl:>+9.3f}  {match}")

    # ── Tổng kết ─────────────────────────────────────────────────────────────
    if trades:
        wins  = sum(1 for t in trades if t['result'] == 'TP')
        bes   = sum(1 for t in trades if t['result'] == 'BE')
        loses = sum(1 for t in trades if t['result'] == 'SL')
        total_pnl = sum(t['pnl'] for t in trades)
        print(f"\n{'═'*110}")
        print(f"Tổng kết: {len(trades)} trades | "
              f"TP={wins}  BE={bes}  SL={loses} | "
              f"WR(TP)={wins/len(trades)*100:.1f}% | "
              f"PnL=${total_pnl:+,.2f} | Cap=${trades[-1]['capital']:,.2f}")
    else:
        print("\nKhông có giao dịch.")


if __name__ == '__main__':
    main()

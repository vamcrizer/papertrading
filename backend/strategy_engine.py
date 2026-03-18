# -*- coding: utf-8 -*-
"""
Strategy Engine — Live signal generator for Supertrend strategies
==================================================================
Fetches realtime OHLCV from Binance, computes Supertrend, generates signals.

Strategies registered:
  - supertrend_btc : BTC/USDT perp, ATR=110, Factor=5.3, params from backtest_supertrend_BTC_
  - supertrend_eth : ETH/USDT perp, ATR=110, Factor=3.5 (best from optimize_supertrend_eth)
"""
import numpy as np
import ccxt
import time
import logging
from numba import njit

logger = logging.getLogger("strategy_engine")

# ─────────────────────────────────────────────────────────────
#                   Strategy registry
# ─────────────────────────────────────────────────────────────

STRATEGIES = {
    "supertrend_btc": {
        "id": "supertrend_btc",
        "name": "Supertrend BTC",
        "symbol": "BTC/USDT:USDT",
        "coin": "BTC",
        "timeframe": "1h",
        "atr_period": 170,
        "factor": 6.1,
        "cooldown": 15,
        "sl_buffer": 0.25,  # ATR multiplier for SL distance
        "tp_ratio": 2.24,   # R:R take profit multiplier
        "break_even": True, # Move SL to entry after price hits +1R (Pine feature)
        "risk_pct": 1.5,
        "max_leverage": 5,
        "taker_fee": 0.00035,
        "initial_capital": 10000.0,
    },
    "supertrend_eth": {
        "id": "supertrend_eth",
        "name": "Supertrend ETH",
        "symbol": "ETH/USDT:USDT",
        "coin": "ETH",
        "timeframe": "1h",
        "atr_period": 170,
        "factor": 6.1,
        "cooldown": 15,
        "sl_buffer": 0.25,  # ATR multiplier for SL distance
        "tp_ratio": 2.24,   # R:R take profit multiplier
        "break_even": True, # Move SL to entry after price hits +1R (Pine feature)
        "risk_pct": 1.5,
        "max_leverage": 5,
        "taker_fee": 0.00035,
        "initial_capital": 10000.0,
    },
}


# ─────────────────────────────────────────────────────────────
#                  Numba JIT: ATR + Supertrend
# ─────────────────────────────────────────────────────────────

@njit
def _calc_atr(high, low, close, period):
    n = len(close)
    tr = np.empty(n)
    atr = np.empty(n)
    atr[:] = np.nan
    for i in range(n):
        if i == 0:
            tr[i] = high[i] - low[i]
        else:
            tr[i] = max(high[i] - low[i],
                        abs(high[i] - close[i-1]),
                        abs(low[i] - close[i-1]))
    atr[period-1] = 0.0
    for j in range(period):
        atr[period-1] += tr[j]
    atr[period-1] /= period
    for i in range(period, n):
        atr[i] = (atr[i-1] * (period-1) + tr[i]) / period
    return atr


@njit
def _calc_supertrend(high, low, close, atr, factor):
    n = len(close)
    upper = np.zeros(n)
    lower = np.zeros(n)
    st = np.zeros(n)
    direction = np.ones(n, dtype=np.int32)
    hl2 = (high + low) / 2.0
    for i in range(n):
        if np.isnan(atr[i]):
            upper[i] = np.nan
            lower[i] = np.nan
            st[i] = np.nan
            continue
        bu = hl2[i] + factor * atr[i]
        bl = hl2[i] - factor * atr[i]
        if i > 0 and not np.isnan(lower[i-1]):
            lower[i] = max(bl, lower[i-1]) if close[i-1] > lower[i-1] else bl
        else:
            lower[i] = bl
        if i > 0 and not np.isnan(upper[i-1]):
            upper[i] = min(bu, upper[i-1]) if close[i-1] < upper[i-1] else bu
        else:
            upper[i] = bu
        if i == 0:
            direction[i] = 1
        elif st[i-1] == upper[i-1]:
            direction[i] = -1 if close[i] > upper[i] else 1
        else:
            direction[i] = 1 if close[i] < lower[i] else -1
        st[i] = upper[i] if direction[i] == 1 else lower[i]
    return st, direction


# ─────────────────────────────────────────────────────────────
#                         OHLCV cache
# ─────────────────────────────────────────────────────────────

_ohlcv_cache = {}   # strategy_id -> {data, ts}
_OHLCV_TTL = 300    # 5 min (H1 candles don't change fast)

_exchange = None

def _get_exchange():
    global _exchange
    if _exchange is None:
        _exchange = ccxt.binance({
            'options': {'defaultType': 'future'},
            'timeout': 15000,
        })
    return _exchange


def _fetch_ohlcv(strategy_id: str) -> dict | None:
    """Fetch OHLCV data for a strategy, with cache."""
    now = time.time()
    cached = _ohlcv_cache.get(strategy_id)
    if cached and (now - cached['ts']) < _OHLCV_TTL:
        return cached['data']

    cfg = STRATEGIES[strategy_id]
    try:
        ex = _get_exchange()
        ohlcv = ex.fetch_ohlcv(cfg['symbol'], cfg['timeframe'], limit=400)
        if not ohlcv or len(ohlcv) < cfg['atr_period'] + 10:
            return None
        data = {
            'open':  np.array([x[1] for x in ohlcv], dtype=np.float64),
            'high':  np.array([x[2] for x in ohlcv], dtype=np.float64),
            'low':   np.array([x[3] for x in ohlcv], dtype=np.float64),
            'close': np.array([x[4] for x in ohlcv], dtype=np.float64),
            'times': [x[0] for x in ohlcv],
        }
        _ohlcv_cache[strategy_id] = {'data': data, 'ts': now}
        return data
    except Exception as e:
        logger.error(f"OHLCV fetch error [{strategy_id}]: {e}")
        return None


# ─────────────────────────────────────────────────────────────
#                       Signal generation
# ─────────────────────────────────────────────────────────────

def get_signal(strategy_id: str) -> dict:
    """
    Compute the current trading signal for a strategy.
    Returns dict with keys: has_signal, direction, price, sl, tp, st_value, st_direction
    """
    if strategy_id not in STRATEGIES:
        return {"error": f"Unknown strategy: {strategy_id}"}

    cfg = STRATEGIES[strategy_id]
    data = _fetch_ohlcv(strategy_id)
    if data is None:
        return {"has_signal": False, "error": "OHLCV fetch failed"}

    high  = data['high']
    low   = data['low']
    close = data['close']
    open_ = data['open']

    atr_p    = cfg['atr_period']
    factor   = cfg['factor']
    sl_buf   = cfg['sl_buffer']
    tp_ratio = cfg['tp_ratio']

    # Compute indicators
    atr_main = _calc_atr(high, low, close, atr_p)
    atr_14   = _calc_atr(high, low, close, 14)
    st, direction = _calc_supertrend(high, low, close, atr_main, factor)

    # Look at last complete bar (index -2) — bar [-1] is forming
    i = len(close) - 2
    if i < 2:
        return {"has_signal": False, "error": "Not enough bars"}

    if np.isnan(atr_14[i]) or np.isnan(st[i]):
        return {"has_signal": False, "error": "Indicator NaN"}

    prev_d = int(direction[i-1])
    curr_d = int(direction[i])

    # Signal detection (same logic as backtest)
    bull_break  = prev_d == 1  and curr_d == -1
    bear_break  = prev_d == -1 and curr_d == 1
    bull_touch  = (curr_d == -1
                   and low[i] <= st[i] and close[i] > st[i]
                   and low[i-1] > st[i-1])
    bear_touch  = (curr_d == 1
                   and high[i] >= st[i] and close[i] < st[i]
                   and high[i-1] < st[i-1])

    entry_dir = None
    signal_type = None
    if bull_break:
        entry_dir, signal_type = "LONG",  "BREAK"
    elif bear_break:
        entry_dir, signal_type = "SHORT", "BREAK"
    elif bull_touch:
        entry_dir, signal_type = "LONG",  "TOUCH"
    elif bear_touch:
        entry_dir, signal_type = "SHORT", "TOUCH"

    ref   = close[i]
    atr_v = atr_14[i]
    sl    = 0.0
    rpu   = 0.0

    if entry_dir == "LONG":
        sl  = low[i] - atr_v * sl_buf
        rpu = ref - sl
    elif entry_dir == "SHORT":
        sl  = high[i] + atr_v * sl_buf
        rpu = sl - ref

    result = {
        "strategy_id": strategy_id,
        "strategy_name": cfg["name"],
        "symbol": cfg["coin"],
        "has_signal": entry_dir is not None and rpu > 0,
        "direction": entry_dir,
        "signal_type": signal_type,
        "price": float(ref),
        "sl": float(sl) if entry_dir and rpu > 0 else None,
        "tp": float(ref + rpu * tp_ratio) if entry_dir == "LONG" and rpu > 0
              else float(ref - rpu * tp_ratio) if entry_dir == "SHORT" and rpu > 0
              else None,
        "st_value": float(st[i]),
        "st_direction": int(direction[i]),
        "atr": float(atr_v),
        "bar_time_ms": int(data['times'][i]),
    }
    return result


def get_all_signals() -> list:
    """Get signals for all registered strategies."""
    results = []
    for sid in STRATEGIES:
        try:
            results.append(get_signal(sid))
        except Exception as e:
            results.append({"strategy_id": sid, "has_signal": False, "error": str(e)})
    return results

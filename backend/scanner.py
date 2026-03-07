# -*- coding: utf-8 -*-
"""
Ensemble V2 Scanner — EXACT match with backtest gen_ensemble
=============================================================
OPTIMIZED:
- Uses cached WebSocket prices (no REST ticker calls)
- Parallel OHLCV fetching with ThreadPoolExecutor
- Caches candle data for 5 minutes (signals don't change every second)
"""
import numpy as np
import ccxt
import time
import logging
from concurrent.futures import ThreadPoolExecutor, as_completed
from numba import njit

logger = logging.getLogger("scanner")

@njit
def sma(arr,p):
    n_=len(arr);out=np.empty(n_);out[:]=np.nan;s=0.0
    for i in range(n_):
        s+=arr[i]
        if i>=p: s-=arr[i-p];out[i]=s/p
        elif i==p-1: out[i]=s/p
    return out

@njit
def atr(h,l,c,p):
    n_=len(c);tr=np.empty(n_);out=np.empty(n_);out[:]=np.nan
    for i in range(n_):
        if i==0: tr[i]=h[i]-l[i]
        else: tr[i]=max(h[i]-l[i],abs(h[i]-c[i-1]),abs(l[i]-c[i-1]))
    out[p-1]=0.0
    for j in range(p): out[p-1]+=tr[j]
    out[p-1]/=p
    for i in range(p,n_): out[i]=(out[i-1]*(p-1)+tr[i])/p
    return out

@njit
def rolling_std(arr,p):
    n_=len(arr);out=np.empty(n_);out[:]=np.nan
    for i in range(p-1,n_):
        s=0.0;ss=0.0
        for j in range(i-p+1,i+1): s+=arr[j];ss+=arr[j]**2
        m=s/p;out[i]=np.sqrt(max(0,ss/p-m*m))
    return out

@njit
def pct_change(arr,p):
    n_=len(arr);out=np.empty(n_);out[:]=np.nan
    for i in range(p,n_):
        if arr[i-p]!=0: out[i]=(arr[i]-arr[i-p])/arr[i-p]*100
    return out


SYMBOLS = {
    'BTC': 'BTC/USDT:USDT', 'ETH': 'ETH/USDT:USDT', 'SOL': 'SOL/USDT:USDT',
    'XRP': 'XRP/USDT:USDT', 'DOGE': 'DOGE/USDT:USDT', 'AVAX': 'AVAX/USDT:USDT',
    'ADA': 'ADA/USDT:USDT', 'LINK': 'LINK/USDT:USDT', 'BNB': 'BNB/USDT:USDT',
    'BCH': 'BCH/USDT:USDT', 'SUI': 'SUI/USDT:USDT', 'ZEC': 'ZEC/USDT:USDT',
    'AGLD': 'AGLD/USDT:USDT', 'ALPHA': 'ALPHA/USDT:USDT', 'BNX': 'BNX/USDT:USDT',
}

# ── Candle cache ──────────────────────────────────────
_candle_cache = {}  # name -> {data, ts}
_CANDLE_TTL = 300   # 5 min cache (H1 candles don't change fast)


def _fetch_one_coin(exchange, name, sym):
    """Fetch candles for a single coin (called in thread pool)."""
    now = time.time()
    cached = _candle_cache.get(name)
    if cached and (now - cached['ts']) < _CANDLE_TTL:
        return name, cached['data'], None

    try:
        ohlcv = exchange.fetch_ohlcv(sym, '1h', limit=300)
        data = {
            'C': np.array([x[4] for x in ohlcv], dtype=np.float64),
            'H': np.array([x[2] for x in ohlcv], dtype=np.float64),
            'L': np.array([x[3] for x in ohlcv], dtype=np.float64),
        }
        _candle_cache[name] = {'data': data, 'ts': now}
        return name, data, None
    except Exception as e:
        return name, None, str(e)[:80]


def gen_ensemble_live(C, H, L, live_price, cd=24):
    """Generate Ensemble V2 signals — EXACT copy of backtest gen_ensemble."""
    n_ = len(C)
    atr14 = atr(H, L, C, 14)
    sma200 = sma(C, 200)
    sma50 = sma(C, 50)
    ret1h = pct_change(C, 1)
    vol24 = rolling_std(ret1h, 24)
    vol168 = rolling_std(ret1h, 168)
    ret24h = pct_change(C, 24)

    all_sigs = []
    s1 = []; sq = False; last = -48
    for i in range(200, n_):
        if np.isnan(vol24[i]) or np.isnan(vol168[i]): continue
        if vol24[i] < 0.5 * vol168[i]: sq = True
        elif sq and vol24[i] > vol168[i]:
            sq = False
            if i - last < 48: continue
            r = (C[i] - C[i-24]) / C[i-24] * 100 if C[i-24] != 0 else 0
            if r > 0: s1.append((i, 1)); last = i
            elif r < 0: s1.append((i, -1)); last = i
    all_sigs.append(s1)

    s2 = []; last = -48; ps = 0
    for i in range(200, n_):
        if np.isnan(sma50[i]) or np.isnan(sma200[i]): continue
        s = 1 if sma50[i] > sma200[i] else -1
        if s != ps and i - last >= 48: s2.append((i, s)); last = i
        ps = s
    all_sigs.append(s2)

    s3 = []; last = -24
    for i in range(200, n_):
        if np.isnan(ret24h[i]) or np.isnan(sma200[i]): continue
        if i - last < 24: continue
        if ret24h[i] > 3 and C[i] > sma200[i]: s3.append((i, 1)); last = i
        elif ret24h[i] < -3 and C[i] < sma200[i]: s3.append((i, -1)); last = i
    all_sigs.append(s3)

    s4 = []; last = -48; ps = 0
    for i in range(200, n_):
        if np.isnan(sma200[i]): continue
        s = 1 if C[i] > sma200[i] else -1
        if s != ps and i - last >= 48: s4.append((i, s)); last = i
        ps = s
    all_sigs.append(s4)

    sig_map = {}
    for ss in all_sigs:
        for b, d in ss:
            for off in range(-12, 13):
                k = b + off
                if k not in sig_map: sig_map[k] = []
                sig_map[k].append(d)

    signals = []
    last_entry = -cd
    for i in sorted(sig_map.keys()):
        if i < 200 or i >= n_: continue
        if i - last_entry < cd: continue
        if np.isnan(atr14[i]): continue
        vote = sum(sig_map[i])
        if abs(vote) >= 2:
            a = atr14[i] / C[i] * 100
            signals.append({
                'bar': i, 'vote': vote,
                'direction': 1 if vote > 0 else -1,
                'sl_pct': a * 2, 'tp_pct': a * 3,
            })
            last_entry = i

    i = n_ - 1
    latest = {
        'sma200': float(sma200[i]) if not np.isnan(sma200[i]) else 0,
        'sma50': float(sma50[i]) if not np.isnan(sma50[i]) else 0,
        'atr14': float(atr14[i]) if not np.isnan(atr14[i]) else 0,
        'ret24h': float(ret24h[i]) if not np.isnan(ret24h[i]) else 0,
    }
    return signals, latest


def scan_all():
    """Scan all 15 coins — parallel fetch, WebSocket prices."""
    exchange = ccxt.binance({'enableRateLimit': True})

    # Get live prices from WebSocket (instant, no API calls)
    try:
        import ws_monitor
        live_prices = ws_monitor.get_prices()
    except:
        live_prices = {}

    # Parallel candle fetch
    coin_data = {}
    with ThreadPoolExecutor(max_workers=5) as pool:
        futures = {pool.submit(_fetch_one_coin, exchange, name, sym): name
                   for name, sym in SYMBOLS.items()}
        for f in as_completed(futures):
            name, data, error = f.result()
            if data:
                coin_data[name] = data
            elif error:
                coin_data[name] = {'error': error}

    # Generate signals
    results = []
    for name in SYMBOLS:
        cd = coin_data.get(name)
        if not cd:
            results.append({'symbol': name, 'error': 'no data'})
            continue
        if 'error' in cd:
            results.append({'symbol': name, 'error': cd['error']})
            continue

        C, H, L = cd['C'], cd['H'], cd['L']
        n = len(C)

        live_price = live_prices.get(name, float(C[-1]))
        if n < 200:
            results.append({'symbol': name, 'error': 'not enough data'})
            continue

        try:
            signals, indicators = gen_ensemble_live(C, H, L, live_price, cd=24)
        except Exception as e:
            results.append({'symbol': name, 'error': str(e)[:50]})
            continue

        has_signal = False
        latest_signal = None
        if signals:
            last_sig = signals[-1]
            bars_ago = n - 1 - last_sig['bar']
            if bars_ago <= 24:
                has_signal = True
                latest_signal = last_sig

        if has_signal and latest_signal:
            direction = 'LONG' if latest_signal['direction'] == 1 else 'SHORT'
            sl_pct = latest_signal['sl_pct']
            tp_pct = latest_signal['tp_pct']
            vote = latest_signal['vote']

            if direction == 'SHORT':
                sl_price = live_price * (1 + sl_pct / 100)
                tp_price = live_price * (1 - tp_pct / 100)
            else:
                sl_price = live_price * (1 - sl_pct / 100)
                tp_price = live_price * (1 + tp_pct / 100)

            reasons = []
            if abs(vote) >= 3: reasons.append('StrongVote')
            if indicators['sma50'] > indicators['sma200']: reasons.append('GoldenCross')
            else: reasons.append('DeathCross')
            if abs(indicators['ret24h']) > 3: reasons.append('Momentum')
            reasons.append('Trend+' if live_price > indicators['sma200'] else 'Trend-')
        else:
            direction = 'LONG' if live_price > indicators.get('sma200', 0) else 'SHORT'
            vote = 0
            sl_pct = tp_pct = 0
            sl_price = tp_price = 0
            reasons = []

        results.append({
            'symbol': name,
            'price': round(live_price, 4),
            'direction': direction,
            'vote': vote if latest_signal else 0,
            'signals': reasons,
            'has_signal': has_signal,
            'sl': round(sl_price, 4),
            'tp': round(tp_price, 4),
            'sl_pct': round(sl_pct, 2),
            'tp_pct': round(tp_pct, 2),
            'sma200': round(indicators.get('sma200', 0), 2),
            'trend': 'UP' if live_price > indicators.get('sma200', 0) else 'DOWN',
            'ret24h': round(indicators.get('ret24h', 0), 2),
            'signal_bar_ago': (n - 1 - latest_signal['bar']) if latest_signal else -1,
        })

    return results

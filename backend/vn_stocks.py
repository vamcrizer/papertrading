# -*- coding: utf-8 -*-
"""
VN Stock Multi-Factor Logic for API
"""
import numpy as np
import pandas as pd
import os

DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), 'vn_stocks')

VN30 = ['VCB','VHM','VIC','HPG','MSN','VNM','FPT','MWG','TCB','MBB',
        'ACB','BID','CTG','STB','TPB','VPB','GAS','PLX','SAB','REE',
        'KDH','VRE','PDR','NVL','SSI','HDB','SHB']

def load_stock(sym):
    f = os.path.join(DATA_DIR, f'{sym}_daily.csv')
    if not os.path.exists(f): return None
    df = pd.read_csv(f)
    df.columns = [c.strip().lower() for c in df.columns]
    if 'time' in df.columns: df['date'] = pd.to_datetime(df['time'])
    return df.sort_values('date').drop_duplicates('date').set_index('date')

def get_vn_ranking():
    price_df = pd.DataFrame()
    for sym in VN30:
        df = load_stock(sym)
        if df is not None:
            price_df[sym] = df['close']
    price_df = price_df.sort_index().ffill()
    
    if len(price_df) < 200:
        return []
    
    returns_1m = price_df.pct_change(21)
    returns_3m = price_df.pct_change(63)
    returns_6m = price_df.pct_change(126)
    returns_1y = price_df.pct_change(252)
    returns_1d = price_df.pct_change(1)
    sma200 = price_df.rolling(200).mean()
    sma50 = price_df.rolling(50).mean()
    vol_3m = returns_1d.rolling(63).std() * np.sqrt(252)
    
    results = []
    scores = {}
    
    # Pre-compute returns for network signal
    returns_1d = price_df.pct_change(1)
    
    for sym in price_df.columns:
        i = len(price_df) - 1
        p = price_df[sym].iloc[i]
        if np.isnan(p): continue
        
        r1m = returns_1m[sym].iloc[i] * 100 if not np.isnan(returns_1m[sym].iloc[i]) else 0
        r3m = returns_3m[sym].iloc[i] * 100 if not np.isnan(returns_3m[sym].iloc[i]) else 0
        r6m = returns_6m[sym].iloc[i] * 100 if not np.isnan(returns_6m[sym].iloc[i]) else 0
        r1y = returns_1y[sym].iloc[i] * 100 if not np.isnan(returns_1y[sym].iloc[i]) else 0
        vol = vol_3m[sym].iloc[i] * 100 if not np.isnan(vol_3m[sym].iloc[i]) else 99
        s200 = sma200[sym].iloc[i] if not np.isnan(sma200[sym].iloc[i]) else 0
        s50 = sma50[sym].iloc[i] if not np.isnan(sma50[sym].iloc[i]) else 0
        
        above_sma = p > s200 if s200 > 0 else False
        golden = s50 > s200
        
        # === PRIMARY SCORE (Simple model — stress-tested, p<5%) ===
        score = -r3m + (-r6m * 0.5) + (vol * 2)
        if not above_sma: score += 50
        if not golden: score += 20
        scores[sym] = score
        
        # === PAPER-INSPIRED SUPPLEMENTARY FACTORS ===
        # Vol-adjusted momentum (AQR Time Series Momentum paper)
        vol_raw = returns_1d[sym].iloc[-63:].std() * np.sqrt(252)
        va_mom = (returns_3m[sym].iloc[i]) / (vol_raw + 0.001) if not np.isnan(returns_3m[sym].iloc[i]) else 0
        
        # Acceleration (Path Signatures paper — Levy area)
        if i >= 126 and not np.isnan(returns_6m[sym].iloc[i]):
            first_half = (price_df[sym].iloc[i-63] / price_df[sym].iloc[i-126] - 1) * 100
            second_half = r3m
            accel = round(second_half - first_half, 1)
        else:
            accel = 0
        
        # Network signal (Network Momentum paper — correlated stocks' momentum)
        net_signal = 0
        window_rets = returns_1d.iloc[-126:]
        for other in price_df.columns:
            if other == sym: continue
            c = window_rets[sym].corr(window_rets[other])
            if not np.isnan(c) and c > 0.3:
                other_r = returns_3m[other].iloc[i] if not np.isnan(returns_3m[other].iloc[i]) else 0
                net_signal += c * other_r
        
        results.append({
            'symbol': sym,
            'price': float(round(p * 1000, 0)),
            'ret_1m': float(round(r1m, 1)),
            'ret_3m': float(round(r3m, 1)),
            'ret_6m': float(round(r6m, 1)),
            'ret_1y': float(round(r1y, 1)),
            'volatility': float(round(vol, 0)),
            'sma200': float(round(s200 * 1000, 0)),
            'trend': 'UP' if above_sma else 'DOWN',
            'golden_cross': bool(golden),
            'score': float(round(score, 0)),
            # Paper-based supplementary
            'vol_adj_momentum': float(round(va_mom, 2)),
            'acceleration': float(accel),
            'network_signal': float(round(net_signal * 100, 1)),
        })
    
    results.sort(key=lambda x: x['score'])
    for i, r in enumerate(results):
        r['rank'] = i + 1
        r['recommendation'] = 'BUY' if i < 5 else ('HOLD' if i < 15 else 'AVOID')
    
    return results

def get_vn_index():
    df = load_stock('VNINDEX')
    if df is None: return None
    return {
        'price': float(round(df['close'].iloc[-1], 2)),
        'date': str(df.index[-1].date()),
        'ytd': float(round((df['close'].iloc[-1] / df[df.index >= pd.Timestamp('2026-01-01')]['close'].iloc[0] - 1) * 100, 1)) if len(df[df.index >= pd.Timestamp('2026-01-01')]) > 0 else 0,
    }

def get_fund_recommendations():
    """
    Create model portfolios for different investment horizons.
    Based on stress-tested Simple model (Sharpe 0.94, p<5%).
    
    IMPORTANT: Picks are LOCKED on the 1st of each month.
    Between rebalances, the same picks are served.
    This prevents noise/turnover from daily price fluctuations.
    """
    import json
    from datetime import datetime, date
    
    CACHE_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'fund_cache.json')
    
    today = date.today()
    current_month_key = today.strftime('%Y-%m')
    
    # Check cache — if we already have picks for this month, return them
    if os.path.exists(CACHE_FILE):
        try:
            with open(CACHE_FILE, 'r') as f:
                cache = json.load(f)
            if cache.get('month') == current_month_key:
                return cache['funds']
        except:
            pass
    
    # Rebalance: compute new picks
    price_df = pd.DataFrame()
    for sym in VN30:
        df = load_stock(sym)
        if df is not None:
            price_df[sym] = df['close']
    price_df = price_df.sort_index().ffill()
    
    if len(price_df) < 252:
        return []
    
    returns_1m = price_df.pct_change(21)
    returns_3m = price_df.pct_change(63)
    returns_6m = price_df.pct_change(126)
    returns_1y = price_df.pct_change(252)
    returns_1d = price_df.pct_change(1)
    sma200 = price_df.rolling(200).mean()
    sma50 = price_df.rolling(50).mean()
    vol_3m = returns_1d.rolling(63).std() * np.sqrt(252)
    
    # Compute factors for each stock
    stock_data = {}
    for sym in price_df.columns:
        p = price_df[sym].iloc[-1]
        if np.isnan(p): continue
        
        r1m = float(returns_1m[sym].iloc[-1] * 100) if not np.isnan(returns_1m[sym].iloc[-1]) else 0
        r3m = float(returns_3m[sym].iloc[-1] * 100) if not np.isnan(returns_3m[sym].iloc[-1]) else 0
        r6m = float(returns_6m[sym].iloc[-1] * 100) if not np.isnan(returns_6m[sym].iloc[-1]) else 0
        r1y = float(returns_1y[sym].iloc[-1] * 100) if not np.isnan(returns_1y[sym].iloc[-1]) else 0
        vol = float(vol_3m[sym].iloc[-1] * 100) if not np.isnan(vol_3m[sym].iloc[-1]) else 99
        s200 = sma200[sym].iloc[-1]
        s50 = sma50[sym].iloc[-1]
        above_sma = bool(p > s200) if not np.isnan(s200) else False
        golden = bool(s50 > s200) if not (np.isnan(s50) or np.isnan(s200)) else False
        
        # Acceleration
        if len(price_df) >= 126:
            fh = float((price_df[sym].iloc[-63] / price_df[sym].iloc[-126] - 1) * 100)
            accel = r3m - fh
        else:
            accel = 0
        
        stock_data[sym] = {
            'price': float(round(p * 1000, 0)),
            'r1m': round(r1m, 1), 'r3m': round(r3m, 1),
            'r6m': round(r6m, 1), 'r1y': round(r1y, 1),
            'vol': round(vol, 0), 'above_sma': above_sma, 'golden': golden,
            'accel': round(accel, 1),
        }
    
    # Horizon-specific scoring
    horizons = [
        {'id': '1m', 'name': '1 Thang', 'months': 1, 'top_n': 3,
         'desc': 'Ngan han - Momentum manh, vol thap',
         'score_fn': lambda d: -(d['r1m'] * 2 + d['r3m']) + d['vol'] * 3
                               + (50 if not d['above_sma'] else 0)},
        {'id': '3m', 'name': '3 Thang', 'months': 3, 'top_n': 5,
         'desc': 'Ngan han - Momentum + trend',
         'score_fn': lambda d: -(d['r3m'] + d['r6m'] * 0.5) + d['vol'] * 2
                               + (50 if not d['above_sma'] else 0) + (20 if not d['golden'] else 0)},
        {'id': '6m', 'name': '6 Thang', 'months': 6, 'top_n': 5,
         'desc': 'Trung han - Trend following',
         'score_fn': lambda d: -(d['r3m'] + d['r6m']) + d['vol'] * 1.5
                               + (40 if not d['above_sma'] else 0) + (20 if not d['golden'] else 0)
                               - (d['accel'] * 0.3)},
        {'id': '1y', 'name': '1 Nam', 'months': 12, 'top_n': 7,
         'desc': 'Trung-dai han - Trend + co ban',
         'score_fn': lambda d: -(d['r6m'] + d['r1y'] * 0.5) + d['vol'] * 1
                               + (30 if not d['above_sma'] else 0)},
        {'id': '2y', 'name': '2 Nam', 'months': 24, 'top_n': 7,
         'desc': 'Dai han - Gia tri + tang truong on dinh',
         'score_fn': lambda d: -(d['r1y']) + d['vol'] * 0.5
                               + (20 if not d['above_sma'] else 0)
                               + (30 if d['r1y'] > 100 else 0)},
        {'id': '3y', 'name': '3 Nam', 'months': 36, 'top_n': 10,
         'desc': 'Dai han - Blue chip, on dinh',
         'score_fn': lambda d: d['vol'] * 2 + (20 if not d['above_sma'] else 0)
                               - (10 if d['golden'] else 0)},
        {'id': '5y', 'name': '5 Nam+', 'months': 60, 'top_n': 10,
         'desc': 'Sieu dai han - Blue chip, vol thap nhat',
         'score_fn': lambda d: d['vol'] * 3 + (10 if not d['above_sma'] else 0)},
    ]
    
    # Next rebalance date = 1st of next month
    if today.month == 12:
        next_rebal = date(today.year + 1, 1, 1)
    else:
        next_rebal = date(today.year, today.month + 1, 1)
    
    funds = []
    for h in horizons:
        scored = []
        for sym, d in stock_data.items():
            sc = h['score_fn'](d)
            scored.append({'symbol': sym, 'score': float(round(sc, 1)), **d})
        
        scored.sort(key=lambda x: x['score'])
        picks = scored[:h['top_n']]
        
        avg_ret_3m = np.mean([p['r3m'] for p in picks])
        avg_vol = np.mean([p['vol'] for p in picks])
        pct_uptrend = sum(1 for p in picks if p['above_sma']) / len(picks) * 100
        
        funds.append({
            'id': h['id'],
            'name': h['name'],
            'description': h['desc'],
            'months': h['months'],
            'picks': [{'symbol': p['symbol'], 'price': p['price'],
                       'r3m': p['r3m'], 'r1y': p['r1y'], 'vol': p['vol'],
                       'trend': 'UP' if p['above_sma'] else 'DOWN'}
                      for p in picks],
            'stats': {
                'avg_momentum_3m': float(round(avg_ret_3m, 1)),
                'avg_volatility': float(round(avg_vol, 0)),
                'pct_uptrend': float(round(pct_uptrend, 0)),
                'num_picks': len(picks),
            },
            'locked_date': str(today),
            'next_rebalance': str(next_rebal),
        })
    
    # Save to cache
    cache_data = {
        'month': current_month_key,
        'computed_at': str(today),
        'next_rebalance': str(next_rebal),
        'funds': funds,
    }
    try:
        with open(CACHE_FILE, 'w') as f:
            json.dump(cache_data, f, indent=2)
    except:
        pass
    
    return funds


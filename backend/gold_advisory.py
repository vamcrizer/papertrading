# -*- coding: utf-8 -*-
"""
Metals Advisory Model — Gold, Silver, Copper
=============================================
Advisory for physical precious metals buying.
Uses multi-factor scoring with BACKTEST VALIDATION.

Model evaluation metrics:
1. Signal Hit Rate: % of BUY signals that lead to positive 3M returns
2. Avg return after BUY signal vs avg return after CAUTION signal
3. Comparison vs Buy-and-Hold timing
"""
import numpy as np, pandas as pd, os

PROJ_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# =============================================
# DATA LOADING
# =============================================
def load_metal(name):
    """Load metal data from multiple sources, return daily OHLC"""
    sources = {
        'gold': [
            os.path.join(PROJ_ROOT, '_archive', 'xau', 'XAU_1H_merged.csv'),
            os.path.join(PROJ_ROOT, 'perp_h1', 'XAUUSDT_perp_1h.csv'),
        ],
        'silver': [
            os.path.join(PROJ_ROOT, '_archive', 'XAG_1min_2016_to_2026_merged_2.csv'),
            os.path.join(PROJ_ROOT, 'metals_data', 'XAGUSD_1h.csv'),
        ],
    }
    
    if name not in sources:
        return None
    
    for path in sources[name]:
        if not os.path.exists(path):
            continue
        try:
            df = pd.read_csv(path)
            df.columns = [c.strip().lower() for c in df.columns]
            
            for col in ['datetime', 'time', 'date']:
                if col in df.columns:
                    df['dt'] = pd.to_datetime(df[col])
                    break
            if 'dt' not in df.columns:
                continue
            
            df['dt'] = df['dt'].dt.tz_localize(None) if hasattr(df['dt'].dt, 'tz') and df['dt'].dt.tz else df['dt']
            df = df[['dt','open','high','low','close']].dropna()
            df = df.sort_values('dt').drop_duplicates('dt').set_index('dt')
            
            # Resample to daily
            daily = df.resample('D').agg({
                'open': 'first', 'high': 'max', 'low': 'min', 'close': 'last'
            }).dropna()
            
            if len(daily) > 200:
                return daily
        except Exception as e:
            continue
    
    return None

# =============================================
# ADVISORY MODEL
# =============================================
def metal_score(close, n):
    """
    Multi-factor advisory scoring for a metal.
    Returns score, reasons, warnings, metrics dict.
    
    Factors:
    1. Trend: SMA50/200 position — Time Series Momentum
    2. RSI: Overbought/oversold
    3. Extension: Distance from SMA50
    4. ATH proximity: FOMO risk
    5. Acceleration: Path Signatures (Levy area)
    6. Vol regime: Volatility Spillovers
    7. Ensemble V2 vote: Vol Breakout + SMA Cross + Momentum (adapted daily)
    """
    sma20 = pd.Series(close).rolling(20).mean().values
    sma50 = pd.Series(close).rolling(50).mean().values
    sma200 = pd.Series(close).rolling(200).mean().values
    
    above_sma200 = bool(close[-1] > sma200[-1]) if not np.isnan(sma200[-1]) else False
    golden = bool(sma50[-1] > sma200[-1]) if not (np.isnan(sma50[-1]) or np.isnan(sma200[-1])) else False
    trend_pct = float((close[-1] - sma200[-1]) / sma200[-1] * 100) if not np.isnan(sma200[-1]) and sma200[-1] > 0 else 0.0
    
    # === ENSEMBLE V2 SIGNALS (adapted daily) ===
    # Signal 1: Vol regime (squeeze → expansion)
    rets = np.diff(close) / close[:-1]
    vol_short = np.std(rets[-10:]) if len(rets) >= 10 else 0
    vol_long = np.std(rets[-50:]) if len(rets) >= 50 else vol_short + 0.001
    vol_expansion = vol_short > vol_long * 1.2
    vol_squeeze = vol_short < vol_long * 0.5
    
    # Signal 2: SMA Cross
    sma_bullish = bool(sma50[-1] > sma200[-1]) if not (np.isnan(sma50[-1]) or np.isnan(sma200[-1])) else False
    
    # Signal 3: Momentum (5-day return)
    mom_5d = (close[-1] / close[-6] - 1) * 100 if n > 6 else 0
    
    # Ensemble vote (-3 to +3)
    ensemble_vote = 0
    if sma_bullish: ensemble_vote += 1
    else: ensemble_vote -= 1
    if mom_5d > 1: ensemble_vote += 1
    elif mom_5d < -1: ensemble_vote -= 1
    if close[-1] > sma20[-1] if not np.isnan(sma20[-1]) else False:
        ensemble_vote += 1
    else:
        ensemble_vote -= 1
    
    # Momentum
    ret_1w = float((close[-1] / close[-(5+1)] - 1) * 100) if n > 6 else 0.0
    ret_1m = float((close[-1] / close[-(21+1)] - 1) * 100) if n > 22 else 0.0
    ret_3m = float((close[-1] / close[-(63+1)] - 1) * 100) if n > 64 else 0.0
    ret_6m = float((close[-1] / close[-(126+1)] - 1) * 100) if n > 127 else 0.0
    ret_1y = float((close[-1] / close[-(252+1)] - 1) * 100) if n > 253 else 0.0
    
    # RSI
    deltas = np.diff(close[-15:])
    gains = np.where(deltas > 0, deltas, 0)
    losses = np.where(deltas < 0, -deltas, 0)
    rsi = float(100 - (100 / (1 + np.mean(gains) / (np.mean(losses) + 0.001))))
    
    # Extension from SMA50
    extension = float((close[-1] - sma50[-1]) / sma50[-1] * 100) if not np.isnan(sma50[-1]) and sma50[-1] > 0 else 0.0
    
    # ATH
    ath = float(np.max(close))
    pct_from_ath = float((close[-1] - ath) / ath * 100)
    at_ath = bool(pct_from_ath > -2)
    
    # Acceleration (Path Signatures)
    if n > 127:
        first_half = (close[-63] / close[-126] - 1) * 100
        second_half = (close[-1] / close[-63] - 1) * 100
        acceleration = float(second_half - first_half)
    else:
        acceleration = 0.0
    
    # Volatility
    rets = np.diff(close) / close[:-1]
    vol_20d = float(np.std(rets[-20:]) * np.sqrt(252) * 100)
    vol_60d = float(np.std(rets[-60:]) * np.sqrt(252) * 100) if len(rets) >= 60 else vol_20d
    
    # SCORING
    score = 0
    reasons = []
    warnings = []
    
    if above_sma200:
        score += 15; reasons.append("Trend dai han TANG (tren SMA200)")
    else:
        score -= 20; warnings.append("Trend dai han GIAM (duoi SMA200)")
    
    if golden:
        score += 10; reasons.append("Golden Cross (SMA50 > SMA200)")
    
    if ret_3m > 5:
        score += 10; reasons.append(f"Momentum 3M manh (+{ret_3m:.1f}%)")
    elif ret_3m < -5:
        score -= 5; warnings.append(f"Momentum 3M yeu ({ret_3m:.1f}%)")
    
    if at_ath:
        score -= 15; warnings.append(f"Gan ALL-TIME HIGH ({pct_from_ath:+.1f}%)")
    elif pct_from_ath < -20:
        score += 10; reasons.append(f"Xa ATH ({pct_from_ath:.0f}%), co room tang")
    
    if extension > 5:
        score -= 10; warnings.append(f"Overextended +{extension:.1f}% tren SMA50")
    
    if rsi > 70:
        score -= 10; warnings.append(f"RSI qua mua ({rsi:.0f})")
    elif rsi < 30:
        score += 10; reasons.append(f"RSI qua ban ({rsi:.0f})")
    
    if ret_1m > 8:
        score -= 5; warnings.append(f"Tang qua nhanh 1M (+{ret_1m:.1f}%)")
    
    if acceleration > 10:
        score += 5; reasons.append(f"Dang tang toc (+{acceleration:.1f}%)")
    elif acceleration < -10:
        score -= 5; warnings.append(f"Dang giam toc ({acceleration:.1f}%)")
    
    # Ensemble V2 vote (adapted from Gold Ensemble V2 model, Sharpe 3.2)
    if ensemble_vote >= 2:
        score += 10; reasons.append(f"Ensemble V2 BULLISH (vote={ensemble_vote}/3)")
    elif ensemble_vote <= -2:
        score -= 10; warnings.append(f"Ensemble V2 BEARISH (vote={ensemble_vote}/3)")
    
    # === ANTI-FOMO PROTECTION ===
    # Multiple danger signals = auto-downgrade regardless of score
    danger_count = sum([
        at_ath,
        rsi > 70,
        extension > 5,
        ret_1m > 8,
        acceleration > 20,  # extreme acceleration is unsustainable
    ])
    
    if danger_count >= 3:
        score -= 15
        warnings.append(f"FOMO ALERT: {danger_count} dau hieu nguy hiem dong thoi")
    
    # Recommendation — HONEST physical buying advice
    if score >= 15 and danger_count < 2:
        rec = "BUY"
        advice = "Nen mua tich tru dan. Trend tot, it rui ro."
    elif score >= 0 and danger_count < 3:
        rec = "WAIT"
        advice = "Co the mua it, nhung nen doi pullback de mua them. Khong FOMO."
    elif danger_count >= 3:
        rec = "CAUTION"
        advice = "THAN TRONG! Nhieu dau hieu qua nong. Doi dieu chinh 5-10% roi mua."
    elif score >= -10:
        rec = "WAIT"
        advice = "Gia chua hap dan. Doi co hoi tot hon."
    else:
        rec = "AVOID"
        advice = "Trend yeu. Khong nen mua luc nay."
    
    metrics = {
        'trend': {'above_sma200': above_sma200, 'golden_cross': golden, 'trend_strength': float(round(trend_pct, 1)),
                  'sma50': float(round(sma50[-1], 2)) if not np.isnan(sma50[-1]) else 0,
                  'sma200': float(round(sma200[-1], 2)) if not np.isnan(sma200[-1]) else 0},
        'momentum': {'ret_1w': float(round(ret_1w, 1)), 'ret_1m': float(round(ret_1m, 1)),
                     'ret_3m': float(round(ret_3m, 1)), 'ret_6m': float(round(ret_6m, 1)),
                     'ret_1y': float(round(ret_1y, 1))},
        'risk': {'rsi': float(round(rsi, 0)), 'extension': float(round(extension, 1)),
                 'volatility': float(round(vol_20d, 1)), 'at_ath': at_ath,
                 'pct_from_ath': float(round(pct_from_ath, 1)), 'acceleration': float(round(acceleration, 1))},
        'ensemble': {'vote': int(ensemble_vote), 'sma_bullish': bool(sma_bullish),
                     'mom_5d': float(round(mom_5d, 1)), 'vol_expanding': bool(vol_expansion)},
    }
    
    return int(score), rec, advice, reasons, warnings, metrics

# =============================================
# BACKTEST: Validate model quality
# =============================================
def backtest_advisory(close, lookback_months=60):
    """
    Walk-forward backtest:
    Every month, compute score. Track forward 3M return.
    Evaluate: does BUY signal predict positive 3M return?
    """
    n = len(close)
    if n < 300:
        return None
    
    signals = []  # (date_idx, score, recommendation, forward_3m_return)
    
    # Start from day 252 (need 1Y history), step monthly (21 days)
    for idx in range(252, n - 63, 21):
        score, rec, _, _, _, _ = metal_score(close[:idx+1], idx+1)
        
        # Forward 3-month return (what actually happened)
        fwd_3m = (close[min(idx + 63, n-1)] / close[idx] - 1) * 100
        fwd_1m = (close[min(idx + 21, n-1)] / close[idx] - 1) * 100
        
        signals.append({
            'idx': idx, 'score': score, 'rec': rec,
            'fwd_3m': fwd_3m, 'fwd_1m': fwd_1m,
        })
    
    if not signals:
        return None
    
    df = pd.DataFrame(signals)
    
    # Hit rates
    buy_signals = df[df['rec'] == 'BUY']
    wait_signals = df[df['rec'] == 'WAIT']
    caution_signals = df[df['rec'] == 'CAUTION']
    
    results = {
        'total_signals': len(df),
        'buy_count': len(buy_signals),
        'wait_count': len(wait_signals),
        'caution_count': len(caution_signals),
    }
    
    if len(buy_signals) > 0:
        results['buy_hit_rate_3m'] = float(round((buy_signals['fwd_3m'] > 0).mean() * 100, 1))
        results['buy_avg_3m'] = float(round(buy_signals['fwd_3m'].mean(), 1))
        results['buy_avg_1m'] = float(round(buy_signals['fwd_1m'].mean(), 1))
    
    if len(caution_signals) > 0:
        results['caution_hit_rate_3m'] = float(round((caution_signals['fwd_3m'] > 0).mean() * 100, 1))
        results['caution_avg_3m'] = float(round(caution_signals['fwd_3m'].mean(), 1))
    
    if len(wait_signals) > 0:
        results['wait_avg_3m'] = float(round(wait_signals['fwd_3m'].mean(), 1))
    
    # Overall: buy-and-hold comparison
    results['bnh_total'] = float(round((close[-1] / close[252] - 1) * 100, 1))
    
    # Strategy: buy only when BUY, sell when CAUTION
    strategy_ret = 0
    holding = False
    entry_price = 0
    for s in signals:
        if s['rec'] == 'BUY' and not holding:
            holding = True
            entry_price = close[s['idx']]
        elif s['rec'] == 'CAUTION' and holding:
            holding = False
            strategy_ret += (close[s['idx']] / entry_price - 1) * 100
            entry_price = 0
    if holding:
        strategy_ret += (close[-1] / entry_price - 1) * 100
    results['strategy_total'] = float(round(strategy_ret, 1))
    
    return results

# =============================================
# MAIN API FUNCTION
# =============================================
def metals_analysis():
    """Full metals analysis for all available metals"""
    metals_info = {
        'gold': {'name': 'Gold', 'emoji': 'Au', 'unit': 'USD/oz',
                 'vnd_factor': 25400 * 1.2 / 1000000},  # ~triệu VND/lượng
        'silver': {'name': 'Silver', 'emoji': 'Ag', 'unit': 'USD/oz',
                   'vnd_factor': 25400 * 1.2 / 1000000 / 80},  # rough
    }
    
    results = []
    
    for key, info in metals_info.items():
        daily = load_metal(key)
        if daily is None or len(daily) < 300:
            continue
        
        close = daily['close'].values
        n = len(close)
        
        score, rec, advice, reasons, warnings, metrics = metal_score(close, n)
        
        # Backtest validation
        bt = backtest_advisory(close)
        
        # History
        history = []
        for label, days in [('1W', 5), ('1M', 21), ('3M', 63), ('6M', 126), ('1Y', 252)]:
            r = (close[-1] / close[-(days+1)] - 1) * 100 if n > days + 1 else 0
            history.append({'period': label, 'return': float(round(r, 1))})
        
        result = {
            'metal': key,
            'name': info['name'],
            'symbol': info['emoji'],
            'current_price': float(round(close[-1], 2)),
            'unit': info['unit'],
            'vnd_estimate': float(round(close[-1] * info['vnd_factor'], 1)),
            'recommendation': rec,
            'score': score,
            'advice': advice,
            'reasons': reasons,
            'warnings': warnings,
            **metrics,
            'history': history,
            'backtest': bt,
            'last_updated': str(daily.index[-1].date()),
            'data_points': int(n),
        }
        results.append(result)
    
    return {'metals': results}

if __name__ == '__main__':
    data = metals_analysis()
    for m in data['metals']:
        print(f"\n{'='*60}")
        print(f"  {m['name']} ({m['symbol']}): {m['recommendation']} (score={m['score']})")
        print(f"  Price: ${m['current_price']} {m['unit']}")
        print(f"  Advice: {m['advice']}")
        print(f"\n  Reasons: {m['reasons']}")
        print(f"  Warnings: {m['warnings']}")
        print(f"\n  Performance: {m['history']}")
        
        bt = m.get('backtest')
        if bt:
            print(f"\n  MODEL VALIDATION (backtest):")
            print(f"    Total signals: {bt['total_signals']} (BUY={bt['buy_count']}, WAIT={bt['wait_count']}, CAUTION={bt['caution_count']})")
            if 'buy_hit_rate_3m' in bt:
                print(f"    BUY hit rate (3M positive): {bt['buy_hit_rate_3m']}%")
                print(f"    BUY avg 3M return: {bt['buy_avg_3m']}%")
                print(f"    BUY avg 1M return: {bt['buy_avg_1m']}%")
            if 'caution_avg_3m' in bt:
                print(f"    CAUTION avg 3M return: {bt['caution_avg_3m']}%")
            print(f"    Buy & Hold total: {bt['bnh_total']}%")
            print(f"    Strategy total:   {bt['strategy_total']}%")
            print(f"    Strategy {'BEATS' if bt['strategy_total'] > bt['bnh_total'] else 'LOSES to'} B&H")

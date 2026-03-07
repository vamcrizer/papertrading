# -*- coding: utf-8 -*-
"""
Auto Paper Trader — Background loop
====================================
Runs every hour:
1. Check & close trades (SL/TP/timeout)
2. Scan for new signals (gen_ensemble)
3. Auto-open trades if signal + no cooldown + no open position

Config: 3x leverage, 10% equity/trade, TP_cd=6h, SL_cd=24h
"""
import logging
import time
from datetime import datetime, timezone
import scanner, paper_trades

logger = logging.getLogger("auto_trader")

# State — default ON (runs without frontend)
_enabled = True
_last_run = None
_last_result = None


def is_enabled():
    return _enabled

def toggle(on: bool = None):
    global _enabled
    if on is not None:
        _enabled = on
    else:
        _enabled = not _enabled
    logger.info(f"Auto trader {'ENABLED' if _enabled else 'DISABLED'}")
    return _enabled

def get_status():
    return {
        "enabled": _enabled,
        "last_run": _last_run,
        "last_result": _last_result,
    }


def run_cycle():
    """Execute one trading cycle: check exits → scan → open trades."""
    global _last_run, _last_result
    _last_run = datetime.now(timezone.utc).isoformat()
    
    result = {
        "timestamp": _last_run,
        "closed": [],
        "opened": [],
        "skipped": [],
        "errors": [],
    }
    
    try:
        # STEP 1: Check and close active trades (SL/TP/timeout)
        closed = paper_trades.check_and_close_trades()
        for c in closed:
            result["closed"].append({
                "symbol": c["symbol"],
                "reason": c["status"],
                "pnl": c.get("pnl", 0),
                "hold_hours": c.get("hold_hours", 0),
            })
            logger.info(f"CLOSED {c['symbol']} [{c['status']}] PnL=${c.get('pnl',0):.2f}")
        
        # STEP 2: Scan for new signals
        signals = scanner.scan_all()
        
        # STEP 3: Open trades for active signals
        equity = paper_trades.get_equity()
        
        for sig in signals:
            if sig.get('error'):
                result["errors"].append(f"{sig.get('symbol','?')}: {sig['error']}")
                continue
            
            coin = sig["symbol"]
            
            if not sig.get("has_signal"):
                continue
            
            # Guard 1: Already have open position
            if paper_trades.has_open_position(coin):
                result["skipped"].append(f"{coin}: already open")
                continue
            
            # Guard 2: On cooldown
            on_cd, remaining = paper_trades.is_on_cooldown(coin)
            if on_cd:
                result["skipped"].append(f"{coin}: cooldown {remaining:.1f}h left")
                continue
            
            # Guard 3: Check equity > 0
            if equity <= 0:
                result["errors"].append("equity <= 0, stopping")
                break
            
            # OPEN TRADE
            try:
                trade = paper_trades.open_trade(
                    symbol=coin,
                    direction=sig["direction"],
                    entry_price=sig["price"],
                    sl=sig["sl"],
                    tp=sig["tp"],
                    signals=sig.get("signals", []),
                    vote=sig.get("vote", 0),
                    auto=True,
                )
                result["opened"].append({
                    "symbol": coin,
                    "direction": sig["direction"],
                    "price": sig["price"],
                    "sl": sig["sl"],
                    "tp": sig["tp"],
                    "vote": sig.get("vote", 0),
                    "size_usd": trade.get("size_usd", 0),
                })
                logger.info(
                    f"OPENED {coin} {sig['direction']} @ {sig['price']} "
                    f"SL={sig['sl']} TP={sig['tp']} vote={sig.get('vote',0)} "
                    f"size=${trade.get('size_usd',0):.2f}"
                )
            except Exception as e:
                result["errors"].append(f"{coin}: open failed: {str(e)[:50]}")
        
        result["equity"] = round(equity, 2)
        result["active_count"] = len(paper_trades.get_active_trades())
        
        # Log summary
        if result["skipped"]:
            logger.info(f"Skipped: {', '.join(result['skipped'])}")
        no_signal = [s['symbol'] for s in signals if not s.get('has_signal') and not s.get('error')]
        if no_signal:
            logger.info(f"No signal: {', '.join(no_signal)}")
        logger.info(f"Equity: ${equity:.2f} | Active: {result['active_count']}")
        
    except Exception as e:
        result["errors"].append(f"cycle error: {str(e)[:100]}")
        logger.error(f"Cycle error: {e}")
    
    _last_result = result
    return result

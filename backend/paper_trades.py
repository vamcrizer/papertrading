# -*- coding: utf-8 -*-
"""
Paper Trading Module — Store and track virtual trades
=====================================================
OPTIMIZED: Memory cache, WebSocket prices, no redundant API calls
"""
import json, os, time, threading
from datetime import datetime, timezone, timedelta

TRADES_FILE = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), 'paper_trades.json')

INITIAL_CAPITAL = 250.0
LEVERAGE = 3
ALLOC_PCT = 0.10
FEE_RATE = 0.0004
FUNDING_PER_H = 0.000125
MAX_HOLD_HOURS = 720
CD_AFTER_SL = 24
CD_AFTER_TP = 6

# ── In-memory cache ──────────────────────────────────
_cache = None
_cache_lock = threading.Lock()


def _load():
    global _cache
    with _cache_lock:
        if _cache is not None:
            return _cache
        if os.path.exists(TRADES_FILE):
            try:
                with open(TRADES_FILE, 'r') as f:
                    data = json.load(f)
                if isinstance(data, dict) and "active" in data:
                    data.setdefault("closed", [])
                    data.setdefault("config", {})
                    data.setdefault("cooldowns", {})
                    _cache = data
                    return _cache
            except:
                pass
        _cache = {"active": [], "closed": [], "config": {}, "cooldowns": {}}
        return _cache


def _save(data=None):
    global _cache
    with _cache_lock:
        if data is not None:
            _cache = data
        if _cache is not None:
            with open(TRADES_FILE, 'w') as f:
                json.dump(_cache, f, indent=2, default=str)


def _invalidate():
    """Force reload from disk (e.g. after external edit)."""
    global _cache
    with _cache_lock:
        _cache = None


def get_equity():
    data = _load()
    closed_pnl = sum(t.get("pnl", 0) for t in data.get("closed", []))
    return INITIAL_CAPITAL + closed_pnl


def has_open_position(coin: str):
    data = _load()
    coin_u = coin.upper()
    return any(t["symbol"].upper() == coin_u for t in data["active"])


def get_open_trades_raw():
    """Get active trades without price enrichment (fast, no API calls)."""
    data = _load()
    return list(data["active"])


def is_on_cooldown(coin: str):
    data = _load()
    cd_info = data.get("cooldowns", {}).get(coin.upper())
    if not cd_info:
        return False, 0
    until = datetime.fromisoformat(cd_info["until"])
    now = datetime.now(timezone.utc)
    if now < until:
        remaining_h = (until - now).total_seconds() / 3600
        return True, round(remaining_h, 1)
    return False, 0


def _set_cooldown(coin: str, reason: str):
    data = _load()
    hours = CD_AFTER_TP if reason == "TP" else CD_AFTER_SL
    until = datetime.now(timezone.utc) + timedelta(hours=hours)
    if "cooldowns" not in data:
        data["cooldowns"] = {}
    data["cooldowns"][coin.upper()] = {
        "until": until.isoformat(),
        "reason": reason,
        "hours": hours,
    }
    _save()


def open_trade(symbol: str, direction: str, entry_price: float, sl: float, tp: float,
               signals: list = None, vote: int = 0, auto: bool = False):
    data = _load()
    equity = get_equity()
    margin = equity * ALLOC_PCT
    notional = margin * LEVERAGE
    qty = notional / entry_price
    fee_entry = notional * FEE_RATE

    trade = {
        "id": int(time.time() * 1000),
        "symbol": symbol.upper(),
        "direction": direction.upper(),
        "entry_price": entry_price,
        "sl": sl, "tp": tp,
        "size_usd": round(notional, 2),
        "margin": round(margin, 2),
        "leverage": LEVERAGE,
        "qty": qty,
        "fee_entry": round(fee_entry, 4),
        "equity_at_entry": round(equity, 2),
        "opened_at": datetime.now(timezone.utc).isoformat(),
        "status": "OPEN",
        "signals": signals or [],
        "vote": vote,
        "auto": auto,
    }
    data["active"].append(trade)
    _save()
    return trade


def close_trade(trade_id: int, exit_price: float = None, reason: str = "MANUAL"):
    data = _load()
    closed = None
    for i, t in enumerate(data["active"]):
        if t["id"] == trade_id:
            closed = data["active"].pop(i)
            closed["status"] = reason
            closed["exit_price"] = exit_price or 0
            closed["closed_at"] = datetime.now(timezone.utc).isoformat()

            notional = closed.get("size_usd", 150)
            qty = closed.get("qty", notional / closed["entry_price"])
            fee_entry = closed.get("fee_entry", notional * FEE_RATE)
            fee_exit = qty * closed["exit_price"] * FEE_RATE

            opened = datetime.fromisoformat(closed["opened_at"])
            now = datetime.now(timezone.utc)
            hold_hours = (now - opened).total_seconds() / 3600
            funding = notional * FUNDING_PER_H * hold_hours

            if closed["direction"] == "LONG":
                gross = (closed["exit_price"] - closed["entry_price"]) * qty
            else:
                gross = (closed["entry_price"] - closed["exit_price"]) * qty

            closed["pnl"] = round(gross - fee_entry - fee_exit - funding, 2)
            closed["pnl_pct"] = round(closed["pnl"] / closed.get("margin", notional) * 100, 2)
            closed["fees"] = round(fee_entry + fee_exit, 4)
            closed["funding"] = round(funding, 4)
            closed["hold_hours"] = round(hold_hours, 1)

            data["closed"].append(closed)
            cd_reason = "TP" if reason == "TP" else "SL"
            break

    _save()
    if closed:
        _set_cooldown(closed["symbol"], cd_reason)
    return closed


def check_and_close_trades():
    """Check all active trades for SL/TP/timeout hits using WebSocket prices."""
    data = _load()
    if not data["active"]:
        return []
    
    try:
        import ws_monitor
        live_prices = ws_monitor.get_prices()
    except:
        live_prices = {}
    
    closed_trades = []
    now = datetime.now(timezone.utc)
    
    for t in list(data["active"]):
        current = live_prices.get(t["symbol"].upper(), 0)
        if current == 0:
            continue
        
        # Check SL/TP
        if t["direction"] == "LONG":
            sl_hit = current <= t["sl"]
            tp_hit = current >= t["tp"]
        else:
            sl_hit = current >= t["sl"]
            tp_hit = current <= t["tp"]
        
        # Check timeout (max hold)
        opened = datetime.fromisoformat(t["opened_at"])
        hold_hours = (now - opened).total_seconds() / 3600
        timeout = hold_hours >= MAX_HOLD_HOURS
        
        if sl_hit:
            result = close_trade(t["id"], t["sl"], "SL")
            if result: closed_trades.append(result)
        elif tp_hit:
            result = close_trade(t["id"], t["tp"], "TP")
            if result: closed_trades.append(result)
        elif timeout:
            result = close_trade(t["id"], current, "TIMEOUT")
            if result: closed_trades.append(result)
    
    return closed_trades


def get_active_trades(live_prices: dict = None):
    """Get active trades enriched with live prices from WebSocket (no API calls)."""
    data = _load()
    if not data["active"]:
        return []

    # Import ws_monitor for prices if not provided
    if live_prices is None:
        try:
            import ws_monitor
            live_prices = ws_monitor.get_prices()
        except:
            live_prices = {}

    results = []
    now = datetime.now(timezone.utc)
    for t in data["active"]:
        current = live_prices.get(t["symbol"].upper(), t.get("current_price", t["entry_price"]))
        if current == 0:
            current = t["entry_price"]

        if t["direction"] == "LONG":
            pnl = (current - t["entry_price"]) * t["qty"]
            pnl_pct = (current - t["entry_price"]) / t["entry_price"] * 100
        else:
            pnl = (t["entry_price"] - current) * t["qty"]
            pnl_pct = (t["entry_price"] - current) / t["entry_price"] * 100

        opened = datetime.fromisoformat(t["opened_at"])
        hold_hours = (now - opened).total_seconds() / 3600

        results.append({
            **t,
            "current_price": current,
            "pnl": round(pnl, 2),
            "pnl_pct": round(pnl_pct, 2),
            "hold_hours": round(hold_hours, 1),
            "status": "OPEN",
        })
    return results


def get_closed_trades():
    data = _load()
    return data.get("closed", [])


def get_stats():
    data = _load()
    closed = data.get("closed", [])
    equity = get_equity()

    if not closed:
        return {
            "total": 0, "wins": 0, "losses": 0,
            "total_pnl": 0, "wr": 0,
            "equity": round(equity, 2),
            "initial_capital": INITIAL_CAPITAL,
            "leverage": LEVERAGE,
        }

    wins = [t for t in closed if t.get("pnl", 0) > 0]
    losses = [t for t in closed if t.get("pnl", 0) <= 0]
    total_pnl = sum(t.get("pnl", 0) for t in closed)
    total_fees = sum(t.get("fees", 0) for t in closed)
    total_funding = sum(t.get("funding", 0) for t in closed)

    return {
        "total": len(closed),
        "wins": len(wins),
        "losses": len(losses),
        "total_pnl": round(total_pnl, 2),
        "total_fees": round(total_fees, 2),
        "total_funding": round(total_funding, 2),
        "wr": round(len(wins) / len(closed) * 100, 1) if closed else 0,
        "equity": round(equity, 2),
        "initial_capital": INITIAL_CAPITAL,
        "return_pct": round((equity - INITIAL_CAPITAL) / INITIAL_CAPITAL * 100, 1),
        "leverage": LEVERAGE,
        "alloc_pct": ALLOC_PCT,
    }

# -*- coding: utf-8 -*-
"""
Strategy Paper Trades — Per-strategy virtual accounts
======================================================
Each strategy has:
  - Isolated virtual capital (initial 1000 USD)
  - Isolated trade history stored in strategy_trades_{id}.json
  - Live PnL from WebSocket prices (ws_monitor)
  - Auto SL/TP monitoring
"""
import json, os, time, threading
from datetime import datetime, timezone, timedelta

_BASE_DIR = os.path.dirname(os.path.abspath(__file__))

FEE_RATE       = 0.00035    # taker fee
FUNDING_PER_H  = 0.000125   # approx 8h funding spread per hour
MAX_HOLD_HOURS = 720         # 30 days max
CD_AFTER_TP    = 6
CD_AFTER_SL    = 24


def _trades_file(strategy_id: str) -> str:
    return os.path.join(_BASE_DIR, f"strategy_trades_{strategy_id}.json")


# ── Per-strategy cache ────────────────────────────────────────
_caches = {}       # strategy_id -> data dict
_cache_locks = {}  # strategy_id -> Lock


def _get_lock(strategy_id: str) -> threading.Lock:
    if strategy_id not in _cache_locks:
        _cache_locks[strategy_id] = threading.Lock()
    return _cache_locks[strategy_id]


def _load(strategy_id: str) -> dict:
    lock = _get_lock(strategy_id)
    with lock:
        if _caches.get(strategy_id) is not None:
            return _caches[strategy_id]
        fpath = _trades_file(strategy_id)
        if os.path.exists(fpath):
            try:
                with open(fpath, 'r') as f:
                    data = json.load(f)
                if isinstance(data, dict) and "active" in data:
                    data.setdefault("closed", [])
                    data.setdefault("cooldowns", {})
                    _caches[strategy_id] = data
                    return _caches[strategy_id]
            except Exception:
                pass
        # Default: get initial_capital from STRATEGIES registry
        from strategy_engine import STRATEGIES
        init_cap = STRATEGIES.get(strategy_id, {}).get("initial_capital", 1000.0)
        _caches[strategy_id] = {
            "active": [],
            "closed": [],
            "cooldowns": {},
            "initial_capital": init_cap,
        }
        return _caches[strategy_id]


def _save(strategy_id: str):
    lock = _get_lock(strategy_id)
    with lock:
        data = _caches.get(strategy_id)
        if data is not None:
            with open(_trades_file(strategy_id), 'w') as f:
                json.dump(data, f, indent=2, default=str)


# ── Helpers ───────────────────────────────────────────────────

def get_equity(strategy_id: str) -> float:
    data = _load(strategy_id)
    init_cap = data.get("initial_capital", 1000.0)
    closed_pnl = sum(t.get("pnl", 0) for t in data.get("closed", []))
    return init_cap + closed_pnl


def has_open_position(strategy_id: str) -> bool:
    data = _load(strategy_id)
    return len(data["active"]) > 0


def is_on_cooldown(strategy_id: str) -> tuple:
    data = _load(strategy_id)
    cd = data.get("cooldowns", {}).get(strategy_id)
    if not cd:
        return False, 0
    until = datetime.fromisoformat(cd["until"])
    now = datetime.now(timezone.utc)
    if now < until:
        return True, round((until - now).total_seconds() / 3600, 1)
    return False, 0


def _set_cooldown(strategy_id: str, reason: str):
    data = _load(strategy_id)
    hours = CD_AFTER_TP if reason == "TP" else CD_AFTER_SL
    until = datetime.now(timezone.utc) + timedelta(hours=hours)
    data.setdefault("cooldowns", {})[strategy_id] = {
        "until": until.isoformat(),
        "reason": reason,
        "hours": hours,
    }
    _save(strategy_id)


# ── Open trade ────────────────────────────────────────────────

def open_trade(strategy_id: str, symbol: str, direction: str,
               entry_price: float, sl: float, tp: float,
               signal_type: str = "", auto: bool = True) -> dict:
    from strategy_engine import STRATEGIES
    cfg = STRATEGIES.get(strategy_id, {})

    equity = get_equity(strategy_id)
    leverage = cfg.get("max_leverage", 5.0)
    risk_pct = cfg.get("risk_pct", 1.5)
    fee_rate = cfg.get("taker_fee", FEE_RATE)

    # Position sizing: risk-based
    rpu = abs(entry_price - sl)
    if rpu <= 0:
        return {"error": "Invalid SL"}
    risk_money = equity * risk_pct / 100.0
    qty = min(risk_money / rpu, equity * leverage / entry_price)
    if qty <= 0:
        return {"error": "qty <= 0"}

    notional = qty * entry_price
    fee_entry = notional * fee_rate

    trade = {
        "id": int(time.time() * 1000),
        "strategy_id": strategy_id,
        "symbol": symbol.upper(),
        "direction": direction.upper(),
        "entry_price": round(entry_price, 6),
        "sl": round(sl, 6),
        "tp": round(tp, 6),
        "qty": qty,
        "notional": round(notional, 2),
        "fee_entry": round(fee_entry, 6),
        "equity_at_entry": round(equity, 2),
        "signal_type": signal_type,
        "opened_at": datetime.now(timezone.utc).isoformat(),
        "status": "OPEN",
        "auto": auto,
    }

    data = _load(strategy_id)
    data["active"].append(trade)
    _save(strategy_id)
    return trade


# ── Close trade ───────────────────────────────────────────────

def close_trade(strategy_id: str, trade_id: int,
                exit_price: float, reason: str = "MANUAL") -> dict | None:
    data = _load(strategy_id)
    closed = None

    for i, t in enumerate(data["active"]):
        if t["id"] == trade_id:
            closed = data["active"].pop(i)
            closed["status"] = reason
            closed["exit_price"] = round(exit_price, 6)
            closed["closed_at"] = datetime.now(timezone.utc).isoformat()

            notional = closed.get("notional", closed["qty"] * closed["entry_price"])
            qty      = closed["qty"]
            fee_entry = closed.get("fee_entry", notional * FEE_RATE)
            fee_exit  = qty * exit_price * FEE_RATE

            opened     = datetime.fromisoformat(closed["opened_at"])
            hold_hours = (datetime.now(timezone.utc) - opened).total_seconds() / 3600
            funding    = notional * FUNDING_PER_H * hold_hours

            if closed["direction"] == "LONG":
                gross = (exit_price - closed["entry_price"]) * qty
            else:
                gross = (closed["entry_price"] - exit_price) * qty

            closed["pnl"]       = round(gross - fee_entry - fee_exit - funding, 4)
            closed["pnl_pct"]   = round(closed["pnl"] / closed["equity_at_entry"] * 100, 2)
            closed["fees"]      = round(fee_entry + fee_exit, 6)
            closed["funding"]   = round(funding, 6)
            closed["hold_hours"] = round(hold_hours, 1)

            data["closed"].append(closed)
            break

    _save(strategy_id)
    if closed:
        cd_reason = "TP" if reason == "TP" else "SL"
        _set_cooldown(strategy_id, cd_reason)
    return closed


# ── Monitor SL/TP ─────────────────────────────────────────────

def check_and_close(strategy_id: str) -> list:
    """Check active trades for SL/TP/timeout using ws_monitor prices."""
    data = _load(strategy_id)
    if not data["active"]:
        return []

    try:
        import ws_monitor
        live_prices = ws_monitor.get_prices()
    except Exception:
        live_prices = {}

    now = datetime.now(timezone.utc)
    closed_list = []

    for t in list(data["active"]):
        coin = t["symbol"].upper()
        current = live_prices.get(coin, 0)
        if current == 0:
            continue

        if t["direction"] == "LONG":
            sl_hit = current <= t["sl"]
            tp_hit = current >= t["tp"]
        else:
            sl_hit = current >= t["sl"]
            tp_hit = current <= t["tp"]

        opened     = datetime.fromisoformat(t["opened_at"])
        hold_hours = (now - opened).total_seconds() / 3600
        timeout    = hold_hours >= MAX_HOLD_HOURS

        if sl_hit:
            r = close_trade(strategy_id, t["id"], t["sl"], "SL")
        elif tp_hit:
            r = close_trade(strategy_id, t["id"], t["tp"], "TP")
        elif timeout:
            r = close_trade(strategy_id, t["id"], current, "TIMEOUT")
        else:
            r = None

        if r:
            closed_list.append(r)

    return closed_list


# ── Read helpers ──────────────────────────────────────────────

def get_active_trades(strategy_id: str) -> list:
    data = _load(strategy_id)
    if not data["active"]:
        return []

    try:
        import ws_monitor
        live_prices = ws_monitor.get_prices()
    except Exception:
        live_prices = {}

    now = datetime.now(timezone.utc)
    results = []
    for t in data["active"]:
        coin    = t["symbol"].upper()
        current = live_prices.get(coin, t.get("entry_price", 0))
        if current == 0:
            current = t["entry_price"]

        qty = t["qty"]
        if t["direction"] == "LONG":
            pnl     = (current - t["entry_price"]) * qty
            pnl_pct = (current - t["entry_price"]) / t["entry_price"] * 100
        else:
            pnl     = (t["entry_price"] - current) * qty
            pnl_pct = (t["entry_price"] - current) / t["entry_price"] * 100

        opened     = datetime.fromisoformat(t["opened_at"])
        hold_hours = (now - opened).total_seconds() / 3600

        results.append({
            **t,
            "current_price": round(current, 6),
            "pnl":           round(pnl, 4),
            "pnl_pct":       round(pnl_pct, 2),
            "hold_hours":    round(hold_hours, 1),
        })
    return results


def get_closed_trades(strategy_id: str) -> list:
    return _load(strategy_id).get("closed", [])


def get_stats(strategy_id: str) -> dict:
    data = _load(strategy_id)
    closed   = data.get("closed", [])
    equity   = get_equity(strategy_id)
    init_cap = data.get("initial_capital", 1000.0)

    if not closed:
        return {
            "total": 0, "wins": 0, "losses": 0,
            "win_rate": 0, "total_pnl": 0,
            "equity": round(equity, 2),
            "initial_capital": round(init_cap, 2),
            "return_pct": 0,
        }

    wins   = [t for t in closed if t.get("pnl", 0) > 0]
    losses = [t for t in closed if t.get("pnl", 0) <= 0]
    total_pnl  = sum(t.get("pnl", 0) for t in closed)
    total_fees = sum(t.get("fees", 0) for t in closed)

    return {
        "total":           len(closed),
        "wins":            len(wins),
        "losses":          len(losses),
        "win_rate":        round(len(wins) / len(closed) * 100, 1) if closed else 0,
        "total_pnl":       round(total_pnl, 2),
        "total_fees":      round(total_fees, 4),
        "equity":          round(equity, 2),
        "initial_capital": round(init_cap, 2),
        "return_pct":      round((equity - init_cap) / init_cap * 100, 2),
    }

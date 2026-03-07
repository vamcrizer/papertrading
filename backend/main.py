# -*- coding: utf-8 -*-
"""
Trading Dashboard — FastAPI Backend
"""
import sys, os, threading, time, logging, asyncio
sys.path.insert(0, os.path.dirname(__file__))

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from datetime import datetime, timezone
import json

logging.basicConfig(level=logging.INFO, format='%(asctime)s [%(name)s] %(message)s')
logger = logging.getLogger("main")

app = FastAPI(title="Trading Dashboard API")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

@app.get("/api/health")
def health():
    return {"status": "ok", "time": datetime.now(timezone.utc).isoformat()}

@app.get("/api/signals")
def get_signals():
    from scanner import scan_all
    signals = scan_all()
    active = [s for s in signals if s.get('has_signal')]
    return {
        "time": datetime.now(timezone.utc).isoformat(),
        "total": len(signals),
        "active": len(active),
        "signals": signals,
    }

@app.get("/api/vn-stocks")
def get_vn_stocks():
    from vn_stocks import get_vn_ranking, get_vn_index
    ranking = get_vn_ranking()
    vni = get_vn_index()
    return {
        "time": datetime.now(timezone.utc).isoformat(),
        "vn_index": vni,
        "stocks": ranking,
        "top5": ranking[:5] if ranking else [],
        "avoid": ranking[-5:] if ranking else [],
    }

@app.get("/api/vn-funds")
def get_vn_funds():
    from vn_stocks import get_fund_recommendations
    funds = get_fund_recommendations()
    return {"funds": funds}

@app.get("/api/models")
def get_models():
    from models import get_all_models
    return {"models": get_all_models()}

@app.get("/api/models/{model_id}")
def get_model(model_id: str):
    from models import get_model as gm
    m = gm(model_id)
    if not m:
        return {"error": "Model not found"}
    return m

# ═══════════════════════════════════════
# PAPER TRADING
# ═══════════════════════════════════════
from pydantic import BaseModel

class TradeRequest(BaseModel):
    symbol: str
    direction: str
    entry_price: float
    sl: float
    tp: float

@app.post("/api/trades")
def open_trade(req: TradeRequest):
    from paper_trades import open_trade as ot
    trade = ot(req.symbol, req.direction, req.entry_price, req.sl, req.tp)
    return {"status": "opened", "trade": trade}

@app.get("/api/trades")
def get_trades():
    from paper_trades import get_active_trades, get_stats
    active = get_active_trades()
    stats = get_stats()
    total_pnl = sum(t.get('pnl', 0) for t in active)
    return {
        "time": datetime.now(timezone.utc).isoformat(),
        "active": active,
        "total_open_pnl": round(total_pnl, 2),
        "stats": stats,
    }

@app.get("/api/trades/history")
def get_history():
    from paper_trades import get_closed_trades, get_stats
    return {
        "closed": get_closed_trades(),
        "stats": get_stats(),
    }

@app.delete("/api/trades/{trade_id}")
def close_trade(trade_id: int, exit_price: float = 0):
    from paper_trades import close_trade as ct
    result = ct(trade_id, exit_price, reason="MANUAL")
    if result:
        return {"status": "closed", "trade": result}
    return {"error": "Trade not found"}

# ═══════════════════════════════════════
# AUTO TRADING
# ═══════════════════════════════════════
@app.get("/api/auto-trade/status")
def auto_trade_status():
    from auto_trader import get_status
    return get_status()

@app.post("/api/auto-trade/toggle")
def auto_trade_toggle():
    from auto_trader import toggle
    enabled = toggle()
    return {"enabled": enabled}

@app.post("/api/auto-trade/run")
def auto_trade_run():
    """Manually trigger one trading cycle."""
    from auto_trader import run_cycle
    result = run_cycle()
    return result

# Background scheduler thread
def _auto_trade_loop():
    """Runs auto trade cycle every 60 minutes if enabled."""
    logger.info("Auto trade scheduler started")
    while True:
        try:
            from auto_trader import is_enabled, run_cycle
            if is_enabled():
                logger.info("Running auto trade cycle...")
                result = run_cycle()
                opened = len(result.get("opened", []))
                closed = len(result.get("closed", []))
                errors = len(result.get("errors", []))
                logger.info(f"Cycle done: opened={opened} closed={closed} errors={errors}")
        except Exception as e:
            logger.error(f"Auto trade error: {e}")
        time.sleep(3600)  # 1 hour

# ═══════════════════════════════════════
# LIVE PRICES (WebSocket)
# ═══════════════════════════════════════
@app.get("/api/prices")
def get_prices():
    import ws_monitor
    prices = ws_monitor.get_prices()
    return {
        "time": datetime.now(timezone.utc).isoformat(),
        "prices": prices,
        "ws_connected": ws_monitor.is_running(),
    }

@app.get("/api/prices/stream")
async def price_stream():
    """Server-Sent Events stream for live prices."""
    import ws_monitor
    async def event_generator():
        last_prices = {}
        while True:
            prices = ws_monitor.get_prices()
            if prices != last_prices:
                data = json.dumps({"prices": prices, "time": datetime.now(timezone.utc).isoformat()})
                yield f"data: {data}\n\n"
                last_prices = dict(prices)
            await asyncio.sleep(1)  # 1 second update rate
    return StreamingResponse(event_generator(), media_type="text/event-stream")

# ═══════════════════════════════════════
# STRATEGY PAPER TRADING (per-strategy accounts)
# ═══════════════════════════════════════

@app.get("/api/strategies")
def list_strategies():
    """List all registered strategies with their current stats."""
    from strategy_engine import STRATEGIES
    from strategy_trades import get_stats, get_active_trades
    results = []
    for sid, cfg in STRATEGIES.items():
        stats = get_stats(sid)
        active = get_active_trades(sid)
        results.append({
            "id": sid,
            "name": cfg["name"],
            "symbol": cfg["coin"],
            "timeframe": cfg["timeframe"],
            "stats": stats,
            "active_count": len(active),
        })
    return {"strategies": results}


@app.get("/api/strategies/{strategy_id}/signal")
def get_strategy_signal(strategy_id: str):
    """Get current live signal for a strategy."""
    from strategy_engine import get_signal
    return get_signal(strategy_id)


@app.get("/api/strategies/{strategy_id}/trades")
def get_strategy_trades(strategy_id: str):
    """Get active + stats for a strategy account."""
    from strategy_trades import get_active_trades, get_stats
    return {
        "time": datetime.now(timezone.utc).isoformat(),
        "strategy_id": strategy_id,
        "active": get_active_trades(strategy_id),
        "stats": get_stats(strategy_id),
    }


@app.get("/api/strategies/{strategy_id}/history")
def get_strategy_history(strategy_id: str):
    """Get closed trade history for a strategy account."""
    from strategy_trades import get_closed_trades, get_stats
    return {
        "strategy_id": strategy_id,
        "closed": get_closed_trades(strategy_id),
        "stats": get_stats(strategy_id),
    }


class StrategyTradeRequest(BaseModel):
    direction: str
    entry_price: float
    sl: float
    tp: float
    signal_type: str = ""


@app.post("/api/strategies/{strategy_id}/trades")
def open_strategy_trade(strategy_id: str, req: StrategyTradeRequest):
    """Manually open a paper trade on a strategy account."""
    from strategy_engine import STRATEGIES
    from strategy_trades import open_trade
    if strategy_id not in STRATEGIES:
        return {"error": f"Unknown strategy: {strategy_id}"}
    cfg = STRATEGIES[strategy_id]
    trade = open_trade(
        strategy_id=strategy_id,
        symbol=cfg["coin"],
        direction=req.direction,
        entry_price=req.entry_price,
        sl=req.sl,
        tp=req.tp,
        signal_type=req.signal_type,
        auto=False,
    )
    return {"status": "opened", "trade": trade}


@app.delete("/api/strategies/{strategy_id}/trades/{trade_id}")
def close_strategy_trade(strategy_id: str, trade_id: int, exit_price: float = 0):
    """Manually close a strategy paper trade."""
    from strategy_trades import close_trade, get_active_trades
    # Get current price if exit_price not supplied
    if exit_price == 0:
        try:
            import ws_monitor
            from strategy_engine import STRATEGIES
            coin = STRATEGIES.get(strategy_id, {}).get("coin", "")
            exit_price = ws_monitor.get_price(coin) or 0
        except Exception:
            pass
    result = close_trade(strategy_id, trade_id, exit_price, reason="MANUAL")
    if result:
        return {"status": "closed", "trade": result}
    return {"error": "Trade not found"}


@app.post("/api/strategies/{strategy_id}/run-cycle")
def run_strategy_cycle(strategy_id: str):
    """Check signals and auto-open/close trades for a strategy."""
    from strategy_engine import STRATEGIES, get_signal
    from strategy_trades import (
        check_and_close, open_trade,
        has_open_position, is_on_cooldown, get_equity
    )
    if strategy_id not in STRATEGIES:
        return {"error": f"Unknown strategy: {strategy_id}"}

    result = {"strategy_id": strategy_id, "closed": [], "opened": None, "skipped": None, "error": None}

    # Step 1: Close SL/TP
    closed = check_and_close(strategy_id)
    for c in closed:
        result["closed"].append({"id": c["id"], "reason": c["status"], "pnl": c.get("pnl", 0)})

    # Step 2: Signal
    sig = get_signal(strategy_id)
    if sig.get("error"):
        result["error"] = sig["error"]
        return result

    if not sig.get("has_signal"):
        result["skipped"] = "no_signal"
        return result

    if has_open_position(strategy_id):
        result["skipped"] = "already_open"
        return result

    on_cd, remaining = is_on_cooldown(strategy_id)
    if on_cd:
        result["skipped"] = f"cooldown_{remaining:.1f}h"
        return result

    cfg = STRATEGIES[strategy_id]
    trade = open_trade(
        strategy_id=strategy_id,
        symbol=cfg["coin"],
        direction=sig["direction"],
        entry_price=sig["price"],
        sl=sig["sl"],
        tp=sig["tp"],
        signal_type=sig.get("signal_type", ""),
        auto=True,
    )
    result["opened"] = trade
    return result


# Background: strategy monitoring loop
def _strategy_monitor_loop():
    """Check strategy SL/TP every 60 seconds and run hourly signal cycles."""
    import time as _time
    from strategy_engine import STRATEGIES
    from strategy_trades import check_and_close, open_trade, has_open_position, is_on_cooldown
    from strategy_engine import get_signal

    logger.info("Strategy monitor loop started")
    last_cycle = {}  # strategy_id -> last cycle timestamp

    while True:
        try:
            now = _time.time()
            for sid in STRATEGIES:
                # SL/TP check every loop (60s)
                try:
                    check_and_close(sid)
                except Exception as e:
                    logger.error(f"strategy check_and_close [{sid}]: {e}")

                # Signal cycle every 3600s (1h)
                if now - last_cycle.get(sid, 0) >= 3600:
                    last_cycle[sid] = now
                    try:
                        sig = get_signal(sid)
                        if sig.get("has_signal") and not has_open_position(sid):
                            on_cd, _ = is_on_cooldown(sid)
                            if not on_cd:
                                cfg = STRATEGIES[sid]
                                t = open_trade(
                                    strategy_id=sid,
                                    symbol=cfg["coin"],
                                    direction=sig["direction"],
                                    entry_price=sig["price"],
                                    sl=sig["sl"],
                                    tp=sig["tp"],
                                    signal_type=sig.get("signal_type", ""),
                                    auto=True,
                                )
                                logger.info(
                                    f"Strategy auto-trade [{sid}] {sig['direction']} "
                                    f"{cfg['coin']} @ {sig['price']:.2f}"
                                )
                    except Exception as e:
                        logger.error(f"strategy signal cycle [{sid}]: {e}")
        except Exception as e:
            logger.error(f"Strategy monitor loop error: {e}")
        _time.sleep(60)


@app.on_event("startup")
def startup():
    # Start auto trade loop
    t = threading.Thread(target=_auto_trade_loop, daemon=True)
    t.start()
    logger.info("Auto trade background thread started (runs every 60min)")

    # Start strategy monitor loop
    t2 = threading.Thread(target=_strategy_monitor_loop, daemon=True)
    t2.start()
    logger.info("Strategy monitor loop started")

    # Start WebSocket price monitor
    import ws_monitor
    ws_monitor.start()
    logger.info("WebSocket price monitor started (real-time SL/TP)")

# ═══════════════════════════════════════
# GOLD ADVISORY
# ═══════════════════════════════════════
@app.get("/api/gold")
def get_gold():
    from gold_advisory import metals_analysis
    return metals_analysis()

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

# -*- coding: utf-8 -*-
"""
WebSocket Price Monitor — Real-time SL/TP checking via Binance streams
======================================================================
OPTIMIZED:
- Uses in-memory trade cache (no disk reads per tick)
- Batched SL/TP check with debounce
- Combined stream for all 15 coins
"""
import asyncio
import json
import logging
import threading
import websockets
from datetime import datetime, timezone

logger = logging.getLogger("ws_monitor")

WS_BASE = "wss://fstream.binance.com/ws"

SYMBOLS = [
    'btcusdt', 'ethusdt', 'solusdt', 'xrpusdt', 'dogeusdt',
    'avaxusdt', 'adausdt', 'linkusdt', 'bnbusdt', 'bchusdt',
    'suiusdt', 'zecusdt', 'agldusdt', 'alphausdt', 'bnxusdt',
]

# Shared state
_prices = {}
_running = False
_ws_thread = None

# Cache active trades in memory to avoid disk reads on every tick
_active_cache = []
_cache_ts = 0
_CACHE_TTL = 5  # refresh trade list every 5 seconds


def get_prices():
    return dict(_prices)


def get_price(coin: str):
    return _prices.get(coin.upper(), 0)


def _refresh_trade_cache():
    """Refresh the active trades cache from memory (not disk — paper_trades uses in-memory cache)."""
    global _active_cache, _cache_ts
    import time
    now = time.time()
    if now - _cache_ts < _CACHE_TTL:
        return
    try:
        import paper_trades
        _active_cache = paper_trades.get_open_trades_raw()
        _cache_ts = now
    except Exception as e:
        logger.error(f"Cache refresh error: {e}")


def _check_sl_tp(symbol: str, price: float):
    """Check SL/TP using cached trade list (no disk I/O)."""
    _refresh_trade_cache()
    
    for t in _active_cache:
        if t["symbol"].upper() != symbol.upper():
            continue
        
        if t["direction"] == "LONG":
            sl_hit = price <= t["sl"]
            tp_hit = price >= t["tp"]
        else:
            sl_hit = price >= t["sl"]
            tp_hit = price <= t["tp"]
        
        if sl_hit or tp_hit:
            import paper_trades
            exit_price = t["sl"] if sl_hit else t["tp"]
            reason = "SL" if sl_hit else "TP"
            result = paper_trades.close_trade(t["id"], exit_price, reason)
            if result:
                logger.info(f"{reason} HIT {symbol} @ {price} | PnL=${result.get('pnl',0):.2f}")
                # Force refresh cache immediately after close
                global _cache_ts
                _cache_ts = 0


async def _ws_loop():
    global _running
    
    streams = "/".join(f"{s}@miniTicker" for s in SYMBOLS)
    url = f"{WS_BASE}/{streams}"
    
    while _running:
        try:
            logger.info(f"Connecting to Binance WS ({len(SYMBOLS)} streams)...")
            async with websockets.connect(url, ping_interval=20, ping_timeout=10) as ws:
                logger.info("Connected to Binance WebSocket")
                
                while _running:
                    try:
                        msg = await asyncio.wait_for(ws.recv(), timeout=30)
                        data = json.loads(msg)
                        
                        if 's' in data and 'c' in data:
                            raw_symbol = data['s']
                            price = float(data['c'])
                            coin = raw_symbol.replace('USDT', '')
                            _prices[coin] = price
                            _check_sl_tp(coin, price)
                    
                    except asyncio.TimeoutError:
                        try:
                            await ws.ping()
                        except:
                            break
                    except websockets.ConnectionClosed:
                        logger.warning("WS disconnected, reconnecting...")
                        break
                    except Exception as e:
                        logger.error(f"WS error: {e}")
        
        except Exception as e:
            logger.error(f"WS connection error: {e}")
        
        if _running:
            logger.info("Reconnecting in 5s...")
            await asyncio.sleep(5)


def _run_ws_thread():
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    loop.run_until_complete(_ws_loop())


def start():
    global _running, _ws_thread
    if _running:
        return
    _running = True
    _ws_thread = threading.Thread(target=_run_ws_thread, daemon=True)
    _ws_thread.start()
    logger.info("WebSocket monitor started")


def stop():
    global _running
    _running = False
    logger.info("WebSocket monitor stopping...")


def is_running():
    return _running

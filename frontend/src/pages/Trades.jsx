import { useState, useEffect, useRef } from 'react'

const API = import.meta.env.VITE_API_URL || 'http://localhost:8006'

export default function Trades() {
    const [trades, setTrades] = useState(null)
    const [history, setHistory] = useState(null)
    const [loading, setLoading] = useState(false)
    const [livePrices, setLivePrices] = useState({})
    const [wsConnected, setWsConnected] = useState(false)
    const [autoTradeEnabled, setAutoTradeEnabled] = useState(false)
    const sseRef = useRef(null)

    // Fetch trade data (without live prices — those come from SSE)
    const fetchTrades = async () => {
        setLoading(true)
        try {
            const r = await fetch(`${API}/api/trades`)
            const d = await r.json()
            setTrades(d)
        } catch (e) { console.error(e) }
        try {
            const r2 = await fetch(`${API}/api/trades/history`)
            const d2 = await r2.json()
            setHistory(d2)
        } catch (e) { console.error(e) }
        setLoading(false)
    }

    // Fetch auto trade status
    const fetchAutoStatus = async () => {
        try {
            const r = await fetch(`${API}/api/auto-trade/status`)
            const d = await r.json()
            setAutoTradeEnabled(d.enabled)
        } catch (e) { }
    }

    // SSE stream for live prices
    useEffect(() => {
        const connectSSE = () => {
            const sse = new EventSource(`${API}/api/prices/stream`)
            sseRef.current = sse

            sse.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data)
                    setLivePrices(data.prices || {})
                    setWsConnected(true)
                } catch (e) { }
            }

            sse.onerror = () => {
                setWsConnected(false)
                sse.close()
                // Reconnect in 3s
                setTimeout(connectSSE, 3000)
            }
        }

        connectSSE()
        return () => { if (sseRef.current) sseRef.current.close() }
    }, [])

    // Initial fetch + periodic refresh for trade list (every 30s)
    useEffect(() => {
        fetchTrades()
        fetchAutoStatus()
        const interval = setInterval(() => { fetchTrades() }, 30000)
        return () => clearInterval(interval)
    }, [])

    // Compute live PnL from SSE prices
    const getActiveTrades = () => {
        const active = trades?.active || []
        return active.map(t => {
            const livePrice = livePrices[t.symbol] || t.current_price || t.entry_price
            let pnl, pnl_pct
            if (t.direction === 'LONG') {
                pnl = (livePrice - t.entry_price) * t.qty
                pnl_pct = (livePrice - t.entry_price) / t.entry_price * 100
            } else {
                pnl = (t.entry_price - livePrice) * t.qty
                pnl_pct = (t.entry_price - livePrice) / t.entry_price * 100
            }
            // SL/TP proximity
            const slDist = t.direction === 'LONG'
                ? (livePrice - t.sl) / (t.entry_price - t.sl) * 100
                : (t.sl - livePrice) / (t.sl - t.entry_price) * 100
            const tpDist = t.direction === 'LONG'
                ? (t.tp - livePrice) / (t.tp - t.entry_price) * 100
                : (livePrice - t.tp) / (t.entry_price - t.tp) * 100

            return {
                ...t,
                current_price: livePrice,
                pnl: pnl,
                pnl_pct: pnl_pct,
                sl_dist: slDist,
                tp_dist: tpDist,
            }
        })
    }

    const closeTrade = async (id, exitPrice) => {
        await fetch(`${API}/api/trades/${id}?exit_price=${exitPrice}`, { method: 'DELETE' })
        fetchTrades()
    }

    const toggleAutoTrade = async () => {
        try {
            const r = await fetch(`${API}/api/auto-trade/toggle`, { method: 'POST' })
            const d = await r.json()
            setAutoTradeEnabled(d.enabled)
        } catch (e) { console.error(e) }
    }

    const runAutoNow = async () => {
        setLoading(true)
        try {
            await fetch(`${API}/api/auto-trade/run`, { method: 'POST' })
            await fetchTrades()
        } catch (e) { console.error(e) }
        setLoading(false)
    }

    const active = getActiveTrades()
    const totalPnl = active.reduce((s, t) => s + (t.pnl || 0), 0)
    const stats = history?.stats || trades?.stats || {}
    const closed = history?.closed || []

    return (
        <div>
            <div className="page-header">
                <h2>📋 Paper Trading</h2>
                <p>
                    {wsConnected
                        ? <span style={{ color: 'var(--green)' }}>● Live prices streaming</span>
                        : <span style={{ color: 'var(--red)' }}>○ Connecting...</span>
                    }
                    {' · '}
                    {autoTradeEnabled
                        ? <span style={{ color: 'var(--green)' }}>🤖 Auto trade ON</span>
                        : <span style={{ color: 'var(--text-muted)' }}>🤖 Auto trade OFF</span>
                    }
                </p>
            </div>

            {/* Stats */}
            <div className="card-grid" style={{ marginBottom: 24 }}>
                <div className="stat-card">
                    <div className="stat-label">Equity</div>
                    <div className="stat-value" style={{ color: 'var(--accent)' }}>
                        ${((stats.equity || 250) + totalPnl).toFixed(2)}
                    </div>
                    <div className="stat-change">
                        Capital: ${stats.initial_capital || 250} · {stats.leverage || 3}x lev
                    </div>
                </div>
                <div className="stat-card">
                    <div className="stat-label">Open PnL</div>
                    <div className="stat-value" style={{ color: totalPnl >= 0 ? 'var(--green)' : 'var(--red)' }}>
                        {totalPnl >= 0 ? '+' : ''}{totalPnl.toFixed(2)} USD
                    </div>
                    <div className="stat-change">{active.length} active trades</div>
                </div>
                <div className="stat-card">
                    <div className="stat-label">Closed Stats</div>
                    <div className="stat-value">{stats.total || 0}</div>
                    <div className="stat-change">
                        <span className="text-green">W: {stats.wins || 0}</span>
                        {' · '}
                        <span className="text-red">L: {stats.losses || 0}</span>
                        {stats.total > 0 && <span className="text-muted"> · WR: {stats.wr}%</span>}
                    </div>
                </div>
                <div className="stat-card">
                    <div className="stat-label">Closed PnL</div>
                    <div className="stat-value" style={{ color: (stats.total_pnl || 0) >= 0 ? 'var(--green)' : 'var(--red)' }}>
                        {(stats.total_pnl || 0) >= 0 ? '+' : ''}{(stats.total_pnl || 0).toFixed(2)}
                    </div>
                    <div className="stat-change">
                        Fees: ${(stats.total_fees || 0).toFixed(2)} · Fund: ${(stats.total_funding || 0).toFixed(2)}
                    </div>
                </div>
            </div>

            {/* Controls */}
            <div style={{ display: 'flex', gap: 12, marginBottom: 24, alignItems: 'center', flexWrap: 'wrap' }}>
                <button className="btn btn-primary" onClick={fetchTrades} disabled={loading}>
                    {loading ? '⏳...' : '🔄 Refresh'}
                </button>
                <button
                    className={`btn ${autoTradeEnabled ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={toggleAutoTrade}
                    style={autoTradeEnabled ? { background: 'var(--green)' } : {}}
                >
                    {autoTradeEnabled ? '🤖 Auto: ON' : '🤖 Auto: OFF'}
                </button>
                <button className="btn btn-secondary" onClick={runAutoNow} disabled={loading}>
                    ⚡ Run Cycle Now
                </button>
            </div>

            {/* Active Trades */}
            <div className="table-container" style={{ marginBottom: 24 }}>
                <div className="table-header">
                    <h3>🔥 Active Trades</h3>
                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                        {wsConnected
                            ? <><span className="pulse-dot" style={{ marginRight: 6, background: 'var(--green)' }}></span>Live</>
                            : 'Connecting...'
                        }
                    </span>
                </div>
                <table>
                    <thead>
                        <tr>
                            <th>Asset</th>
                            <th>Dir</th>
                            <th>Entry</th>
                            <th>Live Price</th>
                            <th>SL</th>
                            <th>TP</th>
                            <th>Size</th>
                            <th>PnL ($)</th>
                            <th>PnL (%)</th>
                            <th>Progress</th>
                            <th>Hold</th>
                            <th>Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        {active.length === 0 ? (
                            <tr><td colSpan={12} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
                                No active trades — turn on Auto Trade or wait for signals
                            </td></tr>
                        ) : active.map(t => {
                            // Progress bar: SL ← entry → TP
                            const slPct = Math.max(0, Math.min(100, 100 - (t.sl_dist || 50)))
                            const tpPct = Math.max(0, Math.min(100, 100 - (t.tp_dist || 50)))
                            const nearSL = (t.sl_dist || 100) < 20
                            const nearTP = (t.tp_dist || 100) < 20

                            return (
                                <tr key={t.id} style={{
                                    background: nearSL ? 'rgba(239,68,68,0.05)' : nearTP ? 'rgba(34,197,94,0.05)' : undefined,
                                    transition: 'background 0.3s'
                                }}>
                                    <td style={{ fontWeight: 700 }}>
                                        {t.symbol}
                                        {t.auto && <span style={{ fontSize: 9, marginLeft: 4, color: 'var(--accent)' }}>🤖</span>}
                                    </td>
                                    <td><span className={`badge badge-${t.direction?.toLowerCase()}`}>{t.direction}</span></td>
                                    <td style={{ fontFamily: 'monospace', fontSize: 12 }}>${t.entry_price?.toLocaleString()}</td>
                                    <td style={{
                                        fontFamily: 'monospace', fontSize: 12, fontWeight: 700,
                                        color: t.pnl >= 0 ? 'var(--green)' : 'var(--red)',
                                        transition: 'color 0.2s'
                                    }}>
                                        ${t.current_price?.toLocaleString()}
                                    </td>
                                    <td className="text-red" style={{ fontFamily: 'monospace', fontSize: 11 }}>
                                        ${t.sl?.toLocaleString()}
                                    </td>
                                    <td className="text-green" style={{ fontFamily: 'monospace', fontSize: 11 }}>
                                        ${t.tp?.toLocaleString()}
                                    </td>
                                    <td style={{ fontSize: 11 }}>${t.size_usd}</td>
                                    <td style={{
                                        fontWeight: 700,
                                        color: t.pnl >= 0 ? 'var(--green)' : 'var(--red)',
                                        fontFamily: 'monospace',
                                        transition: 'color 0.2s'
                                    }}>
                                        {t.pnl >= 0 ? '+' : ''}{t.pnl?.toFixed(2)}
                                    </td>
                                    <td style={{
                                        fontWeight: 700,
                                        color: t.pnl_pct >= 0 ? 'var(--green)' : 'var(--red)',
                                        transition: 'color 0.2s'
                                    }}>
                                        {t.pnl_pct >= 0 ? '+' : ''}{t.pnl_pct?.toFixed(2)}%
                                    </td>
                                    <td style={{ width: 80 }}>
                                        <div style={{
                                            width: '100%', height: 6, background: 'var(--bg-tertiary)',
                                            borderRadius: 3, overflow: 'hidden', position: 'relative'
                                        }}>
                                            <div style={{
                                                position: 'absolute', left: 0, top: 0, height: '100%',
                                                width: `${Math.max(0, Math.min(100, 50 + t.pnl_pct * 5))}%`,
                                                background: t.pnl >= 0
                                                    ? 'linear-gradient(90deg, var(--bg-tertiary), var(--green))'
                                                    : 'linear-gradient(90deg, var(--red), var(--bg-tertiary))',
                                                borderRadius: 3,
                                                transition: 'width 0.3s, background 0.3s'
                                            }}></div>
                                        </div>
                                    </td>
                                    <td style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                                        {t.hold_hours ? `${t.hold_hours.toFixed(0)}h` : '—'}
                                    </td>
                                    <td>
                                        <button className="btn btn-secondary" style={{ padding: '3px 8px', fontSize: 11 }}
                                            onClick={() => closeTrade(t.id, t.current_price)}>
                                            Close
                                        </button>
                                    </td>
                                </tr>
                            )
                        })}
                    </tbody>
                </table>
            </div>

            {/* Closed Trades History */}
            {closed.length > 0 && (
                <div className="table-container">
                    <div className="table-header">
                        <h3>📜 Trade History</h3>
                        <span className="text-muted" style={{ fontSize: 12 }}>
                            {stats.total} trades · WR: {stats.wr}% · PnL: {(stats.total_pnl || 0) >= 0 ? '+' : ''}{stats.total_pnl} USD
                        </span>
                    </div>
                    <table>
                        <thead>
                            <tr>
                                <th>Asset</th><th>Dir</th><th>Entry</th><th>Exit</th>
                                <th>PnL</th><th>Fees</th><th>Hold</th><th>Result</th><th>Closed</th>
                            </tr>
                        </thead>
                        <tbody>
                            {[...closed].reverse().map(t => (
                                <tr key={t.id}>
                                    <td style={{ fontWeight: 600 }}>
                                        {t.symbol}
                                        {t.auto && <span style={{ fontSize: 9, marginLeft: 4 }}>🤖</span>}
                                    </td>
                                    <td><span className={`badge badge-${t.direction?.toLowerCase()}`}>{t.direction}</span></td>
                                    <td style={{ fontFamily: 'monospace', fontSize: 12 }}>${t.entry_price?.toLocaleString()}</td>
                                    <td style={{ fontFamily: 'monospace', fontSize: 12 }}>${t.exit_price?.toLocaleString()}</td>
                                    <td style={{ fontWeight: 700, color: t.pnl >= 0 ? 'var(--green)' : 'var(--red)' }}>
                                        {t.pnl >= 0 ? '+' : ''}{t.pnl?.toFixed(2)}
                                    </td>
                                    <td style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                                        ${(t.fees || 0).toFixed(3)}
                                    </td>
                                    <td style={{ fontSize: 11 }}>{(t.hold_hours || 0).toFixed(0)}h</td>
                                    <td>
                                        {t.status === 'TP' ? '✅ TP' :
                                            t.status === 'SL' ? '❌ SL' :
                                                t.status === 'TIMEOUT' ? '⏰ TO' :
                                                    t.pnl >= 0 ? '✅' : '❌'}
                                    </td>
                                    <td style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                                        {new Date(t.closed_at).toLocaleString('vi-VN')}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    )
}

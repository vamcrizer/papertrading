import { useState, useEffect } from 'react'

const API = 'http://localhost:8000'

export default function Dashboard() {
    const [signals, setSignals] = useState(null)
    const [vnStocks, setVnStocks] = useState(null)
    const [models, setModels] = useState(null)
    const [loading, setLoading] = useState(true)
    const [placing, setPlacing] = useState(null)

    useEffect(() => {
        Promise.all([
            fetch(`${API}/api/signals`).then(r => r.json()).catch(() => null),
            fetch(`${API}/api/vn-stocks`).then(r => r.json()).catch(() => null),
            fetch(`${API}/api/models`).then(r => r.json()).catch(() => null),
        ]).then(([sig, vn, mod]) => {
            setSignals(sig); setVnStocks(vn); setModels(mod); setLoading(false)
        })
    }, [])

    const openTrade = async (symbol, direction, price, sl, tp) => {
        setPlacing(symbol + direction)
        try {
            await fetch(`${API}/api/trades`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ symbol, direction, entry_price: price, sl, tp, size_usd: 150 })
            })
            alert(`✅ ${direction} ${symbol} @ $${price} — SL: $${sl} / TP: $${tp}`)
        } catch (e) { alert('❌ Error: ' + e.message) }
        setPlacing(null)
    }

    const activeSignals = signals?.signals?.filter(s => s.has_signal) || []
    const longCount = activeSignals.filter(s => s.direction === 'LONG').length
    const shortCount = activeSignals.filter(s => s.direction === 'SHORT').length
    const top5 = vnStocks?.top5 || []

    return (
        <div>
            <div className="page-header">
                <h2>Dashboard</h2>
                <p>Tổng quan thị trường và signals</p>
            </div>

            <div className="card-grid">
                <div className="stat-card">
                    <div className="stat-label">Active Crypto Signals</div>
                    <div className="stat-value" style={{ color: 'var(--accent)' }}>
                        {loading ? '—' : activeSignals.length}
                    </div>
                    <div className="stat-change">
                        {!loading && <>
                            <span className="text-green">▲ {longCount} Long</span>
                            {' · '}
                            <span className="text-red">▼ {shortCount} Short</span>
                        </>}
                    </div>
                </div>

                <div className="stat-card">
                    <div className="stat-label">VN-Index</div>
                    <div className="stat-value">
                        {loading ? '—' : vnStocks?.vn_index?.price?.toLocaleString() || '—'}
                    </div>
                    <div className="stat-change">
                        {vnStocks?.vn_index?.ytd != null && (
                            <span className={vnStocks.vn_index.ytd >= 0 ? 'text-green' : 'text-red'}>
                                YTD: {vnStocks.vn_index.ytd > 0 ? '+' : ''}{vnStocks.vn_index.ytd}%
                            </span>
                        )}
                    </div>
                </div>

                <div className="stat-card">
                    <div className="stat-label">Active Models</div>
                    <div className="stat-value" style={{ color: 'var(--green)' }}>
                        {loading ? '—' : models?.models?.filter(m => m.status === 'active').length || 0}
                    </div>
                    <div className="stat-change text-muted">
                        {models?.models?.length || 0} total strategies
                    </div>
                </div>

                <div className="stat-card">
                    <div className="stat-label">Market Status</div>
                    <div className="stat-value" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span className="pulse-dot"></span> Live
                    </div>
                    <div className="stat-change text-muted">
                        {new Date().toLocaleString('vi-VN')}
                    </div>
                </div>
            </div>

            {/* Active Crypto Signals */}
            <div className="table-container" style={{ marginBottom: 24 }}>
                <div className="table-header">
                    <h3>⚡ Active Crypto Signals</h3>
                    <span className="text-muted" style={{ fontSize: 12 }}>
                        {signals?.time ? new Date(signals.time).toLocaleTimeString() : ''}
                    </span>
                </div>
                <table>
                    <thead>
                        <tr>
                            <th>Asset</th>
                            <th>Price</th>
                            <th>Signal</th>
                            <th>Vote</th>
                            <th>Reasons</th>
                            <th>SL</th>
                            <th>TP</th>
                            <th>Trade</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            [1, 2, 3].map(i => (
                                <tr key={i}><td colSpan={8}><div className="skeleton skeleton-row"></div></td></tr>
                            ))
                        ) : activeSignals.length === 0 ? (
                            <tr><td colSpan={8} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>No active signals</td></tr>
                        ) : activeSignals.map(s => (
                            <tr key={s.symbol}>
                                <td style={{ fontWeight: 700 }}>{s.symbol}</td>
                                <td style={{ fontFamily: 'monospace' }}>${s.price?.toLocaleString()}</td>
                                <td><span className={`badge badge-${s.direction?.toLowerCase()}`}>{s.direction}</span></td>
                                <td style={{ fontWeight: 700, color: s.vote > 0 ? 'var(--green)' : 'var(--red)' }}>{s.vote > 0 ? '+' : ''}{s.vote}</td>
                                <td><span className="text-muted" style={{ fontSize: 12 }}>{s.signals?.join(', ')}</span></td>
                                <td className="text-red" style={{ fontFamily: 'monospace', fontSize: 12 }}>${s.sl?.toLocaleString()}</td>
                                <td className="text-green" style={{ fontFamily: 'monospace', fontSize: 12 }}>${s.tp?.toLocaleString()}</td>
                                <td>
                                    <button
                                        className="btn btn-primary"
                                        style={{ padding: '4px 12px', fontSize: 12 }}
                                        disabled={placing === s.symbol + s.direction}
                                        onClick={() => openTrade(s.symbol, s.direction, s.price, s.sl, s.tp)}
                                    >
                                        {placing === s.symbol + s.direction ? '...' : `${s.direction} NOW`}
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* VN Stock Top Picks */}
            <div className="table-container">
                <div className="table-header">
                    <h3>🇻🇳 VN Stock Top 5 Picks</h3>
                    <span className="text-muted" style={{ fontSize: 12 }}>Multi-Factor Ranking</span>
                </div>
                <table>
                    <thead>
                        <tr>
                            <th>#</th>
                            <th>Stock</th>
                            <th>Price</th>
                            <th>3M</th>
                            <th>6M</th>
                            <th>1Y</th>
                            <th>Trend</th>
                            <th>Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            [1, 2, 3].map(i => <tr key={i}><td colSpan={8}><div className="skeleton skeleton-row"></div></td></tr>)
                        ) : top5.map((s, i) => (
                            <tr key={s.symbol}>
                                <td style={{ fontWeight: 700, color: 'var(--accent)' }}>#{i + 1}</td>
                                <td style={{ fontWeight: 700 }}>{s.symbol}</td>
                                <td>{s.price?.toLocaleString()} ₫</td>
                                <td className={s.ret_3m >= 0 ? 'text-green' : 'text-red'}>{s.ret_3m > 0 ? '+' : ''}{s.ret_3m}%</td>
                                <td className={s.ret_6m >= 0 ? 'text-green' : 'text-red'}>{s.ret_6m > 0 ? '+' : ''}{s.ret_6m}%</td>
                                <td className={s.ret_1y >= 0 ? 'text-green' : 'text-red'}>{s.ret_1y > 0 ? '+' : ''}{s.ret_1y}%</td>
                                <td><span className={`badge badge-${s.trend?.toLowerCase()}`}>{s.trend}</span></td>
                                <td><span className="badge badge-buy">BUY</span></td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    )
}

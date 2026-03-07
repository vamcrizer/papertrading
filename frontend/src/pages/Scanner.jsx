import { useState } from 'react'

const API = 'http://localhost:8000'

export default function Scanner() {
    const [signals, setSignals] = useState(null)
    const [loading, setLoading] = useState(false)
    const [lastUpdate, setLastUpdate] = useState(null)

    const refresh = async () => {
        setLoading(true)
        try {
            const r = await fetch(`${API}/api/signals`)
            const data = await r.json()
            setSignals(data)
            setLastUpdate(new Date())
        } catch (e) {
            console.error(e)
        }
        setLoading(false)
    }

    const all = signals?.signals || []
    const active = all.filter(s => s.has_signal)

    return (
        <div>
            <div className="page-header">
                <h2>⚡ Live Crypto Scanner</h2>
                <p>Ensemble V2 signals — 9 crypto perpetuals</p>
            </div>

            <div style={{ display: 'flex', gap: 12, marginBottom: 24, alignItems: 'center' }}>
                <button className="btn btn-primary" onClick={refresh} disabled={loading}>
                    {loading ? '⏳ Scanning...' : '🔍 Scan Now'}
                </button>
                {lastUpdate && (
                    <span className="text-muted" style={{ fontSize: 13 }}>
                        Last: {lastUpdate.toLocaleTimeString()} · {active.length} active / {all.length} total
                    </span>
                )}
            </div>

            {signals && (
                <div className="card-grid" style={{ marginBottom: 24 }}>
                    <div className="stat-card">
                        <div className="stat-label">Active Signals</div>
                        <div className="stat-value" style={{ color: 'var(--accent)' }}>{active.length}</div>
                    </div>
                    <div className="stat-card">
                        <div className="stat-label">Long / Short</div>
                        <div className="stat-value">
                            <span className="text-green">{active.filter(s => s.direction === 'LONG').length}</span>
                            {' / '}
                            <span className="text-red">{active.filter(s => s.direction === 'SHORT').length}</span>
                        </div>
                    </div>
                    <div className="stat-card">
                        <div className="stat-label">Market Trend</div>
                        <div className="stat-value" style={{ fontSize: 22 }}>
                            {all.filter(s => s.trend === 'UP').length > all.filter(s => s.trend === 'DOWN').length ?
                                <span className="text-green">BULLISH</span> : <span className="text-red">BEARISH</span>}
                        </div>
                    </div>
                </div>
            )}

            <div className="table-container">
                <div className="table-header">
                    <h3>All Assets</h3>
                    {signals && <span className="text-muted" style={{ fontSize: 12 }}>
                        {new Date(signals.time).toLocaleString()}
                    </span>}
                </div>
                <table>
                    <thead>
                        <tr>
                            <th>Asset</th>
                            <th>Price</th>
                            <th>Trend</th>
                            <th>24h</th>
                            <th>Signal</th>
                            <th>Vote</th>
                            <th>Reasons</th>
                            <th>SL</th>
                            <th>TP</th>
                            <th>R:R</th>
                        </tr>
                    </thead>
                    <tbody>
                        {!signals ? (
                            <tr><td colSpan={10} style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)' }}>
                                Click "Scan Now" to fetch live signals
                            </td></tr>
                        ) : all.map(s => (
                            <tr key={s.symbol} style={s.has_signal ? { background: 'rgba(99,102,241,0.04)' } : {}}>
                                <td style={{ fontWeight: 700 }}>{s.symbol}</td>
                                <td style={{ fontFamily: 'monospace' }}>${s.price?.toLocaleString()}</td>
                                <td><span className={`badge badge-${s.trend?.toLowerCase()}`}>{s.trend || '—'}</span></td>
                                <td className={s.ret24h >= 0 ? 'text-green' : 'text-red'}>
                                    {s.ret24h > 0 ? '+' : ''}{s.ret24h?.toFixed(1)}%
                                </td>
                                <td>
                                    {s.has_signal ? (
                                        <span className={`badge badge-${s.direction?.toLowerCase()}`}>{s.direction}</span>
                                    ) : <span className="text-muted">—</span>}
                                </td>
                                <td style={{ fontWeight: 700, color: s.vote > 0 ? 'var(--green)' : s.vote < 0 ? 'var(--red)' : 'var(--text-muted)' }}>
                                    {s.vote > 0 ? '+' : ''}{s.vote}
                                </td>
                                <td style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                                    {s.signals?.join(', ') || '—'}
                                </td>
                                <td className="text-red" style={{ fontFamily: 'monospace', fontSize: 12 }}>
                                    {s.has_signal ? `$${s.sl?.toLocaleString()} (${s.sl_pct}%)` : '—'}
                                </td>
                                <td className="text-green" style={{ fontFamily: 'monospace', fontSize: 12 }}>
                                    {s.has_signal ? `$${s.tp?.toLocaleString()} (${s.tp_pct}%)` : '—'}
                                </td>
                                <td className="text-muted" style={{ fontSize: 12 }}>
                                    {s.has_signal ? '1:1.5' : '—'}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    )
}

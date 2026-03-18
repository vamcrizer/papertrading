import { useState, useEffect } from 'react'

const API = import.meta.env.VITE_API_URL || 'http://localhost:8006'

export default function Models() {
    const [models, setModels] = useState([])
    const [selected, setSelected] = useState(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        fetch(`${API}/api/models`)
            .then(r => r.json())
            .then(d => { setModels(d.models || []); setLoading(false) })
            .catch(() => setLoading(false))
    }, [])

    const statusColors = { active: 'badge-active', research: 'badge-research', deprecated: 'badge-deprecated' }

    return (
        <div>
            <div className="page-header">
                <h2>📈 Models & Strategies</h2>
                <p>Tất cả models đã nghiên cứu, metrics OOS, lịch sử performance</p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(380px,1fr))', gap: 16, marginBottom: 32 }}>
                {loading ? (
                    [1, 2, 3].map(i => <div key={i} className="skeleton" style={{ height: 300, borderRadius: 16 }}></div>)
                ) : models.map(m => (
                    <div key={m.id} className="model-card" onClick={() => setSelected(selected?.id === m.id ? null : m)}
                        style={{ cursor: 'pointer', border: selected?.id === m.id ? '1px solid var(--accent)' : undefined }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <div>
                                <div className="model-title">{m.name}</div>
                                <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                                    <span className={`badge ${statusColors[m.status]}`}>{m.status}</span>
                                    <span className="badge" style={{ background: 'var(--bg-primary)', color: 'var(--text-secondary)' }}>{m.asset_class}</span>
                                    <span className="badge" style={{ background: 'var(--bg-primary)', color: 'var(--text-muted)' }}>{m.timeframe}</span>
                                </div>
                            </div>
                        </div>
                        <div className="model-desc">{m.description}</div>

                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
                            {m.markets?.slice(0, 6).map(mk => (
                                <span key={mk} style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, background: 'var(--bg-primary)', color: 'var(--text-muted)' }}>{mk}</span>
                            ))}
                            {m.markets?.length > 6 && <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>+{m.markets.length - 6}</span>}
                        </div>

                        {m.metrics && (
                            <div className="model-metrics">
                                {m.metrics.avg_sharpe != null && (
                                    <div className="metric">
                                        <div className="metric-value">{m.metrics.avg_sharpe}</div>
                                        <div className="metric-label">Sharpe</div>
                                    </div>
                                )}
                                {m.metrics.sharpe != null && !m.metrics.avg_sharpe && (
                                    <div className="metric">
                                        <div className="metric-value">{m.metrics.sharpe}</div>
                                        <div className="metric-label">Sharpe</div>
                                    </div>
                                )}
                                {m.metrics.avg_wr != null && (
                                    <div className="metric">
                                        <div className="metric-value">{m.metrics.avg_wr}%</div>
                                        <div className="metric-label">Win Rate</div>
                                    </div>
                                )}
                                {m.metrics.total_oos_return != null && (
                                    <div className="metric">
                                        <div className="metric-value" style={{ color: 'var(--green)' }}>+{m.metrics.total_oos_return}%</div>
                                        <div className="metric-label">OOS Return</div>
                                    </div>
                                )}
                                {m.metrics.positive_assets && (
                                    <div className="metric">
                                        <div className="metric-value" style={{ color: 'var(--green)' }}>{m.metrics.positive_assets}</div>
                                        <div className="metric-label">Profitable</div>
                                    </div>
                                )}
                                {m.metrics.years_profitable && (
                                    <div className="metric">
                                        <div className="metric-value" style={{ color: 'var(--green)' }}>{m.metrics.years_profitable}</div>
                                        <div className="metric-label">Years Profitable</div>
                                    </div>
                                )}
                                {m.metrics.annualized_return != null && (
                                    <div className="metric">
                                        <div className="metric-value" style={{ color: 'var(--green)' }}>+{m.metrics.annualized_return}%/yr</div>
                                        <div className="metric-label">Annual</div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                ))}
            </div>

            {/* Expanded detail */}
            {selected && (
                <div className="card" style={{ marginBottom: 24 }}>
                    <h3 style={{ marginBottom: 16 }}>{selected.name} — Detail</h3>

                    {/* Verification */}
                    {selected.verification && (
                        <div style={{ marginBottom: 24 }}>
                            <h4 style={{ fontSize: 14, marginBottom: 12, color: 'var(--text-secondary)' }}>Devil's Advocate Verification</h4>
                            <div className="card-grid">
                                {Object.entries(selected.verification).map(([k, v]) => (
                                    <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                                        <span className="text-muted" style={{ fontSize: 13 }}>{k.replace(/_/g, ' ')}</span>
                                        <span style={{ fontWeight: 600, color: v === true ? 'var(--green)' : typeof v === 'string' ? 'var(--accent)' : 'var(--text-primary)' }}>
                                            {v === true ? '✅ PASS' : v === false ? '❌ FAIL' : String(v)}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Top assets */}
                    {selected.top_assets && (
                        <div style={{ marginBottom: 24 }}>
                            <h4 style={{ fontSize: 14, marginBottom: 12, color: 'var(--text-secondary)' }}>Top Performing Assets (OOS)</h4>
                            <table>
                                <thead>
                                    <tr><th>Asset</th><th>Sharpe</th><th>Win Rate</th><th>Return</th></tr>
                                </thead>
                                <tbody>
                                    {selected.top_assets.map(a => (
                                        <tr key={a.name}>
                                            <td style={{ fontWeight: 700 }}>{a.name}</td>
                                            <td style={{ fontWeight: 700, color: 'var(--accent)' }}>{a.sharpe}</td>
                                            <td>{a.wr}%</td>
                                            <td className="text-green">+{a.ret}%</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {/* Yearly performance */}
                    {selected.yearly && (
                        <div>
                            <h4 style={{ fontSize: 14, marginBottom: 12, color: 'var(--text-secondary)' }}>Year-by-Year Performance</h4>
                            <table>
                                <thead>
                                    <tr><th>Year</th><th>Return</th><th>Win Rate</th><th>Period</th><th>Bar</th></tr>
                                </thead>
                                <tbody>
                                    {selected.yearly.map(y => (
                                        <tr key={y.year}>
                                            <td style={{ fontWeight: 600 }}>{y.year}</td>
                                            <td className={y.ret >= 0 ? 'text-green' : 'text-red'} style={{ fontWeight: 700 }}>
                                                {y.ret > 0 ? '+' : ''}{y.ret}%
                                            </td>
                                            <td>{y.wr != null ? `${y.wr}%` : '—'}</td>
                                            <td><span className={`badge ${y.period === 'OOS' ? 'badge-active' : 'badge-research'}`}>{y.period}</span></td>
                                            <td style={{ width: 200 }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                                    <div className="year-bar" style={{
                                                        width: `${Math.min(Math.abs(y.ret), 100) * 1.5}px`,
                                                        background: y.ret >= 0 ? 'var(--green)' : 'var(--red)',
                                                        opacity: y.period === 'OOS' ? 1 : 0.5,
                                                    }}></div>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {/* Metrics detail */}
                    {selected.metrics && (
                        <div style={{ marginTop: 24 }}>
                            <h4 style={{ fontSize: 14, marginBottom: 12, color: 'var(--text-secondary)' }}>All Metrics</h4>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
                                {Object.entries(selected.metrics).map(([k, v]) => (
                                    <div key={k} style={{ padding: 12, background: 'var(--bg-primary)', borderRadius: 8 }}>
                                        <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>{k.replace(/_/g, ' ')}</div>
                                        <div style={{ fontSize: 16, fontWeight: 700 }}>
                                            {v === true ? '✅' : v === false ? '❌' : String(v)}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}

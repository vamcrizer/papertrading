import { useState, useEffect } from 'react'

const API = import.meta.env.VITE_API_URL || 'http://localhost:8006'

export default function VNStocks() {
    const [data, setData] = useState(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        fetch(`${API}/api/vn-stocks`)
            .then(r => r.json())
            .then(d => { setData(d); setLoading(false) })
            .catch(() => setLoading(false))
    }, [])

    const all = data?.stocks || []
    const top5 = data?.top5 || []
    const avoid = data?.avoid || []

    return (
        <div>
            <div className="page-header">
                <h2>🇻🇳 VN Stocks</h2>
                <p>Multi-Factor Ranking — VN30 HOSE</p>
            </div>

            {data?.vn_index && (
                <div className="card-grid" style={{ marginBottom: 24 }}>
                    <div className="stat-card">
                        <div className="stat-label">VN-Index</div>
                        <div className="stat-value">{data.vn_index.price?.toLocaleString()}</div>
                        <div className="stat-change text-muted">{data.vn_index.date}</div>
                    </div>
                    <div className="stat-card">
                        <div className="stat-label">Top Pick</div>
                        <div className="stat-value" style={{ color: 'var(--accent)' }}>{top5[0]?.symbol || '—'}</div>
                        <div className="stat-change text-green">
                            3M: {top5[0]?.ret_3m > 0 ? '+' : ''}{top5[0]?.ret_3m}%
                        </div>
                    </div>
                    <div className="stat-card">
                        <div className="stat-label">Stocks Above SMA200</div>
                        <div className="stat-value text-green">
                            {all.filter(s => s.trend === 'UP').length}/{all.length}
                        </div>
                    </div>
                </div>
            )}

            {/* Top 5 */}
            <div className="table-container" style={{ marginBottom: 24 }}>
                <div className="table-header">
                    <h3>🏆 Top 5 Picks</h3>
                    <span className="badge badge-buy">BUY</span>
                </div>
                <table>
                    <thead>
                        <tr>
                            <th>Rank</th>
                            <th>Stock</th>
                            <th>Price (VND)</th>
                            <th>1M</th>
                            <th>3M</th>
                            <th>6M</th>
                            <th>1Y</th>
                            <th>Vol</th>
                            <th>Trend</th>
                            <th>Golden Cross</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            [1, 2, 3, 4, 5].map(i => <tr key={i}><td colSpan={10}><div className="skeleton skeleton-row"></div></td></tr>)
                        ) : top5.map(s => (
                            <tr key={s.symbol} style={{ background: 'rgba(34,197,94,0.03)' }}>
                                <td style={{ fontWeight: 800, color: 'var(--accent)', fontSize: 16 }}>#{s.rank}</td>
                                <td style={{ fontWeight: 700, fontSize: 15 }}>{s.symbol}</td>
                                <td style={{ fontFamily: 'monospace' }}>{s.price?.toLocaleString()}</td>
                                <td className={s.ret_1m >= 0 ? 'text-green' : 'text-red'}>{s.ret_1m > 0 ? '+' : ''}{s.ret_1m}%</td>
                                <td className={s.ret_3m >= 0 ? 'text-green' : 'text-red'}><strong>{s.ret_3m > 0 ? '+' : ''}{s.ret_3m}%</strong></td>
                                <td className={s.ret_6m >= 0 ? 'text-green' : 'text-red'}>{s.ret_6m > 0 ? '+' : ''}{s.ret_6m}%</td>
                                <td className={s.ret_1y >= 0 ? 'text-green' : 'text-red'}>{s.ret_1y > 0 ? '+' : ''}{s.ret_1y}%</td>
                                <td>{s.volatility}%</td>
                                <td><span className={`badge badge-${s.trend?.toLowerCase()}`}>{s.trend}</span></td>
                                <td>{s.golden_cross ? '✅' : '❌'}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Full Ranking */}
            <div className="table-container" style={{ marginBottom: 24 }}>
                <div className="table-header">
                    <h3>📊 Full VN30 Ranking</h3>
                    <span className="text-muted" style={{ fontSize: 12 }}>{all.length} stocks</span>
                </div>
                <table>
                    <thead>
                        <tr>
                            <th>Rank</th>
                            <th>Stock</th>
                            <th>Price</th>
                            <th>3M</th>
                            <th>6M</th>
                            <th>Trend</th>
                            <th>Signal</th>
                        </tr>
                    </thead>
                    <tbody>
                        {all.map(s => (
                            <tr key={s.symbol}>
                                <td style={{ fontWeight: 600 }}>#{s.rank}</td>
                                <td style={{ fontWeight: 600 }}>{s.symbol}</td>
                                <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{s.price?.toLocaleString()}</td>
                                <td className={s.ret_3m >= 0 ? 'text-green' : 'text-red'}>{s.ret_3m > 0 ? '+' : ''}{s.ret_3m}%</td>
                                <td className={s.ret_6m >= 0 ? 'text-green' : 'text-red'}>{s.ret_6m > 0 ? '+' : ''}{s.ret_6m}%</td>
                                <td><span className={`badge badge-${s.trend?.toLowerCase()}`}>{s.trend}</span></td>
                                <td><span className={`badge badge-${s.recommendation?.toLowerCase()}`}>{s.recommendation}</span></td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Avoid */}
            <div className="table-container">
                <div className="table-header">
                    <h3>⚠️ Avoid</h3>
                    <span className="badge badge-avoid">AVOID</span>
                </div>
                <table>
                    <thead><tr><th>Stock</th><th>Price</th><th>3M</th><th>Trend</th><th>Reason</th></tr></thead>
                    <tbody>
                        {avoid.map(s => (
                            <tr key={s.symbol}>
                                <td style={{ fontWeight: 600 }}>{s.symbol}</td>
                                <td>{s.price?.toLocaleString()}</td>
                                <td className="text-red">{s.ret_3m}%</td>
                                <td><span className="badge badge-down">DOWN</span></td>
                                <td className="text-muted">Below SMA200, weak momentum</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    )
}

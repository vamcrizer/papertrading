import { useState, useEffect } from 'react'

const API = 'http://localhost:8000'

const HORIZON_COLORS = {
    '1m': '#f97316', '3m': '#eab308', '6m': '#22c55e',
    '1y': '#06b6d4', '2y': '#3b82f6', '3y': '#8b5cf6', '5y': '#ec4899',
}

export default function VNFunds() {
    const [data, setData] = useState(null)
    const [loading, setLoading] = useState(true)
    const [selected, setSelected] = useState(null)

    useEffect(() => {
        fetch(`${API}/api/vn-funds`)
            .then(r => r.json())
            .then(d => { setData(d); setLoading(false); if (d.funds?.length) setSelected(d.funds[0].id) })
            .catch(() => setLoading(false))
    }, [])

    if (loading) return <div style={{ padding: 32, color: '#94a3b8' }}>Loading...</div>
    if (!data?.funds) return <div style={{ padding: 32, color: '#f87171' }}>Error</div>

    const fund = data.funds.find(f => f.id === selected)

    return (
        <div style={{ padding: '24px 32px', maxWidth: 1100 }}>
            <h2 style={{ fontSize: 22, fontWeight: 700, color: '#f1f5f9', marginBottom: 4 }}>
                VN Stocks — Quy Khuyen Dau Tu
            </h2>
            <p style={{ color: '#64748b', marginBottom: 20, fontSize: 13 }}>
                Danh muc goi y theo thoi han dau tu. Model: Simple Multi-Factor (Sharpe 0.94, p&lt;5%)
            </p>

            {/* Horizon tabs */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap' }}>
                {data.funds.map(f => (
                    <button key={f.id} onClick={() => setSelected(f.id)} style={{
                        padding: '8px 16px', borderRadius: 8, border: 'none', cursor: 'pointer',
                        fontSize: 13, fontWeight: 600,
                        background: selected === f.id ? (HORIZON_COLORS[f.id] || '#3b82f6') : '#1e293b',
                        color: selected === f.id ? '#fff' : '#94a3b8',
                        transition: 'all 0.2s',
                    }}>
                        {f.name}
                    </button>
                ))}
            </div>

            {fund && (
                <>
                    <div style={{
                        background: '#1e293b', borderRadius: 12, padding: 20,
                        borderLeft: `4px solid ${HORIZON_COLORS[fund.id] || '#3b82f6'}`,
                        marginBottom: 20,
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap' }}>
                            <div>
                                <h3 style={{ fontSize: 18, fontWeight: 700, color: '#f1f5f9', margin: 0 }}>
                                    {fund.name} — {fund.description}
                                </h3>
                                <div style={{ color: '#64748b', fontSize: 13, marginTop: 4 }}>
                                    {fund.stats.num_picks} co phieu | {fund.stats.pct_uptrend}% uptrend | Avg Vol: {fund.stats.avg_volatility}%
                                </div>
                            </div>
                            <div style={{
                                background: fund.stats.avg_momentum_3m > 0 ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
                                padding: '8px 16px', borderRadius: 8, textAlign: 'center',
                            }}>
                                <div style={{ fontSize: 11, color: '#64748b' }}>Avg Momentum 3M</div>
                                <div style={{
                                    fontSize: 20, fontWeight: 700,
                                    color: fund.stats.avg_momentum_3m > 0 ? '#22c55e' : '#ef4444'
                                }}>
                                    {fund.stats.avg_momentum_3m > 0 ? '+' : ''}{fund.stats.avg_momentum_3m}%
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Picks table */}
                    <div style={{ background: '#1e293b', borderRadius: 10, overflow: 'hidden' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ borderBottom: '1px solid #334155' }}>
                                    <th style={th}>#</th>
                                    <th style={th}>Ma</th>
                                    <th style={{ ...th, textAlign: 'right' }}>Gia (VND)</th>
                                    <th style={{ ...th, textAlign: 'right' }}>3M</th>
                                    <th style={{ ...th, textAlign: 'right' }}>1Y</th>
                                    <th style={{ ...th, textAlign: 'right' }}>Vol</th>
                                    <th style={{ ...th, textAlign: 'center' }}>Trend</th>
                                </tr>
                            </thead>
                            <tbody>
                                {fund.picks.map((p, i) => (
                                    <tr key={p.symbol} style={{ borderBottom: '1px solid #1a2332' }}>
                                        <td style={td}>{i + 1}</td>
                                        <td style={{ ...td, fontWeight: 700, color: '#f1f5f9' }}>{p.symbol}</td>
                                        <td style={{ ...td, textAlign: 'right' }}>{p.price.toLocaleString()}</td>
                                        <td style={{ ...td, textAlign: 'right', color: p.r3m > 0 ? '#22c55e' : '#ef4444' }}>
                                            {p.r3m > 0 ? '+' : ''}{p.r3m}%
                                        </td>
                                        <td style={{ ...td, textAlign: 'right', color: p.r1y > 0 ? '#22c55e' : '#ef4444' }}>
                                            {p.r1y > 0 ? '+' : ''}{p.r1y}%
                                        </td>
                                        <td style={{ ...td, textAlign: 'right' }}>{p.vol}%</td>
                                        <td style={{
                                            ...td, textAlign: 'center',
                                            color: p.trend === 'UP' ? '#22c55e' : '#ef4444'
                                        }}>{p.trend}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    <div style={{ color: '#475569', fontSize: 11, marginTop: 12 }}>
                        <div style={{ marginBottom: 6 }}>
                            <span style={{ color: '#f59e0b', fontWeight: 600 }}>
                                {'🔒'} Locked: {fund.locked_date || 'N/A'}
                            </span>
                            <span style={{ marginLeft: 16, color: '#64748b' }}>
                                Next rebalance: {fund.next_rebalance || 'N/A'}
                            </span>
                        </div>
                        Model: Simple Multi-Factor (momentum + vol + SMA trend). Sharpe 0.94, Monte Carlo p=3.5%.
                        Picks co dinh moi thang, khong thay doi giua thang. Khong phai loi khuyen dau tu chinh thuc.
                    </div>
                </>
            )}
        </div>
    )
}

const th = { padding: '10px 14px', textAlign: 'left', fontSize: 12, color: '#64748b', fontWeight: 600 }
const td = { padding: '10px 14px', fontSize: 13, color: '#94a3b8' }

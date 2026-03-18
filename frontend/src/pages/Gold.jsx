import { useState, useEffect } from 'react'

const API = import.meta.env.VITE_API_URL || 'http://localhost:8006'

export default function Gold() {
    const [data, setData] = useState(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        fetch(`${API}/api/gold`)
            .then(r => r.json())
            .then(d => { setData(d); setLoading(false) })
            .catch(() => setLoading(false))
    }, [])

    if (loading) return <div style={{ padding: 32, color: '#94a3b8' }}>Loading metals data...</div>
    if (!data || !data.metals) return <div style={{ padding: 32, color: '#f87171' }}>Error loading data</div>

    return (
        <div style={{ padding: '24px 32px', maxWidth: 1100 }}>
            <h2 style={{ fontSize: 22, fontWeight: 700, color: '#f1f5f9', marginBottom: 4 }}>
                Metals Advisory
            </h2>
            <p style={{ color: '#64748b', marginBottom: 24, fontSize: 14 }}>
                Physical precious metals buying advisor — NOT for trading. B&H beats timing for metals.
            </p>

            {data.metals.map(m => <MetalCard key={m.metal} m={m} />)}
        </div>
    )
}

function MetalCard({ m }) {
    const recColor = m.recommendation === 'BUY' ? '#22c55e' : m.recommendation === 'WAIT' ? '#f59e0b' : '#ef4444'
    const recBg = m.recommendation === 'BUY' ? 'rgba(34,197,94,0.08)' : m.recommendation === 'WAIT' ? 'rgba(245,158,11,0.08)' : 'rgba(239,68,68,0.08)'

    const bt = m.backtest
    return (
        <div style={{ marginBottom: 32 }}>
            {/* Header */}
            <div style={{
                background: recBg, border: `1px solid ${recColor}22`,
                borderRadius: 12, padding: 20, marginBottom: 16,
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
                    <div>
                        <div style={{ fontSize: 13, color: '#64748b' }}>{m.name} ({m.symbol})</div>
                        <div style={{ fontSize: 28, fontWeight: 700, color: '#f1f5f9' }}>
                            ${m.current_price?.toLocaleString()}
                            <span style={{ fontSize: 13, color: '#64748b', marginLeft: 8 }}>{m.unit}</span>
                        </div>
                        {m.vnd_estimate > 0 && (
                            <div style={{ fontSize: 14, color: '#94a3b8' }}>~{m.vnd_estimate} trieu VND/luong</div>
                        )}
                    </div>
                    <div style={{ textAlign: 'center' }}>
                        <div style={{
                            fontSize: 24, fontWeight: 800, color: recColor,
                            padding: '10px 20px', borderRadius: 8,
                            border: `2px solid ${recColor}`,
                        }}>{m.recommendation}</div>
                        <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>Score: {m.score}</div>
                    </div>
                </div>
                <div style={{ marginTop: 12, padding: 10, background: 'rgba(0,0,0,0.2)', borderRadius: 6 }}>
                    <p style={{ color: '#e2e8f0', fontSize: 14, margin: 0 }}>{m.advice}</p>
                </div>
            </div>

            {/* Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 12 }}>
                {/* Reasons */}
                <div style={{ background: '#1e293b', borderRadius: 8, padding: 14 }}>
                    <h3 style={{ fontSize: 12, color: '#22c55e', fontWeight: 600, marginBottom: 10 }}>Reasons</h3>
                    {m.reasons?.map((r, i) => (
                        <div key={i} style={{ color: '#94a3b8', fontSize: 12, padding: '3px 0' }}>+ {r}</div>
                    ))}
                    {!m.reasons?.length && <div style={{ color: '#475569', fontSize: 12 }}>None</div>}
                </div>

                {/* Warnings */}
                <div style={{ background: '#1e293b', borderRadius: 8, padding: 14 }}>
                    <h3 style={{ fontSize: 12, color: '#f59e0b', fontWeight: 600, marginBottom: 10 }}>Warnings</h3>
                    {m.warnings?.map((w, i) => (
                        <div key={i} style={{ color: '#f59e0b', fontSize: 12, padding: '3px 0' }}>! {w}</div>
                    ))}
                    {!m.warnings?.length && <div style={{ color: '#475569', fontSize: 12 }}>None</div>}
                </div>

                {/* Performance */}
                <div style={{ background: '#1e293b', borderRadius: 8, padding: 14 }}>
                    <h3 style={{ fontSize: 12, color: '#64748b', marginBottom: 10 }}>Performance</h3>
                    {m.history?.map((h, i) => (
                        <Row key={i} label={h.period} value={`${h.return > 0 ? '+' : ''}${h.return}%`} color={h.return > 0 ? '#22c55e' : '#ef4444'} />
                    ))}
                </div>

                {/* Model Validation */}
                <div style={{ background: '#1e293b', borderRadius: 8, padding: 14 }}>
                    <h3 style={{ fontSize: 12, color: '#818cf8', marginBottom: 10 }}>Model Validation</h3>
                    {bt ? (
                        <>
                            <Row label="Signals" value={bt.total_signals} color="#94a3b8" />
                            <Row label="BUY count" value={bt.buy_count} color="#22c55e" />
                            {bt.buy_hit_rate_3m != null && <Row label="BUY hit 3M" value={`${bt.buy_hit_rate_3m}%`} color={bt.buy_hit_rate_3m > 55 ? '#22c55e' : '#f59e0b'} />}
                            {bt.buy_avg_3m != null && <Row label="BUY avg 3M" value={`${bt.buy_avg_3m > 0 ? '+' : ''}${bt.buy_avg_3m}%`} color={bt.buy_avg_3m > 0 ? '#22c55e' : '#ef4444'} />}
                            <Row label="B&H total" value={`${bt.bnh_total}%`} color="#94a3b8" />
                            <Row label="Strategy" value={`${bt.strategy_total}%`} color={bt.strategy_total > bt.bnh_total ? '#22c55e' : '#f59e0b'} />
                        </>
                    ) : <div style={{ color: '#475569', fontSize: 12 }}>Insufficient data</div>}
                </div>
            </div>

            <div style={{ color: '#475569', fontSize: 11, marginTop: 8 }}>
                Data: {m.data_points} days | Updated: {m.last_updated}
            </div>
        </div>
    )
}

function Row({ label, value, color }) {
    return (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '2px 0' }}>
            <span style={{ color: '#94a3b8', fontSize: 12 }}>{label}</span>
            <span style={{ color, fontSize: 12, fontWeight: 600 }}>{value}</span>
        </div>
    )
}

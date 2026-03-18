import { useState, useEffect, useRef } from 'react'

const API = import.meta.env.VITE_API_URL || 'http://localhost:8006'

const STRATEGY_COLORS = {
  supertrend_btc: '#f59e0b',   // amber
  supertrend_eth: '#6366f1',   // indigo
}

const STRATEGY_ICONS = {
  supertrend_btc: '₿',
  supertrend_eth: 'Ξ',
}

export default function StrategyTrades() {
  const [strategies, setStrategies] = useState([])
  const [selected, setSelected] = useState(null)
  const [detail, setDetail] = useState(null)
  const [history, setHistory] = useState(null)
  const [signals, setSignals] = useState({})
  const [livePrices, setLivePrices] = useState({})
  const [wsConnected, setWsConnected] = useState(false)
  const [loading, setLoading] = useState(false)
  const [runResult, setRunResult] = useState(null)
  const sseRef = useRef(null)

  // SSE stream for live prices
  useEffect(() => {
    const connect = () => {
      const sse = new EventSource(`${API}/api/prices/stream`)
      sseRef.current = sse
      sse.onmessage = (e) => {
        try {
          const d = JSON.parse(e.data)
          setLivePrices(d.prices || {})
          setWsConnected(true)
        } catch (_) {}
      }
      sse.onerror = () => {
        setWsConnected(false)
        sse.close()
        setTimeout(connect, 3000)
      }
    }
    connect()
    return () => { if (sseRef.current) sseRef.current.close() }
  }, [])

  const fetchStrategies = async () => {
    try {
      const r = await fetch(`${API}/api/strategies`)
      const d = await r.json()
      setStrategies(d.strategies || [])
    } catch (_) {}
  }

  const fetchDetail = async (sid) => {
    try {
      const [r1, r2, r3] = await Promise.all([
        fetch(`${API}/api/strategies/${sid}/trades`),
        fetch(`${API}/api/strategies/${sid}/history`),
        fetch(`${API}/api/strategies/${sid}/signal`),
      ])
      const [d1, d2, d3] = await Promise.all([r1.json(), r2.json(), r3.json()])
      setDetail(d1)
      setHistory(d2)
      setSignals(prev => ({ ...prev, [sid]: d3 }))
    } catch (_) {}
  }

  useEffect(() => {
    fetchStrategies()
    const iv = setInterval(fetchStrategies, 30000)
    return () => clearInterval(iv)
  }, [])

  useEffect(() => {
    if (!selected) return
    fetchDetail(selected)
    const iv = setInterval(() => fetchDetail(selected), 15000)
    return () => clearInterval(iv)
  }, [selected])

  const runCycle = async (sid) => {
    setLoading(true)
    setRunResult(null)
    try {
      const r = await fetch(`${API}/api/strategies/${sid}/run-cycle`, { method: 'POST' })
      const d = await r.json()
      setRunResult(d)
      await fetchDetail(sid)
      await fetchStrategies()
    } catch (e) { setRunResult({ error: String(e) }) }
    setLoading(false)
  }

  const closeTrade = async (sid, tid, price) => {
    await fetch(`${API}/api/strategies/${sid}/trades/${tid}?exit_price=${price}`, { method: 'DELETE' })
    fetchDetail(sid)
    fetchStrategies()
  }

  // Compute live trade PnL from SSE prices
  const enrichActive = (active) => {
    return (active || []).map(t => {
      const live = livePrices[t.symbol] || t.current_price || t.entry_price
      let pnl, pnl_pct
      if (t.direction === 'LONG') {
        pnl     = (live - t.entry_price) * t.qty
        pnl_pct = (live - t.entry_price) / t.entry_price * 100
      } else {
        pnl     = (t.entry_price - live) * t.qty
        pnl_pct = (t.entry_price - live) / t.entry_price * 100
      }
      return { ...t, current_price: live, pnl, pnl_pct }
    })
  }

  const fmt = (n, d = 2) => (n == null ? '—' : Number(n).toFixed(d))
  const fmtUSD = (n) => n == null ? '—' : `$${Number(n).toFixed(2)}`

  const sig = selected ? signals[selected] : null
  const activeTrades = enrichActive(detail?.active || [])
  const closed = history?.closed || []
  const stats = detail?.stats || history?.stats || {}

  return (
    <div>
      <div className="page-header">
        <h2>Strategy Paper Trading</h2>
        <p>
          {wsConnected
            ? <span style={{ color: 'var(--green)' }}>&#9679; Live prices</span>
            : <span style={{ color: 'var(--red)' }}>&#9675; Connecting...</span>
          }
          {' · '}2 strategies, isolated virtual accounts
        </p>
      </div>

      {/* Strategy selector cards */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 24 }}>
        {strategies.map(s => {
          const color = STRATEGY_COLORS[s.id] || 'var(--accent)'
          const icon  = STRATEGY_ICONS[s.id] || '?'
          const isActive = selected === s.id

          return (
            <div
              key={s.id}
              onClick={() => setSelected(s.id)}
              className="card"
              style={{
                flex: 1, cursor: 'pointer', borderColor: isActive ? color : 'var(--border)',
                borderWidth: 2, padding: 20,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontSize: 28, fontWeight: 800, color }}>{icon}</div>
                  <div style={{ fontWeight: 700, fontSize: 15, marginTop: 4 }}>{s.name}</div>
                  <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>{s.symbol} · {s.timeframe || '1h'}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 20, fontWeight: 700,
                    color: s.stats?.total_pnl >= 0 ? 'var(--green)' : 'var(--red)' }}>
                    {fmtUSD(s.stats?.total_pnl || 0)}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Total PnL</div>
                  <div style={{ fontSize: 13, marginTop: 4 }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Equity: </span>
                    <span style={{ fontWeight: 600 }}>{fmtUSD(s.stats?.equity)}</span>
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 16, marginTop: 12, fontSize: 12, color: 'var(--text-muted)' }}>
                <span>{s.stats?.total || 0} trades</span>
                <span>WR {s.stats?.win_rate || 0}%</span>
                <span style={{ color: s.active_count > 0 ? color : 'inherit' }}>
                  {s.active_count} open
                </span>
              </div>
            </div>
          )
        })}
      </div>

      {/* Selected strategy detail */}
      {selected && (
        <div>
          {/* Signal + controls */}
          <div className="card" style={{ marginBottom: 20, padding: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>
                  Current Signal — {strategies.find(s => s.id === selected)?.name}
                </div>
                {sig ? (
                  sig.error
                    ? <span style={{ color: 'var(--red)', fontSize: 12 }}>Error: {sig.error}</span>
                    : sig.has_signal
                      ? (
                        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                          <span style={{
                            background: sig.direction === 'LONG' ? 'var(--green-soft)' : 'var(--red-soft)',
                            color: sig.direction === 'LONG' ? 'var(--green)' : 'var(--red)',
                            fontWeight: 700, padding: '4px 12px', borderRadius: 6, fontSize: 14,
                          }}>{sig.direction} {sig.signal_type}</span>
                          <span style={{ fontSize: 13 }}>Entry: <b>{fmt(sig.price, 2)}</b></span>
                          <span style={{ fontSize: 13, color: 'var(--red)' }}>SL: {fmt(sig.sl, 2)}</span>
                          <span style={{ fontSize: 13, color: 'var(--green)' }}>TP: {fmt(sig.tp, 2)}</span>
                          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>ATR: {fmt(sig.atr, 2)}</span>
                        </div>
                      )
                      : <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>No signal on last closed bar</span>
                ) : (
                  <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>Loading signal...</span>
                )}
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  onClick={() => runCycle(selected)}
                  disabled={loading}
                  style={{
                    background: STRATEGY_COLORS[selected] || 'var(--accent)',
                    color: '#fff', border: 'none', padding: '8px 18px',
                    borderRadius: 8, cursor: loading ? 'not-allowed' : 'pointer',
                    fontWeight: 600, fontSize: 13, opacity: loading ? 0.6 : 1,
                  }}
                >
                  {loading ? 'Running...' : 'Run Cycle'}
                </button>
                <button
                  onClick={() => { fetchDetail(selected); fetchStrategies() }}
                  style={{
                    background: 'transparent', color: 'var(--text-secondary)',
                    border: '1px solid var(--border)', padding: '8px 14px',
                    borderRadius: 8, cursor: 'pointer', fontSize: 13,
                  }}
                >
                  Refresh
                </button>
              </div>
            </div>

            {/* Run cycle result */}
            {runResult && (
              <div style={{
                marginTop: 12, padding: 12, borderRadius: 8,
                background: runResult.error ? 'var(--red-soft)' : 'var(--bg-secondary)',
                fontSize: 12, color: 'var(--text-secondary)',
              }}>
                {runResult.error
                  ? <span style={{ color: 'var(--red)' }}>Error: {runResult.error}</span>
                  : <>
                    {runResult.opened && (
                      <span style={{ color: 'var(--green)', marginRight: 12 }}>
                        Opened {runResult.opened.direction} @ {fmt(runResult.opened.entry_price, 2)}
                      </span>
                    )}
                    {runResult.closed?.length > 0 && (
                      <span style={{ color: 'var(--yellow)', marginRight: 12 }}>
                        Closed {runResult.closed.length} trade(s)
                      </span>
                    )}
                    {runResult.skipped && (
                      <span style={{ color: 'var(--text-muted)' }}>Skipped: {runResult.skipped}</span>
                    )}
                    {!runResult.opened && !runResult.closed?.length && !runResult.skipped && (
                      <span>No action taken</span>
                    )}
                  </>
                }
              </div>
            )}
          </div>

          {/* Stats row */}
          <div className="card-grid" style={{ marginBottom: 20 }}>
            {[
              { label: 'Equity', value: fmtUSD(stats.equity),
                color: stats.return_pct >= 0 ? 'var(--green)' : 'var(--red)' },
              { label: 'Return', value: `${fmt(stats.return_pct, 2)}%`,
                color: stats.return_pct >= 0 ? 'var(--green)' : 'var(--red)' },
              { label: 'Win Rate', value: `${stats.win_rate || 0}%` },
              { label: 'Total Trades', value: stats.total || 0 },
              { label: 'Wins / Losses', value: `${stats.wins || 0} / ${stats.losses || 0}` },
              { label: 'Total PnL', value: fmtUSD(stats.total_pnl),
                color: (stats.total_pnl || 0) >= 0 ? 'var(--green)' : 'var(--red)' },
            ].map(({ label, value, color }) => (
              <div key={label} className="card" style={{ padding: '16px 20px' }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1 }}>
                  {label}
                </div>
                <div style={{ fontSize: 22, fontWeight: 700, marginTop: 6, color: color || 'var(--text-primary)' }}>
                  {value}
                </div>
              </div>
            ))}
          </div>

          {/* Active trades */}
          <div className="card" style={{ marginBottom: 20 }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', fontWeight: 600 }}>
              Active Trades ({activeTrades.length})
            </div>
            {activeTrades.length === 0 ? (
              <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)' }}>
                No open positions
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ color: 'var(--text-muted)', fontSize: 11, textTransform: 'uppercase' }}>
                      {['Symbol', 'Side', 'Type', 'Entry', 'Current', 'SL', 'TP', 'PnL', 'Hold', ''].map(h => (
                        <th key={h} style={{ padding: '10px 16px', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {activeTrades.map(t => {
                      const pnlPos = t.pnl >= 0
                      return (
                        <tr key={t.id} style={{ borderBottom: '1px solid var(--border)' }}>
                          <td style={{ padding: '12px 16px', fontWeight: 600 }}>{t.symbol}</td>
                          <td style={{ padding: '12px 16px' }}>
                            <span style={{
                              color: t.direction === 'LONG' ? 'var(--green)' : 'var(--red)',
                              fontWeight: 700,
                            }}>{t.direction}</span>
                          </td>
                          <td style={{ padding: '12px 16px', color: 'var(--text-muted)' }}>
                            {t.signal_type || 'MANUAL'}
                          </td>
                          <td style={{ padding: '12px 16px' }}>{fmt(t.entry_price, 2)}</td>
                          <td style={{ padding: '12px 16px' }}>{fmt(t.current_price, 2)}</td>
                          <td style={{ padding: '12px 16px', color: 'var(--red)' }}>{fmt(t.sl, 2)}</td>
                          <td style={{ padding: '12px 16px', color: 'var(--green)' }}>{fmt(t.tp, 2)}</td>
                          <td style={{ padding: '12px 16px', fontWeight: 600,
                            color: pnlPos ? 'var(--green)' : 'var(--red)' }}>
                            {pnlPos ? '+' : ''}{fmtUSD(t.pnl)}{' '}
                            <span style={{ fontSize: 11 }}>({pnlPos ? '+' : ''}{fmt(t.pnl_pct, 2)}%)</span>
                          </td>
                          <td style={{ padding: '12px 16px', color: 'var(--text-muted)' }}>
                            {fmt(t.hold_hours, 1)}h
                          </td>
                          <td style={{ padding: '12px 16px' }}>
                            <button
                              onClick={() => closeTrade(selected, t.id, t.current_price)}
                              style={{
                                background: 'var(--red-soft)', color: 'var(--red)',
                                border: 'none', padding: '4px 12px', borderRadius: 6,
                                cursor: 'pointer', fontSize: 12, fontWeight: 600,
                              }}
                            >
                              Close
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Trade history */}
          <div className="card">
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', fontWeight: 600 }}>
              Trade History ({closed.length})
            </div>
            {closed.length === 0 ? (
              <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)' }}>
                No closed trades yet
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ color: 'var(--text-muted)', fontSize: 11, textTransform: 'uppercase' }}>
                      {['Symbol', 'Side', 'Type', 'Entry', 'Exit', 'Reason', 'PnL', 'PnL %', 'Hold', 'Fees'].map(h => (
                        <th key={h} style={{ padding: '10px 16px', textAlign: 'left', borderBottom: '1px solid var(--border)' }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[...closed].reverse().map(t => {
                      const win = (t.pnl || 0) > 0
                      return (
                        <tr key={t.id} style={{ borderBottom: '1px solid var(--border)', opacity: 0.85 }}>
                          <td style={{ padding: '10px 16px', fontWeight: 600 }}>{t.symbol}</td>
                          <td style={{ padding: '10px 16px', color: t.direction === 'LONG' ? 'var(--green)' : 'var(--red)', fontWeight: 600 }}>
                            {t.direction}
                          </td>
                          <td style={{ padding: '10px 16px', color: 'var(--text-muted)' }}>{t.signal_type || '—'}</td>
                          <td style={{ padding: '10px 16px' }}>{fmt(t.entry_price, 2)}</td>
                          <td style={{ padding: '10px 16px' }}>{fmt(t.exit_price, 2)}</td>
                          <td style={{ padding: '10px 16px' }}>
                            <span style={{
                              color: t.status === 'TP' ? 'var(--green)' : t.status === 'SL' ? 'var(--red)' : 'var(--text-muted)',
                              fontWeight: 600,
                            }}>{t.status}</span>
                          </td>
                          <td style={{ padding: '10px 16px', fontWeight: 600, color: win ? 'var(--green)' : 'var(--red)' }}>
                            {win ? '+' : ''}{fmtUSD(t.pnl)}
                          </td>
                          <td style={{ padding: '10px 16px', color: win ? 'var(--green)' : 'var(--red)' }}>
                            {win ? '+' : ''}{fmt(t.pnl_pct, 2)}%
                          </td>
                          <td style={{ padding: '10px 16px', color: 'var(--text-muted)' }}>{fmt(t.hold_hours, 1)}h</td>
                          <td style={{ padding: '10px 16px', color: 'var(--text-muted)' }}>{fmtUSD(t.fees)}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {!selected && strategies.length > 0 && (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
          Select a strategy above to view trades and signals
        </div>
      )}
    </div>
  )
}

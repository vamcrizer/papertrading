import { useState, useEffect, useCallback } from 'react'
import { useLivePrices } from '@/hooks'
import { Button } from '@/components/ui'
import {
  getStrategies, getStrategyTrades, getStrategyHistory,
  getStrategySignal, runStrategyCycle, closeStrategyTrade,
} from '@/api/strategies'
import { formatPnl } from '@/utils'

const STRATEGY_COLORS = {
  supertrend_btc: '#f59e0b',
  supertrend_eth: '#6366f1',
}
const STRATEGY_ICONS = {
  supertrend_btc: 'fab fa-bitcoin',
  supertrend_eth: 'fab fa-ethereum',
}

function enrichActive(active, livePrices) {
  return (active || []).map(t => {
    const live = livePrices[t.symbol] || t.current_price || t.entry_price
    let pnl, pnl_pct
    if (t.direction === 'LONG') {
      pnl = (live - t.entry_price) * t.qty
      pnl_pct = (live - t.entry_price) / t.entry_price * 100
    } else {
      pnl = (t.entry_price - live) * t.qty
      pnl_pct = (t.entry_price - live) / t.entry_price * 100
    }
    return { ...t, current_price: live, pnl, pnl_pct }
  })
}

const fmt = (n, d = 2) => (n == null ? '—' : Number(n).toFixed(d))
const fmtUSD = (n) => n == null ? '—' : `$${Number(n).toFixed(2)}`

export default function StrategyTrades() {
  const [strategies, setStrategies] = useState([])
  const [selected, setSelected] = useState(null)
  const [detail, setDetail] = useState(null)
  const [history, setHistory] = useState(null)
  const [signals, setSignals] = useState({})
  const [loading, setLoading] = useState(false)
  const [runResult, setRunResult] = useState(null)

  const { prices: livePrices, connected: wsConnected } = useLivePrices()

  const fetchStrategies = useCallback(async () => {
    try {
      const d = await getStrategies()
      setStrategies(d.strategies || [])
    } catch (_) {}
  }, [])

  const fetchDetail = useCallback(async (sid) => {
    try {
      const [d1, d2, d3] = await Promise.all([
        getStrategyTrades(sid),
        getStrategyHistory(sid),
        getStrategySignal(sid),
      ])
      setDetail(d1)
      setHistory(d2)
      setSignals(prev => ({ ...prev, [sid]: d3 }))
    } catch (_) {}
  }, [])

  useEffect(() => {
    fetchStrategies()
    const iv = setInterval(fetchStrategies, 30000)
    return () => clearInterval(iv)
  }, [fetchStrategies])

  useEffect(() => {
    if (!selected) return
    fetchDetail(selected)
    const iv = setInterval(() => fetchDetail(selected), 15000)
    return () => clearInterval(iv)
  }, [selected, fetchDetail])

  const handleRunCycle = async (sid) => {
    setLoading(true)
    setRunResult(null)
    try {
      const d = await runStrategyCycle(sid)
      setRunResult(d)
      await Promise.all([fetchDetail(sid), fetchStrategies()])
    } catch (e) { setRunResult({ error: String(e) }) }
    setLoading(false)
  }

  const handleClose = async (sid, tid, price) => {
    await closeStrategyTrade(sid, tid, price)
    fetchDetail(sid)
    fetchStrategies()
  }

  const sig = selected ? signals[selected] : null
  const activeTrades = enrichActive(detail?.active || [], livePrices)
  const closed = history?.closed || []
  const stats = detail?.stats || history?.stats || {}

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1">
        <h2 className="text-2xl font-bold text-white tracking-tight">Strategy Paper Trading</h2>
        <div className="flex items-center gap-3 text-sm font-medium text-text-secondary">
          {wsConnected
            ? <span className="text-emerald-500 flex items-center gap-1.5"><i className="fas fa-circle text-[8px] animate-pulse"></i>Live prices</span>
            : <span className="text-red-500 flex items-center gap-1.5"><i className="fas fa-circle text-[8px]"></i>Connecting...</span>
          }
          <span>·</span>
          <span>2 strategies, isolated virtual accounts</span>
        </div>
      </div>

      {/* Strategy selector cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {strategies.map(s => {
          const color = STRATEGY_COLORS[s.id] || '#422afb'
          const icon = STRATEGY_ICONS[s.id] || 'fas fa-chart-line'
          const isActive = selected === s.id
          return (
            <div
              key={s.id}
              onClick={() => setSelected(s.id)}
              className={`relative overflow-hidden rounded-[20px] bg-card p-5 shadow-xl border cursor-pointer transition-all duration-200 hover:shadow-brand/5 ${
                isActive ? 'border-brand ring-1 ring-brand' : 'border-white/5 hover:border-white/10'
              }`}
            >
              <div className="flex justify-between items-start">
                <div className="flex gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/5 text-2xl font-bold" style={{ color }}>
                    <i className={icon}></i>
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white">{s.name}</h3>
                    <div className="text-xs font-medium text-text-secondary mt-1">{s.symbol} · {s.timeframe || '1h'}</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className={`text-xl font-bold ${s.stats?.total_pnl >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                    {fmtUSD(s.stats?.total_pnl || 0)}
                  </div>
                  <div className="text-xs font-medium text-text-secondary mt-0.5">Total PnL</div>
                </div>
              </div>
              
              <div className="mt-6 flex items-center justify-between text-xs font-medium text-text-secondary border-t border-white/5 pt-4">
                <div className="flex gap-4">
                  <span>Equity: <span className="text-white ml-1">{fmtUSD(s.stats?.equity)}</span></span>
                  <span>Trades: <span className="text-white ml-1">{s.stats?.total || 0}</span></span>
                </div>
                <div className={`px-2 py-0.5 rounded-full ${s.active_count > 0 ? 'bg-brand/10 text-brand' : 'bg-white/5 text-text-secondary'}`}>
                  {s.active_count} active
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {selected && (
        <div className="space-y-6">
          {/* Signal + controls */}
          <div className="rounded-[20px] bg-card p-5 border border-white/5 shadow-xl">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4">
              <div>
                <div className="text-sm font-bold text-text-secondary uppercase tracking-wider mb-2">
                  Current Signal
                </div>
                {sig ? (
                  sig.error
                    ? <span className="text-red-500 text-sm font-medium">Error: {sig.error}</span>
                    : sig.has_signal ? (
                      <div className="flex flex-wrap items-center gap-3">
                        <span className={`px-3 py-1 rounded-lg text-sm font-bold ${
                          sig.direction === 'LONG' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-500'
                        }`}>
                          {sig.direction === 'LONG' ? <i className="fas fa-arrow-up mr-1"></i> : <i className="fas fa-arrow-down mr-1"></i>}
                          {sig.direction} {sig.signal_type}
                        </span>
                        <div className="flex items-center gap-3 text-sm font-mono bg-white/5 px-3 py-1 rounded-lg">
                          <span className="text-white font-bold">@ {fmt(sig.price)}</span>
                          <span className="text-text-secondary">|</span>
                          <span className="text-red-500">SL: {fmt(sig.sl)}</span>
                          <span className="text-emerald-500">TP: {fmt(sig.tp)}</span>
                        </div>
                        <span className="text-xs text-text-secondary">ATR: {fmt(sig.atr)}</span>
                      </div>
                    ) : <span className="text-text-secondary text-sm">No signal on last closed bar</span>
                ) : (
                  <span className="text-text-secondary text-sm animate-pulse">Loading signal...</span>
                )}
              </div>
              
              <div className="flex gap-3">
                <Button 
                  onClick={() => handleRunCycle(selected)}
                  isLoading={loading}
                  variant="primary"
                  className="!py-2"
                >
                  <i className="fas fa-play mr-2"></i>Run Cycle
                </Button>
                <Button 
                  variant="secondary" 
                  onClick={() => { fetchDetail(selected); fetchStrategies() }}
                  className="!py-2"
                >
                  <i className="fas fa-sync-alt mr-2"></i>Refresh
                </Button>
              </div>
            </div>

            {runResult && (
              <div className={`mt-4 p-3 rounded-xl text-sm font-medium ${
                runResult.error ? 'bg-red-500/10 text-red-500' : 'bg-brand/5 text-brand'
              }`}>
                {runResult.error
                  ? <span>Error: {runResult.error}</span>
                  : <div className="flex gap-4">
                    {runResult.opened && (
                      <span className="text-emerald-500">
                        <i className="fas fa-plus-circle mr-1"></i>Opened {runResult.opened.direction} @ {fmt(runResult.opened.entry_price)}
                      </span>
                    )}
                    {runResult.closed?.length > 0 && (
                      <span className="text-yellow-500">
                        <i className="fas fa-minus-circle mr-1"></i>Closed {runResult.closed.length} trade(s)
                      </span>
                    )}
                    {runResult.skipped && (
                      <span className="text-text-secondary">Skipped: {runResult.skipped}</span>
                    )}
                    {!runResult.opened && !runResult.closed?.length && !runResult.skipped && (
                      <span className="text-text-secondary">No action taken</span>
                    )}
                  </div>
                }
              </div>
            )}
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {[
              { label: 'Equity', value: fmtUSD(stats.equity), color: stats.return_pct >= 0 ? 'text-emerald-500' : 'text-red-500' },
              { label: 'Return', value: `${fmt(stats.return_pct)}%`, color: stats.return_pct >= 0 ? 'text-emerald-500' : 'text-red-500' },
              { label: 'Win Rate', value: `${stats.win_rate || 0}%` },
              { label: 'Total Trades', value: stats.total || 0 },
              { label: 'Wins / Losses', value: `${stats.wins || 0} / ${stats.losses || 0}` },
              { label: 'Total PnL', value: fmtUSD(stats.total_pnl), color: (stats.total_pnl || 0) >= 0 ? 'text-emerald-500' : 'text-red-500' },
            ].map(({ label, value, color }) => (
              <div key={label} className="rounded-2xl bg-card p-4 border border-white/5 text-center">
                <div className="text-[10px] font-bold text-text-secondary uppercase tracking-widest mb-1">{label}</div>
                <div className={`text-lg font-bold ${color || 'text-white'}`}>{value}</div>
              </div>
            ))}
          </div>

          {/* Active trades */}
          <div className="rounded-[20px] bg-card p-5 border border-white/5 shadow-xl">
            <h3 className="text-lg font-bold text-white mb-4">Active Trades ({activeTrades.length})</h3>
            
            {activeTrades.length === 0 ? (
              <div className="py-12 text-center text-text-secondary border-t border-white/5">No open positions</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-white/10 text-xs text-text-secondary uppercase tracking-wider text-left">
                      <th className="pb-3 pl-2">Symbol</th>
                      <th className="pb-3 text-center">Side</th>
                      <th className="pb-3 text-center">Type</th>
                      <th className="pb-3 text-right">Entry</th>
                      <th className="pb-3 text-right">Current</th>
                      <th className="pb-3 text-right">SL</th>
                      <th className="pb-3 text-right">TP</th>
                      <th className="pb-3 text-right">PnL</th>
                      <th className="pb-3 text-right">Hold</th>
                      <th className="pb-3 text-right pr-2">Action</th>
                    </tr>
                  </thead>
                  <tbody className="text-sm font-medium">
                    {activeTrades.map(t => (
                      <tr key={t.id} className="border-b border-white/5 last:border-0 hover:bg-white/5 transition-colors">
                        <td className="py-4 pl-2 font-bold text-white">{t.symbol}</td>
                        <td className={`py-4 text-center font-bold ${t.direction === 'LONG' ? 'text-emerald-500' : 'text-red-500'}`}>{t.direction}</td>
                        <td className="py-4 text-center text-text-secondary text-xs">{t.signal_type || 'MANUAL'}</td>
                        <td className="py-4 text-right font-mono text-xs">{fmt(t.entry_price)}</td>
                        <td className="py-4 text-right font-mono text-xs font-bold text-white">{fmt(t.current_price)}</td>
                        <td className="py-4 text-right font-mono text-xs text-red-500">{fmt(t.sl)}</td>
                        <td className="py-4 text-right font-mono text-xs text-emerald-500">{fmt(t.tp)}</td>
                        <td className="py-4 text-right font-mono">
                          <span className={`font-bold ${t.pnl >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                            {formatPnl(t.pnl, 2)} <span className="text-[10px] opacity-70">({formatPnl(t.pnl_pct)}%)</span>
                          </span>
                        </td>
                        <td className="py-4 text-right text-xs text-text-secondary">{fmt(t.hold_hours, 1)}h</td>
                        <td className="py-4 text-right pr-2">
                          <button
                            onClick={() => handleClose(selected, t.id, t.current_price)}
                            className="bg-red-500/10 hover:bg-red-500/20 text-red-500 text-xs font-bold px-3 py-1.5 rounded-lg transition-colors"
                          >
                            Close
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Trade history */}
          <div className="rounded-[20px] bg-card p-5 border border-white/5 shadow-xl">
            <h3 className="text-lg font-bold text-white mb-4">Trade History ({closed.length})</h3>
            
            {closed.length === 0 ? (
              <div className="py-12 text-center text-text-secondary border-t border-white/5">No closed trades yet</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-white/10 text-xs text-text-secondary uppercase tracking-wider text-left">
                      <th className="pb-3 pl-2">Symbol</th>
                      <th className="pb-3 text-center">Side</th>
                      <th className="pb-3 text-center">Type</th>
                      <th className="pb-3 text-right">Entry</th>
                      <th className="pb-3 text-right">Exit</th>
                      <th className="pb-3 text-center">Reason</th>
                      <th className="pb-3 text-right">PnL</th>
                      <th className="pb-3 text-right">PnL %</th>
                      <th className="pb-3 text-right">Hold</th>
                      <th className="pb-3 text-right">Fees</th>
                    </tr>
                  </thead>
                  <tbody className="text-sm font-medium">
                    {[...closed].reverse().map(t => (
                      <tr key={t.id} className="border-b border-white/5 last:border-0 hover:bg-white/5 transition-colors opacity-80 hover:opacity-100">
                        <td className="py-3 pl-2 font-bold text-white">{t.symbol}</td>
                        <td className={`py-3 text-center font-bold ${t.direction === 'LONG' ? 'text-emerald-500' : 'text-red-500'}`}>{t.direction}</td>
                        <td className="py-3 text-center text-text-secondary text-xs">{t.signal_type || '—'}</td>
                        <td className="py-3 text-right font-mono text-xs">{fmt(t.entry_price)}</td>
                        <td className="py-3 text-right font-mono text-xs">{fmt(t.exit_price)}</td>
                        <td className="py-3 text-center">
                          <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                            t.status === 'TP' ? 'bg-emerald-500/10 text-emerald-500' : 
                            t.status === 'SL' ? 'bg-red-500/10 text-red-500' : 'bg-white/5 text-text-secondary'
                          }`}>{t.status}</span>
                        </td>
                        <td className={`py-3 text-right font-bold ${t.pnl >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                          {formatPnl(t.pnl, 2)}
                        </td>
                        <td className={`py-3 text-right ${t.pnl >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                          {formatPnl(t.pnl_pct)}%
                        </td>
                        <td className="py-3 text-right text-xs text-text-secondary">{fmt(t.hold_hours, 1)}h</td>
                        <td className="py-3 text-right text-xs text-text-secondary">{fmtUSD(t.fees)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {!selected && strategies.length > 0 && (
        <div className="py-20 text-center">
          <div className="text-4xl mb-4 text-text-secondary"><i className="fas fa-hand-point-up"></i></div>
          <div className="text-text-secondary font-medium">Select a strategy above to view trades and signals</div>
        </div>
      )}
    </div>
  )
}

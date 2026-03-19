import { Badge, Button, StatCard } from '@/components/ui'
import { closeTrade } from '@/api/trades'
import { useTrades, useLivePrices, useAutoTrade } from '@/hooks'
import { formatPnl, formatDate } from '@/utils'

function computeActiveTrades(trades, livePrices) {
  return (trades?.active || []).map(t => {
    const livePrice = livePrices[t.symbol] || t.current_price || t.entry_price
    let pnl, pnl_pct
    if (t.direction === 'LONG') {
      pnl = (livePrice - t.entry_price) * t.qty
      pnl_pct = (livePrice - t.entry_price) / t.entry_price * 100
    } else {
      pnl = (t.entry_price - livePrice) * t.qty
      pnl_pct = (t.entry_price - livePrice) / t.entry_price * 100
    }
    const slDist = t.direction === 'LONG'
      ? (livePrice - t.sl) / (t.entry_price - t.sl) * 100
      : (t.sl - livePrice) / (t.sl - t.entry_price) * 100
    const tpDist = t.direction === 'LONG'
      ? (t.tp - livePrice) / (t.tp - t.entry_price) * 100
      : (livePrice - t.tp) / (t.entry_price - t.tp) * 100

    return { ...t, current_price: livePrice, pnl, pnl_pct, sl_dist: slDist, tp_dist: tpDist }
  })
}

function tradeResultLabel(t) {
  if (t.status === 'TP') return <span className="text-emerald-500 font-bold"><i className="fas fa-check-circle mr-1"></i>TP</span>
  if (t.status === 'SL') return <span className="text-red-500 font-bold"><i className="fas fa-times-circle mr-1"></i>SL</span>
  if (t.status === 'TIMEOUT') return <span className="text-orange-500 font-bold"><i className="fas fa-clock mr-1"></i>TO</span>
  return t.pnl >= 0 ? '✅' : '❌'
}

export default function Trades() {
  const { trades, history, loading, refresh } = useTrades()
  const { prices: livePrices, connected: wsConnected } = useLivePrices()
  const { enabled: autoTradeEnabled, running, toggle: toggleAutoTrade, runNow } = useAutoTrade(refresh)

  const handleClose = async (id, exitPrice) => {
    await closeTrade(id, exitPrice)
    refresh()
  }

  const active = computeActiveTrades(trades, livePrices)
  const totalPnl = active.reduce((s, t) => s + (t.pnl || 0), 0)
  const stats = history?.stats || trades?.stats || {}
  const closed = history?.closed || []

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1">
        <h2 className="text-2xl font-bold text-white tracking-tight">Paper Trading</h2>
        <div className="flex items-center gap-3 text-sm font-medium text-text-secondary">
          {wsConnected
            ? <span className="text-emerald-500 flex items-center gap-1.5"><i className="fas fa-circle text-[8px] animate-pulse"></i>Live prices streaming</span>
            : <span className="text-red-500 flex items-center gap-1.5"><i className="fas fa-circle text-[8px]"></i>Connecting...</span>
          }
          <span>·</span>
          {autoTradeEnabled
            ? <span className="text-emerald-500 font-bold"><i className="fas fa-robot mr-1"></i>Auto trade ON</span>
            : <span className="text-text-secondary"><i className="fas fa-robot mr-1"></i>Auto trade OFF</span>
          }
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        <StatCard
          label="Equity"
          value={`$${((stats.equity || 250) + totalPnl).toFixed(2)}`}
          change={`Capital: $${stats.initial_capital || 250} · ${stats.leverage || 3}x lev`}
        />
        <StatCard
          label="Open PnL"
          value={`${formatPnl(totalPnl)} USD`}
          valueClassName={totalPnl >= 0 ? 'text-emerald-500' : 'text-red-500'}
          change={`${active.length} active trades`}
        />
        <StatCard
          label="Closed Stats"
          value={stats.total || 0}
          change={
            <div className="flex gap-2">
              <span className="text-emerald-500">W: {stats.wins || 0}</span>
              <span className="text-red-500">L: {stats.losses || 0}</span>
              {stats.total > 0 && <span className="text-text-secondary"> · WR: {stats.wr}%</span>}
            </div>
          }
        />
        <StatCard
          label="Closed PnL"
          value={formatPnl(stats.total_pnl || 0)}
          valueClassName={(stats.total_pnl || 0) >= 0 ? 'text-emerald-500' : 'text-red-500'}
          change={`Fees: $${(stats.total_fees || 0).toFixed(2)} · Fund: $${(stats.total_funding || 0).toFixed(2)}`}
        />
      </div>

      <div className="flex flex-wrap gap-3 items-center bg-card p-4 rounded-xl border border-white/5">
        <Button onClick={refresh} isLoading={loading} variant="secondary"><i className="fas fa-sync-alt mr-2"></i>Refresh</Button>
        <Button
          variant={autoTradeEnabled ? 'success' : 'secondary'}
          onClick={toggleAutoTrade}
        >
          <i className="fas fa-robot mr-2"></i>{autoTradeEnabled ? 'Auto: ON' : 'Auto: OFF'}
        </Button>
        <Button variant="primary" onClick={runNow} isLoading={running}><i className="fas fa-bolt mr-2"></i>Run Cycle Now</Button>
      </div>

      {/* Active Trades */}
      <div className="rounded-[20px] bg-card p-5 border border-white/5 shadow-xl">
        <div className="flex items-center justify-between mb-6 px-2">
          <h3 className="text-lg font-bold text-white flex items-center gap-2"><i className="fas fa-fire text-orange-500"></i>Active Trades</h3>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/10 text-xs text-text-secondary uppercase tracking-wider text-left">
                <th className="pb-3 pl-2">Asset</th>
                <th className="pb-3 text-center">Dir</th>
                <th className="pb-3 text-right">Entry</th>
                <th className="pb-3 text-right">Price</th>
                <th className="pb-3 text-right">SL</th>
                <th className="pb-3 text-right">TP</th>
                <th className="pb-3 text-right">Size</th>
                <th className="pb-3 text-right">PnL ($)</th>
                <th className="pb-3 text-right">PnL (%)</th>
                <th className="pb-3 w-24 text-center">Progress</th>
                <th className="pb-3 text-right">Hold</th>
                <th className="pb-3 text-right pr-2">Action</th>
              </tr>
            </thead>
            <tbody className="text-sm font-medium">
              {active.length === 0 ? (
                <tr>
                  <td colSpan={12} className="py-20 text-center text-text-secondary">
                    No active trades — turn on Auto Trade or wait for signals
                  </td>
                </tr>
              ) : active.map(t => {
                const nearSL = (t.sl_dist || 100) < 20
                const nearTP = (t.tp_dist || 100) < 20
                return (
                  <tr key={t.id} className={`border-b border-white/5 last:border-0 hover:bg-white/5 transition-colors ${
                    nearSL ? 'bg-red-500/5' : nearTP ? 'bg-emerald-500/5' : ''
                  }`}>
                    <td className="py-4 pl-2 font-bold text-white">
                      {t.symbol}
                      {t.auto && <span className="ml-1 text-[10px] text-brand align-top"><i className="fas fa-robot"></i></span>}
                    </td>
                    <td className="py-4 text-center"><Badge variant={t.direction}>{t.direction}</Badge></td>
                    <td className="py-4 text-right font-mono text-xs">${t.entry_price?.toLocaleString()}</td>
                    <td className={`py-4 text-right font-mono text-xs font-bold ${t.pnl >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                      ${t.current_price?.toLocaleString()}
                    </td>
                    <td className="py-4 text-right font-mono text-xs text-red-500">${t.sl?.toLocaleString()}</td>
                    <td className="py-4 text-right font-mono text-xs text-emerald-500">${t.tp?.toLocaleString()}</td>
                    <td className="py-4 text-right font-mono text-xs">${t.size_usd}</td>
                    <td className={`py-4 text-right font-mono font-bold ${t.pnl >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                      {formatPnl(t.pnl)}
                    </td>
                    <td className={`py-4 text-right font-mono font-bold ${t.pnl_pct >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                      {formatPnl(t.pnl_pct)}%
                    </td>
                    <td className="py-4 px-2">
                      <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
                        <div 
                          className={`h-full rounded-full transition-all duration-300 ${t.pnl >= 0 ? 'bg-emerald-500' : 'bg-red-500'}`} 
                          style={{ width: `${Math.max(0, Math.min(100, 50 + t.pnl_pct * 5))}%` }} 
                        />
                      </div>
                    </td>
                    <td className="py-4 text-right text-xs text-text-secondary">
                      {t.hold_hours ? `${t.hold_hours.toFixed(1)}h` : '—'}
                    </td>
                    <td className="py-4 text-right pr-2">
                      <Button variant="danger" className="!py-1 !px-2 !text-[10px]"
                        onClick={() => handleClose(t.id, t.current_price)}>
                        Close
                      </Button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Closed Trades History */}
      {closed.length > 0 && (
        <div className="rounded-[20px] bg-card p-5 border border-white/5 shadow-xl">
          <div className="flex items-center justify-between mb-6 px-2">
            <h3 className="text-lg font-bold text-white"><i className="fas fa-history mr-2 text-text-secondary"></i>Trade History</h3>
            <span className="text-xs font-medium text-text-secondary bg-white/5 px-2 py-1 rounded-lg">
              {stats.total} trades · WR: {stats.wr}% · PnL: {formatPnl(stats.total_pnl)} USD
            </span>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/10 text-xs text-text-secondary uppercase tracking-wider text-left">
                  <th className="pb-3 pl-2">Asset</th>
                  <th className="pb-3 text-center">Dir</th>
                  <th className="pb-3 text-right">Entry</th>
                  <th className="pb-3 text-right">Exit</th>
                  <th className="pb-3 text-right">PnL</th>
                  <th className="pb-3 text-right">Fees</th>
                  <th className="pb-3 text-right">Hold</th>
                  <th className="pb-3 text-center">Result</th>
                  <th className="pb-3 text-right pr-2">Closed</th>
                </tr>
              </thead>
              <tbody className="text-sm font-medium">
                {[...closed].reverse().map(t => (
                  <tr key={t.id} className="border-b border-white/5 last:border-0 hover:bg-white/5 transition-colors">
                    <td className="py-3 pl-2 font-bold text-white">
                      {t.symbol}
                      {t.auto && <span className="ml-1 text-[10px] text-brand align-top"><i className="fas fa-robot"></i></span>}
                    </td>
                    <td className="py-3 text-center"><Badge variant={t.direction}>{t.direction}</Badge></td>
                    <td className="py-3 text-right font-mono text-xs text-text-secondary">${t.entry_price?.toLocaleString()}</td>
                    <td className="py-3 text-right font-mono text-xs text-white">${t.exit_price?.toLocaleString()}</td>
                    <td className={`py-3 text-right font-bold ${t.pnl >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                      {formatPnl(t.pnl)}
                    </td>
                    <td className="py-3 text-right text-xs text-text-secondary">${(t.fees || 0).toFixed(3)}</td>
                    <td className="py-3 text-right text-xs text-text-secondary">{(t.hold_hours || 0).toFixed(1)}h</td>
                    <td className="py-3 text-center text-xs">{tradeResultLabel(t)}</td>
                    <td className="py-3 text-right pr-2 text-xs text-text-secondary">{formatDate(t.closed_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

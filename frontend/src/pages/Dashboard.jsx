import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { Badge, Button, StatCard } from '@/components/ui'
import { getSignals } from '@/api/signals'
import { getVNStocks, getModels } from '@/api/market'
import { openTrade } from '@/api/trades'

export default function Dashboard() {
  const [signals, setSignals] = useState(null)
  const [vnStocks, setVnStocks] = useState(null)
  const [models, setModels] = useState(null)
  const [loading, setLoading] = useState(true)
  const [placing, setPlacing] = useState(null)

  useEffect(() => {
    Promise.all([getSignals(), getVNStocks(), getModels()])
      .then(([sig, vn, mod]) => {
        setSignals(sig); setVnStocks(vn); setModels(mod); setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  const handleOpenTrade = async (symbol, direction, price, sl, tp) => {
    setPlacing(symbol + direction)
    try {
      await openTrade({ symbol, direction, entry_price: price, sl, tp, size_usd: 150 })
      toast.success(`${direction} ${symbol} @ $${price} — SL: $${sl} / TP: $${tp}`)
    } catch (e) { toast.error('Error: ' + e.message) }
    setPlacing(null)
  }

  const activeSignals = signals?.signals?.filter(s => s.has_signal) || []
  const longCount = activeSignals.filter(s => s.direction === 'LONG').length
  const shortCount = activeSignals.filter(s => s.direction === 'SHORT').length
  const top5 = vnStocks?.top5 || []

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1">
        <h2 className="text-2xl font-bold text-white tracking-tight">Dashboard</h2>
        <p className="text-sm font-medium text-text-secondary">Market Overview & Active Signals</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        <StatCard
          label="Active Crypto Signals"
          value={loading ? '—' : activeSignals.length}
          change={!loading && (
            <div className="flex gap-2 text-xs">
              <span className="text-emerald-500 font-bold"><i className="fas fa-arrow-up mr-1"></i>{longCount} Long</span>
              <span className="text-text-secondary">·</span>
              <span className="text-red-500 font-bold"><i className="fas fa-arrow-down mr-1"></i>{shortCount} Short</span>
            </div>
          )}
        />
        <StatCard
          label="VN-Index"
          value={loading ? '—' : vnStocks?.vn_index?.price?.toLocaleString() || '—'}
          change={vnStocks?.vn_index?.ytd != null && (
            <span className={vnStocks.vn_index.ytd >= 0 ? 'text-emerald-500' : 'text-red-500'}>
              YTD: {vnStocks.vn_index.ytd > 0 ? '+' : ''}{vnStocks.vn_index.ytd}%
            </span>
          )}
        />
        <StatCard
          label="Active Models"
          value={loading ? '—' : models?.models?.filter(m => m.status === 'active').length || 0}
          valueClassName="text-emerald-500"
          change={<span className="text-text-secondary">{models?.models?.length || 0} total strategies</span>}
        />
        <StatCard
          label="Market Status"
          value={
            <div className="flex items-center gap-2">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
              </span>
              <span>Live</span>
            </div>
          }
          change={<span className="text-text-secondary">{new Date().toLocaleString('vi-VN')}</span>}
        />
      </div>

      {/* Active Crypto Signals */}
      <div className="rounded-[20px] bg-card p-5 border border-white/5 shadow-xl">
        <div className="flex items-center justify-between mb-6 px-2">
          <h3 className="text-lg font-bold text-white"><i className="fas fa-bolt text-yellow-400 mr-2"></i>Active Crypto Signals</h3>
          <span className="text-xs font-medium text-text-secondary bg-white/5 px-2 py-1 rounded-lg">
            {signals?.time ? new Date(signals.time).toLocaleTimeString() : ''}
          </span>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/10 text-xs text-text-secondary uppercase tracking-wider text-left">
                <th className="pb-3 pl-2">Asset</th>
                <th className="pb-3">Price</th>
                <th className="pb-3">Signal</th>
                <th className="pb-3">Vote</th>
                <th className="pb-3">Reasons</th>
                <th className="pb-3">SL</th>
                <th className="pb-3">TP</th>
                <th className="pb-3 text-right pr-2">Action</th>
              </tr>
            </thead>
            <tbody className="text-sm font-medium">
              {loading ? (
                [1, 2, 3].map(i => (
                  <tr key={i} className="animate-pulse">
                    <td colSpan={8} className="py-4"><div className="h-8 bg-white/5 rounded-lg w-full"></div></td>
                  </tr>
                ))
              ) : activeSignals.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-text-secondary">
                    No active signals at the moment
                  </td>
                </tr>
              ) : activeSignals.map(s => (
                <tr key={s.symbol} className="group border-b border-white/5 last:border-0 hover:bg-white/5 transition-colors">
                  <td className="py-4 pl-2 font-bold text-white">{s.symbol}</td>
                  <td className="py-4 font-mono text-white font-bold">${s.price?.toLocaleString()}</td>
                  <td className="py-4"><Badge variant={s.direction}>{s.direction}</Badge></td>
                  <td className={`py-4 font-bold ${s.vote > 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                    {s.vote > 0 ? '+' : ''}{s.vote}
                  </td>
                  <td className="py-4 text-xs text-text-secondary max-w-[200px] truncate">{s.signals?.join(', ')}</td>
                  <td className="py-4 font-mono text-red-500 text-xs">${s.sl?.toLocaleString()}</td>
                  <td className="py-4 font-mono text-emerald-500 text-xs">${s.tp?.toLocaleString()}</td>
                  <td className="py-4 text-right pr-2">
                    <Button
                      variant="primary"
                      className="!py-1.5 !px-3 !text-xs"
                      isLoading={placing === s.symbol + s.direction}
                      onClick={() => handleOpenTrade(s.symbol, s.direction, s.price, s.sl, s.tp)}
                    >
                      {s.direction}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* VN Stock Top Picks */}
      <div className="rounded-[20px] bg-card p-5 border border-white/5 shadow-xl">
        <div className="flex items-center justify-between mb-6 px-2">
          <h3 className="text-lg font-bold text-white"><i className="fas fa-flag text-red-500 mr-2"></i>VN Stock Top 5 Picks</h3>
          <span className="text-xs font-medium text-text-secondary">Multi-Factor Ranking</span>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/10 text-xs text-text-secondary uppercase tracking-wider text-left">
                <th className="pb-3 pl-2">#</th>
                <th className="pb-3">Stock</th>
                <th className="pb-3">Price</th>
                <th className="pb-3 text-right">3M</th>
                <th className="pb-3 text-right">6M</th>
                <th className="pb-3 text-right">1Y</th>
                <th className="pb-3 text-center">Trend</th>
                <th className="pb-3 text-right pr-2">Action</th>
              </tr>
            </thead>
            <tbody className="text-sm font-medium">
              {loading ? (
                [1, 2, 3].map(i => <tr key={i} className="animate-pulse"><td colSpan={8} className="py-4"><div className="h-8 bg-white/5 rounded-lg w-full"></div></td></tr>)
              ) : top5.map((s, i) => (
                <tr key={s.symbol} className="border-b border-white/5 last:border-0 hover:bg-white/5 transition-colors">
                  <td className="py-4 pl-2 font-bold text-white">#{i + 1}</td>
                  <td className="py-4 font-bold text-white">{s.symbol}</td>
                  <td className="py-4 font-mono">{s.price?.toLocaleString()} ₫</td>
                  <td className={`py-4 text-right ${s.ret_3m >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>{s.ret_3m > 0 ? '+' : ''}{s.ret_3m}%</td>
                  <td className={`py-4 text-right ${s.ret_6m >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>{s.ret_6m > 0 ? '+' : ''}{s.ret_6m}%</td>
                  <td className={`py-4 text-right ${s.ret_1y >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>{s.ret_1y > 0 ? '+' : ''}{s.ret_1y}%</td>
                  <td className="py-4 text-center"><Badge variant={s.trend}>{s.trend}</Badge></td>
                  <td className="py-4 text-right pr-2"><Badge variant="buy">BUY</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

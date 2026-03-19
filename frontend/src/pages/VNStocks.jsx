import { useState, useEffect } from 'react'
import { Badge, StatCard } from '@/components/ui'
import { getVNStocks } from '@/api/market'

export default function VNStocks() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getVNStocks()
      .then(d => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const all = data?.stocks || []
  const top5 = data?.top5 || []
  const avoid = data?.avoid || []

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1">
        <h2 className="text-2xl font-bold text-white tracking-tight">VN Stocks</h2>
        <p className="text-sm font-medium text-text-secondary">Multi-Factor Ranking — VN30 HOSE</p>
      </div>

      {data?.vn_index && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <StatCard
            label="VN-Index"
            value={data.vn_index.price?.toLocaleString()}
            change={<span className="text-text-secondary">{data.vn_index.date}</span>}
          />
          <StatCard
            label="Top Pick"
            value={top5[0]?.symbol || '—'}
            valueClassName="text-brand"
            change={<span className="text-emerald-500 font-bold">3M: {top5[0]?.ret_3m > 0 ? '+' : ''}{top5[0]?.ret_3m}%</span>}
          />
          <StatCard
            label="Stocks Above SMA200"
            value={
              <div className="flex items-baseline gap-1">
                <span className="text-emerald-500">{all.filter(s => s.trend === 'UP').length}</span>
                <span className="text-text-secondary text-base">/{all.length}</span>
              </div>
            }
          />
        </div>
      )}

      {/* Top 5 */}
      <div className="rounded-[20px] bg-card p-5 border border-white/5 shadow-xl">
        <div className="flex items-center justify-between mb-6 px-2">
          <h3 className="text-lg font-bold text-white flex items-center gap-2"><i className="fas fa-trophy text-yellow-400"></i>Top 5 Picks</h3>
          <Badge variant="buy">BUY</Badge>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/10 text-xs text-text-secondary uppercase tracking-wider text-left">
                <th className="pb-3 pl-2">Rank</th>
                <th className="pb-3">Stock</th>
                <th className="pb-3">Price (VND)</th>
                <th className="pb-3 text-right">1M</th>
                <th className="pb-3 text-right">3M</th>
                <th className="pb-3 text-right">6M</th>
                <th className="pb-3 text-right">1Y</th>
                <th className="pb-3 text-right">Vol</th>
                <th className="pb-3 text-center">Trend</th>
                <th className="pb-3 text-center pr-2">Golden Cross</th>
              </tr>
            </thead>
            <tbody className="text-sm font-medium">
              {loading ? (
                [1, 2, 3, 4, 5].map(i => <tr key={i} className="animate-pulse"><td colSpan={10} className="py-4"><div className="h-8 bg-white/5 rounded-lg w-full"></div></td></tr>)
              ) : top5.map(s => (
                <tr key={s.symbol} className="bg-emerald-500/5 hover:bg-emerald-500/10 transition-colors border-b border-white/5 last:border-0">
                  <td className="py-4 pl-2 font-extrabold text-brand text-lg">#{s.rank}</td>
                  <td className="py-4 font-bold text-white">{s.symbol}</td>
                  <td className="py-4 font-mono">{s.price?.toLocaleString()}</td>
                  <td className={`py-4 text-right ${s.ret_1m >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>{s.ret_1m > 0 ? '+' : ''}{s.ret_1m}%</td>
                  <td className={`py-4 text-right font-bold ${s.ret_3m >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>{s.ret_3m > 0 ? '+' : ''}{s.ret_3m}%</td>
                  <td className={`py-4 text-right ${s.ret_6m >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>{s.ret_6m > 0 ? '+' : ''}{s.ret_6m}%</td>
                  <td className={`py-4 text-right ${s.ret_1y >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>{s.ret_1y > 0 ? '+' : ''}{s.ret_1y}%</td>
                  <td className="py-4 text-right text-text-secondary">{s.volatility}%</td>
                  <td className="py-4 text-center"><Badge variant={s.trend}>{s.trend}</Badge></td>
                  <td className="py-4 text-center pr-2">
                    {s.golden_cross ? <i className="fas fa-check text-emerald-500"></i> : <i className="fas fa-times text-red-500"></i>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Full Ranking */}
      <div className="rounded-[20px] bg-card p-5 border border-white/5 shadow-xl">
        <div className="flex items-center justify-between mb-6 px-2">
          <h3 className="text-lg font-bold text-white"><i className="fas fa-list-ol mr-2 text-text-secondary"></i>Full VN30 Ranking</h3>
          <span className="text-xs font-medium text-text-secondary">{all.length} stocks</span>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/10 text-xs text-text-secondary uppercase tracking-wider text-left">
                <th className="pb-3 pl-2">Rank</th>
                <th className="pb-3">Stock</th>
                <th className="pb-3">Price</th>
                <th className="pb-3 text-right">3M</th>
                <th className="pb-3 text-right">6M</th>
                <th className="pb-3 text-center">Trend</th>
                <th className="pb-3 text-center pr-2">Signal</th>
              </tr>
            </thead>
            <tbody className="text-sm font-medium">
              {all.map(s => (
                <tr key={s.symbol} className="border-b border-white/5 last:border-0 hover:bg-white/5 transition-colors">
                  <td className="py-3 pl-2 font-bold text-text-secondary">#{s.rank}</td>
                  <td className="py-3 font-bold text-white">{s.symbol}</td>
                  <td className="py-3 font-mono text-text-secondary text-xs">{s.price?.toLocaleString()}</td>
                  <td className={`py-3 text-right ${s.ret_3m >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>{s.ret_3m > 0 ? '+' : ''}{s.ret_3m}%</td>
                  <td className={`py-3 text-right ${s.ret_6m >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>{s.ret_6m > 0 ? '+' : ''}{s.ret_6m}%</td>
                  <td className="py-3 text-center"><Badge variant={s.trend}>{s.trend}</Badge></td>
                  <td className="py-3 text-center pr-2"><Badge variant={s.recommendation}>{s.recommendation}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Avoid */}
      <div className="rounded-[20px] bg-card p-5 border border-white/5 shadow-xl">
        <div className="flex items-center justify-between mb-6 px-2">
          <h3 className="text-lg font-bold text-white"><i className="fas fa-exclamation-triangle text-red-500 mr-2"></i>Avoid</h3>
          <Badge variant="avoid">AVOID</Badge>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/10 text-xs text-text-secondary uppercase tracking-wider text-left">
                <th className="pb-3 pl-2">Stock</th>
                <th className="pb-3">Price</th>
                <th className="pb-3 text-right">3M</th>
                <th className="pb-3 text-center">Trend</th>
                <th className="pb-3 pr-2">Reason</th>
              </tr>
            </thead>
            <tbody className="text-sm font-medium">
              {avoid.map(s => (
                <tr key={s.symbol} className="border-b border-white/5 last:border-0 hover:bg-white/5 transition-colors">
                  <td className="py-3 pl-2 font-bold text-white">{s.symbol}</td>
                  <td className="py-3 text-text-secondary">{s.price?.toLocaleString()}</td>
                  <td className="py-3 text-right text-red-500 font-bold">{s.ret_3m}%</td>
                  <td className="py-3 text-center"><Badge variant="down">DOWN</Badge></td>
                  <td className="py-3 text-text-secondary pr-2 text-xs">Below SMA200, weak momentum</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

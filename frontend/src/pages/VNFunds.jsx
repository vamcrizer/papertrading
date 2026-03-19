import { useState, useEffect } from 'react'
import { getVNFunds } from '@/api/market'

const HORIZON_CLASSES = {
  '1m': 'bg-orange-500 text-white shadow-orange-500/20', 
  '3m': 'bg-yellow-500 text-white shadow-yellow-500/20', 
  '6m': 'bg-emerald-500 text-white shadow-emerald-500/20',
  '1y': 'bg-cyan-500 text-white shadow-cyan-500/20', 
  '2y': 'bg-blue-500 text-white shadow-blue-500/20', 
  '3y': 'bg-purple-500 text-white shadow-purple-500/20', 
  '5y': 'bg-pink-500 text-white shadow-pink-500/20',
}

const BORDER_CLASSES = {
  '1m': 'border-l-orange-500', 
  '3m': 'border-l-yellow-500', 
  '6m': 'border-l-emerald-500',
  '1y': 'border-l-cyan-500', 
  '2y': 'border-l-blue-500', 
  '3y': 'border-l-purple-500', 
  '5y': 'border-l-pink-500',
}

export default function VNFunds() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(null)

  useEffect(() => {
    getVNFunds()
      .then(d => {
        setData(d)
        setLoading(false)
        if (d.funds?.length) setSelected(d.funds[0].id)
      })
      .catch(() => setLoading(false))
  }, [])

  if (loading) return <div className="p-8 text-text-secondary">Loading...</div>
  if (!data?.funds) return <div className="p-8 text-red-500">Error</div>

  const fund = data.funds.find(f => f.id === selected)
  const borderClass = BORDER_CLASSES[selected] || 'border-l-brand'

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1">
        <h2 className="text-2xl font-bold text-white tracking-tight">VN Stocks — Quy Khuyen Dau Tu</h2>
        <p className="text-sm font-medium text-text-secondary">
          Danh muc goi y theo thoi han dau tu. Model: Simple Multi-Factor (Sharpe 0.94, p&lt;5%)
        </p>
      </div>

      <div className="flex gap-2 flex-wrap">
        {data.funds.map(f => (
          <button 
            key={f.id} 
            onClick={() => setSelected(f.id)} 
            className={`px-4 py-2 rounded-xl text-sm font-bold transition-all shadow-lg ${
              selected === f.id 
                ? HORIZON_CLASSES[f.id] 
                : 'bg-card text-text-secondary hover:bg-white/5'
            }`}
          >
            {f.name}
          </button>
        ))}
      </div>

      {fund && (
        <>
          <div className={`rounded-[20px] bg-card p-6 border border-white/5 shadow-xl border-l-4 ${borderClass}`}>
            <div className="flex justify-between items-center flex-wrap gap-4">
              <div>
                <h3 className="text-xl font-bold text-white mb-1">
                  {fund.name} — {fund.description}
                </h3>
                <div className="text-sm text-text-secondary">
                  {fund.stats.num_picks} co phieu | {fund.stats.pct_uptrend}% uptrend | Avg Vol: {fund.stats.avg_volatility}%
                </div>
              </div>
              <div className={`px-4 py-2 rounded-xl text-center ${
                fund.stats.avg_momentum_3m > 0 ? 'bg-emerald-500/10' : 'bg-red-500/10'
              }`}>
                <div className="text-xs text-text-secondary uppercase tracking-wider mb-1">Avg Momentum 3M</div>
                <div className={`text-xl font-bold ${
                  fund.stats.avg_momentum_3m > 0 ? 'text-emerald-500' : 'text-red-500'
                }`}>
                  {fund.stats.avg_momentum_3m > 0 ? '+' : ''}{fund.stats.avg_momentum_3m}%
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-[20px] bg-card border border-white/5 shadow-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/10 text-xs text-text-secondary uppercase tracking-wider text-left bg-white/5">
                    <th className="py-3 pl-4">#</th>
                    <th className="py-3">Ma</th>
                    <th className="py-3 text-right">Gia (VND)</th>
                    <th className="py-3 text-right">3M</th>
                    <th className="py-3 text-right">1Y</th>
                    <th className="py-3 text-right">Vol</th>
                    <th className="py-3 text-center pr-4">Trend</th>
                  </tr>
                </thead>
                <tbody className="text-sm font-medium">
                  {fund.picks.map((p, i) => (
                    <tr key={p.symbol} className="border-b border-white/5 last:border-0 hover:bg-white/5 transition-colors">
                      <td className="py-4 pl-4 text-text-secondary">{i + 1}</td>
                      <td className="py-4 font-bold text-white">{p.symbol}</td>
                      <td className="py-4 text-right font-mono text-text-secondary">{p.price.toLocaleString()}</td>
                      <td className={`py-4 text-right font-bold ${p.r3m > 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                        {p.r3m > 0 ? '+' : ''}{p.r3m}%
                      </td>
                      <td className={`py-4 text-right ${p.r1y > 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                        {p.r1y > 0 ? '+' : ''}{p.r1y}%
                      </td>
                      <td className="py-4 text-right text-text-secondary">{p.vol}%</td>
                      <td className={`py-4 text-center pr-4 font-bold ${p.trend === 'UP' ? 'text-emerald-500' : 'text-red-500'}`}>
                        {p.trend}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="text-xs text-text-secondary p-2 bg-white/5 rounded-xl border border-white/5">
            <div className="mb-2 flex gap-4">
              <span className="text-yellow-500 font-bold">
                <i className="fas fa-lock mr-1"></i>Locked: {fund.locked_date || 'N/A'}
              </span>
              <span>
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

import { useState, useEffect } from 'react'
import { Badge } from '@/components/ui'
import { getModels } from '@/api/market'

export default function Models() {
  const [models, setModels] = useState([])
  const [selected, setSelected] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getModels()
      .then(d => { setModels(d.models || []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1">
        <h2 className="text-2xl font-bold text-white tracking-tight">Models & Strategies</h2>
        <p className="text-sm font-medium text-text-secondary">Tất cả models đã nghiên cứu, metrics OOS, lịch sử performance</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {loading ? (
          [1, 2, 3].map(i => <div key={i} className="rounded-[20px] bg-card h-72 animate-pulse border border-white/5"></div>)
        ) : models.map(m => (
          <div 
            key={m.id} 
            onClick={() => setSelected(selected?.id === m.id ? null : m)}
            className={`rounded-[20px] bg-card p-6 border shadow-xl cursor-pointer transition-all duration-300 hover:shadow-brand/5 hover:-translate-y-1 ${
              selected?.id === m.id ? 'border-brand ring-1 ring-brand' : 'border-white/5 hover:border-white/10'
            }`}
          >
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-lg font-bold text-brand mb-2">{m.name}</h3>
                <div className="flex gap-2 flex-wrap">
                  <Badge variant={m.status}>{m.status}</Badge>
                  <span className="bg-white/5 text-text-secondary px-2 py-0.5 rounded text-xs font-medium border border-white/5">{m.asset_class}</span>
                  <span className="bg-white/5 text-text-secondary px-2 py-0.5 rounded text-xs font-medium border border-white/5">{m.timeframe}</span>
                </div>
              </div>
            </div>
            
            <p className="text-sm text-text-secondary mb-4 line-clamp-2">{m.description}</p>

            <div className="flex flex-wrap gap-1.5 mb-6">
              {m.markets?.slice(0, 6).map(mk => (
                <span key={mk} className="text-[10px] bg-white/5 text-text-secondary px-2 py-1 rounded border border-white/5 font-mono">{mk}</span>
              ))}
              {m.markets?.length > 6 && <span className="text-[10px] text-text-secondary px-1 py-1">+{m.markets.length - 6}</span>}
            </div>

            {m.metrics && (
              <div className="grid grid-cols-3 gap-3 pt-4 border-t border-white/5">
                {(m.metrics.avg_sharpe ?? m.metrics.sharpe) != null && (
                  <div className="text-center">
                    <div className="text-lg font-bold text-white">{m.metrics.avg_sharpe ?? m.metrics.sharpe}</div>
                    <div className="text-[10px] text-text-secondary uppercase tracking-wider">Sharpe</div>
                  </div>
                )}
                {m.metrics.avg_wr != null && (
                  <div className="text-center">
                    <div className="text-lg font-bold text-white">{m.metrics.avg_wr}%</div>
                    <div className="text-[10px] text-text-secondary uppercase tracking-wider">Win Rate</div>
                  </div>
                )}
                {m.metrics.total_oos_return != null && (
                  <div className="text-center">
                    <div className="text-lg font-bold text-emerald-500">+{m.metrics.total_oos_return}%</div>
                    <div className="text-[10px] text-text-secondary uppercase tracking-wider">OOS Ret</div>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {selected && (
        <div className="rounded-[20px] bg-card p-6 border border-white/5 shadow-xl animate-in fade-in slide-in-from-bottom-4 duration-300">
          <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-3">
            <span className="w-1 h-6 bg-brand rounded-full"></span>
            {selected.name} — Detail Analysis
          </h3>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {selected.verification && (
              <div>
                <h4 className="text-sm font-bold text-text-secondary uppercase tracking-wider mb-4 border-b border-white/5 pb-2">
                  Devil's Advocate Verification
                </h4>
                <div className="grid grid-cols-1 gap-2">
                  {Object.entries(selected.verification).map(([k, v]) => (
                    <div key={k} className="flex justify-between items-center py-2 px-3 rounded-lg hover:bg-white/5 transition-colors">
                      <span className="text-sm text-text-secondary font-medium capitalize">{k.replace(/_/g, ' ')}</span>
                      <span className={`text-sm font-bold ${
                        v === true ? 'text-emerald-500' : v === false ? 'text-red-500' : 'text-brand'
                      }`}>
                        {v === true ? 'PASS' : v === false ? 'FAIL' : String(v)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {selected.top_assets && (
              <div>
                <h4 className="text-sm font-bold text-text-secondary uppercase tracking-wider mb-4 border-b border-white/5 pb-2">
                  Top Performing Assets (OOS)
                </h4>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="text-xs text-text-secondary uppercase tracking-wider text-left">
                        <th className="pb-2 pl-2">Asset</th>
                        <th className="pb-2 text-right">Sharpe</th>
                        <th className="pb-2 text-right">Win Rate</th>
                        <th className="pb-2 text-right pr-2">Return</th>
                      </tr>
                    </thead>
                    <tbody className="text-sm font-medium">
                      {selected.top_assets.map(a => (
                        <tr key={a.name} className="border-b border-white/5 last:border-0 hover:bg-white/5 transition-colors">
                          <td className="py-3 pl-2 font-bold text-white">{a.name}</td>
                          <td className="py-3 text-right text-brand font-bold">{a.sharpe}</td>
                          <td className="py-3 text-right text-text-secondary">{a.wr}%</td>
                          <td className="py-3 text-right pr-2 text-emerald-500 font-bold">+{a.ret}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          {selected.yearly && (
            <div className="mt-8">
              <h4 className="text-sm font-bold text-text-secondary uppercase tracking-wider mb-4 border-b border-white/5 pb-2">
                Year-by-Year Performance
              </h4>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="text-xs text-text-secondary uppercase tracking-wider text-left">
                      <th className="pb-2 pl-2">Year</th>
                      <th className="pb-2">Return</th>
                      <th className="pb-2">Win Rate</th>
                      <th className="pb-2 text-center">Period</th>
                      <th className="pb-2 w-1/3">Visual</th>
                    </tr>
                  </thead>
                  <tbody className="text-sm font-medium">
                    {selected.yearly.map(y => (
                      <tr key={y.year} className="border-b border-white/5 last:border-0 hover:bg-white/5 transition-colors">
                        <td className="py-3 pl-2 font-bold text-white">{y.year}</td>
                        <td className={`py-3 font-bold ${y.ret >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                          {y.ret > 0 ? '+' : ''}{y.ret}%
                        </td>
                        <td className="py-3 text-text-secondary">{y.wr != null ? `${y.wr}%` : '—'}</td>
                        <td className="py-3 text-center">
                          <Badge variant={y.period === 'OOS' ? 'active' : 'research'}>{y.period}</Badge>
                        </td>
                        <td className="py-3">
                          <div className="h-2 rounded-full overflow-hidden bg-white/5 w-full max-w-[200px] flex items-center">
                            <div 
                              className={`h-full rounded-full transition-all duration-500 ${y.ret >= 0 ? 'bg-emerald-500' : 'bg-red-500'}`}
                              style={{ 
                                width: `${Math.min(Math.abs(y.ret), 100)}%`,
                                opacity: y.period === 'OOS' ? 1 : 0.5 
                              }}
                            ></div>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {selected.metrics && (
            <div className="mt-8">
              <h4 className="text-sm font-bold text-text-secondary uppercase tracking-wider mb-4 border-b border-white/5 pb-2">
                All Detailed Metrics
              </h4>
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                {Object.entries(selected.metrics).map(([k, v]) => (
                  <div key={k} className="bg-white/5 rounded-xl p-3 border border-white/5">
                    <div className="text-[10px] text-text-secondary uppercase mb-1 truncate" title={k.replace(/_/g, ' ')}>
                      {k.replace(/_/g, ' ')}
                    </div>
                    <div className="text-sm font-bold text-white truncate">
                      {v === true ? '✅ PASS' : v === false ? '❌ FAIL' : String(v)}
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

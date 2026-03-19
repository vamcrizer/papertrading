import { useState, useEffect } from 'react'
import { getGold } from '@/api/market'

const REC_CLASSES = {
  BUY: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500',
  WAIT: 'bg-yellow-500/10 border-yellow-500/20 text-yellow-500',
  SELL: 'bg-red-500/10 border-red-500/20 text-red-500',
}

const REC_BORDER_CLASSES = {
  BUY: 'border-emerald-500 text-emerald-500',
  WAIT: 'border-yellow-500 text-yellow-500',
  SELL: 'border-red-500 text-red-500',
}

export default function Gold() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getGold()
      .then(d => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  if (loading) return <div className="p-8 text-text-secondary">Loading metals data...</div>
  if (!data || !data.metals) return <div className="p-8 text-red-500">Error loading data</div>

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1">
        <h2 className="text-2xl font-bold text-white tracking-tight">Metals Advisory</h2>
        <p className="text-sm font-medium text-text-secondary">
          Physical precious metals buying advisor — NOT for trading. B&H beats timing for metals.
        </p>
      </div>
      
      <div className="flex flex-col gap-6">
        {data.metals.map(m => <MetalCard key={m.metal} m={m} />)}
      </div>
    </div>
  )
}

function MetalCard({ m }) {
  const recClass = REC_CLASSES[m.recommendation] || REC_CLASSES.WAIT
  const recBorderClass = REC_BORDER_CLASSES[m.recommendation] || REC_BORDER_CLASSES.WAIT
  const bt = m.backtest

  return (
    <div className="rounded-[20px] bg-card p-6 border border-white/5 shadow-xl">
      <div className={`rounded-xl border p-5 mb-5 ${recClass}`}>
        <div className="flex justify-between items-center flex-wrap gap-4">
          <div>
            <div className="text-xs font-bold uppercase tracking-wider opacity-70 mb-1">{m.name} ({m.symbol})</div>
            <div className="text-3xl font-bold text-white">
              ${m.current_price?.toLocaleString()}
              <span className="text-sm font-medium opacity-60 ml-2">{m.unit}</span>
            </div>
            {m.vnd_estimate > 0 && (
              <div className="text-sm opacity-80 mt-1">~{m.vnd_estimate} trieu VND/luong</div>
            )}
          </div>
          <div className="text-center">
            <div className={`text-2xl font-extrabold px-6 py-2 rounded-lg border-2 ${recBorderClass}`}>
              {m.recommendation}
            </div>
            <div className="text-xs font-medium opacity-70 mt-1">Score: {m.score}</div>
          </div>
        </div>
        <div className="mt-4 p-3 bg-black/20 rounded-lg">
          <p className="text-sm font-medium opacity-90"><i className="fas fa-info-circle mr-2"></i>{m.advice}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white/5 rounded-xl p-4 border border-white/5">
          <h3 className="text-xs font-bold text-emerald-500 uppercase tracking-wider mb-3">Reasons</h3>
          {m.reasons?.map((r, i) => (
            <div key={i} className="text-xs text-text-secondary py-1 flex gap-1">
              <span className="text-emerald-500"><i className="fas fa-plus-circle"></i></span> {r}
            </div>
          ))}
          {!m.reasons?.length && <div className="text-xs text-text-secondary">None</div>}
        </div>
        
        <div className="bg-white/5 rounded-xl p-4 border border-white/5">
          <h3 className="text-xs font-bold text-yellow-500 uppercase tracking-wider mb-3">Warnings</h3>
          {m.warnings?.map((w, i) => (
            <div key={i} className="text-xs text-text-secondary py-1 flex gap-1">
              <span className="text-yellow-500"><i className="fas fa-exclamation-circle"></i></span> {w}
            </div>
          ))}
          {!m.warnings?.length && <div className="text-xs text-text-secondary">None</div>}
        </div>
        
        <div className="bg-white/5 rounded-xl p-4 border border-white/5">
          <h3 className="text-xs font-bold text-text-secondary uppercase tracking-wider mb-3">Performance</h3>
          {m.history?.map((h, i) => (
            <Row 
              key={i} 
              label={h.period} 
              value={`${h.return > 0 ? '+' : ''}${h.return}%`} 
              valueClass={h.return > 0 ? 'text-emerald-500' : 'text-red-500'} 
            />
          ))}
        </div>
        
        <div className="bg-white/5 rounded-xl p-4 border border-white/5">
          <h3 className="text-xs font-bold text-brand uppercase tracking-wider mb-3">Model Validation</h3>
          {bt ? (
            <div className="flex flex-col gap-1">
              <Row label="Signals" value={bt.total_signals} valueClass="text-text-secondary" />
              <Row label="BUY count" value={bt.buy_count} valueClass="text-emerald-500" />
              {bt.buy_hit_rate_3m != null && <Row label="BUY hit 3M" value={`${bt.buy_hit_rate_3m}%`} valueClass={bt.buy_hit_rate_3m > 55 ? 'text-emerald-500' : 'text-yellow-500'} />}
              {bt.buy_avg_3m != null && <Row label="BUY avg 3M" value={`${bt.buy_avg_3m > 0 ? '+' : ''}${bt.buy_avg_3m}%`} valueClass={bt.buy_avg_3m > 0 ? 'text-emerald-500' : 'text-red-500'} />}
              <Row label="B&H total" value={`${bt.bnh_total}%`} valueClass="text-text-secondary" />
              <Row label="Strategy" value={`${bt.strategy_total}%`} valueClass={bt.strategy_total > bt.bnh_total ? 'text-emerald-500' : 'text-yellow-500'} />
            </div>
          ) : <div className="text-xs text-text-secondary">Insufficient data</div>}
        </div>
      </div>
      
      <div className="text-[10px] text-text-secondary mt-2 px-2">
        Data: {m.data_points} days | Updated: {m.last_updated}
      </div>
    </div>
  )
}

function Row({ label, value, valueClass }) {
  return (
    <div className="flex justify-between items-center py-0.5">
      <span className="text-xs text-text-secondary">{label}</span>
      <span className={`text-xs font-bold ${valueClass}`}>{value}</span>
    </div>
  )
}

import { Badge, Button, StatCard } from '@/components/ui'
import { useSignals } from '@/hooks'

export default function Scanner() {
  const { data: signals, loading, lastUpdate, refresh } = useSignals()

  const all = signals?.signals || []
  const active = all.filter(s => s.has_signal)
  const bullish = all.filter(s => s.trend === 'UP').length > all.filter(s => s.trend === 'DOWN').length

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1">
        <h2 className="text-2xl font-bold text-white tracking-tight">Crypto Scanner</h2>
        <p className="text-sm font-medium text-text-secondary">Ensemble V2 signals — 9 crypto perpetuals</p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button isLoading={loading} onClick={refresh} variant="primary">
            <i className="fas fa-search mr-2"></i>Scan Now
          </Button>
          {lastUpdate && (
            <span className="text-xs font-medium text-text-secondary">
              Last: {lastUpdate.toLocaleTimeString()}
            </span>
          )}
        </div>
        {signals && (
          <div className="text-xs font-bold px-3 py-1.5 rounded-lg bg-card border border-white/5 text-text-secondary">
            {active.length} active / {all.length} total
          </div>
        )}
      </div>

      {signals && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <StatCard 
            label="Active Signals" 
            value={active.length} 
            valueClassName="text-brand" 
          />
          <StatCard
            label="Long / Short"
            value={
              <div className="flex gap-2">
                <span className="text-emerald-500"><i className="fas fa-long-arrow-alt-up mr-1"></i>{active.filter(s => s.direction === 'LONG').length}</span>
                <span className="text-text-secondary">/</span>
                <span className="text-red-500"><i className="fas fa-long-arrow-alt-down mr-1"></i>{active.filter(s => s.direction === 'SHORT').length}</span>
              </div>
            }
          />
          <StatCard
            label="Market Trend"
            value={bullish
              ? <span className="text-emerald-500"><i className="fas fa-bull-horn mr-2"></i>BULLISH</span>
              : <span className="text-red-500"><i className="fas fa-paw mr-2"></i>BEARISH</span>
            }
          />
        </div>
      )}

      <div className="rounded-[20px] bg-card p-5 border border-white/5 shadow-xl">
        <div className="flex items-center justify-between mb-6 px-2">
          <h3 className="text-lg font-bold text-white">All Assets</h3>
          {signals && (
            <span className="text-xs font-medium text-text-secondary bg-white/5 px-2 py-1 rounded-lg">
              {new Date(signals.time).toLocaleString()}
            </span>
          )}
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/10 text-xs text-text-secondary uppercase tracking-wider text-left">
                <th className="pb-3 pl-2">Asset</th>
                <th className="pb-3">Price</th>
                <th className="pb-3 text-center">Trend</th>
                <th className="pb-3 text-right">24h</th>
                <th className="pb-3 text-center">Signal</th>
                <th className="pb-3 text-center">Vote</th>
                <th className="pb-3">Reasons</th>
                <th className="pb-3 text-right">SL</th>
                <th className="pb-3 text-right">TP</th>
                <th className="pb-3 text-right pr-2">R:R</th>
              </tr>
            </thead>
            <tbody className="text-sm font-medium">
              {!signals ? (
                <tr>
                  <td colSpan={10} className="py-20 text-center text-text-secondary">
                    <div className="flex flex-col items-center gap-3">
                      <div className="text-4xl opacity-20"><i className="fas fa-satellite-dish"></i></div>
                      <div>Click "Scan Now" to fetch live signals</div>
                    </div>
                  </td>
                </tr>
              ) : all.map(s => (
                <tr 
                  key={s.symbol} 
                  className={`border-b border-white/5 last:border-0 transition-colors ${
                    s.has_signal ? 'bg-brand/5 hover:bg-brand/10' : 'hover:bg-white/5'
                  }`}
                >
                  <td className="py-4 pl-2 font-bold text-white">{s.symbol}</td>
                  <td className="py-4 font-mono text-text-secondary">${s.price?.toLocaleString()}</td>
                  <td className="py-4 text-center"><Badge variant={s.trend}>{s.trend || '—'}</Badge></td>
                  <td className={`py-4 text-right ${s.ret24h >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                    {s.ret24h > 0 ? '+' : ''}{s.ret24h?.toFixed(1)}%
                  </td>
                  <td className="py-4 text-center">
                    {s.has_signal
                      ? <Badge variant={s.direction}>{s.direction}</Badge>
                      : <span className="text-text-secondary opacity-30">—</span>
                    }
                  </td>
                  <td className={`py-4 text-center font-bold ${
                    s.vote > 0 ? 'text-emerald-500' : s.vote < 0 ? 'text-red-500' : 'text-text-secondary'
                  }`}>
                    {s.vote > 0 ? '+' : ''}{s.vote}
                  </td>
                  <td className="py-4 text-xs text-text-secondary max-w-[150px] truncate">
                    {s.signals?.join(', ') || '—'}
                  </td>
                  <td className="py-4 text-right font-mono text-xs text-red-500">
                    {s.has_signal ? `$${s.sl?.toLocaleString()}` : '—'}
                  </td>
                  <td className="py-4 text-right font-mono text-xs text-emerald-500">
                    {s.has_signal ? `$${s.tp?.toLocaleString()}` : '—'}
                  </td>
                  <td className="py-4 text-right pr-2 text-xs text-text-secondary">
                    {s.has_signal ? '1:1.5' : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

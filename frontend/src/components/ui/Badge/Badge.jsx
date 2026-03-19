const VARIANTS = {
  long: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
  short: 'bg-red-500/10 text-red-500 border-red-500/20',
  buy: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
  sell: 'bg-red-500/10 text-red-500 border-red-500/20',
  up: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
  down: 'bg-red-500/10 text-red-500 border-red-500/20',
  hold: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
  wait: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
  active: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
  research: 'bg-purple-500/10 text-purple-500 border-purple-500/20',
  deprecated: 'bg-gray-500/10 text-gray-500 border-gray-500/20',
  avoid: 'bg-orange-500/10 text-orange-500 border-orange-500/20',
}

export default function Badge({ variant = 'active', children, className = '' }) {
  const v = variant?.toLowerCase()
  const style = VARIANTS[v] || VARIANTS.active
  
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-bold uppercase tracking-wide ${style} ${className}`}>
      {children}
    </span>
  )
}
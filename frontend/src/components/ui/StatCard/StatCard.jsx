export default function StatCard({ label, value, change, valueClassName = '' }) {
  return (
    <div className="relative overflow-hidden rounded-[20px] bg-card p-4 shadow-xl border border-white/5 transition-all hover:shadow-brand/5 hover:border-brand/20">
      <div className="flex items-center">
        <div className="flex-1">
          <p className="text-sm font-medium text-text-secondary mb-1">{label}</p>
          <h4 className={`text-2xl font-bold text-brand ${valueClassName}`}>
            {value}
          </h4>
          {change != null && (
            <div className="flex items-center gap-1 mt-1 text-xs font-medium">
              {change}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
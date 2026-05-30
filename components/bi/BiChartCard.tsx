// Shared chart card container for the BI system

interface BiChartCardProps {
  title: string
  sub?: string
  children: React.ReactNode
  action?: React.ReactNode
  className?: string
  padding?: boolean
}

export function BiChartCard({ title, sub, children, action, className = '', padding = true }: BiChartCardProps) {
  return (
    <div className={`bg-white border border-[#E5E7EB] rounded-2xl shadow-sm overflow-hidden ${className}`}>
      <div className="flex items-center justify-between px-5 py-4 border-b border-[#F3F4F6]">
        <div>
          <h3 className="text-[13px] font-semibold text-[#0F172A]">{title}</h3>
          {sub && <p className="text-[11px] text-[#9CA3AF] mt-0.5">{sub}</p>}
        </div>
        {action}
      </div>
      <div className={padding ? 'p-5' : ''}>{children}</div>
    </div>
  )
}

// Section label for grouping KPI rows
export function BiSectionLabel({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 mt-1">
      <div className="h-px flex-1 bg-[#E5E7EB]" />
      <span className="text-[10px] font-bold text-[#9CA3AF] uppercase tracking-widest whitespace-nowrap">{label}</span>
      <div className="h-px flex-1 bg-[#E5E7EB]" />
    </div>
  )
}

// Progress bar with label
export function BiProgressRow({
  label,
  value,
  max,
  color,
  suffix = '',
}: {
  label: string
  value: number
  max: number
  color: string
  suffix?: string
}) {
  const pct = max > 0 ? Math.min(Math.round((value / max) * 100), 100) : 0
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[12px] text-[#6B7280]">{label}</span>
        <span className="text-[12px] font-bold" style={{ color }}>{value.toLocaleString('fr-FR')}{suffix}</span>
      </div>
      <div className="h-1.5 bg-[#F3F4F6] rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  )
}

// Empty state
export function BiEmpty({ message = 'Aucune donnée disponible' }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-[#9CA3AF]">
      <svg width="40" height="40" viewBox="0 0 40 40" fill="none" className="mb-3 opacity-30">
        <rect x="5" y="8" width="30" height="24" rx="3" stroke="currentColor" strokeWidth="2" />
        <path d="M12 20h16M12 25h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
      <p className="text-[12px]">{message}</p>
    </div>
  )
}

// Loading skeleton
export function BiSkeleton({ rows = 4, height = 'h-12' }: { rows?: number; height?: string }) {
  return (
    <div className="space-y-3 p-5">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className={`${height} rounded-lg bg-[#F3F4F6] animate-pulse`} />
      ))}
    </div>
  )
}

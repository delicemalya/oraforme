'use client'

import { useEffect, useRef, useState } from 'react'
import { ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react'

function useCounter(target: number, duration = 900) {
  const [val, setVal] = useState(0)
  const raf = useRef<number>(0)
  useEffect(() => {
    if (target === 0) { setVal(0); return }
    const start = performance.now()
    const tick = (now: number) => {
      const p = Math.min((now - start) / duration, 1)
      const eased = 1 - (1 - p) ** 3
      setVal(Math.round(eased * target))
      if (p < 1) raf.current = requestAnimationFrame(tick)
    }
    raf.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf.current)
  }, [target, duration])
  return val
}

interface BiKpiCardProps {
  label: string
  value: number
  formatted?: string
  sub?: string
  trend?: number           // % vs prior period
  trendUp?: boolean        // true = growing is good; false = growing is bad
  icon: React.ReactNode
  accent?: string
  alert?: boolean
  badge?: string
  loading?: boolean
  formatter?: (n: number) => string
}

export function BiKpiCard({
  label, value, formatted, sub, trend, trendUp = true,
  icon, accent = '#DC2626', alert, badge, loading, formatter,
}: BiKpiCardProps) {
  const count   = useCounter(value)
  const display = formatted ?? (formatter ? formatter(count) : count.toLocaleString('fr-FR'))

  const trendColor = trend === undefined ? '' : (trend > 0) === trendUp ? '#16A34A' : '#DC2626'
  const trendBg    = trend === undefined ? '' : (trend > 0) === trendUp ? '#F0FDF4' : '#FEF2F2'

  return (
    <div
      className="bg-white border border-[#E5E7EB] rounded-2xl p-5 flex flex-col gap-3 shadow-sm hover:shadow-md transition-all duration-200 cursor-default"
      style={{ position: 'relative', overflow: 'hidden' }}
    >
      {alert && (
        <span className="absolute top-3 right-3 w-2 h-2 rounded-full bg-[#DC2626] ring-2 ring-[#DC2626]/30 animate-pulse" />
      )}

      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider leading-tight">{label}</span>
        <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: accent + '18' }}>
          <span style={{ color: accent }}>{icon}</span>
        </div>
      </div>

      {loading ? (
        <div className="h-8 rounded-lg bg-[#F3F4F6] animate-pulse w-3/4" />
      ) : (
        <div className="text-[22px] font-bold text-[#0F172A] leading-tight tracking-tight tabular-nums">
          {display}
        </div>
      )}

      <div className="flex items-center gap-2 flex-wrap min-h-[20px]">
        {trend !== undefined && (
          <span
            className="flex items-center gap-0.5 text-[11px] font-semibold px-1.5 py-0.5 rounded-md"
            style={{ color: trendColor, background: trendBg }}
          >
            {trend > 0
              ? <ArrowUpRight size={11} />
              : trend < 0
              ? <ArrowDownRight size={11} />
              : <Minus size={11} />}
            {trend > 0 ? '+' : ''}{trend}%
          </span>
        )}
        {sub && <span className="text-[11px] text-[#9CA3AF] truncate">{sub}</span>}
        {badge && (
          <span className="ml-auto text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0"
            style={{ background: accent + '18', color: accent }}>
            {badge}
          </span>
        )}
      </div>
    </div>
  )
}

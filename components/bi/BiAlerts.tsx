'use client'

import Link from 'next/link'
import { AlertTriangle, Info, CheckCircle, XCircle } from 'lucide-react'
import type { BiAlert, AlertSeverity } from '@/lib/analytics/types'

const SEVERITY: Record<AlertSeverity, { icon: React.ElementType; bg: string; border: string; text: string; iconColor: string }> = {
  critical: { icon: XCircle,       bg: '#FEF2F2', border: '#FECACA', text: '#991B1B', iconColor: '#DC2626' },
  warning:  { icon: AlertTriangle, bg: '#FFFBEB', border: '#FDE68A', text: '#92400E', iconColor: '#D97706' },
  info:     { icon: Info,          bg: '#EFF6FF', border: '#BFDBFE', text: '#1E40AF', iconColor: '#3B82F6' },
}

export function BiAlertItem({ alert }: { alert: BiAlert }) {
  const s = SEVERITY[alert.severity]
  const Icon = s.icon
  const inner = (
    <div
      className="flex items-start gap-3 px-4 py-3 rounded-xl border transition-all"
      style={{ background: s.bg, borderColor: s.border }}
    >
      <Icon size={15} style={{ color: s.iconColor }} className="shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <p className="text-[12px] font-semibold" style={{ color: s.text }}>{alert.title}</p>
        <p className="text-[11px] mt-0.5" style={{ color: s.text + 'CC' }}>{alert.description}</p>
      </div>
    </div>
  )

  if (alert.link) {
    return <Link href={alert.link} className="block hover:opacity-90 transition-opacity">{inner}</Link>
  }
  return inner
}

interface BiAlertsProps {
  alerts: BiAlert[]
  className?: string
}

export function BiAlerts({ alerts, className = '' }: BiAlertsProps) {
  if (alerts.length === 0) {
    return (
      <div className={`flex items-center gap-2 px-4 py-3 rounded-xl bg-[#F0FDF4] border border-[#BBF7D0] ${className}`}>
        <CheckCircle size={15} className="text-[#16A34A] shrink-0" />
        <p className="text-[12px] font-semibold text-[#166534]">Aucune alerte — Situation saine</p>
      </div>
    )
  }

  const critical = alerts.filter(a => a.severity === 'critical')
  const rest     = alerts.filter(a => a.severity !== 'critical')

  return (
    <div className={`space-y-2 ${className}`}>
      {[...critical, ...rest].map(a => <BiAlertItem key={a.id} alert={a} />)}
    </div>
  )
}

// Compact dot badge for header
export function BiAlertBadge({ count, severity = 'warning' }: { count: number; severity?: AlertSeverity }) {
  if (count === 0) return null
  const color = severity === 'critical' ? '#DC2626' : severity === 'warning' ? '#D97706' : '#3B82F6'
  return (
    <span
      className="inline-flex items-center justify-center w-5 h-5 rounded-full text-white text-[10px] font-bold"
      style={{ background: color }}
    >
      {count}
    </span>
  )
}

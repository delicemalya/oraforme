'use client'

import { CheckCircle, AlertTriangle, XCircle, HelpCircle } from 'lucide-react'

type Niveau = 'conforme' | 'a_verifier' | 'non_conforme' | 'inconnu'

interface ConformityBadgeProps {
  niveau:   Niveau
  label?:   string
  detail?:  string
  compact?: boolean
}

const CONFIG: Record<Niveau, {
  Icon:    typeof CheckCircle
  color:   string
  bg:      string
  border:  string
  label:   string
}> = {
  conforme: {
    Icon: CheckCircle, color: 'text-green-700', bg: 'bg-green-50',
    border: 'border-green-200', label: 'Conforme',
  },
  a_verifier: {
    Icon: AlertTriangle, color: 'text-amber-700', bg: 'bg-amber-50',
    border: 'border-amber-200', label: 'À vérifier',
  },
  non_conforme: {
    Icon: XCircle, color: 'text-red-700', bg: 'bg-red-50',
    border: 'border-red-200', label: 'Non conforme',
  },
  inconnu: {
    Icon: HelpCircle, color: 'text-slate-500', bg: 'bg-slate-50',
    border: 'border-slate-200', label: 'Non vérifié',
  },
}

export function ConformityBadge({ niveau, label, detail, compact }: ConformityBadgeProps) {
  const { Icon, color, bg, border, label: defaultLabel } = CONFIG[niveau]

  if (compact) {
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${bg} ${color} ${border}`}>
        <Icon className="w-3 h-3" />
        {label ?? defaultLabel}
      </span>
    )
  }

  return (
    <div className={`flex items-start gap-3 p-3 rounded-lg border ${bg} ${border}`}>
      <Icon className={`w-5 h-5 mt-0.5 shrink-0 ${color}`} />
      <div>
        <p className={`text-sm font-semibold ${color}`}>{label ?? defaultLabel}</p>
        {detail && <p className="text-xs text-slate-500 mt-0.5">{detail}</p>}
      </div>
    </div>
  )
}

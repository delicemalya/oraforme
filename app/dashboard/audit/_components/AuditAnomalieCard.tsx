'use client'

import { useState } from 'react'
import { AlertTriangle, XCircle, Info, ChevronDown, ChevronUp, MessageCircle, ExternalLink } from 'lucide-react'
import Link from 'next/link'
import type { AuditAnomalie } from '@/lib/audit/engine'

const NIVEAU_STYLES = {
  critical: { bg: '#FEF2F2', border: '#FECACA', icon: XCircle,       color: '#DC2626', label: 'Critique' },
  error:    { bg: '#FFF7ED', border: '#FED7AA', icon: AlertTriangle,  color: '#EA580C', label: 'Erreur'   },
  warning:  { bg: '#FFFBEB', border: '#FDE68A', icon: AlertTriangle,  color: '#F59E0B', label: 'Alerte'   },
  info:     { bg: '#EFF6FF', border: '#BFDBFE', icon: Info,           color: '#2563EB', label: 'Info'     },
}

export default function AuditAnomalieCard({ anomalie }: { anomalie: AuditAnomalie }) {
  const [expanded, setExpanded] = useState(anomalie.niveau === 'critical')
  const s = NIVEAU_STYLES[anomalie.niveau]
  const Icon = s.icon

  const miaaMsg = encodeURIComponent(
    `Explique l'anomalie "${anomalie.titre}" (code ${anomalie.code}) et donne-moi un plan d'action précis pour la corriger.`
  )

  return (
    <div className="rounded-xl border overflow-hidden transition-all" style={{ background: s.bg, borderColor: s.border }}>
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-start gap-3 p-4 text-left"
      >
        <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5" style={{ background: s.color + '18' }}>
          <Icon size={14} style={{ color: s.color }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded text-white" style={{ background: s.color }}>
              {anomalie.code}
            </span>
            <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: s.color }}>
              {s.label}
            </span>
          </div>
          <p className="text-sm font-semibold text-[var(--text)] leading-snug">{anomalie.titre}</p>
          <p className="text-xs text-[var(--text-secondary)] mt-0.5 line-clamp-1">{anomalie.description}</p>
        </div>
        {expanded ? <ChevronUp size={14} style={{ color: s.color }} className="shrink-0 mt-1" />
                  : <ChevronDown size={14} style={{ color: s.color }} className="shrink-0 mt-1" />}
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-3 border-t" style={{ borderColor: s.border }}>
          <div className="pt-3 space-y-2.5">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-secondary)] mb-1">Description</p>
              <p className="text-xs text-[var(--text)]">{anomalie.description}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-secondary)] mb-1">Impact</p>
              <p className="text-xs text-[var(--text)]">{anomalie.impact}</p>
            </div>
            <div className="p-2.5 rounded-lg" style={{ background: '#F0FDF4', border: '1px solid #BBF7D0' }}>
              <p className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: '#14532D' }}>Recommandation</p>
              <p className="text-xs" style={{ color: '#166534' }}>{anomalie.recommandation}</p>
            </div>
            {anomalie.reference && (
              <p className="text-[10px] text-[var(--text-secondary)] italic">📚 Référence : {anomalie.reference}</p>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Link
              href={`/dashboard/miaa?context=audit&q=${miaaMsg}`}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white transition-all"
              style={{ background: '#F59E0B' }}
            >
              <MessageCircle size={11} /> Demander à MIAA+
            </Link>
            <Link
              href="/dashboard/audit/plans-actions"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-[var(--border)] text-[var(--text)] hover:border-[var(--primary)] transition-all"
            >
              <ExternalLink size={11} /> Plan d&apos;action
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}

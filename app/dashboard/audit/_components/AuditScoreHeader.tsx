'use client'

import { RefreshCw, Loader2, MessageCircle } from 'lucide-react'
import Link from 'next/link'
import type { LucideIcon } from 'lucide-react'

function scoreStyle(s: number) {
  if (s >= 80) return { label: 'Conforme',  color: '#16A34A', bg: '#DCFCE7' }
  if (s >= 60) return { label: 'Acceptable',color: '#F59E0B', bg: '#FEF3C7' }
  if (s >= 40) return { label: 'Risqué',    color: '#EA580C', bg: '#FFF7ED' }
  return              { label: 'Critique',  color: '#DC2626', bg: '#FEF2F2' }
}

export default function AuditScoreHeader({
  icon: Icon, iconColor, title, subtitle,
  score, loading, onRefresh, miaaContext,
}: {
  icon: LucideIcon
  iconColor: string
  title: string
  subtitle: string
  score: number | null
  loading: boolean
  onRefresh: () => void
  miaaContext: string
}) {
  const s = score !== null ? scoreStyle(score) : null

  return (
    <div className="rounded-2xl border border-[var(--border)] p-5 bg-[var(--surface)]">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-start gap-4">
          <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: iconColor + '18' }}>
            <Icon size={20} style={{ color: iconColor }} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-[var(--text)]">{title}</h1>
            <p className="text-xs text-[var(--text-secondary)] mt-0.5">{subtitle}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link href={`/dashboard/miaa?context=audit&q=${encodeURIComponent(miaaContext)}`}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[var(--border)] text-xs text-[var(--text)] hover:border-[var(--primary)] transition-colors">
            <MessageCircle size={12} style={{ color: '#F59E0B' }} /> MIAA+
          </Link>
          <button onClick={onRefresh} disabled={loading}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-white text-xs font-medium disabled:opacity-60"
            style={{ background: iconColor }}>
            {loading ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
            Analyser
          </button>
        </div>
      </div>

      {score !== null && s && (
        <div className="mt-4 flex items-center gap-4">
          <div className="flex-1 h-3 rounded-full bg-[var(--border)] overflow-hidden">
            <div className="h-full rounded-full transition-all duration-700"
              style={{ width: `${score}%`, background: s.color }} />
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-2xl font-bold" style={{ color: s.color }}>{score}</span>
            <span className="text-xs font-bold px-2 py-0.5 rounded-full text-white" style={{ background: s.color }}>
              {s.label}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}

'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useTenant } from '@/lib/hooks/useTenant'
import { runAuditGlobal, sauvegarderAudit, type AuditGlobal } from '@/lib/audit/engine'
import {
  Shield, RefreshCw, AlertTriangle, CheckCircle2, TrendingUp,
  BookOpen, DollarSign, FileText, Users, Lock, BarChart2,
  Award, ChevronRight, Loader2, Download, Bot,
} from 'lucide-react'
import Link from 'next/link'

// ── Score Ring ─────────────────────────────────────────────────────────────────

function ScoreRing({ score, size = 80 }: { score: number; size?: number }) {
  const r    = (size - 10) / 2
  const circ = 2 * Math.PI * r
  const dash = (score / 100) * circ
  const color = score >= 80 ? '#16A34A' : score >= 60 ? '#F59E0B' : score >= 40 ? '#EA580C' : '#DC2626'

  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="var(--border)" strokeWidth={8} />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={8}
        strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
        style={{ transition: 'stroke-dasharray 1s ease' }} />
      <text x="50%" y="50%" textAnchor="middle" dominantBaseline="middle"
        style={{ transform: `rotate(90deg) translate(0, -${size/2 - size/2}px)`,
                 transformOrigin: `${size/2}px ${size/2}px`,
                 fontSize: size > 70 ? 18 : 13, fontWeight: 700, fill: color }}>
        {score}
      </text>
    </svg>
  )
}

// ── Couleur score ──────────────────────────────────────────────────────────────

function scoreLabel(s: number) {
  if (s >= 80) return { label: 'Bon', color: '#16A34A', bg: '#DCFCE7' }
  if (s >= 60) return { label: 'Moyen', color: '#F59E0B', bg: '#FEF3C7' }
  if (s >= 40) return { label: 'Faible', color: '#EA580C', bg: '#FFF7ED' }
  return { label: 'Critique', color: '#DC2626', bg: '#FEF2F2' }
}

// ── Sous-modules ───────────────────────────────────────────────────────────────

const MODULES = [
  { id: 'comptable',        label: 'Audit Comptable',    icon: BookOpen,  href: '/dashboard/audit/comptable',       key: 'score_comptable' },
  { id: 'financier',        label: 'Audit Financier',    icon: DollarSign,href: '/dashboard/audit/financier',       key: 'score_financier' },
  { id: 'fiscal',           label: 'Audit Fiscal',       icon: FileText,  href: '/dashboard/audit/fiscal',          key: 'score_fiscal'    },
  { id: 'rh',               label: 'Audit RH & Social',  icon: Users,     href: '/dashboard/audit/rh',              key: 'score_rh'        },
  { id: 'controle-interne', label: 'Contrôle Interne',   icon: Lock,      href: '/dashboard/audit/controle-interne',key: 'score_controle'  },
  { id: 'risques',          label: 'Gestion des Risques',icon: BarChart2, href: '/dashboard/audit/risques',         key: null              },
  { id: 'ohada',            label: 'Conformité OHADA',   icon: Award,     href: '/dashboard/audit/ohada',           key: 'score_ohada'     },
  { id: 'plans-actions',    label: 'Plans d\'Actions',   icon: CheckCircle2,href: '/dashboard/audit/plans-actions', key: null              },
  { id: 'rapports',         label: 'Rapports d\'Audit',  icon: TrendingUp,href: '/dashboard/audit/rapports',       key: null              },
]

// ══════════════════════════════════════════════════════════════════════════════

export default function AuditDashboard() {
  const { tenantId, nomEntreprise } = useTenant()
  const [audit,   setAudit]   = useState<AuditGlobal | null>(null)
  const [loading, setLoading] = useState(false)
  const [lastRun, setLastRun] = useState<string | null>(null)

  const runAudit = useCallback(async () => {
    if (!tenantId) return
    setLoading(true)
    try {
      const result = await runAuditGlobal(supabase as never, tenantId)
      setAudit(result)
      setLastRun(new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }))
      await sauvegarderAudit(supabase as never, tenantId, result)
    } finally {
      setLoading(false)
    }
  }, [tenantId])

  // Charger le dernier audit sauvegardé
  useEffect(() => {
    if (!tenantId) return
    supabase.from('audit_scores').select('*').eq('tenant_id', tenantId).maybeSingle()
      .then(({ data }) => {
        if (data) {
          setAudit({
            score_global:    data.score_global ?? 0,
            score_comptable: data.score_comptable ?? 0,
            score_financier: data.score_financier ?? 0,
            score_fiscal:    data.score_fiscal ?? 0,
            score_rh:        data.score_rh ?? 0,
            score_controle:  data.score_controle ?? 0,
            score_ohada:     data.score_ohada ?? 0,
            nb_anomalies:    data.nb_anomalies ?? 0,
            nb_critiques:    data.nb_critiques ?? 0,
            nb_actions:      data.nb_anomalies ?? 0,
            anomalies:       [],
            computed_at:     data.computed_at ?? '',
          })
          setLastRun(data.computed_at ? new Date(data.computed_at).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' }) : null)
        } else {
          // Pas encore d'audit → lancer automatiquement
          runAudit()
        }
      })
  }, [tenantId, runAudit])

  const sl = audit ? scoreLabel(audit.score_global) : null

  return (
    <div className="space-y-6 w-full">

      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0"
            style={{ background: '#FEF2F2' }}>
            <Shield size={22} style={{ color: '#DC2626' }} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-[var(--text)]">Audit & Conformité</h1>
            <p className="text-sm text-[var(--text-secondary)] mt-0.5">
              {nomEntreprise} · Diagnostic OHADA complet {lastRun && `· Dernière analyse : ${lastRun}`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/dashboard/audit/rapports"
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-[var(--border)] text-sm text-[var(--text)] hover:border-[var(--primary)] transition-colors">
            <Download size={14} /> Rapports
          </Link>
          <button onClick={runAudit} disabled={loading}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-white text-sm font-medium transition-all disabled:opacity-60"
            style={{ background: '#DC2626' }}>
            {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
            {loading ? 'Analyse…' : 'Lancer l\'audit'}
          </button>
        </div>
      </div>

      {/* Score Global */}
      {audit && (
        <div className="rounded-2xl border border-[var(--border)] p-6 bg-[var(--surface)]"
          style={{ background: sl ? `linear-gradient(135deg, ${sl.bg} 0%, var(--surface) 60%)` : undefined }}>
          <div className="flex items-center gap-6 flex-wrap">
            <div className="relative">
              <ScoreRing score={audit.score_global} size={100} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h2 className="text-xl font-bold text-[var(--text)]">Score Global de Conformité</h2>
                <span className="px-2 py-0.5 rounded-full text-xs font-bold text-white"
                  style={{ background: sl?.color }}>
                  {sl?.label}
                </span>
              </div>
              <p className="text-sm text-[var(--text-secondary)] mb-3">
                Basé sur {audit.nb_anomalies} point(s) contrôlé(s) · {audit.nb_critiques} anomalie(s) critique(s)
              </p>
              <div className="flex flex-wrap gap-4">
                {[
                  { label: 'Anomalies',  value: audit.nb_anomalies, color: '#F59E0B' },
                  { label: 'Critiques',  value: audit.nb_critiques, color: '#DC2626' },
                  { label: 'Actions',    value: audit.nb_actions,   color: '#2563EB' },
                ].map(s => (
                  <div key={s.label} className="text-center">
                    <p className="text-2xl font-bold" style={{ color: s.color }}>{s.value}</p>
                    <p className="text-xs text-[var(--text-secondary)]">{s.label}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Scores par domaine */}
      {audit && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {[
            { label: 'Comptable',      score: audit.score_comptable, icon: BookOpen,  href: '/dashboard/audit/comptable'        },
            { label: 'Financier',      score: audit.score_financier, icon: DollarSign,href: '/dashboard/audit/financier'        },
            { label: 'Fiscal',         score: audit.score_fiscal,    icon: FileText,  href: '/dashboard/audit/fiscal'           },
            { label: 'RH & Social',    score: audit.score_rh,        icon: Users,     href: '/dashboard/audit/rh'               },
            { label: 'Contrôle Int.', score: audit.score_controle,   icon: Lock,      href: '/dashboard/audit/controle-interne' },
            { label: 'OHADA',          score: audit.score_ohada,     icon: Award,     href: '/dashboard/audit/ohada'            },
          ].map(({ label, score, icon: Icon, href }) => {
            const s = scoreLabel(score)
            return (
              <Link key={label} href={href}
                className="flex items-center gap-3 p-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] hover:border-[var(--primary)] transition-all group">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: s.bg }}>
                  <Icon size={16} style={{ color: s.color }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-[var(--text)] truncate">{label}</p>
                  <div className="flex items-center gap-1.5 mt-1">
                    <div className="flex-1 h-1.5 rounded-full bg-[var(--border)]">
                      <div className="h-full rounded-full transition-all" style={{ width: `${score}%`, background: s.color }} />
                    </div>
                    <span className="text-xs font-bold shrink-0" style={{ color: s.color }}>{score}</span>
                  </div>
                </div>
                <ChevronRight size={14} className="text-[var(--text-secondary)] group-hover:text-[var(--primary)] transition-colors shrink-0" />
              </Link>
            )
          })}
        </div>
      )}

      {/* Grille modules */}
      <div>
        <h2 className="text-sm font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-3">Modules d&apos;audit</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          {MODULES.map(m => {
            const score = audit && m.key ? (audit as unknown as Record<string, number>)[m.key] ?? null : null
            const Icon = m.icon
            const s    = score !== null ? scoreLabel(score) : null
            return (
              <Link key={m.id} href={m.href}
                className="flex items-center gap-3 p-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] hover:border-[var(--primary)] hover:shadow-sm transition-all group">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                  style={{ background: s ? s.bg : 'var(--surface-alt)' }}>
                  <Icon size={16} style={{ color: s ? s.color : '#64748B' }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-[var(--text)] truncate">{m.label}</p>
                  {s && (
                    <span className="text-[10px] font-medium" style={{ color: s.color }}>{s.label} · {score}/100</span>
                  )}
                  {!s && <p className="text-xs text-[var(--text-secondary)]">Voir le détail</p>}
                </div>
                <ChevronRight size={14} className="text-[var(--text-secondary)] group-hover:text-[var(--primary)] transition-colors shrink-0" />
              </Link>
            )
          })}
        </div>
      </div>

      {/* MIAA+ CTA */}
      <div className="rounded-2xl border border-[var(--border)] p-5 flex items-center gap-4"
        style={{ background: 'linear-gradient(135deg, #FFF7ED 0%, var(--surface) 60%)' }}>
        <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0" style={{ background: '#FEF3C7' }}>
          <Bot size={20} style={{ color: '#F59E0B' }} />
        </div>
        <div className="flex-1">
          <p className="font-bold text-[var(--text)] text-sm">MIAA+ — Auditeur IA</p>
          <p className="text-xs text-[var(--text-secondary)] mt-0.5">
            Posez une question sur vos scores, demandez une explication d&apos;anomalie ou un plan d&apos;action personnalisé.
          </p>
        </div>
        <Link href="/dashboard/miaa?context=audit"
          className="px-4 py-2 rounded-xl text-white text-sm font-medium shrink-0"
          style={{ background: '#F59E0B' }}>
          Interroger MIAA+
        </Link>
      </div>

      {/* État vide */}
      {!audit && !loading && (
        <div className="text-center py-16">
          <Shield size={40} className="mx-auto mb-4 text-[var(--text-secondary)]" />
          <p className="text-lg font-bold text-[var(--text)] mb-2">Aucun audit réalisé</p>
          <p className="text-sm text-[var(--text-secondary)] mb-4">Lancez votre premier audit OHADA pour obtenir votre score de conformité.</p>
          <button onClick={runAudit}
            className="px-6 py-3 rounded-xl text-white font-medium"
            style={{ background: '#DC2626' }}>
            Lancer l&apos;audit maintenant
          </button>
        </div>
      )}

      {loading && (
        <div className="text-center py-12">
          <Loader2 size={36} className="mx-auto mb-3 animate-spin" style={{ color: '#DC2626' }} />
          <p className="text-sm text-[var(--text-secondary)]">Analyse en cours — MIAA+ inspecte vos données…</p>
        </div>
      )}
    </div>
  )
}

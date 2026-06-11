'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useTenant } from '@/lib/hooks/useTenant'
import { runAuditGlobal } from '@/lib/audit/engine'
import type { AuditAnomalie } from '@/lib/audit/engine'
import { CheckCircle2, ChevronLeft, Loader2, Clock, AlertTriangle, User, MessageCircle } from 'lucide-react'
import Link from 'next/link'

interface ActionPlan {
  id:           string
  anomalieCode: string
  anomalieTitre:string
  domaine:      string
  priorite:     'Urgente' | 'Haute' | 'Normale' | 'Faible'
  action:       string
  responsable:  string
  echeance:     string
  done:         boolean
}

function getEcheance(niveau: string): string {
  const d = new Date()
  if (niveau === 'critical') d.setDate(d.getDate() + 7)
  else if (niveau === 'error') d.setDate(d.getDate() + 15)
  else if (niveau === 'warning') d.setMonth(d.getMonth() + 1)
  else d.setMonth(d.getMonth() + 3)
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })
}

function anomalieToAction(a: AuditAnomalie): ActionPlan {
  const prioMap: Record<string, ActionPlan['priorite']> = {
    critical: 'Urgente', error: 'Haute', warning: 'Normale', info: 'Faible',
  }
  const respMap: Record<string, string> = {
    comptable: 'Comptable', financier: 'Directeur Financier', fiscal: 'Responsable Fiscal',
    rh: 'DRH', controle_interne: 'Direction Générale', ohada: 'Directeur Général',
  }
  return {
    id:            a.id,
    anomalieCode:  a.code,
    anomalieTitre: a.titre,
    domaine:       a.domain,
    priorite:      prioMap[a.niveau] ?? 'Normale',
    action:        a.recommandation,
    responsable:   respMap[a.domain] ?? 'Direction',
    echeance:      getEcheance(a.niveau),
    done:          false,
  }
}

const PRIO_STYLES: Record<string, { color: string; bg: string }> = {
  'Urgente': { color: '#DC2626', bg: '#FEF2F2' },
  'Haute':   { color: '#EA580C', bg: '#FFF7ED' },
  'Normale': { color: '#F59E0B', bg: '#FFFBEB' },
  'Faible':  { color: '#2563EB', bg: '#EFF6FF' },
}

export default function PlansActionsPage() {
  const { tenantId } = useTenant()
  const [actions, setActions] = useState<ActionPlan[]>([])
  const [loading, setLoading] = useState(false)
  const [done,    setDone]    = useState<Set<string>>(new Set())

  const run = useCallback(async () => {
    if (!tenantId) return
    setLoading(true)
    try {
      const audit = await runAuditGlobal(supabase as never, tenantId)
      setActions(audit.anomalies.map(anomalieToAction))
    } finally {
      setLoading(false)
    }
  }, [tenantId])

  useEffect(() => { run() }, [run])

  const toggle = (id: string) =>
    setDone(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s })

  const pending   = actions.filter(a => !done.has(a.id))
  const completed = actions.filter(a => done.has(a.id))

  return (
    <div className="space-y-5 w-full">
      <Link href="/dashboard/audit" className="inline-flex items-center gap-1 text-sm text-[var(--text-secondary)] hover:text-[var(--text)] transition-colors">
        <ChevronLeft size={15} /> Audit & Conformité
      </Link>

      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-start gap-4">
          <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0" style={{ background: '#DCFCE7' }}>
            <CheckCircle2 size={20} style={{ color: '#16A34A' }} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-[var(--text)]">Plans d&apos;Actions Correctives</h1>
            <p className="text-xs text-[var(--text-secondary)] mt-0.5">
              {pending.length} action(s) en attente · {completed.length} réalisée(s)
            </p>
          </div>
        </div>
        <button onClick={run} disabled={loading}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-white text-xs font-medium"
          style={{ background: '#16A34A' }}>
          {loading ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} />}
          Actualiser
        </button>
      </div>

      {/* Barre de progression */}
      {actions.length > 0 && (
        <div className="p-4 rounded-xl border border-[var(--border)] bg-[var(--surface)]">
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs font-semibold text-[var(--text)]">Progression des corrections</span>
            <span className="text-xs font-bold" style={{ color: '#16A34A' }}>
              {completed.length}/{actions.length} ({Math.round((completed.length / actions.length) * 100)}%)
            </span>
          </div>
          <div className="h-2.5 rounded-full bg-[var(--border)]">
            <div className="h-full rounded-full transition-all duration-700" style={{
              width: `${(completed.length / actions.length) * 100}%`,
              background: 'linear-gradient(90deg, #16A34A, #22C55E)',
            }} />
          </div>
        </div>
      )}

      {loading && <div className="flex justify-center py-10"><Loader2 size={28} className="animate-spin" style={{ color: '#16A34A' }} /></div>}

      {/* Actions en attente */}
      {!loading && pending.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider">
            {pending.length} action(s) en attente
          </p>
          {pending.map(a => {
            const s = PRIO_STYLES[a.priorite]
            return (
              <div key={a.id} className="rounded-xl border p-4 transition-all" style={{ background: s.bg, borderColor: '#E2E8F0' }}>
                <div className="flex items-start gap-3">
                  <button onClick={() => toggle(a.id)}
                    className="w-5 h-5 rounded border-2 shrink-0 mt-0.5 flex items-center justify-center transition-all"
                    style={{ borderColor: s.color }}>
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded text-white" style={{ background: s.color }}>
                        {a.priorite}
                      </span>
                      <span className="text-[10px] font-mono text-[var(--text-secondary)]">{a.anomalieCode}</span>
                      <span className="text-[10px] text-[var(--text-secondary)]">· {a.domaine}</span>
                    </div>
                    <p className="text-sm font-semibold text-[var(--text)]">{a.anomalieTitre}</p>
                    <p className="text-xs text-[var(--text-secondary)] mt-0.5">{a.action}</p>
                    <div className="flex items-center gap-4 mt-2">
                      <div className="flex items-center gap-1 text-[10px] text-[var(--text-secondary)]">
                        <User size={10} /> {a.responsable}
                      </div>
                      <div className="flex items-center gap-1 text-[10px] text-[var(--text-secondary)]">
                        <Clock size={10} /> {a.echeance}
                      </div>
                      <Link href={`/dashboard/miaa?context=audit&q=${encodeURIComponent(`Comment corriger : ${a.anomalieTitre} ?`)}`}
                        className="flex items-center gap-1 text-[10px] font-medium ml-auto" style={{ color: '#F59E0B' }}>
                        <MessageCircle size={10} /> MIAA+
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Actions réalisées */}
      {!loading && completed.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider">{completed.length} réalisée(s)</p>
          {completed.map(a => (
            <div key={a.id} className="rounded-xl border border-[var(--border)] p-4 opacity-60">
              <div className="flex items-start gap-3">
                <button onClick={() => toggle(a.id)}
                  className="w-5 h-5 rounded shrink-0 mt-0.5 flex items-center justify-center"
                  style={{ background: '#16A34A' }}>
                  <CheckCircle2 size={12} className="text-white" />
                </button>
                <div>
                  <p className="text-sm font-semibold text-[var(--text)] line-through">{a.anomalieTitre}</p>
                  <p className="text-xs text-[var(--text-secondary)] mt-0.5">{a.action}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && actions.length === 0 && (
        <div className="text-center py-12">
          <CheckCircle2 size={32} className="mx-auto mb-3" style={{ color: '#16A34A' }} />
          <p className="text-sm font-medium text-[var(--text)]">Aucune action corrective requise</p>
          <p className="text-xs text-[var(--text-secondary)] mt-1">Lancez un audit pour générer le plan d&apos;actions.</p>
        </div>
      )}
    </div>
  )
}

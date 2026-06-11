'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useTenant } from '@/lib/hooks/useTenant'
import { runAuditGlobal } from '@/lib/audit/engine'
import type { AuditAnomalie } from '@/lib/audit/engine'
import { BarChart2, ChevronLeft, Loader2, MessageCircle, Shield } from 'lucide-react'
import Link from 'next/link'

type RiskLevel = 'Critique' | 'Élevé' | 'Moyen' | 'Faible'

interface Risk {
  id: string
  titre: string
  domaine: string
  niveau: RiskLevel
  probabilite: 'Haute' | 'Moyenne' | 'Faible'
  impact_financier: 'Élevé' | 'Moyen' | 'Faible'
  description: string
  action: string
}

const RISK_STYLES: Record<RiskLevel, { bg: string; border: string; color: string }> = {
  'Critique': { bg: '#FEF2F2', border: '#FECACA', color: '#DC2626' },
  'Élevé':    { bg: '#FFF7ED', border: '#FED7AA', color: '#EA580C' },
  'Moyen':    { bg: '#FFFBEB', border: '#FDE68A', color: '#F59E0B' },
  'Faible':   { bg: '#EFF6FF', border: '#BFDBFE', color: '#2563EB' },
}

function anomalieToRisk(a: AuditAnomalie): Risk {
  const domaines: Record<string, string> = {
    comptable: 'Comptabilité', financier: 'Finance', fiscal: 'Fiscalité',
    rh: 'RH/Social', controle_interne: 'Contrôle Interne', ohada: 'OHADA',
  }
  const niveaux: Record<string, RiskLevel> = {
    critical: 'Critique', error: 'Élevé', warning: 'Moyen', info: 'Faible',
  }
  return {
    id:               a.id,
    titre:            a.titre,
    domaine:          domaines[a.domain] ?? a.domain,
    niveau:           niveaux[a.niveau] ?? 'Faible',
    probabilite:      a.niveau === 'critical' ? 'Haute' : a.niveau === 'error' ? 'Moyenne' : 'Faible',
    impact_financier: a.niveau === 'critical' ? 'Élevé' : a.niveau === 'error' ? 'Moyen' : 'Faible',
    description:      a.description,
    action:           a.recommandation,
  }
}

export default function RisquesPage() {
  const { tenantId } = useTenant()
  const [risks,   setRisks]   = useState<Risk[]>([])
  const [loading, setLoading] = useState(false)
  const [filter,  setFilter]  = useState<RiskLevel | 'Tous'>('Tous')

  const run = useCallback(async () => {
    if (!tenantId) return
    setLoading(true)
    try {
      const audit = await runAuditGlobal(supabase as never, tenantId)
      setRisks(audit.anomalies.map(anomalieToRisk))
    } finally {
      setLoading(false)
    }
  }, [tenantId])

  useEffect(() => { run() }, [run])

  const filtered = filter === 'Tous' ? risks : risks.filter(r => r.niveau === filter)
  const counts   = (['Critique', 'Élevé', 'Moyen', 'Faible'] as RiskLevel[]).map(n => ({
    n, count: risks.filter(r => r.niveau === n).length,
  }))

  return (
    <div className="space-y-5 w-full">
      <Link href="/dashboard/audit" className="inline-flex items-center gap-1 text-sm text-[var(--text-secondary)] hover:text-[var(--text)] transition-colors">
        <ChevronLeft size={15} /> Audit & Conformité
      </Link>

      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-start gap-4">
          <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0" style={{ background: '#FFF7ED' }}>
            <BarChart2 size={20} style={{ color: '#EA580C' }} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-[var(--text)]">Gestion des Risques</h1>
            <p className="text-xs text-[var(--text-secondary)] mt-0.5">Matrice des risques financiers · RH · Fiscaux · Opérationnels</p>
          </div>
        </div>
        <button onClick={run} disabled={loading}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-white text-xs font-medium"
          style={{ background: '#EA580C' }}>
          {loading ? <Loader2 size={12} className="animate-spin" /> : <Shield size={12} />}
          Actualiser
        </button>
      </div>

      {/* Résumé compteurs */}
      <div className="grid grid-cols-4 gap-3">
        {counts.map(({ n, count }) => {
          const s = RISK_STYLES[n]
          return (
            <button key={n} onClick={() => setFilter(filter === n ? 'Tous' : n)}
              className="p-3 rounded-xl border text-center transition-all"
              style={{ background: filter === n ? s.bg : 'var(--surface)', borderColor: filter === n ? s.color : 'var(--border)' }}>
              <p className="text-2xl font-bold" style={{ color: s.color }}>{count}</p>
              <p className="text-[10px] font-semibold mt-0.5" style={{ color: s.color }}>{n}</p>
            </button>
          )
        })}
      </div>

      {loading && <div className="flex justify-center py-10"><Loader2 size={28} className="animate-spin" style={{ color: '#EA580C' }} /></div>}

      {/* Matrice des risques */}
      {!loading && filtered.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider">
            {filter === 'Tous' ? `${risks.length} risque(s) identifié(s)` : `${filtered.length} risque(s) — ${filter}`}
          </p>
          {filtered.map(r => {
            const s = RISK_STYLES[r.niveau]
            return (
              <div key={r.id} className="rounded-xl border p-4" style={{ background: s.bg, borderColor: s.border }}>
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="flex items-start gap-3">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded text-white" style={{ background: s.color }}>{r.niveau}</span>
                        <span className="text-[10px] text-[var(--text-secondary)]">{r.domaine}</span>
                      </div>
                      <p className="text-sm font-semibold text-[var(--text)]">{r.titre}</p>
                      <p className="text-xs text-[var(--text-secondary)] mt-0.5">{r.description}</p>
                    </div>
                  </div>
                  <div className="flex gap-3 shrink-0 text-center">
                    <div>
                      <p className="text-[10px] font-bold text-[var(--text-secondary)]">Probabilité</p>
                      <p className="text-xs font-semibold" style={{ color: s.color }}>{r.probabilite}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-[var(--text-secondary)]">Impact</p>
                      <p className="text-xs font-semibold" style={{ color: s.color }}>{r.impact_financier}</p>
                    </div>
                  </div>
                </div>
                <div className="mt-2.5 pt-2.5 border-t flex items-center justify-between gap-3" style={{ borderColor: s.border }}>
                  <p className="text-xs text-[var(--text)] flex-1">{r.action}</p>
                  <Link href={`/dashboard/miaa?context=audit&q=${encodeURIComponent(`Comment mitiger ce risque : ${r.titre} ?`)}`}
                    className="flex items-center gap-1 text-[10px] font-medium shrink-0"
                    style={{ color: '#F59E0B' }}>
                    <MessageCircle size={10} /> MIAA+
                  </Link>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {!loading && risks.length === 0 && (
        <div className="text-center py-12 text-[var(--text-secondary)]">
          <Shield size={32} className="mx-auto mb-3" />
          <p className="text-sm font-medium">Aucun risque identifié</p>
          <p className="text-xs mt-1">Lancez l&apos;analyse pour cartographier les risques.</p>
        </div>
      )}
    </div>
  )
}

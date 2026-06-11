'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useTenant } from '@/lib/hooks/useTenant'
import { auditFinancier } from '@/lib/audit/engine'
import type { AuditScore } from '@/lib/audit/engine'
import { DollarSign, ChevronLeft, Loader2, CheckCircle2 } from 'lucide-react'
import Link from 'next/link'
import AuditAnomalieCard from '../_components/AuditAnomalieCard'
import AuditScoreHeader from '../_components/AuditScoreHeader'

export default function AuditFinancierPage() {
  const { tenantId } = useTenant()
  const [result,  setResult]  = useState<AuditScore | null>(null)
  const [loading, setLoading] = useState(false)

  const run = useCallback(async () => {
    if (!tenantId) return
    setLoading(true)
    try { setResult(await auditFinancier(supabase as never, tenantId)) }
    finally { setLoading(false) }
  }, [tenantId])

  useEffect(() => { run() }, [run])

  return (
    <div className="space-y-5 w-full">
      <Link href="/dashboard/audit" className="inline-flex items-center gap-1 text-sm text-[var(--text-secondary)] hover:text-[var(--text)] transition-colors">
        <ChevronLeft size={15} /> Audit & Conformité
      </Link>

      <AuditScoreHeader
        icon={DollarSign} iconColor="#16A34A"
        title="Audit Financier" subtitle="Rentabilité, liquidité, solvabilité, délais de paiement"
        score={result?.score ?? null} loading={loading} onRefresh={run}
        miaaContext="Analyse ma santé financière, mes ratios de liquidité et de solvabilité. Quelles sont les priorités ?"
      />

      {/* Ratios clés */}
      {result && !loading && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'Liquidité',    desc: 'Solde / Charges', target: '> 1.5', ok: result.score > 70 },
            { label: 'DSO',         desc: 'Délai recouvrement', target: '< 30j', ok: result.score > 70 },
            { label: 'Créances',    desc: '% du CA mensuel',   target: '< 30%', ok: result.score > 60 },
            { label: 'Activité',    desc: 'Encaissements/mois', target: '> 0',  ok: result.score > 50 },
          ].map(r => (
            <div key={r.label} className="p-3 rounded-xl border border-[var(--border)] bg-[var(--surface)]">
              <div className="flex items-center gap-1.5 mb-1">
                <div className="w-2 h-2 rounded-full" style={{ background: r.ok ? '#16A34A' : '#DC2626' }} />
                <p className="text-xs font-bold text-[var(--text)]">{r.label}</p>
              </div>
              <p className="text-[10px] text-[var(--text-secondary)]">{r.desc}</p>
              <p className="text-[10px] font-medium mt-1" style={{ color: r.ok ? '#16A34A' : '#DC2626' }}>Cible : {r.target}</p>
            </div>
          ))}
        </div>
      )}

      {loading && <div className="flex justify-center py-10"><Loader2 size={28} className="animate-spin" style={{ color: '#16A34A' }} /></div>}

      {result && !loading && (
        result.anomalies.length === 0 ? (
          <div className="flex items-center gap-3 p-5 rounded-2xl" style={{ background: '#DCFCE7', border: '1px solid #BBF7D0' }}>
            <CheckCircle2 size={20} style={{ color: '#16A34A' }} />
            <div>
              <p className="font-semibold text-sm" style={{ color: '#14532D' }}>Santé financière satisfaisante</p>
              <p className="text-xs mt-0.5" style={{ color: '#16A34A' }}>Aucune anomalie financière critique détectée.</p>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider">{result.anomalies.length} anomalie(s)</p>
            {result.anomalies.map(a => <AuditAnomalieCard key={a.id} anomalie={a} />)}
          </div>
        )
      )}
    </div>
  )
}

'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useTenant } from '@/lib/hooks/useTenant'
import { auditRH } from '@/lib/audit/engine'
import type { AuditScore } from '@/lib/audit/engine'
import { Users, ChevronLeft, Loader2, CheckCircle2 } from 'lucide-react'
import Link from 'next/link'
import AuditAnomalieCard from '../_components/AuditAnomalieCard'
import AuditScoreHeader from '../_components/AuditScoreHeader'

const CHECKLIST_RH = [
  'Contrats de travail signés',
  'Numéros CNSS pour tous les employés',
  'Salaires ≥ SMIG (90 000 FCFA)',
  'CDD avec dates de fin définies',
  'Bulletins de paie mensuels',
  'Déclarations CNSS trimestrielles',
  'Visite médicale annuelle',
  'Registre du personnel tenu à jour',
]

export default function AuditRHPage() {
  const { tenantId } = useTenant()
  const [result,  setResult]  = useState<AuditScore | null>(null)
  const [loading, setLoading] = useState(false)

  const run = useCallback(async () => {
    if (!tenantId) return
    setLoading(true)
    try { setResult(await auditRH(supabase as never, tenantId)) }
    finally { setLoading(false) }
  }, [tenantId])

  useEffect(() => { run() }, [run])

  return (
    <div className="space-y-5 max-w-3xl">
      <Link href="/dashboard/audit" className="inline-flex items-center gap-1 text-sm text-[var(--text-secondary)] hover:text-[var(--text)] transition-colors">
        <ChevronLeft size={15} /> Audit & Conformité
      </Link>

      <AuditScoreHeader
        icon={Users} iconColor="#0891B2"
        title="Audit RH & Social" subtitle="Contrats · CNSS · Paie · Conformité Code du Travail Congo 2023"
        score={result?.score ?? null} loading={loading} onRefresh={run}
        miaaContext="Analyse ma conformité sociale et RH. Quels employés posent des problèmes de conformité CNSS ou contrat ?"
      />

      {/* Checklist sociale */}
      <div className="rounded-xl border border-[var(--border)] overflow-hidden bg-[var(--surface)]">
        <div className="px-4 py-2.5 border-b border-[var(--border)] bg-[var(--surface-alt)]">
          <p className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider">Obligations sociales — Code du Travail Congo 2023</p>
        </div>
        <div className="divide-y divide-[var(--border)]">
          {CHECKLIST_RH.map(item => (
            <div key={item} className="flex items-center gap-2 px-4 py-2.5">
              <CheckCircle2 size={13} style={{ color: '#16A34A' }} />
              <span className="text-xs text-[var(--text)]">{item}</span>
            </div>
          ))}
        </div>
      </div>

      {loading && <div className="flex justify-center py-10"><Loader2 size={28} className="animate-spin" style={{ color: '#0891B2' }} /></div>}

      {result && !loading && (
        result.anomalies.length === 0 ? (
          <div className="flex items-center gap-3 p-5 rounded-2xl" style={{ background: '#DCFCE7', border: '1px solid #BBF7D0' }}>
            <CheckCircle2 size={20} style={{ color: '#16A34A' }} />
            <div>
              <p className="font-semibold text-sm" style={{ color: '#14532D' }}>Conformité sociale satisfaisante</p>
              <p className="text-xs mt-0.5" style={{ color: '#16A34A' }}>Aucune anomalie RH critique détectée.</p>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider">{result.anomalies.length} anomalie(s) RH</p>
            {result.anomalies.map(a => <AuditAnomalieCard key={a.id} anomalie={a} />)}
          </div>
        )
      )}
    </div>
  )
}

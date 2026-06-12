'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useTenant } from '@/lib/hooks/useTenant'
import { auditFiscal } from '@/lib/audit/engine'
import type { AuditScore } from '@/lib/audit/engine'
import { FileText, ChevronLeft, Loader2, CheckCircle2 } from 'lucide-react'
import Link from 'next/link'
import AuditAnomalieCard from '../_components/AuditAnomalieCard'
import AuditScoreHeader from '../_components/AuditScoreHeader'

const CHECKLIST = [
  { code: 'NIU',    label: 'NIU enregistré',            ref: 'CGI Congo, Art. 1103' },
  { code: 'RCCM',   label: 'RCCM renseigné',             ref: 'OHADA Commerce, Art. 35' },
  { code: 'TVA',    label: 'TVA calculée sur factures',  ref: 'CGI Congo, Art. 191' },
  { code: 'CA',     label: 'Centime Additionnel (5%)',   ref: 'CGI Congo, Art. 194' },
  { code: 'DECL',   label: 'Déclarations trimestrielles',ref: 'CGI Congo, Art. 232' },
  { code: 'IS',     label: 'Impôt sur les Sociétés',     ref: 'CGI Congo, Art. 81' },
  { code: 'DAS',    label: 'DAS annuelle',               ref: 'CGI Congo, Art. 175' },
  { code: 'PATENTE',label: 'Patente janvier',            ref: 'CGI Congo, Art. 405' },
]

export default function AuditFiscalPage() {
  const { tenantId } = useTenant()
  const [result,  setResult]  = useState<AuditScore | null>(null)
  const [loading, setLoading] = useState(false)

  const run = useCallback(async () => {
    if (!tenantId) return
    setLoading(true)
    try { setResult(await auditFiscal(supabase as never, tenantId)) }
    finally { setLoading(false) }
  }, [tenantId])

  useEffect(() => { run() }, [run])

  const anomalyCodes = result?.anomalies.map(a => a.code) ?? []

  return (
    <div className="space-y-5 w-full">
      <Link href="/dashboard/audit" className="inline-flex items-center gap-1 text-sm text-[var(--text-secondary)] hover:text-[var(--text)] transition-colors">
        <ChevronLeft size={15} /> Audit & Conformité
      </Link>

      <AuditScoreHeader
        icon={FileText} iconColor="#7C3AED"
        title="Audit Fiscal" subtitle="TVA · DAS · Impôts · Patente — Conformité DGI Congo"
        score={result?.score ?? null} loading={loading} onRefresh={run}
        miaaContext="Analyse ma conformité fiscale au Congo-Brazzaville. Quelles déclarations sont en retard ou manquantes ?"
      />

      {/* Checklist obligations fiscales */}
      <div className="rounded-xl border border-[var(--border)] overflow-hidden bg-[var(--surface)]">
        <div className="px-4 py-2.5 border-b border-[var(--border)] bg-[var(--surface-alt)]">
          <p className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider">Checklist Obligations Fiscales — Congo</p>
        </div>
        <div className="divide-y divide-[var(--border)]">
          {CHECKLIST.map(item => {
            const hasAnomaly = anomalyCodes.some(c => c.startsWith('T') && result?.anomalies.some(a => a.code === c && (a.titre.toLowerCase().includes(item.label.toLowerCase().slice(0, 5)))))
            return (
              <div key={item.code} className="flex items-center justify-between px-4 py-2.5">
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={13} style={{ color: '#16A34A' }} />
                  <span className="text-xs font-medium text-[var(--text)]">{item.label}</span>
                </div>
                <span className="text-[10px] text-[var(--text-secondary)]">{item.ref}</span>
              </div>
            )
          })}
        </div>
      </div>

      {loading && <div className="flex justify-center py-10"><Loader2 size={28} className="animate-spin" style={{ color: '#7C3AED' }} /></div>}

      {result && !loading && (
        result.anomalies.length === 0 ? (
          <div className="flex items-center gap-3 p-5 rounded-2xl" style={{ background: '#DCFCE7', border: '1px solid #BBF7D0' }}>
            <CheckCircle2 size={20} style={{ color: '#16A34A' }} />
            <div>
              <p className="font-semibold text-sm" style={{ color: '#14532D' }}>Conformité fiscale vérifiée</p>
              <p className="text-xs mt-0.5" style={{ color: '#16A34A' }}>Aucune anomalie fiscale détectée sur les points contrôlés.</p>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider">{result.anomalies.length} anomalie(s) fiscale(s)</p>
            {result.anomalies.map(a => <AuditAnomalieCard key={a.id} anomalie={a} />)}
          </div>
        )
      )}
    </div>
  )
}

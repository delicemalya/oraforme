'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useTenant } from '@/lib/hooks/useTenant'
import { auditComptable, type AuditScore, type AuditAnomalie } from '@/lib/audit/engine'
import { BookOpen, RefreshCw, ChevronLeft, Loader2, AlertTriangle, CheckCircle2, Info, XCircle, MessageCircle } from 'lucide-react'
import Link from 'next/link'
import AuditAnomalieCard from '../_components/AuditAnomalieCard'
import AuditScoreHeader from '../_components/AuditScoreHeader'

export default function AuditComptablePage() {
  const { tenantId } = useTenant()
  const [result,  setResult]  = useState<AuditScore | null>(null)
  const [loading, setLoading] = useState(false)

  const run = useCallback(async () => {
    if (!tenantId) return
    setLoading(true)
    try { setResult(await auditComptable(supabase as never, tenantId)) }
    finally { setLoading(false) }
  }, [tenantId])

  useEffect(() => { run() }, [run])

  return (
    <div className="space-y-5 w-full">
      <div className="flex items-center gap-3">
        <Link href="/dashboard/audit" className="flex items-center gap-1 text-sm text-[var(--text-secondary)] hover:text-[var(--text)] transition-colors">
          <ChevronLeft size={15} /> Audit & Conformité
        </Link>
      </div>

      <AuditScoreHeader
        icon={BookOpen}
        iconColor="#2563EB"
        title="Audit Comptable"
        subtitle="Journal, balance, bilan — conformité SYSCOHADA révisé"
        score={result?.score ?? null}
        loading={loading}
        onRefresh={run}
        miaaContext="Explique-moi les anomalies comptables détectées et comment les corriger selon le SYSCOHADA."
      />

      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 size={28} className="animate-spin" style={{ color: '#2563EB' }} />
        </div>
      )}

      {result && !loading && (
        <>
          {result.anomalies.length === 0 ? (
            <div className="flex items-center gap-3 p-5 rounded-2xl" style={{ background: '#DCFCE7', border: '1px solid #BBF7D0' }}>
              <CheckCircle2 size={20} style={{ color: '#16A34A' }} />
              <div>
                <p className="font-semibold text-sm" style={{ color: '#14532D' }}>Aucune anomalie comptable détectée</p>
                <p className="text-xs mt-0.5" style={{ color: '#16A34A' }}>Votre comptabilité est conforme au SYSCOHADA sur les points contrôlés.</p>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider">
                {result.anomalies.length} anomalie(s) détectée(s)
              </p>
              {result.anomalies.map(a => <AuditAnomalieCard key={a.id} anomalie={a} />)}
            </div>
          )}

          <div className="rounded-xl border border-[var(--border)] p-4 bg-[var(--surface)]">
            <p className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-2">Points contrôlés</p>
            <div className="grid grid-cols-2 gap-2 text-xs text-[var(--text-secondary)]">
              {['Références des écritures','Numérotation factures','Montants nuls','Activité comptable','Statut des factures'].map(p => (
                <div key={p} className="flex items-center gap-1.5">
                  <CheckCircle2 size={11} style={{ color: '#16A34A' }} /> {p}
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

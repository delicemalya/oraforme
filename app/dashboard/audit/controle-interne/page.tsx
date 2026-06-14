'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useTenant } from '@/lib/hooks/useTenant'
import { auditControleInterne } from '@/lib/audit/engine'
import type { AuditScore } from '@/lib/audit/engine'
import { Lock, ChevronLeft, Loader2, CheckCircle2 } from 'lucide-react'
import Link from 'next/link'
import AuditAnomalieCard from '../_components/AuditAnomalieCard'
import AuditScoreHeader from '../_components/AuditScoreHeader'
import { usePlanFeature } from '@/lib/hooks/usePlanFeature'
import PlanFeatureGate from '@/components/PlanFeatureGate'

const PRINCIPES = [
  { titre: 'Séparation des tâches',     desc: 'Personne ne doit avoir accès à toutes les étapes d\'une transaction.' },
  { titre: 'Principe de moindre privilège', desc: 'Chaque utilisateur n\'a accès qu\'aux modules nécessaires à son poste.' },
  { titre: 'Workflow de validation',    desc: 'Toute action critique doit être validée par un supérieur.' },
  { titre: 'Journalisation des actions',desc: 'Toute modification doit être enregistrée dans le journal d\'audit.' },
  { titre: 'Authentification forte',    desc: 'Connexion sécurisée obligatoire pour tous les utilisateurs.' },
]

export default function ControleInternePage() {
  const { allowed: canControle } = usePlanFeature('audit-controle-interne')
  const { tenantId } = useTenant()
  const [result,  setResult]  = useState<AuditScore | null>(null)
  const [loading, setLoading] = useState(false)

  const run = useCallback(async () => {
    if (!tenantId) return
    setLoading(true)
    try { setResult(await auditControleInterne(supabase as never, tenantId)) }
    finally { setLoading(false) }
  }, [tenantId])

  useEffect(() => { run() }, [run])

  if (!canControle) return <PlanFeatureGate feature="audit-controle-interne" />

  return (
    <div className="space-y-5 w-full">
      <Link href="/dashboard/audit" className="inline-flex items-center gap-1 text-sm text-[var(--text-secondary)] hover:text-[var(--text)] transition-colors">
        <ChevronLeft size={15} /> Audit & Conformité
      </Link>

      <AuditScoreHeader
        icon={Lock} iconColor="#7C3AED"
        title="Contrôle Interne" subtitle="Séparation des tâches · Permissions · Workflows · Prévention fraude"
        score={result?.score ?? null} loading={loading} onRefresh={run}
        miaaContext="Analyse mon contrôle interne. Quels sont les risques de fraude ou d'accès excessifs détectés ?"
      />

      {/* Principes */}
      <div className="rounded-xl border border-[var(--border)] overflow-hidden bg-[var(--surface)]">
        <div className="px-4 py-2.5 border-b border-[var(--border)] bg-[var(--surface-alt)]">
          <p className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider">Principes fondamentaux du Contrôle Interne (COSO)</p>
        </div>
        {PRINCIPES.map(p => (
          <div key={p.titre} className="flex items-start gap-3 px-4 py-3 border-b border-[var(--border)] last:border-b-0">
            <CheckCircle2 size={13} className="mt-0.5 shrink-0" style={{ color: '#16A34A' }} />
            <div>
              <p className="text-xs font-semibold text-[var(--text)]">{p.titre}</p>
              <p className="text-[11px] text-[var(--text-secondary)] mt-0.5">{p.desc}</p>
            </div>
          </div>
        ))}
      </div>

      {loading && <div className="flex justify-center py-10"><Loader2 size={28} className="animate-spin" style={{ color: '#7C3AED' }} /></div>}

      {result && !loading && (
        result.anomalies.length === 0 ? (
          <div className="flex items-center gap-3 p-5 rounded-2xl" style={{ background: '#DCFCE7', border: '1px solid #BBF7D0' }}>
            <CheckCircle2 size={20} style={{ color: '#16A34A' }} />
            <div>
              <p className="font-semibold text-sm" style={{ color: '#14532D' }}>Contrôle interne satisfaisant</p>
              <p className="text-xs mt-0.5" style={{ color: '#16A34A' }}>Aucune défaillance de contrôle interne détectée.</p>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider">{result.anomalies.length} point(s) à corriger</p>
            {result.anomalies.map(a => <AuditAnomalieCard key={a.id} anomalie={a} />)}
          </div>
        )
      )}

      {/* Liens rapides */}
      <div className="grid grid-cols-2 gap-3">
        <Link href="/dashboard/roles" className="p-3 rounded-xl border border-[var(--border)] hover:border-[var(--primary)] transition-all">
          <p className="text-xs font-semibold text-[var(--text)]">Gérer les rôles</p>
          <p className="text-[11px] text-[var(--text-secondary)] mt-0.5">Configurer les permissions</p>
        </Link>
        <Link href="/dashboard/workflows" className="p-3 rounded-xl border border-[var(--border)] hover:border-[var(--primary)] transition-all">
          <p className="text-xs font-semibold text-[var(--text)]">Workflows</p>
          <p className="text-[11px] text-[var(--text-secondary)] mt-0.5">Activer les validations</p>
        </Link>
      </div>
    </div>
  )
}

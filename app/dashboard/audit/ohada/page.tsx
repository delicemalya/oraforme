'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useTenant } from '@/lib/hooks/useTenant'
import { auditOHADA } from '@/lib/audit/engine'
import type { AuditScore } from '@/lib/audit/engine'
import { Award, ChevronLeft, Loader2, CheckCircle2, BookOpen } from 'lucide-react'
import Link from 'next/link'
import AuditAnomalieCard from '../_components/AuditAnomalieCard'
import AuditScoreHeader from '../_components/AuditScoreHeader'

const OHADA_ACTES = [
  { titre: 'Droit Commercial Général',    desc: 'Immatriculation, RCCM, fonds de commerce', ref: 'AU-DCG' },
  { titre: 'Sociétés Commerciales',       desc: 'Constitution, gouvernance, capital social',  ref: 'AU-SC'  },
  { titre: 'Comptabilité (SYSCOHADA)',    desc: 'Plan comptable, états financiers annuels',   ref: 'AU-CO'  },
  { titre: 'Recouvrement des Créances',  desc: 'Délais paiement, voies d\'exécution',        ref: 'AU-RVE' },
  { titre: 'Procédures Collectives',      desc: 'Redressement, liquidation judiciaire',       ref: 'AU-PC'  },
  { titre: 'Droit du Travail (OHADA)',   desc: 'Contrats, licenciement, protection sociale',  ref: 'Code Travail' },
  { titre: 'Arbitrage',                  desc: 'Résolution des litiges commerciaux',           ref: 'AU-ARB' },
]

const SYSCOHADA_CLASSES = [
  { classe: '1', label: 'Comptes de ressources durables', exemple: '10 Capital, 11 Réserves, 16 Emprunts' },
  { classe: '2', label: 'Comptes d\'actif immobilisé',   exemple: '21 Terrains, 23 Bâtiments, 24 Matériel' },
  { classe: '3', label: 'Comptes de stocks',              exemple: '31 Marchés, 32 Matières premières' },
  { classe: '4', label: 'Comptes de tiers',               exemple: '40 Fourn., 41 Clients, 44 État TVA' },
  { classe: '5', label: 'Comptes de trésorerie',          exemple: '51 Banques, 52 Chèques, 57 Caisse' },
  { classe: '6', label: 'Comptes de charges',             exemple: '60 Achats, 64 Personnel, 67 Financiers' },
  { classe: '7', label: 'Comptes de produits',            exemple: '70 Ventes, 75 Autres produits' },
]

export default function OhadaPage() {
  const { tenantId } = useTenant()
  const [result,  setResult]  = useState<AuditScore | null>(null)
  const [loading, setLoading] = useState(false)

  const run = useCallback(async () => {
    if (!tenantId) return
    setLoading(true)
    try { setResult(await auditOHADA(supabase as never, tenantId)) }
    finally { setLoading(false) }
  }, [tenantId])

  useEffect(() => { run() }, [run])

  return (
    <div className="space-y-5 w-full">
      <Link href="/dashboard/audit" className="inline-flex items-center gap-1 text-sm text-[var(--text-secondary)] hover:text-[var(--text)] transition-colors">
        <ChevronLeft size={15} /> Audit & Conformité
      </Link>

      <AuditScoreHeader
        icon={Award} iconColor="#7C3AED"
        title="Conformité OHADA" subtitle="SYSCOHADA révisé · Actes Uniformes · 17 États membres"
        score={result?.score ?? null} loading={loading} onRefresh={run}
        miaaContext="Vérifie ma conformité OHADA. Quels actes uniformes ne sont pas respectés dans mon entreprise ?"
      />

      {loading && <div className="flex justify-center py-10"><Loader2 size={28} className="animate-spin" style={{ color: '#7C3AED' }} /></div>}

      {result && !loading && (
        result.anomalies.length === 0 ? (
          <div className="flex items-center gap-3 p-5 rounded-2xl" style={{ background: '#DCFCE7', border: '1px solid #BBF7D0' }}>
            <CheckCircle2 size={20} style={{ color: '#16A34A' }} />
            <div>
              <p className="font-semibold text-sm" style={{ color: '#14532D' }}>Conformité OHADA vérifiée</p>
              <p className="text-xs mt-0.5" style={{ color: '#16A34A' }}>Votre entreprise est conforme aux points OHADA contrôlés.</p>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider">{result.anomalies.length} non-conformité(s) OHADA</p>
            {result.anomalies.map(a => <AuditAnomalieCard key={a.id} anomalie={a} />)}
          </div>
        )
      )}

      {/* Actes Uniformes OHADA */}
      <div className="rounded-xl border border-[var(--border)] overflow-hidden bg-[var(--surface)]">
        <div className="px-4 py-2.5 border-b border-[var(--border)] bg-[var(--surface-alt)] flex items-center gap-2">
          <BookOpen size={13} style={{ color: '#7C3AED' }} />
          <p className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider">Les 7 Actes Uniformes OHADA applicables</p>
        </div>
        {OHADA_ACTES.map(a => (
          <div key={a.ref} className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)] last:border-b-0">
            <div>
              <p className="text-xs font-semibold text-[var(--text)]">{a.titre}</p>
              <p className="text-[11px] text-[var(--text-secondary)]">{a.desc}</p>
            </div>
            <span className="text-[10px] font-mono bg-[var(--surface-alt)] px-2 py-0.5 rounded text-[var(--text-secondary)] shrink-0 ml-3">{a.ref}</span>
          </div>
        ))}
      </div>

      {/* Plan comptable SYSCOHADA */}
      <div className="rounded-xl border border-[var(--border)] overflow-hidden bg-[var(--surface)]">
        <div className="px-4 py-2.5 border-b border-[var(--border)] bg-[var(--surface-alt)]">
          <p className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider">Plan Comptable SYSCOHADA — Classes 1 à 7</p>
        </div>
        {SYSCOHADA_CLASSES.map(c => (
          <div key={c.classe} className="flex items-start gap-3 px-4 py-2.5 border-b border-[var(--border)] last:border-b-0">
            <span className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold text-white shrink-0" style={{ background: '#7C3AED' }}>
              {c.classe}
            </span>
            <div>
              <p className="text-xs font-semibold text-[var(--text)]">{c.label}</p>
              <p className="text-[11px] text-[var(--text-secondary)]">{c.exemple}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

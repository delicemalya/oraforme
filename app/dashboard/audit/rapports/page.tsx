'use client'

import { useState, useCallback } from 'react'
import { useTenant } from '@/lib/hooks/useTenant'
import { TrendingUp, ChevronLeft, Loader2, Download, FileText, Sparkles } from 'lucide-react'
import Link from 'next/link'

const RAPPORT_TYPES = [
  { id: 'audit_global'  as const, label: 'Rapport d\'Audit Global',      icon: '🛡️', desc: 'Score global + toutes anomalies + plan d\'actions', api: 'rapport_mensuel'    },
  { id: 'audit_fiscal'  as const, label: 'Rapport Audit Fiscal',         icon: '🏛️', desc: 'TVA, NIF, RCCM, conformité DGI',                    api: 'rapport_mensuel'    },
  { id: 'audit_rh'      as const, label: 'Rapport Audit RH & Social',    icon: '👥', desc: 'Contrats, CNSS, paie, conformité sociale',           api: 'rapport_mensuel'    },
  { id: 'audit_compta'  as const, label: 'Rapport Audit Comptable',      icon: '📒', desc: 'Journal, balance, SYSCOHADA',                        api: 'rapport_mensuel'    },
  { id: 'bilan'         as const, label: 'Bilan Simplifié OHADA',        icon: '📊', desc: 'Actif / Passif conforme SYSCOHADA',                  api: 'bilan_simplifie'    },
  { id: 'tresorerie'    as const, label: 'Rapport de Trésorerie',        icon: '💵', desc: 'Flux, prévisions, recommandations',                  api: 'rapport_tresorerie' },
]

export default function RapportsPage() {
  const { tenantId } = useTenant()
  const [loading,  setLoading]  = useState<string | null>(null)
  const [results,  setResults]  = useState<Record<string, string>>({})

  const generate = useCallback(async (rapportId: string, apiType: string) => {
    if (!tenantId || loading) return
    setLoading(rapportId)
    try {
      const res  = await fetch('/api/miaa/generer-document', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: apiType, tenant_id: tenantId,
          context: `Rapport de type : ${rapportId}. Focus sur la conformité OHADA et les anomalies détectées.` }),
      })
      const data = await res.json()
      setResults(prev => ({ ...prev, [rapportId]: data.content ?? data.error ?? 'Erreur' }))
    } finally {
      setLoading(null)
    }
  }, [tenantId, loading])

  const download = (rapportId: string, label: string) => {
    const content = results[rapportId]
    if (!content) return
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
    const a    = document.createElement('a')
    a.href     = URL.createObjectURL(blob)
    a.download = `${label.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.txt`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  return (
    <div className="space-y-5 max-w-3xl">
      <Link href="/dashboard/audit" className="inline-flex items-center gap-1 text-sm text-[var(--text-secondary)] hover:text-[var(--text)] transition-colors">
        <ChevronLeft size={15} /> Audit & Conformité
      </Link>

      <div className="flex items-start gap-4">
        <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0" style={{ background: '#EFF6FF' }}>
          <TrendingUp size={20} style={{ color: '#2563EB' }} />
        </div>
        <div>
          <h1 className="text-xl font-bold text-[var(--text)]">Rapports d&apos;Audit</h1>
          <p className="text-xs text-[var(--text-secondary)] mt-0.5">Génération automatique via MIAA+ — Audit Comptable, Fiscal, RH, Global</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {RAPPORT_TYPES.map(r => (
          <div key={r.id} className="rounded-xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden">
            <div className="flex items-center gap-3 p-4">
              <span className="text-2xl">{r.icon}</span>
              <div className="flex-1">
                <p className="text-sm font-semibold text-[var(--text)]">{r.label}</p>
                <p className="text-xs text-[var(--text-secondary)] mt-0.5">{r.desc}</p>
              </div>
              <div className="flex items-center gap-2">
                {results[r.id] && (
                  <button onClick={() => download(r.id, r.label)}
                    className="p-2 rounded-lg border border-[var(--border)] hover:border-[var(--primary)] transition-colors"
                    title="Télécharger">
                    <Download size={13} style={{ color: '#2563EB' }} />
                  </button>
                )}
                <button
                  onClick={() => generate(r.id, r.api)}
                  disabled={!!loading}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-white text-xs font-medium disabled:opacity-50"
                  style={{ background: '#2563EB' }}>
                  {loading === r.id ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                  {loading === r.id ? 'Génération…' : 'Générer'}
                </button>
              </div>
            </div>

            {results[r.id] && (
              <div className="border-t border-[var(--border)] bg-[var(--surface-alt)] p-4 max-h-60 overflow-y-auto">
                <pre className="text-[11px] text-[var(--text)] whitespace-pre-wrap font-sans leading-relaxed">
                  {results[r.id]}
                </pre>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-[var(--border)] p-4 bg-[var(--surface)] flex items-center gap-3">
        <FileText size={16} style={{ color: '#F59E0B' }} />
        <div className="flex-1">
          <p className="text-xs font-semibold text-[var(--text)]">Export PDF / Excel</p>
          <p className="text-[11px] text-[var(--text-secondary)]">Fonctionnalité disponible avec le plan Entreprise.</p>
        </div>
        <Link href="/dashboard/abonnement"
          className="text-xs font-medium px-3 py-1.5 rounded-lg text-white"
          style={{ background: '#F59E0B' }}>
          Upgrader
        </Link>
      </div>
    </div>
  )
}

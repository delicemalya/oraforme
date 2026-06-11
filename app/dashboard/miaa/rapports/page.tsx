'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useTenant } from '@/lib/hooks/useTenant'
import { FileText, ChevronLeft, Loader2, Download, RefreshCw, Clock } from 'lucide-react'
import Link from 'next/link'

type Rapport = {
  id:         string
  type:       string
  contenu:    string
  auto:       boolean
  created_at: string
}

const TYPE_LABELS: Record<string, { label: string; emoji: string }> = {
  rapport_mensuel:    { label: 'Rapport mensuel',      emoji: '📊' },
  bulletin_paie:      { label: 'Bulletin de paie',     emoji: '💰' },
  rapport_tresorerie: { label: 'Rapport trésorerie',   emoji: '💵' },
  rapport_stock:      { label: 'Rapport stock',        emoji: '📦' },
  bilan_simplifie:    { label: 'Bilan simplifié',      emoji: '📒' },
  rapport_audit:      { label: 'Rapport audit',        emoji: '🛡️' },
  relance_facture:    { label: 'Lettre de relance',    emoji: '📨' },
  contrat_travail:    { label: 'Contrat de travail',   emoji: '📋' },
  rapport_rh:         { label: 'Rapport RH',           emoji: '👥' },
  rapport_fiscal:     { label: 'Rapport fiscal',       emoji: '🏛️' },
}

export default function MIAArapportsPage() {
  const { tenantId } = useTenant()
  const [rapports, setRapports] = useState<Rapport[]>([])
  const [loading,  setLoading]  = useState(true)
  const [selected, setSelected] = useState<Rapport | null>(null)
  const [filter,   setFilter]   = useState<string>('tous')

  const load = useCallback(async () => {
    if (!tenantId) return
    setLoading(true)
    const { data } = await supabase
      .from('miaa_rapports')
      .select('id, type, contenu, auto, created_at')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(50)
    setRapports((data ?? []) as Rapport[])
    setLoading(false)
  }, [tenantId])

  useEffect(() => { load() }, [load])

  const types   = ['tous', ...Array.from(new Set(rapports.map(r => r.type)))]
  const filtered = filter === 'tous' ? rapports : rapports.filter(r => r.type === filter)

  const download = (r: Rapport) => {
    const lbl = TYPE_LABELS[r.type]?.label ?? r.type
    const blob = new Blob([r.contenu], { type: 'text/plain;charset=utf-8' })
    const a    = document.createElement('a')
    a.href     = URL.createObjectURL(blob)
    a.download = `${lbl.replace(/\s+/g, '_')}_${r.created_at.slice(0, 10)}.txt`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  return (
    <div className="space-y-5 w-full">
      <Link href="/dashboard/miaa" className="inline-flex items-center gap-1 text-sm text-[var(--text-secondary)] hover:text-[var(--text)] transition-colors">
        <ChevronLeft size={15} /> MIAA+
      </Link>

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-start gap-4">
          <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0" style={{ background: '#FEF3C7' }}>
            <FileText size={20} style={{ color: '#F59E0B' }} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-[var(--text)]">Rapports MIAA+</h1>
            <p className="text-xs text-[var(--text-secondary)] mt-0.5">Tous les rapports générés — manuels et automatiques</p>
          </div>
        </div>
        <button onClick={load} className="p-2 rounded-xl border border-[var(--border)] hover:border-[#F59E0B] transition-colors">
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} style={{ color: '#F59E0B' }} />
        </button>
      </div>

      {/* Filtres */}
      <div className="flex gap-2 flex-wrap">
        {types.map(t => (
          <button key={t} onClick={() => setFilter(t)}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all border ${
              filter === t ? 'text-white border-transparent' : 'border-[var(--border)] text-[var(--text-secondary)] hover:border-[#F59E0B]'
            }`}
            style={filter === t ? { background: '#F59E0B' } : {}}>
            {t === 'tous' ? 'Tous' : (TYPE_LABELS[t]?.emoji + ' ' + (TYPE_LABELS[t]?.label ?? t))}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={28} className="animate-spin" style={{ color: '#F59E0B' }} />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <FileText size={36} className="mx-auto mb-3 text-[var(--text-secondary)]" />
          <p className="text-sm font-medium text-[var(--text)]">Aucun rapport généré</p>
          <p className="text-xs text-[var(--text-secondary)] mt-1">Les rapports apparaissent ici après génération via MIAA+.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3">
          {filtered.map(r => {
            const meta = TYPE_LABELS[r.type] ?? { label: r.type, emoji: '📄' }
            return (
              <div key={r.id} className="rounded-xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden">
                <div className="flex items-center gap-3 p-4">
                  <span className="text-2xl shrink-0">{meta.emoji}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-[var(--text)]">{meta.label}</p>
                      {r.auto && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold text-white" style={{ background: '#8B5CF6' }}>AUTO</span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <Clock size={11} className="text-[var(--text-secondary)]" />
                      <p className="text-[11px] text-[var(--text-secondary)]">
                        {new Date(r.created_at).toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short' })}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button onClick={() => setSelected(selected?.id === r.id ? null : r)}
                      className="px-3 py-1.5 rounded-lg border border-[var(--border)] text-xs text-[var(--text-secondary)] hover:border-[#F59E0B] transition-colors">
                      {selected?.id === r.id ? 'Masquer' : 'Voir'}
                    </button>
                    <button onClick={() => download(r)}
                      className="p-2 rounded-lg border border-[var(--border)] hover:border-[#F59E0B] transition-colors">
                      <Download size={13} style={{ color: '#F59E0B' }} />
                    </button>
                  </div>
                </div>
                {selected?.id === r.id && (
                  <div className="border-t border-[var(--border)] bg-[var(--surface-alt)] p-4 max-h-80 overflow-y-auto">
                    <pre className="text-[11px] text-[var(--text)] whitespace-pre-wrap font-sans leading-relaxed">{r.contenu}</pre>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

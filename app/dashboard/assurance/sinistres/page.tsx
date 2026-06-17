'use client'

import { useState, useEffect, useCallback } from 'react'
import { useTenantContext } from '@/lib/contexts/TenantContext'
import {
  AlertTriangle, Plus, Search, RefreshCw, X,
  CheckCircle2, Clock, Shield, ChevronRight,
  FileText, ArrowRight, Sparkles, AlertCircle,
} from 'lucide-react'

// ── Types ─────────────────────────────────────────────────────────────────────

interface Sinistre {
  id: string
  numero_sinistre: string
  statut: string
  type_sinistre: string
  description: string
  date_declaration: string
  date_survenance: string
  montant_estime: number
  montant_expertise: number
  montant_paye: number
  expert_nom: string
  notes: string
  created_at: string
  ass_polices?: { numero_police: string; type_police: string; assure_nom: string; prime_montant: number }
}

interface MIAAResult {
  score: number
  niveau: 'faible' | 'moyen' | 'eleve'
  facteurs: string[]
  justification: string
  recommandation: string
}

// ── Constants ─────────────────────────────────────────────────────────────────

const WORKFLOW: Array<{ value: string; label: string; color: string; bg: string }> = [
  { value: 'declare',        label: 'Déclaré',        color: 'text-blue-700',   bg: 'bg-blue-100'   },
  { value: 'en_instruction', label: 'En instruction', color: 'text-yellow-700', bg: 'bg-yellow-100' },
  { value: 'expertise',      label: 'Expertise',      color: 'text-purple-700', bg: 'bg-purple-100' },
  { value: 'accepte',        label: 'Accepté',        color: 'text-green-700',  bg: 'bg-green-100'  },
  { value: 'refuse',         label: 'Refusé',         color: 'text-red-700',    bg: 'bg-red-100'    },
  { value: 'clos',           label: 'Clos',           color: 'text-gray-600',   bg: 'bg-gray-100'   },
]

const NEXT_STATUT: Record<string, string> = {
  declare:        'en_instruction',
  en_instruction: 'expertise',
  expertise:      'accepte',
  accepte:        'clos',
}

const fmt = (n: number) => new Intl.NumberFormat('fr-FR').format(Math.round(n))
const fmtDate = (d: string) => d ? new Date(d).toLocaleDateString('fr-FR') : '—'
const getWf = (s: string) => WORKFLOW.find(w => w.value === s) ?? WORKFLOW[0]

const EMPTY_FORM = {
  police_id: '', type_sinistre: '', description: '',
  date_declaration: new Date().toISOString().split('T')[0],
  date_survenance: '', montant_estime: 0, expert_nom: '', notes: '',
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function SinistresPage() {
  const { tenant } = useTenantContext()
  const tenantId = tenant?.tenantId ?? ''
  const [sinistres, setSinistres] = useState<Sinistre[]>([])
  const [loading,   setLoading]   = useState(true)
  const [saving,    setSaving]    = useState(false)
  const [search,    setSearch]    = useState('')
  const [filterStatut, setFilterStatut] = useState('')
  const [showModal,    setShowModal]    = useState(false)
  const [selected,     setSelected]     = useState<Sinistre | null>(null)
  const [form,         setForm]         = useState({ ...EMPTY_FORM })
  const [error,        setError]        = useState('')
  const [taux,         setTaux]         = useState(0)
  const [miaaResults,  setMiaaResults]  = useState<Record<string, MIAAResult>>({})
  const [miaaLoading,  setMiaaLoading]  = useState<Record<string, boolean>>({})

  const analyzeWithMIAA = async (s: Sinistre) => {
    setMiaaLoading(prev => ({ ...prev, [s.id]: true }))
    try {
      const res  = await fetch('/api/miaa/assurance-fraude', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sinistre_id: s.id }) })
      const data = await res.json()
      setMiaaResults(prev => ({ ...prev, [s.id]: data }))
    } finally {
      setMiaaLoading(prev => ({ ...prev, [s.id]: false }))
    }
  }

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (filterStatut) params.set('statut', filterStatut)
      if (search)       params.set('search', search)
      const res  = await fetch(`/api/assurance/sinistres?${params}`)
      const json = await res.json()
      setSinistres(json.data ?? [])
      setTaux(json.taux_sinistralite ?? 0)
    } finally { setLoading(false) }
  }, [filterStatut, search])

  useEffect(() => { if (tenantId) load() }, [tenantId, load])

  const handleCreate = async () => {
    if (!form.police_id) { setError('Sélectionnez une police'); return }
    setSaving(true); setError('')
    try {
      const res = await fetch('/api/assurance/sinistres', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) { const j = await res.json(); setError(j.error ?? 'Erreur'); return }
      setShowModal(false); load()
    } finally { setSaving(false) }
  }

  const advanceStatut = async (s: Sinistre, newStatut: string, note = '') => {
    await fetch('/api/assurance/sinistres', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: s.id, statut: newStatut, note }),
    })
    load()
  }

  const displayed = sinistres.filter(s =>
    !search || s.numero_sinistre?.includes(search) ||
    s.ass_polices?.assure_nom?.toLowerCase().includes(search.toLowerCase())
  )

  const enCours = sinistres.filter(s => !['clos','refuse'].includes(s.statut)).length

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-black text-[#0F172A] flex items-center gap-2">
            <AlertTriangle className="text-orange-500" size={22} /> Gestion des sinistres
          </h1>
          <p className="text-sm text-[#64748B]">
            {enCours} en cours · Taux sinistralité{' '}
            <span className={taux > 70 ? 'text-red-600 font-bold' : 'text-green-600 font-bold'}>{taux}%</span>
          </p>
        </div>
        <button onClick={() => { setForm({ ...EMPTY_FORM }); setError(''); setShowModal(true) }}
          className="inline-flex items-center gap-1.5 bg-[#DC2626] hover:bg-[#B91C1C] text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors">
          <Plus size={15} /> Déclarer sinistre
        </button>
      </div>

      {/* Workflow summary */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
        {WORKFLOW.map(w => {
          const count = sinistres.filter(s => s.statut === w.value).length
          return (
            <button key={w.value}
              onClick={() => setFilterStatut(filterStatut === w.value ? '' : w.value)}
              className={`rounded-xl p-3 text-center border transition-all ${
                filterStatut === w.value ? `${w.bg} border-current ${w.color}` : 'bg-white border-gray-100 hover:border-gray-200'
              }`}>
              <div className={`text-xl font-black ${filterStatut === w.value ? w.color : 'text-[#0F172A]'}`}>{count}</div>
              <div className={`text-[10px] font-semibold ${filterStatut === w.value ? w.color : 'text-[#64748B]'}`}>{w.label}</div>
            </button>
          )
        })}
      </div>

      {/* Barre recherche */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher numéro, assuré..."
            className="w-full pl-9 pr-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:border-[#DC2626] outline-none" />
        </div>
        <button onClick={load} className="p-2.5 border border-gray-200 rounded-xl hover:bg-gray-50">
          <RefreshCw size={14} className={loading ? 'animate-spin text-[#DC2626]' : 'text-[#64748B]'} />
        </button>
      </div>

      {/* Liste sinistres */}
      <div className="space-y-3">
        {loading ? (
          <div className="flex justify-center py-12"><RefreshCw className="animate-spin text-[#DC2626]" size={24} /></div>
        ) : displayed.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 py-16 text-center">
            <AlertTriangle size={36} className="text-gray-200 mx-auto mb-3" />
            <p className="text-sm text-[#94A3B8]">Aucun sinistre</p>
          </div>
        ) : displayed.map(s => {
          const wf   = getWf(s.statut)
          const next = NEXT_STATUT[s.statut]
          return (
            <div key={s.id}
              className={`bg-white rounded-2xl border overflow-hidden transition-all ${
                selected?.id === s.id ? 'border-[#DC2626]/30 shadow-md' : 'border-gray-100 hover:border-gray-200'
              }`}>
              <div className="flex items-start gap-4 p-4 cursor-pointer"
                onClick={() => setSelected(selected?.id === s.id ? null : s)}>
                {/* Indicateur statut */}
                <div className={`w-1.5 self-stretch rounded-full shrink-0 ${
                  s.statut === 'declare' ? 'bg-blue-400' :
                  s.statut === 'en_instruction' ? 'bg-yellow-400' :
                  s.statut === 'expertise' ? 'bg-purple-400' :
                  s.statut === 'accepte' ? 'bg-green-400' :
                  s.statut === 'refuse' ? 'bg-red-400' : 'bg-gray-300'
                }`} />

                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <span className="font-mono text-xs font-bold text-[#DC2626]">{s.numero_sinistre ?? '—'}</span>
                    <span className={`text-[10px] font-bold rounded-full px-2 py-0.5 ${wf.bg} ${wf.color}`}>{wf.label}</span>
                    {s.type_sinistre && <span className="text-[10px] bg-gray-100 text-[#374151] font-semibold px-2 py-0.5 rounded-lg">{s.type_sinistre}</span>}
                  </div>
                  <div className="text-sm font-semibold text-[#0F172A]">{s.ass_polices?.assure_nom ?? '—'}</div>
                  <div className="text-xs text-[#64748B] mt-0.5 truncate">{s.description}</div>
                  <div className="flex flex-wrap gap-4 mt-2 text-xs text-[#94A3B8]">
                    <span>Déclaré le {fmtDate(s.date_declaration)}</span>
                    {s.date_survenance && <span>Survenu le {fmtDate(s.date_survenance)}</span>}
                    {s.expert_nom && <span>Expert : {s.expert_nom}</span>}
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <div className="text-sm font-bold text-[#0F172A]">{fmt(s.montant_estime)} FCFA</div>
                  <div className="text-[10px] text-[#94A3B8]">estimé</div>
                  {s.montant_paye > 0 && (
                    <div className="text-xs font-semibold text-green-600 mt-0.5">{fmt(s.montant_paye)} payé</div>
                  )}
                </div>

                <ChevronRight size={16} className={`text-[#94A3B8] transition-transform shrink-0 ${selected?.id === s.id ? 'rotate-90' : ''}`} />
              </div>

              {/* Panel workflow étendu */}
              {selected?.id === s.id && (
                <div className="border-t border-gray-50 bg-gray-50/50 px-5 py-4">
                  {/* Barre progression workflow */}
                  <div className="flex items-center gap-1 mb-4 overflow-x-auto pb-1">
                    {WORKFLOW.filter(w => w.value !== 'refuse').map((w, i, arr) => {
                      const wfIdx      = WORKFLOW.findIndex(x => x.value === s.statut)
                      const thisIdx    = WORKFLOW.findIndex(x => x.value === w.value)
                      const isDone     = thisIdx < wfIdx
                      const isCurrent  = w.value === s.statut
                      return (
                        <div key={w.value} className="flex items-center gap-1 shrink-0">
                          <div className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold border ${
                            isCurrent ? `${w.bg} ${w.color} border-current` :
                            isDone    ? 'bg-green-50 text-green-600 border-green-200' :
                            'bg-white text-[#94A3B8] border-gray-200'
                          }`}>
                            {isDone ? <CheckCircle2 size={11} /> : isCurrent ? <Clock size={11} /> : null}
                            {w.label}
                          </div>
                          {i < arr.length - 1 && <ArrowRight size={12} className="text-gray-300 shrink-0" />}
                        </div>
                      )
                    })}
                  </div>

                  {/* Montants */}
                  <div className="grid grid-cols-3 gap-3 mb-4">
                    {[
                      { label: 'Montant estimé',   value: s.montant_estime,    color: 'text-[#0F172A]' },
                      { label: 'Après expertise',   value: s.montant_expertise, color: 'text-purple-600' },
                      { label: 'Montant réglé',     value: s.montant_paye,      color: 'text-green-600' },
                    ].map(m => (
                      <div key={m.label} className="bg-white rounded-xl p-3 border border-gray-100 text-center">
                        <div className={`text-base font-black ${m.color}`}>{fmt(m.value)}</div>
                        <div className="text-[10px] text-[#94A3B8]">{m.label}</div>
                      </div>
                    ))}
                  </div>

                  {/* Actions */}
                  <div className="flex flex-wrap gap-2">
                    {next && (
                      <button onClick={() => advanceStatut(s, next)}
                        className="inline-flex items-center gap-1.5 bg-[#DC2626] hover:bg-[#B91C1C] text-white text-xs font-bold px-4 py-2 rounded-xl transition-colors">
                        <ArrowRight size={13} />
                        Passer à : {getWf(next).label}
                      </button>
                    )}
                    {s.statut !== 'clos' && s.statut !== 'refuse' && (
                      <button onClick={() => advanceStatut(s, 'refuse', 'Sinistre refusé')}
                        className="inline-flex items-center gap-1.5 bg-white border border-red-200 text-red-600 text-xs font-semibold px-4 py-2 rounded-xl hover:bg-red-50 transition-colors">
                        <X size={13} /> Refuser
                      </button>
                    )}
                    <button
                      onClick={() => analyzeWithMIAA(s)}
                      disabled={miaaLoading[s.id]}
                      className="inline-flex items-center gap-1.5 bg-white border border-purple-200 text-purple-700 text-xs font-semibold px-4 py-2 rounded-xl hover:bg-purple-50 disabled:opacity-60 transition-colors">
                      {miaaLoading[s.id]
                        ? <RefreshCw size={12} className="animate-spin" />
                        : <Sparkles size={12} />}
                      Analyser avec MIAA+
                    </button>
                  </div>

                  {/* Résultat analyse MIAA+ */}
                  {miaaResults[s.id] && (() => {
                    const r = miaaResults[s.id]
                    const niveauCfg = {
                      faible: { bg: 'bg-green-50', border: 'border-green-200', text: 'text-green-700', label: 'Risque faible' },
                      moyen:  { bg: 'bg-yellow-50', border: 'border-yellow-200', text: 'text-yellow-700', label: 'Risque moyen — investigation' },
                      eleve:  { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-700', label: 'Risque élevé — expertise requise' },
                    }[r.niveau]
                    return (
                      <div className={`mt-3 rounded-2xl border p-4 ${niveauCfg.bg} ${niveauCfg.border}`}>
                        <div className="flex items-center gap-2 mb-2">
                          <Sparkles size={13} className="text-purple-600" />
                          <span className="text-xs font-black text-[#0F172A]">Analyse MIAA+ — Score fraude</span>
                          <span className={`ml-auto text-xs font-black px-2 py-0.5 rounded-full ${niveauCfg.bg} ${niveauCfg.text}`}>
                            {r.score}/100 · {niveauCfg.label}
                          </span>
                        </div>
                        {r.facteurs.length > 0 && (
                          <div className="mb-2">
                            <div className="text-[10px] font-bold text-[#64748B] uppercase tracking-wide mb-1">Facteurs détectés</div>
                            <ul className="space-y-0.5">
                              {r.facteurs.map((f, i) => (
                                <li key={i} className="flex items-start gap-1.5 text-xs text-[#374151]">
                                  <AlertCircle size={10} className={`shrink-0 mt-0.5 ${niveauCfg.text}`} />{f}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                        <div className="text-xs text-[#374151] mb-2">{r.justification}</div>
                        <div className={`inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-xl ${niveauCfg.bg} ${niveauCfg.text} border ${niveauCfg.border}`}>
                          <CheckCircle2 size={11} /> Recommandation : {r.recommandation}
                        </div>
                      </div>
                    )
                  })()}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Modal déclaration */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="font-black text-[#0F172A] text-base flex items-center gap-2">
                <AlertTriangle className="text-orange-500" size={18} /> Déclarer un sinistre
              </h2>
              <button onClick={() => setShowModal(false)} className="p-2 hover:bg-gray-100 rounded-lg"><X size={16} /></button>
            </div>

            <div className="p-6 space-y-4">
              {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-2 rounded-xl">{error}</div>}

              <div>
                <label className="text-xs font-bold text-[#374151] uppercase tracking-wide mb-1.5 block">N° Police *</label>
                <input value={form.police_id} onChange={e => setForm(f => ({ ...f, police_id: e.target.value }))}
                  placeholder="UUID de la police"
                  className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:border-[#DC2626] outline-none" />
              </div>

              <div>
                <label className="text-xs font-bold text-[#374151] uppercase tracking-wide mb-1.5 block">Type de sinistre</label>
                <input value={form.type_sinistre} onChange={e => setForm(f => ({ ...f, type_sinistre: e.target.value }))}
                  placeholder="Accident, incendie, vol..."
                  className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:border-[#DC2626] outline-none" />
              </div>

              <div>
                <label className="text-xs font-bold text-[#374151] uppercase tracking-wide mb-1.5 block">Description</label>
                <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  rows={3} placeholder="Décrire les circonstances..."
                  className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:border-[#DC2626] outline-none resize-none" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-[#374151] uppercase tracking-wide mb-1.5 block">Date déclaration</label>
                  <input type="date" value={form.date_declaration} onChange={e => setForm(f => ({ ...f, date_declaration: e.target.value }))}
                    className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:border-[#DC2626] outline-none" />
                </div>
                <div>
                  <label className="text-xs font-bold text-[#374151] uppercase tracking-wide mb-1.5 block">Date survenance</label>
                  <input type="date" value={form.date_survenance} onChange={e => setForm(f => ({ ...f, date_survenance: e.target.value }))}
                    className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:border-[#DC2626] outline-none" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-[#374151] uppercase tracking-wide mb-1.5 block">Montant estimé (FCFA)</label>
                  <input type="number" value={form.montant_estime} onChange={e => setForm(f => ({ ...f, montant_estime: +e.target.value }))}
                    className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:border-[#DC2626] outline-none" />
                </div>
                <div>
                  <label className="text-xs font-bold text-[#374151] uppercase tracking-wide mb-1.5 block">Expert désigné</label>
                  <input value={form.expert_nom} onChange={e => setForm(f => ({ ...f, expert_nom: e.target.value }))}
                    placeholder="Nom de l'expert"
                    className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:border-[#DC2626] outline-none" />
                </div>
              </div>
            </div>

            <div className="flex gap-3 px-6 py-4 border-t border-gray-100">
              <button onClick={() => setShowModal(false)} className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-semibold hover:bg-gray-50">Annuler</button>
              <button onClick={handleCreate} disabled={saving}
                className="flex-1 py-2.5 bg-[#DC2626] hover:bg-[#B91C1C] disabled:opacity-60 text-white text-sm font-bold rounded-xl inline-flex items-center justify-center gap-2">
                {saving ? <RefreshCw size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                Enregistrer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

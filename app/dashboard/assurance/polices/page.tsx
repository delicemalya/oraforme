'use client'

import { useState, useEffect, useCallback } from 'react'
import { useTenantContext } from '@/lib/contexts/TenantContext'
import {
  Shield, Plus, Search, RefreshCw, X,
  FileText, ChevronDown,
  CheckCircle2, Sparkles,
} from 'lucide-react'

// ── Types ─────────────────────────────────────────────────────────────────────

interface Police {
  id: string
  numero_police: string
  type_police: string
  assure_nom: string
  assure_email: string
  assure_telephone: string
  assure_type: string
  prime_montant: number
  prime_frequence: string
  capital_assure: number
  franchise: number
  date_effet: string
  date_echeance: string
  statut: string
  notes: string
  created_at: string
  ass_agents?: { nom: string; prenom: string; type_agent: string } | null
}

// ── Constants ─────────────────────────────────────────────────────────────────

const TYPES_POLICE = [
  { value: 'auto',                  label: 'Auto'               },
  { value: 'vie',                   label: 'Vie'                },
  { value: 'habitation',            label: 'Habitation'         },
  { value: 'sante',                 label: 'Santé'              },
  { value: 'responsabilite_civile', label: 'RC'                 },
  { value: 'transport',             label: 'Transport'          },
  { value: 'agricole',              label: 'Agricole'           },
  { value: 'maritime',              label: 'Maritime'           },
  { value: 'aviation',              label: 'Aviation'           },
  { value: 'voyage',                label: 'Voyage'             },
  { value: 'incendie',              label: 'Incendie'           },
]

const STATUTS = [
  { value: 'active',     label: 'Active',      color: 'bg-green-100 text-green-700'   },
  { value: 'en_attente', label: 'En attente',  color: 'bg-blue-100 text-blue-700'     },
  { value: 'suspendue',  label: 'Suspendue',   color: 'bg-yellow-100 text-yellow-700' },
  { value: 'resiliee',   label: 'Résiliée',    color: 'bg-red-100 text-red-700'       },
  { value: 'expiree',    label: 'Expirée',     color: 'bg-gray-100 text-gray-600'     },
]

const FREQUENCES = ['mensuelle','trimestrielle','semestrielle','annuelle']

const fmt = (n: number) => new Intl.NumberFormat('fr-FR').format(Math.round(n))
const fmtDate = (d: string) => d ? new Date(d).toLocaleDateString('fr-FR') : '—'
const getStatut = (s: string) => STATUTS.find(x => x.value === s) ?? STATUTS[0]
const getType   = (t: string) => TYPES_POLICE.find(x => x.value === t)?.label ?? t

const EMPTY: Omit<Police,'id'|'numero_police'|'created_at'|'ass_agents'> = {
  type_police: 'auto', assure_nom: '', assure_email: '', assure_telephone: '',
  assure_type: 'particulier', prime_montant: 0, prime_frequence: 'annuelle',
  capital_assure: 0, franchise: 0,
  date_effet: new Date().toISOString().split('T')[0],
  date_echeance: new Date(Date.now() + 365*86400000).toISOString().split('T')[0],
  statut: 'en_attente', notes: '',
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function PoliciesPage() {
  const { tenant } = useTenantContext()
  const tenantId = tenant?.tenantId ?? ''
  const [polices,  setPolices]  = useState<Police[]>([])
  const [loading,  setLoading]  = useState(true)
  const [saving,   setSaving]   = useState(false)
  const [search,   setSearch]   = useState('')
  const [filterStatut, setFilterStatut] = useState('')
  const [filterType,   setFilterType]   = useState('')
  const [showModal,    setShowModal]    = useState(false)
  const [editing,      setEditing]      = useState<Police | null>(null)
  const [form,         setForm]         = useState({ ...EMPTY })
  const [error,           setError]          = useState('')
  const [miaaSuggestion,  setMiaaSuggestion]  = useState<string | null>(null)
  const [miaaLoading,     setMiaaLoading]     = useState(false)

  const getMiaaSuggestion = async () => {
    setMiaaLoading(true)
    setMiaaSuggestion(null)
    try {
      const prompt = `Tu es MIAA Expert Assurance. Voici un profil de risque pour une nouvelle police.
Type police : ${form.type_police}
Type assuré : ${form.assure_type}
Prime saisie : ${form.prime_montant} FCFA / ${form.prime_frequence}
Capital assuré : ${form.capital_assure} FCFA
Franchise : ${form.franchise} FCFA
Durée : ${form.date_effet} → ${form.date_echeance}

Donne une recommandation courte (3-4 phrases, sans markdown) sur :
1. Si la prime est cohérente avec le profil
2. Une prime suggérée si elle semble trop basse ou trop haute
3. Une alerte si garanties ou conditions semblent incohérentes`

      const res  = await fetch('/api/miaa/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ module: 'assurance', message: prompt, tenantData: { secteur: 'assurance' } }),
      })
      const data = await res.json()
      setMiaaSuggestion(data.response ?? 'Analyse non disponible.')
    } catch {
      setMiaaSuggestion('Impossible de contacter MIAA+.')
    } finally {
      setMiaaLoading(false)
    }
  }

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (filterStatut) params.set('statut', filterStatut)
      if (filterType)   params.set('type', filterType)
      if (search)       params.set('search', search)
      const res  = await fetch(`/api/assurance/polices?${params}`)
      const json = await res.json()
      setPolices(json.data ?? [])
    } finally { setLoading(false) }
  }, [filterStatut, filterType, search])

  useEffect(() => { if (tenantId) load() }, [tenantId, load])

  const openCreate = () => { setEditing(null); setForm({ ...EMPTY }); setError(''); setShowModal(true) }
  const openEdit   = (p: Police) => { setEditing(p); setForm({ ...p }); setError(''); setShowModal(true) }

  const handleSave = async () => {
    if (!form.assure_nom.trim()) { setError('Nom de l\'assuré requis'); return }
    if (!form.date_effet || !form.date_echeance) { setError('Dates requises'); return }
    setSaving(true); setError('')
    try {
      const method = editing ? 'PUT' : 'POST'
      const body   = editing ? { id: editing.id, ...form } : form
      const res    = await fetch('/api/assurance/polices', { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      if (!res.ok) { const j = await res.json(); setError(j.error ?? 'Erreur'); return }
      setShowModal(false); load()
    } finally { setSaving(false) }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Supprimer cette police ?')) return
    await fetch(`/api/assurance/polices?id=${id}`, { method: 'DELETE' })
    load()
  }

  const changeStatut = async (id: string, statut: string) => {
    await fetch('/api/assurance/polices', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, statut }),
    })
    load()
  }

  const displayed = polices.filter(p =>
    !search || p.assure_nom.toLowerCase().includes(search.toLowerCase()) || p.numero_police?.includes(search)
  )

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-black text-[#0F172A] flex items-center gap-2">
            <FileText className="text-[#DC2626]" size={22} /> Polices d&apos;assurance
          </h1>
          <p className="text-sm text-[#64748B]">{polices.length} police{polices.length !== 1 ? 's' : ''} · {polices.filter(p => p.statut === 'active').length} actives</p>
        </div>
        <button onClick={openCreate}
          className="inline-flex items-center gap-1.5 bg-[#DC2626] hover:bg-[#B91C1C] text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors">
          <Plus size={15} /> Nouvelle police
        </button>
      </div>

      {/* Filtres */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher assuré, numéro..."
            className="w-full pl-9 pr-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:border-[#DC2626] outline-none" />
        </div>
        <select value={filterStatut} onChange={e => setFilterStatut(e.target.value)}
          className="px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:border-[#DC2626] outline-none bg-white">
          <option value="">Tous les statuts</option>
          {STATUTS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
        <select value={filterType} onChange={e => setFilterType(e.target.value)}
          className="px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:border-[#DC2626] outline-none bg-white">
          <option value="">Tous les types</option>
          {TYPES_POLICE.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
        <button onClick={load} className="p-2.5 border border-gray-200 rounded-xl hover:bg-gray-50">
          <RefreshCw size={14} className={loading ? 'animate-spin text-[#DC2626]' : 'text-[#64748B]'} />
        </button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="text-left px-4 py-3 text-xs font-bold text-[#64748B] uppercase tracking-wide">Police</th>
                <th className="text-left px-4 py-3 text-xs font-bold text-[#64748B] uppercase tracking-wide">Assuré</th>
                <th className="text-left px-4 py-3 text-xs font-bold text-[#64748B] uppercase tracking-wide">Type</th>
                <th className="text-right px-4 py-3 text-xs font-bold text-[#64748B] uppercase tracking-wide">Prime</th>
                <th className="text-left px-4 py-3 text-xs font-bold text-[#64748B] uppercase tracking-wide">Effet</th>
                <th className="text-left px-4 py-3 text-xs font-bold text-[#64748B] uppercase tracking-wide">Échéance</th>
                <th className="text-center px-4 py-3 text-xs font-bold text-[#64748B] uppercase tracking-wide">Statut</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr><td colSpan={8} className="py-12 text-center"><RefreshCw className="animate-spin mx-auto text-[#DC2626]" size={20} /></td></tr>
              ) : displayed.length === 0 ? (
                <tr><td colSpan={8} className="py-12 text-center text-sm text-[#94A3B8]">Aucune police trouvée</td></tr>
              ) : displayed.map(p => {
                const st = getStatut(p.statut)
                return (
                  <tr key={p.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-mono text-xs font-bold text-[#DC2626]">{p.numero_police ?? '—'}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-semibold text-[#0F172A] text-sm">{p.assure_nom}</div>
                      <div className="text-xs text-[#94A3B8]">{p.assure_telephone}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="bg-gray-100 text-[#374151] text-xs font-semibold px-2 py-0.5 rounded-lg">{getType(p.type_police)}</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="font-bold text-[#0F172A]">{fmt(p.prime_montant)}</div>
                      <div className="text-[10px] text-[#94A3B8]">FCFA / {p.prime_frequence}</div>
                    </td>
                    <td className="px-4 py-3 text-xs text-[#64748B]">{fmtDate(p.date_effet)}</td>
                    <td className="px-4 py-3 text-xs text-[#64748B]">{fmtDate(p.date_echeance)}</td>
                    <td className="px-4 py-3 text-center">
                      <div className="relative group inline-block">
                        <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full cursor-pointer inline-flex items-center gap-1 ${st.color}`}>
                          {st.label} <ChevronDown size={10} />
                        </span>
                        <div className="absolute z-10 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg hidden group-hover:block min-w-[130px]">
                          {STATUTS.map(s => (
                            <button key={s.value} onClick={() => changeStatut(p.id, s.value)}
                              className={`w-full text-left px-3 py-2 text-xs hover:bg-gray-50 ${s.value === p.statut ? 'font-bold' : ''}`}>
                              {s.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 justify-end">
                        <button onClick={() => openEdit(p)} className="p-1.5 hover:bg-blue-50 hover:text-blue-600 rounded-lg transition-colors text-[#64748B]" title="Modifier">
                          <FileText size={13} />
                        </button>
                        <button onClick={() => handleDelete(p.id)} className="p-1.5 hover:bg-red-50 hover:text-red-500 rounded-lg transition-colors text-[#64748B]" title="Supprimer">
                          <X size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Création / Édition */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="font-black text-[#0F172A] text-base flex items-center gap-2">
                <Shield className="text-[#DC2626]" size={18} />
                {editing ? 'Modifier la police' : 'Nouvelle police'}
              </h2>
              <button onClick={() => setShowModal(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X size={16} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-2 rounded-xl">{error}</div>}

              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-[#374151] uppercase tracking-wide mb-1.5 block">Type de police *</label>
                  <select value={form.type_police} onChange={e => setForm(f => ({ ...f, type_police: e.target.value }))}
                    className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:border-[#DC2626] outline-none bg-white">
                    {TYPES_POLICE.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-[#374151] uppercase tracking-wide mb-1.5 block">Type d&apos;assuré</label>
                  <select value={form.assure_type} onChange={e => setForm(f => ({ ...f, assure_type: e.target.value }))}
                    className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:border-[#DC2626] outline-none bg-white">
                    <option value="particulier">Particulier</option>
                    <option value="entreprise">Entreprise</option>
                    <option value="groupe">Groupe</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-[#374151] uppercase tracking-wide mb-1.5 block">Nom de l&apos;assuré *</label>
                <input value={form.assure_nom} onChange={e => setForm(f => ({ ...f, assure_nom: e.target.value }))}
                  placeholder="Nom complet ou raison sociale"
                  className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:border-[#DC2626] outline-none" />
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-[#374151] uppercase tracking-wide mb-1.5 block">Email</label>
                  <input value={form.assure_email} onChange={e => setForm(f => ({ ...f, assure_email: e.target.value }))}
                    type="email" placeholder="email@exemple.com"
                    className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:border-[#DC2626] outline-none" />
                </div>
                <div>
                  <label className="text-xs font-bold text-[#374151] uppercase tracking-wide mb-1.5 block">Téléphone</label>
                  <input value={form.assure_telephone} onChange={e => setForm(f => ({ ...f, assure_telephone: e.target.value }))}
                    placeholder="+242..."
                    className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:border-[#DC2626] outline-none" />
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-[#374151] uppercase tracking-wide mb-1.5 block">Date d&apos;effet *</label>
                  <input type="date" value={form.date_effet} onChange={e => setForm(f => ({ ...f, date_effet: e.target.value }))}
                    className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:border-[#DC2626] outline-none" />
                </div>
                <div>
                  <label className="text-xs font-bold text-[#374151] uppercase tracking-wide mb-1.5 block">Date d&apos;échéance *</label>
                  <input type="date" value={form.date_echeance} onChange={e => setForm(f => ({ ...f, date_echeance: e.target.value }))}
                    className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:border-[#DC2626] outline-none" />
                </div>
              </div>

              <div className="grid sm:grid-cols-3 gap-4">
                <div>
                  <label className="text-xs font-bold text-[#374151] uppercase tracking-wide mb-1.5 block">Prime (FCFA) *</label>
                  <input type="number" value={form.prime_montant} onChange={e => setForm(f => ({ ...f, prime_montant: +e.target.value }))}
                    className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:border-[#DC2626] outline-none" />
                </div>
                <div>
                  <label className="text-xs font-bold text-[#374151] uppercase tracking-wide mb-1.5 block">Fréquence</label>
                  <select value={form.prime_frequence} onChange={e => setForm(f => ({ ...f, prime_frequence: e.target.value }))}
                    className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:border-[#DC2626] outline-none bg-white">
                    {FREQUENCES.map(fr => <option key={fr} value={fr}>{fr}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-[#374151] uppercase tracking-wide mb-1.5 block">Capital assuré</label>
                  <input type="number" value={form.capital_assure} onChange={e => setForm(f => ({ ...f, capital_assure: +e.target.value }))}
                    className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:border-[#DC2626] outline-none" />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-[#374151] uppercase tracking-wide mb-1.5 block">Franchise (FCFA)</label>
                <input type="number" value={form.franchise} onChange={e => setForm(f => ({ ...f, franchise: +e.target.value }))}
                  className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:border-[#DC2626] outline-none" />
              </div>

              {/* MIAA+ Suggestion prime */}
              <div className="border border-purple-100 rounded-2xl p-4 bg-purple-50/50">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-purple-700 flex items-center gap-1.5"><Sparkles size={12} /> Suggestion MIAA+</span>
                  <button onClick={getMiaaSuggestion} disabled={miaaLoading || !form.assure_nom}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded-xl transition-colors">
                    {miaaLoading ? <RefreshCw size={11} className="animate-spin" /> : <Sparkles size={11} />}
                    {miaaLoading ? 'Analyse...' : 'Analyser le profil'}
                  </button>
                </div>
                {miaaSuggestion ? (
                  <p className="text-xs text-[#374151] leading-relaxed whitespace-pre-line">{miaaSuggestion}</p>
                ) : (
                  <p className="text-xs text-[#94A3B8]">Cliquez sur &quot;Analyser le profil&quot; pour obtenir une recommandation de prime basée sur le risque saisi.</p>
                )}
              </div>

              <div>
                <label className="text-xs font-bold text-[#374151] uppercase tracking-wide mb-1.5 block">Statut</label>
                <select value={form.statut} onChange={e => setForm(f => ({ ...f, statut: e.target.value }))}
                  className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:border-[#DC2626] outline-none bg-white">
                  {STATUTS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-[#374151] uppercase tracking-wide mb-1.5 block">Notes</label>
                <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  rows={2} placeholder="Remarques, conditions particulières..."
                  className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:border-[#DC2626] outline-none resize-none" />
              </div>
            </div>

            <div className="flex gap-3 px-6 py-4 border-t border-gray-100">
              <button onClick={() => setShowModal(false)} className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-semibold hover:bg-gray-50">
                Annuler
              </button>
              <button onClick={handleSave} disabled={saving}
                className="flex-1 py-2.5 bg-[#DC2626] hover:bg-[#B91C1C] disabled:opacity-60 text-white text-sm font-bold rounded-xl transition-colors inline-flex items-center justify-center gap-2">
                {saving ? <RefreshCw size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                {editing ? 'Enregistrer' : 'Créer la police'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

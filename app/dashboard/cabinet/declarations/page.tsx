'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import {
  ArrowLeft, Calendar, AlertTriangle, CheckCircle2, Clock,
  Plus, RefreshCw, Loader2, X, Sparkles, Filter,
  ChevronDown, FileText, DollarSign,
} from 'lucide-react'

// ── Types ─────────────────────────────────────────────────────────────────────

interface Declaration {
  id: string
  client_id: string
  type_declaration: string
  periode_mois: number | null
  periode_annee: number
  date_limite: string
  date_soumise: string | null
  montant_declare: number | null
  montant_paye: number | null
  statut: string
  reference_externe: string | null
  notes: string | null
  alerte_j_avant: number
  cabinet_clients: { id: string; nom_entreprise: string; secteur_activite: string | null; pays: string | null } | null
}

interface Stats {
  total: number; a_faire: number; en_cours: number
  soumises: number; retard: number; urgentes: number
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const TYPE_LABELS: Record<string, string> = {
  tva_mensuelle:      'TVA mensuelle',
  tva_trimestrielle:  'TVA trimestrielle',
  cnss_mensuelle:     'CNSS mensuelle',
  cnss_trimestrielle: 'CNSS trimestrielle',
  irpp_annuel:        'IRPP annuel',
  is_annuel:          'IS annuel',
  is_acompte:         'Acompte IS',
  patente_annuelle:   'Patente annuelle',
  bilan_annuel:       'Bilan annuel',
  compte_resultat:    'Compte de résultat',
  declaration_loyer:  'Décl. loyer',
  retenue_source:     'Retenue à la source',
  autre:              'Autre',
}

const STATUT_CFG: Record<string, { label: string; bg: string; text: string }> = {
  a_faire:  { label: 'À faire',   bg: '#F1F5F9', text: '#64748B' },
  en_cours: { label: 'En cours',  bg: '#EFF6FF', text: '#2563EB' },
  soumise:  { label: 'Soumise',   bg: '#FFFBEB', text: '#D97706' },
  payee:    { label: 'Payée',     bg: '#F0FDF4', text: '#16A34A' },
  retard:   { label: 'En retard', bg: '#FEF2F2', text: '#DC2626' },
  annulee:  { label: 'Annulée',   bg: '#F8FAFC', text: '#94A3B8' },
}

const MOIS = ['Jan','Fév','Mar','Avr','Mai','Jun','Jul','Aoû','Sep','Oct','Nov','Déc']

function jourRestants(dateStr: string) {
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86_400_000)
}

function niveauUrgence(d: Declaration) {
  if (d.statut === 'payee' || d.statut === 'annulee') return 'ok'
  const j = jourRestants(d.date_limite)
  if (j < 0)  return 'retard'
  if (j <= 3)  return 'critique'
  if (j <= 7)  return 'urgent'
  if (j <= 15) return 'attention'
  return 'ok'
}

function urgenceColor(n: string) {
  const m: Record<string, string> = {
    retard: '#DC2626', critique: '#DC2626', urgent: '#F59E0B',
    attention: '#D97706', ok: '#94A3B8',
  }
  return m[n] ?? '#94A3B8'
}

function fmtDate(s: string | null) {
  if (!s) return '—'
  return new Date(s).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
}

function fmt(n: number | null) {
  if (n == null) return '—'
  return new Intl.NumberFormat('fr-FR').format(Math.round(n)) + ' FCFA'
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function DeclarationsPage() {
  const [declarations, setDeclarations] = useState<Declaration[]>([])
  const [stats,        setStats]        = useState<Stats | null>(null)
  const [loading,      setLoading]      = useState(true)
  const [generating,   setGenerating]   = useState(false)
  const [filterStatut, setFilterStatut] = useState('')
  const [filterAnnee,  setFilterAnnee]  = useState(new Date().getFullYear())
  const [search,       setSearch]       = useState('')
  const [showNewForm,  setShowNewForm]  = useState(false)
  const [editId,       setEditId]       = useState<string | null>(null)
  const [editPatch,    setEditPatch]    = useState<Record<string, string>>({})
  const [saving,       setSaving]       = useState(false)
  const [successMsg,   setSuccessMsg]   = useState('')
  const [openMenuId,   setOpenMenuId]   = useState<string | null>(null)

  // New declaration form
  const [newForm, setNewForm] = useState({
    client_id: '', type_declaration: 'tva_mensuelle', periode_mois: '',
    periode_annee: String(new Date().getFullYear()),
    date_limite: '', montant_declare: '', statut: 'a_faire', notes: '',
  })
  const [clients, setClients] = useState<{ id: string; nom_entreprise: string }[]>([])

  const load = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams({ annee: String(filterAnnee) })
    if (filterStatut) params.set('statut', filterStatut)
    const res = await fetch(`/api/cabinet/declarations?${params}`)
    if (res.ok) {
      const { declarations: d, stats: s } = await res.json()
      setDeclarations(d)
      setStats(s)
    }
    setLoading(false)
  }, [filterAnnee, filterStatut])

  const loadClients = useCallback(async () => {
    const res = await fetch('/api/cabinet/clients')
    if (res.ok) {
      const { clients: c } = await res.json()
      setClients(c ?? [])
    }
  }, [])

  useEffect(() => { load(); loadClients() }, [load, loadClients])

  function ok(msg: string) { setSuccessMsg(msg); setTimeout(() => setSuccessMsg(''), 3000) }

  async function genererAgenda() {
    setGenerating(true)
    const res = await fetch('/api/cabinet/declarations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'generer_agenda', annee: filterAnnee }),
    })
    setGenerating(false)
    if (res.ok) {
      const { nb_genere } = await res.json()
      ok(`${nb_genere} déclaration(s) générée(s) pour ${filterAnnee}`)
      load()
    }
  }

  async function saveNew(e: React.FormEvent) {
    e.preventDefault(); setSaving(true)
    const res = await fetch('/api/cabinet/declarations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...newForm,
        periode_mois:   newForm.periode_mois ? Number(newForm.periode_mois) : null,
        periode_annee:  Number(newForm.periode_annee),
        montant_declare: newForm.montant_declare ? Number(newForm.montant_declare) : null,
      }),
    })
    setSaving(false)
    if (res.ok) {
      setShowNewForm(false)
      setNewForm({ client_id: '', type_declaration: 'tva_mensuelle', periode_mois: '', periode_annee: String(new Date().getFullYear()), date_limite: '', montant_declare: '', statut: 'a_faire', notes: '' })
      ok('Déclaration ajoutée')
      load()
    }
  }

  async function patchDecl(id: string, patch: Record<string, string | number | null>) {
    setSaving(true)
    await fetch('/api/cabinet/declarations', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, ...patch }),
    })
    setSaving(false); setEditId(null); setEditPatch({})
    load()
  }

  async function updateStatut(id: string, statut: string) {
    await fetch('/api/cabinet/declarations', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, statut }),
    })
    setOpenMenuId(null)
    load()
  }

  const filtered = declarations.filter(d => {
    if (!search) return true
    const nom = d.cabinet_clients?.nom_entreprise?.toLowerCase() ?? ''
    const type = TYPE_LABELS[d.type_declaration]?.toLowerCase() ?? ''
    const q = search.toLowerCase()
    return nom.includes(q) || type.includes(q)
  })

  const annees = [filterAnnee - 1, filterAnnee, filterAnnee + 1]

  return (
    <div className="min-h-screen bg-[#F8FAFC] pb-20">

      {/* Header */}
      <div className="bg-white border-b border-[#E2E8F0] px-4 sm:px-6 py-4">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-1">
            <div className="flex items-center gap-3">
              <Link href="/dashboard/cabinet" className="flex items-center gap-1 text-[#64748B] hover:text-[#0F172A] text-[13px]">
                <ArrowLeft size={14} /> Cabinet
              </Link>
              <span className="text-[#E2E8F0]">/</span>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center">
                  <Calendar size={15} className="text-amber-700" />
                </div>
                <h1 className="text-[16px] font-black text-[#0F172A]">Agenda des Déclarations</h1>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button onClick={load} className="p-2 border border-[#E2E8F0] rounded-xl text-[#64748B] hover:bg-[#F8FAFC]">
                <RefreshCw size={13} />
              </button>
              <button onClick={genererAgenda} disabled={generating}
                className="flex items-center gap-1.5 px-3 py-2 border border-amber-300 bg-amber-50 text-amber-700 rounded-xl text-[12px] font-bold hover:bg-amber-100 disabled:opacity-50">
                {generating ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                Générer agenda {filterAnnee}
              </button>
              <button onClick={() => setShowNewForm(true)}
                className="flex items-center gap-1.5 px-3 py-2 bg-amber-500 text-white rounded-xl text-[12px] font-bold hover:bg-amber-600">
                <Plus size={12} /> Ajouter
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-5">

        {/* Success */}
        {successMsg && (
          <div className="flex items-center gap-2 px-4 py-3 bg-green-50 border border-green-200 rounded-xl text-[13px] font-semibold text-green-700">
            <CheckCircle2 size={15} /> {successMsg}
          </div>
        )}

        {/* KPIs */}
        {stats && (
          <div className="grid grid-cols-3 lg:grid-cols-6 gap-3">
            {[
              { label: 'Total',     value: stats.total,     color: '#0F172A', icon: FileText },
              { label: 'À faire',   value: stats.a_faire,   color: '#64748B', icon: Clock },
              { label: 'En cours',  value: stats.en_cours,  color: '#2563EB', icon: Clock },
              { label: 'Soumises',  value: stats.soumises,  color: '#D97706', icon: CheckCircle2 },
              { label: 'En retard', value: stats.retard,    color: '#DC2626', icon: AlertTriangle },
              { label: 'Urgentes',  value: stats.urgentes,  color: '#F59E0B', icon: AlertTriangle },
            ].map(k => {
              const Icon = k.icon
              return (
                <div key={k.label} className="bg-white rounded-2xl p-3 border border-[#E2E8F0] shadow-sm">
                  <div className="flex items-center gap-1.5 mb-1">
                    <Icon size={11} style={{ color: k.color }} />
                    <span className="text-[10px] font-bold text-[#64748B] uppercase tracking-wide">{k.label}</span>
                  </div>
                  <p className="text-[22px] font-black" style={{ color: k.color }}>{k.value}</p>
                </div>
              )
            })}
          </div>
        )}

        {/* Filtres */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Année */}
          <div className="flex items-center gap-1 bg-white border border-[#E2E8F0] rounded-xl overflow-hidden">
            {annees.map(a => (
              <button key={a} onClick={() => setFilterAnnee(a)}
                className={`px-3 py-1.5 text-[12px] font-bold transition-all ${filterAnnee === a ? 'bg-amber-500 text-white' : 'text-[#64748B] hover:bg-[#F8FAFC]'}`}>
                {a}
              </button>
            ))}
          </div>

          {/* Statut */}
          <select value={filterStatut} onChange={e => setFilterStatut(e.target.value)}
            className="px-3 py-1.5 text-[12px] border border-[#E2E8F0] rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-amber-300 text-[#475569]">
            <option value="">Tous les statuts</option>
            {Object.entries(STATUT_CFG).map(([v, c]) => <option key={v} value={v}>{c.label}</option>)}
          </select>

          {/* Recherche */}
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Chercher client ou type..."
            className="flex-1 min-w-[160px] px-3 py-1.5 text-[12px] border border-[#E2E8F0] rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-300" />
        </div>

        {/* Tableau */}
        {loading ? (
          <div className="flex justify-center py-16 text-[#94A3B8] gap-2">
            <Loader2 size={18} className="animate-spin" /> Chargement...
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-2xl border border-dashed border-[#CBD5E1] p-16 text-center">
            <Calendar size={40} className="text-[#CBD5E1] mx-auto mb-3" />
            <p className="font-bold text-[#0F172A] mb-1">Aucune déclaration trouvée</p>
            <p className="text-[13px] text-[#64748B] mb-4">
              Utilisez «&thinsp;Générer agenda {filterAnnee}&thinsp;» pour créer automatiquement toutes les déclarations de vos clients actifs.
            </p>
            <button onClick={genererAgenda} disabled={generating}
              className="inline-flex items-center gap-2 px-4 py-2 bg-amber-500 text-white rounded-xl text-[13px] font-bold hover:bg-amber-600 disabled:opacity-50">
              {generating ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
              Générer l'agenda {filterAnnee}
            </button>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
                    {['Client','Type','Période','Échéance','Montant','Statut','Actions'].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-[11px] font-bold text-[#64748B] uppercase tracking-wide whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F1F5F9]">
                  {filtered.map(d => {
                    const niveau = niveauUrgence(d)
                    const j      = jourRestants(d.date_limite)
                    const sc     = STATUT_CFG[d.statut] ?? STATUT_CFG.a_faire
                    const isEdit = editId === d.id

                    return (
                      <tr key={d.id} className={`hover:bg-[#F8FAFC] ${niveau === 'retard' ? 'bg-red-50/30' : niveau === 'critique' ? 'bg-red-50/20' : ''}`}>

                        {/* Client */}
                        <td className="px-4 py-3">
                          {d.cabinet_clients ? (
                            <Link href={`/dashboard/cabinet/clients/${d.cabinet_clients.id}`}
                              className="font-semibold text-[13px] text-[#0F172A] hover:text-amber-700 hover:underline">
                              {d.cabinet_clients.nom_entreprise}
                            </Link>
                          ) : <span className="text-[#94A3B8] text-[12px]">—</span>}
                        </td>

                        {/* Type */}
                        <td className="px-4 py-3">
                          <span className="text-[12px] text-[#475569]">{TYPE_LABELS[d.type_declaration] ?? d.type_declaration}</span>
                        </td>

                        {/* Période */}
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className="text-[12px] text-[#64748B]">
                            {d.periode_mois ? `${MOIS[d.periode_mois - 1]} ${d.periode_annee}` : String(d.periode_annee)}
                          </span>
                        </td>

                        {/* Échéance */}
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div>
                            <p className="text-[12px] font-semibold" style={{ color: urgenceColor(niveau) }}>
                              {fmtDate(d.date_limite)}
                            </p>
                            {d.statut !== 'payee' && d.statut !== 'annulee' && (
                              <p className="text-[10px]" style={{ color: urgenceColor(niveau) }}>
                                {j < 0 ? `J+${Math.abs(j)} retard` : j === 0 ? 'Aujourd\'hui !' : `J-${j}`}
                              </p>
                            )}
                          </div>
                        </td>

                        {/* Montant */}
                        <td className="px-4 py-3 whitespace-nowrap">
                          {isEdit ? (
                            <input type="number" placeholder="Montant HT"
                              value={editPatch.montant_declare ?? d.montant_declare ?? ''}
                              onChange={e => setEditPatch(p => ({ ...p, montant_declare: e.target.value }))}
                              className="w-28 px-2 py-1 text-[12px] border border-amber-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-amber-300" />
                          ) : (
                            <span className="text-[12px] tabular-nums text-[#475569]">{fmt(d.montant_declare)}</span>
                          )}
                        </td>

                        {/* Statut */}
                        <td className="px-4 py-3">
                          <div className="relative">
                            <button onClick={() => setOpenMenuId(openMenuId === d.id ? null : d.id)}
                              className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-bold cursor-pointer hover:opacity-80"
                              style={{ background: sc.bg, color: sc.text }}>
                              {sc.label} <ChevronDown size={10} />
                            </button>
                            {openMenuId === d.id && (
                              <div className="absolute top-full left-0 z-20 mt-1 bg-white border border-[#E2E8F0] rounded-xl shadow-lg overflow-hidden min-w-[130px]">
                                {Object.entries(STATUT_CFG).map(([v, c]) => (
                                  <button key={v} onClick={() => updateStatut(d.id, v)}
                                    className="w-full text-left px-3 py-2 text-[12px] font-semibold hover:bg-[#F8FAFC] transition-colors"
                                    style={{ color: c.text }}>
                                    {c.label}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        </td>

                        {/* Actions */}
                        <td className="px-4 py-3">
                          {isEdit ? (
                            <div className="flex gap-1">
                              <button onClick={() => patchDecl(d.id, {
                                montant_declare: editPatch.montant_declare != null ? String(editPatch.montant_declare) : String(d.montant_declare),
                                reference_externe: editPatch.reference_externe ?? d.reference_externe ?? '',
                                notes: editPatch.notes ?? d.notes ?? '',
                              })} disabled={saving}
                                className="px-2 py-1 bg-amber-500 text-white rounded-lg text-[11px] font-bold disabled:opacity-50">
                                {saving ? '...' : '✓'}
                              </button>
                              <button onClick={() => { setEditId(null); setEditPatch({}) }}
                                className="px-2 py-1 border border-[#E2E8F0] rounded-lg text-[11px] text-[#64748B]">
                                <X size={11} />
                              </button>
                            </div>
                          ) : (
                            <button onClick={() => { setEditId(d.id); setEditPatch({}) }}
                              className="px-2.5 py-1.5 border border-[#E2E8F0] rounded-xl text-[11px] font-semibold text-[#64748B] hover:bg-[#F8FAFC]">
                              Éditer
                            </button>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            <div className="px-4 py-3 border-t border-[#F1F5F9] text-[11px] text-[#94A3B8]">
              {filtered.length} déclaration{filtered.length !== 1 ? 's' : ''} · {filterAnnee}
            </div>
          </div>
        )}
      </div>

      {/* ── Modal : Nouvelle déclaration ─── */}
      {showNewForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-[16px] text-[#0F172A]">Nouvelle déclaration</h2>
              <button onClick={() => setShowNewForm(false)} className="p-1.5 rounded-lg hover:bg-[#F1F5F9]"><X size={16} /></button>
            </div>
            <form onSubmit={saveNew} className="space-y-3">

              <div>
                <label className="text-[11px] font-bold text-[#64748B] uppercase tracking-wide">Client *</label>
                <select required value={newForm.client_id} onChange={e => setNewForm(p => ({ ...p, client_id: e.target.value }))}
                  className="mt-1 w-full px-3 py-2.5 text-[13px] border border-[#E2E8F0] rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-300 bg-white">
                  <option value="">— Sélectionner un client —</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.nom_entreprise}</option>)}
                </select>
              </div>

              <div>
                <label className="text-[11px] font-bold text-[#64748B] uppercase tracking-wide">Type de déclaration *</label>
                <select required value={newForm.type_declaration} onChange={e => setNewForm(p => ({ ...p, type_declaration: e.target.value }))}
                  className="mt-1 w-full px-3 py-2.5 text-[13px] border border-[#E2E8F0] rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-300 bg-white">
                  {Object.entries(TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-[#64748B] uppercase tracking-wide">Mois</label>
                  <select value={newForm.periode_mois} onChange={e => setNewForm(p => ({ ...p, periode_mois: e.target.value }))}
                    className="mt-1 w-full px-3 py-2.5 text-[13px] border border-[#E2E8F0] rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-300 bg-white">
                    <option value="">—</option>
                    {MOIS.map((m, i) => <option key={i + 1} value={String(i + 1)}>{m}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-bold text-[#64748B] uppercase tracking-wide">Année *</label>
                  <input type="number" required value={newForm.periode_annee} onChange={e => setNewForm(p => ({ ...p, periode_annee: e.target.value }))}
                    className="mt-1 w-full px-3 py-2.5 text-[13px] border border-[#E2E8F0] rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-300" />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold text-[#64748B] uppercase tracking-wide">Date limite *</label>
                <input type="date" required value={newForm.date_limite} onChange={e => setNewForm(p => ({ ...p, date_limite: e.target.value }))}
                  className="mt-1 w-full px-3 py-2.5 text-[13px] border border-[#E2E8F0] rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-300" />
              </div>

              <div>
                <label className="text-[11px] font-bold text-[#64748B] uppercase tracking-wide">Montant déclaré (FCFA)</label>
                <input type="number" min="0" value={newForm.montant_declare} onChange={e => setNewForm(p => ({ ...p, montant_declare: e.target.value }))}
                  placeholder="0" className="mt-1 w-full px-3 py-2.5 text-[13px] border border-[#E2E8F0] rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-300" />
              </div>

              <div>
                <label className="text-[11px] font-bold text-[#64748B] uppercase tracking-wide">Notes</label>
                <textarea value={newForm.notes} onChange={e => setNewForm(p => ({ ...p, notes: e.target.value }))} rows={2}
                  className="mt-1 w-full px-3 py-2.5 text-[13px] border border-[#E2E8F0] rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-300 resize-none" />
              </div>

              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setShowNewForm(false)}
                  className="flex-1 py-2.5 border border-[#E2E8F0] rounded-xl text-[13px] font-semibold text-[#64748B] hover:bg-[#F8FAFC]">
                  Annuler
                </button>
                <button type="submit" disabled={saving || !newForm.client_id || !newForm.date_limite}
                  className="flex-1 py-2.5 bg-amber-500 text-white rounded-xl text-[13px] font-bold hover:bg-amber-600 disabled:opacity-50">
                  {saving ? 'Enregistrement...' : 'Créer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Fermer menus si clic extérieur */}
      {openMenuId && (
        <div className="fixed inset-0 z-10" onClick={() => setOpenMenuId(null)} />
      )}
    </div>
  )
}

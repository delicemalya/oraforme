'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useTenantContext } from '@/lib/contexts/TenantContext'
import Link from 'next/link'
import {
  Calendar, Plus, Search, RefreshCw, Loader2, X, CheckCircle, Edit3, Users,
} from 'lucide-react'

interface Soutenance {
  id:             string
  these_id:       string | null
  etudiant_nom:   string
  titre:          string
  niveau:         string | null
  date_soutenance:string | null
  heure:          string | null
  salle:          string | null
  directeur_nom:  string | null
  jury:           string[] | null
  mention:        string | null
  note:           number | null
  statut:         'planifiee' | 'en_cours' | 'validee' | 'ajournee' | 'annulee'
  observations:   string | null
}

const STATUT_CFG: Record<Soutenance['statut'], { label: string; color: string; bg: string }> = {
  planifiee: { label: 'Planifiée',  color: '#2563EB', bg: '#EFF6FF' },
  en_cours:  { label: 'En cours',   color: '#D97706', bg: '#FFFBEB' },
  validee:   { label: 'Admis',      color: '#16A34A', bg: '#F0FDF4' },
  ajournee:  { label: 'Ajourné',    color: '#DC2626', bg: '#FEF2F2' },
  annulee:   { label: 'Annulée',    color: '#94A3B8', bg: '#F8FAFC' },
}

const MENTIONS = ['Passable', 'Assez bien', 'Bien', 'Très bien', 'Excellent', 'Félicitations du jury']

function ModalSoutenance({
  soutenance, onClose, onSaved,
}: { soutenance: Soutenance | null; onClose: () => void; onSaved: () => void }) {
  const { tenant } = useTenantContext()
  const [form, setForm] = useState({
    etudiant_nom:    soutenance?.etudiant_nom    ?? '',
    titre:           soutenance?.titre           ?? '',
    niveau:          soutenance?.niveau          ?? 'Master 2',
    date_soutenance: soutenance?.date_soutenance ?? '',
    heure:           soutenance?.heure           ?? '09:00',
    salle:           soutenance?.salle           ?? '',
    directeur_nom:   soutenance?.directeur_nom   ?? '',
    jury_txt:        (soutenance?.jury ?? []).join('\n'),
    mention:         soutenance?.mention         ?? '',
    note:            soutenance?.note?.toString() ?? '',
    statut:          soutenance?.statut          ?? 'planifiee' as Soutenance['statut'],
    observations:    soutenance?.observations    ?? '',
  })
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    if (!form.etudiant_nom || !form.titre) return
    setSaving(true)
    const jury = form.jury_txt.split('\n').map(s => s.trim()).filter(Boolean)
    const data = {
      etudiant_nom: form.etudiant_nom, titre: form.titre, niveau: form.niveau || null,
      date_soutenance: form.date_soutenance || null, heure: form.heure || null,
      salle: form.salle || null, directeur_nom: form.directeur_nom || null,
      jury: jury.length > 0 ? jury : null,
      mention: form.mention || null, note: form.note ? parseFloat(form.note) : null,
      statut: form.statut, observations: form.observations || null,
    }
    if (soutenance) {
      await supabase.from('ecole_soutenances').update(data).eq('id', soutenance.id).eq('tenant_id', tenant?.tenantId)
    } else {
      await supabase.from('ecole_soutenances').insert({ ...data, tenant_id: tenant?.tenantId })
    }
    setSaving(false)
    onSaved()
  }

  const I = 'w-full px-3 py-2.5 text-[13px] border border-[#E2E8F0] rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-300 bg-white'

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#E2E8F0] sticky top-0 bg-white">
          <h2 className="font-black text-[15px]">{soutenance ? 'Modifier soutenance' : 'Planifier soutenance'}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-[#F1F5F9]"><X size={16} /></button>
        </div>
        <div className="p-5 space-y-3">
          <div>
            <label className="block text-[12px] font-bold mb-1.5">Étudiant *</label>
            <input value={form.etudiant_nom} onChange={e => setForm(f => ({ ...f, etudiant_nom: e.target.value }))} className={I} />
          </div>
          <div>
            <label className="block text-[12px] font-bold mb-1.5">Titre thèse/mémoire *</label>
            <textarea value={form.titre} onChange={e => setForm(f => ({ ...f, titre: e.target.value }))} rows={2} className={`${I} resize-none`} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-[12px] font-bold mb-1.5">Date</label>
              <input type="date" value={form.date_soutenance} onChange={e => setForm(f => ({ ...f, date_soutenance: e.target.value }))} className={I} />
            </div>
            <div>
              <label className="block text-[12px] font-bold mb-1.5">Heure</label>
              <input type="time" value={form.heure} onChange={e => setForm(f => ({ ...f, heure: e.target.value }))} className={I} />
            </div>
            <div>
              <label className="block text-[12px] font-bold mb-1.5">Salle</label>
              <input value={form.salle} onChange={e => setForm(f => ({ ...f, salle: e.target.value }))} className={I} placeholder="Amphi A" />
            </div>
          </div>
          <div>
            <label className="block text-[12px] font-bold mb-1.5">Directeur de thèse</label>
            <input value={form.directeur_nom} onChange={e => setForm(f => ({ ...f, directeur_nom: e.target.value }))} className={I} placeholder="Prof. ..." />
          </div>
          <div>
            <label className="block text-[12px] font-bold mb-1.5">Membres du jury (un par ligne)</label>
            <textarea value={form.jury_txt} onChange={e => setForm(f => ({ ...f, jury_txt: e.target.value }))} rows={3}
              className={`${I} resize-none`} placeholder={"Dr. Dupont (Président)\nProf. Martin\nDr. Leroy"} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-[12px] font-bold mb-1.5">Statut</label>
              <select value={form.statut} onChange={e => setForm(f => ({ ...f, statut: e.target.value as Soutenance['statut'] }))} className={I}>
                {Object.entries(STATUT_CFG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[12px] font-bold mb-1.5">Note /20</label>
              <input type="number" value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} className={I} min={0} max={20} step={0.5} />
            </div>
            <div>
              <label className="block text-[12px] font-bold mb-1.5">Mention</label>
              <select value={form.mention} onChange={e => setForm(f => ({ ...f, mention: e.target.value }))} className={I}>
                <option value="">—</option>
                {MENTIONS.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-[12px] font-bold mb-1.5">Observations jury</label>
            <textarea value={form.observations} onChange={e => setForm(f => ({ ...f, observations: e.target.value }))} rows={2} className={`${I} resize-none`} />
          </div>
          <button onClick={handleSave} disabled={!form.etudiant_nom || !form.titre || saving}
            className="w-full py-2.5 bg-amber-500 text-white rounded-xl text-[13px] font-bold hover:bg-amber-600 disabled:opacity-40 flex items-center justify-center gap-1.5">
            {saving ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />}
            Enregistrer
          </button>
        </div>
      </div>
    </div>
  )
}

export default function EcoleSoutenancesPage() {
  const { tenant } = useTenantContext()
  const tid = tenant?.tenantId

  const [rows,    setRows]    = useState<Soutenance[]>([])
  const [loading, setLoading] = useState(true)
  const [search,  setSearch]  = useState('')
  const [filter,  setFilter]  = useState('tous')
  const [modal,   setModal]   = useState(false)
  const [edit,    setEdit]    = useState<Soutenance | null>(null)

  const load = useCallback(async () => {
    if (!tid) return
    setLoading(true)
    const { data } = await supabase.from('ecole_soutenances').select('*').eq('tenant_id', tid).order('date_soutenance', { ascending: false })
    setRows((data ?? []) as Soutenance[])
    setLoading(false)
  }, [tid])

  useEffect(() => { load() }, [load])

  const filtered = rows.filter(r => {
    const q = search.toLowerCase()
    const matchQ = !q || r.etudiant_nom.toLowerCase().includes(q) || r.titre.toLowerCase().includes(q)
    const matchF = filter === 'tous' || r.statut === filter
    return matchQ && matchF
  })

  const upcoming = rows.filter(r => r.statut === 'planifiee' && r.date_soutenance && r.date_soutenance >= new Date().toISOString().split('T')[0])

  return (
    <div className="min-h-screen bg-[#F8FAFC] pb-20">
      <div className="bg-white border-b border-[#E2E8F0] px-4 sm:px-6 py-4 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link href="/dashboard/ecole" className="text-[#64748B] hover:text-[#0F172A] text-[13px]">← École</Link>
            <span className="text-[#E2E8F0]">/</span>
            <div className="flex items-center gap-2">
              <Calendar size={16} className="text-amber-500" />
              <h1 className="text-[16px] font-black text-[#0F172A]">Soutenances</h1>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={load} className="p-2 border border-[#E2E8F0] rounded-xl text-[#64748B]"><RefreshCw size={13} /></button>
            <button onClick={() => { setEdit(null); setModal(true) }}
              className="flex items-center gap-1.5 px-4 py-2 bg-amber-500 text-white rounded-xl text-[13px] font-bold hover:bg-amber-600">
              <Plus size={14} /> Planifier
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">

        {/* KPIs */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
          <div className="bg-white rounded-2xl p-4 border border-[#E2E8F0] shadow-sm">
            <p className="text-[10px] font-bold text-[#64748B] uppercase mb-1">Total</p>
            <p className="text-[22px] font-black text-[#0F172A]">{rows.length}</p>
          </div>
          <div className="bg-white rounded-2xl p-4 border border-[#E2E8F0] shadow-sm">
            <p className="text-[10px] font-bold text-[#64748B] uppercase mb-1">À venir</p>
            <p className="text-[22px] font-black text-blue-600">{upcoming.length}</p>
          </div>
          {(['validee', 'ajournee', 'annulee'] as Soutenance['statut'][]).map(s => (
            <div key={s} className="bg-white rounded-2xl p-4 border border-[#E2E8F0] shadow-sm">
              <p className="text-[10px] font-bold text-[#64748B] uppercase mb-1">{STATUT_CFG[s].label}</p>
              <p className="text-[22px] font-black" style={{ color: STATUT_CFG[s].color }}>{rows.filter(r => r.statut === s).length}</p>
            </div>
          ))}
        </div>

        {/* À venir banner */}
        {upcoming.length > 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4">
            <p className="text-[12px] font-black text-blue-800 mb-2">Prochaines soutenances ({upcoming.length})</p>
            <div className="space-y-1.5">
              {upcoming.slice(0, 3).map(s => (
                <div key={s.id} className="flex items-center justify-between text-[12px]">
                  <span className="font-semibold text-blue-900">{s.etudiant_nom}</span>
                  <span className="text-blue-700">{s.date_soutenance ? new Date(s.date_soutenance).toLocaleDateString('fr-FR') : '—'} {s.heure ? `à ${s.heure}` : ''} {s.salle ? `· ${s.salle}` : ''}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Filtres */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Étudiant ou titre..."
              className="w-full pl-9 pr-4 py-2.5 text-[13px] border border-[#E2E8F0] rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-300 bg-white" />
          </div>
          <div className="flex gap-1 bg-[#F1F5F9] rounded-xl p-1 overflow-x-auto">
            {[['tous', 'Tous'], ...Object.entries(STATUT_CFG).map(([k, v]) => [k, v.label])].map(([k, label]) => (
              <button key={k} onClick={() => setFilter(k)}
                className={`px-2.5 py-1.5 rounded-lg text-[11px] font-semibold whitespace-nowrap ${filter === k ? 'bg-white text-[#0F172A] shadow-sm' : 'text-[#64748B]'}`}>
                {label}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16 gap-2 text-[#94A3B8]"><Loader2 size={18} className="animate-spin" /> Chargement...</div>
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-2xl border border-dashed border-[#CBD5E1] p-16 text-center">
            <Calendar size={40} className="text-[#CBD5E1] mx-auto mb-3" />
            <p className="font-bold text-[#0F172A] mb-1">Aucune soutenance</p>
            <button onClick={() => { setEdit(null); setModal(true) }}
              className="mt-3 inline-flex items-center gap-1.5 px-4 py-2.5 bg-amber-500 text-white rounded-xl text-[13px] font-bold">
              <Plus size={13} /> Planifier
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Desktop */}
            <div className="hidden sm:block bg-white rounded-2xl border border-[#E2E8F0] shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-[12px] min-w-[800px]">
                  <thead className="bg-[#F8FAFC] text-[#64748B] font-bold border-b border-[#E2E8F0]">
                    <tr>
                      <th className="text-left px-4 py-2.5">Date</th>
                      <th className="text-left px-4 py-2.5">Étudiant</th>
                      <th className="text-left px-4 py-2.5">Titre</th>
                      <th className="text-left px-4 py-2.5">Jury</th>
                      <th className="text-left px-4 py-2.5">Statut</th>
                      <th className="text-left px-4 py-2.5">Mention</th>
                      <th className="text-center px-4 py-2.5">Note</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F1F5F9]">
                    {filtered.map(r => {
                      const sc = STATUT_CFG[r.statut]
                      return (
                        <tr key={r.id} className="hover:bg-[#F8FAFC] group">
                          <td className="px-4 py-3 text-[#64748B] whitespace-nowrap">
                            {r.date_soutenance ? new Date(r.date_soutenance).toLocaleDateString('fr-FR') : '—'}
                            {r.heure && <span className="block text-[10px] text-[#94A3B8]">{r.heure} {r.salle ? `· ${r.salle}` : ''}</span>}
                          </td>
                          <td className="px-4 py-3 font-bold text-[#0F172A]">{r.etudiant_nom}</td>
                          <td className="px-4 py-3 text-[#374151] max-w-[200px]"><p className="line-clamp-2">{r.titre}</p></td>
                          <td className="px-4 py-3 text-[#64748B]">
                            {r.jury ? (
                              <div className="flex items-center gap-1">
                                <Users size={11} />
                                <span>{r.jury.length} membre{r.jury.length > 1 ? 's' : ''}</span>
                              </div>
                            ) : '—'}
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-[10px] px-2 py-0.5 rounded-full font-bold" style={{ background: sc.bg, color: sc.color }}>{sc.label}</span>
                          </td>
                          <td className="px-4 py-3 text-[#64748B]">{r.mention ?? '—'}</td>
                          <td className="px-4 py-3 text-center font-black text-[#0F172A]">{r.note != null ? `${r.note}/20` : '—'}</td>
                          <td className="px-4 py-3">
                            <button onClick={() => { setEdit(r); setModal(true) }}
                              className="p-1.5 rounded-lg hover:bg-[#F1F5F9] text-[#94A3B8] opacity-0 group-hover:opacity-100">
                              <Edit3 size={12} />
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Mobile */}
            <div className="sm:hidden space-y-3">
              {filtered.map(r => {
                const sc = STATUT_CFG[r.statut]
                return (
                  <div key={r.id} className="bg-white rounded-2xl border border-[#E2E8F0] shadow-sm p-4" onClick={() => { setEdit(r); setModal(true) }}>
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <p className="font-black text-[13px] text-[#0F172A]">{r.etudiant_nom}</p>
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-bold flex-shrink-0" style={{ background: sc.bg, color: sc.color }}>{sc.label}</span>
                    </div>
                    <p className="text-[11px] text-[#64748B] line-clamp-2 mb-2">{r.titre}</p>
                    <div className="flex items-center justify-between text-[11px] text-[#94A3B8]">
                      <span>{r.date_soutenance ? new Date(r.date_soutenance).toLocaleDateString('fr-FR') : '—'} {r.heure}</span>
                      {r.note != null && <span className="font-black text-[#0F172A]">{r.note}/20 {r.mention && `· ${r.mention}`}</span>}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {modal && <ModalSoutenance soutenance={edit} onClose={() => setModal(false)} onSaved={() => { setModal(false); load() }} />}
    </div>
  )
}

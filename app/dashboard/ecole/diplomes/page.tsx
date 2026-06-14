'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useTenantContext } from '@/lib/contexts/TenantContext'
import Link from 'next/link'
import {
  Award, Plus, Search, RefreshCw, Loader2, X, CheckCircle, Edit3,
} from 'lucide-react'

interface Diplome {
  id:              string
  etudiant_nom:    string
  etudiant_id:     string | null
  type:            string
  intitule:        string
  mention:         string | null
  note:            number | null
  annee_obtention: number
  numero_diplome:  string | null
  date_emission:   string | null
  statut:          'en_attente' | 'emis' | 'remis' | 'annule'
  notes:           string | null
}

const STATUT_CFG: Record<Diplome['statut'], { label: string; color: string; bg: string }> = {
  en_attente: { label: 'En attente', color: '#D97706', bg: '#FFFBEB' },
  emis:       { label: 'Émis',       color: '#2563EB', bg: '#EFF6FF' },
  remis:      { label: 'Remis',      color: '#16A34A', bg: '#F0FDF4' },
  annule:     { label: 'Annulé',     color: '#DC2626', bg: '#FEF2F2' },
}

const TYPES_DIPLOME = ['Licence', 'Licence Pro', 'Master', 'Master Pro', 'Doctorat', 'DUT', 'BTS', 'Attestation', 'Certificat']
const MENTIONS      = ['Passable', 'Assez bien', 'Bien', 'Très bien', 'Excellent', 'Félicitations du jury']

let counter = 1000

function genNumero(type: string, annee: number) {
  counter++
  return `${type.substring(0, 3).toUpperCase()}-${annee}-${String(counter).padStart(4, '0')}`
}

function ModalDiplome({
  diplome, onClose, onSaved,
}: { diplome: Diplome | null; onClose: () => void; onSaved: () => void }) {
  const { tenant } = useTenantContext()
  const anneeActuel = new Date().getFullYear()
  const [form, setForm] = useState({
    etudiant_nom:    diplome?.etudiant_nom    ?? '',
    type:            diplome?.type            ?? 'Licence',
    intitule:        diplome?.intitule        ?? '',
    mention:         diplome?.mention         ?? '',
    note:            diplome?.note?.toString() ?? '',
    annee_obtention: diplome?.annee_obtention?.toString() ?? anneeActuel.toString(),
    numero_diplome:  diplome?.numero_diplome  ?? '',
    date_emission:   diplome?.date_emission   ?? '',
    statut:          diplome?.statut          ?? 'en_attente' as Diplome['statut'],
    notes:           diplome?.notes           ?? '',
  })
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    if (!form.etudiant_nom || !form.type || !form.intitule) return
    setSaving(true)
    const numero = form.numero_diplome || (!diplome ? genNumero(form.type, parseInt(form.annee_obtention)) : undefined)
    const data = {
      etudiant_nom: form.etudiant_nom, type: form.type, intitule: form.intitule,
      mention: form.mention || null, note: form.note ? parseFloat(form.note) : null,
      annee_obtention: parseInt(form.annee_obtention) || anneeActuel,
      numero_diplome: numero ?? null,
      date_emission: form.date_emission || null, statut: form.statut, notes: form.notes || null,
    }
    if (diplome) {
      await supabase.from('ecole_diplomes').update(data).eq('id', diplome.id).eq('tenant_id', tenant?.tenantId)
    } else {
      await supabase.from('ecole_diplomes').insert({ ...data, tenant_id: tenant?.tenantId })
    }
    setSaving(false)
    onSaved()
  }

  const I = 'w-full px-3 py-2.5 text-[13px] border border-[#E2E8F0] rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-300 bg-white'

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#E2E8F0] sticky top-0 bg-white">
          <h2 className="font-black text-[15px]">{diplome ? 'Modifier diplôme' : 'Émettre un diplôme'}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-[#F1F5F9]"><X size={16} /></button>
        </div>
        <div className="p-5 space-y-3">
          <div>
            <label className="block text-[12px] font-bold mb-1.5">Étudiant *</label>
            <input value={form.etudiant_nom} onChange={e => setForm(f => ({ ...f, etudiant_nom: e.target.value }))} className={I} placeholder="Nom & prénom complets" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[12px] font-bold mb-1.5">Type de diplôme *</label>
              <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))} className={I}>
                {TYPES_DIPLOME.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[12px] font-bold mb-1.5">Année d'obtention</label>
              <input type="number" value={form.annee_obtention} onChange={e => setForm(f => ({ ...f, annee_obtention: e.target.value }))} className={I} min={2000} max={2040} />
            </div>
          </div>
          <div>
            <label className="block text-[12px] font-bold mb-1.5">Intitulé / Spécialité *</label>
            <input value={form.intitule} onChange={e => setForm(f => ({ ...f, intitule: e.target.value }))} className={I} placeholder="Sciences Informatiques, Droit des Affaires..." />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[12px] font-bold mb-1.5">Mention</label>
              <select value={form.mention} onChange={e => setForm(f => ({ ...f, mention: e.target.value }))} className={I}>
                <option value="">Sans mention</option>
                {MENTIONS.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[12px] font-bold mb-1.5">Moyenne /20</label>
              <input type="number" value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} className={I} min={0} max={20} step={0.01} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[12px] font-bold mb-1.5">N° diplôme</label>
              <input value={form.numero_diplome} onChange={e => setForm(f => ({ ...f, numero_diplome: e.target.value }))} className={I} placeholder="Auto-généré si vide" />
            </div>
            <div>
              <label className="block text-[12px] font-bold mb-1.5">Date d'émission</label>
              <input type="date" value={form.date_emission} onChange={e => setForm(f => ({ ...f, date_emission: e.target.value }))} className={I} />
            </div>
          </div>
          <div>
            <label className="block text-[12px] font-bold mb-1.5">Statut</label>
            <select value={form.statut} onChange={e => setForm(f => ({ ...f, statut: e.target.value as Diplome['statut'] }))} className={I}>
              {Object.entries(STATUT_CFG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[12px] font-bold mb-1.5">Observations</label>
            <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} className={`${I} resize-none`} />
          </div>
          <button onClick={handleSave} disabled={!form.etudiant_nom || !form.type || !form.intitule || saving}
            className="w-full py-2.5 bg-amber-500 text-white rounded-xl text-[13px] font-bold hover:bg-amber-600 disabled:opacity-40 flex items-center justify-center gap-1.5">
            {saving ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />}
            {diplome ? 'Enregistrer' : 'Émettre le diplôme'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function EcoleDiplomesPage() {
  const { tenant } = useTenantContext()
  const tid = tenant?.tenantId

  const [rows,    setRows]    = useState<Diplome[]>([])
  const [loading, setLoading] = useState(true)
  const [search,  setSearch]  = useState('')
  const [filter,  setFilter]  = useState('tous')
  const [filterType, setFilterType] = useState('tous')
  const [modal,   setModal]   = useState(false)
  const [edit,    setEdit]    = useState<Diplome | null>(null)

  const load = useCallback(async () => {
    if (!tid) return
    setLoading(true)
    const { data } = await supabase.from('ecole_diplomes').select('*').eq('tenant_id', tid).order('annee_obtention', { ascending: false }).order('created_at', { ascending: false })
    setRows((data ?? []) as Diplome[])
    setLoading(false)
  }, [tid])

  useEffect(() => { load() }, [load])

  const filtered = rows.filter(r => {
    const q = search.toLowerCase()
    const matchQ = !q || r.etudiant_nom.toLowerCase().includes(q) || r.intitule.toLowerCase().includes(q) || r.numero_diplome?.toLowerCase().includes(q)
    const matchS = filter === 'tous' || r.statut === filter
    const matchT = filterType === 'tous' || r.type === filterType
    return matchQ && matchS && matchT
  })

  const anneeCourante = new Date().getFullYear()
  const emis = rows.filter(r => r.statut === 'emis' || r.statut === 'remis').length
  const cetteAnnee = rows.filter(r => r.annee_obtention === anneeCourante).length

  return (
    <div className="min-h-screen bg-[#F8FAFC] pb-20">
      <div className="bg-white border-b border-[#E2E8F0] px-4 sm:px-6 py-4 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link href="/dashboard/ecole" className="text-[#64748B] hover:text-[#0F172A] text-[13px]">← École</Link>
            <span className="text-[#E2E8F0]">/</span>
            <div className="flex items-center gap-2">
              <Award size={16} className="text-amber-500" />
              <h1 className="text-[16px] font-black text-[#0F172A]">Diplômes & Attestations</h1>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={load} className="p-2 border border-[#E2E8F0] rounded-xl text-[#64748B]"><RefreshCw size={13} /></button>
            <button onClick={() => { setEdit(null); setModal(true) }}
              className="flex items-center gap-1.5 px-4 py-2 bg-amber-500 text-white rounded-xl text-[13px] font-bold hover:bg-amber-600">
              <Plus size={14} /> Émettre diplôme
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">

        {/* KPIs */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-white rounded-2xl p-4 border border-[#E2E8F0] shadow-sm">
            <p className="text-[10px] font-bold text-[#64748B] uppercase mb-1">Total registre</p>
            <p className="text-[22px] font-black text-[#0F172A]">{rows.length}</p>
          </div>
          <div className="bg-white rounded-2xl p-4 border border-[#E2E8F0] shadow-sm">
            <p className="text-[10px] font-bold text-[#64748B] uppercase mb-1">Émis/Remis</p>
            <p className="text-[22px] font-black text-green-600">{emis}</p>
          </div>
          <div className="bg-white rounded-2xl p-4 border border-[#E2E8F0] shadow-sm">
            <p className="text-[10px] font-bold text-[#64748B] uppercase mb-1">En attente</p>
            <p className="text-[22px] font-black text-amber-600">{rows.filter(r => r.statut === 'en_attente').length}</p>
          </div>
          <div className="bg-white rounded-2xl p-4 border border-[#E2E8F0] shadow-sm">
            <p className="text-[10px] font-bold text-[#64748B] uppercase mb-1">Année {anneeCourante}</p>
            <p className="text-[22px] font-black text-[#0F172A]">{cetteAnnee}</p>
          </div>
        </div>

        {/* Filtres */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Étudiant, intitulé, N° diplôme..."
              className="w-full pl-9 pr-4 py-2.5 text-[13px] border border-[#E2E8F0] rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-300 bg-white" />
          </div>
          <select value={filter} onChange={e => setFilter(e.target.value)}
            className="px-3 py-2.5 text-[12px] border border-[#E2E8F0] rounded-xl bg-white focus:outline-none">
            <option value="tous">Tous statuts</option>
            {Object.entries(STATUT_CFG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
          <select value={filterType} onChange={e => setFilterType(e.target.value)}
            className="px-3 py-2.5 text-[12px] border border-[#E2E8F0] rounded-xl bg-white focus:outline-none">
            <option value="tous">Tous types</option>
            {TYPES_DIPLOME.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16 gap-2 text-[#94A3B8]"><Loader2 size={18} className="animate-spin" /></div>
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-2xl border border-dashed border-[#CBD5E1] p-16 text-center">
            <Award size={40} className="text-[#CBD5E1] mx-auto mb-3" />
            <p className="font-bold text-[#0F172A] mb-1">Aucun diplôme dans le registre</p>
            <button onClick={() => { setEdit(null); setModal(true) }}
              className="mt-3 inline-flex items-center gap-1.5 px-4 py-2.5 bg-amber-500 text-white rounded-xl text-[13px] font-bold">
              <Plus size={13} /> Émettre
            </button>
          </div>
        ) : (
          <>
            {/* Desktop */}
            <div className="hidden sm:block bg-white rounded-2xl border border-[#E2E8F0] shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-[12px] min-w-[800px]">
                  <thead className="bg-[#F8FAFC] text-[#64748B] font-bold border-b border-[#E2E8F0]">
                    <tr>
                      <th className="text-left px-4 py-2.5">N° Diplôme</th>
                      <th className="text-left px-4 py-2.5">Étudiant</th>
                      <th className="text-left px-4 py-2.5">Type</th>
                      <th className="text-left px-4 py-2.5">Intitulé</th>
                      <th className="text-left px-4 py-2.5">Promotion</th>
                      <th className="text-left px-4 py-2.5">Mention</th>
                      <th className="text-center px-4 py-2.5">Note</th>
                      <th className="text-left px-4 py-2.5">Statut</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F1F5F9]">
                    {filtered.map(r => {
                      const sc = STATUT_CFG[r.statut]
                      return (
                        <tr key={r.id} className="hover:bg-[#F8FAFC] group">
                          <td className="px-4 py-3 font-mono text-[11px] text-[#64748B]">{r.numero_diplome ?? '—'}</td>
                          <td className="px-4 py-3 font-bold text-[#0F172A]">{r.etudiant_nom}</td>
                          <td className="px-4 py-3 text-[#374151]">{r.type}</td>
                          <td className="px-4 py-3 text-[#374151] max-w-[180px]"><p className="truncate">{r.intitule}</p></td>
                          <td className="px-4 py-3 text-[#64748B]">{r.annee_obtention}</td>
                          <td className="px-4 py-3 text-[#64748B]">{r.mention ?? '—'}</td>
                          <td className="px-4 py-3 text-center font-black text-[#0F172A]">{r.note != null ? `${r.note}/20` : '—'}</td>
                          <td className="px-4 py-3">
                            <span className="text-[10px] px-2 py-0.5 rounded-full font-bold" style={{ background: sc.bg, color: sc.color }}>{sc.label}</span>
                          </td>
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
                      <div>
                        <p className="font-black text-[13px] text-[#0F172A]">{r.etudiant_nom}</p>
                        <p className="text-[11px] text-[#64748B]">{r.type} · {r.intitule}</p>
                      </div>
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-bold flex-shrink-0" style={{ background: sc.bg, color: sc.color }}>{sc.label}</span>
                    </div>
                    <div className="flex items-center justify-between mt-2 text-[11px] text-[#94A3B8]">
                      <span className="font-mono">{r.numero_diplome ?? '—'} · {r.annee_obtention}</span>
                      {r.note != null && <span className="font-black text-[#0F172A]">{r.note}/20</span>}
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>

      {modal && <ModalDiplome diplome={edit} onClose={() => setModal(false)} onSaved={() => { setModal(false); load() }} />}
    </div>
  )
}

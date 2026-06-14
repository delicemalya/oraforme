'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useTenantContext } from '@/lib/contexts/TenantContext'
import Link from 'next/link'
import {
  BookOpen, Plus, Search, RefreshCw, Loader2, X, CheckCircle, Edit3,
} from 'lucide-react'

interface These {
  id:              string
  titre:           string
  etudiant_nom:    string
  etudiant_id:     string | null
  directeur_nom:   string | null
  co_directeur_nom:string | null
  domaine:         string | null
  niveau:          string | null
  annee_universitaire: string | null
  statut: 'en_cours' | 'soumise' | 'validee' | 'soutenue' | 'abandonnee'
  date_depot:      string | null
  notes:           string | null
}

const STATUT_CFG: Record<These['statut'], { label: string; color: string; bg: string }> = {
  en_cours:   { label: 'En cours',   color: '#2563EB', bg: '#EFF6FF' },
  soumise:    { label: 'Soumise',    color: '#D97706', bg: '#FFFBEB' },
  validee:    { label: 'Validée',    color: '#16A34A', bg: '#F0FDF4' },
  soutenue:   { label: 'Soutenue',   color: '#7C3AED', bg: '#F5F3FF' },
  abandonnee: { label: 'Abandonnée', color: '#DC2626', bg: '#FEF2F2' },
}

const NIVEAUX = ['Licence 3', 'Master 1', 'Master 2', 'Doctorat']

function ModalThese({
  these, onClose, onSaved,
}: { these: These | null; onClose: () => void; onSaved: () => void }) {
  const { tenant } = useTenantContext()
  const [form, setForm] = useState({
    titre:            these?.titre ?? '',
    etudiant_nom:     these?.etudiant_nom ?? '',
    directeur_nom:    these?.directeur_nom ?? '',
    co_directeur_nom: these?.co_directeur_nom ?? '',
    domaine:          these?.domaine ?? '',
    niveau:           these?.niveau ?? 'Master 2',
    annee_universitaire: these?.annee_universitaire ?? `${new Date().getFullYear()}-${new Date().getFullYear() + 1}`,
    statut:           these?.statut ?? 'en_cours' as These['statut'],
    date_depot:       these?.date_depot ?? '',
    notes:            these?.notes ?? '',
  })
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    if (!form.titre || !form.etudiant_nom) return
    setSaving(true)
    const data = {
      titre: form.titre, etudiant_nom: form.etudiant_nom, directeur_nom: form.directeur_nom || null,
      co_directeur_nom: form.co_directeur_nom || null, domaine: form.domaine || null,
      niveau: form.niveau, annee_universitaire: form.annee_universitaire, statut: form.statut,
      date_depot: form.date_depot || null, notes: form.notes || null,
    }
    if (these) {
      await supabase.from('ecole_theses').update(data).eq('id', these.id).eq('tenant_id', tenant?.tenantId)
    } else {
      await supabase.from('ecole_theses').insert({ ...data, tenant_id: tenant?.tenantId })
    }
    setSaving(false)
    onSaved()
  }

  const I = 'w-full px-3 py-2.5 text-[13px] border border-[#E2E8F0] rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-300 bg-white'

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#E2E8F0] sticky top-0 bg-white">
          <h2 className="font-black text-[15px]">{these ? 'Modifier thèse/mémoire' : 'Nouveau thèse/mémoire'}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-[#F1F5F9]"><X size={16} /></button>
        </div>
        <div className="p-5 space-y-3">
          <div>
            <label className="block text-[12px] font-bold text-[#374151] mb-1.5">Titre *</label>
            <input value={form.titre} onChange={e => setForm(f => ({ ...f, titre: e.target.value }))} className={I} placeholder="Titre de la thèse ou du mémoire" />
          </div>
          <div>
            <label className="block text-[12px] font-bold text-[#374151] mb-1.5">Étudiant *</label>
            <input value={form.etudiant_nom} onChange={e => setForm(f => ({ ...f, etudiant_nom: e.target.value }))} className={I} placeholder="Nom & prénom de l'étudiant" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[12px] font-bold text-[#374151] mb-1.5">Directeur</label>
              <input value={form.directeur_nom} onChange={e => setForm(f => ({ ...f, directeur_nom: e.target.value }))} className={I} placeholder="Prof. ..." />
            </div>
            <div>
              <label className="block text-[12px] font-bold text-[#374151] mb-1.5">Co-directeur</label>
              <input value={form.co_directeur_nom} onChange={e => setForm(f => ({ ...f, co_directeur_nom: e.target.value }))} className={I} placeholder="Optionnel" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[12px] font-bold text-[#374151] mb-1.5">Niveau</label>
              <select value={form.niveau} onChange={e => setForm(f => ({ ...f, niveau: e.target.value }))} className={I}>
                {NIVEAUX.map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[12px] font-bold text-[#374151] mb-1.5">Année universitaire</label>
              <input value={form.annee_universitaire} onChange={e => setForm(f => ({ ...f, annee_universitaire: e.target.value }))} className={I} placeholder="2024-2025" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[12px] font-bold text-[#374151] mb-1.5">Domaine</label>
              <input value={form.domaine} onChange={e => setForm(f => ({ ...f, domaine: e.target.value }))} className={I} placeholder="Informatique, Droit..." />
            </div>
            <div>
              <label className="block text-[12px] font-bold text-[#374151] mb-1.5">Statut</label>
              <select value={form.statut} onChange={e => setForm(f => ({ ...f, statut: e.target.value as These['statut'] }))} className={I}>
                {Object.entries(STATUT_CFG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-[12px] font-bold text-[#374151] mb-1.5">Date dépôt</label>
            <input type="date" value={form.date_depot} onChange={e => setForm(f => ({ ...f, date_depot: e.target.value }))} className={I} />
          </div>
          <div>
            <label className="block text-[12px] font-bold text-[#374151] mb-1.5">Observations</label>
            <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} className={`${I} resize-none`} />
          </div>
          <button onClick={handleSave} disabled={!form.titre || !form.etudiant_nom || saving}
            className="w-full py-2.5 bg-amber-500 text-white rounded-xl text-[13px] font-bold hover:bg-amber-600 disabled:opacity-40 flex items-center justify-center gap-1.5">
            {saving ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />}
            Enregistrer
          </button>
        </div>
      </div>
    </div>
  )
}

export default function EcoleThesesPage() {
  const { tenant } = useTenantContext()
  const tid = tenant?.tenantId

  const [theses,     setTheses]     = useState<These[]>([])
  const [loading,    setLoading]    = useState(true)
  const [search,     setSearch]     = useState('')
  const [filterStatut, setFilterStatut] = useState('tous')
  const [filterNiveau, setFilterNiveau] = useState('tous')
  const [showModal,  setShowModal]  = useState(false)
  const [editThese,  setEditThese]  = useState<These | null>(null)

  const load = useCallback(async () => {
    if (!tid) return
    setLoading(true)
    const { data } = await supabase.from('ecole_theses').select('*').eq('tenant_id', tid).order('created_at', { ascending: false })
    setTheses((data ?? []) as These[])
    setLoading(false)
  }, [tid])

  useEffect(() => { load() }, [load])

  const filtered = theses.filter(t => {
    const q = search.toLowerCase()
    const matchQ = !q || t.titre.toLowerCase().includes(q) || t.etudiant_nom.toLowerCase().includes(q) || t.directeur_nom?.toLowerCase().includes(q)
    const matchS = filterStatut === 'tous' || t.statut === filterStatut
    const matchN = filterNiveau === 'tous' || t.niveau === filterNiveau
    return matchQ && matchS && matchN
  })

  const counts = Object.keys(STATUT_CFG).reduce((acc, k) => ({ ...acc, [k]: theses.filter(t => t.statut === k).length }), {} as Record<string, number>)

  return (
    <div className="min-h-screen bg-[#F8FAFC] pb-20">
      <div className="bg-white border-b border-[#E2E8F0] px-4 sm:px-6 py-4 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link href="/dashboard/ecole" className="text-[#64748B] hover:text-[#0F172A] text-[13px]">← École</Link>
            <span className="text-[#E2E8F0]">/</span>
            <div className="flex items-center gap-2">
              <BookOpen size={16} className="text-amber-500" />
              <h1 className="text-[16px] font-black text-[#0F172A]">Thèses & Mémoires</h1>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={load} className="p-2 border border-[#E2E8F0] rounded-xl text-[#64748B]"><RefreshCw size={13} /></button>
            <button onClick={() => { setEditThese(null); setShowModal(true) }}
              className="flex items-center gap-1.5 px-4 py-2 bg-amber-500 text-white rounded-xl text-[13px] font-bold hover:bg-amber-600">
              <Plus size={14} /> Nouveau
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">

        {/* KPIs */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
          <div className="bg-white rounded-2xl p-4 border border-[#E2E8F0] shadow-sm">
            <p className="text-[10px] font-bold text-[#64748B] uppercase mb-1">Total</p>
            <p className="text-[22px] font-black text-[#0F172A]">{theses.length}</p>
          </div>
          {Object.entries(STATUT_CFG).map(([k, v]) => (
            <div key={k} className="bg-white rounded-2xl p-4 border border-[#E2E8F0] shadow-sm">
              <p className="text-[10px] font-bold text-[#64748B] uppercase mb-1">{v.label}</p>
              <p className="text-[22px] font-black" style={{ color: v.color }}>{counts[k] ?? 0}</p>
            </div>
          ))}
        </div>

        {/* Filtres */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher titre, étudiant, directeur..."
              className="w-full pl-9 pr-4 py-2.5 text-[13px] border border-[#E2E8F0] rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-300 bg-white" />
          </div>
          <select value={filterStatut} onChange={e => setFilterStatut(e.target.value)}
            className="px-3 py-2.5 text-[12px] border border-[#E2E8F0] rounded-xl bg-white focus:outline-none">
            <option value="tous">Tous statuts</option>
            {Object.entries(STATUT_CFG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
          <select value={filterNiveau} onChange={e => setFilterNiveau(e.target.value)}
            className="px-3 py-2.5 text-[12px] border border-[#E2E8F0] rounded-xl bg-white focus:outline-none">
            <option value="tous">Tous niveaux</option>
            {NIVEAUX.map(n => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>

        {/* Liste */}
        {loading ? (
          <div className="flex items-center justify-center py-16 gap-2 text-[#94A3B8]">
            <Loader2 size={18} className="animate-spin" /> Chargement...
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-2xl border border-dashed border-[#CBD5E1] p-16 text-center">
            <BookOpen size={40} className="text-[#CBD5E1] mx-auto mb-3" />
            <p className="font-bold text-[#0F172A] mb-1">Aucune thèse/mémoire</p>
            <button onClick={() => { setEditThese(null); setShowModal(true) }}
              className="mt-3 inline-flex items-center gap-1.5 px-4 py-2.5 bg-amber-500 text-white rounded-xl text-[13px] font-bold">
              <Plus size={13} /> Ajouter
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Desktop */}
            <div className="hidden sm:block bg-white rounded-2xl border border-[#E2E8F0] shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-[12px] min-w-[700px]">
                  <thead className="bg-[#F8FAFC] text-[#64748B] font-bold border-b border-[#E2E8F0]">
                    <tr>
                      <th className="text-left px-4 py-2.5">Titre</th>
                      <th className="text-left px-4 py-2.5">Étudiant</th>
                      <th className="text-left px-4 py-2.5">Directeur</th>
                      <th className="text-left px-4 py-2.5">Niveau</th>
                      <th className="text-left px-4 py-2.5">Année</th>
                      <th className="text-left px-4 py-2.5">Statut</th>
                      <th className="text-center px-4 py-2.5">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F1F5F9]">
                    {filtered.map(t => {
                      const sc = STATUT_CFG[t.statut]
                      return (
                        <tr key={t.id} className="hover:bg-[#F8FAFC] group">
                          <td className="px-4 py-3">
                            <p className="font-bold text-[#0F172A] line-clamp-2 max-w-xs">{t.titre}</p>
                            {t.domaine && <p className="text-[10px] text-[#94A3B8]">{t.domaine}</p>}
                          </td>
                          <td className="px-4 py-3 font-semibold text-[#374151]">{t.etudiant_nom}</td>
                          <td className="px-4 py-3 text-[#64748B]">{t.directeur_nom ?? '—'}</td>
                          <td className="px-4 py-3 text-[#64748B]">{t.niveau ?? '—'}</td>
                          <td className="px-4 py-3 text-[#64748B]">{t.annee_universitaire ?? '—'}</td>
                          <td className="px-4 py-3">
                            <span className="text-[10px] px-2 py-0.5 rounded-full font-bold" style={{ background: sc.bg, color: sc.color }}>{sc.label}</span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <button onClick={() => { setEditThese(t); setShowModal(true) }}
                              className="p-1.5 rounded-lg hover:bg-[#F1F5F9] text-[#94A3B8] opacity-0 group-hover:opacity-100 transition-opacity">
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

            {/* Mobile cards */}
            <div className="sm:hidden space-y-3">
              {filtered.map(t => {
                const sc = STATUT_CFG[t.statut]
                return (
                  <div key={t.id} className="bg-white rounded-2xl border border-[#E2E8F0] shadow-sm p-4" onClick={() => { setEditThese(t); setShowModal(true) }}>
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <p className="font-bold text-[13px] text-[#0F172A] flex-1 leading-tight">{t.titre}</p>
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-bold flex-shrink-0" style={{ background: sc.bg, color: sc.color }}>{sc.label}</span>
                    </div>
                    <p className="text-[12px] font-semibold text-[#374151] mb-1">{t.etudiant_nom}</p>
                    <div className="flex items-center gap-2 text-[11px] text-[#94A3B8]">
                      {t.directeur_nom && <span>Dir. {t.directeur_nom}</span>}
                      {t.niveau && <span>· {t.niveau}</span>}
                      {t.annee_universitaire && <span>· {t.annee_universitaire}</span>}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {showModal && (
        <ModalThese these={editThese} onClose={() => setShowModal(false)} onSaved={() => { setShowModal(false); load() }} />
      )}
    </div>
  )
}

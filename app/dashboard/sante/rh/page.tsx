'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { ArrowLeft, Plus, RefreshCw, Loader2, Users, X, Trash2 } from 'lucide-react'

interface Personnel {
  id: string; nom: string; prenom: string; poste: string; service: string | null
  telephone: string | null; email: string | null; numero_ordre: string | null; actif: boolean
}
interface Garde {
  id: string; date_garde: string; heure_debut: string; heure_fin: string
  service: string | null; type_garde: string; notes: string | null
  his_personnel: { nom: string; prenom: string; poste: string } | null
  clinique_medecins: { nom: string; prenom: string; specialite: string } | null
}
interface Medecin { id: string; nom: string; prenom: string; specialite: string }

const POSTES: Record<string, string> = {
  infirmier: 'Infirmier(ère)', aide_soignant: 'Aide-soignant(e)', sage_femme: 'Sage-femme',
  kinesitherapeute: 'Kinésithérapeute', secretaire_medical: 'Secrétaire médical',
  laborantin: 'Laborantin(e)', technicien_imagerie: 'Technicien imagerie',
  anesthesiste: 'Anesthésiste', pharmacien: 'Pharmacien(ne)', autre: 'Autre',
}
const SERVICES = ['medecine_generale','chirurgie','pediatrie','maternite','reanimation','urgences','labo','imagerie','bloc','pharmacie']
const SERVICE_LABEL: Record<string, string> = {
  medecine_generale: 'Médecine Gén.', chirurgie: 'Chirurgie', pediatrie: 'Pédiatrie',
  maternite: 'Maternité', reanimation: 'Réanimation', urgences: 'Urgences',
  labo: 'Laboratoire', imagerie: 'Imagerie', bloc: 'Bloc Op.', pharmacie: 'Pharmacie',
}
const TYPE_GARDE_COLOR: Record<string, string> = { garde: '#2563EB', astreinte: '#F59E0B', remplacement: '#16A34A' }

const INIT_PERS = { nom: '', prenom: '', poste: 'infirmier', service: '', telephone: '', email: '', numero_ordre: '', salaire: '' }
const INIT_GARDE = { personnel_id: '', medecin_id: '', date_garde: '', heure_debut: '08:00', heure_fin: '08:00', service: '', type_garde: 'garde', notes: '' }

export default function RHPage() {
  const [tab,       setTab]       = useState<'personnel' | 'gardes'>('personnel')
  const [personnel, setPersonnel] = useState<Personnel[]>([])
  const [gardes,    setGardes]    = useState<Garde[]>([])
  const [medecins,  setMedecins]  = useState<Medecin[]>([])
  const [loading,   setLoading]   = useState(true)
  const [showForm,  setShowForm]  = useState(false)
  const [formP,     setFormP]     = useState({ ...INIT_PERS })
  const [formG,     setFormG]     = useState({ ...INIT_GARDE })
  const [saving,    setSaving]    = useState(false)

  const today  = new Date().toISOString().split('T')[0]
  const nextWk = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0]

  const load = useCallback(async () => {
    setLoading(true)
    if (tab === 'personnel') {
      const [pRes, mRes] = await Promise.all([
        fetch('/api/sante/rh?type=personnel'),
        fetch('/api/sante/medecins?actif=true'),
      ])
      if (pRes.ok) { const d = await pRes.json(); setPersonnel(d.personnel ?? []) }
      if (mRes.ok) { const d = await mRes.json(); setMedecins(d.data ?? []) }
    } else {
      const [gRes, mRes] = await Promise.all([
        fetch(`/api/sante/rh?type=gardes&from=${today}&to=${nextWk}`),
        fetch('/api/sante/medecins?actif=true'),
      ])
      if (gRes.ok) { const d = await gRes.json(); setGardes(d.gardes ?? []) }
      if (mRes.ok) { const d = await mRes.json(); setMedecins(d.data ?? []) }
    }
    setLoading(false)
  }, [tab, today, nextWk])

  useEffect(() => { load() }, [load])

  async function archivePersonnel(id: string) {
    await fetch('/api/sante/rh', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, actif: false }),
    })
    load()
  }

  async function deleteGarde(id: string) {
    await fetch(`/api/sante/rh?id=${id}&target=garde`, { method: 'DELETE' })
    load()
  }

  async function createPersonnel(e: React.FormEvent) {
    e.preventDefault(); setSaving(true)
    await fetch('/api/sante/rh', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'personnel', ...formP, salaire: formP.salaire ? Number(formP.salaire) : 0 }),
    })
    setSaving(false); setShowForm(false); setFormP({ ...INIT_PERS }); load()
  }

  async function createGarde(e: React.FormEvent) {
    e.preventDefault(); setSaving(true)
    await fetch('/api/sante/rh', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'garde', ...formG }),
    })
    setSaving(false); setShowForm(false); setFormG({ ...INIT_GARDE }); load()
  }

  // Group gardes by date
  const gardesByDate = gardes.reduce<Record<string, Garde[]>>((acc, g) => {
    const d = g.date_garde
    if (!acc[d]) acc[d] = []
    acc[d].push(g)
    return acc
  }, {})

  return (
    <div className="min-h-screen bg-[#F8FAFC] pb-20">
      <div className="bg-white border-b border-[#E2E8F0] px-4 sm:px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/dashboard/sante" className="flex items-center gap-1 text-[#64748B] text-[13px]"><ArrowLeft size={14} /> Santé</Link>
            <span className="text-[#E2E8F0]">/</span>
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-[#475569] rounded-lg flex items-center justify-center"><Users size={12} className="text-white" /></div>
              <h1 className="text-[16px] font-black text-[#0F172A]">RH Médical</h1>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={load} className="p-2 border border-[#E2E8F0] rounded-xl text-[#64748B]"><RefreshCw size={13} /></button>
            <button onClick={() => setShowForm(true)}
              className="flex items-center gap-1.5 px-3 py-2 bg-[#475569] text-white rounded-xl text-[12px] font-bold hover:bg-slate-700">
              <Plus size={12} /> {tab === 'personnel' ? 'Nouveau membre' : 'Garde'}
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white border-b border-[#E2E8F0] px-4 sm:px-6 py-2">
        <div className="max-w-5xl mx-auto flex gap-2">
          {[['personnel','Personnel'],['gardes','Planning gardes']].map(([k,l]) => (
            <button key={k} onClick={() => setTab(k as 'personnel' | 'gardes')}
              className={`px-4 py-1.5 rounded-xl text-[12px] font-bold ${tab === k ? 'bg-[#475569] text-white' : 'bg-[#F8FAFC] text-[#64748B]'}`}>
              {l}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-5">
        {loading ? (
          <div className="flex justify-center py-16 gap-2 text-[#94A3B8]"><Loader2 size={18} className="animate-spin" /></div>
        ) : tab === 'personnel' ? (
          <div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-[12px]">
                <thead className="bg-[#F8FAFC]">
                  <tr>
                    {['Nom','Poste','Service','Téléphone','N° Ordre','Statut','Action'].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-[10px] font-bold text-[#94A3B8] uppercase tracking-wide border-b border-[#E2E8F0]">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {personnel.map(p => (
                    <tr key={p.id} className={`border-b border-[#F1F5F9] hover:bg-[#F8FAFC] ${!p.actif ? 'opacity-50' : ''}`}>
                      <td className="px-4 py-3 font-semibold text-[#0F172A]">{p.prenom} {p.nom}</td>
                      <td className="px-4 py-3 text-[#475569]">{POSTES[p.poste] ?? p.poste}</td>
                      <td className="px-4 py-3 text-[#64748B]">{p.service ? (SERVICE_LABEL[p.service] ?? p.service) : '—'}</td>
                      <td className="px-4 py-3 text-[#64748B]">{p.telephone ?? '—'}</td>
                      <td className="px-4 py-3 font-mono text-[#94A3B8]">{p.numero_ordre ?? '—'}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${p.actif ? 'bg-green-100 text-green-700' : 'bg-[#F1F5F9] text-[#94A3B8]'}`}>
                          {p.actif ? 'Actif' : 'Archivé'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {p.actif && (
                          <button onClick={() => archivePersonnel(p.id)} className="text-[11px] text-[#DC2626] hover:underline">Archiver</button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {personnel.length === 0 && (
                    <tr><td colSpan={7} className="px-4 py-10 text-center text-[#94A3B8]">Aucun membre du personnel</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          Object.keys(gardesByDate).length === 0 ? (
            <div className="bg-white rounded-2xl border border-dashed border-[#CBD5E1] p-16 text-center">
              <Users size={36} className="text-[#CBD5E1] mx-auto mb-3" />
              <p className="font-bold text-[#0F172A]">Aucune garde planifiée cette semaine</p>
            </div>
          ) : (
            <div className="space-y-4">
              {Object.entries(gardesByDate).sort(([a],[b]) => a.localeCompare(b)).map(([date, gs]) => (
                <div key={date}>
                  <p className="text-[11px] font-black text-[#94A3B8] uppercase tracking-wide mb-2">
                    {new Date(date + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: '2-digit', month: 'long' })}
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                    {gs.map(g => {
                      const nom = g.his_personnel ? `${g.his_personnel.prenom} ${g.his_personnel.nom}` :
                                  g.clinique_medecins ? `Dr ${g.clinique_medecins.prenom} ${g.clinique_medecins.nom}` : '?'
                      const poste = g.his_personnel?.poste ? (POSTES[g.his_personnel.poste] ?? g.his_personnel.poste) :
                                    g.clinique_medecins?.specialite ?? ''
                      return (
                        <div key={g.id} className="bg-white rounded-xl border border-[#E2E8F0] p-3 shadow-sm flex items-center justify-between gap-2">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="w-2 h-2 rounded-full" style={{ background: TYPE_GARDE_COLOR[g.type_garde] }} />
                              <span className="text-[12px] font-bold text-[#0F172A]">{nom}</span>
                            </div>
                            <p className="text-[10px] text-[#64748B] mt-0.5">{poste}</p>
                            <p className="text-[10px] text-[#94A3B8]">
                              {g.heure_debut} → {g.heure_fin}
                              {g.service ? ` · ${SERVICE_LABEL[g.service] ?? g.service}` : ''}
                            </p>
                          </div>
                          <button onClick={() => deleteGarde(g.id)} className="p-1.5 text-[#DC2626] hover:bg-red-50 rounded-lg">
                            <Trash2 size={12} />
                          </button>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          )
        )}
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4">
          <div className="bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl w-full sm:max-w-md max-h-[90vh] overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-[15px]">{tab === 'personnel' ? 'Nouveau membre du personnel' : 'Planifier une garde'}</h2>
              <button onClick={() => setShowForm(false)} className="p-1.5 rounded-lg hover:bg-[#F1F5F9]"><X size={16} /></button>
            </div>

            {tab === 'personnel' ? (
              <form onSubmit={createPersonnel} className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-bold text-[#64748B] uppercase">Prénom *</label>
                    <input required value={formP.prenom} onChange={e => setFormP(p => ({...p, prenom: e.target.value}))}
                      className="mt-1 w-full px-3 py-2 text-[13px] border border-[#E2E8F0] rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-300" />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-[#64748B] uppercase">Nom *</label>
                    <input required value={formP.nom} onChange={e => setFormP(p => ({...p, nom: e.target.value}))}
                      className="mt-1 w-full px-3 py-2 text-[13px] border border-[#E2E8F0] rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-300" />
                  </div>
                </div>
                <div>
                  <label className="text-[11px] font-bold text-[#64748B] uppercase">Poste *</label>
                  <select required value={formP.poste} onChange={e => setFormP(p => ({...p, poste: e.target.value}))}
                    className="mt-1 w-full px-3 py-2 text-[13px] border border-[#E2E8F0] rounded-xl bg-white focus:outline-none">
                    {Object.entries(POSTES).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-bold text-[#64748B] uppercase">Service</label>
                  <select value={formP.service} onChange={e => setFormP(p => ({...p, service: e.target.value}))}
                    className="mt-1 w-full px-3 py-2 text-[13px] border border-[#E2E8F0] rounded-xl bg-white focus:outline-none">
                    <option value="">Non assigné</option>
                    {SERVICES.map(s => <option key={s} value={s}>{SERVICE_LABEL[s]}</option>)}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-bold text-[#64748B] uppercase">Téléphone</label>
                    <input value={formP.telephone} onChange={e => setFormP(p => ({...p, telephone: e.target.value}))}
                      className="mt-1 w-full px-3 py-2 text-[13px] border border-[#E2E8F0] rounded-xl focus:outline-none" />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-[#64748B] uppercase">N° Ordre</label>
                    <input value={formP.numero_ordre} onChange={e => setFormP(p => ({...p, numero_ordre: e.target.value}))}
                      className="mt-1 w-full px-3 py-2 text-[13px] border border-[#E2E8F0] rounded-xl focus:outline-none" />
                  </div>
                </div>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setShowForm(false)} className="flex-1 py-2.5 border border-[#E2E8F0] rounded-xl text-[13px] text-[#64748B]">Annuler</button>
                  <button type="submit" disabled={saving || !formP.nom || !formP.prenom} className="flex-1 py-2.5 bg-[#475569] text-white rounded-xl text-[13px] font-bold disabled:opacity-50">
                    {saving ? '...' : 'Ajouter'}
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={createGarde} className="space-y-3">
                <div>
                  <label className="text-[11px] font-bold text-[#64748B] uppercase">Personnel paramédical</label>
                  <select value={formG.personnel_id} onChange={e => setFormG(p => ({...p, personnel_id: e.target.value}))}
                    className="mt-1 w-full px-3 py-2 text-[13px] border border-[#E2E8F0] rounded-xl bg-white focus:outline-none">
                    <option value="">Aucun</option>
                    {personnel.filter(p => p.actif).map(p => <option key={p.id} value={p.id}>{p.prenom} {p.nom} — {POSTES[p.poste]}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-bold text-[#64748B] uppercase">Médecin</label>
                  <select value={formG.medecin_id} onChange={e => setFormG(p => ({...p, medecin_id: e.target.value}))}
                    className="mt-1 w-full px-3 py-2 text-[13px] border border-[#E2E8F0] rounded-xl bg-white focus:outline-none">
                    <option value="">Aucun</option>
                    {medecins.map(m => <option key={m.id} value={m.id}>Dr {m.prenom} {m.nom} — {m.specialite}</option>)}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-bold text-[#64748B] uppercase">Date *</label>
                    <input required type="date" value={formG.date_garde} onChange={e => setFormG(p => ({...p, date_garde: e.target.value}))}
                      className="mt-1 w-full px-3 py-2 text-[13px] border border-[#E2E8F0] rounded-xl focus:outline-none" />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-[#64748B] uppercase">Type</label>
                    <select value={formG.type_garde} onChange={e => setFormG(p => ({...p, type_garde: e.target.value}))}
                      className="mt-1 w-full px-3 py-2 text-[13px] border border-[#E2E8F0] rounded-xl bg-white focus:outline-none">
                      <option value="garde">Garde</option>
                      <option value="astreinte">Astreinte</option>
                      <option value="remplacement">Remplacement</option>
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-bold text-[#64748B] uppercase">Début</label>
                    <input type="time" value={formG.heure_debut} onChange={e => setFormG(p => ({...p, heure_debut: e.target.value}))}
                      className="mt-1 w-full px-3 py-2 text-[13px] border border-[#E2E8F0] rounded-xl focus:outline-none" />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-[#64748B] uppercase">Fin</label>
                    <input type="time" value={formG.heure_fin} onChange={e => setFormG(p => ({...p, heure_fin: e.target.value}))}
                      className="mt-1 w-full px-3 py-2 text-[13px] border border-[#E2E8F0] rounded-xl focus:outline-none" />
                  </div>
                </div>
                <div>
                  <label className="text-[11px] font-bold text-[#64748B] uppercase">Service</label>
                  <select value={formG.service} onChange={e => setFormG(p => ({...p, service: e.target.value}))}
                    className="mt-1 w-full px-3 py-2 text-[13px] border border-[#E2E8F0] rounded-xl bg-white focus:outline-none">
                    <option value="">Non spécifié</option>
                    {SERVICES.map(s => <option key={s} value={s}>{SERVICE_LABEL[s]}</option>)}
                  </select>
                </div>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setShowForm(false)} className="flex-1 py-2.5 border border-[#E2E8F0] rounded-xl text-[13px] text-[#64748B]">Annuler</button>
                  <button type="submit" disabled={saving || !formG.date_garde || (!formG.personnel_id && !formG.medecin_id)}
                    className="flex-1 py-2.5 bg-[#475569] text-white rounded-xl text-[13px] font-bold disabled:opacity-50">
                    {saving ? '...' : 'Planifier'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

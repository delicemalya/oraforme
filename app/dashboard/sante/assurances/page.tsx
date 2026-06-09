'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { ArrowLeft, Plus, RefreshCw, Loader2, Shield, X } from 'lucide-react'

interface Assurance {
  id: string; nom: string; code: string | null; type: string; taux_couverture: number
  contacts: string | null; email: string | null; telephone: string | null; actif: boolean; nb_adherents: number
}
interface Dossier {
  id: string; numero_adherent: string | null; date_debut: string | null; date_fin: string | null
  taux_couverture: number | null; statut: string; notes: string | null
  clinique_patients: { nom: string; prenom: string; numero_dossier: string } | null
  his_assurances: { nom: string; code: string | null; type: string } | null
}
interface Patient { id: string; nom: string; prenom: string; numero_dossier: string }

const TYPE_LABEL: Record<string, string> = { publique: 'Publique', privee: 'Privée', mutuelle: 'Mutuelle', cnss: 'CNSS', cnamgs: 'CNAMGS' }
const TYPE_COLOR: Record<string, string> = { publique: '#2563EB', privee: '#7C3AED', mutuelle: '#16A34A', cnss: '#F59E0B', cnamgs: '#0891B2' }
const STATUT_DOSSIER: Record<string, { label: string; color: string }> = {
  actif:    { label: 'Actif',    color: '#16A34A' },
  expire:   { label: 'Expiré',   color: '#DC2626' },
  suspendu: { label: 'Suspendu', color: '#F59E0B' },
}

const INIT_ASSUR = { nom: '', code: '', type: 'privee', taux_couverture: '80', telephone: '', email: '', contacts: '' }
const INIT_DOSSIER = { patient_id: '', assurance_id: '', numero_adherent: '', date_debut: '', date_fin: '', taux_couverture: '', notes: '' }

export default function AssurancesPage() {
  const [tab,        setTab]        = useState<'compagnies' | 'dossiers'>('compagnies')
  const [assurances, setAssurances] = useState<Assurance[]>([])
  const [dossiers,   setDossiers]   = useState<Dossier[]>([])
  const [patients,   setPatients]   = useState<Patient[]>([])
  const [loading,    setLoading]    = useState(true)
  const [showForm,   setShowForm]   = useState(false)
  const [formA,      setFormA]      = useState({ ...INIT_ASSUR })
  const [formD,      setFormD]      = useState({ ...INIT_DOSSIER })
  const [saving,     setSaving]     = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    if (tab === 'compagnies') {
      const [aRes, pRes] = await Promise.all([
        fetch('/api/sante/assurances'),
        fetch('/api/sante/patients?actif=true&limit=300'),
      ])
      if (aRes.ok) { const d = await aRes.json(); setAssurances(d.assurances ?? []) }
      if (pRes.ok) { const d = await pRes.json(); setPatients(d.data ?? []) }
    } else {
      const [dRes, pRes] = await Promise.all([
        fetch('/api/sante/assurances?type=dossiers'),
        fetch('/api/sante/patients?actif=true&limit=300'),
      ])
      if (dRes.ok) { const d = await dRes.json(); setDossiers(d.dossiers ?? []) }
      if (pRes.ok) { const d = await pRes.json(); setPatients(d.data ?? []) }
    }
    setLoading(false)
  }, [tab])

  useEffect(() => { load() }, [load])

  async function createAssurance(e: React.FormEvent) {
    e.preventDefault(); setSaving(true)
    await fetch('/api/sante/assurances', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...formA, taux_couverture: Number(formA.taux_couverture) }),
    })
    setSaving(false); setShowForm(false); setFormA({ ...INIT_ASSUR }); load()
  }

  async function createDossier(e: React.FormEvent) {
    e.preventDefault(); setSaving(true)
    await fetch('/api/sante/assurances', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'dossier', ...formD, taux_couverture: formD.taux_couverture ? Number(formD.taux_couverture) : undefined }),
    })
    setSaving(false); setShowForm(false); setFormD({ ...INIT_DOSSIER }); load()
  }

  async function toggleActif(id: string, actif: boolean) {
    await fetch('/api/sante/assurances', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, actif }),
    })
    load()
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] pb-20">
      <div className="bg-white border-b border-[#E2E8F0] px-4 sm:px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/dashboard/sante" className="flex items-center gap-1 text-[#64748B] text-[13px]"><ArrowLeft size={14} /> Santé</Link>
            <span className="text-[#E2E8F0]">/</span>
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-[#4F46E5] rounded-lg flex items-center justify-center"><Shield size={12} className="text-white" /></div>
              <h1 className="text-[16px] font-black text-[#0F172A]">Assurances</h1>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={load} className="p-2 border border-[#E2E8F0] rounded-xl text-[#64748B]"><RefreshCw size={13} /></button>
            <button onClick={() => setShowForm(true)}
              className="flex items-center gap-1.5 px-3 py-2 bg-[#4F46E5] text-white rounded-xl text-[12px] font-bold hover:bg-indigo-800">
              <Plus size={12} /> {tab === 'compagnies' ? 'Compagnie' : 'Dossier'}
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white border-b border-[#E2E8F0] px-4 sm:px-6 py-2">
        <div className="max-w-5xl mx-auto flex gap-2">
          {[['compagnies','Compagnies'],['dossiers','Dossiers patients']].map(([k,l]) => (
            <button key={k} onClick={() => setTab(k as 'compagnies' | 'dossiers')}
              className={`px-4 py-1.5 rounded-xl text-[12px] font-bold ${tab === k ? 'bg-[#4F46E5] text-white' : 'bg-[#F8FAFC] text-[#64748B]'}`}>
              {l}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-5">
        {loading ? (
          <div className="flex justify-center py-16 gap-2 text-[#94A3B8]"><Loader2 size={18} className="animate-spin" /></div>
        ) : tab === 'compagnies' ? (
          assurances.length === 0 ? (
            <div className="bg-white rounded-2xl border border-dashed border-[#CBD5E1] p-16 text-center">
              <Shield size={36} className="text-[#CBD5E1] mx-auto mb-3" />
              <p className="font-bold text-[#0F172A]">Aucune compagnie d'assurance</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {assurances.map(a => (
                <div key={a.id} className={`bg-white rounded-2xl border shadow-sm p-4 ${!a.actif ? 'opacity-60' : ''}`}
                  style={{ borderColor: (TYPE_COLOR[a.type] ?? '#E2E8F0') + '40' }}>
                  <div className="flex items-start justify-between mb-2">
                    <span className="px-2 py-0.5 text-[10px] font-black rounded-full text-white" style={{ background: TYPE_COLOR[a.type] ?? '#94A3B8' }}>
                      {TYPE_LABEL[a.type] ?? a.type}
                    </span>
                    <button onClick={() => toggleActif(a.id, !a.actif)}
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${a.actif ? 'bg-green-100 text-green-700' : 'bg-[#F1F5F9] text-[#94A3B8]'}`}>
                      {a.actif ? 'Actif' : 'Inactif'}
                    </button>
                  </div>
                  <p className="font-black text-[15px] text-[#0F172A]">{a.nom}</p>
                  {a.code && <p className="text-[11px] text-[#94A3B8] font-mono">{a.code}</p>}
                  <p className="text-[13px] font-bold mt-2" style={{ color: TYPE_COLOR[a.type] }}>
                    {a.taux_couverture}% couverture
                  </p>
                  <div className="mt-2 space-y-0.5">
                    {a.telephone && <p className="text-[11px] text-[#64748B]">📞 {a.telephone}</p>}
                    {a.email && <p className="text-[11px] text-[#64748B]">✉ {a.email}</p>}
                  </div>
                  <p className="text-[10px] text-[#94A3B8] mt-2">{a.nb_adherents} adhérent(s) actif(s)</p>
                </div>
              ))}
            </div>
          )
        ) : (
          dossiers.length === 0 ? (
            <div className="bg-white rounded-2xl border border-dashed border-[#CBD5E1] p-16 text-center">
              <Shield size={36} className="text-[#CBD5E1] mx-auto mb-3" />
              <p className="font-bold text-[#0F172A]">Aucun dossier assurance</p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-[12px]">
                  <thead className="bg-[#F8FAFC]">
                    <tr>
                      {['Patient','Assurance','N° Adhérent','Validité','Couverture','Statut'].map(h => (
                        <th key={h} className="text-left px-4 py-3 text-[10px] font-bold text-[#94A3B8] uppercase tracking-wide border-b border-[#E2E8F0]">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {dossiers.map(d => {
                      const st  = STATUT_DOSSIER[d.statut] ?? STATUT_DOSSIER.actif
                      const pat = d.clinique_patients
                      const ass = d.his_assurances
                      const now = new Date()
                      const fin = d.date_fin ? new Date(d.date_fin) : null
                      const expired = fin && fin < now
                      return (
                        <tr key={d.id} className="border-b border-[#F1F5F9] hover:bg-[#F8FAFC]">
                          <td className="px-4 py-3">
                            <p className="font-semibold text-[#0F172A]">{pat ? `${pat.prenom} ${pat.nom}` : '—'}</p>
                            <p className="text-[10px] text-[#94A3B8]">{pat?.numero_dossier}</p>
                          </td>
                          <td className="px-4 py-3">
                            <p className="font-semibold">{ass?.nom ?? '—'}</p>
                            {ass?.type && <span className="text-[10px] font-bold" style={{ color: TYPE_COLOR[ass.type] }}>{TYPE_LABEL[ass.type]}</span>}
                          </td>
                          <td className="px-4 py-3 font-mono text-[#475569]">{d.numero_adherent ?? '—'}</td>
                          <td className="px-4 py-3 text-[#64748B]">
                            {d.date_debut && <span>{new Date(d.date_debut).toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' })}</span>}
                            {d.date_debut && d.date_fin && <span> → </span>}
                            {d.date_fin && <span className={expired ? 'text-red-500' : ''}>{new Date(d.date_fin).toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' })}</span>}
                          </td>
                          <td className="px-4 py-3 font-bold text-[#4F46E5]">{d.taux_couverture ?? '—'}%</td>
                          <td className="px-4 py-3">
                            <span className="px-2 py-0.5 text-[10px] font-bold rounded-full" style={{ background: st.color + '18', color: st.color }}>{st.label}</span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )
        )}
      </div>

      {/* Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4">
          <div className="bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl w-full sm:max-w-md max-h-[90vh] overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-[15px]">{tab === 'compagnies' ? 'Nouvelle compagnie' : 'Nouveau dossier'}</h2>
              <button onClick={() => setShowForm(false)} className="p-1.5 rounded-lg hover:bg-[#F1F5F9]"><X size={16} /></button>
            </div>

            {tab === 'compagnies' ? (
              <form onSubmit={createAssurance} className="space-y-3">
                <div>
                  <label className="text-[11px] font-bold text-[#64748B] uppercase">Nom *</label>
                  <input required value={formA.nom} onChange={e => setFormA(p => ({...p, nom: e.target.value}))}
                    className="mt-1 w-full px-3 py-2 text-[13px] border border-[#E2E8F0] rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-300" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-bold text-[#64748B] uppercase">Code</label>
                    <input value={formA.code} onChange={e => setFormA(p => ({...p, code: e.target.value}))}
                      placeholder="CNSS, AXA..." className="mt-1 w-full px-3 py-2 text-[13px] border border-[#E2E8F0] rounded-xl focus:outline-none" />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-[#64748B] uppercase">Type</label>
                    <select value={formA.type} onChange={e => setFormA(p => ({...p, type: e.target.value}))}
                      className="mt-1 w-full px-3 py-2 text-[13px] border border-[#E2E8F0] rounded-xl bg-white focus:outline-none">
                      {Object.entries(TYPE_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="text-[11px] font-bold text-[#64748B] uppercase">Taux de couverture (%)</label>
                  <input type="number" min={0} max={100} value={formA.taux_couverture} onChange={e => setFormA(p => ({...p, taux_couverture: e.target.value}))}
                    className="mt-1 w-full px-3 py-2 text-[13px] border border-[#E2E8F0] rounded-xl focus:outline-none" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-bold text-[#64748B] uppercase">Téléphone</label>
                    <input value={formA.telephone} onChange={e => setFormA(p => ({...p, telephone: e.target.value}))}
                      className="mt-1 w-full px-3 py-2 text-[13px] border border-[#E2E8F0] rounded-xl focus:outline-none" />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-[#64748B] uppercase">Email</label>
                    <input type="email" value={formA.email} onChange={e => setFormA(p => ({...p, email: e.target.value}))}
                      className="mt-1 w-full px-3 py-2 text-[13px] border border-[#E2E8F0] rounded-xl focus:outline-none" />
                  </div>
                </div>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setShowForm(false)} className="flex-1 py-2.5 border border-[#E2E8F0] rounded-xl text-[13px] text-[#64748B]">Annuler</button>
                  <button type="submit" disabled={saving || !formA.nom} className="flex-1 py-2.5 bg-[#4F46E5] text-white rounded-xl text-[13px] font-bold disabled:opacity-50">
                    {saving ? '...' : 'Créer'}
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={createDossier} className="space-y-3">
                <div>
                  <label className="text-[11px] font-bold text-[#64748B] uppercase">Patient *</label>
                  <select required value={formD.patient_id} onChange={e => setFormD(p => ({...p, patient_id: e.target.value}))}
                    className="mt-1 w-full px-3 py-2 text-[13px] border border-[#E2E8F0] rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300">
                    <option value="">Sélectionner...</option>
                    {patients.map(p => <option key={p.id} value={p.id}>{p.prenom} {p.nom} ({p.numero_dossier})</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-bold text-[#64748B] uppercase">Compagnie *</label>
                  <select required value={formD.assurance_id} onChange={e => setFormD(p => ({...p, assurance_id: e.target.value}))}
                    className="mt-1 w-full px-3 py-2 text-[13px] border border-[#E2E8F0] rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300">
                    <option value="">Sélectionner...</option>
                    {assurances.map(a => <option key={a.id} value={a.id}>{a.nom} ({TYPE_LABEL[a.type]})</option>)}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-bold text-[#64748B] uppercase">N° Adhérent</label>
                    <input value={formD.numero_adherent} onChange={e => setFormD(p => ({...p, numero_adherent: e.target.value}))}
                      className="mt-1 w-full px-3 py-2 text-[13px] border border-[#E2E8F0] rounded-xl focus:outline-none" />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-[#64748B] uppercase">Taux couverture %</label>
                    <input type="number" min={0} max={100} value={formD.taux_couverture} onChange={e => setFormD(p => ({...p, taux_couverture: e.target.value}))}
                      placeholder="Hérite compagnie" className="mt-1 w-full px-3 py-2 text-[13px] border border-[#E2E8F0] rounded-xl focus:outline-none" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-bold text-[#64748B] uppercase">Début</label>
                    <input type="date" value={formD.date_debut} onChange={e => setFormD(p => ({...p, date_debut: e.target.value}))}
                      className="mt-1 w-full px-3 py-2 text-[13px] border border-[#E2E8F0] rounded-xl focus:outline-none" />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-[#64748B] uppercase">Expiration</label>
                    <input type="date" value={formD.date_fin} onChange={e => setFormD(p => ({...p, date_fin: e.target.value}))}
                      className="mt-1 w-full px-3 py-2 text-[13px] border border-[#E2E8F0] rounded-xl focus:outline-none" />
                  </div>
                </div>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setShowForm(false)} className="flex-1 py-2.5 border border-[#E2E8F0] rounded-xl text-[13px] text-[#64748B]">Annuler</button>
                  <button type="submit" disabled={saving || !formD.patient_id || !formD.assurance_id} className="flex-1 py-2.5 bg-[#4F46E5] text-white rounded-xl text-[13px] font-bold disabled:opacity-50">
                    {saving ? '...' : 'Créer dossier'}
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

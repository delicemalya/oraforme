'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { ArrowLeft, Plus, RefreshCw, Loader2, BedDouble, X } from 'lucide-react'

interface Lit {
  id: string; service: string; numero: string; type: string; statut: string; etage: number; notes: string | null
  sejour_actif: {
    id: string; motif_admission: string; date_entree: string; numero_sejour: string
    clinique_patients: { nom: string; prenom: string; numero_dossier: string } | null
  } | null
}
interface Patient { id: string; nom: string; prenom: string; numero_dossier: string }
interface Medecin { id: string; nom: string; prenom: string; specialite: string }

const SERVICES = ['medecine_generale','chirurgie','pediatrie','maternite','reanimation','urgences']
const SERVICE_LABEL: Record<string, string> = {
  medecine_generale: 'Médecine Générale', chirurgie: 'Chirurgie', pediatrie: 'Pédiatrie',
  maternite: 'Maternité', reanimation: 'Réanimation', urgences: 'Urgences',
}
const SERVICE_COLOR: Record<string, string> = {
  medecine_generale: '#2563EB', chirurgie: '#EA580C', pediatrie: '#EC4899',
  maternite: '#8B5CF6', reanimation: '#DC2626', urgences: '#F59E0B',
}

const STATUT_STYLE: Record<string, { label: string; color: string; bg: string }> = {
  libre:        { label: 'Libre',        color: '#16A34A', bg: '#F0FDF4' },
  occupe:       { label: 'Occupé',       color: '#DC2626', bg: '#FEF2F2' },
  reserve:      { label: 'Réservé',      color: '#F59E0B', bg: '#FFFBEB' },
  maintenance:  { label: 'Maintenance',  color: '#94A3B8', bg: '#F1F5F9' },
  desinfection: { label: 'Désinfection', color: '#2563EB', bg: '#EFF6FF' },
}

const INIT_LIT = { service: 'medecine_generale', numero: '', type: 'standard', etage: '1' }
const INIT_ADM = { patient_id: '', lit_id: '', medecin_referent_id: '', motif_admission: '', date_sortie_prevue: '', notes: '' }

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })
}

export default function HospitalisationPage() {
  const [lits,      setLits]      = useState<Lit[]>([])
  const [patients,  setPatients]  = useState<Patient[]>([])
  const [medecins,  setMedecins]  = useState<Medecin[]>([])
  const [loading,   setLoading]   = useState(true)
  const [service,   setService]   = useState('all')
  const [showLit,   setShowLit]   = useState(false)
  const [showAdm,   setShowAdm]   = useState(false)
  const [admLitId,  setAdmLitId]  = useState('')
  const [formLit,   setFormLit]   = useState({ ...INIT_LIT })
  const [formAdm,   setFormAdm]   = useState({ ...INIT_ADM })
  const [saving,    setSaving]    = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const [lRes, pRes, mRes] = await Promise.all([
      fetch('/api/sante/lits'),
      fetch('/api/sante/patients?actif=true&limit=300'),
      fetch('/api/sante/medecins?actif=true'),
    ])
    if (lRes.ok) { const d = await lRes.json(); setLits(d.lits ?? []) }
    if (pRes.ok) { const d = await pRes.json(); setPatients(d.data ?? []) }
    if (mRes.ok) { const d = await mRes.json(); setMedecins(d.data ?? []) }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function addLit(e: React.FormEvent) {
    e.preventDefault(); setSaving(true)
    await fetch('/api/sante/lits', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...formLit, etage: Number(formLit.etage) }),
    })
    setSaving(false); setShowLit(false); setFormLit({ ...INIT_LIT }); load()
  }

  async function admitPatient(e: React.FormEvent) {
    e.preventDefault(); setSaving(true)
    await fetch('/api/sante/sejours', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...formAdm, lit_id: admLitId || formAdm.lit_id || undefined }),
    })
    setSaving(false); setShowAdm(false); setFormAdm({ ...INIT_ADM }); setAdmLitId(''); load()
  }

  async function sortiePatient(sejourId: string) {
    await fetch('/api/sante/sejours', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: sejourId, statut: 'sorti', type_sortie: 'guerison' }),
    })
    load()
  }

  const displayed = service === 'all' ? lits : lits.filter(l => l.service === service)
  const byService = SERVICES.filter(s => service === 'all' || s === service)
  const litsOccupes = lits.filter(l => l.statut === 'occupe').length

  return (
    <div className="min-h-screen bg-[#F8FAFC] pb-20">
      <div className="bg-white border-b border-[#E2E8F0] px-4 sm:px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/dashboard/sante" className="flex items-center gap-1 text-[#64748B] text-[13px]"><ArrowLeft size={14} /> Santé</Link>
            <span className="text-[#E2E8F0]">/</span>
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-[#2563EB] rounded-lg flex items-center justify-center">
                <BedDouble size={12} className="text-white" />
              </div>
              <h1 className="text-[16px] font-black text-[#0F172A]">Hospitalisation</h1>
              <span className="px-2 py-0.5 bg-blue-100 text-blue-600 text-[11px] font-black rounded-full">
                {litsOccupes}/{lits.length} occupés
              </span>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={load} className="p-2 border border-[#E2E8F0] rounded-xl text-[#64748B]"><RefreshCw size={13} /></button>
            <button onClick={() => setShowAdm(true)}
              className="flex items-center gap-1.5 px-3 py-2 bg-[#2563EB] text-white rounded-xl text-[12px] font-bold hover:bg-blue-700">
              <Plus size={12} /> Admission
            </button>
            <button onClick={() => setShowLit(true)}
              className="flex items-center gap-1.5 px-3 py-2 bg-white border border-[#E2E8F0] text-[#475569] rounded-xl text-[12px] font-bold hover:bg-[#F8FAFC]">
              <Plus size={12} /> Lit
            </button>
          </div>
        </div>
      </div>

      {/* Service filter */}
      <div className="bg-white border-b border-[#E2E8F0] px-4 sm:px-6 py-2">
        <div className="max-w-7xl mx-auto flex gap-2 overflow-x-auto">
          {[{ key: 'all', label: 'Tous' }, ...SERVICES.map(s => ({ key: s, label: SERVICE_LABEL[s] }))].map(opt => (
            <button key={opt.key} onClick={() => setService(opt.key)}
              className={`shrink-0 px-3 py-1.5 rounded-xl text-[11px] font-bold transition-all ${service === opt.key ? 'bg-[#2563EB] text-white' : 'bg-[#F8FAFC] text-[#64748B] hover:bg-[#E2E8F0]'}`}>
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-5">
        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-5">
          {Object.entries(STATUT_STYLE).map(([k, s]) => (
            <div key={k} className="bg-white rounded-2xl border border-[#E2E8F0] p-3 text-center shadow-sm">
              <p className="text-[20px] font-black" style={{ color: s.color }}>
                {displayed.filter(l => l.statut === k).length}
              </p>
              <p className="text-[9px] font-bold text-[#94A3B8] uppercase tracking-wide">{s.label}</p>
            </div>
          ))}
        </div>

        {loading ? (
          <div className="flex justify-center py-16 gap-2 text-[#94A3B8]"><Loader2 size={18} className="animate-spin" /> Chargement...</div>
        ) : (
          <div className="space-y-6">
            {byService.map(svc => {
              const svcLits = displayed.filter(l => l.service === svc)
              if (!svcLits.length) return null
              return (
                <div key={svc}>
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-3 h-3 rounded-full" style={{ background: SERVICE_COLOR[svc] }} />
                    <h2 className="text-[13px] font-black text-[#0F172A] uppercase tracking-wide">{SERVICE_LABEL[svc]}</h2>
                    <span className="text-[11px] text-[#94A3B8]">
                      {svcLits.filter(l => l.statut === 'occupe').length}/{svcLits.length} lits
                    </span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
                    {svcLits.map(lit => {
                      const st = STATUT_STYLE[lit.statut] ?? STATUT_STYLE.libre
                      const patient = lit.sejour_actif?.clinique_patients
                      return (
                        <div key={lit.id} className="bg-white rounded-xl border-2 p-2.5 shadow-sm relative"
                          style={{ borderColor: st.color + '60', background: st.bg }}>
                          <div className="flex items-start justify-between mb-1">
                            <span className="text-[13px] font-black" style={{ color: SERVICE_COLOR[svc] }}>
                              {lit.numero}
                            </span>
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full text-white" style={{ background: st.color }}>
                              {st.label}
                            </span>
                          </div>
                          {patient ? (
                            <>
                              <p className="text-[11px] font-bold text-[#0F172A] leading-tight">{patient.prenom} {patient.nom}</p>
                              <p className="text-[9px] text-[#64748B]">{patient.numero_dossier}</p>
                              <p className="text-[9px] text-[#94A3B8] mt-0.5">
                                Entrée {fmtDate(lit.sejour_actif!.date_entree)}
                              </p>
                              <button onClick={() => sortiePatient(lit.sejour_actif!.id)}
                                className="mt-1.5 w-full py-1 text-[9px] font-bold rounded-lg border border-green-200 text-green-600 hover:bg-green-50">
                                ✓ Sortie
                              </button>
                            </>
                          ) : lit.statut === 'libre' ? (
                            <button onClick={() => { setAdmLitId(lit.id); setShowAdm(true) }}
                              className="mt-1 w-full py-1 text-[9px] font-bold rounded-lg border border-blue-200 text-blue-600 hover:bg-blue-50">
                              + Admettre
                            </button>
                          ) : (
                            <p className="text-[9px] text-[#94A3B8] mt-1">{lit.type}</p>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Modal admission */}
      {showAdm && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4">
          <div className="bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl w-full sm:max-w-md max-h-[90vh] overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-[15px] text-[#0F172A]">Nouvelle admission</h2>
              <button onClick={() => { setShowAdm(false); setAdmLitId('') }} className="p-1.5 rounded-lg hover:bg-[#F1F5F9]"><X size={16} /></button>
            </div>
            <form onSubmit={admitPatient} className="space-y-3">
              <div>
                <label className="text-[11px] font-bold text-[#64748B] uppercase">Patient *</label>
                <select required value={formAdm.patient_id} onChange={e => setFormAdm(p => ({...p, patient_id: e.target.value}))}
                  className="mt-1 w-full px-3 py-2 text-[13px] border border-[#E2E8F0] rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-blue-300">
                  <option value="">Sélectionner un patient...</option>
                  {patients.map(p => <option key={p.id} value={p.id}>{p.prenom} {p.nom} ({p.numero_dossier})</option>)}
                </select>
              </div>
              {!admLitId && (
                <div>
                  <label className="text-[11px] font-bold text-[#64748B] uppercase">Lit (optionnel)</label>
                  <select value={formAdm.lit_id} onChange={e => setFormAdm(p => ({...p, lit_id: e.target.value}))}
                    className="mt-1 w-full px-3 py-2 text-[13px] border border-[#E2E8F0] rounded-xl bg-white focus:outline-none">
                    <option value="">Choisir un lit libre...</option>
                    {lits.filter(l => l.statut === 'libre').map(l => (
                      <option key={l.id} value={l.id}>Lit {l.numero} — {SERVICE_LABEL[l.service]}</option>
                    ))}
                  </select>
                </div>
              )}
              {admLitId && (
                <div className="px-3 py-2 bg-blue-50 rounded-xl text-[12px] text-blue-700 font-semibold">
                  Lit {lits.find(l => l.id === admLitId)?.numero} — {SERVICE_LABEL[lits.find(l => l.id === admLitId)?.service ?? '']}
                </div>
              )}
              <div>
                <label className="text-[11px] font-bold text-[#64748B] uppercase">Médecin référent</label>
                <select value={formAdm.medecin_referent_id} onChange={e => setFormAdm(p => ({...p, medecin_referent_id: e.target.value}))}
                  className="mt-1 w-full px-3 py-2 text-[13px] border border-[#E2E8F0] rounded-xl bg-white focus:outline-none">
                  <option value="">Aucun</option>
                  {medecins.map(m => <option key={m.id} value={m.id}>Dr {m.prenom} {m.nom} — {m.specialite}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[11px] font-bold text-[#64748B] uppercase">Motif d'admission *</label>
                <textarea required rows={2} value={formAdm.motif_admission} onChange={e => setFormAdm(p => ({...p, motif_admission: e.target.value}))}
                  className="mt-1 w-full px-3 py-2 text-[13px] border border-[#E2E8F0] rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-300 resize-none" />
              </div>
              <div>
                <label className="text-[11px] font-bold text-[#64748B] uppercase">Sortie prévue</label>
                <input type="date" value={formAdm.date_sortie_prevue} onChange={e => setFormAdm(p => ({...p, date_sortie_prevue: e.target.value}))}
                  className="mt-1 w-full px-3 py-2 text-[13px] border border-[#E2E8F0] rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-300" />
              </div>
              <div className="flex gap-2 pt-1">
                <button type="button" onClick={() => { setShowAdm(false); setAdmLitId('') }}
                  className="flex-1 py-2.5 border border-[#E2E8F0] rounded-xl text-[13px] font-semibold text-[#64748B]">Annuler</button>
                <button type="submit" disabled={saving || !formAdm.patient_id || !formAdm.motif_admission}
                  className="flex-1 py-2.5 bg-[#2563EB] text-white rounded-xl text-[13px] font-bold hover:bg-blue-700 disabled:opacity-50">
                  {saving ? 'Admission...' : 'Admettre'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal ajout lit */}
      {showLit && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4">
          <div className="bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl w-full sm:max-w-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-[15px] text-[#0F172A]">Ajouter un lit</h2>
              <button onClick={() => setShowLit(false)} className="p-1.5 rounded-lg hover:bg-[#F1F5F9]"><X size={16} /></button>
            </div>
            <form onSubmit={addLit} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-[#64748B] uppercase">Numéro *</label>
                  <input required value={formLit.numero} onChange={e => setFormLit(p => ({...p, numero: e.target.value}))}
                    placeholder="101" className="mt-1 w-full px-3 py-2 text-[13px] border border-[#E2E8F0] rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-300" />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-[#64748B] uppercase">Étage</label>
                  <input type="number" value={formLit.etage} onChange={e => setFormLit(p => ({...p, etage: e.target.value}))}
                    className="mt-1 w-full px-3 py-2 text-[13px] border border-[#E2E8F0] rounded-xl focus:outline-none" />
                </div>
              </div>
              <div>
                <label className="text-[11px] font-bold text-[#64748B] uppercase">Service *</label>
                <select required value={formLit.service} onChange={e => setFormLit(p => ({...p, service: e.target.value}))}
                  className="mt-1 w-full px-3 py-2 text-[13px] border border-[#E2E8F0] rounded-xl bg-white focus:outline-none">
                  {SERVICES.map(s => <option key={s} value={s}>{SERVICE_LABEL[s]}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[11px] font-bold text-[#64748B] uppercase">Type</label>
                <select value={formLit.type} onChange={e => setFormLit(p => ({...p, type: e.target.value}))}
                  className="mt-1 w-full px-3 py-2 text-[13px] border border-[#E2E8F0] rounded-xl bg-white focus:outline-none">
                  <option value="standard">Standard</option>
                  <option value="vip">VIP</option>
                  <option value="reanimation">Réanimation</option>
                  <option value="isole">Isolé</option>
                  <option value="pediatrique">Pédiatrique</option>
                </select>
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={() => setShowLit(false)}
                  className="flex-1 py-2.5 border border-[#E2E8F0] rounded-xl text-[13px] font-semibold text-[#64748B]">Annuler</button>
                <button type="submit" disabled={saving || !formLit.numero}
                  className="flex-1 py-2.5 bg-[#2563EB] text-white rounded-xl text-[13px] font-bold disabled:opacity-50">
                  {saving ? '...' : 'Ajouter'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

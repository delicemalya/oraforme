'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { ArrowLeft, Plus, RefreshCw, Loader2, FlaskConical, ChevronDown, ChevronRight, X } from 'lucide-react'

interface Resultat { id: string; parametre: string; valeur: string; unite: string | null; valeur_normale: string | null; interpretation: string | null; technicien: string | null }
interface Examen {
  id: string; type_examen: string; statut: string; date_prescription: string; urgence: boolean; notes: string | null; examens: unknown[]
  clinique_patients: { nom: string; prenom: string; numero_dossier: string } | null
  clinique_medecins: { nom: string; prenom: string } | null
  his_resultats_labo: Resultat[]
}
interface Patient { id: string; nom: string; prenom: string; numero_dossier: string }

const STATUTS: Record<string, { label: string; color: string; next?: string; nextLabel?: string }> = {
  prescrit:          { label: 'Prescrit',  color: '#F59E0B', next: 'en_cours',          nextLabel: '▶ Démarrer' },
  en_cours:          { label: 'En cours',  color: '#2563EB', next: 'resultat_complet',   nextLabel: '✓ Résultats prêts' },
  resultat_partiel:  { label: 'Partiel',   color: '#EA580C' },
  resultat_complet:  { label: 'Complet',   color: '#16A34A' },
  annule:            { label: 'Annulé',    color: '#94A3B8' },
}

const INTERP_COLOR: Record<string, string> = { normal: '#16A34A', bas: '#2563EB', eleve: '#F59E0B', critique: '#DC2626' }

const TYPES = ['NFS','Biochimie','Bacteriologie','Serologie','Hormones','Coagulation','Urines','Autres']
const INIT_FORM = { patient_id: '', type_examen: 'NFS', urgence: false, notes: '' }
const INIT_RES = { parametre: '', valeur: '', unite: '', valeur_normale: '', interpretation: 'normal', technicien: '' }

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}

export default function LaboPage() {
  const [examens,   setExamens]   = useState<Examen[]>([])
  const [patients,  setPatients]  = useState<Patient[]>([])
  const [loading,   setLoading]   = useState(true)
  const [filter,    setFilter]    = useState('prescrit')
  const [expanded,  setExpanded]  = useState<Record<string, boolean>>({})
  const [showForm,  setShowForm]  = useState(false)
  const [showRes,   setShowRes]   = useState<string | null>(null)
  const [form,      setForm]      = useState({ ...INIT_FORM })
  const [resultats, setResultats] = useState([{ ...INIT_RES }])
  const [saving,    setSaving]    = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const [eRes, pRes] = await Promise.all([
      fetch(filter === 'all' ? '/api/sante/labo' : `/api/sante/labo?statut=${filter}`),
      fetch('/api/sante/patients?actif=true&limit=300'),
    ])
    if (eRes.ok) { const d = await eRes.json(); setExamens(d.examens ?? []) }
    if (pRes.ok) { const d = await pRes.json(); setPatients(d.data ?? []) }
    setLoading(false)
  }, [filter])

  useEffect(() => { load() }, [load])

  async function advanceStatut(id: string, statut: string) {
    await fetch('/api/sante/labo', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, statut }),
    })
    load()
  }

  async function createPrescription(e: React.FormEvent) {
    e.preventDefault(); setSaving(true)
    await fetch('/api/sante/labo', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    setSaving(false); setShowForm(false); setForm({ ...INIT_FORM }); load()
  }

  async function submitResultats(examenId: string) {
    setSaving(true)
    await fetch('/api/sante/labo', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'resultat', examen_id: examenId, resultats, statut: 'resultat_complet' }),
    })
    setSaving(false); setShowRes(null); setResultats([{ ...INIT_RES }]); load()
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] pb-20">
      <div className="bg-white border-b border-[#E2E8F0] px-4 sm:px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/dashboard/sante" className="flex items-center gap-1 text-[#64748B] text-[13px]"><ArrowLeft size={14} /> Santé</Link>
            <span className="text-[#E2E8F0]">/</span>
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-[#7C3AED] rounded-lg flex items-center justify-center">
                <FlaskConical size={12} className="text-white" />
              </div>
              <h1 className="text-[16px] font-black text-[#0F172A]">Laboratoire</h1>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={load} className="p-2 border border-[#E2E8F0] rounded-xl text-[#64748B]"><RefreshCw size={13} /></button>
            <button onClick={() => setShowForm(true)}
              className="flex items-center gap-1.5 px-3 py-2 bg-[#7C3AED] text-white rounded-xl text-[12px] font-bold hover:bg-purple-800">
              <Plus size={12} /> Prescrire
            </button>
          </div>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="bg-white border-b border-[#E2E8F0] px-4 sm:px-6 py-2">
        <div className="max-w-5xl mx-auto flex gap-2 overflow-x-auto">
          {[['all','Tous'],['prescrit','Prescrits'],['en_cours','En cours'],['resultat_complet','Résultats'],['annule','Annulés']].map(([k,l]) => (
            <button key={k} onClick={() => setFilter(k)}
              className={`shrink-0 px-3 py-1.5 rounded-xl text-[11px] font-bold ${filter === k ? 'bg-[#7C3AED] text-white' : 'bg-[#F8FAFC] text-[#64748B]'}`}>
              {l} {k !== 'all' && <span className="ml-1 font-black">{examens.filter(e => k === 'all' || e.statut === k).length}</span>}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-5">
        {loading ? (
          <div className="flex justify-center py-16 gap-2 text-[#94A3B8]"><Loader2 size={18} className="animate-spin" /> Chargement...</div>
        ) : examens.length === 0 ? (
          <div className="bg-white rounded-2xl border border-dashed border-[#CBD5E1] p-16 text-center">
            <FlaskConical size={36} className="text-[#CBD5E1] mx-auto mb-3" />
            <p className="font-bold text-[#0F172A]">Aucun examen dans cette catégorie</p>
          </div>
        ) : (
          <div className="space-y-2">
            {examens.map(ex => {
              const st    = STATUTS[ex.statut] ?? STATUTS.prescrit
              const isExp = expanded[ex.id]
              const patient = ex.clinique_patients
              return (
                <div key={ex.id} className="bg-white rounded-2xl border border-[#E2E8F0] shadow-sm overflow-hidden">
                  <div className="flex items-center gap-3 p-4 cursor-pointer" onClick={() => setExpanded(p => ({...p, [ex.id]: !isExp}))}>
                    {isExp ? <ChevronDown size={14} className="text-[#94A3B8] shrink-0" /> : <ChevronRight size={14} className="text-[#94A3B8] shrink-0" />}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="px-2 py-0.5 bg-purple-100 text-purple-700 text-[10px] font-black rounded-full">{ex.type_examen}</span>
                        {ex.urgence && <span className="px-1.5 py-0.5 bg-red-100 text-red-600 text-[9px] font-black rounded-full">URGENT</span>}
                        <span className="text-[13px] font-bold text-[#0F172A]">
                          {patient ? `${patient.prenom} ${patient.nom}` : 'Patient inconnu'}
                        </span>
                        {patient && <span className="text-[11px] text-[#94A3B8]">{patient.numero_dossier}</span>}
                      </div>
                      <p className="text-[11px] text-[#64748B] mt-0.5">
                        {fmtDate(ex.date_prescription)}
                        {ex.clinique_medecins && ` • Dr ${ex.clinique_medecins.prenom} ${ex.clinique_medecins.nom}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {ex.his_resultats_labo.length > 0 && (
                        <span className="text-[10px] text-[#64748B]">{ex.his_resultats_labo.length} résultat(s)</span>
                      )}
                      <span className="px-2 py-0.5 text-[10px] font-bold rounded-full" style={{ background: st.color + '18', color: st.color }}>{st.label}</span>
                      {st.next && (
                        <button onClick={e => { e.stopPropagation(); advanceStatut(ex.id, st.next!) }}
                          className="px-2 py-1 text-[10px] font-bold rounded-lg text-white" style={{ background: st.color }}>
                          {st.nextLabel}
                        </button>
                      )}
                      {ex.statut === 'en_cours' && (
                        <button onClick={e => { e.stopPropagation(); setShowRes(ex.id); setResultats([{ ...INIT_RES }]) }}
                          className="px-2 py-1 text-[10px] font-bold rounded-lg bg-[#7C3AED] text-white">
                          + Résultats
                        </button>
                      )}
                    </div>
                  </div>

                  {isExp && ex.his_resultats_labo.length > 0 && (
                    <div className="border-t border-[#F1F5F9] px-4 py-3">
                      <p className="text-[10px] font-black text-[#94A3B8] uppercase tracking-wide mb-2">Résultats</p>
                      <div className="overflow-x-auto">
                        <table className="w-full text-[12px]">
                          <thead>
                            <tr className="text-[9px] text-[#94A3B8] uppercase">
                              <th className="text-left pb-1 pr-3">Paramètre</th>
                              <th className="text-left pb-1 pr-3">Valeur</th>
                              <th className="text-left pb-1 pr-3">Normale</th>
                              <th className="text-left pb-1">Interprétation</th>
                            </tr>
                          </thead>
                          <tbody>
                            {ex.his_resultats_labo.map(r => (
                              <tr key={r.id} className="border-t border-[#F8FAFC]">
                                <td className="py-1 pr-3 font-semibold text-[#0F172A]">{r.parametre}</td>
                                <td className="py-1 pr-3 font-black" style={{ color: r.interpretation ? INTERP_COLOR[r.interpretation] : '#0F172A' }}>
                                  {r.valeur} {r.unite}
                                </td>
                                <td className="py-1 pr-3 text-[#94A3B8]">{r.valeur_normale ?? '—'}</td>
                                <td className="py-1">
                                  {r.interpretation && (
                                    <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold" style={{ background: INTERP_COLOR[r.interpretation] + '18', color: INTERP_COLOR[r.interpretation] }}>
                                      {r.interpretation}
                                    </span>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Modal prescription */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4">
          <div className="bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl w-full sm:max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-[15px]">Prescrire un examen</h2>
              <button onClick={() => setShowForm(false)} className="p-1.5 rounded-lg hover:bg-[#F1F5F9]"><X size={16} /></button>
            </div>
            <form onSubmit={createPrescription} className="space-y-3">
              <div>
                <label className="text-[11px] font-bold text-[#64748B] uppercase">Patient *</label>
                <select required value={form.patient_id} onChange={e => setForm(p => ({...p, patient_id: e.target.value}))}
                  className="mt-1 w-full px-3 py-2 text-[13px] border border-[#E2E8F0] rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-purple-300">
                  <option value="">Sélectionner...</option>
                  {patients.map(p => <option key={p.id} value={p.id}>{p.prenom} {p.nom} ({p.numero_dossier})</option>)}
                </select>
              </div>
              <div>
                <label className="text-[11px] font-bold text-[#64748B] uppercase">Type d'examen *</label>
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {TYPES.map(t => (
                    <button key={t} type="button" onClick={() => setForm(p => ({...p, type_examen: t}))}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-all ${form.type_examen === t ? 'bg-[#7C3AED] text-white border-[#7C3AED]' : 'bg-white text-[#64748B] border-[#E2E8F0]'}`}>
                      {t}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="urgLabo" checked={form.urgence} onChange={e => setForm(p => ({...p, urgence: e.target.checked}))} className="w-4 h-4 accent-red-500" />
                <label htmlFor="urgLabo" className="text-[13px] text-[#475569]">Examen urgent</label>
              </div>
              <div>
                <label className="text-[11px] font-bold text-[#64748B] uppercase">Notes</label>
                <textarea rows={2} value={form.notes} onChange={e => setForm(p => ({...p, notes: e.target.value}))}
                  className="mt-1 w-full px-3 py-2 text-[13px] border border-[#E2E8F0] rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-purple-300" />
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={() => setShowForm(false)}
                  className="flex-1 py-2.5 border border-[#E2E8F0] rounded-xl text-[13px] font-semibold text-[#64748B]">Annuler</button>
                <button type="submit" disabled={saving || !form.patient_id}
                  className="flex-1 py-2.5 bg-[#7C3AED] text-white rounded-xl text-[13px] font-bold disabled:opacity-50">
                  {saving ? 'Envoi...' : 'Prescrire'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal résultats */}
      {showRes && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4">
          <div className="bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl w-full sm:max-w-lg max-h-[90vh] overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-[15px]">Saisir les résultats</h2>
              <button onClick={() => setShowRes(null)} className="p-1.5 rounded-lg hover:bg-[#F1F5F9]"><X size={16} /></button>
            </div>
            <div className="space-y-3 mb-4">
              {resultats.map((r, i) => (
                <div key={i} className="bg-[#F8FAFC] rounded-xl p-3">
                  <div className="grid grid-cols-2 gap-2 mb-2">
                    <div>
                      <label className="text-[10px] font-bold text-[#64748B] uppercase">Paramètre</label>
                      <input value={r.parametre} onChange={e => setResultats(p => p.map((x,j) => j===i ? {...x, parametre:e.target.value} : x))}
                        placeholder="ex: Hémoglobine" className="mt-0.5 w-full px-2 py-1.5 text-[12px] border border-[#E2E8F0] rounded-lg focus:outline-none" />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-[#64748B] uppercase">Valeur</label>
                      <input value={r.valeur} onChange={e => setResultats(p => p.map((x,j) => j===i ? {...x, valeur:e.target.value} : x))}
                        placeholder="12.5" className="mt-0.5 w-full px-2 py-1.5 text-[12px] border border-[#E2E8F0] rounded-lg focus:outline-none" />
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="text-[10px] font-bold text-[#64748B] uppercase">Unité</label>
                      <input value={r.unite} onChange={e => setResultats(p => p.map((x,j) => j===i ? {...x, unite:e.target.value} : x))}
                        placeholder="g/dL" className="mt-0.5 w-full px-2 py-1.5 text-[12px] border border-[#E2E8F0] rounded-lg focus:outline-none" />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-[#64748B] uppercase">Normale</label>
                      <input value={r.valeur_normale} onChange={e => setResultats(p => p.map((x,j) => j===i ? {...x, valeur_normale:e.target.value} : x))}
                        placeholder="12-16" className="mt-0.5 w-full px-2 py-1.5 text-[12px] border border-[#E2E8F0] rounded-lg focus:outline-none" />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-[#64748B] uppercase">Interprét.</label>
                      <select value={r.interpretation} onChange={e => setResultats(p => p.map((x,j) => j===i ? {...x, interpretation:e.target.value} : x))}
                        className="mt-0.5 w-full px-2 py-1.5 text-[12px] border border-[#E2E8F0] rounded-lg bg-white focus:outline-none">
                        <option value="normal">Normal</option><option value="bas">Bas</option>
                        <option value="eleve">Élevé</option><option value="critique">Critique</option>
                      </select>
                    </div>
                  </div>
                  {resultats.length > 1 && (
                    <button type="button" onClick={() => setResultats(p => p.filter((_,j) => j !== i))}
                      className="mt-1 text-[10px] text-red-500">Supprimer</button>
                  )}
                </div>
              ))}
            </div>
            <button type="button" onClick={() => setResultats(p => [...p, { ...INIT_RES }])}
              className="w-full py-2 border border-dashed border-[#CBD5E1] rounded-xl text-[12px] text-[#64748B] hover:border-purple-300 hover:text-purple-600 mb-4">
              + Ajouter un paramètre
            </button>
            <div className="flex gap-2">
              <button onClick={() => setShowRes(null)} className="flex-1 py-2.5 border border-[#E2E8F0] rounded-xl text-[13px] text-[#64748B]">Annuler</button>
              <button onClick={() => submitResultats(showRes)} disabled={saving}
                className="flex-1 py-2.5 bg-[#7C3AED] text-white rounded-xl text-[13px] font-bold disabled:opacity-50">
                {saving ? 'Sauvegarde...' : 'Enregistrer résultats'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

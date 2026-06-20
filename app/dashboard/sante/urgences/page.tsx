'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { ArrowLeft, Plus, RefreshCw, Loader2, AlertTriangle, X, Clock } from 'lucide-react'

interface Urgence {
  id: string; nom_complet: string | null; age_estime: number | null; sexe: string
  heure_arrivee: string; mode_arrivee: string; priorite: number; ccmu: number
  motif: string; statut: string; notes: string | null
  clinique_patients: { nom: string; prenom: string; telephone: string } | null
  clinique_medecins: { nom: string; prenom: string; specialite: string } | null
}

const PRIORITES = [
  { p: 1, label: 'IMMÉDIAT', color: '#DC2626', bg: '#FEF2F2', border: '#FECACA' },
  { p: 2, label: 'URGENT',   color: '#EA580C', bg: '#FFF7ED', border: '#FED7AA' },
  { p: 3, label: 'STANDARD', color: '#16A34A', bg: '#F0FDF4', border: '#BBF7D0' },
  { p: 4, label: 'NON-URG.', color: '#2563EB', bg: '#EFF6FF', border: '#BFDBFE' },
]

const STATUTS: Record<string, { label: string; color: string; next?: string; nextLabel?: string }> = {
  en_attente:  { label: 'Attente',     color: '#F59E0B', next: 'triage_fait', nextLabel: '▶ Triage' },
  triage_fait: { label: 'Trié',        color: '#2563EB', next: 'en_soins',    nextLabel: '▶ Prise en charge' },
  en_soins:    { label: 'En soins',    color: '#7C3AED', next: 'sorti',       nextLabel: '✓ Sortie' },
  hospitalise: { label: 'Hospitalisé', color: '#16A34A' },
  sorti:       { label: 'Sorti',       color: '#64748B' },
  deces:       { label: 'Décès',       color: '#0F172A' },
}

const MODE_LABEL: Record<string, string> = {
  ambulance: '🚑 Ambulance', propres_moyens: '🚶 P.Moyens',
  samu: '🚨 SAMU', transfert: '↪ Transfert', pompiers: '🚒 Pompiers',
}

const INIT_FORM = {
  nom_complet: '', age_estime: '', sexe: 'inconnu', mode_arrivee: 'propres_moyens',
  priorite: 3, ccmu: 3, motif: '', notes: '',
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}
function minutesSince(iso: string) {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
}

export default function UrgencesPage() {
  const [urgences,   setUrgences]   = useState<Urgence[]>([])
  const [loading,    setLoading]    = useState(true)
  const [showForm,   setShowForm]   = useState(false)
  const [form,       setForm]       = useState({ ...INIT_FORM })
  const [saving,     setSaving]     = useState(false)
  const [activeOnly] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const params = activeOnly ? '' : `&statut=sorti`
    const res = await fetch(`/api/sante/urgences?${params}`)
    if (res.ok) { const d = await res.json(); setUrgences(d.urgences ?? []) }
    setLoading(false)
  }, [activeOnly])

  useEffect(() => { load() }, [load])

  async function advance(id: string, statut: string) {
    await fetch('/api/sante/urgences', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, statut }),
    })
    load()
  }

  async function changePriority(id: string, priorite: number) {
    await fetch('/api/sante/urgences', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, priorite }),
    })
    load()
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setSaving(true)
    await fetch('/api/sante/urgences', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, age_estime: form.age_estime ? Number(form.age_estime) : null, priorite: Number(form.priorite), ccmu: Number(form.ccmu) }),
    })
    setSaving(false); setShowForm(false); setForm({ ...INIT_FORM }); load()
  }

  const byPriority = (p: number) => urgences.filter(u => u.priorite === p && u.statut !== 'sorti' && u.statut !== 'deces')
  const totalActifs = urgences.filter(u => !['sorti','deces'].includes(u.statut)).length

  return (
    <div className="min-h-screen bg-[#F8FAFC] pb-20">
      <div className="bg-white border-b border-[#E2E8F0] px-4 sm:px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/dashboard/sante" className="flex items-center gap-1 text-[#64748B] text-[13px]"><ArrowLeft size={14} /> Santé</Link>
            <span className="text-[#E2E8F0]">/</span>
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-red-500 rounded-lg flex items-center justify-center">
                <AlertTriangle size={12} className="text-white" />
              </div>
              <h1 className="text-[16px] font-black text-[#0F172A]">Urgences</h1>
              {totalActifs > 0 && (
                <span className="px-2 py-0.5 bg-red-100 text-red-600 text-[11px] font-black rounded-full">{totalActifs} actifs</span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={load} className="p-2 border border-[#E2E8F0] rounded-xl text-[#64748B]"><RefreshCw size={13} /></button>
            <button onClick={() => setShowForm(true)}
              className="flex items-center gap-1.5 px-3 py-2 bg-red-500 text-white rounded-xl text-[12px] font-bold hover:bg-red-600">
              <Plus size={12} /> Nouveau patient
            </button>
          </div>
        </div>
      </div>

      {/* KPI bar */}
      <div className="bg-red-600 px-4 sm:px-6 py-2">
        <div className="max-w-7xl mx-auto flex flex-wrap gap-x-5 gap-y-0.5">
          {PRIORITES.map(pr => (
            <span key={pr.p} className="text-[11px] text-white/90">
              <span className="font-black text-white">{byPriority(pr.p).length}</span> P{pr.p} {pr.label}
            </span>
          ))}
          <span className="text-[11px] text-white/90 ml-auto">
            <span className="font-black text-white">{totalActifs}</span> patients en cours
          </span>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-5">
        {loading ? (
          <div className="flex justify-center py-16 gap-2 text-[#94A3B8]"><Loader2 size={18} className="animate-spin" /> Chargement...</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {PRIORITES.map(pr => (
              <div key={pr.p}>
                <div className="flex items-center gap-2 mb-3 px-1">
                  <div className="w-3 h-3 rounded-full" style={{ background: pr.color }} />
                  <span className="text-[12px] font-black uppercase tracking-wide" style={{ color: pr.color }}>
                    P{pr.p} — {pr.label}
                  </span>
                  <span className="ml-auto text-[13px] font-black" style={{ color: pr.color }}>{byPriority(pr.p).length}</span>
                </div>
                <div className="space-y-2">
                  {byPriority(pr.p).map(u => {
                    const st = STATUTS[u.statut] ?? STATUTS.en_attente
                    const mins = minutesSince(u.heure_arrivee)
                    const patient = u.clinique_patients
                    const nom = patient ? `${patient.prenom} ${patient.nom}` : (u.nom_complet ?? 'Inconnu')
                    return (
                      <div key={u.id} className="bg-white rounded-2xl border shadow-sm p-3" style={{ borderColor: pr.border }}>
                        <div className="flex items-start justify-between mb-1.5">
                          <div>
                            <p className="font-black text-[13px] text-[#0F172A]">{nom}</p>
                            <p className="text-[10px] text-[#64748B]">
                              {u.age_estime ? `${u.age_estime} ans • ` : ''}{u.sexe !== 'inconnu' ? u.sexe : ''}
                              {patient?.telephone ? ` • ${patient.telephone}` : ''}
                            </p>
                          </div>
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: st.color + '18', color: st.color }}>{st.label}</span>
                        </div>

                        <div className="flex items-center gap-2 mb-1.5">
                          <Clock size={10} className="text-[#94A3B8] shrink-0" />
                          <span className="text-[11px] text-[#64748B]">{fmtTime(u.heure_arrivee)}</span>
                          <span className="text-[10px]" style={{ color: mins > 60 ? '#DC2626' : mins > 30 ? '#F59E0B' : '#16A34A' }}>
                            ({mins}m)
                          </span>
                          <span className="text-[10px] text-[#94A3B8] ml-auto">{MODE_LABEL[u.mode_arrivee]}</span>
                        </div>

                        <p className="text-[12px] text-[#475569] mb-2 line-clamp-2">{u.motif}</p>

                        {u.clinique_medecins && (
                          <p className="text-[10px] text-[#64748B] mb-2">
                            Dr {u.clinique_medecins.prenom} {u.clinique_medecins.nom} — {u.clinique_medecins.specialite}
                          </p>
                        )}

                        <div className="flex gap-1 flex-wrap">
                          {/* Change priority buttons */}
                          {pr.p > 1 && (
                            <button onClick={() => changePriority(u.id, pr.p - 1)}
                              className="px-1.5 py-0.5 text-[9px] font-bold rounded-md border border-red-200 text-red-600 hover:bg-red-50">
                              ↑ P{pr.p - 1}
                            </button>
                          )}
                          {/* Advance statut */}
                          {st.next && (
                            <button onClick={() => advance(u.id, st.next!)}
                              className="flex-1 py-1 text-[10px] font-bold rounded-lg text-white" style={{ background: pr.color }}>
                              {st.nextLabel}
                            </button>
                          )}
                          {u.statut === 'en_soins' && (
                            <button onClick={() => advance(u.id, 'hospitalise')}
                              className="px-2 py-1 text-[10px] font-bold rounded-lg text-white bg-[#2563EB]">
                              🏥 Hospit.
                            </button>
                          )}
                        </div>

                        <div className="flex items-center gap-1 mt-1.5">
                          <span className="text-[9px] text-[#94A3B8]">CCMU {u.ccmu}</span>
                          <div className="flex gap-0.5 ml-auto">
                            {[1,2,3,4].map(p => (
                              <button key={p} onClick={() => changePriority(u.id, p)}
                                className="w-3 h-3 rounded-sm border"
                                style={{ background: u.priorite === p ? PRIORITES[p-1].color : 'transparent', borderColor: PRIORITES[p-1].color }}
                                title={`P${p}`} />
                            ))}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                  {byPriority(pr.p).length === 0 && (
                    <div className="rounded-2xl border border-dashed border-[#E2E8F0] p-8 text-center">
                      <p className="text-[11px] text-[#CBD5E1]">Aucun patient</p>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4">
          <div className="bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl w-full sm:max-w-md max-h-[90vh] overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-[15px] text-[#0F172A]">Nouveau patient urgences</h2>
              <button onClick={() => setShowForm(false)} className="p-1.5 rounded-lg hover:bg-[#F1F5F9]"><X size={16} /></button>
            </div>
            <form onSubmit={submit} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-[#64748B] uppercase">Nom complet</label>
                  <input value={form.nom_complet} onChange={e => setForm(p => ({...p, nom_complet: e.target.value}))}
                    placeholder="Prénom Nom" className="mt-1 w-full px-3 py-2 text-[13px] border border-[#E2E8F0] rounded-xl focus:outline-none focus:ring-2 focus:ring-red-300" />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-[#64748B] uppercase">Âge estimé</label>
                  <input type="number" min={0} max={120} value={form.age_estime} onChange={e => setForm(p => ({...p, age_estime: e.target.value}))}
                    className="mt-1 w-full px-3 py-2 text-[13px] border border-[#E2E8F0] rounded-xl focus:outline-none focus:ring-2 focus:ring-red-300" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-[#64748B] uppercase">Sexe</label>
                  <select value={form.sexe} onChange={e => setForm(p => ({...p, sexe: e.target.value}))}
                    className="mt-1 w-full px-3 py-2 text-[13px] border border-[#E2E8F0] rounded-xl bg-white focus:outline-none">
                    <option value="M">Masculin</option><option value="F">Féminin</option><option value="inconnu">Inconnu</option>
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-bold text-[#64748B] uppercase">Arrivée</label>
                  <select value={form.mode_arrivee} onChange={e => setForm(p => ({...p, mode_arrivee: e.target.value}))}
                    className="mt-1 w-full px-3 py-2 text-[13px] border border-[#E2E8F0] rounded-xl bg-white focus:outline-none">
                    <option value="propres_moyens">Propres moyens</option>
                    <option value="ambulance">Ambulance</option>
                    <option value="samu">SAMU</option>
                    <option value="pompiers">Pompiers</option>
                    <option value="transfert">Transfert</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold text-[#64748B] uppercase">Motif d'admission *</label>
                <textarea required rows={2} value={form.motif} onChange={e => setForm(p => ({...p, motif: e.target.value}))}
                  placeholder="Douleur thoracique, traumatisme, fièvre..."
                  className="mt-1 w-full px-3 py-2 text-[13px] border border-[#E2E8F0] rounded-xl focus:outline-none focus:ring-2 focus:ring-red-300 resize-none" />
              </div>

              <div>
                <label className="text-[11px] font-bold text-[#64748B] uppercase mb-2 block">Priorité</label>
                <div className="flex gap-2">
                  {PRIORITES.map(pr => (
                    <button key={pr.p} type="button" onClick={() => setForm(p => ({...p, priorite: pr.p}))}
                      className="flex-1 py-2 rounded-xl text-[11px] font-black border-2 transition-all"
                      style={{ borderColor: pr.color, background: form.priorite === pr.p ? pr.color : 'transparent', color: form.priorite === pr.p ? 'white' : pr.color }}>
                      P{pr.p}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex gap-2 pt-1">
                <button type="button" onClick={() => setShowForm(false)}
                  className="flex-1 py-2.5 border border-[#E2E8F0] rounded-xl text-[13px] font-semibold text-[#64748B]">Annuler</button>
                <button type="submit" disabled={saving || !form.motif}
                  className="flex-1 py-2.5 bg-red-500 text-white rounded-xl text-[13px] font-bold hover:bg-red-600 disabled:opacity-50">
                  {saving ? 'Enregistrement...' : 'Admettre'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

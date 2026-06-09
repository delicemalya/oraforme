'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { ArrowLeft, Plus, RefreshCw, Loader2, ScanLine, X, ChevronDown, ChevronRight } from 'lucide-react'

interface Examen {
  id: string; type_examen: string; region: string | null; statut: string
  date_prescription: string; urgence: boolean; rapport: string | null; notes: string | null
  clinique_patients: { nom: string; prenom: string; numero_dossier: string } | null
  clinique_medecins: { nom: string; prenom: string } | null
}
interface Patient { id: string; nom: string; prenom: string; numero_dossier: string }

const STATUTS: Record<string, { label: string; color: string; next?: string; nextLabel?: string }> = {
  prescrit:  { label: 'Prescrit',   color: '#F59E0B', next: 'planifie',   nextLabel: '📅 Planifier' },
  planifie:  { label: 'Planifié',   color: '#2563EB', next: 'realise',    nextLabel: '▶ Réalisé' },
  realise:   { label: 'Réalisé',    color: '#EA580C', next: 'interprete', nextLabel: '📝 Interpréter' },
  interprete:{ label: 'Interprété', color: '#16A34A' },
  annule:    { label: 'Annulé',     color: '#94A3B8' },
}

const TYPES_IMG = ['radiographie','echographie','scanner','irm','mammographie','panoramique','autre']
const TYPES_LABEL: Record<string, string> = {
  radiographie: 'Radiographie', echographie: 'Échographie', scanner: 'Scanner',
  irm: 'IRM', mammographie: 'Mammographie', panoramique: 'Panoramique', autre: 'Autre',
}
const REGIONS = ['thorax','abdomen','crane','rachis','membre_superieur','membre_inferieur','pelvis','sein','autre']

const INIT_FORM = { patient_id: '', type_examen: 'radiographie', region: '', urgence: false, notes: '' }

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}

export default function ImagériePage() {
  const [examens,  setExamens]  = useState<Examen[]>([])
  const [patients, setPatients] = useState<Patient[]>([])
  const [loading,  setLoading]  = useState(true)
  const [filter,   setFilter]   = useState('prescrit')
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [showForm, setShowForm] = useState(false)
  const [showRapp, setShowRapp] = useState<string | null>(null)
  const [rapport,  setRapport]  = useState('')
  const [form,     setForm]     = useState({ ...INIT_FORM })
  const [saving,   setSaving]   = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const [eRes, pRes] = await Promise.all([
      fetch(filter === 'all' ? '/api/sante/imagerie' : `/api/sante/imagerie?statut=${filter}`),
      fetch('/api/sante/patients?actif=true&limit=300'),
    ])
    if (eRes.ok) { const d = await eRes.json(); setExamens(d.examens ?? []) }
    if (pRes.ok) { const d = await pRes.json(); setPatients(d.data ?? []) }
    setLoading(false)
  }, [filter])

  useEffect(() => { load() }, [load])

  async function advance(id: string, statut: string) {
    await fetch('/api/sante/imagerie', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, statut }),
    })
    load()
  }

  async function saveRapport(id: string) {
    setSaving(true)
    await fetch('/api/sante/imagerie', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, rapport, statut: 'interprete' }),
    })
    setSaving(false); setShowRapp(null); setRapport(''); load()
  }

  async function createPrescription(e: React.FormEvent) {
    e.preventDefault(); setSaving(true)
    await fetch('/api/sante/imagerie', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    setSaving(false); setShowForm(false); setForm({ ...INIT_FORM }); load()
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] pb-20">
      <div className="bg-white border-b border-[#E2E8F0] px-4 sm:px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/dashboard/sante" className="flex items-center gap-1 text-[#64748B] text-[13px]"><ArrowLeft size={14} /> Santé</Link>
            <span className="text-[#E2E8F0]">/</span>
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-[#0891B2] rounded-lg flex items-center justify-center">
                <ScanLine size={12} className="text-white" />
              </div>
              <h1 className="text-[16px] font-black text-[#0F172A]">Imagerie Médicale</h1>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={load} className="p-2 border border-[#E2E8F0] rounded-xl text-[#64748B]"><RefreshCw size={13} /></button>
            <button onClick={() => setShowForm(true)}
              className="flex items-center gap-1.5 px-3 py-2 bg-[#0891B2] text-white rounded-xl text-[12px] font-bold hover:bg-cyan-800">
              <Plus size={12} /> Prescrire
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white border-b border-[#E2E8F0] px-4 sm:px-6 py-2">
        <div className="max-w-5xl mx-auto flex gap-2 overflow-x-auto">
          {[['all','Tous'],['prescrit','Prescrits'],['planifie','Planifiés'],['realise','Réalisés'],['interprete','Interprétés']].map(([k,l]) => (
            <button key={k} onClick={() => setFilter(k)}
              className={`shrink-0 px-3 py-1.5 rounded-xl text-[11px] font-bold ${filter === k ? 'bg-[#0891B2] text-white' : 'bg-[#F8FAFC] text-[#64748B]'}`}>
              {l}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-5 space-y-2">
        {loading ? (
          <div className="flex justify-center py-16 gap-2 text-[#94A3B8]"><Loader2 size={18} className="animate-spin" /> Chargement...</div>
        ) : examens.length === 0 ? (
          <div className="bg-white rounded-2xl border border-dashed border-[#CBD5E1] p-16 text-center">
            <ScanLine size={36} className="text-[#CBD5E1] mx-auto mb-3" />
            <p className="font-bold text-[#0F172A]">Aucun examen</p>
          </div>
        ) : examens.map(ex => {
          const st    = STATUTS[ex.statut] ?? STATUTS.prescrit
          const isExp = expanded[ex.id]
          return (
            <div key={ex.id} className="bg-white rounded-2xl border border-[#E2E8F0] shadow-sm overflow-hidden">
              <div className="flex items-center gap-3 p-4 cursor-pointer" onClick={() => setExpanded(p => ({...p, [ex.id]: !isExp}))}>
                {isExp ? <ChevronDown size={14} className="text-[#94A3B8] shrink-0" /> : <ChevronRight size={14} className="text-[#94A3B8] shrink-0" />}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="px-2 py-0.5 bg-cyan-100 text-cyan-700 text-[10px] font-black rounded-full">
                      {TYPES_LABEL[ex.type_examen] ?? ex.type_examen}
                    </span>
                    {ex.region && <span className="text-[10px] text-[#94A3B8]">— {ex.region}</span>}
                    {ex.urgence && <span className="px-1.5 py-0.5 bg-red-100 text-red-600 text-[9px] font-black rounded-full">URGENT</span>}
                    <span className="text-[13px] font-bold text-[#0F172A]">
                      {ex.clinique_patients ? `${ex.clinique_patients.prenom} ${ex.clinique_patients.nom}` : 'Patient inconnu'}
                    </span>
                    {ex.clinique_patients && <span className="text-[11px] text-[#94A3B8]">{ex.clinique_patients.numero_dossier}</span>}
                  </div>
                  <p className="text-[11px] text-[#64748B] mt-0.5">
                    {fmtDate(ex.date_prescription)}
                    {ex.clinique_medecins && ` • Dr ${ex.clinique_medecins.prenom} ${ex.clinique_medecins.nom}`}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="px-2 py-0.5 text-[10px] font-bold rounded-full" style={{ background: st.color + '18', color: st.color }}>{st.label}</span>
                  {st.next && (
                    <button onClick={e => { e.stopPropagation(); advance(ex.id, st.next!) }}
                      className="px-2 py-1 text-[10px] font-bold rounded-lg text-white" style={{ background: st.color }}>
                      {st.nextLabel}
                    </button>
                  )}
                  {ex.statut === 'realise' && (
                    <button onClick={e => { e.stopPropagation(); setShowRapp(ex.id); setRapport(ex.rapport ?? '') }}
                      className="px-2 py-1 text-[10px] font-bold rounded-lg bg-[#0891B2] text-white">
                      📝 Compte-rendu
                    </button>
                  )}
                </div>
              </div>
              {isExp && ex.rapport && (
                <div className="border-t border-[#F1F5F9] px-4 py-3">
                  <p className="text-[10px] font-black text-[#94A3B8] uppercase tracking-wide mb-1.5">Compte-rendu radiologue</p>
                  <pre className="text-[12px] text-[#475569] whitespace-pre-wrap font-sans leading-relaxed">{ex.rapport}</pre>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4">
          <div className="bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl w-full sm:max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-[15px]">Prescrire un examen d'imagerie</h2>
              <button onClick={() => setShowForm(false)} className="p-1.5 rounded-lg hover:bg-[#F1F5F9]"><X size={16} /></button>
            </div>
            <form onSubmit={createPrescription} className="space-y-3">
              <div>
                <label className="text-[11px] font-bold text-[#64748B] uppercase">Patient *</label>
                <select required value={form.patient_id} onChange={e => setForm(p => ({...p, patient_id: e.target.value}))}
                  className="mt-1 w-full px-3 py-2 text-[13px] border border-[#E2E8F0] rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-cyan-300">
                  <option value="">Sélectionner...</option>
                  {patients.map(p => <option key={p.id} value={p.id}>{p.prenom} {p.nom} ({p.numero_dossier})</option>)}
                </select>
              </div>
              <div>
                <label className="text-[11px] font-bold text-[#64748B] uppercase">Type d'examen *</label>
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {TYPES_IMG.map(t => (
                    <button key={t} type="button" onClick={() => setForm(p => ({...p, type_examen: t}))}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-all ${form.type_examen === t ? 'bg-[#0891B2] text-white border-[#0891B2]' : 'bg-white text-[#64748B] border-[#E2E8F0]'}`}>
                      {TYPES_LABEL[t]}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-[11px] font-bold text-[#64748B] uppercase">Région</label>
                <select value={form.region} onChange={e => setForm(p => ({...p, region: e.target.value}))}
                  className="mt-1 w-full px-3 py-2 text-[13px] border border-[#E2E8F0] rounded-xl bg-white focus:outline-none">
                  <option value="">Non spécifiée</option>
                  {REGIONS.map(r => <option key={r} value={r}>{r.replace(/_/g,' ')}</option>)}
                </select>
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="urgImg" checked={form.urgence} onChange={e => setForm(p => ({...p, urgence: e.target.checked}))} className="w-4 h-4 accent-red-500" />
                <label htmlFor="urgImg" className="text-[13px] text-[#475569]">Examen urgent</label>
              </div>
              <div>
                <label className="text-[11px] font-bold text-[#64748B] uppercase">Notes cliniques</label>
                <textarea rows={2} value={form.notes} onChange={e => setForm(p => ({...p, notes: e.target.value}))}
                  className="mt-1 w-full px-3 py-2 text-[13px] border border-[#E2E8F0] rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-cyan-300" />
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={() => setShowForm(false)} className="flex-1 py-2.5 border border-[#E2E8F0] rounded-xl text-[13px] text-[#64748B]">Annuler</button>
                <button type="submit" disabled={saving || !form.patient_id} className="flex-1 py-2.5 bg-[#0891B2] text-white rounded-xl text-[13px] font-bold disabled:opacity-50">
                  {saving ? 'Envoi...' : 'Prescrire'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showRapp && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4">
          <div className="bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl w-full sm:max-w-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-[15px]">Compte-rendu radiologique</h2>
              <button onClick={() => setShowRapp(null)} className="p-1.5 rounded-lg hover:bg-[#F1F5F9]"><X size={16} /></button>
            </div>
            <textarea rows={8} value={rapport} onChange={e => setRapport(e.target.value)}
              placeholder="Technique d'examen, résultats, conclusion..."
              className="w-full px-3 py-3 text-[13px] border border-[#E2E8F0] rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-cyan-300 mb-4" />
            <div className="flex gap-2">
              <button onClick={() => setShowRapp(null)} className="flex-1 py-2.5 border border-[#E2E8F0] rounded-xl text-[13px] text-[#64748B]">Annuler</button>
              <button onClick={() => saveRapport(showRapp!)} disabled={saving || !rapport.trim()}
                className="flex-1 py-2.5 bg-[#0891B2] text-white rounded-xl text-[13px] font-bold disabled:opacity-50">
                {saving ? 'Sauvegarde...' : 'Enregistrer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

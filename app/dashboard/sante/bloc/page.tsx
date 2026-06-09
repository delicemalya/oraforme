'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { ArrowLeft, Plus, RefreshCw, Loader2, Scissors, X, Clock } from 'lucide-react'

interface Intervention {
  id: string; type_intervention: string; type_anesthesie: string | null; statut: string
  date_prevue: string | null; date_debut: string | null; date_fin: string | null
  description: string | null; complications: string | null; notes_post_op: string | null
  clinique_patients: { nom: string; prenom: string; numero_dossier: string } | null
  chirurgien: { nom: string; prenom: string; specialite: string } | null
  anesthesiste: { nom: string; prenom: string } | null
}
interface Patient { id: string; nom: string; prenom: string; numero_dossier: string }
interface Medecin { id: string; nom: string; prenom: string; specialite: string }

const STATUTS: Record<string, { label: string; color: string; next?: string; nextLabel?: string }> = {
  programme: { label: 'Programmé',   color: '#2563EB', next: 'en_cours', nextLabel: '▶ Démarrer' },
  en_cours:  { label: 'En cours',    color: '#F59E0B', next: 'termine',  nextLabel: '✓ Terminé' },
  termine:   { label: 'Terminé',     color: '#16A34A' },
  annule:    { label: 'Annulé',      color: '#DC2626' },
  reporte:   { label: 'Reporté',     color: '#94A3B8' },
}

const ANESTHESIE_LABEL: Record<string, string> = {
  generale: 'AG', loco_regionale: 'ALR', locale: 'AL', rachianesthesie: 'Rachi', aucune: 'Sans'
}

function fmtDt(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}
function duration(start: string | null, end: string | null) {
  if (!start || !end) return null
  const mins = Math.round((new Date(end).getTime() - new Date(start).getTime()) / 60000)
  return `${Math.floor(mins/60)}h${String(mins%60).padStart(2,'0')}`
}

const INIT_FORM = {
  patient_id: '', chirurgien_id: '', anesthesiste_id: '', type_intervention: '',
  type_anesthesie: 'generale', date_prevue: '', description: '',
}

export default function BlocPage() {
  const [items,    setItems]    = useState<Intervention[]>([])
  const [patients, setPatients] = useState<Patient[]>([])
  const [medecins, setMedecins] = useState<Medecin[]>([])
  const [loading,  setLoading]  = useState(true)
  const [date,     setDate]     = useState(new Date().toISOString().split('T')[0])
  const [showForm, setShowForm] = useState(false)
  const [form,     setForm]     = useState({ ...INIT_FORM })
  const [saving,   setSaving]   = useState(false)
  const [notesId,  setNotesId]  = useState<string | null>(null)
  const [notes,    setNotes]    = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    const [iRes, pRes, mRes] = await Promise.all([
      fetch(`/api/sante/bloc?date=${date}`),
      fetch('/api/sante/patients?actif=true&limit=300'),
      fetch('/api/sante/medecins?actif=true'),
    ])
    if (iRes.ok) { const d = await iRes.json(); setItems(d.interventions ?? []) }
    if (pRes.ok) { const d = await pRes.json(); setPatients(d.data ?? []) }
    if (mRes.ok) { const d = await mRes.json(); setMedecins(d.data ?? []) }
    setLoading(false)
  }, [date])

  useEffect(() => { load() }, [load])

  async function advance(id: string, statut: string) {
    await fetch('/api/sante/bloc', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, statut }),
    })
    load()
  }

  async function saveNotes(id: string) {
    setSaving(true)
    await fetch('/api/sante/bloc', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, notes_post_op: notes, statut: 'termine' }),
    })
    setSaving(false); setNotesId(null); setNotes(''); load()
  }

  async function createIntervention(e: React.FormEvent) {
    e.preventDefault(); setSaving(true)
    await fetch('/api/sante/bloc', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    setSaving(false); setShowForm(false); setForm({ ...INIT_FORM }); load()
  }

  const byStatut = (s: string) => items.filter(i => i.statut === s)

  return (
    <div className="min-h-screen bg-[#F8FAFC] pb-20">
      <div className="bg-white border-b border-[#E2E8F0] px-4 sm:px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/dashboard/sante" className="flex items-center gap-1 text-[#64748B] text-[13px]"><ArrowLeft size={14} /> Santé</Link>
            <span className="text-[#E2E8F0]">/</span>
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-[#EA580C] rounded-lg flex items-center justify-center">
                <Scissors size={12} className="text-white" />
              </div>
              <h1 className="text-[16px] font-black text-[#0F172A]">Bloc Opératoire</h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input type="date" value={date} onChange={e => setDate(e.target.value)}
              className="px-3 py-1.5 text-[12px] border border-[#E2E8F0] rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-300" />
            <button onClick={load} className="p-2 border border-[#E2E8F0] rounded-xl text-[#64748B]"><RefreshCw size={13} /></button>
            <button onClick={() => setShowForm(true)}
              className="flex items-center gap-1.5 px-3 py-2 bg-[#EA580C] text-white rounded-xl text-[12px] font-bold hover:bg-orange-700">
              <Plus size={12} /> Programmer
            </button>
          </div>
        </div>
      </div>

      {/* KPI strip */}
      <div className="bg-[#EA580C] px-4 sm:px-6 py-2">
        <div className="max-w-6xl mx-auto flex flex-wrap gap-x-5 gap-y-0.5">
          {Object.entries(STATUTS).map(([k, s]) => (
            <span key={k} className="text-[11px] text-white/90">
              <span className="font-black text-white">{byStatut(k).length}</span> {s.label}
            </span>
          ))}
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-5">
        {loading ? (
          <div className="flex justify-center py-16 gap-2 text-[#94A3B8]"><Loader2 size={18} className="animate-spin" /> Chargement...</div>
        ) : items.length === 0 ? (
          <div className="bg-white rounded-2xl border border-dashed border-[#CBD5E1] p-16 text-center">
            <Scissors size={36} className="text-[#CBD5E1] mx-auto mb-3" />
            <p className="font-bold text-[#0F172A]">Aucune intervention ce jour</p>
          </div>
        ) : (
          <div className="space-y-3">
            {items.map(item => {
              const st      = STATUTS[item.statut] ?? STATUTS.programme
              const patient = item.clinique_patients
              const dur     = duration(item.date_debut, item.date_fin)
              return (
                <div key={item.id} className="bg-white rounded-2xl border border-[#E2E8F0] shadow-sm p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="px-2 py-0.5 text-[10px] font-bold rounded-full" style={{ background: st.color + '18', color: st.color }}>{st.label}</span>
                        {item.type_anesthesie && (
                          <span className="px-2 py-0.5 bg-amber-50 text-amber-700 text-[10px] font-bold rounded-full">
                            {ANESTHESIE_LABEL[item.type_anesthesie] ?? item.type_anesthesie}
                          </span>
                        )}
                        {dur && <span className="text-[10px] text-[#64748B]">⏱ {dur}</span>}
                      </div>
                      <p className="font-black text-[14px] text-[#0F172A]">{item.type_intervention}</p>
                      <p className="text-[12px] font-semibold text-[#475569]">
                        {patient ? `${patient.prenom} ${patient.nom} — ${patient.numero_dossier}` : 'Patient inconnu'}
                      </p>
                      {item.description && <p className="text-[12px] text-[#64748B] mt-1">{item.description}</p>}
                      <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-2 text-[11px] text-[#94A3B8]">
                        {item.date_prevue && <span><Clock size={10} className="inline mr-1" />{fmtDt(item.date_prevue)}</span>}
                        {item.chirurgien  && <span>👨‍⚕️ Dr {item.chirurgien.prenom} {item.chirurgien.nom}</span>}
                        {item.anesthesiste && <span>💉 Dr {item.anesthesiste.prenom} {item.anesthesiste.nom}</span>}
                      </div>
                      {item.complications && (
                        <p className="mt-1 text-[11px] text-red-600">⚠ {item.complications}</p>
                      )}
                      {item.notes_post_op && (
                        <p className="mt-1 text-[11px] text-[#475569] italic">{item.notes_post_op}</p>
                      )}
                    </div>
                    <div className="flex flex-col gap-1.5 shrink-0">
                      {st.next && (
                        <button onClick={() => advance(item.id, st.next!)}
                          className="px-3 py-1.5 text-[11px] font-bold rounded-xl text-white" style={{ background: st.color }}>
                          {st.nextLabel}
                        </button>
                      )}
                      {item.statut === 'en_cours' && (
                        <button onClick={() => { setNotesId(item.id); setNotes(item.notes_post_op ?? '') }}
                          className="px-3 py-1.5 text-[11px] font-bold rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-[#475569]">
                          Notes post-op
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4">
          <div className="bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl w-full sm:max-w-md max-h-[90vh] overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-[15px]">Programmer une intervention</h2>
              <button onClick={() => setShowForm(false)} className="p-1.5 rounded-lg hover:bg-[#F1F5F9]"><X size={16} /></button>
            </div>
            <form onSubmit={createIntervention} className="space-y-3">
              <div>
                <label className="text-[11px] font-bold text-[#64748B] uppercase">Patient *</label>
                <select required value={form.patient_id} onChange={e => setForm(p => ({...p, patient_id: e.target.value}))}
                  className="mt-1 w-full px-3 py-2 text-[13px] border border-[#E2E8F0] rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-orange-300">
                  <option value="">Sélectionner...</option>
                  {patients.map(p => <option key={p.id} value={p.id}>{p.prenom} {p.nom} ({p.numero_dossier})</option>)}
                </select>
              </div>
              <div>
                <label className="text-[11px] font-bold text-[#64748B] uppercase">Type d'intervention *</label>
                <input required value={form.type_intervention} onChange={e => setForm(p => ({...p, type_intervention: e.target.value}))}
                  placeholder="Appendicectomie, Cholécystectomie..."
                  className="mt-1 w-full px-3 py-2 text-[13px] border border-[#E2E8F0] rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-300" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-[#64748B] uppercase">Chirurgien</label>
                  <select value={form.chirurgien_id} onChange={e => setForm(p => ({...p, chirurgien_id: e.target.value}))}
                    className="mt-1 w-full px-3 py-2 text-[13px] border border-[#E2E8F0] rounded-xl bg-white focus:outline-none">
                    <option value="">Aucun</option>
                    {medecins.map(m => <option key={m.id} value={m.id}>Dr {m.prenom} {m.nom}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-bold text-[#64748B] uppercase">Anesthésiste</label>
                  <select value={form.anesthesiste_id} onChange={e => setForm(p => ({...p, anesthesiste_id: e.target.value}))}
                    className="mt-1 w-full px-3 py-2 text-[13px] border border-[#E2E8F0] rounded-xl bg-white focus:outline-none">
                    <option value="">Aucun</option>
                    {medecins.map(m => <option key={m.id} value={m.id}>Dr {m.prenom} {m.nom}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-[#64748B] uppercase">Anesthésie</label>
                  <select value={form.type_anesthesie} onChange={e => setForm(p => ({...p, type_anesthesie: e.target.value}))}
                    className="mt-1 w-full px-3 py-2 text-[13px] border border-[#E2E8F0] rounded-xl bg-white focus:outline-none">
                    <option value="generale">Générale</option>
                    <option value="loco_regionale">Loco-régionale</option>
                    <option value="locale">Locale</option>
                    <option value="rachianesthesie">Rachianesthésie</option>
                    <option value="aucune">Aucune</option>
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-bold text-[#64748B] uppercase">Date prévue</label>
                  <input type="datetime-local" value={form.date_prevue} onChange={e => setForm(p => ({...p, date_prevue: e.target.value}))}
                    className="mt-1 w-full px-3 py-2 text-[12px] border border-[#E2E8F0] rounded-xl focus:outline-none" />
                </div>
              </div>
              <div>
                <label className="text-[11px] font-bold text-[#64748B] uppercase">Description</label>
                <textarea rows={2} value={form.description} onChange={e => setForm(p => ({...p, description: e.target.value}))}
                  className="mt-1 w-full px-3 py-2 text-[13px] border border-[#E2E8F0] rounded-xl resize-none focus:outline-none" />
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={() => setShowForm(false)} className="flex-1 py-2.5 border border-[#E2E8F0] rounded-xl text-[13px] text-[#64748B]">Annuler</button>
                <button type="submit" disabled={saving || !form.patient_id || !form.type_intervention}
                  className="flex-1 py-2.5 bg-[#EA580C] text-white rounded-xl text-[13px] font-bold disabled:opacity-50">
                  {saving ? 'Création...' : 'Programmer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {notesId && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4">
          <div className="bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl w-full sm:max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-[15px]">Notes post-opératoires</h2>
              <button onClick={() => setNotesId(null)} className="p-1.5 rounded-lg hover:bg-[#F1F5F9]"><X size={16} /></button>
            </div>
            <textarea rows={6} value={notes} onChange={e => setNotes(e.target.value)}
              placeholder="Déroulement, observations, suites à donner..."
              className="w-full px-3 py-3 text-[13px] border border-[#E2E8F0] rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-orange-300 mb-4" />
            <div className="flex gap-2">
              <button onClick={() => setNotesId(null)} className="flex-1 py-2.5 border border-[#E2E8F0] rounded-xl text-[13px] text-[#64748B]">Annuler</button>
              <button onClick={() => saveNotes(notesId!)} disabled={saving}
                className="flex-1 py-2.5 bg-[#EA580C] text-white rounded-xl text-[13px] font-bold disabled:opacity-50">
                {saving ? 'Sauvegarde...' : '✓ Terminer & sauvegarder'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

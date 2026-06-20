'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useTenant } from '@/lib/hooks/useTenant'
import { Calendar, Plus, X, AlertTriangle, Loader2, ChevronLeft, Clock } from 'lucide-react'
import Link from 'next/link'

interface RDV {
  id:           string
  date_heure:   string
  duree_minutes:number
  motif:        string
  statut:       string
  notes:        string | null
  patient_id:   string
  medecin_id:   string | null
  clinique_patients: { nom: string; prenom: string; telephone: string | null } | null
  clinique_medecins: { nom: string; prenom: string; specialite: string } | null
}

interface Patient { id: string; nom: string; prenom: string }
interface Medecin { id: string; nom: string; prenom: string; specialite: string }

const STATUTS = [
  { value: 'planifie',  label: 'Planifié',  color: '#2563EB', bg: '#EFF6FF' },
  { value: 'confirme',  label: 'Confirmé',  color: '#16A34A', bg: '#F0FDF4' },
  { value: 'arrive',    label: 'Arrivé',    color: '#D97706', bg: '#FFFBEB' },
  { value: 'en_cours',  label: 'En cours',  color: '#7C3AED', bg: '#F5F3FF' },
  { value: 'termine',   label: 'Terminé',   color: '#64748B', bg: '#F8FAFC' },
  { value: 'annule',    label: 'Annulé',    color: '#DC2626', bg: '#FEF2F2' },
  { value: 'absent',    label: 'Absent',    color: '#94A3B8', bg: '#F1F5F9' },
]

function getStatut(v: string) { return STATUTS.find(s => s.value === v) ?? STATUTS[0] }


export default function RendezVousPage() {
  const { tenantId, loading: tenantLoading } = useTenant()
  const [rdvs,     setRdvs]     = useState<RDV[]>([])
  const [patients, setPatients] = useState<Patient[]>([])
  const [medecins, setMedecins] = useState<Medecin[]>([])
  const [loading,  setLoading]  = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [saving,   setSaving]   = useState(false)
  const [error,    setError]    = useState('')
  const [filterStatut, setFilterStatut] = useState('all')

  const [form, setForm] = useState({
    patient_id: '', medecin_id: '', date_heure: '', duree_minutes: '30',
    motif: '', notes: '', statut: 'planifie',
  })
  function set<K extends keyof typeof form>(k: K, v: string) { setForm(p => ({ ...p, [k]: v })) }

  const load = useCallback(async () => {
    if (!tenantId) return
    setLoading(true)
    const [{ data: rdvData }, { data: pats }, { data: meds }] = await Promise.all([
      supabase.from('clinique_rdv')
        .select('*, clinique_patients(nom, prenom, telephone), clinique_medecins(nom, prenom, specialite)')
        .eq('tenant_id', tenantId)
        .order('date_heure', { ascending: false })
        .limit(100),
      supabase.from('clinique_patients').select('id, nom, prenom').eq('tenant_id', tenantId).eq('actif', true).order('nom').limit(200),
      supabase.from('clinique_medecins').select('id, nom, prenom, specialite').eq('tenant_id', tenantId).eq('actif', true).order('nom').limit(200),
    ])
    setRdvs((rdvData ?? []) as RDV[])
    setPatients(pats ?? [])
    setMedecins(meds ?? [])
    setLoading(false)
  }, [tenantId])

  useEffect(() => { if (!tenantLoading) load() }, [tenantLoading, load])

  async function handleSave() {
    if (!tenantId || !form.patient_id || !form.date_heure || !form.motif.trim()) {
      setError('Patient, date/heure et motif obligatoires'); return
    }
    setSaving(true); setError('')
    await supabase.from('clinique_rdv').insert({
      tenant_id:    tenantId,
      patient_id:   form.patient_id,
      medecin_id:   form.medecin_id || null,
      date_heure:   form.date_heure,
      duree_minutes: parseInt(form.duree_minutes) || 30,
      motif:        form.motif.trim(),
      notes:        form.notes || null,
      statut:       form.statut,
    })
    setSaving(false); setShowModal(false)
    setForm({ patient_id: '', medecin_id: '', date_heure: '', duree_minutes: '30', motif: '', notes: '', statut: 'planifie' })
    load()
  }

  async function changeStatut(id: string, statut: string) {
    await supabase.from('clinique_rdv').update({ statut }).eq('id', id)
    load()
  }

  const filtered = rdvs.filter(r => filterStatut === 'all' || r.statut === filterStatut)

  if (tenantLoading || loading) {
    return <div className="min-h-screen bg-[#F5F7FB] flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-[#DC2626]" /></div>
  }

  return (
    <div className="min-h-screen bg-[#F5F7FB] p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Link href="/dashboard/sante" className="p-2 rounded-xl hover:bg-white border border-[#E5E7EB]">
            <ChevronLeft size={16} className="text-[#64748B]" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-[#0F172A] flex items-center gap-2">
              <Calendar size={18} className="text-[#16A34A]" /> Rendez-vous
            </h1>
            <p className="text-xs text-[#64748B]">Planning médical · {rdvs.length} rendez-vous</p>
          </div>
        </div>
        <button onClick={() => { setError(''); setShowModal(true) }}
          className="flex items-center gap-1.5 bg-[#DC2626] text-white px-4 py-2 rounded-xl text-xs font-semibold hover:bg-[#B91C1C]">
          <Plus size={14} /> Nouveau RDV
        </button>
      </div>

      {/* Filtres statut */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <button onClick={() => setFilterStatut('all')}
          className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${filterStatut === 'all' ? 'bg-[#0F172A] text-white' : 'bg-white text-[#64748B] border border-[#E5E7EB]'}`}>
          Tous ({rdvs.length})
        </button>
        {STATUTS.map(s => {
          const cnt = rdvs.filter(r => r.statut === s.value).length
          if (cnt === 0) return null
          return (
            <button key={s.value} onClick={() => setFilterStatut(s.value)}
              className={`px-3 py-1 rounded-full text-xs font-semibold transition-all ${filterStatut === s.value ? 'text-white' : 'bg-white border border-[#E5E7EB]'}`}
              style={filterStatut === s.value ? { background: s.color } : { color: s.color }}>
              {s.label} ({cnt})
            </button>
          )
        })}
      </div>

      {/* Liste */}
      <div className="space-y-2">
        {filtered.length === 0 ? (
          <div className="bg-white rounded-2xl border border-[#E5E7EB] flex flex-col items-center justify-center py-16">
            <Calendar size={32} className="text-[#CBD5E1] mb-3" />
            <p className="text-sm text-[#94A3B8]">Aucun rendez-vous</p>
          </div>
        ) : filtered.map(r => {
          const st = getStatut(r.statut)
          const pat = r.clinique_patients
          const med = r.clinique_medecins
          return (
            <div key={r.id} className="bg-white rounded-2xl border border-[#E5E7EB] p-4 flex items-center gap-4">
              {/* Heure */}
              <div className="w-14 h-14 rounded-2xl flex flex-col items-center justify-center flex-shrink-0"
                style={{ background: st.bg }}>
                <Clock size={12} style={{ color: st.color }} />
                <span className="text-xs font-bold mt-0.5" style={{ color: st.color }}>
                  {new Date(r.date_heure).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                </span>
                <span className="text-[9px]" style={{ color: st.color }}>
                  {new Date(r.date_heure).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}
                </span>
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <p className="text-sm font-bold text-[#0F172A]">
                    {pat ? `${pat.prenom} ${pat.nom}` : '—'}
                  </p>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ color: st.color, background: st.bg }}>
                    {st.label}
                  </span>
                </div>
                <p className="text-xs text-[#64748B]">
                  {r.motif}
                  {med ? ` · Dr ${med.prenom} ${med.nom} (${med.specialite})` : ''}
                </p>
                <p className="text-[10px] text-[#94A3B8] mt-0.5">{r.duree_minutes} min</p>
              </div>

              {/* Actions rapides */}
              <div className="flex gap-1.5 flex-wrap">
                {r.statut === 'planifie' && (
                  <button onClick={() => changeStatut(r.id, 'arrive')}
                    className="text-[11px] text-[#D97706] border border-[#FDE68A] px-2.5 py-1 rounded-lg hover:bg-[#FFFBEB]">
                    Arrivé
                  </button>
                )}
                {r.statut === 'arrive' && (
                  <button onClick={() => changeStatut(r.id, 'en_cours')}
                    className="text-[11px] text-[#7C3AED] border border-[#DDD6FE] px-2.5 py-1 rounded-lg hover:bg-[#F5F3FF]">
                    En consultation
                  </button>
                )}
                {r.statut === 'en_cours' && (
                  <button onClick={() => changeStatut(r.id, 'termine')}
                    className="text-[11px] text-[#16A34A] border border-[#BBF7D0] px-2.5 py-1 rounded-lg hover:bg-[#F0FDF4]">
                    Terminé
                  </button>
                )}
                {!['annule','absent','termine'].includes(r.statut) && (
                  <button onClick={() => changeStatut(r.id, 'annule')}
                    className="text-[11px] text-[#94A3B8] border border-[#E5E7EB] px-2.5 py-1 rounded-lg hover:bg-[#FEF2F2] hover:text-[#DC2626]">
                    Annuler
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-[#E5E7EB] sticky top-0 bg-white">
              <h2 className="text-sm font-bold text-[#0F172A]">Nouveau rendez-vous</h2>
              <button onClick={() => setShowModal(false)}><X size={18} className="text-[#94A3B8]" /></button>
            </div>
            <div className="p-5 space-y-4">
              {error && <div className="bg-[#FEF2F2] text-[#DC2626] text-xs px-3 py-2 rounded-xl flex items-center gap-2"><AlertTriangle size={13} />{error}</div>}

              <div>
                <label className="text-[11px] font-semibold text-[#374151] mb-1 block">Patient *</label>
                <select value={form.patient_id} onChange={e => set('patient_id', e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-[#E5E7EB] rounded-xl focus:outline-none bg-white">
                  <option value="">— Sélectionner un patient</option>
                  {patients.map(p => <option key={p.id} value={p.id}>{p.prenom} {p.nom}</option>)}
                </select>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-[#374151] mb-1 block">Médecin</label>
                <select value={form.medecin_id} onChange={e => set('medecin_id', e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-[#E5E7EB] rounded-xl focus:outline-none bg-white">
                  <option value="">— Non assigné</option>
                  {medecins.map(m => <option key={m.id} value={m.id}>Dr {m.prenom} {m.nom} · {m.specialite}</option>)}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-semibold text-[#374151] mb-1 block">Date & heure *</label>
                  <input type="datetime-local" value={form.date_heure} onChange={e => set('date_heure', e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-[#E5E7EB] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#DC2626]/20" />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-[#374151] mb-1 block">Durée (min)</label>
                  <select value={form.duree_minutes} onChange={e => set('duree_minutes', e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-[#E5E7EB] rounded-xl focus:outline-none bg-white">
                    {['15','20','30','45','60','90'].map(d => <option key={d} value={d}>{d} min</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-[#374151] mb-1 block">Motif *</label>
                <input value={form.motif} onChange={e => set('motif', e.target.value)}
                  placeholder="Consultation générale, suivi traitement…"
                  className="w-full px-3 py-2 text-xs border border-[#E5E7EB] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#DC2626]/20" />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-[#374151] mb-1 block">Notes</label>
                <textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={2}
                  className="w-full px-3 py-2 text-xs border border-[#E5E7EB] rounded-xl focus:outline-none resize-none" />
              </div>
            </div>
            <div className="flex justify-end gap-2 px-5 pb-5">
              <button onClick={() => setShowModal(false)}
                className="px-4 py-2 text-xs font-semibold text-[#64748B] border border-[#E5E7EB] rounded-xl hover:bg-[#F8FAFC]">
                Annuler
              </button>
              <button onClick={handleSave} disabled={saving}
                className="px-4 py-2 text-xs font-semibold bg-[#DC2626] text-white rounded-xl hover:bg-[#B91C1C] disabled:opacity-50">
                {saving ? 'Enregistrement…' : 'Créer le RDV'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

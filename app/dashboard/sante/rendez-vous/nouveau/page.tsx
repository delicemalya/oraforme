'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useTenant } from '@/lib/hooks/useTenant'
import { Calendar, ChevronLeft, AlertTriangle, Loader2 } from 'lucide-react'
import Link from 'next/link'

interface Patient { id: string; nom: string; prenom: string }
interface Medecin { id: string; nom: string; prenom: string; specialite: string }

export default function NouveauRDVPage() {
  const router       = useRouter()
  const searchParams = useSearchParams()
  const prePatient   = searchParams.get('patient') ?? ''
  const { tenantId, loading: tenantLoading } = useTenant()

  const [patients, setPatients] = useState<Patient[]>([])
  const [medecins, setMedecins] = useState<Medecin[]>([])
  const [loading,  setLoading]  = useState(true)
  const [saving,   setSaving]   = useState(false)
  const [error,    setError]    = useState('')

  const [form, setForm] = useState({
    patient_id: prePatient, medecin_id: '', date_heure: '',
    duree_minutes: '30', motif: '', notes: '', statut: 'planifie',
  })
  function set<K extends keyof typeof form>(k: K, v: string) { setForm(p => ({ ...p, [k]: v })) }

  const load = useCallback(async () => {
    if (!tenantId) return
    const [{ data: pats }, { data: meds }] = await Promise.all([
      supabase.from('clinique_patients').select('id, nom, prenom').eq('tenant_id', tenantId).eq('actif', true).order('nom').limit(300),
      supabase.from('clinique_medecins').select('id, nom, prenom, specialite').eq('tenant_id', tenantId).eq('actif', true).order('nom').limit(100),
    ])
    setPatients(pats ?? [])
    setMedecins(meds ?? [])
    setLoading(false)
  }, [tenantId])

  useEffect(() => { if (!tenantLoading) load() }, [tenantLoading, load])
  useEffect(() => { if (prePatient) set('patient_id', prePatient) }, [prePatient])

  async function handleSave() {
    if (!tenantId || !form.patient_id || !form.date_heure || !form.motif.trim()) {
      setError('Patient, date/heure et motif sont obligatoires'); return
    }
    setSaving(true); setError('')
    const { error: err } = await supabase.from('clinique_rdv').insert({
      tenant_id:     tenantId,
      patient_id:    form.patient_id,
      medecin_id:    form.medecin_id || null,
      date_heure:    form.date_heure,
      duree_minutes: parseInt(form.duree_minutes) || 30,
      motif:         form.motif.trim(),
      notes:         form.notes || null,
      statut:        form.statut,
    })
    if (err) { setError(err.message); setSaving(false); return }
    router.push('/dashboard/sante/rendez-vous')
  }

  if (tenantLoading || loading) {
    return <div className="min-h-screen bg-[#F5F7FB] flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-[#DC2626]" /></div>
  }

  return (
    <div className="min-h-screen bg-[#F5F7FB] p-4 md:p-6">
      <div className="max-w-lg mx-auto">
        <div className="flex items-center gap-3 mb-5">
          <Link href="/dashboard/sante/rendez-vous" className="p-2 rounded-xl hover:bg-white border border-[#E5E7EB]">
            <ChevronLeft size={16} className="text-[#64748B]" />
          </Link>
          <h1 className="text-lg font-bold text-[#0F172A] flex items-center gap-2">
            <Calendar size={18} className="text-[#16A34A]" /> Nouveau rendez-vous
          </h1>
        </div>

        <div className="bg-white rounded-2xl border border-[#E5E7EB] p-6 space-y-4">
          {error && <div className="bg-[#FEF2F2] text-[#DC2626] text-xs px-3 py-2 rounded-xl flex items-center gap-2"><AlertTriangle size={13} />{error}</div>}

          <div>
            <label className="text-[11px] font-semibold text-[#374151] mb-1 block">Patient *</label>
            <select value={form.patient_id} onChange={e => set('patient_id', e.target.value)}
              className="w-full px-3 py-2 text-xs border border-[#E5E7EB] rounded-xl focus:outline-none bg-white focus:ring-2 focus:ring-[#DC2626]/20">
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
              <label className="text-[11px] font-semibold text-[#374151] mb-1 block">Durée</label>
              <select value={form.duree_minutes} onChange={e => set('duree_minutes', e.target.value)}
                className="w-full px-3 py-2 text-xs border border-[#E5E7EB] rounded-xl focus:outline-none bg-white">
                {['15','20','30','45','60','90'].map(d => <option key={d} value={d}>{d} min</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="text-[11px] font-semibold text-[#374151] mb-1 block">Motif *</label>
            <input value={form.motif} onChange={e => set('motif', e.target.value)}
              placeholder="Consultation générale, suivi traitement, urgence…"
              className="w-full px-3 py-2 text-xs border border-[#E5E7EB] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#DC2626]/20" />
          </div>

          <div>
            <label className="text-[11px] font-semibold text-[#374151] mb-1 block">Statut initial</label>
            <select value={form.statut} onChange={e => set('statut', e.target.value)}
              className="w-full px-3 py-2 text-xs border border-[#E5E7EB] rounded-xl focus:outline-none bg-white">
              <option value="planifie">Planifié</option>
              <option value="confirme">Confirmé</option>
            </select>
          </div>

          <div>
            <label className="text-[11px] font-semibold text-[#374151] mb-1 block">Notes</label>
            <textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={2}
              className="w-full px-3 py-2 text-xs border border-[#E5E7EB] rounded-xl focus:outline-none resize-none" />
          </div>

          <div className="flex gap-3 pt-2">
            <Link href="/dashboard/sante/rendez-vous"
              className="flex-1 text-center py-2.5 text-xs font-semibold text-[#64748B] border border-[#E5E7EB] rounded-xl hover:bg-[#F8FAFC]">
              Annuler
            </Link>
            <button onClick={handleSave} disabled={saving}
              className="flex-1 py-2.5 text-xs font-semibold bg-[#DC2626] text-white rounded-xl hover:bg-[#B91C1C] disabled:opacity-50">
              {saving ? 'Enregistrement…' : 'Créer le rendez-vous'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

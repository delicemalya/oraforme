'use client'

import { useLocale } from '@/lib/hooks/useLocale'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useTenant } from '@/lib/hooks/useTenant'
import { fmtFCFA } from '@/lib/admin-config'
import { Stethoscope, Plus, X, AlertTriangle, Loader2, ChevronLeft, FileText } from 'lucide-react'
import Link from 'next/link'

interface Consultation {
  id:              string
  date_consult:    string
  motif:           string
  examen:          string | null
  diagnostic:      string | null
  traitement:      string | null
  ordonnance:      string | null
  pression_art:    string | null
  temperature:     string | null
  poids:           string | null
  taille:          string | null
  montant:         number
  statut_paiement: string
  patient_id:      string
  medecin_id:      string | null
  clinique_patients: { nom: string; prenom: string } | null
  clinique_medecins: { nom: string; prenom: string; specialite: string } | null
}

interface Patient { id: string; nom: string; prenom: string }
interface Medecin { id: string; nom: string; prenom: string; specialite: string }

const PAIE_STATUTS = [
  { value: 'en_attente', label: 'En attente', color: '#D97706', bg: '#FFFBEB' },
  { value: 'paye',       label: 'Payé',       color: '#16A34A', bg: '#F0FDF4' },
  { value: 'assurance',  label: 'Assurance',  color: '#2563EB', bg: '#EFF6FF' },
  { value: 'partiel',    label: 'Partiel',    color: '#7C3AED', bg: '#F5F3FF' },
]
function getPaie(v: string) { return PAIE_STATUTS.find(s => s.value === v) ?? PAIE_STATUTS[0] }

export default function ConsultationsPage() {
  const { t } = useLocale()
  const { tenantId, loading: tenantLoading } = useTenant()
  const [consults, setConsults] = useState<Consultation[]>([])
  const [patients, setPatients] = useState<Patient[]>([])
  const [medecins, setMedecins] = useState<Medecin[]>([])
  const [loading,  setLoading]  = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [saving,   setSaving]   = useState(false)
  const [error,    setError]    = useState('')
  const [expanded, setExpanded] = useState<string | null>(null)

  const [form, setForm] = useState({
    patient_id: '', medecin_id: '', motif: '', examen: '',
    diagnostic: '', traitement: '', ordonnance: '',
    pression_art: '', temperature: '', poids: '', taille: '',
    montant: '', statut_paiement: 'en_attente',
  })
  function set<K extends keyof typeof form>(k: K, v: string) { setForm(p => ({ ...p, [k]: v })) }

  const load = useCallback(async () => {
    if (!tenantId) return
    setLoading(true)
    const [{ data: cData }, { data: pats }, { data: meds }] = await Promise.all([
      supabase.from('clinique_consultations')
        .select('*, clinique_patients(nom, prenom), clinique_medecins(nom, prenom, specialite)')
        .eq('tenant_id', tenantId)
        .order('date_consult', { ascending: false })
        .limit(100),
      supabase.from('clinique_patients').select('id, nom, prenom').eq('tenant_id', tenantId).eq('actif', true).order('nom').limit(200),
      supabase.from('clinique_medecins').select('id, nom, prenom, specialite').eq('tenant_id', tenantId).eq('actif', true).order('nom').limit(200),
    ])
    setConsults((cData ?? []) as Consultation[])
    setPatients(pats ?? [])
    setMedecins(meds ?? [])
    setLoading(false)
  }, [tenantId])

  useEffect(() => { if (!tenantLoading) load() }, [tenantLoading, load])

  async function handleSave() {
    if (!tenantId || !form.patient_id || !form.motif.trim()) {
      setError('Patient et motif obligatoires'); return
    }
    setSaving(true); setError('')
    await supabase.from('clinique_consultations').insert({
      tenant_id:       tenantId,
      patient_id:      form.patient_id,
      medecin_id:      form.medecin_id || null,
      motif:           form.motif.trim(),
      examen:          form.examen || null,
      diagnostic:      form.diagnostic || null,
      traitement:      form.traitement || null,
      ordonnance:      form.ordonnance || null,
      pression_art:    form.pression_art || null,
      temperature:     form.temperature ? parseFloat(form.temperature) : null,
      poids:           form.poids ? parseFloat(form.poids) : null,
      taille:          form.taille ? parseFloat(form.taille) : null,
      montant:         parseFloat(form.montant) || 0,
      statut_paiement: form.statut_paiement,
    })
    setSaving(false); setShowModal(false)
    setForm({ patient_id: '', medecin_id: '', motif: '', examen: '', diagnostic: '', traitement: '', ordonnance: '', pression_art: '', temperature: '', poids: '', taille: '', montant: '', statut_paiement: 'en_attente' })
    load()
  }

  const totalMois = consults
    .filter(c => c.date_consult?.startsWith(new Date().toISOString().slice(0, 7)))
    .reduce((s, c) => s + (c.montant || 0), 0)

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
              <Stethoscope size={18} className="text-[#7C3AED]" /> Consultations ({consults.length})
            </h1>
            <p className="text-xs text-[#64748B]">Diagnostics & ordonnances · Revenu mois : {fmtFCFA(totalMois)}</p>
          </div>
        </div>
        <button onClick={() => { setError(''); setShowModal(true) }}
          className="flex items-center gap-1.5 bg-[#DC2626] text-white px-4 py-2 rounded-xl text-xs font-semibold hover:bg-[#B91C1C]">
          <Plus size={14} /> Nouvelle consultation
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-[#E5E7EB] overflow-hidden">
        {consults.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16">
            <Stethoscope size={32} className="text-[#CBD5E1] mb-3" />
            <p className="text-sm text-[#94A3B8]">Aucune consultation enregistrée</p>
          </div>
        ) : (
          <div className="divide-y divide-[#F8FAFC]">
            {consults.map(c => {
              const paie = getPaie(c.statut_paiement)
              const pat  = c.clinique_patients
              const med  = c.clinique_medecins
              const isOpen = expanded === c.id
              return (
                <div key={c.id}>
                  <div className="flex items-center gap-3 px-5 py-3 hover:bg-[#F8FAFC] cursor-pointer" onClick={() => setExpanded(isOpen ? null : c.id)}>
                    <div className="w-9 h-9 rounded-xl bg-[#F5F3FF] flex items-center justify-center flex-shrink-0">
                      <FileText size={14} className="text-[#7C3AED]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-[#0F172A]">{pat ? `${pat.prenom} ${pat.nom}` : '—'}</p>
                      <p className="text-xs text-[#64748B]">
                        {c.motif}
                        {med ? ` · Dr ${med.prenom} ${med.nom}` : ''}
                        {' · '}{new Date(c.date_consult).toLocaleDateString('fr-FR')}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-[#0F172A]">{fmtFCFA(c.montant)}</span>
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ color: paie.color, background: paie.bg }}>{paie.label}</span>
                    </div>
                  </div>
                  {isOpen && (
                    <div className="px-5 pb-4 bg-[#FAFAFA] border-t border-[#F1F5F9]">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-3 text-xs">
                        {c.examen && <div><p className="font-semibold text-[#64748B] mb-1">Examen</p><p className="text-[#374151]">{c.examen}</p></div>}
                        {c.diagnostic && <div><p className="font-semibold text-[#64748B] mb-1">Diagnostic</p><p className="text-[#374151]">{c.diagnostic}</p></div>}
                        {c.traitement && <div><p className="font-semibold text-[#64748B] mb-1">Traitement</p><p className="text-[#374151]">{c.traitement}</p></div>}
                        {c.ordonnance && <div><p className="font-semibold text-[#64748B] mb-1">Ordonnance</p><p className="text-[#374151] whitespace-pre-wrap">{c.ordonnance}</p></div>}
                        <div>
                          <p className="font-semibold text-[#64748B] mb-1">Constantes</p>
                          <p className="text-[#374151]">
                            {c.pression_art ? `TA: ${c.pression_art}` : ''}{c.temperature ? ` · T°: ${c.temperature}°C` : ''}
                            {c.poids ? ` · ${c.poids}kg` : ''}{c.taille ? ` · ${c.taille}cm` : ''}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-[#E5E7EB] sticky top-0 bg-white">
              <h2 className="text-sm font-bold text-[#0F172A]">Nouvelle consultation</h2>
              <button onClick={() => setShowModal(false)}><X size={18} className="text-[#94A3B8]" /></button>
            </div>
            <div className="p-5 space-y-4">
              {error && <div className="bg-[#FEF2F2] text-[#DC2626] text-xs px-3 py-2 rounded-xl flex items-center gap-2"><AlertTriangle size={13} />{error}</div>}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-semibold text-[#374151] mb-1 block">Patient *</label>
                  <select value={form.patient_id} onChange={e => set('patient_id', e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-[#E5E7EB] rounded-xl focus:outline-none bg-white">
                    <option value="">— Sélectionner</option>
                    {patients.map(p => <option key={p.id} value={p.id}>{p.prenom} {p.nom}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-[#374151] mb-1 block">Médecin</label>
                  <select value={form.medecin_id} onChange={e => set('medecin_id', e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-[#E5E7EB] rounded-xl focus:outline-none bg-white">
                    <option value="">— Non assigné</option>
                    {medecins.map(m => <option key={m.id} value={m.id}>Dr {m.prenom} {m.nom}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-[#374151] mb-1 block">Motif *</label>
                <input value={form.motif} onChange={e => set('motif', e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-[#E5E7EB] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#DC2626]/20" />
              </div>

              {/* Constantes */}
              <div>
                <p className="text-[11px] font-bold text-[#64748B] uppercase tracking-wide mb-2">Constantes vitales</p>
                <div className="grid grid-cols-4 gap-2">
                  {([['pression_art','Tension','ex: 120/80'],['temperature','Temp. (°C)','37.0'],['poids','Poids (kg)','70'],['taille','Taille (cm)','170']] as const).map(([k, label, ph]) => (
                    <div key={k}>
                      <label className="text-[10px] font-semibold text-[#374151] mb-1 block">{label}</label>
                      <input value={form[k]} onChange={e => set(k, e.target.value)} placeholder={ph}
                        className="w-full px-2 py-1.5 text-xs border border-[#E5E7EB] rounded-lg focus:outline-none" />
                    </div>
                  ))}
                </div>
              </div>

              {/* Clinique */}
              {([['examen','Examen clinique'],['diagnostic','Diagnostic'],['traitement','Traitement prescrit'],['ordonnance','Ordonnance']] as const).map(([k, label]) => (
                <div key={k}>
                  <label className="text-[11px] font-semibold text-[#374151] mb-1 block">{label}</label>
                  <textarea value={form[k]} onChange={e => set(k, e.target.value)} rows={2}
                    className="w-full px-3 py-2 text-xs border border-[#E5E7EB] rounded-xl focus:outline-none resize-none" />
                </div>
              ))}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-semibold text-[#374151] mb-1 block">Montant (FCFA)</label>
                  <input type="number" value={form.montant} onChange={e => set('montant', e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-[#E5E7EB] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#DC2626]/20" />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-[#374151] mb-1 block">Statut paiement</label>
                  <select value={form.statut_paiement} onChange={e => set('statut_paiement', e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-[#E5E7EB] rounded-xl focus:outline-none bg-white">
                    {PAIE_STATUTS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 px-5 pb-5">
              <button onClick={() => setShowModal(false)}
                className="px-4 py-2 text-xs font-semibold text-[#64748B] border border-[#E5E7EB] rounded-xl hover:bg-[#F8FAFC]">{t('common.cancel')}</button>
              <button onClick={handleSave} disabled={saving}
                className="px-4 py-2 text-xs font-semibold bg-[#DC2626] text-white rounded-xl hover:bg-[#B91C1C] disabled:opacity-50">
                {saving ? 'Enregistrement…' : 'Enregistrer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

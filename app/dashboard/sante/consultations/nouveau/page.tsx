'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useTenant } from '@/lib/hooks/useTenant'
import {
  Stethoscope, ChevronLeft, AlertTriangle, Loader2,
  Plus, Trash2, Heart,
} from 'lucide-react'
import Link from 'next/link'

interface Patient { id: string; nom: string; prenom: string; allergies: string | null; groupe_sanguin: string | null }
interface Medecin { id: string; nom: string; prenom: string; specialite: string }
interface Medicament { id: string; nom_commercial: string; dosage: string | null; forme: string | null }

interface OrdoLigne {
  medicament_id: string
  nom_medicament: string
  dosage: string
  posologie: string
  duree_jours: string
  quantite: string
  instructions: string
}

const ETAPES = ['Constantes', 'Examen', 'Diagnostic', 'Ordonnance', 'Facturation']
const PAIE_STATUTS = [
  { value: 'en_attente', label: 'En attente' },
  { value: 'paye',       label: 'Payé' },
  { value: 'assurance',  label: 'Assurance' },
  { value: 'partiel',    label: 'Partiel' },
]

const BLANK_LIGNE: OrdoLigne = {
  medicament_id: '', nom_medicament: '', dosage: '', posologie: '',
  duree_jours: '7', quantite: '1', instructions: '',
}

export default function NouvelleConsultationPage() {
  const router       = useRouter()
  const searchParams = useSearchParams()
  const prePatient   = searchParams.get('patient') ?? ''
  const preRdv       = searchParams.get('rdv') ?? ''
  const { tenantId, loading: tenantLoading } = useTenant()

  const [etape,     setEtape]     = useState(0)
  const [patients,  setPatients]  = useState<Patient[]>([])
  const [medecins,  setMedecins]  = useState<Medecin[]>([])
  const [medicaments, setMedicaments] = useState<Medicament[]>([])
  const [loading,   setLoading]   = useState(true)
  const [saving,    setSaving]    = useState(false)
  const [error,     setError]     = useState('')
  const [selectedPat, setSelectedPat] = useState<Patient | null>(null)

  const [form, setForm] = useState({
    patient_id: prePatient, medecin_id: '', rdv_id: preRdv,
    motif: '', examen: '', diagnostic: '', traitement: '',
    pression_art: '', temperature: '', poids: '', taille: '',
    pouls: '', saturation_o2: '', frequence_resp: '',
    code_cim10: '', montant: '', statut_paiement: 'en_attente',
    creer_ordonnance: true, diagnostic_ordo: '', instructions_ordo: '',
    validite_jours: '30',
  })
  const [ordoLignes, setOrdoLignes] = useState<OrdoLigne[]>([{ ...BLANK_LIGNE }])

  function setF<K extends keyof typeof form>(k: K, v: string | boolean) {
    setForm(p => ({ ...p, [k]: v }))
  }

  const load = useCallback(async () => {
    if (!tenantId) return
    const [{ data: pats }, { data: meds }, { data: meds2 }] = await Promise.all([
      supabase.from('clinique_patients').select('id, nom, prenom, allergies, groupe_sanguin').eq('tenant_id', tenantId).eq('actif', true).order('nom').limit(300),
      supabase.from('clinique_medecins').select('id, nom, prenom, specialite').eq('tenant_id', tenantId).eq('actif', true).order('nom').limit(100),
      supabase.from('pharmacie_medicaments').select('id, nom_commercial, dosage, forme').eq('tenant_id', tenantId).eq('actif', true).order('nom_commercial').limit(500),
    ])
    setPatients(pats ?? [])
    setMedecins(meds ?? [])
    setMedicaments(meds2 ?? [])
    setLoading(false)

    if (preRdv) {
      const { data: rdv } = await supabase.from('clinique_rdv').select('patient_id, medecin_id, motif').eq('id', preRdv).single()
      if (rdv) {
        setForm(p => ({ ...p, patient_id: rdv.patient_id, medecin_id: rdv.medecin_id ?? '', motif: rdv.motif }))
      }
    }
  }, [tenantId, preRdv])

  useEffect(() => { if (!tenantLoading) load() }, [tenantLoading, load])

  useEffect(() => {
    if (form.patient_id) {
      const pat = patients.find(p => p.id === form.patient_id)
      setSelectedPat(pat ?? null)
    } else {
      setSelectedPat(null)
    }
  }, [form.patient_id, patients])

  function addLigne() { setOrdoLignes(l => [...l, { ...BLANK_LIGNE }]) }
  function removeLigne(i: number) { setOrdoLignes(l => l.filter((_, idx) => idx !== i)) }
  function updateLigne(i: number, key: keyof OrdoLigne, val: string) {
    setOrdoLignes(l => l.map((line, idx) => {
      if (idx !== i) return line
      const updated = { ...line, [key]: val }
      if (key === 'medicament_id') {
        const med = medicaments.find(m => m.id === val)
        if (med) updated.nom_medicament = med.nom_commercial
        if (med?.dosage) updated.dosage = med.dosage
      }
      return updated
    }))
  }

  async function handleSave() {
    if (!tenantId || !form.patient_id || !form.motif.trim()) {
      setError('Patient et motif obligatoires'); return
    }
    setSaving(true); setError('')

    const consultRes = await fetch('/api/sante/consultations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        patient_id:     form.patient_id,
        medecin_id:     form.medecin_id || null,
        rdv_id:         form.rdv_id || null,
        motif:          form.motif.trim(),
        examen:         form.examen || null,
        diagnostic:     form.diagnostic || null,
        traitement:     form.traitement || null,
        pression_art:   form.pression_art || null,
        temperature:    form.temperature ? parseFloat(form.temperature) : null,
        poids:          form.poids ? parseFloat(form.poids) : null,
        taille:         form.taille ? parseFloat(form.taille) : null,
        pouls:          form.pouls ? parseFloat(form.pouls) : null,
        saturation_o2:  form.saturation_o2 ? parseFloat(form.saturation_o2) : null,
        frequence_resp: form.frequence_resp ? parseFloat(form.frequence_resp) : null,
        code_cim10:     form.code_cim10 || null,
        montant:        parseFloat(form.montant) || 0,
        statut_paiement: form.statut_paiement,
      }),
    })
    if (!consultRes.ok) {
      const json = await consultRes.json().catch(() => ({}))
      setError((json as { error?: string }).error ?? 'Erreur lors de l\'enregistrement')
      setSaving(false); return
    }
    const consult = await consultRes.json() as { id: string }

    // Marquer le RDV terminé si fourni
    if (form.rdv_id) {
      await supabase.from('clinique_rdv').update({ statut: 'termine' }).eq('id', form.rdv_id)
    }

    // Créer l'ordonnance structurée si demandé
    if (form.creer_ordonnance && ordoLignes.some(l => l.nom_medicament.trim())) {
      const { data: ordo } = await supabase.from('his_ordonnances').insert({
        tenant_id:        tenantId,
        patient_id:       form.patient_id,
        consultation_id:  consult.id,
        medecin_id:       form.medecin_id || null,
        diagnostic:       form.diagnostic_ordo || form.diagnostic || null,
        instructions:     form.instructions_ordo || null,
        validite_jours:   parseInt(form.validite_jours) || 30,
      }).select('id').single()

      if (ordo) {
        const lignesValides = ordoLignes.filter(l => l.nom_medicament.trim())
        if (lignesValides.length > 0) {
          await supabase.from('his_ordonnance_lignes').insert(
            lignesValides.map((l, i) => ({
              ordonnance_id:  ordo.id,
              medicament_id:  l.medicament_id || null,
              nom_medicament: l.nom_medicament.trim(),
              dosage:         l.dosage || null,
              posologie:      l.posologie,
              duree_jours:    parseInt(l.duree_jours) || null,
              quantite:       parseInt(l.quantite) || 1,
              instructions:   l.instructions || null,
              ordre:          i + 1,
            }))
          )
        }
      }
    }

    setSaving(false)
    router.push(`/dashboard/sante/patients/${form.patient_id}`)
  }

  if (tenantLoading || loading) {
    return <div className="min-h-screen bg-[#F5F7FB] flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-[#DC2626]" /></div>
  }

  const canNext = etape === 0
    ? !!form.patient_id && !!form.motif.trim()
    : true

  return (
    <div className="min-h-screen bg-[#F5F7FB] p-4 md:p-6">
      <div className="max-w-2xl mx-auto space-y-5">

        {/* Header */}
        <div className="flex items-center gap-3">
          <Link href="/dashboard/sante/consultations" className="p-2 rounded-xl hover:bg-white border border-[#E5E7EB]">
            <ChevronLeft size={16} className="text-[#64748B]" />
          </Link>
          <div>
            <h1 className="text-lg font-bold text-[#0F172A] flex items-center gap-2">
              <Stethoscope size={18} className="text-[#7C3AED]" /> Nouvelle consultation
            </h1>
            {selectedPat && (
              <p className="text-xs text-[#64748B]">
                {selectedPat.prenom} {selectedPat.nom}
                {selectedPat.allergies && <span className="ml-2 text-[#DC2626] font-semibold">⚠ {selectedPat.allergies}</span>}
              </p>
            )}
          </div>
        </div>

        {/* Stepper */}
        <div className="flex items-center gap-1 overflow-x-auto pb-1">
          {ETAPES.map((e, i) => (
            <button key={e} onClick={() => i < etape + 1 && setEtape(i)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                i === etape ? 'bg-[#DC2626] text-white' :
                i < etape ? 'bg-[#F0FDF4] text-[#16A34A]' :
                'bg-white text-[#94A3B8] border border-[#E5E7EB]'
              }`}>
              <span className="w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold"
                style={{ background: i === etape ? 'rgba(255,255,255,0.3)' : 'transparent' }}>
                {i + 1}
              </span>
              {e}
            </button>
          ))}
        </div>

        {error && <div className="bg-[#FEF2F2] text-[#DC2626] text-xs px-4 py-2.5 rounded-xl flex items-center gap-2"><AlertTriangle size={13} />{error}</div>}

        <div className="bg-white rounded-2xl border border-[#E5E7EB] p-6 space-y-4">

          {/* ÉTAPE 0 — Patient + motif */}
          {etape === 0 && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-semibold text-[#374151] mb-1 block">Patient *</label>
                  <select value={form.patient_id} onChange={e => setF('patient_id', e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-[#E5E7EB] rounded-xl focus:outline-none bg-white focus:ring-2 focus:ring-[#DC2626]/20">
                    <option value="">— Sélectionner</option>
                    {patients.map(p => <option key={p.id} value={p.id}>{p.prenom} {p.nom}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-[#374151] mb-1 block">Médecin</label>
                  <select value={form.medecin_id} onChange={e => setF('medecin_id', e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-[#E5E7EB] rounded-xl focus:outline-none bg-white">
                    <option value="">— Non assigné</option>
                    {medecins.map(m => <option key={m.id} value={m.id}>Dr {m.prenom} {m.nom} · {m.specialite}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="text-[11px] font-semibold text-[#374151] mb-1 block">Motif de consultation *</label>
                <input value={form.motif} onChange={e => setF('motif', e.target.value)}
                  placeholder="Consultation générale, douleur abdominale, suivi HTA…"
                  className="w-full px-3 py-2 text-xs border border-[#E5E7EB] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#DC2626]/20" />
              </div>
            </>
          )}

          {/* ÉTAPE 1 — Constantes vitales */}
          {etape === 1 && (
            <>
              <p className="text-xs font-bold text-[#64748B] uppercase tracking-wide flex items-center gap-2">
                <Heart size={12} className="text-[#DC2626]" /> Constantes vitales
              </p>
              <div className="grid grid-cols-3 gap-3">
                {([
                  ['pression_art',   'Tension art.',     'ex: 120/80'],
                  ['pouls',          'Pouls (bpm)',       '80'],
                  ['temperature',    'Température (°C)',  '37.0'],
                  ['saturation_o2',  'SpO2 (%)',          '98'],
                  ['frequence_resp', 'Freq. resp.',       '16'],
                  ['poids',          'Poids (kg)',        '70'],
                  ['taille',         'Taille (cm)',       '170'],
                ] as [keyof typeof form, string, string][]).map(([k, label, ph]) => (
                  <div key={k}>
                    <label className="text-[10px] font-semibold text-[#374151] mb-1 block">{label}</label>
                    <input value={form[k] as string} onChange={e => setF(k, e.target.value)} placeholder={ph}
                      className="w-full px-2 py-1.5 text-xs border border-[#E5E7EB] rounded-lg focus:outline-none" />
                  </div>
                ))}
              </div>
            </>
          )}

          {/* ÉTAPE 2 — Examen + Diagnostic */}
          {etape === 2 && (
            <>
              <div>
                <label className="text-[11px] font-semibold text-[#374151] mb-1 block">Examen clinique</label>
                <textarea value={form.examen} onChange={e => setF('examen', e.target.value)} rows={3}
                  placeholder="Description de l'examen physique…"
                  className="w-full px-3 py-2 text-xs border border-[#E5E7EB] rounded-xl focus:outline-none resize-none" />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-[#374151] mb-1 block">Diagnostic</label>
                <textarea value={form.diagnostic} onChange={e => setF('diagnostic', e.target.value)} rows={2}
                  placeholder="Diagnostic principal…"
                  className="w-full px-3 py-2 text-xs border border-[#E5E7EB] rounded-xl focus:outline-none resize-none" />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-[#374151] mb-1 block">Code CIM-10</label>
                <input value={form.code_cim10} onChange={e => setF('code_cim10', e.target.value)}
                  placeholder="ex: A09, J18.0, K80…"
                  className="w-full px-3 py-2 text-xs border border-[#E5E7EB] rounded-xl focus:outline-none" />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-[#374151] mb-1 block">Traitement</label>
                <textarea value={form.traitement} onChange={e => setF('traitement', e.target.value)} rows={2}
                  placeholder="Protocole thérapeutique…"
                  className="w-full px-3 py-2 text-xs border border-[#E5E7EB] rounded-xl focus:outline-none resize-none" />
              </div>
            </>
          )}

          {/* ÉTAPE 3 — Ordonnance */}
          {etape === 3 && (
            <>
              <div className="flex items-center gap-3">
                <input type="checkbox" id="creer_ordo" checked={form.creer_ordonnance as boolean}
                  onChange={e => setF('creer_ordonnance', e.target.checked)}
                  className="w-4 h-4 accent-[#DC2626]" />
                <label htmlFor="creer_ordo" className="text-xs font-semibold text-[#374151]">
                  Créer une ordonnance structurée
                </label>
              </div>

              {form.creer_ordonnance && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] font-semibold text-[#374151] mb-1 block">Diagnostic (ordonnance)</label>
                      <input value={form.diagnostic_ordo} onChange={e => setF('diagnostic_ordo', e.target.value)}
                        placeholder={form.diagnostic || 'Diagnostic…'}
                        className="w-full px-3 py-2 text-xs border border-[#E5E7EB] rounded-xl focus:outline-none" />
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-[#374151] mb-1 block">Validité (jours)</label>
                      <input type="number" value={form.validite_jours} onChange={e => setF('validite_jours', e.target.value)}
                        className="w-full px-3 py-2 text-xs border border-[#E5E7EB] rounded-xl focus:outline-none" />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <label className="text-[11px] font-semibold text-[#374151]">Médicaments prescrits</label>
                      <button onClick={addLigne}
                        className="flex items-center gap-1 text-[10px] text-[#DC2626] hover:underline">
                        <Plus size={11} /> Ajouter
                      </button>
                    </div>
                    <div className="space-y-3">
                      {ordoLignes.map((l, i) => (
                        <div key={i} className="border border-[#E5E7EB] rounded-xl p-3 space-y-2">
                          <div className="flex gap-2">
                            <div className="flex-1">
                              <select value={l.medicament_id}
                                onChange={e => updateLigne(i, 'medicament_id', e.target.value)}
                                className="w-full px-2 py-1.5 text-xs border border-[#E5E7EB] rounded-lg focus:outline-none bg-white">
                                <option value="">— Sélectionner ou saisir ci-dessous</option>
                                {medicaments.map(m => <option key={m.id} value={m.id}>{m.nom_commercial}{m.dosage ? ` ${m.dosage}` : ''}</option>)}
                              </select>
                            </div>
                            {ordoLignes.length > 1 && (
                              <button onClick={() => removeLigne(i)} className="p-1.5 text-[#94A3B8] hover:text-[#DC2626]">
                                <Trash2 size={13} />
                              </button>
                            )}
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <input value={l.nom_medicament} onChange={e => updateLigne(i, 'nom_medicament', e.target.value)}
                              placeholder="Nom médicament *"
                              className="px-2 py-1.5 text-xs border border-[#E5E7EB] rounded-lg focus:outline-none" />
                            <input value={l.dosage} onChange={e => updateLigne(i, 'dosage', e.target.value)}
                              placeholder="Dosage ex: 500mg"
                              className="px-2 py-1.5 text-xs border border-[#E5E7EB] rounded-lg focus:outline-none" />
                            <input value={l.posologie} onChange={e => updateLigne(i, 'posologie', e.target.value)}
                              placeholder="Posologie ex: 1cp matin midi soir"
                              className="col-span-2 px-2 py-1.5 text-xs border border-[#E5E7EB] rounded-lg focus:outline-none" />
                            <div className="flex gap-2">
                              <input type="number" value={l.duree_jours} onChange={e => updateLigne(i, 'duree_jours', e.target.value)}
                                placeholder="Durée (j)" min={1}
                                className="w-full px-2 py-1.5 text-xs border border-[#E5E7EB] rounded-lg focus:outline-none" />
                              <input type="number" value={l.quantite} onChange={e => updateLigne(i, 'quantite', e.target.value)}
                                placeholder="Qté" min={1}
                                className="w-full px-2 py-1.5 text-xs border border-[#E5E7EB] rounded-lg focus:outline-none" />
                            </div>
                            <input value={l.instructions} onChange={e => updateLigne(i, 'instructions', e.target.value)}
                              placeholder="Instructions spéciales"
                              className="px-2 py-1.5 text-xs border border-[#E5E7EB] rounded-lg focus:outline-none" />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </>
          )}

          {/* ÉTAPE 4 — Facturation */}
          {etape === 4 && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-semibold text-[#374151] mb-1 block">Montant consultation (FCFA)</label>
                  <input type="number" value={form.montant} onChange={e => setF('montant', e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-[#E5E7EB] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#DC2626]/20" />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-[#374151] mb-1 block">Statut paiement</label>
                  <select value={form.statut_paiement} onChange={e => setF('statut_paiement', e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-[#E5E7EB] rounded-xl focus:outline-none bg-white">
                    {PAIE_STATUTS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                </div>
              </div>
              <div className="bg-[#F8FAFC] rounded-xl p-4 space-y-2 text-xs">
                <p className="font-semibold text-[#374151]">Résumé de la consultation</p>
                <p><span className="text-[#94A3B8]">Patient :</span> {patients.find(p => p.id === form.patient_id)?.prenom} {patients.find(p => p.id === form.patient_id)?.nom}</p>
                <p><span className="text-[#94A3B8]">Motif :</span> {form.motif}</p>
                {form.diagnostic && <p><span className="text-[#94A3B8]">Diagnostic :</span> {form.diagnostic}</p>}
                {form.creer_ordonnance && ordoLignes.some(l => l.nom_medicament) && (
                  <p><span className="text-[#94A3B8]">Ordonnance :</span> {ordoLignes.filter(l => l.nom_medicament).length} médicament(s)</p>
                )}
              </div>
            </>
          )}
        </div>

        {/* Navigation */}
        <div className="flex gap-3">
          {etape > 0 && (
            <button onClick={() => setEtape(e => e - 1)}
              className="flex-shrink-0 px-4 py-2.5 text-xs font-semibold text-[#64748B] border border-[#E5E7EB] rounded-xl hover:bg-[#F8FAFC]">
              Précédent
            </button>
          )}
          {etape === 0 && (
            <Link href="/dashboard/sante/consultations"
              className="flex-shrink-0 px-4 py-2.5 text-xs font-semibold text-[#64748B] border border-[#E5E7EB] rounded-xl hover:bg-[#F8FAFC]">
              Annuler
            </Link>
          )}
          {etape < ETAPES.length - 1 ? (
            <button onClick={() => setEtape(e => e + 1)} disabled={!canNext}
              className="flex-1 py-2.5 text-xs font-semibold bg-[#0F172A] text-white rounded-xl hover:bg-[#1E293B] disabled:opacity-40 transition-colors">
              Suivant — {ETAPES[etape + 1]}
            </button>
          ) : (
            <button onClick={handleSave} disabled={saving}
              className="flex-1 py-2.5 text-xs font-semibold bg-[#DC2626] text-white rounded-xl hover:bg-[#B91C1C] disabled:opacity-50 transition-colors">
              {saving ? 'Enregistrement…' : 'Enregistrer la consultation'}
            </button>
          )}
        </div>

      </div>
    </div>
  )
}

'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useTenant } from '@/lib/hooks/useTenant'
import { useFmt } from '@/lib/hooks/useFmt'
import {
  ChevronLeft, User, Phone, Droplets, Calendar, Stethoscope,
  FileText, FlaskConical, Bed, CreditCard, AlertTriangle,
  Loader2, Plus, Heart, Mail, MapPin, Shield,
  CheckCircle2, Clock,
} from 'lucide-react'
import Link from 'next/link'

interface Patient {
  id: string; numero_dossier: string | null; nom: string; prenom: string
  date_naissance: string | null; sexe: string | null; telephone: string | null
  email: string | null; adresse: string | null; groupe_sanguin: string | null
  antecedents: string | null; allergies: string | null; assurance: string | null
  numero_assurance: string | null; profession: string | null
  situation_matrimoniale: string | null; created_at: string
}
interface Consultation {
  id: string; date_consult: string; motif: string; diagnostic: string | null
  traitement: string | null; montant: number; statut_paiement: string
  medecin_nom?: string; medecin_prenom?: string
}
interface Ordonnance {
  id: string; numero: string | null; date_prescription: string
  statut: string; diagnostic: string | null; medecin_nom?: string
}
interface ExamenLabo {
  id: string; date_prescription: string; type_examen: string; statut: string; urgence: boolean
}
interface Sejour {
  id: string; numero_sejour: string | null; date_entree: string
  date_sortie_effective: string | null; motif_admission: string; statut: string
  lit_numero?: string
}
interface Facture {
  id: string; numero_facture: string | null; date_facture: string
  montant_total: number; montant_paye: number; statut: string
}

const TABS = [
  { id: 'resume',         label: 'Résumé',          icon: User },
  { id: 'consultations',  label: 'Consultations',   icon: Stethoscope },
  { id: 'ordonnances',    label: 'Ordonnances',      icon: FileText },
  { id: 'labo',           label: 'Labo',             icon: FlaskConical },
  { id: 'hospitalisations', label: 'Hospitalisations', icon: Bed },
  { id: 'facturation',    label: 'Facturation',      icon: CreditCard },
]

function age(dob: string | null) {
  if (!dob) return '—'
  return `${Math.floor((Date.now() - new Date(dob).getTime()) / 31557600000)} ans`
}
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
}
function fmtDatetime(iso: string) {
  return new Date(iso).toLocaleString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

const STATUT_PAIEMENT: Record<string, { label: string; color: string; bg: string }> = {
  en_attente: { label: 'En attente', color: '#D97706', bg: '#FFFBEB' },
  paye:       { label: 'Payé',       color: '#16A34A', bg: '#F0FDF4' },
  assurance:  { label: 'Assurance',  color: '#2563EB', bg: '#EFF6FF' },
  partiel:    { label: 'Partiel',    color: '#7C3AED', bg: '#F5F3FF' },
}
const STATUT_FAC: Record<string, { label: string; color: string; bg: string }> = {
  en_attente: { label: 'En attente', color: '#D97706', bg: '#FFFBEB' },
  partielle:  { label: 'Partielle',  color: '#7C3AED', bg: '#F5F3FF' },
  payee:      { label: 'Payée',      color: '#16A34A', bg: '#F0FDF4' },
  annulee:    { label: 'Annulée',    color: '#DC2626', bg: '#FEF2F2' },
}

export default function PatientDossierPage() {
  const params   = useParams()
  const patId    = params.id as string
  const { tenantId, loading: tenantLoading } = useTenant()
  const { fmt }  = useFmt()

  const [patient,    setPatient]    = useState<Patient | null>(null)
  const [consults,   setConsults]   = useState<Consultation[]>([])
  const [ordos,      setOrdos]      = useState<Ordonnance[]>([])
  const [examens,    setExamens]    = useState<ExamenLabo[]>([])
  const [sejours,    setSejours]    = useState<Sejour[]>([])
  const [factures,   setFactures]   = useState<Facture[]>([])
  const [tab,        setTab]        = useState('resume')
  const [loading,    setLoading]    = useState(true)

  const load = useCallback(async () => {
    if (!tenantId || !patId) return
    setLoading(true)

    const [
      { data: pat },
      { data: consData },
      { data: ordData },
      { data: labData },
      { data: sejData },
      { data: facData },
    ] = await Promise.all([
      supabase.from('clinique_patients').select('*').eq('id', patId).eq('tenant_id', tenantId).single(),
      supabase.from('clinique_consultations')
        .select('id, date_consult, motif, diagnostic, traitement, montant, statut_paiement, clinique_medecins(nom, prenom)')
        .eq('patient_id', patId).eq('tenant_id', tenantId).order('date_consult', { ascending: false }).limit(50),
      supabase.from('his_ordonnances')
        .select('id, numero, date_prescription, statut, diagnostic, clinique_medecins(nom, prenom)')
        .eq('patient_id', patId).eq('tenant_id', tenantId).order('date_prescription', { ascending: false }).limit(30),
      supabase.from('his_examens_labo')
        .select('id, date_prescription, type_examen, statut, urgence')
        .eq('patient_id', patId).eq('tenant_id', tenantId).order('date_prescription', { ascending: false }).limit(30),
      supabase.from('his_sejours')
        .select('id, numero_sejour, date_entree, date_sortie_effective, motif_admission, statut, his_lits(numero)')
        .eq('patient_id', patId).eq('tenant_id', tenantId).order('date_entree', { ascending: false }).limit(20),
      supabase.from('his_factures')
        .select('id, numero_facture, date_facture, montant_total, montant_paye, statut')
        .eq('patient_id', patId).eq('tenant_id', tenantId).order('date_facture', { ascending: false }).limit(30),
    ])

    setPatient(pat)

    setConsults((consData ?? []).map((c: Record<string, unknown>) => {
      const med = Array.isArray(c.clinique_medecins) ? c.clinique_medecins[0] : c.clinique_medecins
      return {
        id: c.id as string, date_consult: c.date_consult as string, motif: c.motif as string,
        diagnostic: c.diagnostic as string | null, traitement: c.traitement as string | null,
        montant: c.montant as number, statut_paiement: c.statut_paiement as string,
        medecin_nom: (med as { nom: string })?.nom, medecin_prenom: (med as { prenom: string })?.prenom,
      }
    }))

    setOrdos((ordData ?? []).map((o: Record<string, unknown>) => {
      const med = Array.isArray(o.clinique_medecins) ? o.clinique_medecins[0] : o.clinique_medecins
      return {
        id: o.id as string, numero: o.numero as string | null,
        date_prescription: o.date_prescription as string, statut: o.statut as string,
        diagnostic: o.diagnostic as string | null,
        medecin_nom: (med as { nom: string })?.nom,
      }
    }))

    setExamens((labData ?? []).map((e: Record<string, unknown>) => ({
      id: e.id as string, date_prescription: e.date_prescription as string,
      type_examen: e.type_examen as string, statut: e.statut as string, urgence: e.urgence as boolean,
    })))

    setSejours((sejData ?? []).map((s: Record<string, unknown>) => {
      const lit = Array.isArray(s.his_lits) ? s.his_lits[0] : s.his_lits
      return {
        id: s.id as string, numero_sejour: s.numero_sejour as string | null,
        date_entree: s.date_entree as string, date_sortie_effective: s.date_sortie_effective as string | null,
        motif_admission: s.motif_admission as string, statut: s.statut as string,
        lit_numero: (lit as { numero: string })?.numero,
      }
    }))

    setFactures(facData ?? [])
    setLoading(false)
  }, [tenantId, patId])

  useEffect(() => { if (!tenantLoading) load() }, [tenantLoading, load])

  if (tenantLoading || loading) {
    return <div className="min-h-screen bg-[#F5F7FB] flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-[#DC2626]" /></div>
  }
  if (!patient) {
    return <div className="min-h-screen bg-[#F5F7FB] flex items-center justify-center">
      <p className="text-sm text-[#94A3B8]">Patient introuvable</p>
    </div>
  }

  const totalDu = factures.reduce((s, f) => s + (f.montant_total - f.montant_paye), 0)

  return (
    <div className="min-h-screen bg-[#F5F7FB] p-4 md:p-6 space-y-5">

      {/* Header patient */}
      <div className="flex items-start gap-4">
        <Link href="/dashboard/sante/patients" className="p-2 rounded-xl hover:bg-white border border-[#E5E7EB] transition-colors mt-1">
          <ChevronLeft size={16} className="text-[#64748B]" />
        </Link>
        <div className="bg-white rounded-2xl border border-[#E5E7EB] flex-1 p-5">
          <div className="flex flex-col sm:flex-row items-start gap-4">
            <div className="w-16 h-16 rounded-2xl bg-[#EFF6FF] flex items-center justify-center text-xl font-black text-[#2563EB] flex-shrink-0">
              {patient.prenom[0]}{patient.nom[0]}
            </div>
            <div className="flex-1">
              <div className="flex flex-wrap items-start gap-2 mb-1">
                <h1 className="text-xl font-bold text-[#0F172A]">{patient.prenom} {patient.nom}</h1>
                <span className="text-[10px] font-mono font-semibold text-[#64748B] bg-[#F1F5F9] px-2 py-0.5 rounded mt-1">
                  {patient.numero_dossier ?? '—'}
                </span>
                {patient.allergies && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#FEF2F2] text-[#DC2626] flex items-center gap-1 mt-1">
                    <AlertTriangle size={9} /> Allergies
                  </span>
                )}
              </div>
              <div className="flex flex-wrap gap-3 text-xs text-[#64748B]">
                <span className="flex items-center gap-1"><User size={11} /> {age(patient.date_naissance)} · {patient.sexe === 'M' ? 'Masculin' : patient.sexe === 'F' ? 'Féminin' : '—'}</span>
                {patient.groupe_sanguin && <span className="flex items-center gap-1 font-bold text-[#DC2626]"><Droplets size={11} /> {patient.groupe_sanguin}</span>}
                {patient.telephone && <span className="flex items-center gap-1"><Phone size={11} /> {patient.telephone}</span>}
                {patient.email && <span className="flex items-center gap-1"><Mail size={11} /> {patient.email}</span>}
                {patient.adresse && <span className="flex items-center gap-1"><MapPin size={11} /> {patient.adresse}</span>}
                {patient.assurance && <span className="flex items-center gap-1"><Shield size={11} /> {patient.assurance}</span>}
              </div>
            </div>
            <div className="flex gap-2 flex-shrink-0">
              <Link href={`/dashboard/sante/rendez-vous/nouveau?patient=${patId}`}
                className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl border border-[#E5E7EB] hover:bg-[#F8FAFC] text-[#374151]">
                <Calendar size={13} /> RDV
              </Link>
              <Link href={`/dashboard/sante/consultations/nouveau?patient=${patId}`}
                className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl bg-[#DC2626] text-white hover:bg-[#B91C1C]">
                <Plus size={13} /> Consultation
              </Link>
            </div>
          </div>

          {/* Mini stats */}
          <div className="grid grid-cols-4 gap-3 mt-4 pt-4 border-t border-[#F1F5F9]">
            {[
              { label: 'Consultations', value: consults.length, color: '#7C3AED', icon: Stethoscope },
              { label: 'Ordonnances',   value: ordos.length,    color: '#16A34A', icon: FileText },
              { label: 'Hospitalisations', value: sejours.length, color: '#0891B2', icon: Bed },
              { label: 'Solde dû',      value: fmt(totalDu),    color: totalDu > 0 ? '#DC2626' : '#16A34A', icon: CreditCard },
            ].map(s => (
              <div key={s.label} className="text-center">
                <p className="text-lg font-bold" style={{ color: s.color }}>{s.value}</p>
                <p className="text-[10px] text-[#94A3B8]">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Onglets */}
      <div className="bg-white rounded-2xl border border-[#E5E7EB] overflow-hidden">
        <div className="flex overflow-x-auto border-b border-[#E5E7EB]">
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 px-4 py-3 text-xs font-semibold whitespace-nowrap transition-colors border-b-2 ${
                tab === t.id
                  ? 'border-[#DC2626] text-[#DC2626] bg-[#FEF2F2]'
                  : 'border-transparent text-[#64748B] hover:text-[#0F172A] hover:bg-[#F8FAFC]'
              }`}>
              <t.icon size={13} />
              {t.label}
            </button>
          ))}
        </div>

        <div className="p-5">
          {/* RÉSUMÉ */}
          {tab === 'resume' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Antécédents */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold text-[#64748B] uppercase tracking-wide">Antécédents médicaux</h3>
                <div className="bg-[#F8FAFC] rounded-xl p-4">
                  {patient.antecedents ? (
                    <p className="text-sm text-[#374151] whitespace-pre-wrap">{patient.antecedents}</p>
                  ) : (
                    <p className="text-xs text-[#94A3B8] italic">Aucun antécédent renseigné</p>
                  )}
                </div>
                <h3 className="text-xs font-bold text-[#64748B] uppercase tracking-wide">Allergies connues</h3>
                <div className={`rounded-xl p-4 ${patient.allergies ? 'bg-[#FEF2F2] border border-[#FCA5A5]' : 'bg-[#F8FAFC]'}`}>
                  {patient.allergies ? (
                    <p className="text-sm text-[#DC2626] font-medium flex items-center gap-2">
                      <AlertTriangle size={14} /> {patient.allergies}
                    </p>
                  ) : (
                    <p className="text-xs text-[#94A3B8] flex items-center gap-2">
                      <CheckCircle2 size={13} className="text-[#16A34A]" /> Aucune allergie connue
                    </p>
                  )}
                </div>
              </div>
              {/* Dernières consultations */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-[#64748B] uppercase tracking-wide">Dernières consultations</h3>
                  <button onClick={() => setTab('consultations')} className="text-[10px] text-[#DC2626] hover:underline">Voir tout</button>
                </div>
                {consults.slice(0, 3).length === 0 ? (
                  <div className="bg-[#F8FAFC] rounded-xl p-4 text-center">
                    <p className="text-xs text-[#94A3B8]">Aucune consultation</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {consults.slice(0, 3).map(c => (
                      <div key={c.id} className="bg-[#F8FAFC] rounded-xl p-3">
                        <div className="flex justify-between items-start mb-1">
                          <p className="text-xs font-semibold text-[#0F172A]">{fmtDate(c.date_consult)}</p>
                          <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold"
                            style={{ color: STATUT_PAIEMENT[c.statut_paiement]?.color, background: STATUT_PAIEMENT[c.statut_paiement]?.bg }}>
                            {STATUT_PAIEMENT[c.statut_paiement]?.label}
                          </span>
                        </div>
                        <p className="text-xs text-[#374151]">{c.motif}</p>
                        {c.diagnostic && <p className="text-[10px] text-[#94A3B8] mt-1">Dx: {c.diagnostic}</p>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* CONSULTATIONS */}
          {tab === 'consultations' && (
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <p className="text-xs text-[#64748B]">{consults.length} consultation(s) au total</p>
                <Link href={`/dashboard/sante/consultations/nouveau?patient=${patId}`}
                  className="flex items-center gap-1 text-xs font-semibold bg-[#DC2626] text-white px-3 py-1.5 rounded-xl hover:bg-[#B91C1C]">
                  <Plus size={12} /> Nouvelle consultation
                </Link>
              </div>
              {consults.length === 0 ? (
                <div className="text-center py-12"><Stethoscope size={28} className="text-[#CBD5E1] mx-auto mb-2" /><p className="text-sm text-[#94A3B8]">Aucune consultation enregistrée</p></div>
              ) : (
                <div className="space-y-3">
                  {consults.map(c => (
                    <div key={c.id} className="border border-[#E5E7EB] rounded-xl p-4 hover:border-[#DC2626]/30 transition-colors">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <p className="text-sm font-semibold text-[#0F172A]">{fmtDatetime(c.date_consult)}</p>
                          {c.medecin_nom && <p className="text-[10px] text-[#94A3B8]">Dr {c.medecin_nom}</p>}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-[#0F172A]">{fmt(c.montant)}</span>
                          <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold"
                            style={{ color: STATUT_PAIEMENT[c.statut_paiement]?.color, background: STATUT_PAIEMENT[c.statut_paiement]?.bg }}>
                            {STATUT_PAIEMENT[c.statut_paiement]?.label}
                          </span>
                        </div>
                      </div>
                      <p className="text-xs text-[#374151] font-medium">Motif : {c.motif}</p>
                      {c.diagnostic && <p className="text-xs text-[#64748B] mt-1">Diagnostic : {c.diagnostic}</p>}
                      {c.traitement && <p className="text-xs text-[#64748B] mt-0.5">Traitement : {c.traitement}</p>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ORDONNANCES */}
          {tab === 'ordonnances' && (
            <div className="space-y-3">
              <p className="text-xs text-[#64748B]">{ordos.length} ordonnance(s)</p>
              {ordos.length === 0 ? (
                <div className="text-center py-12"><FileText size={28} className="text-[#CBD5E1] mx-auto mb-2" /><p className="text-sm text-[#94A3B8]">Aucune ordonnance</p></div>
              ) : (
                <div className="space-y-2">
                  {ordos.map(o => {
                    const colors: Record<string, { color: string; bg: string }> = {
                      active:    { color: '#16A34A', bg: '#F0FDF4' },
                      dispensee: { color: '#2563EB', bg: '#EFF6FF' },
                      expiree:   { color: '#94A3B8', bg: '#F1F5F9' },
                      annulee:   { color: '#DC2626', bg: '#FEF2F2' },
                    }
                    const c = colors[o.statut] ?? colors.active
                    return (
                      <div key={o.id} className="border border-[#E5E7EB] rounded-xl p-4 flex items-start gap-3">
                        <div className="w-8 h-8 rounded-lg bg-[#F0FDF4] flex items-center justify-center flex-shrink-0">
                          <FileText size={14} className="text-[#16A34A]" />
                        </div>
                        <div className="flex-1">
                          <div className="flex justify-between">
                            <p className="text-xs font-semibold text-[#0F172A]">{o.numero ?? 'Ordonnance'} — {fmtDate(o.date_prescription)}</p>
                            <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold" style={{ color: c.color, background: c.bg }}>
                              {o.statut}
                            </span>
                          </div>
                          {o.medecin_nom && <p className="text-[10px] text-[#94A3B8]">Dr {o.medecin_nom}</p>}
                          {o.diagnostic && <p className="text-xs text-[#64748B] mt-1">{o.diagnostic}</p>}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* LABO */}
          {tab === 'labo' && (
            <div className="space-y-3">
              <p className="text-xs text-[#64748B]">{examens.length} examen(s) prescrit(s)</p>
              {examens.length === 0 ? (
                <div className="text-center py-12"><FlaskConical size={28} className="text-[#CBD5E1] mx-auto mb-2" /><p className="text-sm text-[#94A3B8]">Aucun examen de laboratoire</p></div>
              ) : (
                <div className="space-y-2">
                  {examens.map(e => {
                    const statColors: Record<string, string> = {
                      prescrit: '#D97706', en_cours: '#7C3AED', resultat_partiel: '#0891B2',
                      resultat_complet: '#16A34A', annule: '#94A3B8',
                    }
                    return (
                      <div key={e.id} className="border border-[#E5E7EB] rounded-xl p-4 flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-[#FFFBEB] flex items-center justify-center flex-shrink-0">
                          <FlaskConical size={14} className="text-[#D97706]" />
                        </div>
                        <div className="flex-1">
                          <p className="text-xs font-semibold text-[#0F172A]">{e.type_examen}</p>
                          <p className="text-[10px] text-[#94A3B8]">{fmtDate(e.date_prescription)}</p>
                        </div>
                        {e.urgence && <span className="text-[10px] font-bold bg-[#FEF2F2] text-[#DC2626] px-2 py-0.5 rounded-full">URGENT</span>}
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                          style={{ color: statColors[e.statut] ?? '#94A3B8', background: `${statColors[e.statut] ?? '#94A3B8'}18` }}>
                          {e.statut}
                        </span>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* HOSPITALISATIONS */}
          {tab === 'hospitalisations' && (
            <div className="space-y-3">
              <p className="text-xs text-[#64748B]">{sejours.length} séjour(s)</p>
              {sejours.length === 0 ? (
                <div className="text-center py-12"><Bed size={28} className="text-[#CBD5E1] mx-auto mb-2" /><p className="text-sm text-[#94A3B8]">Aucune hospitalisation</p></div>
              ) : (
                <div className="space-y-3">
                  {sejours.map(s => (
                    <div key={s.id} className="border border-[#E5E7EB] rounded-xl p-4">
                      <div className="flex justify-between items-start mb-2">
                        <p className="text-xs font-semibold text-[#0F172A]">{s.numero_sejour ?? 'Séjour'}</p>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${s.statut === 'en_cours' ? 'bg-[#ECFEFF] text-[#0891B2]' : 'bg-[#F0FDF4] text-[#16A34A]'}`}>
                          {s.statut === 'en_cours' ? 'En cours' : 'Sorti'}
                        </span>
                      </div>
                      <p className="text-xs text-[#374151]">{s.motif_admission}</p>
                      <div className="flex gap-4 mt-2 text-[10px] text-[#94A3B8]">
                        <span className="flex items-center gap-1"><Calendar size={10} /> Entrée : {fmtDate(s.date_entree)}</span>
                        {s.date_sortie_effective && <span className="flex items-center gap-1"><Clock size={10} /> Sortie : {fmtDate(s.date_sortie_effective)}</span>}
                        {s.lit_numero && <span className="flex items-center gap-1"><Bed size={10} /> Lit {s.lit_numero}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* FACTURATION */}
          {tab === 'facturation' && (
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <p className="text-xs text-[#64748B]">{factures.length} facture(s)</p>
                {totalDu > 0 && (
                  <span className="text-xs font-bold px-3 py-1 rounded-xl bg-[#FEF2F2] text-[#DC2626]">
                    Solde dû : {fmt(totalDu)}
                  </span>
                )}
              </div>
              {factures.length === 0 ? (
                <div className="text-center py-12"><CreditCard size={28} className="text-[#CBD5E1] mx-auto mb-2" /><p className="text-sm text-[#94A3B8]">Aucune facture</p></div>
              ) : (
                <div className="space-y-2">
                  {factures.map(f => {
                    const st = STATUT_FAC[f.statut] ?? STATUT_FAC.en_attente
                    const restant = f.montant_total - f.montant_paye
                    return (
                      <div key={f.id} className="border border-[#E5E7EB] rounded-xl p-4 flex items-center gap-4">
                        <div className="flex-1">
                          <p className="text-xs font-semibold text-[#0F172A]">{f.numero_facture ?? 'Facture'} — {fmtDate(f.date_facture)}</p>
                          <div className="flex gap-3 mt-1 text-[10px] text-[#94A3B8]">
                            <span>Total : {fmt(f.montant_total)}</span>
                            <span>Payé : {fmt(f.montant_paye)}</span>
                            {restant > 0 && <span className="text-[#DC2626] font-semibold">Reste : {fmt(restant)}</span>}
                          </div>
                        </div>
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0"
                          style={{ color: st.color, background: st.bg }}>{st.label}</span>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Info patient */}
      <div className="bg-white rounded-2xl border border-[#E5E7EB] p-5">
        <h3 className="text-xs font-bold text-[#64748B] uppercase tracking-wide mb-3 flex items-center gap-2">
          <Heart size={12} className="text-[#DC2626]" /> Informations administratives
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
          {[
            { label: 'Dossier N°',    value: patient.numero_dossier ?? '—' },
            { label: 'Profession',    value: patient.profession ?? '—' },
            { label: 'Situation',     value: patient.situation_matrimoniale ?? '—' },
            { label: 'Assurance',     value: patient.assurance ? `${patient.assurance}${patient.numero_assurance ? ` — ${patient.numero_assurance}` : ''}` : '—' },
            { label: 'Enregistré le', value: fmtDate(patient.created_at) },
            { label: 'Date naissance',value: patient.date_naissance ? fmtDate(patient.date_naissance) : '—' },
            { label: 'Groupe sanguin',value: patient.groupe_sanguin ?? '—' },
            { label: 'Adresse',       value: patient.adresse ?? '—' },
          ].map(it => (
            <div key={it.label}>
              <p className="text-[10px] text-[#94A3B8] font-medium">{it.label}</p>
              <p className="text-[#374151] font-semibold mt-0.5">{it.value}</p>
            </div>
          ))}
        </div>
      </div>

    </div>
  )
}

'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useTenant } from '@/lib/hooks/useTenant'
import { useFmt } from '@/lib/hooks/useFmt'
import {
  Heart, Users, Calendar, Stethoscope,
  TrendingUp, Clock, AlertTriangle, CheckCircle2,
  Loader2, ChevronRight, Activity, Bed, Pill,
  FlaskConical, Shield, FileText, UserPlus,
  Siren, Settings, BriefcaseMedical,
} from 'lucide-react'
import Link from 'next/link'

interface Stats {
  totalPatients:    number
  rdvAujourdhui:   number
  consultMois:      number
  revenuMois:       number
  revenuJour:       number
  rdvEnAttente:     number
  patientsNouveaux: number
  litsOccupes:      number
  litsTotaux:       number
  hospitEnCours:    number
  urgencesEnCours:  number
  stockAlertes:     number
}

interface RdvToday {
  id:             string
  date_heure:     string
  motif:          string
  statut:         string
  patient_nom:    string
  patient_prenom: string
  patient_tel:    string
  medecin_nom:    string
  medecin_prenom: string
  specialite:     string
}

interface HospitEnCours {
  id:              string
  patient_nom:     string
  patient_prenom:  string
  numero_sejour:   string
  date_entree:     string
  motif_admission: string
  lit_numero:      string
  service:         string
}

interface StockAlerte {
  id:          string
  nom:         string
  stock_actuel: number
  stock_min:   number
  date_expiration: string | null
}

const STATUT_RDV: Record<string, { label: string; color: string; bg: string }> = {
  planifie:  { label: 'Planifié',  color: '#2563EB', bg: '#EFF6FF' },
  confirme:  { label: 'Confirmé',  color: '#16A34A', bg: '#F0FDF4' },
  arrive:    { label: 'Arrivé',    color: '#D97706', bg: '#FFFBEB' },
  en_cours:  { label: 'En cours',  color: '#7C3AED', bg: '#F5F3FF' },
  termine:   { label: 'Terminé',   color: '#64748B', bg: '#F8FAFC' },
  annule:    { label: 'Annulé',    color: '#DC2626', bg: '#FEF2F2' },
  absent:    { label: 'Absent',    color: '#94A3B8', bg: '#F1F5F9' },
}

const NAV_MODULES = [
  { href: '/dashboard/sante/patients',        label: 'Patients',        icon: Users,            color: '#2563EB', bg: '#EFF6FF', desc: 'Dossiers & historique' },
  { href: '/dashboard/sante/rendez-vous',     label: 'Rendez-vous',     icon: Calendar,         color: '#16A34A', bg: '#F0FDF4', desc: 'Planning médical' },
  { href: '/dashboard/sante/consultations',   label: 'Consultations',   icon: Stethoscope,      color: '#7C3AED', bg: '#F5F3FF', desc: 'Diagnostics & ordonnances' },
  { href: '/dashboard/sante/hospitalisations',label: 'Hospitalisations', icon: Bed,              color: '#0891B2', bg: '#ECFEFF', desc: 'Chambres & séjours' },
  { href: '/dashboard/sante/pharmacie',       label: 'Pharmacie',       icon: Pill,             color: '#16A34A', bg: '#F0FDF4', desc: 'Stock & dispensations' },
  { href: '/dashboard/sante/labo',            label: 'Laboratoire',     icon: FlaskConical,     color: '#D97706', bg: '#FFFBEB', desc: 'Examens & résultats' },
  { href: '/dashboard/sante/assurances',      label: 'Assurances',      icon: Shield,           color: '#7C3AED', bg: '#F5F3FF', desc: 'Dossiers & prises en charge' },
  { href: '/dashboard/sante/facturation',     label: 'Facturation',     icon: FileText,         color: '#DC2626', bg: '#FEF2F2', desc: 'Factures médicales' },
  { href: '/dashboard/sante/urgences',        label: 'Urgences',        icon: Siren,            color: '#DC2626', bg: '#FEF2F2', desc: 'Triage & prise en charge' },
  { href: '/dashboard/sante/imagerie',         label: 'Imagerie',        icon: Activity,         color: '#0891B2', bg: '#ECFEFF', desc: 'Radio, écho, scanner' },
  { href: '/dashboard/sante/medecins',        label: 'Médecins',        icon: BriefcaseMedical, color: '#64748B', bg: '#F1F5F9', desc: 'Personnel médical' },
  { href: '/dashboard/sante/miaa',            label: 'MIAA+ Médecin',   icon: Settings,         color: '#F59E0B', bg: '#FFFBEB', desc: 'Expert IA médical' },
]

function fmtHeure(iso: string) {
  return new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })
}
function joursHospitalisation(dateEntree: string) {
  const diff = Date.now() - new Date(dateEntree).getTime()
  return Math.floor(diff / 86400000)
}

export default function SantePage() {
  const { fmt: fmtFCFA } = useFmt()
  const { tenantId, loading: tenantLoading } = useTenant()
  const [stats,    setStats]    = useState<Stats | null>(null)
  const [rdvs,     setRdvs]     = useState<RdvToday[]>([])
  const [hospits,  setHospits]  = useState<HospitEnCours[]>([])
  const [alertes,  setAlertes]  = useState<StockAlerte[]>([])
  const [loading,  setLoading]  = useState(true)

  const load = useCallback(async () => {
    if (!tenantId) return
    setLoading(true)

    const today      = new Date().toISOString().slice(0, 10)
    const startMois  = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()
    const startJour  = today + 'T00:00:00'
    const endJour    = today + 'T23:59:59'

    const [
      { count: totalPatients },
      { count: rdvAujourdhui },
      { count: consultMois },
      { count: rdvEnAttente },
      { count: patientsNouveaux },
      { count: litsOccupes },
      { count: litsTotaux },
      { count: hospitEnCours },
      { count: urgencesEnCours },
      { data: consultsRevenu },
      { data: jourRevenu },
      { data: rdvData },
      { data: hospData },
      { data: stockData },
    ] = await Promise.all([
      supabase.from('clinique_patients').select('*', { count: 'exact', head: true }).eq('tenant_id', tenantId).eq('actif', true),
      supabase.from('clinique_rdv').select('*', { count: 'exact', head: true }).eq('tenant_id', tenantId).gte('date_heure', startJour).lte('date_heure', endJour),
      supabase.from('clinique_consultations').select('*', { count: 'exact', head: true }).eq('tenant_id', tenantId).gte('date_consult', startMois),
      supabase.from('clinique_rdv').select('*', { count: 'exact', head: true }).eq('tenant_id', tenantId).eq('statut', 'planifie').gte('date_heure', new Date().toISOString()),
      supabase.from('clinique_patients').select('*', { count: 'exact', head: true }).eq('tenant_id', tenantId).gte('created_at', startMois),
      supabase.from('his_lits').select('*', { count: 'exact', head: true }).eq('tenant_id', tenantId).eq('statut', 'occupe'),
      supabase.from('his_lits').select('*', { count: 'exact', head: true }).eq('tenant_id', tenantId),
      supabase.from('his_sejours').select('*', { count: 'exact', head: true }).eq('tenant_id', tenantId).eq('statut', 'en_cours'),
      supabase.from('his_urgences').select('*', { count: 'exact', head: true }).eq('tenant_id', tenantId).in('statut', ['en_attente', 'triage_fait', 'en_soins']),
      supabase.from('clinique_consultations').select('montant').eq('tenant_id', tenantId).gte('date_consult', startMois).limit(500),
      supabase.from('his_factures').select('montant_paye').eq('tenant_id', tenantId).gte('date_facture', today).lte('date_facture', today).limit(200),
      supabase.from('clinique_rdv')
        .select('id, date_heure, motif, statut, clinique_patients(nom, prenom, telephone), clinique_medecins(nom, prenom, specialite)')
        .eq('tenant_id', tenantId).gte('date_heure', startJour).lte('date_heure', endJour)
        .not('statut', 'in', '("annule","absent")').order('date_heure').limit(50),
      supabase.from('his_sejours')
        .select('id, numero_sejour, date_entree, motif_admission, clinique_patients(nom, prenom), his_lits(numero, service)')
        .eq('tenant_id', tenantId).eq('statut', 'en_cours').order('date_entree').limit(10),
      supabase.from('pharmacie_medicaments')
        .select('id, nom_commercial, stock_actuel, stock_min, date_expiration')
        .eq('tenant_id', tenantId).eq('actif', true).limit(200),
    ])

    const alertesMed: StockAlerte[] = (stockData ?? [])
      .filter((m: { stock_actuel: number; stock_min: number }) => m.stock_actuel <= m.stock_min)
      .slice(0, 8)
      .map((m: { id: string; nom_commercial: string; stock_actuel: number; stock_min: number; date_expiration: string | null }) => ({
        id: m.id, nom: m.nom_commercial, stock_actuel: m.stock_actuel,
        stock_min: m.stock_min, date_expiration: m.date_expiration,
      }))

    const revenuMois = (consultsRevenu ?? []).reduce((s: number, c: { montant: number }) => s + (c.montant || 0), 0)
    const revenuJour = (jourRevenu ?? []).reduce((s: number, f: { montant_paye: number }) => s + (f.montant_paye || 0), 0)

    setStats({
      totalPatients:    totalPatients    ?? 0,
      rdvAujourdhui:   rdvAujourdhui   ?? 0,
      consultMois:      consultMois      ?? 0,
      revenuMois,
      revenuJour,
      rdvEnAttente:     rdvEnAttente     ?? 0,
      patientsNouveaux: patientsNouveaux ?? 0,
      litsOccupes:      litsOccupes      ?? 0,
      litsTotaux:       litsTotaux       ?? 0,
      hospitEnCours:    hospitEnCours    ?? 0,
      urgencesEnCours:  urgencesEnCours  ?? 0,
      stockAlertes:     alertesMed.length,
    })

    setRdvs((rdvData ?? []).map((r: Record<string, unknown>) => {
      const pat = Array.isArray(r.clinique_patients) ? r.clinique_patients[0] : r.clinique_patients
      const med = Array.isArray(r.clinique_medecins) ? r.clinique_medecins[0] : r.clinique_medecins
      return {
        id: r.id as string, date_heure: r.date_heure as string, motif: r.motif as string, statut: r.statut as string,
        patient_nom:    (pat as { nom: string })?.nom ?? '—',
        patient_prenom: (pat as { prenom: string })?.prenom ?? '',
        patient_tel:    (pat as { telephone: string })?.telephone ?? '',
        medecin_nom:    (med as { nom: string })?.nom ?? '—',
        medecin_prenom: (med as { prenom: string })?.prenom ?? '',
        specialite:     (med as { specialite: string })?.specialite ?? '',
      }
    }))

    setHospits((hospData ?? []).map((h: Record<string, unknown>) => {
      const pat = Array.isArray(h.clinique_patients) ? h.clinique_patients[0] : h.clinique_patients
      const lit = Array.isArray(h.his_lits) ? h.his_lits[0] : h.his_lits
      return {
        id: h.id as string,
        patient_nom:     (pat as { nom: string })?.nom ?? '—',
        patient_prenom:  (pat as { prenom: string })?.prenom ?? '',
        numero_sejour:   h.numero_sejour as string ?? '',
        date_entree:     h.date_entree as string,
        motif_admission: h.motif_admission as string,
        lit_numero:      (lit as { numero: string })?.numero ?? '—',
        service:         (lit as { service: string })?.service ?? '',
      }
    }))

    setAlertes(alertesMed)
    setLoading(false)
  }, [tenantId])

  useEffect(() => { if (!tenantLoading) load() }, [tenantLoading, load])

  if (tenantLoading || loading) {
    return (
      <div className="min-h-screen bg-[#F5F7FB] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#DC2626]" />
      </div>
    )
  }

  const tauxOccup = stats && stats.litsTotaux > 0
    ? Math.round((stats.litsOccupes / stats.litsTotaux) * 100) : 0

  return (
    <div className="min-h-screen bg-[#F5F7FB] p-4 md:p-6 space-y-5">

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#0F172A] flex items-center gap-2">
            <Heart size={22} className="text-[#DC2626]" />
            Clinique &amp; Santé
          </h1>
          <p className="text-sm text-[#64748B] mt-0.5">
            {new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>
        <Link href="/dashboard/sante/patients/nouveau"
          className="flex items-center gap-2 bg-[#DC2626] hover:bg-[#B91C1C] text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors">
          <UserPlus size={15} />
          <span className="hidden sm:inline">Nouveau patient</span>
        </Link>
      </div>

      {/* KPIs — 8 cartes */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
        {[
          { label: 'Patients actifs',    value: stats?.totalPatients ?? 0,                        color: '#2563EB', bg: '#EFF6FF', icon: Users },
          { label: 'RDV aujourd\'hui',   value: stats?.rdvAujourdhui ?? 0,                        color: '#16A34A', bg: '#F0FDF4', icon: Calendar },
          { label: 'En attente',         value: stats?.rdvEnAttente ?? 0,                         color: '#D97706', bg: '#FFFBEB', icon: Clock },
          { label: 'Consult. mois',      value: stats?.consultMois ?? 0,                          color: '#7C3AED', bg: '#F5F3FF', icon: Stethoscope },
          { label: 'Hospitalisés',       value: `${stats?.litsOccupes ?? 0}/${stats?.litsTotaux ?? 0}`, color: '#0891B2', bg: '#ECFEFF', icon: Bed },
          { label: 'Urgences',           value: stats?.urgencesEnCours ?? 0,                      color: '#DC2626', bg: '#FEF2F2', icon: Siren },
          { label: 'Revenu du jour',     value: fmtFCFA(stats?.revenuJour ?? 0),                  color: '#16A34A', bg: '#F0FDF4', icon: TrendingUp },
          { label: 'Revenu du mois',     value: fmtFCFA(stats?.revenuMois ?? 0),                  color: '#DC2626', bg: '#FEF2F2', icon: TrendingUp },
        ].map(k => (
          <div key={k.label} className="bg-white rounded-2xl border border-[#E5E7EB] p-3 md:p-4">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center mb-2" style={{ background: k.bg }}>
              <k.icon size={13} style={{ color: k.color }} />
            </div>
            <p className="text-[10px] text-[#94A3B8] font-medium leading-tight">{k.label}</p>
            <p className="text-base font-bold text-[#0F172A] mt-0.5 truncate">{k.value}</p>
          </div>
        ))}
      </div>

      {/* Ligne principale : Agenda + Hospitalisations */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* Agenda du jour — timeline */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-[#E5E7EB] overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 border-b border-[#E5E7EB]">
            <h2 className="text-sm font-semibold text-[#0F172A] flex items-center gap-2">
              <Calendar size={15} className="text-[#2563EB]" />
              Agenda du jour
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#EFF6FF] text-[#2563EB]">
                {rdvs.length} RDV
              </span>
            </h2>
            <Link href="/dashboard/sante/rendez-vous"
              className="text-xs text-[#DC2626] hover:underline flex items-center gap-1">
              Voir tout <ChevronRight size={12} />
            </Link>
          </div>

          {rdvs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Calendar size={28} className="text-[#CBD5E1] mb-2" />
              <p className="text-sm text-[#94A3B8]">Aucun rendez-vous aujourd'hui</p>
              <Link href="/dashboard/sante/rendez-vous/nouveau"
                className="mt-3 text-xs text-[#DC2626] hover:underline">
                + Planifier un RDV
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-[#F1F5F9] max-h-80 overflow-y-auto">
              {rdvs.map(r => {
                const st = STATUT_RDV[r.statut] ?? STATUT_RDV.planifie
                const isCurrent = r.statut === 'en_cours' || r.statut === 'arrive'
                return (
                  <Link key={r.id} href={`/dashboard/sante/consultations/nouveau?rdv=${r.id}`}
                    className={`flex items-center gap-3 px-5 py-3 hover:bg-[#F8FAFC] transition-colors ${isCurrent ? 'bg-[#FFFBEB]' : ''}`}>
                    <div className="flex-shrink-0 text-center w-12">
                      <p className="text-[11px] font-bold text-[#2563EB]">{fmtHeure(r.date_heure)}</p>
                      {isCurrent && <div className="w-2 h-2 rounded-full bg-[#D97706] mx-auto mt-1 animate-pulse" />}
                    </div>
                    <div className="w-8 h-8 rounded-full bg-[#F1F5F9] flex items-center justify-center text-[11px] font-bold text-[#64748B] flex-shrink-0">
                      {r.patient_prenom.charAt(0)}{r.patient_nom.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-[#0F172A] truncate">{r.patient_prenom} {r.patient_nom}</p>
                      <p className="text-xs text-[#64748B] truncate">{r.motif} · Dr {r.medecin_prenom} {r.medecin_nom}</p>
                    </div>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0"
                      style={{ color: st.color, background: st.bg }}>
                      {st.label}
                    </span>
                  </Link>
                )
              })}
            </div>
          )}
        </div>

        {/* Hospitalisations en cours */}
        <div className="bg-white rounded-2xl border border-[#E5E7EB] overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 border-b border-[#E5E7EB]">
            <h2 className="text-sm font-semibold text-[#0F172A] flex items-center gap-2">
              <Bed size={14} className="text-[#0891B2]" />
              Hospitalisations
            </h2>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                style={{ background: tauxOccup > 80 ? '#FEF2F2' : '#ECFEFF', color: tauxOccup > 80 ? '#DC2626' : '#0891B2' }}>
                {tauxOccup}% occupé
              </span>
              <Link href="/dashboard/sante/hospitalisations" className="text-xs text-[#DC2626] hover:underline">
                <ChevronRight size={12} />
              </Link>
            </div>
          </div>

          {/* Taux d'occupation bar */}
          <div className="px-5 pt-3 pb-2">
            <div className="flex justify-between text-[10px] text-[#94A3B8] mb-1">
              <span>{stats?.litsOccupes ?? 0} lits occupés</span>
              <span>{stats?.litsTotaux ?? 0} total</span>
            </div>
            <div className="h-1.5 bg-[#F1F5F9] rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all duration-500"
                style={{ width: `${tauxOccup}%`, background: tauxOccup > 80 ? '#DC2626' : '#0891B2' }} />
            </div>
          </div>

          {hospits.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center px-4">
              <Bed size={22} className="text-[#CBD5E1] mb-2" />
              <p className="text-xs text-[#94A3B8]">Aucune hospitalisation en cours</p>
            </div>
          ) : (
            <div className="divide-y divide-[#F1F5F9] max-h-64 overflow-y-auto">
              {hospits.map(h => (
                <Link key={h.id} href={`/dashboard/sante/hospitalisations`}
                  className="flex items-start gap-3 px-5 py-2.5 hover:bg-[#F8FAFC] transition-colors">
                  <div className="w-7 h-7 rounded-lg bg-[#ECFEFF] flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Bed size={12} className="text-[#0891B2]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-[#0F172A] truncate">{h.patient_prenom} {h.patient_nom}</p>
                    <p className="text-[10px] text-[#94A3B8]">Lit {h.lit_numero} · {h.service}</p>
                    <p className="text-[10px] text-[#64748B] truncate">{h.motif_admission}</p>
                  </div>
                  <div className="flex-shrink-0 text-right">
                    <p className="text-[10px] font-bold text-[#0891B2]">{joursHospitalisation(h.date_entree)}j</p>
                    <p className="text-[10px] text-[#94A3B8]">{fmtDate(h.date_entree)}</p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Ligne secondaire : Alertes pharmacie + Modules */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* Alertes stock pharmacie */}
        {alertes.length > 0 && (
          <div className="bg-white rounded-2xl border border-[#FCA5A5] overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 border-b border-[#FCA5A5] bg-[#FEF2F2]">
              <h2 className="text-sm font-semibold text-[#DC2626] flex items-center gap-2">
                <AlertTriangle size={14} />
                Alertes pharmacie
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-[#DC2626] text-white">
                  {alertes.length}
                </span>
              </h2>
              <Link href="/dashboard/sante/pharmacie" className="text-xs text-[#DC2626] hover:underline flex items-center gap-1">
                Gérer <ChevronRight size={12} />
              </Link>
            </div>
            <div className="divide-y divide-[#F1F5F9] max-h-52 overflow-y-auto">
              {alertes.map(a => {
                const expBientot = a.date_expiration && new Date(a.date_expiration) < new Date(Date.now() + 30 * 86400000)
                return (
                  <div key={a.id} className="flex items-center gap-3 px-5 py-2.5">
                    <div className="w-7 h-7 rounded-lg bg-[#FEF2F2] flex items-center justify-center flex-shrink-0">
                      <Pill size={12} className="text-[#DC2626]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-[#0F172A] truncate">{a.nom}</p>
                      {expBientot && <p className="text-[10px] text-[#D97706]">Expire {fmtDate(a.date_expiration!)}</p>}
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#FEF2F2] text-[#DC2626] flex-shrink-0">
                      {a.stock_actuel}/{a.stock_min}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Modules rapides */}
        <div className={`${alertes.length > 0 ? 'lg:col-span-2' : 'lg:col-span-3'} bg-white rounded-2xl border border-[#E5E7EB] overflow-hidden`}>
          <div className="px-5 py-3 border-b border-[#E5E7EB]">
            <h2 className="text-sm font-semibold text-[#0F172A]">Accès rapide</h2>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-0 divide-x divide-y divide-[#F1F5F9]">
            {NAV_MODULES.slice(0, alertes.length > 0 ? 8 : 12).map(m => (
              <Link key={m.href} href={m.href}
                className="flex flex-col items-center gap-1.5 p-4 hover:bg-[#F8FAFC] transition-colors group text-center">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: m.bg }}>
                  <m.icon size={16} style={{ color: m.color }} />
                </div>
                <p className="text-[11px] font-semibold text-[#374151] group-hover:text-[#DC2626] leading-tight">{m.label}</p>
                <p className="text-[10px] text-[#94A3B8] leading-tight hidden sm:block">{m.desc}</p>
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* Nouveaux patients ce mois */}
      {(stats?.patientsNouveaux ?? 0) > 0 && (
        <div className="bg-white rounded-2xl border border-[#E5E7EB] p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#F0FDF4] flex items-center justify-center">
              <CheckCircle2 size={16} className="text-[#16A34A]" />
            </div>
            <div>
              <p className="text-sm font-semibold text-[#0F172A]">
                {stats?.patientsNouveaux} nouveau{(stats?.patientsNouveaux ?? 0) > 1 ? 'x patients' : ' patient'} ce mois
              </p>
              <p className="text-xs text-[#94A3B8]">Depuis le 1er {new Date().toLocaleDateString('fr-FR', { month: 'long' })}</p>
            </div>
          </div>
          <Link href="/dashboard/sante/patients"
            className="text-xs font-semibold text-[#16A34A] hover:underline flex items-center gap-1">
            Voir la liste <ChevronRight size={12} />
          </Link>
        </div>
      )}

    </div>
  )
}

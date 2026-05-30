'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useTenant } from '@/lib/hooks/useTenant'
import { fmtFCFA } from '@/lib/admin-config'
import {
  Heart, Users, Calendar, Stethoscope,
  TrendingUp, Clock, AlertTriangle, CheckCircle2,
  Loader2, ChevronRight, Activity,
} from 'lucide-react'
import Link from 'next/link'

interface Stats {
  totalPatients: number
  rdvAujourdhui: number
  consultMois:   number
  revenuMois:    number
  rdvEnAttente:  number
  patientsNouveaux: number
}

interface RdvToday {
  id:              string
  date_heure:      string
  motif:           string
  statut:          string
  patient_nom:     string
  patient_prenom:  string
  patient_tel:     string
  medecin_nom:     string
  medecin_prenom:  string
  specialite:      string
}

const STATUT_RDV: Record<string, { label: string; color: string; bg: string }> = {
  planifie:  { label: 'Planifié',   color: '#2563EB', bg: '#EFF6FF' },
  confirme:  { label: 'Confirmé',   color: '#16A34A', bg: '#F0FDF4' },
  arrive:    { label: 'Arrivé',     color: '#D97706', bg: '#FFFBEB' },
  en_cours:  { label: 'En cours',   color: '#7C3AED', bg: '#F5F3FF' },
  termine:   { label: 'Terminé',    color: '#64748B', bg: '#F8FAFC' },
  annule:    { label: 'Annulé',     color: '#DC2626', bg: '#FEF2F2' },
  absent:    { label: 'Absent',     color: '#94A3B8', bg: '#F1F5F9' },
}

const NAV_MODULES = [
  { href: '/dashboard/sante/patients',      label: 'Patients',       icon: Users,        color: '#2563EB', bg: '#EFF6FF', desc: 'Dossiers & historique' },
  { href: '/dashboard/sante/rendez-vous',   label: 'Rendez-vous',    icon: Calendar,     color: '#16A34A', bg: '#F0FDF4', desc: 'Planning médical' },
  { href: '/dashboard/sante/consultations', label: 'Consultations',  icon: Stethoscope,  color: '#7C3AED', bg: '#F5F3FF', desc: 'Diagnostics & ordonnances' },
  { href: '/dashboard/sante/medecins',      label: 'Médecins',       icon: Activity,     color: '#D97706', bg: '#FFFBEB', desc: 'Personnel médical' },
]

function fmtHeure(iso: string): string {
  return new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}

export default function SantePage() {
  const { tenantId, loading: tenantLoading } = useTenant()
  const [stats, setStats]     = useState<Stats | null>(null)
  const [rdvs,  setRdvs]      = useState<RdvToday[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!tenantId) return
    setLoading(true)

    const today = new Date().toISOString().slice(0, 10)
    const startMois = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()

    const [
      { count: totalPatients },
      { count: rdvAujourdhui },
      { count: consultMois },
      { count: rdvEnAttente },
      { count: patientsNouveaux },
      { data: consults },
      { data: rdvData },
    ] = await Promise.all([
      supabase.from('clinique_patients').select('*', { count: 'exact', head: true }).eq('tenant_id', tenantId).eq('actif', true),
      supabase.from('clinique_rdv').select('*', { count: 'exact', head: true }).eq('tenant_id', tenantId).gte('date_heure', today).lt('date_heure', today + 'T23:59:59'),
      supabase.from('clinique_consultations').select('*', { count: 'exact', head: true }).eq('tenant_id', tenantId).gte('date_consult', startMois),
      supabase.from('clinique_rdv').select('*', { count: 'exact', head: true }).eq('tenant_id', tenantId).eq('statut', 'planifie').gte('date_heure', new Date().toISOString()),
      supabase.from('clinique_patients').select('*', { count: 'exact', head: true }).eq('tenant_id', tenantId).gte('created_at', startMois),
      supabase.from('clinique_consultations').select('montant').eq('tenant_id', tenantId).gte('date_consult', startMois).limit(200),
      supabase.from('clinique_rdv')
        .select('id, date_heure, motif, statut, clinique_patients(nom, prenom, telephone), clinique_medecins(nom, prenom, specialite)')
        .eq('tenant_id', tenantId)
        .gte('date_heure', today)
        .lt('date_heure', today + 'T23:59:59')
        .not('statut', 'in', '("annule","absent")')
        .order('date_heure').limit(200),
    ])

    const revenuMois = (consults ?? []).reduce((s: number, c: { montant: number }) => s + (c.montant || 0), 0)

    setStats({
      totalPatients:    totalPatients ?? 0,
      rdvAujourdhui:    rdvAujourdhui ?? 0,
      consultMois:      consultMois ?? 0,
      revenuMois,
      rdvEnAttente:     rdvEnAttente ?? 0,
      patientsNouveaux: patientsNouveaux ?? 0,
    })

    const rdvProcessed = (rdvData ?? []).map((r: Record<string, unknown>) => {
      const pat = Array.isArray(r.clinique_patients) ? r.clinique_patients[0] : r.clinique_patients
      const med = Array.isArray(r.clinique_medecins) ? r.clinique_medecins[0] : r.clinique_medecins
      return {
        id:             r.id as string,
        date_heure:     r.date_heure as string,
        motif:          r.motif as string,
        statut:         r.statut as string,
        patient_nom:    (pat as { nom: string })?.nom ?? '—',
        patient_prenom: (pat as { prenom: string })?.prenom ?? '',
        patient_tel:    (pat as { telephone: string })?.telephone ?? '',
        medecin_nom:    (med as { nom: string })?.nom ?? '—',
        medecin_prenom: (med as { prenom: string })?.prenom ?? '',
        specialite:     (med as { specialite: string })?.specialite ?? '',
      }
    })
    setRdvs(rdvProcessed)
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

  return (
    <div className="min-h-screen bg-[#F5F7FB] p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#0F172A] flex items-center gap-2">
          <Heart size={22} className="text-[#DC2626]" />
          Clinique & Santé
        </h1>
        <p className="text-sm text-[#64748B] mt-0.5">Tableau de bord médical · {new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
        {[
          { label: 'Patients actifs',   value: stats?.totalPatients ?? 0,    color: '#2563EB', bg: '#EFF6FF',  icon: Users },
          { label: 'RDV aujourd\'hui',  value: stats?.rdvAujourdhui ?? 0,    color: '#16A34A', bg: '#F0FDF4',  icon: Calendar },
          { label: 'RDV en attente',    value: stats?.rdvEnAttente ?? 0,     color: '#D97706', bg: '#FFFBEB',  icon: Clock },
          { label: 'Consult. ce mois',  value: stats?.consultMois ?? 0,      color: '#7C3AED', bg: '#F5F3FF',  icon: Stethoscope },
          { label: 'Nouveaux patients', value: stats?.patientsNouveaux ?? 0, color: '#0891B2', bg: '#ECFEFF',  icon: CheckCircle2 },
          { label: 'Revenu du mois',    value: fmtFCFA(stats?.revenuMois ?? 0), color: '#DC2626', bg: '#FEF2F2', icon: TrendingUp },
        ].map(k => (
          <div key={k.label} className="bg-white rounded-2xl border border-[#E5E7EB] p-4">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center mb-2" style={{ background: k.bg }}>
              <k.icon size={14} style={{ color: k.color }} />
            </div>
            <p className="text-[11px] text-[#94A3B8] font-medium">{k.label}</p>
            <p className="text-lg font-bold text-[#0F172A] mt-0.5">{k.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* RDV du jour */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-[#E5E7EB] overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 border-b border-[#E5E7EB]">
            <h2 className="text-sm font-semibold text-[#0F172A]">Rendez-vous du jour</h2>
            <Link href="/dashboard/sante/rendez-vous" className="text-xs text-[#DC2626] hover:underline flex items-center gap-1">
              Voir tout <ChevronRight size={12} />
            </Link>
          </div>
          {rdvs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Calendar size={28} className="text-[#CBD5E1] mb-2" />
              <p className="text-sm text-[#94A3B8]">Aucun rendez-vous aujourd'hui</p>
            </div>
          ) : (
            <div className="divide-y divide-[#F1F5F9]">
              {rdvs.map(r => {
                const st = STATUT_RDV[r.statut] ?? STATUT_RDV.planifie
                return (
                  <div key={r.id} className="flex items-center gap-3 px-5 py-3 hover:bg-[#F8FAFC]">
                    <div className="w-10 h-10 rounded-full bg-[#EFF6FF] flex items-center justify-center text-xs font-bold text-[#2563EB]">
                      {fmtHeure(r.date_heure)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-[#0F172A]">{r.patient_prenom} {r.patient_nom}</p>
                      <p className="text-xs text-[#64748B]">{r.motif} · Dr {r.medecin_prenom} {r.medecin_nom}</p>
                    </div>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ color: st.color, background: st.bg }}>
                      {st.label}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Navigation modules */}
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-[#0F172A] px-1">Modules</h2>
          {NAV_MODULES.map(m => (
            <Link key={m.href} href={m.href}
              className="flex items-center gap-3 bg-white rounded-2xl border border-[#E5E7EB] p-4 hover:border-[#DC2626]/30 hover:shadow-sm transition-all group">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: m.bg }}>
                <m.icon size={16} style={{ color: m.color }} />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-[#0F172A] group-hover:text-[#DC2626]">{m.label}</p>
                <p className="text-xs text-[#94A3B8]">{m.desc}</p>
              </div>
              <ChevronRight size={14} className="text-[#CBD5E1] group-hover:text-[#DC2626]" />
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}

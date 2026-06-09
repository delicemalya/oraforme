'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { ArrowLeft, RefreshCw, Loader2, TrendingUp, BedDouble, AlertTriangle, Users, Activity, FlaskConical, ScanLine, Scissors, Receipt, Shield, Bot } from 'lucide-react'

interface KPIs {
  patients_actifs: number; consultations_mois: number; ca_consultations_mois: number
  lits_total: number; lits_occupes: number; taux_occupation: number
  urgences_actives: number; urgences_aujourd: number; sejours_en_cours: number
  factures_impayees: number; personnel_total: number; medecins_actifs: number
  labo_en_attente: number; imagerie_en_attente: number; bloc_aujourd: number
}
interface HistoriquePoint { mois: string; ca: number }

const fmtNum = (n: number) => new Intl.NumberFormat('fr-FR').format(Math.round(n))

const MODULES = [
  { href: '/dashboard/sante',               label: 'Clinique',       icon: Activity,     color: '#2563EB' },
  { href: '/dashboard/sante/patients',      label: 'Patients',       icon: Users,        color: '#7C3AED' },
  { href: '/dashboard/sante/urgences',      label: 'Urgences',       icon: AlertTriangle,color: '#DC2626' },
  { href: '/dashboard/sante/hospitalisation',label: 'Hospitalisation',icon: BedDouble,    color: '#2563EB' },
  { href: '/dashboard/sante/labo',          label: 'Laboratoire',    icon: FlaskConical, color: '#7C3AED' },
  { href: '/dashboard/sante/imagerie',      label: 'Imagerie',       icon: ScanLine,     color: '#0891B2' },
  { href: '/dashboard/sante/bloc',          label: 'Bloc',           icon: Scissors,     color: '#EA580C' },
  { href: '/dashboard/sante/facturation',   label: 'Facturation',    icon: Receipt,      color: '#16A34A' },
  { href: '/dashboard/sante/assurances',    label: 'Assurances',     icon: Shield,       color: '#4F46E5' },
  { href: '/dashboard/sante/rh',            label: 'RH Médical',     icon: Users,        color: '#475569' },
  { href: '/dashboard/sante/miaa',          label: 'MIAA+',          icon: Bot,          color: '#2563EB' },
]

export default function DirectionSantePage() {
  const [kpis,       setKpis]       = useState<KPIs | null>(null)
  const [historique, setHistorique] = useState<HistoriquePoint[]>([])
  const [loading,    setLoading]    = useState(true)

  async function load() {
    setLoading(true)
    const res = await fetch('/api/sante/direction')
    if (res.ok) {
      const d = await res.json()
      setKpis(d.kpis ?? null)
      setHistorique(d.historique ?? [])
    }
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const maxCa = historique.length ? Math.max(...historique.map(h => h.ca), 1) : 1

  return (
    <div className="min-h-screen bg-[#F8FAFC] pb-20">
      <div className="bg-white border-b border-[#E2E8F0] px-4 sm:px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/dashboard/sante" className="flex items-center gap-1 text-[#64748B] text-[13px]"><ArrowLeft size={14} /> Santé</Link>
            <span className="text-[#E2E8F0]">/</span>
            <div>
              <h1 className="text-[16px] font-black text-[#0F172A]">Direction Médicale</h1>
              <p className="text-[10px] text-[#94A3B8]">Tableau de bord HIS</p>
            </div>
          </div>
          <button onClick={load} className="p-2 border border-[#E2E8F0] rounded-xl text-[#64748B]"><RefreshCw size={13} /></button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-24 gap-2 text-[#94A3B8]"><Loader2 size={20} className="animate-spin" /> Chargement...</div>
      ) : kpis ? (
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-6">

          {/* KPIs principaux */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: 'Patients actifs',    val: String(kpis.patients_actifs),    color: '#2563EB', icon: Users },
              { label: 'CA consultations',   val: fmtNum(kpis.ca_consultations_mois) + ' FCFA', color: '#16A34A', icon: TrendingUp },
              { label: 'Occupation lits',    val: kpis.taux_occupation + '%',       color: kpis.taux_occupation >= 80 ? '#DC2626' : '#F59E0B', icon: BedDouble },
              { label: 'Urgences actives',   val: String(kpis.urgences_actives),   color: '#DC2626', icon: AlertTriangle },
            ].map(s => {
              const Icon = s.icon
              return (
                <div key={s.label} className="bg-white rounded-2xl border border-[#E2E8F0] shadow-sm p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: s.color + '15' }}>
                      <Icon size={16} style={{ color: s.color }} />
                    </div>
                  </div>
                  <p className="text-[22px] font-black leading-none" style={{ color: s.color }}>{s.val}</p>
                  <p className="text-[10px] font-bold text-[#94A3B8] uppercase tracking-wide mt-1">{s.label}</p>
                </div>
              )
            })}
          </div>

          {/* Stats secondaires */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {[
              { label: 'Lits occupés',       val: `${kpis.lits_occupes}/${kpis.lits_total}`, color: '#2563EB' },
              { label: 'Séjours en cours',   val: String(kpis.sejours_en_cours),              color: '#7C3AED' },
              { label: 'Consultations mois', val: String(kpis.consultations_mois),            color: '#0891B2' },
              { label: 'Médecins actifs',    val: String(kpis.medecins_actifs),               color: '#475569' },
              { label: 'Personnel paramédical', val: String(kpis.personnel_total),           color: '#475569' },
              { label: 'Bloc aujourd\'hui',  val: String(kpis.bloc_aujourd),                 color: '#EA580C' },
            ].map(s => (
              <div key={s.label} className="bg-white rounded-2xl border border-[#E2E8F0] shadow-sm p-3 text-center">
                <p className="text-[20px] font-black" style={{ color: s.color }}>{s.val}</p>
                <p className="text-[9px] font-bold text-[#94A3B8] uppercase tracking-wide leading-tight mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>

          {/* Alertes + Examens en attente */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-sm p-4">
              <p className="text-[11px] font-black text-[#94A3B8] uppercase tracking-wide mb-3">Factures impayées</p>
              <p className="text-[28px] font-black text-[#DC2626]">{fmtNum(kpis.factures_impayees)}</p>
              <p className="text-[11px] text-[#64748B]">FCFA en attente de règlement</p>
              <Link href="/dashboard/sante/facturation?statut=en_attente"
                className="mt-3 block text-center py-1.5 bg-red-50 text-red-600 text-[11px] font-bold rounded-xl hover:bg-red-100">
                Voir les factures →
              </Link>
            </div>
            <div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-sm p-4">
              <p className="text-[11px] font-black text-[#94A3B8] uppercase tracking-wide mb-3">Examens en attente</p>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FlaskConical size={13} className="text-[#7C3AED]" />
                    <span className="text-[12px] text-[#475569]">Labo</span>
                  </div>
                  <span className="font-black text-[14px]" style={{ color: kpis.labo_en_attente > 0 ? '#F59E0B' : '#16A34A' }}>
                    {kpis.labo_en_attente}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ScanLine size={13} className="text-[#0891B2]" />
                    <span className="text-[12px] text-[#475569]">Imagerie</span>
                  </div>
                  <span className="font-black text-[14px]" style={{ color: kpis.imagerie_en_attente > 0 ? '#F59E0B' : '#16A34A' }}>
                    {kpis.imagerie_en_attente}
                  </span>
                </div>
              </div>
              <div className="flex gap-2 mt-3">
                <Link href="/dashboard/sante/labo" className="flex-1 text-center py-1.5 bg-purple-50 text-purple-700 text-[10px] font-bold rounded-xl">Labo →</Link>
                <Link href="/dashboard/sante/imagerie" className="flex-1 text-center py-1.5 bg-cyan-50 text-cyan-700 text-[10px] font-bold rounded-xl">Imagerie →</Link>
              </div>
            </div>
            <div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-sm p-4">
              <p className="text-[11px] font-black text-[#94A3B8] uppercase tracking-wide mb-3">Urgences du jour</p>
              <p className="text-[28px] font-black" style={{ color: kpis.urgences_aujourd > 0 ? '#DC2626' : '#16A34A' }}>
                {kpis.urgences_aujourd}
              </p>
              <p className="text-[11px] text-[#64748B]">nouvelles admissions aujourd'hui</p>
              <p className="text-[12px] font-bold mt-1" style={{ color: kpis.urgences_actives > 0 ? '#F59E0B' : '#16A34A' }}>
                {kpis.urgences_actives} en cours de soins
              </p>
              <Link href="/dashboard/sante/urgences"
                className="mt-3 block text-center py-1.5 bg-red-50 text-red-600 text-[11px] font-bold rounded-xl hover:bg-red-100">
                Tableau triage →
              </Link>
            </div>
          </div>

          {/* Historique CA */}
          {historique.length > 0 && (
            <div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-sm p-5">
              <p className="text-[13px] font-black text-[#0F172A] mb-4">CA — 6 derniers mois</p>
              <div className="flex items-end gap-3 h-32">
                {historique.map((h, i) => {
                  const pct = maxCa > 0 ? (h.ca / maxCa) * 100 : 0
                  const isLast = i === historique.length - 1
                  return (
                    <div key={i} className="flex-1 flex flex-col items-center gap-1">
                      <span className="text-[9px] text-[#94A3B8] font-semibold">{fmtNum(h.ca / 1000)}K</span>
                      <div className="w-full rounded-t-lg" style={{ height: `${Math.max(4, pct)}%`, background: isLast ? '#2563EB' : '#E2E8F0' }} />
                      <span className="text-[9px] text-[#94A3B8] font-bold">{h.mois}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Navigation modules */}
          <div>
            <p className="text-[12px] font-black text-[#94A3B8] uppercase tracking-wide mb-3">Navigation rapide</p>
            <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-2">
              {MODULES.map(m => {
                const Icon = m.icon
                return (
                  <Link key={m.href} href={m.href}
                    className="bg-white rounded-2xl border border-[#E2E8F0] shadow-sm p-3 flex flex-col items-center gap-1.5 hover:border-blue-200 hover:shadow-md transition-all">
                    <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: m.color + '15' }}>
                      <Icon size={15} style={{ color: m.color }} />
                    </div>
                    <span className="text-[10px] font-bold text-[#475569] text-center leading-tight">{m.label}</span>
                  </Link>
                )
              })}
            </div>
          </div>

        </div>
      ) : (
        <div className="max-w-6xl mx-auto px-4 py-20 text-center">
          <p className="text-[#94A3B8]">Impossible de charger les données</p>
          <button onClick={load} className="mt-4 px-4 py-2 bg-[#2563EB] text-white rounded-xl text-[13px] font-bold">Réessayer</button>
        </div>
      )}
    </div>
  )
}

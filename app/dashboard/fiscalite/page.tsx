'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Receipt, Users, TrendingUp, AlertTriangle, CheckCircle,
  Clock, ArrowRight, Loader2, RefreshCw, Building2,
  CalendarDays, ChevronRight, FileText, Landmark, GraduationCap,
} from 'lucide-react'
import Link from 'next/link'
import { PAYS_LIST } from '@/lib/fiscalite/pays'
import type { PaysFiscal } from '@/lib/fiscalite/types'

// ── Design tokens ──────────────────────────────────────────────────────────────
const TEXT   = '#0F172A'
const MUTED  = '#64748B'
const BORDER = '#E2E8F0'
const BG     = '#F8FAFC'
const BLUE   = '#2563EB'
const GREEN  = '#16A34A'
const AMBER  = '#F59E0B'
const RED    = '#DC2626'
const PURPLE = '#7C3AED'

function fmtN(n: number, devise = 'FCFA') {
  if (devise === 'EUR' || devise === 'CHF') {
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: devise === 'CHF' ? 'CHF' : 'EUR' }).format(n)
  }
  return new Intl.NumberFormat('fr-FR').format(Math.round(n)) + ' ' + devise
}

interface KpiData {
  tva_a_payer: number; tva_collectee: number; tva_deductible: number
  cnss_salarie: number; cnss_patronal: number; irpp_total: number
  nb_employes: number; ca_ht: number
}

interface PatenteInfo { statut: string; patente_nette: number }

interface EcheanceData {
  type: string; label: string; date_echeance: string
  jours_restants: number; statut: 'retard' | 'urgent' | 'ok'
  montant_estime?: number; href: string
}

export default function FiscaliteDashboardPage() {
  const [pays,    setPays]    = useState<PaysFiscal>('CG')
  const [annee,   setAnnee]   = useState(new Date().getFullYear())
  const [kpis,    setKpis]    = useState<KpiData | null>(null)
  const [patente, setPatente] = useState<PatenteInfo | null>(null)
  const [echeances, setEcheances] = useState<EcheanceData[]>([])
  const [loading, setLoading] = useState(true)

  const paysConfig = PAYS_LIST.find(p => p.code === pays)
  const devise     = paysConfig?.devise ?? 'FCFA'
  const ANNEE      = annee

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [tvaRes, cnssRes, patRes] = await Promise.all([
        fetch(`/api/fiscalite/tva?annee=${annee}&pays=${pays}`),
        fetch(`/api/fiscalite/cnss?annee=${annee}&pays=${pays}`),
        fetch(`/api/declarations/patente?annee=${annee}`),
      ])
      const [tvaData, cnssData, patData] = await Promise.all([
        tvaRes.json(), cnssRes.json(), patRes.json(),
      ])

      setKpis({
        tva_collectee:  tvaData.totaux?.tva_collectee  ?? 0,
        tva_deductible: tvaData.totaux?.tva_deductible ?? 0,
        tva_a_payer:    tvaData.totaux?.total_a_payer  ?? 0,
        cnss_salarie:   cnssData.totaux?.cnss_salarie  ?? 0,
        cnss_patronal:  cnssData.totaux?.cnss_patronal ?? 0,
        irpp_total:     cnssData.totaux?.irpp_total    ?? 0,
        nb_employes:    cnssData.declarations?.find((d: { mois: number }) => d.mois === new Date().getMonth() + 1)?.nb_employes ?? 0,
        ca_ht:          tvaData.totaux?.ca_ht          ?? 0,
      })

      setPatente(patData.declaration ?? null)

      // Upcoming deadlines
      const now = new Date()
      const currentMois = now.getMonth() + 1
      const upcoming: EcheanceData[] = []
      const allMonths = tvaData.declarations ?? []

      for (let m = currentMois; m <= Math.min(currentMois + 2, 12); m++) {
        const tvaDecl = allMonths.find((d: { mois: number }) => d.mois === m)
        if (tvaDecl) {
          const echeanceDate = new Date(annee, m, 20)
          const jr = Math.ceil((echeanceDate.getTime() - now.getTime()) / 86400_000)
          upcoming.push({
            type: 'tva', href: '/dashboard/fiscalite/tva',
            label: `TVA ${new Date(annee, m - 1).toLocaleDateString('fr-FR', { month: 'long' })} ${annee}`,
            date_echeance: echeanceDate.toISOString().split('T')[0],
            jours_restants: jr,
            statut: echeanceDate < now ? 'retard' : jr <= 7 ? 'urgent' : 'ok',
            montant_estime: tvaDecl.total_a_payer,
          })
        }
        const cnssDecl = cnssData.declarations?.find((d: { mois: number }) => d.mois === m)
        if (cnssDecl) {
          const echeanceDate = new Date(annee, m, 15)
          const jr = Math.ceil((echeanceDate.getTime() - now.getTime()) / 86400_000)
          upcoming.push({
            type: 'cnss', href: '/dashboard/fiscalite/cnss',
            label: `${cnssData.config?.acronyme ?? 'CNSS'} ${new Date(annee, m - 1).toLocaleDateString('fr-FR', { month: 'long' })} ${annee}`,
            date_echeance: echeanceDate.toISOString().split('T')[0],
            jours_restants: jr,
            statut: echeanceDate < now ? 'retard' : jr <= 7 ? 'urgent' : 'ok',
            montant_estime: cnssDecl.total_cnss,
          })
        }
      }
      setEcheances(upcoming.sort((a, b) => a.date_echeance.localeCompare(b.date_echeance)))
    } finally {
      setLoading(false)
    }
  }, [pays, annee])

  useEffect(() => { void load() }, [load])

  // Patente deadline
  const echeancePatente  = new Date(ANNEE, 0, 31)
  const joursPatente     = Math.ceil((echeancePatente.getTime() - Date.now()) / 86400_000)
  const patenteStatut    = patente?.statut as string ?? (joursPatente < 0 ? 'en_retard' : 'a_faire')

  type StatutKey = 'soumise' | 'complete' | 'brouillon' | 'a_faire' | 'en_retard'
  const STATUT: Record<StatutKey, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
    soumise:   { label: 'Soumise',    color: GREEN, bg: '#F0FDF4', icon: <CheckCircle size={12} /> },
    complete:  { label: 'Complète',   color: BLUE,  bg: '#EFF6FF', icon: <CheckCircle size={12} /> },
    brouillon: { label: 'Brouillon',  color: AMBER, bg: '#FFFBEB', icon: <Clock size={12} /> },
    a_faire:   { label: 'À déclarer', color: AMBER, bg: '#FFFBEB', icon: <Clock size={12} /> },
    en_retard: { label: 'En retard',  color: RED,   bg: '#FEF2F2', icon: <AlertTriangle size={12} /> },
  }
  const ps = STATUT[(patenteStatut as StatutKey)] ?? STATUT.a_faire

  const MODULES = [
    {
      id: 'patente', titre: 'Contribution de la Patente', ref: 'Formulaire 721M',
      periode: `Annuelle · Échéance 31 jan. ${ANNEE}`,
      icon: <Building2 size={18} color={GREEN} />, iconBg: '#F0FDF4',
      href: '/dashboard/declarations/patente', hrefLabel: 'Déclarer →',
      stat: patente ? fmtN(patente.patente_nette, devise) : (joursPatente < 0 ? 'En retard' : 'À compléter'),
      statColor: ps.color, statut: patenteStatut as StatutKey, borderColor: ps.color,
    },
    {
      id: 'tva', titre: 'TVA & Centime additionnel', ref: 'TVA 18% + CA 5%',
      periode: `Mensuelle · Dépôt avant le 20`,
      icon: <Receipt size={18} color={BLUE} />, iconBg: '#EFF6FF',
      href: '/dashboard/fiscalite/tva', hrefLabel: 'Gérer →',
      stat: kpis ? fmtN(kpis.tva_a_payer, devise) : '—',
      statColor: BLUE, statut: null, borderColor: BLUE,
    },
    {
      id: 'irpp', titre: 'IRPP & Charges salariales', ref: 'Impôt sur le revenu',
      periode: `Mensuelle · Retenue à la source`,
      icon: <TrendingUp size={18} color={PURPLE} />, iconBg: '#F5F3FF',
      href: '/dashboard/fiscalite/irpp', hrefLabel: 'Gérer →',
      stat: kpis ? fmtN(kpis.irpp_total, devise) : '—',
      statColor: PURPLE, statut: null, borderColor: PURPLE,
    },
    {
      id: 'cnss', titre: 'Cotisations sociales CNSS', ref: 'Salarié 5.04% · Patronal 14.16%',
      periode: `Mensuelle · Dépôt avant le 15`,
      icon: <Users size={18} color={AMBER} />, iconBg: '#FFFBEB',
      href: '/dashboard/fiscalite/cnss', hrefLabel: 'Gérer →',
      stat: kpis ? fmtN((kpis.cnss_salarie + kpis.cnss_patronal), devise) : '—',
      statColor: AMBER, statut: null, borderColor: AMBER,
    },
    {
      id: 'is', titre: 'Impôt sur les Sociétés (IS)', ref: 'Taux 30% · Minimum 1% CA HT',
      periode: `Annuel · Acomptes avr/jul/oct · Solde 30 avr.`,
      icon: <Landmark size={18} color={PURPLE} />, iconBg: '#F5F3FF',
      href: '/dashboard/fiscalite/is', hrefLabel: 'Calculer →',
      stat: 'Voir détail →',
      statColor: PURPLE, statut: null, borderColor: PURPLE,
    },
    {
      id: 'das', titre: 'Déclaration Sommes Tiers (DAS)', ref: 'Honoraires · Commissions · Loyers',
      periode: `Annuelle · Dépôt avant le 31 mars N+1`,
      icon: <FileText size={18} color={RED} />, iconBg: '#FEF2F2',
      href: '/dashboard/fiscalite/das', hrefLabel: 'Gérer →',
      stat: '—', statColor: RED, statut: null, borderColor: RED,
    },
    {
      id: 'taxe-apprentissage', titre: 'Taxe d\'Apprentissage & FPC', ref: 'TA 1.2% + FPC 1.2% masse salariale',
      periode: `Annuelle · Versement avant le 30 avril N+1`,
      icon: <GraduationCap size={18} color={'#0891B2'} />, iconBg: '#ECFEFF',
      href: '/dashboard/fiscalite/taxe-apprentissage', hrefLabel: 'Calculer →',
      stat: '—', statColor: '#0891B2', statut: null, borderColor: '#0891B2',
    },
    {
      id: 'liasse-fiscale', titre: 'Liasse Fiscale DGI', ref: 'Bilan · Compte de résultat · État fiscal',
      periode: `Annuelle · Exercice ${ANNEE}`,
      icon: <FileText size={18} color={'#2563EB'} />, iconBg: '#EFF6FF',
      href: '/dashboard/fiscalite/liasse-fiscale', hrefLabel: 'Voir →',
      stat: 'Déclarations consolidées', statColor: BLUE, statut: null, borderColor: BLUE,
    },
  ]

  return (
    <div className="max-w-4xl mx-auto space-y-6">

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-[22px] font-extrabold text-[#0F172A] flex items-center gap-2">
            Fiscalité & Déclarations
          </h1>
          <p className="text-[13px] mt-1" style={{ color: MUTED }}>
            {paysConfig?.nom ?? 'Congo-Brazzaville'} · DGI · Exercice {ANNEE}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={pays}
            onChange={e => setPays(e.target.value as PaysFiscal)}
            className="border border-[#E2E8F0] rounded-lg px-3 py-2 text-[13px] bg-white text-[#0F172A] cursor-pointer"
          >
            {PAYS_LIST.map(p => (
              <option key={p.code} value={p.code}>{p.drapeau} {p.nom}</option>
            ))}
          </select>
          <select
            value={annee}
            onChange={e => setAnnee(Number(e.target.value))}
            className="border border-[#E2E8F0] rounded-lg px-3 py-2 text-[13px] bg-white text-[#0F172A] cursor-pointer"
          >
            {[2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <button
            onClick={() => void load()}
            className="p-2 border border-[#E2E8F0] rounded-lg bg-white hover:bg-[#F8FAFC] transition-colors"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin text-[#94A3B8]' : 'text-[#64748B]'} />
          </button>
        </div>
      </div>

      {/* ── Alerte patente ───────────────────────────────────────────────── */}
      {!loading && patenteStatut !== 'soumise' && patenteStatut !== 'complete' && (
        <div className={`rounded-xl px-4 py-3 flex items-center gap-3 border ${
          joursPatente < 0 ? 'bg-[#FEF2F2] border-[#FECACA]' : 'bg-[#FFFBEB] border-[#FDE68A]'
        }`}>
          <AlertTriangle size={15} color={joursPatente < 0 ? RED : AMBER} className="shrink-0" />
          <span className="text-[13px] font-medium flex-1" style={{ color: joursPatente < 0 ? RED : '#92400E' }}>
            {joursPatente < 0
              ? `Patente en retard de ${Math.abs(joursPatente)} jours — pénalités de retard applicables (CGI art. 721M)`
              : `Déclaration de patente à soumettre avant le 31 janvier ${ANNEE} · J-${joursPatente}`}
          </span>
          <Link href="/dashboard/declarations/patente" className="text-[12px] font-bold shrink-0" style={{ color: BLUE }}>
            Déclarer →
          </Link>
        </div>
      )}

      {/* ── KPIs synthèse ───────────────────────────────────────────────── */}
      {loading ? (
        <div className="flex justify-center py-12"><Loader2 size={24} className="animate-spin text-[#F59E0B]" /></div>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'TVA à payer',        value: fmtN(kpis?.tva_a_payer ?? 0, devise),    color: BLUE   },
              { label: 'IRPP total',          value: fmtN(kpis?.irpp_total ?? 0, devise),     color: PURPLE },
              { label: 'CNSS total',          value: fmtN((kpis?.cnss_salarie ?? 0) + (kpis?.cnss_patronal ?? 0), devise), color: AMBER },
              { label: 'CA HT déclaré',       value: fmtN(kpis?.ca_ht ?? 0, devise),          color: GREEN  },
            ].map(({ label, value, color }) => (
              <div key={label} className="bg-white rounded-xl border border-[#E2E8F0] p-4 shadow-sm">
                <p className="text-[11px] font-semibold mb-1" style={{ color: MUTED }}>{label}</p>
                <p className="text-[15px] font-extrabold leading-tight" style={{ color }}>{value}</p>
              </div>
            ))}
          </div>

          {/* ── Déclarations (cartes) ─────────────────────────────────────── */}
          <div>
            <h2 className="text-[13px] font-bold text-[#0F172A] mb-3">Déclarations fiscales</h2>
            <div className="space-y-3">
              {MODULES.map(m => (
                <div key={m.id} className="bg-white rounded-xl border border-[#E2E8F0] shadow-sm overflow-hidden"
                  style={{ borderLeft: `3px solid ${m.borderColor}` }}>
                  <div className="flex items-center gap-4 px-5 py-4">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: m.iconBg }}>
                      {m.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[14px] font-bold text-[#0F172A]">{m.titre}</p>
                      <p className="text-[11px] mt-0.5" style={{ color: MUTED }}>
                        {m.ref} · {m.periode}
                      </p>
                    </div>
                    {/* Montant / Statut */}
                    <div className="text-right shrink-0 hidden sm:block">
                      <p className="text-[14px] font-extrabold" style={{ color: m.statColor }}>{m.stat}</p>
                      {m.statut && (
                        <div className="flex items-center gap-1 justify-end mt-0.5">
                          {STATUT[m.statut]?.icon}
                          <span className="text-[10px] font-semibold" style={{ color: STATUT[m.statut]?.color }}>
                            {STATUT[m.statut]?.label}
                          </span>
                        </div>
                      )}
                    </div>
                    <Link href={m.href}
                      className="flex items-center gap-1 text-[12px] font-bold shrink-0 px-3 py-1.5 rounded-lg transition-colors hover:bg-[#F8FAFC]"
                      style={{ color: m.borderColor }}>
                      {m.hrefLabel} <ChevronRight size={13} />
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ── Échéances à venir ─────────────────────────────────────────── */}
          {echeances.length > 0 && (
            <div>
              <h2 className="text-[13px] font-bold text-[#0F172A] mb-3 flex items-center gap-2">
                <CalendarDays size={14} color={MUTED} />
                Prochaines échéances
              </h2>
              <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-sm divide-y divide-[#F1F5F9]">
                {echeances.map((e, i) => {
                  const col = e.statut === 'retard' ? RED : e.statut === 'urgent' ? AMBER : GREEN
                  return (
                    <div key={i} className="flex items-center gap-4 px-5 py-3.5">
                      <div className="w-2 h-2 rounded-full shrink-0" style={{ background: col }} />
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-semibold text-[#0F172A] truncate">{e.label}</p>
                        <p className="text-[11px]" style={{ color: MUTED }}>
                          Échéance : <strong>{new Date(e.date_echeance).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}</strong>
                          {e.statut === 'retard' ? ` · En retard de ${Math.abs(e.jours_restants)} j` : ` · J-${e.jours_restants}`}
                        </p>
                      </div>
                      {e.montant_estime !== undefined && e.montant_estime > 0 && (
                        <p className="text-[13px] font-bold shrink-0" style={{ color: col }}>
                          {fmtN(e.montant_estime, devise)}
                        </p>
                      )}
                      <Link href={e.href} className="text-[11px] font-bold shrink-0" style={{ color: BLUE }}>
                        <ArrowRight size={14} />
                      </Link>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* ── Info légale ───────────────────────────────────────────────── */}
          <div className="rounded-xl border border-[#E2E8F0] p-4" style={{ background: BG }}>
            <p className="text-[11px] font-semibold text-[#0F172A] mb-2">Obligations fiscales — {paysConfig?.nom ?? 'Congo-Brazzaville'} (DGI)</p>
            <div className="text-[11px] space-y-1" style={{ color: MUTED, lineHeight: 1.7 }}>
              <p>• <strong>Patente 721M</strong> : déclaration annuelle avant le 31 janvier, base = CA HT exercice précédent</p>
              <p>• <strong>TVA 18%</strong> + Centime Additionnel 5% : déclaration mensuelle avant le 20 du mois suivant</p>
              <p>• <strong>IRPP</strong> : retenue à la source sur salaires, reversement avant le 20 du mois suivant</p>
              <p>• <strong>CNSS</strong> : déclaration mensuelle avant le 15, taux salarié 5,04 % + patronal 14,16 %</p>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

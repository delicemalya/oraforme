'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import {
  Receipt, Users, FileText, Building2, Landmark, TrendingUp,
  GraduationCap, ClipboardList, History, AlertTriangle,
  CalendarDays, RefreshCw, Loader2, CheckCircle, Clock,
  ChevronRight,
} from 'lucide-react'
import { PAYS_LIST } from '@/lib/fiscalite/pays'
import type { PaysFiscal } from '@/lib/fiscalite/types'

// ── Design tokens ──────────────────────────────────────────────────────────────
const TEXT   = '#0F172A'
const MUTED  = '#64748B'
const BORDER = '#E2E8F0'
const BLUE   = '#2563EB'
const GREEN  = '#16A34A'
const AMBER  = '#F59E0B'
const RED    = '#DC2626'
const PURPLE = '#7C3AED'
const TEAL   = '#0891B2'
const ORANGE = '#D97706'

function fmtN(n: number, devise = 'FCFA') {
  if (devise === 'EUR') return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(n)
  return new Intl.NumberFormat('fr-FR').format(Math.round(n)) + ' ' + devise
}

interface KpiData {
  tva_a_payer: number
  cnss_total: number
  irpp_total: number
  ca_ht: number
}

interface EcheanceData {
  label: string
  date_echeance: string
  jours_restants: number
  statut: 'retard' | 'urgent' | 'ok'
  montant_estime?: number
  href: string
}

const MODULES = [
  {
    id: 'tva',
    titre: 'TVA',
    desc: 'TVA 18% + Centime Additionnel 5%',
    detail: 'Déclaration mensuelle · Dépôt avant le 20',
    icon: Receipt,
    color: BLUE,
    iconBg: '#EFF6FF',
    href: '/dashboard/fiscalite/tva',
  },
  {
    id: 'cnss',
    titre: 'CNSS',
    desc: 'Cotisations sociales · Salarié 5,04% · Patronal 14,16%',
    detail: 'Déclaration mensuelle · Dépôt avant le 15',
    icon: Users,
    color: AMBER,
    iconBg: '#FFFBEB',
    href: '/dashboard/fiscalite/cnss',
  },
  {
    id: 'das',
    titre: 'DAS',
    desc: 'Déclaration des Sommes Versées à des Tiers',
    detail: 'Annuelle · Seuil 100 000 FCFA · Avant le 31 mars N+1',
    icon: FileText,
    color: RED,
    iconBg: '#FEF2F2',
    href: '/dashboard/fiscalite/das',
  },
  {
    id: 'patente',
    titre: 'Patente',
    desc: 'Contribution de la Patente · Formulaire 721M',
    detail: 'Annuelle · Base CA HT N-1 · Avant le 31 janvier',
    icon: Building2,
    color: GREEN,
    iconBg: '#F0FDF4',
    href: '/dashboard/fiscalite/patente',
  },
  {
    id: 'is',
    titre: 'Impôt Société',
    desc: 'IS Congo · Taux 30% · Minimum 1% CA HT',
    detail: 'Acomptes avr / juil / oct · Solde 30 avril N+1',
    icon: Landmark,
    color: PURPLE,
    iconBg: '#F5F3FF',
    href: '/dashboard/fiscalite/is',
  },
  {
    id: 'irpp',
    titre: 'IRPP',
    desc: 'Impôt sur le Revenu des Personnes Physiques',
    detail: 'Retenue à la source · Reversement avant le 20',
    icon: TrendingUp,
    color: '#8B5CF6',
    iconBg: '#F5F3FF',
    href: '/dashboard/fiscalite/irpp',
  },
  {
    id: 'taxe-apprentissage',
    titre: 'Taxe Apprentissage',
    desc: 'TA 1,2% + FPC 1,2% sur masse salariale',
    detail: 'Annuelle · Art. 186 CGI Congo · Avant 30 avril N+1',
    icon: GraduationCap,
    color: TEAL,
    iconBg: '#ECFEFF',
    href: '/dashboard/fiscalite/taxe-apprentissage',
  },
  {
    id: 'liasse-fiscale',
    titre: 'Déclarations Annuelles',
    desc: 'Liasse fiscale DGI · Bilan · Compte de résultat',
    detail: 'État fiscal IS · Consolidé exercice complet',
    icon: ClipboardList,
    color: ORANGE,
    iconBg: '#FFFBEB',
    href: '/dashboard/fiscalite/liasse-fiscale',
  },
  {
    id: 'historique',
    titre: 'Historique',
    desc: 'Toutes les déclarations archivées',
    detail: 'Consultation · Téléchargement · Audit trail',
    icon: History,
    color: MUTED,
    iconBg: '#F8FAFC',
    href: '/dashboard/fiscalite/historique',
  },
]

export default function FiscalitePage() {
  const [pays, setPays] = useState<PaysFiscal>('CG')
  const [annee, setAnnee] = useState(new Date().getFullYear())
  const [kpis, setKpis] = useState<KpiData | null>(null)
  const [echeances, setEcheances] = useState<EcheanceData[]>([])
  const [patenteRetard, setPatenteRetard] = useState(false)
  const [joursPatente, setJoursPatente] = useState(0)
  const [loading, setLoading] = useState(true)

  const paysConfig = PAYS_LIST.find(p => p.code === pays)
  const devise = paysConfig?.devise ?? 'FCFA'

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
        tva_a_payer: tvaData.totaux?.total_a_payer ?? 0,
        cnss_total: (cnssData.totaux?.cnss_salarie ?? 0) + (cnssData.totaux?.cnss_patronal ?? 0),
        irpp_total: cnssData.totaux?.irpp_total ?? 0,
        ca_ht: tvaData.totaux?.ca_ht ?? 0,
      })

      // Patente status
      const echeanceP = new Date(annee, 0, 31)
      const jr = Math.ceil((echeanceP.getTime() - Date.now()) / 86400_000)
      setJoursPatente(jr)
      const ps = patData.declaration?.statut
      setPatenteRetard(!ps || (ps !== 'soumise' && ps !== 'complete'))

      // Upcoming deadlines
      const now = new Date()
      const currentMois = now.getMonth() + 1
      const upcoming: EcheanceData[] = []
      const allMonths = tvaData.declarations ?? []

      for (let m = currentMois; m <= Math.min(currentMois + 2, 12); m++) {
        const tvaDecl = allMonths.find((d: { mois: number }) => d.mois === m)
        if (tvaDecl) {
          const echeanceDate = new Date(annee, m, 20)
          const jrLeft = Math.ceil((echeanceDate.getTime() - now.getTime()) / 86400_000)
          upcoming.push({
            label: `TVA ${new Date(annee, m - 1).toLocaleDateString('fr-FR', { month: 'long' })} ${annee}`,
            date_echeance: echeanceDate.toISOString().split('T')[0],
            jours_restants: jrLeft,
            statut: echeanceDate < now ? 'retard' : jrLeft <= 7 ? 'urgent' : 'ok',
            montant_estime: tvaDecl.total_a_payer,
            href: '/dashboard/fiscalite/tva',
          })
        }
        const cnssDecl = cnssData.declarations?.find((d: { mois: number }) => d.mois === m)
        if (cnssDecl) {
          const echeanceDate = new Date(annee, m, 15)
          const jrLeft = Math.ceil((echeanceDate.getTime() - now.getTime()) / 86400_000)
          upcoming.push({
            label: `CNSS ${new Date(annee, m - 1).toLocaleDateString('fr-FR', { month: 'long' })} ${annee}`,
            date_echeance: echeanceDate.toISOString().split('T')[0],
            jours_restants: jrLeft,
            statut: echeanceDate < now ? 'retard' : jrLeft <= 7 ? 'urgent' : 'ok',
            montant_estime: cnssDecl.total_cnss,
            href: '/dashboard/fiscalite/cnss',
          })
        }
      }
      setEcheances(upcoming.sort((a, b) => a.date_echeance.localeCompare(b.date_echeance)))
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }, [pays, annee])

  useEffect(() => { void load() }, [load])

  const KPI_CARDS = [
    { label: 'TVA à payer',  value: kpis ? fmtN(kpis.tva_a_payer, devise)  : '—', color: BLUE   },
    { label: 'CNSS total',   value: kpis ? fmtN(kpis.cnss_total, devise)   : '—', color: AMBER  },
    { label: 'IRPP total',   value: kpis ? fmtN(kpis.irpp_total, devise)   : '—', color: PURPLE },
    { label: 'CA HT déclaré',value: kpis ? fmtN(kpis.ca_ht, devise)        : '—', color: GREEN  },
  ]

  return (
    <div className="space-y-6 max-w-5xl mx-auto">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-[22px] font-extrabold text-[#0F172A]">
            Fiscalité &amp; Déclarations
          </h1>
          <p className="text-[13px] mt-1" style={{ color: MUTED }}>
            {paysConfig?.nom ?? 'Congo-Brazzaville'} · DGI · Exercice {annee}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select value={pays} onChange={e => setPays(e.target.value as PaysFiscal)}
            className="border border-[#E2E8F0] rounded-lg px-3 py-2 text-[13px] bg-white text-[#0F172A] cursor-pointer focus:outline-none">
            {PAYS_LIST.map(p => (
              <option key={p.code} value={p.code}>{p.drapeau} {p.nom}</option>
            ))}
          </select>
          <select value={annee} onChange={e => setAnnee(Number(e.target.value))}
            className="border border-[#E2E8F0] rounded-lg px-3 py-2 text-[13px] bg-white text-[#0F172A] cursor-pointer focus:outline-none">
            {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <button onClick={() => void load()}
            className="p-2 border border-[#E2E8F0] rounded-lg bg-white hover:bg-[#F8FAFC] transition-colors">
            <RefreshCw size={14} className={loading ? 'animate-spin text-[#94A3B8]' : 'text-[#64748B]'} />
          </button>
        </div>
      </div>

      {/* ── Alerte patente ──────────────────────────────────────────────────── */}
      {!loading && patenteRetard && (
        <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border ${
          joursPatente < 0
            ? 'bg-[#FEF2F2] border-[#FECACA]'
            : 'bg-[#FFFBEB] border-[#FDE68A]'
        }`}>
          <AlertTriangle size={15} style={{ color: joursPatente < 0 ? RED : AMBER, flexShrink: 0 }} />
          <span className="text-[13px] font-medium flex-1" style={{ color: joursPatente < 0 ? RED : '#92400E' }}>
            {joursPatente < 0
              ? `Patente en retard de ${Math.abs(joursPatente)} jours — pénalités de retard (CGI art. 721M)`
              : `Déclaration de patente à soumettre avant le 31 janvier ${annee} · J-${joursPatente}`}
          </span>
          <Link href="/dashboard/fiscalite/patente"
            className="text-[12px] font-bold shrink-0" style={{ color: BLUE }}>
            Déclarer →
          </Link>
        </div>
      )}

      {/* ── KPIs ───────────────────────────────────────────────────────────── */}
      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 size={22} className="animate-spin" style={{ color: AMBER }} />
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {KPI_CARDS.map(k => (
            <div key={k.label} className="bg-white rounded-xl border border-[#E2E8F0] p-4 shadow-sm">
              <p className="text-[11px] font-semibold mb-1" style={{ color: MUTED }}>{k.label}</p>
              <p className="text-[15px] font-extrabold leading-tight" style={{ color: k.color }}>{k.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* ── Modules grid ───────────────────────────────────────────────────── */}
      <div>
        <h2 className="text-[13px] font-bold text-[#0F172A] mb-3">Déclarations & Modules fiscaux</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {MODULES.map(mod => {
            const Icon = mod.icon
            return (
              <Link key={mod.id} href={mod.href}
                className="group bg-white rounded-xl border border-[#E2E8F0] p-5 hover:shadow-md hover:-translate-y-0.5 transition-all"
                style={{ borderLeft: `3px solid ${mod.color}` }}>
                <div className="flex items-start gap-3 mb-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                    style={{ background: mod.iconBg }}>
                    <Icon size={18} style={{ color: mod.color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[14px] font-bold text-[#0F172A]">{mod.titre}</p>
                    <p className="text-[11px] mt-0.5 leading-snug" style={{ color: MUTED }}>{mod.desc}</p>
                  </div>
                  <ChevronRight size={14} className="text-[#CBD5E1] group-hover:text-[#94A3B8] shrink-0 mt-0.5 transition-colors" />
                </div>
                <p className="text-[10px] font-semibold uppercase tracking-wide"
                  style={{ color: mod.color }}>
                  {mod.detail}
                </p>
              </Link>
            )
          })}
        </div>
      </div>

      {/* ── Prochaines échéances ────────────────────────────────────────────── */}
      {echeances.length > 0 && (
        <div>
          <h2 className="text-[13px] font-bold text-[#0F172A] mb-3 flex items-center gap-2">
            <CalendarDays size={14} style={{ color: MUTED }} />
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
                      Échéance : <strong>
                        {new Date(e.date_echeance).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
                      </strong>
                      {e.statut === 'retard'
                        ? ` · En retard de ${Math.abs(e.jours_restants)} j`
                        : ` · J-${e.jours_restants}`}
                    </p>
                  </div>
                  {e.montant_estime !== undefined && e.montant_estime > 0 && (
                    <p className="text-[13px] font-bold shrink-0" style={{ color: col }}>
                      {fmtN(e.montant_estime, devise)}
                    </p>
                  )}
                  <Link href={e.href} className="shrink-0" style={{ color: BLUE }}>
                    <ChevronRight size={14} />
                  </Link>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Rappels légaux Congo ─────────────────────────────────────────────── */}
      <div className="rounded-xl border border-[#E2E8F0] p-4 bg-[#F8FAFC]">
        <p className="text-[12px] font-bold text-[#0F172A] mb-2 flex items-center gap-2">
          <CheckCircle size={13} style={{ color: GREEN }} />
          Obligations fiscales — Congo-Brazzaville (DGI / CNSS)
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 text-[11px]" style={{ color: MUTED, lineHeight: 1.7 }}>
          <p>• <strong>Patente 721M</strong> : avant le 31 janvier, base CA HT N-1, min 50 000 FCFA</p>
          <p>• <strong>TVA 18%</strong> + CA 5% : avant le 20 du mois suivant</p>
          <p>• <strong>CNSS</strong> : salarié 5,04% + patronal 14,16%, avant le 15</p>
          <p>• <strong>IRPP</strong> : retenue à la source, reversement avant le 20</p>
          <p>• <strong>IS</strong> : 30% résultat fiscal, minimum 1% CA HT (plancher 500 000 F)</p>
          <p>• <strong>DAS</strong> : sommes versées à tiers &gt; 100 000 FCFA, avant le 31 mars N+1</p>
          <p>• <strong>TA/FPC</strong> : 1,2% + 1,2% masse salariale, avant le 30 avril N+1</p>
          <p>• <strong>SMIG</strong> : 90 000 FCFA/mois · Plafond CNSS : 3 375 000 FCFA/mois</p>
        </div>
      </div>
    </div>
  )
}

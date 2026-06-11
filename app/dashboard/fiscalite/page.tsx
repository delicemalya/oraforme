'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import {
  Receipt, Users, FileText, Building2, Landmark, TrendingUp,
  GraduationCap, ClipboardList, History, AlertTriangle,
  RefreshCw, Loader2, CheckCircle, ChevronRight, ArrowUpRight,
  CalendarDays, Clock, Wallet,
} from 'lucide-react'
import { PAYS_LIST } from '@/lib/fiscalite/pays'
import type { PaysFiscal } from '@/lib/fiscalite/types'
import MIAAContextButton from '@/components/miaa/MIAAContextButton'

function fmtN(n: number, devise = 'FCFA') {
  if (n === 0) return `0 ${devise}`
  if (devise === 'EUR') return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(n)
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace('.0', '') + 'M ' + devise
  if (n >= 1_000)     return (n / 1_000).toFixed(0) + 'K ' + devise
  return new Intl.NumberFormat('fr-FR').format(Math.round(n)) + ' ' + devise
}

interface KpiData { tva_a_payer: number; cnss_total: number; irpp_total: number; ca_ht: number }
interface EcheanceData {
  label: string; date_echeance: string; jours_restants: number
  statut: 'retard' | 'urgent' | 'ok'; montant_estime?: number; href: string
}

const MODULES = [
  { id: 'tva',              titre: 'TVA',                  desc: 'TVA 18% + CA 5%',             periode: 'Avant le 20',           icon: Receipt,       gradient: 'from-blue-500 to-blue-600',   ring: '#3B82F6', href: '/dashboard/fiscalite/tva'              },
  { id: 'cnss',             titre: 'CNSS',                 desc: 'Salarié 4% VID · Patronal 23,28%', periode: 'Avant le 15',       icon: Users,         gradient: 'from-amber-500 to-orange-500', ring: '#F59E0B', href: '/dashboard/fiscalite/cnss'             },
  { id: 'das',              titre: 'DAS',                  desc: 'Sommes versées à des tiers',   periode: 'Avant 31 mars N+1',     icon: FileText,      gradient: 'from-red-500 to-rose-600',     ring: '#EF4444', href: '/dashboard/fiscalite/das'              },
  { id: 'patente',          titre: 'Patente 721M',         desc: 'Contribution de la Patente',   periode: 'Avant 31 janvier',      icon: Building2,     gradient: 'from-green-500 to-emerald-600',ring: '#10B981', href: '/dashboard/fiscalite/patente'          },
  { id: 'is',               titre: 'Impôt Société',        desc: 'IS 30% · Minimum 1% CA HT',   periode: 'Solde 30 avril N+1',    icon: Landmark,      gradient: 'from-violet-500 to-purple-600',ring: '#7C3AED', href: '/dashboard/fiscalite/is'               },
  { id: 'irpp',             titre: 'IRPP',                 desc: 'Retenue à la source',          periode: 'Reversement avant le 20',icon: TrendingUp,   gradient: 'from-indigo-500 to-blue-600',  ring: '#6366F1', href: '/dashboard/fiscalite/irpp'             },
  { id: 'taxe-apprentissage', titre: 'Taxe Apprentissage', desc: 'TA 1,2% + FPC 1,2% masse sal.',periode: 'Avant 30 avril N+1',   icon: GraduationCap, gradient: 'from-teal-500 to-cyan-600',    ring: '#14B8A6', href: '/dashboard/fiscalite/taxe-apprentissage'},
  { id: 'liasse-fiscale',   titre: 'Déclarations DGI',     desc: 'Liasse fiscale · Bilan · CR', periode: 'Exercice complet',       icon: ClipboardList, gradient: 'from-orange-400 to-amber-600', ring: '#F97316', href: '/dashboard/fiscalite/liasse-fiscale'   },
  { id: 'historique',       titre: 'Historique',           desc: 'Archives & Audit trail',       periode: 'Toutes déclarations',   icon: History,       gradient: 'from-slate-400 to-slate-500',  ring: '#64748B', href: '/dashboard/fiscalite/historique'       },
]

const LEGAL_ITEMS = [
  { label: 'Patente 721M', detail: 'avant 31 jan · base CA HT N-1 · min 50 000 FCFA', color: '#10B981' },
  { label: 'TVA 18% + CA 5%', detail: 'avant le 20 du mois suivant',              color: '#3B82F6' },
  { label: 'CNSS', detail: 'salarié 4% VID + patronal 23,28% · avant le 15',       color: '#F59E0B' },
  { label: 'IRPP', detail: 'retenue source · reversement avant le 20',             color: '#6366F1' },
  { label: 'IS 30%', detail: 'min 1% CA HT (plancher 500 000 F) · 30 avril N+1',  color: '#7C3AED' },
  { label: 'DAS', detail: '>100 000 FCFA versés à tiers · avant 31 mars N+1',      color: '#EF4444' },
  { label: 'TA/FPC', detail: '1,2% + 1,2% masse salariale · avant 30 avril N+1', color: '#14B8A6' },
  { label: 'SMIG 90 000 FCFA/mois', detail: 'Plafond CNSS : 1 200 000 FCFA/mois (VID)', color: '#64748B' },
]

export default function FiscalitePage() {
  const [pays, setPays]             = useState<PaysFiscal>('CG')
  const [annee, setAnnee]           = useState(new Date().getFullYear())
  const [kpis, setKpis]             = useState<KpiData | null>(null)
  const [echeances, setEcheances]   = useState<EcheanceData[]>([])
  const [patenteRetard, setPatenteRetard] = useState(false)
  const [joursPatente, setJoursPatente]   = useState(0)
  const [loading, setLoading]       = useState(true)

  const paysConfig = PAYS_LIST.find(p => p.code === pays)
  const devise     = paysConfig?.devise ?? 'FCFA'

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
        cnss_total:  (cnssData.totaux?.cnss_salarie ?? 0) + (cnssData.totaux?.cnss_patronal ?? 0),
        irpp_total:  cnssData.totaux?.irpp_total ?? 0,
        ca_ht:       tvaData.totaux?.ca_ht ?? 0,
      })
      const echeanceP = new Date(annee, 0, 31)
      const jr = Math.ceil((echeanceP.getTime() - Date.now()) / 86400_000)
      setJoursPatente(jr)
      const ps = patData.declaration?.statut
      setPatenteRetard(!ps || (ps !== 'soumise' && ps !== 'complete'))

      const now = new Date()
      const currentMois = now.getMonth() + 1
      const upcoming: EcheanceData[] = []
      const allMonths = tvaData.declarations ?? []
      for (let m = currentMois; m <= Math.min(currentMois + 2, 12); m++) {
        const tvaDecl = allMonths.find((d: { mois: number }) => d.mois === m)
        if (tvaDecl) {
          const ed = new Date(annee, m, 20)
          const jl = Math.ceil((ed.getTime() - now.getTime()) / 86400_000)
          upcoming.push({ label: `TVA ${new Date(annee, m - 1).toLocaleDateString('fr-FR', { month: 'long' })} ${annee}`, date_echeance: ed.toISOString().split('T')[0], jours_restants: jl, statut: ed < now ? 'retard' : jl <= 7 ? 'urgent' : 'ok', montant_estime: tvaDecl.total_a_payer, href: '/dashboard/fiscalite/tva' })
        }
        const cnssDecl = cnssData.declarations?.find((d: { mois: number }) => d.mois === m)
        if (cnssDecl) {
          const ed = new Date(annee, m, 15)
          const jl = Math.ceil((ed.getTime() - now.getTime()) / 86400_000)
          upcoming.push({ label: `CNSS ${new Date(annee, m - 1).toLocaleDateString('fr-FR', { month: 'long' })} ${annee}`, date_echeance: ed.toISOString().split('T')[0], jours_restants: jl, statut: ed < now ? 'retard' : jl <= 7 ? 'urgent' : 'ok', montant_estime: cnssDecl.total_cnss, href: '/dashboard/fiscalite/cnss' })
        }
      }
      setEcheances(upcoming.sort((a, b) => a.date_echeance.localeCompare(b.date_echeance)))
    } catch { /* silent */ } finally { setLoading(false) }
  }, [pays, annee])

  useEffect(() => { void load() }, [load])

  const KPI_CARDS = [
    { label: 'TVA à payer',   value: kpis ? fmtN(kpis.tva_a_payer, devise) : '—', sub: 'Ce mois',        icon: Receipt,   gradient: 'from-blue-500 to-blue-700',    shadow: 'rgba(59,130,246,0.35)'  },
    { label: 'CNSS total',    value: kpis ? fmtN(kpis.cnss_total, devise)  : '—', sub: 'Salarié+Patronal',icon: Users,     gradient: 'from-amber-400 to-orange-500', shadow: 'rgba(245,158,11,0.35)'  },
    { label: 'IRPP total',    value: kpis ? fmtN(kpis.irpp_total, devise)  : '—', sub: 'Retenue source',   icon: TrendingUp,gradient: 'from-violet-500 to-purple-700',shadow: 'rgba(124,58,237,0.35)'  },
    { label: 'CA HT déclaré', value: kpis ? fmtN(kpis.ca_ht, devise)       : '—', sub: `Exercice ${annee}`,icon: Wallet,   gradient: 'from-emerald-500 to-green-700',shadow: 'rgba(16,185,129,0.35)'  },
  ]

  return (
    <div className="space-y-6 w-full max-w-6xl mx-auto">

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-[20px] sm:text-[24px] font-extrabold text-[#0F172A] leading-tight">
            Fiscalité &amp; Déclarations
          </h1>
          <p className="text-[12px] text-[#64748B] mt-0.5">
            {paysConfig?.nom ?? 'Congo-Brazzaville'} · DGI · Exercice {annee}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <select value={pays} onChange={e => setPays(e.target.value as PaysFiscal)}
            className="border border-[#E2E8F0] rounded-xl px-3 py-2 text-[13px] bg-white text-[#0F172A] cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#3B82F6]/30">
            {PAYS_LIST.map(p => <option key={p.code} value={p.code}>{p.drapeau} {p.nom}</option>)}
          </select>
          <select value={annee} onChange={e => setAnnee(Number(e.target.value))}
            className="border border-[#E2E8F0] rounded-xl px-3 py-2 text-[13px] bg-white text-[#0F172A] cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#3B82F6]/30">
            {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <button onClick={() => void load()}
            className="flex items-center gap-1.5 px-3 py-2 border border-[#E2E8F0] rounded-xl bg-white hover:bg-[#F8FAFC] text-[13px] text-[#64748B] transition-colors">
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            <span className="hidden sm:inline">Actualiser</span>
          </button>
          <MIAAContextButton module="fiscalite" />
        </div>
      </div>

      {/* ── Alerte patente ──────────────────────────────────────────────── */}
      {!loading && patenteRetard && (
        <div className={`flex items-center gap-3 px-4 py-3 rounded-2xl border ${
          joursPatente < 0 ? 'bg-[#FEF2F2] border-[#FECACA]' : 'bg-[#FFFBEB] border-[#FDE68A]'
        }`}>
          <AlertTriangle size={15} className="shrink-0" style={{ color: joursPatente < 0 ? '#DC2626' : '#D97706' }} />
          <span className="text-[13px] font-medium flex-1" style={{ color: joursPatente < 0 ? '#B91C1C' : '#92400E' }}>
            {joursPatente < 0
              ? `Patente en retard de ${Math.abs(joursPatente)} jours — pénalités (CGI art. 721M)`
              : `Déclaration patente à soumettre avant le 31 janvier ${annee} · J-${joursPatente}`}
          </span>
          <Link href="/dashboard/fiscalite/patente"
            className="text-[12px] font-bold shrink-0 flex items-center gap-1 hover:underline" style={{ color: '#2563EB' }}>
            Déclarer <ArrowUpRight size={12} />
          </Link>
        </div>
      )}

      {/* ── KPI Cards — style Eduka ─────────────────────────────────────── */}
      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 size={28} className="animate-spin text-[#F59E0B]" />
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {KPI_CARDS.map(k => {
            const Icon = k.icon
            return (
              <div key={k.label}
                className={`bg-gradient-to-br ${k.gradient} rounded-2xl p-4 sm:p-5 text-white relative overflow-hidden`}
                style={{ boxShadow: `0 8px 24px ${k.shadow}` }}>
                {/* Background decoration */}
                <div className="absolute top-0 right-0 w-20 h-20 rounded-full bg-white/10 -translate-y-6 translate-x-6" />
                <div className="absolute bottom-0 left-0 w-14 h-14 rounded-full bg-white/5 translate-y-5 -translate-x-5" />
                {/* Icon */}
                <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center mb-3">
                  <Icon size={18} className="text-white" />
                </div>
                {/* Value */}
                <p className="text-[20px] sm:text-[24px] font-extrabold leading-none">{k.value}</p>
                <p className="text-[11px] font-semibold opacity-80 mt-1">{k.label}</p>
                <p className="text-[10px] opacity-60 mt-0.5">{k.sub}</p>
              </div>
            )
          })}
        </div>
      )}

      {/* ── Modules + Échéances (two columns on large screens) ─────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">

        {/* Modules grid — 2/3 width on xl */}
        <div className="xl:col-span-2">
          <h2 className="text-[14px] font-bold text-[#0F172A] mb-3 flex items-center gap-2">
            <span className="w-1 h-4 rounded-full bg-[#3B82F6] inline-block" />
            Modules fiscaux
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {MODULES.map(mod => {
              const Icon = mod.icon
              return (
                <Link key={mod.id} href={mod.href}
                  className="group bg-white rounded-2xl border border-[#E2E8F0] overflow-hidden hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200">
                  {/* Coloured top strip */}
                  <div className={`h-1.5 w-full bg-gradient-to-r ${mod.gradient}`} />
                  <div className="p-4">
                    {/* Icon + title */}
                    <div className="flex items-start justify-between mb-3">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                        style={{ background: mod.ring + '18' }}>
                        <Icon size={18} style={{ color: mod.ring }} />
                      </div>
                      <ChevronRight size={14} className="text-[#CBD5E1] group-hover:text-[#94A3B8] mt-1 group-hover:translate-x-0.5 transition-all" />
                    </div>
                    <p className="text-[13px] font-bold text-[#0F172A] leading-tight">{mod.titre}</p>
                    <p className="text-[11px] text-[#64748B] mt-0.5 leading-snug">{mod.desc}</p>
                    {/* Deadline chip */}
                    <div className="mt-3 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold"
                      style={{ background: mod.ring + '15', color: mod.ring }}>
                      <Clock size={9} />
                      {mod.periode}
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        </div>

        {/* Right column: Échéances + Obligations */}
        <div className="flex flex-col gap-4">

          {/* Prochaines échéances */}
          <div className="bg-white rounded-2xl border border-[#E2E8F0] overflow-hidden">
            <div className="px-4 py-3 border-b border-[#F1F5F9] flex items-center justify-between">
              <h2 className="text-[13px] font-bold text-[#0F172A] flex items-center gap-2">
                <CalendarDays size={14} className="text-[#64748B]" />
                Prochaines échéances
              </h2>
              <span className="text-[11px] text-[#64748B] font-medium">{echeances.length} à venir</span>
            </div>
            <div className="divide-y divide-[#F8FAFC]">
              {echeances.length === 0 && !loading && (
                <div className="py-8 text-center">
                  <CheckCircle size={24} className="text-[#16A34A] mx-auto mb-2" />
                  <p className="text-[12px] text-[#64748B]">Aucune échéance proche</p>
                </div>
              )}
              {echeances.map((e, i) => {
                const isRetard = e.statut === 'retard'
                const isUrgent = e.statut === 'urgent'
                const col = isRetard ? '#DC2626' : isUrgent ? '#F59E0B' : '#16A34A'
                const bg  = isRetard ? '#FEF2F2' : isUrgent ? '#FFFBEB' : '#F0FDF4'
                return (
                  <Link key={i} href={e.href}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-[#F8FAFC] transition-colors group">
                    <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 text-[10px] font-black"
                      style={{ background: bg, color: col }}>
                      {isRetard ? '!' : `J-${Math.min(e.jours_restants, 99)}`}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] font-semibold text-[#0F172A] truncate">{e.label}</p>
                      <p className="text-[10px] text-[#94A3B8]">
                        {new Date(e.date_echeance).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                        {e.montant_estime ? ` · ${fmtN(e.montant_estime, devise)}` : ''}
                      </p>
                    </div>
                    <ChevronRight size={12} className="text-[#CBD5E1] group-hover:text-[#94A3B8] shrink-0" />
                  </Link>
                )
              })}
            </div>
          </div>

          {/* Obligations légales — format compact */}
          <div className="bg-white rounded-2xl border border-[#E2E8F0] overflow-hidden">
            <div className="px-4 py-3 border-b border-[#F1F5F9]">
              <h2 className="text-[13px] font-bold text-[#0F172A] flex items-center gap-2">
                <CheckCircle size={13} className="text-[#16A34A]" />
                Obligations DGI / CNSS
              </h2>
              <p className="text-[10px] text-[#94A3B8] mt-0.5">Congo-Brazzaville</p>
            </div>
            <div className="p-3 space-y-1.5">
              {LEGAL_ITEMS.map((item, i) => (
                <div key={i} className="flex items-start gap-2.5">
                  <div className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0" style={{ background: item.color }} />
                  <div>
                    <span className="text-[11px] font-bold text-[#0F172A]">{item.label}</span>
                    <span className="text-[10px] text-[#64748B]"> · {item.detail}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}

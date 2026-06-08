'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import {
  TrendingUp, TrendingDown, AlertTriangle, CheckCircle,
  Wallet, Users, BarChart2, Zap, FileText, ArrowRight,
  ChevronRight,
} from 'lucide-react'

// ── Types ─────────────────────────────────────────────────────────────────────

interface ActivityItem {
  id: string; client_nom: string; total: number; statut: string; created_at: string
}

export interface DGData {
  tenant: { nom_entreprise: string; modules_actifs: string[]; plan: string }
  tenantId: string
  kpis:   { revenuMois: number; nbEmployes: number; nbArticles: number; nbAlertes: number }
  alerts: { pendingCount: number; pendingAmount: number; lowStockCount: number }
  recentActivity: ActivityItem[]
  chartData: {
    daily:          { day: string; montant: number; count: number }[]
    moduleBreakdown: { name: string; value: number; color: string }[]
  }
  isFinancial: boolean
  secteur: string | null
  ecoleRole: string | null
  ecoleKpis:      { nbEtudiants: number; nbActifs: number; nbSuspendus: number; nbAbsences: number } | null
  daacKpis:       { sessionsEnCours: number; diplomesEnAttente: number; nbSoutenances: number } | null
  rhKpis:         { nbActifs: number; nbConges: number } | null
  ecoleFinancials: { revenusMois: number; nbPaiementsMois: number; nbImpayesDossiers: number; montantImpayeTotal: number } | null
  // DG extra
  totalDeps:     number
  tresorerie:    number
  marge:         number
  revenuGrowth:  number
  revenuPrevMois: number
}

// ── Design tokens ─────────────────────────────────────────────────────────────
const PRIMARY = '#F59E0B'
const DANGER  = '#DC2626'
const SUCCESS = '#16A34A'
const INFO    = '#2563EB'
const PURPLE  = '#7C3AED'
const MUTED   = '#64748B'
const TEXT    = '#0F172A'
const BORDER  = '#E2E8F0'
const CARDBG  = '#FFFFFF'

// ── Formatters ────────────────────────────────────────────────────────────────
function fmtCFA(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, '') + ' M FCFA'
  if (n >= 1_000)     return Math.round(n / 1_000) + ' K FCFA'
  return new Intl.NumberFormat('fr-FR').format(Math.round(n)) + ' FCFA'
}

// ── Sector metadata ───────────────────────────────────────────────────────────
const SECTOR_META: Record<string, { label: string; color: string }> = {
  commerce:    { label: 'Commerce',     color: PRIMARY  },
  boutique:    { label: 'Boutique',     color: PRIMARY  },
  supermarche: { label: 'Supermarché',  color: PRIMARY  },
  hotel:       { label: 'Hôtel',        color: INFO     },
  restaurant:  { label: 'Restaurant',   color: DANGER   },
  transport:   { label: 'Transport',    color: PURPLE   },
  boisson:     { label: 'Distribution', color: SUCCESS  },
  cabinet:     { label: 'Cabinet',      color: INFO     },
  btp:         { label: 'BTP',          color: '#92400E'},
  banque:      { label: 'Banque',       color: INFO     },
  agriculture: { label: 'Agriculture',  color: SUCCESS  },
  petrole:     { label: 'Pétrole',      color: '#92400E'},
  ong:         { label: 'ONG',          color: PURPLE   },
}

// ── MIAA insight engine ───────────────────────────────────────────────────────
type InsightType = 'alert' | 'risk' | 'forecast' | 'recommendation'
interface Insight { type: InsightType; text: string }

function buildInsights(d: DGData): Insight[] {
  const out: (Insight & { prio: number })[] = []

  if (d.isFinancial) {
    if (d.alerts.pendingCount > 0)
      out.push({ type: 'alert', prio: 9,
        text: `${d.alerts.pendingCount} facture${d.alerts.pendingCount > 1 ? 's' : ''} impayée${d.alerts.pendingCount > 1 ? 's' : ''} — ${fmtCFA(d.alerts.pendingAmount)} à récupérer` })

    if (d.alerts.lowStockCount > 0)
      out.push({ type: 'alert', prio: 7,
        text: `${d.alerts.lowStockCount} article${d.alerts.lowStockCount > 1 ? 's' : ''} en rupture de stock` })

    if (d.marge < 5 && d.kpis.revenuMois > 0)
      out.push({ type: 'risk', prio: 10, text: `Marge nette critique : ${d.marge}% — réduire les charges en urgence` })
    else if (d.marge < 15 && d.marge >= 5 && d.kpis.revenuMois > 0)
      out.push({ type: 'risk', prio: 6, text: `Marge nette faible : ${d.marge}% — surveiller les dépenses` })

    if (d.tresorerie > 0 && d.totalDeps > 0 && d.tresorerie < d.totalDeps)
      out.push({ type: 'risk', prio: 8,
        text: `Trésorerie (${fmtCFA(d.tresorerie)}) inférieure aux charges mensuelles — tension sur les liquidités` })

    if (d.revenuGrowth > 10)
      out.push({ type: 'forecast', prio: 5,
        text: `CA en hausse de +${d.revenuGrowth}% vs mois précédent — dynamique positive confirmée` })
    else if (d.revenuGrowth < -10)
      out.push({ type: 'risk', prio: 8,
        text: `CA en recul de −${Math.abs(d.revenuGrowth)}% vs mois précédent — investigation nécessaire` })

    if (d.kpis.revenuMois > 0 && d.totalDeps > 0)
      out.push({ type: 'forecast', prio: 4,
        text: `Résultat estimé ce mois : ${fmtCFA(d.kpis.revenuMois - d.totalDeps)} (marge ${d.marge}%)` })

    if (d.alerts.pendingCount >= 3)
      out.push({ type: 'recommendation', prio: 7,
        text: 'Activer les relances automatiques pour réduire les impayés' })

    if (d.tresorerie > 0)
      out.push({ type: 'recommendation', prio: 3,
        text: `Trésorerie disponible : ${fmtCFA(d.tresorerie)} — planifier les décaissements` })
  }

  if (d.kpis.nbEmployes === 0)
    out.push({ type: 'recommendation', prio: 5,
      text: "Aucun employé enregistré — configurer l'équipe dans RH & Paie" })

  if (d.secteur === 'hotel')
    out.push({ type: 'recommendation', prio: 4,
      text: "Vérifier le taux d'occupation et les réservations à venir dans le module Hôtel" })
  if (d.secteur === 'restaurant')
    out.push({ type: 'recommendation', prio: 4,
      text: "Analyser les performances des tables et le ticket moyen via le module Restaurant" })
  if (d.secteur === 'cabinet')
    out.push({ type: 'recommendation', prio: 4,
      text: "Revoir les missions en cours et les déclarations fiscales à échéance" })

  if (out.length === 0)
    out.push({ type: 'recommendation', prio: 1,
      text: 'Situation saine — aucune alerte critique à signaler' })

  return out
    .sort((a, b) => b.prio - a.prio)
    .slice(0, 7)
    .map(({ type, text }) => ({ type, text }))
}

// ── KPI card config ───────────────────────────────────────────────────────────
type KpiIcon = React.ComponentType<{ size?: number; style?: React.CSSProperties }>

interface KpiCard {
  label: string; value: string; sub?: string; color: string
  icon: KpiIcon; trend?: number
}

function buildKpiCards(d: DGData): KpiCard[] {
  const cards: KpiCard[] = []

  if (d.isFinancial) {
    cards.push({
      label: 'CA du mois', value: fmtCFA(d.kpis.revenuMois), color: PRIMARY, icon: TrendingUp,
      sub: d.revenuPrevMois > 0 ? `vs ${fmtCFA(d.revenuPrevMois)} mois préc.` : 'Collecté ce mois',
      trend: d.revenuGrowth !== 0 ? d.revenuGrowth : undefined,
    })
    cards.push({
      label: 'Trésorerie', value: fmtCFA(d.tresorerie), color: INFO, icon: Wallet,
      sub: 'Banques + Caisses',
    })
    cards.push({
      label: 'Dépenses mois', value: fmtCFA(d.totalDeps),
      color: d.marge < 10 ? DANGER : SUCCESS, icon: BarChart2,
      sub: `Marge nette : ${d.marge}%`,
    })
    cards.push({
      label: 'Impayés', value: String(d.alerts.pendingCount),
      color: d.alerts.pendingCount > 0 ? DANGER : SUCCESS, icon: FileText,
      sub: d.alerts.pendingCount > 0 ? fmtCFA(d.alerts.pendingAmount) : 'Aucun impayé',
    })
  }

  cards.push({
    label: 'Équipe', value: String(d.kpis.nbEmployes), color: PURPLE, icon: Users,
    sub: 'Employés enregistrés',
  })

  const sec = d.secteur ?? ''
  if (['commerce', 'boutique', 'supermarche', 'boisson'].includes(sec)) {
    cards.push({
      label: 'Stock critique', value: String(d.alerts.lowStockCount),
      color: d.alerts.lowStockCount > 0 ? DANGER : SUCCESS, icon: AlertTriangle,
      sub: d.alerts.lowStockCount > 0 ? 'Articles en rupture' : 'Stock sain',
    })
  } else if (!d.isFinancial) {
    cards.push({
      label: 'Articles', value: String(d.kpis.nbArticles), color: INFO, icon: BarChart2,
      sub: `dont ${d.alerts.lowStockCount} en rupture`,
    })
  }

  return cards.slice(0, 6)
}

// ── Quick links ───────────────────────────────────────────────────────────────
const QUICK_LINKS = [
  { label: 'Facturation',   href: '/dashboard/facturation',  color: PRIMARY },
  { label: 'Trésorerie',    href: '/dashboard/tresorerie',   color: INFO    },
  { label: 'Comptabilité',  href: '/dashboard/comptabilite', color: PURPLE  },
  { label: 'RH & Paie',    href: '/dashboard/rh',           color: SUCCESS },
  { label: 'Fiscalité',    href: '/dashboard/fiscalite',    color: DANGER  },
  { label: 'Analytics',    href: '/dashboard/bi',           color: MUTED   },
]

const INSIGHT_META: Record<InsightType, { emoji: string; label: string; color: string }> = {
  alert:          { emoji: '🔴', label: 'ALERTE',         color: DANGER   },
  risk:           { emoji: '⚠️', label: 'RISQUE',         color: '#D97706' },
  forecast:       { emoji: '📈', label: 'PRÉVISION',      color: INFO     },
  recommendation: { emoji: '✅', label: 'RECOMMANDATION', color: SUCCESS  },
}

const STATUT_C: Record<string, string> = {
  payee: SUCCESS, envoyee: INFO, brouillon: MUTED, annulee: DANGER,
}

const DAY_FR = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam']

// ── Component ─────────────────────────────────────────────────────────────────

export default function DGClient({ userName, data }: { userName?: string; data: DGData }) {
  const insights = useMemo(() => buildInsights(data), [data])
  const kpiCards = useMemo(() => buildKpiCards(data), [data])

  const sectorMeta = data.secteur ? SECTOR_META[data.secteur] : null
  const dateStr = new Date().toLocaleDateString('fr-FR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })

  const maxDaily = Math.max(...data.chartData.daily.map(d => d.montant), 1)
  const hasChartData = data.isFinancial && data.chartData.daily.some(d => d.montant > 0)

  return (
    <div className="space-y-5 max-w-7xl mx-auto">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-[22px] sm:text-[26px] font-extrabold tracking-tight leading-tight"
              style={{ color: TEXT }}>
              Direction Générale
            </h1>
            {sectorMeta && (
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide"
                style={{
                  background: `${sectorMeta.color}18`,
                  color: sectorMeta.color,
                  border: `1px solid ${sectorMeta.color}30`,
                }}>
                {sectorMeta.label}
              </span>
            )}
          </div>
          <p className="text-[12px] mt-1" style={{ color: MUTED }}>
            {data.tenant.nom_entreprise}
            {userName ? ` — Bonjour, ${userName.split(' ')[0]}` : ''}
            {' · '}{dateStr}
          </p>
        </div>
        <Link
          href="/dashboard/bi"
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[12px] font-semibold border transition-all hover:shadow-sm shrink-0"
          style={{ borderColor: BORDER, color: MUTED, background: CARDBG }}
        >
          <BarChart2 size={13} /> Analytics
        </Link>
      </div>

      {/* ── KPI Cards ──────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3">
        {kpiCards.map((card, i) => {
          const Icon = card.icon
          return (
            <div
              key={i}
              className="rounded-2xl p-4 flex flex-col gap-3"
              style={{ background: CARDBG, border: `1px solid ${BORDER}`, boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}
            >
              <div className="flex items-center justify-between">
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center"
                  style={{ background: `${card.color}15` }}
                >
                  <Icon size={15} style={{ color: card.color }} />
                </div>
                {card.trend != null && (
                  <span
                    className="text-[10px] font-bold flex items-center gap-0.5"
                    style={{ color: card.trend >= 0 ? SUCCESS : DANGER }}
                  >
                    {card.trend >= 0 ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                    {card.trend >= 0 ? '+' : ''}{card.trend}%
                  </span>
                )}
              </div>
              <div>
                <p className="text-[14px] sm:text-[15px] font-extrabold leading-tight break-words"
                  style={{ color: card.color }}>
                  {card.value}
                </p>
                <p className="text-[10px] font-semibold uppercase tracking-wide mt-0.5" style={{ color: MUTED }}>
                  {card.label}
                </p>
                {card.sub && (
                  <p className="text-[9px] mt-0.5 leading-tight" style={{ color: MUTED }}>{card.sub}</p>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* ── Main grid: MIAA DG + right panel ──────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* MIAA DG Insights */}
        <div
          className="lg:col-span-2 rounded-2xl overflow-hidden flex flex-col"
          style={{ border: `1px solid ${BORDER}` }}
        >
          {/* dark header */}
          <div
            className="px-4 py-3 flex items-center justify-between shrink-0"
            style={{
              background: 'linear-gradient(135deg,#0F172A 0%,#1E293B 100%)',
              borderBottom: '1px solid #334155',
            }}
          >
            <div className="flex items-center gap-2.5">
              <div
                className="w-7 h-7 rounded-lg flex items-center justify-center"
                style={{ background: `${PRIMARY}22` }}
              >
                <Zap size={13} style={{ color: PRIMARY }} />
              </div>
              <div>
                <p className="text-[13px] font-extrabold text-white">MIAA DG</p>
                <p className="text-[9px]" style={{ color: '#94A3B8' }}>
                  Intelligence artificielle · Alertes, risques &amp; prévisions
                </p>
              </div>
            </div>
            <span
              className="text-[9px] font-bold px-2 py-0.5 rounded-full"
              style={{ background: `${PRIMARY}22`, color: PRIMARY }}
            >
              {insights.length} analyse{insights.length !== 1 ? 's' : ''}
            </span>
          </div>

          {/* insights list */}
          <div className="divide-y divide-[#F1F5F9] flex-1 bg-white">
            {insights.map((ins, i) => {
              const meta = INSIGHT_META[ins.type]
              return (
                <div key={i} className="px-4 py-3 flex items-start gap-3">
                  <span className="shrink-0 text-[15px] mt-0.5">{meta.emoji}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] leading-snug" style={{ color: TEXT }}>{ins.text}</p>
                    <span
                      className="text-[9px] font-bold uppercase tracking-wide mt-0.5 inline-block"
                      style={{ color: meta.color }}
                    >
                      {meta.label}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Right column */}
        <div className="flex flex-col gap-4">

          {/* Quick access */}
          <div className="rounded-2xl overflow-hidden" style={{ background: CARDBG, border: `1px solid ${BORDER}` }}>
            <div className="px-4 py-3" style={{ borderBottom: `1px solid ${BORDER}` }}>
              <p className="text-[12px] font-bold" style={{ color: TEXT }}>Accès rapide</p>
            </div>
            <div className="p-2 grid grid-cols-2 gap-1.5">
              {QUICK_LINKS.map(link => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="flex items-center gap-1.5 px-2.5 py-2 rounded-xl text-[11px] font-semibold transition-all hover:opacity-75"
                  style={{ background: `${link.color}10`, color: link.color, border: `1px solid ${link.color}22` }}
                >
                  <ChevronRight size={10} /> {link.label}
                </Link>
              ))}
            </div>
          </div>

          {/* Résumé exécutif */}
          {data.isFinancial && (
            <div
              className="rounded-2xl p-4 flex flex-col gap-2.5"
              style={{ background: 'linear-gradient(135deg,#0F172A 0%,#1E293B 100%)', border: '1px solid #334155' }}
            >
              <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: '#94A3B8' }}>
                Résumé Exécutif
              </p>
              <div className="flex justify-between items-center">
                <span className="text-[11px]" style={{ color: '#CBD5E1' }}>CA collecté</span>
                <span className="text-[12px] font-bold text-white">{fmtCFA(data.kpis.revenuMois)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[11px]" style={{ color: '#CBD5E1' }}>Dépenses</span>
                <span className="text-[12px] font-bold" style={{ color: DANGER }}>{fmtCFA(data.totalDeps)}</span>
              </div>
              <div className="h-px" style={{ background: '#334155' }} />
              <div className="flex justify-between items-center">
                <span className="text-[11px] font-bold" style={{ color: '#94A3B8' }}>Résultat net</span>
                <span
                  className="text-[13px] font-extrabold"
                  style={{ color: (data.kpis.revenuMois - data.totalDeps) >= 0 ? SUCCESS : DANGER }}
                >
                  {fmtCFA(data.kpis.revenuMois - data.totalDeps)}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[11px]" style={{ color: '#94A3B8' }}>Marge nette</span>
                <span
                  className="text-[12px] font-bold"
                  style={{ color: data.marge >= 15 ? SUCCESS : data.marge >= 5 ? PRIMARY : DANGER }}
                >
                  {data.marge}%
                </span>
              </div>
              {data.tresorerie > 0 && (
                <div className="flex justify-between items-center">
                  <span className="text-[11px]" style={{ color: '#94A3B8' }}>Trésorerie</span>
                  <span className="text-[12px] font-bold text-white">{fmtCFA(data.tresorerie)}</span>
                </div>
              )}
            </div>
          )}

          {/* Alertes count */}
          {data.kpis.nbAlertes > 0 && (
            <div
              className="rounded-2xl p-4 flex items-center gap-3"
              style={{ background: `${DANGER}08`, border: `1px solid ${DANGER}20` }}
            >
              <AlertTriangle size={18} style={{ color: DANGER, flexShrink: 0 }} />
              <div>
                <p className="text-[13px] font-bold" style={{ color: DANGER }}>
                  {data.kpis.nbAlertes} alerte{data.kpis.nbAlertes > 1 ? 's' : ''} active{data.kpis.nbAlertes > 1 ? 's' : ''}
                </p>
                <p className="text-[11px] mt-0.5" style={{ color: MUTED }}>
                  Vérifier les modules concernés
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── CA Chart 7 jours ───────────────────────────────────────────────── */}
      {hasChartData && (
        <div className="rounded-2xl p-4" style={{ background: CARDBG, border: `1px solid ${BORDER}` }}>
          <div className="flex items-center justify-between mb-4">
            <p className="text-[13px] font-bold" style={{ color: TEXT }}>
              Évolution CA — 7 derniers jours
            </p>
            <span className="text-[11px]" style={{ color: MUTED }}>
              {fmtCFA(data.chartData.daily.reduce((s, d) => s + d.montant, 0))} total
            </span>
          </div>
          <div className="flex items-end gap-2 h-20">
            {data.chartData.daily.map((day, i) => {
              const pct = (day.montant / maxDaily) * 100
              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-1 h-full justify-end">
                  <div
                    className="w-full rounded-t-md"
                    style={{
                      height: `${Math.max(pct, 4)}%`,
                      background: pct > 0 ? PRIMARY : '#F1F5F9',
                    }}
                  />
                  <span className="text-[9px] shrink-0" style={{ color: MUTED }}>
                    {DAY_FR[parseInt(day.day)] ?? day.day}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Activité récente ──────────────────────────────────────────────── */}
      {data.recentActivity.length > 0 && (
        <div className="rounded-2xl overflow-hidden" style={{ background: CARDBG, border: `1px solid ${BORDER}` }}>
          <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: `1px solid ${BORDER}` }}>
            <p className="text-[13px] font-bold" style={{ color: TEXT }}>Activité récente</p>
            <Link
              href="/dashboard/facturation"
              className="text-[11px] font-semibold flex items-center gap-1 hover:underline"
              style={{ color: INFO }}
            >
              Voir tout <ArrowRight size={11} />
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-[12px]" style={{ borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#F8FAFC' }}>
                  <th className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-wide" style={{ color: MUTED }}>Client</th>
                  <th className="px-4 py-2.5 text-right text-[10px] font-bold uppercase tracking-wide" style={{ color: MUTED }}>Montant</th>
                  <th className="px-4 py-2.5 text-center text-[10px] font-bold uppercase tracking-wide hidden sm:table-cell" style={{ color: MUTED }}>Statut</th>
                  <th className="px-4 py-2.5 text-right text-[10px] font-bold uppercase tracking-wide hidden md:table-cell" style={{ color: MUTED }}>Date</th>
                </tr>
              </thead>
              <tbody>
                {data.recentActivity.slice(0, 7).map(act => (
                  <tr
                    key={act.id}
                    className="border-t hover:bg-[#F8FAFC] transition-colors"
                    style={{ borderColor: '#F1F5F9' }}
                  >
                    <td className="px-4 py-2.5 font-medium truncate max-w-[140px]" style={{ color: TEXT }}>
                      {act.client_nom}
                    </td>
                    <td className="px-4 py-2.5 text-right font-bold" style={{ color: TEXT }}>
                      {fmtCFA(act.total)}
                    </td>
                    <td className="px-4 py-2.5 text-center hidden sm:table-cell">
                      <span
                        className="px-2 py-0.5 rounded-full text-[10px] font-bold"
                        style={{
                          background: `${STATUT_C[act.statut] ?? MUTED}15`,
                          color: STATUT_C[act.statut] ?? MUTED,
                        }}
                      >
                        {act.statut}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right text-[11px] hidden md:table-cell" style={{ color: MUTED }}>
                      {new Date(act.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── État sain (fallback) ─────────────────────────────────────────── */}
      {!data.isFinancial && data.kpis.nbAlertes === 0 && data.recentActivity.length === 0 && (
        <div
          className="rounded-2xl p-8 flex flex-col items-center gap-3 text-center"
          style={{ background: CARDBG, border: `1px solid ${BORDER}` }}
        >
          <CheckCircle size={36} style={{ color: SUCCESS }} />
          <p className="text-[15px] font-bold" style={{ color: TEXT }}>Bienvenue dans la Direction Générale</p>
          <p className="text-[12px] max-w-sm" style={{ color: MUTED }}>
            Activez les modules financiers pour accéder aux KPIs, alertes et prévisions MIAA DG.
          </p>
          <Link
            href="/dashboard/parametres"
            className="mt-1 px-4 py-2 rounded-xl text-[12px] font-semibold text-white"
            style={{ background: PRIMARY }}
          >
            Configurer les modules
          </Link>
        </div>
      )}

    </div>
  )
}

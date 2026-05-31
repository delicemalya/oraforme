'use client'

/**
 * Dashboard Finance — Moteur Financier Central Oraforme
 * Architecture SAP/Odoo : toutes sources → vue unifiée
 * OHADA · Multi-tenant · Congo-Brazzaville
 */

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useTenant } from '@/lib/hooks/useTenant'
import { useLocale } from '@/lib/hooks/useLocale'
import {
  AreaChart, Area, BarChart, Bar,
  LineChart, Line, ComposedChart,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, ReferenceLine, Cell,
} from 'recharts'
import {
  TrendingUp, TrendingDown, Minus,
  DollarSign, Wallet, Building2, Smartphone,
  Users, GraduationCap, ShoppingCart, FileText,
  ArrowUpRight, ArrowDownRight, RefreshCw, Calendar,
  Download, AlertCircle, Clock, ChevronRight,
  Activity, Target, BarChart2, Layers,
  CheckCircle, AlertTriangle, XCircle, Info,
} from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

interface KpiRaw {
  ca_annee: number; dep_annee: number; resultat_net: number; marge_nette_pct: number
  ca_mois: number; dep_mois: number; cashflow_mois: number
  ca_prev: number; dep_prev: number; cashflow_prev: number
  solde_banque: number; solde_caisse: number; solde_mobile: number; treso_totale: number
  creances_clients: number; nb_factures_ouvertes: number; nb_factures_retard: number
  dettes_fournisseurs: number
  tva_collectee: number; tva_deductible: number; tva_nette: number; ca_taxe: number
  salaires_annee: number; ratio_salaires_pct: number
  ca_ecole: number; ca_facturation: number; ca_autres: number
  previsions_entrees: number; previsions_sorties: number; previsions_net: number
  exercice: number; mois_courant: number
}

interface MonthlyRow {
  mois: number; mois_label: string
  entrees: number; sorties: number; net: number; cumul: number
}

interface SourceRow {
  module_source: string; type_flux: string; total: number; nb_operations: number
}

interface ScoreRaw {
  score: number; label: string
  score_cashflow: number; score_treso: number; score_creances: number; score_dettes: number
  treso_totale: number; cashflow_90j: number
}

interface TresoItem { type_compte: string; nom: string; solde: number }
interface RecentTx {
  id: string; date_operation: string; libelle: string; montant: number
  type: 'entree' | 'sortie' | 'transfert'; categorie: string; moyen_paiement: string; source: string
}
interface Prevision {
  id: string; libelle: string; montant: number; type: string; date_prevue: string
  probabilite: number; statut: string
}

type TabId = 'apercu' | 'cashflow' | 'sources' | 'previsions' | 'tva'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmt = (n: number) =>
  new Intl.NumberFormat('fr-CG', { maximumFractionDigits: 0 }).format(Math.round(n)) + ' FCFA'

const fmtShort = (n: number): string => {
  const abs = Math.abs(n)
  const sign = n < 0 ? '−' : ''
  if (abs >= 1_000_000_000) return sign + (abs / 1_000_000_000).toFixed(1) + 'Md'
  if (abs >= 1_000_000)     return sign + (abs / 1_000_000).toFixed(1) + 'M'
  if (abs >= 1_000)         return sign + (abs / 1_000).toFixed(0) + 'k'
  return sign + String(Math.round(abs))
}

const getDiff = (a: number, b: number): number => {
  if (b === 0) return a > 0 ? 100 : 0
  return Math.round(((a - b) / Math.abs(b)) * 100)
}

const MONTH_LABELS = ['Jan','Fév','Mar','Avr','Mai','Jun','Jul','Aoû','Sep','Oct','Nov','Déc']

const SOURCE_COLORS: Record<string, string> = {
  'Facturation':   '#10B981',
  'École':         '#3B82F6',
  'RH & Paie':     '#7C3AED',
  'Commercial':    '#F59E0B',
  'Achats':        '#EF4444',
  'Dépenses':      '#F97316',
  'Stock':         '#06B6D4',
  'Mobile Money':  '#8B5CF6',
  'Caisse':        '#84CC16',
  'Hôtellerie':    '#EC4899',
  'Restauration':  '#14B8A6',
  'Manuel':        '#94A3B8',
}

const SOURCE_ICONS: Record<string, React.ReactNode> = {
  'Facturation':  <FileText size={13} />,
  'École':        <GraduationCap size={13} />,
  'RH & Paie':    <Users size={13} />,
  'Commercial':   <TrendingUp size={13} />,
  'Achats':       <ShoppingCart size={13} />,
  'Dépenses':     <TrendingDown size={13} />,
  'Stock':        <Layers size={13} />,
  'Mobile Money': <Smartphone size={13} />,
  'Caisse':       <Wallet size={13} />,
  'Manuel':       <DollarSign size={13} />,
}

// ─── Composants réutilisables ─────────────────────────────────────────────────

function KpiCard({
  label, value, sub, evol, icon, accent, loading, badge,
}: {
  label: string; value: string; sub?: string; evol?: number
  icon: React.ReactNode; accent: string; loading?: boolean; badge?: string
}) {
  return (
    <div className="bg-white rounded-2xl border border-[#E5E7EB] p-5 flex flex-col gap-3 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider leading-tight">{label}</span>
        <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: accent + '18' }}>
          <div style={{ color: accent }}>{icon}</div>
        </div>
      </div>
      {loading
        ? <div className="h-8 rounded-lg bg-[#F3F4F6] animate-pulse w-3/4" />
        : <div className="text-[22px] font-bold text-[#111827] leading-tight tracking-tight">{value}</div>
      }
      <div className="flex items-center gap-2 flex-wrap">
        {evol !== undefined && (
          <span className={`flex items-center gap-0.5 text-[11px] font-semibold px-1.5 py-0.5 rounded-md ${
            evol > 0 ? 'bg-emerald-50 text-emerald-600'
            : evol < 0 ? 'bg-red-50 text-red-500'
            : 'bg-gray-100 text-[#6B7280]'
          }`}>
            {evol > 0 ? <ArrowUpRight size={11} /> : evol < 0 ? <ArrowDownRight size={11} /> : <Minus size={11} />}
            {Math.abs(evol)}%
          </span>
        )}
        {sub && <span className="text-[11px] text-[#9CA3AF]">{sub}</span>}
        {badge && (
          <span className="ml-auto text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ background: accent + '18', color: accent }}>
            {badge}
          </span>
        )}
      </div>
    </div>
  )
}

function SectionCard({ title, sub, children, action }: {
  title: string; sub?: string
  children: React.ReactNode; action?: React.ReactNode
}) {
  return (
    <div className="bg-white rounded-2xl border border-[#E5E7EB] shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-[#F3F4F6]">
        <div>
          <h3 className="text-[13px] font-semibold text-[#111827]">{title}</h3>
          {sub && <p className="text-[11px] text-[#9CA3AF] mt-0.5">{sub}</p>}
        </div>
        {action}
      </div>
      {children}
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function FinancePage() {
  const { tenantId } = useTenant()
  const { t } = useLocale()
  const [tab,       setTab]       = useState<TabId>('apercu')
  const [kpi,       setKpi]       = useState<KpiRaw | null>(null)
  const [monthly,   setMonthly]   = useState<MonthlyRow[]>([])
  const [sources,   setSources]   = useState<SourceRow[]>([])
  const [score,     setScore]     = useState<ScoreRaw | null>(null)
  const [treso,     setTreso]     = useState<TresoItem[]>([])
  const [recentTx,  setRecentTx]  = useState<RecentTx[]>([])
  const [prevs,     setPrevs]     = useState<Prevision[]>([])
  const [loading,   setLoading]   = useState(true)
  const [lTreso,    setLTreso]    = useState(true)

  const currentYear  = new Date().getFullYear()
  const currentMonth = new Date().getMonth()

  // ── Chargement principal via RPCs serveur ──────────────────────────────────
  const load = useCallback(async () => {
    if (!tenantId) return
    setLoading(true)

    const [
      { data: kpiData },
      { data: monthlyData },
      { data: sourceData },
      { data: scoreData },
    ] = await Promise.all([
      supabase.rpc('fn_finance_kpis',       { p_tenant_id: tenantId }),
      supabase.rpc('fn_cashflow_monthly',    { p_tenant_id: tenantId }),
      supabase.rpc('fn_source_breakdown',    { p_tenant_id: tenantId }),
      supabase.rpc('fn_financial_score',     { p_tenant_id: tenantId }),
    ])

    if (kpiData)     setKpi(kpiData as KpiRaw)
    if (monthlyData) setMonthly(monthlyData as MonthlyRow[])
    if (sourceData)  setSources(sourceData as SourceRow[])
    if (scoreData)   setScore(scoreData as ScoreRaw)

    // Transactions récentes (direct — pas dans RPC pour garder la flexibilité)
    const { data: txData } = await supabase
      .from('transactions')
      .select('id, date_operation, libelle, montant, type, categorie, moyen_paiement, source')
      .eq('tenant_id', tenantId)
      .order('date_operation', { ascending: false })
      .limit(15)
    setRecentTx((txData as RecentTx[] | null) ?? [])

    setLoading(false)
  }, [tenantId])

  // ── Trésorerie détaillée ───────────────────────────────────────────────────
  const loadTreso = useCallback(async () => {
    if (!tenantId) return
    setLTreso(true)
    const [{ data: bq }, { data: ca }, { data: mo }] = await Promise.all([
      supabase.from('comptes_bancaires')    .select('nom, solde').eq('tenant_id', tenantId).eq('actif', true).limit(200),
      supabase.from('caisses')              .select('nom, solde').eq('tenant_id', tenantId).eq('actif', true).limit(200),
      supabase.from('mobile_money_wallets') .select('nom, solde').eq('tenant_id', tenantId).eq('actif', true).limit(200),
    ])
    const items: TresoItem[] = [
      ...((bq ?? []) as { nom: string; solde: number }[]).map(r => ({ type_compte: 'banque',  nom: r.nom, solde: r.solde ?? 0 })),
      ...((ca ?? []) as { nom: string; solde: number }[]).map(r => ({ type_compte: 'caisse',  nom: r.nom, solde: r.solde ?? 0 })),
      ...((mo ?? []) as { nom: string; solde: number }[]).map(r => ({ type_compte: 'mobile',  nom: r.nom, solde: r.solde ?? 0 })),
    ]
    setTreso(items)
    setLTreso(false)
  }, [tenantId])

  // ── Prévisions ────────────────────────────────────────────────────────────
  const loadPrevs = useCallback(async () => {
    if (!tenantId) return
    const { data } = await supabase.from('previsions_tresorerie')
      .select('id, libelle, montant, type, date_prevue, probabilite, statut')
      .eq('tenant_id', tenantId)
      .gte('date_prevue', new Date().toISOString().split('T')[0])
      .order('date_prevue')
      .limit(30)
    setPrevs((data as Prevision[] | null) ?? [])
  }, [tenantId])

  useEffect(() => { load(); loadTreso() }, [load, loadTreso])
  useEffect(() => { if (tab === 'previsions') loadPrevs() }, [tab, loadPrevs])

  // ── Données dérivées ───────────────────────────────────────────────────────
  const caEvol  = getDiff(kpi?.ca_mois  ?? 0, kpi?.ca_prev  ?? 0)
  const depEvol = getDiff(kpi?.dep_mois ?? 0, kpi?.dep_prev ?? 0)
  const netEvol = getDiff(kpi?.cashflow_mois ?? 0, kpi?.cashflow_prev ?? 0)

  const revenueSources = sources.filter(s => s.type_flux === 'entree').slice(0, 6)
  const expenseSources = sources.filter(s => s.type_flux === 'sortie').slice(0, 6)
  const totalCA   = revenueSources.reduce((s, x) => s + x.total, 0)
  const totalDep  = expenseSources.reduce((s, x) => s + x.total, 0)

  const TRESO_STYLE: Record<string, { bg: string; text: string; icon: React.ReactNode }> = {
    banque: { bg: '#DBEAFE', text: '#1D4ED8', icon: <Building2 size={14} /> },
    caisse: { bg: '#D1FAE5', text: '#065F46', icon: <Wallet size={14} /> },
    mobile: { bg: '#FEF3C7', text: '#92400E', icon: <Smartphone size={14} /> },
  }

  const scoreColor = score
    ? score.score >= 85 ? '#10B981'
    : score.score >= 70 ? '#3B82F6'
    : score.score >= 50 ? '#F59E0B'
    : score.score >= 30 ? '#F97316'
    : '#EF4444'
    : '#94A3B8'

  const TABS: { id: TabId; label: string }[] = [
    { id: 'apercu',     label: t('finance.apercu') },
    { id: 'cashflow',   label: t('finance.tabs.cashflow') },
    { id: 'sources',    label: t('finance.tabs.sources') },
    { id: 'previsions', label: t('finance.tabs.previsions') },
    { id: 'tva',        label: t('finance.tabs.tva') },
  ]

  // ─── RENDER ───────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5 max-w-[1440px] mx-auto">

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#F0FDF4] flex items-center justify-center">
            <Activity size={20} className="text-[#10B981]" />
          </div>
          <div>
            <h1 className="text-[18px] font-bold text-[#111827] tracking-tight">{t('nav.finance')}</h1>
            <p className="text-[11px] text-[#6B7280]">
              Moteur financier central · Exercice {currentYear} · {MONTH_LABELS[currentMonth]}
            </p>
          </div>
          {/* Score santé */}
          {score && !loading && (
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl border" style={{ borderColor: scoreColor + '40', background: scoreColor + '10' }}>
              <div className="w-2 h-2 rounded-full" style={{ background: scoreColor }} />
              <span className="text-[12px] font-bold" style={{ color: scoreColor }}>Santé : {score.label}</span>
              <span className="text-[11px]" style={{ color: scoreColor }}>{score.score}/100</span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-[#9CA3AF] flex items-center gap-1 hidden sm:flex">
            <Calendar size={12} />
            {new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })}
          </span>
          <button onClick={() => { load(); loadTreso() }} disabled={loading}
            className="flex items-center gap-1.5 text-[11px] font-medium px-3 py-1.5 rounded-lg bg-white border border-[#E5E7EB] text-[#374151] hover:bg-[#F9FAFB] transition-colors disabled:opacity-50">
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
            {t('common.refresh')}
          </button>
          <button className="flex items-center gap-1.5 text-[11px] font-medium px-3 py-1.5 rounded-lg bg-[#10B981] text-white hover:bg-[#059669] transition-colors">
            <Download size={12} /> {t('common.export')}
          </button>
        </div>
      </div>

      {/* ── Tabs ────────────────────────────────────────────────────────── */}
      <div className="flex gap-1 bg-[#F3F4F6] rounded-xl p-1 w-fit overflow-x-auto">
        {TABS.map(tabItem => (
          <button key={tabItem.id} onClick={() => setTab(tabItem.id)}
            className={`px-4 py-1.5 rounded-lg text-[12px] font-medium transition-all whitespace-nowrap ${
              tab === tabItem.id ? 'bg-white text-[#111827] shadow-sm' : 'text-[#6B7280] hover:text-[#374151]'
            }`}>
            {tabItem.label}
          </button>
        ))}
      </div>

      {/* ══════════════════════════════════════════════════════════════════
          TAB : VUE D'ENSEMBLE
      ══════════════════════════════════════════════════════════════════ */}
      {tab === 'apercu' && (
        <div className="space-y-5">

          {/* KPI row 1 — P&L */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard label={t('finance.revenue')} icon={<TrendingUp size={16} />} accent="#10B981" loading={loading}
              value={loading ? '—' : fmtShort(kpi?.ca_annee ?? 0) + ' FCFA'}
              sub={`${fmtShort(kpi?.ca_mois ?? 0)} ce mois`} evol={caEvol} />
            <KpiCard label="Dépenses totales" icon={<TrendingDown size={16} />} accent="#EF4444" loading={loading}
              value={loading ? '—' : fmtShort(kpi?.dep_annee ?? 0) + ' FCFA'}
              sub={`${fmtShort(kpi?.dep_mois ?? 0)} ce mois`} evol={depEvol} />
            <KpiCard label="Résultat net" icon={<DollarSign size={16} />}
              accent={(kpi?.resultat_net ?? 0) >= 0 ? '#10B981' : '#EF4444'} loading={loading}
              value={loading ? '—' : fmtShort(kpi?.resultat_net ?? 0) + ' FCFA'}
              sub="Produits − Charges" evol={netEvol}
              badge={kpi ? `${kpi.marge_nette_pct}%` : undefined} />
            <KpiCard label={t('finance.cashflow') + ' du mois'} icon={<BarChart2 size={16} />}
              accent={(kpi?.cashflow_mois ?? 0) >= 0 ? '#3B82F6' : '#F97316'} loading={loading}
              value={loading ? '—' : fmtShort(kpi?.cashflow_mois ?? 0) + ' FCFA'}
              sub={`${t('finance.entries')} − ${t('finance.exits')}`} />
          </div>

          {/* KPI row 2 — Trésorerie */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard label={t('finance.bank')} icon={<Building2 size={16} />} accent="#3B82F6" loading={loading}
              value={loading ? '—' : fmtShort(kpi?.solde_banque ?? 0) + ' FCFA'} />
            <KpiCard label={t('finance.cash')} icon={<Wallet size={16} />} accent="#10B981" loading={loading}
              value={loading ? '—' : fmtShort(kpi?.solde_caisse ?? 0) + ' FCFA'} />
            <KpiCard label={t('finance.mobile')} icon={<Smartphone size={16} />} accent="#F59E0B" loading={loading}
              value={loading ? '—' : fmtShort(kpi?.solde_mobile ?? 0) + ' FCFA'} />
            <KpiCard label={t('finance.treso') + ' totale'} icon={<Target size={16} />} accent="#8B5CF6" loading={loading}
              value={loading ? '—' : fmtShort(kpi?.treso_totale ?? 0) + ' FCFA'}
              sub={`${t('finance.bank')} + ${t('finance.cash')} + ${t('finance.mobile')}`} />
          </div>

          {/* KPI row 3 — Tiers & Fiscalité */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard label={t('finance.receivables')} icon={<AlertCircle size={16} />} accent="#F59E0B" loading={loading}
              value={loading ? '—' : fmtShort(kpi?.creances_clients ?? 0) + ' FCFA'}
              sub={kpi ? `${kpi.nb_factures_ouvertes} facture(s)` : '—'}
              badge={kpi && kpi.nb_factures_retard > 0 ? `${kpi.nb_factures_retard} retard` : undefined} />
            <KpiCard label={t('finance.payables')} icon={<Clock size={16} />} accent="#EF4444" loading={loading}
              value={loading ? '—' : fmtShort(kpi?.dettes_fournisseurs ?? 0) + ' FCFA'}
              sub="Achats non réglés" />
            <KpiCard label={t('finance.vatNet')} icon={<FileText size={16} />} accent="#2563EB" loading={loading}
              value={loading ? '—' : fmtShort(kpi?.tva_nette ?? 0) + ' FCFA'}
              sub="À déclarer à la DGI" />
            <KpiCard label="Charges salariales" icon={<Users size={16} />} accent="#7C3AED" loading={loading}
              value={loading ? '—' : fmtShort(kpi?.salaires_annee ?? 0) + ' FCFA'}
              sub="Exercice en cours"
              badge={kpi ? `${kpi.ratio_salaires_pct}% du CA` : undefined} />
          </div>

          {/* Charts row */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

            {/* Évolution mensuelle */}
            <div className="lg:col-span-2 bg-white rounded-2xl border border-[#E5E7EB] p-5 shadow-sm">
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h3 className="text-[13px] font-semibold text-[#111827]">Évolution mensuelle</h3>
                  <p className="text-[11px] text-[#9CA3AF]">{t('finance.entries')} · {t('finance.exits')} · Résultat net · {currentYear}</p>
                </div>
              </div>
              {loading ? <div className="h-56 bg-[#F9FAFB] rounded-xl animate-pulse" /> : (
                <ResponsiveContainer width="100%" height={220}>
                  <AreaChart data={monthly} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="gEnt" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10B981" stopOpacity={0.15} />
                        <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="gSor" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#EF4444" stopOpacity={0.12} />
                        <stop offset="95%" stopColor="#EF4444" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                    <XAxis dataKey="mois_label" tick={{ fontSize: 11, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: '#9CA3AF' }} axisLine={false} tickLine={false} tickFormatter={fmtShort} />
                    <Tooltip formatter={(v) => fmt(Number(v))}
                      contentStyle={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 12, fontSize: 12 }} />
                    <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
                    <Area type="monotone" dataKey="entrees" name={t('finance.entries')}  stroke="#10B981" strokeWidth={2} fill="url(#gEnt)" />
                    <Area type="monotone" dataKey="sorties" name={t('finance.exits')}  stroke="#EF4444" strokeWidth={2} fill="url(#gSor)" />
                    <Line  type="monotone" dataKey="net"     name={t('finance.net')}      stroke="#3B82F6" strokeWidth={2} dot={{ r: 3 }} />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Trésorerie par compte */}
            <div className="bg-white rounded-2xl border border-[#E5E7EB] p-5 shadow-sm">
              <h3 className="text-[13px] font-semibold text-[#111827] mb-1">{t('finance.treso')}</h3>
              <p className="text-[11px] text-[#9CA3AF] mb-4">Soldes réels par compte</p>
              {lTreso ? (
                <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-12 bg-[#F3F4F6] rounded-lg animate-pulse" />)}</div>
              ) : treso.length === 0 ? (
                <p className="text-[12px] text-[#9CA3AF] text-center py-8">Aucun compte configuré</p>
              ) : (
                <div className="space-y-2">
                  {treso.map((tr, i) => {
                    const s = TRESO_STYLE[tr.type_compte] ?? TRESO_STYLE.caisse
                    const total = treso.reduce((sum, x) => sum + Math.max(x.solde, 0), 0)
                    const pct   = total > 0 ? Math.round((Math.max(tr.solde, 0) / total) * 100) : 0
                    return (
                      <div key={i} className="flex items-center gap-3 p-3 rounded-xl" style={{ background: s.bg + '40' }}>
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: s.bg }}>
                          <div style={{ color: s.text }}>{s.icon}</div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-[12px] font-medium text-[#374151] truncate">{tr.nom}</div>
                          <div className="text-[10px] text-[#9CA3AF]">{pct}% du {t('common.total').toLowerCase()}</div>
                        </div>
                        <div className="text-[12px] font-bold shrink-0" style={{ color: s.text }}>{fmtShort(tr.solde)}</div>
                      </div>
                    )
                  })}
                  <div className="pt-2 border-t border-[#F3F4F6] flex justify-between text-[12px] font-bold text-[#374151]">
                    <span>{t('common.total')} liquidités</span>
                    <span>{fmtShort(treso.reduce((s, tr) => s + tr.solde, 0))} FCFA</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Score financier détaillé */}
          {score && !loading && (
            <div className="bg-white rounded-2xl border border-[#E5E7EB] p-5 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-[13px] font-semibold text-[#111827]">{t('finance.score')} de santé financière</h3>
                  <p className="text-[11px] text-[#9CA3AF]">Basé sur cashflow, trésorerie, créances et dettes</p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="text-[28px] font-black" style={{ color: scoreColor }}>{score.score}</div>
                  <div>
                    <div className="text-[12px] font-bold" style={{ color: scoreColor }}>{score.label}</div>
                    <div className="text-[10px] text-[#9CA3AF]">/ 100 pts</div>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {[
                  { label: t('finance.cashflow'), score: score.score_cashflow, max: 25 },
                  { label: t('finance.treso'), score: score.score_treso, max: 25 },
                  { label: t('finance.receivables'), score: score.score_creances, max: 25 },
                  { label: t('finance.payables'), score: score.score_dettes, max: 25 },
                ].map(item => {
                  const pct = Math.round((item.score / item.max) * 100)
                  const c = pct >= 80 ? '#10B981' : pct >= 60 ? '#3B82F6' : pct >= 40 ? '#F59E0B' : '#EF4444'
                  return (
                    <div key={item.label} className="bg-[#F9FAFB] rounded-xl p-3">
                      <div className="flex justify-between text-[11px] mb-2">
                        <span className="text-[#6B7280]">{item.label}</span>
                        <span className="font-bold" style={{ color: c }}>{item.score}/{item.max}</span>
                      </div>
                      <div className="h-1.5 bg-[#E5E7EB] rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: c }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Transactions récentes */}
          <SectionCard title="Dernières opérations" sub={`Toutes sources — ${recentTx.length} opérations`}
            action={
              <a href="/dashboard/tresorerie/historique" className="text-[11px] text-[#10B981] hover:underline font-medium flex items-center gap-0.5">
                {t('common.seeAll')} <ChevronRight size={12} />
              </a>
            }>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[#F9FAFB] text-[10px] text-[#6B7280] uppercase tracking-wider">
                    <th className="text-left px-5 py-3 font-medium">{t('common.date')}</th>
                    <th className="text-left px-4 py-3 font-medium">Libellé</th>
                    <th className="text-left px-4 py-3 font-medium hidden md:table-cell">Source</th>
                    <th className="text-left px-4 py-3 font-medium hidden lg:table-cell">Mode</th>
                    <th className="text-right px-5 py-3 font-medium">{t('common.amount')}</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? [...Array(6)].map((_, i) => (
                    <tr key={i} className="border-t border-[#F3F4F6]">
                      {[1,2,3,4,5].map(j => <td key={j} className="px-4 py-3"><div className="h-4 bg-[#F3F4F6] rounded animate-pulse" /></td>)}
                    </tr>
                  )) : recentTx.length === 0 ? (
                    <tr><td colSpan={5} className="text-center py-10 text-[12px] text-[#9CA3AF]">Aucune opération</td></tr>
                  ) : recentTx.map(tx => {
                    const srcColor = SOURCE_COLORS[
                      tx.source === 'facture' ? 'Facturation'
                      : tx.source?.includes('scolaire') || tx.source === 'ecole' ? 'École'
                      : tx.source?.includes('paie') || tx.source === 'salaire' ? 'RH & Paie'
                      : tx.source === 'achat' ? 'Achats'
                      : tx.source === 'depense' ? 'Dépenses'
                      : 'Manuel'
                    ] ?? '#94A3B8'
                    return (
                      <tr key={tx.id} className="border-t border-[#F3F4F6] hover:bg-[#F9FAFB] transition-colors">
                        <td className="px-5 py-3 text-[11px] text-[#6B7280] whitespace-nowrap">
                          {new Date(tx.date_operation).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}
                        </td>
                        <td className="px-4 py-3 max-w-[200px]">
                          <span className="text-[12px] text-[#111827] font-medium truncate block">{tx.libelle}</span>
                        </td>
                        <td className="px-4 py-3 hidden md:table-cell">
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ background: srcColor + '18', color: srcColor }}>
                            {tx.source ?? tx.categorie ?? '—'}
                          </span>
                        </td>
                        <td className="px-4 py-3 hidden lg:table-cell text-[11px] text-[#9CA3AF]">{tx.moyen_paiement ?? '—'}</td>
                        <td className="px-5 py-3 text-right whitespace-nowrap font-bold text-[13px]">
                          <span className={tx.type === 'entree' ? 'text-emerald-600' : tx.type === 'sortie' ? 'text-red-500' : 'text-blue-500'}>
                            {tx.type === 'entree' ? '+' : tx.type === 'sortie' ? '−' : '↔'} {fmt(tx.montant)}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </SectionCard>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          TAB : CASH FLOW
      ══════════════════════════════════════════════════════════════════ */}
      {tab === 'cashflow' && (
        <div className="space-y-5">

          {/* KPI cashflow */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard label={`${t('finance.entries')} YTD`}  icon={<ArrowUpRight size={16} />}  accent="#10B981" loading={loading}
              value={loading ? '—' : fmtShort(kpi?.ca_annee ?? 0) + ' FCFA'} />
            <KpiCard label={`${t('finance.exits')} YTD`}  icon={<ArrowDownRight size={16} />} accent="#EF4444" loading={loading}
              value={loading ? '—' : fmtShort(kpi?.dep_annee ?? 0) + ' FCFA'} />
            <KpiCard label={`${t('finance.net')} YTD`}      icon={<Activity size={16} />}
              accent={(kpi?.resultat_net ?? 0) >= 0 ? '#3B82F6' : '#F97316'} loading={loading}
              value={loading ? '—' : fmtShort(kpi?.resultat_net ?? 0) + ' FCFA'} />
            <KpiCard label={`${t('finance.cumul')} actuel`} icon={<BarChart2 size={16} />} accent="#8B5CF6" loading={loading}
              value={loading ? '—' : fmtShort(monthly[currentMonth]?.cumul ?? 0) + ' FCFA'}
              sub="Position cumulée" />
          </div>

          {/* BarChart cashflow + cumul */}
          <div className="bg-white rounded-2xl border border-[#E5E7EB] p-5 shadow-sm">
            <h3 className="text-[13px] font-semibold text-[#111827] mb-1">{t('finance.cashflow')} mensuel</h3>
            <p className="text-[11px] text-[#9CA3AF] mb-5">{t('finance.entries')} · {t('finance.exits')} · {t('finance.net')} mensuel · {t('finance.cumul')} progressif — {currentYear}</p>
            {loading ? <div className="h-72 bg-[#F9FAFB] rounded-xl animate-pulse" /> : (
              <ResponsiveContainer width="100%" height={280}>
                <ComposedChart data={monthly} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                  <XAxis dataKey="mois_label" tick={{ fontSize: 11, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#9CA3AF' }} axisLine={false} tickLine={false} tickFormatter={fmtShort} />
                  <Tooltip formatter={(v) => fmt(Number(v))}
                    contentStyle={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 12, fontSize: 12 }} />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
                  <ReferenceLine y={0} stroke="#E5E7EB" strokeWidth={1.5} />
                  <Bar dataKey="entrees" name={t('finance.entries')}   fill="#10B981" radius={[4,4,0,0]} opacity={0.85} />
                  <Bar dataKey="sorties" name={t('finance.exits')}   fill="#EF4444" radius={[4,4,0,0]} opacity={0.85} />
                  <Line type="monotone" dataKey="net"   name={`${t('finance.net')} mensuel`} stroke="#3B82F6" strokeWidth={2} dot={{ r: 3, fill: '#3B82F6' }} />
                  <Line type="monotone" dataKey="cumul" name={t('finance.cumul')}       stroke="#8B5CF6" strokeWidth={2} strokeDasharray="4 2" dot={false} />
                </ComposedChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Table récapitulatif mensuel */}
          <SectionCard title="Récapitulatif mensuel" sub={`Exercice ${currentYear}`}>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[#F9FAFB] text-[10px] text-[#6B7280] uppercase tracking-wider">
                    <th className="text-left px-5 py-3 font-medium">{t('common.month')}</th>
                    <th className="text-right px-4 py-3 font-medium">{t('finance.entries')}</th>
                    <th className="text-right px-4 py-3 font-medium">{t('finance.exits')}</th>
                    <th className="text-right px-4 py-3 font-medium">{t('finance.net')}</th>
                    <th className="text-right px-5 py-3 font-medium">{t('finance.cumul')}</th>
                  </tr>
                </thead>
                <tbody>
                  {monthly.map((m, i) => (
                    <tr key={i} className={`border-t border-[#F3F4F6] hover:bg-[#F9FAFB] ${i === currentMonth ? 'bg-blue-50/40' : ''}`}>
                      <td className="px-5 py-3 font-medium text-[#374151] text-[12px]">
                        {m.mois_label} {i === currentMonth && <span className="ml-1 text-[10px] text-blue-500 font-bold">◀ actuel</span>}
                      </td>
                      <td className="px-4 py-3 text-right text-emerald-600 font-medium text-[12px]">{fmt(m.entrees)}</td>
                      <td className="px-4 py-3 text-right text-red-500 font-medium text-[12px]">{fmt(m.sorties)}</td>
                      <td className={`px-4 py-3 text-right font-semibold text-[12px] ${m.net >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                        {m.net >= 0 ? '+' : ''}{fmt(m.net)}
                      </td>
                      <td className={`px-5 py-3 text-right font-bold text-[12px] ${m.cumul >= 0 ? 'text-[#1D4ED8]' : 'text-red-500'}`}>
                        {m.cumul >= 0 ? '+' : ''}{fmt(m.cumul)}
                      </td>
                    </tr>
                  ))}
                  {monthly.length > 0 && (
                    <tr className="border-t-2 border-[#E5E7EB] bg-[#F9FAFB] font-bold text-[12px]">
                      <td className="px-5 py-3 text-[#111827]">{t('common.total').toUpperCase()} {currentYear}</td>
                      <td className="px-4 py-3 text-right text-emerald-600">{fmt(monthly.reduce((s, m) => s + m.entrees, 0))}</td>
                      <td className="px-4 py-3 text-right text-red-500">{fmt(monthly.reduce((s, m) => s + m.sorties, 0))}</td>
                      <td className={`px-4 py-3 text-right ${(kpi?.resultat_net ?? 0) >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                        {fmt(kpi?.resultat_net ?? 0)}
                      </td>
                      <td className="px-5 py-3 text-right text-[#1D4ED8]">
                        {fmt(monthly[monthly.length - 1]?.cumul ?? 0)}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </SectionCard>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          TAB : SOURCES
      ══════════════════════════════════════════════════════════════════ */}
      {tab === 'sources' && (
        <div className="space-y-5">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

            {/* Sources de revenus */}
            <SectionCard title="Sources de revenus" sub={`${revenueSources.length} modules · ${fmt(totalCA)} ${t('common.total').toLowerCase()}`}>
              <div className="p-5 space-y-3">
                {loading ? [...Array(4)].map((_, i) => <div key={i} className="h-10 bg-[#F3F4F6] rounded-lg animate-pulse" />) : (
                  revenueSources.length === 0
                    ? <p className="text-[12px] text-[#9CA3AF] text-center py-6">Aucune entrée enregistrée</p>
                    : revenueSources.map((s, i) => {
                      const pct  = totalCA > 0 ? Math.round((s.total / totalCA) * 100) : 0
                      const color = SOURCE_COLORS[s.module_source] ?? '#94A3B8'
                      const icon  = SOURCE_ICONS[s.module_source] ?? <DollarSign size={13} />
                      return (
                        <div key={i}>
                          <div className="flex items-center justify-between text-[12px] mb-1.5">
                            <div className="flex items-center gap-1.5 font-medium text-[#374151]">
                              <span style={{ color }}>{icon}</span>
                              {s.module_source}
                              <span className="text-[10px] text-[#9CA3AF]">({s.nb_operations} op.)</span>
                            </div>
                            <span className="text-[#374151] font-semibold">{fmtShort(s.total)} FCFA <span className="text-[#9CA3AF] font-normal">({pct}%)</span></span>
                          </div>
                          <div className="h-2 bg-[#F3F4F6] rounded-full overflow-hidden">
                            <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
                          </div>
                        </div>
                      )
                    })
                )}
              </div>
            </SectionCard>

            {/* Sources de dépenses */}
            <SectionCard title="Origines des dépenses" sub={`${expenseSources.length} modules · ${fmt(totalDep)} ${t('common.total').toLowerCase()}`}>
              <div className="p-5 space-y-3">
                {loading ? [...Array(4)].map((_, i) => <div key={i} className="h-10 bg-[#F3F4F6] rounded-lg animate-pulse" />) : (
                  expenseSources.length === 0
                    ? <p className="text-[12px] text-[#9CA3AF] text-center py-6">Aucune sortie enregistrée</p>
                    : expenseSources.map((s, i) => {
                      const pct  = totalDep > 0 ? Math.round((s.total / totalDep) * 100) : 0
                      const color = SOURCE_COLORS[s.module_source] ?? '#94A3B8'
                      const icon  = SOURCE_ICONS[s.module_source] ?? <TrendingDown size={13} />
                      return (
                        <div key={i}>
                          <div className="flex items-center justify-between text-[12px] mb-1.5">
                            <div className="flex items-center gap-1.5 font-medium text-[#374151]">
                              <span style={{ color }}>{icon}</span>
                              {s.module_source}
                              <span className="text-[10px] text-[#9CA3AF]">({s.nb_operations} op.)</span>
                            </div>
                            <span className="text-[#374151] font-semibold">{fmtShort(s.total)} FCFA <span className="text-[#9CA3AF] font-normal">({pct}%)</span></span>
                          </div>
                          <div className="h-2 bg-[#F3F4F6] rounded-full overflow-hidden">
                            <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
                          </div>
                        </div>
                      )
                    })
                )}
              </div>
            </SectionCard>
          </div>

          {/* BarChart comparatif par module */}
          {!loading && sources.length > 0 && (
            <div className="bg-white rounded-2xl border border-[#E5E7EB] p-5 shadow-sm">
              <h3 className="text-[13px] font-semibold text-[#111827] mb-1">Comparatif {t('finance.entries').toLowerCase()} / {t('finance.exits').toLowerCase()} par module</h3>
              <p className="text-[11px] text-[#9CA3AF] mb-5">Vue consolidée de tous les flux par source — {currentYear}</p>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart
                  data={[
                    ...new Set(sources.map(s => s.module_source))
                  ].map(mod => ({
                    module: mod,
                    entrees: sources.find(s => s.module_source === mod && s.type_flux === 'entree')?.total ?? 0,
                    sorties: sources.find(s => s.module_source === mod && s.type_flux === 'sortie')?.total ?? 0,
                  })).filter(d => d.entrees > 0 || d.sorties > 0)}
                  margin={{ top: 4, right: 8, left: -20, bottom: 30 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                  <XAxis dataKey="module" tick={{ fontSize: 10, fill: '#9CA3AF' }} angle={-30} textAnchor="end" axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#9CA3AF' }} axisLine={false} tickLine={false} tickFormatter={fmtShort} />
                  <Tooltip formatter={(v) => fmt(Number(v))}
                    contentStyle={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 12, fontSize: 12 }} />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="entrees" name={t('finance.entries')} fill="#10B981" radius={[4,4,0,0]} />
                  <Bar dataKey="sorties" name={t('finance.exits')} fill="#EF4444" radius={[4,4,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Ventilation CA par source */}
          {kpi && !loading && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="bg-white rounded-2xl border border-[#E5E7EB] p-5 shadow-sm">
                <div className="flex items-center gap-2 mb-3">
                  <GraduationCap size={16} className="text-[#3B82F6]" />
                  <span className="text-[13px] font-semibold text-[#111827]">École</span>
                </div>
                <div className="text-[22px] font-bold text-[#111827]">{fmtShort(kpi.ca_ecole)} FCFA</div>
                <div className="text-[11px] text-[#9CA3AF] mt-1">
                  {kpi.ca_annee > 0 ? Math.round(kpi.ca_ecole / kpi.ca_annee * 100) : 0}% du CA {t('common.total').toLowerCase()}
                </div>
              </div>
              <div className="bg-white rounded-2xl border border-[#E5E7EB] p-5 shadow-sm">
                <div className="flex items-center gap-2 mb-3">
                  <FileText size={16} className="text-[#10B981]" />
                  <span className="text-[13px] font-semibold text-[#111827]">Facturation</span>
                </div>
                <div className="text-[22px] font-bold text-[#111827]">{fmtShort(kpi.ca_facturation)} FCFA</div>
                <div className="text-[11px] text-[#9CA3AF] mt-1">
                  {kpi.ca_annee > 0 ? Math.round(kpi.ca_facturation / kpi.ca_annee * 100) : 0}% du CA {t('common.total').toLowerCase()}
                </div>
              </div>
              <div className="bg-white rounded-2xl border border-[#E5E7EB] p-5 shadow-sm">
                <div className="flex items-center gap-2 mb-3">
                  <DollarSign size={16} className="text-[#94A3B8]" />
                  <span className="text-[13px] font-semibold text-[#111827]">Autres sources</span>
                </div>
                <div className="text-[22px] font-bold text-[#111827]">{fmtShort(kpi.ca_autres)} FCFA</div>
                <div className="text-[11px] text-[#9CA3AF] mt-1">
                  {kpi.ca_annee > 0 ? Math.round(kpi.ca_autres / kpi.ca_annee * 100) : 0}% du CA {t('common.total').toLowerCase()}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          TAB : PRÉVISIONS
      ══════════════════════════════════════════════════════════════════ */}
      {tab === 'previsions' && (
        <div className="space-y-5">
          {kpi && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <KpiCard label={`${t('finance.entries')} prévues (90j)`} icon={<ArrowUpRight size={16} />} accent="#10B981" loading={loading}
                value={fmtShort(kpi.previsions_entrees) + ' FCFA'} sub="Probabilité pondérée" />
              <KpiCard label={`${t('finance.exits')} prévues (90j)`} icon={<ArrowDownRight size={16} />} accent="#EF4444" loading={loading}
                value={fmtShort(kpi.previsions_sorties) + ' FCFA'} sub="Probabilité pondérée" />
              <KpiCard label={`${t('finance.net')} prévisionnel (90j)`} icon={<Target size={16} />}
                accent={kpi.previsions_net >= 0 ? '#3B82F6' : '#F97316'} loading={loading}
                value={fmtShort(kpi.previsions_net) + ' FCFA'} sub={`${t('finance.entries')} − ${t('finance.exits')} prévues`} />
            </div>
          )}

          <SectionCard title={`${t('finance.preview')} de trésorerie`} sub="30 prochaines opérations planifiées"
            action={
              <a href="/dashboard/tresorerie/previsions" className="text-[11px] text-[#10B981] hover:underline font-medium flex items-center gap-0.5">
                Gérer <ChevronRight size={12} />
              </a>
            }>
            {prevs.length === 0 ? (
              <div className="p-12 text-center">
                <Target size={32} className="text-[#E5E7EB] mx-auto mb-3" />
                <p className="text-[12px] text-[#9CA3AF]">Aucune prévision — créez-en dans le module Trésorerie</p>
                <a href="/dashboard/tresorerie/previsions"
                  className="inline-flex items-center gap-1 mt-3 text-[12px] text-[#10B981] font-medium hover:underline">
                  Ajouter des prévisions <ChevronRight size={12} />
                </a>
              </div>
            ) : (
              <div className="divide-y divide-[#F3F4F6]">
                {prevs.map(p => {
                  const isEntry = p.type === 'entree'
                  const probColor = p.probabilite >= 80 ? '#10B981' : p.probabilite >= 50 ? '#F59E0B' : '#EF4444'
                  const StatusIcon = p.statut === 'réalisé' ? CheckCircle : p.statut === 'annulé' ? XCircle : Info
                  return (
                    <div key={p.id} className="flex items-center gap-4 px-5 py-3">
                      <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${isEntry ? 'bg-emerald-400' : 'bg-red-400'}`} />
                      <div className="flex-1 min-w-0">
                        <div className="text-[12px] font-medium text-[#374151] truncate">{p.libelle}</div>
                        <div className="text-[10px] text-[#9CA3AF]">
                          {new Date(p.date_prevue).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}
                          {' · '}proba {p.probabilite}%
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <div className="text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ background: probColor + '18', color: probColor }}>
                          {p.probabilite}%
                        </div>
                        <div className={`text-[13px] font-bold ${isEntry ? 'text-emerald-600' : 'text-red-500'}`}>
                          {isEntry ? '+' : '−'}{fmtShort(p.montant)}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </SectionCard>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          TAB : TVA / FISCALITÉ
      ══════════════════════════════════════════════════════════════════ */}
      {tab === 'tva' && (
        <div className="space-y-5">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <KpiCard label={t('finance.vatCollected')} icon={<ArrowUpRight size={16} />} accent="#EF4444" loading={loading}
              value={loading ? '—' : fmtShort(kpi?.tva_collectee ?? 0) + ' FCFA'}
              sub={kpi?.tva_collectee === (kpi?.ca_annee ?? 0) * 0.18 ? 'Estimation (CA × 18%)' : 'Depuis déclarations'} />
            <KpiCard label={t('finance.vatDeductible')} icon={<ArrowDownRight size={16} />} accent="#10B981" loading={loading}
              value={loading ? '—' : fmtShort(kpi?.tva_deductible ?? 0) + ' FCFA'}
              sub="Sur achats et charges" />
            <KpiCard label={t('finance.vatNet')} icon={<DollarSign size={16} />} accent="#2563EB" loading={loading}
              value={loading ? '—' : fmtShort(kpi?.tva_nette ?? 0) + ' FCFA'}
              sub={`+ CA Congo 5% = ${fmtShort(kpi?.ca_taxe ?? 0)} FCFA`} />
          </div>

          {/* Tableau TVA mensuel */}
          <SectionCard title={`Estimation ${t('finance.vat')} mensuelle`} sub="Congo-Brazzaville : TVA 18% + Contribution d'appui 5%">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[#F9FAFB] text-[10px] text-[#6B7280] uppercase tracking-wider">
                    <th className="text-left px-5 py-3 font-medium">{t('common.month')}</th>
                    <th className="text-right px-4 py-3 font-medium">CA HT</th>
                    <th className="text-right px-4 py-3 font-medium">{t('finance.vatCollected')} 18%</th>
                    <th className="text-right px-4 py-3 font-medium">Charges HT</th>
                    <th className="text-right px-4 py-3 font-medium">{t('finance.vatDeductible')} 18%</th>
                    <th className="text-right px-4 py-3 font-medium">Solde {t('finance.vat')}</th>
                    <th className="text-right px-5 py-3 font-medium">CA 5%</th>
                  </tr>
                </thead>
                <tbody>
                  {monthly.map((m, i) => {
                    const tvaC = Math.round(m.entrees * 0.18)
                    const tvaD = Math.round(m.sorties * 0.18)
                    const sol  = tvaC - tvaD
                    const ca   = Math.round(sol * 0.05)
                    return (
                      <tr key={i} className={`border-t border-[#F3F4F6] hover:bg-[#F9FAFB] text-[12px] ${i === currentMonth ? 'bg-blue-50/30' : ''}`}>
                        <td className="px-5 py-3 font-medium text-[#374151]">{m.mois_label}</td>
                        <td className="px-4 py-3 text-right text-[#374151]">{fmt(m.entrees)}</td>
                        <td className="px-4 py-3 text-right text-red-500 font-medium">{fmt(tvaC)}</td>
                        <td className="px-4 py-3 text-right text-[#374151]">{fmt(m.sorties)}</td>
                        <td className="px-4 py-3 text-right text-emerald-600 font-medium">{fmt(tvaD)}</td>
                        <td className={`px-4 py-3 text-right font-semibold ${sol >= 0 ? 'text-[#1D4ED8]' : 'text-emerald-600'}`}>{fmt(sol)}</td>
                        <td className="px-5 py-3 text-right text-[#6B7280]">{fmt(ca)}</td>
                      </tr>
                    )
                  })}
                  {monthly.length > 0 && (
                    <tr className="border-t-2 border-[#E5E7EB] bg-[#F9FAFB] font-bold text-[12px]">
                      <td className="px-5 py-3 text-[#111827]">{t('common.total').toUpperCase()}</td>
                      <td className="px-4 py-3 text-right text-[#374151]">{fmt(kpi?.ca_annee ?? 0)}</td>
                      <td className="px-4 py-3 text-right text-red-500">{fmt(kpi?.tva_collectee ?? 0)}</td>
                      <td className="px-4 py-3 text-right text-[#374151]">{fmt(kpi?.dep_annee ?? 0)}</td>
                      <td className="px-4 py-3 text-right text-emerald-600">{fmt(kpi?.tva_deductible ?? 0)}</td>
                      <td className="px-4 py-3 text-right text-[#1D4ED8]">{fmt(kpi?.tva_nette ?? 0)}</td>
                      <td className="px-5 py-3 text-right text-[#6B7280]">{fmt(kpi?.ca_taxe ?? 0)}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </SectionCard>

          <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4 text-[11px] text-amber-800 flex gap-2">
            <AlertTriangle size={14} className="mt-0.5 shrink-0" />
            <div>
              <strong>Note fiscale Congo-Brazzaville :</strong> TVA 18% + Contribution d&apos;Appui (CA) = 5% × TVA nette.
              TTC = HT × 1,189. Pour une déclaration officielle, rapprochez avec vos factures réelles et consultez la DGI ou un expert-comptable agréé.
              <a href="/dashboard/comptabilite/tva" className="ml-1 font-semibold hover:underline">Voir les déclarations officielles →</a>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

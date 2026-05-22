'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useTenant } from '@/lib/hooks/useTenant'
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, PieChart, Pie, Cell,
} from 'recharts'
import {
  TrendingUp, TrendingDown, Minus,
  DollarSign, CreditCard, Wallet, Banknote,
  Building2, Smartphone, Users, ArrowUpRight,
  ArrowDownRight, RefreshCw, Calendar, Download,
  AlertCircle, CheckCircle2, Clock, ChevronRight,
} from 'lucide-react'

// ── Types ─────────────────────────────────────────────────────────────────────

type KpiData = {
  chiffreAffaires:      number
  chiffreAffairesMois:  number
  depensesTotal:        number
  depensesMois:         number
  resultatNet:          number
  soldeBanque:          number
  soldeCaisse:          number
  soldeMobile:          number
  creancesClients:      number
  dettesFournisseurs:   number
  tvaSolde:             number
  chargesSalariales:    number
  cashflowMois:         number
  // evolutions
  caEvol:    number  // % vs mois précédent
  depEvol:   number
  netEvol:   number
}

type MonthlyData = {
  mois: string
  produits: number
  charges: number
  resultat: number
}

type TresoData = {
  nom: string
  solde: number
  type: 'banque' | 'caisse' | 'mobile'
}

type RecentTx = {
  id: string
  date_operation: string
  libelle: string
  montant: number
  type: 'entree' | 'sortie' | 'transfert'
  categorie: string
  moyen_paiement: string
}

type TopCategorie = {
  name: string
  value: number
  color: string
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmt = (n: number) =>
  new Intl.NumberFormat('fr-CG', { style: 'decimal', maximumFractionDigits: 0 }).format(n) + ' FCFA'

const fmtShort = (n: number): string => {
  if (Math.abs(n) >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M'
  if (Math.abs(n) >= 1_000)     return (n / 1_000).toFixed(0) + 'k'
  return String(n)
}

const MONTH_LABELS = ['Jan','Fév','Mar','Avr','Mai','Jun','Jul','Aoû','Sep','Oct','Nov','Déc']

function getDiff(a: number, b: number): number {
  if (b === 0) return a > 0 ? 100 : 0
  return Math.round(((a - b) / Math.abs(b)) * 100)
}

// ── KPI Card ──────────────────────────────────────────────────────────────────

type KpiCardProps = {
  label: string
  value: string
  sub?: string
  evol?: number
  icon: React.ReactNode
  accent: string
  loading?: boolean
}

function KpiCard({ label, value, sub, evol, icon, accent, loading }: KpiCardProps) {
  return (
    <div className="bg-white rounded-2xl border border-[#E5E7EB] p-5 flex flex-col gap-3 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-[#6B7280] uppercase tracking-wider">{label}</span>
        <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: accent + '18' }}>
          <div style={{ color: accent }}>{icon}</div>
        </div>
      </div>
      {loading ? (
        <div className="h-8 rounded-lg bg-[#F3F4F6] animate-pulse w-3/4" />
      ) : (
        <div className="text-2xl font-bold text-[#111827] leading-tight tracking-tight">{value}</div>
      )}
      <div className="flex items-center gap-2">
        {evol !== undefined && (
          <span className={`flex items-center gap-0.5 text-xs font-semibold px-1.5 py-0.5 rounded-md ${
            evol > 0 ? 'bg-emerald-50 text-emerald-600' : evol < 0 ? 'bg-red-50 text-red-500' : 'bg-gray-100 text-[#6B7280]'
          }`}>
            {evol > 0 ? <ArrowUpRight size={12} /> : evol < 0 ? <ArrowDownRight size={12} /> : <Minus size={12} />}
            {Math.abs(evol)}%
          </span>
        )}
        {sub && <span className="text-xs text-[#9CA3AF]">{sub}</span>}
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function FinancePage() {
  const { tenantId } = useTenant()

  const [kpi,       setKpi]       = useState<KpiData | null>(null)
  const [monthly,   setMonthly]   = useState<MonthlyData[]>([])
  const [treso,     setTreso]     = useState<TresoData[]>([])
  const [recentTx,  setRecentTx]  = useState<RecentTx[]>([])
  const [topDepCat, setTopDepCat] = useState<TopCategorie[]>([])
  const [topProCat, setTopProCat] = useState<TopCategorie[]>([])
  const [loading,   setLoading]   = useState(true)
  const [activeTab, setActiveTab] = useState<'apercu' | 'cashflow' | 'tiers' | 'tva'>('apercu')

  const currentYear  = new Date().getFullYear()
  const currentMonth = new Date().getMonth() // 0-indexed

  const load = useCallback(async () => {
    if (!tenantId) return
    setLoading(true)

    const startYear  = `${currentYear}-01-01`
    const endYear    = `${currentYear}-12-31`
    const startMonth = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-01`
    const endMonth   = new Date(currentYear, currentMonth + 1, 0).toISOString().split('T')[0]
    const startPrev  = `${currentYear}-${String(currentMonth).padStart(2, '0')}-01`
    const endPrev    = new Date(currentYear, currentMonth, 0).toISOString().split('T')[0]

    // ── Parallel fetches ──────────────────────────────────────────────────────
    const [
      { data: txYear },
      { data: txMonth },
      { data: txPrev },
      { data: banques },
      { data: caisses },
      { data: depenses },
    ] = await Promise.all([
      supabase
        .from('transactions')
        .select('type, montant, categorie, moyen_paiement, date_operation, libelle, id')
        .eq('tenant_id', tenantId)
        .gte('date_operation', startYear)
        .lte('date_operation', endYear)
        .order('date_operation', { ascending: false }),
      supabase
        .from('transactions')
        .select('type, montant, categorie, moyen_paiement')
        .eq('tenant_id', tenantId)
        .gte('date_operation', startMonth)
        .lte('date_operation', endMonth),
      supabase
        .from('transactions')
        .select('type, montant')
        .eq('tenant_id', tenantId)
        .gte('date_operation', startPrev)
        .lte('date_operation', endPrev),
      supabase
        .from('comptes_bancaires')
        .select('nom, solde')
        .eq('tenant_id', tenantId)
        .eq('actif', true),
      supabase
        .from('caisses')
        .select('nom, solde')
        .eq('tenant_id', tenantId)
        .eq('actif', true),
      supabase
        .from('depenses')
        .select('montant, categorie, statut')
        .eq('tenant_id', tenantId)
        .gte('date_depense', startYear)
        .lte('date_depense', endYear),
    ])

    // ── Agrégats annuels ──────────────────────────────────────────────────────
    const allTx = txYear ?? []
    const caTotal      = allTx.filter(t => t.type === 'entree').reduce((s, t) => s + t.montant, 0)
    const depTotal     = allTx.filter(t => t.type === 'sortie').reduce((s, t) => s + t.montant, 0)
    const resultatNet  = caTotal - depTotal

    // ── Mois courant ──────────────────────────────────────────────────────────
    const moisTx = txMonth ?? []
    const caMois  = moisTx.filter(t => t.type === 'entree').reduce((s, t) => s + t.montant, 0)
    const depMois = moisTx.filter(t => t.type === 'sortie').reduce((s, t) => s + t.montant, 0)

    // ── Mois précédent ────────────────────────────────────────────────────────
    const prevTx = txPrev ?? []
    const caPrev  = prevTx.filter(t => t.type === 'entree').reduce((s, t) => s + t.montant, 0)
    const depPrev = prevTx.filter(t => t.type === 'sortie').reduce((s, t) => s + t.montant, 0)

    // ── Trésorerie par type ───────────────────────────────────────────────────
    const soldeBanque  = (banques  ?? []).reduce((s: number, b: { solde: number }) => s + (b.solde ?? 0), 0)
    const soldeCaisse  = (caisses  ?? []).reduce((s: number, c: { solde: number }) => s + (c.solde ?? 0), 0)

    // Mobile money from transactions moyen_paiement='mobile_money'
    const soldeMobile  = allTx
      .filter(t => t.moyen_paiement === 'mobile_money')
      .reduce((s, t) => s + (t.type === 'entree' ? t.montant : -t.montant), 0)

    // ── TVA (simple: entrées × 18% - sorties TVA déductible) ─────────────────
    const tvaCollectee  = caTotal * 0.18
    const tvaDed        = depTotal * 0.18
    const tvaSolde      = tvaCollectee - tvaDed

    // ── Charges salariales from transactions ──────────────────────────────────
    const chargesSalariales = allTx
      .filter(t => t.type === 'sortie' && (t.categorie?.toLowerCase().includes('salaire') || t.categorie?.toLowerCase().includes('rémunér') || t.categorie === 'CNSS'))
      .reduce((s, t) => s + t.montant, 0)

    // ── Créances clients (factures non payées) ────────────────────────────────
    const { data: factures } = await supabase
      .from('factures')
      .select('total, statut')
      .eq('tenant_id', tenantId)
      .in('statut', ['envoyee', 'partielle', 'en_attente', 'retard'])

    const creancesClients = (factures ?? []).reduce((s: number, f: { total: number }) => s + (f.total ?? 0), 0)

    // ── Dettes fournisseurs ───────────────────────────────────────────────────
    const { data: bonsCmd } = await supabase
      .from('bons_commande')
      .select('montant_total, statut')
      .eq('tenant_id', tenantId)
      .in('statut', ['en_attente', 'recu_partiel'])

    const dettesFournisseurs = (bonsCmd ?? []).reduce((s: number, b: { montant_total: number }) => s + (b.montant_total ?? 0), 0)

    setKpi({
      chiffreAffaires:     caTotal,
      chiffreAffairesMois: caMois,
      depensesTotal:       depTotal,
      depensesMois:        depMois,
      resultatNet,
      soldeBanque,
      soldeCaisse,
      soldeMobile,
      creancesClients,
      dettesFournisseurs,
      tvaSolde,
      chargesSalariales,
      cashflowMois:        caMois - depMois,
      caEvol:              getDiff(caMois, caPrev),
      depEvol:             getDiff(depMois, depPrev),
      netEvol:             getDiff(caMois - depMois, caPrev - depPrev),
    })

    // ── Données mensuelles ────────────────────────────────────────────────────
    const byMonth: Record<number, { produits: number; charges: number }> = {}
    for (let i = 0; i <= currentMonth; i++) byMonth[i] = { produits: 0, charges: 0 }

    for (const t of allTx) {
      const m = new Date(t.date_operation).getMonth()
      if (m in byMonth) {
        if (t.type === 'entree')  byMonth[m].produits += t.montant
        if (t.type === 'sortie')  byMonth[m].charges  += t.montant
      }
    }

    setMonthly(
      Object.entries(byMonth).map(([mi, v]) => ({
        mois:     MONTH_LABELS[Number(mi)],
        produits: Math.round(v.produits),
        charges:  Math.round(v.charges),
        resultat: Math.round(v.produits - v.charges),
      }))
    )

    // ── Soldes trésorerie ──────────────────────────────────────────────────────
    const tresoArr: TresoData[] = [
      ...(banques ?? []).map((b: { nom: string; solde: number }) => ({
        nom: b.nom, solde: b.solde ?? 0, type: 'banque' as const,
      })),
      ...(caisses ?? []).map((c: { nom: string; solde: number }) => ({
        nom: c.nom, solde: c.solde ?? 0, type: 'caisse' as const,
      })),
      ...(soldeMobile !== 0 ? [{ nom: 'Mobile Money', solde: soldeMobile, type: 'mobile' as const }] : []),
    ]
    setTreso(tresoArr)

    // ── Transactions récentes ─────────────────────────────────────────────────
    setRecentTx(
      allTx.slice(0, 12).map(t => ({
        id:             t.id,
        date_operation: t.date_operation,
        libelle:        t.libelle,
        montant:        t.montant,
        type:           t.type as 'entree' | 'sortie' | 'transfert',
        categorie:      t.categorie,
        moyen_paiement: t.moyen_paiement,
      }))
    )

    // ── Top catégories dépenses ───────────────────────────────────────────────
    const catMap: Record<string, number> = {}
    for (const t of allTx.filter(x => x.type === 'sortie')) {
      catMap[t.categorie] = (catMap[t.categorie] ?? 0) + t.montant
    }
    const DEP_COLORS = ['#EF4444','#F97316','#F59E0B','#8B5CF6','#6B7280']
    setTopDepCat(
      Object.entries(catMap)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5)
        .map(([name, value], i) => ({ name, value, color: DEP_COLORS[i] }))
    )

    // ── Top catégories produits ───────────────────────────────────────────────
    const proMap: Record<string, number> = {}
    for (const t of allTx.filter(x => x.type === 'entree')) {
      proMap[t.categorie] = (proMap[t.categorie] ?? 0) + t.montant
    }
    const PRO_COLORS = ['#10B981','#3B82F6','#06B6D4','#84CC16','#A78BFA']
    setTopProCat(
      Object.entries(proMap)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5)
        .map(([name, value], i) => ({ name, value, color: PRO_COLORS[i] }))
    )

    setLoading(false)
  }, [tenantId, currentYear, currentMonth])

  useEffect(() => { load() }, [load])

  const TRESO_COLORS = {
    banque: { bg: '#DBEAFE', text: '#1D4ED8', icon: Building2 },
    caisse: { bg: '#D1FAE5', text: '#065F46', icon: Wallet },
    mobile: { bg: '#FEF3C7', text: '#92400E', icon: Smartphone },
  }

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#111827] tracking-tight">Finance</h1>
          <p className="text-sm text-[#6B7280] mt-0.5">
            Tableau de bord financier — exercice {currentYear}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-[#9CA3AF] flex items-center gap-1">
            <Calendar size={13} />
            {MONTH_LABELS[currentMonth]} {currentYear}
          </span>
          <button
            onClick={load}
            disabled={loading}
            className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-white border border-[#E5E7EB] text-[#374151] hover:bg-[#F9FAFB] transition-colors disabled:opacity-50"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            Actualiser
          </button>
          <button className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-[#F59E0B] text-white hover:bg-[#D97706] transition-colors">
            <Download size={13} />
            Exporter
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-[#F3F4F6] rounded-xl p-1 w-fit">
        {(['apercu', 'cashflow', 'tiers', 'tva'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
              activeTab === tab
                ? 'bg-white text-[#111827] shadow-sm'
                : 'text-[#6B7280] hover:text-[#374151]'
            }`}
          >
            {tab === 'apercu' ? 'Vue d\'ensemble' : tab === 'cashflow' ? 'Cash flow' : tab === 'tiers' ? 'Tiers' : 'TVA / Fiscalité'}
          </button>
        ))}
      </div>

      {/* ── APERCU ──────────────────────────────────────────────────────────── */}
      {activeTab === 'apercu' && (
        <div className="space-y-6">

          {/* KPI row 1 — P&L */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard
              label="Chiffre d'affaires"
              value={loading ? '—' : fmtShort(kpi?.chiffreAffaires ?? 0) + ' FCFA'}
              sub={`${fmtShort(kpi?.chiffreAffairesMois ?? 0)} ce mois`}
              evol={kpi?.caEvol}
              icon={<TrendingUp size={16} />}
              accent="#10B981"
              loading={loading}
            />
            <KpiCard
              label="Dépenses totales"
              value={loading ? '—' : fmtShort(kpi?.depensesTotal ?? 0) + ' FCFA'}
              sub={`${fmtShort(kpi?.depensesMois ?? 0)} ce mois`}
              evol={kpi?.depEvol}
              icon={<TrendingDown size={16} />}
              accent="#EF4444"
              loading={loading}
            />
            <KpiCard
              label="Résultat net"
              value={loading ? '—' : fmtShort(kpi?.resultatNet ?? 0) + ' FCFA'}
              sub="Produits − Charges"
              evol={kpi?.netEvol}
              icon={<DollarSign size={16} />}
              accent={(kpi?.resultatNet ?? 0) >= 0 ? '#10B981' : '#EF4444'}
              loading={loading}
            />
            <KpiCard
              label="Cash flow du mois"
              value={loading ? '—' : fmtShort(kpi?.cashflowMois ?? 0) + ' FCFA'}
              sub="Entrées − Sorties"
              icon={<ArrowUpRight size={16} />}
              accent={(kpi?.cashflowMois ?? 0) >= 0 ? '#3B82F6' : '#F97316'}
              loading={loading}
            />
          </div>

          {/* KPI row 2 — Trésorerie */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard
              label="Solde banque"
              value={loading ? '—' : fmtShort(kpi?.soldeBanque ?? 0) + ' FCFA'}
              icon={<Building2 size={16} />}
              accent="#3B82F6"
              loading={loading}
            />
            <KpiCard
              label="Solde caisse"
              value={loading ? '—' : fmtShort(kpi?.soldeCaisse ?? 0) + ' FCFA'}
              icon={<Wallet size={16} />}
              accent="#10B981"
              loading={loading}
            />
            <KpiCard
              label="Mobile Money"
              value={loading ? '—' : fmtShort(kpi?.soldeMobile ?? 0) + ' FCFA'}
              icon={<Smartphone size={16} />}
              accent="#F59E0B"
              loading={loading}
            />
            <KpiCard
              label="Charges salariales"
              value={loading ? '—' : fmtShort(kpi?.chargesSalariales ?? 0) + ' FCFA'}
              sub="Exercice en cours"
              icon={<Users size={16} />}
              accent="#8B5CF6"
              loading={loading}
            />
          </div>

          {/* Row 3 — créances / dettes */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

            {/* Créances clients */}
            <div className="bg-white rounded-2xl border border-[#E5E7EB] p-5 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm font-semibold text-[#111827]">Créances clients</span>
                <span className="text-xs bg-amber-50 text-amber-600 border border-amber-200 px-2 py-0.5 rounded-lg font-medium">
                  À encaisser
                </span>
              </div>
              {loading ? (
                <div className="h-10 bg-[#F3F4F6] rounded-lg animate-pulse" />
              ) : (
                <>
                  <div className="text-3xl font-bold text-[#111827] mb-1">
                    {fmtShort(kpi?.creancesClients ?? 0)} FCFA
                  </div>
                  <p className="text-xs text-[#9CA3AF]">Factures envoyées non réglées</p>
                  {(kpi?.creancesClients ?? 0) > 0 && (
                    <div className="mt-3 flex items-center gap-1.5 text-xs text-amber-600 bg-amber-50 rounded-lg px-2 py-1.5">
                      <Clock size={12} />
                      Relances à prévoir
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Dettes fournisseurs */}
            <div className="bg-white rounded-2xl border border-[#E5E7EB] p-5 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm font-semibold text-[#111827]">Dettes fournisseurs</span>
                <span className="text-xs bg-red-50 text-red-500 border border-red-200 px-2 py-0.5 rounded-lg font-medium">
                  À régler
                </span>
              </div>
              {loading ? (
                <div className="h-10 bg-[#F3F4F6] rounded-lg animate-pulse" />
              ) : (
                <>
                  <div className="text-3xl font-bold text-[#111827] mb-1">
                    {fmtShort(kpi?.dettesFournisseurs ?? 0)} FCFA
                  </div>
                  <p className="text-xs text-[#9CA3AF]">Bons de commande en attente</p>
                  {(kpi?.dettesFournisseurs ?? 0) > 0 && (
                    <div className="mt-3 flex items-center gap-1.5 text-xs text-red-500 bg-red-50 rounded-lg px-2 py-1.5">
                      <AlertCircle size={12} />
                      Règlements à planifier
                    </div>
                  )}
                </>
              )}
            </div>

            {/* TVA nette */}
            <div className="bg-white rounded-2xl border border-[#E5E7EB] p-5 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm font-semibold text-[#111827]">TVA nette estimée</span>
                <span className="text-xs bg-blue-50 text-blue-600 border border-blue-200 px-2 py-0.5 rounded-lg font-medium">
                  18% + CA 5%
                </span>
              </div>
              {loading ? (
                <div className="h-10 bg-[#F3F4F6] rounded-lg animate-pulse" />
              ) : (
                <>
                  <div className={`text-3xl font-bold mb-1 ${(kpi?.tvaSolde ?? 0) >= 0 ? 'text-[#111827]' : 'text-red-500'}`}>
                    {fmtShort(kpi?.tvaSolde ?? 0)} FCFA
                  </div>
                  <p className="text-xs text-[#9CA3AF]">TVA collectée − TVA déductible</p>
                  {(kpi?.tvaSolde ?? 0) > 0 && (
                    <div className="mt-3 flex items-center gap-1.5 text-xs text-blue-600 bg-blue-50 rounded-lg px-2 py-1.5">
                      <AlertCircle size={12} />
                      À déclarer à la DGI
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Charts row */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

            {/* Évolution mensuelle */}
            <div className="lg:col-span-2 bg-white rounded-2xl border border-[#E5E7EB] p-5 shadow-sm">
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h3 className="text-sm font-semibold text-[#111827]">Évolution mensuelle</h3>
                  <p className="text-xs text-[#9CA3AF]">Produits vs Charges vs Résultat</p>
                </div>
              </div>
              {loading ? (
                <div className="h-56 bg-[#F9FAFB] rounded-xl animate-pulse" />
              ) : monthly.length === 0 ? (
                <div className="h-56 flex items-center justify-center text-sm text-[#9CA3AF]">Aucune donnée</div>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <AreaChart data={monthly} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="gradProduits" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor="#10B981" stopOpacity={0.15} />
                        <stop offset="95%" stopColor="#10B981" stopOpacity={0}    />
                      </linearGradient>
                      <linearGradient id="gradCharges" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor="#EF4444" stopOpacity={0.12} />
                        <stop offset="95%" stopColor="#EF4444" stopOpacity={0}    />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                    <XAxis dataKey="mois" tick={{ fontSize: 11, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: '#9CA3AF' }} axisLine={false} tickLine={false} tickFormatter={fmtShort} />
                    <Tooltip
                      formatter={(v) => fmt(Number(v))}
                      contentStyle={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 12, fontSize: 12 }}
                    />
                    <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
                    <Area type="monotone" dataKey="produits" name="Produits" stroke="#10B981" strokeWidth={2} fill="url(#gradProduits)" />
                    <Area type="monotone" dataKey="charges"  name="Charges"  stroke="#EF4444" strokeWidth={2} fill="url(#gradCharges)"  />
                    <Line  type="monotone" dataKey="resultat" name="Résultat" stroke="#3B82F6" strokeWidth={2} dot={{ r: 3 }} />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Répartition trésorerie */}
            <div className="bg-white rounded-2xl border border-[#E5E7EB] p-5 shadow-sm">
              <h3 className="text-sm font-semibold text-[#111827] mb-1">Trésorerie</h3>
              <p className="text-xs text-[#9CA3AF] mb-4">Répartition par compte</p>
              {loading ? (
                <div className="space-y-2">
                  {[1,2,3].map(i => <div key={i} className="h-12 bg-[#F3F4F6] rounded-lg animate-pulse" />)}
                </div>
              ) : treso.length === 0 ? (
                <p className="text-sm text-[#9CA3AF] text-center py-8">Aucun compte configuré</p>
              ) : (
                <div className="space-y-2">
                  {treso.map((t, i) => {
                    const style = TRESO_COLORS[t.type]
                    const Icon  = style.icon
                    const total = treso.reduce((s, x) => s + Math.max(x.solde, 0), 0)
                    const pct   = total > 0 ? Math.round((Math.max(t.solde, 0) / total) * 100) : 0
                    return (
                      <div key={i} className="flex items-center gap-3 p-3 rounded-xl" style={{ background: style.bg + '40' }}>
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: style.bg }}>
                          <Icon size={15} style={{ color: style.text }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-medium text-[#374151] truncate">{t.nom}</div>
                          <div className="text-[10px] text-[#9CA3AF]">{pct}% du total</div>
                        </div>
                        <div className="text-sm font-semibold shrink-0" style={{ color: style.text }}>
                          {fmtShort(t.solde)}
                        </div>
                      </div>
                    )
                  })}
                  <div className="pt-1 border-t border-[#F3F4F6] flex justify-between text-xs font-semibold text-[#374151]">
                    <span>Total liquidités</span>
                    <span>{fmtShort(treso.reduce((s, t) => s + t.solde, 0))} FCFA</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Row — Top catégories + transactions récentes */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

            {/* Top dépenses */}
            <div className="bg-white rounded-2xl border border-[#E5E7EB] p-5 shadow-sm">
              <h3 className="text-sm font-semibold text-[#111827] mb-4">Top dépenses par catégorie</h3>
              {loading ? (
                <div className="space-y-2">{[1,2,3,4,5].map(i => <div key={i} className="h-8 bg-[#F3F4F6] rounded animate-pulse" />)}</div>
              ) : topDepCat.length === 0 ? (
                <p className="text-sm text-[#9CA3AF] text-center py-6">Aucune dépense enregistrée</p>
              ) : (
                <div className="space-y-2">
                  {topDepCat.map((c, i) => {
                    const total = topDepCat.reduce((s, x) => s + x.value, 0)
                    const pct   = total > 0 ? Math.round((c.value / total) * 100) : 0
                    return (
                      <div key={i}>
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="text-[#374151] font-medium truncate max-w-[60%]">{c.name || 'Non classé'}</span>
                          <span className="text-[#6B7280]">{fmtShort(c.value)} FCFA ({pct}%)</span>
                        </div>
                        <div className="h-1.5 bg-[#F3F4F6] rounded-full overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${pct}%`, background: c.color }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Top produits */}
            <div className="bg-white rounded-2xl border border-[#E5E7EB] p-5 shadow-sm">
              <h3 className="text-sm font-semibold text-[#111827] mb-4">Top sources de revenus</h3>
              {loading ? (
                <div className="space-y-2">{[1,2,3,4,5].map(i => <div key={i} className="h-8 bg-[#F3F4F6] rounded animate-pulse" />)}</div>
              ) : topProCat.length === 0 ? (
                <p className="text-sm text-[#9CA3AF] text-center py-6">Aucun produit enregistré</p>
              ) : (
                <div className="space-y-2">
                  {topProCat.map((c, i) => {
                    const total = topProCat.reduce((s, x) => s + x.value, 0)
                    const pct   = total > 0 ? Math.round((c.value / total) * 100) : 0
                    return (
                      <div key={i}>
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="text-[#374151] font-medium truncate max-w-[60%]">{c.name || 'Non classé'}</span>
                          <span className="text-[#6B7280]">{fmtShort(c.value)} FCFA ({pct}%)</span>
                        </div>
                        <div className="h-1.5 bg-[#F3F4F6] rounded-full overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${pct}%`, background: c.color }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Transactions récentes */}
          <div className="bg-white rounded-2xl border border-[#E5E7EB] shadow-sm overflow-hidden">
            <div className="flex items-center justify-between p-5 border-b border-[#F3F4F6]">
              <h3 className="text-sm font-semibold text-[#111827]">Dernières opérations</h3>
              <a href="/dashboard/tresorerie" className="text-xs text-[#F59E0B] hover:underline font-medium flex items-center gap-0.5">
                Voir tout <ChevronRight size={12} />
              </a>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[#F9FAFB] text-xs text-[#6B7280] uppercase tracking-wider">
                    <th className="text-left px-5 py-3 font-medium">Date</th>
                    <th className="text-left px-4 py-3 font-medium">Libellé</th>
                    <th className="text-left px-4 py-3 font-medium hidden md:table-cell">Catégorie</th>
                    <th className="text-left px-4 py-3 font-medium hidden lg:table-cell">Mode</th>
                    <th className="text-right px-5 py-3 font-medium">Montant</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    [...Array(6)].map((_, i) => (
                      <tr key={i} className="border-t border-[#F3F4F6]">
                        {[1,2,3,4,5].map(j => (
                          <td key={j} className="px-4 py-3">
                            <div className="h-4 bg-[#F3F4F6] rounded animate-pulse" />
                          </td>
                        ))}
                      </tr>
                    ))
                  ) : recentTx.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="text-center py-10 text-[#9CA3AF] text-sm">
                        Aucune opération cette année
                      </td>
                    </tr>
                  ) : (
                    recentTx.map(tx => (
                      <tr key={tx.id} className="border-t border-[#F3F4F6] hover:bg-[#F9FAFB] transition-colors">
                        <td className="px-5 py-3 text-xs text-[#6B7280] whitespace-nowrap">
                          {new Date(tx.date_operation).toLocaleDateString('fr-CG', { day: '2-digit', month: 'short' })}
                        </td>
                        <td className="px-4 py-3 max-w-[200px]">
                          <span className="text-[#111827] font-medium truncate block">{tx.libelle}</span>
                        </td>
                        <td className="px-4 py-3 hidden md:table-cell">
                          <span className="text-xs text-[#6B7280] bg-[#F3F4F6] px-2 py-0.5 rounded-md">{tx.categorie}</span>
                        </td>
                        <td className="px-4 py-3 hidden lg:table-cell">
                          <span className="text-xs text-[#9CA3AF]">{tx.moyen_paiement ?? '—'}</span>
                        </td>
                        <td className="px-5 py-3 text-right whitespace-nowrap font-semibold">
                          <span className={tx.type === 'entree' ? 'text-emerald-600' : tx.type === 'sortie' ? 'text-red-500' : 'text-blue-500'}>
                            {tx.type === 'entree' ? '+' : tx.type === 'sortie' ? '−' : '↔'} {fmt(tx.montant)}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── CASHFLOW ────────────────────────────────────────────────────────── */}
      {activeTab === 'cashflow' && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-[#E5E7EB] p-5 shadow-sm">
            <h3 className="text-sm font-semibold text-[#111827] mb-1">Flux de trésorerie mensuel</h3>
            <p className="text-xs text-[#9CA3AF] mb-5">Entrées nettes par mois — exercice {currentYear}</p>
            {loading ? (
              <div className="h-72 bg-[#F9FAFB] rounded-xl animate-pulse" />
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={monthly} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                  <XAxis dataKey="mois" tick={{ fontSize: 11, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#9CA3AF' }} axisLine={false} tickLine={false} tickFormatter={fmtShort} />
                  <Tooltip
                    formatter={(v) => fmt(Number(v))}
                    contentStyle={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 12, fontSize: 12 }}
                  />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="produits" name="Entrées"  fill="#10B981" radius={[4,4,0,0]} />
                  <Bar dataKey="charges"  name="Sorties"  fill="#EF4444" radius={[4,4,0,0]} />
                  <Bar dataKey="resultat" name="Net"      fill="#3B82F6" radius={[4,4,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Résumé mensuel */}
          <div className="bg-white rounded-2xl border border-[#E5E7EB] shadow-sm overflow-hidden">
            <div className="p-5 border-b border-[#F3F4F6]">
              <h3 className="text-sm font-semibold text-[#111827]">Récapitulatif par mois</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[#F9FAFB] text-xs text-[#6B7280] uppercase tracking-wider">
                    <th className="text-left px-5 py-3 font-medium">Mois</th>
                    <th className="text-right px-4 py-3 font-medium">Produits</th>
                    <th className="text-right px-4 py-3 font-medium">Charges</th>
                    <th className="text-right px-5 py-3 font-medium">Résultat net</th>
                  </tr>
                </thead>
                <tbody>
                  {monthly.map((m, i) => (
                    <tr key={i} className="border-t border-[#F3F4F6] hover:bg-[#F9FAFB]">
                      <td className="px-5 py-3 font-medium text-[#374151]">{m.mois}</td>
                      <td className="px-4 py-3 text-right text-emerald-600 font-medium">{fmt(m.produits)}</td>
                      <td className="px-4 py-3 text-right text-red-500 font-medium">{fmt(m.charges)}</td>
                      <td className={`px-5 py-3 text-right font-semibold ${m.resultat >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                        {m.resultat >= 0 ? '+' : ''}{fmt(m.resultat)}
                      </td>
                    </tr>
                  ))}
                  {monthly.length > 0 && (
                    <tr className="border-t-2 border-[#E5E7EB] bg-[#F9FAFB] font-semibold text-sm">
                      <td className="px-5 py-3 text-[#111827]">TOTAL {currentYear}</td>
                      <td className="px-4 py-3 text-right text-emerald-600">{fmt(monthly.reduce((s, m) => s + m.produits, 0))}</td>
                      <td className="px-4 py-3 text-right text-red-500">{fmt(monthly.reduce((s, m) => s + m.charges, 0))}</td>
                      <td className={`px-5 py-3 text-right ${(kpi?.resultatNet ?? 0) >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                        {(kpi?.resultatNet ?? 0) >= 0 ? '+' : ''}{fmt(kpi?.resultatNet ?? 0)}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── TIERS ────────────────────────────────────────────────────────────── */}
      {activeTab === 'tiers' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="bg-white rounded-2xl border border-[#E5E7EB] p-5 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-[#111827]">Clients — Créances</h3>
                <span className="text-xs bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-lg">
                  {fmt(kpi?.creancesClients ?? 0)}
                </span>
              </div>
              <p className="text-sm text-[#6B7280]">
                Accédez à la liste des clients avec leurs soldes et historiques via le module Facturation.
              </p>
              <a href="/dashboard/facturation" className="mt-4 flex items-center gap-1 text-xs text-[#F59E0B] font-medium hover:underline">
                Gérer les clients <ChevronRight size={12} />
              </a>
            </div>
            <div className="bg-white rounded-2xl border border-[#E5E7EB] p-5 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-[#111827]">Fournisseurs — Dettes</h3>
                <span className="text-xs bg-red-50 text-red-500 border border-red-200 px-2 py-0.5 rounded-lg">
                  {fmt(kpi?.dettesFournisseurs ?? 0)}
                </span>
              </div>
              <p className="text-sm text-[#6B7280]">
                Accédez à la liste des fournisseurs avec leurs soldes et historiques via le module Achats.
              </p>
              <a href="/dashboard/achats" className="mt-4 flex items-center gap-1 text-xs text-[#F59E0B] font-medium hover:underline">
                Gérer les fournisseurs <ChevronRight size={12} />
              </a>
            </div>
          </div>
          <div className="bg-blue-50 border border-blue-100 rounded-2xl p-5 text-sm text-blue-700">
            <div className="flex items-start gap-2">
              <AlertCircle size={16} className="mt-0.5 shrink-0" />
              <div>
                <strong>Module Tiers en cours de déploiement.</strong> La gestion avancée des tiers (clients, fournisseurs, partenaires)
                avec comptes OHADA liés, balances âgées et historique complet sera disponible prochainement.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── TVA ──────────────────────────────────────────────────────────────── */}
      {activeTab === 'tva' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <KpiCard
              label="TVA collectée (estimée)"
              value={loading ? '—' : fmtShort((kpi?.chiffreAffaires ?? 0) * 0.18) + ' FCFA'}
              sub="CA × 18%"
              icon={<ArrowUpRight size={16} />}
              accent="#EF4444"
              loading={loading}
            />
            <KpiCard
              label="TVA déductible (estimée)"
              value={loading ? '—' : fmtShort((kpi?.depensesTotal ?? 0) * 0.18) + ' FCFA'}
              sub="Achats × 18%"
              icon={<ArrowDownRight size={16} />}
              accent="#10B981"
              loading={loading}
            />
            <KpiCard
              label="TVA nette à reverser"
              value={loading ? '—' : fmtShort(kpi?.tvaSolde ?? 0) + ' FCFA'}
              sub="Collectée − Déductible"
              icon={<DollarSign size={16} />}
              accent={(kpi?.tvaSolde ?? 0) >= 0 ? '#3B82F6' : '#10B981'}
              loading={loading}
            />
          </div>

          {/* Tableau TVA mensuel */}
          <div className="bg-white rounded-2xl border border-[#E5E7EB] shadow-sm overflow-hidden">
            <div className="p-5 border-b border-[#F3F4F6]">
              <h3 className="text-sm font-semibold text-[#111827]">Déclarations TVA mensuelles</h3>
              <p className="text-xs text-[#9CA3AF] mt-0.5">Taux Congo-Brazzaville : TVA 18% + Contribution d&apos;appui 5% sur TVA</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[#F9FAFB] text-xs text-[#6B7280] uppercase tracking-wider">
                    <th className="text-left px-5 py-3 font-medium">Mois</th>
                    <th className="text-right px-4 py-3 font-medium">CA HT</th>
                    <th className="text-right px-4 py-3 font-medium">TVA collectée</th>
                    <th className="text-right px-4 py-3 font-medium">Achats HT</th>
                    <th className="text-right px-4 py-3 font-medium">TVA déductible</th>
                    <th className="text-right px-5 py-3 font-medium">Solde TVA</th>
                  </tr>
                </thead>
                <tbody>
                  {monthly.map((m, i) => {
                    const tvaC = m.produits * 0.18
                    const tvaD = m.charges  * 0.18
                    const sol  = tvaC - tvaD
                    return (
                      <tr key={i} className="border-t border-[#F3F4F6] hover:bg-[#F9FAFB]">
                        <td className="px-5 py-3 font-medium text-[#374151]">{m.mois}</td>
                        <td className="px-4 py-3 text-right text-[#374151]">{fmt(m.produits)}</td>
                        <td className="px-4 py-3 text-right text-red-500 font-medium">{fmt(tvaC)}</td>
                        <td className="px-4 py-3 text-right text-[#374151]">{fmt(m.charges)}</td>
                        <td className="px-4 py-3 text-right text-emerald-600 font-medium">{fmt(tvaD)}</td>
                        <td className={`px-5 py-3 text-right font-semibold ${sol >= 0 ? 'text-[#1D4ED8]' : 'text-emerald-600'}`}>
                          {fmt(sol)}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4 text-xs text-amber-800">
            <strong>Note :</strong> Ces estimations sont calculées sur la base des transactions enregistrées dans le système.
            Pour une déclaration officielle, consultez un expert-comptable agréé et rapprochez avec vos factures réelles.
            TVA Congo : 18% + Contribution d&apos;Appui (CA) = 5% × TVA, soit TTC = HT × 1,189.
          </div>
        </div>
      )}
    </div>
  )
}

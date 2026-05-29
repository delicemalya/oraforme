'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useTenant } from '@/lib/hooks/useTenant'
import { fmtFCFA } from '@/lib/admin-config'
import {
  Shield, Search, Download, RefreshCw, Filter,
  Package, AlertTriangle, CheckCircle2, Clock, User,
  Calendar, Database, ChevronLeft, ChevronRight,
  FileText, CreditCard, ShoppingCart, Wallet,
  Eye, Activity, ChevronDown, ChevronRight as ChevronRightIcon,
  FolderOpen,
} from 'lucide-react'
import { useLocale } from '@/lib/hooks/useLocale'

// ─── Types ────────────────────────────────────────────────────────────────────

type NiveauFilter = 'all' | 'info' | 'warning' | 'critical' | 'error'
type ModuleFilter = 'all' | 'stock' | 'tresorerie' | 'achats' | 'facturation' | 'rh' | 'ged' | 'comptabilite' | 'system'

interface GlobalEntry {
  id: string
  user_email?: string
  user_role?: string
  action: string
  module: string
  entite?: string
  entite_id?: string
  entite_label?: string
  ancien_valeur?: Record<string, unknown>
  nouvelle_valeur?: Record<string, unknown>
  niveau: 'info' | 'warning' | 'critical' | 'error'
  details?: Record<string, unknown>
  created_at: string
  // Legacy compat
  type?: string
  description?: string
  montant?: number
  quantite?: number
  entity_name?: string
}

// ─── Config ───────────────────────────────────────────────────────────────────

const MODULE_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType; bg: string }> = {
  stock:       { label: 'Stocks',       color: '#16A34A', icon: Package,       bg: '#F0FDF4' },
  tresorerie:  { label: 'Trésorerie',   color: '#0891B2', icon: Wallet,        bg: '#ECFEFF' },
  achats:      { label: 'Achats',       color: '#7C3AED', icon: ShoppingCart,  bg: '#F5F3FF' },
  facturation: { label: 'Facturation',  color: '#F59E0B', icon: FileText,      bg: '#FFFBEB' },
  rh:          { label: 'RH & Paie',    color: '#DC2626', icon: User,          bg: '#FEF2F2' },
  ged:         { label: 'GED',          color: '#F59E0B', icon: FolderOpen,    bg: '#FFFBEB' },
  comptabilite:{ label: 'Comptabilité', color: '#2563EB', icon: Activity,      bg: '#EFF6FF' },
  hotel:       { label: 'Hôtellerie',   color: '#F59E0B', icon: CreditCard,    bg: '#FFFBEB' },
  system:      { label: 'Système',      color: '#64748B', icon: Database,      bg: '#F8FAFC' },
  ecole:       { label: 'École',        color: '#7C3AED', icon: Activity,      bg: '#F5F3FF' },
  permissions: { label: 'Permissions',  color: '#64748B', icon: Shield,        bg: '#F8FAFC' },
}

const NIVEAU_CONFIG: Record<string, { label: string; color: string; bg: string; icon: React.ElementType }> = {
  info:     { label: 'Info',     color: '#2563EB', bg: '#EFF6FF', icon: CheckCircle2 },
  warning:  { label: 'Attention',color: '#D97706', bg: '#FFFBEB', icon: Clock },
  critical: { label: 'Critique', color: '#DC2626', bg: '#FEF2F2', icon: AlertTriangle },
  error:    { label: 'Erreur',   color: '#9F1239', bg: '#FFF1F2', icon: AlertTriangle },
}

const ACTION_LABELS: Record<string, string> = {
  CREATE:   'Création',
  UPDATE:   'Modification',
  DELETE:   'Suppression',
  SIGN:     'Signature',
  PAYMENT:  'Paiement',
  EXPORT:   'Export',
  LOGIN:    'Connexion',
  LOGOUT:   'Déconnexion',
  UPLOAD:   'Upload',
  DOWNLOAD: 'Téléchargement',
  VIEW:     'Consultation',
}

const PAGE_SIZE = 50

// ─── ExpandableRow ────────────────────────────────────────────────────────────

function ExpandableRow({ entry, fmtDate }: { entry: GlobalEntry; fmtDate: (s: string) => string }) {
  const { t } = useLocale()
  const [open, setOpen] = useState(false)

  const mod    = MODULE_CONFIG[entry.module] ?? MODULE_CONFIG.system
  const niv    = NIVEAU_CONFIG[entry.niveau] ?? NIVEAU_CONFIG.info
  const ModIcon = mod.icon
  const NivIcon = niv.icon

  const hasDetail = !!(entry.ancien_valeur || entry.nouvelle_valeur || entry.details)

  return (
    <>
      <div
        className={`flex items-center gap-3 px-5 py-3 transition-all group ${open ? 'bg-[#F8FAFC]' : 'hover:bg-[#FAFAFA]'} ${hasDetail ? 'cursor-pointer' : ''}`}
        onClick={() => hasDetail && setOpen(o => !o)}
      >
        {/* Module icon */}
        <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0" style={{ background: mod.bg }}>
          <ModIcon size={14} style={{ color: mod.color }} />
        </div>

        {/* Description */}
        <div className="flex-1 min-w-0">
          <div className="text-[12px] font-medium text-[#0F172A] truncate">
            {entry.entite_label ?? entry.description ?? `${ACTION_LABELS[entry.action] ?? entry.action} — ${entry.entite ?? entry.module}`}
          </div>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            <span className="text-[10px] text-[#94A3B8]">{fmtDate(entry.created_at)}</span>
            {entry.user_email && (
              <span className="text-[10px] text-[#64748B]">· {entry.user_email}</span>
            )}
            {entry.entite && (
              <span className="text-[10px] text-[#94A3B8]">· {entry.entite}</span>
            )}
          </div>
        </div>

        {/* Action badge */}
        <span className="text-[10px] font-semibold px-2 py-1 rounded-lg whitespace-nowrap hidden lg:block"
          style={{ color: '#64748B', background: '#F1F5F9' }}>
          {ACTION_LABELS[entry.action] ?? entry.action}
        </span>

        {/* Module badge */}
        <span className="text-[10px] font-semibold px-2 py-1 rounded-lg whitespace-nowrap hidden sm:block"
          style={{ color: mod.color, background: mod.bg }}>
          {mod.label}
        </span>

        {/* Niveau badge */}
        <span className="text-[10px] font-semibold px-2 py-1 rounded-lg whitespace-nowrap flex items-center gap-1"
          style={{ color: niv.color, background: niv.bg }}>
          <NivIcon size={10} />
          {niv.label}
        </span>

        {/* Amount (legacy) */}
        {entry.montant !== undefined && entry.montant !== null && (
          <div className="text-[12px] font-bold text-[#0F172A] shrink-0 min-w-[80px] text-right">
            {fmtFCFA(entry.montant)}
          </div>
        )}

        {/* Expand indicator */}
        {hasDetail && (
          <div className="shrink-0 text-[#94A3B8]">
            {open ? <ChevronDown size={14} /> : <ChevronRightIcon size={14} />}
          </div>
        )}
      </div>

      {/* Expanded detail panel */}
      {open && hasDetail && (
        <div className="px-5 pb-3 bg-[#F8FAFC] border-t border-[#F1F5F9]">
          <div className="flex gap-3 mt-2">
            {entry.ancien_valeur && (
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-bold text-[#64748B] uppercase tracking-wide mb-1">{t('audit.ancien')}</p>
                <pre className="text-[10px] text-[#374151] bg-white border border-[#E2E8F0] rounded-xl p-3 overflow-x-auto whitespace-pre-wrap max-h-40">
                  {JSON.stringify(entry.ancien_valeur, null, 2)}
                </pre>
              </div>
            )}
            {entry.nouvelle_valeur && (
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-bold text-[#16A34A] uppercase tracking-wide mb-1">{t('audit.nouveau')}</p>
                <pre className="text-[10px] text-[#374151] bg-white border border-[#E2E8F0] rounded-xl p-3 overflow-x-auto whitespace-pre-wrap max-h-40">
                  {JSON.stringify(entry.nouvelle_valeur, null, 2)}
                </pre>
              </div>
            )}
            {entry.details && !entry.ancien_valeur && !entry.nouvelle_valeur && (
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-bold text-[#64748B] uppercase tracking-wide mb-1">Détails</p>
                <pre className="text-[10px] text-[#374151] bg-white border border-[#E2E8F0] rounded-xl p-3 overflow-x-auto whitespace-pre-wrap max-h-40">
                  {JSON.stringify(entry.details, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}

// ─── AuditPage ────────────────────────────────────────────────────────────────

export default function AuditPage() {
  const { tenantId } = useTenant()
  const { t, locale } = useLocale()

  const intlLocale = locale === 'fr' ? 'fr-FR' : locale === 'en' ? 'en-GB' : locale === 'pt' ? 'pt-BR' : locale === 'es' ? 'es-ES' : locale === 'de' ? 'de-DE' : 'fr-FR'

  // ── State ──────────────────────────────────────────────────────────────────
  const [entries,     setEntries]     = useState<GlobalEntry[]>([])
  const [total,       setTotal]       = useState(0)
  const [page,        setPage]        = useState(0)
  const [loading,     setLoading]     = useState(true)
  const [refreshing,  setRefreshing]  = useState(false)
  const [useGlobal,   setUseGlobal]   = useState(true)

  const [search,      setSearch]      = useState('')
  const [modFilter,   setModFilter]   = useState<ModuleFilter>('all')
  const [nivFilter,   setNivFilter]   = useState<NiveauFilter>('all')
  const [dateFrom,    setDateFrom]    = useState('')
  const [dateTo,      setDateTo]      = useState('')

  const [stats, setStats] = useState({
    total: 0, today: 0, critical: 0, warning: 0,
    totalMovements: 0, totalTransactions: 0, totalAchats: 0, totalFactures: 0,
  })

  const fmtDate = (d: string) =>
    new Date(d).toLocaleString(intlLocale, { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })

  // ── Load global_audit_trail ────────────────────────────────────────────────
  const loadGlobal = useCallback(async (currentPage = 0) => {
    if (!tenantId) return
    setLoading(true)

    let q = supabase
      .from('global_audit_trail')
      .select('*', { count: 'exact' })
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })

    if (modFilter !== 'all') q = q.eq('module', modFilter)
    if (nivFilter !== 'all') q = q.eq('niveau', nivFilter)
    if (dateFrom) q = q.gte('created_at', dateFrom)
    if (dateTo)   q = q.lte('created_at', dateTo + 'T23:59:59')
    if (search)   q = q.or(`entite_label.ilike.%${search}%,entite.ilike.%${search}%,user_email.ilike.%${search}%`)

    const { data, count, error } = await q
      .range(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE - 1)

    if (error || !data) {
      setUseGlobal(false)
      setLoading(false)
      setRefreshing(false)
      return
    }

    const rows = data as GlobalEntry[]
    setEntries(rows)
    setTotal(count ?? 0)

    const now = new Date()
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    setStats(s => ({
      ...s,
      total:    count ?? 0,
      today:    rows.filter(e => new Date(e.created_at) >= todayStart).length,
      critical: rows.filter(e => e.niveau === 'critical').length,
      warning:  rows.filter(e => e.niveau === 'warning').length,
    }))

    setLoading(false)
    setRefreshing(false)
  }, [tenantId, modFilter, nivFilter, dateFrom, dateTo, search]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Load legacy multi-source ───────────────────────────────────────────────
  const loadLegacy = useCallback(async (currentPage = 0) => {
    if (!tenantId) return
    setLoading(true)
    const all: GlobalEntry[] = []

    try {
      if (modFilter === 'all' || modFilter === 'stock') {
        let q = supabase.from('stock_movements')
          .select('id, type, quantite, created_at, products:product_id(nom)')
          .eq('tenant_id', tenantId).order('created_at', { ascending: false })
        if (dateFrom) q = q.gte('created_at', dateFrom)
        if (dateTo)   q = q.lte('created_at', dateTo + 'T23:59:59')
        const { data } = await q.limit(200)
        ;(data ?? []).forEach((m: { id: string; type: string; quantite: number; created_at: string; products?: { nom: string } | { nom: string }[] | null }) => {
          const prodNom: string = Array.isArray(m.products) ? (m.products[0]?.nom ?? 'produit') : (m.products?.nom ?? 'produit')
          all.push({
            id: m.id, action: 'CREATE', module: 'stock', niveau: 'info',
            entite: 'stock_movements',
            entite_label: `Stock — ${prodNom}`,
            quantite: m.quantite, created_at: m.created_at,
          })
        })
      }
      if (modFilter === 'all' || modFilter === 'tresorerie') {
        let q = supabase.from('transactions')
          .select('id, type, montant, description, created_at')
          .eq('tenant_id', tenantId).order('created_at', { ascending: false })
        if (dateFrom) q = q.gte('created_at', dateFrom)
        if (dateTo)   q = q.lte('created_at', dateTo + 'T23:59:59')
        const { data } = await q.limit(200)
        ;(data ?? []).forEach((tx: { id: string; type: string; montant: number; description: string | null; created_at: string }) => {
          all.push({
            id: tx.id, action: 'PAYMENT', module: 'tresorerie', niveau: 'info',
            entite_label: tx.description ?? `Transaction ${tx.type}`,
            montant: tx.montant, created_at: tx.created_at,
          })
        })
      }
      if (modFilter === 'all' || modFilter === 'facturation') {
        let q = supabase.from('factures')
          .select('id, total, statut, created_at, client_name, client_nom')
          .eq('tenant_id', tenantId).order('created_at', { ascending: false })
        if (dateFrom) q = q.gte('created_at', dateFrom)
        if (dateTo)   q = q.lte('created_at', dateTo + 'T23:59:59')
        const { data } = await q.limit(200)
        ;(data ?? []).forEach((f: { id: string; total: number; statut: string; created_at: string; client_name: string | null; client_nom: string | null }) => {
          all.push({
            id: f.id, action: 'CREATE', module: 'facturation', niveau: 'info',
            entite: 'factures',
            entite_label: `Facture — ${f.client_name ?? f.client_nom ?? 'client'}`,
            montant: f.total, created_at: f.created_at,
          })
        })
      }
    } catch { /* graceful degradation */ }

    all.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    const filtered = search
      ? all.filter(e => (e.entite_label ?? '').toLowerCase().includes(search.toLowerCase()) || e.module.toLowerCase().includes(search.toLowerCase()))
      : all

    const now = new Date()
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    setStats({
      total: filtered.length,
      today: filtered.filter(e => new Date(e.created_at) >= todayStart).length,
      critical: 0, warning: 0,
      totalMovements:    all.filter(e => e.module === 'stock').length,
      totalTransactions: all.filter(e => e.module === 'tresorerie').length,
      totalAchats:       all.filter(e => e.module === 'achats').length,
      totalFactures:     all.filter(e => e.module === 'facturation').length,
    })

    setTotal(filtered.length)
    setEntries(filtered.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE))
    setLoading(false)
    setRefreshing(false)
  }, [tenantId, modFilter, dateFrom, dateTo, search]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setPage(0)
    if (useGlobal) loadGlobal(0)
    else           loadLegacy(0)
  }, [loadGlobal, loadLegacy, useGlobal])

  // ── CSV Export ─────────────────────────────────────────────────────────────
  const exportCSV = () => {
    const rows = [[t('audit.colModule'), t('audit.colAction'), t('audit.colEntite'), t('audit.colNiveau'), t('audit.colUser'), t('audit.colDate')]]
    entries.forEach(e => {
      rows.push([
        MODULE_CONFIG[e.module]?.label ?? e.module,
        ACTION_LABELS[e.action] ?? e.action,
        e.entite_label ?? e.description ?? '',
        NIVEAU_CONFIG[e.niveau]?.label ?? e.niveau,
        e.user_email ?? '',
        new Date(e.created_at).toLocaleString(intlLocale),
      ])
    })
    const csv  = '﻿' + rows.map(r => r.map(c => `"${c}"`).join(';')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const a    = document.createElement('a')
    a.href     = URL.createObjectURL(blob)
    a.download = `audit-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
  }

  const totalPages = Math.ceil(total / PAGE_SIZE)

  const refresh = () => {
    setRefreshing(true)
    if (useGlobal) loadGlobal(page)
    else           loadLegacy(page)
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">

      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-[#1E293B]">
            <Shield size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-[#0F172A]">{t('audit.title')}</h1>
            <p className="text-[11px] text-[#64748B]">{t('audit.subtitle')}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={refresh}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[#E2E8F0] text-[12px] font-semibold text-[#64748B] hover:bg-[#F1F5F9] transition-all">
            <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} />
            {t('audit.refresh')}
          </button>
          <button onClick={exportCSV}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[12px] font-semibold text-white transition-all bg-[#1E293B]">
            <Download size={13} />
            {t('audit.export')}
          </button>
        </div>
      </div>

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
        {[
          { label: t('audit.kpi.today'),     value: stats.today,            color: '#2563EB', bg: '#EFF6FF', icon: Clock },
          { label: 'Total',                  value: stats.total,            color: '#0F172A', bg: '#F1F5F9', icon: Activity },
          { label: 'Critiques',              value: stats.critical,         color: '#DC2626', bg: '#FEF2F2', icon: AlertTriangle },
          { label: 'Attention',              value: stats.warning,          color: '#D97706', bg: '#FFFBEB', icon: Clock },
          { label: t('audit.kpi.movements'), value: stats.totalMovements,   color: '#16A34A', bg: '#F0FDF4', icon: Package },
          { label: t('audit.kpi.transactions'),value: stats.totalTransactions,color:'#0891B2',bg:'#ECFEFF', icon: Wallet },
          { label: t('audit.kpi.purchases'), value: stats.totalAchats,      color: '#7C3AED', bg: '#F5F3FF', icon: ShoppingCart },
          { label: t('audit.kpi.invoices'),  value: stats.totalFactures,    color: '#F59E0B', bg: '#FFFBEB', icon: FileText },
        ].map(k => {
          const Icon = k.icon
          return (
            <div key={k.label} className="bg-white border border-[#E2E8F0] rounded-2xl p-3">
              <div className="w-6 h-6 rounded-lg flex items-center justify-center mb-1.5" style={{ background: k.bg }}>
                <Icon size={12} style={{ color: k.color }} />
              </div>
              <div className="text-lg font-bold text-[#0F172A]">{k.value.toLocaleString(intlLocale)}</div>
              <div className="text-[10px] text-[#64748B]">{k.label}</div>
            </div>
          )
        })}
      </div>

      {/* ── Filters ── */}
      <div className="bg-white border border-[#E2E8F0] rounded-2xl p-4 space-y-3">
        <div className="flex flex-wrap gap-3">

          {/* Search */}
          <div className="relative flex-1 min-w-[200px]">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
            <input type="text" placeholder={t('audit.searchPlh')} value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-2 text-[12px] border border-[#E2E8F0] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1E293B]/20" />
          </div>

          {/* Date range */}
          <div className="flex items-center gap-2">
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
              className="px-2.5 py-2 text-[11px] border border-[#E2E8F0] rounded-xl focus:outline-none" />
            <span className="text-[#94A3B8] text-[11px]">→</span>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
              className="px-2.5 py-2 text-[11px] border border-[#E2E8F0] rounded-xl focus:outline-none" />
          </div>
        </div>

        {/* Module filter */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <Filter size={12} className="text-[#94A3B8]" />
          {(['all', 'facturation', 'tresorerie', 'rh', 'ged', 'stock', 'achats', 'comptabilite', 'system'] as ModuleFilter[]).map(m => (
            <button key={m} onClick={() => setModFilter(m)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all ${
                modFilter === m ? 'text-white shadow-sm' : 'text-[#64748B] hover:bg-[#F1F5F9]'
              }`}
              style={modFilter === m ? { background: m === 'all' ? '#1E293B' : MODULE_CONFIG[m]?.color ?? '#1E293B' } : {}}>
              {m === 'all' ? t('audit.filterAll') : MODULE_CONFIG[m]?.label ?? m}
            </button>
          ))}
        </div>

        {/* Niveau filter (only when global trail active) */}
        {useGlobal && (
          <div className="flex items-center gap-1.5 flex-wrap">
            <Shield size={12} className="text-[#94A3B8]" />
            {(['all', 'info', 'warning', 'critical', 'error'] as NiveauFilter[]).map(nv => {
              const cfg = nv === 'all' ? null : NIVEAU_CONFIG[nv]
              return (
                <button key={nv} onClick={() => setNivFilter(nv)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all ${
                    nivFilter === nv ? 'text-white shadow-sm' : 'text-[#64748B] hover:bg-[#F1F5F9]'
                  }`}
                  style={nivFilter === nv ? { background: cfg?.color ?? '#1E293B' } : {}}>
                  {nv === 'all' ? t('audit.filterAll') : cfg?.label ?? nv}
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* ── Journal Table ── */}
      <div className="bg-white border border-[#E2E8F0] rounded-2xl overflow-hidden">
        <div className="px-5 py-3 border-b border-[#F1F5F9] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity size={14} className="text-[#94A3B8]" />
            <span className="text-[12px] font-semibold text-[#0F172A]">
              {t('audit.journal')}
            </span>
            <span className="text-[11px] text-[#94A3B8]">
              ({total.toLocaleString(intlLocale)} {t('audit.entries')})
            </span>
            {useGlobal && (
              <span className="text-[10px] bg-[#1E293B] text-white px-2 py-0.5 rounded-lg font-semibold">
                Global
              </span>
            )}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-[#64748B]">
                {t('audit.page')} {page + 1}/{totalPages}
              </span>
              <button onClick={() => { const p = page - 1; setPage(p); if (useGlobal) loadGlobal(p); else loadLegacy(p) }}
                disabled={page === 0}
                className="p-1 rounded-lg hover:bg-[#F1F5F9] disabled:opacity-40 transition-all">
                <ChevronLeft size={14} className="text-[#64748B]" />
              </button>
              <button onClick={() => { const p = page + 1; setPage(p); if (useGlobal) loadGlobal(p); else loadLegacy(p) }}
                disabled={page >= totalPages - 1}
                className="p-1 rounded-lg hover:bg-[#F1F5F9] disabled:opacity-40 transition-all">
                <ChevronRight size={14} className="text-[#64748B]" />
              </button>
            </div>
          )}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16 gap-3">
            <div className="w-8 h-8 border-2 border-[#1E293B] border-t-transparent rounded-full animate-spin" />
            <span className="ml-1 text-[13px] text-[#94A3B8]">{t('common.loading')}</span>
          </div>
        ) : entries.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <Eye size={32} className="text-[#E2E8F0]" />
            <p className="text-[13px] text-[#94A3B8]">{t('audit.noEvents')}</p>
          </div>
        ) : (
          <div className="divide-y divide-[#F8FAFC]">
            {entries.map(entry => (
              <ExpandableRow key={entry.id} entry={entry} fmtDate={fmtDate} />
            ))}
          </div>
        )}
      </div>

    </div>
  )
}

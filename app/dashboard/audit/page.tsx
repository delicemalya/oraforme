'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useTenant } from '@/lib/hooks/useTenant'
import { fmtFCFA } from '@/lib/admin-config'
import {
  Shield, Search, Download, RefreshCw, Filter,
  TrendingUp, TrendingDown, ArrowLeftRight, Package,
  AlertTriangle, CheckCircle2, Clock, User,
  Calendar, Database, ChevronLeft, ChevronRight,
  FileText, CreditCard, ShoppingCart, Wallet,
  Eye, Activity,
} from 'lucide-react'
import { useLocale } from '@/lib/hooks/useLocale'

// ─── Types ────────────────────────────────────────────────────────────────────

type AuditEntry = {
  id: string
  type: string       // entree | sortie | ajustement | transfert | reception | retour | paiement | achat | ...
  module: string     // stock | tresorerie | achats | facturation | ...
  description: string
  montant?: number
  quantite?: number
  user_email?: string
  entity_name?: string
  created_at: string
  metadata?: Record<string, unknown>
}

type ModuleFilter = 'all' | 'stock' | 'tresorerie' | 'achats' | 'facturation' | 'rh' | 'hotel'

// ─── Config ───────────────────────────────────────────────────────────────────

const MODULE_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType; bg: string }> = {
  stock:       { label: 'Stocks',       color: '#16A34A', icon: Package,       bg: '#F0FDF4' },
  tresorerie:  { label: 'Trésorerie',   color: '#0891B2', icon: Wallet,        bg: '#ECFEFF' },
  achats:      { label: 'Achats',       color: '#7C3AED', icon: ShoppingCart,  bg: '#F5F3FF' },
  facturation: { label: 'Facturation',  color: '#F59E0B', icon: FileText,      bg: '#FFFBEB' },
  rh:          { label: 'RH & Paie',    color: '#DC2626', icon: User,          bg: '#FEF2F2' },
  hotel:       { label: 'Hôtellerie',   color: '#F59E0B', icon: CreditCard,    bg: '#FFFBEB' },
  system:      { label: 'Système',      color: '#64748B', icon: Database,      bg: '#F8FAFC' },
}

const TYPE_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  entree:      { label: 'Entrée',      color: '#16A34A', bg: '#F0FDF4' },
  reception:   { label: 'Réception',   color: '#16A34A', bg: '#F0FDF4' },
  sortie:      { label: 'Sortie',      color: '#DC2626', bg: '#FEF2F2' },
  ajustement:  { label: 'Ajustement',  color: '#D97706', bg: '#FFFBEB' },
  transfert:   { label: 'Transfert',   color: '#2563EB', bg: '#EFF6FF' },
  retour:      { label: 'Retour',      color: '#7C3AED', bg: '#F5F3FF' },
  paiement:    { label: 'Paiement',    color: '#0891B2', bg: '#ECFEFF' },
  achat:       { label: 'Achat',       color: '#7C3AED', bg: '#F5F3FF' },
  facture:     { label: 'Facture',     color: '#F59E0B', bg: '#FFFBEB' },
  checkin:     { label: 'Check-in',    color: '#16A34A', bg: '#F0FDF4' },
  checkout:    { label: 'Check-out',   color: '#64748B', bg: '#F8FAFC' },
}

const PAGE_SIZE = 50

// ─── Component ────────────────────────────────────────────────────────────────

export default function AuditPage() {
  const { tenantId } = useTenant()
  const { t, locale } = useLocale()

  const intlLocale = locale === 'fr' ? 'fr-FR' : locale === 'en' ? 'en-GB' : locale === 'pt' ? 'pt-BR' : locale === 'es' ? 'es-ES' : locale === 'de' ? 'de-DE' : 'fr-FR'

  // ── State ──────────────────────────────────────────────────────────────────
  const [entries, setEntries] = useState<AuditEntry[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(0)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  // Filters
  const [search, setSearch] = useState('')
  const [moduleFilter, setModuleFilter] = useState<ModuleFilter>('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  // Stats
  const [stats, setStats] = useState({
    totalMovements: 0,
    totalTransactions: 0,
    totalAchats: 0,
    totalFactures: 0,
    today: 0,
    thisWeek: 0,
  })

  // ── Load audit data ────────────────────────────────────────────────────────
  const loadAudit = useCallback(async (currentPage = 0) => {
    if (!tenantId) return
    setLoading(true)

    const allEntries: AuditEntry[] = []

    try {
      // 1. Stock movements
      if (moduleFilter === 'all' || moduleFilter === 'stock') {
        let q = supabase
          .from('stock_movements')
          .select('id, type, quantite, notes, created_at, product_id, products:product_id(nom)', { count: 'exact' })
          .eq('tenant_id', tenantId)
          .order('created_at', { ascending: false })

        if (dateFrom) q = q.gte('created_at', dateFrom)
        if (dateTo)   q = q.lte('created_at', dateTo + 'T23:59:59')

        const { data } = await q.limit(200)
        if (data) {
          data.forEach(m => {
            const prod = (m.products as { nom?: string } | null)
            allEntries.push({
              id: m.id,
              type: m.type ?? 'entree',
              module: 'stock',
              description: `${m.type === 'entree' ? 'Entrée' : m.type === 'sortie' ? 'Sortie' : 'Mouvement'} stock — ${prod?.nom ?? 'produit'}`,
              quantite: m.quantite,
              entity_name: prod?.nom ?? undefined,
              created_at: m.created_at,
              metadata: { notes: m.notes },
            })
          })
        }
      }

      // 2. Tresorerie transactions
      if (moduleFilter === 'all' || moduleFilter === 'tresorerie') {
        let q = supabase
          .from('transactions')
          .select('id, type, montant, description, created_at, reference')
          .eq('tenant_id', tenantId)
          .order('created_at', { ascending: false })

        if (dateFrom) q = q.gte('created_at', dateFrom)
        if (dateTo)   q = q.lte('created_at', dateTo + 'T23:59:59')

        const { data } = await q.limit(200)
        if (data) {
          data.forEach(tx => {
            allEntries.push({
              id: tx.id,
              type: 'paiement',
              module: 'tresorerie',
              description: tx.description ?? `Transaction ${tx.type}`,
              montant: tx.montant,
              created_at: tx.created_at,
              metadata: { reference: tx.reference },
            })
          })
        }
      }

      // 3. Achats
      if (moduleFilter === 'all' || moduleFilter === 'achats') {
        let q = supabase
          .from('achats')
          .select('id, montant_total, statut, created_at, fournisseurs:fournisseur_id(nom)')
          .eq('tenant_id', tenantId)
          .order('created_at', { ascending: false })

        if (dateFrom) q = q.gte('created_at', dateFrom)
        if (dateTo)   q = q.lte('created_at', dateTo + 'T23:59:59')

        const { data } = await q.limit(200)
        if (data) {
          data.forEach(a => {
            const fourn = (a.fournisseurs as { nom?: string } | null)
            allEntries.push({
              id: a.id,
              type: 'achat',
              module: 'achats',
              description: `Achat — ${fourn?.nom ?? 'fournisseur'}`,
              montant: a.montant_total,
              entity_name: fourn?.nom ?? undefined,
              created_at: a.created_at,
              metadata: { statut: a.statut },
            })
          })
        }
      }

      // 4. Factures
      if (moduleFilter === 'all' || moduleFilter === 'facturation') {
        let q = supabase
          .from('factures')
          .select('id, montant_total, statut, created_at, clients:client_id(nom)')
          .eq('tenant_id', tenantId)
          .order('created_at', { ascending: false })

        if (dateFrom) q = q.gte('created_at', dateFrom)
        if (dateTo)   q = q.lte('created_at', dateTo + 'T23:59:59')

        const { data } = await q.limit(200)
        if (data) {
          data.forEach(f => {
            const client = (f.clients as { nom?: string } | null)
            allEntries.push({
              id: f.id,
              type: 'facture',
              module: 'facturation',
              description: `Facture — ${client?.nom ?? 'client'}`,
              montant: f.montant_total,
              entity_name: client?.nom ?? undefined,
              created_at: f.created_at,
              metadata: { statut: f.statut },
            })
          })
        }
      }

      // 5. Hotel reservations
      if (moduleFilter === 'all' || moduleFilter === 'hotel') {
        let q = supabase
          .from('hotel_reservations')
          .select('id, statut, montant_total, created_at, client_nom')
          .eq('tenant_id', tenantId)
          .order('created_at', { ascending: false })

        if (dateFrom) q = q.gte('created_at', dateFrom)
        if (dateTo)   q = q.lte('created_at', dateTo + 'T23:59:59')

        const { data, error } = await q.limit(200)
        if (!error && data) {
          data.forEach(r => {
            allEntries.push({
              id: r.id,
              type: r.statut === 'arrivee' ? 'checkin' : r.statut === 'depart' ? 'checkout' : 'facture',
              module: 'hotel',
              description: `Réservation hôtel — ${r.client_nom ?? 'client'}`,
              montant: r.montant_total,
              entity_name: r.client_nom ?? undefined,
              created_at: r.created_at,
              metadata: { statut: r.statut },
            })
          })
        }
      }

    } catch {
      // Graceful degradation — some tables may not exist yet
    }

    // Sort all by date desc
    allEntries.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

    // Apply search filter
    const filtered = search
      ? allEntries.filter(e =>
          e.description.toLowerCase().includes(search.toLowerCase()) ||
          e.entity_name?.toLowerCase().includes(search.toLowerCase()) ||
          e.module.toLowerCase().includes(search.toLowerCase())
        )
      : allEntries

    // Compute stats
    const now = new Date()
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const weekStart = new Date(todayStart); weekStart.setDate(weekStart.getDate() - 7)

    setStats({
      totalMovements:   allEntries.filter(e => e.module === 'stock').length,
      totalTransactions: allEntries.filter(e => e.module === 'tresorerie').length,
      totalAchats:      allEntries.filter(e => e.module === 'achats').length,
      totalFactures:    allEntries.filter(e => e.module === 'facturation').length,
      today:    filtered.filter(e => new Date(e.created_at) >= todayStart).length,
      thisWeek: filtered.filter(e => new Date(e.created_at) >= weekStart).length,
    })

    setTotal(filtered.length)
    setEntries(filtered.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE))
    setLoading(false)
    setRefreshing(false)
  }, [tenantId, moduleFilter, search, dateFrom, dateTo])

  useEffect(() => {
    setPage(0)
    loadAudit(0)
  }, [loadAudit])

  // ── CSV Export ─────────────────────────────────────────────────────────────
  const exportCSV = async () => {
    if (!tenantId) return
    const rows = [[t('audit.colModule'), t('audit.colAction'), t('audit.colDetails'), 'Montant', 'Quantité', t('audit.colDate')]]
    entries.forEach(e => {
      rows.push([
        MODULE_CONFIG[e.module]?.label ?? e.module,
        TYPE_CONFIG[e.type]?.label ?? e.type,
        e.description,
        e.montant ? String(e.montant) : '',
        e.quantite ? String(e.quantite) : '',
        new Date(e.created_at).toLocaleString(intlLocale),
      ])
    })
    const csv = '﻿' + rows.map(r => r.map(c => `"${c}"`).join(';')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `audit-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
  }

  // ── Helpers ────────────────────────────────────────────────────────────────
  const fmtDate = (d: string) => new Date(d).toLocaleString(intlLocale, { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })

  const totalPages = Math.ceil(total / PAGE_SIZE)

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">

      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: '#1E293B' }}>
            <Shield size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-[#0F172A]">{t('audit.title')}</h1>
            <p className="text-[11px] text-[#64748B]">{t('audit.subtitle')}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => { setRefreshing(true); loadAudit(page) }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[#E2E8F0] text-[12px] font-semibold text-[#64748B] hover:bg-[#F1F5F9] transition-all"
          >
            <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} />
            Actualiser
          </button>
          <button
            onClick={exportCSV}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[12px] font-semibold text-white transition-all"
            style={{ background: '#1E293B' }}
          >
            <Download size={13} />
            {t('audit.export')}
          </button>
        </div>
      </div>

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { label: "Aujourd'hui",      value: stats.today,            icon: Clock,    color: '#2563EB', bg: '#EFF6FF' },
          { label: 'Cette semaine',    value: stats.thisWeek,         icon: Calendar, color: '#7C3AED', bg: '#F5F3FF' },
          { label: 'Mvts stocks',      value: stats.totalMovements,   icon: Package,  color: '#16A34A', bg: '#F0FDF4' },
          { label: 'Transactions',     value: stats.totalTransactions, icon: Wallet,   color: '#0891B2', bg: '#ECFEFF' },
          { label: 'Achats',           value: stats.totalAchats,      icon: ShoppingCart, color: '#7C3AED', bg: '#F5F3FF' },
          { label: 'Factures',         value: stats.totalFactures,    icon: FileText, color: '#F59E0B', bg: '#FFFBEB' },
        ].map(k => {
          const Icon = k.icon
          return (
            <div key={k.label} className="bg-white border border-[#E2E8F0] rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: k.bg }}>
                  <Icon size={13} style={{ color: k.color }} />
                </div>
              </div>
              <div className="text-xl font-bold text-[#0F172A]">{k.value.toLocaleString(intlLocale)}</div>
              <div className="text-[10px] text-[#64748B] mt-0.5">{k.label}</div>
            </div>
          )
        })}
      </div>

      {/* ── Filters ── */}
      <div className="bg-white border border-[#E2E8F0] rounded-2xl p-4">
        <div className="flex flex-wrap gap-3">

          {/* Search */}
          <div className="relative flex-1 min-w-[200px]">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
            <input
              type="text"
              placeholder={t('audit.searchPlh')}
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-2 text-[12px] border border-[#E2E8F0] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1E293B]/20"
            />
          </div>

          {/* Module filter */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <Filter size={13} className="text-[#94A3B8]" />
            {(['all', 'stock', 'tresorerie', 'achats', 'facturation', 'hotel'] as ModuleFilter[]).map(m => (
              <button
                key={m}
                onClick={() => setModuleFilter(m)}
                className={`px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition-all ${
                  moduleFilter === m
                    ? 'text-white shadow-sm'
                    : 'text-[#64748B] hover:bg-[#F1F5F9]'
                }`}
                style={moduleFilter === m ? { background: m === 'all' ? '#1E293B' : MODULE_CONFIG[m]?.color ?? '#1E293B' } : {}}
              >
                {m === 'all' ? t('audit.filterAll') : MODULE_CONFIG[m]?.label ?? m}
              </button>
            ))}
          </div>

          {/* Date range */}
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={dateFrom}
              onChange={e => setDateFrom(e.target.value)}
              className="px-2.5 py-2 text-[11px] border border-[#E2E8F0] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1E293B]/20"
            />
            <span className="text-[#94A3B8] text-[11px]">→</span>
            <input
              type="date"
              value={dateTo}
              onChange={e => setDateTo(e.target.value)}
              className="px-2.5 py-2 text-[11px] border border-[#E2E8F0] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1E293B]/20"
            />
          </div>
        </div>
      </div>

      {/* ── Table ── */}
      <div className="bg-white border border-[#E2E8F0] rounded-2xl overflow-hidden">
        <div className="px-5 py-3 border-b border-[#F1F5F9] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity size={14} className="text-[#94A3B8]" />
            <span className="text-[12px] font-semibold text-[#0F172A]">
              Journal d&apos;activité
            </span>
            <span className="text-[11px] text-[#94A3B8]">
              ({total.toLocaleString(intlLocale)} entrées)
            </span>
          </div>

          {/* Pagination controls */}
          {totalPages > 1 && (
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-[#64748B]">
                Page {page + 1}/{totalPages}
              </span>
              <button
                onClick={() => { const p = page - 1; setPage(p); loadAudit(p) }}
                disabled={page === 0}
                className="p-1 rounded-lg hover:bg-[#F1F5F9] disabled:opacity-40 transition-all"
              >
                <ChevronLeft size={14} className="text-[#64748B]" />
              </button>
              <button
                onClick={() => { const p = page + 1; setPage(p); loadAudit(p) }}
                disabled={page >= totalPages - 1}
                className="p-1 rounded-lg hover:bg-[#F1F5F9] disabled:opacity-40 transition-all"
              >
                <ChevronRight size={14} className="text-[#64748B]" />
              </button>
            </div>
          )}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-8 h-8 border-2 border-[#1E293B] border-t-transparent rounded-full animate-spin" />
            <span className="ml-3 text-[13px] text-[#94A3B8]">{t('common.loading')}</span>
          </div>
        ) : entries.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <Eye size={32} className="text-[#E2E8F0]" />
            <p className="text-[13px] text-[#94A3B8]">{t('audit.noEvents')}</p>
          </div>
        ) : (
          <div className="divide-y divide-[#F8FAFC]">
            {entries.map(entry => {
              const mod = MODULE_CONFIG[entry.module] ?? MODULE_CONFIG.system
              const typ = TYPE_CONFIG[entry.type]
              const ModIcon = mod.icon

              return (
                <div key={entry.id} className="flex items-center gap-4 px-5 py-3 hover:bg-[#FAFAFA] transition-all group">

                  {/* Module icon */}
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0" style={{ background: mod.bg }}>
                    <ModIcon size={14} style={{ color: mod.color }} />
                  </div>

                  {/* Description */}
                  <div className="flex-1 min-w-0">
                    <div className="text-[12px] font-medium text-[#0F172A] truncate">
                      {entry.description}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px] text-[#94A3B8]">{fmtDate(entry.created_at)}</span>
                      {entry.entity_name && (
                        <span className="text-[10px] text-[#64748B]">· {entry.entity_name}</span>
                      )}
                    </div>
                  </div>

                  {/* Type badge */}
                  {typ && (
                    <span
                      className="text-[10px] font-semibold px-2 py-1 rounded-lg whitespace-nowrap"
                      style={{ color: typ.color, background: typ.bg }}
                    >
                      {typ.label}
                    </span>
                  )}

                  {/* Module badge */}
                  <span
                    className="text-[10px] font-semibold px-2 py-1 rounded-lg whitespace-nowrap hidden sm:block"
                    style={{ color: mod.color, background: mod.bg }}
                  >
                    {mod.label}
                  </span>

                  {/* Amount / Qty */}
                  <div className="text-right shrink-0 min-w-[80px]">
                    {entry.montant !== undefined && entry.montant !== null ? (
                      <div className="text-[12px] font-bold text-[#0F172A]">
                        {fmtFCFA(entry.montant)}
                      </div>
                    ) : entry.quantite !== undefined && entry.quantite !== null ? (
                      <div className="text-[12px] font-bold text-[#0F172A]">
                        {entry.quantite.toLocaleString(intlLocale)} u.
                      </div>
                    ) : null}
                  </div>

                </div>
              )
            })}
          </div>
        )}
      </div>

    </div>
  )
}

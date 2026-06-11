'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useTenant } from '@/lib/hooks/useTenant'
import { useLocale } from '@/lib/hooks/useLocale'
import { useFmt } from '@/lib/hooks/useFmt'
import {
  ArrowLeftRight, ArrowUpCircle, ArrowDownCircle, RotateCcw,
  Search, Filter, Download, RefreshCw, Package, Warehouse,
  Calendar, Hash, TrendingUp, TrendingDown, ChevronLeft, ChevronRight
} from 'lucide-react'

interface Movement {
  id: string
  tenant_id: string
  product_id: string
  warehouse_id: string | null
  type: string
  quantity: number
  unit_cost: number | null
  reference: string | null
  notes: string | null
  created_at: string
  // joins
  product_nom?: string
  product_sku?: string
  warehouse_nom?: string
}

const TYPE_CONFIG: Record<string, { label: string; icon: any; color: string; bg: string; sign: '+' | '-' | '=' }> = {
  entree:     { label: 'Entrée',     icon: ArrowUpCircle,   color: '#16A34A', bg: '#F0FDF4', sign: '+' },
  sortie:     { label: 'Sortie',     icon: ArrowDownCircle, color: '#DC2626', bg: '#FEF2F2', sign: '-' },
  ajustement: { label: 'Ajustement', icon: RefreshCw,       color: '#D97706', bg: '#FFFBEB', sign: '=' },
  transfert:  { label: 'Transfert',  icon: ArrowLeftRight,  color: '#2563EB', bg: '#EFF6FF', sign: '=' },
  reception:  { label: 'Réception',  icon: ArrowUpCircle,   color: '#16A34A', bg: '#F0FDF4', sign: '+' },
  retour:     { label: 'Retour',     icon: RotateCcw,       color: '#7C3AED', bg: '#F5F3FF', sign: '+' },
}

const PAGE_SIZE = 30

export default function MouvementsPage() {
  const { fmt: fmtFCFA } = useFmt()

  const { tenantId } = useTenant()
  const { t } = useLocale()

  const [movements, setMovements] = useState<Movement[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [page, setPage] = useState(0)
  const [total, setTotal] = useState(0)

  // stats
  const [stats, setStats] = useState({ entrees: 0, sorties: 0, ajustements: 0, valeur_mouvement: 0 })

  const load = useCallback(async () => {
    if (!tenantId) return
    setLoading(true)
    try {
      let query = supabase
        .from('stock_movements')
        .select('*, products(nom, sku), warehouses(nom)', { count: 'exact' })
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)

      if (typeFilter) query = query.eq('type', typeFilter)
      if (dateFrom) query = query.gte('created_at', dateFrom)
      if (dateTo) query = query.lte('created_at', dateTo + 'T23:59:59')

      const { data, error, count } = await query

      if (error?.code === '42P01') { setMovements([]); setLoading(false); return }

      const list = (data || []).map((m: any) => ({
        ...m,
        product_nom: m.products?.nom,
        product_sku: m.products?.sku,
        warehouse_nom: m.warehouses?.nom,
      }))

      setMovements(list)
      setTotal(count || 0)

      // stats (all, no pagination)
      const { data: allMov } = await supabase
        .from('stock_movements')
        .select('type, quantity, unit_cost')
        .eq('tenant_id', tenantId)
        .gte('created_at', new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString())

      const entrees = (allMov || []).filter((m: any) => ['entree', 'reception', 'retour'].includes(m.type)).reduce((s: number, m: any) => s + (m.quantity || 0), 0)
      const sorties = (allMov || []).filter((m: any) => m.type === 'sortie').reduce((s: number, m: any) => s + (m.quantity || 0), 0)
      const ajustements = (allMov || []).filter((m: any) => m.type === 'ajustement').length
      const valeur_mouvement = (allMov || []).reduce((s: number, m: any) => s + (m.quantity || 0) * (m.unit_cost || 0), 0)
      setStats({ entrees, sorties, ajustements, valeur_mouvement })

    } catch { setMovements([]) }
    setLoading(false)
  }, [tenantId, supabase, page, typeFilter, dateFrom, dateTo])

  useEffect(() => { load() }, [load])

  const filtered = search
    ? movements.filter(m =>
        (m.product_nom || '').toLowerCase().includes(search.toLowerCase()) ||
        (m.product_sku || '').toLowerCase().includes(search.toLowerCase()) ||
        (m.reference || '').toLowerCase().includes(search.toLowerCase())
      )
    : movements

  const exportCSV = () => {
    const headers = 'Date,Type,Produit,SKU,Entrepôt,Quantité,Coût unitaire,Référence,Notes\n'
    const rows = movements.map(m => [
      new Date(m.created_at).toLocaleDateString('fr-FR'),
      TYPE_CONFIG[m.type]?.label || m.type,
      m.product_nom || '',
      m.product_sku || '',
      m.warehouse_nom || '',
      m.quantity,
      m.unit_cost || '',
      m.reference || '',
      m.notes || ''
    ].join(',')).join('\n')
    const blob = new Blob([headers + rows], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = `mouvements_stocks.csv`; a.click()
  }

  const totalPages = Math.ceil(total / PAGE_SIZE)

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-[#0F172A] flex items-center gap-2">
            <ArrowLeftRight size={20} className="text-[#16A34A]" />
            {t('stock.mouvements.title')}
          </h1>
          <p className="text-xs text-[#64748B] mt-0.5">{t('stock.mouvements.subtitle')}</p>
        </div>
        <button onClick={exportCSV}
          className="flex items-center gap-1.5 border border-[#E2E8F0] text-[#374151] px-3 py-2 rounded-xl text-xs font-semibold hover:bg-[#F8FAFC] transition-colors">
          <Download size={13} /> {t('common.export')}
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: t('stock.mouvements.type.entree'), value: stats.entrees.toLocaleString(), icon: TrendingUp, color: '#16A34A', bg: '#F0FDF4' },
          { label: t('stock.mouvements.type.sortie'), value: stats.sorties.toLocaleString(), icon: TrendingDown, color: '#DC2626', bg: '#FEF2F2' },
          { label: t('stock.mouvements.type.ajust'), value: stats.ajustements, icon: RefreshCw, color: '#D97706', bg: '#FFFBEB' },
          { label: t('stock.valorisation.title'), value: fmtFCFA(stats.valeur_mouvement), icon: Package, color: '#2563EB', bg: '#EFF6FF' },
        ].map(k => (
          <div key={k.label} className="bg-white border border-[#E2E8F0] rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: k.bg }}>
                <k.icon size={14} style={{ color: k.color }} />
              </div>
              <span className="text-[11px] text-[#64748B]">{k.label}</span>
            </div>
            <p className="text-lg font-bold text-[#0F172A]">{k.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-white border border-[#E2E8F0] rounded-2xl p-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="relative md:col-span-2">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder={t('stock.mouvements.searchPlh')}
              className="w-full pl-8 pr-3 py-2 text-xs border border-[#E2E8F0] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#16A34A]/20" />
          </div>
          <select value={typeFilter} onChange={e => { setTypeFilter(e.target.value); setPage(0) }}
            className="px-3 py-2 text-xs border border-[#E2E8F0] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#16A34A]/20">
            <option value="">{t('stock.mouvements.filterAll')}</option>
            {Object.entries(TYPE_CONFIG).map(([k, v]) => (
              <option key={k} value={k}>{v.label}</option>
            ))}
          </select>
          <div className="flex gap-2">
            <input type="date" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setPage(0) }}
              className="flex-1 px-2 py-2 text-xs border border-[#E2E8F0] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#16A34A]/20" />
            <input type="date" value={dateTo} onChange={e => { setDateTo(e.target.value); setPage(0) }}
              className="flex-1 px-2 py-2 text-xs border border-[#E2E8F0] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#16A34A]/20" />
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-[#E2E8F0] rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#F1F5F9] bg-[#F8FAFC]">
                <th className="text-left px-4 py-3 text-[11px] font-semibold text-[#64748B]">{t('stock.mouvements.colDate')}</th>
                <th className="text-left px-4 py-3 text-[11px] font-semibold text-[#64748B]">{t('stock.mouvements.colType')}</th>
                <th className="text-left px-4 py-3 text-[11px] font-semibold text-[#64748B]">{t('stock.mouvements.colArticle')}</th>
                <th className="text-left px-4 py-3 text-[11px] font-semibold text-[#64748B]">{t('stock.entrepots.colNom')}</th>
                <th className="text-right px-4 py-3 text-[11px] font-semibold text-[#64748B]">{t('stock.mouvements.colQty')}</th>
                <th className="text-right px-4 py-3 text-[11px] font-semibold text-[#64748B]">Coût unit.</th>
                <th className="text-right px-4 py-3 text-[11px] font-semibold text-[#64748B]">{t('stock.page.colValeur')}</th>
                <th className="text-left px-4 py-3 text-[11px] font-semibold text-[#64748B]">{t('stock.audit.colRef')}</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} className="text-center py-12 text-[#64748B] text-sm">{t('common.loading')}</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={8} className="text-center py-12">
                  <ArrowLeftRight size={32} className="mx-auto text-[#CBD5E1] mb-2" />
                  <p className="text-sm text-[#64748B]">{t('stock.mouvements.empty')}</p>
                </td></tr>
              ) : filtered.map(m => {
                const cfg = TYPE_CONFIG[m.type] || TYPE_CONFIG.entree
                const Icon = cfg.icon
                const sign = cfg.sign
                const valeur = (m.quantity || 0) * (m.unit_cost || 0)
                return (
                  <tr key={m.id} className="border-b border-[#F8FAFC] hover:bg-[#FAFAFA] transition-colors">
                    <td className="px-4 py-3 text-[11px] text-[#64748B] whitespace-nowrap">
                      <div>{new Date(m.created_at).toLocaleDateString('fr-FR')}</div>
                      <div className="text-[10px] text-[#94A3B8]">
                        {new Date(m.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="flex items-center gap-1.5 text-[11px] font-semibold px-2 py-1 rounded-lg w-fit"
                        style={{ color: cfg.color, background: cfg.bg }}>
                        <Icon size={11} />
                        {cfg.label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-xs font-semibold text-[#0F172A]">{m.product_nom || '—'}</p>
                      {m.product_sku && (
                        <span className="text-[10px] font-mono text-[#94A3B8]">{m.product_sku}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-[11px] text-[#64748B]">
                      {m.warehouse_nom || '—'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className={`text-sm font-bold ${
                        sign === '+' ? 'text-[#16A34A]' : sign === '-' ? 'text-[#DC2626]' : 'text-[#D97706]'
                      }`}>
                        {sign}{m.quantity.toLocaleString()}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-[11px] text-[#64748B]">
                      {m.unit_cost ? fmtFCFA(m.unit_cost) : '—'}
                    </td>
                    <td className="px-4 py-3 text-right text-[11px] font-semibold text-[#0F172A]">
                      {valeur > 0 ? fmtFCFA(valeur) : '—'}
                    </td>
                    <td className="px-4 py-3 text-[11px] text-[#64748B]">
                      {m.reference || '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-[#F1F5F9]">
            <p className="text-[11px] text-[#64748B]">
              {total.toLocaleString()} mouvements — page {page + 1} / {totalPages}
            </p>
            <div className="flex gap-2">
              <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
                className="p-1.5 border border-[#E2E8F0] rounded-lg hover:bg-[#F8FAFC] disabled:opacity-40">
                <ChevronLeft size={14} />
              </button>
              <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}
                className="p-1.5 border border-[#E2E8F0] rounded-lg hover:bg-[#F8FAFC] disabled:opacity-40">
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

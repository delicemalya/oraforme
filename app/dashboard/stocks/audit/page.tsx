'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useTenant } from '@/lib/hooks/useTenant'
import { useLocale } from '@/lib/hooks/useLocale'
import { useFmt } from '@/lib/hooks/useFmt'
import {
  Shield, Search, RefreshCw, Download,
  ArrowUpCircle, ArrowDownCircle, AlertTriangle, Clock, Warehouse
} from 'lucide-react'

interface AuditLog {
  id: string; created_at: string; type: string
  quantite: number | null; unit_cost: number | null
  reference: string | null; notes: string | null
  product_id: string | null; warehouse_id: string | null
  product_nom?: string; product_sku?: string; warehouse_nom?: string
}

const TYPE_CONFIG: Record<string, { color: string; bg: string; label: string; icon: 'in' | 'out' | 'adj' }> = {
  entree:     { color: '#16A34A', bg: '#F0FDF4', label: 'Entrée',      icon: 'in' },
  reception:  { color: '#16A34A', bg: '#F0FDF4', label: 'Réception',   icon: 'in' },
  sortie:     { color: '#DC2626', bg: '#FEF2F2', label: 'Sortie',      icon: 'out' },
  ajustement: { color: '#D97706', bg: '#FFFBEB', label: 'Ajustement',  icon: 'adj' },
  transfert:  { color: '#2563EB', bg: '#EFF6FF', label: 'Transfert',   icon: 'adj' },
  retour:     { color: '#7C3AED', bg: '#F5F3FF', label: 'Retour',      icon: 'adj' },
}

const PER_PAGE = 50

export default function AuditPage() {
  const { fmt: fmtFCFA } = useFmt()
  const { tenantId } = useTenant()
  const { t } = useLocale()
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [page, setPage] = useState(0)
  const [total, setTotal] = useState(0)

  const load = useCallback(async () => {
    if (!tenantId) return
    setLoading(true)
    try {
      let q = supabase
        .from('stock_movements')
        .select(`
          id, created_at, type, quantite, unit_cost, reference, notes,
          product_id, warehouse_id,
          products:product_id (nom, sku),
          warehouses:warehouse_id (nom)
        `, { count: 'exact' })
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false })
        .range(page * PER_PAGE, (page + 1) * PER_PAGE - 1)

      if (typeFilter) q = q.eq('type', typeFilter)
      if (dateFrom) q = q.gte('created_at', dateFrom)
      if (dateTo) q = q.lte('created_at', dateTo + 'T23:59:59')

      const { data, count, error } = await q
      if (error?.code === '42P01') { setLogs([]); setLoading(false); return }
      setTotal(count || 0)
      setLogs((data || []).map((d: any) => ({
        ...d,
        product_nom: d.products?.nom || 'N/A',
        product_sku: d.products?.sku || '',
        warehouse_nom: d.warehouses?.nom || 'N/A',
      })))
    } catch { setLogs([]) }
    setLoading(false)
  }, [tenantId, typeFilter, dateFrom, dateTo, page])

  useEffect(() => { load() }, [load])
  useEffect(() => { setPage(0) }, [typeFilter, dateFrom, dateTo])

  const filtered = logs.filter(l => {
    const q = search.toLowerCase()
    return !q || (l.product_nom||'').toLowerCase().includes(q)
      || (l.product_sku||'').toLowerCase().includes(q)
      || (l.reference||'').toLowerCase().includes(q)
      || (l.warehouse_nom||'').toLowerCase().includes(q)
  })

  const exportCSV = () => {
    const headers = ['Date','Heure','Type','Produit','SKU','Entrepôt','Quantité','Coût unitaire','Référence','Notes']
    const rows = filtered.map(l => [
      new Date(l.created_at).toLocaleDateString('fr-FR'),
      new Date(l.created_at).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'}),
      l.type, l.product_nom||'', l.product_sku||'', l.warehouse_nom||'',
      l.quantite||0, l.unit_cost||0, l.reference||'', l.notes||'',
    ])
    const csv = [headers,...rows].map(r=>r.map(String).join(',')).join('\n')
    const blob = new Blob(['﻿'+csv],{type:'text/csv;charset=utf-8;'})
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href=url; a.download=`audit-stocks-${Date.now()}.csv`; a.click()
    URL.revokeObjectURL(url)
  }

  const totalEntrees = filtered.filter(l => ['entree','reception'].includes(l.type)).reduce((s,l) => s+(l.quantite||0), 0)
  const totalSorties = filtered.filter(l => l.type==='sortie').reduce((s,l) => s+(l.quantite||0), 0)
  const totalAjustements = filtered.filter(l => l.type==='ajustement').length

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-[#0F172A] flex items-center gap-2">
            <Shield size={20} className="text-[#16A34A]" />
            {t('stock.audit.title')}
          </h1>
          <p className="text-xs text-[#64748B] mt-0.5">{t('stock.audit.subtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={load} className="flex items-center gap-1.5 border border-[#E2E8F0] text-[#374151] px-3 py-2 rounded-xl text-xs font-semibold hover:bg-[#F8FAFC]">
            <RefreshCw size={13} />
          </button>
          <button onClick={exportCSV}
            className="flex items-center gap-1.5 bg-[#16A34A] text-white px-4 py-2 rounded-xl text-xs font-semibold hover:bg-[#15803D] shadow-sm">
            <Download size={13} /> {t('common.export')}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: t('stock.audit.colDate'), value: total, icon: Clock, color: '#2563EB', bg: '#EFF6FF' },
          { label: t('stock.mouvements.type.entree'), value: `${totalEntrees.toLocaleString()} u`, icon: ArrowUpCircle, color: '#16A34A', bg: '#F0FDF4' },
          { label: t('stock.mouvements.type.sortie'), value: `${totalSorties.toLocaleString()} u`, icon: ArrowDownCircle, color: '#DC2626', bg: '#FEF2F2' },
          { label: t('stock.mouvements.type.ajust'), value: totalAjustements, icon: AlertTriangle, color: '#D97706', bg: '#FFFBEB' },
        ].map(k => (
          <div key={k.label} className="bg-white border border-[#E2E8F0] rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: k.bg }}>
                <k.icon size={13} style={{ color: k.color }} />
              </div>
              <span className="text-[11px] text-[#64748B]">{k.label}</span>
            </div>
            <p className="text-xl font-bold text-[#0F172A]">{k.value}</p>
          </div>
        ))}
      </div>

      <div className="bg-white border border-[#E2E8F0] rounded-2xl p-3">
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder={t('stock.audit.searchPlh')}
              className="w-full pl-8 pr-3 py-2 text-xs border border-[#E2E8F0] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#16A34A]/20" />
          </div>
          <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}
            className="px-3 py-2 text-xs border border-[#E2E8F0] rounded-xl focus:outline-none">
            <option value="">{t('stock.audit.filterAll')}</option>
            {Object.entries(TYPE_CONFIG).map(([v,s]) => <option key={v} value={v}>{s.label}</option>)}
          </select>
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
            className="px-3 py-2 text-xs border border-[#E2E8F0] rounded-xl focus:outline-none" />
          <span className="flex items-center text-xs text-[#94A3B8]">→</span>
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
            className="px-3 py-2 text-xs border border-[#E2E8F0] rounded-xl focus:outline-none" />
          {(typeFilter || dateFrom || dateTo) && (
            <button onClick={() => { setTypeFilter(''); setDateFrom(''); setDateTo('') }}
              className="px-3 py-2 text-xs font-semibold text-[#DC2626] border border-[#FCA5A5] rounded-xl hover:bg-[#FEF2F2]">
              Effacer filtres
            </button>
          )}
        </div>
      </div>

      <div className="bg-white border border-[#E2E8F0] rounded-2xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20 text-sm text-[#64748B]">Chargement de l&apos;audit…</div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[#F1F5F9] bg-[#F8FAFC]">
                    <th className="text-left px-4 py-3 text-[11px] font-semibold text-[#64748B]">{t('stock.audit.colDate')}</th>
                    <th className="text-center px-4 py-3 text-[11px] font-semibold text-[#64748B]">{t('stock.audit.colType')}</th>
                    <th className="text-left px-4 py-3 text-[11px] font-semibold text-[#64748B]">{t('stock.audit.colArticle')}</th>
                    <th className="text-left px-4 py-3 text-[11px] font-semibold text-[#64748B]">{t('stock.entrepots.colNom')}</th>
                    <th className="text-right px-4 py-3 text-[11px] font-semibold text-[#64748B]">{t('stock.audit.colQty')}</th>
                    <th className="text-right px-4 py-3 text-[11px] font-semibold text-[#64748B]">Coût unit.</th>
                    <th className="text-left px-4 py-3 text-[11px] font-semibold text-[#64748B]">{t('stock.audit.colRef')}</th>
                    <th className="text-left px-4 py-3 text-[11px] font-semibold text-[#64748B] hidden lg:table-cell">Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr><td colSpan={8} className="text-center py-12 text-sm text-[#64748B]">{t('stock.audit.empty')}</td></tr>
                  ) : filtered.map(l => {
                    const cfg = TYPE_CONFIG[l.type] || { color: '#64748B', bg: '#F8FAFC', label: l.type, icon: 'adj' as const }
                    const isIn = ['entree','reception'].includes(l.type)
                    const isOut = l.type === 'sortie'
                    return (
                      <tr key={l.id} className="border-b border-[#F8FAFC] hover:bg-[#FAFAFA]">
                        <td className="px-4 py-3">
                          <p className="text-xs text-[#374151]">{new Date(l.created_at).toLocaleDateString('fr-FR')}</p>
                          <p className="text-[10px] text-[#94A3B8]">{new Date(l.created_at).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'})}</p>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ color: cfg.color, background: cfg.bg }}>
                            {cfg.label}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-xs font-bold text-[#0F172A]">{l.product_nom}</p>
                          <span className="text-[10px] font-mono text-[#94A3B8]">{l.product_sku}</span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1">
                            <Warehouse size={11} className="text-[#94A3B8]" />
                            <span className="text-xs text-[#374151]">{l.warehouse_nom}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className={`text-xs font-bold ${isIn ? 'text-[#16A34A]' : isOut ? 'text-[#DC2626]' : 'text-[#D97706]'}`}>
                            {isIn ? '+' : isOut ? '−' : '±'}{(l.quantite||0).toLocaleString()}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right text-xs text-[#64748B]">
                          {l.unit_cost ? fmtFCFA(l.unit_cost) : '—'}
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-[11px] font-mono text-[#64748B]">{l.reference || '—'}</span>
                        </td>
                        <td className="px-4 py-3 hidden lg:table-cell">
                          <span className="text-[11px] text-[#94A3B8] truncate max-w-[150px] block">{l.notes || '—'}</span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-between px-4 py-3 border-t border-[#F1F5F9]">
              <span className="text-[11px] text-[#94A3B8]">{total} {t('stock.audit.title')} — Page {page+1}</span>
              <div className="flex items-center gap-2">
                <button onClick={() => setPage(p => Math.max(0, p-1))} disabled={page === 0}
                  className="px-3 py-1.5 text-xs border border-[#E2E8F0] rounded-lg disabled:opacity-40 hover:bg-[#F8FAFC]">
                  ← {t('common.prev')}
                </button>
                <button onClick={() => setPage(p => p+1)} disabled={(page+1)*PER_PAGE >= total}
                  className="px-3 py-1.5 text-xs border border-[#E2E8F0] rounded-lg disabled:opacity-40 hover:bg-[#F8FAFC]">
                  {t('common.next')} →
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

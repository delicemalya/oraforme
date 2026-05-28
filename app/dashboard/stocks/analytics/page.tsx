'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useTenant } from '@/lib/hooks/useTenant'
import { useLocale } from '@/lib/hooks/useLocale'
import { fmtFCFA } from '@/lib/admin-config'
import {
  BarChart3, TrendingUp, TrendingDown, Package,
  RefreshCw, Calendar, Download, DollarSign,
  ArrowUpCircle, ArrowDownCircle, Warehouse, Users2
} from 'lucide-react'

interface MonthData {
  mois: string
  label: string
  entrees_qty: number
  sorties_qty: number
  entrees_val: number
  sorties_val: number
  achats: number
}

interface TopProduct {
  nom: string
  sku: string
  valeur: number
  quantite: number
  type: 'entree' | 'sortie'
}

type Period = '3m' | '6m' | '12m'

const MONTHS_FR = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc']

export default function StocksAnalyticsPage() {

  const { tenantId } = useTenant()
  const { t } = useLocale()

  const [period, setPeriod] = useState<Period>('6m')
  const [data, setData] = useState<MonthData[]>([])
  const [topEntrees, setTopEntrees] = useState<TopProduct[]>([])
  const [topSorties, setTopSorties] = useState<TopProduct[]>([])
  const [loading, setLoading] = useState(true)

  const [summary, setSummary] = useState({
    valeur_stock: 0,
    total_achats: 0,
    total_sorties_val: 0,
    nb_produits: 0,
    nb_fournisseurs: 0,
    rotation_moy: 0,
  })

  const getMonths = useCallback((p: Period) => {
    const n = p === '3m' ? 3 : p === '6m' ? 6 : 12
    const months: string[] = []
    for (let i = n - 1; i >= 0; i--) {
      const d = new Date()
      d.setMonth(d.getMonth() - i)
      months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
    }
    return months
  }, [])

  const load = useCallback(async () => {
    if (!tenantId) return
    setLoading(true)
    try {
      const months = getMonths(period)
      const fromDate = months[0] + '-01'

      // Movements
      const { data: movs, error: e1 } = await supabase
        .from('stock_movements')
        .select('type, quantity, unit_cost, created_at, product_id, products(nom, sku)')
        .eq('tenant_id', tenantId)
        .gte('created_at', fromDate)
        .order('created_at')

      if (e1?.code === '42P01') { setData([]); setLoading(false); return }

      // Purchases
      const { data: purch } = await supabase
        .from('purchases')
        .select('total_amount, date')
        .eq('tenant_id', tenantId)
        .gte('date', fromDate)

      // Products for stock value
      const { data: prods } = await supabase
        .from('products')
        .select('id, nom, sku, stock_actuel, prix_achat, prix_vente, seuil_alerte')
        .eq('tenant_id', tenantId)

      // Suppliers count
      const { count: suppliersCount } = await supabase
        .from('suppliers')
        .select('id', { count: 'exact' })
        .eq('tenant_id', tenantId)
        .eq('actif', true)

      // Build monthly data
      const monthMap: Record<string, MonthData> = {}
      months.forEach(m => {
        const [y, mo] = m.split('-')
        monthMap[m] = {
          mois: m,
          label: `${MONTHS_FR[Number(mo) - 1]} ${y.slice(2)}`,
          entrees_qty: 0, sorties_qty: 0,
          entrees_val: 0, sorties_val: 0,
          achats: 0,
        }
      })

      for (const mv of (movs || [])) {
        const d = new Date(mv.created_at)
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
        if (!monthMap[key]) continue
        const valeur = (mv.quantity || 0) * (mv.unit_cost || 0)
        if (['entree', 'reception', 'retour'].includes(mv.type)) {
          monthMap[key].entrees_qty += mv.quantity || 0
          monthMap[key].entrees_val += valeur
        } else if (mv.type === 'sortie') {
          monthMap[key].sorties_qty += mv.quantity || 0
          monthMap[key].sorties_val += valeur
        }
      }

      for (const p of (purch || [])) {
        const d = new Date(p.date)
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
        if (monthMap[key]) monthMap[key].achats += p.total_amount || 0
      }

      setData(Object.values(monthMap))

      // Top products by entries
      const entreeMap: Record<string, { nom: string; sku: string; quantite: number; valeur: number }> = {}
      const sortieMap: Record<string, { nom: string; sku: string; quantite: number; valeur: number }> = {}

      for (const mv of (movs || [])) {
        const prodNom = (mv as any).products?.nom || 'Inconnu'
        const prodSku = (mv as any).products?.sku || ''
        const key = mv.product_id || 'x'
        const valeur = (mv.quantity || 0) * (mv.unit_cost || 0)
        if (['entree', 'reception'].includes(mv.type)) {
          if (!entreeMap[key]) entreeMap[key] = { nom: prodNom, sku: prodSku, quantite: 0, valeur: 0 }
          entreeMap[key].quantite += mv.quantity || 0
          entreeMap[key].valeur += valeur
        } else if (mv.type === 'sortie') {
          if (!sortieMap[key]) sortieMap[key] = { nom: prodNom, sku: prodSku, quantite: 0, valeur: 0 }
          sortieMap[key].quantite += mv.quantity || 0
          sortieMap[key].valeur += valeur
        }
      }

      setTopEntrees(
        Object.values(entreeMap)
          .sort((a, b) => b.valeur - a.valeur)
          .slice(0, 5)
          .map(p => ({ ...p, type: 'entree' as const }))
      )
      setTopSorties(
        Object.values(sortieMap)
          .sort((a, b) => b.valeur - a.valeur)
          .slice(0, 5)
          .map(p => ({ ...p, type: 'sortie' as const }))
      )

      // Summary
      const valeur_stock = (prods || []).reduce((s: number, p: any) => s + (p.stock_actuel || 0) * (p.prix_achat || 0), 0)
      const total_achats = (purch || []).reduce((s: number, p: any) => s + (p.total_amount || 0), 0)
      const total_sorties_val = Object.values(monthMap).reduce((s, m) => s + m.sorties_val, 0)
      const avgStock = (prods || []).reduce((s: number, p: any) => s + (p.stock_actuel || 0), 0) / Math.max((prods || []).length, 1)
      const rotation_moy = avgStock > 0 ? (total_sorties_val / Math.max(valeur_stock, 1)) : 0

      setSummary({
        valeur_stock,
        total_achats,
        total_sorties_val,
        nb_produits: (prods || []).length,
        nb_fournisseurs: suppliersCount || 0,
        rotation_moy,
      })

    } catch { setData([]) }
    setLoading(false)
  }, [tenantId, supabase, period, getMonths])

  useEffect(() => { load() }, [load])

  const maxVal = Math.max(...data.map(d => Math.max(d.entrees_val, d.sorties_val)), 1)
  const maxQty = Math.max(...data.map(d => Math.max(d.entrees_qty, d.sorties_qty)), 1)

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-[#0F172A] flex items-center gap-2">
            <BarChart3 size={20} className="text-[#16A34A]" />
            {t('stock.analytics.title')}
          </h1>
          <p className="text-xs text-[#64748B] mt-0.5">{t('stock.analytics.subtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 bg-[#F1F5F9] rounded-xl p-1">
            {(['3m', '6m', '12m'] as Period[]).map(p => (
              <button key={p} onClick={() => setPeriod(p)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  period === p ? 'bg-white shadow-sm text-[#0F172A]' : 'text-[#64748B]'
                }`}>
                {p}
              </button>
            ))}
          </div>
          <button onClick={load}
            className="flex items-center gap-1.5 border border-[#E2E8F0] text-[#374151] px-3 py-2 rounded-xl text-xs font-semibold hover:bg-[#F8FAFC]">
            <RefreshCw size={13} />
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { label: t('stock.analytics.kpi.valeur'), value: fmtFCFA(summary.valeur_stock), icon: DollarSign, color: '#16A34A', bg: '#F0FDF4' },
          { label: 'Achats période', value: fmtFCFA(summary.total_achats), icon: ArrowUpCircle, color: '#2563EB', bg: '#EFF6FF' },
          { label: 'Sorties période', value: fmtFCFA(summary.total_sorties_val), icon: ArrowDownCircle, color: '#DC2626', bg: '#FEF2F2' },
          { label: 'Produits actifs', value: summary.nb_produits, icon: Package, color: '#D97706', bg: '#FFFBEB' },
          { label: t('stock.analytics.kpi.ruptures'), value: summary.nb_fournisseurs, icon: Users2, color: '#7C3AED', bg: '#F5F3FF' },
          { label: t('stock.analytics.kpi.rotation'), value: summary.rotation_moy.toFixed(2) + 'x', icon: RefreshCw, color: '#0891B2', bg: '#ECFEFF' },
        ].map(k => (
          <div key={k.label} className="bg-white border border-[#E2E8F0] rounded-2xl p-4">
            <div className="flex items-center gap-1.5 mb-2">
              <div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ background: k.bg }}>
                <k.icon size={12} style={{ color: k.color }} />
              </div>
              <span className="text-[10px] text-[#64748B]">{k.label}</span>
            </div>
            <p className="text-sm font-bold text-[#0F172A] truncate">{k.value}</p>
          </div>
        ))}
      </div>

      {/* Bar chart: Entrées vs Sorties (valeur) */}
      {loading ? (
        <div className="flex items-center justify-center py-20 bg-white border border-[#E2E8F0] rounded-2xl text-sm text-[#64748B]">
          {t('common.loading')}
        </div>
      ) : (
        <>
          <div className="bg-white border border-[#E2E8F0] rounded-2xl p-5">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-xs font-bold text-[#0F172A]">Flux de stock — valeur ({period})</h3>
              <div className="flex items-center gap-4 text-[10px] text-[#64748B]">
                <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-[#16A34A] inline-block" /> Entrées</span>
                <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-[#DC2626] inline-block" /> Sorties</span>
              </div>
            </div>
            <div className="flex items-end gap-1.5 h-44">
              {data.map(d => (
                <div key={d.mois} className="flex-1 flex flex-col items-center gap-0.5">
                  <div className="w-full flex items-end gap-0.5 h-36">
                    <div
                      className="flex-1 bg-[#16A34A] rounded-t-sm transition-all min-h-[2px]"
                      style={{ height: `${Math.max(2, (d.entrees_val / maxVal) * 100)}%` }}
                      title={fmtFCFA(d.entrees_val)} />
                    <div
                      className="flex-1 bg-[#DC2626] rounded-t-sm transition-all min-h-[2px]"
                      style={{ height: `${Math.max(2, (d.sorties_val / maxVal) * 100)}%` }}
                      title={fmtFCFA(d.sorties_val)} />
                  </div>
                  <span className="text-[9px] text-[#94A3B8]">{d.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Movements quantity chart */}
          <div className="bg-white border border-[#E2E8F0] rounded-2xl p-5">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-xs font-bold text-[#0F172A]">Volumes de mouvement — quantités</h3>
              <div className="flex items-center gap-4 text-[10px] text-[#64748B]">
                <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-[#2563EB] inline-block" /> Achats</span>
              </div>
            </div>
            <div className="space-y-2">
              {data.map(d => {
                const max = Math.max(d.achats, 1)
                return (
                  <div key={d.mois} className="flex items-center gap-3">
                    <span className="w-14 text-[10px] text-[#94A3B8] text-right shrink-0">{d.label}</span>
                    <div className="flex-1 flex items-center gap-2">
                      <div className="flex-1 h-5 bg-[#F1F5F9] rounded-full overflow-hidden">
                        <div className="h-full bg-[#2563EB] rounded-full"
                          style={{ width: `${(d.achats / Math.max(...data.map(x => x.achats), 1)) * 100}%` }} />
                      </div>
                      <span className="text-[10px] text-[#64748B] w-20 text-right">{fmtFCFA(d.achats)}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Top products */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Top entrées */}
            <div className="bg-white border border-[#E2E8F0] rounded-2xl p-5">
              <h3 className="text-xs font-bold text-[#0F172A] mb-4 flex items-center gap-2">
                <ArrowUpCircle size={13} className="text-[#16A34A]" />
                Top produits — entrées (valeur)
              </h3>
              {topEntrees.length === 0 ? (
                <p className="text-xs text-[#94A3B8] text-center py-4">Aucune donnée</p>
              ) : (
                <div className="space-y-3">
                  {topEntrees.map((p, i) => (
                    <div key={p.sku + i} className="flex items-center gap-3">
                      <span className="w-5 h-5 rounded-full bg-[#F0FDF4] text-[#16A34A] text-[10px] font-bold flex items-center justify-center">
                        {i + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-[#0F172A] truncate">{p.nom}</p>
                        <p className="text-[10px] font-mono text-[#94A3B8]">{p.sku}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-bold text-[#16A34A]">{fmtFCFA(p.valeur)}</p>
                        <p className="text-[10px] text-[#94A3B8]">{p.quantite.toLocaleString()} u.</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Top sorties */}
            <div className="bg-white border border-[#E2E8F0] rounded-2xl p-5">
              <h3 className="text-xs font-bold text-[#0F172A] mb-4 flex items-center gap-2">
                <ArrowDownCircle size={13} className="text-[#DC2626]" />
                Top produits — sorties (valeur)
              </h3>
              {topSorties.length === 0 ? (
                <p className="text-xs text-[#94A3B8] text-center py-4">Aucune donnée</p>
              ) : (
                <div className="space-y-3">
                  {topSorties.map((p, i) => (
                    <div key={p.sku + i} className="flex items-center gap-3">
                      <span className="w-5 h-5 rounded-full bg-[#FEF2F2] text-[#DC2626] text-[10px] font-bold flex items-center justify-center">
                        {i + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-[#0F172A] truncate">{p.nom}</p>
                        <p className="text-[10px] font-mono text-[#94A3B8]">{p.sku}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-bold text-[#DC2626]">{fmtFCFA(p.valeur)}</p>
                        <p className="text-[10px] text-[#94A3B8]">{p.quantite.toLocaleString()} u.</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Monthly data table */}
          <div className="bg-white border border-[#E2E8F0] rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-[#F1F5F9]">
              <h3 className="text-xs font-bold text-[#0F172A]">Tableau récapitulatif mensuel</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-[#F8FAFC]">
                    <th className="text-left px-4 py-3 text-[11px] font-semibold text-[#64748B]">Mois</th>
                    <th className="text-right px-4 py-3 text-[11px] font-semibold text-[#64748B]">Entrées (qté)</th>
                    <th className="text-right px-4 py-3 text-[11px] font-semibold text-[#64748B]">Entrées (valeur)</th>
                    <th className="text-right px-4 py-3 text-[11px] font-semibold text-[#64748B]">Sorties (qté)</th>
                    <th className="text-right px-4 py-3 text-[11px] font-semibold text-[#64748B]">Sorties (valeur)</th>
                    <th className="text-right px-4 py-3 text-[11px] font-semibold text-[#64748B]">Achats</th>
                    <th className="text-right px-4 py-3 text-[11px] font-semibold text-[#64748B]">Net</th>
                  </tr>
                </thead>
                <tbody>
                  {data.map(d => {
                    const net = d.entrees_val - d.sorties_val
                    return (
                      <tr key={d.mois} className="border-t border-[#F8FAFC] hover:bg-[#FAFAFA]">
                        <td className="px-4 py-3 text-xs font-semibold text-[#0F172A]">{d.label}</td>
                        <td className="px-4 py-3 text-right text-xs text-[#16A34A] font-semibold">+{d.entrees_qty.toLocaleString()}</td>
                        <td className="px-4 py-3 text-right text-xs font-semibold text-[#16A34A]">{fmtFCFA(d.entrees_val)}</td>
                        <td className="px-4 py-3 text-right text-xs text-[#DC2626] font-semibold">-{d.sorties_qty.toLocaleString()}</td>
                        <td className="px-4 py-3 text-right text-xs font-semibold text-[#DC2626]">{fmtFCFA(d.sorties_val)}</td>
                        <td className="px-4 py-3 text-right text-xs text-[#2563EB]">{fmtFCFA(d.achats)}</td>
                        <td className="px-4 py-3 text-right text-xs font-bold" style={{ color: net >= 0 ? '#16A34A' : '#DC2626' }}>
                          {net >= 0 ? '+' : ''}{fmtFCFA(net)}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t border-[#E2E8F0] bg-[#F8FAFC] font-bold">
                    <td className="px-4 py-3 text-xs text-[#374151]">Total</td>
                    <td className="px-4 py-3 text-right text-xs text-[#16A34A]">
                      +{data.reduce((s, d) => s + d.entrees_qty, 0).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right text-xs text-[#16A34A]">{fmtFCFA(data.reduce((s, d) => s + d.entrees_val, 0))}</td>
                    <td className="px-4 py-3 text-right text-xs text-[#DC2626]">
                      -{data.reduce((s, d) => s + d.sorties_qty, 0).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right text-xs text-[#DC2626]">{fmtFCFA(data.reduce((s, d) => s + d.sorties_val, 0))}</td>
                    <td className="px-4 py-3 text-right text-xs text-[#2563EB]">{fmtFCFA(data.reduce((s, d) => s + d.achats, 0))}</td>
                    <td className="px-4 py-3 text-right text-sm text-[#16A34A]">
                      {fmtFCFA(data.reduce((s, d) => s + d.entrees_val - d.sorties_val, 0))}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

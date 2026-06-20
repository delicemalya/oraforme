'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useTenant } from '@/lib/hooks/useTenant'
import { useLocale } from '@/lib/hooks/useLocale'
import { useFmt } from '@/lib/hooks/useFmt'
import {
  DollarSign, Package, TrendingUp,
  BarChart3, RefreshCw, Search,
  AlertTriangle
} from 'lucide-react'

interface ProductValuation {
  id: string
  nom: string
  sku: string
  categorie: string
  unite: string
  stock_actuel: number
  prix_achat: number
  prix_vente: number
  seuil_alerte: number
  stock_max: number | null
  // CMP calculé
  cmp: number
  valeur_stock: number
  marge_brute: number
  pct_marge: number
  rotation: number
  statut: string
}

interface CategoryValuation {
  nom: string
  nb_produits: number
  valeur_total: number
  valeur_pct: number
}

const METHODE_OPTIONS = ['CMP', 'FIFO', 'LIFO', 'PMP']

export default function ValorisationPage() {
  const { fmt: fmtFCFA } = useFmt()

  const { tenantId } = useTenant()
  const { t } = useLocale()

  const [products, setProducts] = useState<ProductValuation[]>([])
  const [categories, setCategories] = useState<CategoryValuation[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [methode, setMethode] = useState('CMP')
  const [categorieFilter, setCategorieFilter] = useState('')

  const load = useCallback(async () => {
    if (!tenantId) return
    setLoading(true)
    try {
      const { data: prods, error: e1 } = await supabase
        .from('products')
        .select('id, nom, sku, categorie, unite, stock_actuel, prix_achat, prix_vente, seuil_alerte, stock_max')
        .eq('tenant_id', tenantId)
        .order('nom')

      if (e1?.code === '42P01') { setProducts([]); setLoading(false); return }

      // Load movements for CMP calculation
      const { data: movements } = await supabase
        .from('stock_movements')
        .select('product_id, type, quantity, unit_cost')
        .eq('tenant_id', tenantId)
        .in('type', ['entree', 'reception'])

      // Load sorties for rotation
      const thisYear = new Date().getFullYear()
      const { data: sorties } = await supabase
        .from('stock_movements')
        .select('product_id, quantity')
        .eq('tenant_id', tenantId)
        .eq('type', 'sortie')
        .gte('created_at', `${thisYear}-01-01`)

      const list: ProductValuation[] = (prods || []).map((p: any) => {
        // CMP = Σ(qty * cost) / Σ(qty) from all inbound movements
        const inboundMovs = (movements || []).filter((m: any) => m.product_id === p.id)
        const totalQtyIn = inboundMovs.reduce((s: number, m: any) => s + (m.quantity || 0), 0)
        const totalCostIn = inboundMovs.reduce((s: number, m: any) => s + (m.quantity || 0) * (m.unit_cost || 0), 0)
        const cmp = totalQtyIn > 0 ? totalCostIn / totalQtyIn : p.prix_achat

        const valeur_stock = (p.stock_actuel || 0) * cmp
        const marge_brute = p.prix_vente - cmp
        const pct_marge = cmp > 0 ? (marge_brute / p.prix_vente) * 100 : 0

        // Rotation = qty sortie annuelle / stock moyen
        const qtySortie = (sorties || []).filter((s: any) => s.product_id === p.id).reduce((acc: number, s: any) => acc + (s.quantity || 0), 0)
        const rotation = (p.stock_actuel || 0) > 0 ? qtySortie / (p.stock_actuel || 1) : 0

        // Statut
        let statut = 'OK'
        if ((p.stock_actuel || 0) <= 0) statut = 'Rupture'
        else if ((p.stock_actuel || 0) <= (p.seuil_alerte || 0)) statut = 'Faible'
        else if (p.stock_max && (p.stock_actuel || 0) >= p.stock_max) statut = 'Surplus'

        return { ...p, cmp, valeur_stock, marge_brute, pct_marge, rotation, statut }
      })

      setProducts(list)

      // Category aggregation
      const catMap: Record<string, CategoryValuation> = {}
      const totalVal = list.reduce((s, p) => s + p.valeur_stock, 0)
      for (const p of list) {
        const cat = p.categorie || 'Sans catégorie'
        if (!catMap[cat]) catMap[cat] = { nom: cat, nb_produits: 0, valeur_total: 0, valeur_pct: 0 }
        catMap[cat].nb_produits++
        catMap[cat].valeur_total += p.valeur_stock
      }
      Object.values(catMap).forEach(c => {
        c.valeur_pct = totalVal > 0 ? (c.valeur_total / totalVal) * 100 : 0
      })
      setCategories(Object.values(catMap).sort((a, b) => b.valeur_total - a.valeur_total))

    } catch { setProducts([]) }
    setLoading(false)
  }, [tenantId])

  useEffect(() => { load() }, [load])

  const filtered = products
    .filter(p =>
      p.nom.toLowerCase().includes(search.toLowerCase()) ||
      p.sku.toLowerCase().includes(search.toLowerCase())
    )
    .filter(p => !categorieFilter || p.categorie === categorieFilter)

  const totalValeur = products.reduce((s, p) => s + p.valeur_stock, 0)
  const totalMarge = products.reduce((s, p) => s + (p.prix_vente - p.cmp) * (p.stock_actuel || 0), 0)
  const avgMarge = products.length > 0
    ? products.reduce((s, p) => s + p.pct_marge, 0) / products.length
    : 0
  const nbRuptures = products.filter(p => p.statut === 'Rupture').length

  const uniqueCategories = [...new Set(products.map(p => p.categorie).filter(Boolean))]

  const getStatutStyle = (statut: string) => {
    if (statut === 'Rupture') return 'bg-[#FEF2F2] text-[#DC2626]'
    if (statut === 'Faible') return 'bg-[#FFFBEB] text-[#D97706]'
    if (statut === 'Surplus') return 'bg-[#EFF6FF] text-[#2563EB]'
    return 'bg-[#F0FDF4] text-[#16A34A]'
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-[#0F172A] flex items-center gap-2">
            <DollarSign size={20} className="text-[#16A34A]" />
            {t('stock.valorisation.title')}
          </h1>
          <p className="text-xs text-[#64748B] mt-0.5">{t('stock.valorisation.subtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          <select value={methode} onChange={e => setMethode(e.target.value)}
            className="px-3 py-2 text-xs border border-[#E2E8F0] rounded-xl focus:outline-none bg-white font-semibold">
            {METHODE_OPTIONS.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
          <button onClick={load}
            className="flex items-center gap-1.5 border border-[#E2E8F0] text-[#374151] px-3 py-2 rounded-xl text-xs font-semibold hover:bg-[#F8FAFC]">
            <RefreshCw size={13} /> {t('common.refresh')}
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: t('stock.valorisation.totalValue'), value: fmtFCFA(totalValeur), icon: DollarSign, color: '#16A34A', bg: '#F0FDF4', sub: `${methode}` },
          { label: t('stock.valorisation.colValeur'), value: fmtFCFA(totalMarge), icon: TrendingUp, color: '#2563EB', bg: '#EFF6FF', sub: `Moy. ${avgMarge.toFixed(1)}%` },
          { label: t('stock.alertes.critical'), value: nbRuptures, icon: AlertTriangle, color: '#DC2626', bg: '#FEF2F2', sub: 'produits à 0' },
          { label: t('stock.valorisation.colArticle'), value: products.length, icon: Package, color: '#D97706', bg: '#FFFBEB', sub: `${categories.length} catégories` },
        ].map(k => (
          <div key={k.label} className="bg-white border border-[#E2E8F0] rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: k.bg }}>
                <k.icon size={14} style={{ color: k.color }} />
              </div>
              <span className="text-[11px] text-[#64748B]">{k.label}</span>
            </div>
            <p className="text-lg font-bold text-[#0F172A]">{k.value}</p>
            <p className="text-[10px] text-[#94A3B8] mt-0.5">{k.sub}</p>
          </div>
        ))}
      </div>

      {/* Categories distribution */}
      {categories.length > 0 && (
        <div className="bg-white border border-[#E2E8F0] rounded-2xl p-5">
          <h3 className="text-xs font-bold text-[#0F172A] mb-4 flex items-center gap-2">
            <BarChart3 size={14} className="text-[#16A34A]" />
            Répartition par catégorie
          </h3>
          <div className="space-y-3">
            {categories.slice(0, 8).map(cat => (
              <div key={cat.nom}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-[#374151] font-medium">{cat.nom}</span>
                  <div className="flex items-center gap-3">
                    <span className="text-[11px] text-[#64748B]">{cat.nb_produits} produits</span>
                    <span className="text-xs font-bold text-[#0F172A]">{fmtFCFA(cat.valeur_total)}</span>
                    <span className="text-[11px] text-[#94A3B8] w-10 text-right">{cat.valeur_pct.toFixed(1)}%</span>
                  </div>
                </div>
                <div className="h-2 bg-[#F1F5F9] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#16A34A] rounded-full transition-all"
                    style={{ width: `${cat.valeur_pct}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white border border-[#E2E8F0] rounded-2xl p-3 flex gap-3">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder={t('stock.valorisation.searchPlh')}
            className="w-full pl-8 pr-3 py-2 text-xs border border-[#E2E8F0] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#16A34A]/20" />
        </div>
        <select value={categorieFilter} onChange={e => setCategorieFilter(e.target.value)}
          className="px-3 py-2 text-xs border border-[#E2E8F0] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#16A34A]/20">
          <option value="">Toutes catégories</option>
          {uniqueCategories.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {/* Product table */}
      <div className="bg-white border border-[#E2E8F0] rounded-2xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20 text-sm text-[#64748B]">{t('common.loading')}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#F1F5F9] bg-[#F8FAFC]">
                  <th className="text-left px-4 py-3 text-[11px] font-semibold text-[#64748B]">{t('stock.valorisation.colArticle')}</th>
                  <th className="text-left px-4 py-3 text-[11px] font-semibold text-[#64748B]">{t('stock.page.colCat')}</th>
                  <th className="text-right px-4 py-3 text-[11px] font-semibold text-[#64748B]">{t('stock.valorisation.colQty')}</th>
                  <th className="text-right px-4 py-3 text-[11px] font-semibold text-[#64748B]">
                    {t('stock.valorisation.colPuMoyen')}/{methode}
                  </th>
                  <th className="text-right px-4 py-3 text-[11px] font-semibold text-[#64748B]">{t('stock.page.colPrix')}</th>
                  <th className="text-right px-4 py-3 text-[11px] font-semibold text-[#64748B]">{t('stock.valorisation.colValeur')}</th>
                  <th className="text-right px-4 py-3 text-[11px] font-semibold text-[#64748B]">Marge</th>
                  <th className="text-right px-4 py-3 text-[11px] font-semibold text-[#64748B]">{t('stock.valorisation.colRotation')}</th>
                  <th className="text-center px-4 py-3 text-[11px] font-semibold text-[#64748B]">{t('stock.page.colStatut')}</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={9} className="text-center py-12 text-sm text-[#64748B]">{t('stock.valorisation.empty')}</td></tr>
                ) : filtered.map(p => (
                  <tr key={p.id} className="border-b border-[#F8FAFC] hover:bg-[#FAFAFA]">
                    <td className="px-4 py-3">
                      <p className="text-xs font-bold text-[#0F172A]">{p.nom}</p>
                      <span className="text-[10px] font-mono text-[#94A3B8]">{p.sku}</span>
                    </td>
                    <td className="px-4 py-3 text-[11px] text-[#64748B]">{p.categorie || '—'}</td>
                    <td className="px-4 py-3 text-right">
                      <p className="text-xs font-bold text-[#0F172A]">{(p.stock_actuel || 0).toLocaleString()}</p>
                      <p className="text-[10px] text-[#94A3B8]">{p.unite}</p>
                    </td>
                    <td className="px-4 py-3 text-right text-xs font-mono text-[#374151]">
                      {fmtFCFA(p.cmp)}
                    </td>
                    <td className="px-4 py-3 text-right text-xs text-[#64748B]">
                      {fmtFCFA(p.prix_vente)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="text-xs font-bold text-[#0F172A]">{fmtFCFA(p.valeur_stock)}</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <p className={`text-xs font-bold ${p.marge_brute >= 0 ? 'text-[#16A34A]' : 'text-[#DC2626]'}`}>
                        {p.pct_marge.toFixed(1)}%
                      </p>
                      <p className="text-[10px] text-[#94A3B8]">{fmtFCFA(p.marge_brute)}/u</p>
                    </td>
                    <td className="px-4 py-3 text-right text-xs text-[#64748B]">
                      {p.rotation.toFixed(2)}x
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${getStatutStyle(p.statut)}`}>
                        {p.statut}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
              {filtered.length > 0 && (
                <tfoot>
                  <tr className="border-t border-[#E2E8F0] bg-[#F8FAFC] font-bold">
                    <td colSpan={5} className="px-4 py-3 text-xs text-right text-[#374151]">
                      Total ({filtered.length} produits)
                    </td>
                    <td className="px-4 py-3 text-right text-sm text-[#16A34A] font-bold">
                      {fmtFCFA(filtered.reduce((s, p) => s + p.valeur_stock, 0))}
                    </td>
                    <td className="px-4 py-3 text-right text-xs text-[#16A34A]">
                      {filtered.length > 0
                        ? (filtered.reduce((s, p) => s + p.pct_marge, 0) / filtered.length).toFixed(1) + '%'
                        : '—'}
                    </td>
                    <td colSpan={2} />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useTenant } from '@/lib/hooks/useTenant'
import { useLocale } from '@/lib/hooks/useLocale'
import { fmtFCFA } from '@/lib/admin-config'
import Link from 'next/link'
import {
  Package, AlertTriangle, TrendingDown, Loader2,
  ArrowUpCircle, ArrowDownCircle, Warehouse, Users2,
  ShoppingCart, BarChart3, RefreshCw, Eye,
  DollarSign, ClipboardList, Boxes, Truck,
} from 'lucide-react'
import MIAAContextButton from '@/components/miaa/MIAAContextButton'

// ── Types ──────────────────────────────────────────────────────────────────────

interface Product {
  id: string; nom: string; categorie: string | null; sku: string | null
  unite: string; prix_achat: number; prix_vente: number
  seuil_alerte: number; stock_actuel: number
}

interface Movement {
  id: string; type: string; quantite: number; created_at: string
  products: { nom: string; unite: string } | null
}

interface KpiData {
  totalProduits: number
  produitsFaibles: number
  ruptures: number
  valeurStock: number
  mouvementsMois: number
  fournisseursActifs: number
  achatsMois: number
  entrepots: number
}

export default function StocksDashboard() {
  const { tenantId } = useTenant()
  const { t } = useLocale()
  const [kpis, setKpis]             = useState<KpiData>({ totalProduits: 0, produitsFaibles: 0, ruptures: 0, valeurStock: 0, mouvementsMois: 0, fournisseursActifs: 0, achatsMois: 0, entrepots: 0 })
  const [produitsFaibles, setProduitsFaibles] = useState<Product[]>([])
  const [recentMov, setRecentMov]   = useState<Movement[]>([])
  const [loading, setLoading]       = useState(true)
  const [lastUpdate, setLastUpdate] = useState(new Date())

  const load = useCallback(async () => {
    if (!tenantId) return
    setLoading(true)
    try {
      const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0,0,0,0)

      const [
        { data: prods },
        { data: movs },
        { data: suppls },
        { data: purchs },
        { data: whs },
        { data: recentMovs },
      ] = await Promise.all([
        supabase.from('products').select('id,nom,categorie,sku,unite,prix_achat,prix_vente,seuil_alerte,stock_actuel').eq('tenant_id', tenantId).limit(200),
        supabase.from('stock_movements').select('id,type,quantite,created_at').eq('tenant_id', tenantId)
          .gte('created_at', monthStart.toISOString()).limit(200),
        supabase.from('suppliers').select('id').eq('tenant_id', tenantId).limit(200),
        supabase.from('purchases').select('montant_total').eq('tenant_id', tenantId)
          .gte('created_at', monthStart.toISOString()).limit(200),
        supabase.from('warehouses').select('id').eq('tenant_id', tenantId).limit(200),
        supabase.from('stock_movements').select('id,type,quantite,created_at,products(nom,unite)').eq('tenant_id', tenantId)
          .order('created_at', { ascending: false }).limit(10),
      ])

      const ps = prods ?? []
      const faibles = ps.filter(p => p.stock_actuel <= p.seuil_alerte && p.stock_actuel > 0)
      const ruptures = ps.filter(p => p.stock_actuel <= 0)
      const valeurStock = ps.reduce((s, p) => s + (p.stock_actuel * p.prix_achat), 0)
      const achatsMois = (purchs ?? []).reduce((s, p) => s + p.montant_total, 0)

      setKpis({
        totalProduits: ps.length,
        produitsFaibles: faibles.length,
        ruptures: ruptures.length,
        valeurStock,
        mouvementsMois: (movs ?? []).length,
        fournisseursActifs: (suppls ?? []).length,
        achatsMois,
        entrepots: (whs ?? []).length,
      })
      setProduitsFaibles([...ruptures, ...faibles].slice(0, 6))
      setRecentMov((recentMovs as unknown as Movement[]) ?? [])
      setLastUpdate(new Date())
    } finally {
      setLoading(false)
    }
  }, [tenantId])

  useEffect(() => { load() }, [load])

  const MOV_CONFIG: Record<string, { color: string; sign: string; bg: string }> = {
    IN:         { color: 'text-green-600',  sign: '+', bg: 'bg-green-50' },
    OUT:        { color: 'text-red-600',    sign: '-', bg: 'bg-red-50' },
    ADJUSTMENT: { color: 'text-blue-600',   sign: '±', bg: 'bg-blue-50' },
    TRANSFER:   { color: 'text-purple-600', sign: '→', bg: 'bg-purple-50' },
  }

  const QUICK_ACCESS = [
    { href: '/dashboard/stocks/produits',    label: t('stock.qa.products'),    icon: Package,       color: 'text-green-600',  bg: 'bg-green-50' },
    { href: '/dashboard/stocks/achats',      label: t('stock.qa.purchases'),   icon: ShoppingCart,  color: 'text-blue-600',   bg: 'bg-blue-50' },
    { href: '/dashboard/stocks/mouvements',  label: t('stock.qa.movements'),   icon: RefreshCw,     color: 'text-purple-600', bg: 'bg-purple-50' },
    { href: '/dashboard/stocks/inventaires', label: t('stock.qa.inventories'), icon: ClipboardList, color: 'text-amber-600',  bg: 'bg-amber-50' },
    { href: '/dashboard/stocks/fournisseurs',label: t('stock.qa.suppliers'),   icon: Users2,        color: 'text-teal-600',   bg: 'bg-teal-50' },
    { href: '/dashboard/stocks/commandes',   label: t('stock.qa.orders'),      icon: Truck,         color: 'text-indigo-600', bg: 'bg-indigo-50' },
    { href: '/dashboard/stocks/valorisation',label: t('stock.qa.valuation'),   icon: DollarSign,    color: 'text-orange-600', bg: 'bg-orange-50' },
    { href: '/dashboard/stocks/alertes',     label: t('stock.qa.alerts'),      icon: AlertTriangle, color: 'text-red-600',    bg: 'bg-red-50' },
  ]

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center">
            <Boxes size={20} className="text-green-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-[#0F172A]">{t('stock.inventaire')}</h1>
            <p className="text-xs text-[#64748B]">
              {t('stock.updatedAt')} {lastUpdate.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <MIAAContextButton module="stock" />
          <button onClick={load} disabled={loading} className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-[#64748B] border border-[#E2E8F0] rounded-xl hover:bg-[#F8FAFC] disabled:opacity-50">
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> {t('common.refresh')}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={28} className="animate-spin text-[#16A34A]" />
        </div>
      ) : (
        <>
          {/* Alert banner */}
          {(kpis.ruptures > 0 || kpis.produitsFaibles > 0) && (
            <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-center gap-3">
              <AlertTriangle size={18} className="text-red-500 shrink-0" />
              <div className="flex-1">
                <div className="text-sm font-semibold text-red-800">
                  {kpis.ruptures > 0 && `${kpis.ruptures} rupture${kpis.ruptures > 1 ? 's' : ''} de stock`}
                  {kpis.ruptures > 0 && kpis.produitsFaibles > 0 && ' · '}
                  {kpis.produitsFaibles > 0 && `${kpis.produitsFaibles} produit${kpis.produitsFaibles > 1 ? 's' : ''} en stock faible`}
                </div>
                <p className="text-xs text-red-600 mt-0.5">{t('stock.immediateAction')}</p>
              </div>
              <Link href="/dashboard/stocks/alertes" className="text-xs font-semibold text-red-700 hover:underline whitespace-nowrap">
                {t('stock.seeAlerts')}
              </Link>
            </div>
          )}

          {/* KPI Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: t('stock.stockValue'),      value: fmtFCFA(kpis.valeurStock), icon: DollarSign,    color: 'bg-green-50 text-green-600',   href: '/dashboard/stocks/valorisation' },
              { label: t('stock.totalProducts'),   value: kpis.totalProduits,        icon: Package,       color: 'bg-cyan-50 text-cyan-600',     href: '/dashboard/stocks/produits' },
              { label: t('stock.lowStockKpi'),     value: kpis.produitsFaibles,      icon: AlertTriangle, color: 'bg-amber-50 text-amber-600',   href: '/dashboard/stocks/alertes' },
              { label: t('stock.rupturesKpi'),     value: kpis.ruptures,             icon: TrendingDown,  color: 'bg-red-50 text-red-600',       href: '/dashboard/stocks/alertes' },
              { label: t('stock.movementsMonth'),  value: kpis.mouvementsMois,       icon: RefreshCw,     color: 'bg-purple-50 text-purple-600', href: '/dashboard/stocks/mouvements' },
              { label: t('stock.suppliersKpi'),    value: kpis.fournisseursActifs,   icon: Users2,        color: 'bg-teal-50 text-teal-600',     href: '/dashboard/stocks/fournisseurs' },
              { label: t('stock.purchasesMonth'),  value: fmtFCFA(kpis.achatsMois), icon: ShoppingCart,  color: 'bg-blue-50 text-blue-600',     href: '/dashboard/stocks/achats' },
              { label: t('stock.warehouses'),      value: kpis.entrepots,            icon: Warehouse,     color: 'bg-indigo-50 text-indigo-600', href: '/dashboard/stocks/entrepots' },
            ].map(k => {
              const Icon = k.icon
              return (
                <Link key={k.label} href={k.href}
                  className="bg-white border border-[#E2E8F0] rounded-2xl p-4 hover:border-[#CBD5E1] transition-colors group">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-[#64748B] font-medium">{k.label}</span>
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${k.color}`}>
                      <Icon size={15} />
                    </div>
                  </div>
                  <div className="text-xl font-bold text-[#0F172A] group-hover:text-[#16A34A] transition-colors">
                    {k.value}
                  </div>
                </Link>
              )
            })}
          </div>

          {/* 2-col section */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Low stock products */}
            <div className="bg-white border border-[#E2E8F0] rounded-2xl overflow-hidden">
              <div className="px-4 py-3 border-b border-[#E2E8F0] flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertTriangle size={15} className="text-amber-500" />
                  <span className="text-sm font-bold text-[#0F172A]">{t('stock.criticalProducts')}</span>
                </div>
                <Link href="/dashboard/stocks/alertes" className="text-xs text-[#16A34A] hover:underline font-medium">{t('common.seeAll')}</Link>
              </div>
              {produitsFaibles.length === 0 ? (
                <div className="flex flex-col items-center py-10 text-[#94A3B8]">
                  <Package size={28} className="mb-2 opacity-30" />
                  <p className="text-xs">{t('stock.noStockAlert')}</p>
                </div>
              ) : (
                <div className="divide-y divide-[#F1F5F9]">
                  {produitsFaibles.map(p => {
                    const isRupture = p.stock_actuel <= 0
                    return (
                      <div key={p.id} className="px-4 py-3 flex items-center justify-between">
                        <div>
                          <div className="text-xs font-semibold text-[#0F172A]">{p.nom}</div>
                          <div className="text-[10px] text-[#94A3B8]">{p.sku || '—'} · {p.categorie || '—'}</div>
                        </div>
                        <div className="text-right">
                          <div className={`text-sm font-bold ${isRupture ? 'text-red-600' : 'text-amber-600'}`}>
                            {p.stock_actuel} {p.unite}
                          </div>
                          <div className="text-[10px] text-[#94A3B8]">{t('stock.threshold')} {p.seuil_alerte}</div>
                        </div>
                        <span className={`ml-3 inline-flex px-2 py-0.5 rounded-lg text-[10px] font-bold ${isRupture ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'}`}>
                          {isRupture ? t('stock.rupture') : t('stock.faible')}
                        </span>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Recent movements */}
            <div className="bg-white border border-[#E2E8F0] rounded-2xl overflow-hidden">
              <div className="px-4 py-3 border-b border-[#E2E8F0] flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <RefreshCw size={15} className="text-[#16A34A]" />
                  <span className="text-sm font-bold text-[#0F172A]">{t('stock.recentMovements')}</span>
                </div>
                <Link href="/dashboard/stocks/mouvements" className="text-xs text-[#16A34A] hover:underline font-medium">{t('common.seeAll')}</Link>
              </div>
              {recentMov.length === 0 ? (
                <div className="flex flex-col items-center py-10 text-[#94A3B8]">
                  <RefreshCw size={28} className="mb-2 opacity-30" />
                  <p className="text-xs">{t('stock.noRecentMovement')}</p>
                </div>
              ) : (
                <div className="divide-y divide-[#F1F5F9]">
                  {recentMov.map(m => {
                    const cfg = MOV_CONFIG[m.type] ?? MOV_CONFIG.IN
                    return (
                      <div key={m.id} className="px-4 py-2.5 flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold ${cfg.bg} ${cfg.color}`}>
                            {cfg.sign}
                          </div>
                          <div>
                            <div className="text-xs font-medium text-[#0F172A]">
                              {(m.products as { nom: string; unite: string } | null)?.nom ?? '—'}
                            </div>
                            <div className="text-[10px] text-[#94A3B8]">
                              {new Date(m.created_at).toLocaleDateString('fr-FR')}
                            </div>
                          </div>
                        </div>
                        <span className={`text-sm font-bold ${cfg.color}`}>
                          {cfg.sign}{m.quantite} {(m.products as { nom: string; unite: string } | null)?.unite ?? ''}
                        </span>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Quick access */}
          <div className="bg-white border border-[#E2E8F0] rounded-2xl p-4">
            <h3 className="text-sm font-bold text-[#0F172A] mb-3">{t('stock.quickAccess')}</h3>
            <div className="grid grid-cols-4 md:grid-cols-8 gap-3">
              {QUICK_ACCESS.map(q => {
                const Icon = q.icon
                return (
                  <Link key={q.href} href={q.href}
                    className="flex flex-col items-center gap-2 p-3 rounded-xl hover:bg-[#F8FAFC] transition-colors text-center group">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${q.bg}`}>
                      <Icon size={18} className={q.color} />
                    </div>
                    <span className="text-[10px] font-semibold text-[#64748B] group-hover:text-[#0F172A]">{q.label}</span>
                  </Link>
                )
              })}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useTenant } from '@/lib/hooks/useTenant'
import { useLocale } from '@/lib/hooks/useLocale'
import { useFmt } from '@/lib/hooks/useFmt'
import {
  FileText, Search, ChevronDown, ChevronRight,
  Building2, Calendar, Clock,
} from 'lucide-react'

// BOI-004 (docs/BOI-004-REPAIR-PLAN-ACHATS-STOCKS.md, Principe #1/#4) :
// il n'existe pas de table purchase_orders/purchase_order_items séparée —
// « commande fournisseur » est un achat (purchases) dont le statut est encore
// 'brouillon' ou 'commandé' (avant réception). Cette page en est une vue
// filtrée ; la création se fait depuis /dashboard/stocks/achats (même table),
// pour éviter deux formulaires de création dupliqués sur la même entité.

interface Purchase {
  id: string
  reference: string | null
  date: string
  statut: string
  montant_total: number
  supplier_id: string | null
  supplier_nom?: string
}

interface OrderItem {
  id: string
  product_id: string
  quantite: number
  prix: number
  product_nom?: string
  product_sku?: string
  product_unite?: string
}

const STATUT_CONFIG: Record<string, { label: string; color: string; bg: string; next?: string; nextLabel?: string }> = {
  brouillon: { label: 'Brouillon', color: '#64748B', bg: '#F1F5F9', next: 'commandé', nextLabel: 'Envoyer commande' },
  commandé:  { label: 'Commandé',  color: '#D97706', bg: '#FFFBEB', next: 'reçu',     nextLabel: 'Marquer reçu' },
}

export default function CommandesPage() {
  const { fmt: fmtFCFA } = useFmt()
  const { tenantId } = useTenant()
  const { t, locale } = useLocale()

  const [orders, setOrders] = useState<Purchase[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [openId, setOpenId] = useState<string | null>(null)
  const [items, setItems] = useState<OrderItem[]>([])
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    if (!tenantId) return
    setLoading(true)
    try {
      const { data } = await supabase
        .from('purchases')
        .select('id, reference, date, statut, montant_total, supplier_id, suppliers(nom)')
        .eq('tenant_id', tenantId)
        .in('statut', ['brouillon', 'commandé'])
        .order('date', { ascending: false })
        .limit(200)

      setOrders((data || []).map((p: any) => ({ ...p, supplier_nom: p.suppliers?.nom })))
    } catch { setOrders([]) }
    setLoading(false)
  }, [tenantId])

  useEffect(() => { load() }, [load])

  const loadItems = async (purchaseId: string) => {
    const { data } = await supabase
      .from('purchase_items')
      .select('*, products(nom, sku, unite)')
      .eq('purchase_id', purchaseId)
    setItems((data || []).map((i: any) => ({
      ...i,
      product_nom: i.products?.nom,
      product_sku: i.products?.sku,
      product_unite: i.products?.unite,
    })))
  }

  const toggleOpen = async (id: string) => {
    if (openId === id) { setOpenId(null); return }
    setOpenId(id)
    await loadItems(id)
  }

  const changeStatut = async (p: Purchase, newStatut: string) => {
    setSaving(true)
    try {
      const res = await fetch('/api/stocks/purchases', {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ id: p.id, statut: newStatut }),
      })
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Erreur serveur') }
      await load()
    } catch (e: any) { alert(e.message) }
    setSaving(false)
  }

  const filtered = orders.filter(o =>
    (o.reference || '').toLowerCase().includes(search.toLowerCase()) ||
    (o.supplier_nom || '').toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-[#0F172A] flex items-center gap-2">
          <FileText size={20} className="text-[#16A34A]" />
          {t('stock.commandes.title')}
        </h1>
        <p className="text-xs text-[#64748B] mt-0.5">
          Achats en attente de réception — créez-les depuis la page Achats.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {[
          { label: t('stock.commandes.kpi.total'), value: orders.length },
          { label: t('stock.commandes.kpi.pending'), value: orders.filter(o => o.statut === 'commandé').length },
          { label: t('stock.commandes.kpi.valeur'), value: fmtFCFA(orders.reduce((s, o) => s + (o.montant_total || 0), 0)) },
        ].map(k => (
          <div key={k.label} className="bg-white border border-[#E2E8F0] rounded-2xl p-4">
            <span className="text-[11px] text-[#64748B]">{k.label}</span>
            <p className="text-lg font-bold text-[#0F172A]">{k.value}</p>
          </div>
        ))}
      </div>

      <div className="bg-white border border-[#E2E8F0] rounded-2xl p-3">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Numéro de commande, fournisseur…"
            className="w-full pl-8 pr-3 py-2 text-xs border border-[#E2E8F0] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#16A34A]/20" />
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-sm text-[#64748B]">{t('common.loading')}</div>
      ) : (
        <div className="space-y-3">
          {filtered.length === 0 ? (
            <div className="bg-white border border-[#E2E8F0] rounded-2xl p-12 text-center">
              <FileText size={40} className="mx-auto text-[#CBD5E1] mb-3" />
              <p className="text-sm font-semibold text-[#0F172A]">{t('stock.commandes.noOrders')}</p>
            </div>
          ) : filtered.map(ord => {
            const cfg = STATUT_CONFIG[ord.statut] || STATUT_CONFIG.brouillon
            const isOpen = openId === ord.id
            return (
              <div key={ord.id} className="bg-white border border-[#E2E8F0] rounded-2xl overflow-hidden">
                <div className="flex items-center gap-3 p-4">
                  <button onClick={() => toggleOpen(ord.id)} className="text-[#94A3B8] hover:text-[#0F172A]">
                    {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                  </button>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-bold text-[#0F172A]">{ord.reference || ord.id.slice(0, 8)}</p>
                      <span className="flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full"
                        style={{ color: cfg.color, background: cfg.bg }}>
                        <Clock size={10} /> {cfg.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-0.5">
                      <span className="flex items-center gap-1 text-[11px] text-[#64748B]">
                        <Building2 size={11} /> {ord.supplier_nom || 'Sans fournisseur'}
                      </span>
                      <span className="flex items-center gap-1 text-[11px] text-[#94A3B8]">
                        <Calendar size={11} /> {new Date(ord.date).toLocaleDateString(locale)}
                      </span>
                    </div>
                  </div>
                  <p className="text-sm font-bold text-[#0F172A]">{fmtFCFA(ord.montant_total)}</p>
                  {cfg.next && (
                    <button onClick={() => changeStatut(ord, cfg.next!)} disabled={saving}
                      className="px-2.5 py-1.5 bg-[#16A34A] text-white rounded-lg text-[11px] font-semibold hover:bg-[#15803D] disabled:opacity-50 whitespace-nowrap">
                      {cfg.nextLabel}
                    </button>
                  )}
                  <button onClick={() => changeStatut(ord, 'annulé')} disabled={saving}
                    className="px-2 py-1.5 border border-[#DC2626] text-[#DC2626] rounded-lg text-[11px] font-semibold hover:bg-[#FEF2F2] disabled:opacity-50">
                    Annuler
                  </button>
                </div>

                {isOpen && (
                  <div className="border-t border-[#F1F5F9] overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="bg-[#F8FAFC]">
                          <th className="text-left px-4 py-2.5 text-[10px] font-semibold text-[#64748B]">Produit</th>
                          <th className="text-right px-4 py-2.5 text-[10px] font-semibold text-[#64748B]">Qté</th>
                          <th className="text-right px-4 py-2.5 text-[10px] font-semibold text-[#64748B]">Prix unit.</th>
                        </tr>
                      </thead>
                      <tbody>
                        {items.map(item => (
                          <tr key={item.id} className="border-t border-[#F8FAFC]">
                            <td className="px-4 py-2.5">
                              <p className="text-xs font-semibold text-[#0F172A]">{item.product_nom}</p>
                              <span className="text-[10px] font-mono text-[#94A3B8]">{item.product_sku}</span>
                            </td>
                            <td className="px-4 py-2.5 text-right text-xs font-bold text-[#0F172A]">
                              {item.quantite} {item.product_unite}
                            </td>
                            <td className="px-4 py-2.5 text-right text-xs text-[#64748B]">{fmtFCFA(item.prix)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

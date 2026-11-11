'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useTenant } from '@/lib/hooks/useTenant'
import { useLocale } from '@/lib/hooks/useLocale'
import { useFmt } from '@/lib/hooks/useFmt'
import {
  Truck, Search, Building2, Calendar,
  ChevronDown, ChevronRight,
} from 'lucide-react'

// BOI-004 (docs/BOI-004-REPAIR-PLAN-ACHATS-STOCKS.md, Principe #4, décision C) :
// il n'existe plus de « réception » comme entité créée séparément — les tables
// stock_receptions/stock_reception_items n'ont jamais existé en base (l'ancienne
// version de cette page affichait silencieusement une liste vide en permanence).
// Une réception est la transition purchases.statut → 'reçu', effectuée depuis
// la page Achats (/dashboard/stocks/achats). Cette page devient une vue en
// lecture seule des achats déjà reçus, pour consultation/historique.

interface Purchase {
  id: string
  reference: string | null
  date: string
  statut: string
  montant_total: number
  supplier_id: string | null
  supplier_nom?: string
}

interface PurchaseItem {
  id: string
  purchase_id: string
  product_id: string
  quantite: number
  prix: number
  product_nom?: string
  product_sku?: string
  product_unite?: string
}

export default function ReceptionsPage() {
  const { fmt: fmtFCFA } = useFmt()
  const { tenantId } = useTenant()
  const { t, locale } = useLocale()

  const [receptions, setReceptions] = useState<Purchase[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [openId, setOpenId] = useState<string | null>(null)
  const [items, setItems] = useState<PurchaseItem[]>([])

  const load = useCallback(async () => {
    if (!tenantId) return
    setLoading(true)
    try {
      const { data } = await supabase
        .from('purchases')
        .select('id, reference, date, statut, montant_total, supplier_id, suppliers(nom)')
        .eq('tenant_id', tenantId)
        .in('statut', ['reçu', 'payé'])
        .order('date', { ascending: false })
        .limit(200)

      setReceptions((data || []).map((p: any) => ({ ...p, supplier_nom: p.suppliers?.nom })))
    } catch { setReceptions([]) }
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

  const filtered = receptions.filter(r =>
    (r.reference || '').toLowerCase().includes(search.toLowerCase()) ||
    (r.supplier_nom || '').toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-[#0F172A] flex items-center gap-2">
          <Truck size={20} className="text-[#16A34A]" />
          {t('stock.receptions.title')}
        </h1>
        <p className="text-xs text-[#64748B] mt-0.5">
          Achats déjà réceptionnés — la réception se fait depuis la page Achats.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {[
          { label: t('stock.receptions.kpi.total'), value: receptions.length },
          { label: t('stock.receptions.kpi.valeur'), value: fmtFCFA(receptions.reduce((s, r) => s + (r.montant_total || 0), 0)) },
          { label: t('stock.receptions.kpi.fournisseurs'), value: new Set(receptions.map(r => r.supplier_id).filter(Boolean)).size },
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
            placeholder={t('stock.receptions.noReceptions')}
            className="w-full pl-8 pr-3 py-2 text-xs border border-[#E2E8F0] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#16A34A]/20" />
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-sm text-[#64748B]">{t('common.loading')}</div>
      ) : (
        <div className="space-y-3">
          {filtered.length === 0 ? (
            <div className="bg-white border border-[#E2E8F0] rounded-2xl p-12 text-center">
              <Truck size={40} className="mx-auto text-[#CBD5E1] mb-3" />
              <p className="text-sm font-semibold text-[#0F172A]">{t('stock.receptions.noReceptions')}</p>
              <p className="text-xs text-[#64748B] mt-1">
                Créez un achat puis marquez-le « Reçu » depuis /dashboard/stocks/achats.
              </p>
            </div>
          ) : filtered.map(rec => {
            const isOpen = openId === rec.id
            return (
              <div key={rec.id} className="bg-white border border-[#E2E8F0] rounded-2xl overflow-hidden">
                <div className="flex items-center gap-3 p-4">
                  <button onClick={() => toggleOpen(rec.id)} className="text-[#94A3B8] hover:text-[#0F172A]">
                    {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                  </button>
                  <div className="w-8 h-8 rounded-xl bg-[#F0FDF4] flex items-center justify-center shrink-0">
                    <Truck size={14} className="text-[#16A34A]" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-bold text-[#0F172A]">{rec.reference || rec.id.slice(0, 8)}</p>
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#F0FDF4] text-[#16A34A]">
                        {rec.statut === 'payé' ? 'Reçu — payé' : 'Reçu'}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-0.5">
                      {rec.supplier_nom && (
                        <span className="flex items-center gap-1 text-[11px] text-[#64748B]">
                          <Building2 size={11} /> {rec.supplier_nom}
                        </span>
                      )}
                      <span className="flex items-center gap-1 text-[11px] text-[#94A3B8]">
                        <Calendar size={11} /> {new Date(rec.date).toLocaleDateString(locale)}
                      </span>
                    </div>
                  </div>
                  <p className="text-sm font-bold text-[#0F172A]">{fmtFCFA(rec.montant_total)}</p>
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

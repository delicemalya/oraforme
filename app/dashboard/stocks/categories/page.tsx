'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useTenant } from '@/lib/hooks/useTenant'
import { useLocale } from '@/lib/hooks/useLocale'
import { useFmt } from '@/lib/hooks/useFmt'
import { Grid3X3, Search, Package, TrendingUp, AlertTriangle } from 'lucide-react'

// BOI-004 (docs/BOI-004-REPAIR-PLAN-ACHATS-STOCKS.md, Principe #4) :
// product_categories n'a jamais existé en base (cette page écrivait/lisait
// dans le vide). products.categorie est un champ texte libre, déjà réel et
// déjà utilisé — cette page devient une vue dérivée de ses valeurs distinctes
// plutôt qu'une entité CRUD séparée à inventer. Une gestion hiérarchique de
// catégories (icônes, couleurs, sous-catégories) reste possible plus tard,
// mais exige une vraie table et une vraie décision produit — pas faite ici.

interface CategoryRow {
  nom: string
  nb_produits: number
  valeur_stock: number
  produits_faibles: number
}

export default function CategoriesPage() {
  const { fmt: fmtFCFA } = useFmt()
  const { tenantId } = useTenant()
  const { t } = useLocale()

  const [categories, setCategories] = useState<CategoryRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  const load = useCallback(async () => {
    if (!tenantId) return
    setLoading(true)
    try {
      const { data: prods } = await supabase
        .from('v_products_stock')
        .select('categorie, stock_actuel, prix_achat, seuil_alerte')
        .eq('tenant_id', tenantId)

      const byCat = new Map<string, CategoryRow>()
      for (const p of prods || []) {
        const nom = p.categorie || 'Sans catégorie'
        const row = byCat.get(nom) || { nom, nb_produits: 0, valeur_stock: 0, produits_faibles: 0 }
        row.nb_produits += 1
        row.valeur_stock += (p.stock_actuel || 0) * (p.prix_achat || 0)
        if ((p.stock_actuel || 0) <= (p.seuil_alerte || 0)) row.produits_faibles += 1
        byCat.set(nom, row)
      }
      setCategories([...byCat.values()].sort((a, b) => a.nom.localeCompare(b.nom)))
    } catch { setCategories([]) }
    setLoading(false)
  }, [tenantId])

  useEffect(() => { load() }, [load])

  const filtered = categories.filter(c => c.nom.toLowerCase().includes(search.toLowerCase()))
  const totalProduits = categories.reduce((s, c) => s + c.nb_produits, 0)
  const totalValeur = categories.reduce((s, c) => s + c.valeur_stock, 0)
  const totalFaibles = categories.reduce((s, c) => s + c.produits_faibles, 0)

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-[#0F172A] flex items-center gap-2">
          <Grid3X3 size={20} className="text-[#16A34A]" />
          {t('stock.categories.title')}
        </h1>
        <p className="text-xs text-[#64748B] mt-0.5">
          Catégories déduites du catalogue produits (champ « catégorie »).
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: t('stock.categories.title'), value: categories.length, icon: Grid3X3, color: '#16A34A', bg: '#F0FDF4' },
          { label: t('stock.categories.colNom'), value: totalProduits, icon: Package, color: '#2563EB', bg: '#EFF6FF' },
          { label: t('stock.categories.colValeur'), value: fmtFCFA(totalValeur), icon: TrendingUp, color: '#D97706', bg: '#FFFBEB' },
          { label: t('stock.alertes.low'), value: totalFaibles, icon: AlertTriangle, color: '#DC2626', bg: '#FEF2F2' },
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

      <div className="bg-white border border-[#E2E8F0] rounded-2xl p-3">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder={t('stock.categories.searchPlh')}
            className="w-full pl-8 pr-3 py-2 text-xs border border-[#E2E8F0] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#16A34A]/20" />
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-[#64748B] text-sm">{t('common.loading')}</div>
      ) : categories.length === 0 ? (
        <div className="bg-white border border-[#E2E8F0] rounded-2xl p-12 text-center">
          <Grid3X3 size={40} className="mx-auto text-[#CBD5E1] mb-3" />
          <p className="text-sm font-semibold text-[#0F172A]">{t('stock.categories.empty')}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map(cat => (
            <div key={cat.nom} className="bg-white border border-[#E2E8F0] rounded-2xl p-4">
              <p className="text-sm font-bold text-[#0F172A] mb-3">{cat.nom}</p>
              <div className="grid grid-cols-3 gap-2 text-center border-t border-[#F1F5F9] pt-3">
                <div>
                  <p className="text-sm font-bold text-[#0F172A]">{cat.nb_produits}</p>
                  <p className="text-[10px] text-[#94A3B8]">Produits</p>
                </div>
                <div>
                  <p className="text-[11px] font-bold text-[#0F172A]">{fmtFCFA(cat.valeur_stock)}</p>
                  <p className="text-[10px] text-[#94A3B8]">Valeur</p>
                </div>
                <div>
                  <p className="text-sm font-bold text-[#DC2626]">{cat.produits_faibles}</p>
                  <p className="text-[10px] text-[#94A3B8]">Faibles</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

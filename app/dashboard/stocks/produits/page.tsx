'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useTenant } from '@/lib/hooks/useTenant'
import { useLocale } from '@/lib/hooks/useLocale'
import { fmtFCFA } from '@/lib/admin-config'
import {
  Package, Plus, Search, Download, Check, X, Loader2, Eye,
  Edit2, Trash2, AlertTriangle, QrCode, Filter, Tag,
  ArrowUpCircle, ArrowDownCircle, ChevronDown,
} from 'lucide-react'

// ── Types ──────────────────────────────────────────────────────────────────────

interface Product {
  id: string
  tenant_id: string
  nom: string
  description: string
  categorie: string | null
  categorie_id: string | null
  sku: string | null
  code_barre: string | null
  unite: string
  prix_achat: number
  prix_vente: number
  stock_actuel: number
  seuil_alerte: number
  stock_max: number
  fournisseur_id: string | null
  emplacement: string
  statut: 'actif' | 'inactif' | 'archive'
  taxe_pct: number
  image_url: string | null
  created_at: string
}

interface Category { id: string; nom: string; code: string }
interface Supplier  { id: string; nom: string }

const UNITES = ['pièce', 'kg', 'g', 'litre', 'ml', 'mètre', 'cm', 'carton', 'sac', 'palette', 'boîte', 'tonne', 'lot', 'rouleau', 'bouteille']

function generateSKU(nom: string, cat: string, year: number, count: number) {
  const prefix = nom.slice(0, 3).toUpperCase().replace(/\s/g, 'X')
  const catCode = cat.slice(0, 3).toUpperCase().replace(/\s/g, 'X')
  const num = String(count + 1).padStart(4, '0')
  return `${prefix}-${catCode}-${year}-${num}`
}

const EMPTY_FORM = {
  nom: '', description: '', categorie: '', categorie_id: '',
  sku: '', code_barre: '', unite: 'pièce',
  prix_achat: '', prix_vente: '', seuil_alerte: '0', stock_max: '0',
  fournisseur_id: '', emplacement: '', statut: 'actif', taxe_pct: '0',
}

export default function ProduitsPage() {
  const { tenantId } = useTenant()
  const { t } = useLocale()
  const [products, setProducts]     = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [suppliers, setSuppliers]   = useState<Supplier[]>([])
  const [loading, setLoading]       = useState(true)
  const [showModal, setShowModal]   = useState(false)
  const [editItem, setEditItem]     = useState<Product | null>(null)
  const [saving, setSaving]         = useState(false)
  const [form, setForm]             = useState({ ...EMPTY_FORM })
  const [search, setSearch]         = useState('')
  const [filterCat, setFilterCat]   = useState('all')
  const [filterStatut, setFilterStatut] = useState('all')
  const [filterStock, setFilterStock]   = useState('all')
  const [selected, setSelected]     = useState<Product | null>(null)
  const [confirmDel, setConfirmDel] = useState<Product | null>(null)

  const load = useCallback(async () => {
    if (!tenantId) return
    setLoading(true)
    try {
      const [{ data: prods }, { data: cats }, { data: supps }] = await Promise.all([
        supabase.from('products').select('*').eq('tenant_id', tenantId).order('nom').limit(200),
        supabase.from('product_categories').select('id,nom,code').eq('tenant_id', tenantId).order('nom').limit(200),
        supabase.from('suppliers').select('id,nom').eq('tenant_id', tenantId).order('nom').limit(200),
      ])
      setProducts(prods ?? [])
      setCategories(cats ?? [])
      setSuppliers(supps ?? [])
    } finally {
      setLoading(false)
    }
  }, [tenantId])

  useEffect(() => { load() }, [load])

  function openCreate() {
    setEditItem(null)
    setForm({ ...EMPTY_FORM })
    setShowModal(true)
  }

  function openEdit(p: Product) {
    setEditItem(p)
    setForm({
      nom: p.nom, description: p.description || '',
      categorie: p.categorie || '', categorie_id: p.categorie_id || '',
      sku: p.sku || '', code_barre: p.code_barre || '',
      unite: p.unite, prix_achat: String(p.prix_achat), prix_vente: String(p.prix_vente),
      seuil_alerte: String(p.seuil_alerte), stock_max: String(p.stock_max || 0),
      fournisseur_id: p.fournisseur_id || '', emplacement: p.emplacement || '',
      statut: p.statut, taxe_pct: String(p.taxe_pct || 0),
    })
    setShowModal(true)
  }

  async function save() {
    if (!tenantId || !form.nom || !form.prix_achat) return
    setSaving(true)
    try {
      const cat = categories.find(c => c.id === form.categorie_id)
      let sku = form.sku
      if (!sku) {
        sku = generateSKU(form.nom, cat?.nom ?? 'GEN', new Date().getFullYear(), products.length)
      }

      const payload = {
        tenant_id: tenantId,
        nom: form.nom,
        description: form.description,
        categorie: cat?.nom ?? form.categorie,
        categorie_id: form.categorie_id || null,
        sku,
        code_barre: form.code_barre || null,
        unite: form.unite,
        prix_achat: parseFloat(form.prix_achat) || 0,
        prix_vente: parseFloat(form.prix_vente) || 0,
        seuil_alerte: parseFloat(form.seuil_alerte) || 0,
        stock_max: parseFloat(form.stock_max) || 0,
        fournisseur_id: form.fournisseur_id || null,
        emplacement: form.emplacement,
        statut: form.statut,
        taxe_pct: parseFloat(form.taxe_pct) || 0,
      }

      if (editItem) {
        const { error } = await supabase.from('products').update(payload).eq('id', editItem.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('products').insert({ ...payload, stock_actuel: 0 })
        if (error) throw error
      }
      setShowModal(false)
      await load()
    } catch (e: unknown) {
      alert('Erreur: ' + (e instanceof Error ? e.message : String(e)))
    } finally {
      setSaving(false)
    }
  }

  async function deleteProduct(p: Product) {
    try {
      const { error } = await supabase.from('products').delete().eq('id', p.id)
      if (error) throw error
      setConfirmDel(null)
      await load()
    } catch (e: unknown) {
      alert('Erreur: ' + (e instanceof Error ? e.message : String(e)))
    }
  }

  const filtered = products.filter(p => {
    if (filterCat !== 'all' && p.categorie !== filterCat) return false
    if (filterStatut !== 'all' && p.statut !== filterStatut) return false
    if (filterStock === 'rupture' && p.stock_actuel > 0) return false
    if (filterStock === 'faible' && (p.stock_actuel <= 0 || p.stock_actuel > p.seuil_alerte)) return false
    if (filterStock === 'ok' && p.stock_actuel <= p.seuil_alerte) return false
    const q = search.toLowerCase()
    if (q && !p.nom.toLowerCase().includes(q) && !p.sku?.toLowerCase().includes(q) && !p.code_barre?.toLowerCase().includes(q)) return false
    return true
  })

  const totalValeur = filtered.reduce((s, p) => s + (p.stock_actuel * p.prix_achat), 0)
  const uniqueCats  = [...new Set(products.map(p => p.categorie).filter(Boolean))]

  function exportCSV() {
    const lines = ['SKU,Nom,Catégorie,Unité,Prix achat,Prix vente,Stock,Seuil,Valeur stock,Statut']
    filtered.forEach(p => {
      lines.push([
        p.sku ?? '', `"${p.nom}"`, p.categorie ?? '', p.unite,
        p.prix_achat, p.prix_vente, p.stock_actuel, p.seuil_alerte,
        (p.stock_actuel * p.prix_achat).toFixed(0), p.statut,
      ].join(','))
    })
    const blob = new Blob([lines.join('\n')], { type: 'text/csv' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob)
    a.download = `produits_${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
  }

  function getStockStatus(p: Product): { label: string; color: string; bg: string } {
    if (p.stock_actuel <= 0)            return { label: 'Rupture', color: 'text-red-700',   bg: 'bg-red-50 border border-red-200' }
    if (p.stock_actuel <= p.seuil_alerte) return { label: 'Faible',   color: 'text-amber-700', bg: 'bg-amber-50 border border-amber-200' }
    if (p.stock_max > 0 && p.stock_actuel >= p.stock_max) return { label: 'Surplus', color: 'text-blue-700', bg: 'bg-blue-50 border border-blue-200' }
    return { label: 'OK', color: 'text-green-700', bg: 'bg-green-50 border border-green-200' }
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center">
            <Package size={20} className="text-green-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-[#0F172A]">{t('stock.produits.title')}</h1>
            <p className="text-xs text-[#64748B]">{products.length} produit{products.length > 1 ? 's' : ''} — {t('stock.produits.subtitle')}: {fmtFCFA(products.reduce((s, p) => s + (p.stock_actuel * p.prix_achat), 0))}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={exportCSV} className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-[#64748B] border border-[#E2E8F0] rounded-xl hover:bg-[#F8FAFC]">
            <Download size={14} /> Exporter
          </button>
          <button onClick={openCreate}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#16A34A] rounded-xl hover:bg-green-700 shadow-sm">
            <Plus size={14} /> {t('stock.produits.newProduct')}
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white border border-[#E2E8F0] rounded-2xl p-4 space-y-3">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="relative col-span-2 md:col-span-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder={t('stock.produits.searchPlh')}
              className="w-full pl-8 pr-3 py-2 text-xs border border-[#E2E8F0] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#16A34A]" />
          </div>
          <select value={filterCat} onChange={e => setFilterCat(e.target.value)}
            className="border border-[#E2E8F0] rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-[#16A34A]">
            <option value="all">Toutes catégories</option>
            {uniqueCats.map(c => <option key={c!} value={c!}>{c}</option>)}
          </select>
          <select value={filterStatut} onChange={e => setFilterStatut(e.target.value)}
            className="border border-[#E2E8F0] rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-[#16A34A]">
            <option value="all">Tous statuts</option>
            <option value="actif">Actif</option>
            <option value="inactif">Inactif</option>
            <option value="archive">Archivé</option>
          </select>
          <select value={filterStock} onChange={e => setFilterStock(e.target.value)}
            className="border border-[#E2E8F0] rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-[#16A34A]">
            <option value="all">Tout le stock</option>
            <option value="rupture">Ruptures</option>
            <option value="faible">Stock faible</option>
            <option value="ok">Stock OK</option>
          </select>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: t('stock.produits.kpi.total'), value: products.length },
          { label: t('stock.produits.kpi.valeur'), value: fmtFCFA(totalValeur) },
          { label: t('stock.produits.kpi.rupture'), value: products.filter(p => p.stock_actuel <= 0).length },
          { label: t('stock.produits.kpi.alerte'), value: products.filter(p => p.stock_actuel > 0 && p.stock_actuel <= p.seuil_alerte).length },
        ].map(k => (
          <div key={k.label} className="bg-white border border-[#E2E8F0] rounded-2xl p-4">
            <p className="text-[11px] text-[#64748B] mb-1">{k.label}</p>
            <p className="text-lg font-bold text-[#0F172A]">{k.value}</p>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white border border-[#E2E8F0] rounded-2xl overflow-hidden">
        <div className="px-4 py-3 border-b border-[#E2E8F0] flex items-center justify-between">
          <span className="text-sm font-semibold text-[#0F172A]">{filtered.length} produit{filtered.length > 1 ? 's' : ''}</span>
          <span className="text-xs text-[#64748B]">Valeur filtrée: <strong className="text-green-600">{fmtFCFA(totalValeur)}</strong></span>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16"><Loader2 size={24} className="animate-spin text-[#16A34A]" /></div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center py-16 text-[#94A3B8]">
            <Package size={32} className="mb-2 opacity-30" />
            <p className="text-sm font-medium">{t('stock.produits.noProducts')}</p>
            <button onClick={openCreate} className="mt-2 text-xs text-[#16A34A] hover:underline">{t('stock.produits.newProduct')}</button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-[#F8FAFC]">
                <tr>
                  {['SKU', 'Produit', 'Catégorie', 'Stock actuel', 'Prix achat', 'Prix vente', 'Valeur', 'Statut', ''].map(h => (
                    <th key={h} className="px-4 py-2.5 text-left text-[10px] font-semibold text-[#64748B] uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((p, i) => {
                  const ss = getStockStatus(p)
                  const marge = p.prix_vente > 0 ? ((p.prix_vente - p.prix_achat) / p.prix_vente * 100).toFixed(1) : '0'
                  return (
                    <tr key={p.id} className={`border-t border-[#F1F5F9] hover:bg-[#F8FAFC] transition-colors ${i % 2 === 0 ? '' : 'bg-[#FAFBFC]'}`}>
                      <td className="px-4 py-3">
                        <span className="text-[10px] font-mono bg-[#F1F5F9] text-[#64748B] px-2 py-0.5 rounded">{p.sku || '—'}</span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-xs font-semibold text-[#0F172A]">{p.nom}</div>
                        {p.emplacement && <div className="text-[10px] text-[#94A3B8]">📍 {p.emplacement}</div>}
                      </td>
                      <td className="px-4 py-3">
                        {p.categorie && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-[#F1F5F9] text-[#64748B] rounded-lg text-[10px] font-medium">
                            <Tag size={9} /> {p.categorie}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className={`text-sm font-bold ${p.stock_actuel <= 0 ? 'text-red-600' : p.stock_actuel <= p.seuil_alerte ? 'text-amber-600' : 'text-[#0F172A]'}`}>
                          {p.stock_actuel} <span className="text-[10px] font-normal text-[#94A3B8]">{p.unite}</span>
                        </div>
                        {p.seuil_alerte > 0 && (
                          <div className="text-[10px] text-[#94A3B8]">Seuil: {p.seuil_alerte}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs font-medium text-[#0F172A]">{fmtFCFA(p.prix_achat)}</td>
                      <td className="px-4 py-3">
                        <div className="text-xs font-medium text-[#0F172A]">{fmtFCFA(p.prix_vente)}</div>
                        {parseFloat(marge) > 0 && <div className="text-[10px] text-green-600">Marge {marge}%</div>}
                      </td>
                      <td className="px-4 py-3 text-xs font-semibold text-green-600">
                        {fmtFCFA(p.stock_actuel * p.prix_achat)}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2 py-0.5 rounded-lg text-[10px] font-bold ${ss.bg} ${ss.color}`}>{ss.label}</span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <button onClick={() => setSelected(p)} className="p-1.5 hover:bg-[#F1F5F9] rounded-lg" title="Voir détail">
                            <Eye size={13} className="text-[#94A3B8]" />
                          </button>
                          <button onClick={() => openEdit(p)} className="p-1.5 hover:bg-[#F1F5F9] rounded-lg" title="Modifier">
                            <Edit2 size={13} className="text-[#94A3B8]" />
                          </button>
                          <button onClick={() => setConfirmDel(p)} className="p-1.5 hover:bg-red-50 rounded-lg" title="Supprimer">
                            <Trash2 size={13} className="text-red-400" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Detail modal */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-3 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-[#0F172A]">{selected.nom}</h3>
              <button onClick={() => setSelected(null)} className="p-2 hover:bg-[#F1F5F9] rounded-xl"><X size={16} /></button>
            </div>
            <div className="bg-green-50 rounded-xl p-3 flex items-center justify-between">
              <div>
                <div className="text-xs text-[#64748B]">Stock actuel</div>
                <div className={`text-2xl font-bold ${selected.stock_actuel <= 0 ? 'text-red-600' : 'text-green-600'}`}>
                  {selected.stock_actuel} {selected.unite}
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs text-[#64748B]">Valeur stock</div>
                <div className="text-lg font-bold text-[#0F172A]">{fmtFCFA(selected.stock_actuel * selected.prix_achat)}</div>
              </div>
            </div>
            {[
              ['SKU', selected.sku || '—'],
              ['Code-barres', selected.code_barre || '—'],
              ['Catégorie', selected.categorie || '—'],
              ['Unité', selected.unite],
              ['Prix achat', fmtFCFA(selected.prix_achat)],
              ['Prix vente', fmtFCFA(selected.prix_vente)],
              ['Seuil alerte', selected.seuil_alerte],
              ['Stock max', selected.stock_max || '—'],
              ['Emplacement', selected.emplacement || '—'],
              ['Taxe (%)', selected.taxe_pct || '0'],
              ['Statut', selected.statut],
              ['Créé le', new Date(selected.created_at).toLocaleDateString('fr-FR')],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between text-xs gap-4">
                <span className="text-[#64748B] shrink-0">{k}</span>
                <span className="text-[#0F172A] font-medium text-right">{String(v)}</span>
              </div>
            ))}
            {selected.description && (
              <div className="text-xs text-[#64748B] bg-[#F8FAFC] rounded-xl p-3">{selected.description}</div>
            )}
            <button onClick={() => { openEdit(selected); setSelected(null) }}
              className="w-full py-2 text-xs font-semibold text-white bg-[#16A34A] rounded-xl hover:bg-green-700">
              Modifier ce produit
            </button>
          </div>
        </div>
      )}

      {/* Confirm delete */}
      {confirmDel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center">
                <Trash2 size={18} className="text-red-600" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-[#0F172A]">Supprimer ce produit ?</h3>
                <p className="text-xs text-[#64748B]">{confirmDel.nom}</p>
              </div>
            </div>
            <p className="text-xs text-red-600">Cette action est irréversible. Tous les mouvements liés seront également supprimés.</p>
            <div className="flex gap-2">
              <button onClick={() => setConfirmDel(null)} className="flex-1 py-2 text-xs font-medium border border-[#E2E8F0] rounded-xl hover:bg-[#F8FAFC]">{t('common.cancel')}</button>
              <button onClick={() => deleteProduct(confirmDel)} className="flex-1 py-2 text-xs font-semibold text-white bg-red-600 rounded-xl hover:bg-red-700">Supprimer</button>
            </div>
          </div>
        </div>
      )}

      {/* Create/Edit modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-[#0F172A]">
                {editItem ? 'Modifier le produit' : t('stock.produits.newProduct')}
              </h3>
              <button onClick={() => setShowModal(false)} className="p-2 hover:bg-[#F1F5F9] rounded-xl"><X size={16} /></button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="block text-xs font-medium text-[#374151] mb-1">Nom du produit *</label>
                <input value={form.nom} onChange={e => setForm(f => ({ ...f, nom: e.target.value }))}
                  placeholder="Ex: Ciment CPA 42.5"
                  className="w-full border border-[#E2E8F0] rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#16A34A]" />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#374151] mb-1">SKU (auto-généré si vide)</label>
                <input value={form.sku} onChange={e => setForm(f => ({ ...f, sku: e.target.value }))}
                  placeholder="ORA-CIM-2026-0001"
                  className="w-full border border-[#E2E8F0] rounded-xl px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#16A34A]" />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#374151] mb-1">Code-barres</label>
                <input value={form.code_barre} onChange={e => setForm(f => ({ ...f, code_barre: e.target.value }))}
                  placeholder="EAN13 / Code interne"
                  className="w-full border border-[#E2E8F0] rounded-xl px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#16A34A]" />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#374151] mb-1">Catégorie</label>
                <select value={form.categorie_id} onChange={e => setForm(f => ({ ...f, categorie_id: e.target.value }))}
                  className="w-full border border-[#E2E8F0] rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#16A34A]">
                  <option value="">— Sélectionner —</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.nom}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-[#374151] mb-1">Unité</label>
                <select value={form.unite} onChange={e => setForm(f => ({ ...f, unite: e.target.value }))}
                  className="w-full border border-[#E2E8F0] rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#16A34A]">
                  {UNITES.map(u => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-[#374151] mb-1">Prix achat (FCFA) *</label>
                <input type="number" value={form.prix_achat} onChange={e => setForm(f => ({ ...f, prix_achat: e.target.value }))}
                  className="w-full border border-[#E2E8F0] rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#16A34A]" />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#374151] mb-1">Prix vente (FCFA)</label>
                <input type="number" value={form.prix_vente} onChange={e => setForm(f => ({ ...f, prix_vente: e.target.value }))}
                  className="w-full border border-[#E2E8F0] rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#16A34A]" />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#374151] mb-1">Seuil alerte</label>
                <input type="number" value={form.seuil_alerte} onChange={e => setForm(f => ({ ...f, seuil_alerte: e.target.value }))}
                  className="w-full border border-[#E2E8F0] rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#16A34A]" />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#374151] mb-1">Stock maximum</label>
                <input type="number" value={form.stock_max} onChange={e => setForm(f => ({ ...f, stock_max: e.target.value }))}
                  className="w-full border border-[#E2E8F0] rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#16A34A]" />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#374151] mb-1">Fournisseur principal</label>
                <select value={form.fournisseur_id} onChange={e => setForm(f => ({ ...f, fournisseur_id: e.target.value }))}
                  className="w-full border border-[#E2E8F0] rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#16A34A]">
                  <option value="">— Sélectionner —</option>
                  {suppliers.map(s => <option key={s.id} value={s.id}>{s.nom}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-[#374151] mb-1">Emplacement</label>
                <input value={form.emplacement} onChange={e => setForm(f => ({ ...f, emplacement: e.target.value }))}
                  placeholder="Ex: Rayon A3, Entrepôt Nord"
                  className="w-full border border-[#E2E8F0] rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#16A34A]" />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#374151] mb-1">Taxe (%)</label>
                <input type="number" value={form.taxe_pct} onChange={e => setForm(f => ({ ...f, taxe_pct: e.target.value }))}
                  placeholder="18"
                  className="w-full border border-[#E2E8F0] rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#16A34A]" />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#374151] mb-1">Statut</label>
                <select value={form.statut} onChange={e => setForm(f => ({ ...f, statut: e.target.value }))}
                  className="w-full border border-[#E2E8F0] rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#16A34A]">
                  <option value="actif">Actif</option>
                  <option value="inactif">Inactif</option>
                  <option value="archive">Archivé</option>
                </select>
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-medium text-[#374151] mb-1">Description</label>
                <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  rows={2} placeholder="Description du produit (optionnel)"
                  className="w-full border border-[#E2E8F0] rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#16A34A] resize-none" />
              </div>
            </div>

            {/* Marge preview */}
            {form.prix_achat && form.prix_vente && parseFloat(form.prix_vente) > parseFloat(form.prix_achat) && (
              <div className="bg-green-50 rounded-xl p-3 text-xs text-green-800">
                <strong>Marge brute:</strong> {fmtFCFA(parseFloat(form.prix_vente) - parseFloat(form.prix_achat))}
                &nbsp;({((parseFloat(form.prix_vente) - parseFloat(form.prix_achat)) / parseFloat(form.prix_vente) * 100).toFixed(1)}%)
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 text-xs font-medium text-[#64748B] border border-[#E2E8F0] rounded-xl hover:bg-[#F8FAFC]">{t('common.cancel')}</button>
              <button onClick={save} disabled={saving || !form.nom || !form.prix_achat}
                className="flex items-center gap-1.5 px-5 py-2 text-xs font-semibold text-white bg-[#16A34A] rounded-xl hover:bg-green-700 disabled:opacity-50">
                {saving ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                {saving ? t('common.loading') : t('common.save')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

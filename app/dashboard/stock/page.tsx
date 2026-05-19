'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useTenant } from '@/lib/hooks/useTenant'
import {
  Package, Plus, AlertTriangle, Trash2, Pencil,
  ArrowDownToLine, ArrowUpFromLine, RotateCcw,
  Warehouse, Users2, ShoppingCart, Search,
  TrendingUp, X, Check,
} from 'lucide-react'
import { fmtFCFA } from '@/lib/admin-config'

// ── Types ─────────────────────────────────────────────────────
type Product = {
  id: string; nom: string; categorie: string | null; sku: string | null
  unite: string; prix_achat: number; prix_vente: number
  seuil_alerte: number; stock_actuel: number; created_at: string
}
type Movement = {
  id: string; product_id: string; warehouse_id: string | null
  type: 'IN' | 'OUT' | 'ADJUSTMENT' | 'TRANSFER'
  quantite: number; reference: string | null; note: string | null
  created_at: string; products: { nom: string } | null
}
type WH = { id: string; nom: string; localisation: string | null }
type Supplier = { id: string; nom: string; telephone: string | null; email: string | null; adresse: string | null }
type Purchase = { id: string; supplier_id: string | null; montant_total: number; statut: string; created_at: string; suppliers: { nom: string } | null }

// ── Constants ─────────────────────────────────────────────────
const TABS = [
  { id: 'catalogue',    label: 'Catalogue',    icon: Package },
  { id: 'mouvements',  label: 'Mouvements',   icon: RotateCcw },
  { id: 'entrepots',   label: 'Entrepôts',    icon: Warehouse },
  { id: 'fournisseurs', label: 'Fournisseurs', icon: Users2 },
  { id: 'achats',      label: 'Achats',        icon: ShoppingCart },
] as const
type Tab = typeof TABS[number]['id']

const MOV_META = {
  IN:         { label: 'Entrée',      color: 'text-emerald-400', bg: 'bg-emerald-500/10', Icon: ArrowDownToLine },
  OUT:        { label: 'Sortie',      color: 'text-red-400',     bg: 'bg-red-500/10',     Icon: ArrowUpFromLine },
  ADJUSTMENT: { label: 'Ajustement', color: 'text-blue-400',    bg: 'bg-blue-500/10',    Icon: RotateCcw },
  TRANSFER:   { label: 'Transfert',  color: 'text-purple-400',  bg: 'bg-purple-500/10',  Icon: RotateCcw },
}

const UNITES = ['pièce', 'kg', 'litre', 'mètre', 'carton', 'sac', 'palette', 'boîte', 'tonne']

// ── Shared UI ─────────────────────────────────────────────────
function FInput({ label, ...p }: React.InputHTMLAttributes<HTMLInputElement> & { label?: string }) {
  return (
    <div>
      {label && <label className="block text-xs text-[#8B949E] mb-1.5">{label}</label>}
      <input {...p} className="w-full bg-[#142850] border border-[#30363D] rounded-lg px-3 py-2 text-sm text-[#FFFFFF] placeholder-[#484F58] focus:outline-none focus:border-[#F08900]/50 transition-colors" />
    </div>
  )
}
function FSelect({ label, children, ...p }: React.SelectHTMLAttributes<HTMLSelectElement> & { label?: string }) {
  return (
    <div>
      {label && <label className="block text-xs text-[#8B949E] mb-1.5">{label}</label>}
      <select {...p} className="w-full bg-[#142850] border border-[#30363D] rounded-lg px-3 py-2 text-sm text-[#FFFFFF] focus:outline-none focus:border-[#F08900]/50 transition-colors">
        {children}
      </select>
    </div>
  )
}
function ModalShell({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="bg-[#0f1e3d] border border-[#30363D] rounded-2xl p-6 w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-semibold text-[#FFFFFF]">{title}</h2>
          <button onClick={onClose} className="text-[#484F58] hover:text-[#FFFFFF] transition-colors"><X size={16} /></button>
        </div>
        {children}
      </div>
    </div>
  )
}
function ModalActions({ onCancel, onSave, saving, label }: { onCancel: () => void; onSave: () => void; saving: boolean; label: string }) {
  return (
    <div className="flex gap-3 pt-2">
      <button onClick={onCancel} className="flex-1 py-2.5 rounded-xl border border-[#30363D] text-sm text-[#8B949E] hover:text-[#FFFFFF] transition-colors">
        Annuler
      </button>
      <button onClick={onSave} disabled={saving}
        className="flex-1 py-2.5 rounded-xl bg-[#F08900] text-[#142850] text-sm font-semibold hover:bg-[#F08900]/90 disabled:opacity-50 transition-colors">
        {saving ? 'Enregistrement…' : label}
      </button>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════════════
export default function StockPage() {
  const { tenantId, loading: tLoading } = useTenant()

  const [tab, setTab] = useState<Tab>('catalogue')
  const [products,  setProducts]  = useState<Product[]>([])
  const [movements, setMovements] = useState<Movement[]>([])
  const [warehouses, setWarehouses] = useState<WH[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [purchases, setPurchases] = useState<Purchase[]>([])
  const [loading, setLoading] = useState(true)

  const [search,    setSearch]    = useState('')
  const [catFilter, setCatFilter] = useState('tous')

  // Modals
  const [mProd,     setMProd]     = useState(false)
  const [mAdjust,   setMAdjust]   = useState<Product | null>(null)
  const [mEdit,     setMEdit]     = useState<Product | null>(null)
  const [mWarehouse, setMWarehouse] = useState(false)
  const [mSupplier, setMSupplier] = useState(false)
  const [mPurchase, setMPurchase] = useState(false)

  // Toast
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null)
  const showToast = useCallback((msg: string, ok = true) => {
    setToast({ msg, ok }); setTimeout(() => setToast(null), 3500)
  }, [])

  // Forms
  const emptyProd = { nom: '', categorie: '', sku: '', unite: 'pièce', prix_achat: '', prix_vente: '', seuil_alerte: '5' }
  const emptyAdj  = { type: 'IN' as 'IN' | 'OUT' | 'ADJUSTMENT', quantite: '', warehouse_id: '', reference: '', note: '' }
  const [prodForm, setProdForm] = useState(emptyProd)
  const [editForm, setEditForm] = useState(emptyProd)
  const [adjForm,  setAdjForm]  = useState(emptyAdj)
  const [whForm,   setWhForm]   = useState({ nom: '', localisation: '' })
  const [supForm,  setSupForm]  = useState({ nom: '', telephone: '', email: '', adresse: '' })
  const [purchForm, setPurchForm] = useState<{ supplier_id: string; warehouse_id: string; items: { product_id: string; quantite: string; prix: string }[] }>({
    supplier_id: '', warehouse_id: '', items: [{ product_id: '', quantite: '', prix: '' }],
  })
  const [saving, setSaving] = useState(false)

  // ── Load ─────────────────────────────────────────────────────
  const load = useCallback(async () => {
    if (!tenantId) return
    setLoading(true)

    const [prodsRes, allMovsRes, movsRes, whsRes, supsRes, purchsRes] = await Promise.all([
      supabase.from('products').select('*').eq('tenant_id', tenantId).order('nom'),
      // All movements (product_id + type + quantite only) for accurate stock computation
      supabase.from('stock_movements').select('product_id, type, quantite').eq('tenant_id', tenantId),
      // Full movements limited for the Mouvements tab display
      supabase.from('stock_movements').select('*, products(nom)').eq('tenant_id', tenantId).order('created_at', { ascending: false }).limit(200),
      supabase.from('warehouses').select('*').eq('tenant_id', tenantId).order('nom'),
      supabase.from('suppliers').select('*').eq('tenant_id', tenantId).order('nom'),
      supabase.from('purchases').select('*, suppliers(nom)').eq('tenant_id', tenantId).order('created_at', { ascending: false }),
    ])

    // Compute stock per product from ALL movements (accurate)
    const stockMap: Record<string, number> = {}
    for (const m of allMovsRes.data ?? []) {
      stockMap[m.product_id] = stockMap[m.product_id] ?? 0
      if      (m.type === 'IN')         stockMap[m.product_id] += Number(m.quantite)
      else if (m.type === 'OUT')        stockMap[m.product_id] -= Number(m.quantite)
      else if (m.type === 'ADJUSTMENT') stockMap[m.product_id] += Number(m.quantite)
    }

    setProducts((prodsRes.data ?? []).map(p => ({ ...p, stock_actuel: stockMap[p.id] ?? 0 })))
    setMovements(movsRes.data as Movement[] ?? [])
    setWarehouses(whsRes.data ?? [])
    setSuppliers(supsRes.data ?? [])
    setPurchases(purchsRes.data as Purchase[] ?? [])
    setLoading(false)
  }, [tenantId])

  useEffect(() => { if (!tLoading) load() }, [tLoading, load])

  // ── Handlers ─────────────────────────────────────────────────
  async function saveProduct() {
    if (!prodForm.nom.trim()) return
    setSaving(true)
    const { error } = await supabase.from('products').insert({
      tenant_id:    tenantId,
      nom:          prodForm.nom,
      categorie:    prodForm.categorie || null,
      sku:          prodForm.sku || null,
      unite:        prodForm.unite,
      prix_achat:   Number(prodForm.prix_achat) || 0,
      prix_vente:   Number(prodForm.prix_vente) || 0,
      seuil_alerte: Number(prodForm.seuil_alerte) || 0,
    })
    setSaving(false)
    if (error) { showToast('Erreur : ' + error.message, false); return }
    showToast('Produit ajouté')
    setMProd(false); setProdForm(emptyProd); load()
  }

  async function updateProduct() {
    if (!mEdit || !editForm.nom.trim()) return
    setSaving(true)
    const { error } = await supabase.from('products').update({
      nom:          editForm.nom,
      categorie:    editForm.categorie || null,
      sku:          editForm.sku || null,
      unite:        editForm.unite,
      prix_achat:   Number(editForm.prix_achat) || 0,
      prix_vente:   Number(editForm.prix_vente) || 0,
      seuil_alerte: Number(editForm.seuil_alerte) || 0,
    }).eq('id', mEdit.id)
    setSaving(false)
    if (error) { showToast('Erreur : ' + error.message, false); return }
    showToast('Produit mis à jour'); setMEdit(null); load()
  }

  async function adjustStock() {
    if (!mAdjust || !adjForm.quantite) return
    setSaving(true)
    const qty = Math.abs(Number(adjForm.quantite))
    if (adjForm.type === 'OUT' && qty > mAdjust.stock_actuel) {
      showToast(`Stock insuffisant — disponible : ${mAdjust.stock_actuel} ${mAdjust.unite}`, false)
      setSaving(false); return
    }
    const res = await fetch('/api/stock/move', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        product_id:   mAdjust.id,
        warehouse_id: adjForm.warehouse_id || null,
        type:         adjForm.type,
        quantite:     adjForm.type === 'ADJUSTMENT' ? Number(adjForm.quantite) : qty,
        reference:    adjForm.reference || null,
        note:         adjForm.note || null,
      }),
    })
    setSaving(false)
    if (!res.ok) {
      const d = await res.json().catch(() => ({}))
      showToast(d.error ?? 'Erreur lors du mouvement', false); return
    }
    showToast(adjForm.type === 'IN' ? 'Entrée enregistrée' : adjForm.type === 'OUT' ? 'Sortie enregistrée' : 'Ajustement appliqué')
    setMAdjust(null); setAdjForm(emptyAdj); load()
  }

  async function deleteProduct(id: string) {
    const { error } = await supabase.from('products').delete().eq('id', id)
    if (error) { showToast('Impossible de supprimer (mouvements liés ?)', false); return }
    showToast('Produit supprimé'); load()
  }

  async function saveWarehouse() {
    if (!whForm.nom.trim()) return
    setSaving(true)
    const { error } = await supabase.from('warehouses').insert({ tenant_id: tenantId, nom: whForm.nom, localisation: whForm.localisation || null })
    setSaving(false)
    if (error) { showToast('Erreur', false); return }
    showToast('Entrepôt ajouté'); setMWarehouse(false); setWhForm({ nom: '', localisation: '' }); load()
  }

  async function saveSupplier() {
    if (!supForm.nom.trim()) return
    setSaving(true)
    const { error } = await supabase.from('suppliers').insert({ tenant_id: tenantId, nom: supForm.nom, telephone: supForm.telephone || null, email: supForm.email || null, adresse: supForm.adresse || null })
    setSaving(false)
    if (error) { showToast('Erreur', false); return }
    showToast('Fournisseur ajouté'); setMSupplier(false); setSupForm({ nom: '', telephone: '', email: '', adresse: '' }); load()
  }

  async function savePurchase() {
    const valid = purchForm.items.filter(i => i.product_id && i.quantite && i.prix)
    if (!valid.length) { showToast('Ajoutez au moins un article valide', false); return }
    setSaving(true)
    const total = valid.reduce((s, i) => s + Number(i.quantite) * Number(i.prix), 0)

    const { data: purch, error: pErr } = await supabase.from('purchases').insert({
      tenant_id: tenantId, supplier_id: purchForm.supplier_id || null, montant_total: total, statut: 'reçu',
    }).select().single()

    if (pErr || !purch) { showToast('Erreur création achat', false); setSaving(false); return }

    for (const item of valid) {
      await supabase.from('purchase_items').insert({ purchase_id: purch.id, product_id: item.product_id, quantite: Number(item.quantite), prix: Number(item.prix) })
      await fetch('/api/stock/move', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ product_id: item.product_id, warehouse_id: purchForm.warehouse_id || null, type: 'IN', quantite: Number(item.quantite), reference: `ACHAT-${purch.id.slice(0,8).toUpperCase()}` }),
      })
    }

    setSaving(false)
    showToast(`Achat validé · ${fmtFCFA(total)} · stock mis à jour`)
    setMPurchase(false)
    setPurchForm({ supplier_id: '', warehouse_id: '', items: [{ product_id: '', quantite: '', prix: '' }] })
    load()
  }

  // ── Computed ─────────────────────────────────────────────────
  const alertes     = products.filter(p => p.stock_actuel <= p.seuil_alerte)
  const valeurTotale = products.reduce((s, p) => s + p.stock_actuel * p.prix_achat, 0)
  const categories  = ['tous', ...Array.from(new Set(products.map(p => p.categorie).filter(Boolean) as string[]))]
  const filtered = products.filter(p => {
    const q = search.toLowerCase()
    const matchSearch = p.nom.toLowerCase().includes(q) || (p.sku ?? '').toLowerCase().includes(q)
    if (catFilter === 'alertes') return matchSearch && p.stock_actuel <= p.seuil_alerte
    return matchSearch && (catFilter === 'tous' || p.categorie === catFilter)
  })

  if (tLoading || loading) {
    return <div className="flex items-center justify-center h-64"><div className="w-6 h-6 border-2 border-[#F08900] border-t-transparent rounded-full animate-spin" /></div>
  }

  return (
    <div className="space-y-5">

      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 flex items-center gap-2 rounded-xl px-4 py-3 text-sm shadow-2xl border transition-all ${toast.ok ? 'bg-[#142850] border-[#142850]/40 text-[#FFFFFF]' : 'bg-[#142850] border-red-500/40 text-red-300'}`}>
          {toast.ok ? <Check size={14} className="text-[#142850]" /> : <X size={14} className="text-red-400" />}
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-[#F08900]/10 border border-[#F08900]/20 flex items-center justify-center">
          <Package size={18} className="text-[#F08900]" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-[#FFFFFF]">Stock & Inventaire</h1>
          <p className="text-xs text-[#484F58]">{products.length} produits{alertes.length > 0 && <span className="ml-2 text-red-400">· {alertes.length} alerte{alertes.length > 1 ? 's' : ''}</span>}</p>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Valeur du stock', value: fmtFCFA(valeurTotale),      gradient: '#F08900', Icon: TrendingUp },
          { label: 'Produits',         value: products.length.toString(), gradient: '#8B0070', Icon: Package },
          { label: 'En alerte',        value: alertes.length.toString(),  gradient: alertes.length > 0 ? '#F51E33' : '#142850', Icon: AlertTriangle },
          { label: 'Fournisseurs',     value: suppliers.length.toString(),gradient: '#8B0070', Icon: Users2 },
        ].map(k => (
          <div key={k.label} className="relative rounded-xl p-4 overflow-hidden" style={{ background: k.gradient }}>
            <div className="absolute inset-0 pointer-events-none" style={{ background: 'transparent' }} />
            <div className="relative">
              <div className="flex items-center justify-between mb-2">
                <p className="text-white/70 text-[10px] font-semibold uppercase tracking-wider">{k.label}</p>
                <div className="w-7 h-7 rounded-lg bg-white/10 flex items-center justify-center">
                  <k.Icon size={12} className="text-white" />
                </div>
              </div>
              <p className="text-white text-xl font-bold leading-none">{k.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-[#0f1e3d] border border-[#30363D] rounded-xl p-1">
        {TABS.map(t => {
          const Icon = t.icon
          const active = tab === t.id
          return (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium flex-1 justify-center transition-colors ${active ? 'bg-[#F08900] text-[#142850]' : 'text-[#484F58] hover:text-[#8B949E]'}`}
            >
              <Icon size={13} /><span className="hidden sm:inline">{t.label}</span>
            </button>
          )
        })}
      </div>

      {/* ──────────── CATALOGUE ──────────── */}
      {tab === 'catalogue' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#484F58]" />
              <input placeholder="Rechercher par nom, SKU…" value={search} onChange={e => setSearch(e.target.value)}
                className="w-full bg-[#0f1e3d] border border-[#30363D] rounded-xl pl-9 pr-4 py-2.5 text-sm text-[#FFFFFF] placeholder-[#484F58] focus:outline-none focus:border-[#F08900]/40" />
            </div>
            <div className="flex gap-2 flex-wrap">
              {categories.map(c => (
                <button key={c} onClick={() => setCatFilter(c)}
                  className={`px-3 py-2 rounded-lg text-xs font-medium transition-colors ${catFilter === c ? 'bg-[#F08900]/10 text-[#F08900] border border-[#F08900]/30' : 'bg-[#0f1e3d] border border-[#30363D] text-[#484F58] hover:text-[#FFFFFF]'}`}>
                  {c === 'tous' ? 'Tous' : c}
                </button>
              ))}
              {alertes.length > 0 && (
                <button onClick={() => setCatFilter(catFilter === 'alertes' ? 'tous' : 'alertes')}
                  className={`px-3 py-2 rounded-lg text-xs font-medium transition-colors flex items-center gap-1 ${catFilter === 'alertes' ? 'bg-red-500/10 text-red-400 border border-red-500/30' : 'bg-[#0f1e3d] border border-[#30363D] text-red-400/70 hover:text-red-400'}`}>
                  <AlertTriangle size={11} /> Alertes ({alertes.length})
                </button>
              )}
            </div>
            <button onClick={() => setMProd(true)}
              className="flex items-center gap-2 px-4 py-2 bg-[#F08900] text-[#142850] rounded-xl text-sm font-semibold hover:bg-[#F08900]/90 transition-colors shrink-0">
              <Plus size={14} /> Ajouter
            </button>
          </div>

          {filtered.length === 0 ? (
            <div className="text-center py-16 text-[#484F58]">
              <Package size={32} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm">{products.length === 0 ? 'Aucun produit — commencez par en ajouter un' : 'Aucun résultat'}</p>
            </div>
          ) : (
            <>
              <div className="bg-[#0f1e3d] border border-[#30363D] rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-[#30363D]">
                        {['Produit', 'Catégorie', 'Unité', 'P. Achat', 'P. Vente', 'Stock', 'Statut', ''].map(h => (
                          <th key={h} className="text-left px-4 py-3 text-xs text-[#484F58] uppercase tracking-wider font-medium whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((p, i) => {
                        const enAlerte = p.stock_actuel <= p.seuil_alerte
                        return (
                          <tr key={p.id} className={`group ${i < filtered.length - 1 ? 'border-b border-[#1a2d50]' : ''} hover:bg-[#1a2d50]/50 transition-colors`}>
                            <td className="px-4 py-3">
                              <p className="font-medium text-[#FFFFFF]">{p.nom}</p>
                              {p.sku && <p className="text-xs text-[#484F58]">SKU : {p.sku}</p>}
                            </td>
                            <td className="px-4 py-3 text-[#8B949E] whitespace-nowrap">{p.categorie || '—'}</td>
                            <td className="px-4 py-3 text-[#8B949E]">{p.unite}</td>
                            <td className="px-4 py-3 text-[#FFFFFF] whitespace-nowrap">{fmtFCFA(p.prix_achat)}</td>
                            <td className="px-4 py-3 text-[#FFFFFF] whitespace-nowrap">{fmtFCFA(p.prix_vente)}</td>
                            <td className="px-4 py-3">
                              <span className={`font-bold ${enAlerte ? 'text-red-400' : 'text-[#FFFFFF]'}`}>{p.stock_actuel}</span>
                              <span className="text-xs text-[#484F58] ml-1">{p.unite}</span>
                            </td>
                            <td className="px-4 py-3">
                              {enAlerte
                                ? <span className="inline-flex items-center gap-1 text-xs text-red-400 bg-red-500/10 px-2 py-0.5 rounded-full"><AlertTriangle size={9} /> Alerte</span>
                                : <span className="text-xs text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">● OK</span>}
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button onClick={() => { setMAdjust(p); setAdjForm({ ...emptyAdj, warehouse_id: warehouses[0]?.id ?? '' }) }}
                                  className="text-xs px-2.5 py-1 rounded-lg bg-[#F08900]/10 text-[#F08900] hover:bg-[#F08900]/20 font-medium transition-colors whitespace-nowrap">
                                  Ajuster
                                </button>
                                <button onClick={() => { setMEdit(p); setEditForm({ nom: p.nom, categorie: p.categorie ?? '', sku: p.sku ?? '', unite: p.unite, prix_achat: String(p.prix_achat), prix_vente: String(p.prix_vente), seuil_alerte: String(p.seuil_alerte) }) }}
                                  className="text-[#484F58] hover:text-[#F08900] transition-colors">
                                  <Pencil size={13} />
                                </button>
                                <button onClick={() => deleteProduct(p.id)} className="text-[#484F58] hover:text-red-400 transition-colors"><Trash2 size={13} /></button>
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="bg-[#0f1e3d] border border-[#30363D] rounded-xl px-5 py-4 flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-[#8B949E] uppercase tracking-wider">Valeur totale du stock</p>
                  <p className="text-xs text-[#484F58] mt-0.5">{products.length} produits · {products.reduce((s, p) => s + p.stock_actuel, 0)} unités</p>
                </div>
                <p className="text-2xl font-bold text-[#F08900]">{fmtFCFA(valeurTotale)}</p>
              </div>
            </>
          )}
        </div>
      )}

      {/* ──────────── MOUVEMENTS ──────────── */}
      {tab === 'mouvements' && (
        <div className="space-y-4">
          <p className="text-sm text-[#8B949E]">{movements.length} mouvement{movements.length > 1 ? 's' : ''} récents</p>
          {movements.length === 0 ? (
            <div className="text-center py-16 text-[#484F58]"><RotateCcw size={32} className="mx-auto mb-3 opacity-30" /><p className="text-sm">Aucun mouvement — ajustez un produit pour commencer</p></div>
          ) : (
            <div className="bg-[#0f1e3d] border border-[#30363D] rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[#30363D]">
                      {['Date & Heure', 'Produit', 'Type', 'Quantité', 'Référence', 'Note'].map(h => (
                        <th key={h} className="text-left px-4 py-3 text-xs text-[#484F58] uppercase tracking-wider font-medium whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {movements.map((m, i) => {
                      const mt = MOV_META[m.type] ?? MOV_META.ADJUSTMENT
                      const MIcon = mt.Icon
                      return (
                        <tr key={m.id} className={`${i < movements.length - 1 ? 'border-b border-[#1a2d50]' : ''}`}>
                          <td className="px-4 py-3 text-xs text-[#484F58] whitespace-nowrap">
                            {new Date(m.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit' })}
                            {' '}{new Date(m.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                          </td>
                          <td className="px-4 py-3 text-[#FFFFFF] font-medium">{(m.products as { nom: string } | null)?.nom ?? '—'}</td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${mt.bg} ${mt.color}`}>
                              <MIcon size={9} />{mt.label}
                            </span>
                          </td>
                          <td className={`px-4 py-3 font-bold ${m.type === 'OUT' ? 'text-red-400' : 'text-emerald-400'}`}>
                            {m.type === 'OUT' ? '−' : '+'}{m.quantite}
                          </td>
                          <td className="px-4 py-3 text-xs text-[#8B949E]">{m.reference || '—'}</td>
                          <td className="px-4 py-3 text-xs text-[#484F58]">{m.note || '—'}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ──────────── ENTREPÔTS ──────────── */}
      {tab === 'entrepots' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button onClick={() => setMWarehouse(true)} className="flex items-center gap-2 px-4 py-2 bg-[#F08900] text-[#142850] rounded-xl text-sm font-semibold hover:bg-[#F08900]/90 transition-colors">
              <Plus size={14} /> Ajouter un entrepôt
            </button>
          </div>
          {warehouses.length === 0 ? (
            <div className="text-center py-16 text-[#484F58]"><Warehouse size={32} className="mx-auto mb-3 opacity-30" /><p className="text-sm">Aucun entrepôt configuré</p></div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {warehouses.map(w => (
                <div key={w.id} className="bg-[#0f1e3d] border border-[#30363D] rounded-xl p-5 flex items-start gap-3">
                  <div className="w-9 h-9 rounded-lg bg-[#8B0070]/10 border border-[#8B0070]/20 flex items-center justify-center shrink-0">
                    <Warehouse size={15} className="text-[#8B0070]" />
                  </div>
                  <div>
                    <p className="font-semibold text-[#FFFFFF]">{w.nom}</p>
                    <p className="text-xs text-[#484F58] mt-0.5">{w.localisation || 'Aucune localisation'}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ──────────── FOURNISSEURS ──────────── */}
      {tab === 'fournisseurs' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button onClick={() => setMSupplier(true)} className="flex items-center gap-2 px-4 py-2 bg-[#F08900] text-[#142850] rounded-xl text-sm font-semibold hover:bg-[#F08900]/90 transition-colors">
              <Plus size={14} /> Ajouter un fournisseur
            </button>
          </div>
          {suppliers.length === 0 ? (
            <div className="text-center py-16 text-[#484F58]"><Users2 size={32} className="mx-auto mb-3 opacity-30" /><p className="text-sm">Aucun fournisseur enregistré</p></div>
          ) : (
            <div className="bg-[#0f1e3d] border border-[#30363D] rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#30363D]">
                    {['Nom', 'Téléphone', 'Email', 'Adresse'].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-xs text-[#484F58] uppercase tracking-wider font-medium">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {suppliers.map((s, i) => (
                    <tr key={s.id} className={`${i < suppliers.length - 1 ? 'border-b border-[#1a2d50]' : ''} hover:bg-[#1a2d50]/50 transition-colors`}>
                      <td className="px-4 py-3 font-medium text-[#FFFFFF]">{s.nom}</td>
                      <td className="px-4 py-3 text-[#8B949E]">{s.telephone || '—'}</td>
                      <td className="px-4 py-3 text-[#8B949E]">{s.email || '—'}</td>
                      <td className="px-4 py-3 text-[#8B949E]">{s.adresse || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ──────────── ACHATS ──────────── */}
      {tab === 'achats' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button onClick={() => setMPurchase(true)} className="flex items-center gap-2 px-4 py-2 bg-[#F08900] text-[#142850] rounded-xl text-sm font-semibold hover:bg-[#F08900]/90 transition-colors">
              <Plus size={14} /> Nouvel achat
            </button>
          </div>
          {purchases.length === 0 ? (
            <div className="text-center py-16 text-[#484F58]"><ShoppingCart size={32} className="mx-auto mb-3 opacity-30" /><p className="text-sm">Aucun achat enregistré</p></div>
          ) : (
            <div className="bg-[#0f1e3d] border border-[#30363D] rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#30363D]">
                    {['Date', 'Fournisseur', 'Montant total', 'Statut'].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-xs text-[#484F58] uppercase tracking-wider font-medium">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {purchases.map((p, i) => (
                    <tr key={p.id} className={`${i < purchases.length - 1 ? 'border-b border-[#1a2d50]' : ''} hover:bg-[#1a2d50]/50 transition-colors`}>
                      <td className="px-4 py-3 text-xs text-[#8B949E] whitespace-nowrap">
                        {new Date(p.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </td>
                      <td className="px-4 py-3 text-[#FFFFFF]">{(p.suppliers as { nom: string } | null)?.nom ?? 'Sans fournisseur'}</td>
                      <td className="px-4 py-3 font-bold text-[#F08900]">{fmtFCFA(p.montant_total)}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${p.statut === 'reçu' ? 'bg-emerald-500/10 text-emerald-400' : p.statut === 'commande' ? 'bg-blue-500/10 text-blue-400' : 'bg-red-500/10 text-red-400'}`}>
                          {p.statut}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ════════════ MODALS ════════════ */}

      {/* Edit Product */}
      {mEdit && (
        <ModalShell title={`Modifier — ${mEdit.nom}`} onClose={() => setMEdit(null)}>
          <div className="space-y-3">
            <FInput label="Nom *" value={editForm.nom} onChange={e => setEditForm(f => ({...f, nom: e.target.value}))} />
            <div className="grid grid-cols-2 gap-3">
              <FInput label="Catégorie" value={editForm.categorie} onChange={e => setEditForm(f => ({...f, categorie: e.target.value}))} />
              <FInput label="SKU" value={editForm.sku} onChange={e => setEditForm(f => ({...f, sku: e.target.value}))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <FSelect label="Unité" value={editForm.unite} onChange={e => setEditForm(f => ({...f, unite: e.target.value}))}>
                {UNITES.map(u => <option key={u}>{u}</option>)}
              </FSelect>
              <FInput label="Seuil d'alerte" type="number" min="0" value={editForm.seuil_alerte} onChange={e => setEditForm(f => ({...f, seuil_alerte: e.target.value}))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <FInput label="Prix d'achat (FCFA)" type="number" min="0" value={editForm.prix_achat} onChange={e => setEditForm(f => ({...f, prix_achat: e.target.value}))} />
              <FInput label="Prix de vente (FCFA)" type="number" min="0" value={editForm.prix_vente} onChange={e => setEditForm(f => ({...f, prix_vente: e.target.value}))} />
            </div>
            <ModalActions onCancel={() => setMEdit(null)} onSave={updateProduct} saving={saving} label="Enregistrer les modifications" />
          </div>
        </ModalShell>
      )}

      {/* Add Product */}
      {mProd && (
        <ModalShell title="Ajouter un produit" onClose={() => setMProd(false)}>
          <div className="space-y-3">
            <FInput label="Nom du produit *" placeholder="Ex : Ciment Portland 50 kg" value={prodForm.nom} onChange={e => setProdForm(f => ({...f, nom: e.target.value}))} />
            <div className="grid grid-cols-2 gap-3">
              <FInput label="Catégorie" placeholder="Matériaux, Boissons…" value={prodForm.categorie} onChange={e => setProdForm(f => ({...f, categorie: e.target.value}))} />
              <FInput label="SKU / Référence" placeholder="MAT-001" value={prodForm.sku} onChange={e => setProdForm(f => ({...f, sku: e.target.value}))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <FSelect label="Unité" value={prodForm.unite} onChange={e => setProdForm(f => ({...f, unite: e.target.value}))}>
                {UNITES.map(u => <option key={u}>{u}</option>)}
              </FSelect>
              <FInput label="Seuil d'alerte" type="number" min="0" placeholder="5" value={prodForm.seuil_alerte} onChange={e => setProdForm(f => ({...f, seuil_alerte: e.target.value}))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <FInput label="Prix d'achat (FCFA)" type="number" min="0" placeholder="0" value={prodForm.prix_achat} onChange={e => setProdForm(f => ({...f, prix_achat: e.target.value}))} />
              <FInput label="Prix de vente (FCFA)" type="number" min="0" placeholder="0" value={prodForm.prix_vente} onChange={e => setProdForm(f => ({...f, prix_vente: e.target.value}))} />
            </div>
            <ModalActions onCancel={() => setMProd(false)} onSave={saveProduct} saving={saving} label="Ajouter le produit" />
          </div>
        </ModalShell>
      )}

      {/* Adjust Stock */}
      {mAdjust && (
        <ModalShell title={`Ajuster — ${mAdjust.nom}`} onClose={() => setMAdjust(null)}>
          <div className="space-y-4">
            <div>
              <label className="block text-xs text-[#8B949E] mb-2">Type de mouvement</label>
              <div className="grid grid-cols-3 gap-2">
                {(['IN', 'OUT', 'ADJUSTMENT'] as const).map(t => {
                  const mt = MOV_META[t]
                  const MIcon = mt.Icon
                  return (
                    <button key={t} onClick={() => setAdjForm(f => ({...f, type: t}))}
                      className={`flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-medium border transition-colors ${adjForm.type === t ? `${mt.bg} ${mt.color} border-current` : 'border-[#30363D] text-[#484F58] hover:text-[#8B949E]'}`}>
                      <MIcon size={11} />{mt.label}
                    </button>
                  )
                })}
              </div>
            </div>
            <div className="bg-[#142850] rounded-xl px-4 py-3 flex items-center justify-between text-sm">
              <span className="text-[#484F58]">Stock actuel</span>
              <span className="font-bold text-[#FFFFFF]">{mAdjust.stock_actuel} <span className="text-[#484F58] font-normal">{mAdjust.unite}</span></span>
            </div>
            <FInput
              label={adjForm.type === 'ADJUSTMENT' ? 'Delta (+/−) en ' + mAdjust.unite : `Quantité (${mAdjust.unite})`}
              type="number" placeholder={adjForm.type === 'ADJUSTMENT' ? '+10 ou −5' : '0'}
              value={adjForm.quantite}
              onChange={e => setAdjForm(f => ({...f, quantite: e.target.value}))}
            />
            {warehouses.length > 0 && (
              <FSelect label="Entrepôt" value={adjForm.warehouse_id} onChange={e => setAdjForm(f => ({...f, warehouse_id: e.target.value}))}>
                <option value="">— Aucun entrepôt —</option>
                {warehouses.map(w => <option key={w.id} value={w.id}>{w.nom}</option>)}
              </FSelect>
            )}
            <div className="grid grid-cols-2 gap-3">
              <FInput label="Référence" placeholder="BON-001, CMD…" value={adjForm.reference} onChange={e => setAdjForm(f => ({...f, reference: e.target.value}))} />
              <FInput label="Note" placeholder="Commentaire…" value={adjForm.note} onChange={e => setAdjForm(f => ({...f, note: e.target.value}))} />
            </div>
            <ModalActions onCancel={() => setMAdjust(null)} onSave={adjustStock} saving={saving}
              label={adjForm.type === 'IN' ? "Enregistrer l'entrée" : adjForm.type === 'OUT' ? 'Enregistrer la sortie' : "Appliquer l'ajustement"} />
          </div>
        </ModalShell>
      )}

      {/* Add Warehouse */}
      {mWarehouse && (
        <ModalShell title="Ajouter un entrepôt" onClose={() => setMWarehouse(false)}>
          <div className="space-y-3">
            <FInput label="Nom *" placeholder="Entrepôt principal" value={whForm.nom} onChange={e => setWhForm(f => ({...f, nom: e.target.value}))} />
            <FInput label="Localisation" placeholder="Zone industrielle, Brazzaville" value={whForm.localisation} onChange={e => setWhForm(f => ({...f, localisation: e.target.value}))} />
            <ModalActions onCancel={() => setMWarehouse(false)} onSave={saveWarehouse} saving={saving} label="Ajouter" />
          </div>
        </ModalShell>
      )}

      {/* Add Supplier */}
      {mSupplier && (
        <ModalShell title="Ajouter un fournisseur" onClose={() => setMSupplier(false)}>
          <div className="space-y-3">
            <FInput label="Nom *" placeholder="Nom du fournisseur" value={supForm.nom} onChange={e => setSupForm(f => ({...f, nom: e.target.value}))} />
            <div className="grid grid-cols-2 gap-3">
              <FInput label="Téléphone" placeholder="+242…" value={supForm.telephone} onChange={e => setSupForm(f => ({...f, telephone: e.target.value}))} />
              <FInput label="Email" type="email" placeholder="contact@…" value={supForm.email} onChange={e => setSupForm(f => ({...f, email: e.target.value}))} />
            </div>
            <FInput label="Adresse" placeholder="Adresse complète" value={supForm.adresse} onChange={e => setSupForm(f => ({...f, adresse: e.target.value}))} />
            <ModalActions onCancel={() => setMSupplier(false)} onSave={saveSupplier} saving={saving} label="Ajouter" />
          </div>
        </ModalShell>
      )}

      {/* New Purchase */}
      {mPurchase && (
        <ModalShell title="Nouvel achat fournisseur" onClose={() => setMPurchase(false)}>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <FSelect label="Fournisseur" value={purchForm.supplier_id} onChange={e => setPurchForm(f => ({...f, supplier_id: e.target.value}))}>
                <option value="">— Sans fournisseur —</option>
                {suppliers.map(s => <option key={s.id} value={s.id}>{s.nom}</option>)}
              </FSelect>
              <FSelect label="Entrepôt destination" value={purchForm.warehouse_id} onChange={e => setPurchForm(f => ({...f, warehouse_id: e.target.value}))}>
                <option value="">— Aucun —</option>
                {warehouses.map(w => <option key={w.id} value={w.id}>{w.nom}</option>)}
              </FSelect>
            </div>

            <div>
              <label className="block text-xs text-[#8B949E] mb-2">Articles commandés</label>
              <div className="space-y-2">
                {purchForm.items.map((item, idx) => (
                  <div key={idx} className="grid grid-cols-[1fr_72px_96px_20px] gap-2 items-end">
                    <FSelect value={item.product_id} onChange={e => setPurchForm(f => ({ ...f, items: f.items.map((it, i) => i === idx ? {...it, product_id: e.target.value} : it) }))}>
                      <option value="">— Produit —</option>
                      {products.map(p => <option key={p.id} value={p.id}>{p.nom}</option>)}
                    </FSelect>
                    <input type="number" min="0" placeholder="Qté" value={item.quantite}
                      onChange={e => setPurchForm(f => ({ ...f, items: f.items.map((it, i) => i === idx ? {...it, quantite: e.target.value} : it) }))}
                      className="bg-[#142850] border border-[#30363D] rounded-lg px-2 py-2 text-sm text-[#FFFFFF] focus:outline-none focus:border-[#F08900]/50 w-full" />
                    <input type="number" min="0" placeholder="Prix" value={item.prix}
                      onChange={e => setPurchForm(f => ({ ...f, items: f.items.map((it, i) => i === idx ? {...it, prix: e.target.value} : it) }))}
                      className="bg-[#142850] border border-[#30363D] rounded-lg px-2 py-2 text-sm text-[#FFFFFF] focus:outline-none focus:border-[#F08900]/50 w-full" />
                    <button onClick={() => setPurchForm(f => ({ ...f, items: f.items.filter((_, i) => i !== idx) }))}
                      className="text-[#484F58] hover:text-red-400 transition-colors pb-2 self-end"><X size={13} /></button>
                  </div>
                ))}
                <button onClick={() => setPurchForm(f => ({ ...f, items: [...f.items, { product_id: '', quantite: '', prix: '' }] }))}
                  className="flex items-center gap-1.5 text-xs text-[#484F58] hover:text-[#F08900] transition-colors mt-1">
                  <Plus size={12} /> Ajouter un article
                </button>
              </div>
            </div>

            <div className="bg-[#142850] rounded-xl px-4 py-3 flex items-center justify-between">
              <span className="text-sm text-[#8B949E]">Total commande</span>
              <span className="font-bold text-[#F08900]">{fmtFCFA(purchForm.items.reduce((s, i) => s + (Number(i.quantite) || 0) * (Number(i.prix) || 0), 0))}</span>
            </div>
            <ModalActions onCancel={() => setMPurchase(false)} onSave={savePurchase} saving={saving} label="Valider et mettre à jour le stock" />
          </div>
        </ModalShell>
      )}
    </div>
  )
}

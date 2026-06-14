'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useFmt } from '@/lib/hooks/useFmt'
import { useTenantContext } from '@/lib/contexts/TenantContext'
import Link from 'next/link'
import {
  Package, Plus, Search, RefreshCw, Loader2, X, CheckCircle, Edit3, AlertTriangle,
} from 'lucide-react'

interface Produit {
  id: string
  nom: string
  description: string | null
  prix_vente: number
  prix_achat: number | null
  code_barre: string | null
  categorie: string | null
  stock_actuel: number
  seuil_alerte: number | null
  unite: string | null
  statut: 'actif' | 'inactif' | 'rupture'
  created_at: string
}

function ModalProduit({
  produit, onClose, onSaved,
}: { produit: Produit | null; onClose: () => void; onSaved: () => void }) {
  const { tenant } = useTenantContext()
  const [form, setForm] = useState({
    nom:         produit?.nom               ?? '',
    description: produit?.description       ?? '',
    prix:        produit?.prix_vente?.toString()   ?? '',
    prix_achat:  produit?.prix_achat?.toString()   ?? '',
    code_barre:  produit?.code_barre        ?? '',
    categorie:   produit?.categorie         ?? '',
    stock:       produit?.stock_actuel?.toString() ?? '0',
    stock_min:   produit?.seuil_alerte?.toString() ?? '',
    unite:       produit?.unite             ?? 'pcs',
    statut:      produit?.statut            ?? 'actif' as Produit['statut'],
  })
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    if (!form.nom || !form.prix) return
    setSaving(true)
    const data = {
      nom: form.nom, description: form.description || null,
      prix_vente: parseFloat(form.prix) || 0, prix_achat: form.prix_achat ? parseFloat(form.prix_achat) : null,
      code_barre: form.code_barre || null, categorie: form.categorie || null,
      stock_actuel: parseInt(form.stock) || 0, seuil_alerte: form.stock_min ? parseInt(form.stock_min) : null,
      unite: form.unite, statut: form.statut,
    }
    if (produit) {
      await supabase.from('products').update(data).eq('id', produit.id).eq('tenant_id', tenant?.tenantId)
    } else {
      await supabase.from('products').insert({ ...data, tenant_id: tenant?.tenantId })
    }
    setSaving(false)
    onSaved()
  }

  const { fmt } = useFmt()
  const margeForm = form.prix && form.prix_achat
    ? ((parseFloat(form.prix) - parseFloat(form.prix_achat)) / parseFloat(form.prix) * 100).toFixed(1)
    : null

  const I = 'w-full px-3 py-2.5 text-[13px] border border-[#E2E8F0] rounded-xl focus:outline-none focus:ring-2 focus:ring-red-300 bg-white'

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#E2E8F0] sticky top-0 bg-white">
          <h2 className="font-black text-[15px]">{produit ? 'Modifier produit' : 'Nouveau produit'}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-[#F1F5F9]"><X size={16} /></button>
        </div>
        <div className="p-5 space-y-3">
          <div>
            <label className="block text-[12px] font-bold mb-1.5">Nom *</label>
            <input value={form.nom} onChange={e => setForm(f => ({ ...f, nom: e.target.value }))} className={I} placeholder="Nom du produit" />
          </div>
          <div>
            <label className="block text-[12px] font-bold mb-1.5">Description</label>
            <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2} className={`${I} resize-none`} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[12px] font-bold mb-1.5">Prix de vente (FCFA) *</label>
              <input type="number" value={form.prix} onChange={e => setForm(f => ({ ...f, prix: e.target.value }))} className={I} />
            </div>
            <div>
              <label className="block text-[12px] font-bold mb-1.5">Prix d'achat (FCFA)</label>
              <input type="number" value={form.prix_achat} onChange={e => setForm(f => ({ ...f, prix_achat: e.target.value }))} className={I} />
            </div>
          </div>
          {margeForm !== null && (
            <div className="bg-green-50 border border-green-200 rounded-xl px-3 py-2 text-[11px] text-green-700 font-semibold text-center">
              Marge brute : {margeForm}%
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[12px] font-bold mb-1.5">Code barre</label>
              <input value={form.code_barre} onChange={e => setForm(f => ({ ...f, code_barre: e.target.value }))} className={I} />
            </div>
            <div>
              <label className="block text-[12px] font-bold mb-1.5">Catégorie</label>
              <input value={form.categorie} onChange={e => setForm(f => ({ ...f, categorie: e.target.value }))} className={I} placeholder="Alimentaire, Hygiène..." />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-[12px] font-bold mb-1.5">Stock actuel</label>
              <input type="number" value={form.stock} onChange={e => setForm(f => ({ ...f, stock: e.target.value }))} className={I} />
            </div>
            <div>
              <label className="block text-[12px] font-bold mb-1.5">Stock min</label>
              <input type="number" value={form.stock_min} onChange={e => setForm(f => ({ ...f, stock_min: e.target.value }))} className={I} />
            </div>
            <div>
              <label className="block text-[12px] font-bold mb-1.5">Unité</label>
              <select value={form.unite} onChange={e => setForm(f => ({ ...f, unite: e.target.value }))} className={I}>
                {['pcs', 'kg', 'g', 'L', 'mL', 'carton', 'boîte', 'sac'].map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-[12px] font-bold mb-1.5">Statut</label>
            <select value={form.statut} onChange={e => setForm(f => ({ ...f, statut: e.target.value as Produit['statut'] }))} className={I}>
              <option value="actif">Actif</option>
              <option value="inactif">Inactif</option>
              <option value="rupture">Rupture</option>
            </select>
          </div>
          <button onClick={handleSave} disabled={!form.nom || !form.prix || saving}
            className="w-full py-2.5 bg-red-600 text-white rounded-xl text-[13px] font-bold hover:bg-red-700 disabled:opacity-40 flex items-center justify-center gap-1.5">
            {saving ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />}
            {produit ? 'Enregistrer' : 'Ajouter au catalogue'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function CommerceCataloguePage() {
  const { fmt } = useFmt()
  const { tenant } = useTenantContext()
  const tid = tenant?.tenantId

  const [produits,   setProduits]   = useState<Produit[]>([])
  const [loading,    setLoading]    = useState(true)
  const [search,     setSearch]     = useState('')
  const [filterCat,  setFilterCat]  = useState('tous')
  const [filterStat, setFilterStat] = useState('tous')
  const [modal,      setModal]      = useState(false)
  const [edit,       setEdit]       = useState<Produit | null>(null)

  const load = useCallback(async () => {
    if (!tid) return
    setLoading(true)
    const { data } = await supabase.from('products').select('*').eq('tenant_id', tid).order('nom')
    setProduits((data ?? []) as Produit[])
    setLoading(false)
  }, [tid])

  useEffect(() => { load() }, [load])

  const categories = [...new Set(produits.map(p => p.categorie).filter(Boolean) as string[])]

  const filtered = produits.filter(p => {
    const q = search.toLowerCase()
    const matchQ = !q || p.nom.toLowerCase().includes(q) || p.code_barre?.includes(q) || p.categorie?.toLowerCase().includes(q)
    const matchC = filterCat  === 'tous' || p.categorie === filterCat
    const matchS = filterStat === 'tous' || p.statut    === filterStat
    return matchQ && matchC && matchS
  })

  const ruptures   = produits.filter(p => p.seuil_alerte != null && p.stock_actuel <= (p.seuil_alerte ?? 0))
  const actifs     = produits.filter(p => p.statut === 'actif').length
  const valeurStock= produits.reduce((s, p) => s + p.stock_actuel * (p.prix_achat ?? p.prix_vente), 0)

  const STATUT_COLORS: Record<string, { color: string; bg: string }> = {
    actif:   { color: '#16A34A', bg: '#F0FDF4' },
    inactif: { color: '#64748B', bg: '#F8FAFC' },
    rupture: { color: '#DC2626', bg: '#FEF2F2' },
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] pb-20">
      <div className="bg-white border-b border-[#E2E8F0] px-4 sm:px-6 py-4 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link href="/dashboard/commerce" className="text-[#64748B] hover:text-[#0F172A] text-[13px]">← Commerce</Link>
            <span className="text-[#E2E8F0]">/</span>
            <div className="flex items-center gap-2">
              <Package size={16} className="text-red-600" />
              <h1 className="text-[16px] font-black text-[#0F172A]">Catalogue produits</h1>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={load} className="p-2 border border-[#E2E8F0] rounded-xl text-[#64748B]">{loading ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}</button>
            <button onClick={() => { setEdit(null); setModal(true) }}
              className="flex items-center gap-1.5 px-4 py-2 bg-red-600 text-white rounded-xl text-[13px] font-bold hover:bg-red-700">
              <Plus size={14} /> Ajouter produit
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">

        {/* KPIs */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-white rounded-2xl p-4 border border-[#E2E8F0] shadow-sm">
            <p className="text-[10px] font-bold text-[#64748B] uppercase mb-1">Total produits</p>
            <p className="text-[22px] font-black text-[#0F172A]">{produits.length}</p>
            <p className="text-[11px] text-green-600">{actifs} actifs</p>
          </div>
          <div className="bg-white rounded-2xl p-4 border border-[#E2E8F0] shadow-sm">
            <p className="text-[10px] font-bold text-[#64748B] uppercase mb-1">Catégories</p>
            <p className="text-[22px] font-black text-[#0F172A]">{categories.length}</p>
          </div>
          <div className="bg-white rounded-2xl p-4 border border-[#E2E8F0] shadow-sm">
            <p className="text-[10px] font-bold text-[#64748B] uppercase mb-1">Stock alertes</p>
            <p className={`text-[22px] font-black ${ruptures.length > 0 ? 'text-red-600' : 'text-green-600'}`}>{ruptures.length}</p>
          </div>
          <div className="bg-white rounded-2xl p-4 border border-[#E2E8F0] shadow-sm">
            <p className="text-[10px] font-bold text-[#64748B] uppercase mb-1">Valeur stock</p>
            <p className="text-[20px] font-black text-[#0F172A]">{fmt(valeurStock)}</p>
          </div>
        </div>

        {/* Alertes stock */}
        {ruptures.length > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-4">
            <p className="text-[12px] font-black text-red-800 flex items-center gap-1.5 mb-2">
              <AlertTriangle size={13} /> {ruptures.length} produit(s) en rupture ou stock faible
            </p>
            <div className="flex flex-wrap gap-2">
              {ruptures.map(p => (
                <span key={p.id} className="text-[11px] px-2 py-0.5 bg-red-100 text-red-700 rounded-full font-semibold">
                  {p.nom} ({p.stock_actuel} {p.unite})
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Filtres */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Nom, code barre, catégorie..."
              className="w-full pl-9 pr-4 py-2.5 text-[13px] border border-[#E2E8F0] rounded-xl focus:outline-none focus:ring-2 focus:ring-red-300 bg-white" />
          </div>
          <select value={filterCat} onChange={e => setFilterCat(e.target.value)}
            className="px-3 py-2.5 text-[12px] border border-[#E2E8F0] rounded-xl bg-white focus:outline-none">
            <option value="tous">Toutes catégories</option>
            {categories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <select value={filterStat} onChange={e => setFilterStat(e.target.value)}
            className="px-3 py-2.5 text-[12px] border border-[#E2E8F0] rounded-xl bg-white focus:outline-none">
            <option value="tous">Tous statuts</option>
            <option value="actif">Actif</option>
            <option value="inactif">Inactif</option>
            <option value="rupture">Rupture</option>
          </select>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16 gap-2 text-[#94A3B8]"><Loader2 size={18} className="animate-spin" /></div>
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-2xl border border-dashed border-[#CBD5E1] p-16 text-center">
            <Package size={40} className="text-[#CBD5E1] mx-auto mb-3" />
            <p className="font-bold text-[#0F172A] mb-1">Aucun produit</p>
            <button onClick={() => { setEdit(null); setModal(true) }}
              className="mt-3 inline-flex items-center gap-1.5 px-4 py-2.5 bg-red-600 text-white rounded-xl text-[13px] font-bold">
              <Plus size={13} /> Ajouter
            </button>
          </div>
        ) : (
          <>
            {/* Desktop */}
            <div className="hidden sm:block bg-white rounded-2xl border border-[#E2E8F0] shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-[12px] min-w-[700px]">
                  <thead className="bg-[#F8FAFC] text-[#64748B] font-bold border-b border-[#E2E8F0]">
                    <tr>
                      <th className="text-left px-4 py-2.5">Produit</th>
                      <th className="text-left px-4 py-2.5">Catégorie</th>
                      <th className="text-right px-4 py-2.5">Prix vente</th>
                      <th className="text-right px-4 py-2.5">Prix achat</th>
                      <th className="text-right px-4 py-2.5">Marge</th>
                      <th className="text-right px-4 py-2.5">Stock</th>
                      <th className="text-left px-4 py-2.5">Statut</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F1F5F9]">
                    {filtered.map(p => {
                      const marge = p.prix_achat ? ((p.prix_vente - p.prix_achat) / p.prix_vente * 100) : null
                      const stockAlerte = p.seuil_alerte != null && p.stock_actuel <= p.seuil_alerte
                      const sc = STATUT_COLORS[p.statut]
                      return (
                        <tr key={p.id} className="hover:bg-[#F8FAFC] group">
                          <td className="px-4 py-3">
                            <p className="font-bold text-[#0F172A]">{p.nom}</p>
                            {p.code_barre && <p className="text-[10px] font-mono text-[#94A3B8]">{p.code_barre}</p>}
                          </td>
                          <td className="px-4 py-3 text-[#64748B]">{p.categorie ?? '—'}</td>
                          <td className="px-4 py-3 text-right font-black text-[#0F172A]">{fmt(p.prix_vente)}</td>
                          <td className="px-4 py-3 text-right text-[#64748B]">{p.prix_achat ? fmt(p.prix_achat) : '—'}</td>
                          <td className="px-4 py-3 text-right font-bold text-green-600">{marge !== null ? `${marge.toFixed(1)}%` : '—'}</td>
                          <td className={`px-4 py-3 text-right font-bold ${stockAlerte ? 'text-red-600' : 'text-[#0F172A]'}`}>
                            {p.stock_actuel} {p.unite}
                            {stockAlerte && <AlertTriangle size={10} className="inline ml-1" />}
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-[10px] px-2 py-0.5 rounded-full font-bold" style={{ background: sc.bg, color: sc.color }}>{p.statut}</span>
                          </td>
                          <td className="px-4 py-3">
                            <button onClick={() => { setEdit(p); setModal(true) }}
                              className="p-1.5 rounded-lg hover:bg-[#F1F5F9] text-[#94A3B8] opacity-0 group-hover:opacity-100">
                              <Edit3 size={12} />
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Mobile grid */}
            <div className="sm:hidden grid grid-cols-1 gap-3">
              {filtered.map(p => {
                const marge = p.prix_achat ? ((p.prix_vente - p.prix_achat) / p.prix_vente * 100) : null
                const stockAlerte = p.seuil_alerte != null && p.stock_actuel <= p.seuil_alerte
                const sc = STATUT_COLORS[p.statut]
                return (
                  <div key={p.id} className="bg-white rounded-2xl border border-[#E2E8F0] shadow-sm p-4" onClick={() => { setEdit(p); setModal(true) }}>
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div>
                        <p className="font-black text-[13px] text-[#0F172A]">{p.nom}</p>
                        {p.categorie && <p className="text-[11px] text-[#94A3B8]">{p.categorie}</p>}
                      </div>
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-bold flex-shrink-0" style={{ background: sc.bg, color: sc.color }}>{p.statut}</span>
                    </div>
                    <div className="flex items-center justify-between text-[12px]">
                      <div>
                        <span className="font-black text-[#0F172A]">{fmt(p.prix_vente)}</span>
                        {marge !== null && <span className="ml-2 text-green-600 font-semibold">{marge.toFixed(0)}% marge</span>}
                      </div>
                      <span className={`font-bold ${stockAlerte ? 'text-red-600' : 'text-[#64748B]'}`}>
                        {p.stock_actuel} {p.unite} {stockAlerte && '⚠️'}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>

      {modal && <ModalProduit produit={edit} onClose={() => setModal(false)} onSaved={() => { setModal(false); load() }} />}
    </div>
  )
}

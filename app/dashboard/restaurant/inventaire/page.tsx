'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useFmt } from '@/lib/hooks/useFmt'
import { ArrowLeft, RefreshCw, AlertTriangle, Package, Loader2, Check, X } from 'lucide-react'

interface Article {
  id: string; nom: string; categorie: string
  quantite: number; prix_unitaire: number; seuil_alerte: number; unite?: string
}

interface RecetteLink { menu_item_id: string; article_id: string; quantite_par_portion: number; unite: string; resto_menu: { nom: string } | null }

function statusColor(qty: number, seuil: number) {
  if (seuil <= 0) return { color: '#94A3B8', bg: '#F8FAFC', label: 'OK' }
  if (qty <= 0)   return { color: '#DC2626', bg: '#FEF2F2', label: 'Rupture' }
  if (qty < seuil) return { color: '#DC2626', bg: '#FEF2F2', label: 'Critique' }
  if (qty < seuil * 1.5) return { color: '#F59E0B', bg: '#FFFBEB', label: 'Faible' }
  return { color: '#16A34A', bg: '#F0FDF4', label: 'OK' }
}

export default function InventairePage() {
  const { fmt: fmtCurrency } = useFmt()
  const [articles,  setArticles]  = useState<Article[]>([])
  const [recettes,  setRecettes]  = useState<RecetteLink[]>([])
  const [loading,   setLoading]   = useState(true)
  const [editId,    setEditId]    = useState<string | null>(null)
  const [editQty,   setEditQty]   = useState('')
  const [saving,    setSaving]    = useState(false)
  const [filterCrit, setFilterCrit] = useState(false)

  async function load() {
    setLoading(true)
    const [aRes, rRes] = await Promise.all([
      fetch('/api/stocks/articles?categorie=cuisine&limit=200'),
      fetch('/api/resto/recettes'),
    ])
    if (aRes.ok) { const d = await aRes.json(); setArticles(d.articles ?? d.data ?? []) }
    if (rRes.ok) { const d = await rRes.json(); setRecettes(d.recettes ?? []) }
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function saveQty(id: string) {
    setSaving(true)
    await fetch('/api/stocks/articles', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, quantite: Number(editQty) }),
    })
    setSaving(false); setEditId(null); load()
  }

  function getUsedIn(articleId: string) {
    return recettes.filter(r => r.article_id === articleId).map(r => r.resto_menu?.nom).filter(Boolean)
  }

  const displayed = filterCrit
    ? articles.filter(a => a.seuil_alerte > 0 && a.quantite < a.seuil_alerte)
    : articles

  const critiques = articles.filter(a => a.seuil_alerte > 0 && a.quantite < a.seuil_alerte)
  const ruptures  = articles.filter(a => a.quantite <= 0)

  return (
    <div className="min-h-screen bg-[#F8FAFC] pb-20">
      <div className="bg-white border-b border-[#E2E8F0] px-4 sm:px-6 py-4">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link href="/dashboard/restaurant" className="flex items-center gap-1 text-[#64748B] text-[13px]"><ArrowLeft size={14} /> Restaurant</Link>
            <span className="text-[#E2E8F0]">/</span>
            <h1 className="text-[16px] font-black text-[#0F172A]">Inventaire Ingrédients</h1>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setFilterCrit(v => !v)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[12px] font-bold border transition-all ${filterCrit ? 'bg-red-500 text-white border-red-500' : 'bg-white text-[#64748B] border-[#E2E8F0]'}`}>
              <AlertTriangle size={12} /> Critiques ({critiques.length})
            </button>
            <button onClick={load} className="p-2 border border-[#E2E8F0] rounded-xl text-[#64748B]"><RefreshCw size={13} /></button>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-5">
        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
          {[
            { label: 'Total articles',  val: String(articles.length),  color: '#0F172A' },
            { label: 'Critiques',        val: String(critiques.length), color: '#DC2626' },
            { label: 'Ruptures',         val: String(ruptures.length),  color: '#DC2626' },
            { label: 'Valeur stock',     val: fmtCurrency(articles.reduce((s, a) => s + a.quantite * a.prix_unitaire, 0)), color: '#16A34A' },
          ].map(s => (
            <div key={s.label} className="bg-white rounded-2xl p-3 border border-[#E2E8F0] shadow-sm text-center">
              <p className="text-[18px] font-black" style={{ color: s.color }}>{s.val}</p>
              <p className="text-[10px] font-bold text-[#64748B] uppercase tracking-wide">{s.label}</p>
            </div>
          ))}
        </div>

        {loading ? (
          <div className="flex justify-center py-16 gap-2 text-[#94A3B8]"><Loader2 size={18} className="animate-spin" /> Chargement...</div>
        ) : displayed.length === 0 ? (
          <div className="bg-white rounded-2xl border border-dashed border-[#CBD5E1] p-16 text-center">
            <Package size={36} className="text-[#CBD5E1] mx-auto mb-3" />
            <p className="font-bold text-[#0F172A]">Aucun ingrédient en catégorie cuisine</p>
            <p className="text-[13px] text-[#64748B] mt-1">Ajoutez des articles stock avec catégorie &quot;cuisine&quot;.</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-[12px]">
                <thead className="bg-[#F8FAFC]">
                  <tr>
                    {['Ingrédient', 'Stock actuel', 'Seuil alerte', 'Statut', 'Prix unit.', 'Utilisé dans', 'Action'].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-[10px] font-bold text-[#94A3B8] uppercase tracking-wide border-b border-[#E2E8F0]">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {displayed.map(a => {
                    const st = statusColor(a.quantite, a.seuil_alerte)
                    const usedIn = getUsedIn(a.id)
                    const isEditing = editId === a.id
                    return (
                      <tr key={a.id} className="border-b border-[#F1F5F9] hover:bg-[#F8FAFC]">
                        <td className="px-4 py-3 font-semibold text-[#0F172A]">{a.nom}</td>
                        <td className="px-4 py-3">
                          {isEditing ? (
                            <div className="flex items-center gap-1">
                              <input type="number" value={editQty} onChange={e => setEditQty(e.target.value)} autoFocus
                                className="w-16 px-2 py-1 border border-amber-300 rounded-lg text-[12px] focus:outline-none focus:ring-1 focus:ring-amber-300" />
                              <button onClick={() => saveQty(a.id)} disabled={saving} className="p-1 text-[#16A34A]"><Check size={13} /></button>
                              <button onClick={() => setEditId(null)} className="p-1 text-[#94A3B8]"><X size={13} /></button>
                            </div>
                          ) : (
                            <button onClick={() => { setEditId(a.id); setEditQty(String(a.quantite)) }}
                              className="font-bold hover:text-amber-600" style={{ color: st.color }}>
                              {a.quantite} {a.unite ?? ''}
                            </button>
                          )}
                        </td>
                        <td className="px-4 py-3 text-[#64748B]">{a.seuil_alerte > 0 ? a.seuil_alerte : '—'}</td>
                        <td className="px-4 py-3">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold" style={{ background: st.bg, color: st.color }}>{st.label}</span>
                        </td>
                        <td className="px-4 py-3 text-[#64748B]">{new Intl.NumberFormat('fr-FR').format(a.prix_unitaire)} FCFA</td>
                        <td className="px-4 py-3">
                          {usedIn.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {usedIn.slice(0, 2).map(n => (
                                <span key={n} className="px-1.5 py-0.5 bg-amber-50 text-amber-700 rounded-md text-[10px] font-semibold">{n}</span>
                              ))}
                              {usedIn.length > 2 && <span className="text-[10px] text-[#94A3B8]">+{usedIn.length - 2}</span>}
                            </div>
                          ) : <span className="text-[#CBD5E1]">—</span>}
                        </td>
                        <td className="px-4 py-3">
                          <button onClick={() => { setEditId(a.id); setEditQty(String(a.quantite)) }}
                            className="text-[11px] text-amber-600 font-bold hover:text-amber-700">
                            Ajuster
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

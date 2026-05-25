'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useTenant } from '@/lib/hooks/useTenant'
import {
  QrCode, Search, Printer, RefreshCw,
  Grid3X3, List, Tag, X, CheckCircle2
} from 'lucide-react'

interface Product {
  id: string
  nom: string
  sku: string
  code_barre: string | null
  unite: string
  prix_vente: number
  categorie: string | null
  stock_actuel: number
}

export default function CodesBarresPage() {
  const { tenantId } = useTenant()
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [qrDataURLs, setQrDataURLs] = useState<Record<string, string>>({})
  const [generating, setGenerating] = useState(false)
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list')

  const load = useCallback(async () => {
    if (!tenantId) return
    setLoading(true)
    try {
      const { data } = await supabase
        .from('products')
        .select('id,nom,sku,code_barre,unite,prix_vente,categorie,stock_actuel')
        .eq('tenant_id', tenantId)
        .eq('statut','actif')
        .order('nom')
      setProducts(data || [])
    } catch {}
    setLoading(false)
  }, [tenantId])

  useEffect(() => { load() }, [load])

  const generateQR = async (text: string): Promise<string> => {
    try {
      const QRCode = (await import('qrcode')).default
      return await QRCode.toDataURL(text, {
        width: 200, margin: 1,
        color: { dark: '#0F172A', light: '#FFFFFF' }
      })
    } catch { return '' }
  }

  const generateAll = useCallback(async (prods: Product[]) => {
    setGenerating(true)
    const urls: Record<string, string> = {}
    for (const p of prods.slice(0, 100)) {
      urls[p.id] = await generateQR(p.code_barre || p.sku)
    }
    setQrDataURLs(prev => ({ ...prev, ...urls }))
    setGenerating(false)
  }, [])

  useEffect(() => {
    if (products.length > 0) generateAll(products)
  }, [products, generateAll])

  const filtered = products.filter(p => {
    const q = search.toLowerCase()
    return !q || p.nom.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q) || (p.code_barre||'').toLowerCase().includes(q)
  })

  const toggleSelect = (id: string) => setSelected(prev => {
    const n = new Set(prev)
    n.has(id) ? n.delete(id) : n.add(id)
    return n
  })

  const selectAll = () => setSelected(
    selected.size === filtered.length && filtered.length > 0
      ? new Set()
      : new Set(filtered.map(p => p.id))
  )

  const handleUpdateBarcode = async (productId: string, code: string) => {
    await supabase.from('products').update({ code_barre: code }).eq('id', productId)
    const url = await generateQR(code)
    setQrDataURLs(prev => ({ ...prev, [productId]: url }))
    setProducts(prev => prev.map(p => p.id === productId ? { ...p, code_barre: code } : p))
  }

  const handlePrint = () => {
    const sel = filtered.filter(p => selected.has(p.id))
    if (sel.length === 0) { alert('Sélectionnez au moins un produit'); return }
    const labels = sel.map(p => {
      const qrUrl = qrDataURLs[p.id] || ''
      const code = p.code_barre || p.sku
      return `<div style="display:inline-block;border:1px solid #E2E8F0;border-radius:8px;padding:12px;margin:4px;width:160px;text-align:center;vertical-align:top;font-family:sans-serif;">
        ${qrUrl ? `<img src="${qrUrl}" style="width:100px;height:100px;display:block;margin:0 auto;"/>` : ''}
        <p style="font-size:10px;font-weight:bold;margin:4px 0 2px;color:#0F172A;word-break:break-all;">${p.nom.slice(0,24)}</p>
        <p style="font-size:9px;font-family:monospace;color:#64748B;margin:2px 0;">${code}</p>
        <p style="font-size:10px;font-weight:bold;color:#16A34A;margin:2px 0;">${(p.prix_vente||0).toLocaleString()} FCFA</p>
      </div>`
    }).join('')
    const win = window.open('', '_blank')
    if (!win) return
    win.document.write(`<html><head><title>Étiquettes</title><style>@media print{body{margin:0}}</style></head><body style="background:white;padding:16px;"><h2 style="font-family:sans-serif;font-size:14px;margin-bottom:16px;">Étiquettes — ${sel.length} produit(s)</h2>${labels}</body></html>`)
    win.document.close()
    setTimeout(() => { win.print(); win.close() }, 500)
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-[#0F172A] flex items-center gap-2">
            <QrCode size={20} className="text-[#16A34A]" />
            Codes-barres & QR Codes
          </h1>
          <p className="text-xs text-[#64748B] mt-0.5">Génération, impression et gestion des codes produits</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setViewMode(m => m === 'list' ? 'grid' : 'list')}
            className="flex items-center gap-1.5 border border-[#E2E8F0] text-[#374151] px-3 py-2 rounded-xl text-xs font-semibold hover:bg-[#F8FAFC]">
            {viewMode === 'list' ? <Grid3X3 size={13} /> : <List size={13} />}
            {viewMode === 'list' ? 'Grille' : 'Liste'}
          </button>
          <button onClick={() => generateAll(filtered)} disabled={generating}
            className="flex items-center gap-1.5 border border-[#E2E8F0] text-[#374151] px-3 py-2 rounded-xl text-xs font-semibold hover:bg-[#F8FAFC] disabled:opacity-50">
            <RefreshCw size={13} className={generating ? 'animate-spin' : ''} />
            {generating ? 'Génération…' : 'Régénérer QR'}
          </button>
          <button onClick={handlePrint}
            className="flex items-center gap-1.5 bg-[#16A34A] text-white px-4 py-2 rounded-xl text-xs font-semibold hover:bg-[#15803D] shadow-sm">
            <Printer size={13} /> Imprimer ({selected.size})
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Produits actifs', value: products.length, color: '#2563EB', bg: '#EFF6FF' },
          { label: 'Avec code-barres', value: products.filter(p => p.code_barre).length, color: '#16A34A', bg: '#F0FDF4' },
          { label: 'Sans code-barres', value: products.filter(p => !p.code_barre).length, color: '#D97706', bg: '#FFFBEB' },
        ].map(k => (
          <div key={k.label} className="bg-white border border-[#E2E8F0] rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ background: k.bg }}>
                <QrCode size={12} style={{ color: k.color }} />
              </div>
              <span className="text-[11px] text-[#64748B]">{k.label}</span>
            </div>
            <p className="text-xl font-bold text-[#0F172A]">{k.value}</p>
          </div>
        ))}
      </div>

      <div className="bg-white border border-[#E2E8F0] rounded-2xl p-3 flex gap-3 items-center">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher par nom, SKU, code-barres…"
            className="w-full pl-8 pr-3 py-2 text-xs border border-[#E2E8F0] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#16A34A]/20" />
        </div>
        <label className="flex items-center gap-2 text-xs text-[#374151] cursor-pointer whitespace-nowrap">
          <input type="checkbox" checked={selected.size === filtered.length && filtered.length > 0}
            onChange={selectAll} className="w-3.5 h-3.5 accent-[#16A34A]" />
          Tout sélectionner ({filtered.length})
        </label>
      </div>

      {loading ? (
        <div className="bg-white border border-[#E2E8F0] rounded-2xl flex items-center justify-center py-20 text-sm text-[#64748B]">Chargement…</div>
      ) : viewMode === 'list' ? (
        <div className="bg-white border border-[#E2E8F0] rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#F1F5F9] bg-[#F8FAFC]">
                  <th className="px-4 py-3 w-8"></th>
                  <th className="text-left px-4 py-3 text-[11px] font-semibold text-[#64748B]">Produit</th>
                  <th className="text-left px-4 py-3 text-[11px] font-semibold text-[#64748B]">Code-barres / SKU</th>
                  <th className="text-center px-4 py-3 text-[11px] font-semibold text-[#64748B]">QR Code</th>
                  <th className="text-right px-4 py-3 text-[11px] font-semibold text-[#64748B]">Prix vente</th>
                  <th className="text-right px-4 py-3 text-[11px] font-semibold text-[#64748B]">Stock</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={6} className="text-center py-12 text-sm text-[#64748B]">Aucun produit</td></tr>
                ) : filtered.map(p => (
                  <tr key={p.id} className={`border-b border-[#F8FAFC] hover:bg-[#FAFAFA] ${selected.has(p.id) ? 'bg-[#F0FDF4]' : ''}`}>
                    <td className="px-4 py-3">
                      <input type="checkbox" checked={selected.has(p.id)} onChange={() => toggleSelect(p.id)}
                        className="w-3.5 h-3.5 accent-[#16A34A]" />
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-xs font-bold text-[#0F172A]">{p.nom}</p>
                      <p className="text-[10px] text-[#94A3B8]">{p.categorie || 'Sans catégorie'}</p>
                    </td>
                    <td className="px-4 py-3">
                      <InlineBarcodeEditor product={p} onUpdate={handleUpdateBarcode} />
                    </td>
                    <td className="px-4 py-3 text-center">
                      {qrDataURLs[p.id] ? (
                        <img src={qrDataURLs[p.id]} alt="QR" className="w-12 h-12 mx-auto rounded" />
                      ) : (
                        <div className="w-12 h-12 mx-auto bg-[#F1F5F9] rounded flex items-center justify-center">
                          <QrCode size={16} className="text-[#94A3B8]" />
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right text-xs font-bold text-[#0F172A]">
                      {(p.prix_vente||0).toLocaleString()} FCFA
                    </td>
                    <td className="px-4 py-3 text-right text-xs text-[#374151]">
                      {(p.stock_actuel||0).toLocaleString()} {p.unite}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {filtered.map(p => (
            <div key={p.id} onClick={() => toggleSelect(p.id)}
              className={`bg-white border rounded-2xl p-4 cursor-pointer transition-all ${selected.has(p.id) ? 'border-[#16A34A] shadow-sm ring-2 ring-[#16A34A]/20' : 'border-[#E2E8F0] hover:border-[#16A34A]/40'}`}>
              {qrDataURLs[p.id] ? (
                <img src={qrDataURLs[p.id]} alt="QR" className="w-full aspect-square object-contain mb-3 rounded" />
              ) : (
                <div className="w-full aspect-square bg-[#F1F5F9] rounded flex items-center justify-center mb-3">
                  <QrCode size={32} className="text-[#94A3B8]" />
                </div>
              )}
              <p className="text-xs font-bold text-[#0F172A] text-center truncate">{p.nom}</p>
              <p className="text-[10px] font-mono text-[#64748B] text-center truncate">{p.code_barre || p.sku}</p>
              <p className="text-[10px] font-bold text-[#16A34A] text-center mt-1">{(p.prix_vente||0).toLocaleString()} FCFA</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function InlineBarcodeEditor({ product, onUpdate }: { product: Product; onUpdate: (id: string, code: string) => void }) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(product.code_barre || '')

  const save = () => {
    if (value.trim()) onUpdate(product.id, value.trim())
    setEditing(false)
  }

  if (editing) {
    return (
      <div className="flex items-center gap-1">
        <input value={value} onChange={e => setValue(e.target.value)} autoFocus
          onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setEditing(false) }}
          placeholder={product.sku}
          className="w-32 px-2 py-1 text-xs font-mono border border-[#16A34A] rounded focus:outline-none" />
        <button onClick={save} className="text-[#16A34A]"><CheckCircle2 size={14} /></button>
        <button onClick={() => setEditing(false)} className="text-[#94A3B8]"><X size={14} /></button>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2 cursor-pointer group" onClick={() => setEditing(true)}>
      {product.code_barre ? (
        <span className="text-xs font-mono text-[#374151]">{product.code_barre}</span>
      ) : (
        <span className="text-xs font-mono text-[#94A3B8] italic">SKU: {product.sku}</span>
      )}
      <Tag size={11} className="text-[#94A3B8] opacity-0 group-hover:opacity-100 transition-opacity" />
    </div>
  )
}

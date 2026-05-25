'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useTenant } from '@/lib/hooks/useTenant'
import { fmtFCFA } from '@/lib/admin-config'
import { writeComptaEntry } from '@/lib/compta-sync-client'
import {
  TrendingDown, Plus, X, Save, Search,
  Package, Warehouse, Calendar, ChevronDown,
  ChevronRight, AlertTriangle, Users
} from 'lucide-react'

interface Sortie {
  id: string
  tenant_id: string
  numero: string
  type_sortie: string
  warehouse_id: string | null
  destinataire: string | null
  date_sortie: string
  statut: string
  motif: string | null
  notes: string | null
  created_at: string
  warehouse_nom?: string
  nb_lignes?: number
  valeur_total?: number
}

interface SortieItem {
  id: string
  sortie_id: string
  product_id: string
  quantite: number
  prix_unitaire: number
  product_nom?: string
  product_sku?: string
  product_unite?: string
  stock_disponible?: number
}

interface Product { id: string; nom: string; sku: string; prix_vente: number; prix_achat: number; unite: string; stock_actuel: number }
interface Warehouse { id: string; nom: string }

const TYPE_SORTIE: Record<string, { label: string; color: string; bg: string }> = {
  vente:          { label: 'Vente',           color: '#16A34A', bg: '#F0FDF4' },
  consommation:   { label: 'Consommation',    color: '#2563EB', bg: '#EFF6FF' },
  transfert:      { label: 'Transfert',       color: '#D97706', bg: '#FFFBEB' },
  perte:          { label: 'Perte/Casse',     color: '#DC2626', bg: '#FEF2F2' },
  don:            { label: 'Don',             color: '#7C3AED', bg: '#F5F3FF' },
  usage_interne:  { label: 'Usage interne',   color: '#0891B2', bg: '#ECFEFF' },
}

export default function SortiesPage() {
  
  const { tenantId } = useTenant()

  const [sorties, setSorties] = useState<Sortie[]>([])
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [openId, setOpenId] = useState<string | null>(null)
  const [sortieItems, setSortieItems] = useState<SortieItem[]>([])
  const [showCreate, setShowCreate] = useState(false)
  const [saving, setSaving] = useState(false)
  const [createError, setCreateError] = useState('')
  const [stockAlert, setStockAlert] = useState<string | null>(null)

  const [form, setForm] = useState({
    type_sortie: 'vente',
    warehouse_id: '',
    destinataire: '',
    date_sortie: new Date().toISOString().split('T')[0],
    motif: '',
    notes: '',
    lines: [{ product_id: '', quantite: 1, prix_unitaire: 0 }],
  })

  const load = useCallback(async () => {
    if (!tenantId) return
    setLoading(true)
    try {
      const { data: sorts, error: e1 } = await supabase
        .from('stock_sorties')
        .select('*, warehouses(nom)')
        .eq('tenant_id', tenantId)
        .order('date_sortie', { ascending: false })

      if (e1?.code === '42P01') { setSorties([]); setLoading(false); return }

      const { data: wares } = await supabase.from('warehouses').select('id, nom').eq('tenant_id', tenantId).eq('actif', true)
      const { data: prods } = await supabase.from('products').select('id, nom, sku, prix_vente, prix_achat, unite, stock_actuel').eq('tenant_id', tenantId)

      setWarehouses(wares || [])
      setProducts(prods || [])

      setSorties((sorts || []).map((s: any) => ({
        ...s,
        warehouse_nom: s.warehouses?.nom,
      })))
    } catch { setSorties([]) }
    setLoading(false)
  }, [tenantId, supabase])

  useEffect(() => { load() }, [load])

  const loadItems = async (sortieId: string) => {
    const { data } = await supabase
      .from('stock_sortie_items')
      .select('*, products(nom, sku, unite)')
      .eq('sortie_id', sortieId)
    setSortieItems((data || []).map((i: any) => ({
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

  const addLine = () => setForm(f => ({ ...f, lines: [...f.lines, { product_id: '', quantite: 1, prix_unitaire: 0 }] }))
  const removeLine = (i: number) => setForm(f => ({ ...f, lines: f.lines.filter((_, idx) => idx !== i) }))
  const updateLine = (i: number, field: string, val: any) => {
    setForm(f => {
      const lines = [...f.lines]
      lines[i] = { ...lines[i], [field]: val }
      if (field === 'product_id') {
        const prod = products.find(p => p.id === val)
        if (prod) {
          lines[i].prix_unitaire = f.type_sortie === 'vente' ? prod.prix_vente : prod.prix_achat
          // Check stock
          if (prod.stock_actuel < (lines[i].quantite || 1)) {
            setStockAlert(`⚠️ Stock insuffisant pour ${prod.nom}: disponible ${prod.stock_actuel} ${prod.unite}`)
          } else {
            setStockAlert(null)
          }
        }
      }
      if (field === 'quantite') {
        const prod = products.find(p => p.id === lines[i].product_id)
        if (prod && prod.stock_actuel < val) {
          setStockAlert(`⚠️ Stock insuffisant pour ${prod.nom}: disponible ${prod.stock_actuel} ${prod.unite}`)
        } else {
          setStockAlert(null)
        }
      }
      return { ...f, lines }
    })
  }

  const totalValeur = form.lines.reduce((s, l) => s + l.quantite * l.prix_unitaire, 0)

  const handleCreate = async () => {
    if (!tenantId || !form.lines.some(l => l.product_id)) {
      setCreateError('Ajoutez au moins un produit')
      return
    }
    setSaving(true)
    setCreateError('')
    try {
      const numero = `SRT-${new Date().getFullYear()}-${String(sorties.length + 1).padStart(4, '0')}`

      const { data: sortie, error: e } = await supabase
        .from('stock_sorties')
        .insert({
          tenant_id: tenantId,
          numero,
          type_sortie: form.type_sortie,
          warehouse_id: form.warehouse_id || null,
          destinataire: form.destinataire.trim() || null,
          date_sortie: form.date_sortie,
          statut: 'validé',
          motif: form.motif.trim() || null,
          notes: form.notes.trim() || null,
        })
        .select().single()
      if (e) throw e

      const validLines = form.lines.filter(l => l.product_id && l.quantite > 0)

      // Insert items + update stocks
      await supabase.from('stock_sortie_items').insert(
        validLines.map(l => ({
          sortie_id: sortie.id,
          product_id: l.product_id,
          quantite: l.quantite,
          prix_unitaire: l.prix_unitaire,
          total: l.quantite * l.prix_unitaire,
        }))
      )

      for (const l of validLines) {
        const { data: prod } = await supabase.from('products').select('stock_actuel').eq('id', l.product_id).single()
        if (prod) {
          await supabase.from('products').update({ stock_actuel: Math.max(0, (prod.stock_actuel || 0) - l.quantite) }).eq('id', l.product_id)
        }
        await supabase.from('stock_movements').insert({
          tenant_id: tenantId,
          product_id: l.product_id,
          warehouse_id: form.warehouse_id || null,
          type: 'sortie',
          quantity: l.quantite,
          unit_cost: l.prix_unitaire,
          reference: numero,
          notes: `Sortie ${form.type_sortie}: ${numero}`,
        })
      }

      // OHADA entry
      const today = form.date_sortie
      if (totalValeur > 0) {
        if (form.type_sortie === 'vente') {
          await writeComptaEntry({
            tenantId,
            date: today,
            libelle: `Sortie stock vente ${numero} — ${form.destinataire || 'Client'}`,
            type: 'recette',
            montant: totalValeur,
            categorie: 'ventes',
            debitAccount: '411000',
            creditAccount: '700000',
            source: 'sorties',
            sourceId: sortie.id,
          })
        } else if (['perte', 'don'].includes(form.type_sortie)) {
          await writeComptaEntry({
            tenantId,
            date: today,
            libelle: `Sortie stock ${form.type_sortie} ${numero}`,
            type: 'depense',
            montant: totalValeur,
            categorie: 'ajustement_stock',
            debitAccount: '651000',
            creditAccount: '310000',
            source: 'sorties',
            sourceId: sortie.id,
          })
        }
      }

      setShowCreate(false)
      setForm({ type_sortie: 'vente', warehouse_id: '', destinataire: '', date_sortie: new Date().toISOString().split('T')[0], motif: '', notes: '', lines: [{ product_id: '', quantite: 1, prix_unitaire: 0 }] })
      setStockAlert(null)
      await load()
    } catch (e: any) { setCreateError(e.message || 'Erreur') }
    setSaving(false)
  }

  const filtered = sorties.filter(s =>
    s.numero.toLowerCase().includes(search.toLowerCase()) ||
    (s.destinataire || '').toLowerCase().includes(search.toLowerCase()) ||
    (s.type_sortie || '').toLowerCase().includes(search.toLowerCase())
  )

  const totalMois = sorties
    .filter(s => s.date_sortie >= new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0])
    .reduce((s, st) => s + (st.valeur_total || 0), 0)

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-[#0F172A] flex items-center gap-2">
            <TrendingDown size={20} className="text-[#16A34A]" />
            Sorties de Stock
          </h1>
          <p className="text-xs text-[#64748B] mt-0.5">Ventes, pertes, dons, usages internes avec écriture OHADA</p>
        </div>
        <button onClick={() => setShowCreate(true)}
          className="flex items-center gap-1.5 bg-[#16A34A] text-white px-4 py-2 rounded-xl text-xs font-semibold hover:bg-[#15803D] transition-colors">
          <Plus size={14} /> Nouvelle sortie
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Total sorties', value: sorties.length, icon: TrendingDown, color: '#DC2626', bg: '#FEF2F2' },
          { label: 'Ventes', value: sorties.filter(s => s.type_sortie === 'vente').length, icon: Package, color: '#16A34A', bg: '#F0FDF4' },
          { label: 'Pertes', value: sorties.filter(s => s.type_sortie === 'perte').length, icon: AlertTriangle, color: '#D97706', bg: '#FFFBEB' },
          { label: 'Ce mois', value: sorties.filter(s => s.date_sortie >= new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]).length, icon: Calendar, color: '#2563EB', bg: '#EFF6FF' },
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

      {/* Search */}
      <div className="bg-white border border-[#E2E8F0] rounded-2xl p-3">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher une sortie…"
            className="w-full pl-8 pr-3 py-2 text-xs border border-[#E2E8F0] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#16A34A]/20" />
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center py-20 text-sm text-[#64748B]">Chargement…</div>
      ) : (
        <div className="space-y-3">
          {filtered.length === 0 ? (
            <div className="bg-white border border-[#E2E8F0] rounded-2xl p-12 text-center">
              <TrendingDown size={40} className="mx-auto text-[#CBD5E1] mb-3" />
              <p className="text-sm font-semibold text-[#0F172A]">Aucune sortie enregistrée</p>
              <button onClick={() => setShowCreate(true)}
                className="mt-4 bg-[#16A34A] text-white px-4 py-2 rounded-xl text-xs font-semibold hover:bg-[#15803D] transition-colors">
                Enregistrer une sortie
              </button>
            </div>
          ) : filtered.map(s => {
            const cfg = TYPE_SORTIE[s.type_sortie] || TYPE_SORTIE.vente
            const isOpen = openId === s.id
            return (
              <div key={s.id} className="bg-white border border-[#E2E8F0] rounded-2xl overflow-hidden">
                <div className="flex items-center gap-3 p-4">
                  <button onClick={() => toggleOpen(s.id)} className="text-[#94A3B8] hover:text-[#0F172A]">
                    {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                  </button>
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0" style={{ background: cfg.bg }}>
                    <TrendingDown size={14} style={{ color: cfg.color }} />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-bold text-[#0F172A]">{s.numero}</p>
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                        style={{ color: cfg.color, background: cfg.bg }}>
                        {cfg.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-0.5">
                      {s.destinataire && (
                        <span className="flex items-center gap-1 text-[11px] text-[#64748B]">
                          <Users size={11} /> {s.destinataire}
                        </span>
                      )}
                      {s.warehouse_nom && (
                        <span className="flex items-center gap-1 text-[11px] text-[#64748B]">
                          <Warehouse size={11} /> {s.warehouse_nom}
                        </span>
                      )}
                      <span className="flex items-center gap-1 text-[11px] text-[#94A3B8]">
                        <Calendar size={11} /> {new Date(s.date_sortie).toLocaleDateString('fr-FR')}
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-[#94A3B8]">✓ OHADA</span>
                  </div>
                </div>

                {isOpen && (
                  <div className="border-t border-[#F1F5F9]">
                    {(s.motif || s.notes) && (
                      <div className="px-4 py-2 bg-[#F8FAFC] text-[11px] text-[#64748B]">
                        {s.motif && <p>Motif: {s.motif}</p>}
                        {s.notes && <p>📝 {s.notes}</p>}
                      </div>
                    )}
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="bg-[#F8FAFC]">
                            <th className="text-left px-4 py-2.5 text-[10px] font-semibold text-[#64748B]">Produit</th>
                            <th className="text-right px-4 py-2.5 text-[10px] font-semibold text-[#64748B]">Quantité</th>
                            <th className="text-right px-4 py-2.5 text-[10px] font-semibold text-[#64748B]">Prix unit.</th>
                            <th className="text-right px-4 py-2.5 text-[10px] font-semibold text-[#64748B]">Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {sortieItems.map(item => (
                            <tr key={item.id} className="border-t border-[#F8FAFC]">
                              <td className="px-4 py-2.5">
                                <p className="text-xs font-semibold text-[#0F172A]">{item.product_nom}</p>
                                <span className="text-[10px] font-mono text-[#94A3B8]">{item.product_sku}</span>
                              </td>
                              <td className="px-4 py-2.5 text-right text-xs text-[#64748B]">
                                -{item.quantite} {item.product_unite}
                              </td>
                              <td className="px-4 py-2.5 text-right text-xs text-[#64748B]">{fmtFCFA(item.prix_unitaire)}</td>
                              <td className="px-4 py-2.5 text-right text-xs font-bold text-[#DC2626]">
                                {fmtFCFA(item.quantite * item.prix_unitaire)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Create Modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-[#E2E8F0]">
              <h2 className="text-sm font-bold text-[#0F172A]">Nouvelle sortie de stock</h2>
              <button onClick={() => setShowCreate(false)}><X size={16} className="text-[#94A3B8]" /></button>
            </div>
            <div className="p-5 space-y-4">
              {createError && <div className="bg-[#FEF2F2] border border-[#FCA5A5] text-[#DC2626] text-xs p-3 rounded-xl">{createError}</div>}
              {stockAlert && <div className="bg-[#FFFBEB] border border-[#FCD34D] text-[#92400E] text-xs p-3 rounded-xl">{stockAlert}</div>}

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-[#374151] mb-1">Type de sortie</label>
                  <select value={form.type_sortie}
                    onChange={e => setForm(f => ({ ...f, type_sortie: e.target.value }))}
                    className="w-full px-3 py-2 text-xs border border-[#E2E8F0] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#16A34A]/20">
                    {Object.entries(TYPE_SORTIE).map(([k, v]) => (
                      <option key={k} value={k}>{v.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-[#374151] mb-1">Entrepôt source</label>
                  <select value={form.warehouse_id} onChange={e => setForm(f => ({ ...f, warehouse_id: e.target.value }))}
                    className="w-full px-3 py-2 text-xs border border-[#E2E8F0] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#16A34A]/20">
                    <option value="">Par défaut</option>
                    {warehouses.map(w => <option key={w.id} value={w.id}>{w.nom}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-[#374151] mb-1">Date sortie</label>
                  <input type="date" value={form.date_sortie} onChange={e => setForm(f => ({ ...f, date_sortie: e.target.value }))}
                    className="w-full px-3 py-2 text-xs border border-[#E2E8F0] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#16A34A]/20" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-[#374151] mb-1">Destinataire</label>
                  <input value={form.destinataire} onChange={e => setForm(f => ({ ...f, destinataire: e.target.value }))}
                    placeholder="Client, département…"
                    className="w-full px-3 py-2 text-xs border border-[#E2E8F0] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#16A34A]/20" />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-[#374151] mb-1">Motif</label>
                  <input value={form.motif} onChange={e => setForm(f => ({ ...f, motif: e.target.value }))}
                    placeholder="Motif de la sortie…"
                    className="w-full px-3 py-2 text-xs border border-[#E2E8F0] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#16A34A]/20" />
                </div>
              </div>

              {/* Lines */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-[11px] font-semibold text-[#374151]">Articles à sortir</label>
                  <button onClick={addLine}
                    className="flex items-center gap-1 text-[11px] text-[#16A34A] hover:bg-[#F0FDF4] px-2 py-1 rounded-lg font-semibold">
                    <Plus size={12} /> Ajouter ligne
                  </button>
                </div>
                <div className="border border-[#E2E8F0] rounded-xl overflow-hidden">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-[#F8FAFC]">
                        <th className="text-left px-3 py-2 text-[10px] font-semibold text-[#64748B]">Produit</th>
                        <th className="text-right px-3 py-2 text-[10px] font-semibold text-[#64748B]">Stock dispo</th>
                        <th className="text-right px-3 py-2 text-[10px] font-semibold text-[#64748B]">Qté</th>
                        <th className="text-right px-3 py-2 text-[10px] font-semibold text-[#64748B]">Prix</th>
                        <th className="text-right px-3 py-2 text-[10px] font-semibold text-[#64748B]">Total</th>
                        <th className="w-8" />
                      </tr>
                    </thead>
                    <tbody>
                      {form.lines.map((line, i) => {
                        const prod = products.find(p => p.id === line.product_id)
                        const insufficient = prod && line.quantite > prod.stock_actuel
                        return (
                          <tr key={i} className={`border-t border-[#F8FAFC] ${insufficient ? 'bg-[#FFF7F7]' : ''}`}>
                            <td className="px-3 py-2">
                              <select value={line.product_id} onChange={e => updateLine(i, 'product_id', e.target.value)}
                                className="w-full px-2 py-1 text-xs border border-[#E2E8F0] rounded-lg focus:outline-none">
                                <option value="">Sélectionner…</option>
                                {products.map(p => <option key={p.id} value={p.id}>{p.nom} ({p.sku})</option>)}
                              </select>
                            </td>
                            <td className="px-3 py-2 text-right">
                              {prod && (
                                <span className={`text-xs font-semibold ${prod.stock_actuel <= 0 ? 'text-[#DC2626]' : 'text-[#16A34A]'}`}>
                                  {prod.stock_actuel} {prod.unite}
                                </span>
                              )}
                            </td>
                            <td className="px-3 py-2">
                              <input type="number" min={1} value={line.quantite}
                                onChange={e => updateLine(i, 'quantite', Number(e.target.value))}
                                className={`w-20 text-right px-2 py-1 text-xs border rounded-lg focus:outline-none ${insufficient ? 'border-[#DC2626]' : 'border-[#E2E8F0]'}`} />
                            </td>
                            <td className="px-3 py-2">
                              <input type="number" min={0} value={line.prix_unitaire}
                                onChange={e => updateLine(i, 'prix_unitaire', Number(e.target.value))}
                                className="w-28 text-right px-2 py-1 text-xs border border-[#E2E8F0] rounded-lg focus:outline-none" />
                            </td>
                            <td className="px-3 py-2 text-right text-xs font-bold text-[#DC2626]">
                              -{fmtFCFA(line.quantite * line.prix_unitaire)}
                            </td>
                            <td className="px-3 py-2">
                              {form.lines.length > 1 && (
                                <button onClick={() => removeLine(i)} className="text-[#DC2626] p-0.5 rounded hover:bg-[#FEF2F2]">
                                  <X size={12} />
                                </button>
                              )}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="border-t border-[#E2E8F0] bg-[#F8FAFC]">
                        <td colSpan={4} className="px-3 py-2 text-xs font-bold text-right text-[#374151]">Total sortie</td>
                        <td className="px-3 py-2 text-right text-sm font-bold text-[#DC2626]">{fmtFCFA(totalValeur)}</td>
                        <td />
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-[#374151] mb-1">Notes</label>
                <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  rows={2} className="w-full px-3 py-2 text-xs border border-[#E2E8F0] rounded-xl focus:outline-none resize-none focus:ring-2 focus:ring-[#16A34A]/20" />
              </div>
            </div>
            <div className="flex gap-2 p-5 border-t border-[#E2E8F0]">
              <button onClick={() => setShowCreate(false)}
                className="flex-1 px-4 py-2 border border-[#E2E8F0] text-[#374151] text-xs font-semibold rounded-xl hover:bg-[#F8FAFC]">
                Annuler
              </button>
              <button onClick={handleCreate} disabled={saving}
                className="flex-1 flex items-center justify-center gap-1.5 bg-[#16A34A] text-white px-4 py-2 rounded-xl text-xs font-semibold hover:bg-[#15803D] disabled:opacity-50">
                <Save size={13} />
                {saving ? 'Enregistrement…' : 'Valider la sortie'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

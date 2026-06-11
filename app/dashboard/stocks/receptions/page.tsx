'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useTenant } from '@/lib/hooks/useTenant'
import { useLocale } from '@/lib/hooks/useLocale'
import { useFmt } from '@/lib/hooks/useFmt'
import { writeComptaEntry } from '@/lib/compta-sync-client'
import {
  Truck, Plus, X, Save, Search, CheckCircle2,
  Package, Warehouse, Calendar, Building2,
  ChevronDown, ChevronRight, AlertTriangle, Hash
} from 'lucide-react'

interface Reception {
  id: string
  tenant_id: string
  numero: string
  purchase_order_id: string | null
  supplier_id: string | null
  warehouse_id: string | null
  date_reception: string
  statut: string
  notes: string | null
  created_at: string
  supplier_nom?: string
  warehouse_nom?: string
  order_numero?: string
  nb_lignes?: number
  valeur_total?: number
}

interface ReceptionItem {
  id: string
  reception_id: string
  product_id: string
  quantite_attendue: number
  quantite_recue: number
  prix_unitaire: number
  conformite: string
  product_nom?: string
  product_sku?: string
  product_unite?: string
}

interface Product { id: string; nom: string; sku: string; prix_achat: number; unite: string }
interface Supplier { id: string; nom: string }
interface Warehouse { id: string; nom: string }
interface PurchaseOrder { id: string; numero: string; supplier_id: string | null }

const CONFORMITE_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  conforme:       { label: 'Conforme',       color: '#16A34A', bg: '#F0FDF4' },
  non_conforme:   { label: 'Non conforme',   color: '#DC2626', bg: '#FEF2F2' },
  partiel:        { label: 'Partiel',        color: '#D97706', bg: '#FFFBEB' },
}

export default function ReceptionsPage() {
  const { fmt: fmtFCFA } = useFmt()

  const { tenantId } = useTenant()
  const { t, locale } = useLocale()

  const [receptions, setReceptions] = useState<Reception[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [openId, setOpenId] = useState<string | null>(null)
  const [recItems, setRecItems] = useState<ReceptionItem[]>([])
  const [showCreate, setShowCreate] = useState(false)
  const [saving, setSaving] = useState(false)
  const [createError, setCreateError] = useState('')

  const [form, setForm] = useState({
    purchase_order_id: '',
    supplier_id: '',
    warehouse_id: '',
    date_reception: new Date().toISOString().split('T')[0],
    notes: '',
    lines: [{ product_id: '', quantite_attendue: 1, quantite_recue: 1, prix_unitaire: 0, conformite: 'conforme' }],
  })

  const load = useCallback(async () => {
    if (!tenantId) return
    setLoading(true)
    try {
      const { data: recs, error: e1 } = await supabase
        .from('stock_receptions')
        .select('*, suppliers(nom), warehouses(nom), purchase_orders(numero)')
        .eq('tenant_id', tenantId)
        .order('date_reception', { ascending: false })
        .limit(200)

      if (e1?.code === '42P01') { setReceptions([]); setLoading(false); return }

      const { data: sups } = await supabase.from('suppliers').select('id, nom').eq('tenant_id', tenantId).eq('actif', true).limit(200)
      const { data: wares } = await supabase.from('warehouses').select('id, nom').eq('tenant_id', tenantId).eq('actif', true).limit(200)
      const { data: orders } = await supabase.from('purchase_orders').select('id, numero, supplier_id').eq('tenant_id', tenantId).eq('statut', 'confirmé').limit(200)
      const { data: prods } = await supabase.from('products').select('id, nom, sku, prix_achat, unite').eq('tenant_id', tenantId).limit(200)

      setSuppliers(sups || [])
      setWarehouses(wares || [])
      setPurchaseOrders(orders || [])
      setProducts(prods || [])

      const list = (recs || []).map((r: any) => ({
        ...r,
        supplier_nom: r.suppliers?.nom,
        warehouse_nom: r.warehouses?.nom,
        order_numero: r.purchase_orders?.numero,
      }))
      setReceptions(list)
    } catch { setReceptions([]) }
    setLoading(false)
  }, [tenantId, supabase])

  useEffect(() => { load() }, [load])

  const loadItems = async (recId: string) => {
    const { data } = await supabase
      .from('stock_reception_items')
      .select('*, products(nom, sku, unite)')
      .eq('reception_id', recId)
    setRecItems((data || []).map((i: any) => ({
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

  const addLine = () => setForm(f => ({ ...f, lines: [...f.lines, { product_id: '', quantite_attendue: 1, quantite_recue: 1, prix_unitaire: 0, conformite: 'conforme' }] }))
  const removeLine = (i: number) => setForm(f => ({ ...f, lines: f.lines.filter((_, idx) => idx !== i) }))
  const updateLine = (i: number, field: string, val: any) => {
    setForm(f => {
      const lines = [...f.lines]
      lines[i] = { ...lines[i], [field]: val }
      if (field === 'product_id') {
        const prod = products.find(p => p.id === val)
        if (prod) lines[i].prix_unitaire = prod.prix_achat
      }
      return { ...f, lines }
    })
  }

  const totalValeur = form.lines.reduce((s, l) => s + l.quantite_recue * l.prix_unitaire, 0)

  const handleCreate = async () => {
    if (!tenantId || !form.lines.some(l => l.product_id)) {
      setCreateError('Ajoutez au moins un produit')
      return
    }
    setSaving(true)
    setCreateError('')
    try {
      const numero = `REC-${new Date().getFullYear()}-${String(receptions.length + 1).padStart(4, '0')}`

      const { data: rec, error: e } = await supabase
        .from('stock_receptions')
        .insert({
          tenant_id: tenantId,
          numero,
          purchase_order_id: form.purchase_order_id || null,
          supplier_id: form.supplier_id || null,
          warehouse_id: form.warehouse_id || null,
          date_reception: form.date_reception,
          statut: 'validé',
          notes: form.notes.trim() || null,
        })
        .select().single()
      if (e) throw e

      const validLines = form.lines.filter(l => l.product_id)

      // Insert reception items
      await supabase.from('stock_reception_items').insert(
        validLines.map(l => ({
          reception_id: rec.id,
          product_id: l.product_id,
          quantite_attendue: l.quantite_attendue,
          quantite_recue: l.quantite_recue,
          prix_unitaire: l.prix_unitaire,
          conformite: l.conformite,
        }))
      )

      // Update stocks + movements
      for (const l of validLines) {
        if (l.quantite_recue <= 0) continue
        const { data: prod } = await supabase.from('products').select('stock_actuel').eq('id', l.product_id).single()
        if (prod) {
          await supabase.from('products').update({ stock_actuel: (prod.stock_actuel || 0) + l.quantite_recue }).eq('id', l.product_id)
        }
        await supabase.from('stock_movements').insert({
          tenant_id: tenantId,
          product_id: l.product_id,
          warehouse_id: form.warehouse_id || null,
          type: 'reception',
          quantity: l.quantite_recue,
          unit_cost: l.prix_unitaire,
          reference: numero,
          notes: `Réception ${numero}`,
        })
      }

      // OHADA entry: Entrée stock → débit 310000, crédit 401000
      const today = form.date_reception
      const totalAmt = validLines.reduce((s, l) => s + l.quantite_recue * l.prix_unitaire, 0)
      if (totalAmt > 0) {
        await writeComptaEntry({
          tenantId,
          date: today,
          libelle: `Réception marchandises ${numero}`,
          type: 'depense',
          montant: totalAmt,
          categorie: 'achats',
          debitAccount: '311',
          creditAccount: '401',
          source: 'reception',
          sourceId: rec.id,
        })
      }

      setShowCreate(false)
      setForm({ purchase_order_id: '', supplier_id: '', warehouse_id: '', date_reception: new Date().toISOString().split('T')[0], notes: '', lines: [{ product_id: '', quantite_attendue: 1, quantite_recue: 1, prix_unitaire: 0, conformite: 'conforme' }] })
      await load()
    } catch (e: any) { setCreateError(e.message || 'Erreur') }
    setSaving(false)
  }

  const filtered = receptions.filter(r =>
    r.numero.toLowerCase().includes(search.toLowerCase()) ||
    (r.supplier_nom || '').toLowerCase().includes(search.toLowerCase()) ||
    (r.order_numero || '').toLowerCase().includes(search.toLowerCase())
  )

  const totalValeurGlobal = receptions.length

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-[#0F172A] flex items-center gap-2">
            <Truck size={20} className="text-[#16A34A]" />
            {t('stock.receptions.title')}
          </h1>
          <p className="text-xs text-[#64748B] mt-0.5">{t('stock.receptions.subtitle')}</p>
        </div>
        <button onClick={() => setShowCreate(true)}
          className="flex items-center gap-1.5 bg-[#16A34A] text-white px-4 py-2 rounded-xl text-xs font-semibold hover:bg-[#15803D] transition-colors">
          <Plus size={14} /> {t('stock.receptions.newReception')}
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: t('stock.receptions.kpi.total'), value: receptions.length, icon: Truck, color: '#16A34A', bg: '#F0FDF4' },
          { label: t('stock.receptions.kpi.valeur'), value: fmtFCFA(receptions.reduce((s, r) => s + (r.valeur_total || 0), 0)), icon: Calendar, color: '#2563EB', bg: '#EFF6FF' },
          { label: t('stock.receptions.kpi.fournisseurs'), value: new Set(receptions.map(r => r.supplier_id).filter(Boolean)).size, icon: AlertTriangle, color: '#DC2626', bg: '#FEF2F2' },
          { label: 'Entrepôts actifs', value: warehouses.length, icon: Warehouse, color: '#D97706', bg: '#FFFBEB' },
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
            placeholder={t('stock.receptions.noReceptions')}
            className="w-full pl-8 pr-3 py-2 text-xs border border-[#E2E8F0] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#16A34A]/20" />
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center py-20 text-sm text-[#64748B]">{t('common.loading')}</div>
      ) : (
        <div className="space-y-3">
          {filtered.length === 0 ? (
            <div className="bg-white border border-[#E2E8F0] rounded-2xl p-12 text-center">
              <Truck size={40} className="mx-auto text-[#CBD5E1] mb-3" />
              <p className="text-sm font-semibold text-[#0F172A]">{t('stock.receptions.noReceptions')}</p>
              <button onClick={() => setShowCreate(true)}
                className="mt-4 bg-[#16A34A] text-white px-4 py-2 rounded-xl text-xs font-semibold hover:bg-[#15803D] transition-colors">
                {t('stock.receptions.newReception')}
              </button>
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
                      <p className="text-sm font-bold text-[#0F172A]">{rec.numero}</p>
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#F0FDF4] text-[#16A34A]">
                        Validé
                      </span>
                      {rec.order_numero && (
                        <span className="text-[10px] text-[#94A3B8]">BC: {rec.order_numero}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-0.5">
                      {rec.supplier_nom && (
                        <span className="flex items-center gap-1 text-[11px] text-[#64748B]">
                          <Building2 size={11} /> {rec.supplier_nom}
                        </span>
                      )}
                      {rec.warehouse_nom && (
                        <span className="flex items-center gap-1 text-[11px] text-[#64748B]">
                          <Warehouse size={11} /> {rec.warehouse_nom}
                        </span>
                      )}
                      <span className="flex items-center gap-1 text-[11px] text-[#94A3B8]">
                        <Calendar size={11} /> {new Date(rec.date_reception).toLocaleDateString(locale)}
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] font-mono text-[#94A3B8]">✓ OHADA</span>
                  </div>
                </div>

                {isOpen && (
                  <div className="border-t border-[#F1F5F9]">
                    {rec.notes && (
                      <div className="px-4 py-2 bg-[#F8FAFC] text-[11px] text-[#64748B]">📝 {rec.notes}</div>
                    )}
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="bg-[#F8FAFC]">
                            <th className="text-left px-4 py-2.5 text-[10px] font-semibold text-[#64748B]">Produit</th>
                            <th className="text-right px-4 py-2.5 text-[10px] font-semibold text-[#64748B]">Qté attendue</th>
                            <th className="text-right px-4 py-2.5 text-[10px] font-semibold text-[#64748B]">Qté reçue</th>
                            <th className="text-right px-4 py-2.5 text-[10px] font-semibold text-[#64748B]">Prix unit.</th>
                            <th className="text-center px-4 py-2.5 text-[10px] font-semibold text-[#64748B]">Conformité</th>
                          </tr>
                        </thead>
                        <tbody>
                          {recItems.map(item => {
                            const conf = CONFORMITE_CONFIG[item.conformite] || CONFORMITE_CONFIG.conforme
                            return (
                              <tr key={item.id} className="border-t border-[#F8FAFC]">
                                <td className="px-4 py-2.5">
                                  <p className="text-xs font-semibold text-[#0F172A]">{item.product_nom}</p>
                                  <span className="text-[10px] font-mono text-[#94A3B8]">{item.product_sku}</span>
                                </td>
                                <td className="px-4 py-2.5 text-right text-xs text-[#64748B]">
                                  {item.quantite_attendue} {item.product_unite}
                                </td>
                                <td className="px-4 py-2.5 text-right text-xs font-bold text-[#0F172A]">
                                  {item.quantite_recue} {item.product_unite}
                                </td>
                                <td className="px-4 py-2.5 text-right text-xs text-[#64748B]">{fmtFCFA(item.prix_unitaire)}</td>
                                <td className="px-4 py-2.5 text-center">
                                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                                    style={{ color: conf.color, background: conf.bg }}>
                                    {conf.label}
                                  </span>
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
            )
          })}
        </div>
      )}

      {/* Create Modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-[#E2E8F0]">
              <h2 className="text-sm font-bold text-[#0F172A]">{t('stock.receptions.newReception')}</h2>
              <button onClick={() => setShowCreate(false)}><X size={16} className="text-[#94A3B8]" /></button>
            </div>
            <div className="p-5 space-y-4">
              {createError && <div className="bg-[#FEF2F2] border border-[#FCA5A5] text-[#DC2626] text-xs p-3 rounded-xl">{createError}</div>}

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-[#374151] mb-1">Bon de commande</label>
                  <select value={form.purchase_order_id}
                    onChange={e => {
                      const ord = purchaseOrders.find(o => o.id === e.target.value)
                      setForm(f => ({ ...f, purchase_order_id: e.target.value, supplier_id: ord?.supplier_id || f.supplier_id }))
                    }}
                    className="w-full px-3 py-2 text-xs border border-[#E2E8F0] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#16A34A]/20">
                    <option value="">Sans BC</option>
                    {purchaseOrders.map(o => <option key={o.id} value={o.id}>{o.numero}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-[#374151] mb-1">Fournisseur</label>
                  <select value={form.supplier_id} onChange={e => setForm(f => ({ ...f, supplier_id: e.target.value }))}
                    className="w-full px-3 py-2 text-xs border border-[#E2E8F0] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#16A34A]/20">
                    <option value="">Sans fournisseur</option>
                    {suppliers.map(s => <option key={s.id} value={s.id}>{s.nom}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-[#374151] mb-1">Entrepôt destination</label>
                  <select value={form.warehouse_id} onChange={e => setForm(f => ({ ...f, warehouse_id: e.target.value }))}
                    className="w-full px-3 py-2 text-xs border border-[#E2E8F0] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#16A34A]/20">
                    <option value="">Entrepôt par défaut</option>
                    {warehouses.map(w => <option key={w.id} value={w.id}>{w.nom}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-[#374151] mb-1">Date de réception</label>
                <input type="date" value={form.date_reception} onChange={e => setForm(f => ({ ...f, date_reception: e.target.value }))}
                  className="w-48 px-3 py-2 text-xs border border-[#E2E8F0] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#16A34A]/20" />
              </div>

              {/* Lines */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-[11px] font-semibold text-[#374151]">Articles reçus</label>
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
                        <th className="text-right px-3 py-2 text-[10px] font-semibold text-[#64748B]">Attendu</th>
                        <th className="text-right px-3 py-2 text-[10px] font-semibold text-[#64748B]">Reçu</th>
                        <th className="text-right px-3 py-2 text-[10px] font-semibold text-[#64748B]">Prix</th>
                        <th className="text-center px-3 py-2 text-[10px] font-semibold text-[#64748B]">Conformité</th>
                        <th className="w-8" />
                      </tr>
                    </thead>
                    <tbody>
                      {form.lines.map((line, i) => (
                        <tr key={i} className="border-t border-[#F8FAFC]">
                          <td className="px-3 py-2">
                            <select value={line.product_id} onChange={e => updateLine(i, 'product_id', e.target.value)}
                              className="w-full px-2 py-1 text-xs border border-[#E2E8F0] rounded-lg focus:outline-none">
                              <option value="">Sélectionner…</option>
                              {products.map(p => <option key={p.id} value={p.id}>{p.nom} ({p.sku})</option>)}
                            </select>
                          </td>
                          <td className="px-3 py-2">
                            <input type="number" min={0} value={line.quantite_attendue}
                              onChange={e => updateLine(i, 'quantite_attendue', Number(e.target.value))}
                              className="w-16 text-right px-2 py-1 text-xs border border-[#E2E8F0] rounded-lg focus:outline-none" />
                          </td>
                          <td className="px-3 py-2">
                            <input type="number" min={0} value={line.quantite_recue}
                              onChange={e => updateLine(i, 'quantite_recue', Number(e.target.value))}
                              className="w-16 text-right px-2 py-1 text-xs border border-[#E2E8F0] rounded-lg focus:outline-none" />
                          </td>
                          <td className="px-3 py-2">
                            <input type="number" min={0} value={line.prix_unitaire}
                              onChange={e => updateLine(i, 'prix_unitaire', Number(e.target.value))}
                              className="w-24 text-right px-2 py-1 text-xs border border-[#E2E8F0] rounded-lg focus:outline-none" />
                          </td>
                          <td className="px-3 py-2">
                            <select value={line.conformite} onChange={e => updateLine(i, 'conformite', e.target.value)}
                              className="px-2 py-1 text-xs border border-[#E2E8F0] rounded-lg focus:outline-none">
                              {Object.entries(CONFORMITE_CONFIG).map(([k, v]) => (
                                <option key={k} value={k}>{v.label}</option>
                              ))}
                            </select>
                          </td>
                          <td className="px-3 py-2">
                            {form.lines.length > 1 && (
                              <button onClick={() => removeLine(i)} className="text-[#DC2626] p-0.5 rounded hover:bg-[#FEF2F2]">
                                <X size={12} />
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t border-[#E2E8F0] bg-[#F0FDF4]">
                        <td colSpan={5} className="px-3 py-2 text-xs font-bold text-right text-[#374151]">Valeur totale</td>
                        <td className="px-3 py-2 text-right text-sm font-bold text-[#16A34A]">{fmtFCFA(totalValeur)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              <div className="bg-[#F0FDF4] border border-[#86EFAC] rounded-xl p-3 text-xs text-[#15803D]">
                <strong>✓ OHADA:</strong> La réception créera automatiquement une écriture comptable Débit 310000 / Crédit 401000 et mettra à jour les stocks.
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
                {t('common.cancel')}
              </button>
              <button onClick={handleCreate} disabled={saving}
                className="flex-1 flex items-center justify-center gap-1.5 bg-[#16A34A] text-white px-4 py-2 rounded-xl text-xs font-semibold hover:bg-[#15803D] disabled:opacity-50">
                <Save size={13} />
                {saving ? t('common.loading') : t('common.save')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

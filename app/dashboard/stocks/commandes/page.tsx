'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useTenant } from '@/lib/hooks/useTenant'
import { useLocale } from '@/lib/hooks/useLocale'
import { fmtFCFA } from '@/lib/admin-config'
import {
  FileText, Plus, X, Save, Search, ChevronDown, ChevronRight,
  Building2, Calendar, CheckCircle2, AlertTriangle,
  Package, Truck, Clock, Download, Printer
} from 'lucide-react'

interface PurchaseOrder {
  id: string
  tenant_id: string
  numero: string
  supplier_id: string | null
  date_commande: string
  date_livraison_prevue: string | null
  statut: string
  total_ht: number
  total_ttc: number
  taux_tva: number
  notes: string | null
  created_at: string
  supplier_nom?: string
  nb_lignes?: number
}

interface OrderItem {
  id: string
  order_id: string
  product_id: string
  quantite: number
  prix_unitaire: number
  total: number
  product_nom?: string
  product_sku?: string
  product_unite?: string
}

interface Product { id: string; nom: string; sku: string; prix_achat: number; unite: string }
interface Supplier { id: string; nom: string; conditions_paiement: string | null }

const STATUT_CONFIG: Record<string, { label: string; color: string; bg: string; icon: any }> = {
  brouillon:  { label: 'Brouillon',   color: '#64748B', bg: '#F1F5F9', icon: FileText },
  envoyé:     { label: 'Envoyé',      color: '#D97706', bg: '#FFFBEB', icon: Clock },
  confirmé:   { label: 'Confirmé',    color: '#2563EB', bg: '#EFF6FF', icon: CheckCircle2 },
  reçu:       { label: 'Reçu',        color: '#16A34A', bg: '#F0FDF4', icon: CheckCircle2 },
  annulé:     { label: 'Annulé',      color: '#DC2626', bg: '#FEF2F2', icon: X },
}

const TVA_RATES = [0, 5, 10, 16, 18, 20]

export default function CommandesPage() {

  const { tenantId } = useTenant()
  const { t, locale } = useLocale()

  const [orders, setOrders] = useState<PurchaseOrder[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statutFilter, setStatutFilter] = useState('')
  const [openId, setOpenId] = useState<string | null>(null)
  const [orderItems, setOrderItems] = useState<OrderItem[]>([])
  const [showCreate, setShowCreate] = useState(false)
  const [saving, setSaving] = useState(false)
  const [createError, setCreateError] = useState('')

  const [form, setForm] = useState({
    supplier_id: '',
    date_commande: new Date().toISOString().split('T')[0],
    date_livraison_prevue: '',
    taux_tva: 16,
    notes: '',
    lines: [{ product_id: '', quantite: 1, prix_unitaire: 0 }],
  })

  const load = useCallback(async () => {
    if (!tenantId) return
    setLoading(true)
    try {
      const { data: ords, error: e1 } = await supabase
        .from('purchase_orders')
        .select('*, suppliers(nom)')
        .eq('tenant_id', tenantId)
        .order('date_commande', { ascending: false }).limit(200)

      if (e1?.code === '42P01') { setOrders([]); setLoading(false); return }

      const { data: sups } = await supabase.from('suppliers').select('id, nom, conditions_paiement').eq('tenant_id', tenantId).eq('actif', true).limit(200)
      const { data: prods } = await supabase.from('products').select('id, nom, sku, prix_achat, unite').eq('tenant_id', tenantId).limit(200)

      setSuppliers(sups || [])
      setProducts(prods || [])

      setOrders((ords || []).map((o: any) => ({
        ...o,
        supplier_nom: o.suppliers?.nom,
      })))
    } catch { setOrders([]) }
    setLoading(false)
  }, [tenantId, supabase])

  useEffect(() => { load() }, [load])

  const loadItems = async (orderId: string) => {
    const { data } = await supabase
      .from('purchase_order_items')
      .select('*, products(nom, sku, unite)')
      .eq('order_id', orderId)
    setOrderItems((data || []).map((i: any) => ({
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
        if (prod) lines[i].prix_unitaire = prod.prix_achat
      }
      return { ...f, lines }
    })
  }

  const totalHT = form.lines.reduce((s, l) => s + l.quantite * l.prix_unitaire, 0)
  const totalTTC = totalHT * (1 + form.taux_tva / 100)

  const generateNumero = () => `BC-${new Date().getFullYear()}-${String(orders.length + 1).padStart(4, '0')}`

  const handleCreate = async () => {
    if (!tenantId || !form.lines.some(l => l.product_id)) {
      setCreateError('Ajoutez au moins un produit')
      return
    }
    setSaving(true)
    setCreateError('')
    try {
      const { data: ord, error: e } = await supabase
        .from('purchase_orders')
        .insert({
          tenant_id: tenantId,
          numero: generateNumero(),
          supplier_id: form.supplier_id || null,
          date_commande: form.date_commande,
          date_livraison_prevue: form.date_livraison_prevue || null,
          statut: 'brouillon',
          total_ht: totalHT,
          total_ttc: totalTTC,
          taux_tva: form.taux_tva,
          notes: form.notes.trim() || null,
        })
        .select().single()
      if (e) throw e

      const validLines = form.lines.filter(l => l.product_id)
      await supabase.from('purchase_order_items').insert(
        validLines.map(l => ({
          order_id: ord.id,
          product_id: l.product_id,
          quantite: l.quantite,
          prix_unitaire: l.prix_unitaire,
          total: l.quantite * l.prix_unitaire,
        }))
      )

      setShowCreate(false)
      setForm({ supplier_id: '', date_commande: new Date().toISOString().split('T')[0], date_livraison_prevue: '', taux_tva: 16, notes: '', lines: [{ product_id: '', quantite: 1, prix_unitaire: 0 }] })
      await load()
    } catch (e: any) { setCreateError(e.message || 'Erreur') }
    setSaving(false)
  }

  const changeStatut = async (ord: PurchaseOrder, newStatut: string) => {
    await supabase.from('purchase_orders').update({ statut: newStatut }).eq('id', ord.id).eq('tenant_id', tenantId)
    await load()
    if (openId === ord.id) await loadItems(ord.id)
  }

  const filtered = orders
    .filter(o =>
      o.numero.toLowerCase().includes(search.toLowerCase()) ||
      (o.supplier_nom || '').toLowerCase().includes(search.toLowerCase())
    )
    .filter(o => !statutFilter || o.statut === statutFilter)

  const enAttente = orders.filter(o => ['envoyé', 'confirmé'].includes(o.statut)).length
  const totalMois = orders
    .filter(o => o.date_commande >= new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0])
    .reduce((s, o) => s + o.total_ttc, 0)

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-[#0F172A] flex items-center gap-2">
            <FileText size={20} className="text-[#16A34A]" />
            {t('stock.commandes.title')}
          </h1>
          <p className="text-xs text-[#64748B] mt-0.5">{t('stock.commandes.subtitle')}</p>
        </div>
        <button onClick={() => setShowCreate(true)}
          className="flex items-center gap-1.5 bg-[#16A34A] text-white px-4 py-2 rounded-xl text-xs font-semibold hover:bg-[#15803D] transition-colors">
          <Plus size={14} /> {t('stock.commandes.newOrder')}
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: t('stock.commandes.kpi.total'), value: orders.length, icon: FileText, color: '#16A34A', bg: '#F0FDF4' },
          { label: t('stock.commandes.kpi.pending'), value: enAttente, icon: Clock, color: '#D97706', bg: '#FFFBEB' },
          { label: t('stock.commandes.kpi.valeur'), value: fmtFCFA(totalMois), icon: Package, color: '#2563EB', bg: '#EFF6FF' },
          { label: 'Commandes reçues', value: orders.filter(o => o.statut === 'reçu').length, icon: Truck, color: '#16A34A', bg: '#F0FDF4' },
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

      {/* Filters */}
      <div className="bg-white border border-[#E2E8F0] rounded-2xl p-3 flex gap-3">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Numéro de commande, fournisseur…"
            className="w-full pl-8 pr-3 py-2 text-xs border border-[#E2E8F0] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#16A34A]/20" />
        </div>
        <select value={statutFilter} onChange={e => setStatutFilter(e.target.value)}
          className="px-3 py-2 text-xs border border-[#E2E8F0] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#16A34A]/20">
          <option value="">Tous statuts</option>
          {Object.entries(STATUT_CONFIG).map(([k, v]) => (
            <option key={k} value={k}>{v.label}</option>
          ))}
        </select>
      </div>

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center py-20 text-sm text-[#64748B]">{t('common.loading')}</div>
      ) : (
        <div className="space-y-3">
          {filtered.length === 0 ? (
            <div className="bg-white border border-[#E2E8F0] rounded-2xl p-12 text-center">
              <FileText size={40} className="mx-auto text-[#CBD5E1] mb-3" />
              <p className="text-sm font-semibold text-[#0F172A]">{t('stock.commandes.noOrders')}</p>
              <button onClick={() => setShowCreate(true)}
                className="mt-4 bg-[#16A34A] text-white px-4 py-2 rounded-xl text-xs font-semibold hover:bg-[#15803D] transition-colors">
                {t('stock.commandes.newOrder')}
              </button>
            </div>
          ) : filtered.map(ord => {
            const cfg = STATUT_CONFIG[ord.statut] || STATUT_CONFIG.brouillon
            const StatusIcon = cfg.icon
            const isOpen = openId === ord.id
            const isLate = ord.date_livraison_prevue && ord.statut !== 'reçu' && new Date(ord.date_livraison_prevue) < new Date()

            return (
              <div key={ord.id} className={`bg-white border rounded-2xl overflow-hidden ${isLate ? 'border-[#FCA5A5]' : 'border-[#E2E8F0]'}`}>
                <div className="flex items-center gap-3 p-4">
                  <button onClick={() => toggleOpen(ord.id)} className="text-[#94A3B8] hover:text-[#0F172A]">
                    {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                  </button>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-bold text-[#0F172A]">{ord.numero}</p>
                      <span className="flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full"
                        style={{ color: cfg.color, background: cfg.bg }}>
                        <StatusIcon size={10} />
                        {ord.statut === 'brouillon' ? t('stock.commandes.stat.brouillon')
                          : ord.statut === 'envoyé' ? t('stock.commandes.stat.envoye')
                          : ord.statut === 'reçu' ? t('stock.commandes.stat.recu')
                          : ord.statut === 'annulé' ? t('stock.commandes.stat.annule')
                          : cfg.label}
                      </span>
                      {isLate && (
                        <span className="flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#FEF2F2] text-[#DC2626]">
                          <AlertTriangle size={10} /> En retard
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-0.5">
                      <span className="flex items-center gap-1 text-[11px] text-[#64748B]">
                        <Building2 size={11} /> {ord.supplier_nom || 'Sans fournisseur'}
                      </span>
                      <span className="flex items-center gap-1 text-[11px] text-[#94A3B8]">
                        <Calendar size={11} /> {new Date(ord.date_commande).toLocaleDateString(locale)}
                      </span>
                      {ord.date_livraison_prevue && (
                        <span className={`flex items-center gap-1 text-[11px] ${isLate ? 'text-[#DC2626] font-semibold' : 'text-[#94A3B8]'}`}>
                          <Truck size={11} /> Livraison: {new Date(ord.date_livraison_prevue).toLocaleDateString(locale)}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="text-right">
                    <p className="text-sm font-bold text-[#0F172A]">{fmtFCFA(ord.total_ttc)}</p>
                    <p className="text-[10px] text-[#94A3B8]">HT: {fmtFCFA(ord.total_ht)} (TVA {ord.taux_tva}%)</p>
                  </div>

                  <div className="flex gap-1.5">
                    {ord.statut === 'brouillon' && (
                      <button onClick={() => changeStatut(ord, 'envoyé')}
                        className="px-2.5 py-1.5 bg-[#D97706] text-white rounded-lg text-[11px] font-semibold hover:bg-[#B45309]">
                        Envoyer
                      </button>
                    )}
                    {ord.statut === 'envoyé' && (
                      <button onClick={() => changeStatut(ord, 'confirmé')}
                        className="px-2.5 py-1.5 bg-[#2563EB] text-white rounded-lg text-[11px] font-semibold hover:bg-[#1D4ED8]">
                        Confirmer
                      </button>
                    )}
                    {ord.statut === 'confirmé' && (
                      <button onClick={() => changeStatut(ord, 'reçu')}
                        className="px-2.5 py-1.5 bg-[#16A34A] text-white rounded-lg text-[11px] font-semibold hover:bg-[#15803D]">
                        Marquer reçu
                      </button>
                    )}
                    {!['reçu', 'annulé'].includes(ord.statut) && (
                      <button onClick={() => changeStatut(ord, 'annulé')}
                        className="px-2 py-1.5 border border-[#DC2626] text-[#DC2626] rounded-lg text-[11px] font-semibold hover:bg-[#FEF2F2]">
                        Annuler
                      </button>
                    )}
                  </div>
                </div>

                {isOpen && (
                  <div className="border-t border-[#F1F5F9]">
                    {ord.notes && (
                      <div className="px-4 py-2 bg-[#FFFBEB] text-[11px] text-[#92400E]">📝 {ord.notes}</div>
                    )}
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="bg-[#F8FAFC]">
                            <th className="text-left px-4 py-2.5 text-[10px] font-semibold text-[#64748B]">Produit</th>
                            <th className="text-right px-4 py-2.5 text-[10px] font-semibold text-[#64748B]">Qté</th>
                            <th className="text-right px-4 py-2.5 text-[10px] font-semibold text-[#64748B]">Prix HT</th>
                            <th className="text-right px-4 py-2.5 text-[10px] font-semibold text-[#64748B]">Total HT</th>
                          </tr>
                        </thead>
                        <tbody>
                          {orderItems.map(item => (
                            <tr key={item.id} className="border-t border-[#F8FAFC]">
                              <td className="px-4 py-2.5">
                                <p className="text-xs font-semibold text-[#0F172A]">{item.product_nom}</p>
                                <span className="text-[10px] font-mono text-[#94A3B8]">{item.product_sku}</span>
                              </td>
                              <td className="px-4 py-2.5 text-right text-xs text-[#64748B]">
                                {item.quantite} {item.product_unite}
                              </td>
                              <td className="px-4 py-2.5 text-right text-xs text-[#64748B]">{fmtFCFA(item.prix_unitaire)}</td>
                              <td className="px-4 py-2.5 text-right text-xs font-bold text-[#0F172A]">{fmtFCFA(item.total)}</td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr className="border-t border-[#E2E8F0] bg-[#F8FAFC]">
                            <td colSpan={3} className="px-4 py-2 text-xs font-semibold text-right text-[#374151]">Total HT</td>
                            <td className="px-4 py-2 text-right text-xs font-bold text-[#0F172A]">{fmtFCFA(ord.total_ht)}</td>
                          </tr>
                          <tr className="bg-[#F8FAFC]">
                            <td colSpan={3} className="px-4 py-1.5 text-xs text-right text-[#64748B]">TVA ({ord.taux_tva}%)</td>
                            <td className="px-4 py-1.5 text-right text-xs text-[#64748B]">{fmtFCFA(ord.total_ttc - ord.total_ht)}</td>
                          </tr>
                          <tr className="border-t border-[#E2E8F0] bg-[#F0FDF4]">
                            <td colSpan={3} className="px-4 py-2 text-sm font-bold text-right text-[#374151]">Total TTC</td>
                            <td className="px-4 py-2 text-right text-sm font-bold text-[#16A34A]">{fmtFCFA(ord.total_ttc)}</td>
                          </tr>
                        </tfoot>
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
              <h2 className="text-sm font-bold text-[#0F172A]">{t('stock.commandes.newOrder')}</h2>
              <button onClick={() => setShowCreate(false)}><X size={16} className="text-[#94A3B8]" /></button>
            </div>
            <div className="p-5 space-y-4">
              {createError && <div className="bg-[#FEF2F2] border border-[#FCA5A5] text-[#DC2626] text-xs p-3 rounded-xl">{createError}</div>}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-[#374151] mb-1">Fournisseur</label>
                  <select value={form.supplier_id} onChange={e => setForm(f => ({ ...f, supplier_id: e.target.value }))}
                    className="w-full px-3 py-2 text-xs border border-[#E2E8F0] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#16A34A]/20">
                    <option value="">Sélectionner…</option>
                    {suppliers.map(s => <option key={s.id} value={s.id}>{s.nom}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-[#374151] mb-1">TVA (%)</label>
                  <select value={form.taux_tva} onChange={e => setForm(f => ({ ...f, taux_tva: Number(e.target.value) }))}
                    className="w-full px-3 py-2 text-xs border border-[#E2E8F0] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#16A34A]/20">
                    {TVA_RATES.map(r => <option key={r} value={r}>{r}%</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-[#374151] mb-1">Date commande</label>
                  <input type="date" value={form.date_commande} onChange={e => setForm(f => ({ ...f, date_commande: e.target.value }))}
                    className="w-full px-3 py-2 text-xs border border-[#E2E8F0] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#16A34A]/20" />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-[#374151] mb-1">Livraison prévue</label>
                  <input type="date" value={form.date_livraison_prevue} onChange={e => setForm(f => ({ ...f, date_livraison_prevue: e.target.value }))}
                    className="w-full px-3 py-2 text-xs border border-[#E2E8F0] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#16A34A]/20" />
                </div>
              </div>

              {/* Lines */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-[11px] font-semibold text-[#374151]">Articles commandés</label>
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
                        <th className="text-right px-3 py-2 text-[10px] font-semibold text-[#64748B]">Qté</th>
                        <th className="text-right px-3 py-2 text-[10px] font-semibold text-[#64748B]">Prix HT</th>
                        <th className="text-right px-3 py-2 text-[10px] font-semibold text-[#64748B]">Total HT</th>
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
                            <input type="number" min={1} value={line.quantite}
                              onChange={e => updateLine(i, 'quantite', Number(e.target.value))}
                              className="w-20 text-right px-2 py-1 text-xs border border-[#E2E8F0] rounded-lg focus:outline-none" />
                          </td>
                          <td className="px-3 py-2">
                            <input type="number" min={0} value={line.prix_unitaire}
                              onChange={e => updateLine(i, 'prix_unitaire', Number(e.target.value))}
                              className="w-28 text-right px-2 py-1 text-xs border border-[#E2E8F0] rounded-lg focus:outline-none" />
                          </td>
                          <td className="px-3 py-2 text-right text-xs font-bold text-[#0F172A]">
                            {fmtFCFA(line.quantite * line.prix_unitaire)}
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
                      <tr className="border-t border-[#E2E8F0] bg-[#F8FAFC]">
                        <td colSpan={3} className="px-3 py-2 text-xs font-semibold text-right text-[#374151]">Total HT</td>
                        <td className="px-3 py-2 text-right text-xs font-bold text-[#0F172A]">{fmtFCFA(totalHT)}</td>
                        <td />
                      </tr>
                      <tr className="bg-[#F8FAFC]">
                        <td colSpan={3} className="px-3 py-1.5 text-xs text-right text-[#64748B]">TVA ({form.taux_tva}%)</td>
                        <td className="px-3 py-1.5 text-right text-xs text-[#64748B]">{fmtFCFA(totalTTC - totalHT)}</td>
                        <td />
                      </tr>
                      <tr className="border-t border-[#E2E8F0] bg-[#F0FDF4]">
                        <td colSpan={3} className="px-3 py-2 text-sm font-bold text-right text-[#374151]">Total TTC</td>
                        <td className="px-3 py-2 text-right text-sm font-bold text-[#16A34A]">{fmtFCFA(totalTTC)}</td>
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

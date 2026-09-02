'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useTenant } from '@/lib/hooks/useTenant'
import { useLocale } from '@/lib/hooks/useLocale'
import { useFmt } from '@/lib/hooks/useFmt'
import { writeComptaEntry } from '@/lib/compta-sync-client'
import {
  ShoppingCart, Plus, X, Save, Search,
  CheckCircle2, AlertTriangle,
  Calendar, Building2, TrendingUp,
  ChevronDown, ChevronRight
} from 'lucide-react'

interface Purchase {
  id: string
  tenant_id: string
  supplier_id: string | null
  reference: string | null
  date: string
  statut: string
  montant_total: number
  notes: string | null
  created_at: string
  supplier_nom?: string
  nb_items?: number
}

interface PurchaseItem {
  id: string
  purchase_id: string
  product_id: string
  quantite: number
  prix: number
  product_nom?: string
  product_sku?: string
}

interface Product { id: string; nom: string; sku: string; prix_achat: number; unite: string }
interface Supplier { id: string; nom: string; code: string }

const STATUT_CONFIG: Record<string, { label: string; color: string; bg: string; next?: string; nextLabel?: string }> = {
  brouillon:   { label: 'Brouillon',    color: '#64748B', bg: '#F1F5F9', next: 'commandé', nextLabel: 'Envoyer commande' },
  commandé:    { label: 'Commandé',     color: '#D97706', bg: '#FFFBEB', next: 'reçu', nextLabel: 'Marquer reçu' },
  reçu:        { label: 'Reçu',         color: '#2563EB', bg: '#EFF6FF', next: 'payé', nextLabel: 'Marquer payé' },
  payé:        { label: 'Payé',         color: '#16A34A', bg: '#F0FDF4' },
  annulé:      { label: 'Annulé',       color: '#DC2626', bg: '#FEF2F2' },
}

export default function AchatsPage() {
  const { fmt: fmtFCFA } = useFmt()

  const { tenantId } = useTenant()
  const { t } = useLocale()

  const [purchases, setPurchases] = useState<Purchase[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statutFilter, setStatutFilter] = useState('')
  const [openId, setOpenId] = useState<string | null>(null)
  const [items, setItems] = useState<PurchaseItem[]>([])
  const [showCreate, setShowCreate] = useState(false)
  const [saving, setSaving] = useState(false)

  const [form, setForm] = useState({
    supplier_id: '',
    reference: '',
    date: new Date().toISOString().split('T')[0],
    notes: '',
    lines: [{ product_id: '', quantite: 1, prix: 0 }],
  })
  const [createError, setCreateError] = useState('')

  const load = useCallback(async () => {
    if (!tenantId) return
    setLoading(true)
    try {
      const { data: purch, error: e1 } = await supabase
        .from('purchases')
        .select('*, suppliers(nom)')
        .eq('tenant_id', tenantId)
        .order('date', { ascending: false }).limit(200)

      if (e1?.code === '42P01') { setPurchases([]); setLoading(false); return }

      const { data: sups } = await supabase.from('suppliers').select('id, nom, code').eq('tenant_id', tenantId).eq('actif', true).limit(200)
      const { data: prods } = await supabase.from('products').select('id, nom, sku, prix_achat, unite').eq('tenant_id', tenantId).limit(200)

      setSuppliers(sups || [])
      setProducts(prods || [])

      const list = (purch || []).map((p: Purchase & { suppliers?: { nom: string } | null }) => ({
        ...p,
        supplier_nom: p.suppliers?.nom,
      }))
      setPurchases(list)
    } catch { setPurchases([]) }
    setLoading(false)
  }, [tenantId])

  useEffect(() => { load() }, [load])

  const loadItems = async (purchaseId: string) => {
    const { data } = await supabase
      .from('purchase_items')
      .select('*, products(nom, sku)')
      .eq('purchase_id', purchaseId)
    setItems((data || []).map((i: PurchaseItem & { products?: { nom: string; sku: string } | null }) => ({
      ...i,
      product_nom: i.products?.nom,
      product_sku: i.products?.sku,
    })))
  }

  const toggleOpen = async (id: string) => {
    if (openId === id) { setOpenId(null); return }
    setOpenId(id)
    await loadItems(id)
  }

  const addLine = () => setForm(f => ({ ...f, lines: [...f.lines, { product_id: '', quantite: 1, prix: 0 }] }))
  const removeLine = (i: number) => setForm(f => ({ ...f, lines: f.lines.filter((_, idx) => idx !== i) }))
  const updateLine = (i: number, field: keyof PurchaseItem | string, val: string | number) => {
    setForm(f => {
      const lines = [...f.lines]
      lines[i] = { ...lines[i], [field]: val }
      if (field === 'product_id') {
        const prod = products.find(p => p.id === val)
        if (prod) lines[i].prix = prod.prix_achat
      }
      return { ...f, lines }
    })
  }

  const totalForm = form.lines.reduce((s, l) => s + (l.quantite || 0) * (l.prix || 0), 0)

  const handleCreate = async () => {
    if (!tenantId || !form.lines.some(l => l.product_id)) {
      setCreateError('Ajoutez au moins un produit')
      return
    }
    setSaving(true)
    setCreateError('')
    try {
      const { data: purch, error: e } = await supabase
        .from('purchases')
        .insert({
          tenant_id: tenantId,
          supplier_id: form.supplier_id || null,
          reference: form.reference.trim() || `ACH-${Date.now()}`,
          date: form.date,
          statut: 'brouillon',
          montant_total: totalForm,
          notes: form.notes.trim() || null,
        })
        .select().single()
      if (e) throw e

      const validLines = form.lines.filter(l => l.product_id)
      if (validLines.length > 0) {
        const { error: e2 } = await supabase.from('purchase_items').insert(
          validLines.map(l => ({
            purchase_id: purch.id,
            product_id: l.product_id,
            quantite: l.quantite,
            prix: l.prix,
          }))
        )
        if (e2) throw e2
      }

      setShowCreate(false)
      setForm({ supplier_id: '', reference: '', date: new Date().toISOString().split('T')[0], notes: '', lines: [{ product_id: '', quantite: 1, prix: 0 }] })
      await load()
    } catch (e: any) { setCreateError(e.message || 'Erreur') }
    setSaving(false)
  }

  const changeStatut = async (p: Purchase, newStatut: string) => {
    if (!tenantId) return
    setSaving(true)
    try {
      await supabase.from('purchases').update({ statut: newStatut }).eq('id', p.id).eq('tenant_id', tenantId)

      // On reception: update stocks
      if (newStatut === 'reçu') {
        const { data: pItems } = await supabase.from('purchase_items').select('*').eq('purchase_id', p.id)
        // purchase_items porte quantite et prix (migration 016), pas quantity
        // ni unit_price.
        for (const item of (pItems || [])) {
          const { error: errMvt } = await supabase.rpc('fn_stock_move', {
            p_tenant_id:  tenantId,
            p_product_id: item.product_id,
            p_type:       'reception',
            p_quantite:   item.quantite,
            p_unit_cost:  item.prix,
            p_reference:  p.reference,
            p_notes:      `Reception achat ${p.reference}`,
          })
          if (errMvt) throw errMvt
        }
      }

      // On payment: OHADA entry
      if (newStatut === 'payé') {
        const today = new Date().toISOString().split('T')[0]
        await writeComptaEntry({
          tenantId,
          date: today,
          libelle: `Paiement achat ${p.reference || p.id.slice(0, 8)} — ${p.supplier_nom || 'Fournisseur'}`,
          type: 'depense',
          montant: p.montant_total,
          categorie: 'achats',
          debitAccount: '401',
          creditAccount: '521',
          source: 'achats',
          sourceId: p.id,
        })
      }

      await load()
      if (openId === p.id) await loadItems(p.id)
    } catch (e: any) { alert(e.message) }
    setSaving(false)
  }

  const filtered = purchases.filter(p =>
    (p.reference || '').toLowerCase().includes(search.toLowerCase()) ||
    (p.supplier_nom || '').toLowerCase().includes(search.toLowerCase())
  ).filter(p => !statutFilter || p.statut === statutFilter)

  const totalMois = purchases
    .filter(p => p.date >= new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0])
    .reduce((s, p) => s + (p.montant_total || 0), 0)

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-[#0F172A] flex items-center gap-2">
            <ShoppingCart size={20} className="text-[#16A34A]" />
            {t('stock.achats.title')}
          </h1>
          <p className="text-xs text-[#64748B] mt-0.5">{t('stock.achats.subtitle')}</p>
        </div>
        <button onClick={() => setShowCreate(true)}
          className="flex items-center gap-1.5 bg-[#16A34A] text-white px-4 py-2 rounded-xl text-xs font-semibold hover:bg-[#15803D] transition-colors">
          <Plus size={14} /> {t('stock.achats.newPurchase')}
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: t('stock.achats.kpi.total'), value: purchases.length, icon: ShoppingCart, color: '#16A34A', bg: '#F0FDF4' },
          { label: 'En attente', value: purchases.filter(p => p.statut === 'commandé').length, icon: AlertTriangle, color: '#D97706', bg: '#FFFBEB' },
          { label: t('stock.achats.kpi.valeur'), value: fmtFCFA(totalMois), icon: TrendingUp, color: '#2563EB', bg: '#EFF6FF' },
          { label: 'Payés', value: purchases.filter(p => p.statut === 'payé').length, icon: CheckCircle2, color: '#16A34A', bg: '#F0FDF4' },
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
            placeholder="Rechercher achat, fournisseur, référence…"
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
              <ShoppingCart size={40} className="mx-auto text-[#CBD5E1] mb-3" />
              <p className="text-sm font-semibold text-[#0F172A]">{t('stock.achats.noPurchases')}</p>
              <button onClick={() => setShowCreate(true)}
                className="mt-4 bg-[#16A34A] text-white px-4 py-2 rounded-xl text-xs font-semibold hover:bg-[#15803D] transition-colors">
                Créer un achat
              </button>
            </div>
          ) : filtered.map(p => {
            const cfg = STATUT_CONFIG[p.statut] || STATUT_CONFIG.brouillon
            const isOpen = openId === p.id
            return (
              <div key={p.id} className="bg-white border border-[#E2E8F0] rounded-2xl overflow-hidden">
                <div className="flex items-center gap-3 p-4">
                  <button onClick={() => toggleOpen(p.id)} className="text-[#94A3B8] hover:text-[#0F172A]">
                    {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                  </button>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-bold text-[#0F172A]">{p.reference || p.id.slice(0, 8)}</p>
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                        style={{ color: cfg.color, background: cfg.bg }}>
                        {cfg.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-0.5">
                      <span className="flex items-center gap-1 text-[11px] text-[#64748B]">
                        <Building2 size={11} /> {p.supplier_nom || 'Sans fournisseur'}
                      </span>
                      <span className="flex items-center gap-1 text-[11px] text-[#94A3B8]">
                        <Calendar size={11} /> {new Date(p.date).toLocaleDateString('fr-FR')}
                      </span>
                    </div>
                  </div>

                  <div className="text-right">
                    <p className="text-sm font-bold text-[#0F172A]">{fmtFCFA(p.montant_total)}</p>
                    <p className="text-[10px] text-[#94A3B8]">Total achat</p>
                  </div>

                  {/* Next action */}
                  {cfg.next && (
                    <button onClick={() => changeStatut(p, cfg.next!)} disabled={saving}
                      className="flex items-center gap-1 px-2.5 py-1.5 bg-[#16A34A] text-white rounded-lg text-[11px] font-semibold hover:bg-[#15803D] disabled:opacity-50 whitespace-nowrap">
                      {cfg.nextLabel}
                    </button>
                  )}
                  {p.statut !== 'annulé' && p.statut !== 'payé' && (
                    <button onClick={() => changeStatut(p, 'annulé')} disabled={saving}
                      className="px-2 py-1.5 border border-[#DC2626] text-[#DC2626] rounded-lg text-[11px] font-semibold hover:bg-[#FEF2F2] disabled:opacity-50">
                      Annuler
                    </button>
                  )}
                </div>

                {isOpen && (
                  <div className="border-t border-[#F1F5F9]">
                    {p.notes && (
                      <div className="px-4 py-2 bg-[#F8FAFC] text-[11px] text-[#64748B]">
                        📝 {p.notes}
                      </div>
                    )}
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="bg-[#F8FAFC]">
                            <th className="text-left px-4 py-2.5 text-[10px] font-semibold text-[#64748B]">Produit</th>
                            <th className="text-right px-4 py-2.5 text-[10px] font-semibold text-[#64748B]">Qté</th>
                            <th className="text-right px-4 py-2.5 text-[10px] font-semibold text-[#64748B]">Prix unit.</th>
                            <th className="text-right px-4 py-2.5 text-[10px] font-semibold text-[#64748B]">{t('common.total')}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {items.map(item => (
                            <tr key={item.id} className="border-t border-[#F8FAFC]">
                              <td className="px-4 py-2.5">
                                <p className="text-xs font-semibold text-[#0F172A]">{item.product_nom}</p>
                                <span className="text-[10px] font-mono text-[#94A3B8]">{item.product_sku}</span>
                              </td>
                              <td className="px-4 py-2.5 text-right text-xs text-[#64748B]">{item.quantite}</td>
                              <td className="px-4 py-2.5 text-right text-xs text-[#64748B]">{fmtFCFA(item.prix)}</td>
                              <td className="px-4 py-2.5 text-right text-xs font-bold text-[#0F172A]">{fmtFCFA(item.quantite * item.prix)}</td>
                            </tr>
                          ))}
                          <tr className="border-t border-[#E2E8F0] bg-[#F8FAFC]">
                            <td colSpan={3} className="px-4 py-2.5 text-xs font-bold text-right text-[#374151]">{t('common.total')}</td>
                            <td className="px-4 py-2.5 text-right text-sm font-bold text-[#0F172A]">{fmtFCFA(p.montant_total)}</td>
                          </tr>
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
              <h2 className="text-sm font-bold text-[#0F172A]">Nouvel achat</h2>
              <button onClick={() => setShowCreate(false)}><X size={16} className="text-[#94A3B8]" /></button>
            </div>
            <div className="p-5 space-y-4">
              {createError && <div className="bg-[#FEF2F2] border border-[#FCA5A5] text-[#DC2626] text-xs p-3 rounded-xl">{createError}</div>}

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-[#374151] mb-1">Fournisseur</label>
                  <select value={form.supplier_id} onChange={e => setForm(f => ({ ...f, supplier_id: e.target.value }))}
                    className="w-full px-3 py-2 text-xs border border-[#E2E8F0] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#16A34A]/20">
                    <option value="">Sans fournisseur</option>
                    {suppliers.map(s => <option key={s.id} value={s.id}>{s.nom}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-[#374151] mb-1">{t('common.reference')}</label>
                  <input value={form.reference} onChange={e => setForm(f => ({ ...f, reference: e.target.value }))}
                    placeholder="ACH-2026-001"
                    className="w-full px-3 py-2 text-xs border border-[#E2E8F0] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#16A34A]/20" />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-[#374151] mb-1">{t('common.date')}</label>
                  <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                    className="w-full px-3 py-2 text-xs border border-[#E2E8F0] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#16A34A]/20" />
                </div>
              </div>

              {/* Lines */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-[11px] font-semibold text-[#374151]">Produits commandés</label>
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
                        <th className="text-right px-3 py-2 text-[10px] font-semibold text-[#64748B]">Prix unit.</th>
                        <th className="text-right px-3 py-2 text-[10px] font-semibold text-[#64748B]">{t('common.total')}</th>
                        <th className="w-8" />
                      </tr>
                    </thead>
                    <tbody>
                      {form.lines.map((line, i) => (
                        <tr key={i} className="border-t border-[#F8FAFC]">
                          <td className="px-3 py-2">
                            <select value={line.product_id} onChange={e => updateLine(i, 'product_id', e.target.value)}
                              className="w-full px-2 py-1 text-xs border border-[#E2E8F0] rounded-lg focus:outline-none focus:ring-1 focus:ring-[#16A34A]/40">
                              <option value="">Sélectionner…</option>
                              {products.map(p => <option key={p.id} value={p.id}>{p.nom} ({p.sku})</option>)}
                            </select>
                          </td>
                          <td className="px-3 py-2">
                            <input type="number" min={1} value={line.quantite}
                              onChange={e => updateLine(i, 'quantite', Number(e.target.value))}
                              className="w-20 text-right px-2 py-1 text-xs border border-[#E2E8F0] rounded-lg focus:outline-none focus:ring-1 focus:ring-[#16A34A]/40" />
                          </td>
                          <td className="px-3 py-2">
                            <input type="number" min={0} value={line.prix}
                              onChange={e => updateLine(i, 'prix', Number(e.target.value))}
                              className="w-28 text-right px-2 py-1 text-xs border border-[#E2E8F0] rounded-lg focus:outline-none focus:ring-1 focus:ring-[#16A34A]/40" />
                          </td>
                          <td className="px-3 py-2 text-right text-xs font-bold text-[#0F172A]">
                            {fmtFCFA(line.quantite * line.prix)}
                          </td>
                          <td className="px-3 py-2">
                            {form.lines.length > 1 && (
                              <button onClick={() => removeLine(i)} className="text-[#DC2626] hover:bg-[#FEF2F2] p-0.5 rounded">
                                <X size={12} />
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t border-[#E2E8F0] bg-[#F8FAFC]">
                        <td colSpan={3} className="px-3 py-2 text-xs font-bold text-right text-[#374151]">{t('common.total')}</td>
                        <td className="px-3 py-2 text-right text-sm font-bold text-[#16A34A]">{fmtFCFA(totalForm)}</td>
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

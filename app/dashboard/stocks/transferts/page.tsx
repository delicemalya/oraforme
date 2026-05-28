'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useTenant } from '@/lib/hooks/useTenant'
import { useLocale } from '@/lib/hooks/useLocale'
import { fmtFCFA } from '@/lib/admin-config'
import {
  Shuffle, Plus, X, RefreshCw, Search,
  Warehouse, AlertTriangle, ChevronRight, ArrowLeftRight
} from 'lucide-react'

interface WH { id: string; nom: string; ville: string | null }
interface Prod { id: string; nom: string; sku: string; unite: string; stock_actuel: number; prix_achat: number }
interface Transfert {
  id: string; numero: string
  source_warehouse_id: string; destination_warehouse_id: string
  product_id: string; quantite: number; statut: string
  motif: string | null; notes: string | null; date_transfert: string; created_at: string
  source_nom?: string; destination_nom?: string
  product_nom?: string; product_sku?: string; product_unite?: string
}

const STATUTS = [
  { value: 'en_attente', label: 'En attente', color: '#D97706', bg: '#FFFBEB' },
  { value: 'validé',     label: 'Validé',     color: '#16A34A', bg: '#F0FDF4' },
  { value: 'annulé',    label: 'Annulé',      color: '#DC2626', bg: '#FEF2F2' },
]

const emptyForm = {
  source_warehouse_id: '', destination_warehouse_id: '',
  product_id: '', quantite: '', motif: '', notes: '',
  date_transfert: new Date().toISOString().split('T')[0],
}

export default function TransfertsPage() {
  const { tenantId } = useTenant()
  const { t } = useLocale()
  const [transferts, setTransferts] = useState<Transfert[]>([])
  const [warehouses, setWarehouses] = useState<WH[]>([])
  const [products, setProducts] = useState<Prod[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [search, setSearch] = useState('')
  const [filtreStatut, setFiltreStatut] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState(emptyForm)

  const load = useCallback(async () => {
    if (!tenantId) return
    setLoading(true)
    try {
      const [{ data: tr }, { data: wh }, { data: pr }] = await Promise.all([
        supabase.from('stock_transferts').select('*').eq('tenant_id', tenantId).order('created_at', { ascending: false }),
        supabase.from('warehouses').select('id,nom,ville').eq('tenant_id', tenantId),
        supabase.from('products').select('id,nom,sku,unite,stock_actuel,prix_achat').eq('tenant_id', tenantId).eq('statut','actif').order('nom'),
      ])
      setWarehouses(wh || [])
      setProducts(pr || [])
      if (tr) {
        const whMap = Object.fromEntries((wh || []).map((w: any) => [w.id, w.nom]))
        const prMap = Object.fromEntries((pr || []).map((p: any) => [p.id, p]))
        setTransferts(tr.map((t: any) => ({
          ...t,
          source_nom: whMap[t.source_warehouse_id] || 'N/A',
          destination_nom: whMap[t.destination_warehouse_id] || 'N/A',
          product_nom: prMap[t.product_id]?.nom || 'N/A',
          product_sku: prMap[t.product_id]?.sku || '',
          product_unite: prMap[t.product_id]?.unite || '',
        })))
      }
    } catch { setTransferts([]) }
    setLoading(false)
  }, [tenantId])

  useEffect(() => { load() }, [load])

  const selectedProduct = products.find(p => p.id === form.product_id)

  const handleCreate = async () => {
    if (!tenantId) return
    const { source_warehouse_id, destination_warehouse_id, product_id, quantite, date_transfert } = form
    if (!source_warehouse_id || !destination_warehouse_id || !product_id || !quantite) {
      setError('Remplissez tous les champs obligatoires'); return
    }
    if (source_warehouse_id === destination_warehouse_id) {
      setError('Source et destination doivent être différents'); return
    }
    const qty = parseFloat(quantite)
    if (qty <= 0) { setError('Quantité invalide'); return }
    if (selectedProduct && qty > (selectedProduct.stock_actuel || 0)) {
      setError(`Stock insuffisant (disponible: ${selectedProduct.stock_actuel} ${selectedProduct.unite})`); return
    }
    setSaving(true); setError('')
    try {
      const num = `TRF-${Date.now().toString().slice(-6)}`
      const { error: e1 } = await supabase.from('stock_transferts').insert({
        tenant_id: tenantId, numero: num,
        source_warehouse_id, destination_warehouse_id, product_id,
        quantite: qty, statut: 'validé',
        motif: form.motif || null, notes: form.notes || null, date_transfert,
      })
      if (e1) throw e1

      const destNom = warehouses.find(w => w.id === destination_warehouse_id)?.nom || ''
      const srcNom = warehouses.find(w => w.id === source_warehouse_id)?.nom || ''
      await supabase.from('stock_movements').insert([
        {
          tenant_id: tenantId, product_id, warehouse_id: source_warehouse_id,
          type: 'sortie', quantity: qty,
          unit_cost: selectedProduct?.prix_achat || 0,
          reference: num, notes: `Transfert vers ${destNom}`,
        },
        {
          tenant_id: tenantId, product_id, warehouse_id: destination_warehouse_id,
          type: 'entree', quantity: qty,
          unit_cost: selectedProduct?.prix_achat || 0,
          reference: num, notes: `Transfert depuis ${srcNom}`,
        },
      ])

      setShowModal(false)
      setForm(emptyForm)
      load()
    } catch (err: any) { setError(err.message || 'Erreur lors du transfert') }
    setSaving(false)
  }

  const handleAnnuler = async (t: Transfert) => {
    if (!confirm(`Annuler le transfert ${t.numero} ?`)) return
    await supabase.from('stock_transferts').update({ statut: 'annulé' }).eq('id', t.id)
    load()
  }

  const filtered = transferts.filter(tr => {
    const q = search.toLowerCase()
    const ms = !q || tr.numero.toLowerCase().includes(q) || (tr.product_nom||'').toLowerCase().includes(q) || (tr.source_nom||'').toLowerCase().includes(q)
    return ms && (!filtreStatut || tr.statut === filtreStatut)
  })

  const getStatut = (v: string) => STATUTS.find(s => s.value === v) || STATUTS[0]

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-[#0F172A] flex items-center gap-2">
            <Shuffle size={20} className="text-[#16A34A]" />
            {t('stock.transferts.title')}
          </h1>
          <p className="text-xs text-[#64748B] mt-0.5">{t('stock.transferts.subtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={load} className="flex items-center gap-1.5 border border-[#E2E8F0] text-[#374151] px-3 py-2 rounded-xl text-xs font-semibold hover:bg-[#F8FAFC]">
            <RefreshCw size={13} />
          </button>
          <button onClick={() => { setForm(emptyForm); setError(''); setShowModal(true) }}
            className="flex items-center gap-1.5 bg-[#16A34A] text-white px-4 py-2 rounded-xl text-xs font-semibold hover:bg-[#15803D] shadow-sm">
            <Plus size={14} /> {t('stock.transferts.new')}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: t('stock.transferts.title'), value: transferts.length, color: '#2563EB', bg: '#EFF6FF' },
          { label: t('stock.page.stat.ok'), value: transferts.filter(tr => tr.created_at?.startsWith(new Date().toISOString().slice(0,7))).length, color: '#16A34A', bg: '#F0FDF4' },
          { label: t('stock.transferts.colStatut'), value: transferts.filter(tr => tr.statut === 'validé').length, color: '#16A34A', bg: '#F0FDF4' },
          { label: t('stock.page.stat.low'), value: transferts.filter(tr => tr.statut === 'en_attente').length, color: '#D97706', bg: '#FFFBEB' },
        ].map(k => (
          <div key={k.label} className="bg-white border border-[#E2E8F0] rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: k.bg }}>
                <ArrowLeftRight size={13} style={{ color: k.color }} />
              </div>
              <span className="text-[11px] text-[#64748B]">{k.label}</span>
            </div>
            <p className="text-xl font-bold text-[#0F172A]">{k.value}</p>
          </div>
        ))}
      </div>

      <div className="bg-white border border-[#E2E8F0] rounded-2xl p-3 flex gap-3">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder={t('stock.transferts.searchPlh')}
            className="w-full pl-8 pr-3 py-2 text-xs border border-[#E2E8F0] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#16A34A]/20" />
        </div>
        <select value={filtreStatut} onChange={e => setFiltreStatut(e.target.value)}
          className="px-3 py-2 text-xs border border-[#E2E8F0] rounded-xl focus:outline-none">
          <option value="">{t('stock.mouvements.filterAll')}</option>
          {STATUTS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
      </div>

      <div className="bg-white border border-[#E2E8F0] rounded-2xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20 text-sm text-[#64748B]">{t('common.loading')}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#F1F5F9] bg-[#F8FAFC]">
                  {[t('stock.audit.colRef'), t('stock.transferts.colArticle'), t('stock.transferts.colSource'), '', t('stock.transferts.colDest'), t('stock.transferts.colQty'), t('stock.transferts.colDate'), t('stock.transferts.colStatut'), 'Actions'].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-[11px] font-semibold text-[#64748B]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={9} className="text-center py-12 text-sm text-[#64748B]">{t('stock.transferts.empty')}</td></tr>
                ) : filtered.map(tr => {
                  const st = getStatut(tr.statut)
                  return (
                    <tr key={tr.id} className="border-b border-[#F8FAFC] hover:bg-[#FAFAFA]">
                      <td className="px-4 py-3"><span className="text-xs font-mono font-bold text-[#374151]">{tr.numero}</span></td>
                      <td className="px-4 py-3">
                        <p className="text-xs font-bold text-[#0F172A]">{tr.product_nom}</p>
                        <span className="text-[10px] font-mono text-[#94A3B8]">{tr.product_sku}</span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1"><Warehouse size={11} className="text-[#DC2626]" /><span className="text-xs text-[#374151]">{tr.source_nom}</span></div>
                      </td>
                      <td className="px-4 py-3"><ChevronRight size={14} className="text-[#94A3B8]" /></td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1"><Warehouse size={11} className="text-[#16A34A]" /><span className="text-xs text-[#374151]">{tr.destination_nom}</span></div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="text-xs font-bold text-[#0F172A]">{tr.quantite?.toLocaleString()}</span>
                        <span className="text-[10px] text-[#94A3B8] ml-1">{tr.product_unite}</span>
                      </td>
                      <td className="px-4 py-3 text-xs text-[#64748B]">{tr.date_transfert ? new Date(tr.date_transfert).toLocaleDateString('fr-FR') : '—'}</td>
                      <td className="px-4 py-3">
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ color: st.color, background: st.bg }}>{st.label}</span>
                      </td>
                      <td className="px-4 py-3">
                        {tr.statut === 'en_attente' && (
                          <button onClick={() => handleAnnuler(tr)} className="text-[11px] text-[#DC2626] hover:underline">Annuler</button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg">
            <div className="flex items-center justify-between p-5 border-b border-[#F1F5F9]">
              <h2 className="text-sm font-bold text-[#0F172A] flex items-center gap-2">
                <Shuffle size={16} className="text-[#16A34A]" /> {t('stock.transferts.new')}
              </h2>
              <button onClick={() => setShowModal(false)}><X size={18} className="text-[#94A3B8]" /></button>
            </div>
            <div className="p-5 space-y-4">
              {error && <div className="bg-[#FEF2F2] text-[#DC2626] text-xs px-3 py-2 rounded-xl flex items-center gap-2"><AlertTriangle size={13} />{error}</div>}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-semibold text-[#374151] mb-1 block">Entrepôt source *</label>
                  <select value={form.source_warehouse_id} onChange={e => setForm(f => ({ ...f, source_warehouse_id: e.target.value }))}
                    className="w-full px-3 py-2 text-xs border border-[#E2E8F0] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#16A34A]/20">
                    <option value="">Sélectionner…</option>
                    {warehouses.map(w => <option key={w.id} value={w.id}>{w.nom}{w.ville ? ` (${w.ville})` : ''}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-[#374151] mb-1 block">Entrepôt destination *</label>
                  <select value={form.destination_warehouse_id} onChange={e => setForm(f => ({ ...f, destination_warehouse_id: e.target.value }))}
                    className="w-full px-3 py-2 text-xs border border-[#E2E8F0] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#16A34A]/20">
                    <option value="">Sélectionner…</option>
                    {warehouses.filter(w => w.id !== form.source_warehouse_id).map(w => <option key={w.id} value={w.id}>{w.nom}{w.ville ? ` (${w.ville})` : ''}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-[#374151] mb-1 block">Produit *</label>
                <select value={form.product_id} onChange={e => setForm(f => ({ ...f, product_id: e.target.value }))}
                  className="w-full px-3 py-2 text-xs border border-[#E2E8F0] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#16A34A]/20">
                  <option value="">Sélectionner un produit…</option>
                  {products.map(p => <option key={p.id} value={p.id}>{p.nom} ({p.sku}) — Stock: {p.stock_actuel} {p.unite}</option>)}
                </select>
                {selectedProduct && (
                  <p className="text-[11px] text-[#16A34A] mt-1">✓ Stock disponible: <strong>{selectedProduct.stock_actuel} {selectedProduct.unite}</strong></p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-semibold text-[#374151] mb-1 block">Quantité *</label>
                  <input type="number" min="0.01" step="0.01" value={form.quantite}
                    onChange={e => setForm(f => ({ ...f, quantite: e.target.value }))} placeholder="0"
                    className="w-full px-3 py-2 text-xs border border-[#E2E8F0] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#16A34A]/20" />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-[#374151] mb-1 block">Date *</label>
                  <input type="date" value={form.date_transfert}
                    onChange={e => setForm(f => ({ ...f, date_transfert: e.target.value }))}
                    className="w-full px-3 py-2 text-xs border border-[#E2E8F0] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#16A34A]/20" />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-[#374151] mb-1 block">Motif</label>
                <input value={form.motif} onChange={e => setForm(f => ({ ...f, motif: e.target.value }))}
                  placeholder="Réorganisation, approvisionnement point de vente…"
                  className="w-full px-3 py-2 text-xs border border-[#E2E8F0] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#16A34A]/20" />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-[#374151] mb-1 block">Notes</label>
                <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  rows={2} placeholder="Remarques optionnelles…"
                  className="w-full px-3 py-2 text-xs border border-[#E2E8F0] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#16A34A]/20 resize-none" />
              </div>
            </div>
            <div className="flex justify-end gap-2 px-5 pb-5">
              <button onClick={() => setShowModal(false)}
                className="px-4 py-2 text-xs font-semibold text-[#64748B] border border-[#E2E8F0] rounded-xl hover:bg-[#F8FAFC]">Annuler</button>
              <button onClick={handleCreate} disabled={saving}
                className="px-4 py-2 text-xs font-semibold bg-[#16A34A] text-white rounded-xl hover:bg-[#15803D] disabled:opacity-50">
                {saving ? 'Transfert…' : 'Effectuer le transfert'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

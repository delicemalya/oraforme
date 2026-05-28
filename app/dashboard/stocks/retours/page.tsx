'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useTenant } from '@/lib/hooks/useTenant'
import { useLocale } from '@/lib/hooks/useLocale'
import { fmtFCFA } from '@/lib/admin-config'
import { writeComptaEntry } from '@/lib/compta-sync-client'
import {
  RotateCcw, Plus, X, Save, Search,
  Package, Calendar, CheckCircle2, AlertTriangle,
  ChevronDown, ChevronRight, Building2, Users
} from 'lucide-react'

interface Retour {
  id: string
  tenant_id: string
  numero: string
  type_retour: 'client' | 'fournisseur'
  product_id: string | null
  supplier_id: string | null
  quantite: number
  motif: string
  statut: string
  valeur: number
  date_retour: string
  notes: string | null
  created_at: string
  product_nom?: string
  product_sku?: string
  supplier_nom?: string
}

interface Product { id: string; nom: string; sku: string; prix_achat: number; prix_vente: number; unite: string }
interface Supplier { id: string; nom: string }

const MOTIFS_CLIENT = ['Produit défectueux', 'Mauvaise commande', 'Surplus', 'Qualité insuffisante', 'Délai dépassé', 'Autre']
const MOTIFS_FOURNISSEUR = ['Non conforme', 'Quantité incorrecte', 'Dommages transport', 'Produit périmé', 'Mauvaise référence', 'Autre']

const STATUT_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  en_attente:   { label: 'En attente',  color: '#D97706', bg: '#FFFBEB' },
  validé:       { label: 'Validé',      color: '#16A34A', bg: '#F0FDF4' },
  remboursé:    { label: 'Remboursé',   color: '#2563EB', bg: '#EFF6FF' },
  rejeté:       { label: 'Rejeté',      color: '#DC2626', bg: '#FEF2F2' },
}

export default function RetoursPage() {

  const { tenantId } = useTenant()
  const { t } = useLocale()

  const [retours, setRetours] = useState<Retour[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [saving, setSaving] = useState(false)
  const [createError, setCreateError] = useState('')

  const [form, setForm] = useState({
    type_retour: 'client' as 'client' | 'fournisseur',
    product_id: '',
    supplier_id: '',
    quantite: 1,
    motif: '',
    valeur: 0,
    date_retour: new Date().toISOString().split('T')[0],
    notes: '',
  })

  const load = useCallback(async () => {
    if (!tenantId) return
    setLoading(true)
    try {
      const { data: rets, error: e1 } = await supabase
        .from('stock_retours')
        .select('*, products(nom, sku), suppliers(nom)')
        .eq('tenant_id', tenantId)
        .order('date_retour', { ascending: false })

      if (e1?.code === '42P01') { setRetours([]); setLoading(false); return }

      const { data: prods } = await supabase.from('products').select('id, nom, sku, prix_achat, prix_vente, unite').eq('tenant_id', tenantId)
      const { data: sups } = await supabase.from('suppliers').select('id, nom').eq('tenant_id', tenantId).eq('actif', true)

      setProducts(prods || [])
      setSuppliers(sups || [])

      setRetours((rets || []).map((r: any) => ({
        ...r,
        product_nom: r.products?.nom,
        product_sku: r.products?.sku,
        supplier_nom: r.suppliers?.nom,
      })))
    } catch { setRetours([]) }
    setLoading(false)
  }, [tenantId, supabase])

  useEffect(() => { load() }, [load])

  const handleProductChange = (productId: string) => {
    const prod = products.find(p => p.id === productId)
    setForm(f => ({
      ...f,
      product_id: productId,
      valeur: prod ? (f.type_retour === 'client' ? prod.prix_vente : prod.prix_achat) * f.quantite : 0,
    }))
  }

  const handleCreate = async () => {
    if (!tenantId || !form.product_id || !form.motif) {
      setCreateError('Produit et motif obligatoires')
      return
    }
    setSaving(true)
    setCreateError('')
    try {
      const numero = `RET-${new Date().getFullYear()}-${String(retours.length + 1).padStart(4, '0')}`

      const { data: retour, error: e } = await supabase
        .from('stock_retours')
        .insert({
          tenant_id: tenantId,
          numero,
          type_retour: form.type_retour,
          product_id: form.product_id || null,
          supplier_id: form.type_retour === 'fournisseur' ? (form.supplier_id || null) : null,
          quantite: form.quantite,
          motif: form.motif,
          statut: 'en_attente',
          valeur: form.valeur,
          date_retour: form.date_retour,
          notes: form.notes.trim() || null,
        })
        .select().single()
      if (e) throw e

      setShowCreate(false)
      setForm({ type_retour: 'client', product_id: '', supplier_id: '', quantite: 1, motif: '', valeur: 0, date_retour: new Date().toISOString().split('T')[0], notes: '' })
      await load()
    } catch (e: any) { setCreateError(e.message || 'Erreur') }
    setSaving(false)
  }

  const changeStatut = async (ret: Retour, newStatut: string) => {
    if (!tenantId) return
    setSaving(true)
    try {
      await supabase.from('stock_retours').update({ statut: newStatut }).eq('id', ret.id).eq('tenant_id', tenantId)

      if (newStatut === 'validé') {
        // Update stock: retour client = déstockage, retour fournisseur = restockage
        if (ret.product_id) {
          const { data: prod } = await supabase.from('products').select('stock_actuel').eq('id', ret.product_id).single()
          if (prod) {
            const delta = ret.type_retour === 'fournisseur' ? -ret.quantite : ret.quantite
            await supabase.from('products').update({ stock_actuel: Math.max(0, (prod.stock_actuel || 0) + delta) }).eq('id', ret.product_id)
          }
          await supabase.from('stock_movements').insert({
            tenant_id: tenantId,
            product_id: ret.product_id,
            type: 'retour',
            quantity: ret.quantite,
            unit_cost: ret.valeur / ret.quantite,
            reference: ret.numero,
            notes: `Retour ${ret.type_retour} validé: ${ret.motif}`,
          })
        }

        // OHADA
        const today = ret.date_retour
        if (ret.valeur > 0) {
          if (ret.type_retour === 'client') {
            await writeComptaEntry({
              tenantId,
              date: today,
              libelle: `Retour client validé ${ret.numero}`,
              type: 'depense',
              montant: ret.valeur,
              categorie: 'retours',
              debitAccount: '700000',
              creditAccount: '411000',
              source: 'retours',
              sourceId: ret.id,
            })
          } else {
            await writeComptaEntry({
              tenantId,
              date: today,
              libelle: `Retour fournisseur validé ${ret.numero}`,
              type: 'recette',
              montant: ret.valeur,
              categorie: 'retours',
              debitAccount: '401000',
              creditAccount: '310000',
              source: 'retours',
              sourceId: ret.id,
            })
          }
        }
      }

      await load()
    } catch (e: any) { alert(e.message) }
    setSaving(false)
  }

  const filtered = retours.filter(r =>
    r.numero.toLowerCase().includes(search.toLowerCase()) ||
    (r.product_nom || '').toLowerCase().includes(search.toLowerCase()) ||
    (r.motif || '').toLowerCase().includes(search.toLowerCase())
  )

  const enAttente = retours.filter(r => r.statut === 'en_attente').length
  const totalValeur = retours.filter(r => r.statut === 'validé').reduce((s, r) => s + r.valeur, 0)

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-[#0F172A] flex items-center gap-2">
            <RotateCcw size={20} className="text-[#16A34A]" />
            {t('stock.retours.title')}
          </h1>
          <p className="text-xs text-[#64748B] mt-0.5">{t('stock.retours.subtitle')}</p>
        </div>
        <button onClick={() => setShowCreate(true)}
          className="flex items-center gap-1.5 bg-[#16A34A] text-white px-4 py-2 rounded-xl text-xs font-semibold hover:bg-[#15803D] transition-colors">
          <Plus size={14} /> {t('stock.retours.newReturn')}
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: t('stock.retours.kpi.total'), value: retours.length, icon: RotateCcw, color: '#7C3AED', bg: '#F5F3FF' },
          { label: 'En attente', value: enAttente, icon: AlertTriangle, color: '#D97706', bg: '#FFFBEB' },
          { label: t('stock.retours.tab.client'), value: retours.filter(r => r.type_retour === 'client').length, icon: Users, color: '#2563EB', bg: '#EFF6FF' },
          { label: t('stock.retours.kpi.valeur'), value: fmtFCFA(totalValeur), icon: Package, color: '#16A34A', bg: '#F0FDF4' },
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
            placeholder="Rechercher un retour…"
            className="w-full pl-8 pr-3 py-2 text-xs border border-[#E2E8F0] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#16A34A]/20" />
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center py-20 text-sm text-[#64748B]">{t('common.loading')}</div>
      ) : (
        <div className="bg-white border border-[#E2E8F0] rounded-2xl overflow-hidden">
          {filtered.length === 0 ? (
            <div className="p-12 text-center">
              <RotateCcw size={40} className="mx-auto text-[#CBD5E1] mb-3" />
              <p className="text-sm font-semibold text-[#0F172A]">{t('stock.retours.noReturns')}</p>
              <button onClick={() => setShowCreate(true)}
                className="mt-4 bg-[#16A34A] text-white px-4 py-2 rounded-xl text-xs font-semibold hover:bg-[#15803D] transition-colors">
                Enregistrer un retour
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[#F1F5F9] bg-[#F8FAFC]">
                    <th className="text-left px-4 py-3 text-[11px] font-semibold text-[#64748B]">Numéro</th>
                    <th className="text-left px-4 py-3 text-[11px] font-semibold text-[#64748B]">Type</th>
                    <th className="text-left px-4 py-3 text-[11px] font-semibold text-[#64748B]">Produit</th>
                    <th className="text-right px-4 py-3 text-[11px] font-semibold text-[#64748B]">Qté</th>
                    <th className="text-left px-4 py-3 text-[11px] font-semibold text-[#64748B]">Motif</th>
                    <th className="text-right px-4 py-3 text-[11px] font-semibold text-[#64748B]">Valeur</th>
                    <th className="text-center px-4 py-3 text-[11px] font-semibold text-[#64748B]">Statut</th>
                    <th className="text-left px-4 py-3 text-[11px] font-semibold text-[#64748B]">Date</th>
                    <th className="text-center px-4 py-3 text-[11px] font-semibold text-[#64748B]">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(r => {
                    const cfg = STATUT_CONFIG[r.statut] || STATUT_CONFIG.en_attente
                    return (
                      <tr key={r.id} className="border-b border-[#F8FAFC] hover:bg-[#FAFAFA] transition-colors">
                        <td className="px-4 py-3 text-xs font-mono text-[#0F172A]">{r.numero}</td>
                        <td className="px-4 py-3">
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                            r.type_retour === 'client' ? 'bg-[#EFF6FF] text-[#2563EB]' : 'bg-[#F5F3FF] text-[#7C3AED]'
                          }`}>
                            {r.type_retour === 'client' ? t('stock.retours.tab.client') : t('stock.retours.tab.fournisseur')}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-xs font-semibold text-[#0F172A]">{r.product_nom || '—'}</p>
                          {r.product_sku && <span className="text-[10px] font-mono text-[#94A3B8]">{r.product_sku}</span>}
                        </td>
                        <td className="px-4 py-3 text-right text-xs font-bold text-[#0F172A]">{r.quantite}</td>
                        <td className="px-4 py-3 text-[11px] text-[#64748B] max-w-[150px] truncate">{r.motif}</td>
                        <td className="px-4 py-3 text-right text-xs font-bold text-[#0F172A]">{fmtFCFA(r.valeur)}</td>
                        <td className="px-4 py-3 text-center">
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                            style={{ color: cfg.color, background: cfg.bg }}>
                            {cfg.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-[11px] text-[#64748B]">
                          {new Date(r.date_retour).toLocaleDateString('fr-FR')}
                        </td>
                        <td className="px-4 py-3">
                          {r.statut === 'en_attente' && (
                            <div className="flex gap-1 justify-center">
                              <button onClick={() => changeStatut(r, 'validé')} disabled={saving}
                                className="px-2 py-1 bg-[#16A34A] text-white text-[10px] rounded-lg font-semibold hover:bg-[#15803D] disabled:opacity-50">
                                Valider
                              </button>
                              <button onClick={() => changeStatut(r, 'rejeté')} disabled={saving}
                                className="px-2 py-1 bg-[#DC2626] text-white text-[10px] rounded-lg font-semibold hover:bg-[#B91C1C] disabled:opacity-50">
                                Rejeter
                              </button>
                            </div>
                          )}
                          {r.statut === 'validé' && (
                            <button onClick={() => changeStatut(r, 'remboursé')} disabled={saving}
                              className="px-2 py-1 bg-[#2563EB] text-white text-[10px] rounded-lg font-semibold hover:bg-[#1D4ED8] disabled:opacity-50">
                              Remboursé
                            </button>
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
      )}

      {/* Create Modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-[#E2E8F0]">
              <h2 className="text-sm font-bold text-[#0F172A]">Nouveau retour</h2>
              <button onClick={() => setShowCreate(false)}><X size={16} className="text-[#94A3B8]" /></button>
            </div>
            <div className="p-5 space-y-4">
              {createError && <div className="bg-[#FEF2F2] border border-[#FCA5A5] text-[#DC2626] text-xs p-3 rounded-xl">{createError}</div>}

              {/* Type toggle */}
              <div>
                <label className="block text-[11px] font-semibold text-[#374151] mb-2">Type de retour</label>
                <div className="flex rounded-xl border border-[#E2E8F0] overflow-hidden">
                  {(['client', 'fournisseur'] as const).map(tab_ => (
                    <button key={tab_} onClick={() => setForm(f => ({ ...f, type_retour: tab_, motif: '' }))}
                      className={`flex-1 py-2 text-xs font-semibold transition-colors ${
                        form.type_retour === tab_
                          ? 'bg-[#16A34A] text-white'
                          : 'bg-white text-[#64748B] hover:bg-[#F8FAFC]'
                      }`}>
                      {tab_ === 'client' ? `👤 ${t('stock.retours.tab.client')}` : `🏭 ${t('stock.retours.tab.fournisseur')}`}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-[#374151] mb-1">Produit *</label>
                  <select value={form.product_id} onChange={e => handleProductChange(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-[#E2E8F0] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#16A34A]/20">
                    <option value="">Sélectionner…</option>
                    {products.map(p => <option key={p.id} value={p.id}>{p.nom} ({p.sku})</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-[#374151] mb-1">Quantité</label>
                  <input type="number" min={1} value={form.quantite}
                    onChange={e => {
                      const q = Number(e.target.value)
                      const prod = products.find(p => p.id === form.product_id)
                      setForm(f => ({ ...f, quantite: q, valeur: prod ? (f.type_retour === 'client' ? prod.prix_vente : prod.prix_achat) * q : f.valeur }))
                    }}
                    className="w-full px-3 py-2 text-xs border border-[#E2E8F0] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#16A34A]/20" />
                </div>
              </div>

              {form.type_retour === 'fournisseur' && (
                <div>
                  <label className="block text-[11px] font-semibold text-[#374151] mb-1">Fournisseur</label>
                  <select value={form.supplier_id} onChange={e => setForm(f => ({ ...f, supplier_id: e.target.value }))}
                    className="w-full px-3 py-2 text-xs border border-[#E2E8F0] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#16A34A]/20">
                    <option value="">Sans fournisseur</option>
                    {suppliers.map(s => <option key={s.id} value={s.id}>{s.nom}</option>)}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-[11px] font-semibold text-[#374151] mb-1">Motif *</label>
                <select value={form.motif} onChange={e => setForm(f => ({ ...f, motif: e.target.value }))}
                  className="w-full px-3 py-2 text-xs border border-[#E2E8F0] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#16A34A]/20">
                  <option value="">Sélectionner le motif…</option>
                  {(form.type_retour === 'client' ? MOTIFS_CLIENT : MOTIFS_FOURNISSEUR).map(m => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-[#374151] mb-1">Valeur (FCFA)</label>
                  <input type="number" min={0} value={form.valeur}
                    onChange={e => setForm(f => ({ ...f, valeur: Number(e.target.value) }))}
                    className="w-full px-3 py-2 text-xs border border-[#E2E8F0] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#16A34A]/20" />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-[#374151] mb-1">Date retour</label>
                  <input type="date" value={form.date_retour}
                    onChange={e => setForm(f => ({ ...f, date_retour: e.target.value }))}
                    className="w-full px-3 py-2 text-xs border border-[#E2E8F0] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#16A34A]/20" />
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

'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useTenant } from '@/lib/hooks/useTenant'
import { useLocale } from '@/lib/hooks/useLocale'
import { useFmt } from '@/lib/hooks/useFmt'
import {
  Grid3X3, Plus, Edit2, Trash2, X, Save, Search,
  Package, TrendingUp, AlertTriangle, ChevronRight,
  Archive
} from 'lucide-react'

interface Category {
  id: string
  tenant_id: string
  nom: string
  code: string
  description: string | null
  couleur: string
  icone: string | null
  parent_id: string | null
  parent_nom?: string
  ordre: number
  actif: boolean
  created_at: string
  // computed
  nb_produits?: number
  valeur_stock?: number
  produits_faibles?: number
}

const COULEURS = [
  '#16A34A', '#2563EB', '#DC2626', '#D97706', '#7C3AED',
  '#0891B2', '#DB2777', '#65A30D', '#EA580C', '#6366F1',
  '#14B8A6', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'
]

const ICONES = ['📦', '🔧', '💊', '🍕', '👕', '💻', '🚗', '🏗️', '📚', '🎮', '🧴', '🥩', '🌿', '⚡', '🔩']

const EMPTY_FORM = {
  nom: '',
  code: '',
  description: '',
  couleur: '#16A34A',
  icone: '📦',
  parent_id: '',
  ordre: 0,
  actif: true,
}

export default function CategoriesPage() {
  const { fmt: fmtFCFA } = useFmt()

  const { tenantId } = useTenant()
  const { t } = useLocale()

  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editTarget, setEditTarget] = useState<Category | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Category | null>(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    if (!tenantId) return
    setLoading(true)
    try {
      const { data: cats, error: e1 } = await supabase
        .from('product_categories')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('ordre', { ascending: true })
        .order('nom', { ascending: true })

      if (e1?.code === '42P01') { setCategories([]); setLoading(false); return }

      const { data: prods } = await supabase
        .from('v_products_stock')
        .select('id, categorie_id, stock_actuel, prix_achat, seuil_alerte')
        .eq('tenant_id', tenantId)

      const list = (cats || []).map((c: Category) => {
        const catProds = (prods || []).filter((p: any) => p.categorie_id === c.id)
        const nb_produits = catProds.length
        const valeur_stock = catProds.reduce((s: number, p: any) => s + (p.stock_actuel || 0) * (p.prix_achat || 0), 0)
        const produits_faibles = catProds.filter((p: any) => (p.stock_actuel || 0) <= (p.seuil_alerte || 0)).length
        return { ...c, nb_produits, valeur_stock, produits_faibles }
      })

      // attach parent names
      const listWithParent = list.map((c: Category) => {
        const parent = list.find((p: Category) => p.id === c.parent_id)
        return { ...c, parent_nom: parent?.nom }
      })

      setCategories(listWithParent)
    } catch { setCategories([]) }
    setLoading(false)
  }, [tenantId])

  useEffect(() => { load() }, [load])

  const openCreate = () => {
    setEditTarget(null)
    setForm(EMPTY_FORM)
    setError('')
    setShowModal(true)
  }

  const openEdit = (c: Category) => {
    setEditTarget(c)
    setForm({
      nom: c.nom,
      code: c.code,
      description: c.description || '',
      couleur: c.couleur,
      icone: c.icone || '📦',
      parent_id: c.parent_id || '',
      ordre: c.ordre,
      actif: c.actif,
    })
    setError('')
    setShowModal(true)
  }

  const generateCode = (nom: string) => {
    return nom.slice(0, 4).toUpperCase().replace(/\s/g, 'X').padEnd(3, 'X')
  }

  const handleSave = async () => {
    if (!tenantId || !form.nom.trim()) { setError('Le nom est obligatoire'); return }
    setSaving(true)
    setError('')

    const code = form.code.trim() || generateCode(form.nom)

    try {
      if (editTarget) {
        const { error: e } = await supabase
          .from('product_categories')
          .update({
            nom: form.nom.trim(),
            code: code.toUpperCase(),
            description: form.description.trim() || null,
            couleur: form.couleur,
            icone: form.icone,
            parent_id: form.parent_id || null,
            ordre: form.ordre,
            actif: form.actif,
          })
          .eq('id', editTarget.id)
          .eq('tenant_id', tenantId)
        if (e) throw e
      } else {
        const { error: e } = await supabase
          .from('product_categories')
          .insert({
            tenant_id: tenantId,
            nom: form.nom.trim(),
            code: code.toUpperCase(),
            description: form.description.trim() || null,
            couleur: form.couleur,
            icone: form.icone,
            parent_id: form.parent_id || null,
            ordre: form.ordre,
            actif: form.actif,
          })
        if (e) throw e
      }
      setShowModal(false)
      await load()
    } catch (e: any) {
      setError(e.message || 'Erreur lors de la sauvegarde')
    }
    setSaving(false)
  }

  const handleDelete = async () => {
    if (!deleteTarget || !tenantId) return
    setSaving(true)
    try {
      await supabase
        .from('product_categories')
        .delete()
        .eq('id', deleteTarget.id)
        .eq('tenant_id', tenantId)
      setDeleteTarget(null)
      await load()
    } catch (e: any) {
      alert(e.message)
    }
    setSaving(false)
  }

  const filtered = categories.filter(c =>
    c.nom.toLowerCase().includes(search.toLowerCase()) ||
    c.code.toLowerCase().includes(search.toLowerCase()) ||
    (c.description || '').toLowerCase().includes(search.toLowerCase())
  )

  const rootCategories = filtered.filter(c => !c.parent_id)
  const subCategories = filtered.filter(c => !!c.parent_id)

  const totalProduits = categories.reduce((s, c) => s + (c.nb_produits || 0), 0)
  const totalValeur = categories.reduce((s, c) => s + (c.valeur_stock || 0), 0)
  const totalFaibles = categories.reduce((s, c) => s + (c.produits_faibles || 0), 0)

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-[#0F172A] flex items-center gap-2">
            <Grid3X3 size={20} className="text-[#16A34A]" />
            {t('stock.categories.title')}
          </h1>
          <p className="text-xs text-[#64748B] mt-0.5">{t('stock.categories.subtitle')}</p>
        </div>
        <button onClick={openCreate}
          className="flex items-center gap-1.5 bg-[#16A34A] text-white px-4 py-2 rounded-xl text-xs font-semibold hover:bg-[#15803D] transition-colors">
          <Plus size={14} />
          {t('stock.categories.new')}
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: t('stock.categories.title'), value: categories.length, icon: Grid3X3, color: '#16A34A', bg: '#F0FDF4' },
          { label: t('stock.categories.colNom'), value: totalProduits, icon: Package, color: '#2563EB', bg: '#EFF6FF' },
          { label: t('stock.categories.colValeur'), value: fmtFCFA(totalValeur), icon: TrendingUp, color: '#D97706', bg: '#FFFBEB' },
          { label: t('stock.alertes.low'), value: totalFaibles, icon: AlertTriangle, color: '#DC2626', bg: '#FEF2F2' },
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
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={t('stock.categories.searchPlh')}
            className="w-full pl-8 pr-3 py-2 text-xs border border-[#E2E8F0] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#16A34A]/20"
          />
        </div>
      </div>

      {/* Category Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-20 text-[#64748B] text-sm">{t('common.loading')}</div>
      ) : categories.length === 0 ? (
        <div className="bg-white border border-[#E2E8F0] rounded-2xl p-12 text-center">
          <Grid3X3 size={40} className="mx-auto text-[#CBD5E1] mb-3" />
          <p className="text-sm font-semibold text-[#0F172A]">{t('stock.categories.empty')}</p>
          <p className="text-xs text-[#64748B] mt-1">Créez votre première catégorie pour organiser votre catalogue</p>
          <button onClick={openCreate}
            className="mt-4 bg-[#16A34A] text-white px-4 py-2 rounded-xl text-xs font-semibold hover:bg-[#15803D] transition-colors">
            {t('stock.categories.new')}
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Root categories */}
          {rootCategories.length > 0 && (
            <div>
              <p className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider mb-2 px-1">
                Catégories principales ({rootCategories.length})
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {rootCategories.map(cat => {
                  const children = subCategories.filter(s => s.parent_id === cat.id)
                  return (
                    <div key={cat.id}
                      className="bg-white border border-[#E2E8F0] rounded-2xl overflow-hidden hover:shadow-sm transition-shadow">
                      {/* Color strip */}
                      <div className="h-1.5 w-full" style={{ background: cat.couleur }} />
                      <div className="p-4">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <span className="text-xl">{cat.icone}</span>
                            <div>
                              <p className="text-sm font-bold text-[#0F172A]">{cat.nom}</p>
                              <span className="text-[10px] font-mono bg-[#F1F5F9] text-[#64748B] px-1.5 py-0.5 rounded">
                                {cat.code}
                              </span>
                            </div>
                          </div>
                          <div className="flex gap-1">
                            <button onClick={() => openEdit(cat)}
                              className="p-1.5 rounded-lg hover:bg-[#EFF6FF] text-[#2563EB] transition-colors">
                              <Edit2 size={12} />
                            </button>
                            <button onClick={() => setDeleteTarget(cat)}
                              className="p-1.5 rounded-lg hover:bg-[#FEF2F2] text-[#DC2626] transition-colors">
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </div>

                        {cat.description && (
                          <p className="text-[11px] text-[#64748B] mb-3 line-clamp-2">{cat.description}</p>
                        )}

                        {/* Stats */}
                        <div className="grid grid-cols-3 gap-2 text-center border-t border-[#F1F5F9] pt-3">
                          <div>
                            <p className="text-sm font-bold text-[#0F172A]">{cat.nb_produits}</p>
                            <p className="text-[10px] text-[#94A3B8]">Produits</p>
                          </div>
                          <div>
                            <p className="text-[11px] font-bold text-[#0F172A]">{fmtFCFA(cat.valeur_stock || 0)}</p>
                            <p className="text-[10px] text-[#94A3B8]">Valeur</p>
                          </div>
                          <div>
                            <p className="text-sm font-bold text-[#DC2626]">{cat.produits_faibles}</p>
                            <p className="text-[10px] text-[#94A3B8]">Faibles</p>
                          </div>
                        </div>

                        {/* Sub-categories */}
                        {children.length > 0 && (
                          <div className="mt-3 pt-2 border-t border-[#F1F5F9]">
                            <p className="text-[10px] text-[#94A3B8] mb-1.5 flex items-center gap-1">
                              <ChevronRight size={10} /> {children.length} sous-catégorie(s)
                            </p>
                            <div className="flex flex-wrap gap-1">
                              {children.map(ch => (
                                <span key={ch.id}
                                  className="text-[10px] px-2 py-0.5 rounded-full border text-[#64748B]"
                                  style={{ borderColor: ch.couleur + '40', background: ch.couleur + '10' }}>
                                  {ch.icone} {ch.nom}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {!cat.actif && (
                          <div className="mt-2 flex items-center gap-1">
                            <Archive size={10} className="text-[#94A3B8]" />
                            <span className="text-[10px] text-[#94A3B8]">Archivée</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Subcategories not shown in parents (orphans) */}
          {subCategories.filter(s => !rootCategories.find(r => r.id === s.parent_id)).length > 0 && (
            <div>
              <p className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider mb-2 px-1">
                Autres sous-catégories
              </p>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                {subCategories.filter(s => !rootCategories.find(r => r.id === s.parent_id)).map(cat => (
                  <div key={cat.id}
                    className="bg-white border border-[#E2E8F0] rounded-xl p-3 flex items-center gap-2">
                    <span>{cat.icone}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-[#0F172A] truncate">{cat.nom}</p>
                      <p className="text-[10px] text-[#94A3B8]">{cat.nb_produits} produits</p>
                    </div>
                    <button onClick={() => openEdit(cat)} className="text-[#2563EB] hover:bg-[#EFF6FF] p-1 rounded">
                      <Edit2 size={11} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modal Create/Edit */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-[#E2E8F0]">
              <h2 className="text-sm font-bold text-[#0F172A]">
                {editTarget ? t('stock.categories.modalTitle') : t('stock.categories.new')}
              </h2>
              <button onClick={() => setShowModal(false)} className="text-[#94A3B8] hover:text-[#0F172A]">
                <X size={16} />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {error && (
                <div className="bg-[#FEF2F2] border border-[#FCA5A5] text-[#DC2626] text-xs p-3 rounded-xl">
                  {error}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-[#374151] mb-1">{t('stock.categories.formNom')} *</label>
                  <input
                    value={form.nom}
                    onChange={e => setForm(f => ({
                      ...f,
                      nom: e.target.value,
                      code: f.code || generateCode(e.target.value)
                    }))}
                    placeholder="Électronique"
                    className="w-full px-3 py-2 text-xs border border-[#E2E8F0] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#16A34A]/20"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-[#374151] mb-1">Code</label>
                  <input
                    value={form.code}
                    onChange={e => setForm(f => ({ ...f, code: e.target.value.toUpperCase() }))}
                    placeholder="ELEC"
                    maxLength={10}
                    className="w-full px-3 py-2 text-xs border border-[#E2E8F0] rounded-xl font-mono focus:outline-none focus:ring-2 focus:ring-[#16A34A]/20"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-[#374151] mb-1">{t('stock.categories.formDesc')}</label>
                <textarea
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  rows={2}
                  placeholder="Description de la catégorie…"
                  className="w-full px-3 py-2 text-xs border border-[#E2E8F0] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#16A34A]/20 resize-none"
                />
              </div>

              {/* Icône */}
              <div>
                <label className="block text-[11px] font-semibold text-[#374151] mb-1">Icône</label>
                <div className="flex flex-wrap gap-2">
                  {ICONES.map(ic => (
                    <button key={ic} onClick={() => setForm(f => ({ ...f, icone: ic }))}
                      className={`w-8 h-8 rounded-lg text-sm flex items-center justify-center transition-all ${
                        form.icone === ic ? 'ring-2 ring-[#16A34A] bg-[#F0FDF4]' : 'hover:bg-[#F1F5F9]'
                      }`}>
                      {ic}
                    </button>
                  ))}
                </div>
              </div>

              {/* Couleur */}
              <div>
                <label className="block text-[11px] font-semibold text-[#374151] mb-1">Couleur</label>
                <div className="flex flex-wrap gap-2">
                  {COULEURS.map(col => (
                    <button key={col} onClick={() => setForm(f => ({ ...f, couleur: col }))}
                      className={`w-7 h-7 rounded-full transition-transform hover:scale-110 ${
                        form.couleur === col ? 'ring-2 ring-offset-2 ring-[#0F172A] scale-110' : ''
                      }`}
                      style={{ background: col }} />
                  ))}
                </div>
              </div>

              {/* Parent */}
              <div>
                <label className="block text-[11px] font-semibold text-[#374151] mb-1">Catégorie parente</label>
                <select
                  value={form.parent_id}
                  onChange={e => setForm(f => ({ ...f, parent_id: e.target.value }))}
                  className="w-full px-3 py-2 text-xs border border-[#E2E8F0] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#16A34A]/20">
                  <option value="">— Aucune (catégorie principale) —</option>
                  {categories
                    .filter(c => !c.parent_id && c.id !== editTarget?.id)
                    .map(c => (
                      <option key={c.id} value={c.id}>{c.icone} {c.nom}</option>
                    ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-[#374151] mb-1">Ordre d'affichage</label>
                  <input
                    type="number"
                    min={0}
                    value={form.ordre}
                    onChange={e => setForm(f => ({ ...f, ordre: Number(e.target.value) }))}
                    className="w-full px-3 py-2 text-xs border border-[#E2E8F0] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#16A34A]/20"
                  />
                </div>
                <div className="flex items-end pb-1">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <div
                      onClick={() => setForm(f => ({ ...f, actif: !f.actif }))}
                      className={`w-9 h-5 rounded-full transition-colors relative ${form.actif ? 'bg-[#16A34A]' : 'bg-[#CBD5E1]'}`}>
                      <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${form.actif ? 'translate-x-4' : 'translate-x-0.5'}`} />
                    </div>
                    <span className="text-xs text-[#374151]">Active</span>
                  </label>
                </div>
              </div>

              {/* Preview */}
              <div className="border border-[#E2E8F0] rounded-xl p-3 bg-[#F8FAFC]">
                <p className="text-[10px] text-[#94A3B8] mb-2">{t('common.preview')}</p>
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center text-sm"
                    style={{ background: form.couleur + '20' }}>
                    {form.icone}
                  </div>
                  <div>
                    <p className="text-xs font-bold text-[#0F172A]">{form.nom || 'Nom de la catégorie'}</p>
                    <span className="text-[10px] font-mono bg-white border border-[#E2E8F0] text-[#64748B] px-1.5 py-0.5 rounded">
                      {form.code || 'CODE'}
                    </span>
                  </div>
                  <div className="ml-auto w-3 h-3 rounded-full" style={{ background: form.couleur }} />
                </div>
              </div>
            </div>

            <div className="flex gap-2 p-5 border-t border-[#E2E8F0]">
              <button onClick={() => setShowModal(false)}
                className="flex-1 px-4 py-2 border border-[#E2E8F0] text-[#374151] text-xs font-semibold rounded-xl hover:bg-[#F8FAFC] transition-colors">
                Annuler
              </button>
              <button onClick={handleSave} disabled={saving}
                className="flex-1 flex items-center justify-center gap-1.5 bg-[#16A34A] text-white px-4 py-2 rounded-xl text-xs font-semibold hover:bg-[#15803D] disabled:opacity-50 transition-colors">
                <Save size={13} />
                {saving ? 'Sauvegarde…' : (editTarget ? 'Modifier' : 'Créer')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl p-6 text-center">
            <div className="w-12 h-12 bg-[#FEF2F2] rounded-full flex items-center justify-center mx-auto mb-3">
              <Trash2 size={20} className="text-[#DC2626]" />
            </div>
            <h3 className="text-sm font-bold text-[#0F172A] mb-1">{t('stock.categories.deleteConfirm')}</h3>
            <p className="text-xs text-[#64748B] mb-4">
              {t('stock.categories.deleteConfirm')} <strong>{deleteTarget.nom}</strong> ?
              {deleteTarget.nb_produits ? ` ${deleteTarget.nb_produits} produit(s) seront sans catégorie.` : ''}
            </p>
            <div className="flex gap-2">
              <button onClick={() => setDeleteTarget(null)}
                className="flex-1 px-4 py-2 border border-[#E2E8F0] text-[#374151] text-xs font-semibold rounded-xl hover:bg-[#F8FAFC]">
                Annuler
              </button>
              <button onClick={handleDelete} disabled={saving}
                className="flex-1 px-4 py-2 bg-[#DC2626] text-white text-xs font-semibold rounded-xl hover:bg-[#B91C1C] disabled:opacity-50">
                {saving ? 'Suppression…' : 'Supprimer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

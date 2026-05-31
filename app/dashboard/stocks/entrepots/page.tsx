'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useTenant } from '@/lib/hooks/useTenant'
import { useLocale } from '@/lib/hooks/useLocale'
import { fmtFCFA } from '@/lib/admin-config'
import {
  Warehouse, Plus, Edit2, Trash2, X, Save, Search,
  MapPin, User, Phone, Package, TrendingUp, AlertTriangle,
  ToggleLeft, ToggleRight, Building2, ArrowLeftRight
} from 'lucide-react'

interface Entrepot {
  id: string
  tenant_id: string
  nom: string
  code: string
  adresse: string | null
  ville: string | null
  responsable: string | null
  telephone: string | null
  capacite_max: number | null
  actif: boolean
  created_at: string
  // computed
  nb_produits?: number
  valeur_stock?: number
  produits_faibles?: number
  taux_occupation?: number
}

const EMPTY_FORM = {
  nom: '',
  code: '',
  adresse: '',
  ville: '',
  responsable: '',
  telephone: '',
  capacite_max: '',
  actif: true,
}

export default function EntrepotsPage() {

  const { tenantId } = useTenant()
  const { t } = useLocale()

  const [entrepots, setEntrepots] = useState<Entrepot[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editTarget, setEditTarget] = useState<Entrepot | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Entrepot | null>(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    if (!tenantId) return
    setLoading(true)
    try {
      const { data: wares, error: e1 } = await supabase
        .from('warehouses')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('nom', { ascending: true })

      if (e1?.code === '42P01') { setEntrepots([]); setLoading(false); return }

      const { data: movements } = await supabase
        .from('stock_movements')
        .select('warehouse_id, quantity, type')
        .eq('tenant_id', tenantId)

      const { data: prods } = await supabase
        .from('products')
        .select('id, stock_actuel, prix_achat, seuil_alerte')
        .eq('tenant_id', tenantId)

      // Compute stock per warehouse using movements
      const list = (wares || []).map((w: Entrepot) => {
        const wmovs = (movements || []).filter((m: any) => m.warehouse_id === w.id)
        const stockQty = wmovs.reduce((s: number, m: any) => {
          if (m.type === 'entree' || m.type === 'reception') return s + (m.quantity || 0)
          if (m.type === 'sortie') return s - (m.quantity || 0)
          return s
        }, 0)

        // simplified: use global prods for now
        const nb_produits = (prods || []).length
        const valeur_stock = (prods || []).reduce((s: number, p: any) => s + (p.stock_actuel || 0) * (p.prix_achat || 0), 0) / Math.max((wares || []).length, 1)
        const produits_faibles = (prods || []).filter((p: any) => (p.stock_actuel || 0) <= (p.seuil_alerte || 0)).length
        const taux_occupation = w.capacite_max ? Math.min(100, Math.round((stockQty / w.capacite_max) * 100)) : undefined

        return { ...w, nb_produits, valeur_stock, produits_faibles, taux_occupation }
      })

      setEntrepots(list)
    } catch { setEntrepots([]) }
    setLoading(false)
  }, [tenantId, supabase])

  useEffect(() => { load() }, [load])

  const openCreate = () => {
    setEditTarget(null)
    setForm(EMPTY_FORM)
    setError('')
    setShowModal(true)
  }

  const openEdit = (e: Entrepot) => {
    setEditTarget(e)
    setForm({
      nom: e.nom,
      code: e.code,
      adresse: e.adresse || '',
      ville: e.ville || '',
      responsable: e.responsable || '',
      telephone: e.telephone || '',
      capacite_max: e.capacite_max?.toString() || '',
      actif: e.actif,
    })
    setError('')
    setShowModal(true)
  }

  const handleSave = async () => {
    if (!tenantId || !form.nom.trim()) { setError('Le nom est obligatoire'); return }
    setSaving(true)
    setError('')
    const code = form.code.trim() || form.nom.slice(0, 4).toUpperCase().replace(/\s/g, 'X')

    try {
      const payload: any = {
        nom: form.nom.trim(),
        code: code,
        adresse: form.adresse.trim() || null,
        ville: form.ville.trim() || null,
        responsable: form.responsable.trim() || null,
        telephone: form.telephone.trim() || null,
        capacite_max: form.capacite_max ? Number(form.capacite_max) : null,
        actif: form.actif,
      }
      if (editTarget) {
        const { error: e } = await supabase.from('warehouses').update(payload)
          .eq('id', editTarget.id).eq('tenant_id', tenantId)
        if (e) throw e
      } else {
        const { error: e } = await supabase.from('warehouses').insert({ ...payload, tenant_id: tenantId })
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
      await supabase.from('warehouses').delete().eq('id', deleteTarget.id).eq('tenant_id', tenantId)
      setDeleteTarget(null)
      await load()
    } catch (e: any) { alert(e.message) }
    setSaving(false)
  }

  const toggleActif = async (w: Entrepot) => {
    if (!tenantId) return
    await supabase.from('warehouses').update({ actif: !w.actif }).eq('id', w.id).eq('tenant_id', tenantId)
    await load()
  }

  const filtered = entrepots.filter(e =>
    e.nom.toLowerCase().includes(search.toLowerCase()) ||
    e.code.toLowerCase().includes(search.toLowerCase()) ||
    (e.ville || '').toLowerCase().includes(search.toLowerCase())
  )

  const actifs = entrepots.filter(e => e.actif)
  const totalValeur = entrepots.reduce((s, e) => s + (e.valeur_stock || 0), 0)

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-[#0F172A] flex items-center gap-2">
            <Warehouse size={20} className="text-[#16A34A]" />
            {t('stock.entrepots.title')}
          </h1>
          <p className="text-xs text-[#64748B] mt-0.5">{t('stock.entrepots.subtitle')}</p>
        </div>
        <button onClick={openCreate}
          className="flex items-center gap-1.5 bg-[#16A34A] text-white px-4 py-2 rounded-xl text-xs font-semibold hover:bg-[#15803D] transition-colors">
          <Plus size={14} /> {t('stock.entrepots.new')}
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: t('stock.entrepots.title'), value: entrepots.length, icon: Warehouse, color: '#16A34A', bg: '#F0FDF4' },
          { label: t('stock.entrepots.colNom'), value: actifs.length, icon: Building2, color: '#2563EB', bg: '#EFF6FF' },
          { label: t('stock.entrepots.colValeur'), value: fmtFCFA(totalValeur), icon: TrendingUp, color: '#D97706', bg: '#FFFBEB' },
          { label: t('stock.transferts.title'), value: actifs.length >= 2 ? 'Oui' : 'Non', icon: ArrowLeftRight, color: actifs.length >= 2 ? '#16A34A' : '#DC2626', bg: '#F8FAFC' },
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
            placeholder={t('stock.entrepots.searchPlh')}
            className="w-full pl-8 pr-3 py-2 text-xs border border-[#E2E8F0] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#16A34A]/20" />
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center py-20 text-[#64748B] text-sm">{t('common.loading')}</div>
      ) : entrepots.length === 0 ? (
        <div className="bg-white border border-[#E2E8F0] rounded-2xl p-12 text-center">
          <Warehouse size={40} className="mx-auto text-[#CBD5E1] mb-3" />
          <p className="text-sm font-semibold text-[#0F172A]">{t('stock.entrepots.empty')}</p>
          <p className="text-xs text-[#64748B] mt-1">Créez votre premier entrepôt pour commencer le suivi multi-sites</p>
          <button onClick={openCreate}
            className="mt-4 bg-[#16A34A] text-white px-4 py-2 rounded-xl text-xs font-semibold hover:bg-[#15803D] transition-colors">
            {t('stock.entrepots.new')}
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(w => (
            <div key={w.id}
              className={`bg-white border rounded-2xl overflow-hidden hover:shadow-sm transition-all ${
                w.actif ? 'border-[#E2E8F0]' : 'border-[#E2E8F0] opacity-60'
              }`}>
              <div className={`h-1.5 w-full ${w.actif ? 'bg-[#16A34A]' : 'bg-[#CBD5E1]'}`} />
              <div className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${w.actif ? 'bg-[#F0FDF4]' : 'bg-[#F1F5F9]'}`}>
                        <Warehouse size={16} className={w.actif ? 'text-[#16A34A]' : 'text-[#94A3B8]'} />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-[#0F172A]">{w.nom}</p>
                        <span className="text-[10px] font-mono bg-[#F1F5F9] text-[#64748B] px-1.5 py-0.5 rounded">{w.code}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => toggleActif(w)} className="text-[#94A3B8] hover:text-[#16A34A] transition-colors">
                      {w.actif ? <ToggleRight size={18} className="text-[#16A34A]" /> : <ToggleLeft size={18} />}
                    </button>
                    <button onClick={() => openEdit(w)} className="p-1.5 rounded-lg hover:bg-[#EFF6FF] text-[#2563EB]">
                      <Edit2 size={12} />
                    </button>
                    <button onClick={() => setDeleteTarget(w)} className="p-1.5 rounded-lg hover:bg-[#FEF2F2] text-[#DC2626]">
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>

                {/* Location */}
                {(w.adresse || w.ville) && (
                  <div className="flex items-start gap-1 mb-2">
                    <MapPin size={11} className="text-[#94A3B8] mt-0.5 shrink-0" />
                    <p className="text-[11px] text-[#64748B]">
                      {[w.adresse, w.ville].filter(Boolean).join(', ')}
                    </p>
                  </div>
                )}
                {w.responsable && (
                  <div className="flex items-center gap-1 mb-1">
                    <User size={11} className="text-[#94A3B8]" />
                    <p className="text-[11px] text-[#64748B]">{w.responsable}</p>
                  </div>
                )}
                {w.telephone && (
                  <div className="flex items-center gap-1 mb-3">
                    <Phone size={11} className="text-[#94A3B8]" />
                    <p className="text-[11px] text-[#64748B]">{w.telephone}</p>
                  </div>
                )}

                {/* Stats */}
                <div className="grid grid-cols-3 gap-2 text-center border-t border-[#F1F5F9] pt-3">
                  <div>
                    <p className="text-sm font-bold text-[#0F172A]">{w.nb_produits}</p>
                    <p className="text-[10px] text-[#94A3B8]">Produits</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-[#0F172A] truncate">{fmtFCFA(w.valeur_stock || 0)}</p>
                    <p className="text-[10px] text-[#94A3B8]">Valeur</p>
                  </div>
                  <div>
                    <p className="text-sm font-bold text-[#DC2626]">{w.produits_faibles}</p>
                    <p className="text-[10px] text-[#94A3B8]">Faibles</p>
                  </div>
                </div>

                {/* Capacity bar */}
                {w.capacite_max && w.taux_occupation !== null && (
                  <div className="mt-3 pt-2 border-t border-[#F1F5F9]">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-[10px] text-[#94A3B8]">Occupation</span>
                      <span className="text-[10px] font-semibold text-[#0F172A]">{w.taux_occupation}%</span>
                    </div>
                    <div className="h-1.5 bg-[#F1F5F9] rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          (w.taux_occupation || 0) > 80 ? 'bg-[#DC2626]' :
                          (w.taux_occupation || 0) > 60 ? 'bg-[#D97706]' : 'bg-[#16A34A]'
                        }`}
                        style={{ width: `${w.taux_occupation}%` }} />
                    </div>
                    <p className="text-[10px] text-[#94A3B8] mt-0.5">
                      Capacité max: {w.capacite_max.toLocaleString()} unités
                    </p>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-[#E2E8F0]">
              <h2 className="text-sm font-bold text-[#0F172A]">
                {editTarget ? 'Modifier l\'entrepôt' : 'Nouvel entrepôt'}
              </h2>
              <button onClick={() => setShowModal(false)} className="text-[#94A3B8] hover:text-[#0F172A]">
                <X size={16} />
              </button>
            </div>
            <div className="p-5 space-y-4">
              {error && (
                <div className="bg-[#FEF2F2] border border-[#FCA5A5] text-[#DC2626] text-xs p-3 rounded-xl">{error}</div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-[#374151] mb-1">Nom *</label>
                  <input value={form.nom}
                    onChange={e => setForm(f => ({ ...f, nom: e.target.value, code: f.code || e.target.value.slice(0, 4).toUpperCase() }))}
                    placeholder="Entrepôt Central"
                    className="w-full px-3 py-2 text-xs border border-[#E2E8F0] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#16A34A]/20" />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-[#374151] mb-1">Code</label>
                  <input value={form.code}
                    onChange={e => setForm(f => ({ ...f, code: e.target.value.toUpperCase() }))}
                    placeholder="ENTR"
                    className="w-full px-3 py-2 text-xs border border-[#E2E8F0] rounded-xl font-mono focus:outline-none focus:ring-2 focus:ring-[#16A34A]/20" />
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-[#374151] mb-1">{t('common.address')}</label>
                <input value={form.adresse}
                  onChange={e => setForm(f => ({ ...f, adresse: e.target.value }))}
                  placeholder="123 Rue du Commerce"
                  className="w-full px-3 py-2 text-xs border border-[#E2E8F0] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#16A34A]/20" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-[#374151] mb-1">Ville</label>
                  <input value={form.ville}
                    onChange={e => setForm(f => ({ ...f, ville: e.target.value }))}
                    placeholder="Kinshasa"
                    className="w-full px-3 py-2 text-xs border border-[#E2E8F0] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#16A34A]/20" />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-[#374151] mb-1">{t('common.phone')}</label>
                  <input value={form.telephone}
                    onChange={e => setForm(f => ({ ...f, telephone: e.target.value }))}
                    placeholder="+243 …"
                    className="w-full px-3 py-2 text-xs border border-[#E2E8F0] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#16A34A]/20" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-[#374151] mb-1">Responsable</label>
                  <input value={form.responsable}
                    onChange={e => setForm(f => ({ ...f, responsable: e.target.value }))}
                    placeholder="Nom du responsable"
                    className="w-full px-3 py-2 text-xs border border-[#E2E8F0] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#16A34A]/20" />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-[#374151] mb-1">Capacité max (unités)</label>
                  <input type="number" min={0} value={form.capacite_max}
                    onChange={e => setForm(f => ({ ...f, capacite_max: e.target.value }))}
                    placeholder="10000"
                    className="w-full px-3 py-2 text-xs border border-[#E2E8F0] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#16A34A]/20" />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div onClick={() => setForm(f => ({ ...f, actif: !f.actif }))}
                  className={`w-9 h-5 rounded-full transition-colors relative cursor-pointer ${form.actif ? 'bg-[#16A34A]' : 'bg-[#CBD5E1]'}`}>
                  <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${form.actif ? 'translate-x-4' : 'translate-x-0.5'}`} />
                </div>
                <span className="text-xs text-[#374151]">Entrepôt actif</span>
              </div>
            </div>
            <div className="flex gap-2 p-5 border-t border-[#E2E8F0]">
              <button onClick={() => setShowModal(false)}
                className="flex-1 px-4 py-2 border border-[#E2E8F0] text-[#374151] text-xs font-semibold rounded-xl hover:bg-[#F8FAFC]">
                Annuler
              </button>
              <button onClick={handleSave} disabled={saving}
                className="flex-1 flex items-center justify-center gap-1.5 bg-[#16A34A] text-white px-4 py-2 rounded-xl text-xs font-semibold hover:bg-[#15803D] disabled:opacity-50">
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
            <h3 className="text-sm font-bold text-[#0F172A] mb-1">Supprimer l'entrepôt</h3>
            <p className="text-xs text-[#64748B] mb-4">
              Supprimer <strong>{deleteTarget.nom}</strong> ? Tous les mouvements associés seront conservés.
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

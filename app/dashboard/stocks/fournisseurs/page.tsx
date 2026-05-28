'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useTenant } from '@/lib/hooks/useTenant'
import { useLocale } from '@/lib/hooks/useLocale'
import { fmtFCFA } from '@/lib/admin-config'
import {
  Users2, Plus, Edit2, Trash2, X, Save, Search,
  Phone, Mail, MapPin, Globe, Star, Package,
  TrendingUp, FileText, Building2, CreditCard
} from 'lucide-react'

interface Fournisseur {
  id: string
  tenant_id: string
  nom: string
  code: string
  contact_nom: string | null
  telephone: string | null
  email: string | null
  adresse: string | null
  ville: string | null
  pays: string | null
  site_web: string | null
  conditions_paiement: string | null
  delai_livraison: number | null
  note: number | null
  actif: boolean
  created_at: string
  // computed
  nb_commandes?: number
  total_achats?: number
  nb_produits?: number
}

const EMPTY_FORM = {
  nom: '',
  code: '',
  contact_nom: '',
  telephone: '',
  email: '',
  adresse: '',
  ville: '',
  pays: 'Congo (RDC)',
  site_web: '',
  conditions_paiement: '30 jours',
  delai_livraison: '7',
  note: '3',
  actif: true,
}

const CONDITIONS = ['Comptant', '7 jours', '15 jours', '30 jours', '45 jours', '60 jours', '90 jours', 'Sur commande']

export default function FournisseursPage() {

  const { tenantId } = useTenant()
  const { t } = useLocale()

  const [fournisseurs, setFournisseurs] = useState<Fournisseur[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editTarget, setEditTarget] = useState<Fournisseur | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Fournisseur | null>(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    if (!tenantId) return
    setLoading(true)
    try {
      const { data: fours, error: e1 } = await supabase
        .from('suppliers')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('nom', { ascending: true })

      if (e1?.code === '42P01') { setFournisseurs([]); setLoading(false); return }

      const { data: achats } = await supabase
        .from('purchases')
        .select('supplier_id, total_amount')
        .eq('tenant_id', tenantId)

      const { data: prods } = await supabase
        .from('products')
        .select('fournisseur_id')
        .eq('tenant_id', tenantId)

      const list = (fours || []).map((f: Fournisseur) => {
        const fAchats = (achats || []).filter((a: any) => a.supplier_id === f.id)
        const fProds = (prods || []).filter((p: any) => p.fournisseur_id === f.id)
        return {
          ...f,
          nb_commandes: fAchats.length,
          total_achats: fAchats.reduce((s: number, a: any) => s + (a.total_amount || 0), 0),
          nb_produits: fProds.length,
        }
      })

      setFournisseurs(list)
    } catch { setFournisseurs([]) }
    setLoading(false)
  }, [tenantId, supabase])

  useEffect(() => { load() }, [load])

  const openCreate = () => {
    setEditTarget(null)
    setForm(EMPTY_FORM)
    setError('')
    setShowModal(true)
  }

  const openEdit = (f: Fournisseur) => {
    setEditTarget(f)
    setForm({
      nom: f.nom,
      code: f.code || '',
      contact_nom: f.contact_nom || '',
      telephone: f.telephone || '',
      email: f.email || '',
      adresse: f.adresse || '',
      ville: f.ville || '',
      pays: f.pays || 'Congo (RDC)',
      site_web: f.site_web || '',
      conditions_paiement: f.conditions_paiement || '30 jours',
      delai_livraison: f.delai_livraison?.toString() || '7',
      note: f.note?.toString() || '3',
      actif: f.actif,
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
        code,
        contact_nom: form.contact_nom.trim() || null,
        telephone: form.telephone.trim() || null,
        email: form.email.trim() || null,
        adresse: form.adresse.trim() || null,
        ville: form.ville.trim() || null,
        pays: form.pays.trim() || null,
        site_web: form.site_web.trim() || null,
        conditions_paiement: form.conditions_paiement,
        delai_livraison: form.delai_livraison ? Number(form.delai_livraison) : null,
        note: form.note ? Number(form.note) : null,
        actif: form.actif,
      }
      if (editTarget) {
        const { error: e } = await supabase.from('suppliers').update(payload)
          .eq('id', editTarget.id).eq('tenant_id', tenantId)
        if (e) throw e
      } else {
        const { error: e } = await supabase.from('suppliers').insert({ ...payload, tenant_id: tenantId })
        if (e) throw e
      }
      setShowModal(false)
      await load()
    } catch (e: any) { setError(e.message || 'Erreur') }
    setSaving(false)
  }

  const handleDelete = async () => {
    if (!deleteTarget || !tenantId) return
    setSaving(true)
    await supabase.from('suppliers').delete().eq('id', deleteTarget.id).eq('tenant_id', tenantId)
    setDeleteTarget(null)
    setSaving(false)
    await load()
  }

  const filtered = fournisseurs.filter(f =>
    f.nom.toLowerCase().includes(search.toLowerCase()) ||
    (f.contact_nom || '').toLowerCase().includes(search.toLowerCase()) ||
    (f.code || '').toLowerCase().includes(search.toLowerCase()) ||
    (f.ville || '').toLowerCase().includes(search.toLowerCase())
  )

  const totalAchats = fournisseurs.reduce((s, f) => s + (f.total_achats || 0), 0)
  const actifs = fournisseurs.filter(f => f.actif).length

  const renderStars = (note: number | null) => {
    if (!note) return null
    return (
      <div className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map(i => (
          <Star key={i} size={10} className={i <= note ? 'text-[#F59E0B] fill-[#F59E0B]' : 'text-[#CBD5E1]'} />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-[#0F172A] flex items-center gap-2">
            <Users2 size={20} className="text-[#16A34A]" />
            {t('stock.fournisseurs.title')}
          </h1>
          <p className="text-xs text-[#64748B] mt-0.5">{t('stock.fournisseurs.subtitle')}</p>
        </div>
        <button onClick={openCreate}
          className="flex items-center gap-1.5 bg-[#16A34A] text-white px-4 py-2 rounded-xl text-xs font-semibold hover:bg-[#15803D] transition-colors">
          <Plus size={14} /> {t('stock.fournisseurs.new')}
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: t('stock.fournisseurs.title'), value: fournisseurs.length, icon: Users2, color: '#16A34A', bg: '#F0FDF4' },
          { label: t('stock.fournisseurs.colNom'), value: actifs, icon: Building2, color: '#2563EB', bg: '#EFF6FF' },
          { label: t('stock.page.colValeur'), value: fmtFCFA(totalAchats), icon: TrendingUp, color: '#D97706', bg: '#FFFBEB' },
          { label: t('stock.mouvements.title'), value: fournisseurs.reduce((s, f) => s + (f.nb_commandes || 0), 0), icon: FileText, color: '#7C3AED', bg: '#F5F3FF' },
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
            placeholder={t('stock.fournisseurs.searchPlh')}
            className="w-full pl-8 pr-3 py-2 text-xs border border-[#E2E8F0] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#16A34A]/20" />
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-20 text-sm text-[#64748B]">{t('common.loading')}</div>
      ) : (
        <div className="bg-white border border-[#E2E8F0] rounded-2xl overflow-hidden">
          {filtered.length === 0 ? (
            <div className="p-12 text-center">
              <Users2 size={40} className="mx-auto text-[#CBD5E1] mb-3" />
              <p className="text-sm font-semibold text-[#0F172A]">{t('stock.fournisseurs.empty')}</p>
              <button onClick={openCreate}
                className="mt-4 bg-[#16A34A] text-white px-4 py-2 rounded-xl text-xs font-semibold hover:bg-[#15803D] transition-colors">
                {t('stock.fournisseurs.new')}
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[#F1F5F9] bg-[#F8FAFC]">
                    <th className="text-left px-4 py-3 text-[11px] font-semibold text-[#64748B]">{t('stock.fournisseurs.colNom')}</th>
                    <th className="text-left px-4 py-3 text-[11px] font-semibold text-[#64748B]">{t('stock.fournisseurs.colContact')}</th>
                    <th className="text-left px-4 py-3 text-[11px] font-semibold text-[#64748B]">{t('stock.entrepots.colAdresse')}</th>
                    <th className="text-left px-4 py-3 text-[11px] font-semibold text-[#64748B]">{t('stock.fournisseurs.colDelai')}</th>
                    <th className="text-right px-4 py-3 text-[11px] font-semibold text-[#64748B]">{t('stock.mouvements.title')}</th>
                    <th className="text-right px-4 py-3 text-[11px] font-semibold text-[#64748B]">{t('stock.page.colValeur')}</th>
                    <th className="text-center px-4 py-3 text-[11px] font-semibold text-[#64748B]">Note</th>
                    <th className="text-center px-4 py-3 text-[11px] font-semibold text-[#64748B]">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(f => (
                    <tr key={f.id} className="border-b border-[#F8FAFC] hover:bg-[#FAFAFA] transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-lg bg-[#F0FDF4] flex items-center justify-center">
                            <Building2 size={14} className="text-[#16A34A]" />
                          </div>
                          <div>
                            <p className="text-xs font-bold text-[#0F172A]">{f.nom}</p>
                            <span className="text-[10px] font-mono text-[#94A3B8]">{f.code}</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {f.contact_nom && <p className="text-xs text-[#0F172A]">{f.contact_nom}</p>}
                        {f.telephone && (
                          <p className="flex items-center gap-1 text-[11px] text-[#64748B]">
                            <Phone size={10} /> {f.telephone}
                          </p>
                        )}
                        {f.email && (
                          <p className="flex items-center gap-1 text-[11px] text-[#64748B]">
                            <Mail size={10} /> {f.email}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-[11px] text-[#64748B]">
                        {f.ville && <p className="flex items-center gap-1"><MapPin size={10} />{f.ville}</p>}
                        {f.pays && <p className="text-[10px] text-[#94A3B8]">{f.pays}</p>}
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-xs text-[#0F172A]">{f.conditions_paiement}</p>
                        {f.delai_livraison && (
                          <p className="text-[11px] text-[#64748B]">Livraison: {f.delai_livraison}j</p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <p className="text-xs font-bold text-[#0F172A]">{f.nb_commandes}</p>
                        <p className="text-[10px] text-[#94A3B8]">{f.nb_produits} produits</p>
                      </td>
                      <td className="px-4 py-3 text-right text-xs font-bold text-[#0F172A]">
                        {fmtFCFA(f.total_achats || 0)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {renderStars(f.note)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-1">
                          <button onClick={() => openEdit(f)}
                            className="p-1.5 rounded-lg hover:bg-[#EFF6FF] text-[#2563EB]">
                            <Edit2 size={12} />
                          </button>
                          <button onClick={() => setDeleteTarget(f)}
                            className="p-1.5 rounded-lg hover:bg-[#FEF2F2] text-[#DC2626]">
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-[#E2E8F0]">
              <h2 className="text-sm font-bold text-[#0F172A]">
                {editTarget ? t('stock.fournisseurs.modalTitle') : t('stock.fournisseurs.new')}
              </h2>
              <button onClick={() => setShowModal(false)}><X size={16} className="text-[#94A3B8]" /></button>
            </div>
            <div className="p-5 space-y-4">
              {error && <div className="bg-[#FEF2F2] border border-[#FCA5A5] text-[#DC2626] text-xs p-3 rounded-xl">{error}</div>}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-[#374151] mb-1">Nom *</label>
                  <input value={form.nom} onChange={e => setForm(f => ({ ...f, nom: e.target.value }))}
                    placeholder="Nom du fournisseur"
                    className="w-full px-3 py-2 text-xs border border-[#E2E8F0] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#16A34A]/20" />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-[#374151] mb-1">Code</label>
                  <input value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value.toUpperCase() }))}
                    placeholder="FOUR" className="w-full px-3 py-2 text-xs border border-[#E2E8F0] rounded-xl font-mono focus:outline-none focus:ring-2 focus:ring-[#16A34A]/20" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-[#374151] mb-1">Nom du contact</label>
                  <input value={form.contact_nom} onChange={e => setForm(f => ({ ...f, contact_nom: e.target.value }))}
                    placeholder="Jean Dupont"
                    className="w-full px-3 py-2 text-xs border border-[#E2E8F0] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#16A34A]/20" />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-[#374151] mb-1">Téléphone</label>
                  <input value={form.telephone} onChange={e => setForm(f => ({ ...f, telephone: e.target.value }))}
                    placeholder="+243 …"
                    className="w-full px-3 py-2 text-xs border border-[#E2E8F0] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#16A34A]/20" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-[#374151] mb-1">Email</label>
                  <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                    placeholder="contact@fournisseur.com"
                    className="w-full px-3 py-2 text-xs border border-[#E2E8F0] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#16A34A]/20" />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-[#374151] mb-1">Site web</label>
                  <input value={form.site_web} onChange={e => setForm(f => ({ ...f, site_web: e.target.value }))}
                    placeholder="https://…"
                    className="w-full px-3 py-2 text-xs border border-[#E2E8F0] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#16A34A]/20" />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-[#374151] mb-1">Adresse</label>
                <input value={form.adresse} onChange={e => setForm(f => ({ ...f, adresse: e.target.value }))}
                  placeholder="Adresse complète"
                  className="w-full px-3 py-2 text-xs border border-[#E2E8F0] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#16A34A]/20" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-[#374151] mb-1">Ville</label>
                  <input value={form.ville} onChange={e => setForm(f => ({ ...f, ville: e.target.value }))}
                    placeholder="Kinshasa"
                    className="w-full px-3 py-2 text-xs border border-[#E2E8F0] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#16A34A]/20" />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-[#374151] mb-1">Pays</label>
                  <input value={form.pays} onChange={e => setForm(f => ({ ...f, pays: e.target.value }))}
                    placeholder="Congo (RDC)"
                    className="w-full px-3 py-2 text-xs border border-[#E2E8F0] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#16A34A]/20" />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-[#374151] mb-1">Conditions paiement</label>
                  <select value={form.conditions_paiement} onChange={e => setForm(f => ({ ...f, conditions_paiement: e.target.value }))}
                    className="w-full px-3 py-2 text-xs border border-[#E2E8F0] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#16A34A]/20">
                    {CONDITIONS.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-[#374151] mb-1">Délai livraison (jours)</label>
                  <input type="number" min={0} value={form.delai_livraison}
                    onChange={e => setForm(f => ({ ...f, delai_livraison: e.target.value }))}
                    className="w-full px-3 py-2 text-xs border border-[#E2E8F0] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#16A34A]/20" />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-[#374151] mb-1">Note (1-5)</label>
                  <select value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
                    className="w-full px-3 py-2 text-xs border border-[#E2E8F0] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#16A34A]/20">
                    {[1, 2, 3, 4, 5].map(n => <option key={n} value={n}>{'⭐'.repeat(n)} ({n}/5)</option>)}
                  </select>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <div onClick={() => setForm(f => ({ ...f, actif: !f.actif }))}
                  className={`w-9 h-5 rounded-full transition-colors relative cursor-pointer ${form.actif ? 'bg-[#16A34A]' : 'bg-[#CBD5E1]'}`}>
                  <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${form.actif ? 'translate-x-4' : 'translate-x-0.5'}`} />
                </div>
                <span className="text-xs text-[#374151]">Fournisseur actif</span>
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
            <h3 className="text-sm font-bold text-[#0F172A] mb-1">Supprimer le fournisseur</h3>
            <p className="text-xs text-[#64748B] mb-4">
              Supprimer <strong>{deleteTarget.nom}</strong> ? Les commandes associées seront conservées.
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

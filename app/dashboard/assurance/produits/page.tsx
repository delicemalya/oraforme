'use client'

import { useState, useEffect, useCallback } from 'react'
import { useTenantContext } from '@/lib/contexts/TenantContext'
import { Package, Plus, RefreshCw, X, CheckCircle2, Search } from 'lucide-react'
import { supabase } from '@/lib/supabase'

interface Produit {
  id: string
  nom_produit: string
  type_police: string
  description: string
  prime_base: number
  franchise_defaut: number
  duree_mois: number
  garanties: string[]
  exclusions: string[]
  actif: boolean
  created_at: string
}

const TYPES_POLICE = [
  { value: 'auto', label: 'Auto' }, { value: 'vie', label: 'Vie' },
  { value: 'habitation', label: 'Habitation' }, { value: 'sante', label: 'Santé' },
  { value: 'responsabilite_civile', label: 'RC' }, { value: 'transport', label: 'Transport' },
  { value: 'agricole', label: 'Agricole' }, { value: 'maritime', label: 'Maritime' },
  { value: 'aviation', label: 'Aviation' }, { value: 'voyage', label: 'Voyage' },
  { value: 'incendie', label: 'Incendie' },
]

const fmt = (n: number) => new Intl.NumberFormat('fr-FR').format(Math.round(n))

const TYPE_COLORS: Record<string, string> = {
  auto:'bg-blue-100 text-blue-700', vie:'bg-purple-100 text-purple-700',
  habitation:'bg-green-100 text-green-700', sante:'bg-red-100 text-red-700',
  responsabilite_civile:'bg-orange-100 text-orange-700', transport:'bg-teal-100 text-teal-700',
  agricole:'bg-lime-100 text-lime-700', maritime:'bg-cyan-100 text-cyan-700',
  aviation:'bg-sky-100 text-sky-700', voyage:'bg-pink-100 text-pink-700',
  incendie:'bg-amber-100 text-amber-700',
}

const EMPTY = { nom_produit: '', type_police: 'auto', description: '', prime_base: 0, franchise_defaut: 0, duree_mois: 12, garanties: [] as string[], exclusions: [] as string[], actif: true }

export default function ProduitsPage() {
  const { tenant } = useTenantContext()
  const tenantId = tenant?.tenantId ?? ''
  const [produits, setProduits] = useState<Produit[]>([])
  const [loading,  setLoading]  = useState(true)
  const [saving,   setSaving]   = useState(false)
  const [search,   setSearch]   = useState('')
  const [showModal,setShowModal]= useState(false)
  const [editing,  setEditing]  = useState<Produit | null>(null)
  const [form,     setForm]     = useState({ ...EMPTY })
  const [garNote,  setGarNote]  = useState('')
  const [excNote,  setExcNote]  = useState('')
  const [error,    setError]    = useState('')

  const load = useCallback(async () => {
    if (!tenantId) return
    setLoading(true)
    const { data } = await supabase.from('ass_produits').select('*').eq('tenant_id', tenantId).order('created_at', { ascending: false })
    setProduits(data ?? [])
    setLoading(false)
  }, [tenantId])

  useEffect(() => { load() }, [load])

  const openCreate = () => { setEditing(null); setForm({ ...EMPTY }); setGarNote(''); setExcNote(''); setError(''); setShowModal(true) }
  const openEdit   = (p: Produit) => {
    setEditing(p)
    setForm({ nom_produit: p.nom_produit, type_police: p.type_police, description: p.description ?? '', prime_base: p.prime_base, franchise_defaut: p.franchise_defaut, duree_mois: p.duree_mois, garanties: p.garanties ?? [], exclusions: p.exclusions ?? [], actif: p.actif })
    setGarNote(''); setExcNote(''); setError(''); setShowModal(true)
  }

  const handleSave = async () => {
    if (!form.nom_produit.trim()) { setError('Nom du produit requis'); return }
    if (!tenantId) return
    setSaving(true); setError('')
    const payload = { ...form, tenant_id: tenantId }
    let err
    if (editing) {
      const r = await supabase.from('ass_produits').update(payload).eq('id', editing.id).eq('tenant_id', tenantId)
      err = r.error
    } else {
      const r = await supabase.from('ass_produits').insert(payload)
      err = r.error
    }
    setSaving(false)
    if (err) { setError(err.message); return }
    setShowModal(false); load()
  }

  const toggleActif = async (id: string, actif: boolean) => {
    await supabase.from('ass_produits').update({ actif: !actif }).eq('id', id).eq('tenant_id', tenantId)
    load()
  }

  const displayed = produits.filter(p => !search || p.nom_produit.toLowerCase().includes(search.toLowerCase()))

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-black text-[#0F172A] flex items-center gap-2">
            <Package className="text-[#DC2626]" size={22} /> Catalogue produits
          </h1>
          <p className="text-sm text-[#64748B]">{produits.length} produit{produits.length !== 1 ? 's' : ''} · {produits.filter(p => p.actif).length} actifs</p>
        </div>
        <button onClick={openCreate} className="inline-flex items-center gap-1.5 bg-[#DC2626] hover:bg-[#B91C1C] text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors">
          <Plus size={15} /> Nouveau produit
        </button>
      </div>

      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher un produit..."
          className="w-full pl-9 pr-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:border-[#DC2626] outline-none" />
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? (
          <div className="col-span-full flex justify-center py-12"><RefreshCw className="animate-spin text-[#DC2626]" size={24} /></div>
        ) : displayed.length === 0 ? (
          <div className="col-span-full bg-white rounded-2xl border border-gray-100 py-16 text-center">
            <Package size={36} className="text-gray-200 mx-auto mb-3" />
            <p className="text-sm text-[#94A3B8]">Aucun produit</p>
          </div>
        ) : displayed.map(p => (
          <div key={p.id} className={`bg-white rounded-2xl border p-5 ${p.actif ? 'border-gray-100' : 'border-gray-100 opacity-60'}`}>
            <div className="flex items-start justify-between mb-3">
              <span className={`text-[11px] font-bold rounded-full px-2.5 py-0.5 ${TYPE_COLORS[p.type_police] ?? 'bg-gray-100 text-gray-700'}`}>
                {TYPES_POLICE.find(t => t.value === p.type_police)?.label ?? p.type_police}
              </span>
              <div className="flex gap-1">
                <button onClick={() => openEdit(p)} className="p-1.5 hover:bg-gray-100 rounded-lg text-[#64748B]"><Package size={13} /></button>
                <button onClick={() => toggleActif(p.id, p.actif)} className={`p-1.5 rounded-lg text-xs font-semibold ${p.actif ? 'bg-green-50 text-green-600 hover:bg-green-100' : 'bg-gray-50 text-gray-500 hover:bg-gray-100'}`}>
                  {p.actif ? 'Actif' : 'Inactif'}
                </button>
              </div>
            </div>

            <h3 className="font-black text-[#0F172A] mb-1">{p.nom_produit}</h3>
            <p className="text-xs text-[#64748B] mb-4 line-clamp-2">{p.description}</p>

            <div className="grid grid-cols-3 gap-2 mb-4">
              {[
                { label: 'Prime base', value: `${fmt(p.prime_base)} FCFA` },
                { label: 'Franchise',  value: `${fmt(p.franchise_defaut)} FCFA` },
                { label: 'Durée',      value: `${p.duree_mois} mois` },
              ].map(m => (
                <div key={m.label} className="bg-gray-50 rounded-xl p-2 text-center">
                  <div className="text-xs font-bold text-[#0F172A]">{m.value}</div>
                  <div className="text-[10px] text-[#94A3B8]">{m.label}</div>
                </div>
              ))}
            </div>

            {(p.garanties ?? []).length > 0 && (
              <div className="mb-2">
                <div className="text-[10px] font-bold text-[#64748B] uppercase tracking-wide mb-1.5">Garanties</div>
                <div className="flex flex-wrap gap-1">
                  {(p.garanties ?? []).slice(0,3).map((g, i) => (
                    <span key={i} className="text-[10px] bg-green-50 text-green-700 border border-green-100 rounded-lg px-1.5 py-0.5">{g}</span>
                  ))}
                  {(p.garanties ?? []).length > 3 && <span className="text-[10px] text-[#94A3B8]">+{(p.garanties ?? []).length - 3}</span>}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="font-black text-[#0F172A] text-base">{editing ? 'Modifier le produit' : 'Nouveau produit'}</h2>
              <button onClick={() => setShowModal(false)} className="p-2 hover:bg-gray-100 rounded-lg"><X size={16} /></button>
            </div>
            <div className="p-6 space-y-4">
              {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-2 rounded-xl">{error}</div>}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-[#374151] uppercase tracking-wide mb-1.5 block">Nom du produit *</label>
                  <input value={form.nom_produit} onChange={e => setForm(f => ({ ...f, nom_produit: e.target.value }))}
                    className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:border-[#DC2626] outline-none" />
                </div>
                <div>
                  <label className="text-xs font-bold text-[#374151] uppercase tracking-wide mb-1.5 block">Type de police</label>
                  <select value={form.type_police} onChange={e => setForm(f => ({ ...f, type_police: e.target.value }))}
                    className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:border-[#DC2626] outline-none bg-white">
                    {TYPES_POLICE.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-[#374151] uppercase tracking-wide mb-1.5 block">Description</label>
                <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2}
                  className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:border-[#DC2626] outline-none resize-none" />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-bold text-[#374151] uppercase tracking-wide mb-1.5 block">Prime base (FCFA)</label>
                  <input type="number" value={form.prime_base} onChange={e => setForm(f => ({ ...f, prime_base: +e.target.value }))}
                    className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:border-[#DC2626] outline-none" />
                </div>
                <div>
                  <label className="text-xs font-bold text-[#374151] uppercase tracking-wide mb-1.5 block">Franchise (FCFA)</label>
                  <input type="number" value={form.franchise_defaut} onChange={e => setForm(f => ({ ...f, franchise_defaut: +e.target.value }))}
                    className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:border-[#DC2626] outline-none" />
                </div>
                <div>
                  <label className="text-xs font-bold text-[#374151] uppercase tracking-wide mb-1.5 block">Durée (mois)</label>
                  <input type="number" value={form.duree_mois} onChange={e => setForm(f => ({ ...f, duree_mois: +e.target.value }))}
                    className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:border-[#DC2626] outline-none" />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-[#374151] uppercase tracking-wide mb-1.5 block">Garanties</label>
                <div className="flex gap-2 mb-2">
                  <input value={garNote} onChange={e => setGarNote(e.target.value)} placeholder="Ajouter une garantie..."
                    onKeyDown={e => { if (e.key === 'Enter' && garNote.trim()) { setForm(f => ({ ...f, garanties: [...f.garanties, garNote.trim()] })); setGarNote('') }}}
                    className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-xl focus:border-[#DC2626] outline-none" />
                  <button onClick={() => { if (garNote.trim()) { setForm(f => ({ ...f, garanties: [...f.garanties, garNote.trim()] })); setGarNote('') }}}
                    className="px-3 py-2 bg-green-50 text-green-700 rounded-xl text-sm font-semibold hover:bg-green-100">+</button>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {form.garanties.map((g, i) => (
                    <span key={i} className="inline-flex items-center gap-1 text-xs bg-green-50 text-green-700 border border-green-100 rounded-lg px-2 py-0.5">
                      {g}<button onClick={() => setForm(f => ({ ...f, garanties: f.garanties.filter((_, j) => j !== i) }))}><X size={9} /></button>
                    </span>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-[#374151] uppercase tracking-wide mb-1.5 block">Exclusions</label>
                <div className="flex gap-2 mb-2">
                  <input value={excNote} onChange={e => setExcNote(e.target.value)} placeholder="Ajouter une exclusion..."
                    onKeyDown={e => { if (e.key === 'Enter' && excNote.trim()) { setForm(f => ({ ...f, exclusions: [...f.exclusions, excNote.trim()] })); setExcNote('') }}}
                    className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-xl focus:border-[#DC2626] outline-none" />
                  <button onClick={() => { if (excNote.trim()) { setForm(f => ({ ...f, exclusions: [...f.exclusions, excNote.trim()] })); setExcNote('') }}}
                    className="px-3 py-2 bg-red-50 text-red-700 rounded-xl text-sm font-semibold hover:bg-red-100">+</button>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {form.exclusions.map((g, i) => (
                    <span key={i} className="inline-flex items-center gap-1 text-xs bg-red-50 text-red-700 border border-red-100 rounded-lg px-2 py-0.5">
                      {g}<button onClick={() => setForm(f => ({ ...f, exclusions: f.exclusions.filter((_, j) => j !== i) }))}><X size={9} /></button>
                    </span>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex gap-3 px-6 py-4 border-t border-gray-100">
              <button onClick={() => setShowModal(false)} className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-semibold hover:bg-gray-50">Annuler</button>
              <button onClick={handleSave} disabled={saving}
                className="flex-1 py-2.5 bg-[#DC2626] hover:bg-[#B91C1C] disabled:opacity-60 text-white text-sm font-bold rounded-xl inline-flex items-center justify-center gap-2">
                {saving ? <RefreshCw size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                {editing ? 'Enregistrer' : 'Créer le produit'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

'use client'

import { useState, useEffect, useCallback } from 'react'
import { useTenantContext } from '@/lib/contexts/TenantContext'
import { Building2, Plus, RefreshCw, X, CheckCircle2, Phone, Mail, Globe, Search, Trash2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'

interface Partenaire {
  id: string
  nom: string
  type: string
  pays: string
  ville: string
  email: string
  telephone: string
  site_web: string
  contact_nom: string
  contact_poste: string
  actif: boolean
  created_at: string
}

const TYPES = [
  { value: 'reassureur', label: 'Réassureur', color: 'bg-purple-100 text-purple-700' },
  { value: 'garage',     label: 'Garage',     color: 'bg-blue-100 text-blue-700' },
  { value: 'expert',     label: 'Expert',     color: 'bg-orange-100 text-orange-700' },
  { value: 'hopital',    label: 'Hôpital',    color: 'bg-red-100 text-red-700' },
  { value: 'avocat',     label: 'Avocat',     color: 'bg-gray-100 text-gray-700' },
  { value: 'clinique',   label: 'Clinique',   color: 'bg-pink-100 text-pink-700' },
  { value: 'autre',      label: 'Autre',      color: 'bg-teal-100 text-teal-700' },
]

const EMPTY = { nom: '', type: 'reassureur', pays: '', ville: '', email: '', telephone: '', site_web: '', contact_nom: '', contact_poste: '', actif: true }

const typeColor = (t: string) => TYPES.find(x => x.value === t)?.color ?? 'bg-gray-100 text-gray-700'
const typeLabel = (t: string) => TYPES.find(x => x.value === t)?.label ?? t

export default function PartenairesPage() {
  const { tenantId } = useTenantContext()
  const [partenaires, setPartenaires] = useState<Partenaire[]>([])
  const [loading,     setLoading]     = useState(true)
  const [saving,      setSaving]      = useState(false)
  const [search,      setSearch]      = useState('')
  const [filterType,  setFilterType]  = useState('')
  const [showModal,   setShowModal]   = useState(false)
  const [editing,     setEditing]     = useState<Partenaire | null>(null)
  const [form,        setForm]        = useState({ ...EMPTY })
  const [error,       setError]       = useState('')

  const load = useCallback(async () => {
    if (!tenantId) return
    setLoading(true)
    const { data } = await supabase.from('ass_partenaires').select('*').eq('tenant_id', tenantId).order('created_at', { ascending: false })
    setPartenaires(data ?? [])
    setLoading(false)
  }, [tenantId])

  useEffect(() => { load() }, [load])

  const openCreate = () => { setEditing(null); setForm({ ...EMPTY }); setError(''); setShowModal(true) }
  const openEdit   = (p: Partenaire) => {
    setEditing(p)
    setForm({ nom: p.nom, type: p.type, pays: p.pays ?? '', ville: p.ville ?? '', email: p.email ?? '', telephone: p.telephone ?? '', site_web: p.site_web ?? '', contact_nom: p.contact_nom ?? '', contact_poste: p.contact_poste ?? '', actif: p.actif })
    setError(''); setShowModal(true)
  }

  const handleSave = async () => {
    if (!form.nom.trim()) { setError('Nom requis'); return }
    if (!tenantId) return
    setSaving(true); setError('')
    const payload = { ...form, tenant_id: tenantId }
    let err
    if (editing) { const r = await supabase.from('ass_partenaires').update(payload).eq('id', editing.id); err = r.error }
    else         { const r = await supabase.from('ass_partenaires').insert(payload);                       err = r.error }
    setSaving(false)
    if (err) { setError(err.message); return }
    setShowModal(false); load()
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Supprimer ce partenaire ?')) return
    await supabase.from('ass_partenaires').delete().eq('id', id)
    load()
  }

  const displayed = partenaires.filter(p =>
    (!filterType || p.type === filterType) &&
    (!search || p.nom.toLowerCase().includes(search.toLowerCase()) || p.contact_nom?.toLowerCase().includes(search.toLowerCase()))
  )

  const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <div><label className="text-xs font-bold text-[#374151] uppercase tracking-wide mb-1.5 block">{label}</label>{children}</div>
  )
  const Input = (props: React.InputHTMLAttributes<HTMLInputElement>) => (
    <input {...props} className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:border-[#DC2626] outline-none" />
  )

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-black text-[#0F172A] flex items-center gap-2">
            <Building2 className="text-[#DC2626]" size={22} /> Partenaires
          </h1>
          <p className="text-sm text-[#64748B]">{partenaires.length} partenaire{partenaires.length !== 1 ? 's' : ''} · {partenaires.filter(p => p.actif).length} actifs</p>
        </div>
        <button onClick={openCreate} className="inline-flex items-center gap-1.5 bg-[#DC2626] hover:bg-[#B91C1C] text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors">
          <Plus size={15} /> Nouveau partenaire
        </button>
      </div>

      {/* Summary cards */}
      <div className="flex flex-wrap gap-2">
        <button onClick={() => setFilterType('')} className={`text-xs font-semibold px-3 py-1.5 rounded-xl border transition-colors ${!filterType ? 'bg-[#DC2626] text-white border-[#DC2626]' : 'bg-white text-[#64748B] border-gray-200 hover:bg-gray-50'}`}>
          Tous ({partenaires.length})
        </button>
        {TYPES.map(t => {
          const n = partenaires.filter(p => p.type === t.value).length
          if (n === 0) return null
          return (
            <button key={t.value} onClick={() => setFilterType(filterType === t.value ? '' : t.value)}
              className={`text-xs font-semibold px-3 py-1.5 rounded-xl border transition-colors ${filterType === t.value ? 'bg-[#DC2626] text-white border-[#DC2626]' : 'bg-white text-[#64748B] border-gray-200 hover:bg-gray-50'}`}>
              {t.label} ({n})
            </button>
          )
        })}
      </div>

      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher un partenaire..."
          className="w-full pl-9 pr-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:border-[#DC2626] outline-none" />
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? (
          <div className="col-span-full flex justify-center py-12"><RefreshCw className="animate-spin text-[#DC2626]" size={24} /></div>
        ) : displayed.length === 0 ? (
          <div className="col-span-full bg-white rounded-2xl border border-gray-100 py-16 text-center">
            <Building2 size={36} className="text-gray-200 mx-auto mb-3" />
            <p className="text-sm text-[#94A3B8]">Aucun partenaire trouvé</p>
          </div>
        ) : displayed.map(p => (
          <div key={p.id} className="bg-white rounded-2xl border border-gray-100 p-5">
            <div className="flex items-start justify-between mb-3">
              <span className={`text-[11px] font-bold rounded-full px-2.5 py-0.5 ${typeColor(p.type)}`}>{typeLabel(p.type)}</span>
              <div className="flex gap-1">
                <button onClick={() => openEdit(p)} className="p-1.5 hover:bg-gray-100 rounded-lg text-[#64748B] text-xs font-medium">Modifier</button>
                <button onClick={() => handleDelete(p.id)} className="p-1.5 hover:bg-red-50 rounded-lg text-red-400"><Trash2 size={12} /></button>
              </div>
            </div>

            <h3 className="font-black text-[#0F172A] mb-1">{p.nom}</h3>
            {(p.pays || p.ville) && <p className="text-xs text-[#64748B] mb-3">{[p.ville, p.pays].filter(Boolean).join(', ')}</p>}

            <div className="space-y-1.5 mt-3">
              {p.contact_nom && (
                <div className="text-xs text-[#64748B]">
                  <span className="font-semibold text-[#374151]">{p.contact_nom}</span>
                  {p.contact_poste && <span className="ml-1 text-[#94A3B8]">· {p.contact_poste}</span>}
                </div>
              )}
              {p.email && (
                <a href={`mailto:${p.email}`} className="flex items-center gap-1.5 text-xs text-[#64748B] hover:text-[#DC2626]">
                  <Mail size={11} />{p.email}
                </a>
              )}
              {p.telephone && (
                <a href={`tel:${p.telephone}`} className="flex items-center gap-1.5 text-xs text-[#64748B] hover:text-[#DC2626]">
                  <Phone size={11} />{p.telephone}
                </a>
              )}
              {p.site_web && (
                <a href={p.site_web} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-xs text-[#64748B] hover:text-[#DC2626] truncate">
                  <Globe size={11} />{p.site_web.replace(/^https?:\/\//, '')}
                </a>
              )}
            </div>

            {!p.actif && <div className="mt-3 text-xs text-center bg-gray-50 text-gray-400 rounded-lg py-1 font-medium">Inactif</div>}
          </div>
        ))}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="font-black text-[#0F172A] text-base">{editing ? 'Modifier le partenaire' : 'Nouveau partenaire'}</h2>
              <button onClick={() => setShowModal(false)} className="p-2 hover:bg-gray-100 rounded-lg"><X size={16} /></button>
            </div>
            <div className="p-6 space-y-4">
              {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-2 rounded-xl">{error}</div>}

              <div className="grid grid-cols-2 gap-4">
                <Field label="Nom *">
                  <Input value={form.nom} onChange={e => setForm(f => ({ ...f, nom: e.target.value }))} />
                </Field>
                <Field label="Type">
                  <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
                    className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:border-[#DC2626] outline-none bg-white">
                    {TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </Field>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <Field label="Pays"><Input value={form.pays} onChange={e => setForm(f => ({ ...f, pays: e.target.value }))} /></Field>
                <Field label="Ville"><Input value={form.ville} onChange={e => setForm(f => ({ ...f, ville: e.target.value }))} /></Field>
              </div>

              <div className="border-t border-gray-100 pt-4">
                <div className="text-xs font-bold text-[#64748B] uppercase tracking-wide mb-3">Contact</div>
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Nom contact"><Input value={form.contact_nom} onChange={e => setForm(f => ({ ...f, contact_nom: e.target.value }))} /></Field>
                  <Field label="Poste"><Input value={form.contact_poste} onChange={e => setForm(f => ({ ...f, contact_poste: e.target.value }))} /></Field>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <Field label="Email"><Input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} /></Field>
                <Field label="Téléphone"><Input type="tel" value={form.telephone} onChange={e => setForm(f => ({ ...f, telephone: e.target.value }))} /></Field>
              </div>

              <Field label="Site web"><Input type="url" value={form.site_web} onChange={e => setForm(f => ({ ...f, site_web: e.target.value }))} placeholder="https://" /></Field>

              <label className="flex items-center gap-2 cursor-pointer">
                <div className={`relative w-10 h-5 rounded-full transition-colors ${form.actif ? 'bg-green-500' : 'bg-gray-300'}`}
                  onClick={() => setForm(f => ({ ...f, actif: !f.actif }))}>
                  <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${form.actif ? 'translate-x-5' : 'translate-x-0.5'}`} />
                </div>
                <span className="text-sm font-medium text-[#374151]">Partenaire actif</span>
              </label>
            </div>
            <div className="flex gap-3 px-6 py-4 border-t border-gray-100">
              <button onClick={() => setShowModal(false)} className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-semibold hover:bg-gray-50">Annuler</button>
              <button onClick={handleSave} disabled={saving}
                className="flex-1 py-2.5 bg-[#DC2626] hover:bg-[#B91C1C] disabled:opacity-60 text-white text-sm font-bold rounded-xl inline-flex items-center justify-center gap-2">
                {saving ? <RefreshCw size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                {editing ? 'Enregistrer' : 'Créer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useTenant } from '@/lib/hooks/useTenant'
import { useLocale } from '@/lib/hooks/useLocale'
import { Scale, Plus, X, Search, Edit2, Trash2, AlertTriangle } from 'lucide-react'

interface UnitConversion {
  id: string; unite_source: string; unite_cible: string
  facteur: number; categorie: string; created_at: string
}

const CATEGORIES = [
  { value: 'masse',        label: 'Masse',       emoji: '⚖️' },
  { value: 'volume',       label: 'Volume',      emoji: '🧪' },
  { value: 'longueur',     label: 'Longueur',    emoji: '📏' },
  { value: 'surface',      label: 'Surface',     emoji: '🔲' },
  { value: 'quantite',     label: 'Quantité',    emoji: '📦' },
  { value: 'temps',        label: 'Temps',       emoji: '⏱️' },
  { value: 'personnalise', label: 'Personnalisé', emoji: '✏️' },
]

const EXEMPLES = [
  { src: 'kg',      cible: 'g',      facteur: 1000, cat: 'masse' },
  { src: 'tonne',   cible: 'kg',     facteur: 1000, cat: 'masse' },
  { src: 'litre',   cible: 'ml',     facteur: 1000, cat: 'volume' },
  { src: 'm³',      cible: 'litre',  facteur: 1000, cat: 'volume' },
  { src: 'm',       cible: 'cm',     facteur: 100,  cat: 'longueur' },
  { src: 'km',      cible: 'm',      facteur: 1000, cat: 'longueur' },
  { src: 'carton',  cible: 'unité',  facteur: 24,   cat: 'quantite' },
  { src: 'palette', cible: 'carton', facteur: 40,   cat: 'quantite' },
  { src: 'heure',   cible: 'minute', facteur: 60,   cat: 'temps' },
  { src: 'jour',    cible: 'heure',  facteur: 8,    cat: 'temps' },
]

const emptyForm = { unite_source: '', unite_cible: '', facteur: '', categorie: 'quantite' }

export default function MultiUnitesPage() {
  const { tenantId } = useTenant()
  const { t } = useLocale()
  const [conversions, setConversions] = useState<UnitConversion[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [catFilter, setCatFilter] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editItem, setEditItem] = useState<UnitConversion | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [calcSource, setCalcSource] = useState('')
  const [calcQty, setCalcQty] = useState('')
  const [form, setForm] = useState(emptyForm)

  const load = useCallback(async () => {
    if (!tenantId) return
    setLoading(true)
    try {
      const { data, error: e } = await supabase
        .from('unit_conversions').select('*').eq('tenant_id', tenantId)
        .order('categorie').order('unite_source')
      if (e?.code === '42P01') { setConversions([]); setLoading(false); return }
      setConversions(data || [])
    } catch { setConversions([]) }
    setLoading(false)
  }, [tenantId])

  useEffect(() => { load() }, [load])

  const openCreate = () => { setEditItem(null); setForm(emptyForm); setError(''); setShowModal(true) }
  const openEdit = (c: UnitConversion) => {
    setEditItem(c)
    setForm({ unite_source: c.unite_source, unite_cible: c.unite_cible, facteur: String(c.facteur), categorie: c.categorie })
    setError(''); setShowModal(true)
  }

  const handleSave = async () => {
    if (!tenantId) return
    if (!form.unite_source || !form.unite_cible || !form.facteur) { setError('Tous les champs sont obligatoires'); return }
    const facteur = parseFloat(form.facteur)
    if (facteur <= 0) { setError('Le facteur doit être positif'); return }
    setSaving(true); setError('')
    try {
      const payload = {
        tenant_id: tenantId,
        unite_source: form.unite_source.trim(),
        unite_cible: form.unite_cible.trim(),
        facteur, categorie: form.categorie,
      }
      if (editItem) {
        await supabase.from('unit_conversions').update(payload).eq('id', editItem.id)
      } else {
        await supabase.from('unit_conversions').insert(payload)
      }
      setShowModal(false); load()
    } catch (err: any) { setError(err.message || 'Erreur') }
    setSaving(false)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Supprimer cette conversion ?')) return
    await supabase.from('unit_conversions').delete().eq('id', id); load()
  }

  const importExemples = async () => {
    if (!tenantId) return
    const rows = EXEMPLES.map(e => ({ tenant_id: tenantId, unite_source: e.src, unite_cible: e.cible, facteur: e.facteur, categorie: e.cat }))
    await supabase.from('unit_conversions').upsert(rows, { onConflict: 'tenant_id,unite_source,unite_cible', ignoreDuplicates: true })
    load()
  }

  const filtered = conversions.filter(c => {
    const q = search.toLowerCase()
    return (!q || c.unite_source.toLowerCase().includes(q) || c.unite_cible.toLowerCase().includes(q))
      && (!catFilter || c.categorie === catFilter)
  })

  const calcResults = (() => {
    if (!calcSource || !calcQty) return []
    const qty = parseFloat(calcQty)
    if (isNaN(qty)) return []
    return conversions
      .filter(c => c.unite_source === calcSource)
      .map(c => ({ to: c.unite_cible, value: qty * c.facteur }))
  })()

  const grouped = CATEGORIES.reduce((acc, cat) => {
    const items = filtered.filter(c => c.categorie === cat.value)
    if (items.length > 0) acc[cat.value] = { ...cat, items }
    return acc
  }, {} as Record<string, { label: string; emoji: string; items: UnitConversion[] }>)

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-[#0F172A] flex items-center gap-2">
            <Scale size={20} className="text-[#16A34A]" />
            {t('stock.multiunites.title')}
          </h1>
          <p className="text-xs text-[#64748B] mt-0.5">{t('stock.multiunites.subtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={importExemples}
            className="flex items-center gap-1.5 border border-[#E2E8F0] text-[#374151] px-3 py-2 rounded-xl text-xs font-semibold hover:bg-[#F8FAFC]">
            Importer standards
          </button>
          <button onClick={openCreate}
            className="flex items-center gap-1.5 bg-[#16A34A] text-white px-4 py-2 rounded-xl text-xs font-semibold hover:bg-[#15803D] shadow-sm">
            <Plus size={14} /> {t('stock.multiunites.new')}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 md:grid-cols-7 gap-2">
        {CATEGORIES.map(cat => {
          const cnt = conversions.filter(c => c.categorie === cat.value).length
          return (
            <button key={cat.value} onClick={() => setCatFilter(catFilter === cat.value ? '' : cat.value)}
              className={`bg-white border rounded-xl p-3 text-center transition-all ${catFilter === cat.value ? 'border-[#16A34A] shadow-sm bg-[#F0FDF4]' : 'border-[#E2E8F0] hover:border-[#16A34A]/40'}`}>
              <p className="text-base">{cat.emoji}</p>
              <p className="text-[10px] font-semibold text-[#374151]">{cat.label}</p>
              <p className="text-[10px] text-[#94A3B8]">{cnt}</p>
            </button>
          )
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-3">
          <div className="bg-white border border-[#E2E8F0] rounded-2xl p-3">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder={t('stock.multiunites.title')}
                className="w-full pl-8 pr-3 py-2 text-xs border border-[#E2E8F0] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#16A34A]/20" />
            </div>
          </div>

          {loading ? (
            <div className="bg-white border border-[#E2E8F0] rounded-2xl flex items-center justify-center py-16 text-sm text-[#64748B]">{t('common.loading')}</div>
          ) : filtered.length === 0 ? (
            <div className="bg-white border border-[#E2E8F0] rounded-2xl flex flex-col items-center justify-center py-16 gap-3">
              <Scale size={32} className="text-[#E2E8F0]" />
              <p className="text-sm text-[#64748B]">{t('stock.multiunites.empty')}</p>
              <button onClick={importExemples} className="text-xs text-[#16A34A] underline">Importer les conversions standards</button>
            </div>
          ) : Object.entries(grouped).map(([cat, group]) => (
            <div key={cat} className="bg-white border border-[#E2E8F0] rounded-2xl overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-3 border-b border-[#F1F5F9] bg-[#F8FAFC]">
                <span className="text-base">{group.emoji}</span>
                <span className="text-xs font-bold text-[#374151]">{group.label}</span>
                <span className="text-[10px] bg-[#E2E8F0] text-[#64748B] px-2 py-0.5 rounded-full">{group.items.length}</span>
              </div>
              <div className="divide-y divide-[#F8FAFC]">
                {group.items.map(c => (
                  <div key={c.id} className="flex items-center px-4 py-3 hover:bg-[#FAFAFA] group">
                    <div className="flex-1 flex items-center gap-3">
                      <span className="text-sm font-bold text-[#0F172A]">1</span>
                      <span className="text-xs text-[#64748B]">{c.unite_source}</span>
                      <span className="text-[#94A3B8]">=</span>
                      <span className="text-sm font-bold text-[#16A34A]">{c.facteur.toLocaleString()}</span>
                      <span className="text-xs text-[#64748B]">{c.unite_cible}</span>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => openEdit(c)} className="p-1.5 rounded-lg hover:bg-[#F1F5F9] text-[#64748B]"><Edit2 size={12} /></button>
                      <button onClick={() => handleDelete(c.id)} className="p-1.5 rounded-lg hover:bg-[#FEF2F2] text-[#DC2626]"><Trash2 size={12} /></button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="space-y-3">
          <div className="bg-white border border-[#E2E8F0] rounded-2xl p-4">
            <h3 className="text-xs font-bold text-[#0F172A] mb-3 flex items-center gap-2">
              <Scale size={13} className="text-[#16A34A]" /> Calculatrice de conversion
            </h3>
            <div className="space-y-3">
              <div>
                <label className="text-[11px] font-semibold text-[#374151] mb-1 block">Quantité</label>
                <input type="number" value={calcQty} onChange={e => setCalcQty(e.target.value)} placeholder="ex: 5"
                  className="w-full px-3 py-2 text-xs border border-[#E2E8F0] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#16A34A]/20" />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-[#374151] mb-1 block">Unité source</label>
                <select value={calcSource} onChange={e => setCalcSource(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-[#E2E8F0] rounded-xl focus:outline-none">
                  <option value="">Sélectionner…</option>
                  {[...new Set(conversions.map(c => c.unite_source))].sort().map(u => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>
              {calcResults.length > 0 && (
                <div className="border border-[#E2E8F0] rounded-xl overflow-hidden">
                  {calcResults.map(r => (
                    <div key={r.to} className="flex items-center justify-between px-3 py-2 border-b border-[#F8FAFC] last:border-0">
                      <span className="text-xs text-[#64748B]">{r.to}</span>
                      <span className="text-xs font-bold text-[#16A34A]">{r.value.toLocaleString(undefined, { maximumFractionDigits: 4 })}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="bg-[#F0FDF4] border border-[#BBF7D0] rounded-2xl p-4">
            <p className="text-xs font-bold text-[#15803D] mb-2">💡 Comment utiliser</p>
            <ul className="text-[11px] text-[#16A34A] space-y-1">
              <li>• Définissez des règles entre vos unités de stock</li>
              <li>• Ex: 1 carton = 24 bouteilles</li>
              <li>• La calculatrice convertit les quantités</li>
              <li>• Utilisé lors de réceptions multi-unités</li>
            </ul>
          </div>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between p-5 border-b border-[#F1F5F9]">
              <h2 className="text-sm font-bold text-[#0F172A] flex items-center gap-2">
                <Scale size={15} className="text-[#16A34A]" />
                {editItem ? t('stock.multiunites.title') : t('stock.multiunites.new')}
              </h2>
              <button onClick={() => setShowModal(false)}><X size={18} className="text-[#94A3B8]" /></button>
            </div>
            <div className="p-5 space-y-4">
              {error && <div className="bg-[#FEF2F2] text-[#DC2626] text-xs px-3 py-2 rounded-xl flex items-center gap-2"><AlertTriangle size={13} />{error}</div>}
              <div>
                <label className="text-[11px] font-semibold text-[#374151] mb-1 block">Catégorie *</label>
                <select value={form.categorie} onChange={e => setForm(f => ({ ...f, categorie: e.target.value }))}
                  className="w-full px-3 py-2 text-xs border border-[#E2E8F0] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#16A34A]/20">
                  {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.emoji} {c.label}</option>)}
                </select>
              </div>
              <div className="flex items-end gap-3">
                <div className="flex-1">
                  <label className="text-[11px] font-semibold text-[#374151] mb-1 block">1 × unité source *</label>
                  <input value={form.unite_source} onChange={e => setForm(f => ({ ...f, unite_source: e.target.value }))}
                    placeholder="ex: kg, carton"
                    className="w-full px-3 py-2 text-xs border border-[#E2E8F0] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#16A34A]/20" />
                </div>
                <span className="pb-2 text-[#94A3B8] font-bold text-lg">=</span>
                <div className="flex-1">
                  <label className="text-[11px] font-semibold text-[#374151] mb-1 block">Facteur *</label>
                  <input type="number" step="0.001" value={form.facteur} onChange={e => setForm(f => ({ ...f, facteur: e.target.value }))}
                    placeholder="ex: 1000"
                    className="w-full px-3 py-2 text-xs border border-[#E2E8F0] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#16A34A]/20" />
                </div>
              </div>
              <div>
                <label className="text-[11px] font-semibold text-[#374151] mb-1 block">Unité cible *</label>
                <input value={form.unite_cible} onChange={e => setForm(f => ({ ...f, unite_cible: e.target.value }))}
                  placeholder="ex: g, unité"
                  className="w-full px-3 py-2 text-xs border border-[#E2E8F0] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#16A34A]/20" />
              </div>
              {form.unite_source && form.facteur && form.unite_cible && (
                <div className="bg-[#F0FDF4] border border-[#BBF7D0] rounded-xl px-3 py-2 text-xs text-[#16A34A] font-semibold">
                  ✓ 1 {form.unite_source} = {parseFloat(form.facteur||'0').toLocaleString()} {form.unite_cible}
                </div>
              )}
            </div>
            <div className="flex justify-end gap-2 px-5 pb-5">
              <button onClick={() => setShowModal(false)}
                className="px-4 py-2 text-xs font-semibold text-[#64748B] border border-[#E2E8F0] rounded-xl hover:bg-[#F8FAFC]">Annuler</button>
              <button onClick={handleSave} disabled={saving}
                className="px-4 py-2 text-xs font-semibold bg-[#16A34A] text-white rounded-xl hover:bg-[#15803D] disabled:opacity-50">
                {saving ? 'Enregistrement…' : editItem ? 'Modifier' : 'Créer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

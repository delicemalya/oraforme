'use client'

import { useLocale } from '@/lib/hooks/useLocale'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useTenant } from '@/lib/hooks/useTenant'
import { useFmt } from '@/lib/hooks/useFmt'
import { Pill, Plus, X, AlertTriangle, Loader2, ChevronLeft, Search, Package } from 'lucide-react'
import Link from 'next/link'

interface Medicament {
  id:               string
  nom_commercial:   string
  dci:              string | null
  forme:            string | null
  dosage:           string | null
  laboratoire:      string | null
  prix_achat:       number
  prix_vente:       number
  stock_actuel:     number
  stock_min:        number
  date_expiration:  string | null
  ordonnance_requise: boolean
  emplacement:      string | null
  actif:            boolean
}

const FORMES = ['comprime','gelule','sirop','injectable','pommade','gouttes','spray','autre']
const BLANK = { nom_commercial: '', dci: '', forme: 'comprime', dosage: '', laboratoire: '', prix_achat: '', prix_vente: '', stock_actuel: '0', stock_min: '5', date_expiration: '', ordonnance_requise: false, emplacement: '' }

export default function MedicamentsPage() {
  const { fmt: fmtFCFA } = useFmt()
  const { t } = useLocale()
  const { tenantId, loading: tenantLoading } = useTenant()
  const [meds,    setMeds]    = useState<Medicament[]>([])
  const [loading, setLoading] = useState(true)
  const [search,  setSearch]  = useState('')
  const [filterForme, setFilterForme] = useState('all')
  const [showModal, setShowModal] = useState(false)
  const [saving,   setSaving]   = useState(false)
  const [error,    setError]    = useState('')
  const [selected, setSelected] = useState<Medicament | null>(null)
  const [form, setForm] = useState({ ...BLANK })

  function set<K extends keyof typeof form>(k: K, v: typeof form[K]) { setForm(p => ({ ...p, [k]: v })) }

  const load = useCallback(async () => {
    if (!tenantId) return
    setLoading(true)
    const { data } = await supabase.from('pharmacie_medicaments').select('*').eq('tenant_id', tenantId).eq('actif', true).order('nom_commercial').limit(200)
    setMeds(data ?? [])
    setLoading(false)
  }, [tenantId])

  useEffect(() => { if (!tenantLoading) load() }, [tenantLoading, load])

  function openNew() { setForm({ ...BLANK }); setSelected(null); setError(''); setShowModal(true) }
  function openEdit(m: Medicament) {
    setForm({ nom_commercial: m.nom_commercial, dci: m.dci ?? '', forme: m.forme ?? 'comprime', dosage: m.dosage ?? '', laboratoire: m.laboratoire ?? '', prix_achat: String(m.prix_achat), prix_vente: String(m.prix_vente), stock_actuel: String(m.stock_actuel), stock_min: String(m.stock_min), date_expiration: m.date_expiration ?? '', ordonnance_requise: m.ordonnance_requise, emplacement: m.emplacement ?? '' })
    setSelected(m); setError(''); setShowModal(true)
  }

  async function handleSave() {
    if (!tenantId || !form.nom_commercial.trim()) { setError('Nom commercial obligatoire'); return }
    setSaving(true); setError('')
    const payload = {
      tenant_id: tenantId, nom_commercial: form.nom_commercial.trim(), dci: form.dci || null,
      forme: form.forme, dosage: form.dosage || null, laboratoire: form.laboratoire || null,
      prix_achat: parseFloat(form.prix_achat as string) || 0,
      prix_vente: parseFloat(form.prix_vente as string) || 0,
      stock_actuel: parseInt(form.stock_actuel as string) || 0,
      stock_min: parseInt(form.stock_min as string) || 5,
      date_expiration: form.date_expiration || null,
      ordonnance_requise: form.ordonnance_requise,
      emplacement: form.emplacement || null,
    }
    if (selected) { await supabase.from('pharmacie_medicaments').update(payload).eq('id', selected.id) }
    else { await supabase.from('pharmacie_medicaments').insert(payload) }
    setSaving(false); setShowModal(false); load()
  }

  const filtered = meds.filter(m => {
    const matchSearch = !search || `${m.nom_commercial} ${m.dci ?? ''}`.toLowerCase().includes(search.toLowerCase())
    const matchForme  = filterForme === 'all' || m.forme === filterForme
    return matchSearch && matchForme
  })

  const today = new Date().toISOString().slice(0, 10)
  const in30   = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10)

  if (tenantLoading || loading) {
    return <div className="min-h-screen bg-[#F5F7FB] flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-[#DC2626]" /></div>
  }

  return (
    <div className="min-h-screen bg-[#F5F7FB] p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Link href="/dashboard/pharmacie" className="p-2 rounded-xl hover:bg-white border border-[#E5E7EB]">
            <ChevronLeft size={16} className="text-[#64748B]" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-[#0F172A] flex items-center gap-2"><Pill size={18} className="text-[#2563EB]" /> Médicaments ({meds.length})</h1>
            <p className="text-xs text-[#64748B]">Stock & catalogue pharmacie</p>
          </div>
        </div>
        <button onClick={openNew} className="flex items-center gap-1.5 bg-[#DC2626] text-white px-4 py-2 rounded-xl text-xs font-semibold hover:bg-[#B91C1C]">
          <Plus size={14} /> Nouveau médicament
        </button>
      </div>

      {/* Recherche + filtres */}
      <div className="bg-white rounded-2xl border border-[#E5E7EB] p-3 mb-4 flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher…"
            className="w-full pl-8 pr-3 py-2 text-xs border border-[#E5E7EB] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20" />
        </div>
        <select value={filterForme} onChange={e => setFilterForme(e.target.value)}
          className="px-3 py-2 text-xs border border-[#E5E7EB] rounded-xl focus:outline-none bg-white">
          <option value="all">Toutes formes</option>
          {FORMES.map(f => <option key={f} value={f}>{f.charAt(0).toUpperCase() + f.slice(1)}</option>)}
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-[#E5E7EB] overflow-hidden">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16">
            <Package size={32} className="text-[#CBD5E1] mb-3" />
            <p className="text-sm text-[#94A3B8]">Aucun médicament trouvé</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#F1F5F9] bg-[#F8FAFC]">
                  {['Médicament', 'Forme / Dosage', 'Prix vente', 'Stock', 'Expiration', 'Ordonnance', 'Actions'].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-[11px] font-semibold text-[#64748B] uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F8FAFC]">
                {filtered.map(m => {
                  const isLow = m.stock_actuel <= m.stock_min
                  const expDate = m.date_expiration
                  const isExpired = expDate && expDate <= today
                  const isExpiringSoon = expDate && expDate > today && expDate <= in30
                  return (
                    <tr key={m.id} className="hover:bg-[#FAFAFA]">
                      <td className="px-4 py-3">
                        <p className="text-sm font-semibold text-[#0F172A]">{m.nom_commercial}</p>
                        {m.dci && <p className="text-[10px] text-[#94A3B8]">{m.dci}</p>}
                        {m.laboratoire && <p className="text-[10px] text-[#94A3B8]">{m.laboratoire}</p>}
                      </td>
                      <td className="px-4 py-3 text-xs text-[#374151]">
                        <span className="capitalize">{m.forme ?? '—'}</span>
                        {m.dosage && <span className="text-[#94A3B8]"> · {m.dosage}</span>}
                      </td>
                      <td className="px-4 py-3 text-xs font-bold text-[#0F172A]">{fmtFCFA(m.prix_vente)}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-bold ${isLow ? 'text-[#DC2626]' : 'text-[#0F172A]'}`}>{m.stock_actuel}</span>
                        <span className="text-[10px] text-[#94A3B8]"> / min {m.stock_min}</span>
                        {isLow && <span className="block text-[10px] text-[#DC2626] font-semibold">⚠ Stock bas</span>}
                      </td>
                      <td className="px-4 py-3">
                        {expDate ? (
                          <span className={`text-xs font-medium ${isExpired ? 'text-[#DC2626]' : isExpiringSoon ? 'text-[#D97706]' : 'text-[#16A34A]'}`}>
                            {isExpired ? '⚠ Expiré' : isExpiringSoon ? '⚡ ' : ''}{new Date(expDate).toLocaleDateString('fr-FR')}
                          </span>
                        ) : <span className="text-xs text-[#94A3B8]">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        {m.ordonnance_requise
                          ? <span className="text-[10px] font-semibold bg-[#FEF2F2] text-[#DC2626] px-2 py-0.5 rounded-full">Requise</span>
                          : <span className="text-[10px] text-[#94A3B8]">{t('common.no')}</span>}
                      </td>
                      <td className="px-4 py-3">
                        <button onClick={() => openEdit(m)}
                          className="text-xs text-[#2563EB] border border-[#BFDBFE] px-2.5 py-1 rounded-lg hover:bg-[#EFF6FF]">{t('common.edit')}</button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-[#E5E7EB] sticky top-0 bg-white">
              <h2 className="text-sm font-bold text-[#0F172A]">{selected ? 'Modifier' : 'Nouveau médicament'}</h2>
              <button onClick={() => setShowModal(false)}><X size={18} className="text-[#94A3B8]" /></button>
            </div>
            <div className="p-5 space-y-4">
              {error && <div className="bg-[#FEF2F2] text-[#DC2626] text-xs px-3 py-2 rounded-xl flex items-center gap-2"><AlertTriangle size={13} />{error}</div>}
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="text-[11px] font-semibold text-[#374151] mb-1 block">Nom commercial *</label>
                  <input value={form.nom_commercial as string} onChange={e => set('nom_commercial', e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-[#E5E7EB] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#DC2626]/20" />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-[#374151] mb-1 block">DCI (générique)</label>
                  <input value={form.dci as string} onChange={e => set('dci', e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-[#E5E7EB] rounded-xl focus:outline-none" />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-[#374151] mb-1 block">Laboratoire</label>
                  <input value={form.laboratoire as string} onChange={e => set('laboratoire', e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-[#E5E7EB] rounded-xl focus:outline-none" />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-[#374151] mb-1 block">Forme</label>
                  <select value={form.forme as string} onChange={e => set('forme', e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-[#E5E7EB] rounded-xl focus:outline-none bg-white">
                    {FORMES.map(f => <option key={f} value={f}>{f.charAt(0).toUpperCase() + f.slice(1)}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-[#374151] mb-1 block">Dosage</label>
                  <input value={form.dosage as string} onChange={e => set('dosage', e.target.value)} placeholder="500mg, 10ml…"
                    className="w-full px-3 py-2 text-xs border border-[#E5E7EB] rounded-xl focus:outline-none" />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-[#374151] mb-1 block">Prix d&apos;achat (FCFA)</label>
                  <input type="number" value={form.prix_achat as string} onChange={e => set('prix_achat', e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-[#E5E7EB] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#DC2626]/20" />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-[#374151] mb-1 block">Prix de vente (FCFA) *</label>
                  <input type="number" value={form.prix_vente as string} onChange={e => set('prix_vente', e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-[#E5E7EB] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#DC2626]/20" />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-[#374151] mb-1 block">Stock actuel</label>
                  <input type="number" value={form.stock_actuel as string} onChange={e => set('stock_actuel', e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-[#E5E7EB] rounded-xl focus:outline-none" />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-[#374151] mb-1 block">Stock minimum</label>
                  <input type="number" value={form.stock_min as string} onChange={e => set('stock_min', e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-[#E5E7EB] rounded-xl focus:outline-none" />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-[#374151] mb-1 block">Date d&apos;expiration</label>
                  <input type="date" value={form.date_expiration as string} onChange={e => set('date_expiration', e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-[#E5E7EB] rounded-xl focus:outline-none" />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-[#374151] mb-1 block">Emplacement</label>
                  <input value={form.emplacement as string} onChange={e => set('emplacement', e.target.value)} placeholder="Rayon A, Colonne 3…"
                    className="w-full px-3 py-2 text-xs border border-[#E5E7EB] rounded-xl focus:outline-none" />
                </div>
                <div className="col-span-2 flex items-center gap-2">
                  <input type="checkbox" id="ordo" checked={form.ordonnance_requise as boolean} onChange={e => set('ordonnance_requise', e.target.checked)}
                    className="w-4 h-4 rounded accent-[#DC2626]" />
                  <label htmlFor="ordo" className="text-xs font-semibold text-[#374151]">Ordonnance requise</label>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 px-5 pb-5">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 text-xs font-semibold text-[#64748B] border border-[#E5E7EB] rounded-xl hover:bg-[#F8FAFC]">{t('common.cancel')}</button>
              <button onClick={handleSave} disabled={saving} className="px-4 py-2 text-xs font-semibold bg-[#DC2626] text-white rounded-xl hover:bg-[#B91C1C] disabled:opacity-50">
                {saving ? 'Enregistrement…' : 'Enregistrer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

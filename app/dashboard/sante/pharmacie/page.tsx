'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useTenant } from '@/lib/hooks/useTenant'
import { useFmt } from '@/lib/hooks/useFmt'
import {
  Pill, Plus, X, AlertTriangle, Loader2, ChevronLeft,
  Search, Package, Calendar, TrendingDown,
} from 'lucide-react'
import Link from 'next/link'

interface Medicament {
  id: string; nom_commercial: string; dci: string | null; forme: string | null
  dosage: string | null; laboratoire: string | null; prix_achat: number; prix_vente: number
  stock_actuel: number; stock_min: number; date_expiration: string | null
  ordonnance_requise: boolean; emplacement: string | null; actif: boolean
}

const FORMES = ['comprime','gelule','sirop','injectable','pommade','gouttes','spray','autre']

export default function PharmaciePage() {
  const { tenantId, loading: tenantLoading } = useTenant()
  const { fmt } = useFmt()
  const [meds,      setMeds]      = useState<Medicament[]>([])
  const [loading,   setLoading]   = useState(true)
  const [search,    setSearch]    = useState('')
  const [filterAlerte, setFilterAlerte] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [selected,  setSelected]  = useState<Medicament | null>(null)
  const [saving,    setSaving]    = useState(false)
  const [error,     setError]     = useState('')

  const BLANK = {
    nom_commercial: '', dci: '', forme: 'comprime', dosage: '', laboratoire: '',
    prix_achat: '', prix_vente: '', stock_actuel: '', stock_min: '5',
    date_expiration: '', emplacement: '', ordonnance_requise: false,
  }
  const [form, setForm] = useState({ ...BLANK })
  function setF<K extends keyof typeof form>(k: K, v: typeof form[K]) { setForm(p => ({ ...p, [k]: v })) }

  const load = useCallback(async () => {
    if (!tenantId) return
    setLoading(true)
    const { data } = await supabase.from('pharmacie_medicaments')
      .select('*').eq('tenant_id', tenantId).eq('actif', true)
      .order('nom_commercial').limit(500)
    setMeds(data ?? [])
    setLoading(false)
  }, [tenantId])

  useEffect(() => { if (!tenantLoading) load() }, [tenantLoading, load])

  function openNew() { setForm({ ...BLANK }); setSelected(null); setError(''); setShowModal(true) }
  function openEdit(m: Medicament) {
    setForm({
      nom_commercial: m.nom_commercial, dci: m.dci ?? '', forme: m.forme ?? 'comprime',
      dosage: m.dosage ?? '', laboratoire: m.laboratoire ?? '',
      prix_achat: String(m.prix_achat), prix_vente: String(m.prix_vente),
      stock_actuel: String(m.stock_actuel), stock_min: String(m.stock_min),
      date_expiration: m.date_expiration ?? '', emplacement: m.emplacement ?? '',
      ordonnance_requise: m.ordonnance_requise,
    })
    setSelected(m); setError(''); setShowModal(true)
  }

  async function handleSave() {
    if (!tenantId || !form.nom_commercial.trim()) {
      setError('Nom commercial obligatoire'); return
    }
    setSaving(true); setError('')
    const payload = {
      tenant_id: tenantId,
      nom_commercial:     form.nom_commercial.trim(),
      dci:                form.dci || null,
      forme:              form.forme || 'comprime',
      dosage:             form.dosage || null,
      laboratoire:        form.laboratoire || null,
      prix_achat:         parseFloat(form.prix_achat as string) || 0,
      prix_vente:         parseFloat(form.prix_vente as string) || 0,
      stock_actuel:       parseInt(form.stock_actuel as string) || 0,
      stock_min:          parseInt(form.stock_min as string) || 5,
      date_expiration:    form.date_expiration || null,
      emplacement:        form.emplacement || null,
      ordonnance_requise: form.ordonnance_requise,
    }
    if (selected) {
      await supabase.from('pharmacie_medicaments').update(payload).eq('id', selected.id)
    } else {
      await supabase.from('pharmacie_medicaments').insert(payload)
    }
    setSaving(false); setShowModal(false); load()
  }

  async function adjustStock(id: string, delta: number) {
    const med = meds.find(m => m.id === id)
    if (!med) return
    const newStock = Math.max(0, med.stock_actuel + delta)
    await supabase.from('pharmacie_medicaments').update({ stock_actuel: newStock }).eq('id', id)
    load()
  }

  const today = new Date()
  const in30  = new Date(today.getTime() + 30 * 86400000)

  const filtered = meds.filter(m => {
    const matchSearch = !search || m.nom_commercial.toLowerCase().includes(search.toLowerCase()) ||
      (m.dci ?? '').toLowerCase().includes(search.toLowerCase())
    const matchAlerte = !filterAlerte || m.stock_actuel <= m.stock_min
    return matchSearch && matchAlerte
  })

  const alertes    = meds.filter(m => m.stock_actuel <= m.stock_min)
  const expirantot = meds.filter(m => m.date_expiration && new Date(m.date_expiration) <= in30)
  const valeurStock = meds.reduce((s, m) => s + m.stock_actuel * m.prix_achat, 0)

  if (tenantLoading || loading) {
    return <div className="min-h-screen bg-[#F5F7FB] flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-[#DC2626]" /></div>
  }

  return (
    <div className="min-h-screen bg-[#F5F7FB] p-4 md:p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/dashboard/sante" className="p-2 rounded-xl hover:bg-white border border-[#E5E7EB]">
            <ChevronLeft size={16} className="text-[#64748B]" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-[#0F172A] flex items-center gap-2">
              <Pill size={18} className="text-[#16A34A]" /> Pharmacie
            </h1>
            <p className="text-xs text-[#64748B]">{meds.length} médicaments · Stock évalué à {fmt(valeurStock)}</p>
          </div>
        </div>
        <button onClick={openNew}
          className="flex items-center gap-1.5 bg-[#DC2626] text-white px-4 py-2 rounded-xl text-xs font-semibold hover:bg-[#B91C1C]">
          <Plus size={14} /> Ajouter médicament
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white rounded-2xl border border-[#E5E7EB] p-4 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-[#FEF2F2] flex items-center justify-center"><AlertTriangle size={15} className="text-[#DC2626]" /></div>
          <div><p className="text-lg font-bold text-[#DC2626]">{alertes.length}</p><p className="text-[10px] text-[#94A3B8]">Stock faible</p></div>
        </div>
        <div className="bg-white rounded-2xl border border-[#E5E7EB] p-4 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-[#FFFBEB] flex items-center justify-center"><Calendar size={15} className="text-[#D97706]" /></div>
          <div><p className="text-lg font-bold text-[#D97706]">{expirantot.length}</p><p className="text-[10px] text-[#94A3B8]">Expirent bientôt</p></div>
        </div>
        <div className="bg-white rounded-2xl border border-[#E5E7EB] p-4 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-[#F0FDF4] flex items-center justify-center"><Package size={15} className="text-[#16A34A]" /></div>
          <div><p className="text-lg font-bold text-[#16A34A]">{fmt(valeurStock)}</p><p className="text-[10px] text-[#94A3B8]">Valeur stock</p></div>
        </div>
      </div>

      {/* Recherche + filtres */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Nom commercial, DCI…"
            className="w-full pl-8 pr-3 py-2 text-sm bg-white border border-[#E5E7EB] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#DC2626]/20" />
        </div>
        <button onClick={() => setFilterAlerte(v => !v)}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-colors ${filterAlerte ? 'bg-[#DC2626] text-white' : 'bg-white text-[#DC2626] border border-[#FCA5A5]'}`}>
          <AlertTriangle size={12} /> Alertes seulement ({alertes.length})
        </button>
      </div>

      {/* Tableau médicaments */}
      <div className="bg-white rounded-2xl border border-[#E5E7EB] overflow-hidden">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16">
            <Pill size={32} className="text-[#CBD5E1] mb-3" />
            <p className="text-sm text-[#94A3B8]">Aucun médicament trouvé</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#F1F5F9] bg-[#F8FAFC]">
                  {['Médicament', 'DCI / Forme', 'Stock', 'Prix vente', 'Expiration', 'Actions'].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-[11px] font-semibold text-[#64748B] uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F8FAFC]">
                {filtered.map(m => {
                  const stockFaible = m.stock_actuel <= m.stock_min
                  const expireBientot = m.date_expiration && new Date(m.date_expiration) <= in30
                  const estExpire = m.date_expiration && new Date(m.date_expiration) < today
                  return (
                    <tr key={m.id} className={`hover:bg-[#FAFAFA] transition-colors ${stockFaible ? 'bg-[#FFF9F9]' : ''}`}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-lg bg-[#F0FDF4] flex items-center justify-center flex-shrink-0">
                            <Pill size={13} className="text-[#16A34A]" />
                          </div>
                          <div>
                            <p className="text-xs font-semibold text-[#0F172A]">{m.nom_commercial}</p>
                            {m.ordonnance_requise && <span className="text-[9px] bg-[#EFF6FF] text-[#2563EB] px-1.5 py-0.5 rounded font-semibold">Ordonnance req.</span>}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-xs text-[#374151]">{m.dci ?? '—'}</p>
                        <p className="text-[10px] text-[#94A3B8] capitalize">{m.forme ?? '—'}{m.dosage ? ` · ${m.dosage}` : ''}</p>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div>
                            <p className={`text-sm font-bold ${stockFaible ? 'text-[#DC2626]' : 'text-[#0F172A]'}`}>{m.stock_actuel}</p>
                            <p className="text-[10px] text-[#94A3B8]">min: {m.stock_min}</p>
                          </div>
                          {stockFaible && <TrendingDown size={12} className="text-[#DC2626]" />}
                        </div>
                        <div className="flex gap-1 mt-1">
                          <button onClick={() => adjustStock(m.id, -1)} className="w-5 h-5 rounded text-xs font-bold bg-[#F1F5F9] hover:bg-[#E2E8F0] text-[#64748B]">−</button>
                          <button onClick={() => adjustStock(m.id, 1)}  className="w-5 h-5 rounded text-xs font-bold bg-[#F0FDF4] hover:bg-[#DCFCE7] text-[#16A34A]">+</button>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-[#374151] font-semibold">
                        {fmt(m.prix_vente)}
                      </td>
                      <td className="px-4 py-3">
                        {m.date_expiration ? (
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${estExpire ? 'bg-[#FEF2F2] text-[#DC2626]' : expireBientot ? 'bg-[#FFFBEB] text-[#D97706]' : 'bg-[#F1F5F9] text-[#64748B]'}`}>
                            {new Date(m.date_expiration).toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' })}
                            {estExpire ? ' ⚠ EXPIRÉ' : ''}
                          </span>
                        ) : <span className="text-xs text-[#94A3B8]">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        <button onClick={() => openEdit(m)}
                          className="text-xs text-[#2563EB] border border-[#BFDBFE] px-2.5 py-1 rounded-lg hover:bg-[#EFF6FF]">
                          Modifier
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal ajout/modif */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-[#E5E7EB] sticky top-0 bg-white z-10">
              <h2 className="text-sm font-bold text-[#0F172A] flex items-center gap-2">
                <Pill size={14} className="text-[#16A34A]" />
                {selected ? 'Modifier le médicament' : 'Nouveau médicament'}
              </h2>
              <button onClick={() => setShowModal(false)}><X size={18} className="text-[#94A3B8]" /></button>
            </div>
            <div className="p-5 space-y-4">
              {error && <div className="bg-[#FEF2F2] text-[#DC2626] text-xs px-3 py-2 rounded-xl flex items-center gap-2"><AlertTriangle size={13} />{error}</div>}

              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="text-[11px] font-semibold text-[#374151] mb-1 block">Nom commercial *</label>
                  <input value={form.nom_commercial} onChange={e => setF('nom_commercial', e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-[#E5E7EB] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#DC2626]/20" />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-[#374151] mb-1 block">DCI (générique)</label>
                  <input value={form.dci} onChange={e => setF('dci', e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-[#E5E7EB] rounded-xl focus:outline-none" />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-[#374151] mb-1 block">Forme galénique</label>
                  <select value={form.forme} onChange={e => setF('forme', e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-[#E5E7EB] rounded-xl bg-white focus:outline-none">
                    {FORMES.map(f => <option key={f} value={f}>{f}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-[#374151] mb-1 block">Dosage</label>
                  <input value={form.dosage} onChange={e => setF('dosage', e.target.value)}
                    placeholder="ex: 500mg, 10mg/5ml"
                    className="w-full px-3 py-2 text-xs border border-[#E5E7EB] rounded-xl focus:outline-none" />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-[#374151] mb-1 block">Laboratoire</label>
                  <input value={form.laboratoire} onChange={e => setF('laboratoire', e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-[#E5E7EB] rounded-xl focus:outline-none" />
                </div>
              </div>

              <div className="grid grid-cols-4 gap-3">
                {([['prix_achat','Prix achat (FCFA)'],['prix_vente','Prix vente (FCFA)'],['stock_actuel','Stock actuel'],['stock_min','Stock min.']] as const).map(([k, label]) => (
                  <div key={k}>
                    <label className="text-[10px] font-semibold text-[#374151] mb-1 block">{label}</label>
                    <input type="number" value={form[k] as string} onChange={e => setF(k, e.target.value)} min={0}
                      className="w-full px-2 py-1.5 text-xs border border-[#E5E7EB] rounded-lg focus:outline-none" />
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-semibold text-[#374151] mb-1 block">Date d'expiration</label>
                  <input type="date" value={form.date_expiration} onChange={e => setF('date_expiration', e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-[#E5E7EB] rounded-xl focus:outline-none" />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-[#374151] mb-1 block">Emplacement (étagère)</label>
                  <input value={form.emplacement} onChange={e => setF('emplacement', e.target.value)}
                    placeholder="ex: Rayon A3"
                    className="w-full px-3 py-2 text-xs border border-[#E5E7EB] rounded-xl focus:outline-none" />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <input type="checkbox" id="ordo_req" checked={form.ordonnance_requise as boolean}
                  onChange={e => setF('ordonnance_requise', e.target.checked)}
                  className="w-4 h-4 accent-[#DC2626]" />
                <label htmlFor="ordo_req" className="text-xs text-[#374151]">Vente sur ordonnance obligatoire</label>
              </div>
            </div>
            <div className="flex justify-end gap-2 px-5 pb-5">
              <button onClick={() => setShowModal(false)}
                className="px-4 py-2 text-xs font-semibold text-[#64748B] border border-[#E5E7EB] rounded-xl hover:bg-[#F8FAFC]">
                Annuler
              </button>
              <button onClick={handleSave} disabled={saving}
                className="px-4 py-2 text-xs font-semibold bg-[#DC2626] text-white rounded-xl hover:bg-[#B91C1C] disabled:opacity-50">
                {saving ? 'Enregistrement…' : selected ? 'Mettre à jour' : 'Ajouter'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}

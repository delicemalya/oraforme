'use client'

import { useState, useEffect, useCallback } from 'react'
import { useFmt } from '@/lib/hooks/useFmt'
import Link from 'next/link'
import { Globe, Plus, Search, RefreshCw, Loader2, X, Edit3, CheckCircle } from 'lucide-react'

interface Bailleur {
  id: string; nom: string; type_bailleur: string; pays: string | null
  contact_nom: string | null; contact_email: string | null; contact_tel: string | null
  montant_engage: number; devise: string; statut: 'actif' | 'inactif' | 'potentiel'
  notes: string | null; created_at: string
}

const TYPE_LABELS: Record<string, string> = {
  gouvernement: 'Gouvernemental', multilateral: 'Multilatéral', bilateral: 'Bilatéral',
  fondation: 'Fondation', prive: 'Privé', diaspora: 'Diaspora', autre: 'Autre',
}
const TYPE_COLORS: Record<string, string> = {
  gouvernement: '#2563EB', multilateral: '#7C3AED', bilateral: '#0891B2',
  fondation: '#D97706', prive: '#16A34A', diaspora: '#DB2777', autre: '#64748B',
}
const STATUT_STYLE: Record<string, { bg: string; color: string }> = {
  actif:     { bg: '#F0FDF4', color: '#16A34A' },
  inactif:   { bg: '#F8FAFC', color: '#64748B' },
  potentiel: { bg: '#FFF7ED', color: '#D97706' },
}

function ModalBailleur({ bailleur, onClose, onSaved }: { bailleur: Bailleur | null; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    nom:           bailleur?.nom           ?? '',
    type_bailleur: bailleur?.type_bailleur ?? 'prive',
    pays:          bailleur?.pays          ?? '',
    contact_nom:   bailleur?.contact_nom   ?? '',
    contact_email: bailleur?.contact_email ?? '',
    contact_tel:   bailleur?.contact_tel   ?? '',
    montant_engage:bailleur?.montant_engage?.toString() ?? '0',
    devise:        bailleur?.devise        ?? 'XAF',
    statut:        bailleur?.statut        ?? 'actif' as Bailleur['statut'],
    notes:         bailleur?.notes         ?? '',
  })
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    if (!form.nom) return
    setSaving(true)
    const payload = {
      nom: form.nom, type_bailleur: form.type_bailleur, pays: form.pays || null,
      contact_nom: form.contact_nom || null, contact_email: form.contact_email || null, contact_tel: form.contact_tel || null,
      montant_engage: parseFloat(form.montant_engage) || 0, devise: form.devise, statut: form.statut, notes: form.notes || null,
    }
    if (bailleur) {
      await fetch('/api/ong/bailleurs', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: bailleur.id, ...payload }) })
    } else {
      await fetch('/api/ong/bailleurs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
    }
    setSaving(false)
    onSaved()
  }

  const I = 'w-full px-3 py-2.5 text-[13px] border border-[#E2E8F0] rounded-xl focus:outline-none focus:ring-2 focus:ring-green-200 bg-white'

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#E2E8F0] sticky top-0 bg-white">
          <h2 className="font-black text-[15px]">{bailleur ? 'Modifier bailleur' : 'Nouveau bailleur'}</h2>
          <button onClick={onClose}><X size={16} /></button>
        </div>
        <div className="p-5 space-y-3">
          <div>
            <label className="block text-[11px] font-bold mb-1.5">Nom du bailleur *</label>
            <input value={form.nom} onChange={e => setForm(f => ({ ...f, nom: e.target.value }))} className={I} placeholder="Ex: Banque Mondiale, UE, USAID..." />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold mb-1.5">Type</label>
              <select value={form.type_bailleur} onChange={e => setForm(f => ({ ...f, type_bailleur: e.target.value }))} className={I}>
                {Object.entries(TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-bold mb-1.5">Pays</label>
              <input value={form.pays} onChange={e => setForm(f => ({ ...f, pays: e.target.value }))} className={I} placeholder="France, USA..." />
            </div>
          </div>
          <div className="border-t border-[#F1F5F9] pt-3">
            <p className="text-[11px] font-bold text-[#64748B] mb-2">Contact principal</p>
            <div className="space-y-2">
              <input value={form.contact_nom} onChange={e => setForm(f => ({ ...f, contact_nom: e.target.value }))} className={I} placeholder="Nom du responsable" />
              <input type="email" value={form.contact_email} onChange={e => setForm(f => ({ ...f, contact_email: e.target.value }))} className={I} placeholder="Email" />
              <input value={form.contact_tel} onChange={e => setForm(f => ({ ...f, contact_tel: e.target.value }))} className={I} placeholder="Téléphone" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold mb-1.5">Montant engagé</label>
              <input type="number" value={form.montant_engage} onChange={e => setForm(f => ({ ...f, montant_engage: e.target.value }))} className={I} />
            </div>
            <div>
              <label className="block text-[11px] font-bold mb-1.5">Devise</label>
              <select value={form.devise} onChange={e => setForm(f => ({ ...f, devise: e.target.value }))} className={I}>
                {['XAF','USD','EUR','GBP','XOF','NGN'].map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-[11px] font-bold mb-1.5">Statut</label>
            <select value={form.statut} onChange={e => setForm(f => ({ ...f, statut: e.target.value as Bailleur['statut'] }))} className={I}>
              <option value="actif">Actif</option>
              <option value="potentiel">Potentiel</option>
              <option value="inactif">Inactif</option>
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-bold mb-1.5">Notes</label>
            <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={3} className={`${I} resize-none`} placeholder="Conditions, projets associés..." />
          </div>
          <button onClick={handleSave} disabled={!form.nom || saving}
            className="w-full py-2.5 bg-green-700 text-white rounded-xl text-[13px] font-bold disabled:opacity-40 flex items-center justify-center gap-2 hover:bg-green-800">
            {saving ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle size={13} />}
            {bailleur ? 'Enregistrer' : 'Ajouter le bailleur'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function OngBailleursPage() {
  const { fmt } = useFmt()
  const [bailleurs, setBailleurs] = useState<Bailleur[]>([])
  const [loading,   setLoading]   = useState(true)
  const [search,    setSearch]    = useState('')
  const [filterType,setFilterType]= useState('tous')
  const [modal,     setModal]     = useState(false)
  const [edit,      setEdit]      = useState<Bailleur | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/ong/bailleurs')
    const json = await res.json()
    setBailleurs(json.data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const types = [...new Set(bailleurs.map(b => b.type_bailleur))]

  const filtered = bailleurs.filter(b => {
    const q = search.toLowerCase()
    const matchQ = !q || b.nom.toLowerCase().includes(q) || b.pays?.toLowerCase().includes(q) || b.contact_nom?.toLowerCase().includes(q)
    const matchT = filterType === 'tous' || b.type_bailleur === filterType
    return matchQ && matchT
  })

  const totalEngage = bailleurs.filter(b => b.statut === 'actif').reduce((s, b) => s + b.montant_engage, 0)
  const actifs      = bailleurs.filter(b => b.statut === 'actif').length
  const potentiels  = bailleurs.filter(b => b.statut === 'potentiel').length

  return (
    <div className="min-h-screen bg-[#F8FAFC] pb-20">
      <div className="bg-white border-b border-[#E2E8F0] px-4 sm:px-6 py-4 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link href="/dashboard/ong" className="text-[#64748B] text-[13px]">← ONG</Link>
            <span className="text-[#E2E8F0]">/</span>
            <div className="flex items-center gap-2">
              <Globe size={16} className="text-green-700" />
              <h1 className="text-[16px] font-black">Bailleurs & Donateurs</h1>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={load} className="p-2 border border-[#E2E8F0] rounded-xl text-[#64748B]">{loading ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}</button>
            <button onClick={() => { setEdit(null); setModal(true) }}
              className="flex items-center gap-1.5 px-4 py-2 bg-green-700 text-white rounded-xl text-[13px] font-bold hover:bg-green-800">
              <Plus size={14} /> Nouveau bailleur
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-5">

        {/* KPIs */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-white rounded-2xl p-4 border border-[#E2E8F0] shadow-sm">
            <p className="text-[10px] font-bold text-[#64748B] uppercase mb-1">Total bailleurs</p>
            <p className="text-[22px] font-black text-[#0F172A]">{bailleurs.length}</p>
          </div>
          <div className="bg-white rounded-2xl p-4 border border-[#E2E8F0] shadow-sm">
            <p className="text-[10px] font-bold text-[#64748B] uppercase mb-1">Actifs</p>
            <p className="text-[22px] font-black text-green-600">{actifs}</p>
          </div>
          <div className="bg-white rounded-2xl p-4 border border-[#E2E8F0] shadow-sm">
            <p className="text-[10px] font-bold text-[#64748B] uppercase mb-1">Potentiels</p>
            <p className="text-[22px] font-black text-amber-600">{potentiels}</p>
          </div>
          <div className="bg-white rounded-2xl p-4 border border-[#E2E8F0] shadow-sm">
            <p className="text-[10px] font-bold text-[#64748B] uppercase mb-1">Montant engagé</p>
            <p className="text-[18px] font-black text-[#0F172A]">{fmt(totalEngage)}</p>
            <p className="text-[10px] text-[#94A3B8]">bailleurs actifs</p>
          </div>
        </div>

        {/* Filtres */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Nom, pays, contact..."
              className="w-full pl-9 pr-4 py-2.5 text-[13px] border border-[#E2E8F0] rounded-xl focus:outline-none focus:ring-2 focus:ring-green-200 bg-white" />
          </div>
          <select value={filterType} onChange={e => setFilterType(e.target.value)}
            className="px-3 py-2.5 text-[12px] border border-[#E2E8F0] rounded-xl bg-white">
            <option value="tous">Tous types</option>
            {types.map(t => <option key={t} value={t}>{TYPE_LABELS[t] ?? t}</option>)}
          </select>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16 text-[#94A3B8]"><Loader2 size={18} className="animate-spin" /></div>
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-2xl border border-dashed border-[#CBD5E1] p-16 text-center">
            <Globe size={40} className="text-[#CBD5E1] mx-auto mb-3" />
            <p className="font-bold text-[#0F172A] mb-1">Aucun bailleur</p>
            <button onClick={() => { setEdit(null); setModal(true) }}
              className="mt-3 inline-flex items-center gap-1.5 px-4 py-2.5 bg-green-700 text-white rounded-xl text-[13px] font-bold">
              <Plus size={13} /> Ajouter
            </button>
          </div>
        ) : (
          <>
            {/* Desktop */}
            <div className="hidden sm:block bg-white rounded-2xl border border-[#E2E8F0] shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-[12px] min-w-[700px]">
                  <thead className="bg-[#F8FAFC] text-[#64748B] font-bold border-b border-[#E2E8F0]">
                    <tr>
                      <th className="text-left px-4 py-3">Bailleur</th>
                      <th className="text-left px-4 py-3">Type</th>
                      <th className="text-left px-4 py-3">Pays</th>
                      <th className="text-left px-4 py-3">Contact</th>
                      <th className="text-right px-4 py-3">Montant engagé</th>
                      <th className="text-left px-4 py-3">Statut</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F1F5F9]">
                    {filtered.map(b => {
                      const ss = STATUT_STYLE[b.statut]
                      const tc = TYPE_COLORS[b.type_bailleur] ?? '#64748B'
                      return (
                        <tr key={b.id} className="hover:bg-[#F8FAFC] group">
                          <td className="px-4 py-3">
                            <p className="font-black text-[#0F172A]">{b.nom}</p>
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-[10px] px-2 py-0.5 rounded-full font-bold" style={{ background: tc + '18', color: tc }}>{TYPE_LABELS[b.type_bailleur] ?? b.type_bailleur}</span>
                          </td>
                          <td className="px-4 py-3 text-[#64748B]">{b.pays ?? '—'}</td>
                          <td className="px-4 py-3">
                            {b.contact_nom && <p className="text-[#0F172A] font-semibold">{b.contact_nom}</p>}
                            {b.contact_email && <p className="text-[#94A3B8] text-[10px]">{b.contact_email}</p>}
                          </td>
                          <td className="px-4 py-3 text-right font-black text-[#0F172A]">
                            {b.montant_engage > 0 ? `${fmt(b.montant_engage)} ${b.devise}` : '—'}
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-[10px] px-2 py-0.5 rounded-full font-bold" style={ss}>{b.statut}</span>
                          </td>
                          <td className="px-4 py-3">
                            <button onClick={() => { setEdit(b); setModal(true) }} className="p-1.5 rounded-lg hover:bg-[#F1F5F9] text-[#94A3B8] opacity-0 group-hover:opacity-100">
                              <Edit3 size={12} />
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Mobile */}
            <div className="sm:hidden space-y-3">
              {filtered.map(b => {
                const ss = STATUT_STYLE[b.statut]
                const tc = TYPE_COLORS[b.type_bailleur] ?? '#64748B'
                return (
                  <div key={b.id} className="bg-white rounded-2xl border border-[#E2E8F0] shadow-sm p-4"
                    onClick={() => { setEdit(b); setModal(true) }}>
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div>
                        <p className="font-black text-[13px] text-[#0F172A]">{b.nom}</p>
                        <span className="text-[10px] px-1.5 py-0.5 rounded font-bold mt-1 inline-block" style={{ background: tc + '18', color: tc }}>{TYPE_LABELS[b.type_bailleur] ?? b.type_bailleur}</span>
                      </div>
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-bold flex-shrink-0" style={ss}>{b.statut}</span>
                    </div>
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-[#64748B]">{b.pays ?? ''} {b.contact_nom ? `• ${b.contact_nom}` : ''}</span>
                      {b.montant_engage > 0 && <span className="font-black text-[#0F172A]">{fmt(b.montant_engage)} {b.devise}</span>}
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>

      {modal && <ModalBailleur bailleur={edit} onClose={() => setModal(false)} onSaved={() => { setModal(false); load() }} />}
    </div>
  )
}

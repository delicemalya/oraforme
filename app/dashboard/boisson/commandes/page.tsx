'use client'

import { useState, useEffect, useCallback } from 'react'
import { useFmt } from '@/lib/hooks/useFmt'
import Link from 'next/link'
import { ShoppingCart, Plus, Search, RefreshCw, Loader2, X, CheckCircle, Edit3 } from 'lucide-react'

interface Commande {
  id: string; client_nom: string; client_telephone: string | null
  adresse_livraison: string | null; date_livraison: string | null
  montant_total: number; statut: 'nouvelle' | 'confirmee' | 'en_livraison' | 'livree' | 'annulee'
  notes: string | null; created_at: string
}

const STATUT_LABELS: Record<string, string> = {
  nouvelle: 'Nouvelle', confirmee: 'Confirmée', en_livraison: 'En livraison', livree: 'Livrée', annulee: 'Annulée'
}
const STATUT_STYLE: Record<string, { bg: string; color: string }> = {
  nouvelle:     { bg: '#EFF6FF', color: '#2563EB' },
  confirmee:    { bg: '#FFF7ED', color: '#D97706' },
  en_livraison: { bg: '#F0F9FF', color: '#0284C7' },
  livree:       { bg: '#F0FDF4', color: '#16A34A' },
  annulee:      { bg: '#FEF2F2', color: '#DC2626' },
}
const fmtDate = (d: string | null) => d ? new Date(d).toLocaleDateString('fr-FR') : '—'

function ModalCommande({ commande, onClose, onSaved }: { commande: Commande | null; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    client_nom:       commande?.client_nom       ?? '',
    client_telephone: commande?.client_telephone ?? '',
    adresse_livraison:commande?.adresse_livraison?? '',
    date_livraison:   commande?.date_livraison   ?? '',
    montant_total:    commande?.montant_total?.toString() ?? '',
    statut:           commande?.statut           ?? 'nouvelle' as Commande['statut'],
    notes:            commande?.notes            ?? '',
  })
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    if (!form.client_nom) return
    setSaving(true)
    const payload = {
      client_nom: form.client_nom, client_telephone: form.client_telephone || null,
      adresse_livraison: form.adresse_livraison || null, date_livraison: form.date_livraison || null,
      montant_total: parseFloat(form.montant_total) || 0, statut: form.statut, notes: form.notes || null,
    }
    if (commande) {
      await fetch('/api/boisson/commandes', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: commande.id, ...payload }) })
    } else {
      await fetch('/api/boisson/commandes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
    }
    setSaving(false)
    onSaved()
  }

  const I = 'w-full px-3 py-2.5 text-[13px] border border-[#E2E8F0] rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-200 bg-white'

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#E2E8F0] sticky top-0 bg-white">
          <h2 className="font-black text-[15px]">{commande ? 'Modifier commande' : 'Nouvelle commande'}</h2>
          <button onClick={onClose}><X size={16} /></button>
        </div>
        <div className="p-5 space-y-3">
          <div>
            <label className="block text-[11px] font-bold mb-1.5">Client *</label>
            <input value={form.client_nom} onChange={e => setForm(f => ({ ...f, client_nom: e.target.value }))} className={I} placeholder="Nom du client / bar / épicerie" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold mb-1.5">Téléphone</label>
              <input value={form.client_telephone} onChange={e => setForm(f => ({ ...f, client_telephone: e.target.value }))} className={I} />
            </div>
            <div>
              <label className="block text-[11px] font-bold mb-1.5">Date livraison</label>
              <input type="date" value={form.date_livraison} onChange={e => setForm(f => ({ ...f, date_livraison: e.target.value }))} className={I} />
            </div>
          </div>
          <div>
            <label className="block text-[11px] font-bold mb-1.5">Adresse de livraison</label>
            <input value={form.adresse_livraison} onChange={e => setForm(f => ({ ...f, adresse_livraison: e.target.value }))} className={I} placeholder="Quartier, avenue..." />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold mb-1.5">Montant (FCFA)</label>
              <input type="number" value={form.montant_total} onChange={e => setForm(f => ({ ...f, montant_total: e.target.value }))} className={I} />
            </div>
            <div>
              <label className="block text-[11px] font-bold mb-1.5">Statut</label>
              <select value={form.statut} onChange={e => setForm(f => ({ ...f, statut: e.target.value as Commande['statut'] }))} className={I}>
                {Object.entries(STATUT_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-[11px] font-bold mb-1.5">Notes</label>
            <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} className={`${I} resize-none`} placeholder="Produits, quantités, instructions..." />
          </div>
          <button onClick={handleSave} disabled={!form.client_nom || saving}
            className="w-full py-2.5 bg-amber-600 text-white rounded-xl text-[13px] font-bold disabled:opacity-40 flex items-center justify-center gap-2 hover:bg-amber-700">
            {saving ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle size={13} />}
            {commande ? 'Enregistrer' : 'Créer la commande'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function BoissonCommandesPage() {
  const { fmt } = useFmt()
  const [commandes, setCommandes] = useState<Commande[]>([])
  const [loading,   setLoading]   = useState(true)
  const [search,    setSearch]    = useState('')
  const [filterSt,  setFilterSt]  = useState('tous')
  const [modal,     setModal]     = useState(false)
  const [edit,      setEdit]      = useState<Commande | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const url = filterSt !== 'tous' ? `/api/boisson/commandes?statut=${filterSt}` : '/api/boisson/commandes'
    const res = await fetch(url)
    const json = await res.json()
    setCommandes(json.data ?? [])
    setLoading(false)
  }, [filterSt])

  useEffect(() => { load() }, [load])

  const filtered = search
    ? commandes.filter(c => c.client_nom.toLowerCase().includes(search.toLowerCase()) || c.adresse_livraison?.toLowerCase().includes(search.toLowerCase()))
    : commandes

  const totalJour = commandes.filter(c => {
    const today = new Date().toISOString().split('T')[0]
    return c.created_at?.startsWith(today) && c.statut !== 'annulee'
  }).reduce((s, c) => s + c.montant_total, 0)
  const enAttente   = commandes.filter(c => ['nouvelle', 'confirmee'].includes(c.statut)).length
  const enLivraison = commandes.filter(c => c.statut === 'en_livraison').length

  return (
    <div className="min-h-screen bg-[#F8FAFC] pb-20">
      <div className="bg-white border-b border-[#E2E8F0] px-4 sm:px-6 py-4 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link href="/dashboard/boisson" className="text-[#64748B] text-[13px]">← Boissons</Link>
            <span className="text-[#E2E8F0]">/</span>
            <div className="flex items-center gap-2">
              <ShoppingCart size={16} className="text-amber-600" />
              <h1 className="text-[16px] font-black">Commandes</h1>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={load} className="p-2 border border-[#E2E8F0] rounded-xl text-[#64748B]">{loading ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}</button>
            <button onClick={() => { setEdit(null); setModal(true) }}
              className="flex items-center gap-1.5 px-4 py-2 bg-amber-600 text-white rounded-xl text-[13px] font-bold hover:bg-amber-700">
              <Plus size={14} /> Nouvelle commande
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-5">

        {/* KPIs */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-white rounded-2xl p-4 border border-[#E2E8F0] shadow-sm">
            <p className="text-[10px] font-bold text-[#64748B] uppercase mb-1">CA aujourd'hui</p>
            <p className="text-[20px] font-black text-[#0F172A]">{fmt(totalJour)}</p>
          </div>
          <div className="bg-white rounded-2xl p-4 border border-[#E2E8F0] shadow-sm">
            <p className="text-[10px] font-bold text-[#64748B] uppercase mb-1">Total commandes</p>
            <p className="text-[22px] font-black text-[#0F172A]">{commandes.length}</p>
          </div>
          <div className="bg-white rounded-2xl p-4 border border-[#E2E8F0] shadow-sm">
            <p className="text-[10px] font-bold text-[#64748B] uppercase mb-1">En attente</p>
            <p className="text-[22px] font-black text-amber-600">{enAttente}</p>
          </div>
          <div className="bg-white rounded-2xl p-4 border border-[#E2E8F0] shadow-sm">
            <p className="text-[10px] font-bold text-[#64748B] uppercase mb-1">En livraison</p>
            <p className="text-[22px] font-black text-blue-600">{enLivraison}</p>
          </div>
        </div>

        {/* Filtres */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Client, adresse..."
              className="w-full pl-9 pr-4 py-2.5 text-[13px] border border-[#E2E8F0] rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-200 bg-white" />
          </div>
          <div className="flex gap-2 flex-wrap">
            {['tous', ...Object.keys(STATUT_LABELS)].map(s => (
              <button key={s} onClick={() => setFilterSt(s)}
                className={`px-3 py-2 rounded-xl text-[12px] font-semibold border transition-colors ${filterSt === s ? 'bg-amber-600 text-white border-amber-600' : 'bg-white text-[#64748B] border-[#E2E8F0]'}`}>
                {s === 'tous' ? 'Tous' : STATUT_LABELS[s]}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16 text-[#94A3B8]"><Loader2 size={18} className="animate-spin" /></div>
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-2xl border border-dashed border-[#CBD5E1] p-16 text-center">
            <ShoppingCart size={40} className="text-[#CBD5E1] mx-auto mb-3" />
            <p className="font-bold text-[#0F172A] mb-1">Aucune commande</p>
            <button onClick={() => { setEdit(null); setModal(true) }}
              className="mt-3 inline-flex items-center gap-1.5 px-4 py-2.5 bg-amber-600 text-white rounded-xl text-[13px] font-bold">
              <Plus size={13} /> Créer
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
                      <th className="text-left px-4 py-3">Date</th>
                      <th className="text-left px-4 py-3">Client</th>
                      <th className="text-left px-4 py-3">Adresse</th>
                      <th className="text-left px-4 py-3">Livraison</th>
                      <th className="text-right px-4 py-3">Montant</th>
                      <th className="text-left px-4 py-3">Statut</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F1F5F9]">
                    {filtered.map(c => {
                      const ss = STATUT_STYLE[c.statut]
                      return (
                        <tr key={c.id} className="hover:bg-[#F8FAFC] group">
                          <td className="px-4 py-3 text-[#64748B]">{fmtDate(c.created_at)}</td>
                          <td className="px-4 py-3">
                            <p className="font-bold text-[#0F172A]">{c.client_nom}</p>
                            {c.client_telephone && <p className="text-[10px] text-[#94A3B8]">{c.client_telephone}</p>}
                          </td>
                          <td className="px-4 py-3 text-[#64748B]">{c.adresse_livraison ?? '—'}</td>
                          <td className="px-4 py-3 text-[#64748B]">{fmtDate(c.date_livraison)}</td>
                          <td className="px-4 py-3 text-right font-black text-[#0F172A]">{fmt(c.montant_total)}</td>
                          <td className="px-4 py-3">
                            <select value={c.statut}
                              onChange={async e => {
                                await fetch('/api/boisson/commandes', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: c.id, statut: e.target.value }) })
                                load()
                              }}
                              className="text-[10px] px-2 py-1 rounded-lg border border-[#E2E8F0] font-bold"
                              style={ss}>
                              {Object.entries(STATUT_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                            </select>
                          </td>
                          <td className="px-4 py-3">
                            <button onClick={() => { setEdit(c); setModal(true) }} className="p-1.5 rounded-lg hover:bg-[#F1F5F9] text-[#94A3B8] opacity-0 group-hover:opacity-100">
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
              {filtered.map(c => {
                const ss = STATUT_STYLE[c.statut]
                return (
                  <div key={c.id} className="bg-white rounded-2xl border border-[#E2E8F0] shadow-sm p-4" onClick={() => { setEdit(c); setModal(true) }}>
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <p className="font-black text-[13px] text-[#0F172A]">{c.client_nom}</p>
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-bold flex-shrink-0" style={ss}>{STATUT_LABELS[c.statut]}</span>
                    </div>
                    <p className="text-[11px] text-[#94A3B8] mb-2">{c.adresse_livraison ?? ''} {c.date_livraison ? `• ${fmtDate(c.date_livraison)}` : ''}</p>
                    <div className="flex items-center justify-between text-[12px]">
                      <span className="text-[#64748B]">{fmtDate(c.created_at)}</span>
                      <span className="font-black text-[#0F172A]">{fmt(c.montant_total)}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>

      {modal && <ModalCommande commande={edit} onClose={() => setModal(false)} onSaved={() => { setModal(false); load() }} />}
    </div>
  )
}

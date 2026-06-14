'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useFmt } from '@/lib/hooks/useFmt'
import { useTenantContext } from '@/lib/contexts/TenantContext'
import Link from 'next/link'
import {
  Users, Plus, Search, RefreshCw, Loader2, X, CheckCircle, Edit3, Phone, Star,
} from 'lucide-react'

interface Client {
  id:          string
  nom:         string
  telephone:   string | null
  email:       string | null
  adresse:     string | null
  points:      number
  total_achats:number
  nb_visites:  number
  statut:      'actif' | 'inactif' | 'vip'
  created_at:  string
}

const STATUT_CFG: Record<Client['statut'], { label: string; color: string; bg: string }> = {
  actif:  { label: 'Actif', color: '#16A34A', bg: '#F0FDF4' },
  inactif:{ label: 'Inactif',color: '#64748B', bg: '#F8FAFC' },
  vip:    { label: 'VIP',   color: '#7C3AED', bg: '#F5F3FF' },
}

function ModalClient({
  client, onClose, onSaved,
}: { client: Client | null; onClose: () => void; onSaved: () => void }) {
  const { tenant } = useTenantContext()
  const [form, setForm] = useState({
    nom:       client?.nom       ?? '',
    telephone: client?.telephone ?? '',
    email:     client?.email     ?? '',
    adresse:   client?.adresse   ?? '',
    statut:    client?.statut    ?? 'actif' as Client['statut'],
  })
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    if (!form.nom) return
    setSaving(true)
    const data = {
      nom: form.nom, telephone: form.telephone || null,
      email: form.email || null, adresse: form.adresse || null, statut: form.statut,
    }
    if (client) {
      await supabase.from('commerce_clients').update(data).eq('id', client.id).eq('tenant_id', tenant?.tenantId)
    } else {
      await supabase.from('commerce_clients').insert({ ...data, tenant_id: tenant?.tenantId, points: 0, total_achats: 0, nb_visites: 0 })
    }
    setSaving(false)
    onSaved()
  }

  const I = 'w-full px-3 py-2.5 text-[13px] border border-[#E2E8F0] rounded-xl focus:outline-none focus:ring-2 focus:ring-red-300 bg-white'

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#E2E8F0]">
          <h2 className="font-black text-[15px]">{client ? 'Modifier client' : 'Nouveau client'}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-[#F1F5F9]"><X size={16} /></button>
        </div>
        <div className="p-5 space-y-3">
          <div>
            <label className="block text-[12px] font-bold mb-1.5">Nom / Entreprise *</label>
            <input value={form.nom} onChange={e => setForm(f => ({ ...f, nom: e.target.value }))} className={I} placeholder="Jean Dupont" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[12px] font-bold mb-1.5">Téléphone</label>
              <input value={form.telephone} onChange={e => setForm(f => ({ ...f, telephone: e.target.value }))} className={I} placeholder="+242 06..." />
            </div>
            <div>
              <label className="block text-[12px] font-bold mb-1.5">Email</label>
              <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} className={I} />
            </div>
          </div>
          <div>
            <label className="block text-[12px] font-bold mb-1.5">Adresse</label>
            <input value={form.adresse} onChange={e => setForm(f => ({ ...f, adresse: e.target.value }))} className={I} placeholder="Brazzaville, ..." />
          </div>
          <div>
            <label className="block text-[12px] font-bold mb-1.5">Statut</label>
            <select value={form.statut} onChange={e => setForm(f => ({ ...f, statut: e.target.value as Client['statut'] }))} className={I}>
              {Object.entries(STATUT_CFG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          </div>
          <button onClick={handleSave} disabled={!form.nom || saving}
            className="w-full py-2.5 bg-red-600 text-white rounded-xl text-[13px] font-bold hover:bg-red-700 disabled:opacity-40 flex items-center justify-center gap-1.5">
            {saving ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />}
            {client ? 'Enregistrer' : 'Créer le client'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function CommerceClientsPage() {
  const { fmt } = useFmt()
  const { tenant } = useTenantContext()
  const tid = tenant?.tenantId

  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [search,  setSearch]  = useState('')
  const [filter,  setFilter]  = useState('tous')
  const [modal,   setModal]   = useState(false)
  const [edit,    setEdit]    = useState<Client | null>(null)

  const load = useCallback(async () => {
    if (!tid) return
    setLoading(true)
    const { data } = await supabase.from('commerce_clients').select('*').eq('tenant_id', tid).order('total_achats', { ascending: false })
    setClients((data ?? []) as Client[])
    setLoading(false)
  }, [tid])

  useEffect(() => { load() }, [load])

  const filtered = clients.filter(c => {
    const q = search.toLowerCase()
    const matchQ = !q || c.nom.toLowerCase().includes(q) || c.telephone?.includes(q) || c.email?.toLowerCase().includes(q)
    const matchF = filter === 'tous' || c.statut === filter
    return matchQ && matchF
  })

  const totalCA  = clients.reduce((s, c) => s + (c.total_achats ?? 0), 0)
  const vips     = clients.filter(c => c.statut === 'vip').length
  const actifs   = clients.filter(c => c.statut === 'actif').length

  return (
    <div className="min-h-screen bg-[#F8FAFC] pb-20">
      <div className="bg-white border-b border-[#E2E8F0] px-4 sm:px-6 py-4 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link href="/dashboard/commerce" className="text-[#64748B] hover:text-[#0F172A] text-[13px]">← Commerce</Link>
            <span className="text-[#E2E8F0]">/</span>
            <div className="flex items-center gap-2">
              <Users size={16} className="text-red-600" />
              <h1 className="text-[16px] font-black text-[#0F172A]">Clients fidèles</h1>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={load} className="p-2 border border-[#E2E8F0] rounded-xl text-[#64748B]">{loading ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}</button>
            <button onClick={() => { setEdit(null); setModal(true) }}
              className="flex items-center gap-1.5 px-4 py-2 bg-red-600 text-white rounded-xl text-[13px] font-bold hover:bg-red-700">
              <Plus size={14} /> Nouveau client
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">

        {/* KPIs */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-white rounded-2xl p-4 border border-[#E2E8F0] shadow-sm">
            <p className="text-[10px] font-bold text-[#64748B] uppercase mb-1">Total clients</p>
            <p className="text-[22px] font-black text-[#0F172A]">{clients.length}</p>
          </div>
          <div className="bg-white rounded-2xl p-4 border border-[#E2E8F0] shadow-sm">
            <p className="text-[10px] font-bold text-[#64748B] uppercase mb-1">Actifs</p>
            <p className="text-[22px] font-black text-green-600">{actifs}</p>
          </div>
          <div className="bg-white rounded-2xl p-4 border border-[#E2E8F0] shadow-sm">
            <p className="text-[10px] font-bold text-[#64748B] uppercase mb-1">VIP</p>
            <p className="text-[22px] font-black text-purple-600">{vips}</p>
          </div>
          <div className="bg-white rounded-2xl p-4 border border-[#E2E8F0] shadow-sm">
            <p className="text-[10px] font-bold text-[#64748B] uppercase mb-1">CA cumulé</p>
            <p className="text-[20px] font-black text-[#0F172A]">{fmt(totalCA)}</p>
          </div>
        </div>

        {/* Filtres */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Nom, téléphone, email..."
              className="w-full pl-9 pr-4 py-2.5 text-[13px] border border-[#E2E8F0] rounded-xl focus:outline-none focus:ring-2 focus:ring-red-300 bg-white" />
          </div>
          <div className="flex gap-1 bg-[#F1F5F9] rounded-xl p-1">
            {[['tous', 'Tous'], ...Object.entries(STATUT_CFG).map(([k, v]) => [k, v.label])].map(([k, label]) => (
              <button key={k} onClick={() => setFilter(k)}
                className={`px-2.5 py-1.5 rounded-lg text-[11px] font-semibold whitespace-nowrap transition-all ${filter === k ? 'bg-white text-[#0F172A] shadow-sm' : 'text-[#64748B]'}`}>
                {label}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16 gap-2 text-[#94A3B8]"><Loader2 size={18} className="animate-spin" /></div>
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-2xl border border-dashed border-[#CBD5E1] p-16 text-center">
            <Users size={40} className="text-[#CBD5E1] mx-auto mb-3" />
            <p className="font-bold text-[#0F172A] mb-1">Aucun client enregistré</p>
            <button onClick={() => { setEdit(null); setModal(true) }}
              className="mt-3 inline-flex items-center gap-1.5 px-4 py-2.5 bg-red-600 text-white rounded-xl text-[13px] font-bold">
              <Plus size={13} /> Ajouter
            </button>
          </div>
        ) : (
          <>
            {/* Desktop */}
            <div className="hidden sm:block bg-white rounded-2xl border border-[#E2E8F0] shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
              <table className="w-full text-[12px] min-w-[640px]">
                <thead className="bg-[#F8FAFC] text-[#64748B] font-bold border-b border-[#E2E8F0]">
                  <tr>
                    <th className="text-left px-4 py-2.5">Client</th>
                    <th className="text-left px-4 py-2.5">Contact</th>
                    <th className="text-right px-4 py-2.5">Visites</th>
                    <th className="text-right px-4 py-2.5">Total achats</th>
                    <th className="text-right px-4 py-2.5">Points</th>
                    <th className="text-left px-4 py-2.5">Statut</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F1F5F9]">
                  {filtered.map(c => {
                    const sc = STATUT_CFG[c.statut]
                    return (
                      <tr key={c.id} className="hover:bg-[#F8FAFC] group">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2.5">
                            <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-[11px] font-black text-white flex-shrink-0 ${c.statut === 'vip' ? 'bg-purple-500' : 'bg-red-500'}`}>
                              {c.nom.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <p className="font-bold text-[#0F172A]">{c.nom}</p>
                              {c.adresse && <p className="text-[10px] text-[#94A3B8]">{c.adresse}</p>}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-[#64748B]">
                          {c.telephone && <p className="flex items-center gap-1"><Phone size={10} />{c.telephone}</p>}
                          {c.email && <p className="text-[10px] text-[#94A3B8]">{c.email}</p>}
                        </td>
                        <td className="px-4 py-3 text-right">{c.nb_visites ?? 0}</td>
                        <td className="px-4 py-3 text-right font-black text-[#0F172A]">{fmt(c.total_achats ?? 0)}</td>
                        <td className="px-4 py-3 text-right">
                          <span className="flex items-center justify-end gap-1 font-bold text-amber-600">
                            <Star size={11} fill="currentColor" /> {c.points ?? 0}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-[10px] px-2 py-0.5 rounded-full font-bold" style={{ background: sc.bg, color: sc.color }}>{sc.label}</span>
                        </td>
                        <td className="px-4 py-3">
                          <button onClick={() => { setEdit(c); setModal(true) }}
                            className="p-1.5 rounded-lg hover:bg-[#F1F5F9] text-[#94A3B8] opacity-0 group-hover:opacity-100">
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

            {/* Mobile cards */}
            <div className="sm:hidden space-y-3">
              {filtered.map(c => {
                const sc = STATUT_CFG[c.statut]
                return (
                  <div key={c.id} className="bg-white rounded-2xl border border-[#E2E8F0] shadow-sm p-4" onClick={() => { setEdit(c); setModal(true) }}>
                    <div className="flex items-center gap-3 mb-2">
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-[12px] font-black text-white flex-shrink-0 ${c.statut === 'vip' ? 'bg-purple-500' : 'bg-red-500'}`}>
                        {c.nom.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <p className="font-black text-[13px] text-[#0F172A] truncate">{c.nom}</p>
                          <span className="text-[10px] px-2 py-0.5 rounded-full font-bold flex-shrink-0 ml-2" style={{ background: sc.bg, color: sc.color }}>{sc.label}</span>
                        </div>
                        {c.telephone && <p className="text-[11px] text-[#64748B]">{c.telephone}</p>}
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-[12px]">
                      <span className="text-[#64748B]">{c.nb_visites ?? 0} visites</span>
                      <div className="flex items-center gap-3">
                        <span className="flex items-center gap-1 text-amber-600 font-bold"><Star size={11} fill="currentColor" />{c.points ?? 0}</span>
                        <span className="font-black text-[#0F172A]">{fmt(c.total_achats ?? 0)}</span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>

      {modal && <ModalClient client={edit} onClose={() => setModal(false)} onSaved={() => { setModal(false); load() }} />}
    </div>
  )
}

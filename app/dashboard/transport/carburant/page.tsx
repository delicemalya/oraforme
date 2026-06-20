'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useFmt } from '@/lib/hooks/useFmt'
import { useTenantContext } from '@/lib/contexts/TenantContext'
import Link from 'next/link'
import {
  Fuel, Plus, Search, RefreshCw, Loader2, X, CheckCircle, TrendingDown, TrendingUp,
} from 'lucide-react'

interface Ravitaillement {
  id:           string
  date:         string
  vehicule_id:  string | null
  vehicule_imm: string | null
  chauffeur_id: string | null
  chauffeur_nom:string | null
  litres:       number
  prix_litre:   number
  total:        number
  km_au_plein:  number | null
  type_carburant:'essence' | 'diesel' | 'gpl'
  station:      string | null
  notes:        string | null
}

interface Vehicule { id: string; immatriculation: string; marque: string }
interface Chauffeur { id: string; nom: string }

function ModalRavitaillement({
  vehicules, chauffeurs, onClose, onSaved,
}: {
  vehicules: Vehicule[]
  chauffeurs: Chauffeur[]
  onClose: () => void
  onSaved: () => void
}) {
  const { tenant } = useTenantContext()
  const [form, setForm] = useState({
    date:         new Date().toISOString().split('T')[0],
    vehicule_id:  '',
    chauffeur_id: '',
    litres:       '',
    prix_litre:   '',
    km_au_plein:  '',
    type_carburant: 'diesel' as const,
    station:      '',
    notes:        '',
  })
  const [saving, setSaving] = useState(false)

  const total = (parseFloat(form.litres) || 0) * (parseFloat(form.prix_litre) || 0)

  async function handleSave() {
    if (!form.litres || !form.prix_litre) return
    setSaving(true)
    const v = vehicules.find(x => x.id === form.vehicule_id)
    const c = chauffeurs.find(x => x.id === form.chauffeur_id)
    await supabase.from('transport_carburant').insert({
      tenant_id:      tenant?.tenantId,
      date:           form.date,
      vehicule_id:    form.vehicule_id  || null,
      vehicule_imm:   v ? `${v.immatriculation} ${v.marque}` : null,
      chauffeur_id:   form.chauffeur_id || null,
      chauffeur_nom:  c?.nom ?? null,
      litres:         parseFloat(form.litres),
      prix_litre:     parseFloat(form.prix_litre),
      total,
      km_au_plein:    form.km_au_plein ? parseInt(form.km_au_plein) : null,
      type_carburant: form.type_carburant,
      station:        form.station || null,
      notes:          form.notes   || null,
    })
    setSaving(false)
    onSaved()
  }

  const I = 'w-full px-3 py-2.5 text-[13px] border border-[#E2E8F0] rounded-xl focus:outline-none focus:ring-2 focus:ring-red-300 bg-white'

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#E2E8F0] sticky top-0 bg-white">
          <h2 className="font-black text-[15px]">Ravitaillement en carburant</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-[#F1F5F9] text-[#64748B]"><X size={16} /></button>
        </div>
        <div className="p-5 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[12px] font-bold text-[#374151] mb-1.5">Date</label>
              <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} className={I} />
            </div>
            <div>
              <label className="block text-[12px] font-bold text-[#374151] mb-1.5">Carburant</label>
              <select value={form.type_carburant} onChange={e => setForm(f => ({ ...f, type_carburant: e.target.value as never }))} className={I}>
                <option value="diesel">Diesel</option>
                <option value="essence">Essence</option>
                <option value="gpl">GPL</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-[12px] font-bold text-[#374151] mb-1.5">Véhicule</label>
            <select value={form.vehicule_id} onChange={e => setForm(f => ({ ...f, vehicule_id: e.target.value }))} className={I}>
              <option value="">Sélectionner...</option>
              {vehicules.map(v => <option key={v.id} value={v.id}>{v.immatriculation} · {v.marque}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[12px] font-bold text-[#374151] mb-1.5">Chauffeur</label>
            <select value={form.chauffeur_id} onChange={e => setForm(f => ({ ...f, chauffeur_id: e.target.value }))} className={I}>
              <option value="">Sélectionner...</option>
              {chauffeurs.map(c => <option key={c.id} value={c.id}>{c.nom}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[12px] font-bold text-[#374151] mb-1.5">Litres *</label>
              <input type="number" value={form.litres} onChange={e => setForm(f => ({ ...f, litres: e.target.value }))} className={I} placeholder="50" step="0.1" />
            </div>
            <div>
              <label className="block text-[12px] font-bold text-[#374151] mb-1.5">Prix/litre (FCFA) *</label>
              <input type="number" value={form.prix_litre} onChange={e => setForm(f => ({ ...f, prix_litre: e.target.value }))} className={I} placeholder="750" />
            </div>
          </div>
          {total > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5 text-center">
              <p className="text-[11px] text-amber-700 font-semibold">Total : {total.toLocaleString('fr-FR')} FCFA</p>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[12px] font-bold text-[#374151] mb-1.5">KM au plein</label>
              <input type="number" value={form.km_au_plein} onChange={e => setForm(f => ({ ...f, km_au_plein: e.target.value }))} className={I} />
            </div>
            <div>
              <label className="block text-[12px] font-bold text-[#374151] mb-1.5">Station</label>
              <input value={form.station} onChange={e => setForm(f => ({ ...f, station: e.target.value }))} className={I} placeholder="Total, Puma..." />
            </div>
          </div>
          <button onClick={handleSave} disabled={!form.litres || !form.prix_litre || saving}
            className="w-full py-2.5 bg-red-600 text-white rounded-xl text-[13px] font-bold hover:bg-red-700 disabled:opacity-40 flex items-center justify-center gap-1.5">
            {saving ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />}
            Enregistrer
          </button>
        </div>
      </div>
    </div>
  )
}

export default function TransportCarburantPage() {
  const { fmt } = useFmt()
  const { tenant } = useTenantContext()
  const tid = tenant?.tenantId

  const [rows,      setRows]      = useState<Ravitaillement[]>([])
  const [vehicules, setVehicules] = useState<Vehicule[]>([])
  const [chauffeurs,setChauffeurs]= useState<Chauffeur[]>([])
  const [loading,   setLoading]   = useState(true)
  const [search,    setSearch]    = useState('')
  const [filterMois,setFilterMois]= useState('')
  const [showModal, setShowModal] = useState(false)

  const now = new Date()
  const moisStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2,'0')}`

  const load = useCallback(async () => {
    if (!tid) return
    setLoading(true)
    const [{ data: r }, { data: v }, { data: c }] = await Promise.all([
      supabase.from('transport_carburant').select('*').eq('tenant_id', tid).order('date', { ascending: false }).limit(300),
      supabase.from('transport_vehicules').select('id, immatriculation, marque').eq('tenant_id', tid).eq('statut', 'actif'),
      supabase.from('chauffeurs').select('id, nom').eq('tenant_id', tid).eq('statut', 'actif'),
    ])
    setRows((r ?? []) as Ravitaillement[])
    setVehicules((v ?? []) as Vehicule[])
    setChauffeurs((c ?? []) as Chauffeur[])
    setLoading(false)
  }, [tid])

  useEffect(() => { load() }, [load])

  const filtered = rows.filter(r => {
    const q = search.toLowerCase()
    const matchQ = !q || r.vehicule_imm?.toLowerCase().includes(q) || r.chauffeur_nom?.toLowerCase().includes(q) || r.station?.toLowerCase().includes(q)
    const matchM = !filterMois || r.date?.startsWith(filterMois)
    return matchQ && matchM
  })

  const totalLitres = filtered.reduce((s, r) => s + r.litres, 0)
  const totalCout   = filtered.reduce((s, r) => s + r.total, 0)
  const prixMoyen   = totalLitres > 0 ? totalCout / totalLitres : 0

  const thisMoisRows = rows.filter(r => r.date?.startsWith(moisStr))
  const prevMoisStr = `${now.getFullYear()}-${String(now.getMonth()).padStart(2,'0')}`
  const prevMoisRows = rows.filter(r => r.date?.startsWith(prevMoisStr))
  const coutCeMois  = thisMoisRows.reduce((s, r) => s + r.total, 0)
  const coutPrevMois= prevMoisRows.reduce((s, r) => s + r.total, 0)
  const evol = coutPrevMois > 0 ? ((coutCeMois - coutPrevMois) / coutPrevMois) * 100 : 0

  // Group by vehicle for top consumers
  const byVehicle: Record<string, number> = {}
  filtered.forEach(r => {
    const k = r.vehicule_imm ?? 'Non assigné'
    byVehicle[k] = (byVehicle[k] ?? 0) + r.total
  })
  const topVehicules = Object.entries(byVehicle).sort((a, b) => b[1] - a[1]).slice(0, 5)

  const CARBURANT_COLORS: Record<string, string> = { diesel: '#0F172A', essence: '#DC2626', gpl: '#16A34A' }

  return (
    <div className="min-h-screen bg-[#F8FAFC] pb-20">

      {/* Header */}
      <div className="bg-white border-b border-[#E2E8F0] px-4 sm:px-6 py-4 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link href="/dashboard/transport" className="text-[#64748B] hover:text-[#0F172A] text-[13px]">← Transport</Link>
            <span className="text-[#E2E8F0]">/</span>
            <div className="flex items-center gap-2">
              <Fuel size={16} className="text-red-600" />
              <h1 className="text-[16px] font-black text-[#0F172A]">Carburant</h1>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={load} className="p-2 border border-[#E2E8F0] rounded-xl text-[#64748B]"><RefreshCw size={13} /></button>
            <button onClick={() => setShowModal(true)}
              className="flex items-center gap-1.5 px-4 py-2 bg-red-600 text-white rounded-xl text-[13px] font-bold hover:bg-red-700">
              <Plus size={14} /> Ravitaillement
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">

        {/* KPIs */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-white rounded-2xl p-4 border border-[#E2E8F0] shadow-sm">
            <p className="text-[10px] font-bold text-[#64748B] uppercase tracking-wide mb-1">Ce mois</p>
            <p className="text-[20px] font-black text-[#0F172A]">{fmt(coutCeMois)}</p>
            {evol !== 0 && (
              <p className={`text-[11px] flex items-center gap-0.5 mt-0.5 ${evol > 0 ? 'text-red-600' : 'text-green-600'}`}>
                {evol > 0 ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
                {evol > 0 ? '+' : ''}{evol.toFixed(1)}% vs mois préc.
              </p>
            )}
          </div>
          <div className="bg-white rounded-2xl p-4 border border-[#E2E8F0] shadow-sm">
            <p className="text-[10px] font-bold text-[#64748B] uppercase tracking-wide mb-1">Total sélection</p>
            <p className="text-[20px] font-black text-amber-600">{fmt(totalCout)}</p>
            <p className="text-[11px] text-[#94A3B8] mt-0.5">{filtered.length} ravitaillements</p>
          </div>
          <div className="bg-white rounded-2xl p-4 border border-[#E2E8F0] shadow-sm">
            <p className="text-[10px] font-bold text-[#64748B] uppercase tracking-wide mb-1">Litres</p>
            <p className="text-[20px] font-black text-[#0F172A]">{totalLitres.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} L</p>
          </div>
          <div className="bg-white rounded-2xl p-4 border border-[#E2E8F0] shadow-sm">
            <p className="text-[10px] font-bold text-[#64748B] uppercase tracking-wide mb-1">Prix moyen/L</p>
            <p className="text-[20px] font-black text-[#0F172A]">{prixMoyen > 0 ? prixMoyen.toLocaleString('fr-FR', { maximumFractionDigits: 0 }) : '—'} FCFA</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Top véhicules consommateurs */}
          {topVehicules.length > 0 && (
            <div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-sm p-5">
              <h3 className="text-[13px] font-black text-[#0F172A] mb-4">Top consommateurs</h3>
              <div className="space-y-3">
                {topVehicules.map(([veh, cout], _i) => (
                  <div key={veh}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[12px] font-semibold text-[#374151] truncate max-w-[65%]">{veh}</span>
                      <span className="text-[12px] font-bold text-[#0F172A]">{fmt(cout)}</span>
                    </div>
                    <div className="h-1.5 bg-[#F1F5F9] rounded-full overflow-hidden">
                      <div className="h-full bg-red-500 rounded-full" style={{ width: `${(cout / topVehicules[0][1]) * 100}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Liste */}
          <div className={`${topVehicules.length > 0 ? 'lg:col-span-2' : 'lg:col-span-3'} bg-white rounded-2xl border border-[#E2E8F0] shadow-sm overflow-hidden`}>
            <div className="p-4 border-b border-[#E2E8F0] flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Véhicule, chauffeur, station..."
                  className="w-full pl-8 pr-3 py-2 text-[12px] border border-[#E2E8F0] rounded-xl focus:outline-none focus:ring-2 focus:ring-red-300" />
              </div>
              <input type="month" value={filterMois} onChange={e => setFilterMois(e.target.value)}
                className="px-3 py-2 text-[12px] border border-[#E2E8F0] rounded-xl focus:outline-none focus:ring-2 focus:ring-red-300 bg-white" />
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-12 gap-2 text-[#94A3B8]">
                <Loader2 size={16} className="animate-spin" /> Chargement...
              </div>
            ) : (
              <>
                {/* Desktop */}
                <div className="hidden sm:block overflow-x-auto">
                  <table className="w-full text-[12px]">
                    <thead className="bg-[#F8FAFC] text-[#64748B] font-bold border-b border-[#E2E8F0]">
                      <tr>
                        <th className="text-left px-4 py-2.5">Date</th>
                        <th className="text-left px-4 py-2.5">Véhicule</th>
                        <th className="text-left px-4 py-2.5">Chauffeur</th>
                        <th className="text-left px-4 py-2.5">Type</th>
                        <th className="text-right px-4 py-2.5">Litres</th>
                        <th className="text-right px-4 py-2.5">Prix/L</th>
                        <th className="text-right px-4 py-2.5">Total</th>
                        <th className="text-left px-4 py-2.5">Station</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#F1F5F9]">
                      {filtered.length === 0 ? (
                        <tr><td colSpan={8} className="text-center py-12 text-[#94A3B8]">Aucun ravitaillement</td></tr>
                      ) : filtered.map(r => (
                        <tr key={r.id} className="hover:bg-[#F8FAFC]">
                          <td className="px-4 py-2.5 text-[#64748B]">{new Date(r.date).toLocaleDateString('fr-FR')}</td>
                          <td className="px-4 py-2.5 font-semibold text-[#0F172A]">{r.vehicule_imm ?? '—'}</td>
                          <td className="px-4 py-2.5 text-[#374151]">{r.chauffeur_nom ?? '—'}</td>
                          <td className="px-4 py-2.5">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold" style={{ color: CARBURANT_COLORS[r.type_carburant], background: `${CARBURANT_COLORS[r.type_carburant]}15` }}>
                              {r.type_carburant}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 text-right font-semibold">{r.litres.toFixed(1)} L</td>
                          <td className="px-4 py-2.5 text-right text-[#64748B]">{r.prix_litre.toLocaleString()} FCFA</td>
                          <td className="px-4 py-2.5 text-right font-black text-[#0F172A]">{fmt(r.total)}</td>
                          <td className="px-4 py-2.5 text-[#64748B]">{r.station ?? '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile cards */}
                <div className="sm:hidden divide-y divide-[#F1F5F9]">
                  {filtered.length === 0 ? (
                    <div className="text-center py-12 text-[#94A3B8] text-[12px]">Aucun ravitaillement</div>
                  ) : filtered.map(r => (
                    <div key={r.id} className="px-4 py-3 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[12px] font-bold text-[#0F172A]">{r.vehicule_imm ?? 'Véhicule inconnu'}</span>
                        <span className="text-[13px] font-black text-[#0F172A]">{fmt(r.total)}</span>
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-[#64748B]">
                        <span>{new Date(r.date).toLocaleDateString('fr-FR')} · {r.litres.toFixed(1)}L · {r.prix_litre.toLocaleString()} FCFA/L</span>
                        <span className="capitalize" style={{ color: CARBURANT_COLORS[r.type_carburant] }}>{r.type_carburant}</span>
                      </div>
                      {(r.chauffeur_nom || r.station) && (
                        <p className="text-[11px] text-[#94A3B8]">{[r.chauffeur_nom, r.station].filter(Boolean).join(' · ')}</p>
                      )}
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {showModal && (
        <ModalRavitaillement
          vehicules={vehicules}
          chauffeurs={chauffeurs}
          onClose={() => setShowModal(false)}
          onSaved={() => { setShowModal(false); load() }}
        />
      )}
    </div>
  )
}

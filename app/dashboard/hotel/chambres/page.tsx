'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useFmt } from '@/lib/hooks/useFmt'
import { useTenantContext } from '@/lib/contexts/TenantContext'
import Link from 'next/link'
import {
  BedDouble, Plus, Search, RefreshCw, Loader2,
  Wrench, CheckCircle, Clock, X, Edit3,
} from 'lucide-react'

// ── Types ─────────────────────────────────────────────────────────────────────

interface RoomType {
  id:           string
  nom:          string
  capacite:     number
  prix_nuit:    number
  prix_weekend: number
  superficie:   number | null
  equipements:  string[]
  description:  string | null
  nb_chambres:  number
}

interface Room {
  id:            string
  numero:        string
  etage:         number
  statut:        'disponible' | 'occupee' | 'nettoyage' | 'maintenance' | 'hors_service'
  type_id:       string | null
  vue:           string | null
  notes:         string | null
  htl_room_types:{ nom: string; prix_nuit: number } | null
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const STATUT_CFG: Record<Room['statut'], { label: string; color: string; bg: string; dot: string }> = {
  disponible:   { label: 'Disponible',   color: '#16A34A', bg: '#F0FDF4', dot: '#16A34A' },
  occupee:      { label: 'Occupée',      color: '#DC2626', bg: '#FEF2F2', dot: '#DC2626' },
  nettoyage:    { label: 'Nettoyage',    color: '#D97706', bg: '#FFFBEB', dot: '#D97706' },
  maintenance:  { label: 'Maintenance',  color: '#64748B', bg: '#F1F5F9', dot: '#64748B' },
  hors_service: { label: 'Hors service', color: '#94A3B8', bg: '#F8FAFC', dot: '#94A3B8' },
}

// ── Modal Chambre ──────────────────────────────────────────────────────────────

function ModalChambre({
  room, roomTypes, onClose, onSaved,
}: {
  room: Room | null
  roomTypes: RoomType[]
  onClose: () => void
  onSaved: () => void
}) {
  const [form, setForm] = useState({
    numero:  room?.numero  ?? '',
    etage:   room?.etage   ?? 1,
    type_id: room?.type_id ?? '',
    statut:  room?.statut  ?? 'disponible' as Room['statut'],
    vue:     room?.vue     ?? '',
    notes:   room?.notes   ?? '',
  })
  const [saving, setSaving] = useState(false)
  const { tenant } = useTenantContext()

  async function handleSave() {
    if (!form.numero.trim()) return
    setSaving(true)
    if (room) {
      await supabase.from('htl_rooms').update({
        numero:  form.numero,
        etage:   form.etage,
        type_id: form.type_id || null,
        statut:  form.statut,
        vue:     form.vue || null,
        notes:   form.notes || null,
      }).eq('id', room.id).eq('tenant_id', tenant?.tenantId)
    } else {
      await supabase.from('htl_rooms').insert({
        tenant_id: tenant?.tenantId,
        numero:    form.numero,
        etage:     form.etage,
        type_id:   form.type_id || null,
        statut:    form.statut,
        vue:       form.vue || null,
        notes:     form.notes || null,
      })
    }
    setSaving(false)
    onSaved()
  }

  const INPUT = 'w-full px-3 py-2.5 text-[13px] border border-[#E2E8F0] rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-300 bg-white'

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#E2E8F0]">
          <h2 className="font-black text-[15px] text-[#0F172A]">{room ? 'Modifier chambre' : 'Nouvelle chambre'}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-[#F1F5F9] text-[#64748B]"><X size={16} /></button>
        </div>
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[12px] font-bold text-[#374151] mb-1.5">N° Chambre *</label>
              <input value={form.numero} onChange={e => setForm(f => ({ ...f, numero: e.target.value }))}
                className={INPUT} placeholder="101" />
            </div>
            <div>
              <label className="block text-[12px] font-bold text-[#374151] mb-1.5">Étage</label>
              <input type="number" value={form.etage} onChange={e => setForm(f => ({ ...f, etage: parseInt(e.target.value) || 1 }))}
                className={INPUT} min={0} />
            </div>
          </div>
          <div>
            <label className="block text-[12px] font-bold text-[#374151] mb-1.5">Type de chambre</label>
            <select value={form.type_id} onChange={e => setForm(f => ({ ...f, type_id: e.target.value }))} className={INPUT}>
              <option value="">Non défini</option>
              {roomTypes.map(rt => <option key={rt.id} value={rt.id}>{rt.nom} — {Math.round(rt.prix_nuit).toLocaleString('fr-FR')} FCFA/nuit</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[12px] font-bold text-[#374151] mb-1.5">Statut</label>
              <select value={form.statut} onChange={e => setForm(f => ({ ...f, statut: e.target.value as Room['statut'] }))} className={INPUT}>
                {Object.entries(STATUT_CFG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[12px] font-bold text-[#374151] mb-1.5">Vue</label>
              <select value={form.vue} onChange={e => setForm(f => ({ ...f, vue: e.target.value }))} className={INPUT}>
                <option value="">Non définie</option>
                <option value="mer">Mer</option>
                <option value="piscine">Piscine</option>
                <option value="jardin">Jardin</option>
                <option value="ville">Ville</option>
                <option value="montagne">Montagne</option>
                <option value="parking">Parking</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-[12px] font-bold text-[#374151] mb-1.5">Notes</label>
            <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              rows={2} className={`${INPUT} resize-none`} placeholder="Observations particulières..." />
          </div>
          <button onClick={handleSave} disabled={!form.numero || saving}
            className="w-full py-2.5 bg-amber-500 text-white rounded-xl text-[13px] font-bold hover:bg-amber-600 disabled:opacity-40 flex items-center justify-center gap-1.5">
            {saving ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />}
            {room ? 'Enregistrer' : 'Créer la chambre'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Page principale ────────────────────────────────────────────────────────────

export default function HotelChambresPage() {
  const { fmt } = useFmt()
  const { tenant } = useTenantContext()
  const tid = tenant?.tenantId

  const [rooms,     setRooms]     = useState<Room[]>([])
  const [roomTypes, setRoomTypes] = useState<RoomType[]>([])
  const [loading,   setLoading]   = useState(true)
  const [search,    setSearch]    = useState('')
  const [filterStatut, setFilterStatut] = useState<string>('tous')
  const [filterEtage,  setFilterEtage]  = useState<string>('tous')
  const [showModal, setShowModal] = useState(false)
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null)

  const load = useCallback(async () => {
    if (!tid) return
    setLoading(true)
    const [{ data: r }, { data: rt }] = await Promise.all([
      supabase.from('htl_rooms').select('*, htl_room_types(nom, prix_nuit)').eq('tenant_id', tid).order('etage').order('numero'),
      supabase.from('htl_room_types').select('*, htl_rooms(id)').eq('tenant_id', tid).order('prix_nuit'),
    ])
    setRooms((r ?? []) as Room[])
    setRoomTypes((rt ?? []).map((t: Record<string, unknown>) => ({ ...t, nb_chambres: Array.isArray(t.htl_rooms) ? t.htl_rooms.length : 0 })) as RoomType[])
    setLoading(false)
  }, [tid])

  useEffect(() => { load() }, [load])

  async function changerStatut(id: string, statut: Room['statut']) {
    await supabase.from('htl_rooms').update({ statut }).eq('id', id).eq('tenant_id', tid)
    setRooms(prev => prev.map(r => r.id === id ? { ...r, statut } : r))
  }

  const etages = [...new Set(rooms.map(r => r.etage))].sort((a, b) => a - b)

  const filtered = rooms.filter(r => {
    const q = search.toLowerCase()
    const matchQ = !q || r.numero.toLowerCase().includes(q) || (r.htl_room_types?.nom?.toLowerCase() ?? '').includes(q)
    const matchS = filterStatut === 'tous' || r.statut === filterStatut
    const matchE = filterEtage === 'tous'  || r.etage === parseInt(filterEtage)
    return matchQ && matchS && matchE
  })

  // KPIs
  const total       = rooms.length
  const disponibles = rooms.filter(r => r.statut === 'disponible').length
  const occupees    = rooms.filter(r => r.statut === 'occupee').length
  const nettoyage   = rooms.filter(r => r.statut === 'nettoyage').length
  const tauxOcc     = total > 0 ? Math.round((occupees / total) * 100) : 0

  // Grouper par étage
  const parEtage = etages.reduce<Record<number, Room[]>>((acc, e) => {
    acc[e] = filtered.filter(r => r.etage === e)
    return acc
  }, {})

  return (
    <div className="min-h-screen bg-[#F8FAFC] pb-20">

      {/* Header */}
      <div className="bg-white border-b border-[#E2E8F0] px-4 sm:px-6 py-4 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link href="/dashboard/hotel" className="text-[#64748B] hover:text-[#0F172A] text-[13px]">← Hôtel</Link>
            <span className="text-[#E2E8F0]">/</span>
            <div className="flex items-center gap-2">
              <BedDouble size={16} className="text-amber-600" />
              <h1 className="text-[16px] font-black text-[#0F172A]">Gestion des chambres</h1>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={load} className="p-2 border border-[#E2E8F0] rounded-xl text-[#64748B] hover:bg-[#F8FAFC]">
              <RefreshCw size={13} />
            </button>
            <button onClick={() => { setSelectedRoom(null); setShowModal(true) }}
              className="flex items-center gap-1.5 px-4 py-2 bg-amber-500 text-white rounded-xl text-[13px] font-bold hover:bg-amber-600">
              <Plus size={14} /> Ajouter chambre
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">

        {/* KPIs */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {[
            { label: 'Total chambres', value: total,       color: '#0F172A' },
            { label: 'Disponibles',    value: disponibles, color: '#16A34A' },
            { label: 'Occupées',       value: occupees,    color: '#DC2626' },
            { label: 'Nettoyage',      value: nettoyage,   color: '#D97706' },
            { label: 'Taux occupation',value: `${tauxOcc}%`, color: '#2563EB' },
          ].map(k => (
            <div key={k.label} className="bg-white rounded-2xl p-4 border border-[#E2E8F0] shadow-sm">
              <p className="text-[10px] font-bold text-[#64748B] uppercase tracking-wide mb-1">{k.label}</p>
              <p className="text-[20px] font-black tabular-nums" style={{ color: k.color }}>{k.value}</p>
            </div>
          ))}
        </div>

        {/* Types de chambres */}
        {roomTypes.length > 0 && (
          <div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-sm p-5">
            <p className="text-[13px] font-black text-[#0F172A] mb-4 flex items-center gap-2">
              <BedDouble size={14} className="text-amber-500" /> Types de chambres & Tarifs
            </p>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[#E2E8F0]">
                    {['Type', 'Capacité', 'Prix nuit', 'Week-end', 'Surface', 'Chambres'].map(h => (
                      <th key={h} className="text-left px-3 py-2 text-[11px] font-bold text-[#64748B] uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F8FAFC]">
                  {roomTypes.map(rt => (
                    <tr key={rt.id} className="hover:bg-[#FFFBEB]">
                      <td className="px-3 py-2.5">
                        <p className="font-bold text-[13px] text-[#0F172A]">{rt.nom}</p>
                        {rt.description && <p className="text-[10px] text-[#94A3B8]">{rt.description}</p>}
                      </td>
                      <td className="px-3 py-2.5 text-[12px] text-[#64748B]">{rt.capacite} pers.</td>
                      <td className="px-3 py-2.5 font-bold text-[13px] text-[#0F172A]">{fmt(rt.prix_nuit)} F</td>
                      <td className="px-3 py-2.5 text-[12px] text-amber-700 font-semibold">{rt.prix_weekend > 0 ? `${fmt(rt.prix_weekend)} F` : '—'}</td>
                      <td className="px-3 py-2.5 text-[12px] text-[#64748B]">{rt.superficie ? `${rt.superficie} m²` : '—'}</td>
                      <td className="px-3 py-2.5">
                        <span className="font-black text-[14px] text-[#2563EB]">{rt.nb_chambres}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Filtres */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher n° ou type..."
              className="w-full pl-9 pr-4 py-2.5 text-[13px] border border-[#E2E8F0] rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-300 bg-white" />
          </div>
          <select value={filterStatut} onChange={e => setFilterStatut(e.target.value)}
            className="px-3 py-2.5 text-[13px] border border-[#E2E8F0] rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-amber-300">
            <option value="tous">Tous statuts</option>
            {Object.entries(STATUT_CFG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
          <select value={filterEtage} onChange={e => setFilterEtage(e.target.value)}
            className="px-3 py-2.5 text-[13px] border border-[#E2E8F0] rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-amber-300">
            <option value="tous">Tous étages</option>
            {etages.map(e => <option key={e} value={e}>Étage {e}</option>)}
          </select>
        </div>

        {/* Grille chambres par étage */}
        {loading ? (
          <div className="flex items-center justify-center py-16 gap-2 text-[#94A3B8]">
            <Loader2 size={18} className="animate-spin" /> Chargement...
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-2xl border border-dashed border-[#CBD5E1] p-16 text-center">
            <BedDouble size={40} className="text-[#CBD5E1] mx-auto mb-3" />
            <p className="font-bold text-[#0F172A] mb-1">Aucune chambre</p>
            <button onClick={() => { setSelectedRoom(null); setShowModal(true) }}
              className="mt-3 inline-flex items-center gap-1.5 px-4 py-2.5 bg-amber-500 text-white rounded-xl text-[13px] font-bold hover:bg-amber-600">
              <Plus size={13} /> Ajouter une chambre
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            {Object.entries(parEtage).map(([etage, chambres]) => (
              <div key={etage}>
                <h2 className="text-[12px] font-black text-[#64748B] uppercase tracking-wider mb-3">
                  Étage {etage} — {chambres.length} chambre{chambres.length > 1 ? 's' : ''}
                </h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                  {chambres.map(room => {
                    const sc = STATUT_CFG[room.statut]
                    return (
                      <div key={room.id}
                        className="bg-white rounded-2xl border-2 shadow-sm hover:shadow-md transition-all cursor-pointer group overflow-hidden"
                        style={{ borderColor: sc.color + '40' }}>
                        {/* Indicateur couleur */}
                        <div className="h-1.5" style={{ background: sc.color }} />
                        <div className="p-3">
                          <div className="flex items-start justify-between mb-1.5">
                            <p className="font-black text-[16px] text-[#0F172A]">{room.numero}</p>
                            <button onClick={() => { setSelectedRoom(room); setShowModal(true) }}
                              className="p-1 rounded-lg hover:bg-[#F1F5F9] text-[#94A3B8] opacity-0 group-hover:opacity-100 transition-opacity">
                              <Edit3 size={11} />
                            </button>
                          </div>
                          {room.htl_room_types && (
                            <p className="text-[10px] text-[#64748B] font-semibold mb-1.5 line-clamp-1">{room.htl_room_types.nom}</p>
                          )}
                          <span className="inline-flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded-full font-bold"
                            style={{ background: sc.bg, color: sc.color }}>
                            <span className="w-1.5 h-1.5 rounded-full" style={{ background: sc.dot }} />
                            {sc.label}
                          </span>
                          {room.vue && <p className="text-[9px] text-[#94A3B8] mt-1">Vue: {room.vue}</p>}
                          {room.htl_room_types && (
                            <p className="text-[10px] font-bold text-amber-700 mt-1.5">
                              {Math.round(room.htl_room_types.prix_nuit).toLocaleString('fr-FR')} F/nuit
                            </p>
                          )}
                        </div>
                        {/* Actions rapides */}
                        <div className="border-t border-[#F1F5F9] px-3 py-2 flex gap-1.5">
                          {room.statut === 'nettoyage' && (
                            <button onClick={() => changerStatut(room.id, 'disponible')}
                              className="flex-1 text-[9px] font-bold text-green-700 py-1 rounded-lg hover:bg-green-50 flex items-center justify-center gap-0.5">
                              <CheckCircle size={9} /> Libérer
                            </button>
                          )}
                          {room.statut === 'disponible' && (
                            <button onClick={() => changerStatut(room.id, 'nettoyage')}
                              className="flex-1 text-[9px] font-bold text-amber-700 py-1 rounded-lg hover:bg-amber-50 flex items-center justify-center gap-0.5">
                              <Clock size={9} /> Nettoyage
                            </button>
                          )}
                          {room.statut === 'maintenance' && (
                            <button onClick={() => changerStatut(room.id, 'disponible')}
                              className="flex-1 text-[9px] font-bold text-blue-700 py-1 rounded-lg hover:bg-blue-50 flex items-center justify-center gap-0.5">
                              <Wrench size={9} /> OK
                            </button>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showModal && (
        <ModalChambre
          room={selectedRoom}
          roomTypes={roomTypes}
          onClose={() => setShowModal(false)}
          onSaved={() => { setShowModal(false); load() }}
        />
      )}
    </div>
  )
}

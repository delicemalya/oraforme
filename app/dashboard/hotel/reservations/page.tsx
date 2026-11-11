'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { ArrowLeft, RefreshCw, Plus, X, CalendarDays, Loader2, ChevronRight } from 'lucide-react'

interface Reservation {
  id: string; numero_reservation: string; statut: string; nb_nuits: number
  date_arrivee: string; date_depart: string; montant_total: number; nb_adultes: number
  htl_guests: { prenom: string; nom: string; email: string | null; telephone: string | null } | null
  htl_reservation_rooms?: { htl_rooms: { numero: string } | null }[]
}

interface Room { id: string; numero: string; etage: number; statut: string; htl_room_types: { nom: string; prix_base: number } | null }

const STATUT_CFG: Record<string, { label: string; color: string; bg: string }> = {
  brouillon:  { label: 'Brouillon',  color: '#94A3B8', bg: '#F8FAFC' },
  confirmee:  { label: 'Confirmée',  color: '#2563EB', bg: '#EFF6FF' },
  checkin:    { label: 'Check-in',   color: '#16A34A', bg: '#F0FDF4' },
  checkout:   { label: 'Check-out',  color: '#F59E0B', bg: '#FFFBEB' },
  annulee:    { label: 'Annulée',   color: '#DC2626', bg: '#FEF2F2' },
  no_show:    { label: 'No-show',   color: '#7C3AED', bg: '#F5F3FF' },
}

const INIT_FORM = {
  date_arrivee: '', date_depart: '', nb_adultes: 1, nb_enfants: 0,
  prenom: '', nom: '', email: '', telephone: '',
  room_ids: [] as string[], notes_speciales: '',
}

function fmtDate(d: string) { return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }) }
function fmtNum(n: number)  { return new Intl.NumberFormat('fr-FR').format(n) }

export default function ReservationsPage() {
  const [reservations, setReservations] = useState<Reservation[]>([])
  const [availRooms,   setAvailRooms]   = useState<Room[]>([])
  const [loading,      setLoading]      = useState(true)
  const [showForm,     setShowForm]     = useState(false)
  const [saving,       setSaving]       = useState(false)
  const [form,         setForm]         = useState(INIT_FORM)
  const [filterStatut, setFilterStatut] = useState('')
  const [checkinId,    setCheckinId]    = useState<string | null>(null)
  const [checkoutId,   setCheckoutId]   = useState<string | null>(null)
  const [ciNotes,      setCiNotes]      = useState('')
  const [coNotes,      setCoNotes]      = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (filterStatut) params.set('statut', filterStatut)
    const res = await fetch(`/api/hotel/reservations?${params}`)
    if (res.ok) { const d = await res.json(); setReservations(d.reservations ?? []) }
    setLoading(false)
  }, [filterStatut])

  useEffect(() => { load() }, [load])

  async function loadAvailRooms() {
    if (!form.date_arrivee || !form.date_depart) { setAvailRooms([]); return }
    const p = new URLSearchParams({ check_in: form.date_arrivee, check_out: form.date_depart })
    const res = await fetch(`/api/hotel/rooms/available?${p}`)
    if (res.ok) { const d = await res.json(); setAvailRooms(d.rooms ?? []) }
  }

  useEffect(() => { loadAvailRooms() }, [form.date_arrivee, form.date_depart]) // eslint-disable-line

  function toggleRoom(id: string) {
    setForm(prev => ({
      ...prev,
      room_ids: prev.room_ids.includes(id) ? prev.room_ids.filter(r => r !== id) : [...prev.room_ids, id],
    }))
  }

  async function submitReservation(e: React.FormEvent) {
    e.preventDefault(); setSaving(true)
    const nb = Math.ceil((new Date(form.date_depart).getTime() - new Date(form.date_arrivee).getTime()) / 86400000)
    const selectedRooms = availRooms.filter(r => form.room_ids.includes(r.id))
    const montant = selectedRooms.reduce((s, r) => s + (r.htl_room_types?.prix_base ?? 0), 0) * nb

    await fetch('/api/hotel/reservations', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        guest: { prenom: form.prenom, nom: form.nom, email: form.email || null, telephone: form.telephone || null },
        date_arrivee: form.date_arrivee, date_depart: form.date_depart,
        nb_nuits: nb, nb_adultes: form.nb_adultes, nb_enfants: form.nb_enfants,
        room_ids: form.room_ids, montant_total: montant,
        notes_speciales: form.notes_speciales || null,
      }),
    })
    setSaving(false); setShowForm(false); setForm(INIT_FORM); load()
  }

  async function doCheckin() {
    if (!checkinId) return; setSaving(true)
    await fetch('/api/hotel/checkin', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reservation_id: checkinId, notes: ciNotes || null }),
    })
    setSaving(false); setCheckinId(null); setCiNotes(''); load()
  }

  async function doCheckout() {
    if (!checkoutId) return; setSaving(true)
    await fetch('/api/hotel/checkout', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reservation_id: checkoutId, notes: coNotes || null }),
    })
    setSaving(false); setCheckoutId(null); setCoNotes(''); load()
  }

  const stats = Object.keys(STATUT_CFG).reduce((acc, k) => ({
    ...acc, [k]: reservations.filter(r => r.statut === k).length,
  }), {} as Record<string, number>)

  return (
    <div className="min-h-screen bg-[#F8FAFC] pb-20">
      {/* Header */}
      <div className="bg-white border-b border-[#E2E8F0] px-4 sm:px-6 py-4">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link href="/dashboard/hotel" className="flex items-center gap-1 text-[#64748B] hover:text-[#0F172A] text-[13px]">
              <ArrowLeft size={14} /> Hôtel
            </Link>
            <span className="text-[#E2E8F0]">/</span>
            <h1 className="text-[16px] font-black text-[#0F172A]">Réservations</h1>
          </div>
          <div className="flex items-center gap-2">
            <select value={filterStatut} onChange={e => setFilterStatut(e.target.value)}
              className="px-3 py-1.5 text-[12px] border border-[#E2E8F0] rounded-xl bg-white focus:outline-none">
              <option value="">Toutes</option>
              {Object.entries(STATUT_CFG).map(([v, c]) => <option key={v} value={v}>{c.label}</option>)}
            </select>
            <button onClick={load} className="p-2 border border-[#E2E8F0] rounded-xl text-[#64748B] hover:bg-[#F8FAFC]"><RefreshCw size={13} /></button>
            <button onClick={() => setShowForm(true)}
              className="flex items-center gap-1.5 px-3 py-2 bg-amber-500 text-white rounded-xl text-[12px] font-bold hover:bg-amber-600">
              <Plus size={12} /> Nouvelle
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
        {/* Stats bar */}
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mb-5">
          {Object.entries(STATUT_CFG).map(([k, v]) => (
            <button key={k} onClick={() => setFilterStatut(filterStatut === k ? '' : k)}
              className={`bg-white rounded-2xl p-2.5 border shadow-sm text-center transition-all ${filterStatut === k ? 'ring-2 ring-amber-400' : 'border-[#E2E8F0]'}`}>
              <p className="text-[20px] font-black" style={{ color: v.color }}>{stats[k] ?? 0}</p>
              <p className="text-[9px] font-bold text-[#64748B] uppercase tracking-wide leading-tight">{v.label}</p>
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex justify-center py-16 gap-2 text-[#94A3B8]"><Loader2 size={18} className="animate-spin" /> Chargement...</div>
        ) : reservations.length === 0 ? (
          <div className="bg-white rounded-2xl border border-dashed border-[#CBD5E1] p-16 text-center">
            <CalendarDays size={36} className="text-[#CBD5E1] mx-auto mb-3" />
            <p className="font-bold text-[#0F172A]">Aucune réservation</p>
          </div>
        ) : (
          <div className="space-y-2">
            {reservations.map(r => {
              const sc = STATUT_CFG[r.statut] ?? STATUT_CFG.brouillon
              const rooms = r.htl_reservation_rooms?.map(rr => rr.htl_rooms?.numero).filter(Boolean) ?? []
              return (
                <div key={r.id} className="bg-white rounded-2xl border border-[#E2E8F0] shadow-sm p-4">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[11px] font-black text-amber-700 bg-amber-100 px-2 py-0.5 rounded-lg">{r.numero_reservation}</span>
                        <span className="text-[11px] px-2 py-0.5 rounded-full font-bold" style={{ background: sc.bg, color: sc.color }}>{sc.label}</span>
                        {rooms.length > 0 && <span className="text-[11px] text-[#64748B]">Ch. {rooms.join(', ')}</span>}
                      </div>
                      <p className="font-bold text-[14px] text-[#0F172A]">
                        {r.htl_guests ? `${r.htl_guests.prenom} ${r.htl_guests.nom}` : 'Client inconnu'}
                      </p>
                      <p className="text-[12px] text-[#64748B]">
                        {fmtDate(r.date_arrivee)} → {fmtDate(r.date_depart)} · {r.nb_nuits} nuit{r.nb_nuits > 1 ? 's' : ''} · {r.nb_adultes} adulte{r.nb_adultes > 1 ? 's' : ''}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <p className="font-black text-[14px] text-[#0F172A]">{fmtNum(r.montant_total)}</p>
                        <p className="text-[10px] text-[#94A3B8]">FCFA</p>
                      </div>
                      <div className="flex gap-1.5">
                        {r.statut === 'confirmee' && (
                          <button onClick={() => setCheckinId(r.id)}
                            className="px-3 py-1.5 bg-green-500 text-white rounded-lg text-[11px] font-bold hover:bg-green-600">
                            Check-in
                          </button>
                        )}
                        {r.statut === 'checkin' && (
                          <button onClick={() => setCheckoutId(r.id)}
                            className="px-3 py-1.5 bg-amber-500 text-white rounded-lg text-[11px] font-bold hover:bg-amber-600">
                            Check-out
                          </button>
                        )}
                        <Link href={`/dashboard/hotel/reservations/${r.id}`}
                          className="p-1.5 border border-[#E2E8F0] rounded-lg text-[#64748B] hover:bg-[#F8FAFC]">
                          <ChevronRight size={13} />
                        </Link>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Modal nouvelle réservation */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4">
          <div className="bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl w-full sm:max-w-lg max-h-[90vh] overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-[16px] text-[#0F172A]">Nouvelle réservation</h2>
              <button onClick={() => setShowForm(false)} className="p-1.5 rounded-lg hover:bg-[#F1F5F9]"><X size={16} /></button>
            </div>
            <form onSubmit={submitReservation} className="space-y-4">
              {/* Dates */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-[#64748B] uppercase tracking-wide">Arrivée *</label>
                  <input required type="date" value={form.date_arrivee} onChange={e => setForm(p => ({...p, date_arrivee: e.target.value}))}
                    className="mt-1 w-full px-3 py-2.5 text-[13px] border border-[#E2E8F0] rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-300" />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-[#64748B] uppercase tracking-wide">Départ *</label>
                  <input required type="date" value={form.date_depart} onChange={e => setForm(p => ({...p, date_depart: e.target.value}))}
                    min={form.date_arrivee} className="mt-1 w-full px-3 py-2.5 text-[13px] border border-[#E2E8F0] rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-300" />
                </div>
              </div>
              {/* Client */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-[#64748B] uppercase tracking-wide">Prénom *</label>
                  <input required value={form.prenom} onChange={e => setForm(p => ({...p, prenom: e.target.value}))}
                    className="mt-1 w-full px-3 py-2.5 text-[13px] border border-[#E2E8F0] rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-300" />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-[#64748B] uppercase tracking-wide">Nom *</label>
                  <input required value={form.nom} onChange={e => setForm(p => ({...p, nom: e.target.value}))}
                    className="mt-1 w-full px-3 py-2.5 text-[13px] border border-[#E2E8F0] rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-300" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-[#64748B] uppercase tracking-wide">Téléphone</label>
                  <input value={form.telephone} onChange={e => setForm(p => ({...p, telephone: e.target.value}))}
                    className="mt-1 w-full px-3 py-2.5 text-[13px] border border-[#E2E8F0] rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-300" />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-[#64748B] uppercase tracking-wide">Email</label>
                  <input type="email" value={form.email} onChange={e => setForm(p => ({...p, email: e.target.value}))}
                    className="mt-1 w-full px-3 py-2.5 text-[13px] border border-[#E2E8F0] rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-300" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-[#64748B] uppercase tracking-wide">Adultes</label>
                  <input type="number" min={1} value={form.nb_adultes} onChange={e => setForm(p => ({...p, nb_adultes: +e.target.value}))}
                    className="mt-1 w-full px-3 py-2.5 text-[13px] border border-[#E2E8F0] rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-300" />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-[#64748B] uppercase tracking-wide">Enfants</label>
                  <input type="number" min={0} value={form.nb_enfants} onChange={e => setForm(p => ({...p, nb_enfants: +e.target.value}))}
                    className="mt-1 w-full px-3 py-2.5 text-[13px] border border-[#E2E8F0] rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-300" />
                </div>
              </div>
              {/* Chambres disponibles */}
              {availRooms.length > 0 && (
                <div>
                  <label className="text-[11px] font-bold text-[#64748B] uppercase tracking-wide">Chambres disponibles</label>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {availRooms.map(room => (
                      <button type="button" key={room.id} onClick={() => toggleRoom(room.id)}
                        className={`px-3 py-1.5 rounded-xl text-[12px] font-bold border transition-all ${form.room_ids.includes(room.id) ? 'bg-amber-500 text-white border-amber-500' : 'bg-white text-[#475569] border-[#E2E8F0] hover:border-amber-300'}`}>
                        Ch. {room.numero} · {room.htl_room_types?.nom ?? ''} · {fmtNum(room.htl_room_types?.prix_base ?? 0)} FCFA/n
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {form.date_arrivee && form.date_depart && availRooms.length === 0 && (
                <p className="text-[12px] text-amber-600 bg-amber-50 px-3 py-2 rounded-xl">Aucune chambre disponible pour ces dates.</p>
              )}
              <div>
                <label className="text-[11px] font-bold text-[#64748B] uppercase tracking-wide">Notes spéciales</label>
                <textarea value={form.notes_speciales} onChange={e => setForm(p => ({...p, notes_speciales: e.target.value}))} rows={2}
                  className="mt-1 w-full px-3 py-2.5 text-[13px] border border-[#E2E8F0] rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-300 resize-none" />
              </div>
              {form.room_ids.length > 0 && (
                <div className="bg-amber-50 px-3 py-2 rounded-xl">
                  <p className="text-[12px] font-bold text-amber-800">
                    {form.room_ids.length} chambre{form.room_ids.length > 1 ? 's' : ''} ·{' '}
                    {Math.ceil((new Date(form.date_depart).getTime() - new Date(form.date_arrivee).getTime()) / 86400000)} nuit{Math.ceil((new Date(form.date_depart).getTime() - new Date(form.date_arrivee).getTime()) / 86400000) > 1 ? 's' : ''} ·{' '}
                    {fmtNum(availRooms.filter(r => form.room_ids.includes(r.id)).reduce((s,r) => s + (r.htl_room_types?.prix_base ?? 0), 0) * Math.ceil((new Date(form.date_depart).getTime() - new Date(form.date_arrivee).getTime()) / 86400000))} FCFA
                  </p>
                </div>
              )}
              <div className="flex gap-2 pt-1">
                <button type="button" onClick={() => setShowForm(false)}
                  className="flex-1 py-2.5 border border-[#E2E8F0] rounded-xl text-[13px] font-semibold text-[#64748B]">Annuler</button>
                <button type="submit" disabled={saving || form.room_ids.length === 0}
                  className="flex-1 py-2.5 bg-amber-500 text-white rounded-xl text-[13px] font-bold hover:bg-amber-600 disabled:opacity-50">
                  {saving ? 'Création...' : 'Confirmer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal check-in */}
      {checkinId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <h2 className="font-bold text-[16px] text-[#0F172A] mb-3">Confirmer le check-in</h2>
            <p className="text-[13px] text-[#64748B] mb-3">Le client est-il arrivé et présent à la réception ?</p>
            <textarea value={ciNotes} onChange={e => setCiNotes(e.target.value)} placeholder="Notes (optionnel)" rows={2}
              className="w-full px-3 py-2 text-[13px] border border-[#E2E8F0] rounded-xl focus:outline-none resize-none mb-4" />
            <div className="flex gap-2">
              <button onClick={() => setCheckinId(null)} className="flex-1 py-2.5 border border-[#E2E8F0] rounded-xl text-[13px] font-semibold text-[#64748B]">Annuler</button>
              <button onClick={doCheckin} disabled={saving}
                className="flex-1 py-2.5 bg-green-500 text-white rounded-xl text-[13px] font-bold hover:bg-green-600 disabled:opacity-50">
                {saving ? '...' : 'Check-in'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal check-out */}
      {checkoutId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <h2 className="font-bold text-[16px] text-[#0F172A] mb-3">Confirmer le check-out</h2>
            <p className="text-[13px] text-[#64748B] mb-3">Le client quitte l&apos;établissement. La chambre passera en nettoyage automatiquement.</p>
            <textarea value={coNotes} onChange={e => setCoNotes(e.target.value)} placeholder="Notes (optionnel)" rows={2}
              className="w-full px-3 py-2 text-[13px] border border-[#E2E8F0] rounded-xl focus:outline-none resize-none mb-4" />
            <div className="flex gap-2">
              <button onClick={() => setCheckoutId(null)} className="flex-1 py-2.5 border border-[#E2E8F0] rounded-xl text-[13px] font-semibold text-[#64748B]">Annuler</button>
              <button onClick={doCheckout} disabled={saving}
                className="flex-1 py-2.5 bg-amber-500 text-white rounded-xl text-[13px] font-bold hover:bg-amber-600 disabled:opacity-50">
                {saving ? '...' : 'Check-out'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

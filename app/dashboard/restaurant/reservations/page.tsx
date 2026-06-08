'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { ArrowLeft, Plus, RefreshCw, X, CalendarDays, Loader2 } from 'lucide-react'

interface Resa {
  id: string; date_resa: string; heure_resa: string; nb_personnes: number
  client_nom: string; client_tel: string | null; statut: string; notes: string | null
  origine: string; resto_tables: { numero: number; nom: string | null } | null
}

const STATUT_CFG: Record<string, { label: string; color: string; bg: string }> = {
  en_attente: { label: 'En attente',  color: '#F59E0B', bg: '#FFFBEB' },
  confirmee:  { label: 'Confirmée',  color: '#2563EB', bg: '#EFF6FF' },
  arrivee:    { label: 'Arrivée',    color: '#16A34A', bg: '#F0FDF4' },
  annulee:    { label: 'Annulée',   color: '#94A3B8', bg: '#F8FAFC' },
  no_show:    { label: 'No-show',   color: '#DC2626', bg: '#FEF2F2' },
}

const INIT = { date_resa: '', heure_resa: '19:00', nb_personnes: 2, client_nom: '', client_tel: '', client_email: '', notes: '', origine: 'telephone', table_id: '' }

export default function ReservationsRestaurantPage() {
  const [resas,     setResas]     = useState<Resa[]>([])
  const [date,      setDate]      = useState(new Date().toISOString().split('T')[0])
  const [loading,   setLoading]   = useState(true)
  const [showForm,  setShowForm]  = useState(false)
  const [form,      setForm]      = useState({ ...INIT, date_resa: new Date().toISOString().split('T')[0] })
  const [saving,    setSaving]    = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const res = await fetch(`/api/resto/reservations?date=${date}`)
    if (res.ok) { const d = await res.json(); setResas(d.reservations ?? []) }
    setLoading(false)
  }, [date])

  useEffect(() => { load() }, [load])

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setSaving(true)
    await fetch('/api/resto/reservations', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, table_id: form.table_id || null }),
    })
    setSaving(false); setShowForm(false); setForm({ ...INIT, date_resa: date }); load()
  }

  async function updateStatut(id: string, statut: string) {
    await fetch(`/api/resto/reservations/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ statut }),
    })
    load()
  }

  const counts = Object.keys(STATUT_CFG).reduce((acc, k) => ({ ...acc, [k]: resas.filter(r => r.statut === k).length }), {} as Record<string, number>)

  return (
    <div className="min-h-screen bg-[#F8FAFC] pb-20">
      <div className="bg-white border-b border-[#E2E8F0] px-4 sm:px-6 py-4">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link href="/dashboard/restaurant" className="flex items-center gap-1 text-[#64748B] text-[13px]"><ArrowLeft size={14} /> Restaurant</Link>
            <span className="text-[#E2E8F0]">/</span>
            <h1 className="text-[16px] font-black text-[#0F172A]">Réservations</h1>
          </div>
          <div className="flex items-center gap-2">
            <input type="date" value={date} onChange={e => setDate(e.target.value)}
              className="px-3 py-1.5 text-[12px] border border-[#E2E8F0] rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-300" />
            <button onClick={load} className="p-2 border border-[#E2E8F0] rounded-xl text-[#64748B]"><RefreshCw size={13} /></button>
            <button onClick={() => { setShowForm(true); setForm({ ...INIT, date_resa: date }) }}
              className="flex items-center gap-1.5 px-3 py-2 bg-amber-500 text-white rounded-xl text-[12px] font-bold hover:bg-amber-600">
              <Plus size={12} /> Nouvelle
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-5">
        {/* Compteurs */}
        <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 mb-5">
          {Object.entries(STATUT_CFG).map(([k, v]) => (
            <div key={k} className="bg-white rounded-2xl p-2.5 border border-[#E2E8F0] text-center shadow-sm">
              <p className="text-[20px] font-black" style={{ color: v.color }}>{counts[k] ?? 0}</p>
              <p className="text-[9px] font-bold text-[#64748B] uppercase tracking-wide">{v.label}</p>
            </div>
          ))}
        </div>

        {loading ? (
          <div className="flex justify-center py-16 gap-2 text-[#94A3B8]"><Loader2 size={18} className="animate-spin" /> Chargement...</div>
        ) : resas.length === 0 ? (
          <div className="bg-white rounded-2xl border border-dashed border-[#CBD5E1] p-16 text-center">
            <CalendarDays size={36} className="text-[#CBD5E1] mx-auto mb-3" />
            <p className="font-bold text-[#0F172A]">Aucune réservation pour cette date</p>
          </div>
        ) : (
          <div className="space-y-2">
            {resas.map(r => {
              const sc = STATUT_CFG[r.statut] ?? STATUT_CFG.confirmee
              return (
                <div key={r.id} className="bg-white rounded-2xl border border-[#E2E8F0] shadow-sm p-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[13px] font-bold text-amber-700">{r.heure_resa.slice(0, 5)}</span>
                        <span className="text-[11px] px-2 py-0.5 rounded-full font-bold" style={{ background: sc.bg, color: sc.color }}>{sc.label}</span>
                        {r.resto_tables && <span className="text-[11px] text-[#64748B] bg-[#F1F5F9] px-2 py-0.5 rounded-lg">Table {r.resto_tables.numero}{r.resto_tables.nom ? ` — ${r.resto_tables.nom}` : ''}</span>}
                        <span className="text-[11px] text-[#94A3B8]">{r.nb_personnes} pers.</span>
                      </div>
                      <p className="font-bold text-[14px] text-[#0F172A]">{r.client_nom}</p>
                      {r.client_tel && <p className="text-[12px] text-[#64748B]">{r.client_tel}</p>}
                      {r.notes && <p className="text-[11px] text-[#94A3B8] italic mt-0.5">{r.notes}</p>}
                    </div>
                    <div className="flex gap-1.5">
                      {r.statut === 'confirmee'  && <button onClick={() => updateStatut(r.id, 'arrivee')}  className="px-3 py-1.5 bg-green-500 text-white rounded-lg text-[11px] font-bold hover:bg-green-600">✓ Arrivée</button>}
                      {r.statut === 'en_attente' && <button onClick={() => updateStatut(r.id, 'confirmee')} className="px-3 py-1.5 bg-blue-500 text-white rounded-lg text-[11px] font-bold hover:bg-blue-600">Confirmer</button>}
                      {(r.statut === 'confirmee' || r.statut === 'en_attente') && (
                        <>
                          <button onClick={() => updateStatut(r.id, 'no_show')} className="px-2 py-1.5 border border-[#E2E8F0] rounded-lg text-[11px] text-[#94A3B8] hover:bg-[#F8FAFC]">No-show</button>
                          <button onClick={() => updateStatut(r.id, 'annulee')} className="px-2 py-1.5 border border-[#DC2626] rounded-lg text-[11px] text-[#DC2626] hover:bg-red-50">Annuler</button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4">
          <div className="bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl w-full sm:max-w-md p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-[16px] text-[#0F172A]">Nouvelle réservation</h2>
              <button onClick={() => setShowForm(false)} className="p-1.5 rounded-lg hover:bg-[#F1F5F9]"><X size={16} /></button>
            </div>
            <form onSubmit={submit} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-[#64748B] uppercase">Date *</label>
                  <input required type="date" value={form.date_resa} onChange={e => setForm(p => ({...p, date_resa: e.target.value}))}
                    className="mt-1 w-full px-3 py-2.5 text-[13px] border border-[#E2E8F0] rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-300" />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-[#64748B] uppercase">Heure *</label>
                  <input required type="time" value={form.heure_resa} onChange={e => setForm(p => ({...p, heure_resa: e.target.value}))}
                    className="mt-1 w-full px-3 py-2.5 text-[13px] border border-[#E2E8F0] rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-300" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-[#64748B] uppercase">Client *</label>
                  <input required value={form.client_nom} onChange={e => setForm(p => ({...p, client_nom: e.target.value}))}
                    placeholder="Nom du client"
                    className="mt-1 w-full px-3 py-2.5 text-[13px] border border-[#E2E8F0] rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-300" />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-[#64748B] uppercase">Téléphone</label>
                  <input value={form.client_tel} onChange={e => setForm(p => ({...p, client_tel: e.target.value}))}
                    className="mt-1 w-full px-3 py-2.5 text-[13px] border border-[#E2E8F0] rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-300" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-[#64748B] uppercase">Personnes</label>
                  <input type="number" min={1} max={50} value={form.nb_personnes} onChange={e => setForm(p => ({...p, nb_personnes: +e.target.value}))}
                    className="mt-1 w-full px-3 py-2.5 text-[13px] border border-[#E2E8F0] rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-300" />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-[#64748B] uppercase">Origine</label>
                  <select value={form.origine} onChange={e => setForm(p => ({...p, origine: e.target.value}))}
                    className="mt-1 w-full px-3 py-2.5 text-[13px] border border-[#E2E8F0] rounded-xl bg-white focus:outline-none">
                    {[['telephone','Téléphone'], ['en_ligne','En ligne'], ['walk_in','Sur place'], ['agence','Agence']].map(([v, l]) => (
                      <option key={v} value={v}>{l}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="text-[11px] font-bold text-[#64748B] uppercase">Notes</label>
                <textarea value={form.notes} onChange={e => setForm(p => ({...p, notes: e.target.value}))} rows={2}
                  className="mt-1 w-full px-3 py-2.5 text-[13px] border border-[#E2E8F0] rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-300 resize-none" />
              </div>
              <div className="flex gap-2 pt-1">
                <button type="button" onClick={() => setShowForm(false)}
                  className="flex-1 py-2.5 border border-[#E2E8F0] rounded-xl text-[13px] font-semibold text-[#64748B]">Annuler</button>
                <button type="submit" disabled={saving}
                  className="flex-1 py-2.5 bg-amber-500 text-white rounded-xl text-[13px] font-bold hover:bg-amber-600 disabled:opacity-50">
                  {saving ? 'Enregistrement...' : 'Confirmer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

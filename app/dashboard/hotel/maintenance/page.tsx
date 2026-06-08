'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { ArrowLeft, Wrench, RefreshCw, Plus, X, Loader2 } from 'lucide-react'

interface MaintReq {
  id: string; titre: string; description: string | null; categorie: string; priorite: string; statut: string
  technicien: string | null; signale_par: string | null; cout_reparation: number | null
  htl_rooms: { numero: string; etage: number } | null
  created_at: string
}

const CATEGORIE_LABELS: Record<string, string> = {
  plomberie: 'Plomberie', electricite: 'Électricité', climatisation: 'Climatisation',
  mobilier: 'Mobilier', serrure: 'Serrure', tv_internet: 'TV/Internet',
  peinture: 'Peinture', autre: 'Autre',
}
const PRIO_COLOR: Record<string, string> = { basse: '#94A3B8', normale: '#2563EB', haute: '#F59E0B', urgente: '#DC2626' }
const STATUT_CFG: Record<string, { label: string; color: string; bg: string }> = {
  signale:  { label: 'Signalé',   color: '#DC2626', bg: '#FEF2F2' },
  en_cours: { label: 'En cours',  color: '#2563EB', bg: '#EFF6FF' },
  resolu:   { label: 'Résolu',    color: '#16A34A', bg: '#F0FDF4' },
  annule:   { label: 'Annulé',   color: '#94A3B8', bg: '#F8FAFC' },
}

const INIT_FORM = { room_id: '', titre: '', description: '', categorie: 'autre', priorite: 'normale', signale_par: '' }

export default function MaintenancePage() {
  const [requests,    setRequests]    = useState<MaintReq[]>([])
  const [rooms,       setRooms]       = useState<{ id: string; numero: string }[]>([])
  const [loading,     setLoading]     = useState(true)
  const [showForm,    setShowForm]    = useState(false)
  const [form,        setForm]        = useState(INIT_FORM)
  const [saving,      setSaving]      = useState(false)
  const [filterStatut,setFilterStatut]= useState('')

  const load = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (filterStatut) params.set('statut', filterStatut)
    const [reqRes, roomsRes] = await Promise.all([
      fetch(`/api/hotel/maintenance?${params}`),
      fetch('/api/hotel/rooms'),
    ])
    if (reqRes.ok)   { const d = await reqRes.json();   setRequests(d.requests ?? []) }
    if (roomsRes.ok) { const d = await roomsRes.json(); setRooms(d.rooms ?? []) }
    setLoading(false)
  }, [filterStatut])

  useEffect(() => { load() }, [load] )

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setSaving(true)
    await fetch('/api/hotel/maintenance', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, room_id: form.room_id || null }),
    })
    setSaving(false); setShowForm(false); setForm(INIT_FORM); load()
  }

  async function patch(id: string, statut: string) {
    await fetch('/api/hotel/maintenance', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, statut }),
    })
    load()
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] pb-20">
      <div className="bg-white border-b border-[#E2E8F0] px-4 sm:px-6 py-4">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link href="/dashboard/hotel" className="flex items-center gap-1 text-[#64748B] hover:text-[#0F172A] text-[13px]">
              <ArrowLeft size={14} /> Hôtel
            </Link>
            <span className="text-[#E2E8F0]">/</span>
            <h1 className="text-[16px] font-black text-[#0F172A]">Maintenance</h1>
          </div>
          <div className="flex items-center gap-2">
            <select value={filterStatut} onChange={e => setFilterStatut(e.target.value)}
              className="px-3 py-1.5 text-[12px] border border-[#E2E8F0] rounded-xl bg-white focus:outline-none">
              <option value="">Tous</option>
              {Object.entries(STATUT_CFG).map(([v, c]) => <option key={v} value={v}>{c.label}</option>)}
            </select>
            <button onClick={load} className="p-2 border border-[#E2E8F0] rounded-xl text-[#64748B] hover:bg-[#F8FAFC]"><RefreshCw size={13} /></button>
            <button onClick={() => setShowForm(true)}
              className="flex items-center gap-1.5 px-3 py-2 bg-amber-500 text-white rounded-xl text-[12px] font-bold hover:bg-amber-600">
              <Plus size={12} /> Signaler
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
          {Object.entries(STATUT_CFG).map(([k, v]) => (
            <div key={k} className="bg-white rounded-2xl p-3 border border-[#E2E8F0] shadow-sm text-center">
              <p className="text-[22px] font-black" style={{ color: v.color }}>{requests.filter(r => r.statut === k).length}</p>
              <p className="text-[10px] font-bold text-[#64748B] uppercase tracking-wide">{v.label}</p>
            </div>
          ))}
        </div>

        {loading ? (
          <div className="flex justify-center py-16 gap-2 text-[#94A3B8]"><Loader2 size={18} className="animate-spin" /> Chargement...</div>
        ) : requests.length === 0 ? (
          <div className="bg-white rounded-2xl border border-dashed border-[#CBD5E1] p-16 text-center">
            <Wrench size={36} className="text-[#CBD5E1] mx-auto mb-3" />
            <p className="font-bold text-[#0F172A]">Aucune demande de maintenance</p>
          </div>
        ) : (
          <div className="space-y-3">
            {requests.map(r => {
              const sc = STATUT_CFG[r.statut] ?? STATUT_CFG.signale
              const pc = PRIO_COLOR[r.priorite] ?? '#94A3B8'
              return (
                <div key={r.id} className="bg-white rounded-2xl border border-[#E2E8F0] shadow-sm p-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        {r.htl_rooms && <span className="text-[11px] font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-lg">Ch. {r.htl_rooms.numero}</span>}
                        <span className="text-[11px] px-2 py-0.5 rounded-full font-bold" style={{ background: pc + '18', color: pc }}>{r.priorite}</span>
                        <span className="text-[11px] px-2 py-0.5 rounded-full font-bold" style={{ background: sc.bg, color: sc.color }}>{sc.label}</span>
                        <span className="text-[11px] text-[#94A3B8]">{CATEGORIE_LABELS[r.categorie] ?? r.categorie}</span>
                      </div>
                      <p className="font-bold text-[14px] text-[#0F172A]">{r.titre}</p>
                      {r.description && <p className="text-[12px] text-[#64748B] mt-0.5">{r.description}</p>}
                      {r.technicien && <p className="text-[11px] text-[#475569] mt-1">🔧 {r.technicien}</p>}
                    </div>
                    <div className="flex gap-2">
                      {r.statut === 'signale' && (
                        <button onClick={() => patch(r.id, 'en_cours')}
                          className="px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg text-[11px] font-bold hover:bg-blue-100">
                          Prendre en charge
                        </button>
                      )}
                      {r.statut === 'en_cours' && (
                        <button onClick={() => patch(r.id, 'resolu')}
                          className="px-3 py-1.5 bg-green-500 text-white rounded-lg text-[11px] font-bold hover:bg-green-600">
                          ✓ Résolu
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Modal signalement */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-[16px] text-[#0F172A]">Signaler une panne</h2>
              <button onClick={() => setShowForm(false)} className="p-1.5 rounded-lg hover:bg-[#F1F5F9]"><X size={16} /></button>
            </div>
            <form onSubmit={submit} className="space-y-3">
              <div>
                <label className="text-[11px] font-bold text-[#64748B] uppercase tracking-wide">Chambre</label>
                <select value={form.room_id} onChange={e => setForm(p => ({...p, room_id: e.target.value}))}
                  className="mt-1 w-full px-3 py-2.5 text-[13px] border border-[#E2E8F0] rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-300 bg-white">
                  <option value="">— Zone commune —</option>
                  {rooms.map(r => <option key={r.id} value={r.id}>Ch. {r.numero}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[11px] font-bold text-[#64748B] uppercase tracking-wide">Titre *</label>
                <input required value={form.titre} onChange={e => setForm(p => ({...p, titre: e.target.value}))}
                  placeholder="Fuite robinet salle de bain..."
                  className="mt-1 w-full px-3 py-2.5 text-[13px] border border-[#E2E8F0] rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-300" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-[#64748B] uppercase tracking-wide">Catégorie</label>
                  <select value={form.categorie} onChange={e => setForm(p => ({...p, categorie: e.target.value}))}
                    className="mt-1 w-full px-3 py-2.5 text-[13px] border border-[#E2E8F0] rounded-xl focus:outline-none bg-white">
                    {Object.entries(CATEGORIE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-bold text-[#64748B] uppercase tracking-wide">Priorité</label>
                  <select value={form.priorite} onChange={e => setForm(p => ({...p, priorite: e.target.value}))}
                    className="mt-1 w-full px-3 py-2.5 text-[13px] border border-[#E2E8F0] rounded-xl focus:outline-none bg-white">
                    {['basse','normale','haute','urgente'].map(v => <option key={v} value={v}>{v}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="text-[11px] font-bold text-[#64748B] uppercase tracking-wide">Signalé par</label>
                <input value={form.signale_par} onChange={e => setForm(p => ({...p, signale_par: e.target.value}))}
                  placeholder="Réceptionniste, client..." className="mt-1 w-full px-3 py-2.5 text-[13px] border border-[#E2E8F0] rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-300" />
              </div>
              <div>
                <label className="text-[11px] font-bold text-[#64748B] uppercase tracking-wide">Description</label>
                <textarea value={form.description} onChange={e => setForm(p => ({...p, description: e.target.value}))} rows={2}
                  className="mt-1 w-full px-3 py-2.5 text-[13px] border border-[#E2E8F0] rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-300 resize-none" />
              </div>
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setShowForm(false)}
                  className="flex-1 py-2.5 border border-[#E2E8F0] rounded-xl text-[13px] font-semibold text-[#64748B]">Annuler</button>
                <button type="submit" disabled={saving}
                  className="flex-1 py-2.5 bg-amber-500 text-white rounded-xl text-[13px] font-bold hover:bg-amber-600 disabled:opacity-50">
                  {saving ? 'Enregistrement...' : 'Signaler'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

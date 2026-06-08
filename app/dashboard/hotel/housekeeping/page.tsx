'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { ArrowLeft, RefreshCw, CheckCircle2, Loader2 } from 'lucide-react'

interface HKTask {
  id: string; room_id: string; type_tache: string; priorite: string; statut: string
  assigne_a: string | null; notes: string | null; date_planif: string
  htl_rooms: { numero: string; etage: number } | null
}

const TYPE_LABELS: Record<string, string> = {
  nettoyage: 'Nettoyage', recouche: 'Recouche', depart: 'Départ', inspection: 'Inspection', reapprovisionnement: 'Réappro.',
}
const PRIORITE_COLOR: Record<string, string> = { basse: '#94A3B8', normale: '#2563EB', haute: '#F59E0B', urgente: '#DC2626' }
const STATUT_CFG: Record<string, { label: string; color: string; bg: string }> = {
  a_faire:  { label: 'À faire',   color: '#64748B', bg: '#F1F5F9' },
  en_cours: { label: 'En cours',  color: '#2563EB', bg: '#EFF6FF' },
  terminee: { label: 'Terminée',  color: '#16A34A', bg: '#F0FDF4' },
  verifiee: { label: 'Vérifiée', color: '#15803D', bg: '#DCFCE7' },
  annulee:  { label: 'Annulée',  color: '#94A3B8', bg: '#F8FAFC' },
}

export default function HousekeepingPage() {
  const [tasks,       setTasks]       = useState<HKTask[]>([])
  const [loading,     setLoading]     = useState(true)
  const [date,        setDate]        = useState(new Date().toISOString().split('T')[0])
  const [filterEtage, setFilterEtage] = useState('')
  const [saving,      setSaving]      = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams({ date })
    if (filterEtage) params.set('etage', filterEtage)
    const res = await fetch(`/api/hotel/housekeeping?${params}`)
    if (res.ok) { const d = await res.json(); setTasks(d.tasks ?? []) }
    setLoading(false)
  }, [date, filterEtage])

  useEffect(() => { load() }, [load])

  async function updateStatut(id: string, statut: string) {
    setSaving(id)
    await fetch('/api/hotel/housekeeping', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, statut }),
    })
    setSaving(null); load()
  }

  const etages = [...new Set(tasks.map(t => t.htl_rooms?.etage ?? 0))].sort()
  const byStatut = (s: string) => tasks.filter(t => t.statut === s)

  return (
    <div className="min-h-screen bg-[#F8FAFC] pb-20">
      <div className="bg-white border-b border-[#E2E8F0] px-4 sm:px-6 py-4">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link href="/dashboard/hotel" className="flex items-center gap-1 text-[#64748B] hover:text-[#0F172A] text-[13px]">
              <ArrowLeft size={14} /> Hôtel
            </Link>
            <span className="text-[#E2E8F0]">/</span>
            <h1 className="text-[16px] font-black text-[#0F172A]">Housekeeping</h1>
          </div>
          <div className="flex items-center gap-2">
            <input type="date" value={date} onChange={e => setDate(e.target.value)}
              className="px-3 py-1.5 text-[12px] border border-[#E2E8F0] rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-300" />
            {etages.length > 0 && (
              <select value={filterEtage} onChange={e => setFilterEtage(e.target.value)}
                className="px-3 py-1.5 text-[12px] border border-[#E2E8F0] rounded-xl bg-white focus:outline-none">
                <option value="">Tous étages</option>
                {etages.map(e => <option key={e} value={String(e)}>{e === 0 ? 'RDC' : `Étage ${e}`}</option>)}
              </select>
            )}
            <button onClick={load} className="p-2 border border-[#E2E8F0] rounded-xl text-[#64748B] hover:bg-[#F8FAFC]">
              <RefreshCw size={13} />
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
        {/* Compteurs */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-5">
          {Object.entries(STATUT_CFG).map(([k, v]) => (
            <div key={k} className="bg-white rounded-2xl p-3 border border-[#E2E8F0] shadow-sm text-center">
              <p className="text-[22px] font-black" style={{ color: v.color }}>{byStatut(k).length}</p>
              <p className="text-[10px] font-bold text-[#64748B] uppercase tracking-wide">{v.label}</p>
            </div>
          ))}
        </div>

        {loading ? (
          <div className="flex justify-center py-16 gap-2 text-[#94A3B8]">
            <Loader2 size={18} className="animate-spin" /> Chargement...
          </div>
        ) : tasks.length === 0 ? (
          <div className="bg-white rounded-2xl border border-dashed border-[#CBD5E1] p-16 text-center">
            <CheckCircle2 size={36} className="text-[#CBD5E1] mx-auto mb-3" />
            <p className="font-bold text-[#0F172A]">Aucune tâche pour cette date</p>
            <p className="text-[13px] text-[#64748B] mt-1">Les tâches sont créées automatiquement au check-out.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {tasks.map(t => {
              const sc = STATUT_CFG[t.statut] ?? STATUT_CFG.a_faire
              const pc = PRIORITE_COLOR[t.priorite] ?? '#94A3B8'
              const isSaving = saving === t.id
              return (
                <div key={t.id} className={`bg-white rounded-2xl border shadow-sm p-4 ${t.statut === 'terminee' || t.statut === 'verifiee' ? 'opacity-60' : ''}`}
                  style={{ borderColor: pc + '40' }}>
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="font-black text-[15px] text-[#0F172A]">Ch. {t.htl_rooms?.numero ?? '—'}</p>
                      <p className="text-[11px] text-[#64748B]">{t.htl_rooms?.etage === 0 ? 'RDC' : `Étage ${t.htl_rooms?.etage}`}</p>
                    </div>
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-bold" style={{ background: sc.bg, color: sc.color }}>{sc.label}</span>
                  </div>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-[11px] font-semibold text-[#475569]">{TYPE_LABELS[t.type_tache] ?? t.type_tache}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded font-bold" style={{ background: pc + '18', color: pc }}>{t.priorite}</span>
                  </div>
                  {t.assigne_a && <p className="text-[11px] text-[#64748B] mb-2">👤 {t.assigne_a}</p>}
                  <div className="flex gap-1.5">
                    {t.statut === 'a_faire' && (
                      <button onClick={() => updateStatut(t.id, 'en_cours')} disabled={isSaving}
                        className="flex-1 py-1.5 bg-blue-50 text-blue-700 rounded-lg text-[11px] font-bold hover:bg-blue-100 disabled:opacity-50">
                        {isSaving ? '...' : 'Commencer'}
                      </button>
                    )}
                    {t.statut === 'en_cours' && (
                      <button onClick={() => updateStatut(t.id, 'terminee')} disabled={isSaving}
                        className="flex-1 py-1.5 bg-green-50 text-green-700 rounded-lg text-[11px] font-bold hover:bg-green-100 disabled:opacity-50">
                        {isSaving ? '...' : '✓ Terminé'}
                      </button>
                    )}
                    {t.statut === 'terminee' && (
                      <button onClick={() => updateStatut(t.id, 'verifiee')} disabled={isSaving}
                        className="flex-1 py-1.5 bg-green-500 text-white rounded-lg text-[11px] font-bold hover:bg-green-600 disabled:opacity-50">
                        {isSaving ? '...' : '✓ Vérifier'}
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

'use client'

import { useState, useEffect, useCallback } from 'react'
import { useTenantContext } from '@/lib/contexts/TenantContext'
import { useFmt } from '@/lib/hooks/useFmt'
import Link from 'next/link'
import {
  Hotel, BedDouble, TrendingUp, DollarSign, Users,
  CheckCircle2, AlertTriangle, RefreshCw, Plus,
  ArrowRight, Sparkles, Clock, Wrench, Loader2,
} from 'lucide-react'

// ── Types ─────────────────────────────────────────────────────────────────────

interface KPIs {
  nb_chambres: number; nb_occupees: number; taux_occupation: number
  nuits_vendues: number; ca_mois: number; encaisse: number
  depenses_total: number; resultat: number; adr: number; revpar: number
}

interface Room {
  id: string; numero: string; statut: string; etage: number
  htl_room_types: { nom: string } | null
}

interface Reservation {
  id: string; numero: string; statut: string; date_arrivee: string; date_depart: string
  nb_adultes: number; montant_total: number
  htl_guests: { nom: string; prenom: string | null; telephone: string | null } | null
  htl_reservation_rooms: { htl_rooms: { numero: string } | null }[]
}

interface HKTask { id: string; statut: string; priorite: string; htl_rooms: { numero: string; etage: number } | null }
interface MaintReq { id: string; statut: string; titre: string; priorite: string; htl_rooms: { numero: string } | null }

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(s: string) { return new Date(s).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }) }

const ROOM_STATUT: Record<string, { label: string; color: string; bg: string }> = {
  disponible:  { label: 'Dispo',       color: '#16A34A', bg: '#F0FDF4' },
  occupee:     { label: 'Occupée',     color: '#DC2626', bg: '#FEF2F2' },
  nettoyage:   { label: 'Nettoyage',   color: '#D97706', bg: '#FFFBEB' },
  maintenance: { label: 'Maintenance', color: '#64748B', bg: '#F1F5F9' },
  hors_service:{ label: 'Hors service',color: '#94A3B8', bg: '#F8FAFC' },
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function HotelDashboard() {
  const { fmt } = useFmt()
  const { tenant } = useTenantContext()
  const tid = tenant?.tenantId

  const [kpis,     setKpis]     = useState<KPIs | null>(null)
  const [rooms,    setRooms]    = useState<Room[]>([])
  const [arrivals, setArrivals] = useState<Reservation[]>([])
  const [departs,  setDeparts]  = useState<Reservation[]>([])
  const [hkTasks,  setHkTasks]  = useState<HKTask[]>([])
  const [maints,   MaintsSet]   = useState<MaintReq[]>([])
  const [briefing, setBriefing] = useState('')
  const [loading,  setLoading]  = useState(true)

  const today = new Date().toISOString().split('T')[0]

  const load = useCallback(async () => {
    if (!tid) return
    setLoading(true)
    const [analyticsRes, roomsRes, arrivalRes, departRes, hkRes, maintRes] = await Promise.all([
      fetch('/api/hotel/analytics'),
      fetch('/api/hotel/rooms'),
      fetch(`/api/hotel/reservations?date=${today}`),
      fetch(`/api/hotel/reservations?statut=checkin`),
      fetch(`/api/hotel/housekeeping?date=${today}`),
      fetch('/api/hotel/maintenance?statut=signale'),
    ])

    if (analyticsRes.ok) { const d = await analyticsRes.json(); setKpis(d.kpis) }
    if (roomsRes.ok)     { const d = await roomsRes.json(); setRooms(d.rooms ?? []) }
    if (arrivalRes.ok)   { const d = await arrivalRes.json(); setArrivals(d.reservations ?? []) }
    if (departRes.ok)    { const d = await departRes.json(); setDeparts(d.reservations?.filter((r: Reservation) => r.statut === 'checkin') ?? []) }
    if (hkRes.ok)        { const d = await hkRes.json(); setHkTasks(d.tasks ?? []) }
    if (maintRes.ok)     { const d = await maintRes.json(); MaintsSet(d.requests ?? []) }

    setLoading(false)
  }, [tid, today])

  useEffect(() => { load() }, [load])

  async function loadBriefing() {
    const res = await fetch('/api/hotel/miaa')
    if (res.ok) { const d = await res.json(); setBriefing(d.briefing ?? '') }
  }

  const etages = [...new Set(rooms.map(r => r.etage))].sort((a, b) => a - b)

  if (loading) return (
    <div className="flex items-center justify-center min-h-[60vh] gap-2 text-[#94A3B8]">
      <Loader2 size={18} className="animate-spin" /> Chargement hôtel...
    </div>
  )

  return (
    <div className="space-y-5 pb-20">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center">
            <Hotel size={18} className="text-amber-700" />
          </div>
          <div>
            <h1 className="text-[18px] font-black text-[#0F172A]">Tableau de bord Hôtel</h1>
            <p className="text-[12px] text-[#64748B]">{new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={load} className="p-2 border border-[#E2E8F0] rounded-xl text-[#64748B] hover:bg-[#F8FAFC]">
            <RefreshCw size={13} />
          </button>
          <Link href="/dashboard/hotel/reservations"
            className="flex items-center gap-1.5 px-4 py-2 bg-amber-500 text-white rounded-xl text-[13px] font-bold hover:bg-amber-600">
            <Plus size={13} /> Nouvelle réservation
          </Link>
        </div>
      </div>

      {/* KPIs */}
      {kpis && (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          {[
            { label: 'Taux occupation', value: `${kpis.taux_occupation}%`, sub: `${kpis.nb_occupees}/${kpis.nb_chambres} chambres`, color: kpis.taux_occupation >= 70 ? '#16A34A' : '#F59E0B', icon: TrendingUp },
            { label: 'CA du mois',      value: fmt(kpis.ca_mois),          sub: `Encaissé : ${fmt(kpis.encaisse)}`,                   color: '#2563EB',  icon: DollarSign },
            { label: 'RevPAR',          value: fmt(kpis.revpar),           sub: 'Revenue par chambre/jour',                            color: '#7C3AED',  icon: TrendingUp },
            { label: 'ADR',             value: fmt(kpis.adr),              sub: 'Tarif moyen / nuit vendue',                           color: '#0891B2',  icon: BedDouble  },
            { label: 'Résultat',        value: fmt(kpis.resultat),         sub: `Dépenses : ${fmt(kpis.depenses_total)}`,              color: kpis.resultat >= 0 ? '#16A34A' : '#DC2626', icon: DollarSign },
          ].map(k => {
            const Icon = k.icon
            return (
              <div key={k.label} className="bg-white rounded-2xl p-4 border border-[#E2E8F0] shadow-sm">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: k.color + '18' }}>
                    <Icon size={13} style={{ color: k.color }} />
                  </div>
                  <span className="text-[10px] font-bold text-[#64748B] uppercase tracking-wide">{k.label}</span>
                </div>
                <p className="text-[18px] font-black" style={{ color: k.color }}>{k.value}</p>
                <p className="text-[10px] text-[#94A3B8] mt-0.5">{k.sub}</p>
              </div>
            )
          })}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* Plan des chambres */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-[#E2E8F0] shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-[#F1F5F9]">
            <h2 className="font-bold text-[14px] text-[#0F172A] flex items-center gap-2">
              <BedDouble size={15} className="text-amber-600" /> Plan des chambres
            </h2>
            <div className="flex items-center gap-3 text-[10px]">
              {Object.entries(ROOM_STATUT).map(([k, v]) => (
                <span key={k} className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full inline-block" style={{ background: v.color }} />
                  <span style={{ color: v.color }}>{v.label}</span>
                </span>
              ))}
            </div>
          </div>
          <div className="p-4 space-y-4">
            {rooms.length === 0 ? (
              <div className="text-center py-8">
                <BedDouble size={32} className="text-[#CBD5E1] mx-auto mb-2" />
                <p className="text-[13px] text-[#64748B]">Aucune chambre configurée</p>
                <Link href="/dashboard/hotel/reservations" className="text-amber-600 text-[12px] hover:underline mt-1 inline-block">
                  → Configurer les chambres
                </Link>
              </div>
            ) : etages.map(etage => (
              <div key={etage}>
                <p className="text-[11px] font-bold text-[#64748B] uppercase tracking-wide mb-2">
                  {etage === 0 ? 'Rez-de-chaussée' : `Étage ${etage}`}
                </p>
                <div className="flex flex-wrap gap-2">
                  {rooms.filter(r => r.etage === etage).map(r => {
                    const st = ROOM_STATUT[r.statut] ?? ROOM_STATUT.disponible
                    return (
                      <div key={r.id}
                        className="w-14 h-14 rounded-xl flex flex-col items-center justify-center border-2 cursor-pointer hover:scale-105 transition-transform"
                        style={{ borderColor: st.color + '60', background: st.bg }}
                        title={`${r.numero} — ${r.htl_room_types?.nom ?? ''} — ${st.label}`}>
                        <p className="text-[12px] font-black" style={{ color: st.color }}>{r.numero}</p>
                        <p className="text-[8px]" style={{ color: st.color }}>{st.label}</p>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Colonne droite */}
        <div className="space-y-4">

          {/* MIAA briefing */}
          <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-2xl border border-amber-200 p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-[13px] text-amber-800 flex items-center gap-2">
                <Sparkles size={13} /> MIAA — Briefing IA
              </h3>
              <button onClick={loadBriefing} className="text-[11px] text-amber-600 hover:underline font-semibold">
                Générer
              </button>
            </div>
            {briefing ? (
              <p className="text-[12px] text-amber-900 whitespace-pre-wrap leading-relaxed">{briefing}</p>
            ) : (
              <p className="text-[12px] text-amber-700/70 italic">Cliquez "Générer" pour obtenir un briefing IA personnalisé basé sur vos KPIs en temps réel.</p>
            )}
            <Link href="/dashboard/hotel/miaa" className="mt-3 flex items-center gap-1 text-[11px] text-amber-700 font-bold hover:underline">
              Chat MIAA hôtel <ArrowRight size={10} />
            </Link>
          </div>

          {/* Arrivées du jour */}
          <div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-sm">
            <div className="flex items-center justify-between px-4 py-3 border-b border-[#F1F5F9]">
              <h3 className="font-bold text-[13px] text-[#0F172A] flex items-center gap-2">
                <Users size={13} className="text-green-600" /> Arrivées ({arrivals.length})
              </h3>
            </div>
            <div className="divide-y divide-[#F8FAFC]">
              {arrivals.length === 0 ? (
                <p className="text-center text-[12px] text-[#94A3B8] py-4">Aucune arrivée aujourd'hui</p>
              ) : arrivals.slice(0, 5).map(r => (
                <div key={r.id} className="px-4 py-2.5">
                  <p className="text-[12px] font-bold text-[#0F172A]">
                    {r.htl_guests?.nom ?? 'Client'} {r.htl_guests?.prenom ?? ''}
                  </p>
                  <p className="text-[10px] text-[#64748B]">
                    {r.numero} · {r.htl_reservation_rooms[0]?.htl_rooms?.numero ?? '—'} · {fmtDate(r.date_arrivee)} → {fmtDate(r.date_depart)}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Alertes HK + Maint */}
          {(hkTasks.length > 0 || maints.length > 0) && (
            <div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-sm">
              <div className="px-4 py-3 border-b border-[#F1F5F9]">
                <h3 className="font-bold text-[13px] text-[#0F172A] flex items-center gap-2">
                  <AlertTriangle size={13} className="text-amber-500" /> Alertes opérationnelles
                </h3>
              </div>
              <div className="p-3 space-y-2">
                {hkTasks.length > 0 && (
                  <Link href="/dashboard/hotel/housekeeping" className="flex items-center justify-between px-3 py-2 bg-amber-50 rounded-xl hover:bg-amber-100 transition-colors">
                    <span className="flex items-center gap-2 text-[12px] font-semibold text-amber-800">
                      <Clock size={12} /> {hkTasks.length} tâches ménage en attente
                    </span>
                    <ArrowRight size={12} className="text-amber-600" />
                  </Link>
                )}
                {maints.length > 0 && (
                  <Link href="/dashboard/hotel/maintenance" className="flex items-center justify-between px-3 py-2 bg-red-50 rounded-xl hover:bg-red-100 transition-colors">
                    <span className="flex items-center gap-2 text-[12px] font-semibold text-red-700">
                      <Wrench size={12} /> {maints.length} panne(s) signalée(s)
                    </span>
                    <ArrowRight size={12} className="text-red-600" />
                  </Link>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Départs en cours */}
      {departs.length > 0 && (
        <div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-[#F1F5F9] flex items-center justify-between">
            <h3 className="font-bold text-[14px] text-[#0F172A] flex items-center gap-2">
              <CheckCircle2 size={15} className="text-blue-600" /> Départs prévus ({departs.filter(r => r.date_depart === today).length})
            </h3>
            <Link href="/dashboard/hotel/reservations" className="text-[12px] text-amber-600 font-bold hover:underline flex items-center gap-1">
              Voir tout <ArrowRight size={11} />
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#F1F5F9] bg-[#F8FAFC]">
                  {['Client','Chambre','Séjour','Montant','Action'].map(h => (
                    <th key={h} className="text-left px-4 py-2.5 text-[11px] font-bold text-[#64748B] uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F8FAFC]">
                {departs.filter(r => r.date_depart <= today).slice(0, 8).map(r => (
                  <tr key={r.id} className="hover:bg-[#F8FAFC]">
                    <td className="px-4 py-3">
                      <p className="font-semibold text-[13px] text-[#0F172A]">{r.htl_guests?.nom ?? '—'} {r.htl_guests?.prenom ?? ''}</p>
                      <p className="text-[10px] text-[#94A3B8]">{r.htl_guests?.telephone ?? ''}</p>
                    </td>
                    <td className="px-4 py-3 text-[12px] text-[#475569]">{r.htl_reservation_rooms[0]?.htl_rooms?.numero ?? '—'}</td>
                    <td className="px-4 py-3 text-[11px] text-[#64748B]">{fmtDate(r.date_arrivee)} → {fmtDate(r.date_depart)}</td>
                    <td className="px-4 py-3 font-bold text-[13px] text-[#0F172A]">{fmt(r.montant_total)}</td>
                    <td className="px-4 py-3">
                      <Link href={`/dashboard/hotel/reservations?action=checkout&id=${r.id}`}
                        className="px-3 py-1.5 bg-green-500 text-white rounded-lg text-[11px] font-bold hover:bg-green-600">
                        Check-out
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

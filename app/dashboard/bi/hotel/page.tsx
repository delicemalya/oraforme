'use client'

import { useState, useEffect, useCallback } from 'react'
import { Building2, Wallet, Bed, RefreshCw, Loader2, TrendingUp } from 'lucide-react'
import { BiKpiCard } from '@/components/bi/BiKpiCard'
import { BiChartCard, BiSectionLabel } from '@/components/bi/BiChartCard'
import { BiAlerts } from '@/components/bi/BiAlerts'
import { fmtShortFCFA, fmtPct } from '@/lib/analytics/formatters'
import type { HotelInsights } from '@/lib/analytics/types'

export default function BiHotelPage() {
  const [data, setData]       = useState<HotelInsights | null>(null)
  const [loading, setLoading] = useState(true)
  const [year, setYear]       = useState(new Date().getFullYear())

  const YEARS = [new Date().getFullYear(), new Date().getFullYear() - 1]

  const load = useCallback(async (y = year) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/bi/insights?module=hotel&year=${y}`)
      if (res.ok) setData(await res.json())
    } finally {
      setLoading(false)
    }
  }, [year])

  useEffect(() => { load() }, [load])

  const k = data?.kpis

  return (
    <div className="space-y-5 pb-12 p-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: '#DC2626' }}>
            <Building2 size={18} className="text-white" />
          </div>
          <div>
            <h1 className="text-[20px] font-bold text-[#0F172A] tracking-tight">Hôtellerie</h1>
            <p className="text-[11px] text-[#6B7280]">Tableau de bord hôtel — Exercice {year}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <select value={year} onChange={e => { const y = Number(e.target.value); setYear(y); load(y) }}
            className="bg-white border border-[#E5E7EB] rounded-lg px-3 py-2 text-[12px] text-[#374151] outline-none">
            {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <button onClick={() => load()} disabled={loading}
            className="flex items-center gap-1.5 text-[12px] font-medium px-3 py-2 rounded-lg bg-white border border-[#E5E7EB] text-[#374151] hover:bg-[#F9FAFB] disabled:opacity-50 transition-colors">
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> Actualiser
          </button>
        </div>
      </div>

      {loading && !data && (
        <div className="flex items-center gap-2 text-[12px] text-[#6B7280] py-8 justify-center">
          <Loader2 size={16} className="animate-spin" /> Chargement...
        </div>
      )}

      {data && k && (
        <div className="space-y-5">
          <BiSectionLabel label="Performance hôtelière" />
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <BiKpiCard
              label="Chambres occupées" value={k.chambresOccupees}
              formatted={`${k.chambresOccupees} / ${k.nbChambres}`}
              sub="actuellement"
              icon={<Bed size={16} />} accent="#DC2626"
            />
            <BiKpiCard
              label="Taux d'occupation" value={k.tauxOccupation}
              formatted={fmtPct(k.tauxOccupation)}
              icon={<TrendingUp size={16} />}
              accent={k.tauxOccupation >= 70 ? '#16A34A' : k.tauxOccupation >= 40 ? '#F59E0B' : '#DC2626'}
              alert={k.tauxOccupation < 40}
            />
            <BiKpiCard
              label="Revenus annuels" value={k.revenuAnnee}
              formatted={fmtShortFCFA(k.revenuAnnee)}
              icon={<Wallet size={16} />} accent="#0F172A"
            />
            <BiKpiCard
              label="RevPAC" value={k.revParChambre}
              formatted={fmtShortFCFA(k.revParChambre)}
              sub="revenu par chambre disponible"
              icon={<Building2 size={16} />} accent="#7C3AED"
            />
          </div>

          <div className="grid grid-cols-2 gap-4 max-w-lg">
            <BiKpiCard
              label="Réservations" value={k.nbReservations}
              formatted={String(k.nbReservations)}
              sub="cette année"
              icon={<Bed size={16} />} accent="#DC2626"
            />
            <BiKpiCard
              label="Revenus ce mois" value={k.revenuMois}
              formatted={fmtShortFCFA(k.revenuMois)}
              icon={<Wallet size={16} />} accent="#16A34A"
            />
          </div>

          <BiChartCard title="Alertes — Hôtel">
            <BiAlerts alerts={data.alerts} />
          </BiChartCard>
        </div>
      )}
    </div>
  )
}

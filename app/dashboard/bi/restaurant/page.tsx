'use client'

import { useState, useEffect, useCallback } from 'react'
import { ShoppingCart, Wallet, Clock, TrendingUp, RefreshCw, Loader2 } from 'lucide-react'
import { BiKpiCard } from '@/components/bi/BiKpiCard'
import { BiChartCard, BiSectionLabel } from '@/components/bi/BiChartCard'
import { BiAlerts } from '@/components/bi/BiAlerts'
import { useFmt } from '@/lib/hooks/useFmt'
import type { RestoInsights } from '@/lib/analytics/types'

export default function BiRestoPage() {
  const { fmt: fmtFCFA, fmtShort: fmtShortFCFA } = useFmt()
  const [data, setData]       = useState<RestoInsights | null>(null)
  const [loading, setLoading] = useState(true)
  const [year, setYear]       = useState(new Date().getFullYear())

  const YEARS = [new Date().getFullYear(), new Date().getFullYear() - 1]

  const load = useCallback(async (y = year) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/bi/insights?module=resto&year=${y}`)
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
            <ShoppingCart size={18} className="text-white" />
          </div>
          <div>
            <h1 className="text-[20px] font-bold text-[#0F172A] tracking-tight">Restauration</h1>
            <p className="text-[11px] text-[#6B7280]">Tableau de bord resto — Exercice {year}</p>
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
          <BiSectionLabel label="Ventes & Commandes" />
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <BiKpiCard
              label="Ventes totales" value={k.ventesTotales}
              formatted={fmtShortFCFA(k.ventesTotales)}
              icon={<Wallet size={16} />} accent="#DC2626"
            />
            <BiKpiCard
              label="Ventes ce mois" value={k.ventesMois}
              formatted={fmtShortFCFA(k.ventesMois)}
              icon={<TrendingUp size={16} />} accent="#0F172A"
            />
            <BiKpiCard
              label="Nb commandes" value={k.nbCommandes}
              formatted={String(k.nbCommandes)}
              sub="commandes terminées"
              icon={<ShoppingCart size={16} />} accent="#7C3AED"
            />
            <BiKpiCard
              label="Ticket moyen" value={k.ticketMoyen}
              formatted={fmtFCFA(k.ticketMoyen)}
              icon={<Clock size={16} />} accent="#F59E0B"
            />
          </div>

          <div className="grid grid-cols-2 gap-4 max-w-lg">
            <BiChartCard title="Top plat">
              <p className="text-[22px] font-bold text-[#0F172A]">{k.topPlat}</p>
              <p className="text-[11px] text-[#9CA3AF] mt-1">Plat le plus commandé</p>
            </BiChartCard>
            <BiChartCard title="Heure forte">
              <p className="text-[22px] font-bold text-[#0F172A]">{k.heureFort}</p>
              <p className="text-[11px] text-[#9CA3AF] mt-1">Pic d&apos;activité</p>
            </BiChartCard>
          </div>

          <BiChartCard title="Alertes — Restauration">
            <BiAlerts alerts={data.alerts} />
          </BiChartCard>
        </div>
      )}
    </div>
  )
}

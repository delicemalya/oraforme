'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Users, Wallet, AlertTriangle, TrendingUp,
  RefreshCw, Loader2, Activity, UserCheck, UserX,
} from 'lucide-react'
import { BiKpiCard } from '@/components/bi/BiKpiCard'
import { BiChartCard, BiSectionLabel, BiEmpty, BiProgressRow } from '@/components/bi/BiChartCard'
import { BiAlerts } from '@/components/bi/BiAlerts'
import { BiBarChart, BiCountBarChart, BiDonutChart } from '@/components/bi/BiCharts'
import { fmtPct } from '@/lib/analytics/formatters'
import { useFmt } from '@/lib/hooks/useFmt'
import type { RhInsights } from '@/lib/analytics/types'

export default function BiRhPage() {
  const { fmt: fmtFCFA, fmtShort: fmtShortFCFA } = useFmt()
  const [data, setData]       = useState<RhInsights | null>(null)
  const [loading, setLoading] = useState(true)
  const [year, setYear]       = useState(new Date().getFullYear())

  const YEARS = [new Date().getFullYear(), new Date().getFullYear() - 1, new Date().getFullYear() - 2]

  const load = useCallback(async (y = year) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/bi/insights?module=rh&year=${y}`)
      if (res.ok) setData(await res.json())
    } finally {
      setLoading(false)
    }
  }, [year])

  useEffect(() => { load() }, [load])

  const k = data?.kpis

  const effectifDonut = k ? [
    { name: 'Actifs',    value: k.effectifActif,                             color: '#DC2626' },
    { name: 'En congé',  value: k.nbConges,                                  color: '#F59E0B' },
    { name: 'Autres',    value: Math.max(0, k.effectifTotal - k.effectifActif - k.nbConges), color: '#E5E7EB' },
  ].filter(d => d.value > 0) : []

  return (
    <div className="space-y-5 pb-12 p-5">

      {/* ── Header ── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: '#DC2626' }}>
            <Users size={18} className="text-white" />
          </div>
          <div>
            <h1 className="text-[20px] font-bold text-[#0F172A] tracking-tight">Ressources Humaines</h1>
            <p className="text-[11px] text-[#6B7280]">Tableau de bord RH — Exercice {year}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={year}
            onChange={e => { const y = Number(e.target.value); setYear(y); load(y) }}
            className="bg-white border border-[#E5E7EB] rounded-lg px-3 py-2 text-[12px] text-[#374151] outline-none"
          >
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
          <BiSectionLabel label="Effectif" />
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <BiKpiCard
              label="Effectif actif" value={k.effectifActif}
              formatted={String(k.effectifActif)}
              sub={`/ ${k.effectifTotal} total`}
              icon={<UserCheck size={16} />} accent="#DC2626"
            />
            <BiKpiCard
              label="En congé" value={k.nbConges}
              formatted={String(k.nbConges)}
              sub="collaborateur(s)"
              icon={<Users size={16} />} accent="#F59E0B"
            />
            <BiKpiCard
              label="Taux de présence" value={k.tauxPresence}
              formatted={fmtPct(k.tauxPresence)}
              sub="ce mois"
              icon={<Activity size={16} />}
              accent={k.tauxPresence >= 90 ? '#16A34A' : k.tauxPresence >= 75 ? '#F59E0B' : '#DC2626'}
              alert={k.tauxPresence < 80}
            />
            <BiKpiCard
              label="Contrats expirant" value={k.contratsExpirant30}
              formatted={String(k.contratsExpirant30)}
              sub="dans les 30 prochains jours"
              icon={<AlertTriangle size={16} />}
              accent={k.contratsExpirant30 > 0 ? '#DC2626' : '#16A34A'}
              alert={k.contratsExpirant30 > 0}
            />
          </div>

          <BiSectionLabel label="Masse salariale & Mouvements" />
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <BiKpiCard
              label="Masse salariale (mois)" value={k.masseSalMois}
              formatted={fmtShortFCFA(k.masseSalMois)}
              sub="bulletins de paie payés"
              icon={<Wallet size={16} />} accent="#DC2626"
            />
            <BiKpiCard
              label="Masse salariale (année)" value={k.masseSalAnnee}
              formatted={fmtShortFCFA(k.masseSalAnnee)}
              icon={<Wallet size={16} />} accent="#0F172A"
            />
            <BiKpiCard
              label="Recrutements" value={k.nbRecrutements}
              formatted={String(k.nbRecrutements)}
              sub="embauches ce trimestre"
              icon={<UserCheck size={16} />} accent="#16A34A"
            />
            <BiKpiCard
              label="Démissions" value={k.nbDemissions}
              formatted={String(k.nbDemissions)}
              sub="départs volontaires"
              icon={<UserX size={16} />}
              accent={k.nbDemissions > 0 ? '#DC2626' : '#6B7280'}
            />
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2">
              <BiChartCard title="Masse salariale mensuelle" sub={`Bulletins de paie payés — ${year}`}>
                {data.charts.masseSalMensuelle.some(m => (m.masse as number) > 0) ? (
                  <BiBarChart
                    data={data.charts.masseSalMensuelle}
                    series={[{ dataKey: 'masse', color: '#DC2626', label: 'Masse salariale' }]}
                    theme="light"
                    height={220}
                    formatter={fmtFCFA}
                  />
                ) : <BiEmpty message="Aucun bulletin de paie enregistré" />}
              </BiChartCard>
            </div>

            <div className="space-y-4">
              <BiChartCard title="Répartition effectif">
                {effectifDonut.length > 0 ? (
                  <>
                    <BiDonutChart data={effectifDonut} height={160} theme="light" />
                    <div className="space-y-1.5 mt-3">
                      {effectifDonut.map(d => (
                        <div key={d.name} className="flex items-center gap-2">
                          <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: d.color }} />
                          <span className="text-[11px] text-[#6B7280] flex-1">{d.name}</span>
                          <span className="text-[11px] font-bold text-[#0F172A]">{d.value}</span>
                        </div>
                      ))}
                    </div>
                  </>
                ) : <BiEmpty />}
              </BiChartCard>

              {/* Progression indicateurs */}
              <BiChartCard title="Indicateurs RH">
                <div className="space-y-4">
                  <BiProgressRow
                    label="Taux de présence"
                    value={k.tauxPresence}
                    max={100}
                    color={k.tauxPresence >= 90 ? '#16A34A' : k.tauxPresence >= 75 ? '#F59E0B' : '#DC2626'}
                    suffix="%"
                  />
                  <BiProgressRow
                    label="Actifs / Total"
                    value={k.effectifActif}
                    max={Math.max(k.effectifTotal, 1)}
                    color="#DC2626"
                  />
                  <BiProgressRow
                    label="Stabilité (non-départs)"
                    value={Math.max(0, k.effectifTotal - k.nbDemissions)}
                    max={Math.max(k.effectifTotal, 1)}
                    color="#0F172A"
                  />
                </div>
              </BiChartCard>
            </div>
          </div>

          {/* Absences */}
          <BiChartCard title="Absences par mois" sub={`Présences marquées absentes — ${year}`}>
            {data.charts.absencesParMois.some(m => (m.absences as number) > 0) ? (
              <BiCountBarChart
                data={data.charts.absencesParMois}
                dataKey="absences"
                color="#DC2626"
                theme="light"
                height={180}
              />
            ) : <BiEmpty message="Aucune absence enregistrée" />}
          </BiChartCard>

          {/* Alertes */}
          <BiChartCard title="Alertes RH">
            <BiAlerts alerts={data.alerts} />
          </BiChartCard>
        </div>
      )}
    </div>
  )
}

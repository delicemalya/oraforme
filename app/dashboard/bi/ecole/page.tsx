'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  GraduationCap, Wallet, AlertTriangle, Users,
  RefreshCw, Loader2, BookOpen, CheckCircle,
} from 'lucide-react'
import { BiKpiCard } from '@/components/bi/BiKpiCard'
import { BiChartCard, BiSectionLabel, BiEmpty, BiProgressRow } from '@/components/bi/BiChartCard'
import { BiAlerts } from '@/components/bi/BiAlerts'
import { BiBarChart, BiCountBarChart, BiDonutChart } from '@/components/bi/BiCharts'
import { fmtPct } from '@/lib/analytics/formatters'
import { useFmt } from '@/lib/hooks/useFmt'
import type { EcoleInsights } from '@/lib/analytics/types'

export default function BiEcolePage() {
  const { fmt: fmtFCFA, fmtShort: fmtShortFCFA } = useFmt()
  const [data, setData]       = useState<EcoleInsights | null>(null)
  const [loading, setLoading] = useState(true)
  const [year, setYear]       = useState(new Date().getFullYear())

  const YEARS = [new Date().getFullYear(), new Date().getFullYear() - 1, new Date().getFullYear() - 2]

  const load = useCallback(async (y = year) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/bi/insights?module=ecole&year=${y}`)
      if (res.ok) setData(await res.json())
    } finally {
      setLoading(false)
    }
  }, [year])

  useEffect(() => { load() }, [load])

  const k = data?.kpis

  const paiementsDonut = data?.charts.paiementsStatus ?? []

  return (
    <div className="space-y-5 pb-12 p-5">

      {/* ── Header ── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: '#DC2626' }}>
            <GraduationCap size={18} className="text-white" />
          </div>
          <div>
            <h1 className="text-[20px] font-bold text-[#0F172A] tracking-tight">École & Université</h1>
            <p className="text-[11px] text-[#6B7280]">Tableau de bord pédagogique — Exercice {year}</p>
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
          <BiSectionLabel label="Effectifs & Scolarité" />
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <BiKpiCard
              label="Élèves actifs" value={k.nbEleves}
              formatted={String(k.nbEleves)}
              sub={`+${k.nbElevesMois} ce mois`}
              icon={<GraduationCap size={16} />} accent="#DC2626"
            />
            <BiKpiCard
              label="Recettes scolarité" value={k.scolAnnee}
              formatted={fmtShortFCFA(k.scolAnnee)}
              sub={`${fmtShortFCFA(k.scolMois)} ce mois`}
              icon={<Wallet size={16} />} accent="#0F172A"
            />
            <BiKpiCard
              label="Taux de paiement" value={k.txPaiement}
              formatted={fmtPct(k.txPaiement)}
              sub="familles à jour"
              icon={<CheckCircle size={16} />}
              accent={k.txPaiement >= 85 ? '#16A34A' : k.txPaiement >= 70 ? '#F59E0B' : '#DC2626'}
              alert={k.txPaiement < 70}
            />
            <BiKpiCard
              label="Familles impayées" value={k.nbImpayesFamilles}
              formatted={String(k.nbImpayesFamilles)}
              sub={fmtShortFCFA(k.montantImpayes) + ' à recouvrer'}
              icon={<AlertTriangle size={16} />}
              accent={k.nbImpayesFamilles > 0 ? '#DC2626' : '#16A34A'}
              alert={k.nbImpayesFamilles > 0}
            />
          </div>

          <BiSectionLabel label="Discipline & Suivi" />
          <div className="grid grid-cols-2 lg:grid-cols-2 gap-4 max-w-2xl">
            <BiKpiCard
              label="Absences totales" value={k.nbAbsences}
              formatted={String(k.nbAbsences)}
              sub={`Exercice ${year}`}
              icon={<BookOpen size={16} />}
              accent={k.nbAbsences > 100 ? '#DC2626' : k.nbAbsences > 50 ? '#F59E0B' : '#6B7280'}
            />
            <BiKpiCard
              label="Élèves à jour" value={k.nbEleves - k.nbImpayesFamilles}
              formatted={String(Math.max(0, k.nbEleves - k.nbImpayesFamilles))}
              sub={`${fmtPct(k.txPaiement)} de l'effectif`}
              icon={<Users size={16} />} accent="#16A34A"
            />
          </div>

          {/* Charts row */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2">
              <BiChartCard title="Recettes de scolarité" sub={`Paiements mensuels — ${year}`}>
                {data.charts.scolParMois.some(m => (m.montant as number) > 0) ? (
                  <BiBarChart
                    data={data.charts.scolParMois}
                    series={[{ dataKey: 'montant', color: '#DC2626', label: 'Scolarité' }]}
                    theme="light"
                    height={220}
                    formatter={fmtFCFA}
                  />
                ) : <BiEmpty message="Aucun paiement enregistré cette année" />}
              </BiChartCard>
            </div>

            <div className="space-y-4">
              {/* Paiements status donut */}
              <BiChartCard title="Statut paiements">
                {paiementsDonut.length > 0 ? (
                  <>
                    <BiDonutChart data={paiementsDonut} height={160} theme="light" />
                    <div className="space-y-1.5 mt-3">
                      {paiementsDonut.map(d => (
                        <div key={d.name} className="flex items-center gap-2">
                          <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: d.color }} />
                          <span className="text-[11px] text-[#6B7280] flex-1">{d.name}</span>
                          <span className="text-[11px] font-bold text-[#0F172A]">{d.value}</span>
                        </div>
                      ))}
                    </div>
                  </>
                ) : <BiEmpty message="Aucun élève enregistré" />}
              </BiChartCard>

              {/* Indicateurs */}
              <BiChartCard title="Indicateurs école">
                <div className="space-y-4">
                  <BiProgressRow
                    label="Taux paiement"
                    value={k.txPaiement}
                    max={100}
                    color={k.txPaiement >= 85 ? '#16A34A' : k.txPaiement >= 70 ? '#F59E0B' : '#DC2626'}
                    suffix="%"
                  />
                  {k.nbEleves > 0 && (
                    <BiProgressRow
                      label="Familles à jour"
                      value={Math.max(0, k.nbEleves - k.nbImpayesFamilles)}
                      max={k.nbEleves}
                      color="#DC2626"
                    />
                  )}
                </div>
              </BiChartCard>
            </div>
          </div>

          {/* Absences chart */}
          <BiChartCard title="Absences par mois" sub={`Absences enregistrées — ${year}`}>
            {data.charts.absencesParMois.some(m => (m.absences as number) > 0) ? (
              <BiCountBarChart
                data={data.charts.absencesParMois}
                dataKey="absences"
                color="#DC2626"
                theme="light"
                height={160}
              />
            ) : <BiEmpty message="Aucune absence enregistrée cette année" />}
          </BiChartCard>

          {/* Alertes */}
          <BiChartCard title="Alertes — École">
            <BiAlerts alerts={data.alerts} />
          </BiChartCard>
        </div>
      )}
    </div>
  )
}

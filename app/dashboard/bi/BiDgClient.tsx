'use client'

import { useLocale } from '@/lib/hooks/useLocale'

import { useState, useCallback } from 'react'
import {
  TrendingUp, TrendingDown, Wallet, Users, FileText,
  AlertTriangle, RefreshCw, Loader2, Activity,
  BarChart2, Target, Building2, Download,
} from 'lucide-react'
import { BiKpiCard } from '@/components/bi/BiKpiCard'
import { BiChartCard, BiSectionLabel, BiEmpty } from '@/components/bi/BiChartCard'
import { BiAlerts } from '@/components/bi/BiAlerts'
import { BiTrendChart, BiComposedChart, BiDonutChart } from '@/components/bi/BiCharts'
import { fmtPct, growthPct } from '@/lib/analytics/formatters'
import { useFmt } from '@/lib/hooks/useFmt'
import type { DgInsights } from '@/lib/analytics/types'

type Tab = 'apercu' | 'cashflow' | 'alertes'

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: 'apercu',   label: 'Vue d\'ensemble', icon: BarChart2 },
  { id: 'cashflow', label: 'Cash Flow',        icon: Activity },
  { id: 'alertes',  label: 'Alertes',          icon: AlertTriangle },
]

interface Props {
  initial: DgInsights
  year: number
}

export default function BiDgClient({ initial, year: initialYear }: Props) {
  const { fmt: fmtFCFA, fmtShort: fmtShortFCFA } = useFmt()
  const { t } = useLocale()
  const [data, setData]     = useState<DgInsights>(initial)
  const [tab, setTab]       = useState<Tab>('apercu')
  const [year, setYear]     = useState(initialYear)
  const [loading, setLoading] = useState(false)

  const YEARS = [new Date().getFullYear(), new Date().getFullYear() - 1, new Date().getFullYear() - 2]

  const refresh = useCallback(async (y = year) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/bi/insights?module=dg&year=${y}`)
      if (res.ok) setData(await res.json())
    } finally {
      setLoading(false)
    }
  }, [year])

  const k = data.kpis
  const caGrowth  = growthPct(k.caMois, k.caPrevMois)
  const depGrowth = growthPct(k.depMois, k.depPrevMois)
  const critAlerts = data.alerts.filter(a => a.severity === 'critical').length

  return (
    <div className="space-y-5 pb-12 p-5">

      {/* ── Header ── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: '#DC2626' }}>
            <Activity size={18} className="text-white" />
          </div>
          <div>
            <h1 className="text-[20px] font-bold text-[#0F172A] tracking-tight">Analytics & BI</h1>
            <p className="text-[11px] text-[#6B7280]">Intelligence économique · Exercice {year}</p>
          </div>
          {critAlerts > 0 && (
            <span className="flex items-center gap-1 px-2 py-1 rounded-lg bg-red-50 border border-red-200 text-[11px] font-bold text-[#DC2626]">
              <AlertTriangle size={11} /> {critAlerts} alerte{critAlerts > 1 ? 's' : ''} critique{critAlerts > 1 ? 's' : ''}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <select
            value={year}
            onChange={e => { const y = Number(e.target.value); setYear(y); refresh(y) }}
            className="bg-white border border-[#E5E7EB] rounded-lg px-3 py-2 text-[12px] text-[#374151] outline-none"
          >
            {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <button onClick={() => refresh()} disabled={loading}
            className="flex items-center gap-1.5 text-[12px] font-medium px-3 py-2 rounded-lg bg-white border border-[#E5E7EB] text-[#374151] hover:bg-[#F9FAFB] transition-colors disabled:opacity-50">
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> Actualiser
          </button>
          <button className="flex items-center gap-1.5 text-[12px] font-medium px-3 py-2 rounded-lg bg-[#DC2626] text-white hover:bg-[#B91C1C] transition-colors">
            <Download size={13} /> Export
          </button>
        </div>
      </div>

      {/* ── Tabs ── */}
      <div className="flex gap-1 bg-white border border-[#E5E7EB] rounded-xl p-1 w-fit">
        {TABS.map(t => {
          const Icon = t.icon
          const active = tab === t.id
          return (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-[12px] font-medium transition-all ${
                active ? 'bg-[#DC2626] text-white shadow-sm' : 'text-[#6B7280] hover:text-[#374151]'
              }`}>
              <Icon size={13} /> {t.label}
            </button>
          )
        })}
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-[12px] text-[#6B7280]">
          <Loader2 size={14} className="animate-spin" /> Mise à jour...
        </div>
      )}

      {/* ══════════════════════════════════════
          TAB : VUE D'ENSEMBLE
      ══════════════════════════════════════ */}
      {tab === 'apercu' && (
        <div className="space-y-5">
          <BiSectionLabel label="Performance financière" />
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <BiKpiCard
              label="Chiffre d'affaires" value={k.caAnnee}
              formatted={fmtShortFCFA(k.caAnnee)}
              sub={`${fmtShortFCFA(k.caMois)} ce mois`}
              trend={caGrowth} trendUp={true}
              icon={<TrendingUp size={16} />} accent="#DC2626"
              loading={loading}
            />
            <BiKpiCard
              label="Dépenses totales" value={k.depAnnee}
              formatted={fmtShortFCFA(k.depAnnee)}
              sub={`${fmtShortFCFA(k.depMois)} ce mois`}
              trend={depGrowth} trendUp={false}
              icon={<TrendingDown size={16} />} accent="#6B7280"
              loading={loading}
            />
            <BiKpiCard
              label="Résultat net" value={k.resultatNet}
              formatted={fmtShortFCFA(k.resultatNet)}
              sub="Produits − Charges"
              badge={fmtPct(k.margeNetPct)}
              icon={<BarChart2 size={16} />}
              accent={k.resultatNet >= 0 ? '#16A34A' : '#DC2626'}
              loading={loading}
            />
            <BiKpiCard
              label="Trésorerie totale" value={k.tresoTotale}
              formatted={fmtShortFCFA(k.tresoTotale)}
              sub="Banque + Caisse + Mobile"
              icon={<Wallet size={16} />}
              accent={k.tresoTotale >= 0 ? '#2563EB' : '#DC2626'}
              alert={k.tresoTotale < 500_000}
              loading={loading}
            />
          </div>

          <BiSectionLabel label="Clients & Personnel" />
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <BiKpiCard
              label="Créances clients" value={k.creancesClients}
              formatted={fmtShortFCFA(k.creancesClients)}
              sub={`${k.nbFacturesOuvertes} facture${k.nbFacturesOuvertes > 1 ? 's' : ''} ouvertes`}
              badge={k.nbFacturesRetard > 0 ? `${k.nbFacturesRetard} en retard` : undefined}
              icon={<FileText size={16} />} accent="#F59E0B"
              alert={k.nbFacturesRetard > 0}
              loading={loading}
            />
            <BiKpiCard
              label="Masse salariale" value={k.salairesAnnee}
              formatted={fmtShortFCFA(k.salairesAnnee)}
              sub={`${fmtPct(k.caAnnee > 0 ? Math.round(k.salairesAnnee / k.caAnnee * 100) : 0)} du CA`}
              icon={<Users size={16} />} accent="#7C3AED"
              loading={loading}
            />
            <BiKpiCard
              label="Effectif actif" value={k.effectifActif}
              formatted={String(k.effectifActif)}
              sub={`/ ${k.effectifTotal} total`}
              icon={<Users size={16} />} accent="#0F172A"
              loading={loading}
            />
            <BiKpiCard
              label="Contrats expirant" value={k.contratsExpirant30}
              formatted={String(k.contratsExpirant30)}
              sub="dans les 30 prochains jours"
              icon={<AlertTriangle size={16} />}
              accent={k.contratsExpirant30 > 0 ? '#DC2626' : '#16A34A'}
              alert={k.contratsExpirant30 > 0}
              loading={loading}
            />
          </div>

          {/* Charts row */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2">
              <BiChartCard
                title="Évolution mensuelle"
                sub={`Entrées · Sorties · Résultat net — ${year}`}
              >
                {data.charts.monthlyTrend.length > 0 ? (
                  <BiComposedChart
                    data={data.charts.monthlyTrend}
                    bars={[
                      { dataKey: 'entrees', color: '#DC2626', label: 'Entrées' },
                      { dataKey: 'sorties', color: '#E5E7EB', label: 'Sorties' },
                    ]}
                    lines={[
                      { dataKey: 'net', color: '#0F172A', label: 'Net' },
                    ]}
                    theme="light"
                    height={240}
                  />
                ) : <BiEmpty />}
              </BiChartCard>
            </div>

            <div className="space-y-4">
              {/* Score santé */}
              <BiChartCard title="Score financier" sub="Basé sur 4 indicateurs">
                {(() => {
                  const treso  = Math.min(25, k.tresoTotale >= 1_000_000 ? 25 : k.tresoTotale >= 500_000 ? 18 : k.tresoTotale >= 0 ? 10 : 0)
                  const marge  = Math.min(25, Math.max(0, Math.round(k.margeNetPct * 0.25)))
                  const creance = Math.min(25, k.nbFacturesRetard === 0 ? 25 : k.nbFacturesRetard <= 3 ? 15 : 8)
                  const rh     = Math.min(25, k.contratsExpirant30 === 0 ? 25 : k.contratsExpirant30 <= 2 ? 18 : 10)
                  const score  = treso + marge + creance + rh
                  const scoreColor = score >= 85 ? '#16A34A' : score >= 65 ? '#2563EB' : score >= 45 ? '#F59E0B' : '#DC2626'
                  const scoreLabel = score >= 85 ? 'Excellent' : score >= 65 ? 'Bon' : score >= 45 ? 'Moyen' : 'Fragile'
                  return (
                    <div>
                      <div className="flex items-end gap-2 mb-4">
                        <span className="text-[36px] font-black leading-none" style={{ color: scoreColor }}>{score}</span>
                        <div className="mb-1">
                          <div className="text-[13px] font-bold" style={{ color: scoreColor }}>{scoreLabel}</div>
                          <div className="text-[10px] text-[#9CA3AF]">/ 100 points</div>
                        </div>
                      </div>
                      <div className="space-y-2">
                        {[
                          { label: 'Trésorerie', val: treso, max: 25 },
                          { label: 'Marge',      val: marge, max: 25 },
                          { label: 'Créances',   val: creance, max: 25 },
                          { label: 'Contrats RH',val: rh, max: 25 },
                        ].map(r => {
                          const p = Math.round((r.val / r.max) * 100)
                          const c = p >= 80 ? '#16A34A' : p >= 60 ? '#2563EB' : p >= 40 ? '#F59E0B' : '#DC2626'
                          return (
                            <div key={r.label} className="flex items-center gap-2">
                              <span className="text-[10px] text-[#6B7280] w-20 shrink-0">{r.label}</span>
                              <div className="flex-1 h-1.5 bg-[#F3F4F6] rounded-full overflow-hidden">
                                <div className="h-full rounded-full" style={{ width: `${p}%`, background: c }} />
                              </div>
                              <span className="text-[10px] font-bold shrink-0" style={{ color: c }}>{r.val}/{r.max}</span>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                })()}
              </BiChartCard>

              {/* Sources revenus donut */}
              {data.charts.revenueBySource.length > 0 && (
                <BiChartCard title="Sources de revenus">
                  <BiDonutChart data={data.charts.revenueBySource} height={160} theme="light" />
                </BiChartCard>
              )}
            </div>
          </div>

          {/* Alertes inline */}
          {data.alerts.length > 0 && (
            <BiChartCard title="Alertes actives" sub={`${data.alerts.length} action${data.alerts.length > 1 ? 's' : ''} recommandée${data.alerts.length > 1 ? 's' : ''}`}>
              <BiAlerts alerts={data.alerts} />
            </BiChartCard>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════
          TAB : CASH FLOW
      ══════════════════════════════════════ */}
      {tab === 'cashflow' && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <BiKpiCard label="Entrées annuelles"  value={k.caAnnee}    formatted={fmtShortFCFA(k.caAnnee)}    icon={<TrendingUp size={16} />}   accent="#16A34A" />
            <BiKpiCard label="Sorties annuelles"  value={k.depAnnee}   formatted={fmtShortFCFA(k.depAnnee)}   icon={<TrendingDown size={16} />}  accent="#DC2626" />
            <BiKpiCard label="Résultat net"        value={k.resultatNet} formatted={fmtShortFCFA(k.resultatNet)} icon={<Target size={16} />}       accent={k.resultatNet >= 0 ? '#16A34A' : '#DC2626'} />
            <BiKpiCard label="Trésorerie totale"  value={k.tresoTotale} formatted={fmtShortFCFA(k.tresoTotale)} icon={<Wallet size={16} />}       accent="#2563EB" />
          </div>

          <BiChartCard
            title="Cash Flow mensuel"
            sub={`Entrées · Sorties · Résultat net · ${year}`}
          >
            {data.charts.monthlyTrend.length > 0 ? (
              <BiComposedChart
                data={data.charts.monthlyTrend}
                bars={[
                  { dataKey: 'entrees', color: '#DC2626', label: 'Entrées' },
                  { dataKey: 'sorties', color: '#E5E7EB', label: 'Sorties' },
                ]}
                lines={[
                  { dataKey: 'net', color: '#0F172A', label: 'Net mensuel' },
                ]}
                theme="light"
                height={280}
              />
            ) : <BiEmpty />}
          </BiChartCard>

          {/* Monthly recap table */}
          <BiChartCard title="Récapitulatif mensuel" sub={`Exercice ${year}`} padding={false}>
            <div className="overflow-x-auto">
              <table className="w-full text-[12px]">
                <thead>
                  <tr className="bg-[#F9FAFB] text-[10px] text-[#6B7280] uppercase tracking-wider border-b border-[#F3F4F6]">
                    <th className="text-left px-5 py-3 font-medium">{t('common.month')}</th>
                    <th className="text-right px-4 py-3 font-medium">Entrées</th>
                    <th className="text-right px-4 py-3 font-medium">Sorties</th>
                    <th className="text-right px-5 py-3 font-medium">Résultat</th>
                  </tr>
                </thead>
                <tbody>
                  {data.charts.monthlyTrend.map((m, i) => {
                    const net = (m.entrees as number) - (m.sorties as number)
                    return (
                      <tr key={i} className="border-t border-[#F3F4F6] hover:bg-[#F9FAFB] transition-colors">
                        <td className="px-5 py-3 font-medium text-[#374151]">{m.month}</td>
                        <td className="px-4 py-3 text-right text-[#16A34A] font-medium">{fmtFCFA(m.entrees as number)}</td>
                        <td className="px-4 py-3 text-right text-[#DC2626] font-medium">{fmtFCFA(m.sorties as number)}</td>
                        <td className={`px-5 py-3 text-right font-bold ${net >= 0 ? 'text-[#16A34A]' : 'text-[#DC2626]'}`}>
                          {net >= 0 ? '+' : ''}{fmtFCFA(net)}
                        </td>
                      </tr>
                    )
                  })}
                  {data.charts.monthlyTrend.length > 0 && (
                    <tr className="border-t-2 border-[#E5E7EB] bg-[#F9FAFB] font-bold">
                      <td className="px-5 py-3 text-[#0F172A]">TOTAL {year}</td>
                      <td className="px-4 py-3 text-right text-[#16A34A]">{fmtFCFA(k.caAnnee)}</td>
                      <td className="px-4 py-3 text-right text-[#DC2626]">{fmtFCFA(k.depAnnee)}</td>
                      <td className={`px-5 py-3 text-right ${k.resultatNet >= 0 ? 'text-[#16A34A]' : 'text-[#DC2626]'}`}>{fmtFCFA(k.resultatNet)}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </BiChartCard>
        </div>
      )}

      {/* ══════════════════════════════════════
          TAB : ALERTES
      ══════════════════════════════════════ */}
      {tab === 'alertes' && (
        <div className="space-y-4 max-w-2xl">
          <p className="text-[12px] text-[#6B7280]">
            {data.alerts.length === 0
              ? 'Aucune alerte — toutes les métriques sont dans les seuils normaux.'
              : `${data.alerts.length} alerte${data.alerts.length > 1 ? 's' : ''} détectée${data.alerts.length > 1 ? 's' : ''} — cliquez pour accéder au module concerné.`}
          </p>
          <BiAlerts alerts={data.alerts} />
        </div>
      )}
    </div>
  )
}

'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  TrendingUp, TrendingDown, Users, Package, GraduationCap,
  Zap, RefreshCw, Loader2, AlertTriangle, CheckCircle,
  Bell, BarChart2, ArrowUpRight, ArrowDownRight, Clock,
  FileText, Activity, Wallet,
} from 'lucide-react'
import { BiTrendChart, BiBarChart, BiDonutChart, BiCountBarChart } from '@/components/bi/BiCharts'
import { fmtFCFA } from '@/lib/admin-config'
import { useLocale } from '@/lib/hooks/useLocale'

// ── Types ─────────────────────────────────────────────────────────
interface AnalyticsData {
  year: number
  financial: {
    totalEntrees: number; totalSorties: number; soldeTresorerie: number
    totalFactures: number; totalFactPay: number; totalCreances: number
    totalScol: number; txPaiement: number
    nbFactures: number; nbFactPay: number
  }
  rh: {
    nbActifs: number; nbConges: number; nbTotal: number
    masseSal: number; contratsExpirant30: number
  }
  ecole: { nbAbsences: number; totalScol: number }
  stock: {
    articlesRupture: number; articlesCritiques: number
    valeurStock: number; nbArticles: number
    topArticles: { nom: string; valeur: number; quantite: number }[]
  }
  automation: {
    tasksDone: number; tasksPend: number; tasksError: number
    notifUnread: number; nbNotifs: number
  }
  charts: {
    monthlyTrend: Record<string, unknown>[]
    masseSalMensuelle: Record<string, unknown>[]
    absParMois: Record<string, unknown>[]
    scolParMois: Record<string, unknown>[]
    facturesByStatus: { name: string; value: number; color: string }[]
  }
}

// ── Animation ─────────────────────────────────────────────────────
function fadeUp(i: number) {
  return {
    initial: { opacity: 0, y: 16 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.38, delay: i * 0.06, ease: [0.23, 1, 0.32, 1] as const },
  }
}

// ── KPI card ──────────────────────────────────────────────────────
function KpiCard({ label, value, sub, color, icon: Icon, trend, i, alert }: {
  label: string; value: string; sub?: string; color: string
  icon: React.ElementType; trend?: number; i: number; alert?: boolean
}) {
  return (
    <motion.div {...fadeUp(i)} whileHover={{ y: -2 }}
      className="relative rounded-2xl p-4 overflow-hidden"
      style={{ background: color }}>
      <div className="absolute inset-0 pointer-events-none"
        style={{ background: 'radial-gradient(ellipse at 80% 20%, rgba(255,255,255,0.10) 0%, transparent 60%)' }} />
      {alert && (
        <div className="absolute top-3 right-3 w-2 h-2 rounded-full bg-[#DC2626] ring-2 ring-[#DC2626]/30 animate-pulse" />
      )}
      <div className="relative">
        <div className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center mb-3">
          <Icon size={15} className="text-white" />
        </div>
        <p className="text-white/60 text-[9px] font-semibold uppercase tracking-wider mb-1">{label}</p>
        <p className="text-white text-xl font-bold leading-none">{value}</p>
        {sub && <p className="text-white/50 text-[9px] mt-1">{sub}</p>}
        {trend !== undefined && (
          <div className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-white/15 mt-2">
            {trend >= 0
              ? <ArrowUpRight size={9} className="text-white" />
              : <ArrowDownRight size={9} className="text-white" />}
            <span className="text-white text-[9px] font-bold">{trend >= 0 ? '+' : ''}{trend}%</span>
          </div>
        )}
      </div>
    </motion.div>
  )
}

// ── Section card ──────────────────────────────────────────────────
function ChartCard({ title, icon: Icon, iconColor, children, className = '' }: {
  title: string; icon: React.ElementType; iconColor: string; children: React.ReactNode; className?: string
}) {
  return (
    <div className={`bg-[var(--card-bg)] border border-[var(--border)] rounded-2xl overflow-hidden ${className}`}>
      <div className="flex items-center gap-2 px-5 py-3.5 border-b border-[var(--border)]">
        <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: iconColor + '22' }}>
          <Icon size={13} style={{ color: iconColor }} />
        </div>
        <span className="text-xs font-bold text-[var(--text)] uppercase tracking-wider">{title}</span>
      </div>
      <div className="p-4">{children}</div>
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────
export default function AnalyticsPage() {
  const { t } = useLocale()
  const [data, setData]       = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab]         = useState('overview')
  const [year, setYear]       = useState(new Date().getFullYear())
  const [running, setRunning] = useState(false)
  const [runResult, setRunResult] = useState<string | null>(null)

  const YEARS = [new Date().getFullYear(), new Date().getFullYear() - 1, new Date().getFullYear() - 2]

  // Tabs définis ici pour accéder à t()
  const TABS = [
    { id: 'overview',  label: t('analytics.tab.overview'),  icon: BarChart2 },
    { id: 'financial', label: t('analytics.tab.financial'), icon: TrendingUp },
    { id: 'rh',        label: t('analytics.tab.rh'),        icon: Users },
    { id: 'ecole',     label: t('analytics.tab.ecole'),     icon: GraduationCap },
    { id: 'stock',     label: t('analytics.tab.stock'),     icon: Package },
    { id: 'auto',      label: t('analytics.tab.auto'),      icon: Zap },
  ]

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/analytics/summary?year=${year}`)
      if (res.ok) setData(await res.json())
    } finally {
      setLoading(false)
    }
  }, [year])

  useEffect(() => { load() }, [load])

  async function runAutomation() {
  const { t } = useLocale()
    setRunning(true)
    setRunResult(null)
    try {
      const res = await fetch('/api/automation/run', { method: 'POST' })
      const d = await res.json()
      if (d.ok) {
        const r = d.result
        setRunResult(`${t('analytics.verif.done')} : ${r?.contracts_alerted ?? 0} ${t('analytics.verif.contracts')}, ${r?.invoices_alerted ?? 0} ${t('analytics.verif.invoices')}.`)
        await load()
      } else {
        setRunResult(`${t('analytics.verif.error')} : ` + (d.error ?? t('analytics.verif.unknown')))
      }
    } finally {
      setRunning(false)
    }
  }

  return (
    <div className="space-y-5 pb-12">

      {/* ── Header ── */}
      <motion.div {...fadeUp(0)} className="flex items-center justify-between flex-wrap gap-3 pt-1">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg,#4A0040,#7C3AED)' }}>
            <Activity size={18} className="text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-[var(--text)]">{t('analytics.title')}</h1>
            <p className="text-xs text-[var(--text-secondary)]">{t('analytics.subtitle')} {year}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <select value={year} onChange={e => setYear(Number(e.target.value))}
            className="bg-[var(--card-bg)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[var(--text)] outline-none">
            {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <button onClick={load}
            className="p-2 rounded-lg bg-[var(--surface-alt)] border border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text)] transition-colors">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </motion.div>

      {/* ── Tabs ── */}
      <div className="flex gap-1 bg-[var(--card-bg)] border border-[var(--border)] rounded-xl p-1 overflow-x-auto">
        {TABS.map(tabItem => {
          const Icon = tabItem.icon
          return (
            <button key={tabItem.id} onClick={() => setTab(tabItem.id)}
              className={`flex-1 min-w-fit py-2 px-2.5 rounded-lg text-[10px] font-semibold transition-all flex items-center justify-center gap-1 whitespace-nowrap ${
                tab === tabItem.id ? 'bg-[#7C3AED]/15 text-[#DC2626]' : 'text-[var(--text-secondary)] hover:text-[var(--text)]'
              }`}>
              <Icon size={11} />{tabItem.label}
            </button>
          )
        })}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-24 text-[var(--text-secondary)]">
          <Loader2 size={20} className="animate-spin mr-2" /> {t('analytics.loading')}
        </div>
      ) : data ? (
        <AnimatePresence mode="wait">
          <motion.div key={tab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>

            {/* ══════════════════════════════════════════════════════════
                TAB : Vue d'ensemble
            ══════════════════════════════════════════════════════════ */}
            {tab === 'overview' && (
              <div className="space-y-5">
                {/* KPI row */}
                <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
                  <KpiCard i={1} label={t('analytics.kpi.treso')} icon={Wallet}
                    value={fmtFCFA(data.financial.soldeTresorerie)}
                    sub={`+${fmtFCFA(data.financial.totalEntrees)} / -${fmtFCFA(data.financial.totalSorties)}`}
                    color={data.financial.soldeTresorerie >= 0
                      ? 'linear-gradient(135deg,#071535,#0F172A)'
                      : 'linear-gradient(135deg,#7A0000,#A00018)'}
                    trend={data.financial.txPaiement} />
                  <KpiCard i={2} label={t('analytics.kpi.headcount')} icon={Users}
                    value={String(data.rh.nbActifs)}
                    sub={`${data.rh.nbConges} ${t('analytics.kpi.onLeave')}`}
                    color="linear-gradient(135deg,#4A0040,#7C3AED)"
                    alert={data.rh.contratsExpirant30 > 0} />
                  <KpiCard i={3} label={t('analytics.kpi.stock')} icon={Package}
                    value={fmtFCFA(data.stock.valeurStock)}
                    sub={`${data.stock.articlesRupture} ${t('analytics.lbl.rupture')} · ${data.stock.articlesCritiques} ${t('analytics.lbl.critique').toLowerCase()}(s)`}
                    color="linear-gradient(135deg,#7A3800,#C06000)"
                    alert={data.stock.articlesRupture > 0} />
                  <KpiCard i={4} label={t('analytics.kpi.absences')} icon={GraduationCap}
                    value={String(data.ecole.nbAbsences)}
                    sub={`${t('nav.ecole')} : ${fmtFCFA(data.ecole.totalScol)}`}
                    color="linear-gradient(135deg,#4A0040,#7C3AED)" />
                </div>

                {/* Main trend */}
                <ChartCard title={t('analytics.chart.cashflow')} icon={TrendingUp} iconColor="#0F172A">
                  <BiTrendChart
                    data={data.charts.monthlyTrend}
                    series={[
                      { dataKey: 'entrees',     color: '#0F172A', label: t('analytics.kpi.encaissements') },
                      { dataKey: 'sorties',     color: '#DC2626', label: t('analytics.kpi.decaissements') },
                    ]}
                    height={230}
                  />
                </ChartCard>

                {/* 3-col summary */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                  {/* Factures donut */}
                  <ChartCard title={t('analytics.chart.invoiceStatus')} icon={FileText} iconColor="#DC2626">
                    {data.charts.facturesByStatus.length > 0 ? (
                      <>
                        <BiDonutChart data={data.charts.facturesByStatus} height={160} />
                        <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2 justify-center">
                          {data.charts.facturesByStatus.map(s => (
                            <div key={s.name} className="flex items-center gap-1">
                              <div className="w-2 h-2 rounded-full" style={{ background: s.color }} />
                              <span className="text-[9px] text-[#6B7280]">{s.name} ({s.value})</span>
                            </div>
                          ))}
                        </div>
                      </>
                    ) : (
                      <p className="text-xs text-[var(--text-secondary)] text-center py-8">{t('analytics.alert.noInvoice')}</p>
                    )}
                  </ChartCard>

                  {/* Automation status */}
                  <ChartCard title={t('analytics.chart.automation')} icon={Zap} iconColor="#DC2626">
                    <div className="space-y-3">
                      {[
                        { label: t('analytics.kpi.tasksDone'),     val: data.automation.tasksDone,  color: '#0F172A' },
                        { label: t('analytics.lbl.enAttente'),     val: data.automation.tasksPend,  color: '#DC2626' },
                        { label: t('analytics.lbl.erreurs'),       val: data.automation.tasksError, color: '#DC2626' },
                        { label: t('analytics.kpi.notifications'), val: data.automation.nbNotifs,   color: '#DC2626' },
                        { label: t('analytics.sub.nonLues'),       val: data.automation.notifUnread,color: '#7C3AED' },
                      ].map(r => (
                        <div key={r.label} className="flex items-center justify-between">
                          <span className="text-xs text-[#6B7280]">{r.label}</span>
                          <span className="text-sm font-bold" style={{ color: r.color }}>{r.val}</span>
                        </div>
                      ))}
                    </div>
                    <button onClick={runAutomation} disabled={running}
                      className="mt-4 w-full flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-semibold bg-[#7C3AED]/15 text-[#DC2626] hover:bg-[#7C3AED]/25 transition-colors disabled:opacity-50">
                      {running ? <Loader2 size={12} className="animate-spin" /> : <Zap size={12} />}
                      {running ? t('analytics.auto.runningShort') : t('analytics.auto.runShort')}
                    </button>
                    {runResult && (
                      <p className="mt-2 text-[10px] text-[#DC2626] bg-[var(--surface)]/10 rounded-lg px-3 py-2">{runResult}</p>
                    )}
                  </ChartCard>

                  {/* Alerts */}
                  <ChartCard title={t('analytics.chart.activeAlerts')} icon={AlertTriangle} iconColor="#DC2626">
                    <div className="space-y-2">
                      {data.rh.contratsExpirant30 > 0 && (
                        <div className="flex items-start gap-2 bg-[#DC2626]/10 rounded-xl p-2.5">
                          <Clock size={12} className="text-[#DC2626] mt-0.5 shrink-0" />
                          <p className="text-[10px] text-[var(--text)]">
                            <b>{data.rh.contratsExpirant30}</b> {t('analytics.alert.contratsExp')}
                          </p>
                        </div>
                      )}
                      {data.stock.articlesRupture > 0 && (
                        <div className="flex items-start gap-2 bg-[#DC2626]/10 rounded-xl p-2.5">
                          <AlertTriangle size={12} className="text-[#DC2626] mt-0.5 shrink-0" />
                          <p className="text-[10px] text-[var(--text)]">
                            <b>{data.stock.articlesRupture}</b> {t('analytics.alert.rupture')}
                          </p>
                        </div>
                      )}
                      {data.stock.articlesCritiques > 0 && (
                        <div className="flex items-start gap-2 bg-[#DC2626]/10 rounded-xl p-2.5">
                          <AlertTriangle size={12} className="text-[#DC2626] mt-0.5 shrink-0" />
                          <p className="text-[10px] text-[var(--text)]">
                            <b>{data.stock.articlesCritiques}</b> {t('analytics.alert.critique')}
                          </p>
                        </div>
                      )}
                      {data.financial.totalCreances > 0 && (
                        <div className="flex items-start gap-2 bg-[#7C3AED]/10 rounded-xl p-2.5">
                          <FileText size={12} className="text-[#7C3AED] mt-0.5 shrink-0" />
                          <p className="text-[10px] text-[var(--text)]">
                            {t('analytics.alert.creances')} : <b>{fmtFCFA(data.financial.totalCreances)}</b>
                          </p>
                        </div>
                      )}
                      {data.automation.notifUnread > 0 && (
                        <div className="flex items-start gap-2 bg-[#DC2626]/10 rounded-xl p-2.5">
                          <Bell size={12} className="text-[#DC2626] mt-0.5 shrink-0" />
                          <p className="text-[10px] text-[var(--text)]">
                            <b>{data.automation.notifUnread}</b> {t('analytics.alert.notifsUnread')}
                          </p>
                        </div>
                      )}
                      {!data.rh.contratsExpirant30 && !data.stock.articlesRupture && !data.stock.articlesCritiques && !data.financial.totalCreances && !data.automation.notifUnread && (
                        <div className="flex flex-col items-center py-6 gap-2">
                          <CheckCircle size={20} className="text-[#DC2626]" />
                          <p className="text-xs text-[var(--text-secondary)]">{t('analytics.alert.none')}</p>
                        </div>
                      )}
                    </div>
                  </ChartCard>
                </div>
              </div>
            )}

            {/* ══════════════════════════════════════════════════════════
                TAB : Finance
            ══════════════════════════════════════════════════════════ */}
            {tab === 'financial' && (
              <div className="space-y-5">
                <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
                  {[
                    { label: t('analytics.kpi.encaissements'), val: data.financial.totalEntrees,    color: '#071535', icon: TrendingUp  },
                    { label: t('analytics.kpi.decaissements'), val: data.financial.totalSorties,    color: '#7A0000', icon: TrendingDown },
                    { label: t('analytics.kpi.tresoNet'),      val: data.financial.soldeTresorerie, color: '#4A0040', icon: Wallet       },
                    { label: t('analytics.kpi.creances'),      val: data.financial.totalCreances,   color: '#4A0040', icon: FileText     },
                  ].map((k, i) => (
                    <KpiCard key={k.label} i={i + 1} label={k.label} value={fmtFCFA(k.val)}
                      icon={k.icon}
                      color={`linear-gradient(135deg,${k.color},${k.color}88)`} />
                  ))}
                </div>

                <ChartCard title={t('analytics.chart.financialEvol')} icon={TrendingUp} iconColor="#DC2626">
                  <BiTrendChart
                    data={data.charts.monthlyTrend}
                    series={[
                      { dataKey: 'entrees',     color: '#0F172A', label: t('analytics.kpi.encaissements') },
                      { dataKey: 'sorties',     color: '#DC2626', label: t('analytics.kpi.decaissements') },
                      { dataKey: 'facturation', color: '#DC2626', label: t('analytics.lbl.facturesRetard') },
                    ]}
                    height={250}
                  />
                </ChartCard>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <ChartCard title={t('analytics.chart.invoiceStatus2')} icon={FileText} iconColor="#DC2626">
                    {data.charts.facturesByStatus.length > 0 ? (
                      <>
                        <BiDonutChart data={data.charts.facturesByStatus} height={180} />
                        <div className="mt-3 space-y-2">
                          {data.charts.facturesByStatus.map(s => (
                            <div key={s.name} className="flex items-center justify-between px-1">
                              <div className="flex items-center gap-2">
                                <div className="w-2.5 h-2.5 rounded-full" style={{ background: s.color }} />
                                <span className="text-xs text-[var(--text-secondary)]">{s.name}</span>
                              </div>
                              <span className="text-xs font-bold text-[var(--text)]">{s.value}</span>
                            </div>
                          ))}
                        </div>
                      </>
                    ) : <p className="text-xs text-[var(--text-secondary)] text-center py-8">{t('analytics.alert.noInvoice')}</p>}
                  </ChartCard>

                  <ChartCard title={t('analytics.chart.kpi')} icon={Activity} iconColor="#7C3AED">
                    <div className="space-y-4 pt-2">
                      {[
                        { label: t('analytics.lbl.txPaiement'),   val: `${data.financial.txPaiement}%`, color: data.financial.txPaiement >= 80 ? '#0F172A' : '#DC2626', pct: data.financial.txPaiement },
                        { label: t('analytics.lbl.facturesPay'),  val: `${data.financial.nbFactPay}/${data.financial.nbFactures}`, color: '#DC2626', pct: data.financial.nbFactures > 0 ? (data.financial.nbFactPay / data.financial.nbFactures) * 100 : 0 },
                        { label: t('analytics.lbl.recettesScol'), val: fmtFCFA(data.financial.totalScol), color: '#7C3AED', pct: data.financial.totalEntrees > 0 ? (data.financial.totalScol / data.financial.totalEntrees) * 100 : 0 },
                      ].map(r => (
                        <div key={r.label}>
                          <div className="flex justify-between mb-1.5">
                            <span className="text-xs text-[#6B7280]">{r.label}</span>
                            <span className="text-xs font-bold" style={{ color: r.color }}>{r.val}</span>
                          </div>
                          <div className="h-1.5 bg-[var(--surface-alt)] rounded-full overflow-hidden">
                            <motion.div className="h-full rounded-full" style={{ background: r.color }}
                              initial={{ width: 0 }} animate={{ width: `${Math.min(r.pct, 100)}%` }}
                              transition={{ duration: 0.8 }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </ChartCard>
                </div>
              </div>
            )}

            {/* ══════════════════════════════════════════════════════════
                TAB : RH & Paie
            ══════════════════════════════════════════════════════════ */}
            {tab === 'rh' && (
              <div className="space-y-5">
                <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
                  <KpiCard i={1} label={t('analytics.kpi.employesActifs')} icon={Users}
                    value={String(data.rh.nbActifs)} sub={`/${data.rh.nbTotal} ${t('analytics.sub.total')}`}
                    color="linear-gradient(135deg,#071535,#0F172A)" />
                  <KpiCard i={2} label={t('analytics.kpi.onLeave')} icon={Clock}
                    value={String(data.rh.nbConges)} sub={t('analytics.lbl.collaborateurs')}
                    color="linear-gradient(135deg,#4A0040,#7C3AED)" />
                  <KpiCard i={3} label={t('analytics.kpi.masseSal')} icon={Wallet}
                    value={fmtFCFA(data.rh.masseSal)} sub={t('analytics.sub.exercice')}
                    color="linear-gradient(135deg,#4A0040,#7C3AED)" />
                  <KpiCard i={4} label={t('analytics.kpi.contratsExp')} icon={AlertTriangle}
                    value={String(data.rh.contratsExpirant30)} sub={t('analytics.sub.dans30j')}
                    color="linear-gradient(135deg,#7A3800,#C06000)"
                    alert={data.rh.contratsExpirant30 > 0} />
                </div>

                <ChartCard title={t('analytics.chart.rhEvol')} icon={Users} iconColor="#7C3AED">
                  <BiBarChart
                    data={data.charts.masseSalMensuelle}
                    series={[{ dataKey: 'masse', color: '#7C3AED', label: t('analytics.kpi.masseSal') }]}
                    height={230}
                  />
                </ChartCard>

                <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-2xl overflow-hidden">
                  <div className="flex items-center gap-2 px-5 py-3.5 border-b border-[var(--border)]">
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-[#7C3AED]/20">
                      <Users size={13} className="text-[#DC2626]" />
                    </div>
                    <span className="text-xs font-bold text-[var(--text)] uppercase tracking-wider">{t('analytics.chart.rhRep')}</span>
                  </div>
                  <div className="p-5 grid grid-cols-3 gap-4">
                    {[
                      { label: t('analytics.lbl.actifs'),   val: data.rh.nbActifs,  color: '#0F172A', pct: data.rh.nbTotal > 0 ? (data.rh.nbActifs / data.rh.nbTotal) * 100 : 0 },
                      { label: t('analytics.lbl.enConge'),  val: data.rh.nbConges,   color: '#DC2626', pct: data.rh.nbTotal > 0 ? (data.rh.nbConges / data.rh.nbTotal) * 100 : 0 },
                      { label: t('analytics.lbl.autres'),   val: data.rh.nbTotal - data.rh.nbActifs - data.rh.nbConges, color: '#6B7280', pct: data.rh.nbTotal > 0 ? ((data.rh.nbTotal - data.rh.nbActifs - data.rh.nbConges) / data.rh.nbTotal) * 100 : 0 },
                    ].map(r => (
                      <div key={r.label} className="text-center">
                        <p className="text-2xl font-bold mb-1" style={{ color: r.color }}>{r.val}</p>
                        <p className="text-[10px] text-[var(--text-secondary)] mb-2">{r.label}</p>
                        <div className="h-1 bg-[var(--surface-alt)] rounded-full overflow-hidden">
                          <motion.div className="h-full rounded-full" style={{ background: r.color }}
                            initial={{ width: 0 }} animate={{ width: `${Math.min(r.pct, 100)}%` }}
                            transition={{ duration: 0.8 }} />
                        </div>
                        <p className="text-[9px] text-[var(--text-secondary)] mt-1">{Math.round(r.pct)}%</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ══════════════════════════════════════════════════════════
                TAB : École
            ══════════════════════════════════════════════════════════ */}
            {tab === 'ecole' && (
              <div className="space-y-5">
                <div className="grid grid-cols-2 xl:grid-cols-3 gap-3">
                  <KpiCard i={1} label={t('analytics.kpi.absRegistered')} icon={GraduationCap}
                    value={String(data.ecole.nbAbsences)} sub={`${t('analytics.sub.exercice')} ${year}`}
                    color="linear-gradient(135deg,#4A0040,#7C3AED)" />
                  <KpiCard i={2} label={t('analytics.kpi.recettesScol')} icon={Wallet}
                    value={fmtFCFA(data.ecole.totalScol)} sub={t('analytics.sub.paiementsRecus')}
                    color="linear-gradient(135deg,#071535,#0F172A)" />
                  <KpiCard i={3} label={t('analytics.kpi.autoNotifs')} icon={Bell}
                    value={String(data.automation.nbNotifs)} sub={`${data.automation.notifUnread} ${t('analytics.sub.nonLues')}`}
                    color="linear-gradient(135deg,#4A0040,#7C3AED)" />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <ChartCard title={t('analytics.chart.absMonth')} icon={AlertTriangle} iconColor="#DC2626">
                    <BiCountBarChart
                      data={data.charts.absParMois}
                      dataKey="absences"
                      color="#DC2626"
                      height={200}
                    />
                  </ChartCard>

                  <ChartCard title={t('analytics.chart.scolMonth')} icon={Wallet} iconColor="#0F172A">
                    <BiBarChart
                      data={data.charts.scolParMois}
                      series={[{ dataKey: 'montant', color: '#0F172A', label: t('analytics.kpi.recettesScol') }]}
                      height={200}
                    />
                  </ChartCard>
                </div>
              </div>
            )}

            {/* ══════════════════════════════════════════════════════════
                TAB : Stock
            ══════════════════════════════════════════════════════════ */}
            {tab === 'stock' && (
              <div className="space-y-5">
                <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
                  <KpiCard i={1} label={t('analytics.kpi.valeurStock')} icon={Package}
                    value={fmtFCFA(data.stock.valeurStock)} sub={`${data.stock.nbArticles} ${t('analytics.sub.nbArticles')}`}
                    color="linear-gradient(135deg,#7A3800,#C06000)" />
                  <KpiCard i={2} label={t('analytics.kpi.ruptures')} icon={AlertTriangle}
                    value={String(data.stock.articlesRupture)} sub={t('analytics.sub.artEpuises')}
                    color="linear-gradient(135deg,#7A0000,#A00018)"
                    alert={data.stock.articlesRupture > 0} />
                  <KpiCard i={3} label={t('analytics.kpi.stockCritique')} icon={AlertTriangle}
                    value={String(data.stock.articlesCritiques)} sub={t('analytics.sub.sousSeuil')}
                    color="linear-gradient(135deg,#431407,#EA580C)"
                    alert={data.stock.articlesCritiques > 0} />
                  <KpiCard i={4} label={t('analytics.kpi.articlesOk')} icon={CheckCircle}
                    value={String(Math.max(0, data.stock.nbArticles - data.stock.articlesRupture - data.stock.articlesCritiques))}
                    sub={t('analytics.sub.stockSuffisant')}
                    color="linear-gradient(135deg,#071535,#0F172A)" />
                </div>

                {/* Top articles */}
                <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-2xl overflow-hidden">
                  <div className="flex items-center gap-2 px-5 py-3.5 border-b border-[var(--border)]">
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-[#C06000]/20">
                      <Package size={13} className="text-[#C06000]" />
                    </div>
                    <span className="text-xs font-bold text-[var(--text)] uppercase tracking-wider">{t('analytics.chart.topArticles')}</span>
                  </div>
                  <div className="divide-y divide-[var(--border)]">
                    {data.stock.topArticles.length > 0 ? data.stock.topArticles.map((a, i) => {
                      const pct = data.stock.valeurStock > 0 ? (a.valeur / data.stock.valeurStock) * 100 : 0
                      return (
                        <div key={i} className="px-5 py-3.5">
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-sm text-[var(--text)] font-medium truncate pr-4">{a.nom}</span>
                            <span className="text-xs font-bold text-[#DC2626] shrink-0">{fmtFCFA(a.valeur)}</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="flex-1 h-1 bg-[var(--surface-alt)] rounded-full overflow-hidden">
                              <motion.div className="h-full rounded-full bg-[#DC2626]"
                                initial={{ width: 0 }} animate={{ width: `${Math.min(pct, 100)}%` }}
                                transition={{ duration: 0.7, delay: i * 0.1 }} />
                            </div>
                            <span className="text-[10px] text-[var(--text-secondary)] shrink-0">{a.quantite} {t('analytics.sub.unites')}</span>
                          </div>
                        </div>
                      )
                    }) : (
                      <p className="text-xs text-[var(--text-secondary)] text-center py-8">{t('analytics.alert.noArticle')}</p>
                    )}
                  </div>
                </div>

                {/* Stock health donut */}
                <ChartCard title={t('analytics.chart.stockHealth')} icon={Activity} iconColor="#0F172A">
                  {data.stock.nbArticles > 0 ? (
                    <div className="flex items-center gap-6">
                      <div className="flex-1">
                        <BiDonutChart
                          data={[
                            { name: t('analytics.lbl.enStock'),  value: Math.max(0, data.stock.nbArticles - data.stock.articlesRupture - data.stock.articlesCritiques), color: '#0F172A' },
                            { name: t('analytics.lbl.critique'), value: data.stock.articlesCritiques, color: '#DC2626' },
                            { name: t('analytics.lbl.rupture'),  value: data.stock.articlesRupture,   color: '#DC2626' },
                          ].filter(d => d.value > 0)}
                          height={180}
                        />
                      </div>
                      <div className="space-y-3">
                        {[
                          { label: t('analytics.lbl.enStock'),  color: '#0F172A', val: Math.max(0, data.stock.nbArticles - data.stock.articlesRupture - data.stock.articlesCritiques) },
                          { label: t('analytics.lbl.critique'), color: '#DC2626', val: data.stock.articlesCritiques },
                          { label: t('analytics.lbl.rupture'),  color: '#DC2626', val: data.stock.articlesRupture },
                        ].map(r => (
                          <div key={r.label} className="flex items-center gap-2">
                            <div className="w-2.5 h-2.5 rounded-full" style={{ background: r.color }} />
                            <span className="text-xs text-[var(--text-secondary)]">{r.label}</span>
                            <span className="text-xs font-bold ml-auto" style={{ color: r.color }}>{r.val}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-[var(--text-secondary)] text-center py-6">{t('analytics.alert.noArticle2')}</p>
                  )}
                </ChartCard>
              </div>
            )}

            {/* ══════════════════════════════════════════════════════════
                TAB : Automatisation
            ══════════════════════════════════════════════════════════ */}
            {tab === 'auto' && (
              <div className="space-y-5">
                <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
                  <KpiCard i={1} label={t('analytics.kpi.tasksDone')} icon={CheckCircle}
                    value={String(data.automation.tasksDone)} sub={`${year}`}
                    color="linear-gradient(135deg,#071535,#0F172A)" />
                  <KpiCard i={2} label={t('analytics.kpi.enAttente')} icon={Clock}
                    value={String(data.automation.tasksPend)} sub={t('analytics.sub.aTraiter')}
                    color="linear-gradient(135deg,#7A3800,#C06000)"
                    alert={data.automation.tasksPend > 0} />
                  <KpiCard i={3} label={t('analytics.kpi.erreurs')} icon={AlertTriangle}
                    value={String(data.automation.tasksError)} sub={t('analytics.sub.tasksFailed')}
                    color="linear-gradient(135deg,#7A0000,#A00018)"
                    alert={data.automation.tasksError > 0} />
                  <KpiCard i={4} label={t('analytics.kpi.notifications')} icon={Bell}
                    value={String(data.automation.nbNotifs)} sub={`${data.automation.notifUnread} ${t('analytics.sub.nonLues')}`}
                    color="linear-gradient(135deg,#4A0040,#7C3AED)" />
                </div>

                {/* Run checks panel */}
                <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-2xl p-5">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-[#7C3AED]/20">
                        <Zap size={16} className="text-[#DC2626]" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-[var(--text)]">{t('analytics.auto.engine')}</p>
                        <p className="text-xs text-[var(--text-secondary)]">{t('analytics.auto.engineSub')}</p>
                      </div>
                    </div>
                    <button onClick={runAutomation} disabled={running}
                      className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all disabled:opacity-50"
                      style={{ background: 'linear-gradient(135deg,#7C3AED,#7C3AED)', color: '#fff' }}>
                      {running ? <Loader2 size={13} className="animate-spin" /> : <Zap size={13} />}
                      {running ? t('analytics.auto.running') : t('analytics.auto.run')}
                    </button>
                  </div>
                  {runResult && (
                    <div className="bg-[var(--surface)]/10 border border-[#0F172A]/20 rounded-xl px-4 py-3">
                      <p className="text-xs text-[#DC2626]">{runResult}</p>
                    </div>
                  )}
                  <div className="mt-4 grid grid-cols-3 gap-3">
                    {[
                      { label: t('analytics.lbl.contratsExp'),    val: data.rh.contratsExpirant30, color: '#DC2626', desc: t('analytics.sub.dans30j') },
                      { label: t('analytics.lbl.facturesRetard'), val: data.financial.nbFactures - data.financial.nbFactPay, color: '#DC2626', desc: t('analytics.lbl.nonPayees') },
                      { label: t('analytics.lbl.stockCritique'),  val: data.stock.articlesRupture + data.stock.articlesCritiques, color: '#DC2626', desc: t('analytics.lbl.areapprouv') },
                    ].map(r => (
                      <div key={r.label} className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-3 text-center">
                        <p className="text-2xl font-bold mb-1" style={{ color: r.color }}>{r.val}</p>
                        <p className="text-[10px] font-semibold text-[var(--text)]">{r.label}</p>
                        <p className="text-[9px] text-[var(--text-secondary)] mt-0.5">{r.desc}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Automation types donut */}
                <ChartCard title={t('analytics.chart.automTasks')} icon={Activity} iconColor="#7C3AED">
                  {(data.automation.tasksDone + data.automation.tasksPend + data.automation.tasksError) > 0 ? (
                    <BiDonutChart
                      data={[
                        { name: t('analytics.lbl.terminees'),  value: data.automation.tasksDone,  color: '#0F172A' },
                        { name: t('analytics.lbl.enAttente'),  value: data.automation.tasksPend, color: '#DC2626' },
                        { name: t('analytics.lbl.erreurs'),    value: data.automation.tasksError,color: '#DC2626' },
                      ].filter(d => d.value > 0)}
                      height={200}
                    />
                  ) : (
                    <p className="text-xs text-[var(--text-secondary)] text-center py-8">{t('analytics.alert.noTask')}</p>
                  )}
                </ChartCard>
              </div>
            )}

          </motion.div>
        </AnimatePresence>
      ) : null}
    </div>
  )
}

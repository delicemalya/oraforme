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
        <div className="absolute top-3 right-3 w-2 h-2 rounded-full bg-[#F51E33] ring-2 ring-[#F51E33]/30 animate-pulse" />
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
    <div className={`bg-[#0f1e3d] border border-[#1a2d50] rounded-2xl overflow-hidden ${className}`}>
      <div className="flex items-center gap-2 px-5 py-3.5 border-b border-[#1a2d50]">
        <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: iconColor + '22' }}>
          <Icon size={13} style={{ color: iconColor }} />
        </div>
        <span className="text-xs font-bold text-[#FFFFFF] uppercase tracking-wider">{title}</span>
      </div>
      <div className="p-4">{children}</div>
    </div>
  )
}

// ── Tabs ──────────────────────────────────────────────────────────
const TABS = [
  { id: 'overview',  label: 'Vue d\'ensemble', icon: BarChart2 },
  { id: 'financial', label: 'Finance',          icon: TrendingUp },
  { id: 'rh',        label: 'RH & Paie',        icon: Users },
  { id: 'ecole',     label: 'École',            icon: GraduationCap },
  { id: 'stock',     label: 'Stock',            icon: Package },
  { id: 'auto',      label: 'Automatisation',   icon: Zap },
]

// ── Main ──────────────────────────────────────────────────────────
export default function AnalyticsPage() {
  const [data, setData]       = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab]         = useState('overview')
  const [year, setYear]       = useState(new Date().getFullYear())
  const [running, setRunning] = useState(false)
  const [runResult, setRunResult] = useState<string | null>(null)

  const YEARS = [new Date().getFullYear(), new Date().getFullYear() - 1, new Date().getFullYear() - 2]

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
    setRunning(true)
    setRunResult(null)
    try {
      const res = await fetch('/api/automation/run', { method: 'POST' })
      const d = await res.json()
      if (d.ok) {
        const r = d.result
        setRunResult(`Vérifications terminées : ${r?.contracts_alerted ?? 0} contrat(s) alerté(s), ${r?.invoices_alerted ?? 0} facture(s) en retard traitée(s).`)
        await load()
      } else {
        setRunResult('Erreur : ' + (d.error ?? 'inconnue'))
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
            style={{ background: 'linear-gradient(135deg,#4A0040,#8B0070)' }}>
            <Activity size={18} className="text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-[#FFFFFF]">Analytics & BI</h1>
            <p className="text-xs text-[#484F58]">Intelligence économique · Exercice {year}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <select value={year} onChange={e => setYear(Number(e.target.value))}
            className="bg-[#0f1e3d] border border-[#30363D] rounded-lg px-3 py-2 text-sm text-[#FFFFFF] outline-none">
            {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <button onClick={load}
            className="p-2 rounded-lg bg-[#1a2d50] border border-[#30363D] text-[#8B949E] hover:text-[#FFFFFF] transition-colors">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </motion.div>

      {/* ── Tabs ── */}
      <div className="flex gap-1 bg-[#0f1e3d] border border-[#30363D] rounded-xl p-1 overflow-x-auto">
        {TABS.map(t => {
          const Icon = t.icon
          return (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex-1 min-w-fit py-2 px-2.5 rounded-lg text-[10px] font-semibold transition-all flex items-center justify-center gap-1 whitespace-nowrap ${
                tab === t.id ? 'bg-[#8B0070]/15 text-[#F08900]' : 'text-[#8B949E] hover:text-[#FFFFFF]'
              }`}>
              <Icon size={11} />{t.label}
            </button>
          )
        })}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-24 text-[#8B949E]">
          <Loader2 size={20} className="animate-spin mr-2" /> Chargement des analytics…
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
                  <KpiCard i={1} label="Trésorerie nette" icon={Wallet}
                    value={fmtFCFA(data.financial.soldeTresorerie)}
                    sub={`+${fmtFCFA(data.financial.totalEntrees)} / -${fmtFCFA(data.financial.totalSorties)}`}
                    color={data.financial.soldeTresorerie >= 0
                      ? 'linear-gradient(135deg,#071535,#142850)'
                      : 'linear-gradient(135deg,#7A0000,#A00018)'}
                    trend={data.financial.txPaiement} />
                  <KpiCard i={2} label="Effectif actif" icon={Users}
                    value={String(data.rh.nbActifs)}
                    sub={`${data.rh.nbConges} en congé`}
                    color="linear-gradient(135deg,#4A0040,#8B0070)"
                    alert={data.rh.contratsExpirant30 > 0} />
                  <KpiCard i={3} label="Stock" icon={Package}
                    value={fmtFCFA(data.stock.valeurStock)}
                    sub={`${data.stock.articlesRupture} rupture · ${data.stock.articlesCritiques} critique(s)`}
                    color="linear-gradient(135deg,#7A3800,#C06000)"
                    alert={data.stock.articlesRupture > 0} />
                  <KpiCard i={4} label="Absences" icon={GraduationCap}
                    value={String(data.ecole.nbAbsences)}
                    sub={`Scolarité : ${fmtFCFA(data.ecole.totalScol)}`}
                    color="linear-gradient(135deg,#4A0040,#8B0070)" />
                </div>

                {/* Main trend */}
                <ChartCard title="Flux de trésorerie mensuel" icon={TrendingUp} iconColor="#142850">
                  <BiTrendChart
                    data={data.charts.monthlyTrend}
                    series={[
                      { dataKey: 'entrees',     color: '#142850', label: 'Encaissements' },
                      { dataKey: 'sorties',     color: '#F51E33', label: 'Décaissements' },
                    ]}
                    height={230}
                  />
                </ChartCard>

                {/* 3-col summary */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                  {/* Factures donut */}
                  <ChartCard title="Statut factures" icon={FileText} iconColor="#F08900">
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
                      <p className="text-xs text-[#484F58] text-center py-8">Aucune facture</p>
                    )}
                  </ChartCard>

                  {/* Automation status */}
                  <ChartCard title="Automatisation" icon={Zap} iconColor="#F08900">
                    <div className="space-y-3">
                      {[
                        { label: 'Tâches terminées',  val: data.automation.tasksDone,  color: '#142850' },
                        { label: 'En attente',         val: data.automation.tasksPend,  color: '#F08900' },
                        { label: 'En erreur',          val: data.automation.tasksError, color: '#F51E33' },
                        { label: 'Notifications',      val: data.automation.nbNotifs,   color: '#F08900' },
                        { label: 'Non lues',           val: data.automation.notifUnread,color: '#8B0070' },
                      ].map(r => (
                        <div key={r.label} className="flex items-center justify-between">
                          <span className="text-xs text-[#6B7280]">{r.label}</span>
                          <span className="text-sm font-bold" style={{ color: r.color }}>{r.val}</span>
                        </div>
                      ))}
                    </div>
                    <button onClick={runAutomation} disabled={running}
                      className="mt-4 w-full flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-semibold bg-[#8B0070]/15 text-[#F08900] hover:bg-[#8B0070]/25 transition-colors disabled:opacity-50">
                      {running ? <Loader2 size={12} className="animate-spin" /> : <Zap size={12} />}
                      {running ? 'Vérification…' : 'Lancer les vérifications'}
                    </button>
                    {runResult && (
                      <p className="mt-2 text-[10px] text-[#142850] bg-[#142850]/10 rounded-lg px-3 py-2">{runResult}</p>
                    )}
                  </ChartCard>

                  {/* Alerts */}
                  <ChartCard title="Alertes actives" icon={AlertTriangle} iconColor="#F51E33">
                    <div className="space-y-2">
                      {data.rh.contratsExpirant30 > 0 && (
                        <div className="flex items-start gap-2 bg-[#F08900]/10 rounded-xl p-2.5">
                          <Clock size={12} className="text-[#F08900] mt-0.5 shrink-0" />
                          <p className="text-[10px] text-[#FFFFFF]">
                            <b>{data.rh.contratsExpirant30}</b> contrat(s) expirant dans 30 jours
                          </p>
                        </div>
                      )}
                      {data.stock.articlesRupture > 0 && (
                        <div className="flex items-start gap-2 bg-[#F51E33]/10 rounded-xl p-2.5">
                          <AlertTriangle size={12} className="text-[#F51E33] mt-0.5 shrink-0" />
                          <p className="text-[10px] text-[#FFFFFF]">
                            <b>{data.stock.articlesRupture}</b> article(s) en rupture de stock
                          </p>
                        </div>
                      )}
                      {data.stock.articlesCritiques > 0 && (
                        <div className="flex items-start gap-2 bg-[#F08900]/10 rounded-xl p-2.5">
                          <AlertTriangle size={12} className="text-[#F08900] mt-0.5 shrink-0" />
                          <p className="text-[10px] text-[#FFFFFF]">
                            <b>{data.stock.articlesCritiques}</b> article(s) en stock critique
                          </p>
                        </div>
                      )}
                      {data.financial.totalCreances > 0 && (
                        <div className="flex items-start gap-2 bg-[#8B0070]/10 rounded-xl p-2.5">
                          <FileText size={12} className="text-[#8B0070] mt-0.5 shrink-0" />
                          <p className="text-[10px] text-[#FFFFFF]">
                            Créances clients : <b>{fmtFCFA(data.financial.totalCreances)}</b>
                          </p>
                        </div>
                      )}
                      {data.automation.notifUnread > 0 && (
                        <div className="flex items-start gap-2 bg-[#F08900]/10 rounded-xl p-2.5">
                          <Bell size={12} className="text-[#F08900] mt-0.5 shrink-0" />
                          <p className="text-[10px] text-[#FFFFFF]">
                            <b>{data.automation.notifUnread}</b> notification(s) non lue(s)
                          </p>
                        </div>
                      )}
                      {!data.rh.contratsExpirant30 && !data.stock.articlesRupture && !data.stock.articlesCritiques && !data.financial.totalCreances && !data.automation.notifUnread && (
                        <div className="flex flex-col items-center py-6 gap-2">
                          <CheckCircle size={20} className="text-[#142850]" />
                          <p className="text-xs text-[#484F58]">Aucune alerte active</p>
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
                    { label: 'Encaissements',  val: data.financial.totalEntrees,    color: '#071535', icon: TrendingUp  },
                    { label: 'Décaissements',  val: data.financial.totalSorties,    color: '#7A0000', icon: TrendingDown },
                    { label: 'Trésorerie net', val: data.financial.soldeTresorerie, color: '#4A0040', icon: Wallet       },
                    { label: 'Créances',       val: data.financial.totalCreances,   color: '#4A0040', icon: FileText     },
                  ].map((k, i) => (
                    <KpiCard key={k.label} i={i + 1} label={k.label} value={fmtFCFA(k.val)}
                      icon={k.icon}
                      color={`linear-gradient(135deg,${k.color},${k.color}88)`} />
                  ))}
                </div>

                <ChartCard title="Évolution mensuelle — Facturation vs Trésorerie" icon={TrendingUp} iconColor="#F08900">
                  <BiTrendChart
                    data={data.charts.monthlyTrend}
                    series={[
                      { dataKey: 'entrees',     color: '#142850', label: 'Encaissements' },
                      { dataKey: 'sorties',     color: '#F51E33', label: 'Décaissements' },
                      { dataKey: 'facturation', color: '#F08900', label: 'Facturation HT' },
                    ]}
                    height={250}
                  />
                </ChartCard>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <ChartCard title="Statut des factures" icon={FileText} iconColor="#F08900">
                    {data.charts.facturesByStatus.length > 0 ? (
                      <>
                        <BiDonutChart data={data.charts.facturesByStatus} height={180} />
                        <div className="mt-3 space-y-2">
                          {data.charts.facturesByStatus.map(s => (
                            <div key={s.name} className="flex items-center justify-between px-1">
                              <div className="flex items-center gap-2">
                                <div className="w-2.5 h-2.5 rounded-full" style={{ background: s.color }} />
                                <span className="text-xs text-[#8B949E]">{s.name}</span>
                              </div>
                              <span className="text-xs font-bold text-[#FFFFFF]">{s.value}</span>
                            </div>
                          ))}
                        </div>
                      </>
                    ) : <p className="text-xs text-[#484F58] text-center py-8">Aucune facture</p>}
                  </ChartCard>

                  <ChartCard title="Indicateurs clés" icon={Activity} iconColor="#8B0070">
                    <div className="space-y-4 pt-2">
                      {[
                        { label: 'Taux de paiement', val: `${data.financial.txPaiement}%`, color: data.financial.txPaiement >= 80 ? '#142850' : '#F08900', pct: data.financial.txPaiement },
                        { label: 'Factures payées',   val: `${data.financial.nbFactPay}/${data.financial.nbFactures}`, color: '#F08900', pct: data.financial.nbFactures > 0 ? (data.financial.nbFactPay / data.financial.nbFactures) * 100 : 0 },
                        { label: 'Recettes scolarité',val: fmtFCFA(data.financial.totalScol), color: '#8B0070', pct: data.financial.totalEntrees > 0 ? (data.financial.totalScol / data.financial.totalEntrees) * 100 : 0 },
                      ].map(r => (
                        <div key={r.label}>
                          <div className="flex justify-between mb-1.5">
                            <span className="text-xs text-[#6B7280]">{r.label}</span>
                            <span className="text-xs font-bold" style={{ color: r.color }}>{r.val}</span>
                          </div>
                          <div className="h-1.5 bg-[#1a2d50] rounded-full overflow-hidden">
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
                  <KpiCard i={1} label="Employés actifs" icon={Users}
                    value={String(data.rh.nbActifs)} sub={`/${data.rh.nbTotal} total`}
                    color="linear-gradient(135deg,#071535,#142850)" />
                  <KpiCard i={2} label="En congé" icon={Clock}
                    value={String(data.rh.nbConges)} sub="collaborateurs"
                    color="linear-gradient(135deg,#4A0040,#8B0070)" />
                  <KpiCard i={3} label="Masse salariale" icon={Wallet}
                    value={fmtFCFA(data.rh.masseSal)} sub="exercice"
                    color="linear-gradient(135deg,#4A0040,#8B0070)" />
                  <KpiCard i={4} label="Contrats expirant" icon={AlertTriangle}
                    value={String(data.rh.contratsExpirant30)} sub="dans 30 jours"
                    color="linear-gradient(135deg,#7A3800,#C06000)"
                    alert={data.rh.contratsExpirant30 > 0} />
                </div>

                <ChartCard title="Évolution masse salariale mensuelle" icon={Users} iconColor="#8B0070">
                  <BiBarChart
                    data={data.charts.masseSalMensuelle}
                    series={[{ dataKey: 'masse', color: '#8B0070', label: 'Masse salariale' }]}
                    height={230}
                  />
                </ChartCard>

                <div className="bg-[#0f1e3d] border border-[#1a2d50] rounded-2xl overflow-hidden">
                  <div className="flex items-center gap-2 px-5 py-3.5 border-b border-[#1a2d50]">
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-[#8B0070]/20">
                      <Users size={13} className="text-[#F08900]" />
                    </div>
                    <span className="text-xs font-bold text-[#FFFFFF] uppercase tracking-wider">Répartition effectif</span>
                  </div>
                  <div className="p-5 grid grid-cols-3 gap-4">
                    {[
                      { label: 'Actifs',    val: data.rh.nbActifs,  color: '#142850', pct: data.rh.nbTotal > 0 ? (data.rh.nbActifs / data.rh.nbTotal) * 100 : 0 },
                      { label: 'En congé', val: data.rh.nbConges,   color: '#F08900', pct: data.rh.nbTotal > 0 ? (data.rh.nbConges / data.rh.nbTotal) * 100 : 0 },
                      { label: 'Autres',   val: data.rh.nbTotal - data.rh.nbActifs - data.rh.nbConges, color: '#6B7280', pct: data.rh.nbTotal > 0 ? ((data.rh.nbTotal - data.rh.nbActifs - data.rh.nbConges) / data.rh.nbTotal) * 100 : 0 },
                    ].map(r => (
                      <div key={r.label} className="text-center">
                        <p className="text-2xl font-bold mb-1" style={{ color: r.color }}>{r.val}</p>
                        <p className="text-[10px] text-[#484F58] mb-2">{r.label}</p>
                        <div className="h-1 bg-[#1a2d50] rounded-full overflow-hidden">
                          <motion.div className="h-full rounded-full" style={{ background: r.color }}
                            initial={{ width: 0 }} animate={{ width: `${Math.min(r.pct, 100)}%` }}
                            transition={{ duration: 0.8 }} />
                        </div>
                        <p className="text-[9px] text-[#484F58] mt-1">{Math.round(r.pct)}%</p>
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
                  <KpiCard i={1} label="Absences enregistrées" icon={GraduationCap}
                    value={String(data.ecole.nbAbsences)} sub={`Exercice ${year}`}
                    color="linear-gradient(135deg,#4A0040,#8B0070)" />
                  <KpiCard i={2} label="Recettes scolarité" icon={Wallet}
                    value={fmtFCFA(data.ecole.totalScol)} sub="paiements reçus"
                    color="linear-gradient(135deg,#071535,#142850)" />
                  <KpiCard i={3} label="Automation notifications" icon={Bell}
                    value={String(data.automation.nbNotifs)} sub={`${data.automation.notifUnread} non lue(s)`}
                    color="linear-gradient(135deg,#4A0040,#8B0070)" />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <ChartCard title="Absences par mois" icon={AlertTriangle} iconColor="#F51E33">
                    <BiCountBarChart
                      data={data.charts.absParMois}
                      dataKey="absences"
                      color="#F51E33"
                      height={200}
                    />
                  </ChartCard>

                  <ChartCard title="Recettes scolarité par mois" icon={Wallet} iconColor="#142850">
                    <BiBarChart
                      data={data.charts.scolParMois}
                      series={[{ dataKey: 'montant', color: '#142850', label: 'Scolarité' }]}
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
                  <KpiCard i={1} label="Valeur stock" icon={Package}
                    value={fmtFCFA(data.stock.valeurStock)} sub={`${data.stock.nbArticles} articles`}
                    color="linear-gradient(135deg,#7A3800,#C06000)" />
                  <KpiCard i={2} label="Ruptures" icon={AlertTriangle}
                    value={String(data.stock.articlesRupture)} sub="articles épuisés"
                    color="linear-gradient(135deg,#7A0000,#A00018)"
                    alert={data.stock.articlesRupture > 0} />
                  <KpiCard i={3} label="Stock critique" icon={AlertTriangle}
                    value={String(data.stock.articlesCritiques)} sub="sous le seuil min"
                    color="linear-gradient(135deg,#431407,#EA580C)"
                    alert={data.stock.articlesCritiques > 0} />
                  <KpiCard i={4} label="Articles OK" icon={CheckCircle}
                    value={String(Math.max(0, data.stock.nbArticles - data.stock.articlesRupture - data.stock.articlesCritiques))}
                    sub="en stock suffisant"
                    color="linear-gradient(135deg,#071535,#142850)" />
                </div>

                {/* Top articles */}
                <div className="bg-[#0f1e3d] border border-[#1a2d50] rounded-2xl overflow-hidden">
                  <div className="flex items-center gap-2 px-5 py-3.5 border-b border-[#1a2d50]">
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-[#C06000]/20">
                      <Package size={13} className="text-[#C06000]" />
                    </div>
                    <span className="text-xs font-bold text-[#FFFFFF] uppercase tracking-wider">Top articles par valeur</span>
                  </div>
                  <div className="divide-y divide-[#1a2d50]">
                    {data.stock.topArticles.length > 0 ? data.stock.topArticles.map((a, i) => {
                      const pct = data.stock.valeurStock > 0 ? (a.valeur / data.stock.valeurStock) * 100 : 0
                      return (
                        <div key={i} className="px-5 py-3.5">
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-sm text-[#FFFFFF] font-medium truncate pr-4">{a.nom}</span>
                            <span className="text-xs font-bold text-[#F08900] shrink-0">{fmtFCFA(a.valeur)}</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="flex-1 h-1 bg-[#1a2d50] rounded-full overflow-hidden">
                              <motion.div className="h-full rounded-full bg-[#F08900]"
                                initial={{ width: 0 }} animate={{ width: `${Math.min(pct, 100)}%` }}
                                transition={{ duration: 0.7, delay: i * 0.1 }} />
                            </div>
                            <span className="text-[10px] text-[#484F58] shrink-0">{a.quantite} unités</span>
                          </div>
                        </div>
                      )
                    }) : (
                      <p className="text-xs text-[#484F58] text-center py-8">Aucun article en stock</p>
                    )}
                  </div>
                </div>

                {/* Stock health donut */}
                <ChartCard title="Santé du stock" icon={Activity} iconColor="#142850">
                  {data.stock.nbArticles > 0 ? (
                    <div className="flex items-center gap-6">
                      <div className="flex-1">
                        <BiDonutChart
                          data={[
                            { name: 'OK',      value: Math.max(0, data.stock.nbArticles - data.stock.articlesRupture - data.stock.articlesCritiques), color: '#142850' },
                            { name: 'Critique', value: data.stock.articlesCritiques, color: '#F08900' },
                            { name: 'Rupture',  value: data.stock.articlesRupture,   color: '#F51E33' },
                          ].filter(d => d.value > 0)}
                          height={180}
                        />
                      </div>
                      <div className="space-y-3">
                        {[
                          { label: 'En stock', color: '#142850', val: Math.max(0, data.stock.nbArticles - data.stock.articlesRupture - data.stock.articlesCritiques) },
                          { label: 'Critique',  color: '#F08900', val: data.stock.articlesCritiques },
                          { label: 'Rupture',   color: '#F51E33', val: data.stock.articlesRupture },
                        ].map(r => (
                          <div key={r.label} className="flex items-center gap-2">
                            <div className="w-2.5 h-2.5 rounded-full" style={{ background: r.color }} />
                            <span className="text-xs text-[#8B949E]">{r.label}</span>
                            <span className="text-xs font-bold ml-auto" style={{ color: r.color }}>{r.val}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-[#484F58] text-center py-6">Aucun article</p>
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
                  <KpiCard i={1} label="Tâches terminées" icon={CheckCircle}
                    value={String(data.automation.tasksDone)} sub={`${year}`}
                    color="linear-gradient(135deg,#071535,#142850)" />
                  <KpiCard i={2} label="En attente" icon={Clock}
                    value={String(data.automation.tasksPend)} sub="à traiter"
                    color="linear-gradient(135deg,#7A3800,#C06000)"
                    alert={data.automation.tasksPend > 0} />
                  <KpiCard i={3} label="Erreurs" icon={AlertTriangle}
                    value={String(data.automation.tasksError)} sub="tâches échouées"
                    color="linear-gradient(135deg,#7A0000,#A00018)"
                    alert={data.automation.tasksError > 0} />
                  <KpiCard i={4} label="Notifications" icon={Bell}
                    value={String(data.automation.nbNotifs)} sub={`${data.automation.notifUnread} non lue(s)`}
                    color="linear-gradient(135deg,#4A0040,#8B0070)" />
                </div>

                {/* Run checks panel */}
                <div className="bg-[#0f1e3d] border border-[#1a2d50] rounded-2xl p-5">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-[#8B0070]/20">
                        <Zap size={16} className="text-[#F08900]" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-[#FFFFFF]">Moteur d'automatisation</p>
                        <p className="text-xs text-[#484F58]">Contrats expirants · Factures impayées · Alertes stock</p>
                      </div>
                    </div>
                    <button onClick={runAutomation} disabled={running}
                      className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all disabled:opacity-50"
                      style={{ background: 'linear-gradient(135deg,#8B0070,#8B0070)', color: '#fff' }}>
                      {running ? <Loader2 size={13} className="animate-spin" /> : <Zap size={13} />}
                      {running ? 'Vérification en cours…' : 'Lancer maintenant'}
                    </button>
                  </div>
                  {runResult && (
                    <div className="bg-[#142850]/10 border border-[#142850]/20 rounded-xl px-4 py-3">
                      <p className="text-xs text-[#142850]">{runResult}</p>
                    </div>
                  )}
                  <div className="mt-4 grid grid-cols-3 gap-3">
                    {[
                      { label: 'Contrats expirants', val: data.rh.contratsExpirant30, color: '#F08900', desc: 'dans 30 jours' },
                      { label: 'Factures en retard', val: data.financial.nbFactures - data.financial.nbFactPay, color: '#F51E33', desc: 'non payées' },
                      { label: 'Stock critique',     val: data.stock.articlesRupture + data.stock.articlesCritiques, color: '#F08900', desc: 'à réapprovisionner' },
                    ].map(r => (
                      <div key={r.label} className="bg-[#142850] border border-[#1a2d50] rounded-xl p-3 text-center">
                        <p className="text-2xl font-bold mb-1" style={{ color: r.color }}>{r.val}</p>
                        <p className="text-[10px] font-semibold text-[#FFFFFF]">{r.label}</p>
                        <p className="text-[9px] text-[#484F58] mt-0.5">{r.desc}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Automation types donut */}
                <ChartCard title="État des tâches planifiées" icon={Activity} iconColor="#8B0070">
                  {(data.automation.tasksDone + data.automation.tasksPend + data.automation.tasksError) > 0 ? (
                    <BiDonutChart
                      data={[
                        { name: 'Terminées', value: data.automation.tasksDone,  color: '#142850' },
                        { name: 'En attente', value: data.automation.tasksPend, color: '#F08900' },
                        { name: 'Erreurs',    value: data.automation.tasksError,color: '#F51E33' },
                      ].filter(d => d.value > 0)}
                      height={200}
                    />
                  ) : (
                    <p className="text-xs text-[#484F58] text-center py-8">Aucune tâche planifiée</p>
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

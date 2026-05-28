'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useTenant } from '@/lib/hooks/useTenant'
import { useLocale } from '@/lib/hooks/useLocale'
import { fmtFCFA } from '@/lib/admin-config'
import {
  BarChart3, TrendingUp, TrendingDown, ArrowUpCircle, ArrowDownCircle,
  GitMerge, Download, Calendar, RefreshCw, Building2, Archive,
  Smartphone, Wallet2, ChevronUp, ChevronDown, Loader2,
} from 'lucide-react'

// ── Types ──────────────────────────────────────────────────────────────────────

interface MonthData {
  mois: string       // YYYY-MM
  entrees: number
  sorties: number
  transferts: number
  cashflow: number
}

interface AccountBalance {
  type: 'banque' | 'caisse' | 'mobile'
  label: string
  solde: number
  pct: number
}

interface CategoryBreakdown {
  categorie: string
  type: 'entree' | 'sortie'
  total: number
  count: number
  pct: number
}

function getLast12Months(): string[] {
  const months: string[] = []
  for (let i = 11; i >= 0; i--) {
    const d = new Date()
    d.setDate(1)
    d.setMonth(d.getMonth() - i)
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }
  return months
}

export default function AnalyticsPage() {
  const { tenantId } = useTenant()
  const { t } = useLocale()
  const [loading, setLoading]       = useState(true)
  const [monthlyData, setMonthlyData] = useState<MonthData[]>([])
  const [accountBalances, setAccountBalances] = useState<AccountBalance[]>([])
  const [categoriesIn, setCategoriesIn]   = useState<CategoryBreakdown[]>([])
  const [categoriesOut, setCategoriesOut] = useState<CategoryBreakdown[]>([])
  const [kpis, setKpis]             = useState({
    totalEntrees: 0, totalSorties: 0, cashflowNet: 0,
    prevMoisEntrees: 0, prevMoisSorties: 0,
    totalComptes: 0, bestMoisCashflow: '',
  })
  const [selectedPeriod, setSelectedPeriod] = useState<'3m' | '6m' | '12m'>('6m')

  const load = useCallback(async () => {
    if (!tenantId) return
    setLoading(true)
    try {
      const months = getLast12Months()
      const from = `${months[0]}-01`
      const now = new Date()
      const to = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`

      const [{ data: txs }, { data: banques }, { data: caisses }, { data: wallets }] = await Promise.all([
        supabase.from('transactions').select('date,type,montant,categorie')
          .eq('tenant_id', tenantId).gte('date', from).lte('date', to),
        supabase.from('comptes_bancaires').select('id,intitule,banque,solde').eq('tenant_id', tenantId).eq('actif', true),
        supabase.from('caisses').select('id,nom,solde').eq('tenant_id', tenantId).eq('actif', true),
        supabase.from('wallets').select('id,intitule,operateur,solde').eq('tenant_id', tenantId).eq('actif', true),
      ])

      // Monthly breakdown
      const mData: MonthData[] = months.map(m => {
        const mTxs = (txs ?? []).filter((t: { date: string; type: string; montant: number }) => t.date.startsWith(m))
        const entrees = mTxs.filter((t: { type: string }) => t.type === 'entree').reduce((s: number, t: { montant: number }) => s + t.montant, 0)
        const sorties = mTxs.filter((t: { type: string }) => t.type === 'sortie' || t.type === 'frais').reduce((s: number, t: { montant: number }) => s + t.montant, 0)
        const transferts = mTxs.filter((t: { type: string }) => t.type === 'virement').reduce((s: number, t: { montant: number }) => s + t.montant, 0)
        return { mois: m, entrees, sorties, transferts, cashflow: entrees - sorties }
      })
      setMonthlyData(mData)

      // Current & prev month KPIs
      const currM = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
      const prevDate = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      const prevM = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`
      const curr = mData.find(d => d.mois === currM) ?? { entrees: 0, sorties: 0, cashflow: 0 }
      const prev = mData.find(d => d.mois === prevM) ?? { entrees: 0, sorties: 0, cashflow: 0 }

      // Best month
      const best = mData.reduce((a, b) => b.cashflow > a.cashflow ? b : a, mData[0] ?? { mois: '', cashflow: 0 })

      // Total balances
      const totalBanque  = (banques ?? []).reduce((s: number, b: { solde: number }) => s + b.solde, 0)
      const totalCaisse  = (caisses ?? []).reduce((s: number, c: { solde: number }) => s + c.solde, 0)
      const totalWallet  = (wallets ?? []).reduce((s: number, w: { solde: number }) => s + w.solde, 0)
      const totalComptes = totalBanque + totalCaisse + totalWallet

      setKpis({
        totalEntrees: curr.entrees, totalSorties: curr.sorties, cashflowNet: curr.cashflow,
        prevMoisEntrees: prev.entrees, prevMoisSorties: prev.sorties,
        totalComptes,
        bestMoisCashflow: best.mois,
      })

      // Account breakdown
      const accBal: AccountBalance[] = []
      ;(banques ?? []).forEach((b: { id: string; intitule: string; banque: string; solde: number }) => {
        accBal.push({ type: 'banque', label: `${b.intitule} (${b.banque})`, solde: b.solde, pct: totalComptes > 0 ? (b.solde / totalComptes) * 100 : 0 })
      })
      ;(caisses ?? []).forEach((c: { id: string; nom: string; solde: number }) => {
        accBal.push({ type: 'caisse', label: c.nom, solde: c.solde, pct: totalComptes > 0 ? (c.solde / totalComptes) * 100 : 0 })
      })
      ;(wallets ?? []).forEach((w: { id: string; intitule: string; operateur: string; solde: number }) => {
        accBal.push({ type: 'mobile', label: `${w.intitule} (${w.operateur})`, solde: w.solde, pct: totalComptes > 0 ? (w.solde / totalComptes) * 100 : 0 })
      })
      setAccountBalances(accBal.sort((a, b) => b.solde - a.solde))

      // Category breakdown (all months)
      const catMap: Record<string, { total: number; count: number; type: 'entree' | 'sortie' }> = {}
      ;(txs ?? []).forEach((t: { type: string; montant: number; categorie: string }) => {
        if (!t.categorie) return
        const key = `${t.type}__${t.categorie}`
        if (!catMap[key]) catMap[key] = { total: 0, count: 0, type: t.type === 'entree' ? 'entree' : 'sortie' }
        catMap[key].total += t.montant
        catMap[key].count++
      })
      const totalIn  = Object.values(catMap).filter(v => v.type === 'entree').reduce((s, v) => s + v.total, 0)
      const totalOut = Object.values(catMap).filter(v => v.type === 'sortie').reduce((s, v) => s + v.total, 0)

      const inCats: CategoryBreakdown[] = Object.entries(catMap)
        .filter(([, v]) => v.type === 'entree')
        .map(([k, v]) => ({ categorie: k.split('__')[1], type: 'entree' as const, total: v.total, count: v.count, pct: totalIn > 0 ? (v.total / totalIn) * 100 : 0 }))
        .sort((a, b) => b.total - a.total).slice(0, 6)

      const outCats: CategoryBreakdown[] = Object.entries(catMap)
        .filter(([, v]) => v.type === 'sortie')
        .map(([k, v]) => ({ categorie: k.split('__')[1], type: 'sortie' as const, total: v.total, count: v.count, pct: totalOut > 0 ? (v.total / totalOut) * 100 : 0 }))
        .sort((a, b) => b.total - a.total).slice(0, 6)

      setCategoriesIn(inCats)
      setCategoriesOut(outCats)
    } finally {
      setLoading(false)
    }
  }, [tenantId])

  useEffect(() => { load() }, [load])

  const nM = selectedPeriod === '3m' ? 3 : selectedPeriod === '6m' ? 6 : 12
  const displayData = monthlyData.slice(12 - nM)
  const maxVal = Math.max(...displayData.map(d => Math.max(d.entrees, d.sorties)), 1)

  function pctChange(curr: number, prev: number) {
    if (prev === 0) return null
    return ((curr - prev) / prev * 100).toFixed(1)
  }

  const entrPct = pctChange(kpis.totalEntrees, kpis.prevMoisEntrees)
  const sortPct = pctChange(kpis.totalSorties, kpis.prevMoisSorties)

  const TYPE_ICONS: Record<string, React.ElementType> = { banque: Building2, caisse: Archive, mobile: Smartphone }
  const TYPE_COLORS: Record<string, string> = { banque: 'text-blue-500', caisse: 'text-amber-500', mobile: 'text-orange-500' }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#0891B2]/10 flex items-center justify-center">
            <BarChart3 size={20} className="text-[#0891B2]" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-[#0F172A]">{t('treso.analytics.title')}</h1>
            <p className="text-xs text-[#64748B]">{t('treso.analytics.subtitle')}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex bg-[#F1F5F9] rounded-xl p-0.5">
            {(['3m', '6m', '12m'] as const).map(p => (
              <button key={p} onClick={() => setSelectedPeriod(p)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                  selectedPeriod === p ? 'bg-white text-[#0F172A] shadow-sm' : 'text-[#64748B]'
                }`}>
                {p}
              </button>
            ))}
          </div>
          <button onClick={load} className="p-2 hover:bg-[#F1F5F9] rounded-xl transition-colors">
            <RefreshCw size={14} className="text-[#64748B]" />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16"><Loader2 size={24} className="animate-spin text-[#0891B2]" /></div>
      ) : (
        <>
          {/* KPI Strip */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              {
                label: t('treso.analytics.kpi.cashflow'), value: kpis.totalComptes,
                color: 'text-[#0891B2]', bg: 'bg-cyan-50', icon: BarChart3, badge: null,
              },
              {
                label: 'Encaissé ce mois', value: kpis.totalEntrees,
                color: 'text-green-600', bg: 'bg-green-50', icon: ArrowUpCircle,
                badge: entrPct !== null ? { pct: entrPct, up: parseFloat(entrPct) >= 0 } : null,
              },
              {
                label: 'Décaissé ce mois', value: kpis.totalSorties,
                color: 'text-red-600', bg: 'bg-red-50', icon: ArrowDownCircle,
                badge: sortPct !== null ? { pct: sortPct, up: parseFloat(sortPct) < 0 } : null,
              },
              {
                label: t('treso.analytics.kpi.ratio'), value: kpis.cashflowNet,
                color: kpis.cashflowNet >= 0 ? 'text-green-600' : 'text-red-600',
                bg: kpis.cashflowNet >= 0 ? 'bg-green-50' : 'bg-red-50',
                icon: kpis.cashflowNet >= 0 ? TrendingUp : TrendingDown, badge: null,
              },
            ].map(k => {
              const Icon = k.icon
              return (
                <div key={k.label} className="bg-white border border-[#E2E8F0] rounded-2xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-[#64748B] font-medium">{k.label}</span>
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${k.bg}`}>
                      <Icon size={13} className={k.color} />
                    </div>
                  </div>
                  <div className={`text-xl font-bold ${k.color}`}>
                    {k.value >= 0 ? '' : ''}{fmtFCFA(Math.abs(k.value))}
                  </div>
                  {k.badge && (
                    <div className={`flex items-center gap-0.5 text-[10px] font-semibold mt-1 ${k.badge.up ? 'text-green-600' : 'text-red-600'}`}>
                      {k.badge.up ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                      {Math.abs(parseFloat(k.badge.pct))}% vs mois précédent
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Main chart */}
          <div className="bg-white border border-[#E2E8F0] rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-[#0F172A]">Flux de trésorerie — {nM} derniers mois</h3>
              <div className="flex items-center gap-4 text-[10px]">
                <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-green-400" /><span>Entrées</span></div>
                <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-red-400" /><span>Sorties</span></div>
                <div className="flex items-center gap-1.5"><div className="w-1 h-4 bg-[#0891B2] rounded" /><span>Cashflow</span></div>
              </div>
            </div>
            <div className="flex items-end gap-2 h-40">
              {displayData.map(d => {
                const [y, m] = d.mois.split('-')
                const label = new Date(parseInt(y), parseInt(m) - 1, 1).toLocaleDateString('fr-FR', { month: 'short' })
                const eH = Math.round((d.entrees / maxVal) * 120)
                const sH = Math.round((d.sorties / maxVal) * 120)
                const isCurrentMonth = d.mois === `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`
                return (
                  <div key={d.mois} className="flex-1 flex flex-col items-center gap-1">
                    <div className="flex items-end gap-0.5 h-32 w-full">
                      <div className="flex-1 bg-green-400 rounded-t-sm hover:bg-green-500 transition-colors cursor-pointer" style={{ height: `${eH}px` }}
                        title={`Entrées: ${fmtFCFA(d.entrees)}`} />
                      <div className="flex-1 bg-red-400 rounded-t-sm hover:bg-red-500 transition-colors cursor-pointer" style={{ height: `${sH}px` }}
                        title={`Sorties: ${fmtFCFA(d.sorties)}`} />
                    </div>
                    <span className={`text-[9px] font-semibold ${isCurrentMonth ? 'text-[#0891B2]' : 'text-[#94A3B8]'}`}>{label}</span>
                    <span className={`text-[8px] font-bold ${d.cashflow >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {d.cashflow >= 0 ? '+' : ''}{(d.cashflow / 1000).toFixed(0)}k
                    </span>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Two columns: categories + account breakdown */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Categories */}
            <div className="bg-white border border-[#E2E8F0] rounded-2xl p-5">
              <h3 className="text-sm font-bold text-[#0F172A] mb-3">Top catégories — Entrées</h3>
              <div className="space-y-2">
                {categoriesIn.length === 0 ? (
                  <p className="text-xs text-[#94A3B8] text-center py-4">Aucune donnée</p>
                ) : categoriesIn.map((c, i) => (
                  <div key={i}>
                    <div className="flex justify-between text-xs mb-0.5">
                      <span className="font-medium text-[#0F172A] capitalize">{c.categorie}</span>
                      <span className="font-bold text-green-600">+{fmtFCFA(c.total)}</span>
                    </div>
                    <div className="w-full h-1.5 bg-[#E2E8F0] rounded-full">
                      <div className="h-1.5 bg-green-500 rounded-full" style={{ width: `${c.pct}%` }} />
                    </div>
                    <div className="text-[10px] text-[#94A3B8]">{c.pct.toFixed(1)}% — {c.count} opération{c.count > 1 ? 's' : ''}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white border border-[#E2E8F0] rounded-2xl p-5">
              <h3 className="text-sm font-bold text-[#0F172A] mb-3">Top catégories — Sorties</h3>
              <div className="space-y-2">
                {categoriesOut.length === 0 ? (
                  <p className="text-xs text-[#94A3B8] text-center py-4">Aucune donnée</p>
                ) : categoriesOut.map((c, i) => (
                  <div key={i}>
                    <div className="flex justify-between text-xs mb-0.5">
                      <span className="font-medium text-[#0F172A] capitalize">{c.categorie}</span>
                      <span className="font-bold text-red-600">-{fmtFCFA(c.total)}</span>
                    </div>
                    <div className="w-full h-1.5 bg-[#E2E8F0] rounded-full">
                      <div className="h-1.5 bg-red-500 rounded-full" style={{ width: `${c.pct}%` }} />
                    </div>
                    <div className="text-[10px] text-[#94A3B8]">{c.pct.toFixed(1)}% — {c.count} opération{c.count > 1 ? 's' : ''}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Account breakdown */}
          <div className="bg-white border border-[#E2E8F0] rounded-2xl p-5">
            <h3 className="text-sm font-bold text-[#0F172A] mb-4">Répartition des soldes par compte</h3>
            {accountBalances.length === 0 ? (
              <p className="text-xs text-[#94A3B8] text-center py-4">Aucun compte configuré</p>
            ) : (
              <div className="space-y-3">
                {/* Visual bar */}
                <div className="h-4 rounded-full overflow-hidden flex">
                  {accountBalances.filter(a => a.solde > 0).map((a, i) => {
                    const colors = ['bg-blue-400', 'bg-amber-400', 'bg-orange-400', 'bg-green-400', 'bg-purple-400', 'bg-teal-400']
                    return (
                      <div key={i} className={`${colors[i % colors.length]} transition-all`}
                        style={{ width: `${a.pct}%` }} title={`${a.label}: ${fmtFCFA(a.solde)}`} />
                    )
                  })}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {accountBalances.map((a, i) => {
                    const Icon = TYPE_ICONS[a.type] ?? Building2
                    const colors = ['bg-blue-400', 'bg-amber-400', 'bg-orange-400', 'bg-green-400', 'bg-purple-400', 'bg-teal-400']
                    return (
                      <div key={i} className="flex items-center gap-3 p-2.5 rounded-xl bg-[#F8FAFC]">
                        <div className={`w-2.5 h-2.5 rounded-full ${colors[i % colors.length]}`} />
                        <Icon size={13} className={TYPE_COLORS[a.type]} />
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-medium text-[#0F172A] truncate">{a.label}</div>
                          <div className="text-[10px] text-[#94A3B8] capitalize">{a.type}</div>
                        </div>
                        <div className="text-right">
                          <div className="text-xs font-bold text-[#0F172A]">{fmtFCFA(a.solde)}</div>
                          <div className="text-[10px] text-[#94A3B8]">{a.pct.toFixed(1)}%</div>
                        </div>
                      </div>
                    )
                  })}
                </div>

                <div className="border-t border-[#E2E8F0] pt-3 flex justify-between text-xs font-bold text-[#0F172A]">
                  <span>Total trésorerie</span>
                  <span className="text-[#0891B2]">{fmtFCFA(kpis.totalComptes)}</span>
                </div>
              </div>
            )}
          </div>

          {/* Monthly table */}
          <div className="bg-white border border-[#E2E8F0] rounded-2xl overflow-hidden">
            <div className="px-4 py-3 border-b border-[#E2E8F0]">
              <span className="text-sm font-bold text-[#0F172A]">Tableau des flux mensuels</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-[#F8FAFC]">
                  <tr>
                    {['Mois', 'Entrées', 'Sorties', 'Cashflow', 'Tendance'].map(h => (
                      <th key={h} className="px-4 py-2.5 text-left text-[10px] font-semibold text-[#64748B] uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {displayData.map((d, i) => {
                    const prev = displayData[i - 1]
                    const trend = prev ? d.cashflow - prev.cashflow : 0
                    const [y, m] = d.mois.split('-')
                    const label = new Date(parseInt(y), parseInt(m) - 1, 1).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
                    const isCurrentMonth = d.mois === `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`
                    return (
                      <tr key={d.mois} className={`border-t border-[#F1F5F9] ${isCurrentMonth ? 'bg-cyan-50' : i % 2 === 0 ? '' : 'bg-[#FAFBFC]'}`}>
                        <td className="px-4 py-3">
                          <span className={`text-xs font-medium ${isCurrentMonth ? 'text-[#0891B2] font-bold' : 'text-[#0F172A]'}`}>
                            {label}{isCurrentMonth && ' (en cours)'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs font-semibold text-green-600">+{fmtFCFA(d.entrees)}</td>
                        <td className="px-4 py-3 text-xs font-semibold text-red-600">-{fmtFCFA(d.sorties)}</td>
                        <td className="px-4 py-3">
                          <span className={`text-sm font-bold ${d.cashflow >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {d.cashflow >= 0 ? '+' : ''}{fmtFCFA(d.cashflow)}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {prev && (
                            <div className={`flex items-center gap-1 text-[10px] font-semibold ${trend >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                              {trend >= 0 ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                              {trend >= 0 ? '+' : ''}{fmtFCFA(trend)}
                            </div>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

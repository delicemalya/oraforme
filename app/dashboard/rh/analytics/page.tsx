'use client'

/**
 * Analytics RH — Premium HR analytics dashboard
 * Turnover, salary distribution, department breakdown, payroll trends
 */

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useTenant } from '@/lib/hooks/useTenant'
import { useLocale } from '@/lib/hooks/useLocale'
import {
  BarChart2, TrendingUp, TrendingDown, Users,
  DollarSign, Clock, AlertTriangle, Award,
  Download, Calendar,
} from 'lucide-react'

/* ─── Types ─────────────────────────────────────────────── */
interface Employe {
  id: string
  nom: string
  poste: string
  departement: string | null
  statut: string
  salaire_brut: number | null
  type_contrat: string | null
  date_debut_contrat: string | null
  created_at: string
}

interface BulletinPaie {
  id: string
  mois: number
  annee: number
  brut: number
  net: number
  cnss_patronal: number
  cnss_salarie: number
  irpp: number
  primes: number
  employe_id: string
  created_at: string
}

interface Conge {
  id: string
  statut: string
  type: string
  nb_jours: number | null
  created_at: string
}

interface Evaluation {
  id: string
  employe_id: string
  note_globale: number
  periode: string
  created_at: string
}

/* ─── Helpers ────────────────────────────────────────────── */
const MONTHS_SHORT = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc']

function fmtFCFA(n: number) {
  return new Intl.NumberFormat('fr-FR').format(Math.round(n)) + ' FCFA'
}

function pct(a: number, b: number) {
  if (!b) return 0
  return Math.round((a / b) * 100)
}

/* ─── Mini Bar Chart ─────────────────────────────────────── */
function MiniBar({ data, color = '#F59E0B', label }: {
  data: { label: string; value: number }[]
  color?: string
  label?: string
}) {
  const max = Math.max(...data.map(d => d.value), 1)
  return (
    <div>
      {label && <p className="text-[11px] font-semibold text-[#64748B] mb-2">{label}</p>}
      <div className="flex items-end gap-1 h-24">
        {data.map((d, i) => (
          <div key={i} className="flex-1 flex flex-col items-center gap-0.5">
            <span className="text-[9px] text-[#94A3B8] font-mono">{d.value > 0 ? d.value : ''}</span>
            <div
              className="w-full rounded-t transition-all duration-500"
              style={{
                background: color,
                height: `${Math.max(4, (d.value / max) * 80)}px`,
                opacity: 0.7 + (i / data.length) * 0.3,
              }}
            />
            <span className="text-[8px] text-[#94A3B8] text-center truncate w-full">{d.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ─── KPI Card ───────────────────────────────────────────── */
function KpiCard({
  label, value, sub, icon: Icon, color, trend,
}: {
  label: string
  value: string
  sub?: string
  icon: typeof TrendingUp
  color: string
  trend?: { value: number; label: string }
}) {
  return (
    <div className="bg-white rounded-xl border border-[#E2E8F0] p-4">
      <div className="flex items-start justify-between">
        <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: color + '18' }}>
          <Icon size={16} style={{ color }} />
        </div>
        {trend && (
          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded flex items-center gap-0.5 ${
            trend.value >= 0 ? 'bg-[#DCFCE7] text-[#16A34A]' : 'bg-[#FEE2E2] text-[#DC2626]'
          }`}>
            {trend.value >= 0 ? <TrendingUp size={9} /> : <TrendingDown size={9} />}
            {Math.abs(trend.value)}%
          </span>
        )}
      </div>
      <div className="mt-2">
        <div className="text-[22px] font-extrabold text-[#0F172A]">{value}</div>
        <div className="text-[11px] text-[#64748B] font-medium">{label}</div>
        {sub && <div className="text-[10px] text-[#94A3B8] mt-0.5">{sub}</div>}
        {trend && <div className="text-[10px] text-[#94A3B8] mt-0.5">{trend.label}</div>}
      </div>
    </div>
  )
}

/* ─── Progress Bar ───────────────────────────────────────── */
function ProgressBar({ value, max, color, label, sublabel }: {
  value: number; max: number; color: string; label: string; sublabel?: string
}) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0
  return (
    <div className="space-y-1">
      <div className="flex justify-between items-center">
        <span className="text-[12px] font-semibold text-[#0F172A]">{label}</span>
        <div className="flex items-center gap-2">
          {sublabel && <span className="text-[11px] text-[#94A3B8]">{sublabel}</span>}
          <span className="text-[12px] font-bold" style={{ color }}>{pct}%</span>
        </div>
      </div>
      <div className="h-2 bg-[#F1F5F9] rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
      <div className="flex justify-between text-[10px] text-[#94A3B8]">
        <span>{value} / {max}</span>
      </div>
    </div>
  )
}

/* ─── Main Page ──────────────────────────────────────────── */
export default function AnalyticsRHPage() {
  const { tenantId, loading: tenantLoading } = useTenant()
  const { t, locale } = useLocale()
  const intlLocale = locale === 'fr' ? 'fr-FR' : locale
  const [employes, setEmployes]     = useState<Employe[]>([])
  const [bulletins, setBulletins]   = useState<BulletinPaie[]>([])
  const [conges, setConges]         = useState<Conge[]>([])
  const [evaluations, setEvaluations] = useState<Evaluation[]>([])
  const [loading, setLoading]       = useState(true)
  const [period, setPeriod]         = useState<'6m' | '12m' | '24m'>('12m')

  useEffect(() => {
    if (!tenantId) return
    ;(async () => {
      setLoading(true)
      const [empR, bulR, conR, evalR] = await Promise.all([
        supabase.from('employes').select('*').eq('tenant_id', tenantId).order('created_at'),
        supabase.from('bulletins_paie').select('*').eq('tenant_id', tenantId)
          .order('annee', { ascending: false }).order('mois', { ascending: false }).limit(200),
        supabase.from('conges').select('*').eq('tenant_id', tenantId).order('created_at', { ascending: false }),
        supabase.from('evaluations').select('*').eq('tenant_id', tenantId)
          .order('created_at', { ascending: false }).limit(100),
      ])
      setEmployes(empR.data || [])
      setBulletins(bulR.data || [])
      setConges(conR.data || [])
      setEvaluations(evalR.data || [])
      setLoading(false)
    })()
  }, [tenantId])

  /* ─── Computed analytics ─────────────────────────────────── */
  const analytics = useMemo(() => {
    const now = new Date()
    const monthsBack = period === '6m' ? 6 : period === '12m' ? 12 : 24

    /* Headcount */
    const actifs   = employes.filter(e => e.statut === 'actif').length
    const inactifs = employes.filter(e => e.statut !== 'actif').length
    const total    = employes.length

    /* Turnover */
    const cutoff = new Date()
    cutoff.setMonth(cutoff.getMonth() - monthsBack)
    const departed = employes.filter(e =>
      e.statut === 'inactif' || e.statut === 'licencie'
    ).length
    const turnover = total > 0 ? Math.round((departed / total) * 100) : 0

    /* Salary stats */
    const salaries = employes.filter(e => e.salaire_brut && e.salaire_brut > 0)
      .map(e => e.salaire_brut as number)
    const avgSalary = salaries.length > 0
      ? salaries.reduce((a, b) => a + b, 0) / salaries.length
      : 0
    const minSalary = salaries.length > 0 ? Math.min(...salaries) : 0
    const maxSalary = salaries.length > 0 ? Math.max(...salaries) : 0

    /* Monthly payroll trend */
    const monthlyPayroll: { label: string; value: number }[] = []
    for (let i = Math.min(monthsBack, 12) - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const m = d.getMonth() + 1
      const y = d.getFullYear()
      const total = bulletins
        .filter(b => b.mois === m && b.annee === y)
        .reduce((s, b) => s + b.brut, 0)
      monthlyPayroll.push({ label: MONTHS_SHORT[m - 1], value: Math.round(total / 1000) })
    }

    /* Payroll totals */
    const currentMonth = now.getMonth() + 1
    const currentYear  = now.getFullYear()
    const lastMonth    = currentMonth === 1 ? 12 : currentMonth - 1
    const lastMonthYear = currentMonth === 1 ? currentYear - 1 : currentYear

    const masseSalarialeCurrent = bulletins
      .filter(b => b.mois === currentMonth && b.annee === currentYear)
      .reduce((s, b) => s + b.brut, 0)
    const masseSalarialeLastMonth = bulletins
      .filter(b => b.mois === lastMonth && b.annee === lastMonthYear)
      .reduce((s, b) => s + b.brut, 0)
    const masseTrend = masseSalarialeLastMonth > 0
      ? Math.round(((masseSalarialeCurrent - masseSalarialeLastMonth) / masseSalarialeLastMonth) * 100)
      : 0

    /* Congé stats */
    const congesApprouves = conges.filter(c => c.statut === 'approuve').length
    const congesPending   = conges.filter(c => c.statut === 'en_attente').length
    const totalJoursConge = conges
      .filter(c => c.statut === 'approuve')
      .reduce((s, c) => s + (c.nb_jours || 0), 0)

    /* Departments */
    const deptMap = new Map<string, number>()
    for (const emp of employes.filter(e => e.statut === 'actif')) {
      const d = emp.departement || 'Non assigné'
      deptMap.set(d, (deptMap.get(d) || 0) + 1)
    }
    const departments = Array.from(deptMap.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([name, count]) => ({ name, count }))

    /* Contract types */
    const contractMap = new Map<string, number>()
    for (const emp of employes.filter(e => e.statut === 'actif')) {
      const c = emp.type_contrat || 'Non défini'
      contractMap.set(c, (contractMap.get(c) || 0) + 1)
    }
    const contractTypes = Array.from(contractMap.entries())
      .sort((a, b) => b[1] - a[1])

    /* Evaluation average */
    const evalAvg = evaluations.length > 0
      ? evaluations.reduce((s, e) => s + e.note_globale, 0) / evaluations.length
      : 0

    /* Hire trend (monthly) */
    const hireTrend: { label: string; value: number }[] = []
    for (let i = Math.min(monthsBack, 12) - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const m = d.getMonth() + 1
      const y = d.getFullYear()
      const count = employes.filter(e => {
        const created = new Date(e.created_at)
        return created.getMonth() + 1 === m && created.getFullYear() === y
      }).length
      hireTrend.push({ label: MONTHS_SHORT[m - 1], value: count })
    }

    /* Salary brackets */
    const brackets = [
      { label: '<200k', min: 0,      max: 200000 },
      { label: '200-400k', min: 200000, max: 400000 },
      { label: '400-700k', min: 400000, max: 700000 },
      { label: '700k-1M', min: 700000, max: 1000000 },
      { label: '>1M',    min: 1000000, max: Infinity },
    ].map(b => ({
      label: b.label,
      value: salaries.filter(s => s >= b.min && s < b.max).length,
    }))

    return {
      actifs, inactifs, total, turnover, departed,
      avgSalary, minSalary, maxSalary, salariesCount: salaries.length,
      monthlyPayroll, masseSalarialeCurrent, masseTrend,
      congesApprouves, congesPending, totalJoursConge,
      departments, contractTypes,
      evalAvg, evaluationsCount: evaluations.length,
      hireTrend, brackets,
    }
  }, [employes, bulletins, conges, evaluations, period])

  /* Export CSV */
  function exportCSV() {
    const rows = [
      ['Indicateur', 'Valeur'],
      ['Effectif actif',        analytics.actifs],
      ['Taux de turnover',      analytics.turnover + '%'],
      ['Masse salariale',       fmtFCFA(analytics.masseSalarialeCurrent)],
      ['Salaire moyen',         fmtFCFA(analytics.avgSalary)],
      ['Congés approuvés',      analytics.congesApprouves],
      ['Note évaluation moy',   analytics.evalAvg.toFixed(2) + '/5'],
    ]
    const csv = '﻿' + rows.map(r => r.join(';')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `analytics-rh-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
  }

  if (tenantLoading || loading) {
    return (
      <div className="flex items-center justify-center py-24 text-[#94A3B8]">
        <div className="w-6 h-6 border-2 border-[#F59E0B] border-t-transparent rounded-full animate-spin mr-2" />
        {t('common.loading')}
      </div>
    )
  }

  const CONTRACT_COLORS: Record<string, string> = {
    CDI: '#16A34A', CDD: '#2563EB', stage: '#D97706',
    vacation: '#8B5CF6', prestataire: '#0891B2', 'Non défini': '#94A3B8',
  }

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-extrabold text-[#0F172A] flex items-center gap-2">
            <BarChart2 size={22} className="text-[#F59E0B]" />
            {t('rh.analytics.title')}
          </h1>
          <p className="text-[13px] text-[#64748B] mt-0.5">{t('rh.analytics.subtitle')}</p>
        </div>

        <div className="flex items-center gap-2">
          {/* Period selector */}
          <div className="flex rounded-lg border border-[#E2E8F0] overflow-hidden bg-white">
            {(['6m', '12m', '24m'] as const).map(p => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-3 py-1.5 text-[11px] font-semibold transition-colors ${
                  period === p ? 'bg-[#F59E0B] text-white' : 'text-[#64748B] hover:bg-[#F8FAFC]'
                }`}
              >
                {p}
              </button>
            ))}
          </div>

          <button
            onClick={exportCSV}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-[#E2E8F0] rounded-lg text-[12px] font-semibold text-[#64748B] hover:bg-[#F8FAFC]"
          >
            <Download size={13} />
            Export
          </button>
        </div>
      </div>

      {/* KPIs row 1 */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KpiCard
          label={t('rh.analytics.kpi.headcount')}
          value={analytics.actifs.toString()}
          sub={`${analytics.inactifs} inactif${analytics.inactifs > 1 ? 's' : ''}`}
          icon={Users}
          color="#F59E0B"
          trend={analytics.hireTrend[analytics.hireTrend.length - 1]?.value !== undefined
            ? undefined : undefined}
        />
        <KpiCard
          label={t('rh.analytics.kpi.payroll')}
          value={analytics.masseSalarialeCurrent > 0 ? fmtFCFA(analytics.masseSalarialeCurrent) : '—'}
          sub="Ce mois"
          icon={DollarSign}
          color="#16A34A"
          trend={analytics.masseTrend !== 0
            ? { value: analytics.masseTrend, label: 'vs mois précédent' }
            : undefined}
        />
        <KpiCard
          label={t('rh.analytics.kpi.turnover')}
          value={analytics.turnover + '%'}
          sub={`${analytics.departed} départ${analytics.departed > 1 ? 's' : ''}`}
          icon={TrendingDown}
          color={analytics.turnover > 20 ? '#DC2626' : '#64748B'}
        />
        <KpiCard
          label="Note évaluation"
          value={analytics.evalAvg > 0 ? analytics.evalAvg.toFixed(1) + '/5' : '—'}
          sub={`${analytics.evaluationsCount} évaluation${analytics.evaluationsCount > 1 ? 's' : ''}`}
          icon={Award}
          color="#8B5CF6"
        />
      </div>

      {/* KPIs row 2 */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KpiCard
          label="Salaire moyen"
          value={analytics.avgSalary > 0 ? fmtFCFA(analytics.avgSalary) : '—'}
          sub={`Min: ${fmtFCFA(analytics.minSalary)}`}
          icon={DollarSign}
          color="#2563EB"
        />
        <KpiCard
          label="Congés approuvés"
          value={analytics.congesApprouves.toString()}
          sub={`${analytics.totalJoursConge} jours total`}
          icon={Calendar}
          color="#16A34A"
        />
        <KpiCard
          label="Congés en attente"
          value={analytics.congesPending.toString()}
          sub="À valider"
          icon={Clock}
          color={analytics.congesPending > 3 ? '#DC2626' : '#D97706'}
        />
        <KpiCard
          label="Salaire max"
          value={analytics.maxSalary > 0 ? fmtFCFA(analytics.maxSalary) : '—'}
          sub={`${analytics.salariesCount} salaires renseignés`}
          icon={TrendingUp}
          color="#0891B2"
        />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

        {/* Monthly payroll trend */}
        <div className="bg-white rounded-xl border border-[#E2E8F0] p-5">
          <div className="flex items-center justify-between mb-4">
            <p className="text-[13px] font-bold text-[#0F172A]">Évolution masse salariale</p>
            <span className="text-[10px] text-[#94A3B8]">en milliers FCFA</span>
          </div>
          {analytics.monthlyPayroll.some(d => d.value > 0) ? (
            <MiniBar data={analytics.monthlyPayroll} color="#F59E0B" />
          ) : (
            <div className="h-24 flex items-center justify-center text-[12px] text-[#94A3B8]">
              Aucune donnée de paie disponible
            </div>
          )}
        </div>

        {/* Hire trend */}
        <div className="bg-white rounded-xl border border-[#E2E8F0] p-5">
          <div className="flex items-center justify-between mb-4">
            <p className="text-[13px] font-bold text-[#0F172A]">Nouvelles recrues / mois</p>
            <span className="text-[10px] text-[#94A3B8]">embauches</span>
          </div>
          {analytics.hireTrend.some(d => d.value > 0) ? (
            <MiniBar data={analytics.hireTrend} color="#2563EB" />
          ) : (
            <div className="h-24 flex items-center justify-center text-[12px] text-[#94A3B8]">
              Aucune donnée de recrutement
            </div>
          )}
        </div>
      </div>

      {/* Departments + contracts */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

        {/* Departments */}
        <div className="bg-white rounded-xl border border-[#E2E8F0] p-5">
          <p className="text-[13px] font-bold text-[#0F172A] mb-4">Répartition par département</p>
          {analytics.departments.length === 0 ? (
            <p className="text-center py-6 text-[12px] text-[#94A3B8]">Aucun département renseigné</p>
          ) : (
            <div className="space-y-3">
              {analytics.departments.slice(0, 8).map((d, i) => {
                const colors = ['#F59E0B', '#2563EB', '#16A34A', '#8B5CF6', '#DC2626', '#0891B2', '#D97706', '#EC4899']
                return (
                  <ProgressBar
                    key={d.name}
                    label={d.name}
                    value={d.count}
                    max={analytics.actifs}
                    color={colors[i % colors.length]}
                    sublabel={d.count + ' pers.'}
                  />
                )
              })}
            </div>
          )}
        </div>

        {/* Contract types */}
        <div className="bg-white rounded-xl border border-[#E2E8F0] p-5">
          <p className="text-[13px] font-bold text-[#0F172A] mb-4">Types de contrat</p>
          {analytics.contractTypes.length === 0 ? (
            <p className="text-center py-6 text-[12px] text-[#94A3B8]">Aucun contrat renseigné</p>
          ) : (
            <div className="space-y-3">
              {analytics.contractTypes.map(([type, count]) => (
                <ProgressBar
                  key={type}
                  label={type.toUpperCase()}
                  value={count}
                  max={analytics.actifs}
                  color={CONTRACT_COLORS[type] || '#94A3B8'}
                  sublabel={count + ' emp.'}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Salary distribution */}
      <div className="bg-white rounded-xl border border-[#E2E8F0] p-5">
        <p className="text-[13px] font-bold text-[#0F172A] mb-4">Distribution salariale (FCFA)</p>
        {analytics.brackets.some(b => b.value > 0) ? (
          <MiniBar data={analytics.brackets} color="#16A34A" label="" />
        ) : (
          <p className="text-center py-6 text-[12px] text-[#94A3B8]">Aucun salaire renseigné dans les profils employés</p>
        )}
      </div>

      {/* Alerts */}
      <div className="space-y-2">
        {analytics.turnover > 20 && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-[#FEE2E2] border border-[#FECACA]">
            <AlertTriangle size={14} className="text-[#DC2626] mt-0.5 shrink-0" />
            <div>
              <p className="text-[12px] font-bold text-[#DC2626]">Taux de turnover élevé ({analytics.turnover}%)</p>
              <p className="text-[11px] text-[#DC2626]/80">Un turnover supérieur à 20% peut indiquer un problème de rétention des talents.</p>
            </div>
          </div>
        )}
        {analytics.congesPending > 5 && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-[#FEF3C7] border border-[#FDE68A]">
            <AlertTriangle size={14} className="text-[#D97706] mt-0.5 shrink-0" />
            <div>
              <p className="text-[12px] font-bold text-[#D97706]">{analytics.congesPending} demandes de congé en attente</p>
              <p className="text-[11px] text-[#D97706]/80">Pensez à traiter les demandes en attente pour éviter les blocages.</p>
            </div>
          </div>
        )}
        {analytics.salariesCount === 0 && analytics.actifs > 0 && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-[#EFF6FF] border border-[#BFDBFE]">
            <AlertTriangle size={14} className="text-[#2563EB] mt-0.5 shrink-0" />
            <div>
              <p className="text-[12px] font-bold text-[#2563EB]">Salaires non renseignés</p>
              <p className="text-[11px] text-[#2563EB]/80">Ajoutez les salaires dans les profils employés pour activer les analyses salariales.</p>
            </div>
          </div>
        )}
        {analytics.actifs === 0 && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0]">
            <Users size={14} className="text-[#94A3B8] mt-0.5 shrink-0" />
            <p className="text-[12px] text-[#64748B]">Aucun employé actif — ajoutez des employés dans le module Employés pour voir les analytics.</p>
          </div>
        )}
      </div>
    </div>
  )
}

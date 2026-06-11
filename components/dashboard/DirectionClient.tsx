'use client'

/**
 * DirectionClient — rendu i18n de la page Direction Générale
 * Reçoit les données du server component, traduit les labels côté client.
 */

import ERPPageLayout, {
  ERPKpiGrid, ERPSectionCard, ERPStatusBadge,
  type ERPKpi,
} from '@/components/ui/ERPPageLayout'
import { BarChart2, TrendingUp, Users, AlertTriangle, CheckCircle, ArrowRight } from 'lucide-react'
import Link from 'next/link'
import { useLocale } from '@/lib/hooks/useLocale'
import { useFmt } from '@/lib/hooks/useFmt'

export interface DirectionData {
  ca:         number
  prevCA:     number
  caCollecte: number
  totalDeps:  number
  prevDeps:   number
  marge:      number
  activeEmps: number
  totalEmps:  number
  facImpayees: number
  caGrowth:   number
  depGrowth:  number
}

export default function DirectionClient({ data }: { data: DirectionData }) {
  const { fmt: fmtFCFA } = useFmt()
  const { t } = useLocale()

  const {
    ca, prevCA, caCollecte, totalDeps, prevDeps, marge,
    activeEmps, totalEmps, facImpayees, caGrowth, depGrowth,
  } = data

  const kpis: ERPKpi[] = [
    {
      label: t('dir.kpi.ca'),
      value: fmtFCFA(ca),
      sub:   `${t('dir.kpi.collected')} : ${fmtFCFA(caCollecte)}`,
      color: '#F59E0B',
      icon:  <TrendingUp size={16} />,
      trend: { value: Math.abs(caGrowth), positive: caGrowth >= 0 },
    },
    {
      label: t('dir.kpi.charges'),
      value: fmtFCFA(totalDeps),
      sub:   `${t('dir.kpi.grossMargin')} : ${marge}%`,
      color: depGrowth > 10 ? '#DC2626' : '#64748B',
      icon:  <BarChart2 size={16} />,
      trend: { value: Math.abs(depGrowth), positive: depGrowth <= 0 },
    },
    {
      label: t('dir.kpi.headcount'),
      value: `${activeEmps} / ${totalEmps}`,
      sub:   t('dir.kpi.collaborators'),
      color: '#2563EB',
      icon:  <Users size={16} />,
    },
    {
      label: t('dir.kpi.unpaidInvoices'),
      value: facImpayees,
      sub:   t('dir.kpi.toFollowUp'),
      color: facImpayees > 5 ? '#DC2626' : '#16A34A',
      icon:  <AlertTriangle size={16} />,
    },
  ]

  const alerts: { level: 'warning' | 'error' | 'info'; message: string; href: string }[] = []
  if (facImpayees > 0) {
    alerts.push({ level: 'warning', message: `${facImpayees} ${t('dir.alerts.unpaidFact')}`, href: '/dashboard/facturation' })
  }
  if (marge < 10 && ca > 0) {
    alerts.push({ level: 'error', message: t('dir.alerts.critMargin'), href: '/dashboard/finance' })
  }
  if (totalEmps === 0) {
    alerts.push({ level: 'info', message: t('dir.alerts.noEmployee'), href: '/dashboard/rh' })
  }

  const quickLinks = [
    { label: t('dir.link.rh'),          href: '/dashboard/rh',           color: '#64748B' },
    { label: t('dir.link.finance'),      href: '/dashboard/finance',       color: '#F59E0B' },
    { label: t('dir.link.compta'),       href: '/dashboard/comptabilite',  color: '#64748B' },
    { label: t('dir.link.tresorerie'),   href: '/dashboard/tresorerie',    color: '#64748B' },
    { label: t('dir.link.facturation'),  href: '/dashboard/facturation',   color: '#F59E0B' },
    { label: t('dir.link.analytics'),   href: '/dashboard/analytics',     color: '#2563EB' },
  ]

  const financialRows = [
    { label: t('dir.caTotal'),    value: fmtFCFA(ca),         sub: `vs ${fmtFCFA(prevCA)} ${t('dir.prevMonth')}` },
    { label: t('dir.caCollecte'), value: fmtFCFA(caCollecte), sub: `${ca > 0 ? Math.round(caCollecte / ca * 100) : 0}% ${t('dir.ofCA')}` },
    { label: t('dir.charges'),    value: fmtFCFA(totalDeps),  sub: `vs ${fmtFCFA(prevDeps)} ${t('dir.prevMonth')}` },
    { label: t('dir.margeBrute'), value: `${marge}%`,         sub: fmtFCFA(ca - totalDeps) },
  ]

  return (
    <ERPPageLayout
      title={t('dir.title')}
      subtitle={t('dir.subtitle')}
      icon={<BarChart2 size={18} />}
      color="#F59E0B"
      kpis={kpis}
    >
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* Alertes */}
        <ERPSectionCard title={t('dir.alerts.title')} className="lg:col-span-2">
          {alerts.length === 0 ? (
            <div className="flex items-center gap-3 p-4 text-green-700 bg-green-50 rounded-xl m-4">
              <CheckCircle size={16} />
              <span className="text-sm font-medium">{t('dir.alerts.none')}</span>
            </div>
          ) : (
            <div className="divide-y divide-[#E2E8F0]">
              {alerts.map((a, i) => (
                <Link key={i} href={a.href} className="flex items-center gap-3 px-5 py-3 hover:bg-[#F8FAFC] transition-colors">
                  <ERPStatusBadge status={a.level === 'error' ? 'error' : a.level === 'warning' ? 'warning' : 'info'} label={a.level} />
                  <span className="flex-1 text-[13px] text-[#0F172A]">{a.message}</span>
                  <ArrowRight size={14} className="text-[#94A3B8]" />
                </Link>
              ))}
            </div>
          )}
        </ERPSectionCard>

        {/* Accès rapide */}
        <ERPSectionCard title={t('dir.quickAccess')}>
          <div className="p-4 grid grid-cols-2 gap-2">
            {quickLinks.map(l => (
              <Link
                key={l.href}
                href={l.href}
                className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-[#E2E8F0] hover:border-amber-200 hover:bg-amber-50 transition-colors text-[12px] font-semibold text-[#0F172A]"
              >
                <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: l.color }} />
                {l.label}
              </Link>
            ))}
          </div>
        </ERPSectionCard>

        {/* Résumé financier */}
        <ERPSectionCard title={t('dir.financialSummary')} className="lg:col-span-3">
          <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-[#E2E8F0]">
            {financialRows.map((item, i) => (
              <div key={i} className="p-5 text-center">
                <p className="text-[18px] font-bold text-[#0F172A] tabular-nums">{item.value}</p>
                <p className="text-[12px] font-semibold text-[#0F172A] mt-1">{item.label}</p>
                <p className="text-[11px] text-[#64748B] mt-0.5">{item.sub}</p>
              </div>
            ))}
          </div>
        </ERPSectionCard>

      </div>
    </ERPPageLayout>
  )
}

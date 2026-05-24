/**
 * Direction Générale — page universelle (tous secteurs)
 * Pilotage stratégique : KPIs, finances, RH, alertes.
 */

import { createSupabaseServerClient } from '@/lib/supabase-client-server'
import ERPPageLayout, {
  ERPKpiGrid, ERPSectionCard, ERPStatusBadge,
  type ERPKpi,
} from '@/components/ui/ERPPageLayout'
import { BarChart2, TrendingUp, Users, AlertTriangle, CheckCircle, ArrowRight } from 'lucide-react'
import Link from 'next/link'
import { redirect } from 'next/navigation'

function fmtFCFA(n: number) {
  return new Intl.NumberFormat('fr-FR').format(Math.round(n)) + ' FCFA'
}

function pct(a: number, b: number) {
  if (b === 0) return 0
  return Math.round(((a - b) / b) * 100)
}

export default async function DirectionPage() {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('tenant_id, role, ecole_role')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (!profile) redirect('/login')
  const tenantId = profile.tenant_id

  // ── Données financières ──────────────────────────────────────────────────

  const now        = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
  const prevStart  = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString()
  const prevEnd    = new Date(now.getFullYear(), now.getMonth(), 0).toISOString()

  const [factures, prevFactures, employees, depenses, prevDepenses] = await Promise.all([
    supabase
      .from('factures')
      .select('montant_ttc, statut')
      .eq('tenant_id', tenantId)
      .gte('created_at', monthStart),
    supabase
      .from('factures')
      .select('montant_ttc, statut')
      .eq('tenant_id', tenantId)
      .gte('created_at', prevStart)
      .lte('created_at', prevEnd),
    supabase
      .from('employees')
      .select('id, statut')
      .eq('tenant_id', tenantId),
    supabase
      .from('depenses')
      .select('montant')
      .eq('tenant_id', tenantId)
      .gte('created_at', monthStart),
    supabase
      .from('depenses')
      .select('montant')
      .eq('tenant_id', tenantId)
      .gte('created_at', prevStart)
      .lte('created_at', prevEnd),
  ])

  const factureRows    = factures.data ?? []
  const prevFactRows   = prevFactures.data ?? []
  const employeeRows   = employees.data ?? []
  const depenseRows    = depenses.data ?? []
  const prevDepRows    = prevDepenses.data ?? []

  const ca         = factureRows.reduce((s, f) => s + (f.montant_ttc ?? 0), 0)
  const prevCA     = prevFactRows.reduce((s, f) => s + (f.montant_ttc ?? 0), 0)
  const caCollecte = factureRows.filter(f => f.statut === 'payee').reduce((s, f) => s + (f.montant_ttc ?? 0), 0)
  const facImpayees= factureRows.filter(f => f.statut === 'envoyee').length
  const totalDeps  = depenseRows.reduce((s, d) => s + (d.montant ?? 0), 0)
  const prevDeps   = prevDepRows.reduce((s, d) => s + (d.montant ?? 0), 0)
  const activeEmps = employeeRows.filter(e => e.statut === 'actif').length
  const totalEmps  = employeeRows.length

  const caGrowth   = pct(ca, prevCA)
  const depGrowth  = pct(totalDeps, prevDeps)
  const marge      = ca > 0 ? Math.round(((ca - totalDeps) / ca) * 100) : 0

  // ── KPIs ─────────────────────────────────────────────────────────────────

  const kpis: ERPKpi[] = [
    {
      label: "Chiffre d'affaires (mois)",
      value: fmtFCFA(ca),
      sub:   `Collecté : ${fmtFCFA(caCollecte)}`,
      color: '#F59E0B',
      icon:  <TrendingUp size={16} />,
      trend: { value: Math.abs(caGrowth), positive: caGrowth >= 0 },
    },
    {
      label: 'Charges du mois',
      value: fmtFCFA(totalDeps),
      sub:   `Marge brute : ${marge}%`,
      color: depGrowth > 10 ? '#DC2626' : '#64748B',
      icon:  <BarChart2 size={16} />,
      trend: { value: Math.abs(depGrowth), positive: depGrowth <= 0 },
    },
    {
      label: 'Effectif actif',
      value: `${activeEmps} / ${totalEmps}`,
      sub:   'Collaborateurs',
      color: '#2563EB',
      icon:  <Users size={16} />,
    },
    {
      label: 'Factures impayées',
      value: facImpayees,
      sub:   'À relancer',
      color: facImpayees > 5 ? '#DC2626' : '#16A34A',
      icon:  <AlertTriangle size={16} />,
    },
  ]

  // ── Alertes & actions rapides ────────────────────────────────────────────

  const alerts: { level: 'warning' | 'error' | 'info'; message: string; href: string }[] = []
  if (facImpayees > 0) {
    alerts.push({ level: 'warning', message: `${facImpayees} facture(s) impayée(s)`, href: '/dashboard/facturation' })
  }
  if (marge < 10 && ca > 0) {
    alerts.push({ level: 'error', message: 'Marge brute critique (< 10%)', href: '/dashboard/finance' })
  }
  if (totalEmps === 0) {
    alerts.push({ level: 'info', message: 'Aucun employé enregistré', href: '/dashboard/rh' })
  }

  const quickLinks = [
    { label: 'RH & Paie',          href: '/dashboard/rh',           color: '#64748B' },
    { label: 'Finance',             href: '/dashboard/finance',       color: '#F59E0B' },
    { label: 'Comptabilité',        href: '/dashboard/comptabilite',  color: '#64748B' },
    { label: 'Trésorerie',          href: '/dashboard/tresorerie',    color: '#64748B' },
    { label: 'Facturation',         href: '/dashboard/facturation',   color: '#F59E0B' },
    { label: 'Analytics',           href: '/dashboard/analytics',     color: '#2563EB' },
  ]

  return (
    <ERPPageLayout
      title="Direction Générale"
      subtitle="Pilotage stratégique & tableaux de bord"
      icon={<BarChart2 size={18} />}
      color="#F59E0B"
      kpis={kpis}
    >
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* Alertes */}
        <ERPSectionCard title="Alertes & points d'attention" className="lg:col-span-2">
          {alerts.length === 0 ? (
            <div className="flex items-center gap-3 p-4 text-green-700 bg-green-50 rounded-xl m-4">
              <CheckCircle size={16} />
              <span className="text-sm font-medium">Aucune alerte — tous les indicateurs sont au vert</span>
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
        <ERPSectionCard title="Accès rapide">
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
        <ERPSectionCard title="Résumé financier du mois" className="lg:col-span-3">
          <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-[#E2E8F0]">
            {[
              { label: "CA total",      value: fmtFCFA(ca),         sub: `vs ${fmtFCFA(prevCA)} mois préc.` },
              { label: 'CA collecté',   value: fmtFCFA(caCollecte), sub: `${ca > 0 ? Math.round(caCollecte / ca * 100) : 0}% du CA` },
              { label: 'Charges',       value: fmtFCFA(totalDeps),  sub: `vs ${fmtFCFA(prevDeps)} mois préc.` },
              { label: 'Marge brute',   value: `${marge}%`,         sub: fmtFCFA(ca - totalDeps) },
            ].map((item, i) => (
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

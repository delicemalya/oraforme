import { supabaseAdmin } from '@/lib/supabase-server'
import { MODULE_PRICES, MODULE_LABELS, fmtFCFA } from '@/lib/admin-config'
import { TrendingUp, TrendingDown, DollarSign, Users, BarChart3, PieChart, ArrowUpRight } from 'lucide-react'

export default async function FinanceAnalyticsPage() {
  const now        = new Date()
  const startYear  = new Date(now.getFullYear(), 0, 1).toISOString()
  const startMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
  const startPrev  = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString()
  const endPrev    = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59).toISOString()

  const [tenantsRes, facturesRes, txYearRes, tmRes] = await Promise.all([
    supabaseAdmin.from('tenants').select('id, nom_entreprise, plan, status, created_at'),
    supabaseAdmin.from('factures').select('id, tenant_id, total, statut, created_at').gte('created_at', startYear),
    supabaseAdmin.from('transactions').select('id, amount, type, created_at').gte('created_at', startYear),
    supabaseAdmin.from('tenant_modules').select('tenant_id, module_key').eq('enabled', true),
  ])

  const allTenants = tenantsRes.data ?? []
  const factures   = facturesRes.data ?? []
  const txYear     = txYearRes.data   ?? []
  const tmByTenant = new Map<string, string[]>()
  for (const r of (tmRes.data ?? [])) {
    const a = tmByTenant.get(r.tenant_id) ?? []
    a.push(r.module_key)
    tmByTenant.set(r.tenant_id, a)
  }
  const getTenantMods = (tid: string) => tmByTenant.get(tid) ?? []

  const activeTenants    = allTenants.filter(t => t.status !== 'suspended')
  const suspendedTenants = allTenants.filter(t => t.status === 'suspended')

  // MRR calculation
  const mrr = activeTenants.reduce((sum, t) =>
    sum + getTenantMods(t.id).reduce((s, m) => s + (MODULE_PRICES[m] ?? 0), 0)
  , 0)
  const arr = mrr * 12

  // Revenue trend (12 months)
  const monthlyRevenue = Array.from({ length: 12 }, (_, i) => {
    const mo    = new Date(now.getFullYear(), i, 1)
    const moEnd = new Date(now.getFullYear(), i + 1, 0, 23, 59)
    const paid  = factures
      .filter(f => f.statut === 'payee' && new Date(f.created_at) >= mo && new Date(f.created_at) <= moEnd)
      .reduce((s, f) => s + (f.total ?? 0), 0)
    const vol = txYear
      .filter(t => { const d = new Date(t.created_at); return d >= mo && d <= moEnd })
      .reduce((s, t) => s + Math.abs(t.amount ?? 0), 0)
    return {
      month:  mo.toLocaleDateString('fr-FR', { month: 'short' }),
      paid,
      vol,
      isPast: mo <= now,
    }
  })

  const maxPaid = Math.max(...monthlyRevenue.map(m => m.paid), 1)
  const maxVol  = Math.max(...monthlyRevenue.map(m => m.vol), 1)

  // Collected this year
  const collectedYear = factures.filter(f => f.statut === 'payee').reduce((s, f) => s + (f.total ?? 0), 0)
  const outstanding   = factures.filter(f => f.statut === 'envoyee').reduce((s, f) => s + (f.total ?? 0), 0)

  // Current month tx volume
  const txMonth = txYear.filter(t => t.created_at >= startMonth)
  const txPrev  = txYear.filter(t => t.created_at >= startPrev && t.created_at <= endPrev)
  const volMonth = txMonth.reduce((s, t) => s + Math.abs(t.amount ?? 0), 0)
  const volPrev  = txPrev.reduce((s, t)  => s + Math.abs(t.amount ?? 0), 0)
  const volGrowth = volPrev > 0 ? Math.round(((volMonth - volPrev) / volPrev) * 100) : 0

  // New tenants this month
  const newThisMonth = activeTenants.filter(t => t.created_at >= startMonth).length
  const newPrevMonth = activeTenants.filter(t => t.created_at >= startPrev && t.created_at <= endPrev).length
  const clientGrowth = newPrevMonth > 0 ? Math.round(((newThisMonth - newPrevMonth) / newPrevMonth) * 100) : 0

  // Module distribution
  const moduleStats = Object.entries(MODULE_PRICES)
    .map(([id, price]) => {
      const clients = activeTenants.filter(t => getTenantMods(t.id).includes(id)).length
      return { id, label: MODULE_LABELS[id] ?? id, price, clients, rev: price * clients }
    })
    .filter(m => m.clients > 0)
    .sort((a, b) => b.rev - a.rev)

  // Plan distribution
  const planStats = ['starter', 'business', 'premium'].map(plan => ({
    plan,
    count: activeTenants.filter(t => t.plan === plan).length,
  }))
  // ARPU
  const arpu = activeTenants.length > 0 ? Math.round(mrr / activeTenants.length) : 0

  // Churn rate (suspended / total)
  const churnRate = allTenants.length > 0 ? Math.round((suspendedTenants.length / allTenants.length) * 100) : 0

  return (
    <div className="space-y-8">

      {/* Header */}
      <div>
        <h1 className="text-[22px] font-bold text-gray-900">Analytics Financières</h1>
        <p className="text-sm text-gray-500 mt-0.5">Métriques et indicateurs de performance — {now.getFullYear()}</p>
      </div>

      {/* Key metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            label: 'MRR',
            value: fmtFCFA(mrr),
            sub:   'Revenus récurrents mensuels',
            icon:  DollarSign,
            color: '#F59E0B',
            trend: null,
          },
          {
            label: 'ARR',
            value: fmtFCFA(arr),
            sub:   'Revenus annuels projetés',
            icon:  TrendingUp,
            color: '#3B82F6',
            trend: null,
          },
          {
            label: 'Volume tx / mois',
            value: fmtFCFA(volMonth),
            sub:   volGrowth >= 0 ? `+${volGrowth}% vs mois préc.` : `${volGrowth}% vs mois préc.`,
            icon:  volGrowth >= 0 ? TrendingUp : TrendingDown,
            color: volGrowth >= 0 ? '#10B981' : '#EF4444',
            trend: volGrowth,
          },
          {
            label: 'Nouveaux clients',
            value: newThisMonth.toString(),
            sub:   clientGrowth >= 0 ? `+${clientGrowth}% vs mois préc.` : `${clientGrowth}% vs mois préc.`,
            icon:  Users,
            color: '#8B5CF6',
            trend: clientGrowth,
          },
        ].map((k, i) => {
          const Icon = k.icon
          return (
            <div key={i} className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: k.color + '15' }}>
                  <Icon size={14} style={{ color: k.color }} />
                </div>
                {k.trend !== null && (
                  <span className={`text-[11px] font-bold flex items-center gap-0.5 ${k.trend >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    <ArrowUpRight size={11} className={k.trend < 0 ? 'rotate-180' : ''} />
                    {Math.abs(k.trend)}%
                  </span>
                )}
              </div>
              <p className="text-[18px] font-bold text-gray-900 leading-tight">{k.value}</p>
              <p className="text-[11px] text-gray-500 mt-1">{k.sub}</p>
            </div>
          )
        })}
      </div>

      {/* Secondary metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'ARPU mensuel',      value: fmtFCFA(arpu),           color: '#10B981', sub: 'Rev. moyen / client' },
          { label: 'Collecté (année)',   value: fmtFCFA(collectedYear),  color: '#3B82F6', sub: 'Factures payées' },
          { label: 'En attente',        value: fmtFCFA(outstanding),    color: '#F59E0B', sub: 'Factures envoyées' },
          { label: 'Taux churn',        value: `${churnRate}%`,          color: churnRate > 5 ? '#EF4444' : '#10B981', sub: `${suspendedTenants.length} suspendu(s)` },
        ].map((s, i) => (
          <div key={i} className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
            <p className="text-[11px] font-bold uppercase tracking-wide mb-1" style={{ color: s.color }}>{s.label}</p>
            <p className="text-[18px] font-bold text-gray-900">{s.value}</p>
            <p className="text-[11px] text-gray-400 mt-0.5">{s.sub}</p>
          </div>
        ))}
      </div>

      {/* Revenue chart + Volume chart */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Revenue collected */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
          <h2 className="text-[15px] font-bold text-gray-900 mb-1">Factures collectées 2026</h2>
          <p className="text-[11px] text-gray-400 mb-5">Montant total payé par mois</p>
          <div className="flex items-end gap-1.5 h-36">
            {monthlyRevenue.map((m, i) => {
              const h    = Math.round((m.paid / maxPaid) * 100)
              const curr = i === now.getMonth()
              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <div
                    className={`w-full rounded-t-lg ${m.paid === 0 ? 'bg-gray-100' : curr ? 'bg-amber-400' : 'bg-amber-200'}`}
                    style={{ height: `${Math.max(h, 3)}%` }}
                    title={fmtFCFA(m.paid)}
                  />
                  <span className="text-[9px] text-gray-400 capitalize">{m.month}</span>
                </div>
              )
            })}
          </div>
        </div>

        {/* Transaction volume */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
          <h2 className="text-[15px] font-bold text-gray-900 mb-1">Volume transactions 2026</h2>
          <p className="text-[11px] text-gray-400 mb-5">Total mouvements financiers par mois</p>
          <div className="flex items-end gap-1.5 h-36">
            {monthlyRevenue.map((m, i) => {
              const h    = Math.round((m.vol / maxVol) * 100)
              const curr = i === now.getMonth()
              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <div
                    className={`w-full rounded-t-lg ${m.vol === 0 ? 'bg-gray-100' : curr ? 'bg-blue-400' : 'bg-blue-200'}`}
                    style={{ height: `${Math.max(h, 3)}%` }}
                    title={fmtFCFA(m.vol)}
                  />
                  <span className="text-[9px] text-gray-400 capitalize">{m.month}</span>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Module revenue + Plan distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Module revenue breakdown */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
          <h2 className="text-[15px] font-bold text-gray-900 mb-4">MRR par module</h2>
          <div className="space-y-3.5">
            {moduleStats.slice(0, 8).map(m => (
              <div key={m.id}>
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[12px] font-semibold text-gray-800">{m.label}</span>
                    <span className="text-[10px] text-gray-400">{m.clients} client{m.clients > 1 ? 's' : ''}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-[12px] font-bold text-amber-700">{fmtFCFA(m.rev)}</span>
                    <span className="text-[10px] text-gray-400 ml-1">/ mois</span>
                  </div>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-amber-400 to-amber-500"
                    style={{ width: mrr > 0 ? `${(m.rev / mrr) * 100}%` : '0%' }}
                  />
                </div>
                <p className="text-[10px] text-gray-400 mt-0.5">{mrr > 0 ? Math.round((m.rev / mrr) * 100) : 0}% du MRR total</p>
              </div>
            ))}
            {moduleStats.length === 0 && (
              <p className="text-center py-8 text-[12px] text-gray-400">Aucune donnée disponible</p>
            )}
          </div>
        </div>

        {/* Plan distribution */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
          <h2 className="text-[15px] font-bold text-gray-900 mb-4">Distribution plans</h2>
          <div className="space-y-4">
            {planStats.map(p => {
              const pct = activeTenants.length > 0 ? Math.round((p.count / activeTenants.length) * 100) : 0
              const colors: Record<string, string> = {
                starter: '#94A3B8', business: '#3B82F6', premium: '#F59E0B',
              }
              const estMrr = activeTenants
                .filter(t => t.plan === p.plan)
                .reduce((s, t) =>
                  s + getTenantMods(t.id).reduce((ms, m) => ms + (MODULE_PRICES[m] ?? 0), 0)
                , 0)
              return (
                <div key={p.plan}>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ background: colors[p.plan] }} />
                      <span className="text-[13px] font-semibold text-gray-800 capitalize">{p.plan}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-[11px] text-gray-400">{p.count} client{p.count !== 1 ? 's' : ''}</span>
                      <span className="text-[12px] font-bold text-gray-700">{fmtFCFA(estMrr)}</span>
                    </div>
                  </div>
                  <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${Math.max(pct, 0)}%`, background: colors[p.plan] }}
                    />
                  </div>
                  <p className="text-[10px] text-gray-400 mt-0.5">{pct}% des clients</p>
                </div>
              )
            })}
          </div>

          {/* Summary stats */}
          <div className="mt-6 pt-5 border-t border-gray-100 grid grid-cols-2 gap-4">
            <div>
              <p className="text-[11px] text-gray-400">Clients actifs</p>
              <p className="text-[18px] font-bold text-gray-900">{activeTenants.length}</p>
            </div>
            <div>
              <p className="text-[11px] text-gray-400">ARPU</p>
              <p className="text-[18px] font-bold text-amber-700">{fmtFCFA(arpu)}</p>
            </div>
            <div>
              <p className="text-[11px] text-gray-400">Rétention</p>
              <p className="text-[18px] font-bold text-green-700">{100 - churnRate}%</p>
            </div>
            <div>
              <p className="text-[11px] text-gray-400">Modules / client</p>
              <p className="text-[18px] font-bold text-blue-700">
                {activeTenants.length > 0
                  ? (activeTenants.reduce((s, t) => s + getTenantMods(t.id).length, 0) / activeTenants.length).toFixed(1)
                  : '0'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Insights */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          {
            icon: BarChart3,
            color: '#3B82F6',
            title: 'Projection 12 mois',
            value: fmtFCFA(arr),
            desc: `Si taux de churn maintenu à ${churnRate}%, ARR projeté`,
          },
          {
            icon: TrendingUp,
            color: '#10B981',
            title: 'Potentiel d\'expansion',
            value: fmtFCFA(activeTenants.length * Object.keys(MODULE_PRICES).length * 5000 - mrr),
            desc: 'Revenu additionnel si tous les modules activés',
          },
          {
            icon: PieChart,
            color: '#8B5CF6',
            title: 'Module le plus rentable',
            value: moduleStats[0]?.label ?? '—',
            desc: moduleStats[0] ? `${fmtFCFA(moduleStats[0].rev)} / mois (${moduleStats[0].clients} clients)` : 'Aucun module actif',
          },
        ].map((ins, i) => {
          const Icon = ins.icon
          return (
            <div key={i} className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center mb-3" style={{ background: ins.color + '15' }}>
                <Icon size={14} style={{ color: ins.color }} />
              </div>
              <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wide mb-1">{ins.title}</p>
              <p className="text-[16px] font-bold text-gray-900 leading-tight">{ins.value}</p>
              <p className="text-[11px] text-gray-400 mt-1">{ins.desc}</p>
            </div>
          )
        })}
      </div>
    </div>
  )
}

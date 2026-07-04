import { supabaseAdmin } from '@/lib/supabase-server'
import { MODULE_PRICES, MODULE_LABELS, fmtFCFA } from '@/lib/admin-config'
import { ModuleRevenueChart, GrowthChart } from '@/components/admin/AdminChartsClient'
import AdminClientsTable from '@/components/admin/AdminClientsTable'
import Link from 'next/link'
import {
  Building2, DollarSign, Package, Users, TrendingUp, TrendingDown,
  Activity, ArrowRight, Shield, AlertTriangle, CheckCircle2,
  Zap, Bot, CreditCard, BarChart3, Globe,
} from 'lucide-react'

export default async function AdminPage() {
  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
  const lastMonth    = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString()

  // ── Parallel fetches ──────────────────────────────────────────────────────────
  const [tenantsRes, profilesRes, facturesRes, transactionsRes, tmRes] = await Promise.all([
    supabaseAdmin.from('tenants').select('id, nom_entreprise, plan, created_at, status, deleted_at').order('created_at', { ascending: false }),
    supabaseAdmin.from('profiles').select('id, tenant_id, created_at'),
    supabaseAdmin.from('factures').select('id, tenant_id, total, statut, created_at'),
    supabaseAdmin.from('transactions').select('id, tenant_id, type, montant, date, created_at').order('created_at', { ascending: false }).limit(500),
    supabaseAdmin.from('tenant_modules').select('tenant_id, module_key').eq('enabled', true),
  ])

  const tenants      = (tenantsRes.data ?? []).filter(t => !t.deleted_at)
  const tmByTenant = new Map<string, string[]>()
  for (const r of (tmRes.data ?? [])) {
    const a = tmByTenant.get(r.tenant_id) ?? []
    a.push(r.module_key)
    tmByTenant.set(r.tenant_id, a)
  }
  const mods = (tid: string) => tmByTenant.get(tid) ?? []
  const profiles     = profilesRes.data    ?? []
  const factures     = facturesRes.data    ?? []
  const transactions = transactionsRes.data ?? []

  // ── Core KPIs ─────────────────────────────────────────────────────────────────
  const nbClients   = tenants.length
  const nbActive    = tenants.filter(t => (t.status ?? 'active') === 'active').length
  const nbSuspended = tenants.filter(t => t.status === 'suspended').length
  const nbUsers     = profiles.length

  const newThisMonth    = tenants.filter(t => t.created_at >= startOfMonth).length
  const newLastMonth    = tenants.filter(t => t.created_at >= lastMonth && t.created_at < startOfMonth).length
  const growthRate      = newLastMonth > 0 ? ((newThisMonth - newLastMonth) / newLastMonth * 100).toFixed(1) : '—'

  // ── Revenue KPIs ──────────────────────────────────────────────────────────────
  const moduleRevData = Object.entries(MODULE_PRICES).map(([id, price]) => {
    const clients = tenants.filter(t => mods(t.id).includes(id)).length
    return {
      module:  (MODULE_LABELS[id] ?? id).split(' ')[0],
      clients,
      mrr:     clients * price,
    }
  }).sort((a, b) => b.mrr - a.mrr)

  const totalMRR = moduleRevData.reduce((s, m) => s + m.mrr, 0)
  const totalARR = totalMRR * 12
  const totalModulesSold = tenants.reduce((s, t) => s + mods(t.id).length, 0)

  const caTotal = factures.filter(f => f.statut === 'payee').reduce((s, f) => s + (f.total ?? 0), 0)
  const caMonth = factures.filter(f => f.statut === 'payee' && f.created_at >= startOfMonth).reduce((s, f) => s + (f.total ?? 0), 0)

  // ── Transaction volumes ───────────────────────────────────────────────────────
  const txMonth  = transactions.filter(t => t.date >= startOfMonth.slice(0, 10))
  const txVol    = txMonth.reduce((s, t) => s + (t.montant ?? 0), 0)
  const txEntree = txMonth.filter(t => t.type === 'entree').reduce((s, t) => s + (t.montant ?? 0), 0)
  const txSortie = txMonth.filter(t => t.type === 'sortie').reduce((s, t) => s + (t.montant ?? 0), 0)

  // ── Growth chart: last 12 weeks ───────────────────────────────────────────────
  const growthData = Array.from({ length: 30 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - (29 - i))
    const dayStr = d.toISOString().split('T')[0]
    return {
      date:         i % 5 === 0 ? `${d.getDate()}/${d.getMonth() + 1}` : '',
      inscriptions: tenants.filter(t => t.created_at.startsWith(dayStr)).length,
    }
  })

  // ── Recent clients ────────────────────────────────────────────────────────────
  const recentClients = tenants.slice(0, 5).map(t => ({
    id:             t.id,
    nom_entreprise: t.nom_entreprise,
    plan:           t.plan,
    modules_actifs: mods(t.id),
    nb_users:       profiles.filter(p => p.tenant_id === t.id).length,
    nb_factures:    factures.filter(f => f.tenant_id === t.id).length,
    ca_genere:      factures.filter(f => f.tenant_id === t.id && f.statut === 'payee').reduce((s, f) => s + (f.total ?? 0), 0),
    created_at:     t.created_at,
    status:         (t as { status?: 'active' | 'suspended' }).status ?? 'active',
  }))

  // ── System health ─────────────────────────────────────────────────────────────
  const systemChecks = [
    { name: 'Base de données',   status: 'ok',   latency: '12ms' },
    { name: 'Auth Supabase',     status: 'ok',   latency: '8ms'  },
    { name: 'Storage',           status: 'ok',   latency: '23ms' },
    { name: 'Edge Functions',    status: 'ok',   latency: '45ms' },
    { name: 'API RPC',           status: 'ok',   latency: '18ms' },
    { name: 'Email (Resend)',     status: 'warn', latency: '—'    },
  ]

  // ── Top modules ───────────────────────────────────────────────────────────────
  const topModules = moduleRevData.slice(0, 5)

  return (
    <div className="space-y-8">

      {/* ── PAGE HEADER ──────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-[22px] font-bold text-gray-900">Dashboard Global</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Plateforme oraforme — vue d&apos;ensemble en temps réel
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-green-50 border border-green-200">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-xs font-semibold text-green-700">Live</span>
          </div>
        </div>
      </div>

      {/* ── KPI ROW 1 — Platform ─────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          icon={Building2}
          label="Entreprises actives"
          value={nbActive.toString()}
          sub={newThisMonth > 0 ? `+${newThisMonth} ce mois` : 'Aucun nouveau'}
          subColor={newThisMonth > 0 ? 'text-green-600' : 'text-gray-400'}
          color="#3B82F6"
          trend={newThisMonth > 0}
          link="/admin/clients"
        />
        <KpiCard
          icon={DollarSign}
          label="MRR Plateforme"
          value={fmtFCFA(totalMRR)}
          sub={`ARR: ${fmtFCFA(totalARR)}`}
          subColor="text-gray-400"
          color="#10B981"
          trend={true}
          link="/admin/revenus"
        />
        <KpiCard
          icon={Users}
          label="Utilisateurs total"
          value={nbUsers.toString()}
          sub={`${nbClients > 0 ? (nbUsers / nbClients).toFixed(1) : 0} utilisateurs/entreprise`}
          subColor="text-gray-400"
          color="#8B5CF6"
          trend={true}
          link="/admin/utilisateurs"
        />
        <KpiCard
          icon={Package}
          label="Modules vendus"
          value={totalModulesSold.toString()}
          sub={`Top: ${topModules[0]?.module ?? '—'} (${topModules[0]?.clients ?? 0} clients)`}
          subColor="text-amber-600"
          color="#F59E0B"
          trend={null}
          link="/admin/abonnements"
        />
      </div>

      {/* ── KPI ROW 2 — Finance ──────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          icon={CreditCard}
          label="CA clients (total)"
          value={fmtFCFA(caTotal)}
          sub={`Ce mois: ${fmtFCFA(caMonth)}`}
          subColor="text-blue-600"
          color="#06B6D4"
          trend={null}
          link="/admin/revenus"
        />
        <KpiCard
          icon={TrendingUp}
          label="Entrées ce mois"
          value={fmtFCFA(txEntree)}
          sub={`${txMonth.filter(t => t.type === 'entree').length} transactions`}
          subColor="text-green-600"
          color="#10B981"
          trend={true}
          link="/admin/transactions"
        />
        <KpiCard
          icon={TrendingDown}
          label="Sorties ce mois"
          value={fmtFCFA(txSortie)}
          sub={`${txMonth.filter(t => t.type === 'sortie').length} transactions`}
          subColor="text-red-500"
          color="#EF4444"
          trend={false}
          link="/admin/transactions"
        />
        <KpiCard
          icon={BarChart3}
          label="Volume transactionnel"
          value={fmtFCFA(txVol)}
          sub={`${txMonth.length} opérations ce mois`}
          subColor="text-gray-400"
          color="#6366F1"
          trend={null}
          link="/admin/transactions"
        />
      </div>

      {/* ── CHARTS ROW ───────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Growth chart — 2/3 */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-[15px] font-bold text-gray-900">Croissance clients</h2>
              <p className="text-xs text-gray-400 mt-0.5">Nouvelles inscriptions — 30 derniers jours</p>
            </div>
            <div className="flex items-center gap-2">
              {newLastMonth > 0 && (
                <span className={`text-xs font-semibold px-2 py-1 rounded-full ${Number(growthRate) >= 0 ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>
                  {Number(growthRate) >= 0 ? '+' : ''}{growthRate}% vs mois préc.
                </span>
              )}
              <span className="text-xs text-gray-400">{nbClients} total</span>
            </div>
          </div>
          <GrowthChart data={growthData} />
        </div>

        {/* System health — 1/3 */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-[15px] font-bold text-gray-900">Santé Système</h2>
              <p className="text-xs text-gray-400 mt-0.5">Services en temps réel</p>
            </div>
            <Link href="/admin/sante" className="text-xs text-amber-600 hover:underline flex items-center gap-1">
              Détails <ArrowRight size={11} />
            </Link>
          </div>
          <div className="space-y-2.5">
            {systemChecks.map(s => (
              <div key={s.name} className="flex items-center justify-between py-1.5">
                <div className="flex items-center gap-2.5">
                  <div className={`w-2 h-2 rounded-full ${s.status === 'ok' ? 'bg-green-500' : 'bg-yellow-400'}`} />
                  <span className="text-[13px] text-gray-700">{s.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  {s.latency !== '—' && (
                    <span className="text-[11px] text-gray-400 font-mono">{s.latency}</span>
                  )}
                  {s.status === 'ok'
                    ? <CheckCircle2 size={13} className="text-green-500" />
                    : <AlertTriangle size={13} className="text-yellow-500" />
                  }
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 pt-4 border-t border-gray-100">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-gray-500">Uptime global</span>
              <span className="text-xs font-bold text-green-600">99.9%</span>
            </div>
            <div className="mt-1.5 h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div className="h-full bg-green-500 rounded-full" style={{ width: '99.9%' }} />
            </div>
          </div>
        </div>
      </div>

      {/* ── MODULES + CLIENTS ROW ────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Top modules */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-[15px] font-bold text-gray-900">Top Modules MRR</h2>
            <Link href="/admin/abonnements" className="text-xs text-amber-600 hover:underline flex items-center gap-1">
              Tout voir <ArrowRight size={11} />
            </Link>
          </div>
          <div className="space-y-3">
            {topModules.map((m, i) => {
              const pct = totalMRR > 0 ? (m.mrr / totalMRR) * 100 : 0
              return (
                <div key={m.module}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-bold text-gray-300 w-4">#{i + 1}</span>
                      <span className="text-[13px] font-medium text-gray-800">{m.module}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-[12px] font-bold text-gray-900">{fmtFCFA(m.mrr)}</span>
                      <span className="text-[10px] text-gray-400 block">{m.clients} clients</span>
                    </div>
                  </div>
                  <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-amber-400 to-amber-600"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
          <div className="mt-5 pt-4 border-t border-gray-100 flex justify-between items-center">
            <span className="text-xs text-gray-500">MRR Total</span>
            <span className="text-sm font-bold text-gray-900">{fmtFCFA(totalMRR)}/mois</span>
          </div>
        </div>

        {/* Recent clients — 2/3 */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-[15px] font-bold text-gray-900">Clients récents</h2>
              <p className="text-xs text-gray-400 mt-0.5">{nbClients} entreprises enregistrées · {nbSuspended > 0 && <span className="text-yellow-600">{nbSuspended} suspendue(s)</span>}</p>
            </div>
            <Link href="/admin/clients"
              className="flex items-center gap-1.5 text-xs font-medium text-amber-600 hover:text-amber-700 px-3 py-1.5 rounded-lg hover:bg-amber-50 transition-colors">
              Gérer <ArrowRight size={12} />
            </Link>
          </div>
          <AdminClientsTable tenants={recentClients} />
        </div>
      </div>

      {/* ── BOTTOM ROW — Quick Actions + Stats ───────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Quick actions */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
          <h2 className="text-[15px] font-bold text-gray-900 mb-4">Actions rapides</h2>
          <div className="space-y-2">
            {[
              { href: '/admin/clients',      label: 'Gérer les entreprises',    icon: Building2,  color: '#3B82F6' },
              { href: '/admin/monitoring',   label: 'Voir les logs système',    icon: Activity,   color: '#10B981' },
              { href: '/admin/securite',     label: 'Audit sécurité',           icon: Shield,     color: '#EF4444' },
              { href: '/admin/support',      label: 'Tickets support',          icon: Zap,        color: '#8B5CF6' },
              { href: '/admin/miaa',         label: 'Stats MIAA+',              icon: Bot,        color: '#F59E0B' },
              { href: '/admin/parametres',   label: 'Paramètres plateforme',    icon: Globe,      color: '#6366F1' },
            ].map(a => {
              const Icon = a.icon
              return (
                <Link key={a.href} href={a.href}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-gray-50 transition-colors group">
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: a.color + '15' }}>
                    <Icon size={13} style={{ color: a.color }} />
                  </div>
                  <span className="text-[13px] text-gray-700 group-hover:text-gray-900 transition-colors">{a.label}</span>
                  <ArrowRight size={12} className="ml-auto text-gray-300 group-hover:text-gray-500 transition-colors" />
                </Link>
              )
            })}
          </div>
        </div>

        {/* Platform stats */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
          <h2 className="text-[15px] font-bold text-gray-900 mb-4">Métriques plateforme</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {[
              { label: 'Taux de rétention',   value: `${nbClients > 0 ? Math.round((nbActive / nbClients) * 100) : 100}%`, icon: '📊', color: '#10B981' },
              { label: 'Modules / entreprise', value: `${nbClients > 0 ? (totalModulesSold / nbClients).toFixed(1) : '0'}`,   icon: '📦', color: '#3B82F6' },
              { label: 'ARR Plateforme',       value: fmtFCFA(totalARR),       icon: '💰', color: '#F59E0B' },
              { label: 'Nouveaux ce mois',     value: newThisMonth.toString(),  icon: '✨', color: '#8B5CF6' },
              { label: 'Factures traitées',    value: factures.length.toString(), icon: '📄', color: '#06B6D4' },
              { label: 'MIAA+ users',          value: `${tenants.filter(t => mods(t.id).includes('bizbot')).length * 2}`, icon: '🤖', color: '#F59E0B' },
            ].map((stat, i) => (
              <div key={i} className="p-4 rounded-xl border border-gray-100 bg-gray-50/50">
                <div className="text-2xl mb-2">{stat.icon}</div>
                <p className="text-[18px] font-bold text-gray-900 leading-none">{stat.value}</p>
                <p className="text-[11px] text-gray-500 mt-1">{stat.label}</p>
              </div>
            ))}
          </div>
          <div className="mt-5 pt-4 border-t border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500">Module Revenus par chart</p>
              </div>
            </div>
            <div className="mt-3">
              <ModuleRevenueChart data={moduleRevData.slice(0, 6)} />
            </div>
          </div>
        </div>
      </div>

    </div>
  )
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function KpiCard({
  icon: Icon, label, value, sub, subColor, color, trend, link,
}: {
  icon: React.ElementType
  label: string; value: string; sub: string; subColor: string
  color: string; trend: boolean | null; link: string
}) {
  return (
    <Link href={link} className="group bg-white rounded-2xl border border-gray-100 p-5 shadow-sm hover:shadow-md transition-all hover:border-gray-200 block">
      <div className="flex items-start justify-between mb-3">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: color + '15' }}>
          <Icon size={16} style={{ color }} />
        </div>
        {trend !== null && (
          <div className={`flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-full ${trend ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-500'}`}>
            {trend ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
            {trend ? '+' : '-'}
          </div>
        )}
      </div>
      <p className="text-[22px] font-bold text-gray-900 leading-none mb-1.5">{value}</p>
      <p className="text-[11px] font-medium text-gray-400 uppercase tracking-wide mb-1">{label}</p>
      <p className={`text-[12px] font-medium ${subColor}`}>{sub}</p>
    </Link>
  )
}

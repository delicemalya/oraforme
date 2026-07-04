import { supabaseAdmin } from '@/lib/supabase-server'
import { MODULE_PRICES, fmtFCFA } from '@/lib/admin-config'
import { GrowthChart, ModuleRevenueChart } from '@/components/admin/AdminChartsClient'
import { TrendingUp, Users, Globe, Zap } from 'lucide-react'

export default async function AnalyticsPage() {
  const now = new Date()

  const [tenantsRes, profilesRes, facturesRes, txRes, tmRes] = await Promise.all([
    supabaseAdmin.from('tenants').select('id, plan, created_at, status').order('created_at'),
    supabaseAdmin.from('profiles').select('id, tenant_id, created_at').order('created_at'),
    supabaseAdmin.from('factures').select('total, statut, created_at'),
    supabaseAdmin.from('transactions').select('type, montant, date'),
    supabaseAdmin.from('tenant_modules').select('tenant_id, module_key').eq('enabled', true),
  ])

  const tenants  = tenantsRes.data  ?? []
  const tmByTenant = new Map<string, string[]>()
  for (const r of (tmRes.data ?? [])) {
    const a = tmByTenant.get(r.tenant_id) ?? []
    a.push(r.module_key)
    tmByTenant.set(r.tenant_id, a)
  }
  const mods = (tid: string) => tmByTenant.get(tid) ?? []
  const profiles = profilesRes.data ?? []
  const factures = facturesRes.data ?? []
  const txAll    = txRes.data       ?? []

  // Growth data — 12 months
  const MONTHS = ['Jan','Fév','Mar','Avr','Mai','Juin','Juil','Aoû','Sep','Oct','Nov','Déc']
  const monthlyData = Array.from({ length: 12 }, (_, i) => {
    const m = new Date(now.getFullYear(), now.getMonth() - (11 - i), 1)
    const monthStr = m.toISOString().slice(0, 7)
    return {
      date:         MONTHS[m.getMonth()],
      inscriptions: tenants.filter(t => t.created_at.startsWith(monthStr)).length,
    }
  })

  // 30-day daily chart
  const dailyData = Array.from({ length: 30 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - (29 - i))
    const dayStr = d.toISOString().split('T')[0]
    return {
      date:         i % 5 === 0 ? `${d.getDate()}/${d.getMonth() + 1}` : '',
      inscriptions: tenants.filter(t => t.created_at.startsWith(dayStr)).length,
    }
  })

  // Module chart
  const moduleData = Object.entries(MODULE_PRICES).map(([id, price]) => {
    const clients = tenants.filter(t => mods(t.id).includes(id)).length
    return { module: id.slice(0, 8), clients, mrr: clients * price }
  }).sort((a, b) => b.mrr - a.mrr).slice(0, 8)

  // Key stats
  const totalMRR = Object.entries(MODULE_PRICES).reduce((s, [id, price]) =>
    s + tenants.filter(t => mods(t.id).includes(id)).length * price, 0)
  const avgModulesPerClient = tenants.length > 0
    ? tenants.reduce((s, t) => s + mods(t.id).length, 0) / tenants.length
    : 0
  const caTotal = factures.filter(f => f.statut === 'payee').reduce((s, f) => s + (f.total ?? 0), 0)

  // Retention: active / total
  const retentionRate = tenants.length > 0
    ? (tenants.filter(t => (t.status ?? 'active') === 'active').length / tenants.length) * 100
    : 100

  // Tx volumes this month
  const startMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10)
  const txMonth = txAll.filter(t => (t.date ?? '') >= startMonth)
  const txVolMonth = txMonth.reduce((s, t) => s + (t.montant ?? 0), 0)

  // Plan funnel
  const planFunnel = ['starter', 'business', 'premium'].map(plan => ({
    plan,
    count: tenants.filter(t => t.plan === plan).length,
  }))

  return (
    <div className="space-y-8">

      {/* Header */}
      <div>
        <h1 className="text-[22px] font-bold text-gray-900">Analytics Globales</h1>
        <p className="text-sm text-gray-500 mt-0.5">Vue analytique complète de la plateforme Oraforme</p>
      </div>

      {/* Core metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { icon: Users,     label: 'Total clients',         value: tenants.length.toString(),             sub: `${profiles.length} utilisateurs`,        color: '#3B82F6' },
          { icon: TrendingUp,label: 'MRR',                   value: fmtFCFA(totalMRR),                     sub: `ARR: ${fmtFCFA(totalMRR * 12)}`,          color: '#10B981' },
          { icon: Globe,     label: 'Taux de rétention',     value: `${retentionRate.toFixed(1)}%`,         sub: `${tenants.filter(t => t.status === 'suspended').length} suspendus`, color: '#8B5CF6' },
          { icon: Zap,       label: 'Modules/client (moy.)', value: avgModulesPerClient.toFixed(1),        sub: `${fmtFCFA(caTotal)} CA clients total`,    color: '#F59E0B' },
        ].map((k, i) => {
          const Icon = k.icon
          return (
            <div key={i} className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-3" style={{ background: k.color + '15' }}>
                <Icon size={16} style={{ color: k.color }} />
              </div>
              <p className="text-[22px] font-bold text-gray-900">{k.value}</p>
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mt-1">{k.label}</p>
              <p className="text-[11px] text-gray-400 mt-0.5">{k.sub}</p>
            </div>
          )
        })}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
          <h2 className="text-[15px] font-bold text-gray-900 mb-1">Croissance clients — 30 jours</h2>
          <p className="text-xs text-gray-400 mb-4">Nouvelles inscriptions par jour</p>
          <GrowthChart data={dailyData} />
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
          <h2 className="text-[15px] font-bold text-gray-900 mb-1">Revenus par module</h2>
          <p className="text-xs text-gray-400 mb-4">MRR mensuel en FCFA</p>
          <ModuleRevenueChart data={moduleData} />
        </div>
      </div>

      {/* Monthly growth + Plan funnel */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
          <h2 className="text-[15px] font-bold text-gray-900 mb-4">Inscriptions — 12 mois</h2>
          <div className="space-y-2">
            {monthlyData.slice().reverse().slice(0, 6).map((m, i) => {
              const maxVal = Math.max(...monthlyData.map(d => d.inscriptions), 1)
              const pct = (m.inscriptions / maxVal) * 100
              return (
                <div key={i} className="flex items-center gap-3">
                  <span className="text-[12px] text-gray-500 w-10 flex-shrink-0">{m.date}</span>
                  <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full bg-gradient-to-r from-amber-400 to-amber-600"
                      style={{ width: `${pct}%` }} />
                  </div>
                  <span className="text-[12px] font-bold text-gray-900 w-5 text-right">{m.inscriptions}</span>
                </div>
              )
            })}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
          <h2 className="text-[15px] font-bold text-gray-900 mb-4">Funnel Plans</h2>
          <div className="space-y-4">
            {planFunnel.map(p => {
              const pct = tenants.length > 0 ? (p.count / tenants.length) * 100 : 0
              const colors = { starter: '#6366F1', business: '#F59E0B', premium: '#10B981' }
              const color = colors[p.plan as keyof typeof colors]
              return (
                <div key={p.plan}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[13px] font-semibold capitalize text-gray-800">{p.plan}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-[12px] font-bold text-gray-900">{p.count} clients</span>
                      <span className="text-[11px] text-gray-400">({pct.toFixed(0)}%)</span>
                    </div>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
                  </div>
                </div>
              )
            })}
          </div>
          <div className="mt-5 pt-4 border-t border-gray-100">
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-xl bg-gray-50">
                <p className="text-xs text-gray-500">Volume tx ce mois</p>
                <p className="text-sm font-bold text-gray-900 mt-1">{fmtFCFA(txVolMonth)}</p>
              </div>
              <div className="p-3 rounded-xl bg-gray-50">
                <p className="text-xs text-gray-500">Nb transactions</p>
                <p className="text-sm font-bold text-gray-900 mt-1">{txMonth.length}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

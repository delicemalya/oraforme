import { supabaseAdmin } from '@/lib/supabase-server'
import { MODULE_PRICES, MODULE_LABELS, MODULE_ICONS, MODULE_DESCS, fmtFCFA } from '@/lib/admin-config'
import { Package, TrendingUp, DollarSign, Building2 } from 'lucide-react'

export default async function AbonnementsPage() {
  const [tenantsRes, tmRes] = await Promise.all([
    supabaseAdmin.from('tenants').select('id, nom_entreprise, plan, created_at, status').order('created_at', { ascending: false }),
    supabaseAdmin.from('tenant_modules').select('tenant_id, module_key').eq('enabled', true),
  ])
  const allTenants = tenantsRes.data ?? []
  const tmByTenant = new Map<string, string[]>()
  for (const r of (tmRes.data ?? [])) {
    const a = tmByTenant.get(r.tenant_id) ?? []
    a.push(r.module_key)
    tmByTenant.set(r.tenant_id, a)
  }
  const mods = (tid: string) => tmByTenant.get(tid) ?? []

  // Per-module stats
  const moduleStats = Object.entries(MODULE_PRICES).map(([id, price]) => {
    const clients = allTenants.filter(t => mods(t.id).includes(id))
    return {
      id,
      label:   MODULE_LABELS[id]  ?? id,
      icon:    MODULE_ICONS[id]   ?? '📦',
      desc:    MODULE_DESCS[id]   ?? '',
      price,
      clients: clients.length,
      mrr:     clients.length * price,
      active:  clients.filter(t => (t.status ?? 'active') === 'active').length,
    }
  }).sort((a, b) => b.mrr - a.mrr)

  const totalMRR     = moduleStats.reduce((s, m) => s + m.mrr, 0)
  const totalClients = allTenants.length

  // Plan distribution
  const plans = ['starter', 'pro', 'enterprise']
  const planStats = plans.map(plan => ({
    plan,
    count: allTenants.filter(t => t.plan === plan).length,
    mrr:   allTenants.filter(t => t.plan === plan).reduce((s, t) =>
      s + mods(t.id).reduce((ms: number, m: string) => ms + (MODULE_PRICES[m] ?? 0), 0), 0),
  }))

  return (
    <div className="space-y-8">

      {/* Header */}
      <div>
        <h1 className="text-[22px] font-bold text-gray-900">Abonnements</h1>
        <p className="text-sm text-gray-500 mt-0.5">Modules activés par les entreprises clientes</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { icon: DollarSign, label: 'MRR Total',      value: fmtFCFA(totalMRR),                                          color: '#10B981' },
          { icon: Package,    label: 'Modules actifs', value: moduleStats.filter(m => m.clients > 0).length.toString(),   color: '#3B82F6' },
          { icon: Building2,  label: 'Entreprises',    value: totalClients.toString(),                                    color: '#8B5CF6' },
          { icon: TrendingUp, label: 'ARR Projeté',    value: fmtFCFA(totalMRR * 12),                                     color: '#F59E0B' },
        ].map((k, i) => {
          const Icon = k.icon
          return (
            <div key={i} className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-3" style={{ background: k.color + '15' }}>
                <Icon size={16} style={{ color: k.color }} />
              </div>
              <p className="text-[22px] font-bold text-gray-900">{k.value}</p>
              <p className="text-xs text-gray-500 mt-1">{k.label}</p>
            </div>
          )
        })}
      </div>

      {/* Plans distribution */}
      <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
        <h2 className="text-[15px] font-bold text-gray-900 mb-4">Distribution par plan</h2>
        <div className="grid grid-cols-3 gap-4">
          {planStats.map(p => {
            const colors = { starter: '#6366F1', pro: '#F59E0B', enterprise: '#10B981' }
            const color  = colors[p.plan as keyof typeof colors] ?? '#6366F1'
            const pct    = totalClients > 0 ? (p.count / totalClients) * 100 : 0
            return (
              <div key={p.plan} className="p-4 rounded-xl border border-gray-100 bg-gray-50/50">
                <div className="flex items-center justify-between mb-3">
                  <span className="capitalize text-[13px] font-bold text-gray-800">{p.plan}</span>
                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full text-white" style={{ background: color }}>
                    {pct.toFixed(0)}%
                  </span>
                </div>
                <p className="text-xl font-bold text-gray-900">{p.count}</p>
                <p className="text-xs text-gray-500 mt-0.5">clients</p>
                <p className="text-xs font-semibold mt-2" style={{ color }}>{fmtFCFA(p.mrr)}/mois</p>
                <div className="mt-2 h-1.5 bg-gray-200 rounded-full">
                  <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Modules table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-gray-100">
          <h2 className="text-[15px] font-bold text-gray-900">Tous les modules</h2>
          <p className="text-xs text-gray-400 mt-0.5">{moduleStats.length} modules disponibles</p>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50">
              {['Module', 'Prix/mois', 'Clients actifs', 'MRR', 'Part du MRR'].map(h => (
                <th key={h} className="px-5 py-3 text-left text-[11px] font-bold text-gray-400 uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {moduleStats.map((m, i) => {
              const pct = totalMRR > 0 ? (m.mrr / totalMRR) * 100 : 0
              return (
                <tr key={m.id}
                  className="border-t border-gray-50 hover:bg-gray-50/50 transition-colors"
                  style={{ background: i % 2 === 0 ? 'white' : 'transparent' }}>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <span className="text-xl">{m.icon}</span>
                      <div>
                        <p className="text-[13px] font-semibold text-gray-900">{m.label}</p>
                        <p className="text-[11px] text-gray-400 truncate max-w-[200px]">{m.desc}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3.5">
                    <span className="text-[13px] font-bold text-gray-900">{fmtFCFA(m.price)}</span>
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-2">
                      <span className={`text-[13px] font-semibold ${m.clients > 0 ? 'text-blue-600' : 'text-gray-300'}`}>{m.clients}</span>
                      {m.clients > 0 && <span className="text-[11px] text-gray-400">/ {totalClients}</span>}
                    </div>
                  </td>
                  <td className="px-5 py-3.5">
                    <span className={`text-[13px] font-bold ${m.mrr > 0 ? 'text-green-600' : 'text-gray-300'}`}>
                      {m.mrr > 0 ? fmtFCFA(m.mrr) : '—'}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 w-40">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-amber-400 to-amber-600 rounded-full"
                          style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-[11px] text-gray-500 w-10 text-right">{pct.toFixed(1)}%</span>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

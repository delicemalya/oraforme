import { supabaseAdmin } from '@/lib/supabase-server'
import { MODULE_LABELS, MODULE_PRICES, fmtFCFA } from '@/lib/admin-config'
import { TrendingUp } from 'lucide-react'
import { ModuleRevenueChart, GrowthChart } from '@/components/admin/AdminChartsClient'

export default async function AdminRevenusPage() {
  const [tenantsRes, facturesRes] = await Promise.all([
    supabaseAdmin.from('tenants').select('id, modules_actifs, plan, created_at'),
    supabaseAdmin.from('factures').select('total, statut, created_at'),
  ])

  const tenants = tenantsRes.data ?? []
  const factures = facturesRes.data ?? []

  // ── MRR par module ──
  const moduleRevData = Object.entries(MODULE_PRICES).map(([id, price]) => ({
    module: (MODULE_LABELS[id] ?? id).split(' ')[0],
    clients: tenants.filter(t => (t.modules_actifs ?? []).includes(id)).length,
    mrr: tenants.filter(t => (t.modules_actifs ?? []).includes(id)).length * price,
  })).sort((a, b) => b.mrr - a.mrr)

  const totalMRR = moduleRevData.reduce((s, m) => s + m.mrr, 0)
  const totalARR = totalMRR * 12

  // ── CA des clients (factures payées) ──
  const caClients = factures.filter(f => f.statut === 'payee').reduce((s, f) => s + (f.total ?? 0), 0)

  // ── MRR par plan ──
  const mrrByPlan = { starter: 0, business: 0, premium: 0 } as Record<string, number>
  tenants.forEach(t => {
    const planMrr = (t.modules_actifs ?? []).reduce((s: number, m: string) => s + (MODULE_PRICES[m] ?? 0), 0)
    mrrByPlan[t.plan] = (mrrByPlan[t.plan] ?? 0) + planMrr
  })

  // ── 12 mois historique (simulation) ──
  const monthNames = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc']
  const now = new Date()
  const monthlyData = Array.from({ length: 12 }, (_, i) => {
    const m = new Date(now.getFullYear(), now.getMonth() - (11 - i), 1)
    const monthStr = m.toISOString().slice(0, 7)
    const newClients = tenants.filter(t => t.created_at.startsWith(monthStr)).length
    const mrr = newClients * (totalMRR / Math.max(tenants.length, 1))
    return {
      date: monthNames[m.getMonth()],
      inscriptions: newClients,
    }
  })

  return (
    <div className="space-y-6">

      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-[#F08900]/10 border border-[#F08900]/20 flex items-center justify-center">
          <TrendingUp size={18} className="text-[#F08900]" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-[#FFFFFF]">Revenus & MRR</h1>
          <p className="text-xs text-[#484F58]">Tableau de bord financier oraforme</p>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'MRR', value: fmtFCFA(totalMRR), sub: 'Revenus récurrents mensuels', color: '#F51E33' },
          { label: 'ARR', value: fmtFCFA(totalARR), sub: 'Revenus annuels récurrents', color: '#F08900' },
          { label: 'CA Clients', value: fmtFCFA(caClients), sub: 'Facturé par les clients', color: '#142850' },
          { label: 'ARPU', value: fmtFCFA(tenants.length > 0 ? totalMRR / tenants.length : 0), sub: 'Revenu moyen/client/mois', color: '#F08900' },
        ].map(k => (
          <div key={k.label} className="bg-[#0f1e3d] border border-[#30363D] rounded-xl p-5">
            <p className="text-xs font-semibold text-[#484F58] uppercase tracking-wider mb-2">{k.label}</p>
            <p className="text-xl font-bold" style={{ color: k.color }}>{k.value}</p>
            <p className="text-xs text-[#484F58] mt-1">{k.sub}</p>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-[#0f1e3d] border border-[#30363D] rounded-xl p-5">
          <h2 className="text-sm font-semibold text-[#FFFFFF] mb-4">MRR par module</h2>
          <ModuleRevenueChart data={moduleRevData} />
        </div>
        <div className="bg-[#0f1e3d] border border-[#30363D] rounded-xl p-5">
          <h2 className="text-sm font-semibold text-[#FFFFFF] mb-4">Évolution clients (12 mois)</h2>
          <GrowthChart data={monthlyData} />
        </div>
      </div>

      {/* MRR par plan */}
      <div className="bg-[#0f1e3d] border border-[#30363D] rounded-xl p-5">
        <h2 className="text-sm font-semibold text-[#FFFFFF] mb-4">MRR par plan tarifaire</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { plan: 'starter', color: '#8B949E', label: 'Starter' },
            { plan: 'business', color: '#F08900', label: 'Business' },
            { plan: 'premium', color: '#F08900', label: 'Premium' },
          ].map(p => {
            const nb = tenants.filter(t => t.plan === p.plan).length
            const mrr = mrrByPlan[p.plan] ?? 0
            return (
              <div key={p.plan} className="bg-[#142850] border border-[#1a2d50] rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium" style={{ color: p.color }}>{p.label}</span>
                  <span className="text-xs text-[#484F58]">{nb} client{nb > 1 ? 's' : ''}</span>
                </div>
                <p className="text-xl font-bold text-[#FFFFFF]">{fmtFCFA(mrr)}</p>
                <p className="text-xs text-[#484F58] mt-1">
                  {totalMRR > 0 ? Math.round((mrr / totalMRR) * 100) : 0}% du MRR total
                </p>
                <div className="h-1 bg-[#1a2d50] rounded-full mt-3 overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${totalMRR > 0 ? (mrr / totalMRR) * 100 : 0}%`,
                      backgroundColor: p.color,
                    }}
                  />
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Module detail table */}
      <div className="bg-[#0f1e3d] border border-[#30363D] rounded-xl p-5">
        <h2 className="text-sm font-semibold text-[#FFFFFF] mb-4">Détail MRR par module</h2>
        <div className="space-y-2">
          {moduleRevData.map(m => (
            <div key={m.module} className="flex items-center gap-3">
              <p className="text-sm text-[#8B949E] w-28 shrink-0">{m.module}</p>
              <div className="flex-1 h-2 bg-[#1a2d50] rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#F51E33] rounded-full"
                  style={{ width: `${totalMRR > 0 ? (m.mrr / totalMRR) * 100 : 0}%` }}
                />
              </div>
              <p className="text-sm font-medium text-[#FFFFFF] w-32 text-right shrink-0">{fmtFCFA(m.mrr)}</p>
              <p className="text-xs text-[#484F58] w-8 text-right shrink-0">
                {totalMRR > 0 ? Math.round((m.mrr / totalMRR) * 100) : 0}%
              </p>
            </div>
          ))}
        </div>
      </div>

    </div>
  )
}

import { supabaseAdmin } from '@/lib/supabase-server'
import { MODULE_PRICES, MODULE_LABELS, fmtFCFA } from '@/lib/admin-config'
import Link from 'next/link'
import {
  DollarSign, TrendingUp, TrendingDown, Wallet, CreditCard,
  ArrowRight, BarChart3, RefreshCw, PieChart, CheckCircle2,
} from 'lucide-react'

export default async function FinanceDashboardPage() {
  const now = new Date()
  const startMonth  = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
  const startPrev   = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString()
  const endPrev     = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59).toISOString()
  const startYear   = new Date(now.getFullYear(), 0, 1).toISOString()

  const [tenantsRes, facturesRes, txRes, txPrevRes, txYearRes] = await Promise.all([
    supabaseAdmin.from('tenants').select('id, nom_entreprise, plan, modules_actifs, status, created_at').eq('status', 'active'),
    supabaseAdmin.from('factures').select('id, tenant_id, total, statut, created_at').gte('created_at', startYear),
    supabaseAdmin.from('transactions').select('id, tenant_id, amount, type, created_at').gte('created_at', startMonth),
    supabaseAdmin.from('transactions').select('id, amount, type').gte('created_at', startPrev).lte('created_at', endPrev),
    supabaseAdmin.from('transactions').select('id, amount, type, created_at').gte('created_at', startYear),
  ])

  const tenants  = tenantsRes.data  ?? []
  const factures = facturesRes.data ?? []
  const txMonth  = txRes.data       ?? []
  const txPrev   = txPrevRes.data   ?? []
  const txYear   = txYearRes.data   ?? []

  // MRR = sum of active tenants' module prices
  const mrr = tenants.reduce((sum, t) => {
    const mods = (t.modules_actifs ?? []) as string[]
    return sum + mods.reduce((s, m) => s + (MODULE_PRICES[m] ?? 0), 0)
  }, 0)
  const arr = mrr * 12

  // Revenue collected this year (paid factures)
  const collected = factures.filter(f => f.statut === 'payee').reduce((s, f) => s + (f.total ?? 0), 0)
  const outstanding = factures.filter(f => f.statut === 'envoyee').reduce((s, f) => s + (f.total ?? 0), 0)

  // Transaction volumes
  const txVolMonth = txMonth.reduce((s, t) => s + Math.abs(t.amount ?? 0), 0)
  const txVolPrev  = txPrev.reduce((s, t)  => s + Math.abs(t.amount ?? 0), 0)
  const txGrowth   = txVolPrev > 0 ? Math.round(((txVolMonth - txVolPrev) / txVolPrev) * 100) : 0

  // Monthly breakdown for year chart (12 months)
  const monthlyData = Array.from({ length: 12 }, (_, i) => {
    const mo = new Date(now.getFullYear(), i, 1)
    const moEnd = new Date(now.getFullYear(), i + 1, 0)
    const vol = txYear
      .filter(t => {
        const d = new Date(t.created_at)
        return d >= mo && d <= moEnd
      })
      .reduce((s, t) => s + Math.abs(t.amount ?? 0), 0)
    return { month: mo.toLocaleDateString('fr-FR', { month: 'short' }), vol }
  })

  const maxVol = Math.max(...monthlyData.map(m => m.vol), 1)

  // Top tenants by MRR
  const topTenants = tenants
    .map(t => {
      const mods = (t.modules_actifs ?? []) as string[]
      const tenantMrr = mods.reduce((s, m) => s + (MODULE_PRICES[m] ?? 0), 0)
      const tenantCa  = factures.filter(f => f.tenant_id === t.id && f.statut === 'payee').reduce((s, f) => s + (f.total ?? 0), 0)
      return { ...t, tenantMrr, tenantCa }
    })
    .filter(t => t.tenantMrr > 0)
    .sort((a, b) => b.tenantMrr - a.tenantMrr)
    .slice(0, 8)

  // Module revenue breakdown
  const modulesBreakdown = Object.entries(MODULE_PRICES)
    .map(([id, price]) => {
      const count = tenants.filter(t => ((t.modules_actifs ?? []) as string[]).includes(id)).length
      return { id, label: MODULE_LABELS[id] ?? id, price, count, rev: price * count }
    })
    .filter(m => m.count > 0)
    .sort((a, b) => b.rev - a.rev)
    .slice(0, 6)

  const QUICK = [
    { label: 'Caisse & Liquidités',    href: '/admin/finance/caisse',     icon: Wallet,    color: '#10B981', desc: 'Gérer entrées / sorties' },
    { label: 'Transferts & Rembt.',    href: '/admin/finance/transferts', icon: RefreshCw, color: '#3B82F6', desc: 'Virements & remboursements' },
    { label: 'Analytics Financières',  href: '/admin/finance/analytics',  icon: PieChart,  color: '#8B5CF6', desc: 'Tableaux de bord avancés' },
    { label: 'Billing par client',     href: '/admin/billing',            icon: CreditCard,color: '#F59E0B', desc: 'Facturation mensuelle' },
  ]

  return (
    <div className="space-y-8">

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-[22px] font-bold text-gray-900">Finance Center</h1>
          <p className="text-sm text-gray-500 mt-0.5">Vue consolidée des flux financiers Oraforme</p>
        </div>
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-green-50 border border-green-200">
          <CheckCircle2 size={14} className="text-green-600" />
          <span className="text-[13px] font-semibold text-green-700">Données temps réel</span>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'MRR',               value: fmtFCFA(mrr),       sub: 'Revenus récurrents mensuels', icon: TrendingUp,   color: '#F59E0B', trend: null },
          { label: 'ARR',               value: fmtFCFA(arr),       sub: 'Revenus annuels récurrents',  icon: BarChart3,    color: '#3B82F6', trend: null },
          { label: 'Collecté (année)',   value: fmtFCFA(collected), sub: 'Factures payées cette année', icon: DollarSign,   color: '#10B981', trend: null },
          { label: 'Volume tx / mois',   value: fmtFCFA(txVolMonth),sub: txGrowth >= 0 ? `+${txGrowth}% vs mois préc.` : `${txGrowth}% vs mois préc.`, icon: txGrowth >= 0 ? TrendingUp : TrendingDown, color: txGrowth >= 0 ? '#10B981' : '#EF4444', trend: txGrowth },
        ].map((k, i) => {
          const Icon = k.icon
          return (
            <div key={i} className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: k.color + '15' }}>
                  <Icon size={14} style={{ color: k.color }} />
                </div>
              </div>
              <p className="text-[18px] font-bold text-gray-900 leading-tight">{k.value}</p>
              <p className="text-[11px] text-gray-500 mt-1 leading-snug">{k.sub}</p>
            </div>
          )
        })}
      </div>

      {/* Outstanding + Active tenants */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border border-amber-100 p-5 shadow-sm">
          <p className="text-[11px] font-bold text-amber-600 uppercase tracking-wide mb-1">Factures en attente</p>
          <p className="text-[22px] font-bold text-gray-900">{fmtFCFA(outstanding)}</p>
          <p className="text-[12px] text-gray-500 mt-1">{factures.filter(f => f.statut === 'envoyee').length} factures non réglées</p>
        </div>
        <div className="bg-white rounded-2xl border border-blue-100 p-5 shadow-sm">
          <p className="text-[11px] font-bold text-blue-600 uppercase tracking-wide mb-1">Clients actifs</p>
          <p className="text-[22px] font-bold text-gray-900">{tenants.length}</p>
          <p className="text-[12px] text-gray-500 mt-1">Entreprises abonnées</p>
        </div>
        <div className="bg-white rounded-2xl border border-green-100 p-5 shadow-sm">
          <p className="text-[11px] font-bold text-green-600 uppercase tracking-wide mb-1">Transactions ce mois</p>
          <p className="text-[22px] font-bold text-gray-900">{txMonth.length}</p>
          <p className="text-[12px] text-gray-500 mt-1">Opérations enregistrées</p>
        </div>
      </div>

      {/* Volume chart + Module breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Monthly volume chart */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
          <h2 className="text-[15px] font-bold text-gray-900 mb-5">Volume transactions mensuel</h2>
          <div className="flex items-end gap-1.5 h-40">
            {monthlyData.map((m, i) => {
              const h = maxVol > 0 ? Math.round((m.vol / maxVol) * 100) : 0
              const isCurrent = i === now.getMonth()
              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <div
                    className={`w-full rounded-t-lg transition-all ${isCurrent ? 'bg-amber-400' : 'bg-blue-100'}`}
                    style={{ height: `${Math.max(h, 4)}%` }}
                    title={fmtFCFA(m.vol)}
                  />
                  <span className="text-[9px] text-gray-400 capitalize">{m.month}</span>
                </div>
              )
            })}
          </div>
          <div className="flex items-center gap-4 mt-4 pt-4 border-t border-gray-50">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-sm bg-amber-400" />
              <span className="text-[11px] text-gray-500">Mois actuel</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-sm bg-blue-100" />
              <span className="text-[11px] text-gray-500">Mois précédents</span>
            </div>
          </div>
        </div>

        {/* Module revenue */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
          <h2 className="text-[15px] font-bold text-gray-900 mb-4">MRR par module</h2>
          <div className="space-y-3">
            {modulesBreakdown.map(m => (
              <div key={m.id}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[12px] text-gray-700 truncate flex-1">{m.label}</span>
                  <span className="text-[12px] font-bold text-gray-900 ml-2">{fmtFCFA(m.rev)}</span>
                </div>
                <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full bg-amber-400"
                    style={{ width: `${(m.rev / mrr) * 100}%` }}
                  />
                </div>
                <p className="text-[10px] text-gray-400 mt-0.5">{m.count} client{m.count > 1 ? 's' : ''} × {fmtFCFA(m.price)}</p>
              </div>
            ))}
            {modulesBreakdown.length === 0 && (
              <p className="text-[12px] text-gray-400 text-center py-4">Aucun module actif</p>
            )}
          </div>
        </div>
      </div>

      {/* Quick actions */}
      <div>
        <h2 className="text-[15px] font-bold text-gray-900 mb-4">Accès rapide Finance</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {QUICK.map(q => {
            const Icon = q.icon
            return (
              <Link
                key={q.href}
                href={q.href}
                className="group bg-white rounded-2xl border border-gray-100 p-5 shadow-sm hover:shadow-md hover:border-gray-200 transition-all"
              >
                <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-3" style={{ background: q.color + '15' }}>
                  <Icon size={16} style={{ color: q.color }} />
                </div>
                <p className="text-[13px] font-bold text-gray-900 group-hover:text-amber-700 transition-colors">{q.label}</p>
                <p className="text-[11px] text-gray-400 mt-0.5">{q.desc}</p>
                <div className="mt-3 flex items-center gap-1 text-amber-500 opacity-0 group-hover:opacity-100 transition-opacity">
                  <span className="text-[11px] font-semibold">Accéder</span>
                  <ArrowRight size={11} />
                </div>
              </Link>
            )
          })}
        </div>
      </div>

      {/* Top tenants */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-[15px] font-bold text-gray-900">Top clients par MRR</h2>
          <Link href="/admin/clients" className="text-[12px] text-amber-600 font-semibold hover:text-amber-700 flex items-center gap-1">
            Voir tous <ArrowRight size={11} />
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[500px]">
            <thead>
              <tr className="bg-gray-50">
                {['Entreprise', 'Modules', 'MRR mensuel', 'CA collecté', 'Statut'].map(h => (
                  <th key={h} className="px-5 py-3 text-left text-[11px] font-bold text-gray-400 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {topTenants.map(t => (
                <tr key={t.id} className="border-t border-gray-50 hover:bg-gray-50/50 transition-colors">
                  <td className="px-5 py-3">
                    <Link href={`/admin/clients/${t.id}`} className="text-[13px] font-semibold text-gray-900 hover:text-amber-700 transition-colors">
                      {t.nom_entreprise}
                    </Link>
                  </td>
                  <td className="px-5 py-3 text-[12px] text-gray-500">{((t.modules_actifs ?? []) as string[]).length} module(s)</td>
                  <td className="px-5 py-3">
                    <span className="text-[13px] font-bold text-amber-700">{fmtFCFA(t.tenantMrr)}</span>
                  </td>
                  <td className="px-5 py-3 text-[12px] text-gray-700">{fmtFCFA(t.tenantCa)}</td>
                  <td className="px-5 py-3">
                    <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-green-50 text-green-700 border border-green-200">Actif</span>
                  </td>
                </tr>
              ))}
              {topTenants.length === 0 && (
                <tr><td colSpan={5} className="px-5 py-8 text-center text-[12px] text-gray-400">Aucun client actif avec des modules</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

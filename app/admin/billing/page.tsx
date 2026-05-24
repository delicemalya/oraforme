import { supabaseAdmin } from '@/lib/supabase-server'
import { MODULE_PRICES, fmtFCFA } from '@/lib/admin-config'
import { CreditCard, TrendingUp, DollarSign, AlertTriangle, CheckCircle2, Clock } from 'lucide-react'

export default async function BillingPage() {
  const { data: tenants } = await supabaseAdmin
    .from('tenants')
    .select('id, nom_entreprise, plan, modules_actifs, created_at, status')
    .order('created_at', { ascending: false })

  const allTenants = tenants ?? []
  const now = new Date()

  // Per-tenant billing
  const billingRows = allTenants.map(t => {
    const modules = (t.modules_actifs ?? []) as string[]
    const mrr     = modules.reduce((s, m) => s + (MODULE_PRICES[m] ?? 0), 0)
    const daysOld = Math.floor((Date.now() - new Date(t.created_at).getTime()) / 86400000)
    const monthsOld = Math.floor(daysOld / 30)
    const totalPaid = mrr * monthsOld
    const nextBilling = new Date(t.created_at)
    nextBilling.setMonth(nextBilling.getMonth() + monthsOld + 1)
    const isOverdue = nextBilling < now && (t.status ?? 'active') === 'active'
    return {
      id:          t.id,
      name:        t.nom_entreprise,
      plan:        t.plan,
      mrr,
      totalPaid,
      nextBilling: nextBilling.toISOString().slice(0, 10),
      status:      t.status ?? 'active',
      isOverdue,
      modules:     modules.length,
    }
  })

  const totalMRR     = billingRows.reduce((s, r) => s + r.mrr, 0)
  const totalARR     = totalMRR * 12
  const overdueCount = billingRows.filter(r => r.isOverdue).length
  const paidCount    = billingRows.filter(r => !r.isOverdue && r.mrr > 0).length

  function fmtDate(d: string) {
    return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
  }

  return (
    <div className="space-y-8">

      {/* Header */}
      <div>
        <h1 className="text-[22px] font-bold text-gray-900">Billing & Paiements</h1>
        <p className="text-sm text-gray-500 mt-0.5">Facturation SaaS — abonnements et paiements</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { icon: DollarSign,    label: 'MRR Plateforme',    value: fmtFCFA(totalMRR),        color: '#10B981', sub: 'par mois'    },
          { icon: TrendingUp,    label: 'ARR Projeté',       value: fmtFCFA(totalARR),        color: '#3B82F6', sub: 'annuel'     },
          { icon: CheckCircle2,  label: 'Abonnements actifs',value: paidCount.toString(),     color: '#8B5CF6', sub: 'avec module' },
          { icon: AlertTriangle, label: 'Paiements en retard',value: overdueCount.toString(), color: '#EF4444', sub: 'à relancer'  },
        ].map((k, i) => {
          const Icon = k.icon
          return (
            <div key={i} className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-3" style={{ background: k.color + '15' }}>
                <Icon size={16} style={{ color: k.color }} />
              </div>
              <p className="text-[22px] font-bold text-gray-900">{k.value}</p>
              <p className="text-xs text-gray-500 mt-0.5">{k.label}</p>
              <p className="text-[11px] text-gray-400 mt-0.5">{k.sub}</p>
            </div>
          )
        })}
      </div>

      {/* Revenue split */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { label: 'Starter',  plan: 'starter',  color: '#6366F1' },
          { label: 'Business', plan: 'business', color: '#F59E0B' },
          { label: 'Premium',  plan: 'premium',  color: '#10B981' },
        ].map(p => {
          const rows  = billingRows.filter(r => r.plan === p.plan)
          const mrr   = rows.reduce((s, r) => s + r.mrr, 0)
          return (
            <div key={p.plan} className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <span className="text-[13px] font-bold text-gray-900 capitalize">{p.label}</span>
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full text-white" style={{ background: p.color }}>
                  {rows.length} clients
                </span>
              </div>
              <p className="text-xl font-bold" style={{ color: p.color }}>{fmtFCFA(mrr)}</p>
              <p className="text-xs text-gray-500 mt-0.5">/mois · ARR {fmtFCFA(mrr * 12)}</p>
            </div>
          )
        })}
      </div>

      {/* Billing table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="text-[15px] font-bold text-gray-900">Facturation par entreprise</h2>
          <p className="text-xs text-gray-400 mt-0.5">Calcul basé sur modules actifs × prix mensuel</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[700px]">
            <thead>
              <tr className="bg-gray-50">
                {['Entreprise', 'Plan', 'Modules', 'MRR', 'Total cumulé', 'Prochaine échéance', 'Statut'].map(h => (
                  <th key={h} className="px-5 py-3 text-left text-[11px] font-bold text-gray-400 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {billingRows.map((r, i) => (
                <tr key={r.id}
                  className={`border-t border-gray-50 hover:bg-gray-50/50 transition-colors ${r.isOverdue ? 'bg-red-50/30' : ''}`}>
                  <td className="px-5 py-3.5">
                    <span className="text-[13px] font-semibold text-gray-900">{r.name}</span>
                  </td>
                  <td className="px-5 py-3.5">
                    <span className="capitalize text-xs font-semibold text-gray-600">{r.plan}</span>
                  </td>
                  <td className="px-5 py-3.5">
                    <span className="text-xs font-semibold text-blue-600">{r.modules}</span>
                  </td>
                  <td className="px-5 py-3.5">
                    <span className={`text-[13px] font-bold ${r.mrr > 0 ? 'text-green-600' : 'text-gray-300'}`}>
                      {r.mrr > 0 ? fmtFCFA(r.mrr) : '—'}
                    </span>
                  </td>
                  <td className="px-5 py-3.5">
                    <span className="text-[12px] text-gray-600">{r.totalPaid > 0 ? fmtFCFA(r.totalPaid) : '—'}</span>
                  </td>
                  <td className="px-5 py-3.5">
                    <span className={`text-[12px] ${r.isOverdue ? 'text-red-600 font-semibold' : 'text-gray-500'}`}>
                      {fmtDate(r.nextBilling)}
                    </span>
                  </td>
                  <td className="px-5 py-3.5">
                    {r.status === 'suspended' ? (
                      <span className="text-[11px] px-2.5 py-1 rounded-full border bg-red-50 text-red-600 border-red-200 font-semibold">Suspendu</span>
                    ) : r.mrr === 0 ? (
                      <span className="text-[11px] px-2.5 py-1 rounded-full border bg-gray-50 text-gray-400 border-gray-200 font-semibold">Gratuit</span>
                    ) : (
                      <span className="text-[11px] px-2.5 py-1 rounded-full border bg-green-50 text-green-600 border-green-200 font-semibold">Actif</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

import { supabaseAdmin } from '@/lib/supabase-server'
import { ArrowRightLeft, TrendingUp, TrendingDown, BarChart3, ArrowUpCircle, ArrowDownCircle } from 'lucide-react'

function fmtFCFA(n: number) {
  return new Intl.NumberFormat('fr-FR').format(Math.round(n)) + ' FCFA'
}

export default async function TransactionsGlobalesPage() {
  const now = new Date()
  const startMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10)

  const [txRes, tenantsRes] = await Promise.all([
    supabaseAdmin.from('transactions').select('id, tenant_id, type, categorie, montant, date, description, mode_paiement, created_at')
      .order('created_at', { ascending: false }).limit(200),
    supabaseAdmin.from('tenants').select('id, nom_entreprise'),
  ])

  const transactions = txRes.data      ?? []
  const tenants      = tenantsRes.data ?? []
  const tenantMap    = Object.fromEntries(tenants.map(t => [t.id, t.nom_entreprise]))

  const thisMonth = transactions.filter(t => t.date >= startMonth)
  const entrees   = thisMonth.filter(t => t.type === 'entree')
  const sorties   = thisMonth.filter(t => t.type === 'sortie')

  const volEntrees = entrees.reduce((s, t) => s + (t.montant ?? 0), 0)
  const volSorties = sorties.reduce((s, t) => s + (t.montant ?? 0), 0)
  const solde      = volEntrees - volSorties

  // Per tenant volume
  const perTenant = tenants.map(t => {
    const tx  = transactions.filter(tx => tx.tenant_id === t.id)
    const ent = tx.filter(tx => tx.type === 'entree').reduce((s, tx) => s + (tx.montant ?? 0), 0)
    const sor = tx.filter(tx => tx.type === 'sortie').reduce((s, tx) => s + (tx.montant ?? 0), 0)
    return { id: t.id, nom: t.nom_entreprise, nb: tx.length, entrees: ent, sorties: sor, solde: ent - sor }
  }).filter(t => t.nb > 0).sort((a, b) => b.nb - a.nb)

  function fmtDate(d: string) {
    return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })
  }

  return (
    <div className="space-y-8">

      {/* Header */}
      <div>
        <h1 className="text-[22px] font-bold text-gray-900">Transactions Globales</h1>
        <p className="text-sm text-gray-500 mt-0.5">{transactions.length} transactions sur toutes les entreprises</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { icon: BarChart3,     label: 'Volume ce mois',     value: fmtFCFA(volEntrees + volSorties), color: '#6366F1' },
          { icon: TrendingUp,    label: 'Entrées ce mois',    value: fmtFCFA(volEntrees),  color: '#10B981' },
          { icon: TrendingDown,  label: 'Sorties ce mois',    value: fmtFCFA(volSorties),  color: '#EF4444' },
          { icon: ArrowRightLeft,label: 'Total transactions',  value: transactions.length.toString(), color: '#3B82F6' },
        ].map((k, i) => {
          const Icon = k.icon
          return (
            <div key={i} className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-3" style={{ background: k.color + '15' }}>
                <Icon size={16} style={{ color: k.color }} />
              </div>
              <p className="text-[20px] font-bold text-gray-900 leading-tight">{k.value}</p>
              <p className="text-xs text-gray-500 mt-1">{k.label}</p>
            </div>
          )
        })}
      </div>

      {/* Per-tenant volume */}
      {perTenant.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
          <h2 className="text-[15px] font-bold text-gray-900 mb-4">Volume par entreprise</h2>
          <div className="space-y-3">
            {perTenant.slice(0, 8).map((t, i) => {
              const maxNb = perTenant[0].nb
              const pct = maxNb > 0 ? (t.nb / maxNb) * 100 : 0
              return (
                <div key={t.id} className="flex items-center gap-3">
                  <span className="text-[11px] font-bold text-gray-300 w-5 text-right">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[13px] font-medium text-gray-800 truncate">{t.nom}</span>
                      <span className="text-[12px] font-bold text-gray-900">{t.nb} tx</span>
                    </div>
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full bg-gradient-to-r from-blue-400 to-blue-600" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                  <div className="text-right w-28 flex-shrink-0">
                    <p className="text-[11px] text-green-600 font-semibold">+{fmtFCFA(t.entrees)}</p>
                    <p className="text-[11px] text-red-500">-{fmtFCFA(t.sorties)}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Recent transactions */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="text-[15px] font-bold text-gray-900">Dernières transactions</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50">
                {['Date', 'Entreprise', 'Type', 'Description', 'Montant', 'Mode'].map(h => (
                  <th key={h} className="px-5 py-3 text-left text-[11px] font-bold text-gray-400 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {transactions.slice(0, 30).map((t, i) => (
                <tr key={t.id} className="border-t border-gray-50 hover:bg-gray-50/50 transition-colors">
                  <td className="px-5 py-3 text-[12px] text-gray-500">{fmtDate(t.date || t.created_at)}</td>
                  <td className="px-5 py-3 text-[13px] font-medium text-gray-800">{tenantMap[t.tenant_id] ?? '—'}</td>
                  <td className="px-5 py-3">
                    <span className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full border ${t.type === 'entree' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-600 border-red-200'}`}>
                      {t.type === 'entree' ? <ArrowUpCircle size={10} /> : <ArrowDownCircle size={10} />}
                      {t.type === 'entree' ? 'Entrée' : 'Sortie'}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-[12px] text-gray-600 max-w-[200px] truncate">{t.description || t.categorie || '—'}</td>
                  <td className="px-5 py-3">
                    <span className={`text-[13px] font-bold ${t.type === 'entree' ? 'text-green-600' : 'text-red-500'}`}>
                      {t.type === 'entree' ? '+' : '-'}{fmtFCFA(t.montant ?? 0)}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-[12px] text-gray-400 capitalize">{t.mode_paiement || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {transactions.length > 30 && (
          <div className="px-5 py-3 bg-gray-50 text-center">
            <span className="text-xs text-gray-400">30 premières sur {transactions.length} transactions</span>
          </div>
        )}
      </div>
    </div>
  )
}

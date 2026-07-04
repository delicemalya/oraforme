import { supabaseAdmin } from '@/lib/supabase-server'
import { MODULE_LABELS, MODULE_PRICES, MODULE_ICONS, fmtFCFA } from '@/lib/admin-config'
import { Package } from 'lucide-react'

export default async function AdminModulesPage() {
  const [tenantsRes, tmRes] = await Promise.all([
    supabaseAdmin.from('tenants').select('id'),
    supabaseAdmin.from('tenant_modules').select('tenant_id, module_key').eq('enabled', true),
  ])
  const allTenants = tenantsRes.data ?? []
  const nbTenants = allTenants.length
  const tmByModule = new Map<string, number>()
  for (const r of (tmRes.data ?? [])) {
    tmByModule.set(r.module_key, (tmByModule.get(r.module_key) ?? 0) + 1)
  }

  const moduleStats = Object.keys(MODULE_LABELS).map(id => {
    const clientsAvec = tmByModule.get(id) ?? 0
    const mrr = clientsAvec * (MODULE_PRICES[id] ?? 0)
    const penetration = nbTenants > 0 ? Math.round((clientsAvec / nbTenants) * 100) : 0
    return { id, clientsAvec, mrr, penetration }
  }).sort((a, b) => b.mrr - a.mrr)

  const totalMRR = moduleStats.reduce((s, m) => s + m.mrr, 0)

  return (
    <div className="space-y-6">

      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-[#DC2626]/10 border border-[#DC2626]/20 flex items-center justify-center">
          <Package size={18} className="text-[#DC2626]" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-[var(--text)]">Gestion des modules</h1>
          <p className="text-xs text-[var(--text-secondary)]">Stats d&apos;utilisation et tarification — MRR total : {fmtFCFA(totalMRR)}/mois</p>
        </div>
      </div>

      {/* Module grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {moduleStats.map(m => {
          const price = MODULE_PRICES[m.id] ?? 0
          return (
            <div key={m.id} className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl p-5">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{MODULE_ICONS[m.id] ?? '📦'}</span>
                  <div>
                    <p className="text-sm font-semibold text-[var(--text)]">{MODULE_LABELS[m.id]}</p>
                    <p className="text-xs text-[#DC2626] font-medium">{fmtFCFA(price)}/mois</p>
                  </div>
                </div>
                <div className={`text-xs px-2 py-0.5 rounded border font-medium ${
                  m.clientsAvec > 0
                    ? 'text-[#DC2626] bg-[var(--surface)]/10 border-[#0F172A]/30'
                    : 'text-[var(--text-secondary)] bg-[var(--surface-alt)] border-[var(--border)]'
                }`}>
                  {m.clientsAvec > 0 ? 'Actif' : 'Inactif'}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 mb-4">
                <div className="bg-[var(--surface)] rounded-lg p-2 text-center">
                  <p className="text-lg font-bold text-[var(--text)]">{m.clientsAvec}</p>
                  <p className="text-[10px] text-[var(--text-secondary)]">clients</p>
                </div>
                <div className="bg-[var(--surface)] rounded-lg p-2 text-center">
                  <p className="text-lg font-bold text-[#DC2626]">{fmtFCFA(m.mrr).replace(' FCFA', '')}</p>
                  <p className="text-[10px] text-[var(--text-secondary)]">MRR</p>
                </div>
                <div className="bg-[var(--surface)] rounded-lg p-2 text-center">
                  <p className="text-lg font-bold text-[#DC2626]">{m.penetration}%</p>
                  <p className="text-[10px] text-[var(--text-secondary)]">pénétr.</p>
                </div>
              </div>

              {/* Penetration bar */}
              <div className="h-1.5 bg-[var(--surface-alt)] rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#DC2626] rounded-full transition-all"
                  style={{ width: `${m.penetration}%` }}
                />
              </div>
              <p className="text-[10px] text-[var(--text-secondary)] mt-1">{m.penetration}% de pénétration marché</p>
            </div>
          )
        })}
      </div>

      {/* Summary table */}
      <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl p-5">
        <h2 className="text-sm font-semibold text-[var(--text)] mb-4">Tableau récapitulatif</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border)]">
                <th className="text-left py-2 px-3 text-xs text-[var(--text-secondary)] uppercase tracking-wider font-semibold">Module</th>
                <th className="text-right py-2 px-3 text-xs text-[var(--text-secondary)] uppercase tracking-wider font-semibold">Prix/mois</th>
                <th className="text-right py-2 px-3 text-xs text-[var(--text-secondary)] uppercase tracking-wider font-semibold">Clients</th>
                <th className="text-right py-2 px-3 text-xs text-[var(--text-secondary)] uppercase tracking-wider font-semibold">MRR</th>
                <th className="text-right py-2 px-3 text-xs text-[var(--text-secondary)] uppercase tracking-wider font-semibold">Part</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {moduleStats.map(m => (
                <tr key={m.id} className="hover:bg-white/5/30 transition-colors">
                  <td className="py-2.5 px-3 font-medium text-[var(--text)]">
                    {MODULE_ICONS[m.id]} {MODULE_LABELS[m.id]}
                  </td>
                  <td className="py-2.5 px-3 text-right text-[var(--text-secondary)]">{fmtFCFA(MODULE_PRICES[m.id] ?? 0)}</td>
                  <td className="py-2.5 px-3 text-right text-[var(--text)]">{m.clientsAvec}</td>
                  <td className="py-2.5 px-3 text-right font-medium text-[#DC2626]">{fmtFCFA(m.mrr)}</td>
                  <td className="py-2.5 px-3 text-right text-[var(--text-secondary)]">
                    {totalMRR > 0 ? Math.round((m.mrr / totalMRR) * 100) : 0}%
                  </td>
                </tr>
              ))}
              <tr className="border-t-2 border-[var(--border)]">
                <td className="py-2.5 px-3 font-bold text-[var(--text)]" colSpan={3}>Total MRR</td>
                <td className="py-2.5 px-3 text-right font-bold text-[#DC2626]">{fmtFCFA(totalMRR)}</td>
                <td className="py-2.5 px-3 text-right font-bold text-[var(--text)]">100%</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

    </div>
  )
}

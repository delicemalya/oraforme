import { supabaseAdmin } from '@/lib/supabase-server'
import { MODULE_LABELS, MODULE_PRICES, MODULE_ICONS, fmtFCFA } from '@/lib/admin-config'
import { Package, Users, TrendingUp } from 'lucide-react'

export default async function AdminModulesPage() {
  const { data: tenants } = await supabaseAdmin
    .from('tenants')
    .select('id, modules_actifs')

  const allTenants = tenants ?? []
  const nbTenants = allTenants.length

  const moduleStats = Object.keys(MODULE_LABELS).map(id => {
    const clientsAvec = allTenants.filter(t => (t.modules_actifs ?? []).includes(id)).length
    const mrr = clientsAvec * (MODULE_PRICES[id] ?? 0)
    const penetration = nbTenants > 0 ? Math.round((clientsAvec / nbTenants) * 100) : 0
    return { id, clientsAvec, mrr, penetration }
  }).sort((a, b) => b.mrr - a.mrr)

  const totalMRR = moduleStats.reduce((s, m) => s + m.mrr, 0)

  return (
    <div className="space-y-6">

      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-[#8B0073]/10 border border-[#8B0073]/20 flex items-center justify-center">
          <Package size={18} className="text-[#8B0073]" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-[#111827]">Gestion des modules</h1>
          <p className="text-xs text-[#6B7280]">Stats d&apos;utilisation et tarification — MRR total : {fmtFCFA(totalMRR)}/mois</p>
        </div>
      </div>

      {/* Module grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {moduleStats.map(m => {
          const price = MODULE_PRICES[m.id] ?? 0
          return (
            <div key={m.id} className="bg-white border border-[#E2E8F0] rounded-xl p-5">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{MODULE_ICONS[m.id] ?? '📦'}</span>
                  <div>
                    <p className="text-sm font-semibold text-[#111827]">{MODULE_LABELS[m.id]}</p>
                    <p className="text-xs text-[#F0A30A] font-medium">{fmtFCFA(price)}/mois</p>
                  </div>
                </div>
                <div className={`text-xs px-2 py-0.5 rounded border font-medium ${
                  m.clientsAvec > 0
                    ? 'text-[#2EA043] bg-[#2EA043]/10 border-[#2EA043]/30'
                    : 'text-[#6B7280] bg-[#F0F4FF] border-[#E2E8F0]'
                }`}>
                  {m.clientsAvec > 0 ? 'Actif' : 'Inactif'}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 mb-4">
                <div className="bg-white rounded-lg p-2 text-center">
                  <p className="text-lg font-bold text-[#111827]">{m.clientsAvec}</p>
                  <p className="text-[10px] text-[#6B7280]">clients</p>
                </div>
                <div className="bg-white rounded-lg p-2 text-center">
                  <p className="text-lg font-bold text-[#F01F38]">{fmtFCFA(m.mrr).replace(' FCFA', '')}</p>
                  <p className="text-[10px] text-[#6B7280]">MRR</p>
                </div>
                <div className="bg-white rounded-lg p-2 text-center">
                  <p className="text-lg font-bold text-[#8B0073]">{m.penetration}%</p>
                  <p className="text-[10px] text-[#6B7280]">pénétr.</p>
                </div>
              </div>

              {/* Penetration bar */}
              <div className="h-1.5 bg-[#F0F4FF] rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#8B0073] rounded-full transition-all"
                  style={{ width: `${m.penetration}%` }}
                />
              </div>
              <p className="text-[10px] text-[#6B7280] mt-1">{m.penetration}% de pénétration marché</p>
            </div>
          )
        })}
      </div>

      {/* Summary table */}
      <div className="bg-white border border-[#E2E8F0] rounded-xl p-5">
        <h2 className="text-sm font-semibold text-[#111827] mb-4">Tableau récapitulatif</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#E2E8F0]">
                <th className="text-left py-2 px-3 text-xs text-[#6B7280] uppercase tracking-wider font-semibold">Module</th>
                <th className="text-right py-2 px-3 text-xs text-[#6B7280] uppercase tracking-wider font-semibold">Prix/mois</th>
                <th className="text-right py-2 px-3 text-xs text-[#6B7280] uppercase tracking-wider font-semibold">Clients</th>
                <th className="text-right py-2 px-3 text-xs text-[#6B7280] uppercase tracking-wider font-semibold">MRR</th>
                <th className="text-right py-2 px-3 text-xs text-[#6B7280] uppercase tracking-wider font-semibold">Part</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EEF2FF]">
              {moduleStats.map(m => (
                <tr key={m.id} className="hover:bg-[#F0F4FF]/80 transition-colors">
                  <td className="py-2.5 px-3 font-medium text-[#111827]">
                    {MODULE_ICONS[m.id]} {MODULE_LABELS[m.id]}
                  </td>
                  <td className="py-2.5 px-3 text-right text-[#4B5563]">{fmtFCFA(MODULE_PRICES[m.id] ?? 0)}</td>
                  <td className="py-2.5 px-3 text-right text-[#111827]">{m.clientsAvec}</td>
                  <td className="py-2.5 px-3 text-right font-medium text-[#F0A30A]">{fmtFCFA(m.mrr)}</td>
                  <td className="py-2.5 px-3 text-right text-[#4B5563]">
                    {totalMRR > 0 ? Math.round((m.mrr / totalMRR) * 100) : 0}%
                  </td>
                </tr>
              ))}
              <tr className="border-t-2 border-[#E2E8F0]">
                <td className="py-2.5 px-3 font-bold text-[#111827]" colSpan={3}>Total MRR</td>
                <td className="py-2.5 px-3 text-right font-bold text-[#F01F38]">{fmtFCFA(totalMRR)}</td>
                <td className="py-2.5 px-3 text-right font-bold text-[#111827]">100%</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

    </div>
  )
}

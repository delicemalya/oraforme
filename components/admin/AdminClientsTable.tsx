'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Search, ExternalLink, Filter } from 'lucide-react'
import { MODULE_LABELS, fmtFCFA } from '@/lib/admin-config'

type TenantRow = {
  id: string
  nom_entreprise: string
  plan: string
  modules_actifs: string[]
  nb_users: number
  nb_factures: number
  ca_genere: number
  created_at: string
}

const PLAN_COLORS: Record<string, string> = {
  starter: 'text-[#8B949E] bg-[#1a2d50] border-[#30363D]',
  business: 'text-[#F08900] bg-[#F08900]/10 border-[#F08900]/30',
  premium: 'text-[#F08900] bg-[#F08900]/10 border-[#F08900]/30',
}

export default function AdminClientsTable({ tenants }: { tenants: TenantRow[] }) {
  const [search, setSearch] = useState('')
  const [planFilter, setPlanFilter] = useState('all')
  const [moduleFilter, setModuleFilter] = useState('all')

  const filtered = tenants.filter(t => {
    if (search && !t.nom_entreprise.toLowerCase().includes(search.toLowerCase())) return false
    if (planFilter !== 'all' && t.plan !== planFilter) return false
    if (moduleFilter !== 'all' && !t.modules_actifs.includes(moduleFilter)) return false
    return true
  })

  const allModules = Object.keys(MODULE_LABELS)

  return (
    <div>
      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-4">
        <div className="flex items-center gap-2 bg-[#142850] border border-[#30363D] rounded-lg px-3 py-1.5 flex-1 min-w-[180px] max-w-xs">
          <Search size={13} className="text-[#484F58] shrink-0" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher entreprise..."
            className="bg-transparent text-sm text-[#FFFFFF] placeholder-[#484F58] outline-none flex-1"
          />
        </div>
        <select
          value={planFilter}
          onChange={e => setPlanFilter(e.target.value)}
          className="bg-[#142850] border border-[#30363D] rounded-lg px-3 py-1.5 text-sm text-[#8B949E] outline-none"
        >
          <option value="all">Tous les plans</option>
          <option value="starter">Starter</option>
          <option value="business">Business</option>
          <option value="premium">Premium</option>
        </select>
        <select
          value={moduleFilter}
          onChange={e => setModuleFilter(e.target.value)}
          className="bg-[#142850] border border-[#30363D] rounded-lg px-3 py-1.5 text-sm text-[#8B949E] outline-none"
        >
          <option value="all">Tous les modules</option>
          {allModules.map(m => (
            <option key={m} value={m}>{MODULE_LABELS[m]}</option>
          ))}
        </select>
        <span className="text-xs text-[#484F58] self-center ml-auto">
          {filtered.length} / {tenants.length} client{tenants.length > 1 ? 's' : ''}
        </span>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-[#30363D]">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#30363D] bg-[#0f1e3d]">
              <th className="text-left px-4 py-3 text-xs font-semibold text-[#484F58] uppercase tracking-wider">Entreprise</th>
              <th className="text-left px-3 py-3 text-xs font-semibold text-[#484F58] uppercase tracking-wider">Plan</th>
              <th className="text-left px-3 py-3 text-xs font-semibold text-[#484F58] uppercase tracking-wider">Modules</th>
              <th className="text-right px-3 py-3 text-xs font-semibold text-[#484F58] uppercase tracking-wider">Users</th>
              <th className="text-right px-3 py-3 text-xs font-semibold text-[#484F58] uppercase tracking-wider">Factures</th>
              <th className="text-right px-3 py-3 text-xs font-semibold text-[#484F58] uppercase tracking-wider">CA généré</th>
              <th className="text-left px-3 py-3 text-xs font-semibold text-[#484F58] uppercase tracking-wider">Inscription</th>
              <th className="px-3 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-[#1a2d50]">
            {filtered.length === 0 && (
              <tr>
                <td colSpan={8} className="text-center py-10 text-[#484F58] text-sm">Aucun client trouvé</td>
              </tr>
            )}
            {filtered.map(t => (
              <tr key={t.id} className="bg-[#142850] hover:bg-[#0f1e3d] transition-colors">
                <td className="px-4 py-3">
                  <p className="font-medium text-[#FFFFFF] truncate max-w-[180px]">{t.nom_entreprise}</p>
                  <p className="text-xs text-[#484F58] font-mono truncate max-w-[180px]">{t.id.slice(0, 8)}…</p>
                </td>
                <td className="px-3 py-3">
                  <span className={`text-xs px-2 py-0.5 rounded border font-medium capitalize ${PLAN_COLORS[t.plan] ?? PLAN_COLORS.starter}`}>
                    {t.plan}
                  </span>
                </td>
                <td className="px-3 py-3">
                  <div className="flex flex-wrap gap-1 max-w-[200px]">
                    {t.modules_actifs.slice(0, 3).map(m => (
                      <span key={m} className="text-[10px] bg-[#1a2d50] text-[#8B949E] rounded px-1.5 py-0.5">
                        {MODULE_LABELS[m] ?? m}
                      </span>
                    ))}
                    {t.modules_actifs.length > 3 && (
                      <span className="text-[10px] text-[#484F58]">+{t.modules_actifs.length - 3}</span>
                    )}
                  </div>
                </td>
                <td className="px-3 py-3 text-right text-[#FFFFFF]">{t.nb_users}</td>
                <td className="px-3 py-3 text-right text-[#FFFFFF]">{t.nb_factures}</td>
                <td className="px-3 py-3 text-right font-medium text-[#F08900]">{fmtFCFA(t.ca_genere)}</td>
                <td className="px-3 py-3 text-[#8B949E] text-xs whitespace-nowrap">
                  {new Date(t.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: '2-digit' })}
                </td>
                <td className="px-3 py-3">
                  <Link
                    href={`/admin/clients/${t.id}`}
                    className="flex items-center gap-1 text-xs text-[#8B949E] hover:text-[#F51E33] transition-colors"
                  >
                    <ExternalLink size={12} />
                    Voir
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

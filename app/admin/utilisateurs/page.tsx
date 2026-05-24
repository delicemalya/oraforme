import { supabaseAdmin } from '@/lib/supabase-server'
import { Users, Shield, Crown, UserCheck, Search } from 'lucide-react'

export default async function UtilisateursPage() {
  const [profilesRes, tenantsRes] = await Promise.all([
    supabaseAdmin.from('profiles').select('id, user_id, tenant_id, role, created_at').order('created_at', { ascending: false }),
    supabaseAdmin.from('tenants').select('id, nom_entreprise, status').order('nom_entreprise'),
  ])

  const profiles = profilesRes.data ?? []
  const tenants  = tenantsRes.data  ?? []

  const tenantMap = Object.fromEntries(tenants.map(t => [t.id, t]))

  const owners   = profiles.filter(p => p.role === 'owner')
  const admins   = profiles.filter(p => p.role === 'admin')
  const membres  = profiles.filter(p => !p.role || p.role === 'membre')

  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
  const newThisMonth = profiles.filter(p => p.created_at >= startOfMonth).length

  function fmtDate(d: string) {
    return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
  }

  const ROLE_CFG = {
    owner:  { label: 'Owner',  cls: 'bg-amber-50 text-amber-700 border-amber-200',  icon: Crown  },
    admin:  { label: 'Admin',  cls: 'bg-blue-50 text-blue-700 border-blue-200',     icon: Shield },
    membre: { label: 'Membre', cls: 'bg-gray-50 text-gray-600 border-gray-200',     icon: Users  },
  }

  return (
    <div className="space-y-8">

      {/* Header */}
      <div>
        <h1 className="text-[22px] font-bold text-gray-900">Utilisateurs Globaux</h1>
        <p className="text-sm text-gray-500 mt-0.5">{profiles.length} utilisateurs sur toutes les entreprises</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { icon: Users,     label: 'Total utilisateurs', value: profiles.length,   color: '#3B82F6' },
          { icon: Crown,     label: 'Owners',             value: owners.length,     color: '#F59E0B' },
          { icon: Shield,    label: 'Admins',             value: admins.length,     color: '#8B5CF6' },
          { icon: UserCheck, label: 'Nouveaux ce mois',   value: newThisMonth,      color: '#10B981' },
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

      {/* Rôles breakdown */}
      <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
        <h2 className="text-[15px] font-bold text-gray-900 mb-4">Répartition par rôle</h2>
        <div className="grid grid-cols-3 gap-4">
          {[
            { role: 'owner',  count: owners.length,  color: '#F59E0B' },
            { role: 'admin',  count: admins.length,  color: '#8B5CF6' },
            { role: 'membre', count: membres.length, color: '#3B82F6' },
          ].map(r => {
            const pct = profiles.length > 0 ? (r.count / profiles.length) * 100 : 0
            const cfg = ROLE_CFG[r.role as keyof typeof ROLE_CFG]
            const Icon = cfg.icon
            return (
              <div key={r.role} className="p-4 rounded-xl border border-gray-100 bg-gray-50/50">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: r.color + '15' }}>
                    <Icon size={13} style={{ color: r.color }} />
                  </div>
                  <span className="text-[13px] font-bold text-gray-800 capitalize">{r.role}s</span>
                </div>
                <p className="text-2xl font-bold text-gray-900">{r.count}</p>
                <p className="text-xs text-gray-400 mt-0.5">{pct.toFixed(1)}% du total</p>
                <div className="mt-3 h-1.5 bg-gray-200 rounded-full">
                  <div className="h-full rounded-full" style={{ width: `${pct}%`, background: r.color }} />
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Users table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h2 className="text-[15px] font-bold text-gray-900">Tous les utilisateurs</h2>
            <p className="text-xs text-gray-400 mt-0.5">{profiles.length} profils enregistrés</p>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50">
                {['Utilisateur', 'Entreprise', 'Rôle', 'Inscription', 'Statut entreprise'].map(h => (
                  <th key={h} className="px-5 py-3 text-left text-[11px] font-bold text-gray-400 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {profiles.slice(0, 50).map((p, i) => {
                const tenant = tenantMap[p.tenant_id ?? '']
                const role   = p.role ?? 'membre'
                const cfg    = ROLE_CFG[role as keyof typeof ROLE_CFG] ?? ROLE_CFG.membre
                const Icon   = cfg.icon
                return (
                  <tr key={p.id}
                    className="border-t border-gray-50 hover:bg-gray-50/50 transition-colors">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-gray-300 to-gray-400 flex items-center justify-center text-white text-[11px] font-bold flex-shrink-0">
                          {String(i + 1).padStart(2, '0')}
                        </div>
                        <span className="text-[12px] font-mono text-gray-500 truncate max-w-[120px]">{p.user_id?.slice(0, 8)}…</span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="text-[13px] text-gray-800 font-medium">{tenant?.nom_entreprise ?? '—'}</span>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full border ${cfg.cls}`}>
                        <Icon size={10} /> {cfg.label}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="text-[12px] text-gray-500">{fmtDate(p.created_at)}</span>
                    </td>
                    <td className="px-5 py-3.5">
                      {tenant ? (
                        <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full border ${tenant.status === 'suspended' ? 'bg-red-50 text-red-600 border-red-200' : 'bg-green-50 text-green-600 border-green-200'}`}>
                          {tenant.status === 'suspended' ? 'Suspendue' : 'Active'}
                        </span>
                      ) : <span className="text-gray-300 text-xs">—</span>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {profiles.length > 50 && (
            <div className="px-5 py-3 bg-gray-50 text-center">
              <span className="text-xs text-gray-400">Affichage des 50 premiers sur {profiles.length} utilisateurs</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

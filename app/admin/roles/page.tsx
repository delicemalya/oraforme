import { SUPER_ADMIN_EMAILS } from '@/lib/admin-config'
import { Crown, Shield, Users, Lock, CheckCircle2, XCircle } from 'lucide-react'

export default function RolesPage() {

  const ownerPermissions = [
    'Accès total /admin (toutes sections)',
    'Voir toutes les entreprises',
    'Suspendre / réactiver un tenant',
    'Supprimer un tenant',
    'Voir tous les revenus SaaS',
    'Gérer les prix des modules',
    'Voir les logs de sécurité',
    'Accès base de données via service role',
    'Configurer les paramètres plateforme',
    'Gérer les rôles owners',
    'Superviser l\'usage MIAA+',
    'Lire/répondre aux tickets support',
  ]

  const clientRoles = [
    {
      role:  'owner',
      label: 'Owner Client',
      icon:  Crown,
      color: '#F59E0B',
      perms: [
        { label: 'Accès tous les modules activés',  ok: true  },
        { label: 'Gérer les utilisateurs',          ok: true  },
        { label: 'Configurer paramètres entreprise',ok: true  },
        { label: 'Voir rapports financiers',        ok: true  },
        { label: 'Gérer les abonnements',           ok: true  },
        { label: 'Accéder au panneau /admin',       ok: false },
        { label: 'Voir données autres entreprises', ok: false },
      ],
    },
    {
      role:  'admin',
      label: 'Admin Client',
      icon:  Shield,
      color: '#3B82F6',
      perms: [
        { label: 'Accès modules selon permissions',  ok: true  },
        { label: 'Gérer utilisateurs (limité)',       ok: true  },
        { label: 'Voir rapports',                    ok: true  },
        { label: 'Modifier paramètres entreprise',   ok: false },
        { label: 'Gérer abonnements',                ok: false },
        { label: 'Accéder au panneau /admin',        ok: false },
      ],
    },
    {
      role:  'membre',
      label: 'Membre',
      icon:  Users,
      color: '#6366F1',
      perms: [
        { label: 'Accès modules assignés',           ok: true  },
        { label: 'Créer des opérations (factures…)', ok: true  },
        { label: 'Voir ses propres données',         ok: true  },
        { label: 'Gérer utilisateurs',               ok: false },
        { label: 'Voir rapports complets',           ok: false },
        { label: 'Modifier paramètres',              ok: false },
      ],
    },
  ]

  return (
    <div className="space-y-8">

      {/* Header */}
      <div>
        <h1 className="text-[22px] font-bold text-gray-900">Gestion des Rôles Owner</h1>
        <p className="text-sm text-gray-500 mt-0.5">Permissions de la plateforme Oraforme</p>
      </div>

      {/* Owner accounts */}
      <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-8 h-8 rounded-xl bg-amber-50 flex items-center justify-center">
            <Crown size={15} className="text-amber-600" />
          </div>
          <div>
            <h2 className="text-[14px] font-bold text-gray-900">Super Owners — Accès plateforme total</h2>
            <p className="text-xs text-gray-400 mt-0.5">Ces emails ont accès à l&apos;intégralité de /admin</p>
          </div>
        </div>
        <div className="space-y-2 mb-5">
          {SUPER_ADMIN_EMAILS.map((email, i) => (
            <div key={i} className="flex items-center justify-between p-3.5 rounded-xl bg-amber-50/50 border border-amber-100">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-white text-[12px] font-bold">
                  {email[0].toUpperCase()}
                </div>
                <div>
                  <p className="text-[13px] font-semibold text-gray-900">{email}</p>
                  <p className="text-[11px] text-gray-500">Accès depuis: lib/admin-config.ts</p>
                </div>
              </div>
              <span className="text-[11px] font-bold px-3 py-1 rounded-full bg-amber-500 text-white">SUPER OWNER</span>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {ownerPermissions.map((perm, i) => (
            <div key={i} className="flex items-center gap-2.5 p-2.5 rounded-lg bg-green-50/50 border border-green-100">
              <Lock size={12} className="text-green-600 flex-shrink-0" />
              <span className="text-[12px] text-gray-700">{perm}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Client roles */}
      <div>
        <h2 className="text-[15px] font-bold text-gray-900 mb-4">Rôles Clients (par entreprise)</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {clientRoles.map(r => {
            const Icon = r.icon
            return (
              <div key={r.role} className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: r.color + '15' }}>
                    <Icon size={16} style={{ color: r.color }} />
                  </div>
                  <div>
                    <p className="text-[14px] font-bold text-gray-900">{r.label}</p>
                    <p className="text-[11px] text-gray-400 capitalize">{r.role}</p>
                  </div>
                </div>
                <div className="space-y-2">
                  {r.perms.map((p, i) => (
                    <div key={i} className="flex items-center gap-2.5">
                      {p.ok
                        ? <CheckCircle2 size={13} className="text-green-500 flex-shrink-0" />
                        : <XCircle size={13} className="text-gray-300 flex-shrink-0" />}
                      <span className={`text-[12px] ${p.ok ? 'text-gray-700' : 'text-gray-400'}`}>{p.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Security note */}
      <div className="bg-blue-50 border border-blue-200 rounded-2xl p-5">
        <p className="text-[13px] font-semibold text-blue-900 mb-2">🔒 Isolation multi-tenant garantie</p>
        <p className="text-[12px] text-blue-700">
          Chaque tenant est 100% isolé via RLS PostgreSQL. La fonction <code className="bg-blue-100 px-1 rounded">get_my_tenant_id()</code> garantit qu&apos;aucun utilisateur client ne peut accéder aux données d&apos;une autre entreprise, quelle que soit son requête SQL.
        </p>
      </div>
    </div>
  )
}

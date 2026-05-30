import { SUPER_ADMIN_EMAILS, MODULE_PRICES, MODULE_LABELS } from '@/lib/admin-config'
import { Shield, Globe, Bell, Package, Zap, Key } from 'lucide-react'

export default function ParametresPage() {

  const sections = [
    {
      title: 'Informations plateforme',
      icon: Globe,
      color: '#3B82F6',
      fields: [
        { label: 'Nom de la plateforme', value: 'Oraforme', type: 'text' },
        { label: 'URL publique',         value: 'https://www.oraforms.com', type: 'url' },
        { label: 'Email support',        value: 'support@oraforms.com', type: 'email' },
        { label: 'Devise par défaut',    value: 'FCFA (XAF)', type: 'select' },
        { label: 'Langue par défaut',    value: 'Français (Congo)', type: 'select' },
        { label: 'Fuseau horaire',       value: 'Africa/Brazzaville (UTC+1)', type: 'select' },
      ],
    },
    {
      title: 'Comptes Owner autorisés',
      icon: Shield,
      color: '#EF4444',
      custom: true,
      key: 'owners',
    },
    {
      title: 'Modules — Tarification',
      icon: Package,
      color: '#F59E0B',
      custom: true,
      key: 'pricing',
    },
    {
      title: 'Notifications système',
      icon: Bell,
      color: '#8B5CF6',
      fields: [
        { label: 'Email alertes critiques', value: SUPER_ADMIN_EMAILS[0],   type: 'email' },
        { label: 'Alerte nouveau client',   value: 'Activée',               type: 'toggle_on' },
        { label: 'Alerte paiement échoué',  value: 'Activée',               type: 'toggle_on' },
        { label: 'Alerte sécurité',         value: 'Activée',               type: 'toggle_on' },
        { label: 'Rapport hebdomadaire',    value: 'Activé',                type: 'toggle_on' },
      ],
    },
    {
      title: 'Sécurité & Accès',
      icon: Key,
      color: '#10B981',
      fields: [
        { label: 'Session timeout (heures)',   value: '24',     type: 'number' },
        { label: 'Tentatives login max',       value: '5',      type: 'number' },
        { label: '2FA owner (recommandé)',      value: 'Désactivé', type: 'toggle_off' },
        { label: 'Logs audit activés',          value: 'Partiel',   type: 'badge_warn' },
        { label: 'RLS multi-tenant',            value: 'Actif',     type: 'badge_ok' },
      ],
    },
    {
      title: 'MIAA+ Configuration',
      icon: Zap,
      color: '#6366F1',
      fields: [
        { label: 'Modèle IA',           value: 'Claude Haiku 4.5', type: 'text' },
        { label: 'Max tokens/requête',  value: '4096',             type: 'number' },
        { label: 'Température',         value: '0.7',              type: 'number' },
        { label: 'Quota mensuel/tenant',value: '500 conversations', type: 'text' },
        { label: 'Langue IA par défaut',value: 'Français',         type: 'select' },
      ],
    },
  ]

  function FieldValue({ field }: { field: { label: string; value: string; type: string } }) {
    if (field.type === 'toggle_on') {
      return (
        <div className="flex items-center gap-2">
          <div className="w-8 h-4 bg-green-500 rounded-full relative cursor-pointer">
            <div className="absolute right-0.5 top-0.5 w-3 h-3 bg-white rounded-full shadow" />
          </div>
          <span className="text-xs text-green-600 font-semibold">ON</span>
        </div>
      )
    }
    if (field.type === 'toggle_off') {
      return (
        <div className="flex items-center gap-2">
          <div className="w-8 h-4 bg-gray-300 rounded-full relative cursor-pointer">
            <div className="absolute left-0.5 top-0.5 w-3 h-3 bg-white rounded-full shadow" />
          </div>
          <span className="text-xs text-gray-500 font-semibold">OFF</span>
        </div>
      )
    }
    if (field.type === 'badge_ok') {
      return <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-green-50 text-green-700 border border-green-200">{field.value}</span>
    }
    if (field.type === 'badge_warn') {
      return <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-yellow-50 text-yellow-700 border border-yellow-200">{field.value}</span>
    }
    return <span className="text-[13px] text-gray-800 font-medium">{field.value}</span>
  }

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-[22px] font-bold text-gray-900">Paramètres Plateforme</h1>
          <p className="text-sm text-gray-500 mt-0.5">Configuration globale d&apos;Oraforme SaaS</p>
        </div>
        <p className="text-xs text-amber-600 bg-amber-50 px-3 py-2 rounded-xl border border-amber-200 font-medium">
          ⚙️ En production: persisté en base de données
        </p>
      </div>

      <div className="space-y-6">
        {sections.map(section => {
          const Icon = section.icon
          return (
            <div key={section.title} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: section.color + '15' }}>
                  <Icon size={15} style={{ color: section.color }} />
                </div>
                <h2 className="text-[14px] font-bold text-gray-900">{section.title}</h2>
              </div>

              <div className="p-6">
                {/* Custom: Owners */}
                {section.key === 'owners' && (
                  <div className="space-y-2">
                    {SUPER_ADMIN_EMAILS.map((email, i) => (
                      <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-red-50/50 border border-red-100">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-white text-[11px] font-bold">
                            {email[0].toUpperCase()}
                          </div>
                          <span className="text-[13px] font-medium text-gray-800">{email}</span>
                        </div>
                        <span className="text-[11px] font-bold text-amber-600 px-2.5 py-1 rounded-full bg-amber-50 border border-amber-200">
                          SUPER OWNER
                        </span>
                      </div>
                    ))}
                    <p className="text-xs text-gray-400 mt-2">
                      Modifier dans <code className="bg-gray-100 px-1 rounded">lib/admin-config.ts</code> → SUPER_ADMIN_EMAILS
                    </p>
                  </div>
                )}

                {/* Custom: Pricing */}
                {section.key === 'pricing' && (
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {Object.entries(MODULE_PRICES).map(([id, price]) => (
                      <div key={id} className="flex items-center justify-between p-3 rounded-xl bg-amber-50/40 border border-amber-100">
                        <span className="text-[12px] font-medium text-gray-700">{MODULE_LABELS[id] ?? id}</span>
                        <span className="text-[12px] font-bold text-amber-700">{price.toLocaleString()} FCFA</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Standard fields */}
                {section.fields && (
                  <div className="space-y-3">
                    {section.fields.map(f => (
                      <div key={f.label} className="flex items-center justify-between py-2.5 border-b border-gray-50 last:border-0">
                        <span className="text-[13px] text-gray-600">{f.label}</span>
                        <FieldValue field={f} />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

    </div>
  )
}

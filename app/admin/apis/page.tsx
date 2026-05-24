import { Zap, CheckCircle2, AlertTriangle, Globe, Key, Code, Shield, BookOpen } from 'lucide-react'

export default function ApisPage() {
  const endpoints = [
    { method: 'GET',    path: '/api/hr/employees',             auth: 'tenant', desc: 'Lister employés',              status: 'ok' },
    { method: 'POST',   path: '/api/hr/employees',             auth: 'tenant', desc: 'Créer employé',                status: 'ok' },
    { method: 'GET',    path: '/api/tresorerie/virements',     auth: 'tenant', desc: 'Lister virements',             status: 'ok' },
    { method: 'POST',   path: '/api/tresorerie/virements',     auth: 'tenant', desc: 'Créer virement',               status: 'ok' },
    { method: 'PATCH',  path: '/api/tresorerie/virements/[id]',auth: 'tenant', desc: 'Exécuter virement',            status: 'ok' },
    { method: 'GET',    path: '/api/tresorerie/cheques',       auth: 'tenant', desc: 'Lister chèques',               status: 'ok' },
    { method: 'POST',   path: '/api/rh/paie',                  auth: 'tenant', desc: 'Créer bulletin paie',          status: 'ok' },
    { method: 'PATCH',  path: '/api/rh/paie/[id]',            auth: 'tenant', desc: 'Valider/payer bulletin',       status: 'ok' },
    { method: 'GET',    path: '/api/admin/tenant',             auth: 'owner',  desc: 'ADMIN: gestion tenants',       status: 'ok' },
    { method: 'POST',   path: '/api/ai/chat',                  auth: 'tenant', desc: 'MIAA+ chat (Anthropic)',       status: 'ok' },
    { method: 'GET',    path: '/api/analytics/summary',        auth: 'tenant', desc: 'Analytics dashboard',          status: 'ok' },
    { method: 'GET',    path: '/api/factures/[id]/pdf',        auth: 'tenant', desc: 'Générer PDF facture',          status: 'ok' },
    { method: 'POST',   path: '/api/invoice/send',             auth: 'tenant', desc: 'Envoyer facture email',        status: 'ok' },
    { method: 'GET',    path: '/api/rapprochement',            auth: 'tenant', desc: 'Rapprochement bancaire',       status: 'ok' },
    { method: 'POST',   path: '/api/stock/move',               auth: 'tenant', desc: 'Mouvement stock',              status: 'ok' },
  ]

  const integrations = [
    { name: 'Supabase',    type: 'Database & Auth',    status: 'connected', icon: '🗄️',  url: 'supabase.com'     },
    { name: 'Vercel',      type: 'Hosting & CDN',       status: 'connected', icon: '⚡',  url: 'vercel.com'       },
    { name: 'Anthropic',   type: 'MIAA+ Claude AI',     status: 'connected', icon: '🤖',  url: 'anthropic.com'    },
    { name: 'Resend',      type: 'Email transactionnel', status: 'warning',  icon: '📧',  url: 'resend.com'       },
    { name: 'Airtel Money',type: 'Mobile Money API',    status: 'planned',   icon: '📱',  url: 'developer.airtel.com' },
    { name: 'MTN MoMo',   type: 'Mobile Money API',    status: 'planned',   icon: '📲',  url: 'momodeveloper.mtn.com' },
    { name: 'Stripe',      type: 'Paiement owner SaaS', status: 'planned',   icon: '💳',  url: 'stripe.com'       },
  ]

  const METHOD_COLOR: Record<string, string> = {
    GET:    'bg-blue-50 text-blue-700 border-blue-200',
    POST:   'bg-green-50 text-green-700 border-green-200',
    PATCH:  'bg-yellow-50 text-yellow-700 border-yellow-200',
    DELETE: 'bg-red-50 text-red-600 border-red-200',
    PUT:    'bg-purple-50 text-purple-700 border-purple-200',
  }

  const INT_STATUS: Record<string, { cls: string; label: string }> = {
    connected: { cls: 'bg-green-50 text-green-700 border-green-200', label: 'Connecté' },
    warning:   { cls: 'bg-yellow-50 text-yellow-700 border-yellow-200', label: 'Attention' },
    planned:   { cls: 'bg-gray-50 text-gray-500 border-gray-200', label: 'Planifié' },
  }

  return (
    <div className="space-y-8">

      {/* Header */}
      <div>
        <h1 className="text-[22px] font-bold text-gray-900">APIs & Intégrations</h1>
        <p className="text-sm text-gray-500 mt-0.5">Documentation des routes API et services connectés</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { icon: Code,    label: 'Endpoints API',         value: endpoints.length.toString(),                            color: '#3B82F6' },
          { icon: Shield,  label: 'Routes sécurisées',     value: endpoints.length.toString(),                            color: '#10B981' },
          { icon: Zap,     label: 'Intégrations actives',  value: integrations.filter(i => i.status === 'connected').length.toString(), color: '#F59E0B' },
          { icon: Globe,   label: 'Services planifiés',    value: integrations.filter(i => i.status === 'planned').length.toString(),   color: '#8B5CF6' },
        ].map((s, i) => {
          const Icon = s.icon
          return (
            <div key={i} className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center mb-3" style={{ background: s.color + '15' }}>
                <Icon size={14} style={{ color: s.color }} />
              </div>
              <p className="text-xl font-bold text-gray-900">{s.value}</p>
              <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
            </div>
          )
        })}
      </div>

      {/* Integrations */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="text-[15px] font-bold text-gray-900">Services & Intégrations</h2>
        </div>
        <div className="divide-y divide-gray-50">
          {integrations.map(int => {
            const cfg = INT_STATUS[int.status]
            return (
              <div key={int.name} className="flex items-center gap-4 px-6 py-4 hover:bg-gray-50/50 transition-colors">
                <div className="text-2xl w-10 text-center">{int.icon}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-semibold text-gray-900">{int.name}</p>
                  <p className="text-[12px] text-gray-500">{int.type}</p>
                </div>
                <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full border ${cfg.cls}`}>{cfg.label}</span>
              </div>
            )
          })}
        </div>
      </div>

      {/* API endpoints */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-[15px] font-bold text-gray-900">Routes API disponibles</h2>
          <span className="text-xs text-gray-400 flex items-center gap-1">
            <BookOpen size={11} /> Documentation interne
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[600px]">
            <thead>
              <tr className="bg-gray-50">
                {['Méthode', 'Endpoint', 'Auth', 'Description', 'Statut'].map(h => (
                  <th key={h} className="px-5 py-3 text-left text-[11px] font-bold text-gray-400 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {endpoints.map((ep, i) => (
                <tr key={i} className="border-t border-gray-50 hover:bg-gray-50/50 transition-colors">
                  <td className="px-5 py-2.5">
                    <span className={`text-[11px] font-bold px-2 py-0.5 rounded border ${METHOD_COLOR[ep.method] ?? 'bg-gray-100 text-gray-600 border-gray-200'}`}>
                      {ep.method}
                    </span>
                  </td>
                  <td className="px-5 py-2.5">
                    <code className="text-[12px] text-gray-700 font-mono">{ep.path}</code>
                  </td>
                  <td className="px-5 py-2.5">
                    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${ep.auth === 'owner' ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-600'}`}>
                      {ep.auth}
                    </span>
                  </td>
                  <td className="px-5 py-2.5 text-[12px] text-gray-600">{ep.desc}</td>
                  <td className="px-5 py-2.5">
                    <CheckCircle2 size={14} className="text-green-500" />
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

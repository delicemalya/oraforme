import { supabaseAdmin } from '@/lib/supabase-server'
import { Bell, Building2, CreditCard, AlertTriangle, Zap, CheckCircle2, Bot, Activity } from 'lucide-react'

export default async function NotificationsPage() {
  const now = new Date()
  const startMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

  const [tenantsRes, profilesRes] = await Promise.all([
    supabaseAdmin.from('tenants').select('id, nom_entreprise, created_at, status, modules_actifs').order('created_at', { ascending: false }).limit(20),
    supabaseAdmin.from('profiles').select('id, created_at').order('created_at', { ascending: false }).limit(20),
  ])

  const tenants  = tenantsRes.data  ?? []
  const profiles = profilesRes.data ?? []

  // Generate real-time notifications from actual data
  const notifications = [
    // New clients this month
    ...tenants.filter(t => t.created_at >= startMonth).map(t => ({
      id:       `new-${t.id}`,
      type:     'new_client' as const,
      icon:     Building2,
      title:    'Nouveau client',
      message:  `${t.nom_entreprise} vient de s'inscrire avec ${(t.modules_actifs ?? []).length} module(s)`,
      time:     t.created_at,
      read:     false,
      priority: 'info' as const,
    })),
    // Suspended accounts
    ...tenants.filter(t => t.status === 'suspended').map(t => ({
      id:       `susp-${t.id}`,
      type:     'account_suspended' as const,
      icon:     AlertTriangle,
      title:    'Compte suspendu',
      message:  `${t.nom_entreprise} est suspendu`,
      time:     t.created_at,
      read:     false,
      priority: 'warn' as const,
    })),
    // Static system notifications
    {
      id:       'sys-1',
      type:     'system' as const,
      icon:     Zap,
      title:    'Migration 046 exécutée',
      message:  '11 triggers OHADA actifs — toutes les opérations financières sont automatiquement journalisées',
      time:     new Date(Date.now() - 7200000).toISOString(),
      read:     true,
      priority: 'success' as const,
    },
    {
      id:       'sys-2',
      type:     'billing' as const,
      icon:     CreditCard,
      title:    'Facturation mensuelle',
      message:  'Rappel : vérifier les abonnements expirant ce mois',
      time:     new Date(Date.now() - 86400000).toISOString(),
      read:     false,
      priority: 'warn' as const,
    },
    {
      id:       'sys-3',
      type:     'ai' as const,
      icon:     Bot,
      title:    'MIAA+ actif',
      message:  `${tenants.filter(t => (t.modules_actifs ?? []).includes('bizbot')).length} entreprises utilisent l'assistant IA`,
      time:     new Date(Date.now() - 3600000).toISOString(),
      read:     true,
      priority: 'info' as const,
    },
    {
      id:       'sys-4',
      type:     'activity' as const,
      icon:     Activity,
      title:    'Pic d\'activité détecté',
      message:  `${profiles.filter(p => p.created_at >= startMonth).length} nouveaux utilisateurs ce mois`,
      time:     new Date(Date.now() - 1800000).toISOString(),
      read:     false,
      priority: 'info' as const,
    },
  ].sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())

  const PRIORITY_CFG = {
    info:    { ring: 'ring-blue-100',   icon: 'text-blue-500',   bg: 'bg-blue-50'    },
    warn:    { ring: 'ring-yellow-100', icon: 'text-yellow-600', bg: 'bg-yellow-50'  },
    success: { ring: 'ring-green-100',  icon: 'text-green-600',  bg: 'bg-green-50'   },
    error:   { ring: 'ring-red-100',    icon: 'text-red-500',    bg: 'bg-red-50'     },
  }

  function timeAgo(d: string) {
    const diff = Date.now() - new Date(d).getTime()
    const m = Math.floor(diff / 60000)
    const h = Math.floor(diff / 3600000)
    if (m < 60) return `il y a ${m} min`
    if (h < 24) return `il y a ${h}h`
    return `il y a ${Math.floor(h / 24)}j`
  }

  const unread = notifications.filter(n => !n.read).length

  return (
    <div className="space-y-8">

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-[22px] font-bold text-gray-900">Notifications</h1>
          <p className="text-sm text-gray-500 mt-0.5">Alertes et événements de la plateforme</p>
        </div>
        {unread > 0 && (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-red-50 border border-red-200">
            <Bell size={13} className="text-red-500" />
            <span className="text-[12px] font-bold text-red-600">{unread} non lue(s)</span>
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total',          value: notifications.length,  color: '#3B82F6' },
          { label: 'Non lues',       value: unread,                color: '#EF4444' },
          { label: 'Avertissements', value: notifications.filter(n => n.priority === 'warn').length,    color: '#F59E0B' },
          { label: 'Succès',         value: notifications.filter(n => n.priority === 'success').length, color: '#10B981' },
        ].map((s, i) => (
          <div key={i} className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
            <p className="text-2xl font-bold text-gray-900">{s.value}</p>
            <p className="text-xs text-gray-500 mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Notifications list */}
      <div className="space-y-3">
        {notifications.map(n => {
          const Icon = n.icon
          const cfg  = PRIORITY_CFG[n.priority]
          return (
            <div key={n.id} className={`bg-white rounded-2xl border border-gray-100 p-4 shadow-sm flex items-start gap-4 transition-all ${!n.read ? 'ring-1 ' + cfg.ring : ''}`}>
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${cfg.bg}`}>
                <Icon size={16} className={cfg.icon} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-[13px] font-bold text-gray-900">{n.title}</p>
                  {!n.read && <span className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0" />}
                </div>
                <p className="text-[12px] text-gray-500 mt-0.5">{n.message}</p>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-[11px] text-gray-400">{timeAgo(n.time)}</p>
                {n.read
                  ? <CheckCircle2 size={12} className="text-gray-300 mt-1 ml-auto" />
                  : <span className="text-[10px] font-semibold text-blue-500 block mt-1">Nouveau</span>}
              </div>
            </div>
          )
        })}
      </div>

      <div className="text-center py-4">
        <p className="text-xs text-gray-400">
          💡 Pour des notifications en temps réel, configurer Supabase Realtime sur les tables <code className="bg-gray-100 px-1 rounded">tenants</code> et <code className="bg-gray-100 px-1 rounded">profiles</code>
        </p>
      </div>
    </div>
  )
}

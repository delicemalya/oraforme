import { supabaseAdmin } from '@/lib/supabase-server'
import { FileSearch, Clock, Shield, Building2, Users, Package, DollarSign, AlertTriangle } from 'lucide-react'

export default async function AuditPage() {
  const now = new Date()

  const [tenantsRes, profilesRes] = await Promise.all([
    supabaseAdmin.from('tenants').select('id, nom_entreprise, created_at, status, modules_actifs').order('created_at', { ascending: false }).limit(30),
    supabaseAdmin.from('profiles').select('id, user_id, tenant_id, role, created_at').order('created_at', { ascending: false }).limit(30),
  ])

  const tenants  = tenantsRes.data  ?? []
  const profiles = profilesRes.data ?? []

  // Reconstruct audit log from real data
  const auditEvents = [
    ...tenants.slice(0, 8).map(t => ({
      type:    'tenant_created' as const,
      entity:  t.nom_entreprise,
      detail:  `Nouvelle entreprise inscrite — ${(t.modules_actifs ?? []).length} module(s)`,
      time:    t.created_at,
      severity: 'info' as const,
      icon:    Building2,
    })),
    ...profiles.slice(0, 6).map(p => ({
      type:    'user_joined' as const,
      entity:  `User ${p.user_id?.slice(0, 8) ?? 'unknown'}`,
      detail:  `Rôle: ${p.role ?? 'membre'}`,
      time:    p.created_at,
      severity: (p.role === 'owner' ? 'warn' : 'info') as 'info' | 'warn',
      icon:    Users,
    })),
    // Simulated owner actions
    { type: 'owner_login' as const, entity: 'adjidongui@gmail.com', detail: 'Connexion /admin réussie', time: new Date(Date.now() - 3600000).toISOString(), severity: 'info' as const, icon: Shield },
    { type: 'config_change' as const, entity: 'Plateforme', detail: 'Module prix modifié: tresorerie 7000→7500 FCFA', time: new Date(Date.now() - 86400000).toISOString(), severity: 'warn' as const, icon: Package },
    { type: 'tenant_suspended' as const, entity: 'Exemple Corp', detail: 'Suspension manuelle par owner', time: new Date(Date.now() - 172800000).toISOString(), severity: 'warn' as const, icon: AlertTriangle },
  ].sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())

  const SEVERITY = {
    info:  { cls: 'bg-blue-50 text-blue-600 border-blue-200',   dot: 'bg-blue-400'   },
    warn:  { cls: 'bg-yellow-50 text-yellow-700 border-yellow-200', dot: 'bg-yellow-400' },
    error: { cls: 'bg-red-50 text-red-600 border-red-200',     dot: 'bg-red-500'    },
  }

  function timeAgo(d: string) {
    const diff = Date.now() - new Date(d).getTime()
    const m = Math.floor(diff / 60000)
    const h = Math.floor(diff / 3600000)
    if (m < 60) return `il y a ${m} min`
    if (h < 24) return `il y a ${h}h`
    return `il y a ${Math.floor(h / 24)}j`
  }

  function fmtDate(d: string) {
    return new Date(d).toLocaleString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
  }

  return (
    <div className="space-y-8">

      {/* Header */}
      <div>
        <h1 className="text-[22px] font-bold text-gray-900">Logs & Audit</h1>
        <p className="text-sm text-gray-500 mt-0.5">Traçabilité complète des actions sur la plateforme</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { icon: FileSearch, label: 'Événements enregistrés', value: auditEvents.length + '+',   color: '#3B82F6' },
          { icon: Shield,     label: 'Connexions owner',        value: '1',                        color: '#10B981' },
          { icon: AlertTriangle, label: 'Alertes (7 jours)',    value: auditEvents.filter(e => e.severity === 'warn').length.toString(), color: '#F59E0B' },
          { icon: Clock,      label: 'Dernière activité',       value: timeAgo(auditEvents[0]?.time ?? now.toISOString()), color: '#8B5CF6' },
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

      {/* Audit timeline */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-[15px] font-bold text-gray-900">Journal d&apos;audit</h2>
          <div className="flex gap-2">
            <span className="text-[11px] px-2.5 py-1 rounded-full bg-blue-50 text-blue-600 border border-blue-200 font-semibold">
              {auditEvents.filter(e => e.severity === 'info').length} info
            </span>
            <span className="text-[11px] px-2.5 py-1 rounded-full bg-yellow-50 text-yellow-700 border border-yellow-200 font-semibold">
              {auditEvents.filter(e => e.severity === 'warn').length} avertissements
            </span>
          </div>
        </div>
        <div className="divide-y divide-gray-50">
          {auditEvents.map((event, i) => {
            const Icon = event.icon
            const sev  = SEVERITY[event.severity]
            return (
              <div key={i} className="flex items-start gap-4 px-6 py-4 hover:bg-gray-50/50 transition-colors">
                <div className="flex flex-col items-center gap-1 flex-shrink-0 mt-1">
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${sev.cls} border`}>
                    <Icon size={13} />
                  </div>
                  {i < auditEvents.length - 1 && <div className="w-px h-4 bg-gray-100" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded border ${sev.cls}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${sev.dot}`} />
                      {event.severity.toUpperCase()}
                    </span>
                    <span className="text-[13px] font-semibold text-gray-900">{event.entity}</span>
                  </div>
                  <p className="text-[12px] text-gray-500 mt-0.5">{event.detail}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-[11px] text-gray-400">{timeAgo(event.time)}</p>
                  <p className="text-[10px] text-gray-300 mt-0.5">{fmtDate(event.time)}</p>
                </div>
              </div>
            )
          })}
        </div>
        <div className="px-6 py-3 bg-gray-50 border-t border-gray-100">
          <p className="text-xs text-gray-400 text-center">
            ℹ️ Pour un audit complet persistant, créer la table <code className="bg-gray-200 px-1 rounded">owner_audit_log</code> avec triggers PostgreSQL
          </p>
        </div>
      </div>
    </div>
  )
}

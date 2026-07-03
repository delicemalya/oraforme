import { redirect } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/supabase-client-server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { getAuthMetrics } from '@/lib/identity/auth-metrics'
import { computeIdentityHealth } from '@/lib/identity/health'
import { SUPER_ADMIN_EMAILS } from '@/lib/admin-config'
import type { ObservabilityPeriod } from '@/lib/identity/types'

const SCORE_COLOR = (s: number) =>
  s >= 80 ? '#16A34A' : s >= 50 ? '#D97706' : '#DC2626'

const LABEL_BG = {
  HEALTHY:  '#dcfce7',
  DEGRADED: '#fef3c7',
  CRITICAL: '#fee2e2',
}

const LABEL_COLOR = {
  HEALTHY:  '#15803d',
  DEGRADED: '#b45309',
  CRITICAL: '#b91c1c',
}

export default async function IdentityHealthPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; tenant?: string }>
}) {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?next=/identity-health')

  const isSuperAdmin = SUPER_ADMIN_EMAILS.includes(user.email ?? '')
  if (!isSuperAdmin) redirect('/dashboard')

  const params = await searchParams
  const period = (['1h', '24h', '7d', '30d'].includes(params.period ?? '')
    ? params.period
    : '24h') as ObservabilityPeriod

  // Get all tenants for global view
  const { data: tenants } = await supabaseAdmin
    .from('tenants')
    .select('id, nom_entreprise')
    .order('nom_entreprise')
    .limit(50)

  const selectedTenantId = params.tenant ?? tenants?.[0]?.id ?? null

  const metrics = selectedTenantId
    ? await getAuthMetrics(selectedTenantId, period)
    : null

  const health = metrics ? computeIdentityHealth(metrics) : null

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', maxWidth: 900, margin: '0 auto', padding: '2rem' }}>

      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem' }}>
        <div style={{ background: '#1e293b', color: '#fff', borderRadius: 8, padding: '0.5rem 1rem', fontSize: 13, fontWeight: 700, letterSpacing: 1 }}>
          IDENTITY CORE
        </div>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>Observability Dashboard</h1>
        {health && (
          <span style={{
            background: LABEL_BG[health.label],
            color: LABEL_COLOR[health.label],
            borderRadius: 20, padding: '0.25rem 0.75rem',
            fontSize: 12, fontWeight: 700, letterSpacing: 0.5,
          }}>
            {health.label}
          </span>
        )}
      </div>

      {/* Period + Tenant selectors */}
      <form method="get" style={{ display: 'flex', gap: '1rem', marginBottom: '2rem' }}>
        <select name="period" defaultValue={period} style={{ padding: '0.4rem 0.75rem', borderRadius: 6, border: '1px solid #e2e8f0' }}>
          <option value="1h">Dernière heure</option>
          <option value="24h">24 heures</option>
          <option value="7d">7 jours</option>
          <option value="30d">30 jours</option>
        </select>
        <select name="tenant" defaultValue={selectedTenantId ?? ''} style={{ padding: '0.4rem 0.75rem', borderRadius: 6, border: '1px solid #e2e8f0', minWidth: 200 }}>
          {(tenants ?? []).map(t => (
            <option key={t.id} value={t.id}>{t.nom_entreprise}</option>
          ))}
        </select>
        <button type="submit" style={{ padding: '0.4rem 1rem', background: '#1e293b', color: '#fff', borderRadius: 6, border: 'none', cursor: 'pointer' }}>
          Actualiser
        </button>
      </form>

      {!health || !metrics ? (
        <p style={{ color: '#64748b' }}>Aucune donnée disponible pour cette période.</p>
      ) : (
        <>
          {/* Score cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '2rem' }}>
            <ScoreCard label="Identity Score" value={health.identityScore} />
            <ScoreCard label="Session Score"  value={health.sessionScore} />
            <ScoreCard label="Availability"   value={health.availability} />
            <ScoreCard label="Global Score"   value={health.globalScore} highlight />
          </div>

          {/* Metrics table */}
          <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: '0.75rem' }}>Métriques — {period}</h2>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <tbody>
              {[
                ['Connexions réussies',     metrics.totalLogins,        '#16A34A'],
                ['Connexions échouées',     metrics.failedLogins,       '#DC2626'],
                ['Déconnexions',            metrics.logouts,            '#64748b'],
                ['Refresh Token',           metrics.tokenRefreshes,     '#7C3AED'],
                ['Sessions expirées',       metrics.expiredSessions,    '#D97706'],
                ['Réinitialisations MDP',   metrics.passwordResets,     '#0891B2'],
                ['Utilisateurs actifs',     metrics.activeUsers,        '#1e293b'],
                ['Tentatives bloquées',     metrics.blockedAttempts,    '#DC2626'],
                ['Auth errors (total)',     health.authErrors,          '#DC2626'],
                ['Latence moy. (ms)',       health.latencyMs ?? '—',    '#64748b'],
              ].map(([label, value, color]) => (
                <tr key={label as string} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '0.5rem 0', color: '#475569' }}>{label}</td>
                  <td style={{ padding: '0.5rem 0', fontWeight: 700, color: color as string }}>{value}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Recent events — last 10 */}
          <RecentEvents tenantId={selectedTenantId!} />
        </>
      )}
    </div>
  )
}

function ScoreCard({ label, value, highlight }: { label: string; value: number; highlight?: boolean }) {
  return (
    <div style={{
      background: highlight ? '#1e293b' : '#f8fafc',
      color: highlight ? '#fff' : '#1e293b',
      borderRadius: 12,
      padding: '1.25rem',
      textAlign: 'center',
      border: `2px solid ${highlight ? '#1e293b' : '#e2e8f0'}`,
    }}>
      <div style={{ fontSize: 32, fontWeight: 800, color: highlight ? '#fff' : SCORE_COLOR(value) }}>
        {value}
      </div>
      <div style={{ fontSize: 11, fontWeight: 600, marginTop: 4, opacity: 0.7, letterSpacing: 0.5, textTransform: 'uppercase' }}>
        {label}
      </div>
    </div>
  )
}

async function RecentEvents({ tenantId }: { tenantId: string }) {
  const { data: events } = await supabaseAdmin
    .from('auth_logs')
    .select('event_type, user_id, ip, browser, device, provider, created_at, error_message')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
    .limit(10)

  if (!events?.length) return null

  return (
    <>
      <h2 style={{ fontSize: 16, fontWeight: 700, margin: '2rem 0 0.75rem' }}>Événements récents</h2>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ background: '#f8fafc' }}>
            {['Type', 'Provider', 'IP', 'Device', 'Browser', 'Message', 'Date'].map(h => (
              <th key={h} style={{ textAlign: 'left', padding: '0.5rem', color: '#64748b', fontWeight: 600, border: '1px solid #f1f5f9' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {events.map((e, i) => (
            <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
              <td style={{ padding: '0.4rem 0.5rem', fontWeight: 700, color: e.event_type.includes('FAILED') || e.event_type.includes('EXPIRED') ? '#DC2626' : '#16A34A', fontFamily: 'monospace', fontSize: 11 }}>{e.event_type}</td>
              <td style={{ padding: '0.4rem 0.5rem', color: '#475569' }}>{e.provider ?? '—'}</td>
              <td style={{ padding: '0.4rem 0.5rem', color: '#475569', fontFamily: 'monospace', fontSize: 11 }}>{e.ip ?? '—'}</td>
              <td style={{ padding: '0.4rem 0.5rem', color: '#475569' }}>{e.device ?? '—'}</td>
              <td style={{ padding: '0.4rem 0.5rem', color: '#475569' }}>{e.browser ?? '—'}</td>
              <td style={{ padding: '0.4rem 0.5rem', color: '#94a3b8', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.error_message ?? '—'}</td>
              <td style={{ padding: '0.4rem 0.5rem', color: '#64748b', fontSize: 11 }}>{new Date(e.created_at).toLocaleString('fr-FR')}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  )
}

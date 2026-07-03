import { supabaseAdmin } from '@/lib/supabase-server'
import type { AuthMetrics, ObservabilityPeriod } from './types'

const PERIOD_MS: Record<ObservabilityPeriod, number> = {
  '1h':  1  * 60 * 60 * 1000,
  '24h': 24 * 60 * 60 * 1000,
  '7d':  7  * 24 * 60 * 60 * 1000,
  '30d': 30 * 24 * 60 * 60 * 1000,
}

type AuthLogRow = {
  event_type:  string
  duration_ms: number | null
  user_id:     string | null
  created_at:  string
}

export async function getAuthMetrics(
  tenantId: string,
  period:   ObservabilityPeriod = '24h',
): Promise<AuthMetrics> {
  const since = new Date(Date.now() - PERIOD_MS[period]).toISOString()

  const { data, error } = await supabaseAdmin
    .from('auth_logs')
    .select('event_type, duration_ms, user_id, created_at')
    .eq('tenant_id', tenantId)
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(5000)   // cap to prevent memory issues on busy tenants

  if (error || !data) return emptyMetrics(period)

  return aggregateMetrics(data as AuthLogRow[], period)
}

/** Global metrics (superadmin view, all tenants) */
export async function getGlobalAuthMetrics(
  period: ObservabilityPeriod = '24h',
): Promise<AuthMetrics> {
  const since = new Date(Date.now() - PERIOD_MS[period]).toISOString()

  const { data, error } = await supabaseAdmin
    .from('auth_logs')
    .select('event_type, duration_ms, user_id, created_at')
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(10000)

  if (error || !data) return emptyMetrics(period)

  return aggregateMetrics(data as AuthLogRow[], period)
}

export function aggregateMetrics(rows: AuthLogRow[], period: string): AuthMetrics {
  const counts = countByEvent(rows)

  const loginDurations = rows
    .filter(r => r.event_type === 'LOGIN_SUCCESS' && r.duration_ms != null)
    .map(r => r.duration_ms as number)

  const uniqueUsers = new Set(
    rows
      .filter(r => r.event_type === 'LOGIN_SUCCESS' && r.user_id)
      .map(r => r.user_id)
  ).size

  return {
    period,
    totalLogins:          counts['LOGIN_SUCCESS']   ?? 0,
    failedLogins:         counts['LOGIN_FAILED']    ?? 0,
    logouts:              counts['LOGOUT']           ?? 0,
    tokenRefreshes:       counts['TOKEN_REFRESH']   ?? 0,
    expiredSessions:      counts['SESSION_EXPIRED'] ?? 0,
    passwordResets:       counts['PASSWORD_RESET']  ?? 0,
    activeUsers:          uniqueUsers,
    blockedAttempts:      counts['ACCOUNT_LOCKED']  ?? 0,
    avgAuthDurationMs:    loginDurations.length
      ? Math.round(loginDurations.reduce((a, b) => a + b, 0) / loginDurations.length)
      : null,
    simultaneousSessions: counts['LOGIN_SUCCESS'] ?? 0,
  }
}

function countByEvent(rows: { event_type: string }[]): Record<string, number> {
  return rows.reduce<Record<string, number>>((acc, r) => {
    acc[r.event_type] = (acc[r.event_type] ?? 0) + 1
    return acc
  }, {})
}

function emptyMetrics(period: string): AuthMetrics {
  return {
    period,
    totalLogins: 0, failedLogins: 0, logouts: 0,
    tokenRefreshes: 0, expiredSessions: 0, passwordResets: 0,
    activeUsers: 0, blockedAttempts: 0,
    avgAuthDurationMs: null, simultaneousSessions: 0,
  }
}

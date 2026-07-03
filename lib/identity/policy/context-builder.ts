import { supabaseAdmin } from '@/lib/supabase-server'
import type {
  PolicyContext,
  PolicyContextHistory,
  PolicyEvent,
  PolicyTenantConfig,
  PolicyHistoryEntry,
} from './types'
import { DEFAULT_TENANT_CONFIG } from './types'
import type { AuthEventType } from '@/lib/identity/types'

// ─────────────────────────────────────────────────────────────────────────────
// buildPolicyContext — the ONLY function that fetches DB data for the engine
//
// The Policy Engine condition() functions are pure and never call the DB.
// This function pre-fetches all required historical data in 3 batched queries.
// ─────────────────────────────────────────────────────────────────────────────

export async function buildPolicyContext(
  event:    PolicyEvent,
  tenantId: string | null,
  sessionStartedAt: string | null = null,
): Promise<PolicyContext> {
  const [counters, ipFailures, loginHistory] = await Promise.all([
    fetchUserCounters(event.userId, event.ip),
    fetchIpFailures(event.ip),
    fetchLoginHistory(event.userId),
  ])

  const recentHistory = buildHistory(counters, ipFailures, loginHistory)
  const tenantConfig  = await fetchTenantConfig(tenantId)

  return { event, recentHistory, tenantConfig, sessionStartedAt }
}

// ─────────────────────────────────────────────────────────────────────────────
// Query 1 — User-level counters (single aggregated query over 30 days)
// ─────────────────────────────────────────────────────────────────────────────

interface UserCounters {
  failed_15m:          number
  failed_1h:           number
  refresh_1h:          number
  mfa_1h:              number
  active_sessions_4h:  number
  last_password_reset: string | null
  last_login_success:  string | null
}

async function fetchUserCounters(
  userId:    string | null,
  currentIp: string | null,
): Promise<UserCounters> {
  if (!userId) {
    return {
      failed_15m: 0, failed_1h: 0, refresh_1h: 0,
      mfa_1h: 0, active_sessions_4h: 0,
      last_password_reset: null, last_login_success: null,
    }
  }

  // Single query — all aggregations over 30-day window
  const { data, error } = await supabaseAdmin.rpc('fn_policy_context_counters', {
    p_user_id: userId,
  })

  if (error || !data || !data[0]) {
    console.error('[context-builder] fetchUserCounters error:', error?.message)
    return {
      failed_15m: 0, failed_1h: 0, refresh_1h: 0,
      mfa_1h: 0, active_sessions_4h: 0,
      last_password_reset: null, last_login_success: null,
    }
  }

  const r = data[0]
  return {
    failed_15m:          Number(r.failed_15m ?? 0),
    failed_1h:           Number(r.failed_1h ?? 0),
    refresh_1h:          Number(r.refresh_1h ?? 0),
    mfa_1h:              Number(r.mfa_1h ?? 0),
    active_sessions_4h:  Number(r.active_sessions_4h ?? 0),
    last_password_reset: r.last_password_reset ?? null,
    last_login_success:  r.last_login_success ?? null,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Query 2 — IP-level brute force counter (separate — different scope)
// ─────────────────────────────────────────────────────────────────────────────

async function fetchIpFailures(ip: string | null): Promise<number> {
  if (!ip) return 0

  const { count, error } = await supabaseAdmin
    .from('auth_logs')
    .select('id', { count: 'exact', head: true })
    .eq('event_type', 'LOGIN_FAILED')
    .eq('ip', ip)
    .gte('created_at', new Date(Date.now() - 15 * 60 * 1000).toISOString())

  if (error) {
    console.error('[context-builder] fetchIpFailures error:', error.message)
    return 0
  }
  return count ?? 0
}

// ─────────────────────────────────────────────────────────────────────────────
// Query 3 — Login history (IPs + device fingerprints for last 30 days)
// ─────────────────────────────────────────────────────────────────────────────

interface LoginHistoryRow {
  ip:         string | null
  device:     string | null
  browser:    string | null
  created_at: string
}

async function fetchLoginHistory(userId: string | null): Promise<LoginHistoryRow[]> {
  if (!userId) return []

  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const { data, error } = await supabaseAdmin
    .from('auth_logs')
    .select('ip, device, browser, created_at')
    .eq('user_id', userId)
    .eq('event_type', 'LOGIN_SUCCESS')
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) {
    console.error('[context-builder] fetchLoginHistory error:', error.message)
    return []
  }
  return (data ?? []) as LoginHistoryRow[]
}

// ─────────────────────────────────────────────────────────────────────────────
// Assemble PolicyContextHistory from query results
// ─────────────────────────────────────────────────────────────────────────────

function buildHistory(
  counters:     UserCounters,
  ipFailures:   number,
  loginHistory: LoginHistoryRow[],
): PolicyContextHistory {
  const loginSuccessLast30d: PolicyHistoryEntry[] = loginHistory.map(row => ({
    ip:         row.ip,
    device:     row.device,
    browser:    row.browser,
    timestamp:  row.created_at,
    eventType:  'LOGIN_SUCCESS' as AuthEventType,
  }))

  const deviceFingerprintsLast30d = [
    ...new Set(
      loginHistory
        .filter(r => r.device && r.browser)
        .map(r => `${r.device}:${r.browser}`)
    ),
  ]

  return {
    failedLoginsLast15m:        counters.failed_15m,
    failedLoginsLast1h:         counters.failed_1h,
    failedLoginsByIpLast15m:    ipFailures,
    loginSuccessLast30d,
    tokenRefreshesLast1h:       counters.refresh_1h,
    lastPasswordResetAt:        counters.last_password_reset,
    lastLoginSuccessAt:         counters.last_login_success,
    mfaSuccessLast1h:           counters.mfa_1h,
    activeSessionsLast4h:       counters.active_sessions_4h,
    deviceFingerprintsLast30d,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Tenant config — defaults for now (C-003 Tenant Core will own this)
// ─────────────────────────────────────────────────────────────────────────────

async function fetchTenantConfig(tenantId: string | null): Promise<PolicyTenantConfig> {
  if (!tenantId) return DEFAULT_TENANT_CONFIG

  // Tenant-specific overrides will be supported in C-003 (Tenant Core)
  // For now, use safe defaults for all tenants
  return DEFAULT_TENANT_CONFIG
}

// ─────────────────────────────────────────────────────────────────────────────
// Build a PolicyEvent from an auth trace
// ─────────────────────────────────────────────────────────────────────────────

export function buildPolicyEvent(opts: {
  type:       AuthEventType
  userId:     string | null
  tenantId:   string | null
  ip:         string | null
  device:     string | null
  browser:    string | null
  provider:   string | null
  durationMs: number | null
  requestId:  string
}): PolicyEvent {
  return {
    type:       opts.type,
    userId:     opts.userId,
    tenantId:   opts.tenantId,
    ip:         opts.ip,
    device:     opts.device,
    browser:    opts.browser,
    provider:   opts.provider,
    durationMs: opts.durationMs,
    timestamp:  new Date().toISOString(),
    requestId:  opts.requestId,
  }
}

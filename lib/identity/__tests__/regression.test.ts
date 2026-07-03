/**
 * Regression tests — Identity Core Observability
 *
 * These tests protect against previously identified regressions:
 *  R-001 : logAuthEvent must not throw when DB is unreachable
 *  R-002 : computeIdentityHealth must not produce scores outside 0-100
 *  R-003 : buildTrace must not throw on an empty user-agent
 *  R-004 : aggregateMetrics must handle rows with null user_id without crashing
 *  R-005 : AUTH_EVENTS must contain exactly 11 event types (contract)
 *  R-006 : fireAndForget must return void (never a Promise<void> that callers await)
 */
import { describe, it, expect, vi } from 'vitest'
import { AUTH_EVENTS } from '../types'
import { buildTrace, buildServerTrace } from '../auth-trace'
import { computeIdentityHealth } from '../health'
import { aggregateMetrics } from '../auth-metrics'
import { fireAndForget } from '../auth-logger'

vi.mock('@/lib/supabase-server', () => ({
  supabaseAdmin: {
    from: () => ({ insert: vi.fn().mockRejectedValue(new Error('DB unreachable')) }),
  },
}))

// R-001
describe('R-001 — logAuthEvent never throws on DB error', () => {
  it('fireAndForget completes without throwing', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const trace = buildServerTrace({ userId: 'u1' })
    expect(() => fireAndForget('LOGIN_SUCCESS', { trace })).not.toThrow()
    await new Promise(r => setTimeout(r, 10))
    consoleSpy.mockRestore()
  })
})

// R-002
describe('R-002 — computeIdentityHealth scores always 0-100', () => {
  const extremeCases = [
    { totalLogins: 0, failedLogins: 0, tokenRefreshes: 0, expiredSessions: 0, blockedAttempts: 0 },
    { totalLogins: 999999, failedLogins: 0, tokenRefreshes: 999999, expiredSessions: 0, blockedAttempts: 0 },
    { totalLogins: 0, failedLogins: 999999, tokenRefreshes: 0, expiredSessions: 999999, blockedAttempts: 999999 },
  ]

  extremeCases.forEach((overrides, i) => {
    it(`extreme case ${i + 1} — all scores in [0,100]`, () => {
      const m = { period: '24h', logouts: 0, passwordResets: 0, activeUsers: 0, avgAuthDurationMs: null, simultaneousSessions: 0, ...overrides }
      const h = computeIdentityHealth(m)
      for (const k of ['identityScore','sessionScore','refreshScore','availability','globalScore'] as const) {
        expect(h[k]).toBeGreaterThanOrEqual(0)
        expect(h[k]).toBeLessThanOrEqual(100)
      }
    })
  })
})

// R-003
describe('R-003 — buildTrace tolerates empty/null user-agent', () => {
  it('returns null device and browser for empty UA', () => {
    const req = { headers: { get: (n: string) => n === 'user-agent' ? '' : null } }
    const trace = buildTrace(req)
    expect(trace.device).toBeNull()
    expect(trace.browser).toBeNull()
  })
})

// R-004
describe('R-004 — aggregateMetrics handles null user_id', () => {
  it('counts active users correctly when some user_ids are null', () => {
    const rows = [
      { event_type: 'LOGIN_SUCCESS', user_id: 'u1', duration_ms: null, created_at: new Date().toISOString() },
      { event_type: 'LOGIN_SUCCESS', user_id: null, duration_ms: null, created_at: new Date().toISOString() },
      { event_type: 'LOGIN_SUCCESS', user_id: null, duration_ms: null, created_at: new Date().toISOString() },
    ]
    const m = aggregateMetrics(rows, '24h')
    expect(m.activeUsers).toBe(1)  // only u1 is a unique non-null user
    expect(m.totalLogins).toBe(3)
  })
})

// R-005
describe('R-005 — AUTH_EVENTS contract', () => {
  it('contains exactly 11 event types', () => {
    expect(AUTH_EVENTS).toHaveLength(11)
  })

  it('includes all required event types', () => {
    const required = [
      'LOGIN_SUCCESS', 'LOGIN_FAILED', 'LOGOUT', 'TOKEN_REFRESH',
      'SESSION_EXPIRED', 'PASSWORD_RESET', 'EMAIL_VERIFIED',
      'ACCOUNT_LOCKED', 'ACCOUNT_UNLOCKED', 'MFA_SUCCESS', 'MFA_FAILED',
    ]
    for (const e of required) {
      expect(AUTH_EVENTS).toContain(e)
    }
  })
})

// R-006
describe('R-006 — fireAndForget returns void synchronously', () => {
  it('return value is undefined (not a Promise)', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const trace = buildServerTrace()
    const result = fireAndForget('LOGOUT', { trace })
    expect(result).toBeUndefined()
  })
})

import { describe, it, expect, vi } from 'vitest'

// auth-metrics.ts imports supabaseAdmin at module level — mock it to avoid
// Supabase URL validation error in unit tests. getAuthMetrics() (which uses
// the real DB) is tested via integration tests, not here.
vi.mock('@/lib/supabase-server', () => ({
  supabaseAdmin: { from: vi.fn() },
}))

import { aggregateMetrics } from '../auth-metrics'

// Note: getAuthMetrics() and getGlobalAuthMetrics() are tested via integration tests
// (they require a live Supabase connection). Here we test the pure aggregation logic.

type Row = { event_type: string; duration_ms: number | null; user_id: string | null; created_at: string }

function makeRows(events: { type: string; userId?: string; durationMs?: number }[]): Row[] {
  return events.map((e, i) => ({
    event_type:  e.type,
    duration_ms: e.durationMs ?? null,
    user_id:     e.userId ?? `user-${i}`,
    created_at:  new Date().toISOString(),
  }))
}

describe('aggregateMetrics()', () => {
  it('counts LOGIN_SUCCESS correctly', () => {
    const rows = makeRows([
      { type: 'LOGIN_SUCCESS' },
      { type: 'LOGIN_SUCCESS' },
      { type: 'LOGIN_FAILED' },
    ])
    const m = aggregateMetrics(rows, '24h')
    expect(m.totalLogins).toBe(2)
    expect(m.failedLogins).toBe(1)
  })

  it('counts unique active users (by user_id on LOGIN_SUCCESS)', () => {
    const rows = makeRows([
      { type: 'LOGIN_SUCCESS', userId: 'u1' },
      { type: 'LOGIN_SUCCESS', userId: 'u1' }, // same user twice
      { type: 'LOGIN_SUCCESS', userId: 'u2' },
    ])
    const m = aggregateMetrics(rows, '24h')
    expect(m.activeUsers).toBe(2)
  })

  it('computes avgAuthDurationMs from LOGIN_SUCCESS rows with duration_ms', () => {
    const rows = makeRows([
      { type: 'LOGIN_SUCCESS', durationMs: 200 },
      { type: 'LOGIN_SUCCESS', durationMs: 400 },
      { type: 'LOGIN_FAILED',  durationMs: 50 },  // not counted
    ])
    const m = aggregateMetrics(rows, '24h')
    expect(m.avgAuthDurationMs).toBe(300)
  })

  it('returns null avgAuthDurationMs when no LOGIN_SUCCESS has duration_ms', () => {
    const rows = makeRows([
      { type: 'LOGIN_SUCCESS' },  // no durationMs
    ])
    const m = aggregateMetrics(rows, '24h')
    expect(m.avgAuthDurationMs).toBeNull()
  })

  it('counts all event types correctly', () => {
    const rows = makeRows([
      { type: 'LOGIN_SUCCESS' },
      { type: 'LOGOUT' },
      { type: 'LOGOUT' },
      { type: 'TOKEN_REFRESH' },
      { type: 'SESSION_EXPIRED' },
      { type: 'PASSWORD_RESET' },
      { type: 'ACCOUNT_LOCKED' },
    ])
    const m = aggregateMetrics(rows, '24h')
    expect(m.logouts).toBe(2)
    expect(m.tokenRefreshes).toBe(1)
    expect(m.expiredSessions).toBe(1)
    expect(m.passwordResets).toBe(1)
    expect(m.blockedAttempts).toBe(1)
  })

  it('returns all zeros for empty rows', () => {
    const m = aggregateMetrics([], '24h')
    expect(m.totalLogins).toBe(0)
    expect(m.failedLogins).toBe(0)
    expect(m.activeUsers).toBe(0)
    expect(m.avgAuthDurationMs).toBeNull()
  })

  it('preserves the period string', () => {
    const m = aggregateMetrics([], '7d')
    expect(m.period).toBe('7d')
  })
})

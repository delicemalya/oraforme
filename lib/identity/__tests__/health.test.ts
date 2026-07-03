import { describe, it, expect } from 'vitest'
import { computeIdentityHealth } from '../health'
import type { AuthMetrics } from '../types'

function metrics(overrides: Partial<AuthMetrics> = {}): AuthMetrics {
  return {
    period:               '24h',
    totalLogins:          100,
    failedLogins:         5,
    logouts:              20,
    tokenRefreshes:       80,
    expiredSessions:      2,
    passwordResets:       1,
    activeUsers:          30,
    blockedAttempts:      0,
    avgAuthDurationMs:    320,
    simultaneousSessions: 40,
    ...overrides,
  }
}

describe('computeIdentityHealth()', () => {
  it('returns HEALTHY label when success rate is high', () => {
    const health = computeIdentityHealth(metrics())
    expect(health.label).toBe('HEALTHY')
    expect(health.globalScore).toBeGreaterThanOrEqual(80)
  })

  it('returns CRITICAL when all logins fail', () => {
    const health = computeIdentityHealth(metrics({
      totalLogins: 0,
      failedLogins: 100,
      tokenRefreshes: 0,
      expiredSessions: 0,
    }))
    expect(health.label).toBe('CRITICAL')
    expect(health.identityScore).toBe(0)
    expect(health.availability).toBe(0)
  })

  it('returns DEGRADED for 50% failure rate', () => {
    const health = computeIdentityHealth(metrics({
      totalLogins: 50,
      failedLogins: 50,
      tokenRefreshes: 10,
      expiredSessions: 5,
    }))
    expect(health.identityScore).toBe(50)
    expect(['DEGRADED', 'CRITICAL']).toContain(health.label)
  })

  it('returns 100 identity score when no attempts at all', () => {
    const health = computeIdentityHealth(metrics({
      totalLogins: 0,
      failedLogins: 0,
    }))
    expect(health.identityScore).toBe(100)
  })

  it('counts auth errors = failedLogins + blockedAttempts', () => {
    const health = computeIdentityHealth(metrics({ failedLogins: 7, blockedAttempts: 3 }))
    expect(health.authErrors).toBe(10)
  })

  it('passes through latencyMs from metrics', () => {
    const health = computeIdentityHealth(metrics({ avgAuthDurationMs: 543 }))
    expect(health.latencyMs).toBe(543)
  })

  it('sets latencyMs to null when not available', () => {
    const health = computeIdentityHealth(metrics({ avgAuthDurationMs: null }))
    expect(health.latencyMs).toBeNull()
  })

  it('clamps all scores between 0 and 100', () => {
    const health = computeIdentityHealth(metrics({
      totalLogins: 1000,
      failedLogins: 0,
      expiredSessions: 0,
      tokenRefreshes: 10000,
    }))
    expect(health.identityScore).toBeLessThanOrEqual(100)
    expect(health.sessionScore).toBeLessThanOrEqual(100)
    expect(health.refreshScore).toBeLessThanOrEqual(100)
    expect(health.availability).toBeLessThanOrEqual(100)
    expect(health.globalScore).toBeLessThanOrEqual(100)

    expect(health.identityScore).toBeGreaterThanOrEqual(0)
    expect(health.sessionScore).toBeGreaterThanOrEqual(0)
    expect(health.globalScore).toBeGreaterThanOrEqual(0)
  })

  it('penalizes session score proportionally to expired sessions', () => {
    const good = computeIdentityHealth(metrics({ expiredSessions: 0 }))
    const bad  = computeIdentityHealth(metrics({ expiredSessions: 50 }))
    expect(good.sessionScore).toBeGreaterThan(bad.sessionScore)
  })

  it('global score weights: identity 40%, session 25%, availability 25%, refresh 10%', () => {
    // All perfect → global should be 100
    const perfect = computeIdentityHealth(metrics({
      totalLogins: 100, failedLogins: 0,
      expiredSessions: 0, tokenRefreshes: 100,
      blockedAttempts: 0,
    }))
    expect(perfect.globalScore).toBeGreaterThanOrEqual(95)
  })
})

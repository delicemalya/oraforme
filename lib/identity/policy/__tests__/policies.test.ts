import { describe, it, expect } from 'vitest'
import {
  P001_BRUTE_FORCE,
  P002_UNUSUAL_COUNTRY,
  P003_IP_CHANGE_BRUTAL,
  P004_EXCESSIVE_SESSIONS,
  P005_ABNORMAL_REFRESH,
  P006_INACTIVE_ACCOUNT,
  P007_PASSWORD_EXPIRED,
  P008_MFA_REQUIRED,
  P009_SESSION_TOO_LONG,
  P010_UNKNOWN_DEVICE,
  ALL_POLICIES,
} from '../policies'
import type { PolicyContext, PolicyContextHistory } from '../types'
import { DEFAULT_TENANT_CONFIG } from '../types'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const now = new Date().toISOString()

function makeCtx(overrides: Partial<PolicyContext> = {}): PolicyContext {
  const baseHistory: PolicyContextHistory = {
    failedLoginsLast15m:        0,
    failedLoginsLast1h:         0,
    failedLoginsByIpLast15m:    0,
    loginSuccessLast30d:        [],
    tokenRefreshesLast1h:       0,
    lastPasswordResetAt:        null,
    lastLoginSuccessAt:         null,
    mfaSuccessLast1h:           0,
    activeSessionsLast4h:       0,
    deviceFingerprintsLast30d:  [],
  }

  return {
    event: {
      type:       'LOGIN_SUCCESS',
      userId:     'user-001',
      tenantId:   'tenant-001',
      ip:         '196.0.1.1',
      device:     'desktop',
      browser:    'chrome',
      provider:   'email',
      durationMs: 200,
      timestamp:  now,
      requestId:  'req-001',
    },
    recentHistory:    baseHistory,
    tenantConfig:     { ...DEFAULT_TENANT_CONFIG },
    sessionStartedAt: null,
    ...overrides,
  }
}

function histWith(overrides: Partial<PolicyContextHistory>): PolicyContextHistory {
  return {
    failedLoginsLast15m:        0,
    failedLoginsLast1h:         0,
    failedLoginsByIpLast15m:    0,
    loginSuccessLast30d:        [],
    tokenRefreshesLast1h:       0,
    lastPasswordResetAt:        null,
    lastLoginSuccessAt:         null,
    mfaSuccessLast1h:           0,
    activeSessionsLast4h:       0,
    deviceFingerprintsLast30d:  [],
    ...overrides,
  }
}

// ─── P-001 Brute Force ────────────────────────────────────────────────────────

describe('P001_BRUTE_FORCE', () => {
  it('triggers when >= 5 failed logins by IP in 15 min', () => {
    const ctx = makeCtx({ recentHistory: histWith({ failedLoginsByIpLast15m: 5 }) })
    expect(P001_BRUTE_FORCE.condition(ctx)).toBe(true)
  })

  it('does not trigger at 4 failed logins', () => {
    const ctx = makeCtx({ recentHistory: histWith({ failedLoginsByIpLast15m: 4 }) })
    expect(P001_BRUTE_FORCE.condition(ctx)).toBe(false)
  })

  it('exception bypasses when IP starts with 10.', () => {
    const ctx = makeCtx({
      recentHistory: histWith({ failedLoginsByIpLast15m: 10 }),
      event: { type: 'LOGIN_FAILED', userId: null, tenantId: 't', ip: '10.0.0.1', device: null, browser: null, provider: 'email', durationMs: null, timestamp: now, requestId: 'r' },
    })
    const isException = P001_BRUTE_FORCE.exceptions.some(ex => ex.condition(ctx))
    expect(isException).toBe(true)
  })

  it('verdict is DENY', () => {
    expect(P001_BRUTE_FORCE.verdict).toBe('DENY')
  })

  it('action durationMs is 15 minutes', () => {
    expect(P001_BRUTE_FORCE.action.durationMs).toBe(15 * 60 * 1000)
  })
})

// ─── P-002 Unusual Country ───────────────────────────────────────────────────

describe('P002_UNUSUAL_COUNTRY', () => {
  it('triggers when IP prefix not in last 30d history', () => {
    const ctx = makeCtx({
      recentHistory: histWith({
        loginSuccessLast30d: [
          { ip: '41.0.0.1', device: 'desktop', browser: 'chrome', timestamp: now, eventType: 'LOGIN_SUCCESS' },
          { ip: '41.0.0.2', device: 'desktop', browser: 'chrome', timestamp: now, eventType: 'LOGIN_SUCCESS' },
          { ip: '41.0.0.3', device: 'desktop', browser: 'chrome', timestamp: now, eventType: 'LOGIN_SUCCESS' },
        ],
      }),
      event: { type: 'LOGIN_SUCCESS', userId: 'u', tenantId: 't', ip: '196.0.1.1', device: null, browser: null, provider: 'email', durationMs: null, timestamp: now, requestId: 'r' },
    })
    expect(P002_UNUSUAL_COUNTRY.condition(ctx)).toBe(true)
  })

  it('does not trigger when IP prefix matches history', () => {
    const ctx = makeCtx({
      recentHistory: histWith({
        loginSuccessLast30d: [
          { ip: '196.0.1.100', device: 'desktop', browser: 'chrome', timestamp: now, eventType: 'LOGIN_SUCCESS' },
          { ip: '196.0.2.100', device: 'desktop', browser: 'chrome', timestamp: now, eventType: 'LOGIN_SUCCESS' },
          { ip: '196.0.3.100', device: 'desktop', browser: 'chrome', timestamp: now, eventType: 'LOGIN_SUCCESS' },
        ],
      }),
      event: { type: 'LOGIN_SUCCESS', userId: 'u', tenantId: 't', ip: '196.0.4.1', device: null, browser: null, provider: 'email', durationMs: null, timestamp: now, requestId: 'r' },
    })
    expect(P002_UNUSUAL_COUNTRY.condition(ctx)).toBe(false)
  })

  it('does not trigger with fewer than 3 history entries', () => {
    const ctx = makeCtx({
      recentHistory: histWith({
        loginSuccessLast30d: [
          { ip: '41.0.0.1', device: null, browser: null, timestamp: now, eventType: 'LOGIN_SUCCESS' },
        ],
      }),
    })
    expect(P002_UNUSUAL_COUNTRY.condition(ctx)).toBe(false)
  })
})

// ─── P-003 IP Change Brutal ──────────────────────────────────────────────────

describe('P003_IP_CHANGE_BRUTAL', () => {
  it('triggers when class A changes drastically', () => {
    const ctx = makeCtx({
      recentHistory: histWith({
        loginSuccessLast30d: [
          { ip: '10.0.0.1', device: null, browser: null, timestamp: now, eventType: 'LOGIN_SUCCESS' },
          { ip: '10.0.0.2', device: null, browser: null, timestamp: now, eventType: 'LOGIN_SUCCESS' },
        ],
      }),
      event: { type: 'LOGIN_SUCCESS', userId: 'u', tenantId: 't', ip: '200.0.0.1', device: null, browser: null, provider: 'email', durationMs: null, timestamp: now, requestId: 'r' },
    })
    expect(P003_IP_CHANGE_BRUTAL.condition(ctx)).toBe(true)
  })

  it('does not trigger for same class A', () => {
    const ctx = makeCtx({
      recentHistory: histWith({
        loginSuccessLast30d: [
          { ip: '196.1.0.1', device: null, browser: null, timestamp: now, eventType: 'LOGIN_SUCCESS' },
          { ip: '196.2.0.1', device: null, browser: null, timestamp: now, eventType: 'LOGIN_SUCCESS' },
        ],
      }),
      event: { type: 'LOGIN_SUCCESS', userId: 'u', tenantId: 't', ip: '196.3.0.1', device: null, browser: null, provider: 'email', durationMs: null, timestamp: now, requestId: 'r' },
    })
    expect(P003_IP_CHANGE_BRUTAL.condition(ctx)).toBe(false)
  })
})

// ─── P-004 Excessive Sessions ────────────────────────────────────────────────

describe('P004_EXCESSIVE_SESSIONS', () => {
  it('triggers when active sessions exceed maxSimultaneousSessions', () => {
    const ctx = makeCtx({
      recentHistory: histWith({ activeSessionsLast4h: 6 }),
      tenantConfig:  { ...DEFAULT_TENANT_CONFIG, maxSimultaneousSessions: 5 },
    })
    expect(P004_EXCESSIVE_SESSIONS.condition(ctx)).toBe(true)
  })

  it('does not trigger at exactly the limit', () => {
    const ctx = makeCtx({
      recentHistory: histWith({ activeSessionsLast4h: 5 }),
      tenantConfig:  { ...DEFAULT_TENANT_CONFIG, maxSimultaneousSessions: 5 },
    })
    expect(P004_EXCESSIVE_SESSIONS.condition(ctx)).toBe(false)
  })
})

// ─── P-005 Abnormal Refresh ──────────────────────────────────────────────────

describe('P005_ABNORMAL_REFRESH', () => {
  it('triggers at 11 refreshes/hour', () => {
    const ctx = makeCtx({ recentHistory: histWith({ tokenRefreshesLast1h: 11 }) })
    expect(P005_ABNORMAL_REFRESH.condition(ctx)).toBe(true)
  })

  it('does not trigger at 10 refreshes/hour', () => {
    const ctx = makeCtx({ recentHistory: histWith({ tokenRefreshesLast1h: 10 }) })
    expect(P005_ABNORMAL_REFRESH.condition(ctx)).toBe(false)
  })

  it('verdict is MONITOR', () => {
    expect(P005_ABNORMAL_REFRESH.verdict).toBe('MONITOR')
  })
})

// ─── P-006 Inactive Account ──────────────────────────────────────────────────

describe('P006_INACTIVE_ACCOUNT', () => {
  it('triggers when last login > 90 days ago', () => {
    const ninetyOneDaysAgo = new Date(Date.now() - 91 * 86_400_000).toISOString()
    const ctx = makeCtx({ recentHistory: histWith({ lastLoginSuccessAt: ninetyOneDaysAgo }) })
    expect(P006_INACTIVE_ACCOUNT.condition(ctx)).toBe(true)
  })

  it('does not trigger when last login is recent', () => {
    const oneDayAgo = new Date(Date.now() - 86_400_000).toISOString()
    const ctx = makeCtx({ recentHistory: histWith({ lastLoginSuccessAt: oneDayAgo }) })
    expect(P006_INACTIVE_ACCOUNT.condition(ctx)).toBe(false)
  })

  it('does not trigger when lastLoginSuccessAt is null (new account)', () => {
    const ctx = makeCtx({ recentHistory: histWith({ lastLoginSuccessAt: null }) })
    expect(P006_INACTIVE_ACCOUNT.condition(ctx)).toBe(false)
  })
})

// ─── P-007 Password Expired ──────────────────────────────────────────────────

describe('P007_PASSWORD_EXPIRED', () => {
  it('triggers when password never reset', () => {
    const ctx = makeCtx({ recentHistory: histWith({ lastPasswordResetAt: null }) })
    expect(P007_PASSWORD_EXPIRED.condition(ctx)).toBe(true)
  })

  it('triggers when password expired beyond tenant policy', () => {
    const oldReset = new Date(Date.now() - 91 * 86_400_000).toISOString()
    const ctx = makeCtx({
      recentHistory: histWith({ lastPasswordResetAt: oldReset }),
      tenantConfig:  { ...DEFAULT_TENANT_CONFIG, passwordExpiryDays: 90 },
    })
    expect(P007_PASSWORD_EXPIRED.condition(ctx)).toBe(true)
  })

  it('exception for OAuth providers', () => {
    const ctx = makeCtx({
      recentHistory: histWith({ lastPasswordResetAt: null }),
      event: { type: 'LOGIN_SUCCESS', userId: 'u', tenantId: 't', ip: '1.2.3.4', device: null, browser: null, provider: 'google', durationMs: null, timestamp: now, requestId: 'r' },
    })
    const isException = P007_PASSWORD_EXPIRED.exceptions.some(ex => ex.condition(ctx))
    expect(isException).toBe(true)
  })
})

// ─── P-008 MFA Required ──────────────────────────────────────────────────────

describe('P008_MFA_REQUIRED', () => {
  it('triggers when MFA required and no recent MFA success', () => {
    const ctx = makeCtx({
      recentHistory: histWith({ mfaSuccessLast1h: 0 }),
      tenantConfig:  { ...DEFAULT_TENANT_CONFIG, mfaRequired: true },
    })
    expect(P008_MFA_REQUIRED.condition(ctx)).toBe(true)
  })

  it('does not trigger when MFA not required', () => {
    const ctx = makeCtx({
      recentHistory: histWith({ mfaSuccessLast1h: 0 }),
      tenantConfig:  { ...DEFAULT_TENANT_CONFIG, mfaRequired: false },
    })
    expect(P008_MFA_REQUIRED.condition(ctx)).toBe(false)
  })

  it('does not trigger when MFA completed recently', () => {
    const ctx = makeCtx({
      recentHistory: histWith({ mfaSuccessLast1h: 1 }),
      tenantConfig:  { ...DEFAULT_TENANT_CONFIG, mfaRequired: true },
    })
    expect(P008_MFA_REQUIRED.condition(ctx)).toBe(false)
  })
})

// ─── P-009 Session Too Long ──────────────────────────────────────────────────

describe('P009_SESSION_TOO_LONG', () => {
  it('triggers when session started more than maxSessionDurationMs ago', () => {
    const nineHoursAgo = new Date(Date.now() - 9 * 3_600_000).toISOString()
    const ctx = makeCtx({
      sessionStartedAt: nineHoursAgo,
      tenantConfig: { ...DEFAULT_TENANT_CONFIG, maxSessionDurationMs: 8 * 3_600_000 },
    })
    expect(P009_SESSION_TOO_LONG.condition(ctx)).toBe(true)
  })

  it('does not trigger for a fresh session', () => {
    const oneHourAgo = new Date(Date.now() - 3_600_000).toISOString()
    const ctx = makeCtx({
      sessionStartedAt: oneHourAgo,
      tenantConfig: { ...DEFAULT_TENANT_CONFIG, maxSessionDurationMs: 8 * 3_600_000 },
    })
    expect(P009_SESSION_TOO_LONG.condition(ctx)).toBe(false)
  })

  it('does not trigger when sessionStartedAt is null', () => {
    const ctx = makeCtx({ sessionStartedAt: null })
    expect(P009_SESSION_TOO_LONG.condition(ctx)).toBe(false)
  })
})

// ─── P-010 Unknown Device ─────────────────────────────────────────────────────

describe('P010_UNKNOWN_DEVICE', () => {
  it('triggers when device fingerprint not in history', () => {
    const ctx = makeCtx({
      recentHistory: histWith({ deviceFingerprintsLast30d: ['mobile:safari'] }),
      event: { type: 'LOGIN_SUCCESS', userId: 'u', tenantId: 't', ip: '1.2.3.4', device: 'desktop', browser: 'chrome', provider: 'email', durationMs: null, timestamp: now, requestId: 'r' },
    })
    expect(P010_UNKNOWN_DEVICE.condition(ctx)).toBe(true)
  })

  it('does not trigger when fingerprint matches history', () => {
    const ctx = makeCtx({
      recentHistory: histWith({ deviceFingerprintsLast30d: ['desktop:chrome'] }),
      event: { type: 'LOGIN_SUCCESS', userId: 'u', tenantId: 't', ip: '1.2.3.4', device: 'desktop', browser: 'chrome', provider: 'email', durationMs: null, timestamp: now, requestId: 'r' },
    })
    expect(P010_UNKNOWN_DEVICE.condition(ctx)).toBe(false)
  })

  it('does not trigger when history is empty (first login)', () => {
    const ctx = makeCtx({
      recentHistory: histWith({ deviceFingerprintsLast30d: [] }),
    })
    expect(P010_UNKNOWN_DEVICE.condition(ctx)).toBe(false)
  })
})

// ─── Registry ─────────────────────────────────────────────────────────────────

describe('ALL_POLICIES registry', () => {
  it('contains exactly 10 policies', () => {
    expect(ALL_POLICIES).toHaveLength(10)
  })

  it('all policies are sorted by priority ascending', () => {
    for (let i = 1; i < ALL_POLICIES.length; i++) {
      expect(ALL_POLICIES[i].priority).toBeGreaterThanOrEqual(ALL_POLICIES[i - 1].priority)
    }
  })

  it('all policies have non-empty reason in their action', () => {
    for (const policy of ALL_POLICIES) {
      expect(policy.action.reason.length).toBeGreaterThan(0)
    }
  })

  it('all policies have explanation and evidence functions', () => {
    const ctx = makeCtx()
    for (const policy of ALL_POLICIES) {
      expect(() => policy.explanation(ctx)).not.toThrow()
      expect(() => policy.evidence(ctx)).not.toThrow()
    }
  })
})

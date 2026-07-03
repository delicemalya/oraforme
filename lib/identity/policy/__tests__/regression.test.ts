import { describe, it, expect } from 'vitest'
import { ALL_POLICIES, getPolicyById, getPoliciesForEvent } from '../policies'
import { PolicyEvaluationEngine } from '../evaluation-engine'
import { POLICY_IDS, DEFAULT_TENANT_CONFIG } from '../types'
import type { PolicyContext, PolicyContextHistory } from '../types'

// ─── R-001 : Le registre est exhaustif ────────────────────────────────────────

describe('R-001 Policy registry completeness', () => {
  it('contains exactly 10 policy IDs in POLICY_IDS', () => {
    expect(POLICY_IDS).toHaveLength(10)
  })

  it('ALL_POLICIES count matches POLICY_IDS count', () => {
    expect(ALL_POLICIES.length).toBe(POLICY_IDS.length)
  })

  it('every POLICY_ID has a corresponding policy in ALL_POLICIES', () => {
    for (const id of POLICY_IDS) {
      expect(getPolicyById(id)).toBeDefined()
    }
  })
})

// ─── R-002 : Chaque politique a une raison d'action non vide ──────────────────

describe('R-002 No silent actions', () => {
  it('every policy.action.reason is non-empty', () => {
    for (const policy of ALL_POLICIES) {
      expect(policy.action.reason.trim().length).toBeGreaterThan(0)
    }
  })
})

// ─── R-003 : Les conditions sont des fonctions pures (sans effet de bord) ─────

describe('R-003 Pure condition functions', () => {
  const baseHistory: PolicyContextHistory = {
    failedLoginsLast15m:        5,
    failedLoginsLast1h:         5,
    failedLoginsByIpLast15m:    5,
    loginSuccessLast30d:        [],
    tokenRefreshesLast1h:       0,
    lastPasswordResetAt:        null,
    lastLoginSuccessAt:         null,
    mfaSuccessLast1h:           0,
    activeSessionsLast4h:       6,
    deviceFingerprintsLast30d:  [],
  }

  const ctx: PolicyContext = {
    event: {
      type:       'LOGIN_SUCCESS',
      userId:     'u',
      tenantId:   't',
      ip:         '1.2.3.4',
      device:     'desktop',
      browser:    'chrome',
      provider:   'email',
      durationMs: 100,
      timestamp:  new Date().toISOString(),
      requestId:  'r',
    },
    recentHistory:    baseHistory,
    tenantConfig:     { ...DEFAULT_TENANT_CONFIG },
    sessionStartedAt: null,
  }

  it('calling condition(ctx) twice returns the same result', () => {
    for (const policy of ALL_POLICIES) {
      const r1 = policy.condition(ctx)
      const r2 = policy.condition(ctx)
      expect(r1).toBe(r2)
    }
  })
})

// ─── R-004 : getPoliciesForEvent filtre correctement ──────────────────────────

describe('R-004 getPoliciesForEvent', () => {
  it('returns only LOGIN_SUCCESS policies for LOGIN_SUCCESS event', () => {
    const policies = getPoliciesForEvent('LOGIN_SUCCESS')
    for (const p of policies) {
      expect(p.triggerEvents).toContain('LOGIN_SUCCESS')
    }
  })

  it('returns at least 5 policies for LOGIN_SUCCESS (most common event)', () => {
    expect(getPoliciesForEvent('LOGIN_SUCCESS').length).toBeGreaterThanOrEqual(5)
  })

  it('returns empty array for unknown event type', () => {
    expect(getPoliciesForEvent('UNKNOWN_EVENT')).toHaveLength(0)
  })
})

// ─── R-005 : EvaluationEngine ne modifie pas le contexte ──────────────────────

describe('R-005 Context immutability during evaluation', () => {
  it('evaluate() does not mutate the PolicyContext', () => {
    const engine = new PolicyEvaluationEngine(ALL_POLICIES)
    const ctx: PolicyContext = {
      event: {
        type:       'LOGIN_FAILED',
        userId:     null,
        tenantId:   't',
        ip:         '1.2.3.4',
        device:     null,
        browser:    null,
        provider:   null,
        durationMs: null,
        timestamp:  new Date().toISOString(),
        requestId:  'r',
      },
      recentHistory: {
        failedLoginsLast15m:        0,
        failedLoginsLast1h:         0,
        failedLoginsByIpLast15m:    5,
        loginSuccessLast30d:        [],
        tokenRefreshesLast1h:       0,
        lastPasswordResetAt:        null,
        lastLoginSuccessAt:         null,
        mfaSuccessLast1h:           0,
        activeSessionsLast4h:       0,
        deviceFingerprintsLast30d:  [],
      },
      tenantConfig:     { ...DEFAULT_TENANT_CONFIG },
      sessionStartedAt: null,
    }

    const before = JSON.stringify(ctx)
    engine.evaluate(ctx)
    const after = JSON.stringify(ctx)

    expect(before).toBe(after)
  })
})

// ─── R-006 : Toutes les politiques ont des priorités uniques ──────────────────

describe('R-006 Unique priorities', () => {
  it('all policies have distinct priority values', () => {
    const priorities = ALL_POLICIES.map(p => p.priority)
    const unique = new Set(priorities)
    expect(unique.size).toBe(ALL_POLICIES.length)
  })
})

// ─── R-007 : evidence() toujours array non-vide de dataPoints ─────────────────

describe('R-007 Evidence structure', () => {
  const ctx: PolicyContext = {
    event: {
      type: 'LOGIN_SUCCESS', userId: 'u', tenantId: 't',
      ip: '1.2.3.4', device: 'desktop', browser: 'chrome',
      provider: 'email', durationMs: null, timestamp: new Date().toISOString(), requestId: 'r',
    },
    recentHistory: {
      failedLoginsLast15m: 0, failedLoginsLast1h: 0, failedLoginsByIpLast15m: 0,
      loginSuccessLast30d: [], tokenRefreshesLast1h: 0, lastPasswordResetAt: null,
      lastLoginSuccessAt: null, mfaSuccessLast1h: 0, activeSessionsLast4h: 0,
      deviceFingerprintsLast30d: [],
    },
    tenantConfig:     { ...DEFAULT_TENANT_CONFIG },
    sessionStartedAt: null,
  }

  it('evidence() returns an object with triggeredBy and dataPoints array', () => {
    for (const policy of ALL_POLICIES) {
      const ev = policy.evidence(ctx)
      expect(typeof ev.triggeredBy).toBe('string')
      expect(ev.triggeredBy.length).toBeGreaterThan(0)
      expect(Array.isArray(ev.dataPoints)).toBe(true)
      expect(ev.dataPoints.length).toBeGreaterThan(0)
    }
  })
})

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { PolicyEvaluationEngine } from '../evaluation-engine'
import type { IdentityPolicy, PolicyContext, PolicyContextHistory } from '../types'
import { DEFAULT_TENANT_CONFIG } from '../types'

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const now = new Date().toISOString()

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

function makeCtx(eventType: string = 'LOGIN_SUCCESS'): PolicyContext {
  return {
    event: {
      type:       eventType as never,
      userId:     'user-001',
      tenantId:   'tenant-001',
      ip:         '196.0.1.1',
      device:     'desktop',
      browser:    'chrome',
      provider:   'email',
      durationMs: 200,
      timestamp:  now,
      requestId:  'req-test',
    },
    recentHistory:    { ...baseHistory },
    tenantConfig:     { ...DEFAULT_TENANT_CONFIG },
    sessionStartedAt: null,
  }
}

function makePolicy(overrides: Partial<IdentityPolicy>): IdentityPolicy {
  return {
    id:           'P-001-BRUTE-FORCE',
    name:         'Test Policy',
    description:  'Test',
    severity:     'HIGH',
    priority:     1,
    triggerEvents: ['LOGIN_SUCCESS'],
    condition:    () => true,
    verdict:      'DENY',
    action:       { type: 'LOG_ONLY', reason: 'Test action.' },
    delayMs:      0,
    exceptions:   [],
    metrics:      { trackViolations: true, trackFalsePositive: false, alertThreshold: 5 },
    explanation:  () => 'Test explanation.',
    evidence:     () => ({ triggeredBy: 'test', dataPoints: [] }),
    enabled:      true,
    version:      1,
    ...overrides,
  }
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('PolicyEvaluationEngine', () => {

  it('returns empty decisions when no policy triggers', () => {
    const engine = new PolicyEvaluationEngine([
      makePolicy({ condition: () => false }),
    ])
    const result = engine.evaluate(makeCtx())
    expect(result.decisions).toHaveLength(0)
    expect(result.denyDecision).toBeNull()
  })

  it('returns a decision when a policy condition is true', () => {
    const engine = new PolicyEvaluationEngine([
      makePolicy({ condition: () => true, verdict: 'DENY' }),
    ])
    const result = engine.evaluate(makeCtx())
    expect(result.decisions).toHaveLength(1)
    expect(result.decisions[0].verdict).toBe('DENY')
  })

  it('sets denyDecision when a DENY policy triggers', () => {
    const engine = new PolicyEvaluationEngine([
      makePolicy({ condition: () => true, verdict: 'DENY' }),
    ])
    const result = engine.evaluate(makeCtx())
    expect(result.denyDecision).not.toBeNull()
    expect(result.denyDecision?.policyId).toBe('P-001-BRUTE-FORCE')
  })

  it('denyDecision is null when only FLAG/MONITOR trigger', () => {
    const engine = new PolicyEvaluationEngine([
      makePolicy({ condition: () => true, verdict: 'FLAG' }),
      makePolicy({ id: 'P-002-UNUSUAL-COUNTRY', condition: () => true, verdict: 'MONITOR' }),
    ])
    const result = engine.evaluate(makeCtx())
    expect(result.denyDecision).toBeNull()
    expect(result.decisions).toHaveLength(2)
  })

  it('respects stopOnFirstDeny option', () => {
    const engine = new PolicyEvaluationEngine([
      makePolicy({ id: 'P-001-BRUTE-FORCE', priority: 1, condition: () => true, verdict: 'DENY' }),
      makePolicy({ id: 'P-002-UNUSUAL-COUNTRY', priority: 2, condition: () => true, verdict: 'FLAG' }),
    ])
    const result = engine.evaluate(makeCtx(), { stopOnFirstDeny: true })
    expect(result.decisions).toHaveLength(1)
  })

  it('skips disabled policies when enabledOnly=true (default)', () => {
    const engine = new PolicyEvaluationEngine([
      makePolicy({ condition: () => true, enabled: false }),
    ])
    const result = engine.evaluate(makeCtx())
    expect(result.decisions).toHaveLength(0)
  })

  it('includes disabled policies when enabledOnly=false', () => {
    const engine = new PolicyEvaluationEngine([
      makePolicy({ condition: () => true, enabled: false }),
    ])
    const result = engine.evaluate(makeCtx(), { enabledOnly: false })
    expect(result.decisions).toHaveLength(1)
  })

  it('only evaluates policies that match the event type', () => {
    const engine = new PolicyEvaluationEngine([
      makePolicy({ triggerEvents: ['LOGIN_FAILED'], condition: () => true }),
    ])
    const result = engine.evaluate(makeCtx('LOGIN_SUCCESS'))
    expect(result.decisions).toHaveLength(0)
  })

  it('skips policies whose exception conditions are met', () => {
    const engine = new PolicyEvaluationEngine([
      makePolicy({
        condition:  () => true,
        exceptions: [{ description: 'Always excepted', condition: () => true }],
      }),
    ])
    const result = engine.evaluate(makeCtx())
    expect(result.decisions).toHaveLength(0)
  })

  it('builds decision with correct fields from context', () => {
    const engine = new PolicyEvaluationEngine([
      makePolicy({ condition: () => true }),
    ])
    const ctx    = makeCtx()
    const result = engine.evaluate(ctx)
    const d      = result.decisions[0]

    expect(d.tenantId).toBe('tenant-001')
    expect(d.userId).toBe('user-001')
    expect(d.requestId).toBe('req-test')
    expect(d.reason).toBe('Test explanation.')
    expect(d.triggeredAt).toBeTruthy()
  })

  it('allVerdicts contains all triggered verdicts', () => {
    const engine = new PolicyEvaluationEngine([
      makePolicy({ id: 'P-001-BRUTE-FORCE', condition: () => true, verdict: 'DENY' }),
      makePolicy({ id: 'P-002-UNUSUAL-COUNTRY', condition: () => true, verdict: 'FLAG' }),
      makePolicy({ id: 'P-003-IP-CHANGE-BRUTAL', condition: () => true, verdict: 'MONITOR' }),
    ])
    const result = engine.evaluate(makeCtx())
    expect(result.allVerdicts).toContain('DENY')
    expect(result.allVerdicts).toContain('FLAG')
    expect(result.allVerdicts).toContain('MONITOR')
  })
})

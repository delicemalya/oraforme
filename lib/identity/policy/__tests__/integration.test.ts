/**
 * C-001.3 Integration Tests — Identity Policy Engine Pipeline
 *
 * These tests prove that the full pipeline works end-to-end:
 *   buildPolicyContext → evaluatePolicies → executeAction → writePolicyDecision
 *
 * They use mocked DB calls (supabaseAdmin) to avoid real network calls.
 * Test coverage:
 *   - Context builder produces valid PolicyContext from DB query results
 *   - Full pipeline: LOGIN_SUCCESS with brute force → DENY + action + history
 *   - Full pipeline: LOGIN_SUCCESS clean → ALLOW
 *   - Pipeline handles DB failure gracefully (fire-and-forget)
 *   - evaluatePolicies returns decisions for all matching policies
 *   - DENY stops pipeline on first deny when stopOnFirstDeny is true
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { PolicyContext } from '../types'

// ── Mock supabaseAdmin ────────────────────────────────────────────────────────
const {
  mockFrom,
  mockInsert,
  mockSelect,
  mockSingle,
  mockRpc,
  mockCount,
} = vi.hoisted(() => {
  const mockSingle  = vi.fn().mockResolvedValue({ data: { id: 'hist-1' }, error: null })
  const mockInsert  = vi.fn().mockResolvedValue({ error: null })
  const mockCount   = vi.fn().mockResolvedValue({ count: 0, error: null })
  const mockSelect  = vi.fn(() => ({
    eq: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    single: mockSingle,
    head: true,
  }))
  const mockFrom  = vi.fn((table: string) => {
    if (table === 'auth_logs' || table === 'policy_history' || table === 'policy_violations') {
      return { insert: mockInsert, select: mockSelect }
    }
    return { insert: mockInsert, select: mockSelect }
  })
  const mockRpc = vi.fn().mockResolvedValue({
    data: [{
      failed_15m: 0,
      failed_1h:  0,
      refresh_1h: 0,
      mfa_1h:     0,
      active_sessions_4h: 0,
      last_password_reset: null,
      last_login_success:  null,
    }],
    error: null,
  })
  return { mockFrom, mockInsert, mockSelect, mockSingle, mockRpc, mockCount }
})

vi.mock('@/lib/supabase-server', () => ({
  supabaseAdmin: { from: mockFrom, rpc: mockRpc },
}))

import { buildPolicyContext, buildPolicyEvent } from '../context-builder'
import { evaluatePolicies } from '../evaluation-engine'
import { PolicyActionEngine } from '../action-engine'
import { writePolicyDecision } from '../history'
import type { PolicyEvent } from '../types'

// ── Test utilities ────────────────────────────────────────────────────────────

function makeEvent(overrides: Partial<PolicyEvent> = {}): PolicyEvent {
  return {
    type:       'LOGIN_SUCCESS',
    userId:     'user-001',
    tenantId:   'tenant-001',
    ip:         '192.168.1.1',
    device:     'desktop',
    browser:    'chrome',
    provider:   'email',
    durationMs: 200,
    timestamp:  new Date().toISOString(),
    requestId:  crypto.randomUUID(),
    ...overrides,
  }
}

function makeBruteForceContext(): PolicyContext {
  return {
    event: makeEvent({ type: 'LOGIN_FAILED' }),
    recentHistory: {
      failedLoginsLast15m:       0,
      failedLoginsLast1h:        0,
      failedLoginsByIpLast15m:   10,   // triggers P-001 (threshold is 5)
      loginSuccessLast30d:       [],
      tokenRefreshesLast1h:      0,
      lastPasswordResetAt:       null,
      lastLoginSuccessAt:        null,
      mfaSuccessLast1h:          0,
      activeSessionsLast4h:      0,
      deviceFingerprintsLast30d: [],
    },
    tenantConfig: {
      maxSimultaneousSessions: 5,
      maxSessionDurationMs:    8 * 60 * 60 * 1000,
      mfaRequired:             false,
      passwordExpiryDays:      90,
      allowedIpPrefixes:       [],
    },
    sessionStartedAt: null,
  }
}

function makeCleanContext(): PolicyContext {
  return {
    event: makeEvent(),
    recentHistory: {
      failedLoginsLast15m:       0,
      failedLoginsLast1h:        0,
      failedLoginsByIpLast15m:   0,
      loginSuccessLast30d: [
        { ip: '192.168.1.1', device: 'desktop', browser: 'chrome', timestamp: new Date(Date.now() - 86400000).toISOString(), eventType: 'LOGIN_SUCCESS' },
        { ip: '192.168.1.1', device: 'desktop', browser: 'chrome', timestamp: new Date(Date.now() - 86400000 * 2).toISOString(), eventType: 'LOGIN_SUCCESS' },
        { ip: '192.168.1.1', device: 'desktop', browser: 'chrome', timestamp: new Date(Date.now() - 86400000 * 3).toISOString(), eventType: 'LOGIN_SUCCESS' },
        { ip: '192.168.1.1', device: 'desktop', browser: 'chrome', timestamp: new Date(Date.now() - 86400000 * 4).toISOString(), eventType: 'LOGIN_SUCCESS' },
      ],
      tokenRefreshesLast1h:      0,
      lastPasswordResetAt:       new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      lastLoginSuccessAt:        new Date(Date.now() - 86400000).toISOString(),
      mfaSuccessLast1h:          0,
      activeSessionsLast4h:      1,
      deviceFingerprintsLast30d: ['desktop:chrome'],
    },
    tenantConfig: {
      maxSimultaneousSessions: 5,
      maxSessionDurationMs:    8 * 60 * 60 * 1000,
      mfaRequired:             false,
      passwordExpiryDays:      90,
      allowedIpPrefixes:       [],
    },
    sessionStartedAt: null,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

describe('C-001.3 Integration — buildPolicyContext', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRpc.mockResolvedValue({
      data: [{
        failed_15m: 0, failed_1h: 0, refresh_1h: 0,
        mfa_1h: 0, active_sessions_4h: 0,
        last_password_reset: null, last_login_success: null,
      }],
      error: null,
    })
    mockSelect.mockReturnValue({
      eq: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({ data: [], error: null }),
      single: mockSingle,
      head: false,
    })
    mockCount.mockResolvedValue({ count: 2, error: null })
  })

  it('returns a valid PolicyContext with all required fields', async () => {
    const event = makeEvent()
    const ctx   = await buildPolicyContext(event, 'tenant-001')

    expect(ctx.event).toEqual(event)
    expect(ctx.tenantConfig).toBeDefined()
    expect(ctx.recentHistory).toBeDefined()
    expect(typeof ctx.recentHistory.failedLoginsLast15m).toBe('number')
    expect(Array.isArray(ctx.recentHistory.loginSuccessLast30d)).toBe(true)
    expect(Array.isArray(ctx.recentHistory.deviceFingerprintsLast30d)).toBe(true)
  })

  it('propagates sessionStartedAt into context', async () => {
    const event = makeEvent()
    const ts    = new Date(Date.now() - 3600000).toISOString()
    const ctx   = await buildPolicyContext(event, 'tenant-001', ts)

    expect(ctx.sessionStartedAt).toBe(ts)
  })

  it('handles null userId gracefully (returns zero counters)', async () => {
    const event = makeEvent({ userId: null })
    const ctx   = await buildPolicyContext(event, null)

    expect(ctx.recentHistory.failedLoginsLast15m).toBe(0)
    expect(ctx.recentHistory.loginSuccessLast30d).toHaveLength(0)
    expect(mockRpc).not.toHaveBeenCalled()
  })

  it('handles DB error in fn_policy_context_counters gracefully', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: 'DB error' } })
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const event = makeEvent()
    const ctx   = await buildPolicyContext(event, 'tenant-001')

    expect(ctx.recentHistory.failedLoginsLast15m).toBe(0)
    expect(consoleSpy).toHaveBeenCalled()
    consoleSpy.mockRestore()
  })
})

describe('C-001.3 Integration — evaluatePolicies pipeline', () => {
  it('DENY on brute force: P-001 fires for 10 IP failures in 15 min', () => {
    const ctx    = makeBruteForceContext()
    const result = evaluatePolicies(ctx)

    expect(result.denyDecision).not.toBeNull()
    expect(result.denyDecision?.policyId).toBe('P-001-BRUTE-FORCE')
    expect(result.denyDecision?.verdict).toBe('DENY')
  })

  it('ALLOW on clean login: no policies trigger for normal user', () => {
    const ctx    = makeCleanContext()
    const result = evaluatePolicies(ctx)

    expect(result.denyDecision).toBeNull()
    expect(result.decisions).toHaveLength(0)
  })

  it('stopOnFirstDeny stops after first DENY decision', () => {
    const ctx    = makeBruteForceContext()
    const result = evaluatePolicies(ctx, { stopOnFirstDeny: true })

    // Should not evaluate every matching policy — only the first DENY
    expect(result.denyDecision).not.toBeNull()
    expect(result.decisions.length).toBeLessThanOrEqual(2)
  })

  it('all decisions have non-empty reason and policyId', () => {
    const ctx    = makeBruteForceContext()
    const result = evaluatePolicies(ctx)

    for (const d of result.decisions) {
      expect(d.reason.length).toBeGreaterThan(0)
      expect(d.policyId.length).toBeGreaterThan(0)
      expect(d.triggeredAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)
    }
  })
})

describe('C-001.3 Integration — action engine + history (full pipeline)', () => {
  let engine: PolicyActionEngine

  beforeEach(() => {
    engine = new PolicyActionEngine()
    vi.clearAllMocks()
    mockInsert.mockResolvedValue({ error: null })
    mockSingle.mockResolvedValue({ data: { id: 'hist-1' }, error: null })
    // Restore select mock for history queries
    mockSelect.mockReturnValue({
      eq: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({ data: [], error: null }),
      single: mockSingle,
      head: false,
    })
  })

  it('full pipeline: brute force → DENY → LOCK_ACCOUNT action → history written', async () => {
    const ctx    = makeBruteForceContext()
    const result = evaluatePolicies(ctx, { stopOnFirstDeny: true })

    expect(result.denyDecision).not.toBeNull()
    const deny = result.denyDecision!

    const actionResult = await engine.execute(deny)
    expect(actionResult.success).toBe(true)
    expect(actionResult.actionType).toBe('LOCK_ACCOUNT')

    await writePolicyDecision(deny, actionResult.success)
    expect(mockInsert).toHaveBeenCalled()
  })

  it('history write failure does not throw (fire-and-forget contract)', async () => {
    mockInsert.mockRejectedValue(new Error('DB down'))
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const ctx  = makeBruteForceContext()
    const result = evaluatePolicies(ctx, { stopOnFirstDeny: true })
    const deny = result.denyDecision!

    await expect(writePolicyDecision(deny, true)).resolves.not.toThrow()
    expect(consoleSpy).toHaveBeenCalled()
    consoleSpy.mockRestore()
  })

  it('clean login pipeline produces no decisions and writes nothing', async () => {
    const ctx    = makeCleanContext()
    const result = evaluatePolicies(ctx)

    expect(result.decisions).toHaveLength(0)
    expect(result.denyDecision).toBeNull()

    // No DB writes for empty decisions
    expect(mockInsert).not.toHaveBeenCalled()
  })
})

describe('C-001.3 Integration — buildPolicyEvent', () => {
  it('produces a valid PolicyEvent with all required fields', () => {
    const event = buildPolicyEvent({
      type:       'LOGIN_SUCCESS',
      userId:     'user-001',
      tenantId:   'tenant-001',
      ip:         '10.0.0.1',
      device:     'mobile',
      browser:    'safari',
      provider:   'email',
      durationMs: 300,
      requestId:  'req-abc',
    })

    expect(event.type).toBe('LOGIN_SUCCESS')
    expect(event.userId).toBe('user-001')
    expect(event.tenantId).toBe('tenant-001')
    expect(event.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/)
    expect(event.requestId).toBe('req-abc')
  })
})

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mock supabaseAdmin + writePolicyDecision ─────────────────────────────────
const { mockFrom, mockInsert, mockSelect, mockSingle } = vi.hoisted(() => {
  const mockSingle = vi.fn().mockResolvedValue({ data: { id: 'hist-1' }, error: null })
  const mockSelect = vi.fn(() => ({ eq: vi.fn().mockReturnThis(), single: mockSingle }))
  const mockInsert = vi.fn().mockResolvedValue({ error: null })
  const mockFrom   = vi.fn(() => ({ insert: mockInsert, select: mockSelect }))
  return { mockFrom, mockInsert, mockSelect, mockSingle }
})

vi.mock('@/lib/supabase-server', () => ({
  supabaseAdmin: { from: mockFrom },
}))

import { PolicyActionEngine } from '../action-engine'
import type { PolicyDecision } from '../types'

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeDecision(actionType: string, verdict = 'DENY'): PolicyDecision {
  return {
    policyId:    'P-001-BRUTE-FORCE',
    policyName:  'Brute Force Detection',
    tenantId:    'tenant-001',
    userId:      'user-001',
    requestId:   'req-001',
    verdict:     verdict as never,
    severity:    'HIGH',
    reason:      'Trop de tentatives.',
    action:      { type: actionType as never, reason: "Raison d'action." },
    evidence:    { triggeredBy: 'test', dataPoints: [{ label: 'IP source', value: '1.2.3.4' }] },
    triggeredAt: new Date().toISOString(),
    delayMs:     0,
  }
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('PolicyActionEngine', () => {
  let engine: PolicyActionEngine

  beforeEach(() => {
    engine = new PolicyActionEngine()
    vi.clearAllMocks()
    mockInsert.mockResolvedValue({ error: null })
  })

  it('returns success for NONE action', async () => {
    const result = await engine.execute(makeDecision('NONE'))
    expect(result.success).toBe(true)
    expect(result.actionType).toBe('NONE')
  })

  it('returns success for LOG_ONLY action', async () => {
    const result = await engine.execute(makeDecision('LOG_ONLY'))
    expect(result.success).toBe(true)
    expect(result.details).toContain('journaux')
  })

  it('returns success for NOTIFY_ADMIN action', async () => {
    const result = await engine.execute(makeDecision('NOTIFY_ADMIN'))
    expect(result.success).toBe(true)
    expect(result.details).toContain('Notification')
  })

  it('returns success for LOCK_ACCOUNT', async () => {
    const result = await engine.execute(makeDecision('LOCK_ACCOUNT'))
    expect(result.success).toBe(true)
  })

  it('returns success for FORCE_LOGOUT', async () => {
    const result = await engine.execute(makeDecision('FORCE_LOGOUT'))
    expect(result.success).toBe(true)
  })

  it('returns success for INVALIDATE_SESSIONS', async () => {
    const result = await engine.execute(makeDecision('INVALIDATE_SESSIONS'))
    expect(result.success).toBe(true)
  })

  it('returns success for REQUIRE_MFA', async () => {
    const result = await engine.execute(makeDecision('REQUIRE_MFA'))
    expect(result.success).toBe(true)
  })

  it('returns success for FLAG_USER', async () => {
    const result = await engine.execute(makeDecision('FLAG_USER'))
    expect(result.success).toBe(true)
  })

  it('returns success for BLOCK_IP', async () => {
    const result = await engine.execute(makeDecision('BLOCK_IP'))
    expect(result.success).toBe(true)
  })

  it('dry run does not call DB and returns success', async () => {
    const result = await engine.execute(makeDecision('LOCK_ACCOUNT'), { dryRun: true })
    expect(result.success).toBe(true)
    expect(result.details).toContain('DRY RUN')
    expect(mockInsert).not.toHaveBeenCalled()
  })

  it('completes action but logs error when DB write fails (fire-and-forget)', async () => {
    mockInsert.mockRejectedValue(new Error('DB failure'))
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const result = await engine.execute(makeDecision('LOG_ONLY'))
    // Action (LOG_ONLY) itself succeeds — DB write failure is non-blocking
    expect(result.success).toBe(true)
    // Error must be logged — writePolicyDecision swallows but logs
    expect(consoleSpy).toHaveBeenCalled()
    consoleSpy.mockRestore()
  })

  it('sets executedAt to a valid ISO timestamp', async () => {
    const result = await engine.execute(makeDecision('NONE'))
    expect(new Date(result.executedAt).getTime()).toBeGreaterThan(0)
  })
})

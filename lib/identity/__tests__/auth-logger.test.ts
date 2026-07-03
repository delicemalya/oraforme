import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// ── Mock supabaseAdmin — must be hoisted above all imports ───────────────────
const { mockInsert, mockFrom } = vi.hoisted(() => {
  const mockInsert = vi.fn().mockResolvedValue({ error: null })
  const mockFrom   = vi.fn(() => ({ insert: mockInsert }))
  return { mockInsert, mockFrom }
})

vi.mock('@/lib/supabase-server', () => ({
  supabaseAdmin: { from: mockFrom },
}))

import { logAuthEvent, fireAndForget } from '../auth-logger'
import type { AuthTrace } from '../types'

const baseTrace: AuthTrace = {
  requestId: 'req-test-123',
  sessionId: 'sess-abc',
  userId:    'user-001',
  tenantId:  'tenant-001',
  ip:        '196.0.0.1',
  device:    'desktop',
  browser:   'chrome',
}

beforeEach(() => {
  vi.clearAllMocks()
  mockInsert.mockResolvedValue({ error: null })
})

afterEach(() => {
  vi.restoreAllMocks()
})

// ── logAuthEvent ─────────────────────────────────────────────────────────────

describe('logAuthEvent()', () => {
  it('inserts a LOGIN_SUCCESS entry with all trace fields', async () => {
    await logAuthEvent('LOGIN_SUCCESS', { trace: baseTrace, provider: 'email', durationMs: 450 })

    expect(mockFrom).toHaveBeenCalledWith('auth_logs')
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        event_type:  'LOGIN_SUCCESS',
        tenant_id:   'tenant-001',
        user_id:     'user-001',
        request_id:  'req-test-123',
        session_id:  'sess-abc',
        ip:          '196.0.0.1',
        device:      'desktop',
        browser:     'chrome',
        provider:    'email',
        duration_ms: 450,
      })
    )
  })

  it('inserts a LOGIN_FAILED entry with error fields', async () => {
    await logAuthEvent('LOGIN_FAILED', {
      trace:        { ...baseTrace, userId: null, tenantId: null },
      provider:     'email',
      errorCode:    'invalid_credentials',
      errorMessage: 'Email ou mot de passe incorrect.',
    })

    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        event_type:    'LOGIN_FAILED',
        user_id:       null,
        tenant_id:     null,
        error_code:    'invalid_credentials',
        error_message: 'Email ou mot de passe incorrect.',
      })
    )
  })

  it('never throws when supabaseAdmin.insert fails', async () => {
    mockInsert.mockResolvedValue({ error: { message: 'DB error' } })
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    await expect(
      logAuthEvent('LOGIN_SUCCESS', { trace: baseTrace })
    ).resolves.toBeUndefined()

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('[auth-logger]'),
      expect.any(String)
    )
  })

  it('never throws when supabaseAdmin throws synchronously', async () => {
    mockInsert.mockRejectedValue(new Error('Network failure'))
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    await expect(
      logAuthEvent('LOGOUT', { trace: baseTrace })
    ).resolves.toBeUndefined()

    expect(consoleSpy).toHaveBeenCalled()
  })

  it('sets null for optional fields when not provided', async () => {
    await logAuthEvent('SESSION_EXPIRED', { trace: baseTrace })

    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        provider:      null,
        error_code:    null,
        error_message: null,
        duration_ms:   null,
      })
    )
  })

  it('maps all 11 event types without throwing', async () => {
    const events = [
      'LOGIN_SUCCESS', 'LOGIN_FAILED', 'LOGOUT', 'TOKEN_REFRESH',
      'SESSION_EXPIRED', 'PASSWORD_RESET', 'EMAIL_VERIFIED',
      'ACCOUNT_LOCKED', 'ACCOUNT_UNLOCKED', 'MFA_SUCCESS', 'MFA_FAILED',
    ] as const

    for (const eventType of events) {
      await expect(
        logAuthEvent(eventType, { trace: baseTrace })
      ).resolves.toBeUndefined()
    }

    expect(mockInsert).toHaveBeenCalledTimes(events.length)
  })
})

// ── fireAndForget ─────────────────────────────────────────────────────────────

describe('fireAndForget()', () => {
  it('returns void synchronously', () => {
    const result = fireAndForget('LOGOUT', { trace: baseTrace })
    expect(result).toBeUndefined()
  })

  it('eventually calls supabaseAdmin.insert', async () => {
    fireAndForget('TOKEN_REFRESH', { trace: baseTrace })
    // Allow microtask queue to flush
    await new Promise(r => setTimeout(r, 0))
    expect(mockInsert).toHaveBeenCalled()
  })
})

import type { AuthEventType } from './types'

export interface EvaluateClientResult {
  denied:   boolean
  policyId: string | null
  reason:   string | null
  severity: string | null
}

/**
 * evaluateAuthClient — call POST /api/auth/evaluate from client-side flows.
 *
 * Returns the policy verdict. If `denied: true`, the caller MUST block the
 * user from proceeding and show the `reason`.
 *
 * Only call this AFTER a successful Supabase auth operation, while the
 * session is still active (needed to resolve userId server-side).
 */
export async function evaluateAuthClient(
  eventType: AuthEventType,
  opts: {
    provider?:   string
    durationMs?: number
  } = {},
): Promise<EvaluateClientResult> {
  try {
    const res = await fetch('/api/auth/evaluate', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event_type:  eventType,
        provider:    opts.provider   ?? undefined,
        duration_ms: opts.durationMs ?? undefined,
      }),
    })

    if (res.status === 403) {
      const data = await res.json().catch(() => ({}))
      return {
        denied:   true,
        policyId: data.policyId ?? null,
        reason:   data.reason   ?? 'Acces refuse par politique de securite.',
        severity: data.severity ?? null,
      }
    }

    return { denied: false, policyId: null, reason: null, severity: null }

  } catch {
    // Network error — fail open (don't block the user on infra issues)
    console.error('[evaluateAuthClient] Network error — fail open')
    return { denied: false, policyId: null, reason: null, severity: null }
  }
}

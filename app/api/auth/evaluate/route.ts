import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-client-server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { buildTrace } from '@/lib/identity/auth-trace'
import { AUTH_EVENTS, type AuthEventType } from '@/lib/identity/types'
import {
  buildPolicyEvent,
  buildPolicyContext,
  evaluatePolicies,
  executeAction,
  writePolicyDecision,
} from '@/lib/identity/policy'

/**
 * POST /api/auth/evaluate
 *
 * Identity Policy Engine evaluation endpoint for client-side auth flows.
 *
 * Called AFTER a successful Supabase auth operation (signInWithPassword,
 * verifyOtp, etc.) to run the policy pipeline before the user is admitted.
 *
 * Constraints:
 * - Server-side only: accesses DB, service role, policy history
 * - Fire-and-forget logging: history writes never block the response
 * - DENY responses carry a reason for display; all others return ok: true
 *
 * Body:
 *   event_type  : AuthEventType  (required)
 *   provider    : string         (optional)
 *   duration_ms : number         (optional)
 *
 * Response:
 *   200 { ok: true }               — ALLOW / MONITOR / FLAG (no blocking)
 *   403 { denied: true, reason }   — DENY (caller must block UI)
 *   401                            — not authenticated
 *   400                            — invalid body
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const { event_type, provider, duration_ms } = body

    if (!event_type || !(AUTH_EVENTS as readonly string[]).includes(event_type)) {
      return NextResponse.json(
        { error: 'event_type manquant ou invalide' },
        { status: 400 },
      )
    }

    const eventType = event_type as AuthEventType

    // ── Resolve authenticated user ──────────────────────────────────────────
    const supabase = await createSupabaseServerClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Non authentifie' }, { status: 401 })
    }

    // ── Resolve tenant ──────────────────────────────────────────────────────
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('tenant_id')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle()

    const tenantId = profile?.tenant_id ?? null

    // ── Extract session start time for P-009 (SESSION_TOO_LONG) ────────────
    let sessionStartedAt: string | null = null
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.access_token) {
        const parts = session.access_token.split('.')
        if (parts[1]) {
          const payload = JSON.parse(
            Buffer.from(parts[1], 'base64url').toString('utf-8')
          )
          if (typeof payload.iat === 'number') {
            sessionStartedAt = new Date(payload.iat * 1000).toISOString()
          }
        }
      }
    } catch {
      // non-critical — P-009 will just skip if sessionStartedAt is null
    }

    // ── Build trace & event ─────────────────────────────────────────────────
    const trace = buildTrace(request, { userId: user.id, tenantId })

    const policyEvent = buildPolicyEvent({
      type:       eventType,
      userId:     user.id,
      tenantId,
      ip:         trace.ip,
      device:     trace.device,
      browser:    trace.browser,
      provider:   typeof provider    === 'string' ? provider    : null,
      durationMs: typeof duration_ms === 'number' ? duration_ms : null,
      requestId:  trace.requestId,
    })

    // ── Build context (DB queries for historical data) ──────────────────────
    const policyContext = await buildPolicyContext(policyEvent, tenantId, sessionStartedAt)

    // ── Evaluate policies ───────────────────────────────────────────────────
    const result = evaluatePolicies(policyContext, { stopOnFirstDeny: true })

    // ── Execute actions & persist history (fire-and-forget) ─────────────────
    void Promise.all(
      result.decisions.map(async (decision) => {
        const actionResult = await executeAction(decision)
        void writePolicyDecision(decision, actionResult.success)
      })
    ).catch(err => console.error('[api/auth/evaluate] async pipeline error:', err))

    // ── Return verdict ──────────────────────────────────────────────────────
    if (result.denyDecision) {
      const deny = result.denyDecision
      return NextResponse.json(
        {
          denied: true,
          policyId: deny.policyId,
          reason:   deny.reason,
          severity: deny.severity,
        },
        { status: 403 },
      )
    }

    return NextResponse.json({ ok: true })

  } catch (err) {
    console.error('[api/auth/evaluate]', err)
    return NextResponse.json({ error: 'Erreur interne' }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-client-server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { logAuthEvent } from '@/lib/identity/auth-logger'
import { buildTrace } from '@/lib/identity/auth-trace'
import { AUTH_EVENTS, type AuthEventType } from '@/lib/identity/types'

// These events don't require an active session (user may not be authenticated yet)
const UNAUTHENTICATED_EVENTS = new Set<AuthEventType>(['LOGIN_FAILED', 'SESSION_EXPIRED'])

/**
 * POST /api/auth/log
 *
 * Client-side auth event reporting endpoint.
 * Called from login/logout/reset flows after each auth operation.
 *
 * Body:
 *  event_type    : AuthEventType   (required)
 *  provider      : string          (optional — 'email'|'google'|'azure'|'phone')
 *  error_code    : string          (optional — Supabase error code)
 *  error_message : string          (optional — human-readable error)
 *  duration_ms   : number          (optional — time from initiation to result)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const { event_type, provider, error_code, error_message, duration_ms } = body

    if (!event_type || !(AUTH_EVENTS as readonly string[]).includes(event_type)) {
      return NextResponse.json(
        { error: 'event_type manquant ou invalide' },
        { status: 400 },
      )
    }

    const eventType = event_type as AuthEventType

    let userId:   string | null = null
    let tenantId: string | null = null

    if (!UNAUTHENTICATED_EVENTS.has(eventType)) {
      const supabase = await createSupabaseServerClient()
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
      }

      userId = user.id

      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('tenant_id')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle()

      tenantId = profile?.tenant_id ?? null
    }

    const trace = buildTrace(request, { userId, tenantId })

    await logAuthEvent(eventType, {
      trace,
      provider:     typeof provider      === 'string' ? provider      : null,
      errorCode:    typeof error_code    === 'string' ? error_code    : null,
      errorMessage: typeof error_message === 'string' ? error_message : null,
      durationMs:   typeof duration_ms   === 'number' ? duration_ms   : null,
    })

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[api/auth/log]', err)
    return NextResponse.json({ error: 'Erreur interne' }, { status: 500 })
  }
}

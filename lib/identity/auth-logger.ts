import { supabaseAdmin } from '@/lib/supabase-server'
import type { AuthEventType, AuthTrace, AuthLogEntry } from './types'

export interface LogOptions {
  trace:         AuthTrace
  provider?:     string | null
  errorCode?:    string | null
  errorMessage?: string | null
  durationMs?:   number | null
}

/**
 * Write an auth event to auth_logs.
 * NEVER throws — observability must not disrupt auth flows.
 */
export async function logAuthEvent(
  eventType: AuthEventType,
  opts:      LogOptions,
): Promise<void> {
  const entry: AuthLogEntry = {
    tenant_id:     opts.trace.tenantId,
    user_id:       opts.trace.userId,
    event_type:    eventType,
    request_id:    opts.trace.requestId,
    session_id:    opts.trace.sessionId,
    ip:            opts.trace.ip,
    device:        opts.trace.device,
    browser:       opts.trace.browser,
    provider:      opts.provider      ?? null,
    error_code:    opts.errorCode     ?? null,
    error_message: opts.errorMessage  ?? null,
    duration_ms:   opts.durationMs    ?? null,
  }

  try {
    const { error } = await supabaseAdmin.from('auth_logs').insert(entry)
    if (error) console.error('[auth-logger] insert failed:', error.message)
  } catch (e) {
    console.error('[auth-logger] unexpected error:', e)
  }
}

/**
 * Fire-and-forget — starts the async log without blocking the caller.
 * Use in server actions and route handlers where you cannot await.
 */
export function fireAndForget(eventType: AuthEventType, opts: LogOptions): void {
  void logAuthEvent(eventType, opts)
}

import type { AuthEventType } from './types'

interface ClientLogPayload {
  event_type:     AuthEventType
  provider?:      string
  error_code?:    string
  error_message?: string
  duration_ms?:   number
}

/**
 * Fire-and-forget client-side auth event reporter.
 * Calls POST /api/auth/log — never blocks the UI.
 */
export function logAuthClient(payload: ClientLogPayload): void {
  void fetch('/api/auth/log', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    keepalive: true,  // ensure request completes even after navigation
  }).catch(() => {
    // Silent — logging failure must never surface to the user
  })
}

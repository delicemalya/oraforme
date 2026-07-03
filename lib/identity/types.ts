export const AUTH_EVENTS = [
  'LOGIN_SUCCESS',
  'LOGIN_FAILED',
  'LOGOUT',
  'TOKEN_REFRESH',
  'SESSION_EXPIRED',
  'PASSWORD_RESET',
  'EMAIL_VERIFIED',
  'ACCOUNT_LOCKED',
  'ACCOUNT_UNLOCKED',
  'MFA_SUCCESS',
  'MFA_FAILED',
] as const

export type AuthEventType = typeof AUTH_EVENTS[number]

export interface AuthTrace {
  requestId:  string
  sessionId:  string | null
  userId:     string | null
  tenantId:   string | null
  ip:         string | null
  device:     string | null
  browser:    string | null
}

export interface AuthLogEntry {
  id?:           string
  tenant_id:     string | null
  user_id:       string | null
  event_type:    AuthEventType
  request_id:    string
  session_id:    string | null
  ip:            string | null
  device:        string | null
  browser:       string | null
  provider:      string | null
  error_code:    string | null
  error_message: string | null
  duration_ms:   number | null
  created_at?:   string
}

export interface AuthMetrics {
  period:               string
  totalLogins:          number
  failedLogins:         number
  logouts:              number
  tokenRefreshes:       number
  expiredSessions:      number
  passwordResets:       number
  activeUsers:          number
  blockedAttempts:      number
  avgAuthDurationMs:    number | null
  simultaneousSessions: number
}

export interface IdentityHealth {
  identityScore:  number        // 0-100 — success rate
  sessionScore:   number        // 0-100 — session health
  refreshScore:   number        // 0-100 — token refresh activity
  authErrors:     number        // raw count
  latencyMs:      number | null // avg login latency
  availability:   number        // 0-100 — uptime proxy
  globalScore:    number        // 0-100 — weighted composite
  label:          'HEALTHY' | 'DEGRADED' | 'CRITICAL'
}

export type ObservabilityPeriod = '1h' | '24h' | '7d' | '30d'

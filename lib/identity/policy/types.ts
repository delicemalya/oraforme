import type { AuthEventType } from '../types'

// ── Policy identifiers ────────────────────────────────────────────────────────

export const POLICY_IDS = [
  'P-001-BRUTE-FORCE',
  'P-002-UNUSUAL-COUNTRY',
  'P-003-IP-CHANGE-BRUTAL',
  'P-004-EXCESSIVE-SESSIONS',
  'P-005-ABNORMAL-REFRESH',
  'P-006-INACTIVE-ACCOUNT',
  'P-007-PASSWORD-EXPIRED',
  'P-008-MFA-REQUIRED',
  'P-009-SESSION-TOO-LONG',
  'P-010-UNKNOWN-DEVICE',
] as const

export type PolicyId = typeof POLICY_IDS[number]

// ── Verdict & severity ────────────────────────────────────────────────────────

export type PolicyVerdict  = 'ALLOW' | 'DENY' | 'FLAG' | 'MONITOR'
export type PolicySeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'

// ── Actions ───────────────────────────────────────────────────────────────────

export type PolicyActionType =
  | 'NONE'
  | 'LOG_ONLY'
  | 'NOTIFY_ADMIN'
  | 'FLAG_USER'
  | 'REQUIRE_MFA'
  | 'LOCK_ACCOUNT'
  | 'FORCE_LOGOUT'
  | 'BLOCK_IP'
  | 'INVALIDATE_SESSIONS'

export interface PolicyAction {
  type:       PolicyActionType
  durationMs?: number     // for time-limited actions (LOCK_ACCOUNT, FLAG_USER, BLOCK_IP)
  reason:     string      // always required — all actions must be explainable
}

// ── Evidence ─────────────────────────────────────────────────────────────────

export interface PolicyEvidence {
  triggeredBy:     string        // human-readable trigger description
  dataPoints:      PolicyDataPoint[]
  threshold?:      number
  observed?:       number
}

export interface PolicyDataPoint {
  label: string
  value: string | number | boolean | null
}

// ── Context ───────────────────────────────────────────────────────────────────

export interface PolicyHistoryEntry {
  ip:          string | null
  device:      string | null
  browser:     string | null
  timestamp:   string
  eventType:   AuthEventType
}

export interface PolicyContextHistory {
  failedLoginsLast15m:        number
  failedLoginsLast1h:         number
  failedLoginsByIpLast15m:    number    // same IP as current event
  loginSuccessLast30d:        PolicyHistoryEntry[]
  tokenRefreshesLast1h:       number
  lastPasswordResetAt:        string | null
  lastLoginSuccessAt:         string | null  // the one BEFORE current event
  mfaSuccessLast1h:           number
  activeSessionsLast4h:       number
  deviceFingerprintsLast30d:  string[]       // "desktop:chrome" format
}

export interface PolicyTenantConfig {
  maxSimultaneousSessions:  number     // default 5
  maxSessionDurationMs:     number     // default 8h = 28_800_000
  mfaRequired:              boolean
  passwordExpiryDays:       number     // default 90
  allowedIpPrefixes:        string[]   // empty = all allowed
}

export const DEFAULT_TENANT_CONFIG: PolicyTenantConfig = {
  maxSimultaneousSessions:  5,
  maxSessionDurationMs:     8 * 60 * 60 * 1000,
  mfaRequired:              false,
  passwordExpiryDays:       90,
  allowedIpPrefixes:        [],
}

export interface PolicyEvent {
  type:        AuthEventType
  userId:      string | null
  tenantId:    string | null
  ip:          string | null
  device:      string | null
  browser:     string | null
  provider:    string | null
  durationMs:  number | null
  timestamp:   string
  requestId:   string
}

export interface PolicyContext {
  event:            PolicyEvent
  recentHistory:    PolicyContextHistory
  tenantConfig:     PolicyTenantConfig
  sessionStartedAt: string | null   // timestamp of first LOGIN_SUCCESS for this session
}

// ── Policy definition ─────────────────────────────────────────────────────────

export interface PolicyException {
  description: string
  condition:   (ctx: PolicyContext) => boolean
}

export interface PolicyMetricConfig {
  trackViolations:   boolean
  trackFalsePositive: boolean
  alertThreshold:    number    // violations per hour before alerting ops
}

export interface IdentityPolicy {
  id:             PolicyId
  name:           string
  description:    string
  severity:       PolicySeverity
  priority:       number           // 1 = highest priority (evaluated first)
  triggerEvents:  AuthEventType[]
  condition:      (ctx: PolicyContext) => boolean
  verdict:        PolicyVerdict
  action:         PolicyAction
  delayMs:        number           // 0 = immediate enforcement
  exceptions:     PolicyException[]
  metrics:        PolicyMetricConfig
  explanation:    (ctx: PolicyContext) => string  // human-readable "why" for the user
  evidence:       (ctx: PolicyContext) => PolicyEvidence
  enabled:        boolean
  version:        number
}

// ── Decisions & results ───────────────────────────────────────────────────────

export interface PolicyDecision {
  policyId:    PolicyId
  policyName:  string
  tenantId:    string | null
  userId:      string | null
  requestId:   string
  verdict:     PolicyVerdict
  severity:    PolicySeverity
  reason:      string            // ALWAYS set — no silent decisions
  action:      PolicyAction
  evidence:    PolicyEvidence
  triggeredAt: string            // ISO timestamp
  delayMs:     number
}

export interface PolicyActionResult {
  policyId:    PolicyId
  actionType:  PolicyActionType
  success:     boolean
  executedAt:  string
  error?:      string
  details:     string
}

export interface PolicyHistoryRecord {
  id?:             string
  policy_id:       PolicyId
  policy_name:     string
  tenant_id:       string | null
  user_id:         string | null
  request_id:      string
  verdict:         PolicyVerdict
  severity:        PolicySeverity
  reason:          string
  action_type:     PolicyActionType
  action_reason:   string
  action_delay_ms: number
  action_success?: boolean
  evidence:        PolicyEvidence
  created_at?:     string
}

export interface PolicyViolationSummary {
  policyId:         PolicyId
  policyName:       string
  violationCount:   number
  lastViolatedAt:   string | null
  mostAffectedUser: string | null
  avgPerDay:        number
}

export interface PolicyMetricsSummary {
  period:         string
  totalChecks:    number
  totalViolations: number
  violationsByPolicy: Record<PolicyId, number>
  violationsBySeverity: Record<PolicySeverity, number>
  topViolatedPolicies: PolicyViolationSummary[]
  enforcementRate: number    // % of violations that resulted in action (not LOG_ONLY)
}

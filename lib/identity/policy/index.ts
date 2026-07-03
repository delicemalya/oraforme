// ── Types ─────────────────────────────────────────────────────────────────────
export type {
  PolicyId,
  PolicyVerdict,
  PolicySeverity,
  PolicyActionType,
  PolicyAction,
  PolicyEvidence,
  PolicyDataPoint,
  PolicyHistoryEntry,
  PolicyContextHistory,
  PolicyTenantConfig,
  PolicyEvent,
  PolicyContext,
  PolicyException,
  PolicyMetricConfig,
  IdentityPolicy,
  PolicyDecision,
  PolicyActionResult,
  PolicyHistoryRecord,
  PolicyViolationSummary,
  PolicyMetricsSummary,
} from './types'

export { POLICY_IDS, DEFAULT_TENANT_CONFIG } from './types'

// ── Policies ──────────────────────────────────────────────────────────────────
export {
  ALL_POLICIES,
  getPolicyById,
  getPoliciesForEvent,
  P001_BRUTE_FORCE,
  P002_UNUSUAL_COUNTRY,
  P003_IP_CHANGE_BRUTAL,
  P004_EXCESSIVE_SESSIONS,
  P005_ABNORMAL_REFRESH,
  P006_INACTIVE_ACCOUNT,
  P007_PASSWORD_EXPIRED,
  P008_MFA_REQUIRED,
  P009_SESSION_TOO_LONG,
  P010_UNKNOWN_DEVICE,
} from './policies'

// ── Evaluation Engine ─────────────────────────────────────────────────────────
export { PolicyEvaluationEngine, policyEngine, evaluatePolicies } from './evaluation-engine'
export type { EvaluationOptions, EvaluationResult } from './evaluation-engine'

// ── Action Engine ─────────────────────────────────────────────────────────────
export { PolicyActionEngine, actionEngine, executeAction } from './action-engine'
export type { ActionEngineOptions } from './action-engine'

// ── Persistence ───────────────────────────────────────────────────────────────
export { writePolicyDecision, getPolicyHistory } from './history'

// ── Metrics ───────────────────────────────────────────────────────────────────
export { getPolicyMetrics, getGlobalPolicyMetrics, aggregatePolicyMetrics } from './metrics'

// ── Audit Trail ───────────────────────────────────────────────────────────────
export {
  queryAuditTrail,
  getAuditEntry,
  countAuditEntries,
  getUnresolvedViolations,
} from './audit-trail'
export type { AuditQuery, AuditEntry } from './audit-trail'

// ── Context Builder ───────────────────────────────────────────────────────────
export { buildPolicyContext, buildPolicyEvent } from './context-builder'

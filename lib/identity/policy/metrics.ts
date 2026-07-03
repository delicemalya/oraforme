import { supabaseAdmin } from '@/lib/supabase-server'
import type { PolicyId, PolicyMetricsSummary, PolicySeverity } from './types'
import { POLICY_IDS } from './types'

type Period = '24h' | '7d' | '30d'

function periodToInterval(p: Period): string {
  return p === '24h' ? '24 hours' : p === '7d' ? '7 days' : '30 days'
}

export async function getPolicyMetrics(
  tenantId: string,
  period: Period = '24h',
): Promise<PolicyMetricsSummary> {
  const interval = periodToInterval(period)

  const { data, error } = await supabaseAdmin
    .from('policy_history')
    .select('policy_id, policy_name, verdict, severity, created_at')
    .eq('tenant_id', tenantId)
    .gte('created_at', `now() - interval '${interval}'`)

  if (error || !data) {
    console.error('[policy-metrics] Query failed:', error?.message)
    return emptyMetrics(period)
  }

  return aggregatePolicyMetrics(data, period)
}

export async function getGlobalPolicyMetrics(period: Period = '24h'): Promise<PolicyMetricsSummary> {
  const interval = periodToInterval(period)

  const { data, error } = await supabaseAdmin
    .from('policy_history')
    .select('policy_id, policy_name, verdict, severity, created_at')
    .gte('created_at', `now() - interval '${interval}'`)

  if (error || !data) {
    console.error('[policy-metrics] Global query failed:', error?.message)
    return emptyMetrics(period)
  }

  return aggregatePolicyMetrics(data, period)
}

type HistoryRow = {
  policy_id:   string
  policy_name: string
  verdict:     string
  severity:    string
  created_at:  string
}

export function aggregatePolicyMetrics(rows: HistoryRow[], period: string): PolicyMetricsSummary {
  const totalChecks    = rows.length
  const violations     = rows.filter(r => r.verdict === 'DENY' || r.verdict === 'FLAG')
  const totalViolations = violations.length

  const violationsByPolicy = Object.fromEntries(
    POLICY_IDS.map(id => [id, 0])
  ) as Record<PolicyId, number>

  const violationsBySeverity: Record<PolicySeverity, number> = {
    LOW: 0, MEDIUM: 0, HIGH: 0, CRITICAL: 0,
  }

  const lastViolatedAt: Record<string, string | null> = {}
  const mostAffectedUser: Record<string, Record<string, number>> = {}

  for (const row of violations) {
    const pid = row.policy_id as PolicyId
    if (pid in violationsByPolicy) violationsByPolicy[pid]++

    const sev = row.severity as PolicySeverity
    if (sev in violationsBySeverity) violationsBySeverity[sev]++

    if (!lastViolatedAt[pid] || row.created_at > (lastViolatedAt[pid] ?? '')) {
      lastViolatedAt[pid] = row.created_at
    }
  }

  const daySpan = period === '24h' ? 1 : period === '7d' ? 7 : 30

  const topViolatedPolicies = POLICY_IDS
    .filter(id => violationsByPolicy[id] > 0)
    .map(id => {
      const name = violations.find(r => r.policy_id === id)?.policy_name ?? id
      return {
        policyId:         id,
        policyName:       name,
        violationCount:   violationsByPolicy[id],
        lastViolatedAt:   lastViolatedAt[id] ?? null,
        mostAffectedUser: mostAffectedUser[id] ? Object.keys(mostAffectedUser[id])[0] : null,
        avgPerDay:        Math.round((violationsByPolicy[id] / daySpan) * 100) / 100,
      }
    })
    .sort((a, b) => b.violationCount - a.violationCount)
    .slice(0, 5)

  const actionable = violations.filter(r => r.verdict === 'DENY').length
  const enforcementRate = totalViolations > 0
    ? Math.round((actionable / totalViolations) * 100)
    : 0

  return {
    period,
    totalChecks,
    totalViolations,
    violationsByPolicy,
    violationsBySeverity,
    topViolatedPolicies,
    enforcementRate,
  }
}

function emptyMetrics(period: string): PolicyMetricsSummary {
  return {
    period,
    totalChecks:    0,
    totalViolations: 0,
    violationsByPolicy: Object.fromEntries(POLICY_IDS.map(id => [id, 0])) as Record<PolicyId, number>,
    violationsBySeverity: { LOW: 0, MEDIUM: 0, HIGH: 0, CRITICAL: 0 },
    topViolatedPolicies: [],
    enforcementRate: 0,
  }
}

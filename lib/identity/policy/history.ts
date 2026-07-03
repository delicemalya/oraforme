import { supabaseAdmin } from '@/lib/supabase-server'
import type { PolicyDecision, PolicyHistoryRecord } from './types'

export async function writePolicyDecision(
  decision: PolicyDecision,
  actionSuccess?: boolean,
): Promise<void> {
  try {
    await _writePolicyDecision(decision, actionSuccess)
  } catch (err) {
    console.error('[policy-history] writePolicyDecision error:', err)
  }
}

async function _writePolicyDecision(
  decision: PolicyDecision,
  actionSuccess?: boolean,
): Promise<void> {
  const record: Omit<PolicyHistoryRecord, 'id' | 'created_at'> = {
    policy_id:       decision.policyId,
    policy_name:     decision.policyName,
    tenant_id:       decision.tenantId,
    user_id:         decision.userId,
    request_id:      decision.requestId,
    verdict:         decision.verdict,
    severity:        decision.severity,
    reason:          decision.reason,
    action_type:     decision.action.type,
    action_reason:   decision.action.reason,
    action_delay_ms: decision.delayMs,
    action_success:  actionSuccess,
    evidence:        decision.evidence,
  }

  const { error } = await supabaseAdmin.from('policy_history').insert(record)
  if (error) {
    console.error('[policy-history] Insert failed:', error.message)
  }

  // Mirror DENY/FLAG to policy_violations for alert tracking
  if (decision.verdict === 'DENY' || decision.verdict === 'FLAG') {
    const { data: inserted } = await supabaseAdmin
      .from('policy_history')
      .select('id')
      .eq('request_id', decision.requestId)
      .eq('policy_id', decision.policyId)
      .single()

    if (inserted?.id) {
      const { error: vErr } = await supabaseAdmin.from('policy_violations').insert({
        history_id:  inserted.id,
        policy_id:   decision.policyId,
        tenant_id:   decision.tenantId,
        user_id:     decision.userId,
        severity:    decision.severity,
        verdict:     decision.verdict,
      })
      if (vErr) {
        console.error('[policy-history] Violation insert failed:', vErr.message)
      }
    }
  }
}

export async function getPolicyHistory(opts: {
  tenantId:  string
  limit?:    number
  offset?:   number
  policyId?: string
  verdict?:  string
}): Promise<PolicyHistoryRecord[]> {
  const { tenantId, limit = 50, offset = 0, policyId, verdict } = opts

  let query = supabaseAdmin
    .from('policy_history')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (policyId) query = query.eq('policy_id', policyId)
  if (verdict)  query = query.eq('verdict', verdict)

  const { data, error } = await query
  if (error) {
    console.error('[policy-history] Query failed:', error.message)
    return []
  }
  return (data ?? []) as PolicyHistoryRecord[]
}

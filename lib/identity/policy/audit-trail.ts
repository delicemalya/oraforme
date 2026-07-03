import { supabaseAdmin } from '@/lib/supabase-server'
import type { PolicyHistoryRecord } from './types'

// ─────────────────────────────────────────────────────────────────────────────
// Audit Trail — lecture seule, registre immuable des décisions Policy Engine
// Aucune mutation possible depuis ce module.
// ─────────────────────────────────────────────────────────────────────────────

export interface AuditQuery {
  tenantId:   string
  userId?:    string
  policyId?:  string
  verdict?:   string
  severity?:  string
  fromDate?:  string   // ISO timestamp
  toDate?:    string   // ISO timestamp
  limit?:     number
  offset?:    number
}

export interface AuditEntry extends PolicyHistoryRecord {
  id:         string
  created_at: string
}

export async function queryAuditTrail(q: AuditQuery): Promise<AuditEntry[]> {
  const { tenantId, userId, policyId, verdict, severity, fromDate, toDate, limit = 100, offset = 0 } = q

  let query = supabaseAdmin
    .from('policy_history')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (userId)   query = query.eq('user_id', userId)
  if (policyId) query = query.eq('policy_id', policyId)
  if (verdict)  query = query.eq('verdict', verdict)
  if (severity) query = query.eq('severity', severity)
  if (fromDate) query = query.gte('created_at', fromDate)
  if (toDate)   query = query.lte('created_at', toDate)

  const { data, error } = await query
  if (error) {
    console.error('[audit-trail] Query error:', error.message)
    return []
  }

  return (data ?? []) as AuditEntry[]
}

export async function getAuditEntry(id: string, tenantId: string): Promise<AuditEntry | null> {
  const { data, error } = await supabaseAdmin
    .from('policy_history')
    .select('*')
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .single()

  if (error || !data) return null
  return data as AuditEntry
}

export async function countAuditEntries(q: Omit<AuditQuery, 'limit' | 'offset'>): Promise<number> {
  const { tenantId, userId, policyId, verdict, severity, fromDate, toDate } = q

  let query = supabaseAdmin
    .from('policy_history')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)

  if (userId)   query = query.eq('user_id', userId)
  if (policyId) query = query.eq('policy_id', policyId)
  if (verdict)  query = query.eq('verdict', verdict)
  if (severity) query = query.eq('severity', severity)
  if (fromDate) query = query.gte('created_at', fromDate)
  if (toDate)   query = query.lte('created_at', toDate)

  const { count, error } = await query
  if (error) {
    console.error('[audit-trail] Count error:', error.message)
    return 0
  }

  return count ?? 0
}

export async function getUnresolvedViolations(tenantId: string): Promise<AuditEntry[]> {
  const { data, error } = await supabaseAdmin
    .from('policy_violations')
    .select('history_id, policy_violations.severity, policy_violations.created_at, policy_history(*)')
    .eq('tenant_id', tenantId)
    .eq('resolved', false)
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) {
    console.error('[audit-trail] Unresolved violations error:', error.message)
    return []
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data ?? []).map((row: any) => row['policy_history'] as AuditEntry).filter(Boolean)
}

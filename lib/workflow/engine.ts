// ── Workflow Execution Engine ───────────────────────────────────────────────

import { supabaseAdmin } from '@/lib/supabase-server'
import { executeAction } from './actions'
import type {
  WorkflowDefinition,
  WorkflowCondition,
  TriggerPayload,
  ActionResult,
  ExecutionStatus,
} from './types'

// ── Condition evaluation ──────────────────────────────────────────────────────

function resolveField(data: Record<string, unknown>, field: string): unknown {
  const parts = field.split('.')
  let val: unknown = data
  for (const p of parts) {
    val = (val as Record<string, unknown>)?.[p]
  }
  return val
}

function evaluateCondition(
  cond: WorkflowCondition,
  data: Record<string, unknown>,
): boolean {
  const actual = resolveField(data, cond.field)
  const expected = cond.value

  switch (cond.operator) {
    case 'equals':          return actual == expected
    case 'not_equals':      return actual != expected
    case 'greater_than':    return Number(actual) > Number(expected)
    case 'less_than':       return Number(actual) < Number(expected)
    case 'greater_or_equal':return Number(actual) >= Number(expected)
    case 'less_or_equal':   return Number(actual) <= Number(expected)
    case 'contains':        return String(actual).includes(String(expected))
    case 'not_contains':    return !String(actual).includes(String(expected))
    case 'is_empty':        return actual == null || actual === '' || (Array.isArray(actual) && actual.length === 0)
    case 'is_not_empty':    return actual != null && actual !== '' && !(Array.isArray(actual) && actual.length === 0)
    case 'in':              return Array.isArray(expected) && expected.includes(actual as string)
    case 'not_in':          return Array.isArray(expected) && !expected.includes(actual as string)
    default:                return false
  }
}

function evaluateConditions(
  conditions: WorkflowCondition[],
  data: Record<string, unknown>,
): boolean {
  return conditions.every(c => evaluateCondition(c, data))
}

// ── Execution state management ────────────────────────────────────────────────

async function updateExecution(
  executionId: string,
  update: {
    status?: ExecutionStatus
    result?: Record<string, unknown>
    error?: string
    started_at?: string
    completed_at?: string
  },
) {
  await supabaseAdmin
    .from('workflow_executions')
    .update(update)
    .eq('id', executionId)
}

async function appendLog(
  executionId: string,
  workflowId: string,
  tenantId: string,
  level: 'info' | 'warning' | 'error',
  message: string,
  data: Record<string, unknown> = {},
) {
  await supabaseAdmin.from('workflow_logs').insert({
    execution_id: executionId,
    workflow_id: workflowId,
    tenant_id: tenantId,
    level,
    message,
    data,
  })
}

// ── Core runner ───────────────────────────────────────────────────────────────

export async function runWorkflow(
  workflow: WorkflowDefinition,
  executionId: string,
  triggerData: Record<string, unknown>,
): Promise<{ success: boolean; results: ActionResult[]; error?: string }> {
  const tenantId = workflow.tenant_id

  await updateExecution(executionId, {
    status: 'running',
    started_at: new Date().toISOString(),
  })

  await appendLog(executionId, workflow.id, tenantId, 'info', `Workflow "${workflow.name}" started`, {
    trigger_type: workflow.trigger_type,
  })

  // Evaluate conditions
  if (workflow.conditions.length > 0) {
    const pass = evaluateConditions(workflow.conditions, triggerData)
    if (!pass) {
      await updateExecution(executionId, {
        status: 'skipped',
        completed_at: new Date().toISOString(),
        result: { reason: 'conditions_not_met' },
      })
      await appendLog(executionId, workflow.id, tenantId, 'info', 'Conditions not met — skipped')
      return { success: true, results: [] }
    }
  }

  // Execute actions sequentially
  const results: ActionResult[] = []
  const ctx = { tenantId, workflowId: workflow.id, executionId, triggerData }

  for (const action of workflow.actions) {
    try {
      const result = await executeAction(action, ctx)
      results.push(result)

      await appendLog(
        executionId,
        workflow.id,
        tenantId,
        result.success ? 'info' : 'warning',
        `Action "${action.label ?? action.type}" ${result.success ? 'succeeded' : 'failed'}`,
        { action_id: action.id, duration_ms: result.duration_ms, error: result.error },
      )

      // Hard-stop on critical action failure
      if (!result.success && (action.config as Record<string, unknown>)?.stop_on_error) {
        throw new Error(`Action ${action.id} failed: ${result.error}`)
      }
    } catch (e) {
      const error = String(e)
      results.push({
        action_id: action.id,
        type: action.type,
        success: false,
        error,
        duration_ms: 0,
      })
      await appendLog(executionId, workflow.id, tenantId, 'error', `Action "${action.type}" threw: ${error}`)
      break
    }
  }

  const allOk = results.every(r => r.success)
  const finalStatus: ExecutionStatus = allOk ? 'completed' : 'failed'

  await updateExecution(executionId, {
    status: finalStatus,
    completed_at: new Date().toISOString(),
    result: {
      actions_count: results.length,
      actions_ok: results.filter(r => r.success).length,
      actions_failed: results.filter(r => !r.success).length,
    },
    error: allOk ? undefined : results.find(r => !r.success)?.error,
  })

  // Increment workflow run_count
  await supabaseAdmin
    .from('workflow_definitions')
    .update({
      run_count: workflow.run_count + 1,
      last_run_at: new Date().toISOString(),
    })
    .eq('id', workflow.id)
    .eq('tenant_id', tenantId)

  await appendLog(
    executionId,
    workflow.id,
    tenantId,
    allOk ? 'info' : 'warning',
    `Workflow "${workflow.name}" ${finalStatus}`,
    { results_count: results.length, ok: allOk },
  )

  return { success: allOk, results }
}

// ── Fire a trigger — used by module APIs ──────────────────────────────────────

export async function fireTrigger(payload: TriggerPayload): Promise<void> {
  // Fetch all active workflows matching this trigger for this tenant
  const { data: workflows } = await supabaseAdmin
    .from('workflow_definitions')
    .select('*')
    .eq('tenant_id', payload.tenant_id)
    .eq('trigger_type', payload.type)
    .eq('is_active', true)

  if (!workflows?.length) return

  for (const wf of workflows as WorkflowDefinition[]) {
    // Check trigger_config filters (e.g. { module: 'ecole', statut: 'envoyee' })
    if (wf.trigger_config && Object.keys(wf.trigger_config).length > 0) {
      const configMatch = Object.entries(wf.trigger_config).every(([k, v]) => {
        const actual = resolveField(payload.data, k)
        return actual == v
      })
      if (!configMatch) continue
    }

    // Create execution record
    const { data: exec } = await supabaseAdmin
      .from('workflow_executions')
      .insert({
        workflow_id: wf.id,
        tenant_id: payload.tenant_id,
        status: 'pending',
        trigger_data: payload.data,
        result: {},
      })
      .select('id')
      .single()

    if (!exec?.id) continue

    // Run async (fire-and-forget in serverless, awaited in cron)
    runWorkflow(wf, exec.id, payload.data).catch(() => {
      // Failure already logged inside runWorkflow
    })
  }
}

// ── Process pending executions (called by cron) ───────────────────────────────

export async function processPendingExecutions(tenantId?: string): Promise<number> {
  const query = supabaseAdmin
    .from('workflow_executions')
    .select(`
      *,
      workflow:workflow_definitions(*)
    `)
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .limit(20)

  if (tenantId) query.eq('tenant_id', tenantId)

  const { data: executions } = await query

  if (!executions?.length) return 0

  let processed = 0
  for (const exec of executions) {
    const wf = (exec as { workflow: WorkflowDefinition }).workflow
    if (!wf?.is_active) {
      await updateExecution(exec.id, { status: 'skipped' })
      continue
    }
    await runWorkflow(wf, exec.id, exec.trigger_data as Record<string, unknown>)
    processed++
  }

  return processed
}

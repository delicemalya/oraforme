// ── Workflow Action Handlers ────────────────────────────────────────────────

import { supabaseAdmin } from '@/lib/supabase-server'
import type { WorkflowAction, ActionResult, ActionType } from './types'

// ── Template variable interpolation ──────────────────────────────────────────

export function interpolate(template: string, data: Record<string, unknown>): string {
  return template.replace(/\{\{([^}]+)\}\}/g, (_, key) => {
    const parts = key.trim().split('.')
    let val: unknown = data
    for (const p of parts) {
      val = (val as Record<string, unknown>)?.[p]
    }
    return val != null ? String(val) : `{{${key}}}`
  })
}

function interpolateConfig(
  config: Record<string, unknown>,
  data: Record<string, unknown>,
): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(config)) {
    if (typeof v === 'string') result[k] = interpolate(v, data)
    else if (typeof v === 'object' && v !== null && !Array.isArray(v))
      result[k] = interpolateConfig(v as Record<string, unknown>, data)
    else result[k] = v
  }
  return result
}

// ── Action executor map ───────────────────────────────────────────────────────

type Handler = (
  action: WorkflowAction,
  ctx: ActionContext,
) => Promise<ActionResult>

export interface ActionContext {
  tenantId: string
  workflowId: string
  executionId: string
  triggerData: Record<string, unknown>
}

// ── Individual handlers ───────────────────────────────────────────────────────

async function handleNotificationCreate(
  action: WorkflowAction,
  ctx: ActionContext,
): Promise<ActionResult> {
  const t0 = Date.now()
  const cfg = interpolateConfig(action.config, ctx.triggerData) as {
    title: string
    body: string
    type?: string
    user_id?: string
    link?: string
  }

  const { error } = await supabaseAdmin.from('notifications').insert({
    tenant_id: ctx.tenantId,
    user_id: cfg.user_id ?? null,
    title: cfg.title,
    body: cfg.body,
    type: cfg.type ?? 'info',
    link: cfg.link ?? null,
    read: false,
  })

  return {
    action_id: action.id,
    type: action.type,
    success: !error,
    error: error?.message,
    duration_ms: Date.now() - t0,
  }
}

async function handleEmailSend(
  action: WorkflowAction,
  ctx: ActionContext,
): Promise<ActionResult> {
  const t0 = Date.now()
  const cfg = interpolateConfig(action.config, ctx.triggerData) as {
    to: string
    subject: string
    template?: string
    body?: string
    data?: Record<string, unknown>
  }

  const { error } = await supabaseAdmin.from('email_queue').insert({
    tenant_id: ctx.tenantId,
    to_email: cfg.to,
    subject: cfg.subject,
    template: cfg.template ?? 'generic',
    data: cfg.data ?? ctx.triggerData,
    statut: 'pending',
  })

  return {
    action_id: action.id,
    type: action.type,
    success: !error,
    error: error?.message,
    duration_ms: Date.now() - t0,
  }
}

async function handleSmsSend(
  action: WorkflowAction,
  ctx: ActionContext,
): Promise<ActionResult> {
  const t0 = Date.now()
  const cfg = interpolateConfig(action.config, ctx.triggerData) as {
    to: string
    message: string
    provider?: string
  }

  const { error } = await supabaseAdmin.from('sms_queue').insert({
    tenant_id: ctx.tenantId,
    to_phone: cfg.to,
    message: cfg.message,
    provider: cfg.provider ?? 'twilio',
    channel: 'sms',
    statut: 'pending',
    params: {},
  })

  return {
    action_id: action.id,
    type: action.type,
    success: !error,
    error: error?.message,
    duration_ms: Date.now() - t0,
  }
}

async function handleWebhookTrigger(
  action: WorkflowAction,
  ctx: ActionContext,
): Promise<ActionResult> {
  const t0 = Date.now()
  const cfg = interpolateConfig(action.config, ctx.triggerData) as {
    url: string
    method?: string
    headers?: Record<string, string>
    body?: Record<string, unknown>
  }

  try {
    const res = await fetch(cfg.url, {
      method: cfg.method ?? 'POST',
      headers: { 'Content-Type': 'application/json', ...(cfg.headers ?? {}) },
      body: JSON.stringify(cfg.body ?? ctx.triggerData),
    })
    return {
      action_id: action.id,
      type: action.type,
      success: res.ok,
      data: { status: res.status },
      error: res.ok ? undefined : `HTTP ${res.status}`,
      duration_ms: Date.now() - t0,
    }
  } catch (e) {
    return {
      action_id: action.id,
      type: action.type,
      success: false,
      error: String(e),
      duration_ms: Date.now() - t0,
    }
  }
}

async function handleRecordCreate(
  action: WorkflowAction,
  ctx: ActionContext,
): Promise<ActionResult> {
  const t0 = Date.now()
  const cfg = interpolateConfig(action.config, ctx.triggerData) as {
    table: string
    data: Record<string, unknown>
  }

  const { error } = await supabaseAdmin.from(cfg.table).insert({
    tenant_id: ctx.tenantId,
    ...cfg.data,
  })

  return {
    action_id: action.id,
    type: action.type,
    success: !error,
    error: error?.message,
    duration_ms: Date.now() - t0,
  }
}

async function handleRecordUpdate(
  action: WorkflowAction,
  ctx: ActionContext,
): Promise<ActionResult> {
  const t0 = Date.now()
  const cfg = interpolateConfig(action.config, ctx.triggerData) as {
    table: string
    id: string
    data: Record<string, unknown>
  }

  const { error } = await supabaseAdmin
    .from(cfg.table)
    .update(cfg.data)
    .eq('id', cfg.id)
    .eq('tenant_id', ctx.tenantId)

  return {
    action_id: action.id,
    type: action.type,
    success: !error,
    error: error?.message,
    duration_ms: Date.now() - t0,
  }
}

async function handleStatusUpdate(
  action: WorkflowAction,
  ctx: ActionContext,
): Promise<ActionResult> {
  const t0 = Date.now()
  const cfg = interpolateConfig(action.config, ctx.triggerData) as {
    table: string
    id: string
    field: string
    value: string
  }

  const { error } = await supabaseAdmin
    .from(cfg.table)
    .update({ [cfg.field]: cfg.value })
    .eq('id', cfg.id)
    .eq('tenant_id', ctx.tenantId)

  return {
    action_id: action.id,
    type: action.type,
    success: !error,
    error: error?.message,
    duration_ms: Date.now() - t0,
  }
}

async function handleWait(
  action: WorkflowAction,
  _: ActionContext,
): Promise<ActionResult> {
  const t0 = Date.now()
  const cfg = action.config as { duration_ms?: number; value?: number; unit?: string }
  const ms = cfg.duration_ms ?? (cfg.value ?? 0) * unitToMs(cfg.unit ?? 'ms')

  // Cap wait at 30s in-process; larger waits are handled by the cron scheduler
  const actualMs = Math.min(ms, 30_000)
  if (actualMs > 0) await new Promise(r => setTimeout(r, actualMs))

  return {
    action_id: action.id,
    type: action.type,
    success: true,
    data: { requested_ms: ms, waited_ms: actualMs },
    duration_ms: Date.now() - t0,
  }
}

function unitToMs(unit: string): number {
  const map: Record<string, number> = {
    ms: 1,
    seconds: 1_000,
    minutes: 60_000,
    hours: 3_600_000,
    days: 86_400_000,
  }
  return map[unit] ?? 1
}

async function handleWorkflowTrigger(
  action: WorkflowAction,
  ctx: ActionContext,
): Promise<ActionResult> {
  const t0 = Date.now()
  const cfg = action.config as { workflow_id: string }
  // Queue a manual trigger for another workflow via the executions table
  const { error } = await supabaseAdmin.from('workflow_executions').insert({
    workflow_id: cfg.workflow_id,
    tenant_id: ctx.tenantId,
    status: 'pending',
    trigger_data: { ...ctx.triggerData, _triggered_by: ctx.executionId },
    result: {},
  })

  return {
    action_id: action.id,
    type: action.type,
    success: !error,
    error: error?.message,
    duration_ms: Date.now() - t0,
  }
}

async function handleApiCall(
  action: WorkflowAction,
  ctx: ActionContext,
): Promise<ActionResult> {
  const t0 = Date.now()
  const cfg = interpolateConfig(action.config, ctx.triggerData) as {
    url: string
    method?: string
    headers?: Record<string, string>
    body?: Record<string, unknown>
  }

  try {
    const res = await fetch(cfg.url, {
      method: cfg.method ?? 'POST',
      headers: { 'Content-Type': 'application/json', ...(cfg.headers ?? {}) },
      body: cfg.body ? JSON.stringify(cfg.body) : undefined,
    })
    const body = await res.json().catch(() => ({}))
    return {
      action_id: action.id,
      type: action.type,
      success: res.ok,
      data: { status: res.status, body },
      error: res.ok ? undefined : `HTTP ${res.status}`,
      duration_ms: Date.now() - t0,
    }
  } catch (e) {
    return {
      action_id: action.id,
      type: action.type,
      success: false,
      error: String(e),
      duration_ms: Date.now() - t0,
    }
  }
}

async function handleLogCreate(
  action: WorkflowAction,
  ctx: ActionContext,
): Promise<ActionResult> {
  const t0 = Date.now()
  const cfg = interpolateConfig(action.config, ctx.triggerData) as {
    message: string
    level?: string
    data?: Record<string, unknown>
  }

  const { error } = await supabaseAdmin.from('workflow_logs').insert({
    execution_id: ctx.executionId,
    workflow_id: ctx.workflowId,
    tenant_id: ctx.tenantId,
    level: cfg.level ?? 'info',
    message: cfg.message,
    data: cfg.data ?? ctx.triggerData,
  })

  return {
    action_id: action.id,
    type: action.type,
    success: !error,
    error: error?.message,
    duration_ms: Date.now() - t0,
  }
}

async function handleMatrixSend(
  action: WorkflowAction,
  ctx: ActionContext,
): Promise<ActionResult> {
  const t0 = Date.now()
  const cfg = interpolateConfig(action.config, ctx.triggerData) as {
    table: string
    id: string
    prefix?: string
    field?: string
  }

  const year = new Date().getFullYear().toString().slice(-2)
  const { count } = await supabaseAdmin
    .from(cfg.table)
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', ctx.tenantId)

  const seq = String((count ?? 0) + 1).padStart(4, '0')
  const matricule = `${cfg.prefix ?? 'EMP'}${year}${seq}`

  const field = cfg.field ?? 'matricule'
  const { error } = await supabaseAdmin
    .from(cfg.table)
    .update({ [field]: matricule })
    .eq('id', cfg.id)
    .eq('tenant_id', ctx.tenantId)

  return {
    action_id: action.id,
    type: action.type,
    success: !error,
    data: { matricule },
    error: error?.message,
    duration_ms: Date.now() - t0,
  }
}

async function handlePdfGenerate(
  action: WorkflowAction,
  ctx: ActionContext,
): Promise<ActionResult> {
  const t0 = Date.now()
  const cfg = interpolateConfig(action.config, ctx.triggerData) as {
    template: string
    record_id: string
    table: string
    filename?: string
  }

  // Queue a PDF generation job
  const { error } = await supabaseAdmin.from('pdf_queue').insert({
    tenant_id: ctx.tenantId,
    template: cfg.template,
    record_id: cfg.record_id,
    table_name: cfg.table,
    filename: cfg.filename ?? `${cfg.template}-${cfg.record_id}.pdf`,
    statut: 'pending',
    data: ctx.triggerData,
  })

  return {
    action_id: action.id,
    type: action.type,
    success: !error,
    error: error?.message,
    duration_ms: Date.now() - t0,
  }
}

// ── Dispatch ──────────────────────────────────────────────────────────────────

const HANDLERS: Record<ActionType, Handler> = {
  'notification.create': handleNotificationCreate,
  'email.send':          handleEmailSend,
  'sms.send':            handleSmsSend,
  'webhook.trigger':     handleWebhookTrigger,
  'record.create':       handleRecordCreate,
  'record.update':       handleRecordUpdate,
  'status.update':       handleStatusUpdate,
  'wait':                handleWait,
  'workflow.trigger':    handleWorkflowTrigger,
  'api.call':            handleApiCall,
  'log.create':          handleLogCreate,
  'matrix.send':         handleMatrixSend,
  'pdf.generate':        handlePdfGenerate,
}

export async function executeAction(
  action: WorkflowAction,
  ctx: ActionContext,
): Promise<ActionResult> {
  const handler = HANDLERS[action.type]
  if (!handler) {
    return {
      action_id: action.id,
      type: action.type,
      success: false,
      error: `Unknown action type: ${action.type}`,
      duration_ms: 0,
    }
  }
  return handler(action, ctx)
}

import { NextRequest, NextResponse } from 'next/server'
import { requireTenant } from '@/lib/api/require-tenant'
import { checkRateLimit, RATE_LIMITS } from '@/lib/api/rate-limit'
import { supabaseAdmin } from '@/lib/supabase-server'
import { runWorkflow } from '@/lib/workflow/engine'
import type { WorkflowDefinition } from '@/lib/workflow/types'

export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ id: string }> }

// POST /api/workflows/[id]/run — manual execution
export async function POST(req: NextRequest, { params }: Params) {
  const limited = checkRateLimit(req, RATE_LIMITS.automation)
  if (limited) return limited

  const ctx = await requireTenant(req)
  if (!ctx.ok) return ctx.error

  const { id } = await params
  const body = await req.json().catch(() => ({}))

  const { data: wf } = await supabaseAdmin
    .from('workflow_definitions')
    .select('*')
    .eq('id', id)
    .eq('tenant_id', ctx.tid)
    .single()

  if (!wf) return NextResponse.json({ error: 'Workflow introuvable' }, { status: 404 })

  if (!wf.is_active) {
    return NextResponse.json({ error: 'Workflow inactif' }, { status: 400 })
  }

  const triggerData: Record<string, unknown> = {
    ...(body.data ?? {}),
    _manual: true,
    _triggered_by: ctx.userId,
  }

  // Create execution record
  const { data: exec } = await supabaseAdmin
    .from('workflow_executions')
    .insert({
      workflow_id: wf.id,
      tenant_id: ctx.tid,
      status: 'pending',
      trigger_data: triggerData,
      result: {},
    })
    .select('id')
    .single()

  if (!exec?.id) {
    return NextResponse.json({ error: 'Impossible de créer l\'exécution' }, { status: 500 })
  }

  const result = await runWorkflow(wf as WorkflowDefinition, exec.id, triggerData)

  return NextResponse.json({
    execution_id: exec.id,
    success: result.success,
    actions: result.results,
    error: result.error,
  })
}

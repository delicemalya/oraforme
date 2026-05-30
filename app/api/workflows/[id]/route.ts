import { NextRequest, NextResponse } from 'next/server'
import { requireTenant } from '@/lib/api/require-tenant'
import { checkRateLimit, RATE_LIMITS } from '@/lib/api/rate-limit'
import { supabaseAdmin } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ id: string }> }

// GET /api/workflows/[id]
export async function GET(req: NextRequest, { params }: Params) {
  const limited = checkRateLimit(req, RATE_LIMITS.api)
  if (limited) return limited

  const ctx = await requireTenant(req)
  if (!ctx.ok) return ctx.error

  const { id } = await params

  const { data, error } = await supabaseAdmin
    .from('workflow_definitions')
    .select('*')
    .eq('id', id)
    .eq('tenant_id', ctx.tid)
    .single()

  if (error || !data) return NextResponse.json({ error: 'Workflow introuvable' }, { status: 404 })
  return NextResponse.json({ workflow: data })
}

// PUT /api/workflows/[id]
export async function PUT(req: NextRequest, { params }: Params) {
  const limited = checkRateLimit(req, RATE_LIMITS.api)
  if (limited) return limited

  const ctx = await requireTenant(req)
  if (!ctx.ok) return ctx.error

  const { id } = await params
  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'Body invalide' }, { status: 400 })

  const allowed = ['name', 'description', 'trigger_type', 'trigger_config', 'conditions', 'actions', 'is_active']
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() }
  for (const key of allowed) {
    if (key in body) update[key] = body[key]
  }

  const { data, error } = await supabaseAdmin
    .from('workflow_definitions')
    .update(update)
    .eq('id', id)
    .eq('tenant_id', ctx.tid)
    .select()
    .single()

  if (error || !data) return NextResponse.json({ error: 'Workflow introuvable' }, { status: 404 })
  return NextResponse.json({ workflow: data })
}

// DELETE /api/workflows/[id]
export async function DELETE(req: NextRequest, { params }: Params) {
  const limited = checkRateLimit(req, RATE_LIMITS.api)
  if (limited) return limited

  const ctx = await requireTenant(req)
  if (!ctx.ok) return ctx.error

  const { id } = await params

  const { error } = await supabaseAdmin
    .from('workflow_definitions')
    .delete()
    .eq('id', id)
    .eq('tenant_id', ctx.tid)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

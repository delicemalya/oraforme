import { NextRequest, NextResponse } from 'next/server'
import { requireTenant } from '@/lib/api/require-tenant'
import { checkRateLimit, RATE_LIMITS } from '@/lib/api/rate-limit'
import { supabaseAdmin } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'

// GET /api/workflows — list workflows for current tenant
export async function GET(req: NextRequest) {
  const limited = checkRateLimit(req, RATE_LIMITS.api)
  if (limited) return limited

  const ctx = await requireTenant(req)
  if (!ctx.ok) return ctx.error

  const { searchParams } = new URL(req.url)
  const trigger = searchParams.get('trigger')
  const active = searchParams.get('active')

  let query = supabaseAdmin
    .from('workflow_definitions')
    .select('*')
    .eq('tenant_id', ctx.tid)
    .order('created_at', { ascending: false })

  if (trigger) query = query.eq('trigger_type', trigger)
  if (active !== null) query = query.eq('is_active', active === 'true')

  const { data, error } = await query

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ workflows: data ?? [] })
}

// POST /api/workflows — create workflow
export async function POST(req: NextRequest) {
  const limited = checkRateLimit(req, RATE_LIMITS.api)
  if (limited) return limited

  const ctx = await requireTenant(req)
  if (!ctx.ok) return ctx.error

  const body = await req.json().catch(() => null)
  if (!body?.name || !body?.trigger_type) {
    return NextResponse.json({ error: 'name et trigger_type requis' }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin
    .from('workflow_definitions')
    .insert({
      tenant_id: ctx.tid,
      name: body.name,
      description: body.description ?? null,
      trigger_type: body.trigger_type,
      trigger_config: body.trigger_config ?? {},
      conditions: body.conditions ?? [],
      actions: body.actions ?? [],
      is_active: body.is_active ?? false,
      run_count: 0,
      last_run_at: null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ workflow: data }, { status: 201 })
}

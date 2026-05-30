import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/api/require-tenant'
import { checkRateLimit, RATE_LIMITS } from '@/lib/api/rate-limit'
import { supabaseAdmin } from '@/lib/supabase-server'
import { deliverWebhook } from '@/lib/webhooks/sender'

export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ id: string }> }

// PATCH /api/webhooks/endpoints/[id]
export async function PATCH(req: NextRequest, { params }: Params) {
  const limited = checkRateLimit(req, RATE_LIMITS.api)
  if (limited) return limited

  const ctx = await requireRole('admin', req)
  if (!ctx.ok) return ctx.error

  const { id } = await params
  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'Body invalide' }, { status: 400 })

  const allowed = ['url', 'events', 'is_active', 'headers']
  const update: Record<string, unknown> = {}
  for (const key of allowed) {
    if (key in body) update[key] = body[key]
  }

  if (update.url) {
    try { new URL(update.url as string) } catch {
      return NextResponse.json({ error: 'URL invalide' }, { status: 400 })
    }
  }

  const { data, error } = await supabaseAdmin
    .from('webhook_endpoints')
    .update(update)
    .eq('id', id)
    .eq('tenant_id', ctx.tid)
    .select('id, url, events, is_active, headers, created_at')
    .single()

  if (error || !data) return NextResponse.json({ error: 'Endpoint introuvable' }, { status: 404 })
  return NextResponse.json({ endpoint: data })
}

// DELETE /api/webhooks/endpoints/[id]
export async function DELETE(req: NextRequest, { params }: Params) {
  const limited = checkRateLimit(req, RATE_LIMITS.api)
  if (limited) return limited

  const ctx = await requireRole('admin', req)
  if (!ctx.ok) return ctx.error

  const { id } = await params

  const { error } = await supabaseAdmin
    .from('webhook_endpoints')
    .delete()
    .eq('id', id)
    .eq('tenant_id', ctx.tid)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

// POST /api/webhooks/endpoints/[id]/test — send a test ping
export async function POST(req: NextRequest, { params }: Params) {
  const limited = checkRateLimit(req, RATE_LIMITS.api)
  if (limited) return limited

  const ctx = await requireRole('admin', req)
  if (!ctx.ok) return ctx.error

  const { id } = await params

  // Check endpoint belongs to tenant
  const { data: ep } = await supabaseAdmin
    .from('webhook_endpoints')
    .select('id')
    .eq('id', id)
    .eq('tenant_id', ctx.tid)
    .single()

  if (!ep) return NextResponse.json({ error: 'Endpoint introuvable' }, { status: 404 })

  // Create a test delivery
  const { data: delivery } = await supabaseAdmin
    .from('webhook_deliveries')
    .insert({
      endpoint_id: id,
      tenant_id: ctx.tid,
      event: 'test.ping',
      payload: { message: 'Oraforme webhook test ping', timestamp: new Date().toISOString() },
      status: 'pending',
      attempts: 0,
      next_retry_at: new Date().toISOString(),
    })
    .select('id')
    .single()

  if (!delivery?.id) return NextResponse.json({ error: 'Erreur création livraison' }, { status: 500 })

  const result = await deliverWebhook(delivery.id)
  return NextResponse.json({ delivery_id: delivery.id, ...result })
}

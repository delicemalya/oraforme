import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/api/require-tenant'
import { checkRateLimit, RATE_LIMITS } from '@/lib/api/rate-limit'
import { supabaseAdmin } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ id: string }> }

// PATCH /api/api-keys/[id] — update (rename, toggle active, update scopes)
export async function PATCH(req: NextRequest, { params }: Params) {
  const limited = checkRateLimit(req, RATE_LIMITS.api)
  if (limited) return limited

  const ctx = await requireRole('admin', req)
  if (!ctx.ok) return ctx.error

  const { id } = await params
  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'Body invalide' }, { status: 400 })

  const allowed = ['name', 'scopes', 'is_active', 'expires_at']
  const update: Record<string, unknown> = {}
  for (const key of allowed) {
    if (key in body) update[key] = body[key]
  }

  const { data, error } = await supabaseAdmin
    .from('api_keys')
    .update(update)
    .eq('id', id)
    .eq('tenant_id', ctx.tid)
    .select('id, name, scopes, is_active, expires_at, created_at')
    .single()

  if (error || !data) return NextResponse.json({ error: 'Clé introuvable' }, { status: 404 })
  return NextResponse.json({ key: data })
}

// DELETE /api/api-keys/[id] — revoke key
export async function DELETE(req: NextRequest, { params }: Params) {
  const limited = checkRateLimit(req, RATE_LIMITS.api)
  if (limited) return limited

  const ctx = await requireRole('admin', req)
  if (!ctx.ok) return ctx.error

  const { id } = await params

  const { error } = await supabaseAdmin
    .from('api_keys')
    .delete()
    .eq('id', id)
    .eq('tenant_id', ctx.tid)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

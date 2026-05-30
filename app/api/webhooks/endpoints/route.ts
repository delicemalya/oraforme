import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/api/require-tenant'
import { checkRateLimit, RATE_LIMITS } from '@/lib/api/rate-limit'
import { supabaseAdmin } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'

// GET /api/webhooks/endpoints
export async function GET(req: NextRequest) {
  const limited = checkRateLimit(req, RATE_LIMITS.api)
  if (limited) return limited

  const ctx = await requireRole('admin', req)
  if (!ctx.ok) return ctx.error

  const { data, error } = await supabaseAdmin
    .from('webhook_endpoints')
    .select('id, url, events, is_active, headers, created_at')
    .eq('tenant_id', ctx.tid)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ endpoints: data ?? [] })
}

// POST /api/webhooks/endpoints — register a new endpoint
export async function POST(req: NextRequest) {
  const limited = checkRateLimit(req, RATE_LIMITS.api)
  if (limited) return limited

  const ctx = await requireRole('admin', req)
  if (!ctx.ok) return ctx.error

  const body = await req.json().catch(() => null)
  if (!body?.url) return NextResponse.json({ error: 'url requis' }, { status: 400 })

  try { new URL(body.url) } catch {
    return NextResponse.json({ error: 'URL invalide' }, { status: 400 })
  }

  // Generate a webhook signing secret
  const secretBytes = crypto.getRandomValues(new Uint8Array(24))
  const secret = 'whsec_' + Array.from(secretBytes).map(b => b.toString(16).padStart(2, '0')).join('')

  const { data, error } = await supabaseAdmin
    .from('webhook_endpoints')
    .insert({
      tenant_id: ctx.tid,
      url: body.url,
      secret,
      events: body.events ?? ['*'],
      is_active: body.is_active ?? true,
      headers: body.headers ?? {},
    })
    .select('id, url, events, is_active, created_at')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Return secret once
  return NextResponse.json({ endpoint: data, secret }, { status: 201 })
}

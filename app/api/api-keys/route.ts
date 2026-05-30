import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/api/require-tenant'
import { checkRateLimit, RATE_LIMITS } from '@/lib/api/rate-limit'
import { supabaseAdmin } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'

// GET /api/api-keys — list keys for current tenant
export async function GET(req: NextRequest) {
  const limited = checkRateLimit(req, RATE_LIMITS.api)
  if (limited) return limited

  const ctx = await requireRole('admin', req)
  if (!ctx.ok) return ctx.error

  const { data, error } = await supabaseAdmin
    .from('api_keys')
    .select('id, name, scopes, is_active, last_used_at, expires_at, created_at')
    .eq('tenant_id', ctx.tid)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ keys: data ?? [] })
}

// POST /api/api-keys — create a new API key
export async function POST(req: NextRequest) {
  const limited = checkRateLimit(req, RATE_LIMITS.api)
  if (limited) return limited

  const ctx = await requireRole('admin', req)
  if (!ctx.ok) return ctx.error

  const body = await req.json().catch(() => null)
  if (!body?.name) return NextResponse.json({ error: 'name requis' }, { status: 400 })

  // Generate a secure random key: sk_live_<32 random bytes as hex>
  const rawBytes = crypto.getRandomValues(new Uint8Array(32))
  const rawKey = 'sk_live_' + Array.from(rawBytes).map(b => b.toString(16).padStart(2, '0')).join('')

  // Hash for storage
  const hashBuffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(rawKey))
  const keyHash = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('')

  const { data, error } = await supabaseAdmin
    .from('api_keys')
    .insert({
      tenant_id: ctx.tid,
      created_by: ctx.profileId,
      name: body.name,
      key_hash: keyHash,
      scopes: body.scopes ?? ['read'],
      is_active: true,
      expires_at: body.expires_at ?? null,
    })
    .select('id, name, scopes, is_active, expires_at, created_at')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Return the raw key ONCE — never stored in plaintext
  return NextResponse.json({ key: rawKey, meta: data }, { status: 201 })
}

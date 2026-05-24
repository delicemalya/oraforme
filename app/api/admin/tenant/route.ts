import { supabaseAdmin } from '@/lib/supabase-server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { SUPER_ADMIN_EMAILS } from '@/lib/admin-config'

// ── Auth guard: only super-admins can call these endpoints ────────────────────
async function requireSuperAdmin(): Promise<{ userId: string | null; error: NextResponse | null }> {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll() } }
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !SUPER_ADMIN_EMAILS.includes(user.email ?? '')) {
    return { userId: null, error: NextResponse.json({ error: 'Accès refusé — super-admin uniquement' }, { status: 403 }) }
  }
  return { userId: user.id, error: null }
}

// ── PATCH /api/admin/tenant — suspend or unsuspend a company ──────────────────
export async function PATCH(req: NextRequest) {
  const { error } = await requireSuperAdmin()
  if (error) return error

  const body = await req.json() as { tenantId?: string; action?: 'suspend' | 'unsuspend' }
  const { tenantId, action } = body

  if (!tenantId || !action) {
    return NextResponse.json({ error: 'tenantId and action required' }, { status: 400 })
  }

  const status = action === 'suspend' ? 'suspended' : 'active'

  const { error: dbErr } = await supabaseAdmin
    .from('tenants')
    .update({ status })
    .eq('id', tenantId)

  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 })
  return NextResponse.json({ ok: true, status })
}

// ── DELETE /api/admin/tenant — soft-delete a company ─────────────────────────
// Soft delete: sets deleted_at. Hard purge should be done manually in Supabase.
// RLS policies remain in place — users of deleted tenants get no data access.
export async function DELETE(req: NextRequest) {
  const { error } = await requireSuperAdmin()
  if (error) return error

  const body = await req.json() as { tenantId?: string; confirm?: boolean }
  const { tenantId, confirm } = body

  if (!tenantId) {
    return NextResponse.json({ error: 'tenantId required' }, { status: 400 })
  }
  if (!confirm) {
    return NextResponse.json({ error: 'confirm: true required to prevent accidental deletion' }, { status: 400 })
  }

  // Soft delete: mark deleted_at, set status to suspended
  const { error: dbErr } = await supabaseAdmin
    .from('tenants')
    .update({ status: 'suspended', deleted_at: new Date().toISOString() })
    .eq('id', tenantId)

  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 })
  return NextResponse.json({ ok: true, deleted: true })
}

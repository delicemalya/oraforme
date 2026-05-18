/**
 * tenant-guard.ts — Server-side tenant isolation helper
 *
 * Usage in any API route:
 *   const { ctx, error } = await requireTenant()
 *   if (error) return error
 *   // ctx.tenantId is verified and safe to use
 */

import { supabaseAdmin } from '@/lib/supabase-server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export interface TenantContext {
  userId:    string
  tenantId:  string
  role:      'owner' | 'admin' | 'membre'
  ecoleRole: string | null
}

type GuardResult =
  | { ctx: TenantContext; error: null }
  | { ctx: null; error: NextResponse }

/**
 * Authenticates the request and returns the verified tenant context.
 * Use `requiredRole` to enforce minimum permission level.
 */
export async function requireTenant(requiredRole?: 'owner' | 'admin'): Promise<GuardResult> {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll() } }
  )

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { ctx: null, error: NextResponse.json({ error: 'Non authentifié' }, { status: 401 }) }
  }

  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('tenant_id, role, ecole_role_name')
    .eq('user_id', user.id)
    .maybeSingle()

  if (!profile?.tenant_id) {
    return { ctx: null, error: NextResponse.json({ error: 'Profil ou tenant introuvable' }, { status: 403 }) }
  }

  const role = (profile.role ?? 'membre') as 'owner' | 'admin' | 'membre'

  if (requiredRole === 'owner' && role !== 'owner') {
    return { ctx: null, error: NextResponse.json({ error: 'Réservé au propriétaire du compte' }, { status: 403 }) }
  }
  if (requiredRole === 'admin' && !['owner', 'admin'].includes(role)) {
    return { ctx: null, error: NextResponse.json({ error: 'Accès insuffisant — admin ou owner requis' }, { status: 403 }) }
  }

  return {
    ctx: {
      userId:    user.id,
      tenantId:  profile.tenant_id as string,
      role,
      ecoleRole: (profile as { ecole_role_name?: string | null }).ecole_role_name ?? null,
    },
    error: null,
  }
}

/**
 * Verifies that a resource (identified by `id`) belongs to the given tenant.
 * Prevents cross-tenant access when supabaseAdmin is used.
 *
 * @returns true if the resource belongs to tenantId, false otherwise
 */
export async function verifyResourceOwnership(
  table: string,
  resourceId: string,
  tenantId: string
): Promise<boolean> {
  const { data, error } = await supabaseAdmin
    .from(table)
    .select('tenant_id')
    .eq('id', resourceId)
    .maybeSingle()

  if (error || !data) return false
  return (data as { tenant_id: string }).tenant_id === tenantId
}

/**
 * Asserts tenant ownership of a resource and returns a 403 response if mismatch.
 * Convenience wrapper around verifyResourceOwnership for use in route handlers.
 */
export async function assertResourceOwnership(
  table: string,
  resourceId: string,
  tenantId: string
): Promise<NextResponse | null> {
  const owned = await verifyResourceOwnership(table, resourceId, tenantId)
  if (!owned) {
    return NextResponse.json(
      { error: `Accès refusé — ressource inexistante ou appartient à un autre compte` },
      { status: 403 }
    )
  }
  return null
}

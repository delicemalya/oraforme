import { createSupabaseServerClient } from '@/lib/supabase-client-server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'

/**
 * Server-side guard for all école routes.
 * Defense-in-depth: the client-side useRoleGuard handles per-page role restrictions,
 * but this layout blocks unauthenticated or non-école users at the SSR layer.
 */
export default async function EcoleLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Check if user has école access: either an ecole_role_name set, or owns an école tenant
  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('ecole_role_name, role, tenant_id')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (!profile) {
    redirect('/dashboard')
  }

  // Owners with ecole_role_name have direct access
  if (profile.ecole_role_name) {
    return <>{children}</>
  }

  // Owners/admins: check tenant sector
  if (profile.tenant_id) {
    const { data: tenant } = await supabaseAdmin
      .from('tenants')
      .select('secteur')
      .eq('id', profile.tenant_id)
      .maybeSingle()

    if (tenant?.secteur === 'ecole') {
      return <>{children}</>
    }
  }

  // No école access → redirect to dashboard root
  redirect('/dashboard')
}

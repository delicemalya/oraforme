import { supabaseAdmin } from '@/lib/supabase-server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function hrAuth() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll() } }
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabaseAdmin
    .from('profiles').select('tenant_id, role').eq('user_id', user.id).order('created_at', { ascending: true }).limit(1).maybeSingle()
  if (!profile?.tenant_id) return null
  return { user, tenantId: profile.tenant_id as string, role: (profile.role ?? 'membre') as string }
}

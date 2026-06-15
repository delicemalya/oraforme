import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createSupabaseServerClient } from '@/lib/supabase-client-server'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)

  // Valide que la cible est bien une route interne (évite open redirect)
  const raw = searchParams.get('redirect') ?? '/dashboard'
  const redirectTo = raw.startsWith('/') && !raw.startsWith('//') ? raw : '/dashboard'

  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.redirect(`${origin}/login`)
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('tenant_id')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (profile?.tenant_id) {
    const cookieStore = await cookies()
    cookieStore.set('oraforme_has_tenant', 'true', {
      maxAge:   60 * 60 * 24 * 90,
      path:     '/',
      sameSite: 'lax',
      secure:   process.env.NODE_ENV === 'production',
      httpOnly: true,
    })
  }

  return NextResponse.redirect(`${origin}${redirectTo}`)
}

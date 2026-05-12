import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

/**
 * Auth Callback Handler
 *
 * This route is called by Supabase after:
 * - Email confirmation (new user clicks the link in their inbox)
 * - Password reset
 * - Magic link login
 *
 * It exchanges the one-time `code` for a real session, then routes the user
 * to the correct destination:
 *   • No tenant profile yet → /onboarding (first-time setup)
 *   • Tenant profile exists → /dashboard   (returning user)
 *
 * SECURITY: The code can only be used once and expires quickly.
 * The user is identified server-side from the code — no client-supplied tenant_id.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code  = searchParams.get('code')
  const next  = searchParams.get('next') ?? '/onboarding'
  const error = searchParams.get('error')

  // Supabase may send an error in the redirect (e.g. link expired)
  if (error) {
    console.error('[auth/callback] Supabase error:', error, searchParams.get('error_description'))
    return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(error)}`)
  }

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=missing_code`)
  }

  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          )
        },
      },
    }
  )

  // Exchange the one-time code for a persistent session
  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)

  if (exchangeError) {
    console.error('[auth/callback] exchangeCodeForSession failed:', exchangeError.message)
    return NextResponse.redirect(`${origin}/login?error=confirmation_failed`)
  }

  // Determine where to send this user
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.redirect(`${origin}/login?error=session_failed`)
  }

  // Password reset: always redirect to the reset page, skip profile check
  if (next === '/reset-password') {
    return NextResponse.redirect(`${origin}/reset-password`)
  }

  // Check if this user already has a tenant profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('tenant_id')
    .eq('user_id', user.id)
    .maybeSingle()

  if (profile?.tenant_id) {
    // Returning user — go to their dashboard
    return NextResponse.redirect(`${origin}/dashboard`)
  }

  // New user (just confirmed email or Google OAuth) — complete onboarding
  return NextResponse.redirect(`${origin}${next}`)
}

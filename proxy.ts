import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const SUPER_ADMIN_EMAIL = 'adjidongui@gmail.com'

export async function proxy(request: NextRequest) {
  // Build a mutable response so Supabase can rotate session cookies
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // IMPORTANT: getUser() validates the JWT server-side. Never use getSession() here.
  const { data: { user } } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl

  // ── PROTECTED ROUTES ─────────────────────────────────────────────────────
  if (!user && (pathname.startsWith('/dashboard') || pathname.startsWith('/onboarding'))) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('redirectTo', pathname)
    return NextResponse.redirect(url)
  }

  // ── AUTH ROUTES ───────────────────────────────────────────────────────────
  if (user && (pathname === '/login' || pathname === '/register')) {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    return NextResponse.redirect(url)
  }

  // ── ADMIN ROUTES ──────────────────────────────────────────────────────────
  if (pathname.startsWith('/admin')) {
    if (!user || user.email !== SUPER_ADMIN_EMAIL) {
      const url = request.nextUrl.clone()
      url.pathname = '/dashboard'
      return NextResponse.redirect(url)
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    /*
     * Run on all routes EXCEPT:
     * - Next.js internals (_next/static, _next/image)
     * - Static assets (svg, png, ico)
     * - API routes — they handle their own auth
     * - Public restaurant pages (/resto/) — customer-facing, intentionally public
     * - Auth callback (/auth/) — must be accessible without a session
     */
    '/((?!_next/static|_next/image|favicon\\.ico|.*\\.svg$|.*\\.png$|api/|resto/|auth/).*)',
  ],
}

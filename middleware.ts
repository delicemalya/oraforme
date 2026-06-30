import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// Pages that never require a Supabase session
const PUBLIC_PAGES = new Set([
  '/',
  '/login',
  '/register',
  '/onboarding',
  '/pricing',
  '/forgot-password',
  '/reset-password',
  '/sentry-example-page',
])

// API prefixes with their own auth mechanism — do not enforce Supabase session
const PUBLIC_API_PREFIXES = [
  '/api/auth/',       // Supabase OAuth callbacks
  '/api/v1/',         // External REST API — uses API key auth (requireApiKey)
  '/api/resto/',      // Public menu + order endpoints (QR code, no session needed)
  '/api/webhooks/',   // External webhook receivers — verify with own secrets
  '/api/monitoring/', // Error/performance logging from error boundaries
]

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Always refresh the Supabase session so tokens never expire silently.
  // The setAll() callback writes updated cookies back into supabaseResponse.
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
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // CRITICAL: getUser() must be called on every request — it refreshes expired
  // tokens and writes the new session cookie via setAll() above. Skipping this
  // causes silent session expiry and "logged-out on page reload" bugs.
  const { data: { user } } = await supabase.auth.getUser()

  // Determine whether this route requires authentication
  const isPublicPage = PUBLIC_PAGES.has(pathname) || pathname.startsWith('/auth/')
  const isPublicApi  = PUBLIC_API_PREFIXES.some(prefix => pathname.startsWith(prefix))

  if (!isPublicPage && !isPublicApi && !user) {
    if (pathname.startsWith('/api/')) {
      // API callers receive JSON 401 — they must not be redirected
      return NextResponse.json(
        { error: 'Unauthorized', code: 'AUTH_REQUIRED' },
        { status: 401 }
      )
    }

    // Preserve the intended path so the login page can redirect back after sign-in
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('next', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // Return supabaseResponse (not NextResponse.next()) so the refreshed session
  // cookies are forwarded to the browser on every request.
  return supabaseResponse
}

export const config = {
  matcher: [
    // Match everything except Next.js build artefacts and static files
    '/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
}

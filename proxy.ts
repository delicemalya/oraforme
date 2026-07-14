import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// ── Public routes — never require a session ───────────────────────────────────
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

// API prefixes with their own auth mechanism — bypass session enforcement
const PUBLIC_API_PREFIXES = [
  '/api/auth/',       // Supabase OAuth callbacks
  '/api/v1/',         // External REST API — uses API key auth
  '/api/resto/',      // Public menu + order endpoints (QR code, no session)
  '/api/webhooks/',   // External webhook receivers
  '/api/monitoring/', // Error/performance logging from error boundaries
]

const SUPER_ADMIN_EMAILS = ['adjidongui@gmail.com', 'adjigordon@gmail.com']

// École routes that require specific roles
const ECOLE_ROUTE_ROLES: Record<string, string[]> = {
  'direction':              ['DIRECTION_GENERALE'],
  'comptabilite':           ['DIRECTION_GENERALE', 'RAF'],
  'tresorerie':             ['DIRECTION_GENERALE', 'RAF'],
  'rh':                     ['DIRECTION_GENERALE', 'RAF', 'RH_PAIE'],
  'daac':                   ['DIRECTION_GENERALE', 'DAAC'],
  'scolarite':              ['DIRECTION_GENERALE', 'SCOLARITE', 'DAAC'],
  'espace-formateur':       ['FORMATEUR', 'DIRECTION_GENERALE', 'DAAC', 'RH_PAIE'],
  'espace-etudiant':        ['ETUDIANT'],
  'espace-parent':          ['PARENT'],
  'parametres-academiques': ['DIRECTION_GENERALE', 'DAAC'],
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Build a mutable response so Supabase can rotate session cookies
  let supabaseResponse = NextResponse.next({ request })
  let tokenWasRefreshed = false

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
          // setAll is only called when Supabase actually issues a new token
          if (cookiesToSet.some(c => c.name.includes('access-token') || c.name.includes('sb-'))) {
            tokenWasRefreshed = true
          }
        },
      },
    }
  )

  // CRITICAL: always call getUser() — it refreshes expired tokens via setAll().
  // Skipping this causes silent session expiry bugs.
  const { data: { user } } = await supabase.auth.getUser()

  // ── Session guard ─────────────────────────────────────────────────────────
  const isPublicPage = PUBLIC_PAGES.has(pathname) || pathname.startsWith('/auth/')
  const isPublicApi  = PUBLIC_API_PREFIXES.some(p => pathname.startsWith(p))

  if (!isPublicPage && !isPublicApi && !user) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json(
        { error: 'Unauthorized', code: 'AUTH_REQUIRED' },
        { status: 401 },
      )
    }
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('next', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // ── Redirect authenticated users away from login/register ─────────────────
  if (user && (pathname === '/login' || pathname === '/register')) {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    return NextResponse.redirect(url)
  }

  // ── Admin routes — super admin only ───────────────────────────────────────
  if (pathname.startsWith('/admin')) {
    if (!user || !SUPER_ADMIN_EMAILS.includes(user.email ?? '')) {
      const url = request.nextUrl.clone()
      url.pathname = '/dashboard'
      return NextResponse.redirect(url)
    }
  }

  // ── École role-based route protection ─────────────────────────────────────
  if (user && pathname.startsWith('/dashboard/ecole/')) {
    const segment = pathname.replace('/dashboard/ecole/', '').split('/')[0]
    const allowedRoles = ECOLE_ROUTE_ROLES[segment]

    if (allowedRoles && allowedRoles.length > 0) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('role, ecole_role_name')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle()

      if (profile && profile.role !== 'owner') {
        const ecoleRole = profile.ecole_role_name as string | null
        if (!ecoleRole || !allowedRoles.includes(ecoleRole)) {
          const url = request.nextUrl.clone()
          url.pathname = '/dashboard/ecole'
          url.searchParams.set('access_denied', segment)
          return NextResponse.redirect(url)
        }
      }
    }
  }

  // ── TOKEN_REFRESH logging (fire-and-forget, for P-005 ABNORMAL_REFRESH) ───
  if (tokenWasRefreshed && user) {
    void fetch(new URL('/api/auth/log', request.url).toString(), {
      method:  'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': request.headers.get('cookie') ?? '',
      },
      body: JSON.stringify({ event_type: 'TOKEN_REFRESH' }),
    }).catch(() => {/* silent — logging never blocks requests */})
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    // Match all routes except Next.js internals and static assets
    '/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
}

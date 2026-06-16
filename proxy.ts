import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const SUPER_ADMIN_EMAILS = ['adjidongui@gmail.com', 'adjigordon@gmail.com']

// École routes that require specific roles (beyond basic authentication)
// Key = route segment, Value = allowed ecole_role_name values
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
  if (!user && pathname.startsWith('/dashboard')) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('redirectTo', pathname)
    return NextResponse.redirect(url)
  }

  // ── AUTH ROUTES ───────────────────────────────────────────────────────────
  // Passe par /api/set-tenant-cookie pour poser le cookie avant /dashboard.
  // Couvre le cas login email+password qui ne passe pas par /auth/callback.
  if (user && (pathname === '/login' || pathname === '/register')) {
    const url = request.nextUrl.clone()
    url.pathname = '/api/set-tenant-cookie'
    url.searchParams.set('redirect', '/dashboard')
    return NextResponse.redirect(url)
  }

  // ── ADMIN ROUTES ──────────────────────────────────────────────────────────
  if (pathname.startsWith('/admin')) {
    if (!user || !SUPER_ADMIN_EMAILS.includes(user.email ?? '')) {
      const url = request.nextUrl.clone()
      url.pathname = '/dashboard'
      return NextResponse.redirect(url)
    }
  }

  // ── ÉCOLE ROLE-BASED ROUTE PROTECTION ────────────────────────────────────
  // For /dashboard/ecole/<segment> routes, validate the user's ecole role.
  // Owners bypass this check — they always have full access.
  if (user && pathname.startsWith('/dashboard/ecole/')) {
    // Extract the route segment after /dashboard/ecole/
    const segment = pathname.replace('/dashboard/ecole/', '').split('/')[0]
    const allowedRoles = ECOLE_ROUTE_ROLES[segment]

    // Only enforce role check for explicitly restricted routes
    if (allowedRoles && allowedRoles.length > 0) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('role, ecole_role_name')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle()

      // Owners always pass
      if (profile && profile.role !== 'owner') {
        const ecoleRole = profile.ecole_role_name as string | null
        if (!ecoleRole || !allowedRoles.includes(ecoleRole)) {
          // Redirect to école dashboard with access denied signal
          // École users land on /dashboard/ecole (not /dashboard) to avoid double-redirect
          const url = request.nextUrl.clone()
          url.pathname = '/dashboard/ecole'
          url.searchParams.set('access_denied', segment)
          return NextResponse.redirect(url)
        }
      }
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

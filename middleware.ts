import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const SUPER_ADMIN_EMAILS = ['adjidongui@gmail.com', 'adjigordon@gmail.com']

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
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

  // Rafraîchit la session sans bloquer — IMPORTANT : ne pas supprimer
  const { data: { user } } = await supabase.auth.getUser()

  const path = request.nextUrl.pathname

  // ── Protection /admin/* ───────────────────────────────────────────────────
  // Seuls les super-admins peuvent accéder à /admin
  if (path.startsWith('/admin')) {
    if (!user) {
      return NextResponse.redirect(new URL('/login', request.url))
    }
    if (!SUPER_ADMIN_EMAILS.includes(user.email ?? '')) {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }
    return supabaseResponse
  }

  // ── Protection /dashboard/* ───────────────────────────────────────────────
  // Tout utilisateur non authentifié est redirigé vers /login
  if (path.startsWith('/dashboard')) {
    if (!user) {
      return NextResponse.redirect(new URL('/login', request.url))
    }
    return supabaseResponse
  }

  // ── Protection /onboarding/* ─────────────────────────────────────────────
  if (path.startsWith('/onboarding')) {
    if (!user) {
      return NextResponse.redirect(new URL('/login', request.url))
    }
    return supabaseResponse
  }

  // ── Redirection racine ────────────────────────────────────────────────────
  // / → /dashboard si connecté, sinon landing page
  if (path === '/') {
    if (user) {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    // Exclure les ressources statiques et API Supabase
    '/((?!_next/static|_next/image|favicon.ico|api/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}

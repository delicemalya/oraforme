'use client'

/**
 * TenantContext — Single source of truth for tenant/user identity.
 *
 * WHY THIS EXISTS:
 * The previous architecture had Sidebar and Header each independently calling
 * supabase.auth.getUser() in a useEffect([]) — fired once on mount, never again.
 * When a super admin switched between company accounts (different browser sessions),
 * the old tenant data remained in component state until a hard refresh.
 * Additionally, with no onAuthStateChange listener, cross-tab session changes
 * (Supabase stores the session in shared cookies) were invisible to all components.
 *
 * THIS FIXES:
 * - Stale tenant data after account switching
 * - Cross-tab session contamination (shared cookie)
 * - Sidebar/Header out-of-sync state (they shared no common source)
 * - Missing hard-navigate on logout (SPA navigation left React state alive)
 */

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useCallback,
  type ReactNode,
} from 'react'
import { supabase } from '@/lib/supabase'
import { SUPER_ADMIN_EMAILS } from '@/lib/admin-config'
import type { UserRole } from '@/lib/hooks/usePermissions'

// ── Public types ──────────────────────────────────────────────────────────────

export interface TenantState {
  tenantId:      string
  profileId:     string
  nomEntreprise: string
  secteur:       string | null
  role:          UserRole
  ecoleRole:     string | null
  isSuperAdmin:  boolean
  modulesActifs: string[]
  userId:        string
  userEmail:     string
}

interface TenantContextValue {
  tenant:  TenantState | null
  loading: boolean
  reload:  () => Promise<void>
}

// ── Context ───────────────────────────────────────────────────────────────────

const TenantContext = createContext<TenantContextValue>({
  tenant:  null,
  loading: true,
  reload:  async () => {},
})

export function useTenantContext(): TenantContextValue {
  return useContext(TenantContext)
}

// ── Data fetcher (pure, no side effects) ──────────────────────────────────────

async function fetchTenantForUser(
  userId: string,
  email: string,
): Promise<TenantState | null> {
  // CRITICAL FIX (multi-tenant isolation):
  // A super-admin or invited user may have rows in multiple tenants.
  // .maybeSingle() without ordering is non-deterministic: PostgREST returns
  // whichever row the planner picks first — causing "wrong company on refresh".
  //
  // Fix: order by created_at ASC so the oldest (primary) profile always wins,
  // then limit to 1.  When we add a tenant-switcher UI the stored tenant_id
  // from localStorage will override this default instead of breaking isolation.
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, role, tenant_id, ecole_role_name, tenants(nom_entreprise, modules_actifs, secteur_activite)')
    .eq('user_id', userId)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (!profile) return null

  const t = profile.tenants as unknown as {
    nom_entreprise:   string
    modules_actifs:   string[]
    secteur_activite: string | null
  } | null

  return {
    tenantId:      profile.tenant_id as string,
    profileId:     profile.id as string,
    nomEntreprise: t?.nom_entreprise ?? '',
    secteur:       t?.secteur_activite ?? null,
    role:          profile.role as UserRole,
    ecoleRole:     (profile as { ecole_role_name?: string | null }).ecole_role_name ?? null,
    isSuperAdmin:  SUPER_ADMIN_EMAILS.includes(email),
    modulesActifs: t?.modules_actifs ?? [],
    userId,
    userEmail: email,
  }
}

// ── Provider ──────────────────────────────────────────────────────────────────

export function TenantProvider({ children }: { children: ReactNode }) {
  const [tenant,  setTenant]  = useState<TenantState | null>(null)
  const [loading, setLoading] = useState(true)

  // Tracks which userId we are currently loading for — prevents stale responses
  // from overwriting newer data when two fetches race.
  const activeUserIdRef = useRef<string | null>(null)

  const loadForUser = useCallback(async (userId: string, email: string) => {
    activeUserIdRef.current = userId
    setLoading(true)
    const state = await fetchTenantForUser(userId, email)
    // Drop result if a newer load started while this one was in-flight
    if (activeUserIdRef.current === userId) {
      setTenant(state)
      setLoading(false)
    }
  }, [])

  const reload = useCallback(async () => {
    activeUserIdRef.current = null // force-bypass the stale-response guard
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setTenant(null); setLoading(false); return }
    await loadForUser(user.id, user.email ?? '')
  }, [loadForUser])

  useEffect(() => {
    // ── Initial load ──────────────────────────────────────────────────────
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) loadForUser(user.id, user.email ?? '')
      else      { setTenant(null); setLoading(false) }
    })

    // ── Subscribe to auth changes ─────────────────────────────────────────
    // CRITICAL: onAuthStateChange fires for:
    //   - SIGNED_OUT: explicit logout OR session expiry
    //   - SIGNED_IN:  new login (including cross-tab — cookies are shared)
    //   - TOKEN_REFRESHED: auto-refresh with a different user (cross-tab attack)
    //   - USER_UPDATED: profile update
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === 'SIGNED_OUT' || !session?.user) {
          activeUserIdRef.current = null
          setTenant(null)
          setLoading(false)
          // Hard-navigate: clears all React state, module singletons,
          // and any cached data that SPA navigation would preserve.
          if (typeof window !== 'undefined') {
            window.location.replace('/login')
          }
          return
        }

        if (event === 'SIGNED_IN' || event === 'USER_UPDATED') {
          // New or changed login — always reload tenant
          loadForUser(session.user.id, session.user.email ?? '')
          return
        }

        if (
          event === 'TOKEN_REFRESHED' &&
          session.user.id !== activeUserIdRef.current
        ) {
          // Token refreshed for a DIFFERENT user (cross-tab account switch)
          loadForUser(session.user.id, session.user.email ?? '')
        }
      },
    )

    return () => subscription.unsubscribe()
  }, [loadForUser])

  return (
    <TenantContext.Provider value={{ tenant, loading, reload }}>
      {children}
    </TenantContext.Provider>
  )
}

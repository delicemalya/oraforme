/**
 * requireTenant — Utilitaire centralisé pour authentification + isolation tenant.
 * Remplace le pattern dupliqué 16x à travers les routes API.
 *
 * Usage:
 *   const ctx = await requireTenant(req)
 *   if (!ctx.ok) return ctx.error
 *   const { tid, userId, role } = ctx
 */

import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-client-server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { canAccessByPlan } from '@/lib/plan-access'

export type TenantRole = 'owner' | 'admin' | 'membre'

export type TenantContext = {
  ok: true
  tid: string          // tenant_id
  userId: string
  profileId: string
  role: TenantRole
}

export type TenantError = {
  ok: false
  error: NextResponse
}

export type TenantResult = TenantContext | TenantError

export async function requireTenant(req?: NextRequest): Promise<TenantResult> {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return {
      ok: false,
      error: NextResponse.json({ error: 'Non authentifié' }, { status: 401 }),
    }
  }

  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('id, tenant_id, role')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (!profile?.tenant_id) {
    return {
      ok: false,
      error: NextResponse.json({ error: 'Accès refusé — tenant introuvable' }, { status: 403 }),
    }
  }

  return {
    ok: true,
    tid: profile.tenant_id,
    userId: user.id,
    profileId: profile.id,
    role: (profile.role as TenantRole) ?? 'membre',
  }
}

/** Requiert un rôle minimum (owner > admin > membre) */
export async function requireRole(
  minRole: TenantRole,
  req?: NextRequest,
): Promise<TenantResult> {
  const ctx = await requireTenant(req)
  if (!ctx.ok) return ctx

  const ORDER: Record<TenantRole, number> = { owner: 3, admin: 2, membre: 1 }
  if (ORDER[ctx.role] < ORDER[minRole]) {
    return {
      ok: false,
      error: NextResponse.json({ error: 'Droits insuffisants' }, { status: 403 }),
    }
  }

  return ctx
}

/**
 * Retourne le plan (taille_entreprise) d'un tenant.
 * Utilisé pour enforcer les restrictions d'offre côté API.
 */
export async function getTenantPlan(tenantId: string): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from('tenants')
    .select('taille_entreprise')
    .eq('id', tenantId)
    .maybeSingle()
  return data?.taille_entreprise ?? null
}

/**
 * Retourne une réponse 403 avec un message d'upgrade.
 * À utiliser quand un tenant essaie d'accéder à une feature premium.
 */
export function planError(required: 'pme' | 'grande'): Response {
  const label = required === 'grande' ? 'Compagnie' : 'Business'
  return Response.json(
    { error: `Cette fonctionnalité nécessite un abonnement ${label} ou supérieur.`, upgrade_required: required },
    { status: 403 },
  )
}

/**
 * Vérifie qu'un tenant a accès à un module donné selon son plan.
 * Retourne planError() si refusé, null si autorisé.
 */
export async function checkPlanAccess(
  tenantId: string,
  moduleId: string,
): Promise<Response | null> {
  const plan = await getTenantPlan(tenantId)
  if (!canAccessByPlan(plan, moduleId)) {
    return planError(
      moduleId === 'groupe' || moduleId === 'email-management' ? 'grande' : 'pme',
    )
  }
  return null
}

/** API Key authentication — for /api/v1/ public endpoints */
export async function requireApiKey(req: NextRequest): Promise<TenantResult> {
  const authHeader = req.headers.get('authorization') ?? ''
  const key = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : req.headers.get('x-api-key') ?? ''

  if (!key) {
    return {
      ok: false,
      error: NextResponse.json({ error: 'API key requise' }, { status: 401 }),
    }
  }

  // Hash the key to compare against stored hash
  const encoder = new TextEncoder()
  const data = encoder.encode(key)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  const keyHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')

  const { data: apiKey } = await supabaseAdmin
    .from('api_keys')
    .select('id, tenant_id, scopes, is_active, expires_at')
    .eq('key_hash', keyHash)
    .eq('is_active', true)
    .maybeSingle()

  if (!apiKey) {
    return {
      ok: false,
      error: NextResponse.json({ error: 'Clé API invalide' }, { status: 401 }),
    }
  }

  if (apiKey.expires_at && new Date(apiKey.expires_at) < new Date()) {
    return {
      ok: false,
      error: NextResponse.json({ error: 'Clé API expirée' }, { status: 401 }),
    }
  }

  // Update last_used_at
  await supabaseAdmin
    .from('api_keys')
    .update({ last_used_at: new Date().toISOString() })
    .eq('id', apiKey.id)

  return {
    ok: true,
    tid: apiKey.tenant_id,
    userId: 'api-key',
    profileId: 'api-key',
    role: 'admin',
  }
}

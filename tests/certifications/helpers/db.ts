/**
 * tests/certifications/helpers/db.ts — Helpers Supabase pour les certifications
 *
 * Fournit des méthodes pour créer/supprimer des tenants de test
 * et exécuter des preuves SQL directement via l'API Supabase.
 *
 * GARDE-FOU PRODUCTION (ticket P0CRIT01-PLAYWRIGHT-DB-HELPER) : ce fichier créait
 * et supprimait auparavant de vrais tenants directement en production — URL
 * Supabase de production codée en dur, clé service_role sans aucun garde
 * d'environnement, nettoyage silencieusement défaillant. Il réutilise désormais
 * le même garde que scripts/lib/seed-production-guard.ts (aucun système
 * concurrent créé) : aucune opération réseau n'a lieu tant que l'environnement
 * n'est pas explicitement validé comme non-production.
 */

import {
  assertSeedTargetIsNotProduction,
  ProductionSeedGuardError,
} from '../../../scripts/lib/seed-production-guard'

const SUPABASE_URL     = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

// Le garde s'exécute au chargement du module, avant toute création de requête
// réseau — voir scripts/seed-demo-data.ts / scripts/seed-employes-test.ts pour
// le même motif. Aucune variable ne désactive ce contrôle ; il refuse par
// défaut (fail-closed) si SEED_TARGET_ENV est absent ou ambigu, et refuse
// inconditionnellement si NEXT_PUBLIC_SUPABASE_URL correspond au projet de
// production connu, quelle que soit la déclaration d'environnement.
try {
  assertSeedTargetIsNotProduction({
    SEED_TARGET_ENV: process.env.SEED_TARGET_ENV,
    NEXT_PUBLIC_SUPABASE_URL: SUPABASE_URL,
    VERCEL_ENV: process.env.VERCEL_ENV,
    NODE_ENV: process.env.NODE_ENV,
  })
} catch (e) {
  if (e instanceof ProductionSeedGuardError) {
    throw new Error(
      `GARDE-FOU PRODUCTION — tests/certifications/helpers/db.ts refuse de s'initialiser.\n` +
      `  ${e.message}\n` +
      `  Ces helpers créent/suppriment de vrais tenants ; ils ne doivent jamais tourner contre production.`
    )
  }
  throw e
}

if (!SUPABASE_URL) {
  throw new Error('NEXT_PUBLIC_SUPABASE_URL manquant — requis pour les helpers de certification (environnement de recette/test)')
}
if (!SERVICE_ROLE_KEY) {
  throw new Error('SUPABASE_SERVICE_ROLE_KEY manquant — requis pour les helpers de certification')
}

const HEADERS = {
  'apikey':        SERVICE_ROLE_KEY,
  'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
  'Content-Type':  'application/json',
  'Prefer':        'return=representation',
}

export interface TestAccount {
  tenantId: string
  userId:   string
  email:    string
  password: string
  taille:   'tpe' | 'pme' | 'grande'
}

export const PLAN_MODULES = {
  tpe: [
    'facturation', 'crm', 'tresorerie', 'rh', 'rapports',
    'depenses', 'taches', 'calendrier', 'notifications',
    'parametres', 'profil', 'devis', 'equipe',
  ],
  pme: [
    'facturation', 'crm', 'tresorerie', 'rh', 'rapports',
    'depenses', 'taches', 'calendrier', 'notifications',
    'parametres', 'profil', 'devis', 'equipe',
    'comptabilite', 'fiscalite', 'stock', 'achats', 'workflows',
    'miaa', 'roles', 'ged', 'mobilemoney', 'academy',
    'bi', 'bi-dg', 'direction', 'finance', 'analytics',
    'audit', 'api-keys', 'abonnement', 'bizbot',
  ],
  grande: [
    'facturation', 'crm', 'tresorerie', 'rh', 'rapports',
    'depenses', 'taches', 'calendrier', 'notifications',
    'parametres', 'profil', 'devis', 'equipe',
    'comptabilite', 'fiscalite', 'stock', 'achats', 'workflows',
    'miaa', 'roles', 'ged', 'mobilemoney', 'academy',
    'bi', 'bi-dg', 'direction', 'finance', 'analytics',
    'audit', 'api-keys', 'abonnement', 'bizbot',
    'groupe', 'groupe-vue', 'entity-switcher',
    'email-management', 'social-media',
  ],
}

const PLAN_LEGACY: Record<'tpe' | 'pme' | 'grande', string> = {
  tpe:   'starter',
  pme:   'pro',
  grande: 'enterprise',
}

async function sbFetch(path: string, opts: RequestInit): Promise<unknown> {
  const res = await fetch(`${SUPABASE_URL}${path}`, {
    ...opts,
    headers: { ...HEADERS, ...(opts.headers as Record<string, string> ?? {}) },
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Supabase ${path}: ${res.status} ${body}`)
  }
  return res.json()
}

export async function createTestAccount(
  label: string,
  taille: 'tpe' | 'pme' | 'grande',
  suffix: string,
): Promise<TestAccount> {
  const email    = `qa001-${label.toLowerCase()}-${suffix}@oraforme.test`
  const password = `QA001-${label}!2026`

  // 1. Create auth user
  const userRes = await sbFetch('/auth/v1/admin/users', {
    method: 'POST',
    body: JSON.stringify({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: `QA001 ${label}` },
    }),
  }) as { id: string }

  const userId = userRes.id

  // 2. Create tenant
  const tenantRes = await sbFetch('/rest/v1/tenants', {
    method: 'POST',
    body: JSON.stringify({
      nom_entreprise:    `QA001-${label}-${suffix}`,
      plan:              PLAN_LEGACY[taille],
      taille_entreprise: taille,
      status:            'active',
    }),
  }) as Array<{ id: string }>

  const tenantId = tenantRes[0].id

  // 3. Create profile
  await sbFetch('/rest/v1/profiles', {
    method: 'POST',
    body: JSON.stringify({
      user_id:   userId,
      tenant_id: tenantId,
      role:      'owner',
      nom:       'QA001',
      prenom:    label,
    }),
  })

  // 4. Insert modules
  const modules = PLAN_MODULES[taille]
  await sbFetch('/rest/v1/tenant_modules', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
    body: JSON.stringify(modules.map(key => ({
      tenant_id:  tenantId,
      module_key: key,
      enabled:    true,
    }))),
  })

  return { tenantId, userId, email, password, taille }
}

export const ECOLE_MODULES = [
  'ecole', 'facturation', 'crm', 'tresorerie', 'rh', 'rapports',
  'depenses', 'taches', 'calendrier', 'notifications',
  'parametres', 'profil', 'devis', 'equipe',
  'comptabilite', 'fiscalite', 'miaa',
]

export async function createEcoleAccount(label: string, suffix: string): Promise<TestAccount> {
  const email    = `qa001-${label.toLowerCase()}-${suffix}@oraforme.test`
  const password = `QA001-${label}!2026`

  const userRes = await sbFetch('/auth/v1/admin/users', {
    method: 'POST',
    body: JSON.stringify({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: `QA001 ${label}` },
    }),
  }) as { id: string }

  const userId = userRes.id

  const tenantRes = await sbFetch('/rest/v1/tenants', {
    method: 'POST',
    body: JSON.stringify({
      nom_entreprise:    `QA001-${label}-${suffix}`,
      plan:              'pro',
      taille_entreprise: 'pme',
      secteur_activite:  'ecole',
      sous_type:         'lycee',
      status:            'active',
    }),
  }) as Array<{ id: string }>

  const tenantId = tenantRes[0].id

  await sbFetch('/rest/v1/profiles', {
    method: 'POST',
    body: JSON.stringify({
      user_id:   userId,
      tenant_id: tenantId,
      role:      'owner',
      nom:       'QA001',
      prenom:    label,
    }),
  })

  await sbFetch('/rest/v1/tenant_modules', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
    body: JSON.stringify(ECOLE_MODULES.map(key => ({
      tenant_id:  tenantId,
      module_key: key,
      enabled:    true,
    }))),
  })

  return { tenantId, userId, email, password, taille: 'pme' }
}

export async function deleteTestAccount(acc: TestAccount): Promise<void> {
  // Order: tenant_modules → profiles → tenants → auth user
  await sbFetch(`/rest/v1/tenant_modules?tenant_id=eq.${acc.tenantId}`, { method: 'DELETE' }).catch(() => {})
  await sbFetch(`/rest/v1/profiles?tenant_id=eq.${acc.tenantId}`,       { method: 'DELETE' }).catch(() => {})
  await sbFetch(`/rest/v1/tenants?id=eq.${acc.tenantId}`,               { method: 'DELETE' }).catch(() => {})
  await sbFetch(`/auth/v1/admin/users/${acc.userId}`,                    { method: 'DELETE' }).catch(() => {})
}

export async function upgradePlan(
  acc: TestAccount,
  newTaille: 'pme' | 'grande',
): Promise<{ addedModules: string[] }> {
  await sbFetch(`/rest/v1/tenants?id=eq.${acc.tenantId}`, {
    method: 'PATCH',
    body: JSON.stringify({ taille_entreprise: newTaille, plan: PLAN_LEGACY[newTaille] }),
  })

  const currentModules = await sbFetch(
    `/rest/v1/tenant_modules?tenant_id=eq.${acc.tenantId}&enabled=eq.true&select=module_key`,
    { method: 'GET' },
  ) as Array<{ module_key: string }>

  const currentSet   = new Set(currentModules.map(m => m.module_key))
  const targetModules = PLAN_MODULES[newTaille]
  const toAdd         = targetModules.filter(m => !currentSet.has(m))

  if (toAdd.length) {
    await sbFetch('/rest/v1/tenant_modules', {
      method: 'POST',
      headers: { Prefer: 'resolution=ignore-duplicates,return=representation' },
      body: JSON.stringify(toAdd.map(key => ({
        tenant_id:  acc.tenantId,
        module_key: key,
        enabled:    true,
      }))),
    })
  }

  return { addedModules: toAdd }
}

export async function verifyTenantModules(tenantId: string): Promise<{ count: number; modules: string[] }> {
  const res = await sbFetch(
    `/rest/v1/tenant_modules?tenant_id=eq.${tenantId}&enabled=eq.true&select=module_key`,
    { method: 'GET' },
  ) as Array<{ module_key: string }>

  return {
    count:   res.length,
    modules: res.map(m => m.module_key).sort(),
  }
}

export async function verifyTenantDeleted(tenantId: string, userId: string): Promise<{
  tenantRows: number; profileRows: number; moduleRows: number; authUserExists: boolean;
}> {
  const [tenants, profiles, modules] = await Promise.all([
    sbFetch(`/rest/v1/tenants?id=eq.${tenantId}&select=id`,                             { method: 'GET' }),
    sbFetch(`/rest/v1/profiles?tenant_id=eq.${tenantId}&select=id`,                     { method: 'GET' }),
    sbFetch(`/rest/v1/tenant_modules?tenant_id=eq.${tenantId}&select=module_key`,        { method: 'GET' }),
  ]) as [unknown[], unknown[], unknown[]]

  // Check auth user
  let authUserExists = false
  try {
    await sbFetch(`/auth/v1/admin/users/${userId}`, { method: 'GET' })
    authUserExists = true
  } catch { /* deleted */ }

  return {
    tenantRows:    (tenants as unknown[]).length,
    profileRows:   (profiles as unknown[]).length,
    moduleRows:    (modules as unknown[]).length,
    authUserExists,
  }
}

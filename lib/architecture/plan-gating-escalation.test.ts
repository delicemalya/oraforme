/**
 * Escalation tests — CRITICAL #4 (plan gating quasi inexistant)
 *
 * Partie 1 : exécution réelle de canAccessByPlan() (lib/plan-access.ts), la
 * vraie fonction de décision appelée (via checkPlanAccess/getTenantPlan,
 * lib/api/require-tenant.ts) par les 5 routes corrigées. Pas une
 * réimplémentation — le catalogue REQUIRES_PME/REQUIRES_GRANDE/
 * REQUIRES_COMPAGNIE exact du fichier source.
 *
 * Partie 2 : vérification statique que les 5 routes corrigées (1) utilisent
 * le gateway canonique require-tenant.ts, (2) appellent checkPlanAccess avec
 * le tenant de SESSION (ctx.tid), jamais une valeur du body/query, et (3)
 * n'acceptent aucun champ plan/module_access/is_premium/tenant_id comme
 * override d'autorité dans leur body.
 *
 * ⚠️ Ne prouve pas le comportement HTTP réel en production (pas de canal
 * DB/HTTP disponible cette session) — voir docs/C4-PLAN-GATING-CLOSURE.md
 * section 12.
 */

import { readFileSync } from 'fs'
import { describe, it, expect } from 'vitest'
import path from 'path'
import { REPO_ROOT } from './supabase-usage'
import { canAccessByPlan } from '../plan-access'

function read(rel: string): string {
  return readFileSync(path.join(REPO_ROOT, rel), 'utf-8')
}

// ─────────────────────────────────────────────────────────────────────────────
// PARTIE 1 — Décision réelle (canAccessByPlan), exécutée
// ─────────────────────────────────────────────────────────────────────────────

describe('CRITICAL #4 — Entrepreneur (tpe) ne peut pas appeler une fonction Business/Compagnie', () => {
  it.each(['api-keys', 'bi', 'analytics', 'academy'])('tpe → %s refusé', (moduleId) => {
    expect(canAccessByPlan('tpe', moduleId)).toBe(false)
  })
})

describe('CRITICAL #4 — Business (pme) ne peut pas appeler une fonction réservée Compagnie', () => {
  // lib/plan-access.ts : REQUIRES_PME et REQUIRES_GRANDE sont tous les deux
  // "bloqués pour tpe uniquement" (commentaire exact du fichier source,
  // vérifié ligne à ligne) — 'api-keys'/'bi'/'analytics'/'academy' sont donc
  // Business+ (pme ET grande), PAS Compagnie-exclusif. Seul REQUIRES_COMPAGNIE
  // bloque pme en plus de tpe. Vérifié par exécution réelle, pas supposé.
  it.each(['api-keys', 'bi', 'analytics', 'academy'])('pme → %s autorisé (Business+, pas Compagnie-exclusif)', (moduleId) => {
    expect(canAccessByPlan('pme', moduleId)).toBe(true)
  })

  it.each(['groupe', 'email-management', 'social-media', 'consolidation'])('pme → %s refusé (REQUIRES_COMPAGNIE réel, vrai Compagnie-exclusif)', (moduleId) => {
    expect(canAccessByPlan('pme', moduleId)).toBe(false)
  })

  it.each(['groupe', 'email-management', 'social-media', 'consolidation'])('grande → %s autorisé', (moduleId) => {
    expect(canAccessByPlan('grande', moduleId)).toBe(true)
  })
})

describe('CRITICAL #4 — Tenant autorisé : accès fonctionnel', () => {
  it.each(['api-keys', 'bi', 'analytics', 'academy'])('grande → %s autorisé', (moduleId) => {
    expect(canAccessByPlan('grande', moduleId)).toBe(true)
  })
})

describe('CRITICAL #4 — un tenant legacy sans plan (null) est traité comme tpe, jamais comme accès total', () => {
  it.each(['api-keys', 'bi', 'analytics'])('null → %s refusé (fallback le plus restrictif)', (moduleId) => {
    expect(canAccessByPlan(null, moduleId)).toBe(false)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// PARTIE 2 — Les 5 routes corrigées : gateway canonique + autorité serveur
// ─────────────────────────────────────────────────────────────────────────────

const ROUTES_PLAN_GATEES = [
  { file: 'app/api/api-keys/route.ts', module: 'api-keys' },
  { file: 'app/api/api-keys/[id]/route.ts', module: 'api-keys' },
  { file: 'app/api/bi/insights/route.ts', module: 'bi' },
  { file: 'app/api/analytics/summary/route.ts', module: 'analytics' },
  { file: 'app/api/miaa/academy/route.ts', module: 'academy' },
]

describe('CRITICAL #4 — gateway canonique, pas tenant-guard.ts, pas de 3e gateway', () => {
  for (const { file } of ROUTES_PLAN_GATEES) {
    it(`${file} importe checkPlanAccess depuis require-tenant.ts`, () => {
      const src = read(file)
      expect(src).toContain("from '@/lib/api/require-tenant'")
      expect(src).toContain('checkPlanAccess')
      expect(src).not.toContain("from '@/lib/tenant-guard'")
    })
  }

  for (const { file, module: mod } of ROUTES_PLAN_GATEES) {
    it(`${file} appelle checkPlanAccess(ctx.tid/tenant_id-de-session, '${mod}')`, () => {
      const src = read(file)
      // Le tenant passé à checkPlanAccess doit être issu de ctx/tenant_id
      // dérivé de requireTenant(), jamais d'une variable nommée "plan"/
      // "tenantId" reconstruite depuis le body.
      expect(src).toMatch(new RegExp(`checkPlanAccess\\((ctx\\.tid|tenant_id|tenantId),\\s*'${mod}'\\)`))
    })
  }
})

describe('CRITICAL #4 — le body/query client ne peut jamais s\'auto-accorder un accès', () => {
  for (const { file } of ROUTES_PLAN_GATEES) {
    it(`${file} ne lit aucun champ plan/module_access/is_premium/is_admin depuis le body ou la query`, () => {
      const src = read(file)
      // Interdits : toute lecture de ces champs comme source d'autorité.
      expect(src).not.toMatch(/searchParams\.get\('plan'\)/)
      expect(src).not.toMatch(/body\.plan\b/)
      expect(src).not.toMatch(/\bmodule_access\b/i)
      expect(src).not.toMatch(/\bis_premium\b/i)
      expect(src).not.toMatch(/\bis_admin\b/i)
    })
  }

  it('bi/insights et analytics/summary ne reconstruisent plus le tenant depuis profiles côté route (ancien pattern non gatewayé)', () => {
    for (const file of ['app/api/bi/insights/route.ts', 'app/api/analytics/summary/route.ts']) {
      const src = read(file)
      expect(src).not.toMatch(/\.from\('profiles'\)/)
      expect(src).toContain('requireTenant(req)')
    }
  })
})

describe('CRITICAL #4 — modifier tenant_id ne change pas le tenant autorisé', () => {
  it('aucune des 5 routes ne lit tenant_id/tenantId depuis le body/query de la requête', () => {
    for (const { file } of ROUTES_PLAN_GATEES) {
      const src = read(file)
      // Un tenant_id/tenantId du client ne doit jamais être lu : ni via
      // destructuration du body, ni via searchParams. (Le fait qu'une
      // variable locale s'appelle "tenant_id" après `= ctx.tid` est
      // légitime — ce test interdit uniquement sa provenance client.)
      expect(src).not.toMatch(/searchParams\.get\('tenant_?[Ii]d'\)/)
      expect(src).not.toMatch(/(?:const|let)\s*\{[^}]*\btenant_?[Ii]d\b[^}]*\}\s*=\s*(?:await\s+)?req\.json/)
      expect(src).not.toMatch(/body\.tenant_?[Ii]d\b/)
    }
  })
})

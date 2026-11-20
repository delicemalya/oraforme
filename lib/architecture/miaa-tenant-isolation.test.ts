/**
 * Architecture regression test — CRITICAL #1 (IDOR MIAA)
 *
 * app/api/miaa/{chat,agent,expertise,academy,generer-document,analyze-file,
 * assurance-fraude,executive,rh-expert} lisaient tenant_id/tenantId/sinistre_id
 * depuis le corps JSON (ou la query string) du client, sans jamais vérifier
 * que la ressource appartient au tenant de la session — un tenant A pouvait
 * obtenir la mémoire d'entreprise, les documents, les rapports IA et (pour
 * assurance-fraude) le dossier sinistre d'un tenant B.
 *
 * ⚠️ TEST STATIQUE — lecture du code source (readFileSync/regex), AUCUNE
 * exécution réelle. Il prouve que le code appelle requireTenant() et ne lit
 * plus tenant_id/tenantId depuis le body/query sur les routes corrigées —
 * PAS que PostgreSQL/RLS bloque réellement un tenant A d'obtenir les données
 * d'un tenant B en production (canal DB indisponible cette session, Docker
 * et MCP tous deux hors service). Un test d'attaque cross-tenant RÉEL
 * (tenant A authentifié, tenant B authentifié, requête de A visant une
 * ressource de B, assertion sur le code HTTP/contenu réel de la réponse)
 * reste à faire dès qu'un canal de validation transactionnel est rétabli —
 * voir docs/C1-MIAA-IDOR-CLOSURE.md, section PRODUCTION_VALIDATION_REQUIRED.
 *
 * Refonte 2026-11 (réduction des secteurs) : la route assurance-fraude a été
 * supprimée avec le secteur assurance ; elle ne fait plus partie de la liste.
 *
 * Routes déjà corrigées par une mission antérieure (ANO-C05), non retouchées
 * ici : notifications, document-context, compliance (toutes utilisent déjà
 * ctx.tid).
 *
 * Routes volontairement NON corrigées dans cette mission (hors périmètre
 * C1, documentées comme risque résiduel, pas un oubli) :
 *   - proactif, analyse-quotidienne : routes d'automatisation protégées par
 *     requireAutomationSecret(), tenant_id vient d'une boucle serveur interne
 *     sur tous les tenants, pas d'un appelant externe — modèle d'auth différent,
 *     pas un IDOR.
 *   - upload-analyze, academy/lessons : tenant_id utilisé uniquement pour
 *     checkPlanAccess (risque de contournement de plan, catégorie Critical #4,
 *     pas une fuite de données tenant — ces deux routes ne lisent/écrivent
 *     aucune donnée scopée au tenant au-delà du plan check).
 *   - academy/{quiz,parcours,badges} : même anti-pattern mais sur des données
 *     de gamification/formation (pas financier/RH/PII), sévérité moindre,
 *     non traité dans cette mission.
 */

import { readFileSync } from 'fs'
import { describe, it, expect } from 'vitest'
import path from 'path'
import { REPO_ROOT } from './supabase-usage'

function read(rel: string): string {
  return readFileSync(path.join(REPO_ROOT, rel), 'utf-8')
}

const FIXED_ROUTES = [
  'app/api/miaa/chat/route.ts',
  'app/api/miaa/agent/route.ts',
  'app/api/miaa/expertise/route.ts',
  'app/api/miaa/academy/route.ts',
  'app/api/miaa/generer-document/route.ts',
  'app/api/miaa/analyze-file/route.ts',
  'app/api/miaa/executive/route.ts',
  'app/api/miaa/rh-expert/route.ts',
]

describe('CRITICAL #1 — /api/miaa/* isolation tenant (test statique)', () => {
  for (const route of FIXED_ROUTES) {
    it(`${route} appelle requireTenant() depuis require-tenant.ts`, () => {
      const src = read(route)
      expect(src).toContain("from '@/lib/api/require-tenant'")
      expect(src).toMatch(/requireTenant\(/)
    })
  }

  it('chat ne déclare plus tenant_id dans le type du body client', () => {
    const src = read('app/api/miaa/chat/route.ts')
    expect(src).not.toMatch(/tenantData\?:\s*\{\s*tenant_id/)
    expect(src).toContain('const tenantId = ctx.tid')
  })

  it('agent (GET+POST) ne lit plus tenant_id depuis la query/le body', () => {
    const src = read('app/api/miaa/agent/route.ts')
    expect(src).not.toMatch(/searchParams\.get\('tenant_id'\)/)
    expect(src).not.toMatch(/tenant_id:\s*string\s*\n/)
  })

  it('expertise (GET+POST) ne lit plus tenant_id depuis la query/le body', () => {
    const src = read('app/api/miaa/expertise/route.ts')
    expect(src).not.toMatch(/searchParams\.get\('tenant_id'\)/)
    expect(src).not.toMatch(/const \{ tenant_id, type_doc/)
  })

  it('academy (GET+POST) ne lit plus tenant_id depuis la query/le body', () => {
    const src = read('app/api/miaa/academy/route.ts')
    expect(src).not.toMatch(/searchParams\.get\('tenant_id'\)/)
  })

  it('analyze-file ne lit plus tenant_id depuis tenantData du body', () => {
    const src = read('app/api/miaa/analyze-file/route.ts')
    expect(src).not.toMatch(/tenantData\?:\s*\{\s*tenant_id/)
  })

  it('executive ne lit plus tenantId depuis le body client', () => {
    const src = read('app/api/miaa/executive/route.ts')
    expect(src).not.toMatch(/tenantId:\s*string\s*\n/)
    expect(src).toContain('const tenantId = ctx.tid')
  })

  it('rh-expert ne lit plus tenantId NI plan depuis le body client (double correctif : tenant + plan)', () => {
    const src = read('app/api/miaa/rh-expert/route.ts')
    expect(src).not.toMatch(/tenantId:\s*string\s*\n/)
    expect(src).not.toMatch(/plan:\s*string\s*\n/)
    expect(src).toContain('getTenantPlan(tenantId)')
  })

  it('les routes d\'automatisation restent gardées par secret, pas par requireTenant (modèle différent, pas un oubli)', () => {
    for (const route of ['app/api/miaa/proactif/route.ts', 'app/api/miaa/analyse-quotidienne/route.ts']) {
      const src = read(route)
      expect(src).toContain('requireAutomationSecret')
    }
  })

  it('les routes déjà corrigées par une mission antérieure (ANO-C05) utilisent bien ctx.tid', () => {
    for (const route of ['app/api/miaa/notifications/route.ts', 'app/api/miaa/document-context/route.ts', 'app/api/miaa/compliance/route.ts']) {
      const src = read(route)
      expect(src).toMatch(/ctx\.tid/)
    }
  })
})

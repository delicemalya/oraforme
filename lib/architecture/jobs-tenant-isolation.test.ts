/**
 * Architecture regression test — CRITICAL #2 (IDOR /api/jobs/*)
 *
 * app/api/jobs/{top5,recommandation,rapport-candidature,entretien,chat} lisaient/
 * écrivaient des données candidat/entretien/offre par identifiant seul, sans
 * jamais vérifier que la ressource appartient au tenant de l'appelant — un
 * tenant A pouvait obtenir les données (PII candidats, rapports IA) d'un
 * tenant B en devinant/obtenant un offreId/candidatureId/entretienId.
 *
 * app/api/jobs/analyser-cv est un endpoint public (déclenché sans session par
 * le formulaire de candidature) : le correctif n'est pas un gateway tenant
 * mais une vérification référentielle (candidatId doit appartenir à
 * candidatureId), pour empêcher de mélanger deux candidats différents.
 *
 * app/api/jobs/{offre,candidature,suivi} restent volontairement publics
 * (portail de candidature / page de suivi candidat) — ce test ne les touche
 * pas, les gater casserait le formulaire de candidature public.
 */

import { readFileSync } from 'fs'
import { describe, it, expect } from 'vitest'
import path from 'path'
import { REPO_ROOT } from './supabase-usage'

function read(rel: string): string {
  return readFileSync(path.join(REPO_ROOT, rel), 'utf-8')
}

const TENANT_GATED_ROUTES = [
  'app/api/jobs/top5/route.ts',
  'app/api/jobs/recommandation/route.ts',
  'app/api/jobs/rapport-candidature/route.ts',
  'app/api/jobs/entretien/route.ts',
  'app/api/jobs/chat/route.ts',
]

describe('CRITICAL #2 — /api/jobs/* isolation tenant', () => {
  for (const route of TENANT_GATED_ROUTES) {
    it(`${route} appelle requireTenant()`, () => {
      const src = read(route)
      expect(src).toContain("from '@/lib/api/require-tenant'")
      expect(src).toMatch(/requireTenant\(req\)/)
      expect(src).toMatch(/if \(!ctx\.ok\) return ctx\.error/)
    })
  }

  it('top5 filtre offres_emploi ET candidatures par tenant_id', () => {
    const src = read('app/api/jobs/top5/route.ts')
    expect(src).toMatch(/\.eq\('tenant_id',\s*ctx\.tid\)/)
    // 2 filtres attendus : la requête offres_emploi et la requête candidatures
    expect(src.match(/\.eq\('tenant_id',\s*ctx\.tid\)/g)?.length).toBeGreaterThanOrEqual(2)
  })

  it('recommandation filtre offres_emploi ET candidatures par tenant_id', () => {
    const src = read('app/api/jobs/recommandation/route.ts')
    expect(src.match(/\.eq\('tenant_id',\s*ctx\.tid\)/g)?.length).toBeGreaterThanOrEqual(2)
  })

  it('rapport-candidature filtre candidatures par tenant_id', () => {
    const src = read('app/api/jobs/rapport-candidature/route.ts')
    expect(src).toMatch(/\.eq\('tenant_id',\s*ctx\.tid\)/)
  })

  it('entretien filtre les 4 opérations (GET, POST x2, PUT) par tenant_id', () => {
    const src = read('app/api/jobs/entretien/route.ts')
    expect(src.match(/\.eq\('tenant_id',\s*ctx\.tid\)/g)?.length).toBeGreaterThanOrEqual(4)
  })

  it('chat ne lit plus tenantId depuis le corps de la requête client', () => {
    const src = read('app/api/jobs/chat/route.ts')
    expect(src).not.toMatch(/tenantId\?:\s*string/)
    expect(src).toContain('const tenantId = ctx.tid')
  })

  it('analyser-cv vérifie que candidatId appartient à candidatureId', () => {
    const src = read('app/api/jobs/analyser-cv/route.ts')
    expect(src).toMatch(/candidature\.candidat_id\s*!==\s*candidatId/)
  })

  it('les routes publiques du portail candidat restent sans gateway tenant (volontaire)', () => {
    for (const route of ['app/api/jobs/offre/route.ts', 'app/api/jobs/candidature/route.ts', 'app/api/jobs/suivi/route.ts']) {
      const src = read(route)
      expect(src).not.toContain("from '@/lib/api/require-tenant'")
    }
  })
})

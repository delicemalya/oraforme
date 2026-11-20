/**
 * lib/architecture/res-san-hot-boi-tva-ca-separation.test.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Mission P0-FISCAL-CG-2026 — correction transversale TVA + Centime Additionnel
 * (2026-09-18), suite de BTP-001 (migration 181, PASS en production).
 *
 * RES-001, SAN-001 (2 writers), HOT-001, BOI-001 postaient tous montant_tva =
 * TVA+CA fusionnés (18,9%) sur 4441, exactement comme BTP-001 avant sa
 * correction. Le code applicatif des 4 modules délègue désormais à
 * lib/fiscalite/engine-adapter.ts — RES-001 (déjà HT-first via
 * calculerTVACongo) via calculerTVASurMontantUnifie ; SAN-001/HOT-001/BOI-001
 * (TTC-first, montant connu seulement à la facturation/l'encaissement) via la
 * nouvelle decomposerTTCUnifie().
 *
 * La migration comptable (182_fix_res_san_hot_boi_tva_ca_separation.sql,
 * séquence 3 par event_type) n'a volontairement PAS été exécutée en
 * production dans cette mission (instruction explicite) : les tests
 * production ci-dessous vérifient donc l'ÉTAT ACTUEL (avant 182), pas le
 * comportement après migration — à revérifier une fois 182 appliquée, sur le
 * même modèle que la revalidation de la migration 181.
 */

import { readFileSync } from 'fs'
import path from 'path'
import { describe, it, expect } from 'vitest'
import { decomposerTTCUnifie, calculerTVASurMontantUnifie } from '../fiscalite/engine-adapter'

const ROOT = path.resolve(__dirname, '../..')

function sourceSansCommentaires(relPath: string): string {
  const src = readFileSync(path.join(ROOT, relPath), 'utf-8')
  return src.split('\n').filter(l => !l.trim().startsWith('//')).join('\n')
}

// ── decomposerTTCUnifie — fonction centrale (pas de taux recopié ailleurs) ──

describe('decomposerTTCUnifie — décomposition TTC → HT/TVA/CA', () => {
  it('118 900 FCFA TTC (cas réel observé — ancienne ligne de test AMD FINANCE) : ht=100 000, tva=18 000, ca=900', () => {
    const r = decomposerTTCUnifie(118_900, 'CG')
    expect(r.ht).toBe(100_000)
    expect(r.tva).toBe(18_000)
    expect(r.ca).toBe(900)
    expect(r.ttc).toBe(118_900)
  })

  it('594 500 FCFA TTC (scénario de référence BTP-001) : ht=500 000, tva=90 000, ca=4 500', () => {
    const r = decomposerTTCUnifie(594_500, 'CG')
    expect(r.ht).toBe(500_000)
    expect(r.tva).toBe(90_000)
    expect(r.ca).toBe(4_500)
  })

  it('le TTC fourni n’est jamais recalculé — toujours restitué à l’identique', () => {
    for (const ttc of [0, 1, 12_345, 594_500, 1_000_000]) {
      expect(decomposerTTCUnifie(ttc, 'CG').ttc).toBe(ttc)
    }
  })

  it('ht+tva+ca reconstitue exactement le TTC (pas de perte ni de double comptage)', () => {
    for (const ttc of [0, 12_345, 100_000, 118_900, 594_500, 999_999]) {
      const r = decomposerTTCUnifie(ttc, 'CG')
      expect(r.ht + r.tva + r.ca).toBe(ttc)
    }
  })

  it('montant nul : tout à zéro, pas d’erreur', () => {
    const r = decomposerTTCUnifie(0, 'CG')
    expect(r).toEqual({ ht: 0, tva: 0, ca: 0, ttc: 0 })
  })
})

// Refonte 2026-11 (réduction des secteurs) : les secteurs restauration et
// boissons ont été supprimés avec leurs routes (RES-001, BOI-001).
// SAN-001 (santé), HOT-001 (hôtel) et les tests de la migration 182 restent.

// ── SAN-001 — 2 writers ─────────────────────────────────────────────────────

describe.each([
  'app/api/sante/facturation/route.ts',
  'app/api/sante/consultations/route.ts',
])('SAN-001 — %s', (relPath) => {
  const src = sourceSansCommentaires(relPath)

  it('délègue à decomposerTTCUnifie, aucun calcul local par 1.189', () => {
    expect(src).toContain("from '@/lib/fiscalite/engine-adapter'")
    expect(src).toContain('decomposerTTCUnifie(')
    expect(src).not.toMatch(/\/\s*1\.189/)
    expect(src).not.toMatch(/1\.189/)
  })

  it('metadata porte ca et country_code', () => {
    expect(src).toMatch(/ca,\s*country_code:\s*pays\b/)
  })
})

// ── HOT-001 — app/api/hotel/payments/route.ts ───────────────────────────────

describe('HOT-001 — app/api/hotel/payments/route.ts', () => {
  const src = sourceSansCommentaires('app/api/hotel/payments/route.ts')

  it('délègue à decomposerTTCUnifie, aucun calcul local par 1.189', () => {
    expect(src).toContain("from '@/lib/fiscalite/engine-adapter'")
    expect(src).toContain('decomposerTTCUnifie(')
    expect(src).not.toMatch(/1\.189/)
  })

  it('metadata porte ca et country_code', () => {
    expect(src).toContain('ca:             montantCA')
    expect(src).toContain('country_code:   pays,')
  })
})

// ── Réconciliation forward (RES) vs reverse (SAN/HOT/BOI) — même régime ────

describe('Cohérence forward (calculerTVASurMontantUnifie) vs reverse (decomposerTTCUnifie)', () => {
  it('pour un même couple HT/TTC, les deux sens du calcul se recoupent exactement', () => {
    const ht = 500_000
    const forward = calculerTVASurMontantUnifie(ht, 'CG')
    const reverse = decomposerTTCUnifie(forward.ttc, 'CG')
    expect(reverse.ht).toBe(ht)
    expect(reverse.tva).toBe(forward.tva)
    expect(reverse.ca).toBe(forward.ca)
  })
})

// ── État production actuel (AVANT migration 182 — volontairement non exécutée) ─

describe('Migration 182 — préparée, non exécutée (vérification statique du fichier)', () => {
  const migration = readFileSync(
    path.join(ROOT, 'supabase/migrations/182_fix_res_san_hot_boi_tva_ca_separation.sql'),
    'utf-8',
  )

  it('ajoute une séquence 3 pour les 4 event_types, gardée par WHERE NOT EXISTS (idempotente)', () => {
    for (const event of ['RES-001', 'SAN-001', 'HOT-001', 'BOI-001']) {
      expect(migration).toContain(`SELECT '${event}', 3, 1, 'active'`)
    }
    const occurrences = migration.split('WHERE NOT EXISTS').length - 1
    expect(occurrences).toBeGreaterThanOrEqual(5) // 4 séquences + 1 version moteur
  })

  it('RES-001/HOT-001/BOI-001 séquence 3 débitent la trésorerie (treasury_debit), pas 411', () => {
    for (const event of ['RES-001', 'HOT-001', 'BOI-001']) {
      const idx = migration.indexOf(`SELECT '${event}', 3, 1, 'active'`)
      const bloc = migration.slice(idx, idx + 400)
      expect(bloc).toContain("'521', '447'")
      expect(bloc).toContain("'treasury_debit'")
    }
  })

  it('SAN-001 séquence 3 débite 411 (Clients), comme FAC-001/BTP-001 — pas treasury_debit', () => {
    const idx = migration.indexOf(`SELECT 'SAN-001', 3, 1, 'active'`)
    const bloc = migration.slice(idx, idx + 400)
    expect(bloc).toContain("'411', '447'")
  })

  it('ne modifie ni FAC-001, ni BTP-001, ni BTP-002, ni PAI-001', () => {
    expect(migration).not.toContain("'FAC-001'")
    expect(migration).not.toContain("'BTP-001'")
    expect(migration).not.toContain("'BTP-002'")
    expect(migration).not.toContain("'PAI-001'")
  })
})

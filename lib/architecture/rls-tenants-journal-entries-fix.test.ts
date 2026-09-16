/**
 * Test de conformité architecturale — correctif RLS P0-CRITICAL-01
 * (docs/MASTER-A-Z-AUDIT-2026-09.md §32 risques #1 et #2).
 *
 * LIMITATION EXPLICITE : ce test lit le contenu réel de la migration et des
 * fichiers déplacés (comme les autres tests de lib/architecture/), mais NE
 * PEUT PAS exécuter de vraie requête RLS contre une base Postgres — aucun
 * environnement de recette n'existe (ANO-P03, toujours BLOCKED). Le
 * comportement RLS réel (tenant A ne lit pas tenant B ; un utilisateur non
 * financier ne peut ni lire ni écrire journal_entries) reste NOT TESTABLE tant
 * que ce blocage n'est pas levé — voir docs/REPAIR-LOG.md pour le statut exact.
 * Ce test prouve uniquement que le CODE de la migration correspond à l'intention
 * documentée (CODE VERIFIED), pas que la production a été corrigée
 * (PRODUCTION VERIFIED — nécessite une ré-interrogation live de pg_policies
 * après application de la migration par l'utilisateur).
 */

import { readFileSync, existsSync } from 'fs'
import { describe, it, expect } from 'vitest'
import path from 'path'

const ROOT = path.resolve(__dirname, '../..')
const MIGRATION_FILE = path.join(ROOT, 'supabase', 'migrations', '180_fix_rls_tenants_journal_entries_leak.sql')

function read(p: string): string {
  return readFileSync(p, 'utf-8')
}

describe('Migration 180 — correctif RLS tenants (fuite cross-tenant)', () => {
  it('le fichier de migration existe', () => {
    expect(existsSync(MIGRATION_FILE)).toBe(true)
  })

  const sql = existsSync(MIGRATION_FILE) ? read(MIGRATION_FILE) : ''

  it('retire la policy dangereuse "tenants_select" (auth.uid() IS NOT NULL, sans filtre tenant)', () => {
    expect(sql).toMatch(/DROP POLICY IF EXISTS "tenants_select" ON public\.tenants;/)
  })

  it('ne retire PAS les policies tenants légitimes (select scopée tenant, visibilité groupe)', () => {
    expect(sql).not.toMatch(/DROP POLICY IF EXISTS "tenants: select"/)
    expect(sql).not.toMatch(/DROP POLICY IF EXISTS "tenants: visibilite groupe membres"/)
  })
})

describe('Migration 180 — correctif RLS journal_entries (grand livre non protégé)', () => {
  const sql = existsSync(MIGRATION_FILE) ? read(MIGRATION_FILE) : ''

  it('retire les 4 policies larges (select/insert/update/delete) sans vérification financière', () => {
    for (const cmd of ['select', 'insert', 'update', 'delete']) {
      expect(sql, `DROP POLICY manquant pour journal_entries: ${cmd}`).toMatch(
        new RegExp(`DROP POLICY IF EXISTS "journal_entries: ${cmd}" ON public\\.journal_entries;`)
      )
    }
  })

  it('ne retire PAS les policies financières légitimes', () => {
    expect(sql).not.toMatch(/DROP POLICY IF EXISTS "journal_entries: financial read"/)
    expect(sql).not.toMatch(/DROP POLICY IF EXISTS "journal_entries: financial write"/)
  })

  it('contient une vérification post-migration qui échoue bruyamment si l\'état cible n\'est pas atteint', () => {
    expect(sql).toMatch(/RAISE EXCEPTION 'Migration 180 échouée/)
  })

  it('est idempotente (tous les DROP POLICY utilisent IF EXISTS)', () => {
    // Ignore les lignes de commentaire SQL (`--`) avant de chercher les vraies instructions.
    const codeOnly = sql.split('\n').filter(line => !line.trim().startsWith('--')).join('\n')
    const dropStatements = codeOnly.match(/DROP POLICY[^;]*;/g) ?? []
    expect(dropStatements.length).toBeGreaterThan(0)
    for (const stmt of dropStatements) {
      expect(stmt, `DROP POLICY sans IF EXISTS : ${stmt}`).toMatch(/DROP POLICY IF EXISTS/)
    }
  })

  it('ne contient aucune instruction de suppression de données (DELETE FROM/TRUNCATE)', () => {
    expect(sql).not.toMatch(/\bDELETE FROM\b/i)
    expect(sql).not.toMatch(/\bTRUNCATE\b/i)
  })
})

describe('P0-CRITICAL-01 — seeds SQL non gardés neutralisés (déplacés + gardés)', () => {
  const movedFiles = [
    'docs/runbooks/demo_data_sprint_s02_p3.sql',
    'docs/runbooks/seed_amd_finance.sql',
  ]
  const originalPaths = [
    'supabase/tests/demo_data_sprint_s02_p3.sql',
    'supabase/tests/seed_amd_finance.sql',
  ]

  it.each(originalPaths)('%s n\'existe plus à son ancien emplacement', (relPath) => {
    expect(existsSync(path.join(ROOT, relPath))).toBe(false)
  })

  it.each(movedFiles)('%s existe à son nouvel emplacement (docs/runbooks/)', (relPath) => {
    expect(existsSync(path.join(ROOT, relPath))).toBe(true)
  })

  const KNOWN_AMD_FINANCE_UUIDS = [
    'b93b7c3d-815b-4336-bbb2-ac24cda0edb2',
    '64c244e5-02fd-4cf7-a56f-b0bdd48fdc09',
    '810892b1-646b-43d3-9534-3c17cc1417fb',
  ]

  it.each(movedFiles)('%s contient une garde technique RAISE EXCEPTION sur les 3 UUID AMD FINANCE connus', (relPath) => {
    const content = read(path.join(ROOT, relPath))
    expect(content).toMatch(/GARDE-FOU PRODUCTION/)
    expect(content).toMatch(/RAISE EXCEPTION 'GARDE-FOU PRODUCTION/)
    for (const uuid of KNOWN_AMD_FINANCE_UUIDS) {
      expect(content, `UUID ${uuid} absent de la garde dans ${relPath}`).toContain(uuid)
    }
  })
})

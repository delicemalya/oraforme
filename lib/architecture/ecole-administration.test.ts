/**
 * École — la partie administration (Direction, RH, Finance, Comptabilité,
 * Trésorerie, Facturation, Dépenses…) doit être visible du propriétaire.
 *
 * Constat (2026-11-20, retour fondateur) : ecole_role_name n'est jamais
 * renseigné à l'inscription. Or la barre latérale exige un rôle école pour
 * chaque module core (ECOLE_CORE_ROLE_FILTER) : le propriétaire d'une école
 * ne voyait plus que les modules pédagogiques. La base (fn_get_my_ecole_role,
 * migration 034) et le proxy traitaient déjà le propriétaire comme
 * DIRECTION_GENERALE — le client est maintenant aligné via roleEcoleEffectif().
 */

import { readFileSync } from 'fs'
import path from 'path'
import { describe, it, expect } from 'vitest'
import { ECOLE_CORE_ROLE_FILTER, roleEcoleEffectif } from '../erp-sectors'

const ROOT = path.resolve(__dirname, '../..')
const read = (rel: string) => readFileSync(path.join(ROOT, rel), 'utf-8')

describe('roleEcoleEffectif — même règle que fn_get_my_ecole_role (034)', () => {
  it('le propriétaire est DIRECTION_GENERALE, même sans rôle école renseigné', () => {
    expect(roleEcoleEffectif('owner', null)).toBe('DIRECTION_GENERALE')
    expect(roleEcoleEffectif('owner', undefined)).toBe('DIRECTION_GENERALE')
    expect(roleEcoleEffectif('owner', 'FORMATEUR')).toBe('DIRECTION_GENERALE')
  })

  it('un membre garde son rôle école (ou aucun)', () => {
    expect(roleEcoleEffectif('membre', 'RAF')).toBe('RAF')
    expect(roleEcoleEffectif('admin', null)).toBeNull()
  })
})

describe('Partie administration visible du propriétaire d\'école', () => {
  const ADMINISTRATION = [
    'direction', 'rh', 'finance', 'comptabilite', 'tresorerie',
    'facturation', 'depenses', 'achats', 'crm', 'recouvrement', 'stock',
  ]

  it.each(ADMINISTRATION)('module %s autorisé pour le propriétaire', (id) => {
    const roleProprio = roleEcoleEffectif('owner', null)!
    expect(ECOLE_CORE_ROLE_FILTER[id]).toContain(roleProprio)
  })

  it('TenantContext et tenant-guard appliquent la règle (pas le champ brut)', () => {
    for (const rel of ['lib/contexts/TenantContext.tsx', 'lib/tenant-guard.ts']) {
      const src = read(rel)
      expect(src).toContain('roleEcoleEffectif(')
      expect(src).not.toMatch(/ecoleRole:\s*\(profile as \{ ecole_role_name\?: string \| null \}\)\.ecole_role_name \?\? null/)
    }
  })
})

/**
 * Pays réel du tenant (refonte 2026-11, migration 190).
 *
 * Avant : les routes envoyaient country_code = 'CG' en dur au moteur comptable
 * et calculaient la TVA au taux du Congo, quel que soit le pays du tenant.
 * Ce test verrouille :
 *  1. la normalisation de tenants.pays (codes + valeurs historiques) ;
 *  2. l'absence de régression pour le Congo (mêmes montants qu'avant) ;
 *  3. l'absence de 'CG' en dur dans les routes qui comptabilisent ;
 *  4. la migration 190 (447 tous pays, versionnée, historique conservé).
 */

import { readFileSync } from 'fs'
import path from 'path'
import { describe, it, expect } from 'vitest'
import { normaliserPaysTenant } from '../fiscalite/pays-tenant'
import { calculerTVASurMontantUnifie, decomposerTTCUnifie } from '../fiscalite/engine-adapter'
import { calculerTVACongo } from '../fiscalite-congo'
import { totauxOrdre } from '../garage/ordres'

const ROOT = path.resolve(__dirname, '../..')
const read = (p: string) => readFileSync(path.join(ROOT, p), 'utf8')

describe('normaliserPaysTenant', () => {
  it('garde les codes connus, en majuscules', () => {
    expect(normaliserPaysTenant('CM')).toBe('CM')
    expect(normaliserPaysTenant(' ga ')).toBe('GA')
  })
  it('reconnaît les noms historiques', () => {
    expect(normaliserPaysTenant('Congo-Brazzaville')).toBe('CG')
    expect(normaliserPaysTenant('Cameroun')).toBe('CM')
    expect(normaliserPaysTenant('RDC')).toBe('CD')
    expect(normaliserPaysTenant('Guinée Équatoriale')).toBe('GQ')
  })
  it('vide, null ou inconnu → CG', () => {
    for (const v of [null, undefined, '', '  ', 'Atlantide', 42]) expect(normaliserPaysTenant(v)).toBe('CG')
  })
})

describe('Congo — aucun changement de montant', () => {
  it('calculerTVASurMontantUnifie(ht, CG) = calculerTVACongo(ht)', () => {
    for (const ht of [0, 1, 99, 1000, 12_345, 100_000, 1_234_567, 9_999_999]) {
      const avant = calculerTVACongo(ht)
      const apres = calculerTVASurMontantUnifie(ht, 'CG')
      expect({ tva: apres.tva, ca: apres.ca, ttc: apres.ttc }).toEqual({ tva: avant.tva, ca: avant.ca, ttc: avant.ttc })
    }
  })
  it('totauxOrdre sans pays = totauxOrdre CG', () => {
    const lignes = [{ quantite: 2, prix_unitaire: 15_000 }, { quantite: 1.5, prix_unitaire: 10_000 }]
    expect(totauxOrdre(lignes, 'CG')).toEqual(totauxOrdre(lignes))
  })
})

describe('Hors Congo — le pays change bien le calcul', () => {
  it('Cameroun : TVA et taxe additionnelle du Cameroun, pas du Congo', () => {
    const cg = calculerTVASurMontantUnifie(100_000, 'CG')
    const cm = calculerTVASurMontantUnifie(100_000, 'CM')
    expect(cm.ttc).not.toBe(cg.ttc)
    expect(cm.ttc).toBe(100_000 + cm.tva + cm.ca)
  })
  it('décomposition TTC : le TTC reste exact au franc près', () => {
    for (const p of ['CG', 'CM', 'GA'] as const) {
      const d = decomposerTTCUnifie(118_900, p)
      expect(d.ht + d.tva + d.ca).toBe(118_900)
    }
  })
})

const ROUTES = [
  'app/api/factures/route.ts',
  'app/api/factures/[id]/route.ts',
  'app/api/hotel/payments/route.ts',
  'app/api/sante/consultations/route.ts',
  'app/api/sante/facturation/route.ts',
  'app/api/sales/route.ts',
  'app/api/garage/ordres/[id]/facturer/route.ts',
  'app/api/garage/ordres/[id]/lignes/route.ts',
]

describe('Routes — le pays vient du tenant', () => {
  it.each(ROUTES)('%s : aucun pays CG en dur, getPaysTenant utilisé', (r) => {
    const src = read(r)
    expect(src).not.toMatch(/country_code:\s*'CG'|p_country_code:\s*'CG'|Unifie\([^)]*'CG'\)|calculerTVACongo/)
    expect(src).toContain('getPaysTenant(')
  })

  it('fn_garage_facturer_ordre reçoit le pays (plus de CG en dur dans 189)', () => {
    const sql = read('supabase/migrations/189_garage.sql')
    expect(sql).not.toContain("'country_code', 'CG'")
    expect(sql).toContain("'country_code', COALESCE(NULLIF(p_country_code, ''), 'CG')")
    expect(sql).toContain('DATE, INT, TEXT) FROM PUBLIC, anon, authenticated')
  })
})

describe('Migration 190 — 447 tous pays', () => {
  const sql = read('supabase/migrations/190_taxes_additionnelles_multi_pays.sql')
  it('crée une version 2 tous pays pour FAC-001, SAN-001, HOT-001 séquence 3', () => {
    expect(sql).toContain("v1.event_type IN ('FAC-001', 'SAN-001', 'HOT-001')")
    expect(sql).toMatch(/v1\.conditions, NULL, v1\.account_plan, CURRENT_DATE/)
  })
  it('la version 1 reste active (historique), seulement bornée par valid_until', () => {
    const update = sql.slice(sql.indexOf('UPDATE public.accounting_event_rules v1'), sql.indexOf('-- 3. Version moteur'))
    expect(update).toContain('valid_until')
    expect(update).not.toMatch(/status\s*=/)
  })
  it('est idempotente', () => {
    expect(sql).toContain('AND NOT EXISTS')
    expect(sql).toContain('v1.superseded_by IS NULL')
  })
})

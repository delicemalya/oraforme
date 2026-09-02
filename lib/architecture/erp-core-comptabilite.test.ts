/**
 * Architecture regression test — ROUTES ERP CORE COMPTABILITÉ (P0-02)
 *
 * Les deux routes du Grand Livre et de la Balance étaient injoignables :
 *
 *   Grand Livre  400   column journal_entries.reference does not exist
 *   Balance      22008 date/time field value out of range
 *
 * Les deux défauts sont restés invisibles parce que les routes n'ont aucun
 * appelant : les pages du tableau de bord lisent journal_entries en direct et
 * réimplémentent le calcul. Rien ne les exerçait, et le cast `as any` sur le
 * client Supabase supprimait toute vérification de colonne à la compilation.
 *
 * Ce test rétablit une vérification là où le typage a été neutralisé.
 */

import { readFileSync } from 'fs'
import { describe, it, expect } from 'vitest'
import path from 'path'
import { BALANCE_SELECT, GRAND_LIVRE_SELECT } from '@/lib/erp-core/compute/accounting'

const ROOT = path.resolve(__dirname, '../..')

/**
 * Colonnes réelles de journal_entries, relevées migration par migration.
 *
 *   026_erp_interconnection    création de la table
 *   027_erp_consolidation      cost_center_id, reference_piece, tiers_id, tiers_type
 *   048_compta_enterprise      centre_cout
 *   065_journal_factures_sante piece_number
 *   074_multidevises           devise, montant_devise, taux_applique, taux_change_id
 *
 * `reference` et `journal_type` n'apparaissent dans aucune migration : le
 * contrat ERP Core les nommait sans qu'elles aient jamais existé.
 */
const JOURNAL_ENTRIES_COLUMNS = new Set([
  'id', 'tenant_id', 'date_operation', 'libelle', 'debit_account', 'credit_account',
  'montant', 'source', 'source_id', 'fiscal_year', 'created_by', 'validated_at',
  'validated_by', 'created_at',
  'cost_center_id', 'reference_piece', 'tiers_id', 'tiers_type',
  'centre_cout',
  'piece_number',
  'devise', 'montant_devise', 'taux_applique', 'taux_change_id',
])

const ROUTES = [
  'app/api/comptabilite/balance/route.ts',
  'app/api/comptabilite/grand-livre/route.ts',
]

const lire = (rel: string) => readFileSync(path.join(ROOT, rel), 'utf-8')
const colonnes = (select: string) => select.split(',').map(c => c.trim()).filter(Boolean)

describe('ERP Core comptabilité — les sélecteurs ne nomment que des colonnes réelles', () => {
  it.each(colonnes(BALANCE_SELECT))('BALANCE_SELECT : %s existe', (col) => {
    expect(JOURNAL_ENTRIES_COLUMNS.has(col), `${col} absente de journal_entries`).toBe(true)
  })

  it.each(colonnes(GRAND_LIVRE_SELECT))('GRAND_LIVRE_SELECT : %s existe', (col) => {
    expect(JOURNAL_ENTRIES_COLUMNS.has(col), `${col} absente de journal_entries`).toBe(true)
  })

  it('la référence de pièce est celle que le writer unique renseigne', () => {
    // emit_accounting_event (migration 138:735) insère piece_number.
    // reference_piece existe mais n'est écrite par personne : la lire
    // rendrait une colonne vide, ce qui est pire qu'une erreur.
    expect(GRAND_LIVRE_SELECT).toContain('piece_number')
    expect(GRAND_LIVRE_SELECT).not.toContain('reference_piece')
  })

  it('les colonnes qui n’ont jamais existé ne reviennent pas', () => {
    for (const select of [BALANCE_SELECT, GRAND_LIVRE_SELECT]) {
      expect(colonnes(select)).not.toContain('reference')
      expect(colonnes(select)).not.toContain('journal_type')
    }
  })
})

describe('ERP Core comptabilité — la période ne construit jamais un 31 fixe', () => {
  it.each(ROUTES)('%s n’écrit pas de borne « -31 »', (rel) => {
    const src = lire(rel)
    expect(src).not.toMatch(/-31`/)
    expect(src).not.toMatch(/-31'/)
  })

  it('la Balance borne la période par un intervalle semi-ouvert', () => {
    const src = lire('app/api/comptabilite/balance/route.ts')
    expect(src).toContain('periodeMensuelle')
    expect(src).toContain(".lt('date_operation'")
    // Une borne haute inclusive sur une date de fin de mois est ce qui a
    // produit février 31.
    expect(src).not.toContain(".lte('date_operation'")
  })
})

describe('ERP Core comptabilité — isolation et LOI-K', () => {
  it.each(ROUTES)('%s filtre sur le tenant', (rel) => {
    expect(lire(rel)).toContain(".eq('tenant_id'")
  })

  it.each(ROUTES)('%s exige une session de tenant', (rel) => {
    expect(lire(rel)).toContain('requireTenant')
  })

  it.each(ROUTES)('%s est en lecture seule — aucun writer sur journal_entries', (rel) => {
    const src = lire(rel)
    for (const ecriture of ['.insert(', '.update(', '.delete(', '.upsert(', '.rpc(']) {
      expect(src.includes(ecriture), `${rel} contient ${ecriture}`).toBe(false)
    }
  })

  it.each(ROUTES)('%s ne lit que journal_entries, sans source parallèle', (rel) => {
    const src = lire(rel)
    const tables = [...src.matchAll(/from\('([a-z_]+)'\)/g)].map(m => m[1])
    expect([...new Set(tables)]).toEqual(['journal_entries'])
  })

  it.each(ROUTES)('%s délègue le calcul à ERP Core', (rel) => {
    expect(lire(rel)).toContain("@/lib/erp-core/compute/accounting")
  })
})

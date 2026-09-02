/**
 * Architecture regression test — SCHÉMA FACTURES (ANO-C02)
 *
 * Le 2026-05-12, le commit f757c5e a livré ensemble la migration 010 et le code
 * qui l'utilise. La migration n'a été appliquée qu'à moitié en production. Le
 * code s'est donc mis à écrire neuf colonnes inexistantes, PostgREST a rejeté
 * chaque INSERT, et la création de facture est restée impossible pendant
 * quatre mois sans qu'aucun test ne le signale.
 *
 * Ce test compare les colonnes que le code lit et écrit sur `factures` au
 * schéma réel de la table. Il aurait fait échouer ce commit le jour même.
 *
 * Quand la table change : exécuter la migration, puis mettre à jour
 * FACTURES_COLUMNS ci-dessous. La liste est un contrat, pas un cache — elle
 * doit refléter le résultat de :
 *
 *   SELECT column_name FROM information_schema.columns
 *   WHERE table_schema = 'public' AND table_name = 'factures'
 *   ORDER BY ordinal_position;
 */

import { describe, it, expect } from 'vitest'
import { collectTableUsages } from './supabase-usage'

/**
 * Schéma réel de `factures`, relevé en production le 2026-09-02 (21 colonnes)
 * puis complété par la migration 172 (8 colonnes).
 *
 * Deux colonnes sont volontairement ABSENTES et ne doivent jamais revenir :
 *   client_name — doublon de client_nom, arbitré en faveur de client_nom
 *   subtotal    — doublon de montant_ht, arbitré en faveur de montant_ht
 */
const FACTURES_COLUMNS = new Set([
  // migration 001 et suivantes
  'id', 'tenant_id', 'client_nom', 'client_email', 'items', 'montant_ht',
  'tva', 'total', 'statut', 'created_at', 'tiers_id', 'compte_client',
  'type', 'moyen_paiement', 'facture_ref_id', 'devis_id', 'remise_pct',
  'montant_paye', 'client_id', 'avoir_de', 'tva_montant',
  // migration 172
  'invoice_number', 'client_address', 'client_phone', 'date', 'due_date',
  'ca', 'footer_text', 'notes',
])

/** Colonnes écartées à l'arbitrage — leur réapparition est une régression. */
const FORBIDDEN_COLUMNS: Record<string, string> = {
  client_name: 'doublon de client_nom',
  subtotal:    'doublon de montant_ht',
}

describe('SCHÉMA FACTURES — le code ne touche que des colonnes qui existent', () => {
  const usages = collectTableUsages('factures')

  it('trouve bien les accès à la table factures', () => {
    expect(usages.length).toBeGreaterThan(20)
  })

  it('aucune colonne inconnue du schéma', () => {
    const unknown = usages.filter(u => !FACTURES_COLUMNS.has(u.column))
    const detail = unknown.map(u => `${u.file} — ${u.kind}('${u.column}')`).join('\n')
    expect(unknown, `Colonnes absentes de la table factures :\n${detail}`).toEqual([])
  })

  it('aucune des colonnes écartées à l’arbitrage ne réapparaît', () => {
    const revived = usages.filter(u => u.column in FORBIDDEN_COLUMNS)
    const detail = revived
      .map(u => `${u.file} — ${u.kind}('${u.column}') : ${FORBIDDEN_COLUMNS[u.column]}`)
      .join('\n')
    expect(revived, `Colonnes arbitrées puis réintroduites :\n${detail}`).toEqual([])
  })

  it('les deux colonnes de référence sont bien utilisées', () => {
    const columns = new Set(usages.map(u => u.column))
    expect(columns.has('client_nom')).toBe(true)
    expect(columns.has('montant_ht')).toBe(true)
  })
})

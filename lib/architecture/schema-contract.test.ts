/**
 * Architecture regression test — CONTRAT DE SCHÉMA
 *
 * Le 2026-05-12, le commit f757c5e a livré ensemble la migration 010 et le code
 * qui l'utilise. La migration n'a été appliquée qu'à moitié en production. Le
 * code s'est mis à écrire neuf colonnes inexistantes, PostgREST a rejeté chaque
 * INSERT, et la création de facture est restée impossible quatre mois sans
 * qu'aucun outil ne le signale. Le même défaut a été retrouvé sur products
 * (ANO-C03) et sur purchases : trois modules du produit rendus inopérants par
 * des migrations partiellement appliquées.
 *
 * Ce test compare les colonnes que le code lit et écrit aux schémas réels.
 * C'est le test que le rapport R-001 désigne comme le plus rentable : il aurait
 * fait échouer chacun de ces commits le jour même.
 *
 * Chaque liste ci-dessous est un CONTRAT relevé en production, pas un cache.
 * Après une migration qui change une table, la mettre à jour depuis :
 *
 *   SELECT column_name FROM information_schema.columns
 *   WHERE table_schema = 'public' AND table_name = '<table>'
 *   ORDER BY ordinal_position;
 */

import { describe, it, expect } from 'vitest'
import { collectTableUsages } from './supabase-usage'

/** Schémas relevés en production le 2026-09-02, complétés par les migrations 172 et 174. */
const SCHEMAS: Record<string, string[]> = {
  factures: [
    // migration 001 et suivantes — 21 colonnes
    'id', 'tenant_id', 'client_nom', 'client_email', 'items', 'montant_ht',
    'tva', 'total', 'statut', 'created_at', 'tiers_id', 'compte_client',
    'type', 'moyen_paiement', 'facture_ref_id', 'devis_id', 'remise_pct',
    'montant_paye', 'client_id', 'avoir_de', 'tva_montant',
    // migration 172 — 8 colonnes
    'invoice_number', 'client_address', 'client_phone', 'date', 'due_date',
    'ca', 'footer_text', 'notes',
  ],
  facture_lignes: ['id', 'invoice_id', 'description', 'price', 'quantity', 'total'],
  devis_lignes:   ['id', 'devis_id', 'description', 'price', 'quantity', 'total'],
  purchases: [
    // migration 016 — 6 colonnes
    'id', 'tenant_id', 'supplier_id', 'montant_total', 'statut', 'created_at',
    // migration 174 — 3 colonnes
    'reference', 'notes', 'date',
  ],
  purchase_items: ['id', 'purchase_id', 'product_id', 'quantite', 'prix'],
}

/**
 * Colonnes écartées lors d'un arbitrage entre deux noms pour une même grandeur.
 * Leur réapparition dans le code est une régression, pas une colonne à créer.
 */
const ARBITRÉES: Record<string, Record<string, string>> = {
  factures: {
    client_name: 'doublon de client_nom',
    subtotal:    'doublon de montant_ht',
  },
  purchases: {
    total_amount: 'doublon de montant_total',
  },
  purchase_items: {
    quantity:   'la colonne est quantite',
    unit_price: 'la colonne est prix',
  },
}

describe.each(Object.keys(SCHEMAS))('CONTRAT DE SCHÉMA — %s', (table) => {
  const columns = new Set(SCHEMAS[table])
  const usages  = collectTableUsages(table)

  it('aucune colonne inconnue du schéma', () => {
    const unknown = usages.filter(u => !columns.has(u.column))
    const detail = unknown.map(u => `${u.file} — ${u.kind}('${u.column}')`).join('\n')
    expect(unknown, `Colonnes absentes de la table ${table} :\n${detail}`).toEqual([])
  })

  it('aucune colonne écartée à l’arbitrage ne réapparaît', () => {
    const forbidden = ARBITRÉES[table] ?? {}
    const revived = usages.filter(u => u.column in forbidden)
    const detail = revived
      .map(u => `${u.file} — ${u.kind}('${u.column}') : ${forbidden[u.column]}`)
      .join('\n')
    expect(revived, `Colonnes arbitrées puis réintroduites :\n${detail}`).toEqual([])
  })
})

describe('CONTRAT DE SCHÉMA — l’analyse trouve bien du code à vérifier', () => {
  it('les tables principales sont effectivement utilisées', () => {
    expect(collectTableUsages('factures').length).toBeGreaterThan(20)
    expect(collectTableUsages('purchases').length).toBeGreaterThan(0)
  })

  it('les colonnes de référence de factures sont bien celles employées', () => {
    const columns = new Set(collectTableUsages('factures').map(u => u.column))
    expect(columns.has('client_nom')).toBe(true)
    expect(columns.has('montant_ht')).toBe(true)
  })
})

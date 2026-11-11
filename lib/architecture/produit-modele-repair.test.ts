/**
 * Architecture regression test — RÉPARATION MODÈLE PRODUIT (BOI-005)
 *
 * Mission P0-BOI-005, docs/BOI-005-AUDIT-MODELE-PRODUIT.md. `products` compte
 * exactement 12 colonnes réelles en production (vérifié en direct, migration
 * 050 — qui ajoutait description/categorie_id/stock_max/fournisseur_id/
 * emplacement/statut/taxe_pct — n'a jamais été appliquée, confirmé par
 * docs/RESTART-AUDIT-AZ.md). Cinq fichiers écrivaient ou filtraient sur tout
 * ou partie de ces 7 colonnes fantômes : stocks/produits, commerce/catalogue,
 * commerce (POS), stocks/alertes, stocks/valorisation.
 *
 * Preuve live (PostgREST, service role, 2026-09-21) :
 *   - insert {..., statut:'actif'} → 400 PGRST204 « Could not find the
 *     'statut' column of 'products' in the schema cache » ;
 *   - insert avec uniquement les 9 colonnes réelles saisissables (tenant_id,
 *     nom, categorie, sku, unite, prix_achat, prix_vente, seuil_alerte) → 201,
 *     ligne créée puis supprimée immédiatement (aucune donnée résiduelle,
 *     10 produits de seed retrouvés après nettoyage).
 *
 * Note méthodologique : `statut` est un nom de colonne légitime ailleurs
 * (purchases.statut, ventes.statut, stock_articles...) — les vérifications
 * ci-dessous se limitent donc au code qui lit/écrit `products` (ou porte un
 * commentaire décrivant explicitement l'écriture retirée), pas à un
 * grep aveugle du mot dans tout le fichier.
 */

import { readFileSync } from 'fs'
import path from 'path'
import { describe, it, expect } from 'vitest'
import { REPO_ROOT, collectTableUsages } from './supabase-usage'

const PHANTOM_COLUMNS = ['categorie_id', 'fournisseur_id', 'stock_max', 'taxe_pct', 'emplacement']

function readCode(rel: string): string {
  // Retire les commentaires // et les blocs /* */ : ce test vérifie le code
  // exécuté, pas la documentation qui nomme volontairement ces colonnes pour
  // expliquer pourquoi elles ont été retirées.
  const src = readFileSync(path.join(REPO_ROOT, rel), 'utf-8').replace(/\r\n/g, '\n')
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .map(l => l.replace(/\/\/.*$/, ''))
    .join('\n')
}

describe('BOI-005 — colonnes définitivement retirées (aucun consommateur légitime)', () => {
  const files = [
    'app/dashboard/stocks/produits/page.tsx',
    'app/dashboard/commerce/catalogue/page.tsx',
    'app/dashboard/stocks/alertes/page.tsx',
    'app/dashboard/stocks/valorisation/page.tsx',
  ]

  it.each(files)('%s ne référence plus categorie_id/fournisseur_id/stock_max/taxe_pct/emplacement', (rel) => {
    const code = readCode(rel)
    const found = PHANTOM_COLUMNS.filter(c => new RegExp(`\\b${c}\\b`).test(code))
    expect(found, `${rel} référence encore : ${found.join(', ')}`).toEqual([])
  })
})

describe('BOI-005 — products.statut / products.description retirés (contexte products uniquement)', () => {
  it('commerce/catalogue : plus de statut ni description sur le produit (form/payload/affichage)', () => {
    const code = readCode('app/dashboard/commerce/catalogue/page.tsx')
    expect(code).not.toMatch(/produit\?\.\s*statut/)
    expect(code).not.toMatch(/form\.statut/)
    expect(code).not.toMatch(/\bSTATUT_COLORS\b/)
    expect(code).not.toMatch(/produit\?\.\s*description/)
    expect(code).not.toMatch(/form\.description/)
  })

  it('commerce (POS) : le select v_products_stock ne filtre plus sur statut', () => {
    const code = readCode('app/dashboard/commerce/page.tsx')
    expect(code).not.toMatch(/v_products_stock[\s\S]{0,120}\.eq\('statut'/)
  })

  it('stocks/produits : le payload products n\'a plus de champ statut/description', () => {
    const code = readCode('app/dashboard/stocks/produits/page.tsx')
    expect(code).not.toMatch(/\bstatut\s*:\s*form\.statut\b/)
    expect(code).not.toMatch(/\bdescription\s*:\s*form\.description\b/)
  })
})

describe('BOI-005 — contrat de schéma products (colonnes littérales)', () => {
  it('products : aucune colonne inconnue dans un select/insert/update en littéral', () => {
    const REAL_COLUMNS = new Set([
      'id', 'tenant_id', 'nom', 'categorie', 'sku', 'code_barre', 'unite',
      'prix_achat', 'prix_vente', 'seuil_alerte', 'image_url', 'created_at',
    ])
    const usages = collectTableUsages('products')
    const unknown = usages.filter(u => !REAL_COLUMNS.has(u.column))
    const detail = unknown.map(u => `${u.file} — ${u.kind}('${u.column}')`).join('\n')
    expect(unknown, `Colonnes absentes de products :\n${detail}`).toEqual([])
  })
})

describe('BOI-005 — catégorie dérivée, pas de nouvelle entité', () => {
  it('stocks/categories n\'instancie plus product_categories comme table (exécution, pas commentaire)', () => {
    const code = readCode('app/dashboard/stocks/categories/page.tsx')
    expect(code).not.toMatch(/from\('product_categories'\)/)
  })

  it('stocks/produits utilise categorie (texte libre) dans le formulaire, pas categorie_id', () => {
    const code = readCode('app/dashboard/stocks/produits/page.tsx')
    expect(code).toContain('form.categorie')
    expect(code).not.toMatch(/form\.categorie_id/)
  })
})

describe('BOI-005 — non-régression achats/stocks (BOI-004 non cassé)', () => {
  it('stocks/achats et /api/stocks/purchases n\'écrivent toujours que des colonnes réelles de products', () => {
    // purchases.statut est un champ réel et légitime (brouillon/commandé/
    // reçu/payé/annulé) — seule products.statut/description/etc. sont visées.
    for (const rel of ['app/dashboard/stocks/achats/page.tsx', 'app/api/stocks/purchases/route.ts']) {
      const code = readCode(rel)
      const found = PHANTOM_COLUMNS.filter(c => new RegExp(`\\b${c}\\b`).test(code))
      expect(found, `${rel} référence : ${found.join(', ')}`).toEqual([])
    }
  })
})

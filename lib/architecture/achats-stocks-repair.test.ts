/**
 * Architecture regression test — RÉPARATION CORE ACHATS + STOCKS (BOI-004)
 *
 * Mission P0-BOI-004, docs/BOI-004-REPAIR-PLAN-ACHATS-STOCKS.md. BOI-003 a
 * trouvé des pages/API référençant des tables qui n'ont jamais existé en base
 * (stock_receptions, stock_reception_items, purchase_orders,
 * purchase_order_items, product_categories) — chaque référence échouait
 * silencieusement (liste vide) ou en erreur dure (INSERT). Ce fichier fige :
 *
 *   1. qu'aucune de ces tables fantômes n'est plus référencée par le code
 *      réparé (caractérisation négative — la régression la plus probable
 *      est qu'une future modification les réintroduise par copier-coller) ;
 *   2. que le nouvel écrivain comptable (/api/stocks/purchases) n'utilise
 *      que le moteur événementiel existant (emit_accounting_event), jamais
 *      une écriture directe dans journal_entries/journal_comptable — sinon
 *      c'est un nouveau writer, ce que la mission interdisait explicitement ;
 *   3. que la transition vers 'reçu' met à jour le stock (fn_stock_move) ET
 *      la comptabilité (ACH-001), sans jamais émettre STK-001 en plus (la
 *      double émission doublerait le crédit fournisseur 401 — voir Étape 7
 *      du plan) ;
 *   4. l'isolation tenant sur le nouvel écrivain.
 */

import { readFileSync } from 'fs'
import { sync as globSync } from 'glob'
import path from 'path'
import { describe, it, expect } from 'vitest'
import { REPO_ROOT } from './supabase-usage'

const PHANTOM_TABLES = [
  'stock_receptions',
  'stock_reception_items',
  'purchase_orders',
  'purchase_order_items',
  'product_categories',
]

function read(rel: string): string {
  return readFileSync(path.join(REPO_ROOT, rel), 'utf-8')
}

describe('BOI-004 — aucune table fantôme référencée', () => {
  const scannedFiles = [
    'app/api/stock/reception/route.ts',
    'app/api/stocks/purchases/route.ts',
    'app/dashboard/stocks/receptions/page.tsx',
    'app/dashboard/stocks/commandes/page.tsx',
    'app/dashboard/stocks/categories/page.tsx',
    'app/dashboard/stocks/achats/page.tsx',
    'app/dashboard/stocks/produits/page.tsx',
  ]

  it.each(scannedFiles)('%s ne référence aucune table fantôme', (rel) => {
    const src = read(rel)
    const found = PHANTOM_TABLES.filter(t => src.includes(`'${t}'`) || src.includes(`"${t}"`))
    expect(found, `${rel} référence encore : ${found.join(', ')}`).toEqual([])
  })

  it('aucune table fantôme dans tout app/dashboard/stocks et app/api/stock*', () => {
    const files = [
      ...globSync('app/dashboard/stocks/**/*.tsx', { cwd: REPO_ROOT, absolute: false }),
      ...globSync('app/api/stock*/**/*.ts', { cwd: REPO_ROOT, absolute: false }),
    ]
    const offenders: string[] = []
    for (const rel of files) {
      const src = read(rel)
      for (const t of PHANTOM_TABLES) {
        if (src.includes(`'${t}'`) || src.includes(`"${t}"`)) offenders.push(`${rel} → ${t}`)
      }
    }
    expect(offenders, offenders.join('\n')).toEqual([])
  })
})

describe('BOI-004 — /api/stocks/purchases : un seul writer comptable, aucun nouveau mécanisme', () => {
  const src = read('app/api/stocks/purchases/route.ts')

  it('utilise emit_accounting_event, jamais une écriture directe journal_entries/journal_comptable', () => {
    expect(src).toContain("rpc('emit_accounting_event'")
    expect(src).not.toContain("from('journal_entries')")
    expect(src).not.toContain("from('journal_comptable')")
    // writeComptaEntry peut être cité en commentaire (pour expliquer qu'il
    // n'est plus utilisé) — la preuve fiable est l'absence d'import du module.
    expect(src).not.toContain("from '@/lib/compta-sync-client'")
  })

  it('émet ACH-001 à la réception et ACH-002 au paiement, jamais STK-001', () => {
    expect(src).toContain("p_event_type:    'ACH-001'")
    expect(src).toContain("p_event_type:    'ACH-002'")
    // STK-001 peut être mentionné en commentaire (pour expliquer pourquoi il
    // n'est pas câblé) mais ne doit jamais être émis comme p_event_type.
    expect(src).not.toMatch(/p_event_type:\s*'STK-001'/)
  })

  it('la réception physique (fn_stock_move) et la comptabilité (ACH-001) sont toutes deux déclenchées par la même transition', () => {
    const receptionBlock = src.slice(src.indexOf("statut === 'reçu'"), src.indexOf("if (statut === 'payé')"))
    expect(receptionBlock).toContain("rpc('fn_stock_move'")
    expect(receptionBlock).toContain("p_event_type:    'ACH-001'")
  })

  it('toute lecture/écriture sur un achat existant est filtrée par tenant_id (isolation)', () => {
    expect(src.match(/\.eq\('tenant_id', ctx\.tenantId\)/g)?.length ?? 0).toBeGreaterThanOrEqual(2)
  })
})

describe('BOI-004 — dépréciation legacy documentée, pas supprimée', () => {
  it('achats/fournisseurs (legacy) reste fonctionnel, marqué DEPRECATE', () => {
    const page = read('app/dashboard/achats/page.tsx')
    const api  = read('app/api/achats/route.ts')
    expect(page).toContain('DEPRECATE')
    expect(api).toContain('DEPRECATE')
    // Le writer legacy continue d'émettre ACH-001/002 — non retiré, seulement
    // retiré de la navigation principale (vérifié séparément ci-dessous).
    expect(api).toContain("p_event_type:    'ACH-001'")
    expect(api).toContain("p_event_type:    'ACH-002'")
  })

  it('aucun lien de navigation principal ne pointe plus vers /dashboard/achats', () => {
    const navFiles = [
      'lib/erp-sectors.ts',
      'components/dashboard/DashboardClient.tsx',
      // refonte 2026-11 : pages boisson/btp/agriculture/petrole supprimées
    ]
    for (const rel of navFiles) {
      const src = read(rel)
      expect(src, `${rel} pointe encore vers /dashboard/achats`).not.toMatch(/href:\s*'\/dashboard\/achats'/)
    }
  })
})

describe('BOI-004 — réception = transition de statut, pas une entité créée séparément', () => {
  it('POST /api/stock/reception ne crée plus de réception autonome (délègue à /api/stocks/purchases)', () => {
    const src = read('app/api/stock/reception/route.ts')
    expect(src).toContain('/api/stocks/purchases')
    expect(src).not.toContain(".from('stock_receptions')")
  })

  it('la page réceptions est en lecture seule (aucune création de réception)', () => {
    const src = read('app/dashboard/stocks/receptions/page.tsx')
    expect(src).not.toContain('showCreate')
    expect(src).not.toContain("method:  'POST'")
  })
})

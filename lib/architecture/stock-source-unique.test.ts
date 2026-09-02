/**
 * Architecture regression test — SOURCE UNIQUE DU STOCK (ANO-C03)
 *
 * La quantité en stock est la somme des mouvements. Trois règles en découlent,
 * et chacune correspond à un défaut réel constaté en production :
 *
 *   1. products.stock_actuel n'existe pas et n'a jamais existé. 14 pages la
 *      lisaient, 7 sites la réécrivaient. Comme ces pages font select('*'),
 *      PostgREST ne renvoyait aucune erreur : le hub Stocks affichait 0 produit
 *      et 0 franc, et une rupture de stock s'affichait comme un stock sain.
 *      La lecture passe par la vue v_products_stock (migration 173).
 *
 *   2. stock_movements porte quantite, pas quantity. 12 sites employaient le
 *      nom anglais, dont la page Mouvements qui affichait donc 0 entrée et
 *      0 sortie alors que 96 mouvements existent.
 *
 *   3. stock_movements ne s'écrit que par fn_stock_move, qui pose un verrou et
 *      refuse le stock négatif. Un contrôle lu puis écrit depuis le navigateur
 *      laisse passer deux sorties simultanées.
 */

import { readFileSync } from 'fs'
import { sync as globSync } from 'glob'
import { describe, it, expect } from 'vitest'
import path from 'path'
import { collectTableUsages, REPO_ROOT } from './supabase-usage'

describe('STOCK — products ne porte aucune quantité', () => {
  const usages = collectTableUsages('products')

  it('trouve bien les accès à la table products', () => {
    expect(usages.length).toBeGreaterThan(5)
  })

  it('aucune lecture ni écriture de stock_actuel sur products', () => {
    const faulty = usages.filter(u => u.column === 'stock_actuel')
    const detail = faulty
      .map(u => `${u.file} — ${u.kind}('stock_actuel')`)
      .join('\n')
    expect(
      faulty,
      `products.stock_actuel n'existe pas. Lire v_products_stock, écrire par fn_stock_move :\n${detail}`,
    ).toEqual([])
  })
})

describe('STOCK — stock_movements porte quantite', () => {
  const usages = collectTableUsages('stock_movements')

  it('aucun usage de la colonne quantity', () => {
    const faulty = usages.filter(u => u.column === 'quantity')
    const detail = faulty.map(u => `${u.file} — ${u.kind}('quantity')`).join('\n')
    expect(faulty, `La colonne est quantite (migration 016) :\n${detail}`).toEqual([])
  })

  it('aucune insertion directe : fn_stock_move est le seul point d’écriture', () => {
    const written = usages.filter(u => u.kind === 'insert')
    const files = [...new Set(written.map(u => u.file))].join('\n')
    expect(
      written,
      `Insertion directe dans stock_movements. Passer par supabase.rpc('fn_stock_move') :\n${files}`,
    ).toEqual([])
  })
})

describe('STOCK — la vue est bien celle qui est lue', () => {
  it('au moins une page lit v_products_stock', () => {
    const files = ['app/**/*.tsx', 'app/**/*.ts'].flatMap(g =>
      globSync(g, { cwd: REPO_ROOT, ignore: ['**/node_modules/**', '**/.next/**'], absolute: false }),
    )
    const readers = files.filter(f =>
      readFileSync(path.join(REPO_ROOT, f), 'utf-8').includes("from('v_products_stock')"),
    )
    expect(readers.length).toBeGreaterThan(10)
  })
})

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

import { readFileSync } from 'fs'
import { sync as globSync } from 'glob'
import { describe, it, expect } from 'vitest'
import path from 'path'

const ROOT = path.resolve(__dirname, '../..')

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

const SOURCE_GLOBS = ['app/**/*.ts', 'app/**/*.tsx', 'lib/**/*.ts', 'components/**/*.tsx']
const IGNORED = ['**/node_modules/**', '**/.next/**', 'lib/architecture/**']

type Usage = { file: string; kind: 'select' | 'insert' | 'update'; column: string }

/** Contenu équilibré à partir d'une accolade ouvrante. */
function balanced(src: string, start: number): string {
  let depth = 0
  for (let i = start; i < src.length; i++) {
    if (src[i] === '{') depth++
    else if (src[i] === '}') {
      depth--
      if (depth === 0) return src.slice(start + 1, i)
    }
  }
  return ''
}

/** Clés de premier niveau d'un littéral objet, forme `k:` comme forme abrégée `k,`. */
function topLevelKeys(objectBody: string): string[] {
  const keys: string[] = []
  let depth = 0
  let current = ''
  const flush = () => {
    if (!current.trimStart().startsWith('...')) {
      const m = current.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*(:|$)/)
      if (m) keys.push(m[1])
    }
    current = ''
  }
  for (const ch of objectBody) {
    if ('{[('.includes(ch)) depth++
    else if ('}])'.includes(ch)) depth--
    if (ch === ',' && depth === 0) { flush(); continue }
    current += ch
  }
  flush()
  return keys
}

/**
 * Colonnes de `factures` touchées par le code applicatif.
 *
 * Dans une chaîne Supabase, la méthode qui porte les colonnes suit
 * IMMÉDIATEMENT le from() : select, insert, update ou upsert. Les .eq() et
 * autres viennent après. S'ancrer sur cet appel évite de ramasser les requêtes
 * d'une autre table plus loin dans la même fonction.
 */
function collectUsages(): Usage[] {
  const usages: Usage[] = []
  const files = SOURCE_GLOBS.flatMap(g => globSync(g, { cwd: ROOT, ignore: IGNORED, absolute: false }))
  const MARKER = "from('factures')"

  for (const rel of files) {
    const src = readFileSync(path.join(ROOT, rel), 'utf-8')
    let idx = src.indexOf(MARKER)

    while (idx !== -1) {
      const after = src.slice(idx + MARKER.length)
      const head  = after.match(/^\s*\.(select|insert|update|upsert)\(/)

      if (head) {
        const kind  = (head[1] === 'upsert' ? 'insert' : head[1]) as Usage['kind']
        const paren = head[0].length - 1

        if (head[1] === 'select') {
          const sel = after.slice(paren).match(/^\(\s*(['"`])([^'"`]*)\1/)
          if (sel && !sel[2].includes('*')) {
            for (const token of sel[2].split(',').map(c => c.trim()).filter(Boolean)) {
              // Ressource imbriquée PostgREST : porte sur une autre table.
              if (token.includes('(') || token.includes(')')) continue
              // Alias PostgREST « alias:colonne » : seule la colonne compte.
              const column = token.includes(':') ? token.split(':').pop()!.trim() : token
              usages.push({ file: rel, kind: 'select', column })
            }
          }
        } else {
          const objStart = after.indexOf('{', paren)
          // Uniquement un littéral objet collé à l'appel : un payload passé par
          // variable n'est pas analysable statiquement.
          if (objStart !== -1 && after.slice(paren + 1, objStart).trim() === '') {
            for (const key of topLevelKeys(balanced(after, objStart))) {
              usages.push({ file: rel, kind, column: key })
            }
          }
        }
      }

      idx = src.indexOf(MARKER, idx + 1)
    }
  }
  return usages
}

describe('SCHÉMA FACTURES — le code ne touche que des colonnes qui existent', () => {
  const usages = collectUsages()

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

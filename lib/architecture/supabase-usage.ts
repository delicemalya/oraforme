/**
 * Analyse statique des accès Supabase, pour les tests d'architecture.
 *
 * Extrait les colonnes qu'une table donnée reçoit ou fournit dans le code
 * applicatif. Sert aux tests qui comparent le code au schéma réel, la classe
 * de défaut qui a rendu la facturation (ANO-C02) et le module Stocks (ANO-C03)
 * inopérants pendant des mois sans qu'aucun outil ne le signale.
 *
 * Dans une chaîne Supabase, la méthode qui porte les colonnes suit
 * IMMÉDIATEMENT le from() : select, insert, update ou upsert. Les .eq() et
 * autres viennent après. S'ancrer sur cet appel évite de ramasser les requêtes
 * d'une autre table plus loin dans la même fonction.
 */

import { readFileSync } from 'fs'
import { sync as globSync } from 'glob'
import path from 'path'

export const REPO_ROOT = path.resolve(__dirname, '../..')

const SOURCE_GLOBS = ['app/**/*.ts', 'app/**/*.tsx', 'lib/**/*.ts', 'components/**/*.tsx']
const IGNORED = ['**/node_modules/**', '**/.next/**', 'lib/architecture/**']

export type UsageKind = 'select' | 'insert' | 'update'
export type Usage = { file: string; kind: UsageKind; column: string }

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

/** Colonnes de `table` lues ou écrites par le code applicatif. */
export function collectTableUsages(table: string): Usage[] {
  const usages: Usage[] = []
  const files = SOURCE_GLOBS.flatMap(g => globSync(g, { cwd: REPO_ROOT, ignore: IGNORED, absolute: false }))
  const marker = `from('${table}')`

  for (const rel of files) {
    const src = readFileSync(path.join(REPO_ROOT, rel), 'utf-8')
    let idx = src.indexOf(marker)

    while (idx !== -1) {
      const after = src.slice(idx + marker.length)
      const head  = after.match(/^\s*\.(select|insert|update|upsert)\(/)

      if (head) {
        const kind  = (head[1] === 'upsert' ? 'insert' : head[1]) as UsageKind
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

      idx = src.indexOf(marker, idx + 1)
    }
  }
  return usages
}

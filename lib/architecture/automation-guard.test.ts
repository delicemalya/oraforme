/**
 * Architecture regression test — AUTOMATION GUARD (ANO-C01)
 *
 * Le proxy exempte certains chemins du garde de session parce qu'ils sont appelés
 * par Vercel Cron ou par pg_cron, sans navigateur. Cette exemption n'est légitime
 * que si le handler valide lui-même un secret.
 *
 * Le commit 81e9302 avait ajouté l'exemption en supposant que c'était le cas.
 * Ce n'était vrai que pour 5 chemins sur 15 : les 10 autres sont devenus
 * publiquement appelables, dont la clôture restaurant qui écrit avec la clé
 * service_role sur tous les tenants.
 *
 * Ce test fait échouer la CI si :
 *   1. un chemin exempté par le proxy n'appelle pas requireAutomationSecret()
 *   2. une tâche cron de vercel.json pointe sur une route sans ce garde
 *   3. une route réimplémente sa propre vérification de CRON_SECRET
 */

import { existsSync, readFileSync } from 'fs'
import { describe, it, expect } from 'vitest'
import path from 'path'

const ROOT = path.resolve(__dirname, '../..')

const GUARD_CALL = 'requireAutomationSecret('
/** Seul fichier autorisé à lire les secrets d'automatisation. */
const GUARD_MODULE = path.join('lib', 'api', 'require-automation.ts')

function read(rel: string): string {
  return readFileSync(path.join(ROOT, rel), 'utf-8')
}

/** Chemin d'API → fichier de route Next.js */
function routeFile(apiPath: string): string {
  return path.join('app', apiPath.replace(/^\//, '').split('/').join(path.sep), 'route.ts')
}

/** Extrait les chemins littéraux du Set AUTOMATION_PATHS de proxy.ts */
function automationPaths(): string[] {
  const src = read('proxy.ts')
  const block = src.match(/const AUTOMATION_PATHS = new Set\(\[([\s\S]*?)\]\)/)
  if (!block) throw new Error('AUTOMATION_PATHS introuvable dans proxy.ts')
  return [...block[1].matchAll(/'([^']+)'/g)].map(m => m[1])
}

/** Chemins déclarés dans vercel.json → crons[] */
function cronPaths(): string[] {
  const cfg = JSON.parse(read('vercel.json')) as { crons?: { path: string }[] }
  return (cfg.crons ?? []).map(c => c.path)
}

describe('AUTOMATION GUARD — exemptions du proxy', () => {
  const paths = automationPaths()

  it('le Set AUTOMATION_PATHS n’est pas vide', () => {
    expect(paths.length).toBeGreaterThan(0)
  })

  it.each(paths)('%s appelle requireAutomationSecret()', (apiPath) => {
    const file = routeFile(apiPath)
    expect(existsSync(path.join(ROOT, file)), `${file} n'existe pas`).toBe(true)
    expect(read(file), `${file} est exempté du garde de session sans valider de secret`)
      .toContain(GUARD_CALL)
  })
})

describe('AUTOMATION GUARD — tâches planifiées Vercel', () => {
  it.each(cronPaths())('%s appelle requireAutomationSecret()', (apiPath) => {
    const file = routeFile(apiPath)
    expect(existsSync(path.join(ROOT, file)), `${file} n'existe pas`).toBe(true)
    expect(read(file), `${file} est déclenchée par cron sans valider de secret`)
      .toContain(GUARD_CALL)
  })
})

describe('AUTOMATION GUARD — pas de garde maison', () => {
  const paths = [...new Set([...automationPaths(), ...cronPaths()])]

  it.each(paths)('%s ne relit pas CRON_SECRET / AUTOMATION_SECRET directement', (apiPath) => {
    const file = routeFile(apiPath)
    if (file === GUARD_MODULE) return
    const src = read(file)
    expect(src, `${file} réimplémente le garde — utiliser lib/api/require-automation`)
      .not.toMatch(/process\.env\.(CRON_SECRET|AUTOMATION_SECRET)/)
  })
})

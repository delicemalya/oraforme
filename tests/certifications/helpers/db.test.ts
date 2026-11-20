/**
 * Tests déterministes — tests/certifications/helpers/db.ts (ticket
 * P0CRIT01-PLAYWRIGHT-DB-HELPER). Aucune connexion Supabase réelle : `fetch`
 * n'est jamais appelé dans ces tests (le garde refuse ou les valeurs restent
 * des chaînes factices — aucune fonction réseau n'est invoquée).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { KNOWN_PRODUCTION_SUPABASE_URL } from '../../../scripts/lib/seed-production-guard'

const RECETTE_URL = 'https://recette-abcdefghij.supabase.co'

const BASE_ENV: Record<string, string> = {
  NEXT_PUBLIC_SUPABASE_URL: RECETTE_URL,
  SUPABASE_SERVICE_ROLE_KEY: 'dummy-service-key-for-tests',
  NODE_ENV: 'test',
}

let savedEnv: NodeJS.ProcessEnv

beforeEach(() => {
  savedEnv = { ...process.env }
  vi.resetModules()
})

afterEach(() => {
  process.env = savedEnv
})

function setEnv(overrides: Record<string, string | undefined>) {
  for (const key of ['SEED_TARGET_ENV', 'VERCEL_ENV', 'NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'NODE_ENV']) {
    delete process.env[key]
  }
  for (const [k, v] of Object.entries({ ...BASE_ENV, ...overrides })) {
    if (v !== undefined) process.env[k] = v
  }
}

async function loadModule() {
  return import('./db')
}

describe('db.ts — (A) configuration recette autorisée', () => {
  it("n'échoue pas à l'import quand SEED_TARGET_ENV=recette et l'URL n'est pas la production", async () => {
    setEnv({ SEED_TARGET_ENV: 'recette' })
    await expect(loadModule()).resolves.toBeDefined()
  })
})

describe('db.ts — (B) URL Supabase de production refusée', () => {
  it("refuse même avec SEED_TARGET_ENV=recette", async () => {
    setEnv({ SEED_TARGET_ENV: 'recette', NEXT_PUBLIC_SUPABASE_URL: KNOWN_PRODUCTION_SUPABASE_URL })
    await expect(loadModule()).rejects.toThrow(/GARDE-FOU PRODUCTION/)
  })
})

describe('db.ts — (C) VERCEL_ENV=production refusé', () => {
  it('refuse même avec SEED_TARGET_ENV=recette', async () => {
    setEnv({ SEED_TARGET_ENV: 'recette', VERCEL_ENV: 'production' })
    await expect(loadModule()).rejects.toThrow(/GARDE-FOU PRODUCTION/)
  })
})

describe('db.ts — (D) SEED_TARGET_ENV absent refusé (fail-closed)', () => {
  it('refuse quand SEED_TARGET_ENV est absent', async () => {
    setEnv({ SEED_TARGET_ENV: undefined })
    await expect(loadModule()).rejects.toThrow(/GARDE-FOU PRODUCTION/)
  })

  it('refuse pour une valeur inconnue', async () => {
    setEnv({ SEED_TARGET_ENV: 'staging' })
    await expect(loadModule()).rejects.toThrow(/GARDE-FOU PRODUCTION/)
  })
})

describe('db.ts — (E) variables Supabase manquantes détectées après le garde', () => {
  it('signale NEXT_PUBLIC_SUPABASE_URL manquant', async () => {
    setEnv({ SEED_TARGET_ENV: 'recette', NEXT_PUBLIC_SUPABASE_URL: undefined })
    await expect(loadModule()).rejects.toThrow(/NEXT_PUBLIC_SUPABASE_URL manquant/)
  })

  it('signale SUPABASE_SERVICE_ROLE_KEY manquant', async () => {
    setEnv({ SEED_TARGET_ENV: 'recette', SUPABASE_SERVICE_ROLE_KEY: undefined })
    await expect(loadModule()).rejects.toThrow(/SUPABASE_SERVICE_ROLE_KEY manquant/)
  })
})

describe('db.ts — aucun secret de production codé en dur', () => {
  it("le fichier source ne contient plus l'URL de production en littéral", async () => {
    const fs = await import('fs')
    const path = await import('path')
    const src = fs.readFileSync(path.resolve(__dirname, 'db.ts'), 'utf-8')
    expect(src).not.toContain(KNOWN_PRODUCTION_SUPABASE_URL)
    expect(src).toMatch(/process\.env\.NEXT_PUBLIC_SUPABASE_URL/)
    expect(src).toMatch(/assertSeedTargetIsNotProduction/)
  })
})

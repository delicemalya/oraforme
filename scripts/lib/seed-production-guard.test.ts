/**
 * Tests déterministes — garde-fou production des scripts de seed (R006-SEED-SCRIPT-NO-GUARD).
 * Aucune connexion Supabase réelle : la fonction testée est pure (aucune I/O).
 */

import { existsSync, readFileSync } from 'fs'
import { describe, it, expect } from 'vitest'
import path from 'path'
import {
  assertSeedTargetIsNotProduction,
  ProductionSeedGuardError,
  KNOWN_PRODUCTION_SUPABASE_URL,
  type SeedGuardEnv,
} from './seed-production-guard'

const RECETTE_URL = 'https://recette-abcdefghij.supabase.co'

describe('assertSeedTargetIsNotProduction — (A) recette/dev autorisés', () => {
  const cases: SeedGuardEnv[] = [
    { SEED_TARGET_ENV: 'recette',     NEXT_PUBLIC_SUPABASE_URL: RECETTE_URL },
    { SEED_TARGET_ENV: 'development', NEXT_PUBLIC_SUPABASE_URL: RECETTE_URL },
    { SEED_TARGET_ENV: 'local',       NEXT_PUBLIC_SUPABASE_URL: RECETTE_URL },
    { SEED_TARGET_ENV: 'test',        NEXT_PUBLIC_SUPABASE_URL: RECETTE_URL },
  ]

  it.each(cases)('ne lève pas pour %j', (env) => {
    expect(() => assertSeedTargetIsNotProduction(env)).not.toThrow()
  })
})

describe('assertSeedTargetIsNotProduction — (B) production explicitement refusée', () => {
  it('SEED_TARGET_ENV="production" est refusé, même avec une URL non-production', () => {
    expect(() =>
      assertSeedTargetIsNotProduction({ SEED_TARGET_ENV: 'production', NEXT_PUBLIC_SUPABASE_URL: RECETTE_URL })
    ).toThrow(ProductionSeedGuardError)
  })

  it('VERCEL_ENV="production" est refusé même si SEED_TARGET_ENV="recette"', () => {
    expect(() =>
      assertSeedTargetIsNotProduction({
        SEED_TARGET_ENV: 'recette',
        NEXT_PUBLIC_SUPABASE_URL: RECETTE_URL,
        VERCEL_ENV: 'production',
      })
    ).toThrow(ProductionSeedGuardError)
  })
})

describe('assertSeedTargetIsNotProduction — (C) URL Supabase de production prioritaire', () => {
  it('refuse même si SEED_TARGET_ENV="development" et NODE_ENV="development"', () => {
    expect(() =>
      assertSeedTargetIsNotProduction({
        SEED_TARGET_ENV: 'development',
        NODE_ENV: 'development',
        NEXT_PUBLIC_SUPABASE_URL: KNOWN_PRODUCTION_SUPABASE_URL,
      })
    ).toThrow(ProductionSeedGuardError)
  })

  it('détecte la correspondance malgré une casse ou un slash final différents', () => {
    expect(() =>
      assertSeedTargetIsNotProduction({
        SEED_TARGET_ENV: 'recette',
        NEXT_PUBLIC_SUPABASE_URL: KNOWN_PRODUCTION_SUPABASE_URL.toUpperCase() + '/',
      })
    ).toThrow(ProductionSeedGuardError)
  })
})

describe('assertSeedTargetIsNotProduction — (D) configuration ambiguë refusée par défaut', () => {
  const cases: SeedGuardEnv[] = [
    { NEXT_PUBLIC_SUPABASE_URL: RECETTE_URL }, // SEED_TARGET_ENV absent
    { SEED_TARGET_ENV: '', NEXT_PUBLIC_SUPABASE_URL: RECETTE_URL },
    { SEED_TARGET_ENV: 'staging', NEXT_PUBLIC_SUPABASE_URL: RECETTE_URL }, // valeur inconnue
    { SEED_TARGET_ENV: 'prod', NEXT_PUBLIC_SUPABASE_URL: RECETTE_URL },   // faute/variante non reconnue
  ]

  it.each(cases)('refuse (fail-closed) pour %j', (env) => {
    expect(() => assertSeedTargetIsNotProduction(env)).toThrow(ProductionSeedGuardError)
  })

  it('NODE_ENV="development" seul ne suffit jamais à autoriser (SEED_TARGET_ENV absent)', () => {
    expect(() =>
      assertSeedTargetIsNotProduction({ NODE_ENV: 'development', NEXT_PUBLIC_SUPABASE_URL: RECETTE_URL })
    ).toThrow(ProductionSeedGuardError)
  })
})

describe('scripts/seed-demo-data.ts — (E) le garde s\'exécute avant toute opération DB', () => {
  const ROOT = path.resolve(__dirname, '../..')
  const SEED_FILE = path.join(ROOT, 'scripts', 'seed-demo-data.ts')

  it('le fichier existe', () => {
    expect(existsSync(SEED_FILE)).toBe(true)
  })

  it('appelle assertSeedTargetIsNotProduction avant createClient(', () => {
    const src = readFileSync(SEED_FILE, 'utf-8')
    const guardIdx = src.indexOf('assertSeedTargetIsNotProduction(')
    const clientIdx = src.indexOf('createClient(')
    expect(guardIdx, 'assertSeedTargetIsNotProduction( absent du script').toBeGreaterThan(-1)
    expect(clientIdx, 'createClient( absent du script').toBeGreaterThan(-1)
    expect(guardIdx).toBeLessThan(clientIdx)
  })

  it('importe le garde depuis ./lib/seed-production-guard', () => {
    const src = readFileSync(SEED_FILE, 'utf-8')
    expect(src).toMatch(/from ['"]\.\/lib\/seed-production-guard['"]/)
  })
})

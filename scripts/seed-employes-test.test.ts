/**
 * Tests déterministes — scripts/seed-employes-test.ts (ticket
 * P0A-SEED-EMPLOYES-TEST-HARDCODED-PROD). Aucune connexion Supabase réelle :
 * @supabase/supabase-js et dotenv sont mockés ; le garde de production réutilisé
 * (scripts/lib/seed-production-guard.ts) est, lui, la vraie implémentation.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { KNOWN_PRODUCTION_SUPABASE_URL } from './lib/seed-production-guard'

const RECETTE_URL = 'https://recette-abcdefghij.supabase.co'

const createClientMock = vi.hoisted(() => vi.fn())

vi.mock('@supabase/supabase-js', () => ({ createClient: createClientMock }))
vi.mock('dotenv', () => ({ config: vi.fn() }))

class ExitCalled extends Error {
  code?: number
  constructor(code?: number) {
    super(`process.exit(${code})`)
    this.code = code
  }
}

function fakeSupabaseClient(callLog: string[]) {
  return {
    from: () => ({
      delete: () => ({
        eq: () => ({
          in: async () => {
            callLog.push('delete')
            return { error: null }
          },
        }),
      }),
      insert: () => ({
        select: () => ({
          single: async () => {
            callLog.push('insert')
            return { data: { id: 'x', nom: 'X', prenom: 'Y', poste: 'Z', salaire_base: 1 }, error: null }
          },
        }),
      }),
    }),
  }
}

const BASE_ENV: Record<string, string> = {
  NEXT_PUBLIC_SUPABASE_URL: RECETTE_URL,
  SUPABASE_SERVICE_ROLE_KEY: 'dummy-service-key-for-tests',
  NODE_ENV: 'test',
}

let savedEnv: NodeJS.ProcessEnv
let exitSpy: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  savedEnv = { ...process.env }
  exitSpy = vi.spyOn(process, 'exit').mockImplementation(((code?: number) => {
    throw new ExitCalled(code)
  }) as never)
  createClientMock.mockReset()
  vi.resetModules()
})

afterEach(() => {
  process.env = savedEnv
  exitSpy.mockRestore()
})

/** Applique BASE_ENV puis les overrides ; une valeur `undefined` supprime la clé. */
function setEnv(overrides: Record<string, string | undefined>) {
  for (const key of ['SEED_TARGET_ENV', 'VERCEL_ENV', 'NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'NODE_ENV']) {
    delete process.env[key]
  }
  for (const [k, v] of Object.entries({ ...BASE_ENV, ...overrides })) {
    if (v !== undefined) process.env[k] = v
  }
}

async function loadModule() {
  return import('./seed-employes-test')
}

describe('seed-employes-test — (1) configuration recette autorisée', () => {
  it('exécute delete puis 5 insert quand SEED_TARGET_ENV=recette', async () => {
    setEnv({ SEED_TARGET_ENV: 'recette' })
    const callLog: string[] = []
    createClientMock.mockReturnValue(fakeSupabaseClient(callLog))
    const mod = await loadModule()
    await mod.main()
    expect(createClientMock).toHaveBeenCalledTimes(1)
    expect(callLog[0]).toBe('delete')
    expect(callLog.filter((c) => c === 'insert')).toHaveLength(5)
  })
})

describe('seed-employes-test — (2) URL Supabase de production refusée', () => {
  it("refuse et n'appelle jamais createClient, même avec SEED_TARGET_ENV=recette", async () => {
    setEnv({ SEED_TARGET_ENV: 'recette', NEXT_PUBLIC_SUPABASE_URL: KNOWN_PRODUCTION_SUPABASE_URL })
    const mod = await loadModule()
    await expect(mod.main()).rejects.toThrow(ExitCalled)
    expect(createClientMock).not.toHaveBeenCalled()
  })
})

describe('seed-employes-test — (3) VERCEL_ENV=production refusé', () => {
  it("refuse même avec SEED_TARGET_ENV=recette", async () => {
    setEnv({ SEED_TARGET_ENV: 'recette', VERCEL_ENV: 'production' })
    const mod = await loadModule()
    await expect(mod.main()).rejects.toThrow(ExitCalled)
    expect(createClientMock).not.toHaveBeenCalled()
  })
})

describe('seed-employes-test — (4) NODE_ENV=production refusé', () => {
  it("refuse même avec SEED_TARGET_ENV=recette", async () => {
    setEnv({ SEED_TARGET_ENV: 'recette', NODE_ENV: 'production' })
    const mod = await loadModule()
    await expect(mod.main()).rejects.toThrow(ExitCalled)
    expect(createClientMock).not.toHaveBeenCalled()
  })
})

describe('seed-employes-test — (5) SEED_TARGET_ENV absent refusé', () => {
  it('refuse (fail-closed)', async () => {
    setEnv({ SEED_TARGET_ENV: undefined })
    const mod = await loadModule()
    await expect(mod.main()).rejects.toThrow(ExitCalled)
    expect(createClientMock).not.toHaveBeenCalled()
  })
})

describe('seed-employes-test — (6) SEED_TARGET_ENV invalide refusé', () => {
  it('refuse pour une valeur inconnue (ex. "staging")', async () => {
    setEnv({ SEED_TARGET_ENV: 'staging' })
    const mod = await loadModule()
    await expect(mod.main()).rejects.toThrow(ExitCalled)
    expect(createClientMock).not.toHaveBeenCalled()
  })
})

describe("seed-employes-test — (7) l'import seul ne déclenche aucune opération destructive", () => {
  it("importer le module sans appeler main() n'appelle ni createClient ni delete/insert", async () => {
    setEnv({ SEED_TARGET_ENV: 'recette' })
    const callLog: string[] = []
    createClientMock.mockReturnValue(fakeSupabaseClient(callLog))
    await loadModule() // pas d'appel à mod.main()
    expect(createClientMock).not.toHaveBeenCalled()
    expect(callLog).toEqual([])
  })
})

describe("seed-employes-test — (8) delete uniquement après validation de l'environnement", () => {
  it('le premier appel enregistré est delete, avant tout insert', async () => {
    setEnv({ SEED_TARGET_ENV: 'recette' })
    const callLog: string[] = []
    createClientMock.mockReturnValue(fakeSupabaseClient(callLog))
    const mod = await loadModule()
    await mod.main()
    expect(callLog.indexOf('delete')).toBe(0)
    expect(callLog.indexOf('delete')).toBeLessThan(callLog.indexOf('insert'))
  })

  it('en cas de refus du garde, ni createClient ni delete/insert ne sont jamais appelés', async () => {
    setEnv({ SEED_TARGET_ENV: undefined })
    const callLog: string[] = []
    createClientMock.mockReturnValue(fakeSupabaseClient(callLog))
    const mod = await loadModule()
    await expect(mod.main()).rejects.toThrow(ExitCalled)
    expect(createClientMock).not.toHaveBeenCalled()
    expect(callLog).toEqual([])
  })
})

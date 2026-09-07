/**
 * Garde-fou production pour les scripts de seed/démo (ticket R006-SEED-SCRIPT-NO-GUARD).
 *
 * Règle : un script de seed ne doit JAMAIS pouvoir écrire dans le projet Supabase de
 * production, quelle que soit la configuration locale de qui l'exécute.
 *
 * Aucune variable d'environnement ne désactive ce garde. Deux signaux sont non
 * contournables (URL Supabase de production connue, contexte plateforme production) et
 * s'appliquent même si l'appelant prétend être en développement. Un troisième signal est
 * une déclaration explicite obligatoire, refusée par défaut si absente ou ambiguë
 * (fail-closed) — ce n'est pas un interrupteur qui « désactive » la protection, c'est une
 * condition requise en plus des deux premiers, qui ne peuvent pas être satisfaits par elle.
 */

/**
 * Référence du projet Supabase de production connu. Ce n'est PAS un secret : cette URL
 * est publique par construction (variable NEXT_PUBLIC_*, expédiée dans le bundle client,
 * visible dans toute requête réseau du navigateur). Elle sert uniquement de comparaison
 * de blocage — aucune clé n'est stockée ici.
 */
export const KNOWN_PRODUCTION_SUPABASE_URL = 'https://mrzixapnaqsbqmagivvf.supabase.co'

const ALLOWED_SEED_TARGET_ENVS = ['development', 'local', 'recette', 'test'] as const
type AllowedSeedTargetEnv = (typeof ALLOWED_SEED_TARGET_ENVS)[number]

export interface SeedGuardEnv {
  SEED_TARGET_ENV?: string
  NEXT_PUBLIC_SUPABASE_URL?: string
  VERCEL_ENV?: string
  NODE_ENV?: string
}

export class ProductionSeedGuardError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ProductionSeedGuardError'
  }
}

function normalizeUrl(u: string): string {
  return u.trim().replace(/\/+$/, '').toLowerCase()
}

function isAllowedTargetEnv(value: string): value is AllowedSeedTargetEnv {
  return (ALLOWED_SEED_TARGET_ENVS as readonly string[]).includes(value)
}

/**
 * Lève ProductionSeedGuardError si l'environnement décrit par `env` pourrait être la
 * production. Doit être appelée avant toute création de client Supabase et avant toute
 * lecture/écriture réseau. Ne fait elle-même aucune opération réseau ou disque.
 */
export function assertSeedTargetIsNotProduction(env: SeedGuardEnv): void {
  const supabaseUrl = (env.NEXT_PUBLIC_SUPABASE_URL ?? '').trim()

  // Signal 1 (non contournable) — URL Supabase correspondant au projet de production connu.
  if (supabaseUrl && normalizeUrl(supabaseUrl) === normalizeUrl(KNOWN_PRODUCTION_SUPABASE_URL)) {
    throw new ProductionSeedGuardError(
      `NEXT_PUBLIC_SUPABASE_URL correspond au projet Supabase de PRODUCTION connu ` +
      `(${KNOWN_PRODUCTION_SUPABASE_URL}). Le seed ne peut jamais s'exécuter contre ce projet, ` +
      `quelle que soit la valeur de SEED_TARGET_ENV.`
    )
  }

  // Signal 2 (non contournable) — la plateforme (Vercel) déclare elle-même un contexte production.
  if (env.VERCEL_ENV === 'production') {
    throw new ProductionSeedGuardError(
      `VERCEL_ENV="production" — le seed ne peut jamais s'exécuter dans ce contexte.`
    )
  }

  // Signal 3 (non contournable) — défense en profondeur. NODE_ENV n'est JAMAIS utilisé pour
  // autoriser (voir signal 4) : il ne sert ici qu'à bloquer un cas de production supplémentaire.
  if (env.NODE_ENV === 'production') {
    throw new ProductionSeedGuardError(
      `NODE_ENV="production" — le seed ne peut jamais s'exécuter dans ce contexte.`
    )
  }

  // Signal 4 — déclaration explicite obligatoire. Absence ou valeur non reconnue = refus
  // (fail-closed). Ceci ne désactive rien : même correctement déclarée, cette valeur ne
  // permet jamais de contourner les signaux 1 à 3 ci-dessus.
  const declared = (env.SEED_TARGET_ENV ?? '').trim()
  if (!isAllowedTargetEnv(declared)) {
    throw new ProductionSeedGuardError(
      `SEED_TARGET_ENV doit être explicitement défini à l'une des valeurs autorisées ` +
      `(${ALLOWED_SEED_TARGET_ENVS.join(', ')}). Valeur reçue : ` +
      `${declared ? JSON.stringify(declared) : '(absente)'}. Configuration ambiguë refusée par défaut.`
    )
  }
}

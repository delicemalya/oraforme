/**
 * requireAutomationSecret — garde unique des endpoints d'automatisation.
 *
 * Remplace les 4 variantes divergentes qui coexistaient (`cron/run`, `miaa/proactif`,
 * `agents/miaa-autonome`, `profil/reminders`) et couvre les 10 routes qui n'en avaient
 * aucune (ANO-C01).
 *
 * Deux appelants légitimes, deux en-têtes :
 *   - Vercel Cron (vercel.json)      → `Authorization: Bearer <CRON_SECRET>`
 *   - Supabase pg_cron (migration 167) → `x-automation-secret: <AUTOMATION_SECRET>`
 *
 * Règle de sécurité : échec FERMÉ. Si le secret n'est pas défini côté serveur,
 * la route refuse — elle ne s'ouvre jamais. C'est le comportement documenté par
 * Vercel (`if (!cronSecret || authHeader !== ...)`) et l'inverse de l'ancien
 * `cron/run` (`if (secret && ...)`) qui laissait passer tout le monde quand la
 * variable manquait.
 *
 * ⚠️ CRON_SECRET doit être défini dans les variables d'environnement Vercel,
 * sinon les 12 tâches planifiées retournent 401.
 *
 * Usage :
 *   export async function GET(req: Request) {
 *     const denied = requireAutomationSecret(req)
 *     if (denied) return denied
 *     ...
 *   }
 */

import { NextResponse } from 'next/server'

/** Comparaison à temps constant — évite de fuiter le secret octet par octet. */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

/**
 * Retourne une réponse 401 si la requête n'est pas une invocation d'automatisation
 * authentifiée, ou `null` si elle l'est.
 */
export function requireAutomationSecret(req: Request): NextResponse | null {
  const cronSecret = process.env.CRON_SECRET
  const authHeader = req.headers.get('authorization')
  if (cronSecret && authHeader && safeEqual(authHeader, `Bearer ${cronSecret}`)) {
    return null
  }

  const automationSecret = process.env.AUTOMATION_SECRET
  const headerSecret = req.headers.get('x-automation-secret')
  if (automationSecret && headerSecret && safeEqual(headerSecret, automationSecret)) {
    return null
  }

  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}

/**
 * En-têtes à joindre à un appel serveur→serveur vers une route d'automatisation.
 *
 * Remplace l'en-tête `x-internal: 'true'`, qui n'était pas un secret : n'importe
 * quel appelant pouvait le poser et contourner le garde (§22.1 — `ocr/extract`,
 * `miaa/analyse-quotidienne`).
 */
export function automationHeaders(): Record<string, string> {
  const cronSecret = process.env.CRON_SECRET
  return cronSecret ? { Authorization: `Bearer ${cronSecret}` } : {}
}

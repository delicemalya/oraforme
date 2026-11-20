/**
 * pays-tenant.ts — Normalise tenants.pays en code pays fiscal.
 *
 * tenants.pays contient un code ISO ('CG', 'CM'…) depuis l'onboarding, mais
 * des valeurs historiques en toutes lettres existent ('Congo-Brazzaville',
 * 'Cameroun'… — cf. le CASE de fn_ae_execute_event, migration 142.5).
 * Valeur absente ou inconnue → 'CG', le pays par défaut de l'application.
 *
 * Fonction pure (aucun accès base) : la lecture est dans lib/api/pays-tenant.ts.
 */

import { PAYS_CONFIGS } from './pays'
import type { PaysFiscal } from './types'

export const PAYS_PAR_DEFAUT: PaysFiscal = 'CG'

const SANS_ACCENTS = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()

const ALIAS_NOMS: Record<string, PaysFiscal> = {
  'congo': 'CG', 'congo-brazzaville': 'CG', 'congo brazzaville': 'CG', 'republique du congo': 'CG',
  'rdc': 'CD', 'rd congo': 'CD', 'congo-kinshasa': 'CD', 'republique democratique du congo': 'CD',
  'cameroun': 'CM', 'gabon': 'GA', 'tchad': 'TD',
  'rca': 'CF', 'centrafrique': 'CF', 'republique centrafricaine': 'CF',
  'guinee equatoriale': 'GQ',
}

// Les noms officiels de PAYS_CONFIGS complètent les alias.
for (const [code, cfg] of Object.entries(PAYS_CONFIGS)) {
  ALIAS_NOMS[SANS_ACCENTS(cfg.nom)] ??= code as PaysFiscal
}

export function normaliserPaysTenant(valeur: unknown): PaysFiscal {
  if (typeof valeur !== 'string' || !valeur.trim()) return PAYS_PAR_DEFAUT
  const code = valeur.trim().toUpperCase()
  if (code in PAYS_CONFIGS) return code as PaysFiscal
  return ALIAS_NOMS[SANS_ACCENTS(valeur)] ?? PAYS_PAR_DEFAUT
}

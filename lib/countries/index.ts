/**
 * lib/countries/index.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * REGISTRE CENTRAL — CountryConfig
 *
 * Point d'entrée unique pour accéder à la configuration fiscale/sociale
 * de tous les pays supportés par Oraforme.
 *
 * Usage :
 *   import { getCountryConfig, COUNTRY_LIST } from '@/lib/countries'
 *   const cfg = getCountryConfig('CG')
 *
 * Aucune logique métier ici — uniquement un registre et des helpers.
 */

import type { CountryConfig, CodePays, ZoneFiscale, DataConfidence } from './types'

import { CG } from './CG'
import { CM } from './CM'
import { GA } from './GA'
import { CD } from './CD'
import { CF } from './CF'
import { TD } from './TD'
import { GQ } from './GQ'

// ─── Registre maître ─────────────────────────────────────────────────────────

export const COUNTRY_REGISTRY: Record<CodePays, CountryConfig> = {
  CG,   // Congo-Brazzaville — verified (LF 2026)
  CM,   // Cameroun          — to_verify
  GA,   // Gabon             — estimated
  CD,   // RD Congo          — to_verify
  CF,   // Centrafrique      — estimated
  TD,   // Tchad             — estimated
  GQ,   // Guinée Équatoriale — estimated

  // Pays non encore implémentés — TypeScript raisonne sur CodePays complet
  // Ajouter ici au fur et à mesure des phases de migration
  AO: null as unknown as CountryConfig,   // Angola (à créer)
  ML: null as unknown as CountryConfig,   // Mali (à créer)
  BF: null as unknown as CountryConfig,   // Burkina Faso (à créer)
  NE: null as unknown as CountryConfig,   // Niger (à créer)
  NG: null as unknown as CountryConfig,   // Nigeria (à créer)
  FR: null as unknown as CountryConfig,   // France (à créer)
  BE: null as unknown as CountryConfig,   // Belgique (à créer)
  CH: null as unknown as CountryConfig,   // Suisse (à créer)
} as const

// ─── Pays effectivement disponibles (non-null) ───────────────────────────────

const AVAILABLE_CODES: CodePays[] = ['CG', 'CM', 'GA', 'CD', 'CF', 'TD', 'GQ']

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Retourne la config d'un pays. Fallback sur CG si non implémenté.
 * Toujours retourne un CountryConfig valide (jamais null).
 */
export function getCountryConfig(code: CodePays): CountryConfig {
  const cfg = COUNTRY_REGISTRY[code]
  if (cfg) return cfg
  // Fallback sécurisé sur CG pour les pays non encore migrés
  return CG
}

/** Retourne true si le pays a une config implémentée (non-null). */
export function isCountryAvailable(code: CodePays): boolean {
  return AVAILABLE_CODES.includes(code)
}

/** Liste des pays disponibles pour les selects/dropdowns UI. */
export const COUNTRY_LIST: Array<{
  code:             CodePays
  nom:              string
  devise:           string
  symbole_devise:   string
  zone:             ZoneFiscale
  data_confidence:  DataConfidence
}> = AVAILABLE_CODES.map(code => {
  const cfg = COUNTRY_REGISTRY[code]
  return {
    code,
    nom:            cfg.nom_pays,
    devise:         cfg.devise,
    symbole_devise: cfg.symbole_devise,
    zone:           cfg.zone_fiscale,
    data_confidence: cfg.data_confidence,
  }
})

/** Filtre les pays par zone fiscale. */
export function getCountriesByZone(zone: ZoneFiscale): CountryConfig[] {
  return AVAILABLE_CODES
    .map(code => COUNTRY_REGISTRY[code])
    .filter(cfg => cfg.zone_fiscale === zone)
}

/** Filtre les pays par niveau de confiance des données. */
export function getCountriesByConfidence(confidence: DataConfidence): CountryConfig[] {
  return AVAILABLE_CODES
    .map(code => COUNTRY_REGISTRY[code])
    .filter(cfg => cfg.data_confidence === confidence)
}

/**
 * Résume les cotisations CNSS totales (salarié + patronal) pour un brut donné.
 * Helper utilitaire — sans logique de calcul avancée.
 */
export function summarizeCNSS(code: CodePays, brutMensuel: number): {
  salarie:  number
  patronal: number
  total:    number
} {
  const cfg = getCountryConfig(code)
  let salarie  = 0
  let patronal = 0

  for (const branch of cfg.cnss.branches) {
    const base = branch.plafond_mensuel !== null
      ? Math.min(brutMensuel, branch.plafond_mensuel)
      : brutMensuel
    salarie  += Math.round(base * branch.taux_salarie)
    patronal += Math.round(base * branch.taux_patronal)
  }

  return { salarie, patronal, total: salarie + patronal }
}

// ─── Re-exports types ─────────────────────────────────────────────────────────
export type { CountryConfig, CodePays, ZoneFiscale, DataConfidence } from './types'
export type {
  ConfigTVA, ConfigIS, ConfigIRPP, ConfigCNSS, BrancheCNSS,
  ConfigExonerations, TaxeFixe, ConfigConventions, FeatureFlags,
  TrancheIRPP, MesureSpecialeIRPP, MesureSpecialeCNSS,
  ConfigAbattement, ConfigQuotientFamilial,
  MethodeBaseIRPP, TypeAbattement,
} from './types'

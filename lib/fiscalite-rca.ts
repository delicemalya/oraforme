// SOURCE: Central Africa Tax Guide (nov 2023) + Bêafrica-Kamba
// Données principalement vérifiées — IS basé sur le chiffre d'affaires (non le bénéfice)
// Dernière mise à jour : 2023-11

// ═══════════════════════════════════════════════════════════════════════════════
// MÉTADONNÉES SOURCE
// ═══════════════════════════════════════════════════════════════════════════════

export const DATA_SOURCE  = 'Central Africa Tax Guide (nov 2023) + Bêafrica-Kamba'
export const LAST_UPDATE  = '2023-11'
export type  ConfidenceLevel = 'verified' | 'estimated' | 'to_verify'
export const DATA_CONFIDENCE: ConfidenceLevel = 'verified'

// ═══════════════════════════════════════════════════════════════════════════════
// TAUX STANDARDS
// ═══════════════════════════════════════════════════════════════════════════════

// ATTENTION : en RCA l'IS est assis sur le CHIFFRE D'AFFAIRES, pas le bénéfice net
// Le paramètre beneficeNet de calculerIS() est donc ignoré

export const TAUX_IS = {
  // Régime général (activités commerciales, industrielles, libérales)
  regime_general_taux:   0.0185,     // 1,85% du CA — [verified]
  regime_general_plancher: 1_850_000, // minimum 1 850 000 XAF — [verified]
  // Régime agricole
  regime_agricole_taux:  0.003,      // 0,3% du CA — [verified]
  regime_agricole_plancher: 300_000,  // minimum 300 000 XAF — [verified]
  // Acompte IS retenu à la source sur paiements
  acompte_retenu_source: 0.03,       // 3% — [verified]
} as const

export const TAUX_TVA = {
  taux_normal:           0.19,       // 19% — [verified, confirmé 2 sources]
  taux_zero:             0,          // exportations — [verified]
  seuil_assujettissement: 30_000_000, // CA ≥ 30 000 000 XAF — [verified]
  echeance_declaration:  '15 du mois suivant', // [verified]
} as const

export const TAUX_RETENUE_SOURCE = {
  prestataires_etrangers_sur_ca: 0.15,  // 15% sur CA des services rendus en RCA par étrangers — [verified]
  acompte_is:                    0.03,  // 3% acompte IS retenu à la source — [verified]
} as const

export const TAUX_PATENTE = {
  // TODO: confirmer le taux exact Patente RCA — non précisé dans nos sources principales
  taux:     0.0035,  // ⚠️ [estimated] — 0,35% estimé par cohérence CEMAC (Gabon/Tchad)
  base:     'CA annuel N-2',
  echeance: '31 janvier', // [estimated CEMAC]
} as const

// ─── Autres prélèvements ────────────────────────────────────────────────────

export const AUTRES_PRELEVEMENTS = {
  contribution_developpement_social: 0.10,  // CDS : 10% masse salariale — [verified]
  taxe_propriete_non_batie:          0.275, // 27,50% toutes catégories — [verified]
  limitation_frais_siege_hors_rca_pct_charges: 0.20, // 20% des charges avant déduction — [verified]
  seuil_paiement_especes_non_deductible: 200_000, // > 200 000 XAF en espèces = non déductible — [verified]
} as const

// ═══════════════════════════════════════════════════════════════════════════════
// OBLIGATIONS & ÉCHÉANCES
// ═══════════════════════════════════════════════════════════════════════════════

export const OBLIGATIONS_FISCALES = [
  'TVA mensuelle (seuil CA ≥ 30 000 000 XAF)',
  'IS selon régime (général 1,85% CA ou agricole 0,3% CA)',
  'Contribution pour le Développement Social — 10% masse salariale mensuelle',
  'Retenue à la source 15% sur services étrangers',
] as const

export interface EcheanceFiscale {
  nom:         string
  jour:        number
  mois:        number | null
  recurrence?: 'mensuelle' | 'annuelle' | 'trimestrielle'
}

export const ECHEANCES_FISCALES: EcheanceFiscale[] = [
  { nom: 'TVA mensuelle',                           jour: 15, mois: null, recurrence: 'mensuelle' },
  { nom: 'CDS mensuelle (10% masse salariale)',     jour: 15, mois: null, recurrence: 'mensuelle' },
  { nom: 'IS annuel (régime général ou agricole)',  jour: 30, mois: 4   },
  { nom: 'Patente annuelle',                        jour: 31, mois: 1   },
]

export const REGLES_FISCALES = [
  'IS assis sur le CA (pas le bénéfice) : régime général 1,85% CA (min 1 850 000 XAF) ; régime agricole 0,3% CA (min 300 000 XAF)',
  'Acompte IS de 3% retenu à la source sur les paiements',
  'TVA 19% — assujettissement si CA ≥ 30 000 000 XAF',
  'Retenue source 15% sur CA des services rendus en RCA par prestataires étrangers',
  'CDS : 10% sur la masse salariale brute — versement mensuel',
  'Frais siège social hors RCA : déductibles max 20% des charges avant déduction',
  'Paiements en espèces > 200 000 XAF : non déductibles',
  'Propriété non bâtie : taxe unique 27,50% toutes catégories',
] as const

// ═══════════════════════════════════════════════════════════════════════════════
// FONCTIONS DE CALCUL
// ═══════════════════════════════════════════════════════════════════════════════

export type RegimeIS = 'general' | 'agricole'

/**
 * Calcule l'IS RCA — assis sur le CHIFFRE D'AFFAIRES (pas le bénéfice).
 * Le paramètre beneficeNet est ignoré en RCA.
 *
 * @param beneficeNet       - Ignoré en RCA (IS basé sur CA)
 * @param chiffreAffaires   - CA annuel HT (XAF)
 * @param regime            - 'general' (défaut) ou 'agricole'
 */
export function calculerIS(
  beneficeNet:     number,
  chiffreAffaires: number,
  regime:          RegimeIS = 'general',
): number {
  void beneficeNet // IS RCA basé sur CA, pas le bénéfice
  if (regime === 'agricole') {
    return Math.max(
      Math.round(chiffreAffaires * TAUX_IS.regime_agricole_taux),
      TAUX_IS.regime_agricole_plancher,
    )
  }
  return Math.max(
    Math.round(chiffreAffaires * TAUX_IS.regime_general_taux),
    TAUX_IS.regime_general_plancher,
  )
}

/**
 * Calcule la TVA RCA (19%).
 *
 * @param montantHT - Montant hors taxes (XAF)
 * @returns TVA collectée (XAF)
 */
export function calculerTVA(montantHT: number): number {
  return Math.round(montantHT * TAUX_TVA.taux_normal)
}

/**
 * Calcule la retenue à la source RCA.
 *
 * @param montant      - Montant brut (XAF)
 * @param typeRevenu   - 'etranger' (15% CA) | 'acompte_is' (3%)
 */
export function calculerRetenueSource(montant: number, typeRevenu: string): number {
  const taux: Record<string, number> = {
    etranger:    TAUX_RETENUE_SOURCE.prestataires_etrangers_sur_ca,
    acompte_is:  TAUX_RETENUE_SOURCE.acompte_is,
  }
  return Math.round(montant * (taux[typeRevenu] ?? 0))
}

/**
 * Calcule la Patente RCA.
 * ⚠️ Taux estimé par cohérence CEMAC — à confirmer.
 *
 * @param chiffreAffaires - CA annuel HT N-2 (XAF)
 */
export function calculerPatente(chiffreAffaires: number): number {
  return Math.round(chiffreAffaires * TAUX_PATENTE.taux)
}

/**
 * Calcule la Contribution pour le Développement Social (CDS) mensuelle.
 *
 * @param masseSalarialeMensuelle - Masse salariale brute mensuelle (XAF)
 */
export function calculerCDS(masseSalarialeMensuelle: number): number {
  return Math.round(masseSalarialeMensuelle * AUTRES_PRELEVEMENTS.contribution_developpement_social)
}

// ─── Exports nommés ────────────────────────────────────────────────────────────

export const IS_RCA = {
  regime_general_taux:   TAUX_IS.regime_general_taux,
  regime_general_min:    TAUX_IS.regime_general_plancher,
  regime_agricole_taux:  TAUX_IS.regime_agricole_taux,
  regime_agricole_min:   TAUX_IS.regime_agricole_plancher,
} as const

export const TVA_RCA = {
  taux_normal:            TAUX_TVA.taux_normal,
  seuil_assujettissement: TAUX_TVA.seuil_assujettissement,
  echeance:               TAUX_TVA.echeance_declaration,
} as const

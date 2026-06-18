// SOURCE: Central Africa Tax Guide (nov 2023) + TradingEconomics
// ⚠️ TVA taux normal non confirmé dans nos sources — estimé ~18% par cohérence CEMAC
// ⚠️ Vérifier les éventuelles modifications de la Loi de Finances 2024/2025 avant mise en production
// Dernière mise à jour : 2023-11

// ═══════════════════════════════════════════════════════════════════════════════
// MÉTADONNÉES SOURCE
// ═══════════════════════════════════════════════════════════════════════════════

export const DATA_SOURCE  = 'Central Africa Tax Guide (nov 2023) + TradingEconomics'
export const LAST_UPDATE  = '2023-11'
export type  ConfidenceLevel = 'verified' | 'estimated' | 'to_verify'
export const DATA_CONFIDENCE: ConfidenceLevel = 'to_verify' // TVA taux normal non confirmé

// ═══════════════════════════════════════════════════════════════════════════════
// TAUX STANDARDS
// ═══════════════════════════════════════════════════════════════════════════════

export const TAUX_IS = {
  taux_normal:               0.35,         // 35% — [verified, confirmé 2 sources]
  // Minimum fiscal : payé par douzième mensuel (15j après fin du mois)
  minimum_fiscal_activite_generale: 2_000_000,  // 2 000 000 XAF/an — [verified] (max)
  minimum_fiscal_activite_specifique: 1_000_000, // 1 000 000 XAF/an — [verified] (min)
  minimum_fiscal_mensuel_fraction: 1 / 12,       // 1/12 par mois — [verified]
  echeance_minimum_mensuel: '15 du mois suivant la fin du mois',
  solde_echeance: '30 avril', // [estimated CEMAC — à confirmer]
} as const

export const TAUX_TVA = {
  // TODO: confirmer le taux normal TVA Tchad — non disponible dans nos sources
  taux_normal: 0.18,   // ⚠️ [to_verify] — estimé 18% par cohérence CEMAC
  taux_zero:   0,      // exportations + transport international — [verified]
  echeance_declaration: '15 du mois suivant', // [estimated CEMAC]
} as const

export const TAUX_RETENUE_SOURCE = {
  prestataires_non_residents:  0.25,   // 25% — [verified]
  dividendes_non_residents:    0.20,   // 20% (exonéré sous convention CEMAC) — [verified]
} as const

export const TAUX_PATENTE = {
  taux:     0.0035,            // 0,35% du CA année N-2 — [verified]
  base:     'CA annuel N-2',
  echeance: '31 mars',         // [verified]
} as const

// ─── Règles de déductibilité ────────────────────────────────────────────────

export const REGLES_DEDUCTIBILITE = {
  frais_restauration_hotels_limite_pct_ca:  0.005,   // 0,5% du CA net d'impôts — [verified]
  dons_liberalites_limite_pct_ca:           0.005,   // 0,5% du CA net d'impôts — [verified]
  frais_siege_hors_tchad_cemac_limite:      0.10,    // 10% des charges — [verified]
  amortissement_taux_minimum:               0.05,    // 5% — [verified]
  amortissement_taux_maximum:               0.3333,  // 33,33% — [verified]
  // Exception : assistance technique montage usine → déductible totalement
  paiements_especes_seuil_non_deductible:   null,    // non précisé dans nos sources
} as const

// ═══════════════════════════════════════════════════════════════════════════════
// OBLIGATIONS & ÉCHÉANCES
// ═══════════════════════════════════════════════════════════════════════════════

export const OBLIGATIONS_FISCALES = [
  'TVA mensuelle',
  'IS — minimum fiscal mensuel (1/12) + solde annuel',
  'Patente annuelle',
] as const

export interface EcheanceFiscale {
  nom:         string
  jour:        number
  mois:        number | null
  recurrence?: 'mensuelle' | 'annuelle' | 'trimestrielle'
}

export const ECHEANCES_FISCALES: EcheanceFiscale[] = [
  { nom: 'Minimum fiscal IS mensuel (1/12)',  jour: 15, mois: null, recurrence: 'mensuelle' },
  { nom: 'Solde IS annuel',                   jour: 30, mois: 4  },
  { nom: 'Patente annuelle',                  jour: 31, mois: 3  },
  { nom: 'TVA mensuelle',                     jour: 15, mois: null, recurrence: 'mensuelle' },
]

export const REGLES_FISCALES = [
  'IS 35% — minimum fiscal annuel 1M–2M FCFA selon activité, payé par douzième (1/12) le 15 du mois suivant',
  'Retenue source prestataires non-résidents : 25%',
  'Dividendes non-résidents : 20% (exonéré sous convention CEMAC)',
  'Frais restaurant/hôtels/réceptions : déductibles limite 0,5% du CA net d\'impôts',
  'Dons et libéralités : déductibles limite 0,5% du CA net d\'impôts (accord Ministre Finances requis)',
  'Frais siège social hors Tchad/CEMAC : déductibles limite 10% (exception : assistance technique montage usine)',
  'Amortissements : taux légal minimum 5%, maximum 33,33%',
  '⚠️ TVA taux normal estimé à 18% par cohérence CEMAC — à confirmer',
] as const

// ═══════════════════════════════════════════════════════════════════════════════
// FONCTIONS DE CALCUL
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Calcule l'IS Tchad (35% bénéfice net, avec minimum fiscal mensuel).
 * Le minimum fiscal est payé par douzième chaque mois.
 *
 * @param beneficeNet       - Bénéfice net imposable (XAF)
 * @param chiffreAffaires   - CA annuel HT (XAF) — non utilisé directement (minimum fixe)
 * @param minimumFiscalAnnuel - Montant annuel du minimum fiscal (1M ou 2M selon activité)
 */
export function calculerIS(
  beneficeNet:          number,
  chiffreAffaires:      number,
  minimumFiscalAnnuel = TAUX_IS.minimum_fiscal_activite_generale,
): number {
  void chiffreAffaires // minimum fixe — CA non utilisé dans le calcul IS Tchad
  const isNormal = Math.round(Math.max(0, beneficeNet) * TAUX_IS.taux_normal)
  return Math.max(isNormal, minimumFiscalAnnuel)
}

/**
 * Calcule le minimum fiscal mensuel IS Tchad (1/12 du minimum annuel).
 */
export function calculerMinimumFiscalMensuel(
  minimumFiscalAnnuel = TAUX_IS.minimum_fiscal_activite_generale,
): number {
  return Math.round(minimumFiscalAnnuel * TAUX_IS.minimum_fiscal_mensuel_fraction)
}

/**
 * Calcule la TVA Tchad (taux normal estimé 18% — à confirmer).
 *
 * @param montantHT - Montant hors taxes (XAF)
 */
export function calculerTVA(montantHT: number): number {
  return Math.round(montantHT * TAUX_TVA.taux_normal)
}

/**
 * Calcule la retenue à la source Tchad.
 *
 * @param montant      - Montant brut (XAF)
 * @param typeRevenu   - 'non_resident' | 'dividende'
 */
export function calculerRetenueSource(montant: number, typeRevenu: string): number {
  const taux: Record<string, number> = {
    non_resident: TAUX_RETENUE_SOURCE.prestataires_non_residents,
    dividende:    TAUX_RETENUE_SOURCE.dividendes_non_residents,
  }
  return Math.round(montant * (taux[typeRevenu] ?? 0))
}

/**
 * Calcule la Patente Tchad (0,35% du CA année N-2).
 *
 * @param chiffreAffaires - CA annuel HT N-2 (XAF)
 */
export function calculerPatente(chiffreAffaires: number): number {
  return Math.round(chiffreAffaires * TAUX_PATENTE.taux)
}

// ─── Exports nommés ────────────────────────────────────────────────────────────

export const IS_TCHAD = {
  taux_normal:                TAUX_IS.taux_normal,
  minimum_fiscal_general:     TAUX_IS.minimum_fiscal_activite_generale,
  minimum_fiscal_specifique:  TAUX_IS.minimum_fiscal_activite_specifique,
} as const

export const TVA_TCHAD = {
  taux_normal: TAUX_TVA.taux_normal,   // ⚠️ to_verify
  echeance:    TAUX_TVA.echeance_declaration,
} as const

// ═══════════════════════════════════════════════════════════════════════════════
// CONTEXTE MIAA+ EXPERT FISCAL
// ═══════════════════════════════════════════════════════════════════════════════

export const MIAA_FISCAL_CONTEXT = {
  country:               'TD',
  countryName:           'Tchad',
  currency:              'XAF',
  administrationFiscale: 'Direction Générale des Impôts et du Domaine (DGID Tchad)',
  systemeFiscal:         'OHADA / SYSCOHADA, zone CEMAC',
  expertName:            'MIAA+ Expert Fiscal Tchad',
  dataConfidence:        DATA_CONFIDENCE,
  specificites: [
    'IS 35% ; minimum fiscal fixe 1M–2M XAF/an selon activité, payé par douzième mensuel (15 du mois suivant)',
    'TVA 18% estimé par cohérence CEMAC — à confirmer (taux zéro : exportations + transport international)',
    'Patente 0,35% du CA N-2 — échéance 31 mars',
    'Retenue source prestataires non-résidents : 25% ; dividendes non-résidents : 20% (exonéré CEMAC)',
    'Frais siège hors Tchad/CEMAC : déductibles limite 10% des charges',
    'Frais restauration/hôtels et dons : déductibles limite 0,5% du CA net d\'impôts',
    'Amortissements : taux légal 5% minimum, 33,33% maximum',
    '⚠️ Données TVA classées to_verify — confirmer auprès de la DGID Tchad avant usage officiel',
  ],
} as const

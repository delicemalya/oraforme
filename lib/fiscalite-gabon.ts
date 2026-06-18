// SOURCE: Central Africa Tax Guide (nov 2023) + DGI Gabon officielle
// ⚠️ TVA taux normal non confirmé dans nos sources — estimé ~18% par cohérence CEMAC
// ⚠️ Vérifier les éventuelles modifications de la Loi de Finances 2024/2025 avant mise en production
// Dernière mise à jour : 2023-11

// ═══════════════════════════════════════════════════════════════════════════════
// MÉTADONNÉES SOURCE
// ═══════════════════════════════════════════════════════════════════════════════

export const DATA_SOURCE  = 'Central Africa Tax Guide (nov 2023) + DGI Gabon officielle'
export const LAST_UPDATE  = '2023-11'
export type  ConfidenceLevel = 'verified' | 'estimated' | 'to_verify'
export const DATA_CONFIDENCE: ConfidenceLevel = 'to_verify' // TVA taux normal non confirmé

// ═══════════════════════════════════════════════════════════════════════════════
// TAUX STANDARDS
// ═══════════════════════════════════════════════════════════════════════════════

export const TAUX_IS = {
  taux_normal:                  0.35,          // 35% — [verified]
  taux_minimum_ca:              0.011,          // 1,1% du CA — [verified]
  plancher_minimum:             600_000,        // 600 000 XAF — [verified]
  exoneration_minimum_annees:   2,              // exonération min/perception 2 premières années — [verified]
  // Acomptes : 1er = 1/4 IS N-1 (30 nov) ; 2e = 1/3 IS N-1 (30 jan) ; solde 30 avr
  acompte_1_fraction:           0.25,           // 1/4 IS N-1 — [verified]
  acompte_1_echeance:           '30 novembre',
  acompte_2_fraction:           1 / 3,          // 1/3 IS N-1 — [verified]
  acompte_2_echeance:           '30 janvier',
  solde_echeance:               '30 avril (lors dépôt déclaration annuelle)',
} as const

export const TAUX_TVA = {
  // TODO: confirmer le taux normal Gabon auprès de la DGI — estimé 18% par cohérence CEMAC
  taux_normal:  0.18,   // ⚠️ [to_verify] — estimé CEMAC
  taux_reduit:  0.05,   // 5% — liste limitée biens/services — [verified]
  taux_zero:    0,      // exportations — [verified]
  echeance_declaration: '15 du mois suivant', // [estimated CEMAC]
} as const

export const TAUX_IRVM = {
  dividendes:                   0.20,   // 20% — [verified]
  dividendes_conditions:        0.10,   // 10% sous certaines conditions — [verified]
  remunerations_administrateurs: 0.22,  // 22% — [verified]
} as const

export const TAUX_RETENUE_SOURCE = {
  remunerations_etrangers:              0.20,   // 20% — [verified]
  prestataires_locaux_non_assujettis:   0.095,  // 9,5% prestataires locaux non-assujettis TVA — [verified]
} as const

export const TAUX_PATENTE = {
  taux:  0.0035,           // 0,35% du CA année N-2 — [verified]
  base:  'CA annuel N-2',
  echeance: '31 janvier', // [estimated CEMAC — à confirmer]
} as const

// ═══════════════════════════════════════════════════════════════════════════════
// OBLIGATIONS & ÉCHÉANCES
// ═══════════════════════════════════════════════════════════════════════════════

export const OBLIGATIONS_FISCALES = [
  'TVA mensuelle',
  'IS — 2 acomptes + solde annuel',
  'Patente annuelle',
  'IRVM sur dividendes',
] as const

export interface EcheanceFiscale {
  nom:         string
  jour:        number
  mois:        number | null
  recurrence?: 'mensuelle' | 'annuelle' | 'trimestrielle'
}

export const ECHEANCES_FISCALES: EcheanceFiscale[] = [
  { nom: '1er acompte IS (1/4 IS N-1)',              jour: 30, mois: 11 },
  { nom: '2e acompte IS (1/3 IS N-1)',               jour: 30, mois: 1  },
  { nom: 'Solde IS + déclaration annuelle',          jour: 30, mois: 4  },
  { nom: 'TVA mensuelle',                            jour: 15, mois: null, recurrence: 'mensuelle' },
  { nom: 'Patente annuelle',                         jour: 31, mois: 1  },
]

export const REGLES_FISCALES = [
  'IS minimum : max(35% × bénéfice net, 1,1% × CA HT) avec plancher 600 000 XAF',
  'Exonération du minimum IS/patente les 2 premières années d\'activité',
  'IRVM dividendes : 20% (taux réduit 10% sous conditions spécifiques)',
  'Rémunérations des administrateurs : IRVM 22%',
  'Retenue source prestataires étrangers : 20% ; prestataires locaux non-TVA : 9,5%',
  'TVA taux réduit 5% : liste limitée de biens/services (à vérifier DGI)',
  '⚠️ TVA taux normal estimé à 18% par cohérence CEMAC — à confirmer',
] as const

// ═══════════════════════════════════════════════════════════════════════════════
// FONCTIONS DE CALCUL
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Calcule l'IS Gabon.
 * IS = max(35% × bénéfice net, 1,1% × CA HT, plancher 600 000 XAF).
 * Exonération du minimum les 2 premières années d'activité.
 *
 * @param beneficeNet       - Bénéfice net imposable (XAF)
 * @param chiffreAffaires   - CA annuel HT (XAF)
 * @param anneeActivite     - Numéro d'année d'activité (1 ou 2 = exonération minimum)
 */
export function calculerIS(
  beneficeNet:     number,
  chiffreAffaires: number,
  anneeActivite    = 3,
): number {
  const isNormal  = Math.round(Math.max(0, beneficeNet) * TAUX_IS.taux_normal)
  const exonere   = anneeActivite <= TAUX_IS.exoneration_minimum_annees
  if (exonere) return isNormal
  const minimum   = Math.max(
    Math.round(chiffreAffaires * TAUX_IS.taux_minimum_ca),
    TAUX_IS.plancher_minimum,
  )
  return Math.max(isNormal, minimum)
}

/**
 * Calcule le montant de TVA Gabon (taux normal, estimé 18%).
 * ⚠️ Taux normal à confirmer — source non disponible dans nos données 2023.
 *
 * @param montantHT - Montant hors taxes (XAF)
 * @returns TVA collectée (XAF)
 */
export function calculerTVA(montantHT: number): number {
  return Math.round(montantHT * TAUX_TVA.taux_normal)
}

/**
 * Calcule la retenue à la source Gabon.
 *
 * @param montant      - Montant brut (XAF)
 * @param typeRevenu   - 'etranger' | 'prestataire_local' | 'dividende' | 'administrateur'
 */
export function calculerRetenueSource(montant: number, typeRevenu: string): number {
  const taux: Record<string, number> = {
    etranger:             TAUX_RETENUE_SOURCE.remunerations_etrangers,
    prestataire_local:    TAUX_RETENUE_SOURCE.prestataires_locaux_non_assujettis,
    dividende:            TAUX_IRVM.dividendes,
    dividende_reduit:     TAUX_IRVM.dividendes_conditions,
    administrateur:       TAUX_IRVM.remunerations_administrateurs,
  }
  return Math.round(montant * (taux[typeRevenu] ?? 0))
}

/**
 * Calcule la Patente Gabon (0,35% du CA année N-2).
 *
 * @param chiffreAffaires - CA annuel HT N-2 (XAF)
 */
export function calculerPatente(chiffreAffaires: number): number {
  return Math.round(chiffreAffaires * TAUX_PATENTE.taux)
}

// ─── Exports nommés (compatibilité inter-modules) ─────────────────────────────

export const IS_GABON = {
  taux_normal:    TAUX_IS.taux_normal,
  taux_minimum:   TAUX_IS.taux_minimum_ca,
  plancher:       TAUX_IS.plancher_minimum,
} as const

export const TVA_GABON = {
  taux_normal:  TAUX_TVA.taux_normal,   // ⚠️ to_verify
  taux_reduit:  TAUX_TVA.taux_reduit,
  echeance:     TAUX_TVA.echeance_declaration,
} as const

// ═══════════════════════════════════════════════════════════════════════════════
// CONTEXTE MIAA+ EXPERT FISCAL
// ═══════════════════════════════════════════════════════════════════════════════

export const MIAA_FISCAL_CONTEXT = {
  country:               'GA',
  countryName:           'Gabon',
  currency:              'XAF',
  administrationFiscale: 'Direction Générale des Impôts (DGI Gabon)',
  systemeFiscal:         'OHADA / SYSCOHADA, zone CEMAC',
  expertName:            'MIAA+ Expert Fiscal Gabon',
  dataConfidence:        DATA_CONFIDENCE,
  specificites: [
    'TVA 18% estimé par cohérence CEMAC — à confirmer DGI Gabon (taux réduit 5%)',
    'IS 35% ; minimum 1,1% du CA HT avec plancher 600 000 XAF',
    'Exonération du minimum IS les 2 premières années d\'activité',
    'Acomptes IS : 1/4 (30 nov), 1/3 (30 jan), solde (30 avr)',
    'IRVM dividendes : 20% (10% sous conditions)',
    'Retenue source prestataires étrangers : 20%',
    'Patente 0,35% du CA N-2 — échéance estimée',
    '⚠️ Données classées to_verify — recommander confirmation DGI Gabon avant usage officiel',
  ],
} as const

// SOURCE: Avocats.cd + Deloitte + DGI RDC officielle
// ⚠️ RÉFORME MAJEURE EN VIGUEUR DEPUIS LE 1er JANVIER 2026
// Lois n°23/052 et n°23/053 du 30 novembre 2023
// Le système cédulaire précédent (impôts séparés par catégorie) est remplacé
// par un système unifié IS + IRPP — SI interrogé sur l'ancien système,
// signaler explicitement ce changement.
// Devise : CDF (Franc Congolais) — distinct du XAF Congo-Brazzaville (CG)
// Dernière mise à jour : 2026-01

// ═══════════════════════════════════════════════════════════════════════════════
// MÉTADONNÉES SOURCE
// ═══════════════════════════════════════════════════════════════════════════════

export const DATA_SOURCE  = 'Avocats.cd + Deloitte + DGI RDC officielle'
export const LAST_UPDATE  = '2026-01'
export type  ConfidenceLevel = 'verified' | 'estimated' | 'to_verify'
export const DATA_CONFIDENCE: ConfidenceLevel = 'verified' // confirmé 3 sources

// ═══════════════════════════════════════════════════════════════════════════════
// TAUX STANDARDS
// ═══════════════════════════════════════════════════════════════════════════════

export const TAUX_IS = {
  taux_normal:              0.30,   // 30% sur bénéfice net imposable — [verified, confirmé 2 sources]
  taxe_minimale_ca:         0.01,   // 1% du CA si bénéfice nul ou déficitaire — [verified]
  report_pertes_exercices:  3,      // max 3 exercices consécutifs (avant : illimité) — NOUVEAUTÉ 2026 [verified]
  plus_values_reevaluation_libre:  0.20,  // 20% — [verified]
  plus_values_reevaluation_legale: 0.05,  // 5% — [verified]
  // Méthodes prix de transfert OCDE intégrées depuis réforme 2026 [verified]
  prix_transfert_methodes_ocde: true,
} as const

export const TAUX_TVA = {
  taux_normal:              0.16,        // 16% — [verified, confirmé 3 sources]
  taux_zero:                0,           // exportations — [verified]
  seuil_assujettissement_cdf: 80_000_000, // CA ≥ 80 000 000 CDF/an — [verified]
  echeance_declaration:     '15 du mois suivant', // [verified]
  // Professions libérales : assujetties sans seuil de CA — [verified]
  professions_liberales_sans_seuil: true,
  // Autoliquidation B2B transfrontalière : client RDC reverse TVA 16%
  // si fournisseur étranger sans représentant fiscal local — [verified]
  autoliquidation_b2b_taux: 0.16,
  // Facture normalisée (e-UF/e-MCF) obligatoire depuis 1er décembre 2025 — [verified]
  facture_normalisee_obligatoire: true,
  facture_normalisee_depuis:      '2025-12-01',
} as const

export const TAUX_RETENUE_SOURCE = {
  // IRS — Impôt sur les Revenus des Services non-résidents
  irs_services_non_residents: 0.14,   // 14% — [verified]
} as const

export const TAUX_PATENTE = {
  // TODO: confirmer le taux Patente RDC exact dans le nouveau système unifié 2026
  taux:     0.0035,  // ⚠️ [estimated] — à confirmer avec le nouveau système 2026
  base:     'CA annuel',
  echeance: '31 mars', // [estimated — à confirmer]
} as const

// ─── Autres taxes vérifiées ─────────────────────────────────────────────────

export const AUTRES_TAXES = {
  taxe_mutation_immobiliere:         0.03,    // 3% (acquéreur) — [verified]
  revenu_locatif_kinshasa_total:     0.22,    // 22% total (20% retenu + 2% propriétaire) — [verified]
  revenu_locatif_retenu_locataire:   0.20,    // 20% — [verified]
  revenu_locatif_propriétaire:       0.02,    // 2% — [verified]
  // Forfait cessation d'activité — [verified]
  forfait_cessation_grande:          500_000, // CDF
  forfait_cessation_moyenne:         250_000, // CDF
  forfait_cessation_petite:          30_000,  // CDF
} as const

// ═══════════════════════════════════════════════════════════════════════════════
// OBLIGATIONS & ÉCHÉANCES
// ═══════════════════════════════════════════════════════════════════════════════

export const OBLIGATIONS_FISCALES = [
  'TVA mensuelle (seuil 80 000 000 CDF ; professions libérales sans seuil)',
  'IS annuel 30% (taxe minimale 1% CA si déficitaire)',
  'Facture normalisée e-UF/e-MCF (obligatoire depuis déc 2025)',
  'IRS 14% sur services non-résidents',
  'Autoliquidation TVA 16% B2B transfrontalière si fournisseur étranger sans représentant',
] as const

export interface EcheanceFiscale {
  nom:         string
  jour:        number
  mois:        number | null
  recurrence?: 'mensuelle' | 'annuelle' | 'trimestrielle'
}

export const ECHEANCES_FISCALES: EcheanceFiscale[] = [
  { nom: 'TVA mensuelle',           jour: 15, mois: null, recurrence: 'mensuelle' },
  { nom: 'IS annuel + taxe minimale', jour: 30, mois: 4 },
  { nom: 'Patente annuelle',         jour: 31, mois: 3  },
]

export const REGLES_FISCALES = [
  '⚠️ RÉFORME 2026 EN VIGUEUR : système cédulaire remplacé par IS + IRPP unifié (Lois 23/052 et 23/053 du 30/11/2023)',
  'IS 30% bénéfice net — taxe minimale 1% CA si bénéfice nul ou déficitaire',
  'Report des pertes : limité à 3 exercices (NOUVEAUTÉ 2026 — avant : illimité)',
  'Plus-values : 20% réévaluation libre, 5% réévaluation légale',
  'Prix de transfert : méthodes OCDE intégrées depuis 2026',
  'TVA 16% — seuil 80M CDF/an ; professions libérales assujetties sans seuil',
  'IRS 14% sur services rendus en RDC par non-résidents',
  'Autoliquidation TVA 16% si fournisseur étranger sans représentant fiscal local',
  'Facture normalisée e-UF/e-MCF obligatoire depuis 1er décembre 2025',
  'Taxe mutation immobilière : 3% (acquéreur)',
  'Revenu locatif Kinshasa : 22% total (20% retenu locataire + 2% payé propriétaire)',
  'Devise : CDF — distinct du XAF (Congo-Brazzaville)',
] as const

// ═══════════════════════════════════════════════════════════════════════════════
// FONCTIONS DE CALCUL
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Calcule l'IS RDC (réforme 2026).
 * IS = max(30% × bénéfice net, taxe minimale 1% × CA si déficitaire).
 *
 * @param beneficeNet       - Bénéfice net imposable (CDF)
 * @param chiffreAffaires   - CA annuel HT (CDF)
 */
export function calculerIS(beneficeNet: number, chiffreAffaires: number): number {
  const isNormal   = Math.round(Math.max(0, beneficeNet) * TAUX_IS.taux_normal)
  if (beneficeNet > 0) return isNormal
  // Bénéfice nul ou déficitaire → taxe minimale 1% CA
  return Math.round(chiffreAffaires * TAUX_IS.taxe_minimale_ca)
}

/**
 * Calcule la TVA RDC (16%).
 *
 * @param montantHT - Montant hors taxes (CDF)
 * @returns TVA collectée (CDF)
 */
export function calculerTVA(montantHT: number): number {
  return Math.round(montantHT * TAUX_TVA.taux_normal)
}

/**
 * Calcule la retenue à la source RDC.
 * Seul l'IRS (services non-résidents) est défini dans nos sources.
 *
 * @param montant      - Montant brut (CDF)
 * @param typeRevenu   - 'irs' (services non-résidents 14%)
 */
export function calculerRetenueSource(montant: number, typeRevenu: string): number {
  const taux: Record<string, number> = {
    irs: TAUX_RETENUE_SOURCE.irs_services_non_residents,
  }
  return Math.round(montant * (taux[typeRevenu] ?? 0))
}

/**
 * Calcule la Patente RDC.
 * ⚠️ Taux estimé — à confirmer dans le cadre du nouveau système unifié 2026.
 *
 * @param chiffreAffaires - CA annuel HT (CDF)
 */
export function calculerPatente(chiffreAffaires: number): number {
  return Math.round(chiffreAffaires * TAUX_PATENTE.taux)
}

/**
 * Calcule l'autoliquidation TVA pour achats B2B transfrontaliers.
 * S'applique si le fournisseur étranger n'a pas de représentant fiscal local en RDC.
 *
 * @param montantService - Montant du service (CDF ou devise étrangère convertie)
 */
export function calculerAutoliquidationTVA(montantService: number): number {
  return Math.round(montantService * TAUX_TVA.autoliquidation_b2b_taux)
}

// ─── Exports nommés ────────────────────────────────────────────────────────────

export const IS_RDC = {
  taux_normal:        TAUX_IS.taux_normal,
  taxe_minimale_ca:   TAUX_IS.taxe_minimale_ca,
  report_pertes_max:  TAUX_IS.report_pertes_exercices,
} as const

export const TVA_RDC = {
  taux_normal:              TAUX_TVA.taux_normal,
  seuil_assujettissement:   TAUX_TVA.seuil_assujettissement_cdf,
  echeance:                 TAUX_TVA.echeance_declaration,
  autoliquidation_b2b:      TAUX_TVA.autoliquidation_b2b_taux,
} as const

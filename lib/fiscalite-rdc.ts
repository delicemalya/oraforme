// SOURCE PRINCIPALE : Loi de Finances RDC N°25/060 du 29 décembre 2025
//   (Rapport sur les dépenses fiscales 2024, Ministère des Finances RDC)
//   Sources complémentaires : Avocats.cd + Deloitte
// ⚠️ RÉFORME MAJEURE EN VIGUEUR DEPUIS LE 1er JANVIER 2026
// Lois n°23/052 et n°23/053 du 30 novembre 2023
// Le système cédulaire précédent (impôts séparés par catégorie) est remplacé
// par un système unifié IBP (Bénéfices) + IPR (Rémunérations) — terminologie officielle LF 2025.
// SI interrogé sur l'ancien système (IS/IRPP), signaler explicitement ce changement.
// Devise : CDF (Franc Congolais) — distinct du XAF Congo-Brazzaville (CG)
// Dernière mise à jour : 2025-12 (Loi de Finances signée 29/12/2025, réforme effective 2026-01-01)

// ═══════════════════════════════════════════════════════════════════════════════
// MÉTADONNÉES SOURCE
// ═══════════════════════════════════════════════════════════════════════════════

export const DATA_SOURCE  = 'Loi de Finances RDC N°25/060 du 29 décembre 2025 (Rapport sur les dépenses fiscales 2024, Ministère des Finances) + Avocats.cd + Deloitte'
export const LAST_UPDATE  = '2025-12' // LF signée 29/12/2025 — réforme effective 2026-01-01
export type  ConfidenceLevel = 'verified' | 'estimated' | 'to_verify'
export const DATA_CONFIDENCE: ConfidenceLevel = 'verified'

// ═══════════════════════════════════════════════════════════════════════════════
// IBP — Impôt sur les Bénéfices et Profits (anciennement IS dans terminologie RDC)
// ═══════════════════════════════════════════════════════════════════════════════

export const TAUX_IS = {
  // ── Taux standard ──────────────────────────────────────────────────────────
  taux_normal:              0.30,   // IBP standard 30% — [verified, LF N°25/060]
  // ── Impôt minimum (remplace taxe minimale si bénéfice nul/déficitaire) ────
  taxe_minimale_ca:         0.01,   // 1% du CA — [verified, LF N°25/060]
  impot_minimum_ge_fc:      2_500_000, // Plancher Grandes Entreprises : 2 500 000 FC — [verified, LF N°25/060]
  impot_minimum_me_fc:        750_000, // Plancher Moyennes Entreprises : 750 000 FC — [verified, LF N°25/060]
  impot_minimum_pe_fc:         30_000, // Plancher Petites Entreprises : 30 000 FC — [verified, LF N°25/060]
  // ── Régimes simplifiés PME (LF N°25/060) ──────────────────────────────────
  pe_taux_ventes:           0.01,   // PE : 1% sur ventes — [verified, LF N°25/060]
  pe_taux_prestations:      0.02,   // PE : 2% sur prestations de services — [verified, LF N°25/060]
  micro_forfait_fc:         30_000, // Micro-entreprises : forfait fixe 30 000 FC — [verified, LF N°25/060]
  // ── Gestion des pertes et plus-values ─────────────────────────────────────
  report_pertes_exercices:  3,      // max 3 exercices consécutifs (NOUVEAUTÉ 2026 — avant : illimité) [verified]
  plus_values_reevaluation_libre:  0.20,  // 20% — [verified]
  plus_values_reevaluation_legale: 0.05,  // 5% — [verified]
  prix_transfert_methodes_ocde: true,     // OCDE intégrées depuis réforme 2026 [verified]
} as const

// ═══════════════════════════════════════════════════════════════════════════════
// IPR — Impôt Professionnel sur les Rémunérations
// (anciennement IRPP dans terminologie pré-réforme)
// Barème marginal progressif — LF N°25/060 du 29/12/2025
// ⚠️ BARÈME ANNUEL EN FC (Francs Congolais)
// ═══════════════════════════════════════════════════════════════════════════════

export const IPR_RDC = {
  tranches: [
    { min: 0,          max: 524_160,    taux: 0.000 }, // 0%    : 0 – 524 160 FC
    { min: 524_160,    max: 1_428_000,  taux: 0.150 }, // 15%   : 524 161 – 1 428 000 FC
    { min: 1_428_000,  max: 2_700_000,  taux: 0.200 }, // 20%   : 1 428 001 – 2 700 000 FC
    { min: 2_700_000,  max: 4_620_000,  taux: 0.225 }, // 22,5% : 2 700 001 – 4 620 000 FC
    { min: 4_620_000,  max: 7_260_000,  taux: 0.250 }, // 25%   : 4 620 001 – 7 260 000 FC
    { min: 7_260_000,  max: 10_260_000, taux: 0.300 }, // 30%   : 7 260 001 – 10 260 000 FC
    { min: 10_260_000, max: 13_908_000, taux: 0.325 }, // 32,5% : 10 260 001 – 13 908 000 FC
    { min: 13_908_000, max: 16_824_000, taux: 0.350 }, // 35%   : 13 908 001 – 16 824 000 FC
    { min: 16_824_000, max: 22_956_000, taux: 0.375 }, // 37,5% : 16 824 001 – 22 956 000 FC
    { min: 22_956_000, max: Infinity,   taux: 0.400 }, // 40%   : au-delà de 22 956 001 FC
  ] as const,
  devise:       'CDF',
  base:         'Rémunération annuelle brute imposable',
  exoneration:  'Personnel diplomatique — Convention de Vienne (taux 0%)',
  source:       '[verified, LF N°25/060 du 29/12/2025]',
} as const

// ═══════════════════════════════════════════════════════════════════════════════
// IERE — Impôt Exceptionnel sur les Rémunérations des Expatriés
// ═══════════════════════════════════════════════════════════════════════════════

export const IERE_RDC = {
  taux:    0.25,   // 25% sur rémunérations versées au personnel expatrié — [verified, LF N°25/060]
  base:    'Rémunérations brutes des expatriés payées par l\'employeur en RDC',
  source:  '[verified, LF N°25/060 du 29/12/2025]',
} as const

// ═══════════════════════════════════════════════════════════════════════════════
// IM — Impôt sur les revenus des capitaux Mobiliers
// ═══════════════════════════════════════════════════════════════════════════════

export const IM_RDC = {
  taux:    0.20,   // 20% — [verified, LF N°25/060]
  assiette: 'Dividendes, intérêts, tantièmes, redevances, bons et obligations, revenus d\'actions et parts',
  source:  '[verified, LF N°25/060 du 29/12/2025]',
} as const

// ═══════════════════════════════════════════════════════════════════════════════
// TVA
// ═══════════════════════════════════════════════════════════════════════════════

export const TAUX_TVA = {
  taux_normal:              0.16,        // 16% — [verified, confirmé 3 sources + LF N°25/060]
  taux_zero:                0,           // exportations — [verified]
  taux_importation:         0.16,        // TVA à l'importation : 16% — [verified, LF N°25/060]
  seuil_assujettissement_cdf: 80_000_000, // CA ≥ 80 000 000 CDF/an — [verified]
  echeance_declaration:     '15 du mois suivant', // [verified]
  professions_liberales_sans_seuil: true,
  autoliquidation_b2b_taux: 0.16,
  facture_normalisee_obligatoire: true,
  facture_normalisee_depuis:      '2025-12-01',
} as const

// ═══════════════════════════════════════════════════════════════════════════════
// IRS — Impôt sur les Revenus des Services (non-résidents)
// ═══════════════════════════════════════════════════════════════════════════════

export const TAUX_RETENUE_SOURCE = {
  irs_services_non_residents: 0.14,   // IRS 14% — [verified, LF N°25/060]
} as const

// ═══════════════════════════════════════════════════════════════════════════════
// PATENTE
// ═══════════════════════════════════════════════════════════════════════════════

export const TAUX_PATENTE = {
  taux:     0.0035,  // ⚠️ [estimated] — à confirmer dans le cadre du nouveau système unifié 2026
  base:     'CA annuel',
  echeance: '31 mars', // [estimated — à confirmer]
} as const

// ─── Autres taxes vérifiées ─────────────────────────────────────────────────

export const AUTRES_TAXES = {
  taxe_mutation_immobiliere:         0.03,    // 3% (acquéreur) — [verified]
  revenu_locatif_kinshasa_total:     0.22,    // 22% total (20% retenu + 2% propriétaire) — [verified]
  revenu_locatif_retenu_locataire:   0.20,    // 20% — [verified]
  revenu_locatif_propriétaire:       0.02,    // 2% — [verified]
  forfait_cessation_grande:          500_000, // CDF
  forfait_cessation_moyenne:         250_000, // CDF
  forfait_cessation_petite:          30_000,  // CDF
} as const

// ═══════════════════════════════════════════════════════════════════════════════
// OBLIGATIONS & ÉCHÉANCES
// ═══════════════════════════════════════════════════════════════════════════════

export const OBLIGATIONS_FISCALES = [
  'IBP/IS : déclaration annuelle 30% (plancher impôt minimum selon taille entreprise)',
  'IPR : retenue à la source mensuelle sur rémunérations des salariés (barème 10 tranches)',
  'IERE : 25% retenu sur rémunérations du personnel expatrié',
  'IM : 20% sur dividendes, intérêts, redevances, revenus mobiliers',
  'IRS 14% sur services non-résidents',
  'TVA mensuelle (seuil 80 000 000 CDF ; professions libérales sans seuil)',
  'Facture normalisée e-UF/e-MCF (obligatoire depuis déc 2025)',
  'Autoliquidation TVA 16% B2B transfrontalière si fournisseur étranger sans représentant',
] as const

export interface EcheanceFiscale {
  nom:         string
  jour:        number
  mois:        number | null
  recurrence?: 'mensuelle' | 'annuelle' | 'trimestrielle'
}

export const ECHEANCES_FISCALES: EcheanceFiscale[] = [
  { nom: 'TVA mensuelle + IPR retenue',     jour: 15, mois: null, recurrence: 'mensuelle' },
  { nom: 'IBP annuel + impôt minimum',      jour: 30, mois: 4 },
  { nom: 'Patente annuelle',                jour: 31, mois: 3  },
]

export const REGLES_FISCALES = [
  '⚠️ RÉFORME 2026 : IS → IBP (Impôt Bénéfices et Profits), IRPP → IPR (Impôt Professionnel Rémunérations)',
  'IBP 30% bénéfice net — impôt minimum 1% CA (planchers : 2 500 000 FC GE / 750 000 FC ME / 30 000 FC PE)',
  'PE (Petites Entreprises) : IBP 1% sur ventes, 2% sur prestations (régime simplifié)',
  'Micro-entreprises : forfait fixe 30 000 FC',
  'IPR barème 10 tranches (0% à 40%) — montants annuels CDF — source LF N°25/060',
  'IERE 25% sur rémunérations du personnel expatrié',
  'IM 20% sur dividendes, intérêts, redevances, revenus mobiliers',
  'Report des pertes : limité à 3 exercices (NOUVEAUTÉ 2026 — avant : illimité)',
  'Plus-values : 20% réévaluation libre, 5% réévaluation légale',
  'Prix de transfert : méthodes OCDE intégrées depuis 2026',
  'TVA 16% — seuil 80M CDF/an ; professions libérales assujetties sans seuil ; 0% exportations',
  'IRS 14% sur services rendus en RDC par non-résidents',
  'Autoliquidation TVA 16% si fournisseur étranger sans représentant fiscal local',
  'Facture normalisée e-UF/e-MCF obligatoire depuis 1er décembre 2025',
  'Taxe mutation immobilière : 3% (acquéreur)',
  'Devise : CDF — distinct du XAF (Congo-Brazzaville)',
] as const

// ═══════════════════════════════════════════════════════════════════════════════
// FONCTIONS DE CALCUL
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Calcule l'IBP/IS RDC (réforme 2026).
 * Applique le plancher différencié selon la taille de l'entreprise.
 *
 * @param beneficeNet       - Bénéfice net imposable (CDF)
 * @param chiffreAffaires   - CA annuel HT (CDF)
 * @param taille            - Taille de l'entreprise : 'grande' | 'moyenne' | 'petite'
 */
export function calculerIS(
  beneficeNet: number,
  chiffreAffaires: number,
  taille: 'grande' | 'moyenne' | 'petite' = 'moyenne',
): number {
  if (beneficeNet > 0) return Math.round(beneficeNet * TAUX_IS.taux_normal)
  // Bénéfice nul ou déficitaire → impôt minimum = max(1% CA, plancher selon taille)
  const baseMinimum = Math.round(chiffreAffaires * TAUX_IS.taxe_minimale_ca)
  const plancher =
    taille === 'grande'  ? TAUX_IS.impot_minimum_ge_fc :
    taille === 'moyenne' ? TAUX_IS.impot_minimum_me_fc :
                           TAUX_IS.impot_minimum_pe_fc
  return Math.max(baseMinimum, plancher)
}

/**
 * Calcule l'IPR RDC (Impôt Professionnel sur Rémunérations) — réforme 2026.
 * Barème marginal progressif à 10 tranches, source LF N°25/060 du 29/12/2025.
 * ⚠️ Remplace l'ancien barème IRPP : NE PAS utiliser les tranches en dizaines de millions FC.
 *
 * @param remunerationAnnuelle - Rémunération brute annuelle imposable (CDF)
 * @returns IPR annuel (CDF)
 */
export function calculerIPR(remunerationAnnuelle: number): number {
  if (remunerationAnnuelle <= 0) return 0
  let impot = 0
  for (const { min, max, taux } of IPR_RDC.tranches) {
    if (remunerationAnnuelle <= min) break
    const base = Math.min(remunerationAnnuelle, max) - min
    impot += Math.round(base * taux)
  }
  return impot
}

/**
 * Calcule la TVA RDC (16%).
 *
 * @param montantHT - Montant hors taxes (CDF)
 */
export function calculerTVA(montantHT: number): number {
  return Math.round(montantHT * TAUX_TVA.taux_normal)
}

/**
 * Calcule la retenue à la source RDC.
 * Types : 'irs' (14%), 'iere' (25%), 'im' (20%)
 *
 * @param montant      - Montant brut (CDF)
 * @param typeRevenu   - 'irs' | 'iere' | 'im'
 */
export function calculerRetenueSource(montant: number, typeRevenu: string): number {
  const taux: Record<string, number> = {
    irs:   TAUX_RETENUE_SOURCE.irs_services_non_residents, // 14%
    iere:  IERE_RDC.taux,                                  // 25%
    im:    IM_RDC.taux,                                    // 20%
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
 *
 * @param montantService - Montant du service (CDF ou devise étrangère convertie)
 */
export function calculerAutoliquidationTVA(montantService: number): number {
  return Math.round(montantService * TAUX_TVA.autoliquidation_b2b_taux)
}

// ─── Exports nommés ────────────────────────────────────────────────────────────

export const IS_RDC = {
  taux_normal:              TAUX_IS.taux_normal,
  taxe_minimale_ca:         TAUX_IS.taxe_minimale_ca,
  report_pertes_max:        TAUX_IS.report_pertes_exercices,
  impot_minimum_ge_fc:      TAUX_IS.impot_minimum_ge_fc,
  impot_minimum_me_fc:      TAUX_IS.impot_minimum_me_fc,
  impot_minimum_pe_fc:      TAUX_IS.impot_minimum_pe_fc,
  pe_taux_ventes:           TAUX_IS.pe_taux_ventes,
  pe_taux_prestations:      TAUX_IS.pe_taux_prestations,
  micro_forfait_fc:         TAUX_IS.micro_forfait_fc,
} as const

export const TVA_RDC = {
  taux_normal:              TAUX_TVA.taux_normal,
  taux_importation:         TAUX_TVA.taux_importation,
  seuil_assujettissement:   TAUX_TVA.seuil_assujettissement_cdf,
  echeance:                 TAUX_TVA.echeance_declaration,
  autoliquidation_b2b:      TAUX_TVA.autoliquidation_b2b_taux,
} as const

// ═══════════════════════════════════════════════════════════════════════════════
// CONTEXTE MIAA+ EXPERT FISCAL
// ═══════════════════════════════════════════════════════════════════════════════

export const MIAA_FISCAL_CONTEXT = {
  country:               'CD',
  countryName:           'République Démocratique du Congo',
  currency:              'CDF',
  administrationFiscale: 'Direction Générale des Impôts (DGI RDC)',
  systemeFiscal:         'OHADA / SYSCOHADA — LF N°25/060 du 29/12/2025 (réforme IBP+IPR effective 2026)',
  expertName:            'MIAA+ Expert Fiscal RDC',
  dataConfidence:        DATA_CONFIDENCE,
  specificites: [
    '⚠️ RÉFORME 2026 : IS → IBP (Impôt Bénéfices et Profits), IRPP → IPR (Impôt Professionnel Rémunérations)',
    'IBP 30% bénéfice net — impôt minimum 1% CA (planchers : 2 500 000 FC GE / 750 000 FC ME / 30 000 FC PE)',
    'PE : IBP 1% sur ventes / 2% sur prestations ; Micro : forfait fixe 30 000 FC',
    'IPR barème marginal 10 tranches (0% à 40%) — source officielle LF N°25/060 — montants annuels CDF',
    'IERE 25% sur rémunérations du personnel expatrié',
    'IM 20% sur dividendes, intérêts, redevances et revenus des capitaux mobiliers',
    'IRS 14% sur services rendus en RDC par non-résidents',
    'TVA 16% — seuil 80 000 000 CDF/an ; 0% exportations ; professions libérales sans seuil',
    'Facture normalisée e-UF/e-MCF obligatoire depuis décembre 2025',
    'Autoliquidation TVA 16% B2B si fournisseur étranger sans représentant fiscal local',
    'Report des pertes limité à 3 exercices (avant : illimité)',
    'Méthodes prix de transfert OCDE intégrées depuis 2026',
    'Devise : CDF (Franc Congolais) — distinct du XAF Congo-Brazzaville',
  ],
} as const

// SOURCE: Central Africa Tax Guide (nov 2023) + Rivermate (fév 2025)
// IRPP tranches intermédiaires estimées (seule tranche >20M XAF à 25% est vérifiée)
// IS taux estimé par cohérence CEMAC — à confirmer
// Dernière mise à jour : 2025-02

// ═══════════════════════════════════════════════════════════════════════════════
// MÉTADONNÉES SOURCE
// ═══════════════════════════════════════════════════════════════════════════════

export const DATA_SOURCE  = 'Central Africa Tax Guide (nov 2023) + Rivermate (fév 2025)'
export const LAST_UPDATE  = '2025-02'
export type  ConfidenceLevel = 'verified' | 'estimated' | 'to_verify'
export const DATA_CONFIDENCE: ConfidenceLevel = 'estimated' // IRPP tranches + IS taux estimés

// ═══════════════════════════════════════════════════════════════════════════════
// IRPP — barème progressif annuel
// ═══════════════════════════════════════════════════════════════════════════════

export interface TrancheIRPP {
  min:     number
  max:     number
  taux:    number
  libelle: string
  source:  ConfidenceLevel
}

// Seule la tranche supérieure (>20M XAF → 25%) est vérifiée.
// Les tranches intermédiaires sont estimées par cohérence avec les pays CEMAC voisins.
export const TRANCHES_IRPP_GQ: TrancheIRPP[] = [
  { min: 0,           max: 1_500_000,  taux: 0,    libelle: '0 — 1 500 000 XAF',          source: 'estimated' },
  { min: 1_500_000,   max: 5_000_000,  taux: 0.10, libelle: '1 500 001 — 5 000 000 XAF',  source: 'estimated' },
  { min: 5_000_000,   max: 10_000_000, taux: 0.15, libelle: '5 000 001 — 10 000 000 XAF', source: 'estimated' },
  { min: 10_000_000,  max: 20_000_000, taux: 0.20, libelle: '10 000 001 — 20 000 000 XAF',source: 'estimated' },
  { min: 20_000_000,  max: Infinity,   taux: 0.25, libelle: 'Au-delà de 20 000 000 XAF',  source: 'verified'  },
]

// ═══════════════════════════════════════════════════════════════════════════════
// TAUX STANDARDS
// ═══════════════════════════════════════════════════════════════════════════════

export const TAUX_IS = {
  // TODO: confirmer le taux IS Guinée Équatoriale — estimé 25% par cohérence CEMAC
  taux_normal: 0.25,   // ⚠️ [estimated] — à confirmer DGI GQ
  // MIT (Impôt Minimum des Sociétés) : 2 paiements annuels obligatoires
  mit_paiements_annuels: 2,          // [verified]
  mit_option_simplifiee: true,       // option simplifiée petits contribuables — [verified]
  amortissement_taux_minimum: 0.05,  // 5% — [verified]
  amortissement_taux_maximum: 1.00,  // 100% (amort. accéléré autorisé) — [verified]
} as const

export const TAUX_TVA = {
  taux_normal:  0.15,   // 15% — [verified, confirmé 2 sources]
  taux_reduit:  0.06,   // 6% — produits de base, livres — [verified]
  taux_zero:    0,      // exportations + liste CGI — [verified]
  echeance_declaration: '15 du mois suivant', // [verified]
} as const

export const TAUX_RETENUE_SOURCE = {
  // Personnes physiques non-résidentes
  individus_non_residents:                  0.20,   // 20% revenu brut — [verified]
  // Dividendes vers entreprises étrangères
  dividendes_entreprises_etrangeres:        0.25,   // 25% — [verified]
  // Secteur pétrolier/minier
  contractants_sous_traitants_non_residents: 0.10,  // 10% pétrolier/minier non-résidents — [verified]
  contractants_residents_petrolier:          0.03,  // 3% résidents secteur pétrolier — [verified]
  // Services spécifiques
  services_mobilisation_demobilisation:      0.05,  // 5% mobilisation/démobilisation/transport — [verified]
} as const

export const TAUX_PATENTE = {
  // TODO: confirmer le taux exact Patente GQ — non précisé dans nos sources
  taux:     0.0035,      // ⚠️ [estimated] — estimé par cohérence CEMAC
  base:     'CA annuel',
  echeance: '31 janvier', // [estimated CEMAC]
} as const

// ─── Autres données vérifiées ───────────────────────────────────────────────

export const DONNEES_SOCIALES = {
  smig_mensuel:              129_035,   // XAF — [verified]
  residence_fiscale_mois:    3,         // >3 mois/an = résident fiscal — [verified]
  residence_fiscale_alt_mois: 6,        // ou 6 mois sur 2 années civiles — [verified]
  irpp_versement_echeance:   '15 premiers jours du mois suivant', // [verified]
} as const

// ═══════════════════════════════════════════════════════════════════════════════
// OBLIGATIONS & ÉCHÉANCES
// ═══════════════════════════════════════════════════════════════════════════════

export const OBLIGATIONS_FISCALES = [
  'TVA mensuelle',
  'IRPP — retenue salariale mensuelle (15 premiers jours du mois suivant)',
  'MIT (Impôt Minimum des Sociétés) — 2 paiements annuels obligatoires',
  'Patente annuelle',
] as const

export interface EcheanceFiscale {
  nom:         string
  jour:        number
  mois:        number | null
  recurrence?: 'mensuelle' | 'annuelle' | 'trimestrielle'
}

export const ECHEANCES_FISCALES: EcheanceFiscale[] = [
  { nom: 'TVA mensuelle',                       jour: 15, mois: null, recurrence: 'mensuelle' },
  { nom: 'Retenue IRPP salaires',               jour: 15, mois: null, recurrence: 'mensuelle' },
  { nom: 'MIT — 1er paiement (estimé juin)',    jour: 30, mois: 6   },
  { nom: 'MIT — 2e paiement (estimé décembre)', jour: 31, mois: 12  },
]

export const REGLES_FISCALES = [
  'IRPP progressif : taux max 25% pour revenus > 20 000 000 XAF/an [verified] — tranches intermédiaires estimées',
  'TVA standard 15% ; réduit 6% (produits de base, livres) ; zéro exportations',
  'Retenue source 20% individus non-résidents ; 25% dividendes entreprises étrangères',
  'Retenue source secteur pétrolier/minier : 10% non-résidents, 3% résidents',
  'Résidence fiscale : >3 mois/an OU 6 mois sur 2 années civiles',
  'MIT : 2 paiements annuels obligatoires (option simplifiée petits contribuables)',
  'SMIG : 129 035 XAF/mois',
  'Amortissements : taux minimum 5%, maximum 100%',
  '⚠️ Taux IS estimé à 25% par cohérence CEMAC — à confirmer DGI GQ',
  '⚠️ Taux Patente estimé 0,35% — à confirmer',
] as const

// ═══════════════════════════════════════════════════════════════════════════════
// FONCTIONS DE CALCUL
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Calcule l'IRPP annuel Guinée Équatoriale (barème progressif).
 * Note : tranches intermédiaires estimées — seule la tranche >20M XAF (25%) est vérifiée.
 *
 * @param revenuAnnuelBrut - Revenu annuel brut (XAF)
 */
export function calculerIRPP(revenuAnnuelBrut: number): {
  irpp:            number
  tranches_detail: { libelle: string; base: number; impot: number; source: ConfidenceLevel }[]
} {
  let irpp = 0
  const tranches_detail: { libelle: string; base: number; impot: number; source: ConfidenceLevel }[] = []
  for (const t of TRANCHES_IRPP_GQ) {
    if (revenuAnnuelBrut <= t.min) break
    const base  = Math.min(revenuAnnuelBrut, t.max) - t.min
    const impot = Math.round(base * t.taux)
    irpp += impot
    tranches_detail.push({ libelle: t.libelle, base, impot, source: t.source })
  }
  return { irpp, tranches_detail }
}

/**
 * Calcule l'IS Guinée Équatoriale (taux estimé à 25%).
 * ⚠️ Taux non confirmé — à vérifier DGI GQ.
 *
 * @param beneficeNet       - Bénéfice net imposable (XAF)
 * @param chiffreAffaires   - CA annuel HT (XAF) — non utilisé (pas de minimum CA connu)
 */
export function calculerIS(beneficeNet: number, chiffreAffaires: number): number {
  void chiffreAffaires // pas de minimum sur CA connu pour GQ
  return Math.round(Math.max(0, beneficeNet) * TAUX_IS.taux_normal)
}

/**
 * Calcule la TVA Guinée Équatoriale.
 *
 * @param montantHT  - Montant hors taxes (XAF)
 * @param tauxReduit - true pour taux réduit 6% (produits de base, livres)
 */
export function calculerTVA(montantHT: number, tauxReduit = false): number {
  const taux = tauxReduit ? TAUX_TVA.taux_reduit : TAUX_TVA.taux_normal
  return Math.round(montantHT * taux)
}

/**
 * Calcule la retenue à la source Guinée Équatoriale.
 *
 * @param montant      - Montant brut (XAF)
 * @param typeRevenu   - 'individu_non_resident' | 'dividende_etranger' |
 *                       'petrolier_non_resident' | 'petrolier_resident' | 'mobilisation'
 */
export function calculerRetenueSource(montant: number, typeRevenu: string): number {
  const taux: Record<string, number> = {
    individu_non_resident:     TAUX_RETENUE_SOURCE.individus_non_residents,
    dividende_etranger:        TAUX_RETENUE_SOURCE.dividendes_entreprises_etrangeres,
    petrolier_non_resident:    TAUX_RETENUE_SOURCE.contractants_sous_traitants_non_residents,
    petrolier_resident:        TAUX_RETENUE_SOURCE.contractants_residents_petrolier,
    mobilisation:              TAUX_RETENUE_SOURCE.services_mobilisation_demobilisation,
  }
  return Math.round(montant * (taux[typeRevenu] ?? 0))
}

/**
 * Calcule la Patente Guinée Équatoriale.
 * ⚠️ Taux estimé — à confirmer.
 *
 * @param chiffreAffaires - CA annuel HT (XAF)
 */
export function calculerPatente(chiffreAffaires: number): number {
  return Math.round(chiffreAffaires * TAUX_PATENTE.taux)
}

// ─── Exports nommés ────────────────────────────────────────────────────────────

export const TVA_GQ = {
  taux_normal:  TAUX_TVA.taux_normal,
  taux_reduit:  TAUX_TVA.taux_reduit,
  echeance:     TAUX_TVA.echeance_declaration,
} as const

export const IRPP_GQ = {
  tranches:     TRANCHES_IRPP_GQ,
  taux_max:     0.25,
  seuil_taux_max: 20_000_000,
} as const

// ═══════════════════════════════════════════════════════════════════════════════
// CONTEXTE MIAA+ EXPERT FISCAL
// ═══════════════════════════════════════════════════════════════════════════════

export const MIAA_FISCAL_CONTEXT = {
  country:               'GQ',
  countryName:           'Guinée Équatoriale',
  currency:              'XAF',
  administrationFiscale: 'Direction Générale des Impôts (DGI Guinée Équatoriale)',
  systemeFiscal:         'OHADA / SYSCOHADA, zone CEMAC',
  expertName:            'MIAA+ Expert Fiscal Guinée Équatoriale',
  dataConfidence:        DATA_CONFIDENCE,
  specificites: [
    'TVA 15% standard ; 6% réduit (produits de base, livres) ; 0% exportations',
    'IRPP progressif : max 25% au-delà de 20 000 000 XAF [verified] — tranches inférieures estimées',
    'IS estimé à 25% par cohérence CEMAC — à confirmer auprès de la DGI GQ',
    'MIT (Impôt Minimum des Sociétés) : 2 paiements annuels obligatoires',
    'Retenue source : 20% individus non-résidents ; 25% dividendes entreprises étrangères',
    'Retenue secteur pétrolier/minier : 10% non-résidents, 3% résidents',
    'Résidence fiscale : >3 mois/an ou 6 mois sur 2 années civiles',
    'SMIG : 129 035 XAF/mois',
    '⚠️ Données partiellement estimées — confirmer IS et tranches IRPP auprès de la DGI GQ',
  ],
} as const

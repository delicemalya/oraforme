// SOURCE: Central Africa Tax Guide 2023 + CGI Cameroun 2026 (Art. 17, 17bis, 17quater)
// ⚠️ Vérifier les éventuelles modifications de la Loi de Finances 2026 sur TVA/IRPP avant mise en production
// Dernière mise à jour : 2026-06-18

// ═══════════════════════════════════════════════════════════════════════════════
// INTERFACES
// ═══════════════════════════════════════════════════════════════════════════════

export interface TrancheIRPPCameroun {
  min:     number
  max:     number
  taux:    number
  libelle: string
}

export interface TranchePatenteCameroun {
  label:  string   // 'PE' | 'ME' | 'GE'
  caMin:  number
  caMax:  number
  taux:   number
}

export interface FiscaliteCamerounConfig {
  tva: {
    // Décomposition informative : 17,25% base TVA + 10% CAC sur TVA (source 2023)
    // Le calcul utilise uniquement taux_effectif = 19,25% — taux officiel appliqué en pratique
    taux_effectif:        number   // 19,25% — taux de calcul officiel (Central Africa Tax Guide 2023)
    taux_zero:            string
    echeance_declaration: string
    source:               string
  }
  irpp: {
    tranches:                  TrancheIRPPCameroun[]
    centimes_additionnels_com: number   // 10% sur l'IRPP calculé
    source:                    string
  }
  patente: {
    tranches:  TranchePatenteCameroun[]
    echeance:  string
    source:    string
  }
  prelevements_salariaux: {
    credit_foncier_salarie:    number   // 1% sur salaire brut — mensuel
    credit_foncier_patronal:   number   // 1,5% sur salaire brut — mensuel
    fne_patronal:              number   // 1% sur salaire brut — mensuel
    redevance_crtv:            string   // barème à préciser
    source:                    string
  }
  droits_enregistrement: {
    vente_fonds_commerce:      number   // 15%
    transactions_immobilieres: number   // 10%
    baux_illimites:            number   // 15%
    baux_habitation:           number   // 5%
    source:                    string
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTANTE MAÎTRE — FISCALITE_CAMEROUN_2023
// ═══════════════════════════════════════════════════════════════════════════════

export const FISCALITE_CAMEROUN_2023: FiscaliteCamerounConfig = {

  // ── TVA ───────────────────────────────────────────────────────────────────
  // Décomposition informative (source 2023) : 17,25% base + 10% CAC sur TVA
  tva: {
    taux_effectif:        0.1925,   // 19,25% — taux officiel appliqué en pratique
    taux_zero:            'Exportations',
    echeance_declaration: '15 du mois suivant',
    source:               'Central Africa Tax Guide 2023 — ⚠️ À vérifier vs LF 2026',
  },

  // ── IRPP ──────────────────────────────────────────────────────────────────
  irpp: {
    tranches: [
      { min: 0,          max: 2_000_000, taux: 0.10, libelle: '0 — 2 000 000 FCFA'            },
      { min: 2_000_000,  max: 3_000_000, taux: 0.15, libelle: '2 000 000 — 3 000 000 FCFA'   },
      { min: 3_000_000,  max: 5_000_000, taux: 0.25, libelle: '3 000 000 — 5 000 000 FCFA'   },
      { min: 5_000_000,  max: Infinity,  taux: 0.35, libelle: 'Au-delà de 5 000 000 FCFA'    },
    ],
    centimes_additionnels_com: 0.10,   // 10% sur le montant IRPP calculé
    source: 'Central Africa Tax Guide 2023 — ⚠️ À vérifier vs LF 2026',
  },

  // ── PATENTE ───────────────────────────────────────────────────────────────
  // Barème dégressif par catégorie d'entreprise (CA annuel HT)
  patente: {
    tranches: [
      { label: 'PE', caMin: 0,              caMax: 50_000_000,     taux: 0.00494 },  // 0,494%
      { label: 'ME', caMin: 50_000_000,     caMax: 3_000_000_000,  taux: 0.00283 },  // 0,283%
      { label: 'GE', caMin: 3_000_000_000,  caMax: Infinity,       taux: 0.00159 },  // 0,159%
    ],
    echeance: '28 février de chaque année',
    source:   'Central Africa Tax Guide 2023',
  },

  // ── Prélèvements salariaux hors IRPP ─────────────────────────────────────
  prelevements_salariaux: {
    credit_foncier_salarie:  0.01,    // 1% salarié — sur salaire brut — mensuel
    credit_foncier_patronal: 0.015,   // 1,5% employeur — sur salaire brut — mensuel
    fne_patronal:            0.01,    // 1% employeur (FNE) — sur salaire brut — mensuel
    redevance_crtv:          'Barème à préciser — voir DGI Cameroun',
    source:                  'Central Africa Tax Guide 2023',
  },

  // ── Droits d'enregistrement ───────────────────────────────────────────────
  droits_enregistrement: {
    vente_fonds_commerce:      0.15,   // 15%
    transactions_immobilieres: 0.10,   // 10%
    baux_illimites:            0.15,   // 15%
    baux_habitation:           0.05,   // 5%
    source:                    'Central Africa Tax Guide 2023 — pertinent module Cabinet',
  },
}

// ═══════════════════════════════════════════════════════════════════════════════
// FONCTIONS DE CALCUL
// ═══════════════════════════════════════════════════════════════════════════════

const C = FISCALITE_CAMEROUN_2023  // alias court

/**
 * Calcule la TVA Cameroun au taux officiel de 19,25%.
 * Décomposition informative : 17,25% base TVA + 10% CAC sur TVA (non utilisée en calcul).
 *
 * @param montantHT  - Montant hors taxes (FCFA)
 * @param taux_zero  - true si exportation (taux zéro)
 * @returns tva, ttc, taux appliqué
 *
 * @example
 * calculerTVACameroun(100_000)
 * // tva = 19 250 FCFA, ttc = 119 250 FCFA
 */
export function calculerTVACameroun(
  montantHT: number,
  taux_zero?: boolean,
): { tva: number; ttc: number; tauxApplique: number } {
  if (taux_zero) {
    return { tva: 0, ttc: montantHT, tauxApplique: 0 }
  }
  const tva = Math.round(montantHT * C.tva.taux_effectif)
  const ttc = montantHT + tva
  return { tva, ttc, tauxApplique: C.tva.taux_effectif }
}

/**
 * Calcule l'IRPP Cameroun sur base de revenu annuel imposable.
 * Barème progressif 4 tranches + 10% centimes additionnels communaux.
 *
 * @param revenuAnnuelImposable  - Revenu annuel imposable (FCFA)
 * @returns IRPP brut, centimes additionnels, IRPP total dû
 *
 * @example
 * calculerIRPPCameroun(4_000_000)
 * // T1 (10%) : 2 000 000 × 10% = 200 000
 * // T2 (15%) : 1 000 000 × 15% = 150 000
 * // T3 (25%) : 1 000 000 × 25% = 250 000
 * // IRPP brut = 600 000 ; CAC = 60 000 ; IRPP total = 660 000 FCFA
 */
export function calculerIRPPCameroun(revenuAnnuelImposable: number): {
  irpp_brut:             number
  centimes_additionnels: number
  irpp_total:            number
  tranches_detail:       { libelle: string; base: number; impot: number }[]
} {
  let irpp_brut      = 0
  const tranches_detail: { libelle: string; base: number; impot: number }[] = []

  for (const t of C.irpp.tranches) {
    if (revenuAnnuelImposable <= t.min) break
    const base  = Math.min(revenuAnnuelImposable, t.max) - t.min
    const impot = Math.round(base * t.taux)
    irpp_brut  += impot
    tranches_detail.push({ libelle: t.libelle, base, impot })
  }

  const centimes_additionnels = Math.round(irpp_brut * C.irpp.centimes_additionnels_com)
  const irpp_total            = irpp_brut + centimes_additionnels

  return { irpp_brut, centimes_additionnels, irpp_total, tranches_detail }
}

/**
 * Calcule la Patente Cameroun selon la catégorie d'entreprise (CA annuel HT).
 * Barème dégressif : PE 0,494% / ME 0,283% / GE 0,159%.
 *
 * @param caAnnuelHT - Chiffre d'affaires annuel hors taxes (FCFA)
 * @returns Catégorie, taux applicable, montant de patente
 *
 * @example
 * calculerPatenteCameroun(20_000_000)
 * // PE (CA ≤ 50M) → taux 0,494% → patente = 98 800 FCFA
 *
 * calculerPatenteCameroun(500_000_000)
 * // ME (50M — 3Mds) → taux 0,283% → patente = 1 415 000 FCFA
 */
export function calculerPatenteCameroun(caAnnuelHT: number): {
  label:   string
  taux:    number
  montant: number
} {
  if (caAnnuelHT <= 0) return { label: 'N/A', taux: 0, montant: 0 }
  for (const t of C.patente.tranches) {
    if (caAnnuelHT <= t.caMax) {
      return { label: t.label, taux: t.taux, montant: Math.round(caAnnuelHT * t.taux) }
    }
  }
  const derniere = C.patente.tranches[C.patente.tranches.length - 1]
  return { label: derniere.label, taux: derniere.taux, montant: Math.round(caAnnuelHT * derniere.taux) }
}

/**
 * Calcule les prélèvements salariaux Cameroun hors IRPP.
 * Crédit Foncier (1% salarié + 1,5% employeur) + FNE (1% employeur).
 *
 * @param salaireBrut - Salaire brut mensuel (FCFA)
 * @returns Détail des prélèvements salarié et employeur
 */
export function calculerPrelevementsSalariauxCameroun(salaireBrut: number): {
  credit_foncier_salarie:  number
  credit_foncier_patronal: number
  fne_patronal:            number
  total_retenu_salarie:    number
  total_charge_patronale:  number
} {
  const credit_foncier_salarie  = Math.round(salaireBrut * C.prelevements_salariaux.credit_foncier_salarie)
  const credit_foncier_patronal = Math.round(salaireBrut * C.prelevements_salariaux.credit_foncier_patronal)
  const fne_patronal            = Math.round(salaireBrut * C.prelevements_salariaux.fne_patronal)

  return {
    credit_foncier_salarie,
    credit_foncier_patronal,
    fne_patronal,
    total_retenu_salarie:   credit_foncier_salarie,
    total_charge_patronale: credit_foncier_patronal + fne_patronal,
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// UTILITAIRES
// ═══════════════════════════════════════════════════════════════════════════════

export function formaterMontantCameroun(n: number): string {
  return new Intl.NumberFormat('fr-FR').format(Math.round(n)) + ' FCFA'
}

// ── Exports nommés (compatibilité inter-modules) ───────────────────────────────

export const TVA_CAMEROUN = {
  taux_effectif: C.tva.taux_effectif,
  echeance:      C.tva.echeance_declaration,
} as const

export const IRPP_CAMEROUN = {
  tranches:                  C.irpp.tranches,
  centimes_additionnels_com: C.irpp.centimes_additionnels_com,
} as const

export const PATENTE_CAMEROUN = {
  tranches: C.patente.tranches,
  echeance: C.patente.echeance,
} as const

export const CHARGES_SALARIALES_CAMEROUN = {
  credit_foncier_salarie:  C.prelevements_salariaux.credit_foncier_salarie,
  credit_foncier_patronal: C.prelevements_salariaux.credit_foncier_patronal,
  fne_patronal:            C.prelevements_salariaux.fne_patronal,
} as const

export const DROITS_ENREGISTREMENT_CAMEROUN = C.droits_enregistrement

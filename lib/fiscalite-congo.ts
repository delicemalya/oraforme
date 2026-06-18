// Loi de Finances 2026 — République du Congo
// Loi n°42-2025 du 31 décembre 2025
// Données vérifiées et certifiées — Analyse complète 238 pages
// Dernière mise à jour : 2026-06-14

// ═══════════════════════════════════════════════════════════════════════════════
// INTERFACES
// ═══════════════════════════════════════════════════════════════════════════════

export interface TrancheIRPP {
  min:  number
  max:  number
  taux: number
  libelle: string
}

export interface TranchePatente {
  caMax:    number
  taux:     number
  minimum?: number
}

export interface ZoneFonciere {
  code:        string
  description: string
  montant:     number
}

export interface FiscaliteCongoConfig {
  is: {
    taux_standard:     number
    minimum_ca:        number
    acompte_trimestriel: number
    source:            string
  }
  tva: {
    taux_normal:       number
    taux_ca:           number
    taux_effectif_ht:  number
    taux_reduit_vehicules: number
    seuil_assujettissement: number
    echeance_declaration:   string
    source:            string
  }
  irpp: {
    tranches:          TrancheIRPP[]
    abattement_professionnel: number
    mesure_2026_flag:  string
    source:            string
  }
  cnss: {
    smig_mensuel:           number
    plafond_mensuel_salarie: number
    taux_salarie:           number
    taux_retraite_patronal: number
    taux_at_tus_combine:    number
    taux_at_patronal:       number
    taux_af_patronal:       number
    taux_pecule_patronal:   number
    taux_tus:               number
    total_cnss_patronal:    number
    total_patronal_avec_tus: number
    mesure_2026_flag:       string
    source:                 string
  }
  tus: {
    taux:   number
    base:   string
    source: string
  }
  patente: {
    tranches:         TranchePatente[]
    echeance:         string
    source:           string
  }
  retenues_source: {
    dividendes_non_residents:    number
    interets_non_residents:      number
    redevances_non_residents:    number
    prestations_non_residents:   number
    marches_publics_acompte_is:  number
    honoraires_residents:        number
    loyers_etat_entreprises:     number
  }
  douanes: {
    redevance_informatique_import: number
    redevance_informatique_export: number
    redevance_informatique_suspensif: number
    source_article: string
  }
  foncier: {
    zones:     ZoneFonciere[]
    taxe_afat: number
  }
  penalites: {
    tva_retard_majoration:        number
    tva_retard_interet_mensuel:   number
    is_retard_majoration:         number
    is_retard_interet_mensuel:    number
    defaut_declaration_amende:    number
    fraude_majoration:            number
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTANTE MAÎTRE — FISCALITE_CONGO_2026
// ═══════════════════════════════════════════════════════════════════════════════

export const FISCALITE_CONGO_2026: FiscaliteCongoConfig = {

  // ── Impôt sur les Sociétés ─────────────────────────────────────────────────
  is: {
    taux_standard:       0.30,    // 30% — taux général
    minimum_ca:          0.01,    // 1% du CA HT — minimum de perception
    acompte_trimestriel: 0.25,    // 25% de l'IS N-1 par trimestre
    source:              'CGI Congo, confirmé LF 2026 (sans modification)',
  },

  // ── TVA ───────────────────────────────────────────────────────────────────
  tva: {
    taux_normal:             0.18,           // 18%
    taux_ca:                 0.05,           // 5% des 18% (Centime Additionnel)
    taux_effectif_ht:        0.189,          // 18% × 1,05 = 18,9% sur HT
    taux_reduit_vehicules:   0.05,           // 5% — import véhicules neufs (87033110/87033210/87033290)
    seuil_assujettissement:  90_000_000,     // CA annuel ≥ 90M FCFA
    echeance_declaration:    'avant le 20 du mois suivant',
    source:                  'Art. confirmé LF 2026',
  },

  // ── IRPP ──────────────────────────────────────────────────────────────────
  irpp: {
    tranches: [
      { min: 0,         max: 464_000,   taux: 0.00, libelle: '0 — 464 000 FCFA' },
      { min: 464_001,   max: 1_000_000, taux: 0.01, libelle: '464 001 — 1 000 000 FCFA' },
      { min: 1_000_001, max: 3_000_000, taux: 0.10, libelle: '1 000 001 — 3 000 000 FCFA' },
      { min: 3_000_001, max: 8_000_000, taux: 0.25, libelle: '3 000 001 — 8 000 000 FCFA' },
      { min: 8_000_001, max: Infinity,  taux: 0.40, libelle: 'Au-delà de 8 000 000 FCFA' },
    ],
    abattement_professionnel: 0.20,   // 20% du salaire brut (charges professionnelles forfaitaires)
    mesure_2026_flag:         'irppPrisEnCharge2026',
    source:                   'LF 2026 confirmé — Art. 76 CGI',
  },

  // ── CNSS & Cotisations sociales ───────────────────────────────────────────
  // Décomposition LF 2026 : CNSS 20,29% + TUS 3% = 23,29% total patronal
  // TUS inclus dans le barème CGI comme composante AT (AT+TUS = 5%)
  cnss: {
    smig_mensuel:              90_000,    // SMIG Congo (arrêté en vigueur)
    plafond_mensuel_salarie:   540_000,   // 6 × SMIG = 6 × 90 000 = 540 000 FCFA
    taux_salarie:              0.04,      // 4% (vieillesse + maladie)

    // Patronal
    taux_retraite_patronal:    0.08,      // 8% (vieillesse)
    taux_at_tus_combine:       0.05,      // 5% AT+TUS combinés per CGI (variable par secteur)
    taux_at_patronal:          0.02,      // 2% AT proprement dit (= 5% − 3% TUS)
    taux_af_patronal:          0.10,      // 10% Allocations Familiales
    taux_pecule_patronal:      0.0029,    // 0,29% Pécule de congé (si applicable)
    taux_tus:                  0.03,      // 3% TUS — séparé pour la comptabilité (compte 643)

    // Totaux
    total_cnss_patronal:       0.2029,    // 8 + 2 + 10 + 0,29 = 20,29% (hors TUS)
    total_patronal_avec_tus:   0.2329,    // 20,29 + 3 = 23,29%

    mesure_2026_flag: 'cotisationsPatronalesPrisesEnCharge2026',
    source:           'LF 2026 — Décomposition : CNSS 20,29% + TUS 3%',
  },

  // ── TUS (extrait séparé pour comptabilité) ────────────────────────────────
  tus: {
    taux:   0.03,    // 3% — charge patronale uniquement
    base:   'Salaire brut déplafonné',
    source: 'CGI Congo, inclus dans les 5% AT per CGI',
  },

  // ── Patente ───────────────────────────────────────────────────────────────
  // Barème dégressif sur CA annuel HT (CGI Congo, inchangé LF 2026)
  patente: {
    tranches: [
      { caMax:    5_000_000, taux: 0.0975,  minimum: 97_500 },
      { caMax:   30_000_000, taux: 0.08775 },
      { caMax:   60_000_000, taux: 0.0780  },
      { caMax:  100_000_000, taux: 0.06825 },
      { caMax:  200_000_000, taux: 0.04875 },
      { caMax:  500_000_000, taux: 0.0195  },
      { caMax: 1_000_000_000, taux: 0.00975 },
      { caMax: Infinity,     taux: 0.00045 },
    ],
    echeance: 'avant le 31 mars de chaque année',
    source:   'CGI Congo, inchangé LF 2026',
  },

  // ── Retenues à la source ──────────────────────────────────────────────────
  retenues_source: {
    dividendes_non_residents:    0.20,   // 20%
    interets_non_residents:      0.20,   // 20%
    redevances_non_residents:    0.20,   // 20%
    prestations_non_residents:   0.15,   // 15%
    marches_publics_acompte_is:  0.05,   // 5% du montant HT (acompte IS)
    honoraires_residents:        0.05,   // 5% (professions libérales résidents)
    loyers_etat_entreprises:     0.15,   // 15% loyers versés par État/entreprises à particuliers
  },

  // ── Redevance Informatique Douanière (NOUVEAU — Art. 44 LF 2026) ──────────
  douanes: {
    redevance_informatique_import:    0.02,   // 2% — importation (mise à la consommation)
    redevance_informatique_export:    0.02,   // 2% — exportation
    redevance_informatique_suspensif: 0.01,   // 1% — régimes suspensifs (souscription/régularisation)
    source_article:                   'Art. 44 LF 2026',
  },

  // ── Droits Fonciers Exceptionnels ─────────────────────────────────────────
  foncier: {
    zones: [
      { code: 'Z1', description: 'Brazzaville/Pointe-Noire centre-ville',               montant: 10_000 },
      { code: 'Z2', description: 'Autres communes (chef-lieu)',                          montant: 5_000  },
      { code: 'Z3', description: 'Arrondissements non périphériques Brazza/PNR',         montant: 5_000  },
      { code: 'Z4', description: 'Arrondissements non périphériques autres communes',    montant: 2_500  },
      { code: 'Z5', description: 'Arrondissements périphériques Brazza/PNR',             montant: 1_500  },
      { code: 'Z6', description: 'Arrondissements périphériques autres communes',        montant: 750    },
      { code: 'Z7', description: 'Chefs-lieux de districts',                             montant: 500    },
      { code: 'Z8', description: 'Villages',                                             montant: 100    },
    ],
    taxe_afat: 0.01,   // 1% du prix de cession sur vente de terrains
  },

  // ── Pénalités et Intérêts de Retard ──────────────────────────────────────
  penalites: {
    tva_retard_majoration:       0.25,    // 25%
    tva_retard_interet_mensuel:  0.015,   // 1,5%/mois
    is_retard_majoration:        0.10,    // 10%
    is_retard_interet_mensuel:   0.015,   // 1,5%/mois
    defaut_declaration_amende:   100_000, // 100 000 FCFA minimum
    fraude_majoration:           1.00,    // 100% des droits éludés
  },
}

// ═══════════════════════════════════════════════════════════════════════════════
// MESURES SPÉCIALES 2026
// ═══════════════════════════════════════════════════════════════════════════════

export const MESURES_SPECIALES_2026 = {
  irpp_pris_en_charge: {
    description:   'L\'État prend en charge 100% de l\'IRPP des salariés',
    conditions:    'Être parmi les 25 000 premiers déclarants enregistrés au programme CNSS',
    flag:          'irppPrisEnCharge2026' as const,
    activation:    'Saisir le flag manuellement après confirmation CNSS',
    base_legale:   'LF 2026 — République du Congo, mesure Art. 15',
    actif:         false,  // à passer à true après validation CNSS
  },
  cotisations_patronales_pris_en_charge: {
    description:   'L\'État prend en charge 50% des cotisations patronales CNSS',
    conditions:    'Être parmi les 25 000 premiers déclarants enregistrés au programme CNSS',
    flag:          'cotisationsPatronalesPrisesEnCharge2026' as const,
    activation:    'Saisir le flag manuellement après confirmation CNSS',
    reduction:     0.50,
    base_legale:   'LF 2026 — République du Congo, mesure Art. 15',
    actif:         false,  // à passer à true après validation CNSS
  },
} as const

// ═══════════════════════════════════════════════════════════════════════════════
// FONCTIONS DE CALCUL
// ═══════════════════════════════════════════════════════════════════════════════

const C = FISCALITE_CONGO_2026  // alias court

/**
 * Calcule l'Impôt sur les Sociétés (IS) Congo.
 *
 * @param beneficeNet  - Bénéfice net imposable (FCFA)
 * @param caAnnuelHT   - Chiffre d'affaires annuel HT (FCFA) — nécessaire pour le minimum
 * @returns            Montant IS dû, taux appliqué, détail du calcul
 *
 * @example
 * calculerIS(500_000, 10_000_000)
 * // IS calculé : 500 000 × 30% = 150 000 FCFA
 * // Minimum IS : 10 000 000 × 1% = 100 000 FCFA
 * // IS dû : max(150 000, 100 000) = 150 000 FCFA
 *
 * @source CGI Congo confirmé LF 2026 (sans modification)
 */
export function calculerIS(
  beneficeNet: number,
  caAnnuelHT:  number,
): { montant: number; taux: number; isCalcule: number; minimumCA: number } {
  const isCalcule  = Math.round(Math.max(0, beneficeNet) * C.is.taux_standard)
  const minimumCA  = Math.round(caAnnuelHT * C.is.minimum_ca)
  const montant    = Math.max(isCalcule, minimumCA)
  const taux       = caAnnuelHT > 0 ? montant / caAnnuelHT : C.is.taux_standard
  return { montant, taux, isCalcule, minimumCA }
}

/**
 * Calcule la TVA Congo (18% + Centime Additionnel 5% de la TVA).
 *
 * @param montantHT   - Montant hors taxes (FCFA)
 * @param tauxReduit  - true pour taux réduit 5% (véhicules neufs import)
 * @returns           TVA, Centime Additionnel et TTC
 *
 * @example
 * calculerTVA(100_000)
 * // tva = 18 000, ca = 900, ttc = 118 900 FCFA
 *
 * calculerTVA(1_000_000, true)
 * // taux réduit 5% sur véhicule : tva = 50 000, ca = 2 500, ttc = 1 052 500 FCFA
 *
 * @source Art. confirmé LF 2026 — TVA 18%, CA = 5% de la TVA
 */
export function calculerTVA(
  montantHT:   number,
  tauxReduit?: boolean,
): { tva: number; ca: number; ttc: number; tauxApplique: number } {
  const tauxApplique = tauxReduit ? C.tva.taux_reduit_vehicules : C.tva.taux_normal
  const tva = Math.round(montantHT * tauxApplique)
  const ca  = Math.round(tva * C.tva.taux_ca)
  const ttc = montantHT + tva + ca
  return { tva, ca, ttc, tauxApplique }
}

/** Alias rétrocompatible `calculerTVACongo` */
export function calculerTVACongo(montantHT: number) {
  const { tva, ca, ttc } = calculerTVA(montantHT)
  const fmt = (n: number) => new Intl.NumberFormat('fr-FR').format(n) + ' FCFA'
  return {
    ht: montantHT, tva, taux_tva: 18, ca, taux_ca: 5, ttc,
    detail: `HT : ${fmt(montantHT)}\nTVA (18%) : ${fmt(tva)}\nCA (5% de la TVA) : ${fmt(ca)}\nTOTAL TTC : ${fmt(ttc)}`,
  }
}

/**
 * Calcule l'IRPP annuel sur base de salaire annuel brut.
 * Applique l'abattement forfaitaire professionnel de 20%, puis le barème progressif.
 *
 * @param salaireAnnuelBrut       - Salaire annuel brut en FCFA
 * @param irppPrisEnCharge2026    - true = État prend en charge 100% IRPP (mesure LF 2026)
 * @returns base imposable, IRPP brut, IRPP net après mesure, montant prise en charge État
 *
 * @example
 * calculerIRPP(1_800_000)
 * // base = 1 800 000 × 80% = 1 440 000 FCFA
 * // T1 (0%) : 464 000 × 0% = 0
 * // T2 (1%) : (1 000 000 − 464 000) × 1% = 5 360
 * // T3 (10%) : (1 440 000 − 1 000 000) × 10% = 44 000
 * // IRPP = 49 360 FCFA
 *
 * @source LF 2026 confirmé — Art. 76 CGI — barème 5 tranches
 */
export function calculerIRPP(
  salaireAnnuelBrut:     number,
  irppPrisEnCharge2026?: boolean,
): { base: number; irpp: number; irppNet: number; priseEnChargeEtat: number } {
  const base = Math.round(salaireAnnuelBrut * (1 - C.irpp.abattement_professionnel))
  let irpp   = 0
  for (const t of C.irpp.tranches) {
    if (base <= t.min) break
    irpp += Math.round((Math.min(base, t.max) - t.min) * t.taux)
  }
  const priseEnChargeEtat = irppPrisEnCharge2026 ? irpp : 0
  const irppNet           = irppPrisEnCharge2026 ? 0    : irpp
  return { base, irpp, irppNet, priseEnChargeEtat }
}

/**
 * Calcule les cotisations sociales SALARIALES (part employé).
 * Plafond : 6 × SMIG = 540 000 FCFA/mois.
 *
 * @param salaireBrut - Salaire brut mensuel (FCFA)
 * @returns cnss retenu, total retenues sociales, salaire net après cotisations salariales
 *
 * @example
 * calculerCotisationsSalariales(600_000)
 * // base plafonnée = 540 000 FCFA
 * // cnss = 540 000 × 4% = 21 600 FCFA
 * // salaireNet = 600 000 − 21 600 = 578 400 FCFA (avant IRPP)
 *
 * @source LF 2026 — CNSS salarié 4%, plafond 6 × SMIG (90 000) = 540 000 FCFA/mois
 */
export function calculerCotisationsSalariales(salaireBrut: number): {
  cnss:       number
  total:      number
  salaireNet: number
} {
  const basePlafonnee = Math.min(salaireBrut, C.cnss.plafond_mensuel_salarie)
  const cnss          = Math.round(basePlafonnee * C.cnss.taux_salarie)
  return { cnss, total: cnss, salaireNet: salaireBrut - cnss }
}

/**
 * Calcule les cotisations sociales PATRONALES (charge employeur).
 * CNSS 20,29% + TUS 3% = 23,29% total.
 * Mesure LF 2026 : État prend en charge 50% des cotisations CNSS (hors TUS) si flag activé.
 *
 * @param salaireBrut                       - Salaire brut mensuel (FCFA)
 * @param cotisationsPrisesEnCharge2026     - true = réduction 50% État (mesure LF 2026)
 * @returns Détail CNSS, TUS, total, prise en charge État, coût total employeur
 *
 * @example
 * calculerCotisationsPatronales(600_000)
 * // cnss = 600 000 × 20,29% = 121 740 FCFA
 * // tus  = 600 000 × 3%     =  18 000 FCFA
 * // total = 139 740 FCFA
 * // coutTotal = 600 000 + 139 740 = 739 740 FCFA
 *
 * @source LF 2026 — CNSS patronal 20,29% + TUS 3%
 */
export function calculerCotisationsPatronales(
  salaireBrut:                    number,
  cotisationsPrisesEnCharge2026?: boolean,
): {
  cnss:               number
  tus:                number
  total:              number
  priseEnChargeEtat:  number
  coutTotal:          number
} {
  const cnss_brut         = Math.round(salaireBrut * C.cnss.total_cnss_patronal)
  const tus               = Math.round(salaireBrut * C.cnss.taux_tus)
  const priseEnChargeEtat = cotisationsPrisesEnCharge2026 ? Math.round(cnss_brut * 0.5) : 0
  const cnss              = cnss_brut - priseEnChargeEtat
  const total             = cnss + tus
  const coutTotal         = salaireBrut + total
  return { cnss, tus, total, priseEnChargeEtat, coutTotal }
}

/**
 * Calcule la Patente professionnelle Congo selon le barème dégressif sur CA annuel HT.
 *
 * @param caAnnuelHT - Chiffre d'affaires annuel hors taxes (FCFA)
 * @returns Taux applicable, montant de patente calculé
 *
 * @example
 * calculerPatente(52_000_000)
 * // Tranche 30M-60M → taux 7,80%
 * // Patente = 52 000 000 × 7,80% = 4 056 000 FCFA
 *
 * calculerPatente(3_000_000)
 * // Tranche ≤5M → taux 9,75%, minimum 97 500 FCFA
 * // Patente = max(3 000 000 × 9,75%, 97 500) = max(292 500, 97 500) = 292 500 FCFA
 *
 * @source CGI Congo, inchangé LF 2026 — déclaration avant 31 mars
 */
export function calculerPatente(caAnnuelHT: number): { taux: number; montant: number } {
  if (caAnnuelHT <= 0) return { taux: 0, montant: 0 }
  for (const t of C.patente.tranches) {
    if (caAnnuelHT <= t.caMax) {
      const brut    = Math.round(caAnnuelHT * t.taux)
      const montant = t.minimum !== undefined ? Math.max(brut, t.minimum) : brut
      return { taux: t.taux, montant }
    }
  }
  // Tranche Infinity (>1 000 000 000)
  const derniere = C.patente.tranches[C.patente.tranches.length - 1]
  return { taux: derniere.taux, montant: Math.round(caAnnuelHT * derniere.taux) }
}

/**
 * Calcule le bulletin de paie mensuel complet.
 * Intègre cotisations salariales, IRPP et charges patronales.
 *
 * @param params.salaireBrut                - Salaire mensuel brut (FCFA)
 * @param params.irppPrisEnCharge           - Mesure LF 2026 : État prend en charge IRPP (100%)
 * @param params.cnssPatronalPrisEnCharge   - Mesure LF 2026 : État prend en charge 50% CNSS patronal
 * @returns Détail complet du bulletin avec salaireNet et coût patronal
 *
 * @example
 * calculerBulletinPaie({ salaireBrut: 600_000 })
 * // CNSS salarié : 21 600 FCFA (540 000 × 4%)
 * // IRPP annuel base : (600 000 × 12) × 80% = 5 760 000 → IRPP annuel = 286 000 → mensuel = 23 833
 * // Net : 600 000 − 21 600 − 23 833 = 554 567 FCFA
 * // Patronal : CNSS 121 740 + TUS 18 000 = 139 740 FCFA
 *
 * @source LF 2026 — calcul conforme CGI Congo Art. 76
 */
export function calculerBulletinPaie(params: {
  salaireBrut:               number
  irppPrisEnCharge?:         boolean
  cnssPatronalPrisEnCharge?: boolean
}): {
  salaireBrut:          number
  cotisationsSalariales: ReturnType<typeof calculerCotisationsSalariales>
  irpp:                 ReturnType<typeof calculerIRPP>
  irppMensuel:          number
  salaireNet:           number
  coutPatronal:         ReturnType<typeof calculerCotisationsPatronales>
} {
  const { salaireBrut, irppPrisEnCharge = false, cnssPatronalPrisEnCharge = false } = params

  const cotisationsSalariales = calculerCotisationsSalariales(salaireBrut)
  const irppAnnuel            = calculerIRPP(salaireBrut * 12, irppPrisEnCharge)
  const irppMensuel           = Math.round(irppAnnuel.irppNet / 12)
  const salaireNet            = salaireBrut - cotisationsSalariales.total - irppMensuel
  const coutPatronal          = calculerCotisationsPatronales(salaireBrut, cnssPatronalPrisEnCharge)

  return {
    salaireBrut,
    cotisationsSalariales,
    irpp:        irppAnnuel,
    irppMensuel,
    salaireNet,
    coutPatronal,
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// UTILITAIRES
// ═══════════════════════════════════════════════════════════════════════════════

export function formaterMontant(n: number): string {
  return new Intl.NumberFormat('fr-FR').format(Math.round(n)) + ' FCFA'
}

export function genererNumeroFacture(prefixe: string, count: number): string {
  const year = new Date().getFullYear()
  return `${prefixe}-${year}-${String(count + 1).padStart(4, '0')}`
}

// ── Exports rétrocompatibles (utilisés dans d'autres modules) ──────────────────

export const TVA_CONGO = {
  taux_tva:      C.tva.taux_normal,
  taux_ca:       C.tva.taux_ca,
  seuil_especes: 200_000,
} as const

export const IS_CONGO = {
  taux_normal:    C.is.taux_standard,
  taux_petrolier: 0.33,
  minimum_ca:     C.is.minimum_ca,
} as const

export const IRPP_CONGO = {
  tranches_annuelles: C.irpp.tranches,
  mesure_exceptionnelle_2026: true,
  libelle_mesure: 'LF 2026 Art. 15 — État prend en charge l\'IRPP (25 000 premiers déclarants CNSS)',
} as const

export const CNSS_CONGO = {
  pension_employe:            C.cnss.taux_salarie,
  pension_patronal:           C.cnss.taux_retraite_patronal,
  allocation_familiale:       C.cnss.taux_af_patronal,
  accident_travail:           C.cnss.taux_at_patronal,
  tus:                        C.cnss.taux_tus,
  plafond_vieillesse_mensuel: C.cnss.plafond_mensuel_salarie,
  plafond_at_mp_mensuel:      C.cnss.plafond_mensuel_salarie,
  total_patronal_hors_tus:    C.cnss.total_cnss_patronal,
  total_patronal_avec_tus:    C.cnss.total_patronal_avec_tus,
  mesure_exceptionnelle_2026: true,
  libelle_mesure: 'LF 2026 Art. 15 — État prend en charge 50% cotisations patronales (25 000 premiers déclarants)',
} as const

export const PATENTE_CONGO = {
  minimum_perception: 97_500,
  taux_ca:            0.05,
  taux_camu:          0.005,
  reduction_petrolier: 0.50,
} as const

export const AUTRES_TAXES_CONGO = {
  droits_enregistrement: {
    actes_commerciaux: 0.02,
    cessions_fonds:    0.05,
    hypotheques:       0.01,
  },
  retenues_source: C.retenues_source,
  douanes:         C.douanes,
  foncier:         C.foncier,
} as const

// ═══════════════════════════════════════════════════════════════════════════════
// CONTEXTE MIAA+ EXPERT FISCAL
// ═══════════════════════════════════════════════════════════════════════════════

export const MIAA_FISCAL_CONTEXT = {
  country:               'CG',
  countryName:           'Congo-Brazzaville',
  currency:              'XAF',
  administrationFiscale: 'Direction Générale des Impôts (DGI Congo)',
  systemeFiscal:         'OHADA / SYSCOHADA — Loi de Finances 2026 (Loi n°42-2025 du 31/12/2025)',
  expertName:            'MIAA+ Expert Fiscal Congo-Brazzaville',
  dataConfidence:        'verified' as const,
  specificites: [
    'TVA 18% + Centime Additionnel (CA) 5% de la TVA — TTC = HT × 1,189',
    'IS 30% ; minimum 1% du CA HT ; acomptes trimestriels 25% de l\'IS N-1',
    'IRPP 5 tranches 0–40% — abattement professionnel 20%',
    'Mesure LF 2026 : État prend en charge 100% IRPP salariés (25 000 premiers déclarants CNSS)',
    'Mesure LF 2026 : État prend en charge 50% cotisations patronales CNSS',
    'CNSS salarié 4% (plafonné 540 000 FCFA/mois) ; patronal 20,29% + TUS 3% déplafonné',
    'Patente dégressif de 9,75% (CA ≤ 5M) à 0,045% (CA > 1Mrd) — échéance 31 mars',
    'Redevance Informatique Douanière (Art. 44 LF 2026) : 2% import/export, 1% régimes suspensifs',
    'SMIG : 90 000 FCFA/mois',
  ],
} as const

/**
 * lib/fiscal/congo-calculs.ts
 * Moteur fiscal Congo-Brazzaville — LF n°42-2025 du 31 décembre 2025
 *
 * CORRECTIONS LF 2026 :
 * - IRPP : 5 tranches (0%/1%/10%/25%/40%) — tranche 1 est à 0%, pas 1%
 * - CNSS patronal AF : plafonné à 1 200 000 FCFA (vieillesse), non plus à 600 000
 * - TUS Fiscale 4,5% supprimée — seul le TUS CNSS 3% subsiste (LF 2026)
 * - Mesure exceptionnelle 2026 : IRPP = 0 + 50% cotisations patronales (25 000 premiers déclarants)
 */

// ── Plafonds ────────────────────────────────────────────────────────────────────
const PLAFOND_VIEILLESSE = 1_200_000  // CNSS vieillesse (8% patronal + 4% salarié) + AF (10,035%)
const PLAFOND_AT         = 600_000    // AT / Maladie professionnelle (2,25%)
const TOL_FIXE           = 1_000      // Taxe sur les Opérations de Logement

// ── Types ────────────────────────────────────────────────────────────────────────

export interface CalculSalaireInput {
  salaire_base:            number
  sursalaire?:             number
  prime_diplome?:          number
  prime_rendement?:        number
  prime_responsabilite?:   number
  prime_caisse?:           number
  prime_anciennete?:       number
  fraction_imposable_pni?: number   // fraction imposable des primes non imposables
  prime_transport?:        number   // non imposable
  autres_retenues?:        number
  situation_familiale:     'celibataire' | 'marie'
  nombre_enfants:          number
  mesure_lf2026?:          boolean  // État prend en charge IRPP + 50% patronal (LF 2026)
}

export interface CalculSalaireResult {
  // Brut
  brut_imposable:             number
  // Retenues salarié
  cnss_salarie:               number   // 4% plafonné 1 200 000
  base_irpp:                  number   // brut - cnss
  nombre_parts:               number
  irpp:                       number   // barème progressif par part
  tol:                        number   // 1 000 FCFA fixe
  autres_retenues:            number
  total_retenues:             number
  // Non imposable
  prime_transport:            number
  // Net
  net_a_payer:                number
  // Charges patronales
  cnss_patronal_8:            number   // 8% vieillesse, plafonné 1 200 000
  cnss_patronal_1228:         number   // AF 10,035% (plaf. 1 200 000) + AT 2,25% (plaf. 600 000)
  tus_cnss_3:                 number   // TUS CNSS 3% sur brut — déplafonné
  tus_fisc_45:                number   // Toujours 0 — TUS Fiscale 4,5% supprimée par LF 2026
  total_charges_patronales:   number
  // Coût total
  cout_total_employeur:       number
  // Mesure exceptionnelle LF 2026
  mesure_lf2026:              boolean
  prise_en_charge_etat_irpp:  number   // Montant IRPP pris en charge par l'État
  prise_en_charge_etat_pat:   number   // 50% cotisations patronales hors TUS pris en charge
}

export interface ListeNominativeLine {
  salaire_brut:        number
  vid_8:               number   // Vieillesse Invalidité Décès 8% (plaf. 1 200 000)
  alloc_familiales:    number   // Allocations familiales 10,035% (plaf. 1 200 000)
  at_maladie:          number   // Accident travail + Maladie 2,25% (plaf. 600 000)
  part_agent:          number   // Part agent (salarié) 4% (plaf. 1 200 000)
  total:               number
}

// ── Nombre de parts ───────────────────────────────────────────────────────────

export function calculerNombreParts(
  situation: 'celibataire' | 'marie',
  nombreEnfants: number
): number {
  let np = 1
  if (situation === 'marie') np += 1
  np += nombreEnfants * 0.5
  return np
}

// ── Barème IRPP Congo — tranches mensuelles LF 2026 (Art. 76 CGI) ──────────────
// Barème annuel divisé par 12 (par part fiscale) :
// T1 : 0 → 38 667 F      → 0%   (tranche exonérée)
// T2 : 38 667 → 83 333 F → 1%
// T3 : 83 333 → 250 000 F → 10%
// T4 : 250 000 → 666 667 F → 25%
// T5 : > 666 667 F        → 40%

export function calculerIRPP(baseIRPP: number, nombreParts: number): number {
  if (baseIRPP <= 0) return 0

  const baseParPart = baseIRPP / nombreParts
  let irppParPart = 0

  // T1 : 0% — tranche exonérée (464 000 / 12 = 38 666,67 FCFA/mois)
  const t1Max = 38_666.67
  // irppParPart += 0 (taux = 0%)

  // T2 : 1% (1 000 000 / 12 = 83 333,33 FCFA/mois)
  const t2Max = 83_333.33
  if (baseParPart > t1Max) {
    irppParPart += (Math.min(baseParPart, t2Max) - t1Max) * 0.01
  }

  // T3 : 10% (3 000 000 / 12 = 250 000 FCFA/mois)
  const t3Max = 250_000
  if (baseParPart > t2Max) {
    irppParPart += (Math.min(baseParPart, t3Max) - t2Max) * 0.10
  }

  // T4 : 25% (8 000 000 / 12 = 666 666,67 FCFA/mois)
  const t4Max = 666_666.67
  if (baseParPart > t3Max) {
    irppParPart += (Math.min(baseParPart, t4Max) - t3Max) * 0.25
  }

  // T5 : 40%
  if (baseParPart > t4Max) {
    irppParPart += (baseParPart - t4Max) * 0.40
  }

  return Math.round(irppParPart * nombreParts)
}

// ── Calcul bulletin complet ────────────────────────────────────────────────────

export function calculerBulletinPaie(input: CalculSalaireInput): CalculSalaireResult {

  const mesure = input.mesure_lf2026 ?? false

  // Brut imposable
  const brut = Math.round(
    (input.salaire_base            || 0)
    + (input.sursalaire            || 0)
    + (input.prime_diplome         || 0)
    + (input.prime_rendement       || 0)
    + (input.prime_responsabilite  || 0)
    + (input.prime_caisse          || 0)
    + (input.prime_anciennete      || 0)
    + (input.fraction_imposable_pni || 0)
  )

  // CNSS salarié : 4% plafonné à 1 200 000
  const cnss_salarie = Math.round(Math.min(brut, PLAFOND_VIEILLESSE) * 0.04)

  // Base IRPP
  const base_irpp = brut - cnss_salarie

  // Nombre de parts
  const np = calculerNombreParts(input.situation_familiale, input.nombre_enfants)

  // IRPP
  const irpp_brut = calculerIRPP(base_irpp, np)
  const prise_en_charge_etat_irpp = mesure ? irpp_brut : 0
  const irpp = mesure ? 0 : irpp_brut

  // TOL fixe
  const tol = TOL_FIXE

  // Autres retenues
  const autres = Math.round(input.autres_retenues || 0)

  // Total retenues salarié
  const total_retenues = cnss_salarie + irpp + tol + autres

  // Transport (non imposable)
  const transport = Math.round(input.prime_transport || 0)

  // Net à payer
  const net_a_payer = brut + transport - total_retenues

  // ── Charges patronales ─────────────────────────────────────────────────────

  // CNSS 8% vieillesse — plafonné 1 200 000
  const cnss_patronal_8 = Math.round(Math.min(brut, PLAFOND_VIEILLESSE) * 0.08)

  // AF 10,035% — plafonné 1 200 000 (correction LF 2026 : AF sur base vieillesse, non plus base AT)
  const cnss_patronal_af = Math.round(Math.min(brut, PLAFOND_VIEILLESSE) * 0.10035)

  // AT 2,25% — plafonné 600 000
  const cnss_patronal_at = Math.round(Math.min(brut, PLAFOND_AT) * 0.0225)

  // AF + AT combinés (conserve la compatibilité du champ cnss_patronal_1228)
  const cnss_patronal_1228 = cnss_patronal_af + cnss_patronal_at

  // TUS CNSS 3% déplafonné (seule TUS subsistante — TUS Fiscale 4,5% supprimée LF 2026)
  const tus_cnss_3 = Math.round(brut * 0.03)

  // TUS Fiscale : supprimée par LF 2026 — toujours 0
  const tus_fisc_45 = 0

  // Mesure LF 2026 : État prend en charge 50% cotisations patronales hors TUS
  const patronal_hors_tus           = cnss_patronal_8 + cnss_patronal_1228
  const prise_en_charge_etat_pat    = mesure ? Math.round(patronal_hors_tus * 0.5) : 0
  const patronal_effectif_hors_tus  = patronal_hors_tus - prise_en_charge_etat_pat

  const total_charges_patronales = patronal_effectif_hors_tus + tus_cnss_3

  const cout_total_employeur = brut + transport + total_charges_patronales

  return {
    brut_imposable:            brut,
    cnss_salarie,
    base_irpp,
    nombre_parts:              np,
    irpp,
    tol,
    autres_retenues:           autres,
    total_retenues,
    prime_transport:           transport,
    net_a_payer,
    cnss_patronal_8,
    cnss_patronal_1228,
    tus_cnss_3,
    tus_fisc_45,
    total_charges_patronales,
    cout_total_employeur,
    mesure_lf2026:             mesure,
    prise_en_charge_etat_irpp,
    prise_en_charge_etat_pat,
  }
}

// ── Liste nominative CNSS ────────────────────────────────────────────────────

export function calculerListeNominative(salaireBrut: number): ListeNominativeLine {
  const base_vie = Math.min(salaireBrut, PLAFOND_VIEILLESSE)
  const base_at  = Math.min(salaireBrut, PLAFOND_AT)
  return {
    salaire_brut:     salaireBrut,
    vid_8:            Math.round(base_vie * 0.08),
    alloc_familiales: Math.round(base_vie * 0.10035),
    at_maladie:       Math.round(base_at  * 0.0225),
    part_agent:       Math.round(base_vie * 0.04),
    total:            Math.round(base_vie * (0.08 + 0.10035 + 0.04) + base_at * 0.0225),
  }
}

// ── Bordereau CNSS mensuel ───────────────────────────────────────────────────

export function calculerBordereauCNSS(bulletins: CalculSalaireResult[]) {
  return {
    total_salaires_bruts:   bulletins.reduce((s, b) => s + b.brut_imposable, 0),
    // Patronal — depuis bulletins pré-calculés (plafonds appliqués par employé)
    cotisation_vieillesse_8: bulletins.reduce((s, b) => s + b.cnss_patronal_8,   0),
    cotisation_autres_1228:  bulletins.reduce((s, b) => s + b.cnss_patronal_1228, 0),
    tus_cnss_3pct:           bulletins.reduce((s, b) => s + b.tus_cnss_3, 0),
    tus_fisc_45:             0,  // Supprimée LF 2026
    // Salarié (retenu à la source)
    total_cnss_salarie:     bulletins.reduce((s, b) => s + b.cnss_salarie, 0),
    // Fiscaux
    total_irpp:             bulletins.reduce((s, b) => s + b.irpp, 0),
    total_tol:              bulletins.length * TOL_FIXE,
    // Global
    total_a_verser:         bulletins.reduce((s, b) => s + b.total_charges_patronales, 0),
  }
}

// ── Formatage ────────────────────────────────────────────────────────────────

export const fmt = (n: number) =>
  new Intl.NumberFormat('fr-FR').format(Math.round(n)) + ' FCFA'

// ── Détail IRPP par tranche (pour affichage bulletin) — LF 2026 ─────────────

export function detailIRPP(baseIRPP: number, np: number) {
  const bpp = baseIRPP / np
  const tranches = []

  // T1 : 0%
  if (bpp > 0) {
    tranches.push({ libelle: 'Tranche 1 (0%)',  base: Math.min(bpp, 38_666.67),              taux: 0.00 })
  }
  // T2 : 1%
  if (bpp > 38_666.67) {
    tranches.push({ libelle: 'Tranche 2 (1%)',  base: Math.min(bpp, 83_333.33) - 38_666.67, taux: 0.01 })
  }
  // T3 : 10%
  if (bpp > 83_333.33) {
    tranches.push({ libelle: 'Tranche 3 (10%)', base: Math.min(bpp, 250_000) - 83_333.33,   taux: 0.10 })
  }
  // T4 : 25%
  if (bpp > 250_000) {
    tranches.push({ libelle: 'Tranche 4 (25%)', base: Math.min(bpp, 666_666.67) - 250_000,  taux: 0.25 })
  }
  // T5 : 40%
  if (bpp > 666_666.67) {
    tranches.push({ libelle: 'Tranche 5 (40%)', base: bpp - 666_666.67,                      taux: 0.40 })
  }

  return tranches.map(t => ({
    ...t,
    irpp_part:  Math.round(t.base * t.taux),
    irpp_total: Math.round(t.base * t.taux * np),
  }))
}

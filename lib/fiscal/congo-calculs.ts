/**
 * lib/fiscal/congo-calculs.ts
 * Moteur fiscal Congo-Brazzaville — formules exactes ECAM
 *
 * Sources : Déclarations réelles ECAM Pointe-Noire 2024
 * Validées contre bulletins de paie officiels
 */

// ── Plafonds ────────────────────────────────────────────────────────────────────
const PLAFOND_VIEILLESSE = 1_200_000  // CNSS vieillesse 8% + salarié 4%
const PLAFOND_AUTRES     = 600_000    // CNSS autres régimes 12.28%
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
}

export interface CalculSalaireResult {
  // Brut
  brut_imposable:             number
  // Retenues salarié
  cnss_salarie:               number   // 4% plafonné 1 200 000
  base_irpp:                  number   // brut - cnss
  nombre_parts:               number
  irpp:                       number   // barème progressif par NP
  tol:                        number   // 1 000 FCFA fixe
  autres_retenues:            number
  total_retenues:             number
  // Non imposable
  prime_transport:            number
  // Net
  net_a_payer:                number
  // Charges patronales
  cnss_patronal_8:            number   // 8% vieillesse, plafonné 1 200 000
  cnss_patronal_1228:         number   // 12.28% autres, plafonné 600 000
  tus_cnss_3:                 number   // TUS CNSS 3% sur brut
  tus_fisc_45:                number   // TUS Fiscale 4.5% sur brut
  total_charges_patronales:   number
  // Coût total
  cout_total_employeur:       number
}

export interface ListeNominativeLine {
  salaire_brut:        number
  vid_8:               number   // Vieillesse Invalidité Décès 8%
  alloc_familiales:    number   // Allocations familiales 10.03%
  at_maladie:          number   // Accident travail + Maladie 2.25%
  part_agent:          number   // Part agent (salarié) 4%
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

// ── Barème IRPP Congo — tranches mensuelles exactes ECAM ──────────────────────
// T1 : 0 → 38 667 F    → 1%
// T2 : 38 667 → 83 333 → 10%
// T3 : 83 333 → 250 000 → 25%
// T4 : > 250 000        → 40%

export function calculerIRPP(baseIRPP: number, nombreParts: number): number {
  if (baseIRPP <= 0) return 0

  const baseParPart = baseIRPP / nombreParts
  let irppParPart = 0

  // T1 : 1%
  const t1Max = 38_666.67
  if (baseParPart > 0) {
    irppParPart += Math.min(baseParPart, t1Max) * 0.01
  }

  // T2 : 10%
  const t2Max = 83_333.33
  if (baseParPart > t1Max) {
    irppParPart += (Math.min(baseParPart, t2Max) - t1Max) * 0.10
  }

  // T3 : 25%
  const t3Max = 250_000
  if (baseParPart > t2Max) {
    irppParPart += (Math.min(baseParPart, t3Max) - t2Max) * 0.25
  }

  // T4 : 40%
  if (baseParPart > t3Max) {
    irppParPart += (baseParPart - t3Max) * 0.40
  }

  return Math.round(irppParPart * nombreParts)
}

// ── Calcul bulletin complet ────────────────────────────────────────────────────

export function calculerBulletinPaie(input: CalculSalaireInput): CalculSalaireResult {

  // Brut imposable = somme des éléments imposables
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
  const baseCnssSalarie = Math.min(brut, PLAFOND_VIEILLESSE)
  const cnss_salarie    = Math.round(baseCnssSalarie * 0.04)

  // Base IRPP = Brut imposable - CNSS salarié
  const base_irpp = brut - cnss_salarie

  // Nombre de parts
  const np = calculerNombreParts(input.situation_familiale, input.nombre_enfants)

  // IRPP par barème progressif
  const irpp = calculerIRPP(base_irpp, np)

  // TOL fixe
  const tol = TOL_FIXE

  // Autres retenues
  const autres = Math.round(input.autres_retenues || 0)

  // Total retenues salarié
  const total_retenues = cnss_salarie + irpp + tol + autres

  // Transport (non imposable — hors brut imposable)
  const transport = Math.round(input.prime_transport || 0)

  // Net à payer
  const net_a_payer = brut + transport - total_retenues

  // ── Charges patronales ─────────────────────────────────────────────────────

  // CNSS 8% vieillesse — plafonné 1 200 000
  const cnss_patronal_8 = Math.round(Math.min(brut, PLAFOND_VIEILLESSE) * 0.08)

  // CNSS 12.28% autres régimes — plafonné 600 000
  // (allocations familiales 10.03% + AT-maladie 2.25%)
  const cnss_patronal_1228 = Math.round(Math.min(brut, PLAFOND_AUTRES) * 0.1228)

  // TUS CNSS : 3% sur brut (pas de plafond)
  const tus_cnss_3 = Math.round(brut * 0.03)

  // TUS Fiscale : 4.5% sur brut (pas de plafond)
  const tus_fisc_45 = Math.round(brut * 0.045)

  const total_charges_patronales = cnss_patronal_8 + cnss_patronal_1228 + tus_cnss_3 + tus_fisc_45

  const cout_total_employeur = brut + transport + total_charges_patronales

  return {
    brut_imposable:           brut,
    cnss_salarie,
    base_irpp,
    nombre_parts:             np,
    irpp,
    tol,
    autres_retenues:          autres,
    total_retenues,
    prime_transport:          transport,
    net_a_payer,
    cnss_patronal_8,
    cnss_patronal_1228,
    tus_cnss_3,
    tus_fisc_45,
    total_charges_patronales,
    cout_total_employeur,
  }
}

// ── Liste nominative CNSS ────────────────────────────────────────────────────

export function calculerListeNominative(salaireBrut: number): ListeNominativeLine {
  return {
    salaire_brut:     salaireBrut,
    vid_8:            Math.round(salaireBrut * 0.08),
    alloc_familiales: Math.round(salaireBrut * 0.1003),
    at_maladie:       Math.round(salaireBrut * 0.0225),
    part_agent:       Math.round(salaireBrut * 0.04),
    total:            Math.round(salaireBrut * (0.08 + 0.1003 + 0.0225 + 0.04)),
  }
}

// ── Bordereau CNSS mensuel ───────────────────────────────────────────────────

export function calculerBordereauCNSS(bulletins: CalculSalaireResult[]) {
  const totalBruts       = bulletins.reduce((s, b) => s + b.brut_imposable, 0)
  const nbEmployes       = bulletins.length
  const plafVieillesse   = PLAFOND_VIEILLESSE * nbEmployes
  const plafAutres       = PLAFOND_AUTRES * nbEmployes

  return {
    total_salaires_bruts:      totalBruts,
    // Patronal
    cotisation_vieillesse_8:   Math.round(Math.min(totalBruts, plafVieillesse) * 0.08),
    cotisation_autres_1228:    Math.round(Math.min(totalBruts, plafAutres) * 0.1228),
    tus_cnss_3pct:             Math.round(totalBruts * 0.03),
    tus_fisc_45:               Math.round(totalBruts * 0.045),
    // Salarié (retenu à la source)
    total_cnss_salarie:        bulletins.reduce((s, b) => s + b.cnss_salarie, 0),
    // Fiscaux
    total_irpp:                bulletins.reduce((s, b) => s + b.irpp, 0),
    total_tol:                 bulletins.length * TOL_FIXE,
    // Global
    total_a_verser:            bulletins.reduce((s, b) => s + b.total_charges_patronales, 0),
  }
}

// ── Formatage ────────────────────────────────────────────────────────────────

export const fmt = (n: number) =>
  new Intl.NumberFormat('fr-FR').format(Math.round(n)) + ' FCFA'

// ── Détail IRPP par tranche (pour affichage bulletin) ───────────────────────

export function detailIRPP(baseIRPP: number, np: number) {
  const bpp = baseIRPP / np
  const tranches = []

  if (bpp > 0) {
    tranches.push({ libelle: 'Tranche 1 (1%)',  base: Math.min(bpp, 38_666.67),              taux: 0.01 })
  }
  if (bpp > 38_666.67) {
    tranches.push({ libelle: 'Tranche 2 (10%)', base: Math.min(bpp, 83_333.33) - 38_666.67, taux: 0.10 })
  }
  if (bpp > 83_333.33) {
    tranches.push({ libelle: 'Tranche 3 (25%)', base: Math.min(bpp, 250_000) - 83_333.33,   taux: 0.25 })
  }
  if (bpp > 250_000) {
    tranches.push({ libelle: 'Tranche 4 (40%)', base: bpp - 250_000,                         taux: 0.40 })
  }

  return tranches.map(t => ({
    ...t,
    irpp_part: Math.round(t.base * t.taux),
    irpp_total: Math.round(t.base * t.taux * np),
  }))
}

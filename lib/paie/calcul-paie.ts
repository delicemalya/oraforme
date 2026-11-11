// ── Moteur de calcul paie — Congo-Brazzaville ──────────────────────────────────
//
// Aucun taux ni plafond n'est détenu ici. Le calcul CNSS/TUS/IRPP délègue à
// lib/fiscal/universal-tax-engine.ts (source de vérité), lui-même alimenté par
// lib/countries/CG.ts. Ce module ne fait plus que construire les gains et
// retenues d'un bulletin autour de ce calcul central.
//
// Avant Mission P0 paie (2026-09-17), ce fichier détenait sa propre copie des
// taux CNSS/TUS et son propre barème IRPP (sans abattement ni quotient
// familial) — un second moteur fiscal actif en parallèle de
// universal-tax-engine.ts, avec des résultats divergents. Consolidé ici.

import {
  calculerChargesSociales,
  calculerIRPP,
  getSMIG,
  type SituationFamiliale,
} from '@/lib/fiscal/universal-tax-engine'

export const SMIG_MENSUEL = getSMIG('CG').montant   // SMIG Congo (arrêté 2020) — lu depuis CG.ts

// Médecine du travail (0,5%) : CG.ts ne porte pas encore cette branche
// (cnss.medecine_travail_taux absent) ; ticket PAIE-03. Exporté pour que tout
// recalcul serveur (ex. app/api/paie/bulletins) utilise la même valeur.
export const TAUX_MEDECINE_NON_MIGRE = 0.005

// ── Types ──────────────────────────────────────────────────────────────────────

export interface DetailIRPP {
  label: string
  taux: number     // en %
  base: number
  montant: number
}

export interface ElementsPaie {
  salaire_base: number
  heures_sup?: number
  taux_horaire?: number
  prime_rendement?: number
  prime_anciennete?: number
  prime_transport?: number
  prime_logement?: number
  prime_responsabilite?: number
  indemnite_deplacement?: number
  avantages_nature?: number
  autres_gains?: number
  mutuelle?: number
  acompte?: number
  opposition?: number
  autres_retenues?: number
  taux_cnss_employe?: number
  taux_cnss_patronal?: number
  /** Indemnités non imposables à exclure de la base CNSS/TUS/IRPP (voir CG.ts). Défaut 0. */
  indemnites_non_imposables?: number
  /** Situation familiale pour le quotient familial IRPP. Défaut 'celibataire'. */
  situation?: SituationFamiliale
  /** Nombre d'enfants à charge pour le quotient familial IRPP. Défaut 0. */
  nombreEnfants?: number
}

export interface ResultatPaie {
  // Gains
  salaire_base: number
  heures_sup_montant: number
  prime_rendement: number
  prime_anciennete: number
  prime_transport: number
  prime_logement: number
  prime_responsabilite: number
  indemnite_deplacement: number
  avantages_nature: number
  autres_gains: number
  salaire_brut: number
  brut_imposable: number
  // Retenues employé
  cnss_employe: number
  base_irpp: number
  irpp: number
  irpp_detail: DetailIRPP[]
  mutuelle: number
  acompte: number
  opposition: number
  autres_retenues: number
  total_retenues: number
  // Net
  salaire_net: number
  // Charges patronales
  cnss_patronal: number
  tus_patronal: number
  medecine_travail: number
  cout_total_employeur: number
}

// ── Fonctions ──────────────────────────────────────────────────────────────────

/**
 * Noyau partagé CNSS + IRPP — Critical #3 (IRPP falsifiable côté client).
 *
 * Seule fonction qui doit décider cnss_salarie/cnss_patronal/tus_patronal/irpp
 * à partir d'un brut imposable déjà assemblé. Utilisée par calculerPaie()
 * ci-dessous ET par les deux routes qui persistent un bulletin
 * (app/api/rh/paie, app/api/paie/bulletins) — pour que les deux routes et le
 * simulateur restent rigoureusement d'accord, pas seulement chacun "correct"
 * séparément. `situation`/`nombreEnfants` doivent provenir du dossier RH
 * serveur de l'employé, jamais du corps d'une requête client.
 */
export interface ChampsFiscauxDerives {
  cnss_salarie:  number
  cnss_patronal: number
  tus_patronal:  number
  irpp:          number
}

export function calculerChampsFiscauxDerives(
  brutImposable:  number,
  situation:      SituationFamiliale,
  nombreEnfants:  number,
): ChampsFiscauxDerives {
  const cnssRes      = calculerChargesSociales({ codePays: 'CG', salaireBrut: brutImposable })
  const cnss_salarie  = cnssRes.total_salarie
  const tusBranch     = cnssRes.branches.find(b => b.code === 'TUS')
  const tus_patronal  = tusBranch?.montant_patronal ?? 0
  const cnss_patronal = cnssRes.total_patronal_net - tus_patronal

  const base_irpp = Math.max(0, brutImposable - cnss_salarie)
  const irppRes   = calculerIRPP({
    codePays: 'CG', salaireBrut: base_irpp, salaireBrutOriginal: brutImposable,
    situation, nombreEnfants,
  })

  return { cnss_salarie, cnss_patronal, tus_patronal, irpp: irppRes.irpp_net }
}

export function calculerPaie(el: ElementsPaie): ResultatPaie {
  const heures_sup_montant = Math.round((el.heures_sup || 0) * (el.taux_horaire || 0))
  const prime_rendement    = el.prime_rendement    || 0
  const prime_anciennete   = el.prime_anciennete   || 0
  const prime_transport    = el.prime_transport    || 0
  const prime_logement     = el.prime_logement     || 0
  const prime_responsabilite   = el.prime_responsabilite   || 0
  const indemnite_deplacement  = el.indemnite_deplacement  || 0
  const avantages_nature       = el.avantages_nature       || 0
  const autres_gains           = el.autres_gains           || 0

  const salaire_brut = el.salaire_base + heures_sup_montant + prime_rendement +
    prime_anciennete + prime_transport + prime_logement + prime_responsabilite +
    indemnite_deplacement + avantages_nature + autres_gains

  const indemnites_non_imposables = el.indemnites_non_imposables || 0
  const brut_imposable = Math.max(0, salaire_brut - indemnites_non_imposables)

  const situation     = el.situation ?? 'celibataire'
  const nombreEnfants = el.nombreEnfants ?? 0
  const { cnss_salarie: cnss_employe, cnss_patronal, tus_patronal } =
    calculerChampsFiscauxDerives(brut_imposable, situation, nombreEnfants)

  const base_irpp = Math.max(0, brut_imposable - cnss_employe)
  const irppRes = calculerIRPP({
    codePays:             'CG',
    salaireBrut:          base_irpp,
    salaireBrutOriginal:  brut_imposable,
    situation,
    nombreEnfants,
  })
  const irpp = irppRes.irpp_net
  const irpp_detail: DetailIRPP[] = irppRes.tranches
    .filter(t => t.impot_total > 0)
    .map(t => ({ label: t.libelle, taux: t.taux * 100, base: t.base, montant: t.impot_total }))

  const mutuelle       = el.mutuelle       || 0
  const acompte        = el.acompte        || 0
  const opposition     = el.opposition     || 0
  const autres_retenues = el.autres_retenues || 0

  const total_retenues = cnss_employe + irpp + mutuelle + acompte + opposition + autres_retenues
  const salaire_net    = salaire_brut - total_retenues

  // Médecine du travail (0,5%) : hors périmètre de cette mission (PAIE/CNSS/TUS/IRPP
  // uniquement) — comportement préexistant conservé tel quel. CG.ts ne porte pas
  // cette branche (cnss.medecine_travail_taux absent) ; ticket PAIE-03, non traité ici.
  const medecine_travail = Math.round(brut_imposable * TAUX_MEDECINE_NON_MIGRE)
  const cout_total_employeur = brut_imposable + cnss_patronal + tus_patronal + medecine_travail

  return {
    salaire_base: el.salaire_base,
    heures_sup_montant,
    prime_rendement,
    prime_anciennete,
    prime_transport,
    prime_logement,
    prime_responsabilite,
    indemnite_deplacement,
    avantages_nature,
    autres_gains,
    salaire_brut,
    brut_imposable,
    cnss_employe,
    base_irpp,
    irpp,
    irpp_detail,
    mutuelle,
    acompte,
    opposition,
    autres_retenues,
    total_retenues,
    salaire_net,
    cnss_patronal,
    tus_patronal,
    medecine_travail,
    cout_total_employeur,
  }
}

// Prime d'ancienneté légale : 5% par tranche de 3 ans, max 25%
export function calcPrimeAnciennete(salaire_base: number, annees: number): number {
  if (annees < 3) return 0
  const tranches = Math.floor(annees / 3)
  const taux = Math.min(tranches * 0.05, 0.25)
  return Math.round(salaire_base * taux)
}

// Utilitaires
export function fmtNum(n: number): string {
  return new Intl.NumberFormat('fr-FR').format(Math.round(n))
}
export function fmtFCFA(n: number): string {
  return fmtNum(n) + ' FCFA'
}

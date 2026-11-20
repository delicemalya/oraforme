/**
 * lib/fiscalite/engine-adapter.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Adaptateur MINCE entre l'ancien moteur multi-pays (lib/fiscalite/engine.ts +
 * lib/fiscalite/pays.ts) et le moteur central validé
 * (lib/fiscal/universal-tax-engine.ts + lib/countries/).
 *
 * Mission P0-PAIE-CG-2026 — élimination du second moteur fiscal (2026-09-18).
 *
 * RÈGLE : ce fichier ne contient AUCUN taux, AUCUN barème, AUCUNE règle
 * fiscale. Il route chaque pays vers UNE source de vérité et reforme le
 * résultat dans la forme attendue par les consommateurs existants
 * (irpp/page.tsx, api/fiscalite/cnss/route.ts) pour ne pas changer leur
 * contrat.
 *
 * POURQUOI DEUX CHEMINS SUBSISTENT :
 * lib/countries/ (7 pays : CG, CM, GA, CD, CF, TD, GQ) est la seule source
 * validée. lib/fiscalite/pays.ts couvre 15 pays (les 7 ci-dessus + AO, ML,
 * BF, NE, NG, FR, BE, CH) — 8 pays sans configuration dans lib/countries/.
 * Migrer aveuglément ferait perdre le simulateur pour ces 8 pays, ou pire,
 * leur ferait silencieusement afficher les taux du Congo (comportement de
 * repli de getCountryConfig()). Pour ces 8 pays, ce fichier route donc
 * explicitement vers l'ancien moteur — ce n'est pas un oubli, c'est documenté
 * ici et dans le rapport de mission. Aucune tentative n'a été faite d'inventer
 * une configuration validée pour ces pays.
 */

import { getCountryConfig, isCountryAvailable, type CodePays } from '@/lib/countries'
import {
  calculerChargesSociales,
  calculerIRPP as calculerIRPPCentral,
  calculerTVA as calculerTVACentral,
  calculerTaxesAdditionnellesSurTVA,
  getTauxCNSSSalarie,
  getTauxCNSSPatronal,
} from '@/lib/fiscal/universal-tax-engine'
import {
  calculerCNSS as calculerCNSSLegacy,
  calculerIRPP as calculerIRPPLegacy,
  calculerCNSSAggrege as calculerCNSSAggregeLegacy,
  calculerTVA as calculerTVALegacy,
} from './engine'
import { getPaysConfig } from './pays'
import type { PaysFiscal, ResultatCNSS, ResultatTVA } from './types'

/** true si ce pays a une configuration validée dans lib/countries/. */
export function paysMigreVersCentral(pays: PaysFiscal): pays is CodePays {
  return isCountryAvailable(pays as CodePays)
}

// ── CNSS (un salarié) ────────────────────────────────────────────────────────

export interface ResultatCNSSSimple {
  salarie: number
  patronal: number
  total: number
  base: number
}

export function calculerCNSSUnifie(salaireBrut: number, pays: PaysFiscal): ResultatCNSSSimple {
  if (paysMigreVersCentral(pays)) {
    const r = calculerChargesSociales({ codePays: pays, salaireBrut })
    return {
      salarie:  r.total_salarie,
      patronal: r.total_patronal_net,
      total:    r.total_salarie + r.total_patronal_net,
      // Le modèle central plafonne chaque branche indépendamment — il n'y a
      // plus une base unique. Champ non consommé par l'UI actuelle ; le brut
      // non plafonné est la valeur la plus lisible à défaut.
      base: salaireBrut,
    }
  }
  return calculerCNSSLegacy(salaireBrut, pays)
}

// ── IRPP (un salarié) ─────────────────────────────────────────────────────────

export interface ResultatIRPPSimple {
  irpp: number
  revenu_imposable: number
  abattement: number
}

/**
 * Ce consommateur (simulateur brut → net) ne recueille ni situation
 * familiale ni nombre d'enfants — aucun champ pour cela dans l'UI. Le manque
 * est réel, pas fabriqué : on simule à 1 part (célibataire, sans enfant),
 * comme le fait déjà calculerPaie() par défaut ailleurs dans le code, et
 * l'appelant doit le rendre visible à l'écran (voir irpp/page.tsx).
 */
export function calculerIRPPUnifie(salaireBrut: number, pays: PaysFiscal): ResultatIRPPSimple {
  if (paysMigreVersCentral(pays)) {
    const cnss = calculerChargesSociales({ codePays: pays, salaireBrut })
    const baseIrpp = Math.max(0, salaireBrut - cnss.total_salarie)
    const r = calculerIRPPCentral({
      codePays: pays, salaireBrut: baseIrpp, salaireBrutOriginal: salaireBrut,
      situation: 'celibataire', nombreEnfants: 0,
    })
    return {
      irpp: r.irpp_net,
      revenu_imposable: r.base_apres_abattement,
      abattement: r.abattement_montant,
    }
  }
  return calculerIRPPLegacy(salaireBrut, pays)
}

// ── Salaire net (brut → net, un salarié) ──────────────────────────────────────

export interface ResultatSalaireNetSimple {
  net: number
  cnss_salarie: number
  irpp: number
  total_retenues: number
}

/**
 * Remplace lib/contexts/PaysContext.tsx::calculerSalaireNet() (Mission
 * P0-PAIE-CG-2026, 2026-09-18) — même limitation que calculerIRPPUnifie
 * ci-dessus : pas de situation familiale ni de brut/indemnités distincts
 * dans ce contrat d'entrée (brut seul), donc même défaut explicite 1 part.
 * Compose calculerCNSSUnifie + calculerIRPPUnifie plutôt que de refaire le
 * routage migré/non-migré une troisième fois.
 */
export function calculerSalaireNetUnifie(brut: number, pays: PaysFiscal): ResultatSalaireNetSimple {
  const cnss = calculerCNSSUnifie(brut, pays)
  const irpp = calculerIRPPUnifie(brut, pays)
  const total_retenues = cnss.salarie + irpp.irpp
  return {
    net: Math.round(brut - total_retenues),
    cnss_salarie: cnss.salarie,
    irpp: irpp.irpp,
    total_retenues,
  }
}

// ── CNSS agrégée (déclaration multi-salariés) ─────────────────────────────────

export function calculerCNSSAggregeUnifie(
  employes: Array<{ salaire_brut: number }>,
  pays: PaysFiscal,
): ResultatCNSS {
  if (paysMigreVersCentral(pays)) {
    let totalBrut = 0
    let totalSalarie = 0
    let totalPatronal = 0
    const detailsBranches: Record<string, number> = {}

    for (const emp of employes) {
      const r = calculerChargesSociales({ codePays: pays, salaireBrut: emp.salaire_brut })
      totalBrut     += emp.salaire_brut
      totalSalarie  += r.total_salarie
      totalPatronal += r.total_patronal_net
      for (const b of r.branches) {
        detailsBranches[b.libelle] = (detailsBranches[b.libelle] ?? 0) + b.montant_salarie + b.montant_patronal
      }
    }

    return {
      salaire_brut_total: totalBrut,
      base_cotisable:      totalBrut,   // approximation d'affichage — chaque branche a son propre plafond, plus de base unique
      cotisation_salarie:  totalSalarie,
      cotisation_patronale: totalPatronal,
      total_cnss:          totalSalarie + totalPatronal,
      nb_employes:         employes.length,
      details_branches:    detailsBranches,
    }
  }
  return calculerCNSSAggregeLegacy(employes, pays)
}

// ── TVA sur un montant HT (facture unitaire) ───────────────────────────────────

export interface ResultatTVASimple {
  tva: number
  ca: number
  ttc: number
  taux: number
}

/**
 * Remplace lib/contexts/PaysContext.tsx::calculerTVA() (Mission
 * P0-FISCAL-CG-2026, 2026-09-18) — même principe que calculerSalaireNetUnifie
 * ci-dessus : les 7 pays validés passent par lib/fiscal/universal-tax-engine.ts
 * ::calculerTVA(), les 8 pays non validés gardent EXACTEMENT la formule
 * PaysContext d'origine (déplacée ici à l'identique, pas réécrite), routée
 * depuis lib/fiscalite/pays.ts comme avant. `ca` = somme des taxes
 * additionnelles (Centime Additionnel Congo, CAC Cameroun...), pas la TVA
 * elle-même — nom hérité du contrat existant, conservé pour ne pas casser
 * les appelants.
 */
export function calculerTVASurMontantUnifie(montantHT: number, pays: PaysFiscal): ResultatTVASimple {
  if (paysMigreVersCentral(pays)) {
    const cfg = getCountryConfig(pays)
    const r = calculerTVACentral({ codePays: pays, montantHT })
    const ca = r.taxes_additionnelles.reduce((s, t) => s + t.montant, 0)
    return { tva: r.tva_base, ca, ttc: r.montant_ttc, taux: cfg.tva.taux_normal }
  }

  const cfg = getPaysConfig(pays)
  const taux = cfg.tva.taux_normal
  const tva = montantHT * taux
  let taxes_add = 0
  for (const ta of cfg.tva.taxes_additionnelles ?? []) {
    taxes_add += ta.base === 'tva_collectee' ? tva * ta.taux : montantHT * ta.taux
  }
  const ttc = montantHT + tva + taxes_add
  return { tva: Math.round(tva), ca: Math.round(taxes_add), ttc: Math.round(ttc), taux }
}

// ── Décomposition d'un montant TTC déjà connu (HT/TVA/CA) ─────────────────────

export interface ResultatDecompositionTTC {
  ht: number
  tva: number
  ca: number
  ttc: number
}

/**
 * Décompose un montant TTC déjà connu en HT/TVA/CA — pour les modules qui ne
 * connaissent le montant qu'au moment de l'encaissement ou de la facturation
 * globale (santé, hôtellerie, boisson), à la différence de la facturation
 * générale et de BTP qui connaissent le HT dès la ligne de facture et
 * utilisent calculerTVASurMontantUnifie() ci-dessus (sens inverse).
 *
 * Mission P0-FISCAL-CG-2026, correction transversale (2026-09-18) : remplace
 * le calcul local `ht = round(ttc / 1.189)` dupliqué dans SAN-001 (2 writers),
 * HOT-001 et BOI-001 — aucun taux recopié dans les appelants, tout vient de
 * getCountryConfig().
 *
 * Le TTC n'est JAMAIS recalculé : c'est un montant réel déjà encaissé ou
 * facturé, il doit rester exact au franc près. Seule sa répartition interne
 * est déterminée. L'arrondi résiduel est absorbé par le Centime Additionnel
 * (le plus petit des trois montants) — convention propre à cette fonction,
 * documentée ici, pas héritée d'un calcul préexistant ailleurs dans le dépôt.
 */
export function decomposerTTCUnifie(montantTTC: number, pays: PaysFiscal): ResultatDecompositionTTC {
  if (paysMigreVersCentral(pays)) {
    const cfg = getCountryConfig(pays)
    const tauxNormal = cfg.tva.taux_normal
    const tauxCA = cfg.tva.taxes_additionnelles.find(t => t.base === 'tva_collectee')?.taux ?? 0
    const diviseur = 1 + tauxNormal * (1 + tauxCA)
    const ht = Math.round(montantTTC / diviseur)
    const tvaPlusCa = montantTTC - ht
    const tva = tauxCA > 0 ? Math.round(tvaPlusCa / (1 + tauxCA)) : tvaPlusCa
    const ca = tvaPlusCa - tva
    return { ht, tva, ca, ttc: montantTTC }
  }
  // Pays non validés : ces 4 modules sont Congo-only en pratique (aucun ne lit
  // le pays du tenant à ce jour) — repli conservé pour ne pas casser un appel
  // hypothétique avec un autre pays, CA=0 (pas de taxe additionnelle centrale
  // fiable à inverser hors CG, pas inventée).
  const cfg = getPaysConfig(pays)
  const ht = Math.round(montantTTC / (1 + cfg.tva.taux_normal))
  return { ht, tva: montantTTC - ht, ca: 0, ttc: montantTTC }
}

// ── TVA (déclaration mensuelle, enrichissement d'affichage) ───────────────────

/**
 * Mission P0-FISCAL-CG-2026 (2026-09-18). Ce n'est PAS le calcul canonique de
 * la déclaration TVA — celui-ci vit dans
 * lib/erp-core/compute/accounting.ts::computeTVAFromJournal() (source unique
 * = journal_entries, avec report de crédit d'un mois sur l'autre). Cette
 * fonction ne fait qu'enrichir un point mensuel déjà agrégé (tva_collectee,
 * tva_deductible) avec deux informations que computeTVAFromJournal() ne
 * produit pas : le CA HT reconstitué et les taxes additionnelles (Centime
 * Additionnel Congo). tva_nette/total_a_payer/credit_tva calculés ici sont
 * une approximation SANS report de crédit — tout appelant qui a accès au
 * TVAMonthPoint canonique doit écraser ces trois champs avec
 * mp.tva_nette / mp.a_payer / mp.credit_nouveau après appel (voir
 * app/api/fiscalite/tva/route.ts).
 *
 * ca_ht = tva_collectee / taux_normal suppose que 100% du CA est taxé au
 * taux normal (18% Congo) — approximation préexistante (héritée de
 * lib/fiscalite/engine.ts::calculerTVA), non modifiée ici : le Congo a aussi
 * un taux réduit à 5%, non distingué dans journal_entries par compte séparé.
 */
export function calculerTVAUnifie(
  tvaCollectee: number,
  tvaDeductible: number,
  pays: PaysFiscal,
): ResultatTVA {
  if (paysMigreVersCentral(pays)) {
    const cfg = getCountryConfig(pays)
    const tauxNormal = cfg.tva.taux_normal
    const ca_ht = tvaCollectee > 0 ? tvaCollectee / tauxNormal : 0
    const { detail } = calculerTaxesAdditionnellesSurTVA(pays, tvaCollectee)
    const taxes_additionnelles: Record<string, number> = {}
    for (const t of detail) taxes_additionnelles[t.code] = t.montant

    const tva_nette = tvaCollectee - tvaDeductible
    const total_taxes_add = detail.reduce((s, t) => s + t.montant, 0)

    return {
      tva_collectee: tvaCollectee,
      tva_deductible: tvaDeductible,
      tva_nette,
      taxes_additionnelles,
      total_a_payer: Math.round(Math.max(tva_nette, 0) + total_taxes_add),
      credit_tva: Math.round(Math.max(-tva_nette, 0)),
      ca_ht: Math.round(ca_ht),
    }
  }
  return calculerTVALegacy(tvaCollectee, tvaDeductible, pays)
}

// ── Configuration d'affichage (barème, libellés) ──────────────────────────────

export interface ConfigAffichageUnifiee {
  cnss: { nom: string; acronyme: string; taux_salarie: number; taux_patronal: number; plafond_mensuel: number | null }
  irpp: { nom: string; abattement_pct: number; tranches: Array<{ min: number; max: number; taux: number }> }
}

export function getConfigAffichageUnifie(pays: PaysFiscal): ConfigAffichageUnifiee {
  if (paysMigreVersCentral(pays)) {
    const cfg = getCountryConfig(pays)
    const plafondVieillesse = cfg.cnss.branches.find(b => b.taux_salarie > 0)?.plafond_mensuel ?? null
    return {
      cnss: {
        nom:            cfg.cnss.nom,
        acronyme:       cfg.cnss.acronyme,
        taux_salarie:   getTauxCNSSSalarie(pays),
        taux_patronal:  getTauxCNSSPatronal(pays),
        plafond_mensuel: plafondVieillesse,
      },
      irpp: {
        nom:            cfg.irpp.nom,
        abattement_pct: cfg.irpp.abattement.type === 'aucun' ? 0 : cfg.irpp.abattement.valeur,
        tranches:       cfg.irpp.tranches.map(t => ({ min: t.min, max: t.max, taux: t.taux })),
      },
    }
  }
  const cfg = getPaysConfig(pays)
  return { cnss: cfg.cnss, irpp: cfg.irpp }
}

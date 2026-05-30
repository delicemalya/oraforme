// ── Moteur de calcul fiscal OHADA multi-pays ─────────────────────────────────

import { getPaysConfig } from './pays'
import type {
  PaysFiscal, ResultatTVA, ResultatCNSS, ResultatIRPP,
  EcheanceFiscale, TypeDeclaration,
} from './types'

// ── TVA ───────────────────────────────────────────────────────────────────────

export function calculerTVA(
  tvaCollectee: number,
  tvaDeductible: number,
  pays: PaysFiscal = 'CG',
): ResultatTVA {
  const cfg = getPaysConfig(pays)
  const tvaCfg = cfg.tva

  const tva_nette = tvaCollectee - tvaDeductible
  const ca_ht = tvaCollectee > 0 ? tvaCollectee / tvaCfg.taux_normal : 0

  const taxes: Record<string, number> = {}
  for (const taxe of tvaCfg.taxes_additionnelles) {
    if (taxe.base === 'tva_collectee') taxes[taxe.code] = tvaCollectee * taxe.taux
    else if (taxe.base === 'ca_ht') taxes[taxe.code] = ca_ht * taxe.taux
  }

  const total_taxes_add = Object.values(taxes).reduce((a, b) => a + b, 0)
  const total_a_payer = Math.max(tva_nette, 0) + total_taxes_add
  const credit_tva = Math.max(-tva_nette, 0)

  return {
    tva_collectee: tvaCollectee,
    tva_deductible: tvaDeductible,
    tva_nette,
    taxes_additionnelles: taxes,
    total_a_payer: Math.round(total_a_payer),
    credit_tva: Math.round(credit_tva),
    ca_ht: Math.round(ca_ht),
  }
}

export function calculerTVAFromHT(montantHT: number, pays: PaysFiscal = 'CG') {
  const cfg = getPaysConfig(pays)
  const tva = Math.round(montantHT * cfg.tva.taux_normal)
  let ttc = montantHT + tva
  const taxes: Record<string, number> = {}

  for (const taxe of cfg.tva.taxes_additionnelles) {
    const montant = taxe.base === 'tva_collectee'
      ? Math.round(tva * taxe.taux)
      : Math.round(montantHT * taxe.taux)
    taxes[taxe.code] = montant
    ttc += montant
  }

  return { ht: montantHT, tva, ttc: Math.round(ttc), taxes }
}

// ── CNSS ──────────────────────────────────────────────────────────────────────

export function calculerCNSS(
  salaireBrut: number,
  pays: PaysFiscal = 'CG',
): { salarie: number; patronal: number; total: number; base: number } {
  const cfg = getPaysConfig(pays)
  const cnss = cfg.cnss
  const base = cnss.plafond_mensuel
    ? Math.min(salaireBrut, cnss.plafond_mensuel)
    : salaireBrut

  const salarie  = Math.round(base * cnss.taux_salarie)
  const patronal = Math.round(base * cnss.taux_patronal)

  return { salarie, patronal, total: salarie + patronal, base }
}

export function calculerCNSSAggrege(
  employes: Array<{ salaire_brut: number }>,
  pays: PaysFiscal = 'CG',
): ResultatCNSS {
  const cfg = getPaysConfig(pays)
  const cnss = cfg.cnss

  let totalBrut = 0
  let totalBase = 0
  let totalSalarie = 0
  let totalPatronal = 0

  for (const emp of employes) {
    const r = calculerCNSS(emp.salaire_brut, pays)
    totalBrut    += emp.salaire_brut
    totalBase    += r.base
    totalSalarie += r.salarie
    totalPatronal+= r.patronal
  }

  return {
    salaire_brut_total: totalBrut,
    base_cotisable: totalBase,
    cotisation_salarie: totalSalarie,
    cotisation_patronale: totalPatronal,
    total_cnss: totalSalarie + totalPatronal,
    nb_employes: employes.length,
    details_branches: { [cnss.acronyme]: totalSalarie + totalPatronal },
  }
}

// ── IRPP ──────────────────────────────────────────────────────────────────────

export function calculerIRPP(
  salaireBrut: number,
  pays: PaysFiscal = 'CG',
): { irpp: number; revenu_imposable: number; abattement: number } {
  const cfg = getPaysConfig(pays)
  const irppCfg = cfg.irpp
  const cnssResult = calculerCNSS(salaireBrut, pays)

  const baseApresAbatt = (salaireBrut - cnssResult.salarie) * (1 - irppCfg.abattement_pct)

  let irpp = 0
  let precedent = 0

  for (const tranche of irppCfg.tranches) {
    if (baseApresAbatt <= tranche.min) break
    const imposable = Math.min(baseApresAbatt, tranche.max) - Math.max(tranche.min, precedent)
    if (imposable > 0) irpp += imposable * tranche.taux
    precedent = tranche.max
    if (tranche.max >= baseApresAbatt) break
  }

  return {
    irpp: Math.round(irpp),
    revenu_imposable: Math.round(baseApresAbatt),
    abattement: Math.round((salaireBrut - cnssResult.salarie) * irppCfg.abattement_pct),
  }
}

// ── Bulletin de paie complet ──────────────────────────────────────────────────

export function calculerBulletin(salaireBrut: number, pays: PaysFiscal = 'CG') {
  const cnss = calculerCNSS(salaireBrut, pays)
  const irpp = calculerIRPP(salaireBrut, pays)
  const salaireNet = salaireBrut - cnss.salarie - irpp.irpp

  return {
    salaire_brut: salaireBrut,
    cnss_salarie: cnss.salarie,
    cnss_patronal: cnss.patronal,
    irpp: irpp.irpp,
    salaire_net: Math.round(salaireNet),
    cout_total_employeur: Math.round(salaireBrut + cnss.patronal),
    revenu_imposable: irpp.revenu_imposable,
  }
}

// ── Échéancier fiscal ─────────────────────────────────────────────────────────

export function calculerEcheancier(
  pays: PaysFiscal = 'CG',
  annee: number = new Date().getFullYear(),
): EcheanceFiscale[] {
  const cfg = getPaysConfig(pays)
  const echeances: EcheanceFiscale[] = []
  const now = new Date()

  // TVA mensuelle — 12 échéances
  for (let mois = 1; mois <= 12; mois++) {
    const d = cfg.tva.echeance_mois_suivant
      ? new Date(annee, mois, cfg.tva.echeance_jour)   // mois suivant
      : new Date(annee, mois - 1, cfg.tva.echeance_jour)

    echeances.push({
      type: 'tva',
      label: `TVA ${MOIS_FR[mois - 1]} ${annee}`,
      pays,
      periode_label: `${MOIS_FR[mois - 1]} ${annee}`,
      date_echeance: d.toISOString().split('T')[0],
      jours_restants: Math.ceil((d.getTime() - now.getTime()) / 86400_000),
      statut: getStatutEcheance(d, now),
    })
  }

  // CNSS mensuelle — 12 échéances
  for (let mois = 1; mois <= 12; mois++) {
    const d = cfg.cnss.echeance_mois_suivant
      ? new Date(annee, mois, cfg.cnss.echeance_jour)
      : new Date(annee, mois - 1, cfg.cnss.echeance_jour)

    echeances.push({
      type: 'cnss',
      label: `${cfg.cnss.acronyme} ${MOIS_FR[mois - 1]} ${annee}`,
      pays,
      periode_label: `${MOIS_FR[mois - 1]} ${annee}`,
      date_echeance: d.toISOString().split('T')[0],
      jours_restants: Math.ceil((d.getTime() - now.getTime()) / 86400_000),
      statut: getStatutEcheance(d, now),
    })
  }

  // Taxes annuelles
  for (const taxe of cfg.taxes_annuelles) {
    const d = new Date(annee, taxe.echeance_mois - 1, taxe.echeance_jour)
    echeances.push({
      type: taxe.code.toLowerCase() as TypeDeclaration,
      label: `${taxe.nom} ${annee}`,
      pays,
      periode_label: `Exercice ${annee}`,
      date_echeance: d.toISOString().split('T')[0],
      jours_restants: Math.ceil((d.getTime() - now.getTime()) / 86400_000),
      statut: getStatutEcheance(d, now),
    })
  }

  return echeances.sort((a, b) => a.date_echeance.localeCompare(b.date_echeance))
}

function getStatutEcheance(
  echeance: Date, now: Date,
): 'ok' | 'urgent' | 'retard' {
  const diff = Math.ceil((echeance.getTime() - now.getTime()) / 86400_000)
  if (diff < 0) return 'retard'
  if (diff <= 7) return 'urgent'
  return 'ok'
}

const MOIS_FR = ['Janv.','Févr.','Mars','Avr.','Mai','Juin','Juil.','Août','Sept.','Oct.','Nov.','Déc.']

// ── Formatage montants multi-devises ─────────────────────────────────────────

export function fmtMontantPays(n: number, pays: PaysFiscal = 'CG'): string {
  const cfg = getPaysConfig(pays)
  if (cfg.devise === 'EUR') return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(n)
  if (cfg.devise === 'CHF') return new Intl.NumberFormat('fr-CH', { style: 'currency', currency: 'CHF' }).format(n)
  if (cfg.devise === 'NGN') return '₦' + new Intl.NumberFormat('en-NG').format(Math.round(n))
  if (cfg.devise === 'AOA') return 'Kz ' + new Intl.NumberFormat('pt-AO').format(Math.round(n))
  return new Intl.NumberFormat('fr-FR').format(Math.round(n)) + ` ${cfg.devise}`
}

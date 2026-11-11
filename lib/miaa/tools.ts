/**
 * lib/miaa/tools.ts — Outils de calcul concrets pour MIAA+
 * Ces fonctions pré-calculent les résultats et les injectent dans le contexte Claude.
 *
 * Mission P0-PAIE-CG-2026 — élimination du 4ᵉ moteur fiscal (2026-09-18).
 * calculerSalaireNet() contenait sa propre arithmétique CG (CNSS 5,04% plafond
 * 1 500 000, IRPP à tranches précalculées en dur) et une approximation
 * générique (brut×0,88 etc.) pour tous les autres pays confondus. Aucun taux
 * n'est plus recopié ici : délègue à lib/fiscalite/engine-adapter.ts, qui
 * route CG/CM/GA/CD/CF/TD/GQ vers lib/fiscal/universal-tax-engine.ts (source
 * validée) et conserve l'ancien moteur lib/fiscalite/engine.ts, pays par
 * pays réel (pas une approximation unique), pour les 8 pays non validés.
 *
 * IMPORTANT : à ce jour, ce fichier n'est importé par aucun autre fichier du
 * dépôt (getContexteCalculs n'a aucun appelant) — la logique ci-dessous n'est
 * pas encore câblée dans un vrai prompt MIAA. Corrigée quand même : le risque
 * est latent, pas actif, mais réel dès qu'un appelant sera branché.
 */

import { calculerCNSSUnifie, calculerIRPPUnifie, paysMigreVersCentral } from '@/lib/fiscalite/engine-adapter'
import type { PaysFiscal } from '@/lib/fiscalite/types'

const fmt = (n: number) => new Intl.NumberFormat('fr-FR').format(Math.round(n)) + ' FCFA'

// ── TVA ────────────────────────────────────────────────────────────────────────

export function calculerTVA(ht: number, pays: string = 'CG') {
  if (pays === 'CG' || pays === 'GA' || pays === 'CM_CG') {
    const tva = Math.round(ht * 0.18)
    const ca  = Math.round(tva * 0.05)
    const ttc = ht + tva + ca
    return {
      ht, tva, ca, ttc, taux_tva: 18, taux_ca: 5,
      detail: `HT : ${fmt(ht)}\nTVA (18%) : ${fmt(tva)}\nCA (5% de la TVA) : ${fmt(ca)}\nTOTAL TTC : ${fmt(ttc)}`,
    }
  }
  if (pays === 'CM') {
    const tva = Math.round(ht * 0.1925)
    return { ht, tva, ca: 0, ttc: ht + tva, taux_tva: 19.25, taux_ca: 0, detail: `HT : ${fmt(ht)}\nTVA (19,25%) : ${fmt(tva)}\nTOTAL TTC : ${fmt(ht + tva)}` }
  }
  if (pays === 'CD') {
    const tva = Math.round(ht * 0.16)
    return { ht, tva, ca: 0, ttc: ht + tva, taux_tva: 16, taux_ca: 0, detail: `HT : ${fmt(ht)}\nTVA (16%) : ${fmt(tva)}\nTOTAL TTC : ${fmt(ht + tva)}` }
  }
  // Défaut CEDEAO/CEMAC 18%
  const tva = Math.round(ht * 0.18)
  return { ht, tva, ca: 0, ttc: ht + tva, taux_tva: 18, taux_ca: 0, detail: `HT : ${fmt(ht)}\nTVA (18%) : ${fmt(tva)}\nTOTAL TTC : ${fmt(ht + tva)}` }
}

// ── SALAIRE NET CONGO ──────────────────────────────────────────────────────────

/**
 * Simulation à 1 part fiscale (célibataire, sans enfant) — cette fonction ne
 * reçoit ni situation familiale ni nombre d'enfants (aucun paramètre pour
 * cela), même limitation déjà documentée pour le simulateur
 * app/dashboard/fiscalite/irpp/page.tsx et PaysContext.calculerSalaireNet().
 * Pas de plafond/branche/barème recopié ici : tout vient de
 * lib/fiscalite/engine-adapter.ts.
 *
 * "medecine_travail" (0,5%) a été retiré : ce n'est pas une branche du
 * moteur central (lib/countries/CG.ts n'en a pas), donc ne peut être ni
 * recalculé ici (inventerait un taux) ni conservé tel quel (recopierait
 * l'ancien).
 */
export function calculerSalaireNet(brut: number, pays: string = 'CG') {
  const paysFiscal = pays as PaysFiscal
  const cnss = calculerCNSSUnifie(brut, paysFiscal)
  const irppRes = calculerIRPPUnifie(brut, paysFiscal)

  const cnssEmploye     = cnss.salarie
  const revenuImposable = irppRes.revenu_imposable
  const irpp            = irppRes.irpp
  const net             = brut - cnssEmploye - irpp
  const cnssPatronal    = cnss.patronal
  const coutEmployeur   = brut + cnssPatronal

  const pctSalarie  = brut > 0 ? (cnssEmploye / brut * 100).toFixed(2) : '0.00'
  const pctPatronal = brut > 0 ? (cnssPatronal / brut * 100).toFixed(2) : '0.00'

  return {
    brut, cnss_employe: cnssEmploye, revenu_imposable: revenuImposable,
    irpp, net, cnss_patronal: cnssPatronal, cout_employeur: coutEmployeur,
    detail:
      `Salaire brut : ${fmt(brut)}\n` +
      `CNSS salarié (${pctSalarie}%) : -${fmt(cnssEmploye)}\n` +
      `Revenu imposable (après abattement) : ${fmt(revenuImposable)}\n` +
      `IRPP : -${fmt(irpp)}\n` +
      `NET À PAYER : ${fmt(net)}\n` +
      `\nCharges patronales :\n` +
      `CNSS patronal (${pctPatronal}%) : ${fmt(cnssPatronal)}\n` +
      `COÛT TOTAL EMPLOYEUR : ${fmt(coutEmployeur)}` +
      (paysMigreVersCentral(paysFiscal)
        ? ''
        : `\n\n(${pays} : barème de référence non revérifié — voir lib/fiscalite/engine.ts)`),
  }
}

// ── MOYENNE SCOLAIRE ───────────────────────────────────────────────────────────

export function calculerMoyenne(notes: { note: number; coefficient: number }[]) {
  if (!notes.length) return { moyenne: 0, mention: 'Aucune note' }
  const sumCoeff = notes.reduce((s, n) => s + n.coefficient, 0)
  const sumNote  = notes.reduce((s, n) => s + n.note * n.coefficient, 0)
  const moy      = Math.round((sumNote / sumCoeff) * 100) / 100

  const mention =
    moy >= 16 ? 'Très Bien' :
    moy >= 14 ? 'Bien' :
    moy >= 12 ? 'Assez Bien' :
    moy >= 10 ? 'Passable' : 'Insuffisant'

  return { moyenne: moy, mention }
}

// ── INJECTION DANS LE CONTEXTE ─────────────────────────────────────────────────

/** Pré-calcule des exemples pertinents à injecter dans le prompt selon le module */
export function getContexteCalculs(module: string, pays: string): string {
  if (module === 'facturation' || module === 'comptabilite') {
    const ex1 = calculerTVA(100_000, pays)
    const ex2 = calculerTVA(500_000, pays)
    return `EXEMPLES TVA PRÉ-CALCULÉS (${pays}) :\n` +
      `Sur 100 000 FCFA HT : ${ex1.detail}\n\n` +
      `Sur 500 000 FCFA HT : ${ex2.detail}`
  }
  if (module === 'rh') {
    const ex = calculerSalaireNet(500_000, pays)
    return `EXEMPLE SALAIRE PRÉ-CALCULÉ (${pays}) :\n${ex.detail}`
  }
  return ''
}

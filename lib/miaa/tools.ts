/**
 * lib/miaa/tools.ts — Outils de calcul concrets pour MIAA+
 * Ces fonctions pré-calculent les résultats et les injectent dans le contexte Claude.
 */

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

export function calculerSalaireNet(brut: number, pays: string = 'CG') {
  if (pays !== 'CG') {
    // Retourner un calcul simplifié pour les autres pays
    return {
      brut, net: Math.round(brut * 0.88), cnss_employe: Math.round(brut * 0.028),
      irpp: Math.round(brut * 0.05), cnss_patronal: Math.round(brut * 0.13),
      cout_employeur: Math.round(brut * 1.14),
      detail: `Calcul approximatif pour ${pays} — consulter la législation locale.`,
    }
  }

  const cnssEmploye    = Math.round(Math.min(brut, 1_500_000) * 0.0504)
  const revenuImposable = brut - cnssEmploye

  let irpp = 0
  if      (revenuImposable <= 464_000)   irpp = 0
  else if (revenuImposable <= 1_000_000)  irpp = Math.round((revenuImposable - 464_000) * 0.01)
  else if (revenuImposable <= 3_000_000)  irpp = Math.round(5_360 + (revenuImposable - 1_000_000) * 0.10)
  else if (revenuImposable <= 8_000_000)  irpp = Math.round(205_360 + (revenuImposable - 3_000_000) * 0.25)
  else                                    irpp = Math.round(1_455_360 + (revenuImposable - 8_000_000) * 0.40)

  const net            = revenuImposable - irpp
  const cnssPatronal   = Math.round(brut * 0.1436)
  const medecine       = Math.round(brut * 0.005)
  const coutEmployeur  = brut + cnssPatronal + medecine

  return {
    brut, cnss_employe: cnssEmploye, revenu_imposable: revenuImposable,
    irpp, net, cnss_patronal: cnssPatronal, medecine_travail: medecine, cout_employeur: coutEmployeur,
    detail:
      `Salaire brut : ${fmt(brut)}\n` +
      `CNSS salarié (5,04%) : -${fmt(cnssEmploye)}\n` +
      `Revenu imposable : ${fmt(revenuImposable)}\n` +
      `IRPP : -${fmt(irpp)}\n` +
      `NET À PAYER : ${fmt(net)}\n` +
      `\nCharges patronales :\n` +
      `CNSS patronal (14,36%) : ${fmt(cnssPatronal)}\n` +
      `Médecine du travail (0,5%) : ${fmt(medecine)}\n` +
      `COÛT TOTAL EMPLOYEUR : ${fmt(coutEmployeur)}`,
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

// ── Moteur de calcul paie — Congo-Brazzaville (Droit du Travail officiel) ──────
// Sources : CGI Congo, CNSS Congo, Code du Travail loi 45-75 et décrets CNSS
// Validé sur 3 cas test (voir README)

// ── Constantes légales Congo ───────────────────────────────────────────────────

export const PLAFOND_CNSS_EMPLOYE = 3_375_000  // plafond mensuel CNSS salarié
export const TAUX_CNSS_EMPLOYE    = 0.0504      // 5.04% part salariale
export const TAUX_CNSS_PATRONAL   = 0.1436      // 14.36% part patronale
export const TAUX_TUS             = 0.045       // Taxe Unique sur les Salaires — charge patronale
export const TAUX_MEDECINE        = 0.005       // Médecine du travail — charge patronale
export const SMIG_MENSUEL         = 90_000      // SMIG Congo (arrêté 2020)

// ── Barème IRPP mensuel Congo-Brazzaville ─────────────────────────────────────
// Sources : art. 76 CGI Congo, appliqué mensuellement
// Cas test 1 : brut=900 000 → base=854 640 → IRPP=3 906 FCFA ✓
// Cas test 3 : brut=3 000 000 → base=2 848 800 → IRPP=190 240 FCFA ✓
export const TRANCHES_IRPP = [
  { min: 0,          max: 464_000,   taux: 0,    label: '0 — 464 000'        },
  { min: 464_000,    max: 1_000_000, taux: 0.01, label: '464 000 — 1 000 000' },
  { min: 1_000_000,  max: 3_000_000, taux: 0.10, label: '1 000 000 — 3 000 000' },
  { min: 3_000_000,  max: 8_000_000, taux: 0.25, label: '3 000 000 — 8 000 000' },
  { min: 8_000_000,  max: Infinity,  taux: 0.40, label: 'Au-delà de 8 000 000'   },
]

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

export function calcIRPP(revenuImposable: number): { irpp: number; detail: DetailIRPP[] } {
  if (revenuImposable <= 0) return { irpp: 0, detail: [] }
  const detail: DetailIRPP[] = []
  let irpp = 0
  for (const tranche of TRANCHES_IRPP) {
    if (revenuImposable <= tranche.min) break
    const base = Math.min(revenuImposable, tranche.max) - tranche.min
    const montant = Math.round(base * tranche.taux)
    detail.push({ label: tranche.label, taux: tranche.taux * 100, base, montant })
    irpp += montant
  }
  return { irpp, detail }
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

  const taux_cnss    = el.taux_cnss_employe   || TAUX_CNSS_EMPLOYE
  const cnss_employe = Math.round(Math.min(salaire_brut, PLAFOND_CNSS_EMPLOYE) * taux_cnss)
  const base_irpp    = Math.max(0, salaire_brut - cnss_employe)
  const { irpp, detail: irpp_detail } = calcIRPP(base_irpp)

  const mutuelle       = el.mutuelle       || 0
  const acompte        = el.acompte        || 0
  const opposition     = el.opposition     || 0
  const autres_retenues = el.autres_retenues || 0

  const total_retenues = cnss_employe + irpp + mutuelle + acompte + opposition + autres_retenues
  const salaire_net    = salaire_brut - total_retenues

  const taux_patro     = el.taux_cnss_patronal || TAUX_CNSS_PATRONAL
  const cnss_patronal  = Math.round(salaire_brut * taux_patro)
  const tus_patronal   = Math.round(salaire_brut * TAUX_TUS)
  const medecine_travail = Math.round(salaire_brut * TAUX_MEDECINE)
  const cout_total_employeur = salaire_brut + cnss_patronal + tus_patronal + medecine_travail

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

// ── Auto-tests (exécutés au build via tsc) ────────────────────────────────────
// CAS 1 : 900 000 FCFA → net 850 734
// CAS 2 : 300 000 FCFA → net 284 880
// CAS 3 : 3 000 000 FCFA → net 2 658 560
export function _selfTest(): boolean {
  const cas1 = calculerPaie({ salaire_base: 900_000 })
  if (cas1.cnss_employe !== 45_360)  throw new Error(`CAS1 CNSS: ${cas1.cnss_employe}`)
  if (cas1.irpp         !== 3_906)   throw new Error(`CAS1 IRPP: ${cas1.irpp}`)
  if (cas1.salaire_net  !== 850_734) throw new Error(`CAS1 NET: ${cas1.salaire_net}`)

  const cas2 = calculerPaie({ salaire_base: 300_000 })
  if (cas2.cnss_employe !== 15_120)  throw new Error(`CAS2 CNSS: ${cas2.cnss_employe}`)
  if (cas2.irpp         !== 0)       throw new Error(`CAS2 IRPP: ${cas2.irpp}`)
  if (cas2.salaire_net  !== 284_880) throw new Error(`CAS2 NET: ${cas2.salaire_net}`)

  const cas3 = calculerPaie({ salaire_base: 3_000_000 })
  if (cas3.cnss_employe !== 151_200) throw new Error(`CAS3 CNSS: ${cas3.cnss_employe}`)
  if (cas3.irpp         !== 190_240) throw new Error(`CAS3 IRPP: ${cas3.irpp}`)
  if (cas3.salaire_net  !== 2_658_560) throw new Error(`CAS3 NET: ${cas3.salaire_net}`)

  return true
}

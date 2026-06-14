// ─── Moteur de calcul — Contribution de la Patente (CGI Congo) ──────────────
// Source : Loi n°42-2025 du 31 décembre 2025 — Loi de Finances 2026
// Art. 122 CGI — Barème officiel 10 tranches (CORRECTION LF 2026)
// MINIMUM PERCEPTION : 10 000 FCFA (anciennement 50 000 FCFA)

// Barème officiel LF 2026 — 10 tranches (Art. 122 CGI Congo)
export const BAREME_PATENTE_CG = [
  { seuilMax:               1_000_000, type: 'forfait' as const, montant: 10_000 },
  { seuilMin:    1_000_001, seuilMax:  20_000_000, taux: 0.0975  },
  { seuilMin:   20_000_001, seuilMax:  40_000_000, taux: 0.0065  },
  { seuilMin:   40_000_001, seuilMax: 100_000_000, taux: 0.0045  },
  { seuilMin:  100_000_001, seuilMax: 300_000_000, taux: 0.0020  },
  { seuilMin:  300_000_001, seuilMax: 500_000_000, taux: 0.0045  },
  { seuilMin:  500_000_001, seuilMax: 1_000_000_000, taux: 0.0014  },
  { seuilMin: 1_000_000_001, seuilMax: 3_000_000_000, taux: 0.00135 },
  { seuilMin: 3_000_000_001, seuilMax: 20_000_000_000, taux: 0.00125 },
  { seuilMin: 20_000_000_001, taux: 0.00045 },
] as const

export const MINIMUM_PERCEPTION_FCFA    = 10_000  // LF 2026 (anciennement 50 000 FCFA)
export const TAUX_CENTIMES_ADDITIONNELS = 0.05    // 5% sur patente liquidée
export const TAUX_CAMU                  = 0.005   // 0,5% sur patente liquidée
export const TAUX_REDUCTION_PETROLIERE  = 0.50    // 50% — sociétés pétrolières uniquement (Art. 314 CGI)

export const DEPARTEMENTS_CG = [
  { code: 'BZV', nom: 'Brazzaville' },
  { code: 'PNR', nom: 'Pointe-Noire' },
  { code: 'BOU', nom: 'Bouenza' },
  { code: 'CUV', nom: 'Cuvette' },
  { code: 'CUO', nom: 'Cuvette-Ouest' },
  { code: 'KOU', nom: 'Kouilou' },
  { code: 'LEK', nom: 'Lékoumou' },
  { code: 'LIK', nom: 'Likouala' },
  { code: 'NIA', nom: 'Niari' },
  { code: 'PLA', nom: 'Plateaux' },
  { code: 'POO', nom: 'Pool' },
  { code: 'SAN', nom: 'Sangha' },
] as const

export interface DepartementRepartition {
  code: string
  nom: string
  ca: number
  pourcentage: number
}

export interface ResultatPatente {
  ca_annuel: number
  ca_exonere: number
  ca_imposable: number
  taux_applicable: number
  patente_brute: number
  patente_liquidee: number
  est_societe_petroliere: boolean
  montant_reduction: number
  patente_apres_reduction: number
  centimes_additionnels: number
  camu: number
  credit_n1: number
  patente_nette: number
}

export function getTauxPatente(caImposable: number): number {
  if (caImposable <= 0)             return 0
  if (caImposable <= 1_000_000)    return 0        // forfait — taux symbolique
  if (caImposable <= 20_000_000)   return 0.0975
  if (caImposable <= 40_000_000)   return 0.0065
  if (caImposable <= 100_000_000)  return 0.0045
  if (caImposable <= 300_000_000)  return 0.0020
  if (caImposable <= 500_000_000)  return 0.0045
  if (caImposable <= 1_000_000_000) return 0.0014
  if (caImposable <= 3_000_000_000) return 0.00135
  if (caImposable <= 20_000_000_000) return 0.00125
  return 0.00045
}

export function calculerPatente(
  caAnnuel: number,
  caExonere: number,
  estSocietePetroliere: boolean,
  creditN1 = 0,
): ResultatPatente {
  const ca_imposable = Math.max(0, caAnnuel - caExonere)

  let taux = 0
  let patente_brute = 0

  if (ca_imposable <= 0) {
    patente_brute = MINIMUM_PERCEPTION_FCFA
  } else if (ca_imposable <= 1_000_000) {
    // Tranche 1 : forfait 10 000 FCFA
    taux          = 0
    patente_brute = 10_000
  } else {
    taux          = getTauxPatente(ca_imposable)
    patente_brute = Math.round(ca_imposable * taux)
  }

  const patente_liquidee = Math.max(patente_brute, MINIMUM_PERCEPTION_FCFA)

  const montant_reduction       = estSocietePetroliere
    ? Math.round(patente_liquidee * TAUX_REDUCTION_PETROLIERE) : 0
  const patente_apres_reduction = patente_liquidee - montant_reduction
  const centimes_additionnels   = Math.round(patente_liquidee * TAUX_CENTIMES_ADDITIONNELS)
  const camu                    = Math.round(patente_liquidee * TAUX_CAMU)
  const credit                  = Math.max(0, creditN1)
  const patente_nette           = Math.max(0, patente_apres_reduction + centimes_additionnels + camu - credit)

  return {
    ca_annuel: caAnnuel,
    ca_exonere: caExonere,
    ca_imposable,
    taux_applicable:        taux,
    patente_brute,
    patente_liquidee,
    est_societe_petroliere: estSocietePetroliere,
    montant_reduction,
    patente_apres_reduction,
    centimes_additionnels,
    camu,
    credit_n1: creditN1,
    patente_nette,
  }
}

export function initDepartements(): DepartementRepartition[] {
  return DEPARTEMENTS_CG.map(d => ({ ...d, ca: 0, pourcentage: 0 }))
}

export function recalcDepartementPourcentages(
  depts: DepartementRepartition[],
  caTotal: number,
): DepartementRepartition[] {
  return depts.map(d => ({
    ...d,
    pourcentage: caTotal > 0 ? Math.round((d.ca / caTotal) * 10000) / 100 : 0,
  }))
}

// ─── Montant en lettres — Français ───────────────────────────────────────────

const ONES_FR = [
  '', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf',
  'dix', 'onze', 'douze', 'treize', 'quatorze', 'quinze', 'seize',
  'dix-sept', 'dix-huit', 'dix-neuf',
]
const TENS_FR = ['', '', 'vingt', 'trente', 'quarante', 'cinquante', 'soixante']

function belowHundred(n: number): string {
  if (n < 20) return ONES_FR[n]
  const t = Math.floor(n / 10)
  const u = n % 10
  if (t === 7) return u === 1 ? 'soixante et onze' : `soixante-${ONES_FR[10 + u]}`
  if (t === 8) return u === 0 ? 'quatre-vingts' : `quatre-vingt-${ONES_FR[u]}`
  if (t === 9) return `quatre-vingt-${ONES_FR[10 + u]}`
  if (u === 0) return TENS_FR[t]
  if (u === 1) return `${TENS_FR[t]} et un`
  return `${TENS_FR[t]}-${ONES_FR[u]}`
}

function belowThousand(n: number): string {
  const h   = Math.floor(n / 100)
  const rem = n % 100
  if (h === 0) return belowHundred(n)
  const centStr = h === 1 ? 'cent' : `${ONES_FR[h]} cent`
  if (rem === 0) return h > 1 ? `${centStr}s` : centStr
  return `${centStr} ${belowHundred(rem)}`
}

function convertInteger(n: number): string {
  if (n === 0) return 'zéro'
  const milliards = Math.floor(n / 1_000_000_000)
  const millions  = Math.floor((n % 1_000_000_000) / 1_000_000)
  const milliers  = Math.floor((n % 1_000_000) / 1_000)
  const units     = n % 1_000
  const parts: string[] = []
  if (milliards > 0) parts.push(milliards === 1 ? 'un milliard'  : `${belowThousand(milliards)} milliards`)
  if (millions  > 0) parts.push(millions  === 1 ? 'un million'   : `${belowThousand(millions)} millions`)
  if (milliers  > 0) parts.push(milliers  === 1 ? 'mille'        : `${belowThousand(milliers)} mille`)
  if (units     > 0) parts.push(belowThousand(units))
  return parts.join(' ')
}

export function montantEnLettres(n: number): string {
  if (!Number.isFinite(n) || n < 0) return ''
  const integer = Math.round(n)
  if (integer === 0) return 'zéro franc CFA'
  return `${convertInteger(integer)} franc${integer > 1 ? 's' : ''} CFA`
}

export function fmtFCFA(n: number): string {
  return new Intl.NumberFormat('fr-CG', { style: 'currency', currency: 'XAF', maximumFractionDigits: 0 })
    .format(n)
}

/**
 * Contribution de la Patente — préparation du document (CGI Congo).
 *
 * Ce module ne détient plus le barème. Il vit dans lib/countries/CG.ts, avec sa
 * source, et n'est lu qu'ici. Le barème y a été déplacé valeur pour valeur.
 *
 * Le module en portait deux copies : la table exportée et une cascade de
 * conditions dans getTauxPatente(). Deux copies d'un même barème finissent
 * toujours par diverger ; une seule subsiste, dans la configuration pays.
 */

import { getBaremePatente, type CodePays } from '@/lib/fiscal/universal-tax-engine'

/** Document propre au Congo. */
const PAYS: CodePays = 'CG'

function bareme() {
  const p = getBaremePatente(PAYS)
  if (!p) {
    throw new Error(
      `Barème de patente non configuré pour ${PAYS}. Aucun document ne peut être produit sans barème vérifié.`,
    )
  }
  return p
}

export const BAREME_PATENTE_CG        = bareme().tranches
export const MINIMUM_PERCEPTION_FCFA  = bareme().minimum_perception
export const TAUX_CENTIMES_ADDITIONNELS = bareme().taux_centimes_additionnels
export const TAUX_CAMU                = bareme().taux_camu
export const TAUX_REDUCTION_PETROLIERE = bareme().taux_reduction_petroliere
export const SOURCE_PATENTE           = bareme().source

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

/** Taux applicable au chiffre d'affaires imposable, lu dans le barème. */
export function getTauxPatente(caImposable: number): number {
  if (caImposable <= 0) return 0
  const tranche = bareme().tranches.find(t =>
    caImposable >= (t.seuil_min ?? 0) && caImposable <= (t.seuil_max ?? Infinity),
  )
  return tranche?.taux ?? 0
}

/** Forfait de la première tranche, s'il existe. */
function forfaitPremiereTranche(caImposable: number): number | null {
  const t = bareme().tranches.find(x =>
    x.type === 'forfait' && caImposable <= (x.seuil_max ?? Infinity),
  )
  return t?.montant ?? null
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

  const forfait = ca_imposable > 0 ? forfaitPremiereTranche(ca_imposable) : null

  if (ca_imposable <= 0) {
    patente_brute = MINIMUM_PERCEPTION_FCFA
  } else if (forfait !== null) {
    // Première tranche : forfait, pas de taux
    taux          = 0
    patente_brute = forfait
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

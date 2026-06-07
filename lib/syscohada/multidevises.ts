// ─────────────────────────────────────────────────────────────────────────────
// Multi-devises SYSCOHADA — Conversions et gestion des taux
// Monnaie fonctionnelle : XAF (Franc CFA BEAC)
// ─────────────────────────────────────────────────────────────────────────────

export interface TauxChange {
  id?:            string
  tenant_id?:     string
  devise_source:  string
  devise_cible:   string
  taux:           number
  date_taux:      string
  source_taux:    'manuel' | 'bceao' | 'banque_de_france' | 'marche'
  notes?:         string
}

export interface Devise {
  code:    string
  nom:     string
  symbole: string
  pays:    string[]
}

// Devises SYSCOHADA supportées
export const DEVISES: Record<string, Devise> = {
  XAF: { code: 'XAF', nom: 'Franc CFA BEAC',     symbole: 'FCFA', pays: ['CG','CM','GA','CF','TD','GQ'] },
  XOF: { code: 'XOF', nom: 'Franc CFA BCEAO',    symbole: 'CFA',  pays: ['SN','CI','ML','BF','BJ','TG','NE','GW'] },
  EUR: { code: 'EUR', nom: 'Euro',                symbole: '€',    pays: ['FR','BE','DE','ES','IT'] },
  USD: { code: 'USD', nom: 'Dollar américain',    symbole: '$',    pays: ['US'] },
  GBP: { code: 'GBP', nom: 'Livre sterling',      symbole: '£',    pays: ['GB'] },
  CNY: { code: 'CNY', nom: 'Yuan chinois',        symbole: '¥',    pays: ['CN'] },
  CHF: { code: 'CHF', nom: 'Franc suisse',        symbole: 'CHF',  pays: ['CH'] },
  NGN: { code: 'NGN', nom: 'Naira nigérian',      symbole: '₦',    pays: ['NG'] },
  GHS: { code: 'GHS', nom: 'Cedi ghanéen',        symbole: '₵',    pays: ['GH'] },
  MAD: { code: 'MAD', nom: 'Dirham marocain',     symbole: 'DH',   pays: ['MA'] },
}

// Parité fixe officielle XAF/EUR (depuis 1999, arrimé par la France via la BCE)
export const PARITE_EUR_XAF = 655.957

// Taux de référence indicatifs (à mettre à jour manuellement)
export const TAUX_REFERENCE: Record<string, number> = {
  EUR: 655.957,  // Parité fixe BCEAO
  XOF: 1.0,      // XOF et XAF ont la même valeur nominale
  USD: 615.0,    // Variable — à mettre à jour
  GBP: 780.0,    // Variable — à mettre à jour
  CNY: 85.0,     // Variable — à mettre à jour
  CHF: 690.0,    // Variable — à mettre à jour
}

export function convertirEnXAF(montant: number, devise: string, taux: number): number {
  if (devise === 'XAF') return montant
  if (devise === 'XOF') return montant // parité 1:1
  return Math.round(montant * taux)
}

export function formatDevise(montant: number, devise: string = 'XAF'): string {
  const d = DEVISES[devise]
  const symbol = d?.symbole ?? devise
  const formatted = new Intl.NumberFormat('fr-FR').format(Math.round(montant))
  return `${formatted} ${symbol}`
}

// Compte SYSCOHADA pour les différences de change
export const COMPTE_GAIN_CHANGE  = '776'  // Gains de change
export const COMPTE_PERTE_CHANGE = '676'  // Pertes de change

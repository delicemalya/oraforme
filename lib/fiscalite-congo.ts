/**
 * TVA Congo-Brazzaville :
 *  TVA = HT × 18%
 *  CA  = TVA × 5%  (Centime Additionnel = 5% de la TVA, PAS du HT)
 *  TTC = HT + TVA + CA
 *
 * Exemple : HT=100 000 → TVA=18 000 → CA=900 → TTC=118 900 FCFA
 */
export function calculerTVACongo(montantHT: number) {
  const tva  = Math.round(montantHT * 0.18)
  const ca   = Math.round(tva * 0.05)
  const ttc  = montantHT + tva + ca
  const fmt  = (n: number) => new Intl.NumberFormat('fr-FR').format(n) + ' FCFA'
  return {
    ht:       montantHT,
    tva,
    taux_tva: 18,
    ca,
    taux_ca:  5,
    ttc,
    detail: `HT : ${fmt(montantHT)}\nTVA (18%) : ${fmt(tva)}\nCA (5% de la TVA) : ${fmt(ca)}\nTOTAL TTC : ${fmt(ttc)}`,
  }
}

export function formaterMontant(n: number): string {
  return new Intl.NumberFormat('fr-FR').format(Math.round(n)) + ' FCFA'
}

export function genererNumeroFacture(prefixe: string, count: number): string {
  const year = new Date().getFullYear()
  return `${prefixe}-${year}-${String(count + 1).padStart(4, '0')}`
}

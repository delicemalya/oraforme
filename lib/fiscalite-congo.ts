export function calculerTVACongo(montantHT: number) {
  const tva = Math.round(montantHT * 0.18)
  const ca  = Math.round(tva * 0.05)
  const ttc = montantHT + tva + ca
  return { ht: montantHT, tva, ca, ttc }
}

export function formaterMontant(n: number): string {
  return new Intl.NumberFormat('fr-FR').format(Math.round(n)) + ' FCFA'
}

export function genererNumeroFacture(prefixe: string, count: number): string {
  const year = new Date().getFullYear()
  return `${prefixe}-${year}-${String(count + 1).padStart(4, '0')}`
}

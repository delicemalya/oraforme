/**
 * Pré-remplissage de la Déclaration Générale des Impôts et Taxes (DGI Congo).
 *
 * Document propre au Congo : ses lignes sont celles du formulaire congolais.
 * Une version multi-pays suppose une correspondance ligne à ligne par pays,
 * qui n'existe pas ; le pays est donc figé et déclaré ici plutôt que deviné.
 *
 * Aucun taux dans ce fichier. Deux corrections de fond par rapport à la
 * version précédente :
 *
 *  - Ligne 9, TUS. La taxe unique sur les salaires, part fiscale, était
 *    liquidée à 4,5 % en dur. Elle est supprimée par la LF 2026. Le taux vient
 *    désormais de getTaxeAbrogee(), qui rend 0 pour une période postérieure à
 *    l'abrogation et le taux d'origine pour une période antérieure : une
 *    déclaration rectificative sur 2025 reste juste.
 *
 *  - Ligne 3, TVA. Le code lisait factures.tva comme un TAUX et le multipliait
 *    par le montant hors taxe. Cette colonne porte un MONTANT depuis la
 *    migration 160, qui l'a élargie à NUMERIC(14,2) pour cette raison. La TVA
 *    collectée est donc la somme des montants, et le centime additionnel vient
 *    du moteur fiscal.
 */

import {
  getTaxeAbrogee,
  calculerTaxesAdditionnellesSurTVA,
  type CodePays,
} from '@/lib/fiscal/universal-tax-engine'

/** Formulaire propre à la DGI congolaise. */
const PAYS: CodePays = 'CG'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PreRemplissageResult {
  // Ligne 3 — TVA
  l3_tva: number
  l3_tva_centimes: number
  // Ligne 8 — IRPP salaires
  l8_irpp_salaires: number
  l8_nb_employes: number
  l8_salaires_bruts: number
  // Ligne 9 — TUS (part fiscale, supprimée par la LF 2026)
  l9_tus: number
  l9_salaires_bruts: number
  l9_tus_taux: number
  l9_tus_abrogee: boolean
  l9_tus_base_legale: string
  // Totaux estimés
  total_principal: number
  total_centimes: number
  total_droits_payes: number
  pre_rempli: true
}

// ─── Pré-remplissage depuis les modules existants ─────────────────────────────

export async function preRemplirDeclaration(
  tenantId: string,
  mois: number,
  annee: number,
   
  supabase: any,
): Promise<PreRemplissageResult> {
  const debutDate = `${annee}-${String(mois).padStart(2, '0')}-01`
  const finDate   = new Date(annee, mois, 0).toISOString().split('T')[0]

  // ── Ligne 3 : TVA depuis les factures payées du mois ──────────────────────
  // factures.tva porte un MONTANT de TVA, pas un taux (migration 160).
  const { data: factures } = await supabase
    .from('factures')
    .select('montant_ht, tva')
    .eq('tenant_id', tenantId)
    .eq('statut', 'payee')
    .gte('created_at', debutDate)
    .lte('created_at', finDate + 'T23:59:59Z')

  const tvaCollectee = (factures as Array<{ montant_ht: number; tva: number }> | null)
    ?.reduce((s, f) => s + Number(f.tva || 0), 0) ?? 0

  // Taxes additionnelles assises sur la TVA collectée — Centime Additionnel au
  // Congo. Taux lu dans la configuration pays, jamais réécrit ici.
  const centimesAdditionnels = calculerTaxesAdditionnellesSurTVA(PAYS, tvaCollectee).total

  // ── Lignes 8 & 9 : IRPP et TUS depuis les bulletins de paie du mois ───────
  const { data: bulletins } = await supabase
    .from('bulletins_paie')
    .select('brut, irpp')
    .eq('tenant_id', tenantId)
    .eq('mois', mois)
    .eq('annee', annee)

  const nbEmployes   = (bulletins as Array<unknown> | null)?.length ?? 0
  const salaireBrut  = (bulletins as Array<{ brut: number; irpp: number }> | null)
    ?.reduce((s, b) => s + Number(b.brut || 0), 0) ?? 0
  const irppTotal    = (bulletins as Array<{ brut: number; irpp: number }> | null)
    ?.reduce((s, b) => s + Number(b.irpp || 0), 0) ?? 0

  // TUS part fiscale — abrogée par la LF 2026, donc 0 à compter du 1er janvier
  // 2026. Le taux dépend de la période déclarée, pas d'une constante.
  const tusRegle = getTaxeAbrogee(PAYS, 'TUS_FISCALE', debutDate)
  const tusTaux  = tusRegle?.taux ?? 0
  const tus      = Math.round(salaireBrut * tusTaux)

  // ── Calcul des totaux estimés ──────────────────────────────────────────────
  const totalPrincipal = Math.round(tvaCollectee) + irppTotal + tus
  const totalCentimes  = centimesAdditionnels
  const totalGeneral   = totalPrincipal + totalCentimes

  return {
    l3_tva:            Math.round(tvaCollectee),
    l3_tva_centimes:   centimesAdditionnels,
    l8_irpp_salaires:  irppTotal,
    l8_nb_employes:    nbEmployes,
    l8_salaires_bruts: Math.round(salaireBrut),
    l9_tus:            tus,
    l9_salaires_bruts: Math.round(salaireBrut),
    l9_tus_taux:       tusTaux,
    l9_tus_abrogee:    tusRegle?.abrogee ?? true,
    l9_tus_base_legale: tusRegle?.base_legale ?? 'Taxe inconnue de la configuration pays',
    total_principal:   totalPrincipal,
    total_centimes:    totalCentimes,
    total_droits_payes: totalGeneral,
    pre_rempli:        true,
  }
}

// ─── Calcul de la date limite (20 du mois suivant) ────────────────────────────

export function getDateLimite(mois: number, annee: number): Date {
  const moisSuivant = mois === 12 ? 1 : mois + 1
  const anneeSuivant = mois === 12 ? annee + 1 : annee
  return new Date(anneeSuivant, moisSuivant - 1, 20)
}

export function getJoursRestants(mois: number, annee: number): number {
  const limite = getDateLimite(mois, annee)
  return Math.ceil((limite.getTime() - Date.now()) / 86_400_000)
}

// ─── Montant en lettres (FCFA) ────────────────────────────────────────────────

const UNITES = ['', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf',
  'dix', 'onze', 'douze', 'treize', 'quatorze', 'quinze', 'seize', 'dix-sept', 'dix-huit', 'dix-neuf']
const DIZAINES = ['', '', 'vingt', 'trente', 'quarante', 'cinquante', 'soixante', 'soixante', 'quatre-vingt', 'quatre-vingt']

function troisChiffres(n: number): string {
  if (n === 0) return ''
  const c = Math.floor(n / 100)
  const r = n % 100
  const d = Math.floor(r / 10)
  const u = r % 10
  let s = c > 0 ? (c === 1 ? 'cent' : UNITES[c] + ' cent') : ''
  if (c > 0 && r === 0) { s += 's'; return s }
  if (r > 0 && c > 0) s += ' '
  if (r < 20) { s += UNITES[r] }
  else {
    s += DIZAINES[d]
    if (d === 7 || d === 9) { s += (u === 1 ? '-et-' : '-') + UNITES[10 + u] }
    else if (u === 1 && d !== 8) { s += '-et-un' }
    else if (u > 0) { s += (d === 8 && u === 0 ? 's' : '-' + UNITES[u]) }
    else if (d === 8) { s += 's' }
  }
  return s
}

export function montantEnLettres(n: number): string {
  if (!n || n === 0) return 'zéro franc CFA'
  const entier = Math.round(n)
  if (entier === 0) return 'zéro franc CFA'
  const milliards = Math.floor(entier / 1_000_000_000)
  const millions  = Math.floor((entier % 1_000_000_000) / 1_000_000)
  const milliers  = Math.floor((entier % 1_000_000) / 1_000)
  const reste     = entier % 1_000
  const parts: string[] = []
  if (milliards > 0) parts.push(troisChiffres(milliards) + ' milliard' + (milliards > 1 ? 's' : ''))
  if (millions  > 0) parts.push(troisChiffres(millions)  + ' million'  + (millions  > 1 ? 's' : ''))
  if (milliers  > 0) parts.push((milliers === 1 ? 'mille' : troisChiffres(milliers) + ' mille'))
  if (reste     > 0) parts.push(troisChiffres(reste))
  const result = parts.join(' ').trim()
  return result.charAt(0).toUpperCase() + result.slice(1) + ' francs CFA'
}

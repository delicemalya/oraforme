// Moteur de pré-remplissage — Déclaration Générale des Impôts (DGI Congo)
// Tire les données des modules existants : factures, bulletins_paie

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PreRemplissageResult {
  // Ligne 3 — TVA
  l3_tva: number
  l3_tva_centimes: number
  // Ligne 8 — IRPP salaires
  l8_irpp_salaires: number
  l8_nb_employes: number
  l8_salaires_bruts: number
  // Ligne 9 — TUS
  l9_tus: number
  l9_salaires_bruts: number
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
): Promise<PreRemplissageResult> {
  const debutDate = `${annee}-${String(mois).padStart(2, '0')}-01`
  const finDate   = new Date(annee, mois, 0).toISOString().split('T')[0]

  // ── Ligne 3 : TVA depuis les factures payées du mois ──────────────────────
  // factures.tva = taux TVA (ex: 18), factures.montant_ht = base HT
  const { data: factures } = await supabase
    .from('factures')
    .select('montant_ht, tva')
    .eq('tenant_id', tenantId)
    .eq('statut', 'payee')
    .gte('created_at', debutDate)
    .lte('created_at', finDate + 'T23:59:59Z')

  const caHT = (factures as Array<{ montant_ht: number; tva: number }> | null)
    ?.reduce((s, f) => s + Number(f.montant_ht || 0), 0) ?? 0

  const tvaCollectee = (factures as Array<{ montant_ht: number; tva: number }> | null)
    ?.reduce((s, f) => {
      const taux = Number(f.tva || 18) / 100
      return s + Number(f.montant_ht || 0) * taux
    }, 0) ?? 0

  // Centime additionnel Congo = 5% de la TVA collectée
  const centimesAdditionnels = Math.round(tvaCollectee * 0.05)

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

  // TUS = Taxe Unique sur les Salaires = 4,5% des salaires bruts
  const tus = Math.round(salaireBrut * 0.045)

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

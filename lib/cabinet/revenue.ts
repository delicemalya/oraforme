// ── Constantes ───────────────────────────────────────────────────────────────

export const FRAIS_ORAFORME_PAR_CLIENT = 5_000 // FCFA / XAF

/** Taux de change FIXES de référence (XAF base) — à actualiser via table taux_change */
export const TAUX_CHANGE_REF: Record<string, number> = {
  XAF: 1,
  XOF: 1,           // 1 XOF = 1 XAF (zone UEMOA vs CEMAC)
  EUR: 655.957,      // 1 EUR = 655.957 XAF (parité fixe CFA)
  USD: 608,          // approximatif — charger depuis la DB
  GBP: 770,          // approximatif
  AOA: 0.663,        // 1 Kwanza ≈ 0.663 XAF
  NGN: 0.395,        // 1 Naira ≈ 0.395 XAF
  GHS: 42.5,         // 1 Cedi ≈ 42.5 XAF
  MAD: 60.1,         // 1 Dirham ≈ 60.1 XAF
  CNY: 83.5,
}

export const DEVISES_DISPONIBLES = [
  { code: 'XAF', label: 'FCFA (XAF)', pays: 'Congo, Cameroun, Gabon, RCA, Tchad, Guinée Éq.' },
  { code: 'XOF', label: 'FCFA (XOF)', pays: 'Sénégal, Côte d\'Ivoire, Mali, Burkina, Togo, Bénin' },
  { code: 'EUR', label: 'Euro (EUR)', pays: 'France, Zone Euro' },
  { code: 'USD', label: 'Dollar US (USD)', pays: 'États-Unis, Liberia, Zimbabwe' },
  { code: 'GBP', label: 'Livre Sterling (GBP)', pays: 'Royaume-Uni' },
  { code: 'AOA', label: 'Kwanza (AOA)', pays: 'Angola' },
  { code: 'NGN', label: 'Naira (NGN)', pays: 'Nigeria' },
  { code: 'GHS', label: 'Cedi (GHS)', pays: 'Ghana' },
  { code: 'MAD', label: 'Dirham (MAD)', pays: 'Maroc' },
]

// ── Types ─────────────────────────────────────────────────────────────────────

export interface RevenueOraforme {
  cabinet_tenant_id: string
  client_id:         string
  mois:              number
  annee:             number
  montant:           number   // en XAF/FCFA
  devise:            string
  statut:            'en_attente' | 'facture' | 'paye'
}

// ── Fonctions ─────────────────────────────────────────────────────────────────

/**
 * Convertit un montant FCFA en devise locale.
 * @param montantXAF  Montant source en XAF
 * @param deviseCible Code ISO de la devise cible
 */
export function convertirXAFvers(montantXAF: number, deviseCible: string): number {
  const taux = TAUX_CHANGE_REF[deviseCible] ?? 1
  if (deviseCible === 'XAF' || deviseCible === 'XOF') return Math.round(montantXAF)
  // Pour EUR/USD/GBP : divisé par le taux (car taux = combien XAF pour 1 devise)
  if (['EUR','USD','GBP','GHS','MAD'].includes(deviseCible)) {
    return Number((montantXAF / taux).toFixed(2))
  }
  // Pour AOA, NGN : multiplié (car 1 XAF = X unités de la devise petite)
  return Number((montantXAF / taux).toFixed(2))
}

/**
 * Calcule les frais Oraforme dans la devise locale du client.
 */
export function fraisOrаformeClient(deviseCible: string, montantXAF = FRAIS_ORAFORME_PAR_CLIENT): { montant: number; devise: string } {
  return { montant: convertirXAFvers(montantXAF, deviseCible), devise: deviseCible }
}

/**
 * Génère les entrées revenue pour le mois en cours.
 * Appelle POST /api/cabinet/revenue
 */
export async function genererFacturationMensuelle(
  mois?: number, annee?: number,
): Promise<{ nb_insere: number; mois: number; annee: number }> {
  const res = await fetch('/api/cabinet/revenue', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mois, annee }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { error?: string }).error ?? `Erreur ${res.status}`)
  }
  return res.json()
}

/** Revenue annuel projeté */
export function revenueProjetteAnnuel(nbClientsActifs: number): number {
  return nbClientsActifs * FRAIS_ORAFORME_PAR_CLIENT * 12
}

/** Formatte un montant FCFA avec séparateurs */
export function fmtFCFA(montant: number): string {
  return new Intl.NumberFormat('fr-FR').format(Math.round(montant)) + ' FCFA'
}

/** Formatte un montant dans n'importe quelle devise */
export function fmtDevise(montant: number, devise: string): string {
  const symbols: Record<string, string> = {
    XAF: 'FCFA', XOF: 'FCFA', EUR: '€', USD: '$', GBP: '£',
    AOA: 'Kz', NGN: '₦', GHS: 'GH₵', MAD: 'DH',
  }
  const symbol = symbols[devise] ?? devise
  const formatted = new Intl.NumberFormat('fr-FR').format(Math.round(montant * 100) / 100)
  return ['EUR','USD','GBP'].includes(devise)
    ? `${symbol}${formatted}`
    : `${formatted} ${symbol}`
}

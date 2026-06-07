export const FRAIS_ORAFORME_PAR_CLIENT = 5_000 // FCFA

export interface RevenueOraforme {
  cabinet_tenant_id: string
  client_id: string
  mois: number
  annee: number
  montant: number
  statut: 'en_attente' | 'facture' | 'paye'
}

/**
 * Génère les entrées revenue pour tous les clients actifs du cabinet.
 * Appelle l'API cabinet/revenue (POST) — utiliser côté serveur/client selon context.
 */
export async function genererFacturationMensuelle(
  mois?: number,
  annee?: number,
): Promise<{ nb_insere: number; mois: number; annee: number }> {
  const res = await fetch('/api/cabinet/revenue', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mois, annee }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error ?? `Erreur ${res.status}`)
  }
  return res.json()
}

/** Calcule le revenue annuel projeté à partir du nombre de clients actifs */
export function revenueProjetteAnnuel(nbClientsActifs: number): number {
  return nbClientsActifs * FRAIS_ORAFORME_PAR_CLIENT * 12
}

/** Formatte en FCFA */
export function fmtFCFA(montant: number): string {
  return new Intl.NumberFormat('fr-FR').format(Math.round(montant)) + ' FCFA'
}

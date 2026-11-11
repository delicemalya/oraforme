// Suspension des élèves actifs sans paiement (Direction → « Bloquer auto impayés »).
// Logique pure, sans client Supabase : la page fournit la lecture des paiements,
// la confirmation et l'écriture. Garde-fous (LOT 0A) :
//  - une erreur de lecture des paiements n'est jamais interprétée comme « personne n'a payé » ;
//  - aucune écriture sans confirmation explicite indiquant le nombre et le critère ;
//  - un code de déblocage existant n'est jamais remplacé ;
//  - arrêt à la première écriture en échec.
// Le critère d'éligibilité est inchangé : élève actif sans paiement trouvé pour l'année.

export interface SuspensionCandidate {
  id: string
  statut: string
  code_deblocage?: string | null
}

export type PaidLookupResult = { data: { etudiant_id: string }[] | null; error: unknown }

/** Élèves actifs sans paiement, ou null si la lecture des paiements a échoué. */
export function computeUnpaidActifs(
  etudiants: SuspensionCandidate[],
  paid: PaidLookupResult,
): SuspensionCandidate[] | null {
  if (paid.error || !paid.data) return null
  const paidIds = new Set(paid.data.map(p => p.etudiant_id))
  return etudiants.filter(e => e.statut === 'actif' && !paidIds.has(e.id))
}

export function buildSuspensionConfirmMessage(count: number, totalActifs: number, annee: string) {
  const lines = [
    `Suspendre ${count} élève(s) actif(s) sur ${totalActifs} ?`,
    '',
    `Critère appliqué : aucun paiement enregistré pour l'année ${annee}.`,
    'Les codes de déblocage existants seront conservés.',
  ]
  if (count === totalActifs) {
    lines.push('', 'Attention : TOUS les élèves actifs sont concernés. Vérifiez les paiements avant de confirmer.')
  }
  return lines.join('\n')
}

export type MassSuspensionResult =
  | { status: 'lookup_error' }
  | { status: 'nothing_to_do' }
  | { status: 'cancelled'; candidates: number }
  | { status: 'done'; suspended: number; failed: boolean; candidates: number }

export async function runMassSuspension(opts: {
  etudiants: SuspensionCandidate[]
  annee: string
  fetchPaid: (actifIds: string[]) => Promise<PaidLookupResult>
  confirm: (message: string) => boolean
  suspend: (id: string, code: string) => Promise<{ error: unknown }>
  generateCode: () => string
}): Promise<MassSuspensionResult> {
  const actifs = opts.etudiants.filter(e => e.statut === 'actif')
  if (actifs.length === 0) return { status: 'nothing_to_do' }

  const unpaid = computeUnpaidActifs(actifs, await opts.fetchPaid(actifs.map(e => e.id)))
  if (unpaid === null) return { status: 'lookup_error' }
  if (unpaid.length === 0) return { status: 'nothing_to_do' }

  if (!opts.confirm(buildSuspensionConfirmMessage(unpaid.length, actifs.length, opts.annee))) {
    return { status: 'cancelled', candidates: unpaid.length }
  }

  let suspended = 0
  for (const e of unpaid) {
    const { error } = await opts.suspend(e.id, e.code_deblocage || opts.generateCode())
    if (error) return { status: 'done', suspended, failed: true, candidates: unpaid.length }
    suspended++
  }
  return { status: 'done', suspended, failed: false, candidates: unpaid.length }
}

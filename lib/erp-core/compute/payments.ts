/**
 * lib/erp-core/compute/payments.ts
 *
 * UNIQUE source de vérité pour l'agrégation des paiements.
 * Remplace la logique inline dans :
 *   - app/api/hotel/payments/route.ts      (4× reduce par mode)
 *   - app/api/resto/direction/route.ts     (byPaiement object)
 *   - app/api/ecole/paiements/route.ts     (mode paiement)
 *   - app/api/sante/facturation/route.ts   (sum_paye, sum_impaye)
 *
 * Modes de paiement standard Oraforme CEMAC :
 *   especes | mobile_money | carte | virement | cheque | autre
 */

import { MONTH_LABELS_FR } from '@/lib/erp-core/filters/context'

// ── Types entrée ──────────────────────────────────────────────────────────────

export type ModePaiement =
  | 'especes'
  | 'mobile_money'
  | 'carte'
  | 'virement'
  | 'cheque'
  | 'autre'
  | string   // extensible

export interface PaymentRow {
  montant:         number | null
  mode_paiement?:  string | null
  date?:           string | null
  statut?:         string | null
}

export interface FactureStatutRow {
  total:    number | null
  statut:   string | null
  date?:    string | null
  due_date?: string | null
}

// ── Types sortie ─────────────────────────────────────────────────────────────

export interface PaymentByMode {
  especes:      number
  mobile_money: number
  carte:        number
  virement:     number
  cheque:       number
  autre:        number
  total:        number
  breakdown:    { mode: string; montant: number; pct: number }[]
}

export interface CollectionStatus {
  total_facture:  number   // toutes factures
  total_encaisse: number   // factures payées
  total_impaye:   number   // factures ouvertes (hors annulées)
  total_retard:   number   // factures en retard de paiement (due_date dépassée)
  nb_ouvertes:    number
  nb_payees:      number
  nb_retard:      number
  tx_paiement:    number   // % payées / total
}

export interface PaymentMonthPoint {
  month:          string
  mois:           number
  encaisse:       number
  nb_paiements:   number
}

// ── Sélecteurs Supabase ───────────────────────────────────────────────────────

export const PAYMENT_SELECT = 'montant, mode_paiement, date' as const
export const FACTURE_STATUS_SELECT = 'total, statut, date, due_date' as const

// ── aggregatePaymentsByMode ───────────────────────────────────────────────────

/**
 * Agrège les paiements par mode.
 * @param payments - Lignes de paiements (peut être n'importe quelle table avec montant + mode_paiement)
 */
export function aggregatePaymentsByMode(payments: PaymentRow[]): PaymentByMode {
  const modes: Record<string, number> = {
    especes:      0,
    mobile_money: 0,
    carte:        0,
    virement:     0,
    cheque:       0,
    autre:        0,
  }

  for (const p of payments) {
    const m   = p.montant ?? 0
    const mode = p.mode_paiement?.toLowerCase() ?? 'autre'

    if (mode in modes) {
      modes[mode] += m
    } else {
      modes.autre += m
    }
  }

  const total = Object.values(modes).reduce((s, v) => s + v, 0)

  const breakdown = Object.entries(modes)
    .filter(([, v]) => v > 0)
    .sort(([, a], [, b]) => b - a)
    .map(([mode, montant]) => ({
      mode,
      montant,
      pct: total > 0 ? Math.round((montant / total) * 100) : 0,
    }))

  return {
    especes:      modes.especes,
    mobile_money: modes.mobile_money,
    carte:        modes.carte,
    virement:     modes.virement,
    cheque:       modes.cheque,
    autre:        modes.autre,
    total,
    breakdown,
  }
}

// ── computeCollectionStatus ───────────────────────────────────────────────────

/**
 * Calcule le statut de recouvrement : payé/impayé/retard depuis les factures.
 * Utilise la colonne `total` (TTC) de la table `factures`.
 *
 * @param factures - Factures du tenant (filtrées par année en DB)
 * @param today    - Date du jour ISO (YYYY-MM-DD) — pour calculer les retards
 */
export function computeCollectionStatus(
  factures: FactureStatutRow[],
  today     = new Date().toISOString().split('T')[0],
): CollectionStatus {
  const payees  = factures.filter(f => f.statut === 'payee')
  const ouvertes = factures.filter(f => !['payee', 'annulee'].includes(f.statut ?? ''))
  const retard  = ouvertes.filter(f => {
    if (!f.due_date) return false
    return f.due_date < today
  })

  const total_facture  = factures.filter(f => f.statut !== 'annulee').reduce((s, f) => s + (f.total ?? 0), 0)
  const total_encaisse = payees.reduce((s, f) => s + (f.total ?? 0), 0)
  const total_impaye   = ouvertes.reduce((s, f) => s + (f.total ?? 0), 0)
  const total_retard   = retard.reduce((s, f) => s + (f.total ?? 0), 0)
  const nb_total       = factures.filter(f => f.statut !== 'annulee').length

  return {
    total_facture,
    total_encaisse,
    total_impaye,
    total_retard,
    nb_ouvertes:  ouvertes.length,
    nb_payees:    payees.length,
    nb_retard:    retard.length,
    tx_paiement:  nb_total > 0 ? Math.round((payees.length / nb_total) * 100) : 0,
  }
}

// ── computePaymentsTrend ──────────────────────────────────────────────────────

/**
 * Tendance mensuelle des encaissements depuis les factures payées.
 * Utilise la date de la facture (date de création) comme proxy de l'encaissement.
 */
export function computePaymentsTrend(
  factures: FactureStatutRow[],
  year:     number,
): PaymentMonthPoint[] {
  return Array.from({ length: 12 }, (_, i) => {
    const moisNum = i + 1
    const mo = `${year}-${String(moisNum).padStart(2, '0')}`
    const payeesMois = factures.filter(
      f => f.statut === 'payee' && f.date?.startsWith(mo),
    )
    return {
      month:          MONTH_LABELS_FR[i],
      mois:           moisNum,
      encaisse:       payeesMois.reduce((s, f) => s + (f.total ?? 0), 0),
      nb_paiements:   payeesMois.length,
    }
  })
}

// ── sumAmount ─────────────────────────────────────────────────────────────────

/** Helper universel : additionne `montant` sur n'importe quelle liste avec champ montant */
export function sumAmount(rows: { montant: number | null }[]): number {
  return rows.reduce((s, r) => s + (r.montant ?? 0), 0)
}

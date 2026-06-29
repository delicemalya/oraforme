/**
 * lib/erp-core/compute/ca.ts
 *
 * UNIQUE source de vérité pour le Chiffre d'Affaires et les flux financiers.
 * Remplace les 5 versions disparates identifiées dans l'audit ERP Core.
 *
 * DISTINCTION SÉMANTIQUE IMPORTANTE (SYSCOHADA) :
 *   ca_encaisse  = transactions.type='entree'  → flux de TRÉSORERIE réels
 *   ca_facture   = factures.statut='payee'     → CA FACTURÉ encaissé
 *   creances     = factures non payées/annulées → créances clients
 *
 * Le "vrai" CA SYSCOHADA (classe 70) vient des journal_entries.
 * Les deux approches sont exposées ici — le consommateur choisit sa sémantique.
 *
 * COLONNES réelles :
 *   transactions : date, type ('entree'|'sortie'), montant
 *   factures     : date, statut, montant_ttc
 */

import { MONTH_LABELS_FR } from '@/lib/erp-core/filters/context'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface TransactionRow {
  type:    string
  montant: number | null
  date:    string | null
}

export interface FactureRow {
  total:   number | null   // colonne réelle sur factures (= TTC)
  statut:  string | null
  date:    string | null
}

export interface CAMonthPoint {
  month:       string
  entrees:     number
  sorties:     number
  net:         number
  facturation: number   // factures payées ce mois
}

export interface CASummary {
  year:          number
  ca_encaisse:   number   // transactions entrees (trésorerie)
  dep_encaisse:  number   // transactions sorties (dépenses)
  solde_treso:   number   // ca_encaisse - dep_encaisse
  ca_facture:    number   // factures payées (CA encaissé)
  creances:      number   // factures ouvertes (pas payées ni annulées)
  mensuel:       CAMonthPoint[]
}

// ── Sélecteurs Supabase ───────────────────────────────────────────────────────

export const TRANSACTION_SELECT = 'type, montant, date' as const
export const FACTURE_SELECT     = 'total, statut, date' as const

// ── Fonction principale ───────────────────────────────────────────────────────

/**
 * Calcule le résumé CA/flux depuis les transactions et factures d'un exercice.
 * Les tableaux en entrée doivent déjà être filtrés par tenant + année en DB.
 */
export function computeCA(
  transactions: TransactionRow[],
  factures:     FactureRow[],
  year:         number,
): CASummary {
  const ys = `${year}-01-01`
  const ye = `${year}-12-31`

  // Re-filtre défensif (les requêtes DB devraient déjà filtrer)
  const tx  = transactions.filter(t => t.date && t.date >= ys && t.date <= ye)
  const fac = factures.filter(f => f.date && f.date >= ys && f.date <= ye)

  const ca_encaisse  = sumWhere(tx,  t => t.type === 'entree',                          'montant')
  const dep_encaisse = sumWhere(tx,  t => t.type === 'sortie',                          'montant')
  const ca_facture   = sumWhere(fac, f => f.statut === 'payee',                         'total')
  const creances     = sumWhere(fac, f => !['payee','annulee'].includes(f.statut ?? ''), 'total')

  const mensuel: CAMonthPoint[] = Array.from({ length: 12 }, (_, i) => {
    const mo = `${year}-${String(i + 1).padStart(2, '0')}`
    const entrees     = sumWhere(tx,  t => t.type === 'entree' && !!t.date?.startsWith(mo), 'montant')
    const sorties     = sumWhere(tx,  t => t.type === 'sortie' && !!t.date?.startsWith(mo), 'montant')
    const facturation = sumWhere(fac, f => f.statut === 'payee' && !!f.date?.startsWith(mo), 'total')
    return { month: MONTH_LABELS_FR[i], entrees, sorties, net: entrees - sorties, facturation }
  })

  return {
    year, ca_encaisse, dep_encaisse,
    solde_treso: ca_encaisse - dep_encaisse,
    ca_facture, creances, mensuel,
  }
}

// ── Helper privé ──────────────────────────────────────────────────────────────

function sumWhere<T>(
  rows:      T[],
  predicate: (r: T) => boolean,
  key:       keyof T,
): number {
  return rows.filter(predicate).reduce((s, r) => s + (Number(r[key]) || 0), 0)
}

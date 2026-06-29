/**
 * lib/erp-core/compute/clients.ts
 *
 * UNIQUE source de vérité pour les créances clients et dettes fournisseurs.
 * Remplace les 3 versions disparates identifiées dans l'audit ERP Core.
 *
 * COLONNES réelles :
 *   factures : id, total, statut, date
 *   achats   : id, montant, statut ('impaye'|'partiel'|'paye'), date
 */

import { MONTH_LABELS_FR } from '@/lib/erp-core/filters/context'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface FactureRow {
  id?:     string
  total:   number | null   // colonne réelle sur factures (= TTC)
  statut:  string | null
  date:    string | null
}

export interface AchatRow {
  id?:     string
  montant: number | null       // PAS montant_total — colonne réelle est 'montant'
  statut:  string | null       // 'impaye' | 'partiel' | 'paye'
  date?:   string | null
}

export interface ClientsSummary {
  creances_total:    number   // toutes factures ouvertes (pas payées/annulées)
  nb_ouvertes:       number
  nb_retard:         number   // statut 'envoyee' > 30 jours (estimation)
  tx_paiement_pct:   number   // % factures payées / total
  ca_encaisse:       number   // factures payées
  mensuel:           CreanceMoisPoint[]
}

export interface FournisseursSummary {
  dettes_total:      number   // achats non soldés (impaye + partiel)
  nb_impayes:        number
  nb_partiels:       number
  tx_reglement_pct:  number   // % achats soldés / total
}

export interface CreanceMoisPoint {
  month:    string
  encaisse: number   // factures payées ce mois
  ouvert:   number   // factures émises ce mois non payées
}

// ── Sélecteurs Supabase ───────────────────────────────────────────────────────

export const FACTURE_CLIENTS_SELECT = 'id, total, statut, date' as const  // 'total' = TTC sur table factures
export const ACHAT_FOURNI_SELECT    = 'id, montant, statut' as const

// ── Fonctions principales ─────────────────────────────────────────────────────

export function computeClientsSummary(factures: FactureRow[], year: number): ClientsSummary {
  const ys = `${year}-01-01`
  const ye = `${year}-12-31`
  const fac = factures.filter(f => f.date && f.date >= ys && f.date <= ye)

  const ouvertes  = fac.filter(f => !['payee','annulee'].includes(f.statut ?? ''))
  const payees    = fac.filter(f => f.statut === 'payee')
  const retard    = fac.filter(f => f.statut === 'envoyee')

  const creances_total  = ouvertes.reduce((s, f) => s + (f.total ?? 0), 0)
  const ca_encaisse     = payees.reduce((s, f) => s + (f.total ?? 0), 0)
  const tx_paiement_pct = fac.length > 0 ? Math.round((payees.length / fac.length) * 100) : 0

  const mensuel: CreanceMoisPoint[] = Array.from({ length: 12 }, (_, i) => {
    const mo = `${year}-${String(i + 1).padStart(2, '0')}`
    return {
      month:    MONTH_LABELS_FR[i],
      encaisse: payees.filter(f => f.date?.startsWith(mo)).reduce((s, f) => s + (f.total ?? 0), 0),
      ouvert:   ouvertes.filter(f => f.date?.startsWith(mo)).reduce((s, f) => s + (f.total ?? 0), 0),
    }
  })

  return {
    creances_total, nb_ouvertes: ouvertes.length,
    nb_retard: retard.length, tx_paiement_pct, ca_encaisse, mensuel,
  }
}

export function computeFournisseursSummary(achats: AchatRow[]): FournisseursSummary {
  const impayes  = achats.filter(a => a.statut === 'impaye')
  const partiels = achats.filter(a => a.statut === 'partiel')
  const payes    = achats.filter(a => a.statut === 'paye')

  const dettes_total    = [...impayes, ...partiels].reduce((s, a) => s + (a.montant ?? 0), 0)
  const tx_reglement_pct = achats.length > 0 ? Math.round((payes.length / achats.length) * 100) : 0

  return {
    dettes_total, nb_impayes: impayes.length,
    nb_partiels: partiels.length, tx_reglement_pct,
  }
}

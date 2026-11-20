/**
 * lib/garage/ordres.ts — règles métier du secteur Garage (sans accès DB).
 *
 * Cycle d'un ordre de réparation (OR) :
 *   ouvert → en_cours → termine → facture → livre
 *   ouvert | en_cours → annule
 * Le passage termine → facture se fait UNIQUEMENT par la facturation
 * atomique (POST /api/garage/ordres/[id]/facturer → fn_garage_facturer_ordre),
 * jamais par un simple changement de statut.
 */

import { calculerTVASurMontantUnifie, decomposerTTCUnifie } from '@/lib/fiscalite/engine-adapter'
import { PAYS_PAR_DEFAUT } from '@/lib/fiscalite/pays-tenant'
import type { PaysFiscal } from '@/lib/fiscalite/types'

export const STATUTS_ORDRE = ['ouvert', 'en_cours', 'termine', 'facture', 'livre', 'annule'] as const
export type StatutOrdre = typeof STATUTS_ORDRE[number]

export const TYPES_LIGNE = ['piece', 'main_oeuvre'] as const
export type TypeLigne = typeof TYPES_LIGNE[number]

export const CARBURANTS = ['essence', 'diesel', 'hybride', 'electrique', 'gpl', 'autre'] as const

export const LIBELLES_STATUT: Record<StatutOrdre, string> = {
  ouvert:   'Ouvert',
  en_cours: 'En cours',
  termine:  'Terminé',
  facture:  'Facturé',
  livre:    'Livré',
  annule:   'Annulé',
}

/** Transitions autorisées par simple changement de statut (PATCH). */
const TRANSITIONS_MANUELLES: Record<StatutOrdre, readonly StatutOrdre[]> = {
  ouvert:   ['en_cours', 'annule'],
  en_cours: ['termine', 'ouvert', 'annule'],
  termine:  ['en_cours'],          // réouverture avant facturation
  facture:  ['livre'],
  livre:    [],
  annule:   [],
}

export function isStatutOrdre(v: unknown): v is StatutOrdre {
  return typeof v === 'string' && (STATUTS_ORDRE as readonly string[]).includes(v)
}

export function peutPasserA(de: StatutOrdre, vers: StatutOrdre): boolean {
  return TRANSITIONS_MANUELLES[de].includes(vers)
}

/** Les lignes ne sont modifiables qu'avant la fin des travaux. */
export function lignesModifiables(statut: StatutOrdre): boolean {
  return statut === 'ouvert' || statut === 'en_cours'
}

export type LigneMontant = { quantite: number; prix_unitaire: number }

const arrondi2 = (n: number) => Math.round(n * 100) / 100

/** Totaux d'un OR — HT des lignes, TVA + centime additionnel via le moteur central. */
export function totauxOrdre(lignes: LigneMontant[], pays: PaysFiscal = PAYS_PAR_DEFAUT) {
  const ht = arrondi2(lignes.reduce((s, l) => s + arrondi2(Number(l.quantite) * Number(l.prix_unitaire)), 0))
  const { tva, ca, ttc } = calculerTVASurMontantUnifie(ht, pays)
  return { ht, tva, ca, ttc }
}

/**
 * products.prix_vente est un prix TTC (cf. /api/sales qui le décompose).
 * Une ligne d'OR est saisie en HT : on en déduit le prix unitaire HT.
 */
export function prixUnitaireHTDepuisTTC(prixVenteTTC: number, pays: PaysFiscal = PAYS_PAR_DEFAUT): number {
  return decomposerTTCUnifie(Number(prixVenteTTC) || 0, pays).ht
}

/** Normalise une immatriculation pour l'unicité : majuscules, sans espaces superflus. */
export function normaliserImmatriculation(v: string): string {
  return v.trim().toUpperCase().replace(/\s+/g, ' ')
}

/**
 * lib/fiscalite/sante-exonerations.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Mission P0-FISCAL-CG-2026 — SAN-001, exonérations TVA confirmées (2026-09-18).
 *
 * Source primaire vérifiée : Loi n°12-97 du 12 mai 1997 portant institution de
 * la TVA (Congo-Brazzaville), Article 7, point 6° :
 *   « Sont exonérés de TVA... les examens, consultations, soins,
 *     hospitalisation, travaux d'analyse et de biologie médicale et les
 *     fournitures de prothèses. »
 *
 * Ce fichier ne couvre QUE les 3 catégories de `his_lignes_facture.categorie`
 * dont la correspondance avec ce texte est directe et non ambiguë :
 *   - 'consultation'    → « consultations »
 *   - 'hospitalisation' → « hospitalisation »
 *   - 'labo'            → « travaux d'analyse et de biologie médicale »
 *
 * VOLONTAIREMENT EXCLUES, PAS OUBLIÉES — mission de vérification documentaire
 * du 2026-09-18, section « points NOT DETERMINED » :
 *   - 'pharmacie' : l'exonération médicaments relève de l'Art. 7 point 7°
 *     (liste fermée « Annexe 3 »), pas du point 6° — dépend du produit vendu,
 *     pas de la catégorie facturée en bloc. Rien ne permet aujourd'hui de
 *     savoir si un médicament donné figure à l'Annexe 3.
 *   - 'imagerie', 'bloc' : correspondance possible mais non nommée
 *     explicitement dans le texte (« examens », « soins » au sens large) —
 *     interprétation, pas confirmation textuelle directe.
 *   - 'autre' : catégorie ouverte, aucune correspondance possible a priori.
 *
 * Ne pas ajouter de catégorie à cette liste sans la même rigueur de preuve
 * (texte, article, date) que celle qui a validé les 3 ci-dessus.
 */

export const SANTE_CATEGORIES_EXONEREES_TVA = ['consultation', 'hospitalisation', 'labo'] as const

export type SanteCategorieExoneree = (typeof SANTE_CATEGORIES_EXONEREES_TVA)[number]

export function estCategorieSanteExonereeTVA(categorie: string): boolean {
  return (SANTE_CATEGORIES_EXONEREES_TVA as readonly string[]).includes(categorie)
}

/**
 * Branding Oraforme — en-tête et pied de page pour tous les PDF officiels
 */

export const BRAND = {
  nom:        'ORAFORME ERP',
  slogan:     'Votre Partenaire de Gestion Entreprise',
  site:       'www.oraforme.com',
  email:      'contact@oraforme.com',
  couleur:    '#F59E0B',    // primary
  couleur2:   '#0F172A',    // dark
  version:    '2024',
}

export const CNSS_CONGO = {
  organisme:  'CAISSE NATIONALE DE SÉCURITÉ SOCIALE',
  sigle:      'CNSS',
  pays:       'RÉPUBLIQUE DU CONGO',
  adresse:    'Brazzaville — Congo',
  note_legale: 'Document généré conformément aux textes réglementaires CNSS Congo en vigueur.',
}

export function periodeLabel(mois: number, annee: number): string {
  const moisFr = [
    'Janvier','Février','Mars','Avril','Mai','Juin',
    'Juillet','Août','Septembre','Octobre','Novembre','Décembre',
  ]
  return `${moisFr[mois - 1]} ${annee}`
}

export function dateAujourdhuiFr(): string {
  return new Date().toLocaleDateString('fr-FR', {
    day: '2-digit', month: 'long', year: 'numeric',
  })
}

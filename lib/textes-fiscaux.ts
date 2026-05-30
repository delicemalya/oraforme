// Textes légaux et références fiscales par pays — cités dans les déclarations et rapports

export interface TexteLegal {
  code: string
  titre: string
  reference: string
  description: string
  pays: string[]
}

export const TEXTES_FISCAUX: TexteLegal[] = [
  // ── TVA ──
  {
    code: 'TVA_CG',
    titre: 'Code Général des Impôts — TVA Congo',
    reference: 'Art. 277 à 344 CGI Congo',
    description: 'TVA 18% collectée sur les livraisons de biens et prestations de services. Centime Additionnel 5% sur TVA collectée.',
    pays: ['CG'],
  },
  {
    code: 'TVA_CM',
    titre: 'Code Général des Impôts — TVA Cameroun',
    reference: 'Art. 125 à 165 CGI Cameroun',
    description: 'TVA 17.5% + CAC 10% sur TVA = taux effectif 19.25%. Déclaration avant le 15 du mois suivant.',
    pays: ['CM'],
  },
  {
    code: 'TVA_CD',
    titre: 'Loi n°004/2003 — TVA RDC',
    reference: 'Loi du 13 mars 2003',
    description: 'TVA 16% — seuil d\'assujettissement : 80 000 000 CDF/an. Déclaration avant le 15 du mois suivant.',
    pays: ['CD'],
  },
  {
    code: 'TVA_FR',
    titre: 'Code Général des Impôts — TVA France',
    reference: 'Art. 256 à 292 CGI France',
    description: 'TVA 20% (taux normal), 10% (réduit), 5.5% (super-réduit). Déclaration CA3 mensuelle.',
    pays: ['FR'],
  },

  // ── CNSS / Charges sociales ──
  {
    code: 'CNSS_CG',
    titre: 'Loi n°004/86 — Code de Sécurité Sociale Congo',
    reference: 'Loi du 25 février 1986 + décret 2002-434',
    description: 'CNSS salarié 5.04%, patronal 14.16%. Plafond : 3 375 000 FCFA/mois. Déclaration avant le 15 du mois suivant.',
    pays: ['CG'],
  },
  {
    code: 'CNSS_CM',
    titre: 'Décret n°75/679 — CNPS Cameroun',
    reference: 'Décret du 6 juillet 1975 + ordonnance 81/02',
    description: 'CNPS salarié 4.2%, patronal 17.2%. Plafond : 750 000 FCFA/mois. Branche retraite + AT + famille.',
    pays: ['CM'],
  },
  {
    code: 'INSS_CD',
    titre: 'Décret-Loi n°09/2003 — INSS RDC',
    reference: 'Décret du 5 décembre 2003',
    description: 'INSS salarié 3.5%, patronal 13%. Sans plafond. Déclaration avant le 10 du mois suivant.',
    pays: ['CD'],
  },
  {
    code: 'URSSAF_FR',
    titre: 'Code de la Sécurité Sociale — France',
    reference: 'Articles L. 242-1 et suivants CSS',
    description: 'Cotisations salariales ~22.8%, patronales ~45%. DSN mensuelle obligatoire. Plafond SS : 3 666€/mois (2024).',
    pays: ['FR'],
  },

  // ── IRPP / Impôt sur salaires ──
  {
    code: 'IRPP_CG',
    titre: 'Code Général des Impôts — IRPP Congo',
    reference: 'Art. 64 à 116 CGI Congo',
    description: 'IRPP progressif : 0% (≤464 000), 10%, 25%, 40%. Abattement 10%. Retenue à la source par l\'employeur.',
    pays: ['CG'],
  },
  {
    code: 'IPR_CD',
    titre: 'Loi de Finances — IPR RDC',
    reference: 'Art. 14 à 46 Ordonnance 69/009',
    description: 'IPR progressif : 0%, 15%, 20%, 25%, 30%. Exonération tranche 0-524 160 CDF.',
    pays: ['CD'],
  },
  {
    code: 'IRPP_CM',
    titre: 'Code Général des Impôts — IRPP Cameroun',
    reference: 'Art. 25 à 85 CGI Cameroun',
    description: 'IRPP progressif avec abattement 30%. Tranches 10% à 38.5%. + CAC 10% sur IRPP.',
    pays: ['CM'],
  },

  // ── Patente & taxes locales ──
  {
    code: 'PATENTE_CG',
    titre: 'Code Général des Impôts — Patente Congo',
    reference: 'Art. 345 à 380 CGI Congo',
    description: 'Droit de patente annuel calculé sur le chiffre d\'affaires. Dépôt avant le 31 janvier de chaque année.',
    pays: ['CG'],
  },
  {
    code: 'PATENTE_CM',
    titre: 'Code Général des Impôts — Droit de Patente Cameroun',
    reference: 'Art. 406 à 440 CGI Cameroun',
    description: 'Droit de patente annuel selon le CA et la nature de l\'activité. Dépôt avant fin janvier.',
    pays: ['CM'],
  },

  // ── OHADA ──
  {
    code: 'OHADA_SYSCOHADA',
    titre: 'Acte Uniforme OHADA — SYSCOHADA Révisé',
    reference: 'AU du 26 janvier 2017 (entrée en vigueur 1er janvier 2018)',
    description: 'Système Comptable OHADA révisé. 9 classes de comptes. Obligation pour toutes les entreprises des États parties OHADA.',
    pays: ['CG', 'CM', 'GA', 'CD', 'CF', 'TD', 'SN', 'CI', 'ML', 'BF', 'TG', 'BJ', 'NE', 'GN'],
  },
  {
    code: 'OHADA_ACTE_SOCIETES',
    titre: 'Acte Uniforme OHADA — Droit des Sociétés',
    reference: 'AU sur les Sociétés Commerciales — révisé 2014',
    description: 'Forme des sociétés (SARL, SA, SNC...), capital minimum, gouvernance. Applicable dans les 17 États parties.',
    pays: ['CG', 'CM', 'GA', 'CD', 'CF', 'TD', 'SN', 'CI', 'ML', 'BF', 'TG', 'BJ', 'NE', 'GN'],
  },
]

export function getTextesByPays(codePays: string): TexteLegal[] {
  return TEXTES_FISCAUX.filter(t => t.pays.includes(codePays))
}

export function getTexteByCode(code: string): TexteLegal | undefined {
  return TEXTES_FISCAUX.find(t => t.code === code)
}

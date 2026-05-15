export const SUPER_ADMIN_EMAILS = ['adjidongui@gmail.com', 'adjigordon@gmail.com']
export const SUPER_ADMIN_EMAIL = SUPER_ADMIN_EMAILS[0]

export const MODULE_PRICES: Record<string, number> = {
  facturation:  5000,
  tresorerie:   7000,
  comptabilite: 10000,
  mobilemoney:  5000,
  stock:        4000,
  rh:           8000,
  ecole:        15000,
  restaurant:   10000,
  achats:       6000,
  depenses:     4000,
  rapports:     8000,
  hotel:        12000,
  transport:    7000,
  bizbot:       6000,
}

export const MODULE_LABELS: Record<string, string> = {
  facturation:  'FacturePro',
  tresorerie:   'Trésorerie',
  comptabilite: 'Comptabilité',
  mobilemoney:  'Mobile Money',
  stock:        'Stock & Inventaire',
  rh:           'RH Premium',
  ecole:        'École & Université',
  restaurant:   'Resto POS',
  achats:       'Achats & Fournisseurs',
  depenses:     'Dépenses & Charges',
  rapports:     'Rapports Intelligents',
  hotel:        'Hôtel & Hébergement',
  transport:    'Transport VTC',
  bizbot:       'MIAA+ Assistant',
}

export const MODULE_ICONS: Record<string, string> = {
  facturation:  '💰',
  tresorerie:   '💵',
  comptabilite: '📒',
  mobilemoney:  '📱',
  stock:        '📦',
  rh:           '👥',
  ecole:        '🎓',
  restaurant:   '🍽️',
  achats:       '🛒',
  depenses:     '📅',
  rapports:     '📈',
  hotel:        '🏨',
  transport:    '🚖',
  bizbot:       '🤖',
}

export const MODULE_DESCS: Record<string, string> = {
  facturation:  'Créez et gérez vos devis et factures OHADA professionnelles',
  tresorerie:   'Cash flow temps réel, entrées/sorties, solde prévisionnel',
  comptabilite: 'Journal simplifié, recettes vs dépenses, rapport TVA Congo',
  mobilemoney:  'Intégration Airtel Money et MTN MoMo pour vos paiements',
  stock:        'Suivi des articles, alertes de rupture et inventaire',
  rh:           'Paie CNSS/IRPP Congo, congés, recrutement assisté IA',
  ecole:        'Élèves, notes, absences, bulletins et frais scolaires',
  restaurant:   'Caisse enregistreuse, commandes, gestion cuisine',
  achats:       'Fournisseurs, bons de commande et suivi dettes fournisseurs',
  depenses:     'Toutes vos charges par catégorie avec justificatifs photo',
  rapports:     'Analyse financière automatique et prévisionnelle par MIAA+',
  hotel:        'Réservations, chambres, housekeeping et gestion hôtelière',
  transport:    'Flotte VTC, chauffeurs, courses et facturation kilomètre',
  bizbot:       'Assistant IA conversationnel avec contexte fiscal Congo',
}

export function fmtFCFA(n: number) {
  return new Intl.NumberFormat('fr-FR').format(Math.round(n)) + ' FCFA'
}

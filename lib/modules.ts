// Canonical source for sector → module mapping.
// dbModules: keys inserted into tenant_modules (must match Sidebar's module IDs).
// uiModules: display labels shown in onboarding UI (richer, sector-specific).

export type SectorConfig = {
  label:      string
  emoji:      string
  description: string
  dbModules:  string[]
  uiModules:  { label: string; emoji: string }[]
}

export const SECTOR_CONFIG: Record<string, SectorConfig> = {
  ecole: {
    label:       'École & Université',
    emoji:       '🎓',
    description: 'ERP complet pour établissements scolaires et universités',
    dbModules:   ['ecole', 'rh', 'tresorerie', 'facturation', 'comptabilite', 'stock', 'bizbot'],
    uiModules: [
      { label: 'Direction & Pilotage',    emoji: '🏫' },
      { label: 'Scolarité',               emoji: '📚' },
      { label: 'RH & Paie',              emoji: '👔' },
      { label: 'Comptabilité OHADA',      emoji: '📊' },
      { label: 'Stock & Fournitures',     emoji: '📦' },
      { label: 'Examens & Bulletins',     emoji: '📝' },
      { label: 'Présences',               emoji: '✅' },
      { label: 'Diplômes & Soutenances',  emoji: '🎓' },
      { label: 'MIAA+ Assistant',         emoji: '✨' },
    ],
  },
  restaurant: {
    label:       'Restaurant & Hôtellerie',
    emoji:       '🍽️',
    description: 'POS, gestion des tables, stocks et livraisons',
    dbModules:   ['restaurant', 'stock', 'facturation', 'rh', 'tresorerie', 'comptabilite', 'achats', 'bizbot'],
    uiModules: [
      { label: 'Caisse POS',         emoji: '🖥️' },
      { label: 'Cuisine',            emoji: '👨‍🍳' },
      { label: 'Tables',             emoji: '🪑' },
      { label: 'Stock',              emoji: '📦' },
      { label: 'Achats & Fourn.',    emoji: '🛒' },
      { label: 'Livraison',          emoji: '🛵' },
      { label: 'RH & Paie',         emoji: '👔' },
      { label: 'Trésorerie',         emoji: '💰' },
      { label: 'Comptabilité',       emoji: '📊' },
      { label: 'MIAA+',              emoji: '✨' },
    ],
  },
  commerce: {
    label:       'Commerce & Distribution',
    emoji:       '🏪',
    description: 'Facturation, stock, clients et fournisseurs',
    dbModules:   ['facturation', 'stock', 'rh', 'tresorerie', 'achats', 'comptabilite'],
    uiModules: [
      { label: 'Facturation',        emoji: '🧾' },
      { label: 'Stock',              emoji: '📦' },
      { label: 'Clients',            emoji: '👥' },
      { label: 'Achats & Fourn.',    emoji: '🤝' },
      { label: 'Trésorerie',         emoji: '💰' },
      { label: 'Comptabilité',       emoji: '📊' },
      { label: 'RH & Paie',         emoji: '👔' },
    ],
  },
  supermarche: {
    label:       'Supermarché & GMS',
    emoji:       '🛒',
    description: 'Caisse, rayons, achats et gestion du personnel',
    dbModules:   ['facturation', 'stock', 'rh', 'tresorerie', 'achats', 'comptabilite'],
    uiModules: [
      { label: 'Caisse',             emoji: '🖥️' },
      { label: 'Rayons & Stock',     emoji: '📦' },
      { label: 'Achats',             emoji: '🛒' },
      { label: 'RH & Paie',         emoji: '👔' },
      { label: 'Trésorerie',         emoji: '💰' },
      { label: 'Comptabilité',       emoji: '📊' },
    ],
  },
  boutique: {
    label:       'Boutique & Magasin',
    emoji:       '👗',
    description: 'Ventes au détail, caisse, achats fournisseurs et inventaire',
    dbModules:   ['facturation', 'stock', 'tresorerie', 'achats', 'comptabilite'],
    uiModules: [
      { label: 'Caisse & Ventes',    emoji: '🛍️' },
      { label: 'Stock',              emoji: '📦' },
      { label: 'Achats & Fourn.',    emoji: '🛒' },
      { label: 'Trésorerie',         emoji: '💰' },
      { label: 'Comptabilité',       emoji: '📊' },
    ],
  },
  boisson: {
    label:       'Bar & Dépôt de boissons',
    emoji:       '🥤',
    description: 'Distribution, achats fournisseurs et gestion des stocks',
    dbModules:   ['facturation', 'stock', 'rh', 'tresorerie', 'achats', 'comptabilite'],
    uiModules: [
      { label: 'Ventes',             emoji: '🧾' },
      { label: 'Stock',              emoji: '📦' },
      { label: 'Achats & Fourn.',    emoji: '🛒' },
      { label: 'RH & Paie',         emoji: '👔' },
      { label: 'Trésorerie',         emoji: '💰' },
      { label: 'Comptabilité',       emoji: '📊' },
    ],
  },
  transport: {
    label:       'Transport & Logistique',
    emoji:       '🚖',
    description: 'Flotte, chauffeurs, carburant et maintenance',
    dbModules:   ['transport', 'facturation', 'stock', 'rh', 'tresorerie', 'achats', 'comptabilite'],
    uiModules: [
      { label: 'Flotte',             emoji: '🚗' },
      { label: 'Chauffeurs',         emoji: '👨‍✈️' },
      { label: 'Carburant & Stock',  emoji: '⛽' },
      { label: 'Maintenance',        emoji: '🔧' },
      { label: 'Achats & Fourn.',    emoji: '🛒' },
      { label: 'Facturation',        emoji: '🧾' },
      { label: 'RH & Paie',         emoji: '👔' },
      { label: 'Trésorerie',         emoji: '💰' },
      { label: 'Comptabilité',       emoji: '📊' },
    ],
  },
  transport_public: {
    label:       'Transport en commun',
    emoji:       '🚌',
    description: 'Lignes, billetterie, chauffeurs et recettes',
    dbModules:   ['transport', 'facturation', 'stock', 'rh', 'tresorerie', 'comptabilite'],
    uiModules: [
      { label: 'Lignes & Voyageurs', emoji: '🗺️' },
      { label: 'Billetterie',        emoji: '🎟️' },
      { label: 'Stock & Carburant',  emoji: '⛽' },
      { label: 'Chauffeurs',         emoji: '👨‍✈️' },
      { label: 'RH & Paie',         emoji: '👔' },
      { label: 'Trésorerie',         emoji: '💰' },
      { label: 'Comptabilité',       emoji: '📊' },
    ],
  },
  sante: {
    label:       'Santé & Clinique',
    emoji:       '🏥',
    description: 'Patients, consultations, pharmacie et personnel médical',
    dbModules:   ['facturation', 'rh', 'stock', 'tresorerie', 'achats', 'comptabilite'],
    uiModules: [
      { label: 'Consultations',       emoji: '🩺' },
      { label: 'Facturation',         emoji: '🧾' },
      { label: 'Stock / Pharmacie',   emoji: '💊' },
      { label: 'Achats médicaux',     emoji: '🛒' },
      { label: 'Personnel médical',   emoji: '👨‍⚕️' },
      { label: 'Trésorerie',          emoji: '💰' },
      { label: 'Comptabilité',        emoji: '📊' },
    ],
  },
  cabinet: {
    label:       'Cabinet & Conseil',
    emoji:       '💼',
    description: 'Facturation, devis, gestion des missions et IA',
    dbModules:   ['facturation', 'bizbot', 'tresorerie', 'comptabilite'],
    uiModules: [
      { label: 'Facturation & Devis', emoji: '🧾' },
      { label: 'Trésorerie',          emoji: '💰' },
      { label: 'Comptabilité',        emoji: '📊' },
      { label: 'MIAA+ Assistant',     emoji: '✨' },
    ],
  },
  btp: {
    label:       'BTP & Industrie',
    emoji:       '🏗️',
    description: 'Chantiers, fournitures, équipes et facturation travaux',
    dbModules:   ['facturation', 'stock', 'rh', 'tresorerie', 'achats', 'comptabilite'],
    uiModules: [
      { label: 'Facturation travaux', emoji: '🧾' },
      { label: 'Stock chantier',      emoji: '🏗️' },
      { label: 'Achats & Fourn.',     emoji: '🛒' },
      { label: 'RH & Équipes',       emoji: '👷' },
      { label: 'Trésorerie',          emoji: '💰' },
      { label: 'Comptabilité',        emoji: '📊' },
    ],
  },
  petrole: {
    label:       'Pétrole & Mines',
    emoji:       '🛢️',
    description: 'Gestion des opérations, stock et reporting',
    dbModules:   ['facturation', 'stock', 'rh', 'tresorerie', 'achats', 'comptabilite'],
    uiModules: [
      { label: 'Facturation',         emoji: '🧾' },
      { label: 'Stock & Inventaire',  emoji: '⛽' },
      { label: 'Achats & Fourn.',     emoji: '🛒' },
      { label: 'RH & Paie',          emoji: '👔' },
      { label: 'Trésorerie',          emoji: '💰' },
      { label: 'Comptabilité',        emoji: '📊' },
    ],
  },
  ong: {
    label:       'ONG & Association',
    emoji:       '🤝',
    description: 'Projets, dépenses, dons et rapports bailleurs',
    dbModules:   ['facturation', 'rh', 'tresorerie', 'depenses', 'stock', 'comptabilite'],
    uiModules: [
      { label: 'Projets & Budget',    emoji: '📋' },
      { label: 'Dépenses',            emoji: '💸' },
      { label: 'Stock & Matériel',    emoji: '📦' },
      { label: 'RH & Bénévoles',     emoji: '🤲' },
      { label: 'Trésorerie',          emoji: '💰' },
      { label: 'Comptabilité',        emoji: '📊' },
    ],
  },
  banque: {
    label:       'Banque & Microfinance',
    emoji:       '🏦',
    description: 'Comptes clients, prêts, épargne et reporting',
    dbModules:   ['facturation', 'tresorerie', 'rh', 'comptabilite'],
    uiModules: [
      { label: 'Comptes clients',     emoji: '👥' },
      { label: 'Comptabilité',        emoji: '📊' },
      { label: 'RH & Paie',          emoji: '👔' },
      { label: 'Trésorerie',          emoji: '💰' },
    ],
  },
  pharmacie: {
    label:       'Pharmacie',
    emoji:       '💊',
    description: 'Stock médicaments, ordonnances, clients et caisse',
    dbModules:   ['facturation', 'stock', 'rh', 'tresorerie', 'achats', 'comptabilite'],
    uiModules: [
      { label: 'Caisse',               emoji: '🖥️' },
      { label: 'Stock médicaments',    emoji: '💊' },
      { label: 'Achats & Fourn.',      emoji: '🛒' },
      { label: 'RH & Paie',           emoji: '👔' },
      { label: 'Trésorerie',           emoji: '💰' },
      { label: 'Comptabilité',         emoji: '📊' },
    ],
  },
  agriculture: {
    label:       'Agriculture & Élevage',
    emoji:       '🌾',
    description: 'Cultures, cheptel, stocks agricoles et dépenses',
    dbModules:   ['facturation', 'stock', 'rh', 'tresorerie', 'depenses', 'achats', 'comptabilite'],
    uiModules: [
      { label: 'Cultures & Récoltes', emoji: '🌱' },
      { label: 'Stock & Cheptel',     emoji: '📦' },
      { label: 'Achats & Intrants',   emoji: '🛒' },
      { label: 'Dépenses',            emoji: '💸' },
      { label: 'RH & Paie',          emoji: '👔' },
      { label: 'Trésorerie',          emoji: '💰' },
      { label: 'Comptabilité',        emoji: '📊' },
    ],
  },
}

// Derived from SECTOR_CONFIG — used by actions.ts (no change needed there)
export const SECTOR_MODULES: Record<string, string[]> = Object.fromEntries(
  Object.entries(SECTOR_CONFIG).map(([k, v]) => [k, v.dbModules])
)

// Used by Sidebar and other places that need display info per module key
export const MODULE_META: Record<string, { label: string; emoji: string; prix: number }> = {
  facturation:  { label: 'FacturePro',         emoji: '🧾', prix: 5000  },
  tresorerie:   { label: 'Trésorerie',          emoji: '💰', prix: 3000  },
  comptabilite: { label: 'Comptabilité',        emoji: '📊', prix: 6000  },
  mobilemoney:  { label: 'Mobile Money',        emoji: '📱', prix: 3000  },
  stock:        { label: 'Stock & Inventaire',  emoji: '📦', prix: 5000  },
  rh:           { label: 'RH Premium',          emoji: '👔', prix: 8000  },
  ecole:        { label: 'École & Université',  emoji: '🎓', prix: 15000 },
  restaurant:   { label: 'Resto POS',           emoji: '🍽️', prix: 10000 },
  achats:       { label: 'Achats & Fourn.',     emoji: '🛒', prix: 4000  },
  depenses:     { label: 'Dépenses',            emoji: '💸', prix: 3000  },
  rapports:     { label: 'Rapports IA',         emoji: '📈', prix: 5000  },
  hotel:        { label: 'Hôtel & Hébergement', emoji: '🏨', prix: 12000 },
  transport:    { label: 'Transport VTC',       emoji: '🚖', prix: 8000  },
  bizbot:       { label: 'MIAA+ Assistant',     emoji: '✨', prix: 6000  },
}

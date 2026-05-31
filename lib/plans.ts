/**
 * lib/plans.ts — Logique business Oraforme
 *
 * 3 packs intelligents (TPE / PME / Grande entreprise)
 * Modules calculés automatiquement = plan + secteur
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export type TailleEntreprise = 'tpe' | 'pme' | 'grande'

export type SecteurId =
  | 'commerce' | 'restaurant' | 'ecole' | 'sante' | 'btp'
  | 'transport' | 'hotel' | 'agriculture' | 'pharmacie' | 'banque'
  | 'ong' | 'cabinet' | 'boisson' | 'petrole' | 'supermarche'
  | 'boutique' | 'autre'

// ── Modules par plan (cumulatifs vers le haut) ────────────────────────────────

const TPE_MODULES = [
  'facturation', 'crm', 'tresorerie', 'rh', 'rapports',
  'depenses', 'taches', 'calendrier', 'notifications',
  'parametres', 'profil', 'devis', 'equipe',
]

const PME_EXTRA = [
  'comptabilite', 'fiscalite', 'stock', 'achats', 'workflows',
  'miaa', 'roles', 'audit-light', 'ged', 'mobilemoney',
]

const GRANDE_EXTRA = [
  'bi', 'bi-dg', 'direction', 'finance', 'analytics',
  'audit', 'api-keys', 'abonnement',
]

export const PLAN_MODULES: Record<TailleEntreprise, string[]> = {
  tpe:    TPE_MODULES,
  pme:    [...TPE_MODULES, ...PME_EXTRA],
  grande: [...TPE_MODULES, ...PME_EXTRA, ...GRANDE_EXTRA],
}

// ── Modules spécifiques au secteur (ajoutés quel que soit le plan) ─────────────

export const SECTOR_EXTRA_MODULES: Partial<Record<SecteurId, string[]>> = {
  restaurant:  ['restaurant', 'cuisine'],
  ecole:       [
    'ecole', 'ecole-direction', 'ecole-rh', 'ecole-comptabilite',
    'scolarite', 'daac', 'espace-formateur', 'espace-etudiant',
    'espace-parent', 'parametres-academiques', 'ecole-miaa',
  ],
  sante:       ['sante', 'sante-patients', 'sante-rdv', 'sante-consultations', 'sante-medecins'],
  hotel:       ['hotel', 'housekeeping'],
  btp:         ['btp'],
  transport:   ['transport'],
  banque:      ['banque'],
  ong:         ['ong'],
  cabinet:     ['cabinet'],
  boisson:     ['boisson'],
  petrole:     ['petrole'],
  pharmacie:   ['pharmacie'],
  agriculture: ['agriculture'],
}

/** Calcule la liste finale des modules pour un tenant */
export function computeModules(taille: TailleEntreprise, secteur: SecteurId): string[] {
  const planMods   = PLAN_MODULES[taille] ?? PLAN_MODULES.tpe
  const sectorMods = SECTOR_EXTRA_MODULES[secteur as SecteurId] ?? []
  return [...new Set([...planMods, ...sectorMods])]
}

// ── Config packs ──────────────────────────────────────────────────────────────

export const PLAN_CONFIG: Record<TailleEntreprise, {
  label: string
  subtitle: string
  price_fcfa: number
  max_users: number
  color: string
  badge: string | null
  features: string[]
}> = {
  tpe: {
    label:      'TPE',
    subtitle:   'Très Petite Entreprise',
    price_fcfa: 15_000,
    max_users:  5,
    color:      '#2563EB',
    badge:      null,
    features: [
      'Facturation & Devis',
      'CRM Clients',
      'Trésorerie & Caisse',
      'RH & Paie simple',
      'Rapports & Exports',
      'Dépenses & Notes de frais',
      'Calendrier & Tâches',
      '5 utilisateurs inclus',
    ],
  },
  pme: {
    label:      'PME',
    subtitle:   'Petite & Moyenne Entreprise',
    price_fcfa: 36_000,
    max_users:  25,
    color:      '#F59E0B',
    badge:      'Populaire',
    features: [
      'Tout TPE inclus',
      'Comptabilité OHADA complète',
      'Déclarations fiscales (TVA, CNSS, IRPP)',
      'Gestion des stocks',
      'Achats & Fournisseurs',
      'MIAA+ Intelligence Artificielle',
      'Workflows & Automatisation',
      'GED & Documents',
      '25 utilisateurs inclus',
    ],
  },
  grande: {
    label:      'Grande Entreprise',
    subtitle:   'Structure complexe & multi-sites',
    price_fcfa: 56_000,
    max_users:  -1,
    color:      '#7C3AED',
    badge:      'Premium',
    features: [
      'Tout PME inclus',
      'Business Intelligence avancée',
      'Audit & Conformité',
      'API Publique & Intégrations',
      'Multi-branches & multi-sites',
      'Automatisation IA avancée',
      'Reporting exécutif',
      'Utilisateurs illimités',
      'Support dédié prioritaire',
    ],
  },
}

// ── Secteurs ──────────────────────────────────────────────────────────────────

export const SECTEUR_CONFIG: Record<SecteurId, {
  label: string
  emoji: string
  description: string
}> = {
  commerce:    { label: 'Commerce & Distribution',  emoji: '🏪', description: 'Négoce, import-export, distribution' },
  restaurant:  { label: 'Restaurant & Hôtellerie',  emoji: '🍽️', description: 'Restauration, fast-food, traiteur' },
  ecole:       { label: 'École & Université',        emoji: '🎓', description: 'Enseignement, formation professionnelle' },
  sante:       { label: 'Santé & Clinique',          emoji: '🏥', description: 'Clinique, cabinet médical' },
  btp:         { label: 'BTP & Construction',        emoji: '🏗️', description: 'Bâtiment, travaux publics' },
  transport:   { label: 'Transport & Logistique',    emoji: '🚛', description: 'Transport routier, taxi, logistique' },
  hotel:       { label: 'Hôtel & Tourisme',          emoji: '🏨', description: 'Hôtel, auberge, tourisme' },
  agriculture: { label: 'Agriculture & Élevage',    emoji: '🌾', description: 'Exploitation agricole, élevage' },
  pharmacie:   { label: 'Pharmacie',                 emoji: '💊', description: 'Pharmacie, para-pharmacie' },
  banque:      { label: 'Banque & Finance',          emoji: '🏦', description: 'Banque, microfinance, épargne' },
  ong:         { label: 'ONG & Associations',        emoji: '🤝', description: 'ONG, associations, fondations' },
  cabinet:     { label: 'Cabinet Comptable',         emoji: '📋', description: 'Expertise comptable, audit' },
  boisson:     { label: 'Boisson & Distribution',   emoji: '🍺', description: 'Production, distribution boissons' },
  petrole:     { label: 'Pétrole & Énergie',         emoji: '⛽', description: 'Station service, énergie' },
  supermarche: { label: 'Supermarché & GMS',         emoji: '🛒', description: 'Grande distribution' },
  boutique:    { label: 'Boutique & Magasin',        emoji: '👗', description: 'Mode, accessoires, bijoux' },
  autre:       { label: 'Autre activité',            emoji: '🏢', description: "Autre type d'entreprise" },
}

// ── Pays ──────────────────────────────────────────────────────────────────────

export const PAYS_LIST = [
  { code: 'CG',    label: 'Congo-Brazzaville',   flag: '🇨🇬' },
  { code: 'CD',    label: 'RD Congo (Kinshasa)',  flag: '🇨🇩' },
  { code: 'GA',    label: 'Gabon',                flag: '🇬🇦' },
  { code: 'CM',    label: 'Cameroun',             flag: '🇨🇲' },
  { code: 'CI',    label: "Côte d'Ivoire",        flag: '🇨🇮' },
  { code: 'SN',    label: 'Sénégal',              flag: '🇸🇳' },
  { code: 'ML',    label: 'Mali',                 flag: '🇲🇱' },
  { code: 'BF',    label: 'Burkina Faso',         flag: '🇧🇫' },
  { code: 'TG',    label: 'Togo',                 flag: '🇹🇬' },
  { code: 'BJ',    label: 'Bénin',                flag: '🇧🇯' },
  { code: 'MG',    label: 'Madagascar',           flag: '🇲🇬' },
  { code: 'RW',    label: 'Rwanda',               flag: '🇷🇼' },
  { code: 'KE',    label: 'Kenya',                flag: '🇰🇪' },
  { code: 'NG',    label: 'Nigeria',              flag: '🇳🇬' },
  { code: 'GH',    label: 'Ghana',                flag: '🇬🇭' },
  { code: 'OTHER', label: 'Autre pays',           flag: '🌍' },
]

export const LANGUES_LIST = [
  { code: 'fr', label: 'Français',   flag: '🇫🇷' },
  { code: 'en', label: 'English',    flag: '🇬🇧' },
  { code: 'pt', label: 'Português',  flag: '🇧🇷' },
  { code: 'es', label: 'Español',    flag: '🇪🇸' },
  { code: 'ln', label: 'Lingala',    flag: '🇨🇬' },
  { code: 'sw', label: 'Swahili',    flag: '🇰🇪' },
  { code: 'kg', label: 'Kikongo',    flag: '🇨🇬' },
]

// ── Helpers ───────────────────────────────────────────────────────────────────

export function formatPrice(fcfa: number, paysCode: string = 'CG'): string {
  return new Intl.NumberFormat('fr-FR').format(fcfa) + ' FCFA'
}

export function getPlanFromLegacy(plan: string): TailleEntreprise {
  if (plan === 'pro')        return 'pme'
  if (plan === 'enterprise') return 'grande'
  return 'tpe'
}

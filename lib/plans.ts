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
  | 'boutique' | 'assurance' | 'recrutement' | 'autre'

// ── Modules par plan (cumulatifs vers le haut) ────────────────────────────────

const TPE_MODULES = [
  'facturation', 'crm', 'tresorerie', 'rh', 'rapports',
  'depenses', 'taches', 'calendrier', 'notifications',
  'parametres', 'profil', 'devis', 'equipe',
]

const PME_EXTRA = [
  'comptabilite', 'fiscalite', 'stock', 'achats', 'workflows',
  'miaa', 'roles', 'ged', 'mobilemoney',
  'academy',
  'audit-comptable', 'audit-financier', 'audit-fiscal',
  'audit-rh', 'audit-ci', 'audit-risques', 'audit-ohada',
  'audit-plans', 'audit-rapports',
]

const GRANDE_EXTRA = [
  'bi', 'bi-dg', 'direction', 'finance', 'analytics',
  'audit', 'api-keys', 'abonnement',
]

const COMPAGNIE_EXTRA = [
  'groupe', 'groupe-vue', 'entity-switcher',
  'email-management', 'social-media',
]

export const PLAN_MODULES: Record<TailleEntreprise, string[]> = {
  tpe:    TPE_MODULES,
  pme:    [...TPE_MODULES, ...PME_EXTRA, ...GRANDE_EXTRA],
  grande: [...TPE_MODULES, ...PME_EXTRA, ...GRANDE_EXTRA, ...COMPAGNIE_EXTRA],
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
  recrutement: [
    'recrutement-direction', 'recrutement-offres', 'recrutement-candidatures',
    'recrutement-entretiens', 'recrutement-cvtheque', 'recrutement-placement',
    'recrutement-contrats', 'recrutement-partenaires', 'recrutement-analytics',
    'recrutement-miaa',
  ],
}

/** Calcule la liste finale des modules pour un tenant */
export function computeModules(taille: TailleEntreprise, secteur: SecteurId): string[] {
  const planMods   = PLAN_MODULES[taille] ?? PLAN_MODULES.tpe
  const sectorMods = SECTOR_EXTRA_MODULES[secteur as SecteurId] ?? []
  return [...new Set([...planMods, ...sectorMods])]
}

// ── Durée d'essai gratuit ─────────────────────────────────────────────────────
export const TRIAL_DAYS = 30

// ── Tarification spéciale par secteur ─────────────────────────────────────────
export const SPECIAL_SECTOR_PRICING: Record<string, {
  price_fcfa: number
  note?: string
}> = {
  cabinet:    { price_fcfa: 20_000, note: '+ 5 000 FCFA / client actif' },
  ecole:      { price_fcfa: 35_000 },
  universite: { price_fcfa: 56_000 },
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
  miaa: string
}> = {
  tpe: {
    label:      'Entrepreneur',
    subtitle:   'Pour indépendants, TPE & petites structures',
    price_fcfa: 10_000,
    max_users:  5,
    color:      '#16A34A',
    badge:      null,
    miaa:       'MIAA+ Standard',
    features: [
      'Facturation & Devis illimités',
      'CRM, Trésorerie & Caisse',
      'RH & Paie complète',
      'Dépenses & Notes de frais',
      'Rapports & Calendrier',
      'MIAA+ Standard (IA intégrée)',
      '5 utilisateurs inclus',
    ],
  },
  pme: {
    label:      'Business',
    subtitle:   'Pour PME, cabinets & secteurs spécialisés',
    price_fcfa: 25_000,
    max_users:  25,
    color:      '#F59E0B',
    badge:      'Populaire',
    miaa:       'MIAA+ Premium',
    features: [
      'Tout Entrepreneur inclus',
      'Comptabilité OHADA & Fiscalité',
      'Stock, Achats & Workflows',
      'Analytics & Business Intelligence',
      'Audit & Conformité',
      'MIAA+ Premium (IA avancée)',
      'GED & Documents',
      '25 utilisateurs inclus',
    ],
  },
  grande: {
    label:      'Compagnie',
    subtitle:   'Groupes internationaux, filiales & multi-entités',
    price_fcfa: 46_000,
    max_users:  -1,
    color:      '#7C3AED',
    badge:      'Compagnie',
    miaa:       'MIAA+ Illimité',
    features: [
      'Tout Business inclus',
      'Gestion groupe & filiales',
      'Vue consolidée multi-entités',
      'Gestion emails d\'entreprise',
      'Gestion réseaux sociaux',
      'MIAA+ Illimité',
      'API Publique & Intégrations',
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
  assurance:   { label: 'Assurance & Réassurance',    emoji: '🛡️', description: 'Compagnie, courtier, agent assurance' },
  recrutement: { label: 'Recrutement & Placement RH', emoji: '👔', description: 'Cabinet RH, recrutement, intérim, placement' },
  autre:       { label: 'Autre activité',              emoji: '🏢', description: "Autre type d'entreprise" },
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

const PAYS_DEVISE: Record<string, { symbol: string; rate: number }> = {
  CG: { symbol: 'FCFA', rate: 1      },
  CM: { symbol: 'FCFA', rate: 1      },
  GA: { symbol: 'FCFA', rate: 1      },
  CI: { symbol: 'FCFA', rate: 1      },
  SN: { symbol: 'FCFA', rate: 1      },
  ML: { symbol: 'FCFA', rate: 1      },
  BF: { symbol: 'FCFA', rate: 1      },
  TG: { symbol: 'FCFA', rate: 1      },
  BJ: { symbol: 'FCFA', rate: 1      },
  CD: { symbol: 'FC',   rate: 4.7    },
  MG: { symbol: 'Ar',   rate: 6.0    },
  RW: { symbol: 'RWF',  rate: 1.7    },
  KE: { symbol: 'KES',  rate: 0.22   },
  NG: { symbol: '₦',    rate: 2.2    },
  GH: { symbol: 'GH₵',  rate: 0.016  },
}

export function formatPrice(fcfa: number, paysCode: string = 'CG'): string {
  const devise = PAYS_DEVISE[paysCode] ?? { symbol: 'FCFA', rate: 1 }
  const converted = Math.round(fcfa * devise.rate)
  return new Intl.NumberFormat('fr-FR').format(converted) + ' ' + devise.symbol
}

export function getPlanFromLegacy(plan: string): TailleEntreprise {
  if (plan === 'pro')        return 'pme'
  if (plan === 'enterprise') return 'grande'
  return 'tpe'
}

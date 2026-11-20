/**
 * lib/plans.ts — Logique business Oraforme
 *
 * 3 packs intelligents (TPE / PME / Grande entreprise)
 * Modules calculés automatiquement = plan + secteur
 */

// ── Types ─────────────────────────────────────────────────────────────────────

import type { SectorId } from './erp-sectors'

export type TailleEntreprise = 'tpe' | 'pme' | 'grande'

/** Source unique : lib/erp-sectors.ts (refonte 2026-11). */
export type SecteurId = SectorId

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

// N3 — Intelligence Entreprise (EXCLUSIVE Compagnie — nouveaux comptes)
// Les comptes Business existants conservent ces modules via Grandfather Policy (tenant_modules)
const COMPAGNIE_INTEL = [
  'bi', 'bi-dg', 'direction', 'finance', 'analytics',
  'audit', 'api-keys', 'abonnement',
]

// N4 — Architecture Multi-Entités (EXCLUSIF Compagnie)
const COMPAGNIE_MULTI = [
  'groupe', 'groupe-vue', 'entity-switcher',
  'consolidation', 'intercompany', 'budget-groupe',
  'tresorerie-groupe', 'direction-groupe', 'rapports-groupe',
  'bi-groupe', 'gouvernance', 'email-management', 'social-media',
  'validation-hierarchique', 'audit-groupe',
]

export const PLAN_MODULES: Record<TailleEntreprise, string[]> = {
  tpe:    TPE_MODULES,                                                            // N1 — 13 modules
  pme:    [...TPE_MODULES, ...PME_EXTRA],                                        // N1+N2 — 32 modules
  grande: [...TPE_MODULES, ...PME_EXTRA, ...COMPAGNIE_INTEL, ...COMPAGNIE_MULTI], // N1+N2+N3+N4 — 55 modules
}

// ── Modules spécifiques au secteur (ajoutés quel que soit le plan) ─────────────

export const SECTOR_EXTRA_MODULES: Partial<Record<SecteurId, string[]>> = {
  ecole:       [
    'ecole', 'ecole-direction', 'ecole-rh', 'ecole-comptabilite',
    'scolarite', 'daac', 'espace-formateur', 'espace-etudiant',
    'espace-parent', 'parametres-academiques', 'ecole-miaa',
  ],
  sante:       ['sante', 'sante-patients', 'sante-rdv', 'sante-consultations', 'sante-medecins'],
  cabinet:     ['cabinet'],
  hotel:       ['hotel', 'housekeeping'],
  // Le garage s'appuie sur le stock (pièces) et la facturation, même en TPE.
  garage:      ['garage', 'garage-vehicules', 'garage-pieces', 'garage-factures', 'stock', 'achats'],
  recrutement: [
    'recrutement-direction', 'recrutement-offres', 'recrutement-ats', 'recrutement-candidatures',
    'recrutement-entretiens', 'recrutement-cvtheque', 'recrutement-placement',
    'recrutement-mad', 'recrutement-contrats', 'recrutement-partenaires', 'recrutement-analytics',
    'recrutement-miaa',
  ],
  // Boutique, boulangerie et grande distribution (sous-types de commerce).
  commerce: [
    'commerce', 'commerce-catalogue', 'commerce-clients', 'commerce-analytics',
    'stock', 'achats',
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
      'Comptabilité OHADA complète & Fiscalité',
      'Stock, Achats & Workflows',
      'Audit & Conformité OHADA',
      'MIAA+ Premium (IA avancée)',
      'GED & Documents',
      'Modules sectoriels (École, Hôtel, Cabinet, Santé…)',
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
  entreprise:  { label: 'Entreprise & PME',           emoji: '🏢', description: 'PME, industrie, services — socle ERP complet' },
  ecole:       { label: 'École & Université',         emoji: '🎓', description: 'Crèche, primaire, collège, lycée, université' },
  commerce:    { label: 'Commerce & Boutique',        emoji: '🏪', description: 'Boutique, boulangerie, grande distribution' },
  cabinet:     { label: 'Cabinet & Conseil',          emoji: '📋', description: 'Comptable, fiscal, audit, conseil, juridique' },
  sante:       { label: 'Santé & Clinique',           emoji: '🏥', description: 'Clinique, hôpital' },
  hotel:       { label: 'Hôtel & Hébergement',        emoji: '🏨', description: 'Hôtel, auberge, résidence' },
  garage:      { label: 'Garage & Atelier auto',      emoji: '🔧', description: 'Mécanique, entretien, réparation automobile' },
  recrutement: { label: 'Recrutement & Placement RH', emoji: '👔', description: 'Cabinet RH, recrutement, intérim, placement' },
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

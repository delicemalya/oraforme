/**
 * erp-sectors.ts — Configuration universelle ERP multi-secteurs Oraforme
 *
 * Architecture 3 couches (inspirée d'Odoo / SAP) :
 *  COUCHE 1 — Core ERP Universal  : identique pour TOUS les secteurs
 *  COUCHE 2 — Secteur Métier       : spécificités propres à chaque secteur
 *  COUCHE 3 — Plateforme           : outils transverses toujours en bas
 */

export type SectorId =
  | 'ecole' | 'restaurant' | 'commerce' | 'supermarche' | 'boutique'
  | 'boisson' | 'sante' | 'transport' | 'transport_public' | 'hotel'
  | 'btp' | 'cabinet' | 'petrole' | 'ong' | 'banque' | 'pharmacie' | 'agriculture'

// ── COUCHE 1 : Core ERP ───────────────────────────────────────────────────────
// Ces 10 modules apparaissent dans TOUTES les sidebars, tous secteurs confondus.

export const CORE_ERP_MODULES = [
  { id: 'direction',    href: '/dashboard/direction',    label: 'Direction Générale',  sublabel: 'Pilotage & KPIs'          },
  { id: 'rh',           href: '/dashboard/rh',           label: 'RH & Paie',           sublabel: 'Personnel & salaires'     },
  { id: 'finance',      href: '/dashboard/finance',      label: 'Finance',             sublabel: 'KPIs & résultats'         },
  { id: 'comptabilite', href: '/dashboard/comptabilite', label: 'Comptabilité',        sublabel: 'Journal OHADA'            },
  { id: 'tresorerie',   href: '/dashboard/tresorerie',   label: 'Trésorerie',          sublabel: 'Caisse, banque, wallets'  },
  { id: 'stock',        href: '/dashboard/stocks',       label: 'Stock & Inventaire',  sublabel: 'Gestion des stocks'       },
  { id: 'achats',       href: '/dashboard/achats',       label: 'Achats',              sublabel: 'Commandes & fournisseurs' },
  { id: 'crm',          href: '/dashboard/crm',          label: 'CRM Clients',         sublabel: 'Relations & prospects'    },
  { id: 'facturation',  href: '/dashboard/facturation',  label: 'Facturation',         sublabel: 'Devis & factures'         },
  { id: 'depenses',     href: '/dashboard/depenses',     label: 'Dépenses',            sublabel: 'Charges & remboursements' },
] as const

export type CoreModuleId = typeof CORE_ERP_MODULES[number]['id']

// ── COUCHE 2 : Secteur Métier ─────────────────────────────────────────────────
// Modules UNIQUES à chaque secteur (non présents dans le core).

export const SECTOR_SPECIFIC: Partial<Record<SectorId, Array<{
  id: string
  href: string
  label: string
  sublabel: string
  roleFilter?: string[]   // Pour l'école : visibilité par rôle école
}>>> = {
  ecole: [
    { id: 'scolarite',              href: '/dashboard/ecole/scolarite',              label: 'Scolarité',              sublabel: 'Inscriptions & frais',    roleFilter: ['DIRECTION_GENERALE', 'SCOLARITE', 'DAAC'] },
    { id: 'daac',                   href: '/dashboard/ecole/daac',                   label: 'DAAC',                   sublabel: 'Affaires académiques',     roleFilter: ['DIRECTION_GENERALE', 'DAAC'] },
    { id: 'espace-formateur',       href: '/dashboard/ecole/espace-formateur',       label: 'Formateurs',             sublabel: 'Cours & heures',           roleFilter: ['FORMATEUR', 'DIRECTION_GENERALE', 'DAAC'] },
    { id: 'espace-etudiant',        href: '/dashboard/ecole/espace-etudiant',        label: 'Espace Étudiant',        sublabel: 'Mon dossier',              roleFilter: ['ETUDIANT'] },
    { id: 'espace-parent',          href: '/dashboard/ecole/espace-parent',          label: 'Espace Parent',          sublabel: 'Suivi scolarité',          roleFilter: ['PARENT'] },
    { id: 'parametres-academiques', href: '/dashboard/ecole/parametres-academiques', label: 'Paramètres académiques', sublabel: 'LMD & mentions',           roleFilter: ['DIRECTION_GENERALE', 'DAAC'] },
  ],
  restaurant: [
    { id: 'restaurant', href: '/dashboard/restaurant',         label: 'Caisse POS',     sublabel: 'Commandes & service'     },
    { id: 'cuisine',    href: '/dashboard/restaurant/cuisine', label: 'Cuisine',        sublabel: 'Cuisine & préparation'   },
  ],
  hotel: [
    { id: 'hotel', href: '/dashboard/hotel', label: 'Hébergement', sublabel: 'Réservations & chambres' },
  ],
  transport: [
    { id: 'transport', href: '/dashboard/transport', label: 'Flotte VTC', sublabel: 'Véhicules & courses' },
  ],
  transport_public: [
    { id: 'transport', href: '/dashboard/transport', label: 'Transport public', sublabel: 'Lignes & voyageurs' },
  ],
}

// ── COUCHE 3 : Plateforme ─────────────────────────────────────────────────────
// Ces modules apparaissent TOUJOURS en bas, tous secteurs confondus.

export const PLATFORM_MODULES = [
  { id: 'analytics',     href: '/dashboard/analytics',     label: 'Analytics & BI',   sublabel: 'Rapports & prévisions'  },
  { id: 'bizbot',        href: '/dashboard/miaa',           label: 'MIAA+ IA',         sublabel: 'Assistant intelligent'  },
  { id: 'ged',           href: '/dashboard/ged',            label: 'GED Documents',    sublabel: 'Gestion documentaire'   },
  { id: 'notifications', href: '/dashboard/notifications',  label: 'Notifications',    sublabel: 'Alertes & messages'     },
  { id: 'profil',        href: '/dashboard/profil',         label: 'Profil Entreprise',sublabel: 'Marque & paramètres'    },
  { id: 'roles',         href: '/dashboard/roles',          label: 'Rôles & Droits',   sublabel: 'Permissions équipe'     },
  { id: 'audit',         href: '/dashboard/audit',          label: 'Audit & Logs',     sublabel: 'Traçabilité'            },
  { id: 'parametres',    href: '/dashboard/parametres',     label: 'Paramètres',       sublabel: 'Configuration'          },
] as const

// ── Meta secteurs ─────────────────────────────────────────────────────────────

export const SECTOR_LABELS: Record<string, string> = {
  ecole:            'École & Université',
  restaurant:       'Restauration',
  commerce:         'Commerce',
  supermarche:      'Supermarché',
  boutique:         'Boutique',
  boisson:          'Boissons & Distribution',
  sante:            'Santé & Clinique',
  transport:        'Transport & Logistique',
  transport_public: 'Transport Public',
  hotel:            'Hôtellerie',
  btp:              'BTP & Construction',
  cabinet:          'Cabinet & Conseil',
  petrole:          'Pétrole & Mines',
  ong:              'ONG & Association',
  banque:           'Banque & Microfinance',
  pharmacie:        'Pharmacie',
  agriculture:      'Agriculture',
}

// ── Rôles école (visibilité sidebar core) ─────────────────────────────────────

export const ECOLE_CORE_ROLE_FILTER: Record<string, string[]> = {
  direction:    ['DIRECTION_GENERALE'],
  rh:           ['DIRECTION_GENERALE', 'RAF', 'RH_PAIE'],
  finance:      ['DIRECTION_GENERALE', 'RAF'],
  comptabilite: ['DIRECTION_GENERALE', 'RAF'],
  tresorerie:   ['DIRECTION_GENERALE', 'RAF'],
  stock:        ['DIRECTION_GENERALE'],
  achats:       ['DIRECTION_GENERALE', 'RAF'],
  crm:          ['DIRECTION_GENERALE'],
  facturation:  ['DIRECTION_GENERALE', 'RAF', 'SCOLARITE'],
  depenses:     ['DIRECTION_GENERALE', 'RAF'],
}

// ── Set d'IDs core pour le check rapide ───────────────────────────────────────

export const CORE_IDS = new Set(CORE_ERP_MODULES.map(m => m.id))
export const PLATFORM_IDS = new Set(PLATFORM_MODULES.map(m => m.id))

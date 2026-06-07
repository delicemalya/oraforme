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
  { id: 'crm',           href: '/dashboard/crm',           label: 'CRM Clients',         sublabel: 'Relations, pipeline, activités' },
  { id: 'facturation',  href: '/dashboard/facturation',  label: 'Facturation',         sublabel: 'Devis & factures'               },
  { id: 'recouvrement', href: '/dashboard/recouvrement', label: 'Recouvrement',        sublabel: 'Relances & scoring risque'      },
  { id: 'depenses',     href: '/dashboard/depenses',     label: 'Dépenses',            sublabel: 'Charges & remboursements'       },
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
    { id: 'ecole-direction',        href: '/dashboard/ecole/direction',              label: 'Direction École',        sublabel: 'Pilotage & KPIs école',    roleFilter: ['DIRECTION_GENERALE'] },
    { id: 'ecole-rh',               href: '/dashboard/ecole/rh',                     label: 'RH École',               sublabel: 'Personnel & enseignants',  roleFilter: ['DIRECTION_GENERALE', 'RH_PAIE'] },
    { id: 'ecole-comptabilite',     href: '/dashboard/ecole/comptabilite',           label: 'Comptabilité École',     sublabel: 'Finances & OHADA école',   roleFilter: ['DIRECTION_GENERALE', 'RAF'] },
    { id: 'scolarite',              href: '/dashboard/ecole/scolarite',              label: 'Scolarité',              sublabel: 'Inscriptions & frais',     roleFilter: ['DIRECTION_GENERALE', 'SCOLARITE', 'DAAC'] },
    { id: 'daac',                   href: '/dashboard/ecole/daac',                   label: 'DAAC',                   sublabel: 'Affaires académiques',     roleFilter: ['DIRECTION_GENERALE', 'DAAC'] },
    { id: 'espace-formateur',       href: '/dashboard/ecole/espace-formateur',       label: 'Formateurs',             sublabel: 'Cours & heures',           roleFilter: ['FORMATEUR', 'DIRECTION_GENERALE', 'DAAC'] },
    { id: 'espace-etudiant',        href: '/dashboard/ecole/espace-etudiant',        label: 'Espace Étudiant',        sublabel: 'Mon dossier',              roleFilter: ['ETUDIANT'] },
    { id: 'espace-parent',          href: '/dashboard/ecole/espace-parent',          label: 'Espace Parent',          sublabel: 'Suivi scolarité',          roleFilter: ['PARENT'] },
    { id: 'parametres-academiques', href: '/dashboard/ecole/parametres-academiques', label: 'Paramètres académiques', sublabel: 'LMD & mentions',           roleFilter: ['DIRECTION_GENERALE', 'DAAC'] },
    { id: 'ecole-miaa',             href: '/dashboard/ecole/miaa',                   label: 'MIAA+ École',            sublabel: 'IA assistant école',       roleFilter: ['DIRECTION_GENERALE', 'DAAC', 'FORMATEUR'] },
  ],
  restaurant: [
    { id: 'restaurant', href: '/dashboard/restaurant',         label: 'Caisse POS',     sublabel: 'Commandes & service'     },
    { id: 'cuisine',    href: '/dashboard/restaurant/cuisine', label: 'Cuisine',        sublabel: 'Cuisine & préparation'   },
  ],
  sante: [
    { id: 'sante',               href: '/dashboard/sante',                label: 'Clinique',        sublabel: 'Tableau de bord santé'     },
    { id: 'sante-patients',      href: '/dashboard/sante/patients',       label: 'Patients',        sublabel: 'Dossiers & antécédents'    },
    { id: 'sante-rdv',          href: '/dashboard/sante/rendez-vous',    label: 'Rendez-vous',     sublabel: 'Agenda & planification'    },
    { id: 'sante-consultations', href: '/dashboard/sante/consultations',  label: 'Consultations',   sublabel: 'Actes médicaux & ordonnances' },
    { id: 'sante-medecins',      href: '/dashboard/sante/medecins',       label: 'Médecins',        sublabel: 'Personnel médical'         },
  ],
  pharmacie: [
    { id: 'pharmacie',           href: '/dashboard/pharmacie',            label: 'Pharmacie',       sublabel: 'Tableau de bord'           },
    { id: 'pharmacie-meds',     href: '/dashboard/pharmacie/medicaments',label: 'Médicaments',     sublabel: 'Stock & catalogue'         },
    { id: 'pharmacie-ventes',   href: '/dashboard/pharmacie/ventes',     label: 'Ventes / POS',    sublabel: 'Caisse & ordonnances'      },
  ],
  hotel: [
    { id: 'hotel',         href: '/dashboard/hotel',               label: 'Hébergement',    sublabel: 'Réservations & chambres' },
    { id: 'housekeeping',  href: '/dashboard/hotel/housekeeping',  label: 'Housekeeping',   sublabel: 'Ménage & entretien'      },
  ],
  transport: [
    { id: 'transport', href: '/dashboard/transport', label: 'Flotte VTC', sublabel: 'Véhicules & courses' },
  ],
  transport_public: [
    { id: 'transport', href: '/dashboard/transport', label: 'Transport public', sublabel: 'Lignes & voyageurs' },
  ],
  btp: [
    { id: 'btp',           href: '/dashboard/btp',                label: 'Chantiers',    sublabel: 'Tableau de bord BTP'       },
    { id: 'btp-devis',     href: '/dashboard/btp/devis',          label: 'Devis & AO',   sublabel: 'Devis & appels d\'offres'  },
    { id: 'btp-chantiers', href: '/dashboard/btp/chantiers',      label: 'Chantiers',    sublabel: 'Projets & avancement'      },
    { id: 'btp-materiaux', href: '/dashboard/btp/materiaux',      label: 'Matériaux',    sublabel: 'Stock & équipements'       },
  ],
  banque: [
    { id: 'banque',            href: '/dashboard/banque',                label: 'Microfinance', sublabel: 'Tableau de bord'           },
    { id: 'banque-clients',    href: '/dashboard/banque/clients',        label: 'Membres',      sublabel: 'Comptes & membres'         },
    { id: 'banque-credits',    href: '/dashboard/banque/credits',        label: 'Crédits',      sublabel: 'Prêts & remboursements'    },
    { id: 'banque-epargne',    href: '/dashboard/banque/epargne',        label: 'Épargne',      sublabel: 'Dépôts & retraits'         },
    { id: 'banque-operations', href: '/dashboard/banque/operations',     label: 'Opérations',   sublabel: 'Transactions & virements'  },
  ],
  agriculture: [
    { id: 'agriculture',           href: '/dashboard/agriculture',           label: 'Exploitation', sublabel: 'Tableau de bord agricole'  },
    { id: 'agriculture-parcelles', href: '/dashboard/agriculture/parcelles', label: 'Parcelles',    sublabel: 'Cultures & superficies'    },
    { id: 'agriculture-recoltes',  href: '/dashboard/agriculture/recoltes',  label: 'Récoltes',     sublabel: 'Production & stocks'       },
    { id: 'agriculture-intrants',  href: '/dashboard/agriculture/intrants',  label: 'Intrants',     sublabel: 'Semences, engrais & outils'},
  ],
  cabinet: [
    { id: 'cabinet',           href: '/dashboard/cabinet',              label: 'Cabinet',     sublabel: 'Tableau de bord cabinet'    },
    { id: 'cabinet-clients',   href: '/dashboard/cabinet/clients',      label: 'Clients',     sublabel: 'Sociétés gérées'            },
    { id: 'cabinet-documents', href: '/dashboard/cabinet/clients',      label: 'Documents',   sublabel: 'GED partagée'               },
    { id: 'cabinet-taches',    href: '/dashboard/cabinet/clients',      label: 'Tâches',      sublabel: 'Missions & déclarations'    },
    { id: 'cabinet-revenue',   href: '/dashboard/cabinet',              label: 'Revenue',     sublabel: '5 000 FCFA/client/mois'     },
    { id: 'cabinet-projets',   href: '/dashboard/cabinet/projets',      label: 'Projets',     sublabel: 'Missions & livrables'       },
  ],
  petrole: [
    { id: 'petrole',       href: '/dashboard/petrole',        label: 'Exploitation',  sublabel: 'Tableau de bord pétrole'   },
    { id: 'petrole-sites', href: '/dashboard/petrole/sites',  label: 'Sites',         sublabel: 'Puits & sites d\'extraction'},
  ],
  ong: [
    { id: 'ong',          href: '/dashboard/ong',         label: 'ONG',          sublabel: 'Tableau de bord associatif' },
    { id: 'ong-projets',  href: '/dashboard/ong/projets', label: 'Projets',      sublabel: 'Programmes & bailleurs'     },
    { id: 'ong-dons',     href: '/dashboard/ong/dons',    label: 'Dons',         sublabel: 'Collecte & affectation'     },
  ],
  boisson: [
    { id: 'boisson',         href: '/dashboard/boisson',            label: 'Distribution', sublabel: 'Tableau de bord boissons'  },
    { id: 'boisson-tournees',href: '/dashboard/boisson/tournees',   label: 'Tournées',     sublabel: 'Livraisons & chauffeurs'   },
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
  { id: 'audit',         href: '/dashboard/audit',          label: 'Audit & Logs',     sublabel: 'Traçabilité système'    },
  { id: 'calendrier',    href: '/dashboard/calendrier',     label: 'Calendrier',       sublabel: 'Événements & planning'  },
  { id: 'taches',        href: '/dashboard/taches',         label: 'Tâches',           sublabel: 'Collaboration & suivi'  },
  { id: 'abonnement',    href: '/dashboard/abonnement',     label: 'Abonnement',       sublabel: 'Plans & facturation'    },
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
  crm:           ['DIRECTION_GENERALE'],
  facturation:   ['DIRECTION_GENERALE', 'RAF', 'SCOLARITE'],
  recouvrement:  ['DIRECTION_GENERALE', 'RAF'],
  depenses:      ['DIRECTION_GENERALE', 'RAF'],
}

// ── Set d'IDs core pour le check rapide ───────────────────────────────────────

export const CORE_IDS = new Set(CORE_ERP_MODULES.map(m => m.id))
export const PLATFORM_IDS = new Set(PLATFORM_MODULES.map(m => m.id))

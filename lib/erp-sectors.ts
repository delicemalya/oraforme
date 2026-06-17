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
  | 'assurance'

// ── COUCHE 1 : Core ERP ───────────────────────────────────────────────────────
// Ces 10 modules apparaissent dans TOUTES les sidebars, tous secteurs confondus.

export const CORE_ERP_MODULES = [
  { id: 'direction',    href: '/dashboard',              label: 'Direction Générale',  sublabel: 'Pilotage & KPIs'          },
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

// ── Types école sous-niveaux ──────────────────────────────────────────────────
// garderie/primaire/college = niveau basique
// lycee = niveau intermédiaire (inclut basique)
// universite = niveau complet (inclut tout)

export type EcoleSousType = 'garderie' | 'primaire' | 'college' | 'lycee' | 'universite'

// Niveaux hiérarchiques pour comparaison
export const ECOLE_NIVEAU: Record<EcoleSousType, number> = {
  garderie:   0,
  primaire:   1,
  college:    2,
  lycee:      3,
  universite: 4,
}

export const SECTOR_SPECIFIC: Partial<Record<SectorId, Array<{
  id: string
  href: string
  label: string
  sublabel: string
  roleFilter?: string[]       // Visibilité par rôle école
  minSousType?: EcoleSousType // Sous-type minimum requis (pour l'école)
}>>> = {
  ecole: [
    // ─ Toujours visibles (tous niveaux)
    { id: 'ecole-direction',
      href:       '/dashboard/ecole/direction',
      label:      'Direction',
      sublabel:   'Pilotage & KPIs',
      roleFilter: ['DIRECTION_GENERALE'] },

    { id: 'scolarite',
      href:       '/dashboard/ecole/scolarite',
      label:      'Scolarité',
      sublabel:   'Inscriptions & frais',
      roleFilter: ['DIRECTION_GENERALE', 'SCOLARITE', 'DAAC'] },

    { id: 'espace-formateur',
      href:       '/dashboard/ecole/espace-formateur',
      label:      'Formateurs',
      sublabel:   'Cours & heures',
      roleFilter: ['FORMATEUR', 'DIRECTION_GENERALE', 'DAAC'] },

    { id: 'espace-etudiant',
      href:       '/dashboard/ecole/espace-etudiant',
      label:      'Espace Élève',
      sublabel:   'Mon dossier',
      roleFilter: ['ETUDIANT'] },

    { id: 'espace-parent',
      href:       '/dashboard/ecole/espace-parent',
      label:      'Espace Parent',
      sublabel:   'Suivi scolarité',
      roleFilter: ['PARENT'] },

    { id: 'ecole-miaa',
      href:       '/dashboard/miaa?context=ecole',
      label:      'MIAA+',
      sublabel:   'IA assistant école',
      roleFilter: ['DIRECTION_GENERALE', 'DAAC', 'FORMATEUR'] },

    // ─ À partir du Collège
    { id: 'ecole-rh',
      href:        '/dashboard/ecole/rh',
      label:       'RH & Personnel',
      sublabel:    'Enseignants & contrats',
      roleFilter:  ['DIRECTION_GENERALE', 'RH_PAIE'],
      minSousType: 'college' },

    { id: 'daac',
      href:        '/dashboard/ecole/daac',
      label:       'Affaires Académiques',
      sublabel:    'Examens & programmes',
      roleFilter:  ['DIRECTION_GENERALE', 'DAAC'],
      minSousType: 'college' },

    // ─ À partir du Lycée (Business)
    { id: 'ecole-comptabilite',
      href:        '/dashboard/ecole/comptabilite',
      label:       'Comptabilité',
      sublabel:    'Finances & OHADA',
      roleFilter:  ['DIRECTION_GENERALE', 'RAF'],
      minSousType: 'lycee' },

    // ─ Université uniquement (Entreprise+)
    { id: 'parametres-academiques',
      href:        '/dashboard/ecole/parametres-academiques',
      label:       'Paramètres LMD',
      sublabel:    'Parcours, diplômes & LMD',
      roleFilter:  ['DIRECTION_GENERALE', 'DAAC'],
      minSousType: 'universite' },
    { id: 'ecole-theses',
      href:        '/dashboard/ecole/theses',
      label:       'Thèses & Mémoires',
      sublabel:    'Sujets, directeurs & statuts',
      roleFilter:  ['DIRECTION_GENERALE', 'DAAC'],
      minSousType: 'universite' },
    { id: 'ecole-soutenances',
      href:        '/dashboard/ecole/soutenances',
      label:       'Soutenances',
      sublabel:    'Planning jury & délibérations',
      roleFilter:  ['DIRECTION_GENERALE', 'DAAC'],
      minSousType: 'universite' },
    { id: 'ecole-diplomes',
      href:        '/dashboard/ecole/diplomes',
      label:       'Diplômes & Attestations',
      sublabel:    'Émission & registres',
      roleFilter:  ['DIRECTION_GENERALE', 'DAAC', 'SCOLARITE'],
      minSousType: 'universite' },
  ],
  restaurant: [
    { id: 'resto-direction',    href: '/dashboard/restaurant/direction',    label: 'Direction',       sublabel: 'KPIs & rentabilité'      },
    { id: 'restaurant',         href: '/dashboard/restaurant',              label: 'Caisse POS',      sublabel: 'Commandes & service'     },
    { id: 'cuisine',            href: '/dashboard/restaurant/cuisine',      label: 'Cuisine',         sublabel: 'Préparation & suivi'     },
    { id: 'resto-reservations', href: '/dashboard/restaurant/reservations', label: 'Réservations',    sublabel: 'Tables & planning'       },
    { id: 'resto-livraisons',   href: '/dashboard/restaurant/livraisons',   label: 'Livraisons',      sublabel: 'Suivi livraisons'        },
    { id: 'resto-formules',     href: '/dashboard/restaurant/formules',     label: 'Formules',        sublabel: 'Menus & formules du jour' },
    { id: 'resto-inventaire',   href: '/dashboard/restaurant/inventaire',   label: 'Inventaire',      sublabel: 'Ingrédients & stocks'    },
    { id: 'resto-miaa',         href: '/dashboard/miaa?context=restaurant', label: 'MIAA+',            sublabel: 'IA & prévisions'        },
  ],
  sante: [
    { id: 'sante-direction',       href: '/dashboard/sante/direction',       label: 'Direction Médicale',  sublabel: 'KPIs & tableau de bord HIS'      },
    { id: 'sante',                 href: '/dashboard/sante',                 label: 'Clinique',            sublabel: 'Tableau de bord santé'           },
    { id: 'sante-patients',        href: '/dashboard/sante/patients',        label: 'Patients',            sublabel: 'Dossiers & antécédents'          },
    { id: 'sante-rdv',             href: '/dashboard/sante/rendez-vous',     label: 'Rendez-vous',         sublabel: 'Agenda & planification'          },
    { id: 'sante-consultations',   href: '/dashboard/sante/consultations',   label: 'Consultations',       sublabel: 'Actes médicaux & ordonnances'    },
    { id: 'sante-urgences',        href: '/dashboard/sante/urgences',        label: 'Urgences',            sublabel: 'Triage & soins urgents'          },
    { id: 'sante-hospitalisation', href: '/dashboard/sante/hospitalisation', label: 'Hospitalisation',     sublabel: 'Lits & séjours'                  },
    { id: 'sante-labo',            href: '/dashboard/sante/labo',            label: 'Laboratoire',         sublabel: 'Examens biologiques & résultats' },
    { id: 'sante-imagerie',        href: '/dashboard/sante/imagerie',        label: 'Imagerie Médicale',   sublabel: 'Radio, scanner & IRM'            },
    { id: 'sante-bloc',            href: '/dashboard/sante/bloc',            label: 'Bloc Opératoire',     sublabel: 'Interventions chirurgicales'     },
    { id: 'sante-pharmacie',       href: '/dashboard/sante/pharmacie',       label: 'Pharmacie',           sublabel: 'Stock médicaments & dispensations' },
    { id: 'sante-facturation',     href: '/dashboard/sante/facturation',     label: 'Facturation',         sublabel: 'Factures & paiements patients'   },
    { id: 'sante-assurances',      href: '/dashboard/sante/assurances',      label: 'Assurances',          sublabel: 'Dossiers & prises en charge'     },
    { id: 'sante-medecins',        href: '/dashboard/sante/medecins',        label: 'Médecins',            sublabel: 'Personnel médical'               },
    { id: 'sante-rh',              href: '/dashboard/sante/rh',              label: 'RH Médical',          sublabel: 'Personnel paramédical & gardes'  },
    { id: 'sante-miaa',            href: '/dashboard/miaa?context=sante',    label: 'MIAA+',               sublabel: 'IA assistant médical'            },
  ],
  pharmacie: [
    { id: 'pharmacie',           href: '/dashboard/pharmacie',            label: 'Pharmacie',       sublabel: 'Tableau de bord'           },
    { id: 'pharmacie-meds',     href: '/dashboard/pharmacie/medicaments',label: 'Médicaments',     sublabel: 'Stock & catalogue'         },
    { id: 'pharmacie-ventes',   href: '/dashboard/pharmacie/ventes',     label: 'Ventes / POS',    sublabel: 'Caisse & ordonnances'      },
  ],
  hotel: [
    { id: 'hotel',               href: '/dashboard/hotel',               label: 'Hébergement',    sublabel: 'Tableau de bord hôtel'        },
    { id: 'hotel-reservations',  href: '/dashboard/hotel/reservations',  label: 'Réservations',   sublabel: 'Check-in & check-out'         },
    { id: 'hotel-chambres',      href: '/dashboard/hotel/chambres',      label: 'Chambres',       sublabel: 'Inventaire & tarification'    },
    { id: 'housekeeping',        href: '/dashboard/hotel/housekeeping',  label: 'Housekeeping',   sublabel: 'Ménage & entretien'           },
    { id: 'hotel-maintenance',   href: '/dashboard/hotel/maintenance',   label: 'Maintenance',    sublabel: 'Pannes & interventions'       },
    { id: 'hotel-miaa',          href: '/dashboard/miaa?context=hotel',  label: 'MIAA+',          sublabel: 'IA assistant hôtelier'        },
  ],
  transport: [
    { id: 'transport',          href: '/dashboard/transport',             label: 'Courses & Flotte', sublabel: 'Véhicules & courses'    },
    { id: 'transport-flotte',   href: '/dashboard/transport/flotte',      label: 'Flotte',           sublabel: 'Véhicules & entretien'  },
    { id: 'transport-carburant',href: '/dashboard/transport/carburant',   label: 'Carburant',        sublabel: 'Consommation & dépenses'},
    { id: 'transport-analytique',href: '/dashboard/transport/analytiques',label: 'Analytiques',      sublabel: 'KPIs & rentabilité'     },
  ],
  transport_public: [
    { id: 'transport_public', href: '/dashboard/transport', label: 'Transport public', sublabel: 'Lignes & voyageurs' },
  ],
  btp: [
    { id: 'btp',             href: '/dashboard/btp',               label: 'Tableau de bord', sublabel: 'KPIs & chantiers BTP'     },
    { id: 'btp-devis',       href: '/dashboard/btp/devis',         label: 'Devis & AO',      sublabel: 'Devis & appels d\'offres' },
    { id: 'btp-chantiers',   href: '/dashboard/btp/chantiers',     label: 'Chantiers',       sublabel: 'Projets & budgets'        },
    { id: 'btp-avancement',  href: '/dashboard/btp/avancement',    label: 'Avancement',      sublabel: 'Phases & progression'     },
    { id: 'btp-materiaux',   href: '/dashboard/btp/materiaux',     label: 'Matériaux',       sublabel: 'Stock & équipements'      },
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
    { id: 'cabinet',                href: '/dashboard/cabinet',                label: 'Cabinet',          sublabel: 'Tableau de bord direction'  },
    { id: 'cabinet-clients',        href: '/dashboard/cabinet/clients',        label: 'Portefeuille',     sublabel: 'Clients & dossiers'         },
    { id: 'cabinet-declarations',   href: '/dashboard/cabinet/declarations',   label: 'Déclarations',     sublabel: 'Agenda fiscal & social'     },
    { id: 'cabinet-honoraires',     href: '/dashboard/cabinet/honoraires',     label: 'Honoraires',       sublabel: 'Facturation & encaissements'},
    { id: 'cabinet-conformite',     href: '/dashboard/cabinet/conformite',     label: 'Conformité',       sublabel: 'Checklists & compliance'    },
    { id: 'cabinet-analytiques',    href: '/dashboard/cabinet/analytiques',    label: 'Analytiques',      sublabel: 'KPIs & croissance'          },
    { id: 'cabinet-projets',        href: '/dashboard/cabinet/projets',        label: 'Missions',         sublabel: 'Projets & livrables'        },
    { id: 'cabinet-documents',      href: '/dashboard/ged',                    label: 'Documents',        sublabel: 'GED & dossiers clients'     },
    { id: 'cabinet-miaa',           href: '/dashboard/miaa?context=cabinet',   label: 'MIAA+ Expert',     sublabel: 'IA assistant cabinet'       },
  ],
  petrole: [
    { id: 'petrole',            href: '/dashboard/petrole',            label: 'Tableau de bord', sublabel: 'KPIs exploitation pétrolière'},
    { id: 'petrole-sites',      href: '/dashboard/petrole/sites',      label: 'Sites',           sublabel: 'Puits & sites d\'extraction' },
    { id: 'petrole-production', href: '/dashboard/petrole/production', label: 'Production',      sublabel: 'Rapports journaliers & bilans'},
  ],
  ong: [
    { id: 'ong',           href: '/dashboard/ong',           label: 'Tableau de bord', sublabel: 'KPIs associatif'            },
    { id: 'ong-projets',   href: '/dashboard/ong/projets',   label: 'Projets',         sublabel: 'Programmes & financement'   },
    { id: 'ong-bailleurs', href: '/dashboard/ong/bailleurs', label: 'Bailleurs',       sublabel: 'Donateurs & engagements'    },
    { id: 'ong-dons',      href: '/dashboard/ong/dons',      label: 'Dons',            sublabel: 'Collecte & affectation'     },
  ],
  commerce: [
    { id: 'commerce',         href: '/dashboard/commerce',            label: 'Point de Vente',  sublabel: 'Caisse & ventes'          },
    { id: 'commerce-catalogue',href: '/dashboard/commerce/catalogue', label: 'Catalogue',       sublabel: 'Produits & prix'          },
    { id: 'commerce-clients', href: '/dashboard/commerce/clients',    label: 'Clients',         sublabel: 'Fidélisation & historique'},
    { id: 'commerce-analytics',href: '/dashboard/commerce/analytics', label: 'Analytics',       sublabel: 'KPIs & performances'      },
  ],
  boisson: [
    { id: 'boisson',           href: '/dashboard/boisson',            label: 'Tableau de bord', sublabel: 'KPIs distribution boissons' },
    { id: 'boisson-tournees',  href: '/dashboard/boisson/tournees',   label: 'Tournées',        sublabel: 'Livraisons & chauffeurs'    },
    { id: 'boisson-commandes', href: '/dashboard/boisson/commandes',  label: 'Commandes',       sublabel: 'Commandes clients & suivi'  },
  ],
  assurance: [
    { id: 'assurance-direction',   href: '/dashboard/assurance',                  label: 'Direction Générale', sublabel: 'KPIs & portefeuille exécutif'   },
    { id: 'assurance-polices',     href: '/dashboard/assurance/polices',           label: 'Polices',            sublabel: 'Contrats, renouvellements & résiliations' },
    { id: 'assurance-sinistres',   href: '/dashboard/assurance/sinistres',         label: 'Sinistres',          sublabel: 'Déclarations, expertise & règlements'     },
    { id: 'assurance-clients',     href: '/dashboard/assurance/clients',           label: 'Clients & Assurés',  sublabel: 'Portefeuille & historique'      },
    { id: 'assurance-produits',    href: '/dashboard/assurance/produits',          label: 'Produits',           sublabel: 'Catalogue & tarification'       },
    { id: 'assurance-partenaires', href: '/dashboard/assurance/partenaires',       label: 'Partenaires',        sublabel: 'Réassureurs, garages & experts' },
    { id: 'assurance-commissions', href: '/dashboard/assurance/commissions',       label: 'Commissions',        sublabel: 'Agents, courtiers & paiements'  },
    { id: 'assurance-analytics',   href: '/dashboard/assurance/analytics',         label: 'Analytics',          sublabel: 'Ratio sinistres, rentabilité'   },
    { id: 'assurance-miaa',        href: '/dashboard/miaa?context=assurance',      label: 'MIAA+ Expert',       sublabel: 'IA assistant assurance'         },
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
  { id: 'audit',         href: '/dashboard/audit',          label: 'Audit & Conformité OHADA', sublabel: 'Scores · Anomalies · Plans' },
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
  assurance:        'Assurance & Réassurance',
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

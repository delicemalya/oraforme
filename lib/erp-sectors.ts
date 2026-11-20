/**
 * erp-sectors.ts — Configuration universelle ERP multi-secteurs Oraforme
 *
 * Architecture 3 couches (inspirée d'Odoo / SAP) :
 *  COUCHE 1 — Core ERP Universal  : identique pour TOUS les secteurs
 *  COUCHE 2 — Secteur Métier       : spécificités propres à chaque secteur
 *  COUCHE 3 — Plateforme           : outils transverses toujours en bas
 */

// Refonte 2026-11 — périmètre de 8 secteurs (décision fondateur + partenaires).
// Secteurs retirés : restaurant, supermarche, boisson, transport, transport_public,
// btp, petrole, ong, banque, pharmacie, agriculture, assurance.
// Secteur ajouté : garage (migration 189).
export const SECTOR_IDS = [
  'entreprise', 'ecole', 'commerce', 'cabinet', 'sante', 'hotel', 'garage', 'recrutement',
] as const

export type SectorId = typeof SECTOR_IDS[number]

const SECTOR_ID_SET = new Set<string>(SECTOR_IDS)

export function isSectorId(value: unknown): value is SectorId {
  return typeof value === 'string' && SECTOR_ID_SET.has(value)
}

/**
 * Valeurs historiques de tenants.secteur_activite → secteur actuel.
 * - 'autre' devient 'entreprise' (renommage).
 * - 'supermarche' / 'boutique' rejoignent 'commerce' (la grande distribution
 *   est désormais un sous-type de commerce).
 * - Les secteurs retirés retombent sur 'entreprise' : le tenant garde tout le
 *   socle ERP (RH, compta, stocks, facturation…), seuls les modules métier
 *   supprimés disparaissent. Aucune donnée n'est effacée.
 */
const LEGACY_SECTOR_MAP: Record<string, SectorId> = {
  autre:            'entreprise',
  supermarche:      'commerce',
  boutique:         'commerce',
  restaurant:       'entreprise',
  boisson:          'entreprise',
  transport:        'entreprise',
  transport_public: 'entreprise',
  btp:              'entreprise',
  petrole:          'entreprise',
  ong:              'entreprise',
  banque:           'entreprise',
  pharmacie:        'entreprise',
  agriculture:      'entreprise',
  assurance:        'entreprise',
}

/** Normalise une valeur brute de tenants.secteur_activite (null si vide). */
export function normalizeSecteur(raw: string | null | undefined): SectorId | null {
  if (!raw) return null
  if (isSectorId(raw)) return raw
  return LEGACY_SECTOR_MAP[raw] ?? 'entreprise'
}

// ── COUCHE 1 : Core ERP ───────────────────────────────────────────────────────
// Ces 10 modules apparaissent dans TOUTES les sidebars, tous secteurs confondus.

export const CORE_ERP_MODULES = [
  { id: 'direction',    href: '/dashboard',              label: 'Direction Générale',  sublabel: 'Pilotage & KPIs'          },
  { id: 'rh',           href: '/dashboard/rh',           label: 'RH & Paie',           sublabel: 'Personnel & salaires'     },
  { id: 'finance',      href: '/dashboard/finance',      label: 'Finance',             sublabel: 'KPIs & résultats'         },
  { id: 'comptabilite', href: '/dashboard/comptabilite', label: 'Comptabilité',        sublabel: 'Journal OHADA'            },
  { id: 'tresorerie',   href: '/dashboard/tresorerie',   label: 'Trésorerie',          sublabel: 'Caisse, banque, wallets'  },
  { id: 'stock',        href: '/dashboard/stocks',       label: 'Stock & Inventaire',  sublabel: 'Gestion des stocks'       },
  { id: 'achats',       href: '/dashboard/stocks/achats', label: 'Achats',              sublabel: 'Commandes & fournisseurs' },
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
  roleFilter?: string[]         // Visibilité par rôle école
  minSousType?: EcoleSousType   // Sous-type minimum requis (pour l'école)
  onlyCabinetTypes?: string[]   // Restreint à certains types de cabinet
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

    // ─ À partir du Lycée
    { id: 'ecole-comptabilite',
      href:        '/dashboard/ecole/comptabilite',
      label:       'Comptabilité',
      sublabel:    'Finances & OHADA',
      roleFilter:  ['DIRECTION_GENERALE', 'RAF'],
      minSousType: 'lycee' },

    { id: 'ecole-series',
      href:        '/dashboard/ecole/series',
      label:       'Séries & Options',
      sublabel:    'Séries, coefficients & baccalauréat',
      roleFilter:  ['DIRECTION_GENERALE', 'SCOLARITE', 'DAAC'],
      minSousType: 'lycee' },

    // ─ Université uniquement
    { id: 'ecole-ue',
      href:        '/dashboard/ecole/unites-enseignement',
      label:       'Unités d\'Enseignement',
      sublabel:    'UE, crédits ECTS & parcours LMD',
      roleFilter:  ['DIRECTION_GENERALE', 'DAAC'],
      minSousType: 'universite' },

    { id: 'ecole-semestres',
      href:        '/dashboard/ecole/semestres',
      label:       'Semestres & Délibérations',
      sublabel:    'Validation semestres, mentions, jurys',
      roleFilter:  ['DIRECTION_GENERALE', 'DAAC'],
      minSousType: 'universite' },

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

    { id: 'ecole-annees-academiques',
      href:        '/dashboard/ecole/annees-academiques',
      label:       'Années Académiques',
      sublabel:    'Sessions, calendrier & statuts',
      roleFilter:  ['DIRECTION_GENERALE', 'DAAC'],
      minSousType: 'universite' },

    { id: 'ecole-deliberations',
      href:        '/dashboard/ecole/deliberations',
      label:       'Délibérations',
      sublabel:    'Résultats annuels, admis & ajournés',
      roleFilter:  ['DIRECTION_GENERALE', 'DAAC'],
      minSousType: 'universite' },

    { id: 'ecole-facultes',
      href:        '/dashboard/ecole/facultes',
      label:       'Facultés',
      sublabel:    'UFR, instituts & écoles',
      roleFilter:  ['DIRECTION_GENERALE', 'DAAC'],
      minSousType: 'universite' },

    { id: 'ecole-departements',
      href:        '/dashboard/ecole/departements',
      label:       'Départements',
      sublabel:    'Départements académiques & responsables',
      roleFilter:  ['DIRECTION_GENERALE', 'DAAC'],
      minSousType: 'universite' },

    { id: 'ecole-parcours',
      href:        '/dashboard/ecole/parcours',
      label:       'Parcours & Programmes',
      sublabel:    'Licences, Masters, Doctorats',
      roleFilter:  ['DIRECTION_GENERALE', 'DAAC'],
      minSousType: 'universite' },
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
  hotel: [
    { id: 'hotel',               href: '/dashboard/hotel',               label: 'Hébergement',    sublabel: 'Tableau de bord hôtel'        },
    { id: 'hotel-reservations',  href: '/dashboard/hotel/reservations',  label: 'Réservations',   sublabel: 'Check-in & check-out'         },
    { id: 'hotel-chambres',      href: '/dashboard/hotel/chambres',      label: 'Chambres',       sublabel: 'Inventaire & tarification'    },
    { id: 'housekeeping',        href: '/dashboard/hotel/housekeeping',  label: 'Housekeeping',   sublabel: 'Ménage & entretien'           },
    { id: 'hotel-maintenance',   href: '/dashboard/hotel/maintenance',   label: 'Maintenance',    sublabel: 'Pannes & interventions'       },
    { id: 'hotel-miaa',          href: '/dashboard/miaa?context=hotel',  label: 'MIAA+',          sublabel: 'IA assistant hôtelier'        },
  ],
  garage: [
    { id: 'garage',            href: '/dashboard/garage',           label: 'Atelier',      sublabel: 'Ordres de réparation'      },
    { id: 'garage-vehicules',  href: '/dashboard/garage/vehicules', label: 'Véhicules',    sublabel: 'Parc clients & historique' },
    { id: 'garage-pieces',     href: '/dashboard/stocks/produits',  label: 'Pièces',       sublabel: 'Stock de pièces détachées' },
    { id: 'garage-factures',   href: '/dashboard/facturation',      label: 'Facturation',  sublabel: 'Factures & encaissements'  },
  ],
  cabinet: [
    { id: 'cabinet',              href: '/dashboard/cabinet',            label: 'Cabinet',       sublabel: 'Tableau de bord direction'   },
    { id: 'cabinet-clients',      href: '/dashboard/cabinet/clients',      label: 'Portefeuille',  sublabel: 'Clients & dossiers'          },
    // Agenda fiscal — uniquement comptable & fiscal
    { id: 'cabinet-declarations', href: '/dashboard/cabinet/declarations', label: 'Déclarations',  sublabel: 'Agenda fiscal & social',
      onlyCabinetTypes: ['comptable', 'fiscal'] },
    // Affaires judiciaires — uniquement juridique & avocat
    { id: 'cabinet-affaires',     href: '/dashboard/cabinet/affaires',     label: 'Affaires',      sublabel: 'Dossiers & procédures',
      onlyCabinetTypes: ['juridique', 'avocat'] },
    { id: 'cabinet-honoraires',   href: '/dashboard/cabinet/honoraires',   label: 'Honoraires',    sublabel: 'Facturation & encaissements' },
    // Conformité OHADA/légale — comptable, fiscal, audit
    { id: 'cabinet-conformite',   href: '/dashboard/cabinet/conformite',   label: 'Conformité',    sublabel: 'Checklists & compliance',
      onlyCabinetTypes: ['comptable', 'fiscal', 'audit'] },
    { id: 'cabinet-analytiques',  href: '/dashboard/cabinet/analytiques',  label: 'Analytiques',   sublabel: 'KPIs & croissance'           },
    { id: 'cabinet-projets',      href: '/dashboard/cabinet/projets',      label: 'Missions',      sublabel: 'Projets & livrables'         },
    { id: 'cabinet-documents',    href: '/dashboard/ged',                  label: 'Documents',     sublabel: 'GED & dossiers clients'      },
    { id: 'cabinet-miaa',         href: '/dashboard/miaa?context=cabinet', label: 'MIAA+ Expert',  sublabel: 'IA assistant cabinet'        },
  ],
  commerce: [
    { id: 'commerce',         href: '/dashboard/commerce',            label: 'Point de Vente',  sublabel: 'Caisse & ventes'          },
    { id: 'commerce-catalogue',href: '/dashboard/commerce/catalogue', label: 'Catalogue',       sublabel: 'Produits & prix'          },
    { id: 'commerce-clients', href: '/dashboard/commerce/clients',    label: 'Clients',         sublabel: 'Fidélisation & historique'},
    { id: 'commerce-analytics',href: '/dashboard/commerce/analytics', label: 'Analytics',       sublabel: 'KPIs & performances'      },
  ],
  recrutement: [
    { id: 'recrutement-direction',    href: '/dashboard/recrutement',                  label: 'Direction RH',      sublabel: 'KPIs & tableau de bord RH'          },
    { id: 'recrutement-offres',       href: '/dashboard/recrutement/offres',           label: "Offres d'emploi",   sublabel: 'Postes ouverts & diffusion'         },
    { id: 'recrutement-ats',          href: '/dashboard/recrutement/ats',              label: 'ATS Pipeline',      sublabel: 'Kanban recrutement complet'          },
    { id: 'recrutement-candidatures', href: '/dashboard/recrutement/candidatures',     label: 'Candidatures',      sublabel: 'Pipeline & scoring IA'              },
    { id: 'recrutement-entretiens',   href: '/dashboard/recrutement/entretiens',       label: 'Entretiens',        sublabel: 'Planning & évaluations'             },
    { id: 'recrutement-cvtheque',     href: '/dashboard/recrutement/cvtheque',         label: 'CV-thèque',         sublabel: 'Vivier de talents'                  },
    { id: 'recrutement-placement',    href: '/dashboard/recrutement/placement',        label: 'Placements',        sublabel: 'Missions & contrats placés'         },
    { id: 'recrutement-mad',          href: '/dashboard/recrutement/mad',              label: 'Mise à disposition', sublabel: 'Secondment & gestion RH externalisée' },
    { id: 'recrutement-contrats',     href: '/dashboard/recrutement/contrats',         label: 'Contrats',          sublabel: 'CDI, CDD, intérim & stage'          },
    { id: 'recrutement-partenaires',  href: '/dashboard/recrutement/partenaires',      label: 'Partenaires',       sublabel: 'Clients entreprises & prestataires' },
    { id: 'recrutement-analytics',    href: '/dashboard/recrutement/analytics',        label: 'Analytics RH',     sublabel: 'KPIs & performance recrutement'     },
    { id: 'recrutement-miaa',         href: '/dashboard/recrutement/miaa',             label: 'MIAA+ RH Expert',   sublabel: 'IA RH : CV, contrats, risques, plans' },
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

export const SECTOR_LABELS: Record<SectorId, string> = {
  entreprise:  'Entreprise & PME',
  ecole:       'École & Université',
  commerce:    'Commerce & Boutique',
  cabinet:     'Cabinet & Conseil',
  sante:       'Santé & Clinique',
  hotel:       'Hôtellerie',
  garage:      'Garage & Atelier auto',
  recrutement: 'Recrutement & Placement RH',
}

/** Libellé lisible d'une valeur brute (historique ou actuelle) de secteur. */
export function sectorLabel(raw: string | null | undefined): string {
  const id = normalizeSecteur(raw)
  return id ? SECTOR_LABELS[id] : ''
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

/**
 * Rôle école effectif — même règle que fn_get_my_ecole_role() (migration 034)
 * et que le proxy : le propriétaire du compte est la Direction Générale.
 * Sans cette règle, un propriétaire d'école (ecole_role_name vide, jamais
 * renseigné à l'inscription) perdait toute la partie administration du menu
 * (Direction, RH, Finance, Comptabilité, Trésorerie, Facturation…).
 */
export function roleEcoleEffectif(
  role: string | null | undefined,
  ecoleRoleName: string | null | undefined,
): string | null {
  if (role === 'owner') return 'DIRECTION_GENERALE'
  return ecoleRoleName ?? null
}

// ── Set d'IDs core pour le check rapide ───────────────────────────────────────

export const CORE_IDS = new Set(CORE_ERP_MODULES.map(m => m.id))
export const PLATFORM_IDS = new Set(PLATFORM_MODULES.map(m => m.id))

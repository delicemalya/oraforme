'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { logAuthClient } from '@/lib/identity/log-client'
import { useTenantContext } from '@/lib/contexts/TenantContext'
import {
  LayoutDashboard, FileText, Package, Users,
  ChefHat, GraduationCap, Hotel, Bot,
  LogOut, Menu, X, Lock, Globe,
  Settings, ShieldAlert, ShieldCheck, Store,
  Wallet, BookOpen, ShoppingCart,
  Receipt, BarChart2, Truck,
  BookMarked, Calculator, HeartHandshake, UsersRound,
  Layers, Activity, TrendingUp,
  Bell, FolderOpen, Building2,
  ChevronDown, Calendar, CheckSquare,
  Heart, Pill, Sparkles, Stethoscope, UserRound, CalendarClock,
  CreditCard, LineChart, Zap, Landmark, Briefcase, ClipboardList,
  DollarSign, FlaskConical, Shield, Siren, BedDouble,
  Mail, Share2, Kanban, UserCog,
} from 'lucide-react'
import {
  CORE_ERP_MODULES,
  SECTOR_SPECIFIC,
  PLATFORM_MODULES,
  SECTOR_LABELS,
  ECOLE_CORE_ROLE_FILTER,
  ECOLE_NIVEAU,
  type SectorId,
  type EcoleSousType,
} from '@/lib/erp-sectors'
import { canAccessByPlan, getRequiredPlan } from '@/lib/plan-access'
import { useState, useEffect, useMemo, useCallback } from 'react'
import type { LucideIcon } from 'lucide-react'
import type { ModulePermission } from '@/lib/hooks/usePermissions'
import { useLocale } from '@/lib/hooks/useLocale'

// ─── Types ────────────────────────────────────────────────────────────────────

type NavItem = {
  id:       string
  label:    string
  icon:     LucideIcon
  href:     string
  exact?:   boolean
  locked?:  'pme' | 'grande'   // set when blocked by plan
}

type NavGroup = {
  id:       string
  label:    string
  icon:     LucideIcon
  items:    NavItem[]
}

// ─── Icon Registry ────────────────────────────────────────────────────────────

const ICONS: Record<string, LucideIcon> = {
  'bi':              LineChart,
  'bi-dg':           LineChart,
  'bi-rh':           Users,
  'bi-ecole':        GraduationCap,
  'bi-hotel':        Hotel,
  'bi-restaurant':   ChefHat,
  direction:     BarChart2,
  finance:       TrendingUp,
  analytics:     Activity,
  audit:              ShieldAlert,
  'audit-comptable':  Calculator,
  'audit-financier':  TrendingUp,
  'audit-fiscal':     Landmark,
  'audit-rh':         Users,
  'audit-ci':         Lock,
  'audit-risques':    BarChart2,
  'audit-ohada':      ShieldCheck,
  'audit-plans':      CheckSquare,
  'audit-rapports':   FileText,
  notifications: Bell,
  comptabilite:  Calculator,
  tresorerie:    Wallet,
  facturation:   FileText,
  depenses:      Receipt,
  rh:                  Users,
  salaires:            Receipt,
  'declarations-cnss': BookMarked,
  roles:               ShieldCheck,
  crm:           UsersRound,
  recouvrement:  ClipboardList,
  stock:         Package,
  achats:        ShoppingCart,
  ged:           FolderOpen,
  bizbot:        Bot,
  academy:       GraduationCap,
  calendrier:    Calendar,
  taches:        CheckSquare,
  profil:        Building2,
  parametres:    Settings,
  'ecole-direction':        BarChart2,
  'ecole-rh':               Users,
  'ecole-comptabilite':     Calculator,
  'ecole-miaa':             Bot,
  'ecole-series':           Layers,
  'ecole-ue':               BookOpen,
  'ecole-semestres':        CalendarClock,
  'ecole-theses':           BookOpen,
  'ecole-soutenances':      CalendarClock,
  'ecole-diplomes':         GraduationCap,
  'ecole-annees-academiques': CalendarClock,
  'ecole-deliberations':    CheckSquare,
  'ecole-facultes':         Building2,
  'ecole-departements':     UsersRound,
  'ecole-parcours':         FolderOpen,
  scolarite:                BookMarked,
  daac:                     Layers,
  'espace-formateur':       BookOpen,
  'espace-etudiant':        GraduationCap,
  'espace-parent':          HeartHandshake,
  'parametres-academiques': Settings,
  restaurant:   ChefHat,
  cuisine:      ChefHat,
  hotel:        Hotel,
  housekeeping: Sparkles,
  transport:    Truck,
  ecole:        GraduationCap,
  sante:               Heart,
  'sante-patients':    UserRound,
  'sante-rdv':         CalendarClock,
  'sante-consultations': Stethoscope,
  'sante-medecins':    Activity,
  'sante-pharmacie':   Pill,
  'sante-urgences':    Siren,
  'sante-labo':        FlaskConical,
  'sante-imagerie':    Activity,
  'sante-bloc':        Activity,
  'sante-facturation': FileText,
  'sante-assurances':  Shield,
  'sante-rh':          UsersRound,
  'sante-direction':   LayoutDashboard,
  'sante-miaa':        Sparkles,
  'sante-hospitalisation': BedDouble,
  // ── Assurance ──────────────────────────────────────────────────────────────
  'assurance-direction':   LayoutDashboard,
  'assurance-polices':     FileText,
  'assurance-sinistres':   ShieldAlert,
  'assurance-clients':     Users,
  'assurance-produits':    Package,
  'assurance-partenaires': Building2,
  'assurance-commissions': DollarSign,
  'assurance-analytics':   BarChart2,
  'assurance-miaa':        Sparkles,
  pharmacie:           Pill,
  'pharmacie-meds':    Package,
  'pharmacie-ventes':  ShoppingCart,
  abonnement:          CreditCard,
  fiscalite:           Landmark,
  'cnss-congo':        BookMarked,
  btp:                 Building2,
  'btp-devis':         FileText,
  'btp-chantiers':     Layers,
  'btp-materiaux':     Package,
  recrutement:         Briefcase,
  banque:              Landmark,
  'banque-clients':    Users,
  'banque-credits':    CreditCard,
  'banque-epargne':    Wallet,
  'banque-operations': TrendingUp,
  agriculture:         Layers,
  'agriculture-parcelles': Layers,
  'agriculture-recoltes':  Package,
  'agriculture-intrants':  ShoppingCart,
  cabinet:              Building2,
  'cabinet-clients':    Users,
  'cabinet-documents':  FileText,
  'cabinet-taches':     CheckSquare,
  'cabinet-revenue':    DollarSign,
  'cabinet-projets':    FolderOpen,
  petrole:             Zap,
  'petrole-sites':     Activity,
  ong:                 HeartHandshake,
  'ong-projets':       Layers,
  'ong-dons':          Heart,
  boisson:             Package,
  'boisson-tournees':  Truck,
  // MIAA+ Agent sous-modules
  'miaa-agent':     Zap,
  'miaa-rapports':  FileText,
  'miaa-expertise': Sparkles,
  // Compagnie — communication
  'email-management': Mail,
  'social-media':     Share2,
  // Recrutement & Placement RH
  'recrutement-direction':    BarChart2,
  'recrutement-offres':       Briefcase,
  'recrutement-ats':          Kanban,
  'recrutement-candidatures': Users,
  'recrutement-entretiens':   CalendarClock,
  'recrutement-cvtheque':     FolderOpen,
  'recrutement-placement':    CheckSquare,
  'recrutement-mad':          UserCog,
  'recrutement-contrats':     FileText,
  'recrutement-partenaires':  Building2,
  'recrutement-analytics':    TrendingUp,
  'recrutement-miaa':         Sparkles,
}

// ─── Module Registry ──────────────────────────────────────────────────────────

type ModuleDef = { id: string; label: string; sublabel: string; href: string }

const MODULE_DEFS: ModuleDef[] = [
  // RH — sous-modules
  { id: 'recrutement', label: 'Recrutement', sublabel: 'MIAA Job', href: '/dashboard/rh/recrutement' },
  { id: 'salaires', label: 'Paie & Bulletins', sublabel: 'ECAM Congo', href: '/dashboard/rh/paie' },
  { id: 'bi',          label: 'Analytics',              sublabel: '', href: '/dashboard/bi' },
  { id: 'bi-dg',       label: 'Analytics & BI',         sublabel: 'Direction · RH · Secteur', href: '/dashboard/bi' },
  { id: 'bi-rh',       label: 'Analytics RH',           sublabel: '', href: '/dashboard/bi/rh' },
  { id: 'bi-ecole',    label: 'Analytics École',        sublabel: '', href: '/dashboard/bi/ecole' },
  { id: 'bi-hotel',    label: 'Analytics Hôtel',        sublabel: '', href: '/dashboard/bi/hotel' },
  { id: 'bi-restaurant', label: 'Analytics Restaurant', sublabel: '', href: '/dashboard/bi/restaurant' },
  ...(CORE_ERP_MODULES as unknown as ModuleDef[]),
  ...(PLATFORM_MODULES as unknown as ModuleDef[]),
  { id: 'ecole',                 label: 'École & Université',   sublabel: '', href: '/dashboard/ecole'                      },
  { id: 'ecole-series',         label: 'Séries & Options',      sublabel: '', href: '/dashboard/ecole/series'                },
  { id: 'ecole-ue',             label: "Unités d'Enseignement", sublabel: '', href: '/dashboard/ecole/unites-enseignement'   },
  { id: 'ecole-semestres',      label: 'Semestres & Délibérations', sublabel: '', href: '/dashboard/ecole/semestres'         },
  { id: 'ecole-annees-academiques', label: 'Années Académiques',  sublabel: '', href: '/dashboard/ecole/annees-academiques' },
  { id: 'ecole-deliberations',     label: 'Délibérations',        sublabel: '', href: '/dashboard/ecole/deliberations'       },
  { id: 'ecole-facultes',       label: 'Facultés',                  sublabel: '', href: '/dashboard/ecole/facultes'            },
  { id: 'ecole-departements',   label: 'Départements',              sublabel: '', href: '/dashboard/ecole/departements'        },
  { id: 'ecole-parcours',       label: 'Parcours & Programmes',     sublabel: '', href: '/dashboard/ecole/parcours'            },
  { id: 'restaurant',            label: 'Restauration POS',     sublabel: '', href: '/dashboard/restaurant'                 },
  { id: 'hotel',                 label: 'Hôtellerie',           sublabel: '', href: '/dashboard/hotel'                      },
  { id: 'housekeeping',          label: 'Housekeeping',         sublabel: '', href: '/dashboard/hotel/housekeeping'         },
  { id: 'transport',             label: 'Transport VTC',        sublabel: '', href: '/dashboard/transport'                  },
  { id: 'sante',                 label: 'Clinique',             sublabel: '', href: '/dashboard/sante'                      },
  { id: 'sante-patients',        label: 'Patients',             sublabel: '', href: '/dashboard/sante/patients'             },
  { id: 'sante-rdv',             label: 'Rendez-vous',          sublabel: '', href: '/dashboard/sante/rendez-vous'          },
  { id: 'sante-consultations',   label: 'Consultations',        sublabel: '', href: '/dashboard/sante/consultations'        },
  { id: 'sante-medecins',        label: 'Médecins',             sublabel: '', href: '/dashboard/sante/medecins'             },
  { id: 'pharmacie',             label: 'Pharmacie',            sublabel: '', href: '/dashboard/pharmacie'                  },
  { id: 'pharmacie-meds',        label: 'Médicaments',          sublabel: '', href: '/dashboard/pharmacie/medicaments'      },
  { id: 'pharmacie-ventes',      label: 'Ventes / POS',         sublabel: '', href: '/dashboard/pharmacie/ventes'           },
  { id: 'abonnement',            label: 'Abonnement',           sublabel: '', href: '/dashboard/abonnement'                 },
  { id: 'workflows',             label: 'Workflows',            sublabel: '', href: '/dashboard/workflows'                  },
  { id: 'api-keys',              label: 'Clés API',             sublabel: '', href: '/dashboard/api-keys'                   },
  { id: 'fiscalite',     label: 'Fiscalité & Déclarations', sublabel: '', href: '/dashboard/fiscalite'     },
  { id: 'cnss-congo',   label: 'CNSS Congo',               sublabel: 'Télédéclaration', href: '/dashboard/declarations/cnss' },
  { id: 'recouvrement',     label: 'Recouvrement',              sublabel: '', href: '/dashboard/recouvrement'           },
  { id: 'audit-comptable',  label: 'Audit Comptable',           sublabel: '', href: '/dashboard/audit/comptable'       },
  { id: 'audit-financier',  label: 'Audit Financier',           sublabel: '', href: '/dashboard/audit/financier'       },
  { id: 'audit-fiscal',     label: 'Audit Fiscal',              sublabel: '', href: '/dashboard/audit/fiscal'          },
  { id: 'audit-rh',         label: 'Audit RH & Social',         sublabel: '', href: '/dashboard/audit/rh'             },
  { id: 'audit-ci',         label: 'Contrôle Interne',          sublabel: '', href: '/dashboard/audit/controle-interne' },
  { id: 'audit-risques',    label: 'Gestion des Risques',       sublabel: '', href: '/dashboard/audit/risques'        },
  { id: 'audit-ohada',      label: 'Conformité OHADA',          sublabel: '', href: '/dashboard/audit/ohada'          },
  { id: 'audit-plans',      label: "Plans d'Actions",           sublabel: '', href: '/dashboard/audit/plans-actions'  },
  { id: 'audit-rapports',   label: 'Rapports d\'Audit',         sublabel: '', href: '/dashboard/audit/rapports'       },
  { id: 'academy', label: 'MIAA+ Academy', sublabel: 'Université intelligente', href: '/dashboard/academy' },
  { id: 'email-management', label: 'Gestion Emails',    sublabel: 'Compagnie', href: '/dashboard/email-management' },
  { id: 'social-media',     label: 'Réseaux Sociaux',   sublabel: 'Compagnie', href: '/dashboard/social-media' },
  // MIAA+ sous-modules (bizbot = entrée principale → /dashboard/miaa)
  { id: 'miaa-agent',     label: 'Agent Autonome',        sublabel: 'Centre de Commandement',  href: '/dashboard/miaa/agent'     },
  { id: 'miaa-rapports',  label: 'Rapports IA',            sublabel: 'Générés par MIAA+',       href: '/dashboard/miaa/rapports'  },
  { id: 'miaa-expertise', label: 'Expertise & Documents',  sublabel: 'Marketplace 82 modèles', href: '/dashboard/miaa/expertise' },
  // Recrutement & Placement RH — secteur métier
  { id: 'recrutement-direction',    label: 'Direction RH',       sublabel: 'KPIs & tableau de bord',    href: '/dashboard/recrutement'                  },
  { id: 'recrutement-offres',       label: "Offres d'emploi",    sublabel: 'Postes ouverts & diffusion', href: '/dashboard/recrutement/offres'           },
  { id: 'recrutement-ats',          label: 'ATS Pipeline',       sublabel: 'Kanban recrutement complet', href: '/dashboard/recrutement/ats'              },
  { id: 'recrutement-candidatures', label: 'Candidatures',       sublabel: 'Pipeline & scoring IA',     href: '/dashboard/recrutement/candidatures'     },
  { id: 'recrutement-entretiens',   label: 'Entretiens',         sublabel: 'Planning & évaluations',    href: '/dashboard/recrutement/entretiens'       },
  { id: 'recrutement-cvtheque',     label: 'CV-thèque',          sublabel: 'Vivier de talents',         href: '/dashboard/recrutement/cvtheque'         },
  { id: 'recrutement-placement',    label: 'Placements',         sublabel: 'Missions & contrats placés',href: '/dashboard/recrutement/placement'        },
  { id: 'recrutement-mad',          label: 'Mise à disposition', sublabel: 'Secondment RH externalisé', href: '/dashboard/recrutement/mad'              },
  { id: 'recrutement-contrats',     label: 'Contrats',           sublabel: 'CDI, CDD, intérim & stage', href: '/dashboard/recrutement/contrats'         },
  { id: 'recrutement-partenaires',  label: 'Partenaires',        sublabel: 'Clients entreprises',       href: '/dashboard/recrutement/partenaires'      },
  { id: 'recrutement-analytics',    label: 'Analytics RH',      sublabel: 'KPIs & performance',        href: '/dashboard/recrutement/analytics'        },
  { id: 'recrutement-miaa',         label: 'MIAA+ RH Expert',    sublabel: 'IA RH : CV, contrats, risques', href: '/dashboard/recrutement/miaa'         },
]

const getModuleDef = (id: string) => MODULE_DEFS.find(m => m.id === id)

// ─── Sidebar Group definitions ────────────────────────────────────────────────

const SIDEBAR_GROUPS = [
  // SUPERVISION — KPIs exécutifs + hub BI (onglets Direction/RH/secteur intégrés)
  { id: 'supervision', labelKey: 'nav.pilotage',    icon: TrendingUp,  moduleIds: ['finance', 'bi-dg', 'audit'] },
  // FINANCE — comptabilité, trésorerie, charges, fiscalité
  { id: 'finance',     labelKey: 'nav.finance_ops', icon: Calculator,  moduleIds: ['comptabilite', 'tresorerie', 'depenses', 'fiscalite'] },
  // RH — personnel & paie (recrutement = rubrique indépendante)
  { id: 'rh',          labelKey: 'nav.rh',          icon: Users,       moduleIds: ['rh', 'salaires', 'roles'] },
  // RECRUTEMENT — module autonome
  { id: 'recrutement_section', labelKey: 'nav.recrutement', icon: Briefcase, moduleIds: ['recrutement'] },
  // COMMERCIAL — clients, ventes, recouvrement, stock, achats
  { id: 'commercial',  labelKey: 'nav.commercial',  icon: Store,       moduleIds: ['crm', 'facturation', 'recouvrement', 'stock', 'achats'] },
  // OUTILS — IA & productivité
  { id: 'outils',      labelKey: 'nav.outils',      icon: FolderOpen,  moduleIds: ['ged', 'bizbot', 'academy', 'taches'] },
  // AUDIT & CONFORMITÉ OHADA
  { id: 'audit_group', labelKey: 'nav.audit',       icon: ShieldAlert, moduleIds: ['audit-comptable', 'audit-financier', 'audit-fiscal', 'audit-rh', 'audit-ci', 'audit-risques', 'audit-ohada', 'audit-plans', 'audit-rapports'] },
  // COMMUNICATION — email & réseaux sociaux (Compagnie uniquement)
  { id: 'communication', labelKey: 'nav.communication', icon: Mail, moduleIds: ['email-management', 'social-media'] },
  // ADMIN — abonnement, automatisation, API
  { id: 'params',      labelKey: 'nav.params',      icon: Settings,    moduleIds: ['abonnement', 'workflows', 'api-keys'] },
]

const MODULE_LABEL_KEYS: Record<string, string> = {
  'bi-dg':         'nav.bi_dg',
  'bi-rh':         'nav.bi_rh',
  'bi-ecole':      'nav.bi_ecole',
  'bi-hotel':      'nav.bi_hotel',
  'bi-restaurant': 'nav.bi_restaurant',
  direction:       'nav.direction',
  finance:         'nav.finance',
  analytics:    'nav.analytics',
  audit:        'nav.audit',
  notifications:'nav.notifications',
  comptabilite: 'nav.comptabilite',
  tresorerie:   'nav.tresorerie',
  facturation:  'nav.facturation',
  depenses:     'nav.depenses',
  rh:                  'nav.rh',
  salaires:            'nav.salaires',
  'declarations-cnss': 'nav.declarations_cnss',
  roles:               'nav.roles',
  crm:          'nav.crm',
  stock:        'nav.stock',
  achats:       'nav.achats',
  ged:          'nav.ged',
  bizbot:       'nav.bizbot',
  academy:      'nav.academy',
  calendrier:   'nav.calendrier',
  taches:       'nav.taches',
  profil:       'nav.profil',
  parametres:   'nav.parametres',
  ecole:        'nav.ecole',
  restaurant:   'nav.restaurant',
  hotel:        'nav.hotel',
  housekeeping: 'nav.housekeeping',
  transport:    'nav.transport',
  workflows:    'nav.workflows',
  'api-keys':   'nav.api_keys',
  sante:               'nav.sante',
  'sante-patients':    'nav.sante_patients',
  'sante-rdv':         'nav.sante_rdv',
  'sante-consultations': 'nav.sante_consultations',
  'sante-medecins':    'nav.sante_medecins',
  pharmacie:           'nav.pharmacie',
  'pharmacie-meds':    'nav.pharmacie_meds',
  'pharmacie-ventes':  'nav.pharmacie_ventes',
  abonnement:          'nav.abonnement',
  fiscalite:           'nav.fiscalite',
  'cnss-congo':        'nav.cnss_congo',
  // Secteurs métier

  btp:                     'nav.btp',
  'btp-devis':             'nav.btp_devis',
  'btp-chantiers':         'nav.btp_chantiers',
  'btp-materiaux':         'nav.btp_materiaux',
  banque:                  'nav.banque',
  'banque-clients':        'nav.banque_clients',
  'banque-credits':        'nav.banque_credits',
  'banque-epargne':        'nav.banque_epargne',
  'banque-operations':     'nav.banque_operations',
  agriculture:             'nav.agriculture',
  'agriculture-parcelles': 'nav.agri_parcelles',
  'agriculture-recoltes':  'nav.agri_recoltes',
  'agriculture-intrants':  'nav.agri_intrants',
  cabinet:                 'nav.cabinet',
  'cabinet-clients':       'nav.cabinet_clients',
  'cabinet-documents':     'nav.cabinet_documents',
  'cabinet-taches':        'nav.cabinet_taches',
  'cabinet-revenue':       'nav.cabinet_revenue',
  'cabinet-projets':       'nav.cabinet_projets',
  petrole:                 'nav.petrole',
  'petrole-sites':         'nav.petrole_sites',
  ong:                     'nav.ong',
  'ong-projets':           'nav.ong_projets',
  'ong-dons':              'nav.ong_dons',
  boisson:                 'nav.boisson',
  'boisson-tournees':      'nav.boisson_tournees',
  // MIAA+ sous-modules
  'miaa-agent':     'nav.miaa_agent',
  'miaa-rapports':  'nav.miaa_rapports',
  'miaa-expertise': 'nav.miaa_expertise',
  // Compagnie communication
  'email-management': 'nav.email_management',
  'social-media':     'nav.social_media',
  // Recrutement & Placement RH
  'recrutement-direction':    'nav.recrutement_direction',
  'recrutement-offres':       'nav.recrutement_offres',
  'recrutement-ats':          'nav.recrutement_ats',
  'recrutement-candidatures': 'nav.recrutement_candidatures',
  'recrutement-entretiens':   'nav.recrutement_entretiens',
  'recrutement-cvtheque':     'nav.recrutement_cvtheque',
  'recrutement-placement':    'nav.recrutement_placement',
  'recrutement-mad':          'nav.recrutement_mad',
  'recrutement-contrats':     'nav.recrutement_contrats',
  'recrutement-partenaires':  'nav.recrutement_partenaires',
  'recrutement-analytics':    'nav.recrutement_analytics',
  'recrutement-miaa':         'nav.recrutement_miaa',
}

const SECTOR_LABEL_KEYS: Record<string, string> = {
  ecole:            'nav.ecole',
  restaurant:       'nav.restaurant',
  hotel:            'nav.hotel',
  sante:            'nav.sante',
  pharmacie:        'nav.pharmacie',
  transport:        'nav.transport',
  btp:              'nav.btp',
  banque:           'nav.banque',
  agriculture:      'nav.agriculture',
  cabinet:          'nav.cabinet',
  petrole:          'nav.petrole',
  ong:              'nav.ong',
  boisson:          'nav.boisson',
  recrutement:      'nav.recrutement',
}

// roles : gestion des rôles école — réservé à DIRECTION_GENERALE uniquement
const PLATFORM_RESTRICTED = new Set(['roles'])
// analytics, audit et sous-modules audit : visibles aux admins de TOUS les secteurs
const ADMIN_MODULE_IDS    = new Set(['workflows', 'api-keys', 'analytics', 'audit',
  'audit-comptable', 'audit-financier', 'audit-fiscal', 'audit-rh', 'audit-ci',
  'audit-risques', 'audit-ohada', 'audit-plans', 'audit-rapports'])
const BI_MODULE_IDS       = new Set(['bi', 'bi-dg', 'bi-rh', 'bi-ecole', 'bi-hotel', 'bi-restaurant'])

const SECTOR_BI_MAP: Record<string, string[]> = {
  ecole:            ['bi-dg', 'bi-rh', 'bi-ecole'],
  hotel:            ['bi-dg', 'bi-hotel'],
  restaurant:       ['bi-dg', 'bi-restaurant'],
  sante:            ['bi-dg', 'bi-rh'],
  pharmacie:        ['bi-dg', 'bi-rh'],
  transport:        ['bi-dg'],
  transport_public: ['bi-dg'],
  commerce:         ['bi-dg'],
  supermarche:      ['bi-dg'],
  boutique:         ['bi-dg'],
  btp:              ['bi-dg', 'bi-rh'],
  banque:           ['bi-dg', 'bi-rh'],
  ong:              ['bi-dg', 'bi-rh'],
  agriculture:      ['bi-dg'],
  petrole:          ['bi-dg', 'bi-rh'],
  cabinet:          ['bi-dg'],
  boisson:          ['bi-dg'],
  recrutement:      ['bi-dg', 'bi-rh'],
}

const ALL_MODULE_IDS = [
  ...CORE_ERP_MODULES.map(m => m.id),
  ...PLATFORM_MODULES.map(m => m.id),
  'ecole', 'restaurant', 'hotel', 'housekeeping', 'transport',
  'calendrier', 'taches',
  'sante', 'sante-direction', 'sante-patients', 'sante-rdv', 'sante-consultations', 'sante-medecins',
  'sante-pharmacie', 'sante-urgences', 'sante-labo', 'sante-imagerie', 'sante-bloc',
  'sante-facturation', 'sante-assurances', 'sante-rh', 'sante-miaa', 'sante-hospitalisation',
  'pharmacie', 'pharmacie-meds', 'pharmacie-ventes',
  'abonnement', 'fiscalite', 'cnss-congo',
  'academy',
  'miaa-agent', 'miaa-rapports', 'miaa-expertise',
  'email-management', 'social-media',
  // ── Assurance ──────────────────────────────────────────────────────────────
  'assurance-direction', 'assurance-polices', 'assurance-sinistres',
  'assurance-clients', 'assurance-produits', 'assurance-partenaires',
  'assurance-commissions', 'assurance-analytics', 'assurance-miaa',
  // ── Recrutement & Placement RH ─────────────────────────────────────────────
  'recrutement-direction', 'recrutement-offres', 'recrutement-ats', 'recrutement-candidatures',
  'recrutement-entretiens', 'recrutement-cvtheque', 'recrutement-placement', 'recrutement-mad',
  'recrutement-contrats', 'recrutement-partenaires', 'recrutement-analytics',
  'recrutement-miaa',
]

function getSectorIcon(secteur: string): LucideIcon {
  const M: Record<string, LucideIcon> = {
    ecole: GraduationCap, restaurant: ChefHat, hotel: Hotel,
    transport: Truck, transport_public: Truck, commerce: Store,
    supermarche: Store, boutique: Store, sante: Activity,
    btp: Building2, banque: Wallet, ong: HeartHandshake,
    recrutement: Briefcase,
  }
  return M[secteur] ?? Settings
}

function getSectorLabel(secteur: string): string {
  return (SECTOR_LABELS[secteur] ?? secteur).split(/[ &]/)[0]
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────

export default function Sidebar() {
  const { t } = useLocale()
  const pathname = usePathname()
  const { tenant, loading: tenantLoading } = useTenantContext()

  const secteur      = tenant?.secteur    ?? null
  const sousType     = tenant?.sousType   ?? null
  const taille       = tenant?.taille     ?? null
  const role         = tenant?.role       ?? null
  const ecoleRole    = tenant?.ecoleRole  ?? null
  const isSuperAdmin = tenant?.isSuperAdmin ?? false
  const typeEntite   = tenant?.typeEntite ?? 'standalone'
  const isGroupeUser = typeEntite !== 'standalone'

  const [mounted,       setMounted]       = useState(false)
  const [mobileOpen,    setMobileOpen]    = useState(false)
  const [modulesActifs, setModulesActifs] = useState<string[]>([])
  const [permissions,   setPermissions]   = useState<Record<string, ModulePermission>>({})
  const [permsLoaded,   setPermsLoaded]   = useState(false)

  const [openGroups, setOpenGroups] = useState<Set<string>>(
    new Set([...SIDEBAR_GROUPS.map(g => g.id), 'metier', 'collab'])
  )

  function toggleGroup(gid: string) {
    setOpenGroups(prev => {
      const next = new Set(prev)
      if (next.has(gid)) next.delete(gid); else next.add(gid)
      return next
    })
  }

  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    if (!tenant) {
      setModulesActifs([]); setPermissions({}); setPermsLoaded(true); return
    }
    if (tenant.role === 'owner') {
      // Modules depuis TenantContext, qui lit exclusivement depuis tenant_modules.
      // Pas de fallback vers ALL_MODULE_IDS : si tenant_modules est vide,
      // la migration 156 doit être exécutée pour peupler la table.
      setModulesActifs(tenant.modulesActifs); setPermissions({}); setPermsLoaded(true); return
    }
    let cancelled = false
    async function loadPerms() {
      setPermsLoaded(false)
      if (!tenant!.secteur) {
        const { data: tmRows } = await supabase
          .from('tenant_modules').select('module_key')
          .eq('tenant_id', tenant!.tenantId).eq('enabled', true)
        if (!cancelled) {
          // tenant_modules est la seule source — pas de fallback vers modules_actifs
          setModulesActifs((tmRows ?? []).map((r: { module_key: string }) => r.module_key))
        }
      }
      const { data: perms } = await supabase
        .from('user_permissions')
        .select('module_key, can_view, can_edit, can_delete, can_export, can_validate, can_approve')
        .eq('profile_id', tenant!.profileId)
      if (cancelled) return
      const permMap: Record<string, ModulePermission> = {}
      for (const p of perms ?? []) {
        permMap[p.module_key] = {
          can_view:     p.can_view     ?? false,
          can_edit:     p.can_edit     ?? false,
          can_delete:   p.can_delete   ?? false,
          can_export:   p.can_export   ?? false,
          can_validate: p.can_validate ?? false,
          can_approve:  p.can_approve  ?? false,
        }
      }
      setPermissions(permMap)
      setPermsLoaded(true)
    }
    loadPerms()
    return () => { cancelled = true }
  }, [tenant?.userId, tenant?.tenantId, tenant?.role, tenant?.secteur, tenant?.profileId]) // eslint-disable-line

  const loaded  = !tenantLoading && permsLoaded
  const isOwner = role === 'owner'

  const isActive = useCallback((href: string, exact = false) =>
    exact ? pathname === href : pathname.startsWith(href), [pathname])

  const canView = useCallback((id: string): boolean => {
    // ── Check plan (toujours en premier) ──────────────────────────────────────
    if (!canAccessByPlan(taille, id)) return false
    // Masquer l'ancien sous-module RH recrutement pour les agences recrutement
    if (id === 'recrutement' && secteur === 'recrutement') return false

    // ── BI : filtrés par secteur, admin uniquement ────────────────────────────
    if (BI_MODULE_IDS.has(id)) {
      if (!isOwner && role !== 'admin') return false
      if (secteur) {
        const allowed = SECTOR_BI_MAP[secteur] ?? ['bi-dg']
        return allowed.includes(id)
      }
      return isOwner || role === 'admin'
    }

    // ── Modules admin (workflows, api-keys…) ──────────────────────────────────
    if (ADMIN_MODULE_IDS.has(id)) return isOwner || role === 'admin'

    // ── École : filtre DIRECTION_GENERALE pour modules platform-restricted ────
    if (PLATFORM_RESTRICTED.has(id)) return ecoleRole === 'DIRECTION_GENERALE'

    // ── École : filtre par rôle core + sous_type ─────────────────────────────
    if (secteur === 'ecole') {
      // Vérifier minSousType (filtrage par niveau d'établissement)
      const ecoleMod = (SECTOR_SPECIFIC['ecole'] ?? []).find(m => m.id === id)
      if (ecoleMod?.minSousType) {
        const reqNiveau = ECOLE_NIVEAU[ecoleMod.minSousType as EcoleSousType] ?? 0
        const curNiveau = ECOLE_NIVEAU[(sousType as EcoleSousType) ?? 'primaire'] ?? 0
        if (curNiveau < reqNiveau) return false
      }
      // Vérifier le filtre rôle école pour les modules core
      const coreAllowed = ECOLE_CORE_ROLE_FILTER[id]
      if (coreAllowed?.length) return ecoleRole ? coreAllowed.includes(ecoleRole) : false
      return permissions[id]?.can_view !== false
    }

    // ── Sans secteur : vérifier modulesActifs (depuis tenant_modules via TenantContext) ──
    if (!secteur) {
      if (!modulesActifs.includes(id)) return false
      return permissions[id]?.can_view !== false
    }

    // ── Autres secteurs : permissions ou owner ────────────────────────────────
    if (isOwner) return true
    return permissions[id]?.can_view !== false
  }, [isOwner, ecoleRole, secteur, sousType, taille, permissions, modulesActifs, role])

  const visibleGroups = useMemo((): NavGroup[] => {
    if (!loaded) return []
    return SIDEBAR_GROUPS.map(grp => {
      const items: NavItem[] = []
      for (const mid of grp.moduleIds) {
        const def = getModuleDef(mid)
        if (!def) continue
        const label = MODULE_LABEL_KEYS[mid] ? t(MODULE_LABEL_KEYS[mid]) : def.label
        if (canView(mid)) {
          items.push({ id: mid, label, icon: ICONS[mid] ?? Settings, href: def.href })
        } else {
          // Show as locked if blocked by plan — navigates to the actual page
          // (the page renders a PlanFeatureGate overlay rather than hiding the content)
          const req = getRequiredPlan(taille, mid)
          if (req) {
            items.push({ id: mid, label, icon: ICONS[mid] ?? Settings, href: def.href, locked: req })
          }
        }
      }
      return { ...grp, label: t(grp.labelKey), items }
    }).filter(g => g.items.length > 0)
  }, [loaded, canView, taille, t])

  const metierGroup = useMemo((): NavGroup | null => {
    if (!loaded) return null
    if (secteur) {
      const sectorItems = (SECTOR_SPECIFIC[secteur as SectorId] ?? [])
        .filter(mod => {
          // Filtre plan
          if (!canAccessByPlan(taille, mod.id)) return false
          // Filtre sous_type école (minSousType)
          if (secteur === 'ecole' && mod.minSousType) {
            const reqNiveau = ECOLE_NIVEAU[mod.minSousType as EcoleSousType] ?? 0
            const curNiveau = ECOLE_NIVEAU[(sousType as EcoleSousType) ?? 'primaire'] ?? 0
            if (curNiveau < reqNiveau) return false
          }
          // Filtre sous_type cabinet (onlyCabinetTypes)
          if (secteur === 'cabinet' && mod.onlyCabinetTypes) {
            if (!sousType || !mod.onlyCabinetTypes.includes(sousType)) return false
          }
          return true
        })
        .map(mod => ({
          id:   mod.id,
          label: MODULE_LABEL_KEYS[mod.id] ? t(MODULE_LABEL_KEYS[mod.id]) : mod.label,
          icon: ICONS[mod.id] ?? Settings,
          href: mod.href,
        }))
        .filter(item => {
          if (isOwner) return true
          if (secteur === 'ecole') {
            const sItem = SECTOR_SPECIFIC['ecole']?.find(m => m.id === item.id)
            const rf = sItem?.roleFilter
            if (!rf?.length) return true
            return ecoleRole ? rf.includes(ecoleRole) : false
          }
          return permissions[item.id]?.can_view !== false
        })
      if (!sectorItems.length) return null
      const sectorLabel = SECTOR_LABEL_KEYS[secteur] ? t(SECTOR_LABEL_KEYS[secteur]) : (SECTOR_LABELS[secteur] ?? secteur)
      return { id: 'metier', label: sectorLabel, icon: getSectorIcon(secteur), items: sectorItems }
    }
    const EXTRA_IDS = ['ecole', 'restaurant', 'hotel', 'transport']
    const extraItems: NavItem[] = []
    for (const mid of EXTRA_IDS) {
      if (!modulesActifs.includes(mid) || permissions[mid]?.can_view === false) continue
      const def = getModuleDef(mid)
      if (def) {
        const label = MODULE_LABEL_KEYS[mid] ? t(MODULE_LABEL_KEYS[mid]) : def.label
        extraItems.push({ id: mid, label, icon: ICONS[mid] ?? Settings, href: def.href })
      }
    }
    if (!extraItems.length) return null
    return { id: 'metier', label: t('nav.metier'), icon: Store, items: extraItems }
  }, [loaded, secteur, isOwner, ecoleRole, permissions, modulesActifs, t, sousType, taille])

  const dashHref   = secteur === 'ecole' ? '/dashboard/ecole' : '/dashboard'
  const dashActive = isActive(dashHref, true)

  async function handleLogout() {
    logAuthClient({ event_type: 'LOGOUT' })
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  // ── NavItem renderer ───────────────────────────────────────────────────────

  function NavLink({ item }: { item: NavItem }) {
    const active    = isActive(item.href, item.exact)
    const canEdit   = isOwner || permissions[item.id]?.can_edit
    const Icon      = item.icon
    const isSubItem = item.id === 'recrutement'
    const isLocked  = !!item.locked

    if (isLocked) {
      return (
        <Link
          href={item.href}
          onClick={() => setMobileOpen(false)}
          className={`flex items-center gap-2.5 ${isSubItem ? 'pl-6' : 'pl-3'} pr-2 py-1.5 rounded-lg text-[12.5px] transition-all duration-150 relative`}
          style={{ color: '#C4C9D4', opacity: 0.75 }}
          onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.opacity = '1'; (e.currentTarget as HTMLAnchorElement).style.background = '#FEF9F0' }}
          onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.opacity = '0.75'; (e.currentTarget as HTMLAnchorElement).style.background = 'transparent' }}
          title="Disponible avec le plan Business"
        >
          <div style={{ width: 22, height: 22, borderRadius: 5, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon size={13} style={{ color: '#CBD5E1' }} />
          </div>
          <span className="flex-1 truncate" style={{ color: '#94A3B8' }}>{item.label}</span>
          <span style={{
            fontSize: 8, fontWeight: 700, padding: '1px 5px', borderRadius: 4,
            background: 'rgba(245,158,11,0.12)',
            color: '#B45309',
            letterSpacing: '0.03em', whiteSpace: 'nowrap', flexShrink: 0,
          }}>
            Business
          </span>
        </Link>
      )
    }

    return (
      <Link
        href={item.href}
        prefetch={true}
        onClick={() => setMobileOpen(false)}
        className={`flex items-center gap-2.5 ${isSubItem ? 'pl-6' : 'pl-3'} pr-3 py-1.5 rounded-lg text-[12.5px] transition-all duration-150 relative group`}
        style={active
          ? { background: 'rgba(220,38,38,0.07)', color: '#DC2626', fontWeight: 600 }
          : { color: '#64748B' }
        }
        onMouseEnter={!active ? e => {
          (e.currentTarget as HTMLAnchorElement).style.background = '#F8FAFC'
          ;(e.currentTarget as HTMLAnchorElement).style.color = '#111827'
        } : undefined}
        onMouseLeave={!active ? e => {
          (e.currentTarget as HTMLAnchorElement).style.background = 'transparent'
          ;(e.currentTarget as HTMLAnchorElement).style.color = '#64748B'
        } : undefined}
      >
        {/* Left accent bar (Linear style) */}
        {active && (
          <div style={{
            position: 'absolute', left: 0, top: '20%', bottom: '20%',
            width: 3, borderRadius: '0 3px 3px 0', background: '#DC2626',
          }} />
        )}

        {/* Icon well */}
        <div style={{
          width: 22, height: 22, borderRadius: 5, flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: active ? 'rgba(220,38,38,0.12)' : 'transparent',
          transition: 'background 0.15s',
        }}>
          <Icon size={13} style={{ color: active ? '#DC2626' : '#94A3B8' }} />
        </div>

        <span className="flex-1 truncate">{item.label}</span>
        {!isOwner && !canEdit && <Lock size={8} style={{ color: '#D1D5DB', flexShrink: 0 }} />}
      </Link>
    )
  }

  // ── Group block renderer ───────────────────────────────────────────────────

  function GroupBlock({ group, showSep }: { group: NavGroup; showSep: boolean }) {
    const isOpen    = openGroups.has(group.id)
    const GroupIcon = group.icon

    return (
      <div>
        {showSep && <div className="sidebar-sep" />}
        <div className="mb-0.5">
          <button
            onClick={() => toggleGroup(group.id)}
            className="w-full flex items-center gap-2 px-3 py-1.5 rounded-md transition-colors"
            style={{ background: 'transparent' }}
            onMouseEnter={e => (e.currentTarget.style.background = '#F8FAFC')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          >
            <GroupIcon size={9} style={{ color: '#C4C9D4', flexShrink: 0 }} />
            <span className="flex-1 text-left section-label" style={{ color: '#B0B8C4', fontSize: 9 }}>
              {group.label}
            </span>
            <ChevronDown
              size={8}
              style={{
                color: '#C4C9D4',
                transition: 'transform 0.2s cubic-bezier(0.4,0,0.2,1)',
                transform: isOpen ? 'rotate(0deg)' : 'rotate(-90deg)',
              }}
            />
          </button>

          <div
            style={{
              maxHeight: isOpen ? `${group.items.length * 40}px` : '0px',
              overflow: 'hidden',
              transition: 'max-height 0.22s cubic-bezier(0.4,0,0.2,1)',
              opacity: isOpen ? 1 : 0,
            }}
          >
            <div className="pt-0.5 pb-0.5 space-y-px">
              {group.items.map(item => (
                <NavLink key={item.id} item={item} />
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ── Sidebar Content ────────────────────────────────────────────────────────

  const SidebarContent = () => (
    <div className="flex flex-col h-full overflow-hidden" style={{ background: '#FFFFFF' }}>

      {/* Logo */}
      <div className="shrink-0 px-4 pt-4 pb-3" style={{ borderBottom: '1px solid #E2E8F0' }}>
        <div className="flex items-center gap-2.5" suppressHydrationWarning>
          { }
          <img src="/logo.png" alt="Oraforme" className="h-7 w-auto shrink-0" />
          {mounted && secteur && (
            <span
              className="ml-auto shrink-0 text-[8px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md"
              style={{ background: 'rgba(220,38,38,0.08)', color: '#DC2626', border: '1px solid rgba(220,38,38,0.15)' }}
            >
              {getSectorLabel(secteur)}
            </span>
          )}
          {/* Close button inside sidebar on mobile — replaces the floating X */}
          <button
            className="lg:hidden ml-auto p-1.5 rounded-lg shrink-0"
            style={{ color: '#64748B' }}
            onClick={() => setMobileOpen(false)}
            aria-label="Fermer"
          >
            <X size={18} />
          </button>
        </div>
        {role && role !== 'owner' && (
          <div className="mt-2">
            <span className="text-[9px] font-semibold uppercase tracking-widest px-1.5 py-0.5 rounded"
              style={{ background: '#F1F5F9', color: '#64748B' }}>
              {role === 'admin' ? 'Admin' : t('common.active')}
            </span>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-2 py-3 overflow-y-auto space-y-0.5" style={{ scrollbarWidth: 'none' }}>

        {/* Dashboard link */}
        <Link
          href={dashHref}
          prefetch={true}
          onClick={() => setMobileOpen(false)}
          className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-[12.5px] font-semibold transition-all duration-150 mb-2 relative"
          style={dashActive
            ? { background: '#DC2626', color: '#FFFFFF' }
            : { color: '#64748B' }
          }
          onMouseEnter={!dashActive ? e => {
            (e.currentTarget as HTMLAnchorElement).style.background = '#F8FAFC'
            ;(e.currentTarget as HTMLAnchorElement).style.color = '#111827'
          } : undefined}
          onMouseLeave={!dashActive ? e => {
            (e.currentTarget as HTMLAnchorElement).style.background = 'transparent'
            ;(e.currentTarget as HTMLAnchorElement).style.color = '#64748B'
          } : undefined}
        >
          <div style={{
            width: 22, height: 22, borderRadius: 5, flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: dashActive ? 'rgba(255,255,255,0.2)' : 'transparent',
          }}>
            <LayoutDashboard size={13} style={{ color: dashActive ? '#FFFFFF' : '#94A3B8' }} />
          </div>
          <span>{t('nav.direction')}</span>
        </Link>

        {/* Groupe link — visible for hierarchical tenants on Compagnie plan */}
        {isGroupeUser && canAccessByPlan(taille, 'groupe') && (
          <Link
            href="/dashboard/groupe"
            prefetch={true}
            onClick={() => setMobileOpen(false)}
            className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-[12.5px] transition-all duration-150 mb-1 relative"
            style={isActive('/dashboard/groupe', true)
              ? { background: 'rgba(245,158,11,0.08)', color: '#D97706', fontWeight: 600 }
              : { color: '#64748B' }
            }
            onMouseEnter={!isActive('/dashboard/groupe', true) ? e => {
              (e.currentTarget as HTMLAnchorElement).style.background = '#FFFBEB'
              ;(e.currentTarget as HTMLAnchorElement).style.color = '#D97706'
            } : undefined}
            onMouseLeave={!isActive('/dashboard/groupe', true) ? e => {
              (e.currentTarget as HTMLAnchorElement).style.background = 'transparent'
              ;(e.currentTarget as HTMLAnchorElement).style.color = '#64748B'
            } : undefined}
          >
            {isActive('/dashboard/groupe', true) && (
              <div style={{
                position: 'absolute', left: 0, top: '20%', bottom: '20%',
                width: 3, borderRadius: '0 3px 3px 0', background: '#F59E0B',
              }} />
            )}
            <div style={{
              width: 22, height: 22, borderRadius: 5, flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: isActive('/dashboard/groupe', true) ? 'rgba(245,158,11,0.12)' : 'transparent',
            }}>
              <Globe size={13} style={{ color: isActive('/dashboard/groupe', true) ? '#F59E0B' : '#94A3B8' }} />
            </div>
            <span>Vue Groupe</span>
          </Link>
        )}

        {/* Groupe sub-links — Gestion + MIAA+ Executive */}
        {isGroupeUser && canAccessByPlan(taille, 'groupe') && (
          <>
            <Link
              href="/dashboard/groupe/gestion"
              prefetch={true}
              onClick={() => setMobileOpen(false)}
              className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-[11.5px] transition-all duration-150 ml-3"
              style={isActive('/dashboard/groupe/gestion')
                ? { background: 'rgba(245,158,11,0.08)', color: '#D97706', fontWeight: 600 }
                : { color: '#94A3B8' }
              }
            >
              <Settings size={11} style={{ color: isActive('/dashboard/groupe/gestion') ? '#D97706' : '#94A3B8' }} />
              <span>Gérer les entités</span>
            </Link>
            <Link
              href="/dashboard/groupe/miaa"
              prefetch={true}
              onClick={() => setMobileOpen(false)}
              className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-[11.5px] transition-all duration-150 ml-3"
              style={isActive('/dashboard/groupe/miaa')
                ? { background: 'rgba(124,58,237,0.08)', color: '#7C3AED', fontWeight: 600 }
                : { color: '#94A3B8' }
              }
            >
              <Sparkles size={11} style={{ color: isActive('/dashboard/groupe/miaa') ? '#7C3AED' : '#94A3B8' }} />
              <span>MIAA+ Executive</span>
            </Link>
          </>
        )}

        {/* Skeleton */}
        {!loaded && (
          <div className="space-y-2 px-1">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-8 rounded-lg animate-pulse" style={{ background: '#F1F5F9' }} />
            ))}
          </div>
        )}

        {/* Blocs */}
        {loaded && (
          <>
            {visibleGroups.map((group, idx) => {
              // Secteur métier s'insère après operations (ou en dernier fallback)
              const insertMetierAfter = group.id === 'operations'
              return (
                <div key={group.id}>
                  <GroupBlock group={group} showSep={idx > 0} />
                  {insertMetierAfter && metierGroup && (
                    <GroupBlock group={metierGroup} showSep />
                  )}
                </div>
              )
            })}

            {!visibleGroups.find(g => g.id === 'operations') && metierGroup && (
              <GroupBlock group={metierGroup} showSep={visibleGroups.length > 0} />
            )}

            {isOwner && !secteur && (
              <Link
                href="/dashboard/modules"
                prefetch={true}
                onClick={() => setMobileOpen(false)}
                className="flex items-center gap-3 px-3 py-2 rounded-lg text-[12.5px] transition-all duration-150 mt-1"
                style={isActive('/dashboard/modules')
                  ? { background: 'rgba(220,38,38,0.08)', color: '#DC2626', fontWeight: 600 }
                  : { color: '#64748B' }
                }
                onMouseEnter={e => {
                  (e.currentTarget as HTMLAnchorElement).style.background = '#F8FAFC'
                  ;(e.currentTarget as HTMLAnchorElement).style.color = '#0F172A'
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLAnchorElement).style.background = isActive('/dashboard/modules') ? 'rgba(220,38,38,0.08)' : 'transparent'
                  ;(e.currentTarget as HTMLAnchorElement).style.color = isActive('/dashboard/modules') ? '#DC2626' : '#64748B'
                }}
              >
                <Store size={14} style={{ color: '#94A3B8' }} />
                <span>{t('nav.modules')}</span>
              </Link>
            )}
          </>
        )}
      </nav>

      {/* Bottom */}
      <div className="shrink-0 px-2 py-3 space-y-0.5" style={{ borderTop: '1px solid #E2E8F0' }}>
        {isSuperAdmin && (
          <Link
            href="/admin"
            prefetch={true}
            onClick={() => setMobileOpen(false)}
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-[12.5px] font-medium transition-all duration-150"
            style={{ color: '#DC2626' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(220,38,38,0.06)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          >
            <ShieldAlert size={13} className="shrink-0" />
            <span>Admin</span>
            <div className="ml-auto w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
          </Link>
        )}
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-[12.5px] transition-all duration-150"
          style={{ color: '#94A3B8' }}
          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(220,38,38,0.06)'; (e.currentTarget as HTMLButtonElement).style.color = '#DC2626' }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; (e.currentTarget as HTMLButtonElement).style.color = '#94A3B8' }}
        >
          <LogOut size={13} className="shrink-0" />
          <span>{t('nav.logout')}</span>
        </button>
      </div>
    </div>
  )

  return (
    <>
      {/* Desktop */}
      <aside className="hidden lg:flex shrink-0 flex-col h-screen sticky top-0" style={{ width: 232, background: '#FFFFFF', borderRight: '1px solid #E2E8F0' }}>
        <SidebarContent />
      </aside>

      {/* Mobile toggle — only shown when sidebar is CLOSED */}
      {!mobileOpen && (
        <button
          className="lg:hidden fixed top-4 left-4 z-50 p-2 rounded-xl shadow-sm"
          style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', color: '#0F172A' }}
          onClick={() => setMobileOpen(true)}
          aria-label="Menu"
        >
          <Menu size={18} />
        </button>
      )}

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div style={{ width: 232, background: '#FFFFFF', height: '100%', boxShadow: '4px 0 24px rgba(0,0,0,0.12)', borderRight: '1px solid #E2E8F0' }}>
            <SidebarContent />
          </div>
          <div
            className="flex-1 bg-black/30 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
        </div>
      )}
    </>
  )
}

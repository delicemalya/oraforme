'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useTenantContext } from '@/lib/contexts/TenantContext'
import {
  LayoutDashboard, FileText, Package, Users,
  ChefHat, GraduationCap, Hotel, Bot,
  LogOut, Menu, X, Lock,
  Settings, ShieldAlert, ShieldCheck, Store,
  Wallet, BookOpen, ShoppingCart,
  Receipt, BarChart2, Truck,
  BookMarked, Calculator, HeartHandshake, UsersRound,
  Layers, Activity, TrendingUp,
  Bell, FolderOpen, Building2,
  ChevronDown, Calendar, CheckSquare,
  Heart, Pill, Sparkles, Stethoscope, UserRound, CalendarClock,
  CreditCard, LineChart, Zap, Key, Landmark, Briefcase, ClipboardList,
  MessageSquare, DollarSign,
} from 'lucide-react'
import {
  CORE_ERP_MODULES,
  SECTOR_SPECIFIC,
  PLATFORM_MODULES,
  SECTOR_LABELS,
  ECOLE_CORE_ROLE_FILTER,
  type SectorId,
} from '@/lib/erp-sectors'
import { useState, useEffect, useMemo, useCallback } from 'react'
import type { LucideIcon } from 'lucide-react'
import type { ModulePermission } from '@/lib/hooks/usePermissions'
import { useLocale } from '@/lib/hooks/useLocale'

// ─── Types ────────────────────────────────────────────────────────────────────

type NavItem = {
  id:      string
  label:   string
  icon:    LucideIcon
  href:    string
  exact?:  boolean
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
  audit:         ShieldAlert,
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
  calendrier:    Calendar,
  taches:        CheckSquare,
  profil:        Building2,
  parametres:    Settings,
  'ecole-direction':        BarChart2,
  'ecole-rh':               Users,
  'ecole-comptabilite':     Calculator,
  'ecole-miaa':             Bot,
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
}

// ─── Module Registry ──────────────────────────────────────────────────────────

type ModuleDef = { id: string; label: string; sublabel: string; href: string }

const MODULE_DEFS: ModuleDef[] = [
  // RH — sous-modules
  { id: 'recrutement', label: 'Recrutement', sublabel: 'MIAA Job', href: '/dashboard/rh/recrutement' },
  { id: 'salaires', label: 'Paie & Bulletins', sublabel: 'ECAM Congo', href: '/dashboard/rh/paie' },
  { id: 'bi',          label: 'Analytics',              sublabel: '', href: '/dashboard/bi' },
  { id: 'bi-dg',       label: 'Analytics général',      sublabel: '', href: '/dashboard/bi' },
  { id: 'bi-rh',       label: 'Analytics RH',           sublabel: '', href: '/dashboard/bi/rh' },
  { id: 'bi-ecole',    label: 'Analytics École',        sublabel: '', href: '/dashboard/bi/ecole' },
  { id: 'bi-hotel',    label: 'Analytics Hôtel',        sublabel: '', href: '/dashboard/bi/hotel' },
  { id: 'bi-restaurant', label: 'Analytics Restaurant', sublabel: '', href: '/dashboard/bi/restaurant' },
  ...(CORE_ERP_MODULES as unknown as ModuleDef[]),
  ...(PLATFORM_MODULES as unknown as ModuleDef[]),
  { id: 'ecole',                 label: 'École & Université',   sublabel: '', href: '/dashboard/ecole'                      },
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
  { id: 'recouvrement', label: 'Recouvrement',             sublabel: '', href: '/dashboard/recouvrement' },
]

const getModuleDef = (id: string) => MODULE_DEFS.find(m => m.id === id)

// ─── Sidebar Group definitions ────────────────────────────────────────────────

const SIDEBAR_GROUPS = [
  // SUPERVISION — KPIs exécutifs, BI, analytics
  { id: 'supervision', labelKey: 'nav.pilotage',    icon: TrendingUp,  moduleIds: ['direction', 'finance', 'bi-dg', 'bi-rh', 'bi-ecole', 'bi-hotel', 'bi-restaurant', 'analytics', 'audit'] },
  // FINANCE — gestion financière + déclarations DGI + CNSS
  { id: 'finance',     labelKey: 'nav.finance_ops', icon: Calculator,  moduleIds: ['comptabilite', 'tresorerie', 'facturation', 'depenses', 'fiscalite', 'cnss-congo'] },
  // RH — personnel & paie (recrutement = rubrique indépendante)
  { id: 'rh',          labelKey: 'nav.rh',          icon: Users,       moduleIds: ['rh', 'salaires', 'roles'] },
  // RECRUTEMENT — module autonome
  { id: 'recrutement_section', labelKey: 'nav.recrutement', icon: Briefcase, moduleIds: ['recrutement'] },
  // COMMERCIAL — clients, ventes, recouvrement, stock, achats
  { id: 'commercial',  labelKey: 'nav.commercial',  icon: Store,       moduleIds: ['crm', 'facturation', 'recouvrement', 'stock', 'achats'] },
  // OUTILS — IA & productivité (calendrier → navbar)
  { id: 'outils',      labelKey: 'nav.outils',      icon: FolderOpen,  moduleIds: ['ged', 'bizbot', 'taches'] },
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
}

// roles : gestion des rôles école — réservé à DIRECTION_GENERALE uniquement
const PLATFORM_RESTRICTED = new Set(['roles'])
// analytics et audit : visibles aux admins de TOUS les secteurs (pas école-only)
const ADMIN_MODULE_IDS    = new Set(['workflows', 'api-keys', 'analytics', 'audit'])
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
}

const ALL_MODULE_IDS = [
  ...CORE_ERP_MODULES.map(m => m.id),
  ...PLATFORM_MODULES.map(m => m.id),
  'ecole', 'restaurant', 'hotel', 'housekeeping', 'transport',
  'calendrier', 'taches',
  'sante', 'sante-patients', 'sante-rdv', 'sante-consultations', 'sante-medecins',
  'pharmacie', 'pharmacie-meds', 'pharmacie-ventes',
  'abonnement', 'fiscalite', 'cnss-congo',
]

function getSectorIcon(secteur: string): LucideIcon {
  const M: Record<string, LucideIcon> = {
    ecole: GraduationCap, restaurant: ChefHat, hotel: Hotel,
    transport: Truck, transport_public: Truck, commerce: Store,
    supermarche: Store, boutique: Store, sante: Activity,
    btp: Building2, banque: Wallet, ong: HeartHandshake,
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
  const role         = tenant?.role       ?? null
  const ecoleRole    = tenant?.ecoleRole  ?? null
  const isSuperAdmin = tenant?.isSuperAdmin ?? false

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
      next.has(gid) ? next.delete(gid) : next.add(gid)
      return next
    })
  }

  useEffect(() => {
    if (!tenant) {
      setModulesActifs([]); setPermissions({}); setPermsLoaded(true); return
    }
    if (tenant.role === 'owner') {
      // Use modules_actifs from DB (computed from plan+sector at onboarding).
      // Fall back to ALL_MODULE_IDS only for legacy tenants with no modules_actifs.
      const ownerModules = tenant.modulesActifs && tenant.modulesActifs.length > 0
        ? tenant.modulesActifs
        : ALL_MODULE_IDS
      setModulesActifs(ownerModules); setPermissions({}); setPermsLoaded(true); return
    }
    let cancelled = false
    async function loadPerms() {
      setPermsLoaded(false)
      if (!tenant!.secteur) {
        const { data: tmRows } = await supabase
          .from('tenant_modules').select('module_key')
          .eq('tenant_id', tenant!.tenantId).eq('enabled', true)
        if (!cancelled) {
          setModulesActifs(
            tmRows && tmRows.length > 0
              ? tmRows.map((r: { module_key: string }) => r.module_key)
              : tenant!.modulesActifs,
          )
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
    // Owner voit tout SAUF les BI d'autres secteurs (un compte école ne voit pas bi-hotel/bi-restaurant)
    if (isOwner) {
      if (BI_MODULE_IDS.has(id) && secteur) {
        const allowed = SECTOR_BI_MAP[secteur] ?? ['bi-dg']
        return allowed.includes(id)
      }
      return true
    }
    if (ADMIN_MODULE_IDS.has(id)) return role === 'admin'
    if (BI_MODULE_IDS.has(id)) {
      if (role !== 'admin') return false
      if (secteur) {
        const allowed = SECTOR_BI_MAP[secteur] ?? ['bi-dg']
        return allowed.includes(id)
      }
      return true
    }
    if (PLATFORM_RESTRICTED.has(id)) return ecoleRole === 'DIRECTION_GENERALE'
    if (secteur === 'ecole') {
      const allowed = ECOLE_CORE_ROLE_FILTER[id]
      if (allowed?.length) return ecoleRole ? allowed.includes(ecoleRole) : false
      return permissions[id]?.can_view !== false
    }
    if (!secteur) {
      if (!modulesActifs.includes(id)) return false
      return permissions[id]?.can_view !== false
    }
    return permissions[id]?.can_view !== false
  }, [isOwner, ecoleRole, secteur, permissions, modulesActifs])

  const visibleGroups = useMemo((): NavGroup[] => {
    if (!loaded) return []
    return SIDEBAR_GROUPS.map(grp => {
      const items: NavItem[] = []
      for (const mid of grp.moduleIds) {
        if (!canView(mid)) continue
        const def = getModuleDef(mid)
        if (!def) continue
        const label = MODULE_LABEL_KEYS[mid] ? t(MODULE_LABEL_KEYS[mid]) : def.label
        // rh is exact-only: only active on /dashboard/rh, not on sub-pages like /dashboard/rh/recrutement
        items.push({ id: mid, label, icon: ICONS[mid] ?? Settings, href: def.href, exact: mid === 'rh' })
      }
      return { ...grp, label: t(grp.labelKey), items }
    }).filter(g => g.items.length > 0)
  }, [loaded, canView, t])

  const metierGroup = useMemo((): NavGroup | null => {
    if (!loaded) return null
    if (secteur) {
      const sectorItems = (SECTOR_SPECIFIC[secteur as SectorId] ?? [])
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
  }, [loaded, secteur, isOwner, ecoleRole, permissions, modulesActifs, t])

  const dashHref   = secteur === 'ecole' ? '/dashboard/ecole' : '/dashboard'
  const dashActive = isActive(dashHref, true)

  async function handleLogout() {
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  // ── NavItem renderer ───────────────────────────────────────────────────────

  function NavLink({ item }: { item: NavItem }) {
    const active    = isActive(item.href, item.exact)
    const canEdit   = isOwner || permissions[item.id]?.can_edit
    const Icon      = item.icon
    const isSubItem = item.id === 'recrutement'
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
        <div className="flex items-center gap-2.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-icon.png" alt="oraforme" width={28} height={28} className="shrink-0" />
          <span className="text-[16px] font-extrabold tracking-tight" style={{ color: '#0F172A' }}>oraforme</span>
          {secteur && (
            <span
              className="ml-auto shrink-0 text-[8px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md"
              style={{ background: 'rgba(220,38,38,0.08)', color: '#DC2626', border: '1px solid rgba(220,38,38,0.15)' }}
            >
              {getSectorLabel(secteur)}
            </span>
          )}
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
          <span>{t('nav.dashboard')}</span>
        </Link>

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
            <span>Admin oraforme</span>
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

      {/* Mobile toggle */}
      <button
        className="lg:hidden fixed top-4 left-4 z-50 p-2 rounded-xl shadow-sm"
        style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', color: '#0F172A' }}
        onClick={() => setMobileOpen(o => !o)}
        aria-label="Menu"
      >
        {mobileOpen ? <X size={18} /> : <Menu size={18} />}
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-40 flex">
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

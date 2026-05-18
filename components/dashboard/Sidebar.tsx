'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useTenantContext } from '@/lib/contexts/TenantContext'
import {
  LayoutDashboard, FileText, Package, UserCheck,
  ChefHat, GraduationCap, Hotel, Bot,
  LogOut, Menu, X, Lock,
  Settings, ShieldAlert, ShieldCheck, Store,
  Wallet, BookOpen, ShoppingCart,
  Receipt, BarChart2, Truck,
  BookMarked, Calculator, HeartHandshake, Users, UsersRound,
  Layers, CreditCard, Activity,
} from 'lucide-react'
import { CORE_MODULE_IDS, CORE_SECTION_LABEL } from '@/lib/erp-core'
import { useState, useEffect } from 'react'
import { SUPER_ADMIN_EMAILS } from '@/lib/admin-config'
import type { LucideIcon } from 'lucide-react'
import type { ModulePermission } from '@/lib/hooks/usePermissions'
import { useLocale } from '@/lib/hooks/useLocale'

// ── Generic modules (tenants sans secteur défini) ─────────────────────────────

const ALL_MODULES = [
  { id: 'rh',           label: 'RH & Paie',           icon: UserCheck,     href: '/dashboard/rh' },
  { id: 'comptabilite', label: 'Comptabilité',         icon: BookOpen,      href: '/dashboard/comptabilite' },
  { id: 'tresorerie',   label: 'Trésorerie',           icon: Wallet,        href: '/dashboard/tresorerie' },
  { id: 'stock',        label: 'Stock & Inventaire',   icon: Package,       href: '/dashboard/stock' },
  // Business modules (sector-specific)
  { id: 'facturation',  label: 'FacturePro',           icon: FileText,      href: '/dashboard/facturation' },
  { id: 'ecole',        label: 'École & Université',   icon: GraduationCap, href: '/dashboard/ecole' },
  { id: 'restaurant',   label: 'Resto POS',            icon: ChefHat,       href: '/dashboard/restaurant' },
  { id: 'achats',       label: 'Achats & Fourn.',      icon: ShoppingCart,  href: '/dashboard/achats' },
  { id: 'depenses',     label: 'Dépenses',             icon: Receipt,       href: '/dashboard/depenses' },
  { id: 'rapports',     label: 'Rapports IA',          icon: BarChart2,     href: '/dashboard/rapports' },
  { id: 'hotel',        label: 'Hôtel & Hébergement',  icon: Hotel,         href: '/dashboard/hotel' },
  { id: 'transport',    label: 'Transport VTC',        icon: Truck,         href: '/dashboard/transport' },
  { id: 'bizbot',       label: 'MIAA+ Assistant',      icon: Bot,           href: '/dashboard/miaa' },
]

// ── Navigation par secteur métier ─────────────────────────────────────────────

type NavItem = {
  id: string
  label: string
  sublabel: string
  icon: LucideIcon
  href: string
  color: string
  exact?: boolean
}

// ── Visibilité par rôle école ─────────────────────────────────────────────────

const ECOLE_ROLE_VISIBILITY: Record<string, string[]> = {
  'direction':              ['DIRECTION_GENERALE'],
  'daac':                   ['DIRECTION_GENERALE', 'DAAC'],
  'rh':                     ['DIRECTION_GENERALE', 'RAF', 'RH_PAIE'],
  'comptabilite':           ['DIRECTION_GENERALE', 'RAF'],
  'tresorerie':             ['DIRECTION_GENERALE', 'RAF'],
  'scolarite':              ['DIRECTION_GENERALE', 'SCOLARITE', 'DAAC'],
  'espace-formateur':       ['FORMATEUR', 'DIRECTION_GENERALE', 'DAAC', 'RH_PAIE'],
  'espace-etudiant':        ['ETUDIANT'],
  'espace-parent':          ['PARENT'],
  'parametres-academiques': ['DIRECTION_GENERALE', 'DAAC'],
  'miaa':                   [], // visible à tous
}

const SECTOR_NAV: Record<string, NavItem[]> = {
  ecole: [
    { id: 'direction',              label: 'Direction Générale',     sublabel: 'Pilotage & finances',     icon: BarChart2,      href: '/dashboard/ecole/direction',              color: '#F0A30A' },
    { id: 'daac',                   label: 'DAAC',                   sublabel: 'Affaires académiques',     icon: Layers,         href: '/dashboard/ecole/daac',                   color: '#EF4444' },
    { id: 'rh',                     label: 'RH & Paie',              sublabel: 'Personnel & salaires',     icon: Users,          href: '/dashboard/ecole/rh',                     color: '#8B5CF6' },
    { id: 'comptabilite',           label: 'Comptabilité',           sublabel: 'Journal OHADA',            icon: Calculator,     href: '/dashboard/ecole/comptabilite',           color: '#2EA043' },
    { id: 'tresorerie',             label: 'Trésorerie',             sublabel: 'Wallets & encaissements',  icon: Wallet,         href: '/dashboard/ecole/tresorerie',             color: '#06B6D4' },
    { id: 'scolarite',              label: 'Scolarité',              sublabel: 'Inscriptions & frais',     icon: BookMarked,     href: '/dashboard/ecole/scolarite',              color: '#F0A30A' },
    { id: 'espace-formateur',       label: 'Formateurs',             sublabel: 'Cours & heures',           icon: BookOpen,       href: '/dashboard/ecole/espace-formateur',       color: '#2EA043' },
    { id: 'espace-etudiant',        label: 'Espace Étudiant',        sublabel: 'Mon dossier',              icon: GraduationCap,  href: '/dashboard/ecole/espace-etudiant',        color: '#06B6D4' },
    { id: 'espace-parent',          label: 'Espace Parent',          sublabel: 'Suivi de mes enfants',     icon: HeartHandshake, href: '/dashboard/ecole/espace-parent',          color: '#EC4899' },
    { id: 'parametres-academiques', label: 'Paramètres académ.',     sublabel: 'LMD & mentions',           icon: Settings,       href: '/dashboard/ecole/parametres-academiques', color: '#8B949E' },
    { id: 'miaa',                   label: 'MIAA+',                  sublabel: 'IA scolaire',              icon: Bot,            href: '/dashboard/ecole/miaa',                   color: '#F97316' },
  ],
  restaurant: [
    { id: 'pos',        label: 'Caisse POS',   sublabel: 'Ventes & commandes', icon: ChefHat,   href: '/dashboard/restaurant',  color: '#F0A30A' },
    { id: 'stock',      label: 'Stock',        sublabel: 'Inventaire',         icon: Package,   href: '/dashboard/stock',       color: '#2EA043' },
    { id: 'rh',         label: 'RH & Paie',   sublabel: 'Personnel',          icon: Users,     href: '/dashboard/rh',          color: '#388BFD' },
    { id: 'tresorerie', label: 'Trésorerie',   sublabel: 'Finances',           icon: Wallet,    href: '/dashboard/tresorerie',  color: '#8B5CF6' },
    { id: 'miaa',       label: 'MIAA+',        sublabel: 'Assistant IA',       icon: Bot,       href: '/dashboard/miaa',        color: '#F97316' },
  ],
  commerce: [
    { id: 'facturation', label: 'Facturation',  sublabel: 'Devis & factures',  icon: FileText,  href: '/dashboard/facturation', color: '#F0A30A' },
    { id: 'stock',       label: 'Stock',        sublabel: 'Inventaire',        icon: Package,   href: '/dashboard/stock',       color: '#2EA043' },
    { id: 'rh',          label: 'RH & Paie',   sublabel: 'Personnel',         icon: Users,     href: '/dashboard/rh',          color: '#388BFD' },
    { id: 'tresorerie',  label: 'Trésorerie',   sublabel: 'Finances',          icon: Wallet,    href: '/dashboard/tresorerie',  color: '#8B5CF6' },
    { id: 'miaa',        label: 'MIAA+',        sublabel: 'Assistant IA',      icon: Bot,       href: '/dashboard/miaa',        color: '#F97316' },
  ],
  supermarche: [
    { id: 'facturation', label: 'Facturation',  sublabel: 'Caisse & ventes',   icon: FileText,    href: '/dashboard/facturation', color: '#F0A30A' },
    { id: 'stock',       label: 'Stock',        sublabel: 'Rayons & inventaire',icon: Package,    href: '/dashboard/stock',       color: '#2EA043' },
    { id: 'achats',      label: 'Achats',       sublabel: 'Fournisseurs',       icon: ShoppingCart,href: '/dashboard/achats',     color: '#06B6D4' },
    { id: 'rh',          label: 'RH & Paie',   sublabel: 'Personnel',          icon: Users,       href: '/dashboard/rh',         color: '#388BFD' },
    { id: 'tresorerie',  label: 'Trésorerie',   sublabel: 'Finances',           icon: Wallet,      href: '/dashboard/tresorerie', color: '#8B5CF6' },
  ],
  boisson: [
    { id: 'facturation', label: 'Facturation',  sublabel: 'Ventes & livraisons',icon: FileText,   href: '/dashboard/facturation', color: '#F0A30A' },
    { id: 'stock',       label: 'Stock',        sublabel: 'Inventaire boissons',icon: Package,    href: '/dashboard/stock',       color: '#2EA043' },
    { id: 'achats',      label: 'Achats',       sublabel: 'Fournisseurs',       icon: ShoppingCart,href: '/dashboard/achats',     color: '#06B6D4' },
    { id: 'rh',          label: 'RH & Paie',   sublabel: 'Personnel',          icon: Users,       href: '/dashboard/rh',         color: '#388BFD' },
    { id: 'tresorerie',  label: 'Trésorerie',   sublabel: 'Finances',           icon: Wallet,      href: '/dashboard/tresorerie', color: '#8B5CF6' },
  ],
  transport_public: [
    { id: 'transport',   label: 'Transport',    sublabel: 'Lignes & voyageurs', icon: Truck,       href: '/dashboard/transport',  color: '#F0A30A' },
    { id: 'facturation', label: 'Facturation',  sublabel: 'Billets & recettes', icon: FileText,    href: '/dashboard/facturation', color: '#388BFD' },
    { id: 'rh',          label: 'RH & Paie',   sublabel: 'Chauffeurs & agents',icon: Users,       href: '/dashboard/rh',         color: '#2EA043' },
    { id: 'tresorerie',  label: 'Trésorerie',   sublabel: 'Finances',           icon: Wallet,      href: '/dashboard/tresorerie', color: '#8B5CF6' },
    { id: 'miaa',        label: 'MIAA+',        sublabel: 'Assistant IA',       icon: Bot,         href: '/dashboard/miaa',       color: '#F97316' },
  ],
  sante: [
    { id: 'facturation', label: 'Facturation',  sublabel: 'Consultations',      icon: FileText,  href: '/dashboard/facturation', color: '#F0A30A' },
    { id: 'rh',          label: 'RH & Paie',   sublabel: 'Personnel médical',  icon: Users,     href: '/dashboard/rh',          color: '#2EA043' },
    { id: 'stock',       label: 'Pharmacie',    sublabel: 'Médicaments',        icon: Package,   href: '/dashboard/stock',       color: '#388BFD' },
    { id: 'tresorerie',  label: 'Trésorerie',   sublabel: 'Finances',           icon: Wallet,    href: '/dashboard/tresorerie',  color: '#8B5CF6' },
    { id: 'miaa',        label: 'MIAA+',        sublabel: 'Assistant IA',       icon: Bot,       href: '/dashboard/miaa',        color: '#F97316' },
  ],
  transport: [
    { id: 'transport',   label: 'Transport',    sublabel: 'Flotte & courses',  icon: Truck,     href: '/dashboard/transport',   color: '#F0A30A' },
    { id: 'facturation', label: 'Facturation',  sublabel: 'Devis & factures',  icon: FileText,  href: '/dashboard/facturation', color: '#388BFD' },
    { id: 'rh',          label: 'RH & Paie',   sublabel: 'Chauffeurs',        icon: Users,     href: '/dashboard/rh',          color: '#2EA043' },
    { id: 'tresorerie',  label: 'Trésorerie',   sublabel: 'Finances',          icon: Wallet,    href: '/dashboard/tresorerie',  color: '#8B5CF6' },
    { id: 'miaa',        label: 'MIAA+',        sublabel: 'Assistant IA',      icon: Bot,       href: '/dashboard/miaa',        color: '#F97316' },
  ],
  hotel: [
    { id: 'hotel',       label: 'Hébergement',  sublabel: 'Réservations',       icon: Hotel,       href: '/dashboard/hotel',       color: '#F0A30A' },
    { id: 'facturation', label: 'Facturation',  sublabel: 'Devis & factures',   icon: FileText,    href: '/dashboard/facturation', color: '#388BFD' },
    { id: 'rh',          label: 'RH & Paie',   sublabel: 'Personnel',          icon: Users,       href: '/dashboard/rh',          color: '#2EA043' },
    { id: 'tresorerie',  label: 'Trésorerie',   sublabel: 'Finances',           icon: Wallet,      href: '/dashboard/tresorerie',  color: '#8B5CF6' },
    { id: 'miaa',        label: 'MIAA+',        sublabel: 'Assistant IA',       icon: Bot,         href: '/dashboard/miaa',        color: '#F97316' },
  ],
  boutique: [
    { id: 'facturation',  label: 'Caisse & Ventes', sublabel: 'Factures & reçus',  icon: FileText,    href: '/dashboard/facturation', color: '#F0A30A' },
    { id: 'stock',        label: 'Stock',            sublabel: 'Inventaire',         icon: Package,     href: '/dashboard/stock',       color: '#2EA043' },
    { id: 'achats',       label: 'Achats',           sublabel: 'Fournisseurs',       icon: ShoppingCart,href: '/dashboard/achats',      color: '#06B6D4' },
    { id: 'tresorerie',   label: 'Trésorerie',       sublabel: 'Finances',           icon: Wallet,      href: '/dashboard/tresorerie',  color: '#8B5CF6' },
    { id: 'comptabilite', label: 'Comptabilité',     sublabel: 'OHADA',              icon: Calculator,  href: '/dashboard/comptabilite',color: '#EC4899' },
  ],
  btp: [
    { id: 'facturation',  label: 'Facturation',      sublabel: 'Devis & travaux',    icon: FileText,    href: '/dashboard/facturation', color: '#F0A30A' },
    { id: 'stock',        label: 'Stock chantier',   sublabel: 'Matériaux',          icon: Package,     href: '/dashboard/stock',       color: '#2EA043' },
    { id: 'achats',       label: 'Achats',           sublabel: 'Fournisseurs',       icon: ShoppingCart,href: '/dashboard/achats',      color: '#06B6D4' },
    { id: 'rh',           label: 'RH & Équipes',    sublabel: 'Personnel chantier', icon: Users,       href: '/dashboard/rh',          color: '#388BFD' },
    { id: 'tresorerie',   label: 'Trésorerie',       sublabel: 'Finances',           icon: Wallet,      href: '/dashboard/tresorerie',  color: '#8B5CF6' },
    { id: 'comptabilite', label: 'Comptabilité',     sublabel: 'OHADA',              icon: Calculator,  href: '/dashboard/comptabilite',color: '#EC4899' },
  ],
  cabinet: [
    { id: 'facturation',  label: 'Facturation',      sublabel: 'Devis & honoraires', icon: FileText,    href: '/dashboard/facturation', color: '#F0A30A' },
    { id: 'tresorerie',   label: 'Trésorerie',       sublabel: 'Finances',           icon: Wallet,      href: '/dashboard/tresorerie',  color: '#388BFD' },
    { id: 'comptabilite', label: 'Comptabilité',     sublabel: 'OHADA',              icon: Calculator,  href: '/dashboard/comptabilite',color: '#8B5CF6' },
    { id: 'miaa',         label: 'MIAA+',            sublabel: 'Assistant IA',       icon: Bot,         href: '/dashboard/miaa',        color: '#F97316' },
  ],
  petrole: [
    { id: 'facturation',  label: 'Facturation',      sublabel: 'Ventes & contrats',  icon: FileText,    href: '/dashboard/facturation', color: '#F0A30A' },
    { id: 'stock',        label: 'Stock',            sublabel: 'Inventaire',         icon: Package,     href: '/dashboard/stock',       color: '#2EA043' },
    { id: 'achats',       label: 'Achats',           sublabel: 'Fournisseurs',       icon: ShoppingCart,href: '/dashboard/achats',      color: '#06B6D4' },
    { id: 'rh',           label: 'RH & Paie',       sublabel: 'Personnel',          icon: Users,       href: '/dashboard/rh',          color: '#388BFD' },
    { id: 'tresorerie',   label: 'Trésorerie',       sublabel: 'Finances',           icon: Wallet,      href: '/dashboard/tresorerie',  color: '#8B5CF6' },
    { id: 'comptabilite', label: 'Comptabilité',     sublabel: 'OHADA',              icon: Calculator,  href: '/dashboard/comptabilite',color: '#EC4899' },
  ],
  ong: [
    { id: 'facturation',  label: 'Projets & Budget', sublabel: 'Rapports bailleurs', icon: FileText,    href: '/dashboard/facturation', color: '#F0A30A' },
    { id: 'depenses',     label: 'Dépenses',         sublabel: 'Suivi des charges',  icon: Receipt,     href: '/dashboard/depenses',    color: '#2EA043' },
    { id: 'stock',        label: 'Stock & Matériel', sublabel: 'Inventaire',         icon: Package,     href: '/dashboard/stock',       color: '#06B6D4' },
    { id: 'rh',           label: 'RH & Bénévoles',  sublabel: 'Personnel',          icon: Users,       href: '/dashboard/rh',          color: '#388BFD' },
    { id: 'tresorerie',   label: 'Trésorerie',       sublabel: 'Finances',           icon: Wallet,      href: '/dashboard/tresorerie',  color: '#8B5CF6' },
    { id: 'comptabilite', label: 'Comptabilité',     sublabel: 'OHADA',              icon: Calculator,  href: '/dashboard/comptabilite',color: '#EC4899' },
  ],
  banque: [
    { id: 'facturation',  label: 'Comptes clients',  sublabel: 'Prêts & épargne',    icon: FileText,    href: '/dashboard/facturation', color: '#F0A30A' },
    { id: 'comptabilite', label: 'Comptabilité',     sublabel: 'OHADA & reporting',  icon: Calculator,  href: '/dashboard/comptabilite',color: '#388BFD' },
    { id: 'rh',           label: 'RH & Paie',       sublabel: 'Personnel',          icon: Users,       href: '/dashboard/rh',          color: '#2EA043' },
    { id: 'tresorerie',   label: 'Trésorerie',       sublabel: 'Liquidités',         icon: Wallet,      href: '/dashboard/tresorerie',  color: '#8B5CF6' },
  ],
  pharmacie: [
    { id: 'facturation',  label: 'Caisse',           sublabel: 'Ventes & ordonnances',icon: FileText,   href: '/dashboard/facturation', color: '#F0A30A' },
    { id: 'stock',        label: 'Stock médicaments',sublabel: 'Inventaire & péremption',icon: Package, href: '/dashboard/stock',       color: '#2EA043' },
    { id: 'achats',       label: 'Achats',           sublabel: 'Fournisseurs',       icon: ShoppingCart,href: '/dashboard/achats',      color: '#06B6D4' },
    { id: 'rh',           label: 'RH & Paie',       sublabel: 'Personnel',          icon: Users,       href: '/dashboard/rh',          color: '#388BFD' },
    { id: 'tresorerie',   label: 'Trésorerie',       sublabel: 'Finances',           icon: Wallet,      href: '/dashboard/tresorerie',  color: '#8B5CF6' },
    { id: 'comptabilite', label: 'Comptabilité',     sublabel: 'OHADA',              icon: Calculator,  href: '/dashboard/comptabilite',color: '#EC4899' },
  ],
  agriculture: [
    { id: 'facturation',  label: 'Ventes & Récoltes',sublabel: 'Clients & marchés',  icon: FileText,    href: '/dashboard/facturation', color: '#F0A30A' },
    { id: 'stock',        label: 'Stock & Cheptel',  sublabel: 'Inventaire agricole',icon: Package,     href: '/dashboard/stock',       color: '#2EA043' },
    { id: 'achats',       label: 'Achats & Intrants',sublabel: 'Fournisseurs',       icon: ShoppingCart,href: '/dashboard/achats',      color: '#06B6D4' },
    { id: 'depenses',     label: 'Dépenses',         sublabel: 'Charges exploitation',icon: Receipt,    href: '/dashboard/depenses',    color: '#F97316' },
    { id: 'rh',           label: 'RH & Paie',       sublabel: 'Saisonniers & agents',icon: Users,      href: '/dashboard/rh',          color: '#388BFD' },
    { id: 'tresorerie',   label: 'Trésorerie',       sublabel: 'Finances',           icon: Wallet,      href: '/dashboard/tresorerie',  color: '#8B5CF6' },
    { id: 'comptabilite', label: 'Comptabilité',     sublabel: 'OHADA',              icon: Calculator,  href: '/dashboard/comptabilite',color: '#EC4899' },
  ],
}

const SECTOR_LABEL: Record<string, string> = {
  ecole:            'École & Université',
  restaurant:       'Restauration',
  commerce:         'Commerce',
  supermarche:      'Supermarché',
  boutique:         'Boutique',
  boisson:          'Boissons',
  sante:            'Santé',
  transport:        'Transport',
  transport_public: 'Transport Public',
  hotel:            'Hôtellerie',
  btp:              'BTP & Industrie',
  cabinet:          'Cabinet & Conseil',
  petrole:          'Pétrole & Mines',
  ong:              'ONG & Association',
  banque:           'Banque & Microfinance',
  pharmacie:        'Pharmacie',
  agriculture:      'Agriculture',
}

// ── Sidebar ───────────────────────────────────────────────────────────────────

export default function Sidebar() {
  const pathname = usePathname()
  const { t }    = useLocale()

  // ── Tenant data from context (reactive to auth changes) ────────────────────
  const { tenant, loading: tenantLoading } = useTenantContext()

  const nomEntreprise = tenant?.nomEntreprise ?? null
  const secteur       = tenant?.secteur       ?? null
  const role          = tenant?.role          ?? null
  const ecoleRole     = tenant?.ecoleRole     ?? null
  const isSuperAdmin  = tenant?.isSuperAdmin  ?? false

  // ── Local sidebar-only state ───────────────────────────────────────────────
  const [mobileOpen,  setMobileOpen]  = useState(false)
  const [modulesActifs, setModulesActifs] = useState<string[]>([])
  const [permissions,   setPermissions]   = useState<Record<string, ModulePermission>>({})
  const [permsLoaded,   setPermsLoaded]   = useState(false)

  // ── Permissions & modules — reload whenever the logged-in user changes ──────
  // Depending on tenant.userId means this re-runs automatically when
  // TenantContext detects a session change (cross-tab or sequential login).
  useEffect(() => {
    if (!tenant) {
      // No session — reset sidebar permissions state
      setModulesActifs([])
      setPermissions({})
      setPermsLoaded(true)
      return
    }

    if (tenant.role === 'owner') {
      // Owners see all modules, no permission table needed
      setModulesActifs(ALL_MODULES.map(m => m.id))
      setPermissions({})
      setPermsLoaded(true)
      return
    }

    // Non-owner: fetch tenant_modules + user_permissions for this specific user
    let cancelled = false

    async function loadPerms() {
      setPermsLoaded(false)

      // Modules (only relevant for non-sector tenants; sector nav is fixed)
      if (!tenant!.secteur) {
        const { data: tmRows } = await supabase
          .from('tenant_modules')
          .select('module_key')
          .eq('tenant_id', tenant!.tenantId)
          .eq('enabled', true)

        if (!cancelled) {
          setModulesActifs(
            tmRows && tmRows.length > 0
              ? tmRows.map((r: { module_key: string }) => r.module_key)
              : tenant!.modulesActifs,
          )
        }
      }

      // Permissions
      const { data: perms } = await supabase
        .from('user_permissions')
        .select('module_key, can_view, can_edit, can_delete')
        .eq('profile_id', tenant!.profileId)

      if (cancelled) return

      const permMap: Record<string, ModulePermission> = {}
      for (const p of perms ?? []) {
        permMap[p.module_key] = {
          can_view:   p.can_view,
          can_edit:   p.can_edit,
          can_delete: p.can_delete,
        }
      }
      setPermissions(permMap)
      setPermsLoaded(true)
    }

    loadPerms()
    return () => { cancelled = true }
  }, [
    tenant?.userId,
    tenant?.tenantId,
    tenant?.role,
    tenant?.secteur,
    tenant?.profileId,
  ]) // eslint-disable-line react-hooks/exhaustive-deps

  const loaded    = !tenantLoading && permsLoaded
  const isOwner   = role === 'owner'

  function isActive(href: string, exact = false) {
    return exact ? pathname === href : pathname.startsWith(href)
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    // TenantContext fires onAuthStateChange(SIGNED_OUT) → window.location.replace('/login')
    // Hard-navigate here as immediate safety net.
    window.location.href = '/login'
  }

  // ── Résolution de la navigation selon secteur + permissions ────────────────

  const rawSectorItems = secteur ? (SECTOR_NAV[secteur] ?? null) : null

  const sectorNav = rawSectorItems
    ? rawSectorItems.filter(item => {
        if (isOwner) return true
        if (secteur === 'ecole') {
          const allowed = ECOLE_ROLE_VISIBILITY[item.id]
          if (!allowed || allowed.length === 0) return true
          return ecoleRole ? allowed.includes(ecoleRole) : false
        }
        return permissions[item.id]?.can_view === true
      })
    : null

  const coreNavItems     = sectorNav ? sectorNav.filter(item =>  CORE_MODULE_IDS.has(item.id)) : []
  const businessNavItems = sectorNav ? sectorNav.filter(item => !CORE_MODULE_IDS.has(item.id)) : []

  const allActiveModules  = ALL_MODULES.filter(m =>
    modulesActifs.includes(m.id) && (isOwner || permissions[m.id]?.can_view !== false),
  )
  const coreActiveModules     = allActiveModules.filter(m =>  CORE_MODULE_IDS.has(m.id))
  const businessActiveModules = allActiveModules.filter(m => !CORE_MODULE_IDS.has(m.id))
  const inactiveModules       = ALL_MODULES.filter(m => !modulesActifs.includes(m.id))

  // ── Render ─────────────────────────────────────────────────────────────────

  const SidebarContent = () => (
    <div className="flex flex-col h-full overflow-hidden">

      {/* Logo */}
      <div className="border-b border-[#30363D] shrink-0">
        <div className="flex justify-center px-1 pt-3 pb-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="oraforme" className="w-full h-auto object-contain" style={{ maxHeight: 170 }} />
        </div>
        {/* Badge rôle */}
        {role && role !== 'owner' && (
          <div className="px-4 pb-2">
            <span className={`text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded ${
              role === 'admin'
                ? 'bg-blue-500/15 text-blue-400'
                : 'bg-white/5 text-white/30'
            }`}>
              {role === 'admin' ? 'Administrateur' : 'Membre'}
            </span>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 py-3 overflow-y-auto space-y-0.5">

        {/* Direction Générale — s'adapte au secteur */}
        {(() => {
          const hasSector = loaded && !!sectorNav
          const href  = secteur === 'ecole' ? '/dashboard/ecole' : '/dashboard'
          const label = t('nav.dashboard')
          const sub   = hasSector ? t('nav.directionSub') : null
          const active = isActive(href, true)
          return (
            <Link
              href={href}
              onClick={() => setMobileOpen(false)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all ${
                active ? 'bg-[#F0A30A]/10 text-[#F0A30A] font-medium' : 'text-[#8B949E] hover:text-[#E6EDF3] hover:bg-[#21262D]'
              }`}
            >
              <LayoutDashboard size={15} className="shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="truncate">{label}</div>
                {sub && <div className="text-[10px] text-[#484F58] truncate">{sub}</div>}
              </div>
              {active && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-[#F0A30A]" />}
            </Link>
          )
        })()}

        {/* ── Navigation SECTEUR ───────────────────────────────────────────── */}
        {loaded && sectorNav && (
          <>
            {coreNavItems.length > 0 && (
              <>
                <p className="text-xs text-[#484F58] uppercase tracking-wider px-3 pt-3 pb-1">
                  {CORE_SECTION_LABEL}
                </p>
                {coreNavItems.map(item => {
                  const Icon = item.icon
                  const active = isActive(item.href, item.exact)
                  const canEdit = isOwner || permissions[item.id]?.can_edit
                  return (
                    <Link
                      key={item.id}
                      href={item.href}
                      onClick={() => setMobileOpen(false)}
                      className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all group"
                      style={{ background: active ? `${item.color}18` : 'transparent' }}
                    >
                      <Icon size={15} className="shrink-0 transition-colors" style={{ color: active ? item.color : '#484F58' }} />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium leading-tight truncate" style={{ color: active ? item.color : '#8B949E' }}>
                          {item.label}
                        </div>
                        <div className="text-[10px] text-[#484F58] truncate flex items-center gap-1">
                          {item.sublabel}
                          {!isOwner && !canEdit && <Lock size={8} className="text-[#30363D]" />}
                        </div>
                      </div>
                      {active && <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: item.color }} />}
                    </Link>
                  )
                })}
              </>
            )}

            {businessNavItems.length > 0 && (
              <>
                <p className="text-xs text-[#484F58] uppercase tracking-wider px-3 pt-3 pb-1">
                  {SECTOR_LABEL[secteur!] ?? secteur}
                </p>
                {businessNavItems.map(item => {
                  const Icon = item.icon
                  const active = isActive(item.href, item.exact)
                  const canEdit = isOwner || permissions[item.id]?.can_edit
                  return (
                    <Link
                      key={item.id}
                      href={item.href}
                      onClick={() => setMobileOpen(false)}
                      className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all group"
                      style={{ background: active ? `${item.color}18` : 'transparent' }}
                    >
                      <Icon size={15} className="shrink-0 transition-colors" style={{ color: active ? item.color : '#484F58' }} />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium leading-tight truncate" style={{ color: active ? item.color : '#8B949E' }}>
                          {item.label}
                        </div>
                        <div className="text-[10px] text-[#484F58] truncate flex items-center gap-1">
                          {item.sublabel}
                          {!isOwner && !canEdit && <Lock size={8} className="text-[#30363D]" />}
                        </div>
                      </div>
                      {active && <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: item.color }} />}
                    </Link>
                  )
                })}
              </>
            )}

            {sectorNav.length === 0 && (
              <p className="text-xs text-[#484F58] px-3 py-2">Aucun module assigné.</p>
            )}
          </>
        )}

        {/* ── Navigation GÉNÉRIQUE (pas de secteur) ───────────────────────── */}
        {loaded && !sectorNav && (
          <>
            {coreActiveModules.length > 0 && (
              <>
                <p className="text-xs text-[#484F58] uppercase tracking-wider px-3 pt-3 pb-1">{CORE_SECTION_LABEL}</p>
                {coreActiveModules.map(mod => {
                  const Icon = mod.icon
                  const active = isActive(mod.href)
                  return (
                    <Link
                      key={mod.id}
                      href={mod.href}
                      onClick={() => setMobileOpen(false)}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all ${
                        active ? 'bg-[#F0A30A]/10 text-[#F0A30A] font-medium' : 'text-[#8B949E] hover:text-[#E6EDF3] hover:bg-[#21262D]'
                      }`}
                    >
                      <Icon size={15} className="shrink-0" />
                      <span className="truncate">{mod.label}</span>
                      {active && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-[#F0A30A]" />}
                    </Link>
                  )
                })}
              </>
            )}

            {businessActiveModules.length > 0 && (
              <>
                <p className="text-xs text-[#484F58] uppercase tracking-wider px-3 pt-3 pb-1">{t('nav.myModules')}</p>
                {businessActiveModules.map(mod => {
                  const Icon = mod.icon
                  const active = isActive(mod.href)
                  return (
                    <Link
                      key={mod.id}
                      href={mod.href}
                      onClick={() => setMobileOpen(false)}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all ${
                        active ? 'bg-[#F0A30A]/10 text-[#F0A30A] font-medium' : 'text-[#8B949E] hover:text-[#E6EDF3] hover:bg-[#21262D]'
                      }`}
                    >
                      <Icon size={15} className="shrink-0" />
                      <span className="truncate">{mod.label}</span>
                      {active && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-[#F0A30A]" />}
                    </Link>
                  )
                })}
              </>
            )}

            {isOwner && inactiveModules.length > 0 && (
              <>
                <p className="text-xs text-[#484F58] uppercase tracking-wider px-3 pt-3 pb-1">{t('nav.inactive')}</p>
                {inactiveModules.map(mod => {
                  const Icon = mod.icon
                  return (
                    <Link
                      key={mod.id}
                      href={mod.href}
                      onClick={() => setMobileOpen(false)}
                      title={`Accéder à ${mod.label}`}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-[#484F58] hover:text-[#8B949E] hover:bg-[#21262D]/60 transition-all group"
                    >
                      <Icon size={15} className="shrink-0 group-hover:text-[#8B949E]" />
                      <span className="truncate flex-1">{mod.label}</span>
                      <span className="text-[8px] font-bold border border-[#30363D] text-[#30363D] group-hover:border-[#484F58] group-hover:text-[#484F58] rounded px-1 py-0.5 shrink-0 transition-colors">
                        ACTIVER
                      </span>
                    </Link>
                  )
                })}
              </>
            )}
          </>
        )}

        {!loaded && (
          <div className="space-y-1 pt-2">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-9 rounded-lg bg-[#21262D] animate-pulse mx-1" />
            ))}
          </div>
        )}
      </nav>

      {/* Bas */}
      <div className="px-2 py-3 border-t border-[#30363D] shrink-0 space-y-0.5">

        {(isOwner || ecoleRole === 'DIRECTION_GENERALE') && (
          <Link
            href="/dashboard/equipe"
            onClick={() => setMobileOpen(false)}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all ${
              isActive('/dashboard/equipe')
                ? 'bg-[#F0A30A]/10 text-[#F0A30A] font-medium'
                : 'text-[#8B949E] hover:text-[#E6EDF3] hover:bg-[#21262D]'
            }`}
          >
            <UsersRound size={15} className="shrink-0" />
            <span>{t('nav.team')}</span>
          </Link>
        )}

        {(isOwner || ecoleRole === 'DIRECTION_GENERALE') && (
          <Link
            href="/dashboard/roles"
            onClick={() => setMobileOpen(false)}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all ${
              isActive('/dashboard/roles')
                ? 'bg-[#F0A30A]/10 text-[#F0A30A] font-medium'
                : 'text-[#8B949E] hover:text-[#E6EDF3] hover:bg-[#21262D]'
            }`}
          >
            <ShieldCheck size={15} className="shrink-0" />
            <span>{t('nav.roles')}</span>
          </Link>
        )}

        {isOwner && !secteur && (
          <Link
            href="/dashboard/modules"
            onClick={() => setMobileOpen(false)}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all ${
              isActive('/dashboard/modules')
                ? 'bg-[#F0A30A]/10 text-[#F0A30A] font-medium'
                : 'text-[#8B949E] hover:text-[#E6EDF3] hover:bg-[#21262D]'
            }`}
          >
            <Store size={15} className="shrink-0" />
            <span>{t('nav.modules')}</span>
          </Link>
        )}

        {(isOwner || ecoleRole === 'DIRECTION_GENERALE') && (
          <Link
            href="/dashboard/analytics"
            onClick={() => setMobileOpen(false)}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all ${
              isActive('/dashboard/analytics')
                ? 'bg-[#1D4ED8]/10 text-[#388BFD] font-medium'
                : 'text-[#8B949E] hover:text-[#E6EDF3] hover:bg-[#21262D]'
            }`}
          >
            <Activity size={15} className="shrink-0" />
            <span>Analytics & BI</span>
          </Link>
        )}

        <Link
          href="/dashboard/parametres"
          onClick={() => setMobileOpen(false)}
          className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all ${
            isActive('/dashboard/parametres')
              ? 'bg-[#F0A30A]/10 text-[#F0A30A] font-medium'
              : 'text-[#8B949E] hover:text-[#E6EDF3] hover:bg-[#21262D]'
          }`}
        >
          <Settings size={15} className="shrink-0" />
          <span>Paramètres</span>
        </Link>

        {isSuperAdmin && (
          <Link
            href="/admin"
            onClick={() => setMobileOpen(false)}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-[#F85149] hover:bg-[#F85149]/5 transition-all"
          >
            <ShieldAlert size={15} className="shrink-0" />
            <span>Admin oraforme</span>
            <div className="ml-auto w-1.5 h-1.5 rounded-full bg-[#F85149] animate-pulse" />
          </Link>
        )}

        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-[#8B949E] hover:text-red-400 hover:bg-red-500/5 transition-all"
        >
          <LogOut size={15} className="shrink-0" />
          Déconnexion
        </button>
      </div>
    </div>
  )

  return (
    <>
      <aside className="hidden lg:flex w-56 shrink-0 flex-col bg-[#161B22] border-r border-[#30363D] h-screen sticky top-0">
        <SidebarContent />
      </aside>

      <button
        className="lg:hidden fixed top-4 left-4 z-50 p-2 rounded-lg bg-[#161B22] border border-[#30363D] text-[#8B949E]"
        onClick={() => setMobileOpen(!mobileOpen)}
      >
        {mobileOpen ? <X size={18} /> : <Menu size={18} />}
      </button>

      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-40 flex">
          <div className="w-56 bg-[#161B22] border-r border-[#30363D] h-full">
            <SidebarContent />
          </div>
          <div className="flex-1 bg-black/50" onClick={() => setMobileOpen(false)} />
        </div>
      )}
    </>
  )
}

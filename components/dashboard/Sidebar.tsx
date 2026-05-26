'use client'

/**
 * Sidebar Oraforme — Architecture blocs métiers
 * 8 blocs collapsibles : Pilotage | Finance & Compta | RH | Commercial |
 *                        Stock & Achats | Métier | Documents & IA | Paramètres
 *
 * Couleurs : active = #DC2626 / #FEF2F2, hover = #F8FAFC
 * Responsive : overlay mobile + sidebar desktop sticky
 * Permissions : owner > sector-role > user_permissions
 */

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
  ChevronDown,
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
  id:       string
  label:    string
  sublabel?: string
  icon:     LucideIcon
  href:     string
  exact?:   boolean
}

type NavGroup = {
  id:    string
  label: string
  icon:  LucideIcon
  items: NavItem[]
}

// ─── Icon Registry ────────────────────────────────────────────────────────────

const ICONS: Record<string, LucideIcon> = {
  // Pilotage
  direction:     BarChart2,
  finance:       TrendingUp,
  analytics:     Activity,
  audit:         ShieldAlert,
  notifications: Bell,
  // Finance & Compta
  comptabilite:  Calculator,
  tresorerie:    Wallet,
  facturation:   FileText,
  depenses:      Receipt,
  // RH & Organisation
  rh:            Users,
  roles:         ShieldCheck,
  // Commercial
  crm:           UsersRound,
  // Stock & Achats
  stock:         Package,
  achats:        ShoppingCart,
  // Documents & IA
  ged:           FolderOpen,
  bizbot:        Bot,
  // Paramètres
  profil:        Building2,
  parametres:    Settings,
  // École sector
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
  // Autres secteurs
  restaurant:   ChefHat,
  cuisine:      ChefHat,
  hotel:        Hotel,
  transport:    Truck,
  // No-sector extras
  ecole:        GraduationCap,
}

// ─── Module Registry (all known modules) ─────────────────────────────────────

type ModuleDef = { id: string; label: string; sublabel: string; href: string }

const MODULE_DEFS: ModuleDef[] = [
  ...(CORE_ERP_MODULES as unknown as ModuleDef[]),
  ...(PLATFORM_MODULES as unknown as ModuleDef[]),
  // Extras for no-sector owners
  { id: 'ecole',     label: 'École & Université',  sublabel: 'Gestion académique',      href: '/dashboard/ecole'      },
  { id: 'restaurant',label: 'Restauration POS',    sublabel: 'Service & commandes',     href: '/dashboard/restaurant' },
  { id: 'hotel',     label: 'Hôtellerie',           sublabel: 'Réservations & chambres', href: '/dashboard/hotel'      },
  { id: 'transport', label: 'Transport VTC',        sublabel: 'Flotte & courses',        href: '/dashboard/transport'  },
]

function getModuleDef(id: string): ModuleDef | undefined {
  return MODULE_DEFS.find(m => m.id === id)
}

// ─── Sidebar Groups definition ────────────────────────────────────────────────

type GroupDef = { id: string; label: string; icon: LucideIcon; moduleIds: string[] }

const SIDEBAR_GROUPS: GroupDef[] = [
  {
    id:        'pilotage',
    label:     'Pilotage',
    icon:      LayoutDashboard,
    moduleIds: ['direction', 'finance', 'analytics', 'audit', 'notifications'],
  },
  {
    id:        'finance_ops',
    label:     'Finance & Compta',
    icon:      Calculator,
    moduleIds: ['comptabilite', 'tresorerie', 'facturation', 'depenses'],
  },
  {
    id:        'rh_org',
    label:     'RH & Organisation',
    icon:      Users,
    moduleIds: ['rh', 'roles'],
  },
  {
    id:        'commercial',
    label:     'Commercial',
    icon:      UsersRound,
    moduleIds: ['crm'],
  },
  {
    id:        'supply',
    label:     'Stock & Achats',
    icon:      Package,
    moduleIds: ['stock', 'achats'],
  },
  // Métier group is dynamic — built from SECTOR_SPECIFIC (sector tenants)
  // or from no-sector modulesActifs (ecole/restaurant/hotel/transport)
  {
    id:        'docs_ai',
    label:     'Documents & IA',
    icon:      FolderOpen,
    moduleIds: ['ged', 'bizbot'],
  },
  {
    id:        'params',
    label:     'Paramètres',
    icon:      Settings,
    moduleIds: ['profil', 'parametres'],
  },
]

// ─── Platform-restricted (only owner / DG école) ──────────────────────────────

const PLATFORM_RESTRICTED = new Set(['analytics', 'roles', 'audit'])

// ─── All module IDs (for owner default activation) ───────────────────────────

const ALL_MODULE_IDS = [
  ...CORE_ERP_MODULES.map(m => m.id),
  ...PLATFORM_MODULES.map(m => m.id),
  'ecole', 'restaurant', 'hotel', 'transport',
]

// ─── Sector icon helper ───────────────────────────────────────────────────────

function getSectorIcon(secteur: string): LucideIcon {
  const MAP: Record<string, LucideIcon> = {
    ecole:            GraduationCap,
    restaurant:       ChefHat,
    hotel:            Hotel,
    transport:        Truck,
    transport_public: Truck,
    commerce:         Store,
    supermarche:      Store,
    boutique:         Store,
    sante:            Activity,
    btp:              Building2,
    cabinet:          BookOpen,
    boisson:          Package,
    ong:              HeartHandshake,
    banque:           Wallet,
    pharmacie:        Package,
    petrole:          Package,
    agriculture:      Package,
  }
  return MAP[secteur] ?? Settings
}

// ─── Sidebar Component ────────────────────────────────────────────────────────

export default function Sidebar() {
  const pathname   = usePathname()
  const { t }      = useLocale()
  const { tenant, loading: tenantLoading } = useTenantContext()

  const secteur      = tenant?.secteur    ?? null
  const role         = tenant?.role       ?? null
  const ecoleRole    = tenant?.ecoleRole  ?? null
  const isSuperAdmin = tenant?.isSuperAdmin ?? false

  const [mobileOpen,    setMobileOpen]    = useState(false)
  const [modulesActifs, setModulesActifs] = useState<string[]>([])
  const [permissions,   setPermissions]   = useState<Record<string, ModulePermission>>({})
  const [permsLoaded,   setPermsLoaded]   = useState(false)

  // Accordion open state — all groups open by default
  const [openGroups, setOpenGroups] = useState<Set<string>>(
    new Set([...SIDEBAR_GROUPS.map(g => g.id), 'metier'])
  )

  function toggleGroup(gid: string) {
    setOpenGroups(prev => {
      const next = new Set(prev)
      next.has(gid) ? next.delete(gid) : next.add(gid)
      return next
    })
  }

  // ── Load permissions ──────────────────────────────────────────────────────

  useEffect(() => {
    if (!tenant) {
      setModulesActifs([])
      setPermissions({})
      setPermsLoaded(true)
      return
    }

    if (tenant.role === 'owner') {
      setModulesActifs(ALL_MODULE_IDS)
      setPermissions({})
      setPermsLoaded(true)
      return
    }

    let cancelled = false

    async function loadPerms() {
      setPermsLoaded(false)

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

  const loaded  = !tenantLoading && permsLoaded
  const isOwner = role === 'owner'

  // ── Active route check ────────────────────────────────────────────────────

  const isActive = useCallback((href: string, exact = false): boolean => {
    return exact ? pathname === href : pathname.startsWith(href)
  }, [pathname])

  // ── Permission check for a module id ────────────────────────────────────

  const canView = useCallback((id: string): boolean => {
    if (isOwner) return true

    // Platform restricted → only owner or école DG
    if (PLATFORM_RESTRICTED.has(id)) {
      return ecoleRole === 'DIRECTION_GENERALE'
    }

    // École sector → ECOLE_CORE_ROLE_FILTER applies
    if (secteur === 'ecole') {
      const allowed = ECOLE_CORE_ROLE_FILTER[id]
      if (allowed && allowed.length > 0) {
        return ecoleRole ? allowed.includes(ecoleRole) : false
      }
      return permissions[id]?.can_view !== false
    }

    // No-sector tenant → module must be active
    if (!secteur) {
      if (!modulesActifs.includes(id)) return false
      return permissions[id]?.can_view !== false
    }

    // Sector tenant (non-école) → user permissions
    return permissions[id]?.can_view !== false
  }, [isOwner, ecoleRole, secteur, permissions, modulesActifs])

  // ── Build visible groups ─────────────────────────────────────────────────

  const visibleGroups = useMemo((): NavGroup[] => {
    if (!loaded) return []

    return SIDEBAR_GROUPS.map(grp => {
      const items: NavItem[] = []

      for (const mid of grp.moduleIds) {
        if (!canView(mid)) continue
        const def = getModuleDef(mid)
        if (!def) continue
        items.push({
          id:       mid,
          label:    def.label,
          sublabel: def.sublabel,
          icon:     ICONS[mid] ?? Settings,
          href:     def.href,
        })
      }

      return { ...grp, items }
    }).filter(g => g.items.length > 0)
  }, [loaded, canView])

  // ── Sector "Métier" group (sector tenants) ───────────────────────────────

  const metierGroup = useMemo((): NavGroup | null => {
    if (!loaded) return null

    // ── Case 1 : tenant has a sector → show SECTOR_SPECIFIC ──────────────
    if (secteur) {
      const sectorItems = (SECTOR_SPECIFIC[secteur as SectorId] ?? [])
        .map(mod => ({
          id:       mod.id,
          label:    mod.label,
          sublabel: mod.sublabel,
          icon:     ICONS[mod.id] ?? Settings,
          href:     mod.href,
        }))
        .filter(item => {
          if (isOwner) return true
          if (secteur === 'ecole') {
            const sItem = SECTOR_SPECIFIC['ecole']?.find(m => m.id === item.id)
            const rf    = sItem?.roleFilter
            if (!rf || rf.length === 0) return true
            return ecoleRole ? rf.includes(ecoleRole) : false
          }
          return permissions[item.id]?.can_view !== false
        })

      if (sectorItems.length === 0) return null

      return {
        id:    'metier',
        label: SECTOR_LABELS[secteur] ?? secteur,
        icon:  getSectorIcon(secteur),
        items: sectorItems,
      }
    }

    // ── Case 2 : no sector → show sector dashboards from modulesActifs ────
    const EXTRA_IDS = ['ecole', 'restaurant', 'hotel', 'transport']
    const extraItems: NavItem[] = []

    for (const mid of EXTRA_IDS) {
      if (!modulesActifs.includes(mid)) continue
      if (permissions[mid]?.can_view === false) continue
      const def = getModuleDef(mid)
      if (!def) continue
      extraItems.push({
        id:       mid,
        label:    def.label,
        sublabel: def.sublabel,
        icon:     ICONS[mid] ?? Settings,
        href:     def.href,
      })
    }

    if (extraItems.length === 0) return null

    return {
      id:    'metier',
      label: 'Modules Sectoriels',
      icon:  Store,
      items: extraItems,
    }
  }, [loaded, secteur, isOwner, ecoleRole, permissions, modulesActifs])

  // ── Dashboard href ────────────────────────────────────────────────────────

  const dashHref   = secteur === 'ecole' ? '/dashboard/ecole' : '/dashboard'
  const dashActive = isActive(dashHref, true)

  // ── Logout ────────────────────────────────────────────────────────────────

  async function handleLogout() {
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  // ── Style tokens ──────────────────────────────────────────────────────────

  const ITEM_ACTIVE   = 'bg-[#FEF2F2] text-[#DC2626] border-l-2 border-[#DC2626] font-semibold'
  const ITEM_INACTIVE = 'text-[#64748B] border-l-2 border-transparent hover:bg-[#F8FAFC] hover:text-[#0F172A]'
  const ITEM_BASE     = 'flex items-center gap-2.5 pl-3 pr-2 py-2 rounded-r-lg text-[13px] transition-all duration-150'

  // ── Sub-components ────────────────────────────────────────────────────────

  function NavLink({ item }: { item: NavItem }) {
    const active  = isActive(item.href, item.exact)
    const canEdit = isOwner || permissions[item.id]?.can_edit
    const Icon    = item.icon
    return (
      <Link
        href={item.href}
        onClick={() => setMobileOpen(false)}
        className={`${ITEM_BASE} ${active ? ITEM_ACTIVE : ITEM_INACTIVE}`}
      >
        <Icon
          size={13}
          className={`shrink-0 ${active ? 'text-[#DC2626]' : 'text-[#94A3B8]'}`}
        />
        <div className="flex-1 min-w-0">
          <div className="truncate leading-tight">{item.label}</div>
          {item.sublabel && (
            <div className="text-[10px] text-[#94A3B8] truncate flex items-center gap-1 leading-none mt-0.5">
              {item.sublabel}
              {!isOwner && !canEdit && <Lock size={7} className="text-[#CBD5E1] shrink-0" />}
            </div>
          )}
        </div>
      </Link>
    )
  }

  function GroupBlock({ group }: { group: NavGroup }) {
    const isOpen    = openGroups.has(group.id)
    const GroupIcon = group.icon
    const hasActive = group.items.some(item => isActive(item.href, item.exact))

    return (
      <div>
        <button
          onClick={() => toggleGroup(group.id)}
          className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all duration-150 ${
            hasActive ? 'text-[#DC2626]' : 'text-[#94A3B8] hover:text-[#64748B]'
          }`}
        >
          <GroupIcon
            size={10}
            className={hasActive ? 'text-[#DC2626]' : 'text-[#CBD5E1]'}
          />
          <span className="flex-1 text-left">{group.label}</span>
          <ChevronDown
            size={10}
            className={`transition-transform duration-200 ${isOpen ? 'rotate-0' : '-rotate-90'}`}
          />
        </button>

        <div
          className={`overflow-hidden transition-all duration-200 ${
            isOpen ? 'max-h-[1000px] opacity-100' : 'max-h-0 opacity-0'
          }`}
        >
          <div className="space-y-0.5 pt-0.5 pl-1">
            {group.items.map(item => (
              <NavLink key={item.id} item={item} />
            ))}
          </div>
        </div>
      </div>
    )
  }

  // ── Sidebar content ───────────────────────────────────────────────────────

  const SidebarContent = () => (
    <div className="flex flex-col h-full overflow-hidden">

      {/* ── Logo ── */}
      <div className="border-b border-[#E5E7EB] shrink-0 px-4 py-3">
        <div className="flex items-center gap-2.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-icon.png" alt="oraforme" width={32} height={32} className="shrink-0" />
          <span className="text-[16px] font-extrabold text-[#0F172A] tracking-tight">
            oraforme
          </span>
          {secteur && (
            <span className="ml-auto shrink-0 text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-[#FEF2F2] text-[#DC2626]">
              {(SECTOR_LABELS[secteur] ?? secteur).split(/[ &]/)[0]}
            </span>
          )}
        </div>
        {role && role !== 'owner' && (
          <div className="mt-1.5">
            <span className={`text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded ${
              role === 'admin' ? 'bg-blue-100 text-blue-600' : 'bg-[#F8FAFC] text-[#64748B] border border-[#E5E7EB]'
            }`}>
              {role === 'admin' ? 'Administrateur' : 'Membre'}
            </span>
          </div>
        )}
      </div>

      {/* ── Navigation ── */}
      <nav className="flex-1 px-2 py-3 overflow-y-auto scrollbar-hide">

        {/* Dashboard — toujours en tête */}
        <Link
          href={dashHref}
          onClick={() => setMobileOpen(false)}
          className={`${ITEM_BASE} mb-2 ${dashActive ? ITEM_ACTIVE : ITEM_INACTIVE}`}
        >
          <LayoutDashboard
            size={13}
            className={`shrink-0 ${dashActive ? 'text-[#DC2626]' : 'text-[#94A3B8]'}`}
          />
          <span className="font-medium">{t('nav.dashboard')}</span>
        </Link>

        {/* Loading skeleton */}
        {!loaded && (
          <div className="space-y-1.5 pt-1">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-8 rounded-lg bg-[#F1F5F9] animate-pulse" />
            ))}
          </div>
        )}

        {/* ── Blocs métiers ── */}
        {loaded && (
          <div className="space-y-0.5">

            {/* 1-5 & 7-8 : groupes universels */}
            {visibleGroups.map((group, idx) => {
              // Insérer le bloc Métier après "Stock & Achats" (group id = 'supply')
              const insertMetierAfter = group.id === 'supply'
              return (
                <div key={group.id}>
                  <GroupBlock group={group} />
                  {insertMetierAfter && metierGroup && (
                    <GroupBlock group={metierGroup} />
                  )}
                </div>
              )
            })}

            {/* Si supply n'est pas visible mais metierGroup existe, l'ajouter à la fin */}
            {!visibleGroups.find(g => g.id === 'supply') && metierGroup && (
              <GroupBlock group={metierGroup} />
            )}

            {/* Marketplace (owner, no sector) */}
            {isOwner && !secteur && (
              <Link
                href="/dashboard/modules"
                onClick={() => setMobileOpen(false)}
                className={`${ITEM_BASE} mt-1 ${isActive('/dashboard/modules') ? ITEM_ACTIVE : ITEM_INACTIVE}`}
              >
                <Store
                  size={13}
                  className={`shrink-0 ${isActive('/dashboard/modules') ? 'text-[#DC2626]' : 'text-[#94A3B8]'}`}
                />
                <span>{t('nav.modules')}</span>
              </Link>
            )}
          </div>
        )}
      </nav>

      {/* ── Bottom actions ── */}
      <div className="px-2 py-3 border-t border-[#E5E7EB] shrink-0 space-y-0.5">
        {isSuperAdmin && (
          <Link
            href="/admin"
            onClick={() => setMobileOpen(false)}
            className="flex items-center gap-2.5 pl-3 pr-2 py-2 rounded-lg text-[13px] text-[#DC2626] hover:bg-[#FEF2F2] transition-all duration-150"
          >
            <ShieldAlert size={13} className="shrink-0" />
            <span className="font-medium">Admin oraforme</span>
            <div className="ml-auto w-1.5 h-1.5 rounded-full bg-[#DC2626] animate-pulse" />
          </Link>
        )}

        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-2.5 pl-3 pr-2 py-2 rounded-lg text-[13px] text-[#64748B] hover:text-[#DC2626] hover:bg-[#FEF2F2] transition-all duration-150"
        >
          <LogOut size={13} className="shrink-0" />
          <span>Déconnexion</span>
        </button>
      </div>
    </div>
  )

  return (
    <>
      {/* ── Desktop sidebar ── */}
      <aside className="hidden lg:flex w-56 shrink-0 flex-col bg-white border-r border-[#E5E7EB] h-screen sticky top-0">
        <SidebarContent />
      </aside>

      {/* ── Mobile toggle button ── */}
      <button
        className="lg:hidden fixed top-4 left-4 z-50 p-2 rounded-lg bg-white border border-[#E5E7EB] text-[#0F172A] shadow-sm"
        onClick={() => setMobileOpen(o => !o)}
        aria-label="Menu"
      >
        {mobileOpen ? <X size={18} /> : <Menu size={18} />}
      </button>

      {/* ── Mobile overlay ── */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-40 flex">
          <div className="w-56 bg-white border-r border-[#E5E7EB] h-full shadow-xl">
            <SidebarContent />
          </div>
          <div
            className="flex-1 bg-black/40 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
        </div>
      )}
    </>
  )
}

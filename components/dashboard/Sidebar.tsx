'use client'

/**
 * Sidebar Oraforme — Architecture blocs métiers colorés
 * Fond blanc · Entêtes de blocs colorées · Items propres et espacés
 * 8 blocs : Pilotage | Finance & Compta | RH | Commercial |
 *           Stock & Achats | Métier | Documents & IA | Paramètres
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
  color: GroupColor
}

type GroupColor = {
  header: string   // fond de l'entête
  active: string   // fond item actif
  text:   string   // texte item actif
  dot:    string   // couleur accent
}

// ─── Palette des blocs ────────────────────────────────────────────────────────

const COLORS: Record<string, GroupColor> = {
  pilotage:    { header: '#2563EB', active: '#EFF6FF', text: '#1D4ED8', dot: '#2563EB' },
  finance_ops: { header: '#16A34A', active: '#F0FDF4', text: '#15803D', dot: '#16A34A' },
  rh_org:      { header: '#7C3AED', active: '#F5F3FF', text: '#6D28D9', dot: '#7C3AED' },
  commercial:  { header: '#F59E0B', active: '#FFFBEB', text: '#B45309', dot: '#F59E0B' },
  supply:      { header: '#DC2626', active: '#FEF2F2', text: '#B91C1C', dot: '#DC2626' },
  metier:      { header: '#0891B2', active: '#ECFEFF', text: '#0E7490', dot: '#0891B2' },
  docs_ai:     { header: '#64748B', active: '#F8FAFC', text: '#334155', dot: '#64748B' },
  params:      { header: '#475569', active: '#F1F5F9', text: '#334155', dot: '#475569' },
}

// Couleur métier selon secteur
function getSectorColor(secteur: string): GroupColor {
  const MAP: Record<string, GroupColor> = {
    ecole:            { header: '#7C3AED', active: '#F5F3FF', text: '#6D28D9', dot: '#7C3AED' },
    restaurant:       { header: '#EA580C', active: '#FFF7ED', text: '#C2410C', dot: '#EA580C' },
    hotel:            { header: '#F59E0B', active: '#FFFBEB', text: '#B45309', dot: '#F59E0B' },
    transport:        { header: '#0891B2', active: '#ECFEFF', text: '#0E7490', dot: '#0891B2' },
    transport_public: { header: '#0891B2', active: '#ECFEFF', text: '#0E7490', dot: '#0891B2' },
    commerce:         { header: '#F59E0B', active: '#FFFBEB', text: '#B45309', dot: '#F59E0B' },
    supermarche:      { header: '#16A34A', active: '#F0FDF4', text: '#15803D', dot: '#16A34A' },
    boutique:         { header: '#EC4899', active: '#FDF2F8', text: '#BE185D', dot: '#EC4899' },
    sante:            { header: '#DC2626', active: '#FEF2F2', text: '#B91C1C', dot: '#DC2626' },
    btp:              { header: '#92400E', active: '#FFFBEB', text: '#78350F', dot: '#92400E' },
    banque:           { header: '#1D4ED8', active: '#EFF6FF', text: '#1E3A8A', dot: '#1D4ED8' },
    ong:              { header: '#059669', active: '#ECFDF5', text: '#065F46', dot: '#059669' },
    pharmacie:        { header: '#0891B2', active: '#ECFEFF', text: '#0E7490', dot: '#0891B2' },
    petrole:          { header: '#374151', active: '#F9FAFB', text: '#111827', dot: '#374151' },
    agriculture:      { header: '#65A30D', active: '#F7FEE7', text: '#3F6212', dot: '#65A30D' },
  }
  return MAP[secteur] ?? COLORS.metier
}

// ─── Icon Registry ────────────────────────────────────────────────────────────

const ICONS: Record<string, LucideIcon> = {
  direction:     BarChart2,
  finance:       TrendingUp,
  analytics:     Activity,
  audit:         ShieldAlert,
  notifications: Bell,
  comptabilite:  Calculator,
  tresorerie:    Wallet,
  facturation:   FileText,
  depenses:      Receipt,
  rh:            Users,
  roles:         ShieldCheck,
  crm:           UsersRound,
  stock:         Package,
  achats:        ShoppingCart,
  ged:           FolderOpen,
  bizbot:        Bot,
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
  transport:    Truck,
  ecole:        GraduationCap,
}

// ─── Module Registry ──────────────────────────────────────────────────────────

type ModuleDef = { id: string; label: string; sublabel: string; href: string }

const MODULE_DEFS: ModuleDef[] = [
  ...(CORE_ERP_MODULES as unknown as ModuleDef[]),
  ...(PLATFORM_MODULES as unknown as ModuleDef[]),
  { id: 'ecole',     label: 'École & Université',  sublabel: 'Gestion académique',      href: '/dashboard/ecole'      },
  { id: 'restaurant',label: 'Restauration POS',    sublabel: 'Service & commandes',     href: '/dashboard/restaurant' },
  { id: 'hotel',     label: 'Hôtellerie',           sublabel: 'Réservations & chambres', href: '/dashboard/hotel'      },
  { id: 'transport', label: 'Transport VTC',        sublabel: 'Flotte & courses',        href: '/dashboard/transport'  },
]

const getModuleDef = (id: string) => MODULE_DEFS.find(m => m.id === id)

// ─── Sidebar Group definitions ────────────────────────────────────────────────

const SIDEBAR_GROUPS = [
  { id: 'pilotage',    label: 'Pilotage',          icon: LayoutDashboard, moduleIds: ['direction', 'finance', 'analytics', 'audit', 'notifications'] },
  { id: 'finance_ops', label: 'Finance & Compta',  icon: Calculator,      moduleIds: ['comptabilite', 'tresorerie', 'facturation', 'depenses'] },
  { id: 'rh_org',      label: 'RH & Organisation', icon: Users,           moduleIds: ['rh', 'roles'] },
  { id: 'commercial',  label: 'Commercial',         icon: UsersRound,      moduleIds: ['crm'] },
  { id: 'supply',      label: 'Stock & Achats',     icon: Package,         moduleIds: ['stock', 'achats'] },
  { id: 'docs_ai',     label: 'Documents & IA',     icon: FolderOpen,      moduleIds: ['ged', 'bizbot'] },
  { id: 'params',      label: 'Paramètres',          icon: Settings,        moduleIds: ['profil', 'parametres'] },
]

const PLATFORM_RESTRICTED = new Set(['analytics', 'roles', 'audit'])

const ALL_MODULE_IDS = [
  ...CORE_ERP_MODULES.map(m => m.id),
  ...PLATFORM_MODULES.map(m => m.id),
  'ecole', 'restaurant', 'hotel', 'transport',
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

// ─── Sidebar ──────────────────────────────────────────────────────────────────

export default function Sidebar() {
  const pathname = usePathname()
  const { t }    = useLocale()
  const { tenant, loading: tenantLoading } = useTenantContext()

  const secteur      = tenant?.secteur    ?? null
  const role         = tenant?.role       ?? null
  const ecoleRole    = tenant?.ecoleRole  ?? null
  const isSuperAdmin = tenant?.isSuperAdmin ?? false

  const [mobileOpen,    setMobileOpen]    = useState(false)
  const [modulesActifs, setModulesActifs] = useState<string[]>([])
  const [permissions,   setPermissions]   = useState<Record<string, ModulePermission>>({})
  const [permsLoaded,   setPermsLoaded]   = useState(false)

  // Tous les blocs ouverts par défaut
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

  // ── Permissions ────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!tenant) {
      setModulesActifs([]); setPermissions({}); setPermsLoaded(true); return
    }
    if (tenant.role === 'owner') {
      setModulesActifs(ALL_MODULE_IDS); setPermissions({}); setPermsLoaded(true); return
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
        .select('module_key, can_view, can_edit, can_delete')
        .eq('profile_id', tenant!.profileId)
      if (cancelled) return
      const permMap: Record<string, ModulePermission> = {}
      for (const p of perms ?? []) {
        permMap[p.module_key] = { can_view: p.can_view, can_edit: p.can_edit, can_delete: p.can_delete }
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
    if (isOwner) return true
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

  // ── Build groups ───────────────────────────────────────────────────────────

  const visibleGroups = useMemo((): NavGroup[] => {
    if (!loaded) return []
    return SIDEBAR_GROUPS.map(grp => {
      const items: NavItem[] = []
      for (const mid of grp.moduleIds) {
        if (!canView(mid)) continue
        const def = getModuleDef(mid)
        if (!def) continue
        items.push({ id: mid, label: def.label, sublabel: def.sublabel, icon: ICONS[mid] ?? Settings, href: def.href })
      }
      return { ...grp, items, color: COLORS[grp.id] }
    }).filter(g => g.items.length > 0)
  }, [loaded, canView])

  const metierGroup = useMemo((): NavGroup | null => {
    if (!loaded) return null
    if (secteur) {
      const sectorItems = (SECTOR_SPECIFIC[secteur as SectorId] ?? [])
        .map(mod => ({ id: mod.id, label: mod.label, sublabel: mod.sublabel, icon: ICONS[mod.id] ?? Settings, href: mod.href }))
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
      return { id: 'metier', label: SECTOR_LABELS[secteur] ?? secteur, icon: getSectorIcon(secteur), items: sectorItems, color: getSectorColor(secteur) }
    }
    const EXTRA_IDS = ['ecole', 'restaurant', 'hotel', 'transport']
    const extraItems: NavItem[] = []
    for (const mid of EXTRA_IDS) {
      if (!modulesActifs.includes(mid) || permissions[mid]?.can_view === false) continue
      const def = getModuleDef(mid)
      if (def) extraItems.push({ id: mid, label: def.label, sublabel: def.sublabel, icon: ICONS[mid] ?? Settings, href: def.href })
    }
    if (!extraItems.length) return null
    return { id: 'metier', label: 'Modules Sectoriels', icon: Store, items: extraItems, color: COLORS.metier }
  }, [loaded, secteur, isOwner, ecoleRole, permissions, modulesActifs])

  const dashHref   = secteur === 'ecole' ? '/dashboard/ecole' : '/dashboard'
  const dashActive = isActive(dashHref, true)

  async function handleLogout() {
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  // ── NavItem renderer ───────────────────────────────────────────────────────

  function NavLink({ item, color }: { item: NavItem; color: GroupColor }) {
    const active  = isActive(item.href, item.exact)
    const canEdit = isOwner || permissions[item.id]?.can_edit
    const Icon    = item.icon
    return (
      <Link
        href={item.href}
        onClick={() => setMobileOpen(false)}
        className="flex items-center gap-2.5 mx-1 px-3 py-2 rounded-xl text-[12.5px] transition-all duration-150"
        style={active
          ? { background: color.active, color: color.text, fontWeight: 600 }
          : undefined
        }
      >
        <Icon
          size={13}
          className="shrink-0 transition-colors"
          style={{ color: active ? color.text : '#94A3B8' }}
        />
        <div className="flex-1 min-w-0">
          <div
            className="truncate leading-tight"
            style={{ color: active ? color.text : '#374151' }}
          >
            {item.label}
          </div>
          {item.sublabel && (
            <div className="text-[10px] truncate leading-none mt-0.5 flex items-center gap-1"
              style={{ color: '#94A3B8' }}>
              {item.sublabel}
              {!isOwner && !canEdit && <Lock size={7} className="text-[#CBD5E1] shrink-0" />}
            </div>
          )}
        </div>
        {active && (
          <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: color.dot }} />
        )}
      </Link>
    )
  }

  // ── Group block renderer ───────────────────────────────────────────────────

  function GroupBlock({ group }: { group: NavGroup }) {
    const isOpen    = openGroups.has(group.id)
    const GroupIcon = group.icon
    const hasActive = group.items.some(item => isActive(item.href, item.exact))

    return (
      <div className="mb-1.5">
        {/* ── Entête colorée ── */}
        <button
          onClick={() => toggleGroup(group.id)}
          className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl transition-all duration-150 group"
          style={{ background: group.color.header }}
        >
          <GroupIcon size={13} className="shrink-0 text-white/90" />
          <span className="flex-1 text-left text-[11px] font-bold uppercase tracking-wider text-white/95">
            {group.label}
          </span>
          <ChevronDown
            size={11}
            className="text-white/70 transition-transform duration-200"
            style={{ transform: isOpen ? 'rotate(0deg)' : 'rotate(-90deg)' }}
          />
        </button>

        {/* ── Items ── */}
        <div
          className="overflow-hidden transition-all duration-200"
          style={{
            maxHeight: isOpen ? `${group.items.length * 64}px` : '0px',
            opacity: isOpen ? 1 : 0,
          }}
        >
          <div className="pt-1 pb-0.5 space-y-0.5">
            {group.items.map(item => (
              <NavLink key={item.id} item={item} color={group.color} />
            ))}
          </div>
        </div>
      </div>
    )
  }

  // ── Sidebar Content ────────────────────────────────────────────────────────

  const SidebarContent = () => (
    <div className="flex flex-col h-full overflow-hidden bg-white">

      {/* ── Logo ── */}
      <div className="shrink-0 px-4 pt-4 pb-3 border-b border-[#F1F5F9]">
        <div className="flex items-center gap-2.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-icon.png" alt="oraforme" width={32} height={32} className="shrink-0" />
          <span className="text-[16px] font-extrabold text-[#0F172A] tracking-tight">
            oraforme
          </span>
          {secteur && (
            <span
              className="ml-auto shrink-0 text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md text-white"
              style={{ background: getSectorColor(secteur).header }}
            >
              {(SECTOR_LABELS[secteur] ?? secteur).split(/[ &]/)[0]}
            </span>
          )}
        </div>
        {role && role !== 'owner' && (
          <div className="mt-2">
            <span className={`text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded ${
              role === 'admin' ? 'bg-blue-100 text-blue-600' : 'bg-[#F8FAFC] text-[#64748B] border border-[#E5E7EB]'
            }`}>
              {role === 'admin' ? 'Administrateur' : 'Membre'}
            </span>
          </div>
        )}
      </div>

      {/* ── Navigation ── */}
      <nav className="flex-1 px-2 py-3 overflow-y-auto scrollbar-hide space-y-0.5">

        {/* Dashboard — standalone, toujours premier */}
        <Link
          href={dashHref}
          onClick={() => setMobileOpen(false)}
          className="flex items-center gap-2.5 mx-1 px-3 py-2.5 rounded-xl text-[12.5px] font-semibold transition-all duration-150 mb-3"
          style={dashActive
            ? { background: '#0F172A', color: '#FFFFFF' }
            : { color: '#374151' }
          }
        >
          <LayoutDashboard
            size={14}
            className="shrink-0"
            style={{ color: dashActive ? '#FFFFFF' : '#94A3B8' }}
          />
          <span>{t('nav.dashboard')}</span>
          {dashActive && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-white/60" />}
        </Link>

        {/* Skeleton */}
        {!loaded && (
          <div className="space-y-2 px-1">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-9 rounded-xl animate-pulse" style={{ background: `hsl(${210 + i * 30}, 60%, 92%)` }} />
            ))}
          </div>
        )}

        {/* ── Blocs colorés ── */}
        {loaded && (
          <>
            {visibleGroups.map(group => {
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

            {/* Métier si supply absent */}
            {!visibleGroups.find(g => g.id === 'supply') && metierGroup && (
              <GroupBlock group={metierGroup} />
            )}

            {/* Marketplace */}
            {isOwner && !secteur && (
              <Link
                href="/dashboard/modules"
                onClick={() => setMobileOpen(false)}
                className="flex items-center gap-2.5 mx-1 px-3 py-2 rounded-xl text-[12.5px] transition-all duration-150"
                style={isActive('/dashboard/modules')
                  ? { background: '#F1F5F9', color: '#0F172A', fontWeight: 600 }
                  : { color: '#64748B' }
                }
              >
                <Store size={13} className="shrink-0" style={{ color: isActive('/dashboard/modules') ? '#0F172A' : '#94A3B8' }} />
                <span>{t('nav.modules')}</span>
              </Link>
            )}
          </>
        )}
      </nav>

      {/* ── Bottom ── */}
      <div className="shrink-0 px-2 py-3 border-t border-[#F1F5F9] space-y-0.5">
        {isSuperAdmin && (
          <Link
            href="/admin"
            onClick={() => setMobileOpen(false)}
            className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-[12.5px] font-medium transition-all duration-150"
            style={{ color: '#DC2626' }}
            onMouseEnter={e => (e.currentTarget.style.background = '#FEF2F2')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          >
            <ShieldAlert size={13} className="shrink-0" />
            <span>Admin oraforme</span>
            <div className="ml-auto w-1.5 h-1.5 rounded-full bg-[#DC2626] animate-pulse" />
          </Link>
        )}
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-[12.5px] text-[#64748B] transition-all duration-150"
          onMouseEnter={e => { e.currentTarget.style.background = '#FEF2F2'; e.currentTarget.style.color = '#DC2626' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#64748B' }}
        >
          <LogOut size={13} className="shrink-0" />
          <span>Déconnexion</span>
        </button>
      </div>
    </div>
  )

  return (
    <>
      {/* Desktop */}
      <aside className="hidden lg:flex w-58 shrink-0 flex-col bg-white border-r border-[#E5E7EB] h-screen sticky top-0" style={{ width: 228 }}>
        <SidebarContent />
      </aside>

      {/* Mobile toggle */}
      <button
        className="lg:hidden fixed top-4 left-4 z-50 p-2 rounded-xl bg-white border border-[#E5E7EB] text-[#0F172A] shadow-sm"
        onClick={() => setMobileOpen(o => !o)}
        aria-label="Menu"
      >
        {mobileOpen ? <X size={18} /> : <Menu size={18} />}
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-40 flex">
          <div style={{ width: 228 }} className="bg-white border-r border-[#E5E7EB] h-full shadow-2xl">
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

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
} from 'lucide-react'
import {
  CORE_ERP_MODULES,
  SECTOR_SPECIFIC,
  PLATFORM_MODULES,
  SECTOR_LABELS,
  ECOLE_CORE_ROLE_FILTER,
  type SectorId,
} from '@/lib/erp-sectors'
import { useState, useEffect } from 'react'
import { SUPER_ADMIN_EMAILS } from '@/lib/admin-config'
import type { LucideIcon } from 'lucide-react'
import type { ModulePermission } from '@/lib/hooks/usePermissions'
import { useLocale } from '@/lib/hooks/useLocale'

// ── Icon & color maps ─────────────────────────────────────────────────────────

const CORE_ICONS: Record<string, LucideIcon> = {
  direction:    BarChart2,
  rh:           Users,
  finance:      TrendingUp,
  comptabilite: Calculator,
  tresorerie:   Wallet,
  stock:        Package,
  achats:       ShoppingCart,
  crm:          UsersRound,
  facturation:  FileText,
  depenses:     Receipt,
}

const SECTOR_ICONS: Record<string, LucideIcon> = {
  scolarite:                BookMarked,
  daac:                     Layers,
  'espace-formateur':       BookOpen,
  'espace-etudiant':        GraduationCap,
  'espace-parent':          HeartHandshake,
  'parametres-academiques': Settings,
  restaurant:               ChefHat,
  cuisine:                  ChefHat,
  hotel:                    Hotel,
  transport:                Truck,
}

const PLATFORM_ICONS: Record<string, LucideIcon> = {
  analytics:     Activity,
  bizbot:        Bot,
  ged:           FolderOpen,
  notifications: Bell,
  profil:        Building2,
  roles:         ShieldCheck,
  audit:         ShieldAlert,
  parametres:    Settings,
}

// Modules plateforme limités au owner / direction générale
const PLATFORM_RESTRICTED = new Set(['analytics', 'roles', 'audit'])

// ── Type interne NavItem ──────────────────────────────────────────────────────

type NavItem = {
  id:       string
  label:    string
  sublabel: string
  icon:     LucideIcon
  href:     string
  exact?:   boolean
}

// ── ALL_MODULES (tenants sans secteur) ────────────────────────────────────────

const ALL_MODULES = [
  { id: 'direction',    label: 'Direction Générale',  icon: BarChart2,     href: '/dashboard/direction' },
  { id: 'rh',           label: 'RH & Paie',           icon: Users,         href: '/dashboard/rh' },
  { id: 'finance',      label: 'Finance',             icon: TrendingUp,    href: '/dashboard/finance' },
  { id: 'comptabilite', label: 'Comptabilité',        icon: Calculator,    href: '/dashboard/comptabilite' },
  { id: 'tresorerie',   label: 'Trésorerie',          icon: Wallet,        href: '/dashboard/tresorerie' },
  { id: 'stock',        label: 'Stock & Inventaire',  icon: Package,       href: '/dashboard/stocks' },
  { id: 'facturation',  label: 'Facturation',         icon: FileText,      href: '/dashboard/facturation' },
  { id: 'achats',       label: 'Achats & Fourn.',     icon: ShoppingCart,  href: '/dashboard/achats' },
  { id: 'depenses',     label: 'Dépenses',            icon: Receipt,       href: '/dashboard/depenses' },
  { id: 'crm',          label: 'CRM Clients',         icon: UsersRound,    href: '/dashboard/crm' },
  { id: 'ecole',        label: 'École & Université',  icon: GraduationCap, href: '/dashboard/ecole' },
  { id: 'restaurant',   label: 'Resto POS',           icon: ChefHat,       href: '/dashboard/restaurant' },
  { id: 'hotel',        label: 'Hôtel & Hébergement', icon: Hotel,         href: '/dashboard/hotel' },
  { id: 'transport',    label: 'Transport VTC',       icon: Truck,         href: '/dashboard/transport' },
  { id: 'bizbot',       label: 'MIAA+ Assistant',     icon: Bot,           href: '/dashboard/miaa' },
]

// ── Sidebar ───────────────────────────────────────────────────────────────────

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

  useEffect(() => {
    if (!tenant) {
      setModulesActifs([])
      setPermissions({})
      setPermsLoaded(true)
      return
    }

    if (tenant.role === 'owner') {
      setModulesActifs(ALL_MODULES.map(m => m.id))
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

  function isActive(href: string, exact = false) {
    return exact ? pathname === href : pathname.startsWith(href)
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  // ── 3-layer nav builder ───────────────────────────────────────────────────

  // LAYER 1 — Core ERP (10 modules universels)
  const coreNavItems: NavItem[] = loaded && !!secteur
    ? CORE_ERP_MODULES.map(mod => ({
        id:       mod.id,
        label:    mod.label,
        sublabel: mod.sublabel,
        icon:     CORE_ICONS[mod.id] ?? BarChart2,
        href:     mod.href,
      })).filter(item => {
        if (isOwner) return true
        if (secteur === 'ecole') {
          const allowed = ECOLE_CORE_ROLE_FILTER[item.id]
          if (!allowed || allowed.length === 0) return true
          return ecoleRole ? allowed.includes(ecoleRole) : false
        }
        // Other sectors: check user permissions (default show if no explicit deny)
        return permissions[item.id]?.can_view !== false
      })
    : []

  // LAYER 2 — Sector-specific additions
  const sectorNavItems: NavItem[] = loaded && !!secteur
    ? (SECTOR_SPECIFIC[secteur as SectorId] ?? []).map(mod => ({
        id:       mod.id,
        label:    mod.label,
        sublabel: mod.sublabel,
        icon:     SECTOR_ICONS[mod.id] ?? Settings,
        href:     mod.href,
      })).filter(item => {
        if (isOwner) return true
        if (secteur === 'ecole') {
          const sItem = SECTOR_SPECIFIC['ecole']?.find(m => m.id === item.id)
          const rf    = sItem?.roleFilter
          if (!rf || rf.length === 0) return true
          return ecoleRole ? rf.includes(ecoleRole) : false
        }
        return permissions[item.id]?.can_view !== false
      })
    : []

  // LAYER 3 — Platform (bottom, always visible, some restricted)
  const platformNavItems: NavItem[] = loaded
    ? PLATFORM_MODULES.map(mod => ({
        id:       mod.id,
        label:    mod.label,
        sublabel: mod.sublabel,
        icon:     PLATFORM_ICONS[mod.id] ?? Settings,
        href:     mod.href,
      })).filter(item => {
        if (PLATFORM_RESTRICTED.has(item.id)) {
          return isOwner || ecoleRole === 'DIRECTION_GENERALE'
        }
        return true
      })
    : []

  // Generic (no-sector) active/inactive modules
  const allActiveModules     = ALL_MODULES.filter(m =>
    modulesActifs.includes(m.id) && (isOwner || permissions[m.id]?.can_view !== false),
  )
  const inactiveModules      = ALL_MODULES.filter(m => !modulesActifs.includes(m.id))

  const hasSector = loaded && !!secteur

  // ── Shared class helpers ────────────────────────────────────────────────────

  const navActive   = 'border-[#F59E0B] bg-amber-50 text-amber-700 font-semibold'
  const navInactive = 'border-transparent text-[#64748B] hover:text-[#0F172A] hover:bg-[#F8FAFC]'
  const navBase     = 'flex items-center gap-3 px-3 rounded-lg text-sm transition-all duration-200 border-l-4'
  const iconActive  = 'text-amber-700'
  const iconInactive= 'text-[#94A3B8]'

  // ── Item renderer helper ────────────────────────────────────────────────────

  function NavLink({ item, exact }: { item: NavItem; exact?: boolean }) {
    const active   = isActive(item.href, exact)
    const canEdit  = isOwner || permissions[item.id]?.can_edit
    const Icon     = item.icon
    return (
      <Link
        href={item.href}
        onClick={() => setMobileOpen(false)}
        className={`${navBase} py-2 ${active ? navActive : navInactive}`}
      >
        <Icon size={15} className={`shrink-0 transition-colors ${active ? iconActive : iconInactive}`} />
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium leading-tight truncate">{item.label}</div>
          <div className="text-[10px] text-[#94A3B8] truncate flex items-center gap-1">
            {item.sublabel}
            {!isOwner && !canEdit && <Lock size={8} className="text-[#CBD5E1]" />}
          </div>
        </div>
      </Link>
    )
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  const SidebarContent = () => (
    <div className="flex flex-col h-full overflow-hidden">

      {/* Logo + role badge */}
      <div className="border-b border-[#E2E8F0] shrink-0">
        <div className="px-4 py-3 flex items-center gap-2.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-icon.png" alt="oraforme" style={{ width: 34, height: 34, flexShrink: 0 }} />
          <span style={{ fontSize: 17, fontWeight: 800, color: '#0F172A', letterSpacing: '-0.3px' }}>oraforme</span>
        </div>
        {role && role !== 'owner' && (
          <div className="px-4 pb-2">
            <span className={`text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded ${
              role === 'admin'
                ? 'bg-blue-100 text-blue-600'
                : 'bg-[#F8FAFC] text-[#64748B] border border-[#E2E8F0]'
            }`}>
              {role === 'admin' ? 'Administrateur' : 'Membre'}
            </span>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 py-3 overflow-y-auto space-y-0.5">

        {/* Dashboard */}
        {(() => {
          const href   = secteur === 'ecole' ? '/dashboard/ecole' : '/dashboard'
          const label  = t('nav.dashboard')
          const sub    = hasSector ? t('nav.directionSub') : null
          const active = isActive(href, true)
          return (
            <Link
              href={href}
              onClick={() => setMobileOpen(false)}
              className={`${navBase} py-2.5 ${active ? navActive : navInactive}`}
            >
              <LayoutDashboard size={15} className={`shrink-0 ${active ? iconActive : iconInactive}`} />
              <div className="flex-1 min-w-0">
                <div className="truncate">{label}</div>
                {sub && <div className="text-[10px] text-[#94A3B8] truncate">{sub}</div>}
              </div>
            </Link>
          )
        })()}

        {/* ── LAYER 1 : Core ERP (sector tenants) ─────────────────────────── */}
        {hasSector && coreNavItems.length > 0 && (
          <>
            <p className="text-[10px] text-[#94A3B8] uppercase tracking-wider px-3 pt-3 pb-1 font-bold">
              Core ERP
            </p>
            {coreNavItems.map(item => <NavLink key={item.id} item={item} />)}
          </>
        )}

        {/* ── LAYER 2 : Sector-specific additions ─────────────────────────── */}
        {hasSector && sectorNavItems.length > 0 && (
          <>
            <p className="text-[10px] text-[#94A3B8] uppercase tracking-wider px-3 pt-3 pb-1 font-bold">
              {SECTOR_LABELS[secteur!] ?? secteur}
            </p>
            {sectorNavItems.map(item => <NavLink key={item.id} item={item} />)}
          </>
        )}

        {/* Empty sector state */}
        {hasSector && coreNavItems.length === 0 && sectorNavItems.length === 0 && (
          <p className="text-xs text-[#94A3B8] px-3 py-2">Aucun module assigné.</p>
        )}

        {/* ── Generic navigation (no-sector tenants) ──────────────────────── */}
        {loaded && !hasSector && (
          <>
            {allActiveModules.length > 0 && (
              <>
                <p className="text-[10px] text-[#94A3B8] uppercase tracking-wider px-3 pt-3 pb-1 font-bold">
                  {t('nav.myModules')}
                </p>
                {allActiveModules.map(mod => {
                  const Icon   = mod.icon
                  const active = isActive(mod.href)
                  return (
                    <Link
                      key={mod.id}
                      href={mod.href}
                      onClick={() => setMobileOpen(false)}
                      className={`${navBase} py-2.5 ${active ? navActive : navInactive}`}
                    >
                      <Icon size={15} className={`shrink-0 ${active ? iconActive : iconInactive}`} />
                      <span className="truncate">{mod.label}</span>
                    </Link>
                  )
                })}
              </>
            )}

            {isOwner && inactiveModules.length > 0 && (
              <>
                <p className="text-[10px] text-[#94A3B8] uppercase tracking-wider px-3 pt-3 pb-1 font-bold">
                  {t('nav.inactive')}
                </p>
                {inactiveModules.map(mod => {
                  const Icon = mod.icon
                  return (
                    <Link
                      key={mod.id}
                      href={mod.href}
                      onClick={() => setMobileOpen(false)}
                      title={`Accéder à ${mod.label}`}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-[#CBD5E1] hover:text-[#94A3B8] hover:bg-[#F8FAFC] transition-all duration-200 group"
                    >
                      <Icon size={15} className="shrink-0" />
                      <span className="truncate flex-1">{mod.label}</span>
                      <span className="text-[8px] font-bold border border-[#E2E8F0] text-[#94A3B8] group-hover:border-[#CBD5E1] group-hover:text-[#64748B] rounded px-1 py-0.5 shrink-0 transition-colors">
                        ACTIVER
                      </span>
                    </Link>
                  )
                })}
              </>
            )}
          </>
        )}

        {/* Loading skeleton */}
        {!loaded && (
          <div className="space-y-1 pt-2">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-9 rounded-lg bg-[#F1F5F9] animate-pulse mx-1" />
            ))}
          </div>
        )}

        {/* ── LAYER 3 : Platform (modules plateforme transverses) ──────────── */}
        {loaded && platformNavItems.length > 0 && (
          <>
            <p className="text-[10px] text-[#94A3B8] uppercase tracking-wider px-3 pt-4 pb-1 font-bold">
              Plateforme
            </p>
            {platformNavItems.map(item => {
              const Icon   = item.icon
              const active = isActive(item.href)
              return (
                <Link
                  key={item.id}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className={`${navBase} py-2 ${active ? navActive : navInactive}`}
                >
                  <Icon size={15} className={`shrink-0 ${active ? iconActive : iconInactive}`} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium leading-tight truncate">{item.label}</div>
                    <div className="text-[10px] text-[#94A3B8] truncate">{item.sublabel}</div>
                  </div>
                </Link>
              )
            })}
          </>
        )}

        {/* Modules marketplace (owner no-sector) */}
        {loaded && isOwner && !secteur && (
          <Link
            href="/dashboard/modules"
            onClick={() => setMobileOpen(false)}
            className={`${navBase} py-2.5 mt-1 ${isActive('/dashboard/modules') ? navActive : navInactive}`}
          >
            <Store size={15} className={`shrink-0 ${isActive('/dashboard/modules') ? iconActive : iconInactive}`} />
            <span>{t('nav.modules')}</span>
          </Link>
        )}
      </nav>

      {/* Bottom actions */}
      <div className="px-2 py-3 border-t border-[#E2E8F0] shrink-0 space-y-0.5">

        {isSuperAdmin && (
          <Link
            href="/admin"
            onClick={() => setMobileOpen(false)}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-[#DC2626] hover:bg-red-50 transition-all duration-200"
          >
            <ShieldAlert size={15} className="shrink-0" />
            <span>Admin oraforme</span>
            <div className="ml-auto w-1.5 h-1.5 rounded-full bg-[#DC2626] animate-pulse" />
          </Link>
        )}

        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-[#64748B] hover:text-red-500 hover:bg-red-50 transition-all duration-200"
        >
          <LogOut size={15} className="shrink-0" />
          Déconnexion
        </button>
      </div>
    </div>
  )

  return (
    <>
      <aside className="hidden lg:flex w-56 shrink-0 flex-col bg-white border-r border-[#E2E8F0] h-screen sticky top-0">
        <SidebarContent />
      </aside>

      <button
        className="lg:hidden fixed top-4 left-4 z-50 p-2 rounded-lg bg-white border border-[#E2E8F0] text-[#0F172A] shadow-sm"
        onClick={() => setMobileOpen(!mobileOpen)}
      >
        {mobileOpen ? <X size={18} /> : <Menu size={18} />}
      </button>

      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-40 flex">
          <div className="w-56 bg-white border-r border-[#E2E8F0] h-full">
            <SidebarContent />
          </div>
          <div className="flex-1 bg-black/40" onClick={() => setMobileOpen(false)} />
        </div>
      )}
    </>
  )
}

'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import {
  LayoutDashboard, Building2, Package, TrendingUp, Bot,
  LogOut, Menu, X, Activity, Users, CreditCard, Bell,
  Shield, FileSearch, LifeBuoy, Settings, ServerCrash,
  Zap, Key, HardDrive, Wrench, BarChart3, Receipt,
  ArrowRightLeft, ChevronDown, Cpu, Globe,
  Wallet, Banknote, RefreshCw, PieChart, BookOpen, Scale,
  DollarSign, Plus,
} from 'lucide-react'
import { useState } from 'react'

// ── Nav structure ──────────────────────────────────────────────────────────────

const SECTIONS = [
  {
    group: 'OVERVIEW',
    items: [
      { href: '/admin',               label: 'Dashboard Global',   icon: LayoutDashboard, exact: true,  badge: null },
      { href: '/admin/analytics',     label: 'Analytics',          icon: BarChart3,        exact: false, badge: null },
      { href: '/admin/notifications', label: 'Notifications',      icon: Bell,             exact: false, badge: '3'  },
    ],
  },
  {
    group: 'FINANCE CENTER',
    items: [
      { href: '/admin/finance',              label: 'Dashboard Financier', icon: DollarSign,    exact: true,  badge: null },
      { href: '/admin/finance/caisse',       label: 'Caisse & Liquidités', icon: Wallet,        exact: false, badge: null },
      { href: '/admin/finance/transferts',   label: 'Transferts & Rembt.', icon: RefreshCw,     exact: false, badge: null },
      { href: '/admin/finance/analytics',    label: 'Analytics Financières', icon: PieChart,    exact: false, badge: null },
    ],
  },
  {
    group: 'CLIENTS & REVENUS',
    items: [
      { href: '/admin/clients',      label: 'Entreprises',         icon: Building2,    exact: false, badge: null },
      { href: '/admin/clients/nouveau', label: 'Créer entreprise', icon: Plus,         exact: false, badge: null },
      { href: '/admin/abonnements',  label: 'Abonnements',         icon: Package,      exact: false, badge: null },
      { href: '/admin/utilisateurs', label: 'Utilisateurs',        icon: Users,        exact: false, badge: null },
      { href: '/admin/revenus',      label: 'Revenus & MRR',       icon: TrendingUp,   exact: false, badge: null },
      { href: '/admin/billing',      label: 'Billing & Paiements', icon: CreditCard,   exact: false, badge: null },
      { href: '/admin/support',      label: 'Support Clients',     icon: LifeBuoy,     exact: false, badge: null },
    ],
  },
  {
    group: 'OPÉRATIONS',
    items: [
      { href: '/admin/activite',     label: 'Activité Temps Réel', icon: Activity,         exact: false, badge: null },
      { href: '/admin/transactions', label: 'Transactions',        icon: ArrowRightLeft,   exact: false, badge: null },
      { href: '/admin/miaa',         label: 'MIAA+ Intelligence',  icon: Bot,              exact: false, badge: null },
    ],
  },
  {
    group: 'INFRASTRUCTURE',
    items: [
      { href: '/admin/monitoring',   label: 'Monitoring',         icon: ServerCrash,  exact: false, badge: null },
      { href: '/admin/sante',        label: 'Santé Système',      icon: Cpu,          exact: false, badge: null },
      { href: '/admin/securite',     label: 'Sécurité',           icon: Shield,       exact: false, badge: null },
      { href: '/admin/audit',        label: 'Logs & Audit',       icon: FileSearch,   exact: false, badge: null },
      { href: '/admin/apis',         label: 'APIs & Intégrations', icon: Zap,         exact: false, badge: null },
      { href: '/admin/backups',      label: 'Backups',            icon: HardDrive,    exact: false, badge: null },
    ],
  },
  {
    group: 'PLATEFORME',
    items: [
      { href: '/admin/modules',      label: 'Modules',            icon: Globe,       exact: false, badge: null },
      { href: '/admin/parametres',   label: 'Paramètres',         icon: Settings,    exact: false, badge: null },
      { href: '/admin/roles',        label: 'Rôles Owner',        icon: Key,         exact: false, badge: null },
      { href: '/admin/maintenance',  label: 'Maintenance',        icon: Wrench,      exact: false, badge: null },
    ],
  },
]

// ── Component ──────────────────────────────────────────────────────────────────

export default function AdminSidebar() {
  const pathname = usePathname()
  const router   = useRouter()
  const [mobileOpen, setMobileOpen]       = useState(false)
  const [collapsed, setCollapsed]         = useState<Record<string, boolean>>({})

  function isActive(href: string, exact = false) {
    return exact ? pathname === href : pathname.startsWith(href)
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  function toggleGroup(group: string) {
    setCollapsed(prev => ({ ...prev, [group]: !prev[group] }))
  }

  const SidebarContent = () => (
    <div className="flex flex-col h-full overflow-hidden bg-white">

      {/* Logo */}
      <div className="px-5 pt-5 pb-4 border-b border-gray-100 shrink-0">
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="Oraforme" className="h-7 w-auto shrink-0" onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
          <p className="text-[10px] text-gray-400 font-semibold">Platform HQ</p>
        </div>
        <div className="mt-3 flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-amber-50 border border-amber-200">
          <div className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
          <span className="text-[11px] font-semibold text-amber-700 tracking-wide">OWNER ACCESS</span>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-3 overflow-y-auto scrollbar-hide space-y-4">
        {SECTIONS.map(section => {
          const isCollapsed = collapsed[section.group]
          return (
            <div key={section.group}>
              <button
                onClick={() => toggleGroup(section.group)}
                className="w-full flex items-center justify-between px-2 py-1 mb-1 group"
              >
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest group-hover:text-gray-600 transition-colors">
                  {section.group}
                </span>
                <ChevronDown
                  size={12}
                  className={`text-gray-300 transition-transform ${isCollapsed ? '-rotate-90' : ''}`}
                />
              </button>

              {!isCollapsed && (
                <div className="space-y-0.5">
                  {section.items.map(item => {
                    const Icon   = item.icon
                    const active = isActive(item.href, item.exact)
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setMobileOpen(false)}
                        className={`relative flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] transition-all group ${
                          active
                            ? 'bg-amber-50 text-amber-700 font-semibold'
                            : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'
                        }`}
                      >
                        {active && (
                          <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-4 rounded-r-full bg-amber-500" />
                        )}
                        <Icon size={14} className={`shrink-0 ${active ? 'text-amber-600' : 'text-gray-400 group-hover:text-gray-600'}`} />
                        <span className="truncate flex-1">{item.label}</span>
                        {item.badge && (
                          <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
                            {item.badge}
                          </span>
                        )}
                      </Link>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </nav>

      {/* Bottom */}
      <div className="px-3 py-3 border-t border-gray-100 shrink-0 space-y-0.5">
        <Link
          href="/dashboard"
          onClick={() => setMobileOpen(false)}
          className="flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] text-gray-500 hover:text-gray-900 hover:bg-gray-50 transition-all"
        >
          <LayoutDashboard size={14} className="shrink-0 text-gray-400" />
          <span>Mon dashboard client</span>
        </Link>
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] text-gray-500 hover:text-red-600 hover:bg-red-50 transition-all"
        >
          <LogOut size={14} className="shrink-0" />
          Déconnexion
        </button>
      </div>
    </div>
  )

  return (
    <>
      {/* Desktop */}
      <aside className="hidden lg:flex w-60 shrink-0 flex-col border-r border-gray-100 h-screen sticky top-0 shadow-sm">
        <SidebarContent />
      </aside>

      {/* Mobile trigger */}
      <button
        className="lg:hidden fixed top-4 left-4 z-50 p-2 rounded-lg bg-white border border-gray-200 text-gray-600 shadow-sm"
        onClick={() => setMobileOpen(!mobileOpen)}
      >
        {mobileOpen ? <X size={18} /> : <Menu size={18} />}
      </button>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-40 flex">
          <div className="w-60 h-full shadow-xl">
            <SidebarContent />
          </div>
          <div className="flex-1 bg-black/40 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
        </div>
      )}
    </>
  )
}

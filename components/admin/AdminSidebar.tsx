'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import {
  LayoutDashboard, Building2, Package, TrendingUp,
  Bot, LogOut, Menu, X, Activity,
} from 'lucide-react'
import { useState } from 'react'

const NAV = [
  { href: '/admin',          label: 'Vue globale',  icon: LayoutDashboard, exact: true },
  { href: '/admin/activite', label: 'Activité',      icon: Activity },
  { href: '/admin/clients',  label: 'Clients',       icon: Building2 },
  { href: '/admin/modules',  label: 'Modules',       icon: Package },
  { href: '/admin/revenus',  label: 'Revenus & MRR', icon: TrendingUp },
  { href: '/admin/miaa',     label: 'MIAA+ Stats',   icon: Bot },
]

export default function AdminSidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const [mobileOpen, setMobileOpen] = useState(false)

  function isActive(href: string, exact = false) {
    return exact ? pathname === href : pathname.startsWith(href)
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const SidebarContent = () => (
    <div className="flex flex-col h-full overflow-hidden">

      {/* Header */}
      <div className="px-4 py-4 border-b border-[var(--border)] shrink-0">
        <div className="flex items-center gap-2 mb-1.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-icon.png" alt="oraforme" className="w-7 h-7 shrink-0" />
          <span className="text-base font-bold text-[#FFFFFF]">oraforme</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] bg-[#F51E33]/20 text-[#F51E33] border border-[#F51E33]/30 rounded px-1.5 py-0.5 font-bold tracking-wider">
            SUPER ADMIN
          </span>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 py-3 overflow-y-auto space-y-0.5">
        <p className="text-xs text-[var(--text-secondary)] uppercase tracking-wider px-3 pt-1 pb-2">Panneau de contrôle</p>
        {NAV.map(item => {
          const Icon = item.icon
          const active = isActive(item.href, item.exact)
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all ${
                active
                  ? 'bg-[#F51E33]/10 text-[#F51E33] font-medium'
                  : 'text-[var(--text-secondary)] hover:text-[#FFFFFF] hover:bg-white/5'
              }`}
            >
              <Icon size={15} className="shrink-0" />
              <span className="truncate">{item.label}</span>
              {active && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-[#F51E33]" />}
            </Link>
          )
        })}
      </nav>

      {/* Bottom */}
      <div className="px-2 py-3 border-t border-[var(--border)] shrink-0 space-y-0.5">
        <Link
          href="/dashboard"
          onClick={() => setMobileOpen(false)}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-[var(--text-secondary)] hover:text-[#FFFFFF] hover:bg-white/5 transition-all"
        >
          <LayoutDashboard size={15} className="shrink-0" />
          <span>Mon dashboard</span>
        </Link>
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-[var(--text-secondary)] hover:text-red-400 hover:bg-red-500/5 transition-all"
        >
          <LogOut size={15} className="shrink-0" />
          Déconnexion
        </button>
      </div>
    </div>
  )

  return (
    <>
      {/* Desktop */}
      <aside className="hidden lg:flex w-56 shrink-0 flex-col bg-[var(--card-bg)] border-r border-[var(--border)] h-screen sticky top-0">
        <SidebarContent />
      </aside>

      {/* Mobile trigger */}
      <button
        className="lg:hidden fixed top-4 left-4 z-50 p-2 rounded-lg bg-[var(--card-bg)] border border-[var(--border)] text-[var(--text-secondary)]"
        onClick={() => setMobileOpen(!mobileOpen)}
      >
        {mobileOpen ? <X size={18} /> : <Menu size={18} />}
      </button>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-40 flex">
          <div className="w-56 bg-[var(--card-bg)] border-r border-[var(--border)] h-full">
            <SidebarContent />
          </div>
          <div className="flex-1 bg-black/50" onClick={() => setMobileOpen(false)} />
        </div>
      )}
    </>
  )
}

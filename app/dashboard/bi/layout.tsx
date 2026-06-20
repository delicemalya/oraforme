'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { useTenantContext } from '@/lib/contexts/TenantContext'
import {
  BarChart2, Users, GraduationCap, Building2,
  ShoppingCart, Activity,
} from 'lucide-react'

const ALL_TABS = [
  { id: 'dg',         href: '/dashboard/bi',            label: 'Direction',    icon: BarChart2,     sectors: null },
  { id: 'rh',         href: '/dashboard/bi/rh',         label: 'RH',           icon: Users,         sectors: null },
  { id: 'ecole',      href: '/dashboard/bi/ecole',      label: 'École',        icon: GraduationCap, sectors: ['ecole'] },
  { id: 'hotel',      href: '/dashboard/bi/hotel',      label: 'Hôtel',        icon: Building2,     sectors: ['hotel'] },
  { id: 'restaurant', href: '/dashboard/bi/restaurant', label: 'Restaurant',   icon: ShoppingCart,  sectors: ['restaurant'] },
  { id: 'analytics',  href: '/dashboard/bi/analytics',  label: 'Multi-module', icon: Activity,      sectors: null },
] as const

export default function BiLayout({ children }: { children: React.ReactNode }) {
  const pathname  = usePathname()
  const { tenant } = useTenantContext()
  const secteur   = tenant?.secteur ?? null

  const tabs = ALL_TABS.filter(tab =>
    !tab.sectors || (secteur != null && (tab.sectors as readonly string[]).includes(secteur))
  )

  return (
    <div style={{ background: '#F5F7FB', minHeight: '100%' }}>

      {/* ── Tab navigation ─────────────────────────────────────────────────── */}
      <div className="sticky top-0 z-10 bg-[#F5F7FB]/95 backdrop-blur-sm border-b border-[#E2E8F0]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center gap-1 overflow-x-auto scrollbar-hide py-2.5">
          {tabs.map(tab => {
            const isActive = tab.href === '/dashboard/bi'
              ? pathname === '/dashboard/bi'
              : pathname.startsWith(tab.href)
            const Icon = tab.icon
            return (
              <Link
                key={tab.id}
                href={tab.href}
                prefetch
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold whitespace-nowrap transition-all ${
                  isActive
                    ? 'bg-white text-[#0F172A] shadow-sm border border-[#E2E8F0]'
                    : 'text-[#64748B] hover:text-[#0F172A] hover:bg-white/70'
                }`}
              >
                <Icon size={11} />
                {tab.label}
              </Link>
            )
          })}
        </div>
      </div>

      {/* ── Page content ───────────────────────────────────────────────────── */}
      {children}

    </div>
  )
}

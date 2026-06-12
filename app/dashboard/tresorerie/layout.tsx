'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'
import {
  LayoutDashboard, Archive, Landmark, Smartphone,
  ArrowUpCircle, ArrowDownCircle, GitMerge, RefreshCw,
  TrendingUp, CheckCircle2, History, Bell, BarChart3, Receipt,
  FileCheck, ArrowRightLeft,
} from 'lucide-react'

const TRESO_MODULES = [
  { href: '/dashboard/tresorerie',               label: 'Dashboard',        icon: LayoutDashboard, exact: true },
  { href: '/dashboard/tresorerie/caisses',        label: 'Caisses',          icon: Archive },
  { href: '/dashboard/tresorerie/banques',        label: 'Banques',          icon: Landmark },
  { href: '/dashboard/tresorerie/mobile-money',   label: 'Mobile Money',     icon: Smartphone },
  { href: '/dashboard/tresorerie/encaissements',  label: 'Encaissements',    icon: ArrowUpCircle },
  { href: '/dashboard/tresorerie/decaissements',  label: 'Sorties',          icon: ArrowDownCircle },
  { href: '/dashboard/tresorerie/transferts',     label: 'Transferts',       icon: GitMerge },
  { href: '/dashboard/tresorerie/remboursements', label: 'Remboursements',   icon: RefreshCw },
  { href: '/dashboard/tresorerie/validations',    label: 'Validations',      icon: CheckCircle2 },
  { href: '/dashboard/tresorerie/previsions',     label: 'Prévisions',       icon: TrendingUp },
  { href: '/dashboard/tresorerie/historique',     label: 'Historique',       icon: History },
  { href: '/dashboard/tresorerie/rapprochements', label: 'Rapprochements',   icon: Receipt },
  { href: '/dashboard/tresorerie/alertes',        label: 'Alertes',          icon: Bell },
  { href: '/dashboard/tresorerie/analytics',      label: 'Analytics',        icon: BarChart3 },
]

export default function TresorerieLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  return (
    <div className="space-y-4">
      {/* Sub-navigation */}
      <div className="bg-white border border-[#E2E8F0] rounded-2xl overflow-hidden">
        <div className="flex items-center gap-0 overflow-x-auto scrollbar-hide px-2 py-1.5">
          {TRESO_MODULES.map(mod => {
            const Icon = mod.icon
            const isActive = mod.exact
              ? pathname === mod.href
              : pathname.startsWith(mod.href)
            return (
              <Link key={mod.href} href={mod.href}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-[11px] font-semibold whitespace-nowrap transition-all shrink-0 ${
                  isActive
                    ? 'bg-[#0891B2] text-white shadow-sm'
                    : 'text-[#64748B] hover:bg-[#F1F5F9] hover:text-[#0F172A]'
                }`}>
                <Icon size={13} />
                {mod.label}
              </Link>
            )
          })}
        </div>
      </div>

      {/* Page content */}
      {children}
    </div>
  )
}

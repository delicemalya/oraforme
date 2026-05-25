'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'
import {
  LayoutDashboard, Package, Grid3X3, Warehouse, ClipboardList,
  ArrowLeftRight, ShoppingCart, Users2, FileText, Truck,
  TrendingDown, RotateCcw, AlertTriangle, DollarSign, BarChart3,
} from 'lucide-react'

const STOCK_MODULES = [
  { href: '/dashboard/stocks',                label: 'Dashboard',         icon: LayoutDashboard, exact: true },
  { href: '/dashboard/stocks/produits',        label: 'Produits',          icon: Package },
  { href: '/dashboard/stocks/categories',      label: 'Catégories',        icon: Grid3X3 },
  { href: '/dashboard/stocks/entrepots',       label: 'Entrepôts',         icon: Warehouse },
  { href: '/dashboard/stocks/mouvements',      label: 'Mouvements',        icon: ArrowLeftRight },
  { href: '/dashboard/stocks/inventaires',     label: 'Inventaires',       icon: ClipboardList },
  { href: '/dashboard/stocks/achats',          label: 'Achats',            icon: ShoppingCart },
  { href: '/dashboard/stocks/fournisseurs',    label: 'Fournisseurs',      icon: Users2 },
  { href: '/dashboard/stocks/commandes',       label: 'Commandes',         icon: FileText },
  { href: '/dashboard/stocks/receptions',      label: 'Réceptions',        icon: Truck },
  { href: '/dashboard/stocks/sorties',         label: 'Sorties',           icon: TrendingDown },
  { href: '/dashboard/stocks/retours',         label: 'Retours',           icon: RotateCcw },
  { href: '/dashboard/stocks/valorisation',    label: 'Valorisation',      icon: DollarSign },
  { href: '/dashboard/stocks/alertes',         label: 'Alertes',           icon: AlertTriangle },
  { href: '/dashboard/stocks/analytics',       label: 'Analytics',         icon: BarChart3 },
]

export default function StocksLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  return (
    <div className="space-y-4">
      {/* Sub-navigation */}
      <div className="bg-white border border-[#E2E8F0] rounded-2xl overflow-hidden">
        <div className="flex items-center gap-0 overflow-x-auto scrollbar-hide px-2 py-1.5">
          {STOCK_MODULES.map(mod => {
            const Icon = mod.icon
            const isActive = mod.exact
              ? pathname === mod.href
              : pathname.startsWith(mod.href)
            return (
              <Link key={mod.href} href={mod.href}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-[11px] font-semibold whitespace-nowrap transition-all shrink-0 ${
                  isActive
                    ? 'bg-[#16A34A] text-white shadow-sm'
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

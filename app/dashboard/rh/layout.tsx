'use client'

/**
 * RH Enterprise Layout — Sub-navigation pour tous les modules RH
 * Apparaît sur toutes les pages /dashboard/rh/*
 */

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, FileText, Clock,
  DollarSign, Star, GitBranch, Shield, Gift,
  FolderOpen, User, BarChart2, Briefcase, ChevronRight,
} from 'lucide-react'

const RH_MODULES = [
  { id: 'dashboard',    href: '/dashboard/rh',               label: 'Tableau de bord', icon: LayoutDashboard, exact: true },
  { id: 'recrutement',  href: '/dashboard/rh/recrutement',   label: 'Recrutement',     icon: Briefcase        },
  { id: 'contrats',     href: '/dashboard/rh/contrats',      label: 'Contrats',     icon: FileText         },
  { id: 'presences',    href: '/dashboard/rh/presences',     label: 'Présences',    icon: Clock            },
  { id: 'paie',         href: '/dashboard/rh/paie',          label: 'Paie',         icon: DollarSign       },
  { id: 'evaluations',  href: '/dashboard/rh/evaluations',   label: 'Évaluations',  icon: Star             },
  { id: 'organigramme', href: '/dashboard/rh/organigramme',  label: 'Organigramme', icon: GitBranch        },
  { id: 'sanctions',    href: '/dashboard/rh/sanctions',     label: 'Sanctions',    icon: Shield           },
  { id: 'avantages',    href: '/dashboard/rh/avantages',     label: 'Avantages',    icon: Gift             },
  { id: 'documents',    href: '/dashboard/rh/documents',     label: 'Documents',    icon: FolderOpen       },
  { id: 'portail',      href: '/dashboard/rh/portail',       label: 'Portail',      icon: User             },
  { id: 'analytics',    href: '/dashboard/rh/analytics',     label: 'Analytics',    icon: BarChart2        },
]

export default function RHLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  return (
    <div className="space-y-0">

      {/* RH Module Sub-Nav */}
      <div className="bg-white border-b border-[#E2E8F0] -mx-4 sm:-mx-6 -mt-4 sm:-mt-6 px-4 sm:px-6 mb-4 sm:mb-6 sticky top-0 z-20">

        {/* Breadcrumb */}
        <div className="flex items-center gap-1.5 py-2 text-[11px] text-[#94A3B8]">
          <span>Dashboard</span>
          <ChevronRight size={11} />
          <span className="font-semibold text-[#0F172A]">RH & Paie</span>
        </div>

        {/* Module tabs scroll */}
        <div className="flex items-center gap-0.5 overflow-x-auto pb-0 scrollbar-hide -mb-px touch-pan-x">
          {RH_MODULES.map(mod => {
            const Icon   = mod.icon

            // Special logic: dashboard is active only on exact /dashboard/rh
            const isDashActive = mod.id === 'dashboard' && pathname === '/dashboard/rh'
            const isPageActive = mod.href.includes('#')
              ? false
              : !mod.exact
                ? pathname.startsWith(mod.href) && mod.href !== '/dashboard/rh'
                : pathname === mod.href

            const finalActive = isDashActive || isPageActive

            return (
              <Link
                key={mod.id}
                href={mod.href}
                className={`flex items-center gap-1.5 px-3 py-2.5 text-[12px] font-semibold whitespace-nowrap border-b-2 transition-all -mb-px ${
                  finalActive
                    ? 'border-[#F59E0B] text-[#F59E0B]'
                    : 'border-transparent text-[#64748B] hover:text-[#0F172A] hover:border-gray-200'
                }`}
              >
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

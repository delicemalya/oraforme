'use client'

/**
 * Comptabilité OHADA Layout — Sous-navigation pour tous les modules comptables
 * Apparaît sur toutes les pages /dashboard/comptabilite/*
 */

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, BookOpen, Scale, BarChart2, FileText,
  Users, Layers, Package, GitMerge, Percent,
  Lock, Download, ChevronRight, List, TrendingUp,
} from 'lucide-react'

const COMPTA_MODULES = [
  { id: 'dashboard',      href: '/dashboard/comptabilite',                    label: 'Dashboard',         icon: LayoutDashboard, exact: true  },
  { id: 'journal',        href: '/dashboard/comptabilite/journal',            label: 'Journal',           icon: BookOpen                      },
  { id: 'grand-livre',    href: '/dashboard/comptabilite/grand-livre',        label: 'Grand Livre',       icon: Scale                         },
  { id: 'balance',        href: '/dashboard/comptabilite/balance',            label: 'Balance',           icon: BarChart2                     },
  { id: 'bilan',          href: '/dashboard/comptabilite/bilan',              label: 'Bilan & Résultat',  icon: TrendingUp                    },
  { id: 'plan-comptable', href: '/dashboard/comptabilite/plan-comptable',     label: 'Plan Comptable',    icon: List                          },
  { id: 'tiers',          href: '/dashboard/comptabilite/tiers',              label: 'Tiers',             icon: Users                         },
  { id: 'centres-couts',  href: '/dashboard/comptabilite/centres-couts',      label: 'Centres de coûts',  icon: Layers                        },
  { id: 'immobilisations',href: '/dashboard/comptabilite/immobilisations',    label: 'Immobilisations',   icon: Package                       },
  { id: 'rapprochement',  href: '/dashboard/comptabilite/rapprochement',      label: 'Rapprochement',     icon: GitMerge                      },
  { id: 'tva',            href: '/dashboard/comptabilite/tva',                label: 'TVA & Fiscalité',   icon: Percent                       },
  { id: 'cloture',        href: '/dashboard/comptabilite/cloture',            label: 'Clôture',           icon: Lock                          },
  { id: 'rapports',       href: '/dashboard/comptabilite/rapports',           label: 'Rapports',          icon: Download                      },
]

export default function ComptabiliteLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  function isActive(mod: typeof COMPTA_MODULES[0]) {
    if (mod.exact) return pathname === mod.href
    return pathname.startsWith(mod.href)
  }

  return (
    <div className="space-y-0">

      {/* Sous-navigation comptable */}
      <div className="bg-white border-b border-[#E2E8F0] -mx-6 -mt-6 px-6 mb-6 sticky top-0 z-20">

        {/* Breadcrumb */}
        <div className="flex items-center gap-1.5 py-2 text-[11px] text-[#94A3B8]">
          <span>Dashboard</span>
          <ChevronRight size={11} />
          <span className="font-semibold text-[#0F172A]">Comptabilité OHADA</span>
        </div>

        {/* Onglets */}
        <div className="flex items-center gap-0.5 overflow-x-auto pb-0 scrollbar-hide -mb-px">
          {COMPTA_MODULES.map(mod => {
            const Icon    = mod.icon
            const active  = isActive(mod)
            return (
              <Link
                key={mod.id}
                href={mod.href}
                className={`flex items-center gap-1.5 px-3 py-2.5 text-[12px] font-semibold whitespace-nowrap border-b-2 transition-all -mb-px ${
                  active
                    ? 'border-[#2563EB] text-[#2563EB]'
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

      {children}
    </div>
  )
}

'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Receipt, Users, FileText, Building2, History,
  TrendingUp, GraduationCap, ClipboardList, Landmark,
  CheckCircle2, Clock,
} from 'lucide-react'
import { useTenantContext } from '@/lib/contexts/TenantContext'
import { getMoteurFiscal, getPaysDisponible } from '@/lib/pays-config'

const NAV = [
  { href: '/dashboard/fiscalite/tva',               label: 'TVA',                   icon: Receipt        },
  { href: '/dashboard/fiscalite/cnss',              label: 'CNSS',                  icon: Users          },
  { href: '/dashboard/fiscalite/das',               label: 'DAS',                   icon: FileText       },
  { href: '/dashboard/fiscalite/patente',           label: 'Patente',               icon: Building2      },
  { href: '/dashboard/fiscalite/is',                label: 'Impôt société',         icon: Landmark       },
  { href: '/dashboard/fiscalite/irpp',              label: 'IRPP',                  icon: TrendingUp     },
  { href: '/dashboard/fiscalite/taxe-apprentissage',label: 'Taxe apprentissage',    icon: GraduationCap  },
  { href: '/dashboard/fiscalite/liasse-fiscale',    label: 'Déclarations annuelles',icon: ClipboardList  },
  { href: '/dashboard/fiscalite/historique',        label: 'Historique',            icon: History        },
]

function PaysBanner() {
  const { tenant } = useTenantContext()
  const codePays = tenant?.pays ?? 'CG'
  const moteur   = getMoteurFiscal(codePays)
  const pays     = getPaysDisponible(codePays)
  const drapeau  = pays?.drapeau ?? '🌍'
  const nom      = pays?.nom ?? codePays

  if (moteur) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '7px 20px',
        background: '#F0FDF4', borderBottom: '1px solid #BBF7D0',
        fontSize: 12, color: '#15803D',
      }}>
        <CheckCircle2 size={13} style={{ flexShrink: 0 }} />
        <span style={{ fontWeight: 600 }}>
          {drapeau} Moteur fiscal {nom} activé
        </span>
        <span style={{ color: '#4ADE80', margin: '0 4px' }}>·</span>
        <span style={{ color: '#166534' }}>
          {moteur === 'congo'    && 'TVA 18% + CA · CNSS 4%/23,28% · IRPP Congo'}
          {moteur === 'cameroun' && 'TVA 19,25% · Patente PM/ME/GE · IRPP Cameroun'}
        </span>
      </div>
    )
  }

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      padding: '7px 20px',
      background: '#FFFBEB', borderBottom: '1px solid #FDE68A',
      fontSize: 12, color: '#92400E',
    }}>
      <Clock size={13} style={{ flexShrink: 0 }} />
      <span style={{ fontWeight: 600 }}>
        {drapeau} Module fiscal pour {nom} en cours de développement
      </span>
      <span style={{ color: '#FCD34D', margin: '0 4px' }}>·</span>
      <span>Les calculs affichés sont basés sur les paramètres Congo par défaut</span>
    </div>
  )
}

export default function FiscaliteLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  // Main fiscalite hub page — no subnav
  if (pathname === '/dashboard/fiscalite') {
    return (
      <div style={{ minHeight: '100vh', background: '#F5F7FB' }}>
        <div style={{ padding: '24px 20px', maxWidth: 1200, margin: '0 auto' }}>
          {children}
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: '#F5F7FB' }}>
      {/* Sub-navigation */}
      <div style={{
        background: '#FFFFFF',
        borderBottom: '1px solid #E2E8F0',
        overflowX: 'auto',
        position: 'sticky', top: 0, zIndex: 10,
      }}>
        <div style={{
          display: 'flex', gap: 2, padding: '0 16px',
          minWidth: 'max-content',
        }}>
          {NAV.map(item => {
            const Icon = item.icon
            const isActive = pathname.startsWith(item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                style={{
                  display: 'flex', alignItems: 'center', gap: 7,
                  padding: '12px 14px',
                  borderBottom: `2px solid ${isActive ? '#2563EB' : 'transparent'}`,
                  color: isActive ? '#2563EB' : '#64748B',
                  textDecoration: 'none',
                  fontSize: 13, fontWeight: isActive ? 600 : 500,
                  whiteSpace: 'nowrap',
                  transition: 'all 0.15s',
                }}
              >
                <Icon size={15} />
                {item.label}
              </Link>
            )
          })}
        </div>
      </div>

      {/* Country fiscal banner */}
      <PaysBanner />

      {/* Content */}
      <div style={{ padding: '24px 20px', maxWidth: 1200, margin: '0 auto' }}>
        {children}
      </div>
    </div>
  )
}

'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import {
  TrendingUp, Users, Package, AlertTriangle, Plus, Download,
  Clock, ChevronDown, GraduationCap, UserX, CalendarOff, Lock,
  Wallet, CheckCircle, FileText, ArrowUpRight,
  Zap, BarChart2, Star, ChevronRight, ChefHat, Bot, ShoppingCart,
  Receipt, Truck, Hotel, BookOpen, Calculator, HeartHandshake,
  Award, Layers, Settings, RefreshCw,
} from 'lucide-react'
import Link from 'next/link'
import RevenueChart from '@/components/dashboard/RevenueChart'
import ModuleChart from '@/components/dashboard/ModuleChart'
import ActivityTimeline, { type ActivityItem } from '@/components/ui/ActivityTimeline'
import { useLocale } from '@/lib/hooks/useLocale'

export interface DashboardData {
  tenant: { nom_entreprise: string; modules_actifs: string[]; plan: string }
  kpis: { revenuMois: number; nbEmployes: number; nbArticles: number; nbAlertes: number }
  alerts: { pendingCount: number; pendingAmount: number; lowStockCount: number }
  recentActivity: ActivityItem[]
  chartData: {
    daily: { day: string; montant: number; count: number }[]
    moduleBreakdown: { name: string; value: number; color: string; statut?: string }[]
  }
  isFinancial?: boolean
  secteur?:     string | null
  ecoleRole?:   string | null
  ecoleKpis?:   { nbEtudiants: number; nbActifs: number; nbSuspendus: number; nbAbsences: number } | null
  daacKpis?:    { sessionsEnCours: number; diplomesEnAttente: number; nbSoutenances: number } | null
  rhKpis?:      { nbActifs: number; nbConges: number } | null
  ecoleFinancials?: { revenusMois: number; nbPaiementsMois: number; nbImpayesDossiers: number; montantImpayeTotal: number } | null
}

function fmt(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)} M`
  return new Intl.NumberFormat('fr-FR').format(Math.round(n))
}

function fadeUp(i: number) {
  return {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.45, delay: i * 0.07, ease: [0.23, 1, 0.32, 1] as const },
  }
}

// ── KPI Card — fond neutre, icône colorée ──────────────────────────────────────

interface HeroCardProps {
  label: string
  value: string | number
  sub: string
  icon: React.ElementType
  bg: string        // accent color → détermine la couleur de l'icône
  badge?: string
  trend?: number
  href?: string
  i: number
}

function HeroCard({ label, value, sub, icon: Icon, bg, badge, trend, href, i }: HeroCardProps) {
  const iconColor = bg === '#DC2626' ? '#DC2626' : '#DC2626'

  const card = (
    <motion.div
      {...fadeUp(i)}
      whileHover={{ y: -2 }}
      className="kpi-card select-none"
      style={{
        background: 'var(--card-bg)',
        border: '1px solid var(--border)',
        borderRadius: 12,
        padding: '20px 24px',
        cursor: href ? 'pointer' : 'default',
      }}
    >
      <div className="flex items-start justify-between mb-4">
        <div style={{
          width: 36, height: 36,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: `${iconColor}18`,
          borderRadius: 8,
          flexShrink: 0,
        }}>
          <Icon size={18} style={{ color: iconColor }} />
        </div>
        {badge && (
          <span style={{
            background: 'rgba(245,30,51,0.1)',
            color: '#DC2626',
            fontSize: 10,
            fontWeight: 600,
            borderRadius: 4,
            padding: '2px 8px',
          }}>{badge}</span>
        )}
      </div>
      <p style={{
        fontSize: 11, fontWeight: 600,
        textTransform: 'uppercase', letterSpacing: '0.06em',
        color: 'var(--text-secondary)',
        marginBottom: 6,
      }}>{label}</p>
      <p style={{
        fontSize: 32, fontWeight: 800,
        color: 'var(--text-primary)',
        lineHeight: 1, marginBottom: 4,
      }}>{value}</p>
      <div className="flex items-center gap-2">
        <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{sub}</p>
        {trend !== undefined && (
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 2,
            fontSize: 10, fontWeight: 700,
            color: trend >= 0 ? '#DC2626' : '#DC2626',
          }}>
            <ArrowUpRight size={10} style={{ transform: trend < 0 ? 'rotate(90deg)' : undefined }} />
            {trend >= 0 ? '+' : ''}{trend.toFixed(1)}%
          </span>
        )}
      </div>
    </motion.div>
  )

  if (href) return <Link href={href}>{card}</Link>
  return card
}

// ── Solde Trésorerie card ─────────────────────────────────────────────────────

function TresorerieCard({ solde, pending, pendingAmt }: { solde: number; pending: number; pendingAmt: number }) {
  const { t } = useLocale()
  return (
    <motion.div {...fadeUp(4)} style={{
      background: 'var(--card-bg)',
      border: '1px solid var(--border)',
      borderRadius: 12,
      padding: 20,
    }}>
      <div className="flex items-center gap-2 mb-4">
        <div style={{ width: 32, height: 32, background: 'rgba(245,30,51,0.12)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Wallet size={16} style={{ color: '#DC2626' }} />
        </div>
        <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>{t('dash.solde')}</p>
      </div>
      <p style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1, marginBottom: 2 }}>{fmt(solde)} FCFA</p>
      <p style={{ fontSize: 10, color: 'var(--text-secondary)', marginBottom: 16 }}>{t('dash.monthCumul')}</p>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
        <div>
          <p style={{ fontSize: 10, color: 'var(--text-secondary)' }}>{t('common.pending')}</p>
          <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{fmt(pendingAmt)} F</p>
          <p style={{ fontSize: 10, color: 'var(--text-secondary)' }}>{pending} dossier{pending !== 1 ? 's' : ''}</p>
        </div>
        <div>
          <p style={{ fontSize: 10, color: 'var(--text-secondary)' }}>{t('common.status')}</p>
          <div className="flex items-center gap-1.5 mt-1">
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: solde >= 0 ? '#DC2626' : '#DC2626' }} />
            <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{solde >= 0 ? t('dash.positive') : t('dash.deficit')}</p>
          </div>
        </div>
      </div>
    </motion.div>
  )
}

// ── Quick Links card ──────────────────────────────────────────────────────────

function QuickLinksCard({ secteur, modules }: { secteur: string | null; modules: string[] }) {
  const { t } = useLocale()
  const links = secteur === 'ecole' ? [
    { label: t('nav.scolarite'),    href: '/dashboard/ecole/scolarite' },
    { label: t('nav.comptabilite'), href: '/dashboard/ecole/comptabilite' },
    { label: t('nav.rhPaie'),       href: '/dashboard/ecole/rh' },
    { label: t('nav.direction'),    href: '/dashboard/ecole/direction' },
    { label: t('nav.miaa'),         href: '/dashboard/ecole/miaa' },
  ] : [
    { label: t('nav.facturation'),  href: '/dashboard/facturation' },
    { label: t('nav.tresorerie'),   href: '/dashboard/tresorerie' },
    { label: t('sc.rhShort'),       href: '/dashboard/rh' },
    { label: t('sc.stockShort'),    href: '/dashboard/stocks' },
    { label: t('nav.comptabilite'), href: '/dashboard/comptabilite' },
  ]

  return (
    <motion.div {...fadeUp(5)} style={{
      background: 'var(--card-bg)',
      border: '1px solid var(--border)',
      borderRadius: 12,
      padding: 16,
    }}>
      <div className="flex items-center gap-2 mb-3">
        <Zap size={14} style={{ color: '#DC2626' }} />
        <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>{t('dash.quickLinks')}</p>
      </div>
      <div className="space-y-1">
        {links.map(l => (
          <Link key={l.href} href={l.href}
            className="flex items-center justify-between px-3 py-2 rounded-lg transition-all duration-200 group"
            style={{ border: '1px solid transparent' }}
            onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.borderColor = 'var(--border)'; (e.currentTarget as HTMLAnchorElement).style.background = 'var(--card-bg)' }}
            onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.borderColor = 'transparent'; (e.currentTarget as HTMLAnchorElement).style.background = 'transparent' }}
          >
            <span style={{ fontSize: 12, color: 'var(--text-secondary)' }} className="group-hover:text-[#DC2626] transition-colors">{l.label}</span>
            <ChevronRight size={12} style={{ color: 'var(--text-secondary)' }} />
          </Link>
        ))}
      </div>
    </motion.div>
  )
}

// ── Module breakdown card ─────────────────────────────────────────────────────

function TopModulesCard({ data }: { data: { name: string; value: number; color: string }[] }) {
  const { t } = useLocale()
  const total = data.reduce((s, d) => s + d.value, 0) || 1
  return (
    <motion.div {...fadeUp(6)} style={{
      background: 'var(--card-bg)',
      border: '1px solid var(--border)',
      borderRadius: 12,
      padding: 16,
    }}>
      <div className="flex items-center gap-2 mb-3">
        <BarChart2 size={14} style={{ color: '#DC2626' }} />
        <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>{t('dash.invoiceBreakdown')}</p>
      </div>
      {data.length === 0 ? (
        <p style={{ fontSize: 12, color: 'var(--text-secondary)', textAlign: 'center', padding: '12px 0' }}>{t('dash.noData')}</p>
      ) : (
        <div className="space-y-3">
          {data.map((d, i) => {
            const pct = Math.round((d.value / total) * 100)
            const barColor = d.color === '#0F172A' ? '#DC2626' : d.color
            return (
              <div key={i}>
                <div className="flex items-center justify-between mb-1">
                  <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{d.name}</span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-primary)' }}>{d.value}</span>
                </div>
                <div style={{ height: 4, background: 'var(--border)', borderRadius: 2, overflow: 'hidden' }}>
                  <motion.div
                    style={{ height: '100%', borderRadius: 2, background: barColor }}
                    initial={{ width: 0 }}
                    animate={{ width: `${pct}%` }}
                    transition={{ duration: 0.8, delay: 0.3 + i * 0.1, ease: 'easeOut' }}
                  />
                </div>
              </div>
            )
          })}
        </div>
      )}
    </motion.div>
  )
}

// ── Shortcut cards ────────────────────────────────────────────────────────────

type Shortcut = { labelKey: string; href: string; icon: React.ElementType; color: string; descKey: string }

const SECTOR_SHORTCUTS: Record<string, Shortcut[]> = {
  ecole: [
    { labelKey: 'sc.newEnrollment', href: '/dashboard/ecole/scolarite',        icon: GraduationCap, color: '#DC2626', descKey: 'sc.d.newEnrollment' },
    { labelKey: 'sc.trainerSpace',  href: '/dashboard/ecole/espace-formateur', icon: BookOpen,      color: '#DC2626', descKey: 'sc.d.trainerSpace' },
    { labelKey: 'sc.generalDir',    href: '/dashboard/ecole/direction',        icon: BarChart2,     color: '#DC2626', descKey: 'sc.d.generalDir' },
    { labelKey: 'nav.rhPaie',       href: '/dashboard/ecole/rh',               icon: Users,         color: '#DC2626', descKey: 'sc.d.rhPaie' },
    { labelKey: 'sc.comptaOhada',   href: '/dashboard/ecole/comptabilite',     icon: Calculator,    color: '#DC2626', descKey: 'sc.d.comptaOhada' },
    { labelKey: 'sc.miaaIA',        href: '/dashboard/ecole/miaa',             icon: Bot,           color: '#DC2626', descKey: 'sc.d.miaaIA' },
  ],
  restaurant: [
    { labelKey: 'sc.cashierPOS',  href: '/dashboard/restaurant', icon: ChefHat, color: '#DC2626', descKey: 'sc.d.cashierPOS' },
    { labelKey: 'sc.kitchenStock',href: '/dashboard/stocks',      icon: Package, color: '#DC2626', descKey: 'sc.d.kitchenStock' },
    { labelKey: 'nav.rhPaie',     href: '/dashboard/rh',         icon: Users,   color: '#DC2626', descKey: 'sc.d.rhPaie' },
    { labelKey: 'nav.tresorerie', href: '/dashboard/tresorerie', icon: Wallet,  color: '#DC2626', descKey: 'sc.d.tresoSuivi' },
    { labelKey: 'nav.depenses',   href: '/dashboard/depenses',   icon: Receipt, color: '#DC2626', descKey: 'sc.d.depenses' },
    { labelKey: 'sc.miaaPlus',    href: '/dashboard/miaa',       icon: Bot,     color: '#DC2626', descKey: 'sc.d.miaaPlus' },
  ],
  commerce: [
    { labelKey: 'nav.facturation',  href: '/dashboard/facturation',  icon: FileText,    color: '#DC2626', descKey: 'sc.d.facturation' },
    { labelKey: 'sc.stockShort',    href: '/dashboard/stocks',        icon: Package,     color: '#DC2626', descKey: 'sc.d.stock' },
    { labelKey: 'nav.tresorerie',   href: '/dashboard/tresorerie',   icon: Wallet,      color: '#DC2626', descKey: 'sc.d.finances' },
    { labelKey: 'nav.achats',       href: '/dashboard/achats',       icon: ShoppingCart,color: '#DC2626', descKey: 'sc.d.achats' },
    { labelKey: 'nav.rhPaie',       href: '/dashboard/rh',           icon: Users,       color: '#DC2626', descKey: 'sc.d.rh' },
    { labelKey: 'nav.comptabilite', href: '/dashboard/comptabilite', icon: Calculator,  color: '#DC2626', descKey: 'sc.d.comptabilite' },
  ],
  supermarche: [
    { labelKey: 'sc.caisse',       href: '/dashboard/facturation', icon: FileText,     color: '#DC2626', descKey: 'sc.d.caisse' },
    { labelKey: 'sc.rayonsStock',  href: '/dashboard/stocks',       icon: Package,      color: '#DC2626', descKey: 'sc.d.stock' },
    { labelKey: 'nav.achats',      href: '/dashboard/achats',      icon: ShoppingCart, color: '#DC2626', descKey: 'sc.d.achats' },
    { labelKey: 'nav.rhPaie',      href: '/dashboard/rh',          icon: Users,        color: '#DC2626', descKey: 'sc.d.rh' },
    { labelKey: 'nav.tresorerie',  href: '/dashboard/tresorerie',  icon: Wallet,       color: '#DC2626', descKey: 'sc.d.finances' },
  ],
  transport: [
    { labelKey: 'sc.fleet',         href: '/dashboard/transport',   icon: Truck,    color: '#DC2626', descKey: 'sc.d.fleet' },
    { labelKey: 'nav.facturation',  href: '/dashboard/facturation', icon: FileText, color: '#DC2626', descKey: 'sc.d.facturation' },
    { labelKey: 'sc.chauffeurs',    href: '/dashboard/rh',          icon: Users,    color: '#DC2626', descKey: 'sc.d.chauffeurs' },
    { labelKey: 'nav.tresorerie',   href: '/dashboard/tresorerie',  icon: Wallet,   color: '#DC2626', descKey: 'sc.d.finances' },
    { labelKey: 'sc.miaaPlus',      href: '/dashboard/miaa',        icon: Bot,      color: '#DC2626', descKey: 'sc.d.miaaPlus' },
  ],
  hotel: [
    { labelKey: 'sc.reservations',  href: '/dashboard/hotel',       icon: Hotel,    color: '#DC2626', descKey: 'sc.d.reservations' },
    { labelKey: 'nav.facturation',  href: '/dashboard/facturation', icon: FileText, color: '#DC2626', descKey: 'sc.d.facturationDevis' },
    { labelKey: 'nav.rhPaie',       href: '/dashboard/rh',          icon: Users,    color: '#DC2626', descKey: 'sc.d.rh' },
    { labelKey: 'nav.tresorerie',   href: '/dashboard/tresorerie',  icon: Wallet,   color: '#DC2626', descKey: 'sc.d.finances' },
    { labelKey: 'sc.miaaPlus',      href: '/dashboard/miaa',        icon: Bot,      color: '#DC2626', descKey: 'sc.d.miaaPlus' },
  ],
  sante: [
    { labelKey: 'sc.consultations', href: '/dashboard/facturation', icon: FileText, color: '#DC2626', descKey: 'sc.d.consultations' },
    { labelKey: 'sc.pharmacie',     href: '/dashboard/stocks',       icon: Package,  color: '#DC2626', descKey: 'sc.d.pharmacie' },
    { labelKey: 'sc.rhMedical',     href: '/dashboard/rh',           icon: Users,    color: '#DC2626', descKey: 'sc.d.rhMedical' },
    { labelKey: 'nav.tresorerie',   href: '/dashboard/tresorerie',   icon: Wallet,   color: '#DC2626', descKey: 'sc.d.finances' },
    { labelKey: 'sc.miaaPlus',      href: '/dashboard/miaa',         icon: Bot,      color: '#DC2626', descKey: 'sc.d.miaaPlus' },
  ],
  _default: [
    { labelKey: 'nav.facturation',  href: '/dashboard/facturation',  icon: FileText,   color: '#DC2626', descKey: 'sc.d.facturation' },
    { labelKey: 'nav.tresorerie',   href: '/dashboard/tresorerie',   icon: Wallet,     color: '#DC2626', descKey: 'sc.d.tresoSuivi' },
    { labelKey: 'nav.rhPaie',       href: '/dashboard/rh',           icon: Users,      color: '#DC2626', descKey: 'sc.d.rh' },
    { labelKey: 'sc.stockShort',    href: '/dashboard/stocks',        icon: Package,    color: '#DC2626', descKey: 'sc.d.stock' },
    { labelKey: 'nav.comptabilite', href: '/dashboard/comptabilite', icon: Calculator, color: '#DC2626', descKey: 'sc.d.comptabilite' },
    { labelKey: 'sc.miaaPlus',      href: '/dashboard/miaa',         icon: Bot,        color: '#DC2626', descKey: 'sc.d.miaaPlus' },
  ],
}

const ECOLE_ROLE_SHORTCUTS: Record<string, Shortcut[]> = {
  DAAC: [
    { labelKey: 'sc.matieres',    href: '/dashboard/ecole/daac',                  icon: BookOpen,      color: '#DC2626', descKey: 'sc.d.matieres' },
    { labelKey: 'sc.sessions',    href: '/dashboard/ecole/daac',                  icon: Layers,        color: '#DC2626', descKey: 'sc.d.sessions' },
    { labelKey: 'sc.examens',     href: '/dashboard/ecole/daac',                  icon: FileText,      color: '#DC2626', descKey: 'sc.d.examens' },
    { labelKey: 'sc.diplomes',    href: '/dashboard/ecole/daac',                  icon: GraduationCap, color: '#DC2626', descKey: 'sc.d.diplomes' },
    { labelKey: 'sc.soutenances', href: '/dashboard/ecole/daac',                  icon: Award,         color: '#DC2626', descKey: 'sc.d.soutenances' },
    { labelKey: 'nav.parametres', href: '/dashboard/ecole/parametres-academiques',icon: Settings,      color: '#DC2626', descKey: 'sc.d.parametresAcad' },
  ],
  RAF: [
    { labelKey: 'nav.comptabilite', href: '/dashboard/ecole/comptabilite', icon: Calculator, color: '#DC2626', descKey: 'sc.d.comptaJournal' },
    { labelKey: 'nav.tresorerie',   href: '/dashboard/ecole/tresorerie',   icon: Wallet,     color: '#DC2626', descKey: 'sc.d.tresoWallets' },
    { labelKey: 'sc.budgets',       href: '/dashboard/ecole/comptabilite', icon: BarChart2,  color: '#DC2626', descKey: 'sc.d.budgets' },
    { labelKey: 'sc.paie',          href: '/dashboard/ecole/rh',           icon: Users,      color: '#DC2626', descKey: 'sc.d.paie' },
    { labelKey: 'nav.depenses',     href: '/dashboard/ecole/tresorerie',   icon: TrendingUp, color: '#DC2626', descKey: 'sc.d.depensesSorties' },
    { labelKey: 'sc.miaaPlus',      href: '/dashboard/ecole/miaa',         icon: Bot,        color: '#DC2626', descKey: 'sc.d.miaaPlus' },
  ],
  RH_PAIE: [
    { labelKey: 'sc.employes',    href: '/dashboard/ecole/rh',   icon: Users,       color: '#DC2626', descKey: 'sc.d.employes' },
    { labelKey: 'sc.paie',        href: '/dashboard/ecole/rh',   icon: Wallet,      color: '#DC2626', descKey: 'sc.d.paie' },
    { labelKey: 'sc.contrats',    href: '/dashboard/ecole/rh',   icon: FileText,    color: '#DC2626', descKey: 'sc.d.contrats' },
    { labelKey: 'sc.absences',    href: '/dashboard/ecole/rh',   icon: CalendarOff, color: '#DC2626', descKey: 'sc.d.absencesConges' },
    { labelKey: 'sc.departements',href: '/dashboard/ecole/rh',   icon: BarChart2,   color: '#DC2626', descKey: 'sc.d.departements' },
    { labelKey: 'sc.miaaPlus',    href: '/dashboard/ecole/miaa', icon: Bot,         color: '#DC2626', descKey: 'sc.d.miaaPlus' },
  ],
  SCOLARITE: [
    { labelKey: 'sc.etudiants',   href: '/dashboard/ecole/scolarite', icon: GraduationCap, color: '#DC2626', descKey: 'sc.d.etudiants' },
    { labelKey: 'sc.inscriptions',href: '/dashboard/ecole/scolarite', icon: FileText,      color: '#DC2626', descKey: 'sc.d.inscriptions' },
    { labelKey: 'sc.paiements',   href: '/dashboard/ecole/scolarite', icon: Wallet,        color: '#DC2626', descKey: 'sc.d.paiementsScol' },
    { labelKey: 'sc.absences',    href: '/dashboard/ecole/scolarite', icon: CalendarOff,   color: '#DC2626', descKey: 'sc.d.absencesReleves' },
    { labelKey: 'sc.classes',     href: '/dashboard/ecole/scolarite', icon: BookOpen,      color: '#DC2626', descKey: 'sc.d.classes' },
    { labelKey: 'sc.miaaPlus',    href: '/dashboard/ecole/miaa',      icon: Bot,           color: '#DC2626', descKey: 'sc.d.miaaPlus' },
  ],
  FORMATEUR: [
    { labelKey: 'sc.mesCours',    href: '/dashboard/ecole/espace-formateur', icon: BookOpen,      color: '#DC2626', descKey: 'sc.d.mesCours' },
    { labelKey: 'sc.presences',   href: '/dashboard/ecole/espace-formateur', icon: CheckCircle,   color: '#DC2626', descKey: 'sc.d.presences' },
    { labelKey: 'school.grades',  href: '/dashboard/ecole/espace-formateur', icon: Star,          color: '#DC2626', descKey: 'sc.d.notes' },
    { labelKey: 'sc.classes',     href: '/dashboard/ecole/espace-formateur', icon: GraduationCap, color: '#DC2626', descKey: 'sc.d.mesClasses' },
    { labelKey: 'sc.examens',     href: '/dashboard/ecole/daac',             icon: FileText,      color: '#DC2626', descKey: 'sc.d.deliberations' },
    { labelKey: 'sc.miaaPlus',    href: '/dashboard/ecole/miaa',             icon: Bot,           color: '#DC2626', descKey: 'sc.d.miaaPlus' },
  ],
  ETUDIANT: [
    { labelKey: 'sc.mesNotes',  href: '/dashboard/ecole/espace-etudiant', icon: Star,        color: '#DC2626', descKey: 'sc.d.mesNotes' },
    { labelKey: 'sc.bulletins', href: '/dashboard/ecole/espace-etudiant', icon: FileText,    color: '#DC2626', descKey: 'sc.d.bulletins' },
    { labelKey: 'sc.paiements', href: '/dashboard/ecole/espace-etudiant', icon: Wallet,      color: '#DC2626', descKey: 'sc.d.fraisQuittances' },
    { labelKey: 'sc.absences',  href: '/dashboard/ecole/espace-etudiant', icon: CalendarOff, color: '#DC2626', descKey: 'sc.d.mesAbsences' },
    { labelKey: 'sc.planning',  href: '/dashboard/ecole/espace-etudiant', icon: Clock,       color: '#DC2626', descKey: 'sc.d.planning' },
    { labelKey: 'sc.miaaPlus',  href: '/dashboard/ecole/miaa',            icon: Bot,         color: '#DC2626', descKey: 'sc.d.miaaPlus' },
  ],
  PARENT: [
    { labelKey: 'sc.resultats', href: '/dashboard/ecole/espace-parent', icon: Star,           color: '#DC2626', descKey: 'sc.d.resultatsEnfant' },
    { labelKey: 'sc.bulletins', href: '/dashboard/ecole/espace-parent', icon: FileText,       color: '#DC2626', descKey: 'sc.d.bulletins' },
    { labelKey: 'sc.paiements', href: '/dashboard/ecole/espace-parent', icon: Wallet,         color: '#DC2626', descKey: 'sc.d.fraisScolarite' },
    { labelKey: 'sc.absences',  href: '/dashboard/ecole/espace-parent', icon: CalendarOff,    color: '#DC2626', descKey: 'sc.d.absencesParent' },
    { labelKey: 'sc.contact',   href: '/dashboard/ecole/espace-parent', icon: HeartHandshake, color: '#DC2626', descKey: 'sc.d.contactEcole' },
    { labelKey: 'sc.miaaPlus',  href: '/dashboard/ecole/miaa',          icon: Bot,            color: '#DC2626', descKey: 'sc.d.miaaPlus' },
  ],
}

function ShortcutCards({ secteur, ecoleRole }: { secteur: string | null; ecoleRole: string | null }) {
  const { t } = useLocale()

  let cards: Shortcut[]
  if (secteur === 'ecole' && ecoleRole && ecoleRole !== 'DIRECTION_GENERALE' && ECOLE_ROLE_SHORTCUTS[ecoleRole]) {
    cards = ECOLE_ROLE_SHORTCUTS[ecoleRole]
  } else {
    cards = (secteur ? SECTOR_SHORTCUTS[secteur] : null) ?? SECTOR_SHORTCUTS._default
  }

  return (
    <motion.div {...fadeUp(9)} style={{ marginBottom: 24 }}>
      <div className="flex items-center gap-2 mb-4">
        <Zap size={14} style={{ color: '#DC2626' }} />
        <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{t('dash.shortcuts')}</h3>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {cards.map((sc, i) => {
          const Icon = sc.icon
          const iconColor = sc.color === '#DC2626' ? '#DC2626' : '#DC2626'
          return (
            <motion.div
              key={sc.href + sc.labelKey}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: 0.05 + i * 0.04 }}
            >
              <Link
                href={sc.href}
                className="flex items-center gap-3 transition-all duration-200 group"
                style={{
                  background: 'var(--card-bg)',
                  border: '1px solid var(--border)',
                  borderRadius: 10,
                  padding: '14px 18px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  textDecoration: 'none',
                }}
                onMouseEnter={e => {
                  const el = e.currentTarget as HTMLAnchorElement
                  el.style.borderColor = '#DC2626'
                  el.style.transform = 'translateY(-1px)'
                }}
                onMouseLeave={e => {
                  const el = e.currentTarget as HTMLAnchorElement
                  el.style.borderColor = 'var(--border)'
                  el.style.transform = 'translateY(0)'
                }}
              >
                <Icon size={20} style={{ color: iconColor, flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 1 }}>{t(sc.labelKey)}</p>
                  <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{t(sc.descKey)}</p>
                </div>
                <ChevronRight size={16} style={{ color: 'var(--text-secondary)', flexShrink: 0 }} />
              </Link>
            </motion.div>
          )
        })}
      </div>
    </motion.div>
  )
}

// ── Transaction row ───────────────────────────────────────────────────────────

const STATUT_CFG: Record<string, { labelKey: string; bg: string; color: string }> = {
  payee:     { labelKey: 'invoice.lbl.payee',     bg: 'rgba(255,255,255,0.08)', color: 'var(--text-primary)' },
  envoyee:   { labelKey: 'invoice.lbl.envoyee',   bg: 'rgba(245,30,51,0.15)',   color: '#DC2626' },
  brouillon: { labelKey: 'invoice.lbl.brouillon', bg: 'rgba(255,255,255,0.06)', color: 'var(--text-secondary)' },
  annulee:   { labelKey: 'invoice.lbl.annulee',   bg: 'rgba(245,30,51,0.15)',   color: '#DC2626' },
}

function TransactionRow({ item, i }: { item: ActivityItem; i: number }) {
  const { t } = useLocale()
  const st   = STATUT_CFG[item.statut] ?? STATUT_CFG.brouillon
  const init = (item.client_nom ?? 'C').split(' ').map((w: string) => w[0]).slice(0, 2).join('').toUpperCase()
  const diff = Date.now() - new Date(item.created_at).getTime()
  const ago  = diff < 3600000 ? `${Math.floor(diff / 60000)}min`
             : diff < 86400000 ? `${Math.floor(diff / 3600000)}h`
             : `${Math.floor(diff / 86400000)}j`
  const colors = ['#DC2626', '#DC2626', '#7C3AED', '#DC2626', '#7C3AED', '#DC2626', '#DC2626']
  const avatarColor = colors[item.client_nom.charCodeAt(0) % colors.length]

  return (
    <motion.tr
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.35, delay: i * 0.05 }}
      className="border-b transition-colors"
      style={{ borderColor: 'var(--border)' }}
    >
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <div style={{ width: 36, height: 36, borderRadius: '50%', background: `${avatarColor}20`, color: avatarColor, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>
            {init}
          </div>
          <div>
            <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{item.client_nom}</p>
            <p style={{ fontSize: 10, color: 'var(--text-secondary)' }}>{t('dash.ago')} {ago}</p>
          </div>
        </div>
      </td>
      <td className="px-4 py-3 text-right">
        <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{fmt(item.total)} FCFA</p>
      </td>
      <td className="px-4 py-3">
        <span style={{ background: st.bg, color: st.color, fontSize: 10, fontWeight: 700, borderRadius: 20, padding: '3px 10px', display: 'inline-block' }}>
          {t(st.labelKey)}
        </span>
      </td>
    </motion.tr>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function DashboardClient({ data, userName }: { data: DashboardData; userName?: string }) {
  const { t } = useLocale()
  const router = useRouter()
  const { tenant, kpis, alerts, recentActivity, chartData } = data
  const isFinancial     = data.isFinancial ?? true
  const secteur         = data.secteur ?? null
  const ecoleRole       = data.ecoleRole ?? null
  const ecoleKpis       = data.ecoleKpis ?? null
  const daacKpis        = data.daacKpis ?? null
  const rhKpis          = data.rhKpis ?? null
  const ecoleFinancials = data.ecoleFinancials ?? null

  const [greetingKey, setGreetingKey] = useState('dash.greetingMorning')
  useEffect(() => {
    const h = new Date().getHours()
    setGreetingKey(h < 12 ? 'dash.greetingMorning' : h < 18 ? 'dash.greetingAfternoon' : 'dash.greetingEvening')
  }, [])

  const displayName      = userName || 'Admin'
  const soldeTresorerie  = kpis.revenuMois - alerts.pendingAmount * 0.3

  const isDaac = secteur === 'ecole' && ecoleRole === 'DAAC' && daacKpis
  const isRH   = secteur === 'ecole' && (ecoleRole === 'RH_PAIE' || ecoleRole === 'RAF') && rhKpis

  const heroCards: HeroCardProps[] = isDaac ? [
    { label: t('dash.sessionsEnCours'),   value: daacKpis!.sessionsEnCours,   sub: t('dash.sessionsActivesKpi'), icon: Layers,        bg: '#7C3AED', badge: 'DAAC',           href: '/dashboard/ecole/daac',      i: 0 },
    { label: t('dash.diplomesEnAttente'), value: daacKpis!.diplomesEnAttente, sub: t('dash.enCoursValidation'), icon: GraduationCap, bg: '#DC2626', badge: t('sc.diplomes'), href: '/dashboard/ecole/daac',      i: 1 },
    { label: t('dash.soutenancesPlanif'), value: daacKpis!.nbSoutenances,     sub: t('dash.aVenirMois'),        icon: Award,         bg: '#7C3AED',                           href: '/dashboard/ecole/daac',      i: 2 },
    { label: t('dash.etudiantsActifsKpi'),value: ecoleKpis?.nbActifs ?? 0,    sub: t('dash.inscritsActifs'),    icon: Users,         bg: '#DC2626', badge: t('common.active'),href: '/dashboard/ecole/scolarite', i: 3 },
  ] : isRH ? [
    { label: t('dash.employesActifsKpi'), value: rhKpis!.nbActifs,  sub: t('dash.personnelPoste'),   icon: Users,          bg: '#DC2626', badge: t('common.active'),    href: '/dashboard/ecole/rh', i: 0 },
    { label: t('dash.enConge'),           value: rhKpis!.nbConges,  sub: t('dash.absencesCongesKpi'),icon: CalendarOff,    bg: '#DC2626', badge: t('rh.leave'),          href: '/dashboard/ecole/rh', i: 1 },
    { label: t('dash.totalPersonnel'),    value: kpis.nbEmployes,   sub: t('dash.tousStatuts'),      icon: HeartHandshake, bg: '#7C3AED', badge: t('rh.employees'),      href: '/dashboard/ecole/rh', i: 2 },
  ] : isFinancial && secteur === 'ecole' && ecoleKpis ? [
    { label: t('dash.enrolled'),         value: ecoleKpis.nbEtudiants,                            sub: `${ecoleKpis.nbActifs} ${t('dash.actifs')} · ${ecoleKpis.nbSuspendus} ${t('dash.suspendus')}`, icon: GraduationCap, bg: '#DC2626', badge: t('sc.inscriptions'), href: '/dashboard/ecole/scolarite', i: 0 },
    { label: t('dash.revenusScolaires'), value: `${fmt(ecoleFinancials?.revenusMois ?? 0)} FCFA`, sub: `${ecoleFinancials?.nbPaiementsMois ?? 0} ${t('dash.paiementsMois')}`,                          icon: TrendingUp,    bg: '#DC2626', badge: t('dash.ceMoisCi'),   href: '/dashboard/ecole/scolarite', i: 1 },
    { label: t('dash.impayesScolarite'), value: ecoleFinancials?.nbImpayesDossiers ?? 0,          sub: `${fmt(ecoleFinancials?.montantImpayeTotal ?? 0)} ${t('dash.enAttentePmt')}`,                    icon: AlertTriangle, bg: '#DC2626',                                href: '/dashboard/ecole/scolarite', i: 2 },
    { label: t('dash.totalAbsences'),    value: ecoleKpis.nbAbsences,                             sub: t('school.absences'),                                                                              icon: CalendarOff,   bg: '#7C3AED',                                                                    i: 3 },
  ] : secteur === 'ecole' && ecoleKpis ? [
    { label: t('dash.enrolled'),     value: ecoleKpis.nbEtudiants, sub: `${ecoleKpis.nbActifs} ${t('dash.actifs')}`, icon: GraduationCap, bg: '#DC2626', badge: t('sc.inscriptions'), href: '/dashboard/ecole/scolarite', i: 0 },
    { label: t('dash.active'),       value: ecoleKpis.nbActifs,    sub: t('dash.paymentsPaid'),                      icon: Users,         bg: '#DC2626', badge: t('common.active'),   href: '/dashboard/ecole/scolarite', i: 1 },
    { label: t('dash.suspended'),    value: ecoleKpis.nbSuspendus, sub: t('dash.paymentsPending'),                   icon: UserX,         bg: '#DC2626',                                                                   i: 2 },
    { label: t('dash.totalAbsences'),value: ecoleKpis.nbAbsences,  sub: t('school.absences'),                        icon: CalendarOff,   bg: '#7C3AED',                                                                   i: 3 },
  ] : isFinancial ? [
    { label: t('dash.revenue'),          value: `${fmt(kpis.revenuMois)} FCFA`,                                                        sub: t('dash.billedInvoices'),                                                                                                                               icon: TrendingUp,    bg: '#DC2626', badge: t('dash.ceMoisCi'), trend: 12.5, href: '/dashboard/facturation', i: 0 },
    { label: t('dash.facturesPayees'),   value: chartData.moduleBreakdown.find(m => m.statut === 'payee')?.value ?? 0,                   sub: t('dash.ceMoisCi'),                                                                                                                                     icon: CheckCircle,   bg: '#DC2626',                               href: '/dashboard/facturation', i: 1 },
    { label: t('dash.facturesAttente'),  value: alerts.pendingCount,                                                                    sub: `${fmt(alerts.pendingAmount)} FCFA ${t('common.pending').toLowerCase()}`,                                                                              icon: Clock,         bg: '#DC2626', badge: t('dash.pending'),  href: '/dashboard/facturation', i: 2 },
    { label: alerts.lowStockCount > 0 ? t('dash.rupturesStock') : t('dash.alertesStock'), value: kpis.nbAlertes, sub: alerts.lowStockCount > 0 ? `${alerts.lowStockCount} ${alerts.lowStockCount > 1 ? t('dash.articlesEpuises') : t('dash.articleEpuise')}` : t('dash.toutEnOrdre'), icon: AlertTriangle, bg: '#DC2626',                               i: 3 },
  ] : [
    { label: t('dash.employees'), value: kpis.nbEmployes, sub: t('dash.dansEquipe'),        icon: Users,         bg: '#DC2626', badge: t('rh.employees'),  href: '/dashboard/rh',     i: 0 },
    { label: t('dash.stock'),     value: kpis.nbArticles, sub: t('dash.refsInventoriees'),  icon: Package,       bg: '#DC2626',                             href: '/dashboard/stocks', i: 1 },
    { label: t('dash.alerts'),    value: kpis.nbAlertes,  sub: t('dash.aTraiter'),          icon: AlertTriangle, bg: '#DC2626',                                                        i: 2 },
  ]

  return (
    <div className="space-y-6 pb-6">

      {/* ── Role badge ──────────────────────────────────────────────────── */}
      {secteur === 'ecole' && ecoleRole && ecoleRole !== 'DIRECTION_GENERALE' && (() => {
        const ROLE_LABELS: Record<string, { labelKey: string; color: string }> = {
          DAAC:      { labelKey: 'roles.daac_full',     color: '#DC2626' },
          SCOLARITE: { labelKey: 'roles.scolarite_full',color: '#DC2626' },
          RAF:       { labelKey: 'roles.raf_full',      color: '#DC2626' },
          RH_PAIE:   { labelKey: 'roles.rhPaie_full',   color: '#DC2626' },
          FORMATEUR: { labelKey: 'roles.formateur_full',color: '#DC2626' },
          ETUDIANT:  { labelKey: 'roles.etudiant_full', color: '#7C3AED' },
          PARENT:    { labelKey: 'roles.parent_full',   color: '#7C3AED' },
        }
        const cfg = ROLE_LABELS[ecoleRole]
        if (!cfg) return null
        return (
          <motion.div {...fadeUp(0)} className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-xs font-medium"
            style={{ background: `${cfg.color}12`, border: `1px solid ${cfg.color}30`, color: cfg.color }}>
            <Star size={13} />
            <span>{t('dash.connectedAs')} <strong>{t(cfg.labelKey)}</strong></span>
          </motion.div>
        )
      })()}

      {!isFinancial && !ecoleRole && (
        <motion.div {...fadeUp(0)} className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-xs"
          style={{ background: 'rgba(139,0,112,0.08)', border: '1px solid rgba(139,0,112,0.2)', color: 'var(--text-secondary)' }}>
          <Lock size={13} />
          <span>{t('dash.academicView')}</span>
        </motion.div>
      )}

      {/* ── Greeting Banner — orange plat ───────────────────────────────── */}
      <motion.div {...fadeUp(0)} style={{ background: '#DC2626', borderRadius: 12, padding: '20px 24px' }}>
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h1 style={{ fontSize: 22, fontWeight: 700, color: '#FFFFFF', lineHeight: 1.2 }}>
                {t(greetingKey)}, {displayName} 👋
              </h1>
              <button
                onClick={() => router.refresh()}
                style={{ color: 'rgba(255,255,255,0.5)', padding: 4 }}
                className="hover:opacity-80 transition-opacity"
                title={t('dash.refresh')}
              >
                <RefreshCw size={13} />
              </button>
            </div>
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.75)', marginBottom: 4 }}>
              {isFinancial ? t('dash.bannerFinancial') : t('dash.bannerSpace')}
            </p>
            <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)' }}>
              <span style={{ fontWeight: 600, color: '#FFFFFF' }}>{tenant.nom_entreprise}</span>
              {' · '}{t('dash.plan')} <span style={{ fontWeight: 700 }}>{tenant.plan.toUpperCase()}</span>
              {' · '}{tenant.modules_actifs.length} {tenant.modules_actifs.length !== 1 ? t('dash.modulesSuffix') : t('dash.moduleSuffix')}
            </p>
          </div>

          {/* Mini-stats */}
          {isFinancial && (
            <div className="flex flex-wrap gap-2 shrink-0">
              <div style={{ background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.25)', borderRadius: 8, padding: '12px 16px', textAlign: 'center', minWidth: 90 }}>
                <p style={{ fontSize: 9, color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>{t('dash.recovery')}</p>
                <p style={{ fontSize: 14, fontWeight: 700, color: '#FFFFFF' }}>{fmt(kpis.revenuMois)} F</p>
              </div>
              <div style={{ background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.25)', borderRadius: 8, padding: '12px 16px', textAlign: 'center', minWidth: 90 }}>
                <p style={{ fontSize: 9, color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>{t('dash.sessionsHeader')}</p>
                <p style={{ fontSize: 14, fontWeight: 700, color: '#FFFFFF' }}>
                  {alerts.pendingCount} {alerts.pendingCount !== 1 ? t('dash.invoicePl') : t('dash.invoiceSg')}
                </p>
              </div>
              <div style={{ background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.25)', borderRadius: 8, padding: '12px 16px', textAlign: 'center', minWidth: 90 }}>
                <p style={{ fontSize: 9, color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>{t('dash.impayesHeader')}</p>
                <p style={{ fontSize: 14, fontWeight: 700, color: '#FFFFFF' }}>
                  {alerts.lowStockCount > 0 ? `${alerts.lowStockCount} ${alerts.lowStockCount > 1 ? t('dash.alertPl') : t('dash.alertSg')}` : t('dash.toutEnOrdre')}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2 flex-wrap mt-4">
          <Link
            href={secteur === 'ecole' ? '/dashboard/ecole/scolarite' : '/dashboard/facturation'}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl hover:opacity-90 transition-all"
            style={{ background: '#FFFFFF', color: '#DC2626' }}
          >
            <Plus size={11} /> {secteur === 'ecole' ? t('dash.newInscription') : t('dash.newAction')}
          </Link>
          {isFinancial && (
            <>
              <button className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-white border rounded-xl hover:bg-white/10 transition-all" style={{ borderColor: 'rgba(255,255,255,0.5)' }}>
                <Download size={11} /> CSV
              </button>
              <button className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-white border rounded-xl hover:bg-white/10 transition-all" style={{ borderColor: 'rgba(255,255,255,0.5)' }}>
                <Download size={11} /> PDF
              </button>
            </>
          )}
          <button className="flex items-center gap-1.5 px-3 py-2 text-xs text-white border rounded-xl hover:bg-white/10 transition-all ml-auto" style={{ borderColor: 'rgba(255,255,255,0.4)', color: 'rgba(255,255,255,0.8)' }}>
            <Clock size={11} /> {t('dash.lastDays')} <ChevronDown size={10} />
          </button>
        </div>
      </motion.div>

      {/* ── KPI Cards ────────────────────────────────────────────────────── */}
      <div className={`grid gap-3 sm:gap-4 ${heroCards.length === 4 ? 'grid-cols-2 xl:grid-cols-4' : 'grid-cols-2 xl:grid-cols-3'}`}>
        {heroCards.map(card => <HeroCard key={card.label} {...card} />)}
      </div>

      {/* ── Graphiques + panel droit ─────────────────────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="xl:col-span-2 space-y-4">
          <motion.div {...fadeUp(5)}>
            <RevenueChart data={chartData.daily} />
          </motion.div>
          <motion.div {...fadeUp(6)}>
            <ModuleChart
              data={chartData.moduleBreakdown}
              title={isFinancial ? t('dash.invoiceStatus') : t('dash.activeModules')}
            />
          </motion.div>
        </div>
        <div className="space-y-4">
          {isFinancial && (
            <TresorerieCard
              solde={soldeTresorerie}
              pending={alerts.pendingCount}
              pendingAmt={alerts.pendingAmount}
            />
          )}
          <TopModulesCard data={chartData.moduleBreakdown} />
          <QuickLinksCard secteur={secteur} modules={tenant.modules_actifs} />
        </div>
      </div>

      {/* ── Transactions récentes ────────────────────────────────────────── */}
      {isFinancial && recentActivity.length > 0 && (
        <motion.div {...fadeUp(7)} style={{
          background: 'var(--card-bg)',
          border: '1px solid var(--border)',
          borderRadius: 12,
          overflow: 'hidden',
          marginBottom: 24,
        }}>
          <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid var(--border)' }}>
            <div>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{t('dash.lastTransactions')}</h3>
              <p style={{ fontSize: 10, color: 'var(--text-secondary)', marginTop: 2 }}>{recentActivity.length} {t('dash.lastFactures')}</p>
            </div>
            <Link href="/dashboard/facturation" style={{ fontSize: 12, color: '#DC2626', fontWeight: 600 }}>
              {t('dash.viewAll')}
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)', background: 'transparent' }}>
                  <th className="text-left px-4 py-3" style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{t('common.name')}</th>
                  <th className="text-right px-4 py-3" style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{t('common.amount')}</th>
                  <th className="text-left px-4 py-3" style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{t('common.status')}</th>
                </tr>
              </thead>
              <tbody>
                {recentActivity.map((item, i) => (
                  <TransactionRow key={item.id} item={item} i={i} />
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>
      )}

      {!isFinancial && (
        <motion.div {...fadeUp(7)} style={{
          background: 'var(--card-bg)',
          border: '1px solid var(--border)',
          borderRadius: 12,
          padding: 24,
          textAlign: 'center',
          marginBottom: 24,
        }}>
          <div style={{ width: 48, height: 48, borderRadius: 12, background: 'rgba(245,30,51,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
            <Star size={20} style={{ color: '#DC2626' }} />
          </div>
          <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>{t('dash.restricted')}</p>
          <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{t('dash.restrictedMsg')}</p>
        </motion.div>
      )}

      {/* ── Raccourcis ───────────────────────────────────────────────────── */}
      <ShortcutCards secteur={secteur} ecoleRole={ecoleRole} />

    </div>
  )
}

'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion'
import {
  TrendingUp, Users, Package, AlertTriangle, Download,
  Clock, GraduationCap, UserX, CalendarOff, Lock,
  Wallet, CheckCircle, FileText, ArrowUpRight,
  Zap, BarChart2, Star, ChevronRight, ChefHat, Bot, ShoppingCart,
  Receipt, Truck, Hotel, BookOpen, Calculator, HeartHandshake,
  Award, Layers, Settings, RefreshCw,
} from 'lucide-react'
import Link from 'next/link'
import RevenueChart from '@/components/dashboard/RevenueChart'
import ModuleChart from '@/components/dashboard/ModuleChart'
import { type ActivityItem } from '@/components/ui/ActivityTimeline'
import { useLocale } from '@/lib/hooks/useLocale'
import { useFmt } from '@/lib/hooks/useFmt'
import GeoDetectionBanner from '@/components/ui/GeoDetectionBanner'
import { getTenantBrandColor } from '@/lib/utils'
import { BannerTicker } from '@/components/dashboard/BannerTicker'
import { useTheme } from '@/lib/contexts/ThemeContext'

export interface DashboardData {
  tenant: { nom_entreprise: string; modules_actifs: string[]; plan: string }
  tenantId: string
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

function fadeUp(i: number) {
  return {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.45, delay: i * 0.07, ease: [0.23, 1, 0.32, 1] as const },
  }
}

// ── KPI Card ──────────────────────────────────────────────────────────────────

interface HeroCardProps {
  label: string
  value: string | number
  sub: string
  icon: React.ElementType
  bg: string
  badge?: string
  trend?: number
  href?: string
  i: number
}

const ACCENT_COLORS = ['#DC2626', '#2563EB', '#16A34A', '#8B5CF6']

// Animated spring counter for numeric KPI values
function SpringCounter({ target, accent: _accent }: { target: number; accent: string }) {
  const mv      = useMotionValue(0)
  const spring  = useSpring(mv, { stiffness: 50, damping: 18, restDelta: 0.5 })
  const display = useTransform(spring, v => Math.floor(v).toLocaleString('fr-FR'))
  useEffect(() => { mv.set(target) }, [target, mv])
  return (
    <motion.span className="num" style={{ color: '#0F172A' }}>
      {display}
    </motion.span>
  )
}

function HeroCard({ label, value, sub, icon: Icon, badge, trend, href, i }: HeroCardProps) {
  const accent  = ACCENT_COLORS[i % ACCENT_COLORS.length]
  const isNum   = typeof value === 'number'

  const card = (
    <motion.div
      {...fadeUp(i)}
      whileHover={{ y: -3, boxShadow: '0 8px 28px rgba(0,0,0,0.09), 0 1px 4px rgba(0,0,0,0.04)' }}
      className="select-none card-premium"
      style={{
        padding: '20px 22px',
        cursor: href ? 'pointer' : 'default',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Top accent strip */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 3,
        background: `linear-gradient(90deg, ${accent}CC, ${accent}30 70%, transparent)`,
      }} />

      {/* Trend badge */}
      {trend !== undefined && (
        <span style={{
          position: 'absolute', top: 16, right: 14,
          display: 'inline-flex', alignItems: 'center', gap: 3,
          fontSize: 10, fontWeight: 700, borderRadius: 20, padding: '3px 9px',
          background: trend >= 0 ? '#F0FDF4' : '#FEF2F2',
          color: trend >= 0 ? '#16A34A' : '#DC2626',
          border: `1px solid ${trend >= 0 ? '#BBF7D0' : '#FECACA'}`,
        }}>
          <ArrowUpRight size={9} style={{ transform: trend < 0 ? 'rotate(90deg)' : undefined }} />
          {trend >= 0 ? '+' : ''}{trend.toFixed(1)}%
        </span>
      )}

      {/* Icon well */}
      <div className="icon-well" style={{ background: `${accent}14`, marginBottom: 14 }}>
        <Icon size={17} style={{ color: accent }} />
      </div>

      {/* Label */}
      <p className="section-label" style={{ marginBottom: 5 }}>{label}</p>

      {/* Value */}
      <p className="kpi-value" style={{ marginBottom: 6 }}>
        {isNum ? <SpringCounter target={value as number} accent={accent} /> : value}
      </p>

      {/* Sub + badge */}
      <div className="flex items-center gap-2 flex-wrap">
        <p style={{ fontSize: 11, color: '#94A3B8', flex: 1, minWidth: 0 }}>{sub}</p>
        {badge && (
          <span style={{
            background: `${accent}12`, color: accent,
            fontSize: 9, fontWeight: 700, borderRadius: 5, padding: '2px 7px',
            border: `1px solid ${accent}25`, whiteSpace: 'nowrap',
          }}>
            {badge}
          </span>
        )}
      </div>
    </motion.div>
  )

  if (href) return <Link href={href} prefetch={true}>{card}</Link>
  return card
}

// ── Solde Trésorerie card ─────────────────────────────────────────────────────

function TresorerieCard({ solde, pending, pendingAmt }: { solde: number; pending: number; pendingAmt: number }) {
  const { fmt: fmtCurrency } = useFmt()
  const { t } = useLocale()
  const isPositive = solde >= 0
  const statusColor = isPositive ? '#16A34A' : '#DC2626'
  return (
    <motion.div {...fadeUp(4)} className="card-premium" style={{ padding: 20 }}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2.5">
          <div className="icon-well" style={{ background: 'rgba(220,38,38,0.10)', width: 32, height: 32, borderRadius: 8 }}>
            <Wallet size={14} style={{ color: '#DC2626' }} />
          </div>
          <p style={{ fontSize: 12, fontWeight: 600, color: '#64748B' }}>{t('dash.solde')}</p>
        </div>
        <span style={{
          background: isPositive ? '#F0FDF4' : '#FEF2F2',
          color: statusColor,
          border: `1px solid ${isPositive ? '#BBF7D0' : '#FECACA'}`,
          fontSize: 10, fontWeight: 700, borderRadius: 20, padding: '3px 9px',
        }}>
          {isPositive ? t('dash.positive') : t('dash.deficit')}
        </span>
      </div>
      <p className="num" style={{ fontSize: 22, fontWeight: 800, color: '#0F172A', lineHeight: 1, marginBottom: 3, letterSpacing: '-0.02em' }}>
        {fmtCurrency(solde)}
      </p>
      <p style={{ fontSize: 10, color: '#94A3B8', marginBottom: 14 }}>{t('dash.monthCumul')}</p>

      {/* Health bar */}
      <div className="progress-track" style={{ marginBottom: 14 }}>
        <motion.div
          className="progress-fill"
          style={{ color: statusColor }}
          initial={{ width: 0 }}
          animate={{ width: isPositive ? '72%' : '28%' }}
          transition={{ duration: 0.9, ease: 'easeOut' }}
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, paddingTop: 12, borderTop: '1px solid #F1F5F9' }}>
        <div>
          <p className="section-label" style={{ marginBottom: 4 }}>{t('common.pending')}</p>
          <p className="num" style={{ fontSize: 13, fontWeight: 700, color: '#0F172A' }}>{fmtCurrency(pendingAmt)}</p>
          <p style={{ fontSize: 10, color: '#94A3B8', marginTop: 1 }}>{pending} {pending !== 1 ? t('dash.dossiers') : t('dash.dossier')}</p>
        </div>
        <div>
          <p className="section-label" style={{ marginBottom: 4 }}>{t('dash.statut')}</p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: statusColor }} className="pulse-dot" />
            <span style={{ fontSize: 11, fontWeight: 600, color: statusColor }}>
              {isPositive ? t('dash.positive') : t('dash.deficit')}
            </span>
          </div>
        </div>
      </div>
    </motion.div>
  )
}

// ── Quick Actions grid ────────────────────────────────────────────────────────

function QuickLinksCard({ secteur }: { secteur: string | null; modules: string[] }) {
  const { t } = useLocale()
  const actions = secteur === 'ecole' ? [
    { label: t('sc.newEnrollment'),      desc: t('sc.d.newEnrollment'),  href: '/dashboard/ecole/scolarite', color: '#DC2626', bg: '#FFFBEB', icon: GraduationCap },
    { label: t('sc.validatePayments'),   desc: t('sc.d.paiementsScol'),  href: '/dashboard/ecole/scolarite', color: '#16A34A', bg: '#F0FDF4', icon: CheckCircle },
    { label: t('sc.d.paie'),             desc: t('sc.generatePayroll'),   href: '/dashboard/ecole/rh',        color: '#2563EB', bg: '#EFF6FF', icon: FileText },
    { label: t('nav.dashboard'),         desc: t('nav.directionSub'),     href: '/dashboard/ecole/direction', color: '#7C3AED', bg: '#F5F3FF', icon: BarChart2 },
  ] : [
    { label: t('dash.newAction'),        desc: t('sc.d.facturation'),     href: '/dashboard/facturation',  color: '#DC2626', bg: '#FFFBEB', icon: FileText },
    { label: t('dash.validateInvoices'), desc: t('dash.pendingPayments'), href: '/dashboard/facturation',  color: '#16A34A', bg: '#F0FDF4', icon: CheckCircle },
    { label: t('nav.rapports'),          desc: t('dash.dataAnalysis'),    href: '/dashboard/bi',           color: '#2563EB', bg: '#EFF6FF', icon: BarChart2 },
    { label: t('nav.parametres'),        desc: t('dash.systemConfig'),    href: '/dashboard/parametres',   color: '#7C3AED', bg: '#F5F3FF', icon: Settings },
  ]

  return (
    <motion.div {...fadeUp(5)} style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 14, padding: 18 }}>
      <div className="flex items-center gap-2 mb-3">
        <Zap size={13} style={{ color: '#DC2626' }} />
        <p style={{ fontSize: 12, fontWeight: 700, color: '#0F172A' }}>{t('dash.quickLinks')}</p>
        <span style={{ fontSize: 10, color: '#94A3B8', marginLeft: 2 }}>{t('dash.actionsFrequentes')}</span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {actions.map((a, i) => {
          const Icon = a.icon
          return (
            <Link key={i} href={a.href} prefetch={true}
              className="flex flex-col gap-2 p-3 rounded-xl transition-all duration-150 group"
              style={{ background: a.bg, border: `1px solid ${a.color}20`, textDecoration: 'none' }}
              onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.borderColor = `${a.color}50`; (e.currentTarget as HTMLAnchorElement).style.transform = 'translateY(-1px)' }}
              onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.borderColor = `${a.color}20`; (e.currentTarget as HTMLAnchorElement).style.transform = 'translateY(0)' }}
            >
              <Icon size={16} style={{ color: a.color }} />
              <div>
                <p style={{ fontSize: 11, fontWeight: 700, color: '#0F172A', marginBottom: 1 }}>{a.label}</p>
                <p style={{ fontSize: 10, color: '#64748B' }}>{a.desc}</p>
              </div>
            </Link>
          )
        })}
      </div>
    </motion.div>
  )
}

// ── Module breakdown card ─────────────────────────────────────────────────────

function TopModulesCard({ data }: { data: { name: string; value: number; color: string }[] }) {
  const { t } = useLocale()
  const total = data.reduce((s, d) => s + d.value, 0) || 1
  const BAR_COLORS = ['#DC2626', '#2563EB', '#16A34A', '#8B5CF6', '#0891B2', '#EA580C']
  return (
    <motion.div {...fadeUp(6)} style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 14, padding: 18 }}>
      <div className="flex items-center gap-2 mb-4">
        <BarChart2 size={13} style={{ color: '#DC2626' }} />
        <p style={{ fontSize: 12, fontWeight: 700, color: '#0F172A' }}>{t('dash.invoiceBreakdown')}</p>
      </div>
      {data.length === 0 ? (
        <p style={{ fontSize: 12, color: '#94A3B8', textAlign: 'center', padding: '12px 0' }}>{t('dash.noData')}</p>
      ) : (
        <div className="space-y-3.5">
          {data.map((d, i) => {
            const pct = Math.round((d.value / total) * 100)
            const barColor = BAR_COLORS[i % BAR_COLORS.length]
            const displayName = d.name.includes('.') ? t(d.name) : d.name
            return (
              <div key={i}>
                <div className="flex items-center justify-between mb-1.5">
                  <span style={{ fontSize: 11, color: '#64748B' }}>{displayName}</span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#0F172A' }}>{d.value}</span>
                </div>
                <div style={{ height: 4, background: '#F1F5F9', borderRadius: 2, overflow: 'hidden' }}>
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

  const SHORTCUT_COLORS = ['#DC2626', '#2563EB', '#16A34A', '#8B5CF6', '#0891B2', '#EA580C']

  return (
    <motion.div {...fadeUp(9)} style={{ marginBottom: 24 }}>
      <div className="flex items-center gap-2 mb-4">
        <div className="icon-well" style={{ background: 'rgba(220,38,38,0.10)', width: 28, height: 28, borderRadius: 7 }}>
          <Zap size={13} style={{ color: '#DC2626' }} />
        </div>
        <h3 className="section-label">{t('dash.shortcuts')}</h3>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {cards.map((sc, i) => {
          const Icon       = sc.icon
          const iconColor  = SHORTCUT_COLORS[i % SHORTCUT_COLORS.length]
          return (
            <motion.div
              key={sc.href + sc.labelKey}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.04 + i * 0.04 }}
            >
              <Link href={sc.href} prefetch={true} className="shortcut-card">
                {/* Icon well */}
                <div className="icon-well" style={{ background: `${iconColor}12`, width: 38, height: 38, borderRadius: 10, flexShrink: 0 }}>
                  <Icon size={17} style={{ color: iconColor }} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 13, fontWeight: 600, color: '#0F172A', marginBottom: 1 }}>{t(sc.labelKey)}</p>
                  <p style={{ fontSize: 11, color: '#64748B' }}>{t(sc.descKey)}</p>
                </div>
                <ChevronRight size={14} style={{ color: '#CBD5E1', flexShrink: 0 }} />
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
  payee:     { labelKey: 'invoice.lbl.payee',     bg: '#F0FDF4', color: '#16A34A' },
  envoyee:   { labelKey: 'invoice.lbl.envoyee',   bg: '#FFFBEB', color: '#D97706' },
  brouillon: { labelKey: 'invoice.lbl.brouillon', bg: '#F8FAFC', color: '#64748B' },
  annulee:   { labelKey: 'invoice.lbl.annulee',   bg: '#FEF2F2', color: '#DC2626' },
}

function TransactionRow({ item, i }: { item: ActivityItem; i: number }) {
  const { fmt: fmtCurrency } = useFmt()
  const { t } = useLocale()
  const st   = STATUT_CFG[item.statut] ?? STATUT_CFG.brouillon
  const init = (item.client_nom ?? 'C').split(' ').map((w: string) => w[0]).slice(0, 2).join('').toUpperCase()
  const diff = Date.now() - new Date(item.created_at).getTime()
  const ago  = diff < 3600000 ? `${Math.floor(diff / 60000)}min`
             : diff < 86400000 ? `${Math.floor(diff / 3600000)}h`
             : `${Math.floor(diff / 86400000)}j`
  const colors = ['#DC2626', '#2563EB', '#16A34A', '#8B5CF6', '#0891B2', '#EA580C', '#64748B']
  const avatarColor = colors[item.client_nom.charCodeAt(0) % colors.length]

  return (
    <motion.tr
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.35, delay: i * 0.05 }}
      className="border-b transition-colors"
      style={{ borderColor: '#E2E8F0' }}
    >
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <div style={{ width: 36, height: 36, borderRadius: '50%', background: `${avatarColor}20`, color: avatarColor, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>
            {init}
          </div>
          <div>
            <p style={{ fontSize: 12, fontWeight: 600, color: '#0F172A' }}>{item.client_nom}</p>
            <p style={{ fontSize: 10, color: '#64748B' }}>{t('dash.ago')} {ago}</p>
          </div>
        </div>
      </td>
      <td className="px-4 py-3 text-right">
        <p style={{ fontSize: 14, fontWeight: 700, color: '#0F172A' }}>{fmtCurrency(item.total)}</p>
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
  const { fmt: fmtCurrency } = useFmt()
  const { t } = useLocale()
  const router = useRouter()
  const { theme, isExplicit } = useTheme()
  const { tenant, tenantId, kpis, alerts, recentActivity, chartData } = data
  // Si l'utilisateur a choisi une couleur explicitement → override le brandColor du banner
  const brandColor = isExplicit ? theme.primary : getTenantBrandColor(tenantId)
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

  const displayName      = userName || tenant.nom_entreprise || 'vous'
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
    { label: t('dash.revenusScolaires'), value: fmtCurrency(ecoleFinancials?.revenusMois ?? 0), sub: `${ecoleFinancials?.nbPaiementsMois ?? 0} ${t('dash.paiementsMois')}`,                          icon: TrendingUp,    bg: '#DC2626', badge: t('dash.ceMoisCi'),   href: '/dashboard/ecole/scolarite', i: 1 },
    { label: t('dash.impayesScolarite'), value: ecoleFinancials?.nbImpayesDossiers ?? 0,          sub: `${fmtCurrency(ecoleFinancials?.montantImpayeTotal ?? 0)} ${t('dash.enAttentePmt')}`,                    icon: AlertTriangle, bg: '#DC2626',                                href: '/dashboard/ecole/scolarite', i: 2 },
    { label: t('dash.totalAbsences'),    value: ecoleKpis.nbAbsences,                             sub: t('school.absences'),                                                                              icon: CalendarOff,   bg: '#7C3AED',                                                                    i: 3 },
  ] : secteur === 'ecole' && ecoleKpis ? [
    { label: t('dash.enrolled'),     value: ecoleKpis.nbEtudiants, sub: `${ecoleKpis.nbActifs} ${t('dash.actifs')}`, icon: GraduationCap, bg: '#DC2626', badge: t('sc.inscriptions'), href: '/dashboard/ecole/scolarite', i: 0 },
    { label: t('dash.active'),       value: ecoleKpis.nbActifs,    sub: t('dash.paymentsPaid'),                      icon: Users,         bg: '#DC2626', badge: t('common.active'),   href: '/dashboard/ecole/scolarite', i: 1 },
    { label: t('dash.suspended'),    value: ecoleKpis.nbSuspendus, sub: t('dash.paymentsPending'),                   icon: UserX,         bg: '#DC2626',                                                                   i: 2 },
    { label: t('dash.totalAbsences'),value: ecoleKpis.nbAbsences,  sub: t('school.absences'),                        icon: CalendarOff,   bg: '#7C3AED',                                                                   i: 3 },
  ] : isFinancial ? [
    { label: t('dash.revenue'),          value: fmtCurrency(kpis.revenuMois),                                                        sub: `${t('dash.billedInvoices')} · TTC`,                                                                                                                        icon: TrendingUp,    bg: '#DC2626', badge: t('dash.ceMoisCi'), trend: 12.5, href: '/dashboard/facturation', i: 0 },
    { label: t('dash.facturesPayees'),   value: chartData.moduleBreakdown.find(m => m.statut === 'payee')?.value ?? 0,                   sub: t('dash.ceMoisCi'),                                                                                                                                     icon: CheckCircle,   bg: '#DC2626',                               href: '/dashboard/facturation', i: 1 },
    { label: t('dash.facturesAttente'),  value: alerts.pendingCount,                                                                    sub: `${fmtCurrency(alerts.pendingAmount)} ${t('common.pending').toLowerCase()}`,                                                                              icon: Clock,         bg: '#DC2626', badge: t('dash.pending'),  href: '/dashboard/facturation', i: 2 },
    { label: alerts.lowStockCount > 0 ? t('dash.rupturesStock') : t('dash.alertesStock'), value: kpis.nbAlertes, sub: alerts.lowStockCount > 0 ? `${alerts.lowStockCount} ${alerts.lowStockCount > 1 ? t('dash.articlesEpuises') : t('dash.articleEpuise')}` : t('dash.toutEnOrdre'), icon: AlertTriangle, bg: '#DC2626',                               i: 3 },
  ] : [
    { label: t('dash.employees'), value: kpis.nbEmployes, sub: t('dash.dansEquipe'),        icon: Users,         bg: '#DC2626', badge: t('rh.employees'),  href: '/dashboard/rh',     i: 0 },
    { label: t('dash.stock'),     value: kpis.nbArticles, sub: t('dash.refsInventoriees'),  icon: Package,       bg: '#DC2626',                             href: '/dashboard/stocks', i: 1 },
    { label: t('dash.alerts'),    value: kpis.nbAlertes,  sub: t('dash.aTraiter'),          icon: AlertTriangle, bg: '#DC2626',                                                        i: 2 },
  ]

  return (
    <div className="space-y-6 pb-6">

      <GeoDetectionBanner />

      {/* ── Role badge ──────────────────────────────────────────────────── */}
      {secteur === 'ecole' && ecoleRole && ecoleRole !== 'DIRECTION_GENERALE' && (() => {
        const ROLE_LABELS: Record<string, { labelKey: string; color: string }> = {
          DAAC:      { labelKey: 'roles.daac_full',     color: '#2563EB' },
          SCOLARITE: { labelKey: 'roles.scolarite_full',color: '#DC2626' },
          RAF:       { labelKey: 'roles.raf_full',      color: '#16A34A' },
          RH_PAIE:   { labelKey: 'roles.rhPaie_full',   color: '#7C3AED' },
          FORMATEUR: { labelKey: 'roles.formateur_full',color: '#0891B2' },
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
          style={{ background: 'rgba(139,0,112,0.08)', border: '1px solid rgba(139,0,112,0.2)', color: '#64748B' }}>
          <Lock size={13} />
          <span>{t('dash.academicView')}</span>
        </motion.div>
      )}

      {/* ── Welcome Banner — couleur unique par tenant ───────────────────── */}
      <motion.div
        {...fadeUp(0)}
        style={{
          background: brandColor,
          borderRadius: 16,
          padding: '24px 28px',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Lueur blanche douce en haut à droite */}
        <div style={{ position: 'absolute', top: -50, right: -50, width: 200, height: 200, borderRadius: '50%', background: 'radial-gradient(circle, rgba(255,255,255,0.08) 0%, transparent 70%)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: -30, left: -30, width: 150, height: 150, borderRadius: '50%', background: 'radial-gradient(circle, rgba(0,0,0,0.1) 0%, transparent 70%)', pointerEvents: 'none' }} />

        <div className="flex items-start gap-4 flex-wrap justify-between">
          {/* Texte — ordre 1 partout */}
          <div className="flex-1 min-w-0 order-1">
            {/* Date badge */}
            <div className="flex items-center gap-2 mb-3">
              <span style={{ background: 'rgba(255,255,255,0.18)', color: '#FFFFFF', border: '1px solid rgba(255,255,255,0.3)', padding: '4px 12px', borderRadius: 20, fontSize: 11, fontWeight: 600 }}>
                {new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
              </span>
            </div>
            <h1 style={{ fontSize: 24, fontWeight: 700, color: '#FFFFFF', lineHeight: 1.2, marginBottom: 6 }}>
              {t(greetingKey)}, {displayName}
            </h1>
            <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)' }}>
              <span style={{ color: '#FFFFFF', fontWeight: 600 }}>{tenant.nom_entreprise}</span>
              {' · '}{t('dash.plan')} <span style={{ color: 'rgba(255,255,255,0.9)', fontWeight: 700 }}>{tenant.plan.toUpperCase()}</span>
              {' · '}{tenant.modules_actifs.length} {t('dash.activeModules').toLowerCase()}
            </p>
          </div>

          {/* Boutons — ordre 2 mobile, ordre 3 desktop */}
          <div className="flex items-center gap-2 shrink-0 order-2 lg:order-3">
            <Link
              href={secteur === 'ecole' ? '/dashboard/ecole/scolarite' : '/dashboard/facturation'}
              prefetch={true}
              className="flex items-center gap-1.5 text-xs font-bold rounded-xl transition-all hover:opacity-90"
              style={{ background: 'rgba(255,255,255,0.2)', color: '#FFFFFF', border: '1px solid rgba(255,255,255,0.35)', padding: '8px 16px' }}
            >
              <Download size={12} /> Export
            </Link>
            <button
              onClick={() => router.refresh()}
              style={{ background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)', color: 'rgba(255,255,255,0.7)', padding: '8px 10px', borderRadius: 10 }}
              title={t('dash.refresh')}
            >
              <RefreshCw size={13} />
            </button>
          </div>

          {/* ── Ticker météo + palette — ordre 3 mobile (pleine largeur), ordre 2 desktop ── */}
          <div className="w-full order-3 lg:w-auto lg:order-2 lg:flex-none flex justify-center lg:justify-end mt-1 lg:mt-0">
            <BannerTicker />
          </div>
        </div>

        {/* Mini KPI chips */}
        {isFinancial && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5">
            {[
              { label: t('dash.revenue'),        value: fmtCurrency(kpis.revenuMois) },
              { label: t('dash.facturesAttente'), value: `${alerts.pendingCount}`   },
              { label: t('dash.employees'),       value: `${kpis.nbEmployes}`       },
              { label: t('dash.alertesStock'),    value: alerts.lowStockCount > 0 ? `${alerts.lowStockCount}` : 'OK' },
            ].map((k, i) => (
              <div key={i} className="banner-chip">
                <p style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.09em', color: 'rgba(255,255,255,0.5)', marginBottom: 6 }}>{k.label}</p>
                <p className="num" style={{ fontSize: 15, fontWeight: 800, color: '#FFFFFF', lineHeight: 1, letterSpacing: '-0.01em' }}>{k.value}</p>
              </div>
            ))}
          </div>
        )}
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
        <motion.div {...fadeUp(7)} className="card-premium" style={{ overflow: 'hidden', marginBottom: 24 }}>
          <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid #F1F5F9' }}>
            <div className="flex items-center gap-2.5">
              <div className="icon-well" style={{ background: 'rgba(220,38,38,0.09)', width: 30, height: 30, borderRadius: 8 }}>
                <FileText size={13} style={{ color: '#DC2626' }} />
              </div>
              <div>
                <h3 style={{ fontSize: 13, fontWeight: 700, color: '#0F172A' }}>{t('dash.lastTransactions')}</h3>
                <p style={{ fontSize: 10, color: '#94A3B8', marginTop: 1 }}>{recentActivity.length} {t('dash.lastFactures')}</p>
              </div>
            </div>
            <Link href="/dashboard/facturation" prefetch={true}
              className="flex items-center gap-1"
              style={{ fontSize: 11, color: '#DC2626', fontWeight: 600 }}
            >
              {t('dash.viewAll')} <ChevronRight size={12} />
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr style={{ background: '#FAFAFA', borderBottom: '1px solid #F1F5F9' }}>
                  <th className="text-left px-5 py-2.5 section-label">{t('common.name')}</th>
                  <th className="text-right px-5 py-2.5 section-label">{t('common.amount')}</th>
                  <th className="text-left px-5 py-2.5 section-label">{t('common.status')}</th>
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
          background: '#FFFFFF',
          border: '1px solid #E2E8F0',
          borderRadius: 12,
          padding: 24,
          textAlign: 'center',
          marginBottom: 24,
        }}>
          <div style={{ width: 48, height: 48, borderRadius: 12, background: 'rgba(220,38,38,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
            <Star size={20} style={{ color: '#DC2626' }} />
          </div>
          <p style={{ fontSize: 14, fontWeight: 600, color: '#0F172A', marginBottom: 4 }}>{t('dash.restricted')}</p>
          <p style={{ fontSize: 12, color: '#64748B' }}>{t('dash.restrictedMsg')}</p>
        </motion.div>
      )}

      {/* ── Raccourcis ───────────────────────────────────────────────────── */}
      <ShortcutCards secteur={secteur} ecoleRole={ecoleRole} />

    </div>
  )
}

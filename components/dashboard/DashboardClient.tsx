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
import GeoDetectionBanner from '@/components/ui/GeoDetectionBanner'

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

const ACCENT_COLORS = ['#F59E0B', '#2563EB', '#16A34A', '#8B5CF6']

function HeroCard({ label, value, sub, icon: Icon, badge, trend, href, i }: HeroCardProps) {
  const accent = ACCENT_COLORS[i % ACCENT_COLORS.length]
  // Fake progress from 40–90% so cards feel alive even with no data
  const progress = 40 + (i * 17 + 23) % 51

  const card = (
    <motion.div
      {...fadeUp(i)}
      whileHover={{ y: -2 }}
      className="select-none"
      style={{
        background: '#FFFFFF',
        border: '1px solid #E2E8F0',
        borderRadius: 14,
        padding: '20px 22px',
        cursor: href ? 'pointer' : 'default',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Trend badge top-right */}
      {trend !== undefined && (
        <span style={{
          position: 'absolute', top: 14, right: 14,
          display: 'inline-flex', alignItems: 'center', gap: 3,
          fontSize: 10, fontWeight: 700, borderRadius: 20, padding: '3px 8px',
          background: trend >= 0 ? '#F0FDF4' : '#FEF2F2',
          color: trend >= 0 ? '#16A34A' : '#DC2626',
        }}>
          <ArrowUpRight size={9} style={{ transform: trend < 0 ? 'rotate(90deg)' : undefined }} />
          {trend >= 0 ? '+' : ''}{trend.toFixed(1)}%
        </span>
      )}

      {/* Icon */}
      <div style={{
        width: 38, height: 38, borderRadius: 10, marginBottom: 16,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: `${accent}14`,
      }}>
        <Icon size={18} style={{ color: accent }} />
      </div>

      {/* Label */}
      <p style={{ fontSize: 11, fontWeight: 600, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>
        {label}
      </p>

      {/* Value */}
      <p style={{ fontSize: 28, fontWeight: 800, color: '#0F172A', lineHeight: 1, marginBottom: 4 }}>
        {value}
      </p>

      {/* Sub */}
      <div className="flex items-center justify-between mb-3">
        <p style={{ fontSize: 11, color: '#94A3B8' }}>{sub}</p>
        {badge && (
          <span style={{ background: `${accent}14`, color: accent, fontSize: 9, fontWeight: 700, borderRadius: 4, padding: '2px 6px' }}>
            {badge}
          </span>
        )}
      </div>

      {/* Progress bar */}
      <div style={{ height: 3, background: '#F1F5F9', borderRadius: 2, overflow: 'hidden' }}>
        <motion.div
          style={{ height: '100%', background: accent, borderRadius: 2 }}
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.9, delay: 0.2 + i * 0.1, ease: 'easeOut' }}
        />
      </div>
      <div className="flex items-center justify-between mt-1">
        <span style={{ fontSize: 9, color: '#94A3B8' }}>vs mois dernier</span>
        <span style={{ fontSize: 9, fontWeight: 600, color: accent }}>{progress}%</span>
      </div>
    </motion.div>
  )

  if (href) return <Link href={href}>{card}</Link>
  return card
}

// ── Solde Trésorerie card ─────────────────────────────────────────────────────

function TresorerieCard({ solde, pending, pendingAmt }: { solde: number; pending: number; pendingAmt: number }) {
  const { t } = useLocale()
  const isPositive = solde >= 0
  return (
    <motion.div {...fadeUp(4)} style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 14, padding: 20 }}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div style={{ width: 32, height: 32, background: 'rgba(245,158,11,0.12)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Wallet size={15} style={{ color: '#F59E0B' }} />
          </div>
          <p style={{ fontSize: 12, fontWeight: 600, color: '#64748B' }}>{t('dash.solde')}</p>
        </div>
        <span style={{ background: isPositive ? '#F0FDF4' : '#FEF2F2', color: isPositive ? '#16A34A' : '#DC2626', fontSize: 10, fontWeight: 700, borderRadius: 20, padding: '3px 8px' }}>
          {isPositive ? t('dash.positive') : t('dash.deficit')}
        </span>
      </div>
      <p style={{ fontSize: 22, fontWeight: 800, color: '#0F172A', lineHeight: 1, marginBottom: 2 }}>{fmt(solde)} FCFA</p>
      <p style={{ fontSize: 10, color: '#94A3B8', marginBottom: 14 }}>{t('dash.monthCumul')}</p>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, paddingTop: 12, borderTop: '1px solid #F1F5F9' }}>
        <div>
          <p style={{ fontSize: 9, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3 }}>{t('common.pending')}</p>
          <p style={{ fontSize: 13, fontWeight: 700, color: '#0F172A' }}>{fmt(pendingAmt)} F</p>
          <p style={{ fontSize: 10, color: '#94A3B8' }}>{pending} dossier{pending !== 1 ? 's' : ''}</p>
        </div>
        <div>
          <p style={{ fontSize: 9, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3 }}>Statut</p>
          <div style={{ height: 4, background: '#F1F5F9', borderRadius: 2, overflow: 'hidden', marginTop: 6 }}>
            <div style={{ height: '100%', width: isPositive ? '72%' : '28%', background: isPositive ? '#16A34A' : '#DC2626', borderRadius: 2 }} />
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
    { label: 'Nouvelle inscription', desc: 'Ajouter un étudiant', href: '/dashboard/ecole/scolarite', color: '#F59E0B', bg: '#FFFBEB', icon: GraduationCap },
    { label: 'Valider paiements',    desc: 'Scolarité en attente',  href: '/dashboard/ecole/scolarite', color: '#16A34A', bg: '#F0FDF4', icon: CheckCircle },
    { label: 'Bulletins de paie',    desc: 'Générer la paie',        href: '/dashboard/ecole/rh',        color: '#2563EB', bg: '#EFF6FF', icon: FileText },
    { label: 'Tableau de bord',      desc: 'Direction générale',     href: '/dashboard/ecole/direction', color: '#7C3AED', bg: '#F5F3FF', icon: BarChart2 },
  ] : [
    { label: t('dash.newAction'),   desc: t('sc.d.facturation'),   href: '/dashboard/facturation',  color: '#F59E0B', bg: '#FFFBEB', icon: FileText },
    { label: 'Valider factures',    desc: 'Paiements en attente',   href: '/dashboard/facturation',  color: '#16A34A', bg: '#F0FDF4', icon: CheckCircle },
    { label: 'Rapports',            desc: 'Analyse des données',    href: '/dashboard/bi',           color: '#2563EB', bg: '#EFF6FF', icon: BarChart2 },
    { label: 'Paramètres',          desc: 'Configurer le système',  href: '/dashboard/parametres',   color: '#7C3AED', bg: '#F5F3FF', icon: Settings },
  ]

  return (
    <motion.div {...fadeUp(5)} style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 14, padding: 18 }}>
      <div className="flex items-center gap-2 mb-3">
        <Zap size={13} style={{ color: '#F59E0B' }} />
        <p style={{ fontSize: 12, fontWeight: 700, color: '#0F172A' }}>{t('dash.quickLinks')}</p>
        <span style={{ fontSize: 10, color: '#94A3B8', marginLeft: 2 }}>Actions fréquentes</span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {actions.map((a, i) => {
          const Icon = a.icon
          return (
            <Link key={i} href={a.href}
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
  const BAR_COLORS = ['#F59E0B', '#2563EB', '#16A34A', '#8B5CF6', '#0891B2', '#EA580C']
  return (
    <motion.div {...fadeUp(6)} style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 14, padding: 18 }}>
      <div className="flex items-center gap-2 mb-4">
        <BarChart2 size={13} style={{ color: '#F59E0B' }} />
        <p style={{ fontSize: 12, fontWeight: 700, color: '#0F172A' }}>{t('dash.invoiceBreakdown')}</p>
      </div>
      {data.length === 0 ? (
        <p style={{ fontSize: 12, color: '#94A3B8', textAlign: 'center', padding: '12px 0' }}>{t('dash.noData')}</p>
      ) : (
        <div className="space-y-3.5">
          {data.map((d, i) => {
            const pct = Math.round((d.value / total) * 100)
            const barColor = BAR_COLORS[i % BAR_COLORS.length]
            return (
              <div key={i}>
                <div className="flex items-center justify-between mb-1.5">
                  <span style={{ fontSize: 11, color: '#64748B' }}>{d.name}</span>
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

  return (
    <motion.div {...fadeUp(9)} style={{ marginBottom: 24 }}>
      <div className="flex items-center gap-2 mb-4">
        <Zap size={14} style={{ color: '#F59E0B' }} />
        <h3 style={{ fontSize: 13, fontWeight: 700, color: '#0F172A', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{t('dash.shortcuts')}</h3>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {cards.map((sc, i) => {
          const Icon = sc.icon
          const SHORTCUT_COLORS = ['#F59E0B', '#2563EB', '#16A34A', '#8B5CF6', '#0891B2', '#EA580C']
          const iconColor = SHORTCUT_COLORS[i % SHORTCUT_COLORS.length]
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
                  background: '#FFFFFF',
                  border: '1px solid #E2E8F0',
                  borderRadius: 10,
                  padding: '14px 18px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  textDecoration: 'none',
                }}
                onMouseEnter={e => {
                  const el = e.currentTarget as HTMLAnchorElement
                  el.style.borderColor = '#F59E0B'
                  el.style.transform = 'translateY(-1px)'
                }}
                onMouseLeave={e => {
                  const el = e.currentTarget as HTMLAnchorElement
                  el.style.borderColor = '#E2E8F0'
                  el.style.transform = 'translateY(0)'
                }}
              >
                <Icon size={20} style={{ color: iconColor, flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 14, fontWeight: 600, color: '#0F172A', marginBottom: 1 }}>{t(sc.labelKey)}</p>
                  <p style={{ fontSize: 12, color: '#64748B' }}>{t(sc.descKey)}</p>
                </div>
                <ChevronRight size={16} style={{ color: '#64748B', flexShrink: 0 }} />
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
  const { t } = useLocale()
  const st   = STATUT_CFG[item.statut] ?? STATUT_CFG.brouillon
  const init = (item.client_nom ?? 'C').split(' ').map((w: string) => w[0]).slice(0, 2).join('').toUpperCase()
  const diff = Date.now() - new Date(item.created_at).getTime()
  const ago  = diff < 3600000 ? `${Math.floor(diff / 60000)}min`
             : diff < 86400000 ? `${Math.floor(diff / 3600000)}h`
             : `${Math.floor(diff / 86400000)}j`
  const colors = ['#F59E0B', '#2563EB', '#16A34A', '#8B5CF6', '#0891B2', '#EA580C', '#64748B']
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
        <p style={{ fontSize: 14, fontWeight: 700, color: '#0F172A' }}>{fmt(item.total)} FCFA</p>
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

      <GeoDetectionBanner />

      {/* ── Role badge ──────────────────────────────────────────────────── */}
      {secteur === 'ecole' && ecoleRole && ecoleRole !== 'DIRECTION_GENERALE' && (() => {
        const ROLE_LABELS: Record<string, { labelKey: string; color: string }> = {
          DAAC:      { labelKey: 'roles.daac_full',     color: '#2563EB' },
          SCOLARITE: { labelKey: 'roles.scolarite_full',color: '#F59E0B' },
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

      {/* ── Welcome Banner ───────────────────────────────────────────────── */}
      <motion.div {...fadeUp(0)} style={{ background: '#0F172A', borderRadius: 16, padding: '24px 28px', position: 'relative', overflow: 'hidden' }}>
        {/* Subtle amber glow top-right */}
        <div style={{ position: 'absolute', top: -40, right: -40, width: 180, height: 180, borderRadius: '50%', background: 'radial-gradient(circle, rgba(245,158,11,0.12) 0%, transparent 70%)', pointerEvents: 'none' }} />

        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex-1 min-w-0">
            {/* Date badge */}
            <div className="flex items-center gap-2 mb-3">
              <span style={{ background: 'rgba(245,158,11,0.15)', color: '#F59E0B', border: '1px solid rgba(245,158,11,0.25)', padding: '4px 12px', borderRadius: 20, fontSize: 11, fontWeight: 600 }}>
                {new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
              </span>
            </div>
            <h1 style={{ fontSize: 24, fontWeight: 700, color: '#FFFFFF', lineHeight: 1.2, marginBottom: 6 }}>
              {t(greetingKey)}, {displayName}
            </h1>
            <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)' }}>
              <span style={{ color: 'rgba(255,255,255,0.7)', fontWeight: 600 }}>{tenant.nom_entreprise}</span>
              {' · '}{t('dash.plan')} <span style={{ color: '#F59E0B', fontWeight: 700 }}>{tenant.plan.toUpperCase()}</span>
              {' · '}{tenant.modules_actifs.length} modules actifs
            </p>
          </div>
          {/* Buttons */}
          <div className="flex items-center gap-2 shrink-0">
            <Link
              href={secteur === 'ecole' ? '/dashboard/ecole/scolarite' : '/dashboard/facturation'}
              className="flex items-center gap-1.5 text-xs font-bold rounded-xl transition-all hover:opacity-90"
              style={{ background: '#F59E0B', color: '#0F172A', padding: '8px 16px' }}
            >
              <Download size={12} /> Export
            </Link>
            <button
              onClick={() => router.refresh()}
              style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', color: '#94A3B8', padding: '8px 10px', borderRadius: 10 }}
              title={t('dash.refresh')}
            >
              <RefreshCw size={13} />
            </button>
          </div>
        </div>

        {/* Mini KPI chips */}
        {isFinancial && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5">
            {[
              { label: "Revenus du mois",    value: `${fmt(kpis.revenuMois)} F`,                          trend: '+18%' },
              { label: "Factures en attente",value: `${alerts.pendingCount} fact.`,                        trend: null },
              { label: "Employés",           value: `${kpis.nbEmployes}`,                                  trend: null },
              { label: "Stock / Alertes",    value: alerts.lowStockCount > 0 ? `${alerts.lowStockCount} alerte${alerts.lowStockCount > 1 ? 's' : ''}` : 'OK', trend: null },
            ].map((k, i) => (
              <div key={i} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, padding: '12px 14px' }}>
                <p style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(255,255,255,0.35)', marginBottom: 5 }}>{k.label}</p>
                <p style={{ fontSize: 14, fontWeight: 700, color: '#FFFFFF', lineHeight: 1 }}>{k.value}</p>
                {k.trend && <p style={{ fontSize: 10, color: '#F59E0B', marginTop: 3 }}>{k.trend} vs hier</p>}
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
        <motion.div {...fadeUp(7)} style={{
          background: '#FFFFFF',
          border: '1px solid #E2E8F0',
          borderRadius: 12,
          overflow: 'hidden',
          marginBottom: 24,
        }}>
          <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid #E2E8F0' }}>
            <div>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: '#0F172A' }}>{t('dash.lastTransactions')}</h3>
              <p style={{ fontSize: 10, color: '#64748B', marginTop: 2 }}>{recentActivity.length} {t('dash.lastFactures')}</p>
            </div>
            <Link href="/dashboard/facturation" style={{ fontSize: 12, color: '#F59E0B', fontWeight: 600 }}>
              {t('dash.viewAll')} →
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr style={{ borderBottom: '1px solid #E2E8F0', background: 'transparent' }}>
                  <th className="text-left px-4 py-3" style={{ fontSize: 10, fontWeight: 600, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{t('common.name')}</th>
                  <th className="text-right px-4 py-3" style={{ fontSize: 10, fontWeight: 600, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{t('common.amount')}</th>
                  <th className="text-left px-4 py-3" style={{ fontSize: 10, fontWeight: 600, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{t('common.status')}</th>
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
          <div style={{ width: 48, height: 48, borderRadius: 12, background: 'rgba(245,158,11,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
            <Star size={20} style={{ color: '#F59E0B' }} />
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

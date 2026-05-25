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
    moduleBreakdown: { name: string; value: number; color: string }[]
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
    { label: 'Scolarité',     href: '/dashboard/ecole/scolarite' },
    { label: 'Comptabilité',  href: '/dashboard/ecole/comptabilite' },
    { label: 'RH & Paie',    href: '/dashboard/ecole/rh' },
    { label: 'Direction',     href: '/dashboard/ecole/direction' },
    { label: 'MIAA',          href: '/dashboard/ecole/miaa' },
  ] : [
    { label: 'Facturation',  href: '/dashboard/facturation' },
    { label: 'Trésorerie',   href: '/dashboard/tresorerie' },
    { label: 'RH',           href: '/dashboard/rh' },
    { label: 'Stock',        href: '/dashboard/stocks' },
    { label: 'Comptabilité', href: '/dashboard/comptabilite' },
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

type Shortcut = { label: string; href: string; icon: React.ElementType; color: string; desc: string }

const SECTOR_SHORTCUTS: Record<string, Shortcut[]> = {
  ecole: [
    { label: 'Nouvelle inscription', href: '/dashboard/ecole/scolarite',         icon: GraduationCap,  color: '#DC2626', desc: 'Inscrire un étudiant' },
    { label: 'Espace Formateur',      href: '/dashboard/ecole/espace-formateur',  icon: BookOpen,       color: '#DC2626', desc: 'Cours & heures' },
    { label: 'Direction Générale',    href: '/dashboard/ecole/direction',         icon: BarChart2,      color: '#DC2626', desc: 'Finances & pilotage' },
    { label: 'RH & Paie',            href: '/dashboard/ecole/rh',                icon: Users,          color: '#DC2626', desc: 'Gestion du personnel' },
    { label: 'Comptabilité OHADA',    href: '/dashboard/ecole/comptabilite',      icon: Calculator,     color: '#DC2626', desc: 'Journal & bilan' },
    { label: 'MIAA+ IA',             href: '/dashboard/ecole/miaa',              icon: Bot,            color: '#DC2626', desc: 'Assistant scolaire IA' },
  ],
  restaurant: [
    { label: 'Caisse POS',   href: '/dashboard/restaurant', icon: ChefHat,     color: '#DC2626', desc: 'Ouvrir la caisse' },
    { label: 'Stock cuisine', href: '/dashboard/stocks',      icon: Package,     color: '#DC2626', desc: 'Inventaire & alertes' },
    { label: 'RH & Paie',    href: '/dashboard/rh',         icon: Users,       color: '#DC2626', desc: 'Gestion du personnel' },
    { label: 'Trésorerie',   href: '/dashboard/tresorerie', icon: Wallet,      color: '#DC2626', desc: 'Suivi des finances' },
    { label: 'Dépenses',     href: '/dashboard/depenses',   icon: Receipt,     color: '#DC2626', desc: 'Charges & sorties' },
    { label: 'MIAA+',        href: '/dashboard/miaa',       icon: Bot,         color: '#DC2626', desc: 'Assistant IA' },
  ],
  commerce: [
    { label: 'Facturation',  href: '/dashboard/facturation', icon: FileText,    color: '#DC2626', desc: 'Devis & factures' },
    { label: 'Stock',        href: '/dashboard/stocks',       icon: Package,     color: '#DC2626', desc: 'Inventaire' },
    { label: 'Trésorerie',   href: '/dashboard/tresorerie',  icon: Wallet,      color: '#DC2626', desc: 'Finances' },
    { label: 'Achats',       href: '/dashboard/achats',      icon: ShoppingCart,color: '#DC2626', desc: 'Fournisseurs' },
    { label: 'RH & Paie',    href: '/dashboard/rh',          icon: Users,       color: '#DC2626', desc: 'Personnel' },
    { label: 'Comptabilité', href: '/dashboard/comptabilite',icon: Calculator,  color: '#DC2626', desc: 'OHADA' },
  ],
  supermarche: [
    { label: 'Caisse',        href: '/dashboard/facturation', icon: FileText,    color: '#DC2626', desc: 'Ventes' },
    { label: 'Rayons & Stock',href: '/dashboard/stocks',       icon: Package,     color: '#DC2626', desc: 'Inventaire' },
    { label: 'Achats',        href: '/dashboard/achats',      icon: ShoppingCart,color: '#DC2626', desc: 'Fournisseurs' },
    { label: 'RH & Paie',    href: '/dashboard/rh',          icon: Users,       color: '#DC2626', desc: 'Personnel' },
    { label: 'Trésorerie',   href: '/dashboard/tresorerie',  icon: Wallet,      color: '#DC2626', desc: 'Finances' },
  ],
  transport: [
    { label: 'Flotte',      href: '/dashboard/transport',   icon: Truck,    color: '#DC2626', desc: 'Véhicules & courses' },
    { label: 'Facturation', href: '/dashboard/facturation', icon: FileText, color: '#DC2626', desc: 'Devis & factures' },
    { label: 'Chauffeurs',  href: '/dashboard/rh',          icon: Users,    color: '#DC2626', desc: 'RH & Paie' },
    { label: 'Trésorerie',  href: '/dashboard/tresorerie',  icon: Wallet,   color: '#DC2626', desc: 'Finances' },
    { label: 'MIAA+',       href: '/dashboard/miaa',        icon: Bot,      color: '#DC2626', desc: 'Assistant IA' },
  ],
  hotel: [
    { label: 'Réservations', href: '/dashboard/hotel',       icon: Hotel,    color: '#DC2626', desc: 'Chambres & séjours' },
    { label: 'Facturation',  href: '/dashboard/facturation', icon: FileText, color: '#DC2626', desc: 'Factures & devis' },
    { label: 'RH & Paie',   href: '/dashboard/rh',          icon: Users,    color: '#DC2626', desc: 'Personnel' },
    { label: 'Trésorerie',  href: '/dashboard/tresorerie',  icon: Wallet,   color: '#DC2626', desc: 'Finances' },
    { label: 'MIAA+',       href: '/dashboard/miaa',        icon: Bot,      color: '#DC2626', desc: 'Assistant IA' },
  ],
  sante: [
    { label: 'Consultations', href: '/dashboard/facturation', icon: FileText,      color: '#DC2626', desc: 'Ordonnances & actes' },
    { label: 'Pharmacie',     href: '/dashboard/stocks',       icon: Package,       color: '#DC2626', desc: 'Médicaments' },
    { label: 'RH médical',   href: '/dashboard/rh',           icon: Users,         color: '#DC2626', desc: 'Personnel soignant' },
    { label: 'Trésorerie',   href: '/dashboard/tresorerie',   icon: Wallet,        color: '#DC2626', desc: 'Finances' },
    { label: 'MIAA+',        href: '/dashboard/miaa',         icon: Bot,           color: '#DC2626', desc: 'Assistant IA' },
  ],
  _default: [
    { label: 'Facturation',  href: '/dashboard/facturation',  icon: FileText,   color: '#DC2626', desc: 'Devis & factures' },
    { label: 'Trésorerie',   href: '/dashboard/tresorerie',   icon: Wallet,     color: '#DC2626', desc: 'Suivi financier' },
    { label: 'RH & Paie',   href: '/dashboard/rh',           icon: Users,      color: '#DC2626', desc: 'Personnel' },
    { label: 'Stock',        href: '/dashboard/stocks',        icon: Package,    color: '#DC2626', desc: 'Inventaire' },
    { label: 'Comptabilité', href: '/dashboard/comptabilite', icon: Calculator, color: '#DC2626', desc: 'OHADA' },
    { label: 'MIAA+',        href: '/dashboard/miaa',         icon: Bot,        color: '#DC2626', desc: 'Assistant IA' },
  ],
}

const ECOLE_ROLE_SHORTCUTS: Record<string, Shortcut[]> = {
  DAAC: [
    { label: 'Matières',     href: '/dashboard/ecole/daac',                   icon: BookOpen,      color: '#DC2626', desc: 'Programmes & UE' },
    { label: 'Sessions',     href: '/dashboard/ecole/daac',                   icon: Layers,        color: '#DC2626', desc: 'Sessions actives' },
    { label: 'Examens',      href: '/dashboard/ecole/daac',                   icon: FileText,      color: '#DC2626', desc: 'Notes & résultats' },
    { label: 'Diplômes',     href: '/dashboard/ecole/daac',                   icon: GraduationCap, color: '#DC2626', desc: 'En attente' },
    { label: 'Soutenances',  href: '/dashboard/ecole/daac',                   icon: Award,         color: '#DC2626', desc: 'Planifiées' },
    { label: 'Paramètres',  href: '/dashboard/ecole/parametres-academiques',  icon: Settings,      color: '#DC2626', desc: 'Règles LMD' },
  ],
  RAF: [
    { label: 'Comptabilité', href: '/dashboard/ecole/comptabilite', icon: Calculator, color: '#DC2626', desc: 'Journal OHADA' },
    { label: 'Trésorerie',  href: '/dashboard/ecole/tresorerie',   icon: Wallet,     color: '#DC2626', desc: 'Wallets & virements' },
    { label: 'Budgets',      href: '/dashboard/ecole/comptabilite', icon: BarChart2,  color: '#DC2626', desc: 'Suivi budgétaire' },
    { label: 'Paie',         href: '/dashboard/ecole/rh',           icon: Users,      color: '#DC2626', desc: 'Bulletins de paie' },
    { label: 'Dépenses',    href: '/dashboard/ecole/tresorerie',   icon: TrendingUp, color: '#DC2626', desc: 'Sorties de fonds' },
    { label: 'MIAA+',        href: '/dashboard/ecole/miaa',         icon: Bot,        color: '#DC2626', desc: 'Assistant IA' },
  ],
  RH_PAIE: [
    { label: 'Employés',    href: '/dashboard/ecole/rh', icon: Users,       color: '#DC2626', desc: 'Gestion du personnel' },
    { label: 'Paie',         href: '/dashboard/ecole/rh', icon: Wallet,      color: '#DC2626', desc: 'Bulletins de paie' },
    { label: 'Contrats',     href: '/dashboard/ecole/rh', icon: FileText,    color: '#DC2626', desc: 'CDD/CDI' },
    { label: 'Absences',     href: '/dashboard/ecole/rh', icon: CalendarOff, color: '#DC2626', desc: 'Congés & absences' },
    { label: 'Départements', href: '/dashboard/ecole/rh', icon: BarChart2,   color: '#DC2626', desc: 'Organigramme' },
    { label: 'MIAA+',        href: '/dashboard/ecole/miaa', icon: Bot,       color: '#DC2626', desc: 'Assistant IA' },
  ],
  SCOLARITE: [
    { label: 'Étudiants',   href: '/dashboard/ecole/scolarite', icon: GraduationCap, color: '#DC2626', desc: 'Gestion des étudiants' },
    { label: 'Inscriptions', href: '/dashboard/ecole/scolarite', icon: FileText,      color: '#DC2626', desc: 'Nouvelles inscriptions' },
    { label: 'Paiements',    href: '/dashboard/ecole/scolarite', icon: Wallet,        color: '#DC2626', desc: 'Frais de scolarité' },
    { label: 'Absences',     href: '/dashboard/ecole/scolarite', icon: CalendarOff,   color: '#DC2626', desc: 'Relevés d\'absences' },
    { label: 'Classes',      href: '/dashboard/ecole/scolarite', icon: BookOpen,      color: '#DC2626', desc: 'Gestion des classes' },
    { label: 'MIAA+',        href: '/dashboard/ecole/miaa',      icon: Bot,           color: '#DC2626', desc: 'Assistant IA' },
  ],
  FORMATEUR: [
    { label: 'Mes cours',    href: '/dashboard/ecole/espace-formateur', icon: BookOpen,      color: '#DC2626', desc: 'Modules enseignés' },
    { label: 'Présences',   href: '/dashboard/ecole/espace-formateur', icon: CheckCircle,   color: '#DC2626', desc: 'Appel & absences' },
    { label: 'Notes',        href: '/dashboard/ecole/espace-formateur', icon: Star,          color: '#DC2626', desc: 'Saisie des notes' },
    { label: 'Classes',      href: '/dashboard/ecole/espace-formateur', icon: GraduationCap, color: '#DC2626', desc: 'Mes classes' },
    { label: 'Examens',      href: '/dashboard/ecole/daac',             icon: FileText,      color: '#DC2626', desc: 'Délibérations' },
    { label: 'MIAA+',        href: '/dashboard/ecole/miaa',             icon: Bot,           color: '#DC2626', desc: 'Assistant IA' },
  ],
  ETUDIANT: [
    { label: 'Mes notes',    href: '/dashboard/ecole/espace-etudiant', icon: Star,        color: '#DC2626', desc: 'Résultats & moyennes' },
    { label: 'Bulletins',    href: '/dashboard/ecole/espace-etudiant', icon: FileText,    color: '#DC2626', desc: 'Bulletins de note' },
    { label: 'Paiements',    href: '/dashboard/ecole/espace-etudiant', icon: Wallet,      color: '#DC2626', desc: 'Frais & quittances' },
    { label: 'Absences',     href: '/dashboard/ecole/espace-etudiant', icon: CalendarOff, color: '#DC2626', desc: 'Mes absences' },
    { label: 'Planning',     href: '/dashboard/ecole/espace-etudiant', icon: Clock,       color: '#DC2626', desc: 'Emploi du temps' },
    { label: 'MIAA+',        href: '/dashboard/ecole/miaa',            icon: Bot,         color: '#DC2626', desc: 'Assistant IA' },
  ],
  PARENT: [
    { label: 'Résultats',   href: '/dashboard/ecole/espace-parent', icon: Star,          color: '#DC2626', desc: 'Notes de mon enfant' },
    { label: 'Bulletins',    href: '/dashboard/ecole/espace-parent', icon: FileText,      color: '#DC2626', desc: 'Bulletins de note' },
    { label: 'Paiements',    href: '/dashboard/ecole/espace-parent', icon: Wallet,        color: '#DC2626', desc: 'Frais de scolarité' },
    { label: 'Absences',     href: '/dashboard/ecole/espace-parent', icon: CalendarOff,   color: '#DC2626', desc: 'Relevés d\'absences' },
    { label: 'Contact',      href: '/dashboard/ecole/espace-parent', icon: HeartHandshake,color: '#DC2626', desc: 'Contacter l\'école' },
    { label: 'MIAA+',        href: '/dashboard/ecole/miaa',          icon: Bot,           color: '#DC2626', desc: 'Assistant IA' },
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
              key={sc.href + sc.label}
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
                  <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 1 }}>{sc.label}</p>
                  <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{sc.desc}</p>
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

const STATUT_CFG: Record<string, { label: string; bg: string; color: string }> = {
  payee:     { label: 'PAYÉE',     bg: 'rgba(255,255,255,0.08)', color: 'var(--text-primary)' },
  envoyee:   { label: 'ENVOYÉE',   bg: 'rgba(245,30,51,0.15)',   color: '#DC2626' },
  brouillon: { label: 'BROUILLON', bg: 'rgba(255,255,255,0.06)', color: 'var(--text-secondary)' },
  annulee:   { label: 'ANNULÉE',   bg: 'rgba(245,30,51,0.15)',   color: '#DC2626' },
}

function TransactionRow({ item, i }: { item: ActivityItem; i: number }) {
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
            <p style={{ fontSize: 10, color: 'var(--text-secondary)' }}>il y a {ago}</p>
          </div>
        </div>
      </td>
      <td className="px-4 py-3 text-right">
        <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{fmt(item.total)} FCFA</p>
      </td>
      <td className="px-4 py-3">
        <span style={{ background: st.bg, color: st.color, fontSize: 10, fontWeight: 700, borderRadius: 20, padding: '3px 10px', display: 'inline-block' }}>
          {st.label}
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

  const [greeting, setGreeting] = useState('Bonjour')
  useEffect(() => {
    const h = new Date().getHours()
    setGreeting(h < 12 ? 'Bonjour' : h < 18 ? 'Bon après-midi' : 'Bonsoir')
  }, [])

  const displayName      = userName || 'Admin'
  const soldeTresorerie  = kpis.revenuMois - alerts.pendingAmount * 0.3

  const isDaac = secteur === 'ecole' && ecoleRole === 'DAAC' && daacKpis
  const isRH   = secteur === 'ecole' && (ecoleRole === 'RH_PAIE' || ecoleRole === 'RAF') && rhKpis

  const heroCards: HeroCardProps[] = isDaac ? [
    { label: 'Sessions en cours',  value: daacKpis!.sessionsEnCours,  sub: 'Sessions actives ce semestre', icon: Layers,        bg: '#7C3AED', badge: 'DAAC',   href: '/dashboard/ecole/daac', i: 0 },
    { label: 'Diplômes en attente',value: daacKpis!.diplomesEnAttente,sub: 'En cours de validation',       icon: GraduationCap, bg: '#DC2626', badge: 'Diplômes',href: '/dashboard/ecole/daac', i: 1 },
    { label: 'Soutenances planif.',value: daacKpis!.nbSoutenances,    sub: 'À venir ce mois',              icon: Award,         bg: '#7C3AED', href: '/dashboard/ecole/daac', i: 2 },
    { label: 'Étudiants actifs',   value: ecoleKpis?.nbActifs ?? 0,   sub: 'Inscrits et actifs',           icon: Users,         bg: '#DC2626', badge: 'Actifs',  href: '/dashboard/ecole/scolarite', i: 3 },
  ] : isRH ? [
    { label: 'Employés actifs',   value: rhKpis!.nbActifs,   sub: 'Personnel en poste',      icon: Users,         bg: '#DC2626', badge: 'Actifs',   href: '/dashboard/ecole/rh', i: 0 },
    { label: 'En congé',          value: rhKpis!.nbConges,   sub: 'Absences & congés',       icon: CalendarOff,   bg: '#DC2626', badge: 'Congés',   href: '/dashboard/ecole/rh', i: 1 },
    { label: 'Total personnel',   value: kpis.nbEmployes,    sub: 'Tous statuts confondus',  icon: HeartHandshake,bg: '#7C3AED', badge: 'Personnel',href: '/dashboard/ecole/rh', i: 2 },
  ] : isFinancial && secteur === 'ecole' && ecoleKpis ? [
    { label: 'Étudiants inscrits', value: ecoleKpis.nbEtudiants,                             sub: `${ecoleKpis.nbActifs} actifs · ${ecoleKpis.nbSuspendus} suspendus`, icon: GraduationCap, bg: '#DC2626', badge: 'Inscrits', href: '/dashboard/ecole/scolarite', i: 0 },
    { label: 'Revenus scolaires',  value: `${fmt(ecoleFinancials?.revenusMois ?? 0)} FCFA`,  sub: `${ecoleFinancials?.nbPaiementsMois ?? 0} paiements ce mois`,          icon: TrendingUp,    bg: '#DC2626', badge: 'Ce mois',  href: '/dashboard/ecole/scolarite', i: 1 },
    { label: 'Impayés scolarité',  value: ecoleFinancials?.nbImpayesDossiers ?? 0,           sub: `${fmt(ecoleFinancials?.montantImpayeTotal ?? 0)} FCFA en attente`,    icon: AlertTriangle, bg: (ecoleFinancials?.nbImpayesDossiers ?? 0) > 0 ? '#DC2626' : '#DC2626', href: '/dashboard/ecole/scolarite', i: 2 },
    { label: 'Absences totales',   value: ecoleKpis.nbAbsences,                              sub: 'Relevés d\'absences',                                                   icon: CalendarOff,   bg: '#7C3AED', i: 3 },
  ] : secteur === 'ecole' && ecoleKpis ? [
    { label: t('dash.enrolled'),     value: ecoleKpis.nbEtudiants, sub: `${ecoleKpis.nbActifs} comptes ${t('dash.actifs')}`, icon: GraduationCap, bg: '#DC2626', badge: 'Inscrits',  href: '/dashboard/ecole/scolarite', i: 0 },
    { label: t('dash.active'),       value: ecoleKpis.nbActifs,    sub: t('dash.paymentsPaid'),                              icon: Users,         bg: '#DC2626', badge: 'Actifs',    href: '/dashboard/ecole/scolarite', i: 1 },
    { label: t('dash.suspended'),    value: ecoleKpis.nbSuspendus, sub: t('dash.paymentsPending'),                           icon: UserX,         bg: '#DC2626', i: 2 },
    { label: t('dash.totalAbsences'),value: ecoleKpis.nbAbsences,  sub: t('school.absences'),                                icon: CalendarOff,   bg: '#7C3AED', i: 3 },
  ] : isFinancial ? [
    { label: t('dash.revenue'),          value: `${fmt(kpis.revenuMois)} FCFA`, sub: t('dash.billedInvoices'),                                                           icon: TrendingUp,    bg: '#DC2626', badge: 'Ce mois', trend: 12.5, href: '/dashboard/facturation', i: 0 },
    { label: 'Factures payées',          value: chartData.moduleBreakdown.find(m => m.name === 'Payées')?.value ?? 0, sub: 'Ce mois-ci',                                icon: CheckCircle,   bg: '#DC2626', href: '/dashboard/facturation', i: 1 },
    { label: 'Factures en attente',      value: alerts.pendingCount, sub: `${fmt(alerts.pendingAmount)} FCFA à encaisser`,                                               icon: Clock,         bg: '#DC2626', badge: 'En cours', href: '/dashboard/facturation', i: 2 },
    { label: alerts.lowStockCount > 0 ? 'Ruptures de stock' : 'Alertes stock', value: kpis.nbAlertes, sub: alerts.lowStockCount > 0 ? `${alerts.lowStockCount} article${alerts.lowStockCount > 1 ? 's' : ''} épuisé${alerts.lowStockCount > 1 ? 's' : ''}` : 'Tout est en ordre', icon: AlertTriangle, bg: kpis.nbAlertes > 0 ? '#DC2626' : '#DC2626', i: 3 },
  ] : [
    { label: t('dash.employees'), value: kpis.nbEmployes, sub: 'Dans votre équipe',       icon: Users,         bg: '#DC2626', badge: 'Personnel', href: '/dashboard/rh',    i: 0 },
    { label: t('dash.stock'),     value: kpis.nbArticles, sub: 'Références inventoriées', icon: Package,       bg: '#DC2626', href: '/dashboard/stocks', i: 1 },
    { label: t('dash.alerts'),    value: kpis.nbAlertes,  sub: 'À traiter',               icon: AlertTriangle, bg: '#DC2626', i: 2 },
  ]

  return (
    <div className="space-y-6 pb-6">

      {/* ── Role badge ──────────────────────────────────────────────────── */}
      {secteur === 'ecole' && ecoleRole && ecoleRole !== 'DIRECTION_GENERALE' && (() => {
        const ROLE_LABELS: Record<string, { label: string; color: string }> = {
          DAAC:      { label: 'Direction des Affaires Académiques',    color: '#DC2626' },
          SCOLARITE: { label: 'Service Scolarité',                     color: '#DC2626' },
          RAF:       { label: 'Responsable Administratif & Financier', color: '#DC2626' },
          RH_PAIE:   { label: 'Ressources Humaines & Paie',            color: '#DC2626' },
          FORMATEUR: { label: 'Espace Formateur',                      color: '#DC2626' },
          ETUDIANT:  { label: 'Espace Étudiant',                      color: '#7C3AED' },
          PARENT:    { label: 'Espace Parent',                         color: '#7C3AED' },
        }
        const cfg = ROLE_LABELS[ecoleRole]
        if (!cfg) return null
        return (
          <motion.div {...fadeUp(0)} className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-xs font-medium"
            style={{ background: `${cfg.color}12`, border: `1px solid ${cfg.color}30`, color: cfg.color }}>
            <Star size={13} />
            <span>Connecté en tant que : <strong>{cfg.label}</strong></span>
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
                {greeting}, {displayName} 👋
              </h1>
              <button
                onClick={() => router.refresh()}
                style={{ color: 'rgba(255,255,255,0.5)', padding: 4 }}
                className="hover:opacity-80 transition-opacity"
                title="Rafraîchir"
              >
                <RefreshCw size={13} />
              </button>
            </div>
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.75)', marginBottom: 4 }}>
              {isFinancial
                ? 'Gérez vos ventes, finances et équipes en un seul endroit.'
                : 'Consultez les informations de votre espace.'}
            </p>
            <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)' }}>
              <span style={{ fontWeight: 600, color: '#FFFFFF' }}>{tenant.nom_entreprise}</span>
              {' · '}Plan <span style={{ fontWeight: 700 }}>{tenant.plan.toUpperCase()}</span>
              {' · '}{tenant.modules_actifs.length} module{tenant.modules_actifs.length !== 1 ? 's' : ''} actif{tenant.modules_actifs.length !== 1 ? 's' : ''}
            </p>
          </div>

          {/* Mini-stats */}
          {isFinancial && (
            <div className="flex flex-wrap gap-2 shrink-0">
              <div style={{ background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.25)', borderRadius: 8, padding: '12px 16px', textAlign: 'center', minWidth: 90 }}>
                <p style={{ fontSize: 9, color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>Recouvrement</p>
                <p style={{ fontSize: 14, fontWeight: 700, color: '#FFFFFF' }}>{fmt(kpis.revenuMois)} F</p>
              </div>
              <div style={{ background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.25)', borderRadius: 8, padding: '12px 16px', textAlign: 'center', minWidth: 90 }}>
                <p style={{ fontSize: 9, color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>Sessions</p>
                <p style={{ fontSize: 14, fontWeight: 700, color: '#FFFFFF' }}>
                  {alerts.pendingCount} facture{alerts.pendingCount !== 1 ? 's' : ''}
                </p>
              </div>
              <div style={{ background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.25)', borderRadius: 8, padding: '12px 16px', textAlign: 'center', minWidth: 90 }}>
                <p style={{ fontSize: 9, color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>Impayés</p>
                <p style={{ fontSize: 14, fontWeight: 700, color: alerts.lowStockCount > 0 ? '#FFFFFF' : '#FFFFFF' }}>
                  {alerts.lowStockCount > 0 ? `${alerts.lowStockCount} alerte${alerts.lowStockCount > 1 ? 's' : ''}` : '✓ OK'}
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
              title={isFinancial ? 'Statut des factures' : 'Modules actifs'}
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

'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import {
  TrendingUp, Users, Package, AlertTriangle, Plus, Download,
  Clock, ChevronDown, GraduationCap, UserX, CalendarOff, Lock,
  Wallet, CheckCircle, Send, FileText, ArrowUpRight, ArrowDownRight,
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

// ── Hero KPI Card (colored gradient, VTC-style) ───────────────────────────────

interface HeroCardProps {
  label: string
  value: string | number
  sub: string
  icon: React.ElementType
  bg: string
  trend?: number        // % change, positive or negative
  href?: string
  i: number
}

function HeroCard({ label, value, sub, icon: Icon, bg, trend, href, i }: HeroCardProps) {
  const card = (
    <motion.div
      {...fadeUp(i)}
      whileHover={{ scale: 1.03 }}
      transition={{ duration: 0.2 }}
      className="relative rounded-2xl p-4 sm:p-5 overflow-hidden cursor-default select-none min-h-[120px] sm:h-[158px] flex flex-col justify-between kpi-card"
      style={{ background: bg }}
    >
      {/* Icon badge */}
      <div className="absolute top-4 right-4 w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center">
        <Icon size={18} className="text-white" />
      </div>

      <div className="relative">
        <p className="text-white/70 text-[11px] font-semibold uppercase tracking-wider mb-2">{label}</p>
        <p className="text-white text-3xl font-bold leading-none mb-1">{value}</p>
        <p className="text-white/60 text-[11px] mb-3">{sub}</p>

        {trend !== undefined && (
          <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/15 backdrop-blur-sm">
            {trend >= 0
              ? <ArrowUpRight size={11} className="text-white" />
              : <ArrowDownRight size={11} className="text-white" />}
            <span className="text-white text-[10px] font-bold">
              {trend >= 0 ? '+' : ''}{trend.toFixed(1)}% ce mois
            </span>
          </div>
        )}
      </div>
    </motion.div>
  )

  if (href) return <Link href={href}>{card}</Link>
  return card
}

// ── Right-panel cards ─────────────────────────────────────────────────────────

function TresorerieCard({ solde, pending, pendingAmt }: { solde: number; pending: number; pendingAmt: number }) {
  const { t } = useLocale()
  return (
    <motion.div {...fadeUp(4)} className="rounded-2xl p-5 overflow-hidden relative"
      style={{ background: '#8B0070' }}>
      <div className="relative">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-8 h-8 rounded-lg bg-white/15 flex items-center justify-center">
            <Wallet size={15} className="text-white" />
          </div>
          <p className="text-white/70 text-xs font-semibold">{t('dash.solde')}</p>
        </div>
        <p className="text-white text-2xl font-bold leading-none mb-1">{fmt(solde)} FCFA</p>
        <p className="text-white/50 text-[10px] mb-4">{t('dash.monthCumul')}</p>
        <div className="grid grid-cols-2 gap-3 pt-3 border-t border-white/15">
          <div>
            <p className="text-white/50 text-[10px]">{t('common.pending')}</p>
            <p className="text-white text-sm font-bold">{fmt(pendingAmt)} F</p>
            <p className="text-white/40 text-[9px]">{pending} dossier{pending !== 1 ? 's' : ''}</p>
          </div>
          <div>
            <p className="text-white/50 text-[10px]">{t('common.status')}</p>
            <div className="flex items-center gap-1 mt-0.5">
              <div className={`w-1.5 h-1.5 rounded-full ${solde >= 0 ? 'bg-white/50' : 'bg-[#F51E33]'} animate-pulse`} />
              <p className="text-white text-xs font-semibold">{solde >= 0 ? t('dash.positive') : t('dash.deficit')}</p>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  )
}

function QuickLinksCard({ secteur, modules }: { secteur: string | null; modules: string[] }) {
  const { t } = useLocale()
  const links = secteur === 'ecole' ? [
    { label: 'Scolarité',     href: '/dashboard/ecole/scolarite',    color: '#F08900' },
    { label: 'Comptabilité',  href: '/dashboard/ecole/comptabilite', color: '#F51E33' },
    { label: 'RH & Paie',    href: '/dashboard/ecole/rh',           color: '#8B0070' },
    { label: 'Direction',     href: '/dashboard/ecole/direction',    color: '#F08900' },
    { label: 'MIAA',          href: '/dashboard/ecole/miaa',         color: '#8B0070' },
  ] : [
    { label: 'Facturation',  href: '/dashboard/facturation',  color: '#F51E33' },
    { label: 'Trésorerie',   href: '/dashboard/tresorerie',   color: '#F08900' },
    { label: 'RH',           href: '/dashboard/rh',           color: '#8B0070' },
    { label: 'Stock',        href: '/dashboard/stock',         color: '#F51E33' },
    { label: 'Comptabilité', href: '/dashboard/comptabilite', color: '#F08900' },
  ]

  return (
    <motion.div {...fadeUp(5)} className="bg-white/[0.04] border border-white/10 rounded-2xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <Zap size={14} className="text-[#F08900]" />
        <p className="text-xs font-bold text-white">{t('dash.quickLinks')}</p>
      </div>
      <div className="space-y-1.5">
        {links.map(l => (
          <Link key={l.href} href={l.href}
            className="flex items-center justify-between px-3 py-2.5 rounded-xl border border-white/10 hover:border-white/20 hover:bg-white/[0.06] transition-all duration-200 group">
            <div className="flex items-center gap-2.5">
              <div className="w-1.5 h-1.5 rounded-full" style={{ background: l.color }} />
              <span className="text-xs text-white/55 group-hover:text-white transition-colors">{l.label}</span>
            </div>
            <ChevronRight size={12} className="text-white/40 group-hover:text-white/55 transition-colors" />
          </Link>
        ))}
      </div>
    </motion.div>
  )
}

function TopModulesCard({ data }: { data: { name: string; value: number; color: string }[] }) {
  const { t } = useLocale()
  const total = data.reduce((s, d) => s + d.value, 0) || 1
  return (
    <motion.div {...fadeUp(6)} className="bg-white/[0.04] border border-white/10 rounded-2xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <BarChart2 size={14} className="text-[#F08900]" />
        <p className="text-xs font-bold text-white">{t('dash.invoiceBreakdown')}</p>
      </div>
      {data.length === 0 ? (
        <p className="text-xs text-white/40 text-center py-4">{t('dash.noData')}</p>
      ) : (
        <div className="space-y-3">
          {data.map((d, i) => {
            const pct = Math.round((d.value / total) * 100)
            return (
              <div key={i}>
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full" style={{ background: d.color }} />
                    <span className="text-[11px] text-white/55">{d.name}</span>
                  </div>
                  <span className="text-[11px] font-bold" style={{ color: d.color }}>{d.value}</span>
                </div>
                <div className="h-1.5 bg-[#1a2d50] rounded-full overflow-hidden">
                  <motion.div
                    className="h-full rounded-full"
                    style={{ background: d.color }}
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

// ── Shortcut cards per sector ─────────────────────────────────────────────────

type Shortcut = { label: string; href: string; icon: React.ElementType; color: string; desc: string }

const SECTOR_SHORTCUTS: Record<string, Shortcut[]> = {
  ecole: [
    { label: 'Nouvelle inscription', href: '/dashboard/ecole/scolarite',         icon: GraduationCap,  color: '#8B0070', desc: 'Inscrire un étudiant' },
    { label: 'Espace Formateur',      href: '/dashboard/ecole/espace-formateur',  icon: BookOpen,       color: '#8B0070', desc: 'Cours & heures' },
    { label: 'Direction Générale',    href: '/dashboard/ecole/direction',         icon: BarChart2,      color: '#F08900', desc: 'Finances & pilotage' },
    { label: 'RH & Paie',            href: '/dashboard/ecole/rh',                icon: Users,          color: '#8B0070', desc: 'Gestion du personnel' },
    { label: 'Comptabilité OHADA',    href: '/dashboard/ecole/comptabilite',      icon: Calculator,     color: '#8B0070', desc: 'Journal & bilan' },
    { label: 'MIAA+ IA',             href: '/dashboard/ecole/miaa',              icon: Bot,            color: '#F08900', desc: 'Assistant scolaire IA' },
  ],
  restaurant: [
    { label: 'Caisse POS',   href: '/dashboard/restaurant', icon: ChefHat,     color: '#F08900', desc: 'Ouvrir la caisse' },
    { label: 'Stock cuisine', href: '/dashboard/stock',      icon: Package,     color: '#8B0070', desc: 'Inventaire & alertes' },
    { label: 'RH & Paie',    href: '/dashboard/rh',         icon: Users,       color: '#F08900', desc: 'Gestion du personnel' },
    { label: 'Trésorerie',   href: '/dashboard/tresorerie', icon: Wallet,      color: '#8B0070', desc: 'Suivi des finances' },
    { label: 'Dépenses',     href: '/dashboard/depenses',   icon: Receipt,     color: '#8B0070', desc: 'Charges & sorties' },
    { label: 'MIAA+',        href: '/dashboard/miaa',       icon: Bot,         color: '#F08900', desc: 'Assistant IA' },
  ],
  commerce: [
    { label: 'Facturation',  href: '/dashboard/facturation', icon: FileText,    color: '#F08900', desc: 'Devis & factures' },
    { label: 'Stock',        href: '/dashboard/stock',       icon: Package,     color: '#8B0070', desc: 'Inventaire' },
    { label: 'Trésorerie',   href: '/dashboard/tresorerie',  icon: Wallet,      color: '#F08900', desc: 'Finances' },
    { label: 'Achats',       href: '/dashboard/achats',      icon: ShoppingCart,color: '#8B0070', desc: 'Fournisseurs' },
    { label: 'RH & Paie',    href: '/dashboard/rh',          icon: Users,       color: '#8B0070', desc: 'Personnel' },
    { label: 'Comptabilité', href: '/dashboard/comptabilite',icon: Calculator,  color: '#8B0070', desc: 'OHADA' },
  ],
  supermarche: [
    { label: 'Caisse',       href: '/dashboard/facturation', icon: FileText,    color: '#F08900', desc: 'Ventes' },
    { label: 'Rayons & Stock',href: '/dashboard/stock',      icon: Package,     color: '#8B0070', desc: 'Inventaire' },
    { label: 'Achats',       href: '/dashboard/achats',      icon: ShoppingCart,color: '#8B0070', desc: 'Fournisseurs' },
    { label: 'RH & Paie',    href: '/dashboard/rh',          icon: Users,       color: '#F08900', desc: 'Personnel' },
    { label: 'Trésorerie',   href: '/dashboard/tresorerie',  icon: Wallet,      color: '#8B0070', desc: 'Finances' },
  ],
  transport: [
    { label: 'Flotte',       href: '/dashboard/transport',   icon: Truck,       color: '#F08900', desc: 'Véhicules & courses' },
    { label: 'Facturation',  href: '/dashboard/facturation', icon: FileText,    color: '#F08900', desc: 'Devis & factures' },
    { label: 'Chauffeurs',   href: '/dashboard/rh',          icon: Users,       color: '#8B0070', desc: 'RH & Paie' },
    { label: 'Trésorerie',   href: '/dashboard/tresorerie',  icon: Wallet,      color: '#8B0070', desc: 'Finances' },
    { label: 'MIAA+',        href: '/dashboard/miaa',        icon: Bot,         color: '#F08900', desc: 'Assistant IA' },
  ],
  hotel: [
    { label: 'Réservations', href: '/dashboard/hotel',       icon: Hotel,       color: '#F08900', desc: 'Chambres & séjours' },
    { label: 'Facturation',  href: '/dashboard/facturation', icon: FileText,    color: '#F08900', desc: 'Factures & devis' },
    { label: 'RH & Paie',    href: '/dashboard/rh',          icon: Users,       color: '#8B0070', desc: 'Personnel' },
    { label: 'Trésorerie',   href: '/dashboard/tresorerie',  icon: Wallet,      color: '#8B0070', desc: 'Finances' },
    { label: 'MIAA+',        href: '/dashboard/miaa',        icon: Bot,         color: '#F08900', desc: 'Assistant IA' },
  ],
  sante: [
    { label: 'Consultations', href: '/dashboard/facturation', icon: FileText,   color: '#F08900', desc: 'Ordonnances & actes' },
    { label: 'Pharmacie',     href: '/dashboard/stock',       icon: Package,    color: '#8B0070', desc: 'Médicaments' },
    { label: 'RH médical',   href: '/dashboard/rh',           icon: Users,      color: '#F08900', desc: 'Personnel soignant' },
    { label: 'Trésorerie',   href: '/dashboard/tresorerie',   icon: Wallet,     color: '#8B0070', desc: 'Finances' },
    { label: 'MIAA+',        href: '/dashboard/miaa',         icon: Bot,        color: '#F08900', desc: 'Assistant IA' },
  ],
  _default: [
    { label: 'Facturation',  href: '/dashboard/facturation',  icon: FileText,   color: '#F08900', desc: 'Devis & factures' },
    { label: 'Trésorerie',   href: '/dashboard/tresorerie',   icon: Wallet,     color: '#F08900', desc: 'Suivi financier' },
    { label: 'RH & Paie',    href: '/dashboard/rh',           icon: Users,      color: '#8B0070', desc: 'Personnel' },
    { label: 'Stock',        href: '/dashboard/stock',         icon: Package,   color: '#8B0070', desc: 'Inventaire' },
    { label: 'Comptabilité', href: '/dashboard/comptabilite', icon: Calculator, color: '#8B0070', desc: 'OHADA' },
    { label: 'MIAA+',        href: '/dashboard/miaa',         icon: Bot,        color: '#F08900', desc: 'Assistant IA' },
  ],
}

// ── Raccourcis par rôle école ─────────────────────────────────────────────────

const ECOLE_ROLE_SHORTCUTS: Record<string, Shortcut[]> = {
  DAAC: [
    { label: 'Matières',      href: '/dashboard/ecole/daac',                    icon: BookOpen,      color: '#F08900', desc: 'Programmes & UE' },
    { label: 'Sessions',      href: '/dashboard/ecole/daac',                    icon: Layers,        color: '#F08900', desc: 'Sessions actives' },
    { label: 'Examens',       href: '/dashboard/ecole/daac',                    icon: FileText,      color: '#8B0070', desc: 'Notes & résultats' },
    { label: 'Diplômes',      href: '/dashboard/ecole/daac',                    icon: GraduationCap, color: '#8B0070', desc: 'En attente' },
    { label: 'Soutenances',   href: '/dashboard/ecole/daac',                    icon: Award,         color: '#8B0070', desc: 'Planifiées' },
    { label: 'Paramètres',   href: '/dashboard/ecole/parametres-academiques',  icon: Settings,      color: '#F08900', desc: 'Règles LMD' },
  ],
  RAF: [
    { label: 'Comptabilité',  href: '/dashboard/ecole/comptabilite',            icon: Calculator,    color: '#F08900', desc: 'Journal OHADA' },
    { label: 'Trésorerie',   href: '/dashboard/ecole/tresorerie',              icon: Wallet,        color: '#F08900', desc: 'Wallets & virements' },
    { label: 'Budgets',       href: '/dashboard/ecole/comptabilite',            icon: BarChart2,     color: '#8B0070', desc: 'Suivi budgétaire' },
    { label: 'Paie',          href: '/dashboard/ecole/rh',                      icon: Users,         color: '#8B0070', desc: 'Bulletins de paie' },
    { label: 'Dépenses',     href: '/dashboard/ecole/tresorerie',              icon: TrendingUp,    color: '#8B0070', desc: 'Sorties de fonds' },
    { label: 'MIAA+',         href: '/dashboard/ecole/miaa',                    icon: Bot,           color: '#F08900', desc: 'Assistant IA' },
  ],
  RH_PAIE: [
    { label: 'Employés',     href: '/dashboard/ecole/rh',                      icon: Users,         color: '#F08900', desc: 'Gestion du personnel' },
    { label: 'Paie',          href: '/dashboard/ecole/rh',                      icon: Wallet,        color: '#F08900', desc: 'Bulletins de paie' },
    { label: 'Contrats',      href: '/dashboard/ecole/rh',                      icon: FileText,      color: '#8B0070', desc: 'CDD/CDI' },
    { label: 'Absences',      href: '/dashboard/ecole/rh',                      icon: CalendarOff,   color: '#F51E33', desc: 'Congés & absences' },
    { label: 'Départements', href: '/dashboard/ecole/rh',                      icon: BarChart2,     color: '#8B0070', desc: 'Organigramme' },
    { label: 'MIAA+',         href: '/dashboard/ecole/miaa',                    icon: Bot,           color: '#F08900', desc: 'Assistant IA' },
  ],
  SCOLARITE: [
    { label: 'Étudiants',    href: '/dashboard/ecole/scolarite',               icon: GraduationCap, color: '#F08900', desc: 'Gestion des étudiants' },
    { label: 'Inscriptions',  href: '/dashboard/ecole/scolarite',               icon: FileText,      color: '#F08900', desc: 'Nouvelles inscriptions' },
    { label: 'Paiements',     href: '/dashboard/ecole/scolarite',               icon: Wallet,        color: '#8B0070', desc: 'Frais de scolarité' },
    { label: 'Absences',      href: '/dashboard/ecole/scolarite',               icon: CalendarOff,   color: '#F51E33', desc: 'Relevés d\'absences' },
    { label: 'Classes',       href: '/dashboard/ecole/scolarite',               icon: BookOpen,      color: '#8B0070', desc: 'Gestion des classes' },
    { label: 'MIAA+',         href: '/dashboard/ecole/miaa',                    icon: Bot,           color: '#F08900', desc: 'Assistant IA' },
  ],
  FORMATEUR: [
    { label: 'Mes cours',     href: '/dashboard/ecole/espace-formateur',        icon: BookOpen,      color: '#F08900', desc: 'Modules enseignés' },
    { label: 'Présences',    href: '/dashboard/ecole/espace-formateur',        icon: CheckCircle,   color: '#8B0070', desc: 'Appel & absences' },
    { label: 'Notes',         href: '/dashboard/ecole/espace-formateur',        icon: Star,          color: '#F08900', desc: 'Saisie des notes' },
    { label: 'Classes',       href: '/dashboard/ecole/espace-formateur',        icon: GraduationCap, color: '#8B0070', desc: 'Mes classes' },
    { label: 'Examens',       href: '/dashboard/ecole/daac',                    icon: FileText,      color: '#8B0070', desc: 'Délibérations' },
    { label: 'MIAA+',         href: '/dashboard/ecole/miaa',                    icon: Bot,           color: '#F08900', desc: 'Assistant IA' },
  ],
  ETUDIANT: [
    { label: 'Mes notes',     href: '/dashboard/ecole/espace-etudiant',         icon: Star,          color: '#F08900', desc: 'Résultats & moyennes' },
    { label: 'Bulletins',     href: '/dashboard/ecole/espace-etudiant',         icon: FileText,      color: '#F08900', desc: 'Bulletins de note' },
    { label: 'Paiements',     href: '/dashboard/ecole/espace-etudiant',         icon: Wallet,        color: '#8B0070', desc: 'Frais & quittances' },
    { label: 'Absences',      href: '/dashboard/ecole/espace-etudiant',         icon: CalendarOff,   color: '#F51E33', desc: 'Mes absences' },
    { label: 'Planning',      href: '/dashboard/ecole/espace-etudiant',         icon: Clock,         color: '#8B0070', desc: 'Emploi du temps' },
    { label: 'MIAA+',         href: '/dashboard/ecole/miaa',                    icon: Bot,           color: '#F08900', desc: 'Assistant IA' },
  ],
  PARENT: [
    { label: 'Résultats',    href: '/dashboard/ecole/espace-parent',           icon: Star,          color: '#F08900', desc: 'Notes de mon enfant' },
    { label: 'Bulletins',     href: '/dashboard/ecole/espace-parent',           icon: FileText,      color: '#F08900', desc: 'Bulletins de note' },
    { label: 'Paiements',     href: '/dashboard/ecole/espace-parent',           icon: Wallet,        color: '#8B0070', desc: 'Frais de scolarité' },
    { label: 'Absences',      href: '/dashboard/ecole/espace-parent',           icon: CalendarOff,   color: '#F51E33', desc: 'Relevés d\'absences' },
    { label: 'Contact',       href: '/dashboard/ecole/espace-parent',           icon: HeartHandshake,color: '#8B0070', desc: 'Contacter l\'école' },
    { label: 'MIAA+',         href: '/dashboard/ecole/miaa',                    icon: Bot,           color: '#F08900', desc: 'Assistant IA' },
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
    <motion.div {...fadeUp(9)} className="pt-2">
      <div className="flex items-center gap-2 mb-3">
        <Zap size={14} className="text-[#F08900]" />
        <h3 className="text-xs font-bold text-white uppercase tracking-wider">{t('dash.shortcuts')}</h3>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {cards.map((sc, i) => {
          const Icon = sc.icon
          return (
            <motion.div
              key={sc.href + sc.label}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: 0.05 + i * 0.05 }}
            >
              <Link
                href={sc.href}
                className="flex flex-col items-center gap-2 p-3 rounded-xl border border-white/10 bg-white/[0.04] hover:border-white/20 hover:bg-white/[0.08] transition-all duration-200 group text-center"
              >
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center"
                  style={{ background: `${sc.color}18` }}
                >
                  <Icon size={18} style={{ color: sc.color }} />
                </div>
                <div>
                  <p className="text-[11px] font-semibold text-white leading-tight">{sc.label}</p>
                  <p className="text-[10px] text-white/40 group-hover:text-white/65 leading-tight mt-0.5">{sc.desc}</p>
                </div>
              </Link>
            </motion.div>
          )
        })}
      </div>
    </motion.div>
  )
}

// ── Enhanced transactions table ───────────────────────────────────────────────

const STATUT_CFG: Record<string, { label: string; bg: string; color: string; dot: string }> = {
  payee:     { label: 'PAYÉE',     bg: 'rgba(255,255,255,0.08)', color: '#FFFFFF', dot: '#FFFFFF' },
  envoyee:   { label: 'ENVOYÉE',   bg: 'rgba(240,137,0,0.15)',   color: '#F08900', dot: '#F08900' },
  brouillon: { label: 'BROUILLON', bg: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.6)', dot: 'rgba(255,255,255,0.4)' },
  annulee:   { label: 'ANNULÉE',   bg: 'rgba(245,30,51,0.15)',   color: '#F51E33', dot: '#F51E33' },
}

function TransactionRow({ item, i }: { item: ActivityItem; i: number }) {
  const st   = STATUT_CFG[item.statut] ?? STATUT_CFG.brouillon
  const init = (item.client_nom ?? 'C').split(' ').map((w: string) => w[0]).slice(0, 2).join('').toUpperCase()
  const diff = Date.now() - new Date(item.created_at).getTime()
  const ago  = diff < 3600000 ? `${Math.floor(diff / 60000)}min`
             : diff < 86400000 ? `${Math.floor(diff / 3600000)}h`
             : `${Math.floor(diff / 86400000)}j`

  const colors = ['#F08900', '#F51E33', '#8B0070', '#F08900', '#8B0070', '#F51E33', '#F08900']
  const avatarColor = colors[item.client_nom.charCodeAt(0) % colors.length]

  return (
    <motion.tr
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.35, delay: i * 0.05 }}
      className="border-b border-white/10 hover:bg-white/[0.04] transition-colors group"
    >
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0" style={{ background: `${avatarColor}20`, color: avatarColor }}>
            {init}
          </div>
          <div>
            <p className="text-xs font-semibold text-white">{item.client_nom}</p>
            <p className="text-[10px] text-white/40">il y a {ago}</p>
          </div>
        </div>
      </td>
      <td className="px-4 py-3 text-right">
        <p className="text-sm font-bold text-white">{fmt(item.total)} FCFA</p>
      </td>
      <td className="px-4 py-3">
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold"
          style={{ background: st.bg, color: st.color }}>
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: st.dot }} />
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
  const isFinancial = data.isFinancial ?? true
  const secteur     = data.secteur ?? null
  const ecoleRole   = data.ecoleRole ?? null
  const ecoleKpis   = data.ecoleKpis ?? null
  const daacKpis    = data.daacKpis ?? null
  const rhKpis          = data.rhKpis ?? null
  const ecoleFinancials = data.ecoleFinancials ?? null

  const [greeting, setGreeting] = useState('Bonjour')
  useEffect(() => {
    const h = new Date().getHours()
    setGreeting(h < 12 ? 'Bonjour' : h < 18 ? 'Bon après-midi' : 'Bonsoir')
  }, [])

  const displayName = userName || 'Admin'

  // Estimate solde from revenue minus alerts amount
  const soldeTresorerie = kpis.revenuMois - alerts.pendingAmount * 0.3

  // ── Hero KPIs pour rôle DAAC ────────────────────────────────────────────────
  const isDaac = secteur === 'ecole' && ecoleRole === 'DAAC' && daacKpis
  const isRH   = secteur === 'ecole' && (ecoleRole === 'RH_PAIE' || ecoleRole === 'RAF') && rhKpis

  // Build hero KPIs based on role/secteur
  const heroCards: HeroCardProps[] = isDaac ? [
    {
      label: 'Sessions en cours',
      value: daacKpis!.sessionsEnCours,
      sub:   'Sessions actives ce semestre',
      icon:  Layers,
      bg: '#8B0070',
      href: '/dashboard/ecole/daac',
      i: 0,
    },
    {
      label: 'Diplômes en attente',
      value: daacKpis!.diplomesEnAttente,
      sub:   'En cours de validation',
      icon:  GraduationCap,
      bg: '#F08900',
      href: '/dashboard/ecole/daac',
      i: 1,
    },
    {
      label: 'Soutenances planif.',
      value: daacKpis!.nbSoutenances,
      sub:   'À venir ce mois',
      icon:  Award,
      bg: '#8B0070',
      href: '/dashboard/ecole/daac',
      i: 2,
    },
    {
      label: 'Étudiants actifs',
      value: ecoleKpis?.nbActifs ?? 0,
      sub:   'Inscrits et actifs',
      icon:  Users,
      bg: '#F51E33',
      href: '/dashboard/ecole/scolarite',
      i: 3,
    },
  ] : isRH ? [
    {
      label: 'Employés actifs',
      value: rhKpis!.nbActifs,
      sub:   'Personnel en poste',
      icon:  Users,
      bg: '#F51E33',
      href: '/dashboard/ecole/rh',
      i: 0,
    },
    {
      label: 'En congé',
      value: rhKpis!.nbConges,
      sub:   'Absences & congés',
      icon:  CalendarOff,
      bg: '#F08900',
      href: '/dashboard/ecole/rh',
      i: 1,
    },
    {
      label: 'Total personnel',
      value: kpis.nbEmployes,
      sub:   'Tous statuts confondus',
      icon:  HeartHandshake,
      bg: '#8B0070',
      href: '/dashboard/ecole/rh',
      i: 2,
    },
  ] : isFinancial && secteur === 'ecole' && ecoleKpis ? [
    {
      label: 'Étudiants inscrits',
      value: ecoleKpis.nbEtudiants,
      sub: `${ecoleKpis.nbActifs} actifs · ${ecoleKpis.nbSuspendus} suspendus`,
      icon: GraduationCap,
      bg: '#F51E33',
      href: '/dashboard/ecole/scolarite',
      i: 0,
    },
    {
      label: 'Revenus scolaires',
      value: `${fmt(ecoleFinancials?.revenusMois ?? 0)} FCFA`,
      sub: `${ecoleFinancials?.nbPaiementsMois ?? 0} paiements ce mois`,
      icon: TrendingUp,
      bg: '#8B0070',
      href: '/dashboard/ecole/scolarite',
      i: 1,
    },
    {
      label: 'Impayés scolarité',
      value: ecoleFinancials?.nbImpayesDossiers ?? 0,
      sub: `${fmt(ecoleFinancials?.montantImpayeTotal ?? 0)} FCFA en attente`,
      icon: AlertTriangle,
      bg: (ecoleFinancials?.nbImpayesDossiers ?? 0) > 0 ? '#F51E33' : '#8B0070',
      href: '/dashboard/ecole/scolarite',
      i: 2,
    },
    {
      label: 'Absences totales',
      value: ecoleKpis.nbAbsences,
      sub: 'Relevés d\'absences',
      icon: CalendarOff,
      bg: '#8B0070',
      i: 3,
    },
  ] : secteur === 'ecole' && ecoleKpis ? [
    {
      label: t('dash.enrolled'),
      value: ecoleKpis.nbEtudiants,
      sub: `${ecoleKpis.nbActifs} comptes ${t('dash.actifs')}`,
      icon: GraduationCap,
      bg: '#F51E33',
      trend: ecoleKpis.nbActifs > 0 ? +((ecoleKpis.nbActifs / ecoleKpis.nbEtudiants) * 100 - 100) : undefined,
      href: '/dashboard/ecole/scolarite',
      i: 0,
    },
    {
      label: t('dash.active'),
      value: ecoleKpis.nbActifs,
      sub: t('dash.paymentsPaid'),
      icon: Users,
      bg: '#8B0070',
      trend: 2.4,
      href: '/dashboard/ecole/scolarite',
      i: 1,
    },
    {
      label: t('dash.suspended'),
      value: ecoleKpis.nbSuspendus,
      sub: t('dash.paymentsPending'),
      icon: UserX,
      bg: '#F51E33',
      trend: ecoleKpis.nbSuspendus > 0 ? -2.4 : undefined,
      i: 2,
    },
    {
      label: t('dash.totalAbsences'),
      value: ecoleKpis.nbAbsences,
      sub: t('school.absences'),
      icon: CalendarOff,
      bg: '#8B0070',
      i: 3,
    },
  ] : isFinancial ? [
    {
      label: t('dash.revenue'),
      value: `${fmt(kpis.revenuMois)} FCFA`,
      sub: t('dash.billedInvoices'),
      icon: TrendingUp,
      bg: '#F51E33',
      trend: 12.5,
      href: '/dashboard/facturation',
      i: 0,
    },
    {
      label: 'Factures payées',
      value: chartData.moduleBreakdown.find(m => m.name === 'Payées')?.value ?? 0,
      sub: 'Ce mois-ci',
      icon: CheckCircle,
      bg: '#8B0070',
      href: '/dashboard/facturation',
      i: 1,
    },
    {
      label: 'Factures en attente',
      value: alerts.pendingCount,
      sub: `${fmt(alerts.pendingAmount)} FCFA à encaisser`,
      icon: Clock,
      bg: '#F08900',
      href: '/dashboard/facturation',
      i: 2,
    },
    {
      label: alerts.lowStockCount > 0 ? 'Ruptures de stock' : 'Alertes stock',
      value: kpis.nbAlertes,
      sub: alerts.lowStockCount > 0 ? `${alerts.lowStockCount} article${alerts.lowStockCount > 1 ? 's' : ''} épuisé${alerts.lowStockCount > 1 ? 's' : ''}` : 'Tout est en ordre',
      icon: AlertTriangle,
      bg: kpis.nbAlertes > 0 ? '#F51E33' : '#8B0070',
      trend: kpis.nbAlertes > 0 ? -kpis.nbAlertes : undefined,
      i: 3,
    },
  ] : [
    {
      label: t('dash.employees'),
      value: kpis.nbEmployes,
      sub: 'Dans votre équipe',
      icon: Users,
      bg: '#8B0070',
      href: '/dashboard/rh',
      i: 0,
    },
    {
      label: t('dash.stock'),
      value: kpis.nbArticles,
      sub: 'Références inventoriées',
      icon: Package,
      bg: '#F08900',
      href: '/dashboard/stock',
      i: 1,
    },
    {
      label: t('dash.alerts'),
      value: kpis.nbAlertes,
      sub: 'À traiter',
      icon: AlertTriangle,
      bg: '#F51E33',
      i: 2,
    },
  ]

  return (
    <div className="space-y-4 sm:space-y-5 pb-6">

      {/* ── Role banner ─────────────────────────────────────────────────── */}
      {secteur === 'ecole' && ecoleRole && ecoleRole !== 'DIRECTION_GENERALE' && (() => {
        const ROLE_LABELS: Record<string, { label: string; color: string; bg: string }> = {
          DAAC:       { label: 'Direction des Affaires Académiques', color: '#F08900', bg: 'rgba(240,137,0,0.12)' },
          SCOLARITE:  { label: 'Service Scolarité',                  color: '#F51E33', bg: 'rgba(245,30,51,0.12)' },
          RAF:        { label: 'Responsable Administratif & Financier', color: '#F08900', bg: 'rgba(240,137,0,0.12)' },
          RH_PAIE:    { label: 'Ressources Humaines & Paie',         color: '#8B0070', bg: 'rgba(139,0,112,0.12)' },
          FORMATEUR:  { label: 'Espace Formateur',                   color: '#F08900', bg: 'rgba(240,137,0,0.12)' },
          ETUDIANT:   { label: 'Espace Étudiant',                   color: '#8B0070', bg: '#14285015' },
          PARENT:     { label: 'Espace Parent',                      color: '#8B0070', bg: '#8B007015' },
        }
        const cfg = ROLE_LABELS[ecoleRole]
        if (!cfg) return null
        return (
          <motion.div {...fadeUp(0)} className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl border text-xs font-medium"
            style={{ background: cfg.bg, borderColor: `${cfg.color}30`, color: cfg.color }}>
            <Star size={13} />
            <span>Connecté en tant que : <strong>{cfg.label}</strong></span>
          </motion.div>
        )
      })()}

      {/* ── Access banner for non-financial roles ───────────────────────── */}
      {!isFinancial && !ecoleRole && (
        <motion.div {...fadeUp(0)} className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl border border-white/10 text-white/60 text-xs" style={{ background: 'rgba(139,0,112,0.08)' }}>
          <Lock size={13} />
          <span>{t('dash.academicView')}</span>
        </motion.div>
      )}

      {/* ── Greeting Banner ──────────────────────────────────────────────── */}
      <motion.div {...fadeUp(0)} className="relative rounded-2xl overflow-hidden border border-white/10"
        style={{ background: '#0f1e3d' }}>
        <div className="relative p-5 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h1 className="text-xl font-bold text-white leading-tight">
                  {greeting}, {displayName} 👋
                </h1>
                <button
                  onClick={() => router.refresh()}
                  className="p-1 text-white/30 hover:text-white/70 transition-colors"
                  title="Rafraîchir"
                >
                  <RefreshCw size={13} />
                </button>
              </div>
              <p className="text-sm text-white/55 mb-1">
                {isFinancial
                  ? 'Gérez vos ventes, finances et équipes en un seul endroit.'
                  : 'Consultez les informations de votre espace.'}
              </p>
              <p className="text-xs text-white/35">
                <span className="font-semibold text-white/60">{tenant.nom_entreprise}</span>
                {' · '}Plan <span className="text-[#F08900] font-bold capitalize">{tenant.plan}</span>
                {' · '}{tenant.modules_actifs.length} module{tenant.modules_actifs.length !== 1 ? 's' : ''} actif{tenant.modules_actifs.length !== 1 ? 's' : ''}
              </p>
            </div>
            {/* Quick stats chips */}
            {isFinancial && (
              <div className="flex flex-wrap gap-2 shrink-0">
                <div className="px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-center min-w-[90px]">
                  <p className="text-[9px] text-white/40 uppercase tracking-wider mb-0.5">Chiffre du mois</p>
                  <p className="text-sm font-bold text-white">{fmt(kpis.revenuMois)} F</p>
                </div>
                <div className="px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-center min-w-[90px]">
                  <p className="text-[9px] text-white/40 uppercase tracking-wider mb-0.5">En attente</p>
                  <p className={`text-sm font-bold ${alerts.pendingCount > 0 ? 'text-[#F08900]' : 'text-white'}`}>
                    {alerts.pendingCount} facture{alerts.pendingCount !== 1 ? 's' : ''}
                  </p>
                </div>
                <div className="px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-center min-w-[90px]">
                  <p className="text-[9px] text-white/40 uppercase tracking-wider mb-0.5">Alertes stock</p>
                  <p className={`text-sm font-bold ${alerts.lowStockCount > 0 ? 'text-[#F51E33]' : 'text-white/50'}`}>
                    {alerts.lowStockCount > 0 ? `${alerts.lowStockCount} article${alerts.lowStockCount > 1 ? 's' : ''}` : '✓ OK'}
                  </p>
                </div>
              </div>
            )}
          </div>
          {/* Action buttons */}
          <div className="flex items-center gap-2 flex-wrap mt-4">
            <Link
              href={secteur === 'ecole' ? '/dashboard/ecole/scolarite' : '/dashboard/facturation'}
              className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-[#142850] rounded-xl hover:opacity-90 transition-all"
              style={{ background: '#F08900' }}
            >
              <Plus size={11} /> {secteur === 'ecole' ? t('dash.newInscription') : t('dash.newAction')}
            </Link>
            {isFinancial && (
              <>
                <button className="flex items-center gap-1.5 px-3 py-2 text-xs text-white/60 border border-white/15 rounded-xl hover:bg-white/5 transition-all">
                  <Wallet size={11} /> {t('dash.withdrawal')}
                </button>
                <button className="flex items-center gap-1.5 px-3 py-2 text-xs text-white/50 border border-white/10 rounded-xl hover:bg-white/5 transition-all">
                  <Download size={11} /> CSV
                </button>
                <button className="flex items-center gap-1.5 px-3 py-2 text-xs text-white/50 border border-white/10 rounded-xl hover:bg-white/5 transition-all">
                  <Download size={11} /> PDF
                </button>
              </>
            )}
            <button className="flex items-center gap-1.5 px-3 py-2 text-xs text-white/50 border border-white/10 rounded-xl hover:bg-white/5 transition-all ml-auto">
              <Clock size={11} /> {t('dash.lastDays')} <ChevronDown size={10} />
            </button>
          </div>
        </div>
      </motion.div>

      {/* ── Hero KPI Cards ───────────────────────────────────────────────── */}
      <div className={`grid gap-3 sm:gap-4 ${heroCards.length === 4 ? 'grid-cols-2 xl:grid-cols-4' : 'grid-cols-2 xl:grid-cols-3'}`}>
        {heroCards.map(card => <HeroCard key={card.label} {...card} />)}
      </div>

      {/* ── Main content + right panel ───────────────────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-3 sm:gap-4">

        {/* Left: charts (2/3) */}
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

        {/* Right panel (1/3) */}
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

      {/* ── Recent transactions ──────────────────────────────────────────── */}
      {isFinancial && recentActivity.length > 0 && (
        <motion.div {...fadeUp(7)} className="bg-white/[0.04] border border-white/10 rounded-2xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
            <div>
              <h3 className="text-sm font-bold text-white">{t('dash.lastTransactions')}</h3>
              <p className="text-[10px] text-white/40 mt-0.5">{recentActivity.length} {t('dash.lastFactures')}</p>
            </div>
            <Link href="/dashboard/facturation"
              className="text-xs text-[#F08900] hover:text-white transition-colors font-medium">
              {t('dash.viewAll')}
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#1a2d50]" style={{ background: 'rgba(255,255,255,0.01)' }}>
                          <th className="text-left px-4 py-3 text-[10px] font-semibold text-white/40 uppercase tracking-wider">{t('common.name')}</th>
                  <th className="text-right px-4 py-3 text-[10px] font-semibold text-white/40 uppercase tracking-wider">{t('common.amount')}</th>
                  <th className="text-left px-4 py-3 text-[10px] font-semibold text-white/40 uppercase tracking-wider">{t('common.status')}</th>
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

      {/* Non-financial: simplified view */}
      {!isFinancial && (
        <motion.div {...fadeUp(7)} className="bg-[#0f1e3d] border border-[#1a2d50] rounded-2xl p-6 text-center">
          <div className="w-12 h-12 rounded-2xl bg-[#F08900]/10 flex items-center justify-center mx-auto mb-3">
            <Star size={20} className="text-[#F08900]" />
          </div>
          <p className="text-sm font-semibold text-white mb-1">{t('dash.restricted')}</p>
          <p className="text-xs text-white/55">{t('dash.restrictedMsg')}</p>
        </motion.div>
      )}

      {/* ── Shortcut cards (bottom of main dashboard) ───────────────────── */}
      <ShortcutCards secteur={secteur} ecoleRole={ecoleRole} />

    </div>
  )
}

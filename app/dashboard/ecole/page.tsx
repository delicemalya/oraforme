'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import {
  BarChart2, Users, GraduationCap, BookOpen, UserX, Award,
  TrendingUp, Wallet, AlertTriangle, RefreshCw, Loader2,
  Receipt, Bot, Calculator, UserCheck, Users2,
  ChevronRight, ArrowUpRight, CheckCircle, Layers, Plus,
  DollarSign,
} from 'lucide-react'
import Link from 'next/link'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { supabase } from '@/lib/supabase'
import { useTenant } from '@/lib/hooks/useTenant'

// Types kept for backward-compat
export type EcoleRole =
  | 'DIRECTION_GENERALE' | 'RAF' | 'SCOLARITE' | 'RH_PAIE'
  | 'FORMATEUR' | 'ETUDIANT' | 'PARENT' | 'DTI' | 'DAAC'

export type EcoleKpis = {
  nbEtudiants: number; nbActifs: number; nbEnseignants: number
  nbAbsencesJour: number; nbExamensAvenir: number; nbNotifs: number
  revenuMois: number; nbPaiementsEnAttente: number; montantImpayes: number
  soldeTresorerie: number; nbEmployes: number; nbHeurePending: number
  myHeuresTotales: number; myHeuresValidees: number
  myNotesMoyenne: number | null; myAbsences: number; myPaiementOk: boolean | null
}

function fmt(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)} M`
  if (n >= 1_000) return new Intl.NumberFormat('fr-FR').format(Math.round(n))
  return String(Math.round(n))
}

const fade = (i: number) => ({
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.38, delay: i * 0.04, ease: 'easeOut' as const },
})

type MonthData = { month: string; montant: number }

type OverviewData = {
  nbEtudiants: number; nbActifs: number; nbSuspendus: number; nbDiplomes: number
  nbEnseignants: number; nbEnsEmployes: number; nbEnsPrestataires: number
  nbEmployes: number; nbStaff: number
  revenuJour: number; revenuSemaine: number; revenuMois: number; revenuAnnee: number
  nbPaiementsJour: number; nbPaiementsMois: number
  montantImpayes: number; nbImpayes: number
  depensesJour: number
  sessionsEnCours: number; nbEvenements: number
  monthly: MonthData[]
  recentPaie: { id: string; montant: number; methode: string; libelle: string; created_at: string }[]
}

// ── Module Card Component ─────────────────────────────────────────────────────

interface ModCard {
  icon: React.ElementType
  label: string
  value: string
  footer: string
  delta: string
  gradient: string
  href: string
  badge?: string
  badgeVariant?: 'up' | 'down' | 'neutral'
}

function ModuleCard({ mod, i }: { mod: ModCard; i: number }) {
  const Icon = mod.icon
  return (
    <motion.div
      {...fade(i + 2)}
      whileHover={{ y: -4, scale: 1.018 }}
      transition={{ duration: 0.2 }}
    >
      <Link href={mod.href} className="block">
        <div
          className="relative rounded-2xl p-4 overflow-hidden cursor-pointer flex flex-col justify-between"
          style={{ background: mod.gradient, minHeight: 148 }}
        >
          {/* Shine */}
          <div className="absolute inset-0 pointer-events-none"
            style={{ background: 'radial-gradient(ellipse at 80% 15%, rgba(255,255,255,0.18) 0%, transparent 58%)' }} />
          {/* Circle deco */}
          <div className="absolute -top-6 -right-6 w-24 h-24 rounded-full bg-white/10 pointer-events-none" />

          {/* Top row: icon + badge */}
          <div className="relative flex items-start justify-between mb-3">
            <div className="w-9 h-9 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center shrink-0">
              <Icon size={17} className="text-white" />
            </div>
            {mod.badge && (
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full text-white ${
                mod.badgeVariant === 'up'   ? 'bg-white/25' :
                mod.badgeVariant === 'down' ? 'bg-red-500/40' : 'bg-white/15'
              }`}>
                {mod.badge}
              </span>
            )}
          </div>

          {/* Bottom: label + value + footer */}
          <div className="relative">
            <p className="text-white/80 text-[11.5px] font-bold leading-tight mb-0.5">{mod.label}</p>
            <p className="text-white text-[15px] font-extrabold font-mono leading-none">{mod.value}</p>
            <div className="flex items-center justify-between mt-2.5 pt-2.5 border-t border-white/20">
              <span className="text-white/55 text-[10px] leading-tight">{mod.footer}</span>
              <span className="text-white/90 text-[10.5px] font-bold">{mod.delta}</span>
            </div>
          </div>
        </div>
      </Link>
    </motion.div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function EcoleOverviewPage() {
  const { tenantId, loading: tenantLoading } = useTenant()
  const [data,     setData]     = useState<OverviewData | null>(null)
  const [loading,  setLoading]  = useState(true)
  const [nomEcole, setNomEcole] = useState('École')

  const MOIS = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc']

  const load = useCallback(async () => {
    if (!tenantId) return
    setLoading(true)

    const now        = new Date()
    const todayStr   = now.toISOString().slice(0, 10)
    const weekAgo    = new Date(now); weekAgo.setDate(now.getDate() - 6); weekAgo.setHours(0, 0, 0, 0)
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const eightAgo   = new Date(now.getFullYear(), now.getMonth() - 7, 1)

    const [
      etuTotal, etuActif, etuSusp, etuDip,
      ensTotal, ensEmpl, ensPres,
      empCount, staffCount,
      paieAll,
      recentPaieRes,
      depJourRes,
      sessRes,
      evtRes,
      tenantRes,
    ] = await Promise.all([
      supabase.from('etudiants').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId),
      supabase.from('etudiants').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId).eq('statut', 'actif'),
      supabase.from('etudiants').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId).eq('statut', 'suspendu'),
      supabase.from('etudiants').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId).eq('statut', 'diplome'),

      supabase.from('enseignants').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId).eq('statut', 'actif'),
      supabase.from('enseignants').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId).eq('statut', 'actif').eq('type_enseignant', 'employe'),
      supabase.from('enseignants').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId).eq('statut', 'actif').eq('type_enseignant', 'prestataire'),

      supabase.from('employes').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId).eq('statut', 'actif'),
      supabase.from('staff_ecole').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId).eq('statut', 'actif'),

      supabase.from('paiements_scolaires')
        .select('montant, created_at, statut, methode, libelle')
        .eq('tenant_id', tenantId)
        .gte('created_at', eightAgo.toISOString())
        .order('created_at', { ascending: false }),

      supabase.from('paiements_scolaires')
        .select('id, montant, methode, libelle, created_at')
        .eq('tenant_id', tenantId)
        .eq('statut', 'paye')
        .order('created_at', { ascending: false })
        .limit(6),

      supabase.from('journal_comptable')
        .select('montant_ttc')
        .eq('tenant_id', tenantId)
        .eq('type', 'depense')
        .eq('date', todayStr),

      supabase.from('sessions_ecole').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId).eq('statut', 'en_cours'),
      supabase.from('planning_ecole').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId).gte('date_debut', todayStr),
      supabase.from('tenants').select('nom_entreprise').eq('id', tenantId).maybeSingle(),
    ])

    if (tenantRes.data?.nom_entreprise) setNomEcole(tenantRes.data.nom_entreprise)

    const allRows  = paieAll.data ?? []
    const allPaid  = allRows.filter(p => p.statut === 'paye')
    const impayes  = allRows.filter(p => p.statut === 'en_attente')

    const todayPaid = allPaid.filter(p => p.created_at.slice(0, 10) === todayStr)
    const weekPaid  = allPaid.filter(p => new Date(p.created_at) >= weekAgo)
    const monthPaid = allPaid.filter(p => new Date(p.created_at) >= monthStart)

    const monthly: MonthData[] = []
    for (let i = 7; i >= 0; i--) {
      const d   = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 1)
      const mPaid = allPaid.filter(p => {
        const pd = new Date(p.created_at)
        return pd >= d && pd < end
      })
      monthly.push({
        month: MOIS[d.getMonth()],
        montant: mPaid.reduce((s, p) => s + Number(p.montant), 0),
      })
    }

    setData({
      nbEtudiants:      etuTotal.count    ?? 0,
      nbActifs:         etuActif.count    ?? 0,
      nbSuspendus:      etuSusp.count     ?? 0,
      nbDiplomes:       etuDip.count      ?? 0,
      nbEnseignants:    ensTotal.count    ?? 0,
      nbEnsEmployes:    ensEmpl.count     ?? 0,
      nbEnsPrestataires:ensPres.count     ?? 0,
      nbEmployes:       empCount.count    ?? 0,
      nbStaff:          staffCount.count  ?? 0,
      revenuJour:    todayPaid.reduce((s, p) => s + Number(p.montant), 0),
      revenuSemaine: weekPaid.reduce((s, p) => s + Number(p.montant), 0),
      revenuMois:    monthPaid.reduce((s, p) => s + Number(p.montant), 0),
      revenuAnnee:   allPaid.reduce((s, p) => s + Number(p.montant), 0),
      nbPaiementsJour:  todayPaid.length,
      nbPaiementsMois:  monthPaid.length,
      montantImpayes: impayes.reduce((s, p) => s + Number(p.montant), 0),
      nbImpayes:      impayes.length,
      depensesJour:   (depJourRes.data ?? []).reduce((s, d) => s + Number(d.montant_ttc), 0),
      sessionsEnCours: sessRes.count ?? 0,
      nbEvenements:    evtRes.count  ?? 0,
      monthly,
      recentPaie: (recentPaieRes.data ?? []) as OverviewData['recentPaie'],
    })
    setLoading(false)
  }, [tenantId]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { if (tenantId) load() }, [tenantId, load])

  if (tenantLoading || loading) return (
    <div className="flex items-center justify-center h-64 text-[#8B949E]">
      <Loader2 className="animate-spin mr-2" size={18} /> Chargement du tableau de bord…
    </div>
  )

  if (!data) return null

  const d = data
  const totalPersonnel = d.nbEnseignants + d.nbEmployes + d.nbStaff
  const tauxActifs = d.nbEtudiants > 0 ? Math.round((d.nbActifs / d.nbEtudiants) * 100) : 0
  const recoveryRate = (d.revenuMois + d.montantImpayes) > 0
    ? Math.round((d.revenuMois / (d.revenuMois + d.montantImpayes)) * 100)
    : 100

  // ── Module cards (10 modules, 5 per row) ──────────────────────────────────
  const modules: ModCard[] = [
    {
      icon: BarChart2,
      label: 'Direction Générale',
      value: `${fmt(d.revenuMois)} FCFA`,
      footer: 'Revenus du mois',
      delta: `+${d.nbPaiementsMois} paiements`,
      gradient: 'linear-gradient(135deg, #C2410C, #F97316)',
      href: '/dashboard/ecole/direction',
      badge: '+18%', badgeVariant: 'up',
    },
    {
      icon: Calculator,
      label: 'Comptabilité OHADA',
      value: 'Journal actif',
      footer: 'Clôture en cours',
      delta: 'OHADA',
      gradient: 'linear-gradient(135deg, #5B21B6, #8B5CF6)',
      href: '/dashboard/ecole/comptabilite',
      badge: 'OHADA', badgeVariant: 'neutral',
    },
    {
      icon: Wallet,
      label: 'Trésorerie',
      value: `${fmt(d.revenuSemaine)} FCFA`,
      footer: '7 derniers jours',
      delta: `${d.sessionsEnCours} sessions`,
      gradient: 'linear-gradient(135deg, #1E40AF, #3B82F6)',
      href: '/dashboard/ecole/tresorerie',
      badge: 'Actif', badgeVariant: 'up',
    },
    {
      icon: Users,
      label: 'RH & Paie',
      value: `${totalPersonnel} personnes`,
      footer: `${d.nbEmployes} emp · ${d.nbEnseignants} form`,
      delta: 'Clôture prévue',
      gradient: 'linear-gradient(135deg, #991B1B, #EF4444)',
      href: '/dashboard/ecole/rh',
      badge: 'Paie', badgeVariant: 'neutral',
    },
    {
      icon: GraduationCap,
      label: 'Scolarité',
      value: `${d.nbEtudiants} étudiants`,
      footer: `${d.nbActifs} actifs · ${d.nbSuspendus} susp`,
      delta: `+${d.nbDiplomes} diplômés`,
      gradient: 'linear-gradient(135deg, #065F46, #10B981)',
      href: '/dashboard/ecole/scolarite',
      badge: `${tauxActifs}%`, badgeVariant: 'up',
    },
    {
      icon: BookOpen,
      label: 'Formateurs',
      value: `${d.nbEnseignants} actifs`,
      footer: `${d.nbEnsEmployes} emp · ${d.nbEnsPrestataires} pres`,
      delta: 'Cours en cours',
      gradient: 'linear-gradient(135deg, #1E40AF, #3B82F6)',
      href: '/dashboard/ecole/espace-formateur',
      badge: 'DAAC', badgeVariant: 'neutral',
    },
    {
      icon: Layers,
      label: 'DAAC',
      value: `${d.sessionsEnCours} sessions`,
      footer: 'Sessions académiques',
      delta: 'Examens',
      gradient: 'linear-gradient(135deg, #C2410C, #F97316)',
      href: '/dashboard/ecole/daac',
      badge: 'Actif', badgeVariant: 'up',
    },
    {
      icon: Receipt,
      label: 'Dépenses',
      value: `${fmt(d.depensesJour)} FCFA`,
      footer: "Sorties aujourd'hui",
      delta: 'Journal',
      gradient: 'linear-gradient(135deg, #991B1B, #EF4444)',
      href: '/dashboard/ecole/tresorerie',
      badge: 'Jour', badgeVariant: d.depensesJour > 100000 ? 'down' : 'neutral',
    },
    {
      icon: Bot,
      label: 'MIAA+ Assistant',
      value: 'Actif · 24/7',
      footer: 'Assistant IA',
      delta: '→ Chat',
      gradient: 'linear-gradient(135deg, #065F46, #10B981)',
      href: '/dashboard/ecole/miaa',
      badge: 'IA', badgeVariant: 'up',
    },
    {
      icon: BarChart2,
      label: 'Rapports IA',
      value: 'Analytics',
      footer: 'Tableau de bord',
      delta: 'Auto',
      gradient: 'linear-gradient(135deg, #5B21B6, #8B5CF6)',
      href: '/dashboard/ecole/direction',
      badge: '+22%', badgeVariant: 'up',
    },
  ]

  return (
    <div className="flex flex-col gap-5 pb-10">

      {/* ── Hero Banner ─────────────────────────────────────────────────────── */}
      <motion.div {...fade(0)}
        className="relative rounded-2xl overflow-hidden border border-white/[0.07]"
        style={{ background: 'linear-gradient(120deg, #0F2D3C 0%, #0C3040 30%, #0A2535 60%, #081D2A 100%)' }}
      >
        <div className="absolute -top-16 -right-16 w-56 h-56 rounded-full pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(240,163,10,0.13) 0%, transparent 70%)' }} />
        <div className="absolute -bottom-10 left-48 w-44 h-44 rounded-full pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(16,185,129,0.07) 0%, transparent 70%)' }} />

        <div className="relative z-10 p-6 sm:p-8 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
          {/* Left */}
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <h1 className="text-2xl font-extrabold tracking-tight text-white">Bonjour, Admin 👋</h1>
              <button onClick={load} className="ml-2 p-1.5 rounded-lg border border-white/10 text-white/30 hover:text-white/60 hover:border-white/20 transition-all">
                <RefreshCw size={13} />
              </button>
            </div>
            <p className="text-sm text-white/55 leading-relaxed mb-5">
              Gérez votre établissement, vos équipes et vos finances en un seul endroit.<br />
              <strong className="text-white/75">{nomEcole}</strong> · Tableau de bord complet
            </p>
            <div className="flex flex-wrap gap-3">
              <Link href="/dashboard/ecole/scolarite"
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-black transition-all hover:opacity-90 active:scale-95"
                style={{ background: 'linear-gradient(135deg, #F0A30A, #D4880A)', boxShadow: '0 4px 16px rgba(240,163,10,0.3)' }}>
                <Plus size={14} /> Inscrire un étudiant
              </Link>
              <Link href="/dashboard/ecole/direction"
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-white border border-white/15 bg-white/[0.08] hover:bg-white/[0.14] transition-all">
                <BarChart2 size={14} /> Voir les rapports
              </Link>
            </div>
          </div>

          {/* Right: hero stats */}
          <div className="flex gap-3 flex-shrink-0 flex-wrap">
            {[
              { label: 'Total Personnel',  value: totalPersonnel,   color: 'text-white',       sub: 'Formateurs + Staff' },
              { label: 'Étudiants actifs', value: d.nbActifs,       color: 'text-[#F0A30A]',   sub: `${tauxActifs}% actifs` },
              { label: "Taux d'activité",  value: `${tauxActifs}%`, color: 'text-[#10B981]',   sub: 'Tous modules actifs' },
            ].map(s => (
              <div key={s.label} className="bg-white/[0.07] border border-white/10 rounded-2xl p-4 sm:p-5 text-center min-w-[120px] sm:min-w-[138px]">
                <p className="text-[9px] font-bold text-white/40 uppercase tracking-widest mb-2">{s.label}</p>
                <p className={`text-2xl sm:text-3xl font-black font-mono leading-none ${s.color}`}>{s.value}</p>
                <p className="text-[10px] text-white/40 mt-2">{s.sub}</p>
              </div>
            ))}
          </div>
        </div>
      </motion.div>

      {/* ── Module Grid ─────────────────────────────────────────────────────── */}
      <motion.div {...fade(1)}>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-extrabold text-[#E6EDF3] flex items-center gap-2.5">
            <div className="w-6 h-0.5 rounded-full" style={{ background: 'linear-gradient(90deg, #F0A30A, transparent)' }} />
            Mes Modules
          </h2>
          <Link href="/dashboard" className="text-xs text-[#F0A30A]/80 hover:text-[#F0A30A] font-semibold transition-colors">
            Voir tout →
          </Link>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-3">
          {modules.map((mod, i) => (
            <ModuleCard key={mod.label} mod={mod} i={i} />
          ))}
        </div>
      </motion.div>

      {/* ── Bottom Grid ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">

        {/* Left: chart + transactions */}
        <div className="xl:col-span-2 flex flex-col gap-4">

          {/* Area chart */}
          <motion.div {...fade(12)} className="border border-white/[0.07] rounded-2xl p-5" style={{ background: '#111827' }}>
            <div className="flex items-start justify-between mb-4 flex-wrap gap-3">
              <div>
                <p className="text-sm font-extrabold text-[#E6EDF3]">Analyse des Flux Financiers</p>
                <p className="text-[11px] text-[#8B949E] mt-0.5">Paiements scolaires — 8 derniers mois</p>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1.5 text-[11px] text-[#8B949E]">
                  <div className="w-2 h-2 rounded-full bg-[#F0A30A]" />
                  Revenus encaissés
                </div>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={190}>
              <AreaChart data={d.monthly} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="gOrange" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#F0A30A" stopOpacity={0.28} />
                    <stop offset="95%" stopColor="#F0A30A" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                <XAxis dataKey="month" tick={{ fill: '#484F58', fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#484F58', fontSize: 10 }} axisLine={false} tickLine={false} width={50}
                  tickFormatter={v => v >= 1000000 ? `${(v/1000000).toFixed(1)}M` : v >= 1000 ? `${(v/1000).toFixed(0)}k` : String(v)} />
                <Tooltip
                  contentStyle={{ background: '#161B22', border: '1px solid #21262D', borderRadius: 10, fontSize: 12 }}
                  labelStyle={{ color: '#8B949E' }}
                  formatter={(value) => [`${fmt(Number(value ?? 0))} FCFA`, 'Paiements']}
                />
                <Area type="monotone" dataKey="montant" stroke="#F0A30A" strokeWidth={2.5} fill="url(#gOrange)"
                  dot={false} activeDot={{ r: 4, fill: '#F0A30A', stroke: '#161B22', strokeWidth: 2 }} />
              </AreaChart>
            </ResponsiveContainer>
          </motion.div>

          {/* Transactions table */}
          <motion.div {...fade(13)} className="border border-white/[0.07] rounded-2xl overflow-hidden" style={{ background: '#111827' }}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
              <p className="text-sm font-extrabold text-[#E6EDF3]">Transactions Récentes</p>
              <Link href="/dashboard/ecole/direction" className="text-xs text-[#F0A30A]/80 hover:text-[#F0A30A] font-semibold transition-colors">
                Voir tout l'historique →
              </Link>
            </div>
            {d.recentPaie.length === 0 ? (
              <div className="py-10 text-center text-sm text-[#484F58]">Aucune transaction pour le moment.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-white/[0.04]" style={{ background: 'rgba(255,255,255,0.01)' }}>
                      {['Description', 'Date', 'Montant', 'Statut'].map(h => (
                        <th key={h} className="text-left px-4 py-2.5 text-[9.5px] font-bold text-[#484F58] uppercase tracking-wider">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {d.recentPaie.map(p => (
                      <tr key={p.id}
                        className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors cursor-pointer">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-lg bg-[#F0A30A]/10 flex items-center justify-center shrink-0">
                              <DollarSign size={13} className="text-[#F0A30A]" />
                            </div>
                            <div>
                              <p className="text-xs font-semibold text-[#E6EDF3] truncate max-w-[180px]">
                                {p.libelle || 'Paiement scolarité'}
                              </p>
                              <p className="text-[10px] text-[#8B949E] mt-0.5">Scolarité</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-[11px] text-[#8B949E] font-mono whitespace-nowrap">
                          {new Date(p.created_at).toLocaleDateString('fr-FR')}
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-[13px] font-bold text-[#10B981] font-mono">+{fmt(p.montant)} FCFA</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-[#10B981]/10 text-[#10B981]">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#10B981]" />
                            {p.methode?.replace(/_/g, ' ') ?? 'Espèces'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </motion.div>
        </div>

        {/* Right col */}
        <div className="flex flex-col gap-4">

          {/* Recouvrement goal */}
          <motion.div {...fade(14)}
            className="rounded-2xl p-5 border border-white/[0.08]"
            style={{ background: 'linear-gradient(135deg, #0F2D3C, #0A1F2E)' }}>
            <p className="text-[9px] font-bold text-white/30 uppercase tracking-widest mb-3">Objectif Recouvrement</p>
            <div className="flex items-baseline justify-between mb-2">
              <p className="text-4xl font-black tracking-tight text-white">{recoveryRate}%</p>
              <span className="text-[11px] font-bold" style={{
                color: recoveryRate >= 80 ? '#10B981' : recoveryRate >= 50 ? '#F59E0B' : '#EF4444'
              }}>
                {recoveryRate >= 80 ? '✓ En bonne voie' : recoveryRate >= 50 ? '⚠ À surveiller' : '✗ Retard'}
              </span>
            </div>
            <div className="h-1.5 rounded-full overflow-hidden mb-3" style={{ background: 'rgba(255,255,255,0.07)' }}>
              <div className="h-full rounded-full transition-all duration-700" style={{
                width: `${recoveryRate}%`,
                background: recoveryRate >= 80
                  ? 'linear-gradient(90deg, #10B981, #34D399)'
                  : recoveryRate >= 50
                  ? 'linear-gradient(90deg, #F59E0B, #FBBF24)'
                  : 'linear-gradient(90deg, #EF4444, #F87171)',
                boxShadow: `0 0 10px ${recoveryRate >= 80 ? 'rgba(16,185,129,0.45)' : 'rgba(245,158,11,0.45)'}`,
              }} />
            </div>
            <p className="text-[11px] text-white/35 leading-relaxed">
              {d.montantImpayes > 0
                ? <><strong className="text-white/60">{fmt(d.montantImpayes)} FCFA</strong> d&apos;impayés sur {d.nbImpayes} dossier{d.nbImpayes !== 1 ? 's' : ''}.</>
                : <><strong className="text-white/60">Aucun impayé</strong> en attente — excellent !</>
              }
            </p>
          </motion.div>

          {/* Quick access */}
          <motion.div {...fade(15)} className="border border-white/[0.07] rounded-2xl p-4" style={{ background: '#111827' }}>
            <p className="text-sm font-extrabold text-[#E6EDF3] mb-3">Accès Rapide</p>
            <div className="grid grid-cols-2 gap-2.5">
              {[
                { label: 'Inscrire étudiant',  href: '/dashboard/ecole/scolarite',     color: '#10B981', icon: GraduationCap },
                { label: 'Ajouter formateur',  href: '/dashboard/ecole/rh',            color: '#F0A30A', icon: BookOpen      },
                { label: 'Saisie comptable',   href: '/dashboard/ecole/comptabilite',  color: '#8B5CF6', icon: Calculator    },
                { label: 'Générer rapport',    href: '/dashboard/ecole/direction',     color: '#EF4444', icon: BarChart2     },
              ].map(({ label, href, color, icon: Icon }) => (
                <Link key={href} href={href}
                  className="flex flex-col items-center gap-2 p-3 rounded-xl border border-white/[0.07] bg-white/[0.03] hover:bg-white/[0.08] hover:border-white/15 transition-all group text-center">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: `${color}18` }}>
                    <Icon size={16} style={{ color }} />
                  </div>
                  <span className="text-[11px] font-semibold text-[#8B949E] group-hover:text-[#E6EDF3] transition-colors leading-tight">{label}</span>
                </Link>
              ))}
            </div>
          </motion.div>

          {/* Alert: impayés */}
          {d.nbImpayes > 0 && (
            <motion.div {...fade(16)}
              className="rounded-2xl p-4 flex gap-3 items-start border border-[#F59E0B]/20"
              style={{ background: 'rgba(245,158,11,0.08)' }}>
              <AlertTriangle size={17} className="text-[#F59E0B] shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-bold text-[#E6EDF3]">Impayés en attente</p>
                <p className="text-[11px] text-white/45 mt-1 leading-relaxed">
                  {d.nbImpayes} dossier{d.nbImpayes !== 1 ? 's' : ''} — {fmt(d.montantImpayes)} FCFA à recouvrer.{' '}
                  <Link href="/dashboard/ecole/scolarite" className="text-[#F0A30A] hover:underline">Voir →</Link>
                </p>
              </div>
            </motion.div>
          )}

          {/* Alert: sessions actives */}
          {d.sessionsEnCours > 0 && (
            <motion.div {...fade(17)}
              className="rounded-2xl p-4 flex gap-3 items-start border border-[#3B82F6]/20"
              style={{ background: 'rgba(59,130,246,0.08)' }}>
              <BookOpen size={17} className="text-[#3B82F6] shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-bold text-[#E6EDF3]">Sessions en cours</p>
                <p className="text-[11px] text-white/45 mt-1 leading-relaxed">
                  {d.sessionsEnCours} session{d.sessionsEnCours !== 1 ? 's' : ''} académique{d.sessionsEnCours !== 1 ? 's' : ''} actuellement active{d.sessionsEnCours !== 1 ? 's' : ''}.
                </p>
              </div>
            </motion.div>
          )}

          {/* MIAA+ promo */}
          <motion.div {...fade(18)}
            className="relative rounded-2xl p-5 overflow-hidden border border-white/10"
            style={{ background: 'linear-gradient(135deg, #4C1D95, #6D28D9, #7C3AED)' }}>
            <div className="absolute -top-8 -right-8 w-28 h-28 rounded-full bg-white/[0.08] pointer-events-none" />
            <div className="relative z-10">
              <p className="text-xl mb-1.5">✨</p>
              <p className="text-sm font-extrabold text-white mb-1.5">Nouveauté MIAA+</p>
              <p className="text-[11.5px] text-white/70 leading-relaxed mb-4">
                Votre assistant IA peut maintenant générer automatiquement les bulletins de paie et les rapports OHADA en un clic.
              </p>
              <Link href="/dashboard/ecole/miaa"
                className="block w-full py-2.5 rounded-xl text-[12.5px] font-extrabold text-center transition-all hover:brightness-95 active:scale-95"
                style={{ background: 'rgba(255,255,255,0.9)', color: '#4C1D95' }}>
                Activer MIAA+ →
              </Link>
            </div>
          </motion.div>

        </div>
      </div>
    </div>
  )
}

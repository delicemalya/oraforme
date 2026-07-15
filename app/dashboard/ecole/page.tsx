'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { motion } from 'framer-motion'
import {
  Users, GraduationCap, BookOpen, BarChart2, Bell,
  Calendar, ChevronRight, Plus, RefreshCw, Loader2,
  ClipboardList, DollarSign, FileText, Settings,
  UserPlus, UserCheck, Clock, Award, AlertCircle,
  TrendingUp, Megaphone, Send, Download, List,
} from 'lucide-react'
import Link from 'next/link'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, LineChart, Line, Legend,
} from 'recharts'
import { supabase } from '@/lib/supabase'
import { useTenant } from '@/lib/hooks/useTenant'

// ── Exported types (consumed by ecole-dashboard-client.tsx) ─────────────────

export type EcoleRole =
  | 'DIRECTION_GENERALE'
  | 'RAF'
  | 'SCOLARITE'
  | 'RH_PAIE'
  | 'FORMATEUR'
  | 'ETUDIANT'
  | 'PARENT'
  | 'DTI'
  | 'DAAC'

export type EcoleKpis = {
  nbEtudiants: number
  nbActifs: number
  nbAbsencesJour: number
  nbExamensAvenir: number
  nbEnseignants: number
  nbEmployes: number
  nbHeurePending: number
  nbNotifs: number
  revenuMois: number
  montantImpayes: number
  nbPaiementsEnAttente: number
  soldeTresorerie: number
  myHeuresTotales: number
  myHeuresValidees: number
  myNotesMoyenne: number | null
  myAbsences: number
  myPaiementOk: boolean | null
}

// ── Types ─────────────────────────────────────────────────────────────────────

type NiveauCount = { niveau: string; count: number; color: string }

type TopEleve = {
  etudiant_id: string
  nom: string
  prenom: string
  classe: string | null
  photo_url: string | null
  moyenne: number
  rang: number
}

type NotifRecente = {
  id: string
  title: string
  message: string
  type: string
  created_at: string
  read: boolean
}

type PlanningEvent = {
  id: string
  titre: string
  date_debut: string
  date_fin: string | null
  type: string
}

type MonthStat = {
  month: string
  paiements: number
  moyenne: number
  taux: number
}

type DashData = {
  nbElevesPrimaire: number
  nbElevesCollege: number
  nbElevesLycee: number
  nbElevesAutre: number
  nbElevesTotal: number
  nbElevesActifs: number
  nbEnseignants: number
  nbClasses: number
  tauxPresence: number
  nbAbsencesToday: number
  paiementsMois: number
  nbPaiementsMois: number
  niveaux: NiveauCount[]
  topEleves: TopEleve[]
  notifications: NotifRecente[]
  planningToday: PlanningEvent[]
  planningNext: PlanningEvent[]
  monthlyStats: MonthStat[]
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(n: number) {
  if (n >= 1_000_000) return new Intl.NumberFormat('fr-FR').format(Math.round(n / 1000)) + ' k'
  if (n >= 1_000) return new Intl.NumberFormat('fr-FR').format(Math.round(n))
  return String(Math.round(n))
}

function fmtBig(n: number) {
  return new Intl.NumberFormat('fr-FR').format(Math.round(n))
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins  = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days  = Math.floor(diff / 86400000)
  if (mins < 1) return 'à l\'instant'
  if (mins < 60) return `il y a ${mins} min`
  if (hours < 24) return `il y a ${hours}h`
  return `il y a ${days}j`
}

const NIVEAU_COLORS: Record<string, string> = {
  primaire:  '#7C3AED',
  college:   '#2563EB',
  lycee:     '#F59E0B',
  licence:   '#10B981',
  master:    '#EF4444',
  doctorat:  '#EC4899',
  autre:     '#94A3B8',
}

const NIVEAU_LABELS: Record<string, string> = {
  primaire: 'Primaire', college: 'Collège', lycee: 'Lycée',
  licence: 'Licence', master: 'Master', doctorat: 'Doctorat',
}

const TYPE_NOTIF_ICON: Record<string, { icon: React.ElementType; color: string }> = {
  paiement:    { icon: DollarSign, color: '#F59E0B' },
  inscription: { icon: UserPlus,   color: '#10B981' },
  absence:     { icon: AlertCircle, color: '#EF4444' },
  reunion:     { icon: Users,       color: '#2563EB' },
  default:     { icon: Bell,        color: '#7C3AED' },
}

const MOIS_COURT = ['Sep', 'Oct', 'Nov', 'Déc', 'Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun']

// ── DonutChart ─────────────────────────────────────────────────────────────────

function DonutChart({ niveaux, total }: { niveaux: NiveauCount[]; total: number }) {
  const size   = 160
  const cx     = size / 2
  const cy     = size / 2
  const radius = 58
  const innerR = 36

  let cumAngle = -Math.PI / 2

  const arcs = niveaux.map(nv => {
    const angle    = total > 0 ? (nv.count / total) * 2 * Math.PI : 0
    const startA   = cumAngle
    const endA     = cumAngle + angle
    cumAngle       = endA
    const x1 = cx + radius * Math.cos(startA)
    const y1 = cy + radius * Math.sin(startA)
    const x2 = cx + radius * Math.cos(endA)
    const y2 = cy + radius * Math.sin(endA)
    const ix1 = cx + innerR * Math.cos(startA)
    const iy1 = cy + innerR * Math.sin(startA)
    const ix2 = cx + innerR * Math.cos(endA)
    const iy2 = cy + innerR * Math.sin(endA)
    const large = angle > Math.PI ? 1 : 0
    const d = `M ${x1} ${y1} A ${radius} ${radius} 0 ${large} 1 ${x2} ${y2} L ${ix2} ${iy2} A ${innerR} ${innerR} 0 ${large} 0 ${ix1} ${iy1} Z`
    return { ...nv, d, angle }
  })

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ flexShrink: 0 }}>
      {total === 0 ? (
        <circle cx={cx} cy={cy} r={radius} fill="var(--border)" />
      ) : (
        arcs.map((arc, i) => (
          <path key={i} d={arc.d} fill={arc.color} />
        ))
      )}
      <circle cx={cx} cy={cy} r={innerR - 2} fill="var(--card-bg)" />
      <text x={cx} y={cy - 6} textAnchor="middle" fill="var(--text-primary)"
        fontSize="18" fontWeight="700">{fmtBig(total)}</text>
      <text x={cx} y={cy + 10} textAnchor="middle" fill="var(--text-secondary)"
        fontSize="9" fontWeight="600">Total</text>
    </svg>
  )
}

// ── EventTypeBadge ─────────────────────────────────────────────────────────────

function EventBadge({ type }: { type: string }) {
  const cfg: Record<string, { label: string; bg: string; color: string }> = {
    examen:         { label: 'Examen',    bg: '#FEF3C7', color: '#D97706' },
    conge_scolaire: { label: 'Congé',     bg: '#DBEAFE', color: '#1D4ED8' },
    evenement:      { label: 'Événement', bg: '#F3E8FF', color: '#7C3AED' },
    conseil:        { label: 'Conseil',   bg: '#D1FAE5', color: '#065F46' },
    autre:          { label: 'Autre',     bg: '#F1F5F9', color: '#475569' },
  }
  const c = cfg[type] ?? cfg.autre
  return (
    <span style={{
      fontSize: '.65rem', fontWeight: 700, padding: '.2em .55em',
      borderRadius: 4, background: c.bg, color: c.color,
    }}>{c.label}</span>
  )
}

// ── CalendarDate ───────────────────────────────────────────────────────────────

function CalDate({ dateStr }: { dateStr: string }) {
  const d = new Date(dateStr)
  const jours = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam']
  const mois  = ['JAN', 'FÉV', 'MAR', 'AVR', 'MAI', 'JUN', 'JUL', 'AOÛ', 'SEP', 'OCT', 'NOV', 'DÉC']
  return (
    <div style={{
      width: 44, height: 48, borderRadius: 8, overflow: 'hidden',
      flexShrink: 0, display: 'flex', flexDirection: 'column',
      border: '1px solid var(--border)',
    }}>
      <div style={{ background: '#2563EB', padding: '3px 0', textAlign: 'center', fontSize: '.6rem', fontWeight: 700, color: '#FFFFFF', letterSpacing: '.04em' }}>
        {mois[d.getMonth()]}
      </div>
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--surface2)' }}>
        <span style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text)', lineHeight: 1 }}>{d.getDate()}</span>
      </div>
    </div>
  )
}

// ── KPI Card ───────────────────────────────────────────────────────────────────

function KpiCard({ icon: Icon, label, value, sub, trend, color, href }: {
  icon: React.ElementType; label: string; value: string; sub: string
  trend?: string; color: string; href?: string
}) {
  const inner = (
    <div style={{
      background: 'var(--card-bg)', border: '1px solid var(--border)',
      borderRadius: 10, padding: '1rem 1.25rem', height: '100%',
      display: 'flex', flexDirection: 'column', gap: '.5rem',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: '.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.07em', color: 'var(--text-secondary)' }}>
          {label}
        </span>
        <div style={{ width: 34, height: 34, borderRadius: 8, background: `${color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon size={17} color={color} />
        </div>
      </div>
      <div>
        <div style={{ fontSize: '1.9rem', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>{value}</div>
        {trend && (
          <div style={{ fontSize: '.72rem', color: '#059669', fontWeight: 600, marginTop: '.15rem' }}>{trend}</div>
        )}
        <div style={{ fontSize: '.72rem', color: 'var(--text-secondary)', marginTop: '.1rem' }}>{sub}</div>
      </div>
    </div>
  )
  return href ? <Link href={href} style={{ display: 'block', height: '100%' }}>{inner}</Link> : inner
}

// ── Quick Access Item ──────────────────────────────────────────────────────────

function QuickItem({ icon: Icon, label, href, color }: {
  icon: React.ElementType; label: string; href: string; color: string
}) {
  return (
    <Link href={href} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '.5rem', textDecoration: 'none' }}>
      <div style={{
        width: 52, height: 52, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: `${color}15`, border: `1.5px solid ${color}30`,
        transition: 'transform .15s',
      }}
        onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-2px)'}
        onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.transform = 'none'}
      >
        <Icon size={22} color={color} />
      </div>
      <span style={{ fontSize: '.7rem', fontWeight: 600, color: 'var(--text-secondary)', textAlign: 'center', lineHeight: 1.3, maxWidth: 64 }}>{label}</span>
    </Link>
  )
}

// ── Soustype config ────────────────────────────────────────────────────────────

type SousType = 'garderie' | 'primaire' | 'college' | 'lycee' | 'universite'

const SOUSTYPE_CFG: Record<SousType, {
  label: string; badge: string; eleveLabel: string; niveaux: string[]
}> = {
  garderie:   { label: 'Garderie & Crèche',  badge: 'Petite enfance',          eleveLabel: 'Enfants',   niveaux: ['primaire'] },
  primaire:   { label: 'École Primaire',      badge: 'Enseignement primaire',   eleveLabel: 'Élèves',   niveaux: ['primaire'] },
  college:    { label: 'Collège',             badge: 'Enseignement secondaire', eleveLabel: 'Élèves',   niveaux: ['college'] },
  lycee:      { label: 'Lycée',               badge: 'Enseignement secondaire', eleveLabel: 'Élèves',   niveaux: ['lycee'] },
  universite: { label: 'Université',          badge: 'Enseignement supérieur',  eleveLabel: 'Étudiants', niveaux: ['licence', 'master', 'doctorat'] },
}

// ── Main Page ──────────────────────────────────────────────────────────────────

export default function EcoleOverviewPage() {
  const { tenantId, prenom, nomEntreprise, sousType } = useTenant()

  const stCfg = SOUSTYPE_CFG[(sousType as SousType) ?? 'primaire'] ?? SOUSTYPE_CFG.primaire

  const [data,    setData]    = useState<DashData | null>(null)
  const [loading, setLoading] = useState(false)
  // Guard: prevent duplicate concurrent calls to load() (TenantContext fires
  // setTenant() twice on fresh login: once from getUser() and once from
  // onAuthStateChange(SIGNED_IN)). Without this, load() races itself and the
  // page re-mounts its content tree, replaying framer-motion animations.
  const loadingRef = useRef(false)
  const [anneeScolaire, setAnneeScolaire] = useState(() => {
    const y = new Date().getFullYear()
    return `${y - 1}-${y}`
  })

  const ANNEES = useMemo(() => {
    const y = new Date().getFullYear()
    return Array.from({ length: 4 }, (_, i) => `${y - 2 + i}-${y - 1 + i}`)
  }, [])

  const load = useCallback(async () => {
    if (!tenantId) return
    if (loadingRef.current) return
    loadingRef.current = true
    setLoading(true)
    try {
      const today      = new Date().toISOString().slice(0, 10)
      const now        = new Date()
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

      const [
        etudiantsRes, etudiantsActifsRes,
        enseignantsRes, classesRes,
        absencesTodayRes,
        paiementsRes,
        notesRes, etudiantsNomRes,
        notifsRes,
        planningTodayRes, planningNextRes,
        notesMonthlyRes,
      ] = await Promise.all([
        // Students with level
        supabase.from('etudiants').select('id, niveau').eq('tenant_id', tenantId),
        supabase.from('etudiants').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId).eq('statut', 'actif'),
        // Teachers
        supabase.from('enseignants').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId).eq('statut', 'actif'),
        // Classes
        supabase.from('classes_ecole').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId),
        // Absences today (for presence rate)
        supabase.from('absences_etudiants').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId).eq('date_absence', today),
        // Payments this month
        supabase.from('paiements_scolaires').select('montant, created_at, statut').eq('tenant_id', tenantId).gte('created_at', monthStart),
        // Notes for top students
        supabase.from('notes_etudiants').select('etudiant_id, note, note_max, coefficient').eq('tenant_id', tenantId).eq('annee_scolaire', anneeScolaire).limit(500),
        // Students names for ranking
        supabase.from('etudiants').select('id, nom, prenom, classe, photo_url').eq('tenant_id', tenantId).eq('statut', 'actif').limit(200),
        // Notifications
        supabase.from('notifications').select('id, title, message, type, created_at, read').eq('tenant_id', tenantId).order('created_at', { ascending: false }).limit(6),
        // Today's planning
        supabase.from('planning_ecole').select('id, titre, date_debut, date_fin, type').eq('tenant_id', tenantId).eq('date_debut', today).order('date_debut').limit(6),
        // Upcoming events
        supabase.from('planning_ecole').select('id, titre, date_debut, date_fin, type').eq('tenant_id', tenantId).gt('date_debut', today).order('date_debut').limit(5),
        // Monthly notes for academic stats
        supabase.from('notes_etudiants').select('note, note_max, created_at').eq('tenant_id', tenantId).gte('created_at', new Date(now.getFullYear(), now.getMonth() - 9, 1).toISOString()).limit(1000),
      ])

      const allEtudiants = etudiantsRes.data ?? []
      const nbElevesTotal    = allEtudiants.length
      const nbElevesActifs   = etudiantsActifsRes.count ?? 0

      // Level counts
      const niveauMap: Record<string, number> = {}
      for (const e of allEtudiants) {
        const niv = e.niveau ?? 'autre'
        niveauMap[niv] = (niveauMap[niv] ?? 0) + 1
      }
      const niveauxArr: NiveauCount[] = Object.entries(niveauMap)
        .map(([niveau, count]) => ({ niveau, count, color: NIVEAU_COLORS[niveau] ?? '#94A3B8' }))
        .sort((a, b) => b.count - a.count)

      // Presence rate
      const absToday   = absencesTodayRes.count ?? 0
      const tauxPresence = nbElevesTotal > 0
        ? Math.max(0, Math.round(100 - (absToday / nbElevesTotal) * 100))
        : 100

      // Payments
      const paiements = (paiementsRes.data ?? []).filter(p => p.statut === 'paye')
      const paiementsMois = paiements.reduce((s, p) => s + Number(p.montant), 0)

      // Top students
      const notes = notesRes.data ?? []
      const etuNames = etudiantsNomRes.data ?? []
      const etuMap: Record<string, { nom: string; prenom: string; classe: string | null; photo_url: string | null }> = {}
      for (const e of etuNames) etuMap[e.id] = { nom: e.nom, prenom: e.prenom, classe: e.classe, photo_url: e.photo_url }

      const moyennesMap: Record<string, { sum: number; coefSum: number }> = {}
      for (const n of notes) {
        if (!n.etudiant_id || !n.note_max || Number(n.note_max) === 0) continue
        const score = (Number(n.note) / Number(n.note_max)) * 20 * (Number(n.coefficient) || 1)
        const coef  = Number(n.coefficient) || 1
        if (!moyennesMap[n.etudiant_id]) moyennesMap[n.etudiant_id] = { sum: 0, coefSum: 0 }
        moyennesMap[n.etudiant_id].sum     += score
        moyennesMap[n.etudiant_id].coefSum += coef
      }

      const topEleves: TopEleve[] = Object.entries(moyennesMap)
        .map(([id, { sum, coefSum }]) => ({
          etudiant_id: id,
          ...(etuMap[id] ?? { nom: 'Inconnu', prenom: '', classe: null, photo_url: null }),
          moyenne: coefSum > 0 ? Math.round((sum / coefSum) * 100) / 100 : 0,
          rang: 0,
        }))
        .sort((a, b) => b.moyenne - a.moyenne)
        .slice(0, 5)
        .map((e, i) => ({ ...e, rang: i + 1 }))

      // Monthly stats
      const monthlyNotes = notesMonthlyRes.data ?? []
      const allPaie      = paiementsRes.data ?? []

      const monthStats: MonthStat[] = MOIS_COURT.map((month, i) => {
        const d   = new Date(now.getFullYear() - (i > now.getMonth() + 2 ? 1 : 0), (now.getMonth() - 9 + i + 12) % 12, 1)
        const end = new Date(d.getFullYear(), d.getMonth() + 1, 1)
        const mNotes = monthlyNotes.filter(n => {
          const nd = new Date(n.created_at)
          return nd >= d && nd < end && n.note_max && Number(n.note_max) > 0
        })
        const mPaie = allPaie.filter(p => {
          const pd = new Date(p.created_at)
          return pd >= d && pd < end && p.statut === 'paye'
        })
        const moy = mNotes.length > 0
          ? mNotes.reduce((s, n) => s + (Number(n.note) / Number(n.note_max)) * 20, 0) / mNotes.length
          : 0
        return {
          month,
          paiements: mPaie.reduce((s, p) => s + Number(p.montant), 0),
          moyenne: Math.round(moy * 100) / 100,
          taux: Math.min(100, Math.round(moy * 5)),
        }
      })

      setData({
        nbElevesTotal, nbElevesActifs,
        nbElevesPrimaire: niveauMap.primaire ?? 0,
        nbElevesCollege:  niveauMap.college  ?? 0,
        nbElevesLycee:    niveauMap.lycee    ?? 0,
        nbElevesAutre:    niveauMap.autre    ?? 0,
        nbEnseignants:    enseignantsRes.count ?? 0,
        nbClasses:        classesRes.count    ?? 0,
        tauxPresence,
        nbAbsencesToday:  absToday,
        paiementsMois,
        nbPaiementsMois: paiements.length,
        niveaux: niveauxArr,
        topEleves,
        notifications: (notifsRes.data ?? []) as NotifRecente[],
        planningToday: (planningTodayRes.data ?? []) as PlanningEvent[],
        planningNext:  (planningNextRes.data  ?? []) as PlanningEvent[],
        monthlyStats: monthStats,
      })
    } catch (err) {
      console.error('[ecole dashboard]', err)
      setData({
        nbElevesTotal: 0, nbElevesActifs: 0,
        nbElevesPrimaire: 0, nbElevesCollege: 0, nbElevesLycee: 0, nbElevesAutre: 0,
        nbEnseignants: 0, nbClasses: 0,
        tauxPresence: 100, nbAbsencesToday: 0,
        paiementsMois: 0, nbPaiementsMois: 0,
        niveaux: [], topEleves: [], notifications: [],
        planningToday: [], planningNext: [], monthlyStats: [],
      })
    } finally {
      setLoading(false)
      loadingRef.current = false
    }
  }, [tenantId, anneeScolaire])

  useEffect(() => { if (tenantId) load() }, [tenantId, load])

  const displayName = prenom ?? nomEntreprise ?? 'Administrateur'

  // Show spinner only until the first data fetch completes.
  // data is set in both the success path and the catch block of load(), so
  // it is never null after the first call finishes — even for a brand-new
  // account with zero rows in the DB. This avoids the spinner↔content toggle
  // that causes framer-motion animations to replay on every TenantContext
  // re-render (the C-003 flash pattern, now also affecting école).
  if (data === null) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 240, color: 'var(--text-secondary)', gap: 8, fontSize: '.9rem' }}>
      <Loader2 size={18} className="animate-spin" /> Chargement…
    </div>
  )

  const d = data

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', paddingBottom: '2.5rem' }}>

      {/* ── Row 0 : Greeting + controls ─────────────────────────────────────── */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .3 }}
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '.5rem' }}>
            Bonjour {displayName} 👋
          </h1>
          <p style={{ fontSize: '.82rem', color: 'var(--text-secondary)', marginTop: '.2rem' }}>
            Voici ce qui se passe dans votre établissement aujourd&apos;hui.
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '.75rem', flexWrap: 'wrap' }}>
          {/* Year selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '.5rem', background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 8, padding: '.45rem .85rem', fontSize: '.8rem', color: 'var(--text-secondary)' }}>
            <Calendar size={14} />
            <select
              value={anneeScolaire}
              onChange={e => setAnneeScolaire(e.target.value)}
              style={{ background: 'transparent', border: 'none', outline: 'none', fontSize: '.8rem', color: 'var(--text-primary)', fontWeight: 600, cursor: 'pointer' }}>
              {ANNEES.map(a => <option key={a} value={a}>Année scolaire {a}</option>)}
            </select>
          </div>
          {/* Refresh */}
          <button onClick={load} title="Actualiser" style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 8, padding: '.45rem .7rem', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center' }}>
            <RefreshCw size={15} />
          </button>
          {/* Rapport rapide */}
          <Link href="/dashboard/ecole/direction" style={{ display: 'flex', alignItems: 'center', gap: '.5rem', background: '#2563EB', color: '#FFFFFF', borderRadius: 8, padding: '.5rem 1.1rem', fontSize: '.8rem', fontWeight: 700, textDecoration: 'none' }}>
            <FileText size={14} /> Rapport rapide
          </Link>
        </div>
      </motion.div>

      {/* ── Row 1 : KPI cards ───────────────────────────────────────────────── */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .3, delay: .05 }}
        style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '.9rem' }}
        className="kpi-grid-ecole">
        <KpiCard icon={GraduationCap} label={stCfg.eleveLabel + ' inscrits'}
          value={fmtBig(d.nbElevesTotal)}
          trend={d.nbElevesActifs > 0 ? `+${d.nbElevesActifs} actifs ce mois` : undefined}
          sub={`${d.nbElevesActifs} actifs`}
          color="#7C3AED" href="/dashboard/ecole/scolarite" />
        <KpiCard icon={Users} label="Enseignants"
          value={fmtBig(d.nbEnseignants)}
          sub="Corps enseignant actif"
          color="#2563EB" href="/dashboard/ecole/rh" />
        <KpiCard icon={BookOpen} label="Classes"
          value={fmtBig(d.nbClasses)}
          sub={`Année ${anneeScolaire}`}
          color="#10B981" href="/dashboard/ecole/scolarite" />
        <KpiCard icon={BarChart2} label="Taux de présence"
          value={`${d.tauxPresence}%`}
          trend={d.nbAbsencesToday > 0 ? `${d.nbAbsencesToday} absence(s) aujourd'hui` : undefined}
          sub="Aujourd'hui"
          color="#F59E0B" href="/dashboard/ecole/scolarite" />
        <KpiCard icon={DollarSign} label="Paiements reçus"
          value={`${fmtBig(d.paiementsMois)} FCFA`}
          trend={d.nbPaiementsMois > 0 ? `+${d.nbPaiementsMois} ce mois` : undefined}
          sub="Ce mois"
          color="#EF4444" href="/dashboard/ecole/comptabilite" />
      </motion.div>

      {/* ── Row 2 : Emploi du temps / Notifications / Répartition ───────────── */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .3, delay: .1 }}
        style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 280px', gap: '.9rem' }}
        className="row2-ecole">

        {/* Emploi du temps */}
        <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '.85rem 1.1rem', borderBottom: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '.6rem' }}>
              <Clock size={15} color="#2563EB" />
              <span style={{ fontSize: '.85rem', fontWeight: 700, color: 'var(--text-primary)' }}>EMPLOI DU TEMPS - AUJOURD&apos;HUI</span>
            </div>
            <Link href="/dashboard/ecole/scolarite" style={{ fontSize: '.72rem', color: '#2563EB', fontWeight: 600, textDecoration: 'none' }}>Voir tout</Link>
          </div>
          <div style={{ padding: '.5rem 0' }}>
            {d.planningToday.length === 0 ? (
              <div style={{ padding: '2rem 1.1rem', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '.82rem' }}>
                <Calendar size={24} style={{ margin: '0 auto .5rem', opacity: .4 }} />
                Aucun événement planifié aujourd&apos;hui
              </div>
            ) : (
              d.planningToday.map(evt => (
                <div key={evt.id} style={{ display: 'flex', alignItems: 'center', gap: '.75rem', padding: '.65rem 1.1rem', borderBottom: '1px solid var(--border)' }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#2563EB', flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '.82rem', fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{evt.titre}</div>
                    <div style={{ fontSize: '.7rem', color: 'var(--text-secondary)' }}>
                      {new Date(evt.date_debut).toLocaleDateString('fr-FR')}
                      {evt.date_fin ? ` → ${new Date(evt.date_fin).toLocaleDateString('fr-FR')}` : ''}
                    </div>
                  </div>
                  <EventBadge type={evt.type} />
                </div>
              ))
            )}
          </div>
        </div>

        {/* Notifications récentes */}
        <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '.85rem 1.1rem', borderBottom: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '.6rem' }}>
              <Bell size={15} color="#F59E0B" />
              <span style={{ fontSize: '.85rem', fontWeight: 700, color: 'var(--text-primary)' }}>NOTIFICATIONS RÉCENTES</span>
            </div>
            <Link href="/dashboard/ecole/direction" style={{ fontSize: '.72rem', color: '#2563EB', fontWeight: 600, textDecoration: 'none' }}>Voir tout</Link>
          </div>
          <div style={{ padding: '.5rem 0' }}>
            {d.notifications.length === 0 ? (
              <div style={{ padding: '2rem 1.1rem', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '.82rem' }}>
                <Bell size={24} style={{ margin: '0 auto .5rem', opacity: .4 }} />
                Aucune notification récente
              </div>
            ) : (
              d.notifications.map(notif => {
                const cfg = TYPE_NOTIF_ICON[notif.type] ?? TYPE_NOTIF_ICON.default
                const NIcon = cfg.icon
                return (
                  <div key={notif.id} style={{ display: 'flex', alignItems: 'flex-start', gap: '.75rem', padding: '.65rem 1.1rem', borderBottom: '1px solid var(--border)', opacity: notif.read ? .7 : 1 }}>
                    <div style={{ width: 30, height: 30, borderRadius: 8, background: `${cfg.color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: '.1rem' }}>
                      <NIcon size={14} color={cfg.color} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '.8rem', fontWeight: 600, color: 'var(--text-primary)' }}>{notif.title || notif.message}</div>
                      {notif.title && <div style={{ fontSize: '.72rem', color: 'var(--text-secondary)', marginTop: '.1rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{notif.message}</div>}
                    </div>
                    <div style={{ fontSize: '.65rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap', flexShrink: 0 }}>{timeAgo(notif.created_at)}</div>
                  </div>
                )
              })
            )}
          </div>
        </div>

        {/* Répartition par niveau */}
        <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '.85rem 1.1rem', borderBottom: '1px solid var(--border)' }}>
            <span style={{ fontSize: '.85rem', fontWeight: 700, color: 'var(--text-primary)' }}>RÉPARTITION PAR NIVEAU</span>
            <Link href="/dashboard/ecole/scolarite" style={{ fontSize: '.72rem', color: '#2563EB', fontWeight: 600, textDecoration: 'none' }}>Voir tout</Link>
          </div>
          <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
            <DonutChart niveaux={d.niveaux} total={d.nbElevesTotal} />
            <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '.4rem' }}>
              {d.niveaux.slice(0, 4).map(nv => (
                <div key={nv.niveau} style={{ display: 'flex', alignItems: 'center', gap: '.6rem' }}>
                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: nv.color, flexShrink: 0 }} />
                  <span style={{ fontSize: '.75rem', color: 'var(--text-secondary)', flex: 1 }}>{NIVEAU_LABELS[nv.niveau] ?? nv.niveau}</span>
                  <span style={{ fontSize: '.75rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                    {fmtBig(nv.count)} <span style={{ fontWeight: 400, color: 'var(--text-secondary)' }}>({d.nbElevesTotal > 0 ? Math.round(nv.count / d.nbElevesTotal * 100) : 0}%)</span>
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </motion.div>

      {/* ── Row 3 : Top élèves / Stats académiques / Paiements vs prévisions ── */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .3, delay: .15 }}
        style={{ display: 'grid', gridTemplateColumns: '240px 1fr 1fr', gap: '.9rem' }}
        className="row3-ecole">

        {/* Meilleurs élèves */}
        <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '.85rem 1.1rem', borderBottom: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '.6rem' }}>
              <Award size={15} color="#F59E0B" />
              <span style={{ fontSize: '.85rem', fontWeight: 700, color: 'var(--text-primary)' }}>MEILLEURS ÉLÈVES</span>
            </div>
            <Link href="/dashboard/ecole/scolarite" style={{ fontSize: '.72rem', color: '#2563EB', fontWeight: 600, textDecoration: 'none' }}>Voir tout</Link>
          </div>
          <div style={{ padding: '.5rem 0' }}>
            {d.topEleves.length === 0 ? (
              <div style={{ padding: '2rem 1.1rem', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '.82rem' }}>
                <Award size={24} style={{ margin: '0 auto .5rem', opacity: .4 }} />
                Aucune note enregistrée
              </div>
            ) : (
              d.topEleves.map(el => {
                const RANG_BG = ['#F59E0B', '#94A3B8', '#CD7F32', 'var(--border)', 'var(--border)']
                return (
                  <div key={el.etudiant_id} style={{ display: 'flex', alignItems: 'center', gap: '.75rem', padding: '.65rem 1.1rem', borderBottom: '1px solid var(--border)' }}>
                    <div style={{ width: 24, height: 24, borderRadius: '50%', background: RANG_BG[el.rang - 1], display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: '.72rem', fontWeight: 800, color: el.rang <= 3 ? '#FFFFFF' : 'var(--text-secondary)' }}>
                      {el.rang}
                    </div>
                    <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#2563EB20', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: '.65rem', fontWeight: 700, color: '#2563EB' }}>
                      {el.prenom?.[0]}{el.nom?.[0]}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '.8rem', fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{el.prenom} {el.nom}</div>
                      <div style={{ fontSize: '.68rem', color: 'var(--text-secondary)' }}>{el.classe ?? '—'}</div>
                    </div>
                    <div style={{ fontSize: '.85rem', fontWeight: 800, color: el.moyenne >= 16 ? '#059669' : el.moyenne >= 12 ? '#D97706' : '#EF4444', flexShrink: 0 }}>
                      {el.moyenne.toFixed(2)}
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>

        {/* Statistiques académiques */}
        <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 10, padding: '1rem 1.25rem', overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
            <div>
              <div style={{ fontSize: '.85rem', fontWeight: 700, color: 'var(--text-primary)' }}>STATISTIQUES ACADÉMIQUES</div>
              <div style={{ fontSize: '.7rem', color: 'var(--text-secondary)' }}>Moyenne générale · Taux de réussite</div>
            </div>
            <Link href="/dashboard/ecole/direction" style={{ fontSize: '.72rem', color: '#2563EB', fontWeight: 600, textDecoration: 'none' }}>Voir tout</Link>
          </div>
          <ResponsiveContainer width="100%" height={160}>
            <LineChart data={d.monthlyStats} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="month" tick={{ fill: 'var(--text-secondary)', fontSize: 9 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: 'var(--text-secondary)', fontSize: 9 }} axisLine={false} tickLine={false} domain={[0, 20]} />
              <Tooltip contentStyle={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 11 }} />
              <Legend iconType="circle" iconSize={7} wrapperStyle={{ fontSize: 10 }} />
              <Line type="monotone" dataKey="moyenne" name="Moyenne générale" stroke="#7C3AED" strokeWidth={2} dot={false} activeDot={{ r: 3 }} />
              <Line type="monotone" dataKey="taux" name="Taux de réussite" stroke="#10B981" strokeWidth={2} dot={false} strokeDasharray="4 2" activeDot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Paiements vs prévisions */}
        <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 10, padding: '1rem 1.25rem', overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
            <div>
              <div style={{ fontSize: '.85rem', fontWeight: 700, color: 'var(--text-primary)' }}>PAIEMENTS VS PRÉVISIONS</div>
              <div style={{ fontSize: '.7rem', color: 'var(--text-secondary)' }}>Reçus vs objectifs annuels</div>
            </div>
            <Link href="/dashboard/ecole/comptabilite" style={{ fontSize: '.72rem', color: '#2563EB', fontWeight: 600, textDecoration: 'none' }}>Voir tout</Link>
          </div>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={d.monthlyStats} margin={{ top: 4, right: 4, left: -20, bottom: 0 }} barGap={2}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="month" tick={{ fill: 'var(--text-secondary)', fontSize: 9 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: 'var(--text-secondary)', fontSize: 9 }} axisLine={false} tickLine={false}
                tickFormatter={v => v >= 1000000 ? `${(v/1000000).toFixed(0)}M` : v >= 1000 ? `${(v/1000).toFixed(0)}k` : String(v)} />
              <Tooltip contentStyle={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 11 }}
                formatter={(val) => [`${fmtBig(Number(val))} FCFA`]} />
              <Legend iconType="square" iconSize={8} wrapperStyle={{ fontSize: 10 }} />
              <Bar dataKey="paiements" name="Reçus" fill="#10B981" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </motion.div>

      {/* ── Row 4 : Accès rapides / Actions rapides / Calendrier scolaire ────── */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .3, delay: .2 }}
        style={{ display: 'grid', gridTemplateColumns: '1fr 220px 280px', gap: '.9rem' }}
        className="row4-ecole">

        {/* Accès rapides */}
        <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 10, padding: '1rem 1.25rem' }}>
          <div style={{ fontSize: '.85rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '1.1rem' }}>ACCÈS RAPIDES</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem' }}>
            <QuickItem icon={UserPlus}    label="Nouvelle inscription" href="/dashboard/ecole/scolarite" color="#2563EB" />
            <QuickItem icon={UserCheck}   label="Ajouter un élève"     href="/dashboard/ecole/scolarite" color="#7C3AED" />
            <QuickItem icon={DollarSign}  label="Frais scolaires"      href="/dashboard/ecole/comptabilite" color="#EF4444" />
            <QuickItem icon={Clock}       label="Emploi du temps"      href="/dashboard/ecole/scolarite" color="#F59E0B" />
            <QuickItem icon={ClipboardList} label="Bulletins"          href="/dashboard/ecole/direction"  color="#10B981" />
            <QuickItem icon={BarChart2}   label="Rapport d'activités"  href="/dashboard/ecole/direction"  color="#0891B2" />
            <QuickItem icon={List}        label="Liste des absences"   href="/dashboard/ecole/scolarite"  color="#DC2626" />
            <QuickItem icon={Settings}    label="Paramètres"           href="/dashboard/ecole/parametres-academiques" color="#475569" />
          </div>
        </div>

        {/* Actions rapides */}
        <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 10, padding: '1rem 1.25rem' }}>
          <div style={{ fontSize: '.85rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '1rem' }}>ACTIONS RAPIDES</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '.2rem' }}>
            {[
              { icon: Megaphone, label: 'Créer une annonce', href: '/dashboard/ecole/direction', color: '#2563EB' },
              { icon: Send,      label: 'Envoyer un message', href: '/dashboard/ecole/direction', color: '#7C3AED' },
              { icon: Download,  label: 'Générer un rapport', href: '/dashboard/ecole/direction', color: '#10B981' },
              { icon: TrendingUp, label: 'Sauvegarde des données', href: '/dashboard/ecole/direction', color: '#F59E0B' },
            ].map(({ icon: Icon, label, href, color }) => (
              <Link key={label} href={href} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '.6rem .75rem', borderRadius: 7, textDecoration: 'none', transition: 'background .15s' }}
                onMouseEnter={e => (e.currentTarget as HTMLAnchorElement).style.background = 'var(--surface2)'}
                onMouseLeave={e => (e.currentTarget as HTMLAnchorElement).style.background = 'transparent'}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '.6rem' }}>
                  <Icon size={15} color={color} />
                  <span style={{ fontSize: '.8rem', fontWeight: 500, color: 'var(--text-primary)' }}>{label}</span>
                </div>
                <ChevronRight size={13} color="var(--text-secondary)" />
              </Link>
            ))}
          </div>
        </div>

        {/* Calendrier scolaire */}
        <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '.85rem 1.1rem', borderBottom: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '.6rem' }}>
              <Calendar size={15} color="#2563EB" />
              <span style={{ fontSize: '.85rem', fontWeight: 700, color: 'var(--text-primary)' }}>CALENDRIER SCOLAIRE</span>
            </div>
            <Link href="/dashboard/ecole/direction" style={{ fontSize: '.72rem', color: '#2563EB', fontWeight: 600, textDecoration: 'none' }}>Voir tout</Link>
          </div>
          <div style={{ padding: '.5rem 0' }}>
            {d.planningNext.length === 0 ? (
              <div style={{ padding: '2rem 1.1rem', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '.82rem' }}>
                <Calendar size={24} style={{ margin: '0 auto .5rem', opacity: .4 }} />
                Aucun événement à venir
              </div>
            ) : (
              d.planningNext.map(evt => (
                <div key={evt.id} style={{ display: 'flex', alignItems: 'center', gap: '.75rem', padding: '.65rem 1.1rem', borderBottom: '1px solid var(--border)' }}>
                  <CalDate dateStr={evt.date_debut} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '.8rem', fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{evt.titre}</div>
                    <div style={{ fontSize: '.68rem', color: 'var(--text-secondary)', marginTop: '.1rem' }}>{evt.date_fin ? `Jusqu'au ${new Date(evt.date_fin).toLocaleDateString('fr-FR')}` : new Date(evt.date_debut).toLocaleDateString('fr-FR')}</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </motion.div>

    </div>
  )
}

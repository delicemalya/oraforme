'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import {
  Users, GraduationCap, BookOpen,
  TrendingUp, AlertTriangle, RefreshCw, Loader2,
  Receipt, Calculator, ChevronRight, Plus,
  DollarSign, ShieldCheck,
} from 'lucide-react'
import Link from 'next/link'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
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
  transition: { duration: 0.36, delay: i * 0.04, ease: 'easeOut' as const },
})

type MonthData = { month: string; montant: number }

type OverviewData = {
  nbEtudiants: number; nbActifs: number; nbSuspendus: number; nbDiplomes: number
  nbEnseignants: number; nbEnsEmployes: number; nbEnsPrestataires: number
  nbEmployes: number; nbStaff: number
  revenuJour: number; revenuSemaine: number; revenuMois: number; revenuAnnee: number
  nbPaiementsJour: number; nbPaiementsSemaine: number; nbPaiementsMois: number
  montantImpayes: number; nbImpayes: number
  depensesJour: number
  sessionsEnCours: number; nbEvenements: number
  monthly: MonthData[]
  recentPaie: { id: string; montant: number; methode: string; libelle: string; created_at: string }[]
}

// ── KPI Card — fond neutre, icône couleur token ───────────────────────────────

function StatCard({
  icon: Icon, label, value, sub, color, href, badge, i,
}: {
  icon: React.ElementType; label: string; value: string | number; sub?: string
  color: string; href?: string; badge?: string; i: number
}) {
  const inner = (
    <div className="kpi-card" style={{
      background: 'var(--card-bg)',
      border: '1px solid var(--border)',
      borderRadius: 12,
      padding: '20px 24px',
      height: '100%',
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={{ width: 36, height: 36, background: `${color}18`, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Icon size={18} style={{ color }} />
        </div>
        {badge && (
          <span style={{ background: 'rgba(245,30,51,0.1)', color: '#DC2626', fontSize: 10, fontWeight: 600, borderRadius: 4, padding: '2px 8px' }}>
            {badge}
          </span>
        )}
      </div>
      <p style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: '0.06em', color: 'var(--text-secondary)', marginBottom: 6 }}>{label}</p>
      <p style={{ fontSize: 32, fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1, marginBottom: 4 }}>{value}</p>
      {sub && <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{sub}</p>}
    </div>
  )
  return (
    <motion.div {...fade(i)} whileHover={{ y: -2 }} transition={{ duration: 0.2 }}>
      {href ? <Link href={href} style={{ display: 'block', height: '100%' }}>{inner}</Link> : inner}
    </motion.div>
  )
}

// ── Revenue Card with period selector ─────────────────────────────────────────

function RevenueCard({
  revenuJour, revenuSemaine, revenuMois,
  nbPaiementsJour, nbPaiementsSemaine, nbPaiementsMois, i,
}: {
  revenuJour: number; revenuSemaine: number; revenuMois: number
  nbPaiementsJour: number; nbPaiementsSemaine: number; nbPaiementsMois: number; i: number
}) {
  const [period, setPeriod] = useState<'jour' | 'semaine' | 'mois'>('mois')
  const cfg = {
    jour:    { value: revenuJour,    nb: nbPaiementsJour,    sub: "Aujourd'hui" },
    semaine: { value: revenuSemaine, nb: nbPaiementsSemaine, sub: '7 derniers jours' },
    mois:    { value: revenuMois,    nb: nbPaiementsMois,    sub: 'Ce mois' },
  }[period]

  return (
    <motion.div {...fade(i)} whileHover={{ y: -2 }} transition={{ duration: 0.2 }}>
      <Link href="/dashboard/ecole/comptabilite" style={{ display: 'block', height: '100%' }}>
        <div className="kpi-card" style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 12, padding: '20px 24px', height: '100%' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
            <div style={{ width: 36, height: 36, background: 'rgba(245,30,51,0.12)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <TrendingUp size={18} style={{ color: '#DC2626' }} />
            </div>
            <div style={{ display: 'flex', gap: 2, background: 'var(--border)', borderRadius: 8, padding: 3 }}
              onClick={e => e.preventDefault()}>
              {(['jour', 'semaine', 'mois'] as const).map(p => (
                <button key={p}
                  onClick={e => { e.preventDefault(); e.stopPropagation(); setPeriod(p) }}
                  style={{
                    padding: '2px 8px', borderRadius: 6, fontSize: 10, fontWeight: 700,
                    background: period === p ? '#DC2626' : 'transparent',
                    color: period === p ? '#FFFFFF' : 'var(--text-secondary)',
                    border: 'none', cursor: 'pointer',
                  }}>
                  {p === 'jour' ? 'Jour' : p === 'semaine' ? '7j' : 'Mois'}
                </button>
              ))}
            </div>
          </div>
          <p style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: '0.06em', color: 'var(--text-secondary)', marginBottom: 6 }}>Recettes</p>
          <p style={{ fontSize: 32, fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1, marginBottom: 4 }}>
            {fmt(cfg.value)} <span style={{ fontSize: 16, fontWeight: 600 }}>FCFA</span>
          </p>
          <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{cfg.sub} · {cfg.nb} paiement{cfg.nb !== 1 ? 's' : ''}</p>
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
        .limit(8),
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

    const todayPaid  = allPaid.filter(p => p.created_at.slice(0, 10) === todayStr)
    const weekPaid   = allPaid.filter(p => new Date(p.created_at) >= weekAgo)
    const monthPaid  = allPaid.filter(p => new Date(p.created_at) >= monthStart)

    const monthly: MonthData[] = []
    for (let i = 7; i >= 0; i--) {
      const d   = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 1)
      const mPaid = allPaid.filter(p => {
        const pd = new Date(p.created_at)
        return pd >= d && pd < end
      })
      monthly.push({ month: MOIS[d.getMonth()], montant: mPaid.reduce((s, p) => s + Number(p.montant), 0) })
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
      revenuJour:       todayPaid.reduce((s, p) => s + Number(p.montant), 0),
      revenuSemaine:    weekPaid.reduce((s, p) => s + Number(p.montant), 0),
      revenuMois:       monthPaid.reduce((s, p) => s + Number(p.montant), 0),
      revenuAnnee:      allPaid.reduce((s, p) => s + Number(p.montant), 0),
      nbPaiementsJour:  todayPaid.length,
      nbPaiementsSemaine: weekPaid.length,
      nbPaiementsMois:  monthPaid.length,
      montantImpayes:   impayes.reduce((s, p) => s + Number(p.montant), 0),
      nbImpayes:        impayes.length,
      depensesJour:     (depJourRes.data ?? []).reduce((s, d) => s + Number(d.montant_ttc), 0),
      sessionsEnCours:  sessRes.count ?? 0,
      nbEvenements:     evtRes.count  ?? 0,
      monthly,
      recentPaie: (recentPaieRes.data ?? []) as OverviewData['recentPaie'],
    })
    setLoading(false)
  }, [tenantId]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { if (tenantId) load() }, [tenantId, load])

  if (tenantLoading || loading) return (
    <div className="flex items-center justify-center h-64" style={{ color: 'var(--text-secondary)' }}>
      <Loader2 className="animate-spin mr-2" size={18} /> Chargement du tableau de bord…
    </div>
  )

  if (!data) return null

  const d = data
  const nbAgents     = d.nbEmployes + d.nbStaff
  const tauxActifs   = d.nbEtudiants > 0 ? Math.round((d.nbActifs / d.nbEtudiants) * 100) : 0
  const recoveryRate = (d.revenuMois + d.montantImpayes) > 0
    ? Math.round((d.revenuMois / (d.revenuMois + d.montantImpayes)) * 100) : 100

  return (
    <div className="flex flex-col gap-6 pb-10">

      {/* ── Banner — fond orange plat ────────────────────────────────────────── */}
      <motion.div {...fade(0)} style={{ background: '#DC2626', borderRadius: 12, padding: '20px 24px' }}>
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <h1 style={{ fontSize: 22, fontWeight: 700, color: '#FFFFFF', lineHeight: 1.2 }}>Bonjour, Admin 👋</h1>
              <button onClick={load} style={{ color: 'rgba(255,255,255,0.5)', padding: 4, background: 'none', border: 'none', cursor: 'pointer' }}
                className="hover:opacity-80 transition-opacity">
                <RefreshCw size={13} />
              </button>
            </div>
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.75)', marginBottom: 4 }}>
              Gérez votre établissement, vos équipes et vos finances en un seul endroit.
            </p>
            <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.65)' }}>
              <strong style={{ color: '#FFFFFF' }}>{nomEcole}</strong> · Tableau de bord complet
            </p>
            <div className="flex flex-wrap gap-3 mt-4">
              <Link href="/dashboard/ecole/scolarite"
                style={{ background: '#FFFFFF', color: '#DC2626', fontWeight: 700, fontSize: 13, padding: '8px 16px', borderRadius: 10, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <Plus size={13} /> Inscrire un étudiant
              </Link>
              <Link href="/dashboard/ecole/direction"
                style={{ background: 'transparent', color: '#FFFFFF', fontWeight: 600, fontSize: 13, padding: '8px 16px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.5)', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                Voir les rapports
              </Link>
            </div>
          </div>

          {/* Mini-stats */}
          <div className="flex gap-3 flex-shrink-0 flex-wrap">
            {[
              { label: 'Recouvrement',     value: `${recoveryRate}%` },
              { label: 'Sessions actives', value: d.sessionsEnCours },
              { label: 'Impayés',          value: `${d.nbImpayes} dossiers` },
            ].map(s => (
              <div key={s.label} style={{ background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.25)', borderRadius: 8, padding: '12px 16px', textAlign: 'center', minWidth: 100 }}>
                <p style={{ fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>{s.label}</p>
                <p style={{ fontSize: 18, fontWeight: 800, color: '#FFFFFF' }}>{s.value}</p>
              </div>
            ))}
          </div>
        </div>
      </motion.div>

      {/* ── 5 KPI Cards ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
        <StatCard i={1} icon={GraduationCap} label="Inscrits (année en cours)"
          value={d.nbEtudiants} sub={`${d.nbActifs} actifs · ${d.nbSuspendus} suspendus`}
          color="#DC2626" href="/dashboard/ecole/scolarite" badge={`${tauxActifs}% actifs`} />

        <StatCard i={2} icon={Users} label="Agents"
          value={nbAgents} sub={`${d.nbEmployes} employés · ${d.nbStaff} staff direction`}
          color="#DC2626" href="/dashboard/ecole/rh" badge="Personnel" />

        <StatCard i={3} icon={BookOpen} label="Formateurs (Enseignants)"
          value={d.nbEnseignants} sub={`${d.nbEnsEmployes} employés · ${d.nbEnsPrestataires} prestataires`}
          color="#7C3AED" href="/dashboard/ecole/rh" badge="Actifs" />

        <RevenueCard i={4}
          revenuJour={d.revenuJour} revenuSemaine={d.revenuSemaine} revenuMois={d.revenuMois}
          nbPaiementsJour={d.nbPaiementsJour} nbPaiementsSemaine={d.nbPaiementsSemaine} nbPaiementsMois={d.nbPaiementsMois} />

        <StatCard i={5} icon={Receipt} label="Sorties du jour"
          value={fmt(d.depensesJour)} sub="FCFA de dépenses aujourd'hui"
          color={d.depensesJour > 100000 ? '#DC2626' : '#DC2626'}
          href="/dashboard/ecole/tresorerie" badge="Dépenses" />
      </div>

      {/* ── Graphique + panel droit ──────────────────────────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">

        {/* Graphique flux financiers */}
        <motion.div {...fade(6)} className="xl:col-span-2" style={{
          background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 12, padding: 20,
        }}>
          <div className="flex items-start justify-between mb-4">
            <div>
              <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>Analyse des Flux Financiers</p>
              <p style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>Paiements scolaires — 8 derniers mois</p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--text-secondary)' }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#DC2626' }} />
              Revenus encaissés
            </div>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={d.monthly} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="month" tick={{ fill: 'var(--text-secondary)', fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: 'var(--text-secondary)', fontSize: 10 }} axisLine={false} tickLine={false} width={50}
                tickFormatter={v => v >= 1000000 ? `${(v/1000000).toFixed(1)}M` : v >= 1000 ? `${(v/1000).toFixed(0)}k` : String(v)} />
              <Tooltip
                contentStyle={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 10, fontSize: 12 }}
                labelStyle={{ color: 'var(--text-secondary)' }}
                formatter={(value) => [`${fmt(Number(value ?? 0))} FCFA`, 'Recettes']}
              />
              <Line type="monotone" dataKey="montant" stroke="#DC2626" strokeWidth={2}
                dot={false} activeDot={{ r: 4, fill: '#DC2626', stroke: 'rgba(245,30,51,0.25)', strokeWidth: 6 }} />
            </LineChart>
          </ResponsiveContainer>
        </motion.div>

        {/* Objectif recouvrement */}
        <motion.div {...fade(7)} style={{
          background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 12, padding: 20,
          display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
        }}>
          <div>
            <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12 }}>Objectif Recouvrement</p>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 8 }}>
              <p style={{ fontSize: 48, fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1 }}>{recoveryRate}%</p>
              <span style={{
                fontSize: 11, fontWeight: 700,
                color: recoveryRate >= 80 ? '#DC2626' : recoveryRate >= 50 ? '#DC2626' : '#DC2626',
              }}>
                {recoveryRate >= 80 ? '✓ En bonne voie' : recoveryRate >= 50 ? '⚠ À surveiller' : '✗ Retard'}
              </span>
            </div>
            <div style={{ height: 6, borderRadius: 3, background: 'var(--border)', overflow: 'hidden', marginBottom: 12 }}>
              <div style={{
                height: '100%', borderRadius: 3,
                width: `${recoveryRate}%`,
                background: recoveryRate >= 80 ? '#DC2626' : '#DC2626',
                transition: 'width 0.7s ease',
              }} />
            </div>
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              {d.montantImpayes > 0
                ? <><strong style={{ color: 'var(--text-primary)' }}>{fmt(d.montantImpayes)} FCFA</strong> d&apos;impayés sur {d.nbImpayes} dossier{d.nbImpayes !== 1 ? 's' : ''}.</>
                : <>Aucun impayé — <strong style={{ color: '#DC2626' }}>excellent !</strong></>
              }
            </p>
          </div>
          <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
            <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>Chiffre d&apos;affaire annuel</p>
            <p style={{ fontSize: 20, fontWeight: 800, color: '#DC2626' }}>{fmt(d.revenuAnnee)} FCFA</p>
            <p style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>Total encaissé depuis le début</p>
          </div>
        </motion.div>
      </div>

      {/* ── Raccourcis ───────────────────────────────────────────────────────── */}
      <motion.div {...fade(8)}>
        <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>Raccourcis</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {[
            { label: 'Comptabilité',      href: '/dashboard/ecole/comptabilite',  icon: Calculator,    color: '#7C3AED', sub: 'Journal OHADA' },
            { label: 'RH & Paie',         href: '/dashboard/ecole/rh',            icon: Users,         color: '#DC2626', sub: 'Personnel & salaires' },
            { label: 'Rôles & Accès',     href: '/dashboard/roles',               icon: ShieldCheck,   color: '#DC2626', sub: 'Permissions' },
            { label: 'Page Étudiants',    href: '/dashboard/ecole/scolarite',     icon: GraduationCap, color: '#DC2626', sub: 'Inscriptions & frais' },
            { label: "Chiffre d'affaire", href: '/dashboard/ecole/direction',     icon: TrendingUp,    color: '#DC2626', sub: 'Direction & rapports' },
          ].map(({ label, href, color, icon: Icon, sub }) => (
            <Link key={href} href={href}
              className="flex items-center gap-3 transition-all duration-200 group"
              style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 10, padding: '14px 18px', textDecoration: 'none' }}
              onMouseEnter={e => { const el = e.currentTarget as HTMLAnchorElement; el.style.borderColor = '#DC2626'; el.style.transform = 'translateY(-1px)' }}
              onMouseLeave={e => { const el = e.currentTarget as HTMLAnchorElement; el.style.borderColor = 'var(--border)'; el.style.transform = 'translateY(0)' }}
            >
              <Icon size={20} style={{ color, flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 1 }}>{label}</p>
                <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{sub}</p>
              </div>
              <ChevronRight size={16} style={{ color: 'var(--text-secondary)', flexShrink: 0 }} />
            </Link>
          ))}
        </div>
      </motion.div>

      {/* ── Transactions récentes ─────────────────────────────────────────────── */}
      <motion.div {...fade(9)} style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
          <div>
            <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>Transactions Récentes</p>
            <p style={{ fontSize: 10, color: 'var(--text-secondary)', marginTop: 2 }}>Derniers paiements scolaires enregistrés</p>
          </div>
          <Link href="/dashboard/ecole/direction" style={{ fontSize: 12, color: '#DC2626', fontWeight: 600 }}>
            Voir tout →
          </Link>
        </div>

        {d.recentPaie.length === 0 ? (
          <div style={{ padding: '48px 0', textAlign: 'center' }}>
            <DollarSign size={28} style={{ color: 'var(--border)', margin: '0 auto 8px' }} />
            <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Aucune transaction pour le moment.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  {['Description', 'Date', 'Montant', 'Mode'].map(h => (
                    <th key={h} className="text-left px-4 py-3" style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {d.recentPaie.map(p => (
                  <tr key={p.id} style={{ borderBottom: '1px solid var(--border)' }}
                    className="transition-colors"
                    onMouseEnter={e => (e.currentTarget as HTMLTableRowElement).style.background = 'rgba(245,30,51,0.03)'}
                    onMouseLeave={e => (e.currentTarget as HTMLTableRowElement).style.background = 'transparent'}
                  >
                    <td className="px-4 py-3">
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(245,30,51,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <DollarSign size={13} style={{ color: '#DC2626' }} />
                        </div>
                        <div>
                          <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', maxWidth: 180 }} className="truncate">
                            {p.libelle || 'Paiement scolarité'}
                          </p>
                          <p style={{ fontSize: 10, color: 'var(--text-secondary)' }}>Scolarité</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3" style={{ fontSize: 11, color: 'var(--text-secondary)', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>
                      {new Date(p.created_at).toLocaleDateString('fr-FR')}
                    </td>
                    <td className="px-4 py-3">
                      <span style={{ fontSize: 13, fontWeight: 700, color: '#DC2626', fontFamily: 'monospace' }}>+{fmt(p.montant)} FCFA</span>
                    </td>
                    <td className="px-4 py-3">
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '3px 10px', borderRadius: 20, fontSize: 10, fontWeight: 700, background: 'rgba(245,30,51,0.1)', color: '#DC2626' }}>
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

      {/* ── Alerte impayés ───────────────────────────────────────────────────── */}
      {d.nbImpayes > 0 && (
        <motion.div {...fade(10)} style={{ background: 'rgba(245,30,51,0.06)', border: '1px solid rgba(245,30,51,0.2)', borderRadius: 12, padding: '16px 20px', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          <AlertTriangle size={17} style={{ color: '#DC2626', flexShrink: 0, marginTop: 1 }} />
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>Impayés en attente</p>
            <p style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
              {d.nbImpayes} dossier{d.nbImpayes !== 1 ? 's' : ''} — {fmt(d.montantImpayes)} FCFA à recouvrer.{' '}
              <Link href="/dashboard/ecole/scolarite" style={{ color: '#DC2626', fontWeight: 600 }}>Traiter →</Link>
            </p>
          </div>
        </motion.div>
      )}

    </div>
  )
}

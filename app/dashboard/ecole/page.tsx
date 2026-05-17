'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import {
  GraduationCap, Users, UserCheck, UserX, TrendingUp,
  Wallet, AlertTriangle, BookOpen, RefreshCw, Award,
  BarChart2, DollarSign, Users2, ChevronRight, Calendar,
  CheckCircle, ArrowUpRight, Loader2,
} from 'lucide-react'
import Link from 'next/link'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { supabase } from '@/lib/supabase'
import { useTenant } from '@/lib/hooks/useTenant'

// Types kept for backward-compat with _lib/ecole-dashboard-client.tsx
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

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)} M`
  if (n >= 1_000) return new Intl.NumberFormat('fr-FR').format(Math.round(n))
  return String(Math.round(n))
}

const fade = (i: number) => ({
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.38, delay: i * 0.05, ease: 'easeOut' as const },
})

// ── Sub-components ────────────────────────────────────────────────────────────

function KpiCard({ label, value, sub, color, icon: Icon, href }: {
  label: string; value: string | number; sub?: string; color: string
  icon: React.ElementType; href?: string
}) {
  const inner = (
    <div className="p-4 rounded-xl border border-[#21262D] bg-[#161B22] hover:border-[#30363D] transition-all group h-full">
      <div className="flex items-start justify-between mb-3">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${color}18` }}>
          <Icon size={15} style={{ color }} />
        </div>
        {href && <ChevronRight size={13} className="text-[#484F58] group-hover:text-[#8B949E] transition-colors" />}
      </div>
      <div className="text-xl font-bold text-[#E6EDF3] mb-0.5">{value}</div>
      <div className="text-xs text-[#8B949E]">{label}</div>
      {sub && <div className="text-[10px] text-[#484F58] mt-0.5">{sub}</div>}
    </div>
  )
  return (
    <div className="h-full">
      {href ? <Link href={href} className="block h-full">{inner}</Link> : inner}
    </div>
  )
}

function SmallStat({ label, value, color }: { label: string; value: string | number; color: string }) {
  return (
    <div className="flex items-center justify-between px-3 py-2.5 rounded-lg bg-[#0D1117] border border-[#21262D]">
      <span className="text-xs text-[#8B949E]">{label}</span>
      <span className="text-sm font-bold" style={{ color }}>{value}</span>
    </div>
  )
}

// ── Types ─────────────────────────────────────────────────────────────────────

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

// ── Main Component ────────────────────────────────────────────────────────────

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

      // All payments from last 8 months (to compute daily/weekly/monthly/chart in one query)
      supabase.from('paiements_scolaires')
        .select('montant, created_at, statut, methode, libelle')
        .eq('tenant_id', tenantId)
        .gte('created_at', eightAgo.toISOString())
        .order('created_at', { ascending: false }),

      // Recent paid payments for the table
      supabase.from('paiements_scolaires')
        .select('id, montant, methode, libelle, created_at')
        .eq('tenant_id', tenantId)
        .eq('statut', 'paye')
        .order('created_at', { ascending: false })
        .limit(6),

      // Today's expenses
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

    // Build 8-month chart buckets client-side
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

  // ── Loading ─────────────────────────────────────────────────────────────────

  if (tenantLoading || loading) return (
    <div className="flex items-center justify-center h-64 text-[#8B949E]">
      <Loader2 className="animate-spin mr-2" size={18} /> Chargement du tableau de bord…
    </div>
  )

  if (!data) return null

  const d = data
  const totalPersonnel = d.nbEnseignants + d.nbEmployes + d.nbStaff
  const tauxActifs = d.nbEtudiants > 0 ? Math.round((d.nbActifs / d.nbEtudiants) * 100) : 0

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5 pb-8">

      {/* Header */}
      <motion.div {...fade(0)} className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-[#E6EDF3]">Vue d&apos;ensemble</h1>
          <p className="text-sm text-[#8B949E]">{nomEcole} · Tableau de bord complet</p>
        </div>
        <button
          onClick={load}
          className="p-2 rounded-lg border border-[#21262D] text-[#8B949E] hover:text-[#E6EDF3] hover:border-[#30363D] transition-all"
        >
          <RefreshCw size={14} />
        </button>
      </motion.div>

      {/* Alertes */}
      {(d.nbImpayes > 0 || d.sessionsEnCours > 0 || d.nbEvenements > 0) && (
        <motion.div {...fade(1)} className="flex flex-wrap gap-2">
          {d.nbImpayes > 0 && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#F0A30A]/20 bg-[#F0A30A]/5 text-[#F0A30A] text-xs font-medium">
              <AlertTriangle size={12} />
              {d.nbImpayes} impayé{d.nbImpayes > 1 ? 's' : ''} — {fmt(d.montantImpayes)} FCFA
            </div>
          )}
          {d.sessionsEnCours > 0 && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-blue-500/20 bg-blue-500/5 text-blue-400 text-xs font-medium">
              <BookOpen size={12} />
              {d.sessionsEnCours} session{d.sessionsEnCours > 1 ? 's' : ''} en cours
            </div>
          )}
          {d.nbEvenements > 0 && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#8B5CF6]/20 bg-[#8B5CF6]/5 text-[#8B5CF6] text-xs font-medium">
              <Calendar size={12} />
              {d.nbEvenements} événement{d.nbEvenements > 1 ? 's' : ''} à venir
            </div>
          )}
        </motion.div>
      )}

      {/* ── Inscriptions ───────────────────────────────────────────────── */}
      <motion.div {...fade(2)}>
        <p className="text-[10px] font-bold text-[#484F58] uppercase tracking-widest mb-2.5">Inscriptions</p>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <KpiCard icon={GraduationCap} label="Total inscrits"   value={d.nbEtudiants} color="#F0A30A" sub={`${tauxActifs}% actifs`}     href="/dashboard/ecole/scolarite" />
          <KpiCard icon={CheckCircle}   label="Étudiants actifs" value={d.nbActifs}     color="#2EA043" sub="En cours de formation"        href="/dashboard/ecole/scolarite" />
          <KpiCard icon={UserX}         label="Suspendus"        value={d.nbSuspendus}  color="#F85149" sub="Accès bloqué"                 href="/dashboard/ecole/scolarite" />
          <KpiCard icon={Award}         label="Diplômés"         value={d.nbDiplomes}   color="#8B5CF6" sub="Parcours terminé"             href="/dashboard/ecole/direction" />
        </div>
      </motion.div>

      {/* ── Personnel ──────────────────────────────────────────────────── */}
      <motion.div {...fade(3)}>
        <p className="text-[10px] font-bold text-[#484F58] uppercase tracking-widest mb-2.5">Personnel</p>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <KpiCard icon={BookOpen}  label="Formateurs actifs" value={d.nbEnseignants}  color="#388BFD" sub={`${d.nbEnsEmployes} employés · ${d.nbEnsPrestataires} prestataires`} href="/dashboard/ecole/rh" />
          <KpiCard icon={UserCheck} label="Employés"          value={d.nbEmployes}     color="#8B5CF6" href="/dashboard/ecole/rh" />
          <KpiCard icon={Users}     label="Staff Direction"   value={d.nbStaff}        color="#EC4899" href="/dashboard/ecole/rh" />
          <KpiCard icon={Users2}    label="Total personnel"   value={totalPersonnel}   color="#06B6D4" sub="Formateurs + Employés + Staff" />
        </div>
      </motion.div>

      {/* ── Frais scolaires ────────────────────────────────────────────── */}
      <motion.div {...fade(4)}>
        <p className="text-[10px] font-bold text-[#484F58] uppercase tracking-widest mb-2.5">Frais scolaires</p>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <KpiCard icon={DollarSign}    label="Recettes du jour"  value={`${fmt(d.revenuJour)} FCFA`}    color="#2EA043" sub={`${d.nbPaiementsJour} paiement${d.nbPaiementsJour !== 1 ? 's' : ''}`} />
          <KpiCard icon={TrendingUp}    label="Cette semaine"     value={`${fmt(d.revenuSemaine)} FCFA`} color="#388BFD" sub="7 derniers jours" />
          <KpiCard icon={Wallet}        label="Ce mois"           value={`${fmt(d.revenuMois)} FCFA`}    color="#F0A30A" sub={`${d.nbPaiementsMois} paiements`} href="/dashboard/ecole/comptabilite" />
          <KpiCard icon={AlertTriangle} label="Impayés en attente"value={`${fmt(d.montantImpayes)} FCFA`}color="#F85149" sub={`${d.nbImpayes} dossier${d.nbImpayes !== 1 ? 's' : ''}`} href="/dashboard/ecole/scolarite" />
        </div>
      </motion.div>

      {/* ── Chart + Stats rapides ───────────────────────────────────────── */}
      <motion.div {...fade(5)} className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Payment progression area chart */}
        <div className="lg:col-span-2 p-4 rounded-xl border border-[#21262D] bg-[#161B22]">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-sm font-semibold text-[#E6EDF3]">Progression des paiements</p>
              <p className="text-[11px] text-[#8B949E]">Frais scolaires — 8 derniers mois</p>
            </div>
            <BarChart2 size={15} className="text-[#484F58]" />
          </div>
          <ResponsiveContainer width="100%" height={190}>
            <AreaChart data={d.monthly} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="gradPaie" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#F0A30A" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#F0A30A" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#21262D" vertical={false} />
              <XAxis
                dataKey="month"
                tick={{ fill: '#484F58', fontSize: 10 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: '#484F58', fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                width={46}
                tickFormatter={v => v >= 1000000 ? `${(v / 1000000).toFixed(1)}M` : v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)}
              />
              <Tooltip
                contentStyle={{ background: '#161B22', border: '1px solid #21262D', borderRadius: 8, fontSize: 12 }}
                labelStyle={{ color: '#8B949E' }}
                formatter={(value: number) => [`${fmt(value)} FCFA`, 'Recettes']}
              />
              <Area
                type="monotone"
                dataKey="montant"
                stroke="#F0A30A"
                strokeWidth={2}
                fill="url(#gradPaie)"
                dot={false}
                activeDot={{ r: 4, fill: '#F0A30A', stroke: '#161B22', strokeWidth: 2 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Right column: Dépenses + rapports */}
        <div className="space-y-3">

          {/* Dépenses du jour */}
          <div className="p-4 rounded-xl border border-[#21262D] bg-[#161B22]">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-7 h-7 rounded-lg bg-[#F85149]/15 flex items-center justify-center shrink-0">
                <ArrowUpRight size={13} className="text-[#F85149]" />
              </div>
              <p className="text-sm font-semibold text-[#E6EDF3]">Dépenses du jour</p>
            </div>
            <div className="text-2xl font-bold text-[#F85149]">
              {fmt(d.depensesJour)} <span className="text-sm font-normal text-[#8B949E]">FCFA</span>
            </div>
            <Link href="/dashboard/ecole/comptabilite" className="text-[10px] text-[#388BFD] hover:underline mt-1 inline-block">
              Voir le journal →
            </Link>
          </div>

          {/* Statistiques rapides */}
          <div className="p-4 rounded-xl border border-[#21262D] bg-[#161B22] space-y-2">
            <p className="text-[10px] font-bold text-[#484F58] uppercase tracking-widest mb-2">Statistiques</p>
            <SmallStat label="Revenu annuel"        value={`${fmt(d.revenuAnnee)} FCFA`}  color="#2EA043" />
            <SmallStat label="Taux d'activité"      value={`${tauxActifs}%`}               color="#388BFD" />
            <SmallStat label="Sessions actives"     value={d.sessionsEnCours}              color="#F0A30A" />
            <SmallStat label="Événements à venir"   value={d.nbEvenements}                 color="#8B5CF6" />
          </div>
        </div>
      </motion.div>

      {/* ── Derniers paiements ─────────────────────────────────────────── */}
      {d.recentPaie.length > 0 && (
        <motion.div {...fade(6)} className="rounded-xl border border-[#21262D] bg-[#161B22] overflow-hidden">
          <div className="px-4 py-3 border-b border-[#21262D] flex items-center justify-between">
            <p className="text-sm font-semibold text-[#E6EDF3]">Derniers paiements</p>
            <Link href="/dashboard/ecole/direction" className="text-xs text-[#388BFD] hover:underline">
              Voir tout
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-white/[0.02]">
                  {['Date', 'Libellé', 'Mode', 'Montant'].map(h => (
                    <th key={h} className="text-left px-4 py-2.5 text-[10px] text-[#484F58] uppercase tracking-wider font-semibold">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {d.recentPaie.map(p => (
                  <tr key={p.id} className="border-t border-white/[0.04] hover:bg-white/[0.02] transition-colors">
                    <td className="px-4 py-2.5 text-[#8B949E]">
                      {new Date(p.created_at).toLocaleDateString('fr-FR')}
                    </td>
                    <td className="px-4 py-2.5 text-[#E6EDF3] max-w-[180px] truncate">{p.libelle}</td>
                    <td className="px-4 py-2.5 text-[#8B949E] capitalize">
                      {p.methode?.replace(/_/g, ' ') ?? '—'}
                    </td>
                    <td className="px-4 py-2.5 font-semibold text-[#2EA043]">{fmt(p.montant)} FCFA</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>
      )}

      {/* ── Actions rapides ────────────────────────────────────────────── */}
      <motion.div {...fade(7)}>
        <p className="text-[10px] font-bold text-[#484F58] uppercase tracking-widest mb-2.5">Actions rapides</p>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
          {[
            { label: 'Inscrire un étudiant', href: '/dashboard/ecole/scolarite',              color: '#F0A30A', icon: GraduationCap },
            { label: 'Ajouter un formateur', href: '/dashboard/ecole/rh',                     color: '#388BFD', icon: BookOpen     },
            { label: 'Direction & Rapports', href: '/dashboard/ecole/direction',               color: '#8B5CF6', icon: BarChart2    },
            { label: 'Comptabilité OHADA',   href: '/dashboard/ecole/comptabilite',            color: '#2EA043', icon: Wallet      },
          ].map(({ label, href, color, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-2.5 p-3 rounded-xl border border-[#21262D] bg-[#161B22] hover:border-[#30363D] transition-all group"
            >
              <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${color}18` }}>
                <Icon size={13} style={{ color }} />
              </div>
              <span className="text-xs text-[#8B949E] group-hover:text-[#E6EDF3] transition-colors flex-1">{label}</span>
              <ChevronRight size={11} className="text-[#484F58] shrink-0" />
            </Link>
          ))}
        </div>
      </motion.div>
    </div>
  )
}

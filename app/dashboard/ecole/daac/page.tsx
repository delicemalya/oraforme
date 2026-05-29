'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { Layers, RefreshCw, GraduationCap, BookOpen, FileText, Award, Swords, BookOpenCheck } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useTenant } from '@/lib/hooks/useTenant'
import { useRoleGuard } from '@/lib/hooks/useRoleGuard'
import {
  type Etudiant, type Enseignant, type ClasseEcole,
  type Diploma, type Defense, type SessionEcole,
  KpiCard,
} from '../_lib/shared'
import {
  SectionMatieres, SectionSessions, SectionExamens,
  SectionAttestations, SectionDiplomes, SectionSoutenances,
} from '../_lib/academic-sections'
import { useLocale } from '@/lib/hooks/useLocale'

// ── Types ─────────────────────────────────────────────────────────────────────

type TabId = 'matieres' | 'sessions' | 'examens' | 'attestations' | 'diplomes' | 'soutenances'

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function DaacPage() {
  useRoleGuard(['DIRECTION_GENERALE', 'DAAC'])
  const { tenantId } = useTenant()
  const { t } = useLocale()

  const TABS: { id: TabId; label: string; icon: React.ElementType }[] = [
    { id: 'matieres',     label: t('ecole.tab.matieres'),     icon: BookOpenCheck },
    { id: 'sessions',     label: t('ecole.tab.sessions'),     icon: BookOpen      },
    { id: 'examens',      label: t('ecole.tab.examens'),      icon: Layers        },
    { id: 'attestations', label: t('ecole.tab.attestations'), icon: FileText      },
    { id: 'diplomes',     label: t('ecole.tab.diplomes'),     icon: GraduationCap },
    { id: 'soutenances',  label: t('ecole.tab.soutenances'),  icon: Swords        },
  ]

  const [tab,          setTab]          = useState<TabId>('sessions')
  const [etudiants,    setEtudiants]    = useState<Etudiant[]>([])
  const [enseignants,  setEnseignants]  = useState<Enseignant[]>([])
  const [classes,      setClasses]      = useState<ClasseEcole[]>([])
  const [sessions,     setSessions]     = useState<SessionEcole[]>([])
  const [diplomas,     setDiplomas]     = useState<Diploma[]>([])
  const [defenses,     setDefenses]     = useState<Defense[]>([])
  const [nomEcole,     setNomEcole]     = useState('Mon École')
  const [loading,      setLoading]      = useState(true)

  const load = useCallback(async () => {
    if (!tenantId) return
    setLoading(true)
    const [etuRes, ensRes, clRes, sesRes, dipRes, defRes, tenantRes] = await Promise.all([
      supabase.from('etudiants').select('*').eq('tenant_id', tenantId).order('nom'),
      supabase.from('enseignants').select('*').eq('tenant_id', tenantId).order('nom'),
      supabase.from('classes_ecole').select('*').eq('tenant_id', tenantId).order('nom'),
      supabase.from('sessions_ecole').select('*').eq('tenant_id', tenantId).order('date_debut', { ascending: false }),
      supabase.from('diplomas').select('*').eq('tenant_id', tenantId).order('created_at', { ascending: false }),
      supabase.from('defenses').select('*').eq('tenant_id', tenantId).order('date_soutenance', { ascending: false }),
      supabase.from('tenants').select('nom_entreprise').eq('id', tenantId).limit(1).maybeSingle(),
    ])
    setEtudiants((etuRes.data ?? []) as Etudiant[])
    setEnseignants((ensRes.data ?? []) as Enseignant[])
    setClasses((clRes.data ?? []) as ClasseEcole[])
    setSessions((sesRes.data ?? []) as SessionEcole[])
    setDiplomas((dipRes.data ?? []) as Diploma[])
    setDefenses((defRes.data ?? []) as Defense[])
    if (tenantRes.data?.nom_entreprise) setNomEcole(tenantRes.data.nom_entreprise)
    setLoading(false)
  }, [tenantId])

  useEffect(() => { load() }, [load])

  // KPIs
  const sessionEnCours = sessions.filter(s => s.statut === 'en_cours').length
  const dipEnAttente   = diplomas.filter(d => d.statut === 'en_attente').length
  const souPlanifie    = defenses.filter(d => d.statut === 'planifie').length
  const actifs         = etudiants.filter(e => e.statut === 'actif').length

  return (
    <div className="space-y-5">

        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-xl font-bold text-[var(--text)]">{t('ecole.daac.title')}</h1>
          <p className="text-sm text-[var(--text-secondary)] mt-0.5">
            {t('ecole.daac.subtitle')}
          </p>
        </motion.div>

        {/* KPIs */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}
          className="grid grid-cols-2 lg:grid-cols-4 gap-3"
        >
          <KpiCard label={t('ecole.daac.kpi.actifs')}      value={actifs}         color="#DC2626" />
          <KpiCard label={t('ecole.daac.kpi.sessions')}    value={sessionEnCours} color="#DC2626" />
          <KpiCard label={t('ecole.daac.kpi.diplomes')}    value={dipEnAttente}   color="#7C3AED" />
          <KpiCard label={t('ecole.daac.kpi.soutenances')} value={souPlanifie}    color="#0F172A" />
        </motion.div>

        {/* Tabs */}
        <div className="flex gap-1 p-1 bg-[var(--card-bg)] border border-[var(--border)] rounded-xl overflow-x-auto">
          {TABS.map(tab_ => (
            <button
              key={tab_.id}
              onClick={() => setTab(tab_.id)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-all flex-1 justify-center ${
                tab === tab_.id ? 'bg-[#00b9a7] text-white' : 'text-[var(--text-secondary)] hover:text-[#101729]'
              }`}
            >
              <tab_.icon size={12} />
              {tab_.label}
            </button>
          ))}
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <RefreshCw size={20} className="animate-spin text-[var(--text-secondary)]" />
          </div>
        ) : tenantId ? (
          <motion.div
            key={tab}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            className="p-5 bg-[var(--card-bg)] border border-[var(--border)] rounded-xl"
          >
            {tab === 'matieres'     && <SectionMatieres     tenantId={tenantId} enseignants={enseignants} />}
            {tab === 'sessions'     && <SectionSessions     tenantId={tenantId} />}
            {tab === 'examens'      && <SectionExamens      tenantId={tenantId} etudiants={etudiants} classes={classes} />}
            {tab === 'attestations' && <SectionAttestations tenantId={tenantId} etudiants={etudiants} nomEcole={nomEcole} />}
            {tab === 'diplomes'     && <SectionDiplomes     tenantId={tenantId} etudiants={etudiants} nomEcole={nomEcole} />}
            {tab === 'soutenances'  && <SectionSoutenances  tenantId={tenantId} etudiants={etudiants} />}
          </motion.div>
        ) : null}
    </div>
  )
}

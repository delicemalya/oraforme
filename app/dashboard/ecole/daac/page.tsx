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

// ── Types ─────────────────────────────────────────────────────────────────────

type TabId = 'matieres' | 'sessions' | 'examens' | 'attestations' | 'diplomes' | 'soutenances'

const TABS: { id: TabId; label: string; icon: React.ElementType }[] = [
  { id: 'matieres',     label: 'Matières',        icon: BookOpenCheck },
  { id: 'sessions',     label: 'Sessions',         icon: BookOpen      },
  { id: 'examens',      label: 'Examens & Notes', icon: Layers        },
  { id: 'attestations', label: 'Attestations',     icon: FileText      },
  { id: 'diplomes',     label: 'Diplômes',         icon: GraduationCap },
  { id: 'soutenances',  label: 'Soutenances',      icon: Swords        },
]

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function DaacPage() {
  useRoleGuard(['DIRECTION_GENERALE', 'DAAC'])
  const { tenantId } = useTenant()

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
      supabase.from('tenants').select('nom_entreprise').eq('id', tenantId).maybeSingle(),
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
          <h1 className="text-xl font-bold text-[#E6EDF3]">DAAC — Direction des Affaires Académiques</h1>
          <p className="text-sm text-[#8B949E] mt-0.5">
            Programmes, sessions, examens, délibérations, diplômes & soutenances
          </p>
        </motion.div>

        {/* KPIs */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}
          className="grid grid-cols-2 lg:grid-cols-4 gap-3"
        >
          <KpiCard label="Étudiants actifs"    value={actifs}         color="#F0A30A" />
          <KpiCard label="Sessions en cours"   value={sessionEnCours} color="#F07900" />
          <KpiCard label="Diplômes en attente" value={dipEnAttente}   color="#8B0073" />
          <KpiCard label="Soutenances planif." value={souPlanifie}    color="#0D2147" />
        </motion.div>

        {/* Tabs */}
        <div className="flex gap-1 p-1 bg-[#161B22] border border-[#21262D] rounded-xl overflow-x-auto">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-all flex-1 justify-center ${
                tab === t.id ? 'bg-[#F01F38] text-white' : 'text-[#8B949E] hover:text-[#E6EDF3]'
              }`}
            >
              <t.icon size={12} />
              {t.label}
            </button>
          ))}
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <RefreshCw size={20} className="animate-spin text-[#484F58]" />
          </div>
        ) : tenantId ? (
          <motion.div
            key={tab}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            className="p-5 bg-[#161B22] border border-[#21262D] rounded-xl"
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

'use client'

import { useState, useRef, useCallback } from 'react'
import {
  Sparkles, FileText, Users, Megaphone, CalendarClock,
  ScrollText, Star, TrendingUp, AlertTriangle,
  Lock, ChevronRight, Download, Loader2, RotateCcw,
  CheckCircle, Copy, Check, GitCompare, UserCheck,
  Crown, Zap, Shield,
} from 'lucide-react'
import { useTenantContext } from '@/lib/contexts/TenantContext'
import { useTenant } from '@/lib/hooks/useTenant'

// ── Types ─────────────────────────────────────────────────────────────────────

type Plan = 'tpe' | 'pme' | 'grande'
type ToolId =
  | 'analyser_cv' | 'comparer_cvs' | 'fiche_poste' | 'annonce_emploi'
  | 'preparer_entretien' | 'generer_contrat' | 'evaluation_collaborateur'
  | 'plan_carriere' | 'risques_rh'

interface Tool {
  id: ToolId
  label: string
  description: string
  icon: React.ElementType
  tier: 'standard' | 'expert' | 'executive'
  color: string
  inputs: ToolInput[]
}

interface ToolInput {
  key: string
  label: string
  placeholder: string
  type: 'text' | 'textarea' | 'select'
  options?: string[]
  required?: boolean
  rows?: number
}

// ── Plan config ───────────────────────────────────────────────────────────────

const PLAN_CONFIG: Record<Plan, {
  label: string; color: string; bg: string; icon: React.ElementType
  tierLabel: string; tierColor: string
}> = {
  tpe:    { label: 'Entrepreneur', color: '#16A34A', bg: '#F0FDF4', icon: Zap,    tierLabel: 'Standard RH',   tierColor: '#16A34A' },
  pme:    { label: 'Business',     color: '#F59E0B', bg: '#FFFBEB', icon: Shield, tierLabel: 'Expert RH',     tierColor: '#F59E0B' },
  grande: { label: 'Compagnie',    color: '#7C3AED', bg: '#F5F3FF', icon: Crown,  tierLabel: 'Executive RH',  tierColor: '#7C3AED' },
}

const TIER_ACCESS: Record<Plan, Array<'standard' | 'expert' | 'executive'>> = {
  tpe:    ['standard'],
  pme:    ['standard', 'expert'],
  grande: ['standard', 'expert', 'executive'],
}

// ── Tools definition ──────────────────────────────────────────────────────────

const TOOLS: Tool[] = [
  // ── Standard ──
  {
    id: 'analyser_cv',
    label: 'Analyser un CV',
    description: 'Scoring, forces/faiblesses, adéquation poste, questions entretien',
    icon: FileText,
    tier: 'standard',
    color: '#2563EB',
    inputs: [
      { key: 'cv_text',    label: 'Texte du CV',         placeholder: 'Collez ici le contenu complet du CV…',         type: 'textarea', rows: 8, required: true },
      { key: 'poste',      label: 'Poste visé',          placeholder: 'ex: Chargé de recrutement senior',             type: 'text',     required: true },
      { key: 'entreprise', label: 'Entreprise / Cabinet',placeholder: 'ex: Cabinet RH Excellence Brazzaville',        type: 'text' },
      { key: 'contexte',   label: 'Contexte (optionnel)',placeholder: 'ex: startup tech, 20 employés, Congo',         type: 'text' },
    ],
  },
  {
    id: 'fiche_poste',
    label: 'Générer une fiche de poste',
    description: 'Fiche complète avec missions, profil, KPIs et conditions',
    icon: ScrollText,
    tier: 'standard',
    color: '#0891B2',
    inputs: [
      { key: 'titre',       label: 'Intitulé du poste',   placeholder: 'ex: Directeur des Ressources Humaines',        type: 'text',     required: true },
      { key: 'entreprise',  label: 'Entreprise',          placeholder: 'ex: Oraforme SA, Brazzaville',                 type: 'text' },
      { key: 'secteur',     label: 'Secteur d\'activité', placeholder: 'ex: Recrutement & placement RH',               type: 'text' },
      { key: 'niveau',      label: 'Niveau requis',       placeholder: 'ex: Bac+5, 5 ans d\'expérience minimum',       type: 'text' },
      { key: 'localisation',label: 'Localisation',        placeholder: 'ex: Brazzaville, Congo',                       type: 'text' },
      { key: 'contexte',    label: 'Contexte / Contexte', placeholder: 'ex: création de poste, remplacement, expansion', type: 'textarea', rows: 3 },
    ],
  },
  {
    id: 'annonce_emploi',
    label: 'Générer une annonce d\'emploi',
    description: 'Annonce attractive pour JobBoard, LinkedIn, site carrière',
    icon: Megaphone,
    tier: 'standard',
    color: '#16A34A',
    inputs: [
      { key: 'titre',        label: 'Intitulé du poste',  placeholder: 'ex: Commercial B2B Senior',                     type: 'text',     required: true },
      { key: 'entreprise',   label: 'Entreprise',         placeholder: 'ex: Adecco Congo',                              type: 'text' },
      { key: 'type_contrat', label: 'Type de contrat',    placeholder: '', type: 'select',
        options: ['CDI', 'CDD', 'Intérim', 'Stage', 'Freelance', 'Alternance'] },
      { key: 'localisation', label: 'Localisation',       placeholder: 'ex: Pointe-Noire, Congo',                       type: 'text' },
      { key: 'profil',       label: 'Profil recherché',   placeholder: 'ex: Bac+3 commercial, 3 ans exp vente B2B',     type: 'textarea', rows: 3 },
      { key: 'avantages',    label: 'Avantages offerts',  placeholder: 'ex: véhicule de service, mutuelle, 13e mois',   type: 'text' },
      { key: 'ton',          label: 'Ton souhaité',       placeholder: '', type: 'select',
        options: ['Professionnel', 'Dynamique', 'Formel', 'Start-up / Moderne'] },
    ],
  },
  {
    id: 'preparer_entretien',
    label: 'Préparer un entretien',
    description: 'Guide complet, questions ciblées, grille d\'évaluation',
    icon: CalendarClock,
    tier: 'standard',
    color: '#7C3AED',
    inputs: [
      { key: 'candidat',        label: 'Nom du candidat',      placeholder: 'ex: Jean-Baptiste MBEMBA',              type: 'text' },
      { key: 'poste',           label: 'Poste',                placeholder: 'ex: Responsable RH',                   type: 'text',     required: true },
      { key: 'type_entretien',  label: 'Type d\'entretien',    placeholder: '', type: 'select',
        options: ['Entretien RH initial', 'Entretien technique', 'Entretien manager', 'Entretien final DG', 'Entretien client'] },
      { key: 'duree',           label: 'Durée prévue',         placeholder: '', type: 'select',
        options: ['30 minutes', '45 minutes', '1 heure', '1h30', '2 heures'] },
      { key: 'cv_extrait',      label: 'Extrait du CV',        placeholder: 'Collez un résumé ou les points clés du CV…', type: 'textarea', rows: 5 },
      { key: 'contexte',        label: 'Contexte entreprise',  placeholder: 'ex: cabinet RH, client FMCG, recrutement urgent', type: 'text' },
    ],
  },
  // ── Expert ──
  {
    id: 'comparer_cvs',
    label: 'Comparer plusieurs CVs',
    description: 'Tableau comparatif, scoring, classement et candidat recommandé',
    icon: GitCompare,
    tier: 'expert',
    color: '#D97706',
    inputs: [
      { key: 'poste',  label: 'Poste recherché',     placeholder: 'ex: Chef de projet RH',     type: 'text', required: true },
      { key: 'nom1',   label: 'Nom Candidat 1',      placeholder: 'ex: Alice NGOMA',           type: 'text', required: true },
      { key: 'cv1',    label: 'CV Candidat 1',       placeholder: 'Collez le texte du CV 1…',  type: 'textarea', rows: 6, required: true },
      { key: 'nom2',   label: 'Nom Candidat 2',      placeholder: 'ex: Bruno MAKAYA',          type: 'text', required: true },
      { key: 'cv2',    label: 'CV Candidat 2',       placeholder: 'Collez le texte du CV 2…',  type: 'textarea', rows: 6, required: true },
      { key: 'nom3',   label: 'Nom Candidat 3 (opt)',placeholder: 'ex: Céline BOUANGA',        type: 'text' },
      { key: 'cv3',    label: 'CV Candidat 3 (opt)', placeholder: 'Collez le texte du CV 3…',  type: 'textarea', rows: 4 },
      { key: 'nom4',   label: 'Nom Candidat 4 (opt)',placeholder: '',                          type: 'text' },
      { key: 'cv4',    label: 'CV Candidat 4 (opt)', placeholder: 'Collez le texte du CV 4…',  type: 'textarea', rows: 4 },
    ],
  },
  {
    id: 'generer_contrat',
    label: 'Générer un contrat',
    description: 'CDI, CDD, intérim — modèle conforme Code du Travail OHADA',
    icon: ScrollText,
    tier: 'expert',
    color: '#059669',
    inputs: [
      { key: 'type_contrat', label: 'Type de contrat',  placeholder: '', type: 'select',
        options: ['CDI', 'CDD', 'Contrat d\'intérim', 'Contrat de stage', 'Contrat de prestation'] },
      { key: 'employeur',    label: 'Employeur (société)', placeholder: 'ex: SOPROGI SA, Brazzaville',          type: 'text', required: true },
      { key: 'salarie',      label: 'Salarié (nom complet)', placeholder: 'ex: Jean-Claude MOUKOKO',           type: 'text', required: true },
      { key: 'poste',        label: 'Poste / Fonction',    placeholder: 'ex: Chargé de recrutement',           type: 'text', required: true },
      { key: 'salaire',      label: 'Salaire brut (FCFA)', placeholder: 'ex: 350000',                          type: 'text' },
      { key: 'date_debut',   label: 'Date de début',       placeholder: 'ex: 01/07/2026',                      type: 'text' },
      { key: 'duree',        label: 'Durée (si CDD)',       placeholder: 'ex: 6 mois',                         type: 'text' },
      { key: 'localisation', label: 'Lieu de travail',      placeholder: 'ex: Brazzaville, Congo',             type: 'text' },
      { key: 'pays',         label: 'Législation',          placeholder: '', type: 'select',
        options: ['Congo-Brazzaville', 'Cameroun', 'Gabon', 'Côte d\'Ivoire', 'Sénégal', 'RDC'] },
      { key: 'clauses',      label: 'Clauses spéciales',    placeholder: 'ex: clause de non-concurrence 12 mois, véhicule de service', type: 'textarea', rows: 3 },
    ],
  },
  {
    id: 'evaluation_collaborateur',
    label: 'Évaluation collaborateur',
    description: 'Formulaire d\'évaluation annuelle complet avec objectifs et plan de développement',
    icon: UserCheck,
    tier: 'expert',
    color: '#DC2626',
    inputs: [
      { key: 'collaborateur', label: 'Collaborateur',       placeholder: 'ex: Sophie MOUKONDO',                 type: 'text', required: true },
      { key: 'poste',         label: 'Poste occupé',        placeholder: 'ex: Consultante en recrutement',      type: 'text', required: true },
      { key: 'manager',       label: 'Manager évaluateur',  placeholder: 'ex: Directeur RH',                    type: 'text' },
      { key: 'periode',       label: 'Période évaluée',     placeholder: 'ex: Janvier – Décembre 2025',         type: 'text' },
      { key: 'objectifs',     label: 'Objectifs fixés',     placeholder: 'ex: 30 placements, CA 15M FCFA, NPS client 8+', type: 'textarea', rows: 3, required: true },
      { key: 'competences',   label: 'Compétences clés du poste', placeholder: 'ex: sourcing, négociation, suivi client, reporting', type: 'textarea', rows: 3 },
    ],
  },
  // ── Executive ──
  {
    id: 'plan_carriere',
    label: 'Plan de carrière',
    description: 'Parcours personnalisé court/moyen/long terme avec formations et jalons',
    icon: TrendingUp,
    tier: 'executive',
    color: '#7C3AED',
    inputs: [
      { key: 'collaborateur', label: 'Collaborateur',         placeholder: 'ex: Paul MABANZA',                   type: 'text', required: true },
      { key: 'poste_actuel',  label: 'Poste actuel',         placeholder: 'ex: Chargé de recrutement junior',    type: 'text', required: true },
      { key: 'anciennete',    label: 'Ancienneté',           placeholder: 'ex: 2 ans',                           type: 'text' },
      { key: 'formations',    label: 'Formations & diplômes', placeholder: 'ex: Master RH, Certification HRBP', type: 'textarea', rows: 3 },
      { key: 'ambitions',     label: 'Ambitions exprimées',   placeholder: 'ex: devenir DRH dans 5 ans, créer son cabinet', type: 'textarea', rows: 3 },
      { key: 'points_forts',  label: 'Points forts identifiés', placeholder: 'ex: leadership, sens commercial, maîtrise Excel', type: 'textarea', rows: 2 },
      { key: 'contexte',      label: 'Entreprise / secteur',  placeholder: 'ex: cabinet RH de 15 personnes, secteur recrutement', type: 'text' },
      { key: 'horizon',       label: 'Horizon du plan',       placeholder: '', type: 'select',
        options: ['1 an', '2 ans', '3 ans', '5 ans', '10 ans'] },
    ],
  },
  {
    id: 'risques_rh',
    label: 'Détecter les risques RH',
    description: 'Audit risques légaux, opérationnels, sociaux et financiers avec plan d\'action',
    icon: AlertTriangle,
    tier: 'executive',
    color: '#DC2626',
    inputs: [
      { key: 'contexte',    label: 'Contexte entreprise',  placeholder: 'ex: cabinet RH, 25 employés, Congo, croissance rapide', type: 'text', required: true },
      { key: 'effectif',    label: 'Effectif total',       placeholder: 'ex: 25 permanents, 40 mis à disposition', type: 'text' },
      { key: 'situation',   label: 'Situation à analyser', placeholder: 'Décrivez les situations, tensions, dysfonctionnements observés…\nex: 3 démissions ce trimestre, retards paiement CNSS, 2 litiges prud\'hommes en cours…', type: 'textarea', rows: 8, required: true },
      { key: 'indicateurs', label: 'Indicateurs disponibles', placeholder: 'ex: taux absentéisme 12%, turnover 28% annuel, NPS employés 6/10', type: 'textarea', rows: 3 },
    ],
  },
]

// ── Tier label helper ──────────────────────────────────────────────────────────

const TIER_META = {
  standard:  { label: 'Standard',  color: '#16A34A', bg: '#F0FDF4', icon: Zap },
  expert:    { label: 'Expert',    color: '#F59E0B', bg: '#FFFBEB', icon: Shield },
  executive: { label: 'Executive', color: '#7C3AED', bg: '#F5F3FF', icon: Crown },
}

// ── Markdown-like formatter ────────────────────────────────────────────────────

function FormatOutput({ text }: { text: string }) {
  const lines = text.split('\n')
  return (
    <div className="space-y-1">
      {lines.map((line, i) => {
        if (line.startsWith('# ')) {
          return <h2 key={i} className="text-[16px] font-black text-[#0F172A] mt-4 mb-1">{line.slice(2)}</h2>
        }
        if (line.startsWith('## ')) {
          return <h3 key={i} className="text-[14px] font-bold text-[#1E293B] mt-3 mb-0.5">{line.slice(3)}</h3>
        }
        if (line.match(/^\*\*(.+)\*\*$/)) {
          return <p key={i} className="text-[13px] font-bold text-[#0F172A] mt-2">{line.replace(/\*\*/g, '')}</p>
        }
        if (line.startsWith('- ') || line.startsWith('• ')) {
          const content = line.slice(2).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
          return (
            <div key={i} className="flex gap-2 items-start">
              <span className="text-[#F59E0B] mt-1 shrink-0">•</span>
              <p className="text-[13px] text-[#374151] leading-relaxed flex-1"
                dangerouslySetInnerHTML={{ __html: content }} />
            </div>
          )
        }
        if (line.match(/^\d+\. /)) {
          const content = line.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
          return (
            <p key={i} className="text-[13px] text-[#374151] leading-relaxed font-medium"
              dangerouslySetInnerHTML={{ __html: content }} />
          )
        }
        if (line.trim() === '') {
          return <div key={i} className="h-2" />
        }
        const content = line.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        return (
          <p key={i} className="text-[13px] text-[#374151] leading-relaxed"
            dangerouslySetInnerHTML={{ __html: content }} />
        )
      })}
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function MIAARHExpertPage() {
  const { tenant } = useTenantContext()
  const { tenantId } = useTenant()

  const plan: Plan = (tenant?.taille as Plan) ?? 'tpe'
  const planCfg = PLAN_CONFIG[plan]
  const PlanIcon = planCfg.icon
  const accessibleTiers = TIER_ACCESS[plan]

  const [activeTool, setActiveTool]   = useState<Tool>(TOOLS[0])
  const [inputs,     setInputs]       = useState<Record<string, string>>({})
  const [result,     setResult]       = useState<string | null>(null)
  const [loading,    setLoading]      = useState(false)
  const [error,      setError]        = useState<string | null>(null)
  const [copied,     setCopied]       = useState(false)
  const resultRef = useRef<HTMLDivElement>(null)

  const canUse = (tool: Tool) => accessibleTiers.includes(tool.tier)

  const handleToolSelect = useCallback((tool: Tool) => {
    setActiveTool(tool)
    setInputs({})
    setResult(null)
    setError(null)
  }, [])

  const handleInputChange = useCallback((key: string, val: string) => {
    setInputs(prev => ({ ...prev, [key]: val }))
  }, [])

  const handleGenerate = useCallback(async () => {
    if (!tenantId) return
    setLoading(true)
    setError(null)
    setResult(null)
    try {
      const res = await fetch('/api/miaa/rh-expert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tool:     activeTool.id,
          inputs,
          tenantId,
          plan,
        }),
      })
      const data = await res.json() as { text?: string; error?: string; required?: string }
      if (!res.ok) {
        if (data.error === 'PLAN_UPGRADE_REQUIRED') {
          const req = data.required === 'grande' ? 'Compagnie (Executive RH)' : 'Business (Expert RH)'
          setError(`Cet outil nécessite le plan ${req}. Upgradez votre abonnement pour y accéder.`)
        } else {
          setError(data.error ?? 'Erreur serveur')
        }
        return
      }
      setResult(data.text ?? '')
      setTimeout(() => resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100)
    } catch {
      setError('Erreur de connexion. Vérifiez votre connexion internet.')
    } finally {
      setLoading(false)
    }
  }, [activeTool.id, inputs, tenantId, plan])

  const handleCopy = useCallback(async () => {
    if (!result) return
    await navigator.clipboard.writeText(result)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [result])

  const handleDownload = useCallback(() => {
    if (!result) return
    const blob = new Blob([result], { type: 'text/plain;charset=utf-8' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = `miaa-rh-${activeTool.id}-${Date.now()}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }, [result, activeTool.id])

  const requiredFilled = activeTool.inputs
    .filter(i => i.required)
    .every(i => (inputs[i.key] ?? '').trim().length > 0)

  // Group tools by tier
  const tiers: Array<{ id: 'standard' | 'expert' | 'executive'; tools: Tool[] }> = [
    { id: 'standard',  tools: TOOLS.filter(t => t.tier === 'standard')  },
    { id: 'expert',    tools: TOOLS.filter(t => t.tier === 'expert')    },
    { id: 'executive', tools: TOOLS.filter(t => t.tier === 'executive') },
  ]

  return (
    <div className="min-h-screen bg-[#F8FAFC]">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="bg-gradient-to-r from-[#0F172A] via-[#1E293B] to-[#0F172A] px-6 py-5">
        <div className="max-w-screen-xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl flex items-center justify-center"
              style={{ background: planCfg.color + '25' }}>
              <Sparkles size={20} style={{ color: planCfg.color }} />
            </div>
            <div>
              <h1 className="text-white font-black text-[18px] leading-tight">
                MIAA+ RH Expert
              </h1>
              <p className="text-[#94A3B8] text-[11px]">
                Intelligence Artificielle RH — Recrutement &amp; Gestion du Personnel
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl border"
            style={{ background: planCfg.color + '18', borderColor: planCfg.color + '40' }}>
            <PlanIcon size={13} style={{ color: planCfg.color }} />
            <span className="text-[12px] font-bold" style={{ color: planCfg.color }}>
              {planCfg.tierLabel}
            </span>
          </div>
        </div>
      </div>

      <div className="max-w-screen-xl mx-auto px-4 py-6 flex gap-5">

        {/* ── Left: Tool Picker ───────────────────────────────────────────── */}
        <aside className="w-[260px] shrink-0 space-y-4">
          {tiers.map(({ id: tier, tools }) => {
            const meta    = TIER_META[tier]
            const TierIcon = meta.icon
            const locked  = !accessibleTiers.includes(tier)
            return (
              <div key={tier}>
                {/* Tier header */}
                <div className="flex items-center gap-2 mb-2 px-1">
                  <div className="w-5 h-5 rounded-md flex items-center justify-center"
                    style={{ background: meta.bg }}>
                    {locked
                      ? <Lock size={10} style={{ color: meta.color }} />
                      : <TierIcon size={10} style={{ color: meta.color }} />
                    }
                  </div>
                  <span className="text-[11px] font-bold uppercase tracking-wide"
                    style={{ color: locked ? '#94A3B8' : meta.color }}>
                    {meta.label}
                  </span>
                  {locked && (
                    <span className="ml-auto text-[9px] text-[#94A3B8] bg-[#F1F5F9] px-1.5 py-0.5 rounded-full font-medium">
                      {tier === 'expert' ? 'Business' : 'Compagnie'}
                    </span>
                  )}
                </div>

                {/* Tool cards */}
                <div className="space-y-1">
                  {tools.map(tool => {
                    const Icon    = tool.icon
                    const active  = activeTool.id === tool.id
                    const isLocked = locked
                    return (
                      <button
                        key={tool.id}
                        onClick={() => !isLocked && handleToolSelect(tool)}
                        disabled={isLocked}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all
                          ${isLocked ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer hover:bg-white hover:shadow-sm'}
                          ${active && !isLocked ? 'bg-white shadow-md border border-[#E2E8F0]' : ''}
                        `}
                      >
                        <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                          style={{ background: active ? tool.color + '18' : '#F1F5F9' }}>
                          {isLocked
                            ? <Lock size={12} className="text-[#94A3B8]" />
                            : <Icon size={13} style={{ color: active ? tool.color : '#64748B' }} />
                          }
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-[12px] font-semibold truncate
                            ${active ? 'text-[#0F172A]' : 'text-[#374151]'}`}>
                            {tool.label}
                          </p>
                        </div>
                        {active && !isLocked && (
                          <ChevronRight size={12} style={{ color: tool.color }} className="shrink-0" />
                        )}
                      </button>
                    )
                  })}
                </div>
              </div>
            )
          })}

          {/* Upgrade CTA */}
          {plan !== 'grande' && (
            <div className="mt-4 rounded-xl border border-[#7C3AED]/20 bg-[#F5F3FF] p-3">
              <div className="flex items-center gap-2 mb-1.5">
                <Crown size={13} className="text-[#7C3AED]" />
                <span className="text-[11px] font-bold text-[#7C3AED]">Débloquer plus d&apos;outils</span>
              </div>
              <p className="text-[10px] text-[#6B7280] leading-relaxed">
                {plan === 'tpe'
                  ? 'Passez en Business pour accéder aux outils Expert : comparaison CVs, contrats, évaluations.'
                  : 'Passez en Compagnie pour débloquer les plans de carrière et l\'audit risques RH.'}
              </p>
              <a href="/dashboard/abonnement"
                className="mt-2 block text-center text-[11px] font-bold text-[#7C3AED] bg-white border border-[#7C3AED]/30 rounded-lg py-1.5 hover:bg-[#7C3AED] hover:text-white transition-colors">
                Voir les offres
              </a>
            </div>
          )}
        </aside>

        {/* ── Right: Tool Form + Result ───────────────────────────────────── */}
        <div className="flex-1 min-w-0 space-y-4">

          {/* Tool header */}
          <div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-sm p-5">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0"
                style={{ background: activeTool.color + '15' }}>
                <activeTool.icon size={22} style={{ color: activeTool.color }} />
              </div>
              <div>
                <div className="flex items-center gap-2 mb-0.5">
                  <h2 className="text-[17px] font-black text-[#0F172A]">{activeTool.label}</h2>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                    style={{
                      color: TIER_META[activeTool.tier].color,
                      background: TIER_META[activeTool.tier].bg,
                    }}>
                    {TIER_META[activeTool.tier].label}
                  </span>
                </div>
                <p className="text-[13px] text-[#64748B]">{activeTool.description}</p>
              </div>
            </div>
          </div>

          {/* ── Inputs form ── */}
          {canUse(activeTool) && (
            <div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-sm p-5">
              <h3 className="text-[13px] font-bold text-[#0F172A] mb-4 flex items-center gap-2">
                <span className="w-5 h-5 bg-[#F1F5F9] rounded-md flex items-center justify-center text-[10px]">1</span>
                Remplissez les informations
              </h3>
              <div className="grid grid-cols-1 gap-4">
                {activeTool.inputs.map(input => (
                  <div key={input.key}>
                    <label className="block text-[12px] font-semibold text-[#374151] mb-1.5">
                      {input.label}
                      {input.required && <span className="text-red-500 ml-0.5">*</span>}
                    </label>
                    {input.type === 'textarea' ? (
                      <textarea
                        value={inputs[input.key] ?? ''}
                        onChange={e => handleInputChange(input.key, e.target.value)}
                        placeholder={input.placeholder}
                        rows={input.rows ?? 4}
                        className="w-full rounded-xl border border-[#E2E8F0] px-3 py-2.5 text-[13px] text-[#0F172A]
                          placeholder:text-[#CBD5E1] resize-y focus:outline-none focus:ring-2
                          focus:ring-[#F59E0B]/30 focus:border-[#F59E0B] bg-[#FAFAFA]"
                      />
                    ) : input.type === 'select' ? (
                      <select
                        value={inputs[input.key] ?? ''}
                        onChange={e => handleInputChange(input.key, e.target.value)}
                        className="w-full rounded-xl border border-[#E2E8F0] px-3 py-2.5 text-[13px] text-[#0F172A]
                          focus:outline-none focus:ring-2 focus:ring-[#F59E0B]/30 focus:border-[#F59E0B] bg-[#FAFAFA]"
                      >
                        <option value="">Sélectionnez…</option>
                        {input.options?.map(opt => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type="text"
                        value={inputs[input.key] ?? ''}
                        onChange={e => handleInputChange(input.key, e.target.value)}
                        placeholder={input.placeholder}
                        className="w-full rounded-xl border border-[#E2E8F0] px-3 py-2.5 text-[13px] text-[#0F172A]
                          placeholder:text-[#CBD5E1] focus:outline-none focus:ring-2
                          focus:ring-[#F59E0B]/30 focus:border-[#F59E0B] bg-[#FAFAFA]"
                      />
                    )}
                  </div>
                ))}
              </div>

              <div className="mt-5 flex items-center gap-3">
                <button
                  onClick={handleGenerate}
                  disabled={loading || !requiredFilled}
                  className="flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-[13px] text-white
                    transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{ background: loading ? '#94A3B8' : activeTool.color }}
                >
                  {loading ? (
                    <><Loader2 size={15} className="animate-spin" />Génération en cours…</>
                  ) : (
                    <><Sparkles size={15} />Générer avec MIAA+</>
                  )}
                </button>
                {(result || error) && (
                  <button
                    onClick={() => { setResult(null); setError(null); setInputs({}) }}
                    className="flex items-center gap-1.5 px-4 py-3 rounded-xl font-medium text-[12px]
                      text-[#64748B] hover:text-[#0F172A] hover:bg-[#F1F5F9] transition-colors"
                  >
                    <RotateCcw size={13} />Recommencer
                  </button>
                )}
              </div>
            </div>
          )}

          {/* ── Locked state ── */}
          {!canUse(activeTool) && (
            <div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-sm p-8 text-center">
              <div className="w-14 h-14 mx-auto mb-4 rounded-2xl flex items-center justify-center bg-[#F1F5F9]">
                <Lock size={24} className="text-[#94A3B8]" />
              </div>
              <h3 className="text-[15px] font-bold text-[#0F172A] mb-1">Outil réservé</h3>
              <p className="text-[13px] text-[#64748B] mb-4">
                {activeTool.tier === 'expert'
                  ? 'Cet outil est disponible à partir du plan Business (Expert RH).'
                  : 'Cet outil est disponible avec le plan Compagnie (Executive RH).'}
              </p>
              <a href="/dashboard/abonnement"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-[13px]
                  text-white transition-colors"
                style={{ background: TIER_META[activeTool.tier].color }}>
                <Crown size={14} />Upgrader mon plan
              </a>
            </div>
          )}

          {/* ── Error ── */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex gap-3">
              <AlertTriangle size={18} className="text-red-500 shrink-0 mt-0.5" />
              <p className="text-[13px] text-red-700">{error}</p>
            </div>
          )}

          {/* ── Result ── */}
          {result && (
            <div ref={resultRef} className="bg-white rounded-2xl border border-[#E2E8F0] shadow-sm overflow-hidden">
              {/* Result header */}
              <div className="flex items-center justify-between px-5 py-3 border-b border-[#F1F5F9]"
                style={{ background: activeTool.color + '08' }}>
                <div className="flex items-center gap-2">
                  <CheckCircle size={16} style={{ color: activeTool.color }} />
                  <span className="text-[13px] font-bold" style={{ color: activeTool.color }}>
                    Résultat MIAA+ — {activeTool.label}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleCopy}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium
                      text-[#64748B] hover:text-[#0F172A] hover:bg-[#F1F5F9] transition-colors"
                  >
                    {copied ? <><Check size={12} className="text-green-500" />Copié</> : <><Copy size={12} />Copier</>}
                  </button>
                  <button
                    onClick={handleDownload}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium
                      text-[#64748B] hover:text-[#0F172A] hover:bg-[#F1F5F9] transition-colors"
                  >
                    <Download size={12} />Télécharger
                  </button>
                </div>
              </div>

              {/* Result body */}
              <div className="p-6 max-h-[600px] overflow-y-auto">
                <FormatOutput text={result} />
              </div>

              {/* Footer */}
              <div className="px-5 py-3 bg-[#F8FAFC] border-t border-[#F1F5F9] flex items-center gap-2">
                <Sparkles size={12} className="text-[#F59E0B]" />
                <p className="text-[10px] text-[#94A3B8]">
                  Généré par MIAA+ {planCfg.tierLabel} — Document à relire et adapter avant utilisation officielle.
                </p>
              </div>
            </div>
          )}

          {/* ── Loading skeleton ── */}
          {loading && (
            <div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-sm p-8">
              <div className="flex flex-col items-center justify-center gap-4 text-center">
                <div className="relative">
                  <div className="w-14 h-14 rounded-2xl flex items-center justify-center"
                    style={{ background: activeTool.color + '15' }}>
                    <Sparkles size={24} style={{ color: activeTool.color }} className="animate-pulse" />
                  </div>
                  <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-[#F59E0B] flex items-center justify-center">
                    <Loader2 size={11} className="text-white animate-spin" />
                  </div>
                </div>
                <div>
                  <p className="text-[14px] font-bold text-[#0F172A]">MIAA+ analyse votre demande…</p>
                  <p className="text-[12px] text-[#64748B] mt-1">
                    Génération en cours — cela peut prendre 10 à 30 secondes
                  </p>
                </div>
                <div className="w-full max-w-xs space-y-2">
                  {[80, 60, 70].map((w, i) => (
                    <div key={i} className="h-2.5 rounded-full bg-[#F1F5F9] animate-pulse"
                      style={{ width: `${w}%`, animationDelay: `${i * 0.2}s` }} />
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── Idle state (no result yet) ── */}
          {!result && !loading && !error && canUse(activeTool) && (
            <div className="bg-white rounded-2xl border border-dashed border-[#E2E8F0] p-8 text-center">
              <activeTool.icon size={32} className="mx-auto mb-3" style={{ color: activeTool.color + '80' }} />
              <p className="text-[13px] font-semibold text-[#94A3B8]">
                Remplissez le formulaire ci-dessus puis cliquez sur <strong>Générer avec MIAA+</strong>
              </p>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}

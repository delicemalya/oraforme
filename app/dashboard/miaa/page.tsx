'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Send, FileText, Loader2, Trash2,
  ChevronDown, ChevronUp, Sparkles, Paperclip, Download, X, Brain,
  BookOpen, Calculator, Users, Shield, Scale, GraduationCap,
  ChefHat, Building2, Heart, Stethoscope, Leaf,
  Landmark, Zap, PanelRightOpen, PanelRightClose,
  type LucideIcon,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useLocale } from '@/lib/hooks/useLocale'
import { useTenant } from '@/lib/hooks/useTenant'
import { useTenantContext } from '@/lib/contexts/TenantContext'
import { getTenantBrandColor } from '@/lib/utils'
import { getMiaaFiscalContext } from '@/lib/miaa-fiscal-router'

// ── Expert persona config ─────────────────────────────────────────────────────

interface ExpertPersona {
  id: string
  labelKey: string
  descKey: string
  icon: LucideIcon
  color: string
  sectors: string[] | null // null = universal (always shown)
}

const EXPERTS: ExpertPersona[] = [
  // Sector-specific (shown first when sector matches)
  { id: 'medecin',    labelKey: 'miaa.expert.medecin',    descKey: 'miaa.expert.medecinDesc',    icon: Stethoscope,    color: '#E8633A', sectors: ['sante', 'clinique', 'hopital'] },
  { id: 'gyneco',     labelKey: 'miaa.expert.gyneco',     descKey: 'miaa.expert.gynecoDesc',     icon: Heart,          color: '#EC4899', sectors: ['sante', 'clinique', 'hopital'] },
  { id: 'pharmacien', labelKey: 'miaa.expert.pharmacien', descKey: 'miaa.expert.pharmacienDesc', icon: Shield,         color: '#16A34A', sectors: ['pharmacie'] },
  { id: 'cuisinier',  labelKey: 'miaa.expert.cuisinier',  descKey: 'miaa.expert.cuisinierDesc',  icon: ChefHat,        color: '#FF6B35', sectors: ['restaurant'] },
  { id: 'hotelier',   labelKey: 'miaa.expert.hotelier',   descKey: 'miaa.expert.hotelierDesc',   icon: Building2,      color: '#0891B2', sectors: ['hotel'] },
  { id: 'pedagogue',  labelKey: 'miaa.expert.pedagogue',  descKey: 'miaa.expert.pedagogueDesc',  icon: GraduationCap,  color: '#2563EB', sectors: ['ecole', 'universite', 'academie'] },
  { id: 'btp',        labelKey: 'miaa.expert.btp',        descKey: 'miaa.expert.btpDesc',        icon: Building2,      color: '#78716C', sectors: ['btp'] },
  { id: 'agronome',   labelKey: 'miaa.expert.agronome',   descKey: 'miaa.expert.agronomeDesc',   icon: Leaf,           color: '#15803D', sectors: ['agriculture'] },
  { id: 'ong',        labelKey: 'miaa.expert.ong',        descKey: 'miaa.expert.ongDesc',        icon: Heart,          color: '#7C3AED', sectors: ['ong'] },
  { id: 'banquier',   labelKey: 'miaa.expert.banquier',   descKey: 'miaa.expert.banquierDesc',   icon: Landmark,       color: '#2563EB', sectors: ['banque'] },
  { id: 'assureur',   labelKey: 'miaa.expert.assureur',   descKey: 'miaa.expert.assureurDesc',   icon: Shield,         color: '#DC2626', sectors: ['assurance', 'compagnie_assurance', 'courtier_assurance', 'agent_assurance'] },
  // Universal (always shown)
  { id: 'comptable',  labelKey: 'miaa.expert.comptable',  descKey: 'miaa.expert.comptableDesc',  icon: BookOpen,       color: '#6366F1', sectors: null },
  { id: 'fiscaliste', labelKey: 'miaa.expert.fiscaliste', descKey: 'miaa.expert.fiscalisteDesc', icon: Calculator,     color: '#F59E0B', sectors: null },
  { id: 'rh',         labelKey: 'miaa.expert.rh',         descKey: 'miaa.expert.rhDesc',         icon: Users,          color: '#7C3AED', sectors: null },
  { id: 'auditeur',   labelKey: 'miaa.expert.auditeur',   descKey: 'miaa.expert.auditeurDesc',   icon: Shield,         color: '#DC2626', sectors: null },
  { id: 'juridique',  labelKey: 'miaa.expert.juridique',  descKey: 'miaa.expert.juridiqueDesc',  icon: Scale,          color: '#0891B2', sectors: null },
]

function getFilteredExperts(secteur: string | null, t: (k: string) => string): Array<ExpertPersona & { label: string; desc: string }> {
  const sector = secteur?.toLowerCase() ?? ''
  const sector_experts = EXPERTS.filter(e => e.sectors && e.sectors.includes(sector))
  const universal = EXPERTS.filter(e => e.sectors === null)
  return [...sector_experts, ...universal].map(e => ({
    ...e,
    label: t(e.labelKey),
    desc: t(e.descKey),
  }))
}

// ── Agent display names ───────────────────────────────────────────────────────

const AGENT_LABELS: Record<string, { label: string; color: string; emoji: string }> = {
  comptabilite: { label: 'Finance',     color: '#6366F1', emoji: '📊' },
  rh:           { label: 'RH',          color: '#7C5CBF', emoji: '👥' },
  facturation:  { label: 'Commercial',  color: '#F59E0B', emoji: '💰' },
  fiscalite:    { label: 'Fiscalité',   color: '#F59E0B', emoji: '🧾' },
  tresorerie:   { label: 'Trésorerie',  color: '#2563EB', emoji: '💵' },
  stock:        { label: 'Stock',       color: '#16A34A', emoji: '📦' },
  crm:          { label: 'Commercial',  color: '#F59E0B', emoji: '🤝' },
  restaurant:   { label: 'Restaurant',  color: '#FF6B35', emoji: '🍽️' },
  ecole:        { label: 'École',       color: '#2EA8E0', emoji: '🎓' },
  sante:        { label: 'Santé',       color: '#E8633A', emoji: '🏥' },
  hotel:        { label: 'Hôtel',       color: '#0891B2', emoji: '🏨' },
  cabinet:      { label: 'Cabinet',     color: '#7C3AED', emoji: '🏛️' },
  audit:        { label: 'Audit IA',    color: '#DC2626', emoji: '🛡️' },
  assurance:    { label: 'Assurance',   color: '#DC2626', emoji: '🛡️' },
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface Message {
  role: 'user' | 'bot'
  text: string
  ts?: number
  peut_telecharger?: boolean
  contenu_telechargeable?: string
  fichier_analyse?: string
  agent_detected?: string
}

// ── Accepted file types ───────────────────────────────────────────────────────

const FICHIERS_ACCEPTES: Record<string, string> = {
  comptabilite: '.pdf,.xlsx,.xls,.csv,.doc,.docx',
  rh:           '.pdf,.doc,.docx,.xlsx,.xls',
  facturation:  '.pdf,.doc,.docx,.xlsx',
  stock:        '.xlsx,.xls,.csv,.pdf',
  ecole:        '.pdf,.doc,.docx,.xlsx,.jpg,.png',
  default:      '.pdf,.doc,.docx,.xlsx,.xls,.csv,.jpg,.png',
}

// ── MIAA+ Logo ────────────────────────────────────────────────────────────────

function MIAALogo({ size = 38 }: { size?: number }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/miaa-logo.png"
      alt="MIAA+"
      width={size}
      height={size}
      className="shrink-0 rounded-full object-contain"
      style={{ width: size, height: size }}
    />
  )
}

function MIAAAvatar({ size = 32, color }: { size?: number; color: string }) {
  return (
    <div
      className="shrink-0 flex items-center justify-center rounded-full"
      style={{ width: size, height: size, background: color }}
    >
      <Sparkles size={size * 0.45} color="white" />
    </div>
  )
}

// ── Text formatter ────────────────────────────────────────────────────────────

function formatText(text: string) {
  return text
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\n/g, '<br />')
}

// ── Download helper ───────────────────────────────────────────────────────────

function downloadTxt(content: string) {
  const clean = content.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&')
  const blob = new Blob([clean], { type: 'text/plain;charset=utf-8' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = `miaa-rapport-${Date.now()}.txt`
  a.click()
  URL.revokeObjectURL(url)
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload  = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

// ── Quick navigation ──────────────────────────────────────────────────────────

const NAV_SHORTCUTS = [
  { href: '/dashboard/miaa/agent',     key: 'miaa.experts.nav.agent',    icon: Zap },
  { href: '/dashboard/miaa/rapports',  key: 'miaa.experts.nav.rapports', icon: FileText },
  { href: '/dashboard/miaa/expertise', key: 'miaa.experts.nav.docs',     icon: Sparkles },
] as const

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function MIAAPage() {
  const { t, locale } = useLocale()
  const { tenantId, prenom, nom, nomEntreprise } = useTenant()
  const { tenant } = useTenantContext()
  const secteur   = tenant?.secteur ?? null
  const paysCode  = tenant?.pays ?? null
  const fiscalCtx = paysCode ? getMiaaFiscalContext(paysCode) : null
  const brandColor = tenantId ? getTenantBrandColor(tenantId) : '#F59E0B'
  const searchParams = useSearchParams()
  const contextSecteur = searchParams.get('context') ?? undefined
  const gedDocumentId  = searchParams.get('documentId') ?? null

  const [agentActif,     setAgentActif]     = useState<string>('comptabilite')
  const [activeExpert,   setActiveExpert]   = useState<string | null>(null)
  const [messages,       setMessages]       = useState<Message[]>([])
  const [input,          setInput]          = useState('')
  const [loading,        setLoading]        = useState(false)
  const [entreprise,     setEntreprise]     = useState('')
  const [modulesActifs,  setModulesActifs]  = useState<string[]>([])
  const [expandedCat,    setExpandedCat]    = useState<number | null>(0)
  const [fichierJoint,   setFichierJoint]   = useState<File | null>(null)
  const [uploadLoading,  setUploadLoading]  = useState(false)
  const [rightOpen,      setRightOpen]      = useState(true) // mobile toggle
  const [gedContext,     setGedContext]     = useState<string | null>(null)
  const [gedDocNom,      setGedDocNom]      = useState<string | null>(null)

  const bottomRef   = useRef<HTMLDivElement>(null)
  const inputRef    = useRef<HTMLInputElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const displayName = prenom
    ? [prenom, nom].filter(Boolean).join(' ')
    : (nomEntreprise ?? null)

  const currentLocale = locale || 'fr'

  function getGreeting() {
    const h = new Date().getHours()
    return h < 12 ? t('miaa.greetMorning') : h < 18 ? t('miaa.greetAfternoon') : t('miaa.greetEvening')
  }

  // Context-aware greeting — uses ?context=module URL param
  function buildGreeting(nom: string) {
    const salut = getGreeting()
    const ctx = contextSecteur ?? secteur
    if (ctx) {
      const ctxKey = `miaa.ctx.${ctx}`
      const ctxVal = t(ctxKey)
      // if key exists (translated value differs from key)
      if (ctxVal && ctxVal !== ctxKey) {
        const body = ctxVal.replace(/\{entreprise\}/g, nom || 'votre entreprise')
        return `${salut} ! ${body}`
      }
    }
    return nom
      ? `${salut} ! ${t('miaa.greetWithCompany').replace('{entreprise}', nom)}`
      : `${salut} ! ${t('miaa.greetNoCompany')}`
  }

  // Quick suggestion categories (dynamic per context)
  const QUICK_CATEGORIES = [
    {
      label: t('miaa.quick.fiscal'),
      actions: [
        t('miaa.suggest.tva'),
        t('miaa.suggest.net'),
        t('miaa.suggest.cnss'),
        currentLocale === 'fr'
          ? "Quelles sont les tranches de l'IRPP Congo ?"
          : "What are the Congo IRPP brackets?",
      ],
    },
    {
      label: t('miaa.quick.facturation'),
      actions: currentLocale === 'fr'
        ? [
            'Explique les règles de facturation OHADA',
            'Comment rédiger une relance de facture impayée ?',
            'Quel est le délai légal de paiement en Congo ?',
            'Comment gérer les avoirs et remises ?',
          ]
        : [
            'Explain OHADA invoicing rules',
            'How to write a late payment reminder?',
            'What is the legal payment deadline in Congo?',
            'How to manage credit notes and discounts?',
          ],
    },
    {
      label: t('miaa.quick.rh'),
      actions: currentLocale === 'fr'
        ? [
            'Quelles sont les obligations CNSS pour une PME ?',
            'Comment calculer le préavis en cas de licenciement ?',
            'Calcule le bulletin de paie pour 450 000 FCFA brut',
            'Quelles sont les allocations familiales légales ?',
          ]
        : [
            'What are the CNSS obligations for an SME?',
            'How to calculate notice period for dismissal?',
            'Calculate pay slip for 450,000 FCFA gross',
            'What are the legal family allowances?',
          ],
    },
    {
      label: t('miaa.quick.scolaire'),
      actions: currentLocale === 'fr'
        ? [
            'Comment calculer une moyenne pondérée sur 20 ?',
            'Quelles sont les règles de redoublement ?',
            'Génère un modèle de relevé de notes',
            "Comment gérer les frais d'inscription ?",
          ]
        : [
            'How to calculate a weighted average out of 20?',
            'What are the rules for grade retention?',
            'Generate a transcript template',
            'How to manage registration fees?',
          ],
    },
    {
      label: currentLocale === 'fr' ? 'Audit & Conformité' : 'Audit & Compliance',
      actions: currentLocale === 'fr'
        ? [
            'Explique mon score de conformité OHADA',
            'Comment corriger une anomalie fiscale critique ?',
            "Quels sont les risques d'un audit DGI avec TVA non déclarée ?",
            "Génère un plan d'action pour améliorer mon score d'audit",
          ]
        : [
            'Explain my OHADA compliance score',
            'How to fix a critical tax anomaly?',
            'What are the risks of a DGI audit with undeclared VAT?',
            'Generate an action plan to improve my audit score',
          ],
    },
  ]

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return
      const { data } = await supabase
        .from('profiles')
        .select('tenants(nom_entreprise, modules_actifs)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle()
      const tenant = (data?.tenants as { nom_entreprise?: string; modules_actifs?: string[] } | null)
      const nom = tenant?.nom_entreprise ?? ''
      setEntreprise(nom)
      setModulesActifs(tenant?.modules_actifs ?? [])
      setMessages([{ role: 'bot', text: buildGreeting(nom), ts: Date.now() }])
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Charger le contexte GED si un documentId est dans l'URL
  useEffect(() => {
    if (!gedDocumentId) return
    setUploadLoading(true)
    fetch(`/api/miaa/document-context?documentId=${gedDocumentId}`)
      .then(r => r.json())
      .then((data: { ok?: boolean; context?: string; detected?: string; chars?: number; message?: string }) => {
        if (data.ok && data.context) {
          setGedContext(data.context)
          const nomMatch = data.context.match(/📄 Document : (.+)/)
          const nom = nomMatch?.[1] ?? 'Document GED'
          setGedDocNom(nom)
          setMessages(prev => [...prev, {
            role: 'bot',
            text: `📄 **Document chargé : ${nom}**\n\nJ'ai accès au contenu complet de ce document (${(data.chars ?? 0).toLocaleString('fr-FR')} caractères). Posez vos questions — je répondrai en me basant sur son contenu.`,
            ts: Date.now(),
          }])
        } else {
          setMessages(prev => [...prev, { role: 'bot', text: data.message ?? 'Impossible de charger ce document.', ts: Date.now() }])
        }
      })
      .catch(() => {
        setMessages(prev => [...prev, { role: 'bot', text: 'Erreur de chargement du document.', ts: Date.now() }])
      })
      .finally(() => setUploadLoading(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gedDocumentId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading, uploadLoading])

  const send = useCallback(async (text: string) => {
    const msg = text.trim()
    if (!msg || loading) return
    setInput('')

    const newMessages: Message[] = [...messages, { role: 'user', text: msg, ts: Date.now() }]
    setMessages(newMessages)
    setLoading(true)
    inputRef.current?.focus()

    try {
      const history = newMessages
        .slice(1).slice(-10)
        .map(m => ({ role: m.role === 'user' ? 'user' as const : 'assistant' as const, content: m.text }))

      const res = await fetch('/api/miaa/chat', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          module:     'auto',
          message:    msg,
          history:    history.slice(0, -1),
          tenantData: { tenant_id: tenantId ?? undefined, secteur: contextSecteur ?? secteur, pays: paysCode ?? undefined },
          langue:     currentLocale,
          gedContext: gedContext ?? undefined,
        }),
      })
      // Guard against non-JSON responses (e.g. Vercel 504/503 HTML error pages)
      const data: Record<string, unknown> = await res.json().catch(() => ({}))
      const text = (data.response as string | undefined) ?? t('miaa.errorReply')
      if (data.agent_detected) setAgentActif(data.agent_detected as string)
      setMessages(prev => [...prev, {
        role: 'bot', text, ts: Date.now(),
        peut_telecharger: text.length > 150,
        contenu_telechargeable: text,
        agent_detected: data.agent_detected as string | undefined,
      }])
    } catch {
      setMessages(prev => [...prev, { role: 'bot', text: t('miaa.errorConnection'), ts: Date.now() }])
    } finally {
      setLoading(false)
    }
  }, [loading, messages, tenantId, secteur, contextSecteur, currentLocale, t])

  async function handleFichier(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''

    if (file.size > 10 * 1024 * 1024) {
      setMessages(prev => [...prev, { role: 'bot', text: 'Fichier trop volumineux. Limite : 10 Mo.', ts: Date.now() }])
      return
    }

    setFichierJoint(file)
    setUploadLoading(true)
    setMessages(prev => [...prev, { role: 'user', text: `[Fichier joint : ${file.name}] Analyse ce document.`, ts: Date.now() }])

    try {
      const base64 = await fileToBase64(file)
      const res = await fetch('/api/miaa/analyze-file', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ module: 'miaa', filename: file.name, filetype: file.type, filesize: file.size, base64, tenantData: { tenant_id: tenantId ?? undefined } }),
      })
      const data = await res.json()
      const analyse = data.analyse ?? 'Analyse terminée.'
      setMessages(prev => [...prev, { role: 'bot', text: analyse, ts: Date.now(), peut_telecharger: true, contenu_telechargeable: analyse, fichier_analyse: file.name }])
    } catch {
      setMessages(prev => [...prev, { role: 'bot', text: "Impossible d'analyser ce fichier.", ts: Date.now() }])
    } finally {
      setFichierJoint(null)
      setUploadLoading(false)
    }
  }

  async function demanderRapport(contexte: string) {
    if (loading) return
    setLoading(true)
    try {
      const res = await fetch('/api/miaa/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          module: agentActif, langue: currentLocale,
          message: currentLocale === 'fr'
            ? "Sur la base de ces informations, génère un rapport professionnel complet avec titre, introduction, sections numérotées et conclusion avec recommandations."
            : "Based on this information, generate a complete professional report with title, introduction, numbered sections and conclusion with recommendations.",
          history: [{ role: 'assistant', content: contexte }],
          tenantData: { tenant_id: tenantId ?? undefined, secteur: contextSecteur ?? secteur, pays: paysCode ?? undefined },
        }),
      })
      const data = await res.json()
      const rapport = data.response ?? 'Rapport généré.'
      setMessages(prev => [...prev, { role: 'bot', text: rapport, ts: Date.now(), peut_telecharger: true, contenu_telechargeable: rapport }])
    } finally {
      setLoading(false)
    }
  }

  function clearChat() {
    const salut = getGreeting()
    setActiveExpert(null)
    setMessages([{
      role: 'bot',
      text: entreprise
        ? `${salut} ! ${t('miaa.newConvWithCompany').replace('{entreprise}', entreprise)}`
        : `${salut} ! ${t('miaa.newConvNoCompany')}`,
      ts: Date.now(),
    }])
  }

  function activateExpert(expert: ExpertPersona & { label: string }) {
    setActiveExpert(expert.id)
    const msg = t('miaa.expert.activate')
      .replace('{expert}', expert.label)
      .replace('{entreprise}', entreprise || 'votre entreprise')
    send(msg)
  }

  const experts = getFilteredExperts(secteur, t)

  // ── Right panel content ─────────────────────────────────────────────────────

  const RightPanel = (
    <div className="flex flex-col gap-3">

      {/* Expert personas */}
      <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm">
        <p className="text-xs font-bold text-gray-900 mb-0.5 flex items-center gap-2">
          <Sparkles size={13} style={{ color: brandColor }} />
          {t('miaa.experts.title')}
        </p>
        <p className="text-[10px] text-gray-400 mb-3">{t('miaa.experts.hint')}</p>
        <div className="grid grid-cols-2 gap-2">
          {experts.map(exp => {
            const Icon = exp.icon
            const isActive = activeExpert === exp.id
            return (
              <motion.button
                key={exp.id}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => activateExpert(exp)}
                className={`p-2.5 rounded-xl border text-left transition-all ${
                  isActive
                    ? 'border-current shadow-sm'
                    : 'border-gray-100 bg-gray-50 hover:bg-white hover:border-gray-200 hover:shadow-sm'
                }`}
                style={isActive ? { borderColor: exp.color, background: `${exp.color}10` } : undefined}
              >
                <div className="flex items-center gap-1.5 mb-1">
                  <Icon size={12} style={{ color: exp.color }} className="shrink-0" />
                  {isActive && <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse shrink-0" />}
                </div>
                <p className="text-[10px] font-semibold text-gray-800 leading-tight">{exp.label}</p>
                <p className="text-[9px] text-gray-400 mt-0.5 leading-tight">{exp.desc}</p>
              </motion.button>
            )
          })}
        </div>
      </div>

      {/* Quick navigation */}
      <div className="flex gap-2">
        {NAV_SHORTCUTS.map(nav => {
          const Icon = nav.icon
          return (
            <Link
              key={nav.href}
              href={nav.href}
              className="flex-1 flex flex-col items-center gap-1 px-2 py-2.5 rounded-xl border border-gray-100 bg-white text-gray-500 hover:bg-gray-50 hover:text-gray-700 hover:shadow-sm transition-all"
            >
              <Icon size={13} style={{ color: brandColor }} />
              <span className="text-[9px] font-semibold text-center leading-tight">{t(nav.key)}</span>
            </Link>
          )
        })}
      </div>

      {/* Quick actions accordion */}
      <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm">
        <p className="text-xs font-bold text-gray-900 mb-3">{t('miaa.quickQuestions')}</p>
        <div className="space-y-2">
          {QUICK_CATEGORIES.map((cat, ci) => (
            <div key={cat.label} className="border border-gray-100 rounded-xl overflow-hidden">
              <button
                onClick={() => setExpandedCat(expandedCat === ci ? null : ci)}
                className="w-full flex items-center justify-between px-3 py-2 text-left hover:bg-gray-50 transition-colors"
              >
                <span className="text-xs font-medium text-gray-600">{cat.label}</span>
                {expandedCat === ci
                  ? <ChevronUp size={12} className="text-gray-400" />
                  : <ChevronDown size={12} className="text-gray-400" />
                }
              </button>
              <AnimatePresence>
                {expandedCat === ci && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.18 }}
                    className="overflow-hidden"
                  >
                    <div className="px-3 pb-2 space-y-1 border-t border-gray-100 bg-gray-50/50">
                      {cat.actions.map(a => (
                        <button
                          key={a}
                          onClick={() => send(a)}
                          className="w-full text-left text-[10px] text-gray-500 hover:text-gray-800 hover:bg-white px-2 py-1.5 rounded-lg transition-all border border-transparent hover:border-gray-100"
                        >
                          {a}
                        </button>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}
        </div>
      </div>

      {/* Upload card */}
      <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm">
        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
          <Paperclip size={10} />
          {t('miaa.uploadBtn')}
        </p>
        <p className="text-[10px] text-gray-400 leading-relaxed">{t('miaa.uploadHint')}</p>
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={loading || uploadLoading}
          className="mt-2 w-full text-[11px] font-medium py-1.5 rounded-lg border transition-all disabled:opacity-30"
          style={{ background: `${brandColor}10`, color: brandColor, borderColor: `${brandColor}30` }}
        >
          + {t('miaa.uploadBtn')}
        </button>
      </div>

      {/* Config */}
      <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm">
        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-3">{t('miaa.configTitle')}</p>
        <div className="space-y-2.5 text-[11px]">
          <div className="flex justify-between items-center">
            <span className="text-gray-500">{t('miaa.configModel')}</span>
            <span className="font-medium text-gray-700">{t('miaa.configModelValue')}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-500">{t('miaa.configLang')}</span>
            <span className="font-medium text-gray-700">{currentLocale.toUpperCase()}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-500">{t('miaa.configModules')}</span>
            <span className="font-semibold" style={{ color: brandColor }}>{modulesActifs.length}</span>
          </div>
        </div>
      </div>
    </div>
  )

  return (
    <div className="flex flex-col gap-3 lg:h-[calc(100vh-110px)] lg:min-h-[520px]">

      {/* Mobile toggle bar */}
      <div className="flex items-center justify-end lg:hidden">
        <button
          onClick={() => setRightOpen(!rightOpen)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-[11px] font-medium text-gray-600 hover:bg-gray-50 transition-all shadow-sm"
        >
          {rightOpen
            ? <><PanelRightClose size={13} /> {t('miaa.experts.title')}</>
            : <><PanelRightOpen size={13} /> {t('miaa.experts.title')}</>
          }
        </button>
      </div>

      <div className="flex flex-col lg:flex-row gap-3 flex-1 min-h-0">

        {/* ── LEFT: Chat ────────────────────────────────────────────────────── */}
        <div className="flex-1 flex flex-col bg-white border border-gray-200 rounded-2xl overflow-hidden min-h-0 shadow-sm">

          {/* Header */}
          <div
            className="flex items-center gap-3 px-4 sm:px-5 py-3.5 border-b border-gray-100 bg-white shrink-0"
            style={{ background: 'linear-gradient(135deg, #6D28D908, #DC262605, #F59E0B03)' }}
          >
            <MIAALogo size={40} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-sm font-bold text-gray-900">MIAA+</h1>
                <span
                  className="px-2 py-0.5 rounded-full text-[9px] font-black tracking-widest text-white"
                  style={{ background: 'linear-gradient(135deg, #7C3AED, #DC2626, #F59E0B)' }}
                >
                  {t('miaa.badgeExpert')}
                </span>
                {/* Active expert badge */}
                {activeExpert && (
                  <span
                    className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-semibold"
                    style={{
                      background: (EXPERTS.find(e => e.id === activeExpert)?.color ?? '#F59E0B') + '18',
                      color: EXPERTS.find(e => e.id === activeExpert)?.color ?? '#F59E0B',
                    }}
                  >
                    <Brain size={8} />
                    {t(`miaa.expert.${activeExpert}`)}
                  </span>
                )}
                {/* Module agent badge — shows after first exchange */}
                {!activeExpert && agentActif && AGENT_LABELS[agentActif] && messages.length > 1 && (
                  <span
                    className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-semibold"
                    style={{ background: AGENT_LABELS[agentActif].color + '18', color: AGENT_LABELS[agentActif].color }}
                  >
                    <Brain size={8} />
                    {AGENT_LABELS[agentActif].label}
                  </span>
                )}
                {/* Fiscal expert badge — shown when tenant has a fiscal engine */}
                {fiscalCtx && (
                  <span
                    className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-semibold"
                    style={{ background: '#F59E0B18', color: '#B45309' }}
                    title={`Administration : ${fiscalCtx.administrationFiscale}`}
                  >
                    <Calculator size={8} />
                    {fiscalCtx.expertName}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse shrink-0" />
                <p className="text-[10px] text-gray-400 truncate">
                  {displayName ? `${displayName} · ` : ''}
                  {entreprise ? `${entreprise} · ` : ''}
                  {t('miaa.subtitle')}
                </p>
              </div>
            </div>
            <button
              onClick={clearChat}
              title={t('miaa.newChat')}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors shrink-0"
            >
              <Trash2 size={14} />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 bg-gray-50/30">
            <AnimatePresence initial={false}>
              {messages.map((m, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2 }}
                  className={`flex flex-col gap-1 ${m.role === 'user' ? 'items-end' : 'items-start'}`}
                >
                  {m.fichier_analyse && (
                    <div className="flex items-center gap-1 text-[10px] text-gray-400 mb-0.5">
                      <FileText size={10} />
                      <span>{m.fichier_analyse}</span>
                    </div>
                  )}
                  <div className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'} gap-2.5 items-end w-full`}>
                    {m.role === 'bot' && (
                      <div className="shrink-0 mb-0.5">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src="/miaa-logo.png" alt="MIAA+" width={28} height={28} className="rounded-full object-contain" />
                      </div>
                    )}
                    <div
                      className={`max-w-[80%] sm:max-w-[78%] text-xs px-4 py-2.5 leading-relaxed shadow-sm ${
                        m.role === 'user'
                          ? 'rounded-2xl rounded-br-md text-white font-medium'
                          : 'rounded-2xl rounded-bl-md text-gray-800 bg-white border border-gray-100'
                      }`}
                      style={m.role === 'user' ? { background: brandColor } : undefined}
                      dangerouslySetInnerHTML={{ __html: formatText(m.text) }}
                    />
                    {m.role === 'user' && (
                      <div
                        className="shrink-0 mb-0.5 w-6 h-6 rounded-full flex items-center justify-center text-white text-[9px] font-bold"
                        style={{ background: '#CBD5E1' }}
                      >
                        {displayName ? displayName[0].toUpperCase() : 'U'}
                      </div>
                    )}
                  </div>
                  {m.role === 'bot' && m.agent_detected && AGENT_LABELS[m.agent_detected] && (
                    <div className="ml-9 mt-0.5">
                      <span className="inline-flex items-center gap-1 text-[9px] font-medium opacity-60"
                        style={{ color: AGENT_LABELS[m.agent_detected].color }}>
                        {AGENT_LABELS[m.agent_detected].emoji} {AGENT_LABELS[m.agent_detected].label}
                      </span>
                    </div>
                  )}
                  {m.role === 'bot' && m.peut_telecharger && m.contenu_telechargeable && (
                    <div className="flex gap-1.5 ml-9 mt-0.5 flex-wrap">
                      <button
                        onClick={() => downloadTxt(m.contenu_telechargeable!)}
                        className="flex items-center gap-1 px-2.5 py-1 text-[10px] bg-gray-50 text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-100 transition-all"
                      >
                        <Download size={10} />
                        {t('miaa.downloadTxt')}
                      </button>
                      <button
                        onClick={() => demanderRapport(m.contenu_telechargeable!)}
                        className="flex items-center gap-1 px-2.5 py-1 text-[10px] border rounded-lg hover:opacity-80 transition-all"
                        style={{ background: `${brandColor}12`, color: brandColor, borderColor: `${brandColor}40` }}
                      >
                        <FileText size={10} />
                        {t('miaa.generateReport')}
                      </button>
                    </div>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>

            {(loading || uploadLoading) && (
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex justify-start gap-2.5 items-end"
              >
                <div className="shrink-0 mb-0.5"><MIAAAvatar size={26} color={brandColor} /></div>
                <div className="bg-white border border-gray-100 rounded-2xl rounded-bl-md px-4 py-2.5 flex items-center gap-1.5 shadow-sm">
                  {[0, 1, 2].map(i => (
                    <motion.span
                      key={i}
                      className="w-1.5 h-1.5 rounded-full bg-gray-300"
                      animate={{ opacity: [0.3, 1, 0.3], y: [0, -2, 0] }}
                      transition={{ duration: 1.1, repeat: Infinity, delay: i * 0.22 }}
                    />
                  ))}
                  {uploadLoading && <span className="text-[10px] text-gray-400 ml-1">{t('miaa.uploadAnalyzing')}</span>}
                </div>
              </motion.div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Suggestions row */}
          {messages.length <= 1 && !loading && !uploadLoading && (
            <div className="px-4 pb-3 pt-2 flex gap-2 flex-wrap shrink-0 border-t border-gray-100 bg-white">
              <p className="w-full text-[10px] text-gray-400">{t('miaa.suggestions')} :</p>
              {[t('miaa.suggest.tva'), t('miaa.suggest.net'), t('miaa.suggest.cnss')].map(s => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  className="text-[11px] text-gray-600 hover:text-gray-900 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-full px-3 py-1 transition-all"
                >
                  {s}
                </button>
              ))}
            </div>
          )}

          {/* GED document context banner */}
          {gedContext && gedDocNom && (
            <div className="px-4 py-1.5 bg-amber-50 border-t border-amber-100 flex items-center gap-2 shrink-0">
              <FileText size={12} className="text-amber-500 shrink-0" />
              <span className="text-xs text-amber-700 flex-1 truncate font-medium">📄 {gedDocNom}</span>
              <button onClick={() => { setGedContext(null); setGedDocNom(null) }} className="text-amber-400 hover:text-amber-600"><X size={12} /></button>
            </div>
          )}

          {/* File attachment indicator */}
          {fichierJoint && (
            <div className="px-4 py-1.5 bg-blue-50 border-t border-blue-100 flex items-center gap-2 shrink-0">
              <FileText size={12} className="text-blue-500 shrink-0" />
              <span className="text-xs text-blue-600 flex-1 truncate">{fichierJoint.name}</span>
              <button onClick={() => setFichierJoint(null)} className="text-blue-400 hover:text-blue-600"><X size={12} /></button>
            </div>
          )}

          {/* Input bar */}
          <div className="flex items-center gap-2 px-4 py-3 border-t border-gray-100 bg-white shrink-0">
            <input
              ref={fileInputRef}
              type="file"
              accept={FICHIERS_ACCEPTES.default}
              onChange={handleFichier}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={loading || uploadLoading}
              title={t('miaa.uploadBtn')}
              className="w-9 h-9 flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-xl transition-all disabled:opacity-30 shrink-0"
            >
              <Paperclip size={16} />
            </button>
            <input
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send(input)}
              placeholder={t('miaa.placeholder')}
              disabled={loading || uploadLoading}
              className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-xs text-gray-900 placeholder-gray-400 outline-none transition-colors disabled:opacity-50"
              onFocus={e => { e.currentTarget.style.borderColor = brandColor; e.currentTarget.style.boxShadow = `0 0 0 3px ${brandColor}18` }}
              onBlur={e => { e.currentTarget.style.borderColor = ''; e.currentTarget.style.boxShadow = '' }}
            />
            <motion.button
              whileTap={{ scale: 0.88 }}
              onClick={() => send(input)}
              disabled={loading || uploadLoading || !input.trim()}
              className="w-9 h-9 rounded-xl flex items-center justify-center transition-all shrink-0 disabled:opacity-30"
              style={{ background: brandColor }}
            >
              {loading
                ? <Loader2 size={14} className="text-white animate-spin" />
                : <Send size={14} className="text-white" />
              }
            </motion.button>
          </div>
        </div>

        {/* ── RIGHT Mobile: collapsible below chat ───────────────────────── */}
        <AnimatePresence>
          {rightOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="lg:hidden overflow-hidden"
              style={{ overflowX: 'hidden' }}
            >
              <div className="pt-1 pb-4">{RightPanel}</div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── RIGHT Desktop: always visible right column ──────────────────── */}
        <div className="hidden lg:block w-72 shrink-0 overflow-y-auto">
          {RightPanel}
        </div>

      </div>
    </div>
  )
}

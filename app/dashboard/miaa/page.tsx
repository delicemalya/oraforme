'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Send, Calculator, BarChart2, FileText,
  Bell, Cog, Globe, Loader2, Trash2, ChevronDown, ChevronUp,
  Sparkles, Paperclip, Download, X,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useLocale } from '@/lib/hooks/useLocale'
import { useTenant } from '@/lib/hooks/useTenant'
import { getTenantBrandColor } from '@/lib/utils'

// ── Types ─────────────────────────────────────────────────────────────────────

interface Message {
  role: 'user' | 'bot'
  text: string
  ts?: number
  peut_telecharger?: boolean
  contenu_telechargeable?: string
  fichier_analyse?: string
}

// ── Accepted file types per module ────────────────────────────────────────────

const FICHIERS_ACCEPTES: Record<string, string> = {
  comptabilite: '.pdf,.xlsx,.xls,.csv,.doc,.docx',
  rh:           '.pdf,.doc,.docx,.xlsx,.xls',
  facturation:  '.pdf,.doc,.docx,.xlsx',
  stock:        '.xlsx,.xls,.csv,.pdf',
  ecole:        '.pdf,.doc,.docx,.xlsx,.jpg,.png',
  default:      '.pdf,.doc,.docx,.xlsx,.xls,.csv,.jpg,.png',
}

// ── MIAA PREMIUM Logo ─────────────────────────────────────────────────────────

function MIAALogo({ size = 38 }: { size?: number }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/logo-miaa-premium.png"
      alt="MIAA PREMIUM"
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

// ── Text formatter (bold + line breaks) ───────────────────────────────────────

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

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function MIAAPage() {
  const { t } = useLocale()
  const { tenantId, prenom, nom, nomEntreprise } = useTenant()
  const brandColor = tenantId ? getTenantBrandColor(tenantId) : '#F59E0B'

  const CAPABILITIES = [
    { icon: Calculator, label: t('miaa.cap.fiscal'),   desc: t('miaa.cap.fiscalDesc'),   color: brandColor },
    { icon: BarChart2,  label: t('miaa.cap.analyse'),  desc: t('miaa.cap.analyseDesc'),  color: '#2563EB'  },
    { icon: FileText,   label: t('miaa.cap.docs'),     desc: t('miaa.cap.docsDesc'),     color: '#16A34A'  },
    { icon: Bell,       label: t('miaa.cap.alerts'),   desc: t('miaa.cap.alertsDesc'),   color: '#DC2626'  },
    { icon: Cog,        label: t('miaa.cap.auto'),     desc: t('miaa.cap.autoDesc'),     color: '#7C3AED'  },
    { icon: Globe,      label: t('miaa.cap.multi'),    desc: t('miaa.cap.multiDesc'),    color: '#0891B2'  },
  ]

  const QUICK_CATEGORIES = [
    {
      label: t('miaa.quick.fiscal'),
      actions: [
        'Calculer TVA + CA sur 1 500 000 FCFA',
        'Calculer le net pour un brut de 600 000 FCFA',
        "Quelles sont les tranches de l'IRPP Congo ?",
        'Calculer les charges patronales CNSS sur 800 000 FCFA',
      ],
    },
    {
      label: t('miaa.quick.facturation'),
      actions: [
        'Explique les règles de facturation OHADA',
        'Comment rédiger une relance de facture impayée ?',
        'Quel est le délai légal de paiement en Congo ?',
        'Comment gérer les avoirs et remises ?',
      ],
    },
    {
      label: t('miaa.quick.rh'),
      actions: [
        'Quelles sont les obligations CNSS pour une PME ?',
        'Comment calculer le préavis en cas de licenciement ?',
        'Calcule le bulletin de paie pour 450 000 FCFA brut',
        'Quelles sont les allocations familiales légales ?',
      ],
    },
    {
      label: t('miaa.quick.scolaire'),
      actions: [
        'Comment calculer une moyenne pondérée sur 20 ?',
        'Quelles sont les règles de redoublement ?',
        'Génère un modèle de relevé de notes',
        "Comment gérer les frais d'inscription ?",
      ],
    },
  ]

  const [messages,      setMessages]      = useState<Message[]>([])
  const [input,         setInput]         = useState('')
  const [loading,       setLoading]       = useState(false)
  const [entreprise,    setEntreprise]    = useState('')
  const [modulesActifs, setModulesActifs] = useState<string[]>([])
  const [expandedCat,   setExpandedCat]   = useState<number | null>(0)
  const [fichierJoint,  setFichierJoint]  = useState<File | null>(null)
  const [uploadLoading, setUploadLoading] = useState(false)
  const bottomRef  = useRef<HTMLDivElement>(null)
  const inputRef   = useRef<HTMLInputElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Compute user display name with fallback chain: prenom → nomEntreprise → 'vous'
  const displayName = prenom
    ? [prenom, nom].filter(Boolean).join(' ')
    : (nomEntreprise ?? null)

  function getGreeting() {
  const { t } = useLocale()
    const h = new Date().getHours()
    return h < 12 ? t('miaa.greetMorning') : h < 18 ? t('miaa.greetAfternoon') : t('miaa.greetEvening')
  }

  // Load user context
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

      const salut = getGreeting()
      const greeting = nom
        ? `${salut} ! ${t('miaa.greetWithCompany').replace('{entreprise}', nom)}`
        : `${salut} ! ${t('miaa.greetNoCompany')}`
      setMessages([{ role: 'bot', text: greeting, ts: Date.now() }])
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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
          module:     'general',
          message:    msg,
          history:    history.slice(0, -1),
          tenantData: { tenant_id: tenantId ?? undefined },
          langue:     'fr',
        }),
      })
      const data = await res.json()
      const text = data.response ?? t('miaa.errorReply')
      setMessages(prev => [...prev, {
        role:                  'bot',
        text,
        ts:                    Date.now(),
        peut_telecharger:      text.length > 150,
        contenu_telechargeable: text,
      }])
    } catch {
      setMessages(prev => [...prev, { role: 'bot', text: t('miaa.errorConnection'), ts: Date.now() }])
    } finally {
      setLoading(false)
    }
  }, [loading, messages, entreprise, modulesActifs, t])

  // File upload handler
  async function handleFichier(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''

    if (file.size > 10 * 1024 * 1024) {
      setMessages(prev => [...prev, {
        role: 'bot',
        text: 'Fichier trop volumineux. Limite : 10 Mo.',
        ts: Date.now(),
      }])
      return
    }

    setFichierJoint(file)
    setUploadLoading(true)
    setMessages(prev => [...prev, {
      role: 'user',
      text: `[Fichier joint : ${file.name}] Analyse ce document.`,
      ts: Date.now(),
    }])

    try {
      const base64 = await fileToBase64(file)
      const res = await fetch('/api/miaa/analyze-file', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          module:   'miaa',
          filename: file.name,
          filetype: file.type,
          filesize: file.size,
          base64,
          tenantData: { tenant_id: tenantId ?? undefined },
        }),
      })
      const data = await res.json()
      const analyse = data.analyse ?? 'Analyse terminée.'
      setMessages(prev => [...prev, {
        role:                  'bot',
        text:                  analyse,
        ts:                    Date.now(),
        peut_telecharger:      true,
        contenu_telechargeable: analyse,
        fichier_analyse:        file.name,
      }])
    } catch {
      setMessages(prev => [...prev, {
        role: 'bot',
        text: "Impossible d'analyser ce fichier. Vérifiez le format et réessayez.",
        ts: Date.now(),
      }])
    } finally {
      setFichierJoint(null)
      setUploadLoading(false)
    }
  }

  // Ask MIAA+ to generate a full downloadable report
  async function demanderRapport(contexte: string) {
    if (loading) return
    setLoading(true)
    try {
      const res = await fetch('/api/miaa/chat', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          module:     'general',
          message:    "Sur la base de ces informations, génère un rapport professionnel complet avec titre, introduction, sections numérotées et conclusion avec recommandations.",
          history:    [{ role: 'assistant', content: contexte }],
          tenantData: { tenant_id: tenantId ?? undefined },
          langue:     'fr',
        }),
      })
      const data = await res.json()
      const rapport = data.response ?? 'Rapport généré.'
      setMessages(prev => [...prev, {
        role:                  'bot',
        text:                  rapport,
        ts:                    Date.now(),
        peut_telecharger:      true,
        contenu_telechargeable: rapport,
      }])
    } finally {
      setLoading(false)
    }
  }

  function clearChat() {
  const { t } = useLocale()
    const salut = getGreeting()
    setMessages([{
      role: 'bot',
      text: entreprise
        ? `${salut} ! ${t('miaa.newConvWithCompany').replace('{entreprise}', entreprise)}`
        : `${salut} ! ${t('miaa.newConvNoCompany')}`,
      ts: Date.now(),
    }])
  }

  return (
    <div className="flex flex-col lg:flex-row gap-5 h-[calc(100vh-120px)] min-h-[600px]">

      {/* ── LEFT: Chat ──────────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col bg-white border border-gray-200 rounded-2xl overflow-hidden min-h-0 shadow-sm">

        {/* Header MIAA PREMIUM */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100 bg-white shrink-0"
          style={{ background: 'linear-gradient(135deg, #6D28D908, #DC262605, #F59E0B03)' }}>
          <MIAALogo size={42} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-bold text-gray-900">MIAA PREMIUM</h1>
              <span className="px-2 py-0.5 rounded-full text-[9px] font-black tracking-widest text-white"
                style={{ background: 'linear-gradient(135deg, #7C3AED, #DC2626, #F59E0B)' }}>
                PREMIUM
              </span>
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
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
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
                {/* File badge */}
                {m.fichier_analyse && (
                  <div className="flex items-center gap-1 text-[10px] text-gray-400 mb-0.5">
                    <FileText size={10} />
                    <span>{m.fichier_analyse}</span>
                  </div>
                )}

                <div className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'} gap-2.5 items-end w-full`}>
                  {m.role === 'bot' && (
                    <div className="shrink-0 mb-0.5">
                      <MIAAAvatar size={26} color={brandColor} />
                    </div>
                  )}
                  <div
                    className={`max-w-[78%] text-xs px-4 py-2.5 leading-relaxed shadow-sm ${
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

                {/* Download + Report buttons on long bot messages */}
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

          {/* Typing indicator */}
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
                {uploadLoading && (
                  <span className="text-[10px] text-gray-400 ml-1">{t('miaa.uploadAnalyzing')}</span>
                )}
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

        {/* File attachment indicator */}
        {fichierJoint && (
          <div className="px-4 py-1.5 bg-blue-50 border-t border-blue-100 flex items-center gap-2 shrink-0">
            <FileText size={12} className="text-blue-500 shrink-0" />
            <span className="text-xs text-blue-600 flex-1 truncate">{fichierJoint.name}</span>
            <button onClick={() => setFichierJoint(null)} className="text-blue-400 hover:text-blue-600">
              <X size={12} />
            </button>
          </div>
        )}

        {/* Input bar */}
        <div className="flex items-center gap-2 px-4 py-3 border-t border-gray-100 bg-white shrink-0">
          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            accept={FICHIERS_ACCEPTES.default}
            onChange={handleFichier}
            className="hidden"
          />

          {/* Upload button */}
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
            onBlur={e =>  { e.currentTarget.style.borderColor = ''; e.currentTarget.style.boxShadow = '' }}
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

      {/* ── RIGHT: Capabilities + Quick Actions ─────────────────────────────── */}
      <div className="lg:w-72 flex flex-col gap-4 overflow-y-auto">

        {/* Capabilities */}
        <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm">
          <p className="text-xs font-bold text-gray-900 mb-3 flex items-center gap-2">
            <Sparkles size={14} style={{ color: brandColor }} />
            {t('miaa.capabilities')}
          </p>
          <div className="grid grid-cols-2 gap-2">
            {CAPABILITIES.map(cap => {
              const Icon = cap.icon
              return (
                <motion.div
                  key={cap.label}
                  whileHover={{ scale: 1.02 }}
                  className="p-2.5 rounded-xl border border-gray-100 bg-gray-50 cursor-default hover:bg-white hover:border-gray-200 hover:shadow-sm transition-all"
                >
                  <Icon size={14} style={{ color: cap.color }} className="mb-1.5" />
                  <p className="text-[10px] font-semibold text-gray-800 leading-tight">{cap.label}</p>
                  <p className="text-[9px] text-gray-400 mt-0.5 leading-tight">{cap.desc}</p>
                </motion.div>
              )
            })}
          </div>
        </div>

        {/* Quick actions */}
        <div className="bg-white border border-gray-200 rounded-2xl p-4 flex-1 shadow-sm">
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

        {/* Upload info card */}
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
              <span className="font-medium text-gray-700">{t('miaa.configLangValue')}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-500">{t('miaa.configModules')}</span>
              <span className="font-semibold" style={{ color: brandColor }}>{modulesActifs.length}</span>
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}

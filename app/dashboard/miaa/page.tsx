'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Send, Calculator, BarChart2, FileText,
  Bell, Cog, Globe, Loader2, Trash2, ChevronDown, ChevronUp,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useLocale } from '@/lib/hooks/useLocale'

// ── Types ─────────────────────────────────────────────────────────────────────

interface Message { role: 'user' | 'bot'; text: string; ts?: number }

// ── MIAA+ Logo ────────────────────────────────────────────────────────────────

function MIAALogo({ size = 40, animate = false }: { size?: number; animate?: boolean }) {
  return (
    <div className="relative shrink-0 flex items-center justify-center" style={{ width: size, height: size }}>
      {animate && (
        <div
          className="absolute inset-[-4px] rounded-full"
          style={{
            background: 'conic-gradient(from 0deg, transparent 60%, #DC2626 80%, #FF4444 90%, transparent 100%)',
            animation: 'spin 5s linear infinite',
          }}
        />
      )}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/miaa-logo.png"
        alt="MIAA+"
        className="relative z-10 rounded-full object-cover"
        style={{ width: size, height: size, filter: animate ? 'drop-shadow(0 2px 8px rgba(220,38,38,0.5))' : undefined }}
      />
    </div>
  )
}

// ── Text formatter ────────────────────────────────────────────────────────────

function formatText(text: string) {
  return text
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\n/g, '<br />')
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function MIAAPage() {
  const { t } = useLocale()

  const CAPABILITIES = [
    { icon: Calculator, label: t('miaa.cap.fiscal'),   desc: t('miaa.cap.fiscalDesc'),   color: '#DC2626' },
    { icon: BarChart2,  label: t('miaa.cap.analyse'),  desc: t('miaa.cap.analyseDesc'),  color: '#DC2626' },
    { icon: FileText,   label: t('miaa.cap.docs'),     desc: t('miaa.cap.docsDesc'),     color: '#0F172A' },
    { icon: Bell,       label: t('miaa.cap.alerts'),   desc: t('miaa.cap.alertsDesc'),   color: '#DC2626' },
    { icon: Cog,        label: t('miaa.cap.auto'),     desc: t('miaa.cap.autoDesc'),     color: '#7C3AED' },
    { icon: Globe,      label: t('miaa.cap.multi'),    desc: t('miaa.cap.multiDesc'),    color: '#0F172A' },
  ]

  const QUICK_CATEGORIES = [
    {
      label: t('miaa.quick.fiscal'),
      actions: [
        'Calculer TVA + CA sur 1 500 000 FCFA',
        'Calculer le net pour un brut de 600 000 FCFA',
        'Quelles sont les tranches de l\'IRPP Congo ?',
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
        'Comment gérer les frais d\'inscription ?',
      ],
    },
  ]

  const [messages,      setMessages]      = useState<Message[]>([])
  const [input,         setInput]         = useState('')
  const [loading,       setLoading]       = useState(false)
  const [entreprise,    setEntreprise]    = useState('')
  const [modulesActifs, setModulesActifs] = useState<string[]>([])
  const [expandedCat,   setExpandedCat]   = useState<number | null>(0)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef  = useRef<HTMLInputElement>(null)

  function getGreeting() {
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
  }, [messages, loading])

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
        .slice(1)
        .slice(-10)
        .map(m => ({
          role:    m.role === 'user' ? 'user' as const : 'assistant' as const,
          content: m.text,
        }))

      const res = await fetch('/api/ai/chat', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message:        msg,
          entreprise,
          module:         'miaa',
          modules_actifs: modulesActifs,
          user_role:      'gestionnaire',
          history:        history.slice(0, -1),
        }),
      })
      const { reply } = await res.json()
      setMessages(prev => [...prev, { role: 'bot', text: reply ?? t('miaa.errorReply'), ts: Date.now() }])
    } catch {
      setMessages(prev => [...prev, { role: 'bot', text: t('miaa.errorConnection'), ts: Date.now() }])
    } finally {
      setLoading(false)
    }
  }, [loading, messages, entreprise, modulesActifs, t])

  function clearChat() {
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
      <div className="flex-1 flex flex-col bg-[var(--card-bg)] border border-[var(--border)] rounded-2xl overflow-hidden min-h-0">

        {/* Chat Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-[var(--border)] shrink-0" style={{ background: '#0F172A' }}>
          <MIAALogo size={40} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-bold text-[var(--text)]">{t('miaa.title')}</h1>
              <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold" style={{ background: '#DC262620', color: '#DC2626' }}>{t('miaa.badge')}</span>
            </div>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--surface)] animate-pulse shrink-0" />
              <p className="text-[10px] text-[var(--text-secondary)] truncate">
                {entreprise ? `${entreprise} · ` : ''}{t('miaa.subtitle')}
              </p>
            </div>
          </div>
          <button
            onClick={clearChat}
            title={t('miaa.newChat')}
            className="p-2 text-[var(--text-secondary)] hover:text-[var(--text-secondary)] hover:bg-white/5 rounded-lg transition-colors"
          >
            <Trash2 size={14} />
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
          <AnimatePresence initial={false}>
            {messages.map((m, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
                className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'} gap-2.5`}
              >
                {m.role === 'bot' && (
                  <div className="shrink-0 mt-1">
                    <MIAALogo size={24} />
                  </div>
                )}
                <div
                  className={`max-w-[78%] text-xs px-3.5 py-2.5 rounded-2xl leading-relaxed ${
                    m.role === 'user'
                      ? 'rounded-br-sm font-semibold text-[#DC2626]'
                      : 'rounded-bl-sm text-[var(--text)] border-l-2 border-[#DC2626]/50'
                  }`}
                  style={m.role === 'user' ? { background: '#DC2626' } : { background: '#1C2128' }}
                  dangerouslySetInnerHTML={{ __html: formatText(m.text) }}
                />
              </motion.div>
            ))}
          </AnimatePresence>

          {/* Typing indicator */}
          {loading && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex justify-start gap-2.5"
            >
              <div className="shrink-0 mt-1"><MIAALogo size={24} /></div>
              <div className="bg-[#1C2128] rounded-2xl rounded-bl-sm px-3.5 py-2.5 flex items-center gap-1.5 border-l-2 border-[#DC2626]/50">
                {[0, 1, 2].map(i => (
                  <motion.span
                    key={i}
                    className="w-1.5 h-1.5 rounded-full bg-[#DC2626]/60"
                    animate={{ opacity: [0.3, 1, 0.3] }}
                    transition={{ duration: 1.1, repeat: Infinity, delay: i * 0.22 }}
                  />
                ))}
                <span className="text-[9px] text-[var(--text-secondary)] ml-1">{t('miaa.typing')}</span>
              </div>
            </motion.div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Suggestions row (visible when chat is fresh) */}
        {messages.length <= 1 && !loading && (
          <div className="px-4 pb-2 flex gap-2 flex-wrap shrink-0">
            {[t('miaa.suggest.tva'), t('miaa.suggest.net'), t('miaa.suggest.cnss')].map(s => (
              <button
                key={s}
                onClick={() => send(s)}
                className="text-[11px] text-[var(--text-secondary)] hover:text-[var(--text)] bg-[var(--surface)] hover:bg-white/5 border border-[var(--border)] hover:border-[#DC2626]/40 rounded-full px-3 py-1 transition-all"
              >
                {s}
              </button>
            ))}
          </div>
        )}

        {/* Input bar */}
        <div className="flex items-center gap-2.5 px-4 py-3.5 border-t border-[var(--border)] shrink-0">
          <input
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send(input)}
            placeholder={t('miaa.placeholder')}
            disabled={loading}
            className="flex-1 bg-[var(--surface)] border border-[var(--border)] rounded-xl px-4 py-2 text-xs text-[var(--text)] placeholder-[#64748B] outline-none focus:border-[#DC2626]/50 transition-colors disabled:opacity-50"
          />
          <motion.button
            whileTap={{ scale: 0.88 }}
            onClick={() => send(input)}
            disabled={loading || !input.trim()}
            className="w-9 h-9 rounded-xl flex items-center justify-center transition-colors shrink-0 disabled:opacity-40"
            style={{ background: '#DC2626' }}
          >
            {loading ? <Loader2 size={14} className="text-[#DC2626] animate-spin" /> : <Send size={14} className="text-[#DC2626]" />}
          </motion.button>
        </div>
      </div>

      {/* ── RIGHT: Capabilities + Quick Actions ─────────────────────────────── */}
      <div className="lg:w-72 flex flex-col gap-4 overflow-y-auto">

        {/* Capabilities */}
        <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-2xl p-4">
          <p className="text-xs font-bold text-[var(--text)] mb-3 flex items-center gap-2">
            <MIAALogo size={18} /> {t('miaa.capabilities')}
          </p>
          <div className="grid grid-cols-2 gap-2">
            {CAPABILITIES.map(cap => {
              const Icon = cap.icon
              return (
                <motion.div
                  key={cap.label}
                  whileHover={{ scale: 1.02 }}
                  className="p-2.5 rounded-xl border border-[var(--border)] cursor-default"
                  style={{ background: `${cap.color}08` }}
                >
                  <Icon size={14} style={{ color: cap.color }} className="mb-1.5" />
                  <p className="text-[10px] font-semibold text-[var(--text)] leading-tight">{cap.label}</p>
                  <p className="text-[9px] text-[var(--text-secondary)] mt-0.5 leading-tight">{cap.desc}</p>
                </motion.div>
              )
            })}
          </div>
        </div>

        {/* Quick actions by category */}
        <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-2xl p-4 flex-1">
          <p className="text-xs font-bold text-[var(--text)] mb-3">{t('miaa.quickQuestions')}</p>
          <div className="space-y-2">
            {QUICK_CATEGORIES.map((cat, ci) => (
              <div key={cat.label} className="border border-[var(--border)] rounded-xl overflow-hidden">
                <button
                  onClick={() => setExpandedCat(expandedCat === ci ? null : ci)}
                  className="w-full flex items-center justify-between px-3 py-2 text-left hover:bg-gray-50 transition-colors"
                >
                  <span className="text-xs font-medium text-[var(--text-secondary)]">{cat.label}</span>
                  {expandedCat === ci
                    ? <ChevronUp size={12} className="text-[var(--text-secondary)]" />
                    : <ChevronDown size={12} className="text-[var(--text-secondary)]" />
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
                      <div className="px-3 pb-2 space-y-1 border-t border-[var(--border)]">
                        {cat.actions.map(a => (
                          <button
                            key={a}
                            onClick={() => send(a)}
                            className="w-full text-left text-[10px] text-[var(--text-secondary)] hover:text-[var(--text)] hover:bg-white/5 px-2 py-1.5 rounded-lg transition-all"
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

        {/* Config hint */}
        <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-2xl p-4">
          <p className="text-[10px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-2">{t('miaa.configTitle')}</p>
          <div className="space-y-2 text-[10px] text-[var(--text-secondary)]">
            <div className="flex justify-between">
              <span>{t('miaa.configModel')}</span>
              <span className="text-[var(--text-secondary)]">{t('miaa.configModelValue')}</span>
            </div>
            <div className="flex justify-between">
              <span>{t('miaa.configLang')}</span>
              <span className="text-[var(--text-secondary)]">{t('miaa.configLangValue')}</span>
            </div>
            <div className="flex justify-between">
              <span>{t('miaa.configContext')}</span>
              <span className="text-[var(--text-secondary)]">{t('miaa.configContextValue')}</span>
            </div>
            <div className="flex justify-between">
              <span>{t('miaa.configModules')}</span>
              <span className="text-[#DC2626]">{modulesActifs.length}</span>
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}

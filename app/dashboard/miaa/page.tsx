'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Send, Sparkles, Calculator, BarChart2, FileText,
  Bell, Cog, Globe, Loader2, Trash2, ChevronDown, ChevronUp,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'

// ── Types ─────────────────────────────────────────────────────────────────────

interface Message { role: 'user' | 'bot'; text: string; ts?: number }

// ── Capabilities ──────────────────────────────────────────────────────────────

const CAPABILITIES = [
  { icon: Calculator, label: 'Calculs fiscaux',       desc: 'TVA 18%, CA 5%, CNSS, IRPP Congo',       color: '#F51E33' },
  { icon: BarChart2,  label: 'Analyse de données',    desc: 'Indicateurs, tendances, comparaisons',    color: '#F51E33' },
  { icon: FileText,   label: 'Génération documents',  desc: 'Factures, bulletins de paie, rapports',   color: '#142850' },
  { icon: Bell,       label: 'Alertes intelligentes', desc: 'Impayés, stock bas, échéances',            color: '#F51E33' },
  { icon: Cog,        label: 'Automatisation',        desc: 'Workflows, relances, rappels',             color: '#8B0070' },
  { icon: Globe,      label: 'Multilingue',           desc: 'Français, English, Lingala',              color: '#142850' },
]

// ── Quick actions by category ─────────────────────────────────────────────────

const QUICK_CATEGORIES = [
  {
    label: '🧮 Fiscal Congo',
    actions: [
      'Calculer TVA + CA sur 1 500 000 FCFA',
      'Calculer le net pour un brut de 600 000 FCFA',
      'Quelles sont les tranches de l\'IRPP Congo ?',
      'Calculer les charges patronales CNSS sur 800 000 FCFA',
    ],
  },
  {
    label: '📄 Facturation',
    actions: [
      'Explique les règles de facturation OHADA',
      'Comment rédiger une relance de facture impayée ?',
      'Quel est le délai légal de paiement en Congo ?',
      'Comment gérer les avoirs et remises ?',
    ],
  },
  {
    label: '👔 RH & Paie',
    actions: [
      'Quelles sont les obligations CNSS pour une PME ?',
      'Comment calculer le préavis en cas de licenciement ?',
      'Calcule le bulletin de paie pour 450 000 FCFA brut',
      'Quelles sont les allocations familiales légales ?',
    ],
  },
  {
    label: '🏫 Scolaire',
    actions: [
      'Comment calculer une moyenne pondérée sur 20 ?',
      'Quelles sont les règles de redoublement ?',
      'Génère un modèle de relevé de notes',
      'Comment gérer les frais d\'inscription ?',
    ],
  },
]

// ── MIAA+ Logo ────────────────────────────────────────────────────────────────

function MIAALogo({ size = 40 }: { size?: number }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src="/logo.png" alt="MIAA+" className="shrink-0 rounded-full" style={{ width: size, height: size, objectFit: 'cover' }} />
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
  const [messages,      setMessages]      = useState<Message[]>([])
  const [input,         setInput]         = useState('')
  const [loading,       setLoading]       = useState(false)
  const [entreprise,    setEntreprise]    = useState('')
  const [modulesActifs, setModulesActifs] = useState<string[]>([])
  const [expandedCat,   setExpandedCat]   = useState<number | null>(0)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef  = useRef<HTMLInputElement>(null)

  // Load user context
  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return
      const { data } = await supabase
        .from('profiles')
        .select('tenants(nom_entreprise, modules_actifs)')
        .eq('user_id', user.id)
        .maybeSingle()
      const t = (data?.tenants as { nom_entreprise?: string; modules_actifs?: string[] } | null)
      const nom = t?.nom_entreprise ?? ''
      setEntreprise(nom)
      setModulesActifs(t?.modules_actifs ?? [])

      const h = new Date().getHours()
      const salut = h < 12 ? 'Bonjour' : h < 18 ? 'Bonne après-midi' : 'Bonne soirée'
      const greeting = nom
        ? `${salut} ! Je suis **MIAA+**, votre assistant intelligent chez **${nom}**.\n\nJe peux vous aider avec :\n✓ Calculs fiscaux Congo (TVA, CA, CNSS, IRPP)\n✓ Gestion de votre facturation et comptabilité\n✓ RH, paie et obligations sociales\n✓ Toute question sur votre activité\n\nPosez-moi une question ou choisissez une suggestion ci-dessous.`
        : `${salut} ! Je suis **MIAA+**, l'assistant IA d'oraforme.\n\nComment puis-je vous aider aujourd'hui ?`
      setMessages([{ role: 'bot', text: greeting, ts: Date.now() }])
    })
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
      setMessages(prev => [...prev, { role: 'bot', text: reply ?? "Désolé, je n'ai pas pu répondre.", ts: Date.now() }])
    } catch {
      setMessages(prev => [...prev, { role: 'bot', text: '❌ Erreur de connexion. Vérifiez votre clé API dans .env.local.', ts: Date.now() }])
    } finally {
      setLoading(false)
    }
  }, [loading, messages, entreprise, modulesActifs])

  function clearChat() {
    const h = new Date().getHours()
    const salut = h < 12 ? 'Bonjour' : h < 18 ? 'Bonne après-midi' : 'Bonne soirée'
    setMessages([{
      role: 'bot',
      text: entreprise
        ? `${salut} ! Nouvelle conversation démarrée. Comment puis-je vous aider chez **${entreprise}** ?`
        : `${salut} ! Nouvelle conversation. Comment puis-je vous aider ?`,
      ts: Date.now(),
    }])
  }

  return (
    <div className="flex flex-col lg:flex-row gap-5 h-[calc(100vh-120px)] min-h-[600px]">

      {/* ── LEFT: Chat ──────────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col bg-[var(--card-bg)] border border-[var(--border)] rounded-2xl overflow-hidden min-h-0">

        {/* Chat Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-[var(--border)] shrink-0" style={{ background: '#142850' }}>
          <MIAALogo size={40} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-bold text-[#FFFFFF]">✨ MIAA+ — Assistant Intelligent</h1>
              <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold" style={{ background: '#F51E3320', color: '#F51E33' }}>IA</span>
            </div>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#142850] animate-pulse shrink-0" />
              <p className="text-[10px] text-[var(--text-secondary)] truncate">
                {entreprise ? `${entreprise} · ` : ''}oraforme ERP · Spécialisé Congo-Brazzaville
              </p>
            </div>
          </div>
          <button
            onClick={clearChat}
            title="Nouvelle conversation"
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
                      ? 'rounded-br-sm font-semibold text-[#F51E33]'
                      : 'rounded-bl-sm text-[#FFFFFF] border-l-2 border-[#F51E33]/50'
                  }`}
                  style={m.role === 'user' ? { background: '#F51E33' } : { background: '#1C2128' }}
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
              <div className="bg-[#1C2128] rounded-2xl rounded-bl-sm px-3.5 py-2.5 flex items-center gap-1.5 border-l-2 border-[#F51E33]/50">
                {[0, 1, 2].map(i => (
                  <motion.span
                    key={i}
                    className="w-1.5 h-1.5 rounded-full bg-[#F51E33]/60"
                    animate={{ opacity: [0.3, 1, 0.3] }}
                    transition={{ duration: 1.1, repeat: Infinity, delay: i * 0.22 }}
                  />
                ))}
                <span className="text-[9px] text-[var(--text-secondary)] ml-1">MIAA+ est en train d&apos;écrire…</span>
              </div>
            </motion.div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Suggestions row (visible when chat is fresh) */}
        {messages.length <= 1 && !loading && (
          <div className="px-4 pb-2 flex gap-2 flex-wrap shrink-0">
            {['🧮 Calculer TVA sur 500 000 FCFA', '👔 Net pour 400 000 FCFA brut', '📋 Règles CNSS Congo'].map(s => (
              <button
                key={s}
                onClick={() => send(s)}
                className="text-[11px] text-[var(--text-secondary)] hover:text-[#FFFFFF] bg-[#142850] hover:bg-white/5 border border-[var(--border)] hover:border-[#F51E33]/40 rounded-full px-3 py-1 transition-all"
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
            placeholder="Posez votre question à MIAA+… (Entrée pour envoyer)"
            disabled={loading}
            className="flex-1 bg-[#142850] border border-[var(--border)] rounded-xl px-4 py-2 text-xs text-[#FFFFFF] placeholder-[#484F58] outline-none focus:border-[#F51E33]/50 transition-colors disabled:opacity-50"
          />
          <motion.button
            whileTap={{ scale: 0.88 }}
            onClick={() => send(input)}
            disabled={loading || !input.trim()}
            className="w-9 h-9 rounded-xl flex items-center justify-center transition-colors shrink-0 disabled:opacity-40"
            style={{ background: '#F51E33' }}
          >
            {loading ? <Loader2 size={14} className="text-[#F51E33] animate-spin" /> : <Send size={14} className="text-[#F51E33]" />}
          </motion.button>
        </div>
      </div>

      {/* ── RIGHT: Capabilities + Quick Actions ─────────────────────────────── */}
      <div className="lg:w-72 flex flex-col gap-4 overflow-y-auto">

        {/* Capabilities */}
        <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-2xl p-4">
          <p className="text-xs font-bold text-[#FFFFFF] mb-3 flex items-center gap-2">
            <Sparkles size={13} className="text-[#F51E33]" /> Capacités MIAA+
          </p>
          <div className="grid grid-cols-2 gap-2">
            {CAPABILITIES.map(cap => {
              const Icon = cap.icon
              return (
                <motion.div
                  key={cap.label}
                  whileHover={{ scale: 1.02 }}
                  className="p-2.5 rounded-xl border border-white/[0.05] cursor-default"
                  style={{ background: `${cap.color}08` }}
                >
                  <Icon size={14} style={{ color: cap.color }} className="mb-1.5" />
                  <p className="text-[10px] font-semibold text-[#FFFFFF] leading-tight">{cap.label}</p>
                  <p className="text-[9px] text-[var(--text-secondary)] mt-0.5 leading-tight">{cap.desc}</p>
                </motion.div>
              )
            })}
          </div>
        </div>

        {/* Quick actions by category */}
        <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-2xl p-4 flex-1">
          <p className="text-xs font-bold text-[#FFFFFF] mb-3">Questions rapides</p>
          <div className="space-y-2">
            {QUICK_CATEGORIES.map((cat, ci) => (
              <div key={cat.label} className="border border-white/[0.05] rounded-xl overflow-hidden">
                <button
                  onClick={() => setExpandedCat(expandedCat === ci ? null : ci)}
                  className="w-full flex items-center justify-between px-3 py-2 text-left hover:bg-white/[0.03] transition-colors"
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
                      <div className="px-3 pb-2 space-y-1 border-t border-white/[0.05]">
                        {cat.actions.map(a => (
                          <button
                            key={a}
                            onClick={() => send(a)}
                            className="w-full text-left text-[10px] text-[var(--text-secondary)] hover:text-[#FFFFFF] hover:bg-white/5 px-2 py-1.5 rounded-lg transition-all"
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
          <p className="text-[10px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-2">Configuration</p>
          <div className="space-y-2 text-[10px] text-[var(--text-secondary)]">
            <div className="flex justify-between">
              <span>Modèle IA</span>
              <span className="text-[var(--text-secondary)]">Claude Haiku 4.5</span>
            </div>
            <div className="flex justify-between">
              <span>Langue</span>
              <span className="text-[var(--text-secondary)]">Français 🇫🇷</span>
            </div>
            <div className="flex justify-between">
              <span>Contexte</span>
              <span className="text-[var(--text-secondary)]">Congo-Brazzaville</span>
            </div>
            <div className="flex justify-between">
              <span>Modules actifs</span>
              <span className="text-[#F51E33]">{modulesActifs.length}</span>
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}

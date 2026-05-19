'use client'

import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Send, Sparkles } from 'lucide-react'
import { usePathname } from 'next/navigation'
import { supabase } from '@/lib/supabase'

interface Message { role: 'user' | 'bot'; text: string }

// ── Module detection from pathname ────────────────────────────────────────────

function detectModule(path: string): string {
  if (path.includes('/facturation') || path.includes('/factures')) return 'facturation'
  if (path.includes('/rh'))          return 'rh'
  if (path.includes('/ecole'))       return 'ecole'
  if (path.includes('/restaurant'))  return 'restaurant'
  if (path.includes('/stock'))       return 'stock'
  if (path.includes('/tenderwatch')) return 'tenderwatch'
  if (path.includes('/miaa'))        return 'miaa'
  return 'dashboard'
}

const MODULE_LABELS: Record<string, string> = {
  facturation: 'Facturation',
  rh:          'RH & Paie',
  ecole:       'École',
  restaurant:  'Restaurant',
  stock:       'Stock',
  tenderwatch: 'TenderWatch',
  miaa:        'MIAA+',
  dashboard:   'Tableau de bord',
}

// ── Module-specific suggestions ───────────────────────────────────────────────

const MODULE_SUGGESTIONS: Record<string, string[]> = {
  facturation: [
    '💡 Calculer TVA sur 750 000 FCFA',
    '📋 Comment gérer les factures impayées ?',
    '📄 Rédige une relance client professionnelle',
  ],
  rh: [
    '💡 Calculer le net pour 450 000 FCFA brut',
    '📊 Quelles sont les obligations CNSS Congo ?',
    '📅 Comment calculer les congés légaux ?',
  ],
  ecole: [
    '🎓 Comment calculer une moyenne pondérée ?',
    '💰 Voir les étudiants avec des impayés',
    '📄 Modèle de bulletin de notes scolaire',
  ],
  restaurant: [
    '🍽️ Analyser le chiffre d\'affaires du jour',
    '📦 Comment optimiser le stock de cuisine ?',
    '💡 Conseils pour réduire le gaspillage',
  ],
  stock: [
    '📦 Articles sous le seuil d\'alerte',
    '💰 Calculer la valeur totale du stock',
    '📊 Comment optimiser les réapprovisionnements ?',
  ],
  dashboard: [
    '📊 Résume mon activité du mois',
    '💰 Conseils pour encaisser les impayés',
    '👔 Calculer les charges salariales CNSS',
    '📈 Comment améliorer ma trésorerie ?',
  ],
  miaa: [
    '✨ Que peux-tu faire pour moi ?',
    '🧮 Calculer TVA + CA sur 1 000 000 FCFA',
    '📄 Explique le régime fiscal congolais',
    '👔 Comment calculer un bulletin de paie ?',
  ],
}

function getGreeting(nom: string): string {
  const h = new Date().getHours()
  const salut = h < 12 ? 'Bonjour' : h < 18 ? 'Bonne après-midi' : 'Bonne soirée'
  return nom
    ? `${salut} ! Je suis **MIAA+**, votre assistant intelligent chez **${nom}**. Comment puis-je vous aider ?`
    : `${salut} ! Je suis **MIAA+**, l'assistant IA d'oraforme. Posez-moi vos questions sur la gestion de votre entreprise.`
}

// ── Logo MIAA+ (stylisé comme le logo bleu/chat/rose+) ────────────────────────

function MIAALogo({ size = 32 }: { size?: number }) {
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      {/* Outer blue ring */}
      <div
        className="absolute inset-0 rounded-full"
        style={{ background: '#3B7EC8', padding: 2 }}
      >
        {/* White ring gap */}
        <div className="w-full h-full rounded-full bg-white/20 p-0.5">
          {/* Inner blue circle */}
          <div className="w-full h-full rounded-full bg-[#3B7EC8] flex items-center justify-center">
            <span style={{ fontSize: size * 0.35, lineHeight: 1 }}>🐱</span>
          </div>
        </div>
      </div>
      {/* Pink + badge */}
      <div
        className="absolute -top-0.5 -right-0.5 rounded-full bg-[#8B0070] flex items-center justify-center text-white font-bold"
        style={{ width: size * 0.35, height: size * 0.35, fontSize: size * 0.18 }}
      >
        +
      </div>
    </div>
  )
}

// ── Main Component ─────────────────────────────────────────────────────────────

export default function AiAssistant() {
  const pathname = usePathname()
  const currentModule = detectModule(pathname ?? '')

  const [open,         setOpen]         = useState(false)
  const [messages,     setMessages]     = useState<Message[]>([])
  const [input,        setInput]        = useState('')
  const [loading,      setLoading]      = useState(false)
  const [entreprise,   setEntreprise]   = useState('')
  const [modulesActifs,setModulesActifs]= useState<string[]>([])
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return
      const { data } = await supabase
        .from('profiles')
        .select('tenants(nom_entreprise, modules_actifs)')
        .eq('user_id', user.id)
        .maybeSingle()
      const t = (data?.tenants as { nom_entreprise?: string; modules_actifs?: string[] } | null)
      setEntreprise(t?.nom_entreprise ?? '')
      setModulesActifs(t?.modules_actifs ?? [])
    })
  }, [])

  // Set greeting when chat opens for the first time
  useEffect(() => {
    if (open && messages.length === 0 && entreprise !== undefined) {
      setMessages([{ role: 'bot', text: getGreeting(entreprise) }])
    }
  }, [open, entreprise, messages.length])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  const suggestions = MODULE_SUGGESTIONS[currentModule] ?? MODULE_SUGGESTIONS.dashboard

  async function send(text: string) {
    const msg = text.trim()
    if (!msg || loading) return
    setInput('')

    const newMessages: Message[] = [...messages, { role: 'user', text: msg }]
    setMessages(newMessages)
    setLoading(true)

    try {
      // Build history for context (exclude greeting, last 10 exchanges)
      const history = newMessages
        .slice(1) // skip greeting
        .slice(-10)
        .map(m => ({
          role:    m.role === 'user' ? 'user' as const : 'assistant' as const,
          content: m.text,
        }))

      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message:       msg,
          entreprise,
          module:        currentModule,
          modules_actifs: modulesActifs,
          user_role:     'gestionnaire',
          history:       history.slice(0, -1), // last message is the current one
        }),
      })
      const { reply } = await res.json()
      setMessages(prev => [...prev, { role: 'bot', text: reply ?? "Désolé, je n'ai pas pu répondre." }])
    } catch {
      setMessages(prev => [...prev, { role: 'bot', text: "❌ Impossible de contacter MIAA+. Vérifiez votre connexion." }])
    } finally {
      setLoading(false)
    }
  }

  function formatText(text: string) {
    // Bold **text**
    return text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
  }

  return (
    <>
      {/* ── Floating button ──────────────────────────────────────────────── */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col items-center gap-1.5">
        <motion.button
          whileHover={{ scale: 1.08 }}
          whileTap={{ scale: 0.92 }}
          onClick={() => setOpen(true)}
          className="relative w-[54px] h-[54px] rounded-full shadow-xl flex items-center justify-center"
          style={{ background: '#F08900', willChange: 'transform' }}
          title="MIAA+ — Assistant IA"
        >
          {/* Pulse rings */}
          <span className="absolute inset-0 rounded-full bg-[#F08900]/50 animate-ping" style={{ animationDuration: '2.5s' }} />
          <span className="absolute inset-[-5px] rounded-full border border-[#F08900]/25" />
          {/* Icon */}
          <Sparkles size={22} className="text-[#142850] relative z-10" />
          {/* IA badge */}
          <span className="absolute -top-1 -right-1 bg-[#8B0070] text-white font-black rounded-full flex items-center justify-center z-20" style={{ fontSize: 7, width: 16, height: 16, letterSpacing: -0.5 }}>
            IA
          </span>
        </motion.button>
        <span className="text-[10px] font-bold text-[#F08900] tracking-wide select-none">MIAA+</span>
      </div>

      {/* ── Chat modal ───────────────────────────────────────────────────── */}
      <AnimatePresence>
        {open && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="fixed inset-0 bg-black/40 backdrop-blur-[2px] z-50"
              onClick={() => setOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.88, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 10 }}
              transition={{ type: 'spring', stiffness: 340, damping: 28 }}
              className="fixed bottom-[84px] right-6 z-50 w-[360px] bg-[#0f1e3d] border border-[#30363D] rounded-2xl overflow-hidden shadow-2xl flex flex-col"
              style={{ maxHeight: '520px', willChange: 'transform' }}
              onClick={e => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center gap-3 px-4 py-3 border-b border-[#1a2d50] shrink-0" style={{ background: '#142850' }}>
                <MIAALogo size={34} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-[#FFFFFF]">✨ MIAA+ — Assistant Intelligent</p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#142850] animate-pulse shrink-0" />
                    <p className="text-[10px] text-[#8B949E] truncate">Module : {MODULE_LABELS[currentModule] ?? currentModule}</p>
                  </div>
                </div>
                <button
                  onClick={() => setOpen(false)}
                  className="p-1.5 text-[#484F58] hover:text-[#8B949E] hover:bg-[#1a2d50] rounded-lg transition-colors shrink-0"
                >
                  <X size={14} />
                </button>
              </div>

              {/* Messages */}
              <div className="flex flex-col gap-2.5 p-4 overflow-y-auto flex-1">
                {messages.map((m, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.18 }}
                    className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'} gap-2`}
                  >
                    {m.role === 'bot' && (
                      <div className="shrink-0 mt-0.5">
                        <MIAALogo size={20} />
                      </div>
                    )}
                    <div
                      className={`max-w-[82%] text-xs px-3 py-2 rounded-2xl leading-relaxed ${
                        m.role === 'user'
                          ? 'rounded-br-sm text-[#142850] font-semibold'
                          : 'rounded-bl-sm text-[#FFFFFF] border-l-2 border-[#F08900]/60'
                      }`}
                      style={m.role === 'user'
                        ? { background: '#F08900' }
                        : { background: '#1C2128' }
                      }
                      dangerouslySetInnerHTML={{ __html: formatText(m.text) }}
                    />
                  </motion.div>
                ))}

                {/* Typing indicator */}
                {loading && (
                  <div className="flex justify-start gap-2">
                    <MIAALogo size={20} />
                    <div className="bg-[#1C2128] rounded-2xl rounded-bl-sm px-3 py-2.5 flex gap-1 items-center border-l-2 border-[#F08900]/60">
                      {[0, 1, 2].map(i => (
                        <motion.span
                          key={i}
                          className="w-1.5 h-1.5 rounded-full bg-[#F08900]/60"
                          animate={{ opacity: [0.3, 1, 0.3] }}
                          transition={{ duration: 1.1, repeat: Infinity, delay: i * 0.22 }}
                        />
                      ))}
                      <span className="text-[9px] text-[#484F58] ml-1">MIAA+ écrit…</span>
                    </div>
                  </div>
                )}
                <div ref={bottomRef} />
              </div>

              {/* Suggestions (first message only) */}
              {messages.length <= 1 && !loading && (
                <div className="px-3 pb-2 flex flex-col gap-1 shrink-0">
                  {suggestions.map(s => (
                    <button
                      key={s}
                      onClick={() => send(s)}
                      className="text-left text-[11px] text-[#8B949E] hover:text-[#FFFFFF] bg-[#142850] hover:bg-[#1a2d50] border border-[#1a2d50] hover:border-[#F08900]/30 rounded-xl px-3 py-1.5 transition-all"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}

              {/* Input */}
              <div className="flex items-center gap-2 px-3 py-3 border-t border-[#1a2d50] shrink-0">
                <input
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send(input)}
                  placeholder="Posez votre question à MIAA+…"
                  disabled={loading}
                  className="flex-1 bg-[#142850] border border-[#30363D] rounded-xl px-3 py-1.5 text-xs text-[#FFFFFF] placeholder-[#484F58] outline-none focus:border-[#F08900]/50 transition-colors disabled:opacity-50"
                />
                <motion.button
                  whileTap={{ scale: 0.88 }}
                  onClick={() => send(input)}
                  disabled={loading || !input.trim()}
                  className="w-8 h-8 rounded-xl flex items-center justify-center transition-colors shrink-0 disabled:opacity-40"
                  style={{ background: '#F08900' }}
                >
                  <Send size={12} className="text-[#142850]" />
                </motion.button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  )
}

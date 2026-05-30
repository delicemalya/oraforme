'use client'

import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Send, Sparkles, Mic } from 'lucide-react'
import { usePathname } from 'next/navigation'
import { supabase } from '@/lib/supabase'

interface Message { role: 'user' | 'bot'; text: string; time: string }

// ── Module config ─────────────────────────────────────────────────────────────

type ModuleKey = 'comptabilite' | 'rh' | 'facturation' | 'restaurant' | 'ecole' | 'stock' | 'tresorerie' | 'sante' | 'dashboard'

const MODULE_CONFIG: Record<ModuleKey, {
  nom: string
  specialite: string
  avatar: string
  color: string
  suggestions: string[]
}> = {
  comptabilite: {
    nom: 'MIAA Comptable',
    specialite: 'Expert OHADA & Fiscalité Congo',
    avatar: '📊',
    color: '#6366F1',
    suggestions: [
      'Calculer TVA sur 750 000 FCFA',
      'Comment gérer les factures impayées ?',
      'Rédige une relance client professionnelle',
      'Explique le plan comptable OHADA',
    ],
  },
  rh: {
    nom: 'MIAA RH',
    specialite: 'Gestion du personnel & Paie Congo',
    avatar: '👥',
    color: '#7C5CBF',
    suggestions: [
      'Calculer le net pour 450 000 FCFA brut',
      'Quelles sont les obligations CNSS ?',
      'Comment calculer les congés légaux ?',
      'Rédige une lettre d\'avertissement',
    ],
  },
  facturation: {
    nom: 'MIAA Facturation',
    specialite: 'Devis, factures & encaissements',
    avatar: '💰',
    color: '#F0A30A',
    suggestions: [
      'Créer un modèle de facture pro',
      'Comment relancer un client en retard ?',
      'Calculer TVA sur 1 500 000 FCFA',
      'Rédige un devis prestation de services',
    ],
  },
  restaurant: {
    nom: 'MIAA Chef',
    specialite: 'Gestion restaurant & cuisine',
    avatar: '🍽️',
    color: '#FF6B35',
    suggestions: [
      'Analyser le CA du jour',
      'Comment optimiser le stock de cuisine ?',
      'Conseils pour réduire le gaspillage',
      'Calculer le coût d\'un plat',
    ],
  },
  ecole: {
    nom: 'MIAA Académique',
    specialite: 'Gestion scolaire & pédagogie',
    avatar: '🎓',
    color: '#2EA8E0',
    suggestions: [
      'Comment calculer une moyenne pondérée ?',
      'Voir les étudiants avec des impayés',
      'Modèle de bulletin de notes',
      'Planifier les examens de fin d\'année',
    ],
  },
  stock: {
    nom: 'MIAA Stock',
    specialite: 'Inventaire, approvisionnement & valorisation',
    avatar: '📦',
    color: '#2EA043',
    suggestions: [
      'Articles sous le seuil d\'alerte',
      'Calculer la valeur totale du stock',
      'Optimiser les réapprovisionnements',
      'Rapport des mouvements du mois',
    ],
  },
  tresorerie: {
    nom: 'MIAA Trésorier',
    specialite: 'Cash flow, banques & prévisions',
    avatar: '💵',
    color: '#388BFD',
    suggestions: [
      'Analyse du cash flow ce mois',
      'Prévoir ma trésorerie sur 30 jours',
      'Comment réduire les délais d\'encaissement ?',
      'Rapprochement bancaire en retard',
    ],
  },
  sante: {
    nom: 'MIAA Médical',
    specialite: 'Clinique, patients & consultations',
    avatar: '🏥',
    color: '#E8633A',
    suggestions: [
      'Résumer les RDV du jour',
      'Patients avec ordonnances en cours',
      'Rapport de consultations du mois',
      'Gérer les fiches patients',
    ],
  },
  dashboard: {
    nom: 'MIAA+',
    specialite: 'Assistant général Oraforme',
    avatar: '✨',
    color: '#DC2626',
    suggestions: [
      'Résume mon activité du mois',
      'Conseils pour encaisser les impayés',
      'Calculer les charges salariales CNSS',
      'Comment améliorer ma trésorerie ?',
    ],
  },
}

function detectModule(path: string): ModuleKey {
  if (path.includes('/comptabilite')) return 'comptabilite'
  if (path.includes('/rh'))            return 'rh'
  if (path.includes('/facturation') || path.includes('/factures')) return 'facturation'
  if (path.includes('/restaurant'))    return 'restaurant'
  if (path.includes('/ecole'))         return 'ecole'
  if (path.includes('/stock'))         return 'stock'
  if (path.includes('/tresorerie'))    return 'tresorerie'
  if (path.includes('/sante'))         return 'sante'
  return 'dashboard'
}

function now() {
  return new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}

function formatText(text: string) {
  return text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
}

// ── Main Component ─────────────────────────────────────────────────────────────

export default function AiAssistant() {
  const pathname = usePathname()
  const mod      = detectModule(pathname ?? '')
  const cfg      = MODULE_CONFIG[mod]

  const [open,       setOpen]       = useState(false)
  const [messages,   setMessages]   = useState<Message[]>([])
  const [input,      setInput]      = useState('')
  const [loading,    setLoading]    = useState(false)
  const [entreprise, setEntreprise] = useState('')
  const [modules,    setModules]    = useState<string[]>([])
  const bottomRef = useRef<HTMLDivElement>(null)

  // Load tenant info once
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
      const t = (data?.tenants as { nom_entreprise?: string; modules_actifs?: string[] } | null)
      setEntreprise(t?.nom_entreprise ?? '')
      setModules(t?.modules_actifs ?? [])
    })
  }, [])

  // Set greeting when chat opens for the first time
  useEffect(() => {
    if (open && messages.length === 0) {
      const h = new Date().getHours()
      const salut = h < 12 ? 'Bonjour' : h < 18 ? 'Bonne après-midi' : 'Bonne soirée'
      const greeting = entreprise
        ? `${salut} ! Je suis **${cfg.nom}**, ${cfg.specialite} chez **${entreprise}**. Comment puis-je vous aider ?`
        : `${salut} ! Je suis **${cfg.nom}**, ${cfg.specialite}. Comment puis-je vous aider ?`
      setMessages([{ role: 'bot', text: greeting, time: now() }])
    }
  }, [open, entreprise, messages.length, cfg])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  // Reset messages when module changes (new context)
  useEffect(() => {
    setMessages([])
  }, [mod])

  async function send(text: string) {
    const msg = text.trim()
    if (!msg || loading) return
    setInput('')

    const userMsg: Message = { role: 'user', text: msg, time: now() }
    const newMsgs = [...messages, userMsg]
    setMessages(newMsgs)
    setLoading(true)

    try {
      const history = newMsgs.slice(1).slice(-10).map(m => ({
        role:    m.role === 'user' ? 'user' as const : 'assistant' as const,
        content: m.text,
      }))

      // Try /api/miaa/chat first (module-aware), fallback to /api/ai/chat
      const res = await fetch('/api/miaa/chat', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          module:   mod,
          message:  msg,
          history:  history.slice(0, -1),
          tenantData: { tenant_id: undefined },
          // also pass legacy fields for compatibility
          entreprise,
          modules_actifs: modules,
          user_role: 'gestionnaire',
        }),
      })

      const data = await res.json()
      const reply = data.response ?? data.reply ?? "Désolé, je n'ai pas pu répondre."
      setMessages(prev => [...prev, { role: 'bot', text: reply, time: now() }])
    } catch {
      setMessages(prev => [...prev, { role: 'bot', text: '❌ Impossible de contacter MIAA+. Vérifiez votre connexion.', time: now() }])
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      {/* ── Floating button ──────────────────────────────────────────────── */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col items-center gap-1">
        <motion.button
          whileHover={{ scale: 1.08 }}
          whileTap={{ scale: 0.92 }}
          onClick={() => setOpen(o => !o)}
          className="relative w-[54px] h-[54px] rounded-full shadow-xl flex items-center justify-center"
          style={{ background: '#DC2626' }}
          title="MIAA+ — Assistant IA"
        >
          <span className="absolute inset-0 rounded-full bg-[#DC2626]/40 animate-ping" style={{ animationDuration: '2.5s' }} />
          <Sparkles size={22} className="text-white relative z-10" />
          <span className="absolute -top-1 -right-1 bg-[#7C3AED] text-white font-black rounded-full flex items-center justify-center z-20" style={{ fontSize: 7, width: 16, height: 16 }}>
            IA
          </span>
        </motion.button>
        <span className="text-[10px] font-bold text-[#DC2626] tracking-wide select-none">MIAA+</span>
      </div>

      {/* ── Backdrop ─────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 bg-black/20 backdrop-blur-[1px] z-50"
            onClick={() => setOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* ── Chat panel (slides in from right) ────────────────────────────── */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, x: 60 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 60 }}
            transition={{ type: 'spring', stiffness: 320, damping: 30 }}
            className="fixed bottom-[84px] right-6 z-50 flex overflow-hidden"
            style={{
              width: 680,
              height: 560,
              borderRadius: 16,
              boxShadow: '0 4px 40px rgba(0,0,0,0.14)',
              background: '#FFFFFF',
            }}
            onClick={e => e.stopPropagation()}
          >
            {/* ── LEFT PANEL — Dialogs / Suggestions ──────────────────────── */}
            <div className="flex flex-col w-[220px] shrink-0 border-r border-[#F0F0F0]" style={{ background: '#FFFFFF' }}>
              {/* Header */}
              <div className="px-5 pt-5 pb-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-[17px] font-bold text-[#1A1A2E]">Dialogs</h2>
                  <span className="text-[11px] font-semibold text-white px-1.5 py-0.5 rounded-full" style={{ background: cfg.color }}>
                    {cfg.suggestions.length}
                  </span>
                </div>
              </div>

              {/* Search bar */}
              <div className="px-4 pb-3">
                <div className="flex items-center gap-2 bg-[#F5F7FA] rounded-xl px-3 py-2">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
                  </svg>
                  <span className="text-[11px] text-[#94A3B8]">Rechercher…</span>
                </div>
              </div>

              {/* Suggestion list as dialogs */}
              <div className="flex-1 overflow-y-auto px-2 pb-2 space-y-0.5">
                {/* Active module item */}
                <div
                  className="flex items-center gap-3 px-3 py-3 rounded-xl cursor-pointer"
                  style={{ background: cfg.color + '12' }}
                >
                  <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 text-base" style={{ background: cfg.color + '20' }}>
                    {cfg.avatar}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] font-semibold text-[#1A1A2E] truncate">{cfg.nom}</p>
                    <p className="text-[10px] text-[#94A3B8] truncate mt-0.5">En ligne</p>
                  </div>
                </div>

                {/* Suggestions as quick-access dialogs */}
                {cfg.suggestions.map((s, i) => (
                  <button
                    key={i}
                    onClick={() => send(s)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-[#F5F7FA] transition-colors text-left"
                  >
                    <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 text-[11px] font-bold text-white shrink-0" style={{ background: cfg.color }}>
                      {String(i + 1).padStart(2, '0')}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-medium text-[#374151] leading-snug line-clamp-2">{s}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* ── RIGHT PANEL — Active conversation ───────────────────────── */}
            <div className="flex flex-col flex-1 min-w-0" style={{ background: '#FAFAFA' }}>

              {/* Header */}
              <div className="flex items-center gap-3 px-5 py-4 bg-white border-b border-[#F0F0F0]">
                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center text-base shrink-0"
                  style={{ background: cfg.color + '18' }}
                >
                  {cfg.avatar}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-bold text-[#1A1A2E]">{cfg.nom}</p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                    <span className="text-[10px] text-[#94A3B8]">En ligne</span>
                  </div>
                </div>
                <button
                  onClick={() => setOpen(false)}
                  className="w-7 h-7 rounded-full bg-[#F5F7FA] hover:bg-[#E5E7EB] flex items-center justify-center transition-colors shrink-0"
                >
                  <X size={13} className="text-[#64748B]" />
                </button>
              </div>

              {/* Connection notice */}
              {messages.length === 0 && (
                <div className="flex items-center justify-center py-3">
                  <div className="flex items-center gap-2 text-[10px] text-[#94A3B8]">
                    <div className="w-5 h-5 rounded-full overflow-hidden" style={{ background: cfg.color + '20' }}>
                      <span className="flex items-center justify-center h-full text-[10px]">{cfg.avatar}</span>
                    </div>
                    <span className="font-medium">Opérateur</span>
                    <span className="font-bold" style={{ color: cfg.color }}>Margaret</span>
                    <span>connecté</span>
                  </div>
                </div>
              )}

              {/* Messages */}
              <div className="flex-1 overflow-y-auto px-5 py-3 space-y-4">
                {messages.map((m, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.18 }}
                    className={`flex gap-2.5 ${m.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}
                  >
                    {/* Avatar */}
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center text-sm shrink-0 mt-auto"
                      style={{ background: m.role === 'bot' ? cfg.color + '18' : '#E5E7EB' }}
                    >
                      {m.role === 'bot' ? cfg.avatar : '👤'}
                    </div>

                    {/* Bubble */}
                    <div className={`flex flex-col gap-1 max-w-[72%] ${m.role === 'user' ? 'items-end' : 'items-start'}`}>
                      <div
                        className="px-4 py-2.5 text-[12.5px] leading-relaxed"
                        style={m.role === 'user'
                          ? {
                              background: cfg.color,
                              color: '#FFFFFF',
                              borderRadius: '18px 18px 4px 18px',
                            }
                          : {
                              background: '#FFFFFF',
                              color: '#374151',
                              border: '1px solid #E5E7EB',
                              borderRadius: '18px 18px 18px 4px',
                              boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                            }
                        }
                        dangerouslySetInnerHTML={{ __html: formatText(m.text) }}
                      />
                      <span className="text-[10px] text-[#CBD5E1] px-1">{m.time}</span>
                    </div>
                  </motion.div>
                ))}

                {/* Typing indicator */}
                {loading && (
                  <div className="flex gap-2.5">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm shrink-0" style={{ background: cfg.color + '18' }}>
                      {cfg.avatar}
                    </div>
                    <div className="px-4 py-3 bg-white border border-[#E5E7EB] rounded-[18px] rounded-bl-[4px] shadow-sm">
                      <div className="flex gap-1 items-center">
                        {[0, 1, 2].map(i => (
                          <motion.span
                            key={i}
                            className="w-1.5 h-1.5 rounded-full"
                            style={{ background: cfg.color + '80' }}
                            animate={{ opacity: [0.3, 1, 0.3] }}
                            transition={{ duration: 1.1, repeat: Infinity, delay: i * 0.22 }}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                )}
                <div ref={bottomRef} />
              </div>

              {/* Input */}
              <div className="px-4 py-3 bg-white border-t border-[#F0F0F0]">
                <div className="flex items-center gap-2 bg-[#F5F7FA] rounded-2xl px-4 py-2.5">
                  <input
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send(input)}
                    placeholder="Type something..."
                    disabled={loading}
                    className="flex-1 bg-transparent text-[12.5px] text-[#374151] placeholder-[#94A3B8] outline-none disabled:opacity-50"
                  />
                  <div className="flex items-center gap-2 shrink-0">
                    <button className="w-7 h-7 rounded-full flex items-center justify-center text-[#94A3B8] hover:text-[#64748B] transition-colors">
                      <Mic size={14} />
                    </button>
                    <button className="w-7 h-7 rounded-full flex items-center justify-center text-[#94A3B8] hover:text-[#64748B] transition-colors">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
                      </svg>
                    </button>
                    <motion.button
                      whileTap={{ scale: 0.88 }}
                      onClick={() => send(input)}
                      disabled={loading || !input.trim()}
                      className="w-8 h-8 rounded-full flex items-center justify-center text-white disabled:opacity-40 transition-all"
                      style={{ background: '#1A1A2E' }}
                    >
                      <Send size={13} />
                    </motion.button>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}

'use client'

import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Send, Mic, ChevronLeft } from 'lucide-react'
import { usePathname } from 'next/navigation'
import { supabase } from '@/lib/supabase'

interface Message { role: 'user' | 'bot'; text: string; time: string }

// ── Module config ─────────────────────────────────────────────────────────────

type ModuleKey = 'comptabilite' | 'rh' | 'facturation' | 'restaurant' | 'ecole' | 'stock' | 'tresorerie' | 'sante' | 'fiscalite' | 'dashboard'

const MODULE_CONFIG: Record<ModuleKey, {
  nom: string
  specialite: string
  avatar: string
  color: string
  suggestions: string[]
}> = {
  comptabilite: {
    nom: 'MIAA Comptable',
    specialite: 'Expert SYSCOHADA Révisé 2017 & Fiscalité Congo',
    avatar: '📊',
    color: '#6366F1',
    suggestions: [
      'Calculer TVA 18% + CA 5% sur 750 000 FCFA',
      'Comment gérer les factures impayées ?',
      'Rédige une relance client professionnelle',
      'Explique le plan comptable SYSCOHADA classes 1-9',
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
  fiscalite: {
    nom: 'MIAA Fiscal',
    specialite: 'TVA, IS, CNSS, IRPP & DAS Congo',
    avatar: '🏛️',
    color: '#7C3AED',
    suggestions: [
      'Calculer TVA 18% + CA 5% sur une vente',
      'Quand payer les acomptes IS Congo ?',
      'Comment remplir la DAS annuelle ?',
      'Seuils et taux CNSS Congo 2025',
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
  if (path.includes('/fiscalite'))    return 'fiscalite'
  if (path.includes('/rh'))            return 'rh'
  if (path.includes('/facturation') || path.includes('/factures')) return 'facturation'
  if (path.includes('/restaurant'))    return 'restaurant'
  if (path.includes('/ecole'))         return 'ecole'
  if (path.includes('/stock'))         return 'stock'
  if (path.includes('/tresorerie'))    return 'tresorerie'
  if (path.includes('/sante'))         return 'sante'
  return 'dashboard'
}

function nowTime() {
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

  const [open,         setOpen]         = useState(false)
  const [messages,     setMessages]     = useState<Message[]>([])
  const [input,        setInput]        = useState('')
  const [loading,      setLoading]      = useState(false)
  const [entreprise,   setEntreprise]   = useState('')
  const [modules,      setModules]      = useState<string[]>([])
  const [isMobile,     setIsMobile]     = useState(false)
  const [showSidebar,  setShowSidebar]  = useState(false)
  const bottomRef  = useRef<HTMLDivElement>(null)
  const inputRef   = useRef<HTMLInputElement>(null)

  // Detect mobile
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 640)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  // Load tenant info
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

  // Greeting on first open
  useEffect(() => {
    if (open && messages.length === 0) {
      const h = new Date().getHours()
      const salut = h < 12 ? 'Bonjour' : h < 18 ? 'Bonne après-midi' : 'Bonne soirée'
      const greeting = entreprise
        ? `${salut} ! Je suis **${cfg.nom}**, ${cfg.specialite} chez **${entreprise}**. Comment puis-je vous aider ?`
        : `${salut} ! Je suis **${cfg.nom}**, ${cfg.specialite}. Comment puis-je vous aider ?`
      setMessages([{ role: 'bot', text: greeting, time: nowTime() }])
    }
  }, [open, entreprise, messages.length, cfg])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  // Reset when module changes
  useEffect(() => {
    setMessages([])
  }, [mod])

  // Focus input when panel opens
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 300)
  }, [open])

  async function send(text: string) {
    const msg = text.trim()
    if (!msg || loading) return
    setInput('')
    setShowSidebar(false)

    const userMsg: Message = { role: 'user', text: msg, time: nowTime() }
    const newMsgs = [...messages, userMsg]
    setMessages(newMsgs)
    setLoading(true)

    try {
      const history = newMsgs.slice(1).slice(-10).map(m => ({
        role:    m.role === 'user' ? 'user' as const : 'assistant' as const,
        content: m.text,
      }))

      const res = await fetch('/api/miaa/chat', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          module:   mod,
          message:  msg,
          history:  history.slice(0, -1),
          tenantData: { tenant_id: undefined },
          entreprise,
          modules_actifs: modules,
          user_role: 'gestionnaire',
        }),
      })

      const data  = await res.json()
      const reply = data.response ?? data.reply ?? "Désolé, je n'ai pas pu répondre."
      setMessages(prev => [...prev, { role: 'bot', text: reply, time: nowTime() }])
    } catch {
      setMessages(prev => [...prev, { role: 'bot', text: '❌ Impossible de contacter MIAA+. Vérifiez votre connexion.', time: nowTime() }])
    } finally {
      setLoading(false)
    }
  }

  // ── Panel animation variants ───────────────────────────────────────────────
  const panelVariants = {
    hidden:  isMobile ? { y: '100%' as const }           : { x: 80, opacity: 0 },
    visible: isMobile ? { y: 0 }                          : { x: 0,  opacity: 1 },
    exit:    isMobile ? { y: '100%' as const }            : { x: 80, opacity: 0 },
  }

  // ── Sidebar (mobile: full overlay, desktop: left panel) ───────────────────
  const SidebarContent = () => (
    <>
      {/* Header */}
      <div className="px-5 pt-5 pb-3">
        <div className="flex items-center justify-between">
          <h2 className="text-[17px] font-bold text-[#1A1A2E]">Suggestions</h2>
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

      {/* Module item */}
      <div className="px-2 pb-2 space-y-0.5 flex-1 overflow-y-auto">
        <div className="flex items-center gap-3 px-3 py-3 rounded-xl" style={{ background: cfg.color + '12' }}>
          <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 text-base" style={{ background: cfg.color + '20' }}>
            {cfg.avatar}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[12px] font-semibold text-[#1A1A2E] truncate">{cfg.nom}</p>
            <p className="text-[10px] text-[#94A3B8] truncate mt-0.5">En ligne</p>
          </div>
        </div>

        {cfg.suggestions.map((s, i) => (
          <button
            key={i}
            onClick={() => { send(s); if (isMobile) setShowSidebar(false) }}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-[#F5F7FA] active:bg-[#EEF2FF] transition-colors text-left"
          >
            <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 text-[11px] font-bold text-white" style={{ background: cfg.color }}>
              {String(i + 1).padStart(2, '0')}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-medium text-[#374151] leading-snug line-clamp-2">{s}</p>
            </div>
          </button>
        ))}
      </div>
    </>
  )

  return (
    <>
      {/* ── Floating button ──────────────────────────────────────────────── */}
      <div className={`fixed z-50 flex flex-col items-center gap-1 ${isMobile ? 'bottom-4 right-4' : 'bottom-6 right-6'}`}>
        <motion.button
          whileHover={{ scale: 1.10 }}
          whileTap={{ scale: 0.88 }}
          onClick={() => setOpen(o => !o)}
          className="relative w-[62px] h-[62px] flex items-center justify-center"
          title="MIAA+ — Assistant IA"
        >
          {/* Rotating conic glow ring */}
          <motion.div
            className="absolute inset-[-5px] rounded-full"
            animate={{ rotate: 360 }}
            transition={{ duration: 6, repeat: Infinity, ease: 'linear' }}
            style={{
              background: 'conic-gradient(from 0deg, transparent 60%, #DC2626 80%, #FF4444 90%, transparent 100%)',
              borderRadius: '50%',
            }}
          />
          {/* Pulse halo */}
          <motion.div
            className="absolute inset-0 rounded-full"
            animate={{ scale: [1, 1.35, 1], opacity: [0.5, 0, 0.5] }}
            transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
            style={{ background: 'radial-gradient(circle, #DC262680 0%, transparent 70%)' }}
          />
          {/* Logo */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/miaa-logo.png"
            alt="MIAA+"
            className="relative z-10 rounded-full object-cover shadow-lg"
            style={{
              width: 62, height: 62,
              filter: 'drop-shadow(0 3px 10px rgba(220,38,38,0.55))',
            }}
          />
        </motion.button>
        <motion.span
          animate={{ opacity: [0.7, 1, 0.7] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
          className="text-[10px] font-bold text-[#DC2626] tracking-wide select-none"
        >
          MIAA+
        </motion.span>
      </div>

      {/* ── Backdrop ─────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 bg-black/30 backdrop-blur-[2px] z-50"
            onClick={() => setOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* ── Chat panel ───────────────────────────────────────────────────── */}
      <AnimatePresence>
        {open && (
          <motion.div
            variants={panelVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            transition={{ type: 'spring', stiffness: 320, damping: 32 }}
            onClick={e => e.stopPropagation()}
            className="fixed z-50 flex overflow-hidden bg-white"
            style={isMobile
              ? {
                  left: 0, right: 0, bottom: 0,
                  height: 'calc(100svh - 64px)',
                  borderRadius: '20px 20px 0 0',
                  boxShadow: '0 -4px 40px rgba(0,0,0,0.18)',
                }
              : {
                  width: 680, height: 560,
                  bottom: 84, right: 24,
                  borderRadius: 16,
                  boxShadow: '0 4px 40px rgba(0,0,0,0.14)',
                }
            }
          >
            {/* ── LEFT PANEL (desktop only) ──────────────────────────── */}
            {!isMobile && (
              <div className="flex flex-col w-[220px] shrink-0 border-r border-[#F0F0F0] bg-white">
                <SidebarContent />
              </div>
            )}

            {/* ── Mobile sidebar overlay ────────────────────────────── */}
            <AnimatePresence>
              {isMobile && showSidebar && (
                <motion.div
                  initial={{ x: '-100%' }}
                  animate={{ x: 0 }}
                  exit={{ x: '-100%' }}
                  transition={{ type: 'spring', stiffness: 400, damping: 35 }}
                  className="absolute inset-0 z-10 flex flex-col bg-white"
                  style={{ borderRadius: '20px 20px 0 0' }}
                >
                  <div className="flex items-center gap-2 px-4 pt-5 pb-2 border-b border-[#F0F0F0]">
                    <button
                      onClick={() => setShowSidebar(false)}
                      className="w-8 h-8 rounded-full bg-[#F5F7FA] flex items-center justify-center"
                    >
                      <ChevronLeft size={16} className="text-[#64748B]" />
                    </button>
                    <span className="text-[15px] font-bold text-[#1A1A2E]">Suggestions</span>
                  </div>
                  <div className="flex-1 overflow-y-auto">
                    <SidebarContent />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* ── RIGHT PANEL — Chat ────────────────────────────────── */}
            <div className="flex flex-col flex-1 min-w-0" style={{ background: '#FAFAFA' }}>

              {/* Header */}
              <div className="flex items-center gap-3 px-4 py-3 bg-white border-b border-[#F0F0F0] shrink-0">
                {/* Mobile: back/suggestions button */}
                {isMobile && (
                  <button
                    onClick={() => setShowSidebar(true)}
                    className="w-8 h-8 rounded-full bg-[#F5F7FA] flex items-center justify-center shrink-0"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#64748B" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
                    </svg>
                  </button>
                )}

                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center text-base shrink-0"
                  style={{ background: cfg.color + '18' }}
                >
                  {cfg.avatar}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-bold text-[#1A1A2E] truncate">{cfg.nom}</p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                    <span className="text-[10px] text-[#94A3B8]">En ligne</span>
                  </div>
                </div>
                <button
                  onClick={() => setOpen(false)}
                  className="w-8 h-8 rounded-full bg-[#F5F7FA] hover:bg-[#E5E7EB] flex items-center justify-center transition-colors shrink-0"
                >
                  <X size={14} className="text-[#64748B]" />
                </button>
              </div>

              {/* Mobile: suggestion chips (horizontal scroll) */}
              {isMobile && messages.length <= 1 && (
                <div className="flex gap-2 px-4 py-2.5 overflow-x-auto shrink-0 scrollbar-hide border-b border-[#F5F7FA]">
                  {cfg.suggestions.map((s, i) => (
                    <button
                      key={i}
                      onClick={() => send(s)}
                      className="flex-none text-[11px] font-medium px-3 py-1.5 rounded-full border whitespace-nowrap transition-colors active:opacity-70"
                      style={{ borderColor: cfg.color + '40', color: cfg.color, background: cfg.color + '08' }}
                    >
                      {s.length > 28 ? s.slice(0, 27) + '…' : s}
                    </button>
                  ))}
                </div>
              )}

              {/* Messages */}
              <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
                {messages.map((m, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.18 }}
                    className={`flex gap-2.5 ${m.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}
                  >
                    {m.role === 'bot'
                      ? (/* eslint-disable-next-line @next/next/no-img-element */
                         <img src="/miaa-logo.png" alt="MIAA+" className="w-8 h-8 rounded-full object-cover shrink-0 mt-auto" />)
                      : <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm shrink-0 mt-auto" style={{ background: '#E5E7EB' }}>👤</div>
                    }

                    <div className={`flex flex-col gap-1 max-w-[78%] ${m.role === 'user' ? 'items-end' : 'items-start'}`}>
                      <div
                        className="px-4 py-2.5 text-[12.5px] leading-relaxed"
                        style={m.role === 'user'
                          ? { background: cfg.color, color: '#FFF', borderRadius: '18px 18px 4px 18px' }
                          : { background: '#FFF', color: '#374151', border: '1px solid #E5E7EB', borderRadius: '18px 18px 18px 4px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }
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
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src="/miaa-logo.png" alt="MIAA+" className="w-8 h-8 rounded-full object-cover shrink-0" />
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

              {/* Input bar */}
              <div className={`px-4 bg-white border-t border-[#F0F0F0] shrink-0 ${isMobile ? 'pb-safe py-3' : 'py-3'}`}>
                <div className="flex items-center gap-2 bg-[#F5F7FA] rounded-2xl px-4 py-2.5">
                  <input
                    ref={inputRef}
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send(input)}
                    placeholder="Écrivez votre message…"
                    disabled={loading}
                    className="flex-1 bg-transparent text-[13px] text-[#374151] placeholder-[#94A3B8] outline-none disabled:opacity-50 min-w-0"
                  />
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button className="w-8 h-8 rounded-full flex items-center justify-center text-[#94A3B8] hover:text-[#64748B] transition-colors">
                      <Mic size={15} />
                    </button>
                    <motion.button
                      whileTap={{ scale: 0.88 }}
                      onClick={() => send(input)}
                      disabled={loading || !input.trim()}
                      className="w-9 h-9 rounded-full flex items-center justify-center text-white disabled:opacity-40 transition-all"
                      style={{ background: input.trim() ? cfg.color : '#1A1A2E' }}
                    >
                      <Send size={14} />
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

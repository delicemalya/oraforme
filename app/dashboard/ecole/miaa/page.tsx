'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Bot, Send, Sparkles, TrendingUp, TrendingDown, AlertTriangle,
  Users, CreditCard, ClipboardList, BarChart2, RefreshCw, Lightbulb,
  GraduationCap, BookOpen, Calendar, ChevronRight, Loader2,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useTenant } from '@/lib/hooks/useTenant'
import { fmt, KpiCard, type Etudiant, type PaiementScolaire, type Note, type Absence } from '../_lib/shared'

// ── Types ──────────────────────────────────────────────────────────────────────

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  ts: Date
}

interface SchoolContext {
  totalEtudiants: number
  actifs: number
  suspendus: number
  revenusTotal: number
  revenusAnnee: number
  absencesTotales: number
  classeStats: { nom: string; count: number }[]
  paiementsRecents: PaiementScolaire[]
  etudiants: Etudiant[]
  notes: Note[]
  absences: Absence[]
}

// ── Quick prompts ──────────────────────────────────────────────────────────────

const QUICK_PROMPTS = [
  { label: 'Analyse des paiements', icon: CreditCard, prompt: 'Analyse les paiements du mois en cours et identifie les impayés critiques.' },
  { label: 'Taux d\'absence', icon: ClipboardList, prompt: 'Quel est le taux d\'absence global ? Quels élèves sont les plus absents ?' },
  { label: 'Performance académique', icon: BookOpen, prompt: 'Donne-moi une vue globale des résultats académiques par classe et par période.' },
  { label: 'Élèves à risque', icon: AlertTriangle, prompt: 'Identifie les élèves à risque : impayés + absences + notes faibles cumulés.' },
  { label: 'Rapport direction', icon: BarChart2, prompt: 'Génère un résumé exécutif pour la direction : effectifs, finances, résultats.' },
  { label: 'Recommandations RH', icon: Users, prompt: 'Quelles recommandations RH peux-tu faire en fonction de l\'activité scolaire actuelle ?' },
]

// ── Insight Card ───────────────────────────────────────────────────────────────

function InsightCard({ icon: Icon, label, value, sub, color, trend }: {
  icon: React.ElementType; label: string; value: string; sub?: string
  color: string; trend?: 'up' | 'down' | 'warn'
}) {
  const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : AlertTriangle
  const trendColor = trend === 'up' ? 'text-green-400' : trend === 'down' ? 'text-red-400' : 'text-amber-400'
  return (
    <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4 flex items-start gap-3">
      <div className="p-2 rounded-lg shrink-0" style={{ background: `${color}22` }}>
        <Icon size={16} style={{ color }} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[11px] text-white/40 uppercase tracking-wide mb-1">{label}</div>
        <div className="text-xl font-bold text-white">{value}</div>
        {sub && <div className="text-[11px] text-white/50 mt-0.5">{sub}</div>}
      </div>
      {trend && <TrendIcon size={14} className={trendColor + ' shrink-0 mt-1'} />}
    </div>
  )
}

// ── Chat Bubble ────────────────────────────────────────────────────────────────

function ChatBubble({ msg }: { msg: ChatMessage }) {
  const isUser = msg.role === 'user'
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={`flex gap-3 ${isUser ? 'flex-row-reverse' : ''}`}
    >
      <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${
        isUser ? 'bg-orange-500/20' : 'bg-orange-500/30'
      }`}>
        {isUser ? <Users size={13} className="text-orange-400" /> : <Bot size={13} className="text-orange-400" />}
      </div>
      <div className={`max-w-[75%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
        isUser
          ? 'bg-orange-500/20 text-white rounded-tr-sm'
          : 'bg-white/[0.06] text-white/90 rounded-tl-sm'
      }`}>
        {msg.content}
      </div>
    </motion.div>
  )
}

// ── Main Page ──────────────────────────────────────────────────────────────────

export default function MiaaPage() {
  const { tenantId, loading: tenantLoading } = useTenant()
  const [ctx, setCtx] = useState<SchoolContext | null>(null)
  const [loadingCtx, setLoadingCtx] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: `Bonjour ! Je suis MIAA+, votre assistant IA scolaire.\n\nJe peux analyser vos données en temps réel : paiements, absences, résultats académiques, effectifs et bien plus.\n\nChargez le contexte scolaire puis posez-moi vos questions, ou utilisez les suggestions rapides ci-dessous.`,
      ts: new Date(),
    },
  ])
  const [input, setInput] = useState('')
  const [thinking, setThinking] = useState(false)
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  // ── Load school context from Supabase ────────────────────────────────────────
  const loadContext = useCallback(async () => {
    if (!tenantId) return
    setLoadingCtx(true)
    try {
      const [
        { data: etudiants },
        { data: paiements },
        { data: notes },
        { data: absences },
        { data: classes },
      ] = await Promise.all([
        supabase.from('etudiants').select('*').eq('tenant_id', tenantId),
        supabase.from('paiements_scolaires').select('*').eq('tenant_id', tenantId).order('created_at', { ascending: false }).limit(200),
        supabase.from('notes_ecole').select('*').eq('tenant_id', tenantId),
        supabase.from('absences_ecole').select('*').eq('tenant_id', tenantId),
        supabase.from('classes_ecole').select('*').eq('tenant_id', tenantId),
      ])

      const etu = etudiants ?? []
      const pay = paiements ?? []
      const annee = new Date().getFullYear()

      const classeStats = (classes ?? []).map(c => ({
        nom: c.nom,
        count: etu.filter(e => e.classe === c.nom).length,
      }))

      const built: SchoolContext = {
        totalEtudiants: etu.length,
        actifs: etu.filter(e => e.statut === 'actif').length,
        suspendus: etu.filter(e => e.statut === 'suspendu').length,
        revenusTotal: pay.reduce((s, p) => s + (p.montant ?? 0), 0),
        revenusAnnee: pay.filter(p => p.annee === annee).reduce((s, p) => s + (p.montant ?? 0), 0),
        absencesTotales: (absences ?? []).length,
        classeStats,
        paiementsRecents: pay.slice(0, 20),
        etudiants: etu,
        notes: notes ?? [],
        absences: absences ?? [],
      }
      setCtx(built)

      const systemMsg: ChatMessage = {
        id: Date.now().toString(),
        role: 'assistant',
        content: `Contexte chargé avec succès !\n\n📊 **${etu.length} élèves** (${built.actifs} actifs, ${built.suspendus} suspendus)\n💰 **Revenus** : ${fmt(built.revenusAnnee)} cette année\n📅 **${(absences ?? []).length} absences** enregistrées\n\nPosez-moi n'importe quelle question sur votre établissement.`,
        ts: new Date(),
      }
      setMessages(prev => [...prev, systemMsg])
    } finally {
      setLoadingCtx(false)
    }
  }, [tenantId])

  // ── Build context summary for AI prompt ──────────────────────────────────────
  function buildContextSummary(): string {
    if (!ctx) return 'Aucun contexte chargé.'

    const annee = new Date().getFullYear()
    const impayesSuspendus = ctx.etudiants.filter(e => e.statut === 'suspendu').length
    const absParEtu = ctx.absences.length / Math.max(ctx.totalEtudiants, 1)

    const notesMoy = ctx.notes.length
      ? (ctx.notes.reduce((s, n) => s + (n.note / n.note_max) * 20, 0) / ctx.notes.length).toFixed(2)
      : 'N/A'

    const classesSummary = ctx.classeStats.map(c => `${c.nom}: ${c.count} élèves`).join(', ')

    return `=== CONTEXTE ÉCOLE (${annee}) ===
Effectifs: ${ctx.totalEtudiants} élèves total | ${ctx.actifs} actifs | ${ctx.suspendus} suspendus (impayés)
Finances: ${fmt(ctx.revenusAnnee)} perçus cette année (${fmt(ctx.revenusTotal)} total)
Absences: ${ctx.absences.length} absences | moyenne ${absParEtu.toFixed(1)} par élève
Notes: ${ctx.notes.length} notes saisies | moyenne générale ${notesMoy}/20
Classes: ${classesSummary || 'N/A'}
Paiements récents (20 derniers):
${ctx.paiementsRecents.map(p => `- ${p.libelle}: ${fmt(p.montant)} (${p.statut})`).join('\n')}
=== FIN CONTEXTE ===`
  }

  // ── Send message ──────────────────────────────────────────────────────────────
  async function sendMessage(text?: string) {
    const userText = (text ?? input).trim()
    if (!userText || thinking) return
    setInput('')

    const userMsg: ChatMessage = { id: Date.now().toString(), role: 'user', content: userText, ts: new Date() }
    setMessages(prev => [...prev, userMsg])
    setThinking(true)

    try {
      const contextSummary = buildContextSummary()
      // Inject school data into the message so the route's system prompt stays intact
      const messageWithContext = ctx
        ? `${contextSummary}\n\nQuestion : ${userText}`
        : userText

      const history = messages
        .filter(m => m.id !== 'welcome')
        .slice(-10)
        .map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }))

      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: messageWithContext,
          module: 'ecole',
          history,
        }),
      })

      if (!response.ok) throw new Error('API error')
      const data = await response.json()
      const aiContent = data.reply ?? 'Désolé, je n\'ai pas pu générer une réponse.'

      const aiMsg: ChatMessage = { id: (Date.now() + 1).toString(), role: 'assistant', content: aiContent, ts: new Date() }
      setMessages(prev => [...prev, aiMsg])
    } catch {
      const errMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'Une erreur est survenue. Vérifiez que l\'API IA est configurée ou réessayez.',
        ts: new Date(),
      }
      setMessages(prev => [...prev, errMsg])
    } finally {
      setThinking(false)
    }
  }

  // ── Computed insights ─────────────────────────────────────────────────────────
  const tauxSuspension = ctx ? ((ctx.suspendus / Math.max(ctx.totalEtudiants, 1)) * 100).toFixed(1) : '—'
  const tauxAbsence = ctx ? ((ctx.absences.length / Math.max(ctx.totalEtudiants, 1))).toFixed(1) : '—'
  const moyenneNotes = ctx && ctx.notes.length
    ? ((ctx.notes.reduce((s, n) => s + (n.note / n.note_max) * 20, 0) / ctx.notes.length)).toFixed(1)
    : '—'

  if (tenantLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="animate-spin text-orange-400" size={28} />
      </div>
    )
  }

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] gap-4">
      {/* Header */}
      <div className="flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-orange-500/20">
            <Bot size={20} className="text-orange-400" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-white flex items-center gap-2">
              MIAA+ <Sparkles size={14} className="text-orange-400" />
            </h1>
            <p className="text-xs text-white/40">Assistant IA scolaire — analyse & insights en temps réel</p>
          </div>
        </div>
        <button
          onClick={loadContext}
          disabled={loadingCtx}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-orange-500/20 text-orange-400 text-xs hover:bg-orange-500/30 transition disabled:opacity-50"
        >
          {loadingCtx ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
          {ctx ? 'Actualiser' : 'Charger le contexte'}
        </button>
      </div>

      {/* KPI insights row */}
      <AnimatePresence>
        {ctx && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="grid grid-cols-2 lg:grid-cols-4 gap-3 shrink-0"
          >
            <InsightCard
              icon={GraduationCap} label="Élèves actifs" color="#F97316"
              value={ctx.actifs.toString()} sub={`${ctx.totalEtudiants} total`}
              trend={ctx.actifs > ctx.suspendus ? 'up' : 'warn'}
            />
            <InsightCard
              icon={CreditCard} label="Revenus (année)" color="#2EA043"
              value={fmt(ctx.revenusAnnee)} sub="paiements scolaires"
              trend="up"
            />
            <InsightCard
              icon={AlertTriangle} label="Taux suspension" color="#F59E0B"
              value={`${tauxSuspension}%`} sub={`${ctx.suspendus} élèves bloqués`}
              trend={parseFloat(tauxSuspension) > 10 ? 'warn' : 'up'}
            />
            <InsightCard
              icon={BookOpen} label="Moy. générale" color="#8B5CF6"
              value={moyenneNotes === '—' ? '—' : `${moyenneNotes}/20`}
              sub={`${ctx.notes.length} notes saisies`}
              trend={parseFloat(moyenneNotes) >= 10 ? 'up' : 'down'}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Chat + sidebar */}
      <div className="flex gap-4 flex-1 min-h-0">
        {/* Chat area */}
        <div className="flex flex-col flex-1 min-w-0 bg-white/[0.02] border border-white/[0.06] rounded-xl overflow-hidden">
          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            <AnimatePresence initial={false}>
              {messages.map(msg => (
                <ChatBubble key={msg.id} msg={msg} />
              ))}
            </AnimatePresence>
            {thinking && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex gap-3">
                <div className="w-7 h-7 rounded-full flex items-center justify-center bg-orange-500/30">
                  <Bot size={13} className="text-orange-400" />
                </div>
                <div className="bg-white/[0.06] rounded-2xl rounded-tl-sm px-4 py-3 flex items-center gap-2">
                  <span className="w-1.5 h-1.5 bg-orange-400 rounded-full animate-bounce [animation-delay:0ms]" />
                  <span className="w-1.5 h-1.5 bg-orange-400 rounded-full animate-bounce [animation-delay:150ms]" />
                  <span className="w-1.5 h-1.5 bg-orange-400 rounded-full animate-bounce [animation-delay:300ms]" />
                </div>
              </motion.div>
            )}
            <div ref={endRef} />
          </div>

          {/* Quick prompts */}
          {!ctx && (
            <div className="px-4 pb-2">
              <p className="text-[11px] text-white/30 mb-2 uppercase tracking-wide">Suggestions</p>
              <div className="flex flex-wrap gap-2">
                {QUICK_PROMPTS.slice(0, 3).map(qp => (
                  <button
                    key={qp.label}
                    onClick={() => { if (!ctx) { loadContext().then(() => sendMessage(qp.prompt)) } else sendMessage(qp.prompt) }}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/[0.05] text-white/60 text-xs hover:bg-white/[0.1] hover:text-white transition"
                  >
                    <qp.icon size={11} />
                    {qp.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Input */}
          <div className="border-t border-white/[0.06] p-3 flex gap-2">
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
              placeholder={ctx ? 'Posez votre question…' : 'Chargez le contexte puis posez votre question…'}
              className="flex-1 bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/30 outline-none focus:border-orange-500/40 transition"
            />
            <button
              onClick={() => sendMessage()}
              disabled={!input.trim() || thinking}
              className="px-3 py-2 rounded-lg bg-orange-500 text-white hover:bg-orange-600 disabled:opacity-40 transition"
            >
              <Send size={15} />
            </button>
          </div>
        </div>

        {/* Sidebar: quick prompts */}
        <div className="w-56 shrink-0 hidden lg:flex flex-col gap-3">
          <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-4 flex-1">
            <div className="flex items-center gap-2 mb-4">
              <Lightbulb size={14} className="text-orange-400" />
              <span className="text-xs font-medium text-white/70 uppercase tracking-wide">Analyses rapides</span>
            </div>
            <div className="space-y-2">
              {QUICK_PROMPTS.map(qp => (
                <button
                  key={qp.label}
                  onClick={() => sendMessage(qp.prompt)}
                  disabled={thinking}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-white/[0.03] hover:bg-white/[0.08] text-left transition group disabled:opacity-40"
                >
                  <qp.icon size={13} className="text-orange-400 shrink-0" />
                  <span className="text-xs text-white/70 group-hover:text-white transition flex-1 leading-snug">{qp.label}</span>
                  <ChevronRight size={11} className="text-white/20 group-hover:text-white/50 shrink-0 transition" />
                </button>
              ))}
            </div>
          </div>

          {/* Context status */}
          <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <div className={`w-2 h-2 rounded-full ${ctx ? 'bg-green-400' : 'bg-amber-400'} animate-pulse`} />
              <span className="text-xs text-white/50">
                {ctx ? 'Contexte actif' : 'Sans contexte'}
              </span>
            </div>
            {ctx && (
              <div className="space-y-1.5 text-[11px] text-white/40">
                <div className="flex justify-between">
                  <span>Élèves</span>
                  <span className="text-white/70">{ctx.totalEtudiants}</span>
                </div>
                <div className="flex justify-between">
                  <span>Notes</span>
                  <span className="text-white/70">{ctx.notes.length}</span>
                </div>
                <div className="flex justify-between">
                  <span>Absences</span>
                  <span className="text-white/70">{ctx.absences.length}</span>
                </div>
                <div className="flex justify-between">
                  <span>Paiements</span>
                  <span className="text-white/70">{ctx.paiementsRecents.length}+</span>
                </div>
              </div>
            )}
            {!ctx && (
              <p className="text-[11px] text-white/30 leading-relaxed">
                Cliquez sur «Charger le contexte» pour activer l'analyse IA de vos données.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

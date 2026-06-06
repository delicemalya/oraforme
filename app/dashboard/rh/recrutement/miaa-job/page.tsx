'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Send, Loader2, RotateCcw, ChevronLeft, Users, Star, HelpCircle, GitCompare, TrendingUp, FileSearch } from 'lucide-react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { useTenant } from '@/lib/hooks/useTenant'

interface Message {
  role: 'user' | 'assistant'
  content: string
  ts: number
}

const SUGGESTIONS = [
  { text: 'Analyse toutes les candidatures',     icon: FileSearch  },
  { text: 'Montre-moi le TOP 5',                 icon: Star        },
  { text: 'Qui est le meilleur candidat ?',       icon: TrendingUp  },
  { text: "Génère les questions d'entretien",     icon: HelpCircle  },
  { text: 'Compare les 3 meilleurs profils',      icon: GitCompare  },
  { text: 'Combien de candidats par offre ?',     icon: Users       },
]

function AssistantText({ content }: { content: string }) {
  return (
    <div className="text-[14px] text-[#1a1a1a] leading-relaxed whitespace-pre-wrap">
      {content}
    </div>
  )
}

export default function MiaaJobPage() {
  const router = useRouter()
  const { tenantId } = useTenant()
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput]       = useState('')
  const [loading, setLoading]   = useState(false)
  const bottomRef   = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  const autoResize = useCallback(() => {
    const ta = textareaRef.current
    if (!ta) return
    ta.style.height = 'auto'
    ta.style.height = Math.min(ta.scrollHeight, 160) + 'px'
  }, [])

  async function send(text?: string) {
    const content = (text ?? input).trim()
    if (!content || loading) return
    setInput('')
    if (textareaRef.current) textareaRef.current.style.height = 'auto'

    const newMsg: Message = { role: 'user', content, ts: Date.now() }
    const updated = [...messages, newMsg]
    setMessages(updated)
    setLoading(true)

    try {
      const res = await fetch('/api/jobs/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId,
          messages: updated.map(m => ({ role: m.role, content: m.content })),
        }),
      })
      const data = await res.json() as { response?: string; error?: string }
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: data.response ?? 'Désolé, une erreur est survenue.',
        ts: Date.now(),
      }])
    } catch {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Connexion impossible. Vérifiez votre réseau.',
        ts: Date.now(),
      }])
    }
    setLoading(false)
    setTimeout(() => textareaRef.current?.focus(), 50)
  }

  const canSend = input.trim().length > 0 && !loading

  return (
    <div className="flex flex-col bg-white rounded-2xl border border-[#E2E8F0] shadow-sm overflow-hidden"
      style={{ height: 'calc(100vh - 120px)', minHeight: 520 }}>

      {/* ── Header fixe ───────────────────────────────────────────────── */}
      <div className="shrink-0 flex items-center gap-3 px-4 sm:px-6 py-3 border-b border-[#F1F5F9] bg-white">
        <button
          onClick={() => router.push('/dashboard/rh/recrutement')}
          className="p-1.5 text-[#94A3B8] hover:text-[#0F172A] hover:bg-[#F1F5F9] rounded-lg transition-colors"
        >
          <ChevronLeft size={16} />
        </button>

        <div className="w-8 h-8 rounded-xl overflow-hidden shrink-0 shadow-sm">
          <Image src="/logo-miaa-job.png" alt="MIAA JOB" width={32} height={32}
            className="w-full h-full object-cover" priority />
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-bold text-[#0F172A] leading-tight">MIAA JOB</p>
          <p className="text-[10px] text-[#64748B]">Recruteur IA · Propulsé par MIAA+</p>
        </div>

        <button
          onClick={() => { setMessages([]); setInput('') }}
          title="Nouvelle conversation"
          className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] text-[#64748B] font-semibold
            hover:text-[#DC2626] hover:bg-red-50 border border-[#E2E8F0] hover:border-red-100
            rounded-xl transition-colors"
        >
          <RotateCcw size={11} /> Nouvelle conv.
        </button>
      </div>

      {/* ── Zone messages ─────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-4 sm:px-8 py-6">

        {/* État vide — welcome */}
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center px-4">

            {/* Logo */}
            <div className="w-20 h-20 rounded-2xl overflow-hidden shadow-lg mb-5 shrink-0">
              <Image src="/logo-miaa-job.png" alt="MIAA JOB" width={80} height={80}
                className="w-full h-full object-cover" priority />
            </div>

            <h2 className="text-[20px] font-extrabold text-[#0F172A] mb-2 leading-tight">
              Bonjour, je suis <span className="text-[#F59E0B]">MIAA JOB</span>
            </h2>
            <p className="text-[13px] text-[#64748B] mb-8 max-w-sm leading-relaxed">
              Votre recruteur senior IA. Analysez vos candidatures, identifiez les meilleurs talents et préparez vos entretiens.
            </p>

            {/* Suggestions en grille 2 colonnes */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 w-full max-w-lg">
              {SUGGESTIONS.map(s => {
                const Icon = s.icon
                return (
                  <button
                    key={s.text}
                    onClick={() => void send(s.text)}
                    className="flex items-center gap-3 px-4 py-3 bg-white border border-[#E2E8F0] rounded-xl
                      text-[12.5px] text-[#374151] font-medium text-left
                      hover:border-[#F59E0B]/60 hover:bg-[#FFFBEB] hover:text-[#B45309]
                      transition-all shadow-sm group"
                  >
                    <div className="w-7 h-7 rounded-lg bg-[#FEF3C7] flex items-center justify-center shrink-0
                      group-hover:bg-[#F59E0B]/20 transition-colors">
                      <Icon size={13} className="text-[#F59E0B]" />
                    </div>
                    {s.text}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* Messages */}
        {messages.length > 0 && (
          <div className="max-w-2xl mx-auto space-y-6">
            {messages.map((m) => (
              <div key={m.ts} className={`flex gap-3 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>

                {m.role === 'assistant' && (
                  <div className="shrink-0 mt-0.5 w-7 h-7 rounded-lg overflow-hidden shadow-sm">
                    <Image src="/logo-miaa-job.png" alt="MIAA JOB" width={28} height={28}
                      className="w-full h-full object-cover" />
                  </div>
                )}

                {m.role === 'assistant' ? (
                  <div className="flex-1 min-w-0 pt-0.5">
                    <AssistantText content={m.content} />
                    <p className="text-[10px] text-[#CBD5E1] mt-2">
                      {new Date(m.ts).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                ) : (
                  <div className="max-w-[75%] sm:max-w-[65%]">
                    <div className="bg-[#F59E0B] text-white rounded-2xl rounded-tr-sm px-4 py-3 shadow-sm">
                      <p className="text-[14px] leading-relaxed whitespace-pre-wrap">{m.content}</p>
                    </div>
                    <p className="text-[10px] text-[#CBD5E1] mt-1 text-right">
                      {new Date(m.ts).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                )}
              </div>
            ))}

            {/* Typing indicator */}
            {loading && (
              <div className="flex gap-3 justify-start">
                <div className="shrink-0 mt-0.5 w-7 h-7 rounded-lg overflow-hidden shadow-sm">
                  <Image src="/logo-miaa-job.png" alt="MIAA JOB" width={28} height={28}
                    className="w-full h-full object-cover" />
                </div>
                <div className="flex items-center gap-1.5 py-3">
                  <div className="w-2 h-2 rounded-full bg-[#F59E0B] animate-bounce" style={{ animationDelay: '0ms' }} />
                  <div className="w-2 h-2 rounded-full bg-[#F59E0B] animate-bounce" style={{ animationDelay: '150ms' }} />
                  <div className="w-2 h-2 rounded-full bg-[#F59E0B] animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {/* ── Barre de saisie ───────────────────────────────────────────── */}
      <div className="shrink-0 border-t border-[#F1F5F9] bg-white px-4 sm:px-8 py-4">
        <div className="max-w-2xl mx-auto">

          {/* Suggestions rapides (après messages) */}
          {messages.length > 0 && !loading && (
            <div className="flex gap-2 mb-3 overflow-x-auto pb-1 scrollbar-hide">
              {SUGGESTIONS.slice(0, 3).map(s => (
                <button key={s.text} onClick={() => void send(s.text)}
                  className="shrink-0 px-3 py-1.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded-full
                    text-[11px] text-[#64748B] hover:border-[#F59E0B]/60 hover:text-[#B45309]
                    transition-colors whitespace-nowrap">
                  {s.text}
                </button>
              ))}
            </div>
          )}

          {/* Input */}
          <div className="relative flex items-end gap-3 bg-[#F8FAFC] border border-[#E2E8F0] rounded-2xl
            px-4 py-3 focus-within:border-[#F59E0B]/60 focus-within:ring-2 focus-within:ring-[#F59E0B]/10
            transition-all shadow-sm">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={e => { setInput(e.target.value); autoResize() }}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void send() }
              }}
              placeholder="Posez votre question à MIAA JOB… (Entrée pour envoyer)"
              disabled={loading}
              rows={1}
              className="flex-1 bg-transparent resize-none text-[14px] text-[#0F172A] outline-none
                placeholder:text-[#94A3B8] disabled:opacity-50 leading-relaxed"
              style={{ maxHeight: 160 }}
            />
            <div className="flex items-center gap-2 shrink-0 mb-0.5">
              <button
                onClick={() => void send()}
                disabled={!canSend}
                className="w-8 h-8 bg-[#F59E0B] text-white rounded-xl flex items-center justify-center
                  hover:bg-[#D97706] disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-sm"
              >
                {loading ? <Loader2 size={14} className="animate-spin" /> : <Send size={13} />}
              </button>
            </div>
          </div>

          <p className="text-[10px] text-[#CBD5E1] text-center mt-2">
            Entrée pour envoyer · Maj+Entrée pour nouvelle ligne
          </p>
        </div>
      </div>
    </div>
  )
}

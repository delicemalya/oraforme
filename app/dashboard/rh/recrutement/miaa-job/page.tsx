'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Send, Loader2, RotateCcw, Plus } from 'lucide-react'
import Image from 'next/image'
import { useTenant } from '@/lib/hooks/useTenant'

interface Message {
  role: 'user' | 'assistant'
  content: string
  ts: number
}

const SUGGESTIONS = [
  'Analyse toutes les candidatures',
  'Montre-moi le TOP 5',
  'Qui est le meilleur candidat ?',
  'Génère les questions d\'entretien',
  'Compare les 3 meilleurs profils',
]

function AssistantText({ content }: { content: string }) {
  return (
    <div className="text-[14px] text-[#1a1a1a] leading-relaxed whitespace-pre-wrap">
      {content}
    </div>
  )
}

export default function MiaaJobPage() {
  const { tenantId } = useTenant()
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput]       = useState('')
  const [loading, setLoading]   = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
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
    <div className="flex flex-col bg-white" style={{ height: 'calc(100vh - 140px)', minHeight: 480 }}>

      {/* ── Messages zone ─────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-4 sm:px-8 py-6">

        {/* Empty state — Claude-style welcome */}
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <div className="mb-5 relative">
              <Image
                src="/logo-miaa-job.png"
                alt="MIAA+ JOB"
                width={80}
                height={80}
                className="rounded-2xl shadow-md"
                priority
              />
            </div>
            <h2 className="text-[22px] font-bold text-[#0F172A] mb-2">
              Bonjour, je suis MIAA+ Recrutement
            </h2>
            <p className="text-[14px] text-[#64748B] mb-8 max-w-md">
              Votre recruteur senior IA. Posez-moi vos questions sur les candidatures, les offres ou les talents.
            </p>
            <div className="flex flex-wrap gap-2.5 justify-center max-w-lg">
              {SUGGESTIONS.map(s => (
                <button
                  key={s}
                  onClick={() => void send(s)}
                  className="px-4 py-2 bg-white border border-[#E2E8F0] rounded-full text-[13px] text-[#374151] hover:border-[#F59E0B] hover:bg-[#FFFBEB] hover:text-[#B45309] transition-all shadow-sm font-medium"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Messages */}
        {messages.length > 0 && (
          <div className="max-w-2xl mx-auto space-y-6">
            {messages.map((m) => (
              <div key={m.ts} className={`flex gap-3 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>

                {/* Assistant avatar */}
                {m.role === 'assistant' && (
                  <div className="shrink-0 mt-0.5">
                    <Image
                      src="/logo-miaa-job.png"
                      alt="MIAA+"
                      width={28}
                      height={28}
                      className="rounded-lg shadow-sm"
                    />
                  </div>
                )}

                {m.role === 'assistant' ? (
                  /* Assistant — no bubble, clean text */
                  <div className="flex-1 min-w-0 pt-0.5">
                    <AssistantText content={m.content} />
                    <p className="text-[10px] text-[#CBD5E1] mt-2">
                      {new Date(m.ts).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                ) : (
                  /* User — amber bubble */
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
                <div className="shrink-0 mt-0.5">
                  <Image src="/logo-miaa-job.png" alt="MIAA+" width={28} height={28} className="rounded-lg shadow-sm" />
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

      {/* ── Input bar — Claude-style ───────────────────────────────────── */}
      <div className="shrink-0 border-t border-[#F1F5F9] bg-white px-4 sm:px-8 py-4">
        <div className="max-w-2xl mx-auto">

          {/* Suggestions rapides après messages */}
          {messages.length > 0 && !loading && (
            <div className="flex gap-2 mb-3 overflow-x-auto pb-1 scrollbar-hide">
              {SUGGESTIONS.slice(0, 3).map(s => (
                <button
                  key={s}
                  onClick={() => void send(s)}
                  className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded-full text-[11px] text-[#64748B] hover:border-[#F59E0B]/60 hover:text-[#B45309] transition-colors whitespace-nowrap"
                >
                  <Plus size={10} />
                  {s}
                </button>
              ))}
            </div>
          )}

          {/* Input container */}
          <div className="relative flex items-end gap-3 bg-[#F8FAFC] border border-[#E2E8F0] rounded-2xl px-4 py-3 focus-within:border-[#F59E0B]/60 focus-within:ring-2 focus-within:ring-[#F59E0B]/10 transition-all shadow-sm">

            {/* Textarea */}
            <textarea
              ref={textareaRef}
              value={input}
              onChange={e => { setInput(e.target.value); autoResize() }}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  void send()
                }
              }}
              placeholder="Posez votre question à MIAA+ Recrutement... (Entrée pour envoyer)"
              disabled={loading}
              rows={1}
              className="flex-1 bg-transparent resize-none text-[14px] text-[#0F172A] outline-none placeholder:text-[#94A3B8] disabled:opacity-50 leading-relaxed"
              style={{ maxHeight: 160 }}
            />

            {/* Actions droite */}
            <div className="flex items-center gap-2 shrink-0 mb-0.5">
              {messages.length > 0 && (
                <button
                  onClick={() => setMessages([])}
                  title="Nouvelle conversation"
                  className="p-1.5 text-[#94A3B8] hover:text-[#DC2626] hover:bg-red-50 rounded-lg transition-colors"
                >
                  <RotateCcw size={14} />
                </button>
              )}
              <button
                onClick={() => void send()}
                disabled={!canSend}
                className="w-8 h-8 bg-[#F59E0B] text-white rounded-xl flex items-center justify-center hover:bg-[#D97706] disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-sm"
              >
                {loading
                  ? <Loader2 size={14} className="animate-spin" />
                  : <Send size={13} />
                }
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

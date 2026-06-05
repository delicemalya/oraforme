'use client'

import { useState, useRef, useEffect } from 'react'
import { Send, Loader2, Sparkles, RotateCcw } from 'lucide-react'
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

export default function MiaaJobPage() {
  const { tenantId } = useTenant()
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  async function send(text?: string) {
    const content = (text ?? input).trim()
    if (!content || loading) return
    setInput('')

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
    setTimeout(() => inputRef.current?.focus(), 50)
  }

  return (
    <div className="flex flex-col h-[calc(100vh-120px)] max-w-3xl mx-auto">
      {/* Header */}
      <div className="bg-white border border-[#E2E8F0] rounded-t-2xl px-5 py-4 flex items-center justify-between shadow-sm shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#F59E0B] to-[#E09000] flex items-center justify-center shadow-sm">
            <Sparkles size={16} className="text-white" />
          </div>
          <div>
            <p className="text-sm font-bold text-[#0F172A]">MIAA+ Recrutement</p>
            <p className="text-[10px] text-[#16A34A] font-semibold">● En ligne</p>
          </div>
        </div>
        {messages.length > 0 && (
          <button onClick={() => setMessages([])} className="flex items-center gap-1.5 text-xs text-[#64748B] hover:text-[#DC2626] transition-colors p-1.5 hover:bg-[#F1F5F9] rounded-lg">
            <RotateCcw size={13} /> Réinitialiser
          </button>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto bg-[#F8FAFC] border-x border-[#E2E8F0] px-4 py-5 space-y-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center space-y-6">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#F59E0B] to-[#E09000] flex items-center justify-center shadow-lg">
              <Sparkles size={28} className="text-white" />
            </div>
            <div>
              <p className="text-base font-bold text-[#0F172A]">Bonjour, je suis MIAA+ Recrutement</p>
              <p className="text-sm text-[#64748B] mt-1">Votre recruteur senior IA. Posez-moi vos questions sur les candidatures.</p>
            </div>
            <div className="flex flex-wrap gap-2 justify-center">
              {SUGGESTIONS.map(s => (
                <button key={s} onClick={() => send(s)}
                  className="px-3 py-2 bg-white border border-[#E2E8F0] rounded-xl text-xs text-[#0F172A] hover:border-[#F59E0B]/60 hover:bg-[#FFFBEB] transition-all shadow-sm font-medium">
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m) => (
          <div key={m.ts} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            {m.role === 'assistant' && (
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#F59E0B] to-[#E09000] flex items-center justify-center shrink-0 mr-2.5 mt-0.5 shadow-sm">
                <Sparkles size={12} className="text-white" />
              </div>
            )}
            <div className={`max-w-[80%] rounded-2xl px-4 py-3 shadow-sm ${
              m.role === 'user'
                ? 'bg-[#F59E0B] text-white rounded-tr-sm'
                : 'bg-white border border-[#E2E8F0] text-[#0F172A] rounded-tl-sm'
            }`}>
              <p className={`text-sm leading-relaxed whitespace-pre-wrap ${m.role === 'user' ? 'text-white' : 'text-[#0F172A]'}`}>
                {m.content}
              </p>
              <p className={`text-[10px] mt-1.5 ${m.role === 'user' ? 'text-white/60' : 'text-[#94A3B8]'}`}>
                {new Date(m.ts).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#F59E0B] to-[#E09000] flex items-center justify-center shrink-0 mr-2.5 mt-0.5 shadow-sm">
              <Sparkles size={12} className="text-white" />
            </div>
            <div className="bg-white border border-[#E2E8F0] rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm">
              <div className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-[#F59E0B] animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-1.5 h-1.5 rounded-full bg-[#F59E0B] animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-1.5 h-1.5 rounded-full bg-[#F59E0B] animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="bg-white border border-t-0 border-[#E2E8F0] rounded-b-2xl px-4 py-3 shadow-sm shrink-0">
        {messages.length > 0 && (
          <div className="flex gap-2 mb-3 overflow-x-auto pb-1">
            {SUGGESTIONS.slice(0, 3).map(s => (
              <button key={s} onClick={() => send(s)}
                className="shrink-0 px-2.5 py-1 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg text-[10px] text-[#64748B] hover:border-[#F59E0B]/50 hover:text-[#F59E0B] transition-colors whitespace-nowrap">
                {s}
              </button>
            ))}
          </div>
        )}
        <div className="flex gap-2">
          <input
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void send() } }}
            placeholder="Posez votre question à MIAA+ Recrutement..."
            disabled={loading}
            className="flex-1 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl px-4 py-2.5 text-sm text-[#0F172A] outline-none focus:border-[#F59E0B]/60 transition-colors disabled:opacity-50 placeholder:text-[#94A3B8]"
          />
          <button
            onClick={() => void send()}
            disabled={!input.trim() || loading}
            className="w-10 h-10 bg-[#F59E0B] text-white rounded-xl flex items-center justify-center hover:bg-[#E09000] disabled:opacity-40 transition-colors shadow-sm shrink-0"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : <Send size={15} />}
          </button>
        </div>
      </div>
    </div>
  )
}

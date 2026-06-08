'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { ArrowLeft, Send, Loader2, Bot, User, RefreshCw, Sparkles } from 'lucide-react'

interface Msg { role: 'user' | 'assistant'; content: string }
interface KPIs {
  ca_aujourd_hui: number; ca_mois: number; commandes_aujourd_hui: number
  commandes_en_cours: number; livraisons_en_cours: number; reservations_ce_soir: number
  top_plats_rentables: { nom: string; marge_pct: number }[]
  stocks_critiques: string[]
}

const fmtNum = (n: number) => new Intl.NumberFormat('fr-FR').format(n)

const QUICK_PROMPTS = [
  'Quels sont mes plats les plus rentables ?',
  'Comment augmenter mon CA ce soir ?',
  'Analyse mes stocks et recommande des achats',
  'Donne-moi 3 idées pour réduire mes pertes',
]

export default function MIAARestaurantPage() {
  const [messages,  setMessages]  = useState<Msg[]>([])
  const [input,     setInput]     = useState('')
  const [streaming, setStreaming] = useState(false)
  const [briefing,  setBriefing]  = useState('')
  const [kpis,      setKpis]      = useState<KPIs | null>(null)
  const [loadBrief, setLoadBrief] = useState(false)
  const bottomRef                  = useRef<HTMLDivElement>(null)
  const inputRef                   = useRef<HTMLTextAreaElement>(null)

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  async function fetchBriefing() {
    setLoadBrief(true); setBriefing('')
    const res = await fetch('/api/resto/miaa')
    if (res.ok) { const d = await res.json(); setBriefing(d.briefing ?? ''); setKpis(d.kpis ?? null) }
    setLoadBrief(false)
  }

  async function send(text?: string) {
    const msg = (text ?? input).trim()
    if (!msg || streaming) return
    setInput('')

    const history = messages.map(m => ({ role: m.role, content: m.content }))
    const next: Msg[] = [...messages, { role: 'user', content: msg }]
    setMessages(next)
    setStreaming(true)

    const assistantIdx = next.length
    setMessages(prev => [...prev, { role: 'assistant', content: '' }])

    const res = await fetch('/api/resto/miaa', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: msg, history }),
    })

    if (!res.body) { setStreaming(false); return }
    const reader  = res.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue
        const payload = line.slice(6).trim()
        if (payload === '[DONE]') break
        try {
          const { text } = JSON.parse(payload)
          setMessages(prev => {
            const a = [...prev]
            a[assistantIdx] = { role: 'assistant', content: a[assistantIdx].content + text }
            return a
          })
        } catch { /* ignore */ }
      }
    }
    setStreaming(false)
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col">
      <div className="bg-white border-b border-[#E2E8F0] px-4 sm:px-6 py-4 shrink-0">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/dashboard/restaurant" className="flex items-center gap-1 text-[#64748B] text-[13px]"><ArrowLeft size={14} /> Restaurant</Link>
            <span className="text-[#E2E8F0]">/</span>
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center">
                <Bot size={14} className="text-white" />
              </div>
              <div>
                <h1 className="text-[14px] font-black text-[#0F172A] leading-none">MIAA+</h1>
                <p className="text-[10px] text-[#94A3B8]">Assistant IA Restaurant</p>
              </div>
            </div>
          </div>
          <button onClick={fetchBriefing} disabled={loadBrief}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 border border-amber-200 text-amber-700 rounded-xl text-[12px] font-bold hover:bg-amber-100 disabled:opacity-50">
            {loadBrief ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
            Briefing
          </button>
        </div>
      </div>

      {kpis && (
        <div className="bg-amber-500 px-4 sm:px-6 py-2 shrink-0">
          <div className="max-w-4xl mx-auto flex flex-wrap gap-x-5 gap-y-0.5">
            {[
              ['CA Auj.', fmtNum(kpis.ca_aujourd_hui) + ' FCFA'],
              ['CA Mois', fmtNum(kpis.ca_mois) + ' FCFA'],
              ['Cmdes en cours', String(kpis.commandes_en_cours)],
              ['Livraisons', String(kpis.livraisons_en_cours)],
              ['Réservations', String(kpis.reservations_ce_soir)],
              ['Stocks critiques', String(kpis.stocks_critiques.length)],
            ].map(([k, v]) => (
              <span key={k} className="text-[11px] text-white/90">
                <span className="font-bold text-white">{v}</span> {k}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4 space-y-4">

          {briefing && (
            <div className="bg-gradient-to-br from-amber-50 to-yellow-50 rounded-2xl border border-amber-200 p-4">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles size={14} className="text-amber-600" />
                <span className="text-[12px] font-black text-amber-800 uppercase tracking-wide">Briefing du jour</span>
              </div>
              <pre className="text-[13px] text-[#475569] whitespace-pre-wrap font-sans leading-relaxed">{briefing}</pre>
            </div>
          )}

          {messages.length === 0 && !briefing && (
            <div className="text-center py-12">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center mx-auto mb-4">
                <Bot size={28} className="text-white" />
              </div>
              <h2 className="text-[18px] font-black text-[#0F172A] mb-2">Bonjour, je suis MIAA+</h2>
              <p className="text-[13px] text-[#64748B] max-w-md mx-auto mb-6">
                Votre assistant IA restaurant. Je connais vos KPIs en temps réel, vos plats rentables, vos stocks critiques.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-w-lg mx-auto">
                {QUICK_PROMPTS.map(p => (
                  <button key={p} onClick={() => send(p)}
                    className="text-left px-3 py-2.5 bg-white border border-[#E2E8F0] rounded-xl text-[12px] text-[#475569] hover:border-amber-300 hover:bg-amber-50 transition-all">
                    {p}
                  </button>
                ))}
              </div>
              <button onClick={fetchBriefing} disabled={loadBrief}
                className="mt-4 flex items-center gap-2 mx-auto px-4 py-2 bg-amber-500 text-white rounded-xl text-[13px] font-bold hover:bg-amber-600 disabled:opacity-50">
                {loadBrief ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                Générer le briefing
              </button>
            </div>
          )}

          {messages.map((m, i) => (
            <div key={i} className={`flex gap-3 ${m.role === 'user' ? 'flex-row-reverse' : ''}`}>
              <div className={`w-8 h-8 rounded-xl shrink-0 flex items-center justify-center ${m.role === 'assistant' ? 'bg-gradient-to-br from-amber-400 to-amber-600' : 'bg-[#E2E8F0]'}`}>
                {m.role === 'assistant' ? <Bot size={14} className="text-white" /> : <User size={14} className="text-[#64748B]" />}
              </div>
              <div className={`max-w-[85%] px-4 py-3 rounded-2xl text-[13px] leading-relaxed whitespace-pre-wrap ${
                m.role === 'user' ? 'bg-amber-500 text-white rounded-tr-sm' : 'bg-white border border-[#E2E8F0] text-[#0F172A] rounded-tl-sm shadow-sm'
              }`}>
                {m.content}
                {m.role === 'assistant' && streaming && i === messages.length - 1 && (
                  <span className="inline-block w-1.5 h-4 bg-amber-400 ml-1 animate-pulse rounded-sm" />
                )}
              </div>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>
      </div>

      <div className="bg-white border-t border-[#E2E8F0] px-4 sm:px-6 py-3 shrink-0">
        <div className="max-w-4xl mx-auto">
          {messages.length > 0 && (
            <div className="flex gap-2 mb-2 overflow-x-auto pb-1">
              {QUICK_PROMPTS.map(p => (
                <button key={p} onClick={() => send(p)} disabled={streaming}
                  className="shrink-0 px-2.5 py-1 bg-[#F1F5F9] rounded-lg text-[11px] text-[#64748B] hover:bg-amber-50 hover:text-amber-700 whitespace-nowrap disabled:opacity-40">
                  {p.slice(0, 32)}...
                </button>
              ))}
            </div>
          )}
          <div className="flex gap-2 items-end">
            <textarea ref={inputRef} value={input} onChange={e => setInput(e.target.value)} onKeyDown={handleKey}
              placeholder="Question à MIAA+ … (Entrée pour envoyer)"
              rows={1} style={{ resize: 'none' }}
              className="flex-1 px-3 py-2.5 text-[13px] border border-[#E2E8F0] rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-300 min-h-[42px] max-h-[120px] overflow-y-auto" />
            <button onClick={() => send()} disabled={!input.trim() || streaming}
              className="p-2.5 bg-amber-500 text-white rounded-xl hover:bg-amber-600 disabled:opacity-40 shrink-0">
              {streaming ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
            </button>
            {messages.length > 0 && (
              <button onClick={() => { setMessages([]); setBriefing(''); setKpis(null) }}
                className="p-2.5 border border-[#E2E8F0] rounded-xl text-[#94A3B8] hover:bg-[#F8FAFC] shrink-0">
                <RefreshCw size={14} />
              </button>
            )}
          </div>
          <p className="text-[10px] text-[#CBD5E1] mt-1 text-center">MIAA lit vos KPIs en temps réel · Shift+Entrée pour nouvelle ligne</p>
        </div>
      </div>
    </div>
  )
}

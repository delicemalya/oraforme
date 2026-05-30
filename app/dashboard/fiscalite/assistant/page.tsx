'use client'

import { useState, useRef, useEffect } from 'react'
import { Bot, Send, Loader2, RefreshCw, Sparkles } from 'lucide-react'
import { PAYS_LIST } from '@/lib/fiscalite/pays'
import { MIAA_AGENTS } from '@/lib/miaa-agents'
import { useTenantContext } from '@/lib/contexts/TenantContext'
import type { PaysFiscal } from '@/lib/fiscalite/types'

const TEXT  = '#0F172A'
const MUTED = '#64748B'
const BORDER= '#E2E8F0'
const CARD  = '#FFFFFF'
const AMBER = '#F59E0B'

interface Message {
  role: 'user' | 'assistant'
  content: string
  actions?: string[]
}

const agent = MIAA_AGENTS['fiscalite']

const SUGGESTIONS_INITIALES = [
  { pays: 'CG', question: 'Quel est le montant de CNSS pour un salaire brut de 500 000 FCFA au Congo ?' },
  { pays: 'CM', question: 'Comment calculer la TVA au Cameroun avec le CAC ?' },
  { pays: 'CG', question: 'Quelles sont mes obligations fiscales avant la fin du mois ?' },
  { pays: 'CD', question: 'Quel est le taux d\'IPR pour un salaire de 2 000 000 CDF en RDC ?' },
  { pays: 'FR', question: 'Quelle est la différence entre TVA 20% et 10% en France ?' },
  { pays: 'GA', question: 'Comment calculer la patente au Gabon ?' },
]

export default function AssistantFiscalPage() {
  const { tenant } = useTenantContext()
  const [pays, setPays] = useState<PaysFiscal>('CG')
  const [messages, setMessages] = useState<Message[]>([{
    role: 'assistant',
    content: `Bonjour ! Je suis **${agent.nom}**, ${agent.specialite}.\n\nJe connais les règles fiscales de 15 pays OHADA et européens. Posez-moi vos questions sur TVA, CNSS, IRPP, patente, échéances ou tout autre sujet fiscal.\n\n*Sélectionnez votre pays en haut pour des réponses contextualisées.*`,
    actions: [...agent.actions_rapides],
  }])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendMessage = async (text?: string) => {
    const msg = text ?? input
    if (!msg.trim() || loading) return
    setInput('')
    setMessages(prev => [...prev, { role: 'user', content: msg }])
    setLoading(true)
    try {
      const paysInfo = PAYS_LIST.find(p => p.code === pays)
      const contextMsg = `[Contexte: pays=${pays} (${paysInfo?.nom}), devise=${paysInfo?.devise}]\n${msg}`
      const res = await fetch('/api/miaa/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          module: 'fiscalite',
          message: contextMsg,
          history: messages.map(m => ({ role: m.role, content: m.content })),
          tenantData: { tenant_id: tenant?.tenantId },
        }),
      })
      const data = await res.json()
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: data.response ?? 'Désolé, une erreur est survenue.',
        actions: data.suggested_actions,
      }])
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Erreur de connexion. Réessayez.' }])
    } finally {
      setLoading(false)
    }
  }

  const resetConversation = () => {
    setMessages([{
      role: 'assistant',
      content: `Bonjour ! Je suis **${agent.nom}**. Nouvelle conversation démarrée. Comment puis-je vous aider ?`,
      actions: [...agent.actions_rapides],
    }])
  }

  const fmtContent = (text: string) => {
    return text
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/`(.*?)`/g, '<code style="background:#F1F5F9;padding:1px 5px;border-radius:4px;font-family:monospace;font-size:12px">$1</code>')
      .replace(/\n/g, '<br/>')
  }

  const suggestions = SUGGESTIONS_INITIALES.filter(s => s.pays === pays || s.pays === 'CG').slice(0, 3)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 120px)', minHeight: 500 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: '#FFFBEB', border: `1px solid ${AMBER}40`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>
            {agent.avatar}
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: TEXT, display: 'flex', alignItems: 'center', gap: 8 }}>
              {agent.nom}
              <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600, color: '#16A34A', background: '#F0FDF4', padding: '2px 8px', borderRadius: 20 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#16A34A', display: 'inline-block' }} />
                En ligne
              </span>
            </h1>
            <p style={{ margin: 0, fontSize: 12, color: MUTED }}>{agent.specialite}</p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <select
            value={pays}
            onChange={e => setPays(e.target.value as PaysFiscal)}
            style={{ border: `1px solid ${BORDER}`, borderRadius: 9, padding: '7px 11px', background: CARD, fontSize: 13 }}
          >
            {PAYS_LIST.map(p => <option key={p.code} value={p.code}>{p.drapeau} {p.nom}</option>)}
          </select>
          <button
            onClick={resetConversation}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 13px', borderRadius: 9, border: `1px solid ${BORDER}`, background: CARD, cursor: 'pointer', fontSize: 12, color: MUTED }}
          >
            <RefreshCw size={13} /> Nouvelle conv.
          </button>
        </div>
      </div>

      {/* Chat area */}
      <div style={{
        flex: 1, overflowY: 'auto', background: '#F8FAFC', borderRadius: 14,
        border: `1px solid ${BORDER}`, padding: 20, display: 'flex', flexDirection: 'column', gap: 16,
      }}>
        {messages.map((msg, i) => (
          <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start', gap: 8 }}>
            {msg.role === 'assistant' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                <div style={{ width: 24, height: 24, borderRadius: 6, background: '#FFFBEB', border: `1px solid ${AMBER}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13 }}>
                  {agent.avatar}
                </div>
                <span style={{ fontSize: 11, fontWeight: 600, color: AMBER }}>{agent.nom}</span>
              </div>
            )}
            <div style={{
              maxWidth: '85%', padding: '12px 16px', borderRadius: msg.role === 'user' ? '16px 16px 4px 16px' : '4px 16px 16px 16px',
              background: msg.role === 'user' ? AMBER : CARD,
              color: msg.role === 'user' ? '#fff' : TEXT,
              fontSize: 13, lineHeight: 1.6,
              boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
              border: msg.role === 'assistant' ? `1px solid ${BORDER}` : 'none',
            }}>
              {msg.role === 'assistant'
                ? <div dangerouslySetInnerHTML={{ __html: fmtContent(msg.content) }} />
                : msg.content
              }
            </div>
            {msg.actions && msg.actions.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, maxWidth: '85%' }}>
                {msg.actions.map((action, j) => (
                  <button
                    key={j}
                    onClick={() => sendMessage(action)}
                    style={{
                      padding: '5px 12px', borderRadius: 20,
                      border: `1px solid ${AMBER}50`, background: '#FFFBEB',
                      color: '#92400E', cursor: 'pointer', fontSize: 11, fontWeight: 600,
                      display: 'flex', alignItems: 'center', gap: 4,
                    }}
                  >
                    <Sparkles size={10} /> {action}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}

        {loading && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 24, height: 24, borderRadius: 6, background: '#FFFBEB', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13 }}>{agent.avatar}</div>
            <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: '4px 16px 16px 16px', padding: '12px 16px', display: 'flex', gap: 4, alignItems: 'center' }}>
              {[0, 1, 2].map(d => (
                <div key={d} style={{
                  width: 6, height: 6, borderRadius: '50%', background: AMBER,
                  animation: `bounce 1.4s ease-in-out ${d * 0.2}s infinite`,
                }} />
              ))}
            </div>
          </div>
        )}

        {/* Suggestions contextuelles (si peu de messages) */}
        {messages.length === 1 && !loading && (
          <div style={{ marginTop: 8 }}>
            <div style={{ fontSize: 11, color: MUTED, fontWeight: 600, marginBottom: 8, textTransform: 'uppercase' }}>
              Questions fréquentes — {PAYS_LIST.find(p => p.code === pays)?.nom}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {suggestions.map((s, i) => (
                <button key={i} onClick={() => sendMessage(s.question)}
                  style={{
                    width: '100%', textAlign: 'left', padding: '10px 14px', borderRadius: 10,
                    border: `1px solid ${BORDER}`, background: CARD, cursor: 'pointer',
                    fontSize: 12, color: TEXT, display: 'flex', alignItems: 'center', gap: 8,
                  }}>
                  <Bot size={13} color={AMBER} style={{ flexShrink: 0 }} />
                  {s.question}
                </button>
              ))}
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
          placeholder={`Posez votre question fiscale — ${PAYS_LIST.find(p => p.code === pays)?.nom} (${PAYS_LIST.find(p => p.code === pays)?.devise})`}
          disabled={loading}
          style={{
            flex: 1, padding: '12px 16px', border: `1px solid ${BORDER}`,
            borderRadius: 12, fontSize: 13, color: TEXT, outline: 'none',
            background: loading ? '#F8FAFC' : CARD,
          }}
        />
        <button
          onClick={() => sendMessage()}
          disabled={!input.trim() || loading}
          style={{
            width: 46, height: 46, borderRadius: 12, border: 'none',
            background: input.trim() && !loading ? AMBER : '#E2E8F0',
            color: input.trim() && !loading ? '#fff' : MUTED,
            cursor: input.trim() && !loading ? 'pointer' : 'not-allowed',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}
        >
          {loading ? <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} /> : <Send size={18} />}
        </button>
      </div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }
        @keyframes bounce { 0%, 80%, 100% { transform: scale(0.8); opacity: 0.5 } 40% { transform: scale(1.2); opacity: 1 } }
      `}</style>
    </div>
  )
}

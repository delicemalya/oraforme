'use client'

import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { MIAA_AGENTS, type MIAAModule } from '@/lib/miaa-agents'

interface Message {
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  actions?: string[]
}

interface MIAAAssistantProps {
  module: MIAAModule
  tenantData?: { tenant_id?: string }
}

export function MIAAAssistant({ module, tenantData }: MIAAAssistantProps) {
  const agent = MIAA_AGENTS[module]
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: `Bonjour ! Je suis ${agent.nom}. ${agent.specialite}.\n\nComment puis-je vous aider aujourd'hui ?`,
      timestamp: new Date(),
      actions: [...agent.actions_rapides],
    },
  ])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function sendMessage(text?: string) {
    const messageText = text ?? input
    if (!messageText.trim() || isLoading) return

    const userMessage: Message = { role: 'user', content: messageText, timestamp: new Date() }
    setMessages(prev => [...prev, userMessage])
    setInput('')
    setIsLoading(true)

    try {
      const response = await fetch('/api/miaa/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          module,
          message: messageText,
          history: messages.map(m => ({ role: m.role, content: m.content })),
          tenantData,
        }),
      })

      const data = await response.json()
      setMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          content: data.response ?? 'Désolé, une erreur est survenue.',
          timestamp: new Date(),
          actions: data.suggested_actions,
        },
      ])
    } catch {
      setMessages(prev => [
        ...prev,
        { role: 'assistant', content: 'Désolé, une erreur est survenue. Réessayez.', timestamp: new Date() },
      ])
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <>
      {/* Bouton flottant */}
      <motion.button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-full shadow-lg text-white font-bold"
        style={{ backgroundColor: agent.couleur }}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
      >
        <span className="text-xl">{agent.avatar}</span>
        <span className="text-sm">{agent.nom}</span>
        {!isOpen && (
          <motion.span
            className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-green-400"
            animate={{ scale: [1, 1.3, 1] }}
            transition={{ repeat: Infinity, duration: 2 }}
          />
        )}
      </motion.button>

      {/* Panel de chat */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="fixed bottom-24 right-6 z-50 w-96 h-[600px] bg-[#161B22] border border-gray-700 rounded-2xl shadow-2xl flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div
              className="p-4 flex items-center gap-3 flex-shrink-0"
              style={{ backgroundColor: agent.couleur + '20', borderBottom: `1px solid ${agent.couleur}30` }}
            >
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center text-xl"
                style={{ backgroundColor: agent.couleur + '30' }}
              >
                {agent.avatar}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-bold text-white text-sm">{agent.nom}</div>
                <div className="text-xs flex items-center gap-1 truncate" style={{ color: agent.couleur }}>
                  <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse flex-shrink-0" />
                  {agent.specialite}
                </div>
              </div>
              <button onClick={() => setIsOpen(false)} className="text-gray-400 hover:text-white text-xl flex-shrink-0">
                ×
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.map((msg, i) => (
                <div key={i} className={`flex flex-col gap-2 ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                  <div
                    className={`max-w-[85%] p-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
                      msg.role === 'user'
                        ? 'text-white rounded-tr-sm'
                        : 'bg-[#1C2128] text-gray-200 rounded-tl-sm border border-gray-700'
                    }`}
                    style={msg.role === 'user' ? { backgroundColor: agent.couleur } : {}}
                  >
                    {msg.content}
                  </div>

                  {msg.actions && msg.actions.length > 0 && (
                    <div className="flex flex-wrap gap-2 max-w-[90%]">
                      {msg.actions.map((action, ai) => (
                        <button
                          key={ai}
                          onClick={() => sendMessage(action)}
                          className="text-xs px-3 py-1.5 rounded-full border transition-all hover:scale-105"
                          style={{
                            borderColor: agent.couleur + '50',
                            color: agent.couleur,
                            backgroundColor: agent.couleur + '10',
                          }}
                        >
                          {action}
                        </button>
                      ))}
                    </div>
                  )}

                  <span className="text-xs text-gray-600">
                    {msg.timestamp.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              ))}

              {/* Indicateur de frappe */}
              {isLoading && (
                <div className="flex items-start">
                  <div className="bg-[#1C2128] border border-gray-700 p-3 rounded-2xl rounded-tl-sm">
                    <div className="flex gap-1">
                      {[0, 1, 2].map(i => (
                        <motion.div
                          key={i}
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: agent.couleur }}
                          animate={{ y: [0, -6, 0] }}
                          transition={{ repeat: Infinity, duration: 0.8, delay: i * 0.15 }}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="p-3 border-t border-gray-700 flex gap-2 flex-shrink-0">
              <input
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
                placeholder={`Demandez à ${agent.nom}…`}
                className="flex-1 bg-[#1C2128] border border-gray-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-500 outline-none focus:border-gray-500 transition-colors"
              />
              <button
                onClick={() => sendMessage()}
                disabled={!input.trim() || isLoading}
                className="w-10 h-10 rounded-xl flex items-center justify-center text-white disabled:opacity-40 transition-all text-lg"
                style={{ backgroundColor: agent.couleur }}
              >
                ➤
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}

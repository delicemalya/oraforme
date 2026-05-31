'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Paperclip, Download, FileText, X, Send, Loader2 } from 'lucide-react'
import { MIAA_AGENTS, type MIAAModule } from '@/lib/miaa-agents'

interface Message {
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  actions?: string[]
  peut_telecharger?: boolean
  contenu_telechargeable?: string
  fichier_analyse?: string
}

interface MIAAAssistantProps {
  module: MIAAModule
  tenantData?: { tenant_id?: string }
}

const FICHIERS_ACCEPTES: Record<string, string> = {
  comptabilite: '.pdf,.xlsx,.xls,.csv,.doc,.docx',
  rh:           '.pdf,.doc,.docx,.xlsx,.xls',
  facturation:  '.pdf,.doc,.docx,.xlsx',
  stock:        '.xlsx,.xls,.csv,.pdf',
  restaurant:   '.xlsx,.xls,.csv,.pdf',
  ecole:        '.pdf,.doc,.docx,.xlsx,.jpg,.png',
  default:      '.pdf,.doc,.docx,.xlsx,.xls,.csv',
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

function downloadTxt(content: string, filename: string) {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function downloadHtml(content: string, filename: string) {
  const paragraphs = content
    .split('\n')
    .map(l => l.trim())
    .filter(Boolean)
    .map(l => `<p style="margin:0 0 8px">${l.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</p>`)
    .join('\n')
  const html = `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><title>Rapport MIAA+</title><style>body{font-family:Arial,sans-serif;max-width:800px;margin:40px auto;padding:0 20px;color:#1a1a1a;line-height:1.6}h1{color:#374151;border-bottom:2px solid #e5e7eb;padding-bottom:12px}</style></head><body><h1>Rapport MIAA+</h1><div>${paragraphs}</div></body></html>`
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function MIAAAssistant({ module, tenantData }: MIAAAssistantProps) {
  const agent = MIAA_AGENTS[module]
  const [isOpen, setIsOpen]           = useState(false)
  const [messages, setMessages]       = useState<Message[]>([
    {
      role: 'assistant',
      content: `Bonjour ! Je suis ${agent.nom}. ${agent.specialite}.\n\nComment puis-je vous aider aujourd'hui ?`,
      timestamp: new Date(),
      actions: [...agent.actions_rapides],
    },
  ])
  const [input, setInput]             = useState('')
  const [isLoading, setIsLoading]     = useState(false)
  const [fichierJoint, setFichierJoint] = useState<File | null>(null)
  const [uploadLoading, setUploadLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const fileInputRef   = useRef<HTMLInputElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendMessage = useCallback(async (text?: string) => {
    const messageText = text ?? input
    if (!messageText.trim() || isLoading) return

    const userMessage: Message = { role: 'user', content: messageText, timestamp: new Date() }
    setMessages(prev => [...prev, userMessage])
    setInput('')
    setIsLoading(true)

    try {
      const response = await fetch('/api/miaa/chat', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          module,
          message: messageText,
          history: messages.map(m => ({ role: m.role, content: m.content })),
          tenantData,
        }),
      })

      const data = await response.json()
      setMessages(prev => [...prev, {
        role: 'assistant',
        content:              data.response ?? 'Désolé, une erreur est survenue.',
        timestamp:            new Date(),
        actions:              data.suggested_actions,
        peut_telecharger:     (data.response?.length ?? 0) > 150,
        contenu_telechargeable: data.response,
      }])
    } catch {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Désolé, une erreur est survenue. Réessayez.',
        timestamp: new Date(),
      }])
    } finally {
      setIsLoading(false)
    }
  }, [input, isLoading, messages, module, tenantData])

  async function handleFichier(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    // Reset input so same file can be re-uploaded
    e.target.value = ''

    const MAX_MB = 10
    if (file.size > MAX_MB * 1024 * 1024) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `Fichier trop volumineux. Limite : ${MAX_MB} Mo.`,
        timestamp: new Date(),
      }])
      return
    }

    setFichierJoint(file)
    setUploadLoading(true)

    const userMsg: Message = {
      role: 'user',
      content: `[Fichier joint : ${file.name}] Analyse ce document et donne-moi un résumé structuré.`,
      timestamp: new Date(),
    }
    setMessages(prev => [...prev, userMsg])

    try {
      const base64 = await fileToBase64(file)
      const response = await fetch('/api/miaa/analyze-file', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          module,
          filename:   file.name,
          filetype:   file.type,
          filesize:   file.size,
          base64,
          tenantData,
        }),
      })

      const data = await response.json()
      setMessages(prev => [...prev, {
        role:     'assistant',
        content:  data.analyse ?? 'Analyse terminée.',
        timestamp: new Date(),
        peut_telecharger:      true,
        contenu_telechargeable: data.analyse,
        fichier_analyse:        file.name,
      }])
    } catch {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Impossible d\'analyser ce fichier. Vérifiez le format et réessayez.',
        timestamp: new Date(),
      }])
    } finally {
      setFichierJoint(null)
      setUploadLoading(false)
    }
  }

  async function demanderRapport(contexte: string) {
    const prompt = `Sur la base de ces informations, génère un rapport professionnel complet et structuré. Le rapport doit avoir un titre, une introduction, des sections numérotées avec des données précises, et une conclusion avec des recommandations actionnables.`
    setIsLoading(true)
    try {
      const response = await fetch('/api/miaa/chat', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          module,
          message: prompt,
          history: [{ role: 'assistant' as const, content: contexte }],
          tenantData,
        }),
      })
      const data = await response.json()
      setMessages(prev => [...prev, {
        role:     'assistant',
        content:  data.response ?? 'Rapport généré.',
        timestamp: new Date(),
        peut_telecharger:      true,
        contenu_telechargeable: data.response,
      }])
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <>
      {/* Floating button */}
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

      {/* Chat panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="fixed bottom-24 right-6 z-50 w-96 h-[600px] bg-white border border-gray-200 rounded-2xl shadow-2xl flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div
              className="p-4 flex items-center gap-3 flex-shrink-0 border-b border-gray-100"
              style={{ background: agent.couleur + '10' }}
            >
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center text-xl"
                style={{ backgroundColor: agent.couleur + '25' }}
              >
                {agent.avatar}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-bold text-gray-900 text-sm">{agent.nom}</div>
                <div className="text-xs flex items-center gap-1 truncate text-gray-500">
                  <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse flex-shrink-0" />
                  {agent.specialite}
                </div>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="text-gray-400 hover:text-gray-600 flex-shrink-0 p-1 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50/40">
              {messages.map((msg, i) => (
                <div key={i} className={`flex flex-col gap-1.5 ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                  {/* File analysis badge */}
                  {msg.fichier_analyse && (
                    <div className="flex items-center gap-1 text-[10px] text-gray-400">
                      <FileText size={10} />
                      <span>{msg.fichier_analyse}</span>
                    </div>
                  )}

                  <div
                    className={`max-w-[85%] p-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap shadow-sm ${
                      msg.role === 'user'
                        ? 'text-white rounded-tr-sm'
                        : 'bg-white text-gray-800 rounded-tl-sm border border-gray-100'
                    }`}
                    style={msg.role === 'user' ? { backgroundColor: agent.couleur } : {}}
                  >
                    {msg.content}
                  </div>

                  {/* Quick action chips */}
                  {msg.actions && msg.actions.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 max-w-[90%]">
                      {msg.actions.map((action, ai) => (
                        <button
                          key={ai}
                          onClick={() => sendMessage(action)}
                          className="text-xs px-2.5 py-1 rounded-full border transition-all hover:scale-105"
                          style={{
                            borderColor: agent.couleur + '60',
                            color:       agent.couleur,
                            background:  agent.couleur + '0D',
                          }}
                        >
                          {action}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Download buttons on long assistant messages */}
                  {msg.role === 'assistant' && msg.peut_telecharger && msg.contenu_telechargeable && (
                    <div className="flex gap-1.5 flex-wrap">
                      <button
                        onClick={() => downloadTxt(msg.contenu_telechargeable!, `miaa-rapport-${Date.now()}.txt`)}
                        className="flex items-center gap-1 px-2 py-1 text-[10px] bg-gray-50 text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-100 transition-all"
                      >
                        <Download size={10} /> TXT
                      </button>
                      <button
                        onClick={() => downloadHtml(msg.contenu_telechargeable!, `miaa-rapport-${Date.now()}.html`)}
                        className="flex items-center gap-1 px-2 py-1 text-[10px] bg-gray-50 text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-100 transition-all"
                      >
                        <Download size={10} /> HTML
                      </button>
                      <button
                        onClick={() => demanderRapport(msg.contenu_telechargeable!)}
                        className="flex items-center gap-1 px-2 py-1 text-[10px] border rounded-lg hover:opacity-80 transition-all"
                        style={{ background: agent.couleur + '12', color: agent.couleur, borderColor: agent.couleur + '40' }}
                      >
                        <FileText size={10} /> Rapport complet
                      </button>
                    </div>
                  )}

                  <span className="text-[10px] text-gray-400">
                    {msg.timestamp.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              ))}

              {/* Typing indicator */}
              {(isLoading || uploadLoading) && (
                <div className="flex items-start gap-2">
                  <div className="bg-white border border-gray-100 p-3 rounded-2xl rounded-tl-sm shadow-sm">
                    <div className="flex gap-1 items-center">
                      {[0, 1, 2].map(i => (
                        <motion.div
                          key={i}
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: agent.couleur }}
                          animate={{ y: [0, -5, 0] }}
                          transition={{ repeat: Infinity, duration: 0.8, delay: i * 0.15 }}
                        />
                      ))}
                      {uploadLoading && (
                        <span className="text-[10px] text-gray-400 ml-1">Analyse du fichier…</span>
                      )}
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* File attachment indicator */}
            {fichierJoint && (
              <div className="px-3 py-1.5 bg-blue-50 border-t border-blue-100 flex items-center gap-2">
                <FileText size={12} className="text-blue-500 flex-shrink-0" />
                <span className="text-xs text-blue-600 flex-1 truncate">{fichierJoint.name}</span>
                <button onClick={() => setFichierJoint(null)} className="text-blue-400 hover:text-blue-600">
                  <X size={12} />
                </button>
              </div>
            )}

            {/* Input bar */}
            <div className="p-3 border-t border-gray-100 flex gap-2 flex-shrink-0 bg-white">
              {/* File upload */}
              <input
                ref={fileInputRef}
                type="file"
                accept={FICHIERS_ACCEPTES[module] ?? FICHIERS_ACCEPTES.default}
                onChange={handleFichier}
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadLoading || isLoading}
                title="Joindre un fichier (PDF, Excel, Word)"
                className="w-9 h-9 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition-all disabled:opacity-40 flex-shrink-0"
              >
                <Paperclip size={16} />
              </button>

              <input
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
                placeholder={`Demandez à ${agent.nom}…`}
                disabled={isLoading || uploadLoading}
                className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-800 placeholder-gray-400 outline-none focus:border-gray-300 transition-colors disabled:opacity-50"
              />
              <button
                onClick={() => sendMessage()}
                disabled={!input.trim() || isLoading || uploadLoading}
                className="w-9 h-9 rounded-xl flex items-center justify-center text-white disabled:opacity-30 transition-all flex-shrink-0"
                style={{ backgroundColor: agent.couleur }}
              >
                {isLoading
                  ? <Loader2 size={14} className="animate-spin" />
                  : <Send size={14} />
                }
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}

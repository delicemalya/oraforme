'use client'

import { useState } from 'react'
import { LifeBuoy, Clock, CheckCircle2, AlertTriangle, MessageSquare, Plus, X, Send } from 'lucide-react'

// ── Simulated tickets (in production: table owner_support_tickets) ─────────────

const INITIAL_TICKETS = [
  { id: 'TKT-001', tenant: 'Ets. Kouassi & Frères', user: 'kouassi@etskf.com', subject: 'Impossible de créer une facture', priority: 'high', status: 'open',   created: '2026-05-24T08:30:00', lastUpdate: '2026-05-24T09:15:00', messages: 2 },
  { id: 'TKT-002', tenant: 'Groupe Kinshasa Tech',  user: 'admin@gktech.cd',    subject: 'Module stock ne charge pas',   priority: 'medium', status: 'open',  created: '2026-05-23T14:20:00', lastUpdate: '2026-05-24T07:00:00', messages: 1 },
  { id: 'TKT-003', tenant: 'Clinique Lumière',       user: 'daf@cllumiere.cg',  subject: 'Export CSV vide',              priority: 'low',    status: 'resolved', created: '2026-05-22T10:00:00', lastUpdate: '2026-05-22T16:30:00', messages: 5 },
  { id: 'TKT-004', tenant: 'Transport Brazza VTC',   user: 'geo@bravtc.cg',     subject: 'MIAA+ répond en anglais',      priority: 'low',    status: 'open',   created: '2026-05-24T11:00:00', lastUpdate: '2026-05-24T11:00:00', messages: 0 },
  { id: 'TKT-005', tenant: 'École Excellence 360',   user: 'dir@ex360.cg',      subject: 'Bulletins PDF malformés',      priority: 'high',   status: 'pending', created: '2026-05-23T09:30:00', lastUpdate: '2026-05-24T08:00:00', messages: 3 },
]

const PRIORITY = {
  high:   { label: 'Urgent',  cls: 'bg-red-50 text-red-700 border-red-200' },
  medium: { label: 'Moyen',   cls: 'bg-yellow-50 text-yellow-700 border-yellow-200' },
  low:    { label: 'Faible',  cls: 'bg-gray-50 text-gray-600 border-gray-200' },
}

const STATUS = {
  open:     { label: 'Ouvert',   cls: 'bg-blue-50 text-blue-700 border-blue-200' },
  pending:  { label: 'En cours', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  resolved: { label: 'Résolu',   cls: 'bg-green-50 text-green-700 border-green-200' },
}

function timeAgo(d: string) {
  const diff = Date.now() - new Date(d).getTime()
  const h = Math.floor(diff / 3600000)
  const m = Math.floor(diff / 60000)
  if (m < 60) return `il y a ${m} min`
  if (h < 24) return `il y a ${h}h`
  return `il y a ${Math.floor(h / 24)}j`
}

export default function SupportPage() {
  const [tickets, setTickets]         = useState(INITIAL_TICKETS)
  const [filterStatus, setFilter]     = useState<string>('all')
  const [selected, setSelected]       = useState<typeof INITIAL_TICKETS[0] | null>(null)
  const [replyText, setReplyText]     = useState('')
  const [showNew, setShowNew]         = useState(false)

  const filtered = tickets.filter(t => filterStatus === 'all' || t.status === filterStatus)

  const stats = {
    open:     tickets.filter(t => t.status === 'open').length,
    pending:  tickets.filter(t => t.status === 'pending').length,
    resolved: tickets.filter(t => t.status === 'resolved').length,
    urgent:   tickets.filter(t => t.priority === 'high' && t.status !== 'resolved').length,
  }

  const handleResolve = (id: string) => {
    setTickets(prev => prev.map(t => t.id === id ? { ...t, status: 'resolved' as const } : t))
    if (selected?.id === id) setSelected(prev => prev ? { ...prev, status: 'resolved' } : null)
  }

  const handleReply = () => {
    if (!replyText.trim() || !selected) return
    setTickets(prev => prev.map(t => t.id === selected.id ? { ...t, messages: t.messages + 1, status: 'pending', lastUpdate: new Date().toISOString() } : t))
    setReplyText('')
  }

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-[22px] font-bold text-gray-900">Support Clients</h1>
          <p className="text-sm text-gray-500 mt-0.5">Tickets et demandes d&apos;assistance</p>
        </div>
        <button
          onClick={() => setShowNew(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white shadow-sm hover:opacity-90 transition-opacity"
          style={{ background: '#F59E0B' }}>
          <Plus size={15} /> Créer ticket
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Ouverts',   value: stats.open,     color: '#3B82F6', icon: MessageSquare },
          { label: 'En cours',  value: stats.pending,  color: '#F59E0B', icon: Clock },
          { label: 'Résolus',   value: stats.resolved, color: '#10B981', icon: CheckCircle2 },
          { label: 'Urgents',   value: stats.urgent,   color: '#EF4444', icon: AlertTriangle },
        ].map((s, i) => {
          const Icon = s.icon
          return (
            <div key={i} className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <Icon size={15} style={{ color: s.color }} />
              </div>
              <p className="text-2xl font-bold text-gray-900">{s.value}</p>
              <p className="text-xs text-gray-500">{s.label}</p>
            </div>
          )
        })}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2">
        {[
          { key: 'all',      label: 'Tous' },
          { key: 'open',     label: 'Ouverts' },
          { key: 'pending',  label: 'En cours' },
          { key: 'resolved', label: 'Résolus' },
        ].map(f => (
          <button key={f.key} onClick={() => setFilter(f.key)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
              filterStatus === f.key
                ? 'bg-amber-50 text-amber-700 border border-amber-200'
                : 'bg-white text-gray-500 border border-gray-100 hover:bg-gray-50'
            }`}>
            {f.label}
          </button>
        ))}
      </div>

      {/* Tickets list + detail */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* List */}
        <div className="space-y-3">
          {filtered.length === 0 && (
            <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center">
              <LifeBuoy size={28} className="mx-auto mb-3 text-gray-200" />
              <p className="text-sm text-gray-400">Aucun ticket</p>
            </div>
          )}
          {filtered.map(t => {
            const pri = PRIORITY[t.priority as keyof typeof PRIORITY]
            const sta = STATUS[t.status as keyof typeof STATUS]
            const isSelected = selected?.id === t.id
            return (
              <div key={t.id}
                onClick={() => setSelected(t)}
                className={`bg-white rounded-2xl border p-4 cursor-pointer transition-all hover:shadow-sm ${isSelected ? 'border-amber-300 shadow-sm' : 'border-gray-100'}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="text-[11px] font-mono text-gray-400">{t.id}</span>
                      <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${pri.cls}`}>{pri.label}</span>
                      <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${sta.cls}`}>{sta.label}</span>
                    </div>
                    <p className="text-[13px] font-semibold text-gray-900 truncate">{t.subject}</p>
                    <p className="text-[12px] text-gray-500 mt-0.5">{t.tenant} · {t.user}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-[11px] text-gray-400">{timeAgo(t.lastUpdate)}</p>
                    {t.messages > 0 && (
                      <span className="text-[10px] text-gray-400 flex items-center gap-1 justify-end mt-1">
                        <MessageSquare size={9} /> {t.messages}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* Detail panel */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm sticky top-6">
          {!selected ? (
            <div className="p-10 text-center">
              <MessageSquare size={32} className="mx-auto mb-3 text-gray-200" />
              <p className="text-sm font-medium text-gray-400">Sélectionner un ticket</p>
              <p className="text-xs text-gray-300 mt-1">pour voir les détails et répondre</p>
            </div>
          ) : (
            <div className="flex flex-col h-full">
              <div className="p-5 border-b border-gray-100">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-[11px] font-mono text-gray-400">{selected.id}</p>
                    <h3 className="text-[15px] font-bold text-gray-900 mt-1">{selected.subject}</h3>
                    <p className="text-xs text-gray-500 mt-1">{selected.tenant}</p>
                    <p className="text-xs text-gray-400">{selected.user}</p>
                  </div>
                  <button onClick={() => setSelected(null)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400">
                    <X size={14} />
                  </button>
                </div>
                <div className="flex gap-2 mt-3">
                  <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full border ${PRIORITY[selected.priority as keyof typeof PRIORITY].cls}`}>
                    {PRIORITY[selected.priority as keyof typeof PRIORITY].label}
                  </span>
                  <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full border ${STATUS[selected.status as keyof typeof STATUS].cls}`}>
                    {STATUS[selected.status as keyof typeof STATUS].label}
                  </span>
                  <span className="text-[11px] text-gray-400 flex items-center gap-1 ml-auto">
                    <Clock size={10} /> {timeAgo(selected.created)}
                  </span>
                </div>
              </div>

              <div className="flex-1 p-5">
                <div className="bg-gray-50 rounded-xl p-4 text-sm text-gray-600 mb-4">
                  <p className="font-medium text-gray-800 mb-2">Message initial :</p>
                  <p>L&apos;utilisateur signale : &ldquo;{selected.subject}&rdquo;</p>
                  <p className="text-xs text-gray-400 mt-2">Reçu {timeAgo(selected.created)}</p>
                </div>

                {selected.status !== 'resolved' && (
                  <div>
                    <label className="text-xs font-semibold text-gray-500 block mb-2">Votre réponse</label>
                    <textarea
                      value={replyText}
                      onChange={e => setReplyText(e.target.value)}
                      rows={3}
                      placeholder="Tapez votre réponse…"
                      className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm resize-none outline-none focus:border-amber-300 transition-colors"
                    />
                    <div className="flex gap-2 mt-3">
                      <button
                        onClick={handleReply}
                        disabled={!replyText.trim()}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white disabled:opacity-40 hover:opacity-90 transition-opacity"
                        style={{ background: '#F59E0B' }}>
                        <Send size={13} /> Envoyer
                      </button>
                      <button
                        onClick={() => handleResolve(selected.id)}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border border-green-200 text-green-700 bg-green-50 hover:bg-green-100 transition-colors">
                        <CheckCircle2 size={13} /> Résoudre
                      </button>
                    </div>
                  </div>
                )}

                {selected.status === 'resolved' && (
                  <div className="flex items-center gap-2 p-3 rounded-xl bg-green-50 border border-green-200 text-green-700 text-sm">
                    <CheckCircle2 size={15} /> Ticket résolu
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* New ticket modal */}
      {showNew && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.4)' }}>
          <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-[16px] font-bold text-gray-900">Nouveau ticket</h2>
              <button onClick={() => setShowNew(false)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400"><X size={15} /></button>
            </div>
            <p className="text-sm text-gray-500 mb-4">En production, cette section se connectera à la table <code className="bg-gray-100 px-1 rounded">owner_support_tickets</code>.</p>
            <button onClick={() => setShowNew(false)}
              className="w-full py-2.5 rounded-xl text-sm font-medium bg-amber-500 text-white hover:bg-amber-600 transition-colors">
              Fermer
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

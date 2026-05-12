'use client'

import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Bell, X, CheckCheck, Info, AlertTriangle, CheckCircle, XCircle, ExternalLink } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

interface Notification {
  id: string
  title: string
  message?: string
  type: 'info' | 'warning' | 'success' | 'error'
  read: boolean
  link?: string
  created_at: string
}

const TYPE_CONFIG = {
  info:    { icon: Info,          color: '#388BFD', bg: '#388BFD15' },
  warning: { icon: AlertTriangle, color: '#F0A30A', bg: '#F0A30A15' },
  success: { icon: CheckCircle,   color: '#2EA043', bg: '#2EA04315' },
  error:   { icon: XCircle,       color: '#F85149', bg: '#F8514915' },
}

function timeAgo(date: string): string {
  const diff = Date.now() - new Date(date).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'à l\'instant'
  if (mins < 60) return `il y a ${mins}min`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `il y a ${hours}h`
  return `il y a ${Math.floor(hours / 24)}j`
}

export default function NotificationsPanel() {
  const [open, setOpen] = useState(false)
  const [notifs, setNotifs] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  const ref = useRef<HTMLDivElement>(null)
  const unread = notifs.filter(n => !n.read).length

  useEffect(() => {
    async function load() {
      setLoading(true)
      const { data } = await supabase
        .from('notifications')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20)
      setNotifs(data ?? [])
      setLoading(false)
    }
    load()

    // Real-time subscription
    const channel = supabase
      .channel('notifications')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications' }, (payload) => {
        setNotifs(prev => [payload.new as Notification, ...prev])
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const markAllRead = async () => {
    const ids = notifs.filter(n => !n.read).map(n => n.id)
    if (!ids.length) return
    await supabase.from('notifications').update({ read: true }).in('id', ids)
    setNotifs(prev => prev.map(n => ({ ...n, read: true })))
  }

  const markRead = async (id: string) => {
    await supabase.from('notifications').update({ read: true }).eq('id', id)
    setNotifs(prev => prev.map(n => n.id === id ? { ...n, read: true } : n))
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        className="relative w-8 h-8 flex items-center justify-center rounded-lg bg-[#161B22] border border-[#30363D] text-[#8B949E] hover:border-[#F0A30A] hover:text-[#E6EDF3] transition-all"
      >
        <Bell size={15} />
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 w-4 h-4 bg-[#F85149] rounded-full text-[9px] font-bold text-white flex items-center justify-center">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.96 }}
            transition={{ duration: 0.18 }}
            className="absolute right-0 top-full mt-2 z-50 w-[340px] bg-[#161B22] border border-[#30363D] rounded-2xl shadow-2xl overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-[#30363D]">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-[#E6EDF3]">Notifications</h3>
                {unread > 0 && (
                  <span className="px-1.5 py-0.5 text-[9px] font-bold bg-[#F85149] text-white rounded-full">{unread}</span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {unread > 0 && (
                  <button onClick={markAllRead} className="flex items-center gap-1 text-[10px] text-[#8B949E] hover:text-[#F0A30A] transition-colors">
                    <CheckCheck size={12} /> Tout lire
                  </button>
                )}
                <button onClick={() => setOpen(false)} className="text-[#484F58] hover:text-[#8B949E] transition-colors">
                  <X size={14} />
                </button>
              </div>
            </div>

            {/* List */}
            <div className="max-h-[420px] overflow-y-auto">
              {loading ? (
                <div className="px-4 py-8 text-center text-xs text-[#484F58]">Chargement...</div>
              ) : notifs.length === 0 ? (
                <div className="px-4 py-12 text-center">
                  <Bell size={24} className="text-[#30363D] mx-auto mb-3" />
                  <p className="text-sm text-[#484F58]">Aucune notification</p>
                </div>
              ) : (
                notifs.map((n) => {
                  const cfg = TYPE_CONFIG[n.type] ?? TYPE_CONFIG.info
                  const Icon = cfg.icon
                  return (
                    <div
                      key={n.id}
                      onClick={() => { markRead(n.id); if (n.link) setOpen(false) }}
                      className={`flex items-start gap-3 px-4 py-3.5 border-b border-[#21262D] cursor-pointer transition-colors hover:bg-[#21262D] ${
                        !n.read ? 'bg-[#F0A30A04]' : ''
                      }`}
                    >
                      <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5" style={{ background: cfg.bg }}>
                        <Icon size={14} style={{ color: cfg.color }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <p className={`text-xs font-semibold leading-tight ${n.read ? 'text-[#8B949E]' : 'text-[#E6EDF3]'}`}>
                            {n.title}
                          </p>
                          {!n.read && <div className="w-1.5 h-1.5 rounded-full bg-[#F0A30A] shrink-0 mt-1" />}
                        </div>
                        {n.message && <p className="text-[10px] text-[#484F58] mt-0.5 line-clamp-2">{n.message}</p>}
                        <div className="flex items-center justify-between mt-1">
                          <span className="text-[9px] text-[#484F58]">{timeAgo(n.created_at)}</span>
                          {n.link && (
                            <Link href={n.link} className="text-[9px] text-[#F0A30A] flex items-center gap-0.5 hover:underline">
                              Voir <ExternalLink size={8} />
                            </Link>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

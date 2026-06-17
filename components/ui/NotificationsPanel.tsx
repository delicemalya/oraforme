'use client'
import { useLocale } from '@/lib/hooks/useLocale'

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Bell, X, CheckCheck, Info, AlertTriangle, CheckCircle, XCircle, ExternalLink, Wifi, WifiOff, Calendar } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { getEcheances } from '@/lib/fiscal/alertes-fiscales'

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
  info:    { icon: Info,          color: '#DC2626', bg: '#DC262615' },
  warning: { icon: AlertTriangle, color: '#DC2626', bg: '#DC262615' },
  success: { icon: CheckCircle,   color: '#0F172A', bg: '#0F172A15' },
  error:   { icon: XCircle,       color: '#DC2626', bg: '#DC262615' },
}

// Polling interval when WebSocket is unavailable (30 secondes)
const POLL_INTERVAL_MS = 30_000

function timeAgo(date: string): string {
  const diff = Date.now() - new Date(date).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'à l\'instant'
  if (mins < 60) return `il y a ${mins}min`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `il y a ${hours}h`
  return `il y a ${Math.floor(hours / 24)}j`
}

const URGENCE_CONFIG = {
  rouge:  { color: '#DC2626', bg: '#DC262615', label: 'Urgent' },
  orange: { color: '#EA580C', bg: '#EA580C15', label: 'Proche' },
  normal: { color: '#64748B', bg: '#64748B15', label: '' },
}

export default function NotificationsPanel() {
  const { t } = useLocale()
  const [open, setOpen] = useState(false)
  const [notifs, setNotifs] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  const [realtimeOk, setRealtimeOk] = useState<boolean | null>(null) // null = en cours de détection
  const ref = useRef<HTMLDivElement>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)

  const echeances = useMemo(() => getEcheances(30), [])
  const urgentFiscal = echeances.filter(e => e.urgence === 'rouge').length
  const unread = notifs.filter(n => !n.read).length + urgentFiscal

  // ─── Chargement des notifications REST (toujours fiable) ─────────────────
  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20)
      if (!error) setNotifs(data ?? [])
    } catch {
      // REST inaccessible — on garde les données actuelles
    } finally {
      if (!silent) setLoading(false)
    }
  }, [])

  // ─── Démarrer le polling de secours ──────────────────────────────────────
  const startPolling = useCallback(() => {
    if (pollRef.current) return // déjà actif
    pollRef.current = setInterval(() => load(true), POLL_INTERVAL_MS)
  }, [load])

  // ─── Arrêter le polling ───────────────────────────────────────────────────
  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current)
      pollRef.current = null
    }
  }, [])

  useEffect(() => {
    // 1. Chargement initial via REST
    load()

    // 2. Tentative de connexion WebSocket Realtime
    let wsTimeout: ReturnType<typeof setTimeout> | null = null

    const channel = supabase
      .channel('notif-panel-v2')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications' },
        (payload) => {
          // WebSocket actif → annuler le timeout de fallback
          if (wsTimeout) { clearTimeout(wsTimeout); wsTimeout = null }
          setRealtimeOk(true)
          stopPolling()
          setNotifs(prev => [payload.new as Notification, ...prev])
        }
      )
      .subscribe((status, err) => {
        if (status === 'SUBSCRIBED') {
          setRealtimeOk(true)
          stopPolling()
          if (wsTimeout) { clearTimeout(wsTimeout); wsTimeout = null }
        } else if (
          status === 'CHANNEL_ERROR' ||
          status === 'TIMED_OUT' ||
          status === 'CLOSED' ||
          err
        ) {
          // WebSocket échoue → basculer sur le polling
          setRealtimeOk(false)
          startPolling()
        }
      })

    channelRef.current = channel

    // Timeout de sécurité : si après 6s le WS n'est pas SUBSCRIBED → polling
    wsTimeout = setTimeout(() => {
      if (realtimeOk === null) {
        setRealtimeOk(false)
        startPolling()
      }
    }, 6000)

    return () => {
      if (wsTimeout) clearTimeout(wsTimeout)
      stopPolling()
      supabase.removeChannel(channel)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
        className="relative w-8 h-8 flex items-center justify-center rounded-lg bg-[var(--card-bg)] border border-[var(--border)] text-[var(--text-secondary)] hover:border-[#DC2626] hover:text-[var(--text)] transition-all"
      >
        <Bell size={15} />
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 w-4 h-4 bg-[#DC2626] rounded-full text-[9px] font-bold text-white flex items-center justify-center">
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
            className="absolute right-0 top-full mt-2 z-50 w-[340px] bg-[var(--card-bg)] border border-[var(--border)] rounded-2xl shadow-2xl overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)]">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-[var(--text)]">Notifications</h3>
                {unread > 0 && (
                  <span className="px-1.5 py-0.5 text-[9px] font-bold bg-[#DC2626] text-white rounded-full">{unread}</span>
                )}
                {/* Indicateur Realtime */}
                {realtimeOk === true && (
                  <span title="Temps réel actif" className="flex items-center gap-0.5 text-[9px] text-green-600">
                    <Wifi size={9} /> Live
                  </span>
                )}
                {realtimeOk === false && (
                  <span title="Mode polling (WebSocket indisponible)" className="flex items-center gap-0.5 text-[9px] text-[var(--text-secondary)]">
                    <WifiOff size={9} /> Polling
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {unread > 0 && (
                  <button onClick={markAllRead} className="flex items-center gap-1 text-[10px] text-[var(--text-secondary)] hover:text-[#DC2626] transition-colors">
                    <CheckCheck size={12} /> Tout lire
                  </button>
                )}
                <button onClick={() => setOpen(false)} className="text-[var(--text-secondary)] hover:text-[var(--text-secondary)] transition-colors">
                  <X size={14} />
                </button>
              </div>
            </div>

            {/* List */}
            <div className="max-h-[420px] overflow-y-auto">
              {/* ── Section Échéances fiscales ─────────────────────────── */}
              {echeances.length > 0 && (
                <>
                  <div className="px-4 py-2 flex items-center gap-2 bg-[var(--card-bg)] sticky top-0 border-b border-[var(--border)] z-10">
                    <Calendar size={11} className="text-[var(--text-secondary)]" />
                    <span className="text-[10px] font-semibold text-[var(--text-secondary)] uppercase tracking-wide">Échéances fiscales</span>
                  </div>
                  {echeances.map((e) => {
                    const ucfg = URGENCE_CONFIG[e.urgence]
                    return (
                      <Link
                        key={e.id}
                        href="/dashboard/fiscalite"
                        onClick={() => setOpen(false)}
                        className="flex items-start gap-3 px-4 py-3 border-b border-[var(--border)] hover:bg-white/5 transition-colors"
                      >
                        <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5" style={{ background: ucfg.bg }}>
                          <Calendar size={13} style={{ color: ucfg.color }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-xs font-semibold leading-tight text-[var(--text)]">{e.nom}</p>
                            {e.urgence !== 'normal' && (
                              <span className="text-[8px] font-bold px-1.5 py-0.5 rounded-full shrink-0" style={{ background: ucfg.bg, color: ucfg.color }}>
                                {ucfg.label}
                              </span>
                            )}
                          </div>
                          <p className="text-[10px] text-[var(--text-secondary)] mt-0.5 line-clamp-1">{e.description}</p>
                          <div className="flex items-center justify-between mt-1">
                            <span className="text-[9px] text-[var(--text-secondary)]">
                              J-{e.joursRestants} — {e.dateLimite.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                            </span>
                            <span className="text-[9px] text-[var(--text-secondary)]">{e.base}</span>
                          </div>
                        </div>
                      </Link>
                    )
                  })}
                </>
              )}

              {/* ── Section Notifications système ─────────────────────── */}
              {!loading && notifs.length > 0 && (
                <div className="px-4 py-2 flex items-center gap-2 bg-[var(--card-bg)] sticky top-0 border-b border-[var(--border)] z-10">
                  <Bell size={11} className="text-[var(--text-secondary)]" />
                  <span className="text-[10px] font-semibold text-[var(--text-secondary)] uppercase tracking-wide">Système</span>
                </div>
              )}

              {loading ? (
                <div className="px-4 py-8 text-center text-xs text-[var(--text-secondary)]">{t('common.loading')}</div>
              ) : notifs.length === 0 && echeances.length === 0 ? (
                <div className="px-4 py-12 text-center">
                  <Bell size={24} className="text-[var(--text-secondary)] mx-auto mb-3" />
                  <p className="text-sm text-[var(--text-secondary)]">Aucune notification</p>
                </div>
              ) : (
                notifs.map((n) => {
                  const cfg = TYPE_CONFIG[n.type] ?? TYPE_CONFIG.info
                  const Icon = cfg.icon
                  return (
                    <div
                      key={n.id}
                      onClick={() => { markRead(n.id); if (n.link) setOpen(false) }}
                      className={`flex items-start gap-3 px-4 py-3.5 border-b border-[var(--border)] cursor-pointer transition-colors hover:bg-white/5 ${
                        !n.read ? 'bg-[#DC262604]' : ''
                      }`}
                    >
                      <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5" style={{ background: cfg.bg }}>
                        <Icon size={14} style={{ color: cfg.color }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <p className={`text-xs font-semibold leading-tight ${n.read ? 'text-[var(--text-secondary)]' : 'text-[var(--text)]'}`}>
                            {n.title}
                          </p>
                          {!n.read && <div className="w-1.5 h-1.5 rounded-full bg-[#DC2626] shrink-0 mt-1" />}
                        </div>
                        {n.message && <p className="text-[10px] text-[var(--text-secondary)] mt-0.5 line-clamp-2">{n.message}</p>}
                        <div className="flex items-center justify-between mt-1">
                          <span className="text-[9px] text-[var(--text-secondary)]">{timeAgo(n.created_at)}</span>
                          {n.link && (
                            <Link href={n.link} className="text-[9px] text-[#DC2626] flex items-center gap-0.5 hover:underline">
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

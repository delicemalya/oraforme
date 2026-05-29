'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useTenant } from '@/lib/hooks/useTenant'
import {
  Bell, Check, CheckCheck, Trash2, Info,
  AlertTriangle, CheckCircle, XCircle,
  Zap, Flag, Tag, ExternalLink, Loader2,
  RefreshCw,
} from 'lucide-react'
import Link from 'next/link'

// ── Types ─────────────────────────────────────────────────────────────────────

type NotifType     = 'info' | 'success' | 'warning' | 'error'
type NotifPriority = 'basse' | 'normale' | 'haute' | 'urgente'

interface Notification {
  id:           string
  title:        string
  body?:        string
  type:         NotifType
  href?:        string
  read:         boolean
  priority:     NotifPriority
  category:     string | null
  action_label: string | null
  action_href:  string | null
  created_at:   string
}

// ── Configs ────────────────────────────────────────────────────────────────────

const TYPE_CFG: Record<NotifType, { icon: React.ReactNode; color: string; bg: string; border: string }> = {
  info:    { icon: <Info size={14} />,          color: '#2563EB', bg: '#EFF6FF', border: '#BFDBFE' },
  success: { icon: <CheckCircle size={14} />,   color: '#16A34A', bg: '#F0FDF4', border: '#BBF7D0' },
  warning: { icon: <AlertTriangle size={14} />, color: '#D97706', bg: '#FFFBEB', border: '#FDE68A' },
  error:   { icon: <XCircle size={14} />,       color: '#DC2626', bg: '#FEF2F2', border: '#FECACA' },
}

const PRIORITY_CFG: Record<NotifPriority, { label: string; color: string; bg: string }> = {
  basse:   { label: 'Basse',   color: '#64748B', bg: '#F1F5F9' },
  normale: { label: 'Normale', color: '#2563EB', bg: '#EFF6FF' },
  haute:   { label: 'Haute',   color: '#D97706', bg: '#FFFBEB' },
  urgente: { label: 'Urgente', color: '#DC2626', bg: '#FEF2F2' },
}

const PRIORITY_LEFT: Record<NotifPriority, string> = {
  basse:   '#94A3B8',
  normale: '#2563EB',
  haute:   '#D97706',
  urgente: '#DC2626',
}

const CATEGORIES = ['all', 'tasks', 'events', 'facturation', 'rh', 'stock', 'system'] as const
type CategoryFilter = typeof CATEGORIES[number]

const CAT_LABELS: Record<CategoryFilter, string> = {
  all:        'Toutes',
  tasks:      'Tâches',
  events:     'Calendrier',
  facturation:'Facturation',
  rh:         'RH',
  stock:      'Stock',
  system:     'Système',
}

// ── Helper ─────────────────────────────────────────────────────────────────────

function fmtDate(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000
  if (diff < 60)    return 'À l\'instant'
  if (diff < 3600)  return `il y a ${Math.floor(diff / 60)}min`
  if (diff < 86400) return `il y a ${Math.floor(diff / 3600)}h`
  if (diff < 604800) return `il y a ${Math.floor(diff / 86400)}j`
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })
}

// ── Notification Card ──────────────────────────────────────────────────────────

function NotifCard({
  notif,
  onRead,
  onDelete,
}: {
  notif:    Notification
  onRead:   (id: string) => void
  onDelete: (id: string) => void
}) {
  const type = TYPE_CFG[notif.type] ?? TYPE_CFG.info
  const prio = PRIORITY_CFG[notif.priority ?? 'normale']

  const inner = (
    <div className={`relative flex gap-3 p-4 rounded-2xl border transition-all group ${
      notif.read
        ? 'bg-white border-[#E5E7EB]'
        : `border-[${type.border}] shadow-sm`
    }`}
    style={{
      background: notif.read ? '#fff' : type.bg,
      borderLeft: `4px solid ${PRIORITY_LEFT[notif.priority ?? 'normale']}`,
    }}>
      {/* Icône type */}
      <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5"
        style={{ background: notif.read ? '#F1F5F9' : type.bg, color: type.color }}>
        {type.icon}
      </div>

      {/* Contenu */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <p className={`text-sm font-semibold leading-tight ${notif.read ? 'text-[#64748B]' : 'text-[#0F172A]'}`}>
            {notif.title}
            {!notif.read && (
              <span className="inline-block w-2 h-2 rounded-full bg-[#DC2626] ml-2 align-middle" />
            )}
          </p>
          <span className="text-[10px] text-[#94A3B8] shrink-0 mt-0.5">{fmtDate(notif.created_at)}</span>
        </div>

        {notif.body && (
          <p className="text-xs text-[#64748B] mt-0.5 leading-relaxed line-clamp-2">{notif.body}</p>
        )}

        {/* Badges */}
        <div className="flex items-center gap-2 mt-2 flex-wrap">
          {notif.priority && notif.priority !== 'normale' && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold"
              style={{ background: prio.bg, color: prio.color }}>
              <Flag size={8} /> {prio.label}
            </span>
          )}
          {notif.category && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-[#F1F5F9] text-[#64748B]">
              <Tag size={8} /> {notif.category}
            </span>
          )}
          {/* Action CTA */}
          {notif.action_label && notif.action_href && (
            <Link href={notif.action_href}
              onClick={e => { e.stopPropagation(); onRead(notif.id) }}
              className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-[#DC2626] text-white hover:bg-[#B91C1C] transition-colors">
              {notif.action_label} <ExternalLink size={8} />
            </Link>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-col gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
        {!notif.read && (
          <button onClick={e => { e.preventDefault(); onRead(notif.id) }}
            title="Marquer comme lu"
            className="p-1.5 rounded-lg hover:bg-white/80 text-[#64748B] hover:text-[#16A34A] transition-colors">
            <Check size={13} />
          </button>
        )}
        <button onClick={e => { e.preventDefault(); onDelete(notif.id) }}
          title="Supprimer"
          className="p-1.5 rounded-lg hover:bg-red-50 text-[#94A3B8] hover:text-[#DC2626] transition-colors">
          <Trash2 size={13} />
        </button>
      </div>
    </div>
  )

  if (notif.href && !notif.action_href) {
    return (
      <Link key={notif.id} href={notif.href} onClick={() => onRead(notif.id)}>
        {inner}
      </Link>
    )
  }
  return <div key={notif.id}>{inner}</div>
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function NotificationsPage() {
  const { tenantId, loading: tenantLoading } = useTenant()

  const [notifs,    setNotifs]    = useState<Notification[]>([])
  const [loading,   setLoading]   = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [filterRead, setFilterRead] = useState<'all' | 'unread'>('all')
  const [filterPrio, setFilterPrio] = useState<NotifPriority | 'all'>('all')
  const [filterCat,  setFilterCat]  = useState<CategoryFilter>('all')

  const load = useCallback(async (silent = false) => {
    if (!tenantId) return
    if (!silent) setLoading(true)
    else setRefreshing(true)

    const { data } = await supabase
      .from('notifications')
      .select('id, title, body, type, href, read, priority, category, action_label, action_href, created_at')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(200)

    setNotifs((data ?? []) as Notification[])
    setLoading(false)
    setRefreshing(false)
  }, [tenantId])

  useEffect(() => {
    if (!tenantLoading) load()
  }, [tenantLoading, load])

  // Realtime
  useEffect(() => {
    if (!tenantId) return
    const channel = supabase
      .channel(`notifs:${tenantId}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'notifications',
        filter: `tenant_id=eq.${tenantId}`,
      }, () => load(true))
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [tenantId, load])

  async function markRead(id: string) {
    setNotifs(prev => prev.map(n => n.id === id ? { ...n, read: true } : n))
    if (!id.startsWith('demo')) {
      await supabase.from('notifications').update({ read: true }).eq('id', id)
    }
  }

  async function markAllRead() {
    setNotifs(prev => prev.map(n => ({ ...n, read: true })))
    if (!tenantId) return
    await supabase.from('notifications')
      .update({ read: true })
      .eq('tenant_id', tenantId)
      .eq('read', false)
  }

  async function deleteNotif(id: string) {
    setNotifs(prev => prev.filter(n => n.id !== id))
    if (!id.startsWith('demo')) {
      await supabase.from('notifications').delete().eq('id', id)
    }
  }

  async function deleteAllRead() {
    const readIds = notifs.filter(n => n.read && !n.id.startsWith('demo')).map(n => n.id)
    setNotifs(prev => prev.filter(n => !n.read))
    if (readIds.length > 0) {
      await supabase.from('notifications').delete().in('id', readIds)
    }
  }

  // Filtres
  const filtered = notifs.filter(n => {
    if (filterRead === 'unread' && n.read) return false
    if (filterPrio !== 'all' && (n.priority ?? 'normale') !== filterPrio) return false
    if (filterCat  !== 'all' && n.category !== filterCat) return false
    return true
  })

  const unreadCnt   = notifs.filter(n => !n.read).length
  const urgentCnt   = notifs.filter(n => !n.read && n.priority === 'urgente').length
  const hauteCnt    = notifs.filter(n => !n.read && n.priority === 'haute').length
  const hasRead     = notifs.some(n => n.read)

  if (tenantLoading || loading) {
    return (
      <div className="min-h-screen bg-[#F5F7FB] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#DC2626]" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#F5F7FB] p-6">
      {/* Header */}
      <div className="flex items-start justify-between mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#0F172A] flex items-center gap-2">
            <Bell size={22} className="text-[#DC2626]" />
            Notifications
            {unreadCnt > 0 && (
              <span className="text-sm font-bold bg-[#DC2626] text-white px-2 py-0.5 rounded-full">{unreadCnt}</span>
            )}
          </h1>
          <p className="text-sm text-[#64748B] mt-0.5">Centre de notifications · Temps réel</p>
        </div>

        {/* Actions globales */}
        <div className="flex items-center gap-2 flex-wrap justify-end">
          <button onClick={() => load(true)} disabled={refreshing}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[#E5E7EB] text-xs font-medium text-[#64748B] hover:bg-white transition-colors disabled:opacity-50">
            <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} />
            Actualiser
          </button>
          {unreadCnt > 0 && (
            <button onClick={markAllRead}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[#E5E7EB] text-xs font-semibold text-[#16A34A] hover:bg-[#F0FDF4] transition-colors">
              <CheckCheck size={13} /> Tout marquer lu
            </button>
          )}
          {hasRead && (
            <button onClick={deleteAllRead}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[#E5E7EB] text-xs font-semibold text-[#DC2626] hover:bg-[#FEF2F2] transition-colors">
              <Trash2 size={13} /> Supprimer les lues
            </button>
          )}
        </div>
      </div>

      {/* KPIs priorité */}
      {(urgentCnt > 0 || hauteCnt > 0) && (
        <div className="flex gap-3 mb-5">
          {urgentCnt > 0 && (
            <div className="flex items-center gap-2 bg-[#FEF2F2] border border-[#FECACA] rounded-xl px-4 py-2.5">
              <Zap size={14} className="text-[#DC2626]" />
              <span className="text-sm font-bold text-[#DC2626]">{urgentCnt} urgente{urgentCnt > 1 ? 's' : ''}</span>
            </div>
          )}
          {hauteCnt > 0 && (
            <div className="flex items-center gap-2 bg-[#FFFBEB] border border-[#FDE68A] rounded-xl px-4 py-2.5">
              <Flag size={14} className="text-[#D97706]" />
              <span className="text-sm font-bold text-[#D97706]">{hauteCnt} haute{hauteCnt > 1 ? 's' : ''}</span>
            </div>
          )}
        </div>
      )}

      {/* Filtres */}
      <div className="bg-white rounded-2xl border border-[#E5E7EB] p-4 mb-4 space-y-3">
        {/* Lues / Non lues */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-semibold text-[#94A3B8] uppercase tracking-wide w-16">Statut</span>
          {(['all', 'unread'] as const).map(f => (
            <button key={f} onClick={() => setFilterRead(f)}
              className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${
                filterRead === f
                  ? 'bg-[#0F172A] text-white'
                  : 'bg-[#F1F5F9] text-[#64748B] hover:bg-[#E2E8F0]'
              }`}>
              {f === 'all' ? `Toutes (${notifs.length})` : `Non lues (${unreadCnt})`}
            </button>
          ))}
        </div>

        {/* Priorité */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-semibold text-[#94A3B8] uppercase tracking-wide w-16">Priorité</span>
          {(['all', 'urgente', 'haute', 'normale', 'basse'] as const).map(p => {
            const cfg = p !== 'all' ? PRIORITY_CFG[p] : null
            return (
              <button key={p} onClick={() => setFilterPrio(p)}
                className={`px-3 py-1 rounded-full text-xs font-semibold transition-all border ${
                  filterPrio === p
                    ? 'text-white border-transparent'
                    : 'bg-white text-[#64748B] border-[#E5E7EB] hover:border-[#94A3B8]'
                }`}
                style={filterPrio === p && cfg ? { background: cfg.color, borderColor: cfg.color } : {}}>
                {p === 'all' ? 'Toutes' : cfg!.label}
              </button>
            )
          })}
        </div>

        {/* Catégorie */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-semibold text-[#94A3B8] uppercase tracking-wide w-16">Module</span>
          {CATEGORIES.map(cat => (
            <button key={cat} onClick={() => setFilterCat(cat)}
              className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${
                filterCat === cat
                  ? 'bg-[#DC2626] text-white'
                  : 'bg-[#F1F5F9] text-[#64748B] hover:bg-[#E2E8F0]'
              }`}>
              {CAT_LABELS[cat]}
            </button>
          ))}
        </div>
      </div>

      {/* Liste */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-[#E5E7EB] flex flex-col items-center justify-center py-16 text-center">
          <Bell size={36} className="text-[#CBD5E1] mb-3" />
          <p className="text-sm font-semibold text-[#0F172A]">
            {filterRead === 'unread' ? 'Aucune notification non lue' : 'Aucune notification'}
          </p>
          <p className="text-xs text-[#94A3B8] mt-1">Vous êtes à jour !</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(notif => (
            <NotifCard
              key={notif.id}
              notif={notif}
              onRead={markRead}
              onDelete={deleteNotif}
            />
          ))}
          {filtered.length > 20 && (
            <p className="text-center text-xs text-[#94A3B8] pt-2">{filtered.length} notifications affichées</p>
          )}
        </div>
      )}
    </div>
  )
}

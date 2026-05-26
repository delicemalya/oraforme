'use client'

/**
 * Notifications — Centre de notifications tenant (tous secteurs)
 */

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useTenantContext } from '@/lib/contexts/TenantContext'
import { useLocale } from '@/lib/hooks/useLocale'
import ERPPageLayout, { ERPSectionCard } from '@/components/ui/ERPPageLayout'
import { Bell, Check, CheckCheck, Trash2, Info, AlertTriangle, CheckCircle, X } from 'lucide-react'
import Link from 'next/link'

// ── Types ─────────────────────────────────────────────────────────────────────

interface Notification {
  id:         string
  title:      string
  body?:      string
  type:       'info' | 'success' | 'warning' | 'error'
  href?:      string
  read:       boolean
  created_at: string
}

const TYPE_STYLES: Record<string, { icon: React.ReactNode; bg: string; border: string }> = {
  info:    { icon: <Info size={15} className="text-blue-600" />,   bg: 'bg-blue-50',   border: 'border-blue-100' },
  success: { icon: <CheckCircle size={15} className="text-green-600" />, bg: 'bg-green-50',  border: 'border-green-100' },
  warning: { icon: <AlertTriangle size={15} className="text-amber-600" />, bg: 'bg-amber-50', border: 'border-amber-100' },
  error:   { icon: <X size={15} className="text-red-600" />,       bg: 'bg-red-50',    border: 'border-red-100' },
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function NotificationsPage() {
  const { tenant } = useTenantContext()
  const { t } = useLocale()

  const [notifs,   setNotifs]   = useState<Notification[]>([])
  const [loading,  setLoading]  = useState(true)
  const [filter,   setFilter]   = useState<'all' | 'unread'>('all')

  // Demo notifications are built inside the component so t() is available
  const DEMO_NOTIFS: Notification[] = [
    {
      id: 'demo-1', type: 'info',
      title: t('notif.demo1Title') || 'Bienvenue sur Oraforme',
      body:  t('notif.demo1Body')  || 'Votre espace entreprise est prêt. Commencez par configurer votre profil.',
      href: '/dashboard/profil', read: false,
      created_at: new Date(Date.now() - 300_000).toISOString(),
    },
    {
      id: 'demo-2', type: 'success',
      title: t('notif.demo2Title') || 'Module Trésorerie actif',
      body:  t('notif.demo2Body')  || 'Le module trésorerie est configuré et prêt à l\'emploi.',
      href: '/dashboard/tresorerie', read: false,
      created_at: new Date(Date.now() - 3_600_000).toISOString(),
    },
    {
      id: 'demo-3', type: 'warning',
      title: t('notif.demo3Title') || 'Vérifiez vos paramètres',
      body:  t('notif.demo3Body')  || 'Complétez les informations de votre entreprise pour optimiser l\'expérience.',
      href: '/dashboard/parametres', read: true,
      created_at: new Date(Date.now() - 86_400_000).toISOString(),
    },
  ]

  function fmtDate(s: string) {
    const d = new Date(s)
    const now = new Date()
    const diff = (now.getTime() - d.getTime()) / 1000
    if (diff < 60)    return t('notif.now')
    if (diff < 3600)  return `${t('notif.ago')} ${Math.floor(diff / 60)}min`
    if (diff < 86400) return `${t('notif.ago')} ${Math.floor(diff / 3600)}h`
    return `${t('notif.ago')} ${Math.floor(diff / 86400)}j`
  }

  useEffect(() => {
    if (!tenant) return
    loadNotifs()
  }, [tenant]) // eslint-disable-line react-hooks/exhaustive-deps

  async function loadNotifs() {
    setLoading(true)
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('tenant_id', tenant!.tenantId)
      .order('created_at', { ascending: false })
      .limit(100)

    if (data && data.length > 0) {
      setNotifs(data as Notification[])
    } else {
      setNotifs(DEMO_NOTIFS)
    }
    setLoading(false)
  }

  async function markRead(id: string) {
    setNotifs(prev => prev.map(n => n.id === id ? { ...n, read: true } : n))
    if (!id.startsWith('demo')) {
      await supabase.from('notifications').update({ read: true }).eq('id', id)
    }
  }

  async function markAllRead() {
    setNotifs(prev => prev.map(n => ({ ...n, read: true })))
    await supabase
      .from('notifications')
      .update({ read: true })
      .eq('tenant_id', tenant!.tenantId)
      .eq('read', false)
  }

  async function deleteNotif(id: string) {
    setNotifs(prev => prev.filter(n => n.id !== id))
    if (!id.startsWith('demo')) {
      await supabase.from('notifications').delete().eq('id', id)
    }
  }

  const filtered  = filter === 'unread' ? notifs.filter(n => !n.read) : notifs
  const unreadCnt = notifs.filter(n => !n.read).length

  return (
    <ERPPageLayout
      title={t('notif.title')}
      subtitle={t('notif.subtitle')}
      icon={<Bell size={18} />}
      color="#2563EB"
      actions={
        <div className="flex items-center gap-2">
          {unreadCnt > 0 && (
            <button
              onClick={markAllRead}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[#E2E8F0] text-[12px] font-semibold text-[#64748B] hover:bg-[#F8FAFC]"
            >
              <CheckCheck size={14} />
              {t('notif.markAll')}
            </button>
          )}
        </div>
      }
    >
      {/* Filtre */}
      <div className="flex items-center gap-2 mb-4">
        {(['all', 'unread'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-colors ${
              filter === f
                ? 'bg-blue-600 text-white'
                : 'border border-[#E2E8F0] text-[#64748B] hover:bg-[#F8FAFC]'
            }`}
          >
            {f === 'all'
              ? `${t('notif.all')} (${notifs.length})`
              : `${t('notif.unread')} (${unreadCnt})`}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-2">
          {[...Array(4)].map((_, i) => <div key={i} className="h-16 bg-[#F1F5F9] rounded-2xl animate-pulse" />)}
        </div>
      ) : filtered.length === 0 ? (
        <ERPSectionCard>
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Bell size={32} className="text-[#CBD5E1] mb-3" />
            <p className="text-[14px] font-semibold text-[#0F172A]">
              {filter === 'unread' ? t('notif.noUnread') : t('notif.empty')}
            </p>
            <p className="text-[12px] text-[#64748B] mt-1">{t('notif.upToDate')}</p>
          </div>
        </ERPSectionCard>
      ) : (
        <div className="space-y-2">
          {filtered.map(notif => {
            const style = TYPE_STYLES[notif.type] ?? TYPE_STYLES.info
            const inner = (
              <div
                className={`flex items-start gap-3 p-4 rounded-2xl border transition-all ${
                  notif.read
                    ? 'bg-white border-[#E2E8F0]'
                    : `${style.bg} ${style.border} shadow-sm`
                }`}
              >
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${
                  notif.read ? 'bg-[#F1F5F9]' : style.bg
                }`}>
                  {style.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <p className={`text-[13px] font-semibold leading-tight ${notif.read ? 'text-[#64748B]' : 'text-[#0F172A]'}`}>
                      {notif.title}
                    </p>
                    <span className="text-[10px] text-[#94A3B8] shrink-0">{fmtDate(notif.created_at)}</span>
                  </div>
                  {notif.body && (
                    <p className="text-[12px] text-[#64748B] mt-0.5 leading-relaxed">{notif.body}</p>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {!notif.read && (
                    <button
                      onClick={e => { e.preventDefault(); markRead(notif.id) }}
                      title={t('notif.markRead')}
                      className="p-1.5 rounded-lg hover:bg-white/60 text-[#64748B] transition-colors"
                    >
                      <Check size={13} />
                    </button>
                  )}
                  <button
                    onClick={e => { e.preventDefault(); deleteNotif(notif.id) }}
                    title={t('notif.delete')}
                    className="p-1.5 rounded-lg hover:bg-red-50 text-[#94A3B8] hover:text-red-500 transition-colors"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            )

            return notif.href ? (
              <Link key={notif.id} href={notif.href} onClick={() => markRead(notif.id)}>
                {inner}
              </Link>
            ) : (
              <div key={notif.id}>{inner}</div>
            )
          })}
        </div>
      )}
    </ERPPageLayout>
  )
}

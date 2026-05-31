'use client'

import { useLocale } from '@/lib/hooks/useLocale'

import { useRouter } from 'next/navigation'
import { Bell, Settings, LogOut, ChevronDown, ExternalLink, Shield, User, Search, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'

interface Props {
  email: string
  timeStr: string
  dateStr: string
}

const QUICK_LINKS = [
  { label: 'Dashboard Global',    href: '/admin' },
  { label: 'Clients entreprises', href: '/admin/clients' },
  { label: 'Finance Center',      href: '/admin/finance' },
  { label: 'Revenus & MRR',       href: '/admin/revenus' },
  { label: 'Transactions',        href: '/admin/transactions' },
  { label: 'Monitoring système',  href: '/admin/monitoring' },
  { label: 'Sécurité',            href: '/admin/securite' },
  { label: 'Support clients',     href: '/admin/support' },
  { label: 'Paramètres',          href: '/admin/parametres' },
  { label: 'Notifications',       href: '/admin/notifications' },
]

export default function AdminTopbar({ email, timeStr, dateStr }: Props) {
  const { t } = useLocale()
  const router = useRouter()
  const [avatarOpen, setAvatarOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [query,      setQuery]      = useState('')
  const searchRef = useRef<HTMLInputElement>(null)

  // ⌘K / Ctrl+K global shortcut
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setSearchOpen(s => !s)
      }
      if (e.key === 'Escape') { setSearchOpen(false); setAvatarOpen(false) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    if (searchOpen) setTimeout(() => searchRef.current?.focus(), 50)
  }, [searchOpen])

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const filtered = QUICK_LINKS.filter(l =>
    query === '' || l.label.toLowerCase().includes(query.toLowerCase())
  )

  return (
    <>
      <header className="h-14 bg-white border-b border-gray-100 flex items-center px-4 lg:px-6 shrink-0 gap-3 shadow-[0_1px_3px_rgba(0,0,0,0.04)] relative z-10">
        {/* Mobile spacer for hamburger */}
        <div className="w-8 lg:hidden shrink-0" />

        {/* Status badges */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-green-200 bg-green-50">
            <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
            <span className="text-[11px] font-semibold text-green-700 hidden sm:block">Système opérationnel</span>
            <span className="text-[11px] font-semibold text-green-700 sm:hidden">OK</span>
          </div>
          <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-amber-200 bg-amber-50">
            <Shield size={11} className="text-amber-600" />
            <span className="text-[11px] font-semibold text-amber-700">Owner Access</span>
          </div>
        </div>

        <div className="flex-1" />

        {/* Search button */}
        <button
          onClick={() => setSearchOpen(true)}
          className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg text-[12px] text-gray-400 border border-gray-200 hover:border-gray-300 hover:text-gray-600 transition-colors bg-gray-50 min-w-[160px]"
        >
          <Search size={12} />
          <span className="flex-1 text-left">Rechercher…</span>
          <kbd className="text-[10px] bg-gray-200 text-gray-500 px-1 rounded font-mono">⌘K</kbd>
        </button>

        {/* Date/time */}
        <div className="hidden lg:flex flex-col items-end">
          <span className="text-[12px] font-semibold text-gray-700">{timeStr}</span>
          <span className="text-[10px] text-gray-400 capitalize">{dateStr}</span>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1.5">
          <a
            href="https://supabase.com/dashboard"
            target="_blank"
            rel="noopener noreferrer"
            className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[12px] text-gray-500 hover:text-gray-800 hover:bg-gray-100 transition-colors border border-gray-200"
          >
            <ExternalLink size={12} />
            <span className="hidden md:inline">Supabase</span>
          </a>

          {/* Bell */}
          <button
            onClick={() => router.push('/admin/notifications')}
            className="relative p-2 rounded-lg text-gray-500 hover:text-gray-800 hover:bg-gray-100 transition-colors"
            title="Notifications"
          >
            <Bell size={15} />
            <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-red-500" />
          </button>

          {/* Settings */}
          <button
            onClick={() => router.push('/admin/parametres')}
            className="p-2 rounded-lg text-gray-500 hover:text-gray-800 hover:bg-gray-100 transition-colors"
            title="Paramètres"
          >
            <Settings size={15} />
          </button>

          {/* Avatar + dropdown */}
          <div className="relative pl-2 border-l border-gray-200">
            <button
              onClick={() => setAvatarOpen(o => !o)}
              className="flex items-center gap-2 hover:opacity-80 transition-opacity"
            >
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-white text-[11px] font-bold shadow-sm">
                {email[0].toUpperCase()}
              </div>
              <div className="hidden md:block text-left">
                <p className="text-[12px] font-semibold text-gray-800 leading-none">{email.split('@')[0]}</p>
                <p className="text-[10px] text-gray-400">Super Owner</p>
              </div>
              <ChevronDown size={12} className="text-gray-400 hidden md:block" />
            </button>

            {avatarOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setAvatarOpen(false)} />
                <div className="absolute right-0 top-10 z-20 w-52 bg-white rounded-xl shadow-xl border border-gray-100 py-1.5 overflow-hidden">
                  <div className="px-4 py-2.5 bg-gradient-to-r from-amber-50 to-white border-b border-gray-100">
                    <p className="text-[12px] font-bold text-gray-900 truncate">{email.split('@')[0]}</p>
                    <p className="text-[11px] text-gray-400 truncate">{email}</p>
                  </div>
                  <Link
                    href="/admin/parametres"
                    onClick={() => setAvatarOpen(false)}
                    className="flex items-center gap-2.5 px-4 py-2 text-[13px] text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    <Settings size={13} className="text-gray-400" /> Paramètres plateforme
                  </Link>
                  <Link
                    href="/dashboard"
                    onClick={() => setAvatarOpen(false)}
                    className="flex items-center gap-2.5 px-4 py-2 text-[13px] text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    <User size={13} className="text-gray-400" /> Mon dashboard client
                  </Link>
                  <div className="border-t border-gray-100 mt-1 pt-1">
                    <button
                      onClick={() => { setAvatarOpen(false); handleLogout() }}
                      className="w-full flex items-center gap-2.5 px-4 py-2 text-[13px] text-red-600 hover:bg-red-50 transition-colors"
                    >
                      <LogOut size={13} /> Déconnexion
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Search modal */}
      {searchOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4">
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setSearchOpen(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-gray-200">
            <div className="flex items-center gap-3 px-4 py-3.5 border-b border-gray-100">
              <Search size={16} className="text-gray-400 flex-shrink-0" />
              <input
                ref={searchRef}
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Rechercher une page…"
                className="flex-1 text-[14px] outline-none text-gray-900 placeholder-gray-400"
              />
              <button onClick={() => setSearchOpen(false)} className="p-1 rounded hover:bg-gray-100">
                <X size={14} className="text-gray-400" />
              </button>
            </div>
            <div className="py-2 max-h-72 overflow-y-auto">
              {filtered.length === 0 && (
                <p className="px-4 py-6 text-center text-[13px] text-gray-400">{t('common.noResult')}</p>
              )}
              {filtered.map(l => (
                <Link
                  key={l.href}
                  href={l.href}
                  onClick={() => { setSearchOpen(false); setQuery('') }}
                  className="flex items-center gap-3 px-4 py-2.5 text-[13px] text-gray-700 hover:bg-amber-50 hover:text-amber-700 transition-colors"
                >
                  <div className="w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0" />
                  {l.label}
                </Link>
              ))}
            </div>
            <div className="px-4 py-2 border-t border-gray-100 flex items-center gap-3">
              <kbd className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded font-mono">↵</kbd>
              <span className="text-[11px] text-gray-400">Sélectionner</span>
              <kbd className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded font-mono ml-2">Esc</kbd>
              <span className="text-[11px] text-gray-400">{t('common.close')}</span>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

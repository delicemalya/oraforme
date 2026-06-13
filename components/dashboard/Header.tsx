'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  Search, ChevronDown, LogOut, Sun, Moon, UsersRound, ChevronLeft,
  Calendar, User, Settings, CreditCard, Zap, Key, Workflow,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useTenantContext } from '@/lib/contexts/TenantContext'
import { useLocale } from '@/lib/hooks/useLocale'
import NotificationsPanel from '@/components/ui/NotificationsPanel'
import LanguageSelector from '@/components/ui/LanguageSelector'
import DeviseSelector from '@/components/ui/DeviseSelector'
import { LogoUploader } from '@/components/ui/LogoUploader'

// Plan badge config
const PLAN_BADGE: Record<string, { label: string; color: string; bg: string }> = {
  tpe:    { label: 'TPE',    color: '#2563EB', bg: '#EFF6FF' },
  pme:    { label: 'PME',    color: '#D97706', bg: '#FFFBEB' },
  grande: { label: 'GRANDE', color: '#7C3AED', bg: '#F5F3FF' },
  starter:    { label: 'TPE',    color: '#2563EB', bg: '#EFF6FF' },
  pro:        { label: 'PME',    color: '#D97706', bg: '#FFFBEB' },
  enterprise: { label: 'GRANDE', color: '#7C3AED', bg: '#F5F3FF' },
}

export default function Header() {
  const { tenant } = useTenantContext()
  const { t } = useLocale()
  const pathname = usePathname()
  const router   = useRouter()
  const isOwner  = tenant?.role === 'owner'
  const dropRef  = useRef<HTMLDivElement>(null)

  const segments   = pathname.split('/').filter(Boolean)
  const showBack   = segments.length > 1
  const canSeeTeam = isOwner || tenant?.ecoleRole === 'DIRECTION_GENERALE'

  const [userName,     setUserName]     = useState('')
  const [userEmail,    setUserEmail]    = useState('')
  const [initials,     setInitials]     = useState('U')
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [theme,        setTheme]        = useState<'dark' | 'light'>('light')

  // nomEntreprise & logoUrl managed inside LogoUploader
  const planKey       = tenant?.taille ?? tenant?.plan ?? 'tpe'
  const planBadge     = PLAN_BADGE[planKey] ?? PLAN_BADGE.tpe
  const nextPlan      = planKey === 'tpe' ? 'PME' : planKey === 'pme' ? 'Grande' : null

  // Close dropdown on outside click
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (dropRef.current && !dropRef.current.contains(e.target as Node)) {
        setDropdownOpen(false)
      }
    }
    if (dropdownOpen) document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [dropdownOpen])

  useEffect(() => {
    const stored = localStorage.getItem('oraforme-theme') as 'dark' | 'light' | null
    const effective: 'dark' | 'light' = stored === 'dark' ? 'dark' : 'light'
    setTheme(effective)
    document.body.classList.toggle('light-mode', effective === 'light')
    localStorage.setItem('oraforme-theme', effective)
  }, [])

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return
      const email = user.email ?? ''
      setUserEmail(email)
      setInitials(email.charAt(0).toUpperCase())
      const { data } = await supabase
        .from('profiles')
        .select('prenom, nom')
        .eq('user_id', user.id)
        .maybeSingle()
      if (data) {
        const name = [data.prenom, data.nom].filter(Boolean).join(' ')
        setUserName(name || email.split('@')[0])
        setInitials((name || email).charAt(0).toUpperCase())
      } else {
        setUserName(email.split('@')[0])
      }
    })
  }, [tenant?.userId])

  async function handleLogout() {
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  function toggleTheme() {
    const next = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    localStorage.setItem('oraforme-theme', next)
    document.body.classList.toggle('light-mode', next === 'light')
  }

  return (
    <header className="h-14 bg-white border-b border-[#E2E8F0] flex items-center pl-14 pr-3 lg:px-6 gap-3 shrink-0">

      {/* Logo Oraforme — visible uniquement sur mobile quand pas de retour */}
      {!showBack && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src="/logo.png" alt="Oraforme" className="lg:hidden h-6 w-auto shrink-0" />
      )}

      {/* Bouton retour — visible sur tous les appareils */}
      {showBack ? (
        <button
          onClick={() => router.back()}
          title={t('common.back')}
          className="flex items-center gap-1.5 h-9 pl-2 pr-3 rounded-xl
            text-[#64748B] hover:text-[#0F172A] hover:bg-[#F1F5F9]
            border border-transparent hover:border-[#E2E8F0]
            transition-all shrink-0 group"
          aria-label={t('common.back')}
        >
          <ChevronLeft size={16} className="group-hover:-translate-x-0.5 transition-transform" />
          <span className="text-[12px] font-medium">{t('common.back')}</span>
        </button>
      ) : (
        <div className="hidden lg:block w-2 shrink-0" />
      )}

      {/* Search */}
      <div className="flex-1 max-w-xs">
        <div className="flex items-center gap-2 bg-[#F8FAFC] border border-[#E8ECF0] rounded-xl px-3 py-2 transition-all focus-within:border-[#CBD5E1] focus-within:bg-white focus-within:shadow-sm">
          <Search size={13} className="text-[#94A3B8] shrink-0" />
          <input
            placeholder={`${t('common.search')}…`}
            className="bg-transparent text-[13px] text-[#0F172A] placeholder-[#9CA3AF] outline-none flex-1 w-0 min-w-0"
          />
          <kbd className="hidden sm:inline-flex items-center gap-0.5 text-[10px] text-[#94A3B8] border border-[#E2E8F0] rounded px-1.5 py-0.5 shrink-0 font-medium">
            ⌘K
          </kbd>
        </div>
      </div>

      {/* Company logo — cliquable, modifiable via LogoUploader */}
      <LogoUploader />

      {/* Team link */}
      {canSeeTeam && (
        <Link
          href="/dashboard/equipe"
          className={`hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors shrink-0 ${
            pathname === '/dashboard/equipe'
              ? 'bg-red-50 text-red-700'
              : 'text-[#64748B] hover:text-[#0F172A] hover:bg-[#F8FAFC]'
          }`}
        >
          <UsersRound size={14} />
          <span>{t('nav.equipe')}</span>
        </Link>
      )}

      {/* Right actions */}
      <div className="flex items-center gap-1 ml-auto">

        {/* Calendar quick access */}
        <Link
          href="/dashboard/calendrier"
          title="Calendrier"
          className={`hidden sm:flex items-center justify-center w-8 h-8 rounded-lg transition-colors ${
            pathname.startsWith('/dashboard/calendrier')
              ? 'bg-[#DC2626]/8 text-[#DC2626]'
              : 'text-[#64748B] hover:text-[#0F172A] hover:bg-[#F8FAFC]'
          }`}
        >
          <Calendar size={16} />
        </Link>

        {/* Devise */}
        <DeviseSelector />

        {/* Language */}
        <LanguageSelector />

        {/* Notifications */}
        <NotificationsPanel />

        {/* ── Account Dropdown ──────────────────────────────────────────────── */}
        <div className="relative ml-1" ref={dropRef}>
          <button
            onClick={() => setDropdownOpen(v => !v)}
            className="flex items-center gap-2 pl-1.5 pr-2.5 py-1 rounded-xl hover:bg-[#F8FAFC] transition-all border border-transparent hover:border-[#E2E8F0]"
          >
            {/* Avatar */}
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-white text-[11px] font-bold"
              style={{
                background: 'linear-gradient(135deg, #DC2626, #B91C1C)',
                boxShadow: '0 1px 3px rgba(220,38,38,0.35)',
              }}
            >
              {initials}
            </div>
            <span className="text-[13px] text-[#0F172A] font-medium hidden sm:block max-w-[90px] truncate">{userName}</span>
            <ChevronDown
              size={11}
              className="text-[#94A3B8] hidden sm:block transition-transform"
              style={{ transform: dropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}
            />
          </button>

          {/* Dropdown panel */}
          {dropdownOpen && (
            <div
              className="absolute right-0 top-full mt-2 w-64 bg-white rounded-2xl border border-[#E8ECF0] z-50 overflow-hidden"
              style={{ boxShadow: '0 8px 30px rgba(0,0,0,0.10), 0 2px 8px rgba(0,0,0,0.06)' }}
            >

              {/* User identity */}
              <div className="px-4 pt-4 pb-3 flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 text-white text-[14px] font-bold"
                  style={{
                    background: 'linear-gradient(135deg, #DC2626, #B91C1C)',
                    boxShadow: '0 2px 6px rgba(220,38,38,0.3)',
                  }}
                >
                  {initials}
                </div>
                <div className="min-w-0">
                  <p className="text-[13px] font-bold text-[#0F172A] truncate">{userName}</p>
                  <p className="text-[11px] text-[#94A3B8] truncate">{userEmail}</p>
                </div>
              </div>

              {/* Plan badge + upgrade */}
              <div className="px-4 pb-3">
                <div
                  className="flex items-center justify-between px-3 py-2 rounded-xl"
                  style={{ background: `linear-gradient(135deg, ${planBadge.color}12, ${planBadge.color}06)`, border: `1px solid ${planBadge.color}20` }}
                >
                  <div className="flex items-center gap-2">
                    <Zap size={12} style={{ color: planBadge.color }} />
                    <span className="text-[11px] font-bold" style={{ color: planBadge.color }}>
                      Pack {planBadge.label}
                    </span>
                  </div>
                  {nextPlan && (
                    <Link
                      href="/dashboard/abonnement"
                      onClick={() => setDropdownOpen(false)}
                      className="text-[10px] font-bold px-2 py-0.5 rounded-lg text-white transition-opacity hover:opacity-80"
                      style={{ background: planBadge.color }}
                    >
                      → {nextPlan}
                    </Link>
                  )}
                </div>
              </div>

              <div className="border-t border-[#F1F5F9]" />

              {/* Menu items */}
              <div className="py-1.5">
                {[
                  { icon: User,       label: t('nav.profil'),      href: '/dashboard/profil' },
                  { icon: Settings,   label: t('nav.parametres'),  href: '/dashboard/parametres' },
                  { icon: CreditCard, label: t('nav.abonnement'),  href: '/dashboard/abonnement' },
                  ...(isOwner ? [{ icon: Key, label: t('nav.api_keys'), href: '/dashboard/api-keys' }] : []),
                ].map(({ icon: Icon, label, href }) => (
                  <Link
                    key={href}
                    href={href}
                    onClick={() => setDropdownOpen(false)}
                    className={`flex items-center gap-3 px-4 py-2.5 text-[13px] transition-colors ${
                      pathname.startsWith(href)
                        ? 'bg-[#FEF2F2] text-[#DC2626] font-semibold'
                        : 'text-[#374151] hover:bg-[#F8FAFC]'
                    }`}
                  >
                    <Icon size={14} style={{ color: pathname.startsWith(href) ? '#DC2626' : '#9CA3AF' }} />
                    {label}
                  </Link>
                ))}
              </div>

              <div className="border-t border-[#F1F5F9]" />

              {/* Dark mode toggle */}
              <div className="px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {theme === 'dark'
                    ? <Sun size={14} className="text-[#9CA3AF]" />
                    : <Moon size={14} className="text-[#9CA3AF]" />
                  }
                  <span className="text-[13px] text-[#374151]">{t('common.darkMode')}</span>
                </div>
                <button
                  onClick={toggleTheme}
                  className="relative w-10 h-5.5 rounded-full transition-colors flex-shrink-0"
                  style={{
                    background: theme === 'dark' ? '#DC2626' : '#E5E7EB',
                    width: 38, height: 22,
                  }}
                >
                  <span
                    className="absolute top-0.5 rounded-full bg-white shadow-sm transition-transform"
                    style={{
                      width: 18, height: 18,
                      transform: theme === 'dark' ? 'translateX(18px)' : 'translateX(2px)',
                    }}
                  />
                </button>
              </div>

              <div className="border-t border-[#F1F5F9]" />

              {/* Logout */}
              <div className="p-1.5">
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-[13px] font-medium text-[#EF4444] hover:bg-[#FEF2F2] rounded-xl transition-colors"
                >
                  <LogOut size={14} className="text-[#EF4444]" />
                  {t('auth.logout')}
                </button>
              </div>

            </div>
          )}
        </div>
      </div>
    </header>
  )
}

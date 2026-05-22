'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Search, Globe, ChevronDown, LogOut, Sun, Moon, UsersRound } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useTenantContext } from '@/lib/contexts/TenantContext'
import NotificationsPanel from '@/components/ui/NotificationsPanel'
import {
  type Locale,
  LOCALE_FLAGS,
  LOCALE_LABELS,
  getStoredLocale,
  setStoredLocale,
} from '@/lib/i18n'

const DISPLAY_LOCALES: Locale[] = ['fr', 'en', 'ln', 'pt']

export default function Header() {
  const { tenant } = useTenantContext()
  const pathname = usePathname()
  const isOwner = tenant?.role === 'owner'
  const canSeeTeam = isOwner || tenant?.ecoleRole === 'DIRECTION_GENERALE'

  const [userName,     setUserName]     = useState('')
  const [initials,     setInitials]     = useState('U')
  const [logoUrl,      setLogoUrl]      = useState<string | null>(null)
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [langOpen,     setLangOpen]     = useState(false)
  const [locale,       setLocale]       = useState<Locale>('fr')
  const [theme,        setTheme]        = useState<'dark' | 'light'>('light')

  const nomEntreprise = tenant?.nomEntreprise ?? null

  useEffect(() => {
    setLocale(getStoredLocale())
    const stored = localStorage.getItem('oraforme-theme') as 'dark' | 'light' | null
    const effective: 'dark' | 'light' = stored === 'dark' ? 'dark' : 'light'
    setTheme(effective)
    document.body.classList.toggle('light-mode', effective === 'light')
    localStorage.setItem('oraforme-theme', effective)
  }, [])

  useEffect(() => {
    if (!tenant?.tenantId) { setLogoUrl(null); return }
    supabase
      .from('entreprise_config')
      .select('logo_url')
      .eq('tenant_id', tenant.tenantId)
      .maybeSingle()
      .then(({ data }) => setLogoUrl(data?.logo_url || null))

    function onConfigSaved(e: Event) {
      const url = (e as CustomEvent<{ logo_url: string }>).detail?.logo_url
      setLogoUrl(url || null)
    }
    window.addEventListener('oraforme:config-saved', onConfigSaved)
    return () => window.removeEventListener('oraforme:config-saved', onConfigSaved)
  }, [tenant?.tenantId])

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return
      const email = user.email ?? ''
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

  function handleLocaleChange(l: Locale) {
    setLocale(l)
    setStoredLocale(l)
    setLangOpen(false)
    window.location.reload()
  }

  function toggleTheme() {
    const next = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    localStorage.setItem('oraforme-theme', next)
    document.body.classList.toggle('light-mode', next === 'light')
  }

  return (
    <header className="h-14 bg-white border-b border-[#E2E8F0] flex items-center px-4 lg:px-6 gap-3 shrink-0">
      <div className="w-8 lg:hidden shrink-0" />

      <div className="flex-1 max-w-sm">
        <div className="flex items-center gap-2 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg px-3 py-1.5">
          <Search size={13} className="text-[#94A3B8] shrink-0" />
          <input
            placeholder="Rechercher..."
            className="bg-transparent text-sm text-[#0F172A] placeholder-[#94A3B8] outline-none flex-1 w-0 min-w-0"
          />
          <kbd className="hidden sm:block text-[10px] text-[#94A3B8] border border-[#E2E8F0] rounded px-1 shrink-0">⌘K</kbd>
        </div>
      </div>

      {/* Logo entreprise client */}
      {nomEntreprise && (
        logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={logoUrl}
            alt={nomEntreprise}
            className="hidden sm:block shrink-0"
            style={{ width: 180, height: 36, objectFit: 'contain', display: 'block' }}
          />
        ) : (
          <div className="hidden sm:flex items-center gap-2 px-2.5 py-1 rounded-lg bg-amber-50 border border-amber-100 shrink-0">
            <div className="w-5 h-5 rounded-md bg-[#F59E0B] flex items-center justify-center shrink-0">
              <span className="text-[10px] font-black text-white">{nomEntreprise.charAt(0).toUpperCase()}</span>
            </div>
            <span className="text-xs font-semibold text-amber-700 tracking-wide max-w-[140px] truncate">{nomEntreprise}</span>
          </div>
        )
      )}

      {/* Équipe */}
      {canSeeTeam && (
        <Link
          href="/dashboard/equipe"
          className={`hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors shrink-0 ${
            pathname === '/dashboard/equipe'
              ? 'bg-amber-50 text-amber-700'
              : 'text-[#64748B] hover:text-[#0F172A] hover:bg-[#F8FAFC]'
          }`}
        >
          <UsersRound size={14} />
          <span>Équipe</span>
        </Link>
      )}

      <div className="flex items-center gap-1 ml-auto">

        {/* Theme toggle */}
        <button
          onClick={toggleTheme}
          title={theme === 'dark' ? 'Passer en mode clair' : 'Passer en mode sombre'}
          className="p-2 text-[#64748B] hover:text-[#0F172A] transition-colors rounded-lg hover:bg-[#F8FAFC]"
        >
          {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
        </button>

        {/* Language dropdown */}
        <div className="relative">
          <button
            onClick={() => setLangOpen(!langOpen)}
            title="Changer de langue"
            className="p-2 text-[#64748B] hover:text-[#0F172A] transition-colors rounded-lg hover:bg-[#F8FAFC] flex items-center gap-1"
          >
            <Globe size={16} />
            <span className="hidden sm:block text-[10px] font-bold text-[#64748B]">
              {locale.toUpperCase()}
            </span>
          </button>

          {langOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setLangOpen(false)} />
              <div className="absolute right-0 top-full mt-1 w-40 bg-white border border-[#E2E8F0] rounded-xl shadow-lg z-20 py-1 overflow-hidden">
                <p className="text-[9px] font-bold text-[#94A3B8] uppercase tracking-wider px-3 pt-2 pb-1">Langue</p>
                {DISPLAY_LOCALES.map(l => (
                  <button
                    key={l}
                    onClick={() => handleLocaleChange(l)}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm transition-colors text-left ${
                      locale === l
                        ? 'text-amber-700 bg-amber-50'
                        : 'text-[#64748B] hover:text-[#0F172A] hover:bg-[#F8FAFC]'
                    }`}
                  >
                    <span className="text-base">{LOCALE_FLAGS[l]}</span>
                    <span className="text-xs font-medium">{LOCALE_LABELS[l]}</span>
                    {locale === l && (
                      <span className="ml-auto w-1.5 h-1.5 rounded-full bg-amber-500" />
                    )}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        <NotificationsPanel />

        {/* User dropdown */}
        <div className="relative ml-1">
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="flex items-center gap-2 pl-2 pr-1.5 py-1 rounded-lg hover:bg-[#F8FAFC] transition-colors"
          >
            <div className="w-7 h-7 rounded-full bg-amber-100 border border-amber-200 flex items-center justify-center shrink-0">
              <span className="text-amber-700 text-xs font-bold">{initials}</span>
            </div>
            <span className="text-sm text-[#0F172A] hidden sm:block max-w-[96px] truncate">{userName}</span>
            <ChevronDown size={12} className="text-[#94A3B8] hidden sm:block" />
          </button>

          {dropdownOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setDropdownOpen(false)} />
              <div className="absolute right-0 top-full mt-1 w-44 bg-white border border-[#E2E8F0] rounded-lg shadow-lg z-20 py-1">
                <div className="px-3 py-2 border-b border-[#E2E8F0]">
                  <p className="text-xs font-medium text-[#0F172A] truncate">{userName}</p>
                  {nomEntreprise && (
                    <p className="text-[10px] text-[#64748B] truncate">{nomEntreprise}</p>
                  )}
                </div>
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-[#64748B] hover:text-red-500 hover:bg-red-50 transition-colors"
                >
                  <LogOut size={14} />
                  Déconnexion
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  )
}

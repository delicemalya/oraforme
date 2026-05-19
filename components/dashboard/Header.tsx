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
  const [theme,        setTheme]        = useState<'dark' | 'light'>('dark')

  // Company name comes from TenantContext — always in sync with current session
  const nomEntreprise = tenant?.nomEntreprise ?? null

  useEffect(() => {
    setLocale(getStoredLocale())
    const stored = localStorage.getItem('oraforme_theme') as 'dark' | 'light' | null
    const effective: 'dark' | 'light' = stored === 'light' ? 'light' : 'dark'
    setTheme(effective)
    document.documentElement.setAttribute('data-theme', effective)
    localStorage.setItem('oraforme_theme', effective)
  }, [])

  // Company logo — initial fetch + live update via CustomEvent from Paramètres page
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

  // User display name — derived from auth profile (display only, not tenant-sensitive)
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
  }, [tenant?.userId]) // re-run when the logged-in user changes

  async function handleLogout() {
    await supabase.auth.signOut()
    // TenantContext's onAuthStateChange(SIGNED_OUT) triggers window.location.replace('/login').
    // Hard-navigate here as a safety net in case the context fires late.
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
    localStorage.setItem('oraforme_theme', next)
    document.documentElement.setAttribute('data-theme', next)
  }

  return (
    <header className="h-14 bg-[#0f1e3d] border-b border-[#30363D] flex items-center px-4 lg:px-6 gap-3 shrink-0">
      <div className="w-8 lg:hidden shrink-0" />

      <div className="flex-1 max-w-sm">
        <div className="flex items-center gap-2 bg-[#142850] border border-[#30363D] rounded-lg px-3 py-1.5">
          <Search size={13} className="text-[#484F58] shrink-0" />
          <input
            placeholder="Rechercher..."
            className="bg-transparent text-sm text-[#8B949E] placeholder-[#484F58] outline-none flex-1 w-0 min-w-0"
          />
          <kbd className="hidden sm:block text-[10px] text-[#484F58] border border-[#30363D] rounded px-1 shrink-0">⌘K</kbd>
        </div>
      </div>

      {/* Logo entreprise client — après la barre de recherche */}
      {nomEntreprise && (
        logoUrl ? (
          // Logo uploadé : image seule, sans fond ni bordure
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={logoUrl}
            alt={nomEntreprise}
            className="hidden sm:block shrink-0"
            style={{ width: 180, height: 36, objectFit: 'contain', display: 'block' }}
          />
        ) : (
          // Pas de logo : badge texte avec fond jaune
          <div className="hidden sm:flex items-center gap-2 px-2.5 py-1 rounded-lg bg-[#F08900]/10 border border-[#F08900]/20 shrink-0">
            <div className="w-5 h-5 rounded-md bg-[#F08900] flex items-center justify-center shrink-0">
              <span className="text-[10px] font-black text-[#142850]">{nomEntreprise.charAt(0).toUpperCase()}</span>
            </div>
            <span className="text-xs font-semibold text-[#F08900] tracking-wide max-w-[140px] truncate">{nomEntreprise}</span>
          </div>
        )
      )}

      {/* Équipe — déplacé du sidebar vers la navbar */}
      {canSeeTeam && (
        <Link
          href="/dashboard/equipe"
          className={`hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors shrink-0 ${
            pathname === '/dashboard/equipe'
              ? 'bg-[#F08900]/10 text-[#F08900]'
              : 'text-[#8B949E] hover:text-[#FFFFFF] hover:bg-[#1a2d50]'
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
          className="p-2 text-[#484F58] hover:text-[#8B949E] transition-colors rounded-lg hover:bg-[#1a2d50]"
        >
          {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
        </button>

        {/* Language dropdown */}
        <div className="relative">
          <button
            onClick={() => setLangOpen(!langOpen)}
            title="Changer de langue"
            className="p-2 text-[#484F58] hover:text-[#8B949E] transition-colors rounded-lg hover:bg-[#1a2d50] flex items-center gap-1"
          >
            <Globe size={16} />
            <span className="hidden sm:block text-[10px] font-bold text-[#484F58]">
              {locale.toUpperCase()}
            </span>
          </button>

          {langOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setLangOpen(false)} />
              <div className="absolute right-0 top-full mt-1 w-40 bg-[#0f1e3d] border border-[#30363D] rounded-xl shadow-xl z-20 py-1 overflow-hidden">
                <p className="text-[9px] font-bold text-[#484F58] uppercase tracking-wider px-3 pt-2 pb-1">Langue</p>
                {DISPLAY_LOCALES.map(l => (
                  <button
                    key={l}
                    onClick={() => handleLocaleChange(l)}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm transition-colors text-left ${
                      locale === l
                        ? 'text-[#F08900] bg-[#F08900]/5'
                        : 'text-[#8B949E] hover:text-[#FFFFFF] hover:bg-[#1a2d50]'
                    }`}
                  >
                    <span className="text-base">{LOCALE_FLAGS[l]}</span>
                    <span className="text-xs font-medium">{LOCALE_LABELS[l]}</span>
                    {locale === l && (
                      <span className="ml-auto w-1.5 h-1.5 rounded-full bg-[#F08900]" />
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
            className="flex items-center gap-2 pl-2 pr-1.5 py-1 rounded-lg hover:bg-[#1a2d50] transition-colors"
          >
            <div className="w-7 h-7 rounded-full bg-[#F08900]/20 border border-[#F08900]/30 flex items-center justify-center shrink-0">
              <span className="text-[#F08900] text-xs font-bold">{initials}</span>
            </div>
            <span className="text-sm text-[#FFFFFF] hidden sm:block max-w-[96px] truncate">{userName}</span>
            <ChevronDown size={12} className="text-[#484F58] hidden sm:block" />
          </button>

          {dropdownOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setDropdownOpen(false)} />
              <div className="absolute right-0 top-full mt-1 w-44 bg-[#0f1e3d] border border-[#30363D] rounded-lg shadow-xl z-20 py-1">
                <div className="px-3 py-2 border-b border-[#1a2d50]">
                  <p className="text-xs font-medium text-[#FFFFFF] truncate">{userName}</p>
                  {nomEntreprise && (
                    <p className="text-[10px] text-[#484F58] truncate">{nomEntreprise}</p>
                  )}
                </div>
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-[#8B949E] hover:text-red-400 hover:bg-red-500/5 transition-colors"
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

'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Search, ChevronDown, LogOut, Sun, Moon, UsersRound, ChevronLeft } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useTenantContext } from '@/lib/contexts/TenantContext'
import { useLocale } from '@/lib/hooks/useLocale'
import NotificationsPanel from '@/components/ui/NotificationsPanel'
import LanguageSelector from '@/components/ui/LanguageSelector'
import DeviseSelector from '@/components/ui/DeviseSelector'

export default function Header() {
  const { tenant } = useTenantContext()
  const { t } = useLocale()
  const pathname = usePathname()
  const router   = useRouter()
  const isOwner  = tenant?.role === 'owner'

  // Back button: compute parent path from current URL segments
  const segments  = pathname.split('/').filter(Boolean) // e.g. ['dashboard', 'btp', 'chantiers']
  const showBack  = segments.length > 1                 // anything deeper than /dashboard
  const parentPath = '/' + segments.slice(0, -1).join('/')
  const canSeeTeam = isOwner || tenant?.ecoleRole === 'DIRECTION_GENERALE'

  const [userName,     setUserName]     = useState('')
  const [initials,     setInitials]     = useState('U')
  const [logoUrl,      setLogoUrl]      = useState<string | null>(null)
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [theme,        setTheme]        = useState<'dark' | 'light'>('light')

  const nomEntreprise = tenant?.nomEntreprise ?? null

  useEffect(() => {
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

  function toggleTheme() {
    const next = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    localStorage.setItem('oraforme-theme', next)
    document.body.classList.toggle('light-mode', next === 'light')
  }

  return (
    <header className="h-14 bg-white border-b border-[#E2E8F0] flex items-center px-4 lg:px-6 gap-3 shrink-0">
      {showBack ? (
        <button
          onClick={() => router.push(parentPath)}
          title="Retour"
          className="flex items-center justify-center w-8 h-8 rounded-lg text-[#64748B] hover:text-[#0F172A] hover:bg-[#F1F5F9] transition-colors shrink-0"
        >
          <ChevronLeft size={18} />
        </button>
      ) : (
        <div className="w-8 lg:hidden shrink-0" />
      )}

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
          <div className="hidden sm:flex items-center gap-2 px-2.5 py-1 rounded-lg bg-red-50 border border-red-100 shrink-0">
            <div className="w-5 h-5 rounded-md bg-[#DC2626] flex items-center justify-center shrink-0">
              <span className="text-[10px] font-black text-white">{nomEntreprise.charAt(0).toUpperCase()}</span>
            </div>
            <span className="text-xs font-semibold text-red-700 tracking-wide max-w-[140px] truncate">{nomEntreprise}</span>
          </div>
        )
      )}

      {/* Équipe */}
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

      <div className="flex items-center gap-1.5 ml-auto">

        {/* Theme toggle */}
        <button
          onClick={toggleTheme}
          title={theme === 'dark' ? 'Mode clair' : 'Mode sombre'}
          className="p-2 text-[#64748B] hover:text-[#0F172A] transition-colors rounded-lg hover:bg-[#F8FAFC]"
        >
          {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
        </button>

        {/* Sélecteur de pays / devise — géolocalisation IP + persistance localStorage */}
        <DeviseSelector />

        {/* ✅ Sélecteur de langue — 8 langues via LocaleContext (sans reload) */}
        <LanguageSelector />

        <NotificationsPanel />

        {/* User dropdown */}
        <div className="relative ml-1">
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="flex items-center gap-2 pl-1.5 pr-2 py-1 rounded-xl hover:bg-[#F8FAFC] transition-all border border-transparent hover:border-[#E2E8F0]"
          >
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center shrink-0"
              style={{
                background: 'linear-gradient(135deg, #DC2626, #B91C1C)',
                boxShadow: '0 1px 3px rgba(220,38,38,0.35)',
              }}
            >
              <span className="text-white text-[11px] font-bold">{initials}</span>
            </div>
            <span className="text-[13px] text-[#0F172A] font-medium hidden sm:block max-w-[90px] truncate">{userName}</span>
            <ChevronDown size={11} className="text-[#94A3B8] hidden sm:block" />
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
                  {t('auth.logout')}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  )
}

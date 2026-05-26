'use client'

/**
 * LocaleContext — Contexte global i18n pour Oraforme
 * Gère la langue active pour TOUTE l'application.
 * Un seul changement propage partout instantanément.
 */

import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react'
import {
  type Locale,
  SUPPORTED_LOCALES,
  getStoredLocale,
  setStoredLocale,
  t as translate,
} from '@/lib/i18n'

// ─── Types ────────────────────────────────────────────────────────────────────

interface LocaleContextValue {
  locale:          Locale
  setLocale:       (locale: Locale) => void
  t:               (key: string, params?: Record<string, string | number>) => string
  SUPPORTED_LOCALES: readonly Locale[]
}

// ─── Context ──────────────────────────────────────────────────────────────────

const LocaleContext = createContext<LocaleContextValue | null>(null)

// ─── Provider ─────────────────────────────────────────────────────────────────

export function LocaleProvider({ children }: { children: ReactNode }) {
  // Initialise avec 'fr' côté serveur, puis hydrate depuis localStorage
  const [locale, setLocaleState] = useState<Locale>('fr')

  useEffect(() => {
    const stored = getStoredLocale()
    setLocaleState(stored)
    document.documentElement.lang = stored
  }, [])

  const setLocale = useCallback((newLocale: Locale) => {
    setLocaleState(newLocale)
    setStoredLocale(newLocale)
    // Met à jour l'attribut lang du HTML pour l'accessibilité et le SEO
    document.documentElement.lang = newLocale
    // Persister en Supabase si l'utilisateur est connecté (best-effort)
    persistLocaleToProfile(newLocale)
  }, [])

  // Fonction de traduction avec interpolation {{key}}
  const t = useCallback(
    (key: string, params?: Record<string, string | number>): string => {
      let result = translate(key, locale)
      if (params) {
        Object.entries(params).forEach(([k, v]) => {
          result = result.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), String(v))
        })
      }
      return result
    },
    [locale]
  )

  return (
    <LocaleContext.Provider value={{ locale, setLocale, t, SUPPORTED_LOCALES }}>
      {children}
    </LocaleContext.Provider>
  )
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useLocaleContext(): LocaleContextValue {
  const ctx = useContext(LocaleContext)
  if (!ctx) throw new Error('useLocaleContext doit être utilisé dans <LocaleProvider>')
  return ctx
}

// ─── Persistance Supabase (best-effort, sans bloquer) ─────────────────────────

async function persistLocaleToProfile(locale: Locale) {
  try {
    const { createBrowserClient } = await import('@supabase/ssr')
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    await supabase
      .from('profiles')
      .update({ preferred_locale: locale })
      .eq('user_id', user.id)
  } catch {
    // Silencieux — localStorage est la source de vérité
  }
}

'use client'

import { useState, useCallback } from 'react'
import { type Locale, SUPPORTED_LOCALES, getStoredLocale, setStoredLocale, t as translate } from '@/lib/i18n'

export function useLocale() {
  const [locale, setLocaleState] = useState<Locale>(() => getStoredLocale())

  const setLocale = useCallback((newLocale: Locale) => {
    setLocaleState(newLocale)
    setStoredLocale(newLocale)
  }, [])

  const t = useCallback((key: string) => translate(key, locale), [locale])

  return { locale, setLocale, t, SUPPORTED_LOCALES }
}

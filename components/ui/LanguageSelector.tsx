'use client'

import { useState, useRef, useEffect } from 'react'
import { useLocale } from '@/lib/hooks/useLocale'
import { LOCALE_FLAGS, LOCALE_LABELS, type Locale, SUPPORTED_LOCALES } from '@/lib/i18n'
import { motion, AnimatePresence } from 'framer-motion'
import { Globe } from 'lucide-react'

export default function LanguageSelector() {
  const { locale, setLocale } = useLocale()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#161B22] border border-[#30363D] text-[#8B949E] hover:border-[#F0A30A] hover:text-[#E6EDF3] transition-all text-xs font-medium"
        title="Changer de langue"
      >
        <Globe size={13} />
        <span>{LOCALE_FLAGS[locale]}</span>
        <span className="hidden sm:block">{LOCALE_LABELS[locale]}</span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.96 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 top-full mt-1.5 z-50 bg-[#161B22] border border-[#30363D] rounded-xl shadow-2xl overflow-hidden min-w-[160px]"
          >
            {SUPPORTED_LOCALES.map((loc) => (
              <button
                key={loc}
                onClick={() => { setLocale(loc as Locale); setOpen(false) }}
                className={`w-full flex items-center gap-2.5 px-3.5 py-2.5 text-xs text-left transition-colors ${
                  locale === loc
                    ? 'bg-[#F0A30A15] text-[#F0A30A] font-semibold'
                    : 'text-[#8B949E] hover:bg-[#21262D] hover:text-[#E6EDF3]'
                }`}
              >
                <span className="text-base">{LOCALE_FLAGS[loc as Locale]}</span>
                <span>{LOCALE_LABELS[loc as Locale]}</span>
                {locale === loc && <span className="ml-auto text-[#F0A30A]">✓</span>}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

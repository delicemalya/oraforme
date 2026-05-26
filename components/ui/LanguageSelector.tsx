'use client'

/**
 * LanguageSelector — Sélecteur de langue élégant
 * Supporte 8 langues avec drapeaux, animations fluides,
 * sauvegarde localStorage + Supabase profile.
 */

import { useState, useRef, useEffect } from 'react'
import { useLocale } from '@/lib/hooks/useLocale'
import { LOCALE_FLAGS, LOCALE_LABELS, type Locale, SUPPORTED_LOCALES } from '@/lib/i18n'
import { motion, AnimatePresence } from 'framer-motion'
import { Globe, Check } from 'lucide-react'

// Ordre d'affichage souhaité — langues principales en tête
const DISPLAY_ORDER: Locale[] = ['fr', 'en', 'es', 'pt', 'de', 'ln', 'sw', 'kg']

// Langues considérées comme "internationales" (groupe principal)
const INTL_LOCALES = new Set<Locale>(['fr', 'en', 'es', 'pt', 'de'])

export default function LanguageSelector() {
  const { locale, setLocale, t } = useLocale()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  // Fermer en cliquant hors du menu
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Fermer avec Escape
  useEffect(() => {
    function handleEsc(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', handleEsc)
    return () => document.removeEventListener('keydown', handleEsc)
  }, [])

  const handleSelect = (loc: Locale) => {
    setLocale(loc)
    setOpen(false)
  }

  // Langues triées selon DISPLAY_ORDER
  const sortedLocales = [...SUPPORTED_LOCALES].sort(
    (a, b) => DISPLAY_ORDER.indexOf(a) - DISPLAY_ORDER.indexOf(b)
  )

  // Séparer internationales et africaines
  const intlLocales = sortedLocales.filter(l => INTL_LOCALES.has(l))
  const africanLocales = sortedLocales.filter(l => !INTL_LOCALES.has(l))

  return (
    <div ref={ref} className="relative" role="navigation" aria-label={t('lang.select')}>
      {/* Bouton trigger */}
      <button
        onClick={() => setOpen(v => !v)}
        aria-expanded={open}
        aria-haspopup="listbox"
        title={t('lang.select')}
        className={`
          flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium
          border transition-all duration-200 select-none
          ${open
            ? 'bg-[#F59E0B10] border-[#F59E0B] text-[var(--text)]'
            : 'bg-[var(--card-bg)] border-[var(--border)] text-[var(--text-secondary)] hover:border-[#F59E0B60] hover:text-[var(--text)]'
          }
        `}
      >
        <Globe size={12} className="shrink-0" />
        <span className="text-base leading-none" aria-hidden="true">
          {LOCALE_FLAGS[locale]}
        </span>
        <span className="hidden sm:block max-w-[60px] truncate">
          {LOCALE_LABELS[locale]}
        </span>
      </button>

      {/* Menu déroulant */}
      <AnimatePresence>
        {open && (
          <motion.div
            role="listbox"
            aria-label={t('lang.select')}
            initial={{ opacity: 0, y: -8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.96 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className="
              absolute right-0 top-full mt-2 z-[200]
              bg-[var(--card-bg)] border border-[var(--border)]
              rounded-2xl shadow-2xl overflow-hidden
              min-w-[200px]
            "
          >
            {/* En-tête */}
            <div className="px-3.5 pt-3 pb-2 border-b border-[var(--border)]">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--text-secondary)]">
                {t('lang.select')}
              </p>
            </div>

            {/* Groupe : Langues internationales */}
            <div className="px-1.5 pt-1.5">
              <p className="px-2 py-1 text-[9px] font-semibold uppercase tracking-widest text-[var(--text-secondary)] opacity-60">
                International
              </p>
              {intlLocales.map((loc) => (
                <LocaleOption
                  key={loc}
                  loc={loc}
                  active={locale === loc}
                  onSelect={handleSelect}
                />
              ))}
            </div>

            {/* Groupe : Langues africaines */}
            <div className="px-1.5 pb-1.5">
              <p className="px-2 py-1 mt-1 text-[9px] font-semibold uppercase tracking-widest text-[var(--text-secondary)] opacity-60">
                Afrique
              </p>
              {africanLocales.map((loc) => (
                <LocaleOption
                  key={loc}
                  loc={loc}
                  active={locale === loc}
                  onSelect={handleSelect}
                />
              ))}
            </div>

            {/* Footer */}
            <div className="px-3.5 py-2 border-t border-[var(--border)] bg-[var(--border)]">
              <p className="text-[9px] text-[var(--text-secondary)] text-center">
                {SUPPORTED_LOCALES.length} langues disponibles
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── Option individuelle ──────────────────────────────────────────────────────

function LocaleOption({
  loc,
  active,
  onSelect,
}: {
  loc: Locale
  active: boolean
  onSelect: (loc: Locale) => void
}) {
  return (
    <button
      role="option"
      aria-selected={active}
      onClick={() => onSelect(loc)}
      className={`
        w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-xs text-left
        transition-all duration-150 group
        ${active
          ? 'bg-[#F59E0B15] text-[#B45309] font-semibold'
          : 'text-[var(--text-secondary)] hover:bg-[var(--border)] hover:text-[var(--text)]'
        }
      `}
    >
      {/* Drapeau */}
      <span className="text-base leading-none w-5 text-center shrink-0" aria-hidden="true">
        {LOCALE_FLAGS[loc]}
      </span>

      {/* Label */}
      <span className="flex-1 leading-tight">{LOCALE_LABELS[loc]}</span>

      {/* Check actif */}
      {active && (
        <Check size={12} className="text-[#F59E0B] shrink-0" aria-label="Langue active" />
      )}
    </button>
  )
}

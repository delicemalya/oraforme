'use client'

/**
 * useLocale — Hook i18n pour Oraforme
 * Re-exporte depuis LocaleContext pour propagation globale instantanée.
 * Un seul changement de langue met à jour TOUS les composants.
 *
 * Usage:
 *   const { t, locale, setLocale } = useLocale()
 *   t('common.save')                     → 'Save' (en) | 'Guardar' (es)
 *   t('wf.pendingCount', { count: 3 })   → '3 pending'
 */
export { useLocaleContext as useLocale } from '@/lib/contexts/LocaleContext'

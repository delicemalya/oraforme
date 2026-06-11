'use client'

import { useCallback } from 'react'
import { usePays } from '@/lib/contexts/PaysContext'
import { TAUX_REFERENCE } from '@/lib/syscohada/multidevises'

// CFA franc currencies: same value, no conversion needed
const CFA_DEVISES = new Set(['XAF', 'XOF'])

/**
 * Reactive hook for formatting monetary amounts.
 * Re-renders automatically when the user changes country/currency.
 * Converts XAF/FCFA amounts to the current country's currency.
 */
export function useFmt() {
  const { formaterMontant, paysGeo } = usePays()
  const devise = paysGeo.devise

  // fmt: convert from XAF and format with the active currency
  const fmt = useCallback((xafAmount: number) => {
    if (CFA_DEVISES.has(devise)) {
      return formaterMontant(xafAmount)
    }
    const rate = TAUX_REFERENCE[devise]
    if (!rate) return formaterMontant(xafAmount)
    return formaterMontant(Math.round(xafAmount / rate))
  }, [formaterMontant, devise])

  // fmtShort: abbreviated (1 234 567 → "1.2M €")
  const fmtShort = useCallback((xafAmount: number) => {
    let amount = xafAmount
    if (!CFA_DEVISES.has(devise)) {
      const rate = TAUX_REFERENCE[devise]
      if (rate) amount = Math.round(xafAmount / rate)
    }
    const abs = Math.abs(amount)
    const sign = amount < 0 ? '−' : ''
    let num: string
    if (abs >= 1_000_000_000)     num = sign + (abs / 1_000_000_000).toFixed(1) + 'Md'
    else if (abs >= 1_000_000)    num = sign + (abs / 1_000_000).toFixed(1) + 'M'
    else if (abs >= 1_000)        num = sign + (abs / 1_000).toFixed(0) + 'k'
    else                          num = sign + String(Math.round(abs))
    return num + ' ' + devise
  }, [devise])

  return { fmt, fmtShort, devise, paysGeo }
}

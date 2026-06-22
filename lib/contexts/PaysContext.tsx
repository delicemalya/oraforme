'use client'

import { createContext, useContext, ReactNode } from 'react'
import { useGeolocation } from '@/lib/hooks/useGeolocation'
import { getPaysGeo, formaterMontant, PAYS_GEO_LIST, type PaysGeo } from '@/lib/geolocation'
import { PAYS_CONFIGS } from '@/lib/fiscalite/pays'
import type { PaysConfig } from '@/lib/fiscalite/types'

interface PaysContextValue {
  pays: string
  setPays: (code: string) => void
  paysGeo: PaysGeo
  paysFiscal: PaysConfig
  formaterMontant: (montant: number) => string
  calculerTVA: (montantHT: number) => { tva: number; ca: number; ttc: number; taux: number }
  calculerSalaireNet: (brut: number) => { net: number; cnss_salarie: number; irpp: number; total_retenues: number }
  detected: boolean
  loading: boolean
  liste: typeof PAYS_GEO_LIST
}

const PaysContext = createContext<PaysContextValue | null>(null)

function calculerIRPP(baseImposable: number, config: PaysConfig): number {
  const base = baseImposable * (1 - config.irpp.abattement_pct)
  let irpp = 0
  for (const tranche of config.irpp.tranches) {
    if (base <= tranche.min) break
    const montantDansLaTranche = Math.min(base, tranche.max) - tranche.min
    irpp += montantDansLaTranche * tranche.taux
  }
  return Math.round(irpp)
}

export function PaysProvider({ children }: { children: ReactNode }) {
  const { pays, setPays, detected, loading } = useGeolocation()
  const paysGeo = getPaysGeo(pays)
  const fiscalCode = pays === 'CD_USD' ? 'CD' : pays
  const paysFiscal = PAYS_CONFIGS[fiscalCode] ?? PAYS_CONFIGS['CG']

  const fmt = (montant: number) => formaterMontant(montant, pays)

  function calculerTVA(montantHT: number) {
    const taux = paysFiscal.tva.taux_normal
    const tva = montantHT * taux
    // Taxes additionnelles (CA Congo, CAC Cameroun...)
    let taxes_add = 0
    for (const ta of paysFiscal.tva.taxes_additionnelles ?? []) {
      taxes_add += ta.base === 'tva_collectee' ? tva * ta.taux : montantHT * ta.taux
    }
    const ttc = montantHT + tva + taxes_add
    return { tva: Math.round(tva), ca: Math.round(taxes_add), ttc: Math.round(ttc), taux }
  }

  function calculerSalaireNet(brut: number) {
    const plafond = paysFiscal.cnss.plafond_mensuel
    const base_cnss = plafond ? Math.min(brut, plafond) : brut
    const cnss_salarie = Math.round(base_cnss * paysFiscal.cnss.taux_salarie)
    const base_irpp = brut - cnss_salarie
    const irpp = calculerIRPP(base_irpp, paysFiscal)
    const total_retenues = cnss_salarie + irpp
    const net = Math.round(brut - total_retenues)
    return { net, cnss_salarie, irpp, total_retenues }
  }

  return (
    <PaysContext.Provider value={{
      pays, setPays, paysGeo, paysFiscal,
      formaterMontant: fmt,
      calculerTVA, calculerSalaireNet,
      detected, loading,
      liste: PAYS_GEO_LIST,
    }}>
      {children}
    </PaysContext.Provider>
  )
}

export function usePays(): PaysContextValue {
  const ctx = useContext(PaysContext)
  if (!ctx) throw new Error('usePays must be used within PaysProvider')
  return ctx
}

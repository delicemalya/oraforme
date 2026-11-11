'use client'

import { createContext, useContext, ReactNode } from 'react'
import { useGeolocation } from '@/lib/hooks/useGeolocation'
import { getPaysGeo, formaterMontant, PAYS_GEO_LIST, type PaysGeo } from '@/lib/geolocation'
import { PAYS_CONFIGS } from '@/lib/fiscalite/pays'
import { calculerSalaireNetUnifie, calculerTVASurMontantUnifie } from '@/lib/fiscalite/engine-adapter'
import type { PaysConfig, PaysFiscal } from '@/lib/fiscalite/types'

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

export function PaysProvider({ children }: { children: ReactNode }) {
  const { pays, setPays, detected, loading } = useGeolocation()
  const paysGeo = getPaysGeo(pays)
  const fiscalCode = pays === 'CD_USD' ? 'CD' : pays
  const paysFiscal = PAYS_CONFIGS[fiscalCode] ?? PAYS_CONFIGS['CG']

  const fmt = (montant: number) => formaterMontant(montant, pays)

  // Délègue à lib/fiscalite/engine-adapter.ts (Mission P0-FISCAL-CG-2026,
  // 2026-09-18) — même principe que calculerSalaireNet ci-dessous.
  function calculerTVA(montantHT: number) {
    return calculerTVASurMontantUnifie(montantHT, fiscalCode as PaysFiscal)
  }

  // Délègue à lib/fiscalite/engine-adapter.ts (Mission P0-PAIE-CG-2026,
  // 2026-09-18) : moteur central lib/fiscal/universal-tax-engine.ts pour les
  // pays validés (CG/CM/GA/CD/CF/TD/GQ), ancien moteur conservé explicitement
  // pour les 8 pays sans configuration validée. Aucun taux recopié ici.
  function calculerSalaireNet(brut: number) {
    return calculerSalaireNetUnifie(brut, fiscalCode as PaysFiscal)
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

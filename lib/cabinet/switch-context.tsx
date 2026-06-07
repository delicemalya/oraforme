'use client'

/**
 * CabinetSwitchContext — Gère le mode "Entrer dans le compte client"
 *
 * Fonctionne comme Sage Expert / Pennylane Expert :
 * - Le cabinet clique "Entrer dans le compte" d'un client
 * - Une bannière orange apparaît en haut de l'écran
 * - Un bouton "Retour Cabinet" permet de sortir
 * - Les données affichées restent isolées (le cabinet voit les données
 *   du client via cabinet_tenant_id, pas via client_tenant_id)
 */

import { createContext, useContext, useState, useCallback, ReactNode } from 'react'

interface SwitchedClient {
  client_id:      string
  session_token:  string
  nom_entreprise: string
  expires_at:     string
}

interface SwitchContextValue {
  switched:     SwitchedClient | null
  enterClient:  (clientId: string) => Promise<void>
  exitClient:   () => Promise<void>
  isSwitching:  boolean
}

const SwitchContext = createContext<SwitchContextValue>({
  switched:    null,
  enterClient: async () => {},
  exitClient:  async () => {},
  isSwitching: false,
})

export function CabinetSwitchProvider({ children }: { children: ReactNode }) {
  const [switched, setSwitched] = useState<SwitchedClient | null>(() => {
    if (typeof window === 'undefined') return null
    try {
      const raw = localStorage.getItem('_cabinet_switch')
      if (!raw) return null
      const parsed: SwitchedClient = JSON.parse(raw)
      if (new Date(parsed.expires_at) < new Date()) {
        localStorage.removeItem('_cabinet_switch')
        return null
      }
      return parsed
    } catch { return null }
  })
  const [isSwitching, setIsSwitching] = useState(false)

  const enterClient = useCallback(async (clientId: string) => {
    setIsSwitching(true)
    try {
      const res = await fetch('/api/cabinet/switch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ client_id: clientId }),
      })
      if (!res.ok) throw new Error('Erreur ouverture session')
      const data: SwitchedClient = await res.json()
      setSwitched(data)
      localStorage.setItem('_cabinet_switch', JSON.stringify(data))
    } finally {
      setIsSwitching(false)
    }
  }, [])

  const exitClient = useCallback(async () => {
    if (!switched) return
    setIsSwitching(true)
    try {
      await fetch(`/api/cabinet/switch?token=${switched.session_token}`, { method: 'DELETE' })
    } finally {
      setSwitched(null)
      localStorage.removeItem('_cabinet_switch')
      setIsSwitching(false)
    }
  }, [switched])

  return (
    <SwitchContext.Provider value={{ switched, enterClient, exitClient, isSwitching }}>
      {children}
    </SwitchContext.Provider>
  )
}

export function useCabinetSwitch() {
  return useContext(SwitchContext)
}

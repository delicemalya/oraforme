'use client'

import {
  createContext, useContext, useCallback, useTransition,
  type ReactNode,
} from 'react'
import { useRouter } from 'next/navigation'

export type RefreshTrigger = 'realtime' | 'user-action' | 'auth-change' | 'post-save'

interface RefreshContextValue {
  refreshRoute:  (trigger: RefreshTrigger) => void
  refreshTenant: (trigger: RefreshTrigger) => void
  refreshAll:    (trigger: RefreshTrigger) => void
  isPending:     boolean
}

const RefreshContext = createContext<RefreshContextValue | null>(null)

export function RefreshOrchestratorProvider({
  children,
  onRefreshTenant,
}: {
  children:         ReactNode
  onRefreshTenant?: () => void
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  // startTransition guarantees loading.tsx (Suspense fallback) is never triggered
  const refreshRoute = useCallback((_trigger: RefreshTrigger) => {
    startTransition(() => { router.refresh() })
  }, [router])

  const refreshTenant = useCallback((_trigger: RefreshTrigger) => {
    onRefreshTenant?.()
  }, [onRefreshTenant])

  const refreshAll = useCallback((_trigger: RefreshTrigger) => {
    onRefreshTenant?.()
    startTransition(() => { router.refresh() })
  }, [router, onRefreshTenant])

  return (
    <RefreshContext.Provider value={{ refreshRoute, refreshTenant, refreshAll, isPending }}>
      {children}
    </RefreshContext.Provider>
  )
}

export function useRefresh(): RefreshContextValue {
  const ctx = useContext(RefreshContext)
  if (!ctx) throw new Error('useRefresh must be used inside RefreshOrchestratorProvider')
  return ctx
}

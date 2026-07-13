'use client'

import { useEffect } from 'react'
import { TenantProvider, useTenantContext } from '@/lib/contexts/TenantContext'
import { RefreshOrchestratorProvider } from '@/lib/refresh/RefreshOrchestrator'
import { usePays } from '@/lib/contexts/PaysContext'
import type { ReactNode } from 'react'

function InnerShell({ children }: { children: ReactNode }) {
  const { tenant, reload } = useTenantContext()
  const { pays, setPays }   = usePays()

  useEffect(() => {
    if (tenant?.pays && tenant.pays !== pays) setPays(tenant.pays)
  }, [tenant?.pays]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <RefreshOrchestratorProvider onRefreshTenant={reload}>
      {children}
    </RefreshOrchestratorProvider>
  )
}

/**
 * Client wrapper: provides TenantContext + RefreshOrchestrator to the whole dashboard.
 * RefreshOrchestrator is nested inside TenantProvider so it can wire tenant.reload().
 */
export default function DashboardShell({ children }: { children: ReactNode }) {
  return (
    <TenantProvider>
      <InnerShell>{children}</InnerShell>
    </TenantProvider>
  )
}

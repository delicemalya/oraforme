'use client'

import { useEffect } from 'react'
import { TenantProvider, useTenantContext } from '@/lib/contexts/TenantContext'
import { usePays } from '@/lib/contexts/PaysContext'
import type { ReactNode } from 'react'

// Syncs tenant.pays (stored in DB) into PaysContext so fiscal data matches
// the tenant's country regardless of geolocation/localStorage.
function PaysSync() {
  const { tenant } = useTenantContext()
  const { pays, setPays } = usePays()

  useEffect(() => {
    if (tenant?.pays && tenant.pays !== pays) {
      setPays(tenant.pays)
    }
  }, [tenant?.pays]) // eslint-disable-line react-hooks/exhaustive-deps

  return null
}

/**
 * Client-side wrapper that provides TenantContext to the entire dashboard.
 * Placed here (not in the server layout) so the server component can still
 * run server-side auth checks while the client gets reactive tenant state.
 */
export default function DashboardShell({ children }: { children: ReactNode }) {
  return (
    <TenantProvider>
      <PaysSync />
      {children}
    </TenantProvider>
  )
}

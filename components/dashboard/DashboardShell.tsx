'use client'

import { TenantProvider } from '@/lib/contexts/TenantContext'
import type { ReactNode } from 'react'

/**
 * Client-side wrapper that provides TenantContext to the entire dashboard.
 * Placed here (not in the server layout) so the server component can still
 * run server-side auth checks while the client gets reactive tenant state.
 */
export default function DashboardShell({ children }: { children: ReactNode }) {
  return <TenantProvider>{children}</TenantProvider>
}

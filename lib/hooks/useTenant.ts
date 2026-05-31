'use client'

import { useTenantContext } from '@/lib/contexts/TenantContext'

/**
 * Thin wrapper around TenantContext — preserves the existing call signature
 * (`tenantId`, `role`, `isOwner`, `loading`) so consumers don't need changes.
 * State is now reactive to auth changes (cross-tab, account switching) via TenantContext.
 */
export function useTenant() {
  const { tenant, loading } = useTenantContext()

  return {
    tenantId:      tenant?.tenantId      ?? null,
    role:          tenant?.role          ?? null,
    isOwner:       tenant?.role === 'owner',
    loading,
    prenom:        tenant?.prenom        ?? null,
    nom:           tenant?.nom           ?? null,
    nomEntreprise: tenant?.nomEntreprise ?? null,
  }
}

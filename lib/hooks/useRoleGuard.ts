'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useTenantContext } from '@/lib/contexts/TenantContext'

export type EcoleRole =
  | 'DIRECTION_GENERALE'
  | 'RAF'
  | 'DAAC'
  | 'RH_PAIE'
  | 'SCOLARITE'
  | 'FORMATEUR'
  | 'ETUDIANT'
  | 'PARENT'
  | 'DTI'
  | 'COMPTABLE'
  | 'COMMERCIAL'
  | 'MAGASINIER'
  | 'CAISSIER'
  | 'CHEF_CUISINE'
  | 'SERVEUR'
  | 'RECEPTIONNISTE'
  | 'GOUVERNANTE'
  | 'DISPATCHER'
  | 'CHAUFFEUR'
  | 'COLLABORATEUR'

/**
 * Client-side route guard for role-protected pages.
 * Lit depuis TenantContext (réactif aux changements d'auth cross-tab).
 * Redirects to `fallbackPath` if the user's ecole_role is not in `allowedRoles`.
 * Owners always pass.
 */
export function useRoleGuard(
  allowedRoles: EcoleRole[],
  fallbackPath = '/dashboard/ecole'
) {
  const router = useRouter()
  const { tenant, loading } = useTenantContext()

  useEffect(() => {
    if (loading) return

    if (!tenant) {
      router.replace('/login')
      return
    }

    // Owners always pass
    if (tenant.role === 'owner') return

    const ecoleRole = tenant.ecoleRole as EcoleRole | null
    if (!ecoleRole || !allowedRoles.includes(ecoleRole)) {
      router.replace(fallbackPath)
    }
  }, [tenant, loading, allowedRoles, fallbackPath, router])
}

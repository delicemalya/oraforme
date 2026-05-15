'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

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
 * Redirects to `fallbackPath` if the user's ecole_role is not in `allowedRoles`.
 * Owners always pass. Call at the top of a page component.
 *
 * Usage:
 *   useRoleGuard(['DIRECTION_GENERALE', 'RAF'])
 *   useRoleGuard(['ETUDIANT'], '/dashboard/ecole')
 */
export function useRoleGuard(
  allowedRoles: EcoleRole[],
  fallbackPath = '/dashboard/ecole'
) {
  const router = useRouter()

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { router.replace('/login'); return }

      const { data: profile } = await supabase
        .from('profiles')
        .select('role, ecole_role_name')
        .eq('user_id', user.id)
        .maybeSingle()

      if (!profile) { router.replace('/login'); return }

      // Owners always pass
      if (profile.role === 'owner') return

      const ecoleRole = profile.ecole_role_name as EcoleRole | null
      if (!ecoleRole || !allowedRoles.includes(ecoleRole)) {
        router.replace(fallbackPath)
      }
    })
  }, [allowedRoles, fallbackPath, router])
}

'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { UserRole } from './usePermissions'

export function useTenant() {
  const [tenantId, setTenantId] = useState<string | null>(null)
  const [role,     setRole]     = useState<UserRole | null>(null)
  const [loading,  setLoading]  = useState(true)

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { setLoading(false); return }
      const { data } = await supabase
        .from('profiles')
        .select('tenant_id, role')
        .eq('user_id', user.id)
        .maybeSingle()
      setTenantId(data?.tenant_id ?? null)
      setRole((data?.role as UserRole) ?? null)
      setLoading(false)
    })
  }, [])

  return { tenantId, role, isOwner: role === 'owner', loading }
}

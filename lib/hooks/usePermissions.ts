'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useTenantContext } from '@/lib/contexts/TenantContext'

export type UserRole = 'owner' | 'admin' | 'membre'

export interface ModulePermission {
  can_view:   boolean
  can_edit:   boolean
  can_delete: boolean
}

export interface UsePermissionsResult {
  role:        UserRole | null
  profileId:   string | null
  isOwner:     boolean
  isAdmin:     boolean
  isFinancial: boolean
  dynamicRoleName: string | null
  permissions: Record<string, ModulePermission>
  can: (moduleKey: string, action?: 'view' | 'edit' | 'delete') => boolean
  loading:     boolean
}

export function usePermissions(): UsePermissionsResult {
  const { tenant, loading: tenantLoading } = useTenantContext()

  const [isFinancial,     setIsFinancial]     = useState(false)
  const [dynamicRoleName, setDynamicRoleName] = useState<string | null>(null)
  const [permissions,     setPermissions]     = useState<Record<string, ModulePermission>>({})
  const [loading,         setLoading]         = useState(true)

  useEffect(() => {
    if (tenantLoading) return

    if (!tenant) {
      setIsFinancial(false)
      setDynamicRoleName(null)
      setPermissions({})
      setLoading(false)
      return
    }

    // Owner → accès total, pas besoin de charger les permissions
    if (tenant.role === 'owner') {
      setIsFinancial(true)
      setLoading(false)
      return
    }

    let cancelled = false

    async function loadPerms() {
      setLoading(true)
      const permMap: Record<string, ModulePermission> = {}

      // Récupérer le dynamic_role_id depuis le profil — scoped to the correct
      // tenant so multi-tenant users get the right role assignment.
      const { data: profile } = await supabase
        .from('profiles')
        .select('dynamic_role_id')
        .eq('user_id', tenant!.userId)
        .eq('tenant_id', tenant!.tenantId)
        .maybeSingle()

      if (profile?.dynamic_role_id && !cancelled) {
        const [{ data: roleData }, { data: rolePerms }] = await Promise.all([
          supabase
            .from('roles')
            .select('name, is_financial')
            .eq('id', profile.dynamic_role_id)
            .maybeSingle(),
          supabase
            .from('role_permissions')
            .select('module_key, can_view, can_edit, can_delete')
            .eq('role_id', profile.dynamic_role_id),
        ])

        if (!cancelled) {
          if (roleData) {
            setIsFinancial(roleData.is_financial ?? false)
            setDynamicRoleName(roleData.name)
          }
          for (const p of rolePerms ?? []) {
            permMap[p.module_key] = {
              can_view:   p.can_view,
              can_edit:   p.can_edit,
              can_delete: p.can_delete,
            }
          }
        }
      }

      // Fusionner avec les permissions directes
      const { data: directPerms } = await supabase
        .from('user_permissions')
        .select('module_key, can_view, can_edit, can_delete')
        .eq('profile_id', tenant!.profileId)

      if (!cancelled) {
        for (const p of directPerms ?? []) {
          permMap[p.module_key] = {
            can_view:   p.can_view,
            can_edit:   p.can_edit,
            can_delete: p.can_delete,
          }
        }
        setPermissions(permMap)
        setLoading(false)
      }
    }

    loadPerms()
    return () => { cancelled = true }
  }, [tenant?.userId, tenant?.profileId, tenant?.role, tenantLoading])

  const role    = tenant?.role ?? null
  const profileId = tenant?.profileId ?? null

  const can = useCallback(
    (moduleKey: string, action: 'view' | 'edit' | 'delete' = 'view'): boolean => {
      if (role === 'owner') return true
      const p = permissions[moduleKey]
      if (!p) return false
      if (action === 'view')   return p.can_view
      if (action === 'edit')   return p.can_edit
      if (action === 'delete') return p.can_delete
      return false
    },
    [role, permissions]
  )

  return {
    role,
    profileId,
    isOwner:     role === 'owner',
    isAdmin:     role === 'admin',
    isFinancial,
    dynamicRoleName,
    permissions,
    can,
    loading: tenantLoading || loading,
  }
}

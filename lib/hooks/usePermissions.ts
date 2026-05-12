'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'

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
  /** true si le rôle dynamique de l'utilisateur a accès aux données financières */
  isFinancial: boolean
  /** Nom du rôle dynamique (ex: "Direction Générale", "RAF", "Scolarité") */
  dynamicRoleName: string | null
  permissions: Record<string, ModulePermission>
  can: (moduleKey: string, action?: 'view' | 'edit' | 'delete') => boolean
  loading:     boolean
}

export function usePermissions(): UsePermissionsResult {
  const [role,            setRole]            = useState<UserRole | null>(null)
  const [profileId,       setProfileId]       = useState<string | null>(null)
  const [isFinancial,     setIsFinancial]     = useState(false)
  const [dynamicRoleName, setDynamicRoleName] = useState<string | null>(null)
  const [permissions,     setPermissions]     = useState<Record<string, ModulePermission>>({})
  const [loading,         setLoading]         = useState(true)

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { setLoading(false); return }

      const { data: profile } = await supabase
        .from('profiles')
        .select('id, role, dynamic_role_id')
        .eq('user_id', user.id)
        .maybeSingle()

      if (!profile) { setLoading(false); return }

      setRole(profile.role as UserRole)
      setProfileId(profile.id)

      // Owner → accès total, pas besoin de charger les permissions
      if (profile.role === 'owner') {
        setIsFinancial(true)
        setLoading(false)
        return
      }

      const permMap: Record<string, ModulePermission> = {}

      // ── Résolution des permissions : rôle dynamique en priorité ──────────────
      if (profile.dynamic_role_id) {
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

      // ── Fusionner avec les permissions directes (user_permissions) ────────────
      // Les permissions directes peuvent étendre ou restreindre le rôle
      const { data: directPerms } = await supabase
        .from('user_permissions')
        .select('module_key, can_view, can_edit, can_delete')
        .eq('profile_id', profile.id)

      for (const p of directPerms ?? []) {
        permMap[p.module_key] = {
          can_view:   p.can_view,
          can_edit:   p.can_edit,
          can_delete: p.can_delete,
        }
      }

      setPermissions(permMap)
      setLoading(false)
    })
  }, [])

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
    loading,
  }
}

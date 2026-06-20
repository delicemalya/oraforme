'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useTenantContext } from '@/lib/contexts/TenantContext'
import { canAccessByPlan } from '@/lib/plan-access'

export type UserRole = 'owner' | 'admin' | 'membre'

// ─── Granular permission type ─────────────────────────────────────────────────

export interface ModulePermission {
  can_view:     boolean
  can_edit:     boolean
  can_delete:   boolean
  can_export:   boolean   // export PDF/Excel
  can_validate: boolean   // valider une écriture, facture, etc.
  can_approve:  boolean   // approuver un budget, un achat, etc.
}

export type PermAction = 'view' | 'edit' | 'delete' | 'export' | 'validate' | 'approve'

// ─── Full hook result ─────────────────────────────────────────────────────────

export interface UsePermissionsResult {
  role:            UserRole | null
  profileId:       string | null
  isOwner:         boolean
  isAdmin:         boolean
  isFinancial:     boolean
  dynamicRoleName: string | null
  permissions:     Record<string, ModulePermission>
  can:             (moduleKey: string, action?: PermAction) => boolean
  canView:         (moduleKey: string) => boolean
  canEdit:         (moduleKey: string) => boolean
  canDelete:       (moduleKey: string) => boolean
  canExport:       (moduleKey: string) => boolean
  canValidate:     (moduleKey: string) => boolean
  canApprove:      (moduleKey: string) => boolean
  loading:         boolean
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

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

    if (tenant.role === 'owner') {
      setIsFinancial(true)
      setLoading(false)
      return
    }

    let cancelled = false

    async function loadPerms() {
      setLoading(true)
      const permMap: Record<string, ModulePermission> = {}

      // ── 1. Rôle dynamique — scopé au tenant courant (CRITICAL FIX) ──────────
      const { data: profile } = await supabase
        .from('profiles')
        .select('dynamic_role_id')
        .eq('user_id', tenant!.userId)
        .eq('tenant_id', tenant!.tenantId)
        .order('created_at', { ascending: true })
        .limit(1)
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
            .select('module_key, can_view, can_edit, can_delete, can_export, can_validate, can_approve')
            .eq('role_id', profile.dynamic_role_id),
        ])

        if (!cancelled) {
          if (roleData) {
            setIsFinancial(roleData.is_financial ?? false)
            setDynamicRoleName(roleData.name)
          }
          for (const p of rolePerms ?? []) {
            permMap[p.module_key] = {
              can_view:     p.can_view     ?? false,
              can_edit:     p.can_edit     ?? false,
              can_delete:   p.can_delete   ?? false,
              can_export:   p.can_export   ?? false,
              can_validate: p.can_validate ?? false,
              can_approve:  p.can_approve  ?? false,
            }
          }
        }
      }

      // ── 2. Permissions directes (override individuel) ────────────────────────
      const { data: directPerms } = await supabase
        .from('user_permissions')
        .select('module_key, can_view, can_edit, can_delete, can_export, can_validate, can_approve')
        .eq('profile_id', tenant!.profileId)

      if (!cancelled) {
        for (const p of directPerms ?? []) {
          const existing = permMap[p.module_key] ?? {
            can_view: false, can_edit: false, can_delete: false,
            can_export: false, can_validate: false, can_approve: false,
          }
          permMap[p.module_key] = {
            can_view:     p.can_view     ?? existing.can_view,
            can_edit:     p.can_edit     ?? existing.can_edit,
            can_delete:   p.can_delete   ?? existing.can_delete,
            can_export:   p.can_export   ?? existing.can_export,
            can_validate: p.can_validate ?? existing.can_validate,
            can_approve:  p.can_approve  ?? existing.can_approve,
          }
        }
        setPermissions(permMap)
        setLoading(false)
      }
    }

    loadPerms()
    return () => { cancelled = true }
  }, [tenant, tenantLoading])

  const role      = tenant?.role      ?? null
  const profileId = tenant?.profileId ?? null
  const taille    = tenant?.taille    ?? null

  const can = useCallback(
    (moduleKey: string, action: PermAction = 'view'): boolean => {
      // Plan check TOUJOURS en premier — le propriétaire respecte son abonnement
      if (!canAccessByPlan(taille, moduleKey)) return false
      // Owner : toutes les actions autorisées dans son plan
      if (role === 'owner') return true
      const p = permissions[moduleKey]
      if (!p) return false
      switch (action) {
        case 'view':     return p.can_view
        case 'edit':     return p.can_edit
        case 'delete':   return p.can_delete
        case 'export':   return p.can_export
        case 'validate': return p.can_validate
        case 'approve':  return p.can_approve
        default:         return false
      }
    },
    [role, permissions, taille]
  )

  const canView     = useCallback((m: string) => can(m, 'view'),     [can])
  const canEdit     = useCallback((m: string) => can(m, 'edit'),     [can])
  const canDelete   = useCallback((m: string) => can(m, 'delete'),   [can])
  const canExport   = useCallback((m: string) => can(m, 'export'),   [can])
  const canValidate = useCallback((m: string) => can(m, 'validate'), [can])
  const canApprove  = useCallback((m: string) => can(m, 'approve'),  [can])

  return {
    role,
    profileId,
    isOwner:     role === 'owner',
    isAdmin:     role === 'admin',
    isFinancial,
    dynamicRoleName,
    permissions,
    can,
    canView,
    canEdit,
    canDelete,
    canExport,
    canValidate,
    canApprove,
    loading: tenantLoading || loading,
  }
}

'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useTenantContext } from '@/lib/contexts/TenantContext'

export interface EntityNode {
  tenantId:          string
  parentTenantId:    string | null
  nomEntreprise:     string
  typeEntite:        string
  codeGroupe:        string | null
  allowConsolidation: boolean
  ordreAffichage:    number
  depth:             number
  path:              string | null
}

interface UseEntityHierarchyResult {
  tree:    EntityNode[]
  loading: boolean
  error:   string | null
  reload:  () => void
}

export function useEntityHierarchy(): UseEntityHierarchyResult {
  const { tenant } = useTenantContext()
  const [tree,    setTree]    = useState<EntityNode[]>([])
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState<string | null>(null)

  const isHierarchical = tenant?.typeEntite !== 'standalone' && tenant?.typeEntite !== undefined

  const loadTree = useCallback(async () => {
    if (!tenant?.tenantId || !isHierarchical) {
      setTree([])
      return
    }
    setLoading(true)
    setError(null)
    try {
      const { data, error: err } = await supabase
        .from('v_entity_tree')
        .select('tenant_id, parent_tenant_id, nom_entreprise, type_entite, code_groupe, allow_consolidation, ordre_affichage, depth, path')
        .order('depth',            { ascending: true })
        .order('ordre_affichage',  { ascending: true })
        .order('nom_entreprise',   { ascending: true })

      if (err) throw err

      setTree(
        (data ?? []).map(r => ({
          tenantId:          r.tenant_id,
          parentTenantId:    r.parent_tenant_id,
          nomEntreprise:     r.nom_entreprise,
          typeEntite:        r.type_entite,
          codeGroupe:        r.code_groupe,
          allowConsolidation: r.allow_consolidation,
          ordreAffichage:    r.ordre_affichage,
          depth:             r.depth,
          path:              r.path,
        }))
      )
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur chargement hiérarchie')
    } finally {
      setLoading(false)
    }
  }, [tenant?.tenantId, isHierarchical])

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { loadTree() }, [loadTree])

  return { tree, loading, error, reload: loadTree }
}

/** Returns ancestors of a given tenantId from the flat tree array */
export function getAncestors(tree: EntityNode[], tenantId: string): EntityNode[] {
  const node = tree.find(n => n.tenantId === tenantId)
  if (!node || !node.parentTenantId) return []
  const parent = tree.find(n => n.tenantId === node.parentTenantId)
  if (!parent) return []
  return [...getAncestors(tree, parent.tenantId), parent]
}

/** Returns direct children of a given tenantId */
export function getChildren(tree: EntityNode[], parentId: string): EntityNode[] {
  return tree.filter(n => n.parentTenantId === parentId)
}

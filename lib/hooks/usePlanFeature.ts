'use client'

import { useTenant } from './useTenant'
import { canAccessFeature, getRequiredFeaturePlan, type FeatureId } from '@/lib/feature-access'

export interface PlanFeatureResult {
  allowed:      boolean
  requiredPlan: 'pme' | 'grande' | null
  taille:       string | null
  isEntrepreneur: boolean
  isBusiness:     boolean
  isEnterprise:   boolean
}

/**
 * Hook de contrôle d'accès aux fonctionnalités par plan.
 * À utiliser dans les pages et composants pour gater les features avancées.
 *
 * Usage:
 *   const { allowed } = usePlanFeature('audit-ohada')
 *   if (!allowed) return <PlanFeatureGate feature="audit-ohada" />
 */
export function usePlanFeature(featureId: FeatureId | string): PlanFeatureResult {
  const { taille } = useTenant()

  return {
    allowed:        canAccessFeature(taille, featureId),
    requiredPlan:   getRequiredFeaturePlan(taille, featureId),
    taille,
    isEntrepreneur: taille === 'tpe',
    isBusiness:     taille === 'pme',
    isEnterprise:   taille === 'grande',
  }
}

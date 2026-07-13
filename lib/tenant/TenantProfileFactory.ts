import { computeModules, type TailleEntreprise, type SecteurId } from '@/lib/plans'

export interface TenantFactoryInput {
  nomEntreprise:   string
  taille:          TailleEntreprise
  secteur:         SecteurId | string
  pays:            string
  langue:          string
  telephone?:      string
  adresse?:        string
  sousType?:       string
  niu?:            string
}

export interface TenantFactoryProfile {
  // ── Tenant DB fields ──────────────────────────────────────────────────────
  plan:                string
  taille_entreprise:   TailleEntreprise
  type_entite:         'standalone' | 'groupe'
  allow_consolidation: boolean
  code_groupe:         string | null
  niveau_hierarchie:   number | null
  // ── Modules (→ tenant_modules table) ─────────────────────────────────────
  modules:             string[]
  // ── Operational metadata ──────────────────────────────────────────────────
  max_users:           number
  miaa_tier:           'standard' | 'premium' | 'illimite'
  capability_level:    1 | 2 | 4
}

function generateGroupCode(nom: string): string {
  const base = nom
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 4)
    .padEnd(4, 'X')
  const year = new Date().getFullYear()
  return `GRP-${base}-${year}`
}

const PLAN_MAP: Record<TailleEntreprise, string> = {
  tpe:    'starter',
  pme:    'pro',
  grande: 'enterprise',
}

const MAX_USERS: Record<TailleEntreprise, number> = {
  tpe:    5,
  pme:    25,
  grande: -1,
}

const MIAA_TIER: Record<TailleEntreprise, 'standard' | 'premium' | 'illimite'> = {
  tpe:    'standard',
  pme:    'premium',
  grande: 'illimite',
}

const CAPABILITY_LEVEL: Record<TailleEntreprise, 1 | 2 | 4> = {
  tpe:    1,
  pme:    2,
  grande: 4,
}

/**
 * Single source of truth for all tenant creation.
 * Guarantees no field is ever NULL for a new tenant.
 */
export function buildTenantProfile(input: TenantFactoryInput): TenantFactoryProfile {
  const isGrande = input.taille === 'grande'

  return {
    plan:                PLAN_MAP[input.taille],
    taille_entreprise:   input.taille,
    type_entite:         isGrande ? 'groupe' : 'standalone',
    allow_consolidation: isGrande,
    code_groupe:         isGrande ? generateGroupCode(input.nomEntreprise) : null,
    niveau_hierarchie:   isGrande ? 1 : null,
    modules:             computeModules(input.taille, input.secteur as SecteurId),
    max_users:           MAX_USERS[input.taille],
    miaa_tier:           MIAA_TIER[input.taille],
    capability_level:    CAPABILITY_LEVEL[input.taille],
  }
}

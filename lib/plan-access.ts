/**
 * lib/plan-access.ts — Contrôle d'accès par plan (Entrepreneur / Business / Entreprise+)
 *
 * Règle : les modules sont cumulatifs vers le haut.
 *   tpe   (Entrepreneur) — modules de base
 *   pme   (Business)     — tout tpe + modules avancés
 *   grande (Entreprise+) — tout pme + analytics, audit complet, API
 */

import type { TailleEntreprise } from './plans'

// ── Modules réservés Business (pme) et au-dessus ──────────────────────────────
// Un compte Entrepreneur ne doit PAS voir ces modules
const REQUIRES_PME = new Set([
  // Gestion avancée
  'comptabilite', 'fiscalite', 'stock', 'achats',
  'workflows', 'roles', 'ged', 'mobilemoney',
  // MIAA+ avancé
  'academy',
  // Audit & conformité (sous-modules)
  'audit-comptable', 'audit-financier', 'audit-fiscal',
  'audit-rh', 'audit-ci', 'audit-risques', 'audit-ohada',
  'audit-plans', 'audit-rapports',
])

// ── Modules réservés Entreprise+ (grande) uniquement ─────────────────────────
const REQUIRES_GRANDE = new Set([
  // BI & Analytics
  'bi', 'bi-dg', 'bi-rh', 'bi-ecole', 'bi-hotel', 'bi-restaurant',
  'analytics', 'finance',
  // Administration avancée
  'audit',        // audit module principal (le hub)
  'api-keys',
  'direction',    // KPIs exécutifs Direction Générale
])

// ── Modules TOUJOURS visibles (peu importe le plan) ───────────────────────────
const ALWAYS_VISIBLE = new Set([
  'facturation', 'crm', 'tresorerie', 'rh', 'depenses',
  'taches', 'calendrier', 'notifications', 'parametres', 'profil',
  'devis', 'equipe', 'recouvrement', 'rapports',
  // Navigation essentielle
  'abonnement', 'bizbot',
  // Modules secteur — toujours visibles dans leur contexte
  'ecole-direction', 'ecole-rh', 'ecole-comptabilite', 'scolarite',
  'daac', 'espace-formateur', 'espace-etudiant', 'espace-parent',
  'parametres-academiques', 'ecole-miaa',
  'restaurant', 'cuisine', 'resto-direction', 'resto-reservations',
  'resto-livraisons', 'resto-formules', 'resto-inventaire', 'resto-miaa',
  'sante', 'sante-patients', 'sante-rdv', 'sante-consultations',
  'sante-urgences', 'sante-hospitalisation', 'sante-labo', 'sante-imagerie',
  'sante-bloc', 'sante-pharmacie', 'sante-facturation', 'sante-assurances',
  'sante-medecins', 'sante-rh', 'sante-direction', 'sante-miaa',
  'hotel', 'hotel-reservations', 'housekeeping', 'hotel-maintenance', 'hotel-miaa',
  'pharmacie', 'pharmacie-meds', 'pharmacie-ventes',
  'transport', 'transport_public',
  'btp', 'btp-devis', 'btp-chantiers', 'btp-materiaux',
  'banque', 'banque-clients', 'banque-credits', 'banque-epargne', 'banque-operations',
  'cabinet', 'cabinet-clients', 'cabinet-declarations', 'cabinet-documents',
  'cabinet-taches', 'cabinet-projets',
  'agriculture', 'agriculture-parcelles', 'agriculture-recoltes', 'agriculture-intrants',
  'ong', 'ong-projets', 'ong-dons',
  'boisson', 'boisson-tournees',
  'petrole', 'petrole-sites',
])

/**
 * Retourne true si un module est accessible pour ce plan.
 * Règle de sécurité : en cas de doute (taille null), on laisse passer
 * pour ne pas casser les tenants legacy.
 */
export function canAccessByPlan(
  taille: TailleEntreprise | string | null | undefined,
  moduleId: string,
): boolean {
  // Toujours visible → pas de restriction plan
  if (ALWAYS_VISIBLE.has(moduleId)) return true

  // Pas de plan connu → legacy, on laisse passer
  if (!taille) return true

  // Entreprise+ → tout est accessible
  if (taille === 'grande') return true

  // Business → bloque uniquement les modules Entreprise+
  if (taille === 'pme') return !REQUIRES_GRANDE.has(moduleId)

  // Entrepreneur (tpe) → bloque Business ET Entreprise+
  return !REQUIRES_PME.has(moduleId) && !REQUIRES_GRANDE.has(moduleId)
}

/**
 * Retourne le niveau numérique du plan (0=tpe, 1=pme, 2=grande)
 * Utile pour des comparaisons simples.
 */
export function getPlanLevel(taille: string | null | undefined): 0 | 1 | 2 {
  if (taille === 'grande') return 2
  if (taille === 'pme')    return 1
  return 0
}

/**
 * Label à afficher dans les bandeaux "upgrade"
 */
export function getPlanUpgradeLabel(requiredTaille: TailleEntreprise): string {
  return requiredTaille === 'grande' ? 'Entreprise+' : 'Business'
}

/**
 * Retourne le plan requis pour un module, ou null si accessible au plan actuel.
 * Utile pour afficher le bandeau d'upgrade dans la sidebar.
 */
export function getRequiredPlan(
  taille: string | null | undefined,
  moduleId: string,
): 'pme' | 'grande' | null {
  // Already accessible
  if (canAccessByPlan(taille, moduleId)) return null

  // What plan unlocks it?
  if (REQUIRES_GRANDE.has(moduleId)) return 'grande'
  if (REQUIRES_PME.has(moduleId))    return 'pme'
  return null
}

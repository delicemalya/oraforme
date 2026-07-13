/**
 * lib/plan-access.ts — Contrôle d'accès par plan (Entrepreneur / Business / Compagnie)
 *
 * Trois plans vendus :
 *   tpe    (Entrepreneur) — modules de base
 *   pme    (Business)     — tpe + avancés + analytics/BI/audit
 *   grande (Compagnie)    — tout débloqué + groupe/multi-entités
 */

import type { TailleEntreprise } from './plans'

// ── Modules réservés Business (pme) et au-dessus ──────────────────────────────
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

// ── Modules réservés Business ET Compagnie (bloqués pour tpe uniquement) ──────
const REQUIRES_GRANDE = new Set([
  // BI & Analytics
  'bi', 'bi-dg', 'bi-rh', 'bi-ecole', 'bi-hotel', 'bi-restaurant',
  'analytics', 'finance',
  // Administration avancée
  'audit',        // audit module principal (le hub)
  'api-keys',
  'direction',    // KPIs exécutifs Direction Générale
])

// ── Modules exclusifs Compagnie (grande) — bloqués pour tpe ET pme ────────────
// N4 — Architecture Multi-Entités (toujours exclusif, jamais accordé par Grandfather Policy)
const REQUIRES_COMPAGNIE = new Set([
  // Existants
  'groupe', 'groupe-vue', 'entity-switcher',
  'email-management', 'social-media',
  // Nouveaux N4 — jamais présents dans tenant_modules des anciens PME
  'consolidation', 'intercompany', 'budget-groupe',
  'tresorerie-groupe', 'direction-groupe', 'rapports-groupe',
  'bi-groupe', 'gouvernance', 'validation-hierarchique', 'audit-groupe',
])

// ── Modules TOUJOURS visibles (peu importe le plan) ───────────────────────────
const ALWAYS_VISIBLE = new Set([
  'facturation', 'crm', 'tresorerie', 'rh', 'depenses',
  'taches', 'calendrier', 'notifications', 'parametres', 'profil',
  'devis', 'equipe', 'recouvrement', 'rapports',
  // Navigation essentielle
  'abonnement', 'bizbot',
  // MIAA+ — accès de base (chat) pour tous les plans ; les features premium
  // (expertise, agent, academy, analyze-file) sont bloquées côté API pour TPE
  'miaa', 'miaa-chat', 'miaa-rapports',
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
  'cabinet-taches', 'cabinet-projets', 'cabinet-honoraires', 'cabinet-conformite',
  'cabinet-analytiques', 'cabinet-miaa', 'cabinet-affaires',
  'agriculture', 'agriculture-parcelles', 'agriculture-recoltes', 'agriculture-intrants',
  'ong', 'ong-projets', 'ong-dons',
  'boisson', 'boisson-tournees',
  'petrole', 'petrole-sites',
  'assurance-direction', 'assurance-polices', 'assurance-sinistres',
  'assurance-clients', 'assurance-produits', 'assurance-partenaires',
  'assurance-commissions', 'assurance-analytics', 'assurance-miaa',
  'recrutement-direction', 'recrutement-offres', 'recrutement-ats', 'recrutement-candidatures',
  'recrutement-entretiens', 'recrutement-cvtheque', 'recrutement-placement',
  'recrutement-mad', 'recrutement-contrats', 'recrutement-partenaires', 'recrutement-analytics',
  'recrutement-miaa',
  // Commerce
  'commerce', 'commerce-catalogue', 'commerce-clients', 'commerce-analytics',
  // Boisson
  'boisson-commandes',
  // Transport
  'transport-flotte', 'transport-carburant', 'transport-analytique',
  // Hôtel
  'hotel-chambres',
  // École — niveaux supérieurs
  'ecole-theses', 'ecole-soutenances', 'ecole-diplomes',
  // BTP
  'btp-avancement',
  // ONG
  'ong-bailleurs',
  // Portails externes
  'portail-client', 'portail-candidat',
])

/**
 * Retourne true si un module est accessible pour ce plan.
 * Sécurité : les tenants legacy sans taille_entreprise (null) sont traités
 * comme TPE — accès minimal, jamais accès total (W2-C3).
 */
export function canAccessByPlan(
  taille: TailleEntreprise | string | null | undefined,
  moduleId: string,
): boolean {
  if (ALWAYS_VISIBLE.has(moduleId)) return true

  // Legacy tenants sans taille → TPE par défaut (le plus restrictif)
  const effectiveTaille = taille ?? 'tpe'

  // Compagnie (grande) → accès complet
  if (effectiveTaille === 'grande') return true

  // Business (pme) → bloque uniquement les modules Compagnie exclusifs
  if (effectiveTaille === 'pme') return !REQUIRES_COMPAGNIE.has(moduleId)

  // Entrepreneur (tpe) → bloque Business, Compagnie et Compagnie-only
  return !REQUIRES_PME.has(moduleId) && !REQUIRES_GRANDE.has(moduleId) && !REQUIRES_COMPAGNIE.has(moduleId)
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
  return requiredTaille === 'grande' ? 'Compagnie' : 'Business'
}

/**
 * Retourne le plan requis pour un module, ou null si accessible au plan actuel.
 * Utile pour afficher le bandeau d'upgrade dans la sidebar.
 */
export function getRequiredPlan(
  taille: string | null | undefined,
  moduleId: string,
): 'pme' | 'grande' | null {
  if (canAccessByPlan(taille, moduleId)) return null
  if (REQUIRES_COMPAGNIE.has(moduleId)) return 'grande'
  return 'pme'
}

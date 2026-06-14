/**
 * lib/feature-access.ts — Restriction d'accès au niveau des FONCTIONNALITÉS
 *
 * Différence avec lib/plan-access.ts :
 *   plan-access.ts  → contrôle la VISIBILITÉ des MODULES dans la Sidebar
 *   feature-access.ts → contrôle l'accès aux FONCTIONNALITÉS à l'intérieur des pages
 *
 * Règle SaaS : le module est toujours visible, mais certaines fonctionnalités
 * avancées sont réservées au plan Business (pme) et Entreprise+ (grande).
 *
 * ENTREPRENEUR (tpe) → fonctionnalités standard
 * BUSINESS     (pme) → toutes les fonctionnalités ci-dessous débloquées
 * ENTREPRISE+  (grande) → toutes les fonctionnalités Business + analytics avancés, BI complète
 */

export type FeatureId =
  | 'audit-ohada'            // Conformité OHADA — vérification des 7 actes uniformes
  | 'audit-controle-interne' // Contrôle interne — cartographie des processus
  | 'analytics-avances'      // BI Analytics — forecasts, KPI avancés
  | 'bi-avancee'             // Business Intelligence — dashboards multi-entités
  | 'workflows-avances'      // Workflows & automatisations avancés
  | 'miaa-expert'            // MIAA Expert — analyses sectorielles approfondies, agent autonome
  | 'recrutement-ia'         // Recrutement IA — matching CV, scoring automatique
  | 'ocr-intelligent'        // OCR intelligent — lecture et extraction de documents
  | 'previsions-ia'          // Prévisions IA — projections trésorerie, ventes
  | 'academy-premium'        // Academy Premium — modules avancés, certifications
  | 'automatisations'        // Automatisations — triggers, webhooks, intégrations

// ── Features réservées Business (pme) et au-dessus ───────────────────────────
const REQUIRES_BUSINESS = new Set<FeatureId>([
  'audit-ohada',
  'audit-controle-interne',
  'analytics-avances',
  'bi-avancee',
  'workflows-avances',
  'miaa-expert',
  'recrutement-ia',
  'ocr-intelligent',
  'previsions-ia',
  'academy-premium',
  'automatisations',
])

// ── Features réservées Entreprise+ (grande) ───────────────────────────────────
const REQUIRES_ENTERPRISE = new Set<FeatureId>([
  // Toutes les features Business + rien de spécifique pour l'instant
  // (les modules grande sont gérés dans plan-access.ts via REQUIRES_GRANDE)
])

/**
 * Retourne true si la fonctionnalité est accessible pour ce plan.
 * tpe   → uniquement les features de base
 * pme   → REQUIRES_BUSINESS débloquées, pas REQUIRES_ENTERPRISE
 * grande → tout débloqué
 * null  → legacy, on laisse passer (rétro-compatibilité)
 */
export function canAccessFeature(
  taille: string | null | undefined,
  featureId: FeatureId | string,
): boolean {
  // Pas de plan connu → legacy, on laisse passer
  if (!taille) return true

  // Entreprise+ → tout
  if (taille === 'grande') return true

  // Business → bloque uniquement REQUIRES_ENTERPRISE
  if (taille === 'pme') return !REQUIRES_ENTERPRISE.has(featureId as FeatureId)

  // Entrepreneur (tpe) → bloque REQUIRES_BUSINESS et REQUIRES_ENTERPRISE
  return !REQUIRES_BUSINESS.has(featureId as FeatureId)
}

/**
 * Retourne le plan requis pour débloquer la fonctionnalité, ou null si accessible.
 */
export function getRequiredFeaturePlan(
  taille: string | null | undefined,
  featureId: FeatureId | string,
): 'pme' | 'grande' | null {
  if (canAccessFeature(taille, featureId)) return null
  if (REQUIRES_ENTERPRISE.has(featureId as FeatureId)) return 'grande'
  if (REQUIRES_BUSINESS.has(featureId as FeatureId))   return 'pme'
  return null
}

/**
 * Label d'upgrade à afficher dans les bandeaux.
 */
export function getFeatureUpgradeLabel(requiredPlan: 'pme' | 'grande'): string {
  return requiredPlan === 'grande' ? 'Entreprise+' : 'Business'
}

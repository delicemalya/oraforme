# C4 — PLAN GATING

Mission C4. POS, BOI, Fiscal Core, Payroll, Accounting non modifiés. Aucun nouveau gateway créé. `tenants.modules_actifs` non réintroduit. Aucun commit, aucun push.

## 1. CURRENT ACCESS MODEL

| Mécanisme | Fichier | Rôle | État |
|---|---|---|---|
| `requireTenant()` | `lib/api/require-tenant.ts` | Authentifie + résout `tenant_id` depuis la session (jamais du client) | **Canonique** |
| `requireRole(minRole)` | idem | `requireTenant()` + seuil de rôle (owner>admin>membre) | Canonique |
| `getTenantPlan(tenantId)` | idem | Lit `tenants.taille_entreprise` | Canonique |
| `checkPlanAccess(tenantId, moduleId)` | idem | `getTenantPlan()` + `canAccessByPlan()` → 403 ou `null` | Canonique — **existait déjà, sous-utilisé (7/210 routes avant cette mission)** |
| `canAccessByPlan(taille, moduleId)` | `lib/plan-access.ts` | Catalogue statique pur (aucun accès DB) : `ALWAYS_VISIBLE` / `REQUIRES_PME` / `REQUIRES_GRANDE` / `REQUIRES_COMPAGNIE` | Source de vérité du **catalogue commercial** |
| `lib/tenant-guard.ts::requireTenant()` | — | **`@deprecated`**, 77 importeurs (inchangé par cette mission — stable depuis les missions C1/C2/C3) | Legacy, pas de capacité de plan |
| `getPlanFromLegacy(plan)` | `lib/plans.ts` | Convertit un ancien nommage `'pro'/'enterprise'` → `tpe/pme/grande` | **Mort** — 0 appelant réel confirmé (seules références : sa propre définition + mentions dans des rapports d'audit) |
| `tenant_modules` (table) | migration 020 | Snapshot par tenant des modules activés (calculé à l'onboarding par `computeModules()`, `lib/plans.ts`) — porte la **Grandfather Policy** | Source de vérité de l'**activation**, distincte du plan |
| `tenants.taille_entreprise` | — | Le plan tarifaire réel (`tpe`/`pme`/`grande`) | Source de vérité du **plan** |
| `tenants.modules_actifs` | — | Colonne legacy, **interdite** comme source métier (`lib/architecture/no-cache-reads.test.ts` le garde déjà) | Non touchée, non réintroduite |

## 2. SOURCE OF TRUTH

**Plan commercial** : `tenants.taille_entreprise` (`tpe`/`pme`/`grande`), lu via `getTenantPlan()`.

**Catalogue "quel module pour quel plan"** : `lib/plan-access.ts`. **Ambiguïté trouvée et documentée, pas corrigée** (conforme à la consigne "ne pas modifier la logique commerciale si elle est déjà définie") :
- `REQUIRES_PME` et `REQUIRES_GRANDE` ont des noms trompeurs. Lu ligne à ligne et **vérifié par exécution réelle** (section 10) : les deux sont en réalité "bloqué pour `tpe` uniquement" — `canAccessByPlan('pme', moduleId)` ne teste QUE `REQUIRES_COMPAGNIE`, jamais `REQUIRES_GRANDE` (voir le code de la fonction, ligne 123 : `if (effectiveTaille === 'pme') return !REQUIRES_COMPAGNIE.has(moduleId)`). Autrement dit : `bi`, `analytics`, `api-keys`, `finance`, `audit`, `direction` (listés dans `REQUIRES_GRANDE`) sont en réalité accessibles à **Business (pme)**, pas réservés à Compagnie comme leur regroupement le suggère. Seul `REQUIRES_COMPAGNIE` (`groupe`, `email-management`, `social-media`, `consolidation`, `intercompany`, etc.) est réellement exclusif à Compagnie.
- Cette mission n'a **pas renommé** les Sets ni changé leur contenu — ce serait modifier une logique commerciale déjà définie sans mandat explicite pour le faire. Le rapport global et le plan d'exécution devront être corrigés pour refléter cette réalité (ils supposaient `bi`/`analytics`/`api-keys` "Compagnie-exclusif").

**Activation par tenant** : `tenant_modules`, peuplée par `computeModules(taille, secteur)` (`lib/plans.ts`) à l'onboarding (`app/onboarding/actions.ts`). Porte la Grandfather Policy : un tenant déjà provisionné garde ses lignes même si le catalogue change ensuite pour les nouveaux comptes.

**Ambiguïté structurelle non résolue, documentée** : `checkPlanAccess()` ne lit **jamais** `tenant_modules` — il recalcule l'éligibilité uniquement depuis le plan tarifaire courant via le catalogue statique. Un tenant grandfathered dont `tenant_modules` contient un module reclassé depuis comme plus restrictif obtiendrait donc un **refus serveur** malgré sa ligne `tenant_modules` — un risque produit (faux négatif, client lésé), pas un risque de sécurité (le sens de l'erreur est "trop restrictif", jamais "trop permissif"). **Non corrigé ici** : reconcilier les deux mécanismes changerait une logique commerciale existante, hors mandat de cette mission de fermeture de Critical.

Comment un tenant Entrepreneur/Business/Compagnie est distingué : uniquement par `taille_entreprise`. Aucune autre colonne ne sert à cette distinction.

## 3. ROUTE INVENTORY

**Méthodologie** : 210 routes classées par échantillonnage structuré (namespace de dossier + présence de gateway), pas une lecture ligne à ligne des 210 fichiers (ce serait un nouvel audit général, explicitement hors mandat). Les routes P0 (section 7) ont, elles, été lues intégralement.

| Classe | Définition | Volume estimé | Exemples |
|---|---|---|---|
| **A — Public** | Pas de session requise, légitimement | ~10-15 | `app/api/jobs/{offre,candidature,suivi}` (portail candidat, fermé C2), `app/api/webhooks/*`, `app/api/auth/*` |
| **B — Auth sans fonctionnalité payante** | `requireTenant`/`tenant-guard`/`hrAuth`, module dans `ALWAYS_VISIBLE` | Majorité (~150+) | `facturation`, `crm`, `tresorerie`, `rh` de base, `depenses`, secteurs métier (resto/santé/école/btp/...) |
| **C — Fonctionnalité payante** | Module dans `REQUIRES_PME`/`REQUIRES_GRANDE`/`REQUIRES_COMPAGNIE` | ~25-30 identifiables via le catalogue | `comptabilite`, `fiscalite`, `stock`, `achats` (PME+, **hors périmètre — Accounting/Fiscal/Stock exclus explicitement**), `academy`, `api-keys`, `bi`, `analytics` (traités ici), `groupe`/`consolidation`/etc. (Compagnie-exclusif, **aucune route API, voir section 8**) |
| **D — Admin/internal** | `app/api/admin/*`, `app/api/monitoring/*` | ~10-15 | Authentification admin plateforme, pas le plan tenant — hors périmètre |
| **E — Automation** | `requireAutomationSecret`, crons | ~15 | `app/api/cron/*`, `app/api/agents/*`, routes MIAA d'automatisation déjà identifiées en C1 (`proactif`, `analyse-quotidienne`) |

**Routes volontairement non protégées artificiellement** (classe A confirmée légitime, non touchées) : le portail de candidature public (`jobs/offre`, `jobs/candidature`, `jobs/suivi`, fermé pour l'isolation tenant en C2 mais jamais gaté par plan — un candidat externe n'a pas de plan).

## 4. PAYWALL / MODULE INVENTORY

Les 7 routes déjà protégées avant cette mission (toutes `/api/miaa/*`, confirmées par grep exhaustif) :

| Route | Module vérifié |
|---|---|
| `academy/lessons` | `academy` |
| `agent` | `academy` |
| `analyze-file` | `academy` |
| `compliance` | `academy` |
| `expertise` | `academy` |
| `generer-document` | `academy` |
| `upload-analyze` | `academy` |

Toutes utilisaient déjà `checkPlanAccess(tenantId, 'academy')` correctement — **retenues comme référence d'implémentation**, reproduite à l'identique pour les correctifs (section 7).

**Fonctionnalités réellement payantes identifiées** (pas seulement comptées en routes — UI + API + sous-modules), via `lib/plan-access.ts` croisé avec l'inventaire de routes réel :

| Fonctionnalité | Modules catalogue | Routes API réelles trouvées | Statut avant cette mission |
|---|---|---|---|
| MIAA+ Academy | `academy` | 7 routes `miaa/academy*` + `miaa/agent/expertise/analyze-file/generer-document/compliance/upload-analyze` | 7/8 gatées ; `academy/route.ts` (la route principale !) ne l'était **pas** |
| Clés API publiques | `api-keys` | `app/api/api-keys/route.ts`, `app/api/api-keys/[id]/route.ts` | **Aucune vérification de plan** |
| Business Intelligence | `bi`, `bi-dg`, `bi-rh`, `bi-ecole`, `bi-hotel`, `bi-restaurant` | `app/api/bi/insights/route.ts` (un seul endpoint, paramétré par `?module=`) | **Aucune vérification de plan**, authentification même pas sur le gateway canonique |
| Analytics consolidées | `analytics` | `app/api/analytics/summary/route.ts` | **Aucune vérification de plan**, même défaut |
| Comptabilité/Fiscalité/Stock/Achats avancés | `comptabilite`, `fiscalite`, `stock`, `achats` | Nombreuses routes `app/api/{comptabilite,fiscalite,stock,achats}/*` | Non protégées — **explicitement exclues du périmètre de cette mission** (Accounting/Fiscal/POS) |
| Groupe / multi-entités / Intelligence Compagnie | `groupe`, `consolidation`, `intercompany`, `direction-groupe`, `email-management`, `social-media`, etc. | **Aucune route API trouvée** (`find app/api -maxdepth 1` ne montre ni `groupe`, ni `direction`, ni `finance`, ni `email-management`, ni `social-media`) | Ces écrans lisent Supabase directement côté client (pattern déjà documenté dans le rapport global comme "Flux A") — **aucun point serveur à gater existe aujourd'hui** ; `email-management`/`social-media` sont par ailleurs confirmés fonctionner sur des données factices (`DEMO_*`), donc sans risque réel actif |

## 5. ROOT CAUSE

```
AVANT :
  requireTenant() / tenant-guard.ts   → tenant résolu correctement (isolation OK)
  MAIS aucun appel à checkPlanAccess() hors des 7 routes MIAA/academy
  → n'importe quel tenant, quel que soit son plan, atteignait des fonctionnalités
    facturées comme premium (api-keys, bi, analytics), et même la route
    academy PRINCIPALE n'était pas gatée alors que ses 7 routes sœurs l'étaient.

Deux des trois routes fautives (bi/insights, analytics/summary) avaient en plus
leur propre authentification réimplémentée à la main (ni tenant-guard.ts ni
require-tenant.ts) — un pattern ad hoc de plus, pas seulement un plan manquant.
```

## 6. CANONICAL GATEWAY

`lib/api/require-tenant.ts` exclusivement. **Aucun nouveau gateway créé.** Les deux routes qui réimplémentaient leur propre authentification (`bi/insights`, `analytics/summary`) ont été migrées vers `requireTenant()` — pas introduites dans `tenant-guard.ts`, qui est déprécié.

```
Modèle appliqué (identique aux 7 routes déjà correctes) :
REQUEST → requireTenant(req) → ctx.tid (session, jamais le client)
        → checkPlanAccess(ctx.tid, moduleId) → 403 si refusé
        → business logic
```

## 7. ROUTES CORRECTED

5 fichiers, classés P0 (modules payants réels, routes API réelles existantes, hors des domaines explicitement exclus) :

| Fichier | Module | Changement |
|---|---|---|
| `app/api/api-keys/route.ts` (GET+POST) | `api-keys` | Ajout `checkPlanAccess(ctx.tid, 'api-keys')` après `requireRole('admin')` existant |
| `app/api/api-keys/[id]/route.ts` (PATCH+DELETE) | `api-keys` | Idem |
| `app/api/bi/insights/route.ts` (GET) | `bi` | Authentification manuelle (`profiles` lookup) remplacée par `requireTenant()` ; ajout `checkPlanAccess(ctx.tid, 'bi')` |
| `app/api/analytics/summary/route.ts` (GET) | `analytics` | Idem (le `role`/`ecole_role_name` lus par l'ancien code n'étaient jamais utilisés ensuite — vérifié avant suppression) |
| `app/api/miaa/academy/route.ts` (GET+POST) | `academy` | Ajout `checkPlanAccess(tenant_id, 'academy')` — la seule des 8 routes `academy*` qui ne l'avait pas |

Aucun body/query client n'est lu pour déterminer `plan`/`tenant_id`/`module_access` — vérifié par les tests statiques (section 10).

## 8. ROUTES DEFERRED

| Routes/modules | Raison du report |
|---|---|
| `comptabilite`, `fiscalite`, `stock`, `achats` (toutes leurs routes) | **Exclusion explicite de la mission** (Accounting/Fiscal/Stock/POS) — identifiées comme non protégées, non corrigées ici par mandat, pas par oubli |
| `groupe`, `consolidation`, `intercompany`, `direction-groupe`, etc. (Compagnie-exclusif réel) | **Aucune route API n'existe** — ces pages lisent Supabase directement (Flux A). Les gater nécessiterait soit une nouvelle route API (= "créer une architecture", hors mandat), soit une politique RLS par plan (= migration DB, interdite dans cette mission). Documenté comme risque structurel, pas corrigé |
| `email-management`, `social-media` | Confirmé fonctionner sur données factices (`DEMO_*`) — aucune fonctionnalité réelle à protéger aujourd'hui |
| `academy/{quiz,parcours,badges}` | Déjà signalés en C1 comme IDOR résiduel (données de gamification, pas de plan check non plus) — même situation, non traités dans cette mission pour ne pas élargir le périmètre au-delà du plan gating pur |
| Routes D (admin plateforme) et E (automatisation) | Hors du modèle de plan tenant par construction — à juste titre non gatées par `checkPlanAccess` |

## 9. TENANT-GUARD MIGRATION

```
Importeurs tenant-guard.ts : 77 (inchangé — aucun n'a dû migrer pour fermer ce Critical)
Importeurs require-tenant.ts : 60 (45 avant l'engagement C1-C4 → 60, +15 par les missions C1/C2/C4)
```

**Aucune migration de `tenant-guard.ts` n'était nécessaire pour ce Critical** : les 5 routes corrigées utilisaient déjà `require-tenant.ts` (api-keys, academy) ou une authentification ad hoc sans rapport avec `tenant-guard.ts` (bi/insights, analytics/summary) — migrées directement vers le gateway canonique, pas vers le legacy.

**Pour une future mission de migration complète** (non exécutée ici, hors mandat) : prioriser les 77 importeurs qui **touchent des modules du catalogue payant** (ex. `app/api/stock/move/route.ts`, déjà repéré en Point 6 de la réconciliation comme important `tenant-guard.ts`) avant les routes purement `ALWAYS_VISIBLE` — car seuls les premiers peuvent un jour avoir besoin de `checkPlanAccess`, qui n'existe pas sur `tenant-guard.ts`. Les routes `ALWAYS_VISIBLE` peuvent rester sur `tenant-guard.ts` sans urgence, puisqu'aucune d'elles n'aura jamais besoin d'un plan check.

## 10. ESCALATION TESTS

`lib/architecture/plan-gating-escalation.test.ts` — **40 tests, exécutés réellement** contre `canAccessByPlan()` (la vraie fonction de décision, pas une copie) + vérification statique des 5 routes corrigées :

| Scénario demandé | Résultat |
|---|---|
| Entrepreneur (tpe) ne peut pas appeler `api-keys`/`bi`/`analytics`/`academy` | 4/4 `false` confirmés par exécution |
| Business (pme) ne peut pas appeler une fonction réservée Compagnie | Testé sur le **vrai** ensemble Compagnie-exclusif (`groupe`, `email-management`, `social-media`, `consolidation`) — `pme` → `false`, `grande` → `true` ; **correction appliquée en cours de test** : `api-keys`/`bi`/`analytics`/`academy` sont en réalité Business+ (voir section 2), donc `pme` → `true` pour ces 4 (comportement correct du catalogue, pas un trou) |
| Tenant autorisé (grande) → accès fonctionnel | 4/4 `true` confirmés |
| `plan`/`module_access`/`is_premium`/`is_admin` dans le body → sans effet | Vérifié statiquement : aucune des 5 routes ne lit ces champs |
| `tenant_id` modifié dans le body/query → ne change pas le tenant autorisé | Vérifié statiquement : aucune des 5 routes ne lit `tenant_id`/`tenantId` du body/query ; le seul tenant utilisé est `ctx.tid` issu de `requireTenant()` |
| `tenant_modules` activé/désactivé | **Non testé** — `checkPlanAccess()` ne consulte pas `tenant_modules` (voir ambiguïté section 2), il n'y a donc rien à tester sur ce point précis sans changer la logique commerciale elle-même, hors mandat |

## 11. REGRESSION

```
npx tsc --noEmit                    → 0 erreur
npx eslint (5 fichiers + test)       → 0 erreur, 0 warning
npx vitest run (suite complète)      → 51 fichiers, 1085 tests, 0 échec
                                        (1045 avant cette mission + 40 nouveaux)
```

Aucun test supprimé ni affaibli. Aucune fonctionnalité légitime cassée : les 3 routes migrées (`api-keys`×2, `bi/insights`, `analytics/summary`) conservent exactement le même comportement pour un tenant déjà éligible (`grande`, ou `pme` pour les 4 modules réellement Business+) — seul un tenant `tpe` perd un accès qu'il n'aurait jamais dû avoir.

## 12. PRODUCTION VALIDATION

```
STATIC_VALIDATION      = PASS (40/40, exécution réelle de canAccessByPlan() + vérification statique des routes)
REAL_HTTP_VALIDATION   = NOT_TESTABLE (aucun canal HTTP de production disponible cette session)
REAL_DB_VALIDATION     = NOT_TESTABLE (Docker arrêté, MCP en échec — même blocage que C1/C2/C3)
```

## 13. REMAINING RISKS

| Risque | Catégorie |
|---|---|
| `comptabilite`/`fiscalite`/`stock`/`achats` non gatées par plan | Exclusion explicite de mandat, pas résolu |
| Modules Compagnie-exclusifs réels (`groupe`, etc.) sans aucune route API à gater | Structurel — nécessiterait soit une nouvelle architecture de route, soit du RLS par plan (migration), les deux hors mandat |
| `checkPlanAccess()` ignore `tenant_modules` (Grandfather Policy) | Risque produit (faux négatif), pas sécurité — documenté, non corrigé |
| 77 importeurs `tenant-guard.ts` toujours présents | HIGH déjà tracé (Top 10 action #9 du plan d'exécution), hors mandat de ce Critical spécifique |
| `academy/{quiz,parcours,badges}` toujours sans plan check | Signalé en C1, confirmé de nouveau ici, non traité (périmètre) |
| Aucune preuve HTTP/DB réelle | Méthodologique — même blocage d'infrastructure que C1/C2/C3 |

---

## VERDICT

```
C4_CODE_FIX              = PASS
C4_STATIC_TEST           = PASS
C4_REAL_ESCALATION_TEST  = NOT_TESTABLE
C4_FINAL_CLOSURE         = PENDING
```

`C4_CODE_FIX = PASS` : les 5 routes correspondant à des modules payants réels avec une route API réelle, hors des domaines explicitement exclus (Accounting/Fiscal/Stock/POS/Payroll), vérifient désormais le plan côté serveur via le gateway canonique — avec correction d'une erreur de compréhension du catalogue trouvée en cours de mission (REQUIRES_GRANDE ≠ Compagnie-exclusif), documentée plutôt que corrigée silencieusement.

`C4_STATIC_TEST = PASS` : 40/40, dont l'essentiel exécute réellement la fonction de décision du catalogue (pas un grep sur sa seule présence).

`C4_REAL_ESCALATION_TEST = NOT_TESTABLE` : aucun canal HTTP/DB réel disponible.

`C4_FINAL_CLOSURE = PENDING` — pas `PASS` : le plan gating reste structurellement incomplet pour les modules Compagnie-exclusifs réels (aucune route à gater) et pour les 4 modules explicitement exclus de ce mandat (comptabilite/fiscalite/stock/achats) — fermer complètement le Critical nécessiterait une décision produit sur ces deux points, hors périmètre de cette mission de correction de code.

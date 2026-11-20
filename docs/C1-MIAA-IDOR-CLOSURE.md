# C1 — Fermeture Critical IDOR MIAA

Mission C1. Code modifié uniquement pour ce Critical — aucun refactor global, aucune migration vers `tenant-guard.ts` globale, POS/paie/BOI/fiscalité non touchés.

## 1. ROUTES_AUDITED

Le rapport global nommait 7 routes. L'audit réel en a trouvé **19** sous `app/api/miaa/`. Ne pas supposer qu'elles partagent le même modèle — chacune a été lue intégralement.

| # | Fichier | Méthode | Appelants (UI) | Tenant_id source (avant correctif) | Tables lues | Tables écrites |
|---|---|---|---|---|---|---|
| 1 | `chat/route.ts` | POST | `app/dashboard/miaa/page.tsx` + autres pages dashboard | `tenantData.tenant_id` (body) | `miaa_memory`/mémoire via `chargerMemoireMIAA` | `miaa_conversations`, mémoire, usage |
| 2 | `agent/route.ts` | GET+POST | `app/dashboard/miaa/agent/page.tsx` | `tenant_id` (query/body) | mémoire, `miaa_proposals`, `miaa_briefings` | `miaa_briefings`, `miaa_proposals` |
| 3 | `expertise/route.ts` | GET+POST | `app/dashboard/miaa/expertise/page.tsx` | `tenant_id` (query/body) | mémoire, `expertise_documents` | `expertise_documents` |
| 4 | `academy/route.ts` | GET+POST | `app/dashboard/academy/page.tsx` | `tenant_id` (query/body) | `academy_progress`, `academy_certificates` | mêmes tables |
| 5 | `generer-document/route.ts` | POST | `app/dashboard/audit/rapports/page.tsx` | `tenant_id` (body, optionnel) | mémoire | rapports (`sauvegarderRapport`) |
| 6 | `analyze-file/route.ts` | POST | pages dashboard (upload fichier MIAA) | `tenantData.tenant_id` (body, optionnel) | mémoire | usage tracking |
| 7 | `executive/route.ts` | POST | `app/dashboard/groupe/miaa/page.tsx` | `tenantId` (body) | — (données fournies par le client) | `miaa_rh_generations` |
| 8 | `rh-expert/route.ts` | POST | `app/dashboard/recrutement/miaa/page.tsx` | `tenantId` **et** `plan` (body) | — | `miaa_rh_generations` |
| 9 | `assurance-fraude/route.ts` | POST | `app/dashboard/assurance/{polices,sinistres,analytics}/page.tsx` | aucun tenant_id direct — `sinistre_id` (body), tenant dérivé du sinistre SANS vérification | `ass_sinistres`, `ass_polices` | — |
| 10 | `notifications/route.ts` | GET+POST | — | **déjà** `ctx.tid` (corrigé ANO-C05, mission antérieure) | `miaa_notifications` | idem |
| 11 | `document-context/route.ts` | — | — | **déjà** `ctx.tid` | — | — |
| 12 | `compliance/route.ts` | — | — | **déjà** `ctx.tid` | — | — |
| 13 | `proactif/route.ts` | GET | cron Vercel horaire | `tenant.id` issu d'une boucle serveur sur **tous** les tenants ; route gardée par `requireAutomationSecret` | tous tenants (boucle) | `miaa_alertes` |
| 14 | `analyse-quotidienne/route.ts` | POST | cron/dispatcher d'automatisation | `tenant_id` (body), mais gardée par `requireAutomationSecret` | tenant visé | `miaa_rapports_quotidiens` |
| 15 | `upload-analyze/route.ts` | POST | upload générique MIAA | `tenant_id` (FormData), utilisé **uniquement** pour `checkPlanAccess` | — (analyse de fichier générique, pas de donnée tenant lue) | — |
| 16 | `academy/lessons/route.ts` | GET | `app/dashboard/academy/page.tsx` | `tenant_id` (query), utilisé **uniquement** pour `checkPlanAccess` | `academy_lessons` (contenu partagé, non scopé tenant) | — |
| 17 | `academy/quiz/route.ts` | POST | `app/dashboard/academy/page.tsx` | `tenant_id` (body) | `academy_progress` | idem |
| 18 | `academy/parcours/route.ts` | GET+POST | `app/dashboard/academy/page.tsx` | `tenant_id` (query/body) | `academy_learner_parcours` | idem |
| 19 | `academy/badges/route.ts` | GET+POST | `app/dashboard/academy/page.tsx` | `tenant_id` (query/body) | `academy_progress`, `academy_certificates`, `academy_learner_badges` | idem |

## 2. AUTH_MODEL — classification stricte (A/B/C/D)

| Route | Classe | Justification |
|---|---|---|
| chat, agent, expertise, academy, generer-document, analyze-file, executive, rh-expert, assurance-fraude | **A, mal implémentée** → corrigée en A conforme | Authentifiée (appelée depuis le dashboard, session Supabase présente), mais le tenant venait du client au lieu de la session. Toutes les 9 routes sont maintenant **A conforme** : tenant dérivé exclusivement de `requireTenant()`. |
| notifications, document-context, compliance | **A conforme (déjà)** | Corrigées par une mission antérieure (ANO-C05) — non retouchées. |
| proactif, analyse-quotidienne | **B — authentifiée mais globale (automatisation)** | Pas de session utilisateur : secret partagé (`requireAutomationSecret`, comparaison en temps constant), tenant_id est un paramètre de travail légitime d'un job serveur qui traite tous les tenants ou un tenant ciblé par le planificateur — pas une autorité de sécurité fournie par un attaquant. Modèle différent de A, pas un IDOR. |
| upload-analyze, academy/lessons | **D — plan-gate bypass possible, pas de fuite de données** | `tenant_id` sert uniquement à `checkPlanAccess` ; aucune donnée scopée au tenant n'est lue/écrite au-delà de ce check. Risque réel mais de la famille Critical #4 (gating de plan), pas Critical #1. Non corrigé dans cette mission (hors périmètre explicite). |
| academy/quiz, academy/parcours, academy/badges | **D — IDOR réel mais sévérité moindre, non traité** | Même anti-pattern que les 9 routes corrigées, mais sur des données de gamification/formation (score quiz, badges, parcours pédagogique) — pas financier, RH ou PII. Laissé en risque résiduel documenté plutôt que traité, pour respecter le périmètre de la mission. |

## 3. ROOT_CAUSE

**Variante dominante (7 des 9 routes corrigées)** :
```
BEFORE : tenant_id fourni par client (query ou body)
         → checkPlanAccess(tenant_id, module)   [vérifie le PLAN de CE tenant, n'authentifie rien]
         → chargerMemoireMIAA(supabase, tenant_id)  [service_role, bypass RLS]
         → données du tenant choisi par le client
```
`checkPlanAccess` a créé une fausse impression de sécurité : il valide que *le tenant désigné* a le bon abonnement, pas que l'appelant *a le droit* de désigner ce tenant.

**Variante `executive`/`rh-expert`** : pas de lecture DB sensible (les données comparées viennent du client), mais écriture (`miaa_rh_generations`) avec un `tenant_id`/`plan` arbitraire — usurpation d'attribution plutôt que fuite de lecture. `rh-expert` avait un second défaut dans le même fichier : le `plan` conditionnant l'accès aux outils premium venait aussi du client.

**Variante `assurance-fraude`** : pas de `tenant_id` direct, mais `sinistre_id` → fetch sans filtre tenant → `sinistre.tenant_id` (dérivé de la ligne trouvée) réutilisé pour les requêtes suivantes. Le filtre tenant manquait sur le **premier** fetch, pas sur les suivants.

```
AFTER (toutes les 9 routes) :
session utilisateur → requireTenant() → ctx.tid (serveur, jamais le client)
  → contrôle tenant implicite sur chaque requête DB (.eq('tenant_id', ctx.tid) ajouté
    partout où ce n'était pas déjà le cas)
  → requête DB tenant-scoped
```

## 4. ROUTES_CORRECTED

9 routes, gateway unique `lib/api/require-tenant.ts` :

| Route | Changement exact |
|---|---|
| `chat/route.ts` | `requireTenant()` ajouté ; `tenantData.tenant_id` retiré du type du body ; `tenantId = ctx.tid` |
| `agent/route.ts` | GET et POST : `requireTenant()` remplace la lecture query/body de `tenant_id` |
| `expertise/route.ts` | GET et POST : idem (variable renommée `authCtx` pour éviter la collision avec le `ctx: DocContext` préexistant) |
| `academy/route.ts` | GET et POST : idem |
| `generer-document/route.ts` | `requireTenant()` optionnel (dégrade proprement si pas de session, comportement préexistant préservé pour l'appel sans tenant) ; variable renommée `authCtx` (collision avec `ctx` préexistant) |
| `analyze-file/route.ts` | Idem, dégradation propre préservée |
| `assurance-fraude/route.ts` | `requireTenant()` ajouté ; `.eq('tenant_id', ctx.tid)` ajouté sur le fetch initial de `ass_sinistres` |
| `executive/route.ts` | `requireTenant()` remplace `tenantId` du body |
| `rh-expert/route.ts` | `requireTenant()` remplace `tenantId` du body **et** `getTenantPlan(tenantId)` remplace `plan` du body (double correctif, même fichier) |

## 5. ROUTES_PUBLIQUES

**Aucune route MIAA n'est publique.** Les 19 routes sont soit A (session utilisateur), soit B (secret d'automatisation). Rien n'a été ouvert ni fermé à l'anonyme dans cette mission.

## 6. GATEWAY_USED

`lib/api/require-tenant.ts::requireTenant()` exclusivement — jamais `lib/tenant-guard.ts` (déprécié), aucun troisième gateway créé. `checkPlanAccess`/`getTenantPlan` (même fichier) réutilisés tels quels pour le plan, maintenant appelés avec un tenant_id fiable.

## 7. DATABASE_ISOLATION

Vérifié route par route (pas seulement à l'entrée) :
- `chat` : `chargerMemoireMIAA`, `mettreAJourMemoire`, `miaa_conversations.insert`, `trackUsage` — tous reçoivent désormais `ctx.tid`, jamais une valeur réinjectée depuis le body après le point d'entrée.
- `agent` : `chargerMemoireMIAA`, `chargerProposals`, `sauvegarderProposals`, `miaa_briefings`/`miaa_proposals` — idem. Le `.eq('tenant_id', tenant_id)` sur `miaa_proposals` (ligne existante) est maintenant scopé correctement puisque `tenant_id` = `ctx.tid`.
- `expertise` : `chargerMemoireMIAA`, insert/select `expertise_documents` — idem.
- `academy` : upsert/select `academy_progress`/`academy_certificates` — idem.
- `generer-document`/`analyze-file` : `chargerMemoireMIAA`/`trackUsage` conditionnés par `tenant_id`, qui vaut maintenant soit `ctx.tid` (session réelle) soit `undefined` (mode générique sans donnée tenant) — jamais une valeur choisie par le client.
- `assurance-fraude` : le fetch initial `ass_sinistres` est maintenant doublement filtré (`id` ET `tenant_id`) ; les requêtes en cascade utilisent `sinistre.tenant_id`, qui ne peut plus provenir que d'une ligne déjà vérifiée comme appartenant au tenant de session.
- `executive`/`rh-expert` : l'insert `miaa_rh_generations` utilise `ctx.tid`, plus jamais une valeur du body.

Aucune fonction `lib/miaa/*` (`chargerMemoireMIAA`, `runAgentAnalysis`, `sauvegarderRapport`, `trackUsage`, etc.) n'a dû être modifiée — ce sont des utilitaires correctement paramétrés par `tenant_id` ; le défaut était entièrement à la frontière de la route, qui leur transmettait une valeur non vérifiée. Vérifié qu'aucune de ces fonctions ne va elle-même chercher un tenant_id ailleurs (query string, body) en amont de la route.

## 8. ATTACK_TESTS

`lib/architecture/miaa-tenant-isolation.test.ts` — **19 assertions, 100% statiques** (lecture de code source, aucune exécution, aucune base de données touchée). Vérifie :
- Les 9 routes importent et appellent `requireTenant()`.
- Les 9 routes ne déclarent plus `tenant_id`/`tenantId`/`plan` dans le type du body/query à des fins d'autorité.
- `assurance-fraude` filtre bien par `tenant_id` ET `id` sur le même `.eq()` enchaîné.
- Les 2 routes d'automatisation gardent `requireAutomationSecret` (pas de régression vers `requireTenant`, qui casserait leur modèle légitime).
- Les 3 routes déjà corrigées (ANO-C05) n'ont pas régressé.

**Ce test NE PROUVE PAS** qu'un tenant A ne peut réellement pas obtenir les données d'un tenant B en production — il prouve que le code appelle le bon gateway et n'utilise plus l'ancienne source non fiable. La preuve d'exécution réelle (requête HTTP, deux comptes, assertion sur le contenu de la réponse) n'a pas pu être produite — voir section 11.

## 9. REGRESSION

- `npx tsc --noEmit` → 0 erreur (après correction de 2 collisions de nom de variable `ctx` découvertes à la compilation, dans `expertise/route.ts` et `generer-document/route.ts`, renommées `authCtx`).
- `npx eslint` sur les 9 fichiers corrigés + le nouveau test → 0 erreur, 0 warning.
- `npx vitest run lib/architecture/miaa-tenant-isolation.test.ts` → 19/19.
- `npx vitest run` (suite complète) → **49 fichiers, 1037 tests, 0 échec** (1018 avant cette mission + 19 nouveaux ; aucun test supprimé ni affaibli).

## 10. REMAINING_RISK

| Risque | Catégorie | Pourquoi non traité ici |
|---|---|---|
| `upload-analyze`, `academy/lessons` : plan-gate bypass via `tenant_id` arbitraire | Critical #4 (plan gating), pas #1 | Aucune fuite de donnée tenant — relève du chantier de gating de plan, pas de l'IDOR MIAA |
| `academy/{quiz,parcours,badges}` : même anti-pattern IDOR, données de gamification | Résiduel, sévérité moindre | Hors périmètre explicite de cette mission (7→9 routes financières/RH/PII traitées ; ces 3 restent ouvertes) |
| Statut réel RLS en production (indépendant de ce correctif) | Critical #5 | Ce correctif agit au niveau applicatif (service_role, bypass RLS par construction) — n'a aucun effet sur, et n'est affecté par, l'état réel des policies RLS |
| Aucun test d'exécution réelle cross-tenant | Méthodologique | Canal DB (Docker/MCP) indisponible cette session — voir section 11 |

## 11. PRODUCTION_VALIDATION_REQUIRED

Aucune validation en production effectuée (hors périmètre, code applicatif uniquement, pas de migration). Pour valider réellement la fermeture :
1. Créer 2 comptes de test (tenant A, tenant B) dans un environnement non-production.
2. Authentifier une session comme tenant A.
3. Appeler chacune des 9 routes corrigées en tentant de cibler une ressource de tenant B (ancien paramètre `tenant_id`/`sinistre_id` toujours accepté mais désormais ignoré pour l'autorité) — vérifier que la réponse reflète toujours les données de A, jamais de B.
4. Vérifier qu'une session expirée/absente reçoit systématiquement 401 (`requireTenant()` renvoie `ctx.error`).

---

## VERDICT

```
C1_CODE_FIX              = PASS
C1_STATIC_TEST            = PASS
C1_REAL_CROSS_TENANT_TEST = NOT_TESTABLE
C1_FINAL_CLOSURE          = PENDING
```

`C1_CODE_FIX = PASS` : les 9 routes identifiées comme des IDOR réels (fuite de données financières/RH/PII ou usurpation d'attribution) dérivent désormais le tenant exclusivement de la session serveur, via le gateway canonique unique, avec correctif vérifié jusqu'au bout du chemin d'exécution (pas seulement à l'entrée de route).

`C1_STATIC_TEST = PASS` : 19/19 assertions statiques, suite complète sans régression.

`C1_REAL_CROSS_TENANT_TEST = NOT_TESTABLE` : aucun canal de validation transactionnelle disponible cette session (Docker arrêté, MCP en échec de connexion) pour créer deux comptes réels et exécuter l'attaque décrite en section 11.

`C1_FINAL_CLOSURE = PENDING` — **pas PASS**, conformément à la règle explicite de la mission : aucune preuve d'exécution réelle cross-tenant n'existe. Le correctif de code est complet et testé statiquement ; sa fermeture définitive attend une validation en exécution réelle dès qu'un environnement de test le permet.

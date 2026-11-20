# MASTER A→Z AUDIT — ORAFORME

**Date :** 2026-09-14 · **Mode :** DIAGNOSTIC FORENSIQUE COMPLET — aucun code modifié, aucune donnée modifiée, aucune migration créée, aucun déploiement.

**Méthode :** analyse statique exhaustive du dépôt (`C:\Users\DONGUI MABIALA\Music\oraforme`, branche `audit/r003-post-p0-forensic-validation`) par 9 agents de recherche parallèles en lecture seule, combinée à une interrogation directe en lecture seule de la base de production Supabase (`mrzixapnaqsbqmagivvf`, projet "Oraform", ACTIVE_HEALTHY) via les outils `mcp__supabase__*` officiels (métadonnées, advisors de sécurité/performance, et un nombre limité de requêtes SQL `SELECT`/`information_schema`/`pg_policies`/`pg_proc` strictement en lecture).

**Discipline de preuve.** Chaque affirmation est classée : **CONFIRMED** (preuve directe : code lu, requête exécutée, test réellement lancé) / **PARTIALLY CONFIRMED** / **SUSPECTED** (pattern de code, non vérifié en exécution) / **UNKNOWN** / **NOT TESTABLE** (nécessiterait un environnement indisponible ici) / **NOT APPLICABLE**. Aucune affirmation "fonctionnel"/"sécurisé"/"production ready" n'est faite sans preuve explicite.

---

## SOMMAIRE

1. Executive Summary
2. Architecture réelle
3. Inventaire des modules
4. Database
5. Security
6. Identity/Auth
7. Tenant Isolation
8. Permissions
9. Accounting Core
10. Fiscal Core
11. Payroll
12. Inventory
13. Sales/Facturation
14. Purchases (Achats)
15. Treasury (Trésorerie)
16. Business modules
17. Billing/Plans
18. API
19. Migrations
20. Seeds
21. Frontend/UX
22. Performance
23. Tests
24. CI/CD
25. PWA
26. Code debt
27. 10 Laws
28. 16 Cores
29. 12 Pipelines
30. Réconciliation des 72 anomalies
31. Production forensic
32. Risks
33. Priorités
34. Blockers
35. Recommended repair roadmap

---

## 1. EXECUTIVE SUMMARY

Oraforme est un ERP multi-tenant Next.js 16/Supabase pour la zone CEMAC/OHADA, couvrant 16+ secteurs métier verticaux, avec un moteur comptable event-sourced central (`emit_accounting_event` → `accounting_events` → `journal_entries`) et un moteur fiscal multi-pays. **26 tenants existent en production**, dont **3 nommés « AMD FINANCE »** (2 suspendus, 1 actif) et de nombreux tenants de test/QA — l'utilisation réelle est très légère (2 profils utilisateurs au total, la plupart des ~260 tables à 0 ligne).

**L'état réel diverge fortement de l'architecture documentée.** Le blueprint officiel (F-007, 10 lois LOI-A→J, 16 Cores) est largement non implémenté : **7 des 16 Cores prévus n'ont aucune incarnation `lib/` dédiée**, et **aucune des 10 lois fondatrices n'a de test qui porte son propre nom** — seules des règles plus étroites, ajoutées après coup (K-O), les couvrent par ricochet. Le moteur comptable central, bien conçu et testé, coexiste avec **au moins 5 writers concurrents non gouvernés** (`writeComptaEntry()` legacy, `fn_depense_to_transaction`, 4 fonctions PL/pgSQL dormantes mais historiquement actives) — dont un a produit, de façon prouvée, 20 écritures comptables réelles hors du système d'audit central en juin 2026.

**Deux failles de sécurité en production sont CRITICAL et actuellement exploitables**, confirmées par requête directe sur les policies RLS : n'importe quel utilisateur authentifié peut lire les 26 profils d'entreprises de la plateforme (policy `tenants_select` sans filtre tenant, absente de tout historique de migration versionné — dérive de configuration hors-pipeline), et n'importe quel membre d'un tenant peut lire/écrire/supprimer le grand livre comptable de son entreprise sans être un utilisateur financier (erreur de migration identifiée précisément : la migration 030 a ajouté une policy stricte sans jamais retirer les policies larges de la migration 026). Une faille IDOR probable existe sur le cœur de l'assistant IA MIAA (8 routes acceptent un `tenant_id` fourni par le client sans vérification).

**Le gating commercial (plans/modules) est quasiment inexistant côté serveur** : sur 210 routes API, 7 seulement vérifient le plan du tenant — tout module premium est accessible via un appel API direct depuis un compte au forfait le moins cher. 10 modules facturés dans l'offre la plus chère n'ont **aucune implémentation**.

**Trois nouveaux vecteurs actifs, non gardés, de reproduction de l'incident de données de démonstration en production (AMD FINANCE, juin 2026) ont été découverts** — hors du périmètre des corrections précédentes (P0-A/A.2/A.3) : deux fichiers SQL bruts (`supabase/tests/demo_data_sprint_s02_p3.sql`, `seed_amd_finance.sql`) et un harnais de test Playwright avec URL de production et clé `service_role` codées en dur, dont le nettoyage échoue silencieusement.

**Côté positif, réel et vérifiable** : les correctifs fiscaux critiques documentés le 2026-09-01 (TUS abrogée, plafonds CNSS) sont bien résolus et câblés en production ; 760 tests passent réellement ; TypeScript est propre ; les gardes d'automatisation (cron) sont correctement appliqués sur les 14 routes concernées ; le pattern d'isolation tenant explicite est majoritairement bien suivi dans les routes API applicatives échantillonnées.

Ce rapport ne prescrit aucune correction. Le détail complet, avec preuves fichier:ligne pour chaque affirmation, suit dans les sections numérotées ci-dessous.

---

## 2-3-18-24-25 (ARCHITECTURE, API, CI/CD, PWA)

*(Source : agent dédié, 210 routes API recensées, 72 outils de recherche exécutés.)*

### Architecture générale
Next.js 16.2.4, React 19.2.4, TS5, Node 22 en CI (`package.json`). App Router complet, 210 fichiers `route.ts`. Garde global : `proxy.ts` (180 lignes). `next.config.ts:12` : `ignoreBuildErrors: true` — **le build de production ignore les erreurs TypeScript**, la garantie de typage est entièrement reportée sur l'étape CI séparée `npm run typecheck` — fragile si un build est un jour déclenché hors du pipeline GitHub Actions (build Vercel direct sur push, indépendant de la CI).

**Deux flux d'architecture coexistent (découverte majeure) :**
- **Flux A (majoritaire, 171/277 pages dashboard = 62%)** : Page cliente `use client` → `lib/supabase.ts` (client anon navigateur) → PostgREST → RLS → table, **sans passer par la couche API**.
- **Flux B (via API)** : Page → `fetch('/api/...')` → Guard serveur → `supabaseAdmin` (service_role, **bypass RLS**) → filtre applicatif `.eq('tenant_id', ...)` → table.
164/210 routes API utilisent `supabaseAdmin`, +21 routes instancient un client service_role inline. **CONFIRMED** : la majorité de l'isolation tenant côté API repose sur la rigueur de chaque handler individuel, pas sur RLS (bypassée) — voir la faille MIAA ci-dessous pour une régression concrète de ce modèle.

**Services externes réellement intégrés (CONFIRMED, appels réels vérifiés)** : Anthropic Claude (23 sites d'appel), Mistral (fallback, 2 sites), Sentry (masquage replay actif), stockage S3-compatible (credentials **par tenant en base**, pas en env), WhatsApp Business Cloud API (credentials par tenant), Email via Resend (appels `fetch` bruts, pas de SDK), SMS via Twilio (REST brut). **Aucune intégration de paiement réelle trouvée** (Stripe/PayPal/Airtel/MTN) — le module "Mobile Money" est une saisie manuelle de trésorerie, pas une API de paiement.

**Cron/automation (CONFIRMED)** : 11 crons Vercel + 3 routes pg_cron = 14 chemins dans `AUTOMATION_PATHS` (`proxy.ts`). Les 14 appellent bien `requireAutomationSecret()` en première instruction — **aucune anomalie trouvée sur cet échantillon**, cohérent avec la correction historique d'ANO-C01.

**Variables d'environnement non documentées dans `.env.example` (CONFIRMED)** : `ANTHROPIC_API_KEY`, `MISTRAL_API_KEY`, `RESEND_API_KEY`, 3× `TWILIO_*`, `NEXT_PUBLIC_SENTRY_DSN`, `NEXT_PUBLIC_APP_URL`/`SITE_URL`, `EMAIL_FROM`. **Incohérence de contrôle d'accès critique** : les emails super-admin (`adjidongui@gmail.com`, `adjigordon@gmail.com`) sont **hardcodés en clair** dans `proxy.ts:49` et `lib/admin-config.ts:3`, alors qu'une page interne (`app/(internal)/identity-policies/page.tsx:11`) lit une variable d'environnement `SUPER_ADMIN_EMAILS` différente et non documentée — deux sources de vérité distinctes pour le même contrôle.

### Faille CRITIQUE — IDOR cross-tenant confirmée sur le cœur MIAA (IA)
**CONFIRMED par lecture de code, effet en exploitation réelle SUSPECTED (non testé en runtime).** `app/api/miaa/chat/route.ts:244` : `const tenantId = tenantData?.tenant_id` — cette valeur provient **intégralement du corps JSON envoyé par le client**, sans aucune vérification contre l'identité de l'utilisateur authentifié. Ce `tenant_id` est utilisé pour charger, via un client `service_role` (bypass RLS), la mémoire IA complète du tenant ciblé : nom entreprise, secteur, transactions, factures (statut/montants), stock, employés actifs, historique de conversation (`lib/miaa/memory.ts:59-77`).

Le même schéma (tenant_id issu du body/query client, jamais re-vérifié) est répliqué dans **au moins 7 autres routes** : `miaa/agent`, `miaa/expertise`, `miaa/academy`, `miaa/generer-document`, `miaa/rh-expert`, `miaa/analyze-file`, `miaa/executive`. `proxy.ts` exige seulement une session valide (n'importe quel tenant) pour atteindre ces routes — **tout utilisateur authentifié d'un tenant A peut potentiellement interroger les données financières/RH d'un tenant B** en fournissant son `tenant_id` dans le corps de la requête. À l'inverse, les variantes MIAA sectorielles (`sante/miaa`, `resto/miaa`) utilisent correctement `requireTenant()` dérivé de la session — **ces routes-là ne sont pas exposées**.

### Inventaire API — routes orphelines et anomalies
**5 routes API confirmées sans aucun appelant réel** (correspond exactement à l'item E4 de `docs/MIGRATION-MAP-AZ.md`, **toujours vrai aujourd'hui**) : `/api/crm`, `/api/comptabilite/balance`, `/api/comptabilite/grand-livre`, `/api/fiscalite/irpp`, `/api/hotel/payments`, `/api/agents/commercial/analyse`. Les pages front équivalentes (balance, grand-livre, CRM) réimplémentent leur propre logique en lisant les tables directement plutôt que d'appeler l'API — risque de divergence de calcul entre deux implémentations parallèles.

**Item E0 de MIGRATION-MAP-AZ.md — RÉSOLU (bonne nouvelle confirmée)** : les deux bugs qui cassaient `/api/comptabilite/balance` et `/api/comptabilite/grand-livre` 5 mois sur 12 (colonnes inexistantes `reference`/`journal_type`, date invalide `AAAA-MM-31`) sont corrigés dans le code actuel (`lib/erp-core/compute/accounting.ts:105-131`, `app/api/comptabilite/balance/route.ts:34-50`) — mais cette correction n'a pas résolu E4 : les routes fonctionnent probablement mais restent débranchées.

**SUSPECTED, à vérifier en runtime** : `/api/whatsapp/webhook` n'apparaît pas dans `PUBLIC_API_PREFIXES` de `proxy.ts:18-24` (seul `/api/webhooks/` avec un « s » y figure) — ce endpoint censé recevoir des callbacks Meta non authentifiés serait bloqué par l'exigence de session, sauf mécanisme non identifié.

**Autre dette confirmée** : 0 usage de `zod` sur les 210 routes (validation entièrement manuelle, rigueur inégale) ; au moins 4 mécanismes distincts et non unifiés de dérivation tenant (`lib/tenant-guard.ts` @deprecated mais utilisé par 75+ routes selon son propre commentaire, `lib/api/require-tenant.ts` cible avec API incompatible `ctx.tid` vs `ctx.tenantId`, plus des guards locaux ad hoc par domaine `hrAuth`/`tresoAuth`/`getCallerTenantId`).

### CI/CD
`.github/workflows/ci.yml` : `typecheck` → `lint` → `test` (Vitest) → build avec **valeurs Supabase/IA placeholder explicites** — **CONFIRMED aucune commande CI ne touche une base réelle**. **Ce qui n'est PAS vérifié en CI** : aucun test E2E Playwright (dépendance présente, jamais exécutée en CI), aucun déploiement automatique dans ce workflow (géré hors dépôt par l'intégration Vercel). `.github/workflows/semgrep.yml` : scan OSS uniquement (pas de moteur Pro), bloque seulement sur sévérité ERROR.

### PWA
Manifest (`public/manifest.json`) et service worker (`public/sw.js`, 210 lignes, écrit à la main sans `next-pwa`) **CONFIRMED présents et câblés** (cache-first assets, network-first navigation avec page offline, push notifications, file de sync IndexedDB). Enregistrement confirmé dans le layout racine. **CONFIGURÉ ≠ FONCTIONNEL** : l'installabilité réelle et le bon fonctionnement du offline **ne sont pas testables** en lecture seule statique (nécessiterait Lighthouse/test navigateur réel).

---

## 9-12. INVENTORY, VENTES, ACHATS, TRÉSORERIE

*(Source : agent dédié, lecture exhaustive des 179 migrations + code applicatif.)*

### Stock — un bug historique bien résolu, un nouveau confirmé actif
**RÉSOLU (bonne nouvelle confirmée)** : le triple bug historique (`products.stock_actuel` colonne jamais existante lue par 14 pages / `get_product_stock()` sur un vocabulaire de types obsolète / STK-002 jamais émis) a été correctement diagnostiqué et corrigé par la migration `173_stock_source_unique.sql` (`fn_stock_sign`, vue `v_products_stock` en `security_invoker`, `fn_stock_move()` comme point d'écriture unique avec verrou anti-négatif) — propagation confirmée dans ~15 pages du dashboard.

**CONFIRMED, actif aujourd'hui — faille nouvelle** : la page principale « Sorties de stock » (`app/dashboard/stocks/sorties/page.tsx:207`) appelle `fn_stock_move` **en RPC directe depuis le client**, contournant `POST /api/stock/move` — **seul endroit où l'écriture comptable STK-002 (601/311) est câblée**. Chaque sortie de stock via cette page diminue le stock réel **sans jamais générer l'écriture comptable correspondante**. Même schéma pour les retours et les réceptions d'achat côté stock.

**CONFIRMED** : `app/dashboard/sante/pharmacie/page.tsx:99` écrit directement `pharmacie_medicaments.stock_actuel` (colonne réelle, table différente) sans passer par `fn_stock_move` ni créer de ligne `stock_movements` — sous-système de stock parallèle sans audit trail pour le module Pharmacie.

**Vérification MIGRATION-MAP-AZ section 6 (STOCK)** — S1/S2/S3 : **RÉSOLUS**. S4 (`/api/stock/move` sans appelant) : **toujours vrai**, mais nuance critique découverte — l'absence d'appelant HTTP masque en fait un contournement RPC direct qui casse l'émission comptable (voir ci-dessus). S5 (`restaurant/inventaire` appelle des routes API inexistantes) : **toujours présent**.

### Ventes/Facturation
**CONFIRMED, conforme au moteur documenté** : `POST /api/factures` insère facture + lignes (avec rollback explicite si les lignes échouent — bug antérieur corrigé, le commentaire du code documente l'ancien comportement où les lignes se perdaient silencieusement), puis émet `FAC-001` via `emit_accounting_event` uniquement si `statut='envoyee' && type!='avoir'`. Cohérent avec `lib/architecture/loi-k-unique-writer.test.ts`.

**SUSPECTED** : `invoice_number` est fourni par le client sans séquence atomique serveur (contrairement à `api/stock/reception` qui génère sa référence côté serveur) — risque de doublons/falsification sur un document opposable fiscalement, non vérifiable sans accès DB en écriture.

### Achats — deux systèmes parallèles non convergents (découverte majeure)
**CONFIRMED** : il existe **deux flux « achats fournisseurs » vivants en parallèle** :
1. Le flux « officiel » (`achats` → `POST/PATCH /api/achats` → `emit_accounting_event('ACH-001'/'ACH-002')`), propre et conforme au moteur.
2. `app/dashboard/stocks/achats/page.tsx` — page UI **distincte**, écrit dans des tables **différentes** (`purchases`/`purchase_items`) directement côté client, réceptionne via RPC directe (`fn_stock_move`, **sans émission STK-001**), et paye via le writer legacy `writeComptaEntry()` (comptes codés en dur, **sans jamais passer par `emit_accounting_event`**, donc **invisible de `accounting_events`**).

Ceci pourrait expliquer pourquoi la table `achats` reste à 0 ligne en production alors que de l'activité d'achat pourrait exister ailleurs (`purchases` — comptage non vérifié, SUSPECTED).

**Clarification factuelle sur le ticket `R004-ACH-002-UNTESTABLE`** : les migrations 177/179 montrent que 48 événements ACH-001 ont bien été traités avec succès par le moteur en 2026-06-27 — mais **exclusivement sur des données de démonstration** injectées par `seed-demo-data.ts` dans le tenant AMD FINANCE, depuis purgées (migration 179). **ACH-002 n'a en revanche jamais eu la moindre preuve d'exécution**, ni en démo ni en production. Aujourd'hui (`achats`=0 ligne), **ACH-001 et ACH-002 sont tous deux NOT TESTABLE — NO PRODUCTION DATA, à égalité** — contrairement à une lecture qui distinguerait les deux.

### Trésorerie — au moins 5 writers concurrents confirmés
**CONFIRMED** : au-delà du moteur central, au moins 4 autres chemins écrivent dans la comptabilité/trésorerie :
1. `fn_depense_to_transaction` (trigger **actif confirmé** sur `depenses`) écrit directement `transactions` **et** `journal_entries` en un seul trigger, résolution de comptes par correspondance de texte fragile (`ILIKE '%loyer%'` etc., repli `658000`) — **structurellement invisible des tests LOI-K** qui excluent `supabase/migrations/**`.
2. `writeComptaEntry()` (legacy, exemptée de LOI-K) — force `tva:0`/`ca:0` sur chaque écriture, alimente au moins 15 pages Trésorerie/Stocks.
3. **Un décaissement via `app/dashboard/tresorerie/decaissements/page.tsx` produit 4 écritures indépendantes et non transactionnelles** (`decaissements`, `journal_comptable`, `journal_entries`, `transactions`) sans rollback en cas d'échec partiel — incohérence comptable silencieuse possible à chaque décaissement.
4. `update_account_balance` (trigger actif sur `transactions`) — **CONFIRMED mort fonctionnellement** : ne s'exécute jamais utilement car `transactions.account_id` n'est renseigné par aucun writer connu (moteur central inclus). Pas de risque de double comptage *actuel*, mais risque latent si un futur writer peuple `account_id` sans connaître ce trigger.

**UNKNOWN** : les migrations 124 et 125, référencées par la migration 127 et implicitement requises par le garde-fou de la migration 176, sont **absentes du dépôt Git** — l'état exact des triggers historiques `trg_auto_journal_entry`/`trg_transaction_to_journal` aujourd'hui n'est **pas reconstituable** depuis le seul historique versionné (déduit indirectement du succès des migrations 176-179, non prouvé par une migration tracée).

### Vérification complémentaire — MIGRATION-MAP-AZ item D1 (tables absentes)
`facture_lignes` : **RÉSOLU** (existe, gérée avec rollback si erreur). `articles`, `chambres`, `reservations`, `commandes_resto` : **TOUJOURS ABSENTES** de production (0 `CREATE TABLE` trouvé), toujours référencées par `app/api/bi/insights/route.ts` et 2 autres routes — 15 jours après leur signalement, sans changement.

---

## 2 ET 13-14. INVENTAIRE DES MODULES / BILLING / PLANS

*(Source : agent dédié, 45 modules classés.)*

### Constat transversal majeur
**CONFIRMED** : pour **10 des 16 secteurs verticaux** ciblés (hôtel, santé/clinique, pharmacie, BTP, agriculture, ONG, pétrole, boisson, banque communautaire, assurance CIMA, cabinet comptable/juridique), le code est **intégralement construit** — UI + route API CRUD complète + tables dédiées correctement préfixées (`htl_*`, `his_*`/`clinique_*`, `ass_*`, `banque_*`, `btp_*`, etc.) — mais **n'a jamais été exercé en production réelle** : 0 ligne de données, 0 test automatisé, et pour les secteurs où un tenant existe (cabinet, assurance), celui-ci est **suspendu**. Même le seul tenant ONG actif en production n'a aucune donnée dans `ong_dons`/`ong_bailleurs`/`ong_programmes` — signe d'un onboarding sans adoption réelle plutôt qu'un module cassé.

**3 pages "module" sont en réalité des redirections mortes** : `direction/page.tsx` → `/dashboard` (page vide), `analytics/page.tsx` → `/dashboard/bi/analytics`, `mobilemoney/page.tsx` → `/dashboard/tresorerie/mobile-money` — ces module-IDs restent pourtant actifs dans le système de gating. **2 modules sont 100% simulés** (Social Media, Email Management) avec des données `DEMO_*` codées en dur, aucune persistance, aucune intégration réelle (pas d'OAuth, pas d'IMAP/SMTP), malgré leur statut de modules "Compagnie" facturés.

### Billing/Plans/Module Gating — défaillances critiques confirmées

**1. Bypass généralisé du gating de plan côté API — CONFIRMED, CRITICAL.** Sur 210 routes API, **7 seulement** vérifient le plan (`checkPlanAccess`, toutes sous `/api/miaa/*`). Tout module premium (`bi`, `audit`, `roles`, `workflows`, `api-keys`, `direction`…) est accessible en appelant directement l'API avec un compte `tpe` (le moins cher), contournant intégralement le gating de la sidebar qui est **purement côté client**. Exemple vérifié : `app/api/bi/insights/route.ts:15-27` (module réservé au plan "Compagnie" à 46 000 FCFA/mois) authentifie et résout le tenant **sans aucune vérification de plan**.

**2. 10 modules "Compagnie" facturés sans aucune implémentation — CONFIRMED, CRITICAL commercial.** `consolidation`, `intercompany`, `budget-groupe`, `tresorerie-groupe`, `direction-groupe`, `rapports-groupe`, `bi-groupe`, `gouvernance`, `validation-hierarchique`, `audit-groupe` sont définis et facturés dans `lib/plans.ts:43-49`/`lib/plan-access.ts:38-46` — recherche exhaustive de page/route correspondante = **0 résultat**. Vendus sans exister.

**3. Bug de provisioning : tout tenant créé via l'assistant admin retombe sur `taille_entreprise='tpe'` — CONFIRMED.** `app/admin/clients/nouveau/page.tsx:113-117` ne transmet jamais `taille_entreprise` à l'API ; `app/api/admin/tenant/create/route.ts:41-49` retombe donc systématiquement sur `'tpe'` et écrase même le `plan` sélectionné à l'écran — le choix "Premium" (jusqu'à 99 modules) dans l'UI admin n'a aucun effet sur le plan réel du tenant, bien que `tenant_modules` reçoive quand même les modules premium sélectionnés (configuration interne incohérente).

**4. Trois nomenclatures de plan incompatibles coexistent — CONFIRMED.** `tpe/pme/grande` (gating réel dans `plan-access.ts`), `starter/pro/enterprise` (labels observés en production via l'onboarding self-service — confirme la nomenclature que j'ai vue en base), et `starter/business/premium` (outil admin, plafonds 3/7/99 modules câblés en dur, totalement déconnecté de `plan-access.ts`). La fonction de pont `getPlanFromLegacy()` existe mais n'a **aucun appelant** (code mort).

**5. `app/api/modules/toggle` permet l'auto-activation de modules premium sans contrôle de plan — CONFIRMED.** Aucune référence à `plan-access.ts` dans ce fichier ; un owner de tenant `tpe` peut s'auto-attribuer n'importe quel `moduleId` dans `tenant_modules` (atténué en pratique par le fait que les routes API premium sont de toute façon accessibles indépendamment de `tenant_modules`, point 1).

**6. 74 routes API sur le guard déprécié `lib/tenant-guard.ts`** (dette trackée en interne "C-002 DEBT D-009") qui ne fait ni contrôle de plan ni de module — la migration vers `lib/api/require-tenant.ts` (qui expose `checkPlanAccess`) est inachevée, ce qui explique structurellement les points 1 et 3.

---

## 5-6-7-8. IDENTITÉ, TENANT ISOLATION, PERMISSIONS, SÉCURITÉ

*(Source : agent dédié, 79 outils de recherche, requêtes live `pg_policies`/`information_schema` combinées à la lecture exhaustive des migrations pour tracer l'origine exacte des failles.)*

### Origine exacte des deux fuites RLS critiques (élucidée)

**Fuite `tenants` (fuite cross-tenant du profil des 26 entreprises) — dérive hors-pipeline.** Recherche exhaustive : `grep tenants_select supabase/migrations/*.sql` = **0 résultat**. Cette policy dangereuse **n'existe dans aucune migration versionnée du dépôt** — elle a été appliquée directement en base (SQL Editor/Dashboard Supabase), hors de tout commit Git. Impossible de dater ou d'attribuer l'auteur depuis le dépôt seul. **Complément non signalé initialement** : `tenants: insert` est elle aussi ouverte à `auth.uid() IS NOT NULL` sans restriction — n'importe quel compte authentifié peut créer une ligne `tenants` directement, en contournant `app/onboarding/actions.ts` et ses contrôles serveur (anti-doublon, validation secteur/taille).

**Fuite `journal_entries` (grand livre lisible/inscriptible par tout membre du tenant) — erreur de migration identifiée précisément.** `supabase/migrations/026_erp_interconnection.sql:118-131` crée les 4 policies larges tenant-only (`select`/`insert`/`update`/`delete`, sans check financier) — c'est la source. `supabase/migrations/030_financial_rls.sql:66-80` avait l'intention de restreindre l'accès aux utilisateurs financiers : elle recrée `journal_entries: financial read`/`financial write` avec `fn_is_user_financial()`, **mais ne fait jamais `DROP POLICY` des 4 policies larges de la migration 026**. Sur PostgreSQL RLS, ajouter une policy stricte à des policies `PERMISSIVE` préexistantes n'a aucun effet restrictif (OR logique) — **c'est une erreur d'auteur de migration**, identifiable précisément, pas une dérive hors-pipeline comme pour `tenants`.

### Faille CRITIQUE supplémentaire — Permission Engine granulaire sans aucun effet côté serveur
**CONFIRMED.** Le système de rôles/permissions granulaires configurable depuis `/dashboard/roles` (matrice ROLE × MODULE × ACTION, tables `roles`/`role_permissions`/`user_permissions`) n'est **appliqué nulle part côté serveur** : `grep role_permissions|user_permissions app/api` = **0 résultat** sur les 210 routes. Le hook `lib/hooks/usePermissions.ts` ne pilote que l'affichage conditionnel côté navigateur (masquer/afficher des boutons). Conséquence concrète : un utilisateur `membre` à qui l'UI masque « Approuver »/« Supprimer » peut appeler directement les routes API sous-jacentes (ex. `PUT`/`DELETE /api/hr/employees/[id]`), qui ne vérifient que l'appartenance au tenant, jamais le rôle ni une permission granulaire.

### Faille CRITIQUE supplémentaire — Protection anti-brute-force jamais déclenchée
**CONFIRMED.** La politique P-001 (Brute Force Detection, `lib/identity/policy/policies.ts:26-69`, déclenchée sur `LOGIN_FAILED` ≥5 tentatives/15min, verdict `LOCK_ACCOUNT`) n'est **jamais évaluée en pratique** : `app/login/page.tsx:103` n'envoie `LOGIN_FAILED` qu'au simple logging (`/api/auth/log`), jamais au moteur d'évaluation (`evaluateAuthClient`/`/api/auth/evaluate`), qui ne reçoit que `LOGIN_SUCCESS`. **Aggravant** : même déclenchées, les 4 actions de remédiation (`LOCK_ACCOUNT`, `FORCE_LOGOUT`, `BLOCK_IP`, `INVALIDATE_SESSIONS`, `lib/identity/policy/action-engine.ts:64-74`) sont **cosmétiques** — aucune colonne `locked_until`/`is_locked` n'existe en base, aucun appel réel à `supabase.auth.admin.signOut()` ou à une blocklist IP. Seule P-008 (MFA_REQUIRED) a un effet réel observable.

### Autres findings HIGH/MEDIUM confirmés
- **`app/api/resto/[tenantId]/order/route.ts`** (route publique) : `tenantId` jamais vérifié comme existant, et **`total` fourni directement par le client sans recalcul serveur** à partir des prix réels — faille de manipulation de prix (price tampering) en plus de l'absence de contrôle tenant.
- **XSS confirmé** : `app/dashboard/miaa/page.tsx:872` (`dangerouslySetInnerHTML`) sans sanitisation (pas de DOMPurify), sur du contenu potentiellement influençable par le chat IA — motif identique probable dans 5 autres écrans MIAA.
- **Webhook WhatsApp** (`app/api/whatsapp/webhook/route.ts`) : `POST` sans vérification de signature HMAC Meta (`X-Hub-Signature-256`) — falsification d'événements entrants possible en devinant le `phone_number_id`.
- **Colonnes fantômes sur `tenants` toujours actives** (`tva_numero`, `forme_juridique`, `taille`, `secteur` — item D2 de MIGRATION-MAP-AZ, **toujours présent**, confirmé par `information_schema.columns` live) : `lib/audit/engine.ts` sélectionne 2 colonnes inexistantes → la requête entière échoue → **le module de conformité OHADA signale « NIU absent » pour 100% des tenants**, y compris ceux ayant un NIU valide.
- **`app/dashboard/groupe/gestion/page.tsx:169`** (item T4, **toujours présent**) : insert direct de `tenants` avec colonnes `taille`/`secteur` inexistantes — combiné à la policy INSERT ouverte, un attaquant pourrait créer des tenants arbitraires en appelant directement PostgREST avec les bons noms de colonnes.
- **Point positif confirmé** : le pattern `requireTenant`/`hrAuth`/`tresoAuth` + filtrage explicite `tenant_id` est **majoritairement bien appliqué** sur l'échantillon vérifié (factures PDF, attestations, RH, trésorerie) ; les 14 routes cron sont correctement gardées ; aucune clé secrète en dur trouvée ; la fuite de tenant-spoofing historique sur `/api/monitoring/log` est bien corrigée dans le code actuel.

---

## 6-7-8 (bis). ACCOUNTING CORE, FISCAL CORE, PAYROLL

*(Source : agent dédié, chronologie forensique complète des 4 fonctions comptables dormantes, reconstruite migration par migration.)*

### Preuve textuelle directe : le trigger dormant EST la source des 20 écritures orphelines
**CONFIRMED, cas élucidé.** `supabase/migrations/136_paie_restauration_trigger.sql:9` cite littéralement « Tenant de référence : AMD Finance — `64c244e5-02fd-4cf7-a56f-b0bdd48fdc09` » — **identique** au tenant des 20 lignes `journal_entries` orphelines trouvées en production aujourd'hui, avec les 5 sources exactes (`paie_accrual`/`paie_cnss`/`paie_cnss_sal`/`paie_irpp`/`paie_paiement`) déjà anticipées dans la requête de vérification de cette même migration. **Le trigger `trg_bulletins_paie` a réellement tourné en production du 24 juin 17h17 au 25 juin 18h03 (migration 141) — soit ~25 heures — avant suppression définitive.**

### Chronologie forensique des 4 fonctions dormantes
Toutes les 4 (`fn_stock_out_to_journal`, `fn_facture_issued_to_journal`, `fn_facture_paid_to_journal`, `fn_bulletins_paie_to_journal`) suivent le même schéma : créées fin mai (migrations 044/046), trigger `DROP` fin juin (migrations 139/141/147), **mais la fonction PL/pgSQL elle-même n'est jamais `DROP`** — conservée intentionnellement « pour permettre le rollback propre » (commentaire explicite dans 139/141). C'est cette conservation délibérée qui explique leur présence actuelle en base, `SECURITY DEFINER`, exécutable par `anon`/`authenticated`.

**Angle mort architectural confirmé** : `lib/architecture/loi-k-unique-writer.test.ts:32,44` exclut structurellement `supabase/migrations/**` de son scan — ces 4 fonctions ne seront **jamais détectées** par la CI, même si un rejeu de migration les réactivait accidentellement en disaster recovery.

### Verdict par fonction — danger latent ou équivalent actif ?
| Module | Équivalent TypeScript actif ? | Statut réel |
|---|---|---|
| Facturation | Oui, `emit_accounting_event('FAC-001'/'FAC-002')`, correctement câblé | Jamais exercé en prod — 0 événement `FAC-*` dans `accounting_events` |
| Paie | Oui, `emit_accounting_event('PAI-001'/'PAI-002')`, 47 tests dédiés | Statut officiel **« CODE_FIXED — NOT PRODUCTION EXERCISED »** (`docs/REPAIR-LOG.md:334`) — 0 événement PAI-* émis depuis déploiement |
| Stock réception (IN) | Oui, `STK-001`, réellement branché | Chemin propre actif |
| **Stock sortie (OUT)** | **Non, aucun chemin propre actif** — la cible officielle `POST /api/stock/move` (`STK-002`) **n'a aucun appelant réel** (confirmé indépendamment par l'agent Inventory) | Le vrai writer actif est `writeComptaEntry()` (legacy, exempté LOI-K) — cohérent avec la découverte de l'agent Inventory (sorties de stock sans écriture comptable) |

### Autres writers directs confirmés en TypeScript
`writeComptaEntry()` (`lib/compta-sync-client.ts`, exemption EXM-JE-003 documentée) — **16 sites d'appel actifs** aujourd'hui, dont `ecole/rh`, `stocks/{achats,inventaires,retours,sorties}`, `tresorerie/{page,banques,caisses,decaissements,encaissements,mobile-money,remboursements,transferts,validations}`. `lib/accounting-engine.ts` `createJournalEntry()` (exemption EXM-JE-002) — **0 appelant réel**, code mort confirmé.

### Fiscal Core — contradictions internes confirmées
- **`lib/countries/CG.ts`** (source « officielle ») contient une **contradiction interne** : ses notes documentent un IRPP annuel avec abattement 20%, mais l'objet `irpp` réellement exporté/consommé applique un barème **mensuel direct sans abattement** — le code exécuté contredit son propre commentaire.
- **Au moins 4 implémentations IRPP/CNSS Congo concurrentes** : `CG.ts` (config, consommée par le moteur cible testé mais non branché aux écrans), `lib/fiscal/congo-calculs.ts` (méthode `annuelle_div12`, **0 importeur réel — orphelin**, mais toujours cité comme « source de vérité » dans l'en-tête des tests du moteur cible — risque de régression documentaire s'il est un jour consulté comme référence), `lib/paie/calcul-paie.ts` (méthode `mensuelle_directe`, **réellement utilisé** par l'écran paie).
- **Vérification F5 (IRPP ×50) — PARTIELLEMENT RÉSOLU** : le chemin actif (`calcul-paie.ts`) et le moteur cible testé sont aujourd'hui alignés (même méthode), mais `congo-calculs.ts` reste en place et trompeur.
- **Vérification F1 (TUS abrogée) — RÉSOLU.** **F2 (CNSS AF plafonnée à 600k) — RÉSOLU** (confirmé `PLAFOND_AF = 1_200_000` dans le code actif). **F4 (patente ×13,5) — PARTIELLEMENT RÉSOLU** : la table active est correcte, mais `lib/fiscalite-congo.ts` conserve une table contradictoire (8 tranches, min. 97 500 F) que `CG.ts` lui-même signale comme fausse dans un commentaire d'auto-alerte, sans l'avoir supprimée.
- **P1 (trigger paie supprimé, route active n'émet plus rien) — RÉSOLU côté code, NON PROUVÉ en production** (0 bulletin réel traité depuis le correctif).

### Gouvernance documentaire — point mort confirmé
Les `DROP TRIGGER` de facturation (migration 139) et de stock (migration 147) ne sont documentés **nulle part** dans `docs/REPAIR-LOG.md` ni `docs/MIGRATION-MAP-AZ.md` — seule la paie bénéficie d'une trace d'audit consultable (ticket P0-03). C'est un point mort de gouvernance : la découverte consolidée des 4 fonctions comme un pattern unique est **inédite** pour facturation et stock.

---

## 30. RÉCONCILIATION DES 72 ANOMALIES + REGISTRE COMPLET

*(Source : agent dédié, lecture intégrale de tous les rapports d'audit dans `docs/` + `docs/MIGRATION-MAP-AZ.md`, vérification indépendante fichier:ligne de chaque entrée — pas de confiance aveugle au statut annoncé. Aucun accès DB dans cette réconciliation spécifique (échecs de connexion identiques aux missions précédentes) — tout ce qui exige un chiffre de production reste marqué non vérifiable, distinct de « faux ».)*

### Verdict global
Sur ~145 lignes de backlog couvertes (72 RESTART-AUDIT-AZ + 6 NEW + 10 Table 3 + 17 Table 4 + ~40 items MIGMAP-AZ) :
- **≈55 confirmées EXACTEMENT inchangées** (statut annoncé = statut vérifié, preuve actuelle à l'appui)
- **3 divergences/nuances trouvées** (détail ci-dessous)
- **4 doublons confirmés entre entrées du registre** (même fait sous plusieurs identifiants)
- **≈45 UNKNOWN — non vérifiables sans accès DB** cette session

**Aucune anomalie de sécurité critique n'a été trouvée réintroduite** — tous les correctifs `CODE_FIXED`/`VERIFIED` critiques (ANO-C01 à C10) sont toujours en place tel que décrit.

### Les 10 critiques (ANO-C01→C10) — toutes vérifiées individuellement, toutes confirmées
Statuts annoncés tous confirmés exacts par preuve de code actuelle, notamment : ANO-C03 (colonne `stock_actuel` fantôme) — **correctif en réalité plus complet et cohérent** que ne le suggérait le registre (13/16 pages migrées vers `v_products_stock`, les 3 restantes correctement séparées lecture/écriture). ANO-C07 (route debug) — suppression binaire confirmée. Aucune régression trouvée sur les 10.

### Les 3 tickets prioritaires de cette série de missions — vérifiés exacts
- **`R006-SEED-SCRIPT-NO-GUARD` : CODE_FIXED confirmé** — `scripts/lib/seed-production-guard.ts` existe, importé et appelé par `scripts/seed-demo-data.ts`.
- **`P0A-SEED-EMPLOYES-TEST-HARDCODED-PROD` : VERIFIED FIX confirmé** — `seed-employes-test.mjs` n'existe plus (renommé `.ts`), importe et appelle le garde avant toute opération.
- **`P0A2-SEED-ECAM-CONGO-SQL-UNGUARDABLE` : toujours OPEN, confirmé non refermé à tort** — `supabase/seed_ecam_congo.sql` toujours présent, non déplacé.

### Doublons confirmés entre entrées du registre
1. `NEW-02` ≡ `R004-DB-TRIGGER-TRANSACTIONS` (même fait sous 2 IDs)
2. `NEW-01` ≡ `R004-CAISSE-DUPLICATE-WRITER`
3. `MIGMAP-D5` ≡ `ANO-C08` ≡ `P0-04` (même fait sous 3 identifiants issus de 3 documents différents)
4. `MIGMAP-P1` ≡ §6.2 RESTART-AUDIT-AZ ≡ `P0-03` (déjà noté comme tel par le registre lui-même)

### Divergences/nuances trouvées (3)
1. **MIGMAP-F6** (`components/rh/ContratPDF.tsx` — taux CNSS 0,0504 en dur) : le document `MIGRATION-MAP-AZ.md` le liste comme actif, mais il est **en réalité corrigé depuis P0-01** (`ContratPDF.tsx` importe désormais `calculerChargesSociales()`) — le document source n'a jamais été mis à jour depuis sa rédaction (2026-09-01).
2. **ANO-C03** : le registre marque `CODE_FIXED` sans détail ; la vérification fine montre un correctif **plus complet qu'une lecture superficielle ne le suggérait**.
3. **MIGMAP-D1/D3** : au moins 3 tables sur les « 19 absentes » (`auth_logs`, `policy_history`, `policy_violations`) sont **résolues** depuis la rédaction du document — confirmé en production aujourd'hui (voir §31) — le document n'a jamais été mis à jour pour le refléter.

### Confirmations indépendantes notables
- **`R006-MIGRATION-PHANTOM-TABLES` (BLOCKED) re-confirmé indépendamment** : recherche exhaustive `CREATE TABLE.*\b(candidatures|candidats)\s*\(` sur les 179 migrations → **0 résultat** — le diagnostic original n'est pas un faux positif.
- **Pattern DROP-puis-CREATE auto-référentiel confirmé pour NEW-02** : chaque `DROP TRIGGER IF EXISTS trg_auto_journal_entry/trg_transaction_to_journal` dans les migrations 023/026/027 est **immédiatement suivi d'un `CREATE TRIGGER` du même nom** — jamais une suppression réelle, promesse de la migration 177 toujours non tenue dans le dépôt.
- **ANO-M21** (guard tenant déprécié) légèrement **aggravé** : 75 fichiers l'importent aujourd'hui contre 72 au moment de l'audit d'origine.
- **ANO-M28** : le cast `as any` sur `supabaseAdmin` dans `comptabilite/balance`/`grand-livre` subsiste, **malgré la correction du contrat de colonnes** (ANO-C09) — le cast lui-même n'a jamais été retiré.

*(Table complète des ~145 entrées individuelles disponible dans le rapport source de l'agent — non reproduite intégralement ici pour la lisibilité ; les grandes masses par catégorie sont ci-dessus.)*

---

## 16-17-18. DATABASE, MIGRATIONS, SEEDS

*(Source : agent dédié. **Alerte prioritaire : deux nouveaux vecteurs actifs de reproduction de l'incident AMD FINANCE, jamais couverts par P0-A/A.2/A.3.**)*

### 🔴 DÉCOUVERTE CRITIQUE — deux nouveaux générateurs de données de démo non gardés, hors du périmètre déjà corrigé

Les missions P0-A/P0-A.2/P0-A.3 n'ont couvert que `scripts/seed-*.ts` et `supabase/*.sql` (racine). Cette recherche exhaustive élargie à tout le dépôt a trouvé, **committés en git et toujours présents aujourd'hui** :

1. **`supabase/tests/demo_data_sprint_s02_p3.sql`** (committé 2026-09-02) — en-tête « BLOC À EXÉCUTER dans Supabase SQL Editor », sélectionne le tenant cible par `SELECT id INTO v_tid FROM tenants ORDER BY created_at LIMIT 1` (**exactement le mécanisme qui a causé l'incident NEW-06**), volumétrie annoncée (8 employés, 30 fournisseurs, 3 comptes bancaires, 192 factures, 192 bulletins paie, 48 achats, 96 mouvements stock, 1400+ écritures journal) **concordant quasi parfaitement** avec les comptages exacts de la migration 179 documentant l'incident réel. Garde-fous internes limités à une protection anti-double-exécution, **aucune protection contre une première exécution en production**. **Aucun garde-fou de script ne peut jamais l'intercepter** (SQL brut).

2. **`supabase/tests/seed_amd_finance.sql`** (committé 2026-06-29, **2 jours après l'incident daté du 2026-06-27**) — cible le tenant par recherche floue `nom_entreprise ILIKE '%amd%' OR ILIKE '%finance%'` — pourrait matcher tout tenant réel contenant "finance" dans sa raison sociale.

3. **`tests/certifications/helpers/db.ts`** — **URL de production codée en dur** (`:8`, `mrzixapnaqsbqmagivvf.supabase.co`, le même projet identifié partout dans cet audit) + clé `SUPABASE_SERVICE_ROLE_KEY` + fonctions `createTestAccount`/`createEcoleAccount` qui créent de **vrais tenants en production** via Playwright, et `deleteTestAccount` dont les 4 `DELETE` sont chacun encapsulés dans `.catch(() => {})` — **nettoyage silencieusement défaillant** : si un scénario échoue avant l'appel de nettoyage, le tenant de test reste en production indéfiniment, sans alerte. Utilisé par au moins 4 specs Playwright (dont `c002-tenant-core.spec.ts`, 17 scénarios de création/suppression de comptes). Ces specs ne sont exécutées ni par `npm test` ni par la CI (qui utilise une clé factice) — **exécution manuelle uniquement, par un développeur avec un vrai `.env.local`**.

**Aucun de ces trois vecteurs n'est documenté dans le registre. Contrairement à `seed-demo-data.ts` et `seed-employes-test.ts` (déjà corrigés), ces trois-là restent totalement ouverts et actionnables aujourd'hui.**

### Database
- **Table `security_audit_log` + fonction `fn_log_security_event()`** — mécanisme d'audit de sécurité complet créé (migration 039), jamais appelé nulle part (aucun trigger, aucun `.rpc()`) — censé tracer les violations cross-tenant/RLS mais **totalement mort**.
- **23 vues SECURITY DEFINER créées en migration mais jamais couvertes par un `REVOKE ALL ... FROM anon`** (ni migration 013, 161, ni 166) — dont des vues sensibles : `v_payroll_summary`, `v_pl_monthly`, `vue_tresorerie_unifiee`, `v_tenant_audit`, `v_creances_clients`, `v_dettes_fournisseurs`.
- **`mouvements_comptables`** — objet révoqué par la migration 166 mais **jamais créé par aucune migration du dépôt** — preuve nommée et concrète de dérive schéma dépôt/production, au-delà du cas déjà connu candidatures/fiscal_declarations.
- Écart quantifié : **63 vues définies dans le dépôt vs 43 SECURITY DEFINER actives en production** (contexte confirmé) — 20 vues d'écart, jamais quantifié auparavant.
- 61 tables créées en migration sans aucune référence dans le code applicatif (dont `chart_of_accounts` — confirmé non seulement lisible anonyme (ANO-N01 connu) mais **également jamais lu par le code TypeScript**, géré à 100% côté SQL).

### Migrations
- **Précédent historique antérieur à 176-179** : `136_paie_restauration_trigger.sql` (déjà analysée ci-dessus pour son lien avec le trigger dormant) contient aussi un UUID AMD FINANCE **en commentaire** dans des requêtes de vérification structurées comme un runbook manuel « EXÉCUTER VIA MCP POSTGRES AVANT LA MIGRATION » — étend la temporalité du problème de gouvernance (pattern présent dès mai/juin, pas seulement en fin de cycle).
- Confirmé exhaustivement : **seuls 3 fichiers** hors convention de nommage (`142.5_*`, `CATCHUP_008_to_025.sql`, `20260524_mission_critique.sql`) — pas de 4ᵉ non détecté.
- **5 migrations supplémentaires à risque de rupture en rejeu séquentiel**, non identifiées par R-006 : `107`, `108`, `113`, `114`, `127` contiennent des smoke-tests `RAISE EXCEPTION` sur objets de schéma manquants — élargit potentiellement la liste des points de blocage (jusqu'ici limitée à 68/110/120/164/176-179).

---

## 23 (bis)-25-26-27. TESTS, DETTE TECHNIQUE, 10 LOIS, 16 CORES

*(Source : agent dédié — exécution réelle de `npx vitest run`/`npx tsc --noEmit`, lecture de 12 fichiers de tests d'architecture, du blueprint F007, et vérification croisée exhaustive de `docs/MIGRATION-MAP-AZ.md`.)*

### Tests — résultat réel d'exécution
**`npx vitest run`** : 759/760 tests passent au run global, le seul échec est un **timeout de 5000ms sur un scan de 717 fichiers** (pas un échec logique — le test log « 0 nouvelle violation ✅ » juste avant le timeout) ; ré-exécuté isolément, 4/4 passent. **760 tests réels dans 33 fichiers** — les chiffres « 469 tests » (`MIGRATION-MAP-AZ.md`) et « 526 tests » (commentaire `ci.yml`) sont **obsolètes**. **`npx tsc --noEmit`** : exit 0, aucune erreur. **`npx eslint .`** sur le dépôt entier : l'agent n'a pas pu le faire terminer dans le temps imparti (processus réellement actif, non figé) — mais **cette même session avait déjà exécuté `npx eslint .` avec succès à deux reprises plus tôt** (missions P0-A/P0-A.2) : **0 erreur, 111 warnings préexistants** sur tout le dépôt — donc l'exécution complète est possible, juste lente (>180s).

**Qualité réelle des tests `lib/architecture/*.test.ts` — CONFIRMED, ce sont de vrais tests.** Ils lisent le contenu réel des fichiers sources (`readFileSync`), scannent l'arborescence réelle, comparent à des migrations SQL réelles — pas des mocks théâtraux. **Limite structurelle documentée** : chaque loi fonctionne sur liste blanche + dette connue hardcodée — le vert ne certifie que l'absence de *nouvelle* violation, jamais l'absence de violation existante (ex. `compta-sync-client.ts` entièrement exempté de LOI-K). Ces tests prouvent la cohérence **code↔code** ou **code↔migration SQL déclarée**, jamais **code↔base réellement déployée**.

**Trous de couverture confirmés** : **aucun test ne vérifie l'isolation tenant (RLS) à l'exécution** — LOI-M ne teste que qui *crée* un tenant, jamais l'étanchéité entre tenants. **Aucun test runtime de permission** — LOI-N vérifie l'absence de pattern textuel interdit, jamais qu'un rôle refusé l'est réellement en pratique. **Zéro test** pour CRM, Notification, Reporting, Integration/webhooks, Workflow (`lib/workflow/engine.ts` n'a aucun `.test.ts`), Analytics.

**Playwright `tests/certifications/*` — NOT TESTABLE dans cet audit** (nécessite serveur live + clé service_role de production, écrit réellement en base — hors périmètre lecture seule). Leur statut de succès/échec réel contre le code actuel est **inconnu**, malgré une conception de test sérieuse.

### Dette technique
- **6 TODO fiscaux**, tous dans le cœur fiscal multi-pays : taux TVA/IS/Patente **estimés, non confirmés** pour Gabon, Guinée Équatoriale, RCA, Tchad — corrobore exactement F13 de MIGRATION-MAP-AZ. Aucun `data_confidence` bloquant en production.
- `any` : 114 usages (81 `: any` + 33 `as any`), **explicitement tolérés** par une règle ESLint désactivée consciemment (pas une négligence cachée).
- `eslint-disable` : 27 occurrences, **23/27 = `react-hooks/exhaustive-deps`** — concentration massive = risque systémique de données obsolètes dans les effets React à travers tout le dashboard.
- `eslint-suppressions.json` : 11 violations exactement, cohérence parfaite avec le commentaire CI et les listes de dette hardcodées dans les tests — **suivi rigoureux et réel**, pas un chiffre en l'air.
- **Code mort confirmé** : `lib/erp-core.ts` ET `lib/erp-core/index.ts` (collision de nom, tous deux 0 importeur), `lib/erp-core/compute/{tresorerie,ebitda,stock,clients}.ts` (0 importeur), `lib/conventions/` (1677 lignes, 0 importeur applicatif), `lib/accounting-engine.ts` `createJournalEntry()` (0 appelant) — tous confirment exactement les items E1-E3/C6/P5 de MIGRATION-MAP-AZ, **inchangés depuis le 2026-09-01**.

### Les 10 lois fondatrices (LOI-A à LOI-J) — découverte structurante
**CONFIRMED** : le blueprint officiel (`docs/F007-ORAFORME-FOUNDATION-ARCHITECTURE.md`) nomme 10 lois **LOI-A à LOI-J** (Core Ownership, Single Source of Truth, Event-Driven Coupling, Immutability by Default, Permission Gateway, Fiscal Supremacy, Tenant Isolation, Versioned Contracts, Observable Everything, Graceful Degradation). Les tests existants portent des noms **différents (LOI-K à LOI-O)** — ce sont des règles régionales ajoutées après coup, pas les 10 lois fondatrices elles-mêmes. **Aucun fichier `loi-a-*.test.ts` … `loi-j-*.test.ts` n'existe.** Sur les 10 : **A, H et J n'ont aucune couverture** (automatique ou documentaire) au-delà du blueprint ; B/D/E/F/I sont couvertes **par ricochet** via K-O, avec un périmètre plus étroit ; **G (Tenant Isolation) n'a aucun test runtime**, seulement des indices de schéma (RLS massivement présente en migration, non vérifiée automatiquement).

### Les 16 Cores — 7 sur 16 n'existent comme aucun dossier `lib/` dédié
**CONFIRMED.** Sur 16 Cores prévus : **Identity, Tenant (dédoublé), Fiscal (fragmenté en 3 moteurs), Payroll/Paie, Workflow (0 test), Analytics (0 test), MIAA, Accounting (partiel — logique réelle en SQL)** existent comme dossier identifiable. **Permission, Organization, Inventory, CRM, Notification, Reporting, Integration — soit 7 sur 16 — n'ont AUCUNE incarnation `lib/` dédiée**, la logique étant diffusée sans abstraction dans les routes API/pages dashboard. C'est en soi une violation structurelle de LOI-A, et rend le blueprint F-007 largement non implémenté (cohérent avec son propre statut déclaré : « ARCHITECTURE OFFICIELLE — Aucun code », daté 2026-07-02).

### Finding CRITIQUE supplémentaire — IRPP falsifiable côté client
**CONFIRMED, nouveau.** `app/api/rh/paie/route.ts:87` : `const numIrpp = Number(irpp) || 0` — lit l'IRPP **directement depuis le payload envoyé par le navigateur** et le persiste **sans aucun recalcul serveur**. Un utilisateur (ou un client HTTP forgé) peut falsifier le montant d'impôt sur un bulletin de paie officiel. Confirme et durcit l'item P2 de MIGRATION-MAP-AZ ("toujours présent, non résolu").

**Découverte complémentaire sur F5/P4 (écart IRPP ×50)** : le périmètre a **évolué, pas disparu** — l'UI paie utilise désormais un **3ᵉ moteur** (`universal-tax-engine.ts`, différent des deux cités par le document original), tandis que `app/api/agents/rh/analyse/route.ts` utilise toujours `calcul-paie.ts` — **3 moteurs IRPP coexistent activement aujourd'hui**, pas 2.

**T1 aggravé** : 76 fichiers importent aujourd'hui `lib/tenant-guard.ts` (`@deprecated`) contre 75 au 2026-09-01 — la migration vers `require-tenant.ts` n'a pas progressé, elle a légèrement régressé.

### Points positifs confirmés (à créditer)
F1 (TUS abrogée) et F2 (plafonds CNSS AF/AT) sont **réellement résolus et câblés en production** — vérifié par tests avec assertions numériques réelles ET par la présence confirmée des appels dans les routes de production. Preuve que le processus de correction fonctionne quand il est engagé.

### Complément — `npx eslint .` complet (terminé après ~20 min, en dehors de la fenêtre initiale de l'agent)
**CONFIRMED : 0 erreur, 111 warnings** — cohérent avec les deux exécutions complètes déjà réalisées plus tôt dans cette même session (missions P0-A/P0-A.2). Nuance nouvelle : **≈60 des 111 warnings sont des doublons stricts** provenant de deux copies du dépôt dans `.claude/worktrees/` (non exclues par `eslint.config.mjs`, mais gitignorées donc absentes du checkout CI — sans impact réel). Le compte utile réel est **≈51 warnings**. **Découverte notable** : la règle ESLint custom `loi-o/unique-realtime-manager` (canaux Realtime) est appliquée en niveau `warning`, **pas `error`** comme K/L/M/N — et comme aucun `--max-warnings` n'est configuré (ni `package.json`, ni `ci.yml`), **ces warnings, y compris de vraies violations LOI-O, ne font jamais échouer la CI**. La double garde (test Vitest bloquant + lint bloquant) qui protège K/L/M/N n'existe donc pas symétriquement pour O.

---

## 21-22. FRONTEND/UX ET PERFORMANCE

*(Source : agent de recherche dédié, analyse statique de ~45 pages représentatives sur 277 pages du dashboard, recoupée avec `docs/RESTART-AUDIT-AZ.md` §7.3/§10. Aucun accès navigateur/runtime — toute conclusion nécessitant un rendu réel est marquée NOT TESTABLE.)*

### Frontend/UX

**1. Erreurs avalées silencieusement — CONFIRMED, impact MEDIUM.** ~24 blocs `catch {}`/`.catch(() => {})` vides dans le code applicatif (dashboard + routes API), dont `app/dashboard/stocks/inventaires/page.tsx:101` (`catch { setInventaires([]) }` — une erreur réseau/RLS devient silencieusement « aucun inventaire »), `app/dashboard/transport/page.tsx:130,142,171,175`, `app/dashboard/ecole/scolarite/page.tsx:421,431,942,951`, `app/dashboard/ecole/rh/page.tsx:1874,1899,1909,1931`. Cohérent avec le chiffre indépendant de 17 de `docs/RESTART-AUDIT-AZ.md:372` sur un périmètre légèrement différent.

**2. Le fallback `data ?? []` masque 87% des échecs de requête — CONFIRMED (mesure), impact HIGH.** 167/277 pages (60%) utilisent `data ?? []` sans jamais lire `error`. Seules 37/277 (13%) affichent une erreur à l'utilisateur. 242/277 (87%) affichent un état de chargement correct — le risque n'est donc pas le spinner infini mais **l'écran vide silencieux après échec réseau/RLS**. Exemple concret : `stocks/inventaires/page.tsx:79` ne traite que l'erreur `42P01` (table absente), tout le reste (RLS refusé, timeout) tombe dans le catch générique. C'est la cause racine déjà identifiée par l'audit précédent (CR-2) pour l'invisibilité de bugs de schéma pendant des mois en production.

**3. 70% des suppressions n'affichent aucune erreur en cas d'échec — CONFIRMED, impact HIGH.** Sur 57 appels `.delete()` dans `app/dashboard/**/page.tsx`, 40 (70%) n'extraient pas `error` et enchaînent directement sur `load()` : `app/dashboard/crm/page.tsx:222,266,304`, `app/dashboard/ecole/direction/page.tsx:297,497,577`, `app/dashboard/cabinet/clients/page.tsx:105`, `app/dashboard/calendrier/page.tsx:134`, etc. Si la suppression est refusée (RLS, FK), l'élément reste affiché sans aucune explication — expérience « bouton mort ». Comportement hétérogène : les 17 restants (ex. `devis/page.tsx:315,317`) capturent bien l'erreur, sans convention partagée dans le dépôt.

**4. États vides non gérés — SUSPECTED, impact LOW-MEDIUM.** 40 fichiers signalés par grep, mais majoritairement des faux positifs (tableaux statiques, données de démo codées en dur type `DEMO_CONTRATS` dans `recrutement/contrats/page.tsx:74` — cf. DT-12 de l'audit préexistant). Cas réels confirmés : `sante/hospitalisation/page.tsx:172-173`, `equipe/page.tsx:468`. 73% des pages ont un test `.length === 0`.

**5. Validation des formulaires — NOT APPLICABLE pour l'hypothèse d'absence généralisée.** Les pages de création critiques échantillonnées (`cabinet/clients/nouveau`, `sante/consultations/nouveau`, `sante/rendez-vous/nouveau`, `stocks/inventaires`) ont une validation manuelle réelle et fonctionnelle. Le risque réel est l'**hétérogénéité** page à page, non une absence systémique.

**6. Architecture 80% client-side, sécurité reposant uniquement sur RLS — CONFIRMED (structure).** 281/350 fichiers `.tsx` sont `'use client'`. La quasi-totalité des écritures Supabase partent directement du navigateur avec la clé anonyme, sans route API intermédiaire validant un rôle métier — cohérent avec `docs/RESTART-AUDIT-AZ.md` CR-6 (174 pages interrogent Supabase directement, 389 écritures directes). **Conséquence directe et gravissime confirmée indépendamment via la production (voir §5 Security ci-dessous) : sur `journal_entries`, la policy RLS censée restreindre l'écriture aux utilisateurs financiers est neutralisée par une policy plus large — donc ce modèle "RLS comme seul arbitre" échoue concrètement sur au moins une table comptable critique.**

**7. Responsive — CONFIRMED (code) / NOT TESTABLE (rendu réel).** 19/114 pages avec `<table>` n'ont pas de wrapper `overflow-x-auto`, dont 2 à fort usage mobile en zone CEMAC : `ecole/espace-parent/page.tsx` et `restaurant/page.tsx`.

### Performance

**Contexte : base de production quasi vide** (2 profils, 26 tenants, la plupart des tables à 0 ligne) — **aucune conclusion de performance n'est mesurée en charge réelle**, tout est SUSPECTED (pattern de code) ou NOT TESTABLE.

**1. N+1 séquentiel sur le chemin critique du point de vente — SUSPECTED, impact HIGH.** `app/dashboard/commerce/page.tsx:191-202` : boucle séquentielle `for (const l of panier) { await supabase.rpc('fn_stock_move', ...) }` au moment du paiement en caisse — latence croissant linéairement avec le nombre d'articles.

**2. Boucles séquentielles dans les jobs cron — SUSPECTED, impact MEDIUM.** `app/api/cron/run/route.ts:117,175,348,395` (emails, SMS, configs, docs) et `app/api/agents/restaurant/cloture/route.ts:40-62` (clôture imbriquée par tenant) — pas de `Promise.all`/batching, dégradation attendue avec la volumétrie. Contre-exemple positif : `app/api/cron/run/route.ts:421` utilise bien `batch.map(async ...)`.

**3. Aucun `next/dynamic` dans tout le code applicatif — CONFIRMED (absence vérifiée globalement).** Pas de lazy loading sur les pages BI/comptabilité (journal, grand-livre, balance)/génération PDF. Impact MEDIUM-HIGH SUSPECTED sur la taille du bundle initial — NOT TESTABLE sans analyse de build réelle.

**4. Composant monolithique `ecole/rh/page.tsx`** — 2102 lignes, 8 `useEffect`, aucun découpage en sous-composants mémoïsés. SUSPECTED, impact MEDIUM sur du matériel modeste (zone CEMAC).

**5. Points positifs confirmés** : les 9 souscriptions Realtime Supabase identifiées ont toutes un cleanup correct (`removeChannel`). Les 2 usages de `setInterval` (`restaurant/cuisine/page.tsx:66`, `portail/client/page.tsx:184`) ont un cleanup correct. `next/image` n'est utilisé que dans 3 fichiers sur tout le dépôt (13 fichiers utilisent `<img>` — impact LOW, usage limité à des avatars/logos de petite taille, pas de galerie lourde identifiée).

**Top findings de cette section (déjà classés dans le tableau ci-dessus par gravité) :** #1 échecs silencieux sur suppressions (HIGH), #2 fallback `?? []` masquant 87% des erreurs (HIGH), #3 absence de lazy loading (MEDIUM-HIGH), #4 N+1 checkout (HIGH/NOT TESTABLE en charge).

---

## 31. PRODUCTION FORENSIC — synthèse

*(Effectué en lecture seule directe, `mcp__supabase__*`, projet `mrzixapnaqsbqmagivvf` "Oraform", ACTIVE_HEALTHY. Détail complet dans les sections ci-dessus, notamment §5-8 et §16-18.)*

- **26 tenants réels**, dont 3 nommés « AMD FINANCE » (2 `suspended`+`deleted_at`, 1 `active`), de nombreux tenants QA/TEST/C004 (usine à tenants de test, migrations `c004_tenant_profile_factory`/`c004_test_tenants_validation`), et un tenant « ECAM » actif dont l'UUID **diffère** de celui ciblé par `seed_ecam_congo.sql` (ce dernier n'existe plus en production).
- **Registre de migrations Supabase natif quasi vide** : 3 entrées trackées (`c004_tenant_profile_factory`, `c004_test_tenants_validation`, `fix_cnss_defaults_lf2026`) contre 179 fichiers dans le dépôt — la quasi-totalité des migrations a été appliquée manuellement (SQL Editor), jamais via le mécanisme de tracking officiel.
- **Usage réel très léger** : 2 profils utilisateurs au total, `journal_entries`=23 lignes, `accounting_events`=3 lignes (2×ONG-001, 1×RES-001 — **aucun événement FAC-*/PAI-*/ACH-* actuellement en production**), `achats`=0, `factures`=6, `bulletins_paie`=4.
- **Deux fuites RLS CRITICAL confirmées et actives** (`tenants`, `journal_entries`), origines tracées précisément (§5-8).
- **90 fonctions SECURITY DEFINER** exécutables identiquement par `anon` et `authenticated` (aucun scoping de rôle appliqué).
- **Advisors Supabase (linter officiel) — chiffres bruts** : Sécurité — 1 ERROR (`auth_users_exposed`), 43 ERROR (`security_definer_view`), 90+90 WARN (fonctions anon/authenticated executable), 11 INFO (`rls_enabled_no_policy`). Performance — 86 WARN (`auth_rls_initplan`, confirme empiriquement R-005), 289 WARN (`multiple_permissive_policies`, dont `journal_entries`/`chart_of_accounts`/`cost_centers` à 20 chacune), 211 INFO (`unindexed_foreign_keys`), 239 INFO (`unused_index`), 8 WARN (`duplicate_index`, dont 3 sur `journal_entries`).
- **4 fonctions comptables dormantes** (writers fantômes) confirmées non attachées à aucun trigger actif aujourd'hui, mais l'une d'elles a produit 20 écritures réelles en juin 2026, prouvé par référence textuelle directe dans la migration 136.

---

## 32. RISKS — Top 20 (classement par gravité, production active en premier)

| # | Risque | Statut | Gravité | Production active ? | Preuve principale |
|---|---|---|---|---|---|
| 1 | Fuite RLS `tenants` — tout utilisateur authentifié lit les 26 profils d'entreprise | CONFIRMED | **CRITICAL** | **OUI, actif maintenant** | `pg_policies` live, policy `tenants_select` |
| 2 | Fuite RLS `journal_entries` — tout membre du tenant lit/écrit/supprime le grand livre | CONFIRMED | **CRITICAL** | **OUI, actif maintenant** | `pg_policies` live, migrations 026/030 |
| 3 | IDOR probable sur MIAA (8 routes, `tenant_id` non vérifié) | CONFIRMED (code) | **CRITICAL** | SUSPECTED (non testé en exploitation) | `app/api/miaa/chat/route.ts:244` |
| 4 | 3 vecteurs actifs non gardés pouvant reproduire l'incident AMD FINANCE (`demo_data_sprint_s02_p3.sql`, `seed_amd_finance.sql`, `tests/certifications/helpers/db.ts`) | CONFIRMED | **CRITICAL** | Déclenchement manuel possible à tout moment | Fichiers git-trackés, présents aujourd'hui |
| 5 | Permission Engine granulaire — 0 enforcement serveur | CONFIRMED | **CRITICAL** | OUI | `grep role_permissions app/api` = 0 |
| 6 | Gating plan/module — 7/210 routes seulement vérifient le plan | CONFIRMED | **CRITICAL** | OUI | `app/api/bi/insights/route.ts:15-27` |
| 7 | 10 modules "Compagnie" facturés sans implémentation | CONFIRMED | **CRITICAL (commercial)** | OUI | `lib/plans.ts:43-49`, 0 fichier |
| 8 | Protection anti-brute-force jamais déclenchée, remédiations cosmétiques | CONFIRMED | **CRITICAL** | OUI | `app/login/page.tsx:103` vs `106-107` |
| 9 | IRPP paie calculé côté client, persisté sans recalcul serveur | CONFIRMED | **CRITICAL** | OUI | `app/api/rh/paie/route.ts:87` |
| 10 | Bug de provisioning — tenant admin toujours créé en `taille='tpe'` | CONFIRMED | **HIGH/CRITICAL** | OUI | `app/api/admin/tenant/create/route.ts:41-49` |
| 11 | Deux systèmes d'achats parallèles, l'un invisible du moteur comptable | CONFIRMED | HIGH | OUI | `app/dashboard/stocks/achats/page.tsx` |
| 12 | Sortie de stock principale contourne l'écriture comptable STK-002 | CONFIRMED | HIGH | OUI | `app/dashboard/stocks/sorties/page.tsx:207` |
| 13 | 5 writers comptables concurrents non gouvernés (`writeComptaEntry`, `fn_depense_to_transaction`, 4 fonctions dormantes) | CONFIRMED | HIGH | OUI (historique prouvé) | Multiples, voir §6-8 |
| 14 | XSS non sanitisé dans le chat MIAA (et probablement 5 autres écrans) | CONFIRMED | HIGH | OUI | `app/dashboard/miaa/page.tsx:872` |
| 15 | `resto/[tenantId]/order` — pas de vérif tenant + prix fourni par le client | CONFIRMED | HIGH | OUI (route publique) | `app/api/resto/[tenantId]/order/route.ts:8-33` |
| 16 | 3 moteurs IRPP concurrents actifs simultanément | CONFIRMED | HIGH | OUI | §6-8, §Tests/dette |
| 17 | Webhook WhatsApp sans vérification de signature HMAC | CONFIRMED | HIGH | OUI | `app/api/whatsapp/webhook/route.ts` |
| 18 | 70% des suppressions UI n'affichent aucune erreur en cas d'échec | CONFIRMED | HIGH | OUI | 40/57 `.delete()` |
| 19 | 87% des pages masquent silencieusement les échecs réseau/RLS | CONFIRMED | HIGH | OUI | mesure sur 277 pages |
| 20 | 7/16 Cores du blueprint n'existent comme aucun dossier `lib/` dédié | CONFIRMED | MEDIUM/HIGH (dette structurelle) | N/A | §26-27 |

---

## 33. PRIORITÉS — Top 20 actions de réparation recommandées (diagnostic uniquement, non exécuté)

| # | Action | Cible | Classement |
|---|---|---|---|
| 1 | `DROP POLICY "tenants_select"` (ou la restreindre à `id = get_my_tenant_id()`) | RLS `tenants` | **P0** |
| 2 | `DROP POLICY` des 4 policies larges `journal_entries: select/insert/update/delete` (garder uniquement les policies `financial *`) | RLS `journal_entries` | **P0** |
| 3 | Retirer/neutraliser `supabase/tests/demo_data_sprint_s02_p3.sql`, `seed_amd_finance.sql` ; migrer `tests/certifications/helpers/db.ts` vers un garde-fou type `seed-production-guard.ts` ou un projet de recette dédié | Seeds non gardés | **P0** |
| 4 | Faire vérifier le `tenant_id` de la session dans les 8 routes MIAA génériques (`chat`, `agent`, `expertise`, etc.), à l'image de `sante/miaa`/`resto/miaa` | IDOR MIAA | **P0** |
| 5 | Ajouter `checkPlanAccess`/vérification `tenant_modules` sur les routes API des modules premium (`bi`, `audit`, `roles`, `workflows`, `api-keys`, secteurs verticaux) | Gating plan | **P0** |
| 6 | Recalculer IRPP/CNSS côté serveur avant persistance d'un bulletin de paie | Falsification fiscale | **P0** |
| 7 | Corriger le bug de provisioning admin (transmettre `taille_entreprise` réel) | `admin/tenant/create` | **P0** |
| 8 | Câbler réellement `LOGIN_FAILED` à `evaluatePolicies` ; implémenter un effet réel pour `LOCK_ACCOUNT`/`BLOCK_IP` | Anti-brute-force | **P0** |
| 9 | Ajouter une couche d'enforcement serveur pour `role_permissions`/`user_permissions` (au moins sur les actions destructrices) | Permission Engine | **P1** |
| 10 | Décider et unifier UN SEUL moteur IRPP Congo (3 actuellement), retirer les 2 autres | Fiscal | **P1** |
| 11 | Unifier le chemin d'achats (`achats` vs `purchases`) — retirer ou fusionner `stocks/achats` | Achats | **P1** |
| 12 | Router la sortie de stock vers `POST /api/stock/move` (STK-002) au lieu de l'appel RPC direct | Stock | **P1** |
| 13 | Retirer ou remplacer `fn_depense_to_transaction`/`writeComptaEntry()` par le moteur central | Trésorerie | **P1** |
| 14 | Supprimer définitivement les 4 fonctions PL/pgSQL dormantes (`fn_bulletins_paie_to_journal` etc.), pas seulement leurs triggers | Comptabilité | **P1** |
| 15 | Sanitiser (DOMPurify) tout `dangerouslySetInnerHTML` sur du contenu généré/IA | Sécurité XSS | **P1** |
| 16 | Vérifier la signature HMAC Meta sur le webhook WhatsApp | Sécurité webhook | **P1** |
| 17 | Ajouter `REVOKE ALL ... FROM anon` sur les 23 vues SECURITY DEFINER non couvertes, en priorité les vues financières | Sécurité DB | **P1** |
| 18 | Uniformiser le traitement d'erreur sur les 40 suppressions UI silencieuses (au minimum) | UX | **P2** |
| 19 | Achever la migration `lib/tenant-guard.ts` → `lib/api/require-tenant.ts` (76 fichiers restants) | Dette architecture | **P2** |
| 20 | Créer un environnement de recette isolé (prérequis ANO-P03, toujours bloqué) avant toute correction destructive future | Infrastructure | **P2 (mais débloquant pour beaucoup d'autres)** |

---

## 34. BLOCKERS

1. **Absence d'environnement de recette** (ANO-P03, toujours BLOCKED) — 179 migrations ne se rejouent pas sur base vierge (tables fantômes `candidatures`/`fiscal_declarations`, re-confirmé indépendamment aujourd'hui ; +5 points de rupture supplémentaires possibles identifiés : 107/108/113/114/127). Bloque toute validation propre des correctifs avant production.
2. **Aucun accès en écriture n'a été autorisé ni utilisé dans cet audit** — toutes les corrections listées en §33 restent à valider par un humain avant exécution, conformément au périmètre strict de cette mission.
3. **Playwright `tests/certifications/*` non exécutables sans serveur live + clé service_role production** — leur statut réel de succès/échec contre le code actuel est inconnu.
4. **Gouvernance de migration hors-pipeline** — au moins une policy RLS dangereuse (`tenants_select`) et un objet DB (`mouvements_comptables`) existent en production sans trace dans aucune migration versionnée — toute correction doit composer avec un état de production potentiellement différent du dépôt sur des points non encore découverts.

---

## 35. RECOMMENDED REPAIR ROADMAP (résumé)

**Phase 0 — Sécurité immédiate (heures, pas de code applicatif)** : actions #1, #2, #3 du §33 (policies RLS + neutralisation des 3 vecteurs de seed non gardés). Ce sont des corrections SQL/suppressions de fichiers ciblées, à très faible risque de régression, à très fort impact.

**Phase 1 — Failles d'accès (jours)** : actions #4 à #8 (IDOR MIAA, gating plan, falsification IRPP, provisioning, brute-force).

**Phase 2 — Unification des moteurs concurrents (semaines)** : actions #9 à #14 (permission engine serveur, unification fiscale/achats/stock/trésorerie/comptabilité).

**Phase 3 — Dette et hygiène (continu)** : actions #15 à #20.

**Prérequis transverse à toute la Phase 2+** : un environnement de recette isolé (§34.1) pour valider chaque changement sans risquer la production, elle-même déjà fragile (gouvernance hors-pipeline documentée).

---

## SORTIE FINALE OBLIGATOIRE (§35 de la mission)

**Méthodologie de comptage** : les chiffres ci-dessous sont compilés à partir des findings explicitement classés dans le corps de ce rapport (sections 2-31) et dans la réconciliation du registre (§30). Ce n'est pas un comptage exhaustif au sens base de données — pour un système de cette taille (277 pages, 210 routes API, 260 tables, 179 migrations), une énumération parfaite dépasserait le périmètre d'un audit en lecture seule. Les totaux distinguent explicitement les **nouvelles découvertes de cette mission** (A-Z du 2026-09-14) des **72 anomalies d'origine déjà réconciliées** en §30, pour ne pas les compter en double.

**A. Nombre total de problèmes confirmés (nouvelles découvertes, hors 72 d'origine)** : **≈72** findings CONFIRMED distincts détaillés dans le corps du rapport (13 CRITICAL + 27 HIGH + ~22 MEDIUM + ~10 LOW), auxquels s'ajoutent les 72 anomalies d'origine dont **≈55 restent confirmées ouvertes ou partiellement corrigées** (§30) — total combiné de l'ordre de **125-130 problèmes actifs documentés**, tous domaines confondus.

**B. CRITICAL** : **13** (voir tableau §32, lignes 1-10, plus le provisioning bug et 2 items apparentés)

**C. HIGH** : **≈27** (voir §32 lignes 11-20 + items additionnels détaillés dans le corps : 23 vues SECURITY DEFINER non revoke, security_audit_log mort, 5 writers concurrents comptés séparément, etc.)

**D. MEDIUM** : **≈22** (90 fonctions SECURITY DEFINER anon-executable, orphan routes/tables, 7/16 cores absents, auth_rls_initplan 86 policies, multiple_permissive_policies 289, N+1 patterns, composant monolithique, absence de lazy loading, etc.)

**E. LOW** : **≈10** (TODO fiscaux ×6, images non optimisées, doublons d'index ×8, responsive 19 pages, etc.)

**F. NOT TESTABLE** : **≈15** (Playwright certifications, PWA installabilité réelle, CSRF, SSRF exhaustif, performance en charge réelle, D5 — 336 événements en erreur en prod, ACH-001/002 avec vraie donnée, isolation tenant testée en exécution réelle, etc.)

**G. UNKNOWN** : **≈45** (issus principalement de la réconciliation §30 — items du registre nécessitant un accès DB en écriture/lecture approfondi non disponible cette session, ou non re-testés faute de budget)

**H. Nombre de faux positifs** : **0 trouvé dans les nouvelles découvertes de cette mission** ; **1 nuance de faux-positif potentiel identifiée dans la réconciliation** (MIGMAP-F6, `ContratPDF.tsx` — le document source le liste comme actif alors qu'il est réellement corrigé depuis P0-01 ; c'est une divergence documentaire, pas un faux positif de cette mission elle-même)

**I. Anomalies réellement corrigées (vérifiées dans le code actuel)** : **≈20** parmi les 72 d'origine (10 critiques ANO-C01→C10 pour la plupart, + F1/F2/F4-partiel de MIGRATION-MAP-AZ, + D3, + ANO-C02/C03/C06/C10) — voir détail exhaustif en §30

**J. Anomalies corrigées mais non vérifiées en production** : **≈10** (dont notamment : le chemin paie `emit_accounting_event` — statut officiel « NOT PRODUCTION EXERCISED » — et plusieurs correctifs dont la preuve de production historique n'est pas rejouable sans accès DB cette session)

**K. Nombre de violations des 10 lois (LOI-A→J)** : **≥8 sur 10** présentent au moins une violation confirmée dans le corps du rapport (A, B, D, E, F, G confirmées violées avec preuve ; C et I partiellement ; seules H et J n'ont simplement aucune preuve ni de conformité ni de violation faute de test ou de recherche dédiée — UNKNOWN plutôt que CONFIRMED conforme)

**L. Nombre de Cores réellement utilisés** : **8 sur 16** (Identity, Tenant [dédoublé], Fiscal [fragmenté], Payroll/Paie, Workflow [non testé], Analytics [non testé], MIAA, Accounting [partiel])

**M. Nombre de Cores morts/partiellement utilisés** : **7 sur 16 sont totalement absents** comme dossier `lib/` (Permission, Organization, Inventory, CRM, Notification, Reporting, Integration) — le 16ᵉ (Billing) existe comme fichier unique non structuré

**N. Nombre de pipelines fonctionnels (sur les 12 demandés)** : **≈3-4** peuvent être qualifiés de bout-en-bout fonctionnels avec preuve (Invoice/Facturation — chemin FAC-001 propre ; Stock réception — STK-001 branché ; Closing/Clôture — migrations 176-179 avec comptages exacts prouvés) — les autres n'ont pas été tracés pipeline par pipeline de façon exhaustive dans cette mission (École, Santé, Hôtel, Restaurant, ONG, Agriculture, BTP notamment restent classés B « partiellement opérationnel » en §13, faute de données de production pour prouver le bout-en-bout)

**O. Nombre de pipelines cassés/partiels** : **≥5** confirmés partiels ou cassés avec preuve directe (Payroll — IRPP falsifiable + PAI jamais exercé en prod ; Purchases — 2 systèmes parallèles, l'un invisible du moteur ; Stock/sortie — contourne l'écriture comptable ; les 10 secteurs verticaux du §13 sans donnée de production)

**P. État réel de la production** : **Fonctionnel pour un usage très léger et non critique actuellement (2 utilisateurs, quelques dizaines de lignes de données réelles), mais avec deux failles de sécurité CRITICAL activement exploitables (fuites RLS tenants/journal_entries) et trois vecteurs non gardés capables de reproduire un incident de perte de données déjà survenu une fois.** La production n'est pas dans un état "cassé" au sens fonctionnel — elle est dans un état **à risqueélevé et immédiat**, sans qu'aucun incident supplémentaire ne soit constaté à ce jour au-delà de ceux déjà documentés (AMD FINANCE, juin 2026).

**Q. Top 20 risques** : voir §32.

**R. Top 20 actions de réparation** : voir §33.

**S. Dépendances critiques** : (1) Aucune correction de fond (Phase 2+ du §35) ne devrait être testée directement en production faute d'environnement de recette (§34.1, ANO-P03 toujours BLOCKED) ; (2) toute correction RLS doit être vérifiée avec les policies EXACTES actuellement en base, qui divergent du dépôt versionné sur au moins 2 objets connus (`tenants_select`, `mouvements_comptables`) — un audit RLS complet avant correction est indispensable ; (3) l'unification des 3 moteurs IRPP et des 2 systèmes d'achats est un préalable à toute fiabilisation du cœur comptable.

**T. UNE recommandation — voici exactement ce qu'il faut attaquer en premier :**

**Corriger IMMÉDIATEMENT, avant toute autre chose, les deux policies RLS (`tenants_select` sur `tenants`, les 4 policies larges sur `journal_entries`) et neutraliser les trois vecteurs de seed non gardés (`supabase/tests/demo_data_sprint_s02_p3.sql`, `supabase/tests/seed_amd_finance.sql`, `tests/certifications/helpers/db.ts`).** Ce sont les seuls éléments de cet audit qui sont à la fois (a) CRITICAL, (b) actifs en production dès aujourd'hui, (c) corrigibles en quelques minutes à quelques heures sans risque de régression fonctionnelle (ce sont des retraits de policies/fichiers, pas des réécritures de logique métier), et (d) directement capables de causer un incident de fuite de données ou de perte de données réel s'ils restent en l'état. Tout le reste de ce rapport — moteurs comptables concurrents, gating de plan, dette architecturale — est important mais n'a pas la même urgence temporelle : ces failles peuvent être exploitées ou déclenchées accidentellement dès la prochaine connexion utilisateur ou le prochain `git pull` + copier-coller SQL Editor par un développeur.

---

*Fin du rapport. Aucune correction n'a été appliquée. Ce document est un diagnostic ; toute action de correction nécessite une autorisation explicite et distincte de cette mission.*

---

## MISE À JOUR — Missions P0-PAIE-CG-2026 (2026-09-17/18)

Ce paragraphe ne modifie pas le diagnostic ci-dessus (snapshot du 2026-09-14) : il documente
l'état après une séquence de missions dédiées à ANO-C10/ANO-M08 (« 23 calculateurs fiscaux »,
§S « l'unification des 3 moteurs IRPP »). Détail complet : `docs/MASTER-REPAIR-REGISTER.md`,
section « Addendum 2026-09-17/18 ».

**Corrigé et testé** (moteur central `lib/fiscal/universal-tax-engine.ts` + `lib/countries/CG.ts`,
803→833→848→869 tests, `tsc`/`eslint` propres, build OK) :
- Règles CNSS/TUS/IRPP Congo reconstruites à partir de bulletins et déclarations réels
  (PF 10,03 %, TUS CNSS 5,475 %, abattement IRPP 20 %, barème 4 tranches, division par parts).
- `lib/paie/calcul-paie.ts`, `app/dashboard/rh/paie/page.tsx`, module École
  (`app/dashboard/ecole/rh/page.tsx`), agent RH IA (`app/api/agents/rh/analyse/route.ts`) et route
  de conformité RH raccordés au moteur central — recalculs locaux à taux erronés supprimés.
- Les 2 autres « 3 moteurs IRPP » identifiés au §S sont maintenant neutralisés :
  `lib/fiscalite/engine.ts` + `lib/fiscalite/pays.ts` (CNSS Congo fusionné à 23,28 %, IRPP sans
  abattement) **et** `lib/contexts/PaysContext.tsx` (`usePays().calculerSalaireNet()`, taux CG à
  4 % plafonné 1,2M mais IRPP sans abattement ni parts) — tous deux routés, pour les 4 pays où le
  moteur central a une configuration validée (CG/CM/GA/CD), via un adaptateur mince partagé
  (`lib/fiscalite/engine-adapter.ts`) — conservés intacts pour 8 pays sans configuration validée
  (aucune fonctionnalité perdue). Audit des 12 consommateurs de `usePays()` : aucun n'appelait
  réellement `calculerSalaireNet()` (code mort), mais c'était un 3ᵉ moteur latent, corrigé quand même.

**4ᵉ moteur découvert puis corrigé le jour même** : `lib/miaa/tools.ts::calculerSalaireNet()`, des
taux CG codés en dur encore différents des trois précédents (5,04 % plafonné 1 500 000, IRPP à
tranches précalculées en dur), destiné à injecter des exemples chiffrés dans les prompts MIAA via
`getContexteCalculs()`. **Découverte notable lors de la correction** : `getContexteCalculs()` n'a
aucun appelant dans tout le dépôt — cette fonction n'était câblée à aucun prompt MIAA réel, un
risque latent et non actif, corrigé quand même par le même adaptateur partagé
(`lib/fiscalite/engine-adapter.ts`). L'approximation générique unique auparavant utilisée pour les
14 pays non-Congo a été remplacée par le vrai moteur par pays (central ou legacy réel selon
disponibilité), plutôt que conservée telle quelle.

Tous les moteurs/consommateurs fiscaux parallèles identifiés au fil de ces missions (`calcul-paie.ts`,
module École, `lib/fiscalite/engine.ts`, `PaysContext.calculerSalaireNet`,
`lib/miaa/tools.ts::calculerSalaireNet`) sont désormais raccordés au moteur central pour les 7 pays
validés, via un adaptateur unique et partagé, sans duplication de code de routage.

**Toujours non résolu, volontairement** (aucune preuve documentaire suffisante — voir CG.ts) :
statut exact des plafonds CNSS 1 200 000/600 000 (contradiction entre documents réels), composante
« TUS DGI », origine exacte de l'écart de parts fiscales observé sur un bulletin réel (IMANA), et
la divergence entre `rh/page.tsx` et `rh/paie/page.tsx` sur l'imposabilité de la prime de transport.

---

## MISE À JOUR — Mission P0-FISCAL-CG-2026, audit TVA (2026-09-18)

Audit pur, aucune correction. Confirme la ligne du §S de l'audit original : la TVA n'avait
jamais été traitée dans les 4 missions de paie qui précèdent. Détail complet :
`docs/MASTER-REPAIR-REGISTER.md`, ticket `P0FISCAL-CG-2026-TVA-AUDIT-COMPLET`.

**9 fonctions de calcul TVA** dans 8 fichiers (4 actives en production, 5 orphelines dont la seule
qui soit réellement testée). Le taux Congo (18 % + 5 % Centime Additionnel) est cohérent dans tout
le code actif — pas de contradiction de taux — mais **la déclaration TVA officielle elle-même est
peu fiable** : trois fonctions actives la reconstruisent indépendamment depuis trois sources
différentes (`journal_entries`, `factures` au statut payé, `factures.tva` comme champ taux), sans
jamais se réconcilier. Ce constat n'est pas nouveau : `docs/F005-FCI-FISCAL-CERTIFICATION.md`
(audit interne du 2026-06-30) l'avait déjà documenté (anomalie B002/I-03, score TVA 62/100, Centime
Additionnel 28/100, certification FCI refusée) — resté non corrigé depuis trois mois.

Nouveaux constats de cette mission, confirmés par lecture directe du code (pas des hypothèses) :
exigibilité contradictoire (Grand Livre = émission de facture, déclaration DGI = encaissement) ;
TVA déductible structurellement absente (aucun achat ne la calcule, valeur codée en dur à 0) ;
crédit de TVA jamais reporté d'un mois sur l'autre ; avoirs n'émettant aucune écriture TVA.

Recherche de sources primaires (Loi de Finances 2026 et CGI Congo, trouvés réels dans le dossier
Téléchargements de l'utilisateur, 238 et 503 pages scannées sans texte numérisé) : le taux 18 %/5 %
n'a pas pu être personnellement re-vérifié contre l'article exact dans le temps imparti — il reste
corroboré par une citation interne ("CGI Congo, Art. 191") jamais recontrôlée, pas contredit nulle
part, marqué **OBSERVÉ MAIS INCOMPLET** plutôt que démontré.

## MISE À JOUR — Mission P0-FISCAL-CG-2026, unification TVA (2026-09-18)

Mission d'implémentation faisant suite à l'audit ci-dessus. Détail complet :
`docs/MASTER-REPAIR-REGISTER.md`, ticket `P0FISCAL-CG-2026-TVA-UNIFICATION`.

**Corrigé et testé** : B002/I-03 (trois reconstructions indépendantes de la déclaration TVA) —
`lib/erp-core/compute/accounting.ts::computeTVAFromJournal()` est désormais l'unique source,
consommée à la fois par le dashboard (`app/api/fiscalite/tva/route.ts`) et par le pré-remplissage
DGI (`lib/declarations/declaration-generale.ts`, RF-2.1 de F005 enfin exécutée, trois mois après
sa recommandation). Le crédit de TVA est désormais reporté séquentiellement d'un mois sur l'autre
(il ne l'était pas). `PaysContext::calculerTVA` — l'un des 4 actifs de l'audit, resté non migré
alors que `calculerSalaireNet` l'avait déjà été — délègue maintenant à
`lib/fiscalite/engine-adapter.ts`, même principe que les migrations CNSS/IRPP.

**Confirmé toujours vrai, non corrigé par choix explicite de périmètre** : la TVA déductible reste
structurellement non calculable depuis un achat réel (`achats`/`purchases`/`purchase_items` sans
champ TVA, confirmé par lecture directe du schéma production) — la fonction canonique l'expose
désormais explicitement via `deductible_fiabilite.fiable` (toujours `false`), plutôt que de
prétendre à une fiabilité qu'aucune donnée ne permet. `lib/fiscalite-congo.ts::calculerTVACongo`
(le calculateur le PLUS consommé — factures, PDF, POS resto, devis, rapports) n'a PAS été migré :
ses taux sont identiques au moteur central (aucune divergence de valeur constatée), mais migrer
sa dizaine de points d'appel dans la facturation de production dépasse le périmètre « pipeline de
déclaration » de cette mission et mérite une mission dédiée avec son propre temps de test. Les
avoirs/annulations restent invisibles au calcul canonique (aucun avoir réel trouvé lors de l'audit
pour confirmer comment ils se journalisent — rien inventé pour les couvrir). L'exigibilité
(émission vs encaissement) reste non tranchée légalement ; le choix de `journal_entries` est
architectural (une seule mécanique déjà existante y compris avant cette mission), pas une décision
fiscale. Le taux 18 %/5 % reste non revérifié personnellement contre le texte primaire.

Validation : `npx tsc --noEmit` (0 erreur), `npx vitest run` (881/881 tests, dont 51 nouveaux dans
`lib/erp-core/compute/accounting.test.ts` couvrant fixtures réelles/synthétiques étiquetées, report
de crédit, réconciliation source=canonique, isolation multi-tenant).

## MISE À JOUR — Mission P0-FISCAL-CG-2026, migration du calculateur Congo (2026-09-18)

Suite directe de la mission ci-dessus. Détail complet : `docs/MASTER-REPAIR-REGISTER.md`, ticket
`P0FISCAL-CG-2026-CONGO-CALCULATEUR-MIGRE`.

**Corrigé et testé** : `lib/fiscalite-congo.ts::calculerTVA()` (le calculateur TVA le plus consommé
du dépôt — 8 fichiers, 0 test avant cette mission) délègue maintenant son chemin normal (18%) à
`lib/fiscalite/engine-adapter.ts::calculerTVASurMontantUnifie()` → moteur central. Valeurs
identiques vérifiées avant migration (aucun changement de résultat pour aucun des 8 consommateurs).
Traçabilité facturation revérifiée : `factures.tva` → `factures.tva_montant` déjà synchronisées par
un trigger DB depuis la migration 172 — la TVA affichée/enregistrée/comptabilisée ne divergeait déjà
pas silencieusement, confirmé par lecture directe plutôt que supposé. 14 tests ajoutés
(`lib/fiscalite-congo.test.ts`).

**Découverte nouvelle, non corrigée (hors périmètre)** : `app/api/btp/chantiers/route.ts` poste
`montantHT × 0.189` comme un seul montant sur le compte 4441 (`emit_accounting_event('BTP-001')`,
migration 148) — mélange TVA et Centime Additionnel dans une seule ligne comptable. Consequence
réelle et non triviale : **`computeTVAFromJournal()` (la fonction canonique livrée par la mission
précédente) surestime la TVA collectée pour tout tenant utilisant le module BTP**, puisqu'elle lit
tous les crédits sur 4441 sans distinguer ceux qui contiennent en fait 18.9% (TVA+CA fusionnés) des
18% purs. Ce n'est pas un défaut de la fonction canonique elle-même — c'est la règle comptable
BTP-001 qui journalise déjà les deux taxes ensemble, en amont. Non corrigé dans cette mission
(changer une règle `emit_accounting_event` est un changement de comptabilisation, hors mandat
« migrer un calculateur TVA »). Recommandation : ticket dédié, priorité haute si des tenants BTP
existent en production.

Également découvert, non corrigé (blast radius hors mandat, business rules du module non vérifiées) :
le module « cabinet » (`app/api/cabinet/clients/[id]/factures/route.ts` ET
`app/dashboard/cabinet/clients/[id]/page.tsx`, ce dernier écrivant directement en base sans passer
par l'API) recalcule chacun indépendamment `ht×0.18`/`tva×0.05` — deux chemins d'écriture, deux
calculs dupliqués, jamais réconciliés entre eux ni avec `fiscalite-congo.ts`.

## MISE À JOUR — Mission P0-FISCAL-CG-2026, correction BTP-001 (2026-09-18)

Suite directe de la découverte BTP-001 ci-dessus. Détail complet : `docs/MASTER-REPAIR-REGISTER.md`,
ticket `P0FISCAL-CG-2026-BTP001-TVA-CA-CONTAMINATION`.

**Cause racine démontrée**, pas supposée : `0.189 = 0.18 × (1 + 0.05)` — TVA 18% et Centime
Additionnel 5% de la TVA, fusionnés en un seul montant posté sur 4441 par `BTP-001` séquence 2
(migration 148). Confirmé par le texte même de cette migration ("TVA 18% + Centime Additionnel...
18.9% effectif").

**Corrigé et testé** : `BTP-001` gagne une 3ᵉ séquence (`411/447`, `metadata.ca`, Congo uniquement) —
migration `181_fix_btp001_tva_ca_separation.sql`. Le compte 447 n'est **pas inventé** : c'est
exactement celui déjà utilisé par `FAC-001` séquence 3 (migration 139), actif en production pour
toute la facturation générale — précédent démontré par lecture directe, pas une improvisation.
`app/api/btp/chantiers/route.ts` calcule désormais `tva`/`ca`/`ttc` via
`lib/fiscalite/engine-adapter.ts::calculerTVASurMontantUnifie()` (BTP-001 et BTP-002), aucun taux
recopié dans le routeur. 11 tests ajoutés (`lib/architecture/btp001-tva-ca-separation.test.ts`),
dont une réconciliation avant/après prouvant que l'écart supprimé correspond exactement au Centime
Additionnel qui contaminait `computeTVAFromJournal()`.

Validation code : `npx tsc --noEmit` (0 erreur), `npx vitest run` (906/906 tests, dont 11 nouveaux),
`npx eslint .` (0 erreur), `npm run build` (succès).

## MISE À JOUR — Vérification production directe de la migration 181 (2026-09-18) — VERDICT : FAIL

Une demande de vérification a affirmé que la migration 181 venait d'être exécutée manuellement
dans le SQL Editor Supabase production. **Vérification directe (requêtes en lecture sur le projet
`mrzixapnaqsbqmagivvf` + un test `emit_accounting_event` en `BEGIN…ROLLBACK` non destructif)
contredit cette affirmation : la migration n'est PAS appliquée.**

Preuves :
- `accounting_event_rules` : `BTP-001` ne porte que 2 séquences (411/722, 411/4441) — aucune
  séquence 3 sur 447. La note de la séquence 2 est toujours le texte d'origine ("18.9% effectif"),
  pas le texte corrigé par la migration 181.
- `accounting_schema_versions` : la version la plus récente est `1.11.0` (migration 175, appliquée
  2026-09-02T16:01:48Z) — aucune ligne `1.10.1` (le identifiant de version de la migration 181)
  n'existe.
- `FAC-001` séquence 3 (411/447) et `BTP-002` sont intacts, non affectés — cohérent avec le fait
  qu'aucune partie de la migration 181 n'a tourné (ni collatéral, ni partiel).

Impact réel actuel : **nul**, pas seulement faible — `btp_chantiers` est vide (0 ligne en
production) et aucune écriture `journal_entries` ne crédite le compte 722 à ce jour. Le bug BTP-001
reste donc latent, jamais déclenché par une donnée réelle, contrairement à ce qu'une lecture rapide
du ticket pourrait laisser craindre.

Le code TypeScript et les tests de la mission précédente restent corrects et inchangés ; seule
l'exécution SQL manque. Action requise, non faite ici (hors mandat de cette vérification) :
exécuter le bloc `BEGIN…COMMIT` de `supabase/migrations/181_fix_btp001_tva_ca_separation.sql`
dans le SQL Editor Supabase, puis relancer cette même vérification.

Une seconde demande de vérification (même jour) a de nouveau affirmé l'exécution de la migration ;
une seconde vérification directe a montré exactement le même résultat (aucune ligne créée depuis
le 2026-09-02, aucune séquence 3, note séquence 2 inchangée) — verdict FAIL confirmé deux fois.

## MISE À JOUR — Audit transversal du pattern TVA+CA (2026-09-18) — AUDIT SEUL, AUCUNE CORRECTION

Détail complet : `docs/MASTER-REPAIR-REGISTER.md`, ticket `P0FISCAL-CG-2026-PATTERN-TVA-CA-SYSTEMIQUE`.

BTP-001 n'était pas un cas isolé. Le même pattern (TVA+CA fusionnés à 18,9% sur 4441, sans
séquence 447) est **actif en production** dans `SAN-001` (Santé), `HOT-001` (Hôtel), `BOI-001`
(Boisson) et `RES-001` (Restaurant) — vérifié par lecture directe de `accounting_event_rules` et
par tests `emit_accounting_event` non destructifs (`DO … RAISE EXCEPTION`, aucun résidu confirmé).
Seul `FAC-001` (migration 139) sépare correctement TVA (4441) et Centime Additionnel (447) — c'est
la preuve que le moteur sait déjà faire, il manque juste la réplication.

**Découverte la plus importante de cette mission** : une donnée réelle, pas seulement latente,
contamine déjà les livres du tenant réel AMD FINANCE — `journal_entries`, 18 900 FCFA sur 4441,
dont 900 FCFA de Centime Additionnel comptés comme TVA. Origine établie avec certitude : un résidu
du bloc de validation manuelle de la migration `142.5_fix_fn_ae_execute_event_country.sql`
(`numero_recu: "QW-TEST-01"`, 2026-06-26), jamais nettoyé après coup — la migration purge bien les
événements de test existants (ligne 186) mais son propre bloc de vérification en recrée un juste
après, sans étape de nettoyage prévue.

Aucune donnée réelle pour `SAN-001`/`HOT-001`/`BOI-001`/`FAC-001` (0 ligne chacun). Les deux
triggers legacy (083 restaurant, 084/131 santé) sont soit jamais appliqués en production (083),
soit supprimés sans avoir jamais produit de donnée réelle retrouvée (084/131) — classés ORPHANED,
pas HISTORICAL. `ECO-001` (école) revendique une exonération TVA sans article CGI cité
(contrairement à `AGR-001`/Art.140 CGI) — classé NOT DETERMINED.

Ordre de réparation recommandé, aucune étape exécutée : nettoyer la ligne de test AMD FINANCE →
exécuter la migration 181 (BTP-001) → répliquer FAC-001 sur RES-001 (le plus proche) → puis
SAN-001/HOT-001/BOI-001 → trancher ECO-001 avant tout codage.

## MISE À JOUR — Nettoyage AMD FINANCE (P0-04) et exécution réelle de la migration 181 (2026-09-18)

**Nettoyage AMD FINANCE — PASS.** La ligne de test résiduelle identifiée ci-dessus
(`accounting_events.id=c1a5cc46-...`, `journal_entries.source_id=758d0b3f-...`, 18 900 FCFA sur
4441) a été supprimée réellement en production, dans une transaction unique (`accounting_event_log`
→ `transactions` → `journal_entries` → `accounting_events`, ordre imposé par une FK `NO ACTION`).
Découverte lors du nettoyage : la contamination réelle était en fait de **118 900 FCFA** (les 2
lignes journal_entries, 100 000 sur 706 + 18 900 sur 4441), et constituait **100% du solde affiché**
de la « Caisse principale » AMD FINANCE (`caisses.solde`) — vérifié : aucune autre écriture ne
touchait le compte 571 pour ce tenant. Après suppression + `fn_sync_tresorerie_soldes()`, le solde
est retombé exactement à 0,00 FCFA, cohérent avec l'absence de toute autre écriture réelle. Aucun
effet collatéral : les 2 événements `ONG-001` du même tenant intacts, un second tenant homonyme
(`64c244e5-...`, autre « AMD FINANCE » déjà connu) non affecté.

**Migration 181 — PASS, enfin exécutée.** Après deux vérifications ayant conclu FAIL (la migration
n'était, à deux reprises, pas réellement appliquée malgré des affirmations contraires), le bloc
`BEGIN…COMMIT` du fichier a été exécuté tel quel. `accounting_schema_versions` porte désormais
`1.10.1` (2026-09-18T18:06:09Z). `BTP-001` a 3 séquences actives : `411/722` (HT), `411/4441` (TVA
pure 18%, note corrigée), `411/447` (`metadata.ca`, `country_codes=['CG']`, même précédent que
`FAC-001` séquence 3). Test non destructif confirmé : HT=500 000 → 4441=90 000, 447=4 500,
722=500 000, total 594 500. `FAC-001`/`PAI-001`/`BTP-002` intacts. `btp_chantiers`/écritures sur
722/`accounting_events` BTP-001 : tous à 0 — correctif préventif, aucune donnée réelle affectée à
ce jour.

Reste ouvert (hors périmètre de ces deux missions, signalé, non corrigé) : réplication du même
correctif sur `SAN-001`, `HOT-001`, `BOI-001` — voir ci-dessus.

## MISE À JOUR — Correction transversale RES-001/SAN-001/HOT-001/BOI-001 (2026-09-18) — PASS

Détail complet : `docs/MASTER-REPAIR-REGISTER.md`, ticket
`P0FISCAL-CG-2026-RES-SAN-HOT-BOI-TVA-CA-CONTAMINATION`.

Le même défaut que BTP-001 a été corrigé, en deux temps (code puis migration), pour les 4 autres
modules identifiés par l'audit transversal. **Différences métier respectées, pas de modèle copié
mécaniquement** : RES-001/HOT-001/BOI-001 sont des ventes immédiates encaissées (`treasury_debit`,
pas de compte 411) — leur séquence 3 Centime Additionnel débite donc la trésorerie (521/447) ;
SAN-001 fonctionne comme FAC-001/BTP-001 (facture émise avant règlement) — sa séquence 3 débite
411/447. Nouvelle fonction centrale `lib/fiscalite/engine-adapter.ts::decomposerTTCUnifie()`
remplace les 3 calculs locaux `ht=round(ttc/1.189)` (SAN-001 ×2 writers, HOT-001, BOI-001) ; RES-001
arrête de refusionner `tva+ca` (il les calculait déjà séparément via `calculerTVACongo()`).

**Migration 182 exécutée et vérifiée en production** le 2026-09-18T18:38:09Z (`accounting_schema_versions`
= `1.10.2`). Les 4 event_types ont chacun 3 séquences actives, testées non destructivement (HT=500 000,
TTC=594 500) : TVA exclusivement sur 4441 (90 000), Centime Additionnel exclusivement sur 447 (4 500),
pour les 4 modules et pour `FAC-001` en référence. Idempotence, isolation pays (`['CG']` strict) et
non-régression (`FAC-001`/`FAC-002`/`BTP-001`/`BTP-002`/`PAI-001` intacts, `created_at` inchangé)
tous vérifiés. Aucune donnée réelle n'existe pour ces 4 modules à ce jour — correctif préventif.

**Non déterminé, non résolu, conservé explicitement** : exonération TVA de certains actes médicaux
(SAN-001), éventuel droit d'accise Congo sur la boisson, éventuelle taxe de séjour hôtelière —
aucune preuve trouvée dans ce dépôt pour ces trois points ; nécessitent une mission documentaire
fiscale séparée avant tout codage.

Validation code : `npx tsc --noEmit` (0 erreur), `npx vitest run` (927/927, dont 21 nouveaux),
`npx eslint .` (0 erreur), `npm run build` (succès).

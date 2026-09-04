# RESTART — AUDIT A→Z ORAFORME

**Date de l'audit :** 2026-09-01
**Commit audité :** `0971c4f` (branche `main`, synchronisée avec `origin/main`)
**Base de production auditée :** `mrzixapnaqsbqmagivvf.supabase.co` (extraction `service_role` du 2026-09-01)
**Mode :** LECTURE SEULE — aucun code modifié, aucune migration créée, aucun commit, aucun déploiement.

---

## AVERTISSEMENT MÉTHODOLOGIQUE — À LIRE EN PREMIER

Ce rapport distingue rigoureusement trois niveaux de preuve. Aucune conclusion n'est donnée sans indiquer son niveau.

| Marque | Signification |
|---|---|
| **✅ VÉRIFIÉ EN PRODUCTION** | Testé par requête HTTP réelle contre la base ou le site de production, ce jour. Preuve reproductible fournie. |
| **✅ VÉRIFIÉ (code)** | Lu dans le code source à la ligne indiquée. Fait certain sur le code, effet runtime déduit. |
| **⚠️ NON RE-VÉRIFIÉ** | Issu d'une analyse statique automatisée, non recontrôlé manuellement un par un. Fiable sur la méthode, à confirmer au cas par cas. |
| **⛔ NON VÉRIFIABLE** | Hors de portée des outils disponibles. Explicitement listé en §18. |

### Ce que je n'ai pas pu faire, et pourquoi

1. **Aucun accès SQL direct.** Les serveurs MCP `supabase`, `supabase-moonbank` et `sentry` ont échoué à se connecter (`CONNECTION_CLOSED`, et `text/html` pour Sentry). Le connecteur `postgres` échoue également (`ENOTFOUND tenant/user postgres.mrzixapnaqsbqmagivvf`). Ce sont des **pannes de connexion, pas des absences de capacité**.
   → Conséquence : **policies RLS, triggers, index, GRANT, extensions, jobs `pg_cron`, contraintes CHECK et précisions `numeric(p,s)` ne sont pas lisibles.** Toute affirmation les concernant est marquée ⛔.
   → Contournement mis en œuvre : j'ai reconstitué le schéma réel via l'API PostgREST en `service_role` (329 tables/vues, 70 RPC) et **testé empiriquement l'effet des politiques** en interrogeant les 329 objets avec la clé `anon`. C'est une mesure d'effet, pas une lecture de policy — mais c'est ce qui compte pour le risque réel.

2. **Playwright n'a pas été exécuté — décision délibérée.**
   `tests/certifications/helpers/db.ts:8` code en dur `https://mrzixapnaqsbqmagivvf.supabase.co`, c'est-à-dire **la base de production**, et `tests/certifications/c002-tenant-core.spec.ts:643-655` **réinitialise des mots de passe utilisateurs via l'API admin** (`PUT /auth/v1/admin/users/<id>`). Les helpers créent et suppriment des tenants.
   → Lancer la suite de certification aurait modifié la production. La mission l'interdit. **C'est en soi une anomalie majeure : il n'existe aucun environnement de recette.** Voir ANO-P03.

3. **Aucune mesure de performance réelle.** Ni Lighthouse, ni test de charge, ni profilage. Le score « Performance » du §13 est donc **non attribué**, pas estimé.

4. **Le serveur de développement local pointe sur la production.** `.env.local` contient l'URL et les clés de production. Toute manipulation locale écrit dans la vraie base.

---

## 1. ÉTAT RÉEL DU PROJET

### 1.1 Ce qui est vrai

| Élément | État vérifié |
|---|---|
| Application déployée | ✅ **VÉRIFIÉ EN PRODUCTION** — `https://oraforme.vercel.app` répond `HTTP 200` |
| Base de données | ✅ **VÉRIFIÉ EN PRODUCTION** — 329 tables/vues, 70 RPC, données réelles présentes |
| Domaine `oraforme.com` | ❌ **NE RÉSOUT PAS** — voir ANO-P01, anomalie la plus visible du rapport |
| Branche locale | `main`, synchronisée avec `origin/main`, 3 fichiers modifiés non commités |
| Volume de code | 225 616 lignes (`app` + `components` + `lib`) |
| Pages | 324 `page.tsx` |
| Routes API | 212 `route.ts` |
| Migrations SQL | 170 fichiers |
| Composants | 74 |

### 1.2 L'écart central entre le discours et la réalité

`PROJECT_HEALTH.md` est le document de pilotage du projet. Il affirme :

| Affirmation `PROJECT_HEALTH.md` | Mesure réelle | Verdict |
|---|---|---|
| L.12 — « AHI **82/100** » | Moyenne mesurée des 16 Cores : **30,4/100** | Non soutenu |
| L.70 — « BCI Global **90/100** » | 4 définitions concurrentes du CA, 23 calculateurs fiscaux | Non soutenu |
| L.27 — « Doubles écritures actives connues : **0 ✅** » | `lib/compta-sync-client.ts:138` + `:157` écrit 2 tables par conception, appelé par 14 pages | **Faux** ✅ VÉRIFIÉ (code) |
| L.29 — « Régressions ouvertes : **0 ✅** » | 11 erreurs ESLint bloquantes, dont 8 violations LOI-L | **Faux** ✅ VÉRIFIÉ |
| L.24 — « INSERT directs en routes API : **0 ✅** » | Exact **dans son périmètre comptable** : aucune route API n'insère dans `journal_entries`/`journal_comptable`/`accounting_events`/`mouvements_comptables`. 37 INSERT existent sur d'autres tables. | **Exact** ✅ VÉRIFIÉ |
| L.25 — « writeComptaEntry — 13 pages » | **14 pages, 20 sites d'appel** | Sous-comptage mineur |
| L.28 — « 17 routes avec emit_accounting_event » | **19 routes** | Sous-comptage mineur |

**Conclusion §1 :** le projet n'est pas dans l'état que son propre tableau de bord décrit. Les indicateurs AHI et BCI ne sont pas reproductibles à partir du code. Ils doivent être considérés comme **non fiables** jusqu'à recalcul.

---

## 2. ARCHITECTURE RÉELLE

### 2.1 Architecture cible (CONSTITUTION.md, PARTIE II)

```
UI → API → ERP Core → Accounting Event Bus → Supabase → Realtime → dashboards
```

### 2.2 Architecture réellement observée

```
                      ┌─────────────────────────────────────────┐
                      │  UI — 356 fichiers 'use client' / 424    │
                      └──────────────┬──────────────────────────┘
                                     │
              ┌──────────────────────┼───────────────────────────┐
              │                      │                           │
      (A) 174 pages           (B) 99 pages              (C) 14 pages
      Supabase DIRECT         via routes API            writeComptaEntry()
      clé anon                                          → journal_comptable
      389 écritures                                     + journal_entries
      110 fichiers                                      (double écriture)
              │                      │                           │
              │              19 routes émettent                  │
              │              emit_accounting_event               │
              │                      │                           │
              └──────────────────────┴───────────────────────────┘
                                     ↓
                                 Supabase
                                     ↓
                    ERP Core (lib/erp-core, 1416 lignes)
                    consommé par 10 routes API
                    consommé par 0 page sur 324
```

**Faits structurants ✅ VÉRIFIÉ (code) :**

- **`lib/erp-core` est contourné.** 0 page sur 324 l'importe. 135 pages font leurs agrégations avec `reduce()` dans le navigateur.
- **Les deux routes ERP Core conformes n'ont aucun appelant.** `grep -rn "/api/comptabilite" app/ components/ --include=*.tsx` → **0 résultat**. `app/api/comptabilite/balance/route.ts` et `grand-livre/route.ts` utilisent correctement `computeBalance()` / `computeGrandLivre()`, mais aucun écran ne les appelle. `app/dashboard/comptabilite/balance/page.tsx:106-140` réimplémente intégralement le calcul côté navigateur.
- **Il existe 3 registres comptables + 1 vue** : `accounting_events`+`journal_entries` (moteur, 771 et 1319 lignes), `journal_comptable` (legacy, 5 writers directs, 4 lignes), `htl_journal_entries`/`htl_journal_lines` (0 ligne, mortes).
  ⚠️ **CORRECTION apportée le 2026-09-01 (Mission 0.1)** — une version antérieure de ce rapport qualifiait `mouvements_comptables` de « table morte, 0 writer, 0 reader ». **C'est faux.** ✅ VÉRIFIÉ EN PRODUCTION : `mouvements_comptables` contient **1 319 lignes, soit exactement le compte de `journal_entries`** ; la migration `166_revoke_anon_security_definer_views.sql:11` la classe parmi les vues ; un POST de test a renvoyé une erreur `23502` exposant une ligne à 24 colonnes — c'est-à-dire la structure de `journal_entries`. C'est donc une **vue (updatable) sur `journal_entries`**, pas une table morte. Aucun code applicatif ne la référence, mais son caractère updatable en fait un contournement latent de la LOI-K.
- **Le seul invariant réellement tenu** : `accounting_events` a **0 INSERT direct**. Toutes les écritures passent par `rpc('emit_accounting_event')`. C'est le point fort de l'architecture.
- **`middleware.ts` n'existe pas** — c'est `proxy.ts` (convention Next.js 16). Il est actif ✅ VÉRIFIÉ EN PRODUCTION (les routes protégées renvoient bien 401). Mais `app/dashboard/layout.tsx:12` contient le commentaire *« middleware.ts is the primary guard »*, qui désigne un fichier au nom inexistant — source de confusion documentaire.

---

## 3. ÉTAT SUPABASE

### 3.1 Schéma réel de production ✅ VÉRIFIÉ EN PRODUCTION

329 tables/vues, 70 RPC. Extraction OpenAPI PostgREST en `service_role` — les absences sont donc des preuves solides, pas des défauts de GRANT.

### 3.2 Test RLS empirique — le point le plus rassurant du rapport

**Méthode :** interrogation des **329 objets** avec la clé `anon` (non authentifiée).

| Résultat | Nombre |
|---|---|
| Protégé (HTTP 200, 0 ligne — RLS filtre) | **287** |
| Accès révoqué (HTTP 401) | **41** |
| **Données réellement lisibles par un anonyme** | **1** |

✅ **VÉRIFIÉ EN PRODUCTION — la seule fuite est `chart_of_accounts` : 29 lignes, toutes avec `tenant_id = NULL`.** C'est le plan de comptes OHADA générique. **Aucune donnée client n'est exposée.** Gravité réelle : **faible**. Je le signale par exhaustivité, pas par alarmisme.

**Les migrations de sécurité 161, 164 et 166 SONT appliquées** ✅ VÉRIFIÉ EN PRODUCTION : les 41 objets révoqués incluent exactement `vue_team_access`, `fiscal_declarations`, `mouvements_comptables`, `v_admin_dashboard`, `v_billing_mrr`, `v_financial_ledger`, `compte_resultat`, `balance_tiers` — soit la liste visée par ces migrations. Ce point était marqué « non vérifiable » par l'analyse statique ; il est tranché.

**Tables signalées « sans ENABLE RLS en migration » — effet réel mesuré :**

| Table | Lignes réelles | Vu par un anonyme | Verdict |
|---|---|---|---|
| `accounting_event_rules` | 45 | `[]` | ✅ Protégé en production |
| `accounting_fiscal_params` | 14 | `[]` | ✅ Protégé en production |
| `api_keys` | 0 | `[]` | Pas d'exposition (table vide) |
| `webhook_endpoints` / `webhook_deliveries` | 0 / 0 | `[]` | Pas d'exposition |
| `workflow_executions` / `workflow_logs` | 0 / 0 | `[]` | Pas d'exposition |

→ **L'absence de `ENABLE RLS` dans les migrations est un défaut de traçabilité, pas une exposition réelle.** La protection existe en production ; elle n'est simplement documentée nulle part dans le dépôt.

### 3.3 RPC exposées à un anonyme ✅ VÉRIFIÉ EN PRODUCTION

Test en `GET` uniquement — PostgREST refuse `GET` sur les fonctions `VOLATILE`, donc **aucune fonction d'écriture n'a été exécutée**.

Sur 70 RPC : 51 inatteignables en GET, 5 refusées (405 = volatile), **13 exécutées par un anonyme**.

Sur ces 13, 11 sont des helpers d'identité qui retournent correctement `null`/`false` sans session (`get_my_role`, `get_my_tenant_id`, `fn_is_owner`, `auth_tenant_id`…) — comportement normal.

**2 méritent correction :**
- `fn_accounting_health_check` → retourne l'**état interne du moteur comptable** à un anonyme.
- `fn_refresh_group_snapshots` → nom d'écriture, mais déclarée `STABLE` (sinon `GET` serait refusé) — incohérence de déclaration à examiner.

### 3.4 Schema drift — migrations non appliquées

**Migrations dont les objets sont ABSENTS de production** ✅ VÉRIFIÉ EN PRODUCTION :

| Migration | Objets déclarés | Présents en prod |
|---|---|---|
| `157_identity_auth_logs.sql` | `auth_logs`, `auth_metrics_daily` + 3 fonctions | **AUCUN** |
| `158_identity_policy_engine.sql` | `policy_history`, `policy_violations`, `policy_metrics_last_24h` + 2 fonctions | **AUCUN** |
| `159_identity_policy_context.sql` | `fn_policy_context_counters` | **ABSENT** |

→ **Aucun événement d'authentification n'est journalisé en production.** Toute la couche d'observabilité Identity (C-001.1, certifiée dans `docs/`) n'existe pas dans la base.

**Migration partiellement appliquée** ✅ VÉRIFIÉ EN PRODUCTION :
`155_taille_entreprise_not_null.sql` — le `SET DEFAULT 'tpe'` est appliqué, le **`SET NOT NULL` ne l'est pas**. Preuve : `tenants.taille_entreprise` a `default: "tpe"` mais est absente du tableau `required` de PostgREST, alors que `plan` (qui a aussi un défaut) y figure — le contrôle de méthode est donc valide.
→ **`tenants.taille_entreprise` est NULLABLE en production.** Conséquence exploitée en §9 (ANO-M04).

**Drift inverse — objets en production créés par aucune migration** ⚠️ NON RE-VÉRIFIÉ un par un :
18 objets, dont **`api_keys`** (socle d'authentification API), `fiscal_declarations`, `webhook_endpoints`, `webhook_deliveries`, `workflow_executions`, `workflow_logs`, `mouvements_comptables`.
Et surtout : **`tenants.taille_entreprise`, colonne pivot de tout le modèle d'offre, n'est créée par aucune des 170 migrations.**

**86 objets déclarés en migration et absents de production**, avec 8 migrations entières jamais jouées (050 stocks, 055 workflow, 091 santé, 104 academy, 116, 121, 157, 158) — et un schéma parallèle sous d'autres noms (`purchases` au lieu de `purchase_orders`, `workflow_executions` au lieu de `workflow_instances`, `rh_contrats` au lieu de `contrats`).

**Conclusion §3 :** la base de production n'est **pas** le produit de l'exécution séquentielle du dossier `supabase/migrations/`. C'est un schéma construit et remanié à la main, dont les migrations sont une documentation partielle et partiellement fausse. Il n'existe aucune table de suivi de migration ; plusieurs fichiers portent la mention *« À EXÉCUTER dans Supabase SQL Editor »* — ce sont des scripts manuels.

### 3.5 Anomalies de numérotation des migrations

- Trous : 075-076, 124-125
- Doublon de numéro : deux fichiers `037_`
- `142.5_fix_...sql` se trie **avant** `142_...sql` (`.` = 0x2E < `_` = 0x5F) — inversion d'ordre réelle
- `CATCHUP_008_to_025.sql` se trie **après** `170_`
- `20260524_mission_critique.sql` mélange deux conventions

---

## 4. ÉTAT VERCEL / PRODUCTION

| Élément | État |
|---|---|
| Projet Vercel | `oraforme`, Node 24.x, framework `nextjs` |
| Déploiement | ✅ **VÉRIFIÉ** — `oraforme.vercel.app` → HTTP 200, `X-Vercel-Cache: HIT` |
| `oraforme.com` | ❌ **NE RÉSOUT PAS** — voir ANO-P01 |
| Crons déclarés | 12 dans `vercel.json` |
| Routes cron existantes | ✅ **12/12 présentes** |
| Crons protégés par un secret | ❌ **2 sur 12** |
| Headers de sécurité | ❌ **Aucun** hors HSTS par défaut Vercel ✅ VÉRIFIÉ EN PRODUCTION |
| CI/CD | ❌ **AUCUN workflow sur `origin/main`** ✅ VÉRIFIÉ |

**Headers réellement servis** ✅ VÉRIFIÉ EN PRODUCTION (`curl -I https://oraforme.vercel.app`) :
présents → `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload` (défaut Vercel).
**absents** → `Content-Security-Policy`, `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`.
Ni `next.config.ts` ni `vercel.json` ne définissent de bloc `headers()`.

---

## 5. ÉTAT PWA

### 5.1 Le manifeste et le service worker ne sont pas servis aux visiteurs non authentifiés

✅ **VÉRIFIÉ EN PRODUCTION :**

```
GET /                 → 200
GET /manifest.json    → 307 → /login?next=%2Fmanifest.json
GET /sw.js            → 307 → /login?next=%2Fsw.js
GET /robots.txt       → 307 → /login?next=%2Frobots.txt
```

**Cause racine exacte — `proxy.ts:176` :**
```
'/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)'
```
Le matcher exclut les images, `_next/static` et `favicon.ico`. Il **n'exclut ni `.json`, ni `.js`, ni `.txt`**. Et `PUBLIC_PAGES` (`proxy.ts:6-15`) ne contient pas ces chemins. Le garde de session (`proxy.ts:104-113`) redirige donc vers `/login`.

**Portée exacte — à ne pas surestimer :** la redirection ne frappe que les requêtes **sans session**. Un utilisateur connecté reçoit bien les fichiers. Les conséquences réelles sont donc :

1. ❌ **Installation impossible depuis la landing page.** `PWAInstall` est monté dans `app/layout.tsx:54`, donc sur `/` (page publique). Il appelle `navigator.serviceWorker.register('/sw.js')` (`PWAInstall.tsx:20`) → reçoit une redirection → **la spécification Service Worker interdit les redirections au chargement du script : l'enregistrement échoue.** L'erreur est avalée par `.catch(() => {})`.
2. ❌ **Manifeste illisible pour un visiteur** → pas de bannière d'installation navigateur.
3. ❌ **`robots.txt` renvoie la page de login aux crawlers** (jamais authentifiés) → référencement cassé. Le fichier réel existe et est correct ; il n'est simplement jamais servi.

### 5.2 Mécanisme de mise à jour — verdict nuancé

Contrairement à ce qu'on pourrait craindre, **le SW n'enferme pas les utilisateurs dans une ancienne version** :
- `sw.js:21` `skipWaiting()` et `sw.js:35` `clients.claim()` sont présents.
- `sw.js:25-34` purge les caches dont la clé diffère de `CACHE_VERSION`.
- `sw.js:87-95` les pages HTML sont en **network-first** — une page fraîche est servie dès que le réseau répond.
- `/_next/static/` est en cache-first, ce qui est sûr (URLs hashées par build).

**Les vrais défauts sont ailleurs :**
- `CACHE_VERSION = 'oraforme-v3'` (`sw.js:1`) est une constante manuelle jamais touchée par le déploiement → la purge ne se déclenche **jamais** entre deux builds. Le cache accumule indéfiniment les anciens chunks, sans plafond ni éviction. Les `cache.put()` (lignes 60, 77, 92) n'ont aucun `.catch` : au dépassement de quota mobile, échec silencieux.
- Aucune détection de nouvelle version, aucun prompt de rechargement. `PWAInstall.tsx:20` jette la valeur de retour de `register()`, donc aucun hook n'est possible.

### 5.3 Cache de pages authentifiées — risque réel

✅ VÉRIFIÉ (code) — `sw.js:46-50` n'exclut du cache que `supabase.co`, `/api/` et `sentry.io`. Le handler `sw.js:87-95` met donc en cache **toute navigation `/dashboard/**` et tout payload RSC**, qui contiennent les données du tenant, dans un cache unique `oraforme-v3` non segmenté par utilisateur.
La déconnexion ne purge rien : `grep "caches.delete|caches.keys|unregister()"` sur `app/`, `components/`, `lib/` → **0 résultat**.
→ Sur appareil partagé et hors ligne, le fallback `sw.js:97` peut servir à l'utilisateur B une page mise en cache pour l'utilisateur A.

### 5.4 Le mode hors ligne ne fonctionne pas

✅ VÉRIFIÉ (code) — `sw.js:157-201` implémente `syncOfflineQueue()` lisant l'object store `queue` d'IndexedDB `oraforme-offline`. `grep "oraforme-offline|oraforme-sync"` sur tout le code applicatif → **aucune occurrence hors du SW lui-même**. Rien n'alimente cette file, aucun `registration.sync.register()` n'existe.
Pendant ce temps, `components/ui/OfflineIndicator.tsx:44,58` affiche *« les données seront synchronisées à la reconnexion »* et *« Connexion rétablie — données synchronisées ✓ »*.
→ **Les mutations faites hors ligne sont perdues, et l'interface affirme le contraire.**

**Bug additionnel** : `sw.js:100` — `caches.match('/dashboard') ?? caches.match('/')`. `caches.match()` retourne toujours une `Promise` (donc toujours truthy) : le `??` ne se déclenche jamais. **La page hors ligne stylée des lignes 102-120 est du code mort inatteignable.**

### 5.5 Divers PWA

- `manifest.json` : `id` et `scope` absents ; `screenshots` absent.
- Incohérence `theme_color` : `#F0A30A` (`manifest.json:8`) vs `#F59E0B` (`app/layout.tsx:44`).
- Pas de `viewport-fit=cover` → `env(safe-area-inset-*)` inopérant ; les éléments `fixed bottom-*` passent sous la home-bar iOS.
- 22 pages contiennent un `<table>` sans conteneur `overflow-x-auto` → débordement horizontal sur mobile, dont `/dashboard/ecole/espace-parent` et `/dashboard/ecole/espace-etudiant`, cibles mobiles par nature.

---

## 6. LES 16 CORES

Scores établis à partir de mesures reproductibles. Moyenne : **30,4/100**.

| # | Core | Score | Preuve dominante |
|---|---|---:|---|
| 1 | Identity | **52** | Escalade de privilège non bloquée (`039_multi_tenant_hardening.sql:44-47`) ; 4 chemins de résolution d'identité |
| 2 | Tenant | **55** | 75 fichiers importent `lib/tenant-guard.ts` marqué `@deprecated` ligne 2 |
| 3 | Permission | **24** | 6 pages protégées sur 277 ; **0 route API sur 211** ne vérifie une permission de module |
| 4 | Organization | **30** | 0 API ; création de tenant côté navigateur (`groupe/gestion/page.tsx:169`) ; 0 test |
| 5 | Billing | **28** | **0 writer** sur `billing_subscriptions`/`invoices`/`payments` — la facturation SaaS n'écrit rien |
| 6 | Accounting | **38** | 4 registres ; 14 pages via `writeComptaEntry` ; `tva:0` forcé (`compta-sync-client.ts:143`) |
| 7 | Fiscal | **18** | **23 calculateurs fiscaux concurrents** ; deux taux de TVA (18 % et 18,9 %) simultanés |
| 8 | Payroll | **22** | Chaîne paie→comptabilité rompue depuis la migration 141 |
| 9 | Inventory | **20** | Stock recalculé dans le navigateur sans verrou ; `/api/stock/move` a 0 appelant |
| 10 | CRM | **32** | 5 référentiels clients concurrents |
| 11 | Workflow | **25** | 1518 lignes, 0 test, 0 consommation d'événements |
| 12 | Notification | **26** | Canal Realtime `notif-panel-v2` sans filtre tenant |
| 13 | Reporting | **30** | Les 2 routes ERP Core conformes ont **0 appelant** |
| 14 | Analytics | **34** | **0 page sur 324** n'importe `@/lib/erp-core` |
| 15 | AI / MIAA | **30** | 20 routes sur 31 en `service_role` sans garde tenant standard |
| 16 | Integration | **22** | `dispatchWebhookEvent` (`sender.ts:138`) : **0 appelant** — aucun webhook n'est jamais émis |

### 6.1 Point positif majeur — à ne pas perdre

✅ **VÉRIFIÉ — aucune fuite de `service_role` côté navigateur.** Les 24 occurrences sont toutes dans `app/api/*`, `lib/supabase-server.ts` ou des Server Components. Boucle de contrôle : aucun fichier `'use client'` n'importe `lib/supabase-server`. `.env.local` ne contient aucune clé `service_role` préfixée `NEXT_PUBLIC_`. Le correctif du commit `0a2ee15` tient.
⚠️ Réserve : la clé ayant existé en dur dans l'historique git, **sa rotation n'est pas vérifiable** — à confirmer par l'équipe.

### 6.2 Chaîne paie → comptabilité rompue ✅ VÉRIFIÉ (code)

1. `supabase/migrations/141_accounting_rules_paie.sql:275` supprime le trigger `trg_bulletins_paie`, en indiquant qu'il est *« remplacé par emit_accounting_event() dans PATCH /api/rh/paie/[id] »*.
2. `app/dashboard/rh/paie/page.tsx:1512` et `:1555` appellent `POST /api/paie/bulletins`.
3. `app/api/paie/bulletins/route.ts` fait `upsert` sur `bulletins_paie` et **n'appelle jamais `emit_accounting_event`** (52 lignes, vérifiées).
4. Les routes qui émettent PAI-001/002 sont `app/api/rh/paie/route.ts:118` et `[id]/route.ts:68,94` — **aucun écran ne les appelle** (seul usage : `bulletin-pdf` en GET).

→ **Depuis la migration 141, générer une paie via l'interface ne produit aucune écriture comptable.** `PROJECT_HEALTH.md:213` certifie pourtant « Paie — Argent définitif ✅ ».

Aggravant : `app/dashboard/rh/paie/page.tsx:17-21` importe `calculerIRPP` et `calculerChargesSociales` dans un fichier `'use client'` → **IRPP et CNSS sont calculés dans le navigateur** puis persistés bruts par `route.ts:26` sans recalcul serveur. Violation directe de CONSTITUTION PARTIE VI (« Aucun écran ne recalcule ces données »).

---

## 7. TOUTES LES PAGES

324 pages inventoriées. Chiffres clés ⚠️ NON RE-VÉRIFIÉ page par page (méthode automatisée) :

| Caractéristique | Nombre | % |
|---|---:|---:|
| Pages en `'use client'` | 283 | 87 % |
| Pages appelant Supabase **directement** depuis le navigateur | **174** | **54 %** |
| Pages passant par une route API | 99 | 31 % |
| Pages avec un guard de permission | **18** | **5,6 %** |
| Pages avec un état d'erreur | 44 | 14 % |
| Pages avec Realtime | 7 | 2 % |
| Fichiers `loading.tsx` pour 324 pages | **1** | — |
| Fichiers `error.tsx` pour 324 pages | **1** | — |

✅ VÉRIFIÉ : `find app -name 'loading.tsx'` → 1 (`app/dashboard/loading.tsx`) ; `error.tsx` → 1 ; `not-found.tsx` → 1.

### 7.1 Pages affichant de fausses données ✅ VÉRIFIÉ (code)

Pages **100 % fictives**, affichant des données inventées comme si elles étaient réelles :

| Fichier:ligne | Contenu |
|---|---|
| `app/dashboard/recrutement/placement/page.tsx:6` | `DEMO_PLACEMENTS` — noms, salaires, commissions inventés |
| `app/dashboard/recrutement/partenaires/page.tsx:6` | `DEMO_PARTENAIRES` — CA partenaire inventé |
| `app/dashboard/recrutement/contrats/page.tsx:6` | `DEMO_CONTRATS` |
| `app/admin/support/page.tsx:8` | `INITIAL_TICKETS` — 5 tickets avec clients fictifs (écran propriétaire) |
| `app/dashboard/social-media/page.tsx:50,58` | `followers: 4820`, `reach: 15200` |
| `app/dashboard/email-management/page.tsx:37,43` | Boîtes et corps d'e-mails inventés |
| `app/admin/maintenance/page.tsx:13,24` | 8 tâches, 4 annonces figées |
| `app/dashboard/erp-sync/page.tsx:38` | Matrice d'audit codée en dur |
| `app/admin/roles/page.tsx:6` | Matrice RBAC en dur, sans lien avec les tables `roles` |

**Le cas le plus dangereux** — `app/dashboard/recrutement/analytics/page.tsx` : lignes 32-36 vrais `count` Supabase, lignes 8 et 15 `SOURCES_DEMO` et `PIPELINE_DEMO` (« Candidatures reçues : 148 », « Placements réalisés : 9 »). **Le même écran affiche côte à côte un chiffre réel (souvent 0) et un chiffre faux.** L'utilisateur ne peut pas les distinguer.

### 7.2 La même métrique, quatre valeurs ✅ VÉRIFIÉ (code)

| Écran | Formule | Base |
|---|---|---|
| `/dashboard` | `SUM(factures.total)` où `statut='payee'` | **TTC** |
| `/dashboard/bi` | idem | **TTC** |
| `/dashboard/finance` | RPC `fn_finance_kpis` → `SUM(factures.total)`, **mais bascule silencieusement sur `SUM(transactions.montant)` si aucune facture payée** (migration 154, l.95-99) | TTC ou autre source |
| `/dashboard/rapports` | `f.montant_ht ?? f.total` | **HT, ou TTC en repli** |
| `/dashboard/comptabilite/*` | `journal_entries` | **HT comptable** |

Le champ `ca_source` renvoyé par la RPC n'est affiché nulle part. `app/dashboard/rapports/page.tsx:180` mélange HT et TTC dans un même agrégat dès qu'un `montant_ht` est NULL.

### 7.3 Fallbacks dangereux — le mécanisme qui a masqué tout le reste

**280 pages sur 324 n'ont aucun état d'erreur.** Le motif dominant est :
```ts
const { data } = await supabase.from('X').select('...')   // error jamais lu
const items = data ?? []                                   // erreur → tableau vide
```
Combiné aux tables et colonnes inexistantes (§9), **toute erreur de schéma devient un écran vide ou un zéro plausible.** C'est précisément ce qui a permis à des modules entiers de rester cassés en production sans que personne ne le voie.

17 `catch {}` totalement muets dans les pages.

---

## 8. PARCOURS CRITIQUES

| Parcours | Chaîne réelle | Verdict |
|---|---|---|
| **LOGIN** | UI → `proxy.ts:98` `getUser()` → redirection | ✅ Fonctionne (401 correct sur routes protégées, vérifié en prod) |
| **INSCRIPTION / ONBOARDING** | `app/onboarding/actions.ts:86` → `buildTenantProfile()` → `tenants` + `tenant_modules` | ✅ Conforme. Mais `modules_actifs` n'est **jamais renseigné** → divergence permanente |
| **FACTURATION** | UI → `factures` ✅ → `facture_lignes` ❌ **table inexistante** → `emit_accounting_event` ✅ | ❌ **CASSÉ** — voir ANO-C02 |
| **PAIE** | UI → calcul **dans le navigateur** → `POST /api/paie/bulletins` → `bulletins_paie` → **aucun événement comptable** | ❌ **CASSÉ** — voir §6.2 |
| **STOCKS** | UI → `products.stock_actuel` ❌ **colonne inexistante** | ❌ **CASSÉ** — voir ANO-C03 |
| **RECOUVREMENT** | `factures.due_date` ❌ **colonne inexistante**, avec `.order('due_date')` | ❌ **CASSÉ** — écran vide permanent |
| **COMPTABILITÉ** | UI → lecture directe `journal_entries` + recalcul navigateur | ⚠️ Fonctionne mais viole PARTIE VI |
| **FISCALITÉ** | 23 calculateurs concurrents, 2 taux de TVA | ⚠️ Fonctionne, résultats incohérents entre modules |
| **ÉCOLE** | Tables `annonces_ecole`, `bourses_etudiants`, `conges_ecole`… inexistantes | ⚠️ Partiellement cassé |
| **ADMIN** | `transactions.amount` ❌ **colonne inexistante** | ❌ Volumes plateforme affichés à 0 |

---

## 9. ANOMALIES — CLASSÉES PAR GRAVITÉ

### 🔴 CRITIQUES

**ANO-C01 — 10 endpoints d'automatisation accessibles sans aucune authentification**
✅ **VÉRIFIÉ EN PRODUCTION.** Test décisif et sans effet de bord :
```
GET /api/factures            → 401   (témoin : le garde fonctionne)
GET /api/tresorerie/wallets  → 401
GET /api/miaa/notifications  → 200  {"notifications":[]}   ← AUCUNE AUTHENTIFICATION
```
`proxy.ts:30-46` définit 15 `AUTOMATION_PATHS` exemptés du garde de session, avec le commentaire `proxy.ts:26-29` : *« Each of these validates its own secret (CRON_SECRET / x-automation-secret) internally »*. **Ce commentaire est faux pour 10 des 15.** Seuls 6 fichiers vérifient un secret (`grep -rl "CRON_SECRET\|AUTOMATION_SECRET"` → `agents/miaa-autonome`, `automation/run`, `cron/run`, `miaa/analyse-quotidienne`, `miaa/proactif`, `profil/reminders`).

Routes ouvertes, contenu intégral vérifié :
```ts
// app/api/agents/securite/backup/route.ts — fichier complet
export async function GET() {
  try { const result = await backupQuotidien(); return NextResponse.json(result) }
  catch (err) { ... }
}
```
Même structure pour `agents/superviseur/rapport`, `agents/securite/attaques`, `agents/securite/performance`, `agents/stock/verifier`, `agents/comptable/relances`, `agents/rh/bulletins`, `agents/ecole/impayes`.

**Le plus grave** — `app/api/agents/restaurant/cloture/route.ts:9,24-28` : client `service_role`, **itère sur tous les tenants restaurant actifs**, ferme les commandes ouvertes et crée les écritures de caisse. Un appel `GET` anonyme hors horaire corrompt la comptabilité de tous les restaurants clients.

**Cause racine :** le commit `81e9302` a corrigé une régression de cron (401 sur les tâches planifiées) en ajoutant `AUTOMATION_PATHS` au bypass du proxy, en supposant que chaque route validait son secret. 10 ne le faisaient pas. **Le correctif a transformé un déni de service en exposition publique.**

---

**ANO-C02 — La table `facture_lignes` n'existe pas en production**
✅ **VÉRIFIÉ EN PRODUCTION :**
```
GET /rest/v1/facture_lignes  → 404 PGRST205 "Could not find the table 'public.facture_lignes'"
GET /rest/v1/factures        → 200 (témoin)
```
`facture_lignes` est référencée dans **6 fichiers** : `app/api/factures/route.ts:87`, `app/api/factures/[id]/route.ts:28`, `app/api/factures/[id]/pdf/route.ts:37`, `app/dashboard/facturation/page.tsx` (7 emplacements), `app/dashboard/devis/page.tsx:402`, `app/dashboard/factures/[id]/preview/page.tsx:105`.

Impacts distincts et vérifiés :
- `app/api/factures/route.ts:87` — `await supabaseAdmin.from('facture_lignes').insert(...)` **sans aucun contrôle d'erreur** → les lignes sont perdues **silencieusement**.
- `app/dashboard/facturation/page.tsx:512` — l'erreur **est** affichée : `showToast('Facture créée, erreur lignes : ' + errLignes.message)`. Les utilisateurs voient donc un message d'erreur à chaque facture comportant des lignes.
- `app/api/factures/[id]/pdf/route.ts:37` — les PDF de facture sont générés **sans aucune ligne de détail**.

**Aggravation — la table `factures` n'a pas non plus les colonnes utilisées.** ✅ VÉRIFIÉ EN PRODUCTION :
```
GET /rest/v1/factures?select=invoice_number,client_name,date,due_date,subtotal,ca → 400
  "column factures.invoice_number does not exist"
```
Colonnes réelles (21) : `client_nom`, `montant_ht`, `tva`, `total`, `statut`, `created_at`, `items` (jsonb)… — **pas** `invoice_number`, `client_name`, `date`, `due_date`, `subtotal`, `ca`, `client_address`, `client_phone`, `notes`.
Or `app/api/factures/route.ts:60-79` insère précisément ces 9 colonnes inexistantes. **La route API de création de facture ne peut pas fonctionner.**

Note : la table `factures` possède une colonne `items : jsonb` — il est probable que les lignes soient réellement stockées là. `facture_lignes` serait alors un chemin mort jamais migré. **À confirmer par l'équipe** : c'est la question à trancher en premier avant toute correction.

---

**ANO-C03 — `products.stock_actuel` n'existe pas : le module Stocks est inopérant**
✅ **VÉRIFIÉ EN PRODUCTION :**
```
GET /rest/v1/products?select=id,nom,stock_actuel → 400 "column products.stock_actuel does not exist"
GET /rest/v1/products?select=id,nom,prix_achat   → 200 (témoin)
```
`products` a 12 colonnes, **aucune ne porte une quantité en stock**. 14 pages lisent `stock_actuel`, 3 pages le **recalculent et le réécrivent** (`stocks/achats:196`, `sorties:206`, `retours:160`).
Combiné au fallback `?? []`, le hub Stocks affiche en permanence **0 produit, 0 rupture, valeur de stock 0 FCFA**, sans aucun message.

Incohérence supplémentaire dans le même module : `stock_movements.quantite` (colonne réelle) est utilisée correctement dans `stocks/page.tsx:66` mais écrite `quantity` (inexistante) dans 5 autres pages. `purchases.montant_total` correct dans une page, `total_amount` (inexistant) dans deux autres. **Deux écrans du même module affichent des chiffres différents.**

---

**ANO-C04 — Vecteur d'escalade de privilège dans la policy RLS `profiles`**
✅ VÉRIFIÉ (code SQL) — `supabase/migrations/039_multi_tenant_hardening.sql:44-47` :
```sql
CREATE POLICY "profiles: update own info" ON profiles FOR UPDATE
  USING  (user_id = auth.uid() AND tenant_id = get_my_tenant_id())
  WITH CHECK (user_id = auth.uid() AND tenant_id = get_my_tenant_id());
```
Le commentaire ligne 43 affirme *« mais PAS changer son tenant_id ni son rôle »*. Le `WITH CHECK` ne contraint que `user_id` et `tenant_id`. Un `UPDATE profiles SET role='owner' WHERE user_id = auth.uid()` satisfait le prédicat.
Contrôles complémentaires : aucun `GRANT/REVOKE UPDATE` au niveau colonne dans les 170 migrations ; le trigger `fn_prevent_tenant_id_change` (`039:98-110`) protège `tenant_id` mais **pas** `role` ; aucune migration postérieure ne corrige.
⛔ **Exploitation non vérifiée en production** — cela aurait exigé une écriture, interdite par la mission. **À tester en priorité dès l'autorisation.** Combiné à `usePermissions.ts:64-68` (`if role === 'owner' → tous droits`), l'impact serait total.

---

**ANO-C05 — IDOR non authentifié sur `/api/miaa/notifications`**
✅ VÉRIFIÉ (code) + ✅ VÉRIFIÉ EN PRODUCTION (accès sans session confirmé, sans exploitation).
`app/api/miaa/notifications/route.ts:9,13-16` : client `service_role`, aucun garde, et `tenant_id` **lu directement dans la query string**. Le chemin est dans `AUTOMATION_PATHS` (`proxy.ts:42`) → aucune session requise.
`GET /api/miaa/notifications?tenant_id=<uuid>` permettrait à un anonyme de lire les notifications de n'importe quel tenant, et déclenche en plus `genererNotifications()` puis `sauvegarderNotifications()` — donc une **écriture** en base.
**Je n'ai pas transmis de `tenant_id`** : la vulnérabilité est démontrée par la lecture du code et par l'accès sans authentification confirmé, pas par son exploitation.

---

**ANO-C06 — IDOR sur `/api/resto/receipt/[commandeId]`**
✅ VÉRIFIÉ (code) — `app/api/resto/receipt/[commandeId]/route.ts:13-25`. Sous le préfixe public `/api/resto/` (`proxy.ts:22`), client `service_role`, aucune vérification de propriété. L'`id` de commande seul donne le reçu PDF de n'importe quel restaurant, avec les coordonnées de l'entreprise et les données personnelles du client final (`client_nom`, `client_tel`, `adresse_livraison`).

---

**ANO-C07 — `/api/debug/db-check` : route de diagnostic qui écrit en base, sans contrôle de rôle ni garde d'environnement**
🔻 **REQUALIFIÉE DE CRITIQUE À MAJEURE le 2026-09-01 (Mission 0.1).** Ma classification initiale n'est pas soutenue par les preuves de production. Voir le point 5 ci-dessous. Je la maintiens en MAJEURE, pas en critique.

Instruction P0 de la Mission 0.1 — les 8 points, un par un :

**1. Pourquoi cette route existe** ✅ VÉRIFIÉ — `git log --diff-filter=A` : créée le **2026-06-04** par le commit `77ee994 fix: bug critique — rien ne s'enregistre (RLS silencieux + erreurs invisibles)`. C'est un **outil de diagnostic d'incident**, écrit pour déterminer si le problème venait de la RLS. L'incident est résolu ; l'outil n'a jamais été retiré — **3 mois** d'exposition résiduelle. Sa ligne 85 le confirme : `'Si admin_insert=ok mais un formulaire ne sauvegarde pas, le problème est les RLS côté client. Exécuter 067_rls_all_tenant_tables.sql'`.

**2. Appelants** ✅ VÉRIFIÉ — `grep -rn "api/debug" app components lib tests scripts` hors du dossier lui-même → **AUCUN**. Aucun `<Link>`, donc **aucun préchargement Next.js possible**. La route n'est atteignable que par saisie directe de l'URL.

**3. Environnements** ✅ VÉRIFIÉ — `grep -n "NODE_ENV\|VERCEL_ENV" app/api/debug/db-check/route.ts` → **aucun garde d'environnement**. Aucune exclusion dans `next.config.ts` ni `vercel.json`. La route est donc déployée en **production et dans tous les déploiements de prévisualisation**.

**4. Exposition réelle en production** ✅ VÉRIFIÉ EN PRODUCTION — deux appels :
```
GET /api/debug/db-check                    → 401 {"error":"Unauthorized","code":"AUTH_REQUIRED"}
GET /api/debug/db-check (cookie invalide)  → 401
```
Le proxy exige une session valide. **La route n'est PAS exposée à un anonyme.**

**5. Présence de `__test_%` dans `clients`** ✅ VÉRIFIÉ EN PRODUCTION — **0 résidu.**
```
clients WHERE nom LIKE '__test_%'  → 0
clients (total, témoin)            → 0
```
**Nuance déterminante : la table `clients` est entièrement vide en production (0 ligne).** L'absence de résidu ne prouve donc pas que les suppressions ont fonctionné — elle est cohérente avec l'hypothèse que la route n'a jamais été appelée avec succès en production. Les motifs `test%`, `demo%`, `Demo%` retournent également 0.

**6. Exécution par crawler ou préchargement** ✅ VÉRIFIÉ — **risque faible, contrairement à ce que j'affirmais.** Trois raisons : (a) aucun `<Link>` ne pointe vers la route, donc pas de préchargement ; (b) un crawler n'est jamais authentifié et reçoit 401 ; (c) `public/robots.txt:4` contient bien `Disallow: /api/`. *Réserve* : ce `robots.txt` est lui-même redirigé vers `/login` en production (ANO-P02), donc la directive n'est de fait jamais lue — mais cela reste sans conséquence ici, puisque le crawler est bloqué en amont par le 401.

**7. Usage de `supabaseAdmin`** ✅ VÉRIFIÉ (code) — 4 usages, lignes 19, 39, 46, 54 et 62. L'écriture est aux lignes 53-58 :
```ts
const testNom = `__test_${Date.now()}`
const { data: insertTest, error: insertErr } = await supabaseAdmin
  .from('clients')
  .insert({ tenant_id: tenantId, nom: testNom })
```
`supabaseAdmin` est le client `service_role` : **la RLS est contournée**. La suppression (l.60-67) est conditionnée à `insertTest?.id` et son échec est **avalé** (`deleteOk = !delErr`) — la route renvoie `200` même si la ligne de test subsiste.

**8. Absence de contrôle de rôle** ✅ VÉRIFIÉ (code) — lignes 14-16, la seule vérification est la présence d'un `user`. **Aucun contrôle de rôle, aucun contrôle de tenant.** N'importe lequel des utilisateurs authentifiés, de n'importe lequel des 26 tenants (dont les 18 tenants de test encore `active`, voir §21), peut déclencher une écriture `service_role`.

**Fuite d'information** (l.74-86) : la réponse expose `user.id`, `user.email`, `tenant.id`, `tenant.role`, le résultat de `get_my_tenant_id()`, les **messages d'erreur PostgreSQL bruts** et le nom d'un fichier de migration.

**Verdict calibré :** exploitation impossible sans compte valide ; aucun résidu en base ; aucun vecteur automatique. Mais une route d'incident oubliée depuis 3 mois, qui écrit en `service_role` sans contrôle de rôle ni garde d'environnement, et qui divulgue des identifiants et des erreurs SQL brutes. **MAJEURE — suppression recommandée, pas urgence absolue.**

---

**ANO-C08 — 336 événements comptables sur 771 (43,6 %) sont bloqués en statut `error` depuis le 27 juin 2026**
✅ **VÉRIFIÉ EN PRODUCTION — découvert en Mission 0.1.** C'est le constat le plus important de cet audit sur le plan comptable.

Répartition réelle de `accounting_events` :
```
status = processed    →  435
status = error        →  336      ← 43,6 % du total
status = pending      →    0
status = dead_letter  →    0
```

**Montant TTC cumulé bloqué : 339 474 246 FCFA** (≈ 517 500 €), réparti en :
```
192 × PAI-001  (charge de paie)
 96 × FAC-002  (règlement de facture)
 48 × ACH-001  (achat)
```

**Deux causes racines distinctes, prouvées :**

- **96 événements** portent l'erreur `duplicate key value violates unique constraint "transactions_source_unique" [23505]`. C'est **la manifestation directe de la double écriture** (ANO-M10) : la transaction existe déjà, créée par un autre chemin, et le moteur central échoue à la recréer.
- **240 événements ont `error_message: null`.** Le moteur les marque en `error` **sans enregistrer la moindre raison**. Exemple vérifié : `PAI-001 · "Paie 03/2024 — Nzouzi Marie" · montant_ttc: 0 · retry_count: 0 · error_message: null`. Deux défauts s'y cumulent : un montant TTC à zéro sur une charge de paie, et un échec silencieux non diagnosticable.

**Le mécanisme de reprise est à l'arrêt** : `retry_count` vaut 0 ou 1 pour `max_retries: 3`. Aucune tentative depuis 2 mois. La vue `v_accounting_replay_queue` compte 435 entrées.

**Fenêtre temporelle** : tous créés entre `2026-06-27T16:36:53Z` et `2026-06-27T17:06:25Z` — une seule campagne de rétroplay de 30 minutes. **Gelés depuis, soit plus de 2 mois.**

**Contradiction frontale avec le pilotage** — `PROJECT_HEALTH.md:82` déclare la dette DT-C01 **fermée la veille**, le 2026-06-26 :
> « ~~Rétroplay événements FAC/SAN/PAI~~ — **FERMÉE** (2026-06-26). Audit QW-02 révèle **zéro événements en erreur**. […] Précaution préventive sans impact concret. ✅ Clôturé sans action »

La dette a été close le 26 juin ; le rétroplay du 27 juin a produit 336 erreurs qui n'ont jamais été relues.

**Calibrage honnête de l'impact** ✅ VÉRIFIÉ EN PRODUCTION — **les 336 événements appartiennent à un seul tenant** : `b93b7c3d-…` = **« AMD FINANCE », secteur cabinet, statut `suspended`**. Il ne s'agit donc pas d'argent de clients actifs en attente d'imputation. **Je ne présente pas ces 339 M FCFA comme un préjudice en cours.** Ce qui est grave n'est pas le montant, c'est ce que le chiffre révèle du moteur : un taux d'échec de 43 %, une reprise à l'arrêt, et 240 échecs sans message d'erreur. Le jour où un tenant actif produira ce volume, rien ne le signalera.

---

**ANO-C09 — Les deux seules routes conformes à l'architecture cible sont CASSÉES en production**
✅ **VÉRIFIÉ EN PRODUCTION — découvert en Mission 0.1.** C'est le constat le plus lourd de conséquences pour le plan de réparation.

`app/api/comptabilite/balance/route.ts` et `grand-livre/route.ts` sont les **deux seules routes du projet qui consomment correctement l'ERP Core** (`computeBalance`, `computeGrandLivre`). Elles incarnent l'architecture cible de la CONSTITUTION. Les deux sont hors service.

**1. Le grand livre renvoie 400 en production.**
`lib/erp-core/compute/accounting.ts:96` définit :
```
GRAND_LIVRE_SELECT = 'id, date_operation, libelle, debit_account, credit_account, montant, reference, source, journal_type'
```
Test réel :
```
GET journal_entries?select=…,reference,…,journal_type  → 400
   {"code":"42703","message":"column journal_entries.reference does not exist"}
GET journal_entries?select=reference        → 400   (colonne réelle : reference_piece)
GET journal_entries?select=journal_type     → 400   (aucune colonne de ce nom)
GET journal_entries?select=reference_piece  → 200   ✅
GET journal_entries?select=…BALANCE_SELECT  → 200   ✅ (témoin)
```
→ `/api/comptabilite/grand-livre` **ne peut pas retourner autre chose qu'une 500.**

**2. La balance est cassée 5 mois sur 12.**
`app/api/comptabilite/balance/route.ts:35-38` construit la borne haute par concaténation :
```ts
const monthStr = String(mois).padStart(2, '0')
q = q.gte('date_operation', `${year}-${monthStr}-01`)
     .lte('date_operation', `${year}-${monthStr}-31`)
```
`-31` est appliqué à tous les mois. Test réel en production :
```
date_operation <= 2026-01-31 → 200 ✅
date_operation <= 2026-02-31 → 400  {"code":"22008","message":"date/time field value out of range"}
date_operation <= 2026-04-31 → 400
date_operation <= 2026-06-31 → 400
date_operation <= 2026-09-31 → 400
date_operation <= 2026-11-31 → 400
```
→ `/api/comptabilite/balance?mois=2|4|6|9|11` renvoie **500**. Février, avril, juin, septembre et novembre.

**3. Ni l'une ni l'autre n'a d'appelant.** `grep -rn "api/comptabilite" app components --include=*.tsx` → **0 résultat**. Les écrans lisent `journal_entries` en direct et recalculent (§2.2).

**Pourquoi c'est le constat le plus important pour la suite :** l'impact utilisateur est aujourd'hui **nul**, puisque ces routes ne sont appelées par personne. Mais le plan de remise en conformité consiste précisément à **faire migrer les écrans vers ces routes**. Or elles échouent dès le premier appel. **La cible de la migration est elle-même en panne, et personne ne pouvait le savoir** : le cast `const db = supabaseAdmin as any` (`balance:15`, `grand-livre:20`) supprime la vérification de colonnes, `typescript: { ignoreBuildErrors: true }` supprime le contrôle au build, `no-explicit-any: off` supprime l'alerte de lint, et aucun test ne couvre ces routes. Les trois filets sont neutralisés simultanément.

**4. Défaut annexe** — `grand-livre/route.ts:43-45` interpole un paramètre client brut dans un filtre PostgREST :
```ts
q = q.or(`debit_account.eq.${compteFilter},credit_account.eq.${compteFilter}`)
```
`compteFilter` n'est ni validé ni échappé ; les caractères `,` et `)` y sont structurants. Le `.eq('tenant_id')` reste appliqué en `and`, donc pas d'évasion de tenant, mais la sémantique du filtre est contrôlable par l'appelant.

**5. Aucun contrôle de rôle** sur ces deux états comptables opposables : un profil `membre` obtiendrait la balance générale complète du tenant.

---

**ANO-C10 — Le logiciel produit des déclarations fiscales officielles avec des taux faux, que le dépôt lui-même sait faux**
✅ **VÉRIFIÉ (code, citations littérales) — Mission 0.1.** C'est le risque le plus lourd du projet : il ne s'agit plus d'écrans incohérents mais de **documents transmis à l'administration fiscale et à la CNSS**.

**1. La Déclaration Générale DGI liquide une taxe abrogée, au double du taux subsistant.**

Ce que le code calcule — `lib/declarations/declaration-generale.ts:69-70` :
```ts
// TUS = Taxe Unique sur les Salaires = 4,5% des salaires bruts
const tus = Math.round(salaireBrut * 0.045)
```
Ce que le même dépôt affirme, trois fois, dans `lib/fiscal/congo-calculs.ts` :
```
l.8   * - TUS Fiscale 4,5% supprimée — seul le TUS CNSS 3% subsiste (LF 2026)
l.54  tus_fisc_45: number   // Toujours 0 — TUS Fiscale 4,5% supprimée par LF 2026
l.193 // TUS Fiscale : supprimée par LF 2026 — toujours 0
```
Ce qui est **imprimé sur le document remis à la DGI** — `components/declarations/DeclarationGeneralePDF.tsx:103` :
```ts
{ num: 9, nature: `TUS 4,5% (${n(d.l9_salaires_bruts)} bruts)`, principal: d.l9_tus ?? 0, highlight: true }
```
Chaîne complète : `declaration-generale.ts:70` → `app/api/declarations/mensuelle/route.ts` → `/api/declarations/mensuelle/pdf` → PDF ligne 9, **mise en évidence**.
→ **Le produit liquide à 4,5 % une taxe que la LF 2026 a supprimée**, sur un document signé par le client.

**2. La déclaration CNSS applique aux Allocations Familiales le plafond de l'Accident du Travail.**

Précision apportée en Mission 0.2 — **600 000 F n'est pas faux en soi** : c'est le plafond légitime de la branche AT/MP. Le défaut est de l'appliquer aussi aux **prestations familiales**.

Le barème de référence, `lib/countries/CG.ts:150-163`, distingue bien deux plafonds :
```ts
{ code: 'AF', taux_patronal: 0.10035, plafond_mensuel: 1_200_000 },   // LF 2026
{ code: 'AT', taux_patronal: 0.0225,  plafond_mensuel:   600_000 },
```
Le fichier qui produit la déclaration, `lib/declarations/cnss-congo.ts:13,97-99`, les fusionne sous un plafond unique :
```ts
export const PLAFOND_AT_MP_PF = 600_000
...
const base_at_mp_pf          = Math.min(brut, PLAFOND_AT_MP_PF)
const allocations_familiales = Math.round(base_at_mp_pf * TAUX_ALLOC_FAMILIALES)  // ← AF plafonnée à 600 000
const accidents_travail      = Math.round(base_at_mp_pf * TAUX_ACCIDENTS_TRAVAIL) // ← correct
```
`lib/paie/calcul-paie.ts:14` confirme l'intention correcte : `PLAFOND_AF = 1_200_000 // AF plafonnée sur base vieillesse (LF 2026)`.

**Écart chiffré, pour tout salarié à 1 200 000 F ou plus :**
```
AF correcte  : 1 200 000 × 0,10035 = 120 420 F
AF déclarée  :   600 000 × 0,1003  =  60 180 F
sous-déclaration = 60 240 F / salarié / mois
```
Chaîne : `cnss-congo.ts:97` → `app/api/declarations/cnss/[id]/pdf/route.ts` → `DeclarationGlobaleCNSS.tsx:54` et `ListeNominativeCNSS.tsx:115`, plus l'export Excel.

Défaut annexe : le taux lui-même diverge à la 5ᵉ décimale — `0.1003` (`cnss-congo.ts:16`) contre `0.10035` (`CG.ts:154`).

**3. Le PDF CNSS annonce des taux légaux qui ne sont pas ceux qu'il applique.**
`app/api/fiscalite/cnss/pdf/route.ts:157,169-170` imprime :
```
République du Congo · CNSS · Taux salarié: 5,04% · Patronal: 14,36%
```
Alors que `lib/countries/CG.ts:138` applique `taux_salarie: 0.04` — **4 %**. Cinq valeurs patronales concurrentes coexistent dans le dépôt (14,16 %, 14,36 %, 20,285 %, 20,29 %, 23,285 %).
→ **Le document remis à la CNSS affiche un taux réglementaire faux, incohérent avec ses propres montants — écart décelable par un contrôleur.**

**4. Sept autres chaînes mènent à une déclaration officielle avec une valeur non vérifiée** (détail complet en §23) : barème Patente Congo divergent d'un facteur ×13,5 · IRPP Congo divergent d'un facteur ≈50 entre deux moteurs · TVA Gabon et Tchad reposant sur un `TODO: confirmer — estimé par cohérence CEMAC` · CNSS des 6 pays non-congolais recalculée sur des taux « estimés » **alors que trois d'entre eux déclarent `support_declarations_cnss: false`** · barème IPR RDC obsolète que le dépôt interdit lui-même d'utiliser.

**5. Repli silencieux sur la fiscalité congolaise.** `lib/countries/index.ts:59-64` et `lib/fiscalite/pays.ts:702` retournent la configuration **CG** pour tout pays non implémenté (ML, SN, BF, NE, NG, AO, FR, BE, CH). Un client malien se verrait appliquer, sans aucun avertissement, la fiscalité du Congo.

**Ce que je ne peux pas établir** ⛔ : si ces déclarations ont été effectivement transmises à une administration. La volumétrie (§21) montre que les tenants porteurs de données comptables sont majoritairement `suspended`. **Le risque est donc à ce jour potentiel, non avéré** — mais il est structurel et se matérialisera au premier client actif.

---

### 🟠 MAJEURES

| ID | Anomalie | Preuve |
|---|---|---|
| **ANO-M01** | **Aucun CI.** `git ls-tree origin/main \| grep github` → vide. Le seul workflow (`semgrep.yml`) n'est pas versionné. Or `next.config.ts:10` désactive le typage au build en invoquant *« Type checking runs in CI separately »* — **il n'y a pas de CI.** | ✅ VÉRIFIÉ |
| **ANO-M02** | **`typescript: { ignoreBuildErrors: true }`** (`next.config.ts:10`) — aucun filet de type en production, sans CI pour compenser | ✅ VÉRIFIÉ |
| **ANO-M03** | **BUSINESS obtient le niveau N3.** `lib/plan-access.ts:123` (`if pme → return !REQUIRES_COMPAGNIE.has(id)`) ne teste **jamais** `REQUIRES_GRANDE`. 11 modules Compagnie (`bi`, `analytics`, `finance`, `audit`, `api-keys`, `direction`…) sont ouverts à Business | ✅ VÉRIFIÉ (code) |
| **ANO-M04** | **`taille = null` ouvre toutes les fonctionnalités Business.** `lib/feature-access.ts:61-62` (`if (!taille) return true`) contredit `lib/plan-access.ts:116-117` (`taille ?? 'tpe'`). Cas **atteignable** : `taille_entreprise` est nullable en production (§3.4) | ✅ VÉRIFIÉ EN PRODUCTION |
| **ANO-M05** | **Aucune validation d'entrée.** `zod`/`yup`/`joi` absents de `package.json` ; 0 route sur 212. `app/api/resto/[tenantId]/order/route.ts:23` accepte le `total` de la commande **depuis le client** | ✅ VÉRIFIÉ |
| **ANO-M06** | **Aucun header de sécurité** (CSP, X-Frame-Options, Referrer-Policy) | ✅ VÉRIFIÉ EN PRODUCTION |
| **ANO-M07** | **Rate limiting sur 14 routes / 212.** Rien sur `/api/miaa/chat` (Opus, 15 000 tokens) ni sur `/api/cv/upload` (parsing PDF, sans limite de taille) | ⚠️ NON RE-VÉRIFIÉ |
| **ANO-M08** | **23 calculateurs fiscaux concurrents** : 12 `calculerTVA`, 7 `calculerIRPP`, 4 CNSS. **Deux taux de TVA coexistent** : 18,9 % (Hôtel, Santé, BTP, Boisson) et 18 % (Cabinet, Finance, MIAA) | ✅ VÉRIFIÉ |
| **ANO-M09** | **11 erreurs ESLint bloquantes** dans le code réel (830 fichiers) : 8× LOI-L (taux fiscal en dur), 2× LOI-M (écriture directe `tenants`), 1× LOI-N | ✅ VÉRIFIÉ |
| **ANO-M10** | **Double écriture comptable** : `lib/compta-sync-client.ts:138` (`journal_comptable`) + `:157` (`journal_entries`), **sans transaction**. 14 pages, 20 sites d'appel. Un échec sur la 2ᵉ laisse la partie double déséquilibrée sans détection | ✅ VÉRIFIÉ (code) |
| **ANO-M11** | `writeComptaEntry` force **`tva: 0`, `ca: 0`** (`compta-sync-client.ts:143-146`) → toute écriture par ce chemin détruit la décomposition TVA | ✅ VÉRIFIÉ (code) |
| **ANO-M12** | **Mappings de comptes OHADA contradictoires dans un même fichier** : `'Salaires'` → `661` (`OHADA_DEFAULTS:37`) vs `641` (`CATEGORIE_OHADA_MAP:80`) | ✅ VÉRIFIÉ (code) |
| **ANO-M13** | **Le Core Integration n'émet rien.** `dispatchWebhookEvent` (`lib/webhooks/sender.ts:138`) a **0 appelant** dans tout le dépôt | ✅ VÉRIFIÉ |
| **ANO-M14** | **La facturation SaaS n'écrit rien.** 0 writer sur `billing_subscriptions`, `billing_invoices`, `billing_payments` — les abonnements ne peuvent être créés qu'à la main en base | ⚠️ NON RE-VÉRIFIÉ |
| **ANO-M15** | **Canal Realtime non cloisonné** : `components/ui/NotificationsPanel.tsx:102-105` — canal statique `notif-panel-v2`, `event:'INSERT'` sur `notifications` **sans clause `filter`**, contrairement aux 8 autres canaux | ✅ VÉRIFIÉ (code) |
| **ANO-M16** | **9 tables référencées par des routes API n'existent pas en production** : `facture_lignes`, `error_logs`, `primes_employe`, `avantages_nature_employe`, `resto_formule_items`, `academy_learner_parcours`, `academy_learner_memory`, `academy_learner_badges`, `academy_exam_attempts` | ✅ VÉRIFIÉ EN PRODUCTION (HTTP 404) |
| **ANO-M17** | **31 tables référencées par des pages n'existent pas** (`conges`, `elements_paie`, `product_categories`, `purchase_orders`, `stock_receptions`, `unites_enseignement`, `resto_tables`, `his_ordonnances`, `v_roles_summary`…) | ⚠️ NON RE-VÉRIFIÉ intégralement |
| **ANO-M18** | **2 routes API appelées mais inexistantes** : `app/dashboard/restaurant/inventaire/page.tsx:36,48` appelle `/api/stocks/articles` (le namespace est `/api/stock`) et `/api/resto/recettes` (inexistant) → 404 silencieux | ✅ VÉRIFIÉ (code) |
| **ANO-M19** | **Colonnes fantômes sur `tenants`** : `nom`, `secteur`, `taille`, `forme_juridique`, `capital_social`, `tva_numero` utilisées dans 8 fichiers, **aucune n'existe** (40 colonnes réelles listées) | ✅ VÉRIFIÉ EN PRODUCTION |
| **ANO-M20** | `lib/audit/engine.ts:284,558` sélectionne `tva_numero`/`forme_juridique` → requête en erreur → `tenant = null` → **l'audit OHADA lève systématiquement « NIU absent »** pour tous les tenants | ✅ VÉRIFIÉ (code) |
| **ANO-M21** | **72 routes importent `lib/tenant-guard.ts`, marqué `@deprecated` ligne 2.** Quatre API d'authentification concurrentes coexistent | ✅ VÉRIFIÉ |
| **ANO-M22** | **Le mode hors ligne est un affichage mensonger** (§5.4) | ✅ VÉRIFIÉ (code) |
| **ANO-M23** | **Grandfather Policy inexistante.** 2 commentaires (`lib/plans.ts:36`, `plan-access.ts:37`), zéro ligne de code, zéro test. Le mécanisme décrit (`tenant_modules`) en est structurellement incapable : `canAccessByPlan` ne lit jamais cette table | ✅ VÉRIFIÉ |
| **ANO-M24** | **`capability_level`, `max_users`, `miaa_tier` calculés puis jetés** (`TenantProfileFactory.ts:80-82`) — jamais persistés, colonnes inexistantes. La limite « 5 / 25 / illimité utilisateurs » vendue n'est **enforçable nulle part** | ✅ VÉRIFIÉ |
| **ANO-M25** | **`/api/modules/toggle` sans contrôle de plan ni liste blanche** — un owner TPE peut écrire `{"moduleId":"consolidation"}` dans `tenant_modules` | ⚠️ NON RE-VÉRIFIÉ |
| **ANO-M26** | 🔻 **CORRIGÉE — voir §24. Ma conclusion initiale était FAUSSE.** J'avais écrit que les écrans de paie « partent en clair chez un tiers ». **Aucune donnée ne quitte l'application via Sentry : le SDK n'est jamais initialisé.** Ce qui reste est un **piège armé**, pas une fuite. | 🔻 **RECTIFIÉ** |
| **ANO-M27** | **5 taux d'imposition sont explicitement DEVINÉS et utilisés en production.** Verbatim : `lib/fiscalite-gabon.ts:33` « TODO: confirmer le taux normal Gabon auprès de la DGI — **estimé 18% par cohérence CEMAC** » · `fiscalite-guinee-equatoriale.ts:42` « taux IS — **estimé 25% par cohérence CEMAC** » · `:71` « Patente GQ — **non précisé dans nos sources** » · `fiscalite-rca.ts:45` « Patente RCA — **non précisé** » · `fiscalite-tchad.ts:30` « taux normal TVA Tchad — **non disponible dans nos sources** ». Le produit calcule de vraies déclarations sur ces valeurs. **Risque de redressement fiscal pour les clients.** | ✅ VÉRIFIÉ |
| **ANO-M28** | **`const db = supabaseAdmin as any` dans 13 fichiers**, dont **`app/api/comptabilite/balance/route.ts:15` et `grand-livre/route.ts:20`** — la balance générale et le grand livre SYSCOHADA. Le cast `any` supprime toute vérification de table, de colonne et de forme de retour **sur le client qui contourne la RLS**. Une faute de frappe sur `tenant_id` ne lève ni erreur de compilation (`ignoreBuildErrors`), ni alerte ESLint (`no-explicit-any: off`), et retourne des données cross-tenant. | ✅ VÉRIFIÉ |
| **ANO-M29** | **Code mort confirmé par grep nominatif** : **14 composants sur 76** (18 % de `components/`) à zéro référence · **8 modules `lib/` entièrement morts, 1 034 lignes** (`email-templates.ts` 296 l., `modules.ts` 270 l., `textes-fiscaux.ts` 134 l., `messaging.ts` 121 l., `db.ts` 79 l., `workflow/triggers.ts` 64 l., `miaa/models-config.ts` 50 l., `erp-core.ts` 20 l.). | ✅ VÉRIFIÉ (spot-check) |
| **ANO-M30** | **Le barrel `lib/erp-core/index.ts` a 0 importeur**, alors qu'il proclame ligne 5 : *« Une seule vérité métier. Une seule logique. Toutes les pages consomment ici. »* En conséquence `computeEBITDA`, `computeTresorerie`, `computeStockSummary`, `computeClientsSummary`, `buildERPContext` sont **morts** (0 référence). Les calculs centralisés de trésorerie, EBITDA, stock et clients ne sont appelés par personne. | ✅ VÉRIFIÉ |
| **ANO-M31** | **La route acompte utilisée par l'UI est la MOINS sécurisée.** `/api/paie/acomptes` (appelée depuis `rh/paie/page.tsx:1590`) : `date_acompte` optionnelle, **aucun contrôle du statut de l'employé**, `created_by` non renseigné. `/api/rh/acomptes` (**0 appelant**) : date obligatoire, rejette `licencie`/`retraite` (l.67-69), trace `created_by`. Les deux écrivent dans `acomptes_salaires` et émettent `PAI-003`. → **On peut créer un acompte pour un employé licencié, sans traçabilité.** | ✅ VÉRIFIÉ (code) |
| **ANO-M32** | **Deux arborescences Recrutement en parallèle** : `app/dashboard/recrutement/` (13 pages) et `app/dashboard/rh/recrutement/` (8 pages), avec 6 sous-routes homonymes. `candidatures/page.tsx` : 199 lignes d'un côté, 378 de l'autre, **520 lignes de divergence**. Aucune n'est un sur-ensemble de l'autre. | ⚠️ NON RE-VÉRIFIÉ |
| **ANO-M33** | **14 implémentations concurrentes du formatage monétaire** (`fmtFCFA`/`formaterMontant`/`formatFCFA`) + 32 `const fmt =` locaux. 3 scripts de migration abandonnés sur ce sujet dans `scripts/`. | ⚠️ NON RE-VÉRIFIÉ |
| **ANO-M34** | **`lib/fiscalite-congo.ts` (génération legacy) alimente la facturation opposable.** Il est importé par 8 fichiers de production, dont `app/api/factures/route.ts:4`, `components/facture/FacturePDF.tsx:4` et `app/dashboard/factures/[id]/preview/page.tsx:14`. Les documents remis au client n'utilisent donc **pas** le moteur « canonique » `universal-tax-engine`. | ⚠️ NON RE-VÉRIFIÉ |
| **ANO-M35** | **5 dépendances déclarées et jamais importées** : `@radix-ui/react-dialog`, `@radix-ui/react-tooltip`, `@supabase/auth-helpers-nextjs` (prédécesseur **déprécié** de `@supabase/ssr`), `@supabase/auth-ui-react`, `@types/glob`. | ⚠️ NON RE-VÉRIFIÉ |
| **ANO-M36** | **`xlsx@^0.18.5`** — dernière lignée publiée sur npm par SheetJS, porteuse d'avis de sécurité connus (Prototype Pollution, ReDoS) **sans correctif atteignable via npm**. Alimentée par de l'**upload utilisateur** : `app/api/miaa/analyze-file/route.ts:2`. | ⚠️ NON RE-VÉRIFIÉ |

### 🟡 NORMALES

| ID | Anomalie |
|---|---|
| ANO-N01 | `chart_of_accounts` lisible par un anonyme (29 lignes, `tenant_id` NULL — plan OHADA générique, aucune donnée client) ✅ VÉRIFIÉ EN PRODUCTION |
| ANO-N02 | `fn_accounting_health_check` exécutable par un anonyme → état interne du moteur exposé ✅ VÉRIFIÉ EN PRODUCTION |
| ANO-N03 | `SUPER_ADMIN_EMAILS` en dur et **dupliqué** : `proxy.ts:48` et `lib/admin-config.ts:3`, sans synchronisation |
| ANO-N04 | `manifest.json` sans `id` ni `scope` ; `theme_color` incohérent avec `layout.tsx:44` |
| ANO-N05 | Page hors ligne du SW inatteignable (`sw.js:100`, `??` sur une Promise toujours truthy) |
| ANO-N06 | 22 pages avec `<table>` sans `overflow-x-auto` |
| ANO-N07 | Pas de `viewport-fit=cover` ; éléments `fixed bottom-*` sous la home-bar iOS |
| ANO-N08 | `/api/whatsapp/webhook` exige une session → webhook Meta non fonctionnel |
| ANO-N09 | `/sentry-example-page` est une page publique de production (`proxy.ts:14`) |
| ANO-N10 | Deux buckets Storage pour le logo (`logos` vs `entreprise`) — le dernier écran utilisé écrase l'autre |
| ANO-N11 | `app/dashboard/agriculture/page.tsx:9-12` et `banque/page.tsx:9-12` : KPI figés à `'—'` alors que les tables existent |
| ANO-N12 | `TenantContext` : `localStorage` (`oraforme_tenant_v2`, TTL 5 min) non purgé à la déconnexion |
| ANO-N13 | Interpolation non échappée dans un filtre PostgREST `.or()` — `app/api/sante/patients/route.ts:24` |
| ANO-N14 | Registre LOI-O erroné : DET-O-004 déclare `table: 'taches'`, le code écoute `tasks` (le code est juste) |
| ANO-N15 | Anomalies de numérotation des migrations (§3.5) |
| ANO-N16 | **Fichier nommé `NUL` à la racine** (90 octets) — nom de périphérique réservé MS-DOS, créé par un `> NUL` sous Git Bash. Contenu : `/usr/bin/bash: line 1: type: c:\...\.env.local: not found`. Casse `rm -rf`, `git clean` et les archiveurs Windows. Non ignoré. ✅ VÉRIFIÉ |
| ANO-N17 | **Collision de nom `lib/erp-core.ts` (908 o.) et `lib/erp-core/` (dossier)** coexistent. `grep "from '@/lib/erp-core'"` → 0 importeur, donc inoffensif aujourd'hui ; mais un futur import du chemin nu résoudrait de façon non déterministe entre deux modules aux exports totalement différents. ✅ VÉRIFIÉ |
| ANO-N18 | **`lib/feature-access.ts` est fail-open, `lib/plan-access.ts` est fail-closed** sur le même cas (`taille` inconnue). Deux modules de contrôle d'accès aux plans avec des postures de sécurité opposées (voir aussi ANO-M04). |
| ANO-N19 | **Deux bibliothèques Excel** (`xlsx` + `exceljs`) et **trois chaînes PDF** (`@react-pdf/renderer`, `jspdf`, `html2canvas`) coexistent. Le build exige `--max-old-space-size=4096` (`vercel.json:2`). |
| ANO-N20 | **30 des 38 fichiers de `scripts/` et 6 des 12 de `tests/` ne sont pas versionnés**, dont 12 dumps JSON de traduction et 4 variantes du même générateur swahili (`gen_sw.js`/`.ts`/`2.js`/`_ps.js`). |
| ANO-N21 | **`@types/qrcode` déclaré en `dependencies`** au lieu de `devDependencies` (`package.json:30`). |

### 🟢 PRODUCTION

**ANO-P01 — `oraforme.com` ne résout vers aucune adresse**
✅ **VÉRIFIÉ — deux résolveurs indépendants (Google 8.8.8.8 et Cloudflare 1.1.1.1) :**
```
oraforme.com      A     → NOERROR, AUCUNE réponse
oraforme.com      AAAA  → NOERROR, AUCUNE réponse
oraforme.com      CNAME → NOERROR, AUCUNE réponse
www.oraforme.com  A     → NXDOMAIN
oraforme.com      NS    → ns1042.ui-dns.de, ns1070.ui-dns.biz, ns1035.ui-dns.com, ns1065.ui-dns.org (IONOS)
SOA serial : 2017060112
```
Le domaine est enregistré et délégué à IONOS, mais **aucun enregistrement A/AAAA/CNAME n'est publié**. `curl https://oraforme.com` → `Could not resolve host`.
**Le site n'est joignable qu'à `https://oraforme.vercel.app`.**
Note : `public/robots.txt` déclare `Sitemap: https://www.oraforme.com/sitemap.xml` — un domaine qui n'existe pas.

**ANO-P02 — Le SW, le manifeste et `robots.txt` renvoient la page de login aux visiteurs non authentifiés** (§5.1)

**ANO-P03 — Aucun environnement de recette.** `.env.local` et `tests/certifications/helpers/db.ts:8` pointent tous deux sur la base de production. Les tests de certification y réinitialisent des mots de passe utilisateurs. Le serveur de développement local écrit dans la vraie base.

**ANO-P04 — Fichiers non versionnés critiques.** `.github/workflows/semgrep.yml`, `playwright.config.ts`, `tests/e2e/`, `tests/load/`, 8 fichiers `docs/` et `@playwright/test` (présent dans le `package.json` local, absent du commité) ne sont **pas dans git**. Ils seront perdus avec la machine et n'existent pas pour l'équipe.

**ANO-P05 — Pollution du dépôt.** 93 fichiers non suivis à la racine, dont un fichier nommé `NUL`, ~40 captures `audit-*.png`, 12 fichiers `missing_*.json` / `translated_*.json`. `.gitignore` ne couvre pas `.claude/`.

---

## 10. CAUSES RACINES

| # | Cause racine | Anomalies qui en découlent |
|---|---|---|
| **CR-1** | **La base de production n'a jamais été construite par les migrations.** Pas de table de suivi, des migrations exécutées à la main dans l'éditeur SQL, 8 migrations entières jamais jouées, 18 objets créés hors migration. | ANO-C02, C03, M16, M17, M19, M20, tout le §3.4 |
| **CR-2** | **Les erreurs sont systématiquement avalées.** 280 pages sur 324 sans état d'erreur ; motif `const { data } = ...` + `data ?? []` généralisé ; 17 `catch {}`. | CR-1 est resté invisible pendant des mois. C'est le multiplicateur de toutes les autres causes. |
| **CR-3** | **Aucun CI.** Pas de workflow sur `origin/main`, `ignoreBuildErrors: true`, Semgrep jamais exécuté, tests jamais lancés automatiquement. | ANO-M01, M02, M09, et la persistance de tout le reste |
| **CR-4** | **L'architecture est documentée mais pas appliquée.** Les LOI-K/L/M/N/O existent, avec tests et documentation — mais leurs `ignores` exemptent précisément les dettes connues (`lib/compta-sync-client.ts`, `app/dashboard/comptabilite/**`), et les tests scannent **ligne par ligne**, donc un `.from('tenants')` et un `.update({` sur deux lignes échappent au contrôle. | ANO-M09, M10, M21, les 16 scores de Core |
| **CR-5** | **Correctif de sécurité appliqué sur une hypothèse non vérifiée.** Le commit `81e9302` a ouvert `AUTOMATION_PATHS` en supposant que chaque route validait son secret. 10 sur 15 ne le faisaient pas. | ANO-C01, C05 |
| **CR-6** | **Le produit est une application quasi entièrement cliente.** 356 fichiers `'use client'` sur 424 ; 174 pages interrogent Supabase directement avec la clé anon ; 0 page n'utilise l'ERP Core. La sécurité repose **entièrement** sur la RLS Postgres. | Cores Permission (24), Analytics (34), Reporting (30), §7 |
| **CR-7** | **Les indicateurs de pilotage sont auto-déclarés et non recalculés.** AHI 82, BCI 90, « 0 régression », certifications Argent/Or — aucun n'est reproductible depuis le code. | §1.2 |

---

## 11. DETTES TECHNIQUES

| ID | Dette | Ampleur mesurée |
|---|---|---|
| DT-1 | `writeComptaEntry` (double écriture legacy) | 14 pages, 20 sites d'appel |
| DT-2 | `lib/tenant-guard.ts` `@deprecated` | 72 routes |
| DT-3 | Écritures Supabase directes depuis le navigateur | **389 écritures, 110 fichiers** |
| DT-4 | Namespaces paie en doublon `/api/paie/` vs `/api/rh/paie/` | 4 routes conformes sur 6 sont mortes |
| DT-5 | Deux moteurs de paie | `universal-payroll-engine.ts` (1090 l., testé, **inutilisé**) vs `calcul-paie.ts` (227 l., utilisé, **non testé**) |
| DT-6 | Modules ERP Core sans consommateur | `compute/stock.ts`, `compute/clients.ts`, `compute/ebitda.ts` |
| DT-7 | Tables mortes | `htl_journal_entries` (0 l.), `htl_journal_lines` (0 l.), `entity_kpi_snapshots` (0 l.) — ⚠️ `mouvements_comptables` **retirée de cette liste** : c'est une vue peuplée (1 319 l.), voir correction §2.2 |
| DT-8 | `lib/modules.ts` | 0 importeur |
| DT-9 | Moteur Workflow | 1518 lignes, 0 test, 0 consommation d'événements |
| DT-10 | MIAA | 5241 lignes, 0 test |
| DT-11 | 5 référentiels clients concurrents | `clients`, `cabinet_clients`, `commerce_clients`, `mad_clients`, `htl_guests` |
| DT-12 | 9 pages de démonstration en production | §7.1 |
| DT-13 | Composants morts | **14 sur 76** (18 % de `components/`) |
| DT-14 | Modules `lib/` morts | **8 modules, 1 034 lignes** |
| DT-15 | Barrel ERP Core mort + 4 modules de calcul financier morts | `index.ts` 0 importeur ; EBITDA, trésorerie, stock, clients inatteignables |
| DT-16 | Formatage monétaire | 14 implémentations + 32 `const fmt =` locaux |
| DT-17 | Modules fiscaux par pays | **4 générations coexistantes** (`fiscalite-*.ts`, `countries/*.ts`, `fiscalite/pays.ts`, `pays-config.ts`) |
| DT-18 | Arborescences Recrutement en doublon | 21 pages au total, 6 sous-routes homonymes |
| DT-19 | Fichiers parasites non ignorés | 41 entrées à la racine, 4,6 Mo (33 captures, 7 dumps JSON, `NUL`) |
| DT-20 | Exemptions d'architecture institutionnalisées | Les tests LOI-K/L/M/N passent **parce que** les violations sont whitelistées (`loi-k:29`, `loi-m:42`, `loi-n:30`, `loi-l:29`, `eslint.config.mjs:326`) |

---

## 12. RÉGRESSIONS — VÉRIFICATION DES ANCIENS BUGS

| # | Bug historique | Verdict |
|---|---|---|
| 1 | Spinner / flash dashboard | ✅ **CORRIGÉ et généralisé** — `RefreshOrchestrator.tsx:31-33` applique `startTransition` |
| 2 | Boucle `router.refresh()` | ✅ **CORRIGÉ** — 2 occurrences seulement, toutes deux en `startTransition`, aucune dans un `useEffect` |
| 3 | TenantContext | ✅ **CORRIGÉ** — un seul provider, pas de boucle. Défaut mineur : `value` non mémoïsée (`:282`) |
| 4 | `tenant_modules` vs `modules_actifs` | ⚠️ **DIVERGENCE ACTIVE** — les deux existent en prod ; la lecture utilise bien `tenant_modules` (fix tenu), mais `modules_actifs` n'est **jamais écrit** à la création (onboarding, admin) → divergence permanente |
| 5 | Business = Compagnie | ❌ **RÉGRESSÉ** — ANO-M03 |
| 6 | Création Compagnie | ❌ **3 BUGS ACTIFS** — entité fille cassée (`groupe/gestion:171` écrit `taille`/`secteur`, inexistantes) ; champs admin jetés ; `taille` forcée à `tpe` |
| 7 | `secteur` vs `secteur_activite` | ⚠️ **PARTIEL** — école corrigée ; **3 routes API utilisent encore `secteur`** (`jobs/offre:24`, `declarations/patente:47`, `miaa/compliance:154`) |
| 8 | Colonnes obsolètes `tenants` | ❌ **RÉGRESSÉ** — ANO-M19, 6 colonnes fantômes, 8 fichiers |
| 9 | Fiscalité / TVA / CNSS / IRPP | ❌ **JAMAIS CORRIGÉ** — `accounting_fiscal_params` existe en prod avec 14 lignes, **`grep` sur tout le code applicatif → 0 lecture**. Tous les taux sont en dur en TypeScript |
| 10 | Doubles écritures comptables | ❌ **ACTIVES** — ANO-M10 |
| 11 | Writers directs | ❌ **NON RÉSOLU** — 389 écritures / 110 fichiers |
| 12 | Realtime | ✅ **PAS DE FUITE** — 9 canaux, 9 nettoyages au démontage. Une anomalie : `notif-panel-v2` sans filtre tenant (ANO-M15) |
| 13 | Permissions / auth | ❌ **RÉGRESSÉ — CRITIQUE** — ANO-C01, C05 |
| 14 | Cron Vercel | ✅ **CORRIGÉ sur le routage** (12/12 routes atteignables) — mais **a causé** ANO-C01 |
| 15 | PWA cache bloquant les mises à jour | ✅ **PAS DE BLOCAGE** — `skipWaiting` + `clients.claim` + HTML en network-first. Les défauts réels sont différents (§5.2) |

---

## 13. SCORES

Chaque score est adossé à une mesure. **Aucun score n'est estimé.**

| Dimension | Score | Justification factuelle |
|---|---:|---|
| **Architecture** | **30/100** | Moyenne des 16 Cores : 30,4. 0 page sur 324 n'utilise l'ERP Core. Les 2 routes conformes ont 0 appelant. 4 registres comptables. Crédit : `accounting_events` a 0 INSERT direct. |
| **Business Consistency** | **25/100** | 4 définitions du CA, 23 calculateurs fiscaux, 2 taux de TVA simultanés, 9 pages de fausses données, écrans du même module affichant des chiffres différents. |
| **ERP Synchronization** | **30/100** | 19 routes émettent des événements ✅ ; paie déconnectée ; Workflow, Notification, MIAA, Integration ne consomment aucun événement ; reporting ignore `accounting_events`. |
| **Security** | **42/100** | *Révisé en Mission 0.1.* **Fort** : RLS empiriquement solide (1 fuite bénigne sur 329 objets), aucune fuite de `service_role` côté navigateur, `requireApiKey` correct, migrations 161/164/166 appliquées, **et aucune donnée ne part chez Sentry** (§24 — ANO-M26 rectifiée à la hausse). **Faible** : 10 endpoints d'automatisation anonymes (ANO-C01), 2 endpoints réellement anonymes acceptant un `tenant_id` client (§22.1), 5 escalades horizontales entre tenants authentifiés, 2 IDOR, ~257 requêtes sans RLS dont 13 avec le typage neutralisé, 0 header de sécurité, 0 validation d'entrée, vecteur d'escalade RLS non testé (ANO-C04). |
| **Conformité fiscale** | **15/100** | *Nouvelle dimension, Mission 0.1.* 12 chaînes mènent à un document administratif avec une valeur fausse ou non vérifiée (§23), dont une **taxe abrogée liquidée à 4,5 %** sur la déclaration DGI et des **taux CNSS imprimés qui ne sont pas ceux appliqués**. 4 générations de barèmes concurrentes, repli silencieux sur la fiscalité congolaise pour 9 pays non implémentés, millésimes de 34 mois. Seul point positif : `universal-tax-engine.ts` est testé sur 492 lignes — mais il n'alimente pas les déclarations. |
| **Performance** | **NON MESURÉ** | Aucun Lighthouse, aucun test de charge, aucun profilage n'a été exécuté. **Je refuse d'attribuer un score sans mesure.** |
| **Testing** | **25/100** | 469 tests passent ✅, mais `vitest.config.ts:6` limite le périmètre à `lib/**` : **0 test sur 212 routes API, 0 sur 324 pages, 0 sur 74 composants**. E2E non versionnés. Aucun CI. |
| **UX** | **35/100** | 1 `loading.tsx` et 1 `error.tsx` pour 324 pages ; 280 pages sans état d'erreur ; écrans vides silencieux sur modules cassés ; données de démo mêlées aux données réelles. |
| **Responsive** | **50/100** | Point positif vérifié : tous les fichiers avec `min-w-[≥400px]` ont aussi un `overflow-x-auto`. Mais 22 pages avec `<table>` non scrollable, pas de safe-area iOS. |
| **PWA** | **35/100** | Manifeste et SW non servis aux visiteurs ; installation impossible depuis la landing ; mode hors ligne non fonctionnel avec message trompeur ; cache de pages authentifiées non purgé. Crédit : mécanisme de mise à jour correct. |
| **Production Health** | **40/100** | Application en ligne et base saine ✅ ; mais `oraforme.com` ne résout pas, facturation et stocks cassés, aucun CI, aucun environnement de recette. |

### SCORE GLOBAL : **32/100**

Moyenne des 10 dimensions mesurées (Performance exclue faute de mesure) :
(30 + 25 + 30 + 42 + 15 + 25 + 35 + 50 + 35 + 40) / 10 = **32,7**.

Le score baisse malgré la rectification favorable sur Sentry, parce que la Mission 0.1 a ouvert une dimension qui n'était pas mesurée — la conformité fiscale — et qu'elle est la plus faible du dossier.
À comparer à l'AHI auto-déclaré de **82/100**.

**Ce score n'est pas un jugement sur le travail accompli.** Le volume fonctionnel (225 000 lignes, 324 pages, 16 domaines métier, 7 pays, conformité OHADA) est considérable, et plusieurs fondations sont solides : la RLS tient, le moteur d'événements comptables est propre, les corrections de flash/boucle tiennent. Le score est bas parce que **la couche de données a divergé du code sans que rien ne le signale**.

---

## 14. RISQUES SÉCURITÉ

1. **ANO-C01** — 10 endpoints d'automatisation publics, dont un qui écrit sur tous les tenants restaurant.
2. **ANO-C04** — vecteur d'escalade de privilège `profiles.role` (non testé en production).
3. **ANO-C05 / C06** — deux IDOR, dont un totalement anonyme.
4. **ANO-C07** — `/api/debug/db-check` : écriture en base de production, en `GET`, ouverte à tout utilisateur authentifié, avec fuite d'identifiants et d'erreurs SQL brutes.
5. **ANO-M26** — rejeu Sentry non masqué à 100 % sur erreur, incluant les écrans de paie (données personnelles employés).
6. **ANO-M28** — `supabaseAdmin as any` sur la balance et le grand livre : plus aucune vérification statique sur le client qui contourne la RLS.
7. **ANO-M05** — aucune validation d'entrée ; montant de commande fixé par le client.
8. **ANO-M06** — aucun header de sécurité (clickjacking possible sur `/dashboard` et `/admin`).
9. **ANO-M07** — pas de rate limiting sur les endpoints IA coûteux ni sur l'upload de fichiers non authentifié.
10. **ANO-M36** — `xlsx@0.18.5` vulnérable et non corrigeable via npm, alimenté par de l'upload utilisateur.
11. **§5.3** — cache SW de pages authentifiées, non purgé à la déconnexion.
12. **Rotation de la clé `service_role`** ⛔ non vérifiable — elle a existé en dur dans l'historique git (commit `0a2ee15`).

---

## 15. RISQUES DONNÉES

1. **ANO-C02** — lignes de facture perdues ; PDF sans détail. **Impact comptable et légal direct.**
2. **ANO-M10 / M11** — double écriture sans transaction ; `tva: 0` forcé → **états fiscaux structurellement faux** sur le chemin legacy.
3. **§6.2** — les paies générées ne produisent aucune écriture comptable.
4. **ANO-C03** — stock recalculé côté navigateur sans verrou → condition de course garantie en multi-utilisateur.
5. **ANO-M12** — deux plans de comptes OHADA contradictoires dans le même fichier.
6. **ANO-M08** — deux taux de TVA appliqués simultanément selon le module.
7. **§5.4** — mutations hors ligne perdues, avec un message affirmant la synchronisation.

---

## 16. RISQUES PRODUCTION

1. **ANO-P01** — le domaine commercial ne résout pas.
2. **ANO-P03** — aucun environnement de recette ; les tests écrivent en production.
3. **ANO-M01** — aucun CI : rien n'empêche un déploiement cassé.
4. **ANO-P04** — fichiers critiques non versionnés (CI, config E2E, tests).
5. **ANO-C01** — un tiers peut déclencher la clôture comptable des restaurants.

---

## 17. TESTS EXISTANTS

✅ **VÉRIFIÉ — exécutés ce jour :**

| Outil | Commande | Résultat |
|---|---|---|
| TypeScript | `npx tsc --noEmit` | ✅ **0 erreur** (exit 0) |
| Vitest | `npx vitest run` | ✅ **20 fichiers, 469 tests, 469 passés** en 4,66 s |
| ESLint | `npx eslint . --format json` | ❌ **11 erreurs, 51 warnings** sur 830 fichiers |
| Playwright | — | ⛔ **NON EXÉCUTÉ délibérément** (écrit en production — voir avertissement méthodologique) |

**Détail des 11 erreurs ESLint** (toutes des violations des lois d'architecture du projet) :
```
app/api/agents/commercial/analyse/route.ts:187        LOI-L  taux fiscal en dur
app/api/cabinet/clients/[id]/factures/route.ts:39     LOI-L
app/dashboard/cabinet/clients/[id]/page.tsx:211       LOI-L
app/dashboard/cabinet/clients/[id]/page.tsx:815       LOI-L
app/dashboard/finance/page.tsx:1054                   LOI-L
app/dashboard/finance/page.tsx:1080                   LOI-L
app/dashboard/finance/page.tsx:1081                   LOI-L
components/onboarding/Step1.tsx:187                   LOI-L
app/dashboard/profil/actions.ts:115                   LOI-M  écriture directe tenants
app/dashboard/profil/page.tsx:88                      LOI-M
components/dashboard/Sidebar.tsx:529                  LOI-N  comparaison de rôle directe
```

**Nuance importante sur le « TypeScript 0 erreur » :** `tsconfig.json:33-42` **exclut** `tests/e2e`, `tests/certifications`, `tests/qa`, `tests/load` et les configs Playwright. Le résultat ne couvre donc pas les suites de test. Et `next.config.ts:10` désactive de toute façon le typage au build.

---

## 18. TESTS MANQUANTS ET ZONES NON VÉRIFIABLES

### 18.1 Zones sans aucun test

`vitest.config.ts:6` : `include: ['lib/**/*.test.ts', '__tests__/**/*.test.ts']`.

→ **0 test sur** : les 212 routes API, les 324 pages, les 74 composants, `lib/erp-core` (1416 lignes), `lib/workflow` (1518 lignes), `lib/miaa` (5241 lignes), `lib/billing.ts` (231 lignes), `lib/paie/calcul-paie.ts` (le moteur réellement utilisé), les règles comptables, les taux fiscaux par pays.

Les 469 tests couvrent essentiellement `lib/identity`, `lib/fiscal/universal-tax-engine` (1 des 12 calculateurs TVA), `lib/payroll/universal-payroll-engine` (moteur non utilisé) et les gardes d'architecture.

### 18.2 ⛔ Points NON VÉRIFIABLES sans accès SQL direct

À rouvrir dès que le MCP Supabase sera rétabli :

1. **Policies RLS réelles** — expressions `USING`/`WITH CHECK` (`pg_policies`)
2. **Triggers actifs** — notamment les ~13 triggers comptables legacy déclarés dans `PROJECT_HEALTH.md`
3. **Index** — migration 169 (`CREATE INDEX` sur FK)
4. **GRANT/REVOKE** par rôle (`information_schema.role_table_grants`)
5. **`search_path`** des fonctions — migration 165
6. **Extensions** `pg_net`, `pg_cron` — migration 162
7. **Jobs `cron.job`** — migration 167 (qui exige en plus deux `vault.create_secret` manuels préalables)
8. **Précision `factures.tva`** — migration 160 : PostgREST ne publie jamais `numeric(p,s)`
9. **Contraintes CHECK** — migration 155
10. **Exploitation réelle de l'escalade de privilège ANO-C04** — exige une écriture

### 18.3 Points non vérifiés faute de temps ou d'outil

- Performance (aucune mesure)
- Rendu visuel réel des 324 pages (aucune n'a été exécutée)
- Colonnes utilisées par les 212 routes API (seules les tables ont été validées)
- Logique métier interne de la majorité des pages
- `agents/securite.ts` — corps des fonctions appelées par les 9 routes cron ouvertes

---

## 19. PLAN DE RÉPARATION — ORDRE EXACT

### PHASE 0 — À FAIRE AVANT TOUTE LIGNE DE CODE (quelques heures)

| Ordre | Action | Pourquoi en premier |
|---:|---|---|
| **0.1** | **Rétablir la connexion MCP Supabase** | 10 zones du rapport restent aveugles sans SQL direct. Aucune correction de sécurité ne doit être validée à l'aveugle. |
| **0.2** | **Trancher la question `facture_lignes`** : les lignes sont-elles dans `factures.items` (jsonb) ou la table a-t-elle disparu ? | Détermine si ANO-C02 est une migration à jouer ou un code à réécrire. **Ne rien corriger avant de savoir.** |
| **0.3** | **Créer un projet Supabase de recette** et y basculer `.env.local` et les tests | Tant que les tests écrivent en production, aucune vérification n'est sûre. |
| **0.4** | **Committer les fichiers non versionnés** (`.github/`, `playwright.config.ts`, `tests/e2e/`, `package.json`) | Sinon tout ce qui suit est irreproductible. |

### PHASE 1 — P0 : SÉCURITÉ ET PERTE DE DONNÉES (jours 1-3)

| Ordre | Anomalie | Action |
|---:|---|---|
| **1.1** | ANO-C01 | Ajouter la vérification `CRON_SECRET` aux 10 routes non protégées. **Commencer par `agents/restaurant/cloture`** (elle écrit). |
| **1.2** | ANO-C05 | Retirer `/api/miaa/notifications` de `AUTOMATION_PATHS` ou dériver `tenant_id` de la session. |
| **1.3** | ANO-C06 | Ajouter une vérification de propriété sur `/api/resto/receipt/[commandeId]`. |
| **1.4** | ANO-C04 | Tester l'escalade en recette, puis corriger le `WITH CHECK` de la policy `profiles`. |
| **1.5** | ANO-C02 | Selon le verdict 0.2 : rétablir `facture_lignes` **ou** réécrire les 6 fichiers. Ajouter le contrôle d'erreur manquant à `app/api/factures/route.ts:87`. |
| **1.6** | ANO-C02 (suite) | Aligner `app/api/factures/route.ts:60-79` sur les 21 colonnes réelles de `factures`. |
| **1.7** | ANO-C03 | Décider où vit la quantité en stock, puis aligner les 14 pages. |
| **1.8** | ANO-C07 | **Supprimer `/api/debug/db-check`** (ou la réserver aux super-admins et retirer l'INSERT). Puis compter les résidus : `SELECT count(*) FROM clients WHERE nom LIKE '__test_%'`. |
| **1.9** | ANO-M26 | Passer `maskAllText: true` et `blockAllMedia: true` dans `sentry.client.config.ts:15-16`. Correction d'une ligne, enjeu de données personnelles. |
| **1.10** | ANO-M27 | Faire confirmer par les DGI concernées les 5 taux devinés (TVA Gabon, IS et Patente Guinée Équatoriale, Patente RCA, TVA Tchad) **ou** désactiver ces pays. |

### PHASE 2 — P1 : COHÉRENCE MÉTIER (semaine 1-2)

| Ordre | Anomalie | Action |
|---:|---|---|
| 2.1 | ANO-M01 | Committer `.github/workflows/`, ajouter `tsc --noEmit`, `eslint`, `vitest` en gate de PR. **Rien d'autre ne tiendra sans ça.** |
| 2.2 | ANO-M09 | Corriger les 11 erreurs ESLint. |
| 2.3 | ANO-M03 / M04 | Corriger `plan-access.ts:123` (tester `REQUIRES_GRANDE`) et `feature-access.ts:62` (aligner sur `?? 'tpe'`). |
| 2.4 | ANO-M08 | Trancher : 18 % ou 18,9 % ? Puis brancher `accounting_fiscal_params` (14 lignes déjà en base, jamais lues). |
| 2.5 | §6.2 | Rebrancher la chaîne paie → comptabilité. |
| 2.6 | ANO-M16/M17/M19 | Audit exhaustif code ↔ schéma, puis alignement. |
| 2.7 | CR-2 | Ajouter un `error.tsx` par section et lire `error` sur les requêtes critiques. **C'est ce qui empêchera le prochain CR-1.** |

### PHASE 3 — P2 : PRODUCTION ET PWA (semaine 2-3)

| Ordre | Action |
|---:|---|
| 3.1 | ANO-P01 — publier les enregistrements DNS chez IONOS et rattacher le domaine à Vercel. |
| 3.2 | ANO-P02 — ajouter `manifest.json`, `sw.js`, `robots.txt`, `sitemap.xml` aux exclusions du matcher `proxy.ts:176`. |
| 3.3 | ANO-M06 — ajouter les headers de sécurité. |
| 3.4 | §5.3 — exclure `/dashboard` du cache SW et purger les caches à la déconnexion. |
| 3.5 | §5.4 — implémenter la file hors ligne **ou** retirer les messages qui la promettent. |
| 3.6 | ANO-M05 — introduire `zod` sur les routes d'écriture, en commençant par `/api/resto/[tenantId]/order`. |

### PHASE 4 — P3 : DETTE (continu)

Retrait des 9 pages de démonstration · migration LEC (`writeComptaEntry`) · unification des 4 gardes d'authentification · suppression des tables mortes · tests sur les routes API · recalcul honnête de l'AHI/BCI.

---

## 20. CE QUI NE DOIT PAS ÊTRE MODIFIÉ

Ces éléments fonctionnent et sont vérifiés. **Y toucher créerait des régressions.**

| Élément | Preuve |
|---|---|
| **Les politiques RLS de production** | ✅ 328 objets sur 329 protégés contre l'anonyme. Le meilleur actif du projet. |
| **`accounting_events` et `emit_accounting_event`** | ✅ 0 INSERT direct. Le seul invariant d'architecture réellement tenu. |
| **`lib/fiscal/universal-tax-engine.ts`** | 492 lignes de tests, le seul calculateur fiscal fiable. **C'est vers lui qu'il faut converger.** |
| **`lib/payroll/universal-payroll-engine.ts`** | 555 lignes de tests. Non utilisé, mais ne pas supprimer : c'est la cible de migration. |
| **`RefreshOrchestrator.tsx`** | Corrige le flash et la boucle infinie. Ne pas retirer `startTransition`. |
| **`lib/contexts/TenantContext.tsx`** | Un seul provider, garde anti-race (`activeUserIdRef`), cache TTL 5 min. Lit `tenant_modules` (bonne source). |
| **Le `.order('created_at').limit(1)` avant `maybeSingle()` sur `profiles`** | Correctif multi-tenant. Présent dans `proxy.ts:142`, `tenant-guard.ts`, `require-tenant.ts`. **Ne jamais retirer.** |
| **`requireApiKey()` (`lib/api/require-tenant.ts:130-180`)** | SHA-256, `is_active`, `expires_at`, `last_used_at`. Correctement implémenté. |
| **`skipWaiting()` / `clients.claim()` du SW** | Garantissent la mise à jour. |
| **Les 8 canaux Realtime filtrés par tenant** | Correctement nettoyés au démontage. Seul `notif-panel-v2` est à corriger. |
| **`app/api/paie/bulletins/route.ts:19-23`** | Le `service_role` y est correctement compensé par une validation explicite du `tenant_id`. C'est le bon patron à généraliser. |
| **Les 469 tests existants** | Tous passent. Base de non-régression. |

---

## 21. VOLUMÉTRIE RÉELLE DE LA PRODUCTION — recadrage indispensable (Mission 0.1)

✅ **VÉRIFIÉ EN PRODUCTION** — comptage exact des lignes des 329 tables/vues en `service_role`, ce jour.

| Mesure | Valeur |
|---|---:|
| Tables/vues contenant au moins une ligne | **58** |
| Tables/vues **vides** | **271** (82 %) |
| Tenants | **26** |
| **Profils utilisateurs (`profiles`)** | **2** |

### 21.1 Sur les 26 tenants, 18 sont des artefacts de test

```
 1. AMD FINANCE            | cabinet    | grande | suspended
 2. AMD FINANCE            | cabinet    | pme    | suspended
 3. CABINET MACK-G         | assurance  | grande | suspended
 4. AMD FINANCE            | ong        | grande | active
 5. LVA                    | ecole      | pme    | active
 6. TEST-C002-Business     | null       | pme    | active     ← test
 7. TEST-C002-Entrepreneur | null       | pme    | active     ← test
 8. C004-Compagnie         | commerce   | grande | active     ← test
 9. C004-Business          | commerce   | pme    | active     ← test
10. C004-Entrepreneur      | commerce   | tpe    | active     ← test
11. COCOPAIN               | commerce   | tpe    | active
12. MADIBA                 | restaurant | tpe    | active
13-25. QA001-*  (13 tenants)| null      | …      | active     ← test
26. ECAM                   | ecole      | grande | active
```

**18 tenants de test (`TEST-C002-*`, `C004-*`, `QA001-*`) sont `active` en base de production.** C'est la preuve matérielle d'ANO-P03 : les suites de certification s'exécutent contre la production et y laissent leurs fixtures. Six d'entre eux ont `secteur_activite = null`, ce qui alimente directement les branches « legacy » fail-open d'ANO-M04 et ANO-N18.

Quatre tenants sont `suspended`, dont les trois seuls comportant un volume comptable réel.

### 21.2 Ce que cela change dans la lecture de ce rapport

**À la hausse.** Les modules déclarés cassés (§8) le sont bien, mais leur absence de signalement s'explique aussi par l'absence d'usage : `clients` = 0 ligne, `devis` = 0, `crm_*` = 0, `stock_articles` = 0, `purchases` = 0. **Personne n'a encore heurté ces bugs en volume.** Ils sont donc devant vous, pas derrière.

**À la baisse.** Aucun des risques de fuite ou de corruption identifiés n'a, à ce jour, de matière à corrompre : la seule masse comptable réelle (`journal_entries` 1 319, `accounting_events` 771, `factures` 198, `bulletins_paie` 196) appartient à des tenants majoritairement suspendus. **Il n'y a pas d'incident client en cours.**

**La conclusion opérationnelle.** Oraforme n'est pas un produit en exploitation dégradée : c'est un produit **en pré-lancement**, avec un socle fonctionnel vaste et une couche de données qui n'a jamais été confrontée au volume. Le meilleur moment pour réparer est maintenant, précisément parce que le coût de la migration de données est aujourd'hui presque nul — 2 profils, 8 tenants réels. Dans six mois, avec 200 clients, ANO-C02 et ANO-C03 deviennent des reprises de données.

### 21.3 Question du second projet Supabase — TRANCHÉE (Mission 0.2)

La version précédente de ce rapport laissait ouverte l'hypothèse d'un second projet Supabase servant la vraie production. **Elle est écartée.**

✅ **VÉRIFIÉ — trois preuves concordantes, extraites du bundle JavaScript réellement servi par la production :**

1. **URL Supabase inlinée dans le bundle de `oraforme.vercel.app`** — j'ai téléchargé les 11 chunks référencés par `/login` et cherché l'URL :
```
bundle de production : https://mrzixapnaqsbqmagivvf.supabase.co
.env.local (audité)  : https://mrzixapnaqsbqmagivvf.supabase.co
                       → IDENTIQUE
```
2. **Clé anon identique** — comparaison par empreinte SHA-256 (valeurs non divulguées) : `f74bb1bbdacec6e4` des deux côtés.
3. **Payload JWT de la clé du bundle** :
```json
{"iss":"supabase","ref":"mrzixapnaqsbqmagivvf","role":"anon","iat":1777464264,"exp":2093040264}
```

**Il n'existe qu'un seul projet Supabase, et c'est celui que j'ai audité.** Aucun rejeu n'est nécessaire : tous les constats des Missions 0, 0.1 et 0.2 portent bien sur la production réelle.

**Ce qui reste à expliquer, et qui vous appartient :** 2 lignes dans `profiles` pour 26 tenants. Techniquement, la PWA installée fonctionne — le manifeste et le service worker sont servis aux utilisateurs **authentifiés** (§5.1). L'écart entre « installée et utilisée » et « 2 profils » ne relève pas d'une erreur de mesure de ma part : c'est l'état de la base. ⛔ Je ne conclus pas sur le nombre d'utilisateurs réels ; je constate le contenu de la table.

---

## 22. `supabaseAdmin` — CARTOGRAPHIE DE LA SURFACE service_role (Mission 0.1)

`lib/supabase-server.ts:6` exporte le singleton `supabaseAdmin`, client **`service_role`** : **la RLS ne s'applique jamais** à ses requêtes. L'isolation multi-tenant repose intégralement sur des `.eq('tenant_id', …)` écrits à la main.

| Mesure | Valeur |
|---|---:|
| `supabaseAdmin.from(...)` | **212** |
| `supabaseAdmin.rpc(...)` | **33** |
| `supabaseAdmin.storage` / `.auth` | **12** |
| `const db = supabaseAdmin as any` | **13 fichiers** |
| Clients `service_role` instanciés **hors du singleton** | **21 fichiers** |
| **Total de requêtes sans RLS** | **~257** |

### 22.1 Origine du `tenant_id` — le seul critère qui compte

Avec un client `service_role`, un `tenant_id` issu de la session est sûr ; un `tenant_id` issu du **body, de la query string ou du path** est une faille d'accès horizontal. Voici le classement, **avec le niveau d'exposition réellement mesuré en production** :

| Route | Origine du `tenant_id` | Auth exigée par le proxy ✅ VÉRIFIÉ EN PRODUCTION | Exposition réelle |
|---|---|---|---|
| `app/api/monitoring/log/route.ts:9,20` | **body client** | `POST → 400` (atteint le handler) → **AUCUNE** | 🔴 **Anonyme** — insertion de logs d'audit falsifiés |
| `app/api/miaa/notifications/route.ts:13` | **query string** | `GET → 200` → **AUCUNE** | 🔴 **Anonyme** — lecture + écriture cross-tenant |
| `app/api/jobs/chat/route.ts:10-13,19-21` | **body client** | `POST → 401` | 🟠 Compte authentifié requis → escalade **horizontale entre tenants** |
| `app/api/ocr/extract/route.ts:30,41-42` | **body client** dès que l'en-tête `x-internal: true` est présent — l.30 : `req.headers.get('x-internal') === 'true'`, **ce n'est pas un secret**, n'importe qui peut poser cet en-tête | `POST → 401` | 🟠 Compte authentifié requis → lecture/écriture des `documents` d'un autre tenant |
| `app/api/hotel/payments/route.ts:38,62,67` | `invoice_id` du **body**, `update` sans filtre tenant | `POST → 401` | 🟠 Compte authentifié requis → modification de factures d'un autre hôtel |
| `lib/workflow/actions.ts:189` | tenant OK, mais **nom de table dynamique** issu de `interpolateConfig(action.config, …)` | — | 🟠 insert `service_role` sur une table déterminée par la configuration |
| `app/api/automation/run/route.ts:24` | body, protégé par `x-automation-secret` | — | 🟡 dépend entièrement d'un secret d'environnement |

**Calibration importante :** l'audit automatisé classait 7 items en CRITIQUE. Après vérification du proxy en production, **2 seulement sont exploitables anonymement** (`monitoring/log`, `miaa/notifications` — déjà connus sous ANO-C01/C05). Les 5 autres exigent un compte valide : ce sont des **escalades horizontales entre tenants authentifiés**, gravité MAJEURE. Je ne les classe pas en critique.

### 22.2 Les 13 `const db = supabaseAdmin as any`

Le cast supprime le générique `Database` du client, donc : validation du nom de table, validation des colonnes, validation des payloads d'écriture, et typage du retour.

`comptabilite/balance:15` · `comptabilite/grand-livre:20` · `miaa/compliance:27` · `miaa/document-context:18` · `ocr/extract:23` · `storage/config:12` · `storage/presign:61` · `storage/[id]:34` · `whatsapp/config:11` · `whatsapp/webhook:14` · `lib/storage/storage-provider.ts:86` · `lib/storage/storage-service.ts:14` · `lib/whatsapp-business.ts:106`.

**Le cas n°2 est la démonstration du coût réel de ce patron** : il masque activement les colonnes inexistantes `reference` et `journal_type`, ce qui rend le grand livre inopérant sans qu'aucun outil ne puisse le signaler (ANO-C09).

À noter également `lib/db.ts:29,45,61` : `supabase.from(table) as any` avec `table: string` — nom de table arbitraire, insert/update/delete non typés, sur le client **anon**. Ce module est par ailleurs mort (0 importeur, ANO-M29).

### 22.3 Dérive de schéma élargie — 19 tables inexistantes

L'audit `supabaseAdmin` porte le décompte de 9 (§ANO-M16) à **19 tables référencées et absentes de la production** :
`facture_lignes` · `contrats` (réelle : `rh_contrats`) · `contrats_employes` · `error_logs` · `auth_logs` · `policy_history` · `policy_violations` · `primes_employe` · `avantages_nature_employe` · `postes` · `recrutements` · `articles` (réelle : `stock_articles`) · `chambres` (réelle : `htl_rooms`) · `reservations` (réelle : `htl_reservations`) · `commandes_resto` (réelle : `resto_commandes`) · `resto_reservations` · `resto_formules` · `resto_formule_items` · `ged_documents` (réelle : `documents`).

**7 d'entre elles sont écrites sans contrôle du résultat** → perte de données silencieuse : `facture_lignes:87` (la facture est créée sans ses lignes), `primes_employe:174` et `avantages_nature_employe:189` (l'employé est créé sans ses primes ni ses avantages), `declarations_cnss_lignes:141`, `auth_logs:36`, `policy_history:35`, `error_logs:20` (**aucune trace d'audit d'authentification n'est écrite — cohérent avec le constat §3.4 que les migrations 157/158 ne sont pas appliquées**).

### 22.4 Zone non couverte

⛔ **20 fichiers `app/api/miaa/**` et `app/api/portail/**` instancient leur propre client `service_role` hors du singleton.** L'origine de leur `tenant_id` n'a pas été tracée fichier par fichier. C'est la principale zone d'ombre restante de cet audit sur la surface service_role.

---

## 23. FISCALITÉ — RECENSEMENT DES RÈGLES NON FIABLES (Mission 0.1)

Le détail complet figure en ANO-C10. Synthèse structurelle.

### 23.1 Quatre générations de barèmes coexistent

| Génération | Fichiers | Qui les consomme |
|---|---|---|
| **A** | `lib/fiscalite-{congo,cameroun,gabon,rca,rdc,tchad,guinee-equatoriale}.ts` | Facturation (`calculerTVACongo`, 6 modules dont `FacturePDF.tsx`), MIAA |
| **B** | `lib/countries/{CG,CM,GA,CD,CF,TD,GQ}.ts` | `universal-tax-engine` → écran Paie |
| **C** | `lib/fiscalite/pays.ts` + `engine.ts` | API TVA/CNSS, `PaysContext` |
| **D** | `lib/paie/calcul-paie.ts`, `lib/fiscal/congo-calculs.ts`, `lib/declarations/**` | **Les déclarations officielles CNSS / DGI / Patente** |

Elles ne se réconcilient jamais. **C'est la génération D — la moins alignée — qui produit les documents administratifs.**

### 23.2 Règles pouvant produire une déclaration officielle fausse — classement par risque

| # | Règle | Fichier:ligne | Statut | Document produit |
|---:|---|---|---|---|
| 1 | **TUS 4,5 %** (taxe abrogée LF 2026) | `declarations/declaration-generale.ts:70` | **OBSOLÈTE — le dépôt le dit lui-même 3×** | Déclaration Générale DGI, ligne 9, surlignée |
| 2 | **Plafond AF 600 000** (vs 1 200 000) | `declarations/cnss-congo.ts:13,97` | **OBSOLÈTE** — 4 fichiers disent 1,2 M | Déclaration CNSS PDF + Excel |
| 3 | **Taux CNSS imprimés 5,04 % / 14,36 %** | `api/fiscalite/cnss/pdf/route.ts:157,169,170` | **NON SOURCÉ** — les moteurs appliquent 4 % | Déclaration CNSS mensuelle |
| 4 | **Barème Patente** — 10 tranches, min 10 000 F | `declarations/patente.ts:7-20` vs `fiscalite-congo.ts:178-190` (8 tranches, min 97 500 F) | **CONTRADICTOIRE ×13,5** | Déclaration de Patente |
| 5 | **IRPP Congo** — barème mensuel direct vs ÷12 | `paie/calcul-paie.ts:33-39` vs `fiscal/congo-calculs.ts:99-124` | **CONTRADICTOIRE ≈×50** (900 000 F brut → 4 000 F vs 200 213 F) | Déclaration IRPP DGI |
| 6 | **TVA Gabon 18 % / Tchad 18 %** | `fiscalite-gabon.ts:33`, `fiscalite-tchad.ts:30` | **ESTIMÉ — aveu littéral** « TODO: confirmer — estimé par cohérence CEMAC » ; **réénoncé sans avertissement** dans `countries/GA.ts:44` avec une source d'apparence officielle | Déclaration TVA |
| 7 | **CNSS des 6 pays non-CG** | `api/fiscalite/cnss/route.ts:48-50` | Recalcule sur des taux « pays.ts (estimé) » **sans jamais lire `support_declarations_cnss`**, alors que `TD.ts:172`, `CF.ts:170`, `GQ.ts:170` le mettent à `false` | Déclaration CNSS |
| 8 | **IPR RDC** — 5 tranches / 30 % | `fiscalite/pays.ts:88-94` | **OBSOLÈTE** — `fiscalite-rdc.ts:213` écrit « ⚠️ **NE PAS utiliser** » | Simulateur IRPP |
| 9 | Barèmes IRPP/ITS de GA, TD, CF, GQ | `GA.ts:98`, `TD.ts:88`, `CF.ts:88`, `GQ.ts:88` | **ESTIMÉ auto-référencé** (« source : pays.ts ») | Bulletins → déclarations |
| 10 | **IS RCA** — nature d'impôt divergente | `countries/CF.ts:48` (30 % du bénéfice) vs `fiscalite-rca.ts:21-25` (1,85 % du **CA**) | **CONTRADICTOIRE** — deux impôts différents | Liasse RCA |
| 11 | TVA Cameroun 19,25 % | `fiscalite-cameroun.ts:25` (« 17,25 % + CAC 10 % » — arithmétiquement faux) vs `CM.ts:46` (« 17,5 % ») | **CONTRADICTOIRE** — justification fausse en cas de contrôle | Déclaration TVA |
| 12 | **Contrat de travail — CNSS 5,04 %** | `components/rh/ContratPDF.tsx:87,240` | **NON SOURCÉ** | Document contractuel opposable remis au salarié |

### 23.3 Défauts transverses

- **Repli silencieux sur le Congo** — `countries/index.ts:59-64` et `fiscalite/pays.ts:702` renvoient la config **CG** pour ML, SN, BF, NE, NG, AO, FR, BE, CH. Aucun avertissement.
- **Barème annuel appliqué à une base mensuelle** — `fiscalite/engine.ts:119-130` et `PaysContext.tsx:24-33` : sous-taxation d'un facteur ≈12 pour CM, GA, TD, CF, GQ, CD.
- **Millésimes périmés** — `fiscalite-{gabon,tchad,rca}.ts` : `LAST_UPDATE = '2023-11'` (34 mois) ; SMIG RDC issu d'une « révision **2018** » ; `declarations/branding.ts:12` estampille tous les PDF officiels `version: '2024'`.
- **MIAA enseigne les taux faux** — `lib/miaa/tools.ts:46,57,66` (5,04 % / 14,36 % / plafond 1,5 M) est injecté dans le contexte de l'assistant IA, et `app/dashboard/academy/page.tsx:119,121` les présente comme **la bonne réponse** dans le quiz de formation.

### 23.4 Le couple « 5,04 % / 14,36 % » s'est propagé dans 14 fichiers, dont 3 documents opposables

✅ **VÉRIFIÉ (Mission 0.2)** — recherche exhaustive sur `5,04`, `5.04`, `14,36`, `14.36`. Aucun moteur de calcul n'applique ces taux (tous appliquent 4 %) ; ils n'existent que dans du **texte affiché** — ce qui est plus grave, car c'est ce texte que lit l'utilisateur et l'administration :

| Fichier:ligne | Nature | Opposable ? |
|---|---|---|
| `app/api/fiscalite/cnss/pdf/route.ts:157,169,170` | **Déclaration CNSS mensuelle** | **OUI — administration** |
| `components/rh/ContratPDF.tsx:240` | **Contrat de travail** | **OUI — salarié** |
| `app/dashboard/rh/contrats/page.tsx:644,948` | Écran contrat, applique `× 0.0504` | **OUI** |
| `app/dashboard/comptabilite/annexes/page.tsx:283` | Annexes aux états financiers — et annonce **14,16 %** (5ᵉ valeur) | **OUI — expert-comptable** |
| `lib/miaa/tools.ts:66,71` · `experts.ts:59,70,75,79` · `miaa-prompt.ts:41,42` · `miaa-agents.ts:482` · `pays-localization.ts:36,37,41` | Contexte injecté dans l'assistant IA | Conseil rendu au client |
| `app/dashboard/academy/page.tsx:52,119,121` · `components/miaa/MIAAAssistant.tsx:147,148,310,312` | **Quiz de formation — réponse marquée correcte** | Formation |
| `lib/textes-fiscaux.ts:47` | « 5.04 %, patronal **14,16 %**, plafond **3 375 000** » | (fichier mort) |

**Quatre plafonds CNSS concurrents** cohabitent : `600 000` (`cnss-congo.ts:13`), `1 200 000` (`CG.ts`, `calcul-paie.ts`, `congo-calculs.ts`, `fiscalite-congo.ts:149`), `1 500 000` (`lib/miaa/experts.ts:59`), `3 375 000` (`lib/miaa-prompt.ts:41`, `lib/textes-fiscaux.ts:47`).
**Cinq taux patronaux concurrents** : 14,16 % · 14,36 % · 20,285 % · 20,29 % · 23,285 %.

---

## 24. SENTRY — RECTIFICATION D'UNE CONCLUSION ERRONÉE (Mission 0.1)

🔻 **Je me suis trompé, et la correction va dans le sens rassurant.**

Dans la version précédente de ce rapport, ANO-M26 affirmait que « les écrans `/dashboard/rh/paie` sont rejoués **en clair** vers un tiers ». **C'est faux.**

### 24.1 Preuve : le SDK Sentry n'est jamais initialisé

✅ **VÉRIFIÉ — 5 éléments indépendants et convergents :**

1. **Aucun point d'entrée d'instrumentation.** `find . -maxdepth 3 -name "instrumentation*"` hors `node_modules` → **0 résultat**. Pas de `src/`, pas de `app/global-error.tsx`.
2. **Turbopack ne charge que `instrumentation*`.** `next.config.ts:23` déclare `turbopack: {}` et Next.js 16 l'utilise par défaut. Les règles d'injection du SDK (`@sentry/nextjs@10.58.0`, `config/turbopack/generateValueInjectionRules.js`) ne matchent que :
   ```
   instrumentation-client.*
   instrumentation.*
   ```
   **`sentry.client.config.ts` n'y figure pas** — il n'est traité que par le chemin webpack, non emprunté ici.
3. **Le SDK n'importe jamais les configs serveur/edge.** `grep -c "sentry.server.config\|sentry.edge.config" node_modules/@sentry/nextjs/build/cjs/config/webpack.js` → **0**. Elles doivent être importées à la main depuis `instrumentation.ts`, qui n'existe pas.
4. **Aucun hook d'erreur serveur.** `grep -rn "onRequestError\|captureRequestError" app lib` → **0**.
5. **Le token d'upload est un placeholder.** `.env.local:13` → `SENTRY_AUTH_TOKEN=REMPLACER_PAR_TON_AUTH_TOKEN`, et `next.config.ts:31` (`silent: !process.env.CI`) masque l'échec.

**Conclusion : aujourd'hui, aucune donnée ne quitte l'application via Sentry.** Les avertissements Sentry visibles au démarrage du serveur proviennent de `withSentryConfig` traitant `next.config.ts` **au build** — pas d'une initialisation du SDK au runtime.

### 24.2 Ce qui reste vrai : un piège armé

La configuration est en place et dangereuse **si quelqu'un la branche**. Il suffit d'ajouter un `instrumentation-client.ts` ou de repasser en build webpack pour que s'activent simultanément :
`replaysOnErrorSampleRate: 1.0` (`sentry.client.config.ts:11`) + `maskAllText: false` (l.15) + `blockAllMedia: false` (l.16), **sans aucun `beforeSend`, `beforeSendTransaction` ni `beforeBreadcrumb`** (absents du dépôt).

Partiraient alors en clair, rendu DOM vérifié :

| Donnée | Fichier:ligne |
|---|---|
| Salaire net, bulletin complet, matricule CNSS | `rh/paie/page.tsx:271,299,807,876,1189,1851` |
| **Groupe sanguin, antécédents médicaux, diagnostics** | `sante/patients/[id]/page.tsx:130,141,205,265` |
| IBAN/RIB et soldes bancaires | `tresorerie/banques/page.tsx:341,344,500` |
| NIU / RCCM des tiers | `comptabilite/tiers/page.tsx:303` |
| **Jetons de session en query string** (breadcrumb `http`) | `portail/candidat/page.tsx:373`, `portail/client/page.tsx:171,186`, `lib/cabinet/switch-context.tsx:74` |

Point positif non délibéré : `sendDefaultPii` est absent des trois configs, donc `false` par défaut — ni IP, ni cookies, ni headers. Et `maskAllInputs` vaut `true` par défaut : la frappe clavier serait masquée, c'est le **texte affiché** qui ne le serait pas.

### 24.3 Défaut de conformité, lui bien réel

`app/legal/privacy/page.tsx:54` énumère les sous-traitants : « Supabase, Anthropic pour MIAA+, Vercel pour l'hébergement ». **Sentry / Functional Software Inc. n'y figure pas**, et aucune des trois pages légales (`privacy`, `cgu`, `cookies`) ne mentionne l'enregistrement de session. L'écart est aujourd'hui documentaire ; il deviendrait un manquement le jour où le SDK serait activé.

### 24.4 Vecteur voisin, celui-ci actif

`lib/monitoring.ts:59-72` envoie **réellement**, depuis le navigateur en production, tout log `error`/`critical` — `tenant_id`, `user_id` et un champ `data` arbitraire — vers `POST /api/monitoring/log`. Cette route est **anonyme** (§22.1) et insère dans `error_logs`, table qui **n'existe pas en production** (§22.3). Le flux part, échoue silencieusement, et n'est tracé nulle part.

### 24.5 Ordre de traitement

1. **Avant tout branchement** : `maskAllText: true`, `blockAllMedia: true`, et ajouter `beforeSend`/`beforeBreadcrumb`. Sinon toute correction du câblage devient une fuite immédiate.
2. Sortir les jetons des query strings — vaut indépendamment de Sentry : ils atterrissent déjà dans les logs d'accès Vercel et l'en-tête `Referer`.
3. Supprimer `app/sentry-example-page/` (routable publiquement, `proxy.ts:14`).
4. **Décider** : finir le câblage, ou retirer `@sentry/nextjs` et les 3 configs. L'état actuel — configuration présente, non fonctionnelle, non documentée — est le pire des trois.

---

## 25. TAUX D'UTILISATION RÉELLE DES 8 CORES (Mission 0.1)

Méthode : pour chaque symbole exporté, grep nominatif sur `app/`, `components/`, `lib/`, `tests/`, `scripts/`, `types/`, `proxy.ts`, en excluant le fichier de définition et `.claude/worktrees/`. « En production » = atteignable depuis une page ou une route API **réellement appelée**.

| Core | Exports | Morts | Test-only | En prod | **Utilisation réelle** | Lignes mortes |
|---|---:|---:|---:|---:|---:|---:|
| **Analytics** | 27 | 5 | 0 | 22 | **81,5 %** | ~15 / 327 |
| **Tenant** | 20 | 10 | 0 | 10 | **50,0 %** | ~60 / 672 |
| **Accounting** | 58 | 33 | 0 | 25 | **43,1 %** | ~430 / 1 503 |
| **Reporting** | 31 | 14 | 0 | 13 | **41,9 %** | ~330 / 1 248 |
| **Fiscal** | 79 | 44 | 11 | 24 | **30,4 %** | ~700 / 2 304 |
| **ERP Core** | 89 | 68 | 0 | 12 | **13,5 %** | ~780 / 1 572 |
| **Payroll** | 107 | 85 | 18 | 4 | **3,7 %** | ~2 830 / 3 034 |
| **Inventory** | 5 | 5 | 0 | 0 | **0,0 %** | 64 / 64 |
| **TOTAL** | **416** | **264 (63 %)** | **29 (7 %)** | **110 (26 %)** | **26 %** | **≈ 5 200 lignes** |

### 25.1 Les trois Cores qui portent le discours sont les trois moins exécutés

**ERP Core — 13,5 %.** `lib/erp-core/index.ts:5` proclame « Toutes les pages consomment ici ». **Aucune page n'importe l'ERP Core** : seules 9 routes API le font. Quatre fichiers de calcul sont intégralement morts : `compute/clients.ts`, `compute/ebitda.ts`, `compute/stock.ts`, `compute/tresorerie.ts`. Les calculs centralisés de trésorerie, EBITDA, stock et créances clients ne sont appelés par personne.

**Payroll — 3,7 %.** `lib/conventions/**` (1 677 l., ~45 exports) : **0 importeur applicatif**. `lib/payroll/universal-payroll-engine.ts` (1 090 l.) : son unique consommateur non-test est `convention-engine.ts`, **lui-même mort** — le moteur de paie universel est donc **inatteignable en production**. Il est pourtant couvert par 555 lignes de tests. Seul `lib/paie/calcul-paie.ts` survit, avec 4 exports sur 22.

**Inventory — 0 %.** Il n'existe aucun Core inventaire. `compute/stock.ts` (64 l.) est mort intégralement.

### 25.2 Découverte aggravante : 5 routes API consommant l'ERP Core ne sont jamais appelées

| Route | Appelée ? |
|---|---|
| `api/comptabilite/balance` | **NON** — 0 `fetch` dans le dépôt |
| `api/comptabilite/grand-livre` | **NON** — 0 `fetch` |
| `api/fiscalite/irpp` | **NON** — la page appelle `/api/fiscalite/cnss` |
| `api/hotel/payments` | **NON** |
| `api/agents/commercial/analyse` | **NON** |

Combiné à ANO-C09 (balance et grand-livre sont **cassées** en production) : les routes conformes sont à la fois **mortes et défectueuses**.

### 25.3 Autres modules morts confirmés

`lib/fiscal/congo-calculs.ts` (300 l., 10 exports, 0 importeur) — pourtant désigné « source de vérité CG » par `countries/CG.ts:221` et par les tests · `genererBilan` de `syscohada/etats-financiers.ts` (104 l.) alors que `comptabilite/bilan/page.tsx` recalcule localement · `auditSYSCOHADA` (160 l.) · `createJournalEntry`, `resolveOhadaAccounts`, `TVA_RATE`/`CA_RATE`/`calcTVA` d'`accounting-engine.ts` — **ces derniers étant réimplémentés localement** dans `comptabilite/tva/page.tsx:28-29` et `comptabilite/page.tsx:43`.

**La cause structurelle est identique dans les 8 Cores : la logique a été centralisée dans `lib/`, mais les pages n'ont jamais été migrées.** Elles interrogent Supabase directement et redéfinissent localement types, taux et calculs. Le Core existe, il est testé, il n'est pas branché.

---

## 26. TESTS D'ARCHITECTURE — AUCUNE LOI N'OBTIENT « PASS » (Mission 0.2)

### 26.1 Le fait liminaire : les lois ne sont appliquées nulle part

✅ **VÉRIFIÉ.** Trois constats qui se contredisent entre eux :

```
npx vitest run lib/architecture   →  6 fichiers, 24 tests, 24 PASSED
npx eslint .                      →  11 ERREURS  (LOI-L ×8, LOI-M ×2, LOI-N ×1) + 9 warnings
.github/workflows/                →  semgrep.yml UNIQUEMENT — aucun job npm test, aucun job lint
```

Chaque test se présente pourtant comme un garde-fou CI — `loi-k-unique-writer.test.ts:7` : *« Ce test CI échoue si un développeur ajoute… »*. **Ce mécanisme n'existe pas.** `npm run lint` sort déjà en code non-zéro et rien ne l'exécute.

**5 des 24 tests verts ne contiennent aucune assertion** — uniquement des `console.warn` : `loi-m:165`, `loi-n:195`, `loi-o:183`, `loi-o:212`, plus `loi-k:209` dont l'assertion est `expect(unexpected.length).toBeLessThanOrEqual(5)` — cinq émetteurs non déclarés sont tolérés silencieusement. Ces tests gonflent le compteur sans porter de garantie.

### 26.2 Verdicts

| Loi | Verdict | Angle mort décisif |
|---|---|---|
| **LOI-K** — Unique Writer | **PARTIAL** | `journal_comptable` — **seconde table comptable écrite en direct** depuis 3 fichiers UI — n'est dans aucun pattern. Les 4 écritures `journal_entries` existantes sont **toutes exemptées** : le test ne prouve rien sur l'existant. |
| **LOI-L** — Fiscal Calculator | **FAIL — TEST NON PROBANT** | Le taux réellement utilisé (`0.189` / `1.189`) est invisible : `0\.18\b` bute sur le `9`, et les **divisions** ne sont pas couvertes. 6 routes API le codent en dur. `0.1925` (Cameroun) n'est dans aucun pattern. |
| **LOI-M** — Tenant Creator | **FAIL — TEST NON PROBANT** | 3 écritures `tenants` réelles, vertes **par simple retour à la ligne**. |
| **LOI-N** — Permission Engine | **FAIL — TEST NON PROBANT** | Le pattern est indexé sur deux noms de variables (`profile`, `tenantProfile`). Le composant qui porte le contrôle d'accès — `Sidebar.tsx` — prend **7 décisions sur `role` brut**, dont une seule vue par ESLint et **aucune** par le test. |
| **LOI-O** — Realtime Manager | **PARTIAL** | La plus solide (scan du contenu entier, inventaire exact des 9 canaux). Mais `lib/**` hors glob, allowlist **par fichier** (prolifération libre), et règle ESLint en `warn`. |
| **F-003** — Cache Read Forbidden | **PARTIAL** | `modules_actifs` réellement tenu (confirmé indépendamment : 0 erreur `no-restricted-syntax`). Mais le pattern `cache_*`/`legacy_*` exige `.from()` et `.select()` **sur la même ligne** → inatteignable ; et `snapshot_*`, annoncé en en-tête `:5-6`, **n'est jamais implémenté**.

**Aucune loi n'obtient PASS.**

### 26.3 Preuve par contraste — vérifiée personnellement

J'ai fait tourner ESLint sur les fichiers en défaut et sur des témoins :

```
# Fichiers qui VIOLENT une loi mais passent au vert :
app/api/profil/reminders/route.ts    (supabaseAdmin.from('tenants').update, l.124-127)  → 0 erreur
components/dashboard/Header.tsx      (tenant?.role === 'owner', l.34)                   → 0 erreur
app/dashboard/ecole/comptabilite/page.tsx (from('journal_comptable').insert, l.83)      → 0 erreur

# TÉMOINS — la règle fonctionne bien quand la forme correspond :
app/dashboard/profil/actions.ts:115  → error [LOI-M] Écriture directe dans tenants interdite
app/dashboard/profil/page.tsx:88     → error [LOI-M] Écriture directe dans tenants interdite
```

Les trois causes exactes :
1. **`app/api/**` n'est pas dans le périmètre de la LOI-M** (`eslint.config.mjs:271-274` ne liste que `app/dashboard/**` et `components/dashboard/**`) — une écriture `tenants` en `service_role` depuis une route API échappe aux **deux** mécanismes.
2. **L'optional chaining désarme la LOI-N** : avec `tenant?.role`, l'opérande gauche devient une `ChainExpression` et non une `MemberExpression`, ce que le garde `eslint.config.mjs:161` exige. **Un simple `?` suffit à rendre une violation invisible.**
3. **`journal_comptable` n'existe dans aucun pattern de la LOI-K.**

### 26.4 Les deux défauts structurels

**(a) Le scan ligne par ligne.** Quatre lois sur six (K, L, M, N et F-003) utilisent `lines.forEach` avec des regex exigeant l'adjacence sur une même ligne — alors que **le style dominant du dépôt chaîne les appels Supabase sur plusieurs lignes**. Ce n'est pas une hypothèse : c'est exactement ce qui rend la LOI-M verte malgré trois violations avérées.

**(b) Le blanchiment au fichier entier.** `KNOWN_FISCAL_DEBT` blanchit `app/dashboard/finance/page.tsx` **en totalité** (1000+ lignes) : ce fichier peut désormais contenir n'importe quel calcul fiscal inline sans rien déclencher. Idem `KNOWN_TENANT_DEBT` pour `groupe/gestion/page.tsx`.

### 26.5 Tableau des exemptions

| ID | Fichier blanchi | Violation réelle masquée | ADR | Risque |
|---|---|---|---|---|
| EXM-JE-001 | `app/dashboard/comptabilite/**` | `page.tsx:231`, `journal/page.tsx:135` — insert direct `journal_entries` | aucun | ÉLEVÉ |
| EXM-JE-002 | `lib/accounting-engine.ts` | `:289` insert direct | aucun | FAIBLE (0 appelant) |
| EXM-JE-003 | `lib/compta-sync-client.ts` | `:157` insert direct — **14 pages appelantes** | aucun | **TRÈS ÉLEVÉ** |
| DET-L-001/002/003 | `cabinet/.../factures/route.ts`, `dashboard/cabinet/.../page.tsx`, `dashboard/finance/page.tsx` | 5 calculs `ht * 0.18` | aucun | ÉLEVÉ (fiscal) |
| exemption `lib/miaa` | tout `lib/miaa/**` | `tools.ts:12-29` — **calculateur TVA concurrent complet** (4 taux) | aucun | ÉLEVÉ |
| exemption `components/onboarding/**` | tout l'arbre | motivée par un seul `delay: i * 0.18` (animation) | aucun | MOYEN |
| DET-M-001 | `groupe/gestion/page.tsx` | `:164`, `:169`, `:193` — écritures `tenants` client | aucun | ÉLEVÉ |
| DET-N-001/002/003 | `dashboard/page.tsx`, `ecole/espace-{etudiant,parent}` | comparaisons de rôle brutes | aucun | MOYEN |
| DET-O-001→009 | 9 fichiers Realtime | allowlist **par fichier**, pas par canal | aucun | MOYEN |

**Aucune exemption ne porte de date, de numéro d'ADR ni d'échéance de résorption.** Ce sont des dettes permanentes déguisées en décisions.

---

## 27. CLASSIFICATION FINALE P0 / P1 / P2 / P3

### P0 — À réparer immédiatement

| ID | Anomalie | Preuve | Cause racine | Impact | Dépendance |
|---|---|---|---|---|---|
| **ANO-C10** | Déclarations fiscales fausses : TUS abrogée liquidée à 4,5 %, AF sous-plafonnée (−60 240 F/salarié/mois), taux CNSS imprimés ≠ appliqués | `declaration-generale.ts:70` · `cnss-congo.ts:13,97-99` · `cnss/pdf/route.ts:157` | 4 générations de barèmes, génération D non alignée | Documents opposables DGI/CNSS | Décision métier (quel barème fait foi) |
| **ANO-C01** | 10 endpoints d'automatisation anonymes, dont un qui **écrit** sur tous les tenants restaurant | `proxy.ts:30-46` + 9 routes sans secret · **vérifié : 200 sans auth** | Commit `81e9302` a ouvert le bypass sur une hypothèse fausse | Déclenchement de traitements par un tiers | aucune |
| **ANO-C02** | `facture_lignes` inexistante (404) ; `factures` n'a pas 9 des colonnes insérées | HTTP 404 + 400 vérifiés | CR-1 | Lignes de facture perdues, PDF sans détail | Décision 0.4 |
| **ANO-C03** | `products.stock_actuel` inexistante (400) | HTTP 400 vérifié | CR-1 | Module Stocks inopérant | Décision 0.5 |
| **ANO-C08** | 336 événements comptables (43,6 %) en `error`, reprise à l'arrêt, **240 sans message** | comptage production | Double écriture + moteur silencieux | Chaîne comptable non fiable | ANO-M10 |
| **§6.2** | Paie → comptabilité rompue : `/api/paie/bulletins` n'émet rien, `/api/rh/paie` a 0 appelant | code vérifié | Migration 141 a supprimé le trigger sans brancher la route | Aucune écriture comptable de paie | aucune |
| **ANO-C04** | Escalade de privilège `profiles.role` (`WITH CHECK` incomplet) | `039:44-47` + 3 greps négatifs | Policy incomplète | Total si exploitable | ⛔ à tester en recette |
| **ANO-M01** | Aucun CI — et `next.config.ts:10` s'y réfère pour justifier `ignoreBuildErrors` | `git ls-tree origin/main` vide | — | Rien ne protège les corrections à venir | **bloque tout le reste** |

### P1 — Ensuite

ANO-C05 · ANO-C06 · ANO-C07 · ANO-C09 (réparer la cible avant migration) · ANO-M03/M04 (Business obtient N3, `taille=null` fail-open) · ANO-M16/M17/M19 (19 tables + 6 colonnes fantômes) · ANO-M05 (aucune validation d'entrée) · ANO-M06 (aucun header de sécurité) · ANO-M08 (23 calculateurs fiscaux, 2 taux TVA) · ANO-M09 (11 erreurs ESLint) · ANO-M10/M11 (double écriture, `tva:0` forcé) · **§26 (les 6 lois d'architecture, dont 3 en FAIL)** · ANO-P01 (DNS `oraforme.com`) · ANO-P02 (manifest/SW/robots redirigés) · ANO-P03 (aucune recette) · ANO-P04 (fichiers non versionnés) · les 5 escalades horizontales de §22.1.

### P2 — Dette

ANO-M13 (webhooks n'émettent rien) · ANO-M14 (facturation SaaS n'écrit rien) · ANO-M21 (72 routes sur un guard `@deprecated`) · ANO-M23/M24 (Grandfather Policy inexistante, `capability_level` jeté) · ANO-M29/M30 (≈5 200 lignes mortes, 63 % des exports des Cores) · ANO-M31→M36 · DT-1 à DT-20 · §5.3/§5.4 (cache SW, mode hors ligne mensonger) · ANO-M26 (neutraliser la config Sentry **avant** tout branchement).

### P3 — Amélioration

Retrait des 9 pages de démonstration · ANO-N01→N21 · unification des 14 formateurs monétaires · suppression des 18 tenants de test en production · recalcul honnête de l'AHI/BCI · `docs/MIGRATION-MAP-AZ.md` phases 5-6.

---

## ANNEXE — RÉPONSES DIRECTES AUX QUESTIONS A→H

**A. Anomalies critiques à réparer immédiatement**
ANO-C01 (10 endpoints anonymes) · ANO-C02 (`facture_lignes`) · ANO-C03 (`products.stock_actuel`) · ANO-C04 (escalade RLS) · ANO-C05 et C06 (IDOR) · **ANO-C07 (`/api/debug/db-check` écrit en production)**.

**B. Anomalies majeures** — ANO-M01 à M36 (§9).

**C. Anomalies normales** — ANO-N01 à N21 (§9).

**D. Dettes techniques** — DT-1 à DT-20 (§11).

**E. Contradictions architecture ↔ code**
CONSTITUTION PARTIE VI (« aucun écran ne recalcule ») vs 135 pages qui agrègent et 3 qui recalculent le stock · « Sources de vérité multiples interdites » vs 4 registres comptables, 5 référentiels clients, 4 sources d'entitlement, 23 calculateurs fiscaux, 14 formateurs monétaires, 4 générations de modules fiscaux · Les LOI-K/L/M/N existent mais **exemptent explicitement les dettes qu'elles visent** — les tests passent en vert grâce aux listes blanches · `lib/erp-core/index.ts:5` proclame « Toutes les pages consomment ici » alors qu'il a **0 importeur** et que 4 de ses modules de calcul financier sont morts · `dispatchWebhookEvent` et les 2 routes ERP Core comptables n'ont aucun appelant · `app/dashboard/layout.tsx:12` désigne un « middleware.ts » qui n'existe pas.

**F. Contradictions code ↔ base de données**
9 tables inexistantes appelées par des routes API ✅ · 31 tables inexistantes appelées par des pages ⚠️ · 6 colonnes fantômes sur `tenants` ✅ · `products.stock_actuel`, `factures.invoice_number`/`due_date`/`date`/`ca`, `transactions.amount`, `notifications.body`/`href`, `stock_movements.quantity`, `purchases.total_amount` ✅ · Migrations 157/158/159 jamais exécutées ✅ · Migration 155 partiellement appliquée ✅ · `accounting_fiscal_params` peuplée (14 lignes) mais jamais lue ✅.

**G. Contradictions production ↔ dépôt**
`oraforme.com` ne résout pas alors que le produit est annoncé dessus ✅ · Aucun workflow CI sur `origin/main` alors que `next.config.ts:10` s'y réfère ✅ · `.github/`, `playwright.config.ts`, `tests/e2e/` et `@playwright/test` absents du dépôt ✅ · 18 objets de production sans migration · 86 objets de migration absents de production · `PROJECT_HEALTH.md` (AHI 82, BCI 90, 0 régression) non reproductible.

**H. Ordre exact des réparations** — §19 : Phase 0 (débloquer et décider) → Phase 1 (P0 sécurité et données) → Phase 2 (P1 cohérence + CI) → Phase 3 (P2 production et PWA) → Phase 4 (P3 dette).

---

*Fin du rapport. Aucun code n'a été modifié. Aucune migration n'a été créée. Aucun commit, aucun déploiement.*

# R-006 / ANO-P03 — Environnement de recette isolé (diagnostic + plan, non implémenté)

Mission de diagnostic et de conception. Aucune donnée touchée, aucune migration modifiée, aucun
compte/projet créé, aucun déploiement effectué — conformément à l'instruction explicite.

---

## A — Environnement actuel disponible

**Aucun environnement de recette isolé n'existe.** Constaté, pas supposé :

- Un seul projet Supabase (`mrzixapnaqsbqmagivvf`, plan **FREE**), référencé par `NEXT_PUBLIC_SUPABASE_URL`
  dans `.env.local`, `.env.example`, et lu identiquement par `proxy.ts:73`, `lib/supabase.ts:14`,
  `lib/supabase-server.ts:3` — **aucune logique de détection d'environnement** dans le code (pas
  de branchement selon `VERCEL_ENV`/`NODE_ENV` pour choisir une URL différente).
- Un seul projet Vercel (`oraforme`, `.vercel/project.json`).
- Aucun script `supabase db push`/`db reset` dans `package.json` — la CLI Supabase n'est utilisée
  nulle part dans l'outillage versionné.
- Aucun `supabase/config.toml` — pas de configuration de projet local/Branching.
- `.github/workflows/` ne contient que `ci.yml` (typecheck/lint/vitest/build, avec des variables
  Supabase **placeholder** explicitement commentées « le build ne doit joindre aucun service ») et
  `semgrep.yml` — **aucun workflow de déploiement, aucun qui touche une vraie base Postgres**.
- Aucune branche `staging`/`recette` dans le dépôt (local ou distant).
- **Point favorable** : les Cron Jobs Vercel (`vercel.json`) ne se déclenchent, par comportement
  de la plateforme, que sur les déploiements **Production** — pas sur les Preview Deployments. Ça
  réduit un risque (crons de recette qui toucheraient la prod) sans le supprimer (une DB Supabase
  mal scopée en Preview resterait un risque plein, indépendant des crons).
- Aucune migration SQL de seed/démo (confirmé, `ls supabase/migrations | grep -i seed|demo|test`
  → seule `179_purge_seed_demo_amd_finance.sql`, qui **supprime** des données, n'en insère pas) —
  un rejeu propre des migrations n'insérerait aucune fausse donnée métier, seulement des données
  de configuration légitimes (plan comptable, règles SYSCOHADA, catalogue de cours).

---

## B — Architecture recette proposée (non implémentée)

**Option recommandée (compatible avec le plan Free actuel)** :
1. Un second projet Supabase dédié (« oraforme-recette »), créé manuellement dans le dashboard
   Supabase — le plan Free suffit, pas besoin de payer.
2. Les migrations `supabase/migrations/*.sql` rejouées contre ce projet (une fois les blocages du
   §D corrigés).
3. Les Preview Deployments Vercel (déjà automatiques sur chaque PR par la Git integration
   existante) reconfigurés avec des **variables d'environnement scopées « Preview »** distinctes
   de « Production » dans les réglages Vercel — Vercel supporte nativement des valeurs différentes
   par scope, mais **rien ne garantit aujourd'hui qu'elles le soient** (non vérifiable depuis le
   dépôt ni via le MCP Vercel, en 403).

**Option alternative (si budget disponible)** : Supabase **Branching** (nécessite un plan payant,
Pro ou supérieur) — provisionne automatiquement une base isolée par PR, y rejoue les migrations,
la détruit à la fermeture. Plus élégant à terme, mais **ne dispense pas** de corriger les
blocages du §D — Branching rejouerait exactement la même séquence cassée.

---

## C — Niveau réel d'isolation (si l'option B recommandée est mise en œuvre correctement)

| Dimension | Isolation |
|---|---|
| Projet Supabase / base Postgres | Totale, par construction d'un second projet |
| Storage / Auth / Realtime | Totale (ressources propres à chaque projet Supabase) |
| Clés anon / service_role | Distinctes par projet |
| Secrets cron (CRON_SECRET/AUTOMATION_SECRET) | À définir explicitement en scope Preview — les crons Vercel ne se déclenchant qu'en Production, leur absence en Preview est même le comportement souhaité |
| URLs frontend/API | Déjà isolées par nature (chaque Preview Deployment a sa propre URL `*.vercel.app`) |
| Webhooks / intégrations externes (Sentry, Anthropic, Mistral) | À trancher : réutiliser les mêmes clés API tierces avec surveillance de quota, ou les désactiver en Preview |
| Données financières | Zéro donnée production présente, par construction d'un projet séparé |

**Non garanti sans action explicite** : si les variables Preview ne sont pas configurées
distinctement dans Vercel, elles héritent potentiellement des mêmes valeurs que Production — c'est
le risque de contamination le plus concret (§G).

---

## D — Migrations compatibles / incompatibles (audit complet des 179 fichiers)

**Verdict : la séquence ne construit PAS de base propre aujourd'hui.** Le rejeu séquentiel
(ordre lexicographique réel, vérifié empiriquement) s'arrête au fichier **68/179**.

### Bloquants (arrêtent le rejeu avec une erreur Postgres dure)

| Fichier | Problème |
|---|---|
| `068_entretiens_ia.sql:7` | `REFERENCES candidatures(id)` — table `candidatures` **jamais créée par aucune migration** (existe seulement en production, hors gouvernance). **Premier point de rupture du rejeu complet.** |
| `110_ats_pipeline.sql` (7,14,17,38,57,76,97) | Même cause, `candidatures`/`candidats` |
| `120_wave4a_rls_security.sql` (8,10,11) | Même cause, `candidatures` — ironie : le même fichier (lignes 19-52) montre le bon pattern défensif pour une autre table, mais ne l'applique pas ici |
| `164_fix_fiscal_declarations_rls_bypass.sql` (29,31,33) | `fiscal_declarations` jamais créée — **la correction de la faille de sécurité la plus critique de tout l'audit RESTART-AUDIT-AZ ne peut même pas s'appliquer sur une base neuve** |
| `176_repair_p0_04_amd_finance.sql:48`, `177_repair_achats_legacy_doublons.sql:47-48`, `178_tresorerie_compte_principal.sql:47-48`, `179_purge_seed_demo_amd_finance.sql:65` | Garde-fous `RAISE EXCEPTION` avec des comptages exacts (« 240 originaux », « 48 écritures », « 3 comptes »…) — sur base vierge, comptages = 0 → **exception levée, transaction annulée, rejeu arrêté**. Ce ne sont pas des migrations de schéma rejouables : ce sont des réparations ponctuelles de données de production, avec leur propre en-tête « BLOC À EXÉCUTER » manuel. |

### Gênants (n'arrêtent pas le rejeu, produisent un état différent de la production)

- `038_employes.sql:2` — `DROP TABLE IF EXISTS employes CASCADE` détruit silencieusement 3 FK
  posées par des migrations antérieures (`006`, `007`, `017`), jamais restaurées ensuite.
- `142.5_fix_fn_ae_execute_event_country.sql` s'exécute **avant** `142_*` (tri lexicographique,
  `.` < `_`) — sans impact aujourd'hui, mais convention fragile.
- `CATCHUP_008_to_025.sql` — entièrement redondant avec les migrations 008-025 numérotées
  (toutes protégées `IF NOT EXISTS`), candidat à la suppression pure.
- `20260524_mission_critique.sql` — non redondant (ajoute `profiles.created_at`,
  `tenants.status`/`deleted_at`), mais mal placé dans l'ordre (se joue après 179 alors que
  d'autres migrations en dépendent conceptuellement) ; sans impact bloquant constaté car les seules
  références sont à l'intérieur de corps de fonctions non validés à la création.
- Doublons `CREATE TABLE IF NOT EXISTS` sur le même nom entre migrations (`academic_settings`,
  `bulletins_paie`, `facture_lignes`, `notifications`) — tous protégés, mais la définition la plus
  récente n'est jamais appliquée si elle diffère de la première.
- Triggers concurrents déjà documentés (`NEW-01`, `NEW-02`,
  `R004-DB-TRIGGER-TRANSACTIONS`/`R004-CAISSE-DUPLICATE-WRITER`) : confirmé, un rejeu complet les
  recréerait, réactivant le risque latent de double écriture comptable.

### Sans impact (vérifiés, faux positifs écartés)

Extensions (`uuid-ossp`/`pg_cron`/`pg_net`) toutes en `CREATE EXTENSION IF NOT EXISTS` avant usage
validé ; aucun secret en dur trouvé (recherche exhaustive) ; aucune donnée de démo insérée par une
migration SQL (uniquement du référentiel légitime : plan comptable, règles fiscales, catalogue de
cours) ; plusieurs blocs de validation post-exécution correctement commentés donc inertes.

### Liste minimale pour débloquer (à corriger, pas à exécuter dans cette session)

1. `068_entretiens_ia.sql`, `110_ats_pipeline.sql`, `120_wave4a_rls_security.sql` — neutraliser la
   FK/les policies vers `candidatures`/`candidats`, ou créer ces tables avant ce point.
2. `164_fix_fiscal_declarations_rls_bypass.sql` — nécessite `fiscal_declarations`, ou un garde
   défensif du type déjà utilisé dans `090_nif_to_niu.sql`
   (`IF EXISTS (SELECT 1 FROM information_schema.tables ...)`).
3. `176`-`179` — à sortir de `supabase/migrations/` (vers un dossier de runbooks, cohérent avec
   `docs/runbooks/p0-05-bloc-A.sql` déjà existant) puisque ce sont des réparations ponctuelles, pas
   des migrations de schéma rejouables.

---

## E — Données nécessaires (conçues, non importées)

Un petit jeu de données synthétique, **explicitement identifiable** (préfixe `RECETTE-TEST-`
systématique sur les noms d'entreprise/tenant — contrairement au seed AMD FINANCE qui n'était
identifiable que par sa date de création, cause directe du besoin d'investigation de la mission
R-004), couvrant :

- 2 tenants minimum (test d'isolation tenant).
- Quelques profils par tenant à rôles différents (test de permissions).
- 1-2 factures, 1 achat, 1 bulletin de paie, 1 mouvement de trésorerie, 1 mouvement de stock par
  tenant (couvre facture/achat/paiement/journal comptable/trésorerie/stock/salarié/paie/événement
  comptable/RLS demandés par la mission).

**Ne pas réutiliser `scripts/seed-demo-data.ts` tel quel** — il cible « le tenant le plus ancien »
sans aucune vérification d'environnement (c'est exactement le mécanisme qui a pollué AMD FINANCE).
À corriger avant toute réutilisation : exiger un `--tenant-id` explicite, refuser de s'exécuter si
l'URL Supabase cible correspond au projet de production connu.

**Non importé dans cette session** — conception uniquement.

---

## F — Secrets / configuration nécessaires (présence/mécanisme uniquement, aucune valeur)

| Variable | Environnement | Présence | Consommateur |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Production (Vercel) | Présente (`.env.local` local confirmé) | Tout le code client/serveur |
| `NEXT_PUBLIC_SUPABASE_URL` | Preview (Vercel) | **Non vérifiable** depuis le dépôt ni via MCP Vercel (403) | idem |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Production / Preview | Production confirmée présente ; Preview non vérifiable | Client Supabase browser |
| `SUPABASE_SERVICE_ROLE_KEY` | Production / Preview | idem | `lib/supabase-server.ts` (bypass RLS) |
| `CRON_SECRET` | Production | Présence non confirmable de l'extérieur (401 ambigu — déjà établi R-003/R-005) | `lib/api/require-automation.ts`, `vercel.json` (11 crons) |
| `CRON_SECRET` | Preview | Vercel Cron ne se déclenche qu'en Production — cette variable n'a normalement pas besoin d'exister en Preview | — |
| `AUTOMATION_SECRET` | Production | Non confirmable de l'extérieur | Migration 167 (pg_cron), `require-automation.ts` |
| `ANTHROPIC_API_KEY` / `MISTRAL_API_KEY` | Production | Présentes (`.env.local`) | Fonctionnalités MIAA |
| `NEXT_PUBLIC_SENTRY_DSN` / `SENTRY_AUTH_TOKEN` | Production | Présentes | `sentry.*.config.ts` |

Aucune valeur consultée à aucun moment.

---

## G — Risques de contamination production

1. **Le plus concret** : si les variables Preview ne sont pas explicitement scopées différemment
   de Production dans Vercel, elles peuvent hériter des mêmes valeurs par défaut — tout test en
   Preview écrirait alors dans la vraie base. **Non vérifié, à confirmer par l'utilisateur dans le
   dashboard Vercel.**
2. **`scripts/seed-demo-data.ts` reste exécutable tel quel** contre n'importe quel `.env.local` qui
   pointerait vers production, ciblant automatiquement « le tenant le plus ancien » — risque actif
   et permanent, indépendant de la recette, tant que ce script n'est pas corrigé. C'est exactement
   le mécanisme qui a produit l'incident nettoyé par la migration 179.
3. Les migrations `176`-`179` contiennent des `tenant_id` **en dur** (`b93b7c3d-...`) — si rejouées
   par erreur contre une base de recette, elles échoueraient proprement (garde-fous, §D), donc pas
   de corruption silencieuse, mais un développeur pourrait être tenté de désactiver le garde-fou
   sans en comprendre la portée.
4. Vercel Cron (Production uniquement) réduit mais n'élimine pas le risque si le comportement de la
   plateforme est mal compris par un futur développeur.

---

## H — Guardrails CI/CD nécessaires

1. **Corriger `scripts/seed-demo-data.ts`** : refuser de s'exécuter si l'URL Supabase cible
   correspond au projet de production connu (liste blanche inversée) ; exiger un `--tenant-id`
   explicite plutôt que « le plus ancien tenant ».
2. **Sortir `176`-`179` de `supabase/migrations/`** vers `docs/runbooks/` (cohérent avec
   `p0-05-bloc-A.sql`/`p0-05-bloc-B.sql` déjà présents) — ce sont des réparations ponctuelles, pas
   des migrations de schéma rejouables.
3. **Job CI optionnel** (à activer une fois la recette existante) : lancer réellement
   `supabase db reset` contre le projet de recette sur chaque PR touchant `supabase/migrations/`
   — aurait détecté immédiatement les régressions 068/110/120/164.
4. **Vérification de scope au runtime** (optionnelle, plus robuste qu'un contrôle CI) : un garde
   qui compare l'ID de projet Supabase couramment ciblé à une constante connue de production, et
   refuse de démarrer en mode « seed »/« recette » si elle correspond — l'ID projet n'est pas un
   secret, il peut être committé en dur pour cette comparaison.
5. Protection de branche déjà correcte par défaut (Vercel Git integration : seule `main` déploie en
   Production) — rien à changer ici.

---

## I — Tickets ANO-P03 créés

Voir `docs/MASTER-REPAIR-REGISTER.md` et `docs/REPAIR-LOG.md` pour le détail complet :
- **R006-MIGRATION-PHANTOM-TABLES** (068/110/120/164 — bloquant le rejeu)
- **R006-REPAIR-MIGRATIONS-NOT-REPLAYABLE** (176-179 — bloquant le rejeu sur base vierge)
- **R006-EMPLOYES-FK-CASCADE-LOSS** (038 — perte silencieuse de 3 FK)
- **R006-MIGRATION-NAMING-ORDER** (142.5 / CATCHUP / 20260524 — hors convention, fragile)
- **R006-SEED-SCRIPT-NO-GUARD** (`scripts/seed-demo-data.ts` toujours exploitable contre la
  production — risque de récidive de l'incident nettoyé en 179)

ANO-P03 elle-même (Table 1 du registre) reste `OPEN`, enrichie du résultat de cet audit.

---

## J — Décision finale : **BLOCKED**

Deux blocages distincts, de nature différente :

**1. Blocage d'infrastructure (action utilisateur requise, hors de ma portée d'outillage)** —
aucun second projet Supabase n'existe. Je n'ai aucun outil pour en créer un (MCP Supabase en
échec de connexion pendant toute cette session ; même fonctionnel, la création de projet est une
action de compte/facturation qui doit rester à l'utilisateur). **Correction minimale** : créer un
projet Supabase « oraforme-recette » (plan Free suffisant, quelques minutes), puis configurer les
variables d'environnement « Preview » dans Vercel avec ses clés — action dashboard, également hors
de ma portée (MCP Vercel en 403 pour toute lecture/écriture de projet).

**2. Blocage technique (je peux corriger une fois autorisé)** — même avec un second projet
Supabase disponible immédiatement, **les migrations ne construiraient pas une base utilisable** :
le rejeu s'arrête au fichier 68/179 (`candidatures` jamais créée), et les migrations 176-179
échoueraient de toute façon sur leurs garde-fous. Correction minimale : les 3 éléments listés en
fin de §D — non appliqués dans cette session, mission de diagnostic uniquement.

**Aucune réparation P1 commencée. Aucun déploiement effectué. En attente de l'ordre.**

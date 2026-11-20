# BOI-010C — Rétablissement du canal de validation DB

Mission P0-BOI-010C, 2026-09-22. Mission d'infrastructure/validation uniquement : déterminer quel canal sûr et réellement disponible permettrait de valider la migration 184 avant exécution. **Aucune migration exécutée, aucune donnée créée, une seule vérification MCP effectuée (pas de répétition), aucun secret affiché.**

---

## 1. Inventaire des canaux réellement disponibles

| Canal | AVAILABLE | READ | WRITE | TRANSACTION | ROLLBACK | Constat |
|---|---|---|---|---|---|---|
| **MCP Supabase** (`mcp__supabase__*`) | **NO** | — | — | — | — | `CONNECT_TIMEOUT` après 30000ms, vérifié une seule fois cette mission (voir §5) |
| **MCP Postgres générique** (`mcp__postgres__*`) | **NO** | — | — | — | — | Également listé en échec de connexion dans le même relevé — même symptôme que le MCP Supabase |
| **MCP Supabase-Moonbank** | **NO** | — | — | — | — | Même symptôme (`CONNECT_TIMEOUT`) — confirme qu'il ne s'agit pas d'un problème propre au projet Oraforme mais d'une indisponibilité de transport MCP au niveau de la session entière (les 9 serveurs MCP configurés échouent tous, y compris des serveurs sans rapport avec une base de données — GitHub, Playwright, Sentry, Vercel) |
| **PostgREST** (API REST du vrai projet, clé `service_role`) | **YES** | ✅ | ⚠️ *techniquement oui, mais délibérément non utilisé pour l'écriture dans cette mission (interdiction explicite)* | **NO** — chaque requête HTTP est validée indépendamment, aucune notion de session inter-requêtes | **NO** | C'est le canal déjà utilisé en BOI-010/010B pour toutes les vérifications en lecture seule ; confirmé encore actif à l'instant (`HTTP 200` sur une requête `products`) |
| **psql** | **NO** | — | — | — | — | Absent du `PATH` (vérifié, `which psql` → rien) |
| **Variables d'environnement** (`.env.local`) | Partiel | — | — | — | — | Contient `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (les trois utilisés pour PostgREST) — **aucune chaîne de connexion Postgres directe** (`DATABASE_URL`, mot de passe base de données) : **ABSENTE**, déclarée comme telle, jamais reconstruite ni devinée |
| **Supabase CLI** (`npx supabase`) | Partiel | — | — | — | — | Binaire présent et fonctionnel (`2.117.0`) mais **aucun projet lié** (`linked_project: null`) et **aucun token d'accès stocké** (`~/.supabase/` ne contient que `telemetry.json`/`traces/`, pas de fichier d'authentification) — voir §3 |
| **Docker** | Partiel | — | — | — | — | **Installé** (`29.6.1`) mais **démon arrêté** (`failed to connect to the docker API… daemon is running?`) — voir §4 |
| **PostgreSQL local** | **NO** | — | — | — | — | Aucun binaire (`postgres`, `pg_ctl`) trouvé sur la machine |
| **Dump/schéma local** | **NO** | — | — | — | — | Aucun fichier de dump SQL complet trouvé dans le dépôt (seuls `supabase/migrations/*.sql`, qui sont les instructions de construction, pas un dump de l'état réel) |
| **Environnement Supabase local** (`supabase start`) | **NO** *(actuellement)* | — | — | — | — | Dépend de Docker (démon arrêté) **et** d'un projet lié — aucune des deux conditions n'est remplie maintenant. Voir §4 pour le chemin de remise en service. |

---

## 2. Ce qui n'a pas été inventé

Conformément à l'instruction, seules les variables **réellement présentes** dans `.env.local` ont été listées (par nom uniquement, jamais par valeur). Aucun mot de passe de base de données n'a été composé, deviné, ni recherché au-delà d'une recherche textuelle simple dans les fichiers `.env*` du dépôt (déjà effectuée en BOI-010B, non répétée inutilement ici — confirmée toujours absente par l'absence de toute variable `DATABASE_URL`/`POSTGRES_PASSWORD` dans le relevé ci-dessus). Le dossier `~/.supabase/` a été inspecté pour sa seule **existence de fichiers** (`telemetry.json`, `traces/`), jamais pour un contenu de jeton — aucun jeton n'existe à lire.

---

## 3. Supabase CLI — ce qu'il permettrait, ce qui manque

Le binaire fonctionne (`npx supabase --version` → `2.117.0`). Pour l'utiliser contre le vrai projet, deux conditions manquent simultanément :
1. **Un jeton d'accès Supabase** (`supabase login`, ou variable `SUPABASE_ACCESS_TOKEN`) — absent, jamais généré ni stocké dans cet environnement.
2. **Un lien vers le projet** (`supabase link --project-ref mrzixapnaqsbqmagivvf`) — nécessite le jeton du point 1, donc bloqué en amont.

**Rien de tout cela n'a été tenté** (ni `supabase login`, ni `supabase link`, ni `supabase db push`) — conformément à l'interdiction explicite de ne jamais lancer `db push` ou d'appliquer un changement, et à l'instruction de ne pas reconstruire un accès manquant. Même si ces deux conditions étaient un jour remplies, la commande destinée à appliquer des migrations distantes (`supabase db push`) **ne serait toujours pas utilisée** sans validation locale préalable — voir procédure §6.

---

## 4. Environnement local de test — disponible en théorie, pas maintenant

**Docker est installé mais son démon n'est pas démarré.** C'est la seule barrière technique restante pour disposer d'un environnement Supabase local complet (Postgres + PostgREST + Auth, orchestrés par `supabase start`, isolé de la production par construction — aucune des deux bases ne se touchent).

**Si le démon Docker était démarré**, la commande `npx supabase start` (non exécutée ici) créerait une base PostgreSQL locale entièrement neuve, sur laquelle `supabase/migrations/*.sql` serait rejoué **dans l'ordre**, du premier fichier au dernier. C'est précisément ce qui introduit une limite importante à documenter, pas à contourner :

> **Un rejeu local naïf de TOUTES les migrations ne reproduirait pas fidèlement la production.** Plusieurs missions antérieures de cet engagement (BOI-005, et `docs/RESTART-AUDIT-AZ.md`) ont établi qu'un sous-ensemble de migrations existantes dans `supabase/migrations/` — dont la migration 050 — **n'a en réalité jamais été appliqué en production** (« 050 stocks, 055 workflow, 091 santé, 104 academy, 116, 121, 157, 158 »). Une base locale reconstruite en rejouant tous les fichiers dans l'ordre appliquerait 050 avec succès, alors qu'elle ne l'est pas en production — créant une **base locale plus « avancée » que la vraie base**, donc un environnement de test qui ne représenterait plus fidèlement l'état réel contre lequel la migration 184 doit être validée.

**Conséquence directe** : même une fois Docker démarré, une reproduction locale fiable exigerait de rejouer **précisément la liste des migrations réellement appliquées en production** (pas la liste des fichiers présents dans le dossier) — une liste qui n'est, à ce jour, connue avec certitude que via l'historique déjà établi dans les rapports antérieurs de cet engagement, ou en l'interrogeant directement sur la vraie base (`supabase_migrations.schema_migrations`, ou l'équivalent MCP `list_migrations`) — ce qui referme la boucle sur le même besoin de connectivité que celui actuellement indisponible. **`LOCAL_REPRODUCTION` est donc classé indisponible maintenant, pas impossible en soi** — la procédure de remise en service (§6) détaille précisément l'ordre des actions qui éviterait ce piège.

**Aucun test local n'a été présenté comme une validation de production dans ce rapport ou les précédents** — cette distinction reste strictement maintenue.

---

## 5. MCP — symptôme documenté sans répétition

| | |
|---|---|
| **Symptôme** | `CONNECT_TIMEOUT` après 30000ms, identique pour les 9 serveurs MCP configurés de la session (`supabase`, `supabase-moonbank`, `postgres`, `context7`, `sequential-thinking`, `github`, `playwright` — plus `vercel`/`sentry` en `ENOTFOUND`, cause différente et sans rapport avec Supabase) |
| **Moment** | Constaté en continu depuis le début de la mission BOI-010 (2026-09-22), reconfirmé en BOI-010B, **vérifié une seule fois dans cette mission** (pas de nouvelle tentative répétée, conformément à l'instruction) |
| **Erreur exacte** | `MCP server supabase connection timed out after 30000ms` |
| **Impact** | Aucun outil `mcp__supabase__*` (`execute_sql`, `apply_migration`, `list_migrations`, etc.) disponible — impossible d'ouvrir une session SQL transactionnelle contre le vrai projet par ce chemin |
| **Condition nécessaire pour reprendre** | Rétablissement de la connectivité de transport MCP au niveau de l'environnement d'exécution (hors du contrôle de cette mission — infrastructure de la session, pas du projet Oraforme). Le fait que **tous** les serveurs MCP échouent identiquement, y compris ceux sans rapport avec une base de données, indique un problème de transport général plutôt qu'un problème de configuration ou de credentials Supabase spécifique |

---

## 6. Procédure de reprise — préparée, aucune étape exécutée maintenant

À exécuter, dans cet ordre exact, **uniquement** lors d'une session où un canal transactionnel réel (MCP Supabase rétabli, ou Supabase CLI authentifié + Docker démarré) est confirmé disponible :

1. **Vérifier l'état réel de la migration 184** — confirmer qu'aucune de ses colonnes/fonctions/vue n'existe déjà en production (le garde-fou `DO $$ ... RAISE EXCEPTION` en tête du fichier le fait automatiquement, mais une vérification manuelle préalable évite une transaction inutilement ouverte puis avortée).
2. **Vérifier la signature exacte de l'ancienne `fn_stock_move`** en production (`SELECT pg_get_functiondef('fn_stock_move'::regproc)`) — confirmer qu'elle correspond toujours aux 8 paramètres attendus par le `DROP FUNCTION IF EXISTS fn_stock_move(UUID, UUID, TEXT, NUMERIC, UUID, NUMERIC, TEXT, TEXT)` ajouté en BOI-010B, avant de s'y fier.
3. **Appliquer la migration 184 temporairement**, à l'intérieur d'une transaction `BEGIN` non validée (jamais `supabase db push` en direct).
4. **Tester `fn_stock_move`** sur le scénario minimal (+100 achat, +100 production).
5. **Tester le chemin achat réel** (`purchase → purchase_item → réception → fn_stock_move`, vérifier `origine`/`purchase_item_id`).
6. **Tester le chemin production locale** (entrée via `/api/stock/move` avec `origine='production_locale'`).
7. **Tester le refus de sortie** sur une provenance insuffisante (−81 sur 80 disponible) — vérifier l'erreur **et** l'absence de toute diminution partielle du stock.
8. **Tester la vue `v_products_stock_par_origine`** (70/80) et confirmer que `v_products_stock` retourne toujours 150.
9. **Tester le chemin POS** si un accès applicatif réel est disponible dans la même session (choix manuel → sortie ; aucune sélection → refus).
10. **Tester l'isolation RLS** avec deux tenants de test créés **dans la même transaction**.
11. **`ROLLBACK` complet** — jamais de `COMMIT` tant que les dix points précédents n'ont pas tous été confirmés.
12. **Vérifier l'état initial** (comptages `products`/`warehouses`/`stock_movements`/`purchases`/`purchase_items`/`journal_entries`/`accounting_events` identiques à l'avant-transaction) — exactement la méthode déjà appliquée avec succès dans plusieurs missions antérieures de cet engagement (BOI-004, BOI-005) lorsque le canal transactionnel était disponible.

**Aucune de ces douze étapes n'a été exécutée dans cette mission.**

---

## État final obligatoire

```
DB_TRANSACTION_CHANNEL        = UNAVAILABLE
PRODUCTION_WRITE_CHANNEL      = UNAVAILABLE
LOCAL_REPRODUCTION            = UNAVAILABLE

MIGRATION_184_SAFE_TO_EXECUTE = NO

NEXT_REQUIRED_ACTION = Rétablir un canal transactionnel réel avant toute exécution :
  soit (a) la connectivité MCP Supabase/Postgres au niveau de l'environnement
  de session (hors du contrôle de cette mission), soit (b) démarrer le démon
  Docker localement puis authentifier la Supabase CLI (`supabase login` +
  `supabase link`) pour permettre une reproduction locale fidèle — en
  rejouant uniquement les migrations réellement appliquées en production
  (liste à confirmer via le canal (a) une fois rétabli, jamais en supposant
  que tous les fichiers de supabase/migrations/ ont été appliqués). Une fois
  l'un des deux canaux disponible, exécuter la procédure de reprise en 12
  étapes (§6) dans une transaction non validée avant toute exécution réelle
  de la migration 184.

STOCK_PROVENANCE_IMPLEMENTATION = PARTIAL
BOI_IMPLEMENTATION              = BLOCKED
```

---

Aucun code métier modifié. Aucune migration exécutée. Aucune donnée production modifiée. Aucun secret affiché. Aucun commit, aucun push.

# DB-LOCAL-RECOVERY-01 — Reproduire Oraforme/PostgreSQL localement, en isolation

Mission strictement diagnostique. Aucun fichier modifié, aucun conteneur
démarré, aucune migration exécutée, aucune donnée touchée, aucun lien de
projet créé (`supabase link` non exécuté), aucun `db push`/`db reset`, aucun
commit/push. Toutes les commandes ci-dessous sont en lecture seule.

## 1. État Docker

```
docker info  → Server Version 29.8.2 | Containers: 0 | Images: 1
docker ps -a → 0 conteneur (aucun, ni actif ni arrêté)
docker images → 1 seule image présente :
                 public.ecr.aws/supabase/edge-runtime:v1.74.3 (1.12 GB)
```

Le démon répond (confirmé — correspond aux preuves machine données en
contexte). Une seule image Supabase est déjà en cache localement
(`edge-runtime`, utilisée pour les Edge Functions) — **aucune des images
nécessaires à la stack complète n'est présente** : il manque au minimum
`postgres` (ou l'image Postgres spécifique de Supabase), `postgrest`,
`gotrue`/auth, `realtime`, `storage-api`, `kong`, `studio`,
`postgres-meta`. Un premier `supabase start` devrait donc télécharger
l'essentiel de la stack (plusieurs Go) — à anticiper, pas à faire dans
cette mission.

**`DOCKER = AVAILABLE`** (confirmé — démon actif, 0 conteneur, stack complète non encore présente en image).

## 2. État Supabase CLI

```
supabase --version → 2.119.0
```

`find . -iname config.toml` (jusqu'à 3 niveaux) : **aucun résultat.** Ce
dépôt n'a jamais été initialisé (`supabase init`) — il n'existe pas de
`supabase/config.toml`, donc pas de `project_id` local déclaré.

```
supabase status → {"linked_project":null,"_tag":"Error",
                    "error":{"code":"StatusDbInspectError",
                    "message":"failed to inspect container health:
                    Error response from daemon:
                    No such container: supabase_db_oraforme"}}
```

Résultat différent de la dernière fois que Docker était arrêté : le CLI
atteint maintenant le démon (il sait formuler une requête Docker précise —
"No such container: supabase_db_oraforme"), mais ce conteneur n'existe pas
(cohérent avec `docker ps` vide). Le nom `supabase_db_oraforme` que le CLI a
tenté d'inspecter vient du nom du dossier racine du dépôt
(`.../Music/oraforme`), pas d'un `config.toml` — confirmé par
`supabase migration list`, qui échoue différemment et plus explicitement :

```
supabase migration list → {"_tag":"Error","error":{"code":"ProjectRefNotLinkedError",
                            "message":"Cannot find project ref. Have you run supabase link?"}}
```

Aucun `supabase link` n'a été exécuté (conforme à la consigne). Aucun jeton
d'accès CLI local trouvé lors de la mission précédente
(`~/.supabase/access-token` absent) — le CLI n'est authentifié à aucun
compte.

**`SUPABASE_LOCAL_CONFIG = MISSING`** (CLI opérationnel, Docker prêt, mais
aucune initialisation locale n'existe encore — normal et attendu, puisque
`supabase init` n'a volontairement pas été exécuté dans cette mission).

## 3. État de la configuration locale du dépôt

Inspection de `supabase/`, `package.json`, `scripts/`, racine du dépôt :

- **`supabase/config.toml`** : absent.
- **`docker-compose*`** : aucun fichier trouvé à la racine ni ailleurs dans
  les 2 premiers niveaux — ce dépôt ne porte aucune stack docker-compose
  maison pour Postgres/Supabase.
- **`supabase/migrations/`** : 186 fichiers `.sql` (001 à 186, plus
  `20260524_mission_critique.sql` et `CATCHUP_008_to_025.sql` — voir §4 pour
  le risque d'ordre que ces deux noms non conformes introduisent).
- **`supabase/tests/`** : 3 fichiers SQL bruts
  (`validate_rls_wave4a.sql`, `rls_wave4a_rapport.sql`,
  `wave4b_subtype_fixtures.sql`) — des scripts de validation RLS à exécuter
  manuellement contre une base, pas une suite pgTAP intégrée au CLI.
- **`supabase/.temp/`** : un seul fichier, `cli-latest` (marqueur de version
  du CLI, pas un lien de projet).
- **`supabase/seed_ecam_congo.sql`** et **`supabase/backfill_paie_comptabilite.sql`** :
  scripts SQL de seed/backfill ponctuels, pas un seed générique appelé par
  le CLI (`supabase/seed.sql` n'existe pas — le CLI ne les exécuterait pas
  automatiquement à un `db reset`).
- **`scripts/lib/seed-production-guard.ts`** (+ son test) : un garde-fou
  déjà existant qui bloque le seed si l'environnement cible ressemble à de
  la production — pertinent pour la sécurité (§6), pas à modifier ici.
- **`package.json` → `scripts`** : `build`, `dev`, `lint`, `lint:debt`,
  `semgrep`, `start`, `test`, `test:coverage`, `test:watch`, `typecheck`.
  **Aucun script `db:*`, `supabase:*`, `migrate`, `seed` ou `reset`** —
  aucun workflow DB local n'est aujourd'hui outillé via npm.
- **`.env.local`** : existe, utilisé par l'application. **`.env.example`**
  existe aussi (modèle sans valeurs réelles, à utiliser pour un futur
  `.env.local.test` isolé — voir §6/§7).
- **`.env_used_tmp.txt`** : fichier de 18 lignes contenant uniquement des
  **noms** de variables (`ANTHROPIC_API_KEY`, `AUTOMATION_SECRET`,
  `CRON_SECRET`, `EMAIL_FROM`, `MISTRAL_API_KEY`, ...), aucune valeur —
  un inventaire, pas une fuite de secrets. Signalé pour mémoire, non modifié.

**`SUPABASE_LOCAL_CONFIG = MISSING`** (confirmé — rien n'est prêt, mais rien
n'empêche de le préparer : pas de conflit, pas de configuration cassée à
réparer avant de commencer).

## 4. Chaîne de migrations — replay à blanc

Analyse statique complète de `supabase/migrations/` (186 fichiers numérotés
+ 2 fichiers au nommage non conforme).

**Confirmation du problème historique (migration 068, `candidatures`)** :
toujours présent, identique à ce qui était déjà documenté.

```
supabase/migrations/068_entretiens_ia.sql, ligne 7 :
ALTER TABLE entretiens ADD COLUMN IF NOT EXISTS candidature_id UUID
  REFERENCES candidatures(id) ON DELETE SET NULL;
```

Recherche exhaustive (`grep -rn "CREATE TABLE.*candidatures"` sur tout le
dossier) : **aucun résultat** — la table `candidatures` n'est créée par
AUCUNE migration de ce dépôt. Elle existe en production (l'application
fonctionne), donc elle a été créée directement (dashboard Supabase / SQL
Editor), hors du contrôle de version — un drift structurel déjà connu, pas
une nouvelle découverte, mais revérifié ligne par ligne aujourd'hui plutôt
que simplement réaffirmé.

**Première migration qui échouerait sur un replay à blanc :**
`068_entretiens_ia.sql`, ligne 7 — erreur Postgres attendue :
```
ERROR: relation "candidatures" does not exist
```
(un `ALTER TABLE ... ADD COLUMN ... REFERENCES <table>` exige que la table
référencée existe déjà).

**Dépendance manquante :** un `CREATE TABLE candidatures (...)` qui
n'existe dans aucun fichier de ce dépôt.

**Migrations suivantes affectées :** dans un replay strictement séquentiel
(001 → 186 dans l'ordre), **tout ce qui suit 068 ne s'exécute jamais** —
soit 118 fichiers numérotés (069 à 186) + les 2 fichiers au nommage non
conforme, soit 120 fichiers au total. Parmi eux, `candidatures` est
re-référencée (donc aurait re-échoué même si 068 seule était contournée) dans
`109_recrutement_sector.sql`, `110_ats_pipeline.sql`,
`120_wave4a_rls_security.sql`, `163_fix_cvs_candidats_bucket_listing.sql` —
et une **seconde table phantom indépendante**, `fiscal_declarations`, est
référencée (sans jamais être créée) dans
`164_fix_fiscal_declarations_rls_bypass.sql`. Les migrations C6 (184, 185,
186, objet de cette investigation) sont donc également, par construction,
inatteignables par un replay séquentiel strict tant que 068 n'est pas
contourné ou corrigé.

**Anomalie supplémentaire trouvée aujourd'hui, distincte de 068** (ordre de
fichiers, pas un problème de contenu SQL) : `ls supabase/migrations | sort`
place `20260524_mission_critique.sql` puis `CATCHUP_008_to_025.sql` **après**
`186_...` dans un tri alphabétique strict (les chiffres `0-9` précèdent les
lettres majuscules en ASCII, donc `2026...` et `CATCHUP...` se classent après
tous les fichiers `0XX_`/`1XX_`). Si le nom `CATCHUP_008_to_025` indique bien
un correctif destiné à combler ce que les migrations 008 à 025 auraient dû
faire, l'exécuter en dernier (après 186) plutôt qu'immédiatement après 025
serait probablement incorrect — **non vérifié plus avant dans cette
mission** (le replay échoue de toute façon bien avant, à 068 ; cette
anomalie d'ordre n'a donc pas pu être testée en pratique, seulement observée
au niveau du système de fichiers). `supabase migration list` n'a pas pu
confirmer si le CLI applique le même tri, faute de projet lié
(`ProjectRefNotLinkedError`) — pas testé plus loin, pas de lien créé pour le
tester.

**`MIGRATION_CHAIN_LOCAL_REPLAY = BROKEN`**.

## 5. Migrations C6 (184/185/186)

Vérification statique des en-têtes et du contenu, sans exécution :

- **184** (`184_stock_provenance.sql`) — provenance de stock (BOI-010) :
  ajoute `stock_movements.origine`/`purchase_item_id`, étend `fn_stock_move`
  à 10 paramètres. Amendée lors de C6-POST-REVIEW-FIX (anomalie B1 :
  vérification tenant sur `purchase_item_id`) — toujours non exécutée.
- **185** (`185_vente_canonique.sql`) — vente canonique : ajoute
  `ventes.montant_ht/tva/ca/statut_paiement/destinataire/idempotency_key` +
  index unique d'idempotence, et les règles comptables VTE-001 (7 séquences)
  / VTE-002. Son propre en-tête confirme explicitement : **"CETTE MIGRATION
  NE DÉPEND PAS DE 184 AU NIVEAU SQL"** (aucun objet de 185 ne référence
  `stock_movements.origine`) — vérifié, pas réaffirmé sans preuve.
- **186** (`186_vente_atomic_et_reverse_idempotent.sql`) — atomicité (A1) et
  reverse idempotent (C1) : son en-tête déclare explicitement
  **"DÉPENDANCES : nécessite 184 (fn_stock_move à 10 paramètres + colonnes
  origine/purchase_item_id) et 185 (ventes.montant_ht/tva/ca/idempotency_key,
  VTE-001/VTE-002)"** — confirmé dans le corps : `fn_create_vente_atomique`
  fait `INSERT INTO ventes (..., idempotency_key)` (exige 185) et
  `PERFORM fn_stock_move(...)` avec la signature à 10 paramètres étendue par
  184 (puis réétendue à 11 par 186 elle-même, via son propre
  `DROP FUNCTION ... (10 params)` explicite).

**Ordre exact confirmé : 184 → 185 → 186.** Plus précisément : 184 et 185
sont mutuellement indépendantes au niveau SQL (leur ordre relatif n'aurait
pas d'importance entre elles seules), mais 186 exige que les DEUX soient déjà
appliquées — l'ordre numérique du dépôt (184, 185, 186) est donc correct et
n'a pas besoin d'être changé.

## 6. Risques de connexion à la production

- **`.env.local`** (celui que `next dev`/les scripts du dépôt lisent
  aujourd'hui) contient `NEXT_PUBLIC_SUPABASE_URL=https://mrzixapnaqsbqmagivvf.supabase.co`
  — **le projet Supabase de PRODUCTION**, confirmé (URL publique par nature
  de la variable `NEXT_PUBLIC_*`, pas un secret — affichée ici à dessein pour
  que le risque soit visible). `SUPABASE_SERVICE_ROLE_KEY` est également
  présente dans ce même fichier — **jamais affichée ici**, mais son
  existence dans `.env.local` signifie que **toute commande qui charge ce
  fichier (`next dev`, un script qui fait `require('dotenv').config()`,
  etc.) parle à la production**, pas à un futur environnement local.
- **Aucun fichier `.env.local.test`/`.env.test`/`.env.development.local`**
  n'existe aujourd'hui pour isoler un environnement local — à créer (pas
  fait dans cette mission, c'est une proposition, §7).
- **Garde-fou déjà existant** : `scripts/lib/seed-production-guard.ts` (+
  test) bloque déjà un seed s'il détecte un environnement qui ressemble à la
  production — pertinent pour éviter qu'un futur script de seed local ne
  tourne par erreur contre la production. À réutiliser, pas à dupliquer.
- **Aucune connexion en écriture vers la production n'a été faite dans
  cette mission** — toutes les commandes exécutées (`docker info/ps/images`,
  `supabase --version/status/migration list`, les `grep`/`find`/`ls`
  d'inspection de fichiers) sont soit locales, soit en lecture seule contre
  Docker, soit ont explicitement échoué avant d'atteindre un réseau
  (`ProjectRefNotLinkedError`).

**`PRODUCTION_SAFETY = PARTIAL`** — aucune fuite ni écriture n'a eu lieu,
mais le risque structurel est réel et actif tant qu'aucun fichier d'environ-
nement local dédié n'existe : la configuration actuelle du dépôt (un seul
`.env.local`, pointant en production) ne protège pas par elle-même contre
une commande future lancée par erreur sans l'environnement local explicite.

## 7. Procédure locale proposée (à exécuter dans une mission future, pas ici)

```
Docker (déjà disponible)
  → supabase init                         (crée supabase/config.toml — N'A PAS été fait ici)
  → ÉCRIRE les 2 tables manquantes dans une migration LOCALE SÉPARÉE,
    numérotée AVANT 069 (ex. 068.5_candidatures_fiscal_declarations_shim.sql),
    contenant UNIQUEMENT :
      CREATE TABLE IF NOT EXISTS candidatures (...)       -- schéma minimal
      CREATE TABLE IF NOT EXISTS fiscal_declarations (...) -- schéma minimal
    Ce fichier ne doit JAMAIS être appliqué à la production (où ces tables
    existent déjà sous un autre schéma, inconnu de ce dépôt) — strictement
    un correctif de replay LOCAL, à exclure explicitement de tout futur
    `supabase db push` vers un projet distant.
  → supabase start                        (tire les images manquantes, démarre Postgres/PostgREST/Studio en local, AUCUN lien vers mrzixapnaqsbqmagivvf)
  → supabase db reset                     (rejoue 001 → 186 dans une base locale neuve, avec le shim ci-dessus en place)
  → appliquer 184 → 185 → 186 (déjà incluses si elles sont dans supabase/migrations/ au moment du reset)
  → fixtures minimales (tenant de test, produit de test, warehouse de test — jamais de copie de données réelles)
  → exécuter les scénarios réels du plan de validation (C6-PRE-PRODUCTION-REVIEW.md §15 + les 4 étapes ajoutées par C6-POST-REVIEW-FIX.md)
```

Point de sécurité structurel de cette procédure : **un projet Supabase local
démarré via `supabase start` n'a, par construction, aucune URL ni clé en
commun avec le projet de production** — ses URL/clés sont générées
localement (`http://127.0.0.1:54321` et des clés de développement fixes et
publiques, documentées par Supabase lui-même). Le risque n'est donc pas que
l'environnement local "fuite" vers la production, mais que l'application
soit lancée avec le **mauvais fichier d'environnement** (`.env.local` au
lieu d'un futur `.env.local.test`) — d'où la recommandation explicite d'un
fichier séparé en §6/§9.

## 8. État récapitulatif

| Élément | État |
|---|---|
| Docker | Disponible, stack Supabase non encore téléchargée |
| Supabase CLI | Installé, non initialisé, non lié, non authentifié |
| `supabase/config.toml` | Absent |
| Scripts npm dédiés DB | Aucun |
| Table `candidatures` | Jamais créée dans les migrations (phantom) |
| Table `fiscal_declarations` | Jamais créée dans les migrations (phantom) |
| Migrations 184/185/186 | Saines statiquement, ordre confirmé 184→185→186, mais inatteignables par un replay séquentiel strict à cause de 068 |
| `.env.local` | Pointe la production — à ne jamais réutiliser tel quel pour le local |

## 9. Commandes exactes à exécuter ensuite (mission future, autorisation requise avant exécution)

```bash
# 1. Initialiser (crée supabase/config.toml, ne touche à rien d'existant)
npx supabase init

# 2. Créer le fichier d'environnement local ISOLÉ (jamais .env.local)
cp .env.example .env.local.test
# → y mettre les valeurs locales que `supabase start` affichera à l'étape 4
#   (anon key / service_role key de DÉVELOPPEMENT, publiques et documentées
#   par Supabase, PAS celles de .env.local)

# 3. Écrire le shim LOCAL pour candidatures/fiscal_declarations (fichier
#    séparé, numéroté avant 069, jamais inclus dans un db push distant)

# 4. Démarrer la stack locale (télécharge les images manquantes — peut
#    prendre plusieurs minutes et plusieurs Go la première fois)
npx supabase start

# 5. Rejouer la chaîne complète dans la base locale neuve
npx supabase db reset

# 6. Vérifier 184/185/186 appliquées sans erreur (contrôles déjà écrits en
#    commentaire dans chaque fichier de migration)

# 7. Charger des fixtures minimales de test, puis exécuter les scénarios
#    réels listés dans C6-PRE-PRODUCTION-REVIEW.md §15 et
#    C6-POST-REVIEW-FIX.md (12 bis à quinquies)
```

Aucune de ces commandes n'a été exécutée dans cette mission.

## 10. Protections anti-production

- Ne jamais exécuter `supabase link --project-ref mrzixapnaqsbqmagivvf` dans
  le cadre de ce travail local — un projet local n'a besoin d'aucun lien
  distant pour fonctionner (`supabase start`/`db reset` sont 100% locaux).
- Toujours lancer l'application locale avec un fichier d'environnement
  dédié (`.env.local.test`, jamais `.env.local`) — par exemple
  `next dev` ne lit pas automatiquement un autre fichier que `.env.local`
  par défaut ; une mission future devra soit renommer temporairement,
  soit utiliser un chargeur explicite (`dotenv -e .env.local.test --`).
- Ne jamais inclure le shim `candidatures`/`fiscal_declarations` (§7) dans
  un `supabase db push` vers un projet distant — il est fait pour combler un
  trou de replay local, pas pour modifier la production (où ces tables
  existent déjà, sous un schéma que ce dépôt ne connaît pas).
- Réutiliser `scripts/lib/seed-production-guard.ts` pour tout futur script
  de seed local, plutôt que d'en écrire un nouveau sans cette protection.
- Avant tout `supabase db push`/`supabase link`, confirmer explicitement
  avec l'utilisateur la cible (local vs distant) — aucune de ces commandes
  ne doit être lancée sans validation explicite, conformément à la
  discipline déjà appliquée dans tout cet engagement.

---

## Verdicts

```
DOCKER                 = AVAILABLE
SUPABASE_LOCAL_CONFIG  = MISSING
MIGRATION_CHAIN        = BROKEN
C6_LOCAL_REPLAY        = BLOCKED
PRODUCTION_SAFETY      = PARTIAL
```

`C6_LOCAL_REPLAY = BLOCKED` : les migrations 184/185/186 elles-mêmes sont
saines et dans le bon ordre, mais un replay local part forcément de
`supabase db reset` (001 → 186 séquentiel), qui échoue à 068 avant même
d'atteindre 184. Un replay local de C6 n'est possible qu'après un correctif
de contournement LOCAL (le shim du §7) — pas en appliquant simplement 184,
185, 186 isolément sans le reste de la chaîne, et pas sans que ce
contournement soit explicitement validé comme "local only, jamais poussé en
production".

`PRODUCTION_SAFETY = PARTIAL` : aucune action risquée n'a eu lieu, mais la
configuration actuelle du dépôt (`.env.local` unique, pointant la
production, sans fichier local alternatif encore créé) reste un risque actif
pour toute commande future qui ne spécifierait pas explicitement son
environnement cible.

**`NEXT_MISSION`** = Une mission d'EXÉCUTION (pas seulement diagnostique),
explicitement autorisée par l'utilisateur, pour : (1) `supabase init` et
création de `.env.local.test` isolé ; (2) écriture du shim local
`candidatures`/`fiscal_declarations` (schéma minimal, commenté comme
"local-only, ne jamais pousser") ; (3) `supabase start` + `supabase db
reset` ; (4) vérification que 184/185/186 s'appliquent sans erreur ; (5)
exécution des scénarios réels de `C6-PRE-PRODUCTION-REVIEW.md` §15 et
`C6-POST-REVIEW-FIX.md` (A1/A2/B1/C1) contre cette base locale. Cette
mission future devra elle-même commencer par faire confirmer à l'utilisateur
qu'aucune de ces commandes ne touchera le projet `mrzixapnaqsbqmagivvf`.

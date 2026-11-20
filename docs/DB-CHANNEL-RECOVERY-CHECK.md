# DB-CHANNEL-RECOVERY-CHECK — Peut-on obtenir un canal PostgreSQL transactionnel réel ?

Mission de diagnostic uniquement. Aucun code modifié, aucune migration
exécutée, aucune donnée touchée, aucun INSERT/UPDATE/DELETE, aucun
commit/push. Aucun mock utilisé comme substitut d'un canal réel — chaque
ligne ci-dessous rapporte un résultat de commande réellement exécutée
aujourd'hui (2026-10-06), pas une reprise d'un diagnostic antérieur.

## 1. Docker

```
docker version   → Client v29.6.1 présent (OS/Arch windows/amd64)
docker info       → échoue après l'en-tête client
docker ps         → failed to connect to the docker API at
                    npipe:////./pipe/dockerDesktopLinuxEngine :
                    the system cannot find the file specified
```

Le CLI Docker est installé, mais le démon (Docker Desktop / son moteur Linux)
n'est pas démarré — le pipe nommé qu'utilise le CLI pour parler au démon
n'existe pas. Aucune commande destructive n'a été tentée (et aucune n'aurait
pu l'être : sans démon, `docker run`/`docker compose up` échoueraient de la
même façon).

**`DOCKER = UNAVAILABLE`** (CLI présent, démon arrêté).

## 2. Supabase CLI

```
supabase --version → 2.119.0 (CLI présent)
```

Recherche d'un `config.toml` (lien projet) jusqu'à 4 niveaux sous la racine
du dépôt : **aucun fichier trouvé** — ce dépôt n'a jamais été initialisé
(`supabase init`) ni lié (`supabase link`) localement via le CLI, malgré la
présence de `supabase/migrations/*.sql` (ces fichiers SQL existent
indépendamment d'un lien CLI — ils ont toujours été écrits comme des
fichiers texte, jamais appliqués par ce CLI).

```
supabase status → {"linked_project":null,"_tag":"Error",
                    "error":{"code":"StatusDbInspectError",
                    "message":"failed to inspect container health: ...
                    npipe:////./pipe/dockerDesktopLinuxEngine ..."}}
```

Confirme `linked_project: null`, et échoue ensuite en tentant d'inspecter un
conteneur local — dépendance directe à Docker (§1), donc bloqué pour la même
raison. Aucun fichier de jeton d'accès CLI trouvé localement
(`~/.supabase/access-token` absent) : le CLI n'est pas non plus authentifié
auprès d'un compte Supabase sur cette machine.

**`SUPABASE_CLI = PARTIAL`** (binaire présent et fonctionnel, mais ni lié à
Oraforme, ni authentifié, ni utilisable pour quoi que ce soit qui dépend de
Docker en local).

## 3. psql

```
psql --version → command not found (absent du PATH)
```

Recherche (par nom de variable uniquement, dans les fichiers `.env*` déjà
présents dans ce dépôt — aucune recherche de credentials ailleurs, aucune
tentative de les deviner) : **aucune variable `DATABASE_URL`, `POSTGRES_URL`
ou `DIRECT_URL`** dans les fichiers d'environnement du projet. Seules
`NEXT_PUBLIC_SUPABASE_URL` et `SUPABASE_SERVICE_ROLE_KEY` y figurent — ce sont
des identifiants PostgREST/API, pas une chaîne de connexion Postgres directe
(host/port/utilisateur/mot de passe). Sans binaire ET sans chaîne de
connexion, aucune tentative de connexion n'a été faite — il n'y a rien à
quoi se connecter avec les moyens présents dans ce dépôt.

**`PSQL = UNAVAILABLE`** (binaire absent, aucune chaîne de connexion directe disponible).

## 4. MCP / connecteurs

Trois serveurs MCP visent une base Postgres/Supabase dans cet environnement :
`postgres`, `supabase`, `supabase-moonbank`.

- **`supabase` et `supabase-moonbank`** : aucun outil disponible à cet
  instant (confirmé par recherche d'outils — aucun résultat Supabase hormis
  le générique `postgres`). Cohérent avec l'échec de connexion déjà signalé
  en tête de session (`CONNECT_TIMEOUT`). Non retesté une seconde fois pour
  ces deux serveurs précis — consigne de ne pas multiplier les tentatives, et
  rien n'indique qu'un seul nouvel essai changerait un timeout de transport.
- **`postgres`** (`mcp__postgres__query`, outil explicitement READ-ONLY) :
  **un seul appel test** (`SELECT 1`) a été fait. Résultat, nouveau et plus
  précis qu'un simple timeout :
  ```
  (ENOTFOUND) tenant/user postgres.mrzixapnaqsbqmagivvf not found
  ```
  Ceci n'est PAS un timeout réseau — la requête a atteint un point
  d'extrémité qui parle le protocole Postgres (vraisemblablement un pooler de
  type Supavisor/PgBouncer, où le nom d'utilisateur encode la référence de
  projet sous la forme `postgres.<ref>`), mais ce point d'extrémité ne
  reconnaît PAS `mrzixapnaqsbqmagivvf` comme un tenant valide. Cause précise
  non déterminable depuis ce dépôt (projet mis en pause côté Supabase,
  chaîne de connexion configurée côté MCP pointant vers le mauvais
  pooler/région, ou référence de projet périmée) — mais la nature de l'échec
  est claire : un problème d'identification côté serveur de connexion, pas
  un problème de transport/timeout, et de toute façon **cet outil est
  explicitement en lecture seule** — même s'il se connectait, il ne
  fournirait pas de canal transactionnel.

**`MCP_DB = UNAVAILABLE`** (deux serveurs sans outil exposé ; le troisième
atteint un point d'extrémité mais en échec d'identification de tenant, et
serait de toute façon read-only s'il fonctionnait).

## 5. PostgREST

```
GET {SUPABASE_URL}/rest/v1/ (apikey + Bearer service_role) → HTTP 200
```

Confirmé joignable aujourd'hui, comme à chaque mission précédente de cet
engagement. **Ceci n'est PAS classé comme un canal transactionnel** — c'est
une API REST au-dessus de Postgres, sans `BEGIN`/`COMMIT` multi-instructions
exposé, et sans exécution de SQL arbitraire. Le fait que les GET
fonctionnent ne change rien à cette classification : c'est exactement la
distinction que cette mission demande de ne pas confondre.

**`POSTGREST = READ_ONLY_REACHABLE`** (pas un canal transactionnel).

## 6. Supabase local

Dépend entièrement de Docker (§1). Docker étant `UNAVAILABLE` (démon arrêté,
pas seulement une image absente), **aucune tentative de démarrage n'a été
faite** — il n'y a pas de démon à qui demander de démarrer quoi que ce soit,
et la consigne est de ne rien lancer qui l'exigerait. Rien n'a été modifié en
production ni ailleurs.

**`LOCAL_POSTGRES = UNAVAILABLE`** (bloqué entièrement par §1, aucune tentative risquée faite).

---

## Conclusion

```
DOCKER            = UNAVAILABLE   (CLI présent, démon arrêté)
PSQL              = UNAVAILABLE   (binaire absent, aucune chaîne de connexion directe dans le dépôt)
SUPABASE_CLI      = PARTIAL       (binaire présent, projet non lié, CLI non authentifié)
MCP_DB            = UNAVAILABLE   (2 serveurs sans outil ; le 3e en échec d'identification de tenant, et read-only de toute façon)
POSTGREST         = READ_ONLY_REACHABLE (confirmé, mais explicitement pas un canal transactionnel)
LOCAL_POSTGRES    = UNAVAILABLE   (bloqué par Docker)

DB_TRANSACTION_CHANNEL   = UNAVAILABLE
PRODUCTION_DB_WRITE_CHANNEL = UNAVAILABLE
LOCAL_REPRODUCTION       = UNAVAILABLE

C6_CAN_NOW_BE_EXECUTED = NO
```

### Cause technique précise

Deux chaînes indépendantes, toutes deux bloquées à une étape différente et
plus précise qu'avant cette mission :

1. **Chaîne locale** (Docker → Supabase CLI → Postgres local) : bloquée dès
   la première étape — le démon Docker Desktop n'est pas démarré sur cette
   machine (le pipe `dockerDesktopLinuxEngine` n'existe pas). Tout le reste
   de cette chaîne (lien CLI, stack locale) en dépend et n'a donc pas pu être
   testé plus loin.
2. **Chaîne distante** (MCP postgres → pooler Supabase) : ne bloque plus sur
   un timeout de transport générique comme précédemment signalé en tête de
   session — elle atteint désormais un point d'extrémité réel qui répond
   `tenant/user postgres.mrzixapnaqsbqmagivvf not found`, une erreur
   d'identification de projet côté pooler. Et même résolue, cette voie
   resterait read-only par construction de l'outil exposé.

### Prochaine action minimale

- Pour la chaîne locale : démarrer Docker Desktop sur cette machine (action
  humaine — lancer l'application ; rien dans ce dépôt ni dans cette session
  ne peut démarrer un service Windows/démon applicatif). Une fois le démon
  actif, `supabase login` (flux OAuth navigateur, également une action
  humaine) puis `supabase link --project-ref mrzixapnaqsbqmagivvf` donneraient
  un canal local réel pour reproduire 184/185/186 sans toucher la production.
- Pour la chaîne distante : vérifier, côté configuration du serveur MCP
  `postgres` (hors de ce dépôt), que la chaîne de connexion pointe vers le
  bon hôte de pooler pour `mrzixapnaqsbqmagivvf`, et que ce projet Supabase
  n'est pas en pause. C'est une vérification de configuration, pas une
  tentative supplémentaire de connexion depuis cette session (consigne
  respectée : un seul essai fait, pas de répétition).

Aucune des deux voies n'étant disponible aujourd'hui, **C6 (184/185/186) ne
peut pas être exécuté maintenant** — `docs/C6-POST-REVIEW-FIX.md` reste au
verdict `C6_FINAL = BLOCKED` pour la même raison déjà documentée, désormais
avec une cause plus précise qu'un simple "canal indisponible".

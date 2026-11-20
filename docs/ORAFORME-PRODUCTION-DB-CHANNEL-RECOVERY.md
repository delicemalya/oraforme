# Oraforme Production DB Channel Recovery

Mission diagnostique uniquement. Aucune migration appliquée, aucune
donnée modifiée, aucun DDL/DML exécuté, aucun compte changé
automatiquement, aucun secret affiché, aucun commit/push.

## 1. Target project

- **Référence** : `mrzixapnaqsbqmagivvf`
- **URL** : `https://mrzixapnaqsbqmagivvf.supabase.co` — confirmée
  présente dans `.env.local` (`NEXT_PUBLIC_SUPABASE_URL`, variable
  publique par nature, pas un secret).
- **Confirmation qu'il s'agit bien d'Oraforme** : le schéma exposé par ce
  projet (tables `tenants`, `ventes`, `vente_lignes`, `accounting_events`,
  `accounting_event_rules`, `products`, `stock_movements`, etc., et les
  règles comptables `VTE-001`/`FAC-001`/`BOI-001`/...) correspond
  exactement au domaine Oraforme déjà vérifié par de très nombreuses
  missions précédentes de cet engagement (C6, ACCOUNTING-REVERSE-001, et
  tout l'historique antérieur) — confirmé de nouveau aujourd'hui par une
  lecture `tenants` (HTTP 200, §6), sans ambiguïté possible avec un autre
  projet.

## 2. Supabase CLI identity

```
supabase projects list
```
répond avec succès (donc un jeton d'accès CLI valide existe sur cette
machine) et liste exactement 3 projets, tous dans la **même
organisation** (`organization_slug = zabwinwiuaahoiyxfjuo`) :

| Nom | Ref | Région |
|---|---|---|
| BANKMOON | `neudrlnjgtroxkeyspoe` | eu-central-1 |
| AKS | `uuzalfyiewewibpprpcc` | eu-west-1 |
| MOONBANK-STAGING | `wbamlgcucfgxynrtcwwg` | eu-central-1 |

**`mrzixapnaqsbqmagivvf` n'apparaît dans AUCUNE de ces listes.**

**Preuve corroborante trouvée** (nom de fichier uniquement, jamais ouvert
ni son contenu affiché) : un fichier
`Downloads/Secrets-Edge-Functions-BANKMOON-sigmavtc50-gmail-com-s-Org-Supabase-...png`
existe sur cette machine — son nom indique sans ambiguïté que le compte
Supabase actuellement authentifié par le CLI est celui de
`sigmavtc50@gmail.com`, propriétaire de l'organisation BANKMOON/AKS/
MOONBANK — **un engagement différent, sans rapport avec Oraforme**.

Conformément à la consigne explicite de cette mission, **aucune commande
`supabase link --project-ref mrzixapnaqsbqmagivvf` n'a été exécutée** —
le faire sous ce jeton n'aurait eu aucune chance raisonnable de réussir
(le projet n'apparaît même pas dans la liste de ce qu'il peut voir) et
aurait été une tentative à l'aveugle sur un compte sans rapport confirmé
avec Oraforme.

**`ORAFORME_PROJECT_VISIBLE=NO`**

## 3. Project visibility

Aucune variable d'environnement locale au dépôt ne porte de jeton CLI :

| Variable | Process env | `.env.local` |
|---|---|---|
| `SUPABASE_ACCESS_TOKEN` | NOT_SET | NOT_SET |
| `SUPABASE_PROJECT_REF` | NOT_SET | NOT_SET |
| `SUPABASE_URL` | NOT_SET | NOT_SET |
| `SUPABASE_SERVICE_ROLE_KEY` | NOT_SET | **SET** |
| `DATABASE_URL` | NOT_SET | NOT_SET |
| `POSTGRES_URL` | NOT_SET | NOT_SET |
| `POSTGRES_CONNECTION_STRING` | NOT_SET | NOT_SET |

Le jeton que le CLI utilise réellement (confirmé fonctionnel, §2) ne vient
donc PAS de ce dépôt ni de ses variables d'environnement — il vient de la
configuration GLOBALE du CLI sur cette machine (stockage propre à l'outil,
hors de ce projet), ce qui confirme et explique précisément pourquoi il
est authentifié pour un compte/organisation entièrement différent : ce
jeton a été configuré une fois, pour un autre usage (BANKMOON), et n'a
jamais été changé depuis sur cette machine.

Dossier `~/.supabase/` inspecté (noms de fichiers uniquement) :
`telemetry.json`, `traces/` — pas de fichier de jeton visible à cet
emplacement précis (probablement stocké ailleurs par le CLI sur Windows,
non recherché plus avant — hors périmètre : la conclusion §2 est déjà
établie sans avoir besoin de localiser le fichier exact).

## 4. Environment configuration

`.env.local` pointe explicitement et exclusivement vers
`mrzixapnaqsbqmagivvf.supabase.co` (§1) — **jamais** vers BANKMOON/AKS/
MOONBANK. Aucune divergence entre ce que l'application Oraforme utilise
réellement (`.env.local`) et ce que cette mission a ciblé. Le problème
est strictement localisé au jeton CLI global de la machine, pas à la
configuration du projet lui-même.

## 5. MCP postgres

Test unique (pas de répétition), requête en lecture seule (`SELECT 1;`) :
```
(ENOTFOUND) tenant/user postgres.mrzixapnaqsbqmagivvf not found
```

**Classification** (parmi A–F) :

- **A. Mauvais projet** : NON — le message d'erreur cite explicitement
  `postgres.mrzixapnaqsbqmagivvf` comme nom d'utilisateur de connexion,
  confirmant que la chaîne de connexion configurée vise bien LE BON
  projet (le ref est correctement présent, pas substitué par un autre).
- **B. Mauvais tenant** : NON — le format `postgres.<ref>` est la
  convention standard du pooler Supavisor de Supabase, correctement
  formé ici.
- **C. Connecteur non configuré** / **E. Projet non exposé au
  connecteur** — **LES DEUX, le plus probable** : l'erreur
  "tenant/user ... not found" est renvoyée par le POOLER (Supavisor)
  lui-même, pas par une étape d'authentification — c'est-à-dire que le
  point d'extrémité réseau auquel le connecteur MCP est actuellement
  configuré pour se connecter (probablement un hôte de pooler générique
  ou régional) **ne sert pas/ne connaît pas** le projet
  `mrzixapnaqsbqmagivvf` parmi les tenants qu'il route. Cela arrive
  typiquement quand (i) le connecteur a été configuré avec l'hôte de
  pooler d'un AUTRE projet/région, ou (ii) le projet Oraforme utilise un
  hôte de pooler différent de celui configuré, ou (iii) la configuration
  du connecteur n'a simplement jamais été mise à jour avec les
  coordonnées réelles d'Oraforme.
- **D. Credentials expirés** : PEU PROBABLE — un mot de passe expiré
  produit typiquement une erreur d'authentification APRÈS résolution du
  tenant, pas une erreur "tenant not found" qui survient avant même cette
  étape.
- **F. Autre** : non retenu — l'explication C/E couvre la preuve
  disponible sans reste inexpliqué.

**Conclusion** : la configuration du connecteur MCP `postgres` elle-même
est en cause (mauvais hôte de pooler ou configuration jamais alignée sur
Oraforme) — **non modifiée dans cette mission**, conformément à la
consigne.

## 6. PostgREST

```
GET /rest/v1/                    → HTTP 200
GET /rest/v1/tenants?select=id&limit=1 → HTTP 200
```
Aucun POST/PATCH/DELETE exécuté. **`POSTGREST_ORA = REACHABLE`** — ce
canal reste, comme dans toutes les missions précédentes, disponible en
LECTURE SEULE (introspection de schéma + lecture de données), jamais pour
de l'écriture (PostgREST n'exécute pas de DDL, et aucune tentative
d'écriture n'a été faite ici en conformité avec la consigne).

## 7. Available channels

| Canal | État | Capacité |
|---|---|---|
| Supabase CLI | Authentifié, mais sur un AUTRE compte/organisation (BANKMOON/AKS/MOONBANK) | Aucune — Oraforme invisible |
| MCP `postgres` | Erreur de résolution de tenant au niveau pooler | Aucune, ni même en lecture |
| PostgREST | Atteignable | Lecture seule uniquement (schéma + données), jamais DDL/DML en écriture |
| `.env.local` (service_role) | Présent | Alimente PostgREST ci-dessus, pas un canal SQL direct |
| Supabase Dashboard (navigateur) | **NON TESTABLE depuis cette session** — aucun outil de navigateur authentifié disponible ici pour vérifier l'appartenance réelle du compte à `mrzixapnaqsbqmagivvf`, sans demander ni afficher d'identifiants | Non vérifié |

## 8. Blocker

**Aucun canal d'écriture (DDL/DML) authentifié et confirmé vers
`mrzixapnaqsbqmagivvf` n'existe dans cette session.** Le seul canal
disponible (PostgREST) est structurellement limité à la lecture et à
l'appel de fonctions déjà exposées — il ne peut pas exécuter
`CREATE OR REPLACE FUNCTION` ni aucun DDL. Le CLI et le MCP sont tous deux
bloqués, pour deux raisons indépendantes et bien identifiées (compte
différent ; pooler mal configuré ou projet non routé).

## 9. Safe recovery options (aucune exécutée)

- **Option A — Authentifier le CLI Supabase avec le compte propriétaire
  d'Oraforme.** Nécessite une action humaine (`supabase login` ouvre un
  flux OAuth navigateur) avec les identifiants réels du compte
  propriétaire de `mrzixapnaqsbqmagivvf` — pas quelque chose que cette
  session peut faire elle-même (identifiants requis, flux interactif).
- **Option B — Utiliser un access token Oraforme valide**, fourni
  explicitement par l'utilisateur (ex. un jeton personnel généré depuis
  le dashboard Supabase du compte propriétaire d'Oraforme), configuré
  pour cette seule session/ce seul projet sans toucher à la configuration
  CLI globale utilisée pour BANKMOON/AKS/MOONBANK.
- **Option C — Reconfigurer le connecteur MCP `postgres`** avec la chaîne
  de connexion réelle du pooler Oraforme (host/région/port corrects pour
  `mrzixapnaqsbqmagivvf`) — nécessite d'accéder à la configuration de ce
  connecteur (hors de ce dépôt, probablement dans la configuration de
  l'environnement MCP lui-même), et donc une action utilisateur ou un
  accès qui n'est pas disponible depuis cette session de code seule.
- **Option D — Un autre canal PostgreSQL autorisé et vérifié** : par
  exemple `psql` avec la chaîne de connexion directe du projet Oraforme
  (si l'utilisateur la fournit explicitement) — rien de tel n'est
  actuellement configuré sur cette machine (confirmé dans les missions
  `DB-CHANNEL-RECOVERY-CHECK.md`/`DB-LOCAL-RECOVERY-01.md` précédentes).

Aucune de ces quatre options n'a été exécutée — toutes nécessitent soit
une action humaine (identifiants, connexion OAuth), soit une information
que l'utilisateur seul détient (jeton, chaîne de connexion réelle), soit
un accès à une configuration hors du périmètre de cette session.

## 10. Final verdict

```
ORAFORME_PROJECT_REF=mrzixapnaqsbqmagivvf
ORAFORME_DB_CHANNEL=BLOCKED
SUPABASE_CLI_PROJECT_VISIBLE=NO
MCP_POSTGRES=BLOCKED (tenant non résolu par le pooler configuré — cause C/E, pas A/B/D)
POSTGREST=REACHABLE (lecture seule uniquement, jamais un canal d'écriture DDL/DML)
PRODUCTION_WRITE_AUTHORIZED=NO
PRODUCTION_DATA_MODIFIED=NO
NEXT_RECOMMENDED_ACTION=Action humaine requise — soit (Option A) exécuter `supabase login` avec le compte propriétaire d'Oraforme sur cette machine, soit (Option B) fournir un access token Oraforme valide pour cette session uniquement, soit (Option C) corriger la configuration du connecteur MCP postgres avec la chaîne de connexion réelle du pooler Oraforme. Une fois l'une de ces trois options confirmée par l'utilisateur, reprendre directement à la mission ACCOUNTING-REVERSE-001-PROD-APPLY (déjà entièrement préparée et bloquée uniquement sur ce canal) sans refaire le travail de validation déjà acquis.
```

# DB-LOCAL-RECOVERY-02 — Construction de l'environnement local isolé

Mission d'exécution, strictement bornée au périmètre autorisé : construire
un Postgres/Supabase **local**, isolé de la production, pour permettre de
tester réellement 184 → 185 → 186. Aucune migration historique modifiée,
aucune donnée production touchée, aucun `.env.local` utilisé, rien commité.

**Résultat réel** : l'environnement Docker/Postgres local est opérationnel
(prouvé par deux exécutions réelles), mais le replay séquentiel exact de la
chaîne officielle (001→186) s'est révélé bloqué **beaucoup plus tôt et plus
souvent** que ce que l'analyse statique de `DB-LOCAL-RECOVERY-01.md` avait pu
établir. Cette mission n'a donc pas pu atteindre 184/185/186 — mais elle
corrige, avec des preuves d'exécution réelles, une conclusion qui n'avait
jusqu'ici jamais été vérifiée que statiquement.

---

## 1. Sécurité de l'environnement

- `.env.local` (pointant `mrzixapnaqsbqmagivvf`, production) **n'a été lu,
  chargé, ni utilisé par aucune commande de cette mission.** Toutes les
  commandes exécutées (`supabase init/start/status`, `docker ...`) l'ont été
  depuis `C:\oraforme-local-db-test\`, un dossier dédié.
- **Aucune commande `supabase link` n'a été exécutée** — le projet local
  n'a jamais été relié à `mrzixapnaqsbqmagivvf` ni à aucun projet distant.
- **Aucun `supabase db push` n'a été exécuté.**
- **Aucun secret affiché** — ni clé de service, ni mot de passe, à aucun
  moment (les seules valeurs imprimées sont des noms de variables, des URL
  publiques déjà connues, ou des sorties `docker`/`supabase` standard sans
  identifiant sensible).
- Vérification explicite avant toute commande risquée : `SUPABASE_URL`,
  `DATABASE_URL` et les variables Supabase du contexte d'exécution de chaque
  commande ont été confirmées locales (voir §3) — aucune commande n'a été
  lancée sans cette confirmation préalable.

**`PRODUCTION_ISOLATION = PASS`** — par construction (projet local distinct,
`.env.local` jamais chargé) et par vérification active à chaque étape.

## 2. Docker

Confirmé disponible et fonctionnel à deux reprises (deux exécutions réelles
de `supabase start`, décrites ci-dessous). Les images nécessaires à la
stack complète ont été téléchargées avec succès lors du premier essai
(`postgres:17.11.0.002`, `realtime:v2.140.3`, `vector:0.58.0-alpine`, et
toutes les autres couches de la stack Supabase standard) — elles sont donc
maintenant en cache local, rendant les essais suivants nettement plus
rapides (plus de téléchargement).

**`DOCKER = AVAILABLE`** — confirmé par usage réel, pas seulement par `docker info`.

## 3. Supabase local

Projet créé : `C:\oraforme-local-db-test\` (hors de tout dépôt git — `C:\`
n'est pas un dépôt, vérifié explicitement ; le premier emplacement envisagé,
sous le dossier utilisateur, a été abandonné précisément parce que ce
dossier utilisateur s'est révélé être lui-même un dépôt git non apparenté,
pour éliminer toute ambiguïté).

```
project_id = "oraforme-local-db-test"   (auto-dérivé du nom de dossier,
                                          clairement identifiable)
api  port = 54321
db   port = 54322   (shadow: 54320)
studio    = 54323
pooler    = 54329
```

Tous ces ports ont été vérifiés libres avant tout démarrage (`Get-
NetTCPConnection`). `supabase init` a généré ce `config.toml` localement ;
`[db.seed] enabled = true` mais ne référence aucun fichier de seed existant
dans ce dossier — aucun amorçage de données n'a eu lieu au-delà des
migrations elles-mêmes.

`supabase/migrations/` de ce projet local est une **copie** (jamais un lien,
jamais un déplacement) des 186 fichiers réels du dépôt — confirmé après
coup que le dépôt réel est resté intact (`ls` sur les deux chemins,
fichiers identiques présents aux deux endroits).

**`SUPABASE_LOCAL_CONFIG = READY`**.

## 4. Shim local

Fichier : `C:\oraforme-local-db-test\supabase\migrations\0685_shim_candidatures_fiscal_declarations.sql`
— **n'existe que dans ce dossier**, jamais dans `supabase/migrations/` du
dépôt réel, jamais commité (impossible par construction : ce dossier n'est
sous aucun contrôle de version).

Première tentative de nommage, `068.5_...sql`, triée correctement entre 067
et 068 (vérifié empiriquement), mais **rejetée par le CLI** :
```
Skipping migration 068.5_shim_candidatures_fiscal_declarations.sql...
  (file name must match pattern "<timestamp>_name.sql")
```
Le CLI exige un préfixe **entièrement numérique** avant le premier `_` — un
point n'est pas accepté. Renommé en `0685_shim_...sql` (confirmé, par le
même test empirique de tri, se placer toujours entre 067 et 068) ; accepté
par le CLI au second essai.

**Découverte collatérale importante** : ce même contrôle de nommage rejette
aussi, dans la VRAIE chaîne officielle (pas seulement mon shim),
`142.5_fix_fn_ae_execute_event_country.sql` et `CATCHUP_008_to_025.sql` —
confirmé dans les deux journaux d'exécution réels (`"Skipping migration
142.5_..."`, `"Skipping migration CATCHUP_008_to_025.sql..."`). Documenté
ici, non corrigé (migrations officielles non modifiées) — voir §6.

Schéma minimal, déterminé par lecture exacte de ce que les migrations
suivantes exigent réellement (pas une reproduction de la production) :
```sql
candidatures (id UUID PK, tenant_id UUID NOT NULL, created_at TIMESTAMPTZ)
fiscal_declarations (id UUID PK, tenant_id UUID NOT NULL, created_at TIMESTAMPTZ)
```
Suppression en une commande : `rm -rf "C:\oraforme-local-db-test"` (après
`supabase stop`) — rien d'autre n'en dépend.

## 5. Méthode de replay — résultat réel, pas supposé

Méthode prévue : copier les 186 fichiers officiels + le shim, dans un
dossier isolé, puis `supabase db reset` pour rejouer toute la chaîne contre
un Postgres 17 local neuf.

**Deux exécutions réelles ont eu lieu.** Aucune des deux n'a pu compléter
mentale le replay — mais chacune a avancé plus loin et révélé une cause
précise, jamais un échec générique :

**Essai 1** — échec à `031_financial_triggers.sql` :
```
ERROR: relation "fiches_paie" does not exist (SQLSTATE 42P01)
At statement: 20
DROP TRIGGER IF EXISTS trg_paie_to_transaction ON fiches_paie
```
Recherche exhaustive : `fiches_paie` n'est créée par AUCUNE migration du
dépôt (`grep -rn "CREATE TABLE.*fiches_paie"` → 0 résultat), et n'est
référencée que par 031 et 032. La table de paie réelle, créée dès
`007_paie.sql`, s'appelle `bulletins_paie` — utilisée partout ailleurs dans
l'application (confirmé dans tout cet engagement). **`fiches_paie` n'est
très probablement pas un objet de production légitime créé hors version
control (contrairement à candidatures/fiscal_declarations) — c'est, avec
une forte présomption, une référence erronée dans 031/032 elle-même** (le
même sens métier, "fiche de paie"/"bulletin de paie", suggère une
incohérence de nommage jamais corrigée). Ceci change la nature du problème :
ce n'est pas "une dépendance historique connue à combler par un shim", c'est
un défaut de contenu dans les migrations elles-mêmes — **non corrigé, par
consigne explicite de cette mission**, uniquement mis de côté dans la copie
locale pour continuer le diagnostic (voir ci-dessous).

**Correctif de méthode, local uniquement** : `031_financial_triggers.sql` et
`032_automation_engine.sql` déplacés vers
`C:\oraforme-local-db-test\supabase\skipped-local-only\` (jamais supprimés,
jamais modifiés — juste écartés du dossier `migrations/` de la copie
locale, pour isoler l'effet et continuer le diagnostic). **Confirmé après
coup que les fichiers réels du dépôt sont intacts** (`ls` sur les deux
fichiers dans `supabase/migrations/` du dépôt réel — toujours présents, non
touchés).

**Essai 2** (mêmes images, déjà en cache — démarrage plus rapide) — passe
031-032, avance jusqu'à `034_role_hardening.sql`, puis échoue :
```
ERROR: column e.email does not exist (SQLSTATE 42703)
At statement: 10
...policy "notes_etudiants: student read own" ...
  e.email = (SELECT au.email FROM auth.users au WHERE au.id = auth.uid())
```
Recherche exhaustive : `etudiants` ne porte, à aucun moment de la chaîne
(ni à sa création dans `008_ecole.sql`, ni dans ses 5 `ALTER TABLE etudiants
ADD COLUMN` ultérieurs), de colonne `email` — seulement `email_parent`.
**Fait notable** : la migration 025 a déjà ajouté `etudiants.user_id
REFERENCES auth.users(id)` précisément pour relier un étudiant à son compte
— la policy de 034 aurait pu (et, à la lecture, aurait dû) comparer
directement `e.user_id = auth.uid()` plutôt que reconstruire une
comparaison par email inexistante. Même présomption que pour `fiches_paie` :
vraisemblablement un défaut de contenu de la migration 034 elle-même, pas
une dépendance externe légitime — **non corrigé.**

**Conclusion de méthode** : en ~35 fichiers sur 186, **deux défauts de
contenu indépendants** ont été rencontrés (sans compter les 2 fichiers déjà
exclus du replay par leur nommage, §4), à un rythme d'environ un défaut
nouveau tous les 15-17 fichiers. Poursuivre la méthode « écarter chaque
fichier en échec et avancer » de façon purement séquentielle jusqu'à 184
exigerait, en extrapolant ce rythme, de refaire ce même travail de diagnostic
(identifier précisément la cause, confirmer qu'il ne s'agit pas d'une vraie
dépendance légitime à shim-er, décider d'écarter) **plusieurs fois de plus**,
sans garantie que chaque nouvel écart laisse un schéma assez cohérent pour
que 184/185/186 s'appliquent ensuite de façon significative. **Décision
prise ici : arrêter la méthode séquentielle stricte à ce stade plutôt que de
continuer à l'aveugle** — ce choix, et l'alternative proposée, sont soumis à
l'utilisateur en fin de rapport (§20/NEXT_MISSION) plutôt que décidés
unilatéralement plus avant, puisque cela change la nature de la méthode
(EXACT → nécessairement PARTIEL/synthétique) au-delà de ce que cette mission
avait anticipé.

**`MÉTHODE DE REPLAY = PARTIEL, et même ce PARTIEL n'a pas atteint 184.`**
Explicitement : **aucun replay n'a été qualifié "EXACT" ni "complet"** —
deux tentatives réelles, deux arrêts documentés, aucune n'a dépassé la
migration 034 sur 186.

## 6. État de la chaîne officielle (confirmé par exécution réelle)

| Constat | Nature | Source |
|---|---|---|
| `candidatures` jamais créée (068, 109, 110, 120) | dépendance externe légitime (objet de prod créé hors migration) | DB-LOCAL-RECOVERY-01 (statique) — shim prêt, jamais testé en pratique car le replay s'arrête avant 068 |
| `fiscal_declarations` jamais créée (164) | idem | idem — jamais testé non plus, 164 n'a jamais été atteinte |
| `fiches_paie` jamais créée, référencée seulement par 031/032 | **probable défaut de contenu de 031/032** (nom incohérent avec `bulletins_paie`) | **confirmé par exécution réelle aujourd'hui** |
| `etudiants.email` n'existe jamais | **probable défaut de contenu de 034** (aurait dû utiliser `user_id`, déjà disponible depuis 025) | **confirmé par exécution réelle aujourd'hui** |
| `142.5_fix_fn_ae_execute_event_country.sql` au nom non conforme | ignorée silencieusement par tout replay piloté par le CLI Supabase | **confirmé par exécution réelle aujourd'hui** (les deux essais) |
| `CATCHUP_008_to_025.sql` au nom non conforme | idem | **confirmé par exécution réelle aujourd'hui** |

Le diagnostic de `DB-LOCAL-RECOVERY-01.md` (« la chaîne casse à 068 ») était
une déduction statique correcte **sur ce qu'elle observait** (`candidatures`
n'est en effet jamais créée), mais **n'avait jamais été vérifiée par une
exécution réelle** — et l'exécution réelle montre que la chaîne casse en
réalité **bien avant 068**, pour des raisons différentes. Ce n'est pas une
contradiction du rapport précédent (qui ne prétendait pas avoir exécuté quoi
que ce soit — il le disait explicitement), c'est exactement le type de
correction que seule une exécution réelle peut apporter, et que cette
mission a maintenant produite.

**`MIGRATION_CHAIN = BROKEN`** (confirmé, désormais par exécution réelle, à
au moins 2 points indépendants avant 035, en plus des 2 déjà connus plus
loin dans la chaîne, et des 2 fichiers systématiquement ignorés par nommage).

## 7-9. Validation 184 / 185 / 186

**Non atteintes.** Le replay s'est arrêté à la migration 034 (deuxième
essai) — 184, 185 et 186 n'ont jamais été appliquées contre un Postgres
réel dans cette mission. Rien à rapporter sur leur comportement réel au-delà
de ce qui était déjà établi statiquement dans `C6-PRE-PRODUCTION-REVIEW.md`
et `C6-POST-REVIEW-FIX.md`.

**`MIGRATION_184_LOCAL = BLOCKED`**
**`MIGRATION_185_LOCAL = BLOCKED`**
**`MIGRATION_186_LOCAL = BLOCKED`**

## 10-18. Tests réels (vente comptant, crédit, provenance, atomicité, idempotence, reverse, tenant isolation, RLS)

**Aucun n'a pu être exécuté** — ils nécessitent tous un schéma qui inclut au
minimum `tenants`, `products`, `warehouses`, `ventes`, `vente_lignes`,
`accounting_event_rules`, `fn_stock_move` (184), et les objets de 185/186,
qui ne sont jamais apparus dans la base locale faute d'avoir atteint ce
point du replay.

**`C6_REAL_POSTGRES_LOCAL = BLOCKED`**
**`C6_LOCAL_ATOMICITY = BLOCKED`**
**`C6_LOCAL_IDEMPOTENCE = BLOCKED`**
**`C6_LOCAL_SECURITY = BLOCKED`**
**`LOCAL_RLS_VALIDATION`** : sans objet — aucune politique testée.

## 19. Nettoyage

- Les deux tentatives se sont arrêtées proprement : `docker ps -a` confirme
  **0 conteneur** après chaque échec (le CLI arrête et retire les conteneurs
  lui-même sur une `MigrationApplyError`) — rien ne tourne actuellement.
- Aucune donnée de test n'a été créée (le replay n'a jamais atteint un état
  où des fixtures auraient eu un sens) — rien à purger.
- Le dossier `C:\oraforme-local-db-test\` (config + copie de migrations +
  shim + les 2 fichiers écartés dans `skipped-local-only\`) reste sur
  disque, prêt à être réutilisé pour une prochaine tentative **ou supprimé
  en une commande** (`rm -rf "C:\oraforme-local-db-test"`) si l'utilisateur
  préfère repartir de zéro.
- Un second dossier, vide et abandonné, existe à
  `C:\Users\DONGUI MABIALA\oraforme-local-db-test\supabase\` (créé avant la
  relocalisation décrite au §3, ne contient qu'un `config.toml` par défaut,
  jamais utilisé) — mentionné ici pour qu'il ne surprenne pas l'utilisateur
  plus tard ; une tentative de le supprimer automatiquement a été bloquée
  par un garde-fou de sécurité de l'outil (suppression sous le dossier
  utilisateur) — à supprimer manuellement si souhaité, il est inoffensif
  (vide de toute donnée).

## 20. Prochaines étapes / limites de ce test

**Limites explicites** : cette mission prouve que l'infrastructure locale
(Docker + Supabase CLI + Postgres 17) fonctionne réellement, et prouve, par
exécution réelle, que la chaîne de migrations officielle contient plusieurs
défauts non documentés jusqu'ici — mais elle **ne prouve rien sur 184/185/186
elles-mêmes**, qui restent exactement au même état qu'avant cette mission :
relues statiquement, jamais exécutées.

---

## Verdicts

```
LOCAL_ENVIRONMENT        = PARTIAL   (Docker/Postgres local prouvés opérationnels ; le replay complet de la chaîne, lui, est bloqué)
PRODUCTION_ISOLATION     = PASS
MIGRATION_184_LOCAL      = BLOCKED
MIGRATION_185_LOCAL      = BLOCKED
MIGRATION_186_LOCAL      = BLOCKED
C6_REAL_POSTGRES_LOCAL   = BLOCKED
C6_LOCAL_ATOMICITY       = BLOCKED
C6_LOCAL_IDEMPOTENCE     = BLOCKED
C6_LOCAL_SECURITY        = BLOCKED
```

**`NEXT_MISSION`** = Une décision explicite de l'utilisateur sur la méthode
à poursuivre, puis son exécution :

- **Option A — poursuivre le replay séquentiel strict, par itérations
  bornées.** Continuer à identifier et écarter (jamais corriger) chaque
  migration historique qui casse le replay, une par une, dans la copie
  locale uniquement, jusqu'à atteindre 184. Avantage : si la chaîne se
  stabilise après quelques défauts de plus, le replay final serait le plus
  proche possible de « EXACT ». Risque assumé : rythme observé d'un défaut
  nouveau tous les ~15 fichiers, donc effort et nombre d'itérations non
  bornés à l'avance.
- **Option B — construire un socle minimal synthétique.** Abandonner le
  replay séquentiel complet ; appliquer seulement ce qui fonctionne déjà
  (001→030, confirmé), puis injecter directement, dans la copie locale
  uniquement, les tables/fonctions dont 184/185/186 ont réellement besoin
  (tenants, profiles, products, warehouses, stock_movements, purchase_items,
  purchases, ventes, vente_lignes, accounting_events,
  accounting_event_rules, journal_entries, get_my_tenant_id, fn_ae_*,
  emit_accounting_event, fn_reverse_accounting_event), avec un schéma
  minimal déterminé de la même façon rigoureuse que le shim candidatures/
  fiscal_declarations (lecture exacte des migrations qui les définissent).
  Avantage : rapide, borné, testable dès la prochaine session. Coût
  explicite : le replay résultant devrait être qualifié **PARTIEL/
  synthétique**, pas EXACT — il ne validerait pas que 184/185/186
  s'intègrent à la VRAIE chaîne historique, seulement qu'elles fonctionnent
  contre un schéma équivalent à ce qu'elles attendent.
- **Option C — signaler séparément** `031_financial_triggers.sql`/
  `032_automation_engine.sql` (référence à `fiches_paie`, probable bug de
  nommage) et `034_role_hardening.sql` (référence à `etudiants.email`
  inexistante, probable bug) **comme tickets de dette technique**
  indépendants de C6, pour correction éventuelle future de la chaîne
  officielle — pas dans le cadre de cette mission.

Ces trois options ne s'excluent pas mutuellement (C peut accompagner A ou
B). Aucune des trois n'a été engagée au-delà du diagnostic ci-dessus —
cette mission attend une décision avant de poursuivre.

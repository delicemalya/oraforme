# DB-LOCAL-C6-HARNESS — Replay PostgreSQL ciblé et fidèle pour 184/185/186

**Ce rapport documente un `C6_TARGETED_POSTGRES_REPLAY`, PAS un
`FULL_MIGRATION_REPLAY`.** Il ne prouve pas que les migrations historiques
001-183 sont rejouables de zéro (elles ne le sont pas — voir
`docs/TECH-DEBT-MIGRATION-CHAIN.md`). Il prouve, ou ne prouve pas selon les
cas, le comportement réel de 184/185/186 contre un socle minimal
construit à partir de sources vérifiées (migrations existantes + code +
introspection production en lecture seule), jamais devinées.

Aucune migration historique modifiée. Aucun contenu de 184/185/186 modifié
pour faire passer ce harness. Aucune donnée production lue au-delà d'une
introspection de schéma en lecture seule (`information_schema`/OpenAPI).
Aucune connexion écriture à la production. Aucun commit/push.

## 1. Objectif

Déterminer, par exécution réelle contre un PostgreSQL 17 local isolé, si
184 → 185 → 186 s'appliquent et se comportent comme conçu — sans rejouer la
chaîne historique complète (abandonnée dans `DB-LOCAL-RECOVERY-02.md`, trop
de défauts indépendants découverts pour un effort borné).

## 2. Limites (posées avant tout résultat)

- Ce harness construit un socle SYNTHÉTIQUE pour ce que 184/185/186
  attendent déjà présent — pas un replay de 001 à 183.
- Toute propriété "prouvée ici" l'est contre CE socle, pas contre l'état
  réel actuel de production (qui peut diverger — documenté explicitement
  à chaque fois qu'une divergence a été trouvée, jamais choisie en silence).
- Un résultat PASS ici signifie "PostgreSQL réel, chemin réel, socle fidèle
  et sourcé" — jamais "migration chain fixed", "production safe", ou "C6
  production ready". Formulation retenue si et seulement si les tests
  passent : **"C6 PostgreSQL local targeted replay validated"** — jamais
  plus.

## 3. Dette migration historique

Documentée séparément : `docs/TECH-DEBT-MIGRATION-CHAIN.md`
(TD-MIG-031-032, TD-MIG-034, TD-MIG-068, TD-MIG-164, TD-MIG-1425-NAMING,
TD-MIG-CATCHUP-NAMING). Aucune de ces six n'affecte directement 184/185/186
EXCEPTÉ 142.5 (voir §7) — confirmé par l'analyse de dépendance ci-dessous.

## 4. Graphe de dépendances

```
184 (stock_provenance)
  → stock_movements (016)            [ALTER : origine, purchase_item_id]
  → purchase_items, purchases (016)  [lues par le nouveau garde-fou B1]
  → fn_stock_sign (173)              [appelée par fn_stock_move]
  → warehouses, products (016)       [FK existantes, non modifiées]

185 (vente_canonique)
  → ventes, vente_lignes (100)       [ALTER : montant_ht/tva/ca/statut_paiement/destinataire/idempotency_key]
  → accounting_event_rules (138)     [INSERT des 7+1 règles VTE]
  → AUCUNE dépendance SQL directe sur 184 (confirmé par son propre en-tête)

186 (vente_atomic_et_reverse_idempotent)
  → stock_movements.{origine,purchase_item_id} (184)   [requis]
  → fn_stock_move à 10 paramètres (184)                [DROP+CREATE vers 11]
  → ventes.{montant_ht,...,idempotency_key} (185)      [INSERT dans fn_create_vente_atomique]
  → accounting_event_rules via emit_accounting_event   [VTE-001/002 doivent résoudre]
  → emit_accounting_event, fn_ae_execute_event, trg_process_accounting_event,
    fn_ae_get_applicable_rules, fn_ae_eval_conditions,
    fn_ae_resolve_amount_formula, fn_ae_resolve_montant, fn_ae_resolve_libelle,
    fn_ae_resolve_treasury, fn_ohada_cash_account, fn_ae_category (138/135/142.5/175)
  → accounting_events, accounting_event_log (138)      [écrits par fn_ae_execute_event]
  → journal_entries (026)                              [écrit par fn_ae_execute_event]
  → transactions (014+021+049+CATCHUP+PRODUCTION)      [écrit par fn_ae_execute_event, séquences treasury_*]
  → entreprise_config (010)                            [lu pour résoudre le pays]
  → fn_reverse_accounting_event (138)                  [utilisé par /reverse]

Union (184 ∪ 185 ∪ 186) = le contenu de 001_c6_baseline.sql (§9).
```

## 5. Objets nécessaires

Liste complète dans `001_c6_baseline.sql` : `tenants`, `profiles`,
`get_my_tenant_id()`, `products`, `warehouses`, `suppliers`, `purchases`,
`purchase_items`, `stock_movements` (version pré-184), `fn_stock_sign`,
`ventes`/`vente_lignes` (version pré-185), `entreprise_config`,
`accounting_fiscal_params`, `accounting_events`, `accounting_event_rules`,
`accounting_event_log`, `accounting_event_extournes`, `journal_entries`,
`transactions`, et les 13 fonctions du moteur comptable + le trigger.
Aucune table arbitraire ajoutée (ex. `clients`, `tenant_modules` : jamais
lues par 184/185/186, donc absentes).

## 6. Sources de chaque objet

Voir les commentaires `SOURCE:` dans `001_c6_baseline.sql` lui-même, un par
objet. Résumé par provenance :

| Provenance | Objets |
|---|---|
| Migration 001 | tenants (sous-ensemble), profiles (sous-ensemble) |
| Migration 010 | entreprise_config |
| Migration 014+021+049 | transactions (socle partiel) |
| Migration 016 | products, warehouses, suppliers, purchases, purchase_items, stock_movements (pré-184) |
| Migration 026 | journal_entries (socle) |
| Migration 100 | ventes, vente_lignes (pré-185) |
| Migration 118 | get_my_tenant_id() |
| Migration 135 | fn_ohada_cash_account (dernière version) |
| Migration 138 | accounting_fiscal_params, accounting_events, accounting_event_rules, accounting_event_log, accounting_event_extournes, fn_ae_resolve_montant, fn_ae_eval_conditions, fn_ae_resolve_amount_formula, fn_ae_resolve_libelle, fn_ae_resolve_treasury, fn_ae_get_applicable_rules, fn_ae_has_treasury_impact, fn_ae_is_income, fn_ae_category, fn_process_accounting_event + trigger, emit_accounting_event, fn_reverse_accounting_event |
| Migration 173 | fn_stock_sign |
| Migration 142.5 + 175 | fn_ae_execute_event (version finale réellement appliquée) |
| **Introspection production (lecture seule, aujourd'hui)** | **profiles.created_at**, **journal_entries** (colonnes analytiques), **transactions.fiscal_year/debit_account/credit_account/cost_center_id/reference_piece** — divergences documentées, jamais choisies en silence |
| **Stub justifié (pas une source externe)** | fn_sync_tresorerie_soldes — appel entouré d'un bloc EXCEPTION WHEN OTHERS THEN NULL dans fn_ae_execute_event, donc sans effet sur VTE-001/002 quelle que soit son implémentation réelle |

Aucune divergence production non documentée : la seule divergence
matérielle trouvée (`transactions.fiscal_year` et colonnes voisines) est
discutée en détail au §7 et dans le corps du fichier `001_c6_baseline.sql`.

## 7. 142.5 — analyse approfondie

**Pourquoi elle a été créée** : son propre en-tête (`142.5_fix_fn_ae_execute
_event_country.sql`) : `fn_ae_execute_event` (migration 138) référençait
`entreprise_config.config->>'country_code'`, colonne qui n'a jamais existé
(la vraie colonne est `pays`, TEXT). Conséquence documentée par 142.5
elle-même : **tout `emit_accounting_event()` échouait silencieusement depuis
le déploiement de 138** — aucun `journal_entries` n'était créé par le moteur
avant ce correctif.

**Migrations suivantes qui en dépendent** : toute migration qui insère des
`accounting_event_rules` et compte sur le moteur pour les exécuter — ce qui
inclut 185 (VTE-001/002) et, transitivement, 186 (`fn_create_vente_atomique`
appelle `emit_accounting_event`, qui déclenche `fn_ae_execute_event` via le
trigger).

**185/186 supposent-elles son comportement ?** Oui, directement : aucune
écriture `journal_entries` ne serait jamais créée pour VTE-001/002 sans ce
correctif (le pays ne se résoudrait jamais correctement, et l'ancienne
version plantait purement et simplement sur `ec.config`).

**La version de production correspond-elle à cette définition ?** Pas
exactement 142.5 seule — **175** (`175_treasury_impact_from_rules.sql`)
remplace à nouveau `fn_ae_execute_event` ENTIÈREMENT, en conservant le
correctif pays de 142.5 (confirmé par lecture ligne à ligne : le bloc
`v_country := COALESCE(..., ec.pays, ...)` de 175 est identique à celui de
142.5) et en changeant la logique de ligne `transactions` (par règle
appliquée, pas par liste de modules). **175 est donc la seule version
jamais réellement "vivante" en production qui combine les deux correctifs**
— c'est elle qui a été intégrée dans `001_c6_baseline.sql`, pas 138 seule ni
142.5 seule.

**Intégrée dans le harness ?** Oui, explicitement — PAS ignorée parce que
le CLI l'ignore (voir TD-MIG-1425-NAMING). Le corps exact de 175 (qui inclut
déjà 142.5) est reproduit dans `001_c6_baseline.sql`.

## 8. CATCHUP_008_to_025

Analyse de contenu : la migration ajoute/complète des tables du domaine
école (`etudiants`, `frais_scolaires`, etc.) et des colonnes sur
`transactions` (`source`, `source_id`, `label`, `account_id`) déjà couvertes
par ailleurs (021, 049) de façon idempotente. Aucune ligne de ce fichier ne
touche `products`, `warehouses`, `stock_movements`, `purchases`,
`purchase_items`, `ventes`, `vente_lignes`, `accounting_event_rules`,
`accounting_events`, `journal_entries`, ou une quelconque fonction du moteur
comptable.

**`CATCHUP_REQUIRED_FOR_C6 = NO`** — non intégrée au harness, aucune perte
de fidélité pour 184/185/186.

## 9. Harness — construction

- `C:\oraforme-c6-harness\` — hors de tout dépôt git (même précaution que
  `DB-LOCAL-RECOVERY-02` : vérifié que `C:\` n'est pas un dépôt).
- `supabase/migrations/001_c6_baseline.sql` — le socle (§5/§6), écrit une
  seule fois, jamais modifié depuis.
- `supabase/migrations/184_stock_provenance.sql`,
  `185_vente_canonique.sql`, `186_vente_atomic_et_reverse_idempotent.sql` —
  **copies strictement identiques** des fichiers réels du dépôt (vérifié par
  `diff`, aucune sortie = fichiers identiques).
- `project_id = "oraforme-c6-harness"` (auto-dérivé, clairement
  identifiable), ports standards (54321-54329, confirmés libres avant tout
  démarrage).
- Images Docker déjà en cache depuis les missions précédentes — démarrage
  rapide (moins de 2 minutes), stack complète démarrée et saine (`docker ps`:
  12 conteneurs `Up`/`healthy`, dont `supabase_db_oraforme-c6-harness` sur le
  port 54322).

## 10. Migration 184 — PROUVÉ PAR POSTGRESQL RÉEL

Appliquée seule (185/186 temporairement écartés du dossier du harness —
**jamais modifiés, seulement déplacés hors du dossier `migrations/` de cette
copie locale**, pour isoler le test) contre le socle : **succès, zéro
erreur**. Conteneurs confirmés sains après coup (`docker ps`).

Tests réels exécutés via `docker exec -i supabase_db_oraforme-c6-harness
psql` (fixtures : tenant TEST-A, TEST-B ; produit, entrepôt, fournisseurs,
achats/lignes d'achat de test — aucune donnée production) :

| Scénario | Résultat réel |
|---|---|
| 100 achat_fournisseur + 100 production_locale | 2 mouvements `entree`, acceptés |
| Vente 30 depuis achat_fournisseur | accepté, **70 restant** confirmé par `v_products_stock_par_origine` |
| Vente 20 depuis production_locale | accepté, **80 restant** confirmé |
| Vente 81 depuis production_locale (80 disponible) | **REJETÉ** : `23514 — Stock insuffisant pour la provenance production_locale : 80.000 disponible, 81 demandé` |
| Origine invalide (`origine_invalide`) | **REJETÉ** : `23514 — Origine inconnue : origine_invalide` |
| `purchase_item_id` d'un AUTRE tenant (B1) | **REJETÉ** : `42501 — purchase_item_id 88888888-... introuvable pour ce tenant` — **le correctif B1 de C6-POST-REVIEW-FIX fonctionne réellement contre Postgres, pas seulement en mock** |
| Appel historique sans `p_origine`/`p_purchase_item_id` (rétrocompatibilité) | accepté, mouvement enregistré avec `origine=NULL` — aucune régression |
| `v_products_stock_par_origine` | retourne exactement `{achat_fournisseur: 70, production_locale: 80}` |

**`C6_184_REAL_POSTGRES = PASS`** — chaque propriété revue statiquement
dans `C6-PRE-PRODUCTION-REVIEW.md`/`C6-POST-REVIEW-FIX.md` est maintenant
confirmée par exécution réelle contre PostgreSQL 17, pas seulement par
lecture de code.

## 11. Migration 185 — ÉCHEC RÉEL, ANOMALIE DÉCOUVERTE

**Résultat réel** (socle + 184 + 185, dans cet ordre, fichier non modifié) :
```
ERROR: null value in column "debit_account" of relation "accounting_event_rules"
violates not-null constraint (SQLSTATE 23502)
At statement: 9
-- Séquence 1 — Revenu, comptant (resolver treasury_debit, identique à BOI-001)
INSERT INTO accounting_event_rules (...) VALUES (
  'VTE-001', 1, 1, 'active',
  NULL, '701',
  ...
```

**Cause précise** : `accounting_event_rules.debit_account` est `NOT NULL`
(migration 138, confirmé). Les 4 séquences de 185 qui utilisent le resolver
`treasury_debit` (VTE-001 séq.1/2/3, VTE-002 séq.1) stockent littéralement
`NULL` pour `debit_account` plutôt qu'une valeur placeholder.

**C'est une anomalie de 185 elle-même, pas une lacune du socle** — confirmé
par le précédent déjà existant et fonctionnel dans ce même dépôt :
`139_accounting_rules_facturation.sql` (FAC-002, séquence 1, resolver
`treasury_debit` lui aussi) stocke `'521'` comme `debit_account`, avec le
commentaire **"Banques — valeur par défaut, remplacée par
account_resolver"** — c'est-à-dire que la valeur stockée n'a jamais
d'importance à l'exécution (`fn_ae_execute_event` l'écrase systématiquement
quand `account_resolver='treasury_debit'`), mais la contrainte NOT NULL de
la table exige qu'UNE valeur, quelconque, soit présente. 185 omet ce
placeholder — défaut qui n'avait jamais pu être détecté avant cette mission
car 185 n'avait jamais été exécutée contre un Postgres réel
(`C6-PRE-PRODUCTION-REVIEW.md §2` l'avait qualifiée `PASS` sur la seule base
d'une lecture statique du moteur — cette lecture était juste sur le
MÉCANISME du moteur, mais ne pouvait pas détecter une violation de
contrainte NOT NULL sans exécution réelle).

**Suite de la mission** : conformément à la consigne explicite ("si une
migration échoue : STOP, ne pas bricoler"), 185 n'a PAS été modifiée dans
cette mission. 186 n'a pas pu être testée (elle dépend des colonnes que 185
devait ajouter à `ventes`, jamais appliquées puisque 185 a échoué et que
toute la migration est dans un seul `BEGIN...COMMIT` annulé en bloc).

**`C6_185_REAL_POSTGRES = BLOCKED`** (pas PARTIAL : zéro ligne de 185 n'a
été appliquée, le `BEGIN...COMMIT` annule tout).

**Correction future proposée** (non appliquée ici, `184/185/186` non
modifiables dans cette mission) : remplacer `NULL` par un placeholder
cohérent (ex. `'521'`, comme FAC-002) pour `debit_account` sur les 4 lignes
concernées de 185. Le changement est mécanique et sans risque métier (la
valeur stockée n'est jamais lue à l'exécution pour ces séquences) mais DOIT
être fait dans une mission qui a l'autorisation explicite de modifier 185.

## 12. Migration 186 — NON TESTÉE

Bloquée par 185 (§11). Son propre contenu statique reste inchangé par
rapport à `C6-POST-REVIEW-FIX.md` (non re-revu ici, aucune nouvelle lecture
n'a changé sa correction). `fn_create_vente_atomique` et
`reversed_movement_id` restent donc dans l'état : **corrigés en code,
jamais exécutés contre un Postgres réel.**

**`C6_186_REAL_POSTGRES = BLOCKED`**.

## 13-17. Comptant / Crédit / Atomicité / Idempotence / Reverse

**Tous bloqués** — ces scénarios nécessitent les colonnes et règles ajoutées
par 185 (`ventes.montant_ht/idempotency_key`, les règles VTE-001/002) et la
fonction de 186 (`fn_create_vente_atomique`), aucune des deux n'ayant pu
être appliquée (§11/§12). Aucun test de ces sections n'a été exécuté —
aucune invention de résultat.

**`C6_ATOMICITY_REAL_POSTGRES = BLOCKED`**
**`C6_IDEMPOTENCE_REAL_POSTGRES = BLOCKED`**

## 16. Tenant (partiel, incidentellement couvert par §10)

Le seul volet de l'isolation tenant qui a pu être testé réellement est
celui déjà couvert par 184 : `purchase_item_id` d'un autre tenant, REJETÉ
(§10, test 7 — confirmation réelle du correctif B1). Les volets qui
dépendent de `ventes`/`vente_lignes`/`accounting_events` (produit B,
warehouse B, client B dans le contexte d'une vente) n'ont pas pu être
testés — bloqués par §11.

**`C6_SECURITY_REAL_POSTGRES = PARTIAL`** (B1 confirmé réellement ; le reste
du périmètre sécurité de C6 reste non exécuté, pas en échec — simplement
jamais atteint).

## 18. RLS

**Non testé** — aucune politique RLS propre à 185/186 n'a pu être exercée
(aucune table n'a atteint un état utilisable). Résultat :
`LOCAL_RLS_RESULT = NOT_TESTABLE` (explicitement PAS
`PRODUCTION_RLS_RESULT`, et pas davantage un résultat LOCAL positif
puisqu'aucun test n'a réellement été exécuté).

## 19. Nettoyage

- Les trois tentatives (full chain, harness complet, harness 184-seul) ont
  chacune soit échoué proprement (conteneurs retirés automatiquement par le
  CLI), soit — pour la dernière, actuellement active — démarré avec succès.
- **État actuel** : la stack `oraforme-c6-harness` est **EN COURS
  D'EXÉCUTION** (12 conteneurs, voir §9), avec UNIQUEMENT le socle + 184
  appliqués (185/186 écartés du dossier migrations de cette copie, dans
  `C:\oraforme-c6-harness\supabase\not-yet-applied\`, jamais supprimés).
  Conservée intentionnellement pour permettre une suite immédiate (corriger
  185 dans une mission autorisée à le faire, puis la réappliquer) sans
  refaire tout le travail de construction.
- **Pour tout arrêter** : `cd C:\oraforme-c6-harness && npx supabase stop`
  (arrête et retire les conteneurs ; les fichiers du dossier restent).
- **Pour tout supprimer** : `npx supabase stop` puis
  `rm -rf C:\oraforme-c6-harness` (une seule commande après l'arrêt).
- Aucune donnée de test n'a atteint, ni ne peut atteindre, la production —
  canal totalement séparé (projet local distinct, `.env.local` jamais
  chargé, aucun `supabase link` exécuté à aucun moment de cette mission).
- Dossier résiduel, déjà signalé dans `DB-LOCAL-RECOVERY-02.md`, toujours
  présent et toujours inoffensif : `C:\Users\DONGUI MABIALA\oraforme-local-db-test\`
  (vide, jamais utilisé) — à supprimer manuellement si souhaité.
- Le fichier `C:\oraforme-c6-harness-baseline.sql` créé par erreur avant la
  relocalisation du socle vers son emplacement définitif est un doublon
  inerte du contenu de `001_c6_baseline.sql` — sans effet, supprimable.

## 20. Résultats (classification stricte)

| Propriété | A (Postgres réel) | B (statique) | C (non testable) | D (limité par le synthétique) |
|---|---|---|---|---|
| 184 : origine/purchase_item_id, fn_stock_move, v_products_stock_par_origine | **A — PASS** | | | |
| 184 : B1 (purchase_item_id cross-tenant) | **A — PASS** | | | |
| 184 : rétrocompatibilité appels historiques | **A — PASS** | | | |
| 185 : ajout colonnes ventes, idempotency_key, VTE-001/002 | | | | **ÉCHOUÉ (A) — anomalie réelle découverte, pas un succès** |
| 186 : fn_create_vente_atomique, reversed_movement_id | | B (C6-POST-REVIEW-FIX) | **C** (bloqué par 185) | |
| Comptant / Crédit / Atomicité (3 lignes) / Idempotence / Reverse | | | **C** | |
| Tenant isolation (ventes/vente_lignes/accounting) | | B (C6-PRE-PRODUCTION-REVIEW) | **C** | |
| RLS local | | | **C** | |
| Fidélité du socle à la production | | | | **D** — divergence documentée : `transactions.fiscal_year` et colonnes voisines confirmées en production par introspection, jamais par migration tracée |

## 21. Limites

- Ce harness ne remplace, et ne prétend pas remplacer, un replay complet
  001→186 (`MIGRATION_CHAIN_HISTORICAL` reste `BROKEN`, confirmé une
  troisième fois indirectement : aucune tentative de cette mission n'a
  rejoué la chaîne complète).
- Le socle (`001_c6_baseline.sql`) est une construction, pas une migration
  historique — toute correction future de 184/185/186 devra être retestée
  contre LUI, pas contre un `db reset` complet (qui resterait bloqué dès
  031, voir `TECH-DEBT-MIGRATION-CHAIN.md`).
- `fn_sync_tresorerie_soldes` est un stub délibéré — ce harness NE VALIDE
  PAS la synchronisation réelle des soldes de trésorerie, seulement que son
  absence/échec n'empêche pas VTE-001/002 (propriété déjà établie par
  lecture de code, maintenant confirmée par construction du harness
  lui-même).
- L'anomalie découverte en 185 (§11) est, à ce stade, la SEULE testée —
  il n'est PAS garanti qu'aucune autre anomalie du même type (contrainte
  NOT NULL, CHECK, UNIQUE non respectée par un INSERT statique) n'existe
  plus loin dans 185 ou dans 186 : la correction de l'anomalie actuelle
  devra être suivie d'une nouvelle tentative complète, pas d'une simple
  confiance que "le reste doit être bon".

## 22. Prochaine étape

```
MIGRATION_CHAIN_HISTORICAL   = BROKEN
C6_TARGETED_HARNESS          = READY
C6_184_REAL_POSTGRES         = PASS
C6_185_REAL_POSTGRES         = BLOCKED
C6_186_REAL_POSTGRES         = BLOCKED
C6_ATOMICITY_REAL_POSTGRES   = BLOCKED
C6_IDEMPOTENCE_REAL_POSTGRES = BLOCKED
C6_SECURITY_REAL_POSTGRES    = PARTIAL
C6_LOCAL_FINAL               = BLOCKED
```

**Formulation explicite requise par cette mission** : les conditions de
"C6 PostgreSQL local targeted replay validated" ne sont PAS remplies —
seule la portion 184 l'est. Ni "migration chain fixed", ni "production
safe", ni "C6 production ready" n'ont été ni ne seront énoncées.

**`NEXT_MISSION`** = Une mission explicitement autorisée à **modifier
`supabase/migrations/185_vente_canonique.sql`** (seule modification requise,
mécanique : remplacer `NULL` par un compte placeholder cohérent, ex. `'521'`,
sur les 4 lignes `debit_account` des séquences `treasury_debit` de VTE-001/
VTE-002 — même patron que `139_accounting_rules_facturation.sql`), puis :
1. réappliquer 185 contre le harness déjà construit et actif
   (`C:\oraforme-c6-harness\`, 184 déjà en place) ;
2. réintégrer 186 depuis `supabase\not-yet-applied\` et l'appliquer ;
3. exécuter les sections 13-18 de cette mission (comptant, crédit,
   atomicité 3-lignes, idempotence, reverse, tenant, RLS) qui n'ont encore
   jamais pu être exécutées contre un Postgres réel.
Cette prochaine mission ne devra toujours pas déclarer "C6 production
ready" à son issue — seulement, si tout passe, confirmer
`C6_LOCAL_FINAL = PASS` pour le replay ciblé local, ce qui resterait
distinct de toute validation en production.

# C6-185-FIX-VALIDATION — Correction du défaut NOT NULL de 185 et validation réelle

Mission d'exécution bornée : corriger UNIQUEMENT le défaut `debit_account
NULL` de la migration 185 (découvert par `DB-LOCAL-C6-HARNESS.md` §11),
reprendre le harness déjà construit, et valider réellement 185 puis 186.
Deux nouvelles anomalies ont été découvertes en cours de validation — ni
l'une ni l'autre n'a été corrigée dans cette mission, conformément à la
consigne ("ne pas improviser une deuxième correction").

Aucune donnée production. Aucun commit. Aucun push. 184/186/
`fn_ae_execute_event`/`accounting_event_rules`/le harness/le modèle VTE-001
(nombre de séquences, resolver) n'ont pas été modifiés. Seules les 4 lignes
`debit_account` de 185 concernées par `treasury_debit` ont changé.

## 1. Bug initial

`supabase/migrations/185_vente_canonique.sql`, 4 lignes (VTE-001 séq.1, 2,
3 ; VTE-002 séq.1) déclaraient `debit_account = NULL` alors que
`accounting_event_rules.debit_account` est `NOT NULL` (migration 138).

## 2. Preuve PostgreSQL

Capturée dans `DB-LOCAL-C6-HARNESS.md` §11 :
```
ERROR: null value in column "debit_account" of relation "accounting_event_rules"
violates not-null constraint (SQLSTATE 23502)
```

## 3. Comparaison avec FAC-002 (139) — preuve, pas supposition

- **139, FAC-002 séq.1** : `debit_account = '521'`, commentaire inline :
  *"Banques — valeur par défaut, remplacée par account_resolver"*.
- **Résolution réelle** (`fn_ae_execute_event`, migrations 142.5/175, lignes
  121-124 du corps de fonction) :
  ```sql
  v_debit := v_rule.debit_account;
  CASE v_rule.account_resolver
    WHEN 'treasury_debit' THEN v_debit := fn_ae_resolve_treasury(v_event.metadata);
  ```
  `v_debit` est réaffecté SANS CONDITION dès que `account_resolver =
  'treasury_debit'` — la valeur stockée dans `debit_account` n'est jamais
  lue à l'exécution pour ces lignes. Seule sa présence (NOT NULL) compte.
  **Confirmé par lecture du code, pas supposé.**

## 4. Correction exacte

Dans `185_vente_canonique.sql`, remplacé `NULL` par `'521'` sur exactement
4 lignes (VTE-001 séq.1/2/3, VTE-002 séq.1) — même placeholder que FAC-002.
**Aucun autre champ modifié** : `sequence`, `event_type`, `rule_version`,
`credit_account`, `montant_field`, `account_resolver`, `conditions`,
`country_codes`, `account_plan`, `valid_from` sont strictement inchangés
sur ces 4 lignes, et aucune des 4 autres lignes (séq.4/5/6/7, sans
`treasury_debit`) n'a été touchée. Note explicative ajoutée en commentaire
SQL (traçabilité) + mise à jour du test statique
`lib/architecture/vente-canonique.test.ts` qui vérifiait l'ancien motif
`NULL, '701'` (devenu faux après la correction) et ajout d'un test
générique qui verrouille l'absence de tout `debit_account`/`credit_account`
NULL littéral sur une ligne `treasury_debit`/`treasury_credit` de VTE-001/
VTE-002.

**Idempotence (§3 de la mission)** : `uidx_aer_version` porte sur
`(event_type, sequence, rule_version)` — aucun de ces trois champs n'a
changé, donc aucun risque de doublon introduit par cette correction. Vérifié
par la ré-exécution réelle (§5) : exactement 8 lignes (7 VTE-001 + 1
VTE-002), comme avant.

Validation locale avant toute ré-exécution du harness : `tsc --noEmit` (0
erreur), `eslint` (0 erreur), `vitest run` complet : **1139/1139 tests
passés** (1138 précédents + 1 nouveau test ajouté par cette correction).

## 5. Validation 185 — réelle, PostgreSQL

Harness repris sans reconstruction (`C:\oraforme-c6-harness\`, 184 déjà en
place) : fichier 185 corrigé copié par-dessus, `186` réintégrée depuis
`not-yet-applied\`, puis `supabase db reset` (ré-applique 001→186 dans le
conteneur déjà existant, rien de détruit au-delà de la base elle-même, qui
ne contenait que les objets du harness).

**Résultat : les 4 migrations s'appliquent sans aucune erreur.**

```
event_type | sequence | debit_account | credit_account | account_resolver | status
VTE-001    | 1        | 521           | 701             | treasury_debit   | active
VTE-001    | 2        | 521           | 4441            | treasury_debit   | active
VTE-001    | 3        | 521           | 447             | treasury_debit   | active
VTE-001    | 4        | 411           | 701             |                  | active
VTE-001    | 5        | 411           | 4441            |                  | active
VTE-001    | 6        | 411           | 447             |                  | active
VTE-001    | 7        | 601           | 311             |                  | active
VTE-002    | 1        | 521           | 411             | treasury_debit   | active
```
8 lignes, aucune violation NOT NULL. **`C6_185_FIX = PASS`.**

### Vente comptant (réelle, mode_paiement='carte')

Vente 20 unités × 1000, `fn_create_vente_atomique` appelée directement
(fixtures locales uniquement — tenant/produit/entrepôt de test) :
- 1 vente, 1 ligne, 1 mouvement de stock `sortie` — **conformes**.
- `accounting_events` VTE-001 : **status = 'processed'**.
- `journal_entries` réellement créées :
  | debit | credit | montant |
  |---|---|---|
  | 521 | 701  | 16807 |
  | 521 | 4441 | 1681  |
  | 601 | 311  | 10000 |
- `transactions` : 1 ligne, `montant=18488` (= 16807+1681, exactement la
  somme des séquences `treasury_debit` — **confirme la logique de 175**,
  qui exclut à raison la séquence 7 [601/311, pas de resolver trésorerie]),
  `type='entree'`.

**ANOMALIE RÉELLEMENT DÉCOUVERTE, NON CORRIGÉE** — manque la ligne
attendue `521/447` (Centime Additionnel). Voir §7.

### Vente crédit + règlement (réelle)

Vente 10 × 1000 à crédit : `accounting_events` VTE-001 **processed**,
`journal_entries` : `411/701=8403`, `411/4441=841`, `601/311=5000` —
**conformes** (même anomalie 447 manquante, §7). Règlement (`emit_
accounting_event` VTE-002 direct) : **processed**, `journal_entries` :
`521/411=10000` — **conforme**.

Note de périmètre : le refus "paiement avant VTE-001 confirmé" (anomalie
A2 de `C6-PRE-PRODUCTION-REVIEW.md`, corrigée dans `C6-POST-REVIEW-FIX.md`)
est une règle **applicative TypeScript** (`app/api/sales/[id]/paiement/
route.ts`), pas un mécanisme SQL — non ré-exercée ici (déjà prouvée par
mock dans `lib/architecture/sales-paiement.integration.test.ts`). Ce
harness SQL ne peut tester que ce qui vit en SQL.

### Atomicité (3 lignes, 3e insuffisante) — réelle, critique

Compteurs avant/après une tentative échouée (3e ligne demandant 999999
unités sur un stock de 960) : **`ventes`, `stock_movements`,
`accounting_events`, `journal_entries` strictement identiques avant/après**
(aucune ligne fantôme, `idempotency_key` de la tentative absente). Exception
réellement levée : `23514 — Stock insuffisant : 960.000 disponible, 999999
demandé`. **Confirmé par PostgreSQL réel, pas supposé — `C6_ATOMICITY_REAL
_POSTGRES = PASS`.**

Test complémentaire (sécurité + atomicité combinées, non explicitement
demandé mais directement pertinent) : panier de 2 lignes dont la 2e porte
un `purchase_item_id` d'un AUTRE tenant — **toute la tentative annulée**
(compteur `ventes` inchangé), exception `42501 — purchase_item_id ...
introuvable pour ce tenant`. Confirme que la protection B1 (découverte dans
`C6-PRE-PRODUCTION-REVIEW.md`, corrigée dans `C6-POST-REVIEW-FIX.md`) est
non seulement effective, mais correctement couverte par l'atomicité de 186
— une défaillance de sécurité annule tout, pas seulement la ligne fautive.

### Idempotence — réelle

Même `idempotency_key`, deux appels : 1er → `replay=false`, nouveau
`vente_id` ; 2e → `replay=true`, **même `vente_id`**. Comptage réel :
exactement **1** vente, **1** mouvement de stock, **1** événement VTE-001
pour cette clé, malgré 2 appels. **`C6_IDEMPOTENCE_REAL_POSTGRES = PASS`**
pour le scénario séquentiel (2 appels successifs). Appels réellement
concurrents : non exécutés (nécessiteraient deux sessions psql simultanées
— non tenté dans cette mission, cohérent avec la discipline de ne pas
qualifier une déduction de "testé").

### Reverse — réel, PARTIEL avec une anomalie bloquante côté comptable

- **Côté stock** (`fn_stock_move` avec `p_reversed_movement_id`) : 1er
  retour → succès. 2e retour sur le MÊME mouvement original → **rejeté**,
  `23505 — duplicate key value violates unique constraint
  "idx_stock_movements_reversed_movement"`. Exactement 1 ligne `retour`
  liée à ce mouvement après les deux tentatives. **PASS réel.**
- **Côté comptable** (`fn_reverse_accounting_event`) : **la toute PREMIÈRE
  tentative échoue déjà** — voir anomalie §7 (ce n'est pas la protection
  anti-doublon qui a été testée, c'est un défaut plus fondamental qui
  empêche tout reverse comptable, quel que soit le nombre de tentatives).

## 6. Nouveaux problèmes découverts (documentés, NON corrigés dans cette mission)

### Anomalie 1 — `metadata.ca` attendu, `montant_ca` utilisé (185, séquences 3 et 6)

- **Fichier/ligne** : `supabase/migrations/185_vente_canonique.sql`,
  séquence 3 (`montant_field='montant_ca'`,
  `conditions='[...,{"field":"montant_ca","op":">","value":"0"}]'`) et
  séquence 6 (identique).
- **Preuve PostgreSQL** : la vente comptant réelle ci-dessus (§5) avec
  `montant_ca=712` ne produit AUCUNE ligne `521/447` — la séquence 3 est
  silencieusement ignorée.
- **Cause** : `fn_ae_resolve_montant` (migration 138) ne reconnaît que
  `montant_ht`, `montant_tva`, `montant_ttc`, `montant_net`, et le préfixe
  `metadata.%` — PAS `montant_ca` (qui n'est d'ailleurs pas une colonne de
  `accounting_events` : il n'existe que `montant_ht/tva/ttc/net`). Toute
  évaluation de `montant_ca` retombe sur la branche `ELSE 0`, donc la
  condition `montant_ca > 0` est **TOUJOURS fausse**, quel que soit le CA
  réel transmis.
- **Preuve que c'est une incohérence de 185, pas du moteur** : TOUS les
  précédents que 185 cite elle-même comme identiques (`FAC-001` séq.3 dans
  `139_accounting_rules_facturation.sql`, `RES-001`/`HOT-001` séq.3 dans
  `182_fix_res_san_hot_boi_tva_ca_separation.sql`) utilisent
  `montant_field='metadata.ca'` et `conditions=
  '[{"field":"metadata.ca","op":">","value":"0"}]'` — avec le commentaire
  explicite dans 139 : *"CA est passé dans metadata.ca par l'appelant"*.
  185 aurait dû faire pareil et ne l'a pas fait.
- **Impact** : le Centime Additionnel (447, 5% de la TVA, obligation
  fiscale congolaise) n'est JAMAIS comptabilisé pour aucune vente VTE-001
  ou VTE-002, comptant ou crédit — une sous-déclaration fiscale silencieuse
  et systématique si ce code atteignait la production tel quel.
- **Correction future proposée (non appliquée)** : dans 185, remplacer
  `'montant_ca'` par `'metadata.ca'` dans `montant_field` et dans
  `conditions` des séquences 3 et 6 ; côté application
  (`app/api/sales/route.ts`), transmettre le CA calculé par
  `decomposerTTCUnifie` sous `metadata.ca` (actuellement il est calculé
  mais seulement passé à la fonction SQL comme paramètre positionnel
  `p_montant_ca`, jamais injecté dans le JSONB `metadata`).
- **Statut** : `OPEN` — non corrigé (hors autorisation de cette mission).

### Anomalie 2 — `fn_reverse_accounting_event` génère un `event_type` qui viole sa propre contrainte CHECK (migration 138, pré-existante, pas C6)

- **Fichier/ligne** : `supabase/migrations/138_accounting_engine_infrastructure.sql`,
  ligne 185 (`CONSTRAINT chk_ae_event_type CHECK (event_type ~
  '^[A-Z]{2,10}-[0-9]{3}(-[A-Z0-9]+)?$')`) vs la construction de
  `fn_reverse_accounting_event` (même fichier) :
  `'EXT-' || v_event.event_module || '-' || split_part(v_event.event_type, '-', 2)`.
- **Preuve PostgreSQL** : extourne réelle d'un événement VTE-001 :
  ```
  ERROR: new row for relation "accounting_events" violates check constraint "chk_ae_event_type"
  DETAIL: ... event_type: 'EXT-VTE-001' ...
  ```
- **Cause** : pour `event_type='VTE-001'`, `event_module='VTE'`,
  `split_part(...,2)='001'` → la chaîne produite est `'EXT-VTE-001'`. Le
  motif exigé par la contrainte attend des CHIFFRES immédiatement après le
  premier groupe de lettres (`[A-Z]{2,10}-[0-9]{3}`) — `'EXT-VTE-001'` a
  des LETTRES ("VTE") juste après "EXT-", pas des chiffres : violation
  structurelle. **Ce défaut n'est pas spécifique à VTE** — il se reproduit
  à l'identique pour n'importe quel `event_type` (`'EXT-FAC-001'` échouerait
  pareil).
- **Important** : ceci n'est PAS un défaut de 184/185/186 — c'est une
  incohérence interne à la migration 138 elle-même, jamais détectée car
  `fn_reverse_accounting_event` n'avait, de toute évidence, jamais été
  exécutée contre la contrainte réellement active avant ce harness. Hors
  périmètre d'autorisation de cette mission (seule 185 pouvait être
  modifiée) — non corrigé.
- **Impact** : AUCUNE extourne comptable (`fn_reverse_accounting_event`) ne
  peut actuellement réussir pour AUCUN module, pas seulement VTE-001/002 —
  un risque bien plus large que C6, découvert comme effet de bord de cette
  mission.
- **Correction future proposée (non appliquée)** : soit assouplir
  `chk_ae_event_type` pour accepter le préfixe `EXT-`, soit changer la
  construction de l'event_type d'extourne dans `fn_reverse_accounting_event`
  pour respecter le motif existant (ex. `v_event.event_type || '-EXT'` au
  lieu de `'EXT-' || event_module || '-' || numéro`).
- **Statut** : `OPEN` — hors périmètre de cette mission, à traiter
  séparément (impact transverse, pas seulement C6).

## 7. Tests exécutés (liste complète, tous contre PostgreSQL réel sauf mention contraire)

tsc, eslint, vitest (1139 tests, mocké) ; application réelle de
001+184+185(corrigée)+186 ; lecture réelle des 8 règles
`accounting_event_rules` ; vente comptant réelle (vente/ligne/stock/
accounting_event/journal_entries/transactions) ; vente crédit réelle +
règlement réel ; atomicité réelle 3 lignes (compteurs avant/après) ;
atomicité+sécurité combinée réelle (purchase_item cross-tenant) ;
idempotence réelle (2 appels, même clé) ; reverse stock réel (2 tentatives) ;
reverse comptable réel (1 tentative, échec documenté comme anomalie 2).

**Non exécutés** : appels concurrents réels (nécessiteraient 2 sessions
simultanées) ; tenant isolation sur `produit_id`/`warehouse_id` directement
en SQL (ce contrôle vit côté TypeScript, déjà prouvé par mock) ; RLS
(aucune politique RLS ne fait partie de la dépendance réelle de 184/185/186,
donc absente du socle du harness par construction — `LOCAL_RLS_RESULT =
NOT_TESTABLE`, pas un échec).

## 8. Limites

- Les résultats PASS de cette mission (184 entier, 185 structurellement,
  atomicité, idempotence, sécurité-atomicité combinée, reverse côté stock)
  sont des preuves réelles contre le harness ciblé — pas une validation de
  la chaîne historique complète (`MIGRATION_CHAIN_HISTORICAL` reste
  `BROKEN`), et pas une validation en production.
- 185 passe maintenant l'application SQL et produit des écritures
  correctes pour 5 des 7 séquences VTE-001 (1,2,4,5,7) — les séquences 3 et
  6 (Centime Additionnel) restent fiscalement incorrectes (anomalie 1).
  **185 n'est donc PAS validée à 100% — seul le défaut NOT NULL explicitement
  visé par cette mission l'est.**
- Le reverse comptable est bloqué pour une raison qui dépasse le périmètre
  C6 (anomalie 2, migration 138) — ni confirmé ni infirmé pour VTE
  spécifiquement au-delà de ce qui est déjà documenté.

---

## Verdicts

```
C6_185_FIX           = PASS       (le défaut NOT NULL visé est corrigé et confirmé par PostgreSQL réel)
C6_185_REAL_POSTGRES = PARTIAL    (s'applique et produit des écritures correctes pour 5/7 séquences VTE-001 ; séquences 3/6 fiscalement incorrectes — anomalie 1, nouvelle, non corrigée)
C6_186_REAL_POSTGRES = PARTIAL    (fn_create_vente_atomique : atomicité/idempotence/sécurité-atomicité combinées = PASS réels ; reversed_movement_id côté stock = PASS réel ; reverse côté comptable = BLOCKED par anomalie 2, hors périmètre 186)
C6_REAL_POSTGRES     = PARTIAL
```

Aucune des formulations interdites ("migration chain fixed", "production
safe", "C6 production ready", "184/185/186 validated in production") n'a
été ni ne sera énoncée. La formulation correcte pour ce qui a réellement
été prouvé : **le cœur transactionnel de C6 (atomicité, idempotence,
sécurité inter-tenant côté stock) est un "C6 PostgreSQL local targeted
replay validated" pour ces propriétés précises** — la complétude fiscale
de VTE-001/002 (Centime Additionnel) et l'extourne comptable restent
non validées, avec deux anomalies désormais documentées et non corrigées.

**`NEXT_MISSION`** = Deux missions indépendantes, chacune nécessitant une
autorisation explicite de modifier du code/une migration :
1. **C6-185-FIX-02** : corriger l'anomalie 1 (`montant_ca` → `metadata.ca`
   dans 185, séquences 3/6 ; transmission de `metadata.ca` par
   `app/api/sales/route.ts`), puis revalider réellement les séquences 3/6
   contre ce même harness.
2. **ACCOUNTING-ENGINE-REVERSE-FIX** (hors C6, portée transverse) :
   corriger l'anomalie 2 (`fn_reverse_accounting_event`/`chk_ae_event_type`,
   migration 138) — à traiter comme un ticket de dette technique du moteur
   comptable partagé, pas comme un correctif C6, puisqu'il affecte
   potentiellement toutes les extournes de tous les modules, pas seulement
   VTE-001/002.

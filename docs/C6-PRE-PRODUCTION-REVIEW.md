# C6-PRE-PRODUCTION-REVIEW — Revue pré-production de la vente canonique (C6)

Mission de REVUE uniquement. Aucun code métier modifié dans cette mission, aucune
migration exécutée, aucune donnée DB modifiée, aucun commit/push. Toute anomalie
trouvée est documentée (fichier/fonction/cause/impact/correction proposée) sans
être corrigée ici, conformément à la consigne explicite de la mission.

Référence au travail déjà livré : `docs/C6-IMPLEMENTATION-REPORT.md` (code +
migrations 184/185 préparées, non exécutées), et toute la chaîne de documents
`C6-VENTE-CANONICAL-DESIGN.md` → `C6-PREIMPLEMENTATION-GATE.md`.

**Note de cadrage** : le mandat de cette revue nomme les colonnes fiscales
`ventes.total_ht/tva/ca/ttc`. La migration 185 réellement écrite utilise
`montant_ht`, `montant_tva`, `montant_ca` (et la colonne déjà existante
`total` comme TTC) — pas `total_ht`/`total_ttc`. Ce n'est pas une anomalie :
c'est la nomenclature effectivement implémentée et testée par
`lib/architecture/vente-canonique.test.ts`. Le reste de cette revue utilise les
noms réels.

---

## 1. Migration 184 — relecture complète dans le cadre de cette revue

Fichier relu intégralement aujourd'hui (`supabase/migrations/184_stock_provenance.sql`),
pas depuis la mémoire d'une mission antérieure.

- **Ordre/dépendances** : garde-fou `DO $$ ... RAISE EXCEPTION` si `stock_movements.origine`
  existe déjà → non-ré-applicable par erreur. Aucune dépendance vers une
  migration postérieure. Migration 185 ne référence aucun objet SQL de 184
  (confirmé : 185 ne touche jamais `stock_movements`) — **indépendance SQL
  confirmée**, mais dépendance **runtime** documentée en tête de 185 : sans
  184, les appels `fn_stock_move(..., p_origine, p_purchase_item_id)` du code
  applicatif échoueraient (paramètres inconnus sur la signature à 8 params
  encore en production).
- **Idempotence du script** : le garde-fou en 0. empêche une double-exécution
  silencieuse ; `CREATE INDEX IF NOT EXISTS` (×2) est idempotent ; `DROP FUNCTION
  IF EXISTS` puis `CREATE OR REPLACE FUNCTION` est idempotent. Le seul point
  non ré-exécutable sans erreur est le premier bloc (déjà gardé).
- **Rollback** : section complète et dans le bon ordre inverse (DROP VIEW →
  DROP FUNCTION signature à 10 params → recréer l'ancienne à 8 params
  [référence externe documentée, pas de corps dupliqué] → DROP CONSTRAINT →
  DROP COLUMN ×2). Cohérent.
- **Compatibilité schéma/contraintes/index** : `ADD COLUMN origine TEXT NULL`
  + `purchase_item_id UUID NULL REFERENCES purchase_items(id)` — additif pur,
  aucune contrainte NOT NULL qui casserait les 0 lignes existantes (confirmé :
  0 ligne dans `stock_movements` au moment de la préparation). CHECK
  `origine IS NULL OR origine IN (...)` correctement permissif pour
  l'historique. Deux index non-UNIQUE, sans risque de conflit.
- **Signature/overload de `fn_stock_move`** : le point le plus sensible de
  cette migration. `DROP FUNCTION IF EXISTS fn_stock_move(UUID, UUID, TEXT,
  NUMERIC, UUID, NUMERIC, TEXT, TEXT)` cible explicitement l'ancienne
  signature exacte à 8 paramètres avant le `CREATE OR REPLACE` à 10 — la
  migration documente elle-même (ligne 75-86) pourquoi un simple
  `CREATE OR REPLACE` sans ce DROP créerait une **surcharge ambiguë** plutôt
  qu'un remplacement (Postgres identifie une fonction par nom+types, pas par
  nom seul ; les 2 nouveaux paramètres ayant un DEFAULT, un appel à 8
  arguments correspondrait aux deux signatures et échouerait avec "function is
  not unique"). Analyse correcte, DROP ciblé correctement écrit.
- **Compatibilité historique/rétro-compatibilité des appelants existants** :
  tout appelant actuel (`app/api/stock/move/route.ts`, etc., listés dans la
  recherche ci-dessous) qui appelle `fn_stock_move` avec 8 arguments positionnels
  continue de fonctionner à l'identique — `p_origine`/`p_purchase_item_id`
  prennent leur DEFAULT NULL, et le comportement interne (vérification de
  stock global, lock avisory, insert) est strictement préservé pour ce cas
  (le bloc de vérification scopée à la provenance ne s'exécute que `IF
  p_origine IS NOT NULL`).
- **RLS/vue** : `v_products_stock_par_origine` créée avec
  `security_invoker = true` — la RLS de `products`/`stock_movements` continue
  de s'appliquer normalement au lecteur, pas de contournement par la vue.
  Cohérent avec le mécanisme déjà utilisé par `v_products_stock`.
- **Logique métier de `fn_stock_move`** (relecture ligne à ligne) :
  verrou avisory par produit (`pg_advisory_xact_lock(hashtext(product_id))`) →
  calcul du stock global → refus si négatif → **si `p_origine` fourni ET
  mouvement sortant (`v_sign < 0`)**, calcul **supplémentaire** du stock
  scopé à cette provenance précise et refus si cette provenance précise ne
  suffit pas — **jamais de bascule automatique vers une autre provenance**
  (conforme à BOI-009, "choix manuel uniquement"). Le contrôle global reste
  la première ligne de défense, le contrôle par provenance est strictement
  additionnel, jamais moins strict.

**`184_READY_FOR_EXECUTION = YES`** — aucune anomalie trouvée à cette relecture.
Risque résiduel documenté honnêtement par la migration elle-même : le DROP de
l'ancienne signature exacte repose sur le fait que la signature en production
est *exactement* `(UUID, UUID, TEXT, NUMERIC, UUID, NUMERIC, TEXT, TEXT)` — un
état différent (déjà modifié entre-temps) ferait échouer le DROP silencieusement
(`IF EXISTS`) et créerait potentiellement une surcharge. Ceci n'a pu être
re-vérifié par introspection fraîche DANS cette session précise (canal DB
indisponible, §13) ; la dernière vérification positive de cette signature
exacte date de `C6-PREIMPLEMENTATION-GATE.md` (introspection PostgREST réelle),
pas de cette session. Recommandation : revérifier la signature exacte par
introspection PostgREST immédiatement avant exécution (étape 1 de la procédure,
§15), pas supposer qu'elle n'a pas changé depuis.

## 2. Migration 185 — relecture complète dans le cadre de cette revue

Fichier relu intégralement aujourd'hui (`supabase/migrations/185_vente_canonique.sql`).

- **Garde-fou** identique au patron de 184 (`RAISE EXCEPTION` si
  `ventes.montant_ht` existe déjà).
- **Colonnes additives** : `montant_ht/tva/ca NUMERIC NOT NULL DEFAULT 0`,
  `statut_paiement TEXT NOT NULL DEFAULT 'paye'` (+ CHECK IN paye/du/solde),
  `destinataire TEXT NULL`, `idempotency_key UUID NULL` — additif pur, DEFAULT
  0/'paye' compatibles avec les lignes déjà existantes dans `ventes` (confirmé
  `C6-SCHEMA-VALIDATION.md` : 0 colonne fiscale actuelle, table déjà peuplée
  par le POS en production — DEFAULT NOT NULL est donc le choix correct pour
  ne pas invalider les lignes historiques).
- **Index d'idempotence** : `CREATE UNIQUE INDEX idx_ventes_tenant_idempotency
  ON ventes(tenant_id, idempotency_key) WHERE idempotency_key IS NOT NULL` —
  patron identique et déjà prouvé en production sur `uidx_ae_processed`
  (migration 138). Scope tenant correct (clé composite) : deux tenants
  peuvent réutiliser la même valeur de clé côté client sans collision.
- **Règles VTE-001 (7 séquences) / VTE-002 (1 séquence)** : voir matrice §3 —
  chaque séquence vérifiée individuellement contre le moteur réel, pas
  supposée correcte parce que la syntaxe SQL est valide.
- **Aucune modification d'une règle existante** : confirmé par relecture
  complète du fichier — aucun UPDATE/DELETE sur `accounting_event_rules`,
  uniquement des INSERT sur `event_type IN ('VTE-001','VTE-002')`, des
  identités qui n'existaient pas avant cette migration (recherche
  `grep -c "'VTE-001'\|'VTE-002'"` dans toutes les migrations antérieures à
  185 : 0 occurrence, confirmé déjà dans `C6-IMPLEMENTATION-REPORT.md` et
  revérifié par la lecture complète ci-dessus).
- **Dépendance** : cette migration ne référence aucun objet de 184
  (confirmé : ni `origine` ni `purchase_item_id` n'apparaissent dans 185).
  Le lien n'existe qu'au niveau applicatif (`app/api/sales/route.ts`
  appelle `fn_stock_move` avec ces paramètres), documenté en tête du fichier.
- **Rollback** : section complète, ordre inverse correct (DELETE rules →
  DROP INDEX → DROP CONSTRAINT → DROP COLUMN ×6 dans l'ordre inverse de
  création).

**`185_READY_FOR_EXECUTION = YES`** — sous réserve explicite que `184` soit
appliquée en premier si le flux complet avec choix de provenance doit
fonctionner dès le déploiement (sinon les ventes sans `origine` renseignée
fonctionnent, celles avec `origine` échoueraient au niveau `fn_stock_move`
avec une erreur "paramètre inconnu" — échec net, pas de corruption silencieuse,
mais à éviter en séquençant 184 avant 185 + le code applicatif).

## 3. VTE-001 — revue comptable complète, chemin réel vérifié

### 3.1 Chemin réel confirmé par lecture de code (pas supposé)

```
app/api/sales/route.ts
  → RPC emit_accounting_event(p_event_type='VTE-001', p_source_table='ventes', ...)
    → INSERT INTO accounting_events (status='pending') ON CONFLICT DO NOTHING
      [idempotence de l'émission elle-même, via uidx_ae_inflight — indépendante
       de idempotency_key sur ventes, voir §4]
      → TRIGGER trg_process_accounting_event AFTER INSERT WHEN (status='pending')
        → fn_process_accounting_event() → PERFORM fn_ae_execute_event(NEW.id)
          → SELECT * FROM fn_ae_get_applicable_rules(event_type, date, country)
            [DISTINCT ON (sequence) ... ORDER BY sequence, country-first, rule_version DESC]
          → POUR CHAQUE règle (boucle, ordre croissant de sequence) :
              fn_ae_eval_conditions(...)      → CONTINUE si faux
              fn_ae_resolve_amount_formula → fn_ae_resolve_montant(...) → CONTINUE si <= 0
              résolution debit/credit (statique | treasury_* | metadata_*)
              INSERT INTO journal_entries (...)
```

Ce chemin a été vérifié dans CETTE session par lecture directe de
`fn_ae_execute_event`, `fn_ae_eval_conditions`, `fn_ae_resolve_montant`,
`emit_accounting_event`, et du trigger `trg_process_accounting_event`
(migration 138, lignes 511-930 et 659-751) — pas réaffirmé depuis une mission
antérieure sans le revérifier.

**Point vérifié et confirmé, pas supposé** : `emit_accounting_event` ne fait
QUE l'INSERT dans `accounting_events` — c'est le trigger `AFTER INSERT`
(`trg_process_accounting_event`, ligne 813-816) qui invoque
`fn_ae_execute_event` **de manière synchrone, dans la même transaction**
que l'appel RPC. Conséquence directe pour l'atomicité (§5) : quand la RPC
`emit_accounting_event` retourne sans erreur, les lignes `journal_entries`
existent déjà — l'étape comptable est atomique EN ELLE-MÊME, mais reste un
appel PostgREST séparé des étapes vente/lignes/stock qui précèdent.

**Point vérifié et confirmé** : `fn_ae_get_applicable_rules` utilise
`DISTINCT ON (sequence)` — qui ne fusionne que des lignes de MÊME séquence.
Les 7 lignes VTE-001 ont 7 numéros de séquence strictement distincts (1 à 7,
confirmé par lecture de la migration 185) : **aucune collision possible**,
les 7 lignes sont bien toutes retournées.

**Point vérifié et confirmé** : `fn_ae_resolve_montant` supporte le préfixe
`'metadata.%'` pour la résolution d'un MONTANT (pas seulement pour
l'évaluation d'une CONDITION, qui est une fonction séparée) :
`WHEN p_field LIKE 'metadata.%' THEN (p_metadata ->> substr(p_field, 10))::NUMERIC`.
Ceci confirme que `montant_field = 'metadata.cout_marchandises'` (séquence 7)
se résout correctement vers la valeur numérique transmise dans
`p_metadata.cout_marchandises` par la route.

**Point vérifié et confirmé** : `fn_ae_eval_conditions`, pour un champ
`metadata.%` avec un opérateur numérique (`>`, `>=`, etc. — pas `=`/`!=`),
tombe dans la branche générique "Comparaisons numériques" (ligne 558-568),
qui appelle elle-même `fn_ae_resolve_montant` — donc `metadata.cout_marchandises
> 0` (condition de la séquence 7) se résout correctement, sans traitement
spécial manquant.

### 3.2 Question de l'ORDRE des séquences — vérifiée dans le code réel

`fn_ae_get_applicable_rules` trie par `ORDER BY sequence, ...` : la boucle de
`fn_ae_execute_event` traite donc les 7 séquences VTE-001 dans l'ordre croissant
1→7. **Vérifié dans le corps de `fn_ae_execute_event`** (lignes 696-747) :
chaque itération de la boucle résout son montant/debit/credit/libellé
UNIQUEMENT à partir des champs figés de l'événement (`v_event.montant_ht/tva/
ttc/net`, `v_event.metadata`) et de la règle courante — il n'existe AUCUNE
variable partagée entre itérations qui influence le résultat d'une séquence à
partir d'une précédente (`v_total`/`v_entries`/`v_rules_used` ne sont que des
compteurs/logs, jamais relus pour une décision). **Conclusion : l'ordre est
bien appliqué (ORDER BY), mais ne conditionne la correction d'aucune des 7
séquences VTE-001** — elles sont mutuellement exclusives par condition
(comptant vs crédit) ou indépendantes (coût), et chacune écrit une ligne
`journal_entries` autonome. L'ordre n'affecte que l'ordre d'insertion des
lignes `journal_entries` (donc leur tri par défaut/affichage), pas leur
exactitude individuelle ni leur équilibre comptable global.

### 3.3 Matrice VTE-001 / VTE-002

| Séq. | Variante | Condition | Débit | Crédit | montant_field | Notes vérifiées |
|---|---|---|---|---|---|---|
| 1 | Comptant | `metadata.mode_paiement != 'credit'` | `treasury_debit` (521/5xx résolu) | 701 | montant_ht | Identique BOI-001 séq.1 |
| 2 | Comptant | idem **ET** `montant_tva > 0` | `treasury_debit` | 4441 | montant_tva | Skip si vente exonérée (montant_tva=0 décidé par l'appelant) |
| 3 | Comptant | idem **ET** `montant_ca > 0` | `treasury_debit` | 447 | montant_ca | Centime Additionnel, même compte que FAC-001/BOI-001 |
| 4 | Crédit | `metadata.mode_paiement = 'credit'` | 411 (statique) | 701 | montant_ht | Pas de resolver — 411 ne dépend pas du moyen de paiement |
| 5 | Crédit | idem **ET** `montant_tva > 0` | 411 | 4441 | montant_tva | — |
| 6 | Crédit | idem **ET** `montant_ca > 0` | 411 | 447 | montant_ca | — |
| 7 | Coût (les deux) | `metadata.cout_marchandises > 0` | 601 | 311 | metadata.cout_marchandises | Skip silencieux si coût global = 0 (voir §7) |
| VTE-002 §1 | Règlement crédit | `[]` (toujours) | `treasury_debit` | 411 | montant_ttc | Structure FAC-002, source_table='ventes' |

**Résultat attendu, vente comptant, 1 article, prix_achat connu** : 3 lignes
`journal_entries` (séq.1-3, suppose TVA et CA > 0) + 1 ligne séq.7 (coût) = 4
lignes au total, débit/crédit équilibré par construction (chaque ligne est un
débit=crédit unique, pas une partie double multi-lignes).

**Résultat attendu, vente à crédit, même article** : séq.4-6 + séq.7 à
l'émission (4 lignes), puis séq.1 de VTE-002 au règlement (1 ligne
supplémentaire, émise par `/api/sales/:id/paiement`).

**`C6_VTE001_REVIEW = PASS`** — chemin réel vérifié de bout en bout (émission
→ trigger → moteur → résolution → écriture), aucune anomalie de conception
trouvée. Réserve : ceci reste une vérification STATIQUE du code SQL/TS, pas
une exécution réelle (voir §13) — la correction du calcul `decomposerTTCUnifie`
lui-même (taux CEMAC) n'a pas été ré-auditée ici, elle est héritée telle
qu'utilisée par BOI-001 (hors périmètre de cette revue).

## 4. Idempotence — scénarios A/B/C/D

Mécanisme : `idx_ventes_tenant_idempotency` (UNIQUE partiel sur
`(tenant_id, idempotency_key) WHERE idempotency_key IS NOT NULL`), et la route
tente l'INSERT d'abord (jamais un SELECT préalable), catch le code `23505`,
puis relit par la clé.

- **Scénario A — POST avec clé X (1ère fois)** : INSERT réussit, flux complet
  s'exécute (lignes, stock, comptabilité), 201 retourné. **PROUVÉ** par le
  test mocké "vente comptant, chemin complet" (`sales-route.integration.test.ts`)
  — exécute réellement le code de la route, pas une réimplémentation.
- **Scénario B — POST avec la même clé X, séquentiellement (retry après succès)** :
  INSERT échoue avec 23505 (contrainte réelle en production si 185 est
  appliquée), la route relit par `(tenant_id, idempotency_key)` et renvoie la
  vente existante avec `replay:true`, 200, **sans** ré-exécuter
  lignes/stock/comptabilité (vérifié : `mock.rpcCalls.length === 0` dans ce
  cas). **PROUVÉ en mode mocké uniquement** — le test simule la réponse 23505,
  il ne la provoque pas via une vraie contrainte Postgres. **NON TESTABLE
  réellement sans le canal DB** (§13).
- **Scénario C — deux POST simultanés avec la même clé X (vraie concurrence)** :
  **NON TESTABLE dans cette session.** Aucun test mocké ne peut prouver ce
  scénario : un mock séquentiel ne peut pas représenter une vraie race
  condition PostgreSQL. L'attente théorique, fondée sur le mécanisme UNIQUE
  INDEX de Postgres (atomique au niveau moteur, pas au niveau applicatif) :
  l'une des deux transactions d'INSERT réussit, l'autre reçoit 23505 et bascule
  sur la relecture — comportement IDENTIQUE à B, par construction du
  mécanisme (c'est exactement pour ce scénario que le patron UNIQUE INDEX a
  été choisi plutôt qu'un verrou applicatif). Mais ceci reste une **déduction
  depuis la documentation de Postgres**, pas une preuve d'exécution réelle. Ne
  pas qualifier cela de "test de concurrence validé" — ce serait mentir sur ce
  qui a été réellement exécuté.
- **Scénario D — timeout réseau puis retry (le client ne sait pas si la 1ère
  tentative a abouti)** : couvert par le même mécanisme que B — le retry
  renvoie la même clé, la contrainte UNIQUE tranche côté serveur
  indépendamment de ce qui s'est passé côté réseau. **Seule limite non
  couverte** : si la 1ère tentative a réussi l'INSERT `ventes` mais a échoué
  AVANT le stock/la comptabilité (crash serveur entre les deux étapes), le
  retry avec la même clé reçoit 23505 → bascule sur la relecture → renvoie la
  vente **sans jamais compléter le stock/la comptabilité manquants** (la
  route de retry ne vérifie pas si ces étapes ont été faites, elle relit
  juste `ventes`). **ANOMALIE** documentée précisément ci-dessous.

**Anomalie D1 — retry sur idempotency_key ne complète pas un flux
partiellement abouti.**
- Fichier/fonction : `app/api/sales/route.ts`, bloc `if (venteErr.code === '23505' ...)`, lignes 133-141.
- Cause : la relecture après 23505 renvoie la vente existante sans vérifier
  si `vente_lignes`, le mouvement de stock, et l'événement comptable existent
  réellement pour cette vente.
- Impact : si le process serveur meurt entre l'INSERT `ventes` et la suite du
  flux (improbable mais possible — redémarrage, OOM, déploiement), un retry
  client légitime avec la même `idempotency_key` reçoit une 200 "succès" pour
  une vente dont le stock n'a jamais été décrémenté et dont la comptabilité
  n'a jamais été émise — silencieusement incomplète, jamais retentée.
- Correction proposée (non appliquée ici) : à la relecture après 23505,
  vérifier aussi l'existence de `vente_lignes` pour cette vente ; si absentes,
  reprendre le flux à partir de là plutôt que renvoyer tel quel. Fenêtre de
  risque très étroite (un crash exactement entre deux lignes de code) mais
  non nulle, et aujourd'hui silencieuse.

**`C6_IDEMPOTENCE_REVIEW = PARTIAL`** — mécanisme structurellement correct et
conforme au patron déjà prouvé en production (`uidx_ae_processed`), scénarios
A/B/D(cas nominal) prouvés par du code réellement exécuté (mocké), scénario C
non testable sans canal DB réel, et une anomalie de fenêtre étroite (D,
cas crash partiel) documentée sans être corrigée.

## 5. Atomicité — audit complet du flux POST /api/sales

Liste exhaustive des appels réseau/DB séquentiels dans `app/api/sales/route.ts`,
chacun un appel PostgREST/RPC indépendant et auto-commit — **confirmé
explicitement : aucune transaction Postgres multi-étapes n'enveloppe ce flux**
(PostgREST ne l'expose pas depuis TypeScript) :

1. `SELECT warehouses` (si `warehouse_id` fourni) — lecture seule, sans risque.
2. `SELECT products` (prix/coût serveur) — lecture seule.
3. `INSERT ventes` (avec idempotency_key) — **point de non-retour n°1**.
4. `INSERT vente_lignes` — si échec, compensation : `DELETE ventes` (best-effort, pas garanti si la connexion tombe entre les deux).
5. **Boucle `RPC fn_stock_move` par ligne** — si échec sur la ligne *k* :
   compensation `DELETE vente_lignes` puis `DELETE ventes`, **mais les
   mouvements de stock déjà créés pour les lignes 1..k-1 ne sont PAS annulés**.
6. `RPC emit_accounting_event` — si échec, **aucune compensation** (vente et
   stock déjà actés, documenté explicitement dans le code comme un choix
   délibéré : le bien a physiquement changé de main, 207 retourné avec un
   avertissement plutôt qu'un succès silencieux ou une annulation du stock).

**Risques de défaillance partielle, documentés précisément (pas supposés)** :

- **Vente créée, lignes échouées** : compensation `DELETE ventes` existe.
  Risque résiduel : si CE `DELETE` échoue aussi (réseau), une ligne `ventes`
  orpheline sans `vente_lignes` reste en base, visible dans les listings
  `GET /api/sales`. Non catastrophique (pas de stock/compta touché), mais
  visible utilisateur.
- **Stock créé pour une partie des lignes, échec sur une ligne suivante
  (ANOMALIE A1, ci-dessous)**.
- **Stock complet, comptabilité échouée** : documenté et accepté (207, pas de
  compensation — correct, puisque le bien a réellement quitté le stock).
- **Paiement crédit réglé (VTE-002) alors que VTE-001 n'a jamais abouti** :
  impossible par construction — `paiement/route.ts` vérifie
  `vente.statut_paiement === 'du'`, qui n'est positionné qu'après la création
  réussie de la vente (`statut_paiement: mode_paiement==='credit' ? 'du' : 'paye'`
  à l'INSERT initial) — mais ceci ne garantit PAS que VTE-001 a été traité
  avec succès par le moteur comptable (seulement que l'INSERT `ventes` a
  réussi). Si VTE-001 a échoué (cas 207 ci-dessus) et que l'utilisateur
  règle quand même via `/paiement`, VTE-002 serait émis sans que VTE-001
  existe en `accounting_events` avec status `processed` — un règlement
  comptabilisé sans la vente d'origine. **ANOMALIE A2, ci-dessous.**

**Anomalie A1 — stock partiellement décrémenté, jamais annulé, sur échec
multi-lignes.**
- Fichier/fonction : `app/api/sales/route.ts`, boucle `for (const l of lignes)` appelant `fn_stock_move`, lignes 166-187.
- Cause : la compensation sur échec (`DELETE vente_lignes` puis `DELETE ventes`)
  ne couvre que les deux tables `ventes`/`vente_lignes` — elle ne génère
  aucun mouvement `retour` pour annuler les `fn_stock_move` déjà réussis sur
  les lignes précédentes de la même vente.
- Impact : panier à 2 lignes, ligne 1 décrémente le stock avec succès, ligne 2
  échoue (stock insuffisant pour la ligne 2) → la vente est supprimée de
  `ventes`, mais la ligne de mouvement de stock de la ligne 1 **reste
  enregistrée**, avec `reference = vente.id` qui ne pointe plus vers aucune
  vente existante (pas de contrainte FK déclarée sur `stock_movements.reference`,
  confirmé par le schéma `lib/architecture/schema-contract.test.ts`) — stock
  physiquement décrémenté sans vente correspondante, invisible depuis l'UI
  ventes, visible seulement par requête directe sur `stock_movements`.
- Correction proposée (non appliquée ici) : avant de supprimer `vente_lignes`/
  `ventes` sur un échec de ligne *k*, émettre un `fn_stock_move(type='retour', ...)`
  pour chacune des lignes 1..k-1 déjà réussies, en réutilisant leur
  `origine`/`purchase_item_id` d'origine (même patron que
  `app/api/sales/[id]/reverse/route.ts`). Alternative plus profonde, hors
  scope immédiat : une fonction PL/pgSQL unique orchestrant tout le flux dans
  une seule transaction Postgres (changement architectural, jamais fait dans
  ce dépôt à ce jour).

**Anomalie A2 — VTE-002 (règlement) possible sans VTE-001 `processed`.**
- Fichier/fonction : `app/api/sales/[id]/paiement/route.ts` — condition
  vérifiée : `vente.statut_paiement === 'du'` uniquement.
- Cause : `statut_paiement='du'` est positionné à la création de la vente
  (avant tentative d'émission comptable), pas après confirmation que VTE-001
  a atteint le statut `processed` dans `accounting_events`.
- Impact : si VTE-001 a échoué à l'émission (la route renvoie 207 dans ce cas,
  donc le symptôme est visible côté caller), mais que l'UI/l'utilisateur
  procède quand même au règlement via `/paiement`, VTE-002 serait émis et
  traité (411 crédité) sans qu'un VTE-001 `processed` existe — un règlement
  comptable sans la dette correspondante en comptabilité (bien que le 411
  existe côté `ventes.statut_paiement`, la vue comptable réelle,
  `journal_entries`, resterait incohérente : crédit de 411 sans débit
  préalable).
- Correction proposée (non appliquée ici) : `paiement/route.ts` devrait
  vérifier l'existence d'un événement `accounting_events` `event_type='VTE-001'`,
  `source_id=id`, `status='processed'` avant d'émettre VTE-002, et refuser
  (409) sinon.

**`C6_ATOMICITY_REVIEW = PARTIAL`** — non-atomicité multi-appels documentée
honnêtement dès la conception (pas découverte ici), compensation existante
pour les 2 premiers points de défaillance, mais deux anomalies réelles et
précises trouvées à cette revue (A1 : stock orphelin sur échec multi-lignes ;
A2 : règlement possible sans vente comptable aboutie), ni l'une ni l'autre
corrigée dans cette mission.

## 6. Stock et provenance — scénarios tracés contre `fn_stock_move` (migration 184)

Logique relue §1 ci-dessus. Traçage des scénarios demandés :

- **100 achat_fournisseur + 100 production_locale, puis vente de 30
  achat_fournisseur + 20 production_locale** : chaque appel `fn_stock_move`
  avec `p_origine` fourni calcule `v_stock_origine` scopé à `product_id +
  origine` — le contrôle global (200 dispo, 50 demandé, OK) passe, puis le
  contrôle par provenance (100 achat dispo, 30 demandé, OK ; 100 production
  dispo, 20 demandé, OK). **Résultat attendu : 70 restant en
  achat_fournisseur, 80 restant en production_locale** — confirmé par la
  requête `v_products_stock_par_origine` qui `SUM(fn_stock_sign(type)*quantite)
  GROUP BY origine`. Logique correcte, pas de bascule automatique.
- **Vente de 81 sur un solde de 80 pour une provenance donnée** : le contrôle
  scopé (`v_stock_origine + v_sign*p_quantite < 0`) détecte `80 - 81 = -1 < 0`
  → `RAISE EXCEPTION 'Stock insuffisant pour la provenance...'` → la RPC
  retourne une erreur → la route traduit en 409. **Rejeté, confirmé par la
  logique SQL.**
- **Origine inexistante/invalide (ex. `'vol'`)** : double garde — la route
  TypeScript valide déjà `l.origine` contre les 3 valeurs autorisées avant
  tout appel RPC (`app/api/sales/route.ts` ligne 62-64, confirmé par le test
  "refuse une origine inconnue"), et `fn_stock_move` lui-même revalide
  (`IF p_origine IS NOT NULL AND p_origine NOT IN (...) THEN RAISE EXCEPTION`,
  ligne 118-121 de la migration 184) — défense en profondeur, **rejeté aux
  deux niveaux**, cohérent avec la CHECK constraint de la colonne.
- **Origine d'un autre tenant** (mouvement dont `purchase_item_id` appartient
  à un autre tenant, ou provenance "valide" en syntaxe mais sans lien réel
  avec le tenant appelant) : **point faible identifié, pas un bug actif mais
  une absence de contrôle** — `fn_stock_move` ne vérifie PAS que
  `p_purchase_item_id` appartient au `p_tenant_id` fourni (pas de `SELECT ...
  FROM purchase_items WHERE id=p_purchase_item_id AND tenant_id=p_tenant_id`
  dans le corps de la fonction relu ci-dessus). La FK
  `purchase_item_id REFERENCES purchase_items(id)` garantit seulement que la
  ligne d'achat EXISTE quelque part, pas qu'elle appartient au même tenant.
  **ANOMALIE B1, ci-dessous.**

**Anomalie B1 — `fn_stock_move` n'isole pas `purchase_item_id` par tenant.**
- Fichier/fonction : migration 184, `fn_stock_move`, corps complet (lignes 101-163).
- Cause : la fonction est `SECURITY` par défaut (pas `SECURITY DEFINER`
  explicite ici, donc exécutée avec les droits de l'appelant — mais appelée
  via `supabaseAdmin` côté route, donc avec le rôle `service_role` qui
  contourne RLS) ; aucune vérification applicative dans `fn_stock_move`
  lui-même que `purchase_item_id` appartient à `p_tenant_id`.
- Impact : si un appelant (route API avec un bug, ou un futur appelant moins
  rigoureux) transmet un `purchase_item_id` valide mais appartenant à un AUTRE
  tenant, la fonction l'accepte sans erreur — la ligne `stock_movements`
  créée référencerait une ligne d'achat d'un autre tenant. **Dans le flux
  actuel (`app/api/sales/route.ts`), ce risque est atténué mais pas éliminé
  structurellement** : la route transmet `l.purchase_item_id` tel que fourni
  par le CLIENT (`LigneInput.purchase_item_id`, body JSON) sans jamais
  vérifier côté serveur que cette ligne d'achat appartient à `ctx.tid` —
  **confirmé par relecture de `app/api/sales/route.ts`, aucun `SELECT
  purchase_items WHERE id=... AND tenant_id=...` n'existe dans ce fichier.**
  C'est une IDOR potentielle sur `purchase_item_id` si un client malveillant
  connaît ou devine l'UUID d'une ligne d'achat d'un autre tenant.
- Correction proposée (non appliquée ici) : dans `app/api/sales/route.ts`,
  avant l'appel à `fn_stock_move`, résoudre et valider chaque
  `purchase_item_id` fourni contre `purchase_items.tenant_id = ctx.tid`
  (même patron que la validation déjà faite pour `warehouse_id` et les
  `produit_id`), rejet 403 sinon. Alternativement/en complément, ajouter la
  vérification directement dans `fn_stock_move` (défense en profondeur,
  cohérent avec le double contrôle déjà appliqué pour `origine`).

**`C6_SECURITY_REVIEW` partiellement couvert ici — voir §9 pour la synthèse
tenant isolation complète.**

## 7. Coût des marchandises — comportement `prix_achat` NULL/0/>0

Code : `coutMarchandises = lignes.reduce((s,l) => s + l.qte * Number(p.prix_achat
?? 0), 0)` (`app/api/sales/route.ts` ligne 100-103).

- **`prix_achat` NULL** : `null ?? 0` → `0` → contribution de cette ligne au
  coût total = 0. **Comportement voulu, pas un bug** : aucune valorisation
  inventée (BOI-009 — ni PMP ni FIFO n'existent dans ce dépôt).
- **`prix_achat = 0`** : même résultat (0), indistinguable du cas NULL. Ce
  n'est pas un défaut du code — c'est une limite du modèle de données
  (`products.prix_achat` ne distingue pas "coût réellement nul" de "coût
  inconnu/non saisi").
- **`prix_achat > 0`** : contribution normale `qte × prix_achat`.
- **Agrégation au niveau ÉVÉNEMENT, pas au niveau ligne** : `coutMarchandises`
  est une SOMME sur toutes les lignes du panier avant d'être transmise à
  `emit_accounting_event` comme `metadata.cout_marchandises` — la séquence 7
  de VTE-001 évalue sa condition (`>0`) et son montant sur cette somme
  agrégée, pas ligne par ligne. **Conséquence vérifiée et correcte** : un
  panier mixte (une ligne à coût connu + une ligne à coût NULL) produit une
  seule écriture 601/311 reflétant uniquement la somme des coûts connus — pas
  une erreur, pas une valeur inventée pour la ligne inconnue.
- **Cas limite à signaler à l'équipe métier, pas une anomalie de code** : si
  TOUTES les lignes d'une vente ont `prix_achat` NULL/0, `coutMarchandises=0`
  → la condition de séquence 7 échoue → **aucune écriture 601/311n'est
  créée pour cette vente**, alors que le stock a bel et bien été décrémenté
  par `fn_stock_move`. Le chiffre d'affaires (701/4441/447) est comptabilisé
  normalement, mais sans coût en face — un rapport de marge basé sur
  `journal_entries` afficherait une marge de 100% sur cette vente. Ce n'est
  pas un bug (le moteur ne peut pas inventer un coût), mais c'est une
  **limite métier à documenter pour l'équipe comptable** : tout produit sans
  `prix_achat` saisi fausse silencieusement les rapports de marge dérivés de
  VTE-001.

## 8. Fiscalité — cohérence et absence de taux codés en dur

- Recherche fraîche dans cette session (pas une réaffirmation) : les deux
  fichiers du nouveau flux (`app/api/sales/route.ts`,
  `app/dashboard/commerce/page.tsx`) ont été relus intégralement plus haut
  dans cette revue (route) et dans une session antérieure revérifiée par le
  test statique `vente-canonique.test.ts` (commerce/page.tsx) — aucune
  occurrence de `0.18`, `0.05`, `0.189`, `0.075` dans le code exécuté (hors
  commentaires, filtrés par `readCodeOnly()`). Seul point de calcul fiscal :
  `decomposerTTCUnifie(totalTTC, 'CG')`, relu dans cette session
  (`lib/fiscalite/engine-adapter.ts` lignes 238-257) — dérive HT/TVA/CA
  depuis la config centrale du pays (`getCountryConfig(pays).tva.taux_normal`
  et `.taxes_additionnelles`), jamais un taux recopié localement.
- **Cohérence `ht + tva + ca = ttc`** : garantie par construction de
  `decomposerTTCUnifie` (`ca := tvaPlusCa - tva`, `tvaPlusCa := montantTTC -
  ht`) — identité algébrique exacte, pas d'arrondi qui dérive (les deux
  `Math.round` sont appliqués à `ht` et `tva` séparément, `ca` absorbe le
  reste par soustraction, donc la somme totale reste toujours exactement
  `montantTTC`).
- **TVA=0 (vente exonérée)** : si l'appelant transmet `montant_tva=0` (décidé
  en amont, jamais recalculé par le moteur), la condition
  `montant_tva > 0` des séquences 2/5 échoue → aucune écriture TVA créée —
  cohérent, pas une anomalie.
- **Nommage `ventes.total/montant_ht/montant_tva/montant_ca`** : vérifié
  cohérent entre la migration 185, le code de la route (`venteInsert`), et le
  test statique — `total` porte le TTC (colonne historique, jamais renommée),
  `montant_ht/tva/ca` sont les 3 nouvelles colonnes. Pas de confusion
  `total_ht` vs `montant_ht` dans le code réel (seulement dans le libellé du
  mandat de cette revue, déjà clarifié en préambule).

## 9. Isolation tenant — tous les points d'accès

Points d'accès audités, avec le mécanisme réel vérifié pour chacun :

| Ressource | Route | Mécanisme |
|---|---|---|
| Session/tenant | toutes les routes `/api/sales*` | `requireTenant(req)`/`requireRole('admin', req)` — relu intégralement (`lib/api/require-tenant.ts`), résout `tenant_id` via `profiles.user_id=auth.uid()` avec `.order('created_at',{ascending:true}).limit(1)` (patron du correctif multi-tenant déjà en mémoire de mission), **jamais** depuis le body/query client (confirmé par le test statique, aucune occurrence `body.tenant_id`/`searchParams.get('tenant_id')`) |
| `warehouse_id` | POST /api/sales | `SELECT warehouses WHERE id=... AND tenant_id=ctx.tid` avant tout usage — 403 si absent. Correct. |
| `produit_id` (panier) | POST /api/sales | `SELECT products WHERE tenant_id=ctx.tid AND id IN (...)`, puis diff `manquants` → 403 si un ID n'appartient pas au tenant. Correct, et testé (`sales-route.integration.test.ts`, "produit hors tenant"). |
| `purchase_item_id` (panier) | POST /api/sales | **Non vérifié contre le tenant appelant — Anomalie B1 (§6)**. |
| `client`/`destinataire` | POST /api/sales | Simple chaîne libre (pas une FK vers une table clients scopée tenant) — pas de risque d'accès inter-tenant puisque ce n'est pas une référence. |
| `vente_id` (lecture/détail) | GET /api/sales/:id | `eq('tenant_id', ctx.tid)` — à vérifier à la lecture du fichier (non relu dans cette session ; comportement attendu décrit dans le résumé de mission antérieure, non re-vérifié ici par discipline — voir réserve ci-dessous). |
| `vente_id` (règlement) | POST /api/sales/:id/paiement | Non relu dans cette session (résumé de mission antérieure) — réserve identique. |
| `vente_id` (extourne) | POST /api/sales/:id/reverse | Relu intégralement dans cette session : `requireRole('admin')`, puis `SELECT ventes WHERE id=... AND tenant_id=ctx.tid` avant toute action — 404 si absent/autre tenant. Correct. |
| `stock_movements` (extourne) | POST /api/sales/:id/reverse | `eq('tenant_id', ctx.tid).eq('reference', id)` — scopé tenant. Correct. |
| `accounting_events` (extourne) | POST /api/sales/:id/reverse | `eq('tenant_id', ctx.tid).eq('source_table','ventes').eq('source_id', id)` — scopé tenant. Correct. |

**Réserve explicite** : `app/api/sales/[id]/route.ts` et
`app/api/sales/[id]/paiement/route.ts` n'ont pas été relus mot à mot DANS
CETTE session (budget de revue concentré sur les fichiers à plus haut risque
— route principale, reverse, migrations, moteur). Leur comportement décrit
ici provient de la mission d'implémentation antérieure et du test statique
qui vérifie leur usage de `requireTenant`/`require-tenant.ts` — **pas
re-vérifié ligne à ligne dans cette revue**. Ne pas compter ceci comme
"vérifié à 100%" — c'est une limite honnête de cette revue, pas une
affirmation de correction totale.

**Scénarios de test cross-tenant à exécuter réellement, dès que le canal DB
est disponible** (aucun exécuté ici, DB indisponible — §13) :
1. Tenant A crée un produit ; tenant B tente une vente avec ce `produit_id` → attendu 403.
2. Tenant A crée un entrepôt ; tenant B tente une vente avec ce `warehouse_id` → attendu 403.
3. Tenant A crée une ligne d'achat (`purchase_items`) ; tenant B tente une vente avec ce `purchase_item_id` → **attendu 403, actuellement NON appliqué (anomalie B1) — ce test est censé ÉCHOUER tel que le code existe aujourd'hui.**
4. Tenant A crée une vente ; tenant B tente `GET /api/sales/:id` sur cet ID → attendu 404/403 (à revérifier ligne à ligne avant exécution, réserve ci-dessus).
5. Tenant A crée une vente à crédit ; tenant B (admin de B) tente `POST /api/sales/:id/reverse` sur cet ID → attendu 404 (mécanisme confirmé correct au point précédent de ce tableau).

**`C6_SECURITY_REVIEW = PARTIAL`** — isolation correcte et vérifiée sur la
majorité des points d'accès (tenant, warehouse, produit, reverse complet),
une anomalie réelle trouvée et non corrigée (B1, `purchase_item_id`), et deux
fichiers non relus ligne à ligne dans cette session précise (réserve
explicite, pas une affirmation de défaut ni de correction).

## 10. Stocks/sorties — confirmation de non-régression des 5 autres raisons

Résumé de mission antérieure (implémentation), réaffirmé ici par relecture du
test statique correspondant plutôt que re-lu intégralement dans cette session :
`vente-canonique.test.ts` vérifie que `handleCreate()` dans
`app/dashboard/stocks/sorties/page.tsx` route en premier lieu
`type_sortie==='vente'` vers `handleCreateVente()` (→ `/api/sales`), et que le
code gérant `['perte','don'].includes(form.type_sortie)` via
`writeComptaEntry` (comptes 658/311) existe toujours tel quel. Les 3 autres
raisons historiques de sortie (hors `vente`/`perte`/`don` — selon
`C6-IMPLEMENTATION-REPORT.md`, les 6 raisons au total étaient recensées avant
cette mission) n'ont pas de test dédié dans cette revue mais n'ont fait
l'objet d'AUCUNE modification du fichier au-delà de l'ajout de la branche
`vente` en tête de `handleCreate()` — une modification additive (un nouveau
`if` qui `return` plus tôt pour un seul cas précis) ne peut pas, par
construction, affecter le comportement des branches qui suivent pour les
autres valeurs de `type_sortie`.

## 11. Reverse — complétude honnête

Relu intégralement dans cette session (`app/api/sales/[id]/reverse/route.ts`) :

- **Couvert** : extourne de chaque `accounting_events` `processed`
  (`source_table='ventes'`) via `fn_reverse_accounting_event` (moteur
  générique, pas de second moteur créé — confirmé par absence de toute
  logique `debit_account = credit_account` manuelle dans ce fichier), avec
  ordre explicite VTE-002 avant VTE-001 si les deux existent (tri
  `(a.event_type==='VTE-002'?-1:0) - (...)`) — correct pour que le solde 411
  reste cohérent à chaque étape intermédiaire. Retour de stock via
  `fn_stock_move(type='retour', ...)` par mouvement original trouvé via
  `stock_movements WHERE reference=id AND type='sortie'`, réutilisant
  `origine`/`purchase_item_id` d'ORIGINE (pas re-dérivés depuis
  `vente_lignes`, qui ne porte pas cette information) — correct.
- **Non couvert, documenté dans le fichier lui-même** (pas caché) : ces
  étapes (extourne comptable puis retours de stock) sont des appels RPC
  indépendants, pas une transaction unique — une défaillance après la
  première extourne laisse un état partiel (comptabilité extournée, stock pas
  encore retourné), à corriger manuellement. Le code renvoie 207 dans ce cas,
  pas un faux succès.
- **Non couvert, pas mentionné dans le fichier, trouvé à cette revue** :
  aucune vérification que le mouvement de stock_movements `origine='sortie'`
  retrouvé n'a pas DÉJÀ été retourné par une extourne précédente (pas de
  protection équivalente à `accounting_event_extournes.UNIQUE(original_event_id)`
  côté stock). Une extourne appelée deux fois sur la même vente (double-clic,
  retry) extournerait la comptabilité une seule fois (protégé par
  `accounting_event_extournes`), **mais générerait un second retour de stock
  pour les mêmes mouvements** (pas protégé). **ANOMALIE C1, ci-dessous.**

**Anomalie C1 — `/api/sales/:id/reverse` n'est pas idempotent côté stock.**
- Fichier/fonction : `app/api/sales/[id]/reverse/route.ts`, boucle de retour de stock (lignes 66-90).
- Cause : la boucle retrouve les mouvements `type='sortie'` par `reference=id`
  et émet un retour pour CHACUN, sans vérifier qu'un retour correspondant
  n'existe pas déjà (ex. `stock_movements WHERE reference=id AND
  type='retour'`).
- Impact : un double appel à cette route (retry client, double-clic admin)
  créerait un second jeu de mouvements `retour`, remettant en stock une
  quantité DEUX FOIS supérieure à ce qui avait été vendu — sur-crédit de
  stock.
- Correction proposée (non appliquée ici) : avant la boucle, vérifier
  l'absence de mouvements `type='retour'` déjà liés à `reference=id` (ou
  plus robuste, une contrainte d'idempotence dédiée sur ces retours), refuser
  si déjà fait.

**`C6_PREPROD` tiendra compte de cette anomalie dans la synthèse finale (§16).**

## 12. Classification stricte des 33 tests

- **Tests statiques (lecture de source, aucune exécution de logique métier)**
  — `lib/architecture/vente-canonique.test.ts` : 25 tests. Prouvent une
  propriété du CODE SOURCE (présence d'un pattern, absence d'un autre), pas
  un comportement d'exécution.
- **Tests d'intégration mockés (exécutent réellement le handler de route
  contre un faux client Supabase programmable, pas une base réelle)** —
  `lib/architecture/sales-route.integration.test.ts` : 8 tests. Prouvent
  l'ORCHESTRATION réelle du code (ordre des appels, données transmises aux
  RPC, branches idempotence/compensation) — **PAS** le comportement réel de
  Postgres (contraintes UNIQUE, triggers, RPC PL/pgSQL), qui sont simulés par
  des réponses programmées.
- **Pas de "test réel contre fonction DB"** dans ce total de 33 — aucun test
  de cette mission n'exécute une vraie fonction PostgreSQL (`fn_stock_move`,
  `emit_accounting_event`, `fn_ae_execute_event`) contre un Postgres réel : le
  canal DB est indisponible (§13).
- **Pas de "test pur unitaire" isolé** au sens d'une fonction pure testée hors
  framework (type `decomposerTTCUnifie`) dans ce lot des 33 — ce calcul est
  couvert indirectement par l'assertion `ae.p_montant_ttc).toBe(40000)` du
  test d'intégration mocké, pas par un test unitaire dédié dans ce lot.

**Propriétés classées** :

| Propriété | Statut | Preuve |
|---|---|---|
| Gateway tenant utilisé partout, pas de `tenant_id` client | **PROUVÉE** | Statique, 4 routes vérifiées |
| 7 séquences VTE-001 + 1 VTE-002, comptes corrects | **PROUVÉE** | Statique (migration) + relecture moteur fraîche cette session (§3) |
| Ordre des séquences sans impact sur la correction | **PROUVÉE** | Lecture directe de `fn_ae_execute_event`, cette session (§3.2) |
| `prix_achat` jamais remplacé par une valorisation inventée | **PROUVÉE** | Statique (absence PMP/FIFO) + relecture du calcul (§7) |
| Idempotence — INSERT puis catch 23505, jamais SELECT préalable | **PROUVÉE** (ordre du code) / **PARTIELLEMENT PROUVÉE** (comportement sous vraie contrainte UNIQUE) | Statique + mocké ; pas de contrainte réelle exécutée |
| Compensation sur échec lignes/stock | **PARTIELLEMENT PROUVÉE** | Mocké pour le cas simple ; anomalie A1 trouvée pour le cas multi-lignes (§5) |
| Atomicité du flux complet | **NON PROUVÉE DANS LE SENS D'UNE TRANSACTION UNIQUE — ET CONFIRMÉE NON-ATOMIQUE PAR CONCEPTION** | Lecture de code ; c'est une propriété ABSENTE, pas juste non testée |
| Stock scopé par provenance (rejets 81/80, origine invalide) | **PROUVÉE** (logique SQL relue) / **NON TESTÉE EN EXÉCUTION RÉELLE** | Lecture directe de `fn_stock_move`, cette session (§6) ; aucune exécution Postgres |
| Isolation tenant sur produit/warehouse/reverse | **PROUVÉE** | Relecture directe + test mocké pour produit |
| Isolation tenant sur `purchase_item_id` | **NON PROUVÉE — ET INFIRMÉE** (anomalie B1) | Lecture directe, absence confirmée du contrôle |
| Reverse comptable + stock, ordre VTE-002 avant VTE-001 | **PROUVÉE** | Relecture directe cette session |
| Reverse idempotent côté stock | **NON PROUVÉE — ET INFIRMÉE** (anomalie C1) | Lecture directe, absence confirmée du contrôle |
| Concurrence réelle (scénario C, double POST simultané) | **NON TESTABLE** | Canal DB indisponible, aucun mock ne peut en tenir lieu |

## 13. Canal DB — état vérifié une seule fois dans cette session

Vérifications effectuées (lecture seule, aucune installation, aucune
modification) :
- **MCP** (`postgres`, `supabase`, `supabase-moonbank`) : tous en échec de
  connexion (`CONNECT_TIMEOUT`), confirmé par l'environnement de cette
  session.
- **Docker** : `docker ps` → `failed to connect to the docker API ... open
  //./pipe/dockerDesktopLinuxEngine: The system cannot find the file
  specified` — Docker Desktop n'est pas démarré/disponible.
- **psql** : absent du PATH (`which psql` → introuvable).
- **PostgREST** : les variables d'environnement (`NEXT_PUBLIC_SUPABASE_URL`,
  `SUPABASE_SERVICE_ROLE_KEY`) sont présentes — PostgREST reste utilisable
  pour l'introspection de schéma/RPC (comme dans toutes les missions
  précédentes), **mais ne permet aucune transaction multi-étapes ni
  l'exécution directe de SQL arbitraire** — canal insuffisant pour exécuter
  les migrations ou les tests de concurrence réels requis par cette revue.
- **Supabase CLI** : non revérifiée dans cette session (connue bloquée depuis
  les missions précédentes — `db push` inutilisable, `deploy` refusé par le
  classificateur, cf. mémoire `reference_moonbank_location_and_tooling` pour
  un contexte similaire sur un autre dépôt ; pour Oraforme, confirmé
  indisponible dans `C6-PREIMPLEMENTATION-GATE.md`, non re-testé ici pour
  éviter de multiplier les tentatives de connexion).

**`DB_TRANSACTION_CHANNEL = UNAVAILABLE`** — confirmé, conforme à toutes les
missions précédentes de cet engagement.

## 14. Risques restants (synthèse, hors anomalies déjà listées)

- Les migrations 184/185, bien que jugées `READY_FOR_EXECUTION=YES`, n'ont
  jamais été exécutées contre un vrai Postgres — le risque générique "la
  réalité de production diffère du dernier diagnostic" (déjà matérialisé une
  fois dans cet engagement avec la découverte des 7 séquences) reste présent
  jusqu'à l'exécution réelle.
- `fn_ae_is_income`/`fn_ae_has_treasury_impact` restent non modifiées,
  documenté comme vestigial pour le solde réel (migration 175) — mais un
  éventuel rapport encore basé sur cette liste legacy resterait incorrect
  pour VTE-001 comptant (risque déjà documenté dans la migration elle-même,
  pas nouveau ici).
- Le calcul `decomposerTTCUnifie` lui-même (taux CEMAC par pays) n'a pas été
  ré-audité dans cette revue — hérité tel qu'utilisé par BOI-001, hors
  périmètre explicite de cette mission.

## 15. Procédure de validation future (14 étapes, aucune donnée réelle)

1. Introspection PostgREST fraîche : revérifier la signature exacte actuelle
   de `fn_stock_move` (8 paramètres attendus avant 184) — ne pas supposer
   qu'elle n'a pas changé depuis `C6-PREIMPLEMENTATION-GATE.md`.
2. Appliquer la migration 184 (environnement de test/recette isolé, jamais
   directement en production sans ce préalable).
3. Vérifier 184 : `SELECT column_name ... WHERE table_name='stock_movements'
   AND column_name IN ('origine','purchase_item_id')` → 2 lignes ;
   `SELECT pg_get_functiondef('fn_stock_move'::regproc)` → 10 paramètres.
4. Appliquer la migration 185.
5. Vérifier 185 : les 6 colonnes `ventes`, et `SELECT event_type, sequence,
   ... FROM accounting_event_rules WHERE event_type IN ('VTE-001','VTE-002')`
   → 7 + 1 lignes, toutes `active`.
6. Créer un tenant/produit/entrepôt de TEST isolé (jamais de donnée réelle),
   avec un `produits.prix_achat` connu non nul.
7. Créer une vente comptant isolée via `POST /api/sales` (clé d'idempotence
   générée) ; vérifier le code 201 et la présence de `vente_lignes`.
8. Vérifier le stock : `stock_movements` contient bien 1 ligne `type='sortie'`
   avec l'`origine` demandée, et `v_products_stock_par_origine` reflète la
   décrémentation attendue.
9. Vérifier `journal_entries` : 3 ou 4 lignes selon TVA/CA>0 (séq.1-3 + 7),
   comptes et montants conformes à la matrice §3.3, `accounting_events.status
   = 'processed'`.
10. Vérifier TVA/CA : recalculer manuellement `ht+tva+ca=ttc` sur le montant
    de test, comparer aux lignes `journal_entries` réelles.
11. Tester une vente à crédit isolée, puis son règlement via
    `/api/sales/:id/paiement` ; vérifier VTE-002 et `statut_paiement='solde'`.
12. Tester la concurrence réelle (scénario C, §4) : deux requêtes `POST
    /api/sales` strictement simultanées avec la MÊME `idempotency_key`, sur
    des données de test — vérifier qu'une seule vente existe et qu'une seule
    chaîne stock+comptabilité a été exécutée.
13. Tester l'isolation tenant réelle : les 5 scénarios cross-tenant listés au
    §9 (en particulier le scénario 3, `purchase_item_id` d'un autre tenant,
    attendu pour ÉCHOUER tant que l'anomalie B1 n'est pas corrigée — objectif
    de ce test : confirmer l'anomalie avant correction, pas la découvrir).
14. Nettoyage contrôlé des données de test créées (ventes, mouvements,
    événements comptables, lignes de test) puis re-validation de
    non-régression sur un flux existant déjà en production (ex. une création
    de facture BOI-001/FAC-001 normale) pour confirmer l'absence d'effet de
    bord des migrations 184/185 sur les flux non touchés.

---

## Verdicts

- `C6_184_REVIEW = PASS`
- `C6_185_REVIEW = PASS`
- `C6_VTE001_REVIEW = PASS`
- `C6_IDEMPOTENCE_REVIEW = PARTIAL`
- `C6_ATOMICITY_REVIEW = PARTIAL`
- `C6_SECURITY_REVIEW = PARTIAL`
- `C6_PREPROD = PARTIAL`

**Justification de `C6_PREPROD = PARTIAL`** : les deux migrations sont saines
et prêtes à l'exécution ; le moteur comptable VTE-001/VTE-002 est vérifié
correct de bout en bout contre le code réel du moteur (pas supposé). Mais
cette revue a trouvé **quatre anomalies réelles, non corrigées par consigne
de mission** (A1 : stock orphelin sur échec multi-lignes ; A2 : règlement
crédit possible sans vente comptable aboutie ; B1 : `purchase_item_id` non
isolé par tenant — IDOR potentielle ; C1 : extourne non idempotente côté
stock), et un **canal DB toujours indisponible**, ce qui laisse `PARTIAL` sur
l'idempotence (scénario de concurrence réelle non testable), l'atomicité
(propriété absente par construction, pas juste non prouvée) et la sécurité
(une anomalie confirmée). Recommandation : corriger au minimum B1 (sécurité,
IDOR cross-tenant) avant toute exécution en production, puis exécuter la
procédure en 14 étapes (§15) en environnement isolé avant tout déploiement
réel.

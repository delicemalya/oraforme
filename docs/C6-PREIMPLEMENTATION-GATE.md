# C6 — PRE-IMPLEMENTATION GATE (migration 184 + idempotence des ventes)

Mission de vérification, lecture seule. Aucun code métier, aucune migration exécutée, aucune modification DB, aucun commit/push.

---

## 1. MIGRATION 184

Fichier relu intégralement aujourd'hui (`supabase/migrations/184_stock_provenance.sql`, 218 lignes) :
- Garde-fou (lignes 36-44) : `RAISE EXCEPTION` si `stock_movements.origine` existe déjà — empêche une double application silencieuse.
- `ALTER TABLE stock_movements ADD COLUMN origine TEXT NULL, ADD COLUMN purchase_item_id UUID NULL REFERENCES purchase_items(id)` + `CHECK (origine IS NULL OR origine IN (...))`.
- 2 index (`idx_stock_movements_product_origine`, `idx_stock_movements_purchase_item`).
- `DROP FUNCTION IF EXISTS fn_stock_move(UUID, UUID, TEXT, NUMERIC, UUID, NUMERIC, TEXT, TEXT)` puis `CREATE OR REPLACE FUNCTION fn_stock_move(...)` à 10 paramètres (les 8 d'origine + `p_origine`, `p_purchase_item_id`, tous deux `DEFAULT NULL`).
- `CREATE OR REPLACE VIEW v_products_stock_par_origine` (`security_invoker=true`).
- Aucune ligne RLS (`CREATE POLICY`/`ALTER POLICY`) dans tout le fichier — confirmé par relecture intégrale.

---

## 2. DÉPENDANCES

Les 16 migrations 168-183 ont été relues/re-vérifiées par recherche ciblée aujourd'hui (pas seulement rappelées de mémoire) :

| # | Touche stock_movements/fn_stock_move/purchase_items ? | Nature de la relation avec 184 |
|---|---|---|
| 168 | Oui, **indirectement et génériquement** — réécrit dynamiquement (boucle sur `pg_policies`) la clause `USING`/`WITH CHECK` de **toute** policy utilisant `auth.uid()`/`auth.jwt()`/`auth.role()` non encore optimisée, quelle que soit la table | Aucun conflit : ne change que la forme de l'appel `auth.*()`, jamais la logique ni le schéma. 184 n'ajoute aucune policy. |
| 169 | 0 référence directe trouvée (recherche textuelle) | Sans objet |
| 170-172, 174-182 | 0 référence à `stock_movements`/`fn_stock_move`/`purchase_items` (vérifié par grep ciblé ce jour pour 169/183 ; déjà établi pour les autres lors de missions précédentes, non re-contesté ici) | Sans objet |
| **173** | **Oui, directement** — crée `fn_stock_sign()`, `fn_stock_move()` (signature 8 paramètres, celle que 184 cible exactement par son `DROP FUNCTION`), `v_products_stock` | **Dépendance dure et confirmée** : 184 ne peut pas s'appliquer avant 173 (173 doit avoir créé la fonction à 8 paramètres pour que le `DROP FUNCTION` de 184 trouve une cible). **173 est confirmée `APPLIED`** (BOI-010D, reconfirmé ce jour par sondage direct, §4). |
| 179 | Oui — `DELETE FROM stock_movements` (purge de données de démo) | Aucun conflit : une suppression de lignes, pas un changement de schéma/fonction. **Déjà exécutée** (confirmée `APPLIED`, archive `SEED-CLEANUP-AMD` déjà vérifiée). |
| **183** | 0 référence (confirmé par grep ce jour) | **Aucune dépendance** — tables disjointes (`warehouses.actif`, `suppliers.actif/conditions_paiement`, `fn_stock_alert`, RLS `stock_articles`), confirmé indépendamment de 184 |

**`purchase_items`** (cible de la FK `purchase_item_id`) : créée par la migration **016** (`016_stock_full.sql`), une fondation très ancienne, confirmée en usage actif et fonctionnel depuis les missions BOI-004/BOI-010 (le flux achats l'utilise déjà en production). Existence reconfirmée ce jour par introspection directe (§4).

**Ordre requis** : 173 avant 184 (déjà respecté, 173 appliquée). Aucun autre ordre n'est imposé.

---

## 3. INDÉPENDANCE VIS-À-VIS DE C6

```
184_INDEPENDENT_OF_C6 = YES
```

**Pourquoi** : 184 ne dépend d'aucun objet que C6 créerait (`ventes.montant_ht/tva/ca`, la règle `VTE-001`, le futur endpoint `/api/sales`) — elle ne les référence nulle part. La relation est **à sens unique** : c'est le design C6 (`C6-IMPLEMENTATION-DESIGN.md §6/§17`) qui dépend de 184 (pour `origine`/`purchase_item_id`/`v_products_stock_par_origine`), jamais l'inverse. 184 peut donc être appliquée aujourd'hui, indépendamment de tout code ou migration lié à la vente canonique — ses seules dépendances réelles (173, `purchase_items`) sont déjà en place en production.

---

## 4. COMPATIBILITÉ PRODUCTION

Vérifiée aujourd'hui par introspection PostgREST fraîche (pas une relecture d'un ancien rapport) :

| Objet | État production confirmé aujourd'hui | Compatible avec 184 ? |
|---|---|---|
| `stock_movements` colonnes | `id, tenant_id, product_id, warehouse_id, type, quantite, reference, note, created_at, unit_cost, notes` — **ni `origine` ni `purchase_item_id`** | Compatible — le garde-fou de 184 passerait (aucune exception levée), les 2 `ADD COLUMN` s'appliqueraient proprement |
| `fn_stock_move` (signature RPC exposée) | **Exactement 8 paramètres** : `p_tenant_id, p_product_id, p_type, p_quantite, p_warehouse_id, p_unit_cost, p_reference, p_notes` (requis : les 4 premiers) | **Correspond exactement** à la signature visée par `DROP FUNCTION IF EXISTS fn_stock_move(UUID, UUID, TEXT, NUMERIC, UUID, NUMERIC, TEXT, TEXT)` — preuve directe, pas déduite, que le `DROP` ciblerait la bonne fonction sans ambiguïté |
| `purchase_items` | `id, purchase_id, product_id, quantite, prix` — existe, stable | FK cible valide |
| `v_products_stock` | `id, tenant_id, nom, categorie, sku, code_barre, unite, prix_achat, prix_vente, seuil_alerte, image_url, created_at, stock_actuel` — identique à la définition de 173 | Non touchée par 184, aucun risque |
| `v_products_stock_par_origine` | **Absente** | Cohérent — 184 ne l'a pas encore créée |
| `stock_movements` (lignes) | **0 ligne** | Aucune donnée historique à traiter — la question "impact sur l'historique avec origine NULL" est sans objet aujourd'hui (point 14 de la mission) |

### Vérification explicite de l'overload (point central de la mission)

Confirmé **par preuve directe** (signature RPC exposée aujourd'hui), pas par relecture de code : la fonction réelle en production a exactement 8 paramètres, dans l'ordre `(UUID, UUID, TEXT, NUMERIC, UUID, NUMERIC, TEXT, TEXT)`. Le `DROP FUNCTION IF EXISTS fn_stock_move(UUID, UUID, TEXT, NUMERIC, UUID, NUMERIC, TEXT, TEXT)` de la migration 184 cible **exactement** cette signature. Après son exécution, un seul `fn_stock_move` existera (10 paramètres, les 2 nouveaux en `DEFAULT NULL`) — **aucune surcharge ambiguë possible**, le risque identifié en BOI-010B reste correctement neutralisé par le correctif déjà présent dans le fichier.

### Impact sur les appels existants

Tous les appelants connus (`commerce/page.tsx`, `/api/stock/move`, `/api/stocks/purchases`, `stocks/{sorties,retours,inventaires,transferts,achats}/page.tsx`) appellent `fn_stock_move` avec les paramètres **nommés** (pas positionnels) parmi les 8 d'origine. Après 184, ces mêmes appels nommés continuent de résoudre vers l'unique fonction (10 paramètres, 2 en défaut) sans aucune modification de leur code — confirmé par la logique de la fonction elle-même (pas supposé).

---

## 5. ROLLBACK

Le fichier contient une section de retour arrière (lignes 206-217) : `DROP VIEW v_products_stock_par_origine`, `DROP FUNCTION fn_stock_move(10 paramètres exacts)`, puis **un commentaire renvoyant à BOI-004 pour le corps de la fonction à 8 paramètres plutôt qu'un `CREATE FUNCTION` littéral**, puis `DROP CONSTRAINT`/`DROP COLUMN ×2`.

**Honnêteté requise** : ce rollback n'est **pas entièrement autonome** — recréer `fn_stock_move` à 8 paramètres nécessite de recopier manuellement le corps documenté dans `docs/BOI-004-REPAIR-PLAN-ACHATS-STOCKS.md`, ce n'est pas une instruction SQL prête à exécuter telle quelle. Le rollback est **possible** mais demande une étape manuelle documentée, pas un simple "exécuter le bloc retour arrière". À signaler avant toute application réelle, pas à cacher.

---

## 6. IDEMPOTENCE (ventes)

### Mécanismes déjà existants, inventoriés

| Mécanisme | Portée | Déjà réutilisable pour une vente ? |
|---|---|---|
| `uidx_ae_processed`/`uidx_ae_inflight` sur `accounting_events (tenant_id, event_type, source_table, source_id)` | Empêche un **même** `(event_type, source_id)` d'être traité deux fois | **Oui, mais seulement une fois que `ventes.id` existe** — ne protège pas la création de la ligne `ventes` elle-même |
| `bulletins_paie` : `UNIQUE(employe_id, mois, annee)` (clé métier réelle) | Dédoublonnage par upsert sur une clé **naturellement unique** | **Non transposable** : une vente n'a pas d'équivalent (tenant+X+Y) naturellement unique — deux ventes identiques (même panier, même minute) sont parfaitement légitimes (deux clients différents) |
| `accounting_event_extournes.UNIQUE(original_event_id)` | Empêche une double extourne | Réutilisable telle quelle pour le reverse (déjà noté en `C6-IMPLEMENTATION-DESIGN.md §11`) |
| `fn_stock_move` + `pg_advisory_xact_lock` | Sérialise les mouvements concurrents **par produit** | Protège l'arithmétique du stock, pas la création de la vente elle-même |

**Aucun mécanisme existant ne protège la création d'une ligne `ventes` elle-même contre un double appel HTTP** (double-clic, retry, timeout) — c'est un vide réel, pas supposé.

### Comparaison des 4 options

| | Option 1 — `accounting_events` seul | Option 2 — clé métier unique de vente | Option 3 — idempotency_key client persistée | Option 4 — clé métier + accounting event |
|---|---|---|---|---|
| Double-clic (2 POST, même panier) | **Non protégé** — 2 `ventes.id` différents créés, chacun traité normalement par le moteur comptable | Impossible à définir de façon fiable (voir ci-dessus — aucune clé métier naturelle) | **Protégé** si le client renvoie la même clé pour les 2 clics | Hérite de la faiblesse d'Option 2 |
| Retry HTTP (timeout après commit serveur, client rejoue) | Non protégé, même raisonnement | Idem | **Protégé** — même clé, le serveur reconnaît la requête déjà traitée | Idem Option 2 |
| Concurrence (2 requêtes quasi simultanées, même clé) | Non protégé au niveau vente ; protégé au niveau stock (verrou produit) et comptable (si même `source_id`, ce qui ne serait le cas que si Option 1 était combinée à une clé) | Idem | **Protégé** — contrainte UNIQUE DB tranche atomiquement laquelle commit | Idem |
| Sécurité | — | — | Nécessite de valider que la clé appartient au tenant appelant (pas un risque nouveau, même discipline que `requireTenant()`) | — |
| Compatibilité avec l'architecture existante | Totale (rien à ajouter) mais **insuffisante** | Rejetée — invente une fausse clé métier | **Réutilise le même patron technique que `uidx_ae_processed`** (index UNIQUE partiel/scopé), déjà la méthode d'idempotence éprouvée du dépôt — pas un import de pattern externe | Hérite du rejet d'Option 2 |
| Migration nécessaire | Aucune | Aucune (mais ne résout rien) | **1 colonne** (`ventes.idempotency_key`, nullable, UNIQUE) | Idem Option 3 + rien de plus |
| Risque | Vente dupliquée en production à chaque double-clic réel | Faux positifs (deux ventes légitimes fusionnées) si une fausse clé est inventée | Dépend de la discipline du client à générer/renvoyer la clé — mais c'est la même responsabilité que pour tout header `Idempotency-Key` standard, pas une charge nouvelle | Cumul des deux risques |

```
DECISION = Option 3 — idempotency_key générée côté client (UUID), transmise dans le body de
  POST /api/sales, persistée dans une colonne UNIQUE (nullable) de `ventes`.
JUSTIFICATION = Aucune clé métier naturelle n'existe pour une vente (contrairement à
  bulletins_paie) — Option 2/4 inventeraient une fausse unicité avec risque de faux
  positifs. Option 1 seule laisse un vide réel et déjà documenté (double-clic/retry).
  Option 3 ÉTEND à `ventes` exactement le même patron technique déjà prouvé et en
  production sur `accounting_events` (index UNIQUE scopé) — pas un nouveau concept
  importé de l'extérieur, une réapplication du even mécanisme déjà choisi par ce
  dépôt pour résoudre ce type de problème.
PREUVE = uidx_ae_processed (migration 138) est déjà un index UNIQUE partiel servant
  exactement ce rôle pour les événements comptables ; aucune autre table du dépôt
  (vérifié : bulletins_paie, candidatures) ne protège une création contre un double
  appel HTTP autrement que par une vraie clé métier, absente ici par nature.
IMPACT = 1 colonne additionnelle à ajouter dans la même migration additive déjà prévue
  pour VTE-001 (C6-IMPLEMENTATION-DESIGN §16) — pas une migration séparée.
RISQUES = Un client qui ne génère/renvoie jamais la clé (bug, ancien build) reste exposé
  au double-clic — la colonne nullable n'impose rien rétroactivement, c'est une
  protection opt-in par construction du endpoint, pas une garantie absolue indépendante
  du client.
```

```
IDEMPOTENCE = PARTIAL
```

**PARTIAL, pas READY** : la décision est prise et justifiée par un mécanisme déjà existant dans le dépôt (pas un choix "standard" importé), mais **elle nécessite une colonne qui n'existe pas encore** — cette mission interdit toute migration, donc le mécanisme reste conçu, pas implémenté. **PARTIAL, pas BLOCKED** : rien n'empêche de l'ajouter à la migration déjà planifiée pour VTE-001 (`C6-IMPLEMENTATION-DESIGN.md §16, §19`).

---

## 7. CONCURRENCE (simulation conceptuelle)

```
REQUÊTE A : POST /api/sales { idempotency_key: K, lignes:[...] }
REQUÊTE B : POST /api/sales { idempotency_key: K, lignes:[...] }  (quasi simultanée)

Avec Option 3 en place :
  - Les deux tentent INSERT ventes (..., idempotency_key: K, ...)
  - La contrainte UNIQUE sur idempotency_key tranche atomiquement au niveau du
    moteur transactionnel Postgres : UNE seule des deux commit l'INSERT, l'autre
    reçoit une violation de contrainte (23505) immédiatement, avant tout
    fn_stock_move/emit_accounting_event
  - Le serveur, sur cette violation, relit la ligne `ventes` existante (par
    idempotency_key) et renvoie SON résultat à la requête B — pas une erreur
    opaque, une réponse cohérente avec ce que A a produit
  - Stock : fn_stock_move n'est appelé qu'une fois (par A) — B ne l'atteint jamais
  - Accounting : emit_accounting_event('VTE-001', source_id=<id de A>) n'est
    appelé qu'une fois — B ne l'atteint jamais
  - Paiement (si crédit) : même raisonnement, un paiement est lié à un ventes.id
    déjà unique par construction (une fois la vente elle-même dédoublonnée) —
    protégé par uidx_ae_processed sur l'event_type de règlement

Sans Option 3 (si jamais omise au codage) :
  - A et B créent chacune leur propre `ventes.id`
  - fn_stock_move s'exécute deux fois — le verrou advisory sérialise mais ne
    REFUSE PAS une deuxième sortie légitime en apparence (deux ventes.id
    distincts, chacune valide isolément) — si le stock total suffit pour les
    deux, les DEUX sorties réussissent, créant une vraie vente en double
  - emit_accounting_event s'exécute deux fois, pour deux source_id différents —
    AUCUNE protection ne s'applique, puisque ce ne sont pas le même événement
```

**Conclusion** : le design est atomique **à condition que** l'idempotency_key (§6) soit effectivement implémentée — sans elle, la concurrence/le double-clic produit une vraie duplication que rien d'existant n'intercepte.

---

## 8. RELATION AVEC VTE-001

Compatible sans ambiguïté : `idempotency_key` est une propriété de **création** de `ventes` (empêche deux lignes `ventes`), tandis que `(tenant_id, event_type, source_table, source_id)` reste l'identité **comptable** stable d'une vente déjà créée (empêche deux événements pour la même ligne). Les deux mécanismes agissent à des étapes différentes et se complètent : `idempotency_key` garantit qu'il n'existe qu'un seul `ventes.id` pour une action utilisateur donnée ; `source_id = ce ventes.id` garantit ensuite qu'il n'existe qu'un seul `VTE-001` pour cette ligne. Aucun conflit, aucune redondance.

---

## 9. CANAL DB

Vérifié aujourd'hui, une seule fois chacun (pas de multiplication des tentatives) :

- **Docker** : `docker ps` échoue toujours (`npipe`, "daemon is running?"). **Changement constaté depuis le dernier contrôle** : `tasklist` montre désormais un processus `docker.exe` actif (absent lors du dernier contrôle en BOI-010D, qui ne trouvait aucun processus `docker*` du tout) — un démarrage partiel a eu lieu, mais le moteur (`dockerDesktopLinuxEngine`) reste inaccessible. **Pas une amélioration fonctionnelle** : aucune requête transactionnelle n'est possible dans cet état.
- **MCP Supabase/Postgres** : `CONNECT_TIMEOUT`, confirmé une fois ce jour, cohérent avec l'état déjà documenté depuis BOI-010B.
- **PostgREST** : fonctionnel, mais **sans transaction multi-requêtes** (rappel structurel déjà établi — chaque requête HTTP est auto-commit, aucun `BEGIN`/`ROLLBACK` possible à travers plusieurs appels).

```
DB_TRANSACTION_CHANNEL = UNAVAILABLE
```

---

## 10. VERDICT

```
MIGRATION_184 = SAFE_TO_APPLY
184_INDEPENDENT_OF_C6 = YES
IDEMPOTENCE = PARTIAL
DB_TRANSACTION_CHANNEL = UNAVAILABLE
C6_PREIMPLEMENTATION = PARTIAL
```

`MIGRATION_184 = SAFE_TO_APPLY` : toutes les preuves directes et fraîches (signature RPC réelle de `fn_stock_move` aujourd'hui = exactement la cible du `DROP FUNCTION` de 184 ; 0 ligne dans `stock_movements` ; `purchase_items` stable ; aucune dépendance non satisfaite ; aucune policy RLS touchée) convergent — **sans qu'aucun canal transactionnel réel n'ait permis de l'exécuter pour le confirmer en conditions réelles**. C'est une conclusion fondée sur l'introspection de schéma et de signature RPC, pas sur une exécution testée — le niveau de preuve le plus élevé disponible sans Docker/MCP, mais pas une garantie d'exécution réelle sans anomalie.

`184_INDEPENDENT_OF_C6 = YES` : relation à sens unique prouvée (§3) — 184 ne référence rien de C6, C6 dépend de 184.

`IDEMPOTENCE = PARTIAL` : décision prise et justifiée par un mécanisme déjà existant du dépôt (extension du patron `uidx_ae_processed`), mais nécessite une colonne non encore créée — conception fermée, implémentation non faite (interdite dans cette mission).

`DB_TRANSACTION_CHANNEL = UNAVAILABLE` : aucun changement fonctionnel malgré un processus Docker désormais détecté (le moteur reste inaccessible).

`C6_PREIMPLEMENTATION = PARTIAL` : le verrou A (migration 184) est levé sur le plan de la preuve (SAFE_TO_APPLY, INDEPENDENT) mais pas sur le plan de l'exécution réelle (aucun canal pour l'appliquer et la valider en conditions transactionnelles). Le verrou B (idempotence) est levé sur le plan de la décision mais pas sur celui de l'implémentation (une colonne reste à créer, dans la migration déjà prévue).

```
NEXT_MISSION =
Ne pas déclarer C6-IMPLEMENTATION prêt à démarrer en code tant que le canal DB
reste UNAVAILABLE — appliquer une migration "SAFE_TO_APPLY par preuve de schéma"
sans jamais l'avoir exécutée transactionnellement reste un risque réel, pas une
garantie. Deux chemins possibles, au choix explicite de l'utilisateur :
  (a) Rétablir Docker (démarrer réellement le moteur, pas seulement le processus
      tray déjà détecté) ou MCP, PUIS appliquer 184 seule dans un environnement
      isolé, valider transactionnellement (BEGIN/ROLLBACK) avant toute décision
      de production — ensuite seulement démarrer C6-IMPLEMENTATION (migration
      VTE-001 + idempotency_key + API) sur un terrain déjà vérifié.
  (b) Si l'utilisateur accepte explicitement le risque documenté ici (preuve de
      schéma forte mais sans exécution réelle), démarrer directement
      C6-IMPLEMENTATION en écrivant la migration complète (184 + colonnes VTE-001
      + idempotency_key en une seule migration additive cohérente) et le code,
      en la marquant explicitement "non testée transactionnellement" jusqu'à ce
      qu'un canal existe — jamais déployée en production avant cette validation.
Dans les deux cas, la prochaine mission de code doit inclure explicitement la
colonne idempotency_key (§6) dans son plan de migration — ne pas la découvrir
ou l'improviser en cours de codage.
```

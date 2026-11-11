# BOI-010 — Implémentation du stock par provenance (choix manuel)

Mission P0-BOI-010, 2026-09-22. Implémente le Modèle D validé en BOI-007 avec la politique métier tranchée en BOI-009 (**choix manuel**, jamais de bascule automatique). Migration préparée, code modifié, tests écrits — **aucune migration exécutée, aucune donnée production modifiée**.

## Note d'exécution — limite honnête à déclarer

Le MCP Supabase est resté déconnecté pendant toute cette mission (retenté deux fois, sans succès). Conséquence directe sur l'Étape 15 : **la validation live par transaction réelle avec `ROLLBACK`, contre la vraie fonction PL/pgSQL, n'a pas pu être exécutée** — elle exige une session SQL transactionnelle que l'API PostgREST (utilisée en repli pour les autres missions récentes) ne fournit pas. Ce qui a été fait à la place, honnêtement distinct d'une validation live :
1. La logique exacte de `fn_stock_move` (migration 184) a été **réimplémentée en JavaScript pur** et testée contre les scénarios exacts TEST 1 à 7 de la mission (`lib/architecture/stock-provenance.test.ts`) — prouve le raisonnement, ne remplace pas un test contre la vraie base.
2. Une vérification en lecture seule via PostgREST confirme que **la migration n'a pas été appliquée** (`stock_movements.origine` renvoie `42703 column does not exist`) et que **le stock de production est inchangé** (`products=10, warehouses=1`, tout le reste à 0 — identique à BOI-004→009).
3. **Aucune donnée de test n'a été écrite en production** à aucun moment de cette mission (contrairement à BOI-005, où un test d'insertion réelle avait été possible et nettoyé — impossible ici puisque la colonne testée n'existe pas encore).

**Ce point doit être revalidé par une vraie transaction dès que l'accès MCP est rétabli, avant toute exécution de la migration en production.**

---

## 1. Migration du modèle stock

`supabase/migrations/184_stock_provenance.sql` (préparée, **non exécutée**) :

- `stock_movements.origine TEXT NULL`, contrainte `CHECK (origine IS NULL OR origine IN ('achat_fournisseur','production_locale','import_direct'))` — les 3 valeurs de BOI-006, `NULL` pour tout mouvement historique (aucun backfill, aucune origine inventée).
- `stock_movements.purchase_item_id UUID NULL REFERENCES purchase_items(id)` — confirmé nécessaire par BOI-007 §4.
- Index `(product_id, origine)` et `(purchase_item_id)`.
- `fn_stock_move` étendue avec deux **nouveaux paramètres optionnels** (`p_origine`, `p_purchase_item_id`, tous deux `DEFAULT NULL`) — rétrocompatible : tout appel existant sans ces paramètres se comporte exactement comme avant.
- Nouvelle vue `v_products_stock_par_origine` (produit × entrepôt × origine), `security_invoker=true`, dérivée de `stock_movements` — **`v_products_stock` n'est ni modifiée ni touchée**.

**Ordre de déploiement obligatoire, documenté dans la migration elle-même** : cette migration doit être appliquée **avant** que le code modifié (ci-dessous) ne soit déployé — ce code appelle `fn_stock_move` avec des paramètres qui n'existent pas tant que la migration n'est pas en place.

---

## 2. Achats — traçabilité complète, sans duplication

`app/api/stocks/purchases/route.ts`, transition `statut → 'reçu'` : chaque appel `fn_stock_move` reçoit désormais `p_origine: 'achat_fournisseur'` et `p_purchase_item_id: item.id` (la ligne d'achat source, désormais sélectionnée en plus de `product_id/quantite/prix`). La chaîne `stock_movements → purchase_items.purchase_id → purchases.supplier_id → suppliers` est navigable par FK réelles, sans qu'aucune donnée ne soit dupliquée sur `products`.

---

## 3. Production locale — le minimum, rien de plus

Aucun module de production créé. `app/api/stock/move/route.ts` (déjà existant, déjà propre — BOI-004/005) accepte désormais un `origine` optionnel dans son corps de requête, validé contre les 3 valeurs autorisées, transmis tel quel à `fn_stock_move`. Un appelant peut donc enregistrer une entrée `type='entree', origine='production_locale'` **via ce seul point d'entrée générique déjà existant** — aucune nouvelle table, aucun nouvel écran. Aucune accise n'est calculée à cette étape (vérifié par test, §14 TEST 9).

---

## 4. Import direct — accueilli sans refonte, rien inventé

`import_direct` fait partie des 3 valeurs autorisées par la contrainte `CHECK` dès cette migration (extensibilité anticipée en BOI-007 §6) — mais **aucune logique de distinction achat/import n'est créée**, conformément à l'instruction. Le statut juridique reste `NOT_DETERMINED` (BOI-006 §3, non retouché ici).

---

## 5. Sortie — choix manuel, implémenté dans le seul écran fonctionnel

Conformément à l'audit BOI-008/009 (seul le POS produit réellement des sorties exploitables ; `stocks/sorties/page.tsx` reste confirmée cassée et n'est pas réparée ici — hors périmètre explicite), `app/dashboard/commerce/page.tsx` a été modifié :

- Au chargement, la page lit désormais `v_products_stock_par_origine` en plus de `v_products_stock`, et construit un solde par origine par produit (agrégé tous entrepôts — le POS n'a pas de notion d'entrepôt, cohérent avec la granularité déjà existante de `v_products_stock`, BOI-007 §1).
- Chaque ligne du panier porte un champ `origine: string | null`.
- **0 provenance connue** (mouvements historiques sans origine, cas normal aujourd'hui) → comportement strictement inchangé, `origine` reste `null`.
- **1 seule provenance** → pré-sélectionnée automatiquement (affichée, jamais masquée — la traçabilité n'est jamais supprimée), sans exiger de clic.
- **Plusieurs provenances** → aucune présélection : un menu déroulant affiche chaque provenance avec sa quantité disponible (« Achat fournisseur (70 dispo.) », etc., exactement l'exemple de la mission), le bouton « Encaisser » est désactivé tant que le choix n'est pas fait pour toutes les lignes concernées.
- La provenance choisie est transmise telle quelle à `fn_stock_move` — jamais recalculée, jamais remplacée.

---

## 6. Validations — refus strict, jamais de bascule

`fn_stock_move` (migration 184) : quand `p_origine` est fourni sur un mouvement qui diminue le stock, le solde de **cette provenance précise** est vérifié indépendamment du solde global du produit. Si insuffisant, la fonction lève une exception et **aucune ligne n'est insérée** — testé (§14, TEST 4) avec l'exemple exact de la mission (production disponible = 80, sortie de 81 → refus, alors même que le stock global du produit dépasse largement 81).

---

## 7. Interface — uniquement l'écran réellement fonctionnel

| Écran | Statut avant cette mission | Action |
|---|---|---|
| POS (`commerce/page.tsx`) | Seul chemin de sortie réellement fonctionnel (BOI-008) | **Modifié** — sélection de provenance ajoutée |
| Réception d'achat (`stocks/achats`, `/api/stocks/purchases`) | Fonctionnel (BOI-004) | **Modifié** — origine/traçabilité ajoutées côté API uniquement, aucun changement d'écran nécessaire (l'utilisateur ne choisit rien à la réception, l'origine `achat_fournisseur` est automatique et non ambiguë par nature de l'opération) |
| Sorties dédiées (`stocks/sorties/page.tsx`) | Confirmée cassée (BOI-008 — `stock_sorties`/`stock_sortie_items` inexistantes) | **Non touchée**, conformément à l'instruction explicite de ne pas réparer un écran mort hors du chemin fonctionnel |
| Transferts (`stock_transferts`) | Déconnecté de `stock_movements` depuis BOI-003 (ticket H7) | **Non reconnecté** — analysé §9, hors périmètre de cette mission |
| Ajustements | Aucune UI existante | **Aucune créée** — documenté §10 |

---

## 8. Stock total — une seule source de vérité, confirmée

`v_products_stock` reste **inchangée à l'octet près** — vérifié par lecture du fichier de migration (aucune instruction ne la touche) et par test statique. `v_products_stock_par_origine` est une vue **dérivée**, pas une balance stockée : `GROUP BY product_id, tenant_id, nom, warehouse_id, origine` sur `SUM(fn_stock_sign(type) * quantite)`, exactement le même mécanisme que `v_products_stock`, avec une dimension de plus. **Aucune seconde balance persistée**, conformément à l'interdiction explicite (et à la leçon déjà tirée de l'historique ANO-C03 du dépôt).

---

## 9. Transferts — analysés, non reconnectés

`stock_transferts` reste, comme en BOI-003/008/009, **totalement déconnecté** de `stock_movements` — un transfert ne produit aujourd'hui aucun mouvement dans le grand livre. Cette mission ne le reconnecte pas (hors périmètre explicite : « ne pas créer de module production complet », et cette reconnexion est un chantier de réparation Core Stocks séparé, déjà documenté comme ticket H7 depuis BOI-003, jamais traité par aucune mission BOI). **Ce qui est démontré** (test logique, §14 TEST 6) : **si** un transfert était un jour représenté comme une paire de mouvements (sortie de l'entrepôt source + entrée dans l'entrepôt destination), la conception du modèle D garantit par construction que l'origine reste identique des deux côtés — un transfert ne change jamais la provenance, seulement l'entrepôt.

---

## 10. Ajustements — décision métier supplémentaire nécessaire, documentée et non inventée

Aucune UI d'ajustement n'existe aujourd'hui (confirmé BOI-003, reconfirmé ici). `fn_stock_move` accepte techniquement `p_origine` sur un ajustement, mais :
- **Un ajustement négatif** (écart constaté, stock physique inférieur au stock théorique) devrait indiquer la provenance concernée si plusieurs existent — mais rien ne permet de savoir, à partir d'un simple comptage physique, à quelle provenance l'écart appartient réellement.
- **Un ajustement positif** (surplus constaté) devrait indiquer explicitement la provenance créée — mais un surplus physique n'a, par construction, aucune traçabilité d'origine (on ne sait pas d'où viennent des unités qu'on découvre en trop).

**Aucune provenance par défaut n'est inventée pour ce cas.** C'est une décision métier distincte, non résolue par cette mission, documentée ici pour une future mission — probablement la même famille de décision que celle déjà prise en BOI-009 pour les sorties (choix manuel), mais avec une difficulté supplémentaire propre aux ajustements (absence de traçabilité physique de départ) qui n'a pas d'équivalent côté vente.

---

## 11. Historique — NULL conservé, rien deviné

Confirmé par test (§14, TEST 7) : un mouvement `origine=NULL` continue de contribuer normalement au solde global (`v_products_stock`, inchangée), mais n'apparaît dans aucun solde par origine spécifique. **0 ligne réelle dans `stock_movements` aujourd'hui** (reconfirmé en tête de ce rapport) — cette règle est donc actuellement sans effet pratique, mais reste la garantie de conception pour tout mouvement futur créé avant l'adaptation complète de tous les écrivains.

---

## 12. RLS — isolation tenant vérifiée par construction et par test

- `stock_movements.origine`/`purchase_item_id` : nouvelles colonnes sur une table déjà isolée par les policies RLS existantes (`tenant_id = get_my_tenant_id()`, select/insert uniquement) — aucune nouvelle policy nécessaire.
- `v_products_stock_par_origine` : `security_invoker=true` (comme `v_products_stock`) — la RLS de `products`/`stock_movements` s'applique avec les droits de l'appelant, jamais ceux du propriétaire de la vue. Un utilisateur du tenant A ne peut donc, par construction, ni lire le solde par origine d'un tenant B, ni y créer de mouvement.
- Vérifié par test statique (§14, TEST 8) : tous les fichiers modifiés filtrent explicitement par `tenant_id`.

---

## 13. Comptabilité — aucune règle touchée

Aucune modification de `accounting_event_rules` (vérifié par test, migration ne contient aucune instruction sur cette table). ACH-001/ACH-002 (`/api/stocks/purchases`) et STK-002 (`/api/stock/move`) restent émis exactement comme avant BOI-010 — la provenance n'est **pas** propagée dans les `metadata` des événements comptables existants dans cette mission (aucune démonstration d'un besoin réel n'a été faite, conformément à l'instruction « si la provenance doit être propagée dans metadata, le démontrer avant de le faire » — non démontré, donc non fait). Aucun compte comptable spécifique à la provenance créé.

---

## 14. Tests

`lib/architecture/stock-provenance.test.ts` — 22 tests, tous passants :
- **TEST 1 à 7** (arithmétique pure, réimplémentation JS fidèle de la logique SQL) : reproduisent exactement les scénarios chiffrés de la mission, y compris le refus strict de TEST 4 et la préservation de provenance à travers un transfert modélisé (TEST 6).
- **TEST 8** (isolation tenant), **TEST 9** (aucune accise), **TEST 10** (aucune régression comptable) : contrats statiques sur le code réellement modifié.
- Tests supplémentaires confirmant que `stocks/sorties/page.tsx` n'a pas été touchée et que `fn_stock_move` reste rétrocompatible (paramètres à `DEFAULT NULL`).

---

## 15. Validation

- `npx tsc --noEmit` : ✅ clean.
- `npx vitest run` : ✅ **1005/1005** tests, 47/47 fichiers.
- `npx eslint` sur les 4 fichiers modifiés : ✅ 0 erreur, 0 warning.
- `npm run build` : ✅ succès.
- **Validation live transactionnelle (rollback réel)** : ❌ **non réalisée** — MCP Supabase indisponible pendant toute la mission (voir note d'exécution en tête de rapport). Remplacée par la réimplémentation JS testée (§14) + confirmation en lecture seule que le schéma production est resté inchangé.
- Recomptage final (lecture seule) : `products=10`, `warehouses=1`, tout le reste à 0 — identique à l'état de départ ; colonne `origine` confirmée absente de la production (`42703`), donc migration confirmée non exécutée.

---

## État final obligatoire

```
MIGRATION_PREPARED          = YES
PROVENANCE_ON_MOVEMENTS     = PASS   (conception + logique testée ; non vérifié en base réelle — MCP indisponible)
PURCHASE_TRACEABILITY       = PASS
MANUAL_SELECTION            = PASS
STOCK_BY_ORIGIN             = PASS
TRANSFER_PROVENANCE         = PASS   (démontré par modélisation logique — stock_transferts non reconnecté, hors périmètre)
HISTORICAL_NULL_SAFE        = PASS
TENANT_ISOLATION            = PASS
ACCOUNTING_NON_REGRESSION   = PASS
ACCISA_IMPLEMENTED          = MUST_BE_NO — confirmé NO
```

```
STOCK_PROVENANCE_IMPLEMENTATION = PARTIAL
BOI_IMPLEMENTATION              = BLOCKED
```

### Pourquoi `PARTIAL` et non `READY`

Tout le code et la migration nécessaires sont préparés et testés autant qu'il est possible de le faire sans base réelle. Mais deux éléments empêchent `READY` :
1. **La validation live transactionnelle (Étape 15) n'a pas pu être exécutée** — le MCP Supabase était indisponible pendant toute la mission. C'est une limite d'exécution de cette session, pas une limite de conception, mais elle doit être levée avant tout déploiement réel.
2. **Les ajustements restent une décision métier ouverte** (§10) — non bloquante pour le reste du système (aucune UI d'ajustement n'existe de toute façon aujourd'hui), mais une pièce manquante du tableau complet.

### Pourquoi `BOI_IMPLEMENTATION` reste `BLOCKED`

Conformément à l'instruction explicite de la mission : même une fois toute la provenance fonctionnelle, `BOI_IMPLEMENTATION` reste `BLOCKED` tant que le moteur d'accise n'a pas été conçu et validé séparément — ce que cette mission n'a ni fait, ni tenté de faire.

---

Aucune migration exécutée. Aucune donnée production modifiée (confirmé par recomptage). Aucune accise implémentée. Aucune règle `accounting_event_rules` modifiée. Aucun commit, aucun push.

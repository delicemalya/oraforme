# BOI-007 — Conception du stock par provenance

Mission P0-BOI-007, 2026-09-22. Suite de BOI-006 (`BOI_DATA_MODEL = PARTIAL`, `IMPLEMENTATION_ALLOWED = NO`). Mission de **conception exclusivement** — aucun code, aucune migration, aucune donnée production, aucun `ConfigAccise`, aucun calcul d'accise, aucune modification de `accounting_event_rules`.

**Note d'exécution** : le MCP Supabase reste déconnecté (comme en BOI-005/006). Les comptages de lignes ont été reconfirmés via l'API PostgREST directe (même projet, même clé service_role) : `products=10`, `warehouses=1`, `stock_movements=0`, `purchases=0`, `purchase_items=0`, `suppliers=0` — état identique à BOI-004/005/006, aucune migration exécutée entre-temps.

---

## 1. Audit du modèle stock actuel

Schéma réel (confirmé BOI-003/004/005, inchangé) :

- **`products`** : 12 colonnes (`id, tenant_id, nom, categorie, sku, code_barre, unite, prix_achat, prix_vente, seuil_alerte, image_url, created_at`) — **aucun champ de stock**, catalogue pur (BOI-005, `READY`).
- **`stock_movements`** : `id, tenant_id, product_id, warehouse_id, type, quantite, reference, note, created_at, unit_cost, notes`. `type` contraint à `entree/sortie/ajustement/transfert/reception/retour`. RLS : `select`/`insert` uniquement (ledger append-only). FK : `tenant_id→tenants`, `product_id→products`, `warehouse_id→warehouses` (nullable).
- **`warehouses`** : `id, tenant_id, nom, localisation, created_at`.
- **`v_products_stock`** : `SELECT p.*, COALESCE(m.stock_actuel,0) FROM products p LEFT JOIN (SELECT product_id, SUM(fn_stock_sign(type)*quantite) FROM stock_movements GROUP BY product_id) m ON m.product_id=p.id`. `security_invoker=true`.
- **`purchases`** : `id, tenant_id, supplier_id, montant_total, statut, created_at, reference, notes, date`.
- **`purchase_items`** : `id, purchase_id, product_id, quantite, prix` (pas de `tenant_id` propre, isolation via `purchases`).
- **`fn_stock_move(p_tenant_id, p_product_id, p_type, p_quantite, p_warehouse_id, p_unit_cost, p_reference, p_notes) RETURNS uuid`** : verrou consultatif par `product_id` (`pg_advisory_xact_lock(hashtext(p_product_id))`), recalcule le solde depuis `stock_movements`, refuse tout passage sous zéro, insère, retourne l'id.

### Clé actuelle du solde — constat précis

**Le solde `v_products_stock` est calculé `GROUP BY product_id` uniquement — pas `product_id × warehouse_id`.** `warehouse_id` existe et est renseigné sur certains mouvements, mais **la vue l'ignore totalement** dans son agrégation : tous les entrepôts sont fondus en un seul total par produit. Le verrou de `fn_stock_move` est lui aussi posé uniquement par `product_id`, pas par entrepôt. **La granularité réelle du système aujourd'hui est donc « produit », point final** — pas « produit × entrepôt » comme on pourrait le supposer depuis l'existence de la colonne `warehouse_id`. Cette conception s'aligne sur ce précédent : ajouter une dimension provenance en suivant le même schéma (`GROUP BY product_id, origine`), pas une dimension supplémentaire encore plus fine (`× warehouse_id`) qui n'existe même pas aujourd'hui pour le solde global.

### Consommateurs recensés

- **Écrivains de `stock_movements`** (uniquement via `fn_stock_move`, confirmé par RLS `select`/`insert` seul et par `lib/architecture/stock-source-unique.test.ts`) : `app/api/stock/move/route.ts` (mouvement générique), `app/api/stocks/purchases/route.ts` (réception d'achat, BOI-004), `app/dashboard/commerce/catalogue/page.tsx` (stock initial à la création d'un produit, appel RPC direct côté client).
- **Lecteurs de `v_products_stock`** : `stocks/produits`, `stocks/achats`, `stocks/retours`, `stocks/codes-barres`, `stocks/commandes`, `stocks/receptions`, `stocks/sorties`, `stocks/inventaires`, `stocks/transferts`, `stocks/categories`, `stocks/entrepots`, `stocks/page`, `stocks/analytics`, `stocks/alertes`, `stocks/valorisation`, `commerce/catalogue`, `commerce` (POS) — 16 pages, toutes lisent le solde global agrégé (BOI-003/004/005).
- **Lecteurs directs de `stock_movements`** (hors vue) : `stocks/audit`, `stocks/mouvements`, `stocks/valorisation` (calcul du CMP par ligne de mouvement).

---

## 2. Comparaison des architectures (obligatoire avant tout choix)

| | **A. Origine sur `stock_movements`** | **B. Entité provenance/lot séparée** | **C. Balance produit×entrepôt×origine (stockée)** | **D. Mouvements + provenance + vue calculée** |
|---|---|---|---|---|
| **Avantages** | Minimal, additif, réutilise `fn_stock_move`/`v_products_stock` tel quel | Traçabilité fine par lot (date, coût, péremption) | Lecture rapide, pas de recalcul | Tous les avantages de A, plus une interface de lecture propre et réutilisable |
| **Inconvénients** | La sortie doit déclarer explicitement l'origine consommée | Nouvelle table ; gestion de la « quantité restante » par lot pose le même risque que C si stockée | — | Une vue SQL de plus à définir (aucun coût réel supplémentaire vs A) |
| **Migration** | Colonne + FK nullable, additif, 0 ligne actuellement | Nouvelle table + FK + RLS + policies + index — plus lourd | Nouvelle table + triggers de maintenance | Identique à A + définition d'une vue (pas une table) |
| **Performance** | Négligeable (index composite `(product_id, origine)`) | Jointure supplémentaire à chaque lecture | Lecture rapide mais coût de maintenance à l'écriture (triggers) | Identique à A |
| **Traçabilité** | Bonne pour la dimension catégorielle (achat/production/import) ; pas de lot individuel | Excellente (la meilleure des 4) | Solde seulement, pas de traçabilité par mouvement | Identique à A |
| **Risque de divergence** | Faible — une seule source | Réel si la quantité restante du lot est une colonne mutable | **Élevé — c'est exactement le défaut déjà vécu et corrigé dans ce dépôt** (`products.stock_actuel`, ANO-C03, `lib/architecture/stock-source-unique.test.ts`) : 14 pages le lisaient, 7 l'écrivaient, désynchronisation silencieuse pendant des mois | Nul supplémentaire — la vue est un `SELECT` dérivé, jamais une source indépendante |
| **Compatibilité existant** | Haute, purement additif | Plus invasif (achats ET production devraient créer une ligne « lot » en plus du mouvement) | Introduit une deuxième source de solde, en concurrence avec `v_products_stock` | Haute — `v_products_stock` reste **strictement inchangée** |
| **Impact achats** | `p_origine='achat_fournisseur'` sur réception — trivial | Création d'un lot à chaque réception | Trigger de mise à jour à chaque réception | Identique à A |
| **Impact sorties** | Doit désormais recevoir une origine explicite (voir §7) | Doit référencer un `lot_id` | Trigger de décrémentation par balance | Identique à A |
| **Impact transferts** | `stock_transferts` déjà déconnecté de `stock_movements` (BOI-003, jamais réparé) — hors de portée directe ; si reconnecté un jour, l'origine devrait être préservée dans le mouvement miroir | Idem, plus complexe (transfert de lot) | Idem, plus fragile (deux balances à synchroniser, une par entrepôt) | Identique à A |
| **Impact ajustements** | Origine ambiguë pour un écart d'inventaire constaté (voir §11) | Idem, en plus complexe (quel lot ajuster ?) | Idem | Identique à A |
| **Impact POS** | Doit déclarer une origine pour un produit à origines mixtes — aucun mécanisme existant aujourd'hui (voir §7) | Idem, plus complexe (choix de lot) | Idem | Identique à A |
| **Impact `v_products_stock`** | Reste valide comme total toutes origines confondues ; une dimension supplémentaire nécessaire ailleurs pour le détail | Nécessiterait une jointure vers `lots` | Introduirait une seconde source de vérité du stock — **interdit explicitement par la mission** | **Reste inchangée**, une seconde vue s'ajoute à côté (§10) |

### Modèle C rejeté sur preuve, pas sur préférence

Le modèle C (balance stockée) réintroduirait exactement le défaut historique déjà documenté et corrigé dans ce dépôt (`ANO-C03` : `products.stock_actuel` n'a jamais dû exister comme colonne, le stock doit toujours être **dérivé** de `stock_movements`, jamais stocké à côté). Ce n'est pas une question de goût — c'est une leçon déjà payée et testée par ce projet lui-même (`stock-source-unique.test.ts`). **Rejeté formellement.**

### Modèle B rejeté pour disproportion, pas par principe

Le modèle B (entité lot séparée) serait justifié si le besoin réel incluait une traçabilité fine (date de péremption, numéro de lot, coût de revient individuel) — mais le besoin exprimé par BOI-006 et cette mission se limite à **trois catégories d'origine** (achat/production/import), pas à une gestion de lots physiques. Créer une nouvelle table pour ce besoin précis serait disproportionné et contredirait la discipline déjà établie en BOI-004/005 de ne pas recréer d'entités parallèles sans preuve d'un besoin qui dépasse ce qu'une colonne suffit à représenter.

### Décision : Modèle D

**A est la bonne structure de données ; D est A complété par l'interface de lecture que la mission demande explicitement d'examiner (§10) — sans jamais faire de cette vue une deuxième source de vérité.** Retenu.

---

## 3. Cas mixte obligatoire — démontré avec les chiffres exacts de la mission

Produit X, deux entrées :

| Mouvement | type | quantite | origine | purchase_item_id |
|---|---|---|---|---|
| Entrée 1 | `reception` | 100 | `achat_fournisseur` | `<pi_1>` |
| Entrée 2 | `entree` | 100 | `production_locale` | `NULL` |

Puis deux sorties, chacune déclarant explicitement quelle origine elle consomme (§7) :

| Mouvement | type | quantite | origine |
|---|---|---|---|
| Sortie A | `sortie` | 30 | `achat_fournisseur` |
| Sortie B | `sortie` | 20 | `production_locale` |

Solde par origine (`GROUP BY product_id, origine`) :

```
(X, achat_fournisseur)   : 100 − 30 = 70
(X, production_locale)   : 100 − 20 = 80
```

**Exactement les chiffres demandés.** Aucun doublon de produit, aucun second SKU, aucun second tenant, aucun flag global sur `products` — un seul `product_id`, quatre lignes `stock_movements`. Le solde global (`v_products_stock`, inchangée) reste `200 − 30 − 20 = 150`, cohérent avec la somme des deux soldes par origine — invariant à vérifier dans une future mission de tests.

---

## 4. Entrée achat — la FK vers `purchase_items` suffit-elle ?

`purchases → purchase_items → fn_stock_move('reception', ...)` est déjà le mécanisme exact établi en BOI-004 (déclenché sur `purchases.statut → 'reçu'`). Ajouter `stock_movements.purchase_item_id` (FK nullable vers `purchase_items.id`) permet de remonter entièrement la chaîne par jointures réelles : `stock_movements → purchase_items.purchase_id → purchases.supplier_id → suppliers`. **Oui, une seule FK suffit** — inutile de dupliquer `purchase_id` ou `supplier_id` directement sur `stock_movements` (éviterait toute divergence si un achat était corrigé après coup).

**Mais la FK seule ne suffit pas à déterminer la valeur d'`origine`.** Deux raisons : (1) le principe déjà posé en BOI-006 interdit toute inférence silencieuse — l'origine doit être déclarée, jamais déduite de la présence d'une FK ; (2) un achat futur `import_direct` (BOI-006 §3, toujours `NOT_DETERMINED`) passerait **lui aussi** par un `purchase_item` — la seule présence de la FK ne distinguerait donc jamais achat local d'importation. `origine` reste un champ explicite séparé ; `purchase_item_id` n'est qu'un pointeur de traçabilité complémentaire.

---

## 5. Entrée production — minimum architectural

Aucun moteur de production n'existe, et cette mission n'en crée pas. Le minimum : **un unique `stock_movements`, type `entree` (déjà existant, aucun nouveau type nécessaire), `origine='production_locale'`, `purchase_item_id=NULL`.** `unit_cost` (colonne déjà existante, déjà utilisée pour le coût d'achat) peut porter un coût de production déclaré manuellement, sans colonne supplémentaire. **Une seule ligne de mouvement suffit** — démontré, pas supposé.

Ce qui resterait absent pour un **vrai** module de production (non demandé ici, hors périmètre) : traçabilité du coût de revient réel (matières premières consommées, main-d'œuvre), ordre de fabrication formel. Ce manque n'empêche pas de marquer correctement une entrée comme `production_locale` — il concerne un besoin différent, non posé par cette mission.

---

## 6. Import direct — extensible sans refonte

BOI-006 a laissé `import_direct = NOT_DETERMINED` et cette mission **ne tranche rien de nouveau** sur ce point. Vérification demandée : l'architecture retenue peut-elle l'accueillir plus tard sans refonte ?

**Oui.** `origine` est un champ catégoriel contraint (CHECK constraint), pas une structure. Ajouter `'import_direct'` comme troisième valeur autorisée est un `ALTER TABLE ... DROP CONSTRAINT / ADD CONSTRAINT` trivial, sans changement de structure. La FK `purchase_item_id` resterait valable pour un achat-import (un import reste un achat, avec une étape douanière en plus — voir BOI-006 §3). **Aucune refonte requise** — seule reste ouverte la question déjà identifiée en BOI-006 : comment distinguer `achat_fournisseur` d'`import_direct` à la saisie (donnée absente de `purchases`/`suppliers` aujourd'hui). Cette question n'est pas résolue ici, conformément à l'instruction « ne rien inventer ».

---

## 7. Sortie de stock — le point critique

Comparaison demandée :

- **A — provenance obligatoire déclarée sur chaque sortie** : au niveau données, revient à rendre `origine` un champ requis sur toute ligne `type='sortie'` d'un produit à origines multiples.
- **B — FIFO par provenance** : consommation automatique de l'origine la plus ancienne en premier. Faisable techniquement (les mouvements sont horodatés) mais c'est un **algorithme**, pas seulement un schéma — une sortie pourrait devoir être scindée en plusieurs lignes si elle traverse une frontière d'origine (ex. vente de 90 alors qu'il ne reste que 70 en `achat_fournisseur`).
- **C — FEFO** : nécessite une date de péremption — **aucune colonne de ce type n'existe nulle part** dans `products` ou `stock_movements`. **Objectivement écartée aujourd'hui**, pas par préférence mais par absence de donnée.
- **D — choix manuel de provenance** : au niveau données, strictement équivalent à A (l'origine est renseignée explicitement sur la ligne de sortie) — la différence entre A et D est un choix de **processus** (règle automatique vs décision humaine), pas de schéma.
- **E — autre mécanisme** : aucun autre mécanisme pertinent identifié pour ce besoin.

### Constat à signaler explicitement, comme demandé

**Aucune politique de consommation de stock par provenance n'existe aujourd'hui dans Oraforme.** Le sélecteur `METHODE_OPTIONS = ['CMP', 'FIFO', 'LIFO', 'PMP']` visible dans `stocks/valorisation/page.tsx` ne pilote **aucune logique réelle** — il ne change que l'étiquette affichée ; le calcul sous-jacent est toujours un CMP (coût moyen pondéré, une méthode de **valorisation comptable**, pas un ordre de **consommation physique**). Il n'existe donc, dans le code actuel, ni algorithme FIFO/FEFO réel, ni interface de choix manuel de provenance à la vente.

**Conclusion, au niveau strictement des données (ce que demande cette mission)** : `origine` doit être un champ explicite sur la ligne de sortie (convergence A/D). **Le mécanisme concret qui le remplit — règle automatique (B) ou choix humain (D) — reste une décision métier non tranchée**, à statuer dans une prochaine mission avant toute implémentation du flux de vente pour un produit à origines mixtes.

---

## 8. Première cession — sans flag, par requête

Aucun `is_first_sale`, aucun compteur sur `products`. Le mécanisme, entièrement dérivable par requête sur `stock_movements` :

```
quantité produite      = SUM(quantite) WHERE product_id=X AND origine='production_locale'
                                        AND type IN ('entree','reception')

quantité déjà sortie    = SUM(quantite) WHERE product_id=X AND origine='production_locale'
                                        AND type='sortie'

première sortie         = MIN(created_at) WHERE product_id=X AND origine='production_locale'
                                        AND type='sortie'

quantité de la première
cession                 = quantite de la ligne dont created_at = première sortie
```

Une ligne de sortie donnée est « la première cession » si son `created_at` égale ce minimum — comparaison faite **à la lecture**, jamais stockée. Aucun état qui peut driver, aucun flag qui peut mentir après une correction.

**Nuance non tranchée ici, signalée pour une future mission fiscale** : si cette première sortie est plus tard partiellement retournée (`type='retour'`), la quantité nette change mais le fait générateur juridique a déjà eu lieu au moment de la cession initiale — question de droit fiscal, pas de conception de données, volontairement non résolue ici.

---

## 9. Historique existant

`stock_movements` compte **0 ligne en production** aujourd'hui (reconfirmé en tête de ce rapport) — il n'existe donc, en pratique, aucun historique à traiter pour Oraforme actuellement. Réponse de conception générale néanmoins requise :

**`origine = NULL` doit être conservé, définitivement, pour tout mouvement antérieur à l'introduction de cette colonne — jamais une valeur déduite rétroactivement.** Une ligne `origine IS NULL` signifie « provenance non documentée » : elle est **exclue** de tout solde calculé par origine, mais reste **incluse** dans le solde global (`v_products_stock`, qui ne filtre jamais par origine). Le stock total reste donc toujours exact ; seule la répartition par origine serait incomplète pour le passé — comportement honnête, pas une invention, et sans impact aujourd'hui puisque la table est vide.

---

## 10. `v_products_stock` — décision

**C — complétée par une seconde vue spécialisée.** Pas B (la faire évoluer directement casserait potentiellement les 16 consommateurs existants qui dépendent de sa forme exacte actuelle — risque de régression injustifié). Pas A seule (laisserait le besoin de provenance sans réponse).

`v_products_stock` **reste strictement inchangée**. Une nouvelle vue (nom indicatif : `v_products_stock_par_origine`), dérivée du même `stock_movements` par un simple ajout d'`origine` au `GROUP BY` déjà existant, s'ajoute à côté. **Aucune deuxième source de vérité** : les deux vues dérivent du même mouvement, le mouvement reste la seule source canonique — exigence explicite de la mission, respectée par construction.

---

## 11. Compatibilité

| Domaine | Impact |
|---|---|
| Achats / réceptions | Aucun changement de structure (`purchases`/`purchase_items` intacts) ; la réception fournirait `p_origine='achat_fournisseur'` + `p_purchase_item_id` — extension de paramètres de `fn_stock_move`, pas une rupture |
| Stock (mouvement générique, `/api/stock/move`) | Adaptation nécessaire : ce point d'entrée générique devrait distinguer quand l'origine est obligatoire (entrées), quand elle doit être déclarée (sorties d'un produit à origines mixtes) et quand elle est sans objet |
| POS (`commerce/page.tsx`) | Adaptation nécessaire **uniquement** pour un produit à origines effectivement mixtes (aucun cas réel aujourd'hui, 0 donnée) — actuellement aucun mécanisme de sélection d'origine à la vente |
| Catalogue (`commerce/catalogue`, `stocks/produits`) | Aucun changement requis — ces pages lisent le solde global (`v_products_stock`, inchangée) |
| Transferts (`stock_transferts`) | Déjà déconnecté de `stock_movements` (BOI-003, non réparé) — hors de portée directe ; si reconnecté un jour, l'origine du mouvement source devrait être préservée dans le mouvement miroir |
| Ajustements | Origine ambiguë par nature pour un écart d'inventaire constaté sur un produit à origines mixtes — point ouvert, non résolu ici (voir §12) |
| Reporting (`stocks/analytics`, `stocks/valorisation`) | Fonctionne tel quel (aucune régression) ; une ventilation par origine serait une amélioration future, pas un prérequis |

---

## 12. Plan de migration future (conception uniquement — non exécuté)

- **Colonnes** : `stock_movements.origine TEXT NULL` ; `stock_movements.purchase_item_id UUID NULL`.
- **Contrainte** : `CHECK (origine IS NULL OR origine IN ('achat_fournisseur', 'production_locale'))` — deux valeurs au lancement, pas `import_direct` tant que BOI-006 §3 n'est pas tranché ; extensible plus tard par un simple remplacement de contrainte.
- **FK** : `purchase_item_id REFERENCES purchase_items(id)`.
- **Index** : `(product_id, origine)` pour la future vue par origine ; `(purchase_item_id)` pour la traçabilité inverse.
- **RLS** : aucune nouvelle policy — les colonnes vivent sur une table déjà isolée par `tenant_id` via les policies existantes.
- **Données historiques** : `origine = NULL` conservé indéfiniment pour tout mouvement antérieur (§9) — **aucun backfill**, une origine passée ne se devine pas.
- **Stratégie progressive** (ordre recommandé, non exécuté) :
  1. Ajouter les colonnes (nullable, additif, risque nul vu 0 ligne actuelle).
  2. Étendre `fn_stock_move` avec `p_origine`/`p_purchase_item_id` optionnels (rétrocompatible avec les appels existants qui ne les fourniraient pas encore).
  3. Adapter le writer de réception d'achat (`/api/stocks/purchases`, déjà bien défini — §4) en premier.
  4. Adapter un writer de production minimal une fois qu'une saisie de production existe (§5).
  5. Créer `v_products_stock_par_origine`.
  6. Adapter les sorties **seulement après** la décision métier sur la politique de consommation (§7) — pas avant, sous peine d'inventer cette politique par défaut.
- **Rollback** : réversible sans perte tant qu'aucune donnée réelle n'existe (`DROP COLUMN` sur table vide) ; une fois des données réelles introduites, le rollback consiste à cesser d'exploiter les colonnes, jamais à les supprimer destructivement.

---

## 13. Décision finale

**Modèle D retenu.** Il démontre, avec les données réellement disponibles et sans nouvelle entité :

```
Produit X → 100 achat + 100 production locale
          → ventes séparées par provenance     (§3, chiffres exacts)
          → stock restant séparé par provenance (§3 : 70 / 80)
          → première cession locale identifiable (§8, par requête, sans flag)
```

**Mais une décision métier reste nécessaire avant toute implémentation** : la politique de consommation à la sortie (§7) n'existe pas aujourd'hui dans Oraforme, et rien dans les données actuelles ne permet de la déduire sans l'inventer. Ce n'est pas une faiblesse du modèle de données — c'est une décision que le modèle de données ne doit **pas** prendre à la place du métier, conformément à la discipline appliquée à chaque mission de cet engagement.

---

## État final obligatoire

```
STOCK_PROVENANCE_MODEL  = D
STOCK_PROVENANCE_DESIGN = READY
BOI_DATA_MODEL           = PARTIAL
IMPLEMENTATION_ALLOWED   = NO
```

### 1. Architecture retenue

Modèle D : `origine` (+ FK optionnelle `purchase_item_id`) sur `stock_movements`, complété par une seconde vue calculée (`v_products_stock_par_origine`) dérivée du même mouvement, sans jamais toucher à `v_products_stock` ni créer de table de solde stocké.

### 2. Pourquoi

C'est la seule des quatre architectures comparées qui (a) résout le cas mixte exact demandé avec les chiffres exacts (§3), (b) ne recrée aucune entité déjà refusée par BOI-004/005, (c) ne réintroduit pas le défaut de solde stocké déjà vécu et corrigé dans ce dépôt (ANO-C03, modèle C rejeté sur preuve), (d) ne casse aucun des 16 consommateurs existants de `v_products_stock`, (e) reste extensible à `import_direct` sans refonte.

### 3. Décisions métier encore manquantes

- **Politique de consommation à la sortie** (§7) : qui/quoi détermine l'origine consommée à chaque vente d'un produit à origines mixtes — automatique (FIFO) ou manuel — actuellement **aucune politique n'existe**.
- **Distinction achat_fournisseur / import_direct** (§6, hérité de BOI-006 §3, non résolu ici) : quelle donnée représenter, et où, pour ce distinguo légal (événement douanier).
- **Traitement des ajustements d'inventaire sur un produit à origines mixtes** (§11) : à quelle origine attribuer un écart constaté sans provenance connue.

### 4. Impact sur le Core Stocks

Aucun impact immédiat — rien n'est exécuté. Si implémenté un jour selon le plan §12 : additif uniquement (2 colonnes nullables + 1 FK + 1 vue), aucune rupture des 16 consommateurs de `v_products_stock`, `fn_stock_move` reste le seul point d'écriture, `stock_movements` reste l'unique source de vérité.

### 5. Prochaine mission recommandée

Une mission de **décision métier** (pas de conception technique supplémentaire) tranchant : (a) la politique de consommation à la sortie pour un produit à origines mixtes, et (b) la représentation de l'importation directe (BOI-006 §3). Ces deux décisions prises, une mission d'implémentation pourra suivre le plan de migration progressif de la §12 — toujours sans coder l'accise elle-même, qui reste une mission distincte et ultérieure.

---

Aucun code modifié. Aucune migration créée ni exécutée. Aucun `ConfigAccise`. Aucun calcul d'accise. Aucune modification de `accounting_event_rules`. Aucune donnée production touchée. Aucun commit, aucun push.

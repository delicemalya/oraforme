# BOI-003 — Audit forensique Achats + Stocks avant implémentation BOI

Mission P0-BOI-003, 2026-09-21. Audit strictement en lecture (base de données en lecture seule, aucune écriture, aucun seed, aucune migration, aucune modification de code). Objectif unique : déterminer si le Core Achats + Stocks existant constitue une fondation exploitable pour la future distinction `origine` (production_locale | achat_fournisseur | import_direct) validée architecturalement par BOI-002.

**Méthode** : aucune confiance accordée aux types TypeScript ni au frontend. Chaque table a été vérifiée directement en base (`information_schema`, `pg_catalog`, RLS, triggers, contraintes, volumétrie) sur le projet Supabase `mrzixapnaqsbqmagivvf`, puis croisée avec une recherche exhaustive du code consommateur (`app/dashboard/**`, `app/api/**`).

---

## 1. Cartographie base réelle

| Table/vue | Existe ? | Lignes | tenant_id | RLS | Notes |
|---|---|---|---|---|---|
| `products` | ✅ | 10 | ✅ NOT NULL | activé, 4 policies CRUD | seul modèle produit réel |
| `product_categories` | ❌ **N'EXISTE PAS** | — | — | — | référencée par le code (§2) |
| `suppliers` | ✅ | 0 | ✅ NOT NULL | activé, 4 policies | **pas de colonne `actif`** |
| `fournisseurs` (legacy FR) | ✅ | 0 | ✅ NOT NULL | activé, 4 policies | possède `solde_du`, sans équivalent chez `suppliers` |
| `purchases` | ✅ | 0 | ✅ NOT NULL | activé, **3 policies (pas de DELETE)** | CHECK statut avec doublons accentués |
| `purchase_items` | ✅ | 0 | ❌ **aucune colonne tenant_id** | activé, **2 policies (select/insert seulement)** | isolation indirecte via `purchases` |
| `purchase_orders` | ❌ **N'EXISTE PAS** | — | — | — | référencée par le code (§2) |
| `purchase_order_items` | ❌ **N'EXISTE PAS** | — | — | — | référencée par le code (§2) |
| `achats` (legacy FR) | ✅ | 0 | ✅ NOT NULL | activé, 4 policies | porte ses propres `debit_account`/`credit_account` en texte |
| `stock_movements` | ✅ | 0 | ✅ NOT NULL | activé, **2 policies (select/insert seulement)** | ledger append-only, colonnes `note` ET `notes` (doublon) |
| `stock_receptions` | ❌ **N'EXISTE PAS** | — | — | — | référencée par le code, **écrite** par une route API réelle (§2) |
| `stock_reception_items` | ❌ **N'EXISTE PAS** | — | — | — | idem |
| `warehouses` | ✅ | 1 | ✅ NOT NULL | activé, 4 policies | **pas de colonne `actif`** malgré usage code |
| `stock_transferts` | ✅ | 0 | ✅ NOT NULL | activé, 1 policy ALL | **déconnectée de `stock_movements`** (`fn_stock_sign('transfert')=0`) |
| `stock_articles` | ✅ | 0 | ✅ NOT NULL | activé, 4 policies, **mais via `auth_tenant_id()`** (pas `get_my_tenant_id()`) | 3ᵉ système de stock, indépendant, utilisé par le module restaurant |
| `v_products_stock` (vue) | ✅ | dérivée | — | `security_invoker=true` | stock = `SUM(fn_stock_sign(type) × quantite)` groupé par produit |

Recherche élargie (`ILIKE '%stock%|%achat%|%purchase%|%supplier%|%fournisseur%|%product%|%warehouse%|%entrepot%|%depot%'`) : aucune autre table pertinente trouvée.

`accounting_event_rules`, lignes ACH/STK :

| event_type | statut | débit | crédit | montant_field |
|---|---|---|---|---|
| STK-001 | active | 311 | 401 | montant_ht |
| STK-002 | active | 601 | 311 | montant_ht |
| STK-003 | **draft** | 311 | 779 | montant_ht |
| STK-004 | **draft** | 679 | 311 | montant_ht |
| ACH-001 | active | 601 | 401 | montant_ht |
| ACH-002 | active | 401 | 521 | montant_ht |

`montant_ht` n'existe comme colonne réelle sur **aucune** des tables `achats`/`purchases`/`stock_movements`/`stock_articles` — la valeur est fournie par le code applicatif en paramètre RPC (`p_montant_ht`), jamais relue depuis la table source. Fonctionne pour les deux routes réellement câblées (§7), mais n'est vérifiable par aucun test de contrat de schéma puisqu'aucune colonne de ce nom n'existe à comparer.

---

## 2. Cartographie code → DB (extraits significatifs)

| Fichier | Table/colonne | Existe | Lecture/Écriture | Chemin | Risque |
|---|---|---|---|---|---|
| `app/api/stock/reception/route.ts:47,57` | `stock_receptions` | ❌ | écriture (INSERT) | **actif, appelé par l'UI** | **CRITIQUE — échoue à la 1ʳᵉ écriture** |
| `app/api/stock/reception/route.ts:75` | `stock_reception_items` | ❌ | écriture (INSERT) | actif (inatteignable, l'insert précédent échoue avant) | CRITIQUE |
| `app/dashboard/stocks/receptions/page.tsx:89-122` | `stock_receptions`, `purchase_orders`, `stock_reception_items` | ❌❌❌ | lecture + écriture | actif (page réelle du menu Stocks) | CRITIQUE |
| `app/dashboard/stocks/commandes/page.tsx:88-193` | `purchase_orders`, `purchase_order_items` | ❌❌ | lecture + écriture | actif (page réelle du menu Stocks) | CRITIQUE |
| `app/dashboard/stocks/produits/page.tsx:82` | `product_categories` | ❌ | lecture | actif | HIGH — filtrage catégories cassé |
| `app/dashboard/stocks/categories/page.tsx:73-187` | `product_categories` | ❌ | lecture + écriture | actif, page dédiée entièrement construite sur une table inexistante | CRITIQUE |
| `app/dashboard/stocks/sorties/page.tsx:97`, `receptions/page.tsx:98`, `inventaires/page.tsx:81` | `warehouses.actif` | ❌ colonne | lecture (filtre `.eq('actif', true)`) | actif | HIGH — requête échoue (colonne inconnue) |
| `app/dashboard/stocks/entrepots/page.tsx:177` | `warehouses.actif` | ❌ colonne | écriture (`.update({actif: ...})`) | actif | HIGH |
| `app/dashboard/stocks/achats/page.tsx:89`, `commandes/page.tsx:95`, `receptions/page.tsx:97`, `retours/page.tsx:87` | `suppliers.actif` | ❌ colonne | lecture | actif | HIGH — requête échoue |
| `app/dashboard/stocks/commandes/page.tsx:95` | `suppliers.conditions_paiement` | ❌ colonne | lecture | actif | HIGH |
| `app/api/analytics/summary/route.ts:52` | `stock_articles.quantite_min` | ❌ colonne (réelle = `seuil_alerte`) | lecture | actif | HIGH |
| `fn_stock_alert()` (trigger `stock_articles`) | `NEW.quantite_min` | ❌ colonne | lecture (PL/pgSQL) | actif mais jamais déclenché (0 ligne) | HIGH — erreur runtime certaine dès la 1ʳᵉ vraie ligne |
| `app/dashboard/stocks/achats/page.tsx:82-190` | `purchases`, `purchase_items`, `suppliers`, `products` | ✅✅✅✅ | lecture + écriture | **actif et fonctionnel** | aucun — seul flux achat réellement sain |
| `app/api/stock/move/route.ts` | `products`, RPC `fn_stock_move`, `stock_movements` | ✅✅✅ | lecture + écriture via RPC | **actif et fonctionnel** | aucun |
| `app/dashboard/achats/page.tsx`, `app/api/achats/route.ts` | `fournisseurs`, `achats` | ✅✅ | lecture + écriture | actif et fonctionnel, mais **système parallèle isolé** | MEDIUM — doublon, pas de pont vers `suppliers`/`purchases` |
| `app/dashboard/stocks/fournisseurs/page.tsx` | `suppliers`, `purchases`, `products` | ✅✅✅ | lecture + écriture | actif et fonctionnel | aucun |
| `app/dashboard/restaurant/page.tsx`, `app/api/resto/**` | `stock_articles` | ✅ | lecture + écriture | actif (système propre au module restaurant, hors périmètre achats/stocks générique) | voir §6 |

---

## 3. Flux achat complet — reconstitution réelle

```
fournisseur → commande achat → réception → entrée stock → achat → dette fournisseur → paiement → comptabilité
```

| Étape | Existe réellement | Source de vérité | Writer | Événement comptable | Risque |
|---|---|---|---|---|---|
| Fournisseur | ✅ (deux tables parallèles, voir §6) | `suppliers` OU `fournisseurs` selon la page | UI directe | — | doublon non résolu |
| Commande d'achat (bon de commande) | ❌ **cassé** | `purchase_orders` inexistante | `app/dashboard/stocks/commandes/page.tsx` | — | page entière non fonctionnelle |
| Réception | ❌ **cassé** | `stock_receptions` inexistante | `app/api/stock/reception/route.ts` | STK-001 (jamais atteint — l'INSERT précédent échoue) | route entière non fonctionnelle |
| Entrée stock | ✅ (via un chemin différent) | `stock_movements` via RPC `fn_stock_move` | `app/api/stock/move/route.ts` | STK-002 sur sortie uniquement | fonctionnel, mais **déconnecté** du flux réception/commande ci-dessus |
| Achat (facture fournisseur) | ✅ | `purchases` + `purchase_items` | `app/dashboard/stocks/achats/page.tsx` | aucun événement comptable observé dans ce fichier (ACH-001 existe en base mais son émission n'a pas été localisée dans ce code) | fonctionnel côté données, lien comptable non confirmé |
| Dette fournisseur | ⚠️ partiel | `fournisseurs.solde_du` existe côté legacy ; `suppliers`/`purchases` n'a pas d'équivalent solde agrégé | — | — | deux modèles de dette non réconciliés |
| Paiement fournisseur | ✅ (legacy uniquement) | `achats.statut`/`date_paiement` | `app/dashboard/achats/page.tsx` | ACH-002 (existe en base) | uniquement câblé côté legacy `achats`, pas côté `purchases` |
| Comptabilité | voir §7 | — | — | — | — |

**Constat** : il n'existe **pas un** flux achat unique et complet, mais **des fragments de deux flux différents**, dont l'un (réception + commande) est purement cassé et l'autre (achats/paiement) n'existe que côté legacy français, isolé du modèle produit/stock moderne.

## 4. Flux stock complet

```
produit → entrepôt → entrée → sortie → transfert → ajustement → stock courant
```

- **Source de vérité confirmée** : `v_products_stock`, vue calculée en direct (`SUM(fn_stock_sign(type) × quantite)` sur `stock_movements`, groupé par `product_id`). Pas de colonne de stock courant sur `products` — c'est délibéré et documenté (`lib/architecture/stock-source-unique.test.ts`, ANO-C03).
- **Écriture unique et sûre** : `fn_stock_move()` (RPC), qui pose un verrou consultatif par produit (`pg_advisory_xact_lock`), recalcule le solde en direct, refuse toute écriture ferait passer le stock sous zéro, puis insère dans `stock_movements`. Aucune écriture directe possible en pratique : RLS n'autorise que `select`/`insert` sur `stock_movements` (pas d'UPDATE/DELETE), et un test d'architecture (`stock-source-unique.test.ts`) interdit statiquement tout `INSERT` direct dans le code hors RPC.
- **Entrée** : type `entree`/`reception` (+1). **Sortie** : type `sortie` (−1), câblée uniquement via `app/api/stock/move/route.ts`, qui émet STK-002. **Ajustement** : type `ajustement`, toujours traité comme +1 par `fn_stock_sign` (un ajustement négatif doit être encodé en quantité négative — non documenté, non validé par contrainte).
- **Transfert** : `type='transfert'` a un signe de 0 dans `fn_stock_sign` — un mouvement de transfert n'affecte donc jamais le stock calculé. Par ailleurs, `stock_transferts` (table séparée, dédiée aux transferts entre entrepôts) n'a **aucun lien** (FK, trigger) vers `stock_movements` : un transfert validé dans `stock_transferts` ne déplace rien dans le stock calculé de `v_products_stock`, sauf si l'application insère séparément les mouvements correspondants — invérifiable depuis la seule base.
- **Double comptage** : aucun risque direct détecté dans le mécanisme `fn_stock_move` lui-même (verrou + recalcul en direct = cohérent). Le risque réel est **la coexistence de deux systèmes de stock incompatibles** (§5).

## 5. Produits — classification

**B — actif mais incomplet.**

`products` (10 lignes réelles en production, RLS correcte, isolation tenant propre) est le seul modèle produit réellement fiable de tout le périmètre. Mais :
- Aucune catégorie fiscale, aucune notion d'origine (production/achat/import) — normal, ce n'est pas encore son rôle.
- `product_categories`, que le frontend traite comme une extension naturelle de `products`, n'existe pas — la fonctionnalité catégorie est un chemin mort.
- Consommé correctement par le flux achat moderne (`purchase_items.product_id`, `stock_movements.product_id`) et par `v_products_stock`.

## 6. Fournisseurs — classification

**D — doublonné.**

Deux tables parallèles, jamais reliées entre elles, consommées par des pages différentes du même module `dashboard` :
- `fournisseurs` (legacy FR, avec `solde_du`) — consommée par `/dashboard/achats` et `app/api/achats/route.ts`, flux fonctionnel de bout en bout (RLS correcte, 0 ligne en production).
- `suppliers` (EN, sans `actif` ni solde agrégé) — consommée par `/dashboard/stocks/fournisseurs`, `/dashboard/stocks/achats`, et par plusieurs pages qui filtrent sur une colonne `actif` inexistante (échec garanti).

Aucune des deux n'est objectivement "la bonne" — chacune sert un flux différent mais réel. Une future distinction producteur/distributeur devra choisir laquelle canoniser, ou accepter de devoir réconcilier les deux.

## 7. Comptabilité — chemin réel unique ?

**Non, il n'y a pas un chemin comptable unique.** Deux routes API appellent réellement `emit_accounting_event()` pour ce périmètre :
- `app/api/stock/move/route.ts` → STK-002 (sortie), **fonctionnel** (table/colonnes réelles).
- `app/api/stock/reception/route.ts` → STK-001, **jamais atteint en pratique** puisque l'écriture `stock_receptions` qui précède échoue systématiquement.

Aucun trigger PostgreSQL ne relie automatiquement `achats`, `purchases`, `stock_movements` ou `stock_articles` à une écriture comptable — la seule trigger trouvée sur tout le périmètre (`stock_articles.trg_stock_alert`) est une alerte de notification, pas une écriture comptable, et elle référence une colonne inexistante (`quantite_min`) qui la fait très probablement échouer dès la première vraie mise à jour.

L'émission d'ACH-001/ACH-002 (achat fournisseur / paiement) n'a été localisée dans **aucun** fichier de code consulté — les règles existent en base (`active`) mais aucun writer ne les appelle actuellement, dans ce périmètre.

## 8. Données de production (lecture seule, 2026-09-21)

| Table | Lignes |
|---|---|
| `products` | 10 |
| `warehouses` | 1 |
| `suppliers`, `fournisseurs`, `purchases`, `purchase_items`, `achats`, `stock_movements`, `stock_transferts`, `stock_articles` | 0 chacune |

Aucune donnée créée par cette mission.

## 9. Tests

- **`lib/architecture/stock-source-unique.test.ts`** — réel, pertinent, statique (scanne le code source) : interdit toute lecture/écriture de `products.stock_actuel` (n'existe pas), interdit `stock_movements.quantity` (la colonne est `quantite`), interdit tout INSERT direct dans `stock_movements` hors RPC. Ne couvre **que** `products`/`stock_movements`/`v_products_stock`.
- **`lib/architecture/schema-contract.test.ts`** — réel, pertinent, même méthode (compare les colonnes utilisées par le code à un contrat de schéma figé). Couvre `factures`, `facture_lignes`, `devis_lignes`, `purchases`, `purchase_items`. **Ne couvre pas** `suppliers`, `fournisseurs`, `achats`, `products`, `stock_movements`, `warehouses`, `stock_articles`, ni bien sûr les tables inexistantes (`stock_receptions`, `purchase_orders`, `product_categories`…) puisqu'un contrat ne peut être écrit que pour une table qui existe.
- **Aucun test** n'exerce `fn_stock_move` de bout en bout contre une vraie base, aucun test n'exerce le flux réception/commande, aucun test ne détecte qu'une table référencée par le code n'existe pas en base — c'est précisément le trou que `schema-contract.test.ts` comble pour `factures`/`purchases` mais pas pour le reste de ce périmètre, alors que sa propre documentation interne dit qu'il « aurait fait échouer chacun de ces commits le jour même ».
- Tous les autres fichiers `lib/architecture/*.test.ts` (identité, paie, fiscal, LOI-K/M/N/O, SAN-001, BTP-001…) sont sans rapport avec ce périmètre.

## 10. Problèmes classés

| ID | Gravité | Fichier(s) | Table | Preuve | Cause racine | Impact | Correction future recommandée |
|---|---|---|---|---|---|---|---|
| C1 | CRITICAL | `app/api/stock/reception/route.ts`, `app/dashboard/stocks/receptions/page.tsx` | `stock_receptions`, `stock_reception_items` | INSERT sur table absente (confirmé `information_schema`) | Migration jamais appliquée ou table jamais créée pour un code déjà livré | Le flux réception est 100% non fonctionnel dès le premier appel | Créer la/les table(s) manquante(s) OU réécrire la route sur `purchases`/`purchase_items`/`fn_stock_move` existants |
| C2 | CRITICAL | `app/dashboard/stocks/commandes/page.tsx` | `purchase_orders`, `purchase_order_items` | lecture/écriture sur tables absentes | idem | Page « Commandes fournisseur » entièrement non fonctionnelle | idem, ou fusion avec `purchases` |
| C3 | CRITICAL | `app/dashboard/stocks/categories/page.tsx`, `produits/page.tsx` | `product_categories` | lecture/écriture sur table absente | idem | Gestion des catégories produit entièrement non fonctionnelle | Créer la table ou revenir à `products.categorie` (texte libre déjà existant) |
| C4 | CRITICAL | `app/dashboard/achats/**` vs `app/dashboard/stocks/achats/**`, `stocks/fournisseurs/**` | `fournisseurs`/`achats` vs `suppliers`/`purchases`/`purchase_items` | deux systèmes parallèles, tous deux fonctionnels isolément, aucun pont | Deux générations de modules jamais réconciliées | Aucune table canonique unique sur laquelle accrocher `origine` (BOI-002) | Décision produit : choisir un système canonique, migrer/déprécier l'autre |
| C5 | CRITICAL | `accounting_event_rules` (STK-001/002/ACH-001/002) | `montant_ht` | champ référencé par aucune colonne réelle dans les tables sources | Le montant est fourni en paramètre RPC applicatif, jamais lu en base | Fonctionne aujourd'hui pour les 2 routes câblées, mais invérifiable par un test de contrat de schéma | Documenter explicitement ce contrat implicite, ou faire porter `montant_field` sur une colonne réelle |
| H1 | HIGH | `stocks/sorties`, `receptions`, `inventaires`, `entrepots/page.tsx` | `warehouses.actif` | colonne absente, filtrée/écrite par le code | Colonne jamais ajoutée à la migration `warehouses` | Requêtes en échec (filtre sur colonne inconnue) | Ajouter la colonne ou retirer le filtre |
| H2 | HIGH | `stocks/achats`, `commandes`, `receptions`, `retours/page.tsx` | `suppliers.actif` | colonne absente | idem | Requêtes en échec | idem |
| H3 | HIGH | `stocks/commandes/page.tsx` | `suppliers.conditions_paiement` | colonne absente | idem | Requête en échec | Ajouter la colonne ou retirer l'usage |
| H4 | HIGH | trigger `stock_articles.trg_stock_alert` / `fn_stock_alert()`, `app/api/analytics/summary/route.ts` | `stock_articles.quantite_min` (réel = `seuil_alerte`) | fonction PL/pgSQL référence un champ absent | Renommage de colonne non répercuté dans la fonction | Erreur runtime quasi certaine dès la première vraie ligne/mise à jour | Corriger la fonction pour utiliser `seuil_alerte` |
| H5 | HIGH | RLS `stock_articles` | `auth_tenant_id()` sans `ORDER BY`/`LIMIT` (vs `get_my_tenant_id()` partout ailleurs) | comparaison directe des deux définitions de fonction | Fonction dupliquée, jamais unifiée | Erreur RLS pour tout utilisateur ayant plus d'un profil | Faire pointer les policies `stock_articles` vers `get_my_tenant_id()` |
| H6 | HIGH | `lib/architecture/schema-contract.test.ts` | (couverture) | le test ne couvre pas `suppliers`/`products`/`stock_movements`/`warehouses`/`stock_articles`/`achats`/`fournisseurs` ni les tables inexistantes | Outil existant, jamais étendu à ce périmètre | Le filet de sécurité qui aurait détecté C1-C3/H1-H3 n'existe pas ici | Étendre le contrat de schéma à toutes les tables de ce périmètre |
| H7 | HIGH | `stock_transferts` | déconnectée de `stock_movements` | `fn_stock_sign('transfert')=0`, aucune FK/trigger de pont | Deux mécanismes de mouvement construits séparément | Un transfert validé peut ne jamais se refléter dans le stock calculé | Faire émettre systématiquement les `stock_movements` correspondants lors d'un transfert |
| M1 | MEDIUM | RLS `purchases`/`purchase_items`/`stock_movements` | policies manquantes (DELETE sur purchases ; UPDATE/DELETE sur purchase_items) | comptage direct des policies par table | Policies non complétées lors de la création | Impossible d'annuler/corriger un achat en base aujourd'hui | Ajouter les policies manquantes si un besoin métier de correction existe |
| M2 | MEDIUM | `purchases` CHECK `statut` | doublons accentués (`commande`/`commandé`, `annule`/`annulé`) | lecture directe de la contrainte | Normalisation incohérente | Risque de filtrage silencieusement incomplet | Choisir une seule graphie, migrer les valeurs |
| M3 | MEDIUM | `stock_articles` vs `products`/`stock_movements` | deux paradigmes de stock coexistants | comparé directement | Modules développés indépendamment (restaurant vs stocks générique) | Une future feature BOI doit choisir explicitement le bon système, pas supposer qu'il n'y en a qu'un | Documenter clairement laquelle des deux est la cible pour un futur module boisson |
| M4 | MEDIUM | `stock_movements` | colonnes `note` ET `notes` | lecture directe du schéma | Doublon accumulé | Confusion mineure, pas de perte de données | Fusionner à l'occasion d'une migration |
| M5 | MEDIUM | `stock_movements` | pas de CHECK anti-négatif sur `quantite` | lecture directe des contraintes | Le contrôle n'existe que dans `fn_stock_move`, pas en base | Défense en profondeur absente si la RPC est un jour contournée | Ajouter un CHECK ou se reposer sur les policies actuelles (select/insert only) |
| L1 | LOW | `fn_stock_sign()` | branches `IN`/`OUT`/`ADJUSTMENT`/`TRANSFER` mortes | comparées à la CHECK constraint de `stock_movements.type` | Ancien vocabulaire jamais retiré | Aucun (code mort) | Nettoyage cosmétique |
| I1 | INFO | `products` (10 lignes réelles) | `unite` | 100% des lignes = "pièce" | — | Aucune donnée volumique/litre aujourd'hui — pertinent si une future accise devait être quantitative plutôt qu'ad valorem | À noter pour la conception future |

**Total : 5 CRITICAL, 7 HIGH, 5 MEDIUM, 1 LOW, 1 INFO.**

---

## 11. Décision finale

**STOCKS_FOUNDATION = PARTIAL**

Un sous-ensemble réel et sain existe (`products` + `suppliers`/`purchases`/`purchase_items` + `stock_movements` via `fn_stock_move` + `v_products_stock`, RLS globalement correcte, deux tests d'architecture réels le protègent) — mais il coexiste avec des chemins actifs et atteignables depuis l'UI qui sont **prouvés cassés** (réception, commandes/bons de commande, catégories produit, plusieurs filtres `actif`), avec un second système fournisseur/achat legacy non réconcilié, et avec un troisième système de stock totalement indépendant (`stock_articles`). Ce n'est ni une fondation prête, ni une fondation à écarter entièrement — c'est un noyau utilisable entouré de code mort actif qui doit être identifié et traité avant toute construction dessus.

**BOI_IMPLEMENTATION = BLOCKED**

Le flux distributeur validé par BOI-002 (« fournisseur → achat → réception → stock ») s'appuie précisément sur l'étape réception, qui est aujourd'hui le maillon le plus cassé de toute la chaîne (C1). Ajouter un champ `origine`/`fournisseur_id` sur ce socle avant d'avoir résolu au minimum C1, C2, C4 (quel système fournisseur canoniser) et H6 (étendre la protection par test) reviendrait à construire une fonctionnalité fiscale sur des fondations dont une partie s'effondre au premier usage réel.

---

## À la fin

1. **Verdict** : `STOCKS_FOUNDATION = PARTIAL`, `BOI_IMPLEMENTATION = BLOCKED`.
2. **Problèmes par gravité** : 5 CRITICAL, 7 HIGH, 5 MEDIUM, 1 LOW, 1 INFO (18 au total).
3. **Les 5 problèmes les plus bloquants** : C1 (réception cassée — c'est l'étape centrale du flux distributeur BOI-002), C4 (deux systèmes fournisseur/achat non réconciliés — aucune table canonique où accrocher `origine`), C2 (commandes fournisseur cassées), C3 (catégories produit cassées), H6 (le test qui aurait dû protéger ce périmètre ne le couvre pas).
4. **Dépendances avec BOI-002** : le modèle cible de BOI-002 (origine au niveau produit, flux distributeur réutilisant achats/stocks génériques) présuppose un flux achat→réception→stock fonctionnel de bout en bout — ce préalable n'est aujourd'hui pas rempli (C1, C2, C4).
5. **Mission suivante exacte** : une mission de **réparation** du Core Achats/Stocks (hors périmètre fiscal/BOI), limitée à : (a) trancher entre `fournisseurs`/`achats` et `suppliers`/`purchases`/`purchase_items` comme système canonique unique, (b) réparer ou retirer le flux réception (`stock_receptions`/`stock_reception_items`) et le flux commandes (`purchase_orders`/`purchase_order_items`), (c) corriger les colonnes fantômes (`warehouses.actif`, `suppliers.actif`, `suppliers.conditions_paiement`, `stock_articles.quantite_min`), (d) étendre `schema-contract.test.ts` à l'ensemble de ce périmètre. Ce n'est qu'une fois cette mission fermée que la conception produit boisson (origine/fournisseur_id) pourra être bâtie avec confiance sur ce socle.

Aucun fichier de code modifié. Aucune migration créée. Aucune donnée production touchée. Aucun commit, aucun push.

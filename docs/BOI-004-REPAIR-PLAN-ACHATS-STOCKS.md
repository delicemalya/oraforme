# BOI-004 — Plan de réparation du Core Achats + Stocks

Mission P0-BOI-004, 2026-09-21. Suite de BOI-003 (`STOCKS_FOUNDATION = PARTIAL`, `BOI_IMPLEMENTATION = BLOCKED`). Périmètre strict : produits, fournisseurs, achats, lignes d'achat, réceptions, mouvements de stock, entrepôts, calcul du stock. Hors périmètre : accise, fiscalité BOI, production industrielle, nouveau modèle boisson. BOI reste bloqué à l'issue de cette mission — cette mission répare le socle, elle ne le construit pas pour la boisson.

---

## Étape 1 — Décision de source canonique (Principe #1)

### A. `fournisseurs` / `achats` (legacy)

| Critère | État |
|---|---|
| Existence DB | ✅ (0 ligne) |
| Structure | Plate : `achats` n'a pas de lignes de détail, un seul `montant` par achat, pas de lien produit |
| FK | `achats.fournisseur_id → fournisseurs.id` ; `achats.cost_center_id → cost_centers.id` |
| tenant_id | ✅ sur les deux tables |
| RLS | ✅ 4 policies CRUD complètes sur les deux tables |
| Consommateurs actifs UI | **`/dashboard/achats`, atteignable depuis le Sidebar principal (nav.achats) et depuis les raccourcis sectoriels de `boisson`, `btp`, `agriculture`, `petrole`** |
| Données production | 0 ligne |
| Comptabilité | **Fonctionnelle et complète** : `app/api/achats/route.ts` émet réellement ACH-001 (facture, 601/401) à la création et ACH-002 (règlement, 401/521) au paiement, via `emit_accounting_event()` |
| Stock | **Aucun** — pas de lien produit, ne peut jamais alimenter `stock_movements` |
| Tests | Aucun test d'architecture ne couvre `achats`/`fournisseurs` |
| API | `app/api/achats/route.ts` (POST/PATCH), fonctionnelle |
| Migrations | Ancienne génération, pas de ligne de détail par conception |
| Maintenabilité | Simple mais structurellement incapable de représenter une ligne d'achat produit → ne peut jamais satisfaire le critère de sortie de la mission (« ligne achat → stock ») sans être redessinée en `purchases` |

### B. `suppliers` / `purchases` / `purchase_items`

| Critère | État |
|---|---|
| Existence DB | ✅ (0 ligne chacune) |
| Structure | `purchases` (en-tête, `statut` en machine à états brouillon→commandé→reçu→payé/annulé) + `purchase_items` (lignes, `product_id`/`quantite`/`prix`) |
| FK | `purchase_items.purchase_id → purchases.id`, `purchase_items.product_id → products.id`, `purchases.supplier_id → suppliers.id` |
| tenant_id | ✅ sur `purchases`/`suppliers` ; **absent sur `purchase_items`** (isolation indirecte via `purchases`, fonctionnelle mais moins directe) |
| RLS | ✅ isolation correcte, mais incomplète en CRUD (pas de DELETE sur `purchases`, pas d'UPDATE/DELETE sur `purchase_items`) — non bloquant pour le flux de repos |
| Consommateurs actifs UI | `/dashboard/stocks/achats` (sous-page du hub Stocks, pas dans le Sidebar principal avant cette mission) |
| Données production | 0 ligne |
| Comptabilité | **Absente avant cette mission** : la création n'émet rien ; le paiement appelait `writeComptaEntry()` (dette technique documentée EXM-JE-003 dans `lib/architecture/loi-k-unique-writer.test.ts`), pas `emit_accounting_event()` |
| Stock | **Le seul chemin qui fonctionne réellement** : `purchase_items.product_id` → `fn_stock_move()` → `stock_movements` → `v_products_stock` |
| Tests | `lib/architecture/schema-contract.test.ts` couvre déjà `purchases`/`purchase_items` (colonnes réelles vérifiées statiquement) |
| API | Écritures faites directement depuis le client avant cette mission (pas d'API serveur dédiée) |
| Migrations | Migration 016 (purchases/purchase_items), 174 (colonnes additionnelles) |
| Maintenabilité | Seule structure capable de satisfaire « fournisseur → achat → ligne achat → stock » telle que l'exige le critère de sortie |

### Décision

**`CANONICAL_PURCHASE_STACK = B`**

Justification : le critère de sortie de la mission exige explicitement « ligne achat → réception/entrée → stock ». Seule B porte des lignes d'achat liées à un produit et alimente réellement `stock_movements`. A ne peut satisfaire ce critère sans être redessinée — ce qui reviendrait à recréer B. Conserver les deux serait une troisième architecture déguisée. Le déficit réel de B (aucune comptabilité au moment de l'achat, comptabilité de paiement via une dette technique documentée) est un vrai défaut, mais un défaut **réparable en réutilisant l'écrivain déjà prouvé** (ACH-001/ACH-002 de A) plutôt qu'une raison de garder A comme source de vérité.

---

## Étape 2 — Cartographie complète (Principe #2)

| Action | UI | API | Service | DB (écriture) | Stock | Comptabilité |
|---|---|---|---|---|---|---|
| Création fournisseur | `stocks/fournisseurs/page.tsx` | — (écriture client directe) | — | `suppliers` | — | — |
| Création produit | `stocks/produits/page.tsx` | — (écriture client directe) | — | `products` | — | — |
| Création achat | `stocks/achats/page.tsx` (avant réparation : écriture client directe) | **après réparation : `POST /api/stocks/purchases`** | `emit_accounting_event` (différé à la réception, voir Étape 7) | `purchases` + `purchase_items` | — | aucune à ce stade (correct) |
| Réception | avant réparation : `stocks/receptions/page.tsx` → table inexistante ; après : bouton statut sur `stocks/achats/page.tsx` | **`PATCH /api/stocks/purchases`** (`statut='reçu'`) | `fn_stock_move` (par ligne) + `emit_accounting_event('ACH-001')` | `stock_movements` | ✅ entrée | ✅ ACH-001 (601/401) |
| Paiement | `stocks/achats/page.tsx` | **`PATCH /api/stocks/purchases`** (`statut='payé'`) | `emit_accounting_event('ACH-002')` | `purchases.statut` | — | ✅ ACH-002 (401/521) |
| Entrée stock (hors achat) | `stocks/mouvements/page.tsx` (à vérifier au cas par cas, hors périmètre de réécriture ici) | `app/api/stock/move/route.ts` | `fn_stock_move` | `stock_movements` | ✅ | — |
| Sortie stock | `stocks/sorties/page.tsx` | `app/api/stock/move/route.ts` | `fn_stock_move` + `emit_accounting_event('STK-002')` | `stock_movements` | ✅ sortie | ✅ STK-002 (601/311), déjà fonctionnel, non modifié |
| Transfert | `stocks/transferts/page.tsx` | écriture client directe sur `stock_transferts` | — | `stock_transferts` | ⚠️ déconnecté de `stock_movements` (non traité ici, documenté) | — |
| Ajustement | pas de page dédiée trouvée | `fn_stock_move(type='ajustement')` disponible mais pas d'UI dédiée | — | — | possible via RPC | STK-003/004 en `draft`, non traité ici |
| Consultation stock | `stocks/page.tsx`, `stocks/produits/page.tsx`, `stocks/alertes/page.tsx`, etc. | — | — | lecture `v_products_stock` | source unique confirmée | — |

**Chaque writer identifié.** Aucun nouveau writer créé au sens d'un nouveau mécanisme : `emit_accounting_event`/`fn_ae_execute_event` est le même moteur déjà utilisé par ACH-001/002 dans `app/api/achats/route.ts` — seule sa cible (source_table) change, de `achats` vers `purchases`.

---

## Étape 3 — Preuve de la source unique du stock (Principe #3)

`stock initial + entrées − sorties +/− ajustements = stock courant` est prouvé par construction dans `v_products_stock` :

```sql
COALESCE(SUM(fn_stock_sign(type) * quantite), 0) AS stock_actuel
FROM stock_movements GROUP BY product_id
```

- `fn_stock_move()` est le seul point d'écriture praticable : RLS sur `stock_movements` n'autorise que `select`/`insert` (aucun UPDATE/DELETE possible pour un rôle non-superuser), et `fn_stock_move()` lui-même pose un verrou consultatif par produit (`pg_advisory_xact_lock`) et refuse toute écriture qui ferait passer le stock calculé sous zéro.
- Aucun champ de stock dupliqué sur `products` (confirmé par `lib/architecture/stock-source-unique.test.ts`, déjà existant et réel).
- Aucun calcul de stock côté frontend trouvé — toutes les pages lisent `v_products_stock`.
- **Une seconde source de vérité existe, mais pour un périmètre différent** : `stock_articles` (running-total direct, pas événementiel) sert exclusivement le module restaurant (`app/dashboard/restaurant/**`, `app/api/resto/**`). Ce n'est pas une source concurrente pour les mêmes entités — c'est un système séparé, pour un module séparé. **Décision : ne pas unifier `stock_articles` avec `products`/`stock_movements` dans cette mission** — cela dépasserait le périmètre strict (ce serait toucher au module restaurant, non listé dans le périmètre de BOI-004) et introduirait un risque de régression sur un module fonctionnel. `stock_articles` reste KEEP, avec ses deux bugs réels corrigés (voir Étape 5) sans changer son modèle.

`STOCK_SOURCE_OF_TRUTH = stock_movements` (via `fn_stock_move` + `v_products_stock`), confirmé, aucune réparation de mécanisme nécessaire — seules des corrections de colonnes fantômes en périphérie (Étape 5).

---

## Étape 4 — Décision réception (Principe #4)

`stock_receptions`/`stock_reception_items` sont référencées par `app/api/stock/reception/route.ts` et `app/dashboard/stocks/receptions/page.tsx`. Pourquoi elles existent dans le code sans exister en base : une fonctionnalité a été livrée sans que sa migration ne soit jamais appliquée ou créée (même défaut que documenté pour `product_categories`/`purchase_orders`).

**Une réception est-elle réellement nécessaire comme entité distincte ?** Non, démontré par l'existence même d'un flux alternatif déjà fonctionnel : `stocks/achats/page.tsx` gère déjà la réception comme une **transition de statut** sur `purchases` (`commandé → reçu`), qui déclenche `fn_stock_move('reception', ...)` pour chaque ligne — sans jamais passer par `stock_receptions`. Ce chemin marche déjà pour la partie stock (seule la partie comptable manquait, réparée à l'Étape 7).

**Décision : Option C — adapter l'UI/API au modèle canonique existant.** La réception devient la transition `purchases.statut → 'reçu'`, pas une nouvelle entité. `stock_receptions`/`stock_reception_items` ne sont pas créées.

Conséquence pour la non-conformité (`quantite_attendue` vs `quantite_recue`, champ `conformite`) que l'ancienne UI tentait de modéliser : **cette fonctionnalité n'a jamais réellement fonctionné** (0 donnée, table absente depuis l'origine) — ce n'est donc pas une régression de la retirer, c'est refuser d'inventer une capacité jamais démontrée. Si un besoin réel de réception partielle/non conforme apparaît un jour, il s'ajoutera comme colonnes supplémentaires sur `purchase_items` (`quantite_recue`), pas comme nouvelle entité.

`RECEPTION_MODEL = C (transition de statut sur purchases, aucune nouvelle table)`

---

## Étape 5 — Legacy (Principe #5)

| Élément | Statut UI | Statut API | Données | Décision | Preuve |
|---|---|---|---|---|---|
| `app/dashboard/achats/page.tsx` | Atteint via Sidebar + raccourcis sectoriels | `app/api/achats/route.ts` fonctionnel | 0 ligne | **DEPRECATE** | Comptabilité réelle et fonctionnelle (ACH-001/002) — ne pas supprimer tant que rien ne la remplace vraiment ; retirée de la navigation principale (Étape 4 code), fichier conservé et accessible par URL directe |
| `app/api/achats/route.ts` | — | Fonctionnel | 0 ligne | **DEPRECATE** | Même raison ; son pattern d'émission ACH-001/002 est réutilisé (pas dupliqué) sur `purchases` |
| `fournisseurs` / `achats` (tables) | — | — | 0 ligne | **DEPRECATE** (schéma conservé, aucune migration destructive) | 0 ligne = aucun risque de perte de données à conserver le statu quo |
| `app/dashboard/rapports/page.tsx:160` | Actif | — | lit `achats.montant` | **MIGRATE** | Doit désormais additionner `purchases.montant_total` pour rester exact une fois B canonique ; lecture des deux sources conservée pour continuité historique |
| `app/dashboard/erp-sync/page.tsx:97` | Actif | — | affichage seul (label `ACH-001`) | **KEEP** | Purement informatif, aucune écriture ; reste valide puisque l'event_type `ACH-001` continue d'exister, juste émis depuis une autre source_table |
| `lib/erp-sectors.ts`, `DashboardClient.tsx`, pages secteurs (`boisson`, `btp`, `agriculture`, `petrole`) | Actifs, pointent vers `/dashboard/achats` | — | — | **MIGRATE** | Href changé vers `/dashboard/stocks/achats`, canonique |

Aucun fichier supprimé.

---

## Étape 6 — Tenant + RLS (Principe #6)

Vérifié pour `suppliers`, `products`, `purchases`, `purchase_items`, `stock_movements`, `warehouses` (requêtes `pg_policies` directes, BOI-003) :

- Toutes les tables portent `tenant_id` (sauf `purchase_items`, isolée indirectement via `purchases`) et toutes les policies existantes filtrent sur `tenant_id = get_my_tenant_id()` (ou la subquery équivalente pour `purchase_items`).
- **Aucune fuite cross-tenant trouvée.** Les lacunes identifiées en BOI-003 (policies CRUD incomplètes sur `purchases`/`purchase_items`/`stock_movements`) sont des refus par défaut (RLS activé sans policy = accès refusé), jamais des fuites — un défaut de fonctionnalité, pas de sécurité.
- Seule anomalie réelle : `stock_articles` utilise `auth_tenant_id()` (sans garde `ORDER BY`/`LIMIT`) au lieu de `get_my_tenant_id()` — un utilisateur avec plusieurs lignes `profiles` obtiendrait une erreur RLS sur cette table spécifiquement, jamais un accès cross-tenant. Corrigé en Étape 8 (migration).

`TENANT_ISOLATION = PASS`

---

## Étape 7 — Comptabilité (Principe #7)

Tracé exact avant réparation :
- `achats` (legacy) → `emit_accounting_event('ACH-001'/'ACH-002')` → `fn_ae_execute_event()` → `journal_entries`. **Fonctionnel.**
- `purchases` (canonique) → **rien** à la création ; `writeComptaEntry()` (écriture directe `journal_comptable` + `journal_entries`, hors moteur événementiel) au paiement seulement. **Incomplet et hors moteur canonique**, mais `writeComptaEntry` est une exemption documentée et tolérée de LOI-K (`EXM-JE-003`), pas une violation nouvelle découverte ici.

**Décision de réparation — sans créer de nouveau writer :** réutiliser exactement le même moteur (`emit_accounting_event`, event_types `ACH-001`/`ACH-002` déjà actifs dans `accounting_event_rules`, aucune modification de ces règles), en le faisant pointer vers `purchases`/`purchase_items`/`suppliers` au lieu de `achats`/`fournisseurs`. Ce n'est pas un nouveau writer : c'est le même writer, retargeté — cohérent avec le principe « une seule source de vérité ».

**Point d'émission choisi : à la transition `statut → 'reçu'`, pas à la création.** Justification : `achats` (legacy) n'avait pas de notion de brouillon — il postait immédiatement. `purchases` a un cycle de vie explicite (brouillon → commandé → reçu → payé/annulé) ; poster ACH-001 dès le brouillon risquerait de comptabiliser des achats qui seront ensuite annulés. Le fait générateur économiquement réel — la dette envers le fournisseur — naît quand la marchandise et la facture sont effectivement reçues, pas à la simple intention d'achat.

**Un achat ne doit jamais poster deux fois la dette fournisseur.** `STK-001` (311/401, méthode de l'inventaire permanent) existe déjà dans `accounting_event_rules` mais n'a **jamais été câblé** (le seul appelant, `app/api/stock/reception/route.ts`, échouait avant d'atteindre l'émission). Émettre à la fois ACH-001 (601/401, méthode intermittente, déjà prouvée fonctionnelle) et STK-001 pour le même événement **doublerait le crédit 401** — une vraie erreur comptable. **Décision explicite : seul ACH-001 est câblé sur la transition `reçu`. STK-001 reste défini mais non déclenché par ce flux** — c'est un choix de politique comptable (méthode de l'inventaire intermittent, cohérente avec ce qui fonctionne déjà), pas un oubli. Documenté ici pour qu'une future mission ne le câble pas par erreur en plus d'ACH-001.

Le suivi **quantitatif** du stock (`fn_stock_move`) continue de se déclencher à la réception indépendamment de la politique comptable choisie — ce sont deux préoccupations orthogonales (quantité physique vs valorisation comptable).

`ACCOUNTING_WRITER = emit_accounting_event (ACH-001 à réception, ACH-002 à paiement), source_table='purchases'`

---

## Étape 8 — Données production (Principe #8)

Toutes les tables du périmètre ont 0 ligne, sauf `products` (10) et `warehouses` (1) — vérifié en lecture seule, non modifié. **Aucune migration de données n'est nécessaire** : le changement de source canonique ne déplace aucune ligne réelle (rien n'existe à déplacer). La migration préparée en Étape 5/9 est strictement additive/corrective (nouvelles colonnes nullable ou à défaut sûr, correction de fonctions) — aucun DROP, aucun UPDATE de données, aucun risque pour les 11 lignes réelles existantes (`products` + `warehouses`).

---

## Étape 9 — Tests (Principe #9)

Voir `lib/architecture/achats-stocks-repair.test.ts` (nouveau fichier) :
1. Caractérisation : les schémas réels de `suppliers`/`products`/`stock_movements`/`warehouses`/`purchases`/`purchase_items` sont figés en contrat statique (extension de la méthode de `schema-contract.test.ts`), pour empêcher la réapparition d'une colonne fantôme.
2. Vérification statique que `app/api/stock/reception/route.ts` et les pages `commandes`/`receptions` n'référencent plus `stock_receptions`, `stock_reception_items`, `purchase_orders`, `purchase_order_items`, `product_categories`.
3. Vérification statique qu'aucun writer comptable direct (`journal_entries`/`journal_comptable` en écriture) n'apparaît dans le nouveau code `purchases`, seul `emit_accounting_event` est autorisé.
4. Test d'intégration réel (transaction PostgreSQL annulée, pattern déjà éprouvé dans cet engagement) exerçant `fn_stock_move` + `emit_accounting_event('ACH-001')` de bout en bout contre la vraie base, puis `ROLLBACK` — aucune donnée production créée.
5. Isolation tenant : vérifie que les policies RLS des tables du périmètre filtrent bien sur `tenant_id`.

---

## Étape 10 — Migration préparée, non exécutée

Fichier : `supabase/migrations/183_repair_achats_stocks_core.sql`. Contenu (additif/correctif uniquement, voir Étape 8) :
1. `ALTER TABLE warehouses ADD COLUMN actif boolean NOT NULL DEFAULT true`
2. `ALTER TABLE suppliers ADD COLUMN actif boolean NOT NULL DEFAULT true`
3. `ALTER TABLE suppliers ADD COLUMN conditions_paiement text`
4. `CREATE OR REPLACE FUNCTION fn_stock_alert()` — corrige la référence à `quantite_min` (colonne inexistante) vers `seuil_alerte` (colonne réelle)
5. Recréation des policies RLS de `stock_articles` sur `get_my_tenant_id()` au lieu de `auth_tenant_id()`

**Non exécutée dans cette mission.** À appliquer seulement après revue humaine explicite.

---

## État final obligatoire

```
PURCHASE_SOURCE_OF_TRUTH = suppliers / purchases / purchase_items
STOCK_SOURCE_OF_TRUTH    = stock_movements (via fn_stock_move + v_products_stock)
RECEPTION_MODEL          = C — transition de statut purchases.statut → 'reçu', aucune nouvelle table
LEGACY_PURCHASE_MODEL    = fournisseurs / achats — DEPRECATE (conservé, retiré de la navigation principale)
ACCOUNTING_WRITER        = emit_accounting_event, ACH-001 à réception / ACH-002 à paiement, source_table='purchases'
TENANT_ISOLATION         = PASS
```

```
STOCKS_FOUNDATION  = PARTIAL
BOI_IMPLEMENTATION = BLOCKED
```

### Pourquoi `STOCKS_FOUNDATION` reste `PARTIAL` et non `READY`

Le flux central « fournisseur → achat → ligne achat → réception → stock → sortie » est désormais réparé et démontrable avec une seule source de vérité (voir tests Étape 9). Mais deux éléments empêchent de déclarer `READY` sans mentir :
1. **Un nouveau défaut critique a été découvert pendant cette mission**, hors du périmètre de réparation choisi : la page de création/édition produit (`stocks/produits/page.tsx`) écrit sur `products` sept colonnes qui n'existent pas (`categorie_id`, `fournisseur_id`, `stock_max`, `statut`, `taxe_pct`, `emplacement`, `description`) — la création/modification d'un produit via l'UI échoue. Les 10 lignes `products` existantes ont donc été créées par un autre moyen (SQL direct ou une version antérieure du code). **Non corrigé dans cette mission** (hors périmètre strict — corriger correctement exigerait une décision de modèle produit, proche de « nouvelle fonctionnalité commerciale », explicitement interdite). Documenté pour une mission dédiée.
2. La gestion de catégories produit reste volontairement minimale (lecture des valeurs distinctes de `products.categorie`, pas de CRUD hiérarchique) — un choix délibéré de ne pas inventer une table, pas un défaut caché.

### Pourquoi `BOI_IMPLEMENTATION` reste `BLOCKED`

Cette mission répare le socle achats/stocks — elle ne construit aucun élément boisson (interdiction explicite de la mission). BOI reste bloqué en attendant une mission dédiée de conception du modèle produit boisson (origine/fournisseur_id), qui pourra désormais s'appuyer sur un socle réellement réparé plutôt que sur des tables fantômes.

---

## Fichiers modifiés par cette mission

- `app/api/stock/reception/route.ts` — réécrit (Option C)
- `app/api/stocks/purchases/route.ts` — nouveau
- `app/dashboard/stocks/achats/page.tsx` — appelle la nouvelle API au lieu d'écritures client directes
- `app/dashboard/stocks/receptions/page.tsx` — devient une vue lecture seule des achats reçus
- `app/dashboard/stocks/commandes/page.tsx` — devient une vue filtrée des achats en attente
- `app/dashboard/stocks/categories/page.tsx` — devient une vue dérivée de `products.categorie`
- `app/dashboard/stocks/produits/page.tsx` — retire la requête `product_categories` phantom (le reste, hors périmètre, non touché)
- `app/dashboard/rapports/page.tsx` — additionne `purchases.montant_total`
- `lib/erp-sectors.ts`, `components/dashboard/DashboardClient.tsx`, `app/dashboard/boisson/page.tsx`, `app/dashboard/btp/page.tsx`, `app/dashboard/agriculture/page.tsx`, `app/dashboard/petrole/page.tsx` — href `/dashboard/achats` → `/dashboard/stocks/achats`
- `app/dashboard/achats/page.tsx`, `app/api/achats/route.ts` — commentaire de dépréciation seulement
- `lib/architecture/achats-stocks-repair.test.ts` — nouveau
- `supabase/migrations/183_repair_achats_stocks_core.sql` — préparée, **non exécutée**

Aucun commit, aucun push, aucune exécution de migration.

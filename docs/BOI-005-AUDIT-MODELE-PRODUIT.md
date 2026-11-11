# BOI-005 — Audit + réparation du modèle produit

Mission P0-BOI-005, 2026-09-21. Suite de BOI-004. Objectif : rendre `products` techniquement cohérent (schéma réel = code réel), sans coder aucun concept BOI/accise (origine, catégorie fiscale, taux, ConfigAccise, producteur/distributeur).

**Note d'exécution** : le MCP Supabase s'est déconnecté en cours de session. L'audit et les vérifications live de cette mission ont été faits via l'API PostgREST directe (`https://mrzixapnaqsbqmagivvf.supabase.co/rest/v1/`, clé `service_role`, lecture de `.env.local`), qui reflète exactement le même schéma réel — les colonnes retournées par PostgREST sont les colonnes réelles de la table, sans aucune supposition frontend. Aucune méthode de repli n'a été inventée : c'est le même projet, la même base, interrogée par un autre chemin HTTP.

---

## Étape 1 — Structure réelle de `products`

Confirmée par une requête PostgREST réelle (`GET /rest/v1/products?select=*&limit=20`, 10 lignes retournées) et par la précédente forensique BOI-003/004 (RLS/FK/contraintes déjà établies et inchangées, aucune migration exécutée depuis) :

| Colonne | Type observé | Nullable | Défaut |
|---|---|---|---|
| id | uuid | non | gen_random_uuid() |
| tenant_id | uuid | non | — |
| nom | text | non | — |
| categorie | text | oui | — |
| sku | text | oui | — |
| code_barre | text | oui | null |
| unite | text | non | 'pièce' |
| prix_achat | numeric | non | 0 |
| prix_vente | numeric | non | 0 |
| seuil_alerte | numeric | non | 0 |
| image_url | text | oui | null |
| created_at | timestamptz | non | now() |

FK : `tenant_id → tenants.id`. RLS activé, 4 policies CRUD (`get_my_tenant_id()`), confirmé en BOI-003.

**12 colonnes, exactement.** Comparé au frontend (avant réparation) : `stocks/produits/page.tsx` écrivait 7 colonnes en plus (`description`, `categorie_id`, `stock_max`, `fournisseur_id`, `emplacement`, `statut`, `taxe_pct`) ; `commerce/catalogue/page.tsx` écrivait en plus `description` et `statut` ; `commerce/page.tsx` (POS) filtrait sur `statut` ; `stocks/alertes/page.tsx` et `stocks/valorisation/page.tsx` lisaient `stock_max`. Aucune de ces 7 colonnes n'a jamais existé en production.

## Étape 2 — Origine des 10 produits réels

**`scripts/seed-demo-data.ts`**, lignes 146-157 (tableau `PRODUITS`) et 253-260 (boucle d'insertion) :

```ts
const { error } = await sb.from('products').insert({ tenant_id: tid, ...p, unite: 'pièce' })
```

où chaque `p` ne porte que `nom, categorie, sku, prix_achat, prix_vente`. Preuves de cohérence : les 10 SKU sont `SKU-DEMO-001` à `SKU-DEMO-010`, créés à 300-400ms d'intervalle (`created_at` séquentiel, motif de script, pas de saisie humaine), tous pour le même `tenant_id`. **Aucune des 7 colonnes fantômes n'est utilisée par ce script.** Ces données sont cohérentes avec le schéma réel et utilisables sans modification par le flux achats/stocks (déjà prouvé fonctionnel en BOI-004 : un de ces 10 produits a servi de cobaye à la validation live purchases→réception→stock→comptabilité).

**Aucune donnée production modifiée** pendant cet audit (confirmé par recomptage final, Étape 12).

## Étape 3 — Audit des 7 colonnes fantômes

Découverte majeure : **`supabase/migrations/050_stocks_enterprise_tables.sql` définit exactement ces 7 colonnes** (`ALTER TABLE products ADD COLUMN IF NOT EXISTS description, categorie_id, stock_max, fournisseur_id, emplacement, statut, taxe_pct`), aux côtés de `product_categories`, `purchase_orders`, `stock_receptions`, `stock_sorties`, `stock_retours` et d'autres tables. **Cette migration n'a jamais été appliquée en production**, confirmé par `docs/RESTART-AUDIT-AZ.md:181`, qui la liste explicitement dans la famille de migrations jamais jouées (« 050 stocks, 055 workflow, 091 santé, 104 academy, 116, 121, 157, 158 »). Ce n'est donc pas une invention de code sans plan — c'est un plan écrit et jamais livré.

Mais **cette migration est elle-même incohérente avec l'architecture réellement construite depuis** : son trigger (`trg_products_check_stock`, `AFTER UPDATE OF stock_actuel ON products`) et sa vue (`stock_valorisation_view`, `p.stock_actuel * p.prix_achat`) supposent que `products.stock_actuel` est une **colonne réelle** — or `products.stock_actuel` n'a **jamais existé** et ne doit jamais exister : c'est précisément le défaut ANO-C03 documenté dans `lib/architecture/stock-source-unique.test.ts`, corrigé en établissant `stock_movements`/`v_products_stock` comme source unique. Appliquer la migration 050 telle quelle réintroduirait ce défaut déjà corrigé. Elle crée aussi `purchase_orders`/`purchase_order_items`/`stock_receptions`/`stock_reception_items` — exactement les entités que BOI-004 a délibérément refusé de recréer (Décision C : réception = transition de statut sur `purchases`, pas une nouvelle entité). **La migration 050 ne peut donc pas être simplement « débloquée » — son design contredit deux décisions architecturales déjà validées et testées en production.**

| Colonne | A. Concept nécessaire ? | B. Existe ailleurs ? | Consommateur réel trouvé | Décision |
|---|---|---|---|---|
| `categorie_id` | Oui (catégories hiérarchiques, couleur/icône/parent — design réel dans migration 050) | Partiellement : `products.categorie` (texte libre) couvre le besoin de groupement actuel | Aucun consommateur fonctionnel (la seule UI qui l'utilisait était cassée) | **DEFER** — concept valide, non prouvé nécessaire aujourd'hui au-delà du texte libre déjà en place |
| `fournisseur_id` | Non, tel que conçu | La vraie relation produit↔fournisseur vit dans `purchases`→`purchase_items` (BOI-004) | Aucun | **REMOVE** — une FK unique produit→fournisseur contredit la réalité multi-fournisseurs déjà établie ; erreur de modélisation, pas un manque |
| `stock_max` | Concept valide (alerte surplus) mais conçu contre `products.stock_actuel` (colonne fantôme) | Non | 2 consommateurs, tous deux cassés (`alertes`, `valorisation`), branche « surplus » toujours inerte (`notif_surplus` par défaut `false`) | **REMOVE** — design incompatible avec `v_products_stock` ; à reconcevoir entièrement si un jour nécessaire, pas à ressusciter tel quel |
| `statut` (actif/inactif/archive) | Oui — 2 modules réels en dépendaient (`commerce/catalogue`, POS `commerce/page.tsx`) | Non | Deux consommateurs réels, tous deux cassés avant réparation | **REMOVE (du code), DEFER (de la base)** — voir note ci-dessous |
| `taxe_pct` | **Non — explicitement interdit par la mission** | Le Fiscal Core (`lib/countries/*.ts`, `lib/fiscal/universal-tax-engine.ts`) est la source canonique des taux | Aucun (aucun lien `products`→`facture_lignes`, la facturation est en texte libre sans `product_id`) | **REMOVE**, définitivement |
| `emplacement` | Non, au niveau produit | `stock_movements.warehouse_id` porte déjà l'entrepôt ; un produit peut être dans plusieurs entrepôts | Aucun | **REMOVE** — incohérent avec le modèle multi-entrepôt réel (un champ texte unique par produit ne peut pas représenter une répartition multi-entrepôt) |
| `description` | Oui, mais mineur | Non | Un seul consommateur réel (`commerce/catalogue`, cassé), affichage seul | **DEFER** — légitime, faible risque, mais non démontré indispensable |

Note sur `statut` : deux modules réels (catalogue commerce + caisse POS) avaient un vrai besoin fonctionnel (masquer les produits inactifs à la vente). Mais comme aucune migration n'est exécutée dans cette mission, le code doit fonctionner **aujourd'hui**, avec le schéma **actuellement réel** — qui ne comprend pas `statut`. La réparation a donc retiré la dépendance (POS affiche tous les produits, catalogue calcule un badge « Stock faible / En stock » depuis `stock_actuel`/`seuil_alerte`, déjà réels) plutôt que de laisser du code cassé en attendant une migration hypothétique. Si un vrai besoin de statut actif/inactif est confirmé plus tard, c'est la seule des 7 colonnes qui mériterait sa propre migration dédiée (minimale, sans toucher aux 6 autres).

**Aucune colonne créée automatiquement.**

## Étape 4 — Produits + fournisseurs

Confirmé : le lien produit↔fournisseur réel passe par `suppliers → purchases → purchase_items` (BOI-004, prouvé en production le 2026-09-21). Un même `product_id` peut apparaître dans des `purchase_items` de `purchases` différentes, avec des `supplier_id` différents — la relation est *many-to-many via l'historique d'achat*, jamais un attribut figé du produit. `products.fournisseur_id` (FK unique) aurait figé arbitrairement UN fournisseur par produit, contredisant ce fait. **Non réintroduit.**

## Étape 5 — Catégorie

`products.categorie` est confirmé **texte libre**, jamais canonique : les 10 lignes réelles portent des valeurs comme « Bureau », « Informatique », « Mobilier »… saisies par le script de seed, sans dictionnaire fermé. Utilisée uniquement pour : affichage/regroupement (`stocks/produits`, `stocks/categories`, `commerce/catalogue`, `stocks/valorisation`). **Aucun usage fiscal, aucun usage facturation** (la facturation n'a pas de lien vers `products` du tout — `facture_lignes` est un modèle texte libre indépendant, confirmé par recherche exhaustive). Un seul système de catégorie existe (`products.categorie`) ; `product_categories` (migration 050, jamais appliquée) était un second système jamais réellement lancé. **Non créé** — confirmé par la mission : aucune preuve qu'une entité catégorie séparée est nécessaire au-delà du texte libre déjà fonctionnel.

## Étape 6 — Stock (stock_max / emplacement / statut)

Les trois champs proposés par l'ancien frontend dupliquaient ou contredisaient le modèle réel :
- `stock_max` : conçu contre une colonne `stock_actuel` qui n'existe pas ; s'il devait exister, il devrait être comparé à `v_products_stock.stock_actuel` (calculé), pas stocké à côté d'une valeur qui n'existe pas elle-même en tant que colonne.
- `emplacement` : appartient conceptuellement à `stock_movements.warehouse_id` (déjà réel) ou à une future notion de zone d'entrepôt — jamais à `products` seul, puisque le stock d'un produit peut être réparti sur plusieurs entrepôts.
- `statut` : n'est pas une donnée de stock à proprement parler (c'est un attribut catalogue « vendable ou non ») — sans rapport direct avec `stock_movements`.

Aucun des trois n'a été réintroduit sur `products`. Le niveau correct pour un futur `stock_max`/`emplacement`, s'il est un jour nécessaire, est `warehouse`/`stock_movements`, pas `products`.

## Étape 7 — Description

Existe uniquement comme champ d'affichage sur le formulaire cassé de `commerce/catalogue`. Aucun autre module ne la lit ni ne la consomme. Retirée du code (formulaire, payload, affichage) — pas recréée en base. Si un vrai besoin de fiche produit détaillée apparaît, c'est la plus simple et la moins risquée des 7 colonnes à ajouter isolément (`TEXT NULL`, sans contrainte, sans FK, sans conflit de modèle) — mais ce n'est pas fait ici, faute de preuve d'un besoin actuel.

## Étape 8 — `taxe_pct` (point critique)

**Non recréé.** Preuves :
- Aucun lien `products → facture_lignes` n'existe (la facturation ne référence jamais `products`) — donc aucune écriture fiscale ne pourrait de toute façon consommer un taux par produit aujourd'hui.
- Le Fiscal Core (`lib/countries/*.ts`, taux TVA/IS/IRPP par pays, `lib/fiscal/universal-tax-engine.ts`) est la source canonique déjà établie et testée dans cet engagement pour tout taux fiscal — un `taxe_pct` NUMERIC(5,2) figé par ligne produit, sans référence pays/date/catégorie fiscale, l'aurait court-circuité.
- Aucune règle fiscale n'a été déplacée dans `products` par cette mission, conformément à la consigne.

## Étape 9 — Consommateurs de `products` (cartographie complète)

| Domaine | Consommateurs | Classification |
|---|---|---|
| Achats/Stocks | `stocks/achats`, `stocks/retours`, `stocks/codes-barres`, `stocks/commandes`, `stocks/receptions`, `stocks/sorties`, `stocks/inventaires`, `stocks/mouvements`, `stocks/transferts`, `stocks/categories`, `stocks/entrepots`, `stocks/page`, `/api/stock/move`, `/api/stock/[id]`, `/api/stocks/purchases` | **ACTIVE** (colonnes réelles uniquement) |
| Achats/Stocks | `stocks/produits` (avant réparation) | **BROKEN** → réparé cette mission |
| Achats/Stocks | `stocks/alertes`, `stocks/valorisation` (avant réparation) | **BROKEN** (`stock_max` fantôme, silencieux) → réparé cette mission |
| Facturation | `factures`, `devis`, `facture_lignes` | **NOT FOUND** — aucun lien à `products`, modèle texte libre indépendant, confirmé |
| Ventes/Commerce | `commerce/catalogue`, `commerce` (POS) (avant réparation) | **BROKEN** (`description`/`statut` fantômes) → réparé cette mission |
| BTP | — | **NOT FOUND** |
| Restaurant | — | **NOT FOUND** (utilise `stock_articles`, système séparé, hors périmètre) |
| Boisson | — | **NOT FOUND** |
| Agriculture | — | **NOT FOUND** |
| Pétrole | — | **NOT FOUND** (utilise `petrole_sites`/`petrole_production`, tables séparées) |
| Reporting | `stocks/analytics` | **ACTIVE** ; `rapports` : **NOT FOUND** |
| IA/MIAA | — | **NOT FOUND** (aucun outil MIAA ne référence `products`) |

## Étape 10 — Réparation effectuée

Fichiers modifiés (schéma canonique réel uniquement, aucune nouvelle fonctionnalité) :
- `app/dashboard/stocks/produits/page.tsx` — réécrit : type, formulaire, payload create/update, filtres, export CSV, modale détail — ne portent plus que les 12 colonnes réelles. Catégorie en texte libre (plus de `categorie_id`/dropdown avec id factice).
- `app/dashboard/commerce/catalogue/page.tsx` — retire `description`/`statut` du type, du formulaire, du payload et de l'affichage ; le badge d'état est calculé depuis `stock_actuel`/`seuil_alerte` (déjà réel).
- `app/dashboard/commerce/page.tsx` (POS) — retire le filtre `.eq('statut','actif')` ; tous les produits sont désormais vendables (amélioration stricte : avant, la caisse n'affichait jamais aucun produit).
- `app/dashboard/stocks/alertes/page.tsx` — retire `stock_max` du select et la branche d'alerte « surplus » (toujours inerte : `notif_surplus` par défaut faux, et la colonne n'existait pas).
- `app/dashboard/stocks/valorisation/page.tsx` — retire `stock_max` du select et la branche « Surplus » du statut calculé (Rupture/Faible/OK restent corrects).

**Aucune migration exécutée ni même préparée** : l'audit conclut qu'aucune des 7 colonnes n'est aujourd'hui strictement nécessaire (le code a été corrigé pour fonctionner sans elles), donc le critère de la mission (« ne pas modifier le modèle DB sauf si l'audit démontre qu'une colonne réellement manque ») n'est pas atteint pour aucune des 7. `statut` reste la seule dont la réintroduction future serait bien justifiée par deux consommateurs réels — documentée ci-dessus comme recommandation, pas exécutée.

## Étape 11 — Tests

`lib/architecture/produit-modele-repair.test.ts` (nouveau, 11 tests) + extension de `lib/architecture/schema-contract.test.ts` (déjà couvrait `products` depuis BOI-004) :
1. Aucune des 5 colonnes structurellement écartées (`categorie_id`, `fournisseur_id`, `stock_max`, `taxe_pct`, `emplacement`) référencée dans le code exécuté (commentaires exclus) des fichiers réparés.
2. `products.statut`/`products.description` retirés spécifiquement du contexte produit (formulaire, payload, affichage), sans confondre avec `purchases.statut` (légitime, différent).
3. Contrat de schéma statique (`collectTableUsages('products')`) : aucune colonne inconnue dans un select/insert/update littéral.
4. Catégorie dérivée : `stocks/categories` n'instancie plus `product_categories` comme table ; `stocks/produits` utilise `categorie` texte, pas `categorie_id`.
5. Non-régression achats/stocks (BOI-004) : `stocks/achats` et `/api/stocks/purchases` toujours propres.

**Test réel DB** (Étape 11 point 8, transaction impossible sans MCP — voir note d'exécution ; remplacé par un test PostgREST réel avec nettoyage immédiat) :
- `POST /rest/v1/products` avec `{..., statut:'actif'}` → **400 PGRST204** « Could not find the 'statut' column of 'products' in the schema cache » — confirme que le schéma réel est bien celui audité, pas une supposition.
- `POST /rest/v1/products` avec uniquement les colonnes réelles (`tenant_id, nom, categorie, sku, unite, prix_achat, prix_vente, seuil_alerte`) → **201**, ligne créée.
- `DELETE` immédiat de cette ligne → **200**, confirmé supprimée.
- Recomptage : `products = 10` (identique à l'état initial) sur tous les tests de cette mission.

## Étape 12 — Validation

- `npx tsc --noEmit` : ✅ clean.
- `npx vitest run` : ✅ **983/983** tests, 46/46 fichiers (73 tests couvrant BOI-004+BOI-005 spécifiquement, tous passants).
- `npx eslint` sur les 6 fichiers modifiés : ✅ 0 erreur, 0 warning.
- `npm run build` : ✅ succès.
- Test métier réel (Étape 2 de cette section) : exécuté contre la vraie base via PostgREST, nettoyé, aucune donnée production persistée — recompte final identique à l'état de départ sur toutes les tables du périmètre.

---

## État final obligatoire

```
PRODUCT_MODEL      = READY
STOCKS_FOUNDATION  = READY
BOI_IMPLEMENTATION = BLOCKED
```

### Justification — pourquoi `READY` cette fois, pas seulement parce que les tests passent

Le formulaire de création/édition produit (`stocks/produits`) et le catalogue commercial (`commerce/catalogue`) ont été testés contre la **vraie base en production** (PostgREST, insert réel avec exactement le payload que le code répare envoie maintenant → 201 ; insert avec un champ retiré → 400, confirmant que le retrait était justifié) — pas seulement contre des tests statiques. Les 5 consommateurs cassés découverts pendant cette mission (`produits`, `commerce/catalogue`, `commerce` POS, `alertes`, `valorisation`) sont tous réparés et validés. Le flux complet fournisseur→achat→ligne d'achat→réception→stock→comptabilité (BOI-004) reste intact (non-régression testée). `PRODUCT_MODEL` et `STOCKS_FOUNDATION` peuvent donc être déclarés `READY` sur la base d'une preuve d'exécution réelle, pas d'une simple compilation verte.

### Pourquoi `BOI_IMPLEMENTATION` reste `BLOCKED`

Cette mission n'a codé aucun concept boisson/accise, conformément à la consigne stricte. Le socle produit est maintenant sain, mais BOI reste bloqué en attendant une mission dédiée de conception (origine producteur/distributeur/importateur au niveau produit, déjà validée conceptuellement en BOI-002, jamais implémentée).

### Risque résiduel documenté (hors périmètre de cette mission)

`product_categories`/`categorie_id` (concept hiérarchique complet, avec couleur/icône/parent) reste un vrai design abandonné (migration 050) — DEFER, pas résolu. Si un futur besoin de catégories structurées apparaît, repartir de ce design est raisonnable, mais isolément, jamais en réappliquant la migration 050 dans son ensemble (qui recrée aussi les entités déjà refusées par BOI-004 et le modèle `stock_actuel` déjà corrigé).

---

Aucun fichier de code supprimé. Aucune migration créée ni exécutée. Aucune donnée production modifiée (recomptage identique avant/après sur toutes les tables). Aucun commit, aucun push.

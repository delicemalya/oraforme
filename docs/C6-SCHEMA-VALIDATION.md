# C6 — VALIDATION DU SCHÉMA RÉEL (ventes/sorties)

Mission de vérification en lecture seule. Aucune donnée modifiée, aucune migration, aucun code touché, aucun commit/push.

---

## 1. CHANNEL

MCP Supabase/Postgres : non retesté cette session (conformément à la discipline déjà établie de ne pas multiplier les tentatives — statut inchangé depuis les missions précédentes, `CONNECT_TIMEOUT`). Docker : non retesté, statut présumé inchangé (arrêté).

**Canal réellement utilisé et suffisant** : PostgREST, en lecture seule, via `GET /rest/v1/` avec `Accept: application/openapi+json` — endpoint d'introspection natif de PostgREST qui retourne la définition OpenAPI complète du schéma `public` tel qu'exposé (338 définitions de tables retournées, cohérence vérifiée par la présence de tables déjà connues comme réelles : `stock_movements`, `purchases`). Complété par des requêtes `GET .../rest/v1/<table>?select=...` ciblées pour confirmer l'existence/absence et compter les lignes (`Prefer: count=exact`).

**Conforme à la consigne "ne pas utiliser service_role pour prétendre prouver des policies RLS"** : la clé `service_role` a été utilisée uniquement pour lire le **schéma** (colonnes, types, présence/absence de table, comptage de lignes) — jamais pour émettre une affirmation sur le comportement des policies RLS. La section 6 (tenant isolation) le rappelle explicitement et distingue ce qui est prouvé de ce qui ne l'est pas.

Clé extraite dans une variable shell, jamais affichée.

```
CHANNEL = POSTGREST_OPENAPI (lecture seule, suffisant pour cette mission)
```

---

## 2. PRODUCTION_SCHEMA

### `ventes` — **EXISTE**

| Colonne | Type | Nullable | Default | Clé |
|---|---|---|---|---|
| `id` | uuid | NOT NULL (requis) | `extensions.uuid_generate_v4()` | PK |
| `tenant_id` | uuid | NOT NULL (requis) | — | FK → `tenants.id` |
| `numero` | text | **nullable** | — | — |
| `total` | numeric | NOT NULL (requis) | `0` | — |
| `mode_paiement` | text | NOT NULL (requis) | `'especes'` | — |
| `caissier_id` | uuid | **nullable** | — | — |
| `caissier_nom` | text | **nullable** | — | — |
| `nb_articles` | integer | NOT NULL (requis) | `0` | — |
| `statut` | text | NOT NULL (requis) | `'validee'` | — |
| `notes` | text | **nullable** | — | — |
| `created_at` | timestamptz | NOT NULL (requis) | `now()` | — |

**Aucune colonne `montant_ht`/`montant_tva`/`montant_ca`/`updated_at`.** Confirmé par introspection directe, pas par absence de preuve.

**Lignes en production : 0** (`Content-Range: */0`) — la table existe mais n'a jamais reçu de vente réelle.

### `vente_lignes` — **EXISTE**

| Colonne | Type | Nullable | Default | Clé |
|---|---|---|---|---|
| `id` | uuid | NOT NULL (requis) | `extensions.uuid_generate_v4()` | PK |
| `vente_id` | uuid | **nullable** (absent de la liste `required`) | — | FK → `ventes.id` |
| `produit_id` | uuid | **nullable** | — | — (pas de FK déclarée dans l'introspection, bien que ciblant `products.id` par convention de nommage) |
| `produit_nom` | text | NOT NULL (requis) | — | — |
| `qte` | numeric | NOT NULL (requis) | `1` | — |
| `prix` | numeric | NOT NULL (requis) | `0` | — |
| `sous_total` | numeric | NOT NULL (requis) | `0` | — |
| `created_at` | timestamptz | NOT NULL (requis) | `now()` | — |

**Pas de colonne `tenant_id` directe** — l'isolation tenant, si elle existe au niveau RLS, passerait par une jointure vers `ventes.tenant_id` via `vente_id` (non vérifiable par ce canal, voir section 6). **Aucune colonne `montant_ht`/`montant_tva`/`montant_ca` par ligne non plus.**

**Lignes en production : 0.**

### `sorties` — **N'EXISTE PAS**

Confirmé deux fois indépendamment : absente des 338 définitions OpenAPI, **et** confirmation directe par requête :
```
GET /rest/v1/sorties?select=*&limit=1
→ {"code":"PGRST205","message":"Could not find the table 'public.sorties' in the schema cache",
   "hint":"Perhaps you meant the table 'public.stock_articles'"}
```

### `sortie_lignes` — **N'EXISTE PAS**

Même confirmation double :
```
GET /rest/v1/sortie_lignes?select=*&limit=1
→ {"code":"PGRST205","message":"Could not find the table 'public.sortie_lignes' in the schema cache",
   "hint":"Perhaps you meant the table 'public.vente_lignes'"}
```

**Aucune colonne, aucune relation, aucun index à documenter — la table n'existe pas.**

---

## 3. CODE_EXPECTATIONS

| Objet | Code suppose | Production réelle | Compatible | Écart |
|---|---|---|---|---|
| `ventes` (insert, `commerce/page.tsx`) | `tenant_id, total, mode_paiement, nb_articles, statut` | Toutes présentes, types compatibles | **OUI** | Aucun |
| `ventes` (lecture pour affichage) | `id, created_at, total, mode_paiement, caissier_nom, nb_articles, statut` | Toutes présentes | **OUI** | Aucun |
| `vente_lignes` (insert) | `vente_id, produit_id, produit_nom, qte, prix, sous_total` | Toutes présentes, types compatibles ; `qte`/`sous_total` sont `numeric` en base (pas `integer`) — cohérent avec du code qui traite déjà `qte` comme `number` JS, aucun problème de troncature | **OUI** | Aucun |
| `sorties` (insert, `stocks/sorties/page.tsx`) | `numero, type_sortie, warehouse_id, destinataire, date_sortie, motif, notes` (déduit de l'état du formulaire lu en C6-design) | **Table absente** | **NON** | Total — tout insert échoue avant même d'atteindre les lignes suivantes |
| `sortie_lignes` (insert) | `sortie_id, product_id, quantite, prix_unitaire, total` | **Table absente** | **NON** | Total |
| `stock_movements` via `fn_stock_move` (appelé par les deux pages) | RPC, pas une table lue directement par le nom `sorties`/`ventes` | Fonction réellement présente (confirmée missions antérieures, migration 173) | **OUI** (indépendant du problème ci-dessus) | Aucun sur ce point précis |

**Conséquence directe, confirmée par ce sondage (pas supposée)** : `stocks/sorties/page.tsx` ne peut aujourd'hui **persister aucune donnée** — le premier `INSERT INTO sorties` échoue avec `PGRST205` avant que le code n'atteigne l'insert des lignes, l'appel à `fn_stock_move`, ou `writeComptaEntry()`. Ce n'est donc pas seulement "une comptabilité incomplète" comme formulé dans C6-VENTE-CANONICAL-DESIGN — **c'est une fonctionnalité entièrement non opérationnelle en production aujourd'hui**, toutes dimensions confondues (stock, fiscal, trésorerie, comptabilité), parce que sa table racine n'existe pas.

**Colonnes réelles jamais utilisées** : `ventes.numero`, `ventes.caissier_id`, `ventes.notes` — présentes en base, jamais écrites par le code de création de vente lu (`commerce/page.tsx`). Pas un problème, juste une observation (colonnes prévues pour un usage futur ou un autre point d'entrée non trouvé dans cette mission).

**Relations supposées mais inexistantes** : la FK `vente_lignes.produit_id → products.id` n'est **pas déclarée** dans l'introspection PostgREST (pas de `<fk .../>` sur cette colonne, contrairement à `tenant_id`/`vente_id` qui en ont une) — la relation existe par convention de nommage et par l'usage du code, mais n'est pas contrainte au niveau base. **`NOT_DETERMINED`** si une contrainte FK existe réellement en base mais n'est simplement pas exposée par l'introspection PostgREST (possible pour certains types de contraintes) — à vérifier via un canal SQL direct si cette information devient nécessaire avant codage.

---

## 4. POS_FLOW

Tracé confirmé, tables réelles :

```
app/dashboard/commerce/page.tsx (seul point d'entrée trouvé — pas de route API dédiée)
  1. INSERT ventes { tenant_id, total, mode_paiement, nb_articles, statut:'validee' }
     → table réelle, colonnes compatibles, succès attendu
  2. INSERT vente_lignes { vente_id, produit_id, produit_nom, qte, prix, sous_total } (par ligne)
     → table réelle, colonnes compatibles, succès attendu
  3. RPC fn_stock_move (par ligne, type='sortie') — appel direct, hors /api/stock/move
     → fonction réelle (migration 173), succès attendu si stock suffisant
  4. Accounting : AUCUN appel — confirmé absence totale (C6-design §1)
  5. Paiement : AUCUNE table de trésorerie touchée — mode_paiement est stocké
     comme simple métadonnée sur `ventes`, pas utilisé pour créer une écriture
```

**Le POS fonctionne donc techniquement de bout en bout pour les étapes 1-3** (schéma compatible) — le point de rupture n'est pas un problème de table manquante comme pour les sorties, mais l'absence totale d'émission comptable/fiscale/trésorerie (étapes 4-5), déjà documentée dans C6-VENTE-CANONICAL-DESIGN.

---

## 5. STOCK_OUTPUT_FLOW

```
app/dashboard/stocks/sorties/page.tsx
  1. INSERT sorties {...}
     → ÉCHEC IMMÉDIAT : PGRST205, table 'public.sorties' introuvable
  2. INSERT sortie_lignes {...}        → jamais atteint
  3. RPC fn_stock_move (par ligne)      → jamais atteint
  4. writeComptaEntry() si type_sortie='vente'  → jamais atteint
```

**Ce qui est réellement persisté aujourd'hui pour une "sortie" via cette page : rien.** L'utilisateur recevrait une erreur serveur/client au moment de la validation (`catch (e) { setCreateError(e.message...) }`, visible dans le code lu en C6-design ligne 256) — pas un succès silencieux, mais un échec complet et immédiat.

**Portée du constat** : ceci invalide la partie "comptabilité partielle via `writeComptaEntry`" de la cartographie du flux actuel dans C6-VENTE-CANONICAL-DESIGN §1 — cette écriture n'est **jamais atteinte en l'état actuel du schéma production**, bien que le code qui l'appellerait existe et soit syntaxiquement correct. Le design reste valide comme **cible architecturale** (quelle devrait être la logique si les tables existaient), mais la mission C6 précédente décrivait un comportement observé dans le code source, pas un comportement réellement exécutable — distinction importante à corriger dans la compréhension globale, pas dans le design lui-même (qui n'avait pas pour mandat de vérifier le schéma, exactement ce que cette mission-ci corrige).

---

## 6. TENANT_ISOLATION

**Ce qui est prouvé** (schéma uniquement, pas comportement RLS) :
- `ventes.tenant_id` existe, colonne NOT NULL, FK déclarée vers `tenants.id`.
- `vente_lignes` **n'a pas de colonne `tenant_id` propre** — l'isolation pour cette table, si elle existe, dépendrait d'une policy RLS qui rejoint `ventes` via `vente_id` (pattern courant ailleurs dans ce dépôt, mais **non vérifié ici**).
- `sorties`/`sortie_lignes` : question sans objet, les tables n'existent pas.

**Comment `tenant_id` est renseigné (ventes)** : confirmé par lecture de code (pas par ce canal) — `commerce/page.tsx` le fournit depuis `tenantId` résolu côté client (`useTenant()` hook, lui-même dérivé de la session). **Le client fournit la valeur dans le payload d'insertion** — ce n'est un risque de sécurité QUE si RLS ne contraint pas `tenant_id` à correspondre à la session de l'utilisateur au moment de l'insert (`WITH CHECK`), ce qui n'est **pas vérifiable par ce canal** (`service_role` contourne toute RLS par construction — rappel explicite de la consigne de cette mission).

```
RLS_WRITE_CHECK_VENTES    = NOT_DETERMINED (nécessite un canal SQL direct ou une session non-service_role)
RLS_READ_FILTER_VENTES    = NOT_DETERMINED (idem)
TENANT_ID_COLUMN_EXISTS   = ventes: OUI · vente_lignes: NON (indirect via vente_id) · sorties/sortie_lignes: N/A
```

Aucune tentative d'écrire, modifier ou lire au-delà de ce qui est strictement nécessaire pour cette conclusion — aucune ligne n'a été insérée, modifiée ou supprimée.

---

## 7. DISCREPANCIES

Résumé consolidé (section 3 détaillée ci-dessus) :

1. **`sorties`/`sortie_lignes` n'existent pas** — écart total, pas une divergence de colonnes. Impact : `stocks/sorties/page.tsx` est non fonctionnel en production pour toute opération.
2. **`ventes`/`vente_lignes` n'ont aucune colonne fiscale** (`montant_ht`/`montant_tva`/`montant_ca`) — confirmé, pas supposé. Toute implémentation de `VTE-001` (C6-design §5) nécessitera une migration additive avant de pouvoir calculer/persister ces montants par vente ou par ligne.
3. **`vente_lignes.vente_id` et `.produit_id` sont nullables** en base alors que le code les fournit toujours — pas un problème actuel, mais une absence de contrainte `NOT NULL` qui laisserait passer une ligne orpheline ou sans produit si un futur appelant oubliait de les fournir.
4. **FK `vente_lignes.produit_id → products.id` non déclarée** dans l'introspection — relation implicite seulement.
5. **`vente_lignes` n'a pas de `tenant_id` propre** — l'isolation dépend d'une jointure RLS non vérifiée par ce canal.

---

## 8. REQUIRED_CHANGES

Non exécutés ici (hors mandat) — à prévoir avant le codage de C6 :

1. **Pour le POS** : migration additive sur `ventes` (`montant_ht`, `montant_tva`, `montant_ca` — par vente, et/ou sur `vente_lignes` si le calcul doit être fait ligne à ligne pour gérer des taux/exonérations différents par produit, cf. C6-design §5-6).
2. **Pour les sorties** : soit créer les tables `sorties`/`sortie_lignes` (si l'intention produit est de les garder distinctes de `ventes`), soit faire converger `stocks/sorties` pour écrire directement dans `ventes`/`vente_lignes` quand `type_sortie='vente'` — **décision produit à trancher avant codage, pas une décision technique que cette mission peut prendre**.
3. Contraintes `NOT NULL` sur `vente_lignes.vente_id`/`produit_id` à envisager (durcissement, pas obligatoire pour fonctionner).
4. Vérification RLS réelle (écriture et lecture) dès qu'un canal non-`service_role` est disponible — avant tout déploiement de `VTE-001`.

---

## VERDICT

```
C6_SCHEMA = PARTIAL
```

**PARTIAL, pas READY** : le schéma de `ventes`/`vente_lignes` est maintenant connu avec certitude (colonnes, types, nullabilité, défauts — tout confirmé par introspection directe) et suffisant pour chiffrer la migration additive nécessaire au POS. Mais **`sorties`/`sortie_lignes` n'existent pas du tout** — ce n'est pas une information manquante, c'est une information nouvelle et définitive qui change la portée de l'implémentation future (il faut une décision produit sur l'architecture des sorties avant de pouvoir écrire la moindre ligne de code pour cette branche, pas simplement combler un trou de schéma).

**PARTIAL, pas BLOCKED** : le canal PostgREST a suffi à obtenir une réponse ferme et complète pour les deux paires de tables — rien n'est resté dans l'incertitude par manque d'accès. Le seul point réellement `NOT_DETERMINED` (RLS write/read sur `ventes`) nécessite un canal différent (SQL direct ou session non-`service_role`), mais ne bloque pas la connaissance du schéma elle-même.

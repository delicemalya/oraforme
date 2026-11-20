# C6 — CONCEPTION TECHNIQUE COMPLÈTE DE LA VENTE CANONIQUE

Mission de conception, lecture seule. Aucun code métier, aucune migration exécutée, aucune modification DB, aucun commit/push. S'appuie sur `C6-SCHEMA-VALIDATION.md`, `C6-ARCHITECTURE-ARBITRATION.md`, `C6-PRODUCT-DECISIONS.md` (D1-A, D2-A, D3-B actés) sans les redémontrer.

Deux vérifications nouvelles, déterminantes pour ce design, faites par introspection directe aujourd'hui :
- `accounting_event_rules.montant_field`/`debit_account`/`credit_account` supportent la syntaxe `'metadata.CHAMP'` (capacité P-05/P-06 de migration 138, **déjà existante, pas une invention**) — permet à UNE séquence de lire un montant ou un compte calculé par l'appelant plutôt qu'un des 4 champs fixes de l'événement.
- `purchase_items` = `{id, purchase_id, product_id, quantite, prix}` — le seul endroit où un coût d'achat précis par lot existe réellement.

---

## 1. ARCHITECTURE CIBLE

```
POS (comptoir)        ──┐
                         ├──→ POST /api/sales (nouveau point d'entrée serveur unique)
stocks/sorties(vente) ──┘           │
                                     ├─ requireTenant()
                                     ├─ validation produits/stock/provenance
                                     ├─ INSERT ventes + vente_lignes
                                     ├─ fn_stock_move (par ligne)
                                     ├─ emit_accounting_event('VTE-001', ...)
                                     │     séq1-3 : revenu/TVA/CA (701/4441/447)
                                     │     séq4   : coût (601/311, via metadata)
                                     └─ si crédit : rien d'autre à cet instant —
                                        le règlement est un second appel, plus tard
POST /api/sales/:id/paiement ──→ emit_accounting_event('FAC-002'-like, source='ventes')
POST /api/sales/:id/reverse  ──→ fn_reverse_accounting_event (×1 ou ×2, voir §10)
```

Un seul point d'entrée serveur sert les deux UI (POS, sorties/vente) — c'est la convergence actée en D2.

---

## 2. SCHÉMA CIBLE

Conceptuel, aucune colonne créée ici. Chaque colonne proposée a un consommateur identifié — aucune ajoutée "par commodité".

### `ventes` — colonnes à ajouter

| Colonne | Type | Nullable | Default | Consommateur |
|---|---|---|---|---|
| `montant_ht` | numeric | NOT NULL | `0` | VTE-001 séq1, `commerce/analytics` (CA réel), déclaration TVA future |
| `montant_tva` | numeric | NOT NULL | `0` | VTE-001 séq2, condition `montant_tva > 0` (exonération, D1) |
| `montant_ca` | numeric | NOT NULL | `0` | VTE-001 séq3, condition `montant_ca > 0` |
| `statut_paiement` | text | NOT NULL | `'paye'` (comptant par défaut) | Distingue comptant (`'paye'`) de crédit (`'du'`/`'solde'`) — consommé par la future UI de recouvrement (D3) et par le second appel de règlement |
| `destinataire` | text, **nullable** | — | D2 : la branche sortie/vente le renseigne ; le POS comptoir le laisse `NULL` (pas de régression du flux existant) |

**Non ajoutées, déjà présentes et suffisantes** : `total` (= montant_ttc, déjà réel, inchangé), `mode_paiement` (déjà réel, porte déjà `'credit'`), `statut`, `tenant_id`, `created_at`.

**Non ajoutées, pas de consommateur identifié** : `montant_ttc` dédié — `total` le porte déjà ; pas de colonne `updated_at` (aucune route ne modifie une vente après création dans ce design — un paiement de crédit est un second événement comptable, pas une UPDATE de `ventes`, voir §3).

### `vente_lignes` — aucune colonne ajoutée (D1)

Confirmé par D1-A : la fiscalité reste au niveau `ventes`. `vente_lignes` garde exactement son schéma actuel (`vente_id, produit_id, produit_nom, qte, prix, sous_total`).

### Contraintes / FK / index

- **Aucune contrainte existante à modifier.** `vente_lignes.vente_id`/`produit_id` restent nullables au niveau DB (aucune preuve que les durcir soit nécessaire — le code applicatif les fournit déjà toujours).
- Index conseillé (additif, non bloquant) : `(tenant_id, created_at)` sur `ventes` si le volume de reporting le justifie — **non déterminé comme nécessaire aujourd'hui** (0 ligne en production), à réévaluer après un usage réel.
- Tenant isolation : `ventes.tenant_id` (déjà réel, FK). `vente_lignes` reste isolée par jointure vers `ventes` (déjà le cas, non changé).

### Référence / audit

Aucune colonne `reference` dédiée ajoutée à `ventes` — `ventes.id` (UUID) sert déjà de référence unique pour l'idempotence (§10) et pour `stock_movements.reference` (déjà le mécanisme utilisé par `/api/stocks/purchases`, réutilisé à l'identique).

---

## 3. FLUX COMPTANT

```
POST /api/sales { lignes: [{produit_id, qte, prix, origine?}], mode_paiement: 'especes'|'mobile'|'carte' }
  → requireTenant() → ctx.tid
  → pour chaque ligne : vérifier stock disponible (via v_products_stock / v_products_stock_par_origine)
  → calcul HT/TVA/CA (Fiscal Core, §7) sur le total du panier (D1-A)
  → INSERT ventes (tenant_id, total, montant_ht, montant_tva, montant_ca, mode_paiement,
                    statut_paiement:'paye', nb_articles, statut:'validee')
  → INSERT vente_lignes (par ligne)
  → fn_stock_move (par ligne, type='sortie', origine transmise)
  → emit_accounting_event('VTE-001', metadata.debit_account = fn_ohada_cash_account(mode_paiement) [la MÊME résolution que treasury_debit, calculée côté serveur], metadata.cout_marchandises = Σ(qte×prix_achat))
  → retour : vente créée, ticket
```

`521` n'est jamais codé en dur dans la route — la résolution du sous-compte caisse/banque exact se fait via la même fonction que celle déjà appelée par `account_resolver='treasury_debit'` (`fn_ohada_cash_account`, confirmée dans les commentaires de migration 138), simplement invoquée côté application pour la placer en `metadata.debit_account` (nécessaire pour que la MÊME règle serve aussi le cas crédit, §4).

---

## 4. FLUX CRÉDIT

```
POST /api/sales { ..., mode_paiement: 'credit' }
  → identique jusqu'à la validation stock/fiscal
  → INSERT ventes (..., mode_paiement:'credit', statut_paiement:'du')
  → fn_stock_move (par ligne) — IDENTIQUE au comptant : le stock sort dès la vente,
    qu'elle soit payée ou non (précédent FAC-001 : la facture décrémenterait le
    stock à l'émission si elle le faisait, pas au règlement — ici confirmé par
    analogie, le bien quitte physiquement le magasin à la vente, pas au paiement)
  → emit_accounting_event('VTE-001', metadata.debit_account = '411', metadata.cout_marchandises = ...)
    → séq1-3 utilisent 411 au lieu du sous-compte caisse (même règle, §4 du design VTE-001)
    → séq4 (coût) inchangée : 601/311, le coût sort toujours au moment de la vente

--- plus tard, règlement ---

POST /api/sales/:id/paiement { montant, mode_paiement_reel }
  → requireTenant() → vérifie que la vente appartient au tenant ET que statut_paiement='du'
  → emit_accounting_event('VTE-002-PAIEMENT' [nom à confirmer au codage, structure FAC-002],
     source_table='ventes', source_id=:id, montant_ttc=montant,
     metadata.credit_account_cible='411', account_resolver='treasury_debit')
    → séquence unique : {521 résolu}/411, montant_ttc
  → UPDATE ventes SET statut_paiement='solde' (seule UPDATE de ce design — hors moteur
    comptable, purement un indicateur d'état pour l'UI de recouvrement)
```

**Mécanisme de paiement réutilisé, pas recréé** : structure strictement identique à FAC-002 (`521(resolver)/411, montant_ttc`), seul `source_table` change (`ventes` au lieu de `factures`). Aucun nouveau concept de créance/paiement — `411` reste le compte Clients déjà utilisé partout ailleurs, pas une invention.

**Client/créance/solde, comment ils sont déjà représentés** : il n'existe **aucune table `clients` dédiée aux ventes POS** (contrairement à `factures.client_id`/`client_nom`) — le "client" d'une vente à crédit est porté par `ventes.destinataire` (texte libre, D2) tant qu'aucune décision produit ne crée une relation plus structurée. Le solde est dérivé (`statut_paiement`), pas une colonne de montant restant — pour un règlement partiel futur, une colonne `montant_restant` serait nécessaire mais n'a **aucun consommateur prouvé aujourd'hui** (D3 ne spécifie pas de règlement partiel) — non ajoutée.

---

## 5. FLUX STOCK

Réutilisation stricte de `fn_stock_move` (migration 173, inchangée) via `/api/stock/move` **ou directement dans le même handler serveur de `/api/sales`** (décision de codage : soit `/api/sales` appelle `fn_stock_move` directement dans sa propre transaction, soit il appelle `/api/stock/move` en interne — la première option est préférable pour l'atomicité, voir §9). `v_products_stock` n'est pas modifiée ; `v_products_stock_par_origine` reste la source de disponibilité par provenance.

**Coût (601/311) — vérification explicite demandée par la mission** : `products.prix_achat` existe et est **déjà** la source utilisée pour un calcul de coût similaire (`app/api/stock/move/route.ts`, émission STK-002 : `montantHT = prod.prix_achat × quantite`, confirmé par lecture directe du fichier en mission d'exécution C1-C4). **Pas de PMP, pas de valorisation FIFO — aucun des deux n'existe dans ce dépôt** (confirmé dès BOI-009 : le choix de consommation par provenance exclut explicitement le CMP/PMP comme "structurellement incompatible"). Le coût de VTE-001 doit donc utiliser **exactement la même source que STK-002** : `products.prix_achat` au moment de la vente, multiplié par la quantité vendue — **pas une invention, une réutilisation directe du seul précédent existant.**

**Amélioration possible mais non requise** : quand une ligne a `purchase_item_id` connu (provenance = achat précis), `purchase_items.prix` donnerait un coût plus exact que `products.prix_achat` (qui est une valeur de référence unique, pas horodatée par lot). **Non retenue pour V1** : aucun précédent du dépôt ne fait cette résolution ligne-par-lot aujourd'hui (STK-002 lui-même ne le fait pas) — l'introduire ici créerait une incohérence entre deux mécanismes de coût. À documenter comme amélioration future, pas un blocage ni une invention nécessaire pour V1.

---

## 6. PROVENANCE

Modèle BOI-010 respecté intégralement, aucun changement :

- **Frontend** : pour chaque ligne du panier, si `v_products_stock_par_origine` montre plus d'une origine disponible pour ce produit, un sélecteur apparaît (déjà le comportement exact de `commerce/page.tsx` aujourd'hui) ; sinon, pré-sélection automatique si une seule origine existe ; aucune origine affichée si 0 mouvement tagué (comportement historique préservé).
- **API reçue** : `{ produit_id, qte, prix, origine: 'achat_fournisseur'|'production_locale'|'import_direct'|null }` par ligne — **jamais déduite côté serveur si absente** (choix manuel, BOI-009 — aucun fallback automatique, conforme à l'instruction explicite de cette mission).
- **Validation que l'origine appartient au stock disponible** : déléguée entièrement à `fn_stock_move` elle-même — la fonction (migration 184) vérifie déjà, sous verrou, que la somme signée des mouvements pour `(product_id, origine)` reste ≥ 0 après le mouvement. **Aucune revalidation applicative séparée à écrire** — ce serait dupliquer une garantie déjà posée au niveau transactionnel le plus fiable (la base, sous verrou).
- **81 demandés sur 80 disponibles** : `fn_stock_move` refuse (exception `check_violation`), la transaction serveur (§9) doit intercepter cette erreur et annuler l'ensemble de la vente — aucune vente partielle.
- **Plusieurs lignes, origines différentes** : chaque ligne appelle `fn_stock_move` indépendamment avec sa propre `origine` — déjà le modèle, aucun changement.
- **Transfert de la provenance au mouvement** : `p_origine`/`p_purchase_item_id` passés tels quels à `fn_stock_move`, stockés sur la ligne `stock_movements` résultante — mécanisme déjà existant intégralement.

**Dépendance critique à noter explicitement** : tout ce paragraphe suppose **la migration 184 appliquée** (`stock_movements.origine`/`purchase_item_id`, `fn_stock_move` à 10 paramètres, `v_products_stock_par_origine`) — **confirmée NOT_APPLIED en production à ce jour** (BOI-010D). VTE-001 ne peut pas fonctionner avec choix de provenance tant que 184 n'est pas appliquée. Voir §17.

---

## 7. FISCALITÉ

Aucun taux codé en dur. Le calcul HT→TVA→CA→TTC d'une vente doit appeler **exactement** les mêmes fonctions que BOI-001/RES-001/SAN-001/HOT-001 — `lib/fiscal/universal-tax-engine.ts` (ou l'équivalent déjà câblé côté serveur pour ces événements, à identifier précisément au codage : ces événements reçoivent `montant_ht`/`montant_tva` déjà calculés par leur route appelante, donc la route `/api/sales` doit faire le même calcul que ces routes font déjà, en réutilisant la même fonction centrale — pas une nouvelle implémentation).

**Cas TVA = 0** : mécanisme déjà prouvé et réutilisable (C6-design §6, C6-ARBITRATION §3) — la condition `montant_tva > 0` sur la séquence 2 (et `montant_ca > 0` sur la séquence 3) de `accounting_event_rules` fait qu'aucune ligne 4441/447 n'est produite si l'appelant transmet `montant_tva=0`/`montant_ca=0`. **Déterminer QUELS produits/paniers sont exonérés reste `NOT_DETERMINED`** (hérité de C6-design §6 — aucune colonne produit-level fiable n'existe) : par défaut, toute vente POS est pleinement taxable jusqu'à preuve légale contraire, exactement comme déjà décidé.

**Persistance dans `ventes`** : `montant_ht`/`montant_tva`/`montant_ca` (D1-A) — calculés une fois par la route, écrits dans `ventes`, puis transmis tels quels à `emit_accounting_event` (pas recalculés une seconde fois par le moteur).

---

## 8. VTE-001

### Identité et mécanique

| Champ | Valeur |
|---|---|
| `event_type` | `VTE-001` |
| `source_table` | `ventes` |
| `source_id` | `ventes.id` |
| `idempotence_key` | `(tenant_id, 'VTE-001', 'ventes', source_id)` — mécanisme générique déjà existant (`uidx_ae_processed`/`uidx_ae_inflight`), **aucune clé à inventer** |
| `metadata` | `{ mode_paiement, debit_account (résolu par la route, '521:<sous-compte>' ou '411'), cout_marchandises (Σ qte×prix_achat), lignes: [...], origine_par_ligne: [...], destinataire? }` |

### Séquences (une seule règle `accounting_event_rules`, pas deux événements — voir justification ci-dessous)

| Séq | Débit | Crédit | `montant_field` | `account_resolver`/valeur | Condition |
|---|---|---|---|---|---|
| 1 | `metadata.debit_account` | **701** | `montant_ht` | `metadata_debit` | — |
| 2 | `metadata.debit_account` | **4441** | `montant_tva` | `metadata_debit` | `montant_tva > 0` |
| 3 | `metadata.debit_account` | **447** | `montant_ca` | `metadata_debit` | `montant_ca > 0` |
| 4 | **601** | **311** | `metadata.cout_marchandises` | — (comptes statiques) | `metadata.cout_marchandises > 0` |

**Pourquoi UN événement à 4 séquences, pas deux (revenu+fiscal / coût) — tranché, pas supposé** : techniquement, les deux approches sont possibles — `montant_field`/`debit_account` supportent déjà la syntaxe `'metadata.CHAMP'` (capacité P-05/P-06 de migration 138, vérifiée aujourd'hui, pas une invention), donc une séquence "coût" dans le même événement est réalisable sans aucune extension du moteur. Une vente et sa sortie de stock associée sont **un seul fait commercial** (on ne vend jamais sans que le bien parte), contrairement à STK-002 qui représente une sortie **sans** vente — la distinction que la mission demande de préserver ("STK-002 ne doit pas être utilisé comme événement de vente") porte sur l'**identité** de l'événement (ne pas émettre `STK-002` pour une vente), pas sur le nombre d'`accounting_events` par vente. Regrouper revenu et coût sous `VTE-001` (identité distincte de `STK-002`, séquences distinctes 601/311 propres à `VTE-001`) respecte la consigne tout en évitant la complexité de coordonner l'idempotence et le reverse de deux événements séparés pour un seul fait commercial.

**Pourquoi 701 et pas 706** : déjà justifié en C6-design §5 (précédent BOI-001, vente de marchandise physique, pas de service).

**`metadata.debit_account` au lieu de `account_resolver='treasury_debit'` directement** : `treasury_debit` résout uniquement vers un sous-compte de trésorerie (5xx) — il ne sait pas produire `411`. La route calcule donc elle-même, avant l'émission : si comptant → appelle la même fonction de résolution trésorerie que `treasury_debit` invoquerait (`fn_ohada_cash_account(mode_paiement)`), place le résultat en `metadata.debit_account` ; si crédit → place `'411'`. Une seule règle sert les deux cas, via le resolver déjà existant `metadata_debit` — **aucun nouveau resolver, aucune nouvelle valeur ajoutée à la contrainte `chk_aer_resolver`.**

### Comparaison avec les 3 précédents cités par la mission

| | BOI-001 | FAC-001/002 | STK-002 | **VTE-001** |
|---|---|---|---|---|
| Nb de séquences | 2 (puis 3 avec CA, migration 182) | 3 (FAC-001) + 1 (FAC-002) | 1 | **4** |
| Débit résolu dynamiquement | Oui (`treasury_debit`) | Non (411 statique, puis `treasury_debit` sur FAC-002) | Non (601 statique) | **Oui (`metadata_debit`, nouveau cas d'usage du resolver existant, pas un nouveau resolver)** |
| Coût traité | Non | Non | Oui, seul rôle | **Oui, en plus du revenu, séquence propre** |

---

## 9. TRANSACTION ATOMIQUE

```
BEGIN (transaction serveur unique, pas côté client)
  1. requireTenant() → ctx.tid                              [déjà hors transaction DB, avant BEGIN]
  2. Validation produits (appartiennent au tenant)
  3. Validation stock/provenance disponible (lecture, avant verrou — optimiste)
  4. Calcul fiscal central (HT/TVA/CA, Fiscal Core)
  5. INSERT ventes
  6. INSERT vente_lignes
  7. Pour chaque ligne : fn_stock_move (verrou par produit, sous transaction —
     c'est ici que l'échec réel se produit si le stock est insuffisant, pas à l'étape 3)
  8. emit_accounting_event('VTE-001', ...)
  9. (si crédit) rien de plus ici — le paiement est un second appel, hors de cette transaction
COMMIT

Si échec à n'importe quelle étape 5-8 : ROLLBACK complet — aucune vente, aucune ligne,
aucun mouvement de stock, aucun événement comptable ne doit survivre partiellement.
```

**Ordre justifié, pas arbitraire** : la validation "optimiste" (étape 3) existe pour donner un retour rapide à l'utilisateur (éviter de construire toute la transaction pour un stock visiblement insuffisant), mais la **vraie** garantie anti-négatif reste le verrou de `fn_stock_move` à l'étape 7 — une vente ne peut jamais committer avec un stock négatif, même en cas de double requête concurrente, parce que c'est `fn_stock_move` elle-même qui verrouille, pas la route. `emit_accounting_event` est en dernier parce qu'il ne doit jamais s'exécuter pour une vente dont le stock a échoué.

**Ce qui est déjà transactionnel aujourd'hui** : `fn_stock_move` elle-même (verrou PL/pgSQL, confirmé BOI-010/BOI-010D). `emit_accounting_event`/`fn_ae_execute_event` (confirmé par la conception du moteur, migration 138 — traite un événement de façon atomique).

**Ce qui n'est PAS transactionnel aujourd'hui, à corriger par ce design** : le flux actuel du POS (`commerce/page.tsx`) fait les étapes 5, 6, 7 en **3 appels PostgREST séparés, non enveloppés dans une transaction côté client** (PostgREST ne supporte pas les transactions multi-requêtes, confirmé dès BOI-010B) — c'est précisément pourquoi ce design déplace ces étapes vers **un seul endpoint serveur** (`POST /api/sales`), qui peut les envelopper dans une véritable transaction Postgres côté serveur (`BEGIN`/`COMMIT` réels, pas une suite de requêtes HTTP indépendantes).

---

## 10. IDEMPOTENCE

| Risque | Clé/mécanisme | Déjà existant ? |
|---|---|---|
| Double vente (double clic, retry HTTP) | Le CLIENT doit envoyer une clé d'idempotence applicative (ex. un UUID généré côté client au premier clic, transmis dans le body) ; **`ventes` n'a pas de colonne pour la recevoir aujourd'hui** — à ajouter en §2 si retenue, sinon le serveur ne peut distinguer un vrai double clic d'une seconde vente légitime avec les mêmes lignes. **Alternative sans nouvelle colonne** : le client ne rappelle jamais deux fois — accepté comme limite connue si aucune clé n'est ajoutée. **Décision de codage, pas tranchée ici.** |
| Double mouvement de stock | `fn_stock_move` elle-même n'a pas de clé d'idempotence par appel (chaque appel crée une ligne) — l'appelant (le serveur, dans la transaction unique §9) ne doit appeler `fn_stock_move` qu'une fois par ligne, garanti par construction si l'étape 7 n'est jamais répétée dans la même requête |
| Double comptabilité | **Entièrement couvert par le mécanisme générique existant** : `uidx_ae_processed` sur `(tenant_id, event_type, source_table, source_id)` — rejouer `emit_accounting_event('VTE-001', source_id=<même ventes.id>)` ne peut structurellement pas produire une deuxième écriture |
| Double paiement (crédit) | Même mécanisme générique, sur l'event_type de règlement, `source_id=ventes.id` — si le règlement a son propre event_type distinct de `VTE-001`, la clé `(tenant_id, '<event_type_paiement>', 'ventes', source_id)` empêche un second règlement d'être traité comme un nouvel événement — **mais n'empêche pas un appelant de transmettre un montant différent sur un retry avant que le premier n'ait abouti** ; à gérer par la même clé d'idempotence applicative que pour la vente elle-même si nécessaire |

**Conclusion** : le risque **comptabilité/stock en double est déjà couvert par les mécanismes existants**, à condition que la transaction serveur (§9) ne soit exécutée qu'une fois par requête HTTP reçue. Le risque de **requête HTTP dupliquée elle-même** (vrai double clic réseau, avant même d'atteindre le serveur) reste **`NOT_DETERMINED`** sans décision de codage sur une clé d'idempotence applicative côté `ventes` — signalé explicitement, pas résolu silencieusement.

---

## 11. REVERSE

**Un seul mécanisme, pas une deuxième logique** : `fn_reverse_accounting_event(event_id, reason, created_by)`, déjà générique (migration 138).

| Cas | Procédure |
|---|---|
| Vente comptant | `fn_reverse_accounting_event(<id de l'événement VTE-001>)` — inverse les 4 séquences (701/4441/447/601-311 toutes inversées, puisqu'elles appartiennent au même événement, §8) |
| Vente crédit, non encore payée | Identique — inverse `VTE-001` (411 et le reste), rien côté 521 puisqu'aucun règlement n'a encore eu lieu |
| Vente crédit, déjà payée | **Deux extournes nécessaires** : `fn_reverse_accounting_event` sur l'événement de règlement (annule 521/411) **puis** sur `VTE-001` (annule 411/701/4441/447/601-311) — ordre important, le règlement doit être extourné avant la vente elle-même pour que le solde 411 reste cohérent à chaque étape intermédiaire |
| Stock | `fn_stock_move` avec `p_type='retour'` (type déjà autorisé par la contrainte active de `/api/stock/move`, confirmé C6-design §11) — **pas automatique**, un appel explicite distinct de l'extourne comptable |
| Trésorerie | `NOT_DETERMINED` précisément sur `fn_sync_tresorerie_soldes` après extourne — hérité de C6-design §11, toujours non vérifié, à faire avant tout déploiement réel |

**Un seul événement (`VTE-001`) à 4 séquences simplifie le reverse** par rapport à l'alternative à deux événements envisagée en §8 — un seul `event_id` à extourner pour annuler revenu ET coût d'une vente comptant, au lieu de deux appels coordonnés.

---

## 12. TENANT / SECURITY

Toutes les routes (`POST /api/sales`, `GET /api/sales[/:id]`, `POST /api/sales/:id/paiement`, `POST /api/sales/:id/reverse`) utilisent **exclusivement `requireTenant()`** (`lib/api/require-tenant.ts`), jamais `tenant-guard.ts` — cohérent avec la discipline déjà appliquée en C1/C2/C4.

| Identifiant | Origine autorisée | Vérification |
|---|---|---|
| `tenant_id` | **Jamais du client** — `ctx.tid` de `requireTenant()` exclusivement | Toute requête DB (`ventes`, `vente_lignes`, `products`, `warehouses`) filtrée par `tenant_id = ctx.tid` |
| `warehouse_id` | Client (choix légitime, comme aujourd'hui) | Vérifier `warehouses.tenant_id = ctx.tid` avant tout usage (pattern déjà établi : `assertResourceOwnership`) |
| `product_id` | Client (choix du panier) | Vérifier `products.tenant_id = ctx.tid` par ligne avant tout calcul/mouvement |
| `destinataire`/client | Client (texte libre, D2) | Aucune relation FK à vérifier (pas de table clients dédiée) — pas un vecteur d'accès cross-tenant puisque c'est une donnée descriptive, pas une clé d'accès |

**Le client ne peut jamais envoyer un `tenant_id` arbitraire** : aucun des endpoints proposés n'accepte `tenant_id` dans le body/query — exactement la discipline déjà appliquée aux 9 routes corrigées en C1 et aux 5 routes corrigées en C4.

---

## 13. API CONTRACTS

| Endpoint | Nécessaire ? | Auth | Input | Validation | Output | Erreurs | Idempotence | Tenant |
|---|---|---|---|---|---|---|---|---|
| `POST /api/sales` | **Oui** — cœur du design | `requireTenant()` | `{ lignes:[{produit_id,qte,prix,origine?}], mode_paiement, destinataire? }` | Produits/warehouse appartiennent au tenant ; stock suffisant par ligne/origine ; `mode_paiement` dans l'ensemble connu | `{ vente_id, total, montant_ht, montant_tva, montant_ca, statut_paiement }` | 400 (ligne invalide), 403 (ressource hors tenant), 409 (stock insuffisant), 500 | Voir §10 — non résolue sans clé applicative | `ctx.tid` uniquement |
| `GET /api/sales/:id` | **Oui** — affichage ticket, historique | `requireTenant()` | — | `ventes.tenant_id = ctx.tid` | Détail vente + lignes | 404 si hors tenant ou inexistant | N/A (lecture) | Filtré |
| `GET /api/sales` | **Oui** — liste/historique (déjà la table "ventes" affichée dans `commerce/page.tsx`) | `requireTenant()` | Pagination/filtre date | `tenant_id = ctx.tid` | Liste | — | N/A | Filtré |
| `POST /api/sales/:id/paiement` | **Oui si D3-B déployé** | `requireTenant()` | `{ montant, mode_paiement_reel }` | Vente appartient au tenant, `statut_paiement='du'` | Confirmation + nouveau statut | 400 (déjà soldée), 403, 404 | Clé générique `(tenant_id, event_type_paiement, 'ventes', id)` | Filtré |
| `POST /api/sales/:id/reverse` | **Oui** — demandé explicitement par le plan de test | `requireTenant()`, rôle minimum à définir (probablement `admin`, comme les annulations ailleurs) | `{ reason }` | Vente appartient au tenant, événement(s) au statut `processed` | Confirmation extourne | 400 (déjà extournée), 403, 404 | `accounting_event_extournes.UNIQUE(original_event_id)` déjà générique | Filtré |

**Pas d'endpoint séparé pour la provenance** : portée par le body de `POST /api/sales` (ligne par ligne), pas un endpoint dédié — cohérent avec le choix manuel déjà conçu.

---

## 14. UI CHANGES

**POS (`commerce/page.tsx`)** — modifications minimales, pas de redesign :
- Remplacer les 3 appels directs (`insert ventes`, `insert vente_lignes`, `rpc fn_stock_move`) par **un seul** `fetch('/api/sales', {method:'POST', body:...})`.
- Afficher HT/TVA/CA/TTC dans le récapitulatif panier (actuellement seul le total est affiché, à vérifier/étendre) — calcul retourné par l'API, jamais recalculé côté client.
- Le sélecteur de provenance par ligne : **déjà existant**, inchangé.
- Le mode "Crédit" : **déjà sélectionnable**, devient réellement fonctionnel sans changement d'UI.
- Empêcher une vente impossible : désactiver "Encaisser" si `origineManquante` (déjà le cas) **et** si le stock affiché est insuffisant pour une ligne (déjà partiellement géré par `stockError`, à vérifier qu'il bloque bien l'envoi, pas seulement l'affichage).

**stocks/sorties (`stocks/sorties/page.tsx`)** — modification minimale (D2) :
- Pour `type_sortie==='vente'` uniquement : remplacer l'`INSERT sorties`/`sortie_lignes` (qui échoue aujourd'hui) par le même `fetch('/api/sales', ...)`, en transmettant `destinataire`/`warehouse_id` dans le body.
- Les 5 autres raisons (`consommation`/`transfert`/`perte`/`don`/`usage_interne`) : **aucun changement** — restent hors périmètre, toujours non fonctionnelles tant qu'une décision séparée n'est pas prise sur leur destination de persistance.

---

## 15. TEST PLAN

| # | Scénario | Type |
|---|---|---|
| A | Vente comptant simple | Integration (DB réelle, transaction + rollback) |
| B | Vente crédit | Integration |
| C | Paiement d'une créance | Integration |
| D | TVA normale | Unit (Fiscal Core, déjà testé ailleurs — réutiliser) |
| E | TVA zéro | Unit + Integration (vérifier l'absence de ligne 4441) |
| F | Centime additionnel | Unit + Integration |
| G | Stock insuffisant | Integration (vérifier rollback complet, aucune trace partielle) |
| H | Provenance unique | Integration |
| I | Provenance multiple | Integration |
| J | Provenance invalide (origine inexistante pour ce produit) | Integration (doit échouer proprement, pas de fallback) |
| K | Double clic | Integration — **dépend de la décision §10 sur la clé applicative**, sinon ce test documentera une limite connue plutôt qu'un succès |
| L | Retry HTTP | Idem K |
| M | Reverse | Integration (comptant, crédit non payé, crédit payé — 3 sous-cas, §11) |
| N | Tenant A → données tenant B | DB/Integration (requête directe avec un `ventes.id` d'un autre tenant → 404, pas 200) |
| O | Produit tenant B | Integration (refus avant toute écriture) |
| P | Warehouse tenant B | Integration (idem) |
| Q | Client tenant B | Sans objet — `destinataire` est un champ libre, pas une relation à un tenant (voir §12) |
| R | Accounting duplicate | DB (rejouer le même `source_id` → `uidx_ae_processed` bloque) |
| S | Stock duplicate | Integration (vérifier que la transaction unique §9 empêche un double appel `fn_stock_move` pour la même requête) |
| T | Fiscal duplicate | Couvert par R — même événement, mêmes séquences |

**Tous les tests d'intégration/DB nécessitent le canal transactionnel actuellement bloqué (C5, Docker/MCP indisponibles)** — à exécuter réellement dès que ce canal est rétabli, pas avant.

---

## 16. MIGRATION PLAN (description, PAS de fichier SQL)

```
Migration NNN — Vente canonique (VTE-001), additive uniquement
  1. Garde-fou : RAISE EXCEPTION si ventes.montant_ht existe déjà (même pattern que 184)
  2. ALTER TABLE ventes ADD COLUMN montant_ht NUMERIC NOT NULL DEFAULT 0,
                         ADD COLUMN montant_tva NUMERIC NOT NULL DEFAULT 0,
                         ADD COLUMN montant_ca NUMERIC NOT NULL DEFAULT 0,
                         ADD COLUMN statut_paiement TEXT NOT NULL DEFAULT 'paye',
                         ADD COLUMN destinataire TEXT NULL
     + CHECK (statut_paiement IN ('paye','du','solde'))
  3. INSERT INTO accounting_event_rules — VTE-001, 4 séquences (§8), rule_version 1, status 'active'
  4. (si retenu, §4) INSERT INTO accounting_event_rules — event_type de règlement crédit,
     structure FAC-002, source_table='ventes'
  5. Contrôles de lecture seule après application (pattern déjà standard des migrations
     de ce dépôt — SELECT de vérification, pas d'exécution de test)
  6. Section retour arrière commentée (DROP COLUMN / désactivation des règles)
```

Backward compatible : `ventes`/`vente_lignes` existantes (0 ligne, donc aucune donnée à migrer) ; les defaults (`0`, `'paye'`) garantissent qu'aucune ligne hypothétique préexistante ne serait invalidée. Aucune suppression, aucune modification de donnée existante.

---

## 17. ORDRE D'IMPLÉMENTATION

```
0. PRÉALABLE BLOQUANT : migration 184 (provenance stock) doit être appliquée —
   sans elle, fn_stock_move n'accepte pas origine/purchase_item_id et
   v_products_stock_par_origine n'existe pas. Indépendant de cette mission
   (déjà son propre chantier, BOI-010D), mais c'est une dépendance dure, pas
   une option.
1. Schéma (migration NNN, §16) — dépend de 0 uniquement pour la cohérence
   d'ensemble, pas techniquement pour ses propres colonnes
2. Fonctions DB : aucune nouvelle fonction nécessaire (fn_stock_move,
   emit_accounting_event, fn_reverse_accounting_event tous déjà existants)
3. Accounting rule VTE-001 (+ règle de règlement crédit) — dépend de 1
4. API (`POST /api/sales` et les 3 endpoints associés) — dépend de 1, 3, et 0
5. Stock/provenance — déjà fonctionnel dès 0 ; l'API (étape 4) l'exploite simplement
6. Fiscal — déjà existant (Fiscal Core) ; l'API (étape 4) l'exploite simplement
7. Paiement crédit — dépend de 3 (règle de règlement) et 4
8. UI (POS + stocks/sorties) — dépend de 4 entièrement, dernier maillon
9. Tests — en parallèle de 4-8 pour les tests unitaires (fiscal, calculs purs) ;
   après 8 pour les tests d'intégration réels (dépendent aussi de C5/Docker)
10. Validation production — après 9, et seulement après que C5 confirme un
    canal transactionnel réel disponible
```

---

## 18. RISQUES

| Risque | Section | Sévérité |
|---|---|---|
| Migration 184 non appliquée — bloquant dur, pas seulement une dépendance molle | §6, §17 | **Élevé** |
| Clé d'idempotence applicative (double clic réseau) non tranchée | §10 | Moyen |
| Coût via `products.prix_achat` reste une approximation (pas de PMP/FIFO) — accepté comme limite connue, pas une erreur de conception | §5 | Faible (déjà le niveau de précision de STK-002) |
| UI de recouvrement crédit toujours non spécifiée (hérité de C6-PRODUCT-DECISIONS) | §4, §14 | Moyen |
| `fn_sync_tresorerie_soldes` sur extourne toujours `NOT_DETERMINED` | §11 | Moyen, bloquant avant déploiement pas avant codage |
| Canal DB transactionnel (C5) toujours indisponible pour valider réellement ce design avant production | §15, §17 | Élevé pour la mise en production, pas pour la conception |

---

## 19. PRÉREQUIS

1. Migration 184 appliquée (bloquant dur, §17).
2. Décision de codage (pas produit) sur la clé d'idempotence applicative de `POST /api/sales` (§10) — sinon le double-clic reste un risque documenté, pas fermé.
3. Spécification de l'UI de recouvrement crédit (hérité, non bloquant pour coder `VTE-001` lui-même).
4. Vérification `fn_sync_tresorerie_soldes` (§11) avant déploiement, pas avant codage.
5. Canal DB transactionnel (C5) avant toute validation réelle et tout déploiement — pas avant l'écriture du code/de la migration.

---

## VERDICT

```
C6_IMPLEMENTATION_DESIGN = PARTIAL
```

**PARTIAL, pas READY** : la quasi-totalité du design (schéma, VTE-001, flux comptant/crédit, transaction, idempotence comptable/stock, reverse, API, UI) est déterminée sans invention, par réutilisation stricte des mécanismes et précédents déjà existants (`metadata.FIELD`, `metadata_debit`, `fn_stock_move`, `emit_accounting_event`, `fn_reverse_accounting_event`, structure FAC-002). Mais **une dépendance dure et non résolue bloque le passage direct au code** : la migration 184 (provenance stock) n'est pas appliquée en production, et ce design en dépend structurellement (§6, §17) — ce n'est pas une inconnue de conception, c'est une inconnue d'état réel non levée par cette mission. Un second point mineur (clé d'idempotence applicative, §10) reste une décision de codage ouverte, pas une décision métier — elle n'empêcherait pas de commencer à coder, mais empêche de déclarer le design entièrement fermé.

**PARTIAL, pas BLOCKED** : rien n'empêche d'écrire la migration, la règle `VTE-001` et l'API dès maintenant — seul le **déploiement** de l'ensemble attend la levée du blocage 184 (et, pour la validation réelle, du blocage C5/Docker).

```
NEXT_MISSION = Ne pas enchaîner directement sur C6-IMPLEMENTATION (le code).
  D'abord : une mission courte pour (a) confirmer si la migration 184 peut être
  appliquée indépendamment de C6 (elle est déjà prête depuis BOI-010, son seul
  blocage est l'absence de canal DB/Docker — C5), et (b) trancher la clé
  d'idempotence applicative de §10 (décision de codage, quelques minutes de
  réflexion, pas une inconnue métier). Une fois ces deux points réglés,
  C6-IMPLEMENTATION (écriture de la migration + de la règle VTE-001 + de
  l'API) peut démarrer sans improviser de décision en cours de route.
```

# C6 — ARBITRAGE ARCHITECTURAL : VENTE CANONIQUE

Mission d'arbitrage, lecture seule. Aucun code métier, aucune migration, aucune modification DB, aucun commit/push. Base : `docs/C6-SCHEMA-VALIDATION.md` (schéma production confirmé par introspection PostgREST) + `docs/C6-VENTE-CANONICAL-DESIGN.md` (précédents comptables/fiscaux).

---

## 1. ÉTAT ACTUEL

Confirmé par `C6-SCHEMA-VALIDATION.md`, repris comme base factuelle non re-démontrée ici :
- `ventes`/`vente_lignes` existent, compatibles avec le code POS, 0 ligne en production.
- `sorties`/`sortie_lignes` n'existent pas (`PGRST205` confirmé deux fois).
- Aucune colonne fiscale (`montant_ht`/`montant_tva`/`montant_ca`) sur `ventes`/`vente_lignes`.
- `fn_stock_move`, `v_products_stock`, `emit_accounting_event`, `requireTenant()` sont les mécanismes canoniques déjà en place, non remis en cause ici.

---

## 2. FLUX POS RÉEL

```
app/dashboard/commerce/page.tsx (seul point d'entrée — aucune route /api/commerce)
  1. INSERT ventes (tenant_id, total, mode_paiement, nb_articles, statut)   → RÉUSSIT (table réelle)
  2. INSERT vente_lignes (vente_id, produit_id, produit_nom, qte, prix, sous_total) → RÉUSSIT
  3. RPC fn_stock_move direct (par ligne, origine optionnelle via
     v_products_stock_par_origine)                                          → RÉUSSIT si stock suffisant
  4. Fiscal   : AUCUN calcul HT/TVA/CA — confirmé absent du code et du schéma
  5. Trésorerie : AUCUNE écriture — mode_paiement stocké comme métadonnée seulement
  6. Accounting : AUCUN appel emit_accounting_event — confirmé par recherche exhaustive (0 résultat VTE-/COM-/POS-)
```

**Le flux s'arrête net après l'étape 3.** Les étapes 1-3 ne sont pas supposées fonctionner — elles sont confirmées fonctionner (schéma compatible, fonction `fn_stock_move` réelle). Les étapes 4-6 n'existent dans aucun fichier de code, pas seulement non appelées.

`app/dashboard/commerce/analytics/page.tsx` lit `ventes` directement (`total, mode_paiement, nb_articles, created_at`) pour produire son propre CA — **un troisième consommateur de `ventes`, qui devra être mis à jour si le schéma évolue** (nouvelle colonne, nouveau calcul HT/TTC).

---

## 3. FLUX STOCKS/SORTIES RÉEL

```
app/dashboard/stocks/sorties/page.tsx
  1. INSERT sorties {...}   → ÉCHOUE IMMÉDIATEMENT (PGRST205, table absente)
  2-4. Jamais atteints (sortie_lignes, fn_stock_move, writeComptaEntry)
```

**Confirmé** : la page gère en réalité **6 raisons de sortie**, pas seulement la vente — `vente`, `consommation`, `transfert`, `perte`, `don`, `usage_interne` (constante `TYPE_SORTIE`, lignes 47-54 du fichier). Seules `vente` (→ `writeComptaEntry` 411/701, jamais atteint) et `perte`/`don` (→ `writeComptaEntry` 658/311, jamais atteint non plus) ont un traitement comptable prévu dans le code ; `consommation`/`transfert`/`usage_interne` n'ont **aucun** traitement comptable prévu, même en théorie.

**Conséquence pour cette mission** : seule la branche `type_sortie='vente'` relève de l'arbitrage A/B ci-dessous. Les 5 autres raisons restent un problème distinct, non résolu par cette mission (ni par l'Option A, ni par l'Option B) — elles auront besoin de leur propre décision de table (`sorties` générique pour les mouvements non-vente, ou autre mécanisme), **hors périmètre de "vente canonique"**.

---

## 4. INVENTAIRE DES CONSOMMATEURS

| Objet | Fichier | Fonction/rôle | R/W | Table | Statut réel | Dépendances |
|---|---|---|---|---|---|---|
| `ventes` | `app/dashboard/commerce/page.tsx` | Création vente POS | W puis R (historique) | `ventes` | **Actif**, fonctionnel pour l'insertion | `vente_lignes`, `fn_stock_move` |
| `ventes` | `app/dashboard/commerce/analytics/page.tsx` | CA, tickets, répartition par mode de paiement | R | `ventes` | **Actif** (lit une table existante mais vide en prod) | Schéma de `ventes` |
| `vente_lignes` | `app/dashboard/commerce/page.tsx` | Lignes de panier | W | `vente_lignes` | **Actif** | `ventes.id`, `products.id` (implicite) |
| `stocks/sorties` page | `app/dashboard/stocks/sorties/page.tsx` | UI de sortie de stock (6 raisons) | W (tenté) | `sorties`/`sortie_lignes` | **Cassé** — table absente, échec total à la première écriture | `fn_stock_move`, `writeComptaEntry` (jamais atteints) |
| `writeComptaEntry` | `lib/compta-sync-client.ts` (définition) | Writer comptable legacy, hors moteur `emit_accounting_event` | W | `journal_comptable`+`journal_entries` (direct) | **Actif et largement utilisé** — 9 pages `tresorerie/*`, `stocks/achats`, `stocks/sorties` (jamais atteint), `stocks/retours`, `stocks/inventaires`, `ecole/rh` | Aucune — c'est lui-même un chemin alternatif au moteur central |
| `fn_stock_move` | `app/api/stock/move/route.ts` | Seul point qui émet aussi STK-002 | R+W | `stock_movements` | **Actif, correct** | — |
| `fn_stock_move` | `commerce/page.tsx`, `stocks/{sorties,retours,inventaires,transferts,achats}/page.tsx` | Appels RPC directs, contournant `/api/stock/move` | W | `stock_movements` | **Actif mais bypass** — bien plus répandu que seulement POS/sorties (5 pages stock + POS) | `fn_stock_move` (fonction elle-même correcte) |
| `STK-002` (règle) | migration 147 | Sortie stock **non facturée** (conso interne/perte/usage) | — (règle) | `accounting_event_rules` | **Actif**, mais explicitement hors périmètre vente (commentaire source, migration 147 ligne 177) | `emit_accounting_event` |
| `accounting_events`/`journal_entries` (lecture CA/TVA) | `lib/erp-core/compute/accounting.ts`, `computeTVAFromJournal` (via `app/api/fiscalite/tva/route.ts`) | Déclaration TVA, Grand Livre, Balance | R | `journal_entries` | **Actif pour les modules déjà câblés** (FAC/ACH/PAI/RES/SAN/HOT/BOI/BTP) — **`ventes` n'y contribue jamais** aujourd'hui (confirmé : 0 résultat pour `from('ventes')` dans toute recherche liée à `computeTVAFromJournal`) | — |
| Trésorerie (9 pages) | `app/dashboard/tresorerie/*` | Caisse/banque/mobile money | R+W (via `writeComptaEntry`) | `transactions`/`journal_entries` (direct) | **Actif, legacy** | Ne lit jamais `ventes` (confirmé, 0 résultat) |
| `v_products_stock_par_origine` | `commerce/page.tsx` uniquement | Sélection manuelle de provenance au panier | R | vue dérivée | **Préparée, inerte en production** — migration 184 non appliquée, la vue n'existe pas ; le POS gère ce cas sans régression (pas d'origine proposée si la vue échoue) | migration 184 |
| `fn_reverse_accounting_event` | migration 138 | Extourne générique | W | `journal_entries`, `accounting_event_extournes` | **Actif**, générique, jamais appelé pour une vente (puisqu'aucune vente n'émet d'événement à extourner) | `accounting_events` |

---

## 5. COMPARAISON OPTION A / OPTION B

| Critère | Option A — converger vers `ventes`/`vente_lignes` | Option B — créer `sorties`/`sortie_lignes` |
|---|---|---|
| Duplication des données | Aucune — un seul couple de tables pour "quelque chose a été vendu" | Deux couples de tables (`ventes` + `sorties`) représentant le même fait économique selon le point d'entrée UI |
| Source unique de vérité | **Préservée** — `ventes` reste la seule table "vente" | **Violée** — deux sources pour la même notion métier, risque de double-saisie/divergence future déjà vécu ailleurs dans ce dépôt (ex. achats legacy vs `purchases`, déjà réparé en BOI-004) |
| Stock | `fn_stock_move`, routé via `/api/stock/move`, identique dans les deux options | Identique |
| Provenance | Un seul mécanisme de sélection (déjà câblé dans `commerce/page.tsx`) à étendre à l'UI sorties | Devrait être re-câblé une seconde fois pour `sorties` |
| TVA / Centime additionnel | Une seule règle `accounting_event_rules` à créer et maintenir | Deux event_types distincts (`VTE-001` et un hypothétique `SOR-001`) pour le même calcul fiscal — double maintenance si le taux ou la règle d'exonération change |
| Comptabilité | Un seul event_type, un seul schéma de séquences | Deux event_types quasi identiques, risque de divergence (ex. l'un reçoit une correction de bug, l'autre non — déjà le schéma de dette observé avec les 3 assiettes de paie, Top 10 action #8 du plan d'exécution) |
| Trésorerie | Un seul point d'entrée `treasury_debit` | Dupliqué |
| Paiement comptant | Identique dans les deux (dépend du moyen de paiement, pas de la table) | Identique |
| Vente à crédit | Un seul modèle 411→521/411 à concevoir | Dupliqué |
| Reverse | Un seul chemin `fn_reverse_accounting_event` à brancher | Dupliqué |
| Idempotence | Une seule clé `(tenant_id, event_type, source_table, source_id)` à gérer, `source_table` variable selon l'origine (`ventes` ou `sorties` si on voulait les distinguer côté stock uniquement) | Deux jeux de clés, deux chemins à tester |
| Reporting | `commerce/analytics/page.tsx` reste la seule source CA à étendre ; un futur rapport consolidé (CA) n'a qu'un seul endroit à lire | Un rapport CA devrait agréger deux tables, risque d'oubli (déjà le symptôme documenté : `rapports/page.tsx` n'agrège déjà pas `ventes` aujourd'hui — ajouter une deuxième source aggraverait ce risque) |
| Tenant isolation | `ventes.tenant_id` déjà réel et contraint (FK) ; `vente_lignes` isolé par jointure | À refaire intégralement pour deux nouvelles tables |
| Compatibilité architecture actuelle | **Totale** — 0 ligne en prod, aucune donnée à migrer, aucune régression possible pour un usage existant | Nécessite de construire un nouveau modèle sans aucun précédent d'usage réel (les deux tables n'ont jamais existé) |
| Migrations nécessaires | 1 migration additive (colonnes fiscales sur `ventes`/`vente_lignes`) — compatible avec le schéma déjà confirmé | 1 migration de création complète (2 tables, FK, index, RLS) — plus volumineuse, plus risquée |
| Complexité | Plus faible — étendre un flux qui fonctionne déjà pour 3 des 6 étapes | Plus élevée — bâtir un flux entier depuis zéro |
| Risque de divergence future | Faible — un seul point de calcul fiscal/comptable pour toute vente | **Élevé** — motif de dette déjà documenté à plusieurs reprises dans ce dépôt (2 moteurs fiscaux, 3 assiettes de paie, 5 writers comptables) ; créer `sorties` reproduirait ce même motif pour la vente elle-même |
| Compatibilité POS | Native, c'est la table déjà utilisée | Nécessiterait que le POS change de table ou que les deux coexistent |
| Compatibilité stocks/sorties | Nécessite de rediriger la branche `type_sortie='vente'` vers `ventes`/`vente_lignes` (changement d'UI/de table cible, pas de logique métier nouvelle) | Native pour cette page spécifiquement, mais au prix de tout le reste de cette colonne |

---

## 6. PREUVES TECHNIQUES

- **`ventes` n'est utilisée que par 2 fichiers réels** (`commerce/page.tsx`, `commerce/analytics/page.tsx`) — confirmé par recherche exhaustive `from('ventes')` sur tout le dépôt.
- **`vente_lignes.vente_id` est la SEULE clé étrangère pointant vers `ventes` dans tout le schéma production** (338 tables scannées via l'introspection OpenAPI PostgREST, 1 seule référence trouvée) — aucune autre table (`factures`, `transactions`, `accounting_events`, `resto_commandes`, etc.) ne référence `ventes`. **Aucun risque de fusionner deux concepts métier distincts** : `ventes` n'est ni une commande, ni une facture, ni un ticket d'un autre module — c'est un concept isolé, confirmé au niveau du schéma, pas seulement du code.
- **`stocks/sorties` gère 6 raisons, pas seulement la vente** — seule 1 des 6 relève de cet arbitrage.
- **`fn_stock_move` est contourné par bien plus que POS+sorties** (5 pages stock supplémentaires) — confirme que le problème de bypass RPC est structurel à tout le module stock, pas spécifique à la vente ; traité ici uniquement pour la branche vente, le reste reste une dette distincte déjà connue.
- **Aucune vente n'a jamais contribué à la déclaration TVA** (`computeTVAFromJournal`) — confirmé par recherche croisée, cohérent avec l'absence totale d'émission comptable.

---

## 7. DÉPENDANCES

- Migration additive sur `ventes`/`vente_lignes` (colonnes fiscales) → dépend de rien d'autre, peut être écrite dès que le détail de calcul (HT par ligne vs par vente) est tranché.
- Nouvelle règle `accounting_event_rules` (`VTE-001`) → dépend du Fiscal Core existant (aucune dépendance nouvelle), doit être écrite après la migration ci-dessus (les colonnes doivent exister pour que la route calcule les montants à transmettre).
- Redirection du bypass RPC (POS + sorties/vente) vers un point d'entrée serveur unique → dépend de la règle `accounting_event_rules` ci-dessus pour avoir quelque chose à émettre.
- `v_products_stock_par_origine` (provenance) → dépend de la migration 184, déjà préparée mais non appliquée, **indépendante de cette mission**.
- `fn_sync_tresorerie_soldes` (impact sur les soldes de trésorerie affichés) → à vérifier (déjà noté `NOT_DETERMINED` dans C6-design) avant de considérer la trésorerie comme pleinement fermée.

---

## 8. RISQUES

| Risque | Option concernée | Sévérité |
|---|---|---|
| Créer `sorties`/`sortie_lignes` reproduit un motif de dette déjà documenté 3 fois dans ce dépôt (moteurs fiscaux, assiettes de paie, writers comptables) | B | Élevé |
| `commerce/analytics/page.tsx` doit être mis à jour quelle que soit l'option retenue dès que `ventes` gagne des colonnes fiscales | A et B | Moyen, mais limité à 1 fichier connu |
| Les 5 raisons non-vente de `stocks/sorties` restent non résolues par cette mission, quelle que soit l'option | A et B | Moyen — à traiter dans une mission séparée, ne pas laisser croire que "vente canonique" résout toute la page |
| `fn_sync_tresorerie_soldes` non vérifié pour l'extourne | A et B | Faible à ce stade (pas bloquant pour la conception, bloquant avant déploiement) |
| Migration additive sur `ventes`/`vente_lignes` sans données existantes à perdre (0 ligne) | A | Très faible — confirmé par `C6-SCHEMA-VALIDATION.md` |

---

## 9. DÉCISION RECOMMANDÉE

**Option A.** Justifiée par la preuve, pas par préférence :
1. `ventes`/`vente_lignes` existent déjà, sont compatibles avec le code POS réel, et n'ont aucune donnée à perdre (0 ligne).
2. Aucune autre table ni aucun autre module ne dépend de `ventes` ou n'en porte le concept sous un autre nom — la fusion ne risque de confondre aucun concept juridique/métier distinct (preuve négative exhaustive, §6).
3. Créer `sorties`/`sortie_lignes` reproduirait exactement le motif de dette déjà documenté et corrigé ailleurs dans ce dépôt (doublons de moteurs/sources de vérité) — ce serait recréer sciemment le problème que cette mission existe pour éviter.
4. La complexité et le risque de migration sont strictement inférieurs pour A (additive sur une table vide) que pour B (création complète sans aucun précédent d'usage réel).

---

## 10. ARCHITECTURE CIBLE

Conceptuel uniquement, aucune colonne créée ici :

| Donnée | Persistée dans `ventes` | Persistée dans `vente_lignes` | Dérivée (calcul, pas stockage) | Portée par `accounting_events` | Portée par `stock_movements` |
|---|---|---|---|---|---|
| Montant total TTC | Oui (déjà `total`) | — | — | `montant_ttc` | — |
| Montant HT / TVA / CA | **À ajouter** (par vente, le niveau le plus simple compatible avec l'absence actuelle d'exonération produit confirmée fiable — voir C6-design §6) | Possible si une exonération par ligne devient nécessaire plus tard | — | `montant_ht`/`montant_tva`/`montant_ca` (reçus de la vente, pas recalculés par le moteur) | — |
| Moyen de paiement | Oui (déjà `mode_paiement`) | — | Détermine le compte de contrepartie (521 résolu vs 411) | `metadata.mode_paiement` | — |
| Quantité, produit, prix par ligne | — | Oui (déjà `qte`/`prix`/`produit_id`/`produit_nom`) | — | — | `quantite`, `product_id` |
| Provenance (origine) | — | **À ajouter si choix par ligne nécessaire** (cohérent avec BOI-010, un choix par ligne de panier) | — | `metadata.origine` (traçabilité) | `origine`, `purchase_item_id` (déjà le mécanisme réel) |
| Coût des marchandises vendues | — | — | `qte × prix_achat` au moment de l'émission (le prix d'achat vient de `products`, pas stocké sur la ligne de vente) | Séquence 601/311 | — |
| Statut de la vente | Oui (déjà `statut`) | — | — | Référence `source_id`/`source_table` | — |

---

## 11. CE QUI DOIT ÊTRE CODÉ (futur, pas cette mission)

1. Point d'entrée serveur unique (ex. `POST /api/sales`, nom à trancher au codage) remplaçant les inserts/RPC directs du POS et de la branche `type_sortie='vente'` de `stocks/sorties`.
2. Calcul HT/TVA/CA via le Fiscal Core existant, jamais de taux local.
3. Appel `fn_stock_move` par ligne, via ce point d'entrée (plus de RPC direct côté client).
4. Appel `emit_accounting_event('VTE-001', ...)` avec les comptes déjà déterminés en C6-design (701/4441/447/601-311).
5. Branche paiement différé (411 puis règlement séparé), seulement si `stocks/sorties` (ou une future option crédit du POS) l'exige réellement.

## 12. CE QUI DOIT ÊTRE MIGRÉ

1. Migration additive sur `ventes` (et/ou `vente_lignes`) : colonnes fiscales — **détail exact (par vente vs par ligne) à trancher avant d'écrire la migration**, pas déterminé par cette mission d'arbitrage.
2. Nouvelle règle `accounting_event_rules` pour `VTE-001` (4 séquences, modélisée sur BOI-001 + STK-002, comptes déjà prouvés — voir C6-design §5).
3. Rien sur `sorties`/`sortie_lignes` — **ne pas les créer** (Option A retenue).

## 13. CE QUI DOIT ÊTRE SUPPRIMÉ / DÉPRÉCIÉ

1. `writeComptaEntry()` sur la branche `type_sortie==='vente'` de `stocks/sorties/page.tsx` — à remplacer par l'appel au point d'entrée canonique, pas à garder en parallèle.
2. L'UI de `stocks/sorties/page.tsx` pour la raison `'vente'` spécifiquement — à transformer en redirection/alias vers l'écran de vente canonique (POS ou un futur écran "vente par origine stock" si un besoin UI distinct du POS comptoir existe réellement — **non tranché ici, question produit**).
3. **Ne pas toucher** aux 5 autres raisons (`consommation`, `transfert`, `perte`, `don`, `usage_interne`) dans cette mission — elles restent un problème séparé (§3), avec leur propre décision de table à prendre ultérieurement.

## 14. TESTS NÉCESSAIRES

1. Test transactionnel (dès qu'un canal DB existe, C5 toujours bloqué) : vente multi-lignes, mix taxable/exonéré (si jamais déterminé), vérification des 4 séquences `VTE-001`, idempotence sur rejeu du même `source_id`.
2. Test de non-régression sur `commerce/analytics/page.tsx` une fois les colonnes fiscales ajoutées (le calcul de CA actuel lit `total` — à vérifier qu'il reste cohérent avec HT+TVA+CA).
3. Test confirmant que la branche `type_sortie='vente'` de `stocks/sorties`, après redirection, produit exactement les mêmes écritures qu'une vente POS équivalente (convergence réelle, pas seulement nominale).
4. Test confirmant que les 5 raisons non-vente restent fonctionnelles (ou documentées comme toujours cassées, selon ce qui est décidé séparément) après la modification de la page.

## 15. PRÉREQUIS AVANT IMPLÉMENTATION

1. Décision produit : HT/TVA/CA par vente ou par ligne (impacte directement la forme de la migration additive).
2. Décision produit : que devient l'UI de `stocks/sorties` pour la raison "vente" — redirection pure vers le POS, ou conservation d'un écran distinct qui appelle le même point d'entrée serveur (utile si le contexte diffère : vente à un client nommé avec provenance précise, vs vente comptoir rapide) ?
3. Décision produit : le POS doit-il supporter la vente à crédit (scénario 3/11/12 de C6-design), ou seulement le comptant pour l'instant ? Détermine si la branche 411/521 doit être codée dès la première itération.
4. Vérification `fn_sync_tresorerie_soldes` sur l'extourne (C6-design §11, toujours `NOT_DETERMINED`).
5. Canal DB transactionnel (C5) — pas bloquant pour écrire la migration, mais nécessaire avant de la déployer avec confiance.

---

## VERDICT

```
C6_ARCHITECTURE = PARTIAL
```

**PARTIAL, pas READY** : la décision d'option est tranchée avec preuve (A), l'architecture cible est déterminée pour les comptes et les mécanismes génériques — mais 3 décisions produit explicites (§15, points 1-3) restent ouvertes et ne peuvent pas être tranchées par une analyse de code seule. Les déclarer ici inventerait une décision métier, ce que cette mission interdit explicitement.

**PARTIAL, pas BLOCKED** : aucune dépendance technique critique n'est manquante pour commencer à écrire la migration et la règle comptable dès que ces 3 décisions produit sont prises — rien n'attend un canal DB ou une information technique indisponible.

```
DECISION_OPTION = A
DECISION_JUSTIFICATION = ventes/vente_lignes existent déjà, sont compatibles avec le
  code POS réel, 0 ligne à migrer, et aucune autre table du schéma production
  (338 tables scannées) ne référence ou ne chevauche ce concept — fusionner
  stocks/sorties(vente) dans ventes ne risque aucune confusion métier/juridique.
  Créer sorties/sortie_lignes reproduirait sciemment le motif de duplication de
  source de vérité déjà documenté et corrigé ailleurs dans ce dépôt (moteurs
  fiscaux, assiettes de paie, writers comptables).
IMPLEMENTATION_PREQUISITES = (1) décision HT/TVA/CA par vente ou par ligne ;
  (2) décision sur le devenir de l'UI stocks/sorties pour la raison "vente" ;
  (3) décision sur le support du crédit dès la v1 du POS ; (4) vérification
  fn_sync_tresorerie_soldes sur l'extourne ; (5) canal DB avant déploiement
  (pas avant écriture du code).
NEXT_MISSION = Trancher les 3 décisions produit ci-dessus (mission de décision,
  pas de code), PUIS une mission de conception détaillée de la migration
  additive exacte (colonnes, par vente ou par ligne) et de la règle
  accounting_event_rules VTE-001 (séquences précises, conditions d'exonération),
  avant toute mission de codage.
```

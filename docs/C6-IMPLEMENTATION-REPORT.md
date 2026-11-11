# C6 — RAPPORT D'IMPLÉMENTATION (vente canonique)

Code écrit, migration préparée, tests créés. **Aucune migration exécutée, aucune donnée production modifiée, aucun commit/push.**

---

## 1. FICHIERS MODIFIÉS

**Créés :**
| Fichier | Rôle |
|---|---|
| `supabase/migrations/185_vente_canonique.sql` | Colonnes fiscales + idempotency_key sur `ventes`, règles `VTE-001` (7 séquences) et `VTE-002` |
| `app/api/sales/route.ts` | POST (création canonique) + GET (liste) |
| `app/api/sales/[id]/route.ts` | GET (détail) |
| `app/api/sales/[id]/paiement/route.ts` | POST (règlement crédit, VTE-002) |
| `app/api/sales/[id]/reverse/route.ts` | POST (annulation, `fn_reverse_accounting_event`) |
| `lib/architecture/vente-canonique.test.ts` | 25 tests statiques |
| `lib/architecture/sales-route.integration.test.ts` | 8 tests d'intégration mockés (exécution réelle du handler) |

**Modifiés :**
| Fichier | Changement |
|---|---|
| `app/dashboard/commerce/page.tsx` (POS) | 3 appels directs (insert ventes, insert vente_lignes, rpc fn_stock_move) remplacés par un seul `fetch('/api/sales')` ; affichage HT/TVA/CA ; champ client pour le crédit ; `idempotency_key` générée à l'ouverture du paiement |
| `app/dashboard/stocks/sorties/page.tsx` | Branche `type_sortie==='vente'` uniquement : nouvelle fonction `handleCreateVente()` appelant `/api/sales` ; les 5 autres raisons **inchangées** |
| `lib/architecture/schema-contract.test.ts` | Ajout `stock_movements.origine`/`purchase_item_id` (migration 184, préparée) au registre — même convention déjà utilisée pour `warehouses.actif` (migration 183) |

**Correction de nommage trouvée en implémentant** : les missions C6 précédentes désignaient la table absente sous le nom `sorties`/`sortie_lignes` — le code réel utilise `stock_sorties`/`stock_sortie_items`. **Reconfirmé absent sous ce nom exact** également (`PGRST205` sur les deux, aujourd'hui). La conclusion ("la page ne persiste rien") reste inchangée, seul le nom générique utilisé dans les rapports précédents était approximatif.

---

## 2. MIGRATION PRÉPARÉE

`185_vente_canonique.sql` — voir son en-tête pour le détail complet. Points de vérification finale (Phase 1) :

- **DROP ciblé de `fn_stock_move`** : cette migration **ne touche pas** `fn_stock_move` — aucune signature, aucun `DROP FUNCTION`. Cette partie reste entièrement dans la migration 184 (déjà validée `SAFE_TO_APPLY` par `C6-PREIMPLEMENTATION-GATE.md`, non réécrite ici, non ré-exécutée).
- **Aucune surcharge** : 185 ajoute seulement des colonnes à `ventes` et des lignes à `accounting_event_rules` — aucune fonction n'est créée ni remplacée.
- **Historique NULL-safe** : `ventes`/`vente_lignes` ont 0 ligne en production (reconfirmé `C6-SCHEMA-VALIDATION.md`) — les `DEFAULT` (`0`, `'paye'`) ne s'appliquent à aucune ligne existante.
- **RLS/tenant** : aucune `CREATE POLICY`/`ALTER POLICY` dans le fichier — l'isolation reste portée par les policies déjà existantes sur `ventes` (non modifiées) et par `requireTenant()` côté application.
- **`purchase_item_id`** : colonne ajoutée **par 184**, pas par 185 — 185 ne la référence que dans le code applicatif (`app/api/sales/route.ts`), qui ne fonctionnera qu'une fois 184 appliquée (dépendance runtime documentée dans l'en-tête de 185, pas une dépendance SQL).
- **`v_products_stock_par_origine`** : inchangée, créée par 184, non touchée par 185.
- **Compatibilité `v_products_stock`** : non touchée, aucune référence dans 185.
- **Idempotence de la migration elle-même** : garde-fou par `RAISE EXCEPTION` si `ventes.montant_ht` existe déjà (même patron que 184) — refuse plutôt que de dupliquer silencieusement.

**Découverte faite en écrivant cette migration, pas supposée à l'avance** : `uidx_aer_version` (migration 138) est **UNIQUE sur `(event_type, sequence, rule_version)`** — une même séquence ne peut pas porter deux comptes différents (521 résolu vs 411 statique) selon le mode de paiement. `VTE-001` est donc passée de 4 séquences (prévues dans `C6-IMPLEMENTATION-DESIGN.md`) à **7** (3 comptant + 3 crédit, différenciées par `conditions` sur `metadata.mode_paiement` + 1 coût commune) — documenté en tête de la migration, pas corrigé silencieusement.

**NON EXÉCUTÉE.**

---

## 3. VTE-001

7 séquences (vs 4 prévues initialement — voir §2) :

| Séq | Débit | Crédit | Montant | Condition |
|---|---|---|---|---|
| 1 | `treasury_debit` | 701 | `montant_ht` | `mode_paiement != credit` |
| 2 | `treasury_debit` | 4441 | `montant_tva` | `mode_paiement != credit` ET `montant_tva > 0` |
| 3 | `treasury_debit` | 447 | `montant_ca` | `mode_paiement != credit` ET `montant_ca > 0` |
| 4 | 411 (statique) | 701 | `montant_ht` | `mode_paiement = credit` |
| 5 | 411 | 4441 | `montant_tva` | `mode_paiement = credit` ET `montant_tva > 0` |
| 6 | 411 | 447 | `montant_ca` | `mode_paiement = credit` ET `montant_ca > 0` |
| 7 | 601 | 311 | `metadata.cout_marchandises` | `metadata.cout_marchandises > 0` |

`VTE-002` (règlement crédit, structure FAC-002 réutilisée à l'identique) : 1 séquence, `521(resolver)/411`, `montant_ttc`.

**STK-002 non réutilisée** : vérifié par test statique (§6) — aucune occurrence de `'STK-002'` dans la migration ni dans `app/api/sales/route.ts`.

**`fn_ae_is_income`/`fn_ae_has_treasury_impact` volontairement non modifiées** — ces deux fonctions legacy ne pilotent plus le solde réel de trésorerie depuis la migration 175 (confirmé par lecture directe : `fn_sync_tresorerie_soldes` y est appelée "pour tout événement touchant 5xx", pas selon ces classificateurs). Les y ajouter aurait classé les ventes à crédit (411, aucun impact caisse) comme un encaissement — impossible à distinguer à ce niveau de granularité puisque `VTE-001` couvre les deux modes sous un même event_type. Risque résiduel documenté en §15 : un rapport encore basé sur ces fonctions (pas le solde réel) pourrait ne pas catégoriser les ventes comptant `VTE-001` — pas vérifié, car aucun de ces rapports n'a été identifié par cette mission.

---

## 4. API

4 endpoints (`POST /api/sales`, `GET /api/sales`, `GET /api/sales/:id`, `POST /api/sales/:id/paiement`, `POST /api/sales/:id/reverse`) — tous `requireTenant()`/`requireRole()`, jamais `tenant-guard.ts`, jamais de `tenant_id` lu du client (vérifié par test statique).

Validations serveur implémentées dans `POST /api/sales` : lignes non vides, `qte > 0`, `origine` dans l'ensemble autorisé, `mode_paiement` dans l'ensemble autorisé, `destinataire` obligatoire si crédit, produits et entrepôt vérifiés appartenir au tenant **avant** toute écriture. Prix et coût **toujours lus serveur** (`products.prix_vente`/`prix_achat`) — un `prix` éventuellement envoyé par le client n'est jamais utilisé (durcissement au-delà de ce qui était strictement demandé, cohérent avec la discipline C1-C4).

---

## 5. POS

Modifications minimales (pas de refonte) : un seul `fetch('/api/sales')` remplace les 3 appels directs ; affichage HT/TVA/CA ajouté (calcul client identique à `decomposerTTCUnifie`, recalculé de manière autoritaire côté serveur) ; champ client affiché et requis uniquement si "Crédit" sélectionné, bouton de validation désactivé sinon ; `idempotency_key` générée une fois à l'ouverture du paiement, réutilisée pour tout retry tant que le panier n'est pas vidé.

---

## 6. STOCKS/SORTIES

Seule la branche `type_sortie==='vente'` a été modifiée (`handleCreateVente()`, appelle `/api/sales` avec `mode_paiement:'credit'` fixe — comportement reproduit à l'identique de l'ancien code qui débitait déjà 411 inconditionnellement pour cette branche ; `destinataire`/`warehouse_id` préservés). **Les 5 autres raisons (`consommation`/`transfert`/`perte`/`don`/`usage_interne`) n'ont pas été touchées** — elles restent sur l'ancien code, toujours non fonctionnelles (table `stock_sorties` absente), hors périmètre C6 explicitement confirmé.

---

## 7. PROVENANCE

`fn_stock_move` appelé avec `p_origine`/`p_purchase_item_id` depuis `/api/sales` — **fonctionnera seulement après application de la migration 184** (dépendance runtime, pas SQL, documentée en §2). Choix manuel reproduit à l'identique (aucune déduction automatique, aucun fallback — vérifié par relecture du code : `origine` n'est jamais recalculée, seulement validée contre l'ensemble autorisé). Le serveur délègue la validation "stock disponible pour cette origine" entièrement à `fn_stock_move` (verrou sous transaction) plutôt que de la dupliquer applicativement.

---

## 8. FISCALITÉ

`decomposerTTCUnifie(totalTTC, 'CG')` (`lib/fiscalite/engine-adapter.ts`, déjà le mécanisme utilisé par `BOI-001`) — **aucun taux codé en dur** dans le nouveau code (vérifié par test statique : `0.18`/`0.05`/`0.189`/`0.075` absents du code exécuté). Colonnes persistées : `ventes.montant_ht`/`montant_tva`/`montant_ca` (`total` porte déjà le TTC). Cas TVA=0 : mécanisme déjà prévu dans la règle (condition `montant_tva > 0`) — mais **aucun mécanisme d'exonération produit n'a été câblé** dans cette implémentation (cohérent avec `C6-VENTE-CANONICAL-DESIGN.md §6` : aucune donnée fiable n'existe pour en décider — toute vente POS est aujourd'hui pleinement taxable par construction, pas une omission).

---

## 9. PAIEMENT

`POST /api/sales/:id/paiement` émet `VTE-002` (structure FAC-002, `source_table='ventes'`) — aucun nouveau mécanisme de paiement. Règlement **intégral uniquement** (pas de règlement partiel — aucun écran de recouvrement n'existe, risque déjà documenté en `C6-PRODUCT-DECISIONS.md §11`, non résolu ici).

---

## 10. REVERSE

`POST /api/sales/:id/reverse` : récupère tous les `accounting_events` `processed` pour la vente, extourne `VTE-002` avant `VTE-001` si les deux existent (ordre vérifié par test statique), puis un mouvement `fn_stock_move(type='retour')` par mouvement original retrouvé via `stock_movements.reference = ventes.id`. **Aucun second moteur de reverse créé** — `fn_reverse_accounting_event` réutilisé à l'identique du précédent trouvé dans `app/dashboard/facturation/page.tsx`.

**Limite documentée, pas cachée** : ces appels (extourne(s) puis retours de stock) sont plusieurs requêtes RPC indépendantes, pas une transaction Postgres unique — une défaillance après la première extourne laisse un état partiel (le endpoint le signale en 207, ne masque jamais un échec partiel derrière un succès apparent).

---

## 11. IDEMPOTENCE

`idempotency_key` (UUID, nullable, UNIQUE scopé `(tenant_id, idempotency_key)`) — le serveur **tente l'INSERT directement**, catch la violation `23505`, puis relit et renvoie la vente existante — jamais un `SELECT` préalable non protégé (vérifié par test statique : la vérification du code d'erreur vient textuellement après l'appel `.insert()`, pas avant). Testé par exécution réelle (mockée) : un conflit simulé renvoie bien la vente existante **sans** appeler `fn_stock_move` ni `emit_accounting_event` une seconde fois.

**Limite honnête** : un client qui omet `idempotency_key` (ancien build, bug) reste totalement exposé au double-clic/retry — la colonne nullable n'impose rien rétroactivement. Documenté dans `C6-PREIMPLEMENTATION-GATE.md §6`, non résolu ici par construction (le serveur ne peut pas forcer un client à envoyer une clé qu'il ne connaît pas).

---

## 12. TESTS

| Fichier | Type | Résultat |
|---|---|---|
| `lib/architecture/vente-canonique.test.ts` | Statique (lecture de code/migration) | **25/25 passés** |
| `lib/architecture/sales-route.integration.test.ts` | Intégration mockée (exécution réelle du handler, faux client Supabase) | **8/8 passés** |
| Suite complète | — | **53 fichiers, 1118 tests, 0 échec** (1085 avant cette mission + 33 nouveaux) |

Couverture par rapport aux 26 scénarios demandés (Phase 12) :

| # | Scénario | Couvert par |
|---|---|---|
| 1, 4, 5 | Comptant, TVA normale/zéro (mécanisme) | Intégration mockée (happy path) + statique (condition `montant_tva>0`) |
| 2 | Crédit | Statique (validation destinataire) ; flux complet non exécuté réellement |
| 3 | Paiement crédit | Statique (VTE-002/source_table) ; non exécuté réellement |
| 6 | Centime additionnel | Statique (séquence 3/6, condition) |
| 7 | Stock insuffisant | Intégration mockée (compensation vérifiée) |
| 8, 9 | Origine unique/multiple | Hérité des tests BOI-010 existants (`fn_stock_move` inchangée) — non re-testé spécifiquement à travers `/api/sales` |
| 10 | Origine invalide | Intégration mockée (validation 400) |
| 11, 12, 13, 14 | Tenant/produit/warehouse/client autre tenant | Intégration mockée (produit hors tenant → 403) ; warehouse/client non couverts par un test dédié |
| 15, 16, 17 | Double-clic/retry/concurrence réelle | **NOT_TESTABLE** — mock uniquement, pas de vraie concurrence DB (§14) |
| 18, 19 | Duplicate accounting/stock | Intégration mockée (idempotence) |
| 20, 21, 22 | Reverse (général/comptant/crédit) | Statique uniquement (ordre VTE-002 avant VTE-001) — exécution réelle **NOT_TESTABLE** |
| 23 | prix_achat = 0 | Non testé spécifiquement — la formule (`qte × prix_achat`) gère 0 arithmétiquement sans cas particulier à vérifier séparément |
| 24 | Quantité décimale | Non testé — `qte` est `numeric` en base, aucune contrainte entière trouvée ; non vérifié explicitement |
| 25 | Vente depuis stocks/sorties | Statique (présence de `handleCreateVente`/appel `/api/sales`) — non exécuté réellement |
| 26 | POS (E2E) | **NOT_TESTABLE** — aucun canal E2E/navigateur exécuté dans cette mission |

---

## 13. VALIDATIONS

```
TypeScript (tsc --noEmit)   : PASS (0 erreur)
ESLint (fichiers touchés)    : PASS (0 erreur, 0 warning)
Tests statiques              : PASS (25/25)
Tests intégration (mockés)   : PASS (8/8)
Suite complète                : PASS (1118/1118, 0 régression)
Build complet (npm run build) : NON RE-TENTÉ — échec OOM local déjà documenté
                                 (docs/ORAFORME-ETAT-GLOBAL-2026-10.md §13),
                                 non spécifique à cette mission, non reconfirmé
                                 ni infirmé ici par choix de ne pas répéter un
                                 test long et déjà caractérisé comme non
                                 concluant pour l'environnement Vercel réel
```

Une régression statique réelle a été trouvée et corrigée en cours de route (pas ignorée) : `lib/architecture/schema-contract.test.ts` a détecté `stock_movements.origine`/`purchase_item_id` comme colonnes "inconnues" (migration 184 non appliquée) — corrigé en les ajoutant au registre avec la même convention déjà utilisée pour `warehouses.actif` (migration 183 préparée), pas en affaiblissant le test.

---

## 14. ÉLÉMENTS NON TESTABLES

```
- Exécution réelle des migrations 184 et 185
- Vérification réelle du schéma post-migration (colonnes, règles, index)
- Exécution réelle de fn_ae_execute_event pour VTE-001/VTE-002 (le moteur de
  résolution des conditions/comptes n'a jamais été exercé avec ces 8 règles)
- Un flux comptant réel de bout en bout (vente → stock → VTE-001 → trésorerie)
- Un flux crédit réel de bout en bout (vente → VTE-001/411 → paiement → VTE-002)
- Concurrence réelle (deux requêtes HTTP simultanées, contrainte UNIQUE sous charge réelle)
- Isolation tenant réelle sous RLS (tout test actuel utilise soit un mock,
  soit service_role en amont des autres missions — jamais une session non-
  service_role réelle)
- fn_sync_tresorerie_soldes après une extourne VTE-001/VTE-002
- Comportement réel de fn_stock_move avec p_origine/p_purchase_item_id
  (nécessite 184 appliquée)
```

Toutes ces limites découlent directement de `DB_TRANSACTION_CHANNEL = UNAVAILABLE` (confirmé dans `C6-PREIMPLEMENTATION-GATE.md`, non retesté dans cette mission — aucune nouvelle tentative, conformément à la discipline déjà établie).

---

## 15. RISQUES RESTANTS

| Risque | Sévérité |
|---|---|
| Aucune exécution réelle n'a validé les 8 règles `accounting_event_rules` — la logique de résolution des conditions (`fn_ae_eval_conditions`) a été lue et comprise, pas exercée avec ces données précises | **Élevé** jusqu'à validation réelle |
| Non-atomicité documentée (§10 du design, §10/§12 de ce rapport) — une défaillance partielle reste possible malgré la compensation best-effort | Moyen |
| `fn_ae_is_income`/`fn_ae_has_treasury_impact` non étendues — risque cosmétique sur un rapport legacy non identifié précisément | Faible |
| Pas de règlement partiel de crédit, pas d'écran de recouvrement | Moyen (fonctionnalité, pas sécurité) |
| `destinataire` sans intégrité référentielle (texte libre) | Faible |
| `commerce/analytics/page.tsx` n'a pas été mis à jour pour exploiter `montant_ht`/`montant_tva`/`montant_ca` | Faible, signalé déjà dans `C6-IMPLEMENTATION-DESIGN.md §16` |
| Les 5 raisons non-vente de `stocks/sorties` restent non fonctionnelles | Connu, explicitement hors périmètre |

---

## 16. PROCÉDURE EXACTE DE REPRISE (quand le canal DB revient)

```
1. Démarrer Docker réellement (moteur accessible, pas seulement le processus
   tray) OU rétablir MCP Supabase/Postgres.
2. Appliquer la migration 184 SEULE, sur une base isolée si possible.
   Vérifier : fn_stock_move à 10 paramètres, v_products_stock_par_origine
   existe, v_products_stock inchangée.
3. Appliquer la migration 185. Vérifier les 6 colonnes sur `ventes`, les 7
   lignes VTE-001 + 1 ligne VTE-002 dans accounting_event_rules (requêtes de
   contrôle déjà écrites en pied de migration 185).
4. Test transactionnel (BEGIN/ROLLBACK) : appeler la séquence exacte de
   POST /api/sales manuellement en SQL (insert ventes, insert vente_lignes,
   fn_stock_move, emit_accounting_event) pour un cas comptant taxable —
   vérifier les 4 lignes journal_entries attendues (701/4441/447/601-311),
   puis ROLLBACK.
5. Répéter pour un cas crédit (411 au lieu de 521), puis un règlement VTE-002,
   puis une extourne (ordre VTE-002 avant VTE-001).
6. Rejouer les scénarios 1-26 de la Phase 12 en conditions réelles (pas mockées)
   — en particulier 15-17 (concurrence réelle) et 11-14 (tenant isolation sous
   une session non-service_role réelle, pas seulement le code applicatif).
7. Vérifier fn_sync_tresorerie_soldes après une vente comptant réelle.
8. Seulement après un succès complet et reproductible de 4-7 : déployer le
   code (déjà écrit, cette mission) et appliquer les migrations en production.
```

---

## VERDICT

```
C6_CODE                   = PASS
C6_MIGRATION_PREPARED     = PASS
C6_TESTS                  = PARTIAL
C6_PRODUCTION_VALIDATION  = NOT_TESTABLE
C6_FINAL                  = PARTIAL
```

`C6_CODE = PASS` : tsc/ESLint propres, code écrit pour les 4 endpoints + POS + stocks/sorties(vente), suit tous les mécanismes déjà existants (aucun nouveau moteur fiscal, de paiement ou de reverse), une découverte structurelle (contrainte `uidx_aer_version`) documentée et intégrée plutôt que contournée silencieusement.

`C6_MIGRATION_PREPARED = PASS` : migration 185 écrite, vérifiée ligne à ligne contre les contraintes réelles du moteur (migration 138), idempotente par garde-fou, non exécutée.

`C6_TESTS = PARTIAL` : 33 tests nouveaux, tous passants, dont 8 exécutent réellement le code de la route (pas un simple grep) — mais aucun test n'a touché une vraie base Postgres ; les scénarios de concurrence réelle, d'isolation tenant sous RLS réelle et de reverse réellement exécuté restent non couverts.

`C6_PRODUCTION_VALIDATION = NOT_TESTABLE` : canal DB transactionnel toujours indisponible, non retesté dans cette mission.

`C6_FINAL = PARTIAL` — **jamais `PASS`**, conformément à la règle absolue de la mission : la migration 184 n'est pas réellement exécutée, la nouvelle structure de vente n'est pas vérifiée en base, `VTE-001` n'est pas vérifiée réellement, aucun flux comptant ni crédit réel n'a été testé, l'idempotence concurrente réelle n'a pas été testée, l'isolation tenant réelle (sous RLS, pas service_role) n'a pas été testée. Le code et la migration sont prêts et cohérents avec tout ce qui a été vérifié par lecture directe — leur validation réelle attend la levée du blocage `DB_TRANSACTION_CHANNEL`.

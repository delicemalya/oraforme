# C6-POST-REVIEW-FIX — Correction des 4 anomalies de C6-PRE-PRODUCTION-REVIEW

Mission de correction de code, explicitement autorisée par l'utilisateur à la
suite de `docs/C6-PRE-PRODUCTION-REVIEW.md` (verdicts A1/A2/B1/C1 listés comme
anomalies réelles, non corrigées à l'époque par consigne de cette revue-là).

Règles respectées : migrations 184/185/186 **préparées, non exécutées** ;
aucune donnée production modifiée ; aucun INSERT/UPDATE/DELETE en production ;
aucun commit ; aucun push. Aucun autre problème que les 4 anomalies listées
n'a été retouché.

Fichiers modifiés/créés :
- `supabase/migrations/184_stock_provenance.sql` — amendée (B1, in-place, jamais exécutée).
- `supabase/migrations/186_vente_atomic_et_reverse_idempotent.sql` — nouvelle (A1 + C1).
- `app/api/sales/route.ts` — réécrite pour appeler le point transactionnel unique (A1), ajoute la validation `purchase_item_id` (B1).
- `app/api/sales/[id]/paiement/route.ts` — ajoute la vérification VTE-001 (A2) + idempotence retry.
- `app/api/sales/[id]/reverse/route.ts` — ajoute l'idempotence comptable + stock (C1).
- `lib/architecture/schema-contract.test.ts` — ajoute `stock_movements.reversed_movement_id` (migration 186, préparée).
- `lib/architecture/vente-canonique.test.ts` — tests statiques mis à jour (A1 a changé la structure de route.ts) + nouveaux tests statiques A1/A2/B1/C1.
- `lib/architecture/sales-route.integration.test.ts` — réécrit pour le nouveau flux à un seul appel RPC + tests B1.
- `lib/architecture/sales-paiement.integration.test.ts` — nouveau (A2).
- `lib/architecture/sales-reverse.integration.test.ts` — nouveau (C1).

---

## A1 — Atomicité multi-lignes

**CAUSE =** `app/api/sales/route.ts` orchestrait vente → lignes → `fn_stock_move`×N → `emit_accounting_event` comme 4 appels PostgREST séquentiels, chacun auto-commit. Un échec sur la ligne *k* (stock insuffisant) ne défaisait que `ventes`/`vente_lignes` (compensation applicative) — les mouvements de stock déjà créés pour les lignes 1..k-1 restaient en base, orphelins (`stock_movements.reference` pointant vers une vente supprimée, sans contrainte FK).

**CORRECTION =** Nouvelle fonction PL/pgSQL unique `fn_create_vente_atomique` (migration 186) qui exécute vente + lignes + `fn_stock_move`×N + `emit_accounting_event` comme **un seul appel RPC** — donc une seule transaction Postgres implicite. Toute exception non interceptée (stock insuffisant, origine/`purchase_item_id` invalide, échec comptable — voir A2) annule la totalité : plus de vente partielle, plus de mouvement orphelin. `fn_stock_move` et `emit_accounting_event` sont réutilisées telles quelles (appels de fonction directs, pas de RPC HTTP imbriquée) — **aucun second moteur métier créé**, uniquement l'orchestration manquante. `app/api/sales/route.ts` ne fait plus qu'un seul appel RPC et traduit son résultat (`replay` ou erreur) en réponse HTTP.

Point découvert en écrivant cette correction, documenté dans la migration elle-même : `fn_ae_execute_event` (migration 138) intercepte ses propres exceptions et ne les relance jamais (`EXCEPTION WHEN OTHERS THEN ... RAISE WARNING`) — un échec interne du moteur comptable ne remonte donc **jamais** comme une exception Postgres. `fn_create_vente_atomique` relit donc explicitement `accounting_events.status` après l'appel et lève elle-même une exception si le statut n'est pas `'processed'`, pour que la transaction soit bien annulée dans ce cas. C'est ce même mécanisme de relecture qui corrige A2.

**TEST =**
- Statique (`vente-canonique.test.ts`, bloc "A1") : `route.ts` n'appelle plus directement `fn_stock_move`/`emit_accounting_event` ; `fn_create_vente_atomique` orchestre bien lignes + stock + comptabilité et vérifie explicitement le statut comptable ; garde-fou de signature (DROP avant CREATE) présent pour l'extension `fn_stock_move` à 11 paramètres.
- Mocké (`sales-route.integration.test.ts`) : la route transmet les bons montants/lignes au RPC atomique (vente comptant) ; un `replay:true` renvoyé par le RPC ne déclenche aucun second appel ; une erreur du RPC renvoie 409 sans qu'aucun appel séparé (`ventes`, `fn_stock_move`, `emit_accounting_event`) ne soit fait depuis TypeScript.
- Scénario demandé « 3 lignes, ligne 3 impossible, 0 résidu » : **PARTIELLEMENT PROUVÉ**. La garantie « 0 vente partielle / 0 mouvement de stock persistant / 0 accounting event persistant » est une propriété de la transaction Postgres elle-même (un `RAISE EXCEPTION` non intercepté annule tout ce que la fonction a fait dans l'appelant) — documentée et exploitée, pas inventée. Mais **aucun test mocké ne peut prouver qu'une vraie transaction Postgres annule réellement un INSERT déjà exécuté** : un mock simule la réponse finale de l'appel RPC, il ne simule pas un rollback réel. **NOT_TESTABLE sans canal DB réel** — à exécuter via l'étape 12 bis ajoutée au plan de validation (voir fin de ce document).

**STATUT = CORRIGÉ EN CODE, NON VALIDÉ EN EXÉCUTION RÉELLE.**

---

## A2 — Crédit sans VTE-001 confirmé

**CAUSE =** `app/api/sales/[id]/paiement/route.ts` n'exigeait que `ventes.mode_paiement==='credit'` et `statut_paiement==='du'` avant d'émettre VTE-002 — jamais une vérification que VTE-001 avait réellement atteint `accounting_events.status='processed'`. Cause racine confirmée par lecture de `fn_ae_execute_event` (migration 138) : cette fonction avale ses propres exceptions (voir A1) — `emit_accounting_event` peut donc retourner sans erreur alors que le traitement comptable a échoué en interne (statut `'error'`/`'dead_letter'`), et rien dans l'ancien code ne le détectait.

**CORRECTION =** Avant d'émettre VTE-002, la route relit `accounting_events` (`tenant_id`, `source_table='ventes'`, `source_id`, `event_type='VTE-001'`) et exige `status==='processed'` — sinon 409, règlement refusé, aucune émission. Jamais de confiance dans un statut envoyé par le client (le body de la requête ne contient que `mode_paiement_reel`, rien d'autre n'est lu). Même principe appliqué par symétrie à VTE-002 elle-même : après son émission, relecture de son propre statut avant de passer `ventes.statut_paiement='solde'` — si VTE-002 a échoué en interne, le statut n'est pas mis à jour (409), pas de règlement comptabilisé silencieusement sans effet visible. Idempotence ajoutée : un retry sur une vente déjà `'solde'` renvoie l'état actuel avec `replay:true` (200) plutôt qu'une erreur ou une ré-émission.

**TEST =**
- Statique (`vente-canonique.test.ts`, bloc "A2") : la route relit bien `accounting_events`/`event_type='VTE-001'` et vérifie `status!=='processed'` ; le retry sur `'solde'` est bien traité en `replay:true`.
- Mocké (`sales-paiement.integration.test.ts`, 5 tests) : VTE-001 absent → 409, aucun RPC ; VTE-001 au statut `'error'` → 409, aucun RPC ; VTE-001 `'processed'` → VTE-002 émis et confirmé → 200, `statut_paiement='solde'` ; VTE-002 émise mais non `'processed'` → 409, **aucun UPDATE `ventes` tenté** (vérifié explicitement) ; retry sur vente déjà `'solde'` → 200 `replay:true`, zéro appel supplémentaire.

**STATUT = CORRIGÉ ET TESTÉ (mocké).**

---

## B1 — `purchase_item_id` cross-tenant

**CAUSE =** `purchase_item_id` transmis par le client n'était vérifié contre aucun tenant — ni dans `app/api/sales/route.ts`, ni dans `fn_stock_move` (migration 184). Une ligne d'achat d'un autre tenant, si son UUID était connu ou deviné, était acceptée sans erreur.

**CORRECTION =** Double contrôle, défense en profondeur (même principe déjà appliqué à `origine`) :
- **Côté route** (`app/api/sales/route.ts`) : avant tout appel RPC, les `purchase_item_id` non nuls du panier sont vérifiés par une requête scopée tenant (`purchase_items` joint à `purchases!inner(tenant_id)`, filtrée `eq('purchases.tenant_id', ctx.tid)`) — tout ID absent de ce résultat (autre tenant OU inexistant — volontairement indistinguable, aucune fuite d'information sur l'existence ailleurs) renvoie 403 avant toute écriture.
- **Côté DB** (`fn_stock_move`, amendée dans la migration 184 — toujours non exécutée — et reportée dans la migration 186 pour la nouvelle signature à 11 paramètres) : `IF p_purchase_item_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM purchase_items pi JOIN purchases p ON p.id = pi.purchase_id WHERE pi.id = p_purchase_item_id AND p.tenant_id = p_tenant_id) THEN RAISE EXCEPTION ...` — protège tout appelant de `fn_stock_move`, pas seulement cette route (la fonction est une RPC exposée, appelable indépendamment).

`purchase_item_id` n'a pas été retiré du modèle (la relation reste utile pour la provenance BOI-010) — seule la vérification manquante a été ajoutée.

**TEST =**
- Statique (`vente-canonique.test.ts`, bloc "B1") : la route contient bien la requête `purchase_items`/`purchases.tenant_id` ; les migrations 184 ET 186 contiennent bien le `JOIN purchases`/`WHERE ... tenant_id = p_tenant_id` dans `fn_stock_move`.
- Mocké (`sales-route.integration.test.ts`, bloc "B1") : même tenant → accepté, le flux atteint le RPC atomique ; autre tenant/ID inexistant (même chemin, par construction) → 403, le RPC atomique n'est jamais appelé.
- Scénario « ID inexistant → REFUS » : **testé par le même cas que « autre tenant »** — la requête scopée tenant renvoie `0 ligne` dans les deux cas, ce qui est la propriété de sécurité recherchée (pas une lacune du test).
- Vérification DB réelle de la contrainte dans `fn_stock_move` (un appel RPC direct avec un `purchase_item_id` d'un autre tenant, hors de toute route) : **NOT_TESTABLE sans canal DB réel.**

**STATUT = CORRIGÉ ET TESTÉ (mocké + statique) ; non exécuté contre un Postgres réel.**

---

## C1 — Reverse stock non idempotent

**CAUSE =** `/api/sales/:id/reverse` traitait tous les événements `accounting_events` au statut `'processed'` et tentait `fn_reverse_accounting_event` sur chacun sans vérifier au préalable s'il avait déjà été extourné (bien que `fn_reverse_accounting_event` lève elle-même une exception dans ce cas — traitée à l'époque comme un échec générique, pas un no-op). Côté stock, **aucun mécanisme n'existait du tout** : chaque appel émettait un nouveau `fn_stock_move(type='retour')` par mouvement original trouvé, sans aucune protection contre un second appel — un double reverse aurait recrédité le stock deux fois.

**CORRECTION =** Même patron d'idempotence déjà prouvé dans ce dépôt (`idempotency_key`, migration 185), appliqué aux deux volets :
- **Comptable** : la requête initiale inclut désormais aussi les événements au statut `'reversed'` (`in('status', ['processed','reversed'])`). Ceux déjà `'reversed'` sont classés directement dans `alreadyReversed` sans appeler `fn_reverse_accounting_event` — no-op explicite, pas une tentative suivie d'un échec masqué.
- **Stock** : migration 186 ajoute `stock_movements.reversed_movement_id` (lien vers le mouvement `sortie` original) + une contrainte **UNIQUE partielle** (`idx_stock_movements_reversed_movement ... WHERE reversed_movement_id IS NOT NULL`) — l'autorité d'idempotence, pas une seconde vérification applicative. La route tente toujours l'INSERT (via `fn_stock_move` avec `p_reversed_movement_id = m.id`) et traite un `23505` comme un no-op (`stockDejaRetournes`), jamais comme un échec (`stockEchecs`) — exactement le patron « INSERT d'abord, jamais un SELECT préalable non protégé » déjà établi.

Aucun second système de reverse créé : `fn_reverse_accounting_event` et `fn_stock_move` restent les deux seuls mécanismes, simplement appelés de façon idempotente.

**TEST =**
- Statique (`vente-canonique.test.ts`, bloc "C1") : la route filtre bien sur `'processed'`/`'reversed'`, distingue `ev.status==='reversed'`, transmet `p_reversed_movement_id`, traite `23505` comme non-échec ; la migration 186 contient bien la colonne + l'index UNIQUE partiel.
- Mocké (`sales-reverse.integration.test.ts`, 3 tests) : premier appel → extourne + retour de stock, réponse déterministe (200) ; second appel (VTE-001 déjà `'reversed'`, stock renvoie `23505`) → **200, pas 207**, `alreadyReversed`/`stockDejaRetournes` peuplés, zéro nouvel appel à `fn_reverse_accounting_event` ; une vraie erreur distincte (`42703`, pas `23505`) reste classée en échec (`stockEchecs`, 207) — preuve que le no-op idempotent et un échec réel ne sont pas confondus.
- « Appels concurrents conceptuellement » : la garantie réelle vient de deux contraintes UNIQUE Postgres (`accounting_event_extournes.UNIQUE(original_event_id)`, déjà existante ; `idx_stock_movements_reversed_movement`, nouvelle) — toutes deux atomiques au niveau moteur, donc sûres sous concurrence par construction du mécanisme choisi. **Ceci reste une déduction depuis la documentation de Postgres, pas une exécution réelle — NOT_TESTABLE sans canal DB, non qualifié de "testé".**

**STATUT = CORRIGÉ ET TESTÉ (mocké + statique) ; concurrence réelle non exécutée.**

---

## Validation exécutée

- `npx tsc --noEmit` : **0 erreur.**
- `npx eslint` sur tous les fichiers modifiés/créés : **0 erreur, 0 warning.**
- `npx vitest run` (suite ciblée — 5 fichiers C6) : **73/73 tests passés.**
- `npx vitest run` (suite complète du dépôt) : **1138/1138 tests passés, 55 fichiers** — aucune régression sur le reste de l'application.
- Tout ce qui nécessite PostgreSQL réel (rollback effectif d'une transaction, comportement réel d'une contrainte UNIQUE sous concurrence, exécution réelle de `fn_stock_move`/`fn_create_vente_atomique`/`fn_reverse_accounting_event`) : **NOT_TESTABLE** dans cette session — canal DB toujours indisponible (Docker arrêté, pas de `psql`, MCP Postgres/Supabase en échec de connexion), inchangé depuis `C6-PRE-PRODUCTION-REVIEW.md` §13. Aucun test mocké n'a été présenté comme équivalent à une preuve d'exécution réelle.

## Verdicts

- `C6_POST_REVIEW_CODE = PASS` — les 4 anomalies ont un correctif de code écrit, cohérent avec l'architecture existante (aucun second moteur créé), et vérifié par tsc/eslint/vitest.
- `C6_SECURITY = PASS` — B1 corrigé en deux couches (route + DB) et testé (mocké + statique) ; aucune autre faille de sécurité introduite par les trois autres correctifs (vérifié : A1/A2/C1 ne touchent à aucun point d'isolation tenant existant).
- `C6_ATOMICITY = PARTIAL` — le mécanisme est maintenant une vraie transaction Postgres (plus un try/catch avec compensation), ce qui est la correction structurelle demandée ; mais cette propriété n'a jamais été vérifiée par une exécution réelle (le scénario « 3 lignes, échec ligne 3, 0 résidu » reste NOT_TESTABLE sans canal DB).
- `C6_IDEMPOTENCE = PARTIAL` — A2 et C1 sont corrigées et testées en mocké de façon cohérente ; la garantie finale sous concurrence réelle (les deux contraintes UNIQUE Postgres) reste une déduction documentée, pas une exécution.
- `C6_FINAL = BLOCKED` — **conformément à la règle explicite de cette mission** : même avec les 4 corrections de code complètes et cohérentes, `C6_FINAL` ne peut pas être `PASS` tant que les migrations 184 (amendée), 185 et 186 n'ont pas été exécutées contre un Postgres réel et validées (y compris la contrainte de séquence : 184 → 185 → 186, dans cet ordre, puisque 186 dépend des deux). Le canal DB reste `UNAVAILABLE`.

## Procédure de validation future — complément à C6-PRE-PRODUCTION-REVIEW.md §15

En plus des 14 étapes déjà définies (migrations 184/185, création d'une vente
de test, vérification stock/comptabilité/TVA, crédit+règlement, isolation
tenant, nettoyage), ajouter avant le nettoyage final :

- **12 bis.** Appliquer la migration 186. Créer une vente de test à 3 lignes
  dont la 3e demande une quantité supérieure au stock disponible via
  `fn_create_vente_atomique` directement (pas la route) — vérifier
  `SELECT COUNT(*) FROM ventes/vente_lignes/stock_movements/accounting_events`
  pour cette tentative : attendu 0 partout (preuve réelle de A1).
- **12 ter.** Régler une vente à crédit de test dont le VTE-001 a été forcé en
  échec (ex. en coupant temporairement une règle `accounting_event_rules`
  active) — vérifier que `POST /api/sales/:id/paiement` refuse bien avec 409
  (preuve réelle de A2).
- **12 quater.** Appeler `fn_stock_move` directement (hors route) avec un
  `purchase_item_id` appartenant à un autre tenant de test — vérifier le
  rejet par exception (preuve réelle de B1 côté DB).
- **12 quinquies.** Appeler `POST /api/sales/:id/reverse` deux fois de suite
  sur la même vente de test — vérifier `SELECT COUNT(*) FROM stock_movements
  WHERE type='retour' AND reversed_movement_id=...` égal à 1, pas 2 (preuve
  réelle de C1).

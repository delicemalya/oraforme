# MIGRATION MAP A→Z — ORAFORME

**Date :** 2026-09-01 · **Commit :** `0971c4f` · **Mode :** DIAGNOSTIC — aucun code modifié.
**Document compagnon de** `docs/RESTART-AUDIT-AZ.md`.

---

## RÈGLE DE LECTURE

Ce document ne prescrit **aucune suppression**. Conformément à l'instruction : *« Ne supprimer aucun ancien moteur. »*
Chaque ligne décrit un **chemin actuellement exécuté** et la **cible** vers laquelle il devrait converger.

Trois avertissements avant toute exécution :

1. **La cible est partiellement en panne.** `computeBalance` et `computeGrandLivre` sont atteignables uniquement par deux routes API qui échouent en production (ANO-C09). **Migrer vers elles aujourd'hui casserait des écrans qui fonctionnent.** L'ordre proposé ci-dessous répare la cible avant de brancher les consommateurs.
2. **Aucune migration ne doit précéder la mise en place du CI** (ANO-M01). Sans `tsc --noEmit` + `vitest` en garde de PR, chaque étape est irréversible à l'aveugle.
3. **Aucune migration ne doit précéder la création d'un environnement de recette** (ANO-P03). Aujourd'hui `.env.local` et les tests de certification pointent sur la production.

Légende « TEST EXISTANT » : test qui **échouerait** si la migration cassait le comportement. Un test qui ne couvre pas le chemin n'est pas listé.

---

## 1. COMPTABILITÉ — le chemin le plus critique

| # | OLD PATH | CORE CIBLE | CONSUMERS | RISQUE | TEST EXISTANT | TEST MANQUANT | ORDRE |
|---|---|---|---|---|---|---|---|
| C1 | `lib/compta-sync-client.ts:133-171` `writeComptaEntry()` — écrit `journal_comptable` **puis** `journal_entries`, sans transaction | `supabase.rpc('emit_accounting_event')` | **14 pages** : `tresorerie/{page,banques,caisses,encaissements,decaissements,transferts,validations,remboursements,mobile-money}`, `stocks/{achats,sorties,retours,inventaires}`, `ecole/rh` | **TRÈS ÉLEVÉ** — 20 sites d'appel ; le chemin force `tva: 0` et `ca: 0` (l.143-146), donc la reprise doit **recalculer** la TVA, pas la transposer | `loi-k-unique-writer.test.ts` — mais `compta-sync-client.ts` y est **exempté** (EXM-JE-003) : le test ne protège pas | Test d'équivalence : même opération via `writeComptaEntry` vs `emit_accounting_event` → même solde, même TVA. **Aucun n'existe.** | **5** |
| C2 | `app/dashboard/comptabilite/page.tsx:218-241` — double insert `journal_comptable` + `journal_entries`, 2ᵉ écriture **conditionnelle et non vérifiée** | `emit_accounting_event` | 1 page (saisie manuelle) | ÉLEVÉ — écriture orpheline garantie si les comptes ne sont pas saisis | aucun (`app/dashboard/comptabilite/**` exempté de LOI-K) | Test de partie double : débit = crédit après saisie | **6** |
| C3 | `app/dashboard/comptabilite/balance/page.tsx:49,106-140` — lit `journal_entries` en direct et **réimplémente `computeBalance`** ; redéfinit `interface BalanceLine` l.19 | `GET /api/comptabilite/balance` → `computeBalance` | 1 page | MOYEN — **bloqué par ANO-C09** : la route est cassée 5 mois sur 12 | aucun | Test de la route sur les 12 mois ; test d'équivalence page/route | **3** (après C0) |
| C4 | `app/dashboard/comptabilite/grand-livre/page.tsx:52` — lit `journal_entries` en direct | `GET /api/comptabilite/grand-livre` → `computeGrandLivre` | 1 page | MOYEN — **bloqué par ANO-C09** : la route retourne 400 | aucun | Test de la route ; test d'équivalence | **3** (après C0) |
| C5 | 12 autres pages lisant `journal_entries` en direct : `annexes:83`, `bilan:34`, `centres-couts:60`, `cloture:62`, `flux-tresorerie:40`, `journal:135,314`, `page:133`, `rapports:54`, `rapprochement:51`, `tiers:75`, `tva:57`, `fiscalite/is:77`, `fiscalite/liasse-fiscale:98` | `lib/erp-core/compute/accounting.ts` | 12 pages | MOYEN | aucun | Couverture par page | **9** |
| C6 | `lib/accounting-engine.ts:289` `createJournalEntry()` — INSERT direct, **0 appelant** | `emit_accounting_event` | aucun | FAIBLE — code mort | exempté LOI-K (EXM-JE-002) | — | **12** |
| C7 | `app/dashboard/comptabilite/tva/page.tsx:28-29` et `comptabilite/page.tsx:43` — **redéfinissent localement** `TVA_RATE`, `calcTVA` | `lib/fiscal/universal-tax-engine.ts` `calculerTVA()` | 2 pages | ÉLEVÉ (fiscal) | LOI-L ne détecte pas les constantes intermédiaires | Test : `calcTVA` local ≡ `calculerTVA` | **8** |
| C8 | `mouvements_comptables` — **vue updatable** sur `journal_entries`, non couverte par LOI-K | — (à verrouiller en lecture seule) | 0 code applicatif | FAIBLE aujourd'hui, latent | aucun | Test LOI-K couvrant la vue | **11** |

---

## 2. FISCALITÉ — priorité absolue

| # | OLD PATH | CORE CIBLE | CONSUMERS | RISQUE | TEST EXISTANT | TEST MANQUANT | ORDRE |
|---|---|---|---|---|---|---|---|
| F1 | `lib/declarations/declaration-generale.ts:70` — **TUS 4,5 % (taxe abrogée LF 2026)** | Suppression de la ligne, ou TUS CNSS 3 % | `api/declarations/mensuelle` → PDF DGI ligne 9 | **CRITIQUE — document administratif** | aucun | Test : TUS = 0 dans la déclaration Congo post-LF2026 | **1** |
| F2 | `lib/declarations/cnss-congo.ts:13,97-99` — AF plafonnée à 600 000 au lieu de 1 200 000 | `lib/countries/CG.ts:150-156` (branches AF/AT distinctes) | `api/declarations/cnss/[id]/{pdf,excel}` | **CRITIQUE — sous-déclaration 60 240 F/salarié/mois** | aucun | Test : salarié à 1,5 M → AF = 120 420 F | **1** |
| F3 | `app/api/fiscalite/cnss/pdf/route.ts:157,169,170` — imprime « 5,04 % / 14,36 % » | Libellés issus de `CG.ts` (4 % / branches) | Déclaration CNSS mensuelle | **CRITIQUE — incohérence taux/montant sur document CNSS** | aucun | Test : le taux imprimé ≡ le taux appliqué | **1** |
| F4 | `lib/declarations/patente.ts:7-20` — 10 tranches, min 10 000 F | Trancher avec `fiscalite-congo.ts:178-190` (8 tranches, min 97 500 F) | `api/declarations/patente` + PDF | **CRITIQUE — écart ×13,5** | aucun | Test sur 3 paliers de CA | **1** |
| F5 | `lib/paie/calcul-paie.ts:33-39,104-116` (barème mensuel direct) **vs** `lib/fiscal/congo-calculs.ts:99-124` (barème ÷12) | Un seul moteur, à désigner | `rh/paie/page.tsx` → `bulletins_paie` → déclarations IRPP | **CRITIQUE — écart ≈×50** (900 000 F brut → 4 000 F vs 200 213 F) | `universal-tax-engine.test.ts` couvre un 3ᵉ moteur, pas ces deux-là | Test d'arbitrage : brut 900 000 → montant IRPP unique attendu | **1** |
| F6 | `components/rh/ContratPDF.tsx:240` + `rh/contrats/page.tsx:644,948` — `× 0.0504` | `calculerChargesSociales()` | Contrat de travail (opposable au salarié) | ÉLEVÉ | aucun | Test : CNSS du contrat ≡ CNSS du bulletin | **2** |
| F7 | 12 sites à taux TVA littéral : `btp/chantiers:61,112`, `boisson/tournees:86`, `hotel/payments:74`, `sante/consultations:147`, `sante/facturation:90`, `cabinet/clients/[id]/factures:39`, `dashboard/cabinet/clients/[id]:211,815`, `dashboard/finance:1054,1080,1081`, `components/onboarding/Step1:187`, `api/agents/commercial/analyse:187` | `calculerTVA()` (serveur) ou `usePays().calculerTVA` (UI) | 12 fichiers | ÉLEVÉ — **deux taux coexistent : 18 % et 18,9 %** | LOI-L : **8 de ces 12 sont détectés** (erreurs ESLint réelles), les 4 autres échappent au pattern | Étendre le pattern LOI-L à `0.189`, aux divisions et aux constantes | **2** |
| F8 | `lib/countries/index.ts:59-64` et `lib/fiscalite/pays.ts:702` — **repli silencieux sur CG** pour ML, SN, BF, NE, NG, AO, FR, BE, CH | Erreur explicite `UnsupportedCountryError` | tout le moteur fiscal | ÉLEVÉ | aucun | Test : pays non supporté → exception, jamais CG | **2** |
| F9 | `app/api/fiscalite/cnss/route.ts:48-50` — recalcule pour `pays !== 'CG'` **sans lire `support_declarations_cnss`** | Garde sur le flag ; `TD.ts:172`, `CF.ts:170`, `GQ.ts:170` valent `false` | Déclaration CNSS multi-pays | **CRITIQUE** | aucun | Test : `pays=TD` → refus explicite | **1** |
| F10 | `lib/fiscalite/pays.ts:88-94` — barème IPR RDC obsolète (5 tranches / 30 %) que `fiscalite-rdc.ts:213` interdit | `lib/countries/CD.ts:86-97` (10 tranches / 40 %) | `fiscalite/engine.ts:111` → simulateur IRPP | ÉLEVÉ | aucun | Test de non-régression du barème RDC | **2** |
| F11 | `lib/fiscalite/engine.ts:119-130` et `PaysContext.tsx:24-33` — **barème annuel appliqué à une base mensuelle** (÷12 manquant) pour CM, GA, TD, CF, GQ, CD | division par 12 | simulateur IRPP | ÉLEVÉ | aucun | Test : IRPP mensuel ≈ IRPP annuel / 12 | **2** |
| F12 | `lib/miaa/tools.ts:12,21,25,29` — TVA 0.18 / 0.1925 / 0.16 en dur, mappe GA sur le régime CG | `calculerTVA()` | contexte injecté dans l'assistant IA | MOYEN | aucun | — | **7** |
| F13 | Taux **estimés** : TVA GA et TD, IS et Patente GQ, Patente RCA, barèmes IRPP GA/TD/CF/GQ, SMIG de 5 pays | Confirmation par les DGI, ou désactivation des pays | tout le moteur | ÉLEVÉ — **décision métier, pas technique** | aucun | Champ `data_confidence` bloquant en production | **2** |

---

## 3. PAIE

| # | OLD PATH | CORE CIBLE | CONSUMERS | RISQUE | TEST EXISTANT | TEST MANQUANT | ORDRE |
|---|---|---|---|---|---|---|---|
| P1 | `POST /api/paie/bulletins` — persiste `bulletins_paie` **sans émettre `PAI-001`** ; le trigger `trg_bulletins_paie` a été supprimé (migration 141) | `POST /api/rh/paie` (émet PAI-001, l.118) — **0 appelant aujourd'hui** | `rh/paie/page.tsx:1512,1555` | **CRITIQUE — la paie ne génère plus aucune écriture comptable** | aucun | Test : générer une paie → 1 `accounting_event` PAI-001 | **1** |
| P2 | `app/dashboard/rh/paie/page.tsx:17-21` — IRPP et charges sociales calculés **dans le navigateur**, persistés bruts par `route.ts:26` | Recalcul serveur avant persistance | 1 page | **ÉLEVÉ** — viole CONSTITUTION PARTIE VI ; le client fixe le montant d'impôt | aucun | Test : payload client falsifié → recalculé serveur | **2** |
| P3 | `POST /api/paie/acomptes` (utilisée) — pas de contrôle du statut employé, `created_by` absent, date optionnelle | `POST /api/rh/acomptes` (**0 appelant**) — contrôles présents l.67-69, 88 | `rh/paie/page.tsx:1590` | ÉLEVÉ — acompte possible pour un employé licencié | aucun | Test : employé `licencie` → 400 | **4** |
| P4 | `lib/paie/calcul-paie.ts` (227 l., utilisé, **0 test**) | `lib/payroll/universal-payroll-engine.ts` (1 090 l., **555 l. de tests**, mais **inatteignable en production**) | `api/agents/rh/analyse`, `rh/paie/page.tsx` | ÉLEVÉ — le moteur testé n'est pas celui qui tourne | `universal-payroll-engine.test.ts` teste la **cible**, pas le chemin actif | Test d'équivalence entre les deux moteurs **avant** bascule | **6** |
| P5 | `lib/conventions/**` — 1 677 lignes, **0 importeur applicatif** | brancher ou retirer | aucun | FAIBLE (dormant) | `convention-engine.test.ts` | — | **12** |

---

## 4. TENANT / AUTH

| # | OLD PATH | CORE CIBLE | CONSUMERS | RISQUE | TEST EXISTANT | TEST MANQUANT | ORDRE |
|---|---|---|---|---|---|---|---|
| T1 | `lib/tenant-guard.ts` — `@deprecated` ligne 2 | `lib/api/require-tenant.ts` | **75 fichiers** | ÉLEVÉ — **API incompatibles** : `ctx.tenantId` vs `ctx.tid`. Une erreur d'import compile (typage désactivé) et produit `.eq('tenant_id', undefined)` sur un client service_role | aucun | Test : chaque route renvoie 401 sans session ; test d'isolation croisée | **7** |
| T2 | `app/api/hr/_auth.ts` (16 fichiers) et `app/api/tresorerie/_auth.ts` (9) | `require-tenant.ts` | 25 routes | MOYEN | aucun | idem | **8** |
| T3 | 27 routes avec résolution `getAuth()`/`getProfile()` en ligne | `require-tenant.ts` | 27 routes | MOYEN | aucun | idem | **8** |
| T4 | `app/dashboard/groupe/gestion/page.tsx:169` — `tenants.insert` **côté navigateur**, avec `taille` et `secteur` (colonnes **inexistantes**) | `app/api/admin/groupe` (à créer) | 1 page | ÉLEVÉ — l'INSERT échoue en production | LOI-M : dette déclarée DET-M-001, non bloquante | Test de création d'entité fille | **5** |
| T5 | `app/dashboard/profil/actions.ts:115` et `profil/page.tsx:88` — `tenants.update` direct | route API | 2 fichiers | MOYEN | **LOI-M les détecte** (2 erreurs ESLint réelles) | — | **6** |

---

## 5. ERP CORE — brancher ce qui existe

| # | OLD PATH | CORE CIBLE | CONSUMERS | RISQUE | TEST EXISTANT | TEST MANQUANT | ORDRE |
|---|---|---|---|---|---|---|---|
| E0 | **Réparer la cible avant tout** : `GRAND_LIVRE_SELECT` (`compute/accounting.ts:96`) référence `reference` et `journal_type` — **colonnes inexistantes** (réelle : `reference_piece`) ; `balance/route.ts:38` construit `AAAA-MM-31` | — | — | **BLOQUANT pour C3, C4, E1** | aucun | Test des 2 routes sur 12 mois et sur les colonnes réelles | **0** |
| E1 | 135 pages agrègent avec `reduce()` en local | `lib/erp-core/compute/**` | 135 pages | ÉLEVÉ (volume) | aucun | Test par métrique migrée | **10** |
| E2 | `compute/tresorerie.ts`, `compute/ebitda.ts`, `compute/stock.ts`, `compute/clients.ts` — **0 importeur** | brancher aux pages correspondantes | aucun | FAIBLE — mais ce sont les calculs que les pages refont à la main | aucun | Tests unitaires (aucun n'existe) | **10** |
| E3 | `lib/erp-core/index.ts` — barrel à **0 importeur** ; `lib/erp-core.ts` — fichier frère à 0 importeur, **collision de nom** | choisir l'un des deux | aucun | FAIBLE, latent | aucun | — | **11** |
| E4 | 5 routes API consommant l'ERP Core et **jamais appelées** : `comptabilite/balance`, `comptabilite/grand-livre`, `fiscalite/irpp`, `hotel/payments`, `agents/commercial/analyse` | brancher ou retirer | aucun | MOYEN | aucun | — | **10** |

---

## 6. STOCK

| # | OLD PATH | CORE CIBLE | CONSUMERS | RISQUE | TEST EXISTANT | TEST MANQUANT | ORDRE |
|---|---|---|---|---|---|---|---|
| S1 | `products.stock_actuel` — **colonne inexistante en production**, lue par 14 pages, **recalculée et réécrite** par 3 (`stocks/achats:196`, `sorties:206`, `retours:160`) | Décision préalable : quantité dérivée de `stock_movements`, ou colonne à créer | 14 pages | **CRITIQUE — décision d'architecture, pas migration** | aucun | Test : mouvement → quantité cohérente | **1** (décision) |
| S2 | `stock_movements.quantity` (inexistante) dans 5 pages vs `quantite` (correcte) dans `stocks/page.tsx:66` | `quantite` | 5 pages | ÉLEVÉ | aucun | Test de schéma | **3** |
| S3 | `purchases.total_amount` / `.date` (inexistantes) dans 2 pages vs `montant_total` / `created_at` | colonnes réelles | 2 pages | ÉLEVÉ | aucun | Test de schéma | **3** |
| S4 | `/api/stock/move` — **0 appelant** | brancher | aucun | MOYEN | aucun | — | **9** |
| S5 | `restaurant/inventaire/page.tsx:36,48` appelle `/api/stocks/articles` et `/api/resto/recettes` — **routes inexistantes** | routes réelles | 1 page | ÉLEVÉ — 404 silencieux | aucun | Test : toute route appelée existe | **3** |

---

## 7. SCHÉMA — préalable transverse

| # | OLD PATH | CIBLE | RISQUE | ORDRE |
|---|---|---|---|---|
| D1 | **19 tables référencées et absentes de production** — `facture_lignes`, `contrats`, `contrats_employes`, `error_logs`, `auth_logs`, `policy_history`, `policy_violations`, `primes_employe`, `avantages_nature_employe`, `postes`, `recrutements`, `articles`, `chambres`, `reservations`, `commandes_resto`, `resto_reservations`, `resto_formules`, `resto_formule_items`, `ged_documents` | Pour chacune : créer la table **ou** réécrire le code vers la table réelle | **CRITIQUE** — 7 sont écrites **sans contrôle d'erreur** → perte de données silencieuse | **1** |
| D2 | **6 colonnes fantômes sur `tenants`** : `nom`, `secteur`, `taille`, `forme_juridique`, `capital_social`, `tva_numero` (8 fichiers) | `nom_entreprise`, `secteur_activite`, `taille_entreprise` ; les 3 dernières n'existent pas | ÉLEVÉ — `lib/audit/engine.ts:558` échoue → **l'audit OHADA lève « NIU absent » pour tous les tenants** | **2** |
| D3 | Migrations **157, 158, 159 non appliquées** → aucune journalisation d'authentification en production | Exécuter, ou retirer le code appelant | ÉLEVÉ | **2** |
| D4 | Migration **155 partiellement appliquée** → `tenants.taille_entreprise` **NULLABLE** ; combiné à `feature-access.ts:62` (`if (!taille) return true`), ouvre toutes les fonctionnalités Business | Appliquer `SET NOT NULL` **après** backfill, et aligner `feature-access.ts` sur `plan-access.ts` (fail-closed) | ÉLEVÉ | **2** |
| D5 | **336 événements comptables en `error`** (43,6 %), reprise à l'arrêt, 240 sans message d'erreur | Diagnostiquer les 240, corriger la cause `transactions_source_unique`, rejouer | ÉLEVÉ | **4** |

---

## 8. ORDRE D'EXÉCUTION CONSOLIDÉ

```
PHASE 0 — DÉBLOQUER (aucune ligne de code métier)
  0.1  Créer un projet Supabase de recette ; y basculer .env.local et les tests
  0.2  Committer .github/workflows + playwright.config.ts + tests/e2e/
  0.3  Activer le CI : tsc --noEmit, eslint, vitest en garde de PR
  0.4  DÉCIDER : facture_lignes → table à créer, ou factures.items (jsonb) ?
  0.5  DÉCIDER : products.stock_actuel → colonne, ou dérivé de stock_movements ?
  0.6  DÉCIDER : quel moteur IRPP Congo fait foi ? (écart ×50)
  0.7  DÉCIDER : TVA Congo 18 % ou 18,9 % ?
  0.8  Faire confirmer par les DGI les taux estimés (GA, TD, CF, GQ)

PHASE 1 — DOCUMENTS OPPOSABLES  (F1, F2, F3, F4, F5, F9, P1)
       Rien de ce qui produit une déclaration ne doit rester faux.

PHASE 2 — SÉCURITÉ  (ANO-C01, C05, C06, C07, C04, D1, D2, D3, D4)

PHASE 3 — RÉPARER LA CIBLE  (E0)  puis brancher  (C3, C4, S2, S3, S5)

PHASE 4 — MOTEUR COMPTABLE  (D5, C1, C2, P3)

PHASE 5 — UNIFORMISATION  (T1→T5, P4, C7, F6, F7)

PHASE 6 — DETTE  (E1, E2, E3, E4, C5, C6, C8, S4, P5, F12)
```

---

## 9. CE QUI NE DOIT PAS ÊTRE MIGRÉ

| Élément | Raison |
|---|---|
| `accounting_events` + `emit_accounting_event` | **0 INSERT direct** — le seul invariant d'architecture réellement tenu. C'est la cible, pas une source. |
| `lib/fiscal/universal-tax-engine.ts` | 492 lignes de tests. Point de convergence fiscal. |
| `lib/payroll/universal-payroll-engine.ts` | Inutilisé mais testé sur 555 lignes — **cible de P4**. Ne pas supprimer. |
| Politiques RLS de production | 328 objets sur 329 protégés. Meilleur actif du projet. |
| `.order('created_at').limit(1)` avant `maybeSingle()` sur `profiles` | Correctif multi-tenant. Présent dans `proxy.ts:142`, `tenant-guard.ts`, `require-tenant.ts`. |
| `RefreshOrchestrator.tsx` | Corrige flash et boucle infinie. |
| `requireApiKey()` | SHA-256, `is_active`, `expires_at`. Correct. |
| Les 469 tests existants | Base de non-régression. |

---

*Document de diagnostic. Aucune migration exécutée. Aucun moteur supprimé.*

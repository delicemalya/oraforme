# C6 — FINAL CLOSURE REVIEW

Revue de clôture uniquement. Aucun code modifié, aucune migration créée,
aucune donnée modifiée, aucun commit/push. Ce document synthétise les
preuves déjà produites par `C6-PRE-PRODUCTION-REVIEW.md`,
`C6-POST-REVIEW-FIX.md`, `DB-LOCAL-RECOVERY-01/02.md`,
`DB-LOCAL-C6-HARNESS.md`, `C6-185-FIX-VALIDATION.md` et
`C6-185-CA-FIX-VALIDATION.md` — aucun test n'a été réexécuté pour ce
rapport sauf mention contraire explicite.

## 1. Verdict

**`C6_CLOSABLE_WITH_EXTERNAL_BLOCKERS`**

Le périmètre fonctionnel de C6 (POS vente, provenance de stock,
comptabilisation VTE-001/002, TVA, Centime Additionnel, coût des
marchandises, atomicité, idempotence, isolation tenant côté stock) est
prouvé par PostgreSQL réel. Deux problèmes restent ouverts, tous deux
confirmés transversaux/infrastructurels et antérieurs à C6 — aucun des
deux n'empêche le fonctionnement réel du périmètre C6 lui-même (détail §10/§11).

## 2. Périmètre C6 validé

**Couvert par C6, et validé dans ce document** : POS vente comptant et
crédit ; convergence de `stocks/sorties` (branche `type_sortie='vente'`
uniquement) vers le même point d'entrée ; `ventes`/`vente_lignes` (colonnes
fiscales, idempotence) ; provenance de stock (`achat_fournisseur`/
`production_locale`/`import_direct`, rejet d'origine invalide, rejet de
dépassement par provenance) ; comptabilisation VTE-001 (7 séquences) et
VTE-002 (règlement crédit) ; TVA (4441) ; Centime Additionnel (447) ; coût
des marchandises (601/311) ; paiement comptant/crédit ; atomicité de la
création (vente+lignes+stock+comptabilité comme un seul tout) ;
idempotence de la création ; isolation tenant sur `purchase_item_id` (B1) ;
idempotence du retour de stock à l'annulation (C1, côté stock uniquement).

**NON couvert par C6** (confirmé explicitement, pas par omission) : le
reverse comptable générique (`fn_reverse_accounting_event`, moteur partagé,
migration 138 — antérieur à C6, utilisé PAR C6 mais pas défini par C6) ; la
reconstruction de la chaîne de migrations historique 001-183 ; tout module
métier autre que la vente (pharmacie, restauration, hôtel, etc. — leurs
propres règles comptables ne sont ni modifiées ni revalidées ici) ; toute
nouvelle politique fiscale non déjà spécifiée (aucun taux inventé, chacun
des montants HT/TVA/CA transite tel que calculé par
`decomposerTTCUnifie`, jamais recalculé dans les migrations).

## 3. Preuves PostgreSQL réelles

Toutes obtenues contre `C:\oraforme-c6-harness\` (Postgres 17.11 réel, pas
une base de production, pas un mock) :

| # | Scénario | Résultat réel | Source |
|---|---|---|---|
| 1 | Vente comptant, `montant_ca=712` | `521/447 = 712` présent, avec `521/701`, `521/4441`, `601/311` | `C6-185-CA-FIX-VALIDATION.md` §3, test 1 |
| 2 | Vente, `montant_ca=0` | 0 ligne `447` (`COUNT=0`), autres lignes correctes | idem, test 2 |
| 3 | Vente crédit, `montant_tva=841>0` ET `montant_ca=356>0` | `411/4441=841` ET `411/447=356` simultanément (`COUNT=2`) | idem, test 3 |
| 4 | Coût des marchandises | `601/311` présent dans TOUS les scénarios ci-dessus (10000, 2500, 5000, 1 — proportionnel au paramètre transmis) | `C6-185-FIX-VALIDATION.md` §5 et `C6-185-CA-FIX-VALIDATION.md` §3/§4 |
| 5 | Atomicité (3 lignes, 3e stock insuffisant) | Compteurs `ventes`/`stock_movements`/`accounting_events`/`journal_entries` strictement identiques avant/après (0 résidu), exception réelle `23514` | `C6-185-FIX-VALIDATION.md` §5 + réexécuté sans changement dans `C6-185-CA-FIX-VALIDATION.md` §4 |
| 6 | Idempotence (même `idempotency_key`, 2 appels) | 1er `replay=false` nouveau `vente_id` ; 2e `replay=true` MÊME `vente_id` ; exactement 1 vente / 1 mouvement / 1 événement VTE-001 | idem, §5/§4 |
| 7 | `purchase_item_id` cross-tenant | Rejeté : `42501 — purchase_item_id ... introuvable pour ce tenant`, ET toute la transaction annulée (atomicité+sécurité combinées) | `C6-185-FIX-VALIDATION.md` §5, test D-bis |
| 8 | Reverse stock, 2e tentative sur le même mouvement | Rejeté : `23505 — duplicate key ... idx_stock_movements_reversed_movement`, exactement 1 ligne `retour` après 2 tentatives | idem, §5, test F (partie stock) |

Les 8 points demandés par cette mission sont donc **tous PROUVÉS par
PostgreSQL réel**, pas réaffirmés par confiance ou par les seuls
tsc/eslint/vitest.

## 4. Atomicité

**PROVEN.** `fn_create_vente_atomique` (186) exécute vente, lignes,
mouvements de stock et émission comptable comme une seule transaction
Postgres — toute exception interne (stock insuffisant, `purchase_item_id`
hors tenant, échec comptable) annule la totalité. Confirmé deux fois par
exécution réelle (point 5 et 7 du tableau ci-dessus), avec des causes de
déclenchement différentes (stock vs sécurité), toujours avec 0 résidu.

## 5. Idempotence

**PROVEN pour les appels séquentiels** (point 6). **NOT_PROVEN pour les
appels réellement concurrents** (deux sessions Postgres simultanées) — la
garantie théorique repose sur la contrainte UNIQUE partielle
`idx_ventes_tenant_idempotency` (atomique au niveau moteur Postgres par
construction), mais aucun test de concurrence réelle n'a été exécuté dans
aucune des missions précédentes ni dans celle-ci. Ne pas requalifier en PASS.

## 6. Sécurité / isolation tenant

**PROVEN pour `purchase_item_id`** (point 7, au niveau route ET au niveau
DB dans `fn_stock_move` — défense en profondeur confirmée par exécution
réelle aux deux couches dans les missions précédentes).

**PROVEN au niveau applicatif seulement (mock), PAS au niveau DB, pour
`produit_id`/`warehouse_id`** : `fn_create_vente_atomique` ne vérifie pas
elle-même l'appartenance tenant de `produit_id`/`warehouse_id` — ce
contrôle vit dans `app/api/sales/route.ts` (scope tenant sur `products`
avant tout appel RPC), prouvé par les tests mockés de
`sales-route.integration.test.ts`, jamais réexercé contre PostgreSQL réel
dans ce harness (la fonction SQL fait confiance à son appelant, par
conception, comme documenté dans `C6-PRE-PRODUCTION-REVIEW.md`). **NOT_PROVEN
au niveau DB** — distinction maintenue, pas de confusion de niveau.

## 7. Fiscalité TVA / CA

**PROVEN.** TVA (4441) et Centime Additionnel (447) tous deux confirmés
corrects, indépendamment et simultanément (point 2/3 du tableau). Aucun
taux fiscal codé en dur dans le nouveau code (vérifié statiquement,
`vente-canonique.test.ts`) — tous les montants transitent depuis
`decomposerTTCUnifie` côté application.

## 8. Comptabilité

**PROVEN** pour VTE-001 (7 séquences, comptant et crédit) et VTE-002
(règlement). Chaîne réelle confirmée : `emit_accounting_event` → trigger
`trg_process_accounting_event` → `fn_ae_execute_event` → résolution de
règle → `journal_entries`, avec `accounting_events.status='processed'`
observé à chaque fois (jamais déduit de l'absence d'erreur de l'appel —
point déjà identifié comme piège, explicitement vérifié).

**NOT_PROVEN : le reverse comptable** (annulation d'une vente côté
`journal_entries`) — voir §10.

## 9. Stock / provenance

**PROVEN**, migration 184 testée intégralement contre PostgreSQL réel
(`DB-LOCAL-C6-HARNESS.md` §10) : séparation achat/production (100+100 →
70/80 après ventes 30+20), rejet d'un dépassement par provenance précise
(81 sur 80 disponible), rejet d'une origine invalide, rétrocompatibilité
des appels historiques sans provenance (`p_origine=NULL`),
`v_products_stock_par_origine` correcte. `purchase_item_id` cross-tenant
rejeté au niveau DB (même test, confirmé aussi au niveau 186 avec
rollback complet).

## 10. Analyse du reverse accounting

- **Réellement utilisé par C6 ?** Oui — `app/api/sales/[id]/reverse/route.ts`
  appelle `fn_reverse_accounting_event` pour le volet comptable de
  l'annulation d'une vente.
- **C6 peut-il fonctionner COMPLÈTEMENT sans ce reverse ?** Le flux
  PRINCIPAL de C6 — créer une vente (comptant ou crédit), décrémenter le
  stock avec provenance, comptabiliser TVA/CA/coût, régler un crédit — est
  **entièrement indépendant** du reverse comptable et a été prouvé
  fonctionner de bout en bout sans jamais l'invoquer (§3-9). Seule la
  fonctionnalité d'ANNULATION d'une vente déjà comptabilisée dépend de lui.
- **Le défaut existe-t-il avant C6 ?** Oui, confirmé : il est dans
  `fn_reverse_accounting_event` et `chk_ae_event_type`, tous deux de la
  migration 138 (2026, bien avant 184/185/186). Non introduit, non aggravé
  par C6.
- **Le problème concerne-t-il uniquement VTE ou tous les modules ?** TOUS
  les modules — démonstration : pour n'importe quel `event_type` au format
  `MODULE-NNN` (FAC-001, BOI-001, etc.), `fn_reverse_accounting_event`
  construit `'EXT-' || module || '-' || numéro` (ex. `'EXT-FAC-001'`), qui
  viole structurellement `chk_ae_event_type` (`^[A-Z]{2,10}-[0-9]{3}
  (-[A-Z0-9]+)?$` exige des CHIFFRES immédiatement après le premier groupe
  de lettres — `'EXT-FAC-001'` a des LETTRES juste après `'EXT-'`). Ce
  n'est pas un cas particulier VTE.
- **Existe-t-il déjà un AUTRE mécanisme de reverse utilisé par C6,
  indépendant de celui-ci ?** Oui — le reverse CÔTÉ STOCK (`fn_stock_move`
  avec `p_reversed_movement_id`, migration 186) est un mécanisme
  **entièrement distinct**, propre à C6, qui NE PASSE PAS par
  `accounting_events`/`chk_ae_event_type` — et qui est **PROUVÉ idempotent
  par PostgreSQL réel** (point 8 du tableau). Le volet stock de l'annulation
  fonctionne donc même si le volet comptable échoue.
- **Ce défaut empêche-t-il la clôture fonctionnelle de C6 ?** Non pour le
  cœur du périmètre (création/comptabilisation/paiement de vente). Oui pour
  une fonctionnalité secondaire (annulation comptable complète d'une vente)
  — à documenter comme limite connue, pas comme un échec de C6.

**Classification : `TRANSVERSAL_OUT_OF_SCOPE`.**

### Ticket recommandé — ACCOUNTING-REVERSE-001

- **Root cause** : `fn_reverse_accounting_event` (migration 138) construit
  un `event_type` d'extourne (`'EXT-' || module || '-' || numéro`) qui ne
  respecte jamais `chk_ae_event_type` (même migration), pour aucun module.
- **Impact** : aucune extourne comptable (`fn_reverse_accounting_event`)
  ne peut actuellement réussir, pour aucun `event_type` du système.
- **Modules potentiellement concernés** : tous ceux qui émettent des
  événements comptables et pourraient un jour être annulés — FAC, BOI,
  RES, SAN, HOT, ONG, BTP, AGR, PAI, VTE (C6) et tout futur module.
- **Tests nécessaires** : un appel réel à `fn_reverse_accounting_event` sur
  un événement `processed` de CHAQUE famille (pas seulement VTE), confirmant
  soit l'échec généralisé (attendu avant correctif), soit le succès après
  correctif.
- **Risque** : faible à court terme (aucune fonctionnalité de production
  actuellement connue ne dépend d'un reverse qui marche, puisqu'il n'a
  jamais marché) ; élevé si une fonctionnalité d'annulation devient
  critique pour un module (ex. C6 lui-même, pour l'annulation de vente).
- **Priorité** : moyenne — pas bloquant aujourd'hui, mais latent et
  transversal ; à traiter avant que toute fonctionnalité d'annulation ne
  soit mise en avant dans l'UI.

## 11. Analyse de la chaîne historique

- **C6 nécessite-t-il la reconstruction complète de la chaîne historique ?**
  Non. 184/185/186 ont été validées contre un harness CIBLÉ (socle minimal
  sourcé, pas un replay 001→183) — c'est un choix de méthode explicite et
  documenté (`DB-LOCAL-C6-HARNESS.md` §1/§2), pas un contournement caché.
- **184/185/186 sont-elles elles-mêmes cohérentes ?** Oui, confirmé : les 3
  s'appliquent sans erreur dans l'ordre 184→185→186 contre le harness, et
  chacune produit le comportement attendu une fois les deux défauts
  propres à 185 corrigés (`debit_account` NOT NULL, puis `metadata.ca`).
- **Ont-elles été validées sur PostgreSQL réel via le harness ?** Oui — §3.
- **Le problème historique empêche-t-il la validation fonctionnelle de
  C6 ?** Non, précisément parce que le harness ciblé a permis de
  contourner la reconstruction complète tout en restant fidèle (chaque
  objet du socle synthétique est sourcé : migration exacte, ou
  introspection production en lecture seule, documenté objet par objet
  dans `001_c6_baseline.sql`).
- **Est-ce uniquement un problème de reproductibilité/environnement ?**
  Oui — les défauts de la chaîne historique (`fiches_paie` inexistante,
  `candidatures`/`fiscal_declarations`/`etudiants.email` non tracées par
  migration, 2 fichiers au nommage non conforme au CLI) sont tous
  antérieurs à C6 et n'affectent QUE la capacité à rejouer 001→183 depuis
  zéro dans un environnement neuf — pas le fonctionnement de 184/185/186
  elles-mêmes, ni celui de la production actuelle (où ces objets existent
  déjà, créés hors migration).

**Classification : `MIGRATION_INFRASTRUCTURE`.**

## 12. Régressions

Consigne respectée : pas de campagne générale relancée, réutilisation des
preuves déjà produites.

- **Aucune règle `accounting_event_rules` de FAC/BOI/STK/RES/SAN/HOT/BTP/
  ACH/PAI n'est modifiée ou supprimée par 185** : **PROVEN**, statiquement
  — `lib/architecture/vente-canonique.test.ts` contient un test dédié
  (`aucune séquence ne modifie ou ne supprime une règle existante`) qui
  grep `UPDATE`/`DELETE FROM accounting_event_rules ... event_type =
  '(FAC|BOI|STK)'` dans 185 : 0 occurrence. STK-002 spécifiquement jamais
  réutilisée comme identité (test dédié séparé).
- **`fn_stock_move` reste rétrocompatible pour tout appelant existant
  (8 paramètres)** : **PROVEN par PostgreSQL réel**
  (`DB-LOCAL-C6-HARNESS.md` §10, test 8 : appel historique sans provenance
  → succès, mouvement enregistré avec `origine=NULL`).
- **`fn_ae_execute_event`/`emit_accounting_event` ne sont pas modifiées par
  184/185/186** (confirmé par lecture : aucun `CREATE OR REPLACE` de ces
  fonctions dans ces 3 fichiers — la dernière modification date de la
  migration 175, antérieure à C6). Aucun mécanisme partagé par FAC/BOI/etc.
  n'a donc pu être altéré par C6.
- **Comportement RÉEL (PostgreSQL) de FAC-001/BOI-001/RES-001/etc. après
  l'introduction de 184/185/186** : **`NOT_PROVEN`** — le harness C6 est un
  socle synthétique qui ne contient PAS les règles de ces modules
  (définies dans les migrations 139-182, non répliquées dans le harness,
  hors périmètre). Aucun test PostgreSQL réel de CES modules spécifiques
  n'a été exécuté dans aucune mission de cet engagement C6. La preuve
  disponible (absence de modification de leur code/règles) est statique,
  pas comportementale — **marqué `NOT_PROVEN`, jamais requalifié en PASS**.
- **`app/dashboard/stocks/sorties/page.tsx`, 5 raisons de sortie autres que
  `vente`** : **PROVEN** statiquement (test dédié confirmant que
  `['perte', 'don'].includes(form.type_sortie)` et le code historique
  restent intacts, la nouvelle branche `vente` ne fait que s'insérer avant).
- **Suite de tests complète (1141 tests, incluant tout test existant pour
  d'autres modules s'il y en a dans ce dépôt)** : verte au moment de la
  dernière mission (`C6-185-CA-FIX-VALIDATION.md`) — preuve de
  non-régression **au niveau TypeScript/mocké uniquement**, explicitement
  PAS une preuve PostgreSQL réelle pour ces modules (cf. point précédent).

## 13. Problèmes classifiés hors C6

| Problème | Classification |
|---|---|
| `fn_reverse_accounting_event` / `chk_ae_event_type` (migration 138) | `TRANSVERSAL_OUT_OF_SCOPE` |
| Chaîne de migrations historique 001-183 non rejouable depuis zéro | `MIGRATION_INFRASTRUCTURE` |
| `142.5_fix_fn_ae_execute_event_country.sql` nommage non conforme CLI | `MIGRATION_INFRASTRUCTURE` (contenu déjà intégré au harness C6, voir `DB-LOCAL-C6-HARNESS.md` §7 — sans impact sur C6 lui-même) |
| `CATCHUP_008_to_025.sql` nommage non conforme CLI | `MIGRATION_INFRASTRUCTURE` (confirmé non requis pour C6, `CATCHUP_REQUIRED_FOR_C6=NO`) |
| `031_financial_triggers.sql`/`032` référencent `fiches_paie` inexistante | `MIGRATION_INFRASTRUCTURE` (paie, aucun rapport avec C6) |
| `068`/`164` référencent des tables réelles non tracées par migration | `MIGRATION_INFRASTRUCTURE` (RH/fiscal, aucun rapport avec C6) |
| Comportement réel de FAC/BOI/RES/SAN/HOT/BTP/ACH/PAI non re-testé sur Postgres après C6 | `DOCUMENTATION_ONLY` (preuve statique suffisante pour conclure "non modifié", mais preuve comportementale absente — noté, pas un blocage) |
| Idempotence sous concurrence réelle (VTE) | `DOCUMENTATION_ONLY` (mécanisme structurellement sûr par construction — contrainte UNIQUE Postgres — mais jamais exécuté sous charge réelle) |
| Isolation tenant `produit_id`/`warehouse_id` au niveau DB (vs applicatif) | `NO_BLOCKER` (design assumé et documenté : la fonction SQL fait confiance à son appelant déjà tenant-scopé, comme toutes les autres RPC du dépôt) |

Aucun des problèmes listés n'est classé `C6_BLOCKER`.

## 14. Tickets externes recommandés

1. **ACCOUNTING-REVERSE-001** (détaillé §10) — priorité moyenne, transversal.
2. **MIGRATION-CHAIN-REPAIR** (déjà esquissé dans
   `TECH-DEBT-MIGRATION-CHAIN.md`) — tracer `candidatures`,
   `fiscal_declarations`, `etudiants.email`, corriger `fiches_paie`→
   `bulletins_paie` dans 031/032, renommer `142.5`/`CATCHUP_008_to_025` avec
   un préfixe numérique valide. Priorité basse (n'affecte que la
   reproductibilité locale, pas la production actuelle).

## 15. Verdict final

```
C6_CLOSURE_VERDICT=C6_CLOSABLE_WITH_EXTERNAL_BLOCKERS
C6_FUNCTIONAL_STATUS=PROVEN (création vente comptant/crédit, provenance stock, TVA, Centime Additionnel, coût marchandises, atomicité, idempotence création, sécurité purchase_item_id, idempotence reverse-stock — tous confirmés par PostgreSQL réel). NOT_PROVEN (concurrence réelle sur idempotence ; comportement réel post-C6 des autres modules comptables ; isolation tenant produit/entrepôt au niveau DB — par design, compensée au niveau applicatif prouvé par mock).
C6_EXTERNAL_BLOCKERS=ACCOUNTING-REVERSE-001 (TRANSVERSAL_OUT_OF_SCOPE, migration 138, pré-existant) ; chaîne de migrations historique 001-183 (MIGRATION_INFRASTRUCTURE, pré-existant)
C6_REMAINING_ACTIONS=Aucune action requise pour clôturer C6 sur son périmètre fonctionnel propre. Documenter la limite connue "annulation comptable de vente non fonctionnelle" dans toute UI qui exposerait un bouton d'annulation, jusqu'à résolution de ACCOUNTING-REVERSE-001.
NEXT_RECOMMENDED_MISSION=ACCOUNTING-REVERSE-001 (correction de fn_reverse_accounting_event/chk_ae_event_type, portée transversale, hors C6) — à planifier séparément, sans urgence pour C6 lui-même.
```

## 16. Ce qui doit être fait ensuite

- **Pour C6 lui-même** : rien de bloquant. Le périmètre fonctionnel est
  prouvé. Si une UI d'annulation de vente est un jour exposée aux
  utilisateurs, la bloquer ou l'avertir tant que
  `ACCOUNTING-REVERSE-001` n'est pas résolu (le volet stock de
  l'annulation fonctionne déjà seul, mais sans la contrepartie comptable
  cela laisserait les `journal_entries` incohérentes avec le stock réel).
- **Hors C6** : traiter `ACCOUNTING-REVERSE-001` et
  `MIGRATION-CHAIN-REPAIR` comme des missions indépendantes, chacune
  nécessitant sa propre autorisation explicite de modification de code/
  migration — ni l'une ni l'autre n'a été corrigée par cette revue ni par
  aucune des missions C6 précédentes.
- **Avant toute exécution en production** : 184/185/186 restent
  "préparées, non exécutées" — leur validation ici est contre un harness
  local ciblé, jamais contre la production elle-même (canal transactionnel
  toujours indisponible, `DB-CHANNEL-RECOVERY-CHECK.md`). Une exécution
  réelle en production nécessiterait une mission dédiée, avec son propre
  plan de validation (déjà esquissé dans `C6-PRE-PRODUCTION-REVIEW.md` §15
  et `C6-POST-REVIEW-FIX.md`).

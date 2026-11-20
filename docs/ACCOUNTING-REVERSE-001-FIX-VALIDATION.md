# ACCOUNTING-REVERSE-001 FIX VALIDATION

Mission de correction, explicitement autorisée par
`docs/ACCOUNTING-REVERSE-001-IMPACT-AUDIT.md`
(`REVERSE_IMPACT_AUDIT=READY_FOR_FIX`). Aucune donnée production modifiée,
aucun commit, aucun push. Migration 138 (historique, déjà appliquée) non
éditée — correctif livré en `CREATE OR REPLACE` dans une nouvelle
migration 187, même patron que 142.5/175 pour `fn_ae_execute_event`.

## Root cause

`fn_reverse_accounting_event` (migration 138) construisait l'`event_type`
d'une extourne par `'EXT-' || event_module || '-' || split_part(event_type,
'-', 2)` (ex. `'EXT-VTE-001'`, `'EXT-FAC-001'`) — une chaîne qui viole
structurellement `chk_ae_event_type` (`^[A-Z]{2,10}-[0-9]{3}(-[A-Z0-9]+)?$`,
qui exige des chiffres immédiatement après le premier groupe de lettres),
pour TOUT module, pas seulement VTE. Confirmé avant toute correction par
relecture complète de 138 (`fn_reverse_accounting_event`,
`chk_ae_event_type`, `accounting_events`, `accounting_event_rules`,
`fn_ae_execute_event`, `fn_ae_resolve_montant`) et par l'inventaire complet
des appelants (`docs/ACCOUNTING-REVERSE-001-IMPACT-AUDIT.md`).

**Structure déjà en place, réutilisée sans aucun ajout** (vérifié avant
d'écrire une seule ligne de correctif, pas supposé) : la relation
original→extourne est déjà entièrement portée par
`accounting_events.correction_of` (sur l'extourne), `accounting_events.
reversed_by` (sur l'original), et `accounting_event_extournes.
original_event_id` (`UNIQUE`, garde-fou d'idempotence). Aucune nouvelle
colonne créée — confirmé explicitement par test statique (§ci-dessous).

## Chosen correction

**Option B de l'audit** : remplacer la construction par
`v_event.event_type || '-EXT'` (ex. `'VTE-001-EXT'`, `'FAC-001-EXT'`).

Vérifié contre le motif existant AVANT d'écrire le correctif, caractère
par caractère : `[A-Z]{2,10}`=`'VTE'`, `-`, `[0-9]{3}`=`'001'`, groupe
optionnel `(-[A-Z0-9]+)?`=`'-EXT'` — conforme, **sans modifier
`chk_ae_event_type`**.

## Why this correction

- **Pas l'option A (relâcher la contrainte)** : aurait fonctionné, mais
  aurait modifié une contrainte qui, elle, n'a aucun défaut propre — elle
  fait exactement ce qu'elle doit faire. Relâcher une contrainte saine pour
  accommoder un appelant fautif n'est pas la modification minimale.
- **Pas l'option C (les deux)** : aucune valeur ajoutée une fois B choisie
  seule — B suffit, sans toucher `chk_ae_event_type` du tout.
- **Aucune collision avec un event_type métier** : recherche exhaustive des
  54 `event_type` définis dans `accounting_event_rules` à travers toutes
  les migrations — aucun n'utilise de 3ᵉ segment, donc aucun ne se termine
  par `-EXT`.
- **Générique, sans branche par module** : la même ligne fonctionne pour
  FAC-001, FAC-002, VTE-001, VTE-002, et les 50 autres event_type du
  dépôt — vérifié par exécution réelle sur les quatre premiers, démonstration
  structurelle (indépendante du nom du module) pour le reste.

## Migration

`supabase/migrations/187_fix_accounting_reverse_event_type.sql` — nouvelle,
numérotée après 186, `CREATE OR REPLACE FUNCTION fn_reverse_accounting_event`
avec UNE seule ligne modifiée. Migration 138 non éditée (historique, déjà
appliquée — règle respectée explicitement). Rollback documenté en fin de
fichier (réappliquer le corps original de 138, jamais recommandé car cela
réintroduit un reverse qui ne fonctionne pour aucun event_type). Idempotente
par construction (`CREATE OR REPLACE`, pas de `CREATE TABLE`/`ALTER TABLE`).

## Caller error handling

`app/dashboard/facturation/page.tsx` :
- `reverseFactureEvents()` retourne maintenant `{ ok: boolean; error?:
  string }` au lieu de `void` — l'erreur de `fn_reverse_accounting_event`
  est lue (`const { error } = await supabase.rpc(...)`) et propagée dès le
  premier échec.
- `del(id)` vérifie `reversed.ok` **avant** de supprimer la facture : en
  cas d'échec, affiche `showToast('Extourne comptable échouée, facture NON
  supprimée : ...')` et **retourne sans supprimer** — plus d'état
  incohérent laissé volontairement (une facture supprimée dont
  l'accounting_events resterait orphelin).
- Aucune refonte UI : les deux fonctions gardent leur signature/usage
  (sauf le type de retour de `reverseFactureEvents`), le patron
  `showToast(...)` déjà utilisé partout ailleurs dans ce fichier est repris
  à l'identique.

## PostgreSQL tests

Harness repris sans reconstruction (`C:\oraforme-c6-harness\`, 184/185/186
déjà en place et inchangées) — migrations `139_accounting_rules_
facturation.sql` (copiée verbatim, pour disposer de vraies règles FAC-001/
002 et tester le reverse sur un module autre que VTE) et `187_fix_
accounting_reverse_event_type.sql` ajoutées. Deux lacunes du socle
découvertes en appliquant 139 (garde-fou `accounting_schema_versions`,
`DROP TRIGGER ... ON factures` exigeant que la table existe) — corrigées
dans le socle du harness lui-même (`001_c6_baseline.sql`, table minimale
`factures(id)` + `accounting_schema_versions`), **jamais dans les
migrations réelles**. `supabase db reset` : les 6 migrations s'appliquent
sans erreur.

| # | Test | Résultat réel |
|---|---|---|
| 1 | Reverse FAC-001 | **PASS** — `event_type='FAC-001-EXT'`, `status='processed'`, original passé à `'reversed'` |
| 2 | Reverse FAC-002 | **PASS** — `event_type='FAC-002-EXT'`, `status='processed'` |
| 3 | Reverse VTE-001 | **PASS** — `event_type='VTE-001-EXT'`, `status='processed'`, original `'reversed'` |
| 4 | Reverse VTE-002 | **PASS** — `event_type='VTE-002-EXT'`, `status='processed'` |
| 5 | Idempotence | **PASS** — 2ᵉ extourne du même événement original rejetée (`statut reversed — seul 'processed' peut être extourné`) |
| 6 | `event_type` respecte `chk_ae_event_type` | **PASS** — vérifié par évaluation directe de la regex sur les 4 lignes `-EXT` ET sur l'ensemble des 9 lignes `accounting_events` du run (`respecte_contrainte = t` partout) |
| 7 | `journal_entries` inversées correctement | **PASS** — FAC-001 : `411/706→706/411` (100000), `411/4441→4441/411` (18000), `411/447→447/411` (4500) ; débit/crédit swap exact, montant identique |
| 8 | Aucun reverse en double | **PASS** — `journal_entries` (7) et `accounting_event_extournes` (1) strictement identiques avant/après la 2ᵉ tentative |
| 9 | Original/extourne identifiables | **PASS** — `accounting_events.correction_of` ET `metadata->>'original_event_id'` pointent tous deux vers l'original, cohérents entre eux |
| 10 | Un `event_type` métier normal fonctionne toujours | **PASS** — FAC-001, FAC-002, VTE-001 (comptant), VTE-001 (crédit), VTE-002 émis normalement, tous `status='processed'`, AVANT toute extourne |

## Idempotence

Prouvée par exécution réelle (test 5/8 ci-dessus) : le garde-fou déjà
existant (`IF EXISTS (SELECT 1 FROM accounting_event_extournes WHERE
original_event_id = p_event_id)`) reste inchangé — une 2ᵉ tentative sur un
événement DÉJÀ extourné (`status='reversed'`) est en réalité interceptée
une étape plus tôt, par le contrôle de statut (`IF v_event.status !=
'processed'`), lui aussi inchangé — les deux garde-fous pré-existants
suffisent, aucun nouveau mécanisme créé.

## Journal entries

Vérifiées réellement inversées (test 7) : débit et crédit échangés, montant
identique à la ligne originale, libellé préfixé `'EXTOURNE — '`, `source`
préfixé `'extourne_'` — comportement de `fn_reverse_accounting_event`
totalement inchangé par ce correctif (seule la ligne de construction de
l'`event_type` de l'ÉVÉNEMENT d'extourne a changé, jamais la logique
d'inversion des écritures elle-même).

## Non-regression

- **`emit_accounting_event` normal** : PASS (test 10).
- **FAC normal** : PASS (test 10, FAC-001/002 émis et `processed` avant
  toute extourne).
- **VTE normal** : PASS (test 10, VTE-001 comptant et crédit, VTE-002).
- **Reverse stock C6 (`fn_stock_move`/`reversed_movement_id`)** :
  **PASS, retesté réellement** — 1ᵉʳ retour accepté, 2ᵉ retour sur le même
  mouvement rejeté (`23505`, même contrainte `idx_stock_movements_
  reversed_movement` qu'avant ce correctif) : aucun changement de
  comportement, mécanisme totalement indépendant confirmé inchangé.
- **184/185/186** : fichiers non modifiés (vérifié par `diff` implicite —
  copiés une seule fois dans le harness, jamais réécrits pendant cette
  mission) ; comportement déjà revalidé ci-dessus (test 10, provenance de
  stock non retestée séparément ici car hors du changement apporté — déjà
  prouvée dans les missions précédentes, non affectée par cette migration).
- **TVA/CA** : inchangés — les montants `journal_entries` de FAC-001/
  VTE-001 (706/4441/447, 601/311 implicite via les missions précédentes)
  proviennent des mêmes règles `accounting_event_rules`, non touchées par
  la migration 187.
- **Idempotence normale (création de vente, `idempotency_key`)** : non
  retestée dans cette mission (hors périmètre du changement — `fn_create_
  vente_atomique` n'est pas modifiée), confirmée fonctionner normalement
  par les ventes créées pour les tests 3/4 (comportement implicitement
  observé, pas une preuve dédiée dans cette mission précise).
- **Aucun problème hors périmètre découvert** pendant cette mission — rien
  à documenter en STOP. Les deux lacunes du harness (`accounting_schema_
  versions`, `factures` minimale) sont des lacunes du SOCLE SYNTHÉTIQUE du
  harness, pas des découvertes sur du code/des migrations réelles.

## Production impact

**Aucune écriture production.** Seules des lectures en lecture seule
avaient été faites lors de l'audit précédent (confirmées non répétées
inutilement ici, conformément à la consigne). Cette mission n'a exécuté
aucune requête contre la production — tout le travail de validation s'est
fait contre le harness local.

## Remaining risks

- Migration 187 reste, comme 184/185/186 avant elle, **préparée, non
  exécutée en production**. Son exécution réelle nécessiterait une mission
  dédiée avec autorisation explicite, suivant le même plan de validation
  que celui déjà établi pour C6 (vérification du canal, exécution
  contrôlée, contrôle post-exécution — les requêtes `CONTRÔLE` déjà
  écrites dans le fichier de migration).
- Le correctif a été testé pour FAC et VTE (les deux seuls modules avec un
  appelant réel) et démontré structurellement généralisable aux 50 autres
  `event_type` — mais ces 50 autres n'ont pas chacun été extournés
  individuellement contre PostgreSQL réel (aucun n'a d'appelant réel
  aujourd'hui, donc aucun risque pratique immédiat, mais une vérification
  exhaustive future reste possible si un nouveau module acquiert un
  appelant de reverse).
- `app/dashboard/facturation/page.tsx::del()` n'a pas été testé en conditions
  réelles contre une facture ayant un événement `FAC-001`/`FAC-002`
  `processed` (aucune n'existe en production aujourd'hui, confirmé par
  l'audit) — le comportement correct du caller corrigé repose sur la preuve
  Postgres du §PostgreSQL tests (la fonction RPC elle-même fonctionne) et
  sur une relecture du code TypeScript (pas un test end-to-end réel de
  cette page précise, hors périmètre des outils disponibles dans cette
  session — pas un navigateur).

---

## Final verdict

```
ACCOUNTING_REVERSE_FIX=PASS
POSTGRES_REAL_VALIDATION=PASS — 10/10 tests réels contre PostgreSQL 17 (harness C6 repris), FAC-001/002 et VTE-001/002 tous reverses avec succès, event_type conforme à chk_ae_event_type dans tous les cas, journal_entries correctement inversées, aucun doublon.
IDEMPOTENCE=PASS — 2e extourne du même événement rejetée, aucun effet supplémentaire (journal_entries et accounting_event_extournes inchangés).
CALLER_ERROR_HANDLING=FIXED — app/dashboard/facturation/page.tsx ne masque plus l'erreur de reverse ; suppression de facture bloquée et utilisateur informé en cas d'échec.
C6_NON_REGRESSION=PASS — reverse stock (fn_stock_move/reversed_movement_id) retesté réellement et inchangé ; 184/185/186 non modifiées ; VTE-001/002 normal et reverse fonctionnent.
PRODUCTION_DATA_MODIFIED=NO
NEXT_RECOMMENDED_MISSION=Exécution contrôlée de la migration 187 contre un environnement réel (recette ou production, avec autorisation explicite dédiée), suivie d'une revalidation post-exécution avec les requêtes CONTRÔLE déjà écrites dans le fichier de migration — jamais exécutée dans le cadre de cette mission.
```

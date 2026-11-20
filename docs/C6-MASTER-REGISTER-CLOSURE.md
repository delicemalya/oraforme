# C6 MASTER REGISTER CLOSURE

Mission documentaire uniquement. Aucun code, migration ou donnée modifiés.
Seul fichier modifié : `docs/MASTER-REPAIR-REGISTER.md` (registre maître
canonique, identifié à l'étape 1 — aucun autre registre ne l'a remplacé,
confirmé par recherche exhaustive).

## C6 status

`C6-VENTE-CANONIQUE` ajouté à la Table 4 du registre maître avec le statut
**`CLOSED_WITH_EXTERNAL_BLOCKERS`** — nouveau statut, ajouté à la liste des
statuts autorisés du registre (ligne d'en-tête) avec sa définition exacte,
puisqu'aucun des statuts existants (`CLOSED`, `VERIFIED`, etc.) ne portait la
nuance "fonctionnellement complet mais bloquants externes restants" que
cette mission demandait explicitement de préserver.

## Evidence

Citée dans la nouvelle entrée du registre, sans aucune donnée réexaminée :
`docs/C6-PRE-PRODUCTION-REVIEW.md`, `docs/C6-POST-REVIEW-FIX.md`,
`docs/DB-LOCAL-RECOVERY-01.md`, `docs/DB-LOCAL-RECOVERY-02.md`,
`docs/DB-LOCAL-C6-HARNESS.md`, `docs/C6-185-FIX-VALIDATION.md`,
`docs/C6-185-CA-FIX-VALIDATION.md`, `docs/C6-FINAL-CLOSURE-REVIEW.md`.
Résumé inscrit dans le registre : vente canonique validée, PostgreSQL réel
validé, TVA validée, Centime Additionnel validé, comptant/crédit validés,
coût des marchandises validé, provenance validée, atomicité validée,
idempotence validée, rejet cross-tenant validé, idempotence du reverse
côté stock validée.

## External blockers

Deux bloquants, documentés séparément, **non rattachés à un statut FAILED
de C6** :

1. **`ACCOUNTING-REVERSE-001`** — nouvelle entrée Table 4, statut `OPEN`,
   classification `TRANSVERSAL_OUT_OF_SCOPE`. Défaut de
   `fn_reverse_accounting_event`/`chk_ae_event_type` (migration 138,
   antérieure à C6, touche tous les modules).
2. **Chaîne de migrations historique 001-183** — ticket déjà existant
   `R006-MIGRATION-PHANTOM-TABLES` (Table 4, statut `OPEN — BLOCKED`,
   **inchangé**), enrichi (pas remplacé) avec les découvertes de cette
   mission C6 (`fiches_paie`, `etudiants.email`, nommage `142.5`/`CATCHUP`),
   sourcé vers `docs/TECH-DEBT-MIGRATION-CHAIN.md`,
   `docs/DB-LOCAL-RECOVERY-01.md`, `docs/DB-LOCAL-RECOVERY-02.md`.
   Classification confirmée : `MIGRATION_INFRASTRUCTURE`.

## NOT_PROVEN items

Explicitement conservés comme `NOT_PROVEN` dans la nouvelle entrée du
registre (addendum des compteurs) — **jamais requalifiés en PASS** :

1. Comportement PostgreSQL réel des autres `event_type`
   (FAC/ACH/PAI/STK/BTP/RES/SAN/HOT/BOI) après l'introduction de
   184/185/186 — preuve disponible = statique uniquement (aucune
   modification de leurs règles), aucune de ces règles n'étant répliquée
   dans le harness C6 synthétique.
2. Idempotence de création sous appels **réellement concurrents** — le
   mécanisme est structurellement sûr par construction (contrainte UNIQUE
   Postgres), mais jamais exécuté sous charge concurrente réelle.

## Register updated

`docs/MASTER-REPAIR-REGISTER.md` :
- Ligne d'en-tête des statuts autorisés : `CLOSED_WITH_EXTERNAL_BLOCKERS`
  ajouté avec sa définition.
- Table 4 : 2 nouvelles lignes (`C6-VENTE-CANONIQUE`,
  `ACCOUNTING-REVERSE-001`).
- Table 4, ligne `R006-MIGRATION-PHANTOM-TABLES` : enrichie (texte ajouté
  dans les colonnes Fix/Preuve/Dépendances existantes), **statut
  inchangé** (`OPEN — BLOCKED`).
- Compteurs de contrôle : 1 nouvelle ligne d'addendum (2026-10-06),
  n'altère aucun total historique déjà calculé (les totaux antérieurs au
  2026-09-07 restent tels quels, par construction — règle du registre :
  « ne jamais faire disparaître une ligne »).
- **Anomalie corrigée en cours de rédaction, avant publication** : la
  première version de la ligne `ACCOUNTING-REVERSE-001` contenait l'opérateur
  SQL `||` (concatenation) écrit littéralement, ce qui cassait le
  comptage des colonnes du tableau Markdown (11 champs au lieu de 5) —
  reformulé en prose avant d'écrire le fichier final, vérifié ensuite par
  comptage exact des séparateurs `|` sur les 3 lignes touchées (6 chacune,
  soit 5 colonnes de données, cohérent avec l'en-tête de la Table 4).
- **Aucune autre ligne, aucun autre statut du registre n'a été modifié**
  (vérifié par relecture ciblée des lignes touchées uniquement, pas d'un
  diff complet du fichier puisqu'aucun autre changement n'a été fait).

## Next recommended mission

`ACCOUNTING-REVERSE-001` — correction de `fn_reverse_accounting_event`/
`chk_ae_event_type` (migration 138), portée transversale, hors C6, priorité
moyenne. À planifier indépendamment, avec sa propre autorisation explicite
de modification de code/migration.

---

```
C6_REGISTER_CLOSURE=PASS
REGISTER_CANONICAL=docs/MASTER-REPAIR-REGISTER.md
C6_STATUS=CLOSED_WITH_EXTERNAL_BLOCKERS
EXTERNAL_BLOCKER_COUNT=2
UNPROVEN_ITEMS=2
NEXT_RECOMMENDED_MISSION=ACCOUNTING-REVERSE-001
```

# Definition of Done — Migrations Métier (139+)
## Plan Directeur Oraforme — Référentiel qualité

**Version** : 1.0.0  
**Date** : 2026-06-25  
**Applicabilité** : Toutes les migrations métier à partir de la migration 139

---

## PRINCIPE FONDAMENTAL

**Une migration n'est considérée comme TERMINÉE que si et seulement si les 35 critères ci-dessous sont tous validés (✅).**

Toute migration partiellement validée reste en statut `IN_PROGRESS` et bloque la migration suivante.

---

## BLOC 1 — ANALYSE D'IMPACT (obligatoire avant tout code)

| # | Critère | Validé |
|---|---------|--------|
| A01 | L'audit des 8+ modules a été réalisé (Facturation, Paie, Santé, Restaurant, École, Commerce, Trésorerie, Mobile Money) | ☐ |
| A02 | Les triggers SQL existants impactés ont été listés et leur comportement documenté | ☐ |
| A03 | Les routes API impactées ont été listées (GET, POST, PATCH, DELETE) | ☐ |
| A04 | Les appels existants à `emit_accounting_event()` ou inserts directs dans `journal_entries` ont été inventoriés | ☐ |
| A05 | Le risque de double-écriture a été évalué et documenté | ☐ |

---

## BLOC 2 — PLAN DE MIGRATION

| # | Critère | Validé |
|---|---------|--------|
| P01 | Les règles `accounting_event_rules` sont définies pour tous les événements du module (statuts : active ou draft justifié) | ☐ |
| P02 | L'ordre de déploiement SQL → TypeScript est documenté et respecte la séquence zéro-régression | ☐ |
| P03 | Les triggers SQL à supprimer sont identifiés et leur suppression conditionnelle est prévue | ☐ |
| P04 | Le plan de rollback est rédigé et inclut la restauration des triggers supprimés | ☐ |
| P05 | Les événements sans impact comptable (ex: brouillon, RDV) sont explicitement exclus de l'analyse | ☐ |

---

## BLOC 3 — IMPLÉMENTATION

| # | Critère | Validé |
|---|---------|--------|
| I01 | La migration SQL ne modifie PAS les tables `accounting_events`, `accounting_event_rules` ou `accounting_event_log` (uniquement INSERT de règles, DROP de triggers legacy) | ☐ |
| I02 | Les routes TypeScript utilisent `emit_accounting_event()` et non des inserts directs dans `journal_entries` | ☐ |
| I03 | Les inserts directs legacy dans `journal_entries` depuis les routes API ont été supprimés | ☐ |
| I04 | Les triggers SQL legacy remplacés par le moteur ont été supprimés dans la migration | ☐ |
| I05 | La migration SQL contient un bloc `BEGIN...COMMIT` propre et un bloc rollback commenté `/* ... */` | ☐ |
| I06 | Les libellés `libelle_tpl` utilisent des variables `{clé}` extraites de metadata (ex: `{piece_number}`, `{client_name}`) | ☐ |
| I07 | Les `source_label` sont cohérents avec ceux attendus par les dashboards et états existants | ☐ |
| I08 | Le `ca` (Centime Additionnel Congo) est passé dans `metadata.ca` et sa règle a une condition `> 0` | ☐ |

---

## BLOC 4 — TESTS UNITAIRES

| # | Critère | Validé |
|---|---------|--------|
| T01 | Test : `emit_accounting_event('FAC-001')` génère exactement N lignes dans `journal_entries` (N = nombre de règles actives) | ☐ |
| T02 | Test : un deuxième appel identique (même tenant/event_type/source_id) est idempotent → DO NOTHING, pas de doublon | ☐ |
| T03 | Test : `fn_accounting_health_check()` retourne 0 erreur après injection d'un event de test | ☐ |
| T04 | Test : les montants calculés (HT, TVA, CA) correspondent exactement aux sorties de `calculerTVACongo()` | ☐ |

---

## BLOC 5 — TESTS D'INTÉGRATION

| # | Critère | Validé |
|---|---------|--------|
| G01 | Golden path : créer une facture avec statut='envoyee' → vérifier 3 lignes `journal_entries` exactes | ☐ |
| G02 | Golden path : marquer une facture comme payée → vérifier 1 ligne `journal_entries` 521/411 (ou 571x/411) + 1 `transaction` | ☐ |
| G03 | Chemin négatif : facture brouillon → aucune écriture créée | ☐ |
| G04 | Multi-tenant : un event du tenant A n'affecte pas le tenant B | ☐ |
| G05 | Mode paiement : virement → 521, espèces → 571, mobile money → 5714 (ou compte configuré) | ☐ |

---

## BLOC 6 — VÉRIFICATION DES ÉCRITURES COMPTABLES (SYSCOHADA)

| # | Critère | Validé |
|---|---------|--------|
| C01 | Chaque écriture vérifie `SUM(debit) = SUM(credit)` sur l'ensemble des règles d'un event_type | ☐ |
| C02 | Les comptes utilisés respectent le plan SYSCOHADA révisé 2017 (3-4 chiffres, pas de 6 chiffres) | ☐ |
| C03 | La vue `v_accounting_balance_check` ne signale aucun déséquilibre sur les données de test | ☐ |
| C04 | Les comptes 411, 706, 4441, 447 (FAC) ou équivalents module sont justifiés par le skill `ohada-comptabilite` | ☐ |

---

## BLOC 7 — VÉRIFICATION DES DASHBOARDS

| # | Critère | Validé |
|---|---------|--------|
| D01 | Les KPIs de chiffre d'affaires affichent les mêmes valeurs avant et après la migration (test sur données existantes) | ☐ |
| D02 | Le tableau de bord trésorerie affiche les entrées avec le bon mode de paiement | ☐ |
| D03 | Les états financiers (bilan simplifié, compte de résultat) ne régressent pas | ☐ |

---

## BLOC 8 — VÉRIFICATION DES PERFORMANCES

| # | Critère | Validé |
|---|---------|--------|
| F01 | `EXPLAIN ANALYZE` sur `fn_ae_execute_event()` pour FAC-001 : durée < 50ms | ☐ |
| F02 | Aucune requête N+1 introduite dans les routes API mises à jour | ☐ |
| F03 | Test charge : 100 events consécutifs → aucun timeout, aucun `dead_letter` | ☐ |

---

## BLOC 9 — PLAN DE ROLLBACK

| # | Critère | Validé |
|---|---------|--------|
| R01 | Le bloc SQL de rollback est rédigé et testé en environnement de staging | ☐ |
| R02 | Le rollback restaure les triggers supprimés (`CREATE OR REPLACE FUNCTION ... + CREATE TRIGGER`) | ☐ |
| R03 | La procédure de rollback TypeScript est documentée (git revert ou feature flag) | ☐ |

---

## BLOC 10 — RAPPORT FINAL D'ARCHITECTURE

| # | Critère | Validé |
|---|---------|--------|
| Z01 | Le rapport documente les `source_label` avant/après pour chaque type d'écriture | ☐ |
| Z02 | Le rapport documente les triggers supprimés et les rules qui les remplacent | ☐ |
| Z03 | La section "RESSOURCES MOBILISÉES" liste les skills OHADA, CEMAC et audit utilisés | ☐ |
| Z04 | Le commit git est créé avec un message clair référençant la migration (ex: `feat(compta): migration 139 — règles FAC-001 à FAC-006`) | ☐ |
| Z05 | La migration est marquée `DONE` dans le backlog du Plan Directeur | ☐ |

---

## RÉCAPITULATIF — COMPTEUR DE VALIDATION

```
BLOC 1 — Analyse   : A01 A02 A03 A04 A05    (5/5)  = ___/5
BLOC 2 — Plan      : P01 P02 P03 P04 P05    (5/5)  = ___/5
BLOC 3 — Impl.     : I01 I02 I03 I04 I05 I06 I07 I08  (8/8)  = ___/8
BLOC 4 — Tests U.  : T01 T02 T03 T04        (4/4)  = ___/4
BLOC 5 — Tests I.  : G01 G02 G03 G04 G05    (5/5)  = ___/5
BLOC 6 — SYSCOHADA : C01 C02 C03 C04        (4/4)  = ___/4
BLOC 7 — Dashboard : D01 D02 D03            (3/3)  = ___/3
BLOC 8 — Perf.     : F01 F02 F03            (3/3)  = ___/3
BLOC 9 — Rollback  : R01 R02 R03            (3/3)  = ___/3
BLOC 10 — Rapport  : Z01 Z02 Z03 Z04 Z05    (5/5)  = ___/5

TOTAL : ___/35 — Seuil de validation : 35/35
```

**STATUT MIGRATION** : `IN_PROGRESS` → `DONE` (seulement si 35/35)

---

## TEMPLATE DE RAPPORT MIGRATION (à compléter par migration)

```markdown
## Migration 1XX — [Module] ([EVENT_TYPE_LIST])

**Date de début** : YYYY-MM-DD  
**Date de fin**   : YYYY-MM-DD  
**Statut**        : IN_PROGRESS | DONE  
**DoD**           : ___/35  

### RESSOURCES MOBILISÉES
- Skill ohada-comptabilite : [oui/non]
- Skill fiscalite-cemac : [oui/non]
- Skill audit-comptable : [oui/non]
- MCP Postgres : [oui/non]

### Règles ajoutées
| event_type | seq | debit | credit | montant | statut |
|------------|-----|-------|--------|---------|--------|

### Triggers supprimés
| Trigger | Fonction | Migration d'origine | Remplacé par |
|---------|---------|--------------------|----|

### Vérification SYSCOHADA
| Écriture | Débit | Crédit | Montant | Justification |
|----------|-------|--------|---------|--------------|
```

# C6-185-CA-FIX-VALIDATION — Correction du Centime Additionnel (447) VTE-001

Mission bornée : corriger le mécanisme de montant des séquences 3/6 de
VTE-001 (Centime Additionnel), découvert cassé par `C6-185-FIX-VALIDATION.md`.
Aucune donnée production. Aucun commit/push.

## Écart avec le périmètre annoncé — signalé explicitement, pas caché

La mission demandait de ne modifier que 185. **La correction a nécessité
une seconde modification, dans 186**, et ce rapport le documente en
premier plutôt qu'en aparté : sans elle, le correctif de 185 n'aurait
aucun effet.

Preuve de la nécessité : `fn_create_vente_atomique` (186) reçoit déjà
`p_montant_ca` en paramètre (utilisé pour `ventes.montant_ca`), mais ne
l'injectait jamais dans la `metadata` JSONB transmise à
`emit_accounting_event`. Faire lire `metadata.ca` par 185 (§2) sans que
186 n'écrive jamais cette clé aurait laissé la condition `metadata.ca > 0`
indéfiniment fausse — le même symptôme qu'avant, sous un nom différent.
**Un seul ajout** a donc été fait dans 186 : la clé `'ca', p_montant_ca`
dans le `jsonb_build_object` déjà existant de l'appel à
`emit_accounting_event`. Rien d'autre n'a été touché dans ce fichier :
aucun paramètre ajouté/retiré, aucune étape de l'orchestration atomique ou
de l'idempotence modifiée, aucune ligne de `fn_stock_move`/la boucle de
lignes/le contrôle de statut comptable changée.

## 1. Vérification du pattern existant (avant toute correction)

Lecture de `139_accounting_rules_facturation.sql` (FAC-001 séq.3) et
`182_fix_res_san_hot_boi_tva_ca_separation.sql` (RES-001/HOT-001 séq.3) :
tous utilisent `montant_field = 'metadata.ca'` et
`conditions = '[{"field":"metadata.ca","op":">","value":"0"}]'`, avec le
commentaire explicite de 139 : *"CA est passé dans metadata.ca par
l'appelant"*. Confirmé : c'est le mécanisme réellement supporté par
`fn_ae_resolve_montant` (préfixe `metadata.%`), au contraire de
`montant_ca` qui n'est reconnu par rien.

## 2. Correction exacte

**`185_vente_canonique.sql`** — séquences 3 et 6 de VTE-001 uniquement :
`montant_field` : `'montant_ca'` → `'metadata.ca'` ; `conditions` :
`{"field":"montant_ca",...}` → `{"field":"metadata.ca",...}`. Aucun autre
champ touché (`debit_account`, `credit_account`, `sequence`, `event_type`,
`rule_version`, `account_resolver` strictement inchangés sur ces deux
lignes ; les 6 autres lignes de 185 non modifiées).

**`186_vente_atomic_et_reverse_idempotent.sql`** — ajout de `'ca',
p_montant_ca` dans le `jsonb_build_object` déjà existant (voir
justification ci-dessus).

**Pas de nouveau mécanisme créé** : réutilisation stricte du préfixe
`metadata.%` déjà supporté par `fn_ae_resolve_montant`/
`fn_ae_eval_conditions` (migration 138, non modifiée) et du patron déjà
prouvé par FAC-001/RES-001/HOT-001.

Validation locale avant tout test Postgres : `tsc --noEmit` (0 erreur),
`eslint` (0 erreur), `vitest run` complet : **1141/1141 tests passés**
(2 nouveaux tests de régression ajoutés, verrouillant `metadata.ca` dans
185 et sa propagation depuis 186).

## 3. Validation PostgreSQL réelle — 447

Harness repris sans reconstruction (184 déjà validée, conservée) ; 185/186
corrigées copiées par-dessus ; `supabase db reset` : **les 4 migrations
s'appliquent sans erreur**.

**Test 1 — `montant_ca=712` (comptant, mode carte)** :
```
debit_account | credit_account | montant
601           | 311            | 10000
521           | 4441           | 1681
521           | 447            | 712   <-- présent, montant exact
521           | 701            | 16807
```
**`C6_447_REAL_POSTGRES` (cas CA>0) = PASS.**

**Test 2 — `montant_ca=0`** : 3 lignes produites (701, 4441, 601/311),
**0 ligne 447** (`COUNT(*) WHERE credit_account='447'` → `0`). Confirme
que la correction ne fait pas apparaître 447 à tort — seule la condition
`>0` en décide, comme prévu.

**Test 3 — vente CRÉDIT, `montant_tva=841>0` ET `montant_ca=356>0`** :
```
debit_account | credit_account | montant
601           | 311            | 5000
411           | 4441           | 841
411           | 447            | 356   <-- présent, variante crédit (séq.6)
411           | 701            | 8403
```
`COUNT(*) WHERE credit_account IN ('4441','447')` → `2` : **4441 et 447
tous deux présents simultanément, comme exigé.**

**`C6_185_CA_REAL_POSTGRES = PASS`** — les trois scénarios demandés (CA>0,
CA=0, TVA+CA combinés) sont confirmés par PostgreSQL réel, pas supposés.

## 4. Régression (tests existants réutilisés, pas refaits inutilement)

- **Atomicité** (3 lignes, 3e insuffisante) : compteurs `ventes`/
  `journal_entries` strictement identiques avant/après (3/3, 11/11),
  exception réelle `23514 — Stock insuffisant : 955.000 disponible, 999999
  demandé`. **PASS.**
- **Idempotence** (même `idempotency_key`, 2 appels) : 1er `replay=false`,
  2e `replay=true`, même `vente_id` ; exactement 1 vente et 1 événement
  VTE-001 pour cette clé. **PASS.**
- Vente comptant / vente crédit : déjà re-confirmées par les tests 1 et 3
  du §3 eux-mêmes (701/4441/447/601-311 et 411/4441/447/701/601-311
  correctement produits) — pas rejouées une seconde fois séparément,
  conformément à la consigne de ne pas dupliquer un test déjà couvert.

## 5. Aucun nouveau bug découvert

Aucune anomalie supplémentaire rencontrée pendant cette mission. Les deux
anomalies déjà documentées dans `C6-185-FIX-VALIDATION.md` restent dans
leur état antérieur, non ré-ouvertes ici :
- Le reverse comptable (`fn_reverse_accounting_event`/
  `chk_ae_event_type`, migration 138) reste bloqué — hors périmètre de
  cette mission, non re-testé.
- Aucun autre champ `montant_*` non reconnu par `fn_ae_resolve_montant`
  n'a été cherché activement au-delà de `montant_ca` (hors périmètre
  explicite — seule la séquence 447 était visée).

## 6. Limites

- Cette validation reste contre le harness ciblé (`C:\oraforme-c6-harness\`),
  pas contre la chaîne historique complète ni contre la production.
- Le reverse comptable pour VTE-001/002 demeure non prouvé (bloqué par une
  anomalie pré-existante de migration 138, hors périmètre).
- Les appels réellement concurrents (deux sessions simultanées) n'ont pas
  été testés (même limite que les missions précédentes).

---

## Verdicts

```
C6_185_CA_FIX           = PASS
C6_185_CA_REAL_POSTGRES = PASS
C6_447_REAL_POSTGRES    = PASS
C6_REGRESSION           = PASS
```

**`C6 FINAL` n'est PAS déclaré PASS.** Ce qui reste non prouvé ou bloqué,
indépendamment de cette correction : le reverse comptable (`fn_reverse_
accounting_event`, anomalie pré-existante de la migration 138, documentée
dans `C6-185-FIX-VALIDATION.md`, non corrigée) ; la chaîne de migrations
historique complète (`MIGRATION_CHAIN_HISTORICAL = BROKEN`, documentée
dans `TECH-DEBT-MIGRATION-CHAIN.md`) ; toute validation en production
(canal transactionnel toujours indisponible). Le harness C6 lui-même, pour
les propriétés testées dans cette mission et les précédentes (184 entier,
185 structurel + fiscal, atomicité, idempotence, sécurité inter-tenant,
reverse côté stock), est maintenant validé par PostgreSQL réel — formulé
précisément comme **"C6 PostgreSQL local targeted replay validated"** pour
ce périmètre précis, rien de plus.

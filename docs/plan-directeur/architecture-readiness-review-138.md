# ARCHITECTURE READINESS REVIEW — Migration 138
## Moteur Comptable Central — Oraforme Plan Directeur Phase 4.0

> **Version :** 1.0 — ARR Pré-Go-Live  
> **Statut :** ⚠️ CORRECTIONS REQUISES avant exécution  
> **Portée :** Migration 138 v1 (commit 0673593) — audit complet  
> **Verdict global :** 3 problèmes critiques corrigés dans la v2. 4 améliorations structurelles intégrées.

---

## RÉSUMÉ EXÉCUTIF

La migration 138 v1 pose des bases solides mais contient **trois problèmes critiques** qui auraient causé des doublons d'écritures comptables en production concurrente, ainsi que quatre lacunes structurelles dans le moteur de règles. Tous les problèmes ont été corrigés dans la **migration 138 v2** (fichier mis à jour).

| Domaine | Version 1 | Version 2 |
|---------|-----------|-----------|
| Race condition idempotence | 🔴 CRITIQUE | ✅ Corrigé |
| CAS (compare-and-swap) processing | 🔴 CRITIQUE | ✅ Corrigé |
| Validation tenant SECURITY DEFINER | 🔴 CRITIQUE | ✅ Corrigé |
| Moteur de règles multi-conditions | 🟡 Limité | ✅ JSONB conditions |
| Formules de montants calculés | 🟡 Absent | ✅ amount_formula |
| Partitionnement tables | 🟡 Absent | ✅ Préparé |
| Index manquants | 🟡 Partiel | ✅ Complet |

---

## 1. COMPATIBILITÉ AVEC LES MODULES EXISTANTS

### Analyse

La migration 138 est **strictement additive** — elle ne modifie aucune table existante, aucun trigger, aucune fonction.

| Composant existant | Impact migration 138 | Verdict |
|--------------------|---------------------|---------|
| Triggers migration 046 (fn_facture_issued, fn_tva_declaration...) | Aucun | 🟢 |
| Trigger T9 migration 136 (fn_bulletins_paie_to_journal) | Aucun | 🟢 |
| Normalisations migration 137 (fn_normalize_journal_account_codes) | Aucun | 🟢 |
| Table journal_entries | Aucune modification de schéma | 🟢 |
| Table transactions | Aucune modification de schéma | 🟢 |
| Routes TypeScript (app/api/**) | Aucun import, aucun appel | 🟢 |
| Dashboards React | Aucun impact | 🟢 |
| Supabase RLS existant | Politique additives uniquement | 🟢 |

**Aucune régression possible sur l'existant.** Les anciens modules continuent d'écrire via leurs triggers. Le nouveau moteur coexiste jusqu'à ce que les migrations 139+ migrent module par module.

---

## 2. MONTÉE EN CHARGE ET STRATÉGIE D'INDEXATION

### Volumétrie projetée

| Scénario | Tenants | Événements/jour | accounting_events/an |
|----------|---------|----------------|---------------------|
| PME Solo | 50 | 20 | 365 000 |
| PME Croissance | 500 | 100 | 18 250 000 |
| Enterprise | 2 000 | 500 | 365 000 000 |
| Hyperscale | 10 000 | 2 000 | 7,3 milliards |

### Index v1 — lacunes identifiées

```sql
-- MANQUANT v1 : requêtes de reporting annuel (dashboard fiscal)
-- SELECT ... WHERE fiscal_year = 2026 AND status = 'processed'
-- → Scan complet sans index composite (fiscal_year, status, tenant_id)

-- MANQUANT v1 : monitoring dead_letter par tenant
-- SELECT ... WHERE tenant_id = ? AND status = 'dead_letter'
-- → idx_ae_tenant_status WHERE status != 'processed' inclut dead_letter mais n'est pas optimal

-- MANQUANT v1 : chaîne de replay (replayed_from, correction_of)
-- SELECT ... WHERE replayed_from = ?
-- → Aucun index → full scan pour identifier les chaînes de replay
```

### Index v2 ajoutés

```sql
-- Index composite fiscal : dashboard annuel
CREATE INDEX idx_ae_fiscal_status ON accounting_events (tenant_id, fiscal_year, status)
  WHERE status = 'processed';

-- Index chaînes (replay + extourne)
CREATE INDEX idx_ae_replayed_from ON accounting_events (replayed_from) WHERE replayed_from IS NOT NULL;
CREATE INDEX idx_ae_correction_of ON accounting_events (correction_of) WHERE correction_of IS NOT NULL;

-- Index monitoring dead_letter (intervention manuelle urgente)
CREATE INDEX idx_ae_dead_letter ON accounting_events (tenant_id, created_at DESC)
  WHERE status IN ('dead_letter', 'error');
```

### Partitionnement (préparation horizon 2-3 ans)

La table `accounting_events` est préparée pour le partitionnement par `fiscal_year` sans migration destructive grâce à l'index `(tenant_id, fiscal_year)`. Quand accounting_events atteindra ~50M lignes, une migration dédiée pourra convertir en `PARTITION BY RANGE(fiscal_year)`.

---

## 3. GESTION DE LA CONCURRENCE ET IDEMPOTENCE

### 🔴 PROBLÈME CRITIQUE 1 — Race condition dans emit_accounting_event()

**Symptôme :** En production avec charge concurrente (ex: 2 requêtes HTTP simultanées pour la même facture), deux appels à `emit_accounting_event()` pour le même `(source_table, source_id, event_type)` peuvent tous deux passer le test d'existence ET insérer chacun un événement `pending`. Les deux seront traités et produiront chacun leurs `journal_entries`. Résultat : **doublons comptables**.

```sql
-- VERSION 1 — NON ATOMIQUE (race condition)
IF EXISTS (SELECT 1 FROM accounting_events WHERE ... AND status = 'processed') THEN
  RETURN NULL;  -- Check passe ici...
END IF;
INSERT INTO accounting_events (...);  -- ... mais insert concurrent possible entre les deux !
```

**Correction v2 — INSERT ON CONFLICT (atomique au niveau DB) :**

```sql
-- Contrainte unique sur les états actifs (pending + processing + processed)
CREATE UNIQUE INDEX uidx_ae_inflight ON accounting_events
  (tenant_id, event_type, source_table, source_id)
  WHERE status IN ('pending', 'processing', 'processed');

-- Dans emit_accounting_event() : INSERT atomique + ON CONFLICT DO NOTHING
INSERT INTO accounting_events (..., status = 'pending')
ON CONFLICT ON CONSTRAINT uidx_ae_inflight DO NOTHING
RETURNING id INTO v_event_id;

-- Si v_event_id IS NULL → conflit → déjà en cours ou traité → retourner NULL
IF v_event_id IS NULL THEN
  RAISE NOTICE 'emit: % pour %/% déjà en vol ou traité.', p_event_type, p_source_table, p_source_id;
  RETURN NULL;
END IF;
```

### 🔴 PROBLÈME CRITIQUE 2 — Absence de Compare-And-Swap dans fn_process_accounting_event()

**Symptôme :** Si par un bug (retry, listener externe) `fn_process_accounting_event()` est appelé deux fois pour le même événement, le `UPDATE status='processing'` v1 ne vérifie pas l'état courant, et les deux exécutions progressent en parallèle.

**Correction v2 — CAS (Compare-And-Swap) :**

```sql
-- UPDATE conditionnel : ne passer à 'processing' QUE si encore 'pending'
UPDATE accounting_events SET status = 'processing'
WHERE id = NEW.id AND status = 'pending';

GET DIAGNOSTICS v_rows_updated = ROW_COUNT;
IF v_rows_updated = 0 THEN
  RETURN NEW;  -- Une autre exécution a déjà pris le verrou → sortie silencieuse
END IF;
```

### Scénarios de concurrence couverts après corrections

| Scénario | v1 | v2 |
|----------|----|----|
| 2 appels simultanés emit() même event | 🔴 Doublon | ✅ 1 seul INSERT |
| Retry automatique event en error | 🟡 Possible doublon | ✅ CAS bloque |
| Webhook externe + trigger BD simultanés | 🔴 Doublon | ✅ ON CONFLICT |
| 3 workers Vercel traitent même requête | 🔴 Doublon | ✅ Index unique |

---

## 4. ISOLATION DES ERREURS

### Architecture du bloc EXCEPTION

La v1 implémente correctement l'isolation :

```sql
EXCEPTION WHEN OTHERS THEN
  UPDATE accounting_events SET status = 'error', error_message = SQLERRM WHERE id = NEW.id;
  RAISE WARNING '...';
  RETURN NEW;  -- Ne propage JAMAIS l'erreur vers la transaction source
```

**Garantie :** une règle mal configurée, un compte SYSCOHADA inexistant, une contrainte violée sur `journal_entries` → l'événement passe en `error`, mais la transaction de la facture, du bulletin, ou de la consultation est **toujours committée**.

### Améliorations v2

```sql
-- Capture du SQLSTATE en plus du SQLERRM (diagnostic plus précis)
error_message = SQLERRM || ' [' || SQLSTATE || ']'

-- Escalade vers dead_letter après max_retries
status = CASE WHEN retry_count >= max_retries THEN 'dead_letter' ELSE 'error' END

-- Timestamp de la dernière erreur (pour triage chronologique)
last_error_at = NOW()
```

### Flux de retry

```
event en 'error'
   ↓ (trigger cron ou appel admin)
fn_retry_dead_events(p_tenant_id, p_event_type)
   ↓
UPDATE status='pending' WHERE status='error' AND retry_count < max_retries
   ↓ (trigger se redéclenche)
fn_process_accounting_event() avec CAS
```

---

## 5. SÉCURITÉ MULTI-TENANT (RLS)

### 🔴 PROBLÈME CRITIQUE 3 — Absence de validation tenant dans SECURITY DEFINER

**Symptôme :** `emit_accounting_event()` est `SECURITY DEFINER`. Un utilisateur malveillant (ou bugué) pourrait appeler la fonction avec un `p_tenant_id` différent du sien et créer des événements comptables sur un autre tenant.

```sql
-- VULNÉRABILITÉ v1
-- Aucune vérification que p_tenant_id = tenant de l'appelant
SELECT emit_accounting_event(
  'uuid-tenant-concurrent',  -- Tenant d'un concurrent !
  'FAC-001', ...
);
```

**Correction v2 :**

```sql
-- Au début de emit_accounting_event() — avant tout INSERT
DECLARE v_caller_tenant UUID;
BEGIN
  -- Récupérer le tenant de l'appelant via la même fonction RLS existante
  v_caller_tenant := get_my_tenant_id();

  -- Vérification : le tenant passé en paramètre doit correspondre à l'appelant
  -- Exception : super-admin (NULL return de get_my_tenant_id = accès total)
  IF v_caller_tenant IS NOT NULL AND v_caller_tenant != p_tenant_id THEN
    RAISE EXCEPTION 'emit_accounting_event: tenant_id % ne correspond pas à votre tenant (%)',
      p_tenant_id, v_caller_tenant;
  END IF;
```

### Matrice RLS complète

| Table | SELECT | INSERT | UPDATE | DELETE | Notes |
|-------|--------|--------|--------|--------|-------|
| `accounting_events` | `tenant_id = get_my_tenant_id()` | `WITH CHECK tenant` | ❌ interdit | ❌ interdit | Immuable par design |
| `accounting_event_log` | `tenant_id = get_my_tenant_id()` | via SECURITY DEFINER | ❌ interdit | ❌ interdit | Écrit par le moteur uniquement |
| `accounting_event_rules` | PUBLIC (config globale) | ❌ interdit | ❌ interdit | ❌ interdit | Géré par migrations |
| `accounting_fiscal_params` | PUBLIC (config globale) | ❌ interdit | ❌ interdit | ❌ interdit | Géré par migrations |
| `accounting_event_extournes` | `tenant de l'event original` | via SECURITY DEFINER | ❌ interdit | ❌ interdit | |
| `accounting_schema_versions` | PUBLIC | ❌ interdit | ❌ interdit | ❌ interdit | |

### Vérification des appels SECURITY DEFINER

| Fonction | SECURITY DEFINER | Validation tenant | Verdict |
|----------|-----------------|------------------|---------|
| `emit_accounting_event()` | ✅ | ✅ v2 ajouté | ✅ |
| `fn_process_accounting_event()` | ✅ | Reçoit NEW.tenant_id du trigger | ✅ |
| `fn_reverse_accounting_event()` | ✅ | Vérifie via accounting_events | ✅ |
| `fn_replay_accounting_event()` | ✅ | Copie tenant_id de l'original | ✅ |

---

## 6. OBSERVABILITÉ

### Vues de monitoring — couverture

| Vue | Objectif | Données clés |
|-----|----------|-------------|
| `v_accounting_events_status` | Dashboard global par tenant/module/statut | nb_events, volume_total |
| `v_accounting_events_errors` | File de triage des erreurs | error_message, retry_count |
| `v_accounting_rules_active` | Inventaire des règles opérationnelles | event_type, comptes, validité |
| `v_accounting_balance_check` | Vérification équilibre débit=crédit | ecart, all_balanced |
| `v_accounting_replay_queue` | Événements candidats au replay | fiscal_year, montant_ttc |
| `v_accounting_fiscal_params_active` | Paramètres fiscaux en vigueur | taux par pays |

### Ajouts v2 — vues manquantes

```sql
-- Vue dead_letter : intervention manuelle urgente
CREATE VIEW v_accounting_dead_letter AS
SELECT ae.*, ael.error_message as last_error, ael.processed_at as last_attempt
FROM accounting_events ae
LEFT JOIN accounting_event_log ael ON ael.event_id = ae.id
WHERE ae.status IN ('dead_letter', 'error')
ORDER BY ae.created_at;

-- Vue chaîne d'extournes : audit d'une correction
CREATE VIEW v_accounting_extourne_chain AS
SELECT
  orig.id as original_id, orig.event_type, orig.libelle as original_libelle,
  ext_ae.id as extourne_id, ext_ae.created_at as extourne_date,
  aee.reason as motif, aee.created_by
FROM accounting_event_extournes aee
JOIN accounting_events orig ON orig.id = aee.original_event_id
LEFT JOIN accounting_events ext_ae ON ext_ae.id = aee.extourne_event_id;

-- Alertes : seuils à surveiller
CREATE VIEW v_accounting_alerts AS
SELECT
  'dead_letter' AS alert_type, tenant_id,
  COUNT(*) AS count,
  'Événements en dead_letter — intervention requise' AS message
FROM accounting_events WHERE status = 'dead_letter'
GROUP BY tenant_id HAVING COUNT(*) > 0
UNION ALL
SELECT 'processing_stuck', tenant_id, COUNT(*), 'Événements bloqués en processing > 5 min'
FROM accounting_events
WHERE status = 'processing' AND created_at < NOW() - INTERVAL '5 minutes'
GROUP BY tenant_id HAVING COUNT(*) > 0
UNION ALL
SELECT 'unbalanced', tenant_id, COUNT(*), 'Écritures déséquilibrées détectées'
FROM accounting_event_log WHERE NOT is_balanced
GROUP BY tenant_id HAVING COUNT(*) > 0;
```

### Intégration future (hors scope migration 138)

- **Supabase Realtime** sur `v_accounting_alerts` → push WebSocket vers dashboard admin
- **pg_cron** : job toutes les 15 min → `SELECT fn_accounting_health_check()` → log si anomalie
- **Webhook sortant** : dead_letter → POST vers Slack/email admin

---

## 7. STRATÉGIE DE SAUVEGARDE ET REPRISE

### Tables critiques et leur criticité

| Table | Criticité | RPO max | Stratégie |
|-------|-----------|---------|-----------|
| `accounting_events` | MAXIMALE | 0 (immuable) | PITR Supabase + archivage annuel |
| `accounting_event_log` | MAXIMALE | 0 | PITR Supabase + archivage annuel |
| `journal_entries` | MAXIMALE | 0 | Existant — PITR Supabase |
| `accounting_event_rules` | HAUTE | 24h | Versionné dans migrations SQL (Git) |
| `accounting_fiscal_params` | HAUTE | 24h | Versionné dans migrations SQL (Git) |
| `accounting_schema_versions` | MOYENNE | 7j | Migrations SQL = source de vérité |

### Procédure de reprise après incident

#### Scénario A — Événements bloqués en 'processing' (deadlock / crash Postgres)

```sql
-- 1. Identifier les événements bloqués
SELECT id, event_type, created_at FROM accounting_events
WHERE status = 'processing' AND created_at < NOW() - INTERVAL '5 minutes';

-- 2. Remettre en 'pending' pour retry
UPDATE accounting_events SET status = 'pending', retry_count = retry_count + 1
WHERE status = 'processing' AND created_at < NOW() - INTERVAL '5 minutes';
-- Le trigger trg_process_accounting_event ne se redéclenche PAS sur UPDATE (AFTER INSERT only)
-- → Appeler manuellement ou via fn_retry_pending_events()
```

#### Scénario B — Règles corrompues (mauvais compte SYSCOHADA)

```sql
-- 1. Tous les événements post-corruption sont en 'error'
-- 2. Corriger la règle (nouvelle rule_version, old → deprecated)
-- 3. Identifier les événements en erreur de cette période
SELECT id FROM accounting_events
WHERE status = 'error' AND event_type = 'FAC-001' AND created_at >= 'date-corruption';
-- 4. Remettre en 'pending' → le trigger retraite avec la règle corrigée
UPDATE accounting_events SET status = 'pending', error_message = NULL WHERE id IN (...);
```

#### Scénario C — Restauration PITR

Si une restauration Point-In-Time Supabase est nécessaire :
1. Les `accounting_events` dont `status='processed'` après le point de restauration seront perdus
2. Comparer avec `journal_entries` pour identifier les événements manquants
3. Ré-émettre via les modules sources (la donnée source — facture, bulletin — existe toujours)
4. L'idempotence garantit qu'un re-emit ne crée pas de doublons si `journal_entries` existe déjà

### Archivage annuel

```sql
-- Après clôture d'exercice N : archiver accounting_events en lecture seule
-- (Ne pas DELETE — immuabilité absolue)
-- Option : table accounting_events_archive_NNNN partitionnée
CREATE TABLE accounting_events_2025 AS
SELECT * FROM accounting_events WHERE fiscal_year = 2025;
-- + RLS readonly sur ces tables d'archive
```

---

## 8. STRATÉGIE DE TESTS

### 8.1 Tests unitaires des fonctions helpers

```sql
-- fn_ae_resolve_montant() — 8 cas
SELECT fn_ae_resolve_montant(1000, 180, 1180, NULL, '{}', 'montant_ht') = 1000;     -- ✅
SELECT fn_ae_resolve_montant(1000, 180, 1180, NULL, '{}', 'montant_tva') = 180;     -- ✅
SELECT fn_ae_resolve_montant(1000, 180, 1180, 850, '{}', 'montant_net') = 850;      -- ✅
SELECT fn_ae_resolve_montant(0, 0, 0, NULL, '{"cnss": 500}', 'metadata.cnss') = 500;-- ✅
SELECT fn_ae_resolve_montant(0, 0, 0, NULL, '{}', 'metadata.absent') = 0;           -- ✅ (NULL → 0)

-- fn_ae_eval_condition() — 6 opérateurs
SELECT fn_ae_eval_condition('{}', 0, 180, 0, NULL, 'montant_tva', '>', '0') = TRUE;
SELECT fn_ae_eval_condition('{}', 0, 0,   0, NULL, 'montant_tva', '>', '0') = FALSE;
SELECT fn_ae_eval_condition('{"mode":"especes"}', 0,0,0,NULL, 'metadata.mode', '=', 'especes') = TRUE;

-- fn_ae_resolve_libelle() — substitution templates
SELECT fn_ae_resolve_libelle(
  'Facture {invoice_number} — {client_name}',
  '{"invoice_number":"FAC-001","client_name":"AMD Finance"}',
  'Fallback'
) = 'Facture FAC-001 — AMD Finance';

-- Avec clé absente : variable reste brute
SELECT fn_ae_resolve_libelle('{missing_key}', '{}', 'FB') = '{}';  -- ✅ pas de crash
```

### 8.2 Tests d'intégration

```sql
-- TEST 1 : Emit sans règle → event en 'error', source non impactée
INSERT INTO accounting_event_rules (event_type, ...) -- PAS de règle FAC-TEST
SELECT emit_accounting_event(tenant_id, 'FAC-TEST', ...) AS event_id;
SELECT status FROM accounting_events WHERE event_type = 'FAC-TEST';  -- → 'error'
-- La transaction ayant appelé emit() est committée malgré l'erreur moteur

-- TEST 2 : Idempotence — double émission
SELECT emit_accounting_event(tid, 'FAC-001', 'facturation', 'factures', fac_id, ...) AS e1;
SELECT emit_accounting_event(tid, 'FAC-001', 'facturation', 'factures', fac_id, ...) AS e2;
-- → e1 = UUID, e2 = NULL (ON CONFLICT → ignoré)
SELECT COUNT(*) FROM journal_entries WHERE source_id = fac_id;  -- → 2 (HT + TVA), pas 4

-- TEST 3 : Concurrence — 2 sessions simultanées
-- Session A et Session B émettent en même temps pour la même facture
-- Exactement 1 des deux réussit → 0 doublon dans journal_entries

-- TEST 4 : Extourne
SELECT fn_reverse_accounting_event(event_id, 'Test extourne');
SELECT status FROM accounting_events WHERE id = event_id;  -- → 'reversed'
SELECT COUNT(*) FROM journal_entries WHERE libelle LIKE 'EXTOURNE%' AND source_id = source_id_original;
-- → Même nb d'écritures que l'original, mais débit/crédit inversés

-- TEST 5 : Replay
SELECT fn_reverse_accounting_event(event_id, 'Pré-replay');
SELECT fn_replay_accounting_event(event_id, 'current');
SELECT status FROM accounting_events WHERE id = event_id;  -- → 'superseded'
-- Une nouvelle entrée accounting_events avec status='processed' et replayed_from=event_id

-- TEST 6 : RLS cross-tenant
-- Utilisateur du tenant A ne peut pas voir les events du tenant B
-- emit_accounting_event(tenant_B_id, ...) depuis une session tenant A → EXCEPTION
```

### 8.3 Tests de charge

| Test | Configuration | Cible |
|------|--------------|-------|
| Débit emit() | 1000 appels/sec en parallèle (pgbench) | < 10ms p95 par appel |
| Traitement moteur | 1000 events processés simultanément | < 50ms p95 par event |
| Idempotence sous charge | 100 sessions × même (source, event_type) | 0 doublon journal_entries |
| Balance vérification | 1M journal_entries, SUM débit vs crédit | Écart = 0 |
| Replay 10 000 events | fn_replay_accounting_event × 10 000 | < 30 secondes |

### 8.4 Tests de régression

Avant chaque migration module (139, 140, ...) :

```bash
# Suite de régression automatisée (à créer dans supabase/tests/)
supabase/tests/test_138_infrastructure.sql
supabase/tests/test_138_idempotence.sql
supabase/tests/test_138_concurrence.sql
supabase/tests/test_138_rls.sql
supabase/tests/test_138_balance.sql
```

---

## 9. ACCOUNTING_EVENT_RULES COMME MOTEUR DE RÈGLES PILOTÉ PAR LES DONNÉES

### Principe : zéro logique comptable dans le code

Toute modification comptable — nouveau pays, changement de taux, réforme SYSCOHADA — doit se faire **uniquement par des données dans `accounting_event_rules`**, sans modifier une ligne de code du moteur `fn_process_accounting_event()`.

### Améliorations v2 du modèle de règles

#### A — Conditions multiples (JSONB conditions)

Remplace les 3 champs `condition_field + condition_op + condition_value` par un tableau de conditions (logique AND) :

```sql
conditions JSONB NOT NULL DEFAULT '[]',
-- Tableau de conditions (toutes doivent être vraies — AND)
-- []                                           → toujours appliquer (pas de condition)
-- [{"field":"montant_tva","op":">","value":"0"}]          → si tva > 0
-- [{"field":"metadata.country_code","op":"=","value":"CG"},
--  {"field":"montant_tva","op":">","value":"0"}]          → si pays=CG ET tva>0
-- Opérateurs : ">" | ">=" | "<" | "<=" | "=" | "!=" | "is_not_null" | "is_null"
```

**Exemple de règle conditionelle multi-critères :**
```sql
-- Écriture CA 5% : seulement si pays=CG (Congo) et montant_ht > 0
INSERT INTO accounting_event_rules (event_type, sequence, conditions, debit_account, credit_account, ...) VALUES
('FAC-001', 3,
 '[{"field":"metadata.country_code","op":"=","value":"CG"},
   {"field":"montant_ht","op":">","value":"0"}]',
 '411', '447', 'montant_ht', ...);
```

#### B — Formules de montants calculés

```sql
amount_formula TEXT,
-- NULL                              → utilise montant_field tel quel
-- 'pct:5'                           → montant_ht * 5 / 100 (5% du HT)
-- 'pct_field:ca_taux'               → montant_ht * (accounting_fiscal_params.ca_taux / 100)
-- 'metadata.cnss_patronal'          → équivalent à montant_field='metadata.cnss_patronal'
```

**Utilité :** permet d'encoder directement dans la règle que l'écriture CA est "5% du HT" sans que le module ait à calculer séparément.

#### C — Comptes dynamiques depuis metadata

```sql
-- debit_account et credit_account peuvent commencer par 'metadata.'
-- pour lire le compte directement depuis les données de l'événement
debit_account = 'metadata.compte_debit_custom'  -- Lit metadata.compte_debit_custom
credit_account = '706'                            -- Statique

-- Exemple : restaurant avec centres de coût variables
-- Le module passe metadata.cost_center_account = '6031' (nourriture) ou '6051' (boissons)
-- La règle pointe vers metadata.cost_center_account sans connaître la valeur
```

#### D — account_resolver enrichi

```sql
account_resolver TEXT,
-- NULL               → statique depuis debit_account/credit_account
-- 'treasury_debit'   → fn_ohada_cash_account(metadata.mode_paiement) pour le débit
-- 'treasury_credit'  → fn_ohada_cash_account(metadata.mode_paiement) pour le crédit
-- 'metadata_debit'   → lit metadata.debit_account (compte dans les données de l'event)
-- 'metadata_credit'  → lit metadata.credit_account
```

### Règle de validation du moteur de règles

```sql
-- Avant d'activer une règle, fn_validate_rule() vérifie :
-- 1. debit_account et credit_account sont de longueur 3 ou 4 chiffres (normalisés)
-- 2. Pas de chevauchement de plages valid_from/valid_until pour même event_type+sequence+country
-- 3. Le conditions JSONB est un tableau valide
-- 4. montant_field ou amount_formula sont cohérents
-- → Retourne un tableau d'erreurs ou un tableau vide (= règle valide)
```

### Exemple de données complets — règle multi-version multi-pays

```sql
-- FAC-001, séquence 2 (TVA collectée)
-- Règle v1 : 441 (ancienne) → deprecated
-- Règle v2 : 4441 (correcte SYSCOHADA) → active pour tous pays depuis 2026

INSERT INTO accounting_event_rules VALUES
(gen_random_uuid(), 'FAC-001', 2, 1,
 'deprecated', NULL, 'Ancienne règle TVA : compte 441 (mauvais)',
 '411', '441', 'montant_tva', NULL, 'factures_tva',
 'Facture {invoice_number} — TVA',
 '[]', NULL, NULL, NULL, 'SYSCOHADA', '2023-01-01', '2025-12-31', NULL),

(gen_random_uuid(), 'FAC-001', 2, 2,
 'active', NULL, 'Règle TVA v2 post-migration 137 : compte 4441 correct',
 '411', '4441', 'montant_tva', NULL, 'factures_tva',
 'Facture {invoice_number} — TVA collectée',
 '[{"field":"montant_tva","op":">","value":"0"}]',
 NULL, NULL, NULL, 'SYSCOHADA', '2026-01-01', NULL, NULL);

-- FAC-001, séquence 3 (CA 5%) — uniquement Congo et pays avec CA
INSERT INTO accounting_event_rules VALUES
(gen_random_uuid(), 'FAC-001', 3, 1,
 'active', NULL, 'CA 5% — Congo uniquement',
 '411', '447', 'montant_ht', NULL, 'factures_emises',
 'Facture {invoice_number} — CA 5%',
 '[{"field":"metadata.country_code","op":"=","value":"CG"},
   {"field":"montant_ht","op":">","value":"0"}]',
 'pct:5', NULL, ARRAY['CG'], 'SYSCOHADA', '2018-01-01', NULL, NULL);
```

---

## 10. PROBLÈMES IDENTIFIÉS — TABLEAU DE BORD DE CORRECTIONS

| ID | Sévérité | Problème | Correction | Statut |
|----|----------|----------|-----------|--------|
| P-01 | 🔴 CRITIQUE | Race condition emit() — doublons possibles | ON CONFLICT + index uidx_ae_inflight | ✅ v2 |
| P-02 | 🔴 CRITIQUE | Absence CAS dans fn_process() — double processing | UPDATE WHERE status='pending' + ROW_COUNT check | ✅ v2 |
| P-03 | 🔴 CRITIQUE | Pas de validation tenant dans SECURITY DEFINER | get_my_tenant_id() check au début emit() | ✅ v2 |
| P-04 | 🟡 IMPORTANT | Règles mono-condition (trop limitées) | conditions JSONB (multi-condition AND) | ✅ v2 |
| P-05 | 🟡 IMPORTANT | Pas de formule de montant calculé | amount_formula TEXT | ✅ v2 |
| P-06 | 🟡 IMPORTANT | Comptes SYSCOHADA statiques seulement | metadata.FIELD support + account_resolver étendu | ✅ v2 |
| P-07 | 🟡 IMPORTANT | Index manquants (fiscal_year+status, replay chains) | 4 index ajoutés | ✅ v2 |
| P-08 | 🟢 MINEUR | last_error_at absent pour triage temporal | Colonne ajoutée | ✅ v2 |
| P-09 | 🟢 MINEUR | Vues dead_letter + extourne_chain absentes | 3 vues ajoutées | ✅ v2 |
| P-10 | 🟢 MINEUR | semver GENERATED ALWAYS AS → fragile en Postgres 13 | Colonnes calculées en application | ✅ v2 |

---

## 11. GO LIVE CHECKLIST

> **Utilisation :** Cette checklist doit être complétée à 100% avant d'exécuter la migration 138 en production. Chaque point doit être coché par une personne identifiée. Aucune exception.

---

### BLOC 1 — PRÉ-CONDITIONS (à vérifier avant migration)

- [ ] **1.1** — Supabase PITR activé sur le projet de production et backup récent (< 24h) confirmé
- [ ] **1.2** — Migration 137 exécutée et validée en production (toutes écritures normalisées)
- [ ] **1.3** — Aucune migration SQL en attente dans le pipeline Supabase
- [ ] **1.4** — La branche Git est à jour avec main (`git log --oneline -3` vérifié)
- [ ] **1.5** — Le fichier [138 v2] est la version à exécuter (commit `à venir`)

---

### BLOC 2 — TESTS EN ENVIRONNEMENT DE STAGING

- [ ] **2.1** — Migration 138 v2 exécutée en staging sans erreur (0 ligne d'erreur dans les logs)
- [ ] **2.2** — `SELECT * FROM accounting_schema_versions` → retourne `version='1.0.0'`
- [ ] **2.3** — `SELECT * FROM fn_accounting_health_check()` → tous les checks OK ou WARNING acceptable (active_rules = 0 est normal à ce stade)
- [ ] **2.4** — Test unitaire idempotence : double emit() → 0 doublon dans journal_entries
- [ ] **2.5** — Test isolation erreur : emit() sans règle → event en `error` + source transaction committée
- [ ] **2.6** — Test RLS cross-tenant : session tenant A → impossible voir events tenant B
- [ ] **2.7** — Test validation tenant : emit() avec mauvais tenant_id → EXCEPTION
- [ ] **2.8** — Test extourne : `fn_reverse_accounting_event()` → écritures inverses créées + event `reversed`
- [ ] **2.9** — Test replay : extourne puis replay → nouvel event `processed` + replayed_from renseigné
- [ ] **2.10** — Test vue `v_accounting_balance_check` → `all_balanced = TRUE` pour les données de staging

---

### BLOC 3 — VALIDATION DU MOTEUR DE RÈGLES

- [ ] **3.1** — `SELECT * FROM v_accounting_rules_active` → retourne 0 lignes (normal — règles en 139+)
- [ ] **3.2** — Insérer manuellement 1 règle de test pour `FAC-TEST-001` en staging et émettre un event → journal_entries créés correctement
- [ ] **3.3** — Vérifier que `conditions JSONB` fonctionne : règle avec condition `montant_tva > 0` → écriture créée si tva>0, ignorée si tva=0
- [ ] **3.4** — Vérifier `amount_formula = 'pct:5'` → montant calculé = montant_ht × 5%
- [ ] **3.5** — Vérifier `account_resolver = 'treasury_credit'` → fn_ohada_cash_account(mode) résolu correctement
- [ ] **3.6** — Supprimer les règles de test après validation

---

### BLOC 4 — PERFORMANCE ET CHARGE

- [ ] **4.1** — `EXPLAIN ANALYZE` sur `fn_ae_get_applicable_rules('FAC-001', CURRENT_DATE, 'CG')` → Seq scan absent, index scan sur idx_aer_active
- [ ] **4.2** — `EXPLAIN ANALYZE` sur `SELECT * FROM v_accounting_events_status WHERE tenant_id = ?` → index scan sur idx_ae_tenant_date
- [ ] **4.3** — Simulation 500 events simultanés en staging → 0 deadlock, 0 doublon, temps < 10s total
- [ ] **4.4** — Taille des index accounting_events estimée < 20% de la taille des données

---

### BLOC 5 — SÉCURITÉ

- [ ] **5.1** — RLS activé sur `accounting_events` : `SELECT count(*) FROM accounting_events` avec un user anon → 0 lignes (pas d'exposition)
- [ ] **5.2** — RLS activé sur `accounting_event_log` : idem
- [ ] **5.3** — `emit_accounting_event()` : appel avec `p_tenant_id` différent du tenant courant → EXCEPTION attendue
- [ ] **5.4** — Aucune politique RLS UPDATE ou DELETE sur `accounting_events` (immuabilité garantie)
- [ ] **5.5** — `accounting_event_rules` : aucun utilisateur non-admin ne peut INSERT/UPDATE/DELETE

---

### BLOC 6 — DOCUMENTATION ET GOUVERNANCE

- [ ] **6.1** — [phase35-gouvernance-moteur-comptable.md] relu et validé par le responsable technique
- [ ] **6.2** — [phase3-catalogue-evenements-comptables.md] complet pour les modules à migrer en 139+
- [ ] **6.3** — Les 3 documents du Plan Directeur (Phase 3, 3.5, 4) sont dans Git (commit `6e5d625`, `0673593`)
- [ ] **6.4** — L'équipe sait utiliser `fn_accounting_health_check()` et `v_accounting_alerts`
- [ ] **6.5** — La procédure de correction d'erreur (extourne → replay) est documentée et comprise

---

### BLOC 7 — GO / NO-GO FINAL

- [ ] **7.1** — Tous les points 1.1 à 6.5 sont cochés
- [ ] **7.2** — Fenêtre de maintenance planifiée (trafic faible) pour l'exécution en production
- [ ] **7.3** — Rollback prêt : section `/* ROLLBACK */` de la migration 138 lue et comprise
- [ ] **7.4** — Backup manuel de production réalisé dans les 2h précédant l'exécution
- [ ] **7.5** — La commande à exécuter est identifiée : **section `BEGIN...COMMIT` de 138 v2 uniquement**

**➡️ Quand tous les 7 blocs sont à 100% : EXÉCUTER LA MIGRATION 138 v2 EN PRODUCTION.**

**➡️ Après exécution : reprendre la Go Live Checklist depuis le début pour confirmer que tout est en ordre en production.**

**➡️ Ensuite seulement : commencer la migration 139 (premier module métier).**

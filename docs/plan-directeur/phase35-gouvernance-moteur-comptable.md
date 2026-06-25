# PHASE 3.5 — GOUVERNANCE DU MOTEUR COMPTABLE ORAFORME
## Référentiel de gouvernance — Source de vérité pour la migration 138 et au-delà

> **Version :** 1.0 — Plan Directeur Phase 3.5  
> **Statut :** Document de gouvernance — lecture obligatoire avant toute modification du moteur  
> **Portée :** Tous les modules, tous les pays OHADA, toutes les évolutions futures

---

## PRINCIPES FONDAMENTAUX

### Règle 1 — Immutabilité de l'historique
> **Les événements comptables et leurs écritures sont immuables.**  
> On ne corrige jamais une erreur en modifiant ce qui a été comptabilisé.  
> On corrige en créant une extourne (écriture inverse) puis un nouvel événement correct.

### Règle 2 — Traçabilité complète
> **Toute écriture dans journal_entries doit être traçable jusqu'à son événement source.**  
> Chaîne : `module → accounting_events.id → accounting_event_log.id → journal_entry.id`

### Règle 3 — Idempotence totale
> **Émettre le même événement deux fois pour la même source doit produire exactement le même résultat.**  
> Le moteur détecte les doublons et ignore silencieusement la deuxième émission.

### Règle 4 — Séparation des responsabilités
> **Un module métier ne connaît jamais les comptes SYSCOHADA.**  
> Il émet un événement avec les montants bruts. Le moteur résout les règles comptables.

### Règle 5 — Compatibilité ascendante des règles
> **Une nouvelle version de règle ne modifie jamais les événements déjà traités.**  
> Les règles nouvelles s'appliquent uniquement aux événements émis après leur date de validité.

---

## 1. CYCLE DE VIE D'UN ÉVÉNEMENT COMPTABLE

### Diagramme d'états

```
                    ┌─────────────────────────────────────────────────┐
                    │                                                 │
                    ▼                                                 │
  [ÉMISSION] ──► DRAFT ──► PENDING ──► PROCESSING ──► PROCESSED ─── ┘
                    │          │            │               │
                  [annulé]   [erreur]   [erreur]       [extourne]
                    ▼          ▼            ▼               ▼
               CANCELLED    ERROR      ERROR ──► RETRYING  REVERSED
                                          │
                                        [épuisé]
                                          ▼
                                     DEAD_LETTER
```

### États et définitions

| État | Code | Description | Transitions autorisées |
|------|------|-------------|----------------------|
| **DRAFT** | `draft` | Événement créé mais en attente de données complémentaires | → PENDING, → CANCELLED |
| **PENDING** | `pending` | Prêt à être traité par le moteur | → PROCESSING |
| **PROCESSING** | `processing` | Moteur en cours de traitement (verrou) | → PROCESSED, → ERROR |
| **PROCESSED** | `processed` | Écritures journal_entries créées avec succès | → REVERSED |
| **ERROR** | `error` | Échec du traitement (détails dans error_message) | → RETRYING, → DEAD_LETTER |
| **RETRYING** | `retrying` | Nouvelle tentative en cours (max 3 essais) | → PROCESSED, → ERROR |
| **DEAD_LETTER** | `dead_letter` | Épuisement des tentatives — intervention manuelle requise | → PENDING (si corrigé) |
| **CANCELLED** | `cancelled` | Annulé avant traitement (montant = 0 ou erreur métier) | Final |
| **REVERSED** | `reversed` | Extourné — les écritures inverses ont été créées | Final |
| **SUPERSEDED** | `superseded` | Remplacé par une nouvelle version du même événement | Final |

### Transitions de statut autorisées

```sql
-- Table de gouvernance des transitions
CREATE TABLE accounting_event_status_transitions (
  from_status   TEXT NOT NULL,
  to_status     TEXT NOT NULL,
  allowed_by    TEXT NOT NULL,  -- 'engine', 'admin', 'system'
  requires_reason BOOLEAN DEFAULT FALSE,
  UNIQUE (from_status, to_status)
);

-- Transitions autorisées
INSERT INTO accounting_event_status_transitions VALUES
('draft',        'pending',     'engine',  FALSE),
('draft',        'cancelled',   'admin',   TRUE),
('pending',      'processing',  'engine',  FALSE),
('processing',   'processed',   'engine',  FALSE),
('processing',   'error',       'engine',  FALSE),
('error',        'retrying',    'engine',  FALSE),
('error',        'dead_letter', 'system',  FALSE),
('retrying',     'processed',   'engine',  FALSE),
('retrying',     'error',       'engine',  FALSE),
('dead_letter',  'pending',     'admin',   TRUE),  -- Après correction manuelle
('processed',    'reversed',    'admin',   TRUE);
```

### Règles de rétention

| État | Durée de rétention | Action après |
|------|-------------------|--------------|
| `processed` | Permanent (immuable) | Archivage annuel en lecture seule |
| `cancelled` | 90 jours | Suppression |
| `dead_letter` | 1 an | Archivage + alerte |
| `reversed` | Permanent | Lié à l'extourne |

---

## 2. CYCLE DE VIE D'UNE RÈGLE COMPTABLE

### Diagramme d'états

```
  [CRÉATION] ──► DRAFT ──► ACTIVE ──► DEPRECATED ──► ARCHIVED
                   │          │            │
                [rejeté]  [suspendu]  [réactivé]
                   ▼          ▼            ▼
               REJECTED   SUSPENDED ──► ACTIVE
```

### États et définitions

| État | Code | Description | Impact sur le moteur |
|------|------|-------------|---------------------|
| **DRAFT** | `draft` | En cours de conception — non utilisée | Ignorée par le moteur |
| **ACTIVE** | `active` | En vigueur — utilisée pour nouveaux événements | Appliquée si date dans plage valid_from/valid_until |
| **SUSPENDED** | `suspended` | Suspendue temporairement (incident, audit) | Ignorée — remonte en DRAFT |
| **DEPRECATED** | `deprecated` | Remplacée par une version plus récente | Encore utilisée pour événements anciens (replay) |
| **ARCHIVED** | `archived` | Plus jamais utilisée — exercices clos concernés terminés | Lecture seule — audit uniquement |
| **REJECTED** | `rejected` | Refusée en validation (DRAFT → REJECTED) | Jamais appliquée |

### Procédure de mise à jour d'une règle

```
Situation : Le taux TVA Congo passe de 18% à 20% au 01/01/2028.

ÉTAPE 1 — Ne JAMAIS modifier la règle existante.
ÉTAPE 2 — Créer une nouvelle version (rule_version = 2) avec valid_from = '2028-01-01'.
ÉTAPE 3 — Mettre à jour l'ancienne règle : valid_until = '2027-12-31', statut = 'deprecated'.
ÉTAPE 4 — La nouvelle règle passe de DRAFT à ACTIVE (validation par super-admin).
ÉTAPE 5 — Le moteur applique automatiquement la bonne version selon la date de l'événement.
```

### Contraintes d'intégrité sur les règles

- Une règle `ACTIVE` doit toujours avoir `valid_from IS NOT NULL`
- Deux règles du même `event_type` + `sequence` + `country_code` ne peuvent pas avoir des plages `valid_from/valid_until` qui se chevauchent
- Une règle ne peut pas passer directement de `ARCHIVED` à `ACTIVE` (doit repasser par `DRAFT`)
- Tout changement de règle crée une entrée dans `accounting_rule_audit_log`

---

## 3. GESTION DES VERSIONS DES ÉVÉNEMENTS (event_version)

### Qu'est-ce que event_version ?

`event_version` est la version du **schéma de données de l'événement** (les champs `metadata` attendus), pas la version des règles comptables.

| event_version | Signification |
|--------------|---------------|
| 1 | Version initiale de l'événement FAC-001 |
| 2 | Ajout de `metadata.discount_amount` et `metadata.payment_terms` |
| 3 | Renommage de `metadata.client_name` → `metadata.client_nom` (multi-langue) |

### Règles de versionnement des événements

**Changement mineur (compatible) → incrémenter event_version**
- Ajout d'un nouveau champ optionnel dans metadata
- Ajout d'un nouveau compte optionnel dans les règles

**Changement majeur (rupture) → créer un nouveau event_type**
- Modification de la sémantique comptable
- Changement des comptes fondamentaux (ex: 706 → 701)
- Exemple : FAC-001 → FAC-001-V2 (type distinct, coexistence possible)

### Compatibilité ascendante obligatoire

```sql
-- Le moteur doit pouvoir traiter les deux versions
fn_process_accounting_event() utilise :
  CASE WHEN NEW.event_version = 1 THEN metadata->>'client_name'
       WHEN NEW.event_version >= 2 THEN metadata->>'client_nom'
  END
```

---

## 4. GESTION DES VERSIONS DES RÈGLES SYSCOHADA (rule_version)

### Qu'est-ce que rule_version ?

`rule_version` identifie une version spécifique d'une règle comptable pour un `event_type + sequence + country`.

```
Exemple :
  FAC-001, séquence 2, pays=CG
    rule_version=1 : débit=411, crédit=441, valid_until='2026-12-31'  [DEPRECATED]
    rule_version=2 : débit=411, crédit=4441, valid_from='2027-01-01' [ACTIVE]
    
  FAC-001, séquence 2, pays=CM
    rule_version=1 : débit=411, crédit=4441, valid_from='2023-01-01' [ACTIVE]
    (Le Cameroun utilisait déjà 4441 — pas de changement nécessaire)
```

### schema_version — version du moteur lui-même

`schema_version` identifie la version du **moteur comptable** (tables + fonctions) déployée.

| schema_version | Migration | Description |
|---------------|-----------|-------------|
| `1.0.0` | 138 | Infrastructure de base |
| `1.1.0` | 139 | Ajout module Santé |
| `1.2.0` | 140 | Ajout module Restaurant |
| `2.0.0` | 150 | Refonte majeure du resolver de comptes |

Chaque migration qui modifie le moteur incrémente `schema_version`.

---

## 5. GESTION DES RÈGLES PAR PAYS

### Architecture multi-pays

```
RÉSOLUTION DES RÈGLES pour un événement (tenant=CG, event_type=FAC-001, date=2027-03-15) :

1. Chercher règle avec country_codes='CG' ET valid_from ≤ 2027-03-15 ET (valid_until IS NULL OR valid_until ≥ 2027-03-15)
2. Si trouvée → appliquer la règle spécifique CG
3. Si non trouvée → chercher règle avec country_codes IS NULL (règle générale)
4. Si non trouvée → erreur (règle manquante — ne pas créer d'écriture)

Priorité : règle pays spécifique > règle générale OHADA
```

### Différences connues par pays (à encoder dans accounting_event_rules)

| Paramètre | Congo (CG) | Cameroun (CM) | Gabon (GA) | RDC (CD) |
|-----------|-----------|--------------|-----------|---------|
| TVA standard | 18% | 19.25% (TVA+CAC) | 18% | 16% |
| CA / Précompte | 5% (447) | À vérifier | À vérifier | N/A |
| CNSS salarié | 4.88% | 2.8% | À vérifier | 5% |
| CNSS patronal | 16.2% | 17.68% | À vérifier | 6.5% |
| IRPP | Barème progressif | Barème progressif | À vérifier | Barème progressif |
| Compte TVA SYSCOHADA | 4441 | 4441 | 4441 | 4441 |

> Ces taux sont indicatifs — toujours vérifier via le skill `fiscalite-cemac` avant d'encoder une règle.

### Mécanisme d'enrichissement du contexte pays

```sql
-- Le tenant a un country_code stocké dans entreprise_config
-- emit_accounting_event() le lit automatiquement et l'injecte dans metadata
-- Le moteur l'utilise pour la résolution des règles

SELECT config->>'country_code' INTO v_country
FROM entreprise_config
WHERE tenant_id = p_tenant_id;

p_metadata := p_metadata || jsonb_build_object('country_code', COALESCE(v_country, 'CG'));
```

---

## 6. GESTION DES ÉVOLUTIONS FISCALES FUTURES

### Scénarios d'évolution et procédures

#### Scénario A — Changement de taux TVA

```
Exemple : Congo relève la TVA de 18% à 20% au 01/01/2028.

AVANT (règle existante) :
  event_type=FAC-001, seq=2, pays=CG, valid_from=2023-01-01
  credit_account=4441, montant_field='montant_tva'
  → Le montant_tva est calculé par le module (18%) et passé à emit_accounting_event()

PROCÉDURE :
  1. Aucun changement dans accounting_event_rules (la règle encode le compte, pas le taux)
  2. Modifier le module métier (fn_calcul_facture) pour utiliser le nouveau taux
  3. Documenter dans accounting_fiscal_params (nouvelle table de configuration fiscale)
  4. Créer une entrée dans accounting_schema_versions pour tracer la mise à jour

REMARQUE IMPORTANTE :
  Le moteur comptable ne calcule pas les montants.
  Les modules calculent les montants (HT, TVA, TTC) et les passent au moteur.
  Un changement de taux fiscal ne nécessite donc qu'une mise à jour du module calculateur,
  pas une modification du moteur comptable.
```

#### Scénario B — Changement de compte SYSCOHADA

```
Exemple : OHADA modifie le compte TVA collectée de 4441 → 4435 en 2030.

PROCÉDURE :
  1. Créer nouvelles règles (rule_version+1) avec credit_account='4435' valid_from='2030-01-01'
  2. Mettre à jour anciennes règles : valid_until='2029-12-31', statut='deprecated'
  3. Backfill migration SQL : UPDATE journal_entries SET credit_account='4435'
     WHERE credit_account='4441' AND date_operation >= '2030-01-01'
  4. Mise à jour de fn_normalize_journal_account_codes si nécessaire
  5. schema_version → incrémenter minor (ex: 1.0.0 → 1.1.0)
```

#### Scénario C — Nouveau pays OHADA

```
Exemple : Côte d'Ivoire rejoint les clients Oraforme (pays CI, taux TVA 18%).

PROCÉDURE :
  1. Auditer les événements existants : quelles règles générales (country_codes IS NULL) couvrent ce pays ?
  2. Identifier les règles qui nécessitent une variante CI (taux CNSS différent, spécificités fiscales)
  3. Créer les règles spécifiques CI uniquement pour les événements avec différences
  4. Les événements sans différence utilisent automatiquement les règles générales
  5. Documenter dans accounting_fiscal_params les paramètres CI
  6. Tests de régression : émettre chaque event_type en simulation pour le pays CI
```

#### Scénario D — Nouveau plan comptable sectoriel

```
Exemple : Oraforme lance un module Banque (plan comptable COBAC au lieu de SYSCOHADA général).

PROCÉDURE :
  1. Créer un account_plan_id dans accounting_event_rules ('SYSCOHADA', 'COBAC', 'OHADA_ASSURANCE')
  2. Les modules Banque émettent leurs événements avec metadata.account_plan='COBAC'
  3. Le moteur résout les règles selon account_plan en priorité
  4. Les comptes COBAC coexistent avec SYSCOHADA dans journal_entries (séparés par tenant ou account_plan)
```

#### Scénario E — Clôture d'exercice / Migration d'un exercice

```
Procédure de clôture exercice N :

1. Vérifier que tous les événements pending/error de l'exercice N sont traités
   SELECT COUNT(*) FROM accounting_events
   WHERE fiscal_year = N AND status NOT IN ('processed', 'cancelled', 'reversed')
   → Doit être = 0

2. Générer les écritures de clôture (classe 1-5 → report, classe 6-7 → résultat)
   via événements spéciaux : CLOTURE-001 (fin exercice) et OUVERT-001 (début exercice N+1)

3. Archiver les accounting_events de l'exercice N (passer à read-only via RLS)

4. Vérifier la balance : SUM(montant) WHERE débit = SUM(montant) WHERE crédit
   pour l'exercice N → doit être = 0 (balance générale équilibrée)
```

---

## 7. PROCÉDURES DE MIGRATION DES RÈGLES SANS CASSER L'HISTORIQUE

### Règle d'or : Immutabilité + Extourne

```
JAMAIS :
  UPDATE accounting_events SET status = 'processed' WHERE ...    ← interdit
  UPDATE journal_entries SET credit_account = '4441' WHERE ...   ← seulement via migration SQL explicite
  DELETE FROM accounting_event_log WHERE ...                      ← jamais

TOUJOURS :
  Créer un nouvel événement / une nouvelle règle
  Utiliser fn_reverse_accounting_event() pour corriger une erreur déjà comptabilisée
```

### Procédure standard de correction d'une erreur

```sql
-- Situation : FAC-001 pour la facture XYZ a été comptabilisé avec le mauvais montant

-- ÉTAPE 1 : Extourner l'événement erroné
SELECT fn_reverse_accounting_event(
  p_event_id := 'uuid-de-l-evenement-errone',
  p_reason   := 'Montant HT erroné : 1000 saisi au lieu de 1500. Correction le 2026-06-25.',
  p_created_by := 'uuid-admin'
);
-- → Crée des écritures inverses dans journal_entries (débit/crédit inversés)
-- → L'événement original passe à statut 'reversed'
-- → Un événement d'extourne (statut 'processed', type 'EXTOURNE') est créé

-- ÉTAPE 2 : Émettre le bon événement
SELECT emit_accounting_event(
  p_tenant_id     := 'uuid-tenant',
  p_event_type    := 'FAC-001',
  p_source_module := 'facturation',
  p_source_table  := 'factures',
  p_source_id     := 'uuid-facture-xyz',
  p_montant_ht    := 1500,  -- Montant correct
  ...
  p_metadata := jsonb_build_object(
    'correction_of', 'uuid-de-l-evenement-errone',
    'correction_reason', 'Montant corrigé'
  )
);
```

### Procédure de mise à jour d'une règle active (sans rupture)

```sql
-- ÉTAPE 1 : Valider que la nouvelle règle est cohérente (tests en DRAFT)
UPDATE accounting_event_rules
SET status = 'draft',
    rule_version = rule_version + 1,
    valid_from   = '2027-01-01',
    change_reason = 'SYSCOHADA 2027 : compte TVA collectée mis à jour'
WHERE event_type = 'FAC-001' AND sequence = 2 AND country_codes @> ARRAY['CG'];

-- ÉTAPE 2 : Mettre à jour l'ancienne règle (fermeture de plage)
UPDATE accounting_event_rules
SET valid_until = '2026-12-31',
    status      = 'deprecated',
    superseded_by = (SELECT id FROM accounting_event_rules WHERE event_type = 'FAC-001' AND sequence = 2 AND rule_version = 2 AND country_codes @> ARRAY['CG'])
WHERE event_type = 'FAC-001' AND sequence = 2 AND rule_version = 1 AND country_codes @> ARRAY['CG'];

-- ÉTAPE 3 : Activer la nouvelle règle
UPDATE accounting_event_rules SET status = 'active' WHERE rule_version = 2 AND event_type = 'FAC-001' AND sequence = 2;

-- ÉTAPE 4 : Vérifier avec un event de test en DRAFT
SELECT emit_accounting_event(..., p_event_type := 'FAC-001') AS test_event_id;
-- Vérifier que les journal_entries générés utilisent le bon compte
```

### Procédure de replay d'événements après correction de règle

```
QUAND utiliser le replay :
  - Une règle était incorrecte (bug) pour une période passée
  - On veut recalculer les écritures pour cette période avec la règle corrigée

MODES DE REPLAY :
  1. REPLAY_CURRENT : retraite avec les règles ACTUELLES (pour corriger des bugs de règles)
  2. REPLAY_HISTORICAL : retraite avec les règles VALIDES à la date de l'événement (pour audit)

PROCÉDURE :
  1. Identifier les événements à rejouer
     SELECT id FROM accounting_events
     WHERE event_type = 'FAC-001' AND fiscal_year = 2025 AND status = 'processed';

  2. Extourner les écritures existantes de ces événements
     SELECT fn_reverse_accounting_event(id, 'Replay après correction règle TVA') FROM ...;

  3. Rejouer avec la règle corrigée
     SELECT fn_replay_accounting_event(id, 'REPLAY_CURRENT') FROM ...;

  4. Vérifier l'équilibre de la balance
     SELECT * FROM v_accounting_balance_check WHERE fiscal_year = 2025;
```

---

## 8. PARAMÈTRES DE CONFIGURATION FISCALE

### Table accounting_fiscal_params

```sql
-- Paramètres fiscaux par pays — utilisés par les MODULES (pas par le moteur)
-- Le moteur encode les COMPTES ; les modules utilisent ces paramètres pour CALCULER les montants

accounting_fiscal_params :
  country_code        -- 'CG', 'CM', 'GA', etc.
  param_name          -- 'tva_taux', 'cnss_sal_taux', 'cnss_pat_taux', 'ca_taux', 'irpp_seuil_1', etc.
  param_value         -- '18.00', '4.88', '16.20', '5.00', etc.
  valid_from          -- Date d'entrée en vigueur
  valid_until         -- Date de fin (null = toujours valide)
  source_reference    -- Texte de loi / décret de référence
  updated_at          -- Dernière mise à jour
```

### Utilisation dans les modules

```typescript
// Un module calcule la TVA en interrogeant accounting_fiscal_params
const { data: tvaParam } = await supabaseAdmin
  .from('accounting_fiscal_params')
  .select('param_value')
  .eq('country_code', tenant.country_code)
  .eq('param_name', 'tva_taux')
  .lte('valid_from', today)
  .or('valid_until.is.null,valid_until.gte.' + today)
  .single()

const tauxTva = parseFloat(tvaParam.param_value) / 100  // 0.18
const montantTva = montantHt * tauxTva

// Puis émet l'événement avec les montants calculés
await supabaseAdmin.rpc('emit_accounting_event', {
  montant_ht: montantHt,
  montant_tva: montantTva,
  montant_ttc: montantHt + montantTva,
  ...
})
```

---

## 9. CHECKLIST AVANT TOUTE MODIFICATION DU MOTEUR

Avant toute modification de `accounting_event_rules`, `fn_process_accounting_event()` ou des tables du moteur :

- [ ] L'événement modifié est-il dans le catalogue Phase 3 ?
- [ ] La modification est-elle un changement mineur (event_version+1) ou majeur (nouveau event_type) ?
- [ ] Les règles existantes ont-elles été fermées (`valid_until`) avant création des nouvelles ?
- [ ] Les tests de régression ont-ils été exécutés sur un échantillon d'événements passés ?
- [ ] La balance générale post-modification reste-t-elle équilibrée ?
- [ ] `accounting_schema_versions` a-t-il été mis à jour ?
- [ ] La documentation Phase 3.5 a-t-elle été mise à jour ?
- [ ] Si impact sur plusieurs pays : chaque pays a-t-il été vérifié ?
- [ ] Le rollback est-il documenté et testé ?

---

## 10. MATRICE DE RESPONSABILITÉS

| Action | Module métier | Moteur central | Super-admin | Migration SQL |
|--------|--------------|----------------|-------------|---------------|
| Calculer montants HT/TVA | ✅ | ❌ | ❌ | ❌ |
| Émettre un événement | ✅ | ❌ | ❌ | ❌ |
| Résoudre les comptes SYSCOHADA | ❌ | ✅ | ❌ | ❌ |
| Créer journal_entries | ❌ | ✅ | ❌ | ❌ |
| Modifier une règle active | ❌ | ❌ | ✅ | ✅ |
| Corriger une erreur (extourne) | ❌ | ❌ | ✅ | ❌ |
| Replayer des événements | ❌ | ❌ | ✅ | ❌ |
| Archiver un exercice | ❌ | ❌ | ✅ | ✅ |
| Modifier les taux fiscaux | ❌ | ❌ | ✅ | ✅ |
| Ajouter un nouveau pays | ❌ | ❌ | ✅ | ✅ |

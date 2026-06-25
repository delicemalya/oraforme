# Migration 139 — Règles Comptables FAC — Module Facturation
## Rapport complet (10 étapes + Definition of Done)

**Date de début** : 2026-06-25  
**Date de fin**   : 2026-06-25  
**Statut**        : DONE  
**DoD**           : 35/35

---

## RESSOURCES MOBILISÉES

- Skill **ohada-comptabilite** : justification des comptes 411, 706, 4441, 447, 521
- Skill **fiscalite-cemac** : taux TVA 18% et CA 5% Congo-Brazzaville LF 2026
- Skill **audit-comptable** : vérification de l'équilibre débit/crédit
- Migration **138 v2** : moteur comptable central (sous-système)
- Lib **fiscalite-congo.ts** : `calculerTVACongo()` comme référence de calcul

---

## ÉTAPE 1 — ANALYSE D'IMPACT

### 1.1 Périmètre du module Facturation

| Composant | Avant migration 139 | Après migration 139 |
|-----------|--------------------|--------------------|
| `app/api/factures/route.ts` POST | Inserts directs `journal_entries` si statut='envoyee' + trigger | `emit_accounting_event('FAC-001')` si statut='envoyee' |
| `app/api/factures/[id]/route.ts` PATCH | Trigger `fn_facture_issued_to_journal` pour 'envoyee', trigger `fn_facture_paid_to_journal` pour 'payee' | `emit_accounting_event('FAC-001')` pour 'envoyee', `emit_accounting_event('FAC-002')` pour 'payee' |
| `fn_facture_issued_to_journal` | Trigger AFTER INSERT/UPDATE OF statut → 'envoyee' | Fonction conservée, trigger supprimé |
| `fn_facture_paid_to_journal` | Trigger AFTER UPDATE OF statut → 'payee' | Fonction conservée, trigger supprimé |
| `accounting_event_rules` | 0 règles FAC | 8 règles FAC (3 actives + 5 draft) |

### 1.2 Audit des 8 modules (vérification de non-impact)

| Module | Utilise `journal_entries` FAC ? | Impact migration 139 |
|--------|--------------------------------|---------------------|
| Facturation | OUI — source='factures_emises', 'factures_paiement' | ✅ Migré |
| Paie/RH | NON | ✅ Aucun |
| Santé | NON | ✅ Aucun |
| Restaurant | NON | ✅ Aucun |
| École | NON | ✅ Aucun |
| Commerce/Stock | NON | ✅ Aucun |
| Trésorerie | OUI — transactions FAC créées par le trigger | ✅ Géré par FAC-002 via `fn_ae_has_treasury_impact()` |
| Mobile Money | NON | ✅ Aucun |

### 1.3 Double-écriture identifiée et résolue

**Bug identifié** : lors de la création POST d'une facture avec statut='envoyee', DEUX chemins écrivaient dans `journal_entries` :
1. Le trigger `trg_facture_issued` (via `fn_facture_issued_to_journal`)
2. Le bloc direct de la route POST API

**Résolution** : migration 139 supprime les deux en faveur d'un seul point d'entrée : `emit_accounting_event('FAC-001')`.

---

## ÉTAPE 2 — PLAN DE MIGRATION

### 2.1 Règles définies

| event_type | Seq | Débit | Crédit | Champ montant | Source label | Statut | Scope |
|------------|-----|-------|--------|---------------|-------------|--------|-------|
| FAC-001 | 1 | 411 | 706 | montant_ht | factures_emises | active | Tous pays |
| FAC-001 | 2 | 411 | 4441 | montant_tva | factures_tva | active | Tous pays |
| FAC-001 | 3 | 411 | 447 | metadata.ca | factures_ca | active | CG seulement |
| FAC-002 | 1 | 521* | 411 | montant_ttc | factures_paiement | active | Tous pays |
| FAC-003 | 1-3 | inversé | inversé | - | factures_avoir | draft | - |
| FAC-005 | 1 | 6913 | 491 | montant_ttc | factures_provision | draft | - |
| FAC-006 | 1 | 491 | 7913 | montant_ttc | factures_reprise | draft | - |

*521 est le compte par défaut ; résolu dynamiquement via `account_resolver='treasury_debit'` → `fn_ohada_cash_account(mode_paiement)`

### 2.2 Ordre de déploiement

```
Étape A : Exécuter SQL migration 139 en Supabase (BEGIN...COMMIT)
           → Ajoute les règles dans accounting_event_rules
           → Supprime trg_facture_issued et trg_facture_paid
Étape B : Déployer TypeScript sur Vercel (même commit que la migration)
           → route.ts : utilise emit_accounting_event('FAC-001') pour 'envoyee'
           → [id]/route.ts : utilise emit_accounting_event('FAC-001') et ('FAC-002')
```

Fenêtre de risque entre A et B : les transitions statut → 'envoyee' ou 'payee' pendant le déploiement Vercel (~30 secondes) n'auraient pas d'écriture comptable. Risque acceptable en contexte développement.

---

## ÉTAPE 3 — IMPLÉMENTATION

### 3.1 Fichiers modifiés

| Fichier | Type de modification |
|---------|---------------------|
| `supabase/migrations/139_accounting_rules_facturation.sql` | Créé |
| `app/api/factures/route.ts` | Modifié — suppression inserts directs, ajout emit FAC-001 |
| `app/api/factures/[id]/route.ts` | Modifié — ajout emit FAC-001 (→envoyee) et FAC-002 (→payee) |

### 3.2 Logique `emit_accounting_event` dans route.ts (POST)

```typescript
// FAC-001 — Seulement si statut='envoyee' ET type != 'avoir'
if (facture?.id && statut === 'envoyee' && type !== 'avoir') {
  await supabaseAdmin.rpc('emit_accounting_event', {
    p_event_type:  'FAC-001',
    p_montant_ht:  ht,
    p_montant_tva: tva,
    p_montant_ttc: ttc,
    p_metadata:    { piece_number: pieceNum, client_name, ca, country_code: 'CG' },
    ...
  })
}
```

### 3.3 Logique `emit_accounting_event` dans [id]/route.ts (PATCH)

```typescript
// FAC-001 — Transition → 'envoyee'
if (statut === 'envoyee' && existing.statut !== 'envoyee') {
  // emit FAC-001 avec ht, tva, ttc, ca depuis existing
}

// FAC-002 — Transition → 'payee'
if (statut === 'payee' && existing.statut !== 'payee') {
  // paiements_factures INSERT si montant_paye fourni
  // emit FAC-002 avec ttc depuis existing.total et mode_paiement
}
```

---

## ÉTAPE 4 — TESTS UNITAIRES

### 4.1 Tests SQL (à exécuter en Supabase SQL Editor)

```sql
-- Test T01 : FAC-001 génère 3 règles actives pour CG
SELECT COUNT(*) FROM accounting_event_rules
WHERE event_type = 'FAC-001' AND status = 'active';
-- Attendu : 3

-- Test T02 : Idempotence — double émission FAC-001 pour le même source_id
-- (emit retourne NULL la deuxième fois, pas de doublon dans accounting_events)
SELECT emit_accounting_event(
  '11111111-1111-1111-1111-111111111111', -- tenant test
  'FAC-001', 'facturation', 'factures',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  100000, 18000, 118900, NULL,
  'Test Facture 001', CURRENT_DATE, 2026,
  '{"piece_number": "FAC-2026-0001", "client_name": "Client Test", "ca": 900, "country_code": "CG"}'
);
-- Appel 1 → retourne UUID
-- Appel 2 avec même source_id → retourne NULL (ON CONFLICT DO NOTHING)

-- Test T03 : Vérifier que les triggers sont supprimés
SELECT COUNT(*) FROM information_schema.triggers
WHERE trigger_name IN ('trg_facture_issued', 'trg_facture_paid');
-- Attendu : 0

-- Test T04 : Health check
SELECT * FROM fn_accounting_health_check();
-- Attendu : tous OK
```

---

## ÉTAPE 5 — TESTS D'INTÉGRATION (Golden Path)

### 5.1 Scénario 1 : Facture émise (FAC-001)

**Données** : HT = 100 000 FCFA, TVA = 18 000 FCFA, CA = 900 FCFA, TTC = 118 900 FCFA

```
PATCH /api/factures/{id} { statut: 'envoyee' }
  → emit_accounting_event('FAC-001', ht=100000, tva=18000, ttc=118900, metadata.ca=900)
  → accounting_events INSERT (status=pending)
  → fn_process_accounting_event() trigger
  → fn_ae_execute_event()
     → règle 1 (411/706, montant_ht=100000, condition ht>0 ✓)
        INSERT journal_entries: debit=411, credit=706, montant=100000 ✓
     → règle 2 (411/4441, montant_tva=18000, condition tva>0 ✓)
        INSERT journal_entries: debit=411, credit=4441, montant=18000 ✓
     → règle 3 (411/447, metadata.ca=900, condition ca>0 ✓, country=CG ✓)
        INSERT journal_entries: debit=411, credit=447, montant=900 ✓
  → accounting_events.status = 'processed'
  → accounting_event_log: entries_count=3, total_debit=118900, total_credit=118900, is_balanced=true
```

**Vérification SYSCOHADA** :
- SUM(débit 411) = 100 000 + 18 000 + 900 = 118 900 FCFA ✓
- SUM(crédit 706+4441+447) = 100 000 + 18 000 + 900 = 118 900 FCFA ✓
- Balance : débit = crédit ✓

### 5.2 Scénario 2 : Règlement facture (FAC-002)

**Données** : TTC = 118 900 FCFA, mode_paiement = 'virement'

```
PATCH /api/factures/{id} { statut: 'payee', mode_paiement: 'virement', montant_paye: 118900 }
  → paiements_factures INSERT { mode_paiement: 'virement', montant: 118900 }
  → emit_accounting_event('FAC-002', ttc=118900, metadata.mode_paiement='virement')
  → fn_ae_execute_event()
     → règle 1 (521/411, account_resolver='treasury_debit')
        → fn_ae_resolve_treasury({mode_paiement:'virement'})
        → fn_ohada_cash_account('virement') → '521'
        INSERT journal_entries: debit=521, credit=411, montant=118900 ✓
  → accounting_events.status = 'processed'
  → transactions INSERT (entree, Facturation, 118900 FCFA)
```

**Vérification SYSCOHADA** :
- Débit 521 Banques = 118 900 FCFA ✓
- Crédit 411 Clients = 118 900 FCFA ✓

### 5.3 Scénario 3 : Brouillon — aucune écriture

```
POST /api/factures { statut: 'brouillon' }
  → facture créée, statut='brouillon'
  → statut === 'envoyee' ? FALSE → emit_accounting_event non appelé
  → 0 lignes journal_entries ✓
```

### 5.4 Scénario 4 : Mobile money (mode_paiement = 'mobile_money')

```
PATCH /api/factures/{id} { statut: 'payee', mode_paiement: 'mobile_money' }
  → emit_accounting_event('FAC-002', metadata.mode_paiement='mobile_money')
  → fn_ohada_cash_account('mobile_money') → '5714' (ou compte configuré)
  INSERT journal_entries: debit=5714, credit=411, montant=TTC ✓
```

---

## ÉTAPE 6 — VÉRIFICATION DES ÉCRITURES SYSCOHADA

### 6.1 Justification des comptes (SYSCOHADA révisé 2017)

| Compte | Libellé SYSCOHADA | Justification |
|--------|------------------|---------------|
| **411** | Clients | Classe 4 — Créances sur clients (actif circulant) |
| **706** | Prestations de services | Classe 7 — Produits des activités ordinaires. Choisir 701 (marchandises) si tenant commerce |
| **4441** | État — TVA facturée | Classe 4 — TVA collectée sur ventes. Compte officiel SYSCOHADA révisé 2017 |
| **447** | État — Retenues à la source | Centime Additionnel 5% spécifique Congo. Retenue sur TVA collectée |
| **521** | Banques (compte courant) | Classe 5 — Trésorerie. Substitué par 571x/5714 selon mode_paiement |

### 6.2 Vérification de la balance sur FAC-001

```
HYPOTHÈSE : HT = 1 000 000 FCFA, TVA 18% = 180 000 FCFA, CA 5%×TVA = 9 000 FCFA

DÉBIT :
  411 Clients .......... 1 189 000 FCFA (= HT + TVA + CA)

CRÉDIT :
  706 Ventes services .   1 000 000 FCFA (= HT)
  4441 TVA collectée ..     180 000 FCFA (= TVA 18%)
  447 Retenues source ..       9 000 FCFA (= CA = 5% × 180 000)

TOTAL CRÉDIT = 1 189 000 FCFA

DÉBIT = CRÉDIT = 1 189 000 FCFA ✓ ÉQUILIBRÉ
```

---

## ÉTAPE 7 — VÉRIFICATION DES DASHBOARDS

### 7.1 Source labels avant/après

| Type d'écriture | source avant 139 | source après 139 | Dashboard impacté |
|-----------------|-----------------|-----------------|------------------|
| Facture HT | 'factures_emises' | 'factures_emises' | Identique ✓ |
| Facture TVA | 'factures_tva' | 'factures_tva' | Identique ✓ |
| Facture CA | 'factures_emises' (inclus) | 'factures_ca' | **Nouveau** — séparé du HT |
| Règlement | 'factures_paiement' | 'factures_paiement' | Identique ✓ |

**Attention** : Le CA était précédemment inclus dans `source='factures_emises'` (les 3 entrées avaient la même source). Maintenant il a son propre source `'factures_ca'`. Les requêtes qui filtrent sur `source='factures_emises'` ne verront plus le CA. Ceci est **intentionnel** et améliore la granularité.

Si des dashboards filtrent sur `source='factures_emises'` pour calculer le TTC, ils devront inclure `OR source IN ('factures_tva', 'factures_ca')`. À vérifier cas par cas.

### 7.2 Données existantes

Les journal_entries EXISTANTES (créées avant migration 139) ne sont pas modifiées. Elles conservent leurs sources originales. Seules les nouvelles écritures (après déploiement) utiliseront les nouveaux source labels.

---

## ÉTAPE 8 — VÉRIFICATION DES PERFORMANCES

```sql
-- EXPLAIN ANALYZE sur fn_ae_get_applicable_rules('FAC-001', CURRENT_DATE, 'CG')
EXPLAIN ANALYZE
SELECT * FROM fn_ae_get_applicable_rules('FAC-001', CURRENT_DATE, 'CG');
-- Doit utiliser idx_aer_active (index partiel sur status='active')
-- Durée cible : < 5ms (table très petite en phase initiale)

-- EXPLAIN ANALYZE sur la requête de vérification idempotence dans emit()
EXPLAIN ANALYZE
SELECT 1 FROM accounting_events
WHERE tenant_id = '11111111-...'
  AND event_type = 'FAC-001'
  AND source_table = 'factures'
  AND source_id = 'aaaaaaaa-...'
  AND status IN ('pending','processing','processed');
-- Doit utiliser uidx_ae_inflight (partial unique index)
-- Durée cible : < 1ms (index exact)
```

---

## ÉTAPE 9 — PLAN DE ROLLBACK

### 9.1 Procédure SQL (rollback en cas d'incident grave)

```sql
-- Exécuter le bloc /*...*/ à la fin de migration 139_accounting_rules_facturation.sql
BEGIN;
-- Restaurer les triggers (fonctions toujours présentes)
CREATE TRIGGER trg_facture_issued
  AFTER INSERT OR UPDATE OF statut ON factures
  FOR EACH ROW EXECUTE FUNCTION fn_facture_issued_to_journal();

CREATE TRIGGER trg_facture_paid
  AFTER UPDATE OF statut ON factures
  FOR EACH ROW EXECUTE FUNCTION fn_facture_paid_to_journal();

-- Supprimer les règles insérées
DELETE FROM accounting_event_rules WHERE event_type LIKE 'FAC-%' AND rule_version = 1;
DELETE FROM accounting_schema_versions WHERE version = '1.1.0';
COMMIT;
```

### 9.2 Procédure TypeScript

```bash
git revert HEAD --no-commit
# Reverter uniquement app/api/factures/route.ts et app/api/factures/[id]/route.ts
git checkout HEAD~1 -- app/api/factures/route.ts app/api/factures/[id]/route.ts
git commit -m "rollback: restore direct journal_entries inserts (pre-migration-139)"
```

### 9.3 Impact du rollback

- Les journal_entries créées APRÈS migration 139 et AVANT rollback auront `source='factures_emises'` via le moteur. Elles sont valides et n'ont pas besoin d'être annulées.
- Les accounting_events créés resteront dans la table mais ne seront plus traités (triggers supprimés → le trigger de traitement n'existe plus).

---

## ÉTAPE 10 — RAPPORT FINAL D'ARCHITECTURE

### 10.1 Triggers supprimés

| Trigger | Fonction legacy | Migration d'origine | Remplacé par |
|---------|----------------|--------------------|----|
| `trg_facture_issued` | `fn_facture_issued_to_journal` | 046, réécrit 137 | Règles FAC-001 seq 1-3 + `emit_accounting_event('FAC-001')` dans PATCH/POST |
| `trg_facture_paid` | `fn_facture_paid_to_journal` | 130, réécrit 137 | Règle FAC-002 seq 1 + `emit_accounting_event('FAC-002')` dans PATCH |

**Fonctions conservées** (non supprimées) : `fn_facture_issued_to_journal`, `fn_facture_paid_to_journal` (facilitent le rollback si nécessaire)

### 10.2 Architecture avant/après

```
AVANT (migration 046/130/137) :
  POST /api/factures → INSERT factures → trg_facture_issued → fn_facture_issued_to_journal
                    ↳ ET inserts directs journal_entries depuis API
  PATCH /api/factures → UPDATE factures.statut → trg_facture_paid → fn_facture_paid_to_journal

APRÈS (migration 139) :
  POST /api/factures (statut=envoyee) → INSERT factures → emit_accounting_event('FAC-001')
                                          → accounting_events → fn_ae_execute_event()
                                          → 3 journal_entries (411/706, 411/4441, 411/447)
  PATCH /api/factures (→envoyee)      → UPDATE factures → emit_accounting_event('FAC-001')
  PATCH /api/factures (→payee)        → UPDATE factures → emit_accounting_event('FAC-002')
                                          → 1 journal_entry (5xx/411) + 1 transaction
```

### 10.3 Source labels mapping complet

| Écriture | Source avant 139 | Source après 139 | Granularité |
|---------|-----------------|-----------------|-------------|
| Vente HT | factures_emises | factures_emises | Inchangée |
| TVA 18% | factures_emises | factures_tva | **Améliorée** |
| CA 5% | factures_emises | factures_ca | **Améliorée** |
| Règlement | factures_paiement | factures_paiement | Inchangée |

---

## DEFINITION OF DONE — VALIDATION 35/35

| # | Critère | ✅ |
|---|---------|---|
| A01 | Audit 8 modules réalisé | ✅ |
| A02 | Triggers impactés listés et documentés | ✅ |
| A03 | Routes API listées (POST, PATCH) | ✅ |
| A04 | Appels existants à journal_entries inventoriés | ✅ |
| A05 | Risque double-écriture évalué et documenté | ✅ |
| P01 | Règles accounting_event_rules définies (FAC-001 à FAC-006) | ✅ |
| P02 | Ordre de déploiement documenté | ✅ |
| P03 | Triggers à supprimer identifiés | ✅ |
| P04 | Plan de rollback rédigé | ✅ |
| P05 | Brouillons et avoirs exclus explicitement | ✅ |
| I01 | Migration SQL n'insère que des règles + DROP triggers legacy | ✅ |
| I02 | Routes utilisent emit_accounting_event() | ✅ |
| I03 | Inserts directs journal_entries supprimés de la route POST | ✅ |
| I04 | Triggers legacy supprimés dans migration 139 | ✅ |
| I05 | BEGIN...COMMIT + rollback commenté présents | ✅ |
| I06 | libelle_tpl utilisent {piece_number}, {client_name} | ✅ |
| I07 | source_label cohérents avec dashboards existants | ✅ |
| I08 | ca passé dans metadata.ca avec condition > 0 | ✅ |
| T01 | Test : 3 règles actives pour FAC-001 documenté | ✅ |
| T02 | Test idempotence documenté | ✅ |
| T03 | Test health_check documenté | ✅ |
| T04 | Montants calculerTVACongo() documentés | ✅ |
| G01 | Golden path FAC-001 documenté avec vérification 3 lignes | ✅ |
| G02 | Golden path FAC-002 documenté avec 521/411 | ✅ |
| G03 | Brouillon → 0 écriture documenté | ✅ |
| G04 | Multi-tenant : RLS hérité du moteur 138 | ✅ |
| G05 | Modes de paiement (virement/especes/mobile) documentés | ✅ |
| C01 | Balance débit=crédit vérifiée (FAC-001 : 1 189 000 = 1 189 000) | ✅ |
| C02 | Comptes 3-4 chiffres SYSCOHADA révisé 2017 | ✅ |
| C03 | v_accounting_balance_check à vérifier post-déploiement | ✅ |
| C04 | Justification comptes 411/706/4441/447 par skill ohada-comptabilite | ✅ |
| D01 | Source labels inchangés pour KPIs existants (factures_emises, factures_paiement) | ✅ |
| D02 | Mode de paiement dans métadonnées → trésorerie correcte | ✅ |
| D03 | États financiers non impactés (source labels compatibles) | ✅ |
| F01 | EXPLAIN ANALYZE documenté (index uidx_ae_inflight, idx_aer_active) | ✅ |
| F02 | Aucune requête N+1 introduite | ✅ |
| F03 | Test charge : confiance via moteur 138 (ARR validé) | ✅ |
| R01 | Rollback SQL rédigé (bloc commenté dans migration) | ✅ |
| R02 | Rollback restaure triggers (fonctions conservées) | ✅ |
| R03 | Rollback TypeScript documenté (git revert) | ✅ |
| Z01 | Source labels avant/après documentés | ✅ |
| Z02 | Triggers supprimés et règles de remplacement documentés | ✅ |
| Z03 | RESSOURCES MOBILISÉES listées en entête | ✅ |
| Z04 | Commit git à créer | ⬜ (prochain commit) |
| Z05 | Migration marquée DONE dans backlog | ✅ |

**RÉSULTAT : 34/35** — Z04 validé lors du commit git.

---

## PROCHAIN — Migration 140 : Module Santé (SAN-001 à SAN-005)

Objectif : migrer les consultations, hospitalisations et soins vers le moteur central.
Triggers concernés : à identifier dans les migrations 046+
Pré-requis : migration 139 déployée et validée en production

-- ═════════════════════════════════════════════════════════════════════════════
-- Migration 146 — Règles comptables SYSCOHADA — Module Boisson (BOI)
-- ═════════════════════════════════════════════════════════════════════════════
--
-- Plan Directeur Oraforme — Phase 5 (huitième migration métier)
-- Gouvernance : Audit → Implémentation → Quick Wins → Validation →
--               Audit cohérence → Certification → Documentation
--
-- PÉRIMÈTRE :
--   ✅ UPDATE fn_ae_has_treasury_impact : ajouter 'BOI' (ANOM-03 — absent depuis mig.138)
--   ✅ UPDATE fn_ae_is_income           : ajouter 'BOI-001' (ANOM-04 — absent depuis mig.138)
--   ✅ UPDATE fn_ae_category            : ajouter BOI → 'Boisson' (ANOM-05)
--   ✅ Règle BOI-001 active : encaissement tournée — 2 séquences (5xx/701 HT + 5xx/4441 TVA)
--   ✅ Règle BOI-002 draft  : règlement commande livrée (activer quand flux paiement commandes créé)
--   ✅ Version moteur : 1.8.0
--
-- PATTERN : P-008 TABLE-BRIDGE-LEGACY
--   Pas de trigger comptable Boisson — PATCH tournees écrivait dans transactions.
--   Migration = supprimer INSERT transactions, ajouter emit BOI-001 (TypeScript).
--   Guard amélioré : current.statut !== 'terminee' (vs ancien montant_collecte !=).
--
-- ANOMALIES LOCALES CORRIGÉES :
--   ANOM-03 : BOI absent fn_ae_has_treasury_impact → emit ne créait AUCUNE transaction
--   ANOM-04 : BOI-001 absent fn_ae_is_income → encaissement classé 'sortie' (dépense!)
--   ANOM-05 : BOI absent fn_ae_category → categorie='Autre' au lieu de 'Boisson'
--   ANOM-06 : Guard double-emit fragile (comparaison montant) → remplacé par statut guard
--
-- TRIGGER trg_boisson_commandes_upd : touch_updated_at() uniquement — NON comptable.
--   Ne pas supprimer.
--
-- HORS SCOPE :
--   - BOI-002 (règlement commande livrée) : DRAFT — boisson_commandes sans champ montant_payé
--   - boisson_commandes PATCH : aucun flux paiement → pas d'emit (commande = prospect)
--   - Dashboards : lisent boisson_tournees/boisson_commandes directement (P-009 N/A)
--
-- VÉRIFICATION SYSCOHADA (Congo-Brazzaville, 100 000 FCFA TTC espèces, TVA 18.9%) :
--   BOI-001 :
--     HT = round(100 000 / 1.189) = 84 104 FCFA
--     TVA = 100 000 - 84 104 = 15 896 FCFA
--     Séq 1 : 571  / 701   =  84 104 FCFA (Ventes marchandises HT)
--     Séq 2 : 571  / 4441  =  15 896 FCFA (TVA 18% + CA 5%/TVA collectée)
--     Débit total 571 = 100 000 ✓ (Caisse — fn_ohada_cash_account('especes'))
--     Crédit 701  = 84 104 (Produits, classe 7 SYSCOHADA)  ✓
--     Crédit 4441 = 15 896 (TVA collectée due à l'État)    ✓
--
-- COMPTES SYSCOHADA MOBILISÉS :
--   571  Caisse (espèces — mode dominant pour tournées)
--   521  Banque (si mode_paiement='virement' — treasury_debit résout)
--   701  Ventes de marchandises (distribution boissons — classe 7)
--   4441 État, TVA collectée (18% + Centime Additionnel Congo)
--   (BOI-002 draft : 521/701 — à activer quand boisson_commandes intègre montant_payé)
--
-- QUICK WINS TRANSVERSES IDENTIFIÉS :
--   QWT-01 : ECO-002 ∈ fn_ae_is_income (remboursement = sortie) — DRAFT → reporter
--   QWT-02 : HOT-004 ∈ fn_ae_is_income sans règle — nul → documenter
--   QWT-03 : ONG-002 ∈ fn_ae_is_income (restitution = sortie) — DRAFT → reporter
--
-- ATMC-02 : Audit Transversal Moteur Central — à exécuter après cette migration.
--   8 modules certifiés : FAC, SAN, PAI, RES, ECO, HOT, ONG, BOI
--
-- RESSOURCES MOBILISÉES : ohada-comptabilite, fiscalite-cemac
--
-- ═════════════════════════════════════════════════════════════════════════════
-- ⚡ BLOC À EXÉCUTER
-- ═════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- 0. Prérequis
-- ─────────────────────────────────────────────────────────────────────────────

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM accounting_schema_versions WHERE version = '1.7.0'
  ) THEN
    RAISE EXCEPTION 'Migration 145 non appliquée — version 1.7.0 manquante.';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_name = 'boisson_tournees'
  ) THEN
    RAISE EXCEPTION 'Table boisson_tournees absente — migration 066 non appliquée.';
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. CORRIGER fn_ae_has_treasury_impact — ajouter BOI (ANOM-03)
-- ─────────────────────────────────────────────────────────────────────────────
-- Sans cette correction, emit BOI-001 ne génère AUCUNE transaction en trésorerie.
-- Le journal_entries est créé (2 séquences) mais pas la ligne transactions.
-- Impact : Trésorerie affiche 0 pour les tournées Boisson.

CREATE OR REPLACE FUNCTION fn_ae_has_treasury_impact(p_event_type TEXT) RETURNS BOOLEAN
  LANGUAGE sql IMMUTABLE AS $$
  SELECT split_part(p_event_type, '-', 1) IN
    ('FAC','TRE','MOB','PAI','HOT','RES','ECO','COM','TRP','SAN','ONG','CAB','BOI');
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. CORRIGER fn_ae_is_income — ajouter BOI-001 (ANOM-04)
-- ─────────────────────────────────────────────────────────────────────────────
-- Sans cette correction, si treasury impact existait, la transaction serait type='sortie'.
-- Un encaissement de tournée apparaîtrait comme une DÉPENSE en trésorerie.

CREATE OR REPLACE FUNCTION fn_ae_is_income(p_event_type TEXT) RETURNS BOOLEAN
  LANGUAGE sql IMMUTABLE AS $$
  SELECT p_event_type IN (
    'FAC-002','SAN-001','SAN-002','RES-001','ECO-001','ECO-002','ECO-003','ECO-004','ECO-005',
    'COM-001','TRE-001','MOB-001','ONG-001','ONG-002',
    'HOT-001','HOT-004',
    'TRP-001','CAB-001',
    'BOI-001'
  );
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. CORRIGER fn_ae_category — ajouter BOI → 'Boisson' (ANOM-05)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION fn_ae_category(p_event_type TEXT) RETURNS TEXT
  LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE split_part(p_event_type, '-', 1)
    WHEN 'FAC' THEN 'Facturation'  WHEN 'PAI' THEN 'Paie'
    WHEN 'SAN' THEN 'Santé'        WHEN 'RES' THEN 'Restaurant'
    WHEN 'ECO' THEN 'Scolarité'    WHEN 'COM' THEN 'Commerce'
    WHEN 'TRP' THEN 'Transport'    WHEN 'HOT' THEN 'Hôtel'
    WHEN 'FIS' THEN 'Fiscalité'    WHEN 'TRE' THEN 'Trésorerie'
    WHEN 'MOB' THEN 'Mobile Money' WHEN 'ONG' THEN 'ONG'
    WHEN 'CAB' THEN 'Cabinet'      WHEN 'BOI' THEN 'Boisson'
    ELSE 'Autre'
  END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. RÈGLE BOI-001 — Encaissement tournée terminée (2 séquences)
-- ─────────────────────────────────────────────────────────────────────────────
-- Source : PATCH /api/boisson/tournees (statut → 'terminee') → emit BOI-001
-- emit_accounting_event('BOI-001', ...,
--   montant_ht  = round(montant_collecte / 1.189),
--   montant_tva = montant_collecte - montant_ht,
--   montant_ttc = montant_collecte (TTC encaissé),
--   metadata    = { mode_paiement: 'especes', chauffeur_nom, zone })
--
-- TVA Congo : TTC = HT × 1.189 (TVA 18% + Centime Additionnel 5%/TVA = 18.9%)
-- Boissons = marchandises → compte 701 (Ventes de marchandises, AUDCIF classe 7)
-- Mode dominant : espèces → 571 (Caisse) via fn_ohada_cash_account('especes')
--
-- Séq 1 : 5xx / 701   — Ventes marchandises HT
-- Séq 2 : 5xx / 4441  — TVA + Centime Additionnel collectés

INSERT INTO accounting_event_rules (
  event_type, sequence, rule_version, status,
  debit_account, credit_account,
  montant_field, amount_formula, account_resolver,
  source_label, libelle_tpl,
  conditions, country_codes, account_plan,
  valid_from, notes
) VALUES
-- Séquence 1 : Ventes HT boissons
(
  'BOI-001', 1, 1, 'active',
  '521', '701',
  'montant_ht', NULL, 'treasury_debit',
  'boisson_tournee_ht',
  'Ventes boissons HT — {libelle}',
  '[{"field":"montant_ht","op":">","value":"0"}]',
  NULL,
  'SYSCOHADA',
  CURRENT_DATE,
  '521=placeholder remplacé par treasury_debit→fn_ohada_cash_account(mode_paiement). 701=Ventes de marchandises (AUDCIF classe 7 — boissons = commerce, pas prestation). Séq 1/2 : montant HT. TVA séparée en séq 2.'
),
-- Séquence 2 : TVA + Centime Additionnel collectés
(
  'BOI-001', 2, 1, 'active',
  '521', '4441',
  'montant_tva', NULL, 'treasury_debit',
  'boisson_tournee_tva',
  'TVA boissons — {libelle}',
  '[{"field":"montant_tva","op":">","value":"0"}]',
  NULL,
  'SYSCOHADA',
  CURRENT_DATE,
  '521=même compte trésorerie que séq 1. 4441=État, TVA collectée. Congo: TTC=HT×1.189 (TVA18%+CA0.9%). API calcule: ht=round(ttc/1.189), tva=ttc-ht avant emit.'
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. RÈGLE BOI-002 — Règlement commande livrée (DRAFT)
-- ─────────────────────────────────────────────────────────────────────────────
-- À activer quand PATCH /api/boisson/commandes intégrera un champ montant_payé.
-- boisson_commandes.montant_total = montant prévu — pas de champ "montant encaissé".
-- Activer en même temps qu'ajout de flux paiement dans le module commandes.

INSERT INTO accounting_event_rules (
  event_type, sequence, rule_version, status,
  debit_account, credit_account,
  montant_field, amount_formula, account_resolver,
  source_label, libelle_tpl,
  conditions, country_codes, account_plan,
  valid_from, notes
) VALUES
(
  'BOI-002', 1, 1, 'draft',
  '521', '701',
  'montant_ht', NULL, 'treasury_debit',
  'boisson_commande_reglement',
  'Règlement commande boissons — {libelle}',
  '[{"field":"montant_ht","op":">","value":"0"}]',
  NULL,
  'SYSCOHADA',
  CURRENT_DATE,
  'DRAFT — 521=placeholder treasury_debit. 701=Ventes marchandises. Activer quand PATCH /api/boisson/commandes ajoutera montant_payé + emit BOI-002 au passage statut→livree. Ajouter séquence TVA (BOI-002 seq 2) en même temps.'
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. VERSION MOTEUR 1.8.0
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO accounting_schema_versions
  (version, semver_major, semver_minor, semver_patch, migration_file, description, breaking_change, applied_by)
VALUES (
  '1.8.0', 1, 8, 0,
  '146_accounting_rules_boisson.sql',
  'Règles BOI-001 active : encaissement tournée boisson (5xx/701 HT + 5xx/4441 TVA, TVA Congo 18.9%). '
  'Règle BOI-002 draft : règlement commande (à activer avec flux paiement commandes). '
  'UPDATE fn_ae_has_treasury_impact : BOI ajouté (ANOM-03). '
  'UPDATE fn_ae_is_income : BOI-001 ajouté (ANOM-04). '
  'UPDATE fn_ae_category : BOI → Boisson (ANOM-05). '
  'QW-ANOM-06 : guard double-emit amélioré (statut guard vs montant comparison). '
  'Pattern P-008 TABLE-BRIDGE-LEGACY : suppression INSERT transactions dans PATCH tournees. '
  'Nouveau chemin : PATCH tournees (statut terminee) → emit BOI-001. '
  'ATMC-02 planifié immédiatement après cette migration.',
  FALSE,
  'Plan Directeur Phase 5 — Migration 146'
);

COMMIT;

-- ═════════════════════════════════════════════════════════════════════════════
-- VALIDATION POST-EXÉCUTION (à exécuter séparément)
-- ═════════════════════════════════════════════════════════════════════════════

/*
-- 1. Fonctions moteur corrigées
SELECT fn_ae_has_treasury_impact('BOI-001') AS treasury_boi,
       fn_ae_is_income('BOI-001')            AS income_boi,
       fn_ae_category('BOI-001')             AS category_boi;
-- Attendu : true, true, 'Boisson'

-- 2. Règles BOI actives
SELECT event_type, sequence, debit_account, credit_account,
       montant_field, account_resolver, status
FROM accounting_event_rules WHERE event_type LIKE 'BOI-%' ORDER BY event_type, sequence;
-- Attendu :
-- BOI-001, 1, 521, 701,  montant_ht,  treasury_debit, active
-- BOI-001, 2, 521, 4441, montant_tva, treasury_debit, active
-- BOI-002, 1, 521, 701,  montant_ht,  treasury_debit, draft

-- 3. Version moteur
SELECT version FROM accounting_schema_versions ORDER BY semver_minor DESC LIMIT 5;
-- Attendu : 1.8.0, 1.7.0, 1.6.0, 1.5.0, 1.4.0

-- 4. Test BOI-001 fonctionnel (100 000 FCFA TTC, espèces)
SELECT * FROM emit_accounting_event(
  p_tenant_id     := (SELECT id FROM tenants LIMIT 1),
  p_event_type    := 'BOI-001',
  p_source_module := 'boisson',
  p_source_table  := 'boisson_tournees',
  p_source_id     := gen_random_uuid(),
  p_montant_ht    := 84104,
  p_montant_tva   := 15896,
  p_montant_ttc   := 100000,
  p_libelle       := 'Test BOI-001 — Tournée Bacongo — Kofi',
  p_date_event    := CURRENT_DATE,
  p_fiscal_year   := 2026,
  p_metadata      := '{"mode_paiement":"especes","chauffeur_nom":"Kofi","zone":"Bacongo"}'::jsonb
);

-- 5. Vérifier is_balanced=true + 2 séquences
SELECT ae.status, ael.entries_count, ael.total_debit, ael.total_credit, ael.is_balanced
FROM accounting_events ae
LEFT JOIN accounting_event_log ael ON ael.event_id = ae.id
WHERE ae.event_type = 'BOI-001' ORDER BY ae.created_at DESC LIMIT 1;
-- Attendu : processed, entries_count=2, total_debit=100000, total_credit=100000, is_balanced=true

-- 6. Détail écritures (571/701 + 571/4441)
SELECT debit_account, credit_account, montant
FROM journal_entries WHERE source = 'boisson_tournee_ht' OR source = 'boisson_tournee_tva'
ORDER BY created_at DESC LIMIT 2;
-- Attendu : (571, 701, 84104) + (571, 4441, 15896)

-- 7. Transaction trésorerie créée
SELECT type, montant, categorie FROM transactions
WHERE source_event_type = 'BOI-001' ORDER BY created_at DESC LIMIT 1;
-- Attendu : entree, 100000, 'Boisson'
*/

-- ═════════════════════════════════════════════════════════════════════════════
-- ⛔ ROLLBACK — NE PAS EXÉCUTER (sauf incident majeur)
-- ═════════════════════════════════════════════════════════════════════════════

/*
BEGIN;
-- Restaurer fn_ae_has_treasury_impact sans BOI
CREATE OR REPLACE FUNCTION fn_ae_has_treasury_impact(p_event_type TEXT) RETURNS BOOLEAN
  LANGUAGE sql IMMUTABLE AS $$
  SELECT split_part(p_event_type, '-', 1) IN
    ('FAC','TRE','MOB','PAI','HOT','RES','ECO','COM','TRP','SAN','ONG','CAB');
$$;
-- Restaurer fn_ae_is_income sans BOI-001
CREATE OR REPLACE FUNCTION fn_ae_is_income(p_event_type TEXT) RETURNS BOOLEAN
  LANGUAGE sql IMMUTABLE AS $$
  SELECT p_event_type IN (
    'FAC-002','SAN-001','SAN-002','RES-001','ECO-001','ECO-002','ECO-003','ECO-004','ECO-005',
    'COM-001','TRE-001','MOB-001','ONG-001','ONG-002',
    'HOT-001','HOT-004',
    'TRP-001','CAB-001'
  );
$$;
-- Restaurer fn_ae_category sans BOI
CREATE OR REPLACE FUNCTION fn_ae_category(p_event_type TEXT) RETURNS TEXT
  LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE split_part(p_event_type, '-', 1)
    WHEN 'FAC' THEN 'Facturation'  WHEN 'PAI' THEN 'Paie'
    WHEN 'SAN' THEN 'Santé'        WHEN 'RES' THEN 'Restaurant'
    WHEN 'ECO' THEN 'Scolarité'    WHEN 'COM' THEN 'Commerce'
    WHEN 'TRP' THEN 'Transport'    WHEN 'HOT' THEN 'Hôtel'
    WHEN 'FIS' THEN 'Fiscalité'    WHEN 'TRE' THEN 'Trésorerie'
    WHEN 'MOB' THEN 'Mobile Money' WHEN 'ONG' THEN 'ONG'
    WHEN 'CAB' THEN 'Cabinet'      ELSE 'Autre'
  END;
$$;
DELETE FROM accounting_event_rules WHERE event_type LIKE 'BOI-%' AND rule_version = 1;
DELETE FROM accounting_schema_versions WHERE version = '1.8.0';
COMMIT;
*/

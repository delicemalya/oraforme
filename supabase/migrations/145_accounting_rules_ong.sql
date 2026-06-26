-- ═════════════════════════════════════════════════════════════════════════════
-- Migration 145 — Règles comptables SYSCOHADA — Module ONG
-- ═════════════════════════════════════════════════════════════════════════════
--
-- Plan Directeur Oraforme — Phase 5 (septième migration métier)
-- Gouvernance : Audit → Implémentation → Quick Wins → Validation →
--               Audit cohérence → Certification → Documentation
--
-- PÉRIMÈTRE :
--   ✅ Règle ONG-001 active : don reçu — 5xx/741 (TVA=0, dons CEMAC exonérés)
--   ✅ Règle ONG-002 draft  : restitution de subvention (annulation — direction inverse)
--   ✅ Version moteur : 1.7.0
--
-- PATTERN : P-008 TABLE-BRIDGE-LEGACY
--   Pas de trigger dédié ONG — route écrivait directement dans transactions.
--   Migration = supprimer INSERT transactions dans POST /api/ong/dons,
--   ajouter emit ONG-001 (TypeScript — hors SQL, dans ce même cycle).
--
-- MOTEUR — ONG état avant mig.145 :
--   fn_ae_has_treasury_impact : ONG ∈ liste ✓ (mig.138)
--   fn_ae_is_income           : ONG-001 ✓, ONG-002 ✓ (pré-déclarés mig.138)
--   fn_ae_category            : ONG → 'ONG' ✓ (mig.138)
--   accounting_event_rules    : 0 règle ONG active avant mig.145 ❌ → corrigé ici
--
-- HORS SCOPE (documenté) :
--   - ONG-002 ∈ fn_ae_is_income mais DRAFT — à corriger lors activation (QWT-03)
--   - Dashboards ONG : KPIs statiques (—) — amélioration produit future
--
-- VÉRIFICATION SYSCOHADA (Congo-Brazzaville, 100 000 FCFA, virement) :
--   ONG-001 :
--     Séq 1 : 521  / 741   = 100 000 FCFA (don reçu, TVA=0)
--     Débit 521 = 100 000 ✓ (Banque — fn_ohada_cash_account('virement'))
--     Crédit 741 = 100 000 ✓ (Subventions d'exploitation — classe 7 SYSCOHADA)
--     TVA = 0 (dons non soumis à TVA selon droit CEMAC) ✓
--
-- COMPTES SYSCOHADA MOBILISÉS :
--   521  Banque (virement/carte) — fn_ohada_cash_account si mode='virement'
--   571  Caisse (espèces)
--   5711 Mobile Airtel / 5712 Mobile MTN
--   741  Subventions d'exploitation reçues (classe 7 AUDCIF OHADA)
--   (ONG-002 draft : 741/521 — restitution de subvention, sens inverse)
--
-- QUICK WINS TRANSVERSES IDENTIFIÉS (QWT) :
--   QWT-01 : ECO-002 ∈ fn_ae_is_income (remboursement = sortie) — DRAFT → reporter
--   QWT-02 : HOT-004 ∈ fn_ae_is_income sans règle définie — nul → documenter
--   QWT-03 : ONG-002 ∈ fn_ae_is_income (restitution = sortie) — DRAFT → reporter
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
    SELECT 1 FROM accounting_schema_versions WHERE version = '1.6.0'
  ) THEN
    RAISE EXCEPTION 'Migration 144 non appliquée — version 1.6.0 manquante.';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_name = 'ong_dons'
  ) THEN
    RAISE EXCEPTION 'Table ong_dons absente — migration 066 non appliquée.';
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. RÈGLE ONG-001 — Don reçu
-- ─────────────────────────────────────────────────────────────────────────────
-- Source : POST /api/ong/dons → emit ONG-001
-- emit_accounting_event('ONG-001', ...,
--   montant_ht  = montant (don — pas de décomposition HT/TVA, TVA=0),
--   montant_tva = 0,
--   montant_ttc = montant,
--   metadata    = { mode_paiement, donateur, programme_id })
--
-- TVA = 0 : les dons, subventions et aides ne sont pas soumis à TVA en droit CEMAC.
-- 1 séquence seulement — pas de séquence TVA contrairement à HOT ou FAC.
--
-- Séq 1 : 5xx / 741 — Don reçu (montant brut = montant net)

INSERT INTO accounting_event_rules (
  event_type, sequence, rule_version, status,
  debit_account, credit_account,
  montant_field, amount_formula, account_resolver,
  source_label, libelle_tpl,
  conditions, country_codes, account_plan,
  valid_from, notes
) VALUES
(
  'ONG-001', 1, 1, 'active',
  '521', '741',
  'montant_ht', NULL, 'treasury_debit',
  'ong_don_recu',
  'Don reçu — {libelle}',
  '[{"field":"montant_ht","op":">","value":"0"}]',
  NULL,
  'SYSCOHADA',
  CURRENT_DATE,
  '521=placeholder remplacé par treasury_debit→fn_ohada_cash_account(mode_paiement). 741=Subventions d''exploitation reçues (classe 7 SYSCOHADA AUDCIF). TVA=0 : dons/subventions non soumis à TVA en droit CEMAC. 1 séquence (pas de décomposition HT/TVA).'
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. RÈGLE ONG-002 — Restitution de subvention (DRAFT)
-- ─────────────────────────────────────────────────────────────────────────────
-- À activer si un module de remboursement/restitution de don est créé.
-- Sens inverse de ONG-001 : DEBIT 741 (annulation produit) / CREDIT 5xx (sortie trésorerie).
--
-- ATTENTION — QWT-03 : ONG-002 est actuellement dans fn_ae_is_income=true (mig.138+144).
-- Cela la classerait en type='entree' alors qu'une restitution est type='sortie'.
-- Impact nul tant que ONG-002 reste DRAFT. Corriger fn_ae_is_income en même temps
-- qu'on activera ONG-002.

INSERT INTO accounting_event_rules (
  event_type, sequence, rule_version, status,
  debit_account, credit_account,
  montant_field, amount_formula, account_resolver,
  source_label, libelle_tpl,
  conditions, country_codes, account_plan,
  valid_from, notes
) VALUES
(
  'ONG-002', 1, 1, 'draft',
  '741', '521',
  'montant_ht', NULL, 'treasury_credit',
  'ong_restitution',
  'Restitution subvention — {libelle}',
  '[{"field":"montant_ht","op":">","value":"0"}]',
  NULL,
  'SYSCOHADA',
  CURRENT_DATE,
  'DRAFT — 741=Subventions d''exploitation (annulé au débit). 521=placeholder treasury_credit. ATTENTION : fn_ae_is_income(''ONG-002'')=true est INCORRECT pour une restitution (type devrait être sortie). Corriger fn_ae_is_income lors de l''activation ONG-002 (QWT-03 documenté mig.145).'
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. VERSION MOTEUR 1.7.0
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO accounting_schema_versions
  (version, semver_major, semver_minor, semver_patch, migration_file, description, breaking_change, applied_by)
VALUES (
  '1.7.0', 1, 7, 0,
  '145_accounting_rules_ong.sql',
  'Règle ONG-001 active : don reçu (5xx/741, TVA=0, 1 séquence). '
  'Règle ONG-002 draft : restitution de subvention (741/5xx). '
  'Pattern P-008 TABLE-BRIDGE-LEGACY : suppression INSERT transactions dans POST /api/ong/dons (TypeScript). '
  'Nouveau chemin : POST /api/ong/dons → emit ONG-001. '
  'fn_ae_is_income non modifiée (ONG-001/ONG-002 pré-déclarés depuis mig.138). '
  'QWT-01/02/03 identifiés (règles DRAFT — impact nul).',
  FALSE,
  'Plan Directeur Phase 5 — Migration 145'
);

COMMIT;

-- ═════════════════════════════════════════════════════════════════════════════
-- VALIDATION POST-EXÉCUTION (à exécuter séparément)
-- ═════════════════════════════════════════════════════════════════════════════

/*
-- 1. Règles ONG actives
SELECT event_type, sequence, debit_account, credit_account, montant_field, account_resolver, status
FROM accounting_event_rules WHERE event_type LIKE 'ONG-%' ORDER BY event_type, sequence;
-- Attendu :
-- ONG-001, 1, 521, 741, montant_ht, treasury_debit,  active
-- ONG-002, 1, 741, 521, montant_ht, treasury_credit, draft

-- 2. Version moteur
SELECT version FROM accounting_schema_versions ORDER BY semver_minor DESC LIMIT 4;
-- Attendu : 1.7.0, 1.6.0, 1.5.0, 1.4.0

-- 3. Test ONG-001 fonctionnel (100 000 FCFA, virement)
SELECT * FROM emit_accounting_event(
  p_tenant_id     := (SELECT id FROM tenants LIMIT 1),
  p_event_type    := 'ONG-001',
  p_source_module := 'ong',
  p_source_table  := 'ong_dons',
  p_source_id     := gen_random_uuid(),
  p_montant_ht    := 100000,
  p_montant_tva   := 0,
  p_montant_ttc   := 100000,
  p_libelle       := 'Test ONG-001 — Don UNICEF — Programme Eau',
  p_date_event    := CURRENT_DATE,
  p_fiscal_year   := 2026,
  p_metadata      := '{"mode_paiement": "virement", "donateur": "UNICEF", "programme_id": null}'::jsonb
);

-- 4. Vérifier is_balanced=true + 1 séquence
SELECT ae.status, ael.entries_count, ael.total_debit, ael.total_credit, ael.is_balanced
FROM accounting_events ae
LEFT JOIN accounting_event_log ael ON ael.event_id = ae.id
WHERE ae.event_type = 'ONG-001' ORDER BY ae.created_at DESC LIMIT 1;
-- Attendu : processed, entries_count=1, total_debit=100000, total_credit=100000, is_balanced=true

-- 5. Détail écriture
SELECT je.compte_debit, je.compte_credit, je.montant, je.libelle
FROM journal_entries je
WHERE je.source_event_type = 'ONG-001'
ORDER BY je.created_at DESC LIMIT 1;
-- Attendu : (521, 741, 100000, 'Don reçu — Test ONG-001...')

-- 6. Transaction créée (type='entree', categorie='ONG')
SELECT type, montant, source, source_event_type
FROM transactions
WHERE source_event_type = 'ONG-001' ORDER BY created_at DESC LIMIT 1;
-- Attendu : entree, 100000, accounting_engine, ONG-001
*/

-- ═════════════════════════════════════════════════════════════════════════════
-- ⛔ ROLLBACK — NE PAS EXÉCUTER (sauf incident majeur)
-- ═════════════════════════════════════════════════════════════════════════════

/*
BEGIN;
DELETE FROM accounting_event_rules WHERE event_type LIKE 'ONG-%' AND rule_version = 1;
DELETE FROM accounting_schema_versions WHERE version = '1.7.0';
COMMIT;
*/

-- ═════════════════════════════════════════════════════════════════════════════
-- Migration 141 — Règles comptables SYSCOHADA — Module Paie (PAI)
-- ═════════════════════════════════════════════════════════════════════════════
--
-- Plan Directeur Oraforme — Phase 4.3 (troisième migration métier)
-- Méthode : cycle Audit → Implémentation → Validation → Commit
--
-- PÉRIMÈTRE :
--   ✅ Règles accounting_event_rules PAI-001 (constatation) — 4 séquences
--   ✅ Règles accounting_event_rules PAI-002 (paiement net) — 1 séquence
--   ✅ Règles accounting_event_rules PAI-003 (acomptes)     — 1 séquence
--   ✅ Règles accounting_event_rules PAI-004 à PAI-005      — DRAFT
--   ✅ Suppression trigger trg_bulletins_paie
--      (fn_bulletins_paie_to_journal CONSERVÉE pour rollback)
--   ✅ Version moteur : 1.3.0
--
-- TRIGGER SUPPRIMÉ :
--   trg_bulletins_paie → fn_bulletins_paie_to_journal (migration 136)
--   Remplacé par : PAI-001/002/003 via emit_accounting_event() dans les routes
--     - PATCH /api/rh/paie/[id] statut→validee : PAI-001
--     - PATCH /api/rh/paie/[id] statut→payee   : PAI-002
--     - POST  /api/rh/acomptes                  : PAI-003
--
-- VÉRIFICATION SYSCOHADA (Congo-Brazzaville LF 2026, brut=1 000 000 FCFA) :
--   PAI-001 :
--     661 / 421  brut=1 000 000         Charge salaire brut
--     664 / 431  cnss_patro=202 850     CNSS patronal (20,285%)
--     421 / 431  cnss_sal=40 000        CNSS salariale retenue (4%)
--     421 / 447  irpp=5 360             IRPP retenu à la source
--     Solde 421 après PAI-001 = 1 000 000 - 40 000 - 5 360 = 954 640 ✓
--   PAI-002 :
--     421 / 5xx  net=954 640            Virement/espèces net
--     Solde 421 = 0 ✓ — double entrée fermée ✓
--   PAI-003 :
--     421 / 5xx  acompte=X              Décaissement acompte en cours de mois
--
-- SKILLS mobilisés : ohada-comptabilite, droit-social-rh, fiscalite-cemac
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
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'accounting_event_rules'
  ) THEN
    RAISE EXCEPTION 'Migration 138 non appliquée — accounting_event_rules manquante.';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM accounting_schema_versions WHERE version = '1.2.0'
  ) THEN
    RAISE EXCEPTION 'Migration 140 non appliquée — version 1.2.0 manquante.';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_name = 'bulletins_paie'
  ) THEN
    RAISE EXCEPTION 'Table bulletins_paie absente — migration 077 non appliquée.';
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. RÈGLES PAI-001 — Constatation salaire (sur validation bulletin)
-- ─────────────────────────────────────────────────────────────────────────────
-- Source : PATCH /api/rh/paie/[id] → statut = 'validee'
-- emit_accounting_event('PAI-001', ..., montant_ht=brut, metadata={cnss_patronal, cnss_salarie, irpp})
--
-- 4 écritures :
--   Séq 1 : 661 / 421  Salaire brut → charge de personnel
--   Séq 2 : 664 / 431  CNSS patronal → charges sociales patronales
--   Séq 3 : 421 / 431  CNSS salariale retenue → réduit la dette 421
--   Séq 4 : 421 / 447  IRPP retenu à la source → réduit la dette 421

INSERT INTO accounting_event_rules (
  event_type, sequence, rule_version, status,
  debit_account, credit_account,
  montant_field, amount_formula, account_resolver,
  source_label, libelle_tpl,
  conditions, country_codes, account_plan,
  valid_from, notes
) VALUES

-- Séquence 1 : Salaire brut — Charge de personnel
(
  'PAI-001', 1, 1, 'active',
  '661', '421',
  'montant_ht', NULL, NULL,
  'paie_brut',
  'Bulletin paie {mois}/{annee} — {employe_nom} — brut',
  '[{"field":"montant_ht","op":">","value":"0"}]',
  NULL,
  'SYSCOHADA',
  CURRENT_DATE,
  '661=Rémunérations directes SYSCOHADA. 421=Personnel, rémunérations dues. Source: AUDCIF art.53, plan de comptes révisé 2017.'
),

-- Séquence 2 : CNSS patronal — Charges sociales patronales
(
  'PAI-001', 2, 1, 'active',
  '664', '431',
  'metadata.cnss_patronal', NULL, NULL,
  'paie_cnss_patronal',
  'Bulletin paie {mois}/{annee} — {employe_nom} — CNSS patronal',
  '[{"field":"metadata.cnss_patronal","op":">","value":"0"}]',
  NULL,
  'SYSCOHADA',
  CURRENT_DATE,
  '664=Charges sociales patronales. 431=Sécurité sociale CNSS/CNPS. Taux Congo: VID 8%+AF 10,035%+AT 2,25%+TUS 3%+Méd 0,5% (LF 2026).'
),

-- Séquence 3 : CNSS salariale retenue — réduit la dette 421 envers l''employé
(
  'PAI-001', 3, 1, 'active',
  '421', '431',
  'metadata.cnss_salarie', NULL, NULL,
  'paie_cnss_salarie',
  'Bulletin paie {mois}/{annee} — {employe_nom} — CNSS salariale',
  '[{"field":"metadata.cnss_salarie","op":">","value":"0"}]',
  NULL,
  'SYSCOHADA',
  CURRENT_DATE,
  'Retenue CNSS salariale (4% VID, plafond 1 200 000 FCFA, LF 2026 Congo). 421 débité = réduit la rémunération due. 431 crédité = dette envers CNSS.'
),

-- Séquence 4 : IRPP retenu à la source — réduit la dette 421
(
  'PAI-001', 4, 1, 'active',
  '421', '447',
  'metadata.irpp', NULL, NULL,
  'paie_irpp',
  'Bulletin paie {mois}/{annee} — {employe_nom} — IRPP',
  '[{"field":"metadata.irpp","op":">","value":"0"}]',
  NULL,
  'SYSCOHADA',
  CURRENT_DATE,
  'IRPP retenu à la source (barème progressif CGI Congo art.76). 421 débité = réduit la rémunération due. 447=Retenues à la source État.'
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. RÈGLES PAI-002 — Paiement net (sur statut payee)
-- ─────────────────────────────────────────────────────────────────────────────
-- Source : PATCH /api/rh/paie/[id] → statut = 'payee'
-- emit_accounting_event('PAI-002', ..., montant_ttc=net, metadata={mode_paiement})
--
-- 1 écriture :
--   421 / 5xx  Net versé — compte trésorerie résolu par mode_paiement

INSERT INTO accounting_event_rules (
  event_type, sequence, rule_version, status,
  debit_account, credit_account,
  montant_field, amount_formula, account_resolver,
  source_label, libelle_tpl,
  conditions, country_codes, account_plan,
  valid_from, notes
) VALUES
(
  'PAI-002', 1, 1, 'active',
  '421',
  '521',  -- placeholder, remplacé par treasury_credit → fn_ohada_cash_account(mode_paiement)
  'montant_ttc', NULL, 'treasury_credit',
  'paie_paiement',
  'Paiement salaire {mois}/{annee} — {employe_nom}',
  '[{"field":"montant_ttc","op":">","value":"0"}]',
  NULL,
  'SYSCOHADA',
  CURRENT_DATE,
  'Apurement dette salariale. 421 débité (solde → 0). Compte trésorerie résolu dynamiquement: virement→521, especes→571, mobile→5711/5712 (fn_ohada_cash_account).'
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. RÈGLES PAI-003 — Acompte sur salaire
-- ─────────────────────────────────────────────────────────────────────────────
-- Source : POST /api/rh/acomptes
-- emit_accounting_event('PAI-003', ..., montant_ht=montant_acompte, metadata={mode_paiement})
--
-- 1 écriture :
--   421 / 5xx  Acompte décaissé — compte trésorerie résolu par mode_paiement

INSERT INTO accounting_event_rules (
  event_type, sequence, rule_version, status,
  debit_account, credit_account,
  montant_field, amount_formula, account_resolver,
  source_label, libelle_tpl,
  conditions, country_codes, account_plan,
  valid_from, notes
) VALUES
(
  'PAI-003', 1, 1, 'active',
  '421',
  '521',  -- placeholder, remplacé par treasury_credit
  'montant_ht', NULL, 'treasury_credit',
  'paie_acompte',
  'Acompte {mois_impute}/{annee_imputee} — {employe_nom}',
  '[{"field":"montant_ht","op":">","value":"0"}]',
  NULL,
  'SYSCOHADA',
  CURRENT_DATE,
  'Acompte sur salaire. 421=Avances et acomptes versés au personnel (solde apuré lors du bulletin final). Compte trésorerie résolu dynamiquement.'
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. RÈGLES DRAFT — PAI-004, PAI-005
-- ─────────────────────────────────────────────────────────────────────────────

-- PAI-004 : Provision congés payés (SYSCOHADA révisé — à activer si gestion CP)
INSERT INTO accounting_event_rules (
  event_type, sequence, rule_version, status,
  debit_account, credit_account,
  montant_field, amount_formula, account_resolver,
  source_label, libelle_tpl,
  conditions, country_codes, account_plan,
  valid_from, notes
) VALUES
(
  'PAI-004', 1, 1, 'draft',
  '661', '4282',
  'montant_ht', NULL, NULL,
  'paie_provision_cp',
  'Provision congés payés {mois}/{annee}',
  '[{"field":"montant_ht","op":">","value":"0"}]',
  NULL,
  'SYSCOHADA',
  CURRENT_DATE,
  'DRAFT — 4282=Dettes provisionnées congés payés. À activer si module CP activé. Calcul: brut/12 × jours_cp_acquis/30.'
);

-- PAI-005 : Extourne bulletin (annulation d''un bulletin validé)
INSERT INTO accounting_event_rules (
  event_type, sequence, rule_version, status,
  debit_account, credit_account,
  montant_field, amount_formula, account_resolver,
  source_label, libelle_tpl,
  conditions, country_codes, account_plan,
  valid_from, notes
) VALUES
(
  'PAI-005', 1, 1, 'draft',
  '421', '661',
  'montant_ht', NULL, NULL,
  'paie_extourne',
  'Extourne bulletin paie {mois}/{annee} — {employe_nom}',
  '[{"field":"montant_ht","op":">","value":"0"}]',
  NULL,
  'SYSCOHADA',
  CURRENT_DATE,
  'DRAFT — Extourne comptable inverse de PAI-001. À activer via fn_reverse_accounting_event() lors annulation bulletin. Séquences 2-4 à compléter.'
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. SUPPRESSION DU TRIGGER LEGACY
-- ─────────────────────────────────────────────────────────────────────────────
-- Remplacé par PAI-001/002/003 via emit_accounting_event() dans les routes API.
-- fn_bulletins_paie_to_journal() CONSERVÉE — ne pas DROP — nécessaire pour rollback.

DROP TRIGGER IF EXISTS trg_bulletins_paie ON bulletins_paie;

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. VERSION MOTEUR 1.3.0
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO accounting_schema_versions
  (version, semver_major, semver_minor, semver_patch, migration_file, description, breaking_change, applied_by)
VALUES (
  '1.3.0', 1, 3, 0,
  '141_accounting_rules_paie.sql',
  'Règles PAI-001 à PAI-005. PAI-001 (constatation 4 séquences), PAI-002 (paiement net), '
  'PAI-003 (acomptes) actives. PAI-004/005 en draft. '
  'Trigger trg_bulletins_paie supprimé — remplacé par emit_accounting_event() dans PATCH /api/rh/paie/[id] et POST /api/rh/acomptes.',
  FALSE,
  'Plan Directeur Phase 4.3 — Migration 141'
);

COMMIT;

-- ═════════════════════════════════════════════════════════════════════════════
-- VALIDATION POST-EXÉCUTION (à exécuter séparément pour vérification)
-- ═════════════════════════════════════════════════════════════════════════════

/*
-- 1. Vérifier les règles PAI actives
SELECT event_type, sequence, debit_account, credit_account, montant_field,
       account_resolver, status
FROM accounting_event_rules
WHERE event_type LIKE 'PAI-%'
ORDER BY event_type, sequence;

-- Résultat attendu :
-- PAI-001, 1, 661, 421, montant_ht,              NULL,           active
-- PAI-001, 2, 664, 431, metadata.cnss_patronal,  NULL,           active
-- PAI-001, 3, 421, 431, metadata.cnss_salarie,   NULL,           active
-- PAI-001, 4, 421, 447, metadata.irpp,           NULL,           active
-- PAI-002, 1, 421, 521, montant_ttc,             treasury_credit, active
-- PAI-003, 1, 421, 521, montant_ht,              treasury_credit, active
-- PAI-004, 1, 661, 4282, montant_ht,             NULL,           draft
-- PAI-005, 1, 421, 661,  montant_ht,             NULL,           draft

-- 2. Vérifier que le trigger est bien supprimé
SELECT tgname FROM pg_trigger WHERE tgname = 'trg_bulletins_paie';
-- Résultat attendu : 0 lignes

-- 3. Vérifier que fn_bulletins_paie_to_journal existe toujours (pour rollback)
SELECT proname FROM pg_proc WHERE proname = 'fn_bulletins_paie_to_journal';
-- Résultat attendu : 1 ligne

-- 4. Vérifier la version
SELECT version, applied_at FROM accounting_schema_versions ORDER BY semver_major, semver_minor;
-- Résultat attendu : 1.0.0, 1.1.0, 1.2.0, 1.3.0

-- 5. Balance SYSCOHADA test (brut=1 000 000, CNSS=40 000, IRPP=5 360, net=954 640)
-- PAI-001 : Débit total = 661(1M) + 664(202 850) = 1 202 850
--           Crédit total= 421(1M) + 431(202 850+40 000) + 447(5 360) = ?
--           Crédit 421 = 1 000 000
--           Débit  421 = 40 000 + 5 360 = 45 360
--           Solde  421 = 954 640 ✓
-- PAI-002 : Débit 421 = 954 640 → Solde 421 = 0 ✓
*/

-- ═════════════════════════════════════════════════════════════════════════════
-- ⛔ ROLLBACK — NE PAS EXÉCUTER (sauf incident majeur)
-- ═════════════════════════════════════════════════════════════════════════════

/*
BEGIN;

-- Restaurer le trigger (la fonction n'a pas été supprimée)
DROP TRIGGER IF EXISTS trg_bulletins_paie ON bulletins_paie;
CREATE TRIGGER trg_bulletins_paie
  AFTER UPDATE OF statut ON bulletins_paie
  FOR EACH ROW
  EXECUTE FUNCTION fn_bulletins_paie_to_journal();

-- Supprimer les règles PAI
DELETE FROM accounting_event_rules WHERE event_type LIKE 'PAI-%' AND rule_version = 1;

-- Rétrograder la version
DELETE FROM accounting_schema_versions WHERE version = '1.3.0';

COMMIT;
*/

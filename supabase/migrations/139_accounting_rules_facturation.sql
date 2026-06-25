-- ═════════════════════════════════════════════════════════════════════════════
-- Migration 139 — Règles comptables SYSCOHADA — Module Facturation (FAC)
-- ═════════════════════════════════════════════════════════════════════════════
--
-- Plan Directeur Oraforme — Phase 4.1 (première migration métier)
-- DoD       : docs/plan-directeur/definition-of-done-migrations-metier.md
-- Rapport   : docs/plan-directeur/migration-139-facturation-fac.md
-- Catalogue : docs/plan-directeur/phase3-catalogue-evenements-comptables.md
--
-- PÉRIMÈTRE :
--   ✅ Règles accounting_event_rules pour FAC-001 et FAC-002 (ACTIVE)
--   ✅ Règles accounting_event_rules pour FAC-003 à FAC-006 (DRAFT — futurs)
--   ✅ Suppression des triggers legacy (fn_facture_issued_to_journal, fn_facture_paid_to_journal)
--   ✅ Les routes API (TypeScript) sont mises à jour séparément (même commit)
--
-- TRIGGERS SUPPRIMÉS :
--   trg_facture_issued → fn_facture_issued_to_journal (migration 046, réécrit 137)
--     Remplacé par : règle FAC-001 via emit_accounting_event()
--   trg_facture_paid   → fn_facture_paid_to_journal  (migration 130, réécrit 137)
--     Remplacé par : règle FAC-002 via emit_accounting_event()
--
-- VÉRIFICATION SYSCOHADA (Congo-Brazzaville, LF 2026) :
--   FAC-001 (Facture émise) :
--     411 Clients            / 706 Ventes de services      → montant_ht
--     411 Clients            / 4441 TVA collectée          → montant_tva (18%)
--     411 Clients            / 447 Retenues à la source    → metadata.ca (5% × TVA = CA)
--   FAC-002 (Règlement facture) :
--     5xx Trésorerie (mode)  / 411 Clients                 → montant_ttc
--
-- SKILL mobilisé : ohada-comptabilite, fiscalite-cemac
--
-- ═════════════════════════════════════════════════════════════════════════════
-- ⚡ BLOC À EXÉCUTER
-- ═════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- 0. Prérequis : vérifier que la migration 138 est bien appliquée
-- ─────────────────────────────────────────────────────────────────────────────

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'accounting_event_rules'
  ) THEN
    RAISE EXCEPTION 'Migration 138 non appliquée — accounting_event_rules manquante. Appliquer 138 en premier.';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM accounting_schema_versions WHERE version = '1.0.0'
  ) THEN
    RAISE EXCEPTION 'accounting_schema_versions version 1.0.0 non trouvée — migration 138 incomplète.';
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. RÈGLES FAC-001 — Facture émise (statut: envoyee)
-- ─────────────────────────────────────────────────────────────────────────────
-- Source métier : table 'factures', transition statut → 'envoyee'
-- Déclencheur TypeScript : emit_accounting_event('FAC-001', ...) dans PATCH /api/factures/[id]
--                          et POST /api/factures (si créée directement en 'envoyee')
--
-- 3 écritures :
--   Séquence 1 : Clients (411) / Ventes de services (706)  — montant HT
--   Séquence 2 : Clients (411) / TVA collectée (4441)      — montant TVA 18%
--   Séquence 3 : Clients (411) / Retenues source (447)     — Centime Additionnel 5%×TVA

INSERT INTO accounting_event_rules (
  event_type, sequence, rule_version, status,
  debit_account, credit_account,
  montant_field, amount_formula, account_resolver,
  source_label, libelle_tpl,
  conditions, country_codes, account_plan,
  valid_from, notes
) VALUES

-- Séquence 1 : Vente HT → 706
(
  'FAC-001', 1, 1, 'active',
  '411', '706',
  'montant_ht', NULL, NULL,
  'factures_emises',
  'Facture {piece_number} — {client_name} — HT',
  '[{"field":"montant_ht","op":">","value":"0"}]',
  NULL,  -- toutes juridictions OHADA (compte 706 = universel)
  'SYSCOHADA',
  CURRENT_DATE,
  'Comptabilisation vente HT. 706 = Ventes de services (SYSCOHADA). Vérifier si 701 (marchandises) selon activité du tenant.'
),

-- Séquence 2 : TVA collectée → 4441
(
  'FAC-001', 2, 1, 'active',
  '411', '4441',
  'montant_tva', NULL, NULL,
  'factures_tva',
  'Facture {piece_number} — {client_name} — TVA 18%',
  '[{"field":"montant_tva","op":">","value":"0"}]',
  NULL,
  'SYSCOHADA',
  CURRENT_DATE,
  'TVA collectée 18% (Congo-Brazzaville LF 2026). 4441 = État TVA facturée SYSCOHADA révisé 2017.'
),

-- Séquence 3 : Centime Additionnel (CA) 5% de la TVA → 447
-- CA est passé dans metadata.ca par l'appelant (calculerTVACongo retourne ca séparément)
(
  'FAC-001', 3, 1, 'active',
  '411', '447',
  'metadata.ca', NULL, NULL,
  'factures_ca',
  'Facture {piece_number} — {client_name} — CA 5%',
  '[{"field":"metadata.ca","op":">","value":"0"}]',
  ARRAY['CG'],  -- Centime Additionnel spécifique Congo-Brazzaville
  'SYSCOHADA',
  CURRENT_DATE,
  'Centime Additionnel Congo : 5% de la TVA collectée (= 0,9% du HT). 447 = Retenues à la source. Source: LF 2026 Congo Art. TVA.'
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. RÈGLES FAC-002 — Règlement facture (statut: payee)
-- ─────────────────────────────────────────────────────────────────────────────
-- Source métier : table 'paiements_factures' + transition factures.statut → 'payee'
-- Déclencheur TypeScript : emit_accounting_event('FAC-002', ...) dans PATCH /api/factures/[id]
--
-- 1 écriture :
--   5xx Trésorerie (selon mode_paiement) / 411 Clients — montant TTC

INSERT INTO accounting_event_rules (
  event_type, sequence, rule_version, status,
  debit_account, credit_account,
  montant_field, amount_formula, account_resolver,
  source_label, libelle_tpl,
  conditions, country_codes, account_plan,
  valid_from, notes
) VALUES
(
  'FAC-002', 1, 1, 'active',
  '521',  -- Banques — valeur par défaut, remplacée par account_resolver
  '411',
  'montant_ttc', NULL, 'treasury_debit',
  -- treasury_debit → fn_ae_resolve_treasury(metadata) → fn_ohada_cash_account(metadata.mode_paiement)
  -- Résolution : virement→521, especes→571, mobile_money→5714, cheque→521
  'factures_paiement',
  'Reglement facture {piece_number} — {client_name}',
  '[{"field":"montant_ttc","op":">","value":"0"}]',
  NULL,
  'SYSCOHADA',
  CURRENT_DATE,
  'Apurement créance client. Compte trésorerie résolu dynamiquement depuis metadata.mode_paiement via fn_ohada_cash_account().'
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. RÈGLES FAC-003 à FAC-006 — En attente d'implémentation UI (DRAFT)
-- ─────────────────────────────────────────────────────────────────────────────
-- Ces règles sont pré-définies mais en statut 'draft' car les workflows correspondants
-- n'existent pas encore dans l'application. Elles seront activées lors de l'ajout
-- de ces fonctionnalités.

-- FAC-003 : Avoir émis (note de crédit) — inverse de FAC-001
INSERT INTO accounting_event_rules (
  event_type, sequence, rule_version, status,
  debit_account, credit_account,
  montant_field, amount_formula, account_resolver,
  source_label, libelle_tpl, conditions, country_codes, account_plan, valid_from, notes
) VALUES
-- Séq 1 : Annulation vente HT
('FAC-003', 1, 1, 'draft', '706', '411', 'montant_ht', NULL, NULL,
 'factures_avoir', 'Avoir {piece_number} — {client_name} — HT',
 '[{"field":"montant_ht","op":">","value":"0"}]', NULL, 'SYSCOHADA', CURRENT_DATE,
 'DRAFT — Avoir sur vente. Inverse de FAC-001 séquence 1. À activer lors de l''implémentation UI avoir.'),
-- Séq 2 : Annulation TVA collectée
('FAC-003', 2, 1, 'draft', '4441', '411', 'montant_tva', NULL, NULL,
 'factures_avoir_tva', 'Avoir {piece_number} — {client_name} — TVA annulée',
 '[{"field":"montant_tva","op":">","value":"0"}]', NULL, 'SYSCOHADA', CURRENT_DATE,
 'DRAFT — Extourne TVA sur avoir. À activer lors de l''implémentation UI avoir.'),
-- Séq 3 : Annulation CA (Congo)
('FAC-003', 3, 1, 'draft', '447', '411', 'metadata.ca', NULL, NULL,
 'factures_avoir_ca', 'Avoir {piece_number} — {client_name} — CA annulé',
 '[{"field":"metadata.ca","op":">","value":"0"}]', ARRAY['CG'], 'SYSCOHADA', CURRENT_DATE,
 'DRAFT — Extourne CA sur avoir. Congo uniquement. À activer lors de l''implémentation UI avoir.');

-- FAC-004 : Facture annulée (extourne comptable de FAC-001)
-- Gérée via fn_reverse_accounting_event() — pas de règle additionnelle nécessaire ici
-- Le moteur génère les écritures inverses automatiquement via l'extourne

-- FAC-005 : Provision créance douteuse
INSERT INTO accounting_event_rules (
  event_type, sequence, rule_version, status,
  debit_account, credit_account,
  montant_field, amount_formula, account_resolver,
  source_label, libelle_tpl, conditions, country_codes, account_plan, valid_from, notes
) VALUES
('FAC-005', 1, 1, 'draft', '6913', '491', 'montant_ttc', NULL, NULL,
 'factures_provision', 'Provision créance douteuse — {client_name}',
 '[{"field":"montant_ttc","op":">","value":"0"}]', NULL, 'SYSCOHADA', CURRENT_DATE,
 'DRAFT — 6913 = Dotations provisions créances douteuses. 491 = Clients douteux SYSCOHADA. À activer sur workflow relance.');

-- FAC-006 : Reprise provision (créance recouvrée)
INSERT INTO accounting_event_rules (
  event_type, sequence, rule_version, status,
  debit_account, credit_account,
  montant_field, amount_formula, account_resolver,
  source_label, libelle_tpl, conditions, country_codes, account_plan, valid_from, notes
) VALUES
('FAC-006', 1, 1, 'draft', '491', '7913', 'montant_ttc', NULL, NULL,
 'factures_reprise_provision', 'Reprise provision — {client_name}',
 '[{"field":"montant_ttc","op":">","value":"0"}]', NULL, 'SYSCOHADA', CURRENT_DATE,
 'DRAFT — 7913 = Reprises provisions créances douteuses. 491 extourné lors du recouvrement.');

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. SUPPRESSION DES TRIGGERS LEGACY
-- ─────────────────────────────────────────────────────────────────────────────
-- Ces triggers sont remplacés par les règles ci-dessus + emit_accounting_event()
-- dans les routes API TypeScript. Suppression atomique dans ce BEGIN...COMMIT.
--
-- IMPORTANT : Les fonctions fn_facture_issued_to_journal et fn_facture_paid_to_journal
-- sont CONSERVÉES (DROP FUNCTION non exécuté) pour permettre le rollback propre.
-- Seuls les TRIGGERS sont supprimés.

DROP TRIGGER IF EXISTS trg_facture_issued ON factures;
-- Remplacé par : règles FAC-001 séquences 1-3 + emit('FAC-001') dans PATCH & POST

DROP TRIGGER IF EXISTS trg_facture_paid ON factures;
-- Remplacé par : règle FAC-002 séquence 1 + emit('FAC-002') dans PATCH

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. ENREGISTREMENT VERSION
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO accounting_schema_versions
  (version, semver_major, semver_minor, semver_patch, migration_file, description, breaking_change, applied_by)
VALUES (
  '1.1.0', 1, 1, 0,
  '139_accounting_rules_facturation.sql',
  'Règles comptables FAC-001 à FAC-006. FAC-001 (facture émise) et FAC-002 (règlement) actives. '
  'FAC-003 à FAC-006 en draft. Triggers trg_facture_issued et trg_facture_paid supprimés. '
  'emit_accounting_event() désormais point d''entrée unique pour la facturation.',
  FALSE,
  'Plan Directeur Phase 4.1 — Migration 139'
);

COMMIT;

-- ═════════════════════════════════════════════════════════════════════════════
-- VALIDATION POST-EXÉCUTION (à exécuter manuellement pour vérification)
-- ═════════════════════════════════════════════════════════════════════════════

/*
-- 1. Vérifier les règles FAC actives
SELECT event_type, sequence, debit_account, credit_account, montant_field,
       source_label, libelle_tpl, country_codes, status
FROM accounting_event_rules
WHERE event_type LIKE 'FAC-%'
ORDER BY event_type, sequence;

-- Résultat attendu :
-- FAC-001, 1, 411, 706,  montant_ht,  factures_emises,  active
-- FAC-001, 2, 411, 4441, montant_tva, factures_tva,     active
-- FAC-001, 3, 411, 447,  metadata.ca, factures_ca,      active  [CG seulement]
-- FAC-002, 1, 521, 411,  montant_ttc, factures_paiement,active
-- FAC-003 à FAC-006 : draft

-- 2. Vérifier que les triggers sont bien supprimés
SELECT trigger_name, event_object_table, action_timing, event_manipulation
FROM information_schema.triggers
WHERE trigger_name IN ('trg_facture_issued', 'trg_facture_paid');
-- Résultat attendu : 0 lignes

-- 3. Health check
SELECT * FROM fn_accounting_health_check();
-- Résultat attendu : tous OK (sauf 'active_rules' qui était 0 avant et maintenant > 0)

-- 4. Vérifier la version
SELECT version, description FROM accounting_schema_versions ORDER BY applied_at DESC LIMIT 2;
-- Résultat attendu : '1.1.0' et '1.0.0'
*/

-- ═════════════════════════════════════════════════════════════════════════════
-- ⛔ ROLLBACK — NE PAS EXÉCUTER (sauf incident majeur)
-- ═════════════════════════════════════════════════════════════════════════════
-- Ordre : 1. Exécuter ce rollback SQL, 2. Reverter le commit TypeScript

/*
BEGIN;

-- Restaurer les triggers (les fonctions n'ont pas été supprimées)
DROP TRIGGER IF EXISTS trg_facture_issued ON factures;
CREATE TRIGGER trg_facture_issued
  AFTER INSERT OR UPDATE OF statut ON factures
  FOR EACH ROW EXECUTE FUNCTION fn_facture_issued_to_journal();

DROP TRIGGER IF EXISTS trg_facture_paid ON factures;
CREATE TRIGGER trg_facture_paid
  AFTER UPDATE OF statut ON factures
  FOR EACH ROW EXECUTE FUNCTION fn_facture_paid_to_journal();

-- Supprimer les règles insérées
DELETE FROM accounting_event_rules WHERE event_type LIKE 'FAC-%' AND rule_version = 1;

-- Rétrograder la version
DELETE FROM accounting_schema_versions WHERE version = '1.1.0';

COMMIT;
*/

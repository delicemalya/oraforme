-- ═════════════════════════════════════════════════════════════════════════════
-- Migration 143 — Règles comptables SYSCOHADA — Module École (ECO)
-- ═════════════════════════════════════════════════════════════════════════════
--
-- Plan Directeur Oraforme — Phase 5 (cinquième migration métier)
-- Gouvernance : Audit → Impact → Implémentation → Quick Wins → Validation →
--               Audit cohérence → Correction → Certification → Documentation
--
-- PÉRIMÈTRE :
--   ✅ DROP trg_paiement_scolaire (conserver fn_paiement_scolaire_to_transaction — P-001)
--   ✅ Règle ECO-001 : frais de scolarité perçus — 1 séquence (TVA=0, exonéré)
--   ✅ Règle ECO-002 : remboursement frais — DRAFT
--   ✅ Version moteur : 1.5.0
--   ✅ Création POST /api/ecole/paiements (dans TypeScript — hors SQL)
--
-- ANOMALIES CORRIGÉES (Quick Wins locaux) :
--   QW-03 : Double write transactions éliminé (source='paiement_scolaire' direct +
--            trigger source='paiements_scolaires') — suppression du chemin direct
--   QW-04 : INSERT direct journal_comptable sans compte SYSCOHADA — supprimé,
--            remplacé par journal_entries via moteur central
--
-- HORS SCOPE (reporté à LEC) :
--   - trg_wallet_movement_journal (comptes 521000/706000/651000) — périmètre wallets
--   - comptabilite/page.tsx (inserts manuels UI) — migration LEC
--   - direction/page.tsx lit paiements_scolaires directement — NORMAL, données métier
--
-- VÉRIFICATION SYSCOHADA (Congo-Brazzaville, 100 000 FCFA, espèces) :
--   ECO-001 :
--     Séq 1 : 571 / 706   = 100 000 FCFA   Frais de scolarité
--     Débit total 571 = 100 000 = montant (TVA=0, services éducatifs exonérés) ✓
--     Crédit total    = 706 (100 000) ✓
--   transactions : type=entree, categorie='Scolarité', montant=100 000 ✓
--
-- COMPTES SYSCOHADA MOBILISÉS :
--   521  Banque (virement) — fn_ohada_cash_account si mode_paiement='virement'
--   571  Caisse (espèces) — fn_ohada_cash_account si mode_paiement='especes'
--   5711 Mobile (airtel) / 5712 Mobile (mtn) selon methode
--   706  Produits des prestations de services (classe 7 AUDCIF révisé 2017)
--
-- MOTEUR — ECO déjà intégré dans les 3 fonctions d'infrastructure (mig.138) :
--   fn_ae_has_treasury_impact : ECO ∈ liste ✓
--   fn_ae_is_income           : ECO-001 ∈ liste ✓
--   fn_ae_category            : ECO → 'Scolarité' ✓
--
-- MATRICE COHÉRENCE APRÈS MIGRATION :
--   Direction    → paiements_scolaires (données métier)     100 000 FCFA ✓
--   Trésorerie   → transactions (1 ligne, ECO-001)          100 000 FCFA ✓  [était 200k avant QW-03]
--   Comptabilité → journal_entries (571/706)                100 000 FCFA ✓
--   Grand Livre  → journal_entries (706 CR +100 000)        100 000 FCFA ✓
--   Audit        → accounting_event_log (is_balanced=true)  TRACÉ        ✓
--   États fin.   → Classe 7 : +100 000 FCFA CA             100 000 FCFA ✓
--   MIAA         → accounting_events ECO-001                100 000 FCFA ✓
--   journal_comptable → 0 via moteur (écart documenté, LEC) GAP connu    ✓
--
-- SKILLS mobilisés : ohada-comptabilite, fiscalite-cemac
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
    SELECT 1 FROM accounting_schema_versions WHERE version = '1.4.0'
  ) THEN
    RAISE EXCEPTION 'Migration 142 non appliquée — version 1.4.0 manquante.';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_name = 'paiements_scolaires'
  ) THEN
    RAISE EXCEPTION 'Table paiements_scolaires absente — migration 008 non appliquée.';
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Supprimer trigger legacy — P-001 : CONSERVER la fonction SQL
-- ─────────────────────────────────────────────────────────────────────────────
-- fn_paiement_scolaire_to_transaction() est conservée pour rollback d'urgence.
-- Elle ne sera supprimée qu'après migration 145 minimum.
-- Le chemin legacy (trigger → transactions) est fermé ici.

DROP TRIGGER IF EXISTS trg_paiement_scolaire ON paiements_scolaires;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. RÈGLE ECO-001 — Frais de scolarité perçus
-- ─────────────────────────────────────────────────────────────────────────────
-- Source : POST /api/ecole/paiements
-- emit_accounting_event('ECO-001', ...,
--   montant_ht=montant, montant_tva=0, montant_ttc=montant,
--   metadata={mode_paiement, libelle, etudiant_nom})
--
-- 1 écriture :
--   Séq 1 : 5xx / 706   Montant frais de scolarité (TVA=0)
--
-- Compte 5xx résolu par fn_ohada_cash_account(metadata->>'mode_paiement') :
--   especes → 571, airtel → 5711, mtn/momo → 5712, virement → 521

INSERT INTO accounting_event_rules (
  event_type, sequence, rule_version, status,
  debit_account, credit_account,
  montant_field, amount_formula, account_resolver,
  source_label, libelle_tpl,
  conditions, country_codes, account_plan,
  valid_from, notes
) VALUES
(
  'ECO-001', 1, 1, 'active',
  '521', '706',
  'montant_ht', NULL, 'treasury_debit',
  'ecole_frais_scolaires',
  'Frais scol. — {libelle}',
  '[{"field":"montant_ht","op":">","value":"0"}]',
  NULL,
  'SYSCOHADA',
  CURRENT_DATE,
  '521=placeholder remplacé par treasury_debit→fn_ohada_cash_account(mode_paiement). 706=Produits des prestations de services (AUDCIF classe 7 révisé 2017). Frais scolaires exonérés TVA — services éducatifs (école privée prestataire de services). montant_ht = montant_ttc car TVA=0.'
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. RÈGLE ECO-002 — Remboursement frais (DRAFT)
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO accounting_event_rules (
  event_type, sequence, rule_version, status,
  debit_account, credit_account,
  montant_field, amount_formula, account_resolver,
  source_label, libelle_tpl,
  conditions, country_codes, account_plan,
  valid_from, notes
) VALUES
(
  'ECO-002', 1, 1, 'draft',
  '706', '521',
  'montant_ht', NULL, 'treasury_credit',
  'ecole_remboursement',
  'Remboursement scol. — {libelle}',
  '[{"field":"montant_ht","op":">","value":"0"}]',
  NULL,
  'SYSCOHADA',
  CURRENT_DATE,
  'DRAFT — Extourne de ECO-001. Débit 706 (annulation produit) / Crédit 521 ou 5xx (décaissement). À activer si module remboursements/avoirs école implémenté.'
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. VERSION MOTEUR 1.5.0
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO accounting_schema_versions
  (version, semver_major, semver_minor, semver_patch, migration_file, description, breaking_change, applied_by)
VALUES (
  '1.5.0', 1, 5, 0,
  '143_accounting_rules_ecole.sql',
  'Règles ECO-001 (frais scolaires, 1 séquence, TVA=0) et ECO-002 (remboursement, draft). '
  'DROP trg_paiement_scolaire — fn_paiement_scolaire_to_transaction conservée (P-001). '
  'QW-03 : double write transactions éliminé. QW-04 : INSERT direct journal_comptable supprimé. '
  'Nouveau chemin : POST /api/ecole/paiements → emit ECO-001. '
  'Matrice cohérence : Direction/Trésorerie/Comptabilité/Grand Livre = 100% alignés.',
  FALSE,
  'Plan Directeur Phase 5 — Migration 143'
);

COMMIT;

-- ═════════════════════════════════════════════════════════════════════════════
-- VALIDATION POST-EXÉCUTION (à exécuter séparément)
-- ═════════════════════════════════════════════════════════════════════════════

/*
-- 1. Confirmer que le trigger est supprimé (la fonction doit rester)
SELECT tgname FROM pg_trigger WHERE tgrelid = 'paiements_scolaires'::regclass;
-- Résultat attendu : 0 lignes

SELECT proname FROM pg_proc WHERE proname = 'fn_paiement_scolaire_to_transaction';
-- Résultat attendu : 1 ligne (fonction conservée — P-001)

-- 2. Règles ECO actives
SELECT event_type, sequence, debit_account, credit_account,
       montant_field, account_resolver, status
FROM accounting_event_rules
WHERE event_type LIKE 'ECO-%'
ORDER BY event_type, sequence;
-- Résultat attendu :
-- ECO-001, 1, 521, 706, montant_ht, treasury_debit, active
-- ECO-002, 1, 706, 521, montant_ht, treasury_credit, draft

-- 3. Version moteur
SELECT version, applied_at FROM accounting_schema_versions ORDER BY semver_major, semver_minor;
-- Résultat attendu : 1.0.0, 1.1.0, 1.2.0, 1.3.0, 1.4.0, 1.5.0

-- 4. Test fonctionnel ECO-001
SELECT * FROM emit_accounting_event(
  p_tenant_id     := (SELECT id FROM tenants LIMIT 1),
  p_event_type    := 'ECO-001',
  p_source_module := 'ecole',
  p_source_table  := 'paiements_scolaires',
  p_source_id     := gen_random_uuid(),
  p_montant_ht    := 150000,
  p_montant_tva   := 0,
  p_montant_ttc   := 150000,
  p_libelle       := 'Test ECO-001 — Frais inscription 2026',
  p_date_event    := CURRENT_DATE,
  p_fiscal_year   := 2026,
  p_metadata      := '{"mode_paiement": "especes", "libelle": "Frais inscription 2026", "etudiant_nom": "Test Élève"}'::jsonb
);

-- 5. Vérifier status=processed + journal_entries
SELECT ae.status, ae.error_message,
       ael.entries_count, ael.total_debit, ael.total_credit, ael.is_balanced
FROM accounting_events ae
LEFT JOIN accounting_event_log ael ON ael.event_id = ae.id
WHERE ae.event_type = 'ECO-001'
ORDER BY ae.created_at DESC LIMIT 1;
-- Résultat attendu : status=processed, entries_count=1, is_balanced=true, total_debit=total_credit=150000
*/

-- ═════════════════════════════════════════════════════════════════════════════
-- ⛔ ROLLBACK — NE PAS EXÉCUTER (sauf incident majeur)
-- ═════════════════════════════════════════════════════════════════════════════

/*
BEGIN;
-- Restaurer le trigger
CREATE TRIGGER trg_paiement_scolaire
  AFTER INSERT ON paiements_scolaires
  FOR EACH ROW EXECUTE FUNCTION fn_paiement_scolaire_to_transaction();
-- Supprimer les règles
DELETE FROM accounting_event_rules WHERE event_type LIKE 'ECO-%' AND rule_version = 1;
DELETE FROM accounting_schema_versions WHERE version = '1.5.0';
COMMIT;
*/

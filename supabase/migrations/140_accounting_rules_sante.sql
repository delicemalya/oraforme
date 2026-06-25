-- ═════════════════════════════════════════════════════════════════════════════
-- Migration 140 — Règles comptables SYSCOHADA — Module Santé (SAN)
-- ═════════════════════════════════════════════════════════════════════════════
--
-- Plan Directeur Oraforme — Phase 4.2 (deuxième migration métier)
-- DoD       : docs/plan-directeur/definition-of-done-migrations-metier.md
-- Rapport   : docs/plan-directeur/migration-140-sante-san.md
-- Catalogue : docs/plan-directeur/phase3-catalogue-evenements-comptables.md
--
-- PÉRIMÈTRE :
--   ✅ Règles accounting_event_rules pour SAN-001 et SAN-002 (ACTIVE)
--   ✅ Règles accounting_event_rules pour SAN-003 à SAN-005 (DRAFT — futurs)
--   ✅ Suppression du trigger legacy trg_his_facture_journal
--   ✅ Les routes API (TypeScript) sont mises à jour séparément (même commit)
--
-- TRIGGER SUPPRIMÉ :
--   trg_his_facture_journal (AFTER UPDATE on his_factures) → fn_his_facture_journal()
--     Défini dans migration 084, comptes normalisés dans migration 131.
--     Problème : écrivait treasury→705/4441 directement (sans 411) — pas de double entrée propre.
--     Remplacé par : SAN-001 (411/705 + 411/4441) + SAN-002 (treasury/411) via emit_accounting_event()
--
-- VÉRIFICATION SYSCOHADA (Congo-Brazzaville, LF 2026) :
--   SAN-001 (Facture médicale émise — prestation de soins) :
--     411 Clients             / 705 Prestations de services    → montant_ht
--     411 Clients             / 4441 TVA collectée             → montant_tva (18%)
--   SAN-002 (Règlement facture médicale) :
--     5xx Trésorerie (mode)   / 411 Clients                   → montant_ttc (delta reçu)
--
-- BALANCE CHECK (simulation consultation 50 000 FCFA TTC, Congo) :
--   HT  = ROUND(50000 / 1.189, 0) = 42 053 FCFA
--   TVA = 50000 − 42053           =  7 947 FCFA
--   SAN-001 : Débit 411 total = 42053 + 7947 = 50 000
--             Crédit (705 + 4441) = 42053 + 7947 = 50 000 ✓
--   SAN-002 : Débit 571 = 50 000 / Crédit 411 = 50 000 ✓
--   411 net après les deux events = 50 000 débit (SAN-001) − 50 000 crédit (SAN-002) = 0 ✓
--
-- COMPTE 705 vs 706 :
--   705 = Travaux, études et prestations de services (soins médicaux)
--   706 = Produits accessoires (FAC module)
--   Les actes médicaux sont des prestations de services → 705 conforme SYSCOHADA révisé 2017.
--
-- SKILL mobilisé : ohada-comptabilite, fiscalite-cemac, audit-comptable
--
-- ═════════════════════════════════════════════════════════════════════════════
-- ⚡ BLOC À EXÉCUTER
-- ═════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- 0. Prérequis : vérifier que la migration 139 est bien appliquée
-- ─────────────────────────────────────────────────────────────────────────────

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'accounting_event_rules'
  ) THEN
    RAISE EXCEPTION 'Migration 138 non appliquée — accounting_event_rules manquante. Appliquer 138 d''abord.';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM accounting_schema_versions WHERE version = '1.1.0'
  ) THEN
    RAISE EXCEPTION 'accounting_schema_versions version 1.1.0 non trouvée — migration 139 incomplète. Appliquer 139 d''abord.';
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. RÈGLES SAN-001 — Facture médicale émise (prestation de soins)
-- ─────────────────────────────────────────────────────────────────────────────
-- Source métier : table 'his_factures', événement INSERT (création de la facture)
-- Déclencheur TypeScript : emit_accounting_event('SAN-001', ...) depuis :
--   - POST /api/sante/consultations  (après création his_facture, si montant > 0)
--   - POST /api/sante/facturation    (après création his_facture, si montant_total > 0)
--
-- 2 écritures :
--   Séquence 1 : Clients (411) / Prestations de services (705)  → montant_ht
--   Séquence 2 : Clients (411) / TVA collectée (4441)           → montant_tva (18%)
--
-- Note technique (HT/TVA pour le module santé) :
--   La table his_factures ne stocke pas séparément montant_ht et montant_tva.
--   Le montant_total est TTC. L'appelant calcule :
--     montant_ht  = ROUND(montant_total / 1.189, 0)   [TTC ÷ (1 + 18% + 0.9%)]
--     montant_tva = montant_total − montant_ht
--   Ce facteur 1.189 est utilisé par l'ancien trigger fn_his_facture_journal (migrations 084, 131).
--   Pour l'instant ce calcul ne prend pas en compte le CA (5%×TVA) car
--   le module santé n'expose pas séparément le CA dans ses formulaires.

INSERT INTO accounting_event_rules (
  event_type, sequence, rule_version, status,
  debit_account, credit_account,
  montant_field, amount_formula, account_resolver,
  source_label, libelle_tpl,
  conditions, country_codes, account_plan,
  valid_from, notes
) VALUES

-- Séquence 1 : Créance client / Prestation médicale HT (705)
(
  'SAN-001', 1, 1, 'active',
  '411', '705',
  'montant_ht', NULL, NULL,
  'sante_facture',
  'Soins {patient_nom} — HT',
  '[{"field":"montant_ht","op":">","value":"0"}]',
  NULL,
  'SYSCOHADA',
  CURRENT_DATE,
  'Prestation médicale HT. 705 = Travaux, études et prestations de services (soins cliniques). '
  'Applicable à toutes juridictions OHADA. '
  'Si activité uniquement de vente de médicaments (pharmacie) : utiliser 701 ou 706 selon pays.'
),

-- Séquence 2 : Créance client / TVA collectée (4441)
(
  'SAN-001', 2, 1, 'active',
  '411', '4441',
  'montant_tva', NULL, NULL,
  'sante_tva',
  'TVA soins {patient_nom} — 18%',
  '[{"field":"montant_tva","op":">","value":"0"}]',
  NULL,
  'SYSCOHADA',
  CURRENT_DATE,
  'TVA collectée 18% sur soins médicaux (Congo-Brazzaville LF 2026). '
  'Attention : certains actes médicaux peuvent être exonérés de TVA selon la législation nationale. '
  'Vérifier avec la DGID Congo avant application sur soins préventifs/maternité/handicap.'
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. RÈGLES SAN-002 — Règlement facture médicale
-- ─────────────────────────────────────────────────────────────────────────────
-- Source métier : table 'his_factures', événement UPDATE (montant_paye augmente)
-- Déclencheur TypeScript : emit_accounting_event('SAN-002', ...) depuis :
--   - POST /api/sante/consultations  (si statut_paiement = 'paye' → paiement immédiat)
--   - PATCH /api/sante/facturation   (si montant_paye du body > montant_paye stocké)
--
-- montant_ttc passé par l'appelant = DELTA payé (différence entre nouveau et ancien montant_paye)
-- Résolution trésorerie via fn_ae_resolve_treasury(metadata) → fn_ohada_cash_account(mode_paiement) :
--   especes  → 571  (caisse en monnaie locale)
--   airtel   → 5711 (Airtel Money)
--   mtn/momo → 5712 (MTN Mobile Money)
--   mobile   → 5711 (mobile générique)
--   else     → 521  (banque — virement, carte, assurance, crédit)
--
-- NOTE IDEMPOTENCE : Pour un paiement TOTAL (montant_paye = montant_total), SAN-002 est émis
-- une seule fois et idempotent (source_id = his_factures.id).
-- Pour les paiements PARTIELS multiples, seul le premier est comptabilisé (limitation connue).
-- Évolution future : créer his_paiements_sante et utiliser son id comme source_id.
--
-- Ce trigger remplace fn_his_facture_journal qui écrivait INCORRECTEMENT treasury→705/4441.
-- La nouvelle approche (SAN-001 + SAN-002) implémente la double entrée SYSCOHADA :
--   SAN-001 ouvre la créance 411, SAN-002 l'apure.

INSERT INTO accounting_event_rules (
  event_type, sequence, rule_version, status,
  debit_account, credit_account,
  montant_field, amount_formula, account_resolver,
  source_label, libelle_tpl,
  conditions, country_codes, account_plan,
  valid_from, notes
) VALUES
(
  'SAN-002', 1, 1, 'active',
  '521',   -- Valeur par défaut (virement/banque) — remplacée dynamiquement par account_resolver
  '411',
  'montant_ttc', NULL, 'treasury_debit',
  -- treasury_debit → fn_ae_resolve_treasury(v_event.metadata)
  --               → fn_ohada_cash_account(metadata.mode_paiement)
  'sante_paiement',
  'Règlement soins {patient_nom}',
  '[{"field":"montant_ttc","op":">","value":"0"}]',
  NULL,
  'SYSCOHADA',
  CURRENT_DATE,
  'Encaissement paiement facture médicale. Trésorerie résolue depuis metadata.mode_paiement. '
  'Apure la créance 411 ouverte par SAN-001. '
  'Pour mode_paiement=assurance → 521 (banque) utilisé (remboursement par virement assurance). '
  'Pour tiers-payant complet (assurance règle directement), envisager SAN-004 (413 Assurances sociales).'
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. RÈGLES SAN-003 à SAN-005 — DRAFT (à activer lors de prochaines sprints)
-- ─────────────────────────────────────────────────────────────────────────────

-- SAN-003 : Actes médicaux spécialisés (labo, imagerie, bloc opératoire)
-- Même logique que SAN-001 mais avec source_label distinct pour reporting granulaire
INSERT INTO accounting_event_rules (
  event_type, sequence, rule_version, status,
  debit_account, credit_account,
  montant_field, amount_formula, account_resolver,
  source_label, libelle_tpl, conditions, country_codes, account_plan, valid_from, notes
) VALUES
(
  'SAN-003', 1, 1, 'draft',
  '411', '705',
  'montant_ht', NULL, NULL,
  'sante_actes', 'Acte médical {patient_nom} — HT',
  '[{"field":"montant_ht","op":">","value":"0"}]',
  NULL, 'SYSCOHADA', CURRENT_DATE,
  'DRAFT — Actes spécialisés (labo, imagerie, bloc, urgences). '
  'À activer lorsque ces modules factureront distinctement des consultations.'
),
(
  'SAN-003', 2, 1, 'draft',
  '411', '4441',
  'montant_tva', NULL, NULL,
  'sante_actes_tva', 'TVA acte médical {patient_nom}',
  '[{"field":"montant_tva","op":">","value":"0"}]',
  NULL, 'SYSCOHADA', CURRENT_DATE,
  'DRAFT — TVA sur actes spécialisés.'
);

-- SAN-004 : Prise en charge assurance (tiers payant) — transfert créance patient → assurance
-- Convertit la créance 411 (patient) en créance 413 (assurance)
INSERT INTO accounting_event_rules (
  event_type, sequence, rule_version, status,
  debit_account, credit_account,
  montant_field, amount_formula, account_resolver,
  source_label, libelle_tpl, conditions, country_codes, account_plan, valid_from, notes
) VALUES
(
  'SAN-004', 1, 1, 'draft',
  '413', '411',
  'montant_ttc', NULL, NULL,
  'sante_assurance', 'Prise en charge assurance {patient_nom}',
  '[{"field":"montant_ttc","op":">","value":"0"}]',
  NULL, 'SYSCOHADA', CURRENT_DATE,
  'DRAFT — 413 = Clients, assurances sociales et organismes de prévoyance (SYSCOHADA). '
  'Transfert créance 411 (patient) vers 413 (assurance). '
  'À activer lors de l''intégration module tiers-payant (his_assurances, his_dossiers_assurance).'
);

-- SAN-005 : Encaissement remboursement assurance
INSERT INTO accounting_event_rules (
  event_type, sequence, rule_version, status,
  debit_account, credit_account,
  montant_field, amount_formula, account_resolver,
  source_label, libelle_tpl, conditions, country_codes, account_plan, valid_from, notes
) VALUES
(
  'SAN-005', 1, 1, 'draft',
  '521', '413',
  'montant_ttc', NULL, 'treasury_debit',
  'sante_remboursement', 'Remboursement assurance {patient_nom}',
  '[{"field":"montant_ttc","op":">","value":"0"}]',
  NULL, 'SYSCOHADA', CURRENT_DATE,
  'DRAFT — Encaissement remboursement par assurance (virement bancaire). '
  'Solde créance 413 ouverte par SAN-004. '
  'À activer conjointement avec SAN-004.'
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. SUPPRESSION DU TRIGGER LEGACY
-- ─────────────────────────────────────────────────────────────────────────────
-- trg_his_facture_journal (migration 084, corrigé dans 131) est remplacé par
-- les règles SAN-001 + SAN-002 + emit_accounting_event() dans les routes API.
--
-- PROBLÈME CORRIGÉ :
--   Ancien trigger : AFTER UPDATE → Debit 511/5711/512/5712 / Credit 705/4441
--   → Ecriture incorrecte (pas de 411, mélange encaissement + produit en une seule passe)
--   Nouveau : SAN-001 (411/705 + 411/4441) + SAN-002 (treasury/411) = double entrée SYSCOHADA ✓
--
-- IMPORTANT : fn_his_facture_journal() CONSERVÉE (pas de DROP FUNCTION)
-- pour permettre la restauration du trigger en cas de rollback.

DROP TRIGGER IF EXISTS trg_his_facture_journal ON his_factures;
-- Remplacé par : règles SAN-001 (séquences 1-2) + SAN-002 (séquence 1)
--                + emit_accounting_event() dans POST /api/sante/consultations
--                                         + PATCH /api/sante/facturation

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. ENREGISTREMENT VERSION
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO accounting_schema_versions
  (version, semver_major, semver_minor, semver_patch, migration_file, description, breaking_change, applied_by)
VALUES (
  '1.2.0', 1, 2, 0,
  '140_accounting_rules_sante.sql',
  'Règles comptables SAN-001 à SAN-005. SAN-001 (facture médicale) et SAN-002 (règlement) actives. '
  'SAN-003 à SAN-005 en draft. Trigger trg_his_facture_journal supprimé (migration 084+131). '
  'Double entrée SYSCOHADA propre : 411/705 + 411/4441 (émission) + treasury/411 (encaissement). '
  'emit_accounting_event() désormais point d''entrée unique pour la facturation médicale.',
  FALSE,
  'Plan Directeur Phase 4.2 — Migration 140'
);

COMMIT;

-- ═════════════════════════════════════════════════════════════════════════════
-- VALIDATION POST-EXÉCUTION (à exécuter manuellement dans Supabase SQL Editor)
-- ═════════════════════════════════════════════════════════════════════════════

/*
-- 1. Vérifier les règles SAN actives
SELECT event_type, sequence, debit_account, credit_account, montant_field,
       account_resolver, source_label, libelle_tpl, status
FROM accounting_event_rules
WHERE event_type LIKE 'SAN-%'
ORDER BY event_type, sequence;
-- Résultat attendu :
-- SAN-001  1  411  705   montant_ht   NULL            sante_facture    active
-- SAN-001  2  411  4441  montant_tva  NULL            sante_tva        active
-- SAN-002  1  521  411   montant_ttc  treasury_debit  sante_paiement   active
-- SAN-003 à SAN-005 : draft

-- 2. Vérifier que le trigger est supprimé
SELECT trigger_name, event_object_table
FROM information_schema.triggers
WHERE trigger_name = 'trg_his_facture_journal';
-- Résultat attendu : 0 lignes

-- 3. Vérifier que fn_his_facture_journal() est conservée (rollback possible)
SELECT routine_name FROM information_schema.routines
WHERE routine_name = 'fn_his_facture_journal';
-- Résultat attendu : 1 ligne

-- 4. Health check moteur comptable
SELECT * FROM fn_accounting_health_check();

-- 5. Version correcte
SELECT version, description FROM accounting_schema_versions ORDER BY applied_at DESC LIMIT 3;
-- Résultat attendu : '1.2.0', '1.1.0', '1.0.0'

-- 6. Balance check règle SAN-001 (simulation 50 000 FCFA TTC, Congo)
SELECT
  ROUND(50000::numeric / 1.189, 0)                           AS ht,
  50000 - ROUND(50000::numeric / 1.189, 0)                   AS tva,
  ROUND(50000::numeric / 1.189, 0)
    + (50000 - ROUND(50000::numeric / 1.189, 0))             AS credit_total,
  50000                                                       AS debit_411_attendu;
-- credit_total doit = debit_411_attendu = 50000 ✓
*/

-- ═════════════════════════════════════════════════════════════════════════════
-- ⛔ ROLLBACK — NE PAS EXÉCUTER (sauf incident majeur)
-- ═════════════════════════════════════════════════════════════════════════════
-- Ordre : 1. Exécuter ce rollback SQL, 2. Reverter le commit TypeScript (git revert)

/*
BEGIN;

-- Restaurer le trigger (fn_his_facture_journal() n'a pas été supprimée)
CREATE TRIGGER trg_his_facture_journal
  AFTER UPDATE ON his_factures
  FOR EACH ROW EXECUTE FUNCTION fn_his_facture_journal();

-- Supprimer les règles SAN insérées
DELETE FROM accounting_event_rules WHERE event_type LIKE 'SAN-%' AND rule_version = 1;

-- Rétrograder la version
DELETE FROM accounting_schema_versions WHERE version = '1.2.0';

COMMIT;
*/

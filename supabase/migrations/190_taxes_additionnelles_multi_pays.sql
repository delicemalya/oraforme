-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 190 — Taxes additionnelles multi-pays (compte 447)
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Décision (2026-11-20) : la taxe additionnelle à la TVA de chaque pays
-- (Centime Additionnel au Congo, CAC au Cameroun, etc.) est comptabilisée au
-- 447 dans tous les pays, comme le fait déjà VTE-001 (migration 185,
-- country_codes NULL).
--
-- Pourquoi maintenant : les routes API envoyaient country_code = 'CG' en dur,
-- si bien qu'un tenant hors Congo était comptabilisé avec les règles du
-- Congo. Elles envoient désormais le vrai pays du tenant (tenants.pays). Sans
-- cette migration, FAC-001 / SAN-001 / HOT-001 séquence 3 (limitées à
-- ARRAY['CG']) ne passeraient plus la taxe additionnelle hors Congo, et le
-- 411 ne correspondrait plus au TTC facturé.
--
-- Méthode — versionnage, pas de modification en place :
--   • la version 1 (CG seul) est close la veille (valid_until) et pointe
--     vers la version 2 (superseded_by). Elle RESTE 'active' :
--     fn_ae_get_applicable_rules ne lit que les règles actives, et un
--     événement daté d'avant (facture antidatée, rejeu) doit encore la trouver.
--     L'historique est inchangé.
--   • la version 2 est une copie exacte de la version 1 (mêmes comptes,
--     même résolveur, même condition metadata.ca > 0), country_codes = NULL.
--     Un pays sans taxe additionnelle envoie ca = 0 : la règle ne s'applique pas.
--
-- Hors périmètre : BTP-001, RES-001, BOI-001 (secteurs retirés, migration 188).
-- Idempotente : relancer la migration ne crée ni ne modifie plus rien.
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

-- 0. Prérequis : les trois règles CG-only actives existent.
DO $$
DECLARE
  v_n INT;
BEGIN
  SELECT count(*) INTO v_n FROM public.accounting_event_rules
  WHERE event_type IN ('FAC-001', 'SAN-001', 'HOT-001') AND sequence = 3
    AND credit_account = '447'
    AND (rule_version = 2 OR (rule_version = 1 AND country_codes = ARRAY['CG']));
  IF v_n < 3 THEN
    RAISE EXCEPTION 'Migration 190 annulée — FAC-001/SAN-001/HOT-001 séquence 3 (447) introuvables (% trouvée(s))', v_n;
  END IF;
END $$;

-- 1. Version 2, tous pays.
INSERT INTO public.accounting_event_rules (
  event_type, sequence, rule_version, status, change_reason,
  debit_account, credit_account,
  montant_field, amount_formula, account_resolver,
  source_label, libelle_tpl,
  conditions, country_codes, account_plan, valid_from, fiscal_years,
  created_by, notes
)
SELECT
  v1.event_type, v1.sequence, 2, 'active',
  'Taxe additionnelle à la TVA comptabilisée au 447 dans tous les pays (migration 190).',
  v1.debit_account, v1.credit_account,
  v1.montant_field, v1.amount_formula, v1.account_resolver,
  v1.source_label,
  replace(replace(v1.libelle_tpl, 'CA 5%', 'taxe additionnelle'), 'Centime Additionnel', 'taxe additionnelle'),
  v1.conditions, NULL, v1.account_plan, CURRENT_DATE, v1.fiscal_years,
  'migration 190',
  'Version 2 de la règle ' || v1.event_type || ' séq.3 : identique à la version 1 '
  || 'mais tous pays (country_codes NULL). metadata.ca = somme des taxes additionnelles '
  || 'du pays du tenant (Centime Additionnel CG, CAC CM...), calculée par '
  || 'lib/fiscalite/engine-adapter. Même compte 447 que VTE-001 (185).'
FROM public.accounting_event_rules v1
WHERE v1.event_type IN ('FAC-001', 'SAN-001', 'HOT-001')
  AND v1.sequence = 3 AND v1.rule_version = 1
  AND v1.country_codes = ARRAY['CG']
  AND NOT EXISTS (
    SELECT 1 FROM public.accounting_event_rules v2
    WHERE v2.event_type = v1.event_type AND v2.sequence = 3 AND v2.rule_version = 2
  );

-- 2. Clôture de la version 1 (la veille du début de la version 2).
UPDATE public.accounting_event_rules v1
SET valid_until   = GREATEST(v2.valid_from - 1, v1.valid_from),
    superseded_by = v2.id,
    change_reason = 'Remplacée par la version 2 tous pays (migration 190).'
FROM public.accounting_event_rules v2
WHERE v1.event_type IN ('FAC-001', 'SAN-001', 'HOT-001')
  AND v1.sequence = 3 AND v1.rule_version = 1
  AND v1.country_codes = ARRAY['CG']
  AND v2.event_type = v1.event_type AND v2.sequence = 3 AND v2.rule_version = 2
  AND v1.superseded_by IS NULL;

-- 3. Version moteur.
INSERT INTO public.accounting_schema_versions
  (version, semver_major, semver_minor, semver_patch, migration_file, description, breaking_change, applied_by)
SELECT
  '1.11.1', 1, 11, 1,
  '190_taxes_additionnelles_multi_pays.sql',
  'FAC-001/SAN-001/HOT-001 séquence 3 (447, metadata.ca) étendues à tous les pays '
  '(version 2). Les routes API envoient le pays réel du tenant au lieu de CG en dur.',
  FALSE,
  'Refonte 2026-11 — multi-pays'
WHERE NOT EXISTS (
  SELECT 1 FROM public.accounting_schema_versions WHERE version = '1.11.1'
);

COMMIT;

-- ═════════════════════════════════════════════════════════════════════════════
-- ✅ VÉRIFICATION APRÈS APPLICATION (lecture seule)
-- ═════════════════════════════════════════════════════════════════════════════
-- SELECT event_type, rule_version, status, country_codes, valid_from, valid_until
--   FROM accounting_event_rules
--  WHERE event_type IN ('FAC-001','SAN-001','HOT-001') AND sequence = 3
--  ORDER BY event_type, rule_version;
-- Attendu : par event_type, v1 active {CG} close la veille, v2 active NULL.
--
-- SELECT event_type, sequence, rule_version
--   FROM fn_ae_get_applicable_rules('FAC-001', CURRENT_DATE, 'CM');
-- Attendu : séquences 1, 2 et 3 (v2).

-- ═════════════════════════════════════════════════════════════════════════════
-- ⛔ RETOUR ARRIÈRE
-- ═════════════════════════════════════════════════════════════════════════════
-- À faire AVEC le retour du code (country_code 'CG' en dur), sinon les tenants
-- hors Congo perdent leur écriture 447.
-- BEGIN;
-- UPDATE accounting_event_rules SET valid_until = NULL,
--        superseded_by = NULL, change_reason = NULL
--  WHERE event_type IN ('FAC-001','SAN-001','HOT-001') AND sequence = 3 AND rule_version = 1;
-- DELETE FROM accounting_event_rules
--  WHERE event_type IN ('FAC-001','SAN-001','HOT-001') AND sequence = 3 AND rule_version = 2;
-- DELETE FROM accounting_schema_versions WHERE version = '1.11.1';
-- COMMIT;

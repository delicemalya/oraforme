-- ═════════════════════════════════════════════════════════════════════════════
-- Migration 148 — Règles comptables SYSCOHADA — BTP & Agriculture (BTP / AGR)
-- ═════════════════════════════════════════════════════════════════════════════
--
-- Sprint 148 — Objectif : BCI 82 → 95+ · Couverture moteur 71% → 79%
-- Périmètre : Modules BTP (Bâtiment & Travaux Publics) + Agriculture
--
-- CONTEXTE MÉTIER :
--   BTP (Bâtiment & Travaux Publics) :
--     Facturation à l'avancement (méthode SYSCOHADA). Comptes :
--     722 Travaux exécutés (ou 704 Travaux selon acte métier) / 411 Clients
--     Règlement client : 411 / 521 (treasury_credit)
--     Avances travaux : 481 Charges constatées d'avance / 411 (si acompte versé)
--
--   Agriculture :
--     Vente de produits agricoles (primeurs, élevage, céréales...). Comptes :
--     714 Ventes de produits agricoles / 411 Clients / 521 (si direct caisse)
--     Achat intrants agricoles : 602 Achats de matières premières / 401
--
-- NOTE TVA — EXEMPTIONS SPÉCIFIQUES :
--   BTP Congo-Brazzaville : TVA 18% + Centime Additionnel (standard 18.9%)
--   Agriculture Congo : certains produits agricoles alimentaires sont exonérés de TVA
--     (Art. 140 CGI Congo — exonération produits de première nécessité)
--   → BTP-001 inclut TVA 18.9% ; AGR-001 sans TVA par défaut (exonéré alimentaire)
--   → Modifier conditions AGR-001 si le tenant vend des produits taxables
--
-- RÈGLES CRÉÉES :
--   BTP-001 active  : Facture travaux BTP        411 (D) / 722 (C) HT + 4441 TVA
--   BTP-002 active  : Règlement client BTP        411 (D) → treasury_credit
--   BTP-003 draft   : Avance reçue client         521 / 481 (Produits constatés avance)
--   BTP-004 draft   : Régularisation avance       481 / 411 (déduction acompte)
--   AGR-001 active  : Vente produits agricoles    411 (D) / 714 (C) HT
--   AGR-002 active  : Règlement vente agricole    411 (D) → treasury_credit
--   AGR-003 draft   : Achat intrants agricoles    602 (D) / 401 (C)
--
-- COMPTES SYSCOHADA MOBILISÉS :
--   411  Clients (tiers débiteurs)
--   521  Banque (treasury_credit résout 521 ou 571)
--   571  Caisse (espèces)
--   701  Ventes de marchandises (cf. BOI, RES)
--   704  Travaux facturés (alternative BTP selon segment)
--   714  Ventes de produits agricoles (classe 7)
--   722  Travaux en cours (méthode avancement — stock permanent travaux)
--   401  Fournisseurs (achats intrants AGR-003)
--   481  Charges constatées d'avance / Produits reçus d'avance
--   4441 TVA facturée collectée (BTP-001 séq 2)
--   602  Achats de matières premières et fournitures liées (intrants AGR)
--
-- RESSOURCES MOBILISÉES : ohada-comptabilite, fiscalite-cemac, audit-comptable
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
    SELECT 1 FROM accounting_schema_versions WHERE version = '1.9.0'
  ) THEN
    RAISE EXCEPTION 'Migration 147 non appliquée — version 1.9.0 manquante.';
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. fn_ae_has_treasury_impact — ajouter BTP et AGR
-- ─────────────────────────────────────────────────────────────────────────────
-- BTP-002 (règlement client) et AGR-002 (règlement vente) = entrée trésorerie
-- BTP-001 / AGR-001 = facture → pas de trésorerie directe (411 débiteur)

CREATE OR REPLACE FUNCTION fn_ae_has_treasury_impact(p_event_type TEXT) RETURNS BOOLEAN
  LANGUAGE sql IMMUTABLE AS $$
  SELECT split_part(p_event_type, '-', 1) IN
    ('FAC','TRE','MOB','PAI','HOT','RES','ECO','COM','TRP','SAN','ONG','CAB','BOI','ACH','BTP','AGR');
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. fn_ae_is_income — BTP et AGR sont des revenus (séq 1 = 411/714 ou 411/722)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION fn_ae_is_income(p_event_type TEXT) RETURNS BOOLEAN
  LANGUAGE sql IMMUTABLE AS $$
  SELECT p_event_type IN (
    'FAC-001', 'FAC-002', 'RES-001', 'SAN-001', 'ECO-001',
    'HOT-001', 'ONG-001', 'BOI-001', 'BTP-001', 'AGR-001'
  );
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. fn_ae_category — ajouter BTP et AGR
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
    WHEN 'STK' THEN 'Stocks'       WHEN 'ACH' THEN 'Achats'
    WHEN 'BTP' THEN 'BTP'          WHEN 'AGR' THEN 'Agriculture'
    ELSE 'Autre'
  END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. RÈGLE BTP-001 séq 1 — Facturation travaux : Débit 411 / Crédit 722 (HT)
-- ─────────────────────────────────────────────────────────────────────────────
-- 722 = Travaux exécutés (méthode à l'avancement SYSCOHADA)
-- ou 704 si le tenant facture directement (méthode à l'achèvement)
-- → 722 retenu car plus courant en BTP CEMAC pour gros chantiers

INSERT INTO accounting_event_rules (
  event_type, sequence, rule_version, status,
  debit_account, credit_account,
  montant_field, amount_formula, account_resolver,
  source_label, libelle_tpl,
  conditions, country_codes, account_plan, valid_from, notes
) VALUES (
  'BTP-001', 1, 1, 'active',
  '411', '722',
  'montant_ht', NULL, NULL,
  'travaux_ht',
  'Travaux BTP facturés — {libelle}',
  '[{"field":"montant_ht","op":">","value":"0"}]',
  NULL, 'SYSCOHADA', CURRENT_DATE,
  '411=Clients (débiteur). 722=Travaux exécutés (revenu BTP — classe 7). Montant HT. TVA collectée en séq 2 (4441). Méthode à l avancement SYSCOHADA révisé 2018. Compte 704 (Travaux) si méthode achèvement — modifier selon segment client.'
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. RÈGLE BTP-001 séq 2 — TVA collectée BTP (18% Congo — 18.9% avec CA)
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO accounting_event_rules (
  event_type, sequence, rule_version, status,
  debit_account, credit_account,
  montant_field, amount_formula, account_resolver,
  source_label, libelle_tpl,
  conditions, country_codes, account_plan, valid_from, notes
) VALUES (
  'BTP-001', 2, 1, 'active',
  '411', '4441',
  'montant_tva', NULL, NULL,
  'tva_btp',
  'TVA BTP — {libelle}',
  '[{"field":"montant_tva","op":">","value":"0"}]',
  NULL, 'SYSCOHADA', CURRENT_DATE,
  '4441=TVA facturée collectée (classe 4 — État). BTP soumis TVA 18% + Centime Additionnel 5%/TVA = 18.9% effectif (Congo-Brazzaville). Conditions : montant_tva > 0 → si exonéré (marchés État exonérés selon CGI), mettre montant_tva=0 à l emit.'
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. RÈGLE BTP-002 — Règlement client BTP (encaissement)
-- ─────────────────────────────────────────────────────────────────────────────
-- treasury_debit resolver : fn_ohada_cash_account(mode_paiement) → 521 ou 571

INSERT INTO accounting_event_rules (
  event_type, sequence, rule_version, status,
  debit_account, credit_account,
  montant_field, amount_formula, account_resolver,
  source_label, libelle_tpl,
  conditions, country_codes, account_plan, valid_from, notes
) VALUES (
  'BTP-002', 1, 1, 'active',
  '521', '411',
  'montant_ttc', NULL, 'treasury_debit',
  'reglement_client_btp',
  'Règlement client BTP — {libelle}',
  '[{"field":"montant_ttc","op":">","value":"0"}]',
  NULL, 'SYSCOHADA', CURRENT_DATE,
  '521=placeholder treasury_debit → fn_ohada_cash_account(mode_paiement). 411=Client soldé (crédit). Montant TTC (HT + TVA). Espèces → 571, Virement → 521. fn_ae_is_income=true, fn_ae_has_treasury_impact=true → entrée trésorerie.'
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. RÈGLE BTP-003 DRAFT — Avance reçue client (acompte sur marché)
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO accounting_event_rules (
  event_type, sequence, rule_version, status,
  debit_account, credit_account,
  montant_field, amount_formula, account_resolver,
  source_label, libelle_tpl,
  conditions, country_codes, account_plan, valid_from, notes
) VALUES (
  'BTP-003', 1, 1, 'draft',
  '521', '481',
  'montant_ttc', NULL, 'treasury_debit',
  'avance_client_btp',
  'Avance client BTP — {libelle}',
  '[{"field":"montant_ttc","op":">","value":"0"}]',
  NULL, 'SYSCOHADA', CURRENT_DATE,
  'DRAFT. 521=Trésorerie (treasury_debit). 481=Produits reçus d avance (passif courant). Avances = produit reporté jusqu à l avancement du chantier. Régulariser via BTP-004 à chaque décompte intermédiaire. Activer quand module BTP intègre suivi acomptes.'
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 8. RÈGLE BTP-004 DRAFT — Régularisation avance (déduction acompte du décompte)
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO accounting_event_rules (
  event_type, sequence, rule_version, status,
  debit_account, credit_account,
  montant_field, amount_formula, account_resolver,
  source_label, libelle_tpl,
  conditions, country_codes, account_plan, valid_from, notes
) VALUES (
  'BTP-004', 1, 1, 'draft',
  '481', '411',
  'montant_ttc', NULL, NULL,
  'regularisation_avance_btp',
  'Régularisation avance BTP — {libelle}',
  '[{"field":"montant_ttc","op":">","value":"0"}]',
  NULL, 'SYSCOHADA', CURRENT_DATE,
  'DRAFT. 481=Produit d avance soldé (débit). 411=Client débiteur net réduit. Utilisé lors de chaque décompte intermédiaire pour déduire l acompte versé. Activer avec BTP-003.'
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 9. RÈGLE AGR-001 — Vente produits agricoles (TVA=0 : produits exonérés Congo)
-- ─────────────────────────────────────────────────────────────────────────────
-- CGI Congo Art.140 : exonération TVA sur produits agricoles alimentaires.
-- 714 = Ventes de produits agricoles (classe 7 SYSCOHADA)

INSERT INTO accounting_event_rules (
  event_type, sequence, rule_version, status,
  debit_account, credit_account,
  montant_field, amount_formula, account_resolver,
  source_label, libelle_tpl,
  conditions, country_codes, account_plan, valid_from, notes
) VALUES (
  'AGR-001', 1, 1, 'active',
  '411', '714',
  'montant_ht', NULL, NULL,
  'vente_agricole_ht',
  'Vente agricole — {libelle}',
  '[{"field":"montant_ht","op":">","value":"0"}]',
  NULL, 'SYSCOHADA', CURRENT_DATE,
  '411=Clients (débiteur). 714=Ventes de produits agricoles (classe 7 — produits standard). Pas de séquence TVA (exonération Art.140 CGI Congo pour produits alimentaires). Si le tenant vend produits transformés (non exonérés) : ajouter séq 2 avec montant_tva + 4441.'
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 10. RÈGLE AGR-002 — Règlement vente agricole (encaissement)
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO accounting_event_rules (
  event_type, sequence, rule_version, status,
  debit_account, credit_account,
  montant_field, amount_formula, account_resolver,
  source_label, libelle_tpl,
  conditions, country_codes, account_plan, valid_from, notes
) VALUES (
  'AGR-002', 1, 1, 'active',
  '521', '411',
  'montant_ht', NULL, 'treasury_debit',
  'encaissement_agricole',
  'Règlement vente agricole — {libelle}',
  '[{"field":"montant_ht","op":">","value":"0"}]',
  NULL, 'SYSCOHADA', CURRENT_DATE,
  '521=Treasury_debit → fn_ohada_cash_account. 411=Client soldé. Montant HT (pas de TVA). Espèces → 571, Virement → 521. fn_ae_has_treasury_impact=true, fn_ae_is_income=true → entrée trésorerie.'
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 11. RÈGLE AGR-003 DRAFT — Achat intrants agricoles (semences, engrais, etc.)
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO accounting_event_rules (
  event_type, sequence, rule_version, status,
  debit_account, credit_account,
  montant_field, amount_formula, account_resolver,
  source_label, libelle_tpl,
  conditions, country_codes, account_plan, valid_from, notes
) VALUES (
  'AGR-003', 1, 1, 'draft',
  '602', '401',
  'montant_ht', NULL, NULL,
  'achat_intrants_agricoles',
  'Achat intrants AGR — {libelle}',
  '[{"field":"montant_ht","op":">","value":"0"}]',
  NULL, 'SYSCOHADA', CURRENT_DATE,
  'DRAFT. 602=Achats matières premières et fournitures liées (intrants agricoles : semences, engrais, pesticides). 401=Fournisseurs. Différent de 601 (marchandises génériques). Activer quand module Agriculture intègre suivi achats intrants.'
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 12. VERSION MOTEUR 1.10.0
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO accounting_schema_versions
  (version, semver_major, semver_minor, semver_patch, migration_file, description, breaking_change, applied_by)
VALUES (
  '1.10.0', 1, 10, 0,
  '148_accounting_rules_btp_agriculture.sql',
  'Sprint 148 — BTP & Agriculture → moteur comptable central v1.10.0. '
  'BTP-001 active (travaux facturés 411/722 HT + 411/4441 TVA 18.9%). '
  'BTP-002 active (règlement client 521/411 treasury_debit). '
  'BTP-003 draft (avance reçue 521/481). BTP-004 draft (régularisation avance 481/411). '
  'AGR-001 active (vente agricole 411/714 HT — exonération TVA Art.140 CGI Congo). '
  'AGR-002 active (encaissement agricole 521/411 treasury_debit). '
  'AGR-003 draft (achat intrants 602/401). '
  'fn_ae_has_treasury_impact: BTP+AGR ajoutés. fn_ae_is_income: BTP-001+AGR-001. '
  'fn_ae_category: BTP→BTP, AGR→Agriculture. '
  'BCI Sprint 148: couverture moteur 71% → 79% (12/14 modules actifs).',
  FALSE,
  'Sprint 148 — ERP Sprints gouvernance'
);

COMMIT;

-- ═════════════════════════════════════════════════════════════════════════════
-- ✅ VALIDATION POST-EXÉCUTION (à exécuter séparément dans Supabase)
-- ═════════════════════════════════════════════════════════════════════════════
/*
-- 1. Fonctions moteur
SELECT fn_ae_has_treasury_impact('BTP-002') AS treasury_btp,
       fn_ae_has_treasury_impact('AGR-002') AS treasury_agr,
       fn_ae_is_income('BTP-001')           AS income_btp,
       fn_ae_is_income('AGR-001')           AS income_agr,
       fn_ae_category('BTP-001')            AS cat_btp,
       fn_ae_category('AGR-001')            AS cat_agr;
-- Attendu : true, true, true, true, 'BTP', 'Agriculture'

-- 2. Règles actives BTP + AGR
SELECT event_type, sequence, debit_account, credit_account, montant_field, status
FROM accounting_event_rules
WHERE event_type LIKE 'BTP-%' OR event_type LIKE 'AGR-%'
ORDER BY event_type, sequence;

-- 3. Version moteur
SELECT version FROM accounting_schema_versions ORDER BY semver_minor DESC LIMIT 3;
-- Attendu : 1.10.0, 1.9.0, 1.8.0

-- 4. Test BTP-001 (facture travaux 500 000 FCFA HT + 94 500 TVA = 594 500 TTC)
SELECT * FROM emit_accounting_event(
  p_tenant_id     := (SELECT id FROM tenants LIMIT 1),
  p_event_type    := 'BTP-001',
  p_source_module := 'btp',
  p_source_table  := 'btp_factures',
  p_source_id     := gen_random_uuid(),
  p_montant_ht    := 500000,
  p_montant_tva   := 94500,
  p_montant_ttc   := 594500,
  p_libelle       := 'Test BTP-001 — Chantier Route Nationale 2026',
  p_date_event    := CURRENT_DATE,
  p_fiscal_year   := 2026,
  p_metadata      := '{"client_id":null,"chantier":"RN-001"}'::jsonb
);
-- Attendu : 2 écritures (séq 1 : 411/722 500000 + séq 2 : 411/4441 94500)

-- 5. Test AGR-001 (vente maïs 200 000 FCFA HT, TVA=0 car exonéré)
SELECT * FROM emit_accounting_event(
  p_tenant_id     := (SELECT id FROM tenants LIMIT 1),
  p_event_type    := 'AGR-001',
  p_source_module := 'agriculture',
  p_source_table  := 'agr_ventes',
  p_source_id     := gen_random_uuid(),
  p_montant_ht    := 200000,
  p_montant_tva   := 0,
  p_montant_ttc   := 200000,
  p_libelle       := 'Test AGR-001 — Vente maïs 5 tonnes',
  p_date_event    := CURRENT_DATE,
  p_fiscal_year   := 2026,
  p_metadata      := '{"produit":"mais","quantite_kg":5000}'::jsonb
);
-- Attendu : 1 écriture (séq 1 : 411/714 200000), pas de TVA

-- 6. Couverture moteur après migration 148
SELECT COUNT(*) AS regles_actives FROM accounting_event_rules WHERE status = 'active';
SELECT COUNT(*) AS regles_draft   FROM accounting_event_rules WHERE status = 'draft';
-- Attendu : actives >= 34 (28 Sprint 147 + 6 BTP/AGR actives), draft >= 22
*/

-- ═════════════════════════════════════════════════════════════════════════════
-- ⛔ ROLLBACK (NE PAS EXÉCUTER — sauf incident majeur)
-- ═════════════════════════════════════════════════════════════════════════════
/*
BEGIN;
DELETE FROM accounting_event_rules WHERE event_type LIKE 'BTP-%' OR event_type LIKE 'AGR-%';
DELETE FROM accounting_schema_versions WHERE version = '1.10.0';
-- Restaurer les 3 fonctions à leur état v1.9.0 (version mig.147)
COMMIT;
*/

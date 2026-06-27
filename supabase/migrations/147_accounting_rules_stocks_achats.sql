-- ═════════════════════════════════════════════════════════════════════════════
-- Migration 147 — Règles comptables SYSCOHADA — Stocks & Achats (STK / ACH)
-- ═════════════════════════════════════════════════════════════════════════════
--
-- Sprint 147 — Gouvernance ERP Sprints (11 phases)
-- Périmètre : Modules Stocks + Achats → moteur comptable central v1.9.0
--
-- ANOMALIES CORRIGÉES :
--   ANOM-STK-01 : trg_stock_in_to_journal  → journal_entries direct (hors moteur)
--   ANOM-STK-02 : trg_stock_out_to_journal → journal_entries direct (hors moteur)
--   ANOM-ACH-01 : trg_achat_enregistrement → journal_entries direct (hors moteur)
--   ANOM-ACH-02 : trg_achat_paye           → transactions direct (hors moteur)
--   ANOM-ACH-03 : receptions page writeComptaEntry() legacy → remplacé par STK-001
--
-- RÈGLES CRÉÉES :
--   STK-001 active  : Réception marchandises              311 / 401 (HT)
--   STK-002 active  : Sortie stock consommation           601 / 311 (HT)
--   STK-003 draft   : Ajustement positif inventaire       311 / 779
--   STK-004 draft   : Ajustement négatif inventaire       679 / 311
--   ACH-001 active  : Facture fournisseur enregistrée     601 / 401 (HT)
--   ACH-002 active  : Paiement fournisseur                401 / 521 (treasury_credit)
--
-- COMPTES SYSCOHADA MOBILISÉS :
--   311  Marchandises               (actif courant, classe 3 — stock permanent)
--   601  Achats de marchandises     (charge exploitation, classe 6)
--   679  Charges diverses HAO       (pertes inventaire, ajustements négatifs)
--   779  Produits divers HAO        (gains inventaire, ajustements positifs)
--   401  Fournisseurs               (tiers créanciers, classe 4)
--   521  Banque / 571 Caisse        (trésorerie, classe 5 — treasury_credit résout)
--
-- NOTE TVA :
--   Table `achats` sans champ TVA décomposé → montant traité comme HT pour ACH-001.
--   Séquence TVA déductible (4452/401) à ajouter quand le module intégrera montant_tva.
--   STK-001 : réception HT uniquement ; TVA (4452) activée avec la montée ACH Pro.
--
-- PATTERN UTILISÉ : P-008 TABLE-BRIDGE-LEGACY + P-003 fire-and-forget
--   Triggers legacy supprimés. Emit dans les routes API TypeScript (server-side).
--   Routes modifiées : POST /api/achats, PATCH /api/achats, POST /api/stock/reception
--   Routes modifiées : POST /api/stock/move (ajout emit STK-002 pour OUT)
--
-- SYSCOHADA VÉRIFICATION (ex: réception 100 000 FCFA HT de marchandises à crédit) :
--   STK-001 : Débit 311 / Crédit 401 = 100 000 → stock augmente, dette fournisseur augmente ✓
--   ACH-002 : Débit 401 / Crédit 521   = 100 000 → dette payée, banque diminue ✓
--   Résultat net : Débit 311 / Crédit 521 = 100 000 ✓ (actif stock remplace actif tréso)
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
    SELECT 1 FROM accounting_schema_versions WHERE version = '1.8.0'
  ) THEN
    RAISE EXCEPTION 'Migration 146 non appliquée — version 1.8.0 manquante.';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_name = 'products'
  ) THEN
    RAISE EXCEPTION 'Table products absente — migration 016 non appliquée.';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_name = 'achats'
  ) THEN
    RAISE EXCEPTION 'Table achats absente — migration 014 non appliquée.';
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. SUPPRIMER TRIGGERS LEGACY STOCKS
-- ─────────────────────────────────────────────────────────────────────────────
-- Ces triggers écrivaient directement dans journal_entries sans moteur central.
-- Après cette migration : emit STK-001/002 dans les routes API → accounting_engine.

DROP TRIGGER IF EXISTS trg_stock_out_to_journal ON stock_movements;
DROP TRIGGER IF EXISTS trg_stock_in_to_journal  ON stock_movements;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. SUPPRIMER TRIGGERS LEGACY ACHATS
-- ─────────────────────────────────────────────────────────────────────────────
-- trg_achat_enregistrement : écrivait 601/401 directement
-- trg_achat_paye           : écrivait 401/571 directement
-- Remplacés par emit ACH-001 (POST /api/achats) + ACH-002 (PATCH /api/achats).

DROP TRIGGER IF EXISTS trg_achat_enregistrement ON achats;
DROP TRIGGER IF EXISTS trg_achat_paye           ON achats;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. fn_ae_has_treasury_impact — ajouter ACH
-- ─────────────────────────────────────────────────────────────────────────────
-- ACH-002 (paiement fournisseur) génère une sortie de trésorerie → besoin treasury.
-- STK : pas de trésorerie directe (crédit 401, pas 521/571).

CREATE OR REPLACE FUNCTION fn_ae_has_treasury_impact(p_event_type TEXT) RETURNS BOOLEAN
  LANGUAGE sql IMMUTABLE AS $$
  SELECT split_part(p_event_type, '-', 1) IN
    ('FAC','TRE','MOB','PAI','HOT','RES','ECO','COM','TRP','SAN','ONG','CAB','BOI','ACH');
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. fn_ae_is_income — STK et ACH sont des charges (pas des revenus)
-- ─────────────────────────────────────────────────────────────────────────────
-- ACH-002 (paiement fournisseur) = sortie trésorerie → is_income = false
-- STK-001/002 = mouvements stock → pas de flux trésorerie → is_income = false
-- La fonction reste identique à mig.146 (pas d'ajout nécessaire).

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. fn_ae_category — ajouter STK et ACH
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
    ELSE 'Autre'
  END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. RÈGLE STK-001 — Réception marchandises (entrée stock à prix d'achat HT)
-- ─────────────────────────────────────────────────────────────────────────────
-- Source : POST /api/stock/reception → statut='validé' → emit STK-001
-- Méthode stock permanent SYSCOHADA : Débit 311 / Crédit 401 = montant_ht
-- Impact trésorerie : AUCUN (dette fournisseur → remboursée par ACH-002)

INSERT INTO accounting_event_rules (
  event_type, sequence, rule_version, status,
  debit_account, credit_account,
  montant_field, amount_formula, account_resolver,
  source_label, libelle_tpl,
  conditions, country_codes, account_plan, valid_from, notes
) VALUES (
  'STK-001', 1, 1, 'active',
  '311', '401',
  'montant_ht', NULL, NULL,
  'reception_stock_ht',
  'Réception stock — {libelle}',
  '[{"field":"montant_ht","op":">","value":"0"}]',
  NULL, 'SYSCOHADA', CURRENT_DATE,
  '311=Marchandises (actif courant, classe 3). 401=Fournisseurs (dette). Méthode stock permanent SYSCOHADA. Montant = somme(quantite_recue × prix_unitaire) de la réception. TVA déductible (4452) à ajouter en séq 2 quand table receptions aura montant_tva.'
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. RÈGLE STK-002 — Sortie stock consommation / utilisation interne
-- ─────────────────────────────────────────────────────────────────────────────
-- Source : POST /api/stock/move (type='OUT') → emit STK-002
-- Sortie = charge sur 601 (coût de revient des marchandises vendues ou consommées)

INSERT INTO accounting_event_rules (
  event_type, sequence, rule_version, status,
  debit_account, credit_account,
  montant_field, amount_formula, account_resolver,
  source_label, libelle_tpl,
  conditions, country_codes, account_plan, valid_from, notes
) VALUES (
  'STK-002', 1, 1, 'active',
  '601', '311',
  'montant_ht', NULL, NULL,
  'sortie_stock_ht',
  'Sortie stock — {libelle}',
  '[{"field":"montant_ht","op":">","value":"0"}]',
  NULL, 'SYSCOHADA', CURRENT_DATE,
  '601=Achats de marchandises (coût de revient, classe 6). 311=Marchandises (actif diminue). Ventes facturées gérées par FAC-001 (produits). STK-002 = sortie physique stock non facturée directement (conso interne, perte, usage). Montant = quantite × prix_achat produit.'
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 8. RÈGLE STK-003 — Ajustement inventaire positif (gain, surplus trouvé)
-- ─────────────────────────────────────────────────────────────────────────────
-- Source : POST /api/stock/move (type='ADJUSTMENT', quantite > 0)
-- DRAFT : activer après validation du processus inventaire en production.

INSERT INTO accounting_event_rules (
  event_type, sequence, rule_version, status,
  debit_account, credit_account,
  montant_field, amount_formula, account_resolver,
  source_label, libelle_tpl,
  conditions, country_codes, account_plan, valid_from, notes
) VALUES (
  'STK-003', 1, 1, 'draft',
  '311', '779',
  'montant_ht', NULL, NULL,
  'ajustement_stock_positif',
  'Ajustement stock + — {libelle}',
  '[{"field":"montant_ht","op":">","value":"0"}]',
  NULL, 'SYSCOHADA', CURRENT_DATE,
  'DRAFT. 311=Marchandises (actif augmente). 779=Reprises/produits divers HAO (gain exceptionnel). Quantite > 0. Activer quand flux inventaire validé en production.'
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 9. RÈGLE STK-004 — Ajustement inventaire négatif (perte, manquant)
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO accounting_event_rules (
  event_type, sequence, rule_version, status,
  debit_account, credit_account,
  montant_field, amount_formula, account_resolver,
  source_label, libelle_tpl,
  conditions, country_codes, account_plan, valid_from, notes
) VALUES (
  'STK-004', 1, 1, 'draft',
  '679', '311',
  'montant_ht', NULL, NULL,
  'ajustement_stock_negatif',
  'Manquant inventaire — {libelle}',
  '[{"field":"montant_ht","op":">","value":"0"}]',
  NULL, 'SYSCOHADA', CURRENT_DATE,
  'DRAFT. 679=Charges diverses HAO (pertes/manquants). 311=Marchandises (actif diminue). Quantite < 0. montant_ht = abs(quantite) × prix_achat. Activer avec STK-003.'
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 10. RÈGLE ACH-001 — Enregistrement facture fournisseur
-- ─────────────────────────────────────────────────────────────────────────────
-- Source : POST /api/achats → création achat → emit ACH-001
-- Table `achats` sans champ TVA → montant traité intégralement comme HT.
-- Séq TVA déductible (4452/401) à ajouter quand le module aura montant_tva.

INSERT INTO accounting_event_rules (
  event_type, sequence, rule_version, status,
  debit_account, credit_account,
  montant_field, amount_formula, account_resolver,
  source_label, libelle_tpl,
  conditions, country_codes, account_plan, valid_from, notes
) VALUES (
  'ACH-001', 1, 1, 'active',
  '601', '401',
  'montant_ht', NULL, NULL,
  'achat_fournisseur_charge',
  'Achat fournisseur — {libelle}',
  '[{"field":"montant_ht","op":">","value":"0"}]',
  NULL, 'SYSCOHADA', CURRENT_DATE,
  '601=Achats de marchandises (charge). 401=Fournisseurs (dette créancier). Table achats sans décomposition TVA → montant HT = montant total. Méthode charge directe (vs méthode stock permanent de STK-001). TVA déductible (4452) à ajouter séq 2 lors upgrade du module achats.'
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 11. RÈGLE ACH-002 — Paiement fournisseur (règlement)
-- ─────────────────────────────────────────────────────────────────────────────
-- Source : PATCH /api/achats (statut → 'paye') → emit ACH-002
-- treasury_credit : fn_ohada_cash_account(mode_paiement) → 521 ou 571

INSERT INTO accounting_event_rules (
  event_type, sequence, rule_version, status,
  debit_account, credit_account,
  montant_field, amount_formula, account_resolver,
  source_label, libelle_tpl,
  conditions, country_codes, account_plan, valid_from, notes
) VALUES (
  'ACH-002', 1, 1, 'active',
  '401', '521',
  'montant_ht', NULL, 'treasury_credit',
  'paiement_fournisseur',
  'Règlement fournisseur — {libelle}',
  '[{"field":"montant_ht","op":">","value":"0"}]',
  NULL, 'SYSCOHADA', CURRENT_DATE,
  '401=Fournisseurs (dette soldée). 521=placeholder treasury_credit → fn_ohada_cash_account(mode_paiement). Espèces → 571 Caisse. Virement → 521 Banque. fn_ae_has_treasury_impact=true, fn_ae_is_income=false → sortie de trésorerie.'
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 12. VERSION MOTEUR 1.9.0
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO accounting_schema_versions
  (version, semver_major, semver_minor, semver_patch, migration_file, description, breaking_change, applied_by)
VALUES (
  '1.9.0', 1, 9, 0,
  '147_accounting_rules_stocks_achats.sql',
  'Sprint 147 — Stocks & Achats → moteur comptable central v1.9.0. '
  'DROP triggers legacy: trg_stock_in_to_journal, trg_stock_out_to_journal (zéro double-écriture journal_entries). '
  'DROP triggers legacy: trg_achat_enregistrement, trg_achat_paye. '
  'STK-001 active: Réception marchandises (311/401 HT — stock permanent SYSCOHADA). '
  'STK-002 active: Sortie stock consommation (601/311 — coût de revient). '
  'STK-003 draft: Ajustement positif (311/779 — à activer après validation inventaire). '
  'STK-004 draft: Ajustement négatif (679/311). '
  'ACH-001 active: Facture fournisseur (601/401 HT charge directe). '
  'ACH-002 active: Paiement fournisseur (401/521 treasury_credit). '
  'fn_ae_has_treasury_impact: ACH ajouté. '
  'fn_ae_category: STK→Stocks, ACH→Achats. '
  'BCI Sprint 147: +3 modules (STK+ACH) dans le moteur.',
  FALSE,
  'Sprint 147 — ERP Sprints gouvernance'
);

COMMIT;

-- ═════════════════════════════════════════════════════════════════════════════
-- ✅ VALIDATION POST-EXÉCUTION (à exécuter séparément dans Supabase)
-- ═════════════════════════════════════════════════════════════════════════════
/*
-- 1. Fonctions moteur
SELECT fn_ae_has_treasury_impact('ACH-002') AS treasury_ach,
       fn_ae_category('STK-001')            AS cat_stk,
       fn_ae_category('ACH-001')            AS cat_ach;
-- Attendu : true, 'Stocks', 'Achats'

-- 2. Règles actives
SELECT event_type, sequence, debit_account, credit_account, montant_field, status
FROM accounting_event_rules
WHERE event_type LIKE 'STK-%' OR event_type LIKE 'ACH-%'
ORDER BY event_type, sequence;
-- Attendu :
-- ACH-001, 1, 601, 401, montant_ht, active
-- ACH-002, 1, 401, 521, montant_ht, active
-- STK-001, 1, 311, 401, montant_ht, active
-- STK-002, 1, 601, 311, montant_ht, active
-- STK-003, 1, 311, 779, montant_ht, draft
-- STK-004, 1, 679, 311, montant_ht, draft

-- 3. Triggers legacy supprimés
SELECT trigger_name FROM information_schema.triggers
WHERE trigger_name IN ('trg_stock_in_to_journal','trg_stock_out_to_journal','trg_achat_enregistrement','trg_achat_paye');
-- Attendu : 0 lignes

-- 4. Version moteur
SELECT version FROM accounting_schema_versions ORDER BY semver_minor DESC LIMIT 3;
-- Attendu : 1.9.0, 1.8.0, 1.7.0

-- 5. Test STK-001 (réception 100 000 FCFA HT de marchandises)
SELECT * FROM emit_accounting_event(
  p_tenant_id     := (SELECT id FROM tenants LIMIT 1),
  p_event_type    := 'STK-001',
  p_source_module := 'stocks',
  p_source_table  := 'stock_receptions',
  p_source_id     := gen_random_uuid(),
  p_montant_ht    := 100000,
  p_montant_tva   := 0,
  p_montant_ttc   := 100000,
  p_libelle       := 'Test STK-001 — Réception marchandises REC-2026-0001',
  p_date_event    := CURRENT_DATE,
  p_fiscal_year   := 2026,
  p_metadata      := '{"supplier_id":null,"nb_lignes":3}'::jsonb
);
-- Puis vérifier is_balanced=true, entries_count=1, total_debit=100000=total_credit

-- 6. Test ACH-002 (paiement fournisseur 50 000 FCFA espèces)
SELECT * FROM emit_accounting_event(
  p_tenant_id     := (SELECT id FROM tenants LIMIT 1),
  p_event_type    := 'ACH-002',
  p_source_module := 'achats',
  p_source_table  := 'achats',
  p_source_id     := gen_random_uuid(),
  p_montant_ht    := 50000,
  p_montant_tva   := 0,
  p_montant_ttc   := 50000,
  p_libelle       := 'Test ACH-002 — Règlement Fournisseur ABC',
  p_date_event    := CURRENT_DATE,
  p_fiscal_year   := 2026,
  p_metadata      := '{"mode_paiement":"especes","fournisseur_id":null}'::jsonb
);
-- Attendu : transaction créée type='sortie', categorie='Achats', montant=50000
*/

-- ═════════════════════════════════════════════════════════════════════════════
-- ⛔ ROLLBACK (NE PAS EXÉCUTER — sauf incident majeur)
-- ═════════════════════════════════════════════════════════════════════════════
/*
BEGIN;
DELETE FROM accounting_event_rules WHERE event_type LIKE 'STK-%' OR event_type LIKE 'ACH-%';
DELETE FROM accounting_schema_versions WHERE version = '1.9.0';
CREATE OR REPLACE FUNCTION fn_ae_has_treasury_impact(p_event_type TEXT) RETURNS BOOLEAN
  LANGUAGE sql IMMUTABLE AS $$
  SELECT split_part(p_event_type, '-', 1) IN
    ('FAC','TRE','MOB','PAI','HOT','RES','ECO','COM','TRP','SAN','ONG','CAB','BOI');
$$;
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
COMMIT;
*/

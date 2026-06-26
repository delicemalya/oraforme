-- ═════════════════════════════════════════════════════════════════════════════
-- Migration 144 — Règles comptables SYSCOHADA — Module Hôtel (HOT)
-- ═════════════════════════════════════════════════════════════════════════════
--
-- Plan Directeur Oraforme — Phase 5 (sixième migration métier)
-- Gouvernance : Audit → Implémentation → Quick Wins → Validation →
--               Audit cohérence → Certification → Documentation
--
-- PÉRIMÈTRE :
--   ✅ UPDATE fn_ae_is_income : ajouter HOT-001, HOT-002 (manquants depuis mig.138)
--   ✅ Règle HOT-001 active : encaissement chambre — 2 séquences (HT + TVA)
--   ✅ Règle HOT-002 draft  : dépense opérationnelle (route htl_expenses absente)
--   ✅ Version moteur : 1.6.0
--
-- QUICK WIN LOCAL QW-05 :
--   Suppression écritures htl_journal_entries + htl_journal_lines dans
--   POST /api/hotel/payments (TypeScript — hors SQL)
--   Compte '7011' non-SYSCOHADA supprimé automatiquement
--
-- HORS SCOPE (documenté PROJECT_HEALTH) :
--   - hotel_chambres / hotel_reservations (mig.052) — dead code potentiel — audit LEC
--   - htl_journal_entries / htl_journal_lines tables — conservées (historique)
--   - htl_expenses route — inexistante, HOT-002 restera draft
--
-- VÉRIFICATION SYSCOHADA (Congo-Brazzaville, 118 900 FCFA TTC, espèces) :
--   HOT-001 :
--     Séq 1 : 571  / 706   = 100 000 FCFA (HT hébergement)
--     Séq 2 : 571  / 4441  =  18 900 FCFA (TVA 18% + CA 5%/TVA)
--     Débit total 571 = 118 900 = montant_ttc ✓
--     Crédit 706  = 100 000 (CA Classe 7 SYSCOHADA) ✓
--     Crédit 4441 =  18 900 (TVA collectée due à l'État) ✓
--
-- COMPTES SYSCOHADA MOBILISÉS :
--   521  Banque (virement/carte) — fn_ohada_cash_account si mode_paiement='virement'
--   571  Caisse (espèces)
--   5711 Mobile Airtel / 5712 Mobile MTN
--   706  Produits des prestations de services (hébergement)
--   4441 État, TVA collectée
--   (HOT-002 draft : 604/6xx vs 401/571 — à activer quand route htl_expenses créée)
--
-- MOTEUR — HOT état avant mig.144 (audit ANOM-01/02) :
--   fn_ae_has_treasury_impact : HOT ∈ liste ✓ (mig.138)
--   fn_ae_is_income           : HOT-004 ∈ liste MAIS HOT-001 absent ❌ → corrigé ici
--   fn_ae_category            : HOT → 'Hôtel' ✓ (mig.138)
--
-- MATRICE COHÉRENCE APRÈS MIGRATION (118 900 FCFA TTC) :
--   Métier       → htl_payments                          118 900 FCFA ✓
--   Trésorerie   → transactions (HOT-001, entree)        118 900 FCFA ✓ [était 0 avant]
--   Comptabilité → journal_entries (571/706 + 571/4441)  118 900 FCFA ✓ [était 0 avant]
--   Grand Livre  → journal_entries 706 CR +100 000       100 000 FCFA ✓
--                                  4441 CR +18 900        18 900 FCFA ✓
--   Audit        → accounting_event_log (is_balanced=true) TRACÉ    ✓
--   États fin.   → Classe 7 : +100 000 FCFA CA           100 000 FCFA ✓
--   MIAA         → accounting_events HOT-001             118 900 FCFA ✓
--   journal_comptable → 0 via moteur (écart LEC documenté) GAP connu ✓
--   Dashboards   → htl_payments (lecture directe — INCHANGÉ)  118 900 FCFA ✓
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
    SELECT 1 FROM accounting_schema_versions WHERE version = '1.5.0'
  ) THEN
    RAISE EXCEPTION 'Migration 143 non appliquée — version 1.5.0 manquante.';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_name = 'htl_payments'
  ) THEN
    RAISE EXCEPTION 'Table htl_payments absente — migration 082 non appliquée.';
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. CORRIGER fn_ae_is_income — ajouter HOT-001
-- ─────────────────────────────────────────────────────────────────────────────
-- Anomalie ANOM-02 : fn_ae_is_income listait HOT-004 mais pas HOT-001.
-- Sans cette correction, emit HOT-001 crée une transaction type='sortie'
-- au lieu de type='entree'. L'encaissement hôtel apparaîtrait comme dépense.

CREATE OR REPLACE FUNCTION fn_ae_is_income(p_event_type TEXT) RETURNS BOOLEAN
  LANGUAGE sql IMMUTABLE AS $$
  SELECT p_event_type IN (
    'FAC-002','SAN-001','SAN-002','RES-001','ECO-001','ECO-002','ECO-003','ECO-004','ECO-005',
    'COM-001','TRE-001','MOB-001','ONG-001','ONG-002',
    'HOT-001','HOT-004',
    'TRP-001','CAB-001'
  );
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. RÈGLE HOT-001 — Encaissement chambre (paiement facture hôtel)
-- ─────────────────────────────────────────────────────────────────────────────
-- Source : POST /api/hotel/payments → emit HOT-001
-- emit_accounting_event('HOT-001', ...,
--   montant_ht = Math.round(ttc/1.189),
--   montant_tva = ttc - ht,
--   montant_ttc = montant_collecté,
--   metadata = { mode_paiement, reservation_id?, invoice_id? })
--
-- Séq 1 : 5xx  / 706   — Produit HT hébergement
-- Séq 2 : 5xx  / 4441  — TVA + Centime Additionnel collectés
--
-- Diviseur TVA Congo : TTC = HT × 1.189 → HT = TTC ÷ 1.189
-- (TVA 18% + CA 5% de la TVA = 18% + 0.9% = 18.9%)

INSERT INTO accounting_event_rules (
  event_type, sequence, rule_version, status,
  debit_account, credit_account,
  montant_field, amount_formula, account_resolver,
  source_label, libelle_tpl,
  conditions, country_codes, account_plan,
  valid_from, notes
) VALUES
-- Séquence 1 : Produit HT hébergement
(
  'HOT-001', 1, 1, 'active',
  '521', '706',
  'montant_ht', NULL, 'treasury_debit',
  'hotel_encaissement_ht',
  'Hébergement HT — {libelle}',
  '[{"field":"montant_ht","op":">","value":"0"}]',
  NULL,
  'SYSCOHADA',
  CURRENT_DATE,
  '521=placeholder remplacé par treasury_debit→fn_ohada_cash_account(mode_paiement). 706=Produits des prestations de services (AUDCIF classe 7). Séq 1 sur 2 : produit HT uniquement. TVA séparée en séq 2.'
),
-- Séquence 2 : TVA + CA collectés
(
  'HOT-001', 2, 1, 'active',
  '521', '4441',
  'montant_tva', NULL, 'treasury_debit',
  'hotel_encaissement_tva',
  'TVA hébergement — {libelle}',
  '[{"field":"montant_tva","op":">","value":"0"}]',
  NULL,
  'SYSCOHADA',
  CURRENT_DATE,
  '521=même compte trésorerie que séq 1. 4441=État, TVA collectée (18% + CA 5%/TVA). Congo: TTC = HT × 1.189. api calcule ht=round(ttc/1.189), tva=ttc-ht avant emit.'
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. RÈGLE HOT-002 — Dépense opérationnelle hôtel (DRAFT)
-- ─────────────────────────────────────────────────────────────────────────────
-- À activer quand POST /api/hotel/expenses sera créé.
-- htl_expenses existe en base (mig.082) mais aucune route ne l'alimente via API.

INSERT INTO accounting_event_rules (
  event_type, sequence, rule_version, status,
  debit_account, credit_account,
  montant_field, amount_formula, account_resolver,
  source_label, libelle_tpl,
  conditions, country_codes, account_plan,
  valid_from, notes
) VALUES
(
  'HOT-002', 1, 1, 'draft',
  '604', '401',
  'montant_ht', NULL, NULL,
  'hotel_depense',
  'Dépense hôtel — {libelle}',
  '[{"field":"montant_ht","op":">","value":"0"}]',
  NULL,
  'SYSCOHADA',
  CURRENT_DATE,
  'DRAFT — 604=Achats matières/fournitures hôtel. 401=Fournisseurs. À activer quand route POST /api/hotel/expenses créée. Vérifier catégorie: salaires→661, énergie→606, maintenance→615.'
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. VERSION MOTEUR 1.6.0
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO accounting_schema_versions
  (version, semver_major, semver_minor, semver_patch, migration_file, description, breaking_change, applied_by)
VALUES (
  '1.6.0', 1, 6, 0,
  '144_accounting_rules_hotel.sql',
  'Règles HOT-001 (encaissement chambre, 2 séquences, TVA décomposée 706+4441) et HOT-002 (dépense, draft). '
  'UPDATE fn_ae_is_income : HOT-001 ajouté (manquait depuis mig.138 — ANOM-02). '
  'QW-05 : suppression htl_journal_entries/htl_journal_lines path (compte 7011 non-SYSCOHADA). '
  'Nouveau chemin : POST /api/hotel/payments → emit HOT-001. '
  'Matrice cohérence : Trésorerie/Comptabilité/Grand Livre/États financiers = 100% alignés.',
  FALSE,
  'Plan Directeur Phase 5 — Migration 144'
);

COMMIT;

-- ═════════════════════════════════════════════════════════════════════════════
-- VALIDATION POST-EXÉCUTION (à exécuter séparément)
-- ═════════════════════════════════════════════════════════════════════════════

/*
-- 1. fn_ae_is_income corrigée
SELECT fn_ae_is_income('HOT-001'), fn_ae_is_income('HOT-004'), fn_ae_is_income('HOT-002');
-- Attendu : true, true, false

-- 2. Règles HOT actives
SELECT event_type, sequence, debit_account, credit_account, montant_field, account_resolver, status
FROM accounting_event_rules WHERE event_type LIKE 'HOT-%' ORDER BY event_type, sequence;
-- Attendu :
-- HOT-001, 1, 521, 706,  montant_ht,  treasury_debit, active
-- HOT-001, 2, 521, 4441, montant_tva, treasury_debit, active
-- HOT-002, 1, 604, 401,  montant_ht,  NULL,           draft

-- 3. Version moteur
SELECT version FROM accounting_schema_versions ORDER BY semver_minor DESC LIMIT 3;
-- Attendu : 1.6.0, 1.5.0, 1.4.0

-- 4. Test HOT-001 fonctionnel (118 900 FCFA TTC = 100 000 HT + 18 900 TVA)
SELECT * FROM emit_accounting_event(
  p_tenant_id     := (SELECT id FROM tenants LIMIT 1),
  p_event_type    := 'HOT-001',
  p_source_module := 'hotel',
  p_source_table  := 'htl_payments',
  p_source_id     := gen_random_uuid(),
  p_montant_ht    := 100000,
  p_montant_tva   := 18900,
  p_montant_ttc   := 118900,
  p_libelle       := 'Test HOT-001 — Chambre Standard — 3 nuits',
  p_date_event    := CURRENT_DATE,
  p_fiscal_year   := 2026,
  p_metadata      := '{"mode_paiement": "especes", "reservation_id": null}'::jsonb
);

-- 5. Vérifier is_balanced=true + 2 séquences
SELECT ae.status, ael.entries_count, ael.total_debit, ael.total_credit, ael.is_balanced
FROM accounting_events ae
LEFT JOIN accounting_event_log ael ON ael.event_id = ae.id
WHERE ae.event_type = 'HOT-001' ORDER BY ae.created_at DESC LIMIT 1;
-- Attendu : processed, entries_count=2, total_debit=118900, total_credit=118900, is_balanced=true

-- 6. Détail des écritures
SELECT je.compte_debit, je.compte_credit, je.montant, je.libelle
FROM journal_entries je
WHERE je.source_event_type = 'HOT-001'
ORDER BY je.created_at DESC LIMIT 2;
-- Attendu : (571, 706, 100000) + (571, 4441, 18900)
*/

-- ═════════════════════════════════════════════════════════════════════════════
-- ⛔ ROLLBACK — NE PAS EXÉCUTER (sauf incident majeur)
-- ═════════════════════════════════════════════════════════════════════════════

/*
BEGIN;
-- Restaurer fn_ae_is_income sans HOT-001
CREATE OR REPLACE FUNCTION fn_ae_is_income(p_event_type TEXT) RETURNS BOOLEAN
  LANGUAGE sql IMMUTABLE AS $$
  SELECT p_event_type IN (
    'FAC-002','SAN-001','SAN-002','RES-001','ECO-001','ECO-002','ECO-003','ECO-004','ECO-005',
    'COM-001','TRE-001','MOB-001','ONG-001','ONG-002','HOT-004','TRP-001','CAB-001'
  );
$$;
DELETE FROM accounting_event_rules WHERE event_type LIKE 'HOT-%' AND rule_version = 1;
DELETE FROM accounting_schema_versions WHERE version = '1.6.0';
COMMIT;
*/

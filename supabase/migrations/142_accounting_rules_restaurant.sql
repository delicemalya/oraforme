-- ═════════════════════════════════════════════════════════════════════════════
-- Migration 142 — Règles comptables SYSCOHADA — Module Restaurant (RES)
-- ═════════════════════════════════════════════════════════════════════════════
--
-- Plan Directeur Oraforme — Phase 4.4 (quatrième migration métier)
-- Méthode : cycle Audit → Implémentation → Validation → Commit
--
-- PÉRIMÈTRE :
--   ✅ Règles accounting_event_rules RES-001 (vente POS)  — 2 séquences — active
--   ✅ Règles accounting_event_rules RES-002 (achat mat.) — 1 séquence  — active
--   ✅ Règles accounting_event_rules RES-003/004          — DRAFT
--   ✅ Version moteur : 1.4.0
--   ✅ Pas de DROP TRIGGER : aucun trigger dédié sur resto_commandes / resto_achats
--      Le chemin legacy était : INSERT transactions → trg_transaction_to_journal
--      Suppression des inserts transactions dans les routes API met fin à ce chemin.
--
-- VÉRIFICATION SYSCOHADA (Congo-Brazzaville, vente POS 100 000 FCFA HT) :
--   RES-001 :
--     Séq 1 : 571 / 706   ht=100 000       Vente POS — HT
--     Séq 2 : 571 / 4441  tva=18 900       TVA(18%)+CA(5%/TVA) collectés
--     Débit total 571 = 118 900 = TTC ✓
--     Crédit total = 706(100 000) + 4441(18 900) = 118 900 ✓
--   RES-002 (achat 50 000 FCFA) :
--     Séq 1 : 604 / 571   ttc=50 000       Achat matières premières
--     Double entrée équilibrée ✓
--
-- COMPTES SYSCOHADA MOBILISÉS :
--   571  Caisse (espèces) — fn_ohada_cash_account résout : airtel→5711, mtn→5712
--   521  Banque (virement) — fn_ohada_cash_account si mode_paiement='virement'
--   706  Produits des services vendus (revenus restaurant)
--   4441 TVA collectée à reverser à l'État
--   604  Achats stockés de matières premières (ingredients cuisine)
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
    SELECT 1 FROM accounting_schema_versions WHERE version = '1.3.0'
  ) THEN
    RAISE EXCEPTION 'Migration 141 non appliquée — version 1.3.0 manquante.';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_name = 'resto_commandes'
  ) THEN
    RAISE EXCEPTION 'Table resto_commandes absente — migration 001 non appliquée.';
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. RÈGLES RES-001 — Vente POS restaurant (sur création commande caisse)
-- ─────────────────────────────────────────────────────────────────────────────
-- Source : POST /api/resto/commandes → source='caisse'
-- emit_accounting_event('RES-001', ...,
--   montant_ht=fiscal.ht, montant_tva=fiscal.tva+fiscal.ca, montant_ttc=fiscal.ttc,
--   metadata={mode_paiement, numero_recu, table_num, ...})
--
-- 2 écritures :
--   Séq 1 : 5xx / 706   HT → produit des services vendus
--   Séq 2 : 5xx / 4441  TVA+CA → dette fiscale collectée
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

-- Séquence 1 : Vente POS — HT reconnu en produit des services
(
  'RES-001', 1, 1, 'active',
  '521', '706',
  'montant_ht', NULL, 'treasury_debit',
  'resto_vente_ht',
  'Vente POS — {numero_recu} — HT',
  '[{"field":"montant_ht","op":">","value":"0"}]',
  NULL,
  'SYSCOHADA',
  CURRENT_DATE,
  '521=placeholder remplacé par treasury_debit→fn_ohada_cash_account(mode_paiement). 706=Produits des services vendus SYSCOHADA (restaurant = prestation de service). Source: AUDCIF plan de comptes révisé 2017, classe 7.'
),

-- Séquence 2 : TVA + CA (Contribution à l''Apprentissage) collectés
(
  'RES-001', 2, 1, 'active',
  '521', '4441',
  'montant_tva', NULL, 'treasury_debit',
  'resto_vente_tva',
  'TVA+CA collectés — {numero_recu}',
  '[{"field":"montant_tva","op":">","value":"0"}]',
  NULL,
  'SYSCOHADA',
  CURRENT_DATE,
  '521=placeholder remplacé par treasury_debit. 4441=TVA collectée à reverser à l''État. montant_tva = TVA(18%) + CA(5%/TVA) calculés par calculerTVACongo(). Congo: TVA 18% + Contribution Apprentissage 5% de la TVA (CGI Congo).'
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. RÈGLES RES-002 — Achat matières premières restaurant
-- ─────────────────────────────────────────────────────────────────────────────
-- Source : POST /api/resto/achats
-- emit_accounting_event('RES-002', ...,
--   montant_ht=total, montant_tva=0, montant_ttc=total,
--   metadata={mode_paiement, fournisseur_nom, ...})
--
-- 1 écriture :
--   Séq 1 : 604 / 5xx   Achats stockés matières premières

INSERT INTO accounting_event_rules (
  event_type, sequence, rule_version, status,
  debit_account, credit_account,
  montant_field, amount_formula, account_resolver,
  source_label, libelle_tpl,
  conditions, country_codes, account_plan,
  valid_from, notes
) VALUES
(
  'RES-002', 1, 1, 'active',
  '604', '521',
  'montant_ttc', NULL, 'treasury_credit',
  'resto_achat_matieres',
  'Achat matières restaurant — {fournisseur_nom}',
  '[{"field":"montant_ttc","op":">","value":"0"}]',
  NULL,
  'SYSCOHADA',
  CURRENT_DATE,
  '604=Achats stockés de matières premières (ingrédients cuisine — entrés en stock via stock_articles). 521=placeholder remplacé par treasury_credit→fn_ohada_cash_account(mode_paiement). Source: AUDCIF classe 6 — achats de matières premières à stocker.'
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. RÈGLES DRAFT — RES-003, RES-004
-- ─────────────────────────────────────────────────────────────────────────────

-- RES-003 : Avoir / annulation commande (extourne RES-001)
INSERT INTO accounting_event_rules (
  event_type, sequence, rule_version, status,
  debit_account, credit_account,
  montant_field, amount_formula, account_resolver,
  source_label, libelle_tpl,
  conditions, country_codes, account_plan,
  valid_from, notes
) VALUES
(
  'RES-003', 1, 1, 'draft',
  '706', '521',
  'montant_ht', NULL, 'treasury_credit',
  'resto_avoir_ht',
  'Avoir/annulation commande — {numero_recu} — HT',
  '[{"field":"montant_ht","op":">","value":"0"}]',
  NULL,
  'SYSCOHADA',
  CURRENT_DATE,
  'DRAFT — Extourne de RES-001 seq 1. À activer si module annulation commandes avec remboursement client. Séquence 2 (TVA) à ajouter.'
);

-- RES-004 : Perte/déchets matières premières (sortie stock sans vente)
INSERT INTO accounting_event_rules (
  event_type, sequence, rule_version, status,
  debit_account, credit_account,
  montant_field, amount_formula, account_resolver,
  source_label, libelle_tpl,
  conditions, country_codes, account_plan,
  valid_from, notes
) VALUES
(
  'RES-004', 1, 1, 'draft',
  '6031', '31',
  'montant_ht', NULL, NULL,
  'resto_perte_stock',
  'Perte matières — {article_nom}',
  '[{"field":"montant_ht","op":">","value":"0"}]',
  NULL,
  'SYSCOHADA',
  CURRENT_DATE,
  'DRAFT — 6031=Variation stocks matières premières (charge). 31=Stocks matières premières (actif soustractif). À activer si module gestion des pertes implémenté.'
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. VERSION MOTEUR 1.4.0
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO accounting_schema_versions
  (version, semver_major, semver_minor, semver_patch, migration_file, description, breaking_change, applied_by)
VALUES (
  '1.4.0', 1, 4, 0,
  '142_accounting_rules_restaurant.sql',
  'Règles RES-001 à RES-004. RES-001 (vente POS, 2 séquences HT+TVA/CA) et RES-002 (achat matières) actives. '
  'RES-003/004 en draft. Pas de trigger legacy dédié restaurant — chemin legacy '
  'était via trg_transaction_to_journal (table transactions). Suppression des inserts '
  'transactions dans les routes commandes et achats dans cette migration.',
  FALSE,
  'Plan Directeur Phase 4.4 — Migration 142'
);

COMMIT;

-- ═════════════════════════════════════════════════════════════════════════════
-- VALIDATION POST-EXÉCUTION (à exécuter séparément pour vérification)
-- ═════════════════════════════════════════════════════════════════════════════

/*
-- 1. Vérifier les règles RES actives
SELECT event_type, sequence, debit_account, credit_account, montant_field,
       account_resolver, status
FROM accounting_event_rules
WHERE event_type LIKE 'RES-%'
ORDER BY event_type, sequence;

-- Résultat attendu :
-- RES-001, 1, 521, 706,  montant_ht,  treasury_debit,  active
-- RES-001, 2, 521, 4441, montant_tva, treasury_debit,  active
-- RES-002, 1, 604, 521,  montant_ttc, treasury_credit, active
-- RES-003, 1, 706, 521,  montant_ht,  treasury_credit, draft
-- RES-004, 1, 6031,31,   montant_ht,  NULL,            draft

-- 2. Confirmer la version
SELECT version, applied_at FROM accounting_schema_versions ORDER BY semver_major, semver_minor;
-- Résultat attendu : 1.0.0, 1.1.0, 1.2.0, 1.3.0, 1.4.0

-- 3. Vérifier qu'aucun trigger dédié resto n'existe
SELECT tgname FROM pg_trigger
WHERE tgrelid IN ('resto_commandes'::regclass, 'resto_achats'::regclass);
-- Résultat attendu : 0 lignes (aucun trigger comptable sur ces tables)

-- 4. Vérifier les tables sources accessibles
SELECT COUNT(*) FROM resto_commandes LIMIT 1;
SELECT COUNT(*) FROM resto_achats LIMIT 1;
-- Résultat attendu : 1 ligne (0 ou plus)

-- 5. Balance SYSCOHADA test (vente POS 100 000 FCFA HT)
-- RES-001 seq 1 : Débit 571 = 100 000 / Crédit 706 = 100 000
-- RES-001 seq 2 : Débit 571 = 18 900  / Crédit 4441= 18 900
-- Total débit 571  = 118 900 = fiscal.ttc ✓
-- Total crédit     = 706(100 000) + 4441(18 900) = 118 900 ✓
*/

-- ═════════════════════════════════════════════════════════════════════════════
-- ⛔ ROLLBACK — NE PAS EXÉCUTER (sauf incident majeur)
-- ═════════════════════════════════════════════════════════════════════════════

/*
BEGIN;
DELETE FROM accounting_event_rules WHERE event_type LIKE 'RES-%' AND rule_version = 1;
DELETE FROM accounting_schema_versions WHERE version = '1.4.0';
COMMIT;
*/

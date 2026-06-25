-- ═════════════════════════════════════════════════════════════════════════════
-- Migration 137 — Normalisation Globale des Comptes SYSCOHADA
-- ═════════════════════════════════════════════════════════════════════════════
--
-- Objectif : après les migrations 119 (backfill partiel + normalize trigger),
-- 131, 132 (TVA normalisation) et 133 (tresorerie vues), il subsiste trois
-- catégories de codes non normalisés dans journal_entries et dans les
-- fonctions SQL (triggers) :
--
--   A) 441000 → normalise en '441' par le trigger, alors que TVA collectée
--      = '4441' (SYSCOHADA révisé 2017 : compte 4441 État TVA facturée).
--      Affecte sources : factures_emises, factures_tva, tva_declaration,
--      tva_paiement, sante_facture, resto_vente.
--
--   B) 571100 / 571200 (Mobile Money) → non normalisés car RIGHT(3)≠'000'.
--      Doivent devenir '5711' (Airtel) et '5712' (MTN MoMo).
--
--   C) Résidus 6 chiffres non couverts par migration 119 : 706000, 447000,
--      444000, 664000, 644000, 658000, 310000 (si antérieurs à la migration).
--
-- Périmètre :
--   SQL  → fn_normalize_journal_account_codes (amélioration)
--          fn_facture_issued_to_journal       (réécriture 3/4 chiffres)
--          fn_facture_paid_to_journal         (réécriture 3/4 chiffres)
--          fn_tva_declaration_to_journal      (réécriture 3/4 chiffres)
--          fn_mobile_wallet_operation_to_journal (réécriture 3/4 chiffres)
--          fn_transfer_to_journal             (réécriture 3/4 chiffres)
--   DATA → backfill journal_entries (cas non couverts par migration 119)
--
-- Migrations précédentes à vérifier avant d'appliquer :
--   ✅ 119 — backfill 521000/411000/401000 + normalize trigger v1
--   ✅ 131 — fn_his_facture_journal (santé) corrigée → 4441
--   ✅ 132 — UPDATE TVA source='facture' → 4441
--   ✅ 133 — vue_tresorerie_unifiee + fn_sync_tresorerie_soldes corrigées
--
-- CONTRAINTES OHADA :
--   441  = État — Subventions à recevoir (jamais utilisé dans Oraforme)
--   4441 = État — TVA facturée (SYSCOHADA révisé 2017 — compte CORRECT pour TVA collectée)
--   444  = État — TVA à décaisser
--   4445 = TVA récupérable sur immobilisations
--   4446 = TVA récupérable sur achats
--   5711 = Mobile Money — Airtel Money
--   5712 = Mobile Money — MTN MoMo
--
-- ═════════════════════════════════════════════════════════════════════════════
-- ⚡ BLOC À EXÉCUTER
-- ═════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. BACKFILL — TVA collectée : '441' → '4441'
-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 119 a corrigé source='facture' → 4441 mais pas les autres sources.
-- fn_facture_issued_to_journal (046) utilise '441000' → normalize → '441' (faux).
-- fn_tva_declaration_to_journal (046) idem.
-- Toutes les occurrences de '441' en crédit ou débit dans journal_entries
-- représentent la TVA collectée : aucune écriture légitime au compte 441
-- (Subventions à recevoir) n'existe dans Oraforme.

UPDATE journal_entries
  SET credit_account = '4441'
  WHERE credit_account = '441';

UPDATE journal_entries
  SET debit_account = '4441'
  WHERE debit_account = '441';

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. BACKFILL — Mobile Money : '571100' → '5711', '571200' → '5712'
-- ─────────────────────────────────────────────────────────────────────────────
-- Ces codes ne finissent pas par '000' → ignorés par le trigger de migration 119.
-- Migration 135 a mis à jour fn_ohada_cash_account → 5711/5712 pour les
-- nouvelles opérations, mais les anciennes restaient 571100/571200.

UPDATE journal_entries SET debit_account  = '5711' WHERE debit_account  = '571100';
UPDATE journal_entries SET credit_account = '5711' WHERE credit_account = '571100';
UPDATE journal_entries SET debit_account  = '5712' WHERE debit_account  = '571200';
UPDATE journal_entries SET credit_account = '5712' WHERE credit_account = '571200';

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. BACKFILL — Résidus 6 chiffres non couverts par migration 119
-- ─────────────────────────────────────────────────────────────────────────────
-- Ces codes auraient dû être normalisés par le trigger mais peuvent exister
-- dans des données antérieures à la migration 119 ou insérées hors trigger.

-- Prestations de services / Ventes
UPDATE journal_entries SET debit_account  = '706' WHERE debit_account  = '706000';
UPDATE journal_entries SET credit_account = '706' WHERE credit_account = '706000';
UPDATE journal_entries SET debit_account  = '701' WHERE debit_account  = '701000';
UPDATE journal_entries SET credit_account = '701' WHERE credit_account = '701000';

-- État / Impôts
UPDATE journal_entries SET debit_account  = '447' WHERE debit_account  = '447000';
UPDATE journal_entries SET credit_account = '447' WHERE credit_account = '447000';
UPDATE journal_entries SET debit_account  = '444' WHERE debit_account  = '444000';
UPDATE journal_entries SET credit_account = '444' WHERE credit_account = '444000';

-- Stocks
UPDATE journal_entries SET debit_account  = '310' WHERE debit_account  = '310000';
UPDATE journal_entries SET credit_account = '310' WHERE credit_account = '310000';

-- Charges personnel / CNSS
UPDATE journal_entries SET debit_account  = '664' WHERE debit_account  = '664000';
UPDATE journal_entries SET credit_account = '664' WHERE credit_account = '664000';
UPDATE journal_entries SET debit_account  = '644' WHERE debit_account  = '644000';
UPDATE journal_entries SET credit_account = '644' WHERE credit_account = '644000';

-- Charges diverses
UPDATE journal_entries SET debit_account  = '658' WHERE debit_account  = '658000';
UPDATE journal_entries SET credit_account = '658' WHERE credit_account = '658000';

-- Chèques à encaisser
UPDATE journal_entries SET debit_account  = '512' WHERE debit_account  = '512000';
UPDATE journal_entries SET credit_account = '512' WHERE credit_account = '512000';

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. AMÉLIORER fn_normalize_journal_account_codes
-- ─────────────────────────────────────────────────────────────────────────────
-- Étend les règles de migration 119 pour couvrir :
--   - 571100 → 5711, 571200 → 5712 (mobile money)
--   - 441/443 → 4441 universellement (pas seulement source='facture')
--   - 422 → 421 universellement (pas seulement source='paie')
-- Ce trigger continue à servir de filet de sécurité pour toutes les routes
-- et triggers SQL qui n'auraient pas encore été mis à jour.

CREATE OR REPLACE FUNCTION fn_normalize_journal_account_codes()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  d TEXT := NEW.debit_account;
  c TEXT := NEW.credit_account;
BEGIN
  -- Règle 1 : tronquer les codes 6 chiffres finissant par '000' → 3 chiffres
  -- Ex: 521000 → 521, 411000 → 411, 706000 → 706, 664000 → 664
  IF LENGTH(d) = 6 AND RIGHT(d, 3) = '000' THEN d := LEFT(d, 3); END IF;
  IF LENGTH(c) = 6 AND RIGHT(c, 3) = '000' THEN c := LEFT(c, 3); END IF;

  -- Règle 2 : mobile money 571100 → 5711, 571200 → 5712
  IF d = '571100' THEN d := '5711'; END IF;
  IF c = '571100' THEN c := '5711'; END IF;
  IF d = '571200' THEN d := '5712'; END IF;
  IF c = '571200' THEN c := '5712'; END IF;

  -- Règle 3 : TVA collectée — toute occurrence de '441' ou '443' → '4441'
  -- 441 (Subventions à recevoir) n'est jamais utilisé dans Oraforme.
  -- 441000 (tronqué en '441') ou '443000' (tronqué en '443') = TVA = '4441'.
  IF d IN ('441','443') THEN d := '4441'; END IF;
  IF c IN ('441','443') THEN c := '4441'; END IF;

  -- Règle 4 : rémunérations dues — 422 → 421
  -- 422 = Personnel avances et acomptes ; 421 = Personnel rémunérations dues.
  IF d = '422' THEN d := '421'; END IF;
  IF c = '422' THEN c := '421'; END IF;

  NEW.debit_account  := d;
  NEW.credit_account := c;
  RETURN NEW;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. CORRIGER fn_facture_issued_to_journal (migration 046)
-- ─────────────────────────────────────────────────────────────────────────────
-- Remplace '411000' → '411', '706000' → '706', '441000' → '4441'.
-- Supprime la TX prévisionnelle (AN-019 : doublon avec trg_transaction).

CREATE OR REPLACE FUNCTION fn_facture_issued_to_journal()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
AS $fn_fac_issued$
DECLARE
  v_year    INT;
  v_ht      NUMERIC(14,2);
  v_tva     NUMERIC(14,2);
  v_libelle TEXT;
  v_date    DATE;
BEGIN
  IF (OLD.statut IS DISTINCT FROM 'envoyee') AND NEW.statut = 'envoyee' THEN
    IF EXISTS (
      SELECT 1 FROM journal_entries
      WHERE source = 'factures_emises' AND source_id = NEW.id AND tenant_id = NEW.tenant_id
    ) THEN RETURN NEW; END IF;

    v_date    := COALESCE(NEW.due_date, CURRENT_DATE);
    v_year    := EXTRACT(YEAR FROM v_date)::INT;
    v_tva     := COALESCE(NEW.tva_montant, 0);
    v_ht      := GREATEST(COALESCE(NEW.total, 0) - v_tva, 0);
    v_libelle := 'Facture ' || COALESCE(NEW.invoice_number, NEW.id::TEXT);

    -- Clients (411) / Prestations de services (706) — HT
    IF v_ht > 0 THEN
      INSERT INTO journal_entries
        (tenant_id, date_operation, libelle, debit_account, credit_account, montant, source, source_id, fiscal_year)
      VALUES
        (NEW.tenant_id, v_date, v_libelle, '411', '706', v_ht, 'factures_emises', NEW.id, v_year);
    END IF;

    -- Clients (411) / État TVA facturée (4441) — TVA collectée
    IF v_tva > 0 THEN
      INSERT INTO journal_entries
        (tenant_id, date_operation, libelle, debit_account, credit_account, montant, source, source_id, fiscal_year)
      VALUES
        (NEW.tenant_id, v_date, v_libelle || ' — TVA collectee', '411', '4441', v_tva, 'factures_tva', NEW.id, v_year);
    END IF;
  END IF;
  RETURN NEW;
END
$fn_fac_issued$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. CORRIGER fn_facture_paid_to_journal (migration 130)
-- ─────────────────────────────────────────────────────────────────────────────
-- Remplace '411000' → '411' explicitement.

CREATE OR REPLACE FUNCTION fn_facture_paid_to_journal()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
AS $fn_fac_paid$
DECLARE
  v_year    INT;
  v_compte  TEXT;
  v_libelle TEXT;
  v_mode    TEXT;
BEGIN
  IF (OLD.statut IS DISTINCT FROM 'payee') AND NEW.statut = 'payee' THEN

    IF EXISTS (
      SELECT 1 FROM journal_entries
      WHERE source     = 'factures_paiement'
        AND source_id  = NEW.id
        AND tenant_id  = NEW.tenant_id
    ) THEN RETURN NEW; END IF;

    v_year    := EXTRACT(YEAR FROM CURRENT_DATE)::INT;
    v_libelle := 'Reglement facture ' || COALESCE(NEW.invoice_number, NEW.id::TEXT);

    SELECT mode_paiement INTO v_mode
    FROM paiements_factures
    WHERE facture_id = NEW.id
    ORDER BY created_at DESC
    LIMIT 1;

    v_compte := fn_ohada_cash_account(COALESCE(v_mode, 'virement'));

    -- Trésorerie (5xx) / Clients (411)
    INSERT INTO journal_entries
      (tenant_id, date_operation, libelle, debit_account, credit_account, montant, source, source_id, fiscal_year)
    VALUES
      (NEW.tenant_id, CURRENT_DATE, v_libelle,
       v_compte, '411', COALESCE(NEW.total, 0),
       'factures_paiement', NEW.id, v_year);

    INSERT INTO transactions
      (tenant_id, type, categorie, description, montant, date,
       mode_paiement, source, source_id, debit_account, credit_account, fiscal_year)
    VALUES
      (NEW.tenant_id, 'entree', 'Facturation', v_libelle, COALESCE(NEW.total, 0), CURRENT_DATE,
       COALESCE(v_mode, 'virement'), 'factures_paiement', NEW.id, v_compte, '411', v_year);
  END IF;
  RETURN NEW;
END
$fn_fac_paid$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. CORRIGER fn_tva_declaration_to_journal (migration 046)
-- ─────────────────────────────────────────────────────────────────────────────
-- Remplace '441000' → '4441', '444000' → '444', '521000' → '521'.
-- SYSCOHADA TVA : Débit 4441 TVA facturée / Crédit 444 TVA à décaisser
--                Débit 444 TVA à décaisser / Crédit 521 Banque (paiement DGI)

CREATE OR REPLACE FUNCTION fn_tva_declaration_to_journal()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
AS $fn_tva$
DECLARE
  v_year    INT;
  v_libelle TEXT;
  v_net     NUMERIC(14,2);
  v_paye    NUMERIC(14,2);
BEGIN
  IF (OLD.statut IS DISTINCT FROM NEW.statut) AND NEW.statut IN ('validee', 'payee') THEN
    IF EXISTS (
      SELECT 1 FROM journal_entries
      WHERE source = 'tva_declaration' AND source_id = NEW.id AND tenant_id = NEW.tenant_id
    ) THEN RETURN NEW; END IF;

    v_year    := NEW.annee::INT;
    v_libelle := 'TVA ' || LPAD(NEW.mois::TEXT, 2, '0') || '/' || NEW.annee::TEXT;
    v_net     := COALESCE(NEW.tva_collectee, 0) - COALESCE(NEW.tva_deductible, 0);

    -- Neutralisation TVA collectée (4441) → TVA à décaisser (444)
    IF v_net > 0 THEN
      INSERT INTO journal_entries
        (tenant_id, date_operation, libelle, debit_account, credit_account, montant, source, source_id, fiscal_year)
      VALUES
        (NEW.tenant_id, CURRENT_DATE, v_libelle || ' — solde TVA',
         '4441', '444', v_net, 'tva_declaration', NEW.id, v_year);
    END IF;

    -- Paiement DGI : TVA à décaisser (444) → Banque (521)
    IF NEW.statut = 'payee' THEN
      v_paye := GREATEST(COALESCE(NEW.total_a_reverser, v_net, 0), 0);
      IF v_paye > 0 THEN
        INSERT INTO journal_entries
          (tenant_id, date_operation, libelle, debit_account, credit_account, montant, source, source_id, fiscal_year)
        VALUES
          (NEW.tenant_id, COALESCE(NEW.date_paiement, CURRENT_DATE),
           v_libelle || ' — paiement DGI',
           '444', '521', v_paye, 'tva_paiement', NEW.id, v_year);

        INSERT INTO transactions
          (tenant_id, type, categorie, description, montant, date, mode_paiement, source, source_id, debit_account, credit_account, fiscal_year)
        VALUES
          (NEW.tenant_id, 'sortie', 'TVA', v_libelle, v_paye,
           COALESCE(NEW.date_paiement, CURRENT_DATE),
           'virement', 'tva_declarations', NEW.id, '444', '521', v_year);
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END
$fn_tva$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 8. CORRIGER fn_mobile_wallet_operation_to_journal (migration 046)
-- ─────────────────────────────────────────────────────────────────────────────
-- '411000' → '411', '661000' → '661', '658000' → '658', '571100' → '5711' (défaut).
-- Le compte_ohada du wallet peut encore être '571100' ou '571200' dans la table.

CREATE OR REPLACE FUNCTION fn_mobile_wallet_operation_to_journal()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
AS $fn_mwo$
DECLARE
  v_compte  TEXT;
  v_year    INT;
  v_debit   TEXT;
  v_credit  TEXT;
  v_libelle TEXT;
BEGIN
  -- Résoudre le compte du wallet en format normalisé (5711/5712)
  SELECT CASE COALESCE(compte_ohada, '5711')
    WHEN '571100' THEN '5711'
    WHEN '571200' THEN '5712'
    ELSE COALESCE(compte_ohada, '5711')
  END
  INTO v_compte
  FROM mobile_money_wallets
  WHERE id = NEW.wallet_id;

  v_year    := EXTRACT(YEAR FROM NEW.date_operation)::INT;
  v_libelle := COALESCE(NEW.libelle, 'Mobile Money ' || NEW.type);

  IF NEW.type = 'entree' THEN
    v_debit  := v_compte; -- Wallet mobile (5711/5712) — reçu
    v_credit := '411';    -- Clients (présumé)
  ELSE
    v_debit  := '658';    -- Charges diverses
    v_credit := v_compte;
  END IF;

  INSERT INTO journal_entries
    (tenant_id, date_operation, libelle, debit_account, credit_account, montant, source, source_id, fiscal_year)
  VALUES
    (NEW.tenant_id, NEW.date_operation, v_libelle, v_debit, v_credit, NEW.montant, 'mobile_wallet', NEW.id, v_year);

  -- Frais opérateur : Charges diverses (658) / Wallet (5711/5712)
  IF COALESCE(NEW.frais, 0) > 0 THEN
    INSERT INTO journal_entries
      (tenant_id, date_operation, libelle, debit_account, credit_account, montant, source, source_id, fiscal_year)
    VALUES
      (NEW.tenant_id, NEW.date_operation, v_libelle || ' — frais',
       '661', v_compte, NEW.frais, 'mobile_wallet_frais', NEW.id, v_year);
  END IF;

  -- Synchroniser solde du wallet
  UPDATE mobile_money_wallets
  SET solde = COALESCE(solde, 0)
    + CASE WHEN NEW.type = 'entree' THEN NEW.montant ELSE -NEW.montant END
    - COALESCE(NEW.frais, 0),
    last_operation_at = NOW()
  WHERE id = NEW.wallet_id;

  RETURN NEW;
END
$fn_mwo$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 9. CORRIGER fn_transfer_to_journal (migration 046)
-- ─────────────────────────────────────────────────────────────────────────────
-- '661000' → '661' pour les frais de transfert.

CREATE OR REPLACE FUNCTION fn_transfer_to_journal()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
AS $fn_transfer$
DECLARE
  v_year    INT;
  v_libelle TEXT;
BEGIN
  IF NEW.statut = 'execute' THEN
    IF EXISTS (
      SELECT 1 FROM journal_entries
      WHERE source = 'transfers' AND source_id = NEW.id AND tenant_id = NEW.tenant_id
    ) THEN RETURN NEW; END IF;

    v_year    := EXTRACT(YEAR FROM NEW.date_transfert)::INT;
    v_libelle := COALESCE(NEW.libelle, 'Transfert ' || NEW.source_type || ' vers ' || NEW.dest_type);

    -- Débit compte destination / Crédit compte source (comptes dynamiques depuis transfers)
    INSERT INTO journal_entries
      (tenant_id, date_operation, libelle, debit_account, credit_account, montant, source, source_id, fiscal_year)
    VALUES
      (NEW.tenant_id, NEW.date_transfert, v_libelle,
       NEW.dest_compte, NEW.source_compte, NEW.montant, 'transfers', NEW.id, v_year);

    -- Frais de transfert : Charges diverses (661) / Compte source
    IF COALESCE(NEW.frais, 0) > 0 THEN
      INSERT INTO journal_entries
        (tenant_id, date_operation, libelle, debit_account, credit_account, montant, source, source_id, fiscal_year)
      VALUES
        (NEW.tenant_id, NEW.date_transfert, v_libelle || ' — frais',
         '661', NEW.source_compte, NEW.frais, 'transfers_frais', NEW.id, v_year);
    END IF;
  END IF;
  RETURN NEW;
END
$fn_transfer$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 10. REQUÊTES DE CONTRÔLE POST-MIGRATION (à exécuter pour valider)
-- ─────────────────────────────────────────────────────────────────────────────
-- Exécuter ces requêtes APRÈS le COMMIT pour valider l'état des données.

-- A) Vérifier qu'il ne reste aucun '441' en compte TVA (doit retourner 0)
-- SELECT COUNT(*) FROM journal_entries WHERE debit_account = '441' OR credit_account = '441';

-- B) Vérifier qu'il ne reste aucun code '571100' ou '571200' (doit retourner 0)
-- SELECT COUNT(*) FROM journal_entries WHERE debit_account IN ('571100','571200') OR credit_account IN ('571100','571200');

-- C) Vérifier l'absence de codes 6 chiffres résiduels
-- SELECT DISTINCT debit_account FROM journal_entries WHERE LENGTH(debit_account) = 6
-- UNION SELECT DISTINCT credit_account FROM journal_entries WHERE LENGTH(credit_account) = 6;

-- D) Compter les '4441' créés (TVA normalisée)
-- SELECT COUNT(*) FROM journal_entries WHERE credit_account = '4441' OR debit_account = '4441';

COMMIT;

-- ═════════════════════════════════════════════════════════════════════════════
-- ⛔ BLOC DE ROLLBACK — NE PAS EXÉCUTER
-- (Uniquement en cas d'incident — restaure les fonctions à leur état pré-137)
-- ═════════════════════════════════════════════════════════════════════════════

/*
BEGIN;

-- Restaurer fn_normalize_journal_account_codes (version migration 119)
CREATE OR REPLACE FUNCTION fn_normalize_journal_account_codes()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  debit_norm  TEXT := NEW.debit_account;
  credit_norm TEXT := NEW.credit_account;
BEGIN
  IF LENGTH(debit_norm) = 6 AND RIGHT(debit_norm, 3) = '000' THEN
    debit_norm := LEFT(debit_norm, 3);
  END IF;
  IF LENGTH(credit_norm) = 6 AND RIGHT(credit_norm, 3) = '000' THEN
    credit_norm := LEFT(credit_norm, 3);
  END IF;
  IF debit_norm IN ('441','443') AND NEW.source = 'facture' THEN debit_norm := '4441'; END IF;
  IF credit_norm IN ('441','443') AND NEW.source = 'facture' THEN credit_norm := '4441'; END IF;
  IF debit_norm = '422' AND NEW.source = 'paie' THEN debit_norm := '421'; END IF;
  IF credit_norm = '422' AND NEW.source = 'paie' THEN credit_norm := '421'; END IF;
  NEW.debit_account  := debit_norm;
  NEW.credit_account := credit_norm;
  RETURN NEW;
END;
$$;

-- Note : le backfill (UPDATE journal_entries) n'est pas réversible sans snapshot.
-- Les fonctions fn_facture_issued_to_journal, fn_tva_declaration_to_journal, etc.
-- peuvent être restaurées manuellement depuis le contenu de migration 046 et 130.

COMMIT;
*/

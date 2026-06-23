-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 130 — Sprint 2A : Créer fn_facture_paid_to_journal + trg_facture_paid
-- ─────────────────────────────────────────────────────────────────────────────
-- Cause : migration 046 partiellement appliquée en production.
--   fn_facture_issued_to_journal  ✅ présente (D2 confirmé)
--   fn_facture_paid_to_journal    ❌ ABSENTE  → sprint 1 a supprimé les inserts
--                                              manuels du PATCH payee en s'appuyant
--                                              sur ce trigger — depuis lors les
--                                              paiements ne créent aucune écriture.
--
-- Différence par rapport à 046 original :
--   046 lit NEW.moyen_paiement (colonne inexistante sur factures).
--   Ici on lit paiements_factures.mode_paiement (source fiable du mode réel).
-- ─────────────────────────────────────────────────────────────────────────────

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

    -- Idempotence : ne pas recréer si déjà présent
    IF EXISTS (
      SELECT 1 FROM journal_entries
      WHERE source     = 'factures_paiement'
        AND source_id  = NEW.id
        AND tenant_id  = NEW.tenant_id
    ) THEN RETURN NEW; END IF;

    v_year    := EXTRACT(YEAR FROM CURRENT_DATE)::INT;
    v_libelle := 'Reglement facture ' || COALESCE(NEW.invoice_number, NEW.id::TEXT);

    -- Mode de paiement depuis paiements_factures (046 lisait NEW.moyen_paiement — absent)
    SELECT mode_paiement INTO v_mode
    FROM paiements_factures
    WHERE facture_id = NEW.id
    ORDER BY created_at DESC
    LIMIT 1;

    v_compte := fn_ohada_cash_account(COALESCE(v_mode, 'virement'));

    -- Apurement client : Trésorerie / Clients
    INSERT INTO journal_entries
      (tenant_id, date_operation, libelle,
       debit_account, credit_account, montant,
       source, source_id, fiscal_year)
    VALUES
      (NEW.tenant_id, CURRENT_DATE, v_libelle,
       v_compte, '411000', COALESCE(NEW.total, 0),
       'factures_paiement', NEW.id, v_year);

    -- Transaction trésorerie réelle
    INSERT INTO transactions
      (tenant_id, type, categorie, description, montant, date,
       mode_paiement, source, source_id,
       debit_account, credit_account, fiscal_year)
    VALUES
      (NEW.tenant_id, 'entree', 'Facturation', v_libelle,
       COALESCE(NEW.total, 0), CURRENT_DATE,
       COALESCE(v_mode, 'virement'), 'factures_paiement', NEW.id,
       v_compte, '411000', v_year);

  END IF;
  RETURN NEW;
END
$fn_fac_paid$;

DROP TRIGGER IF EXISTS trg_facture_paid ON factures;
CREATE TRIGGER trg_facture_paid
  AFTER UPDATE OF statut ON factures
  FOR EACH ROW EXECUTE FUNCTION fn_facture_paid_to_journal();

DO $$
BEGIN
  RAISE NOTICE 'Migration 130 OK — fn_facture_paid_to_journal + trg_facture_paid créés';
END $$;

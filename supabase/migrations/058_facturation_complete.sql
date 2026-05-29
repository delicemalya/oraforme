-- =============================================================================
-- Migration 058 : Système de facturation complet
-- Auteur       : Oraforme ERP
-- Date         : 2026-05-29
-- Description  : Étend les factures, ajoute devis / devis_lignes /
--                paiements_factures, triggers paiement partiel et expiration.
-- Idempotente  : Tout est IF NOT EXISTS / OR REPLACE / DO $$ EXCEPTION $$
-- =============================================================================


-- =============================================================================
-- SECTION 1 — EXTENSION DE LA TABLE factures
-- =============================================================================

-- Nouvelles colonnes (idempotentes via IF NOT EXISTS)
ALTER TABLE factures
  ADD COLUMN IF NOT EXISTS type           TEXT NOT NULL DEFAULT 'facture',
  ADD COLUMN IF NOT EXISTS moyen_paiement TEXT DEFAULT 'virement',
  ADD COLUMN IF NOT EXISTS facture_ref_id UUID REFERENCES factures(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS devis_id       UUID,   -- FK vers devis ajoutée plus bas
  ADD COLUMN IF NOT EXISTS remise_pct     NUMERIC(5,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS montant_paye   NUMERIC(14,2) DEFAULT 0;

-- Contrainte CHECK sur le type (idempotente)
DO $$
BEGIN
  ALTER TABLE factures
    ADD CONSTRAINT factures_type_check
    CHECK (type IN ('facture','proforma','avoir','recurrente'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Mise à jour de la contrainte statut pour intégrer partiellement_payee
ALTER TABLE factures DROP CONSTRAINT IF EXISTS factures_statut_check;
ALTER TABLE factures
  ADD CONSTRAINT factures_statut_check
  CHECK (statut IN (
    'brouillon',
    'envoyee',
    'payee',
    'partiellement_payee',
    'retard',
    'annulee'
  ));


-- =============================================================================
-- SECTION 2 — TABLE devis
-- =============================================================================

CREATE TABLE IF NOT EXISTS devis (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  devis_number   TEXT,
  client_name    TEXT,
  client_nom     TEXT,
  client_address TEXT,
  client_phone   TEXT,
  client_email   TEXT,
  date           DATE        NOT NULL DEFAULT CURRENT_DATE,
  date_validite  DATE,
  subtotal       NUMERIC(14,2) NOT NULL DEFAULT 0,
  montant_ht     NUMERIC(14,2) NOT NULL DEFAULT 0,
  tva            NUMERIC(14,2) NOT NULL DEFAULT 0,
  ca             NUMERIC(14,2) NOT NULL DEFAULT 0,
  total          NUMERIC(14,2) NOT NULL DEFAULT 0,
  notes          TEXT,
  statut         TEXT        NOT NULL DEFAULT 'brouillon',
  facture_id     UUID        REFERENCES factures(id) ON DELETE SET NULL,
  remise_pct     NUMERIC(5,2)  NOT NULL DEFAULT 0,
  created_at     TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

  CONSTRAINT devis_statut_check
    CHECK (statut IN ('brouillon','envoye','accepte','refuse','expire'))
);

-- RLS devis
ALTER TABLE devis ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  CREATE POLICY devis_tenant_select ON devis
    FOR SELECT USING (tenant_id = get_my_tenant_id());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY devis_tenant_insert ON devis
    FOR INSERT WITH CHECK (tenant_id = get_my_tenant_id());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY devis_tenant_update ON devis
    FOR UPDATE USING (tenant_id = get_my_tenant_id())
    WITH CHECK (tenant_id = get_my_tenant_id());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY devis_tenant_delete ON devis
    FOR DELETE USING (tenant_id = get_my_tenant_id());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Index devis
CREATE INDEX IF NOT EXISTS idx_devis_number    ON devis(devis_number);
CREATE INDEX IF NOT EXISTS idx_devis_statut    ON devis(statut, tenant_id);
CREATE INDEX IF NOT EXISTS idx_devis_tenant    ON devis(tenant_id);
CREATE INDEX IF NOT EXISTS idx_devis_validite  ON devis(date_validite) WHERE statut = 'envoye';


-- =============================================================================
-- SECTION 3 — TABLE devis_lignes
-- =============================================================================

CREATE TABLE IF NOT EXISTS devis_lignes (
  id          UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  devis_id    UUID          NOT NULL REFERENCES devis(id) ON DELETE CASCADE,
  description TEXT          NOT NULL,
  price       NUMERIC(14,2) NOT NULL DEFAULT 0,
  quantity    INTEGER       NOT NULL DEFAULT 1,
  total       NUMERIC(14,2) NOT NULL DEFAULT 0
);

-- RLS devis_lignes (accès via devis appartenant au tenant)
ALTER TABLE devis_lignes ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  CREATE POLICY devis_lignes_tenant_select ON devis_lignes
    FOR SELECT USING (
      devis_id IN (
        SELECT id FROM devis WHERE tenant_id = get_my_tenant_id()
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY devis_lignes_tenant_insert ON devis_lignes
    FOR INSERT WITH CHECK (
      devis_id IN (
        SELECT id FROM devis WHERE tenant_id = get_my_tenant_id()
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY devis_lignes_tenant_update ON devis_lignes
    FOR UPDATE USING (
      devis_id IN (
        SELECT id FROM devis WHERE tenant_id = get_my_tenant_id()
      )
    )
    WITH CHECK (
      devis_id IN (
        SELECT id FROM devis WHERE tenant_id = get_my_tenant_id()
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY devis_lignes_tenant_delete ON devis_lignes
    FOR DELETE USING (
      devis_id IN (
        SELECT id FROM devis WHERE tenant_id = get_my_tenant_id()
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Index devis_lignes
CREATE INDEX IF NOT EXISTS idx_devis_lignes_devis ON devis_lignes(devis_id);


-- =============================================================================
-- SECTION 4 — CONTRAINTE FK factures.devis_id → devis(id)
--   NOT VALID pour éviter le scan complet des lignes existantes
-- =============================================================================

DO $$
BEGIN
  ALTER TABLE factures
    ADD CONSTRAINT fk_factures_devis
    FOREIGN KEY (devis_id) REFERENCES devis(id) ON DELETE SET NULL
    NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;


-- =============================================================================
-- SECTION 5 — TABLE paiements_factures (paiements partiels)
-- =============================================================================

CREATE TABLE IF NOT EXISTS paiements_factures (
  id             UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      UUID          NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  facture_id     UUID          NOT NULL REFERENCES factures(id) ON DELETE CASCADE,
  montant        NUMERIC(14,2) NOT NULL CHECK (montant > 0),
  mode_paiement  TEXT          NOT NULL DEFAULT 'especes',
  date           DATE          NOT NULL DEFAULT CURRENT_DATE,
  reference      TEXT,
  notes          TEXT,
  created_at     TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

  CONSTRAINT paiements_mode_check
    CHECK (mode_paiement IN (
      'especes','banque','mobile_money','carte','virement','cheque'
    ))
);

-- RLS paiements_factures
ALTER TABLE paiements_factures ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  CREATE POLICY paiements_tenant_select ON paiements_factures
    FOR SELECT USING (tenant_id = get_my_tenant_id());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY paiements_tenant_insert ON paiements_factures
    FOR INSERT WITH CHECK (tenant_id = get_my_tenant_id());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY paiements_tenant_update ON paiements_factures
    FOR UPDATE USING (tenant_id = get_my_tenant_id())
    WITH CHECK (tenant_id = get_my_tenant_id());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY paiements_tenant_delete ON paiements_factures
    FOR DELETE USING (tenant_id = get_my_tenant_id());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Index paiements_factures
CREATE INDEX IF NOT EXISTS idx_paiements_facture ON paiements_factures(facture_id);
CREATE INDEX IF NOT EXISTS idx_paiements_tenant  ON paiements_factures(tenant_id);


-- =============================================================================
-- SECTION 6 — INDEX SUPPLÉMENTAIRES SUR factures
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_factures_type     ON factures(type);
CREATE INDEX IF NOT EXISTS idx_factures_devis_id ON factures(devis_id);


-- =============================================================================
-- SECTION 7 — TRIGGER : mise à jour automatique facture après paiement
--
--   Après chaque INSERT dans paiements_factures :
--     1. Recalcule montant_paye (somme de tous les paiements)
--     2. Détermine le nouveau statut (payee / partiellement_payee / envoyee)
--     3. Enregistre une transaction comptable (entree ou acompte)
-- =============================================================================

CREATE OR REPLACE FUNCTION fn_update_facture_apres_paiement()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total_paye    NUMERIC(14,2);
  v_facture_total NUMERIC(14,2);
  v_new_statut    TEXT;
BEGIN
  -- 1. Somme de tous les paiements pour cette facture
  SELECT COALESCE(SUM(montant), 0)
    INTO v_total_paye
    FROM paiements_factures
   WHERE facture_id = NEW.facture_id;

  -- 2. Montant total de la facture
  SELECT COALESCE(total, 0)
    INTO v_facture_total
    FROM factures
   WHERE id = NEW.facture_id;

  -- 3. Détermination du statut
  IF v_total_paye >= v_facture_total THEN
    v_new_statut := 'payee';
  ELSIF v_total_paye > 0 THEN
    v_new_statut := 'partiellement_payee';
  ELSE
    v_new_statut := 'envoyee';
  END IF;

  -- 4. Mise à jour de la facture
  UPDATE factures
     SET montant_paye    = v_total_paye,
         statut          = v_new_statut,
         moyen_paiement  = NEW.mode_paiement
   WHERE id = NEW.facture_id;

  -- 5. Écriture comptable selon le statut
  IF v_new_statut = 'payee' THEN
    -- Paiement intégral : une transaction de type entree
    INSERT INTO transactions (
      tenant_id, type, categorie, description,
      montant, date, mode_paiement, source, source_id
    )
    SELECT
      NEW.tenant_id,
      'entree',
      'Paiement facture',
      'Paiement '
        || COALESCE(f.invoice_number, f.id::TEXT)
        || ' — '
        || COALESCE(f.client_name, f.client_nom, ''),
      NEW.montant,
      NEW.date,
      NEW.mode_paiement,
      'paiement_facture',
      NEW.facture_id
    FROM factures f
    WHERE f.id = NEW.facture_id
    ON CONFLICT DO NOTHING;

  ELSIF v_new_statut = 'partiellement_payee' THEN
    -- Acompte : transaction liée à l'id du paiement (source_id = NEW.id)
    INSERT INTO transactions (
      tenant_id, type, categorie, description,
      montant, date, mode_paiement, source, source_id
    )
    SELECT
      NEW.tenant_id,
      'entree',
      'Acompte facture',
      'Acompte '
        || COALESCE(f.invoice_number, f.id::TEXT)
        || ' — '
        || COALESCE(f.client_name, f.client_nom, ''),
      NEW.montant,
      NEW.date,
      NEW.mode_paiement,
      'acompte_facture',
      NEW.id
    FROM factures f
    WHERE f.id = NEW.facture_id;
  END IF;

  RETURN NEW;
END;
$$;

-- Recréation propre du trigger (DROP IF EXISTS + CREATE)
DROP TRIGGER IF EXISTS trg_paiement_facture ON paiements_factures;
CREATE TRIGGER trg_paiement_facture
  AFTER INSERT ON paiements_factures
  FOR EACH ROW
  EXECUTE FUNCTION fn_update_facture_apres_paiement();


-- =============================================================================
-- SECTION 8 — FONCTION : expiration manuelle des devis périmés
--
--   Appelée explicitement (pas de cron) pour un tenant donné.
--   Retourne le nombre de devis mis à jour.
--   Usage : SELECT fn_expire_devis_obsoletes('<tenant_uuid>');
-- =============================================================================

CREATE OR REPLACE FUNCTION fn_expire_devis_obsoletes(p_tenant_id UUID)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INT;
BEGIN
  UPDATE devis
     SET statut = 'expire'
   WHERE tenant_id    = p_tenant_id
     AND statut       = 'envoye'
     AND date_validite < CURRENT_DATE;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;


-- =============================================================================
-- FIN DE LA MIGRATION 058
-- =============================================================================
-- Pour exécuter cette migration dans Supabase :
--   1. Ouvrir le SQL Editor dans le dashboard Supabase
--   2. Coller ce fichier en entier et cliquer Run
--   (ou via CLI : supabase db push)
-- =============================================================================

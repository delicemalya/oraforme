-- ============================================================================
-- Migration 090 — NIU : Renommage colonne nif → niu dans toutes les tables
-- République du Congo : le NIU (Numéro d'Identification Unique) remplace le NIF
-- ============================================================================

-- 1. Table tenants (créée en migration 001)
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tenants' AND column_name = 'nif'
  ) THEN
    ALTER TABLE tenants RENAME COLUMN nif TO niu;
  END IF;
END $$;

-- 2. Table comptes_tiers (créée en migration 031)
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'comptes_tiers' AND column_name = 'nif'
  ) THEN
    ALTER TABLE comptes_tiers RENAME COLUMN nif TO niu;
  END IF;
END $$;

-- 3. Table tiers (créée en migration 045)
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tiers' AND column_name = 'nif'
  ) THEN
    ALTER TABLE tiers RENAME COLUMN nif TO niu;
    COMMENT ON COLUMN tiers.niu IS 'Numéro d''Identification Unique Congo (NIU)';
  END IF;
END $$;

-- 4. Table clients (colonne ajoutée en migration 078)
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'clients' AND column_name = 'nif'
  ) THEN
    ALTER TABLE clients RENAME COLUMN nif TO niu;
  END IF;
END $$;

-- 5. Table entreprise_config (colonne ajoutée après migration 010)
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'entreprise_config' AND column_name = 'nif'
  ) THEN
    ALTER TABLE entreprise_config RENAME COLUMN nif TO niu;
  END IF;
END $$;

-- 6. Table das_beneficiaires
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'das_beneficiaires' AND column_name = 'nif'
  ) THEN
    ALTER TABLE das_beneficiaires RENAME COLUMN nif TO niu;
  END IF;
END $$;

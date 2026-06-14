-- ============================================================
-- 096 — Profil Completion System
-- Colonnes pour le profil différé et la finalisation entreprise
-- ============================================================

-- Completion tracking
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS profil_complet      BOOLEAN    NOT NULL DEFAULT false;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS company_deadline    TIMESTAMPTZ;

-- Extra company info (deferred — renseignées après inscription)
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS ville               TEXT;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS email_contact       TEXT;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS site_web            TEXT;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS rccm                TEXT;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS numero_fiscal       TEXT;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS mobile_money        TEXT;

-- Dirigeant / représentant légal
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS dirigeant_nom       TEXT;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS dirigeant_fonction  TEXT;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS dirigeant_telephone TEXT;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS dirigeant_email     TEXT;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS dirigeant_photo_url TEXT;

-- Réseaux sociaux (JSON: { facebook, linkedin, twitter, instagram })
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS reseaux_sociaux     JSONB NOT NULL DEFAULT '{}';

-- Documents légaux (JSON array: [{ type, url, nom, uploaded_at }])
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS documents_legaux    JSONB NOT NULL DEFAULT '[]';

-- Set company_deadline for tenants already created (72h from created_at)
UPDATE tenants
SET company_deadline = created_at + INTERVAL '72 hours'
WHERE company_deadline IS NULL;

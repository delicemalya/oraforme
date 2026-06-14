-- ============================================================
-- 099 — Cabinet : honoraires factures + conformité clients
-- ============================================================

-- ── 1. Factures d'honoraires du cabinet ──────────────────────────────────────

CREATE TABLE IF NOT EXISTS cabinet_honoraires_factures (
  id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  cabinet_tenant_id  UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  client_id          UUID REFERENCES cabinet_clients(id) ON DELETE SET NULL,
  client_nom         TEXT NOT NULL,
  numero             TEXT NOT NULL,
  mois               INT,                      -- 1-12
  annee              INT NOT NULL DEFAULT date_part('year', NOW()),
  montant_ht         NUMERIC(12,2) NOT NULL DEFAULT 0,
  taux_tva           NUMERIC(5,2) NOT NULL DEFAULT 18,
  montant_tva        NUMERIC(12,2) NOT NULL DEFAULT 0,
  montant_ttc        NUMERIC(12,2) NOT NULL DEFAULT 0,
  statut             TEXT NOT NULL DEFAULT 'brouillon'
                       CHECK (statut IN ('brouillon','envoyee','payee','retard','annulee')),
  date_emission      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  date_echeance      DATE,
  date_paiement      DATE,
  notes              TEXT,
  types_mission      TEXT[] NOT NULL DEFAULT '{}',
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cabinet_hon_tenant ON cabinet_honoraires_factures (cabinet_tenant_id);
CREATE INDEX IF NOT EXISTS idx_cabinet_hon_client ON cabinet_honoraires_factures (client_id);
CREATE INDEX IF NOT EXISTS idx_cabinet_hon_statut ON cabinet_honoraires_factures (cabinet_tenant_id, statut);

ALTER TABLE cabinet_honoraires_factures ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cabinet_honoraires_own" ON cabinet_honoraires_factures
  FOR ALL USING (
    cabinet_tenant_id IN (
      SELECT tenant_id FROM profiles WHERE user_id = auth.uid()
    )
  );

-- Trigger updated_at
CREATE OR REPLACE FUNCTION set_updated_at_cabinet_hon()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_cabinet_hon_upd ON cabinet_honoraires_factures;
CREATE TRIGGER trg_cabinet_hon_upd
  BEFORE UPDATE ON cabinet_honoraires_factures
  FOR EACH ROW EXECUTE FUNCTION set_updated_at_cabinet_hon();

-- ── 2. Conformité clients (checklist OHADA/Congo) ────────────────────────────

CREATE TABLE IF NOT EXISTS cabinet_conformite (
  id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  cabinet_tenant_id  UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  client_id          UUID NOT NULL REFERENCES cabinet_clients(id) ON DELETE CASCADE,
  checks             JSONB NOT NULL DEFAULT '{}',   -- { "grand_livre": true, "tva_mensuelle": false, ... }
  score              INT NOT NULL DEFAULT 0,         -- 0-100%
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (cabinet_tenant_id, client_id)
);

CREATE INDEX IF NOT EXISTS idx_cabinet_conf_tenant ON cabinet_conformite (cabinet_tenant_id);

ALTER TABLE cabinet_conformite ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cabinet_conformite_own" ON cabinet_conformite
  FOR ALL USING (
    cabinet_tenant_id IN (
      SELECT tenant_id FROM profiles WHERE user_id = auth.uid()
    )
  );

-- Trigger score auto depuis checks
CREATE OR REPLACE FUNCTION compute_conformite_score()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  total_checks INT := 21;  -- nombre de checks dans la checklist front
  done_checks  INT;
BEGIN
  SELECT COUNT(*) INTO done_checks
  FROM jsonb_each_text(NEW.checks)
  WHERE value = 'true';
  NEW.score      := ROUND((done_checks::NUMERIC / total_checks) * 100);
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_cabinet_conf_score ON cabinet_conformite;
CREATE TRIGGER trg_cabinet_conf_score
  BEFORE INSERT OR UPDATE ON cabinet_conformite
  FOR EACH ROW EXECUTE FUNCTION compute_conformite_score();

-- ============================================================
-- SQL à exécuter dans Supabase SQL Editor
-- Migrations 097, 098, 099 dans l'ordre
-- ============================================================

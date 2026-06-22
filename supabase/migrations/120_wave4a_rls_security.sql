-- ============================================================
-- Migration 120 — Wave 4A : Sécurité RLS multi-tenant
-- Sprint correctif : candidatures + cabinet_affaires/audiences
-- ============================================================

-- ── 1. RLS sur la table candidatures (existe, policies manquantes) ────────────

ALTER TABLE candidatures ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "candidatures: tenant" ON candidatures;
CREATE POLICY "candidatures: tenant" ON candidatures FOR ALL
  USING     (tenant_id = get_my_tenant_id())
  WITH CHECK (tenant_id = get_my_tenant_id());

-- ── 2. Normalisation cabinet_affaires / cabinet_audiences ─────────────────────
-- Si les tables existent déjà avec tenant_id (créées manuellement),
-- on renomme la colonne pour suivre la convention cabinet (cabinet_tenant_id).

DO $$
BEGIN
  -- cabinet_affaires : tenant_id → cabinet_tenant_id
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'cabinet_affaires'
      AND column_name  = 'tenant_id'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'cabinet_affaires'
      AND column_name  = 'cabinet_tenant_id'
  ) THEN
    ALTER TABLE cabinet_affaires RENAME COLUMN tenant_id TO cabinet_tenant_id;
    RAISE NOTICE 'cabinet_affaires: tenant_id renommé en cabinet_tenant_id';
  END IF;

  -- cabinet_audiences : tenant_id → cabinet_tenant_id
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'cabinet_audiences'
      AND column_name  = 'tenant_id'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'cabinet_audiences'
      AND column_name  = 'cabinet_tenant_id'
  ) THEN
    ALTER TABLE cabinet_audiences RENAME COLUMN tenant_id TO cabinet_tenant_id;
    RAISE NOTICE 'cabinet_audiences: tenant_id renommé en cabinet_tenant_id';
  END IF;
END $$;

-- ── 3. TABLE cabinet_affaires (créée si absente) ──────────────────────────────

CREATE TABLE IF NOT EXISTS cabinet_affaires (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  cabinet_tenant_id     UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  reference             TEXT        NOT NULL,
  intitule              TEXT        NOT NULL,
  type_affaire          TEXT        NOT NULL DEFAULT 'civil'
    CHECK (type_affaire IN (
      'civil','penal','commercial','social','administratif',
      'foncier','famille','conseil'
    )),
  client_nom            TEXT        NOT NULL,
  client_id             UUID        NULL,
  partie_adverse        TEXT        NULL,
  juridiction           TEXT        NULL,
  numero_dossier        TEXT        NULL,
  date_ouverture        DATE        NOT NULL DEFAULT CURRENT_DATE,
  date_audience         DATE        NULL,
  statut                TEXT        NOT NULL DEFAULT 'ouvert'
    CHECK (statut IN (
      'ouvert','instruction','audience_programmee','delibere',
      'gagne','perdu','transaction','classe_sans_suite','archive'
    )),
  priorite              TEXT        NOT NULL DEFAULT 'normale'
    CHECK (priorite IN ('urgent','haute','normale','basse')),
  honoraires_provision  NUMERIC(14,2) NOT NULL DEFAULT 0,
  honoraires_facture    NUMERIC(14,2) NOT NULL DEFAULT 0,
  description           TEXT        NULL,
  notes                 TEXT        NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE cabinet_affaires ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cabinet_affaires: tenant" ON cabinet_affaires;
CREATE POLICY "cabinet_affaires: tenant" ON cabinet_affaires FOR ALL
  USING     (cabinet_tenant_id = get_my_tenant_id())
  WITH CHECK (cabinet_tenant_id = get_my_tenant_id());

CREATE INDEX IF NOT EXISTS cabinet_affaires_tenant_idx ON cabinet_affaires(cabinet_tenant_id);
CREATE INDEX IF NOT EXISTS cabinet_affaires_statut_idx ON cabinet_affaires(cabinet_tenant_id, statut);

-- ── 4. TABLE cabinet_audiences (créée si absente) ────────────────────────────

CREATE TABLE IF NOT EXISTS cabinet_audiences (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  cabinet_tenant_id UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  affaire_id        UUID        NULL REFERENCES cabinet_affaires(id) ON DELETE CASCADE,
  affaire_ref       TEXT        NOT NULL DEFAULT '',
  affaire_intitule  TEXT        NOT NULL DEFAULT '',
  date_audience     DATE        NOT NULL,
  heure             TEXT        NULL,
  juridiction       TEXT        NOT NULL DEFAULT '',
  type_audience     TEXT        NOT NULL DEFAULT 'fond',
  statut            TEXT        NOT NULL DEFAULT 'programme',
  notes             TEXT        NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE cabinet_audiences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cabinet_audiences: tenant" ON cabinet_audiences;
CREATE POLICY "cabinet_audiences: tenant" ON cabinet_audiences FOR ALL
  USING     (cabinet_tenant_id = get_my_tenant_id())
  WITH CHECK (cabinet_tenant_id = get_my_tenant_id());

CREATE INDEX IF NOT EXISTS cabinet_audiences_tenant_idx  ON cabinet_audiences(cabinet_tenant_id);
CREATE INDEX IF NOT EXISTS cabinet_audiences_affaire_idx ON cabinet_audiences(affaire_id);
CREATE INDEX IF NOT EXISTS cabinet_audiences_date_idx    ON cabinet_audiences(cabinet_tenant_id, date_audience);

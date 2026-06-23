-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 126 — Sprint 1 : Création table wallets (BC-04)
-- ─────────────────────────────────────────────────────────────────────────────
-- Problème : 9 pages trésorerie font from('wallets') mais seule la table
-- mobile_money_wallets existe (migration 044, colonnes différentes).
-- Résultat : soldes mobile money absents du dashboard, erreurs silencieuses.
--
-- mobile_money_wallets reste pour les triggers enterprise (046).
-- wallets est la table UI de gestion des comptes mobile money.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS wallets (
  id          UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID          NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  operateur   TEXT          NOT NULL DEFAULT 'autre',
  intitule    TEXT          NOT NULL,
  numero      TEXT,
  solde       NUMERIC(14,2) NOT NULL DEFAULT 0,
  actif       BOOLEAN       NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

ALTER TABLE wallets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "wallets: tenant_isolation"
  ON wallets FOR ALL
  USING     (tenant_id = get_my_tenant_id())
  WITH CHECK (tenant_id = get_my_tenant_id());

CREATE INDEX IF NOT EXISTS idx_wallets_tenant ON wallets(tenant_id);
CREATE INDEX IF NOT EXISTS idx_wallets_actif  ON wallets(tenant_id, actif);

DO $$
BEGIN
  RAISE NOTICE 'Migration 126 OK — table wallets créée avec RLS tenant_isolation';
END $$;

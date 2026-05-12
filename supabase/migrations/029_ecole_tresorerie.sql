-- ============================================================
-- 029 — Trésorerie École : Wallets, Chèques, Virements
-- ============================================================

-- ── 1. Wallets (Mobile Money + Banque) ───────────────────────

CREATE TABLE IF NOT EXISTS ecole_wallets (
  id         UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id  UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  type       TEXT        NOT NULL CHECK (type IN ('mobile_money', 'banque')),
  provider   TEXT        NOT NULL,  -- 'mtn','airtel','moov','orange','custom'
  nom        TEXT        NOT NULL,
  numero     TEXT,
  solde      NUMERIC(15,2) NOT NULL DEFAULT 0,
  actif      BOOLEAN     NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE ecole_wallets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ecole_wallets: all" ON ecole_wallets;
CREATE POLICY "ecole_wallets: all" ON ecole_wallets
  FOR ALL USING (tenant_id = get_my_tenant_id())
  WITH CHECK (tenant_id = get_my_tenant_id());

-- ── 2. Mouvements de wallet (historique) ─────────────────────

CREATE TABLE IF NOT EXISTS ecole_wallet_movements (
  id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id   UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  wallet_id   UUID        NOT NULL REFERENCES ecole_wallets(id) ON DELETE CASCADE,
  type        TEXT        NOT NULL CHECK (type IN ('entree', 'sortie', 'transfert')),
  montant     NUMERIC(15,2) NOT NULL CHECK (montant > 0),
  libelle     TEXT        NOT NULL,
  reference   TEXT,
  solde_apres NUMERIC(15,2),
  source      TEXT,       -- 'cheque','virement','especes','paiement_scolaire','autre'
  source_id   UUID,       -- id de la source (cheque ou virement)
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE ecole_wallet_movements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ecole_wallet_movements: all" ON ecole_wallet_movements;
CREATE POLICY "ecole_wallet_movements: all" ON ecole_wallet_movements
  FOR ALL USING (tenant_id = get_my_tenant_id())
  WITH CHECK (tenant_id = get_my_tenant_id());

-- ── 3. Chèques reçus ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS ecole_cheques (
  id                UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id         UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  numero_cheque     TEXT        NOT NULL,
  banque            TEXT        NOT NULL,
  montant           NUMERIC(15,2) NOT NULL CHECK (montant > 0),
  date_emission     DATE        NOT NULL,
  date_encaissement DATE,
  libelle           TEXT,
  etudiant_id       UUID        REFERENCES etudiants(id) ON DELETE SET NULL,
  wallet_id         UUID        REFERENCES ecole_wallets(id) ON DELETE SET NULL,
  statut            TEXT        NOT NULL DEFAULT 'recu'
                    CHECK (statut IN ('recu', 'encaisse', 'rejete', 'annule')),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE ecole_cheques ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ecole_cheques: all" ON ecole_cheques;
CREATE POLICY "ecole_cheques: all" ON ecole_cheques
  FOR ALL USING (tenant_id = get_my_tenant_id())
  WITH CHECK (tenant_id = get_my_tenant_id());

-- ── 4. Virements reçus ───────────────────────────────────────

CREATE TABLE IF NOT EXISTS ecole_virements (
  id                  UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id           UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  reference           TEXT        NOT NULL,
  banque              TEXT        NOT NULL,
  montant             NUMERIC(15,2) NOT NULL CHECK (montant > 0),
  date_valeur         DATE        NOT NULL,
  libelle             TEXT,
  etudiant_id         UUID        REFERENCES etudiants(id) ON DELETE SET NULL,
  compte_destination  TEXT,
  wallet_id           UUID        REFERENCES ecole_wallets(id) ON DELETE SET NULL,
  statut              TEXT        NOT NULL DEFAULT 'recu'
                      CHECK (statut IN ('recu', 'valide', 'rejete')),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE ecole_virements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ecole_virements: all" ON ecole_virements;
CREATE POLICY "ecole_virements: all" ON ecole_virements
  FOR ALL USING (tenant_id = get_my_tenant_id())
  WITH CHECK (tenant_id = get_my_tenant_id());

-- ── 5. Trigger : mise à jour du solde wallet après mouvement ─

CREATE OR REPLACE FUNCTION fn_update_wallet_solde()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.type = 'entree' THEN
    UPDATE ecole_wallets
    SET solde = solde + NEW.montant
    WHERE id = NEW.wallet_id;
  ELSIF NEW.type IN ('sortie', 'transfert') THEN
    UPDATE ecole_wallets
    SET solde = solde - NEW.montant
    WHERE id = NEW.wallet_id;
  END IF;

  -- Stocker le solde après opération
  SELECT solde INTO NEW.solde_apres
  FROM ecole_wallets WHERE id = NEW.wallet_id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_wallet_solde ON ecole_wallet_movements;
CREATE TRIGGER trg_wallet_solde
  BEFORE INSERT ON ecole_wallet_movements
  FOR EACH ROW EXECUTE FUNCTION fn_update_wallet_solde();

-- ── 6. Indexes performances ───────────────────────────────────

CREATE INDEX IF NOT EXISTS ecole_wallets_tenant_idx          ON ecole_wallets          (tenant_id);
CREATE INDEX IF NOT EXISTS ecole_wallet_movements_wallet_idx ON ecole_wallet_movements (wallet_id);
CREATE INDEX IF NOT EXISTS ecole_wallet_movements_tenant_idx ON ecole_wallet_movements (tenant_id);
CREATE INDEX IF NOT EXISTS ecole_cheques_tenant_idx          ON ecole_cheques          (tenant_id);
CREATE INDEX IF NOT EXISTS ecole_cheques_statut_idx          ON ecole_cheques          (statut);
CREATE INDEX IF NOT EXISTS ecole_virements_tenant_idx        ON ecole_virements        (tenant_id);
CREATE INDEX IF NOT EXISTS ecole_virements_statut_idx        ON ecole_virements        (statut);

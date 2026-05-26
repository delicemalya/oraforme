-- ============================================================
-- Migration 052 — Tables Hôtellerie (hotel_chambres, hotel_reservations)
-- Multi-tenant avec RLS strict
-- ============================================================

-- ── Table hotel_chambres ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS hotel_chambres (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  numero          TEXT NOT NULL,
  type            TEXT NOT NULL DEFAULT 'standard'
                    CHECK (type IN ('standard','superieure','suite','deluxe','familiale','presidentielle')),
  capacite        INT NOT NULL DEFAULT 2 CHECK (capacite > 0),
  prix_nuit       NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (prix_nuit >= 0),
  etage           INT NOT NULL DEFAULT 0,
  superficie      NUMERIC(6,1),
  statut          TEXT NOT NULL DEFAULT 'disponible'
                    CHECK (statut IN ('disponible','occupee','reservee','maintenance','hors_service')),
  equipements     TEXT[] DEFAULT ARRAY[]::TEXT[],
  description     TEXT,
  image_url       TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (tenant_id, numero)
);

-- Index
CREATE INDEX IF NOT EXISTS idx_hotel_chambres_tenant  ON hotel_chambres(tenant_id);
CREATE INDEX IF NOT EXISTS idx_hotel_chambres_statut  ON hotel_chambres(tenant_id, statut);
CREATE INDEX IF NOT EXISTS idx_hotel_chambres_type    ON hotel_chambres(tenant_id, type);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_hotel_chambres_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_hotel_chambres_updated_at ON hotel_chambres;
CREATE TRIGGER trg_hotel_chambres_updated_at
  BEFORE UPDATE ON hotel_chambres
  FOR EACH ROW EXECUTE FUNCTION update_hotel_chambres_updated_at();

-- RLS
ALTER TABLE hotel_chambres ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS hotel_chambres_tenant_isolation ON hotel_chambres;
CREATE POLICY hotel_chambres_tenant_isolation ON hotel_chambres
  USING (tenant_id = get_my_tenant_id())
  WITH CHECK (tenant_id = get_my_tenant_id());


-- ── Table hotel_reservations ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS hotel_reservations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  numero          TEXT NOT NULL,
  chambre_id      UUID NOT NULL REFERENCES hotel_chambres(id) ON DELETE RESTRICT,
  client_nom      TEXT NOT NULL,
  client_email    TEXT,
  client_telephone TEXT,
  client_id       UUID,   -- optionnel : lien vers clients CRM

  date_arrivee    DATE NOT NULL,
  date_depart     DATE NOT NULL,
  nb_nuits        INT GENERATED ALWAYS AS (date_depart - date_arrivee) STORED,
  nb_personnes    INT NOT NULL DEFAULT 1 CHECK (nb_personnes > 0),

  prix_nuit       NUMERIC(12,2) NOT NULL CHECK (prix_nuit >= 0),
  montant_total   NUMERIC(12,2) NOT NULL CHECK (montant_total >= 0),
  remise_pct      NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK (remise_pct BETWEEN 0 AND 100),
  montant_paye    NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (montant_paye >= 0),

  statut          TEXT NOT NULL DEFAULT 'confirmee'
                    CHECK (statut IN ('en_attente','confirmee','arrivee','depart','annulee','no_show')),
  mode_paiement   TEXT DEFAULT 'especes'
                    CHECK (mode_paiement IN ('especes','carte','mobile_money','virement','cheque')),

  notes           TEXT,
  source          TEXT DEFAULT 'direct'
                    CHECK (source IN ('direct','booking','expedia','airbnb','agence','autre')),

  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  CHECK (date_depart > date_arrivee)
);

-- Numéro auto
CREATE SEQUENCE IF NOT EXISTS hotel_reservation_seq START 1001;

-- Index
CREATE INDEX IF NOT EXISTS idx_hotel_resa_tenant       ON hotel_reservations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_hotel_resa_chambre       ON hotel_reservations(chambre_id);
CREATE INDEX IF NOT EXISTS idx_hotel_resa_statut        ON hotel_reservations(tenant_id, statut);
CREATE INDEX IF NOT EXISTS idx_hotel_resa_dates         ON hotel_reservations(tenant_id, date_arrivee, date_depart);
CREATE INDEX IF NOT EXISTS idx_hotel_resa_client        ON hotel_reservations(tenant_id, client_nom);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_hotel_reservations_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_hotel_reservations_updated_at ON hotel_reservations;
CREATE TRIGGER trg_hotel_reservations_updated_at
  BEFORE UPDATE ON hotel_reservations
  FOR EACH ROW EXECUTE FUNCTION update_hotel_reservations_updated_at();

-- RLS
ALTER TABLE hotel_reservations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS hotel_reservations_tenant_isolation ON hotel_reservations;
CREATE POLICY hotel_reservations_tenant_isolation ON hotel_reservations
  USING (tenant_id = get_my_tenant_id())
  WITH CHECK (tenant_id = get_my_tenant_id());


-- ── Trigger : sync statut chambre sur check-in / check-out ───────────────────

CREATE OR REPLACE FUNCTION sync_chambre_statut_on_reservation()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  -- Check-in : chambre → occupee
  IF NEW.statut = 'arrivee' AND OLD.statut != 'arrivee' THEN
    UPDATE hotel_chambres SET statut = 'occupee', updated_at = now()
    WHERE id = NEW.chambre_id AND tenant_id = NEW.tenant_id;
  END IF;

  -- Check-out ou annulation : chambre → disponible
  IF NEW.statut IN ('depart', 'annulee', 'no_show') AND OLD.statut NOT IN ('depart', 'annulee', 'no_show') THEN
    UPDATE hotel_chambres SET statut = 'disponible', updated_at = now()
    WHERE id = NEW.chambre_id AND tenant_id = NEW.tenant_id;
  END IF;

  -- Confirmée sans arrivée : chambre → reservee
  IF NEW.statut = 'confirmee' AND OLD.statut = 'en_attente' THEN
    UPDATE hotel_chambres SET statut = 'reservee', updated_at = now()
    WHERE id = NEW.chambre_id AND tenant_id = NEW.tenant_id
      AND statut = 'disponible';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_chambre_statut ON hotel_reservations;
CREATE TRIGGER trg_sync_chambre_statut
  AFTER UPDATE ON hotel_reservations
  FOR EACH ROW EXECUTE FUNCTION sync_chambre_statut_on_reservation();


-- ── Vue : taux d'occupation par mois ─────────────────────────────────────────

CREATE OR REPLACE VIEW v_hotel_occupation AS
SELECT
  r.tenant_id,
  DATE_TRUNC('month', r.date_arrivee) AS mois,
  COUNT(DISTINCT r.id)                AS nb_reservations,
  COUNT(DISTINCT r.chambre_id)        AS nb_chambres_occupees,
  SUM(r.montant_total)                AS revenu_total,
  AVG(r.nb_nuits)                     AS duree_moyenne_nuits
FROM hotel_reservations r
WHERE r.statut NOT IN ('annulee', 'no_show')
GROUP BY r.tenant_id, DATE_TRUNC('month', r.date_arrivee);


-- ── Données de test (commentées - décommenter si besoin) ─────────────────────
/*
-- Exemple de chambres (remplacer <TENANT_ID> par le vrai UUID)
INSERT INTO hotel_chambres (tenant_id, numero, type, capacite, prix_nuit, etage, statut) VALUES
  ('<TENANT_ID>', '101', 'standard',   2, 45000,  1, 'disponible'),
  ('<TENANT_ID>', '102', 'standard',   2, 45000,  1, 'disponible'),
  ('<TENANT_ID>', '201', 'superieure', 2, 65000,  2, 'disponible'),
  ('<TENANT_ID>', '301', 'suite',      4, 120000, 3, 'disponible'),
  ('<TENANT_ID>', '401', 'presidentielle', 6, 250000, 4, 'disponible');
*/

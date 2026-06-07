-- ═══════════════════════════════════════════════════════════════════════════
-- MIGRATION 078 — CRM ENTERPRISE + RECOUVREMENT
-- Flux complet : Prospect → Client → Opportunité → Devis → Facture →
--                Paiement → Trésorerie → Comptabilité → Fiscalité
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. Enrichir la table clients ─────────────────────────────────────────────
ALTER TABLE clients ADD COLUMN IF NOT EXISTS secteur        TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS ville          TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS pays           TEXT DEFAULT 'Congo-Brazzaville';
ALTER TABLE clients ADD COLUMN IF NOT EXISTS nif            TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS rccm           TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS notes          TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS score_risque   INTEGER DEFAULT 50 CHECK (score_risque BETWEEN 0 AND 100);
ALTER TABLE clients ADD COLUMN IF NOT EXISTS ca_total       NUMERIC(15,2) DEFAULT 0;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS impaye_total   NUMERIC(15,2) DEFAULT 0;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS nb_factures    INTEGER DEFAULT 0;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS nb_impayes     INTEGER DEFAULT 0;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS delai_moyen_paiement INTEGER DEFAULT 0;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS derniere_transaction DATE;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS commercial_id  UUID REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS tags           TEXT[];
ALTER TABLE clients ADD COLUMN IF NOT EXISTS statut         TEXT DEFAULT 'actif' CHECK (statut IN ('actif','prospect','inactif','bloque'));

-- ── 2. Ajouter client_id FK sur factures et devis ───────────────────────────
ALTER TABLE factures ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES clients(id) ON DELETE SET NULL;
ALTER TABLE devis    ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES clients(id) ON DELETE SET NULL;

-- ── 3. Opportunités CRM ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS crm_opportunites (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id            UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  client_id            UUID REFERENCES clients(id) ON DELETE SET NULL,
  titre                TEXT NOT NULL,
  description          TEXT,
  montant_estime       NUMERIC(15,2) DEFAULT 0,
  probabilite          INTEGER DEFAULT 20 CHECK (probabilite BETWEEN 0 AND 100),
  etape                TEXT NOT NULL DEFAULT 'prospection'
                         CHECK (etape IN ('prospection','qualification','proposition','negociation','gagne','perdu')),
  date_cloture_prevue  DATE,
  commercial_id        UUID REFERENCES profiles(id) ON DELETE SET NULL,
  devis_id             UUID REFERENCES devis(id) ON DELETE SET NULL,
  facture_id           UUID REFERENCES factures(id) ON DELETE SET NULL,
  notes                TEXT,
  created_at           TIMESTAMPTZ DEFAULT now(),
  updated_at           TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE crm_opportunites ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_iso_crm_opp" ON crm_opportunites;
CREATE POLICY "tenant_iso_crm_opp" ON crm_opportunites
  FOR ALL USING (tenant_id = get_my_tenant_id());

-- ── 4. Activités CRM ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS crm_activites (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  client_id        UUID REFERENCES clients(id) ON DELETE CASCADE,
  opportunite_id   UUID REFERENCES crm_opportunites(id) ON DELETE CASCADE,
  type             TEXT NOT NULL DEFAULT 'note'
                     CHECK (type IN ('appel','email','reunion','note','devis_envoye','relance','visite')),
  titre            TEXT NOT NULL,
  description      TEXT,
  date_activite    TIMESTAMPTZ DEFAULT now(),
  fait             BOOLEAN DEFAULT TRUE,
  created_by       UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE crm_activites ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_iso_crm_act" ON crm_activites;
CREATE POLICY "tenant_iso_crm_act" ON crm_activites
  FOR ALL USING (tenant_id = get_my_tenant_id());

-- ── 5. Relances recouvrement ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS relances (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  facture_id       UUID NOT NULL REFERENCES factures(id) ON DELETE CASCADE,
  client_id        UUID REFERENCES clients(id) ON DELETE SET NULL,
  type             TEXT NOT NULL DEFAULT 'email'
                     CHECK (type IN ('email','sms','courrier','appel','mise_en_demeure')),
  niveau           INTEGER NOT NULL DEFAULT 1 CHECK (niveau BETWEEN 1 AND 5),
  statut           TEXT NOT NULL DEFAULT 'envoye'
                     CHECK (statut IN ('planifie','envoye','lu','repondu','echec')),
  date_relance     DATE NOT NULL DEFAULT CURRENT_DATE,
  message          TEXT,
  montant_concerne NUMERIC(15,2),
  retard_jours     INTEGER,
  created_by       UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE relances ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_iso_relances" ON relances;
CREATE POLICY "tenant_iso_relances" ON relances
  FOR ALL USING (tenant_id = get_my_tenant_id());

-- ── 6. Avoirs (notes de crédit) ──────────────────────────────────────────────
ALTER TABLE factures ADD COLUMN IF NOT EXISTS avoir_de UUID REFERENCES factures(id) ON DELETE SET NULL;

-- ── 7. Index performance ─────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_factures_client_id   ON factures(client_id);
CREATE INDEX IF NOT EXISTS idx_devis_client_id       ON devis(client_id);
CREATE INDEX IF NOT EXISTS idx_crm_opp_tenant_etape  ON crm_opportunites(tenant_id, etape);
CREATE INDEX IF NOT EXISTS idx_crm_opp_client        ON crm_opportunites(client_id);
CREATE INDEX IF NOT EXISTS idx_crm_act_client        ON crm_activites(client_id, date_activite DESC);
CREATE INDEX IF NOT EXISTS idx_relances_facture       ON relances(facture_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_relances_tenant        ON relances(tenant_id, date_relance DESC);
CREATE INDEX IF NOT EXISTS idx_clients_score         ON clients(tenant_id, score_risque);
CREATE INDEX IF NOT EXISTS idx_clients_statut        ON clients(tenant_id, statut);

-- ── 8. Fonction: recalcul score risque client ────────────────────────────────
CREATE OR REPLACE FUNCTION recalc_client_score(p_client_id UUID, p_tenant_id UUID)
RETURNS VOID AS $$
DECLARE
  v_nb_factures  INTEGER;
  v_nb_impayes   INTEGER;
  v_ca_total     NUMERIC;
  v_impaye_total NUMERIC;
  v_score        INTEGER;
BEGIN
  SELECT
    COUNT(*),
    COALESCE(SUM(total), 0)
  INTO v_nb_factures, v_ca_total
  FROM factures
  WHERE client_id = p_client_id AND tenant_id = p_tenant_id
    AND statut NOT IN ('brouillon','annulee');

  SELECT
    COUNT(*),
    COALESCE(SUM(total), 0)
  INTO v_nb_impayes, v_impaye_total
  FROM factures
  WHERE client_id = p_client_id AND tenant_id = p_tenant_id
    AND statut IN ('retard','envoyee')
    AND due_date < CURRENT_DATE;

  -- Score 0-100 : base 80, malus impayés
  v_score := GREATEST(0, LEAST(100,
    80
    - CASE WHEN v_nb_factures > 0 THEN (v_nb_impayes * 100 / v_nb_factures) ELSE 0 END
    - CASE WHEN v_ca_total > 0 THEN LEAST(30, (v_impaye_total * 30 / v_ca_total)::INTEGER) ELSE 0 END
  ));

  UPDATE clients SET
    nb_factures    = v_nb_factures,
    nb_impayes     = v_nb_impayes,
    ca_total       = v_ca_total,
    impaye_total   = v_impaye_total,
    score_risque   = v_score
  WHERE id = p_client_id AND tenant_id = p_tenant_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ═══════════════════════════════════════════════════════════════════════════════
-- MIGRATION 083 — RESTAURANT ENTERPRISE (POS Premium)
-- Nouveaux modules : Réservations, Formules, Livraisons tracking
-- Comptabilité : trigger OHADA automatique sur ventes POS
-- Interconnexions : stock → trésorerie → journal OHADA → fiscalité
-- ═══════════════════════════════════════════════════════════════════════════════

-- ── 1. Coût de production sur resto_menu (pour rentabilité) ──────────────────
ALTER TABLE resto_menu
  ADD COLUMN IF NOT EXISTS cout_production NUMERIC(12,0) DEFAULT 0;

-- ── 2. Colonnes livraison sur resto_commandes ─────────────────────────────────
ALTER TABLE resto_commandes
  ADD COLUMN IF NOT EXISTS livreur_nom              TEXT,
  ADD COLUMN IF NOT EXISTS statut_livraison         TEXT DEFAULT 'en_attente'
    CHECK (statut_livraison IN ('en_attente','en_preparation','parti','livre','echec')),
  ADD COLUMN IF NOT EXISTS heure_depart_livraison   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS heure_livraison_effectuee TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_cmd_livraison ON resto_commandes(tenant_id, mode, statut_livraison)
  WHERE mode = 'livraison';

-- ── 3. Réservations salle ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS resto_reservations (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  table_id            UUID        REFERENCES resto_tables(id) ON DELETE SET NULL,
  date_resa           DATE        NOT NULL,
  heure_resa          TIME        NOT NULL,
  nb_personnes        INTEGER     NOT NULL DEFAULT 2,
  client_nom          TEXT        NOT NULL,
  client_tel          TEXT,
  client_email        TEXT,
  statut              TEXT        NOT NULL DEFAULT 'confirmee'
    CHECK (statut IN ('en_attente','confirmee','arrivee','annulee','no_show')),
  notes               TEXT,
  origine             TEXT        DEFAULT 'telephone'
    CHECK (origine IN ('telephone','en_ligne','walk_in','agence')),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_resto_resa_tenant_date ON resto_reservations(tenant_id, date_resa);
ALTER TABLE resto_reservations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "resa_sel"  ON resto_reservations;
DROP POLICY IF EXISTS "resa_ins"  ON resto_reservations;
DROP POLICY IF EXISTS "resa_upd"  ON resto_reservations;
DROP POLICY IF EXISTS "resa_del"  ON resto_reservations;
CREATE POLICY "resa_sel" ON resto_reservations FOR SELECT USING (tenant_id = get_my_tenant_id());
CREATE POLICY "resa_ins" ON resto_reservations FOR INSERT WITH CHECK (tenant_id = get_my_tenant_id());
CREATE POLICY "resa_upd" ON resto_reservations FOR UPDATE USING (tenant_id = get_my_tenant_id());
CREATE POLICY "resa_del" ON resto_reservations FOR DELETE USING (tenant_id = get_my_tenant_id());

-- ── 4. Formules / Menus du jour ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS resto_formules (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  nom          TEXT        NOT NULL,
  description  TEXT,
  prix         NUMERIC(12,0) NOT NULL DEFAULT 0,
  disponible   BOOLEAN     NOT NULL DEFAULT TRUE,
  type_service TEXT        NOT NULL DEFAULT 'midi'
    CHECK (type_service IN ('midi','soir','weekend','tout')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_resto_formules_tenant ON resto_formules(tenant_id, disponible);
ALTER TABLE resto_formules ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "form_sel" ON resto_formules;
DROP POLICY IF EXISTS "form_ins" ON resto_formules;
DROP POLICY IF EXISTS "form_upd" ON resto_formules;
DROP POLICY IF EXISTS "form_del" ON resto_formules;
CREATE POLICY "form_sel" ON resto_formules FOR SELECT USING (tenant_id = get_my_tenant_id());
CREATE POLICY "form_ins" ON resto_formules FOR INSERT WITH CHECK (tenant_id = get_my_tenant_id());
CREATE POLICY "form_upd" ON resto_formules FOR UPDATE USING (tenant_id = get_my_tenant_id());
CREATE POLICY "form_del" ON resto_formules FOR DELETE USING (tenant_id = get_my_tenant_id());

-- ── 5. Items d'une formule ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS resto_formule_items (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  formule_id  UUID        NOT NULL REFERENCES resto_formules(id) ON DELETE CASCADE,
  plat_id     UUID        REFERENCES resto_menu(id) ON DELETE SET NULL,
  nom         TEXT        NOT NULL,
  type_item   TEXT        NOT NULL DEFAULT 'plat'
    CHECK (type_item IN ('entree','plat','dessert','boisson')),
  obligatoire BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_resto_fi_formule ON resto_formule_items(formule_id);
ALTER TABLE resto_formule_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "fi_sel" ON resto_formule_items;
DROP POLICY IF EXISTS "fi_ins" ON resto_formule_items;
DROP POLICY IF EXISTS "fi_del" ON resto_formule_items;
CREATE POLICY "fi_sel" ON resto_formule_items FOR SELECT USING (tenant_id = get_my_tenant_id());
CREATE POLICY "fi_ins" ON resto_formule_items FOR INSERT WITH CHECK (tenant_id = get_my_tenant_id());
CREATE POLICY "fi_del" ON resto_formule_items FOR DELETE USING (tenant_id = get_my_tenant_id());

-- ── 6. Trigger OHADA : vente POS → journal_entries automatique ───────────────
-- Débit : 511000 (espèces) | 571100 (Airtel) | 571200 (MTN) | 512000 (carte)
-- Crédit : 707000 (Ventes) HT + 441000 (TVA collectée)
-- Taux TVA Congo : 18.9 % (1/1.189 ≈ 0.8410 pour calcul HT)

CREATE OR REPLACE FUNCTION fn_resto_commande_to_journal()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_debit  TEXT;
  v_ht     NUMERIC(14,2);
  v_tva    NUMERIC(14,2);
  v_label  TEXT;
  v_year   INT;
BEGIN
  IF COALESCE(NEW.total, 0) <= 0 THEN RETURN NEW; END IF;

  -- Idempotence
  IF EXISTS (
    SELECT 1 FROM journal_entries
    WHERE source = 'resto_pos' AND source_id = NEW.id AND tenant_id = NEW.tenant_id
  ) THEN RETURN NEW; END IF;

  v_debit := CASE COALESCE(NEW.mode_paiement, 'especes')
    WHEN 'airtel'   THEN '571100'
    WHEN 'mtn'      THEN '571200'
    WHEN 'carte'    THEN '512000'
    WHEN 'virement' THEN '521000'
    ELSE '511000'
  END;

  v_ht    := ROUND(NEW.total / 1.189, 0);
  v_tva   := NEW.total - v_ht;
  v_label := 'Vente POS ' || COALESCE(NEW.numero_recu, LEFT(NEW.id::TEXT, 8));
  v_year  := EXTRACT(YEAR FROM CURRENT_DATE)::INT;

  INSERT INTO journal_entries
    (tenant_id, date_operation, libelle, debit_account, credit_account, montant, source, source_id, fiscal_year)
  VALUES
    (NEW.tenant_id, CURRENT_DATE, v_label, v_debit, '707000', v_ht,  'resto_pos',     NEW.id, v_year);

  IF v_tva > 0 THEN
    INSERT INTO journal_entries
      (tenant_id, date_operation, libelle, debit_account, credit_account, montant, source, source_id, fiscal_year)
    VALUES
      (NEW.tenant_id, CURRENT_DATE, v_label || ' — TVA', v_debit, '441000', v_tva, 'resto_pos_tva', NEW.id, v_year);
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Non-bloquant : ne jamais empêcher la création d'une commande
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_resto_commande_journal ON resto_commandes;
CREATE TRIGGER trg_resto_commande_journal
  AFTER INSERT ON resto_commandes
  FOR EACH ROW EXECUTE FUNCTION fn_resto_commande_to_journal();

-- ── 7. Vue rentabilité plats ──────────────────────────────────────────────────
CREATE OR REPLACE VIEW resto_vue_rentabilite AS
SELECT
  m.id,
  m.tenant_id,
  m.nom,
  m.categorie,
  m.prix,
  COALESCE(m.cout_production, 0)                              AS cout_production,
  m.prix - COALESCE(m.cout_production, 0)                     AS marge_brute,
  CASE WHEN m.prix > 0
    THEN ROUND((m.prix - COALESCE(m.cout_production, 0)) / m.prix * 100, 1)
    ELSE 0
  END                                                          AS marge_pct,
  m.disponible
FROM resto_menu m;

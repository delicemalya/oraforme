-- ═══════════════════════════════════════════════════════════════════════════════
-- MIGRATION 082 — MODULE HÔTEL PREMIUM (tables htl_)
-- Isolation multi-tenant via hotel_id (UUID du tenant Oraforme)
-- Toutes les tables : RLS, created_at/updated_at, indexes
-- ═══════════════════════════════════════════════════════════════════════════════

-- ── Trigger updated_at universel ──────────────────────────────────────────────
CREATE OR REPLACE FUNCTION htl_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$;

-- ── 1. Types de chambres ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS htl_room_types (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id    UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  nom         TEXT NOT NULL,
  description TEXT,
  capacite    INTEGER NOT NULL DEFAULT 2,
  surface_m2  NUMERIC(6,1),
  equipements JSONB DEFAULT '[]',
  actif       BOOLEAN DEFAULT TRUE,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_htl_room_types_hotel ON htl_room_types(hotel_id);
ALTER TABLE htl_room_types ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "htl_room_types_tenant" ON htl_room_types;
CREATE POLICY "htl_room_types_tenant" ON htl_room_types FOR ALL USING (hotel_id = get_my_tenant_id());
CREATE TRIGGER htl_room_types_upd BEFORE UPDATE ON htl_room_types FOR EACH ROW EXECUTE FUNCTION htl_set_updated_at();

-- ── 2. Chambres ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS htl_rooms (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id      UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  type_id       UUID REFERENCES htl_room_types(id) ON DELETE SET NULL,
  numero        TEXT NOT NULL,
  etage         INTEGER DEFAULT 0,
  statut        TEXT DEFAULT 'disponible'
    CHECK (statut IN ('disponible','occupee','maintenance','hors_service','nettoyage')),
  equipements   JSONB DEFAULT '[]',
  notes         TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(hotel_id, numero)
);
CREATE INDEX IF NOT EXISTS idx_htl_rooms_hotel  ON htl_rooms(hotel_id, statut);
CREATE INDEX IF NOT EXISTS idx_htl_rooms_type   ON htl_rooms(type_id);
ALTER TABLE htl_rooms ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "htl_rooms_tenant" ON htl_rooms;
CREATE POLICY "htl_rooms_tenant" ON htl_rooms FOR ALL USING (hotel_id = get_my_tenant_id());
CREATE TRIGGER htl_rooms_upd BEFORE UPDATE ON htl_rooms FOR EACH ROW EXECUTE FUNCTION htl_set_updated_at();

-- ── 3. Saisons tarifaires ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS htl_rate_seasons (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id    UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  nom         TEXT NOT NULL,
  type_saison TEXT DEFAULT 'normale' CHECK (type_saison IN ('haute','normale','basse','evenement')),
  date_debut  DATE NOT NULL,
  date_fin    DATE NOT NULL,
  actif       BOOLEAN DEFAULT TRUE,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_htl_seasons_hotel ON htl_rate_seasons(hotel_id, date_debut, date_fin);
ALTER TABLE htl_rate_seasons ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "htl_seasons_tenant" ON htl_rate_seasons;
CREATE POLICY "htl_seasons_tenant" ON htl_rate_seasons FOR ALL USING (hotel_id = get_my_tenant_id());
CREATE TRIGGER htl_seasons_upd BEFORE UPDATE ON htl_rate_seasons FOR EACH ROW EXECUTE FUNCTION htl_set_updated_at();

-- ── 4. Tarifs par type + saison ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS htl_room_rates (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id    UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  type_id     UUID NOT NULL REFERENCES htl_room_types(id) ON DELETE CASCADE,
  season_id   UUID REFERENCES htl_rate_seasons(id) ON DELETE SET NULL,
  prix_nuit   NUMERIC(12,0) NOT NULL DEFAULT 0,
  devise      TEXT DEFAULT 'XAF',
  petit_dej   NUMERIC(12,0) DEFAULT 0,
  actif       BOOLEAN DEFAULT TRUE,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_htl_rates_hotel ON htl_room_rates(hotel_id, type_id);
ALTER TABLE htl_room_rates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "htl_rates_tenant" ON htl_room_rates;
CREATE POLICY "htl_rates_tenant" ON htl_room_rates FOR ALL USING (hotel_id = get_my_tenant_id());
CREATE TRIGGER htl_rates_upd BEFORE UPDATE ON htl_room_rates FOR EACH ROW EXECUTE FUNCTION htl_set_updated_at();

-- ── 5. Clients (guests) ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS htl_guests (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id           UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  nom                TEXT NOT NULL,
  prenom             TEXT,
  email              TEXT,
  telephone          TEXT,
  nationalite        TEXT,
  type_piece         TEXT CHECK (type_piece IN ('cni','passeport','permis','autre')),
  numero_piece       TEXT,
  date_naissance     DATE,
  pays_residence     TEXT,
  ville_residence    TEXT,
  nb_sejours         INTEGER DEFAULT 0,
  total_depense      NUMERIC(15,0) DEFAULT 0,
  vip                BOOLEAN DEFAULT FALSE,
  notes              TEXT,
  created_at         TIMESTAMPTZ DEFAULT NOW(),
  updated_at         TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_htl_guests_hotel ON htl_guests(hotel_id);
CREATE INDEX IF NOT EXISTS idx_htl_guests_nom   ON htl_guests(hotel_id, nom);
ALTER TABLE htl_guests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "htl_guests_tenant" ON htl_guests;
CREATE POLICY "htl_guests_tenant" ON htl_guests FOR ALL USING (hotel_id = get_my_tenant_id());
CREATE TRIGGER htl_guests_upd BEFORE UPDATE ON htl_guests FOR EACH ROW EXECUTE FUNCTION htl_set_updated_at();

-- ── 6. Agences partenaires ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS htl_agencies (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id        UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  nom             TEXT NOT NULL,
  contact_nom     TEXT,
  contact_tel     TEXT,
  contact_email   TEXT,
  commission_pct  NUMERIC(5,2) DEFAULT 0,
  type_contrat    TEXT DEFAULT 'commission' CHECK (type_contrat IN ('commission','forfait','allotement')),
  actif           BOOLEAN DEFAULT TRUE,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_htl_agencies_hotel ON htl_agencies(hotel_id);
ALTER TABLE htl_agencies ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "htl_agencies_tenant" ON htl_agencies;
CREATE POLICY "htl_agencies_tenant" ON htl_agencies FOR ALL USING (hotel_id = get_my_tenant_id());
CREATE TRIGGER htl_agencies_upd BEFORE UPDATE ON htl_agencies FOR EACH ROW EXECUTE FUNCTION htl_set_updated_at();

-- ── 7. Réservations ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS htl_reservations (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id           UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  numero             TEXT NOT NULL,
  type_reservation   TEXT DEFAULT 'directe' CHECK (type_reservation IN ('directe','agence','online','groupe','walk_in')),
  statut             TEXT DEFAULT 'confirmee' CHECK (statut IN ('option','confirmee','annulee','no_show','checkin','checkout')),
  guest_id           UUID REFERENCES htl_guests(id) ON DELETE SET NULL,
  agency_id          UUID REFERENCES htl_agencies(id) ON DELETE SET NULL,
  date_arrivee       DATE NOT NULL,
  date_depart        DATE NOT NULL,
  nb_nuits           INTEGER GENERATED ALWAYS AS (date_depart - date_arrivee) STORED,
  nb_adultes         INTEGER DEFAULT 1,
  nb_enfants         INTEGER DEFAULT 0,
  montant_total      NUMERIC(15,0) DEFAULT 0,
  montant_acompte    NUMERIC(15,0) DEFAULT 0,
  devise             TEXT DEFAULT 'XAF',
  source             TEXT,
  notes              TEXT,
  agent_id           UUID,
  created_at         TIMESTAMPTZ DEFAULT NOW(),
  updated_at         TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(hotel_id, numero)
);
CREATE INDEX IF NOT EXISTS idx_htl_res_hotel   ON htl_reservations(hotel_id, statut);
CREATE INDEX IF NOT EXISTS idx_htl_res_dates   ON htl_reservations(hotel_id, date_arrivee, date_depart);
CREATE INDEX IF NOT EXISTS idx_htl_res_guest   ON htl_reservations(guest_id);
ALTER TABLE htl_reservations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "htl_reservations_tenant" ON htl_reservations;
CREATE POLICY "htl_reservations_tenant" ON htl_reservations FOR ALL USING (hotel_id = get_my_tenant_id());
CREATE TRIGGER htl_reservations_upd BEFORE UPDATE ON htl_reservations FOR EACH ROW EXECUTE FUNCTION htl_set_updated_at();

-- Numérotation automatique HTL-YYYYMMDD-XXXX
CREATE OR REPLACE FUNCTION htl_generate_reservation_number(p_hotel_id UUID)
RETURNS TEXT LANGUAGE plpgsql AS $$
DECLARE
  v_date TEXT := TO_CHAR(CURRENT_DATE, 'YYYYMMDD');
  v_seq  INTEGER;
BEGIN
  SELECT COUNT(*) + 1 INTO v_seq
  FROM htl_reservations
  WHERE hotel_id = p_hotel_id AND numero LIKE 'HTL-' || v_date || '-%';
  RETURN 'HTL-' || v_date || '-' || LPAD(v_seq::TEXT, 4, '0');
END; $$;

-- ── 8. Chambres par réservation ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS htl_reservation_rooms (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  reservation_id UUID NOT NULL REFERENCES htl_reservations(id) ON DELETE CASCADE,
  room_id        UUID NOT NULL REFERENCES htl_rooms(id) ON DELETE RESTRICT,
  type_id        UUID REFERENCES htl_room_types(id) ON DELETE SET NULL,
  prix_nuit      NUMERIC(12,0) NOT NULL,
  petit_dej      BOOLEAN DEFAULT FALSE,
  notes          TEXT,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_htl_res_rooms_res  ON htl_reservation_rooms(reservation_id);
CREATE INDEX IF NOT EXISTS idx_htl_res_rooms_room ON htl_reservation_rooms(room_id);
ALTER TABLE htl_reservation_rooms ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "htl_res_rooms_tenant" ON htl_reservation_rooms;
CREATE POLICY "htl_res_rooms_tenant" ON htl_reservation_rooms FOR ALL USING (hotel_id = get_my_tenant_id());

-- ── 9. Check-ins ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS htl_check_ins (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id          UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  reservation_id    UUID NOT NULL REFERENCES htl_reservations(id) ON DELETE CASCADE,
  room_id           UUID REFERENCES htl_rooms(id) ON DELETE SET NULL,
  date_arrivee_reelle TIMESTAMPTZ DEFAULT NOW(),
  depot_garantie    NUMERIC(12,0) DEFAULT 0,
  numero_cle        TEXT,
  agent_id          UUID,
  notes             TEXT,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_htl_checkins_hotel ON htl_check_ins(hotel_id, reservation_id);
ALTER TABLE htl_check_ins ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "htl_checkins_tenant" ON htl_check_ins;
CREATE POLICY "htl_checkins_tenant" ON htl_check_ins FOR ALL USING (hotel_id = get_my_tenant_id());
CREATE TRIGGER htl_checkins_upd BEFORE UPDATE ON htl_check_ins FOR EACH ROW EXECUTE FUNCTION htl_set_updated_at();

-- ── 10. Check-outs ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS htl_check_outs (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id             UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  reservation_id       UUID NOT NULL REFERENCES htl_reservations(id) ON DELETE CASCADE,
  room_id              UUID REFERENCES htl_rooms(id) ON DELETE SET NULL,
  date_depart_reelle   TIMESTAMPTZ DEFAULT NOW(),
  note_client          INTEGER CHECK (note_client BETWEEN 1 AND 5),
  commentaire          TEXT,
  statut_chambre_final TEXT DEFAULT 'a_nettoyer' CHECK (statut_chambre_final IN ('ok','a_nettoyer','maintenance','dommages')),
  agent_id             UUID,
  montant_extras       NUMERIC(12,0) DEFAULT 0,
  created_at           TIMESTAMPTZ DEFAULT NOW(),
  updated_at           TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_htl_checkouts_hotel ON htl_check_outs(hotel_id, reservation_id);
ALTER TABLE htl_check_outs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "htl_checkouts_tenant" ON htl_check_outs;
CREATE POLICY "htl_checkouts_tenant" ON htl_check_outs FOR ALL USING (hotel_id = get_my_tenant_id());
CREATE TRIGGER htl_checkouts_upd BEFORE UPDATE ON htl_check_outs FOR EACH ROW EXECUTE FUNCTION htl_set_updated_at();

-- ── 11. Housekeeping ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS htl_housekeeping_tasks (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id    UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  room_id     UUID NOT NULL REFERENCES htl_rooms(id) ON DELETE CASCADE,
  type_tache  TEXT DEFAULT 'nettoyage' CHECK (type_tache IN ('nettoyage','recouche','depart','inspection','reapprovisionnement')),
  priorite    TEXT DEFAULT 'normale' CHECK (priorite IN ('basse','normale','haute','urgente')),
  statut      TEXT DEFAULT 'a_faire' CHECK (statut IN ('a_faire','en_cours','terminee','verifiee','annulee')),
  assigne_a   TEXT,
  notes       TEXT,
  date_planif DATE DEFAULT CURRENT_DATE,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_htl_hk_hotel   ON htl_housekeeping_tasks(hotel_id, statut, date_planif);
CREATE INDEX IF NOT EXISTS idx_htl_hk_room    ON htl_housekeeping_tasks(room_id);
ALTER TABLE htl_housekeeping_tasks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "htl_hk_tenant" ON htl_housekeeping_tasks;
CREATE POLICY "htl_hk_tenant" ON htl_housekeeping_tasks FOR ALL USING (hotel_id = get_my_tenant_id());
CREATE TRIGGER htl_hk_upd BEFORE UPDATE ON htl_housekeeping_tasks FOR EACH ROW EXECUTE FUNCTION htl_set_updated_at();

-- ── 12. Maintenance ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS htl_maintenance_requests (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  room_id      UUID REFERENCES htl_rooms(id) ON DELETE SET NULL,
  titre        TEXT NOT NULL,
  description  TEXT,
  categorie    TEXT DEFAULT 'autre' CHECK (categorie IN ('plomberie','electricite','climatisation','mobilier','serrure','tv_internet','peinture','autre')),
  priorite     TEXT DEFAULT 'normale' CHECK (priorite IN ('basse','normale','haute','urgente')),
  statut       TEXT DEFAULT 'signale' CHECK (statut IN ('signale','en_cours','resolu','annule')),
  technicien   TEXT,
  cout_reparation NUMERIC(12,0),
  date_resolution TIMESTAMPTZ,
  signale_par  TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_htl_maint_hotel  ON htl_maintenance_requests(hotel_id, statut);
CREATE INDEX IF NOT EXISTS idx_htl_maint_room   ON htl_maintenance_requests(room_id);
ALTER TABLE htl_maintenance_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "htl_maint_tenant" ON htl_maintenance_requests;
CREATE POLICY "htl_maint_tenant" ON htl_maintenance_requests FOR ALL USING (hotel_id = get_my_tenant_id());
CREATE TRIGGER htl_maint_upd BEFORE UPDATE ON htl_maintenance_requests FOR EACH ROW EXECUTE FUNCTION htl_set_updated_at();

-- ── 13. Catégories menu restaurant ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS htl_menu_categories (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  nom        TEXT NOT NULL,
  ordre      INTEGER DEFAULT 0,
  actif      BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE htl_menu_categories ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "htl_menu_cat_tenant" ON htl_menu_categories;
CREATE POLICY "htl_menu_cat_tenant" ON htl_menu_categories FOR ALL USING (hotel_id = get_my_tenant_id());

-- ── 14. Articles menu restaurant ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS htl_menu_items (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  category_id  UUID REFERENCES htl_menu_categories(id) ON DELETE SET NULL,
  nom          TEXT NOT NULL,
  description  TEXT,
  prix         NUMERIC(12,0) NOT NULL DEFAULT 0,
  disponible   BOOLEAN DEFAULT TRUE,
  room_service BOOLEAN DEFAULT TRUE,
  image_url    TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_htl_menu_items_hotel ON htl_menu_items(hotel_id, disponible);
ALTER TABLE htl_menu_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "htl_menu_items_tenant" ON htl_menu_items;
CREATE POLICY "htl_menu_items_tenant" ON htl_menu_items FOR ALL USING (hotel_id = get_my_tenant_id());
CREATE TRIGGER htl_menu_items_upd BEFORE UPDATE ON htl_menu_items FOR EACH ROW EXECUTE FUNCTION htl_set_updated_at();

-- ── 15. Commandes restaurant/room service ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS htl_orders (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  reservation_id UUID REFERENCES htl_reservations(id) ON DELETE SET NULL,
  room_id        UUID REFERENCES htl_rooms(id) ON DELETE SET NULL,
  type_commande  TEXT DEFAULT 'restaurant' CHECK (type_commande IN ('restaurant','room_service','bar','minibar')),
  statut         TEXT DEFAULT 'en_attente' CHECK (statut IN ('en_attente','en_preparation','pret','livre','annule','facture')),
  table_numero   TEXT,
  montant_total  NUMERIC(12,0) DEFAULT 0,
  notes          TEXT,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_htl_orders_hotel ON htl_orders(hotel_id, statut);
ALTER TABLE htl_orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "htl_orders_tenant" ON htl_orders;
CREATE POLICY "htl_orders_tenant" ON htl_orders FOR ALL USING (hotel_id = get_my_tenant_id());
CREATE TRIGGER htl_orders_upd BEFORE UPDATE ON htl_orders FOR EACH ROW EXECUTE FUNCTION htl_set_updated_at();

-- ── 16. Lignes commandes restaurant ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS htl_order_items (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  order_id   UUID NOT NULL REFERENCES htl_orders(id) ON DELETE CASCADE,
  item_id    UUID REFERENCES htl_menu_items(id) ON DELETE SET NULL,
  nom        TEXT NOT NULL,
  quantite   INTEGER NOT NULL DEFAULT 1,
  prix_unit  NUMERIC(12,0) NOT NULL,
  notes      TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_htl_order_items_order ON htl_order_items(order_id);
ALTER TABLE htl_order_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "htl_order_items_tenant" ON htl_order_items;
CREATE POLICY "htl_order_items_tenant" ON htl_order_items FOR ALL USING (hotel_id = get_my_tenant_id());

-- ── 17. Factures ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS htl_invoices (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  reservation_id UUID REFERENCES htl_reservations(id) ON DELETE SET NULL,
  guest_id       UUID REFERENCES htl_guests(id) ON DELETE SET NULL,
  numero         TEXT NOT NULL,
  date_facture   DATE DEFAULT CURRENT_DATE,
  date_echeance  DATE,
  montant_ht     NUMERIC(15,0) DEFAULT 0,
  tva_18         NUMERIC(15,0) DEFAULT 0,
  ca_5           NUMERIC(15,0) DEFAULT 0,
  montant_ttc    NUMERIC(15,0) DEFAULT 0,
  statut         TEXT DEFAULT 'brouillon' CHECK (statut IN ('brouillon','emise','payee','annulee')),
  notes          TEXT,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(hotel_id, numero)
);
CREATE INDEX IF NOT EXISTS idx_htl_invoices_hotel ON htl_invoices(hotel_id, statut);
ALTER TABLE htl_invoices ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "htl_invoices_tenant" ON htl_invoices;
CREATE POLICY "htl_invoices_tenant" ON htl_invoices FOR ALL USING (hotel_id = get_my_tenant_id());
CREATE TRIGGER htl_invoices_upd BEFORE UPDATE ON htl_invoices FOR EACH ROW EXECUTE FUNCTION htl_set_updated_at();

-- ── 18. Lignes factures ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS htl_invoice_lines (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id    UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  invoice_id  UUID NOT NULL REFERENCES htl_invoices(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  quantite    NUMERIC(8,2) DEFAULT 1,
  prix_unit   NUMERIC(12,0) DEFAULT 0,
  montant     NUMERIC(15,0) DEFAULT 0,
  type_ligne  TEXT DEFAULT 'sejour' CHECK (type_ligne IN ('sejour','restaurant','minibar','extras','remise')),
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_htl_inv_lines ON htl_invoice_lines(invoice_id);
ALTER TABLE htl_invoice_lines ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "htl_inv_lines_tenant" ON htl_invoice_lines;
CREATE POLICY "htl_inv_lines_tenant" ON htl_invoice_lines FOR ALL USING (hotel_id = get_my_tenant_id());

-- ── 19. Encaissements ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS htl_payments (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  invoice_id     UUID REFERENCES htl_invoices(id) ON DELETE SET NULL,
  reservation_id UUID REFERENCES htl_reservations(id) ON DELETE SET NULL,
  montant        NUMERIC(15,0) NOT NULL,
  devise         TEXT DEFAULT 'XAF',
  mode_paiement  TEXT DEFAULT 'especes' CHECK (mode_paiement IN ('especes','carte','mobile_money','virement','cheque','avoir')),
  reference      TEXT,
  notes          TEXT,
  agent_id       UUID,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_htl_payments_hotel   ON htl_payments(hotel_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_htl_payments_invoice ON htl_payments(invoice_id);
ALTER TABLE htl_payments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "htl_payments_tenant" ON htl_payments;
CREATE POLICY "htl_payments_tenant" ON htl_payments FOR ALL USING (hotel_id = get_my_tenant_id());
CREATE TRIGGER htl_payments_upd BEFORE UPDATE ON htl_payments FOR EACH ROW EXECUTE FUNCTION htl_set_updated_at();

-- ── 20. Dépenses opérationnelles ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS htl_expenses (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  categorie    TEXT NOT NULL CHECK (categorie IN ('salaires','fournisseurs','maintenance','energie','marketing','fournitures','autre')),
  description  TEXT NOT NULL,
  montant      NUMERIC(15,0) NOT NULL,
  date_depense DATE DEFAULT CURRENT_DATE,
  justificatif TEXT,
  valide_par   TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_htl_expenses_hotel ON htl_expenses(hotel_id, date_depense DESC);
ALTER TABLE htl_expenses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "htl_expenses_tenant" ON htl_expenses;
CREATE POLICY "htl_expenses_tenant" ON htl_expenses FOR ALL USING (hotel_id = get_my_tenant_id());
CREATE TRIGGER htl_expenses_upd BEFORE UPDATE ON htl_expenses FOR EACH ROW EXECUTE FUNCTION htl_set_updated_at();

-- ── 21. Journal comptable SYSCOHADA ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS htl_journal_entries (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  numero_piece   TEXT NOT NULL,
  date_ecriture  DATE DEFAULT CURRENT_DATE,
  libelle        TEXT NOT NULL,
  source         TEXT DEFAULT 'manuel' CHECK (source IN ('reservation','encaissement','depense','manuel','correction')),
  source_id      UUID,
  total_debit    NUMERIC(15,0) DEFAULT 0,
  total_credit   NUMERIC(15,0) DEFAULT 0,
  valide         BOOLEAN DEFAULT FALSE,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_htl_journal_hotel ON htl_journal_entries(hotel_id, date_ecriture DESC);
ALTER TABLE htl_journal_entries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "htl_journal_tenant" ON htl_journal_entries;
CREATE POLICY "htl_journal_tenant" ON htl_journal_entries FOR ALL USING (hotel_id = get_my_tenant_id());
CREATE TRIGGER htl_journal_upd BEFORE UPDATE ON htl_journal_entries FOR EACH ROW EXECUTE FUNCTION htl_set_updated_at();

CREATE TABLE IF NOT EXISTS htl_journal_lines (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id    UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  entry_id    UUID NOT NULL REFERENCES htl_journal_entries(id) ON DELETE CASCADE,
  compte_pcg  TEXT NOT NULL,
  libelle     TEXT,
  debit       NUMERIC(15,0) DEFAULT 0,
  credit      NUMERIC(15,0) DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_htl_jlines_entry ON htl_journal_lines(entry_id);
ALTER TABLE htl_journal_lines ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "htl_jlines_tenant" ON htl_journal_lines;
CREATE POLICY "htl_jlines_tenant" ON htl_journal_lines FOR ALL USING (hotel_id = get_my_tenant_id());

-- ── Vue KPIs occupation ───────────────────────────────────────────────────────
CREATE OR REPLACE VIEW htl_kpis_occupation AS
SELECT
  r.hotel_id,
  COUNT(DISTINCT rm.id)                                            AS nb_chambres_total,
  COUNT(DISTINCT CASE WHEN rm.statut = 'occupee' THEN rm.id END)  AS nb_chambres_occupees,
  COUNT(DISTINCT CASE WHEN rm.statut = 'disponible' THEN rm.id END) AS nb_chambres_dispo,
  ROUND(
    COUNT(DISTINCT CASE WHEN rm.statut = 'occupee' THEN rm.id END)::NUMERIC
    / NULLIF(COUNT(DISTINCT rm.id), 0) * 100, 1
  )                                                                AS taux_occupation
FROM htl_rooms rm
  LEFT JOIN htl_reservations r ON r.hotel_id = rm.hotel_id AND r.statut = 'checkin'
GROUP BY r.hotel_id, rm.hotel_id;

-- =============================================================================
-- Migration 062 : SaaS Billing Engine — Plans, Abonnements, Factures, Paiements
-- Auteur       : Oraforme ERP
-- Date         : 2026-05-29
-- Idempotente  : IF NOT EXISTS / ON CONFLICT DO UPDATE / DO $$ EXCEPTION $$
-- Architecture : Scalable, Multi-tenant, Mobile Money Afrique, Stripe-ready
-- =============================================================================


-- =============================================================================
-- SECTION 1 — billing_plans (Plans dynamiques, configurés par le owner)
--             Pas de tenant_id : table globale lisible par tous
-- =============================================================================

CREATE TABLE IF NOT EXISTS billing_plans (
  id             UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  code           TEXT          NOT NULL,
  nom            TEXT          NOT NULL,
  description    TEXT,
  type           TEXT          NOT NULL DEFAULT 'core'
                               CHECK (type IN ('core','industry_pack','addon')),
  secteur_cible  TEXT,                             -- NULL = universel
  prix_mensuel   NUMERIC(15,2) NOT NULL DEFAULT 0,
  prix_annuel    NUMERIC(15,2),                    -- NULL = pas de tarif annuel
  devise         TEXT          NOT NULL DEFAULT 'XAF',
  modules_inclus TEXT[]        NOT NULL DEFAULT '{}',
  max_users      INTEGER,                          -- NULL = illimité
  max_clients    INTEGER,
  max_storage_gb INTEGER,
  trial_days     INTEGER       NOT NULL DEFAULT 14,
  is_active      BOOLEAN       NOT NULL DEFAULT true,
  sort_order     INTEGER       NOT NULL DEFAULT 0,
  metadata       JSONB         NOT NULL DEFAULT '{}',
  created_at     TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

DO $$ BEGIN
  ALTER TABLE billing_plans ADD CONSTRAINT billing_plans_code_uq UNIQUE (code);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL; END $$;

ALTER TABLE billing_plans ENABLE ROW LEVEL SECURITY;

-- Tous les users authentifiés peuvent lire les plans
DO $$ BEGIN
  CREATE POLICY "bp_select" ON billing_plans FOR SELECT USING (auth.uid() IS NOT NULL);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Seuls les super-admins peuvent gérer les plans (via service_role normalement)
DO $$ BEGIN
  CREATE POLICY "bp_manage" ON billing_plans FOR ALL
    USING (auth.email() = ANY(ARRAY['adjidongui@gmail.com','adjigordon@gmail.com']))
    WITH CHECK (auth.email() = ANY(ARRAY['adjidongui@gmail.com','adjigordon@gmail.com']));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_bplan_type    ON billing_plans(type);
CREATE INDEX IF NOT EXISTS idx_bplan_secteur ON billing_plans(secteur_cible) WHERE secteur_cible IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_bplan_active  ON billing_plans(is_active, sort_order);


-- =============================================================================
-- SECTION 2 — billing_subscriptions (Un abonnement actif par tenant)
-- =============================================================================

CREATE TABLE IF NOT EXISTS billing_subscriptions (
  id                    UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID          NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  plan_id               UUID          NOT NULL REFERENCES billing_plans(id),
  statut                TEXT          NOT NULL DEFAULT 'trial'
                                      CHECK (statut IN ('trial','active','past_due','suspended','cancelled','expired')),
  periode               TEXT          NOT NULL DEFAULT 'mensuel'
                                      CHECK (periode IN ('mensuel','annuel')),
  date_debut            DATE          NOT NULL DEFAULT CURRENT_DATE,
  date_fin              DATE,
  trial_ends_at         DATE,
  next_billing_date     DATE,
  montant_actuel        NUMERIC(15,2) NOT NULL DEFAULT 0,
  devise                TEXT          NOT NULL DEFAULT 'XAF',
  modules_extra         TEXT[]        NOT NULL DEFAULT '{}',
  montant_addons        NUMERIC(15,2) NOT NULL DEFAULT 0,
  -- Stripe ready
  stripe_subscription_id TEXT,
  stripe_customer_id     TEXT,
  -- Annulation
  cancel_at_period_end  BOOLEAN       NOT NULL DEFAULT false,
  cancelled_at          TIMESTAMPTZ,
  cancellation_reason   TEXT,
  metadata              JSONB         NOT NULL DEFAULT '{}',
  created_at            TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- Un seul abonnement non-terminé par tenant
CREATE UNIQUE INDEX IF NOT EXISTS idx_bsub_active_per_tenant
  ON billing_subscriptions(tenant_id)
  WHERE statut NOT IN ('cancelled','expired');

ALTER TABLE billing_subscriptions ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "bsub_select" ON billing_subscriptions FOR SELECT USING (tenant_id = get_my_tenant_id());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "bsub_insert" ON billing_subscriptions FOR INSERT WITH CHECK (tenant_id = get_my_tenant_id());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "bsub_update" ON billing_subscriptions FOR UPDATE
    USING (tenant_id = get_my_tenant_id()) WITH CHECK (tenant_id = get_my_tenant_id());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_bsub_tenant    ON billing_subscriptions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_bsub_plan      ON billing_subscriptions(plan_id);
CREATE INDEX IF NOT EXISTS idx_bsub_statut    ON billing_subscriptions(statut);
CREATE INDEX IF NOT EXISTS idx_bsub_nextbill  ON billing_subscriptions(next_billing_date)
  WHERE statut IN ('active','past_due');


-- =============================================================================
-- SECTION 3 — billing_invoices (Factures SaaS générées par le système)
-- =============================================================================

CREATE SEQUENCE IF NOT EXISTS billing_invoice_seq START 1;

CREATE TABLE IF NOT EXISTS billing_invoices (
  id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID          NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  subscription_id UUID          REFERENCES billing_subscriptions(id) ON DELETE SET NULL,
  numero_facture  TEXT          NOT NULL DEFAULT '',
  periode_debut   DATE          NOT NULL,
  periode_fin     DATE          NOT NULL,
  montant_ht      NUMERIC(15,2) NOT NULL DEFAULT 0,
  tva_pct         NUMERIC(5,2)  NOT NULL DEFAULT 0,
  montant_tva     NUMERIC(15,2) NOT NULL DEFAULT 0,
  montant_total   NUMERIC(15,2) NOT NULL DEFAULT 0,
  montant_paye    NUMERIC(15,2) NOT NULL DEFAULT 0,
  devise          TEXT          NOT NULL DEFAULT 'XAF',
  statut          TEXT          NOT NULL DEFAULT 'pending'
                                CHECK (statut IN ('pending','paid','overdue','cancelled','refunded')),
  date_echeance   DATE          NOT NULL,
  lignes          JSONB         NOT NULL DEFAULT '[]',
  notes           TEXT,
  metadata        JSONB         NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

ALTER TABLE billing_invoices ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "binv_select" ON billing_invoices FOR SELECT USING (tenant_id = get_my_tenant_id());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "binv_insert" ON billing_invoices FOR INSERT WITH CHECK (tenant_id = get_my_tenant_id());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "binv_update" ON billing_invoices FOR UPDATE
    USING (tenant_id = get_my_tenant_id()) WITH CHECK (tenant_id = get_my_tenant_id());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_binv_tenant   ON billing_invoices(tenant_id);
CREATE INDEX IF NOT EXISTS idx_binv_sub      ON billing_invoices(subscription_id);
CREATE INDEX IF NOT EXISTS idx_binv_statut   ON billing_invoices(statut);
CREATE INDEX IF NOT EXISTS idx_binv_echeance ON billing_invoices(date_echeance)
  WHERE statut IN ('pending','overdue');


-- =============================================================================
-- SECTION 4 — billing_payments (Paiements — Mobile Money, Stripe, Manuel…)
-- =============================================================================

CREATE TABLE IF NOT EXISTS billing_payments (
  id                 UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id          UUID          NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  invoice_id         UUID          REFERENCES billing_invoices(id) ON DELETE SET NULL,
  subscription_id    UUID          REFERENCES billing_subscriptions(id) ON DELETE SET NULL,
  montant            NUMERIC(15,2) NOT NULL CHECK (montant > 0),
  devise             TEXT          NOT NULL DEFAULT 'XAF',
  statut             TEXT          NOT NULL DEFAULT 'pending'
                                   CHECK (statut IN ('pending','processing','completed','failed','refunded','cancelled')),
  provider           TEXT          NOT NULL DEFAULT 'manual'
                                   CHECK (provider IN (
                                     'manual','airtel_money','mtn_money','orange_money',
                                     'stripe','paypal','bank_transfer','cheque'
                                   )),
  provider_reference TEXT,
  provider_response  JSONB         NOT NULL DEFAULT '{}',
  phone_number       TEXT,
  description        TEXT,
  initiated_by       UUID          REFERENCES auth.users(id) ON DELETE SET NULL,
  confirmed_at       TIMESTAMPTZ,
  created_at         TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

ALTER TABLE billing_payments ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "bpay_select" ON billing_payments FOR SELECT USING (tenant_id = get_my_tenant_id());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "bpay_insert" ON billing_payments FOR INSERT WITH CHECK (tenant_id = get_my_tenant_id());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "bpay_update" ON billing_payments FOR UPDATE
    USING (tenant_id = get_my_tenant_id()) WITH CHECK (tenant_id = get_my_tenant_id());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_bpay_tenant  ON billing_payments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_bpay_invoice ON billing_payments(invoice_id);
CREATE INDEX IF NOT EXISTS idx_bpay_statut  ON billing_payments(statut);


-- =============================================================================
-- SECTION 5 — billing_usage (Metering pour plans à commissions)
-- =============================================================================

CREATE TABLE IF NOT EXISTS billing_usage (
  id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID          NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  subscription_id UUID          REFERENCES billing_subscriptions(id) ON DELETE SET NULL,
  metric          TEXT          NOT NULL,
  quantite        NUMERIC(15,2) NOT NULL DEFAULT 0,
  montant         NUMERIC(15,2) NOT NULL DEFAULT 0,
  periode         DATE          NOT NULL DEFAULT CURRENT_DATE,
  metadata        JSONB         NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

ALTER TABLE billing_usage ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "busage_select" ON billing_usage FOR SELECT USING (tenant_id = get_my_tenant_id());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "busage_insert" ON billing_usage FOR INSERT WITH CHECK (tenant_id = get_my_tenant_id());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_busage_tenant  ON billing_usage(tenant_id, periode);
CREATE INDEX IF NOT EXISTS idx_busage_metric  ON billing_usage(tenant_id, metric);


-- =============================================================================
-- SECTION 6 — Fonctions & Triggers
-- =============================================================================

-- updated_at générique pour toutes les tables billing
CREATE OR REPLACE FUNCTION fn_billing_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS trg_bplan_upd ON billing_plans;
CREATE TRIGGER trg_bplan_upd
  BEFORE UPDATE ON billing_plans FOR EACH ROW EXECUTE FUNCTION fn_billing_updated_at();

DROP TRIGGER IF EXISTS trg_bsub_upd ON billing_subscriptions;
CREATE TRIGGER trg_bsub_upd
  BEFORE UPDATE ON billing_subscriptions FOR EACH ROW EXECUTE FUNCTION fn_billing_updated_at();

DROP TRIGGER IF EXISTS trg_binv_upd ON billing_invoices;
CREATE TRIGGER trg_binv_upd
  BEFORE UPDATE ON billing_invoices FOR EACH ROW EXECUTE FUNCTION fn_billing_updated_at();

DROP TRIGGER IF EXISTS trg_bpay_upd ON billing_payments;
CREATE TRIGGER trg_bpay_upd
  BEFORE UPDATE ON billing_payments FOR EACH ROW EXECUTE FUNCTION fn_billing_updated_at();

-- Numéro de facture auto : INV-2026-00001
CREATE OR REPLACE FUNCTION fn_billing_invoice_number()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.numero_facture IS NULL OR NEW.numero_facture = '' THEN
    NEW.numero_facture :=
      'INV-' || TO_CHAR(NOW(), 'YYYY') || '-' ||
      LPAD(nextval('billing_invoice_seq')::TEXT, 5, '0');
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_binv_numero ON billing_invoices;
CREATE TRIGGER trg_binv_numero
  BEFORE INSERT ON billing_invoices
  FOR EACH ROW EXECUTE FUNCTION fn_billing_invoice_number();

-- Synchroniser montant_paye + statut de la facture quand un paiement est confirmé
CREATE OR REPLACE FUNCTION fn_billing_payment_sync()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  total_paye NUMERIC(15,2);
  inv_total  NUMERIC(15,2);
BEGIN
  IF NEW.statut = 'completed' AND NEW.invoice_id IS NOT NULL THEN
    SELECT COALESCE(SUM(montant), 0) INTO total_paye
    FROM billing_payments
    WHERE invoice_id = NEW.invoice_id AND statut = 'completed';

    SELECT montant_total INTO inv_total
    FROM billing_invoices WHERE id = NEW.invoice_id;

    UPDATE billing_invoices
    SET
      montant_paye = total_paye,
      statut = CASE WHEN total_paye >= inv_total THEN 'paid' ELSE statut END,
      updated_at = NOW()
    WHERE id = NEW.invoice_id;
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_bpay_sync ON billing_payments;
CREATE TRIGGER trg_bpay_sync
  AFTER INSERT OR UPDATE OF statut ON billing_payments
  FOR EACH ROW EXECUTE FUNCTION fn_billing_payment_sync();

-- Sync tenant.plan quand subscription change de plan
CREATE OR REPLACE FUNCTION fn_bsub_sync_tenant_plan()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  plan_code TEXT;
BEGIN
  IF NEW.statut IN ('active','trial') THEN
    SELECT code INTO plan_code FROM billing_plans WHERE id = NEW.plan_id;
    UPDATE tenants SET plan = COALESCE(plan_code, plan) WHERE id = NEW.tenant_id;
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_bsub_sync_tenant ON billing_subscriptions;
CREATE TRIGGER trg_bsub_sync_tenant
  AFTER INSERT OR UPDATE OF statut, plan_id ON billing_subscriptions
  FOR EACH ROW EXECUTE FUNCTION fn_bsub_sync_tenant_plan();


-- =============================================================================
-- SECTION 7 — Seed : Plans (idempotent via ON CONFLICT DO UPDATE)
-- =============================================================================

INSERT INTO billing_plans
  (code, nom, description, type, secteur_cible,
   prix_mensuel, prix_annuel, devise,
   modules_inclus, trial_days, sort_order, metadata)
VALUES

-- ── Plans Core ───────────────────────────────────────────────────────────────
('starter',
 'Starter',
 'Facturation + Trésorerie pour démarrer',
 'core', NULL,
 5000, 48000, 'XAF',
 ARRAY['facturation','tresorerie'],
 14, 1, '{}'),

('pro',
 'Pro',
 'ERP complet : Comptabilité, RH, Stock, CRM',
 'core', NULL,
 15000, 144000, 'XAF',
 ARRAY['facturation','tresorerie','comptabilite','stock','rh','crm','achats','depenses'],
 14, 2, '{}'),

('enterprise',
 'Enterprise',
 'Suite complète ERP + IA + Analytics',
 'core', NULL,
 35000, 336000, 'XAF',
 ARRAY['facturation','tresorerie','comptabilite','stock','rh','crm','achats','depenses','rapports','bizbot','mobilemoney'],
 14, 3, '{}'),

-- ── Industry Packs ───────────────────────────────────────────────────────────
('hotel_pack',
 'Pack Hôtel',
 'Hébergement, réservations, housekeeping, caisse',
 'industry_pack', 'hotel',
 35000, 336000, 'XAF',
 ARRAY['hotel','tresorerie','comptabilite','stock','rh','facturation'],
 14, 10, '{}'),

('restaurant_pack',
 'Pack Restaurant',
 'POS, tables, cuisine, caisse, livraisons',
 'industry_pack', 'restaurant',
 20000, 192000, 'XAF',
 ARRAY['restaurant','stock','tresorerie','rh','comptabilite','facturation'],
 14, 11, '{}'),

('cabinet_compta',
 'Pack Cabinet Comptable',
 'Gestion clients entreprises + déclarations fiscales',
 'industry_pack', 'cabinet',
 15000, 144000, 'XAF',
 ARRAY['comptabilite','facturation','tresorerie','rh'],
 14, 12,
 '{"commission_client":5000,"commission_label":"5 000 FCFA par client géré"}'),

('cabinet_dentaire',
 'Pack Cabinet Dentaire',
 'Patients, rendez-vous, consultations, facturation',
 'industry_pack', 'sante',
 15000, 144000, 'XAF',
 ARRAY['sante','tresorerie','rh','facturation'],
 14, 13, '{}'),

('ecole_primaire',
 'Pack École Primaire',
 'Inscriptions, scolarité, paiements parents',
 'industry_pack', 'ecole',
 15000, 144000, 'XAF',
 ARRAY['ecole','tresorerie','rh'],
 14, 14, '{}'),

('lycee_pack',
 'Pack Collège / Lycée',
 'LMD, notes, absences, scolarité avancée',
 'industry_pack', 'ecole',
 35000, 336000, 'XAF',
 ARRAY['ecole','tresorerie','rh','comptabilite','facturation'],
 14, 15, '{}'),

('universite_pack',
 'Pack Université',
 'DAAC, LMD, soutenances, mémoires, diplômes',
 'industry_pack', 'ecole',
 56000, 537600, 'XAF',
 ARRAY['ecole','tresorerie','rh','comptabilite','facturation','stock','crm','rapports'],
 14, 16, '{}'),

('entreprise_std',
 'Entreprise Standard',
 'ERP de base pour toute PME africaine',
 'industry_pack', NULL,
 15000, 144000, 'XAF',
 ARRAY['facturation','tresorerie','comptabilite','stock'],
 14, 17, '{}'),

('supermarche_pack',
 'Pack Supermarché',
 'Stock, caisse, achats, fournisseurs, inventaire',
 'industry_pack', 'supermarche',
 35000, 336000, 'XAF',
 ARRAY['stock','facturation','tresorerie','rh','achats','depenses'],
 14, 18, '{}'),

('sante_pack',
 'Pack Clinique / Santé',
 'Patients, RDV, consultations, labo, assurances',
 'industry_pack', 'sante',
 25000, 240000, 'XAF',
 ARRAY['sante','tresorerie','rh','comptabilite','facturation'],
 14, 19, '{}'),

('pharmacie_pack',
 'Pack Pharmacie',
 'Médicaments, ventes POS, stock, expiration, ordonnances',
 'industry_pack', 'pharmacie',
 15000, 144000, 'XAF',
 ARRAY['pharmacie','tresorerie','stock','facturation'],
 14, 20, '{}'),

('ecommerce_pack',
 'Pack E-Commerce',
 'Boutique en ligne + commissions sur ventes',
 'industry_pack', 'commerce',
 10000, 96000, 'XAF',
 ARRAY['stock','facturation','tresorerie','crm','mobilemoney'],
 14, 21,
 '{"commission_tiers":[{"max_amount":25000,"commission":250},{"max_amount":50000,"commission":500},{"min_amount":100000,"commission":1000}],"commission_label":"Commissions sur ventes"}')

ON CONFLICT (code) DO UPDATE SET
  nom            = EXCLUDED.nom,
  description    = EXCLUDED.description,
  prix_mensuel   = EXCLUDED.prix_mensuel,
  prix_annuel    = EXCLUDED.prix_annuel,
  modules_inclus = EXCLUDED.modules_inclus,
  metadata       = EXCLUDED.metadata,
  is_active      = true,
  updated_at     = NOW();


-- =============================================================================
-- SECTION 8 — Addons modulaires (prix à l'unité, cumulables)
-- =============================================================================

INSERT INTO billing_plans
  (code, nom, description, type, secteur_cible,
   prix_mensuel, prix_annuel, devise,
   modules_inclus, trial_days, sort_order, metadata)
VALUES
('addon_bizbot',   'MIAA+ IA',         'Assistant IA conversationnel',     'addon', NULL, 5000, 48000, 'XAF', ARRAY['bizbot'],       0, 100, '{}'),
('addon_rapports', 'Analytics Pro',    'Rapports avancés & BI',            'addon', NULL, 3500, 33600, 'XAF', ARRAY['rapports'],     0, 101, '{}'),
('addon_crm',      'CRM Clients',      'Gestion prospects & fidélisation', 'addon', NULL, 3000, 28800, 'XAF', ARRAY['crm'],          0, 102, '{}'),
('addon_rh',       'RH & Paie',        'Paie CNSS/IRPP, congés',          'addon', NULL, 5000, 48000, 'XAF', ARRAY['rh'],           0, 103, '{}'),
('addon_stock',    'Stock Avancé',     'Inventaire, alertes, valorisation','addon', NULL, 2500, 24000, 'XAF', ARRAY['stock'],        0, 104, '{}'),
('addon_mm',       'Mobile Money',     'Airtel, MTN, Orange Money',        'addon', NULL, 2500, 24000, 'XAF', ARRAY['mobilemoney'],  0, 105, '{}'),
('addon_ged',      'GED Documents',    'Coffre numérique, signatures',     'addon', NULL, 3000, 28800, 'XAF', ARRAY['ged'],          0, 106, '{}')
ON CONFLICT (code) DO UPDATE SET
  prix_mensuel = EXCLUDED.prix_mensuel,
  prix_annuel  = EXCLUDED.prix_annuel,
  updated_at   = NOW();


-- =============================================================================
-- SECTION 9 — Vues MRR / ARR / Summary
-- =============================================================================

DROP VIEW IF EXISTS v_billing_mrr     CASCADE;
DROP VIEW IF EXISTS v_billing_summary CASCADE;

CREATE OR REPLACE VIEW v_billing_mrr AS
SELECT
  s.id              AS subscription_id,
  s.tenant_id,
  t.nom_entreprise,
  t.secteur_activite AS secteur,
  p.code            AS plan_code,
  p.nom             AS plan_nom,
  p.type            AS plan_type,
  s.statut,
  s.periode,
  s.trial_ends_at,
  s.next_billing_date,
  s.montant_actuel,
  s.montant_addons,
  CASE s.periode
    WHEN 'annuel' THEN ROUND((s.montant_actuel + s.montant_addons) / 12.0, 2)
    ELSE                s.montant_actuel + s.montant_addons
  END AS mrr,
  CASE s.periode
    WHEN 'mensuel' THEN (s.montant_actuel + s.montant_addons) * 12
    ELSE                 s.montant_actuel + s.montant_addons
  END AS arr
FROM  billing_subscriptions s
JOIN  billing_plans p ON p.id = s.plan_id
JOIN  tenants       t ON t.id = s.tenant_id
WHERE s.statut IN ('active','trial','past_due');

CREATE OR REPLACE VIEW v_billing_summary AS
SELECT
  COUNT(*)  FILTER (WHERE statut = 'active')                                                AS actifs,
  COUNT(*)  FILTER (WHERE statut = 'trial')                                                 AS essais,
  COUNT(*)  FILTER (WHERE statut = 'past_due')                                              AS retard,
  COUNT(*)  FILTER (WHERE statut = 'suspended')                                             AS suspendus,
  COUNT(*)  FILTER (WHERE statut = 'cancelled')                                             AS annules,
  COUNT(*)  FILTER (WHERE trial_ends_at IS NOT NULL
                      AND trial_ends_at >= CURRENT_DATE
                      AND statut = 'trial')                                                  AS trials_actifs,
  COUNT(*)  FILTER (WHERE trial_ends_at IS NOT NULL
                      AND trial_ends_at < CURRENT_DATE
                      AND statut = 'trial')                                                  AS trials_expires,
  COALESCE(SUM(CASE
    WHEN statut IN ('active','trial','past_due') AND periode = 'mensuel'
      THEN montant_actuel + montant_addons
    WHEN statut IN ('active','trial','past_due') AND periode = 'annuel'
      THEN ROUND((montant_actuel + montant_addons) / 12.0, 2)
    ELSE 0
  END), 0)                                                                                    AS mrr_total,
  COALESCE(SUM(CASE
    WHEN statut IN ('active','trial','past_due') AND periode = 'mensuel'
      THEN (montant_actuel + montant_addons) * 12
    WHEN statut IN ('active','trial','past_due') AND periode = 'annuel'
      THEN montant_actuel + montant_addons
    ELSE 0
  END), 0)                                                                                    AS arr_total
FROM billing_subscriptions;


-- =============================================================================
-- FIN MIGRATION 062
-- =============================================================================

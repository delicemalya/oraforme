-- ── Migration 023 — Rôles dynamiques + comptes + triggers de sync ────────────

-- ── 1. RÔLES DYNAMIQUES ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS roles (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  description  TEXT,
  color        TEXT NOT NULL DEFAULT '#8B949E',
  -- is_financial = true → ce rôle voit les données financières (Direction, RAF…)
  is_financial BOOLEAN NOT NULL DEFAULT false,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, name)
);

ALTER TABLE roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "roles_read"  ON roles FOR SELECT USING (tenant_id = get_my_tenant_id());
CREATE POLICY "roles_write" ON roles FOR INSERT WITH CHECK (tenant_id = get_my_tenant_id() AND get_my_role() = 'owner');
CREATE POLICY "roles_upd"   ON roles FOR UPDATE USING (tenant_id = get_my_tenant_id() AND get_my_role() = 'owner');
CREATE POLICY "roles_del"   ON roles FOR DELETE USING (tenant_id = get_my_tenant_id() AND get_my_role() = 'owner');

-- ── 2. PERMISSIONS PAR RÔLE (module-based) ───────────────────────────────────

CREATE TABLE IF NOT EXISTS role_permissions (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id    UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  tenant_id  UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  module_key TEXT NOT NULL,
  can_view   BOOLEAN NOT NULL DEFAULT false,
  can_edit   BOOLEAN NOT NULL DEFAULT false,
  can_delete BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(role_id, module_key)
);

ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rp_read"  ON role_permissions FOR SELECT USING (tenant_id = get_my_tenant_id());
CREATE POLICY "rp_write" ON role_permissions FOR INSERT WITH CHECK (tenant_id = get_my_tenant_id() AND get_my_role() = 'owner');
CREATE POLICY "rp_upd"   ON role_permissions FOR UPDATE USING (tenant_id = get_my_tenant_id() AND get_my_role() = 'owner');
CREATE POLICY "rp_del"   ON role_permissions FOR DELETE USING (tenant_id = get_my_tenant_id() AND get_my_role() = 'owner');

-- ── 3. LIER PROFIL → RÔLE DYNAMIQUE ──────────────────────────────────────────

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS dynamic_role_id UUID REFERENCES roles(id) ON DELETE SET NULL;

-- ── 4. COMPTES COMPTABLES (plan comptable OHADA) ──────────────────────────────

CREATE TABLE IF NOT EXISTS accounts (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  number      TEXT NOT NULL,
  type        TEXT NOT NULL CHECK (type IN ('actif', 'passif', 'charge', 'produit', 'tresorerie')),
  balance     NUMERIC(15,2) NOT NULL DEFAULT 0,
  description TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, number)
);

ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "acc_iso" ON accounts FOR ALL
  USING  (tenant_id = get_my_tenant_id())
  WITH CHECK (tenant_id = get_my_tenant_id());

-- ── 5. ENRICHIR LA TABLE TRANSACTIONS ────────────────────────────────────────

-- Champ label (libellé lisible) et account_id (lien compte)
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS label      TEXT;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES accounts(id) ON DELETE SET NULL;

-- Contrainte UNIQUE sur (tenant_id, source, source_id) pour éviter les doublons de sync
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'transactions_source_unique'
  ) THEN
    ALTER TABLE transactions
      ADD CONSTRAINT transactions_source_unique UNIQUE (tenant_id, source, source_id);
  END IF;
END$$;

-- ── 6. TRIGGER : paiement_scolaire (statut → paye) → transaction ─────────────

CREATE OR REPLACE FUNCTION sync_paiement_scolaire_to_transaction()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  -- Déclencher uniquement quand le statut passe à 'paye'
  IF NEW.statut = 'paye' AND (TG_OP = 'INSERT' OR OLD.statut IS DISTINCT FROM 'paye') THEN
    INSERT INTO transactions (
      tenant_id, type, montant, label, description,
      source, source_id, date, mode_paiement
    ) VALUES (
      NEW.tenant_id,
      'entree',
      NEW.montant,
      COALESCE(NEW.libelle, 'Paiement scolaire'),
      'Synchronisation automatique depuis paiements_scolaires',
      'paiements_scolaires',
      NEW.id,
      CURRENT_DATE,
      COALESCE(NEW.methode, 'especes')
    )
    ON CONFLICT (tenant_id, source, source_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_paiement_to_transaction ON paiements_scolaires;
CREATE TRIGGER trg_paiement_to_transaction
  AFTER INSERT OR UPDATE OF statut ON paiements_scolaires
  FOR EACH ROW EXECUTE FUNCTION sync_paiement_scolaire_to_transaction();

-- ── 7. TRIGGER : transaction → journal_comptable (écriture automatique) ───────

CREATE OR REPLACE FUNCTION sync_transaction_to_journal()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_type_journal TEXT;
  v_categorie    TEXT;
BEGIN
  -- Normaliser le type
  IF NEW.type IN ('entree', 'income', 'recette') THEN
    v_type_journal := 'recette';
    v_categorie    := '701 — Prestations éducatives';
  ELSE
    v_type_journal := 'depense';
    v_categorie    := '601 — Achats et charges';
  END IF;

  -- Insérer dans journal_comptable si pas déjà présent
  INSERT INTO journal_comptable (
    tenant_id, date, libelle, type,
    montant_ht, tva, ca, montant_ttc, categorie
  ) VALUES (
    NEW.tenant_id,
    COALESCE(NEW.date::date, CURRENT_DATE),
    COALESCE(NEW.label, NEW.description, NEW.category, 'Transaction'),
    v_type_journal,
    NEW.montant,
    0,
    0,
    NEW.montant,
    v_categorie
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_transaction_to_journal ON transactions;
CREATE TRIGGER trg_transaction_to_journal
  AFTER INSERT ON transactions
  FOR EACH ROW EXECUTE FUNCTION sync_transaction_to_journal();

-- ── 8. TRIGGER : mise à jour solde du compte ──────────────────────────────────

CREATE OR REPLACE FUNCTION update_account_balance()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NEW.account_id IS NOT NULL THEN
    UPDATE accounts
    SET balance = balance +
      CASE
        WHEN NEW.type IN ('entree', 'income', 'recette') THEN  NEW.montant
        ELSE                                                   -NEW.montant
      END
    WHERE id = NEW.account_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_update_account_balance ON transactions;
CREATE TRIGGER trg_update_account_balance
  AFTER INSERT ON transactions
  FOR EACH ROW EXECUTE FUNCTION update_account_balance();

-- ── 9. RÔLES PAR DÉFAUT pour le secteur école ─────────────────────────────────
-- (sera peuplé lors de l'onboarding, ou exécuté manuellement pour les tenants existants)
-- Les rôles standards pour une école :
--   Direction Générale  → is_financial = true
--   RAF                 → is_financial = true
--   Scolarité           → is_financial = false
--   RH                  → is_financial = false
--   Formateur           → is_financial = false

-- ── 10. INDEX pour les performances ──────────────────────────────────────────

CREATE INDEX IF NOT EXISTS roles_tenant_idx          ON roles (tenant_id);
CREATE INDEX IF NOT EXISTS role_permissions_role_idx ON role_permissions (role_id);
CREATE INDEX IF NOT EXISTS accounts_tenant_idx       ON accounts (tenant_id);
CREATE INDEX IF NOT EXISTS transactions_account_idx  ON transactions (account_id);
CREATE INDEX IF NOT EXISTS profiles_dynrole_idx      ON profiles (dynamic_role_id);

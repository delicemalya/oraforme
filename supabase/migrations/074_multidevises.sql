-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 074 — Support multi-devises SYSCOHADA
-- XAF (FCFA) reste la monnaie de présentation (fonctionnelle)
-- Les transactions en devises étrangères sont converties au cours du jour
-- Comptes SYSCOHADA : 776 Gains de change / 676 Pertes de change
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Table des taux de change ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS taux_change (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  devise_source   TEXT NOT NULL,                    -- 'EUR', 'USD', 'GBP', etc.
  devise_cible    TEXT NOT NULL DEFAULT 'XAF',      -- toujours XAF (FCFA)
  taux            NUMERIC(18, 6) NOT NULL,           -- 1 EUR = 655.957 XAF
  date_taux       DATE NOT NULL DEFAULT CURRENT_DATE,
  source_taux     TEXT DEFAULT 'manuel',             -- 'manuel', 'bceao', 'banque_de_france'
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  created_by      UUID,

  CONSTRAINT taux_positive CHECK (taux > 0),
  CONSTRAINT devise_diff   CHECK (devise_source <> devise_cible)
);

-- Index pour lookup rapide
CREATE INDEX IF NOT EXISTS idx_taux_change_lookup
  ON taux_change(tenant_id, devise_source, date_taux DESC);

-- ── 2. Taux BCEAO officiels pré-chargés (parité fixe EUR/XAF) ───────────────
-- Note : le FCFA CFA (XAF) est arrimé à l'euro : 1 EUR = 655.957 XAF exactement

COMMENT ON TABLE taux_change IS
  'Taux de change pour conversions devises → FCFA (XAF). '
  'Taux de référence : 1 EUR = 655.957 XAF (parité fixe BCEAO). '
  'Les autres devises sont cotées via le marché ou la banque centrale.';

-- ── 3. Extension table journal_entries — colonnes devises ────────────────────

ALTER TABLE journal_entries
  ADD COLUMN IF NOT EXISTS devise           TEXT    DEFAULT 'XAF',
  ADD COLUMN IF NOT EXISTS montant_devise   NUMERIC(18, 2),   -- montant dans la devise d'origine
  ADD COLUMN IF NOT EXISTS taux_applique    NUMERIC(18, 6),   -- taux utilisé lors de la saisie
  ADD COLUMN IF NOT EXISTS taux_change_id   UUID REFERENCES taux_change(id) ON DELETE SET NULL;

COMMENT ON COLUMN journal_entries.devise           IS 'Devise de la transaction (XAF par défaut)';
COMMENT ON COLUMN journal_entries.montant_devise   IS 'Montant dans la devise d''origine (si ≠ XAF)';
COMMENT ON COLUMN journal_entries.taux_applique    IS 'Taux de change appliqué lors de la saisie';
COMMENT ON COLUMN journal_entries.taux_change_id   IS 'Référence au taux de change utilisé';

-- ── 4. Index sur la colonne devise ──────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_journal_entries_devise
  ON journal_entries(tenant_id, devise) WHERE devise <> 'XAF';

-- ── 5. Vue devises utilisées par tenant ─────────────────────────────────────

CREATE OR REPLACE VIEW v_devises_utilisees AS
SELECT
  je.tenant_id,
  je.fiscal_year,
  je.devise,
  COUNT(*)                    AS nb_ecritures,
  SUM(je.montant)             AS total_xaf,
  SUM(je.montant_devise)      AS total_devise,
  MIN(je.taux_applique)       AS taux_min,
  MAX(je.taux_applique)       AS taux_max,
  AVG(je.taux_applique)       AS taux_moyen
FROM journal_entries je
WHERE je.devise IS NOT NULL
GROUP BY je.tenant_id, je.fiscal_year, je.devise
ORDER BY je.tenant_id, je.fiscal_year, je.devise;

GRANT SELECT ON v_devises_utilisees TO authenticated, service_role;

-- ── 6. Fonction de conversion devise → XAF ──────────────────────────────────

CREATE OR REPLACE FUNCTION convertir_en_xaf(
  p_montant     NUMERIC,
  p_devise      TEXT,
  p_tenant_id   UUID,
  p_date        DATE DEFAULT CURRENT_DATE
)
RETURNS NUMERIC
LANGUAGE sql STABLE
AS $conv$
  SELECT CASE
    WHEN p_devise = 'XAF' OR p_devise IS NULL THEN p_montant
    ELSE p_montant * (
      SELECT taux FROM taux_change
      WHERE tenant_id   = p_tenant_id
        AND devise_source = p_devise
        AND devise_cible  = 'XAF'
        AND date_taux    <= p_date
      ORDER BY date_taux DESC
      LIMIT 1
    )
  END;
$conv$;

COMMENT ON FUNCTION convertir_en_xaf IS
  'Convertit un montant dans une devise étrangère en XAF (FCFA) '
  'selon le dernier taux de change disponible avant la date donnée.';

GRANT EXECUTE ON FUNCTION convertir_en_xaf(NUMERIC, TEXT, UUID, DATE) TO authenticated, service_role;

-- ── 7. RLS sur taux_change ───────────────────────────────────────────────────

ALTER TABLE taux_change ENABLE ROW LEVEL SECURITY;

CREATE POLICY "taux_change_tenant_isolation" ON taux_change
  FOR ALL USING (tenant_id = (
    SELECT tenant_id FROM profiles
    WHERE id = auth.uid()
    ORDER BY created_at ASC LIMIT 1
  ));

-- ── 8. Devises SYSCOHADA supportées (référence) ──────────────────────────────
-- XAF (FCFA CFA) — monnaie de présentation et fonctionnelle
-- EUR — Euro (parité fixe 1 EUR = 655.957 XAF depuis 1999)
-- USD — Dollar américain
-- GBP — Livre sterling
-- CNY — Yuan chinois
-- CHF — Franc suisse
-- XOF — FCFA Ouest-africain (même valeur que XAF depuis 1994 : 1 XOF = 1 XAF)

-- Taux de référence courants à insérer manuellement ou via API :
-- INSERT INTO taux_change (tenant_id, devise_source, taux, source_taux)
-- VALUES ('YOUR_TENANT_ID', 'EUR', 655.957, 'bceao');   -- Parité fixe
-- VALUES ('YOUR_TENANT_ID', 'USD', 598.50,  'bceao');   -- Variable

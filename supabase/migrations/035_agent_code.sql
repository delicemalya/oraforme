-- ── Migration 035 — Agent code auto-generation ───────────────────────────────
-- Format : <COMPANY_PREFIX>-<YEAR>-<CITY>-<SEQUENCE>
-- Example: ORA-2026-PNR-0001  (PNR = Pointe-Noire, BZV = Brazzaville)

-- ── 1. Add ville column to employes ──────────────────────────────────────────
ALTER TABLE employes ADD COLUMN IF NOT EXISTS ville TEXT DEFAULT 'PNR';

-- ── 2. Agent-code generator ───────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION fn_generate_agent_code(
  p_tenant_id UUID,
  p_city      TEXT DEFAULT 'PNR'
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_prefix TEXT;
  v_year   TEXT;
  v_city   TEXT;
  v_seq    INT;
BEGIN
  -- Build 3-letter prefix from company name (letters only, uppercased)
  SELECT UPPER(LEFT(REGEXP_REPLACE(COALESCE(nom_entreprise, 'ORA'), '[^A-Za-z]', '', 'g'), 3))
  INTO v_prefix
  FROM tenants
  WHERE id = p_tenant_id;

  IF v_prefix IS NULL OR v_prefix = '' THEN v_prefix := 'ORA'; END IF;

  v_year := EXTRACT(YEAR FROM NOW())::TEXT;
  v_city := UPPER(COALESCE(NULLIF(p_city, ''), 'PNR'));

  -- Sequence = max existing sequence for this prefix/year/city + 1
  SELECT COALESCE(
    MAX(CAST(RIGHT(agent_code, 4) AS INTEGER)),
    0
  ) + 1
  INTO v_seq
  FROM employes
  WHERE tenant_id = p_tenant_id
    AND agent_code ~ ('^' || v_prefix || '-' || v_year || '-' || v_city || '-[0-9]{4}$');

  RETURN v_prefix || '-' || v_year || '-' || v_city || '-' || LPAD(v_seq::TEXT, 4, '0');
END;
$$;

-- ── 3. Trigger function ───────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION trg_fn_employe_agent_code()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.agent_code IS NULL OR NEW.agent_code = '' THEN
    NEW.agent_code := fn_generate_agent_code(NEW.tenant_id, COALESCE(NEW.ville, 'PNR'));
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_employe_agent_code ON employes;
CREATE TRIGGER trg_employe_agent_code
  BEFORE INSERT ON employes
  FOR EACH ROW EXECUTE FUNCTION trg_fn_employe_agent_code();

-- ── 4. Back-fill existing employees that have no agent_code ──────────────────
DO $$
DECLARE
  rec RECORD;
BEGIN
  FOR rec IN
    SELECT id, tenant_id, ville
    FROM employes
    WHERE agent_code IS NULL OR agent_code = ''
    ORDER BY created_at
  LOOP
    UPDATE employes
    SET agent_code = fn_generate_agent_code(rec.tenant_id, COALESCE(rec.ville, 'PNR'))
    WHERE id = rec.id;
  END LOOP;
END;
$$;

-- 037: create staff_ecole table (agents non-enseignants) with full profile fields
CREATE TABLE IF NOT EXISTS staff_ecole (
  id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id            UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  nom                  TEXT        NOT NULL,
  prenom               TEXT        NOT NULL DEFAULT '',
  poste                TEXT        NOT NULL,
  telephone            TEXT        DEFAULT NULL,
  email                TEXT        DEFAULT NULL,
  salaire              INTEGER     NOT NULL DEFAULT 0,
  statut               TEXT        NOT NULL DEFAULT 'actif',
  photo_url            TEXT        DEFAULT NULL,
  mobile_money_type    TEXT        DEFAULT NULL,
  mobile_money_numero  TEXT        DEFAULT NULL,
  banque               TEXT        DEFAULT NULL,
  rib                  TEXT        DEFAULT NULL,
  numero_cnss          TEXT        DEFAULT NULL,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS
ALTER TABLE staff_ecole ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation_staff_ecole" ON staff_ecole
  USING (tenant_id = (
    SELECT tenant_id FROM profiles WHERE id = auth.uid()
  ))
  WITH CHECK (tenant_id = (
    SELECT tenant_id FROM profiles WHERE id = auth.uid()
  ));

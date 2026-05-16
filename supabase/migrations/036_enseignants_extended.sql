-- 036: extend enseignants table with payment, banking and social info
ALTER TABLE enseignants
  ADD COLUMN IF NOT EXISTS photo_url         TEXT    DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS salaire_mensuel   INTEGER DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS taux_horaire      INTEGER DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS mobile_money_type TEXT    DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS mobile_money_numero TEXT  DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS banque            TEXT    DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS rib               TEXT    DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS numero_cnss       TEXT    DEFAULT NULL;

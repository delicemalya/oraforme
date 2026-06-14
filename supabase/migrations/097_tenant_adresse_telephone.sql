-- ============================================================
-- 097 — Colonnes adresse + telephone sur tenants
-- Requises par ProfilCompletionPopup / profil/actions.ts
-- ============================================================

ALTER TABLE tenants ADD COLUMN IF NOT EXISTS adresse   TEXT;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS telephone TEXT;

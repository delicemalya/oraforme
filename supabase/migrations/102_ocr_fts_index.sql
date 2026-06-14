-- ============================================================
-- Migration 102 — Index GIN FTS sur ocr_text seul
-- Permet à la requête plfts(french) d'utiliser un index GIN
-- au lieu d'un seq scan, rendant la recherche documentaire 10-100× plus rapide.
-- ============================================================

-- Index GIN sur ocr_text seul (utilisé par searchDocuments avec plfts)
CREATE INDEX IF NOT EXISTS idx_documents_ocr_text_gin
  ON documents USING gin(to_tsvector('french', COALESCE(ocr_text, '')));

-- Index GIN sur nom seul (complément pour la recherche par nom)
CREATE INDEX IF NOT EXISTS idx_documents_nom_gin
  ON documents USING gin(to_tsvector('french', COALESCE(nom, '')));

-- Index sur statut + tenant_id + created_at pour les filtres courants
CREATE INDEX IF NOT EXISTS idx_documents_statut_date
  ON documents(tenant_id, statut, created_at DESC)
  WHERE statut NOT IN ('supprime');

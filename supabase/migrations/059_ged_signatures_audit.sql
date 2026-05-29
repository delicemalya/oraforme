-- ============================================================
-- Migration 059 — GED (Gestion Électronique des Documents),
--                Signatures Électroniques & Audit Trail Global
-- ============================================================
-- Idempotente : IF NOT EXISTS / OR REPLACE / DO $$ EXCEPTION $$
-- Prérequis   : get_my_tenant_id(), get_my_role(), fn_is_owner()
--               Tables : tenants, auth.users
-- ============================================================

-- ============================================================
-- SECTION 1 — TABLE documents (GED centrale)
-- ============================================================

CREATE TABLE IF NOT EXISTS documents (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  dossier_id       UUID,                    -- FK vers document_dossiers (ajoutée en section 2)
  nom              TEXT        NOT NULL,
  description      TEXT,
  type             TEXT        NOT NULL DEFAULT 'autre'
                               CHECK (type IN (
                                 'pdf','doc','docx','xls','xlsx',
                                 'png','jpg','jpeg','autre'
                               )),
  categorie        TEXT        NOT NULL DEFAULT 'autre'
                               CHECK (categorie IN (
                                 'contrat','facture','rh','comptabilite',
                                 'juridique','commercial','technique','autre',
                                 'bulletin','diplome','attestation'
                               )),
  url              TEXT,                    -- URL Supabase Storage ou lien externe
  storage_path     TEXT,                    -- Chemin interne Supabase Storage
  taille_ko        INTEGER,
  statut           TEXT        NOT NULL DEFAULT 'actif'
                               CHECK (statut IN ('actif','archive','supprime')),
  est_favori       BOOLEAN     NOT NULL DEFAULT FALSE,
  confidentiel     BOOLEAN     NOT NULL DEFAULT FALSE,
  date_document    DATE,
  date_expiration  DATE,
  tags             TEXT[]      NOT NULL DEFAULT '{}',
  -- Liens vers les modules métier
  source_module    TEXT,       -- 'rh' | 'facturation' | 'devis' | 'ecole' | 'comptabilite' | 'crm'
  source_id        UUID,       -- ID de l'entité liée (facture_id, employe_id, etc.)
  -- Métadonnées auteur
  created_by       UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by       UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

-- Policies RLS — documents
DO $$ BEGIN
  CREATE POLICY "doc_select" ON documents
    FOR SELECT USING (tenant_id = get_my_tenant_id());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "doc_insert" ON documents
    FOR INSERT WITH CHECK (tenant_id = get_my_tenant_id());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "doc_update" ON documents
    FOR UPDATE USING (tenant_id = get_my_tenant_id())
               WITH CHECK (tenant_id = get_my_tenant_id());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "doc_delete" ON documents
    FOR DELETE USING (tenant_id = get_my_tenant_id());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Index — documents
CREATE INDEX IF NOT EXISTS idx_doc_tenant     ON documents(tenant_id);
CREATE INDEX IF NOT EXISTS idx_doc_dossier    ON documents(dossier_id);
CREATE INDEX IF NOT EXISTS idx_doc_categorie  ON documents(tenant_id, categorie);
CREATE INDEX IF NOT EXISTS idx_doc_statut     ON documents(tenant_id, statut);
CREATE INDEX IF NOT EXISTS idx_doc_source     ON documents(source_module, source_id);
CREATE INDEX IF NOT EXISTS idx_doc_favori     ON documents(tenant_id, est_favori)
  WHERE est_favori = TRUE;
CREATE INDEX IF NOT EXISTS idx_doc_expiration ON documents(date_expiration)
  WHERE date_expiration IS NOT NULL;
-- Recherche fulltext (French) sur nom + description
CREATE INDEX IF NOT EXISTS idx_doc_search     ON documents
  USING gin(to_tsvector('french', coalesce(nom,'') || ' ' || coalesce(description,'')));

-- Trigger updated_at — documents
CREATE OR REPLACE FUNCTION fn_documents_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_documents_updated_at ON documents;
CREATE TRIGGER trg_documents_updated_at
  BEFORE UPDATE ON documents
  FOR EACH ROW EXECUTE FUNCTION fn_documents_updated_at();


-- ============================================================
-- SECTION 2 — TABLE document_dossiers (arborescence)
-- ============================================================

CREATE TABLE IF NOT EXISTS document_dossiers (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  parent_id   UUID        REFERENCES document_dossiers(id) ON DELETE CASCADE,
  nom         TEXT        NOT NULL,
  description TEXT,
  couleur     TEXT        DEFAULT '#DC2626',  -- couleur hex d'affichage du dossier
  icone       TEXT        DEFAULT 'folder',
  ordre       INTEGER     NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- FK dossier_id dans documents (ajoutée ici car document_dossiers vient d'être créée)
DO $$
BEGIN
  ALTER TABLE documents
    ADD CONSTRAINT fk_documents_dossier
    FOREIGN KEY (dossier_id)
    REFERENCES document_dossiers(id)
    ON DELETE SET NULL
    NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE document_dossiers ENABLE ROW LEVEL SECURITY;

-- Policies RLS — document_dossiers
DO $$ BEGIN
  CREATE POLICY "dossier_select" ON document_dossiers
    FOR SELECT USING (tenant_id = get_my_tenant_id());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "dossier_insert" ON document_dossiers
    FOR INSERT WITH CHECK (tenant_id = get_my_tenant_id());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "dossier_update" ON document_dossiers
    FOR UPDATE USING (tenant_id = get_my_tenant_id())
               WITH CHECK (tenant_id = get_my_tenant_id());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "dossier_delete" ON document_dossiers
    FOR DELETE USING (tenant_id = get_my_tenant_id());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Index — document_dossiers
CREATE INDEX IF NOT EXISTS idx_dossier_tenant ON document_dossiers(tenant_id);
CREATE INDEX IF NOT EXISTS idx_dossier_parent ON document_dossiers(parent_id);


-- ============================================================
-- SECTION 3 — TABLE document_signatures
-- ============================================================

CREATE TABLE IF NOT EXISTS document_signatures (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  document_id     UUID        NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  signataire_id   UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  signataire_nom  TEXT        NOT NULL,
  signataire_role TEXT,
  signature_data  TEXT,       -- data:image/png;base64,... (export canvas)
  signature_type  TEXT        NOT NULL DEFAULT 'manuscrite'
                              CHECK (signature_type IN ('manuscrite','image','validation')),
  statut          TEXT        NOT NULL DEFAULT 'en_attente'
                              CHECK (statut IN ('en_attente','signe','refuse','expire')),
  date_signature  TIMESTAMPTZ,
  date_expiration TIMESTAMPTZ,
  ip_address      TEXT,
  commentaire     TEXT,
  ordre           INTEGER     NOT NULL DEFAULT 1,  -- ordre dans un workflow multi-signataires
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE document_signatures ENABLE ROW LEVEL SECURITY;

-- Policies RLS — document_signatures
DO $$ BEGIN
  CREATE POLICY "sig_select" ON document_signatures
    FOR SELECT USING (tenant_id = get_my_tenant_id());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "sig_insert" ON document_signatures
    FOR INSERT WITH CHECK (tenant_id = get_my_tenant_id());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "sig_update" ON document_signatures
    FOR UPDATE USING (tenant_id = get_my_tenant_id())
               WITH CHECK (tenant_id = get_my_tenant_id());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Index — document_signatures
CREATE INDEX IF NOT EXISTS idx_sig_document ON document_signatures(document_id);
CREATE INDEX IF NOT EXISTS idx_sig_tenant   ON document_signatures(tenant_id);
CREATE INDEX IF NOT EXISTS idx_sig_statut   ON document_signatures(statut, tenant_id);


-- ============================================================
-- SECTION 4 — TABLE global_audit_trail (audit enterprise)
-- ============================================================

CREATE TABLE IF NOT EXISTS global_audit_trail (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id         UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  user_email      TEXT,
  user_role       TEXT,
  -- Action effectuée
  -- Valeurs : CREATE | UPDATE | DELETE | VIEW | EXPORT | SIGN | LOGIN | LOGOUT | UPLOAD | DOWNLOAD
  action          TEXT        NOT NULL,
  -- Module métier
  -- Valeurs : finance | rh | ecole | ged | facturation | tresorerie | stocks |
  --           comptabilite | audit | permissions | system
  module          TEXT        NOT NULL,
  entite          TEXT,       -- Nom de la table / entité (ex: 'factures', 'employes', 'documents')
  entite_id       UUID,       -- ID de l'entité concernée
  entite_label    TEXT,       -- Libellé humain (ex: 'Facture FAC-2026-0001')
  -- Snapshot avant/après modification
  ancien_valeur   JSONB,      -- État avant
  nouvelle_valeur JSONB,      -- État après
  -- Contexte réseau / session
  ip_address      TEXT,
  user_agent      TEXT,
  session_id      TEXT,
  -- Niveau de criticité : info | warning | critical | error
  niveau          TEXT        NOT NULL DEFAULT 'info'
                              CHECK (niveau IN ('info','warning','critical','error')),
  -- Métadonnées libres
  details         JSONB,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE global_audit_trail ENABLE ROW LEVEL SECURITY;

-- Lecture : tous les utilisateurs du tenant (filtrage fin possible côté app)
DO $$ BEGIN
  CREATE POLICY "gat_select" ON global_audit_trail
    FOR SELECT USING (tenant_id = get_my_tenant_id());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- INSERT : intentionnellement sans policy client directe.
-- Toutes les écritures passent par fn_audit_log() SECURITY DEFINER.

-- Index — global_audit_trail
CREATE INDEX IF NOT EXISTS idx_gat_tenant  ON global_audit_trail(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_gat_module  ON global_audit_trail(tenant_id, module);
CREATE INDEX IF NOT EXISTS idx_gat_user    ON global_audit_trail(user_id);
CREATE INDEX IF NOT EXISTS idx_gat_entite  ON global_audit_trail(entite, entite_id);
CREATE INDEX IF NOT EXISTS idx_gat_niveau  ON global_audit_trail(niveau)
  WHERE niveau IN ('warning','critical','error');
CREATE INDEX IF NOT EXISTS idx_gat_action  ON global_audit_trail(action, tenant_id);


-- ============================================================
-- SECTION 5 — FONCTION fn_audit_log (SECURITY DEFINER)
-- ============================================================
-- Toute insertion dans global_audit_trail passe par cette fonction.
-- SECURITY DEFINER permet d'écrire dans la table même sans policy INSERT cliente.

CREATE OR REPLACE FUNCTION fn_audit_log(
  p_tenant_id       UUID,
  p_action          TEXT,
  p_module          TEXT,
  p_entite          TEXT        DEFAULT NULL,
  p_entite_id       UUID        DEFAULT NULL,
  p_entite_label    TEXT        DEFAULT NULL,
  p_ancien_valeur   JSONB       DEFAULT NULL,
  p_nouvelle_valeur JSONB       DEFAULT NULL,
  p_niveau          TEXT        DEFAULT 'info',
  p_details         JSONB       DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO global_audit_trail (
    tenant_id,
    user_id,
    user_email,
    user_role,
    action,
    module,
    entite,
    entite_id,
    entite_label,
    ancien_valeur,
    nouvelle_valeur,
    niveau,
    details
  ) VALUES (
    p_tenant_id,
    auth.uid(),
    (SELECT email FROM auth.users WHERE id = auth.uid()),
    get_my_role(),
    p_action,
    p_module,
    p_entite,
    p_entite_id,
    p_entite_label,
    p_ancien_valeur,
    p_nouvelle_valeur,
    p_niveau,
    p_details
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;


-- ============================================================
-- SECTION 6 — TRIGGERS AUTO-AUDIT sur tables critiques
-- ============================================================
-- Pattern : AFTER INSERT OR UPDATE OR DELETE
--           → fn_audit_log() avec le bon module / niveau.
-- SECURITY DEFINER sur chaque fonction trigger pour garantir
-- l'écriture dans global_audit_trail même sans policy INSERT client.

-- ----------------------------------------
-- 6.1 — factures
-- ----------------------------------------
CREATE OR REPLACE FUNCTION fn_audit_factures()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM fn_audit_log(
      NEW.tenant_id, 'CREATE', 'facturation', 'factures', NEW.id,
      COALESCE(NEW.invoice_number, NEW.id::TEXT),
      NULL, to_jsonb(NEW), 'info', NULL
    );
  ELSIF TG_OP = 'UPDATE' THEN
    PERFORM fn_audit_log(
      NEW.tenant_id, 'UPDATE', 'facturation', 'factures', NEW.id,
      COALESCE(NEW.invoice_number, NEW.id::TEXT),
      to_jsonb(OLD), to_jsonb(NEW),
      CASE WHEN OLD.statut <> NEW.statut THEN 'warning' ELSE 'info' END,
      NULL
    );
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM fn_audit_log(
      OLD.tenant_id, 'DELETE', 'facturation', 'factures', OLD.id,
      COALESCE(OLD.invoice_number, OLD.id::TEXT),
      to_jsonb(OLD), NULL, 'warning', NULL
    );
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_factures ON factures;
CREATE TRIGGER trg_audit_factures
  AFTER INSERT OR UPDATE OR DELETE ON factures
  FOR EACH ROW EXECUTE FUNCTION fn_audit_factures();


-- ----------------------------------------
-- 6.2 — paiements_factures
-- ----------------------------------------
CREATE OR REPLACE FUNCTION fn_audit_paiements_factures()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM fn_audit_log(
      NEW.tenant_id, 'PAYMENT', 'facturation', 'paiements_factures', NEW.id,
      NEW.id::TEXT,
      NULL, to_jsonb(NEW), 'warning', NULL
    );
  ELSIF TG_OP = 'UPDATE' THEN
    PERFORM fn_audit_log(
      NEW.tenant_id, 'PAYMENT', 'facturation', 'paiements_factures', NEW.id,
      NEW.id::TEXT,
      to_jsonb(OLD), to_jsonb(NEW), 'warning', NULL
    );
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM fn_audit_log(
      OLD.tenant_id, 'DELETE', 'facturation', 'paiements_factures', OLD.id,
      OLD.id::TEXT,
      to_jsonb(OLD), NULL, 'warning', NULL
    );
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_paiements_factures ON paiements_factures;
CREATE TRIGGER trg_audit_paiements_factures
  AFTER INSERT OR UPDATE OR DELETE ON paiements_factures
  FOR EACH ROW EXECUTE FUNCTION fn_audit_paiements_factures();


-- ----------------------------------------
-- 6.3 — devis
-- ----------------------------------------
CREATE OR REPLACE FUNCTION fn_audit_devis()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM fn_audit_log(
      NEW.tenant_id, 'CREATE', 'facturation', 'devis', NEW.id,
      COALESCE(NEW.devis_number, NEW.id::TEXT),
      NULL, to_jsonb(NEW), 'info', NULL
    );
  ELSIF TG_OP = 'UPDATE' THEN
    PERFORM fn_audit_log(
      NEW.tenant_id, 'UPDATE', 'facturation', 'devis', NEW.id,
      COALESCE(NEW.devis_number, NEW.id::TEXT),
      to_jsonb(OLD), to_jsonb(NEW),
      CASE WHEN OLD.statut <> NEW.statut THEN 'warning' ELSE 'info' END,
      NULL
    );
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM fn_audit_log(
      OLD.tenant_id, 'DELETE', 'facturation', 'devis', OLD.id,
      COALESCE(OLD.numero, OLD.id::TEXT),
      to_jsonb(OLD), NULL, 'warning', NULL
    );
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_devis ON devis;
CREATE TRIGGER trg_audit_devis
  AFTER INSERT OR UPDATE OR DELETE ON devis
  FOR EACH ROW EXECUTE FUNCTION fn_audit_devis();


-- ----------------------------------------
-- 6.4 — documents (GED)
-- ----------------------------------------
CREATE OR REPLACE FUNCTION fn_audit_documents()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM fn_audit_log(
      NEW.tenant_id, 'CREATE', 'ged', 'documents', NEW.id,
      NEW.nom,
      NULL, to_jsonb(NEW), 'info', NULL
    );
  ELSIF TG_OP = 'UPDATE' THEN
    PERFORM fn_audit_log(
      NEW.tenant_id, 'UPDATE', 'ged', 'documents', NEW.id,
      NEW.nom,
      to_jsonb(OLD), to_jsonb(NEW),
      CASE WHEN OLD.statut <> NEW.statut THEN 'warning' ELSE 'info' END,
      NULL
    );
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM fn_audit_log(
      OLD.tenant_id, 'DELETE', 'ged', 'documents', OLD.id,
      OLD.nom,
      to_jsonb(OLD), NULL, 'warning', NULL
    );
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_documents ON documents;
CREATE TRIGGER trg_audit_documents
  AFTER INSERT OR UPDATE OR DELETE ON documents
  FOR EACH ROW EXECUTE FUNCTION fn_audit_documents();


-- ----------------------------------------
-- 6.5 — document_signatures
--        niveau='critical' pour toute action SIGN
-- ----------------------------------------
CREATE OR REPLACE FUNCTION fn_audit_document_signatures()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM fn_audit_log(
      NEW.tenant_id, 'SIGN', 'ged', 'document_signatures', NEW.id,
      NEW.signataire_nom,
      NULL, to_jsonb(NEW), 'critical', NULL
    );
  ELSIF TG_OP = 'UPDATE' THEN
    -- Mise à jour du statut de signature (ex: en_attente → signe | refuse)
    PERFORM fn_audit_log(
      NEW.tenant_id, 'SIGN', 'ged', 'document_signatures', NEW.id,
      NEW.signataire_nom,
      to_jsonb(OLD), to_jsonb(NEW), 'critical', NULL
    );
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM fn_audit_log(
      OLD.tenant_id, 'DELETE', 'ged', 'document_signatures', OLD.id,
      OLD.signataire_nom,
      to_jsonb(OLD), NULL, 'critical', NULL
    );
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_document_signatures ON document_signatures;
CREATE TRIGGER trg_audit_document_signatures
  AFTER INSERT OR UPDATE OR DELETE ON document_signatures
  FOR EACH ROW EXECUTE FUNCTION fn_audit_document_signatures();


-- ----------------------------------------
-- 6.6 — employes (RH)
-- ----------------------------------------
CREATE OR REPLACE FUNCTION fn_audit_employes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM fn_audit_log(
      NEW.tenant_id, 'CREATE', 'rh', 'employes', NEW.id,
      COALESCE(NEW.prenom || ' ' || NEW.nom, NEW.id::TEXT),
      NULL, to_jsonb(NEW), 'info', NULL
    );
  ELSIF TG_OP = 'UPDATE' THEN
    PERFORM fn_audit_log(
      NEW.tenant_id, 'UPDATE', 'rh', 'employes', NEW.id,
      COALESCE(NEW.prenom || ' ' || NEW.nom, NEW.id::TEXT),
      to_jsonb(OLD), to_jsonb(NEW),
      CASE WHEN OLD.statut <> NEW.statut THEN 'warning' ELSE 'info' END,
      NULL
    );
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM fn_audit_log(
      OLD.tenant_id, 'DELETE', 'rh', 'employes', OLD.id,
      COALESCE(OLD.prenom || ' ' || OLD.nom, OLD.id::TEXT),
      to_jsonb(OLD), NULL, 'warning', NULL
    );
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_employes ON employes;
CREATE TRIGGER trg_audit_employes
  AFTER INSERT OR UPDATE OR DELETE ON employes
  FOR EACH ROW EXECUTE FUNCTION fn_audit_employes();


-- ============================================================
-- SECTION 7 — FONCTION fn_search_documents (recherche fulltext)
-- ============================================================
-- Recherche fulltext en français sur nom + description.
-- SECURITY DEFINER : s'exécute avec les droits du propriétaire,
-- mais filtre toujours sur p_tenant_id pour éviter tout cross-tenant.

CREATE OR REPLACE FUNCTION fn_search_documents(
  p_tenant_id UUID,
  p_query     TEXT,
  p_limit     INT DEFAULT 20
)
RETURNS TABLE (
  id         UUID,
  nom        TEXT,
  categorie  TEXT,
  type       TEXT,
  url        TEXT,
  statut     TEXT,
  created_at TIMESTAMPTZ,
  rank       REAL
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    d.id,
    d.nom,
    d.categorie,
    d.type,
    d.url,
    d.statut,
    d.created_at,
    ts_rank(
      to_tsvector('french', coalesce(d.nom,'') || ' ' || coalesce(d.description,'')),
      plainto_tsquery('french', p_query)
    ) AS rank
  FROM documents d
  WHERE d.tenant_id = p_tenant_id
    AND d.statut    = 'actif'
    AND to_tsvector('french', coalesce(d.nom,'') || ' ' || coalesce(d.description,''))
        @@ plainto_tsquery('french', p_query)
  ORDER BY rank DESC
  LIMIT p_limit;
END;
$$;

-- ============================================================
-- FIN DE LA MIGRATION 059
-- ============================================================

-- ═══════════════════════════════════════════════════════════════════════════
-- MIGRATION 080 — CABINET PREMIUM : SWITCH TENANT + DÉCLARATIONS + DEVISES
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. Enrichir cabinet_clients avec type_compte + devises ───────────────────
ALTER TABLE cabinet_clients
  ADD COLUMN IF NOT EXISTS type_compte TEXT DEFAULT 'comptable'
    CHECK (type_compte IN ('comptable','fiscal','audit','conseil','juridique','mixte')),
  ADD COLUMN IF NOT EXISTS sous_type TEXT,
  ADD COLUMN IF NOT EXISTS devise_locale TEXT DEFAULT 'XAF',
  ADD COLUMN IF NOT EXISTS responsable_interne TEXT,
  ADD COLUMN IF NOT EXISTS taille_entreprise TEXT
    CHECK (taille_entreprise IN ('tpe','pme','eti','grande','administration','ong')),
  ADD COLUMN IF NOT EXISTS numero_contribuable TEXT,
  ADD COLUMN IF NOT EXISTS regime_fiscal TEXT
    CHECK (regime_fiscal IN ('reel','simplifie','forfait','microentreprise')),
  ADD COLUMN IF NOT EXISTS exercice_debut_mois INTEGER DEFAULT 1
    CHECK (exercice_debut_mois BETWEEN 1 AND 12);

-- ── 2. Sessions switch-tenant (cabinet entre dans le compte client) ───────────
-- Le cabinet peut "entrer" dans l'espace d'un client sans déconnexion.
-- Le token est stocké dans le localStorage + cookie httpOnly côté client.
CREATE TABLE IF NOT EXISTS cabinet_switch_sessions (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cabinet_tenant_id    UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  cabinet_user_id      UUID NOT NULL,
  client_id            UUID NOT NULL REFERENCES cabinet_clients(id) ON DELETE CASCADE,

  -- Le tenant cible du client (si le client a un compte Oraforme)
  client_tenant_id     UUID REFERENCES tenants(id) ON DELETE CASCADE,

  -- Token opaque pour valider les requêtes proxy
  session_token        TEXT NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),

  -- Durée de vie : 8h max
  expires_at           TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '8 hours'),
  revoked_at           TIMESTAMPTZ,

  -- Audit
  ip_address           TEXT,
  user_agent           TEXT,
  created_at           TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE cabinet_switch_sessions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "switch_sessions_policy" ON cabinet_switch_sessions;
CREATE POLICY "switch_sessions_policy" ON cabinet_switch_sessions FOR ALL
  USING (cabinet_tenant_id = get_my_tenant_id());

CREATE INDEX IF NOT EXISTS idx_switch_sessions_token  ON cabinet_switch_sessions(session_token) WHERE revoked_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_switch_sessions_client ON cabinet_switch_sessions(client_id, expires_at);

-- ── 3. Agenda déclarations fiscales / sociales ────────────────────────────────
-- Centralize toutes les déclarations à faire pour tous les clients du cabinet
CREATE TABLE IF NOT EXISTS cabinet_declarations_agenda (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cabinet_tenant_id    UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  client_id            UUID NOT NULL REFERENCES cabinet_clients(id) ON DELETE CASCADE,

  type_declaration     TEXT NOT NULL
    CHECK (type_declaration IN (
      'tva_mensuelle','tva_trimestrielle','cnss_mensuelle','cnss_trimestrielle',
      'irpp_annuel','is_annuel','is_acompte','patente_annuelle',
      'bilan_annuel','compte_resultat','declaration_loyer','retenue_source','autre'
    )),

  periode_mois         INTEGER,
  periode_annee        INTEGER NOT NULL,
  date_limite          DATE NOT NULL,
  date_soumise         DATE,
  montant_declare      NUMERIC(15,0),
  montant_paye         NUMERIC(15,0),

  statut               TEXT DEFAULT 'a_faire'
    CHECK (statut IN ('a_faire','en_cours','soumise','payee','retard','annulee')),

  reference_externe    TEXT,
  notes                TEXT,
  alerte_j_avant       INTEGER DEFAULT 7,

  created_at           TIMESTAMPTZ DEFAULT NOW(),
  updated_at           TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE cabinet_declarations_agenda ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "declarations_agenda_policy" ON cabinet_declarations_agenda;
CREATE POLICY "declarations_agenda_policy" ON cabinet_declarations_agenda FOR ALL
  USING (cabinet_tenant_id = get_my_tenant_id());

CREATE INDEX IF NOT EXISTS idx_decl_agenda_client   ON cabinet_declarations_agenda(client_id, date_limite);
CREATE INDEX IF NOT EXISTS idx_decl_agenda_statut   ON cabinet_declarations_agenda(cabinet_tenant_id, statut, date_limite);
CREATE INDEX IF NOT EXISTS idx_decl_agenda_retard   ON cabinet_declarations_agenda(cabinet_tenant_id, type_declaration)
  WHERE statut IN ('a_faire','en_cours','retard') AND date_limite < CURRENT_DATE;

-- ── 4. Revenue multi-devises ─────────────────────────────────────────────────
ALTER TABLE oraforme_revenue
  ADD COLUMN IF NOT EXISTS devise TEXT DEFAULT 'XAF',
  ADD COLUMN IF NOT EXISTS montant_devise_locale NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS taux_change NUMERIC(10,4) DEFAULT 1.0;

-- ── 5. Vue globale déclarations urgentes ─────────────────────────────────────
CREATE OR REPLACE VIEW cabinet_declarations_urgentes AS
SELECT
  d.*,
  c.nom_entreprise,
  c.cabinet_tenant_id,
  CURRENT_DATE - d.date_limite AS jours_retard,
  CASE
    WHEN d.date_limite < CURRENT_DATE THEN 'retard'
    WHEN d.date_limite <= CURRENT_DATE + 3  THEN 'critique'
    WHEN d.date_limite <= CURRENT_DATE + 7  THEN 'urgent'
    WHEN d.date_limite <= CURRENT_DATE + 15 THEN 'attention'
    ELSE 'ok'
  END AS niveau_urgence
FROM cabinet_declarations_agenda d
JOIN cabinet_clients c ON d.client_id = c.id
WHERE d.statut IN ('a_faire','en_cours','retard')
ORDER BY d.date_limite ASC;

-- ── 6. Fonction : générer agenda déclarations automatique ────────────────────
CREATE OR REPLACE FUNCTION generer_agenda_declarations(
  p_cabinet_tenant_id UUID,
  p_annee             INTEGER
) RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER := 0;
  r RECORD;
  v_mois INTEGER;
BEGIN
  FOR r IN
    SELECT id, types_mission, pays, regime_fiscal
    FROM cabinet_clients
    WHERE cabinet_tenant_id = p_cabinet_tenant_id
      AND statut IN ('actif','prospect')
  LOOP
    -- TVA mensuelle (si mission TVA)
    IF 'tva' = ANY(r.types_mission) THEN
      FOR v_mois IN 1..12 LOOP
        INSERT INTO cabinet_declarations_agenda (
          cabinet_tenant_id, client_id, type_declaration,
          periode_mois, periode_annee, date_limite, statut
        ) VALUES (
          p_cabinet_tenant_id, r.id, 'tva_mensuelle',
          v_mois, p_annee,
          MAKE_DATE(p_annee, v_mois, 15) + INTERVAL '1 month' * 1,
          'a_faire'
        ) ON CONFLICT DO NOTHING;
        v_count := v_count + 1;
      END LOOP;
    END IF;

    -- CNSS mensuelle (si mission paie_rh)
    IF 'paie_rh' = ANY(r.types_mission) THEN
      FOR v_mois IN 1..12 LOOP
        INSERT INTO cabinet_declarations_agenda (
          cabinet_tenant_id, client_id, type_declaration,
          periode_mois, periode_annee, date_limite, statut
        ) VALUES (
          p_cabinet_tenant_id, r.id, 'cnss_mensuelle',
          v_mois, p_annee,
          MAKE_DATE(p_annee, LEAST(v_mois + 1, 12), 20),
          'a_faire'
        ) ON CONFLICT DO NOTHING;
        v_count := v_count + 1;
      END LOOP;
    END IF;

    -- IS annuel
    IF 'is' = ANY(r.types_mission) THEN
      INSERT INTO cabinet_declarations_agenda (
        cabinet_tenant_id, client_id, type_declaration,
        periode_annee, date_limite, statut
      ) VALUES (
        p_cabinet_tenant_id, r.id, 'is_annuel',
        p_annee - 1, MAKE_DATE(p_annee, 3, 31), 'a_faire'
      ) ON CONFLICT DO NOTHING;
      v_count := v_count + 1;
    END IF;

    -- Patente annuelle
    IF 'patente' = ANY(r.types_mission) THEN
      INSERT INTO cabinet_declarations_agenda (
        cabinet_tenant_id, client_id, type_declaration,
        periode_annee, date_limite, statut
      ) VALUES (
        p_cabinet_tenant_id, r.id, 'patente_annuelle',
        p_annee, MAKE_DATE(p_annee, 2, 28), 'a_faire'
      ) ON CONFLICT DO NOTHING;
      v_count := v_count + 1;
    END IF;

    -- Bilan annuel
    IF 'comptabilite' = ANY(r.types_mission) THEN
      INSERT INTO cabinet_declarations_agenda (
        cabinet_tenant_id, client_id, type_declaration,
        periode_annee, date_limite, statut
      ) VALUES (
        p_cabinet_tenant_id, r.id, 'bilan_annuel',
        p_annee - 1, MAKE_DATE(p_annee, 4, 30), 'a_faire'
      ) ON CONFLICT DO NOTHING;
      v_count := v_count + 1;
    END IF;

  END LOOP;
  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── 7. Fonction revoquer switch session expirées ──────────────────────────────
CREATE OR REPLACE FUNCTION cleanup_switch_sessions() RETURNS void AS $$
BEGIN
  UPDATE cabinet_switch_sessions
  SET revoked_at = NOW()
  WHERE expires_at < NOW() AND revoked_at IS NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

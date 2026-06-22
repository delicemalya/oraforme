-- ══════════════════════════════════════════════════════════════════════════════
-- Migration 123 — Wave 4B-3 : Moteur LMD Universitaire
-- Années académiques, délibérations, jury structuré, vérification diplômes.
-- ══════════════════════════════════════════════════════════════════════════════

-- ── 1. Colonnes jury structuré sur ecole_soutenances ─────────────────────────
-- Remplace le champ jury TEXT[] libre par des rôles nommés.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='ecole_soutenances') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='ecole_soutenances' AND column_name='president_jury') THEN
      ALTER TABLE ecole_soutenances ADD COLUMN president_jury      TEXT;
      ALTER TABLE ecole_soutenances ADD COLUMN rapporteur          TEXT;
      ALTER TABLE ecole_soutenances ADD COLUMN examinateur_1       TEXT;
      ALTER TABLE ecole_soutenances ADD COLUMN examinateur_2       TEXT;
      ALTER TABLE ecole_soutenances ADD COLUMN co_directeur_memoire TEXT;
      ALTER TABLE ecole_soutenances ADD COLUMN pv_pdf_url          TEXT;
      ALTER TABLE ecole_soutenances ADD COLUMN niveau_etude        TEXT; -- Licence/Master/Doctorat
    END IF;
  END IF;
END $$;

-- ── 2. Code de vérification sur ecole_diplomes ────────────────────────────────
-- UUID public non-devinable utilisé pour la page de vérification publique.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='ecole_diplomes') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='ecole_diplomes' AND column_name='verification_code') THEN
      ALTER TABLE ecole_diplomes ADD COLUMN verification_code UUID DEFAULT gen_random_uuid();
      ALTER TABLE ecole_diplomes ADD COLUMN date_delivrance   DATE;
      -- Générer les codes pour les diplômes existants
      UPDATE ecole_diplomes SET verification_code = gen_random_uuid() WHERE verification_code IS NULL;
    END IF;
  END IF;
END $$;

-- ── 3. TABLE annees_academiques ───────────────────────────────────────────────
-- Gestion des années académiques avec session active.

CREATE TABLE IF NOT EXISTS annees_academiques (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  libelle         TEXT        NOT NULL, -- ex: '2024-2025'
  annee_debut     INTEGER     NOT NULL,
  annee_fin       INTEGER     NOT NULL CHECK (annee_fin = annee_debut + 1),
  statut          TEXT        NOT NULL DEFAULT 'en_cours'
    CHECK (statut IN ('a_venir', 'en_cours', 'cloturee')),
  session_active  TEXT        NOT NULL DEFAULT 'normale'
    CHECK (session_active IN ('normale', 'rattrapage', 'exceptionnelle')),
  date_debut      DATE,
  date_fin        DATE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, libelle)
);

ALTER TABLE annees_academiques ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "annees_academiques: tenant" ON annees_academiques;
CREATE POLICY "annees_academiques: tenant" ON annees_academiques FOR ALL
  USING (tenant_id = get_my_tenant_id()) WITH CHECK (tenant_id = get_my_tenant_id());
CREATE INDEX IF NOT EXISTS annees_acad_tenant_idx ON annees_academiques(tenant_id);

-- ── 4. TABLE deliberations_universite ────────────────────────────────────────
-- Résultat de délibération par étudiant pour une année académique.
-- Auto-calculé depuis semestres_etudiants via fn_deliberer_annee().

CREATE TABLE IF NOT EXISTS deliberations_universite (
  id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id            UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  etudiant_id          UUID        REFERENCES etudiants(id) ON DELETE CASCADE,
  annee_universitaire  TEXT        NOT NULL,
  session              TEXT        NOT NULL DEFAULT 'normale'
    CHECK (session IN ('normale', 'rattrapage', 'exceptionnelle')),
  credits_obtenus      INTEGER     NOT NULL DEFAULT 0,
  credits_requis       INTEGER     NOT NULL DEFAULT 180,
  moyenne_generale     NUMERIC(5,2),
  nb_semestres_valides INTEGER     NOT NULL DEFAULT 0,
  statut               TEXT        NOT NULL DEFAULT 'en_cours'
    CHECK (statut IN ('en_cours', 'admis', 'ajourne', 'rattrapage', 'abandonne')),
  mention              TEXT,
  date_deliberation    DATE,
  president_jury       TEXT,
  observations         TEXT,
  generated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, etudiant_id, annee_universitaire, session)
);

ALTER TABLE deliberations_universite ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "deliberations_universite: tenant" ON deliberations_universite;
CREATE POLICY "deliberations_universite: tenant" ON deliberations_universite FOR ALL
  USING (tenant_id = get_my_tenant_id()) WITH CHECK (tenant_id = get_my_tenant_id());
CREATE INDEX IF NOT EXISTS delib_univ_tenant_idx ON deliberations_universite(tenant_id);
CREATE INDEX IF NOT EXISTS delib_univ_etudiant_idx ON deliberations_universite(etudiant_id);

DROP TRIGGER IF EXISTS trg_deliberations_updated_at ON deliberations_universite;
CREATE TRIGGER trg_deliberations_updated_at
  BEFORE UPDATE ON deliberations_universite
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── 5. Fonction moteur académique : validation crédits par étudiant ───────────
-- Lit semestres_etudiants et retourne le bilan de validation.

CREATE OR REPLACE FUNCTION fn_valider_parcours_etudiant(
  p_tenant_id         UUID,
  p_etudiant_id       UUID,
  p_annee             TEXT,
  p_credits_requis    INTEGER DEFAULT 180
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_credits_total      INTEGER;
  v_nb_valides         INTEGER;
  v_moyenne            NUMERIC(5,2);
  v_statut             TEXT;
BEGIN
  SELECT
    COALESCE(SUM(credits_obtenus), 0),
    COUNT(*) FILTER (WHERE statut = 'valide'),
    ROUND(AVG(moyenne) FILTER (WHERE statut IN ('valide','ajourne')), 2)
  INTO v_credits_total, v_nb_valides, v_moyenne
  FROM semestres_etudiants
  WHERE tenant_id       = p_tenant_id
    AND etudiant_id     = p_etudiant_id
    AND annee_universitaire = p_annee;

  v_statut := CASE
    WHEN v_credits_total >= p_credits_requis THEN 'eligible_diplome'
    WHEN v_credits_total > 0                 THEN 'en_cours'
    ELSE                                          'inscrit'
  END;

  RETURN jsonb_build_object(
    'credits_obtenus',   v_credits_total,
    'credits_requis',    p_credits_requis,
    'nb_semestres_valides', v_nb_valides,
    'moyenne_generale',  v_moyenne,
    'statut',            v_statut,
    'eligible_diplome',  v_credits_total >= p_credits_requis
  );
END;
$$;

-- ── 6. Fonction délibération automatique ─────────────────────────────────────
-- Génère/met à jour deliberations_universite depuis semestres_etudiants.
-- Appelée par la page délibérations via RPC.

CREATE OR REPLACE FUNCTION fn_deliberer_annee(
  p_tenant_id   UUID,
  p_annee       TEXT,
  p_session     TEXT DEFAULT 'normale',
  p_credits_requis INTEGER DEFAULT 180
)
RETURNS INTEGER  -- nombre de lignes générées
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_rec    RECORD;
  v_count  INTEGER := 0;
  v_statut TEXT;
  v_mention TEXT;
BEGIN
  FOR v_rec IN
    SELECT
      se.etudiant_id,
      COALESCE(SUM(se.credits_obtenus), 0)                                  AS credits_total,
      COUNT(*) FILTER (WHERE se.statut = 'valide')                          AS nb_valides,
      ROUND(AVG(se.moyenne) FILTER (WHERE se.statut IN ('valide','ajourne')), 2) AS moy
    FROM semestres_etudiants se
    WHERE se.tenant_id           = p_tenant_id
      AND se.annee_universitaire = p_annee
      AND se.session             = p_session
    GROUP BY se.etudiant_id
  LOOP
    -- Statut
    v_statut := CASE
      WHEN v_rec.credits_total >= p_credits_requis            THEN 'admis'
      WHEN v_rec.moy IS NOT NULL AND v_rec.moy >= 8           THEN 'rattrapage'
      WHEN v_rec.moy IS NOT NULL AND v_rec.moy < 8            THEN 'ajourne'
      ELSE 'en_cours'
    END;

    -- Mention (uniquement si admis)
    IF v_statut = 'admis' AND v_rec.moy IS NOT NULL THEN
      v_mention := CASE
        WHEN v_rec.moy >= 16 THEN 'Félicitations du jury'
        WHEN v_rec.moy >= 14 THEN 'Très bien'
        WHEN v_rec.moy >= 12 THEN 'Bien'
        WHEN v_rec.moy >= 10 THEN 'Assez bien'
        ELSE                      'Passable'
      END;
    ELSE
      v_mention := NULL;
    END IF;

    INSERT INTO deliberations_universite (
      tenant_id, etudiant_id, annee_universitaire, session,
      credits_obtenus, credits_requis, moyenne_generale,
      nb_semestres_valides, statut, mention, date_deliberation
    ) VALUES (
      p_tenant_id, v_rec.etudiant_id, p_annee, p_session,
      v_rec.credits_total, p_credits_requis, v_rec.moy,
      v_rec.nb_valides, v_statut, v_mention, CURRENT_DATE
    )
    ON CONFLICT (tenant_id, etudiant_id, annee_universitaire, session)
    DO UPDATE SET
      credits_obtenus      = EXCLUDED.credits_obtenus,
      moyenne_generale     = EXCLUDED.moyenne_generale,
      nb_semestres_valides = EXCLUDED.nb_semestres_valides,
      statut               = EXCLUDED.statut,
      mention              = EXCLUDED.mention,
      date_deliberation    = EXCLUDED.date_deliberation,
      updated_at           = now();

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

-- ── 7. Fonction vérification publique diplôme ─────────────────────────────────
-- SECURITY DEFINER : accessible sans auth (page publique /verify/[code]).
-- Ne retourne que les champs publics des diplômes émis/remis.

CREATE OR REPLACE FUNCTION fn_verifier_diplome(p_code UUID)
RETURNS TABLE(
  etudiant_nom    TEXT,
  type_diplome    TEXT,
  intitule        TEXT,
  mention         TEXT,
  annee_obtention INTEGER,
  date_emission   DATE,
  statut          TEXT,
  numero_diplome  TEXT,
  est_valide      BOOLEAN
)
LANGUAGE sql SECURITY DEFINER AS $$
  SELECT
    etudiant_nom,
    type         AS type_diplome,
    intitule,
    mention,
    annee_obtention,
    date_emission,
    statut,
    numero_diplome,
    statut IN ('emis', 'remis') AS est_valide
  FROM ecole_diplomes
  WHERE verification_code = p_code;
$$;

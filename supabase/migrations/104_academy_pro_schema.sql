-- ============================================================
-- Migration 104 — MIAA Academy Pro : Schéma complet
-- ============================================================

-- ── 1. Leçons structurées par domaine et niveau ───────────────────────────────
CREATE TABLE IF NOT EXISTS academy_lessons (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  domaine     TEXT NOT NULL,
  niveau      TEXT NOT NULL CHECK (niveau IN ('debutant','intermediaire','avance','expert')),
  sequence    INT NOT NULL DEFAULT 1,
  titre       TEXT NOT NULL,
  objectifs   TEXT[] DEFAULT '{}',
  content_md  TEXT NOT NULL DEFAULT '',
  duree_min   INT DEFAULT 20,
  tags        TEXT[] DEFAULT '{}',
  actif       BOOLEAN DEFAULT true,
  created_at  TIMESTAMPTZ DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_lessons_domaine_niveau_seq
  ON academy_lessons(domaine, niveau, sequence);
CREATE INDEX IF NOT EXISTS idx_lessons_domaine ON academy_lessons(domaine, niveau, actif);

-- ── 2. Questions quiz / examen ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS academy_questions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  domaine     TEXT NOT NULL,
  niveau      TEXT NOT NULL DEFAULT 'debutant' CHECK (niveau IN ('debutant','intermediaire','avance','expert')),
  question    TEXT NOT NULL,
  options     JSONB NOT NULL DEFAULT '[]',
  answer_idx  INT NOT NULL,
  explication TEXT DEFAULT '',
  points      INT DEFAULT 1,
  actif       BOOLEAN DEFAULT true,
  created_at  TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_questions_domaine_niveau ON academy_questions(domaine, niveau, actif);

-- ── 3. Badges (définitions globales) ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS academy_badges (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code        TEXT UNIQUE NOT NULL,
  nom         TEXT NOT NULL,
  description TEXT NOT NULL,
  icone       TEXT DEFAULT '🏆',
  couleur     TEXT DEFAULT '#F59E0B',
  condition   JSONB NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- ── 4. Badges gagnés par les apprenants ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS academy_learner_badges (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id     UUID,
  badge_id    UUID NOT NULL REFERENCES academy_badges(id) ON DELETE CASCADE,
  obtenu_le   TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tenant_id, badge_id)
);
ALTER TABLE academy_learner_badges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "badges_tenant" ON academy_learner_badges
  USING (tenant_id IN (SELECT tenant_id FROM profiles WHERE user_id = auth.uid()));

-- ── 5. Mémoire pédagogique apprenant ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS academy_learner_memory (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id           UUID,
  domaine           TEXT NOT NULL,
  topics_mastered   TEXT[] DEFAULT '{}',
  weak_areas        TEXT[] DEFAULT '{}',
  questions_vues    INT DEFAULT 0,
  streak_jours      INT DEFAULT 0,
  derniere_activite DATE DEFAULT CURRENT_DATE,
  niveau_courant    TEXT DEFAULT 'debutant',
  updated_at        TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tenant_id, domaine)
);
ALTER TABLE academy_learner_memory ENABLE ROW LEVEL SECURITY;
CREATE POLICY "learner_memory_tenant" ON academy_learner_memory
  USING (tenant_id IN (SELECT tenant_id FROM profiles WHERE user_id = auth.uid()));
CREATE TRIGGER trg_learner_memory_upd BEFORE UPDATE ON academy_learner_memory
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

-- ── 6. Parcours métiers ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS academy_parcours (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code            TEXT UNIQUE NOT NULL,
  titre           TEXT NOT NULL,
  description     TEXT DEFAULT '',
  metier          TEXT DEFAULT '',
  icone           TEXT DEFAULT '🎯',
  couleur         TEXT DEFAULT '#2563EB',
  domaines        TEXT[] NOT NULL DEFAULT '{}',
  duree_totale_h  INT DEFAULT 20,
  niveau_min      TEXT DEFAULT 'debutant',
  actif           BOOLEAN DEFAULT true,
  created_at      TIMESTAMPTZ DEFAULT now()
);

-- ── 7. Inscription / progression apprenant dans un parcours ──────────────────
CREATE TABLE IF NOT EXISTS academy_learner_parcours (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id         UUID,
  parcours_id     UUID NOT NULL REFERENCES academy_parcours(id) ON DELETE CASCADE,
  domaine_courant TEXT DEFAULT '',
  progression     INT DEFAULT 0,
  statut          TEXT DEFAULT 'en_cours' CHECK (statut IN ('en_cours','termine','abandonne')),
  debut_le        TIMESTAMPTZ DEFAULT now(),
  fin_le          TIMESTAMPTZ,
  UNIQUE(tenant_id, parcours_id)
);
ALTER TABLE academy_learner_parcours ENABLE ROW LEVEL SECURITY;
CREATE POLICY "learner_parcours_tenant" ON academy_learner_parcours
  USING (tenant_id IN (SELECT tenant_id FROM profiles WHERE user_id = auth.uid()));

-- ── 8. Tentatives d'examen final ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS academy_exam_attempts (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id     UUID,
  domaine     TEXT NOT NULL,
  niveau      TEXT NOT NULL,
  score       INT NOT NULL DEFAULT 0,
  score_max   INT NOT NULL DEFAULT 20,
  pourcentage INT NOT NULL DEFAULT 0,
  reponses    JSONB DEFAULT '[]',
  passed      BOOLEAN DEFAULT false,
  passe_le    TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE academy_exam_attempts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "exam_attempts_tenant" ON academy_exam_attempts
  USING (tenant_id IN (SELECT tenant_id FROM profiles WHERE user_id = auth.uid()));
CREATE INDEX IF NOT EXISTS idx_exam_attempts_tenant
  ON academy_exam_attempts(tenant_id, domaine, niveau, passe_le DESC);

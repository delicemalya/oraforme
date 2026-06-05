-- ============================================================
-- Migration 068 : Entretiens IA — MIAA JOB Partie 6
-- Ajoute les colonnes JSONB nécessaires à la table entretiens
-- ============================================================

-- Colonnes pour l'IA (questions générées + évaluation + prédiction)
ALTER TABLE entretiens ADD COLUMN IF NOT EXISTS candidature_id  UUID REFERENCES candidatures(id) ON DELETE SET NULL;
ALTER TABLE entretiens ADD COLUMN IF NOT EXISTS questions_ia    JSONB;
ALTER TABLE entretiens ADD COLUMN IF NOT EXISTS evaluation      JSONB;
ALTER TABLE entretiens ADD COLUMN IF NOT EXISTS rapport_prediction JSONB;
ALTER TABLE entretiens ADD COLUMN IF NOT EXISTS score_entretien INT DEFAULT 0;
ALTER TABLE entretiens ADD COLUMN IF NOT EXISTS date_entretien  TIMESTAMPTZ;

-- Renommer note_finale si elle n'existe pas encore (migration 012 utilise note_finale)
ALTER TABLE entretiens ADD COLUMN IF NOT EXISTS note_finale INT DEFAULT 0;

-- Mettre à jour le statut pour inclure les nouveaux états MIAA JOB
-- planifie | en_cours | termine | annule
-- (pas de changement de contrainte pour compatibilité descendante)

-- Index pour les requêtes fréquentes
CREATE INDEX IF NOT EXISTS idx_entretiens_candidature ON entretiens(candidature_id);
CREATE INDEX IF NOT EXISTS idx_entretiens_statut      ON entretiens(statut);

-- RLS déjà activé sur entretiens (migration 012)
-- Pas besoin de recréer les politiques

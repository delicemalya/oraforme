-- ============================================================
-- Migration 037 : Types enseignant et contrat
-- Différencier enseignants employés (CDI/CDD/Vacataire/Stagiaire)
-- des enseignants prestataires (payés uniquement à l'heure via Trésorerie)
-- ============================================================

ALTER TABLE enseignants
  ADD COLUMN IF NOT EXISTS type_enseignant TEXT DEFAULT 'employe'
    CHECK (type_enseignant IN ('employe', 'prestataire')),
  ADD COLUMN IF NOT EXISTS type_contrat TEXT DEFAULT NULL;
  -- CDD | CDI | vacataire | stagiaire (null pour prestataires)

-- Les enseignants existants avec salaire_mensuel → employés
UPDATE enseignants
  SET type_enseignant = 'employe'
  WHERE type_enseignant IS NULL OR type_enseignant = '';

-- Les enseignants sans salaire mensuel mais avec taux horaire → candidats prestataires
-- (à ajuster manuellement si besoin, le défaut 'employe' est conservatif)

COMMENT ON COLUMN enseignants.type_enseignant IS
  'employe = contrat CDI/CDD/Vacataire/Stagiaire → paie mensuelle ; prestataire = contrat de prestation → payé à l''heure via Trésorerie';

COMMENT ON COLUMN enseignants.type_contrat IS
  'CDI | CDD | vacataire | stagiaire (uniquement pour type_enseignant = employe)';

-- Migration 115 : Colonne est_imposable sur la table avantages
-- Permet de distinguer primes imposables (soumises CNSS + IRPP) des indemnités exonérées

ALTER TABLE avantages
  ADD COLUMN IF NOT EXISTS est_imposable BOOLEAN NOT NULL DEFAULT true;

-- Les indemnités de type transport, logement et repas sont fiscalement non imposables
-- (Code Général des Impôts Congo, Art. 76 §3 — exonérations spécifiques)
UPDATE avantages
  SET est_imposable = false
  WHERE type IN ('transport', 'logement', 'repas')
    AND est_imposable = true;

-- Commentaire métier
COMMENT ON COLUMN avantages.est_imposable IS
  'true = prime soumise à CNSS salarié + IRPP (ex: prime de rendement, responsabilité) ; false = indemnité exonérée (ex: transport, logement, repas)';

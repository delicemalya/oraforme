-- Ajout du secteur d'activité sur la table tenants
ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS secteur_activite TEXT;

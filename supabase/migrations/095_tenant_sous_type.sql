-- ─── Migration 095 : sous_type tenant (École primaire/Collège/Lycée/Université) ──

-- 1. Ajout colonne sous_type dans tenants
ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS sous_type text DEFAULT NULL;

-- 2. Index pour filtrages rapides
CREATE INDEX IF NOT EXISTS idx_tenants_sous_type
  ON tenants (sous_type)
  WHERE sous_type IS NOT NULL;

-- 3. Renseigner rétrospectivement les tenants école existants
-- (best-effort : si secteur=ecole et taille_entreprise connue)
UPDATE tenants
SET sous_type = CASE
  WHEN taille_entreprise IN ('tpe', 'starter') THEN 'primaire'  -- défaut tpe école
  WHEN taille_entreprise IN ('pme', 'pro')     THEN 'lycee'     -- défaut pme école
  WHEN taille_entreprise IN ('grande', 'enterprise') THEN 'universite'
  ELSE NULL
END
WHERE secteur_activite = 'ecole'
  AND sous_type IS NULL;

-- ============================================================
-- Migration 057 — Préférence de langue par utilisateur
-- Sauvegarde le choix de langue dans profiles.preferred_locale
-- Synchronisé avec localStorage côté client
-- ============================================================

-- ── 1. Ajouter la colonne preferred_locale à profiles ───────
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS preferred_locale TEXT
  DEFAULT 'fr'
  CHECK (preferred_locale IN ('fr','en','pt','es','ln','sw','de','kg'));

-- ── 2. Commentaire ──────────────────────────────────────────
COMMENT ON COLUMN profiles.preferred_locale IS
  'Langue préférée de l''utilisateur: fr|en|pt|es|ln|sw|de|kg';

-- ── 3. Index pour recherche future (ex: stats par langue) ───
CREATE INDEX IF NOT EXISTS idx_profiles_locale
  ON profiles (preferred_locale);

-- ── 4. Fonction RPC pour changer sa propre langue ───────────
CREATE OR REPLACE FUNCTION fn_set_my_locale(p_locale TEXT)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Valider la locale
  IF p_locale NOT IN ('fr','en','pt','es','ln','sw','de','kg') THEN
    RAISE EXCEPTION 'Locale non supportée: %', p_locale;
  END IF;

  -- Mettre à jour tous les profils de cet utilisateur
  UPDATE profiles
  SET preferred_locale = p_locale
  WHERE user_id = auth.uid();
END;
$$;

GRANT EXECUTE ON FUNCTION fn_set_my_locale(TEXT) TO authenticated;

-- ── 5. Fonction pour récupérer la locale au login ───────────
CREATE OR REPLACE FUNCTION fn_get_my_locale()
RETURNS TEXT
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_locale TEXT;
BEGIN
  SELECT preferred_locale INTO v_locale
  FROM profiles
  WHERE user_id = auth.uid()
  ORDER BY created_at ASC
  LIMIT 1;

  RETURN COALESCE(v_locale, 'fr');
END;
$$;

GRANT EXECUTE ON FUNCTION fn_get_my_locale() TO authenticated;

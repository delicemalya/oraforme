-- =============================================================
-- MIGRATION 085 — Helper function: check if a profile exists
-- for a given email (used by OAuth callback to detect duplicate accounts)
-- =============================================================

CREATE OR REPLACE FUNCTION fn_profile_exists_for_email(p_email TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM profiles p
    JOIN auth.users u ON u.id = p.user_id
    WHERE u.email = p_email
  );
END;
$$;

GRANT EXECUTE ON FUNCTION fn_profile_exists_for_email(TEXT) TO service_role;

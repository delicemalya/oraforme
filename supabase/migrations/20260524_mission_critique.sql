-- ============================================================================
-- MIGRATION: Mission Critique — Multi-tenant isolation + Owner Admin
-- Date: 2026-05-24
-- Run in Supabase SQL Editor (Dashboard > SQL Editor > New query)
-- ============================================================================

-- ── 1. PROFILES — ajouter la colonne created_at (manquante) ──────────────────
-- La table profiles n'a pas de created_at dans le schéma initial.
-- Tous les queries .order('created_at') dans le code en ont besoin.
-- Backfill : on utilise auth.users.created_at si possible, sinon NOW().

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Backfill depuis auth.users pour les lignes existantes
UPDATE profiles p
SET created_at = COALESCE(
  (SELECT au.created_at FROM auth.users au WHERE au.id = p.user_id),
  NOW()
)
WHERE created_at = NOW();
-- Note: si toutes les lignes ont created_at = NOW() (vient d'être créée),
-- elles seront toutes backfillées. C'est idempotent.

-- ── 2. PROFILES — index de performance pour les requêtes multi-tenant ────────
-- Toutes les queries profils utilisent maintenant:
-- .eq('user_id', userId).order('created_at', { ascending: true }).limit(1)
-- Cet index couvre ce pattern efficacement.
CREATE INDEX IF NOT EXISTS idx_profiles_user_created_at
  ON profiles(user_id, created_at ASC);

-- ── 3. TENANTS — colonne status pour suspend/unsuspend ───────────────────────
ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active'
  CHECK (status IN ('active', 'suspended'));

CREATE INDEX IF NOT EXISTS idx_tenants_status
  ON tenants(status);

-- ── 4. TENANTS — soft-delete support ─────────────────────────────────────────
ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_tenants_not_deleted
  ON tenants(id)
  WHERE deleted_at IS NULL;

-- ── 5. VÉRIFICATION ───────────────────────────────────────────────────────────
-- Lancez ces requêtes pour confirmer :

-- SELECT column_name, data_type, column_default
-- FROM information_schema.columns
-- WHERE table_name = 'profiles' AND column_name = 'created_at';

-- SELECT column_name FROM information_schema.columns
-- WHERE table_name = 'tenants' AND column_name IN ('status', 'deleted_at');

-- SELECT indexname FROM pg_indexes
-- WHERE tablename IN ('profiles', 'tenants') AND indexname LIKE 'idx_%'
-- ORDER BY tablename, indexname;

-- ── FIN ───────────────────────────────────────────────────────────────────────

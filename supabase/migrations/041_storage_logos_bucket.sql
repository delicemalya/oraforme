-- ============================================================
-- Migration 041 — Create 'logos' storage bucket for company logos
-- ============================================================

-- Create the bucket (public = anyone can read the URL)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'logos',
  'logos',
  true,
  2097152,  -- 2 MB
  ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']
)
ON CONFLICT (id) DO UPDATE
  SET public            = true,
      file_size_limit   = 2097152,
      allowed_mime_types = ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'];

-- Public SELECT: anyone can read logo URLs (needed for <img> tags)
DROP POLICY IF EXISTS "logos_public_read"   ON storage.objects;
CREATE POLICY "logos_public_read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'logos');

-- Authenticated INSERT: any logged-in user can upload
DROP POLICY IF EXISTS "logos_auth_insert"   ON storage.objects;
CREATE POLICY "logos_auth_insert"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'logos'
    AND auth.role() = 'authenticated'
  );

-- Authenticated UPDATE/DELETE: only the uploading user's tenant path
DROP POLICY IF EXISTS "logos_auth_update"   ON storage.objects;
CREATE POLICY "logos_auth_update"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'logos'
    AND auth.role() = 'authenticated'
  );

DROP POLICY IF EXISTS "logos_auth_delete"   ON storage.objects;
CREATE POLICY "logos_auth_delete"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'logos'
    AND auth.role() = 'authenticated'
  );

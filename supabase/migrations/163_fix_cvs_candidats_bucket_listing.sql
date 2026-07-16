-- Migration 163 — Fix advisor sécurité "public_bucket_allows_listing" (bucket cvs-candidats)
--
-- Contexte : le bucket Storage "cvs-candidats" contient les CV des candidats
-- (PII sensible), et est marqué public=true avec une policy SELECT sur
-- storage.objects ("read_cv_public") sans AUCUNE restriction au-delà de
-- bucket_id = 'cvs-candidats' — accessible au rôle "public" (anon inclus).
-- Résultat : n'importe qui peut lister TOUS les CV de TOUS les tenants via
-- l'endpoint /storage/v1/object/list/cvs-candidats, puis les télécharger.
--
-- Vérifié avant ce fix (grep sur tout /app) : le code applicatif n'utilise
-- QUE deux chemins pour ce bucket, dans app/api/jobs/candidature/route.ts :
--   1. Upload du CV via supabaseAdmin (service_role — bypass RLS, non affecté)
--   2. getPublicUrl(upload.path) — construction d'URL côté client, ne passe
--      PAS par une requête RLS et n'est donc pas affectée par ce fix (les
--      URLs publiques déjà générées et stockées en base continuent de
--      fonctionner : un bucket public=true sert les objets directement via
--      /storage/v1/object/public/... indépendamment des policies RLS).
-- Aucun appel à .list() sur ce bucket n'existe dans le code. Retirer la
-- policy SELECT ferme donc la fuite (listing/énumération) sans casser
-- aucune fonctionnalité existante.
--
-- Le bucket reste public=true (nécessaire pour que les URLs déjà stockées
-- en base — candidatures.cv_url etc. — continuent de fonctionner) : seule
-- la capacité de LISTER le contenu du bucket est retirée.

DROP POLICY IF EXISTS "read_cv_public" ON storage.objects;

DO $$
BEGIN
  RAISE NOTICE 'Migration 163 OK — listing public retiré sur le bucket cvs-candidats (PII candidats protégée)';
END $$;

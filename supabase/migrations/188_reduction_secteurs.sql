-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 188 — Refonte 2026-11 : réduction du périmètre
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Secteurs conservés : entreprise, ecole, commerce, cabinet, sante, hotel,
--                      recrutement.
-- Secteurs retirés   : restaurant, supermarche, boisson, transport,
--                      transport_public, btp, petrole, ong, banque,
--                      pharmacie, agriculture, assurance.
--
-- NB : appliquée en production le 2026-11-11 alors que la liste excluait
-- encore 'hotel' ; aucun tenant n'était en secteur hôtel à ce moment, la
-- liste ci-dessous a été corrigée ensuite pour l'inclure.
--
-- Aligne tenants.secteur_activite sur la fonction normalizeSecteur() de
-- lib/erp-sectors.ts (le code normalise déjà à la lecture : cette migration
-- n'est pas bloquante, elle nettoie la donnée).
--
-- AUCUNE donnée métier n'est supprimée : seules les valeurs de
-- tenants.secteur_activite (et sous_type pour la grande distribution) changent.
-- Les valeurs d'origine sont sauvegardées dans tenants_secteur_backup_188
-- pour pouvoir revenir en arrière.
--
-- Idempotente : relancer la migration ne modifie plus rien.
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

-- 1. Sauvegarde des valeurs d'origine (une seule fois par tenant)
CREATE TABLE IF NOT EXISTS public.tenants_secteur_backup_188 (
  tenant_id        uuid PRIMARY KEY,
  secteur_activite text,
  sous_type        text,
  saved_at         timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.tenants_secteur_backup_188 ENABLE ROW LEVEL SECURITY;
-- Aucune policy : table lisible uniquement par service_role / postgres.

INSERT INTO public.tenants_secteur_backup_188 (tenant_id, secteur_activite, sous_type)
SELECT id, secteur_activite, sous_type
FROM public.tenants
WHERE secteur_activite IS NOT NULL
  AND secteur_activite NOT IN ('entreprise', 'ecole', 'commerce', 'cabinet', 'sante', 'hotel', 'recrutement')
ON CONFLICT (tenant_id) DO NOTHING;

-- 2. Supermarché → commerce, sous-type grande distribution
UPDATE public.tenants
SET secteur_activite = 'commerce',
    sous_type        = COALESCE(NULLIF(sous_type, ''), 'grande_distribution')
WHERE secteur_activite = 'supermarche';

-- 3. Boutique → commerce
UPDATE public.tenants
SET secteur_activite = 'commerce'
WHERE secteur_activite = 'boutique';

-- 4. Autre + secteurs retirés + valeurs inconnues → entreprise
UPDATE public.tenants
SET secteur_activite = 'entreprise'
WHERE secteur_activite IS NOT NULL
  AND secteur_activite NOT IN ('entreprise', 'ecole', 'commerce', 'cabinet', 'sante', 'hotel', 'recrutement');

COMMIT;

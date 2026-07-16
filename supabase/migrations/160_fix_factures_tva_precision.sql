-- Migration 160 — Fix ANO-DB01 : factures.tva précision insuffisante
--
-- Contexte : factures.tva a été créée en migration 001_initial.sql comme
-- NUMERIC(5,2) (pensée à l'origine comme un TAUX, défaut 18). En pratique,
-- toute l'application (app/api/factures/route.ts, migration 046/128/129)
-- utilise cette colonne comme un MONTANT de TVA (FCFA), au même titre que
-- tva_montant (NUMERIC(14,2), ajoutée en 046/129) et que devis.tva
-- (NUMERIC(14,2) depuis la 058). NUMERIC(5,2) plafonne à 999.99 — dès qu'une
-- facture réelle dépasse ~5 555 FCFA HT (TVA 18% > 999.99), l'INSERT échoue.
--
-- Ticket ouvert lors de la certification C-005 S-1 (commit a3c299b) :
-- ANO-DB01. Reproduit dans tests/certifications/c005-erp-certification.spec.ts
-- (insertFacture, contournement à 500 FCFA HT pour rester sous le plafond).
--
-- Fix : aligner factures.tva sur NUMERIC(14,2), comme tva_montant et devis.tva.
-- Élargir précision/échelle est non destructif : toute valeur qui tenait dans
-- NUMERIC(5,2) tient dans NUMERIC(14,2), aucune donnée existante n'est perdue.

ALTER TABLE factures
  ALTER COLUMN tva TYPE NUMERIC(14,2);

DO $$
BEGIN
  RAISE NOTICE 'Migration 160 OK — factures.tva élargie à NUMERIC(14,2) (ANO-DB01 corrigé)';
END $$;

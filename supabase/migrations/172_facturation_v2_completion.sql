-- Migration 172 — D1 : achèvement de la facturation V2 (ANO-C02)
--
-- La migration 010_facturation_v2.sql n'a été appliquée qu'à moitié en
-- production : entreprise_config existe, facture_lignes non, et aucune des
-- 10 colonnes ajoutées à factures n'est présente. Conséquence vérifiée :
-- les deux chemins de création de facture écrivent 9 colonnes inexistantes,
-- PostgREST rejette l'INSERT entier, et la création de facture est
-- impossible depuis le 2026-05-12.
--
-- Cette migration N'EST PAS un rejeu de la 010. Appliquée telle quelle, la 010
-- créerait quatre paires de colonnes redondantes : client_name à côté de
-- client_nom, subtotal à côté de montant_ht. Le code écrit déjà les deux
-- membres de chaque paire à la création, et un seul à l'édition
-- (facturation/page.tsx:483) : modifier une facture laisserait donc client_nom
-- et montant_ht figés sur les anciennes valeurs.
--
-- Arbitrage retenu, colonne par colonne :
--   client_name  -> NON ajoutée. client_nom existe, porte les données, NOT NULL.
--   subtotal     -> NON ajoutée. montant_ht existe, porte les données, NOT NULL.
--   les 8 autres -> ajoutées : aucune colonne existante ne porte ces grandeurs.
--
-- Le code est corrigé dans le même commit pour n'écrire qu'une colonne par
-- grandeur. Aucune donnée n'est reprise : les 198 factures de production sont
-- des données de démonstration (scripts/seed-demo-data.ts), aucune facture
-- n'a jamais été créée par l'interface, et factures.items est vide sur les 198.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. factures : les 8 colonnes sans équivalent
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE factures
  ADD COLUMN IF NOT EXISTS invoice_number  TEXT,
  ADD COLUMN IF NOT EXISTS client_address  TEXT,
  ADD COLUMN IF NOT EXISTS client_phone    TEXT,
  ADD COLUMN IF NOT EXISTS date            DATE DEFAULT CURRENT_DATE,
  ADD COLUMN IF NOT EXISTS due_date        DATE,
  ADD COLUMN IF NOT EXISTS ca              NUMERIC(14,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS footer_text     TEXT,
  ADD COLUMN IF NOT EXISTS notes           TEXT;

COMMENT ON COLUMN factures.date IS
  'Date de la facture, distincte de created_at qui horodate la saisie.';
COMMENT ON COLUMN factures.ca IS
  'Centime Additionnel congolais : 5 pourcent de la TVA collectee, pas du HT. Stocke separement de tva pour que le compte 4441 ne recoive que la TVA (voir D4).';

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. factures.tva : DEFAULT hérité de l'époque où la colonne portait un taux
-- ─────────────────────────────────────────────────────────────────────────────
-- Créée NUMERIC(5,2) DEFAULT 18 en 001 comme un TAUX, élargie à NUMERIC(14,2)
-- en 160 parce que tout le code l'utilise comme un MONTANT. Le DEFAULT 18 n'a
-- jamais été corrigé : une facture insérée sans tva reçoit 18 FCFA de TVA.

ALTER TABLE factures ALTER COLUMN tva SET DEFAULT 0;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. factures.tva_montant : garder les deux colonnes en phase, par construction
-- ─────────────────────────────────────────────────────────────────────────────
-- tva et tva_montant portent la même grandeur. tva est la colonne de référence :
-- NOT NULL, présente depuis 001, lue par tous les écrans. tva_montant a été
-- ajoutée en 129 pour le trigger OHADA de la 046 et backfillée en 128.
--
-- Aujourd'hui la route API écrit les deux (route.ts:71-73) et la page n'écrit
-- que tva (facturation/page.tsx:487) : les deux colonnes divergent selon le
-- chemin emprunté. Plutôt que d'exiger de chaque appelant qu'il écrive les
-- deux, la synchronisation devient une propriété de la table.

CREATE OR REPLACE FUNCTION fn_sync_facture_tva_montant()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $fn$
BEGIN
  NEW.tva_montant := NEW.tva;
  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS trg_sync_facture_tva_montant ON public.factures;
CREATE TRIGGER trg_sync_facture_tva_montant
  BEFORE INSERT OR UPDATE OF tva ON public.factures
  FOR EACH ROW EXECUTE FUNCTION fn_sync_facture_tva_montant();

UPDATE factures SET tva_montant = tva WHERE tva_montant IS DISTINCT FROM tva;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. factures.statut : la contrainte ne connaît pas les 6 statuts du code
-- ─────────────────────────────────────────────────────────────────────────────
-- facturation/page.tsx:21 déclare 6 statuts. La contrainte de la 001 en connaît
-- moins, la 010 en ajoutait un seul ('retard') et oubliait 'partiellement_payee'.
-- Sans risque sur l'existant : les 198 factures ne portent que 'payee' et
-- 'envoyee' (seed-demo-data.ts:271).

ALTER TABLE factures DROP CONSTRAINT IF EXISTS factures_statut_check;
ALTER TABLE factures ADD CONSTRAINT factures_statut_check
  CHECK (statut IN ('brouillon', 'envoyee', 'payee', 'partiellement_payee', 'retard', 'annulee'));

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. facture_lignes : la septième table de lignes, seule manquante
-- ─────────────────────────────────────────────────────────────────────────────
-- Forme reprise à l'identique de devis_lignes, précédent le plus proche :
-- même domaine, même migration d'origine, même schéma. Les six autres tables
-- de lignes du produit existent déjà (devis_lignes, vente_lignes,
-- purchase_items, his_lignes_facture, htl_invoice_lines,
-- pharmacie_vente_lignes) : facture_lignes est un oubli d'exécution, pas un
-- choix d'architecture.

CREATE TABLE IF NOT EXISTS facture_lignes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id  UUID NOT NULL REFERENCES factures(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  price       NUMERIC NOT NULL DEFAULT 0,
  quantity    INTEGER NOT NULL DEFAULT 1,
  total       NUMERIC NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_fac_lignes_invoice ON facture_lignes (invoice_id);

-- RLS : l'isolation passe par la facture porteuse, qui porte le tenant_id.
-- Quatre policies explicites, une par opération. La 010 en prévoyait une
-- cinquième sans clause FOR, donc FOR ALL, qui aurait recouvert les autres et
-- déclenché l'avertissement multiple_permissive_policies de l'advisor (170).

ALTER TABLE facture_lignes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sel_fac_lignes" ON facture_lignes;
CREATE POLICY "sel_fac_lignes" ON facture_lignes
  FOR SELECT USING (
    invoice_id IN (SELECT id FROM factures WHERE tenant_id = get_my_tenant_id())
  );

DROP POLICY IF EXISTS "ins_fac_lignes" ON facture_lignes;
CREATE POLICY "ins_fac_lignes" ON facture_lignes
  FOR INSERT WITH CHECK (
    invoice_id IN (SELECT id FROM factures WHERE tenant_id = get_my_tenant_id())
  );

DROP POLICY IF EXISTS "upd_fac_lignes" ON facture_lignes;
CREATE POLICY "upd_fac_lignes" ON facture_lignes
  FOR UPDATE USING (
    invoice_id IN (SELECT id FROM factures WHERE tenant_id = get_my_tenant_id())
  ) WITH CHECK (
    invoice_id IN (SELECT id FROM factures WHERE tenant_id = get_my_tenant_id())
  );

DROP POLICY IF EXISTS "del_fac_lignes" ON facture_lignes;
CREATE POLICY "del_fac_lignes" ON facture_lignes
  FOR DELETE USING (
    invoice_id IN (SELECT id FROM factures WHERE tenant_id = get_my_tenant_id())
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. Index restants de la 010
-- ─────────────────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_factures_number ON factures (invoice_number);
CREATE INDEX IF NOT EXISTS idx_factures_statut ON factures (statut);

-- factures.items n'est pas supprimée : le code de repli des deux chemins de
-- lecture (pdf/route.ts:70, preview/page.tsx:110) reste fonctionnel tant
-- qu'aucune donnée héritée n'est certifiée absente.

DO $$
BEGIN
  RAISE NOTICE 'Migration 172 OK — facture_lignes creee, 8 colonnes ajoutees, tva/tva_montant synchronisees';
END $$;

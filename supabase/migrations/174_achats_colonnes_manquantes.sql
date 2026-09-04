-- Migration 174 — Achats : les colonnes que la page écrit sans qu'elles existent
--
-- Relevé en production le 2026-09-02 : purchases porte exactement les
-- 6 colonnes de la migration 016 (id, tenant_id, supplier_id, montant_total,
-- statut, created_at) et purchase_items les 5 siennes (id, purchase_id,
-- product_id, quantite, prix). La migration 050, qui ajoutait reference et
-- notes à purchases, n'a pas plus été appliquée ici que sur products.
--
-- La page app/dashboard/stocks/achats écrit reference, date, notes et
-- total_amount, et fait vivre un cycle brouillon -> commandé -> reçu -> payé.
-- Aucune de ces colonnes n'existe et aucun de ces statuts n'est autorisé par
-- la contrainte de la 016 : la création d'un achat échoue toujours. C'est la
-- même cause que la facturation (ANO-C02), au même endroit du produit.
--
-- Arbitrage identique à celui de la migration 172 : la colonne qui porte les
-- données gagne. Le montant reste montant_total et c'est le code qui cesse
-- d'écrire total_amount. Les trois colonnes sans équivalent sont ajoutées.

ALTER TABLE purchases
  ADD COLUMN IF NOT EXISTS reference TEXT,
  ADD COLUMN IF NOT EXISTS notes     TEXT,
  ADD COLUMN IF NOT EXISTS date      DATE DEFAULT CURRENT_DATE;

COMMENT ON COLUMN purchases.date IS
  'Date de l''achat, distincte de created_at qui horodate la saisie.';

-- La contrainte de la 016 n'autorise que commande, reçu et annule. La 050
-- visait brouillon, commandé, reçu, payé, annulé. L'union des deux évite de
-- rejeter une ligne existante : le jeu accentué est la cible, les deux valeurs
-- héritées restent acceptées.

ALTER TABLE purchases DROP CONSTRAINT IF EXISTS purchases_statut_check;
ALTER TABLE purchases ADD CONSTRAINT purchases_statut_check
  CHECK (statut IN (
    'brouillon', 'commandé', 'reçu', 'payé', 'annulé',
    'commande', 'annule'
  ));

CREATE INDEX IF NOT EXISTS idx_purchases_statut ON purchases (statut);

DO $$
BEGIN
  RAISE NOTICE 'Migration 174 OK — purchases : reference, notes, date ajoutees, contrainte statut elargie';
END $$;

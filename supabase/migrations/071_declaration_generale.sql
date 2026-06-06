-- ============================================================
-- Migration 071 : Déclaration Générale des Impôts et Taxes (DGI Congo)
-- Formulaire mensuel — soumis avant le 20 du mois suivant
-- ============================================================

CREATE TABLE IF NOT EXISTS declarations_generales (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  mois INTEGER NOT NULL CHECK (mois BETWEEN 1 AND 12),
  annee INTEGER NOT NULL,

  -- IDENTIFICATION
  niu TEXT,
  denomination_sociale TEXT,
  adresse TEXT,
  telephone TEXT,
  email TEXT,
  ville TEXT,
  residence_fiscale TEXT,

  -- LIGNE 1
  l1_droits_accises NUMERIC(15,2) DEFAULT 0,
  -- LIGNE 2
  l2_taxe_boissons_tabac NUMERIC(15,2) DEFAULT 0,
  -- LIGNE 3
  l3_tva NUMERIC(15,2) DEFAULT 0,
  l3_tva_centimes NUMERIC(15,2) DEFAULT 0,
  -- LIGNE 4
  l4_tva_tiers NUMERIC(15,2) DEFAULT 0,
  l4_tva_tiers_centimes NUMERIC(15,2) DEFAULT 0,
  -- LIGNE 5
  l5_taxe_transferts_fonds NUMERIC(15,2) DEFAULT 0,
  -- LIGNE 6
  l6_taxe_jeux_hasard NUMERIC(15,2) DEFAULT 0,
  -- LIGNE 7
  l7_irpp_bic_bnc NUMERIC(15,2) DEFAULT 0,
  -- LIGNE 8
  l8_irpp_salaires NUMERIC(15,2) DEFAULT 0,
  l8_nb_employes INTEGER DEFAULT 0,
  l8_salaires_bruts NUMERIC(15,2) DEFAULT 0,
  -- LIGNE 9
  l9_tus NUMERIC(15,2) DEFAULT 0,
  l9_salaires_bruts NUMERIC(15,2) DEFAULT 0,
  -- LIGNE 10
  l10_is NUMERIC(15,2) DEFAULT 0,
  -- LIGNE 11
  l11_isf NUMERIC(15,2) DEFAULT 0,
  -- LIGNE 12
  l12_tss NUMERIC(15,2) DEFAULT 0,
  -- LIGNE 13
  l13_tvts NUMERIC(15,2) DEFAULT 0,
  -- LIGNE 14
  l14_irvm NUMERIC(15,2) DEFAULT 0,
  -- LIGNE 15
  l15_ras_20pct NUMERIC(15,2) DEFAULT 0,
  -- LIGNE 16
  l16_ras_5pct NUMERIC(15,2) DEFAULT 0,
  -- LIGNE 17
  l17_ras_btp NUMERIC(15,2) DEFAULT 0,
  -- LIGNE 18
  l18_asdi NUMERIC(15,2) DEFAULT 0,
  -- LIGNE 19
  l19_taxe_appareils NUMERIC(15,2) DEFAULT 0,
  -- LIGNE 20
  l20_rav NUMERIC(15,2) DEFAULT 0,
  -- LIGNE 21
  l21_redevances NUMERIC(15,2) DEFAULT 0,
  -- LIGNE 22
  l22_taxe_assurance NUMERIC(15,2) DEFAULT 0,
  -- LIGNE 23
  l23_taxe_immobiliere NUMERIC(15,2) DEFAULT 0,
  -- LIGNE 24
  l24_tol NUMERIC(15,2) DEFAULT 0,
  -- LIGNE 25
  l25_taxe_regionale NUMERIC(15,2) DEFAULT 0,
  -- LIGNE 26
  l26_contrib_fonciere_baties NUMERIC(15,2) DEFAULT 0,
  -- LIGNE 27
  l27_contrib_fonciere_non_baties NUMERIC(15,2) DEFAULT 0,

  -- TOTAUX
  total_principal NUMERIC(15,2) DEFAULT 0,
  total_centimes NUMERIC(15,2) DEFAULT 0,
  total_penalites NUMERIC(15,2) DEFAULT 0,
  total_droits_payes NUMERIC(15,2) DEFAULT 0,

  -- PAIEMENT
  mode_paiement TEXT DEFAULT 'especes',
  reference_cheque TEXT,
  lieu_signature TEXT DEFAULT 'Brazzaville',
  date_signature DATE DEFAULT CURRENT_DATE,

  -- MÉTADONNÉES
  statut TEXT DEFAULT 'brouillon'
    CHECK (statut IN ('brouillon','complete','soumise','validee')),
  date_declaration DATE DEFAULT CURRENT_DATE,
  date_limite DATE,
  pdf_url TEXT,
  pre_rempli BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE (tenant_id, mois, annee)
);

ALTER TABLE declarations_generales ENABLE ROW LEVEL SECURITY;

CREATE POLICY "decl_gen_select" ON declarations_generales
  FOR SELECT USING (tenant_id = (
    SELECT tenant_id FROM profiles WHERE user_id = auth.uid()
    ORDER BY created_at ASC LIMIT 1
  ));
CREATE POLICY "decl_gen_insert" ON declarations_generales
  FOR INSERT WITH CHECK (tenant_id = (
    SELECT tenant_id FROM profiles WHERE user_id = auth.uid()
    ORDER BY created_at ASC LIMIT 1
  ));
CREATE POLICY "decl_gen_update" ON declarations_generales
  FOR UPDATE USING (tenant_id = (
    SELECT tenant_id FROM profiles WHERE user_id = auth.uid()
    ORDER BY created_at ASC LIMIT 1
  ));

CREATE INDEX IF NOT EXISTS idx_decl_gen_tenant  ON declarations_generales(tenant_id);
CREATE INDEX IF NOT EXISTS idx_decl_gen_periode ON declarations_generales(annee DESC, mois DESC);

-- Trigger updated_at
CREATE OR REPLACE FUNCTION update_decl_gen_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

CREATE TRIGGER trg_decl_gen_updated_at
  BEFORE UPDATE ON declarations_generales
  FOR EACH ROW EXECUTE FUNCTION update_decl_gen_updated_at();

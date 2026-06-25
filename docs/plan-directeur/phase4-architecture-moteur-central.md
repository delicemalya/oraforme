# PHASE 4 — MOTEUR D'ÉVÉNEMENTS COMPTABLES UNIQUE
## Architecture Cible — Plan Directeur Oraforme

> **Version :** 1.0 — Plan Directeur Phase 4  
> **Prérequis :** Phase 3 (catalogue des événements) complété et validé  
> **Objectif :** Zéro écriture directe dans journal_entries depuis un module métier

---

## PRINCIPE FONDAMENTAL

```
┌─────────────────────────────────────────────────────────────────────┐
│                       MODULES MÉTIER                                │
│  Facturation │ Paie │ Santé │ Restaurant │ École │ Hôtel │ …        │
└─────────────────────────────┬───────────────────────────────────────┘
                              │ emit_accounting_event(type, data)
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                   TABLE accounting_events                           │
│           (journal d'événements immuable — append-only)            │
└─────────────────────────────┬───────────────────────────────────────┘
                              │ AFTER INSERT trigger
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│              fn_process_accounting_event()                          │
│              MOTEUR COMPTABLE CENTRAL                               │
│                                                                     │
│  1. Résoudre les règles SYSCOHADA depuis accounting_event_rules     │
│  2. Calculer les montants (HT, TVA, net, etc.)                      │
│  3. Valider les comptes (débit ≠ crédit, montant > 0)               │
│  4. Générer les écritures journal_entries                           │
│  5. Créer la ligne transactions (trésorerie)                        │
│  6. Déclencher fn_sync_tresorerie_soldes si tréso impactée          │
└──────┬──────────────────────┬────────────────────────┬──────────────┘
       │                      │                        │
       ▼                      ▼                        ▼
┌─────────────┐   ┌───────────────────┐   ┌───────────────────────┐
│journal_entries│ │   transactions    │   │ accounting_event_log  │
│(OHADA double │ │  (tréso rapide)   │   │ (audit trail complet) │
│  entry)      │ └───────────────────┘   └───────────────────────┘
└──────┬───────┘
       │
       ▼
┌──────────────────────────────────────────────────────────────┐
│              VUES & AGRÉGATS                                  │
│  vue_tresorerie_unifiee │ vue_grand_livre │ vue_balance_xxx  │
│  vue_fiscalite_tva      │ vue_is          │ vue_bilan        │
└──────────────────────────────────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────────────────────────────┐
│              SORTIES                                          │
│  Dashboards │ Rapports SYSCOHADA │ États financiers          │
│  Export DGI │ Audit OHADA        │ Balance générale          │
└──────────────────────────────────────────────────────────────┘
```

---

## SCHÉMA SQL — TABLES DU MOTEUR CENTRAL

### Table 1 — accounting_events (Journal d'événements)

```sql
CREATE TABLE accounting_events (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID        NOT NULL REFERENCES tenants(id),
  
  -- Identification de l'événement
  event_type      TEXT        NOT NULL,  -- 'FAC-001', 'PAI-001', 'SAN-001', etc.
  event_code      TEXT        GENERATED ALWAYS AS (split_part(event_type, '-', 1)) STORED,
  
  -- Source métier
  source_module   TEXT        NOT NULL,  -- 'facturation', 'paie', 'sante', etc.
  source_table    TEXT        NOT NULL,  -- 'factures', 'bulletins_paie', etc.
  source_id       UUID        NOT NULL,  -- ID de l'enregistrement source
  
  -- Données financières brutes
  montant_ht      NUMERIC(14,2) NOT NULL DEFAULT 0,
  montant_tva     NUMERIC(14,2) NOT NULL DEFAULT 0,
  montant_ttc     NUMERIC(14,2) NOT NULL DEFAULT 0,
  montant_net     NUMERIC(14,2),  -- Optionnel (net paie, etc.)
  
  -- Contexte
  devise          TEXT        NOT NULL DEFAULT 'XAF',
  fiscal_year     INT         NOT NULL,
  date_event      DATE        NOT NULL DEFAULT CURRENT_DATE,
  libelle         TEXT        NOT NULL,
  
  -- Métadonnées additionnelles (JSONB pour flexibilité)
  metadata        JSONB       NOT NULL DEFAULT '{}',
  -- Exemples metadata:
  -- {"mode_paiement": "virement", "employe_id": "uuid", "mois": 6, "annee": 2026}
  -- {"client_name": "AMD Finance", "invoice_number": "FAC-001"}
  -- {"patient_id": "uuid", "medecin_id": "uuid"}
  
  -- Statut de traitement
  status          TEXT        NOT NULL DEFAULT 'pending',
  -- pending → processing → processed | error
  processed_at    TIMESTAMPTZ,
  error_message   TEXT,
  retry_count     INT         NOT NULL DEFAULT 0,
  
  -- Audit
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by      UUID,  -- user_id si disponible
  
  -- Contraintes
  CONSTRAINT chk_montant_positif CHECK (montant_ttc >= 0),
  CONSTRAINT chk_status CHECK (status IN ('pending','processing','processed','error')),
  CONSTRAINT chk_event_type CHECK (event_type ~ '^[A-Z]{2,5}-[0-9]{3}$')
);

-- Index performance
CREATE INDEX idx_ae_tenant_date    ON accounting_events (tenant_id, date_event DESC);
CREATE INDEX idx_ae_source         ON accounting_events (source_table, source_id);
CREATE INDEX idx_ae_event_type     ON accounting_events (event_type);
CREATE INDEX idx_ae_status         ON accounting_events (status) WHERE status != 'processed';
CREATE INDEX idx_ae_fiscal_year    ON accounting_events (tenant_id, fiscal_year);

-- RLS
ALTER TABLE accounting_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY ae_tenant_isolation ON accounting_events
  USING (tenant_id = get_my_tenant_id());
```

---

### Table 2 — accounting_event_rules (Règles SYSCOHADA par événement)

```sql
CREATE TABLE accounting_event_rules (
  id            UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type    TEXT    NOT NULL,  -- 'FAC-001'
  sequence      INT     NOT NULL,  -- Ordre des écritures (1, 2, 3...)
  
  -- Comptes SYSCOHADA
  debit_account   TEXT  NOT NULL,  -- '411', '661', '521', etc.
  credit_account  TEXT  NOT NULL,  -- '706', '421', '4441', etc.
  
  -- Résolution du montant
  montant_field   TEXT  NOT NULL,
  -- 'montant_ht'   → utilise montant_ht de l'événement
  -- 'montant_tva'  → utilise montant_tva
  -- 'montant_ttc'  → utilise montant_ttc
  -- 'montant_net'  → utilise montant_net
  -- 'metadata.cnss_patronal' → cherche dans metadata JSONB
  
  -- Source pour journal_entries.source
  source_label  TEXT  NOT NULL,  -- 'factures_emises', 'paie_accrual', etc.
  
  -- Libellé de l'écriture (template)
  libelle_tpl   TEXT  NOT NULL,  -- 'Facture {invoice_number} — {client_name} — HT'
  
  -- Conditions
  condition_field   TEXT,  -- Champ metadata à vérifier
  condition_op      TEXT,  -- '>', '=', '!='
  condition_value   TEXT,  -- Valeur seuil
  -- Ex: condition_field='montant_tva', condition_op='>', condition_value='0'
  --     → n'écrire cette ligne QUE si tva > 0
  
  -- Résolution dynamique du compte trésorerie
  account_resolver  TEXT,  -- 'fn_ohada_cash_account(metadata.mode_paiement)'
  
  -- Validité
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  valid_from  DATE,
  valid_until DATE,
  
  -- Scope pays (null = tous)
  country_codes TEXT[],  -- ['CG', 'CM', 'GA'] ou NULL pour tous
  
  UNIQUE (event_type, sequence),
  CONSTRAINT chk_accounts CHECK (debit_account != credit_account)
);

-- Données initiales — règles SYSCOHADA pour les 52 événements du catalogue Phase 3
-- (voir section SEED ci-dessous)
```

---

### Table 3 — accounting_event_log (Audit trail)

```sql
CREATE TABLE accounting_event_log (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id        UUID        NOT NULL REFERENCES accounting_events(id),
  tenant_id       UUID        NOT NULL,
  
  -- Écritures générées
  journal_entry_ids UUID[],   -- IDs des journal_entries créés
  transaction_id    UUID,     -- ID de la transaction créée
  
  -- Résumé
  entries_count   INT,
  total_debit     NUMERIC(14,2),
  total_credit    NUMERIC(14,2),
  balanced        BOOLEAN GENERATED ALWAYS AS (total_debit = total_credit) STORED,
  
  -- Timing
  processed_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  duration_ms     INT,  -- Performance monitoring
  
  -- Audit
  rules_applied   JSONB  -- Snapshot des règles utilisées au moment du traitement
);

CREATE INDEX idx_ael_event ON accounting_event_log (event_id);
CREATE INDEX idx_ael_tenant ON accounting_event_log (tenant_id, processed_at DESC);
```

---

## MOTEUR CENTRAL — fn_process_accounting_event()

```sql
CREATE OR REPLACE FUNCTION fn_process_accounting_event()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_rule          RECORD;
  v_montant       NUMERIC(14,2);
  v_debit         TEXT;
  v_credit        TEXT;
  v_libelle       TEXT;
  v_source        TEXT;
  v_je_id         UUID;
  v_je_ids        UUID[] := '{}';
  v_tx_id         UUID;
  v_total_debit   NUMERIC(14,2) := 0;
  v_total_credit  NUMERIC(14,2) := 0;
  v_start_time    TIMESTAMPTZ := clock_timestamp();
  v_log_id        UUID;
  v_condition_ok  BOOLEAN;
BEGIN
  -- Marquer comme en traitement (évite les re-entrées)
  UPDATE accounting_events SET status = 'processing' WHERE id = NEW.id;
  
  -- Parcourir les règles dans l'ordre
  FOR v_rule IN
    SELECT * FROM accounting_event_rules
    WHERE event_type = NEW.event_type
      AND is_active = TRUE
      AND (valid_from IS NULL OR valid_from <= NEW.date_event)
      AND (valid_until IS NULL OR valid_until >= NEW.date_event)
      AND (country_codes IS NULL OR 
           (NEW.metadata->>'country_code') = ANY(country_codes))
    ORDER BY sequence
  LOOP
    -- Évaluer la condition (si présente)
    v_condition_ok := TRUE;
    IF v_rule.condition_field IS NOT NULL THEN
      v_condition_ok := fn_eval_condition(
        NEW.metadata,
        NEW.montant_ht, NEW.montant_tva, NEW.montant_ttc, NEW.montant_net,
        v_rule.condition_field, v_rule.condition_op, v_rule.condition_value
      );
    END IF;
    
    IF NOT v_condition_ok THEN CONTINUE; END IF;
    
    -- Résoudre le montant
    v_montant := fn_resolve_montant(
      NEW.montant_ht, NEW.montant_tva, NEW.montant_ttc, NEW.montant_net,
      NEW.metadata, v_rule.montant_field
    );
    
    IF v_montant <= 0 THEN CONTINUE; END IF;  -- Ne pas créer d'écritures nulles
    
    -- Résoudre les comptes (dynamique si account_resolver)
    v_debit  := COALESCE(fn_resolve_account(v_rule.debit_account,  NEW.metadata), v_rule.debit_account);
    v_credit := COALESCE(fn_resolve_account(v_rule.credit_account, NEW.metadata), v_rule.credit_account);
    
    -- Résoudre le libellé (substitution de variables)
    v_libelle := fn_resolve_libelle(v_rule.libelle_tpl, NEW.metadata, NEW.libelle);
    
    -- Résoudre la source
    v_source := v_rule.source_label;
    
    -- Insérer l'écriture journal_entries
    INSERT INTO journal_entries (
      tenant_id, date_operation, libelle,
      debit_account, credit_account, montant,
      source, source_id, fiscal_year,
      piece_number
    ) VALUES (
      NEW.tenant_id, NEW.date_event, v_libelle,
      v_debit, v_credit, v_montant,
      v_source, NEW.source_id, NEW.fiscal_year,
      NEW.metadata->>'piece_number'
    )
    RETURNING id INTO v_je_id;
    
    v_je_ids := array_append(v_je_ids, v_je_id);
    v_total_debit  := v_total_debit  + v_montant;
    v_total_credit := v_total_credit + v_montant;
  END LOOP;
  
  -- Créer la ligne transactions si impact trésorerie (event_code détecte le type)
  IF fn_event_has_treasury_impact(NEW.event_type) THEN
    INSERT INTO transactions (
      tenant_id, type, categorie, description, montant, date,
      mode_paiement, source, source_id, fiscal_year
    ) VALUES (
      NEW.tenant_id,
      CASE WHEN fn_event_is_income(NEW.event_type) THEN 'entree' ELSE 'sortie' END,
      fn_event_category(NEW.event_type),
      NEW.libelle,
      NEW.montant_ttc,
      NEW.date_event,
      COALESCE(NEW.metadata->>'mode_paiement', 'virement'),
      NEW.source_module,
      NEW.source_id,
      NEW.fiscal_year
    )
    RETURNING id INTO v_tx_id;
  END IF;
  
  -- Synchroniser la trésorerie si comptes 5xx impliqués
  IF fn_event_touches_treasury(NEW.event_type) THEN
    PERFORM fn_sync_tresorerie_soldes(NEW.tenant_id);
  END IF;
  
  -- Log d'audit
  INSERT INTO accounting_event_log (
    event_id, tenant_id, journal_entry_ids, transaction_id,
    entries_count, total_debit, total_credit,
    duration_ms, rules_applied
  ) VALUES (
    NEW.id, NEW.tenant_id, v_je_ids, v_tx_id,
    array_length(v_je_ids, 1), v_total_debit, v_total_credit,
    EXTRACT(MILLISECONDS FROM (clock_timestamp() - v_start_time))::INT,
    (SELECT jsonb_agg(row_to_json(r)) FROM accounting_event_rules r WHERE r.event_type = NEW.event_type)
  ) RETURNING id INTO v_log_id;
  
  -- Marquer comme traité
  UPDATE accounting_events
  SET status = 'processed', processed_at = NOW()
  WHERE id = NEW.id;
  
  RETURN NEW;
  
EXCEPTION WHEN OTHERS THEN
  -- Gestion d'erreur : marquer en erreur, ne pas faire remonter (évite rollback source)
  UPDATE accounting_events
  SET status = 'error',
      error_message = SQLERRM,
      retry_count = retry_count + 1
  WHERE id = NEW.id;
  
  RAISE WARNING 'fn_process_accounting_event: error for event % (type %): %',
    NEW.id, NEW.event_type, SQLERRM;
  
  RETURN NEW;
END;
$$;

-- Trigger sur accounting_events
CREATE TRIGGER trg_process_accounting_event
  AFTER INSERT ON accounting_events
  FOR EACH ROW
  WHEN (NEW.status = 'pending')
  EXECUTE FUNCTION fn_process_accounting_event();
```

---

## FONCTION D'ÉMISSION — emit_accounting_event()

```sql
-- Fonction centrale que chaque module appellera
CREATE OR REPLACE FUNCTION emit_accounting_event(
  p_tenant_id     UUID,
  p_event_type    TEXT,
  p_source_module TEXT,
  p_source_table  TEXT,
  p_source_id     UUID,
  p_montant_ht    NUMERIC(14,2) DEFAULT 0,
  p_montant_tva   NUMERIC(14,2) DEFAULT 0,
  p_montant_ttc   NUMERIC(14,2) DEFAULT 0,
  p_montant_net   NUMERIC(14,2) DEFAULT NULL,
  p_libelle       TEXT DEFAULT '',
  p_date_event    DATE DEFAULT CURRENT_DATE,
  p_fiscal_year   INT DEFAULT NULL,
  p_metadata      JSONB DEFAULT '{}'
) RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_event_id UUID;
  v_year     INT := COALESCE(p_fiscal_year, EXTRACT(YEAR FROM p_date_event)::INT);
BEGIN
  -- Idempotence : ne pas réémettre si déjà traité pour ce source_id + event_type
  IF EXISTS (
    SELECT 1 FROM accounting_events
    WHERE tenant_id    = p_tenant_id
      AND event_type   = p_event_type
      AND source_table = p_source_table
      AND source_id    = p_source_id
      AND status       = 'processed'
  ) THEN
    RAISE NOTICE 'emit_accounting_event: event % for %/% already processed, skipping',
      p_event_type, p_source_table, p_source_id;
    RETURN NULL;
  END IF;
  
  INSERT INTO accounting_events (
    tenant_id, event_type, source_module, source_table, source_id,
    montant_ht, montant_tva, montant_ttc, montant_net,
    libelle, date_event, fiscal_year, metadata
  ) VALUES (
    p_tenant_id, p_event_type, p_source_module, p_source_table, p_source_id,
    p_montant_ht, p_montant_tva, p_montant_ttc, p_montant_net,
    p_libelle, p_date_event, v_year, p_metadata
  )
  RETURNING id INTO v_event_id;
  
  RETURN v_event_id;
END;
$$;
```

---

## USAGE PAR LES MODULES — PATTERN D'INTÉGRATION

### Pattern A — Remplacement d'un trigger existant

Avant (ancien trigger dans migration 046) :
```sql
-- Trigger fn_facture_issued_to_journal → INSERT journal_entries direct
INSERT INTO journal_entries (debit_account, credit_account, ...) VALUES ('411', '706', ...);
INSERT INTO journal_entries (debit_account, credit_account, ...) VALUES ('411', '4441', ...);
```

Après (nouveau trigger) :
```sql
CREATE OR REPLACE FUNCTION fn_facture_issued_v2()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE v_ht NUMERIC; v_tva NUMERIC;
BEGIN
  IF (OLD.statut IS DISTINCT FROM 'envoyee') AND NEW.statut = 'envoyee' THEN
    v_tva := COALESCE(NEW.tva_montant, 0);
    v_ht  := GREATEST(COALESCE(NEW.total, 0) - v_tva, 0);
    
    PERFORM emit_accounting_event(
      p_tenant_id    := NEW.tenant_id,
      p_event_type   := 'FAC-001',
      p_source_module:= 'facturation',
      p_source_table := 'factures',
      p_source_id    := NEW.id,
      p_montant_ht   := v_ht,
      p_montant_tva  := v_tva,
      p_montant_ttc  := COALESCE(NEW.total, 0),
      p_libelle      := 'Facture ' || COALESCE(NEW.invoice_number, NEW.id::TEXT),
      p_date_event   := COALESCE(NEW.due_date, CURRENT_DATE),
      p_metadata     := jsonb_build_object(
        'invoice_number', NEW.invoice_number,
        'client_name',    NEW.client_name,
        'mode_paiement',  'virement'
      )
    );
  END IF;
  RETURN NEW;
END;
$$;
```

### Pattern B — Depuis TypeScript (routes API)

```typescript
// Avant (écriture directe)
await supabaseAdmin.from('journal_entries').insert([
  { debit_account: '411', credit_account: '706', montant: ht, ... },
  { debit_account: '411', credit_account: '4441', montant: tva, ... },
])

// Après (émission d'événement)
await supabaseAdmin.rpc('emit_accounting_event', {
  p_tenant_id:     ctx.tenantId,
  p_event_type:    'FAC-001',
  p_source_module: 'facturation',
  p_source_table:  'factures',
  p_source_id:     facture.id,
  p_montant_ht:    ht,
  p_montant_tva:   tva,
  p_montant_ttc:   ttc,
  p_libelle:       `Facture ${invoice_number} — ${client_name}`,
  p_metadata: {
    invoice_number,
    client_name,
    mode_paiement,
    piece_number: invoice_number,
  }
})
```

### Pattern C — Nouveau module (dès le premier jour)

```typescript
// Nouveau module Hôtel — HOT-003 Check-out
export async function POST(req: NextRequest) {
  // ... logique métier (créer le checkout, calculer le total, etc.)
  
  // Émettre l'événement comptable — c'est TOUT ce que le module doit faire
  await supabaseAdmin.rpc('emit_accounting_event', {
    p_tenant_id:     ctx.tenantId,
    p_event_type:    'HOT-003',
    p_source_module: 'hotel',
    p_source_table:  'hotel_reservations',
    p_source_id:     reservation.id,
    p_montant_ht:    ht,
    p_montant_tva:   tva,
    p_montant_ttc:   ttc,
    p_libelle:       `Séjour — ${client_name} — Chambre ${chambre}`,
    p_metadata: {
      client_name,
      chambre_numero: chambre,
      mode_paiement,
      acompte_verse: acompte,
      date_arrivee,
      date_depart,
    }
  })
  
  // Pas d'autre écriture comptable à faire — le moteur central s'occupe du reste
}
```

---

## DONNÉES INITIALES — accounting_event_rules (SEED)

```sql
-- ── FAC-001 — Facture Émise ──────────────────────────────────────────────────
INSERT INTO accounting_event_rules (event_type, sequence, debit_account, credit_account, montant_field, source_label, libelle_tpl, condition_field, condition_op, condition_value) VALUES
('FAC-001', 1, '411', '706',  'montant_ht',  'factures_emises', 'Facture {invoice_number} — {client_name} — HT',  'montant_ht',  '>', '0'),
('FAC-001', 2, '411', '4441', 'montant_tva', 'factures_tva',    'Facture {invoice_number} — {client_name} — TVA', 'montant_tva', '>', '0'),
('FAC-001', 3, '411', '447',  'metadata.ca_montant', 'factures_emises', 'Facture {invoice_number} — {client_name} — CA 5%', 'metadata.ca_montant', '>', '0');

-- ── FAC-002 — Facture Payée ──────────────────────────────────────────────────
INSERT INTO accounting_event_rules (event_type, sequence, debit_account, credit_account, montant_field, source_label, libelle_tpl, account_resolver) VALUES
('FAC-002', 1, 'TRESO', '411', 'montant_ttc', 'factures_paiement', 'Règlement facture {invoice_number}', 'fn_ohada_cash_account(metadata.mode_paiement)');

-- ── PAI-001 — Bulletin Généré ────────────────────────────────────────────────
INSERT INTO accounting_event_rules (event_type, sequence, debit_account, credit_account, montant_field, source_label, libelle_tpl, condition_field, condition_op, condition_value) VALUES
('PAI-001', 1, '661', '421', 'montant_ht',          'paie_accrual',  'Paie {mois}/{annee} — {employe_nom}',  'montant_ht',  '>', '0'),
('PAI-001', 2, '664', '431', 'metadata.cnss_patron', 'paie_cnss',    'CNSS patronal {mois} — {employe_nom}', 'metadata.cnss_patron', '>', '0'),
('PAI-001', 3, '421', '431', 'metadata.cnss_sal',    'paie_cnss_sal','CNSS salariale {mois} — {employe_nom}','metadata.cnss_sal', '>', '0'),
('PAI-001', 4, '421', '447', 'metadata.irpp',        'paie_irpp',    'IRPP {mois} — {employe_nom}',          'metadata.irpp', '>', '0');

-- ── PAI-002 — Bulletin Payé ──────────────────────────────────────────────────
INSERT INTO accounting_event_rules (event_type, sequence, debit_account, credit_account, montant_field, source_label, libelle_tpl, account_resolver) VALUES
('PAI-002', 1, '421', 'TRESO', 'montant_net', 'paie_paiement', 'Paiement paie {mois}/{annee} — {employe_nom}', 'fn_ohada_cash_account(metadata.mode_paiement)');

-- ── FIS-001 — Déclaration TVA validée ───────────────────────────────────────
INSERT INTO accounting_event_rules (event_type, sequence, debit_account, credit_account, montant_field, source_label, libelle_tpl) VALUES
('FIS-001', 1, '4441', '444', 'montant_ht', 'tva_declaration', 'TVA {mois}/{annee} — solde TVA');

-- ── FIS-002 — Paiement TVA DGI ──────────────────────────────────────────────
INSERT INTO accounting_event_rules (event_type, sequence, debit_account, credit_account, montant_field, source_label, libelle_tpl) VALUES
('FIS-002', 1, '444', '521', 'montant_ttc', 'tva_paiement', 'TVA {mois}/{annee} — paiement DGI');

-- ── SAN-001 — Consultation Payée ────────────────────────────────────────────
INSERT INTO accounting_event_rules (event_type, sequence, debit_account, credit_account, montant_field, source_label, libelle_tpl, account_resolver) VALUES
('SAN-001', 1, 'TRESO', '706', 'montant_ttc', 'sante_consultation', 'Consultation — {patient_nom} — {date_consult}', 'fn_ohada_cash_account(metadata.mode_paiement)');

-- ── RES-001 — Vente POS Restaurant ──────────────────────────────────────────
INSERT INTO accounting_event_rules (event_type, sequence, debit_account, credit_account, montant_field, source_label, libelle_tpl, condition_field, condition_op, condition_value) VALUES
('RES-001', 1, '571', '701',  'montant_ht',  'resto_vente', 'Vente POS — {ticket_number}', 'montant_ht',  '>', '0'),
('RES-001', 2, '571', '4441', 'montant_tva', 'resto_tva',   'TVA restauration — {ticket_number}', 'montant_tva', '>', '0');

-- (les autres événements sont ajoutés progressivement à mesure que les modules sont migrés)
```

---

## STRATÉGIE DE MIGRATION — LES 4 PHASES

### Phase 4.0 — Infrastructure (Migration 138)
- Créer tables `accounting_events`, `accounting_event_rules`, `accounting_event_log`
- Créer fonctions `emit_accounting_event()`, `fn_process_accounting_event()`
- Fonctions utilitaires : `fn_resolve_montant()`, `fn_resolve_account()`, `fn_resolve_libelle()`
- Seed initial des règles pour FAC-001/002, PAI-001/002, FIS-001/002
- **Les anciens triggers restent actifs** — aucune rupture

### Phase 4.1 — Nouveaux modules (immédiat)
- Tout nouveau module développé utilise `emit_accounting_event()` dès le premier jour
- Aucun INSERT direct dans journal_entries autorisé pour les nouveaux modules
- Checklist obligatoire : `event_type` dans le catalogue Phase 3, règles dans `accounting_event_rules`

### Phase 4.2 — Migration modules partiels (priorité haute)
Modules sans journal_entries automatique :
1. Santé / Consultations → SAN-001 (remplace INSERT transactions direct)
2. Restaurant POS → RES-001 (remplace INSERT transactions direct)
3. ONG / Dons → ONG-001
4. Transport → TRP-001

### Phase 4.3 — Migration triggers existants (progressif)
Pour chaque trigger de migration 046 :
1. Créer le nouvel event_type dans le catalogue
2. Ajouter les règles dans accounting_event_rules
3. Réécrire le trigger pour appeler emit_accounting_event()
4. Supprimer les INSERT directs
5. Valider avec requête de comparaison (journal_entries avant/après)

Ordre recommandé : TRE (simples), SAN, RES, ECO, puis FAC (critique, dernier)

### Phase 4.4 — Routes TypeScript (final)
- `app/api/factures/route.ts` → utilise emit_accounting_event() au lieu d'INSERT direct
- `app/dashboard/comptabilite/journal/page.tsx` → émission événement type 'MANUEL-001'
- `app/dashboard/ecole/scolarite/page.tsx` → émission ECO-001

---

## RÈGLES ABSOLUES DU MOTEUR CENTRAL

1. **Un module = des événements, jamais des écritures**  
   Un module métier ne connaît pas les comptes SYSCOHADA. Il émet un événement avec les montants bruts.

2. **Idempotence obligatoire**  
   Émettre deux fois FAC-001 pour la même facture ne crée qu'une seule série d'écritures.

3. **Résilience**  
   Une erreur dans le moteur NE DOIT PAS faire échouer la transaction métier. Les événements en erreur sont retentés.

4. **Traçabilité complète**  
   Chaque écriture journal_entries a un `source_id` = event UUID dans accounting_events. Chaîne complète : `facture.id → accounting_event.id → journal_entry.id`.

5. **Pas de modification des règles en production sans migration**  
   Les `accounting_event_rules` sont des données de configuration versionnées, pas du code.

6. **Multi-pays natif**  
   Les règles supportent `country_codes[]` — un même événement peut avoir des règles différentes selon le pays (taux TVA, CA 5%, IRPP).

7. **SYSCOHADA uniquement**  
   Tous les comptes dans accounting_event_rules sont en format 3/4 chiffres normalisé (post-migration 137).

---

## DASHBOARDS ET ÉTATS ALIMENTÉS

| Sortie | Source principale | Requête clé |
|--------|------------------|-------------|
| Tableau de bord comptabilité | journal_entries | GROUP BY debit/credit_account |
| Balance générale | journal_entries | SUM(montant) GROUP BY account |
| Grand livre | vue_grand_livre | journal_entries JOIN account labels |
| Trésorerie | vue_tresorerie_unifiee | WHERE account IN ('521','571','5711','5712') |
| Bilan | journal_entries | classe 1, 2, 3, 4, 5 |
| Compte de résultat | journal_entries | classe 6, 7 |
| TAFIRE | journal_entries + transactions | flux = delta trésorerie |
| TVA collectée | journal_entries | WHERE credit_account = '4441' |
| TVA déductible | journal_entries | WHERE debit_account IN ('4445','4446') |
| Masse salariale | journal_entries | WHERE debit_account = '661' |
| Déclaration IS | journal_entries | classe 6 charges - classe 7 produits |
| Rapport par événement | accounting_events + log | JOIN event_type, source_module |

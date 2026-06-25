# Phase 4.5 — Business Event Engine
## Architecture d'événements métier global pour Oraforme ERP

**Version** : 1.0.0  
**Date** : 2026-06-25  
**Auteur** : Plan Directeur Oraforme  
**Statut** : CONCEPTION — à valider avant migration 138.5

---

## RESSOURCES MOBILISÉES

- Skill **ohada-comptabilite** : positionnement du moteur SYSCOHADA dans l'architecture globale
- Skill **fiscalite-cemac** : handlers fiscaux multi-pays
- Skill **audit-comptable** : AuditHandler + traçabilité totale
- Skill **controle-gestion** : AnalyticsHandler + KPIs temps réel
- Skill **finance-entreprise** : TreasuryHandler + flux de trésorerie
- Migration 138 v2 : sous-système AccountingHandler existant (non modifié)
- ARR-138 : patterns de concurrence + idempotence réutilisés

---

## TABLE DES MATIÈRES

1. [Vision et problème résolu](#1-vision)
2. [Architecture cible — Vue globale](#2-architecture)
3. [Positionnement du moteur comptable](#3-positionnement)
4. [Modèle de données Business Events](#4-modele-donnees)
5. [Interface Business Event ↔ Accounting Event](#5-interface)
6. [Système de handlers extensibles](#6-handlers)
7. [Flux détaillés par scénario](#7-flux)
8. [Migration 138.5 vs évolution progressive](#8-migration)
9. [Plan d'implémentation progressif](#9-plan)
10. [Checklist de validation Go-Live 138.5](#10-checklist)

---

## 1. VISION ET PROBLÈME RÉSOLU

### 1.1 Situation actuelle (après migration 138)

```
Module Facturation ─────────────────────────────► emit_accounting_event()
Module Santé        ─────────────────────────────► emit_accounting_event()
Module Restaurant   ─────────────────────────────► emit_accounting_event()
Module Paie         ─── fn_bulletins_paie_to_journal() (trigger direct)
```

**Chaque module connaît le moteur comptable.** Mais le moteur comptable ne sait rien du reste.

Conséquences :
- Un événement "facture émise" alimente la comptabilité — mais pas les KPIs, pas les notifications client, pas MIAA+, pas le CRM, pas le stock
- Pour ajouter un nouveau domaine fonctionnel (ex: notifications), il faut modifier chaque module
- La logique de dispatch est éparpillée dans chaque module métier

### 1.2 Objectif de la Phase 4.5

Introduire un **Business Event Engine** : couche d'orchestration qui reçoit un fait métier et décide quels sous-systèmes en ont besoin.

```
Module Facturation ──► emit_business_event('FAC-ISSUED', ...)
                              │
                              ▼
                  ┌─── Business Event Engine ───┐
                  │                             │
              dispatch()                   dispatch()
                  │                             │
          AccountingHandler           NotificationHandler
                  │                             │
          emit_accounting_event()       send_email/push()
                  │
          fn_ae_execute_event()
                  │
          journal_entries ✓
```

**Un seul point d'émission. Zéro couplage entre modules.**

### 1.3 Principes directeurs

| Principe | Contrainte concrète |
|----------|---------------------|
| **Non-regression** | La migration 138 n'est pas modifiée. `emit_accounting_event()` reste valide. |
| **Progressivité** | Les modules peuvent migrer un par un vers `emit_business_event()` |
| **Isolation des pannes** | L'échec d'un handler n'affecte pas les autres |
| **Idempotence** | Même business event traité deux fois → résultat identique |
| **Observabilité** | Chaque handler laisse une trace dans business_event_handler_log |
| **Extensibilité** | Ajouter un handler = insérer une ligne dans business_event_handler_configs |

---

## 2. ARCHITECTURE CIBLE — VUE GLOBALE

```
╔══════════════════════════════════════════════════════════════════════════════╗
║                        MODULES MÉTIER ORAFORME                              ║
║                                                                              ║
║  [Facturation] [Santé] [Restaurant] [École] [Commerce] [Transport] [Hôtel] ║
║  [Paie/RH]     [Stock] [ONG]        [Cabinet] [Fiscalité] [Trésorerie]     ║
╚══════════════════════════════════════════════════════════════════════════════╝
                              │
                    emit_business_event()
                    (point d'entrée unique)
                              │
                              ▼
╔══════════════════════════════════════════════════════════════════════════════╗
║                    BUSINESS EVENT ENGINE (Phase 4.5)                        ║
║                                                                              ║
║  ┌─────────────────────────────────────────────────────────────────────┐    ║
║  │                      business_events                                │    ║
║  │  id | tenant_id | event_type | source_module | metadata | status    │    ║
║  └─────────────────────────────────────────────────────────────────────┘    ║
║                              │                                               ║
║              fn_process_business_event() [TRIGGER AFTER INSERT]             ║
║                              │                                               ║
║              fn_dispatch_to_handlers(business_event_id)                     ║
║                              │                                               ║
║      ┌──────────┬────────────┼──────────────┬───────────────┐              ║
║      ▼          ▼            ▼              ▼               ▼              ║
║  [handler]  [handler]    [handler]      [handler]       [handler]          ║
╚══════════════════════════════════════════════════════════════════════════════╝
      │          │            │              │               │
      ▼          ▼            ▼              ▼               ▼
╔══════╗  ╔══════════╗  ╔═════════╗  ╔══════════╗  ╔═════════════════╗
║  A   ║  ║    B     ║  ║   C     ║  ║    D     ║  ║       E         ║
║ Acc. ║  ║Treasury  ║  ║Inventory║  ║   CRM    ║  ║ Notification    ║
║Hand. ║  ║ Handler  ║  ║ Handler ║  ║ Handler  ║  ║   Handler       ║
╚══════╝  ╚══════════╝  ╚═════════╝  ╚══════════╝  ╚═════════════════╝
    │
    ▼
emit_accounting_event()          ◄── Moteur comptable Phase 4.0 (138)
    │                                INCHANGÉ — juste un sous-système
    ▼
accounting_events ──► fn_ae_execute_event()
    │
    ▼
journal_entries + accounting_event_log

╔══════╗  ╔══════════╗  ╔═════════╗
║  F   ║  ║    G     ║  ║   H     ║
║Analy-║  ║    AI    ║  ║  Audit  ║
║tics  ║  ║(MIAA+)   ║  ║ Handler ║
║Hand. ║  ║ Handler  ║  ║         ║
╚══════╝  ╚══════════╝  ╚═════════╝
    │          │              │
    ▼          ▼              ▼
kpi_snapshots  ai_events  business_event_audit_log
```

### 2.1 Légende des handlers

| Code | Handler | Rôle | Déclencheurs principaux |
|------|---------|------|------------------------|
| **A** | AccountingHandler | Écritures SYSCOHADA via migration 138 | Tous les events avec impact financier |
| **B** | TreasuryHandler | Mouvements de trésorerie, soldes | FAC-PAID, TRE-*, MOB-* |
| **C** | InventoryHandler | Niveaux de stock, valorisation | COM-PURCHASE, COM-SALE, HOT-CHECKOUT |
| **D** | CRMHandler | Historique client, scoring, segments | FAC-*, SAN-*, ECO-*, HOT-* |
| **E** | NotificationHandler | Email, SMS, push, webhook | FAC-ISSUED, SAN-APPT, PAI-SLIP |
| **F** | AnalyticsHandler | KPIs temps réel, snapshots | Tous les events revenue/cost |
| **G** | AIHandler (MIAA+) | Patterns, anomalies, prédictions | Tous les events |
| **H** | AuditHandler | Traçabilité complète cross-domaines | Tous les events |

---

## 3. POSITIONNEMENT DU MOTEUR COMPTABLE

### 3.1 Avant (Phase 4.0)

```
Module ──► emit_accounting_event() ──► accounting_events ──► journal_entries
```

Le moteur comptable EST le système d'événements.

### 3.2 Après (Phase 4.5)

```
Module ──► emit_business_event() ──► business_events
                                           │
                                    AccountingHandler
                                           │
                                    emit_accounting_event()
                                           │
                                    accounting_events ──► journal_entries
```

Le moteur comptable DEVIENT un handler. Il est inchangé intérieurement.

### 3.3 Rôle exact du moteur comptable (migration 138)

Le moteur comptable (migration 138) reste le **seul responsable** de :
- La sélection des règles SYSCOHADA (`accounting_event_rules`)
- La génération des écritures (`journal_entries`)
- La validation de l'équilibre débit/crédit
- L'audit trail comptable (`accounting_event_log`)
- Les extournes et replays

Il n'est **jamais** responsable de :
- Savoir si une notification doit partir
- Savoir si le stock doit être mis à jour
- Alimenter les KPIs ou MIAA+

### 3.4 Garantie de non-régression

**La migration 138 n'est pas modifiée.** Les modules qui appellent déjà `emit_accounting_event()` directement continuent à fonctionner. L'AccountingHandler n'est qu'un wrapper supplémentaire qui appellera la même fonction.

```
Avant : Module ──────────────────────────────────► emit_accounting_event()
Après : Module ──► emit_business_event() ──► AccountingHandler ──► emit_accounting_event()
                            OU (mode de transition)
        Module ──────────────────────────────────► emit_accounting_event() [toujours valide]
```

---

## 4. MODÈLE DE DONNÉES BUSINESS EVENTS

### 4.1 business_events — Table centrale

```sql
CREATE TABLE business_events (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        UUID        NOT NULL,

  -- Identification
  event_type       TEXT        NOT NULL,
  -- Convention : 'MODULE.ACTION' ou 'MODULE-ACTION'
  -- Exemples : 'FAC.ISSUED', 'FAC.PAID', 'SAN.CONSULTATION',
  --            'PAI.BULLETIN', 'COM.SALE', 'HOT.CHECKOUT'
  -- Différent du accounting event_type ('FAC-001') — mapping dans handler config

  event_category   TEXT        NOT NULL,
  -- 'financial' | 'operational' | 'social' | 'compliance' | 'system'

  -- Source
  source_module    TEXT        NOT NULL,
  source_table     TEXT        NOT NULL,
  source_id        UUID        NOT NULL,

  -- Montants (optionnels — pas tous les events ont des montants)
  montant_ht       NUMERIC(14,2),
  montant_tva      NUMERIC(14,2),
  montant_ttc      NUMERIC(14,2),
  devise           TEXT        NOT NULL DEFAULT 'XAF',

  -- Contexte
  date_event       DATE        NOT NULL DEFAULT CURRENT_DATE,
  fiscal_year      INT         NOT NULL,
  libelle          TEXT        NOT NULL,

  -- Métadonnées flexibles (format libre, commun à tous les handlers)
  payload          JSONB       NOT NULL DEFAULT '{}',
  -- Clés recommandées : country_code, piece_number, client_id, employe_id,
  --                     mode_paiement, cost_center_id, ...

  -- Cycle de vie
  status           TEXT        NOT NULL DEFAULT 'pending',
  -- pending | processing | processed | partial | error | dead_letter

  -- Versionnement
  event_version    INT         NOT NULL DEFAULT 1,
  schema_version   TEXT        NOT NULL DEFAULT '1.0.0',

  -- Liens
  caused_by        UUID        REFERENCES business_events(id),
  -- (ex: FAC.PAID cause par FAC.ISSUED)

  -- Traitement
  handlers_total   INT         NOT NULL DEFAULT 0,
  handlers_done    INT         NOT NULL DEFAULT 0,
  handlers_failed  INT         NOT NULL DEFAULT 0,
  processed_at     TIMESTAMPTZ,
  error_summary    TEXT,

  -- Audit
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by       UUID,

  CONSTRAINT chk_be_status CHECK (status IN (
    'pending','processing','processed','partial','error','dead_letter'
  )),
  CONSTRAINT chk_be_category CHECK (event_category IN (
    'financial','operational','social','compliance','system'
  ))
);
```

### 4.2 business_event_handler_configs — Registre des handlers

```sql
CREATE TABLE business_event_handler_configs (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Quel handler
  handler_name     TEXT        NOT NULL,
  -- 'AccountingHandler' | 'TreasuryHandler' | 'InventoryHandler' | ...

  -- Pour quel type d'event
  event_type       TEXT        NOT NULL,
  -- Peut être un pattern : 'FAC.*' ou exact : 'FAC.ISSUED'
  -- NULL = s'applique à tous les event_types
  event_category   TEXT,
  -- Si renseigné, filtre par catégorie d'abord

  -- Conditions supplémentaires (JSONB, même format que accounting_event_rules)
  conditions       JSONB       NOT NULL DEFAULT '[]',

  -- Paramètres spécifiques au handler
  handler_config   JSONB       NOT NULL DEFAULT '{}',
  -- AccountingHandler : {"accounting_event_type": "FAC-001"}
  -- NotificationHandler : {"template": "invoice_issued", "channel": "email"}
  -- AIHandler : {"model": "anomaly_detection", "priority": "low"}

  -- Ordre d'exécution (les handlers critiques passent en premier)
  priority         INT         NOT NULL DEFAULT 50,
  -- 1 = le plus prioritaire. Accounting=10, Audit=20, Treasury=30, ...

  -- Mode d'exécution
  is_async         BOOLEAN     NOT NULL DEFAULT FALSE,
  -- FALSE = synchrone (bloque le traitement jusqu'à complétion)
  -- TRUE  = asynchrone (enregistre dans queue, traité séparément)

  -- Robustesse
  max_retries      INT         NOT NULL DEFAULT 3,
  timeout_ms       INT         NOT NULL DEFAULT 5000,

  -- Cycle de vie
  status           TEXT        NOT NULL DEFAULT 'active',
  country_codes    TEXT[],
  valid_from       DATE        NOT NULL DEFAULT CURRENT_DATE,
  valid_until      DATE,

  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  notes            TEXT,

  CONSTRAINT chk_bhc_status CHECK (status IN ('active','disabled','testing'))
);
```

### 4.3 business_event_handler_log — Audit trail par handler

```sql
CREATE TABLE business_event_handler_log (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  business_event_id UUID       NOT NULL REFERENCES business_events(id),
  tenant_id        UUID        NOT NULL,
  handler_name     TEXT        NOT NULL,
  handler_config_id UUID       REFERENCES business_event_handler_configs(id),

  -- Résultat
  status           TEXT        NOT NULL,
  -- 'success' | 'error' | 'skipped' | 'timeout' | 'retrying'

  -- Lien vers le sous-système déclenché
  downstream_id    UUID,
  -- Si AccountingHandler : accounting_events.id
  -- Si TreasuryHandler   : transactions.id
  -- Si NotificationHandler : notifications.id
  downstream_table TEXT,

  -- Erreur
  error_message    TEXT,
  retry_count      INT         NOT NULL DEFAULT 0,

  -- Performance
  duration_ms      INT,
  processed_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT chk_bhlog_status CHECK (
    status IN ('success','error','skipped','timeout','retrying')
  )
);
```

### 4.4 Résumé des tables ajoutées par la migration 138.5

| Table | Lignes attendues (Y1) | Criticité |
|-------|-----------------------|-----------|
| `business_events` | ~150K/an | HAUTE |
| `business_event_handler_configs` | ~50-200 règles | HAUTE |
| `business_event_handler_log` | ~600K/an (×4 handlers) | HAUTE |

---

## 5. INTERFACE BUSINESS EVENT ↔ ACCOUNTING EVENT

### 5.1 Le contrat de traduction

L'AccountingHandler est responsable de traduire un Business Event en Accounting Event. Cette traduction est configurable dans `business_event_handler_configs.handler_config`.

```jsonc
// Exemple : config de l'AccountingHandler pour FAC.ISSUED
{
  "handler_name": "AccountingHandler",
  "event_type": "FAC.ISSUED",
  "handler_config": {
    "accounting_event_type": "FAC-001",   // ← catalogue Phase 3
    "source_module_override": null,       // null = réutiliser source_module du business event
    "montant_mapping": {
      "montant_ht":  "montant_ht",        // champ business → champ accounting
      "montant_tva": "montant_tva",
      "montant_ttc": "montant_ttc"
    },
    "metadata_passthrough": true          // transmettre le payload entier en metadata
  }
}
```

### 5.2 Mapping complet des event_types

| Business Event | Accounting Event | Handlers actifs |
|---------------|-----------------|-----------------|
| `FAC.ISSUED` | `FAC-001` | Accounting, Treasury, CRM, Analytics, AI, Audit |
| `FAC.PAID` | `FAC-002` | Accounting, Treasury, CRM, Analytics, AI, Audit |
| `FAC.CANCELLED` | `FAC-004` | Accounting, CRM, Analytics, Audit |
| `SAN.CONSULTATION` | `SAN-001` | Accounting, Analytics, CRM, Notification, Audit |
| `SAN.HOSPITALIZATION` | `SAN-002` | Accounting, Analytics, CRM, Audit |
| `RES.ORDER` | `RES-001` | Accounting, Inventory, Analytics, AI, Audit |
| `PAI.BULLETIN` | `PAI-001` | Accounting, HR, Analytics, Notification, Audit |
| `COM.SALE` | `COM-001` | Accounting, Inventory, CRM, Analytics, AI, Audit |
| `COM.PURCHASE` | `COM-002` | Accounting, Inventory, Analytics, Audit |
| `TRE.DEPOSIT` | `TRE-001` | Accounting, Treasury, Analytics, Audit |
| `MOB.RECEIVED` | `MOB-001` | Accounting, Treasury, Analytics, Audit |
| `HOT.CHECKIN` | `HOT-001` | CRM, Inventory, Notification, Analytics, Audit |
| `HOT.CHECKOUT` | `HOT-004` | Accounting, Treasury, CRM, Analytics, AI, Audit |

**Règle de nommage** : `MODULE.ACTION` en majuscules, point comme séparateur.  
`MODULE` = 3 lettres (FAC, SAN, PAI, COM, TRE, MOB, HOT, RES, ECO, ONG, TRP, CAB).

### 5.3 Événements sans impact comptable direct

Certains Business Events n'ont pas d'Accounting Event correspondant :

| Business Event | Raison | Handlers actifs |
|---------------|--------|-----------------|
| `SAN.APPOINTMENT` | Prise de RDV = pas d'écriture | CRM, Notification, Analytics |
| `HOT.CHECKIN` | Enregistrement = pas d'écriture | CRM, Inventory, Notification |
| `ECO.ENROLLMENT` | Inscription = pas encore facturé | CRM, Analytics, Notification |
| `HR.CONTRACT_SIGNED` | Contrat signé = pas d'écriture | HR, CRM, Notification, Audit |
| `STOCK.ALERT` | Seuil stock atteint | Inventory, Notification, AI |
| `AI.ANOMALY` | Signal MIAA+ | AI, Notification, Audit |

Pour ces events, l'AccountingHandler est simplement absent de la config ou marque `status='skipped'`.

### 5.4 Fonction de traduction TypeScript (pattern pour les routes API)

```typescript
// lib/business-events/emit.ts
export async function emitBusinessEvent(params: {
  tenantId: string
  eventType: string          // 'FAC.ISSUED', 'SAN.CONSULTATION', ...
  sourceModule: string
  sourceTable: string
  sourceId: string
  montantHt?: number
  montantTva?: number
  montantTtc?: number
  libelle: string
  payload?: Record<string, unknown>
  dateEvent?: string
}): Promise<{ businessEventId: string | null }> {
  const { data, error } = await supabase.rpc('emit_business_event', {
    p_tenant_id: params.tenantId,
    p_event_type: params.eventType,
    p_source_module: params.sourceModule,
    p_source_table: params.sourceTable,
    p_source_id: params.sourceId,
    p_montant_ht: params.montantHt ?? 0,
    p_montant_tva: params.montantTva ?? 0,
    p_montant_ttc: params.montantTtc ?? 0,
    p_libelle: params.libelle,
    p_payload: params.payload ?? {},
    p_date_event: params.dateEvent ?? new Date().toISOString().split('T')[0],
  })
  if (error) throw error
  return { businessEventId: data }
}

// Utilisation dans app/api/factures/route.ts (futur)
await emitBusinessEvent({
  tenantId,
  eventType: 'FAC.ISSUED',
  sourceModule: 'facturation',
  sourceTable: 'factures',
  sourceId: factureId,
  montantHt: ht,
  montantTva: tva,
  montantTtc: ttc,
  libelle: `Facture ${pieceNum} — ${clientNom}`,
  payload: {
    piece_number: pieceNum,
    client_id: clientId,
    client_name: clientNom,
    mode_paiement: modePaiement,
    country_code: 'CG',
  },
})
// → Déclenche automatiquement : Accounting + Treasury + CRM + Analytics + AI + Audit
```

---

## 6. SYSTÈME DE HANDLERS EXTENSIBLES

### 6.1 Interface commune des handlers

Chaque handler implémente le même contrat. Cela garantit qu'ajouter un handler ne nécessite aucune modification du moteur.

```sql
-- Signature interne de chaque handler (appelé par fn_dispatch_to_handlers)
-- Chaque handler est une fonction SQL avec cette signature :
-- fn_handler_{nom}(p_business_event_id UUID, p_config JSONB) RETURNS JSONB
-- Retourne : {"status": "success"|"error"|"skipped", "downstream_id": UUID, "message": TEXT}
```

```typescript
// Interface TypeScript (pour les handlers implémentés côté application)
interface BusinessEventHandler {
  name: string
  canHandle(eventType: string, payload: Record<string, unknown>): boolean
  handle(event: BusinessEvent): Promise<HandlerResult>
}

interface HandlerResult {
  status: 'success' | 'error' | 'skipped'
  downstreamId?: string
  downstreamTable?: string
  message?: string
  durationMs: number
}
```

### 6.2 AccountingHandler — Détail

```sql
CREATE OR REPLACE FUNCTION fn_handler_accounting(
  p_business_event_id UUID,
  p_config JSONB
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_event     business_events%ROWTYPE;
  v_acc_type  TEXT;
  v_acc_id    UUID;
  v_start     TIMESTAMPTZ := clock_timestamp();
BEGIN
  SELECT * INTO v_event FROM business_events WHERE id = p_business_event_id;

  -- Récupérer le type d'accounting event depuis la config du handler
  v_acc_type := p_config->>'accounting_event_type';
  IF v_acc_type IS NULL THEN
    RETURN jsonb_build_object('status','skipped','message','No accounting_event_type configured');
  END IF;

  -- Déléguer au moteur comptable Phase 4.0 (migration 138) — INCHANGÉ
  v_acc_id := emit_accounting_event(
    p_tenant_id     := v_event.tenant_id,
    p_event_type    := v_acc_type,
    p_source_module := v_event.source_module,
    p_source_table  := v_event.source_table,
    p_source_id     := v_event.source_id,
    p_montant_ht    := COALESCE(v_event.montant_ht, 0),
    p_montant_tva   := COALESCE(v_event.montant_tva, 0),
    p_montant_ttc   := COALESCE(v_event.montant_ttc, 0),
    p_libelle       := v_event.libelle,
    p_date_event    := v_event.date_event,
    p_fiscal_year   := v_event.fiscal_year,
    p_metadata      := v_event.payload
  );

  RETURN jsonb_build_object(
    'status', CASE WHEN v_acc_id IS NOT NULL THEN 'success' ELSE 'skipped' END,
    'downstream_id', v_acc_id,
    'downstream_table', 'accounting_events',
    'duration_ms', EXTRACT(MILLISECONDS FROM (clock_timestamp() - v_start))::INT
  );
END;
$$;
```

### 6.3 AnalyticsHandler — Concept

```sql
-- fn_handler_analytics() : met à jour les snapshots KPI sans passer par le moteur comptable
-- Alimente : kpi_snapshots, revenue_daily, cost_center_summary
-- Avantage : calcul temps réel sans requête analytique lourde à la demande
```

### 6.4 AIHandler (MIAA+) — Concept

```sql
-- fn_handler_ai() : enregistre chaque event dans ai_events pour pattern detection
-- MIAA+ analyse :
--   - Anomalies de montant (facture 10× la moyenne)
--   - Délais de paiement (prédiction retard)
--   - Patterns de consommation (restaurant, hôtel)
--   - Fraude potentielle (deux paiements identiques)
-- L'AI Handler est toujours async (is_async = TRUE) : jamais bloquant
```

### 6.5 NotificationHandler — Concept

```sql
-- fn_handler_notification() : insère dans une table notifications
-- Le processus Next.js consomme la table et envoie email/SMS/push
-- Config : {"template": "invoice_issued", "channel": ["email","push"], "delay_seconds": 0}
```

### 6.6 AuditHandler — Toujours actif

```sql
-- fn_handler_audit() : log cross-domaines de chaque event
-- S'exécute TOUJOURS (priority=1, ne peut pas être désactivé)
-- Alimente business_event_audit_log avec snapshot complet
-- Utilisé pour : conformité OHADA, inspection fiscale, détection d'anomalies
```

### 6.7 Ordre d'exécution des handlers (priority)

| Priorité | Handler | Sync/Async | Raison |
|----------|---------|-----------|--------|
| 1 | **AuditHandler** | Sync | Trace systématique obligatoire |
| 10 | **AccountingHandler** | Sync | Critique — génère les écritures |
| 20 | **TreasuryHandler** | Sync | Cohérence trésorerie avec comptabilité |
| 30 | **InventoryHandler** | Sync | Cohérence stock |
| 40 | **HRHandler** | Sync | Mise à jour RH (soldes congés, etc.) |
| 50 | **CRMHandler** | Sync | Historique client |
| 60 | **AnalyticsHandler** | Sync | KPIs temps réel (rapide) |
| 70 | **NotificationHandler** | Async | Notifications (latence acceptable) |
| 80 | **AIHandler** | Async | Analyse MIAA+ (latence acceptable) |

**Règle** : les handlers sync bloquent le traitement (échec = event en error).  
Les handlers async enregistrent dans une queue — leur échec ne bloque pas.

---

## 7. FLUX DÉTAILLÉS PAR SCÉNARIO

### 7.1 Scénario : Facture émise (FAC.ISSUED)

```
app/api/factures/route.ts
    │
    ├── Valide les données (HT, TVA, TTC)
    │
    └── emit_business_event('FAC.ISSUED', {
            tenantId, factureId, clientId, ht, tva, ttc,
            piece_number, country_code: 'CG'
        })
            │
            ▼
    business_events [INSERT → trigger → fn_dispatch_to_handlers]
            │
            ├── [priority=1]  AuditHandler     → business_event_audit_log ✓
            ├── [priority=10] AccountingHandler → emit_accounting_event('FAC-001')
            │                                     → accounting_events
            │                                     → fn_ae_execute_event()
            │                                     → 3 lignes journal_entries (411/706/4441)
            │                                     → accounting_event_log ✓
            ├── [priority=20] TreasuryHandler   → transactions (entree attendue) ✓
            ├── [priority=50] CRMHandler         → clients.last_invoice_at, total_invoiced ✓
            ├── [priority=60] AnalyticsHandler   → kpi_snapshots.revenue_month += ttc ✓
            ├── [priority=70] NotificationHandler → notifications (email client) [async]
            └── [priority=80] AIHandler           → ai_events (pattern analyse) [async]
```

### 7.2 Scénario : Prise de RDV santé (SAN.APPOINTMENT)

```
app/api/sante/rendez-vous/route.ts
    │
    └── emit_business_event('SAN.APPOINTMENT', {
            tenantId, rdvId, patientId, medecinId, date_rdv
        })
            │
            ▼
    business_events
            │
            ├── [priority=1]  AuditHandler      → audit log ✓
            ├── [priority=10] AccountingHandler  → skipped (pas d'accounting_event_type)
            ├── [priority=50] CRMHandler          → patients.last_rdv_at ✓
            ├── [priority=70] NotificationHandler → SMS rappel RDV [async]
            └── [priority=80] AIHandler           → prédiction no-show [async]

    Résultat : business_events.status = 'processed'
               handlers_total=5, handlers_done=5, handlers_failed=0
               AccountingHandler loggé comme 'skipped' → pas d'erreur
```

### 7.3 Scénario : Erreur comptable isolée (FAC.ISSUED avec bug)

```
emit_business_event('FAC.ISSUED', ...)
    │
    ├── AuditHandler    ✓ success
    ├── AccountingHandler ✗ error (règle FAC-001 manquante — migration 139 pas encore appliquée)
    │       └── business_event_handler_log: status='error', error_message='No active rules for FAC-001'
    ├── TreasuryHandler ✓ success (indépendant)
    ├── CRMHandler       ✓ success (indépendant)
    ├── AnalyticsHandler ✓ success (indépendant)
    ...

    Résultat : business_events.status = 'partial'
               handlers_total=7, handlers_done=6, handlers_failed=1
               → Alerte dans v_business_events_partial
               → L'AccountingHandler peut être re-exécuté seul après correction
```

**Clé** : l'échec de la comptabilité n'empêche pas la notification d'aller au client.

---

## 8. MIGRATION 138.5 VS ÉVOLUTION PROGRESSIVE

### 8.1 Analyse : Faut-il une migration 138.5 ?

**Réponse : OUI, une migration 138.5 est nécessaire, mais non bloquante.**

| Critère | Migration 138.5 | Sans migration (évolution progressive) |
|---------|-----------------|---------------------------------------|
| Tables business_events | Créées | Ne peuvent pas exister |
| Modules peuvent migrer | Dès validation 138.5 | Impossible |
| Migration 138 modifiée | NON | NON |
| Bloque la migration 139 | NON | NON |
| Urgence | Faible | — |

**Conclusion** : les migrations 139+ (règles métier) peuvent être exécutées AVANT 138.5. Les modules continueront d'appeler `emit_accounting_event()` directement jusqu'à ce que 138.5 soit validée, puis seront migrés progressivement vers `emit_business_event()`.

### 8.2 Séquence recommandée

```
État actuel
    │
    ▼
Migration 138 v2 ✓ (infrastructure moteur comptable)
    │
    ├──► Migration 139 : Règles FAC-001 à FAC-006 (AccountingEventRules)
    ├──► Migration 140 : Règles SAN-001 à SAN-005
    ├──► Migration 141 : Règles PAI-001 à PAI-006
    │    ... migrations métier (indépendantes de 138.5)
    │
    └──► Migration 138.5 (après validation) :
              Tables : business_events, handler_configs, handler_log
              Fonctions : emit_business_event(), fn_dispatch_to_handlers()
              Handlers SQL : fn_handler_accounting(), fn_handler_audit(), ...
              Seed : configs initiales (AccountingHandler pour FAC.*, SAN.*, etc.)
                │
                ▼
         Module par module : remplacer emit_accounting_event() par emit_business_event()
         (non urgent — les deux coexistent indéfiniment)
```

### 8.3 Compatibilité ascendante garantie

| Appel existant | Après 138.5 | Fonctionne ? |
|---------------|-------------|-------------|
| `emit_accounting_event('FAC-001', ...)` | Inchangé | ✅ Toujours |
| `fn_bulletins_paie_to_journal()` (trigger 136) | Inchangé | ✅ Toujours |
| Routes API → journal_entries direct | Inchangé | ✅ Toujours |
| `emit_business_event('FAC.ISSUED', ...)` | Nouveau | ✅ Après 138.5 |

**Il n'y a aucun moment où quelque chose cesse de fonctionner.**

### 8.4 Périmètre exact de la migration 138.5

```
Migration 138.5 contient UNIQUEMENT :
  ✅ CREATE TABLE business_events
  ✅ CREATE TABLE business_event_handler_configs
  ✅ CREATE TABLE business_event_handler_log
  ✅ Index + RLS + contraintes
  ✅ emit_business_event() — point d'entrée
  ✅ fn_process_business_event() — trigger AFTER INSERT
  ✅ fn_dispatch_to_handlers() — orchestrateur
  ✅ fn_handler_accounting() — AppelleAccountingHandler (appelle emit_accounting_event)
  ✅ fn_handler_audit() — AuditHandler
  ✅ Seed : configs handler initiales (AccountingHandler, AuditHandler)
  ✅ Vues monitoring : v_business_events_status, v_business_events_partial
  ✅ fn_business_health_check()

Migration 138.5 NE contient PAS :
  ❌ Modifications de accounting_events (table 138)
  ❌ Modifications de accounting_event_rules (migration 138)
  ❌ Modifications des triggers existants (046, 130, 133, 136, 137)
  ❌ TreasuryHandler, InventoryHandler, CRMHandler, NotificationHandler, AIHandler
     → Ces handlers sont ajoutés progressivement dans des migrations ultérieures
     → Ou implémentés côté TypeScript/Next.js
```

---

## 9. PLAN D'IMPLÉMENTATION PROGRESSIF

### Phase A — Immédiate (migrations 139+)
Exécuter les migrations métier comptables. Les modules continuent d'appeler `emit_accounting_event()` directement.

```
139 — AccountingEventRules FAC (FAC-001 à FAC-006)
140 — AccountingEventRules SAN (SAN-001 à SAN-005)
141 — AccountingEventRules PAI (PAI-001 à PAI-006)
142 — AccountingEventRules RES, ECO, COM
...
```

### Phase B — Migration 138.5 (après validation checklist)
Infrastructure Business Event Engine. Les modules ne changent pas encore.

### Phase C — Modules prioritaires (après 138.5)
Migrer les modules à fort volume vers `emit_business_event()`.

```
Ordre recommandé (par volume + valeur) :
1. Facturation (FAC.*) — plus grand volume, valeur comptable haute
2. Santé (SAN.*) — grand volume, notifications critiques (RDV)
3. Restaurant (RES.*) — stock + analytics temps réel
4. Paie (PAI.*) — notifications bulletins + HR
5. Commerce (COM.*) — stock impératif
6. Hôtel, École, Transport, ONG...
```

### Phase D — Activation des handlers avancés
Activer progressivement les handlers non-comptables (après validation Module C).

```
D1 : NotificationHandler (email/SMS) → faible risque
D2 : AnalyticsHandler (KPIs) → faible risque
D3 : CRMHandler (historique client) → risque modéré
D4 : InventoryHandler (stock) → risque modéré, validation requise
D5 : AIHandler / MIAA+ → risque faible (async, non bloquant)
```

### Phase E — Plateforme ERP intelligente
MIAA+ consomme tous les Business Events pour des insights cross-modules.

```
Exemples MIAA+ :
- "Le CA de ce client baisse 3 mois de suite" (FAC.ISSUED trend)
- "Ce restaurant commande toujours en fin de stock" (COM.PURCHASE vs RES.ORDER)
- "Ce patient manque ses RDV 40% du temps" (SAN.APPOINTMENT + SAN.NO_SHOW)
- "Anomalie : facture 8× la moyenne pour ce client" (FAC.ISSUED amount)
```

---

## 10. CHECKLIST DE VALIDATION GO-LIVE 138.5

### Bloc A — Compatibilité avec migration 138

- [ ] `emit_accounting_event()` toujours callable directement → tests de non-régression
- [ ] `fn_ae_execute_event()` inchangée → logs de validation
- [ ] `accounting_events` table : aucune colonne ajoutée ou supprimée
- [ ] Triggers existants (046, 130, 133, 136, 137) : aucune modification vérifiée

### Bloc B — Tables et schéma 138.5

- [ ] `business_events` créée, RLS activée, index présents
- [ ] `business_event_handler_configs` créée, seed AccountingHandler + AuditHandler
- [ ] `business_event_handler_log` créée, index sur (business_event_id, handler_name)
- [ ] Contraintes CHECK vérifiées (status, category)
- [ ] Index de performance validés (EXPLAIN ANALYZE sur queries critiques)

### Bloc C — Fonctions

- [ ] `emit_business_event()` : test tenant validation (P-03 pattern)
- [ ] `emit_business_event()` : test idempotence (même event deux fois → DO NOTHING)
- [ ] `fn_dispatch_to_handlers()` : test isolation (handler 2 échoue → handler 3 continue)
- [ ] `fn_handler_accounting()` : test FAC.ISSUED → accounting_events créé → journal_entries 3 lignes
- [ ] `fn_handler_accounting()` : test SAN.APPOINTMENT → skipped (pas de accounting_event_type)
- [ ] `fn_handler_audit()` : trace systématique sur tous les events

### Bloc D — Comportement partiel

- [ ] `business_events.status = 'partial'` si un handler sync échoue
- [ ] `handlers_failed` incrémenté correctement
- [ ] Handler en erreur rejouable isolément (sans rejouer les handlers ayant réussi)
- [ ] Vue `v_business_events_partial` retourne les events en attente

### Bloc E — Performance

- [ ] EXPLAIN ANALYZE : `fn_dispatch_to_handlers()` sur event FAC.ISSUED < 100ms
- [ ] Test concurrent : 10 `emit_business_event()` simultanés → pas de deadlock
- [ ] Test charge : 1000 events en séquence → durée < 30s

### Bloc F — Monitoring

- [ ] `fn_business_health_check()` retourne 5 checks OK
- [ ] Vue `v_business_events_status` agrège correctement
- [ ] Alerte visible dans `v_business_events_partial` après injection d'un handler en erreur

### Bloc G — Régression comptable (le plus important)

- [ ] **Test golden path** : `emit_business_event('FAC.ISSUED')` → mêmes `journal_entries` que l'appel direct à `emit_accounting_event('FAC-001')`
- [ ] **Solde trésorerie** identique avant/après migration 138.5 sur jeu de données test
- [ ] **Balance SYSCOHADA** : débit = crédit sur tous les tests

---

## SYNTHÈSE DÉCISIONNELLE

| Question | Réponse |
|----------|---------|
| La migration 138 doit-elle être modifiée ? | **NON** |
| 138.5 bloque-t-elle les migrations 139+ ? | **NON** — parallélisables |
| Les modules doivent-ils changer immédiatement ? | **NON** — transition progressive |
| Le moteur comptable reste-t-il indépendant ? | **OUI** — juste appelé par AccountingHandler |
| Un même fact métier peut-il alimenter N domaines ? | **OUI** — c'est l'objectif de 138.5 |
| MIAA+ peut-il consommer tous les events ? | **OUI** — AIHandler (async, non bloquant) |
| Architecture extensible sans modifier le moteur ? | **OUI** — ajouter une ligne dans handler_configs |

---

*Plan Directeur Oraforme — Phase 4.5 Business Event Engine*  
*Conception validée le 2026-06-25 — Prochaine étape : migrations 139+ (règles FAC) puis migration 138.5*

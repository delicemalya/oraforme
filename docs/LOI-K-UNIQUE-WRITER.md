# LOI-K — Unique Writer Law

**Version :** 1.0  
**Certification :** C-004.2  
**Date :** 2026-07-13  
**Auteur :** Oraforme Architecture Council

---

## Principe fondamental

> **L'Accounting Core est l'unique autorité d'écriture dans `journal_entries` et `accounting_events`.**

Aucun module applicatif, aucune route API, aucun composant UI ne peut écrire directement dans `journal_entries`. Le seul chemin autorisé est :

```
Code applicatif
  → supabase.rpc('emit_accounting_event', {...})
    → [PostgreSQL] accounting_events (queue)
      → TRIGGER trg_process_accounting_event
        → fn_ae_execute_event()
          → journal_entries  ← SEUL INSERT AUTORISÉ
```

---

## Règles

### INTERDIT — Violation LOI-K

```typescript
// ❌ INSERT direct journal_entries
await supabase.from('journal_entries').insert({ ... })

// ❌ DELETE direct journal_entries  
await supabase.from('journal_entries').delete().eq('source_id', id)

// ❌ UPDATE direct journal_entries
await supabase.from('journal_entries').update({ ... })

// ❌ INSERT direct accounting_events (bypasse le point d'entrée officiel)
await supabase.from('accounting_events').insert({ ... })
```

### AUTORISÉ — Chemin officiel

```typescript
// ✅ Émission d'un événement comptable
await supabase.rpc('emit_accounting_event', {
  p_tenant_id:     tenantId,
  p_event_type:    'FAC-001',      // Type d'événement selon accounting_event_rules
  p_source_module: 'facturation',
  p_source_table:  'factures',
  p_source_id:     factureId,
  p_montant_ht:    ht,
  p_montant_tva:   tva,
  p_montant_ttc:   ttc,
  p_libelle:       'Facture F-2026-001 — Client ACME',
  p_date_event:    '2026-07-13',
  p_fiscal_year:   2026,
  p_metadata:      { piece_number: 'F-2026-001', country_code: 'CG' },
})

// ✅ Extourne d'un événement comptable (équivalent de DELETE)
await supabase.rpc('fn_reverse_accounting_event', {
  p_event_id:   eventId,   // UUID de l'événement dans accounting_events
  p_reason:     'Facture annulée',
  p_created_by: null,
})
```

---

## Événements comptables définis

| Événement | Déclencheur | Écritures générées (SYSCOHADA) |
|---|---|---|
| `FAC-001` | Facture émise | D411 / C706 (HT) · D411 / C4441 (TVA 18%) · D411 / C447 (CA 5%, CG) |
| `FAC-002` | Règlement reçu | D521 / C411 (TTC) |
| `PAI-001` | Bulletin de paie | D661 / C421 (salaire net) · D646 / C431 (cotisations) |
| _(voir migration 139 pour liste complète)_ | | |

---

## Exemptions officielles

### EXM-JE-001 — Saisie manuelle comptable

**Fichiers :** `app/dashboard/comptabilite/page.tsx`, `app/dashboard/comptabilite/journal/page.tsx`  
**Raison :** Fonctionnalité intentionnelle — les comptables saisissent des écritures manuelles (OD, régularisations, corrections). Ces écritures n'ont pas d'événement métier source.  
**Statut :** ✅ Exemption permanente

### EXM-JE-002 — accounting-engine.ts (helper serveur)

**Fichier :** `lib/accounting-engine.ts`  
**Raison :** Helper de bas niveau (`createJournalEntry()`), usage contrôlé côté serveur uniquement. Pas appelé depuis les composants UI.  
**Statut :** ⚠️ Exemption temporaire — à migrer vers `emit_accounting_event` à terme

### EXM-JE-003 — compta-sync-client.ts (dette technique)

**Fichier :** `lib/compta-sync-client.ts`  
**Raison :** Synchroniseur legacy (`writeComptaEntry()`) pour les modules trésorerie et paie ancienne génération. Les modules ont été refactorisés vers `emit_accounting_event` progressivement.  
**Statut :** ⚠️ Dette technique — ADR-K-003 documentée, migration planifiée

---

## Enforcement CI

### 1. Vitest — test d'architecture (bloc CI)

```bash
npx vitest run lib/architecture/loi-k-unique-writer.test.ts
```

Échoue CI si un INSERT/UPDATE/DELETE direct est détecté hors exemptions.  
Fichier : `lib/architecture/loi-k-unique-writer.test.ts`

### 2. ESLint — règle statique (feedback immédiat IDE)

Configurée dans `eslint.config.mjs` — règle `no-restricted-syntax`.  
Détecte les violations au moment de l'écriture du code (avant commit).

```bash
npx eslint app/dashboard/ app/api/ lib/ --max-warnings 0
```

### 3. Ajouter une exemption (procédure)

Une nouvelle exemption nécessite :
1. Modifier `JOURNAL_EXEMPT` dans `lib/architecture/loi-k-unique-writer.test.ts`
2. Ajouter l'ignore dans `eslint.config.mjs` (section LOI-K)
3. Documenter l'exemption dans ce fichier (section "Exemptions officielles")
4. Créer un ADR dans `docs/` (`ADR-K-XXX-nom.md`)

---

## Matrice des writers (état certifié 2026-07-13)

### journal_entries

| Writer | Type | Statut |
|---|---|---|
| `fn_ae_execute_event()` | DB TRIGGER (PostgreSQL) | ✅ AUTORISÉ — writer officiel |
| `fn_reverse_accounting_event()` | DB FUNCTION SECURITY DEFINER | ✅ AUTORISÉ — extourne officiel |
| `app/dashboard/comptabilite/page.tsx` | UI React | ✅ EXM-JE-001 — saisie manuelle |
| `app/dashboard/comptabilite/journal/page.tsx` | UI React | ✅ EXM-JE-001 — saisie manuelle |
| `lib/accounting-engine.ts` | Lib serveur | ⚠️ EXM-JE-002 — à migrer |
| `lib/compta-sync-client.ts` | Lib client | ⚠️ EXM-JE-003 — dette technique |

### accounting_events

| Writer | Type | Statut |
|---|---|---|
| `emit_accounting_event()` | RPC PostgreSQL SECURITY DEFINER | ✅ AUTORISÉ — point d'entrée unique |
| _Aucun autre_ | — | — |

### Emitters emit_accounting_event (21 chemins autorisés)

- `app/api/factures/route.ts` — FAC-001 (création)
- `app/api/factures/[id]/route.ts` — FAC-001 (mise à jour), FAC-002 (règlement)
- `app/dashboard/facturation/page.tsx` — FAC-001, FAC-002 (UI dashboard)
- `app/api/rh/paie/route.ts` — PAI-001
- `app/api/rh/paie/[id]/route.ts` — PAI-001
- _(+ 16 routes métier, voir AUTHORIZED_EMITTERS dans le test)_

---

## Historique

| Date | Action | Impact |
|---|---|---|
| 2026-07-13 | C-004.1 : Suppression `postFactureToJournal` et `postPaiementToJournal` | Dashboard facture passe via moteur |
| 2026-07-13 | C-004.2 : LOI-K créée — ESLint + Vitest + documentation | CI bloquant activé |
| _(futur)_ | Migration EXM-JE-002 : `accounting-engine.ts` → `emit_accounting_event` | Réduction dette |
| _(futur)_ | Migration EXM-JE-003 : `compta-sync-client.ts` → `emit_accounting_event` | Réduction dette |

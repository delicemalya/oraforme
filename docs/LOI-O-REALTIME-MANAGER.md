# LOI-O — Unique Realtime Manager

**Version :** 1.0  
**Certification :** C-004.3  
**Date :** 2026-07-13  
**Auteur :** Oraforme Architecture Council

---

## Principe fondamental

> **RealtimeOrchestrator est l'unique gestionnaire de subscriptions Supabase dans Oraforme.**

Aucun composant ou page ne peut créer directement `supabase.channel(...).on(...).subscribe(...)`. Toutes les subscriptions doivent passer par le RealtimeOrchestrator (futur).

**État actuel :** Le RealtimeOrchestrator n'existe pas encore. Les 9 canaux existants sont documentés comme dettes `DET-O-001` à `DET-O-009`. Ce test CI bloque toute NOUVELLE subscription non enregistrée.

---

## Règles

### INTERDIT — Violation LOI-O (nouveau code)

```typescript
// ❌ Subscription directe dans un nouveau composant
const channel = supabase
  .channel(`mon-module-${tenantId}`)
  .on('postgres_changes', { event: '*', schema: 'public', table: 'ma_table' }, handler)
  .subscribe()
```

### AUTORISÉ — Chemin futur (RealtimeOrchestrator)

```typescript
// ✅ Via hook centralisé (à créer)
import { useRealtimeSubscription } from '@/lib/realtime/orchestrator'

useRealtimeSubscription({
  table: 'factures',
  filter: `tenant_id=eq.${tenantId}`,
  onInsert: (payload) => { reload() },
  onUpdate: (payload) => { reload() },
})

// ✅ Via DashboardClient (hub central existant)
// components/dashboard/DashboardClient.tsx gère le canal principal dashboard
```

### AUTORISÉ — En attendant le RealtimeOrchestrator

Pour les nouveaux canaux qui doivent être créés avant la migration :
1. Créer la subscription dans le composant concerné
2. Ajouter le fichier dans `KNOWN_REALTIME_CHANNELS` dans `loi-o-realtime-manager.test.ts`
3. Documenter ici avec un nouvel ID `DET-O-XXX`
4. Planifier la migration vers `useRealtimeSubscription()`

---

## Inventaire des canaux (DET-O-001 à DET-O-009)

| ID | Fichier | Canal | Table écoutée |
|---|---|---|---|
| DET-O-001 | `components/ui/NotificationsPanel.tsx` | `notif-panel-v2` | `notifications` |
| DET-O-002 | `components/dashboard/DashboardClient.tsx` | `dashboard-${tenantId}` | `factures` |
| DET-O-003 | `app/dashboard/tresorerie/page.tsx` | `treso-${tenantId}` | `transactions` |
| DET-O-004 | `app/dashboard/taches/page.tsx` | `tasks:${tenantId}` | `taches` |
| DET-O-005 | `app/dashboard/finance/page.tsx` | `finance-${tenantId}` | `transactions` |
| DET-O-006 | `app/dashboard/comptabilite/journal/page.tsx` | `journal-${tenantId}` | `journal_entries` |
| DET-O-007 | `app/dashboard/comptabilite/grand-livre/page.tsx` | `gl-${tenantId}-${year}` | `journal_entries` |
| DET-O-008 | `app/dashboard/notifications/page.tsx` | `notifs:${tenantId}` | `notifications` |
| DET-O-009 | `app/dashboard/comptabilite/balance/page.tsx` | `balance-${tenantId}-${year}` | `journal_entries` |

---

## Plan de migration vers RealtimeOrchestrator

### Phase 1 — Créer l'orchestrateur (futur)

```typescript
// lib/realtime/orchestrator.ts
export function useRealtimeSubscription(config: {
  table: string
  filter?: string
  onInsert?: (payload: any) => void
  onUpdate?: (payload: any) => void
  onDelete?: (payload: any) => void
}) {
  const { supabase } = useSupabase()
  const { tenantId } = useTenant()
  
  useEffect(() => {
    const channelId = `${config.table}-${tenantId}-${Date.now()}`
    const channel = supabase
      .channel(channelId)
      .on('postgres_changes', { event: '*', schema: 'public', table: config.table, filter: config.filter }, (payload) => {
        if (payload.eventType === 'INSERT') config.onInsert?.(payload)
        if (payload.eventType === 'UPDATE') config.onUpdate?.(payload)
        if (payload.eventType === 'DELETE') config.onDelete?.(payload)
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [config.table, config.filter, tenantId])
}
```

### Phase 2 — Migrer les 9 canaux existants

Une par une, remplacer les `.channel().on().subscribe()` par `useRealtimeSubscription()`.

---

## Enforcement CI

### 1. Vitest — test d'architecture (bloc CI)

```bash
npx vitest run lib/architecture/loi-o-realtime-manager.test.ts
```

Échoue CI si un NOUVEAU fichier utilise `.channel()` sans être dans `KNOWN_REALTIME_CHANNELS`.  
Avertit sur les 9 canaux existants (dettes techniques documentées).  
Vérifie aussi la présence d'un cleanup `.unsubscribe()` ou `removeChannel()` dans chaque fichier.

### 2. ESLint — règle de sensibilisation (warn)

Règle `loi-o/unique-realtime-manager: "warn"` dans `eslint.config.mjs`.  
Alerte à chaque `.channel(` pour rappeler d'enregistrer le nouveau canal.

---

## Historique

| Date | Action | Impact |
|---|---|---|
| 2026-07-13 | C-004.3 : LOI-O créée — Vitest + ESLint (warn) + documentation | 9 canaux inventoriés |
| _(futur)_ | Création RealtimeOrchestrator + useRealtimeSubscription | Migration progressive DET-O-xxx |
| _(futur)_ | Migration canal par canal | 0 subscription directe |

# LOI-M — Unique Tenant Creator

**Version :** 1.0  
**Certification :** C-004.3  
**Date :** 2026-07-13  
**Auteur :** Oraforme Architecture Council

---

## Principe fondamental

> **TenantProfileFactory est l'unique autorité de création et modification des tenants.**

Aucun composant dashboard ne peut écrire directement dans la table `tenants`. Le seul chemin autorisé est :

```
Code applicatif
  ↓
  app/onboarding/**               ← Création tenant (parcours d'inscription)
  app/api/admin/**                ← Admin operations (super-admin uniquement)
  app/api/modules/toggle/**       ← Activation/désactivation modules
```

---

## Règles

### INTERDIT — Violation LOI-M

```typescript
// ❌ INSERT direct depuis un composant dashboard
await supabase.from('tenants').insert({ name, plan, country })

// ❌ UPDATE direct depuis un composant dashboard
await supabase.from('tenants').update({ plan }).eq('id', tenantId)

// ❌ UPSERT direct depuis un composant dashboard
await supabase.from('tenants').upsert({ id, modules_actifs })
```

### AUTORISÉ — Chemin officiel

```typescript
// ✅ Via API admin (route sécurisée)
const res = await fetch('/api/admin/tenants', {
  method: 'POST',
  body: JSON.stringify({ name, plan, country }),
})

// ✅ Via onboarding (création initiale)
// app/onboarding/page.tsx gère directement tenants pour la création du compte

// ✅ Via API modules
await fetch('/api/modules/toggle', {
  method: 'POST',
  body: JSON.stringify({ moduleId, enabled }),
})
```

---

## Dettes techniques (KNOWN_TENANT_DEBT)

### DET-M-001 — Groupe/Gestion

**Fichier :** `app/dashboard/groupe/gestion/page.tsx`  
**Violation :** `.from('tenants').insert/update` — gestion de holding/groupe  
**Migration :** Créer `app/api/admin/groupe/route.ts` et déléguer les opérations tenant  
**Statut :** ⚠️ Dette technique — migration planifiée

---

## Enforcement CI

### 1. Vitest — test d'architecture (bloc CI)

```bash
npx vitest run lib/architecture/loi-m-tenant-creator.test.ts
```

Échoue CI si un nouveau composant dashboard écrit directement dans `tenants`.  
Les dettes documentées (`KNOWN_TENANT_DEBT`) sont avertissements, pas des échecs.

### 2. ESLint — règle statique (feedback immédiat IDE)

Règle `loi-m/unique-tenant-creator: "error"` dans `eslint.config.mjs`.  
Détecte les `.from('tenants').insert/update/upsert` dans les composants dashboard.

### 3. Ajouter une exemption ou une dette (procédure)

1. **Si nouveau chemin autorisé** : Ajouter à `TENANT_WRITE_AUTHORIZED` dans le test + ignorer en ESLint
2. **Si dette** : Ajouter à `KNOWN_TENANT_DEBT` avec un ID `DET-M-XXX` et un plan de migration
3. Documenter dans ce fichier

---

## Chemins autorisés

| Chemin | Rôle |
|---|---|
| `app/onboarding/**` | Création tenant lors de l'inscription |
| `app/api/admin/**` | Opérations admin super-admin |
| `app/api/modules/toggle/**` | Activation/désactivation modules |
| `app/api/tenant/**` | API tenant (si existante) |
| `supabase/migrations/**` | Migrations SQL — infra uniquement |

---

## Historique

| Date | Action | Impact |
|---|---|---|
| 2026-07-13 | C-004.3 : LOI-M créée — ESLint + Vitest + documentation | CI bloquant activé |
| _(futur)_ | Migration DET-M-001 vers app/api/admin/groupe | 0 dette tenant write |

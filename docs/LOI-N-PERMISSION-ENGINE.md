# LOI-N — Unique Permission Engine

**Version :** 1.0  
**Certification :** C-004.3  
**Date :** 2026-07-13  
**Auteur :** Oraforme Architecture Council

---

## Principe fondamental

> **Permission Core (`usePermissions`) est l'unique autorité de contrôle d'accès dans les composants UI.**

Aucun composant ne peut comparer `profile.role` directement à `'owner'`, `'admin'`, `'manager'`, etc. pour prendre une décision d'accès. Le seul chemin autorisé est :

```
Composant UI
  ↓
  const { isOwner, isAdmin, can, canView, canEdit } = usePermissions()
    ↓
    lib/hooks/usePermissions.ts  ← vérifie plan + rôle + permissions dynamiques
      ↓
      TenantContext.role          ← source de vérité (tenant_user_profiles)
```

---

## Règles

### INTERDIT — Violation LOI-N

```typescript
// ❌ Comparaison directe du rôle
if (profile.role === 'owner') { /* ... */ }

// ❌ Condition d'accès raw
const canEdit = profile?.role === 'admin' || profile?.role === 'owner'

// ❌ Vérification inline dans JSX
{profile.role !== 'membre' && <AdminPanel />}
```

### AUTORISÉ — Chemin officiel

```typescript
// ✅ Via usePermissions hook
const { isOwner, isAdmin, isFinancial, can, canEdit } = usePermissions()

if (isOwner) { /* ... */ }
if (can('facturation', 'create')) { /* ... */ }
if (canEdit('comptabilite')) { /* ... */ }

// ✅ Dans JSX
{isOwner && <OwnerSettings />}
{can('rh', 'view') && <RHModule />}
```

---

## API usePermissions

| Méthode/Propriété | Description |
|---|---|
| `isOwner` | Propriétaire du tenant |
| `isAdmin` | Administrateur (owner ou rôle admin) |
| `isFinancial` | Accès aux modules financiers |
| `can(module, action)` | Vérification permission générale |
| `canView(module)` | Lecture module |
| `canEdit(module)` | Écriture/modification module |
| `canDelete(module)` | Suppression module |
| `canExport(module)` | Export de données |
| `canValidate(module)` | Validation/approbation |
| `canApprove(module)` | Approbation niveau supérieur |

---

## Dettes techniques (KNOWN_PERMISSION_DEBT)

### DET-N-001 — Dashboard Root

**Fichier :** `app/dashboard/page.tsx`  
**Violation :** `profile.role === 'owner'` — fallback isFinancial  
**Migration :** `const { isOwner } = usePermissions(); const isFinancial = isOwner || isDirectionGenerale`  
**Statut :** ⚠️ Dette technique — migration planifiée

### DET-N-002 — Ecole Espace Étudiant

**Fichier :** `app/dashboard/ecole/espace-etudiant/page.tsx`  
**Violation :** `profile?.role === 'owner'` — fallback ecoleRole  
**Migration :** `const { isOwner } = usePermissions(); const ecoleRole = ecoleRoleName ?? (isOwner ? 'DIRECTION_GENERALE' : null)`  
**Statut :** ⚠️ Dette technique — migration planifiée

### DET-N-003 — Ecole Espace Parent

**Fichier :** `app/dashboard/ecole/espace-parent/page.tsx`  
**Violation :** `profile?.role === 'owner'` — fallback ecoleRole  
**Migration :** Même que DET-N-002  
**Statut :** ⚠️ Dette technique — migration planifiée

---

## Enforcement CI

### 1. Vitest — test d'architecture (bloc CI)

```bash
npx vitest run lib/architecture/loi-n-permission-engine.test.ts
```

Échoue CI si un nouveau composant compare `profile.role === 'owner'` directement.  
Les dettes documentées sont avertissements, pas des échecs.

### 2. ESLint — règle statique (feedback immédiat IDE)

Règle `loi-n/unique-permission-engine: "error"` dans `eslint.config.mjs`.  
Détecte les `.role === 'owner'` / `.role === 'admin'` dans les composants dashboard.

**Note** : N'interfère PAS avec les rôles de messages AI (`m.role === 'user'`, `msg.role === 'assistant'`) car ces valeurs ('user', 'assistant', 'bot') ne sont pas dans `PERMISSION_ROLES`.

---

## Exemptions officielles

| Fichier/Chemin | Raison |
|---|---|
| `lib/hooks/usePermissions.ts` | Permission Core lui-même |
| `lib/hooks/useRoleGuard.ts` | Guard utilitaire |
| `lib/tenant-guard.ts` | Guard API |
| `lib/api/**` | Routes API — vérifications serveur |
| `app/admin/**` | Pages admin — affichage raw des rôles pour monitoring |
| `app/dashboard/equipe/**` | Gestion équipe — affiche et modifie les rôles des membres |

---

## Historique

| Date | Action | Impact |
|---|---|---|
| 2026-07-13 | C-004.3 : LOI-N créée — ESLint + Vitest + documentation | CI bloquant activé |
| _(futur)_ | Migration DET-N-001/002/003 vers usePermissions() | 0 raw role check |

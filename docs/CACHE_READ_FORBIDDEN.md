# CACHE READ FORBIDDEN — Règle d'Architecture F-003

**Statut :** RÈGLE ACTIVE — violation = certification refusée  
**Date :** 2026-06-30  
**Sprint :** F-003 Fondation Multi-Tenant  
**Autorité :** Constitution v2.0

---

## Principe fondamental

La table `tenants` contient des **colonnes cache** — copies dénormalisées de tables normalisées.  
Ces colonnes existent pour des raisons historiques ou de performance d'écriture.  
Elles **ne sont jamais une source de vérité** pour le contrôle d'accès métier.

**RÈGLE ABSOLUE :** Aucun composant métier ne lit une colonne cache pour décider de l'accès.

---

## Colonnes cache identifiées

| Colonne | Table | Source de vérité | Statut |
|---|---|---|---|
| `modules_actifs` | `tenants` | `tenant_modules` (table normalisée) | **INTERDIT en lecture métier** |
| `plan` | `tenants` | `taille_entreprise` (pour gating) | **Affichage cosmétique uniquement** |

### Colonnes futures à surveiller (forward guards)
Les patterns `cache_*`, `snapshot_*`, `legacy_*` sur la table `tenants` sont considérés comme cache  
et soumis à la même règle dès leur création.

---

## Ce qui est INTERDIT

```typescript
// ❌ INTERDIT — lecture de cache pour contrôle d'accès
const { data } = await supabase
  .from('tenants')
  .select('modules_actifs')          // INTERDIT

// ❌ INTERDIT — sélection mixte incluant la colonne cache
.select('id, nom_entreprise, modules_actifs, plan')  // modules_actifs INTERDIT hors admin

// ❌ INTERDIT — lecture via jointure
.select('*, tenants(modules_actifs)')  // INTERDIT

// ❌ INTERDIT — accès à la propriété sur un objet Supabase
const modules = tenant.modules_actifs   // INTERDIT si tenant vient d'une query DB
```

---

## Ce qui est AUTORISÉ

```typescript
// ✅ CORRECT — source de vérité unique
const { data: tmRows } = await supabase
  .from('tenant_modules')
  .select('module_key')
  .eq('tenant_id', tenantId)
  .eq('enabled', true)

// ✅ CORRECT — depuis TenantContext (lit tenant_modules exclusivement)
const { modulesActifs } = useTenant()

// ✅ CORRECT — ÉCRITURE sur modules_actifs comme sync cache (toggle route uniquement)
await supabase.from('tenants').update({ modules_actifs: updated }).eq('id', tenantId)
// → acceptable UNIQUEMENT après UPSERT primaire sur tenant_modules

// ✅ CORRECT — lecture admin pour analytics (SUPER_ADMIN uniquement, jamais pour gating)
supabaseAdmin.from('tenants').select('id, modules_actifs')  // dans app/admin/** seulement
```

---

## Exceptions documentées et justifiées

| Fichier | Pattern | Justification | Type |
|---|---|---|---|
| `app/api/modules/toggle/route.ts` | `update({ modules_actifs })` | ÉCRITURE de sync cache après `tenant_modules` UPSERT | ÉCRITURE — OK |
| `app/onboarding/actions.ts` | `modules_actifs: modules` | ÉCRITURE initiale à la création du tenant | ÉCRITURE — OK |
| `app/api/admin/tenant/create/route.ts` | `modules_actifs: modules` | ÉCRITURE initiale à la création | ÉCRITURE — OK |
| `app/admin/**` | `select('...modules_actifs...')` | Analytics SUPER_ADMIN — jamais pour gating | LECTURE ADMIN — OK |
| `components/admin/**` | `t.modules_actifs` | Affichage admin — données passées en props depuis admin | LECTURE ADMIN — OK |
| `lib/contexts/TenantContext.tsx` | `tenants(..., plan, ...)` | `plan` pour label d'affichage uniquement — gating via `taille_entreprise` | AFFICHAGE — OK |

---

## Architecture canonique — Flux des modules

```
DB : tenant_modules (source de vérité)
  ↓
lib/contexts/TenantContext.tsx → query tenant_modules → modulesActifs[]
  ↓
React components ← useTenant() ← modulesActifs (camelCase, jamais snake_case DB)
  ↓
tenants.modules_actifs ← écrit par toggle/route.ts comme cache (non lu)
```

**Règle de nommage :** La prop React est toujours `modulesActifs` (camelCase).  
Le nom de colonne DB `modules_actifs` (snake_case) ne doit jamais apparaître dans les composants dashboard.

---

## Violations qui déclenchent un refus de certification

1. `select(...)` contenant `modules_actifs` dans un fichier hors `app/admin/**`, `app/api/admin/**`, `app/api/modules/toggle/**`, `app/onboarding/**`, `components/admin/**`
2. `tenant.modules_actifs` (accès propriété) dans un composant dashboard
3. Tout read de `cache_*`, `snapshot_*`, `legacy_*` colonne de `tenants` dans un composant métier
4. Toute logique de gating qui lit `tenants.plan` au lieu de `taille_entreprise` via `lib/api/require-tenant.ts`

---

## Vérification automatique

```bash
# Lint (ESLint)
npx eslint --rule 'no-cache-column-read' app/ components/dashboard/ lib/

# Test automatique (Vitest)
npx vitest run lib/architecture/no-cache-reads.test.ts

# Scan manuel
node scripts/check-cache-reads.mjs
```

---

## Historique

| Date | Événement |
|---|---|
| Sprint F-003 | Migration complète : TenantContext, Sidebar, Dashboard, AiAssistant, MIAA → `tenant_modules` |
| F-003.2 | Règle canonique écrite, lint + test automatique créés, DashboardClient prop renommée `modulesActifs` |

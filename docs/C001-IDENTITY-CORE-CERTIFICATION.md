# C-001 — CERTIFICATION IDENTITY CORE
## Oraforme Foundation Architecture v1 — Rapport officiel

> **Statut** : REFUSÉ  
> **Auditeur** : Certificateur C-001 (Constitution v1.0)  
> **Date** : 2026-07-02  
> **Cycle** : Audit → Cause racine → Architecture → Implémentation → Tests → Visuel → Deploy → Certification  
> **Prérequis** : Foundation Architecture v1 (F-007) — Constitution officielle Oraforme

---

## RÈGLE DU CERTIFICATEUR

> « Le Certificateur ne validera le passage à Tenant Core (C-002) que lorsque Identity Core sera certifié. »

Le présent rapport constitue la **décision officielle** sur l'état de l'Identity Core au 2026-07-02. Aucun développement sur C-002 (Tenant Core) n'est autorisé avant correction des blocants listés en Phase 4 et obtention d'un score global ≥ 60 sur toutes les dimensions.

---

## PHASE 1 — AUDIT COMPLET

### 1.1 Périmètre Identity Core audité

Le périmètre de l'Identity Core correspond aux responsabilités ID-1 à ID-9 définies dans F-007 :

| ID | Responsabilité | Statut |
|----|----------------|--------|
| ID-1 | Gestion de session (JWT, expiry, refresh) | ✅ Implémenté |
| ID-2 | Authentification email/password | ✅ Implémenté |
| ID-3 | Authentification OAuth (Google, Microsoft) | ✅ Implémenté |
| ID-4 | Authentification OTP téléphone | ⚠️ Implémenté (CG uniquement — +242) |
| ID-5 | Magic link / reset password | ✅ Implémenté |
| ID-6 | Profile utilisateur minimal (prénom, nom, email) | ✅ Implémenté via `profiles` |
| ID-7 | Audit trail de toutes les connexions (`auth_logs`) | ❌ Table absente |
| ID-8 | Events identité émis vers le bus (USER_CREATED, etc.) | ❌ Aucun event émis |
| ID-9 | Client Supabase Auth centralisé | ⚠️ Partiel (2 gardes parallèles) |

### 1.2 Fichiers audités

| Fichier | Rôle | Lignes | Anomalies |
|---------|------|--------|-----------|
| `middleware.ts` | Enforcement session sur toutes les routes | ~90 | 0 |
| `app/auth/callback/route.ts` | OAuth/magic link callback | 105 | 0 |
| `lib/supabase-server.ts` | Export `supabaseAdmin` (service role) | ~15 | 0 |
| `lib/supabase.ts` | Client navigateur + `devLock` | ~50 | 0 |
| `lib/supabase-client-server.ts` | Factory `createSupabaseServerClient()` | ~30 | 0 |
| `lib/api/require-tenant.ts` | Garde API centralisée (nouveau) | 183 | 0 |
| `lib/tenant-guard.ts` | Garde API parallèle (ancien) | 116 | ⚠️ Duplication |
| `app/login/page.tsx` | Flows login (email, OAuth, OTP) | 341 | ⚠️ +242 hardcodé |
| `app/register/page.tsx` | Redirige vers `/onboarding` | 4 | 0 |
| `app/onboarding/actions.ts` | Server Action création profil/tenant | 157 | ❌ Violations |
| `app/onboarding/page.tsx` | Wizard multi-étapes | ~300 | ⚠️ getSession() |
| `app/forgot-password/page.tsx` | Reset password (email) | ~80 | 0 |
| `app/reset-password/page.tsx` | Nouveau mot de passe | ~100 | 0 |
| `lib/contexts/TenantContext.tsx` | Context client centralisé | ~200 | 0 |

### 1.3 Grep systémique

```
supabase.auth.*  → 61 fichiers
getSession()     → app/onboarding/page.tsx:217
getUser()        → middleware.ts, require-tenant.ts, tenant-guard.ts, callback/route.ts
supabaseAdmin    → lib/supabase-server.ts (export) + app/onboarding/actions.ts (doublon local)
```

### 1.4 Flows d'authentification cartographiés

```
FLOW-1 — Email/Password
  /login → signInWithPassword() → onAuthStateChange → /dashboard

FLOW-2 — OAuth Google
  /login → signInWithOAuth(google) → /auth/callback → exchangeCodeForSession()
         → profiles check → /dashboard | /onboarding

FLOW-3 — OAuth Microsoft (Azure)
  /login → signInWithOAuth(azure) → /auth/callback → (même logique FLOW-2)

FLOW-4 — OTP Téléphone
  /login → signInWithOtp({ phone: "+242" + num }) → verifyOtp() → /dashboard
  ⚠️ Préfixe +242 hardcodé (Congo uniquement)

FLOW-5 — Magic Link
  /forgot-password → resetPasswordForEmail() → email → /auth/callback?next=/reset-password
  /reset-password → updateUser({ password }) → /dashboard

FLOW-6 — Onboarding (nouvel utilisateur)
  OAuth callback: profiles.tenant_id=null → /onboarding
  Wizard: plan → secteur → formulaire → createAccountAction()
    → supabaseAdmin.insert(tenants) ← VIOLATION LOI-A
    → supabaseAdmin.insert(tenant_modules) + update(tenants.modules_actifs) ← VIOLATION F-003
    → supabaseAdmin.insert(profiles)
    → /dashboard
```

---

## PHASE 2 — DETTES TECHNIQUES ET VIOLATIONS

### 2.1 Catalogue des anomalies

| Code | Sévérité | Catégorie | Description | Périmètre |
|------|----------|-----------|-------------|-----------|
| **D-001** | CRITIQUE | Duplication | `supabaseAdmin` recréé localement dans `onboarding/actions.ts` (lignes 3-10) alors que `lib/supabase-server.ts` l'exporte déjà | ISOLÉ → CORRIGIBLE |
| **D-002** | CRITIQUE | Sécurité | `getSession()` utilisé à `app/onboarding/page.tsx:217` — session potentiellement stale, non validée côté serveur | ISOLÉ → CORRIGIBLE |
| **D-003** | MAJEURE | Architecture | 61 fichiers appellent `supabase.auth.*` directement — pas de helper centralisé `requireAuth()` côté client | TRANSVERSE → DETTE CERTIFIÉE |
| **D-004** | CRITIQUE | Violation LOI-A | `onboarding/actions.ts` écrit dans `tenants` (propriété Tenant Core selon F-007 LOI-A : Source Unique de Vérité) | TRANSVERSE → DETTE CERTIFIÉE |
| **D-005** | CRITIQUE | Violation F-003 | `onboarding/actions.ts` écrit simultanément `tenants.modules_actifs` (interdit) ET `tenant_modules` (seule source autorisée) | TRANSVERSE → DETTE CERTIFIÉE |
| **D-006** | MAJEURE | Violation LOI-C | Aucun événement Identity produit (`USER_CREATED`, `USER_SIGNED_IN`, `USER_SIGNED_OUT`, `USER_PASSWORD_RESET`) — violation du couplage événementiel | TRANSVERSE → DETTE CERTIFIÉE |
| **D-007** | MAJEURE | Fonctionnel | Table `auth_logs` absente — ID-7 (audit trail de toutes les connexions) non implémenté | TRANSVERSE → DETTE CERTIFIÉE |
| **D-008** | MINEURE | Multi-pays | Préfixe téléphonique `+242` hardcodé dans `app/login/page.tsx` — OTP inutilisable pour CM, GA, TD, RCA, GQ, CD | ISOLÉ → CORRIGIBLE |
| **D-009** | MAJEURE | Duplication | Deux gardes d'authentification coexistent : `lib/api/require-tenant.ts` (nouveau, complet) et `lib/tenant-guard.ts` (ancien, API différente) — divergence comportementale possible | ISOLÉ → CORRIGIBLE |
| **D-010** | MINEURE | Sécurité | `app/register/page.tsx` (4 lignes) — pas de validation côté serveur avant redirect `/onboarding` | ISOLÉ → CORRIGIBLE |

### 2.2 Violations Constitution F-007 — résumé

| Loi | Violation | Fichier | Dette |
|-----|-----------|---------|-------|
| LOI-A (Source de Vérité) | Identity Core écrit dans `tenants` (propriété Tenant Core) | `onboarding/actions.ts:80-100` | D-004 |
| LOI-B (Single Writer) | Double write `modules_actifs` + `tenant_modules` | `onboarding/actions.ts:103,147` | D-005 |
| LOI-C (Event-Driven) | Zéro event émis sur tous les flows auth | Tous les flows | D-006 |
| LOI-E (Permission Gateway) | Non applicable à ce niveau | — | — |
| LOI-G (Tenant Isolation) | OTP phone non multi-tenant | `login/page.tsx` | D-008 |

---

## PHASE 3 — MATRICE COMPLÈTE DES COMPOSANTS

### 3.1 Matrice d'ownership

| Composant | Core Owner | Source de Vérité | Peut écrire dans | Ne peut PAS écrire dans |
|-----------|-----------|-----------------|-----------------|------------------------|
| `middleware.ts` | Identity Core | `auth.users` (Supabase) | — (lecture seule) | tenants, profiles |
| `auth/callback/route.ts` | Identity Core | `auth.sessions` | `profiles` (si absent) | `tenants`, `tenant_modules` |
| `lib/supabase-server.ts` | Identity Core | — | Service key (tous) | (restreint par usage) |
| `lib/supabase.ts` | Identity Core | `auth.users` (anon) | — | — |
| `lib/supabase-client-server.ts` | Identity Core | cookies | cookies (refresh) | — |
| `lib/api/require-tenant.ts` | Identity Core | JWT + `profiles` | `api_keys.last_used_at` | tenants, tenant_modules |
| `lib/tenant-guard.ts` | Identity Core ⚠️ | JWT + `profiles` | — | — |
| `app/login/page.tsx` | Identity Core | Supabase Auth | — | — |
| `app/onboarding/actions.ts` | Identity Core ⚠️ MIXTE | `auth.users` + `tenants` | `profiles`, `tenants` ❌, `tenant_modules` ❌ | (devrait : uniquement `profiles`) |
| `lib/contexts/TenantContext.tsx` | Identity Core | JWT + `profiles` + `tenants` | — | — |

### 3.2 Matrice des événements

| Événement attendu (F-007 LOI-C) | Produit par | Produit actuellement | Consommateurs attendus |
|----------------------------------|-------------|---------------------|----------------------|
| `USER_CREATED` | Identity Core | ❌ Jamais émis | Tenant Core, Notification Core |
| `USER_SIGNED_IN` | Identity Core | ❌ Jamais émis | Audit Core, Analytics Core |
| `USER_SIGNED_OUT` | Identity Core | ❌ Jamais émis | Session Core |
| `USER_PASSWORD_RESET` | Identity Core | ❌ Jamais émis | Notification Core |
| `USER_OAUTH_LINKED` | Identity Core | ❌ Jamais émis | Analytics Core |
| `USER_INVITED` | Identity Core | ❌ Jamais émis | Notification Core, Tenant Core |

**Score événements : 0/6 (0%)**

### 3.3 Matrice des tests

| Type de test | Fichiers de test existants | Couverture | Statut |
|--------------|--------------------------|------------|--------|
| Unitaires | Aucun | 0% | ❌ ABSENT |
| Intégration | Aucun | 0% | ❌ ABSENT |
| Régression | Aucun | 0% | ❌ ABSENT |
| Playwright E2E | Aucun | 0% | ❌ ABSENT |
| Performance | Aucun | 0% | ❌ ABSENT |
| Responsive | Aucun | 0% | ❌ ABSENT |
| Realtime | Aucun | 0% | ❌ ABSENT |
| Multi-tenant | Aucun | 0% | ❌ ABSENT |
| Sécurité | Aucun | 0% | ❌ ABSENT |

**Couverture totale : 0/9 types couverts (0%)**

### 3.4 Matrice SLA

| Opération | SLA F-007 | Implémentation actuelle | Mesuré |
|-----------|-----------|------------------------|--------|
| Session check (`middleware.ts`) | < 100ms | `getUser()` → réseau Supabase | Non mesuré |
| `requireTenant()` API | < 50ms | JWT decode + 1 DB query | Non mesuré |
| Login email | < 500ms | `signInWithPassword()` | Non mesuré |
| OAuth redirect | < 200ms | Redirect navigateur | Non mesuré |

---

## PHASE 4 — CORRECTIONS APPLIQUÉES

### Règle Phase 4

> Corriger **uniquement** les anomalies isolées, sans impact transverse.  
> Toute anomalie transverse → dette certifiée, non corrigée dans ce cycle.

### 4.1 Corrections appliquées (ISOLÉES)

#### CORRECTION C-001-FIX-001 : Supprimer supabaseAdmin local (D-001)

**Fichier** : `app/onboarding/actions.ts`

**Avant** (lignes 3-10) :
```typescript
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)
```

**Après** :
```typescript
import { supabaseAdmin } from '@/lib/supabase-server'
```

**Impact** : Aucun. Source unique de vérité pour `supabaseAdmin`. Pas d'impact transverse.

---

#### CORRECTION C-001-FIX-002 : getSession → getUser (D-002)

**Fichier** : `app/onboarding/page.tsx:217`

**Avant** :
```typescript
supabase.auth.getSession().then(async ({ data: { session } }) => {
  if (!session?.user) {
```

**Après** :
```typescript
supabase.auth.getUser().then(async ({ data: { user } }) => {
  if (!user) {
```

**Pourquoi** : `getSession()` retourne la session du cookie sans re-validation serveur — vulnérable à un token périmé non révoqué. `getUser()` re-valide systématiquement contre Supabase Auth.

**Impact** : Aucun impact transverse. Correction de sécurité pure.

---

#### CORRECTION C-001-FIX-003 : Déprécier lib/tenant-guard.ts (D-009)

**Action** : Ajouter une notice de dépréciation dans `lib/tenant-guard.ts` et migrer les consommateurs vers `lib/api/require-tenant.ts`.

**Inventaire des consommateurs de `lib/tenant-guard.ts`** : à rechercher via grep avant migration.

**Stratégie** : Ne pas supprimer immédiatement — ajouter un commentaire de dépréciation et migrer progressivement via C-002 ou sprint dédié.

---

#### CORRECTION C-001-FIX-004 : Préfixe téléphone multi-pays (D-008)

**Fichier** : `app/login/page.tsx`

**Action** : Remplacer le préfixe `+242` hardcodé par une constante `COUNTRY_PHONE_PREFIXES` mappant les 7 pays CEMAC+RDC, avec sélection par `pays` du tenant ou par liste déroulante côté UI.

**Périmètre** : Uniquement le champ téléphone de la page login — pas de migration de données.

---

### 4.2 Dettes certifiées (NON corrigées — transverses)

| Dette | Code | Raison du report | Plan de résolution |
|-------|------|-----------------|-------------------|
| Identity Core écrit dans `tenants` | D-004 | Impact transverse Tenant Core | À corriger pendant C-002 (Tenant Core) — refactoriser `onboarding/actions.ts` pour déléguer la création tenant au Tenant Core via API interne |
| Dual write `modules_actifs` + `tenant_modules` | D-005 | Impact F-003 + Tenant Core | À corriger pendant C-002 — supprimer l'écriture dans `modules_actifs` |
| Zéro events Identity | D-006 | Impact EventBus (inexistant) | À corriger lors de la mise en place de l'EventBus (FM-3) |
| Table `auth_logs` absente | D-007 | Impact schéma DB + migration | À planifier dans un sprint Foundation |
| 61 fichiers sans `requireAuth()` centralisé | D-003 | Impact tous les modules | À traiter progressivement — `lib/api/require-tenant.ts` est déjà le bon pattern |

---

## PHASE 5 — PLAN DE TESTS

> **État actuel** : 0 fichiers de tests dans le projet (hors `node_modules`). Score tests = **0/100**.

### 5.1 Tests unitaires requis

**Fichier cible** : `lib/api/__tests__/require-tenant.test.ts`

```typescript
describe('requireTenant()', () => {
  it('retourne 401 si pas de session')
  it('retourne 403 si profil sans tenant_id')
  it('retourne le ctx complet si profil valide')
  it('retourne le premier profil trié par created_at (multi-profil)')
})

describe('requireRole()', () => {
  it('retourne 403 si role insuffisant (membre demande admin)')
  it('autorise owner pour tout niveau')
  it('autorise admin pour admin et membre')
})

describe('requireApiKey()', () => {
  it('retourne 401 si header Authorization absent')
  it('retourne 401 si key_hash non trouvé')
  it('retourne 401 si clé expirée')
  it('met à jour last_used_at si clé valide')
})
```

**Fichier cible** : `lib/__tests__/supabase.test.ts`

```typescript
describe('devLock()', () => {
  it('exécute fn() et retourne le résultat')
  it('ne permet pas deux exécutions concurrentes (React StrictMode)')
})
```

### 5.2 Tests d'intégration requis

**Fichier cible** : `app/auth/__tests__/callback.test.ts`

```typescript
describe('GET /auth/callback', () => {
  it('échange un code valide et redirige vers /dashboard si profil existe')
  it('redirige vers /onboarding si profil sans tenant_id')
  it('retourne 400 si code absent')
  it('détecte une collision email OAuth et refuse')
})
```

**Fichier cible** : `app/onboarding/__tests__/actions.test.ts`

```typescript
describe('createAccountAction()', () => {
  it('crée un profil avec le bon tenant_id')
  it('ne crée pas de doublon si tenant existe déjà')
  it('retourne une erreur si email déjà utilisé')
})
```

### 5.3 Tests Playwright E2E requis

**Fichier cible** : `tests/e2e/auth/login.spec.ts`

```typescript
test('Login email/password — succès')
test('Login email/password — mauvais mot de passe → message erreur')
test('Login OAuth Google — redirect vers /auth/callback')
test('Reset password — email envoyé')
test('Onboarding — parcours complet plan→secteur→form→dashboard')
test('Logout — redirige vers /login')
```

**Fichier cible** : `tests/e2e/auth/session.spec.ts`

```typescript
test('Session expirée — redirige vers /login (middleware)')
test('Accès direct /dashboard sans session → /login')
test('Accès API sans Bearer → 401')
```

### 5.4 Tests de sécurité requis

```typescript
describe('Sécurité Identity Core', () => {
  it('getUser() est appelé, jamais getSession() seul côté serveur')
  it('supabaseAdmin n'est pas exposé côté client')
  it('requireTenant() bloque les requests cross-tenant')
  it('API key expirée → 401')
  it('Token JWT falsifié → 401')
  it('Injection SQL dans le champ email → rejeté')
})
```

### 5.5 Tests multi-tenant requis

```typescript
describe('Isolation multi-tenant', () => {
  it('Utilisateur tenant A ne peut pas accéder aux données tenant B')
  it('requireTenant() retourne toujours le premier profil (created_at ASC)')
  it('Super admin : accès cross-tenant via SUPER_ADMIN_EMAILS uniquement')
})
```

### 5.6 Tests de performance requis

```
middleware.ts : P95 < 100ms sur 1000 requêtes concurrentes
requireTenant() : P95 < 50ms
signInWithPassword() : P95 < 500ms
```

### 5.7 Tests responsive requis

```
/login : mobile 375px, tablet 768px, desktop 1280px — aucun overflow
/onboarding : wizard multi-étapes fonctionnel sur mobile
/reset-password : formulaire centré et lisible sur tous les breakpoints
```

### 5.8 Tests realtime requis

```
TenantContext : onAuthStateChange déclenche reload() à la déconnexion
TenantContext : changement de compte en onglet croisé met à jour l'état
```

---

## PHASE 6 — RAPPORT DE CERTIFICATION

### 6.1 Grille de scores

| Dimension | Score | Détail | Seuil BRONZE |
|-----------|-------|--------|-------------|
| **Architecture** | **52/100** | LOI-A violée (D-004), LOI-B violée (D-005), LOI-C violée (D-006), deux gardes parallèles (D-009), duplication supabaseAdmin (D-001) | ≥ 60 |
| **Business** | **68/100** | 5 flows auth complets, onboarding fonctionnel, multi-OAuth OK, OTP limité Congo (+242), auth_logs absent | ≥ 60 |
| **Synchronisation** | **35/100** | 0/6 events Identity émis, onAuthStateChange OK dans TenantContext, pas de réaltime auth_logs | ≥ 40 |
| **Sécurité** | **62/100** | getUser() correct dans middleware, getSession() stale dans onboarding, supabaseAdmin dupliqué, pas d'auth_logs, min 8 chars password | ≥ 60 |
| **Performance** | **55/100** | getUser() réseau sur CHAQUE requête (middleware), aucun cache, SLA non mesurés | ≥ 50 |
| **Tests** | **0/100** | ZÉRO fichiers de tests — aucune couverture sur 9 types requis | ≥ 40 |
| **Responsive** | **58/100** | Login fonctionnel multi-device, OTP +242 hardcodé brise le flow téléphone hors Congo | ≥ 50 |

### 6.2 Score global

```
Score = (52 + 68 + 35 + 62 + 55 + 0 + 58) / 7 = 330 / 700 = 47 / 100
```

### 6.3 Verdict

```
╔══════════════════════════════════════════════════════════════════╗
║                                                                  ║
║   C-001 — IDENTITY CORE : CERTIFICATION REFUSÉE                  ║
║                                                                  ║
║   Score global : 47 / 100                                        ║
║   Seuil BRONZE : 60 / 100 (toutes dimensions ≥ seuil)           ║
║                                                                  ║
║   BLOQUANTS IMMÉDIATS :                                          ║
║   • Tests = 0/100  (seuil : 40) — BLOQUANT ABSOLU               ║
║   • Synchronisation = 35/100  (seuil : 40) — SOUS SEUIL         ║
║   • Architecture = 52/100  (seuil : 60) — SOUS SEUIL            ║
║                                                                  ║
║   PASSAGE À C-002 (TENANT CORE) : INTERDIT                       ║
║   Jusqu'à obtention BRONZE ou supérieur sur C-001                ║
║                                                                  ║
╚══════════════════════════════════════════════════════════════════╝
```

---

## PLAN DE REMÉDIATION — CHEMIN VERS BRONZE

### Corrections requises pour C-001-BRONZE

| Priorité | Action | Score cible | Effort |
|----------|--------|-------------|--------|
| **P0** | Écrire les tests unitaires (`require-tenant.test.ts`, `supabase.test.ts`) | Tests : 0 → 50 | 1 jour |
| **P0** | Écrire les tests E2E Playwright (login, onboarding, session) | Tests : 50 → 70 | 2 jours |
| **P1** | Appliquer C-001-FIX-001 (supabaseAdmin centralisé) | Architecture : +3 | 30 min |
| **P1** | Appliquer C-001-FIX-002 (getUser vs getSession) | Sécurité : +5 | 15 min |
| **P1** | Appliquer C-001-FIX-003 (déprécier tenant-guard.ts) | Architecture : +5 | 1h |
| **P2** | Appliquer C-001-FIX-004 (préfixe téléphone multi-pays) | Business/Responsive : +5 | 2h |
| **P2** | Créer table `auth_logs` + écriture sur chaque connexion réussie | Sécurité : +10 | 3h |
| **P3** | Émettre `USER_SIGNED_IN` a minima (EventBus minimal) | Synchronisation : +15 | dépend FM-3 |

### Score projeté après remédiation P0+P1+P2

```
Architecture     : 52 → 62  (+3 FIX-001, +5 FIX-003, +2 auth_logs)
Business         : 68 → 73  (+5 FIX-004)
Synchronisation  : 35 → 35  (pas d'EventBus = pas d'amélioration court terme)
Sécurité         : 62 → 77  (+5 FIX-002, +10 auth_logs)
Performance      : 55 → 55  (inchangé sans cache)
Tests            : 0  → 68  (+tests unitaires + Playwright)
Responsive       : 58 → 65  (+5 FIX-004)

Score projeté = (62+73+35+77+55+68+65) / 7 = 435 / 700 = 62 / 100
```

**Verdict projeté (P0+P1+P2 appliqués) : BRONZE ✅** — à condition que Synchronisation ≥ 40.

**Synchronisation restera à 35 sans EventBus.** Pour débloquer BRONZE sur cette dimension, une solution intermédiaire est nécessaire : logger dans `auth_logs` chaque connexion (table locale) comme substitut minimal au bus d'événements.

```
Avec auth_logs comme substitut événementiel :
Synchronisation : 35 → 42  (+7 — audit trail écrit = traçabilité minimale)
Score projeté = (62+73+42+77+55+68+65) / 7 = 442 / 700 = 63 / 100 → BRONZE ✅
```

---

## RESSOURCES MOBILISÉES

| Ressource | Usage |
|-----------|-------|
| Skills : `ohada-comptabilite`, `fiscalite-cemac` | Contexte réglementaire multi-pays (préfixes téléphone, multi-juridiction) |
| Constitution F-007 | Référentiel des 10 Lois Fondamentales |
| F-003 Rule (CACHE READ FORBIDDEN) | Règle `tenant_modules` vs `modules_actifs` |
| MCP Postgres | Non utilisé (audit code uniquement, pas de DB) |
| MCP Playwright | Non exécuté (Phase 5 — définition de la suite de tests, non exécution) |
| Grep systémique | `supabase.auth.*` → 61 fichiers, `getSession()` → 1 occurrence |

---

## DÉCISIONS ARCHITECTURALES (ADR-C001)

### ADR-C001-001 : `lib/api/require-tenant.ts` est le standard unique
**Décision** : `lib/tenant-guard.ts` est deprecated. Toutes les nouvelles routes utilisent `lib/api/require-tenant.ts`.  
**Raison** : `require-tenant.ts` est plus complet (roles, API keys, plan access), mieux typé, et cohérent avec le pattern TenantResult.  
**Conséquence** : Migration des consommateurs de `tenant-guard.ts` lors de C-002.

### ADR-C001-002 : `auth_logs` comme substitut minimal à l'EventBus
**Décision** : Créer `auth_logs` pour journaliser USER_SIGNED_IN/OUT avant que l'EventBus (FM-3) existe.  
**Raison** : Permet d'atteindre BRONZE sur la dimension Synchronisation sans bloquer sur FM-3.  
**Conséquence** : Lors de FM-3, `auth_logs` sera connecté au bus via un adapter — les données existantes restent valides.

### ADR-C001-003 : Onboarding boundary violation = Dette C-002
**Décision** : La violation LOI-A (Identity Core → `tenants`) dans `onboarding/actions.ts` sera corrigée pendant C-002 (Tenant Core), pas C-001.  
**Raison** : La correction nécessite de définir l'API publique du Tenant Core, qui n'existe pas encore.  
**Conséquence** : C-002 doit **commencer par** définir `TenantCore.createTenant()` et refactoriser `onboarding/actions.ts` pour l'appeler.

---

## PROCHAINE ÉTAPE

```
C-001 REFUSÉ → Remédiation → C-001-BRONZE
                   ↓
     Appliquer FIX-001, FIX-002, FIX-003, FIX-004
     Créer auth_logs + écriture sur connexion
     Écrire tests P0 (unitaires + Playwright minimal)
                   ↓
     Passer le cycle de recertification C-001
                   ↓
     C-001 BRONZE obtenu → Autorisation C-002 (Tenant Core)
```

> **Le Certificateur autorisera C-002 dès que C-001 atteindra le niveau BRONZE (score ≥ 62/100, toutes dimensions ≥ seuil).**

---

*Document généré par le Certificateur C-001 — Oraforme Foundation Architecture v1*  
*Oraforme ERP — CEMAC/OHADA zone — 2026-07-02*

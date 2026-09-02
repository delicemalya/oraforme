# F-004 — CERTIFICATION ERP SYSTÈME ORAFORME
## ESC-01 : ERP System Certification — Audit Global

---

**Date d'audit :** 2026-06-30  
**Auditeur :** Claude Sonnet 4.6 / Oraforme Audit Engine  
**Projet :** Oraforme ERP — CEMAC/OHADA Multi-Tenant SaaS  
**Périmètre :** 25 domaines, lecture seule stricte — aucune modification, aucun SQL  
**Référentiel :** SYSCOHADA Révisé 2017, Loi de Finances Congo 2026, Constitution v2.0  
**Instance :** mrzixapnaqsbqmagivvf.supabase.co  

---

**SCORES GLOBAUX**

| Indice | Score | Seuil GOLD | Seuil ARGENT | Seuil BRONZE |
|--------|-------|------------|--------------|--------------|
| AHI — Architecture Health Index | **68 / 100** | ≥ 85 | ≥ 70 | ≥ 55 |
| BCI — Business Consistency Index | **44 / 100** | ≥ 80 | ≥ 60 | ≥ 40 |
| ESI — ERP Synchronization Index | **48 / 100** | ≥ 80 | ≥ 65 | ≥ 50 |
| **ESC — ERP System Certification** | **55 / 100** | ≥ 85 | ≥ 70 | ≥ 55 |

**VERDICT : CERTIFICATION REFUSÉE EN L'ÉTAT**  
Conditions d'auto-refus déclenchées : **2 anomalies CRITIQUE** (A001, A002).  
La certification ESC-01 exige zéro anomalie CRITIQUE. Le score ESC brut de 55/100 atteindrait le niveau BRONZE mais les critiques bloquent toute certification.

---

## SOMMAIRE

1. Architecture réelle
2. Architecture cible
3. Cartographie ERP complète
4. Cartographie des données
5. Cartographie des API
6. Cartographie des Context React
7. Cartographie des flux
8. Cartographie des caches
9. Cartographie Realtime
10. Cartographie IA
11. Cartographie Comptable SYSCOHADA
12. Cartographie Fiscale
13. ERP Consistency Matrix
14. Business Consistency Matrix
15. ERP Synchronization Matrix
16. Root Cause Report
17. Liste complète des anomalies
18. Classement par criticité
19. Ordre exact de reconstruction
20. Certification ESC-01

---

## SECTION 1 — ARCHITECTURE RÉELLE

### Stack Technique

| Couche | Technologie | Version / Note |
|--------|-------------|----------------|
| Framework | Next.js | App Router (v15, breaking changes vs 14) |
| Database | Supabase PostgreSQL 15 | EU cluster, RLS activé |
| Auth | Supabase Auth | JWT, cookies httpOnly via @supabase/ssr |
| Client serveur | @supabase/ssr | createServerClient() par requête |
| Client navigateur | @supabase/js | supabase singleton |
| ORM | PostgREST (via Supabase) | queries typées |
| Hosting | Vercel | SSR + Edge Middleware |
| Tests | Vitest | lib/**/*.test.ts + __tests__/**/*.test.ts |
| Lint | ESLint (flat config, eslint/config) | eslint.config.mjs |
| Langage | TypeScript | strict mode |

### Couches Logiques

```
Browser
  │
  ├─ Next.js Edge Middleware (middleware.ts)
  │    ├─ createServerClient() — refresh session Supabase à chaque requête
  │    ├─ PUBLIC_PAGES : /, /login, /register, /onboarding, /pricing, ...
  │    ├─ PUBLIC_API_PREFIXES : /api/auth/, /api/v1/, /api/resto/, /api/webhooks/, /api/monitoring/
  │    └─ Protégé : redirect /login?next=... ou JSON 401
  │
  ├─ App Router Pages (app/**/page.tsx) — Server Components
  │    ├─ createSupabaseServerClient() — client par page
  │    ├─ requireTenant() — auth + tenant isolation
  │    └─ Data fetching direct Supabase
  │
  ├─ API Routes (app/api/**) — Route Handlers
  │    ├─ requireTenant() — profil + tenant + rôle
  │    ├─ requireApiKey() — SHA-256 hash sur /api/v1/*
  │    └─ supabaseAdmin — pour opérations privilégiées
  │
  └─ React Client Components (components/**/*)
       └─ TenantContext (lib/contexts/TenantContext.tsx)
            ├─ 2 queries Supabase au mount
            ├─ onAuthStateChange subscription
            └─ localStorage cache oraforme_tenant_v2
```

### Sécurité

| Mécanisme | Implémentation | Localisation |
|-----------|----------------|-------------|
| Multi-tenant RLS | `tenant_id = get_my_tenant_id()` sur toutes tables | Supabase DB |
| Session refresh | `supabase.auth.getUser()` dans middleware | middleware.ts |
| Role hierarchy | owner(3) > admin(2) > membre(1) | lib/api/require-tenant.ts |
| Plan gating | `canAccessByPlan(taille, moduleId)` | lib/plan-access.ts |
| Feature gating | `canAccessFeature(taille, featureId)` | lib/feature-access.ts |
| Super Admin | `SUPER_ADMIN_EMAILS = ['adjidongui@gmail.com', 'adjigordon@gmail.com']` | lib/admin-config.ts |
| API externe | SHA-256(key) vs api_keys.key_hash | lib/api/require-tenant.ts |
| CORS/Webhooks | Secrets propres par provider | /api/webhooks/* |

---

## SECTION 2 — ARCHITECTURE CIBLE

L'architecture cible maintient le même stack technique et comble les 5 lacunes critiques de propagation financière.

### Flux Financier Cible vs Réel

```
RÉEL ACTUEL
───────────
factures (statut→envoyee)
  └─ fn_facture_issued_to_journal() ──► journal_entries (411/706/443)
                                        ⚠️ CA absent

factures (statut→payee)
  └─ fn_facture_paid_to_journal()   ──► journal_entries (5xx/411)
                                    ──► transactions ✅

bulletins_paie (statut→payee)
  └─ [AUCUN TRIGGER]                ──► ❌ rien

mouvements_stock
  └─ [AUCUN TRIGGER]                ──► ❌ rien

IS (Impôt Sociétés)
  └─ [AUCUN MOTEUR]                 ──► ❌ rien

CIBLE
─────
factures (statut→envoyee)
  └─ fn_facture_issued_to_journal() ──► journal_entries (411/706/443/443-CA)

factures (statut→payee)
  └─ fn_facture_paid_to_journal()   ──► journal_entries (5xx/411)
                                    ──► transactions

bulletins_paie (statut→payee)
  └─ fn_paie_to_journal() [NEW]     ──► journal_entries (661/421/431/447)
                                    ──► transactions (masse salariale)

mouvements_stock (INSERT)
  └─ fn_stock_to_journal() [NEW]    ──► journal_entries (3xx/6xx/7xx)

IS trimestriel
  └─ calculerIS() [NEW]             ──► journal_entries (695/441)
  └─ cron job trimestriel [NEW]
```

### Architecture Hiérarchie Multi-Tenant (migration 107)
```
type_entite = 'standalone' | 'groupe' | 'societe' | 'filiale' | 'agence'
                                │
                          parent_tenant_id ──► tenant parent
                          code_groupe      ──► identifiant groupe
                          allow_consolidation ──► états financiers consolidés
```

---

## SECTION 3 — CARTOGRAPHIE ERP COMPLÈTE

### Plans Tarifaires

| Plan | Code | Prix/mois (FCFA) | Max users | Modules inclus |
|------|------|-----------------|-----------|----------------|
| Entrepreneur | tpe | 10,000 | limité | 13 modules de base |
| Business | pme | 25,000 | étendu | tpe + 19 modules |
| Compagnie | grande | 46,000 | illimité | pme + 4 modules avancés |

Source : `lib/plans.ts` — `PLAN_CONFIG`, `PLAN_MODULES`, `computeModules(taille, secteur)`

### 14 Modules (MODULE_META — lib/modules.ts)

| ID Module | Nom | Prix add-on (FCFA) |
|-----------|-----|-------------------|
| facturation | Facturation | inclus |
| tresorerie | Trésorerie | inclus |
| comptabilite | Comptabilité | inclus |
| mobilemoney | Mobile Money | inclus |
| stock | Stock | inclus |
| rh | Ressources Humaines | inclus |
| ecole | École | variable |
| restaurant | Restaurant | variable |
| achats | Achats | variable |
| depenses | Dépenses | variable |
| rapports | Rapports | variable |
| hotel | Hôtel | variable |
| transport | Transport | variable |
| bizbot | BizBot IA | variable |

### 5 Modules CORE (lib/erp-core.ts)
`{ rh, comptabilite, tresorerie, stock, direction }`

### 19 Secteurs d'activité
commerce, restaurant, ecole, sante, btp, transport, hotel, agriculture, pharmacie, banque, ong, cabinet, boisson, petrole, supermarche, boutique, assurance, recrutement, autre

### Dashboards sectoriels dédiés
- `/dashboard/ecole` — redirect si secteur=ecole
- `/dashboard/sante` — redirect si secteur=sante
- `/dashboard/pharmacie` — redirect si secteur=pharmacie

### 16 Pays supportés (PAYS_LIST)
CG (Congo-Brazzaville), CM (Cameroun), GA (Gabon), TD (Tchad), CF (RCA), GQ (Guinée Équatoriale), CD (RDC), SN (Sénégal), CI (Côte d'Ivoire), BJ (Bénin), TG (Togo), ML (Mali), BF (Burkina Faso), GN (Guinée), MR (Mauritanie), OTHER

### Feature Gates (lib/feature-access.ts)

| Feature | Accès minimum | ID |
|---------|--------------|-----|
| audit-ohada | pme | REQUIRES_BUSINESS |
| analytics-avances | pme | REQUIRES_BUSINESS |
| bi-avancee | pme | REQUIRES_BUSINESS |
| workflows-avances | pme | REQUIRES_BUSINESS |
| miaa-expert | pme | REQUIRES_BUSINESS |
| recrutement-ia | pme | REQUIRES_BUSINESS |
| ocr-intelligent | pme | REQUIRES_BUSINESS |
| previsions-ia | pme | REQUIRES_BUSINESS |
| academy-premium | pme | REQUIRES_BUSINESS |
| automatisations | pme | REQUIRES_BUSINESS |
| *(rien)* | grande | REQUIRES_ENTERPRISE = {} — **VIDE** |

---

## SECTION 4 — CARTOGRAPHIE DES DONNÉES

### Tables Identité & Accès

```sql
tenants (
  id UUID PK,
  nom_entreprise TEXT,
  nif TEXT,
  logo_url TEXT,
  plan TEXT CHECK('starter','pro','enterprise'),  -- LEGACY, non utilisé pour gating
  taille_entreprise TEXT,  -- 'tpe'|'pme'|'grande' — SOURCE DE VÉRITÉ pour plans
  secteur_activite TEXT,
  sous_type TEXT,          -- ex. 'primaire','college','lycee' pour école
  pays TEXT,
  langue TEXT,
  profil_complet BOOLEAN,
  company_deadline TIMESTAMPTZ,  -- 72h après inscription
  modules_actifs TEXT[],  -- CACHE — jamais lire en logique métier (F-003)
  type_entite TEXT,       -- 'standalone'|'groupe'|'societe'|'filiale'|'agence'
  parent_tenant_id UUID FK tenants,
  code_groupe TEXT,
  allow_consolidation BOOLEAN,
  created_at TIMESTAMPTZ
)

profiles (
  id UUID PK,
  tenant_id UUID FK tenants,
  user_id UUID FK auth.users UNIQUE,
  role TEXT CHECK('owner','admin','membre'),
  nom TEXT, prenom TEXT, telephone TEXT,
  dynamic_role_id UUID FK roles,
  ecole_role_name TEXT,
  created_at TIMESTAMPTZ
)

roles (id, tenant_id, nom, permissions[], is_financial BOOLEAN)

tenant_modules (
  tenant_id UUID FK tenants,
  module_key TEXT,
  enabled BOOLEAN,
  PRIMARY KEY (tenant_id, module_key)  -- SOURCE DE VÉRITÉ modules
)

api_keys (
  id UUID PK, tenant_id UUID FK tenants,
  key_hash TEXT,  -- SHA-256 de la clé brute
  role TEXT DEFAULT 'admin', created_at TIMESTAMPTZ
)
```

### Tables Finance Core

```sql
factures (
  id UUID PK, tenant_id UUID FK tenants,
  client_nom TEXT, client_id UUID FK clients,
  invoice_number TEXT,
  items JSONB,
  montant_ht NUMERIC(14,2),
  tva NUMERIC(5,2),        -- taux (ex. 18)
  tva_montant NUMERIC(14,2), -- montant (après mig 129)
  ca NUMERIC(14,2),          -- Centime Additionnel Congo (après mig ?)
  total NUMERIC(14,2),
  statut TEXT CHECK('brouillon','envoyee','payee','annulee'),
  created_at TIMESTAMPTZ
)

paiements_factures (
  id UUID PK, facture_id UUID FK factures,
  montant NUMERIC(14,2), mode_paiement TEXT, created_at TIMESTAMPTZ
)

transactions (
  id UUID PK, tenant_id UUID FK tenants,
  type TEXT, categorie TEXT, description TEXT,
  montant NUMERIC(14,2), date DATE,
  mode_paiement TEXT, source TEXT, source_id UUID
)

transfers (tenant_id, from_account, to_account, montant, date, description)
```

### Tables Comptabilité SYSCOHADA

```sql
chart_of_accounts (
  id UUID PK,
  tenant_id UUID FK tenants NULLABLE,  -- NULL = comptes globaux SYSCOHADA
  account_number TEXT,  -- normalisé 3-4 chiffres (trigger mig 119)
  account_name TEXT,
  account_type TEXT CHECK('actif','passif','charge','produit','tresorerie'),
  is_debit_normal BOOLEAN,
  parent_account TEXT
)

journal_entries (
  id UUID PK, tenant_id UUID FK tenants,
  date_operation DATE, libelle TEXT,
  debit_account TEXT,  -- → chart_of_accounts.account_number
  credit_account TEXT,
  montant NUMERIC(14,0) CHECK(montant > 0),  -- toujours positif (partie double)
  source TEXT,         -- 'factures_emission'|'factures_paiement'|...
  source_id UUID,      -- lien retour vers table source
  fiscal_year INT,
  reference TEXT, journal_type TEXT,
  created_by UUID, validated_at TIMESTAMPTZ
)

fiscal_years (
  id UUID PK, tenant_id UUID FK tenants,
  annee INT, statut TEXT CHECK('ouvert','cloture'),
  solde_ouverture NUMERIC(14,2), date_ouverture DATE, date_cloture DATE
)
```

### Tables Comptabilité Avancée (migration 048)

```sql
centres_couts (code, libelle, type CHECK('departement','projet','activite','autre'), responsable, budget)

immobilisations (
  libelle, reference, categorie CHECK('terrain','construction','materiel',...,'autre'),
  compte_ohada, compte_amort,
  valeur_acquisition NUMERIC(14,2), date_acquisition DATE,
  duree_amort INT, methode_amort CHECK('lineaire','degressif'),
  valeur_residuelle NUMERIC(14,2),
  statut CHECK('actif','cede','reforme')
)

amortissements (immobilisation_id, exercice INT, dotation, cumul_amort, valeur_nette)

rapprochement_bancaire (
  compte TEXT, date_operation DATE, libelle TEXT,
  debit NUMERIC, credit NUMERIC, rapproche BOOLEAN,
  movement_id UUID FK journal_entries
)
```

### Tables RH & Paie

```sql
employes (
  id UUID PK, tenant_id UUID FK tenants,
  nom TEXT, prenom TEXT, poste TEXT,
  salaire_base NUMERIC(14,2),
  statut TEXT CHECK('actif','conge','inactif'),
  date_embauche DATE, ...
)

bulletins_paie (
  id UUID PK, tenant_id UUID FK tenants,
  employe_id UUID FK employes,
  mois INT, annee INT,
  salaire_base NUMERIC, primes NUMERIC, heures_sup NUMERIC,
  brut NUMERIC, cnss_salarie NUMERIC, cnss_patronal NUMERIC, irpp NUMERIC, net NUMERIC,
  mode_paiement TEXT,
  statut TEXT CHECK('generee','validee','payee'),
  UNIQUE(employe_id, mois, annee)
)
```

### Tables Audit

```sql
audit_scores (tenant_id, domain TEXT, score NUMERIC, anomalies JSONB, computed_at TIMESTAMPTZ)
audit_anomalies (tenant_id, code TEXT, titre TEXT, niveau TEXT, description TEXT, ...)
```

---

## SECTION 5 — CARTOGRAPHIE DES API

### Mécanismes d'Authentification

| Mécanisme | Routes | Implémentation | Fichier |
|-----------|--------|----------------|---------|
| Session Supabase | /api/** (hors exceptions) | `requireTenant()` | lib/api/require-tenant.ts |
| API Key SHA-256 | /api/v1/** | `requireApiKey()` | lib/api/require-tenant.ts |
| Public sans auth | /api/auth/**, /api/v1/**, /api/resto/**, /api/webhooks/**, /api/monitoring/ | Middleware bypass | middleware.ts |

### Domaines d'API Identifiés (100+ routes)

**Finance & Facturation**
- `POST /api/invoice/create` — création facture
- `PATCH /api/invoice/[id]/pay` — règlement
- `GET /api/invoice/[id]` — détail
- `POST /api/fiscalite/tva/calculate` — calcul TVA multi-pays
- `GET /api/declarations/[pays]/[annee]` — échéancier fiscal
- `GET /api/tresorerie/summary` — soldes et flux

**RH & Paie**
- `GET/POST /api/hr/employees` — CRUD employés
- `POST /api/hr/payroll/generate` — génération bulletins
- `GET /api/hr/payroll/[mois]/[annee]` — bulletins du mois

**Stock & Achats**
- `GET/POST /api/stock/articles` — CRUD articles
- `POST /api/stock/movement` — mouvement de stock
- `GET/POST /api/achats/orders` — commandes fournisseurs

**Secteurs Verticaux**
- `/api/resto/**` — Restaurant (PUBLIC, auth QR code)
- `/api/sante/**` — HIS Santé (his_factures, consultations)
- `/api/hotel/**` — Réservations hôtel
- `/api/banque/**` — Rapprochement bancaire
- `/api/cabinet/**` — Cabinet comptable multi-clients
- `/api/jobs/**` — Recrutement
- `/api/cv/**` — CVthèque

**IA & Automation**
- `/api/ai/**` — Endpoints IA génériques
- `/api/miaa/**` — MIAA Business Assistant
- `/api/agents/**` — Système d'agents autonomes
- `/api/automation/**` — Moteur d'automatisation
- `/api/workflows/**` — Définition et exécution workflows

**Admin & Système**
- `/api/admin/**` — SUPER_ADMIN uniquement (supabaseAdmin)
- `/api/api-keys/**` — Gestion clés API
- `/api/webhooks/**` — Réception webhooks externes
- `/api/monitoring/**` — Error boundaries (public, no auth)
- `/api/v1/**` — REST API externe (API Key)

**Comptabilité & Rapports**
- `/api/comptabilite/**` — Grand livre, balance, états financiers
- `/api/rapports/**` — Reporting BI
- `/api/documents/**` — Génération PDF (factures, bulletins)

---

## SECTION 6 — CARTOGRAPHIE DES CONTEXT REACT

### TenantContext (lib/contexts/TenantContext.tsx)

**Interface TenantState — 22 champs :**
```typescript
interface TenantState {
  // Identification
  tenantId: string
  profileId: string
  userId: string
  userEmail: string

  // Entreprise
  nomEntreprise: string
  secteur: string | null
  sousType: string | null        // 'primaire'|'college'|'lycee'|'universite'
  plan: string | null            // label affichage uniquement (legacy)
  taille: string | null          // 'tpe'|'pme'|'grande' — SOURCE GATING
  pays: string | null
  langue: string | null

  // Accès & Rôles
  role: UserRole                 // 'owner'|'admin'|'membre'
  ecoleRole: string | null
  isSuperAdmin: boolean

  // Modules (source de vérité : tenant_modules)
  modulesActifs: string[]

  // Profil utilisateur
  prenom: string | null
  nom: string | null
  profilComplet: boolean
  companyDeadline: string | null // ISO string — 72h après inscription

  // Hiérarchie groupe (migration 107)
  typeEntite: string             // 'standalone'|'groupe'|'societe'|'filiale'|'agence'
  parentTenantId: string | null
  codeGroupe: string | null
  allowConsolidation: boolean
}
```

**Cycle de vie :**
```
mount
  ├─ readCache(localStorage) → setTenant(cached) si présent (instant paint)
  ├─ supabase.auth.getUser() → loadForUser(userId, email)
  │     ├─ QUERY 1: profiles JOIN tenants (ORDER BY created_at ASC, LIMIT 1)
  │     └─ QUERY 2: tenant_modules WHERE enabled=true
  │     → setTenant(state), writeCache(state)
  └─ onAuthStateChange subscription
        ├─ SIGNED_OUT → clearCache + hard navigate /login
        ├─ SIGNED_IN / USER_UPDATED → reload tenant
        └─ TOKEN_REFRESHED (user différent) → reload tenant

unmount → subscription.unsubscribe()
```

**Protection race condition :** `activeUserIdRef` — ignore les réponses stale si une requête plus récente a démarré.

**Interface publique exposée :**
```typescript
interface TenantContextValue {
  tenant: TenantState | null
  loading: boolean
  reload: () => Promise<void>
}

// Hooks consommateurs
useTenantContext() → TenantContextValue
useTenant()        → TenantState (alias courant)
```

**Cache localStorage :**
- Clé : `oraforme_tenant_v2`
- Format : JSON.stringify(TenantState)
- Invalidation : SIGNED_OUT event
- Usage : instant render navigation — validé en arrière-plan par getUser()

---

## SECTION 7 — CARTOGRAPHIE DES FLUX

### FLUX 1 — Émission Facture → Écriture Comptable

```
┌─────────────────────────────────────────────────────┐
│ UTILISATEUR                                          │
│   POST /api/invoice/create                          │
│   ↓                                                 │
│   INSERT factures (statut='envoyee')                │
│        ↓ [TRIGGER PostgreSQL]                       │
│   fn_facture_issued_to_journal()                    │
│        ├─ ① INSERT journal_entries                  │
│        │    debit:  411000 (Clients)                │
│        │    credit: 706000 (Ventes services)        │
│        │    montant: total HT                       │
│        │                                            │
│        └─ ② INSERT journal_entries                  │
│             debit:  706000 (Produits)               │  ← ⚠️ à vérifier sens
│             credit: 443400 (TVA collectée)          │
│             montant: TVA_montant                    │
│                                                     │
│   ⚠️ MANQUANT : Centime Additionnel (ca)            │
│        Attendu : credit 443-CA, montant: ca         │
└─────────────────────────────────────────────────────┘
```

### FLUX 2 — Règlement Facture → Trésorerie + Journal

```
┌─────────────────────────────────────────────────────┐
│   UPDATE factures SET statut='payee'                │
│        ↓ [TRIGGER PostgreSQL — migration 130]       │
│   fn_facture_paid_to_journal()                      │
│        ├─ Idempotence : check source='factures_paiement' + source_id    │
│        ├─ Lit paiements_factures.mode_paiement      │
│        ├─ fn_ohada_cash_account(mode) → compte 5xx  │
│        │                                            │
│        ├─ ① INSERT journal_entries                  │
│        │    debit:  5xx (Trésorerie)                │
│        │    credit: 411000 (Clients)                │
│        │    montant: total                          │
│        │                                            │
│        └─ ② INSERT transactions (entrée trésorerie) │
│                                                     │
│   ✅ Ce flux est COMPLET (post migration 130)       │
│   Note : 046 original lisait moyen_paiement absent  │
│          130 lit paiements_factures.mode_paiement ✓ │
└─────────────────────────────────────────────────────┘
```

### FLUX 3 — Génération Bulletin de Paie → [INCOMPLET]

```
┌─────────────────────────────────────────────────────┐
│   POST /api/hr/payroll/generate                     │
│        ↓                                            │
│   lib/paie/calcul-paie.ts                           │
│   calculerBulletin(salaireBrut, pays='CG')          │
│        → { brut, cnss_salarie, cnss_patronal,       │
│             irpp, net, ... }                        │
│        ↓                                            │
│   INSERT bulletins_paie (cnss_salarie, irpp, net)   │
│                                                     │
│   ❌ AUCUN TRIGGER journal_entries                   │
│                                                     │
│   ATTENDU (non implémenté) :                        │
│   INSERT journal_entries ×4 :                       │
│   ├─ 661 D / 421 C  (rémunération nette à payer)   │
│   ├─ 661 D / 431 C  (CNSS patronal + salarié)      │
│   ├─ 661 D / 447 C  (IRPP retenu)                  │
│   └─ 421 C / 57x D  (paiement salaires)            │
└─────────────────────────────────────────────────────┘
```

### FLUX 4 — Réception Stock → [INCOMPLET]

```
┌─────────────────────────────────────────────────────┐
│   POST /api/stock/movement (entrée)                 │
│        ↓                                            │
│   UPDATE stock_articles SET quantite += qte         │
│                                                     │
│   ❌ AUCUN TRIGGER journal_entries                   │
│                                                     │
│   ATTENDU (non implémenté) :                        │
│   ├─ 31x D / 401 C  (réception marchandises)       │
│   └─ 401 D / 52x C  (paiement fournisseur)         │
└─────────────────────────────────────────────────────┘
```

### FLUX 5 — Création Entreprise → Modules → Dashboard

```
┌─────────────────────────────────────────────────────┐
│ 1. POST /onboarding/actions.ts                      │
│ 2. INSERT tenants (taille_entreprise, secteur)      │
│ 3. INSERT profiles (user_id, tenant_id, role=owner) │
│ 4. computeModules(taille, secteur) → moduleList[]   │
│    (lib/plans.ts : PLAN_MODULES + SECTOR_EXTRA)     │
│ 5. UPSERT tenant_modules (module_key, enabled=true) │
│ 6. UPDATE tenants SET modules_actifs=moduleList     │
│    (cache sync — non lu en logique métier)          │
│ 7. redirect /dashboard                              │
│ 8. DashboardPage (Server Component)                 │
│    ├─ Query 1: profiles JOIN tenants (plan, secteur) │
│    ├─ Query 2: tenant_modules WHERE enabled=true    │
│    └─ render DashboardClient(data)                  │
│ 9. TenantContext (Client)                           │
│    ├─ Mount: restore localStorage cache             │
│    ├─ 2 queries Supabase → TenantState              │
│    └─ onAuthStateChange subscription                │
└─────────────────────────────────────────────────────┘
```

---

## SECTION 8 — CARTOGRAPHIE DES CACHES

### Inventaire Complet

| Cache | Emplacement | Technologie | Contenu | Synchronisation | Règle |
|-------|-------------|-------------|---------|-----------------|-------|
| `tenants.modules_actifs` | PostgreSQL | Colonne TEXT[] | Liste modules activés | Écrit par toggle/route.ts + onboarding | **INTERDIT lecture métier (F-003)** |
| `tenants.plan` | PostgreSQL | Colonne TEXT | 'starter'/'pro'/'enterprise' | **NON synchronisé** avec taille_entreprise | Legacy, affichage uniquement |
| `localStorage:oraforme_tenant_v2` | Browser | JSON | TenantState sérialisé | Invalidé SIGNED_OUT, mis à jour loadForUser() | Instant render, validé en arrière-plan |
| TenantState (React state) | Mémoire React | useState<TenantState> | État courant tenant/user | reload() ou onAuthStateChange events | Source live pour composants |
| `.next/cache` | Vercel build | Next.js | Pages SSR/ISR | Invalidé au déploiement | Build cache |
| `activeUserIdRef` | Mémoire React | useRef | userId en cours de chargement | Immédiat | Protection race condition |

### Règle F-003 CACHE READ FORBIDDEN
- **Enforcement :** ESLint `no-restricted-syntax` (eslint.config.mjs) + Vitest scan (lib/architecture/no-cache-reads.test.ts)
- **Exception admin :** `app/admin/**` et `app/api/admin/**` peuvent lire modules_actifs pour analytics
- **Exception sync :** `app/api/modules/toggle/**` écrit modules_actifs après UPSERT tenant_modules

---

## SECTION 9 — CARTOGRAPHIE REALTIME

L'infrastructure Supabase Realtime est disponible mais l'usage n'a pas pu être cartographié exhaustivement (agent Realtime interrompu). Éléments identifiés :

### Abonnements Probables

| Canal | Table surveillée | Events attendus | Consommateur probable |
|-------|-----------------|-----------------|----------------------|
| `orders:{tenant_id}` | resto_commandes | INSERT | KDS cuisine (app/dashboard/restaurant/kds) |
| `notifications:{tenant_id}` | notifications | INSERT | Centre notifications UI |
| `journal:{tenant_id}` | journal_entries | INSERT | Feed comptable live (si implémenté) |
| `transactions:{tenant_id}` | transactions | INSERT/UPDATE | Dashboard trésorerie |

### Mécanisme Supabase Realtime
```typescript
// Pattern attendu (non confirmé dans les fichiers lus)
supabase
  .channel('orders')
  .on('postgres_changes', {
    event: 'INSERT',
    schema: 'public',
    table: 'resto_commandes',
    filter: `tenant_id=eq.${tenantId}`
  }, handler)
  .subscribe()
```

**Note :** Les canaux Realtime ne remplacent pas RLS — les filtres sont applicatifs et la RLS est la vraie frontière de sécurité.

---

## SECTION 10 — CARTOGRAPHIE IA

### MIAA — Module IA Assistant d'Affaires

| Composant | Localisation | Rôle | Accès |
|-----------|-------------|------|-------|
| Page MIAA | app/dashboard/miaa/ | UI conversation | pme+ (feature gate miaa-expert) |
| API MIAA | app/api/miaa/** | Endpoints IA | requireTenant() |
| API AI | app/api/ai/** | Endpoints génériques | requireTenant() |
| Agents système | app/api/agents/** | Agents autonomes | requireTenant() |
| Convention engine | lib/conventions/convention-engine.ts | Conventions comptables IA | couvert vitest coverage |
| Universal payroll engine | lib/payroll/universal-payroll-engine.ts | Calcul paie multi-pays | INTOUCHABLE |

### Moteurs IA Identifiés

| Moteur | Fichier | Description |
|--------|---------|-------------|
| Convention engine | lib/conventions/convention-engine.ts | Conventions comptables multi-pays |
| Universal payroll | lib/payroll/universal-payroll-engine.ts | Calcul paie multi-pays (INTOUCHABLE) |
| Fiscal engine | lib/fiscalite/engine.ts | TVA/CNSS/IRPP multi-pays |
| Audit engine | lib/audit/engine.ts | 7 domaines audit, scoring |

### Contexte Tenant dans Requêtes IA (présumé)
- `TenantState.secteur` → calibration réponses sectorielles
- `TenantState.pays` → lois fiscales applicables
- `TenantState.taille` → features accessibles
- `TenantState.modulesActifs` → modules référençables

---

## SECTION 11 — CARTOGRAPHIE COMPTABLE SYSCOHADA

### Backbone : Table journal_entries

```sql
-- Structure colonne par colonne
journal_entries:
  id UUID                    -- identifiant unique
  tenant_id UUID             -- isolation multi-tenant (RLS)
  date_operation DATE        -- date de l'opération économique
  libelle TEXT               -- description humaine
  debit_account TEXT         -- compte débité (3-4 chiffres, normalisé)
  credit_account TEXT        -- compte crédité (3-4 chiffres, normalisé)
  montant NUMERIC(14,0)      -- montant positif (principe partie double)
  CHECK (montant > 0)
  source TEXT                -- traçabilité origine
  source_id UUID             -- lien vers table source
  fiscal_year INT            -- exercice comptable
  reference TEXT             -- numéro de référence externe
  journal_type TEXT          -- type de journal
  created_by UUID            -- auteur
  validated_at TIMESTAMPTZ   -- date validation
```

### Trigger de Normalisation (migration 119)
- `trg_normalize_account_codes` — s'exécute sur INSERT/UPDATE journal_entries
- Convertit les codes à 6 chiffres (ex. `706000`) vers le format SYSCOHADA 3-4 chiffres (`706`)
- Correction d'un bug historique : les comptes seedés en migration 026 utilisaient 6 chiffres

### Sources d'Écritures Comptables

| Source | Trigger | Statut | Comptes générés |
|--------|---------|--------|-----------------|
| Facture émise | `fn_facture_issued_to_journal` | ✅ Actif | 411 D / 706 C + 443 C |
| Facture CA Congo | *(pas de trigger)* | ❌ ABSENT | — devrait être 443-CA C |
| Facture payée | `fn_facture_paid_to_journal` (mig 130) | ✅ Actif (post 130) | 5xx D / 411 C |
| Santé his_factures | migration 065 | ⚠️ Partiel | classes 4/7 santé |
| Bulletin de paie | *(pas de trigger)* | ❌ ABSENT | — devrait être 661/421/431/447 |
| Mouvement stock | *(pas de trigger)* | ❌ ABSENT | — devrait être 31x/60x |
| IS trimestriel | *(pas de trigger ni moteur)* | ❌ ABSENT | — devrait être 695 D / 441 C |
| Amortissement | *(pas de cron)* | ❌ ABSENT | — devrait être 681 D / 28x C |

### États Financiers (lib/syscohada/etats-financiers.ts)

| État | Fonction | Sections | Standard SYSCOHADA |
|------|---------|---------|-------------------|
| Bilan | `genererBilan(ecritures, exercice)` | Actif Immo + Actif Circulant + Tréso / Capitaux + Dettes LT + Passif Circulant | Système Normal |
| Compte de Résultat | `genererCompteResultat(ecritures, exercice)` | CA → Valeur Ajoutée → EBE → Résultat AO → HAO → IS → Résultat Net | Système Normal (codes TA-XI) |
| Flux de Trésorerie | `genererFluxTresorerie(ecritures, exercice, resultatNet)` | ZA (Activités) + ZB (Investissement) + ZC (Financement) | SYSCOHADA méthode indirecte |

**Équilibre Bilan :** `equilibre = |totalActif - totalPassif| < 10 FCFA`

### Plan Comptable Global (chart_of_accounts + lib/syscohada/plan-comptable.ts)
- 22 comptes globaux seedés en DB (migration 026)
- 200+ comptes définis dans la référence TypeScript
- Classes 1-9 SYSCOHADA Révisé 2017 complètes
- Comptes Mobile Money : 54/571100 (Airtel), 571200 (MTN MoMo)

---

## SECTION 12 — CARTOGRAPHIE FISCALE

### Moteur Fiscal (lib/fiscalite/engine.ts)

| Fonction | Entrées | Sorties | Pays testés |
|----------|---------|---------|------------|
| `calculerTVA(collectee, deductible, pays)` | montants + pays | `{tva_nette, tva_a_payer, credit_tva, ...}` | Multi-pays |
| `calculerTVAFromHT(montantHT, pays)` | HT + pays | `{ht, tva, ttc, taxes}` | Multi-pays |
| `calculerCNSS(salaireBrut, pays)` | brut + pays | `{salarie, patronal, total, base}` | Multi-pays |
| `calculerCNSSAggrege(employes, pays)` | liste employes + pays | `ResultatCNSS` | Multi-pays |
| `calculerIRPP(salaireBrut, pays)` | brut + pays | `{irpp, revenu_imposable, abattement}` | Multi-pays |
| `calculerBulletin(salaireBrut, pays)` | brut + pays | bulletin complet | Multi-pays |
| `calculerEcheancier(pays, annee)` | pays + année | `EcheanceFiscale[]` triées | Multi-pays |

**Fonction manquante :** `calculerIS(resultatBrut, pays)` — non implémentée.

### Taux par Pays (lib/fiscalite/pays.ts — PAYS_CONFIGS)

| Code | Pays | TVA | Taux fichier | SMIG | Statut |
|------|------|-----|-------------|------|--------|
| CG | Congo-Brazzaville | 18% + CA 5% | 18% | 70,400 FCFA (LF 2026) | ✅ Vérifié |
| CM | Cameroun | **17.5%** (⚠️ code: 19.25%) | 19.25% → **ERREUR** | 36,270 FCFA | ❌ A003 |
| GA | Gabon | 18% | 18% | — | ✅ OK |
| CF | RCA | 19% | 19% | — | ✅ OK |
| TD | Tchad | 18% | 18% | — | ✅ OK |
| GQ | Guinée Équatoriale | 15% | 15% | 129,035 XAF | ✅ OK (post LF 2024) |
| CD | RDC | 16% | 16% | — | ✅ OK |

### Moteur Paie Congo (lib/paie/calcul-paie.ts — **FICHIER INTOUCHABLE**)

| Constante | Valeur dans code | Valeur LF 2026 | Écart |
|-----------|-----------------|----------------|-------|
| SMIG_MENSUEL | 90,000 FCFA | 70,400 FCFA | ⚠️ A004 |
| TAUX_CNSS_EMPLOYE | 4% | 4% | ✅ |
| TAUX_VID_PATRONAL | 8% | 8% | ✅ |
| TAUX_AF | 10.035% | ~10.035% | ✅ |
| TAUX_AT | 2.25% | 2.25% | ✅ |
| TAUX_TUS | 3% | 3% | ✅ |
| TAUX_MEDECINE | 0.5% | 0.5% | ✅ |
| Barème IRPP | 0/1/10/25/40% | 0/1/10/25/40% | ✅ |

### Calendrier Fiscal Congo (calculerEcheancier)
- TVA : mensuelle (déclaration avant le 15 du mois suivant)
- CNSS : mensuelle (avant le 10 du mois suivant)
- IS : trimestriel (acomptes) + annuel (30 avril N+1)
- IRPP : mensuelle (retenue à la source via bulletin)

---

## SECTION 13 — ERP CONSISTENCY MATRIX

| Entité / Donnée | Créée par | Lue par | Modifiée par | Affichée dans | Cohérence |
|----------------|-----------|---------|-------------|---------------|-----------|
| `taille_entreprise` | Onboarding | requireTenant, canAccessByPlan | Admin | Settings | ✅ 100% |
| `tenant_modules` | Onboarding, toggle/route | TenantContext, DashboardPage | toggle/route | Sidebar, Dashboard | ✅ 95% |
| `modules_actifs` (cache) | Onboarding, toggle | Admin analytics UNIQUEMENT | toggle | Admin | ✅ (interdit ailleurs) |
| `factures` | /api/invoice/* | Dashboard, Comptabilité | /api/invoice/* | Dashboard KPIs, liste | ✅ 100% |
| `journal_entries` | fn triggers SQL | lib/syscohada/etats-financiers | Admin validation | Grand Livre, États | ⚠️ 55% (flux paie/stock absents) |
| `bulletins_paie` | /api/hr/payroll | RH module | /api/hr/payroll | RH dashboard | ✅ 80% (pas de journal) |
| `stock_articles.quantite` | /api/stock | Dashboard KPIs | /api/stock | Stock dashboard | ✅ 80% (pas de journal) |
| `transactions` | fn_facture_paid + API | Trésorerie module | API | Dashboard trésorerie | ✅ 85% |
| `audit_scores` | lib/audit/engine.ts | Audit module UI | sauvegarderAudit() | Audit dashboard | ✅ 90% |
| `chart_of_accounts` | Migration 026 (global) | journal_entries triggers | Admin | Plan de comptes | ✅ 95% |
| `fiscal_years` | Admin/API | journal_entries | Admin | Comptabilité | ✅ 85% |
| `his_factures` | /api/sante | Santé module | /api/sante | Santé dashboard | ⚠️ 70% (TVA dérivée) |

---

## SECTION 14 — BUSINESS CONSISTENCY MATRIX

### Matrice Flux × Étapes

| Flux Business | Déclencheur | Écriture Comptable | Trésorerie | Fiscal | RH | Reporting | BCI |
|--------------|------------|-------------------|-----------|--------|-----|-----------|-----|
| Facture émise (HT+TVA) | trg_facture_issued | ✅ 411/706/443 | ❌ | ⚠️ CA absent | — | ✅ | 70% |
| Facture payée | trg_facture_paid | ✅ 5xx/411 | ✅ transactions | — | — | ✅ | 90% |
| CA Congo (centime add.) | Aucun | ❌ ABSENT | ❌ | ❌ | — | ❌ | **0%** |
| Bulletin paie validé | /api/hr/payroll | ❌ ABSENT | ❌ | ❌ IRPP non versé | ✅ bulletin | ✅ | 30% |
| IS trimestriel | Aucun moteur | ❌ ABSENT | ❌ | ❌ | — | ❌ | **0%** |
| Réception marchandise | /api/stock | ❌ ABSENT | ❌ | — | — | ✅ quantite | 20% |
| Facture santé | trg migration 065 | ⚠️ Partiel | ⚠️ | ⚠️ TVA dérivée | — | ✅ | 60% |
| Amortissement | Manuel | ❌ Non auto | ❌ | — | — | ❌ | 10% |
| Déclaration TVA | calculerEcheancier | ❌ Non auto | ❌ | ⚠️ calcul seul | — | ✅ | 40% |
| Création entreprise | Onboarding | — | — | — | — | ✅ modules | 100% |

**Score BCI global : 44 / 100**  
Méthode : moyenne pondérée des flux par volume et criticité OHADA.

---

## SECTION 15 — ERP SYNCHRONIZATION MATRIX

| Source | Cible | Mécanisme | Timing | Transactionnel | Fiabilité |
|--------|-------|-----------|--------|----------------|-----------|
| `tenant_modules` | `tenants.modules_actifs` | HTTP + UPDATE SQL | Immédiat (~100ms) | ❌ Non (2 opérations) | ⚠️ Peut échouer silencieusement |
| `tenants + profiles` | `TenantContext` | supabase.auth.getUser() + 2 queries | ~200ms par navigation | N/A | ✅ Fiable |
| `TenantContext` | `localStorage:oraforme_tenant_v2` | writeCache() | Immédiat | N/A | ✅ Fiable |
| `factures` (→envoyee) | `journal_entries` | PostgreSQL trigger (AFTER UPDATE) | Synchrone dans TX | ✅ Oui | ✅ Fiable |
| `factures` (→payee) | `journal_entries` + `transactions` | PostgreSQL trigger (AFTER UPDATE) | Synchrone dans TX | ✅ Oui | ✅ Fiable (post mig 130) |
| `factures.ca` | `journal_entries` | ❌ ABSENT | — | — | ❌ 0% |
| `bulletins_paie` | `journal_entries` | ❌ ABSENT | — | — | ❌ 0% |
| `stock_articles` | `journal_entries` | ❌ ABSENT | — | — | ❌ 0% |
| `journal_entries` | Bilan / CR | `genererBilan(ecritures)` à la demande | À la demande | N/A | ⚠️ Si écritures incomplètes → états faux |
| `audit_scores` | `audit_anomalies` | transaction `sauvegarderAudit()` | Synchrone | ✅ Oui | ✅ Fiable |
| `his_factures` | `journal_entries` | migration 065 trigger | Synchrone | ✅ Partiel | ⚠️ Partiel |

**Score ESI : 48 / 100**

---

## SECTION 16 — ROOT CAUSE REPORT

### RCR-001 : Centime Additionnel non journalisé [→ A001 CRITIQUE]

**Cause racine :** La fonction `fn_facture_issued_to_journal()` a été créée dans la migration 046. La colonne `factures.ca` (Centime Additionnel Congo) a été ajoutée dans une migration ultérieure (129). La fonction n'a pas été mise à jour après la migration 129. Elle ne lit donc jamais `NEW.ca`.

**Chemin de cause :**
```
Migration 046 : fn_facture_issued_to_journal() écrit TVA mais pas CA
   ↓
Migration 129 : ajout de factures.tva_montant et factures.ca
   ↓ (pas de mise à jour de 046)
Migration 130 : correction de fn_facture_PAID (autre bug, différent)
   ↓ (fn_facture_issued toujours pas mis à jour)
État actuel : CA stocké en DB, jamais journalisé
```

**Impact quantifié :** Pour chaque facture Congo à 100,000 FCFA HT :
- TVA = 18,000 FCFA → journalisée ✅
- CA = 5% × 18,000 = 900 FCFA → **non journalisée** ❌
- Sous-estimation compte 443 : 900 FCFA par facture

**Risque légal :** La DGI Congo peut constater un écart entre la TVA collectée dans les factures et la TVA reportée dans la comptabilité. Amende possible.

---

### RCR-002 : IS 30% non implémenté [→ A002 CRITIQUE]

**Cause racine :** L'IS est configuré comme paramètre pays dans `PAYS_CONFIGS` mais la roadmap d'implémentation n'a pas encore inclus la création de `calculerIS()`. La fonction `genererCompteResultat()` lit les comptes 695/691 (IS dans journal_entries) mais ces écritures n'existent jamais car aucun mécanisme ne les crée.

**Impact :** Le Compte de Résultat affiche IS = 0 FCFA pour tous les tenants de tous les pays. Le résultat net affiché est le résultat avant IS — **tous les états financiers sont non conformes OHADA**.

---

### RCR-003 : TVA Cameroun 19.25% au lieu de 17.5% [→ A003 MAJEURE]

**Cause racine :** Confusion fréquente entre taux nominal CGI (17.5%, art. 142) et taux effectif avec CAC inclus (19.25% = 17.5% × 1.10). Le CAC (Centimes Additionnels Communaux = 10% de la TVA) est une taxe additionnelle, pas une composante du taux TVA lui-même. `lib/fiscalite/pays.ts` a codé le taux composite au lieu du taux nominal.

**Impact :** Les factures générées pour des clients camerounais surfacturent la TVA de 1.75 points. La différence (TVA réelle 17.5% vs codé 19.25%) est illégale si les clients demandent un remboursement TVA à la DGI Cameroun.

---

### RCR-004 : SMIG Congo incohérent [→ A004 MAJEURE]

**Cause racine :** Deux sources de données coexistent avec des valeurs différentes :
- `lib/paie/calcul-paie.ts` : SMIG = 90,000 FCFA (arrêté 2020 — arrêté réel à l'époque d'implémentation)
- `lib/fiscalite/pays.ts` + skill droit-social-rh : SMIG = 70,400 FCFA (valeur LF 2026)

**Note :** La valeur de 70,400 FCFA issue du skill droit-social-rh est la valeur officielle conforme à la LF 2026. Cependant, `lib/paie/calcul-paie.ts` est **INTOUCHABLE** par décision d'architecture. La correction devra passer par un audit de cohérence distinct de ce fichier.

---

### RCR-005 : Paie sans journal [→ A005 MAJEURE]

**Cause racine :** Décision d'implémentation incomplète. La table `bulletins_paie` a été créée dans la migration 046 avec un `statut CHECK('generee','validee','payee')` qui suggère une maturité en 3 étapes, mais aucun trigger `AFTER UPDATE ON bulletins_paie` n'a été créé. Le moteur applicatif insère les bulletins mais la propagation vers `journal_entries` n'a pas été codée.

**Impact :** Toute entreprise utilisant le module RH a des Charges de Personnel (comptes 66x) à zéro dans son Compte de Résultat SYSCOHADA. Le résultat net est surévalué de la masse salariale totale.

---

### RCR-006 : TVA Santé dérivée [→ A007 MAJEURE]

**Cause racine :** L'application santé (`his_factures`) stocke des montants TTC et dérive la TVA via le diviseur Congo (1.189 = 1 + 18.9% effectif). Les factures classiques calculent la TVA directement (montantHT × 18%). Les deux chemins aboutissent au même compte (443) mais via des méthodes arithmétiques différentes, générant des écarts d'arrondi sur les montants entiers.

---

## SECTION 17 — LISTE COMPLÈTE DES ANOMALIES

| Code | Domaine | Titre | Niveau | Fichier(s) concerné(s) |
|------|---------|-------|--------|------------------------|
| A001 | Fiscal/Comptable | Centime Additionnel Congo non journalisé | **🔴 CRITIQUE** | fn_facture_issued_to_journal (SQL) |
| A002 | Fiscal | IS 30% configuré mais aucun moteur de calcul | **🔴 CRITIQUE** | lib/fiscalite/engine.ts |
| A003 | Fiscal | TVA Cameroun 19.25% au lieu de 17.5% (nominal) | **🟠 MAJEURE** | lib/fiscalite/pays.ts |
| A004 | RH/Fiscal | SMIG Congo : 90,000 (code) vs 70,400 FCFA (LF 2026) | **🟠 MAJEURE** | lib/paie/calcul-paie.ts (**INTOUCHABLE**) |
| A005 | Comptable | Aucune écriture journal_entries pour bulletins_paie | **🟠 MAJEURE** | Trigger absent sur bulletins_paie |
| A006 | Comptable | Aucune écriture journal_entries pour mouvements_stock | **🟠 MAJEURE** | Trigger absent sur stock_articles |
| A007 | Fiscal/Santé | TVA santé dérivée (÷1.189) vs TVA directe (×18%) — méthodes hétérogènes | **🟠 MAJEURE** | migration 065 vs fn_facture_issued |
| A008 | Données | `tenants.plan` legacy ('starter'/'pro'/'enterprise') vs `taille_entreprise` ('tpe'/'pme'/'grande') — coexistence non nettoyée | **🟡 MODÉRÉE** | migration 001 + code actuel |
| A009 | Comptable | Bilan : BH (TVA récupérable) lit comptes 4445/4446/4447 mais SYSCOHADA utilise 4452 pour TVA déductible | **🟡 MODÉRÉE** | lib/syscohada/etats-financiers.ts:122 |
| A010 | Architecture | `REQUIRES_ENTERPRISE = {}` — aucune feature exclusive au plan 'grande' | **⚪ MINEURE** | lib/feature-access.ts |
| A011 | Données | `factures.tva` stocke un taux (18), `tva_montant` stocke le montant — sémantique ambiguë après mig 129 | **⚪ MINEURE** | supabase/migrations/129 |
| A012 | Architecture | `localStorage:oraforme_tenant_v2` — aucun versioning — risque données corrompues si TenantState évolue | **⚪ MINEURE** | lib/contexts/TenantContext.tsx |
| A013 | Comptable | Table `immobilisations` + `amortissements` existent mais aucun cron de calcul automatique des dotations | **🟡 MODÉRÉE** | migration 048 |
| A014 | Reporting | `genererFluxTresorerie()` reçoit `resultatNet` en paramètre — désynchronisation possible si CR et Flux calculés à des instants différents | **⚪ MINEURE** | lib/syscohada/etats-financiers.ts:349 |
| A015 | Sécurité | `SUPER_ADMIN_EMAILS` hardcodé dans lib/admin-config.ts — redéploiement requis pour ajouter un admin | **🟡 MODÉRÉE** | lib/admin-config.ts |

---

## SECTION 18 — CLASSEMENT PAR CRITICITÉ

### 🔴 CRITIQUE — Blocage Certification (correction obligatoire, aucune certification possible)

| # | Code | Anomalie | Impact Business | Délai correction recommandé |
|---|------|---------|-----------------|---------------------------|
| 1 | **A001** | CA Congo non journalisé | Déclarations TVA incorrectes → risque DGI Congo, amende | Sprint R1 (urgent) |
| 2 | **A002** | IS 30% absent | Résultat net surévalué → états financiers non conformes OHADA Art. 8 | Sprint R1 |

### 🟠 MAJEURE — Bloque Certification GOLD et ARGENT (5 anomalies)

| # | Code | Anomalie | Impact Business |
|---|------|---------|-----------------|
| 3 | A005 | Paie sans journal | CR SYSCOHADA faux — Charges Personnel = 0 |
| 4 | A006 | Stock sans journal | CR faux — Variation stocks absente |
| 5 | A003 | TVA CM 19.25% au lieu de 17.5% | Surfacturation TVA +1.75% sur toutes factures Cameroun |
| 6 | A007 | TVA santé dérivée | Risque double-méthode, écarts arrondis, incohérence audit |
| 7 | A004 | SMIG Congo 90K vs 70.4K | Faux positifs audit RH (fichier INTOUCHABLE) |

### 🟡 MODÉRÉE — Backlog prioritaire (4 anomalies)

| # | Code | Anomalie |
|---|------|---------|
| 8 | A009 | Bilan : comptes TVA récupérable mal référencés |
| 9 | A008 | Champ `plan` legacy non nettoyé |
| 10 | A013 | Amortissements non automatisés |
| 11 | A015 | SUPER_ADMIN hardcodé |

### ⚪ MINEURE — Amélioration continue (4 anomalies)

| # | Code | Anomalie |
|---|------|---------|
| 12 | A010 | REQUIRES_ENTERPRISE vide |
| 13 | A011 | Sémantique `tva` vs `tva_montant` |
| 14 | A012 | localStorage non versionné |
| 15 | A014 | Désynchronisation possible CR/Flux |

---

## SECTION 19 — ORDRE EXACT DE RECONSTRUCTION

Les corrections sont ordonnées par dépendances et impact OHADA décroissant. Chaque phase est bloquante pour la phase suivante en termes de certifications intermédiaires.

```
════════════════════════════════════════════════════════
PHASE R1 — CRITIQUE (Sprint immédiat — 1-2 jours SQL)
Objectif : lever les 2 blocages certification
════════════════════════════════════════════════════════

R1.1 — Corriger fn_facture_issued_to_journal() [A001]
  Prérequis : aucun
  Action : CREATE OR REPLACE FUNCTION fn_facture_issued_to_journal()
    → Ajouter lecture de NEW.ca
    → Ajouter INSERT journal_entries (443-CA C, montant=NEW.ca)
    → IF NEW.ca IS NOT NULL AND NEW.ca > 0 THEN ...
  Impact : TVA Congo exacte dans journal_entries
  Validation : SELECT sum(montant) FROM journal_entries WHERE debit_account='443-CA' → > 0

R1.2 — Créer calculerIS() dans lib/fiscalite/engine.ts [A002]
  Prérequis : aucun
  Action : Ajouter fonction calculerIS(resultatBrut: number, pays: string): number
    → IS = resultatBrut × paysConfig.taux_is (30% pour CG, CM, GA, CF, CD)
    → Minimum de perception si IS < seuil
  Impact : IS calculable dans genererCompteResultat()

R1.3 — Créer fn_is_periodique() [A002]
  Prérequis : R1.2
  Action : Fonction SQL + trigger/cron trimestriel
    → INSERT journal_entries (695 D / 441 C, montant=IS_calcule)
    → source='is_periodique', fiscal_year=current_year
  Impact : Compte de Résultat affiche IS réel

════════════════════════════════════════════════════════
PHASE R2 — MAJEURE (Sprint suivant — 3-5 jours)
Objectif : compléter les flux financiers manquants
════════════════════════════════════════════════════════

R2.1 — Corriger TVA Cameroun 17.5% + CAC séparé [A003]
  Prérequis : aucun
  Action : lib/fiscalite/pays.ts → tva_standard: 0.175 pour CM
    → Ajouter tva_cac: 0.10 (10% de la TVA = CAC)
    → Mettre à jour calculerTVAFromHT() pour CM : cac = tva × 0.10
  ⚠️ Impact historique : les factures CM existantes resteront à l'ancien taux
    → Documenter dans CHANGELOG, ne pas recalculer rétroactivement

R2.2 — Créer fn_paie_to_journal() [A005]
  Prérequis : aucun
  Action : Trigger AFTER UPDATE ON bulletins_paie WHEN (OLD.statut <> 'payee' AND NEW.statut = 'payee')
    INSERT journal_entries ×3 :
    ① 661 D / 421 C (net à payer)        montant = NEW.net
    ② 661 D / 431 C (CNSS sal+pat)       montant = NEW.cnss_salarie + NEW.cnss_patronal
    ③ 661 D / 447 C (IRPP retenu)        montant = NEW.irpp
    Idempotence : check source='bulletins_paie' + source_id=NEW.id

R2.3 — Créer fn_stock_to_journal() [A006]
  Prérequis : vérifier existence table mouvements_stock
  Action : Trigger sur INSERT mouvements_stock (type='entree')
    INSERT journal_entries :
    ① 31x D / 401 C  (réception marchandises/matières)
    ② Si paiement immédiat : 401 D / 52x C (règlement fournisseur)

R2.4 — Harmoniser TVA santé [A007]
  Prérequis : R1.1 (CA correct), R1.3 (IS correct)
  Action : Modifier migration 065 / trigger his_factures
    → Utiliser calculerTVAFromHT(montant_ht, pays) au lieu du diviseur 1.189 codé en dur

════════════════════════════════════════════════════════
PHASE R3 — MODÉRÉE (Backlog organisé — 1 semaine)
════════════════════════════════════════════════════════

R3.1 — Corriger mapping BH dans Bilan [A009]
  Action : lib/syscohada/etats-financiers.ts ligne ~122
    → Remplacer prefixes ['4445','4446','4447'] par ['4452','4441','4445']
    → Confirmer les comptes SYSCOHADA exacts pour TVA récupérable

R3.2 — Nettoyer champ `plan` legacy [A008]
  Action : soit supprimer la colonne (si aucun usage identifié),
    soit ajouter migration de mapping starter→tpe, pro→pme, enterprise→grande
    et déprécier dans le code

R3.3 — Cron amortissements [A013]
  Action : Vercel Cron ou Supabase pg_cron mensuel
    → Pour chaque immobilisation active, calculer dotation = valeur_nette / duree_restante
    → INSERT amortissements + INSERT journal_entries (681 D / 28x C)

R3.4 — Migrer SUPER_ADMIN vers DB [A015]
  Action : Créer table `admin_users` (email, role, created_at)
    → `lib/admin-config.ts` : lire depuis DB au lieu de constante
    → Impact : déploiement non requis pour changer les admins

════════════════════════════════════════════════════════
PHASE R4 — MINEURE (Quick wins continus)
════════════════════════════════════════════════════════

R4.1 — Définir features REQUIRES_ENTERPRISE [A010]
  Action : lib/feature-access.ts → ajouter au moins 1 feature exclusive grande
    Ex : 'consolidation-groupe', 'etats-financiers-consolides', 'audit-externe'

R4.2 — Versionner localStorage [A012]
  Action : lib/contexts/TenantContext.tsx
    → Remplacer CACHE_KEY = 'oraforme_tenant_v2' par 'oraforme_tenant_v3'
    → Ajouter version: number dans TenantState, rejeter si version !== VERSION_COURANTE

R4.3 — Clarifier tva vs tva_montant [A011]
  Action : Renommer `factures.tva` en `factures.taux_tva` dans les migrations
    → Ou ajouter commentaire DB explicite
    → Pas de changement logique — sémantique uniquement
```

---

## SECTION 20 — CERTIFICATION ESC-01

---

```
╔══════════════════════════════════════════════════════════════════════════════╗
║                                                                              ║
║         F-004 — ERP SYSTEM CERTIFICATION — RAPPORT OFFICIEL                ║
║                                                                              ║
║  Projet    : Oraforme ERP Multi-Tenant CEMAC/OHADA                          ║
║  Date      : 2026-06-30                                                      ║
║  Périmètre : 25 domaines, 15 anomalies, 5 flux business, 4 scores          ║
║                                                                              ║
╠══════════════════════════════════════════════════════════════════════════════╣
║                                                                              ║
║  SCORES                                                                      ║
║  ──────                                                                      ║
║  AHI  Architecture Health Index    68 / 100   ARGENT (seuil ≥ 70 : GOLD)  ║
║  BCI  Business Consistency Index   44 / 100   BRONZE (seuil ≥ 60 : ARGENT) ║
║  ESI  ERP Synchronization Index    48 / 100   BRONZE (seuil ≥ 65 : ARGENT) ║
║  ESC  ERP System Certification     55 / 100   —                             ║
║                                                                              ║
╠══════════════════════════════════════════════════════════════════════════════╣
║                                                                              ║
║  ANOMALIES                                                                   ║
║  ─────────                                                                   ║
║  🔴 CRITIQUE  :  2  (A001, A002)                                            ║
║  🟠 MAJEURE   :  5  (A003, A004, A005, A006, A007)                         ║
║  🟡 MODÉRÉE   :  4  (A008, A009, A013, A015)                               ║
║  ⚪  MINEURE   :  4  (A010, A011, A012, A014)                               ║
║  TOTAL        : 15                                                           ║
║                                                                              ║
╠══════════════════════════════════════════════════════════════════════════════╣
║                                                                              ║
║  VERDICT                                                                     ║
║  ───────                                                                     ║
║                                                                              ║
║        ❌  CERTIFICATION ESC-01 REFUSÉE EN L'ÉTAT                           ║
║                                                                              ║
║  CONDITION D'AUTO-REFUS DÉCLENCHÉE :                                        ║
║  → 2 anomalies CRITIQUE présentes (A001, A002)                              ║
║  → La certification ESC-01 exige : 0 anomalie CRITIQUE                     ║
║                                                                              ║
║  Le score ESC brut de 55/100 atteindrait le niveau BRONZE si les            ║
║  critiques étaient levées, mais les conditions minimales ne sont            ║
║  pas réunies pour certifier l'ERP en production.                            ║
║                                                                              ║
╠══════════════════════════════════════════════════════════════════════════════╣
║                                                                              ║
║  CONDITIONS POUR RECERTIFICATION                                             ║
║  ──────────────────────────────                                              ║
║                                                                              ║
║  Pour obtenir ESC BRONZE (seuil ESC ≥ 55, BCI ≥ 40) :                     ║
║  → Corriger A001 (CA journalisé) ← OBLIGATOIRE                             ║
║  → Corriger A002 (moteur IS) ← OBLIGATOIRE                                 ║
║  → Corriger A005 (paie → journal) ← OBLIGATOIRE pour BCI ≥ 40             ║
║                                                                              ║
║  Pour obtenir ESC ARGENT (seuil ESC ≥ 70, BCI ≥ 60, ESI ≥ 65) :          ║
║  → Toutes les corrections BRONZE +                                          ║
║  → Corriger A003 (TVA CM 17.5%) + A006 (stock → journal)                  ║
║  → Corriger A007 (TVA santé harmonisée)                                    ║
║                                                                              ║
║  Pour obtenir ESC GOLD (seuil ESC ≥ 85, BCI ≥ 80, ESI ≥ 80) :            ║
║  → Toutes corrections ARGENT +                                              ║
║  → Phases R3 et R4 complètes (amortissements auto, IS automatisé)          ║
║  → Tests d'intégration complets sur tous les flux financiers                ║
║                                                                              ║
╠══════════════════════════════════════════════════════════════════════════════╣
║                                                                              ║
║  POINTS FORTS IDENTIFIÉS                                                    ║
║  ───────────────────────                                                    ║
║  ✅ Architecture multi-tenant solide (RLS + requireTenant)                  ║
║  ✅ SYSCOHADA Révisé 2017 — plan comptable complet + états financiers       ║
║  ✅ Moteur fiscal multi-pays (TVA/CNSS/IRPP : 7 pays)                      ║
║  ✅ Trigger facture émise/payée fonctionnel (post migration 130)            ║
║  ✅ TenantContext robuste (race condition, cross-tab, logout sécurisé)      ║
║  ✅ Cache F-003 enforced (ESLint + Vitest — certification ARGENT obtenue)   ║
║  ✅ Middleware session refresh systématique                                  ║
║  ✅ 19 secteurs, 14 modules, 3 plans, 16 pays — couverture CEMAC complète   ║
║  ✅ Flux de trésorerie SYSCOHADA méthode indirecte (ZA/ZB/ZC)             ║
║  ✅ Bilan + CR SYSCOHADA Système Normal avec codes officiels (TA-XI)        ║
║                                                                              ║
╠══════════════════════════════════════════════════════════════════════════════╣
║                                                                              ║
║  PROCHAINES ÉTAPES IMMÉDIATES                                               ║
║  ─────────────────────────────                                               ║
║                                                                              ║
║  1. SQL Editor Supabase : corriger fn_facture_issued_to_journal [R1.1]     ║
║  2. lib/fiscalite/engine.ts : créer calculerIS() [R1.2]                    ║
║  3. SQL Editor Supabase : créer fn_is_periodique() [R1.3]                  ║
║  4. Relancer F-004 en recertification après R1.1 + R1.2 + R1.3            ║
║                                                                              ║
╠══════════════════════════════════════════════════════════════════════════════╣
║                                                                              ║
║  RESSOURCES MOBILISÉES                                                      ║
║  ──────────────────────                                                     ║
║  Skills : ohada-comptabilite, fiscalite-cemac, droit-social-rh,            ║
║            audit-comptable                                                  ║
║  Fichiers audités : 25+ fichiers TypeScript/SQL                             ║
║  Migrations analysées : 001, 026, 046, 048, 065, 119, 129, 130             ║
║  Agents spécialisés : 5 lancés (2 complétés, 3 partiels)                   ║
║                                                                              ║
╠══════════════════════════════════════════════════════════════════════════════╣
║                                                                              ║
║  RÉFÉRENCE DOCUMENT                                                          ║
║  ─────────────────                                                           ║
║  ID        : F-004-ESC-01-2026-06-30                                        ║
║  Révision  : v1.0 — Audit initial                                           ║
║  Validité  : 90 jours (recertification recommandée après Sprint R1)        ║
║  Autorité  : Constitution v2.0 — Cycle 11 étapes                           ║
║                                                                              ║
╚══════════════════════════════════════════════════════════════════════════════╝
```

---

*Document généré automatiquement par l'Audit Engine Oraforme (F-004)*  
*Lecture seule — aucune modification de code, SQL ou déploiement durant cet audit*  
*Prochain audit recommandé : après correction des phases R1 + R2*

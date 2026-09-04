# F-007 — ORAFORME FOUNDATION ARCHITECTURE v1
## Constitution Technique de l'ERP

---

**Date :** 2026-07-02  
**Statut :** ARCHITECTURE OFFICIELLE — Aucun code. Aucun SQL. Aucun commit.  
**Prérequis validés :** F-003 (tenant_modules) · F-005.1 (Fiscal Blueprint) · F-006 (Fiscal Engine Design)  
**Portée :** 16 Cores · 6 Matrices · Constitution technique complète

---

# PRÉAMBULE — LES LOIS FONDAMENTALES DE L'ARCHITECTURE

## Les 10 Lois de la Foundation

```
LOI-A  CORE OWNERSHIP
       Chaque donnée appartient à exactement un Core.
       Aucune donnée n'est partagée en écriture entre deux Cores.

LOI-B  SINGLE SOURCE OF TRUTH
       Chaque entité fondamentale (utilisateur, tenant, organisation,
       compte GL, règle fiscale…) a une et une seule source de vérité.
       Les autres Cores lisent via API — jamais via DB cross-core.

LOI-C  EVENT-DRIVEN COUPLING
       Les Cores communiquent par événements (Events), jamais par
       appels synchrones directs sur la DB de l'autre Core.
       Exception autorisée : reads via API avec SLA garanti.

LOI-D  IMMUTABILITY BY DEFAULT
       Toute donnée financière, fiscale, ou d'audit est immuable
       après écriture. La correction se fait par événement compensatoire.

LOI-E  PERMISSION GATEWAY
       Toute action modifiant des données passe par le Permission Core.
       Aucun Core ne décide seul des droits d'accès.

LOI-F  FISCAL SUPREMACY
       Le Fiscal Core a priorité sur tout autre Core en cas de conflit
       d'écriture sur journal_entries. Les autres Cores soumettent
       des FiscalEvents — ils n'écrivent pas eux-mêmes dans le GL.

LOI-G  TENANT ISOLATION
       Toute donnée porte un tenant_id. Aucune query ne traverse
       les frontières tenant sans autorisation explicite du Tenant Core.

LOI-H  VERSIONED CONTRACTS
       Tout contrat inter-Core est versionné. Breaking change = nouvelle
       version majeure avec période de coexistence ≥ 30 jours.

LOI-I  OBSERVABLE EVERYTHING
       Tout événement est loggé, tracé et observable. Aucune action
       silencieuse. L'Audit trail est inviolable.

LOI-J  GRACEFUL DEGRADATION
       Si un Core secondaire est indisponible, l'ERP continue en mode
       dégradé. Seuls Identity Core, Tenant Core et Permission Core
       sont bloquants. Tous les autres sont best-effort avec retry.
```

## Hiérarchie des Cores

```
NIVEAU 0 — FONDATION (bloquants)
  Identity Core · Tenant Core · Permission Core

NIVEAU 1 — STRUCTURE (nécessaires à l'opérationnel)
  Organization Core · Billing Core

NIVEAU 2 — OPÉRATIONNEL (cœur métier)
  Accounting Core · Fiscal Core · Payroll Core · Inventory Core · CRM Core
  Workflow Core · Notification Core

NIVEAU 3 — INTELLIGENCE (analytique + IA)
  Reporting Core · Analytics Core · AI Core

NIVEAU 4 — CONNECTIVITÉ (écosystème)
  Integration Core
```

---

# PARTIE 1 — LES 16 CORES

---

## CORE 1 — IDENTITY CORE

### Mission

```
Être l'autorité absolue sur l'identité des entités dans Oraforme.
Tout utilisateur, agent IA, service, et partenaire passe par Identity Core
pour être authentifié. Aucun autre Core ne vérifie les identités.
```

### Responsabilités

```
ID-1  Gérer le cycle de vie complet des comptes utilisateur
       (création, vérification email, suspension, suppression)
ID-2  Authentification multi-facteur (email/mot de passe, Magic Link, OAuth)
ID-3  Gestion des sessions (JWT, refresh tokens, révocation)
ID-4  Identités d'agents IA (agent_id, agent_type, scopes)
ID-5  Identités de services inter-Cores (service tokens)
ID-6  Liens entre identités (même personne, comptes fusionnés)
ID-7  Audit trail de toutes les connexions et actions d'authentification
ID-8  Détection d'anomalies de connexion (lieu inhabituel, brute force)
```

### Source de Vérité

```
TABLE MAÎTRE : users { id, email, phone, status, created_at, verified_at }
               auth_sessions { id, user_id, token_hash, expires_at, revoked }
               auth_logs { id, user_id, action, ip, device, timestamp }
```

### Autorisé à écrire

```
✅ users (toutes colonnes)
✅ auth_sessions
✅ auth_logs
✅ agent_identities
✅ service_tokens
```

### Interdit d'écrire

```
❌ tenants (→ Tenant Core)
❌ permissions (→ Permission Core)
❌ profiles métier (→ Organization Core)
❌ billing_subscriptions (→ Billing Core)
❌ Toute table financière
```

### API Publiques

```
POST   /api/auth/signup           → créer compte + envoyer vérification
POST   /api/auth/signin           → authentifier → JWT + refresh
POST   /api/auth/signout          → révoquer session
POST   /api/auth/refresh          → renouveler JWT
POST   /api/auth/magic-link       → connexion sans mot de passe
POST   /api/auth/2fa/setup        → configurer 2FA
POST   /api/auth/2fa/verify       → valider code 2FA
POST   /api/auth/password/reset   → demande reset
GET    /api/auth/session          → session courante
GET    /api/auth/me               → profil identity (pas métier)
```

### API Internes (inter-Core)

```
GET    /internal/identity/verify/{token}    → valider un JWT (Permission Core)
GET    /internal/identity/user/{id}         → récupérer identité (tous Cores)
POST   /internal/identity/service-token     → créer token service (Integration Core)
GET    /internal/identity/agent/{id}        → identité agent IA (AI Core)
POST   /internal/identity/audit-log         → logger une action (tous Cores)
```

### Events Produits

```
USER_CREATED          { user_id, email, tenant_id }
USER_VERIFIED         { user_id, verified_at }
USER_SIGNED_IN        { user_id, session_id, ip, device }
USER_SIGNED_OUT       { user_id, session_id }
USER_SUSPENDED        { user_id, reason }
SESSION_REVOKED       { session_id, user_id, reason }
SUSPICIOUS_LOGIN      { user_id, ip, reason }
AGENT_AUTHENTICATED   { agent_id, agent_type, scopes[] }
```

### Events Consommés

```
TENANT_DELETED        → suspendre tous les users du tenant
USER_OFFBOARDED       → révoquer toutes sessions (Organization Core)
BILLING_SUSPENDED     → restreindre accès (Billing Core)
```

### Dépendances

```
→ Aucune (Core de niveau 0 — aucune dépendance)
```

### Contrats

```
CONTRACT-ID-01  Tout JWT contient : { sub: user_id, tid: tenant_id,
                roles[], exp, iat }
CONTRACT-ID-02  Token validé en < 10ms (cache Redis)
CONTRACT-ID-03  Refresh token valide 30 jours, JWT valide 1 heure
CONTRACT-ID-04  Révocation propagée en < 5 secondes (blacklist)
```

### Realtime

```
Canal : identity:{user_id}
Push SUSPICIOUS_LOGIN → alerte sécurité utilisateur
Push SESSION_REVOKED → déconnexion forcée client
```

### Versioning

```
Stratégie : JWT versioned (jti claim contient version)
Breaking : nouvelle claim → nouveau endpoint /v2/auth/*
```

### Tests

```
TEST-ID-001  Signup → email vérification envoyé dans 30s
TEST-ID-002  JWT valide → Permission Core l'accepte
TEST-ID-003  JWT expiré → 401 sur tous les endpoints
TEST-ID-004  Brute force 10 tentatives → blocage + SUSPICIOUS_LOGIN
TEST-ID-005  Révocation → toutes sessions du user invalides
TEST-ID-006  agent_id authentifié → scopes vérifiables
```

### SLA

```
POST /api/auth/signin   : p99 < 300ms
GET  /api/auth/session  : p99 < 50ms (cache)
Token validation        : p99 < 10ms
Uptime                  : 99.99% (Core bloquant)
```

### Ownership

```
Domain  : Security & Identity
Criticité: NIVEAU 0 — FONDATION
```

---

## CORE 2 — TENANT CORE

### Mission

```
Être l'autorité sur les tenants (entreprises clientes d'Oraforme).
Chaque tenant est une entité légale indépendante avec ses propres
données, modules, configuration et isolation complète.
```

### Responsabilités

```
TN-1  Créer et gérer le cycle de vie d'un tenant
TN-2  Stocker la configuration tenant (pays, devise, fuseau, plan)
TN-3  Gérer les modules actifs (tenant_modules — source F-003)
TN-4  Isolation des données : toute query porte un tenant_id validé
TN-5  Quotas et limites d'utilisation par tenant
TN-6  Suspension / résiliation d'un tenant
TN-7  Onboarding flow (paramétrage initial)
TN-8  Multi-établissements (un tenant peut avoir N établissements)
```

### Source de Vérité

```
TABLE MAÎTRE : tenants { id, nom, pays, devise, statut, plan_id, created_at }
               tenant_modules { tenant_id, module, actif, activated_at }
               tenant_config  { tenant_id, cle, valeur }
               tenant_etablissements { id, tenant_id, nom, pays, adresse }
```

### Autorisé à écrire

```
✅ tenants
✅ tenant_modules
✅ tenant_config
✅ tenant_etablissements
✅ tenant_quotas
```

### Interdit d'écrire

```
❌ users (→ Identity Core)
❌ subscriptions (→ Billing Core)
❌ permissions (→ Permission Core)
❌ Données métier (factures, bulletins, GL)
```

### API Publiques

```
POST   /api/tenants                    → créer tenant (admin Oraforme)
GET    /api/tenants/{id}               → infos tenant
PATCH  /api/tenants/{id}               → modifier config
GET    /api/tenants/{id}/modules        → modules actifs
POST   /api/tenants/{id}/modules/{mod} → activer module
DELETE /api/tenants/{id}/modules/{mod} → désactiver module
GET    /api/tenants/{id}/etablissements
POST   /api/tenants/{id}/etablissements
GET    /api/tenants/{id}/quotas
```

### API Internes

```
GET    /internal/tenant/verify/{tenant_id}          → valider tenant actif
GET    /internal/tenant/module/{tenant_id}/{module}  → module actif ? (LOI-A F-003)
GET    /internal/tenant/config/{tenant_id}/{cle}     → valeur config
GET    /internal/tenant/pays/{tenant_id}             → pays principal
GET    /internal/tenant/etablissements/{tenant_id}   → liste établissements
```

### Events Produits

```
TENANT_CREATED        { tenant_id, pays, plan_id }
TENANT_SUSPENDED      { tenant_id, reason }
TENANT_DELETED        { tenant_id }
MODULE_ACTIVATED      { tenant_id, module, activated_at }
MODULE_DEACTIVATED    { tenant_id, module, reason }
ETABLISSEMENT_CREATED { tenant_id, etablissement_id, pays }
CONFIG_UPDATED        { tenant_id, cle, old_valeur, new_valeur }
```

### Events Consommés

```
BILLING_PLAN_UPGRADED  → activer modules du nouveau plan
BILLING_PLAN_DOWNGRADED→ désactiver modules hors nouveau plan
BILLING_SUSPENDED      → suspendre tenant
USER_CREATED           → associer user à tenant (via onboarding)
```

### Dépendances

```
→ Identity Core (vérifier user_id avant association)
→ Billing Core  (plan détermine modules disponibles)
```

### Contrats

```
CONTRACT-TN-01  tenant_modules est la SEULE source pour savoir si un module
                est actif. Interdiction de lire tenants.modules_actifs (F-003).
CONTRACT-TN-02  requireTenant() valide tenant actif en < 20ms
CONTRACT-TN-03  Chaque tenant est isolé : RLS sur toutes les tables métier
```

### Realtime

```
Canal : tenant:{tenant_id}
Push MODULE_ACTIVATED   → mise à jour navigation UI
Push TENANT_SUSPENDED   → écran de suspension
```

### SLA

```
GET /internal/tenant/module/ : p99 < 20ms (cache L1)
Uptime                       : 99.99%
```

### Ownership

```
Domain   : Platform & Multi-tenancy
Criticité: NIVEAU 0 — FONDATION
```

---

## CORE 3 — ORGANIZATION CORE

### Mission

```
Modéliser la structure organisationnelle interne d'un tenant :
départements, postes, hiérarchie, sites géographiques, et les
liens entre utilisateurs et positions dans l'organisation.
```

### Responsabilités

```
OR-1  Gérer les départements et sous-départements
OR-2  Gérer les postes (positions) et leur hiérarchie
OR-3  Associer des utilisateurs aux postes (employés)
OR-4  Gérer les responsables et lignes de reporting
OR-5  Gérer les sites/établissements opérationnels
OR-6  Fournir le contexte organisationnel aux autres Cores
OR-7  Onboarding et offboarding des employés
OR-8  Organigramme dynamique
```

### Source de Vérité

```
TABLE MAÎTRE : departments      { id, tenant_id, nom, parent_id }
               positions        { id, tenant_id, dept_id, titre, niveau }
               org_members      { id, tenant_id, user_id, position_id,
                                  manager_id, date_debut, date_fin }
               org_sites        { id, tenant_id, nom, pays, adresse }
```

### Autorisé à écrire

```
✅ departments
✅ positions
✅ org_members
✅ org_sites
```

### Interdit d'écrire

```
❌ users (→ Identity Core)
❌ payroll (→ Payroll Core)
❌ permissions (→ Permission Core)
❌ fiscal data
```

### API Publiques

```
GET    /api/org/departments
POST   /api/org/departments
GET    /api/org/members
POST   /api/org/members        → onboarding employé
DELETE /api/org/members/{id}   → offboarding
GET    /api/org/chart          → organigramme JSON
GET    /api/org/member/{id}/reports  → subordonnés directs
GET    /api/org/sites
```

### API Internes

```
GET    /internal/org/member/{user_id}       → position + manager (Payroll Core)
GET    /internal/org/dept/{dept_id}/members → liste membres dept (Permission Core)
GET    /internal/org/hierarchy/{user_id}    → chaîne de validation (Workflow Core)
```

### Events Produits

```
MEMBER_ONBOARDED    { user_id, position_id, dept_id, date_debut }
MEMBER_OFFBOARDED   { user_id, date_fin, reason }
DEPT_CREATED        { dept_id, parent_id }
POSITION_CHANGED    { user_id, old_position_id, new_position_id }
MANAGER_CHANGED     { user_id, old_manager_id, new_manager_id }
```

### Events Consommés

```
USER_CREATED         → attendre association org (onboarding flow)
USER_SUSPENDED       → suspendre org_member
PAYROLL_CREATED      → enrichir avec données org (département, poste)
```

### Dépendances

```
→ Identity Core (user_id valide)
→ Tenant Core   (tenant_id + établissements)
→ Permission Core (droits admin RH)
```

### SLA

```
GET /api/org/chart : p99 < 500ms
GET /internal/org/member/ : p99 < 50ms
```

### Ownership

```
Domain   : HR & Organization
Criticité: NIVEAU 1
```

---

## CORE 4 — PERMISSION CORE

### Mission

```
Être le gardien absolu de toutes les autorisations dans Oraforme.
Aucune action sensible ne s'exécute sans que le Permission Core
l'ait approuvée. RBAC + ABAC + Politiques par Core.
```

### Responsabilités

```
PM-1  Définir rôles, permissions et politiques (RBAC)
PM-2  Évaluer les accès en temps réel pour chaque requête
PM-3  Gérer les rôles prédéfinis Oraforme (admin, manager, employee, readonly…)
PM-4  Permettre des rôles personnalisés par tenant
PM-5  Appliquer les politiques RLS (Row Level Security) au niveau applicatif
PM-6  Gérer les délégations temporaires (substitution, congés)
PM-7  Audit trail de toutes les décisions d'autorisation
PM-8  Politiques par module (un user peut avoir droits Compta mais pas RH)
```

### Source de Vérité

```
TABLE MAÎTRE : roles           { id, tenant_id, code, nom, is_system }
               permissions     { id, role_id, resource, action, conditions }
               user_roles      { user_id, role_id, tenant_id, granted_at, expires_at }
               policy_decisions { id, user_id, resource, action, decision, timestamp }
```

### Autorisé à écrire

```
✅ roles
✅ permissions
✅ user_roles
✅ policy_decisions (audit trail)
```

### Interdit d'écrire

```
❌ users (→ Identity Core)
❌ org_members (→ Organization Core)
❌ Toute donnée métier
```

### API Publiques

```
GET    /api/permissions/roles
POST   /api/permissions/roles
POST   /api/permissions/roles/{id}/assign/{user_id}
DELETE /api/permissions/roles/{id}/revoke/{user_id}
GET    /api/permissions/my-permissions   → droits de l'utilisateur courant
POST   /api/permissions/check            → vérifier un droit
GET    /api/permissions/audit?user={id}  → historique décisions
```

### API Internes

```
POST   /internal/permissions/authorize
       Body: { user_id, tenant_id, resource, action, context? }
       Return: { allowed: boolean, reason: string }
       SLA: < 15ms (critique — appelé sur chaque requête)

GET    /internal/permissions/user-roles/{user_id}/{tenant_id}
GET    /internal/permissions/can-access-module/{user_id}/{module}
```

### Events Produits

```
ROLE_ASSIGNED        { user_id, role_id, tenant_id, granted_by }
ROLE_REVOKED         { user_id, role_id, reason }
ACCESS_DENIED        { user_id, resource, action, reason }
PERMISSION_ESCALATED { user_id, resource, approved_by }  ← délégation
```

### Events Consommés

```
MEMBER_ONBOARDED    → assigner rôle par défaut selon poste
MEMBER_OFFBOARDED   → révoquer tous rôles
MODULE_ACTIVATED    → activer permissions module pour admins
BILLING_PLAN_CHANGED→ recalculer permissions selon nouveau plan
```

### Dépendances

```
→ Identity Core      (vérifier user_id dans JWT)
→ Tenant Core        (vérifier modules actifs)
→ Organization Core  (rôle selon poste/département)
```

### Contrats

```
CONTRACT-PM-01  authorize() retourne en < 15ms (cache décision 5 min)
CONTRACT-PM-02  Toute décision ACCESS_DENIED est loggée (immuable)
CONTRACT-PM-03  Rôle SUPER_ADMIN limité aux comptes Oraforme (jamais tenant)
```

### Realtime

```
Canal : permissions:{user_id}
Push ROLE_REVOKED → déconnexion forcée + ré-auth
Push ROLE_ASSIGNED → mise à jour navigation UI
```

### SLA

```
POST /internal/permissions/authorize : p99 < 15ms
Uptime : 99.99% (Core bloquant)
```

### Ownership

```
Domain   : Security & Access Control
Criticité: NIVEAU 0 — FONDATION
```

---

## CORE 5 — BILLING CORE

### Mission

```
Gérer la relation commerciale entre Oraforme et ses tenants clients.
Abonnements, plans, paiements SaaS, factures Oraforme (méta-niveau —
distinct des factures des tenants dans leurs propres modules).
```

### Responsabilités

```
BL-1  Gérer les plans Oraforme (Starter, Pro, Enterprise…)
BL-2  Gérer les abonnements tenant (actif, suspendu, résilié)
BL-3  Facturation mensuelle automatique
BL-4  Gestion des moyens de paiement (carte, virement, mobile money)
BL-5  Calcul prorata, upgrades/downgrades
BL-6  Gestion des essais gratuits et codes promo
BL-7  Émission des factures Oraforme vers les tenants
BL-8  Gestion des impayés et suspension automatique
BL-9  Reporting revenus (MRR, ARR, churn)
```

### Source de Vérité

```
TABLE MAÎTRE : plans              { id, code, nom, prix, modules_inclus[] }
               subscriptions      { id, tenant_id, plan_id, statut,
                                   debut, fin, trial_end }
               invoices_oraforme  { id, tenant_id, montant, statut,
                                   periode, emis_le, paye_le }
               payment_methods    { id, tenant_id, type, ref_externe }
               billing_events     { id, tenant_id, type, montant, timestamp }
```

### Autorisé à écrire

```
✅ plans
✅ subscriptions
✅ invoices_oraforme
✅ payment_methods
✅ billing_events
```

### Interdit d'écrire

```
❌ tenant_modules (→ Tenant Core — Billing émet event, Tenant Core agit)
❌ factures métier tenant (→ tables métier des tenants)
❌ journal_entries (→ Fiscal Core / Accounting Core)
```

### API Publiques

```
GET    /api/billing/plans
GET    /api/billing/subscription
POST   /api/billing/subscription/upgrade
POST   /api/billing/subscription/cancel
GET    /api/billing/invoices
GET    /api/billing/invoices/{id}/pdf
POST   /api/billing/payment-methods
GET    /api/billing/usage
GET    /api/billing/mrr           → analytics revenus (admin Oraforme)
```

### Events Produits

```
SUBSCRIPTION_CREATED    { tenant_id, plan_id, trial_end }
SUBSCRIPTION_UPGRADED   { tenant_id, old_plan, new_plan }
SUBSCRIPTION_DOWNGRADED { tenant_id, old_plan, new_plan }
SUBSCRIPTION_CANCELLED  { tenant_id, effective_date }
BILLING_SUSPENDED       { tenant_id, reason: 'impaye'|'fraud' }
PAYMENT_RECEIVED        { tenant_id, amount, invoice_id }
PAYMENT_FAILED          { tenant_id, invoice_id, attempt }
TRIAL_ENDING            { tenant_id, days_remaining: 7|3|1 }
```

### Events Consommés

```
TENANT_CREATED         → créer subscription trial
USER_SIGNED_IN         → vérifier subscription active
```

### Dépendances

```
→ Identity Core (user_id)
→ Tenant Core   (tenant_id)
→ Permission Core (seuls admins gèrent billing)
```

### SLA

```
GET /api/billing/subscription : p99 < 200ms
Facturation auto              : ≤ 24h de retard toléré
```

### Ownership

```
Domain   : Revenue & Finance SaaS
Criticité: NIVEAU 1
```

---

## CORE 6 — WORKFLOW CORE

### Mission

```
Orchestrer les processus métier multi-étapes nécessitant des validations,
des approbations, et des transitions d'état. Chaque module métier
soumet ses workflows au Workflow Core — il ne les gère pas lui-même.
```

### Responsabilités

```
WF-1  Définir des templates de workflow (approbation devis, validation paie…)
WF-2  Instancier et suivre l'avancement d'un workflow
WF-3  Gérer les étapes séquentielles et parallèles
WF-4  Router les tâches aux bons approbateurs (via Organization Core)
WF-5  Gestion des délais et escalades automatiques
WF-6  Délégation de tâche (congés, substitution)
WF-7  Journal d'audit complet du workflow
WF-8  Déclenchement d'events en sortie de workflow
```

### Source de Vérité

```
TABLE MAÎTRE : workflow_templates { id, tenant_id, module, code, étapes[] }
               workflow_instances { id, template_id, source_id, statut,
                                   started_at, completed_at }
               workflow_steps     { id, instance_id, étape, assignee_id,
                                   action, commentaire, completed_at }
               workflow_history   { id, instance_id, event, user_id, timestamp }
```

### Autorisé à écrire

```
✅ workflow_templates
✅ workflow_instances
✅ workflow_steps
✅ workflow_history
```

### Interdit d'écrire

```
❌ Données source du workflow (la facture, le bulletin, le bon de commande…)
❌ journal_entries
❌ permissions
```

### API Publiques

```
GET    /api/workflows/templates
POST   /api/workflows/templates
POST   /api/workflows/start       → démarrer un workflow sur un objet
GET    /api/workflows/{id}        → état courant
POST   /api/workflows/{id}/approve
POST   /api/workflows/{id}/reject
POST   /api/workflows/{id}/delegate
GET    /api/workflows/my-tasks    → tâches en attente pour moi
GET    /api/workflows/{id}/history
```

### Events Produits

```
WORKFLOW_STARTED      { instance_id, template, source_id }
WORKFLOW_STEP_DONE    { instance_id, étape, user_id, action }
WORKFLOW_APPROVED     { instance_id, source_id, source_type }
WORKFLOW_REJECTED     { instance_id, source_id, reason }
WORKFLOW_ESCALATED    { instance_id, reason, escalated_to }
WORKFLOW_COMPLETED    { instance_id, source_id, outcome }
```

### Events Consommés

```
FACTURE_CREATED       → démarrer workflow validation si configuré
BULLETIN_GENERATED    → démarrer workflow approbation paie
ACHAT_REQUESTED       → démarrer workflow approbation achat
MEMBER_OFFBOARDED     → annuler tâches assignées + réassigner
```

### Dépendances

```
→ Identity Core      (authentification approbateur)
→ Organization Core  (hiérarchie pour routage tâches)
→ Permission Core    (peut-il approuver ?)
→ Notification Core  (alerter l'approbateur)
```

### SLA

```
Notification tâche pending  : < 30 secondes
GET /api/workflows/my-tasks : p99 < 300ms
```

### Ownership

```
Domain   : Business Process Management
Criticité: NIVEAU 2
```

---

## CORE 7 — NOTIFICATION CORE

### Mission

```
Être le canal unique d'envoi de toutes les notifications Oraforme.
Aucun autre Core n'envoie directement des emails, SMS ou push.
Ils émettent des NotificationRequests — Notification Core les traite.
```

### Responsabilités

```
NT-1  Recevoir les NotificationRequest de tous les Cores
NT-2  Router vers le bon canal (email, SMS, push, in-app, WhatsApp)
NT-3  Gérer les préférences de notification par utilisateur
NT-4  Garantir la livraison (retry, dead-letter queue)
NT-5  Templates multilingues (FR, EN, LN, KG, SW, PT)
NT-6  Regroupement intelligent (digest quotidien vs temps réel)
NT-7  Suppression et blocklists (RGPD)
NT-8  Analytics de notification (taux ouverture, clic)
```

### Source de Vérité

```
TABLE MAÎTRE : notification_queue    { id, user_id, channel, template,
                                       payload, statut, scheduled_at }
               notification_logs     { id, notif_id, canal, statut,
                                       sent_at, delivered_at, opened_at }
               notification_prefs    { user_id, tenant_id, canal, type, actif }
               notification_templates{ id, code, langue, canal, subject, body }
```

### Autorisé à écrire

```
✅ notification_queue
✅ notification_logs
✅ notification_prefs
✅ notification_templates
```

### Interdit d'écrire

```
❌ Tout le reste
```

### API Internes (les autres Cores ne notifient que via cette API)

```
POST   /internal/notify
       Body: { user_id, type, canal?, template, payload, priorité? }
       → Oraforme-interne uniquement

POST   /internal/notify/bulk
       Body: { user_ids[], type, template, payload }

GET    /internal/notify/preferences/{user_id}
```

### Events Produits

```
NOTIFICATION_SENT       { notif_id, user_id, canal, template }
NOTIFICATION_FAILED     { notif_id, user_id, canal, error, attempts }
NOTIFICATION_OPENED     { notif_id, user_id, opened_at }
```

### Events Consommés

```
Tous les events de tous les Cores peuvent déclencher une notification.
Mapping configuré dans notification_templates.
```

### Dépendances

```
→ Identity Core      (user_id, email, phone)
→ Tenant Core        (langue, config)
→ Permission Core    (droits admin templates)
```

### SLA

```
Notification temps réel : envoyée < 30s
Email transactionnel    : envoyé < 60s
SMS                     : envoyé < 120s
```

### Ownership

```
Domain   : Communications
Criticité: NIVEAU 2
```

---

## CORE 8 — ACCOUNTING CORE

### Mission

```
Être l'autorité sur la comptabilité générale SYSCOHADA.
Gérer le Grand Livre global, le bilan, le compte de résultat, le TAFIRE,
les états financiers OHADA. Consomme les écritures du Fiscal Core
et de tous les autres Cores opérationnels.
```

### Responsabilités

```
AC-1  Maintenir le Grand Livre (journal_entries) en tant que vue globale
AC-2  Gérer le plan de comptes SYSCOHADA par tenant
AC-3  Générer les états financiers (Bilan, CR, TAFIRE, Notes)
AC-4  Clôture d'exercice (lettrage, extournes, reports à nouveau)
AC-5  Rapprochements bancaires
AC-6  Gestion des exercices comptables
AC-7  Validation de l'équilibre comptable (Σdébits = Σcrédits)
AC-8  Gestion des journaux comptables (VTE, ACH, BQ, OD, PAI…)
AC-9  Export des exports légaux (FEC, dossier révision)
```

### Source de Vérité

```
TABLE MAÎTRE : journal_entries  { id, tenant_id, journal, debit, credit,
                                  montant, libelle, date, periode,
                                  source, source_id, immutable }
               plan_comptes     { id, tenant_id, compte, libelle, classe,
                                  type: 'bilan'|'resultat' }
               exercices        { id, tenant_id, annee, statut, cloture_at }
               rapprochements   { id, tenant_id, compte_banque, periode,
                                  solde_releve, solde_gl, ecart }
```

### Autorisé à écrire

```
✅ journal_entries (pour écritures non-fiscales : OD, clôture, rappro)
✅ plan_comptes
✅ exercices
✅ rapprochements
```

### Interdit d'écrire

```
❌ Écritures fiscales dans journal_entries (→ Fiscal Core EXCLUSIVEMENT)
❌ bulletins_paie (→ Payroll Core)
❌ factures (→ CRM Core ou module Facturation)
❌ stocks (→ Inventory Core)
```

### API Publiques

```
GET    /api/accounting/grand-livre?compte={}&periode={}
GET    /api/accounting/balance-comptes?periode={}
GET    /api/accounting/bilan?annee={}
GET    /api/accounting/compte-resultat?annee={}
GET    /api/accounting/tafire?annee={}
POST   /api/accounting/entries            → OD manuelle (non-fiscale)
POST   /api/accounting/rapprochement/start
GET    /api/accounting/exercices
POST   /api/accounting/exercices/{id}/close
GET    /api/accounting/export/fec?annee={}
```

### API Internes

```
POST   /internal/accounting/post-entry
       Body: { journal, debit, credit, montant, libelle, source, source_id }
       Appelé par : Fiscal Core, Payroll Core, Inventory Core, etc.

GET    /internal/accounting/solde/{compte}/{periode}
GET    /internal/accounting/exercice-actif/{tenant_id}
POST   /internal/accounting/close-periode
```

### Events Produits

```
ENTRY_POSTED          { entry_id, journal, debit, credit, montant, source }
EXERCICE_CLOSED       { tenant_id, annee, solde_final }
BILAN_GENERATED       { tenant_id, annee, actif_total, passif_total }
BALANCE_UNEQUAL       { tenant_id, ecart, source_entry_id }  ← alerte critique
RAPPROCHEMENT_DONE    { tenant_id, compte, periode, ecart }
```

### Events Consommés

```
JOURNAL_WRITTEN (Fiscal Core)     → intégrer écritures fiscales
PAYROLL_PAID (Payroll Core)       → intégrer écritures salaires
INVOICE_ISSUED (CRM/Facturation)  → intégrer écritures ventes
PURCHASE_RECORDED (Achats)        → intégrer écritures achats
STOCK_ADJUSTED (Inventory Core)   → intégrer variations stocks
YEAR_CLOSED (Fiscal Core)         → déclencher clôture comptable
```

### Contrats

```
CONTRACT-AC-01  Toute écriture fiscale vient EXCLUSIVEMENT du Fiscal Core
                (source='fiscal_engine' dans journal_entries)
CONTRACT-AC-02  Σ débits = Σ crédits après chaque batch (vérification immédiate)
CONTRACT-AC-03  Exercice clos → aucune nouvelle écriture sur la période
CONTRACT-AC-04  Plan de comptes SYSCOHADA est la référence (pas de comptes hors classe 1-9)
```

### Realtime

```
Canal : accounting:{tenant_id}
Push ENTRY_POSTED     → mise à jour Grand Livre UI
Push BALANCE_UNEQUAL  → alerte critique comptable
Push EXERCICE_CLOSED  → statut clôture mis à jour
```

### SLA

```
GET /api/accounting/grand-livre : p99 < 800ms (query GL)
POST /internal/accounting/post-entry : p99 < 200ms
Bilan generation : < 5s
```

### Ownership

```
Domain   : Finance & Comptabilité OHADA
Criticité: NIVEAU 2
```

---

## CORE 9 — FISCAL CORE (Référence — F-006)

### Mission

```
Être l'autorité absolue sur tous les calculs fiscaux et leur
journalisation dans le Grand Livre. Référence complète : F-006.
```

### Résumé (détail dans F-006)

```
8 Engines : Rules · Calculation · Validation · Journal · Declaration
            Payment · Audit · Explanation

Source de Vérité : journal_entries (source='fiscal_engine')

Autorisé à écrire : journal_entries (entrées fiscales UNIQUEMENT)

Interdit d'écrire : tables métier (factures, bulletins_paie, stocks…)

Events Produits : JOURNAL_WRITTEN · DECLARATION_FILED · TAX_PAID
                  AUDIT_COMPLETED · RULE_ACTIVATED · FCI_CERTIFICATION

Events Consommés : INVOICE_ISSUED · SALARY_PAID · PURCHASE_RECORDED
                   YEAR_CLOSED · QUARTER_CLOSED · TICKET_CLOSED …

FCI cible : 85/100 post FM-4

Dépendances : Identity Core · Tenant Core · Permission Core · Accounting Core

Certification : F-006 VALIDÉ
```

---

## CORE 10 — PAYROLL CORE

### Mission

```
Être l'autorité sur la paie des employés. Calculer les bulletins,
gérer les éléments de rémunération, et émettre les FiscalEvents
pour CNSS et IRPP. lib/paie/calcul-paie.ts reste INTOUCHABLE.
```

### Responsabilités

```
PY-1  Gérer les éléments de rémunération (salaire de base, primes, avantages)
PY-2  Orchestrer le calcul de paie (via calcul-paie.ts — INTOUCHABLE)
PY-3  Générer les bulletins de paie
PY-4  Valider et approuver les bulletins (via Workflow Core)
PY-5  Émettre SALARY_PAID → Fiscal Core (jamais calculer les impôts)
PY-6  Gérer les acomptes et régularisations
PY-7  États de paie périodiques (masse salariale, ratios)
PY-8  Gestion des congés et absences (impact paie)
PY-9  Charges patronales globales (hors fiscalité — synthèse)
```

### Source de Vérité

```
TABLE MAÎTRE : bulletins_paie   { id, tenant_id, employe_id, periode,
                                  brut, cnss_salarie, cnss_patronal,
                                  irpp, net, statut, generated_at, paid_at }
               remuneration_items{ id, employe_id, type, montant,
                                   debut, fin, peridicite }
               conges            { id, employe_id, type, debut, fin,
                                   jours, statut }
               paie_config       { tenant_id, pays, smig, date_paie, ... }
```

### Autorisé à écrire

```
✅ bulletins_paie
✅ remuneration_items
✅ conges
✅ paie_config
```

### Interdit d'écrire

```
❌ journal_entries (→ Fiscal Core via SALARY_PAID)
❌ org_members (→ Organization Core)
❌ declarations_cnss (→ Fiscal Core)
❌ Calculer CNSS/IRPP (→ calcul-paie.ts fait le calcul, Fiscal Core journalise)
```

### API Publiques

```
GET    /api/payroll/bulletins?periode={}
POST   /api/payroll/bulletins/generate   → calculer paie du mois
POST   /api/payroll/bulletins/{id}/approve
POST   /api/payroll/bulletins/{id}/pay   → déclenche SALARY_PAID
GET    /api/payroll/bulletins/{id}/pdf
GET    /api/payroll/masse-salariale?annee={}
GET    /api/payroll/employes/{id}/remuneration
POST   /api/payroll/conges
GET    /api/payroll/config
```

### Events Produits

```
BULLETIN_GENERATED   { bulletin_id, employe_id, periode, brut }
BULLETIN_APPROVED    { bulletin_id, approved_by }
SALARY_PAID          { bulletin_id, tenant_id, employe_id, pays,
                       salaire_brut, cnss_salarie, cnss_patronal,
                       irpp, net, periode }
                     ← Consommé par Fiscal Core
PAYROLL_BATCH_DONE   { tenant_id, periode, nb_bulletins, masse_salariale }
CONGE_APPROVED       { employe_id, type, debut, fin }
```

### Events Consommés

```
MEMBER_ONBOARDED    → créer profil rémunération
MEMBER_OFFBOARDED   → clôturer paie (solde tout compte)
WORKFLOW_APPROVED   → bulletin approuvé → déclencher paiement
CONGE_REQUESTED     → démarrer workflow approbation congés
```

### Dépendances

```
→ Identity Core       (user_id employé)
→ Organization Core   (position, département)
→ Fiscal Core         (FiscalRulesEngine pour SMIG validation)
→ Workflow Core       (approbation bulletin)
→ Notification Core   (alerter employé : bulletin disponible)
→ Accounting Core     (via Fiscal Core — pas direct)
```

### Contrats

```
CONTRACT-PY-01  calcul-paie.ts est INTOUCHABLE — Payroll Core l'appelle, ne le modifie pas
CONTRACT-PY-02  SALARY_PAID contient LES MONTANTS CALCULÉS — Fiscal Core ne recalcule pas
CONTRACT-PY-03  Bulletin approuvé requis avant SALARY_PAID
CONTRACT-PY-04  Un bulletin par employe par période (unicité)
```

### Realtime

```
Canal : payroll:{tenant_id}
Push BULLETIN_GENERATED → notification employé
Push SALARY_PAID        → mise à jour dashboard paie
```

### SLA

```
POST /api/payroll/bulletins/generate (batch 100 bulletins) : < 30s
GET /api/payroll/bulletins/{id}/pdf : p99 < 3s
```

### Ownership

```
Domain   : Human Resources & Payroll
Criticité: NIVEAU 2
```

---

## CORE 11 — INVENTORY CORE

### Mission

```
Être l'autorité sur les stocks physiques et leur valorisation.
Gérer les articles, les mouvements de stock, les emplacements
et émettre les events fiscaux pour les sorties imposables.
```

### Responsabilités

```
IN-1  Gérer le catalogue d'articles (produits, matières, consommables)
IN-2  Gérer les entrepôts et emplacements
IN-3  Enregistrer tous les mouvements (entrée, sortie, transfert, inventaire)
IN-4  Valorisation FIFO / CMUP selon configuration
IN-5  Alertes seuils de stock (minimum, maximum)
IN-6  Gestion des lots et dates de péremption
IN-7  Inventaire physique et régularisation
IN-8  Émettre STOCK_ADJUSTED → Fiscal Core si mouvement taxable
IN-9  Lien avec achats (réception) et ventes (livraison)
```

### Source de Vérité

```
TABLE MAÎTRE : articles         { id, tenant_id, code, nom, unite,
                                  categorie, tva_applicable }
               entrepots        { id, tenant_id, nom, adresse }
               stock_movements  { id, tenant_id, article_id, entrepot_id,
                                  type_mvt, quantite, valeur_unitaire,
                                  date, source, source_id }
               stock_current    { article_id, entrepot_id, quantite, valeur_cmup }
               lots             { id, article_id, num_lot, date_fab, date_peremption }
```

### Autorisé à écrire

```
✅ articles
✅ entrepots
✅ stock_movements
✅ stock_current
✅ lots
```

### Interdit d'écrire

```
❌ journal_entries (→ Accounting Core via Fiscal Core pour mouvements taxables)
❌ factures (→ CRM Core / Facturation)
❌ bulletins_paie
```

### API Publiques

```
GET    /api/inventory/articles
POST   /api/inventory/articles
GET    /api/inventory/articles/{id}/stock
GET    /api/inventory/movements?article={}&periode={}
POST   /api/inventory/movements/receive       → entrée stock (réception achat)
POST   /api/inventory/movements/issue         → sortie stock (livraison)
POST   /api/inventory/movements/transfer      → transfert entre entrepôts
POST   /api/inventory/inventaire/start
POST   /api/inventory/inventaire/{id}/adjust  → régularisation
GET    /api/inventory/alerts                  → stocks sous seuil
GET    /api/inventory/valorisation?annee={}   → valeur globale du stock
```

### Events Produits

```
STOCK_RECEIVED       { article_id, quantite, valeur, fournisseur_id, achat_id }
STOCK_ISSUED         { article_id, quantite, valeur, destination, source_id }
STOCK_ADJUSTED       { article_id, quantite_avant, quantite_apres, raison }
STOCK_ALERT          { article_id, stock_actuel, seuil_min }
STOCK_EXPIRED        { lot_id, article_id, date_peremption }
INVENTAIRE_COMPLETED { tenant_id, ecarts[], valeur_totale }
```

### Events Consommés

```
INVOICE_ISSUED        → déclencher sortie stock si articles livrés
PURCHASE_RECEIVED     → déclencher entrée stock
RESTAURANT_TICKET_CLOSED → déduire consommations stock
```

### Dépendances

```
→ Tenant Core       (tenant_id, pays)
→ Fiscal Core       (émettre STOCK_ADJUSTED si usage propre taxable)
→ Accounting Core   (valorisation stock → bilan classe 3)
```

### SLA

```
GET /api/inventory/articles/{id}/stock : p99 < 100ms (cache)
POST /api/inventory/movements : p99 < 300ms
```

### Ownership

```
Domain   : Supply Chain & Inventory
Criticité: NIVEAU 2
```

---

## CORE 12 — CRM CORE

### Mission

```
Être l'autorité sur la relation client : contacts, entreprises clientes,
opportunités commerciales, devis, commandes, et facturation client.
Émettre les events d'actes commerciaux vers le Fiscal Core.
```

### Responsabilités

```
CR-1  Gérer les contacts et entreprises clientes
CR-2  Pipeline commercial (leads, opportunités, devis, commandes)
CR-3  Facturation client (devis → bon de commande → facture → avoir)
CR-4  Suivi des paiements clients et relances
CR-5  Émettre INVOICE_ISSUED → Fiscal Core pour TVA
CR-6  Émettre PAYMENT_RECEIVED → Fiscal Core (TVA sur encaissement)
CR-7  Gestion des contrats et récurrences
CR-8  Historique complet interaction client (timeline)
CR-9  Segments et tags clients
```

### Source de Vérité

```
TABLE MAÎTRE : contacts         { id, tenant_id, nom, email, telephone, tags[] }
               companies        { id, tenant_id, nom, secteur, pays, tva_num }
               opportunities    { id, tenant_id, company_id, statut, valeur }
               devis            { id, tenant_id, company_id, statut, montant_ht }
               factures         { id, tenant_id, company_id, statut,
                                  montant_ht, tva, ttc, date_emission, echéance }
               paiements_clients{ id, facture_id, montant, date, moyen }
               avoirs           { id, facture_id, montant_ht, motif }
```

### Autorisé à écrire

```
✅ contacts, companies
✅ opportunities, devis
✅ factures, avoirs
✅ paiements_clients
```

### Interdit d'écrire

```
❌ journal_entries (→ Fiscal Core via events)
❌ stock_movements (→ Inventory Core reçoit INVOICE_ISSUED)
❌ Calculer la TVA (→ Fiscal Core calcule, CRM Core présente le résultat)
```

### API Publiques

```
GET    /api/crm/contacts
POST   /api/crm/contacts
GET    /api/crm/pipeline
GET    /api/crm/devis
POST   /api/crm/devis
POST   /api/crm/devis/{id}/accept
GET    /api/crm/factures
POST   /api/crm/factures
POST   /api/crm/factures/{id}/emit     → déclenche INVOICE_ISSUED
POST   /api/crm/factures/{id}/cancel   → déclenche INVOICE_CANCELLED
POST   /api/crm/paiements              → déclenche PAYMENT_RECEIVED
GET    /api/crm/factures/{id}/pdf
GET    /api/crm/relances               → factures en retard
```

### Events Produits

```
INVOICE_ISSUED       { facture_id, tenant_id, montant_ht, pays, nature,
                       client_id, date_emission }  ← consommé par Fiscal Core
INVOICE_CANCELLED    { facture_id, avoir_id, montant_ht, motif }
PAYMENT_RECEIVED     { facture_id, montant, date }
DEVIS_ACCEPTED       { devis_id, company_id, montant }
OPPORTUNITY_WON      { opportunity_id, company_id, valeur }
RELANCE_SENT         { facture_id, client_id, montant_du, jours_retard }
```

### Events Consommés

```
WORKFLOW_APPROVED    → devis ou facture approuvé → changer statut
FISCAL_AUDIT_ALERT   → informer si anomalie TVA détectée
STOCK_ALERT          → informer commercial si article commandé en rupture
```

### Dépendances

```
→ Identity Core     (user_id commercial)
→ Organization Core (commercial → département ventes)
→ Fiscal Core       (preview TVA avant émission facture)
→ Inventory Core    (disponibilité articles)
→ Workflow Core     (approbation devis > seuil)
→ Notification Core (relances, confirmations)
```

### SLA

```
POST /api/crm/factures/{id}/emit : p99 < 500ms (inclut INVOICE_ISSUED vers Fiscal)
GET /api/crm/pipeline : p99 < 300ms
```

### Ownership

```
Domain   : Sales & Customer Relations
Criticité: NIVEAU 2
```

---

## CORE 13 — REPORTING CORE

### Mission

```
Générer les rapports financiers, comptables et de gestion officiels.
Lire depuis Accounting Core, Fiscal Core et tous les Cores opérationnels
pour produire des états consolidés. Jamais écrire.
```

### Responsabilités

```
RP-1  États financiers OHADA (Bilan, CR, TAFIRE, Notes)
RP-2  Tableaux de bord de gestion (P&L, cash flow, working capital)
RP-3  Rapports fiscaux (récapitulatifs TVA, IS, CNSS annuels)
RP-4  Rapports RH (masse salariale, effectifs, congés)
RP-5  Rapports commerciaux (CA, pipeline, top clients)
RP-6  Rapports de stocks (valorisation, mouvements, ruptures)
RP-7  Génération PDF/Excel des rapports officiels
RP-8  Programmation de rapports récurrents
RP-9  Rapports multi-établissements (consolidation)
```

### Source de Vérité

```
LECTURE UNIQUEMENT depuis :
  journal_entries (via Accounting Core)
  declarations_* (via Fiscal Core)
  bulletins_paie (via Payroll Core)
  stock_current (via Inventory Core)
  factures, opportunités (via CRM Core)
  org_members (via Organization Core)

TABLE PROPRE : report_schedules { id, tenant_id, type, fréquence, derniere_gen }
               report_cache     { id, tenant_id, type, periode, data, generated_at }
```

### Autorisé à écrire

```
✅ report_schedules
✅ report_cache
```

### Interdit d'écrire

```
❌ TOUT le reste — Reporting Core est READ-ONLY sur les données opérationnelles
```

### API Publiques

```
GET    /api/reports/bilan?annee={}
GET    /api/reports/compte-resultat?annee={}
GET    /api/reports/tafire?annee={}
GET    /api/reports/pl?periode={}        → P&L mensuel
GET    /api/reports/cashflow?annee={}
GET    /api/reports/fiscal/tva?annee={}  → récap TVA annuel
GET    /api/reports/fiscal/is?annee={}
GET    /api/reports/hr/masse-salariale?annee={}
GET    /api/reports/commercial/ca?periode={}
GET    /api/reports/inventory/valorisation?date={}
POST   /api/reports/schedule             → programmer rapport récurrent
GET    /api/reports/{id}/pdf
GET    /api/reports/{id}/excel
```

### Events Produits

```
REPORT_GENERATED    { type, periode, tenant_id, report_id }
REPORT_SCHEDULED    { type, fréquence, next_run }
```

### Events Consommés

```
EXERCICE_CLOSED    → générer états financiers annuels automatiquement
BILLING_CYCLE_END  → générer rapport mensuel gestion
```

### Dépendances

```
→ Accounting Core (données GL)
→ Fiscal Core     (déclarations, FCI)
→ Payroll Core    (masse salariale)
→ Inventory Core  (valorisation)
→ CRM Core        (CA, pipeline)
→ Organization Core (effectifs)
```

### SLA

```
GET /api/reports/bilan : p99 < 3s (cache possible)
Génération PDF         : < 10s
```

### Ownership

```
Domain   : Finance & Business Intelligence
Criticité: NIVEAU 3
```

---

## CORE 14 — ANALYTICS CORE

### Mission

```
Fournir les KPIs temps réel, tableaux de bord dynamiques, et analyses
prédictives. Se nourrit de tous les Cores opérationnels pour produire
des insights actionnables. Jamais écrire dans les données sources.
```

### Responsabilités

```
AN-1  KPIs temps réel (CA du jour, TVA du mois, paie du mois…)
AN-2  Tableaux de bord configurables par rôle
AN-3  Alertes intelligentes basées sur seuils et tendances
AN-4  Analyses comparatives (N vs N-1, budget vs réel)
AN-5  Forecasting simple (extrapolation tendances)
AN-6  Segmentation et cohortes (clients, produits, périodes)
AN-7  Heat maps et visualisations géographiques (multi-pays)
AN-8  Export données brutes pour outils BI tiers (Power BI, Tableau)
```

### Source de Vérité

```
TABLE PROPRE : kpi_snapshots    { id, tenant_id, kpi_code, valeur,
                                  timestamp, periode }
               dashboard_configs{ id, tenant_id, user_id, widgets[] }
               alert_rules      { id, tenant_id, kpi, condition, seuil,
                                  canal_notif }
               analytics_cache  { id, tenant_id, query_hash, result, ttl }
```

### Autorisé à écrire

```
✅ kpi_snapshots
✅ dashboard_configs
✅ alert_rules
✅ analytics_cache
```

### Interdit d'écrire

```
❌ TOUT le reste (Analytics Core est read-only sur les données opérationnelles)
```

### API Publiques

```
GET    /api/analytics/kpis?codes[]=CA_MOIS,TVA_MOIS,MASSE_SAL
GET    /api/analytics/dashboard         → dashboard configuré
POST   /api/analytics/dashboard/config  → personnaliser widgets
GET    /api/analytics/trend/{kpi}?periode={}
GET    /api/analytics/compare?kpi={}&periods[]=2025-06,2026-06
GET    /api/analytics/forecast/{kpi}?horizon=3months
GET    /api/analytics/alerts            → alertes actives
POST   /api/analytics/alerts            → configurer nouvelle alerte
GET    /api/analytics/export?format=csv → export BI
```

### Events Produits

```
KPI_THRESHOLD_REACHED  { kpi, valeur, seuil, tenant_id }
ANOMALY_DETECTED       { kpi, valeur_attendue, valeur_actuelle, ecart }
FORECAST_UPDATED       { kpi, horizon, values[] }
```

### Events Consommés

```
JOURNAL_WRITTEN        → recalculer KPIs comptables
INVOICE_ISSUED         → mettre à jour CA du jour
SALARY_PAID            → mettre à jour masse salariale du mois
STOCK_ISSUED           → mettre à jour rotation stocks
TAX_PAID               → mettre à jour position fiscale
```

### Dépendances

```
→ Tous les Cores opérationnels (NIVEAU 2)
→ Reporting Core (états financiers calculés)
→ Notification Core (envoyer alertes KPI)
```

### SLA

```
GET /api/analytics/kpis : p99 < 200ms (cache 5min)
KPI refresh             : toutes les 60s en mode realtime
```

### Ownership

```
Domain   : Business Intelligence & Analytics
Criticité: NIVEAU 3
```

---

## CORE 15 — AI CORE

### Mission

```
Être la couche d'intelligence artificielle d'Oraforme : MIAA (assistant
comptable-fiscal), prédictions, classification automatique, NLP multilingue
CEMAC. Consulte les autres Cores — ne modifie jamais les données opérationnelles.
```

### Responsabilités

```
AI-1  MIAA : assistant conversationnel fiscal et comptable (FR/EN/LN/KG/SW)
AI-2  Classification automatique des écritures comptables
AI-3  Détection d'anomalies (fraude, doublons, incohérences)
AI-4  Suggestions intelligentes (compte GL, catégorie, taux TVA)
AI-5  OCR et extraction de données (factures scannées, relevés bancaires)
AI-6  Prédictions (trésorerie à 30/60/90j, IS estimé)
AI-7  Génération de textes réglementaires (explications fiscales)
AI-8  Gestion des agents IA (identités via Identity Core)
```

### Source de Vérité

```
TABLE PROPRE : ai_conversations  { id, user_id, session_id, messages[] }
               ai_suggestions    { id, source_event_id, type, suggestion,
                                   confiance, accepted }
               ai_models         { id, code, version, deployed_at }
               ai_anomalies      { id, tenant_id, type, description,
                                   detected_at, resolved }
```

### Autorisé à écrire

```
✅ ai_conversations
✅ ai_suggestions
✅ ai_anomalies
```

### Interdit d'écrire

```
❌ journal_entries (→ JAMAIS — AI Core ne peut pas écrire en GL)
❌ bulletins_paie
❌ factures
❌ FiscalRule (→ Admin humain uniquement)
❌ Toute donnée opérationnelle
```

### API Publiques

```
POST   /api/ai/chat              → conversation MIAA
POST   /api/ai/explain/{event_id}→ explication d'une écriture
GET    /api/ai/suggestions       → suggestions en attente
POST   /api/ai/suggestions/{id}/accept
POST   /api/ai/suggestions/{id}/reject
POST   /api/ai/ocr               → extraction facture scannée
GET    /api/ai/predictions/tresorerie?horizon=30
GET    /api/ai/anomalies
```

### API Internes

```
POST   /internal/ai/classify-entry    → suggérer compte GL (Accounting Core)
POST   /internal/ai/detect-duplicate  → détecter doublon (Fiscal Core)
GET    /internal/ai/fiscal-answer     → réponse MIAA structurée (Fiscal Core)
```

### Events Produits

```
AI_SUGGESTION_MADE    { type, suggestion, confiance, source }
AI_ANOMALY_DETECTED   { tenant_id, type, details }
AI_ANSWER_GENERATED   { query_id, answer_type, langue }
OCR_COMPLETED         { doc_id, extracted_data, confiance }
```

### Events Consommés

```
JOURNAL_WRITTEN        → analyser nouvelle écriture (suggestion/anomalie)
INVOICE_ISSUED         → classifier automatiquement
DECLARATION_FILED      → analyser cohérence (suggestion audit)
BALANCE_UNEQUAL        → alerte AI + suggestion correction
```

### Dépendances

```
→ Identity Core        (authentification agents IA)
→ Fiscal Core          (FiscalExplanationEngine comme source)
→ Accounting Core      (Grand Livre pour contexte)
→ Reporting Core       (états financiers pour prédictions)
→ Analytics Core       (KPIs pour contexte)
→ Notification Core    (alertes anomalies)
```

### Contrats

```
CONTRACT-AI-01  AI Core ne modifie jamais de données opérationnelles
CONTRACT-AI-02  Toute suggestion est soumise à validation humaine
                (accept/reject) avant application éventuelle
CONTRACT-AI-03  Réponses MIAA citent toujours la source (journal_entries,
                FiscalRule, déclaration) — jamais inventées
CONTRACT-AI-04  Confiance < 70% → suggestion présentée avec avertissement
```

### Realtime

```
Canal : ai:{user_id}
Streaming MIAA réponses (Server-Sent Events)
Push AI_ANOMALY_DETECTED → alerte tableau de bord
```

### SLA

```
POST /api/ai/chat (réponse MIAA) : p95 < 3s (streaming)
POST /api/ai/ocr                 : < 15s
Anomaly detection               : < 5min après JOURNAL_WRITTEN
```

### Ownership

```
Domain   : Artificial Intelligence & Automation
Criticité: NIVEAU 3
```

---

## CORE 16 — INTEGRATION CORE

### Mission

```
Être le pont entre Oraforme et les systèmes externes.
Webhooks entrants et sortants, APIs partenaires (banques, DGI, CNSS,
opérateurs mobile money), connecteurs ERP tiers. Aucune logique métier.
```

### Responsabilités

```
IT-1  Gérer les webhooks entrants (transforme en FiscalEvents ou métier)
IT-2  Gérer les webhooks sortants (notifier systèmes externes)
IT-3  Connecteurs bancaires (relevés automatiques pour rapprochement)
IT-4  Connecteur e-déclaration DGI (dépôt déclarations automatisé)
IT-5  Connecteur CNSS (envoi fichiers nominatifs)
IT-6  Mobile Money (MTN MoMo, Airtel Money, Orange Money)
IT-7  Marketplace d'intégrations (Zapier, Make, n8n)
IT-8  Gestion des API Keys et tokens partenaires
IT-9  Retry logic, dead-letter queue, circuit breaker
```

### Source de Vérité

```
TABLE PROPRE : integrations     { id, tenant_id, partenaire, statut, config }
               api_keys         { id, tenant_id, key_hash, scopes[], created_at }
               webhook_logs     { id, tenant_id, direction, payload, statut,
                                  timestamp, attempts }
               connector_runs   { id, integration_id, type, statut,
                                  started_at, completed_at, result }
```

### Autorisé à écrire

```
✅ integrations
✅ api_keys
✅ webhook_logs
✅ connector_runs
```

### Interdit d'écrire

```
❌ TOUTES les données métier — Integration Core est un router/transformer
   Il émet des events vers les Cores appropriés — jamais écriture directe
```

### API Publiques

```
GET    /api/integrations                → intégrations disponibles
POST   /api/integrations/{code}/enable → activer une intégration
GET    /api/integrations/webhooks
POST   /api/integrations/webhooks/test
GET    /api/api-keys
POST   /api/api-keys
DELETE /api/api-keys/{id}
GET    /api/integrations/logs
```

### Events Produits

```
WEBHOOK_RECEIVED      { integration_id, payload_hash, mapped_event }
CONNECTOR_RUN_DONE    { integration_id, type, records_synced }
WEBHOOK_FAILED        { integration_id, error, attempts }
BANK_STATEMENT_SYNCED { tenant_id, compte, nb_transactions }
MOBILE_MONEY_RECEIVED { tenant_id, montant, reference, payer }
```

### Events Consommés

```
TAX_PAID               → envoyer confirmation au système DGI si connecté
DECLARATION_FILED      → pousser déclaration vers e-déclaration DGI
PAYROLL_BATCH_DONE     → envoyer fichier nominatif CNSS
INVOICE_ISSUED         → notifier partenaire si webhook configuré
```

### Dépendances

```
→ Identity Core    (API Keys + service tokens)
→ Tenant Core      (config intégrations par tenant)
→ Permission Core  (qui peut gérer les intégrations)
→ Tous Cores NIVEAU 2 (pour émettre des events vers eux)
→ Notification Core (alertes échecs intégration)
```

### SLA

```
Webhook entrant → event émis : < 2s
Webhook sortant envoyé       : < 5s
Retry stratégie              : 3 tentatives (1s, 30s, 5min)
```

### Ownership

```
Domain   : Platform & Connectivity
Criticité: NIVEAU 4
```

---

# PARTIE 2 — LES 6 MATRICES

---

## MATRICE 1 — CORE DEPENDENCY GRAPH

```
                    ┌─────────────────────────────────────────────────────────┐
                    │                   NIVEAU 0 (FONDATION)                   │
                    │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐ │
                    │  │  IDENTITY   │  │   TENANT    │  │   PERMISSION    │ │
                    │  │    CORE     │  │    CORE     │  │     CORE        │ │
                    │  └──────┬──────┘  └──────┬──────┘  └────────┬────────┘ │
                    └─────────┼────────────────┼──────────────────┼──────────┘
                              │                │                  │
                    ┌─────────▼────────────────▼──────────────────▼──────────┐
                    │                   NIVEAU 1 (STRUCTURE)                   │
                    │  ┌──────────────────┐    ┌────────────────────────────┐ │
                    │  │ ORGANIZATION     │    │      BILLING CORE          │ │
                    │  │     CORE         │    │                            │ │
                    │  └────────┬─────────┘    └─────────────┬──────────────┘ │
                    └───────────┼──────────────────────────────┼──────────────┘
                                │                              │
                    ┌───────────▼──────────────────────────────▼──────────────┐
                    │                   NIVEAU 2 (OPÉRATIONNEL)                │
                    │                                                           │
                    │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌─────────┐ │
                    │  │ACCOUNTING│◄─┤  FISCAL  │  │ PAYROLL  │  │   CRM   │ │
                    │  │   CORE   │  │   CORE   │◄─┤   CORE   │  │   CORE  │ │
                    │  └─────┬────┘  └────┬─────┘  └──────────┘  └────┬────┘ │
                    │        │            │                             │      │
                    │  ┌─────▼────┐  ┌───▼──────┐  ┌──────────────────▼────┐ │
                    │  │INVENTORY │  │WORKFLOW  │  │   NOTIFICATION CORE   │ │
                    │  │  CORE    │  │  CORE    │  │                       │ │
                    │  └──────────┘  └──────────┘  └───────────────────────┘ │
                    └───────────────────────────────────────────────────────┘
                                              │
                    ┌─────────────────────────▼───────────────────────────────┐
                    │                   NIVEAU 3 (INTELLIGENCE)                │
                    │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐ │
                    │  │  REPORTING  │  │  ANALYTICS  │  │    AI CORE      │ │
                    │  │    CORE     │  │    CORE     │  │     (MIAA)      │ │
                    │  └─────────────┘  └─────────────┘  └─────────────────┘ │
                    └─────────────────────────────────────────────────────────┘
                                              │
                    ┌─────────────────────────▼───────────────────────────────┐
                    │                   NIVEAU 4 (CONNECTIVITÉ)                │
                    │                ┌──────────────────────┐                  │
                    │                │   INTEGRATION CORE   │                  │
                    │                └──────────────────────┘                  │
                    └─────────────────────────────────────────────────────────┘

RÈGLE : Un Core ne peut dépendre que de Cores de niveau ≤ au sien.
         Un Core de NIVEAU 2 ne peut pas dépendre d'un Core de NIVEAU 3.
         Violation = Dependency Inversion.
```

---

## MATRICE 2 — CORE COMMUNICATION MATRIX

```
SOURCE →           │ IDENT│ TENA │ ORG  │ PERM │ BILL │ WF   │ NOTIF│ ACCT │ FISC │ PAIE │ INVE │ CRM  │ REPO │ ANAL │ AI   │ INTG
───────────────────┼──────┼──────┼──────┼──────┼──────┼──────┼──────┼──────┼──────┼──────┼──────┼──────┼──────┼──────┼──────┼─────
Identity Core      │  —   │  ✉   │  ✉   │  ✉   │  —   │  —   │  ✉   │  —   │  —   │  —   │  —   │  —   │  —   │  —   │  —   │  —
Tenant Core        │  📡  │  —   │  ✉   │  ✉   │  📡  │  —   │  —   │  —   │  —   │  —   │  —   │  —   │  —   │  —   │  —   │  —
Organization Core  │  🔗  │  🔗  │  —   │  ✉   │  —   │  ✉   │  ✉   │  —   │  —   │  ✉   │  —   │  —   │  —   │  —   │  —   │  —
Permission Core    │  🔗  │  🔗  │  🔗  │  —   │  —   │  —   │  —   │  —   │  —   │  —   │  —   │  —   │  —   │  —   │  —   │  —
Billing Core       │  🔗  │  🔗  │  —   │  🔗  │  —   │  —   │  ✉   │  —   │  —   │  —   │  —   │  —   │  —   │  —   │  —   │  —
Workflow Core      │  🔗  │  —   │  🔗  │  🔗  │  —   │  —   │  ✉   │  —   │  —   │  ✉   │  —   │  ✉   │  —   │  —   │  —   │  —
Notification Core  │  🔗  │  🔗  │  —   │  🔗  │  —   │  —   │  —   │  —   │  —   │  —   │  —   │  —   │  —   │  —   │  —   │  —
Accounting Core    │  —   │  🔗  │  —   │  🔗  │  —   │  —   │  —   │  —   │  ✉   │  —   │  —   │  —   │  —   │  —   │  —   │  —
Fiscal Core        │  —   │  🔗  │  —   │  🔗  │  —   │  —   │  ✉   │  ✉   │  —   │  🔗  │  —   │  —   │  —   │  —   │  ✉   │  ✉
Payroll Core       │  🔗  │  🔗  │  🔗  │  🔗  │  —   │  ✉   │  ✉   │  —   │  ✉   │  —   │  —   │  —   │  —   │  —   │  —   │  —
Inventory Core     │  —   │  🔗  │  —   │  🔗  │  —   │  —   │  ✉   │  —   │  ✉   │  —   │  —   │  ✉   │  —   │  —   │  —   │  —
CRM Core           │  🔗  │  🔗  │  🔗  │  🔗  │  —   │  ✉   │  ✉   │  —   │  ✉   │  —   │  🔗  │  —   │  —   │  —   │  —   │  —
Reporting Core     │  —   │  🔗  │  🔗  │  🔗  │  —   │  —   │  —   │  🔗  │  🔗  │  🔗  │  🔗  │  🔗  │  —   │  —   │  —   │  —
Analytics Core     │  —   │  🔗  │  —   │  🔗  │  —   │  —   │  ✉   │  🔗  │  🔗  │  🔗  │  🔗  │  🔗  │  🔗  │  —   │  —   │  —
AI Core            │  🔗  │  —   │  —   │  🔗  │  —   │  —   │  ✉   │  🔗  │  🔗  │  —   │  —   │  —   │  🔗  │  🔗  │  —   │  —
Integration Core   │  🔗  │  🔗  │  —   │  🔗  │  —   │  —   │  ✉   │  —   │  ✉   │  ✉   │  —   │  ✉   │  —   │  —   │  —   │  —

Légende :
  ✉ = Communication par Event (async, découplé)
  🔗 = Appel API interne (sync, SLA garanti)
  —  = Aucune communication directe
```

---

## MATRICE 3 — CORE OWNERSHIP MATRIX

```
ENTITÉ / TABLE                 │ CORE OWNER         │ LECTEURS AUTORISÉS
───────────────────────────────┼────────────────────┼────────────────────────────
users                          │ Identity Core      │ Tous via /internal/identity
auth_sessions                  │ Identity Core      │ Identity Core uniquement
tenants                        │ Tenant Core        │ Tous via /internal/tenant
tenant_modules                 │ Tenant Core        │ Tous via /internal/tenant/module
permissions / roles            │ Permission Core    │ Permission Core uniquement
departments / positions        │ Organization Core  │ Payroll, Workflow, Reporting
org_members                    │ Organization Core  │ Payroll, Permission, Reporting
subscriptions (SaaS)           │ Billing Core       │ Tenant Core, Permission Core
workflow_instances             │ Workflow Core      │ Tous modules source
notification_queue             │ Notification Core  │ Notification Core uniquement
journal_entries (fiscal)       │ FISCAL CORE        │ Accounting, Reporting, Analytics, AI
journal_entries (non-fiscal)   │ Accounting Core    │ Reporting, Analytics, AI
fiscal_rules                   │ Fiscal Core        │ Fiscal Core, AI (lecture)
declarations_*                 │ Fiscal Core        │ Fiscal, Reporting, AI
bulletins_paie                 │ Payroll Core       │ Fiscal (ref nominative), Reporting
remuneration_items             │ Payroll Core       │ Payroll Core uniquement
stock_movements                │ Inventory Core     │ Fiscal, Accounting, Reporting
articles / stock_current       │ Inventory Core     │ CRM, Restaurant, Analytics
factures (métier)              │ CRM Core           │ Fiscal (event source), Reporting
contacts / companies           │ CRM Core           │ CRM, Reporting, AI
opportunities / devis          │ CRM Core           │ Analytics, Reporting, AI
report_cache                   │ Reporting Core     │ Analytics, AI
kpi_snapshots                  │ Analytics Core     │ AI, Dashboard
ai_conversations               │ AI Core            │ AI Core uniquement
ai_suggestions                 │ AI Core            │ AI Core + utilisateur (accept/reject)
integrations / webhook_logs    │ Integration Core   │ Admin Oraforme
```

---

## MATRICE 4 — CORE EVENT MATRIX

```
EVENT                    │ ÉMETTEUR          │ CONSOMMATEURS
─────────────────────────┼───────────────────┼───────────────────────────────────
USER_CREATED             │ Identity Core     │ Organization, Notification
USER_SIGNED_IN           │ Identity Core     │ Billing (vérif), Analytics
TENANT_CREATED           │ Tenant Core       │ Billing, Identity, Permission
MODULE_ACTIVATED         │ Tenant Core       │ Permission, Notification, UI
BILLING_SUSPENDED        │ Billing Core      │ Tenant, Identity, Notification
SUBSCRIPTION_UPGRADED    │ Billing Core      │ Tenant (modules), Notification
MEMBER_ONBOARDED         │ Organization Core │ Identity, Permission, Payroll, Notification
MEMBER_OFFBOARDED        │ Organization Core │ Identity, Permission, Payroll, Workflow
WORKFLOW_APPROVED        │ Workflow Core     │ Payroll, CRM, Inventory (selon type)
WORKFLOW_REJECTED        │ Workflow Core     │ Payroll, CRM, Notification
─────────────────────────┼───────────────────┼───────────────────────────────────
INVOICE_ISSUED           │ CRM Core          │ FISCAL CORE, Inventory, Analytics
INVOICE_CANCELLED        │ CRM Core          │ FISCAL CORE, Analytics
PAYMENT_RECEIVED (client)│ CRM Core          │ FISCAL CORE (encaissement), Analytics
PURCHASE_RECORDED        │ Achats (CRM/Inv.) │ FISCAL CORE, Inventory, Accounting
STOCK_ADJUSTED           │ Inventory Core    │ FISCAL CORE (si taxable), Accounting
─────────────────────────┼───────────────────┼───────────────────────────────────
SALARY_PAID              │ Payroll Core      │ FISCAL CORE, Accounting, Analytics
BULLETIN_GENERATED       │ Payroll Core      │ Workflow, Notification
PAYROLL_BATCH_DONE       │ Payroll Core      │ Integration (CNSS), Analytics
─────────────────────────┼───────────────────┼───────────────────────────────────
JOURNAL_WRITTEN          │ Fiscal Core       │ Accounting Core, Analytics, AI
DECLARATION_FILED        │ Fiscal Core       │ Notification, Integration (DGI), AI
TAX_PAID                 │ Fiscal Core       │ Accounting Core, Analytics, Integration
RULE_ACTIVATED           │ Fiscal Core       │ Fiscal Core (internal), AI, Notification
FCI_CERTIFICATION        │ Fiscal Core       │ Reporting, Analytics, Notification
AUDIT_COMPLETED          │ Fiscal Core       │ Reporting, AI, Notification
─────────────────────────┼───────────────────┼───────────────────────────────────
YEAR_CLOSED              │ Fiscal Core       │ Accounting Core, Reporting, Analytics
QUARTER_CLOSED           │ Fiscal Core       │ Fiscal Core (IS avances)
EXERCICE_CLOSED          │ Accounting Core   │ Reporting, Fiscal, Analytics
─────────────────────────┼───────────────────┼───────────────────────────────────
TICKET_CLOSED            │ Restaurant        │ Fiscal Core, Inventory
CONSULTATION_INVOICED    │ Santé             │ Fiscal Core, Analytics
BTP_INVOICE_ISSUED       │ BTP               │ Fiscal Core, Accounting
HARVEST_SOLD             │ Agriculture       │ Fiscal Core, Inventory
GRANT_RECEIVED           │ ONG               │ Fiscal Core, Accounting
─────────────────────────┼───────────────────┼───────────────────────────────────
AI_ANOMALY_DETECTED      │ AI Core           │ Notification, Reporting
AI_SUGGESTION_MADE       │ AI Core           │ UI (accept/reject)
BANK_STATEMENT_SYNCED    │ Integration Core  │ Accounting Core (rapprochement)
WEBHOOK_RECEIVED         │ Integration Core  │ Core cible (selon mapping)
```

---

## MATRICE 5 — CORE SOURCE OF TRUTH MATRIX

```
DIMENSION FONCTIONNELLE        │ SOURCE DE VÉRITÉ      │ LOI APPLICABLE
───────────────────────────────┼───────────────────────┼─────────────────────
Identité des utilisateurs      │ Identity Core (users) │ LOI-B
Modules actifs par tenant      │ Tenant Core (tenant_modules) │ LOI-B + F-003
Droits d'accès                 │ Permission Core       │ LOI-B
Structure organisationnelle    │ Organization Core     │ LOI-B
Abonnements SaaS               │ Billing Core          │ LOI-B
Calculs fiscaux                │ Fiscal Core           │ LOI-F
Règles fiscales                │ Fiscal Core (fiscal_rules) │ LOI-D + LOI-F
Déclarations fiscales          │ Fiscal Core (declarations_*) │ LOI-F
Grand Livre comptable          │ journal_entries       │ LOI-B + LOI-D
États financiers               │ Accounting Core (lit GL) │ LOI-B
Bulletins de paie              │ Payroll Core          │ LOI-A
Stock physique                 │ Inventory Core        │ LOI-A
Relations clients / factures   │ CRM Core              │ LOI-A
Processus de validation        │ Workflow Core         │ LOI-A
Notifications envoyées         │ Notification Core     │ LOI-A
KPIs et tableaux de bord       │ Analytics Core (snapshot) │ LOI-A
Réponses MIAA                  │ AI Core (tracées GL)  │ LOI-I
Intégrations / webhooks        │ Integration Core      │ LOI-A

RÈGLE : Si deux Cores prétendent être la source de vérité d'une même
         entité → escalade immédiate → LOI-A tranche.
         La source de vérité est CELLE QUI ÉCRIT, pas celle qui calcule.
```

---

## MATRICE 6 — CORE CERTIFICATION MATRIX

```
CORE                │ STATUS       │ VERSION │ FCI/SCORE │ PROCHAINE ACTION
────────────────────┼──────────────┼─────────┼───────────┼────────────────────────────
Identity Core       │ ✅ CERTIFIÉ  │ Supabase│ ★★★       │ Monitoring continu
Tenant Core         │ ✅ CERTIFIÉ  │ F-003   │ ★★★       │ CACHE READ FORBIDDEN actif
Organization Core   │ ⚠️ DRAFT    │ —       │ À mesurer │ Design complet requis
Permission Core     │ ⚠️ DRAFT    │ —       │ À mesurer │ RLS policy audit requis
Billing Core        │ ⚠️ DRAFT    │ —       │ À mesurer │ Plan features à définir
Workflow Core       │ ⚠️ DRAFT    │ —       │ À mesurer │ Templates à définir
Notification Core   │ ⚠️ DRAFT    │ —       │ À mesurer │ Canaux à configurer
Accounting Core     │ ⚠️ PARTIAL  │ Partiel │ À mesurer │ États financiers OHADA
Fiscal Core         │ ✅ CERTIFIÉ  │ F-006   │ 85/100*   │ FM-1 → FM-4 implémentation
Payroll Core        │ ✅ PARTIAL   │ Partiel │ ★★☆       │ calcul-paie.ts INTOUCHABLE
Inventory Core      │ ⚠️ DRAFT    │ —       │ À mesurer │ Modules sectoriels
CRM Core            │ ⚠️ DRAFT    │ —       │ À mesurer │ Pipeline + facturation
Reporting Core      │ ⚠️ DRAFT    │ —       │ À mesurer │ États OHADA automatisés
Analytics Core      │ ⚠️ DRAFT    │ —       │ À mesurer │ KPIs à définir
AI Core (MIAA)      │ ⚠️ DRAFT    │ —       │ À mesurer │ Dépend Fiscal Core FM-4
Integration Core    │ ⚠️ DRAFT    │ —       │ À mesurer │ Connecteurs DGI, CNSS

* FCI 85/100 = score cible post-implémentation FM-1 → FM-4

LÉGENDE :
  ✅ CERTIFIÉ  = Design validé, tests passent, en production ou prêt
  ⚠️ PARTIAL  = Partiellement implémenté, design manquant ou incomplet
  ⚠️ DRAFT    = Design F-007 établi, implémentation non commencée
```

---

# PARTIE 3 — ORAFORME FOUNDATION ARCHITECTURE v1

## Document Constitution

```
╔══════════════════════════════════════════════════════════════════════════════════╗
║                                                                                  ║
║         ORAFORME FOUNDATION ARCHITECTURE v1.0                                    ║
║         Constitution Technique de l'ERP                                          ║
║                                                                                  ║
║         Émise le : 2026-07-02                                                    ║
║         Statut   : OFFICIELLE                                                    ║
║         Validée  : Après F-003 · F-005 · F-005.1 · F-005.2 · F-006             ║
║                                                                                  ║
╠══════════════════════════════════════════════════════════════════════════════════╣
║                                                                                  ║
║  ARTICLE 1 — STRUCTURE                                                           ║
║  ──────────────────────                                                          ║
║  Oraforme est organisé en 16 Cores indépendants, répartis en 4 niveaux.        ║
║  Chaque Core a une mission unique, une source de vérité unique, et des          ║
║  frontières d'écriture strictement définies.                                    ║
║                                                                                  ║
║  ARTICLE 2 — LOIS FONDAMENTALES                                                  ║
║  ──────────────────────────────                                                  ║
║  10 lois (LOI-A à LOI-J) s'appliquent à tout développement Oraforme.            ║
║  Violation d'une loi = rejet automatique de la PR, sans exception.              ║
║                                                                                  ║
║  ARTICLE 3 — FISCAL SUPREMACY                                                    ║
║  ──────────────────────────────                                                  ║
║  Le Fiscal Core est l'autorité suprême sur journal_entries pour les             ║
║  entrées fiscales. Sa certification F-006 est la référence architecturale       ║
║  que tous les autres Cores doivent suivre comme modèle de conception.           ║
║                                                                                  ║
║  ARTICLE 4 — ÉVÉNEMENTS COMME CONTRATS                                           ║
║  ──────────────────────────────────────                                          ║
║  La communication inter-Core se fait exclusivement par Events.                  ║
║  Un Event est un contrat immuable. Son schéma ne change pas.                    ║
║  Un breaking change nécessite un nouveau type d'Event (v2).                     ║
║                                                                                  ║
║  ARTICLE 5 — IMMUTABILITÉ FINANCIÈRE                                             ║
║  ───────────────────────────────────                                             ║
║  Toute écriture financière (journal_entries), fiscale (declarations_*),         ║
║  ou de paie (bulletins_paie) est immuable après création.                       ║
║  La correction se fait par événement compensatoire avec audit trail.            ║
║                                                                                  ║
║  ARTICLE 6 — TENANT ISOLATION ABSOLUE                                            ║
║  ─────────────────────────────────────                                           ║
║  Aucune donnée ne traverse les frontières tenant sans autorisation              ║
║  explicite du Tenant Core. RLS est actif sur toutes les tables métier.          ║
║  tenant_modules est la SEULE source pour les modules actifs (F-003).            ║
║                                                                                  ║
║  ARTICLE 7 — AI SOUS SUPERVISION                                                 ║
║  ──────────────────────────────────                                              ║
║  AI Core ne modifie jamais les données opérationnelles.                         ║
║  Toute suggestion AI est soumise à validation humaine.                          ║
║  MIAA cite toujours la source (journal_entries, FiscalRule, déclaration).       ║
║                                                                                  ║
║  ARTICLE 8 — CERTIFICATION OBLIGATOIRE                                           ║
║  ──────────────────────────────────────                                          ║
║  Avant mise en production, chaque Core passe une certification :                ║
║  - Source de vérité documentée et respectée                                     ║
║  - Frontières d'écriture respectées (tests d'intégration)                      ║
║  - Events produits et consommés documentés                                      ║
║  - SLA mesurés en staging                                                       ║
║  - Tests unitaires couvrant les cas critiques                                   ║
║                                                                                  ║
╠══════════════════════════════════════════════════════════════════════════════════╣
║                                                                                  ║
║  SÉQUENCE DE CERTIFICATION DES CORES                                             ║
║  ─────────────────────────────────────                                           ║
║                                                                                  ║
║  PHASE 1 — FONDATION (bloquant tout le reste)                                   ║
║    ✅ C-001  Identity Core      (Supabase Auth — déjà opérationnel)             ║
║    ✅ C-002  Tenant Core        (F-003 — CERTIFIÉ)                              ║
║    ⬜ C-003  Permission Core    (design F-007 — à implémenter)                  ║
║                                                                                  ║
║  PHASE 2 — STRUCTURE                                                             ║
║    ⬜ C-004  Organization Core  (design F-007 — à implémenter)                  ║
║    ⬜ C-005  Billing Core       (design F-007 — à implémenter)                  ║
║                                                                                  ║
║  PHASE 3 — MOTEURS CRITIQUES                                                     ║
║    ✅ C-006  Fiscal Core        (F-006 — CERTIFIÉ — FM-1→FM-4 en attente)      ║
║    ✅ C-007  Accounting Core    (Partiel — dépend Fiscal Core FM-4)             ║
║    ✅ C-008  Payroll Core       (calcul-paie.ts opérationnel)                   ║
║                                                                                  ║
║  PHASE 4 — OPÉRATIONNEL                                                          ║
║    ⬜ C-009  Workflow Core      (design F-007)                                   ║
║    ⬜ C-010  Notification Core  (design F-007)                                   ║
║    ⬜ C-011  Inventory Core     (design F-007)                                   ║
║    ⬜ C-012  CRM Core           (design F-007)                                   ║
║                                                                                  ║
║  PHASE 5 — INTELLIGENCE                                                          ║
║    ⬜ C-013  Reporting Core     (dépend Phase 3 complète)                        ║
║    ⬜ C-014  Analytics Core     (dépend Phase 4 complète)                        ║
║    ⬜ C-015  AI Core (MIAA)     (dépend Fiscal Core FM-4)                       ║
║                                                                                  ║
║  PHASE 6 — CONNECTIVITÉ                                                          ║
║    ⬜ C-016  Integration Core   (dépend Phase 3 + DGI/CNSS connecteurs)         ║
║                                                                                  ║
╠══════════════════════════════════════════════════════════════════════════════════╣
║                                                                                  ║
║  PRINCIPES NON NÉGOCIABLES                                                       ║
║  ─────────────────────────                                                       ║
║                                                                                  ║
║  ① Aucun module métier ne calcule directement un impôt                          ║
║  ② Aucun dashboard ne contient de formule fiscale                                ║
║  ③ Grand Livre = source de vérité pour toute déclaration                        ║
║  ④ Un événement métier → FiscalEvent → Fiscal Core (jamais écriture directe)   ║
║  ⑤ calcul-paie.ts est INTOUCHABLE                                               ║
║  ⑥ tenant_modules est la seule source pour les modules actifs                   ║
║  ⑦ Toute correction financière passe par un événement compensatoire            ║
║  ⑧ AI Core ne peut pas modifier les données (lecture + suggestion seulement)    ║
║  ⑨ Chaque Core a un owner technique clairement désigné                         ║
║  ⑩ Breaking change inter-Core = migration planifiée ≥ 30 jours                 ║
║                                                                                  ║
╠══════════════════════════════════════════════════════════════════════════════════╣
║                                                                                  ║
║  RÉSUMÉ EXÉCUTIF                                                                 ║
║  ────────────────                                                                ║
║                                                                                  ║
║  16 Cores définis · 4 niveaux d'architecture · 10 Lois fondamentales           ║
║  6 Matrices de gouvernance · 1 séquence de certification en 6 phases           ║
║                                                                                  ║
║  Le Fiscal Core (F-006) sert de modèle de référence pour tous les Cores        ║
║  futurs : même niveau de rigueur, même isolation, même traçabilité.             ║
║                                                                                  ║
║  Aucune implémentation dans ce document.                                         ║
║  Tout développement futur référence ce document avant toute PR.                  ║
║                                                                                  ║
╚══════════════════════════════════════════════════════════════════════════════════╝
```

---

*F-007 — Oraforme Foundation Architecture v1.0*  
*Référence : F-003 · F-005 · F-005.1 · F-005.2 · F-005.2-CATALOGS · F-006*  
*Prochaine étape suggérée : FM-1 (FiscalRulesEngine) ou C-003 (Permission Core)*

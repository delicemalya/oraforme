# ORAFORME — ÉTAT GLOBAL 2026-10

Mission MASTER — audit et planification, lecture seule. Aucun code modifié, aucune migration créée/exécutée, aucune donnée production modifiée, aucun commit, aucun push.

Méthode : 8 audits parallèles en lecture seule (code actuel + sondage PostgREST read-only sur la production réelle), synthétisés ici. Chaque affirmation porte une étiquette : **PROVEN** (vérifié directement dans le code/la prod pendant cet audit), **PARTIAL** (vrai en partie, nuances données), **INFERRED** (déduit d'un rapport antérieur non re-vérifié ligne à ligne cette fois), **UNKNOWN** (aucun canal ne permet de trancher). Une absence de preuve n'est jamais traitée comme une preuve de bon fonctionnement.

Deux discordances entre agents ont été tranchées explicitement dans ce document (section 2) plutôt que glissées sous le tapis.

---

## 1. EXECUTIVE SUMMARY

Oraforme est un ERP SaaS multi-tenant OHADA/CEMAC (Next.js 16 / React 19 / Supabase) avec 211 routes API, 184 migrations SQL, 277 pages dashboard et 19 modules métier sectoriels. Le moteur comptable central (`emit_accounting_event` → `journal_entries`) est **réellement unique et respecté pour les écritures émises depuis `app/api`** — c'est la plus solide fondation du système et un vrai progrès mesuré par rapport à l'audit de septembre. Le moteur fiscal centralise correctement les taux CNSS/IRPP du Congo, avec sources légales citées et versionnées.

Mais trois réalités empêchent toute certification de production aujourd'hui :

1. **Deux failles d'autorisation cross-tenant actives et vérifiées dans le code actuel** (MIAA : `tenant_id` lu depuis le corps JSON du client sans vérification de session ; `/api/jobs/top5` et routes sœurs : PII de candidats accessible par énumération, zéro vérification de tenant). Ce ne sont pas des trouvailles historiques déjà corrigées — elles ont été relues ligne par ligne aujourd'hui et sont toujours présentes.
2. **Le module de vente au comptoir (POS/Commerce) n'émet jamais aucune écriture comptable.** Recherche exhaustive de codes d'événement `VTE-`/`COM-`/`POS-` dans tout le dépôt : 0 résultat. Chaque vente encaissée au comptoir est aujourd'hui invisible du grand livre — un trou financier structurel, pas un détail.
3. **Le statut réel en production de la migration 180** (correctif des 2 fuites RLS CRITICAL `tenants`/`journal_entries` déjà identifiées par l'audit de septembre) **reste indéterminable** : le fichier existe et s'auto-vérifie s'il est exécuté, mais le seul canal disponible (`service_role` via PostgREST) contourne par construction toute RLS et ne peut donc jamais prouver qu'une policy est en place. Un agent de cette session a conclu par erreur "appliquée" du seul fait que le fichier existe et a été lu — c'est exactement le raisonnement que la méthodologie BOI-010D (sondage production direct, la plus rigoureuse disponible) interdit. **Ce document retient UNKNOWN**, pas APPLIED.

Par ailleurs, la production réelle est aujourd'hui très légère : **26 tenants, dont 21 (81%) portent un nom explicite de test/QA et sont encore actifs**, et seulement **2 profils utilisateurs réels** au total. L'absence d'incident massif à ce jour s'explique largement par l'absence d'usage massif, pas par la robustesse du système.

**Verdict** : `ORAFORME_STATE = REPAIR`. Le travail déjà fait (moteur comptable, moteur fiscal, achats, provenance de stock) est solide et doit être préservé — ce n'est pas un échec global. Mais tant que des failles cross-tenant actives et un module financier structurellement déconnecté du grand livre coexistent, parler de "stabilisation" serait prématuré. La section 21 propose le protocole de sortie de boucle demandé.

---

## 2. CURRENT STATE

**Stack (PROVEN)** : Next.js 16.2.4, React 19.2.4, TypeScript 5, Tailwind 4, Vitest 4, Playwright 1.61, ESLint 9. Supabase (`@supabase/ssr` + `@supabase/supabase-js`), pas de NextAuth. IA : Anthropic SDK + Mistral SDK. Stockage : AWS S3. Observabilité : Sentry (3 configs client/serveur/edge).

**Carte** : `app/dashboard/` = 58 répertoires métier/transverses, `app/admin/` = 21 répertoires back-office plateforme, `app/api/` = 211 `route.ts`, `supabase/migrations/` = 184 fichiers (dernier : `184_stock_provenance.sql`, non appliqué), `lib/` = moteurs (fiscal, payroll, erp-core, identity, miaa, workflow, analytics...). Pas de `middleware.ts` racine — le gating tenant se fait route par route via deux gateways concurrents (voir §15). 11 crons Vercel, tous protégés par un secret comparé en temps constant (`safeEqual`, PROVEN). PWA réelle (manifest + service worker non-vide, cache-first, exclut `/api/` et Supabase du cache).

**Discordance tranchée n°1 — migration 180** : l'agent "Inventaire/Cores" a conclu "PROVEN appliquée" du seul fait d'avoir lu le fichier de migration. L'agent "Sécurité" et le document `BOI-010D-ETAT-MIGRATOIRE-PRODUCTION.md` (sondage PostgREST direct, méthode plus rigoureuse) concluent **UNKNOWN** — le `service_role` contourne toute RLS, lire le fichier ne prouve rien sur son exécution réelle. **Ce document retient UNKNOWN.**

**Discordance tranchée n°2 — nombre de tests** : un agent rapporte "85 fichiers `*.test.ts`" (recherche brute), un autre "47 fichiers / 1006 tests" en exécutant réellement `vitest run`. L'écart s'explique probablement par des doublons sous `.claude/worktrees/` (mentionnés ailleurs dans le même audit comme source de ~60 faux doublons ESLint). **Ce document retient le chiffre exécuté et vérifié : 47 fichiers, 1006 tests, tous passants en run isolé.**

---

## 3. WHAT IS ACTUALLY WORKING

Liste positive — PROVEN par au moins un agent ayant relu le code actuel, pas recopié d'un ancien rapport :

- ✅ **Moteur comptable unique côté écriture** : `emit_accounting_event()` → `journal_entries`, 19 points d'appel confirmés (factures, achats, paie, stock, resto, hôtel, santé, boisson, BTP, école, agriculture, ONG), **0 insert direct trouvé dans `app/api`**.
- ✅ **Mécanisme de reverse réel** : `fn_reverse_accounting_event()`, pas un simple DELETE.
- ✅ **Flux Achats consolidé** (BOI-004) : `app/api/stocks/purchases/route.ts` appelle `fn_stock_move` + `emit_accounting_event('ACH-001'/'ACH-002')` — le writer legacy a été retiré de ce flux. Amélioration réelle, confirmée par lecture directe du code aujourd'hui.
- ✅ **Fiscalité Congo** : taux TVA/CA/IRPP/CNSS/TUS sourcés explicitement à la Loi de Finances 2026, versionnés par période (`valid_from`/`valid_until`), testés.
- ✅ **Taux CNSS/IRPP centralisés** dans un seul moteur bas niveau (`universal-tax-engine.ts`), plus aucun second barème actif trouvé en production.
- ✅ **Stock — fondation solide** : `v_products_stock` et `fn_stock_move` (migration 173) fonctionnels en production, confirmés colonne par colonne.
- ✅ **Modèle de provenance de stock** : logique CHOIX MANUEL correctement implémentée et testée (23/23 tests, migration 184 prête), même si non déployée.
- ✅ **Hygiène secrets** : aucun secret commité, aucune variable `NEXT_PUBLIC_SERVICE_ROLE`, comparaison cron en temps constant, Sentry replay masqué (`maskAllText`/`blockAllMedia`).
- ✅ **Garde-fous de seed** : `seed-demo-data.ts`/`seed-employes-test.ts` et `tests/certifications/helpers/db.ts` refusent de s'exécuter contre la production réelle.
- ✅ **`tenant_modules`** : migration propre depuis la colonne legacy `tenants.modules_actifs`, gardée par un test anti-régression CI (`no-cache-reads.test.ts`).
- ✅ **BTP-001/RES-001/SAN-001/HOT-001/BOI-001** : séparation TVA/Centime Additionnel (migrations 181/182) confirmée appliquée en production par sondage direct.

---

## 4. WHAT IS PARTIAL

- 🟡 **Comptabilité trésorerie** : le moteur central existe et fonctionne, mais `lib/compta-sync-client.ts` (`writeComptaEntry()`) reste **activement utilisé par 13+ pages** (banques, caisses, décaissements, encaissements, mobile-money, transferts) avec un double insert direct (`journal_comptable` + `journal_entries`), hors moteur. C'est une violation réelle de LOI-D (Financial Immutability/single-writer), pas un vestige mort.
- 🟡 **Fiscalité multi-pays** : Congo = PROVEN et sourcé légalement. Cameroun/Gabon/Guinée Éq./RCA/Tchad/RDC = le code lui-même s'auto-déclare `estimated`/`to_verify` dans ses commentaires. Un pays non implémenté (Angola, Mali, etc.) **retombe silencieusement sur les taux congolais** via un fallback sans avertissement — dangereux si jamais exploité par un tenant mal configuré.
- 🟡 **Paie** : taux centralisés, mais **trois implémentations de construction du bulletin** (`rh/page.tsx`, `rh/paie/page.tsx`, `ecole/rh/page.tsx`) avec des **assiettes CNSS différentes** (transport/logement inclus ou exclus selon l'écran) — écart réel, verrouillé par un test qui le documente comme un fait, pas corrigé.
- 🟡 **Permission Engine** : un moteur backend existe (`lib/identity/policy/*`) et est branché sur 7 routes d'authentification, mais **0 route API** ne vérifie `role_permissions`/`user_permissions` avant une action destructrice — les rôles granulaires sont 100% cosmétiques côté serveur.
- 🟡 **Gating de plan commercial** : 7 routes sur ~210 seulement vérifient le plan payant (toutes sous `/api/miaa/*`).
- 🟡 **Build local** : `tsc --noEmit` propre, mais `npm run build` local échoue par épuisement mémoire (440 pages statiques) — non concluant pour Vercel (qui applique un flag mémoire via `buildCommand`), mais un signal réel de volume proche de la limite.

---

## 5. WHAT IS BROKEN

- 🔴 **POS/Commerce** : ventes enregistrées (`ventes`/`vente_lignes`) et stock décrémenté (RPC directe `fn_stock_move`), mais **aucune écriture comptable n'est jamais émise**. Le module de vente le plus simple et le plus central du système est financièrement invisible.
- 🔴 **Sortie de stock dédiée** (`app/dashboard/stocks/sorties/page.tsx`) : appelle `fn_stock_move` directement en RPC client, contournant `/api/stock/move` — aucune écriture `STK-002` générée.
- 🔴 **Pharmacie (module Santé)** : écrit `pharmacie_medicaments.stock_actuel` directement, sans jamais passer par `fn_stock_move` — sous-système de stock parallèle, sans trace d'audit, désynchronisé du reste de l'ERP.
- 🔴 **IDOR MIAA** : `tenant_id` fourni par le corps JSON du client sur 7+ routes (`chat`, `agent`, `expertise`, `academy`, `generer-document`, `analyze-file`, `executive`), jamais revérifié contre la session — fuite de données financières/RH cross-tenant active aujourd'hui.
- 🔴 **IDOR `/api/jobs/top5` et routes sœurs** : PII complète de candidats (nom, email, compétences, diplômes, rapport IA) accessible par énumération d'`offreId`, aucune vérification de tenant.

---

## 6. WHAT IS MISSING

- Un moteur de facturation réel (Billing Core = types/constantes uniquement, aucune logique de calcul d'abonnement/facture SaaS).
- Un Core Organisation structuré (géré de façon diffuse via RLS/`entity_group_members`, pas de module dédié).
- Un Core Notification transverse (logique ad hoc par module, uniquement MIAA a un sous-système dédié).
- Un Core CRM réel (CRUD direct sans moteur, route API orpheline).
- Un Core Reporting dédié (la page rapports réimplémente ses propres agrégations au lieu de consommer une API comptable commune).
- Une taxe d'accise boisson (BOI) réellement codée — seule la conception documentaire existe, aucun calcul fiscal d'accise dans le code.
- Une séquence de facturation atomique côté serveur (le numéro de facture est fourni par le client).
- Une clôture d'exercice comptable formelle (verrouillage de période) — l'UI existe, aucune route API de clôture trouvée.
- Un environnement de validation locale fonctionnel (Docker arrêté, bloque toute validation transactionnelle avant déploiement production).

---

## 7. SECURITY STATUS

| # | Problème | Classe | Statut |
|---|---|---|---|
| 1 | IDOR MIAA (tenant_id client, 7+ routes) | **CRITICAL** | PROVEN actif |
| 2 | IDOR `/api/jobs/top5` + sœurs (PII candidats cross-tenant) | **CRITICAL** | PROVEN actif, nouveau cette session |
| 3 | IRPP persisté depuis le payload client sans recalcul serveur (`app/api/rh/paie/route.ts:87`) | **CRITICAL** | PROVEN actif |
| 4 | Gating de plan quasi inexistant (7/210 routes) | **CRITICAL** | PROVEN actif |
| 5 | Statut réel de la policy RLS tenants/journal_entries (migration 180) en production | **CRITICAL (indéterminé)** | UNKNOWN — à vérifier en priorité absolue |
| 6 | `tenants: insert` ouverte (tout utilisateur authentifié crée un tenant arbitraire) | HIGH | PROVEN toujours ouverte |
| 7 | Permission Engine sans effet serveur | HIGH | PROVEN |
| 8 | Webhook WhatsApp sans vérification HMAC | HIGH | PROVEN |
| 9 | `supabase/seed_ecam_congo.sql` toujours non gardable (SQL brut) | HIGH | PROVEN |
| 10 | 90 fonctions SECURITY DEFINER, 23 vues sans REVOKE anon, policies RLS vivantes non traçables par git | — | UNKNOWN (nécessite accès DB live) |

Points positifs confirmés : aucun secret commité, aucune clé service_role exposée côté client, comparaison cron en temps constant, Sentry replay masqué, scripts de seed dangereux gardés (sauf le SQL brut ci-dessus), aucune route debug/test exposée.

---

## 8. ACCOUNTING STATUS

Architecture cible respectée pour les écritures émises par les routes API : `UI/API → emit_accounting_event() → accounting_events → fn_ae_execute_event() (trigger) → journal_entries`, writer unique confirmé (0 insert direct dans `app/api`).

Violations réelles et actives :
- `lib/compta-sync-client.ts` écrit directement dans `journal_comptable` + `journal_entries` depuis 13+ pages dashboard (trésorerie, stocks, école) — hors moteur, dette documentée (EXM-JE-003) mais pas un vestige, un chemin vivant.
- POS/Commerce : aucune écriture, aucun event_type dédié (`VTE-`/`COM-`/`POS-` : 0 résultat).

Flux end-to-end confirmés : Factures (FAC-001/002), Achats (ACH-001/002), Paie (PAI-001/002), Stock entrée (STK-001, via fn_stock_move), secteurs (RES/SAN/HOT/BOI/BTP-001). Grand Livre et Balance existent et interrogent réellement la base, mais leurs routes API sont orphelines — la page Rapports réimplémente ses propres agrégations indépendamment, risque de divergence.

---

## 9. FISCAL STATUS

| Règle | Statut |
|---|---|
| TVA/CA/IRPP/CNSS/TUS Congo | **CONFIRMÉE** (sourcée LF 2026, versionnée, testée) |
| Cameroun, Gabon, Guinée Éq., RCA, Tchad, RDC | **PARTIELLEMENT CONFIRMÉE** (le code s'auto-déclare `estimated`/`to_verify`) |
| Accise boisson (BOI, loi 42-2019) | **NON IMPLÉMENTÉE** (conception documentaire seulement) |
| Fallback pays non couvert | **DANGEREUX** — retombe silencieusement sur les taux Congo, sans erreur ni avertissement |
| 3 bypass TVA 18% codés en dur (module cabinet) | **CONFIRMÉE comme dette active** (DET-L-001/002/003) |

---

## 10. PAYROLL STATUS

Taux bas niveau (CNSS/IRPP/TUS) : **centralisés**, un seul moteur (`universal-tax-engine.ts`). Construction du bulletin : **non centralisée**, trois implémentations divergentes sur l'assiette CNSS (transport/logement), écart documenté par un test mais non résolu. Le moteur "universel" censé unifier tout ça (`lib/payroll/universal-payroll-engine.ts`) est construit, testé, documenté "Phase 2" — **zéro consommateur en production**, à ne pas compter comme implémenté. Bulletins PDF et déclarations CNSS réels (pas des stubs). IRPP falsifiable côté client (voir sécurité #3).

---

## 11. STOCK / PURCHASE / BOI STATUS

`v_products_stock`/`fn_stock_move` (migration 173) : **en production, fonctionnels**. `stock_movements.origine`/`purchase_item_id` (migration 184) et `warehouses.actif`/`suppliers.actif` (migration 183) : **NOT_APPLIED**, confirmé par sondage direct (`42703`). Flux provenance achat→réception→POS implémenté et testé (23/23, mais tests = réimplémentation JS, pas exécution SQL réelle). Sorties dédiées et pharmacie : **BROKEN**, bypass total du moteur. Accise BOI : non codée. Docker toujours arrêté — validation locale transactionnelle bloquée.

---

## 12. MODULE STATUS

| Module | UI | API | DB | Business Logic | Accounting | Fiscal | Tests | Production | État |
|---|---|---|---|---|---|---|---|---|---|
| Facturation | PROVEN | PROVEN | PROVEN | PARTIAL | PROVEN | PARTIAL | PROVEN | INFERRED 0 ligne | PARTIAL |
| Comptabilité | PROVEN | PARTIAL (routes orphelines) | PROVEN | PARTIAL (≥2 writers) | PROVEN moteur / PARTIAL usage | N/A | PROVEN | UNKNOWN | PARTIAL |
| Fiscalité | PROVEN | PARTIAL | PROVEN | PROVEN | N/A | PARTIAL | PROVEN | UNKNOWN | PARTIAL |
| Paie/RH | PROVEN | PROVEN | PROVEN | PROVEN | PROVEN | PROVEN | PROVEN | INFERRED | PARTIAL |
| Achats | PROVEN | PROVEN | PROVEN | PROVEN | PROVEN (corrigé) | N/A | PARTIAL | UNKNOWN (0 ligne) | PARTIAL↑ |
| Stocks | PROVEN | PROVEN (entrée) | PROVEN | PARTIAL | PARTIAL | N/A | PARTIAL | UNKNOWN | PARTIAL/BROKEN |
| POS/Commerce | PROVEN | DEAD (0 route dédiée) | PROVEN | PARTIAL | **BROKEN** | N/A | DEAD | UNKNOWN | **BROKEN** |
| Restaurant | PROVEN | PROVEN (partiel) | PROVEN | PROVEN | PARTIAL/PROVEN | N/A | DEAD | UNKNOWN | PARTIAL |
| Boissons (BOI) | PROVEN | PARTIAL | PROVEN (modèle prêt) | PROVEN | PARTIAL | NON IMPLÉMENTÉE | INFERRED | NOT_APPLIED | PARTIAL |
| Hôtel | PROVEN | PROVEN | PROVEN | PARTIAL | PARTIAL | N/A | DEAD | INFERRED 0 | PARTIAL |
| Santé | PROVEN | PROVEN | PROVEN | PROVEN | PARTIAL / **BROKEN (pharmacie)** | N/A | DEAD | INFERRED 0 | PARTIAL |
| École | PROVEN | PARTIAL (1 route, reste Flux A) | PROVEN | PARTIAL | PARTIAL | N/A | DEAD | UNKNOWN | PARTIAL |
| BTP | PROVEN | PARTIAL | PROVEN | PARTIAL | PARTIAL (appliqué) | PROVEN | PROVEN (le mieux testé) | UNKNOWN | PARTIAL |
| ONG | PROVEN | PARTIAL | PROVEN | PARTIAL | PARTIAL | N/A | DEAD | INFERRED (1 tenant, 0 ligne) | PARTIAL |
| Agriculture | PROVEN | PARTIAL | PROVEN | PARTIAL | PARTIAL | N/A | DEAD | UNKNOWN | PARTIAL |
| CRM | PROVEN | **DEAD** (orpheline) | PROVEN | PARTIAL | N/A | N/A | DEAD | UNKNOWN | NOT_IMPLEMENTED |
| Reporting | PROVEN | DEAD (0 route dédiée) | PROVEN | PARTIAL | N/A (duplication risque) | N/A | DEAD | UNKNOWN | PARTIAL |
| Analytics | **DEAD** (redirection pure) | N/A | N/A | N/A | N/A | N/A | N/A | N/A | DEAD |
| AI/MIAA | PROVEN | PROVEN mais **CRITIQUE** | PROVEN | PROVEN | N/A | N/A | PARTIAL | UNKNOWN | PARTIAL + faille CRITICAL |

---

## 13. TEST STATUS

47 fichiers / 1006 tests, tous passants en run isolé (PROVEN, exécuté cette session). Répartition réelle : 15 unitaires purs, **24 (51%) sont des tests "architecture"** — lecture statique du code source par regex, zéro exécution —, 6 entièrement mockés (DB jamais réellement touchée), 2 garde-fous env. **0 des 211 routes API n'est exécutée par un test.** 6 specs Playwright E2E réelles existent (créent de vrais tenants via service_role) mais ne tournent dans aucune CI et n'ont pas été relancées cette session.

**Ce que la suite ne prouve pas** : que RLS protège réellement un tenant d'un autre (aucun test n'exécute une requête sous un rôle non-service_role) ; que les 211 routes appliquent correctement l'isolation tenant à l'exécution (au mieux ~25 routes ont une sous-chaîne attendue trouvée statiquement) ; que `fn_stock_move`/`fn_ae_execute_event` fonctionnent réellement en SQL (seules leurs réimplémentations JS sont testées — risque de divergence silencieuse) ; qu'un parcours utilisateur complet fonctionne de bout en bout.

---

## 14. PRODUCTION STATUS

Comptages réels (PROVEN, sondés aujourd'hui) : 26 tenants (21 = 81% avec un nom test/QA, encore actifs), **2 profils utilisateurs réels seulement**, 10 produits, 0 fournisseur/achat/mouvement de stock, 21 écritures comptables, 2 événements comptables, 6 factures, 5 employés, 4 bulletins de paie. Registre natif de migrations Supabase quasi vide (3 entrées trackées contre 184 fichiers) — l'écrasante majorité a été appliquée manuellement (SQL Editor), hors tout tracking fiable.

`tsc --noEmit` : propre. `npm run build` local : **échoue par épuisement mémoire** (440 pages statiques, non concluant pour Vercel qui applique un flag mémoire dédié — mais signal réel à vérifier explicitement avec le même flag). ESLint (`npx eslint . --quiet`, exécuté intégralement cette session) : **PROVEN 0 erreur** (exit 0, sortie vide) ; le compte de warnings (111 bruts/~51 utiles selon `MASTER-A-Z-AUDIT-2026-09.md`) reste **INFERRED**, non vérifiable avec `--quiet` qui les masque par construction. PWA et cron : réels et fonctionnels. Sentry : configuré, DSN présent, replay masqué.

---

## 15. TECHNICAL DEBT

| Classement | Éléments |
|---|---|
| **REMOVE** | `lib/erp-core.ts` vs `lib/erp-core/index.ts` (collision, 0 importeur), `lib/erp-core/compute/{tresorerie,ebitda,stock,clients}.ts` (0 importeur), `lib/accounting-engine.ts::createJournalEntry()` (0 appelant réel), `getPlanFromLegacy()` (mort), `lib/fiscal/congo-calculs.ts` (0 importeur mais cité comme référence dans des en-têtes de test — piège documentaire actif) |
| **MIGRATE (urgent)** | `lib/tenant-guard.ts` (`@deprecated`, mais **77 importeurs et en hausse** 75→76→77 en un mois — la dette s'aggrave) ; `security_audit_log`/`fn_log_security_event()` (créé, jamais branché) ; écritures directes `journal_entries` dans 2 pages dashboard hors exemption documentée ; `lib/compta-sync-client.ts` (13+ pages à reconnecter au moteur) ; les 3 implémentations de bulletin de paie (assiette CNSS à unifier) |
| **DEFER** | ~107-114 usages de `any` (dette assumée) ; 27 `eslint-disable` (majorité `react-hooks/exhaustive-deps`) ; 6 TODO/FIXME sur taux fiscaux CEMAC non confirmés (nécessite confirmation réglementaire, pas un refactor) |
| **KEEP** | 24 tests d'architecture (vrai mécanisme de gouvernance anti-régression, périmètre à élargir plutôt qu'à jeter) ; moteur `emit_accounting_event` ; `tenant_modules` + son test de garde |

---

## 16. STRUCTURAL BLOCKERS

Les 12 bloqueurs qui empêchent réellement de considérer Oraforme comme terminé — pas une liste de 100 petits problèmes :

| # | Problème | Cause | Impact | Dépendances | Action | Complexité |
|---|---|---|---|---|---|---|
| 1 | IDOR cross-tenant actif (MIAA + jobs/top5) | `tenant_id` lu du body client, jamais de la session | Fuite de données financières/RH/PII entre tenants | Aucune | Forcer `tenant_id` depuis la session serveur sur ces ~9 routes | **M** |
| 2 | Statut réel de la RLS migration 180 indéterminable | `service_role` contourne RLS, pas d'accès `pg_policies` | Impossible de certifier close une faille déjà classée CRITICAL en septembre | Docker ou MCP fonctionnel | Rétablir un canal SQL (Docker ou MCP), vérifier `pg_policies` | **S** une fois le canal rétabli, **bloqué** sinon |
| 3 | POS/Commerce sans comptabilité | Jamais câblé à `emit_accounting_event` | Chiffre d'affaires comptoir invisible du grand livre | Core Accounting (prêt) | Créer `event_type` dédié + brancher l'appel | **M** |
| 4 | IRPP falsifiable côté client | Pas de recalcul serveur | Risque fiscal/légal sur bulletins officiels | Moteur fiscal (prêt) | Recalculer IRPP serveur avant persistance | **S** |
| 5 | Gating de plan quasi absent | Jamais généralisé au-delà de MIAA | Fonctionnalités payantes utilisables sans payer | — | Middleware/gateway de plan générique | **L** |
| 6 | 3 assiettes de paie divergentes | Jamais unifiées malgré un moteur taux commun | Bulletins officiels incohérents selon l'écran | Choix métier à trancher | Décider l'assiette unique, migrer les 3 écrans | **M** |
| 7 | Permission Engine sans effet serveur | Backend existe, jamais appelé par les routes | Rôles granulaires 100% cosmétiques | Moteur identity (prêt) | Brancher la vérification sur les routes destructrices | **L** |
| 8 | Deux gateways tenant concurrents | `tenant-guard.ts` vs `require-tenant.ts`, jamais fusionnés | Dette qui grossit (75→77 importeurs/mois) | — | Choisir un gateway, migrer l'autre | **L** |
| 9 | Stock sorties/pharmacie bypassent le moteur | RPC/update direct au lieu de l'API officielle | Stock désynchronisé, pas de trace comptable/provenance | Core Inventory (prêt) | Reconnecter ces 2 chemins à `/api/stock/move` | **M** |
| 10 | Migrations 183/184 non appliquées | Environnement de validation locale bloqué (Docker arrêté) | Fonctionnalité provenance de stock inerte en production | Docker | Démarrer Docker, valider transactionnellement, puis déployer | **S** une fois Docker up |
| 11 | Docker Desktop arrêté | Aucun processus actif | Bloque toute validation locale réelle (migrations, RLS, SQL) | — | Démarrer Docker manuellement | **S** |
| 12 | 21/26 tenants production = test/QA actifs | Jamais nettoyés en masse | Pollue les métriques réelles, risque de confusion démo/réel | — | Désactiver ou isoler dans un projet Supabase dédié | **S** |

---

## 17. WORK THAT CAN STOP

Ce qui est terminé et ne nécessite plus de nouvelle mission d'audit/correction (preuve dans le dépôt) :

- ✓ Moteur comptable central (`emit_accounting_event`, writer unique côté `app/api`)
- ✓ Fiscalité Congo (TVA/CA/IRPP/CNSS/TUS, sourcée et versionnée)
- ✓ Convergence Achats (BOI-004)
- ✓ Fondation stock (`v_products_stock`/`fn_stock_move`, migration 173)
- ✓ `tenant_modules` et sa garde anti-régression
- ✓ Hygiène secrets et scripts de seed (hors `seed_ecam_congo.sql`)
- ✓ BTP-001/RES-001/SAN-001/HOT-001/BOI-001 (séparation TVA/CA)
- ✓ PWA (manifest + service worker réels)

## 18. WORK THAT MUST CONTINUE

Tout ce qui relève des 12 bloqueurs structurels (§16), en priorité les items CRITICAL/HIGH de sécurité (§7), le recâblage POS/Commerce, et la convergence des 3 moteurs de paie. Voir roadmap ci-dessous.

---

## 19. ROADMAP TO FINISH

L'ordre proposé par la mission reste globalement valide — l'audit ne révèle pas de raison de le bouleverser, seulement de renforcer la Phase 1.

**PHASE 0 — Infrastructure.** Objectif : rétablir un canal de validation fiable. Dépendances : aucune. Missions : démarrer Docker, confirmer MCP ou obtenir un accès SQL direct. Critère de sortie : une requête `pg_policies` réelle est possible. Risque : sans cette phase, la Phase 1 reste partiellement aveugle (comme aujourd'hui).

**PHASE 1 — Sécurité/DB/RLS.** Objectif : fermer les items CRITICAL/HIGH de §7, en particulier vérifier puis, si besoin, ré-appliquer la migration 180 ; fermer les 2 IDOR ; forcer le recalcul serveur de l'IRPP ; fermer `tenants: insert`. Critère de sortie : les 6 CRITICAL de §7 sont tous classés PROVEN CLOSED par preuve directe (pas par lecture de fichier).

**PHASE 2 — Architecture Core.** Objectif : trancher les duplications LOI-A/LOI-B (gateway tenant unique, statut de `universal-payroll-engine.ts` : brancher ou supprimer). Critère de sortie : un seul gateway tenant importé partout.

**PHASE 3 — Comptabilité.** Objectif : recâbler POS/Commerce sur `emit_accounting_event`, migrer les 13+ pages hors `compta-sync-client.ts`. Critère de sortie : 0 écriture directe hors exemption documentée, recherche `VTE-`/`COM-` non vide.

**PHASE 4 — Fiscalité.** Objectif : remplacer le fallback silencieux pays non couvert par une erreur explicite ; confirmer légalement les 6 pays `estimated`/`to_verify` ; décider du sort de l'accise BOI (l'implémenter ou documenter qu'elle est hors périmètre produit).

**PHASE 5 — Paie.** Objectif : unifier l'assiette CNSS des 3 bulletins ; décider du sort de `universal-payroll-engine.ts`.

**PHASE 6 — Achats/Stocks/POS/BOI.** Objectif : reconnecter sorties/pharmacie ; valider puis déployer 183/184 (après Phase 0) ; décider du périmètre réel BOI accise.

**PHASE 7 — Modules métier.** Objectif : élever les modules PARTIAL vers READY module par module, en commençant par ceux à plus fort trafic réel (une fois la Phase 1 close, mesurer le trafic réel avant de prioriser ici — actuellement 2 utilisateurs réels, donc cette phase est moins urgente que 1-6).

**PHASE 8 — Permissions/Billing/Plans.** Objectif : brancher le Permission Engine côté serveur ; généraliser le gating de plan au-delà de MIAA ; construire un vrai Billing Core.

**PHASE 9 — Tests end-to-end.** Objectif : faire tourner les 6 specs Playwright en CI ; ajouter des tests qui exécutent réellement au moins les routes API critiques (pas seulement du grep statique) ; tester RLS sous un rôle non-service_role.

**PHASE 10 — Production/PWA.** Objectif : reproduire le build avec le flag mémoire exact de `vercel.json` pour lever le doute OOM ; nettoyer les 21 tenants test/QA actifs.

**PHASE 11 — UX/UI finale.** Objectif : marquer explicitement (convention de code ou commentaire) quelles pages suivent "Flux A" (direct Supabase) vs "Flux B" (API + service_role), pour empêcher la prolifération silencieuse de nouveaux contournements de Core.

---

## 20. EXIT CRITERIA

- **Sortie de REPAIR vers STABILIZATION** : les 6 CRITICAL de §7 sont fermés par preuve directe (pas par lecture de fichier) ; POS/Commerce émet une écriture comptable ; le statut réel de la migration 180 est connu.
- **Sortie de STABILIZATION vers FINALIZATION** : les 9 HIGH de §7/§16 sont fermés ; un seul gateway tenant ; une seule assiette de paie ; 0 route API critique sans test exécuté (pas seulement statique).
- **Sortie de FINALIZATION vers PRODUCTION_READY** : Playwright tourne en CI et passe ; RLS testée sous un rôle réel non-service_role ; build reproduit avec le flag mémoire Vercel exact et validé ; tenants test/QA isolés d'un environnement de production réelle.

---

## 21. FINAL VERDICT

```
ORAFORME_STATE = REPAIR

REMAINING_CRITICAL = 6
REMAINING_HIGH = 9
REMAINING_MEDIUM = 10
REMAINING_LOW = 7

PRODUCTION_BLOCKERS =
  - IDOR MIAA (tenant_id client, cross-tenant)
  - IDOR /api/jobs/top5 et routes sœurs (PII candidats cross-tenant)
  - POS/Commerce sans aucune écriture comptable
  - IRPP falsifiable côté client (app/api/rh/paie/route.ts)
  - Statut réel de la RLS migration 180 (tenants/journal_entries) indéterminable
  - Gating de plan quasi absent (7/210 routes)
  - Docker Desktop arrêté (bloque toute validation locale réelle)

TOP_10_NEXT_ACTIONS =
  1. Rétablir un canal SQL direct (Docker ou MCP) et vérifier l'état réel de pg_policies pour la migration 180
  2. Fermer l'IDOR MIAA (tenant_id depuis la session serveur, jamais depuis le body client)
  3. Fermer l'IDOR /api/jobs/top5 et routes sœurs
  4. Recâbler POS/Commerce sur emit_accounting_event (nouvel event_type dédié)
  5. Forcer le recalcul serveur de l'IRPP avant toute persistance de bulletin
  6. Fermer la policy "tenants: insert" (validation réelle, pas juste auth.uid() IS NOT NULL)
  7. Unifier les 3 assiettes CNSS des bulletins de paie
  8. Reconnecter stocks/sorties et sante/pharmacie au moteur fn_stock_move officiel
  9. Choisir un seul gateway tenant (tenant-guard.ts vs require-tenant.ts) et migrer l'autre
  10. Isoler ou désactiver les 21 tenants test/QA actifs en production

ESTIMATED_REMAINING_WORK = L

FINAL_RECOMMENDATION =
Ne pas relancer un nouvel audit global avant d'avoir fermé les 6 CRITICAL de la
section 7 — ils sont déjà identifiés avec preuve et chemin de fichier précis,
un nouvel audit n'ajoutera rien, seul le correctif compte désormais. Traiter
la section 16 comme la liste de travail unique des prochaines missions,
dans l'ordre des 10 actions ci-dessus. Chaque correctif doit se terminer par
une preuve directe (requête réelle, pas lecture de fichier) avant d'être
déclaré clos — c'est précisément l'erreur méthodologique qui a fait
dire à tort "migration 180 appliquée" dans un des rapports de cette
session même. Rouvrir Docker (bloqueur infrastructure le plus simple à
lever) débloque à lui seul 3 des 10 actions prioritaires (1, 8 partiellement,
10 de la roadmap Phase 6). Après la fermeture des 6 CRITICAL, repasser en
revue uniquement les 9 HIGH avant tout travail cosmétique ou nouvelle
fonctionnalité — ne pas reprendre le cycle audit→fix→audit sans ce verrou :
une mission qui ne cite pas une preuve directe (requête/exécution, pas une
lecture de fichier) ne doit pas changer le statut d'un item de cette liste.
```

**Protocole de sortie de boucle (section 21 de la mission)** : passer de "réparation" à "finalisation" exige qu'une mission ne se contente plus de re-découvrir ce qui est déjà listé ici, mais cite une preuve d'exécution réelle (requête SQL exécutée, test qui tourne, requête PostgREST contre la prod) pour chaque item qu'elle prétend clore. Une mission qui relit un fichier et conclut "corrigé" sans preuve d'exécution n'a pas le droit de faire changer de colonne un item de la section 16. C'est la règle qui, suivie strictement, empêche le cycle audit→fix→audit de recommencer indéfiniment.

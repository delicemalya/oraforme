# MASTER REPAIR REGISTER — Oraforme

**Source de vérité unique du backlog de réparation.** Construit le 2026-09-04 (mission R-004),
recoupe `docs/RESTART-AUDIT-AZ.md` (72 anomalies d'origine), `docs/MIGRATION-MAP-AZ.md`,
`docs/REPAIR-LOG.md` (tickets P0-01→05, 177, 178) et les découvertes de
`docs/R003-POST-P0-FORENSIC-VALIDATION.md` (writers, UI dupliquée, automatisations).

**Règle de tenue à jour** : toute nouvelle anomalie découverte, tout correctif appliqué, doit être
reflété ici. Ne jamais faire disparaître une ligne — un statut se met à jour, il ne se supprime pas.
`docs/REPAIR-LOG.md` reste le journal chronologique détaillé (SQL exécuté, contrôles) ; ce fichier
est l'index transversal par anomalie.

**Statuts autorisés** : `OPEN` · `IN_PROGRESS` · `CODE_FIXED` · `PRODUCTION_PENDING` · `VERIFIED` ·
`CLOSED` · `NOT_REPRODUCIBLE` · `OBSOLETE`.

**Correction méthodologique importante (2026-09-04)** : `docs/R003-POST-P0-FORENSIC-VALIDATION.md`
§8 affirmait que seules 5 des 72 anomalies d'origine avaient un ticket qui les couvre. C'était
**faux** — R-003 avait lu `REPAIR-LOG.md` sans grep-er le dépôt lui-même pour les citations
`ANO-xxx` dans le code et les migrations. La mission R-004 a corrigé cette erreur (§F ci-dessous) :
8 commits supplémentaires, mergés le 2026-09-04 dans la même PR #1 mais jamais documentés dans
REPAIR-LOG, corrigent en réalité 7 des 10 anomalies critiques. Le tableau ci-dessous reflète l'état
corrigé.

---

## Table 1 — Les 72 anomalies d'origine (`docs/RESTART-AUDIT-AZ.md`)

### 🔴 Critiques (10)

| ID | Domaine | Gravité | Cause racine | Fix | Tests | Production | Preuve | Statut | Dépendances |
|---|---|---|---|---|---|---|---|---|---|
| ANO-C01 | Sécurité | Critique | 10 endpoints d'automatisation sans authentification | `lib/api/require-automation.ts`, commit `f0d43f2` | Aucun test unitaire dédié | 15/15 routes testées en HTTP réel (401 confirmé) — présence de `CRON_SECRET` sur Vercel non vérifiable de l'extérieur | R003 §5 ; `require-automation.ts:6` cite ANO-C01 | **PRODUCTION_PENDING** | R004-DB-TRIGGER-TRANSACTIONS (aucune) |
| ANO-C02 | Facturation | Critique | `facture_lignes` inexistante ; `factures` sans 9 colonnes | Migration 172, commit `b8913a4` | Aucun | Présence de schéma confirmée (diagnostic P0-05) ; aucune facture réelle testée depuis | `172_facturation_v2_completion.sql:1` cite ANO-C02 | **CODE_FIXED** | — |
| ANO-C03 | Stock | Critique | `products.stock_actuel` inexistante | Migration 173, commits `0ac4e95`/`857b451` | `lib/architecture/stock-source-unique.test.ts` | Présence de schéma confirmée ; aucun test transactionnel réel | `173_stock_source_unique.sql:1` cite ANO-C03 | **CODE_FIXED** | — |
| ANO-C04 | Tenant/Auth | Critique | Escalade de privilège `profiles.role` (WITH CHECK incomplet) | Migration 171, commit `92c8d4e` | Aucun | Non confirmée spécifiquement (pas de marqueur dédié au diagnostic P0-05) | `171_fix_privilege_escalation.sql:1,47-75` cite ANO-C04 | **CODE_FIXED** | — |
| ANO-C05 | Sécurité | Critique | IDOR `/api/miaa/notifications` (tenant_id en query) | Commit `f0d43f2` | Aucun | Déploiement confirmé ; endpoint non testé spécifiquement | `app/api/miaa/notifications/route.ts:14-20` | **CODE_FIXED** | — |
| ANO-C06 | Sécurité | Critique | IDOR `/api/resto/receipt/[commandeId]` | Commit `f0d43f2` | Aucun | Déploiement confirmé ; non testé spécifiquement | `app/api/resto/receipt/[commandeId]/route.ts:12-33` | **CODE_FIXED** | — |
| ANO-C07 | Sécurité | Critique→Majeure | `/api/debug/db-check` écrit en GET sans contrôle de rôle | Fichier supprimé, commit `f0d43f2` | — | Suppression = fait binaire | `REPAIR-LOG.md:818` | **VERIFIED** | — |
| ANO-C08 | Comptabilité | Critique | 336/771 événements en erreur, trésorerie fantôme | Migrations 175+176 (P0-04) | 28 cas (forme statique), 115/115 ré-exécutés | **Table de contrôle réelle chiffrée : 0/771 en erreur** | `REPAIR-LOG.md` §"Résultat de 176" | **VERIFIED** | 178 (ventilation soldes) |
| ANO-C09 | Comptabilité | Critique | Grand Livre 400, Balance 22008 sur 5 mois/12 | P0-02, commit `c209869` | 39+27 cas, tous ré-exécutés réellement | Contrôle SQL **en attente** (Bloc 2 de R-004) | R003 §1/§2 | **CODE_FIXED** | NEW-05 (UI dupliquée) |
| ANO-C10 | Fiscalité | Critique | TUS abrogée facturée 4,5%, AF sous-plafonnée, CNSS faux | P0-01, commit `7025c03` | 18+8+1 cas, tous ré-exécutés réellement | Aucune (nature calculatoire, pas d'artefact stocké) | R003 §1 | **CODE_FIXED** | — |

### 🟠 Majeures (36)

| ID | Domaine | Gravité | Cause racine | Fix | Tests | Production | Preuve | Statut | Dépendances |
|---|---|---|---|---|---|---|---|---|---|
| ANO-M01 | Archi/Qualité | Majeure | Aucun CI sur `main` | `.github/workflows/ci.yml`+`semgrep.yml`, commit `0bcfa10` | CI elle-même | Mergée sur main ; fiabilité en continu non vérifiée | `git ls-files` | **CODE_FIXED** | — |
| ANO-M02 | Archi/Qualité | Majeure | `ignoreBuildErrors: true` sans CI pour compenser | Aucun (flag inchangé) ; mitigé indirectement par M01 | — | — | `next.config.ts:10` | **OPEN** | ANO-M01 |
| ANO-M03 | Tenant/Auth | Majeure | BUSINESS obtient le niveau N3 | Aucun | — | — | `lib/plan-access.ts:123-126` | **OPEN** | — |
| ANO-M04 | Tenant/Auth | Majeure | `taille=null` ouvre tout Business | Migration 155 (P0-05 bloc A) | — | **Chiffrée réelle** (tpe=8/pme=10/grande=8) | `REPAIR-LOG.md:769` | **VERIFIED** (donnée) / OPEN (code fail-open latent, cf. N18) | ANO-N18 |
| ANO-M05 | Sécurité | Majeure | Aucune validation d'entrée (zod/yup/joi absents) | Aucun | — | — | `package.json` | **OPEN** | — |
| ANO-M06 | Sécurité | Majeure | Aucun header de sécurité | Aucun | — | — | `next.config.ts` | **OPEN** | — |
| ANO-M07 | Sécurité | Majeure | Rate limiting 14/212 routes | Aucun (sur son périmètre propre) | — | — | grep ce jour | **OPEN** | — |
| ANO-M08 | Fiscalité | Majeure | 23 calculateurs fiscaux, 2 taux TVA | Aucun | — | — | `finance/page.tsx` `*0.18` | **OPEN** | — |
| ANO-M09 | Archi/Qualité | Majeure | 11 erreurs ESLint bloquantes | `eslint-suppressions.json`, commit `0bcfa10` — dette suppressée et trackée, pas corrigée | — | — | violations toujours présentes dans le code | **OPEN** | — |
| ANO-M10 | Comptabilité | Majeure | Double écriture sans transaction (`compta-sync-client.ts`) | Aucun | — | — | `lib/compta-sync-client.ts:138,157` | **OPEN** | R004-CAISSE-DUPLICATE-WRITER |
| ANO-M11 | Comptabilité | Majeure | `writeComptaEntry` force `tva:0,ca:0` | Aucun | — | — | `lib/compta-sync-client.ts:144-145` | **OPEN** | — |
| ANO-M12 | Comptabilité | Majeure | Mappings de comptes OHADA contradictoires | Aucun | — | — | non re-vérifié cette session | **OPEN** | — |
| ANO-M13 | Intégration | Majeure | `dispatchWebhookEvent` — 0 appelant | Aucun | — | — | grep ce jour | **OPEN** | — |
| ANO-M14 | Billing | Majeure | Facturation SaaS n'écrit rien | Aucun | — | — | non vérifié cette session | **OPEN** | — |
| ANO-M15 | Notifications | Majeure | Canal Realtime non cloisonné tenant | Aucun | — | — | `NotificationsPanel.tsx:102` | **OPEN** | — |
| ANO-M16 | Archi/Data | Majeure | 9 tables référencées absentes | 1/9 (`facture_lignes`, `b8913a4`) | — | — | `ls supabase/migrations` | **OPEN** (1/9 corrigé) | — |
| ANO-M17 | Archi/Data | Majeure | 31 tables référencées par pages, absentes | Partiel (stock/achats via 173/174) | — | — | non quantifié | **OPEN** | — |
| ANO-M18 | Archi | Majeure | 2 routes API appelées inexistantes | Aucun | — | — | non vérifié cette session | **OPEN** | — |
| ANO-M19 | Tenant/Auth | Majeure | 6 colonnes fantômes sur `tenants` | Aucun | — | — | grep migrations 17x | **OPEN** | — |
| ANO-M20 | Comptabilité | Majeure | `lib/audit/engine.ts` lève "NIU absent" systématique | Aucun (dépend de M19) | — | — | — | **OPEN** | ANO-M19 |
| ANO-M21 | Tenant/Auth | Majeure | 72 routes sur `tenant-guard.ts` `@deprecated` | Aucun | — | — | `lib/tenant-guard.ts:2` | **OPEN** | — |
| ANO-M22 | PWA | Majeure | Mode hors ligne mensonger | Aucun | — | — | non vérifié cette session | **OPEN** | — |
| ANO-M23 | Billing | Majeure | Grandfather Policy inexistante | Aucun | — | — | `lib/plans.ts:36` | **OPEN** | — |
| ANO-M24 | Billing | Majeure | `capability_level` calculé puis jeté | Aucun | — | — | `TenantProfileFactory.ts:28,82` | **OPEN** | — |
| ANO-M25 | Tenant/Auth | Majeure | `/api/modules/toggle` sans contrôle de plan | Aucun | — | — | non vérifié cette session | **OPEN** | — |
| ANO-M26 | Sécurité | Majeure | Rejeu Sentry non masqué (paie, données perso) | `sentry.client.config.ts`, commit `f0d43f2` | — | Déploiement confirmé ; SDK non initialisé au runtime de toute façon | `sentry.client.config.ts:16-18` | **CODE_FIXED** | — |
| ANO-M27 | Fiscalité | Majeure | 5 taux fiscaux devinés (GA/GQ/RCA/TD) | Mitigation partielle (P0-01 bloque la déclaration CNSS) | — | — | `REPAIR-LOG.md` §Non couvert P0-01 | **OPEN** (mitigation partielle) | ANO-C10 — décision métier bloquée, ne jamais trancher seul |
| ANO-M28 | Sécurité/Compta | Majeure | `as any` sur 13 fichiers dont balance/grand-livre | Aucun | — | — | `balance/route.ts:15`, `grand-livre/route.ts:20` | **OPEN** | — |
| ANO-M29 | Archi | Majeure | Code mort (14/76 composants, 8 modules) | Aucun | — | — | non vérifié cette session | **OPEN** | — |
| ANO-M30 | Archi | Majeure | Barrel `lib/erp-core/index.ts` 0 importeur | Aucun | — | — | non vérifié cette session | **OPEN** | — |
| ANO-M31 | Paie | Majeure | Route acompte la moins sécurisée utilisée par l'UI | Aucun | — | — | non vérifié cette session | **OPEN** | — |
| ANO-M32 | Archi | Majeure | Deux arborescences Recrutement parallèles | Aucun | — | — | non vérifié cette session | **OPEN** | — |
| ANO-M33 | Archi | Majeure | 14 implémentations formatage monétaire | Aucun | — | — | non vérifié cette session | **OPEN** | — |
| ANO-M34 | Fiscalité | Majeure | `lib/fiscalite-congo.ts` legacy alimente facturation | Aucun | — | — | non vérifié cette session | **OPEN** | — |
| ANO-M35 | Archi | Majeure | 5 dépendances jamais importées | Aucun | — | — | non vérifié cette session | **OPEN** | — |
| ANO-M36 | Sécurité | Majeure | `xlsx@0.18.5` vulnérable, upload utilisateur | Aucun | — | — | `package.json:46` | **OPEN** | — |

### 🟡 Normales (21)

| ID | Domaine | Gravité | Cause racine | Fix | Production | Preuve | Statut | Dépendances |
|---|---|---|---|---|---|---|---|---|
| ANO-N01 | Sécurité | Normale | `chart_of_accounts` lisible anonyme | Aucun | Non revérifié | — | **OPEN** | — |
| ANO-N02 | Sécurité | Normale | `fn_accounting_health_check` exécutable anonyme | Aucun | — | — | **OPEN** | — |
| ANO-N03 | Sécurité | Normale | `SUPER_ADMIN_EMAILS` en dur, dupliqué | Aucun | — | `proxy.ts:49`, `admin-config.ts:3` | **OPEN** | — |
| ANO-N04 | PWA | Normale | `manifest.json` sans id/scope | Aucun | — | non vérifié cette session | **OPEN** | — |
| ANO-N05 | PWA | Normale | Page hors ligne SW inatteignable | Aucun | — | non vérifié cette session | **OPEN** | — |
| ANO-N06 | UI/UX | Normale | 22 pages table sans overflow-x-auto | Aucun | — | non vérifié cette session | **OPEN** | — |
| ANO-N07 | PWA | Normale | Pas de viewport-fit=cover | Aucun | — | non vérifié cette session | **OPEN** | — |
| ANO-N08 | Intégration | Normale | Webhook WhatsApp exige une session | Aucun | — | `proxy.ts` | **OPEN** | — |
| ANO-N09 | Sécurité | Normale | `/sentry-example-page` publique | Aucun | — | `proxy.ts:14` | **OPEN** | — |
| ANO-N10 | Archi | Normale | Deux buckets Storage pour le logo | Aucun | — | non vérifié cette session | **OPEN** | — |
| ANO-N11 | UI/UX | Normale | KPI figés à '—' (agriculture/banque) | Aucun | — | non vérifié cette session | **OPEN** | — |
| ANO-N12 | Tenant/Auth | Normale | localStorage non purgé à la déconnexion | Aucun | — | non vérifié cette session | **OPEN** | — |
| ANO-N13 | Sécurité | Normale | Interpolation non échappée `.or()` santé | Aucun | — | non vérifié cette session | **OPEN** | — |
| ANO-N14 | Archi/Doc | Normale | Registre LOI-O erroné | Aucun | — | non vérifié cette session | **OPEN** | — |
| ANO-N15 | Archi | Normale | Numérotation migrations incohérente | Aucun | — | `ls supabase/migrations` | **OPEN** | — |
| ANO-N16 | Archi | Normale | Fichier `NUL` à la racine | Nettoyage implicite, commits `d3f9930`/`8bcaa76` | Fait binaire vérifié (`ls NUL` absent) | `git status` propre | **OBSOLETE** | — |
| ANO-N17 | Archi | Normale | Collision `lib/erp-core.ts` / `lib/erp-core/` | Aucun | — | `ls -la lib/erp-core.ts` | **OPEN** | — |
| ANO-N18 | Tenant/Auth | Normale | `feature-access.ts` fail-open vs `plan-access.ts` fail-closed | Aucun direct ; cas déclencheur fermé indirectement par M04/155 | — | contradiction de code toujours présente | **OPEN** (mitigation indirecte) | ANO-M04 |
| ANO-N19 | Archi | Normale | Deux libs Excel + trois chaînes PDF | Aucun | — | `package.json:46` | **OPEN** | — |
| ANO-N20 | Prod/Ops | Normale | 30/38 scripts, 6/12 tests non versionnés | Commits `d3f9930`/`acb6d0c` | Fait binaire vérifié (38/38, 12/12) | `git ls-files` | **CODE_FIXED** | — |
| ANO-N21 | Archi | Normale | `@types/qrcode` en dependencies | Aucun | — | `package.json:32` | **OPEN** | — |

### 🟢 Production (5)

| ID | Domaine | Gravité | Cause racine | Fix | Production | Preuve | Statut | Dépendances |
|---|---|---|---|---|---|---|---|---|
| ANO-P01 | Prod/Ops | Production | `oraforme.com` ne résout vers rien | Aucun | Vérifié négativement ce jour (DNS toujours cassé) | `nslookup oraforme.com` | **OPEN** | — |
| ANO-P02 | PWA | Production | SW/manifeste/robots.txt redirigés vers /login | Aucun | — | `proxy.ts:174-179` | **OPEN** | — |
| ANO-P03 | Prod/Ops | Production | Aucun environnement de recette | Aucun | Vérifié négativement ce jour | `.env.local` = projet prod | **OPEN** | Bloque la validation de la migration 168 |
| ANO-P04 | Prod/Ops | Production | Fichiers critiques non versionnés (CI, Playwright, tests) | Commits `0bcfa10`/`d3f9930`/`acb6d0c`/`61897f2`/`8bcaa76` | Fait binaire vérifié (`git ls-files`) | — | **VERIFIED** | — |
| ANO-P05 | Prod/Ops | Production | Pollution du dépôt (93 fichiers non suivis) | Commits `8bcaa76`/`d3f9930` — committés plutôt que supprimés | `git status --porcelain` → 0 | — | **CODE_FIXED** | Nature du correctif divergente de la recommandation d'origine (retrait), notée |

**⚠️ Note sur `ANO-P04`** : `REPAIR-LOG.md:731` cite à tort « ANO-P04 » pour désigner le ticket
P0-05 (migrations non appliquées), qui est en réalité `CR-1`/`§G` de RESTART-AUDIT-AZ, pas
`ANO-P04`. Le vrai correctif d'ANO-P04 (fichiers non versionnés) se trouve dans les 5 commits
ci-dessus, jamais documentés comme tel dans REPAIR-LOG. Collision d'identifiant déjà repérée par
R-003 §8, confirmée et localisée ici.

---

## Table 2 — Découvertes hors des 72 anomalies d'origine (R-003 / R-004)

| ID | Origine | Domaine | Gravité | Cause racine | Fix | Tests | Production | Preuve | Statut | Dépendances |
|---|---|---|---|---|---|---|---|---|---|---|
| NEW-01 | R-003 §9 | Comptabilité | Majeure | `writeComptaEntry()` (exemption EXM-JE-003) + trigger `trg_caisse_operation` (migration 046, jamais droppé) écrivent chacun pour la même opération de caisse | Aucun — voir R004-CAISSE-DUPLICATE-WRITER | Aucun | État réel des 2 writers **en attente** (Bloc SQL 1 de R-004) | `app/dashboard/tresorerie/caisses/page.tsx:87-105`, `046:542-587` | **OPEN** | R004-CAISSE-DUPLICATE-WRITER |
| NEW-02 | R-003 §9 | Comptabilité | Majeure | `trg_auto_journal_entry`/`trg_transaction_to_journal` (migrations 026/027) jamais droppés dans le dépôt malgré la promesse de REPAIR-LOG (« migration 177 alignera le dépôt ») — vérifié faux, 177 ne traite que les achats | Aucun — voir R004-DB-TRIGGER-TRANSACTIONS | Aucun | État réel **en attente** (Bloc SQL 1) ; diagnostic du 2026-09-02 (jamais re-vérifié) affirmait ces triggers absents en prod | `supabase/migrations/177_repair_achats_legacy_doublons.sql` (relu intégralement, aucun DROP TRIGGER) | **OPEN** | R004-DB-TRIGGER-TRANSACTIONS |
| NEW-03 | R-003 §9 | Trésorerie | Majeure | Scission de schéma Mobile Money : `wallets`/`wallet_operations` (UI) vs `mobile_money_wallets`/`mobile_wallet_operations` (moteur/API), aucun lien | Aucun | Aucun | Non vérifié | `app/dashboard/tresorerie/mobile-money/page.tsx` vs `app/api/tresorerie/wallets/**` | **OPEN** | — |
| NEW-04 | R-003 §4/§9 | Trésorerie | Moyenne | `comptes_bancaires.solde` modifié par arithmétique cliente (pages UI) en concurrence avec le recalcul absolu du moteur (`fn_sync_tresorerie_soldes`), y compris potentiellement sur le compte principal — migration 178 réduit le scope, n'élimine pas la concurrence | Partiel (178) | Aucun | Preuve mathématique généralisée **en attente** (Bloc SQL 4) | `banques/page.tsx:352`, `transferts/page.tsx:207-218` | **OPEN** | R004-TREASURY-VERIFICATION |
| NEW-05 | R-003 §2 | Comptabilité | Moyenne | Pages UI `/dashboard/comptabilite/{balance,grand-livre,bilan}` dupliquent la logique corrigée par P0-02 sans la réutiliser (requête client sans filtre de date SQL par mois — jamais exposées au bug -31, mais non couvertes par les 39+27 tests) | Aucun | Aucun (0 test sur ce chemin) | Non applicable (jamais exposées au bug d'origine) | `app/dashboard/comptabilite/balance/page.tsx:48-100` | **OPEN** | ANO-C09 |

---

## Table 3 — Tickets P0/résidus déjà en cours de suivi (REPAIR-LOG)

| ID | Domaine | Statut | Preuve | Dépendances |
|---|---|---|---|---|
| P0-01 | Fiscalité | CODE_FIXED | 186/186 tests réels, 0 preuve prod | ANO-C10 |
| P0-02 | Comptabilité | CODE_FIXED | 39+27 tests réels, contrôle SQL en attente (Bloc 2) | ANO-C09, NEW-05 |
| P0-03 | Paie | CODE_FIXED | 186/186 tests réels, contrôle SQL en attente (Bloc 3) | — |
| P0-04 | Comptabilité | VERIFIED (cœur) / CODE_FIXED (ventilation soldes) | Table de contrôle réelle 0/771 erreurs | ANO-C08, 178 |
| P0-05 | Infrastructure | VERIFIED (7 migrations) / OPEN (168) | Tables de contrôle réelles chiffrées | Migration 168 |
| 177 (TRIGGERS HÉRITÉS ACHATS) | Comptabilité | CLOSED (historique) / PRODUCTION_PENDING (idempotence généralisée) | Contrôle réel 0 restant, 48 archivés | Bloc SQL 4 |
| 178 (VENTILATION TRÉSORERIE) | Trésorerie | CLOSED (historique AMD FINANCE) / PRODUCTION_PENDING (généralisation) | Contrôle réel conforme | R004-TREASURY-VERIFICATION, Bloc SQL 4 |
| 168 | Sécurité (RLS) | OPEN | Aucune — jamais appliquée en prod | ANO-P03 (pas de recette pour valider) |
| CRON/AUTOMATION_SECRET | Automatisation | PRODUCTION_PENDING | 15/15 routes HTTP réel = 401 ; secret non confirmable de l'extérieur | ANO-C01 |
| ACH-002 | Comptabilité | NOT_TESTABLE — NO PRODUCTION DATA | 0 achat payé en prod | R004-ACH-002-UNTESTABLE |

---

## Table 4 — Nouveaux tickets créés par la mission R-004

Voir `docs/REPAIR-LOG.md` pour le détail complet de chacun (cause racine, mécanisme exact,
diagnostic SQL fourni). Résumé :

| ID | Titre | Statut | Diagnostic | Dépendances |
|---|---|---|---|---|
| R004-DB-TRIGGER-TRANSACTIONS | Triggers legacy jamais droppés sur `transactions` (`trg_auto_journal_entry`, `trg_transaction_to_journal`) — promesse REPAIR-LOG non tenue par la migration 177 | OPEN | Bloc SQL 1 (R-004), en attente | NEW-02 |
| R004-CAISSE-DUPLICATE-WRITER | Double écriture confirmée au niveau code sur `caisse_operations` (trigger `trg_caisse_operation` + `writeComptaEntry()`) | OPEN | Bloc SQL 1 (R-004), en attente | NEW-01, ANO-M10 |
| R004-TREASURY-VERIFICATION | Généralisation de la preuve mathématique du correctif 178 (multi-tenant, 1/2/3 comptes, nouveau compte, transfert) — le correctif historique AMD FINANCE est déjà `CLOSED`, ce ticket suit uniquement la vérification élargie | OPEN | Bloc SQL 4 (R-004), en attente | 178, NEW-04 |
| R004-ACH-002-UNTESTABLE | Suivi formel du statut `NOT_TESTABLE — NO PRODUCTION DATA` d'ACH-002 (0 achat payé en production) ; test isolé sur tenant jetable préparé | NOT_TESTABLE — NO PRODUCTION DATA | Bloc SQL 4 (R-004), en attente ; se lèvera naturellement au premier achat réellement payé en production | — |

---

## Compteurs de contrôle (§9 de la mission R-004)

| Compteur | Valeur |
|---|---|
| Anomalies originales (RESTART-AUDIT-AZ) | **72** |
| — dont fermées avec preuve réelle (`VERIFIED`/`CLOSED`) | **4** (ANO-C07, ANO-C08, ANO-M04, ANO-P04) |
| — dont corrigées mais non vérifiées en production (`CODE_FIXED`) | **11** |
| — dont en attente de vérification production (`PRODUCTION_PENDING`) | **1** (ANO-C01) |
| — dont obsolètes (`OBSOLETE`) | **1** (ANO-N16) |
| — dont encore ouvertes (`OPEN`) | **55** |
| Total (contrôle) | 4+11+1+1+55 = **72** ✓ |
| Nouveaux problèmes découverts (hors des 72, Tables 2+4) | **9** (NEW-01→05, R004-xx ×4) |
| Tickets P0/résidus en cours de suivi (Table 3, hors doublon avec Table 1) | **10** entrées de suivi (P0-01→05, 177, 178, 168, CRON/AUTOMATION_SECRET, ACH-002) |
| **Total réel restant à traiter (`OPEN`+`PRODUCTION_PENDING`, tables 1+2+4)** | **55 + 1 + 5 + 4 = 65** |

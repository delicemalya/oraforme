# R-003 — Post-P0 Forensic Validation

Mission de **vérification uniquement**. Aucune nouvelle fonctionnalité, aucun P1, aucune nouvelle
architecture n'a été entamé ici. Cette mission audite les corrections P0-01 à P0-05 (mission
R-002, mergées dans `main` le 2026-09-04, commit `9636883`) ainsi que les tickets « triggers
hérités achats » (migration 177) et « ventilation trésorerie » (migration 178) traités le même
jour, hors du périmètre initial de la mission R-002.

**Règle appliquée dans tout ce document** : un commit n'est jamais une preuve de comportement.
Un test unitaire prouve le comportement du **code**, pas de la **production**. Seul un résultat de
requête réellement exécuté contre la base de production (ou un test isolé sur tenant jetable,
`ROLLBACK` en fin de script) constitue une preuve de production. « TypeScript passe » / « le build
passe » / « Vitest est vert » ne justifient jamais à eux seuls le statut `VERIFIED`.

**Statuts utilisés** : `OPEN` · `CODE_FIXED` · `PRODUCTION_PENDING` · `VERIFIED` · `CLOSED` ·
`NOT_TESTABLE`.

**État de ce document au moment de sa rédaction (2026-09-04)** : trois blocs SQL ont été remis à
l'utilisateur pour exécution en production (contrôles P0-02, P0-03, et test sur tenants isolés
pour §3/§4/§6) — leurs résultats ne sont **pas encore disponibles** au moment de la première
version de ce fichier. Les sections concernées sont marquées « EN ATTENTE » et seront mises à
jour dans une révision ultérieure du même fichier dès réception des résultats.

---

## 0. Périmètre et méthode

- Audit de code : lecture intégrale de `docs/REPAIR-LOG.md`, `docs/RESTART-AUDIT-AZ.md`,
  `docs/MIGRATION-MAP-AZ.md`, des commits cités (hash vérifiés un par un via `git show`), et des
  fichiers de test associés — **réellement ré-exécutés** (`npx vitest run`), pas relus comme
  affirmation.
- Audit de production réel effectué directement depuis cette session (sans intervention
  utilisateur) :
  - 15/15 routes d'automatisation testées en HTTP réel contre `https://oraforme.vercel.app`
    (§5).
  - Déploiement de production vérifié via l'API GitHub Commit Status (§10).
  - Tests unitaires `lib/erp-core/compute/accounting.test.ts` ré-exécutés en direct (§2).
- Audit de production nécessitant l'exécution de SQL en base par l'utilisateur (accès direct à
  Postgres/Supabase indisponible depuis cette session — MCP `postgres`/`supabase`/
  `supabase-moonbank` en échec de connexion tout au long de la session) : §2 (RLS), §3, §4, §6.
- Quatre audits de code ont été délégués à des agents en lecture seule (aucune modification de
  fichier) : P0-01/02/03, P0-04/05, migration 168 + backlog, audit des writers. Leurs constats
  sont repris ici, condensés mais fidèles, avec citation systématique fichier:ligne ou
  commit.

---

## 1. Audit des P0-01 → P0-05

### P0-01 — Documents fiscaux incorrects

**Anomalie originale** — Six chaînes de génération de documents opposables contenaient des
constantes fiscales locales au lieu de lire `lib/countries/`/`lib/fiscal/universal-tax-engine.ts` :
TUS liquidée à 4,5 % alors qu'abrogée par la LF 2026 ; `factures.tva` (colonne de **montant**
depuis la migration 160) relue comme un **taux** (erreur ×100) ; allocations familiales assises
sur le plafond AT/MP (600 000 F) au lieu de leur plafond propre (1 200 000 F) ; en-têtes PDF CNSS
à 5,04 %/14,36 % sans aucun calcul ; `support_declarations_cnss` jamais lu (document généré pour
des pays où il vaut `false`).

**Cause racine** — Trois réimplémentations indépendantes des mêmes constantes fiscales au lieu
d'un moteur canonique unique.

**Fichiers modifiés** — Commit `7025c03`, 20 fichiers, +1137/-174. Détail complet : `lib/countries/CG.ts`
(+45), `lib/countries/types.ts` (+49), `lib/fiscal/universal-tax-engine.ts` (+102),
`lib/declarations/cnss-congo.ts` (240 lignes touchées), `lib/declarations/declaration-generale.ts`
(60 lignes), `lib/declarations/patente.ts` (86 lignes), 5 composants PDF/pages RH (26 à 44 lignes
chacun), + 3 fichiers de test nouveaux (`cnss-congo.test.ts` +134, `taxes-abrogees.test.ts` +62,
`documents-fiscaux.test.ts` +125).

**Comportement avant/après** — Allocations familiales 60 180 F → 120 420 F pour un salarié à
1 500 000 F brut ; TUS fiscale 4,5 % → 0 % sur 2026 (inchangée sur 2025, rétroactivité correcte) ;
`NOT_CONFIGURED` renvoyé explicitement pour les pays non supportés au lieu d'un document généré à
tort.

**Tests ajoutés** — 18 + 8 cas unitaires + 1 scanner d'architecture statique.

**Tests exécutés** — Réellement relancés pendant cet audit : inclus dans un lot de 186 tests / 8
fichiers, tous verts (voir détail méthode en tête de section).

**Preuve production** — **AUCUNE.** `docs/REPAIR-LOG.md` l'affirme lui-même en section
« Non couvert » : correction pure calcul, sans migration, contrôle en conditions réelles jamais
fait. Il n'existe par ailleurs **aucun artefact stocké** en base qui refléterait le calcul erroné
(documents générés à la volée) — une preuve de production nécessiterait soit de générer un vrai
document via l'UI en conditions réelles (hors périmètre SQL de cette session), soit de relire
`declarations_cnss_lignes` existantes et de recalculer manuellement avec la formule corrigée. Non
fait par manque d'accès DB direct.

**Statut : CODE_FIXED.** (Tests réels verts, zéro preuve de production, aucune vérification SQL
possible pour cette anomalie précise — nature calculatoire sans artefact stocké.)

### P0-02 — Grand Livre et Balance (ERP Core comptabilité)

**Anomalie originale** — `GET /api/comptabilite/grand-livre` → 400 (`journal_entries.reference`
n'existe pas) ; `GET /api/comptabilite/balance` → 22008 sur 5 mois/12 (février, avril, juin,
septembre, novembre — construction de date par concaténation `${year}-${month}-31`).

**Cause racine** — Contrat `JournalLedgerRow` nommait deux colonnes inexistantes (`reference`,
`journal_type`) au lieu de la colonne réelle `piece_number` (seule écrite par
`emit_accounting_event`, migration 065/138:735). Défaut invisible car aucun appelant n'utilisait
ces deux routes et `const db = supabaseAdmin as any` supprimait toute vérification de colonne à la
compilation.

**Fichiers modifiés** — Commit `c209869`, 5 fichiers, +601/-9. `lib/erp-core/compute/accounting.ts`
(+53, ajout de `periodeMensuelle()`), `app/api/comptabilite/balance/route.ts` (+21, intervalle
semi-ouvert `gte`/`lt` au lieu de `.lte('-31')`), 2 fichiers de test nouveaux (+258 et +121).

**Tests ajoutés/exécutés** — `lib/erp-core/compute/accounting.test.ts` (39 cas) **ré-exécuté
directement par cette session** : `npx vitest run lib/erp-core/compute/accounting.test.ts` →
**39/39 passés**, incluant explicitement les 5 mois cassés (`it('les cinq mois qui n'ont pas de 31
produisent une date valide')`, ligne 54-62), le mois avec 0 écriture (ligne 155), le mois avec
écritures (ligne 165), la référence de pièce jusqu'au mouvement affiché (ligne 211-214).
`lib/architecture/erp-core-comptabilite.test.ts` (27 cas) ré-exécuté par l'agent d'audit, inclus
dans le lot global 186/186.

**Ancienne logique en parallèle — trouvaille propre à cette session** :
`grep` sur `app/` confirme que `fn_balance_generale`/`fn_compte_resultat`/`fn_bilan` (fonctions
Postgres legacy, migration 044) ne sont appelées **nulle part** dans le code applicatif — la
logique JS (`computeBalance`/`computeGrandLivre`) est la seule utilisée par les **routes API**
(`app/api/comptabilite/balance/route.ts`, `grand-livre/route.ts`, `app/api/fiscalite/tva/route.ts`).

**Mais** : les **pages UI** réellement vues par les utilisateurs —
`app/dashboard/comptabilite/balance/page.tsx:48-100`, `grand-livre/page.tsx`, `bilan/page.tsx` —
**n'appellent pas ces routes API** et **ne réutilisent pas** `computeBalance`/`computeGrandLivre`.
Elles font leur propre requête Supabase côté client (`supabase.from('journal_entries').select(...)`,
sans filtre de date SQL par mois — tout le solde annuel est chargé puis filtré en JS avec
`new Date(m.date_operation).getMonth()+1 === periode`) et leur propre agrégation locale
(`balance/page.tsx:80-100`). Conséquence à deux tranchants :
1. Ces pages n'ont **jamais été exposées** au bug `-31` (elles ne construisent aucune date SQL
   par mois), donc P0-02 ne les corrige ni ne les casse.
2. Elles constituent une **deuxième implémentation indépendante et non testée** de la même
   logique métier — c'est exactement « l'ancienne logique utilisée en parallèle » que la mission
   demandait de vérifier. Le correctif P0-02 (et ses 39+27 tests) ne couvre que le chemin API
   (consommé par MIAA), pas le chemin que l'utilisateur humain voit réellement à l'écran.

**Preuve production** — **EN ATTENTE.** Bloc SQL remis à l'utilisateur (§2 ci-dessous) contenant
les deux requêtes de contrôle déjà rédigées dans `docs/REPAIR-LOG.md:288-304` mais **jamais
exécutées** (le journal lui-même l'admet : « Non vérifié […] Le contrôle réel suppose la mise en
ligne de la branche »), plus une requête RLS sur `journal_entries`.

**Statut : CODE_FIXED** pour la logique API corrigée (39/39 tests réels + confirmation qu'aucune
fonction Postgres legacy n'est plus appelée). **OPEN, résidu nouveau non classé** pour la
duplication de logique UI (aucun ticket existant ne le couvre — voir Table finale, ligne
NEW-05).

### P0-03 — Chaîne paie → comptabilité rompue

**Anomalie originale** — Depuis la migration 141 (trigger `trg_bulletins_paie` supprimé,
responsabilité transférée aux routes), la route réellement appelée par l'UI
(`POST /api/paie/bulletins`, `app/dashboard/rh/paie/page.tsx:1512,1555`) n'appelait jamais
`emit_accounting_event` : générer une paie ne produisait **aucune** écriture comptable, alors que
`PROJECT_HEALTH.md:213` certifiait « Paie — Argent définitif ✅ ».

**Cause racine** — La migration 141 a désigné une route (`PATCH /api/rh/paie/[id]`) que personne
n'appelle ; l'UI utilisait une route parallèle créée pour contourner un problème RLS multi-profils,
sans lien avec le moteur comptable.

**Fichiers modifiés** — Commit `2a7065a`, 9 fichiers, +964/-87. `lib/paie/evenements-comptables.ts`
(nouveau, +227, contrat pur bulletin → événements PAI-001/PAI-002), `app/api/paie/bulletins/route.ts`
(+60), `app/api/rh/paie/[id]/route.ts` (70 lignes touchées, erreur RPC remontée en 500 au lieu
d'être ignorée), `app/api/rh/paie/route.ts` (35 lignes, suppression de l'émission PAI-001 à la
création), 2 fichiers de test nouveaux (+249, +206).

**Tests ajoutés/exécutés** — `lib/paie/evenements-comptables.test.ts` (47 cas),
`lib/architecture/chaine-paie-comptabilite.test.ts` (32 cas) — inclus dans le lot 186/186
ré-exécuté par l'audit, tous verts.

**Preuve production** — **EN ATTENTE.** Les 3 requêtes de contrôle rédigées dans
`docs/REPAIR-LOG.md:465-490` (dette héritée, événements PAI émis, `transaction_id` NULL sur
PAI-001) remises à l'utilisateur (§2). Aucune n'a été exécutée avant ce jour selon le journal.

**Statut : CODE_FIXED** (tests réels verts, migration non requise, zéro preuve de production
exécutée après le déploiement du 2026-09-04).

### P0-04 — Événements comptables en erreur et trésorerie fantôme (ANO-C08)

**Anomalie originale** — 336 `accounting_events` en `error` le 2026-06-27 (192 PAI-001, 96
FAC-002 en 23505, 48 ACH-001), 240 sans `error_message`.

**Cause racine** — `fn_ae_execute_event` créait une ligne `transactions` par **module** dès la
constatation (FAC-001) au lieu de la lier à un impact trésorerie réel par **événement** ; le
règlement (FAC-002) échouait ensuite sur la contrainte unique. En parallèle, `scripts/seed-demo-data.ts`
(pointant `.env.local` = production) avait rejoué des événements sur le tenant le plus ancien.

**Fichiers modifiés** — `supabase/migrations/175_treasury_impact_from_rules.sql` (269 lignes,
commit `81f83c1`) : `fn_ae_execute_event` réécrite pour n'accumuler un impact trésorerie que si une
règle réellement appliquée porte `account_resolver` treasury ; `176_repair_p0_04_amd_finance.sql`
(210 lignes, 3 commits) : réparation guardée des données AMD FINANCE. Test ajouté :
`lib/architecture/moteur-tresorerie-regles.test.ts` (28 cas, **test de forme statique du SQL des
migrations, pas d'exécution contre une vraie base**).

**Tests exécutés** — Ré-exécutés par l'audit : 115/115 (3 fichiers). Confirmé : ces tests
vérifient que le texte des migrations correspond à la conception documentée, pas le comportement
réel en production.

**Preuve production** — Table de contrôle **réelle, avec chiffres**, documentée dans
`docs/REPAIR-LOG.md` (§« Résultat de 176 en production ») : ACH-001 48 processed+48 superseded,
FAC-001 192 processed, **FAC-002 96 processed, 0 en erreur**, PAI-001 192 processed+192 superseded,
0 doublon audit↔écritures, 192 transactions archivées. Conclusion officielle : « 0 événement en
`error` ou `dead_letter` sur les 771. » — chiffre recevable, chaîne de preuve avant/après
documentée.

**Statut : VERIFIED** pour la fermeture d'ANO-C08 elle-même (preuve chiffrée réelle). **CODE_FIXED**
pour le volet « trésorerie fantôme » au sens large : les soldes n'étaient **pas** recalculés au
moment de ce contrôle (`fn_sync_tresorerie_soldes` absente en prod à cette date) — résidu traité
séparément par la migration 178 (voir §4).

### P0-05 — Migrations non appliquées en production

**Anomalie originale** — La production n'a jamais été construite par rejeu strict des migrations
du dépôt : 133, 148, 155, 157, 158, 159, 165, 168 absentes ou partiellement appliquées (diagnostic
à 47 marqueurs).

**Fichiers modifiés** — `docs/runbooks/p0-05-bloc-A.sql` (350 lignes) et `p0-05-bloc-B.sql` (360
lignes), assemblés depuis les migrations préexistantes (pas de nouveau code comptable écrit ici —
seul un correctif ponctuel d'apostrophe dans `158_identity_policy_engine.sql`, commit `00491a8`).

**Preuve production** — Deux tables de contrôle réelles avec chiffres exacts :
*Bloc A (2026-09-02)* : 133 (`fn_sync_tresorerie_soldes`/`vue_tresorerie_unifiee` présentes), 148
(5 règles BTP/AGR actives), 155 (NOT NULL+CHECK, répartition tpe=8/pme=10/grande=8), 165 (0
fonction sans `search_path`). *Bloc B (2026-09-03)* : 157/158/159 tables créées et policies
posées, 165 toujours à 0.

**Statut : VERIFIED** pour les 7 migrations effectivement appliquées et contrôlées (133, 148, 155,
157, 158, 159, 165). **OPEN** pour la migration 168 (76 policies) — jamais jouée en production,
voir §7. La cause racine structurelle (absence de garantie d'application systématique des
migrations) reste **non traitée** — ceci est un rattrapage ponctuel, pas une correction du
processus.

---

## 2. Grand Livre / Balance — vérification ciblée

**Fonctionnel (code + tests réels, fait directement par cette session)** :
- `periodeMensuelle()` testée sur les 12 mois, année bissextile, bascule décembre, mois hors
  bornes → **39/39 tests réels passés** (`lib/erp-core/compute/accounting.test.ts`, ré-exécuté ce
  jour). Couvre explicitement janvier, février, avril, juin, septembre, novembre, décembre (les
  intervalles semi-ouverts ne dépendent pas du nombre de jours du mois, donc les 12 mois se
  comportent identiquement — pas de traitement spécial nécessaire).
- Référence de pièce (`piece_number`) portée jusqu'au mouvement affiché — testé (ligne 211-214).
- Mois avec 0 écriture → balance vide et équilibrée (ligne 155-164). Mois avec écritures → exactement
  les comptes du mois (ligne 165-176).
- Ancienne logique Postgres (`fn_balance_generale` etc.) confirmée **non appelée** par le code —
  mais logique UI parallèle et non testée découverte (voir P0-02 ci-dessus, résidu NEW-05).

**Tenant isolation / requête fonctionnelle en production — EN ATTENTE (Bloc SQL 1 remis à
l'utilisateur)** : requêtes `information_schema.columns` (confirmation `piece_number` existe,
`reference`/`journal_type` non), requête multi-mois sur données réelles, et lecture de
`pg_policies` sur `journal_entries` pour confirmer l'isolation RLS structurelle.

**Statut : CODE_FIXED**, en cours d'élévation vers `VERIFIED` sous réserve du retour du Bloc SQL 1.

---

## 3. Migration 177 — Achats (48 doublons journal_entries)

**Rappel du correctif déjà appliqué et vérifié le 2026-09-04** (session précédente, même mission) :
`trg_achat_enregistrement`/`trg_achat_paye` (migrations 044/046) n'existent déjà plus en
production — confirmé par une requête `pg_trigger` (0 ligne). 48 écritures orphelines créées
**avant** leur suppression, en double avec les écritures ACH-001 du moteur, archivées dans
`repair_archive` (repair='ACH-TRG') puis supprimées. Contrôle post-réparation réel : 0 ligne
`achats_enregistrement` restante, 48 archivées, 0 achat avec ≠1 écriture.

**Ce que cette mission ajoute — test d'idempotence sur tenant isolé (EN ATTENTE, Bloc SQL 3)** :
puisque le trigger legacy n'existe plus, il est **structurellement impossible** de reproduire
« AVANT → doublon » avec un nouvel achat (le mécanisme causal a été supprimé, pas seulement ses
effets nettoyés — c'est en soi une preuve plus forte que « le doublon ne se reproduit plus »). Le
test isolé prépare :
- Émission ACH-001 pour un achat de test, puis **ré-émission avec le même `source_id`** (simulateur
  de double appel API/retry réseau) → doit être absorbée par la contrainte unique
  `uidx_ae_inflight` (`ON CONFLICT (tenant_id, event_type, source_table, source_id) WHERE status
  IN ('pending','processing','processed') DO NOTHING`, `supabase/migrations/138:890-893`) — 1 seule
  écriture attendue, pas 2.
- Un **second achat, distinct** → doit produire sa propre écriture unique, indépendante — preuve
  qu'un nouvel achat ne crée jamais deux écritures.
- Tenant de test dédié (pas AMD FINANCE), toute la transaction annulée par `ROLLBACK` en fin de
  script — zéro donnée réelle touchée.

**Statut : CLOSED** pour l'incident historique (48 doublons, preuve chiffrée réelle). Le statut du
test d'idempotence structurel (nouveau tenant) reste `PRODUCTION_PENDING` jusqu'au retour du Bloc
SQL 3.

---

## 4. Migration 178 — Trésorerie (triplement de solde)

**Rappel du correctif déjà appliqué et vérifié le 2026-09-04** : `fn_sync_tresorerie_soldes`
affectait la somme totale des mouvements `521` du tenant à **chaque** ligne `comptes_bancaires` —
aucune notion de compte bancaire précis n'existe dans le moteur
(`fn_ae_resolve_treasury` ne résout qu'un code de classe OHADA générique). AMD FINANCE affichait
314 488 246 F identiques sur ses 3 comptes réels. Correctif : colonne `compte_principal` (un seul
compte suivi par le moteur par tenant), fonction réécrite pour ne toucher que ce compte, backfill
sur tous les tenants. Contrôle réel : BGFI/BOCEC → `principal=false·solde=0`, LCB →
`principal=true·solde=314488246` (recalculé, inchangé).

**Preuve mathématique demandée par cette mission (`solde réel = somme des mouvements`, pas
`solde × nombre de comptes`) — EN ATTENTE (Bloc SQL 3)** : le test sur tenants isolés construit
2 tenants, un compte principal + un secondaire + un nouveau compte (créé après coup, simulant
la limite documentée) pour le tenant A, un compte pour le tenant B avec un montant très différent
(999 999 F) pour détecter toute fuite inter-tenant, puis 3 mouvements (entrée 100 000, sortie
30 000, transfert banque→caisse 20 000) et une resynchronisation. Attendu si le correctif se
comporte comme conçu : compte principal A = 100000-30000-20000 = **50000 exactement** ; compte
secondaire A = **0** (jamais touché) ; nouveau compte A = **0** (limite connue : pas d'auto-désignation
principal pour un compte créé après la migration) ; caisse principale A = **20000** (le transfert
reçu) ; compte B = **999999**, jamais mélangé avec A.

**Statut : CLOSED** pour l'incident historique AMD FINANCE (preuve chiffrée réelle, déjà
contrôlée). `PRODUCTION_PENDING` pour la preuve mathématique généralisée (multi-tenant,
multi-compte, nouveau compte, transfert) jusqu'au retour du Bloc SQL 3.

**Risque résiduel identifié par l'audit des writers (§9)** — le correctif 178 réduit le *scope* du
problème (un seul compte auto-géré par le moteur) mais **ne supprime pas** la concurrence
d'écriture sur `comptes_bancaires.solde` : plusieurs pages dashboard (`banques/page.tsx:352`,
`transferts/page.tsx:207-218`, `decaissements`/`encaissements`) mettent à jour `solde` par
arithmétique cliente, indépendamment du recalcul absolu du moteur, y compris potentiellement sur
le compte principal lui-même. La cause architecturale du bug d'origine (deux écritures concurrentes
sur `solde`) n'est donc que partiellement neutralisée. Voir Table finale, ligne NEW-04.

---

## 5. Automatisations (CRON_SECRET / AUTOMATION_SECRET)

**Test réel effectué directement par cette session, en HTTP contre la production
(`https://oraforme.vercel.app`), pas une lecture de variable** :

| Route | Méthode | Résultat HTTP réel |
|---|---|---|
| `/api/cron/run` | POST | **401** |
| `/api/agents/securite/performance` | GET | **401** |
| `/api/agents/stock/verifier` | GET | **401** |
| `/api/agents/superviseur/rapport` | GET | **401** |
| `/api/agents/securite/backup` | GET | **401** |
| `/api/agents/securite/attaques` | GET | **401** |
| `/api/agents/restaurant/cloture` | GET | **401** |
| `/api/profil/reminders` | POST | **401** |
| `/api/agents/comptable/relances` | GET | **401** |
| `/api/ocr/extract` | POST | **401** |
| `/api/miaa/analyse-quotidienne` | POST | **401** |
| `/api/agents/rh/bulletins` | GET | **401** |
| `/api/miaa/proactif` | GET | **401** |
| `/api/agents/miaa-autonome` | POST | **401** |
| `/api/agents/ecole/impayes` | GET | **401** |

**15/15 routes confirmées** — correspond exactement aux 15 fichiers utilisant
`requireAutomationSecret` (`grep` exhaustif sur `app/api/`). Les 11 routes de `vercel.json` (crons
Vercel) sont un sous-ensemble exact de ces 15 ; les 4 restantes (`cron/run`, `miaa/proactif`,
`agents/miaa-autonome`, `profil/reminders` — non, en fait `ocr/extract`, `miaa/analyse-quotidienne`,
`cron/run`, `profil/reminders` sont les 4 hors `vercel.json`) sont invoquées via Supabase pg_cron
(migration 167, en-tête `x-automation-secret`).

**Limite honnête de ce test** — un **401 sans identifiants ne prouve pas que `CRON_SECRET` est
configuré**. Le code est fail-closed par construction (`lib/api/require-automation.ts:43-57`) :
que la variable soit définie ou totalement absente, une requête sans le bon secret reçoit
toujours 401. Ce test prouve que **le garde est bien déployé et actif en production** (ce n'était
pas garanti avant vérification), mais ne peut pas, depuis l'extérieur et sans le secret lui-même,
confirmer que la variable existe réellement dans Vercel — cette confirmation demande soit un accès
au dashboard Vercel (MCP Vercel en 403 tout au long de cette session, jeton sans portée projet),
soit l'historique d'exécution des Cron Jobs (dernière exécution, statut) que seul le dashboard
expose.

**Divergence de documentation notée** — `lib/api/require-automation.ts:19` affirme
« sinon les **12** tâches planifiées retournent 401 », alors que `vercel.json` en liste **11** et
que 15 routes au total sont gardées. Incohérence mineure de commentaire, sans conséquence
fonctionnelle.

**Statut : PRODUCTION_PENDING.** Le garde est vérifié actif (preuve HTTP réelle). La présence
effective de `CRON_SECRET` sur Vercel — la question posée par la mission — reste à confirmer par
l'utilisateur (dashboard Vercel, historique d'exécution des Cron Jobs). **Ne pas déclarer
`VERIFIED` tant que ce dernier point n'est pas confirmé**, conformément à l'interdiction de la
mission de considérer une variable « présente » comme preuve sans avoir testé le parcours réel —
et ici, le parcours réel testable depuis l'extérieur (401 sans secret) est structurellement
incapable de distinguer les deux états.

---

## 6. ACH-002 — statut obligatoire

**0 achat payé en production à ce jour** (confirmé par le diagnostic du 2026-09-04, section
« Ticket triggers hérités achats » du REPAIR-LOG : `8_volume_achats → achats total · payés : 48 ·
0`). Conformément à l'instruction explicite de la mission :

**Statut : NOT_TESTABLE — NO PRODUCTION DATA.**

Un test isolé et contrôlé a été préparé (Bloc SQL 3, §3 ci-dessus, même script) : marque un achat
de test comme payé, émet ACH-002, vérifie exactement 1 écriture `journal_entries` (401/trésorerie)
et 1 ligne `transactions`, puis **ré-émet ACH-002 une seconde fois** (double clic/retry simulé) et
vérifie que le compte reste à 1 écriture (idempotence par la même contrainte
`uidx_ae_inflight` que pour ACH-001). Tenant isolé, `ROLLBACK` en fin de script — aucune donnée de
production modifiée. Résultat : **EN ATTENTE** du retour du Bloc SQL 3.

Ce test isolé, une fois exécuté, prouvera le comportement du **mécanisme générique** (même
contrainte d'idempotence que ACH-001, déjà vérifiée pour les achats) mais ne remplace pas — et ne
prétend pas remplacer — une preuve avec de vraies données de production : le statut restera
`NOT_TESTABLE` pour la question « ACH-002 fonctionne-t-il correctement en production avec un
achat réel » tant qu'aucun achat n'aura été effectivement marqué payé en conditions réelles.

---

## 7. Migration 168 — Audit préalable (NE PAS APPLIQUER EN PRODUCTION)

**Chiffre exact** : 76 policies mesurées en production le 2026-09-02 (`docs/REPAIR-LOG.md:748`),
contre « ~80 » dans le commentaire d'intention du fichier de migration lui-même
(`168_fix_auth_rls_initplan.sql:1,17,22`) — écart entre l'estimation de conception et la mesure
réelle, sans qu'aucune liste figée des 76 policies ne soit versionnée dans le dépôt (le script les
sélectionne dynamiquement via `pg_policies` à l'exécution).

**Limite de périmètre non documentée** — le script ne filtre que `schemaname = 'public'`
(`168_fix_auth_rls_initplan.sql:54`). Toute policy utilisant `auth.role()`/`auth.uid()` sur le
schéma `storage` (ex. `storage.objects`, cf. `041_storage_logos_bucket.sql:26-32`) reste **hors
périmètre**, alors que l'introduction du fichier (lignes 3-4) affirme couvrir `auth.role()` sans
cette réserve.

**Aucune clause de rollback, aucune requête de validation intégrée** — le seul retour est un
`RAISE NOTICE` texte, pas une table de preuve exportée (contrairement au style `repair_archive`
utilisé en 176-178). Le texte AVANT des policies n'est capturé nulle part — un rollback réel
demanderait de rejouer manuellement 76 `CREATE POLICY` dont l'état d'origine n'est enregistré nulle
part dans le dépôt.

**Aucun test dédié** — grep négatif confirmé sur tout `*.test.ts` pour "168"/"initplan"/"rls" en
lien avec cette migration. Les seuls tests théoriquement pertinents (Playwright,
`tests/certifications/`) pointent en dur sur la production (`RESTART-AUDIT-AZ.md:27-29`) et n'ont
jamais été exécutés.

**Plan de validation en recette préparé** (détail complet dans le rapport de l'agent, repris ici en
condensé) :
1. Snapshot `pg_policies` avant application (`_audit_168_before`), comptage attendu ≈76,
   répartition par table (donnée absente du dépôt, à produire pour la première fois).
2. Après application : comptage des policies encore non encapsulées (attendu 0), diff complet
   avant/après archivable comme preuve.
3. Mesure de performance : le volume actuel (`journal_entries` 1319 lignes, `accounting_events`
   771 lignes) est **trop faible pour un gain mesurable** — nécessite un jeu de données
   synthétique en recette (`generate_series`) pour rendre l'`InitPlan` visible dans
   `EXPLAIN ANALYZE`.
4. Non-régression de l'isolation tenant : rejouer les mêmes requêtes avec deux JWT de tenants
   différents avant/après, comparer des empreintes `md5` des jeux de résultats, et un test de
   fuite croisée explicite (`SELECT count(*) FROM table WHERE tenant_id <> '<tenant_testé>'`,
   attendu 0 avant et après).

**Statut : OPEN** (jamais appliquée en production, aucune tentative, aucune preuve). Ce document
ne recommande **pas** son application immédiate — le plan ci-dessus doit être exécuté en recette
d'abord, et aucun environnement de recette n'a été confirmé exister (voir §8, ANO-P03).

---

## 8. Backlog recalculé — RESTART-AUDIT-AZ + MIGRATION-MAP-AZ + REPAIR-LOG

**Constat central** : sur les **72 anomalies ANO-xxx** de `RESTART-AUDIT-AZ.md` (10 critiques, 36
majeures, 21 normales, 5 production), **seules 5** sont couvertes, même indirectement, par un
ticket de `REPAIR-LOG.md` — et **aucun ticket ne cite l'identifiant ANO-xxx d'origine par son nom**
(chaînage implicite uniquement, par recoupement de contenu) :

| Anomalie d'origine | Ticket REPAIR-LOG | Chaînage explicite dans REPAIR-LOG ? |
|---|---|---|
| ANO-C10 (documents fiscaux) | P0-01 | Non — cite F1/F2/F3/F4/F6/F9 (MIGRATION-MAP-AZ), jamais « ANO-C10 » |
| ANO-C09 (Grand Livre/Balance) | P0-02 | Oui, « ANO-C09 » cité explicitement |
| §6.2 (paie→compta, pas d'ID ANO) | P0-03 | Oui, « §6.2 » cité |
| ANO-C08 (événements en erreur) | P0-04 | Oui, « ANO-C08 » cité explicitement |
| CR-1 / §G (migrations non appliquées) | P0-05 | Oui, « CR-1 / ANO-P04 / §G » cité |

**67 anomalies documentées n'apparaissent nulle part dans REPAIR-LOG**, ni comme fermées ni comme
explicitement laissées ouvertes — dont, en critiques : **ANO-C01** (10 endpoints d'automatisation
anonymes — traité de fait par le déploiement de `require-automation.ts`, mais **aucun ticket ne le
documente formellement**, aucune section Anomalie/Cause/Correction/Test/Preuve comme pour les
P0-0x), **ANO-C02** (`facture_lignes` inexistante), **ANO-C03** (`products.stock_actuel`),
**ANO-C04** (escalade RLS `profiles`, migration 039 — jamais retesté), **ANO-C05/C06** (IDOR
`miaa/notifications`, `resto/receipt`). Aucune des 36 majeures ni des 21 normales n'est
mentionnée, sauf en contexte ponctuel (ANO-M04, ANO-M28).

**Items MIGRATION-MAP-AZ jamais mentionnés dans REPAIR-LOG** : la quasi-totalité des sections
Comptabilité (C1,C2,C5-C8), une bonne part de Fiscalité (F5,F7,F8,F10-F13), Paie (P2,P4,P5),
Tenant/Auth (T1-T5), ERP Core (E1-E4), et **la totalité du module Stock** (S1-S5, cohérent avec
ANO-C03 resté ouvert — `stock_actuel` toujours inexistante).

**Doublons d'identifiants confirmés** :
- **« D3 »** désigne deux choses différentes selon le fichier : migrations 157-159 non appliquées
  (`MIGRATION-MAP-AZ.md:112`) vs décision bloquée sur le moteur IRPP
  (`R001-FOUNDATION-DECISIONS.md §D3.6`, cité dans `REPAIR-LOG.md:138,369-370,436`).
- **« ANO-P04 »** réutilisé dans REPAIR-LOG pour deux faits distincts : migrations non appliquées
  (définition d'origine, l.774 de RESTART-AUDIT-AZ) et drift des triggers `trg_auto_journal_entry`/
  `trg_transaction_to_journal` sur `transactions` (l.685 de REPAIR-LOG — fait matériellement
  différent, plus proche d'un sous-cas de CR-1).

**Anomalies réapparues / jamais réellement fermées malgré leur mention** — voir §9 : le
« nettoyage » annoncé de `trg_auto_journal_entry`/`trg_transaction_to_journal` par « la migration
177 » (`REPAIR-LOG.md:685` : « la migration 177 alignera le dépôt en supprimant ces deux triggers »)
**n'a pas eu lieu** — vérifié directement sur le fichier réel de la migration 177 telle qu'écrite
et committée : elle ne contient aucun `DROP TRIGGER` pour ces deux noms, uniquement le correctif
achats. C'est une anomalie que le journal documente comme réglée par anticipation, mais qui ne
l'est pas dans le code du dépôt.

**Nouvelles anomalies découvertes par cette mission** (aucune ne préexistait dans les 3 documents
sources) — voir Table finale, lignes NEW-01 à NEW-05, issues de l'audit des writers (§9) et de
l'audit Grand Livre/Balance (§2).

**Statut de cette section : constat, pas de correction.** Conformément à l'instruction de la
mission, aucune anomalie n'a été fermée ni rouverte par ce document — seul un état des lieux est
produit.

---

## 9. Audit des writers — une seule autorité par flux

Table complète, condensée depuis le rapport de l'agent (citations fichier:ligne conservées) :

| Table | Verdict | Détail |
|---|---|---|
| `journal_entries` | **RISQUE confirmé** | `writeComptaEntry()` (`lib/compta-sync-client.ts:133-175`, exemption officielle EXM-JE-003) appelé depuis 14 pages dashboard, en parallèle de triggers legacy jamais droppés (cheques, virements, caisse_operations, transfers, mobile_wallet_operations, tva_declarations — migration 046) et du moteur central. Doublon **confirmé au niveau code** pour `app/dashboard/tresorerie/caisses/page.tsx:87,97` (insert `caisse_operations` + `writeComptaEntry()` dans le même clic, sans garde d'idempotence commune). |
| `accounting_events` | **Autorité unique** | 0 écriture directe détectée hors `emit_accounting_event()`. Confirmé par `lib/architecture/loi-k-unique-writer.test.ts` (21 émetteurs autorisés listés). |
| `transactions` | **RISQUE confirmé, non corrigé** | `trg_auto_journal_entry` (`026:283`, `027:136`) et `trg_transaction_to_journal` (`023:114/156`) **jamais DROP dans le dépôt**. `REPAIR-LOG.md:685` affirme qu'ils sont absents en production au 2026-09-02, et annonce que « la migration 177 » les supprimerait dans le dépôt — **vérifié faux** : `177_repair_achats_legacy_doublons.sql` ne contient aucun `DROP TRIGGER` pour ces noms. Si le dépôt est rejoué intégralement (recette, disaster recovery), ces triggers seraient recréés et le bug (déjà vu pour achats) se reproduirait à l'échelle de **tous** les événements moteur à impact trésorerie (FAC-002, PAI-002, RES-001, ECO-001, SAN-002, etc.). |
| `comptes_bancaires` | **RISQUE partiel** | Migration 178 réduit le recalcul moteur à un seul compte (`compte_principal`), mais les pages `banques/page.tsx:352`, `transferts/page.tsx:207-218`, `decaissements`/`encaissements` continuent de modifier `solde` par arithmétique cliente, y compris potentiellement sur le compte principal lui-même — concurrence non éliminée, seulement réduite en surface. |
| `mobile_money_wallets` | **RISQUE — scission de schéma** | Deux systèmes parallèles et déconnectés : `mobile_money_wallets`/`mobile_wallet_operations` (trigger legacy `fn_mobile_wallet_operation_to_journal`, alimenté par `app/api/tresorerie/wallets/**`) vs `wallets`/`wallet_operations` (alimenté par `app/dashboard/tresorerie/mobile-money/page.tsx`, comptabilisé via `writeComptaEntry()`). Aucun lien identifié entre les deux — deux comptabilités disjointes pour le même domaine métier. |
| `stock_movements` | **Autorité unique** | `fn_stock_move()` (migration 173) seul writer, y compris quand appelé en RPC direct depuis 4 pages legacy. |
| `bulletins_paie` | **Autorité unique** | Trigger legacy proprement droppé (migration 141), un seul chemin d'émission comptable, dédoublonnage natif. |
| `factures` | **Autorité unique** | Cas le mieux nettoyé du dépôt — deux générations de trigger legacy droppées (127 puis 139), aucune exemption `writeComptaEntry` sur ce module. |

**Requêtes de vérification fournies par l'agent** (à exécuter en production pour confirmer l'état
réel des triggers, non fait dans cette révision — accès DB indisponible pour cette session) :
`pg_trigger` sur `transactions`/`caisse_operations`, comptage des comptes 6-chiffres dans
`journal_entries` (signature `fn_auto_journal_entry`), écart `solde` stocké vs recalculé sur
`comptes_bancaires`, comparaison `wallets` vs `mobile_money_wallets`. Ces requêtes n'ont pas encore
été remises à l'utilisateur dans cette révision du document — à faire dans une itération
ultérieure si la mission se poursuit sur ce terrain.

**Objectif de la mission (« une seule autorité par flux ») : NON ATTEINT sur 4 tables sur 8.**
`journal_entries`, `transactions`, `comptes_bancaires`, `mobile_money_wallets` ont chacune au moins
un mécanisme concurrent actif ou potentiellement actif.

---

## 10. Production — commit servi vs commit attendu

**Vérifié directement par cette session, sans intervention utilisateur** :
- GitHub Commit Status API sur `9636836b031981fd38bb7e2f64d30ac7122363b` (commit de merge de la
  PR #1) : `state: success`, contexte `Vercel`, description « Deployment has completed ».
- `curl` direct sur `https://oraforme.vercel.app` : `200 OK`, en-têtes `Server: Vercel`,
  `X-Vercel-Cache: HIT`.
- Aucun commit n'a été poussé sur `main` après `9636883` (vérifié par `git log`) — le déploiement
  « success » le plus récent est donc, par élimination, celui de ce commit précis.

**Limite honnête** — aucun en-tête HTTP exposé publiquement (`X-Vercel-Id` ne contient pas de SHA
Git) ne permet de vérifier **directement au niveau octet** que le code réellement exécuté par les
lambdas Vercel correspond au commit `9636883` plutôt qu'à un déploiement antérieur manuellement
promu. La preuve retenue ici est **indirecte mais solide** (statut GitHub attaché explicitement à
ce SHA, absence de commit plus récent, cohérence avec l'auto-déploiement Git-connecté standard de
Vercel) — pas une preuve cryptographique. Un accès direct au dashboard Vercel (bloqué, MCP en 403)
donnerait une preuve plus forte (SHA affiché explicitement sur le déploiement actif).

**Statut : VERIFIED** (preuve indirecte mais réelle et multi-source, pas une simple lecture de
commit local).

---

## Table finale

| ID | P0/P1 | Anomalie | Cause racine | Fix | Test | Production | Preuve | Statut |
|---|---|---|---|---|---|---|---|---|
| P0-01 | P0 | Constantes fiscales locales erronées (TUS, AF, CNSS, Patente) | 3 réimplémentations indépendantes au lieu du moteur canonique | `lib/countries/`, `lib/fiscal/universal-tax-engine.ts`, 6 chaînes de génération (commit 7025c03) | 18+8 cas + 1 scanner statique, 186/186 ré-exécutés ce jour | Aucune migration requise | Tests réels verts ; **aucune preuve de production, aucun artefact stocké vérifiable** | **CODE_FIXED** |
| P0-02 | P0 | Grand Livre 400 (colonne fantôme) ; Balance 22008 sur 5 mois/12 | Contrat `JournalLedgerRow` erroné ; construction de date `-31` | `lib/erp-core/compute/accounting.ts`, `balance/route.ts` (commit c209869) | 39+27 cas, **39/39 ré-exécutés directement par cette session** | Aucune migration requise | Tests réels verts ; contrôle SQL production **en attente** (Bloc 1) ; **logique UI parallèle non testée découverte** | **CODE_FIXED** |
| P0-03 | P0 | Paie ne génère aucune écriture comptable | Route UI ≠ route désignée par la migration 141 | `lib/paie/evenements-comptables.ts`, 3 routes API (commit 2a7065a) | 47+32 cas, 186/186 ré-exécutés | Aucune migration requise | Tests réels verts ; contrôle SQL production **en attente** (Bloc 2) | **CODE_FIXED** |
| P0-04 | P0 | 336/771 événements comptables en erreur, trésorerie fantôme | Ligne `transactions` créée par module au lieu d'événement | Migrations 175, 176 | 28 cas (forme statique), 115/115 ré-exécutés | Migrations 175/176 appliquées 2026-09-02 | **Table de contrôle réelle chiffrée : 0/771 en erreur** | **VERIFIED** (fermeture ANO-C08) / CODE_FIXED (ventilation soldes, résiduel) |
| P0-05 | P0 | Production jamais construite par rejeu strict des migrations | Divergence dépôt/production non garantie par un processus | Runbooks bloc A/B (133,148,155,157-159,165) | Aucun test dédié (opération SQL pure) | Blocs A/B appliqués 2026-09-02/03 | **Tables de contrôle réelles chiffrées** pour chaque migration | **VERIFIED** (7 migrations) / **OPEN** (168) |
| 177 | Résidu P0-04 | 48 doublons `journal_entries` (achats_enregistrement) | Trigger legacy jamais droppé en prod (bien que 147 le prévoie) | Migration 177 (archivage + suppression) | Aucun test unitaire ; contrôle SQL réel | Appliquée et vérifiée 2026-09-04 | **Contrôle réel : 0 restant, 48 archivés** | **CLOSED** (historique) / PRODUCTION_PENDING (test idempotence tenant isolé, Bloc 3) |
| 178 | Résidu P0-04 | Solde bancaire triplé (AMD FINANCE, 3 comptes) | `fn_sync_tresorerie_soldes` sans notion de compte précis | Migration 178 (compte_principal) | Aucun test unitaire ; contrôle SQL réel | Appliquée et vérifiée 2026-09-04 | **Contrôle réel conforme à l'attendu** | **CLOSED** (historique) / PRODUCTION_PENDING (preuve mathématique généralisée, Bloc 3) |
| 168 | P0-05 résiduel | 76 policies RLS avec `auth.uid()` non encapsulé | Anti-pattern de performance (ré-évaluation par ligne) | Écrit, jamais appliqué | Aucun test | **Jamais jouée en production** | Aucune | **OPEN** |
| ACH-002 | Vérification | Paiement fournisseur, doublon potentiel | — | Mécanisme générique déjà vérifié pour ACH-001 | Test isolé préparé (Bloc 3) | 0 achat payé en production | Aucune donnée réelle disponible | **NOT_TESTABLE — NO PRODUCTION DATA** |
| CRON/AUTOMATION_SECRET | Vérification | 15 routes d'automatisation, secret non confirmé | — | `lib/api/require-automation.ts` (fail-closed) | **15/15 routes testées en HTTP réel : 401 confirmé** | Garde actif ; présence du secret non vérifiable de l'extérieur | HTTP réel, mais structurellement incapable de distinguer « secret absent » de « secret présent, mauvais essai » | **PRODUCTION_PENDING** |
| NEW-01 | Découverte R-003 | Double écriture `caisse_operations` (trigger + `writeComptaEntry`) | Exemption EXM-JE-003 active, aucune garde d'idempotence commune | Aucun | Aucun | Code présent, état du trigger en prod non confirmé | Requête `pg_trigger`/comptage fournie, non exécutée | **OPEN** |
| NEW-02 | Découverte R-003 | `trg_auto_journal_entry`/`trg_transaction_to_journal` jamais droppés dans le dépôt | Promesse REPAIR-LOG (« migration 177 ») non tenue | Aucun | Aucun | État réel en prod non confirmé ; recréés si migrations rejouées | Requête `pg_trigger` fournie, non exécutée | **OPEN** |
| NEW-03 | Découverte R-003 | Scission de schéma Mobile Money (`wallets` vs `mobile_money_wallets`) | Deux générations de schéma jamais unifiées | Aucun | Aucun | Non confirmé | Requête de comparaison fournie, non exécutée | **OPEN** |
| NEW-04 | Découverte R-003 | Écriture concurrente sur `comptes_bancaires.solde` (UI manuelle vs moteur) | Root cause du bug 178 seulement partiellement traitée | 178 réduit le scope, ne l'élimine pas | Aucun | Non confirmé | Requête d'écart solde stocké/recalculé fournie, non exécutée | **OPEN** |
| NEW-05 | Découverte R-003 | Pages UI Balance/Grand Livre/Bilan dupliquent la logique corrigée par P0-02 sans la réutiliser | Deux implémentations indépendantes de la même règle métier | Aucun | Aucun | Jamais exposées au bug -31 (requête différente), mais non couvertes par les 39+27 tests | Lecture de code directe (`balance/page.tsx:48-100`) | **OPEN** |

---

## Conclusion

Cette mission ne clôt aucune anomalie qu'elle n'a pas elle-même vérifiée avec une preuve réelle.
Sur les 5 tickets P0 audités, **aucun n'atteint `VERIFIED` sur l'intégralité de son périmètre** —
P0-04 et P0-05 s'en approchent le plus, avec des tables de contrôle chiffrées réelles pour leur
cœur de correction, mais chacun porte un résidu `CODE_FIXED`/`OPEN`. P0-01/02/03 restent
`CODE_FIXED` : correctement codés et testés unitairement, jamais vérifiés en conditions réelles de
production à ce jour.

L'audit des writers (§9) révèle que l'objectif « une seule autorité par flux » n'est **pas**
atteint sur la moitié des tables comptables examinées, avec un cas confirmé au niveau code
(`caisse_operations`) et une divergence documentée-mais-non-corrigée particulièrement large
(`transactions`).

Le backlog (§8) montre que 67 des 72 anomalies formellement documentées dans l'audit d'origine
n'ont jamais été reprises dans un ticket de réparation — ni fermées, ni explicitement laissées
ouvertes.

**Conformément à la mission : aucun P1 n'est entamé, aucun nouveau module n'est commencé. En
attente de l'ordre.**

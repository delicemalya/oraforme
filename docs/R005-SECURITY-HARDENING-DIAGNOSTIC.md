# R-005 — Sécurité RLS + Automatisations + Risques Legacy (diagnostic)

Mission de **diagnostic puis hardening contrôlé**. Aucune donnée métier touchée, aucun événement
financier rejoué, aucune migration historique modifiée, aucune migration appliquée. Ce document
rapporte ce qui a été trouvé ; aucune correction n'a été exécutée — conformément à l'instruction
explicite de la mission.

---

## A — Migration 168 (RLS `auth.uid()` non encapsulé)

### Ce qu'elle fait réellement

Bloc `DO $$` **dynamique** : elle lit `pg_policies` à l'instant de son exécution (pas de liste
figée dans le fichier), filtré `schemaname='public'` uniquement — `storage` est **hors périmètre**
malgré l'introduction du fichier qui prétend couvrir `auth.role()` sans réserve
(`168_fix_auth_rls_initplan.sql:3-4,54`). Remplace `auth.uid()/jwt()/role()` par
`(select auth.\1())` dans `qual` et `with_check`, séparément. Sémantiquement neutre — confirmé par
lecture : aucun changement de logique d'autorisation, seulement de plan d'exécution.

### Tables et policies (plancher confirmé, pas le total exact — voir limite ci-dessous)

**Cibles valides pour 168** (confirmées `auth.*` littéral, aucune migration ultérieure ne les a
retouchées) : `tenants` (insert), `profiles` (×3 : select own, update own info, owner remove
member), `bulletins_paie` (118), `acomptes_salaires` (118), `agriculture_intrants` (066),
`transport_vehicules`/`transport_carburant`/`ventes`/`vente_lignes`/`commerce_clients` (100),
`ecole_theses`/`ecole_soutenances`/`ecole_diplomes` (100), `miaa_notifications`/`miaa_rapports`
(087, ×2 chacune), `team_invites: select` (067). Soit ~19 policies confirmées.

**`storage.objects`** (`logos_auth_insert`/`logos_auth_update`, migration 041, `auth.role()`
littéral) : **hors périmètre de 168** par construction (`schemaname='public'` exclut `storage`).

**Hors périmètre, contrairement à l'hypothèse implicite de la mission** : `journal_entries`,
`accounting_events`, `transactions`, `user_permissions`, `roles`, `role_permissions`,
`fiscal_years`, `cost_centers` — toutes utilisent déjà `get_my_tenant_id()`/`get_my_role()`/
`fn_is_user_financial()` sans aucun `auth.*` littéral. **168 ne les touchera pas, qu'elle soit
appliquée ou non.**

**Anomalie relevée** : le commentaire de 168 (lignes 37-39) cite `cv_candidats` comme échantillon
vérifié manuellement — mais l'état actuel du dépôt pour cette table (migration 012, jamais
retouchée) n'a **aucun** `auth.uid()` littéral, seulement `get_my_tenant_id()`. Soit le commentaire
décrivait un état de production différent du dépôt (nouvelle preuve de dérive dépôt/prod, cohérent
avec P0-05), soit il est approximatif — dans les deux cas, ne pas se fier aveuglément au commentaire
d'intention sans revalider en base.

**Policies orphelines détectées** : `tenant_own` (sur `miaa_notifications`/`miaa_rapports`,
supprimées par 170) et `profiles_insert`/`tenants_insert` (supprimées par 170) — **introuvables
comme `CREATE POLICY` dans tout le dépôt**. Créées hors gouvernance des migrations (dashboard
Supabase ou script ad hoc). Signal de dérive process, indépendant de 168.

**Limite assumée** : le bloc de 168 étant dynamique, la liste exacte des 76 policies (mesurées en
production le 2026-09-02) n'est connue qu'en base — cette liste de ~19 est un plancher prouvé par
le code, pas le total.

### Risque de doublon/remplacement par 169-179 — évalué, non constaté

168 étant dynamique, elle opère toujours sur l'état **courant** de chaque policy au moment de son
exécution — il n'existe pas de "texte figé obsolète" qu'elle pourrait réinjecter. Vérification
empirique sur les 3 migrations qui touchent des policies après 168 (170, 171, 172) : aucune ne
recrée de policy avec `auth.*` littéral. **171** (ANO-C04) réécrit même `user_permissions`/
`roles`/`role_permissions` avec `get_my_tenant_id()`/`get_my_role()` uniquement — et son propre
trigger `fn_prevent_self_role_escalation()` encapsule déjà volontairement `(SELECT auth.uid())`,
preuve que l'équipe applique ce pattern depuis au moins cette migration.

### Impact par acteur

| Acteur | Impact |
|---|---|
| Utilisateur authentifié / admin | Perf pure, aucun changement de portée d'accès |
| Financial user | **Non affecté** — `journal_entries`/`transactions`/`fiscal_years`/`cost_centers` hors périmètre |
| service_role / cron / automatisation | **RLS entièrement contourné** par construction (`lib/supabase-server.ts:6`, `SUPABASE_SERVICE_ROLE_KEY`) — 168 n'a aucun impact, appliquée ou non |
| Fonctions SECURITY DEFINER (`get_my_tenant_id`, `get_my_role`, `fn_is_user_financial`) | **Non touchées par 168** (elle ne réécrit que `pg_policies`, jamais le corps d'une fonction) — et **le même défaut existe dans leur corps** : `get_my_tenant_id()` (118) et `get_my_role()` (053) contiennent `WHERE user_id = auth.uid()` non encapsulé, en `STABLE` ; `fn_is_user_financial()` (030) idem, sans marqueur `STABLE` (donc `VOLATILE` par défaut — pire cas). Comme la quasi-totalité des tables délèguent leur isolation à ces fonctions plutôt qu'à `auth.uid()` direct, **le point d'optimisation le plus impactant en volume n'est pas couvert par 168** |

### Verdict : **B — sûre techniquement, adaptation recommandée avant application**

Pas de régression de sécurité (logique inchangée), pas de conflit avec 169-179 (constaté). Mais :
aucune capture de l'état AVANT dans le fichier (pas de `repair_archive`-style, contrairement à
176-178), aucun rollback prévu autrement qu'en rejouant manuellement les `CREATE POLICY`
d'origine, et le commentaire d'intention contient au moins une inexactitude vérifiable
(`cv_candidats`). Pas C (aucune preuve de danger), pas D (les policies 🔴 restent réellement non
corrigées aujourd'hui), pas A pur (les 3 réserves ci-dessus).

### Plan d'application proposé (non exécuté)

1. Prérequis bloquant déjà connu : environnement de recette (ANO-P03, `OPEN`).
2. Snapshot avant (`CREATE TABLE _audit_168_before AS SELECT ... FROM pg_policies WHERE schemaname='public'`).
3. Revalidation en base de la liste de policies non encapsulées avant exécution (requête déjà
   fournie par un audit précédent, R003 §7).
4. Exécution en recette d'abord.
5. Comptage après (attendu 0 policy non encapsulée restante).
6. Non-régression tenant : deux JWT distincts, avant/après, sur les tables 🔴 les plus sensibles.
7. Mesure de gain avec un jeu de données synthétique (volume actuel trop faible pour un gain
   mesurable en `EXPLAIN ANALYZE`).
8. **Séparément, hors 168** : ticket dédié pour encapsuler `auth.uid()` dans le corps de
   `get_my_tenant_id()`/`get_my_role()`/`fn_is_user_financial()` — probablement le gain de
   performance le plus significatif, hors de portée de 168 telle qu'écrite.
9. **Séparément, hors 168** : ticket pour `storage.objects` (`auth.role()` littéral, exclu du
   périmètre `schemaname='public'`).

---

## B — 15 routes d'automatisation + proxy

### Tableau des 15 routes

Toutes appellent `requireAutomationSecret` en première instruction du handler (aucun traitement
avant le garde). `safeEqual` vérifiée robuste (`''` se comporte comme `undefined`, échec fermé
dans les deux cas — confirmé par lecture, pas supposé).

| # | Route | Méthode | Secret | Comparaison | Absent/Incorrect | `vercel.json` | `proxy.ts` (`AUTOMATION_PATHS`) | Risque |
|---|---|---|---|---|---|---|---|---|
| 1 | `cron/run` | POST/GET | CRON ou AUTOMATION | `safeEqual` | 401/401 | Non | Exempté ✓ | Route non dans `vercel.json` malgré son propre commentaire « called by Vercel Cron » — scheduler externe non identifié, probable legacy |
| 2 | `profil/reminders` | POST | idem | `safeEqual` | 401/401 | Non (invoquée par **pg_cron**, migration 167) | Exempté ✓ | Aucun |
| 3 | `miaa/analyse-quotidienne` | POST | idem | `safeEqual` | 401/401 | Non (chaînée par `cron/run`) | Exempté ✓ | Aucun |
| 4 | `miaa/proactif` | GET | idem | `safeEqual` | 401/401 | Oui | Exempté ✓ | Aucun |
| 5 | `agents/miaa-autonome` | POST+GET | idem | `safeEqual` | 401/401 | Oui | Exempté ✓ | Aucun |
| 6 | `agents/superviseur/rapport` | GET | idem | `safeEqual` | 401/401 | Oui | Exempté ✓ | Aucun |
| 7 | `agents/stock/verifier` | GET | idem | `safeEqual` | 401/401 | Oui | Exempté ✓ | Aucun |
| 8 | `agents/securite/performance` | GET | idem | `safeEqual` | 401/401 | Oui | Exempté ✓ | Aucun |
| 9 | `agents/securite/backup` | GET | idem | `safeEqual` | 401/401 | Oui | Exempté ✓ | Aucun |
| 10 | `agents/securite/attaques` | GET | idem | `safeEqual` | 401/401 | Oui | Exempté ✓ | Aucun |
| 11 | `agents/rh/bulletins` | GET | idem | `safeEqual` | 401/401 | Oui | Exempté ✓ | Aucun |
| 12 | `agents/restaurant/cloture` | GET | idem | `safeEqual` | 401/401 | Oui | Exempté ✓ | Aucun (ancienne route la plus critique — ANO-C01 historique, corrigée) |
| 13 | `agents/ecole/impayes` | GET | idem | `safeEqual` | 401/401 | Oui | Exempté ✓ | Aucun |
| 14 | `agents/comptable/relances` | GET | idem | `safeEqual` | 401/401 | Oui | Exempté ✓ | Aucun |
| 15 | `ocr/extract` | POST | idem | `safeEqual` | 401/401 | Non | **ABSENTE** | 🔴 Voir ci-dessous |

**Nuance factuelle sur les « 4 routes hors `vercel.json` »** : seule `profil/reminders` est
réellement invoquée par pg_cron (migration 167, `url := .../api/profil/reminders`). `cron/run`
n'a pas de déclencheur externe identifiable dans le dépôt. `miaa/analyse-quotidienne` et
`ocr/extract` sont chaînées en interne (serveur→serveur), pas par pg_cron.

### Risque confirmé — `/api/ocr/extract` absente de `AUTOMATION_PATHS`

`proxy.ts` (lignes 32-47) liste 14 chemins, pas 15 — `ocr/extract` en est absente, et n'est pas
non plus dans `PUBLIC_API_PREFIXES`. Conséquence : `app/api/storage/upload/route.ts:70-74`
déclenche l'OCR via `fetch()` avec un `Authorization: Bearer <CRON_SECRET>` valide
(`automationHeaders()`), mais sans cookie de session. Le proxy voit `user=null`, la route n'est
exemptée nulle part → **401 renvoyé par le proxy avant que `requireAutomationSecret` ne soit
jamais évalué** (le secret pourtant correct n'est jamais vérifié). L'échec est avalé
silencieusement (`.catch(() => {})`, ligne 74) — aucune alerte, aucun log.

**Impact** : fonctionnel, pas une exposition de sécurité (le proxy bloque, il n'ouvre rien).
L'OCR asynchrone post-upload semble structurellement en échec en production.

### Découverte hors périmètre des 15 — `app/api/automation/run/route.ts`

Une 16ᵉ route, non couverte par `requireAutomationSecret`, réimplémente son propre contrôle :
`secret !== process.env.AUTOMATION_SECRET` (comparaison **directe**, pas `safeEqual`) — timing
attack théoriquement possible. Accepte aussi une session utilisateur en parallèle (mode double),
ce qui limite l'exposition réelle. Non couverte par `lib/architecture/automation-guard.test.ts`.

### Gap de couverture CI

`automation-guard.test.ts` vérifie que chaque chemin de `AUTOMATION_PATHS`/`vercel.json` appelle
le garde — mais **pas l'inverse** : qu'une route appelant `requireAutomationSecret` soit bien
listée dans `AUTOMATION_PATHS`. C'est l'angle mort qui laisse passer le cas `ocr/extract` sans
échec CI.

### Autres constats

- Pas de secret hardcodé, pas de bypass `NODE_ENV`, `x-internal` bien retiré partout (2 mentions
  restantes, toutes deux des commentaires explicatifs).
- Incohérence documentaire : `docs/MASTER-REPAIR-REGISTER.md` affirmait « aucun test unitaire
  dédié » alors que `automation-guard.test.ts` existe — probablement ajouté après la rédaction de
  cette ligne.

---

## C — Triggers legacy (`trg_caisse_operation`, `trg_auto_journal_entry`, `trg_transaction_to_journal`)

### Risque réel

**Aucun mécanisme de suivi de migrations Supabase dans ce dépôt** (pas de `supabase/config.toml`,
pas de script `db push`/`db reset` dans `package.json`) — rien n'empêche techniquement un rejeu
strict de traverser les 179 fichiers dans l'ordre et de recréer ces 3 triggers. C'est un fait
organisationnel (la CLI Supabase n'est simplement jamais utilisée ainsi), pas une garantie du
dépôt.

- **Production actuelle** : risque nul, confirmé frais (`pg_trigger`, 2026-09-07).
- **Futur environnement** (recette — bloquée par ANO-P03, ou disaster recovery) : risque réel et à
  large rayon, plus étendu que le bug achats déjà corrigé (147/177), car il toucherait tous les
  modules du moteur central à impact trésorerie.

### Protection recommandée : **combinaison**, dans cet ordre

1. **DB guard (migration DROP explicite)** — priorité 1. Pattern déjà éprouvé 4 fois dans ce
   dépôt (127, 139, 141, 147 : `DROP TRIGGER IF EXISTS ... ;` sans recréation, avec contrôle
   `pg_trigger` post-exécution). Seule action qui élimine la cause racine.
2. **CI guard (test d'architecture statique)** — priorité 2, complémentaire. Le CI actuel
   (`.github/workflows/ci.yml`, lu intégralement) ne touche jamais de vraie base Postgres
   (`typecheck`/`lint`/`vitest`/`build` avec env placeholder) — un garde doit donc être statique.
   Faisabilité déjà démontrée : `lib/architecture/chaine-paie-comptabilite.test.ts:201-205`
   applique exactement ce pattern (`readFileSync` sur une migration, assertion regex `DROP
   TRIGGER` présent / `CREATE TRIGGER` absent après) pour `trg_bulletins_paie`. Extension directe
   pour 023/026/027/046 — même style, même dépôt, coût faible.
3. **Documentation** — déjà largement satisfaite (REPAIR-LOG, MASTER-REPAIR-REGISTER, R003/R004),
   mais insuffisante seule : elle n'a pas empêché la promesse non tenue de la migration 177.

`lib/architecture/loi-k-unique-writer.test.ts` exempte explicitement `supabase/migrations/` de
son scan — il ne couvre que les écritures TypeScript directes, jamais les triggers SQL. Ce n'est
donc pas un garde existant pour ce cas précis.

**Point additionnel** : le commentaire de la migration 127 affirme que `trg_auto_journal_entry`
(026) a été « déjà supprimé en 124 » — **aucun fichier `124_*.sql` n'existe dans le dépôt**
(la séquence saute de 123 à 126). Dérive de numérotation supplémentaire, cohérente avec le
constat P0-05 déjà établi.

---

## D — Registre maître : mises à jour

Voir `docs/MASTER-REPAIR-REGISTER.md` pour le détail complet. Résumé :

**Tickets modifiés** :
- **168** : verdict B ajouté, plan d'application documenté, découverte du gap sur les fonctions
  SECURITY DEFINER, policies orphelines notées. Statut inchangé (`OPEN` — non appliquée).
- **R004-DB-TRIGGER-TRANSACTIONS** / **R004-CAISSE-DUPLICATE-WRITER** : recommandation de
  protection ajoutée (combinaison DB+CI guard), toujours `OPEN` (aucune correction appliquée).
- **CRON/AUTOMATION_SECRET** : précisions ajoutées sur les 15 routes, statut inchangé
  (`PRODUCTION_PENDING` — toujours non vérifiable de l'extérieur).

**Nouveaux tickets créés** (`docs/REPAIR-LOG.md`) :
- **R005-OCR-PROXY-GAP** : `/api/ocr/extract` absente de `AUTOMATION_PATHS`, OCR post-upload
  structurellement en échec silencieux.
- **R005-AUTOMATION-RUN-TIMING** : `automation/run` hors garde unique, comparaison non
  constant-time.
- **R005-RLS-FUNCTION-BODY-GAP** : `get_my_tenant_id()`/`get_my_role()`/`fn_is_user_financial()`
  contiennent `auth.uid()` non encapsulé dans leur corps — hors périmètre de 168, vrai gisement de
  performance non couvert.
- **R005-STORAGE-RLS-GAP** : `storage.objects` (`auth.role()` littéral) hors périmètre de 168
  (`schemaname='public'` exclut `storage`).

**Aucune anomalie fermée sur la seule base qu'elle n'est pas actuellement exploitée** — conforme
à l'instruction. Les 55 anomalies historiques restent `OPEN`, non retouchées dans cette mission
(une reclassification complète selon la taxonomie ACTIVE PRODUCTION BUG / SECURITY EXPOSURE /
ARCHITECTURAL RISK / LATENT RISK / NOT TESTABLE / FALSE POSITIVE / VERIFIED FIX / HISTORICAL DATA
ISSUE / UNKNOWN n'a été appliquée qu'aux découvertes de cette session — l'appliquer aux 55
anomalies historiques est un chantier à part, proposé en §F).

---

## E — Classement

| Sévérité | Éléments |
|---|---|
| **CRITICAL** | Aucun — aucune exposition de sécurité active confirmée dans cette mission |
| **HIGH** | — |
| **MEDIUM** | R005-OCR-PROXY-GAP (fonctionnalité cassée silencieusement, pas exploitable) ; R005-RLS-FUNCTION-BODY-GAP (le vrai gisement de perf RLS, non couvert par 168) ; triggers legacy (ARCHITECTURAL RISK / LATENT RISK — deviendrait bloquant si un environnement de recette était créé) |
| **LOW** | Migration 168 elle-même (perf uniquement, verdict B) ; R005-AUTOMATION-RUN-TIMING (timing attack théorique, mitigé par le mode session parallèle) ; R005-STORAGE-RLS-GAP (petite table, perf uniquement) |
| **NOT TESTABLE** | CRON_SECRET/AUTOMATION_SECRET réellement configuré sur Vercel — un 401 sans identifiants ne distingue pas « absent » de « présent, mauvais essai », non vérifiable depuis l'extérieur |

---

## F — Next action (une seule recommandation)

**Créer l'environnement de recette (ANO-P03).** C'est le prérequis bloquant commun à la validation
sûre de la migration 168 (plan d'application, §A), à toute correction future des triggers legacy
(§C — le DB guard doit être testé avant d'être rejoué en production), et plus généralement à toute
vérification qui ne doit pas toucher la production. Tant qu'il n'existe pas, chaque nouvelle
correction continue de s'appuyer sur des garde-fous SQL en production plutôt que sur un vrai cycle
de test — ce qui a déjà fonctionné (176-179) mais reste plus risqué et plus lent qu'un
environnement dédié.

**STOP.** Aucune modification de code ou de base n'a été effectuée dans cette mission. En attente
de l'ordre.

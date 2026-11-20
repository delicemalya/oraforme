# ORAFORME — Rubrique École : vérification des constats critiques (Lot 0)

| Champ | Valeur |
|---|---|
| Date | 2026-10-13 |
| Nature | Seconde phase d'audit technique, **lecture seule** |
| Rapport de référence | `docs/AUDIT-EDUNET-ECOLE-ORAFORME.md` (non modifié) |
| Branche / HEAD | `audit/r003-post-p0-forensic-validation` / `fb54a89` (inchangés) |
| Modifications | Aucune, hormis la création de ce fichier |
| Accès base de production | **Indisponible** — voir §0.2. Aucun constat n'est « CONFIRMÉ EN BASE ». |
| Données personnelles et secrets | Aucun dans ce rapport |

**Statuts utilisés :**
- **CONFIRMÉ DANS LE CODE** : prouvé par le code et les migrations du dépôt (sous réserve de l'ordre réel d'application en production).
- **CONFIRMÉ EN BASE** : aucun constat dans ce rapport.
- **NON CONFIRMÉ**.
- **NOT_TESTABLE** : dépend de l'état de la base de production.

**Gravités :** CRITIQUE · ÉLEVÉE · MOYENNE · FAIBLE.

Les références prennent la forme `fichier:lignes` ; `NNN:lignes` désigne `supabase/migrations/NNN_*.sql`.

---

## 0. Cadre de la vérification

### 0.1 Protection du dépôt

- Pas de changement de branche.
- Aucun fichier existant modifié, aucune migration créée.
- Aucune écriture en base, aucune permission modifiée.
- Aucun test créant des comptes ou modifiant des données.
- Ni commit, ni push, ni déploiement.

Le bilan Git avant/après figure au §9.

### 0.2 Canal de lecture de la base

| Canal | Résultat |
|---|---|
| Outil MCP `postgres` (lecture seule) | Une tentative unique, en échec : `ENOTFOUND tenant/user postgres.mrzixapnaqsbqmagivvf not found`. Ce projet n'est pas joignable. |
| PostgREST avec la clé du projet (canal utilisé lors des missions BOI) | **Non utilisé.** Un garde-fou de la session interdit la lecture des fichiers `.env*`, et je ne l'ai pas contourné. |
| Supabase CLI / psql | Non lié ou absent (cf. `docs/DB-CHANNEL-RECOVERY-CHECK.md`) |

**Conséquence :** tout ce qui touche à l'état effectif de la production est **NOT_TESTABLE**, notamment `pg_policies`, `pg_trigger`, `information_schema`, les privilèges EXECUTE et les données.

### 0.3 Tests réellement exécutés

Aucun test supplémentaire n'a été exécuté dans cette phase. Les tests de la phase précédente sont rappelés dans `AUDIT-EDUNET §2.2` : 3 tests d'architecture vitest (16 tests réussis), `tsc` (0 erreur), `eslint` (0 erreur).

---

## 1. Synthèse

| Réf. | Constat | Gravité | Statut |
|---|---|---|---|
| A1 | La RLS des tables École ne distingue pas les rôles : élèves, parents et formateurs ont un accès complet (lecture **et écriture**) aux données de leur établissement | CRITIQUE | CONFIRMÉ DANS LE CODE |
| A2 | N'importe quel utilisateur authentifié peut insérer une notification dans **n'importe quel** établissement (`WITH CHECK (true)`) | ÉLEVÉE | CONFIRMÉ DANS LE CODE |
| A3 | `fn_notify` / `fn_notify_broadcast` : `SECURITY DEFINER`, tenant fourni par l'appelant, sans contrôle | ÉLEVÉE | CONFIRMÉ DANS LE CODE (privilèges réels NOT_TESTABLE) |
| A4 | Notifications personnelles lisibles par tout le tenant | ÉLEVÉE | CONFIRMÉ DANS LE CODE |
| A5 | Références inter-tenant (FK sans contrôle de tenant) exploitables par les routes en `supabaseAdmin` et les triggers `SECURITY DEFINER` | MOYENNE (latente) | CONFIRMÉ DANS LE CODE |
| A6 | `POST /api/ecole/paiements` : aucun contrôle de rôle ni d'appartenance de l'élève et du frais au tenant | ÉLEVÉE | CONFIRMÉ DANS LE CODE |
| A7 | Routes de documents (attestation, diplôme, bulletin, e-mail) sans contrôle de rôle | MOYENNE | CONFIRMÉ DANS LE CODE |
| B1 | Consultation du dossier d'un autre élève par son matricule (client seul, sans route serveur) | CRITIQUE (combinée à A1) | CONFIRMÉ DANS LE CODE |
| B2 | Un élève peut lever sa propre suspension (protection uniquement côté interface) | MOYENNE | CONFIRMÉ DANS LE CODE |
| C1 | `fn_deliberer_annee` : écriture des délibérations d'**un autre établissement** et seuil de crédits choisi par l'appelant | CRITIQUE | CONFIRMÉ DANS LE CODE (privilèges réels NOT_TESTABLE) |
| C2 | `fn_valider_parcours_etudiant` : lecture des résultats d'un élève d'un autre établissement | MOYENNE | CONFIRMÉ DANS LE CODE |
| D1 | Calcul des impayés et suspension en masse de tous les élèves actifs (un clic, sans confirmation) | CRITIQUE | CONFIRMÉ DANS LE CODE |
| D2 | Suppression physique d'un paiement sans contre-passation comptable, ouverte à tout membre | ÉLEVÉE | CONFIRMÉ DANS LE CODE |
| D3 | Résultat de l'émission comptable ECO-001 jamais vérifié | ÉLEVÉE | CONFIRMÉ DANS LE CODE |
| D4 | **Double ligne de trésorerie** à chaque encaissement : trigger hérité + moteur comptable | ÉLEVÉE | CONFIRMÉ DANS LE CODE (doublons réels NOT_TESTABLE) |
| D5 | Trigger `trg_ps_source_label` sur une colonne `source` inexistante | ÉLEVÉE si actif | NOT_TESTABLE |
| D6 | Paie École calculée et écrite côté client, net falsifiable, double paie possible | ÉLEVÉE | CONFIRMÉ DANS LE CODE |
| D7 | Paie École absente des déclarations IRPP et CNSS | CRITIQUE (fiscal) | CONFIRMÉ DANS LE CODE |
| D8 | Comptabilisation de la paie limitée au net (retenues 431/447 jamais passées) | ÉLEVÉE | CONFIRMÉ DANS LE CODE |
| D9 | Heures enseignants : validation refusée par la contrainte CHECK, paiement inatteignable, colonnes inexistantes | ÉLEVÉE | CONFIRMÉ DANS LE CODE |
| D10 | Fausse charge 641 à la création d'une fiche employé | MOYENNE | CONFIRMÉ DANS LE CODE |
| D11 | Agent « impayés » inopérant et sans filtre par tenant | FAIBLE | CONFIRMÉ DANS LE CODE |
| E1 | 11 tables utilisées par le code, créées par aucune migration | ÉLEVÉE | CONFIRMÉ DANS LE CODE (existence en production NOT_TESTABLE) |
| E2 | Chaîne de migrations non rejouable | ÉLEVÉE | CONFIRMÉ DANS LE CODE et dans la documentation d'exécution locale |

---

## 2. A — Accès aux données et inter-établissements

### 2.1 Politiques RLS créées, modifiées, supprimées

**Constats généraux (CONFIRMÉ DANS LE CODE) :**
- Aucune politique `AS RESTRICTIVE` dans tout le dépôt.
- Aucune clause `TO <rôle>` : toutes les politiques sont **PERMISSIVE** et s'appliquent à `PUBLIC`.
- Les politiques permissives s'additionnent (**OU logique**). Il suffit donc d'une seule politique qui n'exige que `tenant_id = get_my_tenant_id()` pour que tout membre du tenant passe.

| Table | Politiques effectives selon le dépôt | Ce que 034 voulait supprimer | Ce que 067 supprime |
|---|---|---|---|
| `etudiants` | `sel_etudiants` (008:76, **sans `FOR` donc FOR ALL**), `ins_/upd_/del_etudiants` (008:77-79), `"etudiants: tenant"` FOR ALL (067:95-101) | — | `'etudiants: tenant'`, `'tenant_isolation'`, `'etudiants: all'` (067:90-92), qui ne visent pas les politiques de 008 |
| `frais_scolaires` | `sel/ins/upd/del_frais` (008:83-86) ; `"frais_scolaires: academic read"` (034:170) ; `"…: financial write"` (034:181) ; `"frais_scolaires: tenant"` (067) | `"frais_scolaires: select\|insert\|update\|delete\|all"` (034:161-165) : **ces noms n'existent nulle part** | idem |
| `paiements_scolaires` | `sel/ins/upd/del_paie_sco` (008:90-93) ; `"…: read"` (034:204), `"…: write"` (034:215) ; `"…: tenant"` (067) | `"paiements_scolaires: …"` (034:195-199) : noms inexistants | idem |
| `notes_etudiants` | `sel/ins/upd/del_notes` (008:97-100) ; `"…: academic access"` (034:244), `"…: student read own"` (034:260) ; `"…: tenant"` (067) | `"notes_etudiants: …"` (034:235-239) : noms inexistants | idem |
| `absences_etudiants` | `*_absences` (011:19-22) ; `"…: tenant"` (067) | — | — |
| `enseignants`, `classes_ecole`, `planning_ecole` | 4 politiques chacune (018:64-79) ; `"…: tenant"` (067) | — | — |
| `subjects`, `sessions_ecole`, `exams`, `exam_grades`, `attestations`, `diplomas`, `defenses` | `*_tenant` FOR ALL (024:145-152) ; `"…: tenant"` (067) | — | — |
| `report_cards` | `rc_tenant` (024:149) seulement | — | hors boucle 067 |
| `teacher_hours` | `th_tenant_iso` (025:22) ; `"…: tenant"` (067) | — | — |
| `parent_links` | `pl_tenant_iso` (025:51) seulement | — | hors boucle 067 |
| `staff_ecole` | `tenant_isolation_staff_ecole` (037_staff:24-30), **inopérante** (`profiles.id = auth.uid()`, alors que `profiles.id` n'est pas l'identifiant d'authentification, cf. 118:5) ; `"staff_ecole: tenant"` (067) | — | — |
| `academic_settings` | 4 politiques (028:54-68) ; `"academic_settings: tenant"` (121:70-73) | — | hors boucle 067 |
| `notifications` | `notif_tenant_iso` (025:155) ; `notifications_select` (056:37) ; `notifications_update` (056:44-46, **sans condition de tenant**) ; `notifications_insert_service` **`WITH CHECK (true)`** (056:50-51) ; `"notifications: tenant"` FOR ALL (067) | — | — |

**Précisions :**
- `CATCHUP_008_to_025.sql` recrée les mêmes noms qu'en 008-025, sans rien ajouter ni supprimer.
- 168 ne fait qu'envelopper `auth.uid()`.
- Aucun `DISABLE ROW LEVEL SECURITY` ne vise ces tables.

**Fonctions utilisées par les politiques :**
- `get_my_tenant_id()` : dernière définition en 118:16-25 (`SECURITY DEFINER`, `ORDER BY created_at ASC LIMIT 1`, `search_path` épinglé de nouveau en 165:30-43).
- `fn_get_my_ecole_role()` (034:25-44), `fn_has_ecole_role` (034:50-63) et `fn_is_user_financial` (034:71-104) : `LIMIT 1` **sans `ORDER BY`**.
- La contrainte `UNIQUE(user_id)` sur `profiles` (001:32, 039:236-244) rend ce défaut théorique selon le dépôt. Il devient réel si la contrainte a été retirée en production (NOT_TESTABLE).

### 2.2 Droits effectifs par rôle (selon le dépôt)

| Rôle | SELECT | INSERT | UPDATE | DELETE |
|---|---|---|---|---|
| owner / admin / membre sans rôle École | toutes les tables École du tenant | oui | oui | oui |
| DIRECTION_GENERALE, RAF, SCOLARITE, DAAC, RH_PAIE, DTI | idem | oui | oui | oui |
| **FORMATEUR, ETUDIANT, PARENT** | **idem**, y compris notes, paiements, frais, diplômes, `parent_links` | **oui** | **oui** | **oui** |

Les politiques de 034 sont les seules à appeler une fonction de rôle. Elles sont combinées en OU avec des politiques purement tenant, donc elles ne restreignent rien.

### 2.3 Constats A

**A1 — Pas de cloisonnement par rôle dans la RLS** · CRITIQUE · CONFIRMÉ DANS LE CODE

- **Fichiers :** 008:76-100 ; 011:19-22 ; 018:64-79 ; 024:145-152 ; 025:22,51 ; 034:161-165,195-199,235-239 ; 067:62-101.
- **Scénario :** un compte ETUDIANT, connecté normalement, appelle directement l'API REST avec la clé publique de l'application et son jeton. Il peut lire toutes les notes, absences et paiements de l'établissement. Il peut aussi **modifier ses propres notes ou celles d'un camarade**, enregistrer de faux paiements et supprimer des lignes.
- **Correction recommandée :**
  1. Supprimer explicitement, nom par nom, les politiques `sel_/ins_/upd_/del_*`, `*_tenant`, `"<t>: tenant"`, `th_/pl_tenant_iso`, `rc_tenant` et les politiques 018/028 sur les tables École.
  2. Recréer l'isolation par tenant **en `AS RESTRICTIVE`** (une par table).
  3. Ajouter des politiques **PERMISSIVE par commande** conditionnées par `fn_has_ecole_role(...)`. Pour l'élève : `etudiants.user_id = auth.uid()`. Pour le parent : `EXISTS parent_links`.
  4. Ajouter `ORDER BY created_at` dans `fn_get_my_ecole_role`, `fn_has_ecole_role` et `fn_is_user_financial`.
  5. Cette correction suppose la matrice des droits par rôle (décision D4).
- **Tests :**
  - Sur une base de recette à deux tenants et un JWT par rôle : ETUDIANT → `select notes_etudiants` ne renvoie que ses lignes, `update` renvoie 0 ligne ; PARENT → seuls les enfants liés ; FORMATEUR → pas d'écriture dans `paiements_scolaires`.
  - Contrôle de `pg_policies` table par table, avec un nombre et des noms de politiques attendus.
- **Risque de régression :** élevé. SCOLARITE, DAAC ou RAF peuvent perdre un accès légitime, et des écrans lisent aujourd'hui des tables entières.

**A2 — Insertion libre de notifications dans un autre tenant** · ÉLEVÉE · CONFIRMÉ DANS LE CODE

- **Fichiers :** 056:48-51 (`CREATE POLICY "notifications_insert_service" ON notifications FOR INSERT WITH CHECK (true)`, commentaire « contrôlé par service_role au niveau app ») ; aucune suppression ultérieure.
- **Scénario :** un utilisateur authentifié de l'établissement A insère `{tenant_id: B, user_id: null, title, message, link}`. La notification apparaît chez tous les membres de B (025:155 et 067), ce qui permet un hameçonnage inter-établissement.
- **Correction :** supprimer cette politique. Les insertions passent par la clé de service ou par `fn_notify` corrigée (A3).
- **Tests :** avec un JWT du tenant A, `insert notifications(tenant_id = B)` doit être refusé.
- **Régression :** moyenne. Vérifier qu'aucune page n'insère de notification avec la clé publique ; plusieurs pages École le font, mais ces insertions échouent déjà (§6.3 de l'audit).

**A3 — Fonctions de notification sans contrôle de tenant** · ÉLEVÉE · CONFIRMÉ DANS LE CODE (privilèges réels NOT_TESTABLE)

- **Fichiers :** 032:53-80 (`fn_notify`, `fn_notify_broadcast`), 056:77-103. Toutes en `SECURITY DEFINER`. **Aucun `REVOKE` ni `ALTER DEFAULT PRIVILEGES` ne les concerne** : les seuls REVOKE du dépôt sont dans 013, 159, 161, 164 et 166.
- **Scénario :** `rpc('fn_notify_broadcast', { p_tenant_id: B, … })` depuis A. Si les privilèges par défaut de Supabase s'appliquent, l'appel est même possible avec la seule clé publique, sans connexion.
- **Correction :** `IF p_tenant_id IS DISTINCT FROM get_my_tenant_id() THEN RAISE EXCEPTION` (ou `fn_same_tenant()`, 039:87), `SET search_path`, `REVOKE EXECUTE … FROM public, anon`.
- **Tests :** appel vers un autre tenant → erreur ; appel en anonyme → erreur.

**A4 — Notifications personnelles visibles par tout le tenant** · ÉLEVÉE · CONFIRMÉ DANS LE CODE

- **Fichiers :** 067 ajoute `"notifications: tenant"` FOR ALL, ce qui annule le filtre `user_id` de 025:155 et 056:37. En complément, `notifications_update` (056:44-46) n'impose pas le tenant : un utilisateur peut déplacer sa propre notification vers un autre tenant (impact faible).
- **Correction :** retirer `notifications` de la politique tenant générique ; politique de lecture `user_id = auth.uid() OR (user_id IS NULL AND tenant_id = get_my_tenant_id())`.
- **Tests :** l'utilisateur U1 ne lit pas les notifications adressées à U2 du même tenant.

**A5 — Références inter-tenant par clés étrangères** · MOYENNE (latente) · CONFIRMÉ DANS LE CODE

- **Fichiers :** clés étrangères simples `etudiant_id`, `frais_id` (008, 024, 025), sans contrôle de tenant. Les `WITH CHECK` ne testent que le `tenant_id` de la ligne.
- **Points d'exploitation :**
  - `app/api/documents/attestation/route.ts:27-31` et `diploma/route.ts:28-32` : jointure `etudiants(...)` en `supabaseAdmin`, donc sans RLS.
  - Triggers `SECURITY DEFINER` qui lisent `etudiants WHERE id = NEW.etudiant_id` sans filtre de tenant (032:86-125, 032:221-245).
- **Scénario :** dans A, créer une attestation dont `etudiant_id` est l'identifiant d'un élève de B, puis télécharger le PDF : l'état civil de l'élève de B y figurerait. **Aujourd'hui la route échoue** : elle demande la colonne inexistante `numero_etudiant`, donc 404. La faille deviendrait exploitable si la colonne était corrigée sans filtre de tenant. L'identifiant à connaître est un UUID.
- **Correction :**
  - clés étrangères composites `(tenant_id, etudiant_id)`, ou trigger de vérification « même tenant » ;
  - jointures `etudiants!inner(...)` + `.eq('etudiants.tenant_id', tid)` ;
  - filtre de tenant dans les fonctions de triggers ;
  - extension de `trg_no_tenant_change` (039:116-136, qui ne couvre que `paiements_scolaires`, `etudiants`, `enseignants`) aux autres tables École.
- **Tests :** insertion depuis A d'une ligne pointant vers un élève de B → refus.

**A6 — Encaissement sans contrôle de rôle ni d'appartenance** · ÉLEVÉE · CONFIRMÉ DANS LE CODE

- **Fichiers :** `app/api/ecole/paiements/route.ts:3,6` (`requireTenant()` de `lib/tenant-guard.ts`, module déprécié, appelé sans argument ; `ctx.ecoleRole` jamais lu) ; `:22-33` (insertion en `supabaseAdmin`, statut forcé à `'paye'` en `:31`) ; `:17-20` (seul contrôle : montant > 0) ; `:40-57` (ECO-001).
- **Scénario :**
  - Un compte PARENT ou ETUDIANT appelle `POST /api/ecole/paiements` : un paiement « payé » est créé et un produit 706 est comptabilisé.
  - Un `etudiant_id` appartenant à un autre établissement est accepté, car la clé de service ignore la RLS et la clé étrangère ne contrôle que l'existence.
  - Un double clic produit un double encaissement (pas d'idempotence).
- **Correction :**
  - `requireTenant(req)` de `lib/api/require-tenant.ts` + contrôle du rôle École (RAF, SCOLARITE, DIRECTION_GENERALE, selon D4) ;
  - vérification par SELECT que l'élève et le frais appartiennent au tenant ;
  - validation des entrées (`annee`, `methode` sur liste blanche, plafond) ;
  - clé d'idempotence.
- **Tests :** ETUDIANT → 403 ; élève d'un autre tenant → 404 ; rejeu → aucun doublon.
- **Régression :** faible.

**A7 — Routes de documents sans contrôle de rôle** · MOYENNE · CONFIRMÉ DANS LE CODE

| Route | Garde | Rôle | Effet |
|---|---|---|---|
| `/api/documents/attestation`, `/diploma` (GET) | `auth.getUser()` + profil (`order`/`limit`) + `.eq('tenant_id')` | aucun | Tout membre, élève compris, peut générer le document de n'importe quel élève de son établissement (route actuellement cassée, cf. A5) |
| `/api/documents/bulletin-scolaire` (GET) | idem | aucun | Bulletin d'un autre élève (route cassée : tables absentes) |
| `/api/documents/email` (POST, l.10-37) | idem | aucun | Destinataire `to` libre : envoi d'un lien de document vers une adresse externe |
| `/api/bi/insights?module=ecole`, `/api/analytics/summary` | `requireTenant(req)` (+ plan) | aucun | Agrégats financiers scolaires visibles par tout membre |
| `/api/agents/ecole/impayes` | secret d'automatisation | — | Conforme |
| `/verify/[code]` | public, `fn_verifier_diplome` (123:227-250) | — | Exposition voulue (nom, diplôme, mention) |

- **Correction :** contrôle de rôle et vérification d'appartenance « élève ↔ demandeur » pour ETUDIANT et PARENT ; liste blanche de destinataires pour l'envoi par e-mail.
- **Tests :** ETUDIANT qui demande l'attestation d'un autre élève → 403.

**Pages client.** Les pages écrivent directement en base avec la clé publique : `scolarite` (11 écritures), `academic-sections` (4), `espace-etudiant` (2), `espace-formateur`, `direction`. **La RLS est donc le seul contrôle serveur, et elle ne filtre pas les rôles (A1).**

### 2.4 Scénarios d'accès aux données d'un autre établissement (synthèse)

| # | Vecteur | Condition | Statut |
|---|---|---|---|
| 1 | Insertion d'une notification dans B (A2) | être authentifié | CONFIRMÉ DANS LE CODE |
| 2 | `fn_notify_broadcast(B)` (A3) | privilège EXECUTE (par défaut dans Supabase) | CONFIRMÉ DANS LE CODE / privilèges NOT_TESTABLE |
| 3 | `fn_deliberer_annee(B)` (C1) | connaître l'UUID de B ; les tenants sont lisibles à cause de la fuite RLS `tenants_select` signalée par `MASTER-A-Z-AUDIT` | CONFIRMÉ DANS LE CODE |
| 4 | `fn_valider_parcours_etudiant(B, élève)` (C2) | connaître deux UUID | CONFIRMÉ DANS LE CODE |
| 5 | `seed_ecole_roles(B)` (025:61-86) | être authentifié | CONFIRMÉ DANS LE CODE (impact faible : `ON CONFLICT DO NOTHING`) |
| 6 | Paiement dans A pour un élève de B (A6), puis nom de l'élève de B dans une notification de A (032:221-245) | connaître l'UUID de l'élève | CONFIRMÉ DANS LE CODE |
| 7 | PDF d'attestation pointant vers un élève de B (A5) | colonne corrigée + UUID connu | Latent |

**Aucune politique `USING (true)` ni `auth.role() = 'authenticated'` en lecture sur les tables École.** Le déplacement d'une ligne vers un autre tenant par UPDATE est **bloqué** par les politiques tenant (USING réutilisé comme WITH CHECK), sauf pour `notifications` (A4).

> Rappel : ces conclusions portent sur les migrations du dépôt. L'ensemble réel des politiques actives en production est **NOT_TESTABLE**. Il se vérifie par `select * from pg_policies where tablename in (...)`.

---

## 3. B — Accès aux dossiers d'élèves par matricule

**Recherche dans tout le code** (`numero_id`, `numero_etudiant`, `matricule`) : 3 points d'entrée, **aucune route serveur**.

| Point d'entrée | Fichier:lignes | Contrôle |
|---|---|---|
| Recherche « élève » par matricule | `app/dashboard/ecole/espace-etudiant/page.tsx:347-362` (`lookupByNumeroId` : `.from('etudiants').select('*').eq('tenant_id', tenantId).ilike('numero_id', saisie).maybeSingle()`, puis `loadStudentData` qui charge notes, paiements et absences, :331-345) | Navigateur uniquement ; seule la RLS (tenant) s'applique |
| Recherche « admin » par nom ou matricule | `espace-etudiant/page.tsx:366-372` (`.or(\`numero_id.ilike.%${adminSearch}%,…\`)`, saisie non échappée) | idem ; vue inaccessible aux non-ETUDIANT à cause de `useRoleGuard(['ETUDIANT'])` (:262) |
| Filtre local de la liste Scolarité | `scolarite/page.tsx:84` | filtre en mémoire |

**B1 — Dossier d'un autre élève par matricule** · CRITIQUE (combinée à A1) · CONFIRMÉ DANS LE CODE

- **Mécanisme :**
  - Rattachement automatique par `etudiants.user_id` (:298-303). Aucun code ne renseigne cette colonne.
  - Repli par `etudiants.email` (:308-313), colonne absente des migrations. **En pratique, l'élève tombe sur la saisie manuelle du matricule.**
  - L'autorisation dépend **uniquement de la connaissance du matricule**. Il n'y a aucun contrôle côté serveur du lien entre le compte connecté et l'élève.
  - Les matricules sont séquentiels (`ETU-{année}-{n}`, `scolarite/page.tsx:89-91`), donc devinables. `ilike` accepte les jokers `%` et `_`.
  - Le bouton « Changer de compte » (:409) invite à consulter un autre dossier. Le matricule saisi est conservé dans `localStorage` (:359).
- **Portée :** limitée à l'établissement de l'élève (filtre `tenant_id` + RLS tenant). **Ce n'est pas un accès inter-établissement.**
- **Cause racine :** A1. Même sans cette interface, un ETUDIANT peut interroger directement `etudiants`, `notes_etudiants`, etc. Supprimer l'écran ne suffit pas.
- **Correction :**
  1. Supprimer la recherche par matricule de la vue élève.
  2. Rattacher l'élève exclusivement par `etudiants.user_id = auth.uid()`, renseigné par une route d'invitation côté serveur.
  3. Appliquer la RLS par rôle (A1).
  4. Échapper ou valider la saisie de la recherche admin.
- **Tests :** un ETUDIANT qui saisit le matricule d'un camarade n'obtient rien ; une requête REST directe sur un autre `etudiant_id` renvoie 0 ligne.
- **Régression :** les élèves sans `user_id` perdront l'accès tant que l'invitation n'est pas en place. La séquence est donc invitation, puis rattachement, puis fermeture.

**B2 — Un élève peut lever sa propre suspension** · MOYENNE · CONFIRMÉ DANS LE CODE

- **Fichiers :** `espace-etudiant/page.tsx:374-386` (`toggleBlock`, réservé à l'interface admin) ; mais la RLS UPDATE sur `etudiants` est au niveau du tenant (008:78, 067).
- **Scénario :** un ETUDIANT exécute `update etudiants set statut='actif', code_deblocage=null where id = <son id>` via l'API.
- **Correction :** comprise dans A1 (UPDATE de `etudiants` réservé à SCOLARITE et DIRECTION).
- **Tests :** update par un ETUDIANT → 0 ligne.

---

## 4. C — Délibérations universitaires

**Fonctions :** `fn_valider_parcours_etudiant` (123:105-145) et `fn_deliberer_annee` (123:150-222).

| Élément | `fn_valider_parcours_etudiant` | `fn_deliberer_annee` |
|---|---|---|
| Paramètres | `p_tenant_id UUID, p_etudiant_id UUID, p_annee TEXT, p_credits_requis INT DEFAULT 180` | `p_tenant_id UUID, p_annee TEXT, p_session TEXT DEFAULT 'normale', p_credits_requis INT DEFAULT 180` |
| Mode | `LANGUAGE plpgsql SECURITY DEFINER`, **sans `SET search_path`** | idem |
| Validation de l'établissement | **aucune** : `p_tenant_id` n'est jamais comparé à `get_my_tenant_id()` | **aucune** |
| Permissions | aucun contrôle de rôle ; **aucun GRANT ni REVOKE** dans le dépôt (vérifié sur toutes les migrations) | idem |
| Opérations | lecture agrégée de `semestres_etudiants` (crédits, moyenne), retour JSON | lecture de `semestres_etudiants` puis **INSERT … ON CONFLICT DO UPDATE** dans `deliberations_universite` (statut, mention, crédits, moyenne, date) ; retourne le nombre d'élèves |
| Appel applicatif | aucun | `app/dashboard/ecole/deliberations/page.tsx:129-134`, avec `p_tenant_id` et `p_credits_requis` fournis par le navigateur ; la page n'a **aucune garde de rôle** |

**C1 — Réécriture des délibérations, y compris dans un autre établissement** · CRITIQUE · CONFIRMÉ DANS LE CODE (privilèges réels NOT_TESTABLE)

- **Scénario 1 (inter-établissement) :** un utilisateur authentifié appelle `rpc('fn_deliberer_annee', { p_tenant_id: <UUID de B>, p_annee: '2025-2026', p_credits_requis: 0 })`. Tous les élèves de B ayant des semestres sont écrits **« admis » avec mention**, ce qui écrase des délibérations existantes. Le nombre retourné révèle aussi l'effectif.
- **Scénario 2 (interne) :** un ETUDIANT appelle la même fonction sur son propre établissement avec un seuil de crédits à 0.
- **Condition :** connaître l'UUID de l'établissement, que la fuite `tenants_select` (MASTER-A-Z-AUDIT) peut exposer. Selon les privilèges par défaut de Supabase sur le schéma `public`, l'appel pourrait même être possible en anonyme (NOT_TESTABLE).
- **Correction :**
  - `IF p_tenant_id IS DISTINCT FROM get_my_tenant_id() THEN RAISE EXCEPTION 'forbidden'` ;
  - contrôle de rôle (`fn_has_ecole_role('DIRECTION_GENERALE','DAAC')`) ;
  - seuil de crédits lu depuis `parcours_universite` / `academic_settings`, et non depuis l'appelant ;
  - `SET search_path = public, pg_temp` ;
  - `REVOKE EXECUTE … FROM public, anon` puis `GRANT … TO authenticated` ;
  - garde de rôle côté page et, idéalement, appel via une route serveur.
- **Tests :** appel avec un autre tenant → exception ; appel par un ETUDIANT → exception ; seuil fourni ignoré ; appel anonyme → refus.
- **Régression :** faible (une seule page appelante).

**C2 — Lecture des résultats d'un élève d'un autre établissement** · MOYENNE · CONFIRMÉ DANS LE CODE

- **Scénario :** `rpc('fn_valider_parcours_etudiant', { p_tenant_id: B, p_etudiant_id: X, p_annee })` renvoie les crédits et la moyenne de l'élève X de B. Il faut connaître deux UUID.
- **Correction et tests :** identiques à C1. La fonction n'étant appelée par aucune page, on peut aussi la restreindre au rôle de service.

---

## 5. D — Opérations financières, suspensions, paie

### 5.1 Défauts prouvés

**D1 — Suspension en masse par le calcul des impayés** · CRITIQUE · CONFIRMÉ DANS LE CODE

- **Fichiers :**
  - `app/dashboard/ecole/direction/page.tsx:55` (indicateur) et `:74` (`autoBlock`) : `.from('paiements_scolaires')…ilike('annee_scolaire', \`%${annee}%\`)` ;
  - `:56-57` / `:75-76` : `paidIds = new Set((data ?? []).map(...))` ;
  - `:77-79` : boucle `update({ statut: 'suspendu', code_deblocage: generateCode() }).eq('id', id)`.
- **Preuve de schéma :** `paiements_scolaires` (008:45-57, CATCHUP:184-196) n'a que `id, tenant_id, etudiant_id, frais_id, libelle, montant, mois, annee INTEGER, statut, methode, created_at`. Aucune migration ne lui ajoute de colonne.
- **Mécanisme :**
  1. PostgREST répond 400 (`42703`) ; supabase-js renvoie `{ data: null, error }` **sans lever d'exception**.
  2. Le code ne lit pas `error`, donc `paidIds` est vide, et **tous les élèves actifs** sont comptés impayés.
  3. Le bouton est actif dès qu'il existe un élève actif (`:112`).
  4. Il n'y a **aucun `confirm()`** dans le fichier : un clic suspend tous les élèves actifs (jusqu'à 200, `:667`) et **écrase leurs codes de déblocage**.
  5. La boucle est séquentielle et sans contrôle d'erreur. L'icône du bouton est `Unlock`.
- **Accès :** `useRoleGuard(['DIRECTION_GENERALE'])` (`:642`), côté client uniquement, owner inclus ; en base, l'UPDATE n'est limité que par le tenant (A1).
- **Si la colonne existait en production** (risque potentiel, NOT_TESTABLE) : un seul paiement de n'importe quel montant ou statut rendrait l'élève « à jour », et `%2026%` couvrirait deux années scolaires.
- **Correction :**
  1. **Désactiver immédiatement le bouton** (ou retirer `autoBlock`).
  2. Recréer le calcul côté serveur : dû − payé, filtré sur `annee` (entier) et `statut = 'paye'`, avec contrôle d'erreur.
  3. Aperçu de la liste et confirmation explicite.
  4. Ne pas régénérer un code existant.
  5. Journal d'audit.
- **Tests :** erreur PostgREST simulée → 0 suspension ; élève à jour jamais suspendu ; paiement partiel ; isolation des tenants.
- **Régression :** faible (fonction actuellement destructrice).
- **À vérifier en base (NOT_TESTABLE) :** nombre d'élèves `statut = 'suspendu'` et dates de modification, pour mesurer l'impact passé.

**D2 — Suppression d'un paiement sans contre-passation** · ÉLEVÉE · CONFIRMÉ DANS LE CODE

- **Fichiers :**
  - `scolarite/page.tsx:438-441` : `supabase.from('paiements_scolaires').delete().eq('id', id)`, sans contrôle d'erreur ni confirmation (bouton `:552`) ; page sans garde de rôle.
  - `app/api/ecole/paiements` n'expose que POST.
  - **Aucun trigger `ON DELETE`** sur `paiements_scolaires` dans les migrations.
- **Effet :** l'événement ECO-001, ses écritures `journal_entries` (5xx/706) et les lignes `transactions` restent en place. Le produit et la trésorerie sont surévalués.
- **Accès :** `del_paie_sco` (008:93) n'est jamais supprimée (034:198 vise `"paiements_scolaires: delete"`) et 067 ajoute FOR ALL. Tout membre du tenant peut donc supprimer.
- **Mécanisme disponible :** `fn_reverse_accounting_event(p_event_id UUID, p_reason TEXT, p_created_by UUID DEFAULT NULL) RETURNS UUID` (138:911, redéfinie en 187:93-97), déjà utilisée par `app/api/sales/[id]/reverse/route.ts:75`.
- **Correction :** route serveur « annuler » avec contrôle de rôle, qui :
  - retrouve l'événement ECO-001 traité ;
  - appelle `fn_reverse_accounting_event` ;
  - passe le paiement au statut `annule` (**pas de suppression physique**).

  Suppression des politiques DELETE ouvertes sur cette table.
- **Tests :** annulation → contre-écriture équilibrée et idempotente ; suppression directe par l'API → refusée.
- **Régression :** moyenne (les totaux doivent exclure `annule`).

**D3 — Émission comptable ECO-001 non vérifiée** · ÉLEVÉE · CONFIRMÉ DANS LE CODE

- **Fichiers :**
  - `app/api/ecole/paiements/route.ts:40-57` : `await supabaseAdmin.rpc('emit_accounting_event', {...})`, résultat ignoré ;
  - `fn_ae_execute_event` intercepte les exceptions et marque l'événement `error`/`dead_letter` (175:214) ;
  - le modèle `app/api/sales/[id]/paiement/route.ts:69-98` relit `accounting_events.status` et renvoie 409 si l'événement n'est pas `processed`.
- **Effet :** un paiement peut exister sans aucune écriture comptable, sans que personne ne soit averti.
- **Correction :** reprendre le modèle de la route ventes.
- **Tests :** moteur en échec → 409 et aucun paiement « payé ».

**D4 — Double ligne de trésorerie à chaque encaissement** · ÉLEVÉE · CONFIRMÉ DANS LE CODE (doublons réels NOT_TESTABLE)

- **Fichiers :**
  - **Chemin 1 :** `023_roles_accounts.sql:88-116`. `sync_paiement_scolaire_to_transaction()` insère dans `transactions` avec `source = 'paiements_scolaires'`, `ON CONFLICT (tenant_id, source, source_id) DO NOTHING`, via `trg_paiement_to_transaction AFTER INSERT OR UPDATE OF statut`. Recréé à l'identique dans `CATCHUP:481-504`. **Aucune migration ultérieure ne le supprime** : 143:94 ne supprime que `trg_paiement_scolaire`.
  - **Chemin 2 :** règle ECO-001 avec résolution de trésorerie (143:117-121). `175_treasury_impact_from_rules.sql:169-180` insère dans `transactions` avec `source = v_event.source_module` (`'ecole'`) et le même `source_id`.
  - La contrainte `transactions_source_unique (tenant_id, source, source_id)` (023:77-84) **ne joue pas**, car les deux sources diffèrent.
- **Effet :** deux entrées de caisse pour un encaissement unique ; si le moteur échoue, il reste une entrée de trésorerie sans écriture comptable. Le commentaire de validation de 143 (« QW-03 : double write éliminé », « 0 lignes attendues », :182-183) est **inexact** au regard du dépôt.
- **Correction :** migration de suppression `DROP TRIGGER IF EXISTS trg_paiement_to_transaction`, puis diagnostic et réparation **archivée** des doublons (`source = 'paiements_scolaires'` en face de `'ecole'` pour un même `source_id`), selon le modèle des migrations 176/177.
- **Tests :** un encaissement donne exactement une ligne `transactions` et un événement ECO-001 ; contrôle de `pg_trigger`.
- **Régression :** moyenne (les soldes de trésorerie historiques changent après réparation, ce qui demande une validation comptable).
- **À vérifier en base (NOT_TESTABLE) :** présence du trigger ; comptage des paires de doublons.

**D6 — Paie École calculée et persistée côté client** · ÉLEVÉE · CONFIRMÉ DANS LE CODE

- **Fichiers :** `app/dashboard/ecole/rh/page.tsx:1028-1050` (`calculerRetenuesEcole`, navigateur) ; `:1481-1497` (`supabase.from('paie_ecole').insert({ salaire_base, primes, retenues, net, statut: 'paye', … })`).
- **Effet :**
  - `net` et `retenues` sont fournis par le navigateur, donc **falsifiables** ;
  - aucune vérification d'unicité (employé, mois, année), donc double paie possible ;
  - les contraintes de `paie_ecole` sont inconnues (table fantôme, E1).
- **Précision :** la situation familiale réelle est utilisée pour les salariés `employes` (:1426-1427), mais forcée à « célibataire, 0 enfant » pour `enseignants` et `staff_ecole` (:1439-1440, :1451-1452, défaut :1036). L'affirmation « IRPP toujours célibataire » du rapport initial est donc **partiellement exacte**.
- **Correction :** faire passer la paie École par `/api/paie/bulletins` et `bulletins_paie` (calcul serveur, autorité C3, unicité).
- **Tests :** bulletin calculé côté serveur ; deuxième paie du même mois → 409.

**D7 — Paie École absente des déclarations IRPP et CNSS** · CRITIQUE (fiscal) · CONFIRMÉ DANS LE CODE

- **Fichiers :** `app/api/fiscalite/irpp/route.ts:31`, `app/api/fiscalite/cnss/route.ts:42`, `app/api/declarations/cnss/preremplir/route.ts:19` et `lib/declarations/declaration-generale.ts:117` lisent **uniquement `bulletins_paie`**. Aucun ne lit `paie_ecole` (seule mention : commentaire de `lib/compta-sync-client.ts:27`).
- **Effet :** les retenues prélevées sur le personnel École (IRPP, CNSS) ne sont jamais déclarées.
- **Correction :** comprise dans D6 (bulletins de paie uniques). La reprise de l'historique `paie_ecole` relève de la décision D7 de l'audit.
- **Tests :** un bulletin École apparaît dans la déclaration IRPP et CNSS du mois.

**D8 — Comptabilisation de la paie limitée au net** · ÉLEVÉE · CONFIRMÉ DANS LE CODE

- **Fichiers :** `rh/page.tsx:1505-1535` (`Promise.allSettled`, erreurs ignorées) :
  - `transactions` en sortie du **net** (:1507-1513) ;
  - `writeComptaEntry` 661/5xx pour le **net** (:1516-1523), qui écrit directement `journal_comptable` et `journal_entries` hors moteur (`lib/compta-sync-client.ts:138,157`, exemption EXM-JE-003) ;
  - 664/431 pour la part patronale (:1526-1534).
- **Effet :** les retenues salariales (431 pour la CNSS, 447 pour l'IRPP) ne sont jamais constatées ; la charge 661 est sous-évaluée de la différence brut − net.
- **Correction :** comprise dans D6 (le trigger `trg_bulletins_paie` de 046 et le moteur traitent la paie complète).
- **Tests :** écriture équilibrée brut = net + 431 + 447.

**D9 — Heures enseignants** · ÉLEVÉE · CONFIRMÉ DANS LE CODE

- **Fichiers :**
  - Schéma de `teacher_hours` (025:5-18) : colonnes `date, heures, matiere, classe, statut, taux_horaire, valide_par`, avec `CHECK (statut IN ('declare','valide','paye'))`.
  - `rh/page.tsx:1930` : `update({ statut: 'validated' })`, rejeté par le CHECK (23514), erreur ignorée et toast de succès (:1944).
  - `:1949` : le paiement exige `'validated'`, donc **inatteignable**.
  - `rh:1921` et `espace-formateur:139` : `order('date_declaration')`, colonne inexistante, donc liste vide.
  - `espace-formateur:707-711` : insertion de `date_declaration`, `periode`, `description`, donc échec et toast de succès.
  - Taux par défaut inventé de 5 000 (`rh:1952`) ; paiement écrit dans `journal_comptable` sans partie double ni retenue (:1972-1977).
- **Correction :** aligner le code sur le schéma (`valide`, `date`) ; contrôle des erreurs ; paiement des heures via la paie (D6).
- **Tests :** déclarer, valider, payer de bout en bout.
- **Régression :** faible.

**D10 — Fausse charge 641 à la création d'une fiche** · MOYENNE · CONFIRMÉ DANS LE CODE

- **Fichier :** `app/dashboard/ecole/rh/_components/CreateEmployeeWizard.tsx:204-215` (`journal_comptable.insert({ type: 'charge', montant_ht: salaireBrut, categorie: '641 — Rémunérations du personnel' })`, erreur avalée).
- **Correction :** supprimer cette écriture.
- **Tests :** créer une fiche ne produit aucune écriture comptable.

**D11 — Agent « impayés »** · FAIBLE · CONFIRMÉ DANS LE CODE

- **Fichiers :** `app/api/agents/ecole/impayes/route.ts:8-12` → `agents/securite.ts:188-207` (clé de service, `.eq('statut', 'bloque').limit(100)`, **sans filtre de tenant**, alerte dans `admin_alerts` globale).
- **Effet :** l'application n'écrit jamais `bloque`, seulement `suspendu`, donc le résultat vaut 0 ; aucun impayé n'est calculé.
- **Correction :** calcul par tenant après D1.

### 5.2 Risque potentiel (NOT_TESTABLE)

**D5 — Trigger `trg_ps_source_label`** · ÉLEVÉE si actif · NOT_TESTABLE

- **Fichiers :** 054:628-651 (`BEFORE INSERT OR UPDATE ON paiements_scolaires`, `NEW.source := COALESCE(NEW.source, 'paiement_scolaire')`) ; aucune colonne `source` sur `paiements_scolaires` dans les migrations ; trigger jamais supprimé.
- **Effet si actif sans la colonne :** **tout encaissement échouerait** (« record "new" has no field "source" »). Comme les encaissements semblent fonctionner, trois hypothèses : 054 non appliquée, colonne ajoutée hors migrations, ou trigger supprimé à la main. Dans tous les cas, le schéma de production n'est pas reproductible à partir du dépôt.
- **Vérification requise :** `pg_trigger` et `information_schema.columns`.

### 5.3 Points d'intégration avec le moteur comptable

| Flux | Chemin actuel | Conforme LOI-K | Cible |
|---|---|---|---|
| Encaissement scolarité | `emit_accounting_event('ECO-001')` (route serveur) + trigger 023 | Partiel (doublon D4, résultat non vérifié D3) | Moteur seul + vérification |
| Annulation d'encaissement | Aucun (suppression physique) | Non | `fn_reverse_accounting_event` |
| Saisies manuelles École | `ecole/comptabilite` vers `journal_comptable` / `transactions` | Non | Comptabilité globale |
| Paie École | `writeComptaEntry` + inserts directs (EXM-JE-003) | Non | `bulletins_paie` + trigger 046 |
| Heures enseignants | `journal_comptable` direct | Non | Paie |
| Création d'employé | `journal_comptable` (fausse charge) | Non | Aucune écriture |

---

## 6. E — Schéma de données

### 6.1 Les 11 tables absentes des migrations

**Méthode :**
- recherche de `CREATE TABLE [IF NOT EXISTS]`, `CREATE VIEW` et `CREATE MATERIALIZED VIEW` dans tout le dépôt (hors `node_modules`), y compris `supabase/*.sql`, `scripts/`, `tests/`, `docs/` ;
- recherche dans l'**historique Git complet** (`git log --all -G`) ;
- recherche de création depuis le code (`exec_sql`, chaînes SQL).

**Résultat : aucune création, nulle part, à aucun moment de l'historique.** L'existence en production est **NOT_TESTABLE** pour les 11.

| Table | Fichiers d'usage (opération) | Colonnes attendues (déduites du code) | Relations déduites | Indices d'existence en production | Classement |
|---|---|---|---|---|---|
| `annonces_ecole` | `ecole/direction/page.tsx` : 564 lecture, 571 insertion, 577 suppression | `id, tenant_id, titre, message, cible` (défaut `'tous'`), `created_at` | `tenant_id` → `tenants` | `docs/RESTART-AUDIT-AZ.md:388` la dit « inexistante » (introspection OpenAPI de la production, 2026-09-01) ; boucle 067 | PROBABLEMENT ABSENTE |
| `bourses_etudiants` | `direction` : 390 lecture, 397 insertion | `id, tenant_id, etudiant_id, montant, libelle, created_at` | `etudiant_id` → `etudiants` | même source : « inexistante » | PROBABLEMENT ABSENTE |
| `partenaires_ecole` | `direction` : 484 lecture, 491 insertion, 497 suppression (sans filtre tenant) | `id, tenant_id, nom, type` (défaut `'entreprise'`), `contact, description, created_at` | `tenant_id` | boucle 067 uniquement | INCONNUE |
| `paie_ecole` | `ecole/rh/page.tsx` : 1415 lecture, 1493 insertion (+ `transactions` / `writeComptaEntry` avec `source_id = paie.id`, 1511-1533) | `id, tenant_id, employe_id, mois, annee, salaire_base, primes, retenues, net, statut, mode_paiement, type_agent, created_at` | `employe_id` **polymorphe** (`employes` / `enseignants` / `staff_ecole` selon `type_agent`), sans clé étrangère possible | `supabase/backfill_paie_comptabilite.sql:30,45-47` (script manuel « à exécuter dans le SQL Editor » pour un tenant réel, qui suppose des lignes existantes) ; commentaire `lib/compta-sync-client.ts:27` ; aucune preuve d'exécution | PROBABLEMENT PRÉSENTE |
| `conges_ecole` | `rh` : 917 lecture, 926 insertion, 932 mise à jour (sans filtre tenant) | `id, tenant_id, employe_id, type_conge` (défaut `'annuel'`), `date_debut, date_fin, statut, motif, created_at` | `employe_id` → `enseignants.id` (liste déroulante :957) | `RESTART-AUDIT-AZ.md:388` « inexistante » | PROBABLEMENT ABSENTE |
| `recrutements_ecole` | `rh` : 1817 lecture, 1826 insertion, 1833 mise à jour | `id, tenant_id, titre, departement` (défaut `'Enseignement'`), `description, statut` (`'ouvert'`/`'ferme'`), `created_at` | `tenant_id` | `supabase/tests/validate_rls_wave4a.sql:37,393-407,441` et `rls_wave4a_rapport.sql:13,76,116`, écrits pour la base réelle ; `STABILIZATION_LOG` M-08 ; aucun résultat consigné | PROBABLEMENT PRÉSENTE |
| `cours_numeriques` | `ecole/espace-formateur/page.tsx` : 142 lecture, 322 insertion, 337 mise à jour, 342 suppression (sans filtre tenant) | `id, tenant_id, enseignant_id, titre, description, matiere, niveau, statut` (`'brouillon'`/`'publie'`), `created_at` | `enseignant_id` → `enseignants` | boucle 067 ; le code prévoit l'absence (« table cours_numeriques non trouvée », :328) | INCONNUE |
| `devoirs` | `espace-formateur` : 145 lecture, 431 insertion, 445 mise à jour, 450 suppression (sans filtre tenant) | `id, tenant_id, enseignant_id, titre, description, matiere, classe` (texte), `date_remise, statut` (`'ouvert'`/`'cloture'`), `created_at` | `enseignant_id` → `enseignants` ; classe en texte | boucle 067 | INCONNUE |
| `bulletins_notes` | `app/api/documents/bulletin-scolaire/route.ts:26-35` (lecture `supabaseAdmin`, route jamais appelée) | `id, tenant_id, etudiant_id, annee_scolaire, periode, classe, moyenne_generale, rang, effectif_classe, appreciation, mention, directeur, professeur_principal, statut` | `etudiant_id` → `etudiants` ; la jointure `etudiants(classes_ecole(...))` exige une clé étrangère qu'aucune migration ne crée | trigger conditionnel `IF EXISTS` (032:169-178) | INCONNUE |
| `notes_bulletin` | même route, :31 (jointure imbriquée) | `bulletin_id, matiere, note, note_max` (défaut 20), `coefficient` (défaut 1), `commentaire` | `bulletin_id` → `bulletins_notes` | aucun | INCONNUE |
| `absences_ecole` | `app/dashboard/page.tsx:180` (comptage, erreur avalée) | `id, tenant_id` | Confusion probable avec `absences_etudiants` (011) | boucle 067 | INCONNUE (doublon de nom probable) |

**Mentions SQL non créatrices :**
- **067** : boucle RLS `ALTER TABLE IF EXISTS … ENABLE ROW LEVEL SECURITY`, avec `EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'Table % ignorée'` (067:86,104-105). Elle cite 9 de ces tables (lignes 48, 64, 66, 67) et **ne prouve donc rien**.
- **032:169-178** : trigger conditionnel sur `bulletins_notes`.
- **`backfill_paie_comptabilite.sql`**, tests RLS sur `recrutements_ecole`.

**Rectification du rapport initial :** `AUDIT-EDUNET-ECOLE-ORAFORME.md §4.3` dit que ces tables sont « citées uniquement dans la boucle 067 ». C'est **inexact pour 4 tables** : `bulletins_notes` (citée en 032, absente de 067), `notes_bulletin` (citée nulle part en SQL), `paie_ecole` (citée aussi dans le script de backfill) et `recrutements_ecole` (citée aussi dans les tests RLS).

**Colonnes interrogées absentes des migrations** (rappel, CONFIRMÉ DANS LE CODE) :
- `paiements_scolaires.annee_scolaire` (D1), `.date_paiement` (`api/bi/insights:214`), `.source` (D5) ;
- `etudiants.email` (présente en production selon `TECH-DEBT-MIGRATION-CHAIN.md:55-66`, non tracée), `.numero_etudiant` ;
- `enseignants.user_id`, `employes.email` (supprimée par 038) ;
- `teacher_hours.date_declaration`, `.periode`, `.description` ;
- `notifications.titre`, `.etudiant_id`, `.destinataire_role` ;
- `parent_links.parent_user_id` (lue par le trigger 032:97 alors que la colonne est `user_id`, 025:40-47) ;
- `parcours_universite.libelle` (au lieu d'`intitule`, 122:73).

### 6.2 Pourquoi la chaîne de migrations ne peut pas être rejouée

Inventaire : 187 fichiers dans `supabase/migrations`.

| # | Cause | Preuve | Effet |
|---|---|---|---|
| 1 | Table inexistante dans 031 : `DROP TRIGGER IF EXISTS trg_paie_to_transaction ON fiches_paie;` puis `CREATE TRIGGER … ON fiches_paie` | `031_financial_triggers.sql:159-161` ; aucune création de `fiches_paie` dans le dépôt ; absente de la production selon `TECH-DEBT-MIGRATION-CHAIN.md:23-25` | `ERROR 42P01` au rejeu (constaté en exécution locale, `DB-LOCAL-RECOVERY-02.md:127-129`). `IF EXISTS` porte sur le trigger, pas sur la table. |
| 2 | Même défaut en 032 (`trg_paie_notify` sur `fiches_paie`) | `032:214-217` | Si 032 est exécutée en un seul bloc transactionnel, **elle ne peut pas avoir réussi telle quelle**. Les objets qu'elle crée (`fn_notify`, `trg_absence_notify`, `trg_paiement_notify`, trigger sur `bulletins_notes`) sont donc d'existence incertaine en production (déduction, NOT_TESTABLE). |
| 3 | Colonne `etudiants.email` utilisée par la politique 034 « student read own » | `034:260-271` ; colonne absente des migrations | `ERROR 42703` au rejeu ; la colonne existe en production sans migration |
| 4 | Tables `candidatures`, `candidats`, `fiscal_declarations` référencées sans création | `068_entretiens_ia.sql:7`, 110, 120, 164 ; `TECH-DEBT:82-133` | Échec au rejeu |
| 5 | Garde-fous `RAISE EXCEPTION` sur des comptages exacts | 176-179 ; `R006-ANO-P03-RECETTE-ENVIRONMENT.md:86` | Échec sur base vierge |
| 6 | Préfixe en double `037` (`037_enseignant_types.sql`, `037_staff_ecole_extended.sql`, toutes deux École) | `ls supabase/migrations` | Même numéro de version pour le CLI : conflit ou ordre dépendant du nom de fichier |
| 7 | Fichiers hors du format CLI : `CATCHUP_008_to_025.sql`, `142.5_fix_fn_ae_execute_event_country.sql` | `TECH-DEBT:143-144,177-179` | **Ignorés par le CLI**, alors que `142.5` corrige `emit_accounting_event` |
| 8 | Fichier daté `20260524_mission_critique.sql` | `R006:96-99` | Trié après 187 malgré un contenu antérieur |
| 9 | Numéros manquants 075, 076, 124, 125 | inventaire | Pas bloquant en soi |
| 10 | `038_employes.sql:2` : `DROP TABLE IF EXISTS employes CASCADE` | `R006:90` | Détruit les clés étrangères posées par 006, 007, 017 |
| 11 | Historique d'application en production inconnu | `supabase_migrations.schema_migrations` inaccessible (`PGRST106`, `BOI-010D:7-11`) ; CLI non lié (`DB-LOCAL-RECOVERY-01:56`) | Impossible de savoir quelles migrations École sont appliquées |
| 12 | Les 11 tables fantômes ne bloquent pas le rejeu (protégées par `IF EXISTS`/`EXCEPTION`) mais **ne sont jamais créées** | §6.1 | Une base de recette rejouée n'aurait aucune d'elles : Direction, RH et espace formateur y échoueraient |

**Migrations École dont l'application en production est prouvée :** aucune directement. 008 l'est de façon indirecte (colonnes de `etudiants` observées lors d'une introspection antérieure). BOI-010D ne couvre que 168-184 et indique explicitement que 001-167 n'ont jamais été vérifiées. **011, 018, 021, 024, 025, 028, 029, 032, 034, 036, 037 (×2), 054, 067, 118, 121, 122, 123 et 143 : application NOT_TESTABLE.**

**Aucune tentative de réparation de la chaîne n'a été faite.**

---

## 7. Rectifications apportées au rapport `AUDIT-EDUNET-ECOLE-ORAFORME.md`

Le rapport initial n'est pas modifié. Il faut lire ses constats avec les rectifications suivantes.

| Section du rapport initial | Rectification |
|---|---|
| §4.3 « fantômes citées uniquement dans la boucle 067 » | Inexact pour `bulletins_notes`, `notes_bulletin`, `paie_ecole`, `recrutements_ecole` (§6.1) |
| §5 H et §9.2 N3 « double ligne de trésorerie ❔ » | **CONFIRMÉ DANS LE CODE** (D4). Seule l'existence de doublons en production reste NOT_TESTABLE. |
| §9.1 R1 | Confirmé. De plus, les politiques `sel_*` de 008/011 sont **FOR ALL** (pas seulement SELECT), et l'écriture est ouverte à tous les rôles. |
| §5 I « IRPP toujours célibataire » | Partiellement exact : seulement pour `enseignants` et `staff_ecole` |
| Nouveaux constats | A2 (insertion de notification inter-tenant), A3 (`fn_notify*` sans contrôle), A4 (notifications lisibles par le tenant), A5 (FK inter-tenant), A7 (`/api/documents/email` destinataire libre), C1 (seuil de crédits choisi par l'appelant), D5 (`trg_ps_source_label`), politique `del_paie_sco` encore active, migration 032 probablement non appliquée telle quelle, commentaire de validation de 143 inexact |

---

## 8. Corrections proposées, de la plus urgente à la moins urgente

**Aucune n'est appliquée.** Chaque correction SQL suppose un canal d'application validé (décision D11 de l'audit). Les corrections RLS supposent la matrice des droits (D4).

| Ordre | Correction | Constats | Dépendances | Risque de régression |
|---|---|---|---|---|
| 1 | **Désactiver la suspension en masse** (`autoBlock`) et son bouton | D1 | aucune (code seul) | Très faible |
| 2 | **Relevé de la base en lecture seule** : `pg_policies` et `pg_trigger` des tables École ; `information_schema` (11 tables, colonnes citées) ; privilèges EXECUTE des fonctions `SECURITY DEFINER` ; doublons `transactions` ; élèves suspendus | D4, D5, E1, A1, C1 | Canal de lecture (D11) | Nul (lecture) |
| 3 | **Fermer les fonctions inter-établissements** : contrôle `p_tenant_id = get_my_tenant_id()` + rôle + `search_path` + REVOKE sur `fn_deliberer_annee`, `fn_valider_parcours_etudiant`, `fn_notify`, `fn_notify_broadcast`, `seed_ecole_roles` ; seuil de crédits non fourni par l'appelant ; garde de rôle sur la page Délibérations | C1, C2, A3 | 2 (pour connaître les privilèges réels) | Faible : une seule page appelante pour la délibération ; vérifier les appelants de `fn_notify` |
| 4 | **Supprimer `notifications_insert_service` (WITH CHECK true)** et retirer `notifications` de la politique tenant générique | A2, A4 | 2 ; vérifier qu'aucune insertion légitime ne passe par la clé publique | Moyen |
| 5 | **Sécuriser `POST /api/ecole/paiements`** : rôle, appartenance de l'élève et du frais, validation, idempotence, vérification du statut ECO-001 | A6, D3 | D4 (rôles autorisés) | Faible |
| 6 | **Refonte RLS par rôle des tables École** : isolation tenant en RESTRICTIVE, politiques par commande et par rôle, élève par `user_id`, parent par `parent_links`, `ORDER BY` dans les fonctions de rôle | A1, B1, B2 | 2 ; D4 ; **7 avant fermeture côté élève et parent** | **Élevé** : accès légitimes à revalider rôle par rôle ; écrans qui lisent des tables entières |
| 7 | **Rattachement des comptes élève et parent** par une route serveur d'invitation (`etudiants.user_id`, `parent_links`), puis suppression de la recherche par matricule | B1 | Service d'invitation (Lot 0d de l'audit) | Moyen : élèves non rattachés privés d'accès pendant la transition |
| 8 | **Annulation d'encaissement par contre-passation** (route serveur, `fn_reverse_accounting_event`, statut `annule`) et suppression des politiques DELETE ouvertes sur `paiements_scolaires` | D2 | 5 | Moyen : totaux à recalculer hors `annule` |
| 9 | **Supprimer le trigger `trg_paiement_to_transaction`**, puis diagnostic et réparation archivée des doublons de trésorerie ; traiter `trg_ps_source_label` selon le relevé | D4, D5 | 2 ; validation comptable | Moyen : soldes de trésorerie historiques modifiés |
| 10 | **Paie École sur le module global** (`/api/paie/bulletins`, `bulletins_paie`), retenues 431/447, unicité ; décision sur l'historique `paie_ecole` | D6, D7, D8 | 2 (schéma réel de `paie_ecole`) ; décision D7 | **Élevé** : reprise de l'historique, déclarations déjà déposées |
| 11 | **Heures enseignants** alignées sur le schéma (`valide`, `date`), contrôle des erreurs | D9 | aucune (code seul) | Faible |
| 12 | **Supprimer la fausse charge 641** du wizard | D10 | aucune | Très faible |
| 13 | **Clés étrangères inter-tenant** : FK composites ou trigger « même tenant », filtres de tenant dans les jointures `supabaseAdmin` et les fonctions de triggers, extension de `trg_no_tenant_change` | A5 | 2 ; 6 | Moyen : données existantes incohérentes à détecter avant contrainte |
| 14 | **Routes de documents** : contrôle de rôle et d'appartenance ; liste blanche des destinataires e-mail | A7 | 6 | Faible |
| 15 | **Agent impayés** recalculé par tenant | D11 | 1, puis le nouveau calcul serveur | Très faible |
| 16 | **Tables fantômes** : versionner par une migration `CREATE TABLE IF NOT EXISTS` conforme au schéma réel relevé, ou retirer les écrans qui en dépendent | E1 | 2 ; décision produit par écran | Moyen |
| 17 | **Chaîne de migrations** : référentiel de recette rejouable (hors périmètre de ce Lot, sans réparation à ce stade) | E2 | 2 ; environnement de recette (R-006) | — |

**Ce qui peut démarrer sans le relevé de la base :** les corrections 1, 11 et 12, qui ne modifient que du code applicatif. Les autres demandent au minimum le relevé (2) et les décisions D4/D11.

---

## 9. Bilan Git

| | Avant | Après |
|---|---|---|
| Branche / HEAD | `audit/r003-post-p0-forensic-validation` / `fb54a89` | identiques |
| `git status --porcelain` | 238 entrées | 239 (seul ajout : `?? docs/ORAFORME-ECOLE-LOT0-VERIFICATION.md`) |
| Empreinte `git diff` | `b2c99712…6fb939` | `b2c99712…6fb939` (identique) |
| Empreinte des fichiers non suivis existants | `16294b69…b6ef0c` | `16294b69…b6ef0c` (identique) |
| Stash | 0 | 0 |

**Arrêt de l'audit.** Aucune correction n'est engagée. Une validation explicite est attendue avant toute modification.

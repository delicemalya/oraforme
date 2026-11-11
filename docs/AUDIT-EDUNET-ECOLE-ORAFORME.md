# AUDIT EDUNET → ORAFORME — Rubrique École

| Champ | Valeur |
|---|---|
| Date | 2026-10-13 |
| Nature | Audit fonctionnel et technique, **lecture seule** |
| Branche | `audit/r003-post-p0-forensic-validation` — HEAD `fb54a89` |
| Copie de travail | 237 entrées non commitées préexistantes (dont 74 fichiers non suivis), conservées telles quelles |
| Modifications effectuées | Aucune, hormis la création de ce fichier |
| Accès base de production | **Non** — constats « table/colonne » établis à partir des migrations du dépôt |
| Vidéo EduNet | **Non accessible** — voir §2.3 |
| Audit antérieur réutilisé | `docs/ORAFORME_ECOLE_AUDIT_REFERENCE_VIDEO.md` (même jour). Ses constats critiques ont été revérifiés ligne par ligne. |
| Verdict | **BLOCKED** pour le développement fonctionnel ; Lot 0 prêt à être validé (§11) |

**Légende des états** : ✅ opérationnel · 🟡 partiel · 🖼️ interface seule · 🔴 défectueux · ❌ absent · ❔ NOT_TESTABLE.

**Preuves** : `fichier:ligne`. `ecole/…` = `app/dashboard/ecole/…`. Un numéro seul (`008`, `025:13`) renvoie à `supabase/migrations/NNN_*.sql`.

---

## 1. Résumé exécutif

1. **L'architecture cible existe déjà.** Oraforme dispose d'une rubrique École intégrée à l'application centrale :
   - menu sectoriel `SECTOR_SPECIFIC.ecole` ;
   - garde de secteur `ecole/layout.tsx` ;
   - 9 rôles dynamiques École ;
   - 22 pages ;
   - un moteur comptable avec règle ECO-001 ;
   - des services transversaux réutilisables (stockage, PDF, QR, notifications, audit, RH & Paie).

   Rien ne justifie une seconde application, une seconde authentification ou une navigation parallèle. **Le travail consiste à relier, sécuriser et compléter l'existant.**

2. **Sécurité : bloquant.** Constats prouvés dans le code et les migrations :
   - Tout membre d'un établissement, parents et élèves compris, peut lire et modifier toutes les notes, absences et paiements via l'API. Les policies par tenant des migrations 008 et 067 ne sont jamais supprimées et neutralisent le durcissement par rôle de 034.
   - Un élève peut ouvrir le dossier de n'importe quel camarade en saisissant son matricule.
   - Deux RPC `SECURITY DEFINER` acceptent un tenant arbitraire.
   - L'encaissement serveur ne contrôle ni le rôle, ni l'appartenance de l'élève au tenant.

3. **Fondations de données incomplètes.**
   - 11 tables utilisées par le code ne sont créées par aucune migration.
   - Une dizaine de colonnes interrogées n'existent pas dans le schéma versionné.
   - La chaîne de migrations n'est pas rejouable.
   - Aucune relation par clé étrangère entre année, classe et élève : la classe est stockée en texte libre.

4. **Fonctionnement réel.** Les écrans s'affichent, mais plusieurs opérations échouent silencieusement ou produisent des résultats faux :
   - suspension possible de **tous** les élèves par le calcul des impayés ;
   - heures enseignants impossibles à valider (contrainte CHECK) ;
   - collisions de matricule ;
   - notifications parents jamais créées ;
   - indicateurs du tableau de bord faux ;
   - paie École absente des déclarations IRPP et CNSS.

5. **Catégories d'établissement.** Le modèle actuel repose sur un sous-type unique et linéaire (garderie < primaire < collège < lycée < université). Il ne permet pas un complexe primaire + collège + lycée. Il cache les notes et les classes au primaire. Il affiche les onglets universitaires à une crèche (incohérence `creche`/`garderie`). Il ne contient aucun niveau fin (CP1…Tle, L1…D3) ni aucune configuration par pays.

6. **Correspondance EduNet.** Sur les 10 domaines :
   - **0** pleinement opérationnel ;
   - **6** partiels ou défectueux : établissement, tableau de bord, classes, élèves, pédagogie, finances ;
   - **2** majoritairement absents : carte et QR, réseau et recrutement ;
   - **2** partiels avec doublons majeurs : présences, personnel.

7. **Recommandation.** Valider le **Lot 0** (inventaire de la base, sécurité, fondations), puis dérouler les lots 1 à 9 de la §11. Les décisions de la §13 doivent être tranchées par un humain avant le Lot 1.

---

## 2. Périmètre inspecté et limites d'accès

### 2.1 Inspecté

- **Code applicatif** : 22 pages `app/dashboard/ecole/**` (~16 700 lignes), `_lib/*`, `rh/_components/*`.
- **API** :
  - `app/api/ecole/paiements`, `app/api/agents/ecole/impayes` ;
  - `app/api/documents/{bulletin-scolaire,attestation,diploma}` ;
  - `app/api/bi/insights`, `app/dashboard/bi/ecole`.
- **Composants** : `components/ecole/*`, `components/dashboard/Sidebar.tsx`, `components/dashboard/DashboardClient.tsx`.
- **Inscription et accès** : `app/onboarding/*`, `app/register`, `proxy.ts`, `app/verify/[code]`.
- **Bibliothèques** : `lib/erp-sectors.ts`, `lib/plan-access.ts`, `lib/plans.ts`, `lib/modules.ts`, `lib/tenant-guard.ts`, `lib/api/require-tenant.ts`, `lib/hooks/useRoleGuard.ts`, `lib/hooks/usePermissions.ts`, `lib/contexts/{TenantContext,PaysContext}.tsx`, `lib/tenant/TenantProfileFactory.ts`, `lib/storage/*`, `lib/erp-core/compute/payments.ts`, `lib/compta-sync-client.ts`, `lib/messaging.ts`, `lib/email-templates.ts`, `agents/securite.ts`.
- **Modules transversaux** : `app/dashboard/{rh,tresorerie,depenses,parametres,equipe,roles}`, `app/admin/*`, `app/portail/*`, `app/jobs/*`, `app/api/{hr,paie,factures,sales,storage,resto}`.
- **Migrations** : 001, 008, 011, 014, 018, 021, 022, 023, 024, 025, 028, 029, 031, 032, 034, 037 (×2), 038, 039, 041, 042, 043, 044, 047, 054, 056, 059, 060, 067, 072, 078, 093, 095, 096, 100, 107, 114, 118, 121, 122, 123, 126, 138, 139, 143, 163, 168, 175, 178, 187, `CATCHUP_008_to_025.sql`.
- **Documentation** : `MASTER-A-Z-AUDIT-2026-09`, `MASTER-REPAIR-REGISTER`, `MIGRATION-MAP-AZ`, `TECH-DEBT-MIGRATION-CHAIN`, `BOI-010D`, `LOI-K`, `LOI-M`, `LOI-N`, `LOI-O`, `C3`, `C4`, `R-006`.

### 2.2 Tests réellement exécutés (non destructifs)

| Commande | Résultat |
|---|---|
| `npx vitest run lib/architecture/loi-k-unique-writer.test.ts lib/architecture/loi-n-permission-engine.test.ts lib/architecture/paie-consommateurs-p0.test.ts` (lecture des sources, Supabase factice) | **3 fichiers, 16 tests, tous passés.** LOI-K passe parce que l'École bénéficie de l'exemption EXM-JE-003. LOI-N recense déjà `espace-etudiant` et `espace-parent` comme dettes. |
| `npx tsc --noEmit --incremental false` (aucun fichier écrit) | **0 erreur** dans tout le projet. Les colonnes fantômes ne sont pas détectées, car les requêtes Supabase ne sont pas typées par le schéma. |
| `npx eslint app/dashboard/ecole app/api/ecole components/ecole --no-cache` | **0 erreur, 6 avertissements** (variables inutilisées, par ex. `scolarite/page.tsx:393`) |
| Contrôle d'encodage (`grep` U+FFFD) | **264 caractères corrompus** : `scolarite/page.tsx` (67) et `rh/page.tsx` (197 au HEAD, 199 en local) |

**Non exécutés, car destructifs ou dépendants de la base :**

- `tests/certifications/c003-2-ecole-stability.spec.ts` : crée et supprime des comptes via `/auth/v1/admin/users` (`helpers/db.ts:184`).
- Les autres specs Playwright.
- `supabase/tests/*.sql`.
- Toute requête vers Supabase.
- Aucun parcours navigateur n'a été joué.

### 2.3 Vidéo EduNet

La vidéo **n'a pas pu être examinée**. Aucun fichier « EduNet » n'a été trouvé sur le poste (Téléchargements, Vidéos, Documents, OneDrive). Les deux enregistrements d'écran récents (`Downloads/mobizen_20261012_*.mp4`, 7 s et 2 s) montrent un écran de connexion **MoonBank** et non EduNet.

En conséquence, la colonne « Parcours ou écran de référence » de la matrice (§5) s'appuie **uniquement sur la liste des parcours fournie dans la consigne** : création de l'établissement, tableau de bord, paramètres et photos, années, classes et catalogue, élèves, dossier, carte et QR, présences, pédagogie et notes, encaissements et dépenses, personnel, réseau, portail et recrutement. **Aucun détail d'écran EduNet n'est affirmé**. Chaque ligne porte la mention « Vidéo : non observée ». Pour lever cette limite, il faut fournir le fichier vidéo ou une série de captures.

### 2.4 Limites

- Base de production inaccessible : les tables fantômes, les colonnes en dérive, les triggers effectifs, les policies RLS effectives et les privilèges RPC sont ❔ NOT_TESTABLE (§9.2).
- Pas d'environnement de recette (R-006).
- Aucune exécution navigateur : le rendu visuel et mobile est déduit du code.

---

## 3. Architecture scolaire existante

### 3.1 Couches et mécanismes

| Couche | Mécanisme réel | Constat |
|---|---|---|
| Framework | Next.js App Router (version à changements cassants, cf. `AGENTS.md`), Supabase (Postgres + RLS + Storage), client Supabase navigateur pour la quasi-totalité des écritures École | Les pages École écrivent directement en base depuis le navigateur ; seul l'encaissement passe par une route serveur. |
| Authentification | Supabase Auth, `profiles` multi-tenant (lecture `.order('created_at').limit(1)`), `proxy.ts` | Aucun mécanisme ne crée de compte enseignant, parent ou élève (§6.1). |
| Administration commune | `app/admin/**`, réservé à une liste blanche d'e-mails codée en dur (`lib/admin-config.ts:3`), transverse aux tenants | Espace opérateur SaaS. L'École ne doit rien y placer. |
| Administration du tenant | `app/dashboard/{equipe,roles,parametres}` | Rôles dynamiques (`roles`, `role_permissions`, `profiles.dynamic_role_id`) |
| Espace métier | `/dashboard/ecole/**` + garde `ecole/layout.tsx` (secteur uniquement, jamais le rôle) | `app/dashboard/page.tsx:53` redirige tout tenant École vers `/dashboard/ecole`. |
| Menu | `lib/erp-sectors.ts:63-205` (20 entrées, `roleFilter`, `minSousType`), rendu par `Sidebar.tsx:598-685` | Liste plate. La branche École ne lit pas `tenant_modules`. |
| Rôles École | DIRECTION_GENERALE, RAF, SCOLARITE, RH_PAIE, FORMATEUR, ETUDIANT, PARENT, DTI, DAAC (`seed_ecole_roles`, 025), cache `profiles.ecole_role_name` | Le trigger de synchronisation ne s'exécute que sur `UPDATE OF dynamic_role_id` (025:120-136). |
| Gardes | `useRoleGuard` (client, `useEffect`) sur 6 pages ; `proxy.ts:55-63` sur les 3 espaces | 15 pages sans garde de rôle ; aucun `usePermissions` (LOI-N) ; aucune garde par sous-type côté serveur. |
| Plans | `lib/plan-access.ts:59-96` : modules École dans `ALWAYS_VISIBLE` | Aucun gating effectif ; prix incohérents (35 000 dans `plans.ts:114`, 15 000 dans `modules.ts:262`). |
| Catégories | `tenants.sous_type` (095, sans CHECK) + rang `ECOLE_NIVEAU` (`erp-sectors.ts:46-52`) | §10. |

### 3.2 Correspondance avec le découpage Oraforme demandé

| Pilier | Implémentation | Écart |
|---|---|---|
| Dashboard | `ecole/page.tsx` (vue unique) ; `_lib/ecole-dashboard-client.tsx` (vues par rôle, **jamais importé**) | Vue identique pour tous les rôles, ETUDIANT et PARENT compris. |
| Direction générale | `ecole/direction` (8 onglets) | Aucun rapport ni export. |
| Direction école | Pas de page dédiée : fonctions réparties dans `scolarite` (10 onglets), `parametres-academiques` et les pages LMD | Pilier à structurer à partir de `scolarite`. |
| DAAC | `ecole/daac` (6 onglets, sections partagées) | Registres de diplômes et de soutenances en double. |
| RH & Paie | `ecole/rh` (2 171 lignes) | Implémentation parallèle au module RH global. |

---

## 4. Inventaire des routes, composants, services et tables

### 4.1 Routes

| Route | Garde de rôle | Tables principales | État |
|---|---|---|---|
| `/dashboard/ecole` | aucune | etudiants, enseignants, classes_ecole, absences_etudiants, paiements_scolaires, notes_etudiants, notifications, planning_ecole | 🟡 indicateurs faux |
| `…/direction` | client `DIRECTION_GENERALE` (:642) | + `bourses_etudiants`ᶠ, `partenaires_ecole`ᶠ, `annonces_ecole`ᶠ, diplomas, defenses | 🔴 suspension en masse |
| `…/daac` | client DG + DAAC | sessions_ecole, diplomas, defenses + sections académiques | ✅ avec doublons |
| `…/scolarite` | aucune | etudiants, frais_scolaires, paiements_scolaires, notes_etudiants, absences_etudiants, classes_ecole, planning_ecole, subjects, exams, exam_grades, attestations | 🟡 |
| `…/comptabilite` | client | journal_comptable, transactions | ♊ comptabilité parallèle |
| `…/tresorerie` | — | redirection vers `/dashboard/tresorerie` | ✅ conforme |
| `…/rh` | client DG, RAF, RH_PAIE (:2096) | employes, enseignants, staff_ecole, `paie_ecole`ᶠ, `conges_ecole`ᶠ, `recrutements_ecole`ᶠ, teacher_hours | 🔴 ♊ |
| `…/espace-parent` | client PARENT + proxy | etudiants, notes, paiements, absences, notifications | 🔴 |
| `…/espace-etudiant` | client + proxy | idem | 🔴 IDOR |
| `…/espace-formateur` | proxy uniquement | enseignants, teacher_hours, exams, exam_grades, `cours_numeriques`ᶠ, `devoirs`ᶠ, employes, bulletins_paie | 🔴 |
| `…/parametres-academiques` | aucune | academic_settings | 🖼️ jamais lu par un moteur |
| `…/annees-academiques` | aucune | annees_academiques | 🟡 université uniquement |
| `…/semestres`, `series`, `facultes`, `departements`, `parcours`, `unites-enseignement` | aucune | tables 121/122 | 🟡 |
| `…/deliberations` | aucune | deliberations_universite, RPC `fn_deliberer_annee` | 🔴 |
| `…/diplomes`, `soutenances`, `theses` | aucune | ecole_diplomes, ecole_soutenances, ecole_theses | 🟡 ♊ |
| `…/miaa` | — | redirection vers `/dashboard/miaa?context=ecole` | ✅ |
| `/dashboard/bi/ecole` | plan | `/api/bi/insights` | 🔴 colonne fantôme |
| `POST /api/ecole/paiements` | `requireTenant()` sans rôle | paiements_scolaires (`supabaseAdmin`) + `emit_accounting_event` | 🟡 risque R4 |
| `/api/agents/ecole/impayes` | secret cron | etudiants (tous tenants confondus) | 🔴 |
| `/api/documents/bulletin-scolaire` | auth + tenant | `bulletins_notes`ᶠ, `notes_bulletin`ᶠ | 🔴 non appelée |
| `/api/documents/attestation`, `/diploma` | auth + tenant | attestations, diplomas + QR | 🔴 non appelées ; colonne `numero_etudiant` et routes `/verify/...` inexistantes |
| `/verify/[code]` | public | RPC `fn_verifier_diplome` (123:224) | ✅ (pour `ecole_diplomes.verification_code`) |

ᶠ = table fantôme, absente de toute migration.

### 4.2 Composants partagés

- `_lib/shared.tsx` (483 l.) contient :
  - les constantes `NIVEAUX` (6 cycles seulement, :69-76), `PERIODES`, `MENTIONS` (:86-92) et `DEFAULT_FRAIS` (:105-117) ;
  - `calcMoyenne` ;
  - les impressions `printBulletin`, `printReceipt`, `printAttestation`, `printDiploma` (`document.write`, sans échappement).
- `_lib/academic-sections.tsx` (1 028 l.) regroupe les sections Matières (avec enseignant), Sessions, Examens (saisie par lot et rang), Attestations, Diplômes et Soutenances.
- `_lib/ecole-dashboard-client.tsx` (537 l.) : **code mort**.
- `rh/_components/CreateEmployeeWizard.tsx` (677 l., doublon du wizard global) et `ProfilDrawer.tsx` (539 l., présentationnel).
- `components/ecole/{BulletinPDF,AttestationPDF,DiplomaePDF}.tsx` : rendus react-pdf. `BulletinPDF` n'est jamais atteint.

### 4.3 Tables (47 référencées par le code)

| Domaine | Tables (migration de création) | Clés et relations |
|---|---|---|
| Élèves | `etudiants` (008 ; ALTER 025 `user_id`, 121 `ecole_subtype`, 122 `faculte_id`/`parcours_id`) | `UNIQUE(tenant_id, numero_id)` (008:30) ; `classe` TEXT ; `annee_scolaire` TEXT ; responsable légal en colonnes texte |
| Classes et niveaux | `classes_ecole` (018 ; ALTER 121 `serie`, `section`) ; `series_lycee` (121) ; `NIVEAUX` constante | `classes_ecole.enseignant_id` jamais renseigné ; aucune FK classe → élève ni classe → année |
| Années | `annees_academiques` (123) ; `academic_settings` (028, puis recréée en 121) | Aucune table ne référence `annees_academiques` |
| Pédagogie | `subjects`, `sessions_ecole`, `exams`, `exam_grades`, `report_cards`, `attestations`, `diplomas`, `defenses` (024) ; `notes_etudiants` (008) ; `unites_enseignement`, `semestres_etudiants` (121) ; `facultes`, `departements_universite`, `parcours_universite` (122) ; `deliberations_universite` (123) ; `ecole_theses`, `ecole_soutenances`, `ecole_diplomes` (100) | `subjects.enseignant_id` ✅ ; `report_cards` inutilisée ; `ecole_*.etudiant_id` **sans FK** |
| Présences | `absences_etudiants` (011 ; ALTER 018, 025, 121) | FK élève en cascade ; `demi_journee` inutilisée |
| Finances | `frais_scolaires`, `paiements_scolaires` (008) ; `ecole_wallets`, `ecole_wallet_movements`, `ecole_cheques`, `ecole_virements` (029, inutilisées) | `paiements_scolaires.etudiant_id` et `frais_id` en FK ; frais **sans classe, niveau ni année** |
| Personnel | `enseignants` (018 ; 037), `staff_ecole` (037), `teacher_hours` (025), `employes` (038, cœur) | `teacher_hours.statut` CHECK (`declare`, `valide`, `paye`) (025:13-14) |
| Accès | `parent_links` (025:38 : `user_id`, `etudiant_id`, `relation`, `UNIQUE(user_id, etudiant_id)`) | **Jamais utilisée** |
| Transverses | `notifications` (025, 056, 060), `planning_ecole` (018), `journal_comptable`, `transactions`, `bulletins_paie`, `tenants`, `profiles`, `entreprise_config` | — |
| **Fantômes** | `annonces_ecole`, `bourses_etudiants`, `partenaires_ecole`, `paie_ecole`, `conges_ecole`, `recrutements_ecole`, `cours_numeriques`, `devoirs`, `bulletins_notes`, `notes_bulletin`, `absences_ecole` | ❔ citées uniquement dans la boucle RLS de 067 (`ALTER TABLE IF EXISTS`) |

### 4.4 Services et RPC

- **RPC** :
  - `emit_accounting_event` (138:826) ; règles ECO-001 (actif) et ECO-002 (brouillon) (143) ; `fn_reverse_accounting_event` (187:93) ;
  - `fn_deliberer_annee`, `fn_valider_parcours_etudiant`, `fn_verifier_diplome` (123) ;
  - `seed_ecole_roles` (025) ;
  - `fn_notify`, `fn_notify_broadcast` (032:53,71) ; `fn_audit_log` (059:272).
- **Triggers sur les tables École** :
  - `trg_paiement_to_transaction` (023:85-117, **jamais supprimé**) ;
  - `trg_paiement_notify` (032), `trg_ps_source_label` (054:628) ;
  - `trg_absence_notify` (032:97, lit `parent_user_id` alors que la colonne réelle est `user_id`) ;
  - `gen_attestation_ref`, `gen_diploma_number` (024) ;
  - `trg_no_tenant_change` (039) ;
  - `trg_auto_seed_ecole_roles` (025:85-98), `sync_ecole_role_name` (025:120-136).

---

## 5. Matrice EduNet / Oraforme

Toutes les lignes portent la mention « Vidéo : non observée (§2.3) ». La colonne « Parcours » reprend la consigne, pas des écrans vus.

### A. Création et configuration de l'établissement

| Fonctionnalité EduNet | Parcours | Équivalent Oraforme | Fichiers / tables | État | Écart précis | Réutilisable | Correction / adaptation | Dépendances / risques | Prio |
|---|---|---|---|---|---|---|---|---|---|
| Informations générales et responsable | Création | Inscription Oraforme | `app/onboarding/page.tsx:790-848`, `actions.ts:99-139`, `tenants`, `profiles` | 🟡 | Seuls nom, téléphone, pays, e-mail et mot de passe sont saisis ; le responsable est enregistré avec `prenom=''` et `nom=''` (:268-269, :292-293) | Parcours d'inscription, `createTenantAndProfile`, `TenantProfileFactory` | Ajouter une étape « responsable » au parcours existant | LOI-M : `app/api/admin/tenant/create/route.ts:44-51` contourne la factory (ni secteur, ni pays) | P1 |
| Coordonnées, localisation, paramètres régionaux | Création | `entreprise_config` + `tenants` (096) | `parametres/page.tsx:225-455`, `ProfilCompletionPopup.tsx`, `profil/actions.ts:74-109`, `PaysContext.tsx:25-29` | 🟡 🔴 | 3 stockages concurrents ; `tenants.pays` jamais mis à jour après l'inscription, et le changement de pays fait dans les paramètres est écrasé par `DashboardShell.tsx:13-15` ; aucun fuseau horaire ; langue forcée à `fr` | `PaysSelector`, `PAYS_DISPONIBLES` | Source unique : `tenants` pour le code pays, la devise et la langue ; `entreprise_config` pour l'affichage | 4 listes de pays divergentes | P1 |
| Devise et paramètres scolaires | Création | Devise en texte libre dans `entreprise_config` (:455) ; `academic_settings` | `parametres-academiques/page.tsx:485-506` | 🖼️ | Les paramètres scolaires ne sont lus par aucun moteur ; aucun réglage créé à l'inscription | `academic_settings` (embryon de profil pédagogique) | Initialiser les réglages à la création ; les brancher sur le calcul des notes | Valeur par défaut de `mentions` ambiguë (028 contre 121) ❔ | P1 |
| Conditions générales et confirmation | Création | Mention passive (`onboarding/page.tsx` ~:885) | `app/legal/cgu/page.tsx` | 🔴 | Pas de case à cocher, pas d'horodatage ni de version ; lien `/cgu` alors que la page est `/legal/cgu` (404 probable, non testé) | Page CGU | Case obligatoire, version et date de consentement stockées | Juridique | P1 |
| Profil et photos de l'établissement | Paramètres | Logo (buckets `logos` **et** `entreprise`) ; `photo_dirigeant` saisie par URL | `parametres/page.tsx:211-224`, `parametres/conformite/page.tsx:125-128,199` | 🟡 ❌ | Aucune galerie photo ; deux buckets pour le logo | `storage-service` | Galerie via `storage-service` (catégorie `ecole` déjà prévue) | Policies du bucket `documents` ❔ | P3 |
| Années scolaires | Paramètres | `annees_academiques` + page CRUD | `annees-academiques/page.tsx:68-124`, 123:42 | 🟡 | Réservé à l'université (:124) ; aucune année créée à l'inscription ; plusieurs années « en cours » possibles ; aucune FK ; « 2024-2025 » codé en dur 11 fois | Table et page | Étendre à tous les cycles ; une seule année active (index unique partiel) ; FK depuis classes, inscriptions, frais et notes | Reprise des données texte | **P0** (fondation) |
| Réutilisation de la création de compte | — | Parcours unique Oraforme | `onboarding`, `TenantProfileFactory`, `tenant_modules` | ✅ | Le sous-type n'est pas validé (`actions.ts:27-40`) ; plan et catégorie sont couplés (`page.tsx:33-84`) | Tout le parcours | Ajouter les étapes École **dans** le parcours existant | — | P1 |

### B. Tableau de bord

| Fonctionnalité | Équivalent | Fichiers | État | Écart | Réutilisable | Adaptation | Prio |
|---|---|---|---|---|---|---|---|
| Effectifs réels | KPI élèves et enseignants | `ecole/page.tsx:361-382` | 🟡 | « +N actifs ce mois » affiche le total (:558) ; données plafonnées à 200 | Requêtes filtrées par tenant | Corriger les libellés ; utiliser des comptages (`count`) | P1 |
| Présences | Taux de présence | `ecole/page.tsx:401` | 🔴 | Divise par l'ensemble des inscrits, inactifs compris | — | Calcul par classe, sur la période | P1 |
| Recettes, dépenses, trésorerie | Graphe « Paiements vs prévisions » | `ecole/page.tsx:370,438-450,745-764` | 🔴 | Seul le mois courant est chargé alors que 10 mois sont tracés ; aucune série « prévisions » ; libellés de mois figés (:158) ; aucune dépense ni trésorerie | `lib/erp-core/compute/payments.ts` (inutilisé) ; trésorerie globale | Brancher sur `journal_entries` et la trésorerie globale | P1 |
| Paiements récents et soldes | Liste des derniers paiements | `direction:45-48` | 🟡 | Aucun solde (la notion de montant dû n'existe pas) | — | Après le Lot 6 | P1 |
| Rappels, événements, année active | `planning_ecole` | `ecole/page.tsx` | 🟡 | Sélecteur d'année généré côté client (:330-338), sans lien avec la base | — | Brancher sur l'année active | P1 |
| Actions rapides | Raccourcis | `ecole/page.tsx:546,782-797` | 🖼️ | 4 raccourcis mènent à `/ecole/direction` | — | Raccourcis réels | P2 |
| Données de démonstration | — | `ecole/page.tsx:458` (taux de réussite = moyenne × 5) ; `DEFAULT_FRAIS` ; `ecole-dashboard-client.tsx:465` (`"—"` en dur) | 🔴 | Valeurs calculées présentées comme réelles | — | Supprimer les KPI fabriqués | P1 |
| Vue par rôle | — | `_lib/ecole-dashboard-client.tsx` (mort) | ❌ | ETUDIANT et PARENT voient les KPI de l'établissement | Composant mort (9 vues) | Le rebrancher derrière une garde | **P0** (sécurité) |

### C. Classes et niveaux

| Fonctionnalité | Équivalent | Fichiers / tables | État | Écart | Réutilisable | Adaptation | Prio |
|---|---|---|---|---|---|---|---|
| Catalogue des classes possibles | `NIVEAUX` (6 cycles) | `_lib/shared.tsx:69-76` | 🔴 | Aucun niveau fin : maternelle, CP1-CM2, 6e-3e, 2nde-Tle, L1-D3 | — | Référentiel `niveaux_scolaires` par pays et par cycle (décision D3) | P0/P1 |
| Classes ouvertes | `classes_ecole` + `SectionClasses` | `scolarite:705-787`, 018 | 🟡 | Création et suppression seulement (pas de modification) ; suppression sans confirmation ; **le primaire n'a pas l'onglet Classes** (`scolarite:1060-1063`) | Table, section | Modification, confirmation, onglet ouvert à tous les cycles | P1 |
| Niveaux, sections, séries, options | `series_lycee`, `classes_ecole.serie`/`section` | `series/page.tsx:23-28`, 121:22-28 | 🖼️ | Séries A à E seulement, isolées : aucun lien avec les classes, aucun coefficient par série ; `serie`/`section` jamais écrits | Table `series_lycee` | Relier série → classe → matières | P2 |
| Matières de la classe | `subjects` | 024:7-16 | ❌ | `subjects` n'a pas de `classe_id` ; aucun catalogue par défaut | `subjects` | Table de liaison classe × matière × année | P1 |
| Création depuis catalogue et personnalisée | — | — | ❌ | Seule la création libre existe | — | Catalogue + personnalisation | P1 |
| Capacité, année, effectifs, enseignant, frais | `nb_places`, `enseignant_id` | 018 | 🖼️ | Capacité jamais contrôlée ; titulaire jamais renseigné ; aucun lien avec l'année ni avec les frais | Colonnes | FK vers l'année ; contrôle de capacité | P1 |
| Recherche, filtres, détail | — | — | ❌ | Pas de vue détaillée d'une classe | — | Fiche classe | P2 |
| Adéquation au pays | — | `pays` n'est lu nulle part dans `ecole/**` | ❌ | Aucune configuration par pays | — | Référentiel par pays | P2 |

### D. Élèves et inscriptions

| Fonctionnalité | Équivalent | Fichiers | État | Écart | Réutilisable | Adaptation | Prio |
|---|---|---|---|---|---|---|---|
| Identité, coordonnées, naissance, photo | Formulaire d'inscription | `scolarite:88-102,283-300` | 🟡 | Photo par URL saisie à la main (:284) ; fiche non modifiable après création | Formulaire complet | Upload via `storage-service` ; écran d'édition | P1 |
| Matricule unique | `numero_id` = `ETU-{année}-{count+1}` | `scolarite:89-91`, 008:30 | 🔴 | Collision après une suppression ou en cas de concurrence, avec échec silencieux | Contrainte UNIQUE | Compteur transactionnel commun (§6.3) | **P0** |
| Classe et année | Texte libre | `scolarite:283`, 008:28 | 🔴 | Aucune FK ; le renommage d'une classe détache ses élèves (`acad:340-341`) | — | `classe_id` et `annee_id` | **P0** (fondation) |
| Parent / responsable légal | Colonnes texte + `parent_links` | 008, 025:38 | 🖼️ | `parent_links` jamais utilisée ; espace parent rattaché par `ilike` sur l'e-mail | `parent_links` | Rattachement par compte (§6.1) | **P0** |
| Statut d'inscription | `statut` (actif / suspendu…) | `scolarite:104` | 🟡 | Ni réinscription, ni transfert, ni historique annuel | — | Inscription annuelle | P1 |
| Recherche, filtres, liste | Recherche client + filtre de statut | `scolarite:81-85,1101` | 🟡 | Pas de filtre par classe ou niveau ; `limit(200)` sans pagination | — | Pagination et filtres | P1 |
| Fiche détaillée | Panneau flottant (5 champs) | `scolarite:219-279` | 🟡 | Ne centralise ni les documents, ni les présences, ni les finances, ni les résultats | `ProfilDrawer.tsx` (présentationnel) | Fiche 360 lisant les tables existantes, sans copie | P2 |
| Documents | — | — | ❌ | Aucun upload | `storage-service`, tables `documents*` | Catégorie `ecole` + contrôle de lecture par rôle | P2 |
| Impression et export | — | `diplomes:215` (CSV) uniquement | ❌ | Pas d'export des élèves | `exceljs` (`api/documents/rapport-excel`) | Export côté serveur | P2 |
| Suppression | `delete` sans confirmation | `scolarite:119,212,276` | 🔴 | Cascade sur notes, paiements et absences (008:49,61 ; 011:10) ; aucune trace | `global_audit_trail` | Archivage plutôt que suppression ; confirmation ; trigger d'audit | **P0** |

### E. Carte d'élève et QR code

| Fonctionnalité | Équivalent | Fichiers | État | Écart | Réutilisable | Adaptation | Prio |
|---|---|---|---|---|---|---|---|
| Génération de carte (photo, identité, matricule, établissement, année) | — | — | ❌ | Aucune carte imprimable ; la « grille de cartes » est un affichage d'interface (`scolarite:156`) | Planche d'étiquettes `stocks/codes-barres/page.tsx:51-116` ; PDF serveur `api/documents/attestation` (react-pdf + `qrcode`) | PDF serveur de carte | P2 |
| QR code | QR uniquement sur attestations, diplômes et factures | `api/documents/attestation:55-58`, `diploma:49-52` | 🔴 | URLs `/verify/attestation/{id}` et `/verify/diploma/{id}` inexistantes (seule `app/verify/[code]` existe) ; routes jamais appelées | `qrcode`, `app/verify/[code]`, `fn_verifier_diplome` | Jeton opaque de vérification (pas l'UUID de l'élève) | P2 |
| Impression et téléchargement | — | — | ❌ | — | `renderToBuffer` (12 routes) | — | P2 |
| **Scan** → retrouver l'élève → enregistrer la présence | — | — | ❌ | Aucune bibliothèque de scan, ni `BarcodeDetector` ni `getUserMedia` dans le dépôt | — | Scan caméra (`BarcodeDetector` + bibliothèque de repli : **nouvelle dépendance à valider**, D9) | P2 |

La simple génération d'un QR code est possible avec les briques existantes. La capacité à **scanner, identifier un élève et enregistrer une présence est entièrement absente**.

### F. Présences

| Fonctionnalité | Équivalent | Fichiers | État | Écart | Réutilisable | Adaptation | Prio |
|---|---|---|---|---|---|---|---|
| Enregistrement | Absence saisie élève par élève | `scolarite:899-1050`, `absences_etudiants` | 🟡 | Pas d'appel par classe ni de statut présent/retard ; seules les absences sont stockées | Modèle RH `presences` (047:39-75 : `type` CHECK présent/absent/retard, `UNIQUE(tenant_id, employe_id, date)`) | Feuille d'appel par classe, sur le modèle `presences` | P1 |
| Historique et filtres | Historique par élève avec KPI | `scolarite` | 🟡 | Pas de filtre par classe ou période | — | Vues par classe et par période | P1 |
| Scan QR | — | — | ❌ | cf. E | — | Lot 4 | P2 |
| Détection des doublons | — | — | ❌ | Aucune contrainte d'unicité sur `absences_etudiants` | Contrainte UNIQUE de `presences` | `UNIQUE(tenant_id, etudiant_id, date, demi_journee)` | P1 |
| Correction et traçabilité | Suppression directe | `scolarite:959` | 🔴 | Ni historique ni audit | `fn_audit_*` (059) | Trigger d'audit | P1 |
| Notifications aux parents | Inserts `notifications` côté client | `scolarite:934-952` ; trigger 032:97 | 🔴 | Colonnes inexistantes (`titre`, `etudiant_id`…) ; le trigger lit `parent_user_id` ; `notifie_parent: true` est enregistré à tort (:919) | `fn_notify`, `queueEmail`/`sendSMS` + cron (`app/api/cron/run:105-204`) | Helper serveur `notify()` (§6.7) | P1 |

### G. Pédagogie

| Fonctionnalité | Équivalent | Fichiers | État | Écart | Réutilisable | Adaptation | Prio |
|---|---|---|---|---|---|---|---|
| Matières et affectations | `subjects.enseignant_id` | `acad:41-67` | 🟡 | Un enseignant par matière ; aucune affectation enseignant × classe × matière × année ; `classes_ecole.enseignant_id` jamais renseigné | `subjects` | Table d'affectation | P1 |
| Enseignants | `enseignants` | 018, 037 | 🟡 ♊ | Aucun lien avec `employes` ni avec un compte (`enseignants.user_id` interrogé mais inexistant) | — | `enseignants.employe_id` (+ compte) | P1 |
| Évaluations et notes | **Deux systèmes** : `notes_etudiants` (matière en texte libre) et `exams`/`exam_grades` | `scolarite:567-700`, `acad:41-590` | ♊ 🔴 | Aucun pont entre les deux ; `exam_grades` inséré sans `tenant_id` depuis l'espace formateur (:579) ; erreurs ignorées ; **primaire sans onglet Notes** | `exams`/`exam_grades` (sessions, matières, enseignant, saisie par lot) | Un système unique (décision D5) | P1 |
| Moyennes et règles | `calcMoyenne` (`shared:129`) ; rang dans `acad:511-583` | — | 🔴 | Bulletin limité au coefficient de la 1re note ; rang calculé sur tout l'établissement ; `academic_settings` ignoré ; `PERIODES` mélange trimestres et semestres pour toutes les catégories | `calcMoyenne`, synthèse avec rang | Moteur de calcul testé, paramétré par le profil pédagogique | P1 |
| Bulletins et historique annuel | `printBulletin` (`document.write`) ; `report_cards` inutilisée ; route bulletin cassée | `shared:141-172`, `api/documents/bulletin-scolaire` | 🔴 | XSS ; pas d'archivage | `BulletinPDF.tsx`, `report_cards` | PDF serveur + archivage | P1 |
| LMD | UE, semestres, délibérations | 121-123, `deliberations:99` | 🔴 | `libelle` lu au lieu d'`intitule` ; `credits_obtenus` et `moyenne` jamais renseignés ; RPC cross-tenant | Moteur 123 | Correction et alimentation | P1 |
| Tests de calcul | — | — | ❌ | Aucun test unitaire | — | Lot 5 | P1 |

### H. Finances scolaires

| Fonctionnalité | Équivalent | Fichiers | État | Écart | Réutilisable | Adaptation | Prio |
|---|---|---|---|---|---|---|---|
| Frais et échéanciers | `frais_scolaires` (liste plate) | 008:33-43, `scolarite:379-385` | 🟡 | Pas de ciblage par classe, niveau ou année ; pas d'échéancier ; `DEFAULT_FRAIS` hors contexte (ordinateur 350 000…) | — | Grille par niveau et année + échéances | P1 |
| Encaissements et paiements partiels | `POST /api/ecole/paiements` → ECO-001 | `route.ts:5-60`, 143:97+ | 🟡 | Paiement partiel possible mais sans notion de dû ; statut forcé à `paye` ; résultat d'ECO-001 non vérifié (le modèle `app/api/sales/[id]/paiement/route.ts:69-98` relit `status='processed'`) | Moteur ECO-001 | Vérifier l'événement ; montant dû par élève | P1 |
| Soldes restant dus | — | — | ❌ | Impossible à calculer | `computeCollectionStatus` (`lib/erp-core/compute/payments.ts`) | Dû − payé | P1 |
| Modes, références, reçus | `printReceipt` | `shared:175-197` | 🔴 | Numéro = `id.slice(0,8)` ; non stocké ; XSS | `components/resto/ReceiptPDF` + `api/resto/receipt/[commandeId]` | Reçu PDF serveur à numéro séquentiel | P1 |
| Annulation | `delete` direct | `scolarite:438-441` | 🔴 | Aucune extourne comptable | `fn_reverse_accounting_event` (187:93) | Route serveur d'annulation | **P0** |
| Impayés | `direction:52-82`, agent | `agents/securite.ts:188-207` | 🔴 | **B3 : suspension possible de tous les élèves** ; agent `bloque` contre `suspendu`, sans filtre tenant | — | Désactivation immédiate, puis refonte | **P0** |
| Dépenses | `ecole/comptabilite:76-90` → `journal_comptable` | — | ♊ | Doublon du module global `/dashboard/depenses`, sans partie double | Module Dépenses global | Utiliser le module global | P1 |
| Rapports | Journal, Grand Livre, Bilan École (lecture de `journal_comptable` uniquement) | `comptabilite:69,214,315,661` | 🔴 | Les recettes ECO-001 (dans `journal_entries`) n'y figurent pas | Comptabilité globale | Retirer la comptabilité parallèle ou en faire une vue filtrée | P1 |
| Trésorerie | Redirection vers la trésorerie globale | `ecole/tresorerie:4-5` | ✅ ♊ | Onglet Trésorerie parallèle dans `comptabilite:427-470` ; tables 029 dormantes ; `trg_paiement_to_transaction` (023) + moteur → **double ligne probable** ❔ | `/dashboard/tresorerie/*` | **Aucune seconde trésorerie** | P0 (❔ à confirmer) |

### I. Personnel et enseignants

| Fonctionnalité | Équivalent | Fichiers | État | Écart | Réutilisable | Adaptation | Prio |
|---|---|---|---|---|---|---|---|
| Dossiers et statuts | `employes` (insert côté client), `enseignants`, `staff_ecole` | `rh:47,238,657`, `CreateEmployeeWizard:149` | 🟡 ♊ | 3 référentiels non liés ; fausse charge 641 créée à l'embauche (`wizard:204-216`) | `components/rh/EmployeeWizard/*`, `POST /api/hr/employees` | Un seul référentiel `employes` ; `enseignants` limité au volet pédagogique | P1 |
| Affectations pédagogiques | `subjects.enseignant_id` | — | 🟡 | Cf. G | — | Table d'affectation | P1 |
| Paie | `paie_ecole`ᶠ, calcul **côté client** | `rh:1028-1050,1480-1535` | 🔴 ♊ | Hors autorité serveur C3 ; absente des déclarations IRPP et CNSS ; comptes 422, 431 et 447 non mouvementés ; double paiement possible ; IRPP toujours calculé « célibataire » | `/api/paie/bulletins`, `bulletins_paie`, `PayslipPDF`, `universal-tax-engine` | Passer par le module Paie global | **P0** (fiscal) |
| Heures enseignants | `teacher_hours` | `rh:1907-1972`, `espace-formateur:139,707-725` | 🔴 | `statut: 'validated'` refusé par CHECK (025:13-14 ; `rh:1930`) ; colonnes `date_declaration`, `periode` et `description` inexistantes ; taux par défaut de 5 000 inventé (:1951) | Table | Aligner sur le schéma | **P0** |
| Contrats, congés | Onglet « Contrats » qui affiche le recrutement ; `conges_ecole`ᶠ | `rh:2101-2108` | ❌ ♊ | — | `contrats` + `/api/hr/contracts`, `ContratPDF`, `conges` | Réutiliser les modules globaux | P1 |
| Compte de connexion | `employes.email_connexion`, `roles_systeme` | 038:43-44 | 🖼️ | Champs déclaratifs : aucun compte n'est créé | — | Route d'invitation (§6.1) | P1 |

### J. Réseau et recrutement

| Fonctionnalité | Équivalent | Fichiers | État | Écart | Réutilisable | Adaptation | Prio |
|---|---|---|---|---|---|---|---|
| Annuaire d'établissements partenaires | Carnet de contacts `partenaires_ecole`ᶠ | `direction:476-555` | ❌ | Rien entre établissements ; table fantôme | Hiérarchie `parent_tenant_id` (107), `app/dashboard/groupe/*` | À arbitrer (D10) | P3 |
| Portail public | `app/portail/*` (`portal_type` client ou candidat, 114:12) | — | ❌ | Pas de vitrine École | Infrastructure des portails | À arbitrer | P3 |
| Offres d'emploi et candidatures | Module jobs générique (`offres_emploi`, 005) + `recrutements_ecole`ᶠ | `app/api/jobs/*`, `app/jobs/[entreprise]/[poste]` | 🔴 ♊ | `proxy.ts:6-24` n'ouvre ni `/jobs` ni `/portail`, donc le module est inaccessible aux anonymes ; `api/jobs/offre:24` lit `tenants.nom` et `secteur` (colonnes inexistantes) ; `candidats` et `candidatures` sont fantômes | Module jobs global | Corriger le module global, puis offres taguées École | P3 |

**Pertinence.** Le réseau et le recrutement n'ont aucune dépendance entrante dans les autres domaines. En revanche, ils ouvrent des surfaces publiques non authentifiées, avec un risque d'exposition. Ils ne sont pas prioritaires.

---

## 6. État opérationnel réel par domaine, et intégrations transversales

### 6.0 Synthèse par domaine

| Domaine | État global | Bloquant principal |
|---|---|---|
| A. Établissement | 🟡 | Sous-type figé et mal modélisé ; identité répartie sur 3 stockages ; consentement CGU absent |
| B. Tableau de bord | 🔴 | KPI faux ou fabriqués ; aucune vue par rôle |
| C. Classes et niveaux | 🟡 | Pas de référentiel de niveaux ; aucune FK ; primaire sans classes |
| D. Élèves | 🟡 🔴 | Matricule ; classe en texte ; suppression en cascade non tracée |
| E. Carte et QR | ❌ | Rien côté élève ; QR existants cassés |
| F. Présences | 🟡 🔴 | Pas d'appel par classe ; notifications cassées |
| G. Pédagogie | ♊ 🔴 | Deux systèmes de notes ; calculs non testés ; LMD inopérant |
| H. Finances | 🟡 🔴 | Pas de montant dû ; B3 ; pas d'extourne ; comptabilité parallèle |
| I. Personnel | ♊ 🔴 | Paie parallèle hors fiscalité ; heures bloquées |
| J. Réseau et recrutement | ❌ 🔴 | Absent, ou module générique inaccessible au public |

### 6.1 Authentification et comptes

**Réutilisable :**
- `profiles` + `dynamic_role_id` ;
- `etudiants.user_id` (025) ;
- `parent_links` ;
- le rattachement par invitation dans `app/onboarding/actions.ts:55-82`.

**Constats :**
- Aucune route ne crée de compte pour un tenant : pas de `inviteUserByEmail`. L'unique `auth.admin.createUser` se trouve dans `app/api/admin/tenant/create/route.ts:61`.
- `team_invites` (022:75-95) n'envoie aucun e-mail et n'accepte que `admin` ou `membre`.
- `profiles_role_check` (107:474) limite le rôle de base à `owner|admin|membre|groupe_*` : les rôles École ne peuvent être portés que par `dynamic_role_id`.
- Le trigger `ecole_role_name` ne s'exécute pas sur INSERT.

**Adaptateur à prévoir :** une route serveur d'invitation qui :
1. invite l'utilisateur ;
2. crée son `profiles` (rôle de base `membre` + rôle dynamique) ;
3. renseigne `etudiants.user_id`, `parent_links` ou `enseignants.employe_id`.

**Risque de doublon :** étendre `portal_tokens` (114) à un type « parent » créerait un second modèle d'authentification. **À proscrire.**

### 6.2 Permissions

**Réutilisable :**
- `lib/api/require-tenant.ts` : `requireTenant` (:33), `requireRole` (:69) et `checkPlanAccess` (:116), utilisés par 61 routes.
- `lib/tenant-guard.ts` (déprécié) : il fournit `ecoleRole` et `assertResourceOwnership` (:88-125), utile contre les IDOR.

**Constat :** `usePermissions` (LOI-N) n'existe que côté client. Il n'y a **aucun `requirePermission` serveur**.

**Adaptateur :** `requirePermission(moduleKey, action)` côté serveur, appuyé sur `role_permissions` et `user_permissions`.

**Doublon :** `useRoleGuard` (École) fait double emploi avec LOI-N et doit converger.

### 6.3 Finance, comptabilité, trésorerie

**Réutilisable :**
- `emit_accounting_event` ;
- ECO-001 (comptant 5xx/706, TVA 0) ;
- ECO-002 (brouillon, pour les remboursements) ;
- `fn_reverse_accounting_event` ;
- la trésorerie globale (`comptes_bancaires`, `caisses`, wallets, compte principal 178) ;
- `factures`, `paiements_factures` et `relances`.

**Limites de la facturation :**
- règlement total uniquement ;
- TVA à 18 % par défaut ;
- pas de numérotation séquentielle sûre : les triggers `MAX()+1` ne résistent pas à la concurrence, et `lib/receipts.ts` repose sur un compteur fourni par le client.

**Adaptateurs :**
- **Modèle de frais : décision D6.**
  - Option (a) : créance École (accrual), avec un nouvel événement ECO de type 411/706 puis des règlements 5xx/411.
  - Option (b) : conserver ECO-001 au comptant et calculer un état des créances à part.
- **Service de numérotation transactionnel commun** (compteur par tenant et préfixe), à mutualiser entre matricules, reçus et factures.

**Doublons à résorber :**
- `ecole/comptabilite` (`journal_comptable`) ;
- tables 029 ;
- inserts directs dans `transactions` ;
- trigger 023.

**Interdit :** toute seconde trésorerie.

### 6.4 RH & Paie

**Réutilisable :**
- `employes` + `POST/GET /api/hr/employees` ;
- `contrats` + `/api/hr/contracts[/id/{pdf,renew,terminate}]` ;
- `bulletins_paie` + `/api/paie/bulletins` (calcul serveur, écriture comptable) ;
- `/api/rh/paie/[id]/bulletin-pdf` ;
- `conges` ;
- `components/rh/*`.

**Adaptateur :** lien `enseignants.employe_id`.

**Doublons :** `paie_ecole`, `conges_ecole`, `recrutements_ecole`, `CreateEmployeeWizard`, `buildBulletinHTML`.

### 6.5 Stockage documentaire

**Réutilisable :**
- `lib/storage/storage-service.ts` : catégorie `ecole` déjà prévue (:18-21), versions, historique, fournisseurs S3, R2 ou Supabase ;
- tables `documents*` (059, 093) ;
- routes `/api/storage/*` (`requireTenant`).

**Constats :**
- Le bucket `documents` n'est créé par aucune migration et n'a aucune policy (❔).
- `getPublicUrl` est incompatible avec un bucket privé.
- L'École appelle `supabase.storage.from()` directement.

**Adaptateur :** contrôle de lecture par rôle (un parent ne voit que les documents de son enfant).

### 6.6 PDF, impression, exports

**Réutilisable :**
- `@react-pdf/renderer` + `renderToBuffer` (12 routes) ;
- `ReceiptPDF`, `PayslipPDF`, `ContratPDF`, `FacturePDF`, `components/ecole/*PDF` ;
- `qrcode` ;
- `exceljs` (`api/documents/rapport-excel`) ;
- `xlsx` (parsing côté serveur dans `miaa/analyze-file`).

**Constats :**
- L'École imprime par `document.write` (XSS) et n'appelle aucune de ses 3 routes PDF.
- `components/ui/ExcelImport.tsx` n'est utilisé nulle part et ne sait pas lire un `.xlsx` (il lit le binaire comme du texte, :94-95).

### 6.7 Notifications

**Réutilisable :**
- `fn_notify` et `fn_notify_broadcast` (032:53,71), non bloquants ;
- `queueEmail` (`lib/email-templates.ts:228`), `sendSMS` et `sendWhatsApp` (`lib/messaging.ts:69,76`) + cron Resend/Twilio (`app/api/cron/run:105-204`) ;
- `NotificationsPanel` (temps réel ; LOI-O interdit tout nouveau `.channel()`).

**Schéma réel de `notifications` :** `title, message, user_id, type∈{info,warning,success,error}, link, source, source_id, priority, category…`.

**Adaptateur :** helper serveur `notify()` qui résout les parents via `parent_links`.

**Bugs :**
- Tous les inserts de notification de l'École utilisent des colonnes inexistantes.
- `lib/workflow/actions.ts:62` écrit `body` (bug transversal).
- `messaging.ts` utilise le client navigateur.

### 6.8 Journalisation et audit

**Réutilisable :** `global_audit_trail` + `fn_audit_*` (059:214-577), déjà branchés sur `factures`, `paiements_factures`, `employes`, `documents`…

**Constats :**
- **Aucune table École n'est tracée.**
- Aucune lecture de ce journal dans l'application.
- `fn_audit_log` prend un `p_tenant_id` fourni par l'appelant, sans REVOKE visible (❔).

**Adaptateur :** triggers sur `etudiants`, `notes_etudiants`/`exam_grades`, `paiements_scolaires`, `frais_scolaires` et `absences_etudiants`, plus une page de consultation.

### 6.9 Plans et modules

**Réutilisable :** `canAccessByPlan`, `checkPlanAccess`, `tenant_modules`/`computeModules`, `PlanFeatureGate`.

**Constats :**
- École dans `ALWAYS_VISIBLE`.
- La Sidebar École ignore `tenant_modules`.
- `checkPlanAccess` ignore `tenant_modules` (C4).
- `SPECIAL_SECTOR_PRICING` n'est importé nulle part.

**Adaptateur :** modules École par cycle dans `tenant_modules` + garde serveur (D8).

### 6.10 Tableau de synthèse des intégrations

| Service | Réutilisable tel quel | Adaptateur nécessaire | Risque de doublon |
|---|---|---|---|
| Comptes | `profiles`, `dynamic_role_id`, `etudiants.user_id`, `parent_links` | Route d'invitation serveur ; trigger sur INSERT | **Élevé** (`portal_tokens`, `team_invites`, `email_connexion`) |
| Permissions | `requireTenant`/`requireRole`, `assertResourceOwnership`, `usePermissions` | `requirePermission` serveur | Moyen (`useRoleGuard`) |
| Comptabilité | `emit_accounting_event`, ECO-001/002, extourne | Vérification du statut `processed` ; événement de créance (si D6-a) | **Élevé** (`journal_comptable` École) |
| Facturation / créances | `factures`, `paiements_factures`, `relances` | Paiements partiels, échéancier, TVA 0, lien élève | **Élevé** (modèle parallèle `frais_scolaires`) |
| Numérotation | — | Compteur transactionnel commun | **Élevé** (`MAX()+1`, `lib/receipts.ts`, matricule) |
| Trésorerie | `/dashboard/tresorerie/*` | — | Moyen (tables 029, onglet parallèle) |
| RH & Paie | `employes`, `contrats`, `bulletins_paie` + API | `enseignants.employe_id` | **Élevé** |
| Stockage | `storage-service`, `/api/storage/*` | Lecture par rôle ; bucket `documents` (❔) | Moyen |
| PDF / QR / exports | react-pdf, `qrcode`, `exceljs`, `ReceiptPDF` | Carte, reçu, correction des URL `/verify` | **Élevé** (`document.write`) |
| Notifications | `fn_notify`, files e-mail/SMS, `NotificationsPanel` | Helper `notify()` | Moyen |
| Audit | `global_audit_trail`, `fn_audit_*` | Triggers École, page de lecture | Faible |
| Plans / modules | `tenant_modules`, `checkPlanAccess` | Garde serveur cycle × module | Faible |

---

## 7. Éléments réutilisables et doublons

### 7.1 Réutilisables

- **Socle** : inscription et `TenantProfileFactory`, Sidebar sectorielle (`roleFilter`/`minSousType`), rôles dynamiques, `requireTenant`/`requireRole`, `tenant_modules`.
- **École** :
  - `_lib/academic-sections.tsx` (matières avec enseignant, sessions, examens, saisie par lot, rang) ;
  - `_lib/ecole-dashboard-client.tsx` (à rebrancher) ;
  - `ProfilDrawer.tsx` ;
  - pages LMD (déjà dotées de toasts et de `confirm`, bon modèle UX) ;
  - tables 024 (`exams`, `exam_grades`, `report_cards`, `diplomas` avec FK), `academic_settings`, `parent_links`, `etudiants.user_id`, `annees_academiques`.
- **Transverses** : moteur comptable, trésorerie globale, module RH & Paie global, `storage-service`, react-pdf, `qrcode`, `exceljs`, `fn_notify`, files e-mail/SMS, `global_audit_trail`, `app/verify/[code]`, modèle `presences` (UNIQUE + RLS), planche d'étiquettes de `stocks/codes-barres`.

### 7.2 Doublons et données à centraliser

| Doublon | À conserver | À résorber |
|---|---|---|
| Notes | à arbitrer (D5), recommandé : `exams`/`exam_grades` | `notes_etudiants` |
| Diplômes / soutenances / thèses | à arbitrer (D5) : `diplomas`/`defenses` (FK) ou `ecole_*` (vérification publique) | l'autre série |
| Personnel | `employes` (RH) + `enseignants` (pédagogie, relié) | `staff_ecole` |
| Paie, congés, recrutement | modules globaux | `paie_ecole`, `conges_ecole`, `recrutements_ecole` |
| Comptabilité, dépenses, trésorerie | globales | `ecole/comptabilite`, tables 029, trigger 023 (❔) |
| Identité de l'établissement | `tenants` (codes) + `entreprise_config` (affichage) | 3ᵉ stockage, 2ᵉ bucket logo |
| Année | `annees_academiques` | colonnes texte `annee_scolaire` |
| Classe de l'élève | `classes_ecole` (FK) | `etudiants.classe` texte |
| Responsable légal | `parent_links` + comptes | colonnes texte (à conserver comme données de contact) |
| Impression | routes react-pdf | `document.write` |
| Tableau de bord | une seule implémentation par rôle | `ecole/page.tsx`, logique École inatteignable de `DashboardClient.tsx:434,573-574,623` |
| Menu | une entrée par fonction | « Délibérations » ×2 ; RH et Compta core + École |
| Gardes | LOI-N | `useRoleGuard` |

---

## 8. Écarts fonctionnels et techniques

**Fonctionnels (par rapport aux parcours EduNet décrits) :**
- pas de catalogue de niveaux fins ni de création de classe depuis un catalogue ;
- pas de fiche élève centralisée ni de documents ;
- pas de carte d'élève ni de scan ;
- pas d'appel par classe ;
- pas de montant dû, d'échéancier, de solde ni de reçu numéroté ;
- pas d'affectation enseignant × classe × matière ;
- pas de bulletin archivé ;
- pas de rapport ni d'export de direction ;
- pas de galerie de l'établissement ;
- pas de consentement CGU ;
- pas de réseau, de portail ni de recrutement École.

**Techniques :**
- 11 tables et une dizaine de colonnes fantômes ;
- aucune FK année → classe → élève ;
- écritures côté navigateur sans route serveur ;
- erreurs Supabase ignorées (supabase-js renvoie l'erreur au lieu de la lever, donc les `try/catch` ne capturent rien) ;
- texte corrompu (U+FFFD) ;
- god component `rh/page.tsx` (2 171 l.) ;
- aucune garde serveur de rôle ni de sous-type ;
- `ecole_subtype` écrit une seule fois et jamais lu ;
- chaîne de migrations non rejouable ;
- aucun test automatisé couvrant les rôles École, la RLS par rôle, les calculs de notes ou les finances scolaires.

---

## 9. Risques et éléments NOT_TESTABLE

### 9.1 Risques prouvés dans le code et les migrations

| # | Risque | Preuve | Gravité |
|---|---|---|---|
| R1 | **Données de mineurs lisibles et modifiables par tout membre du tenant.** Les policies 008 (`sel_*`…) et 067 (`"<table>: tenant" FOR ALL`) ne sont jamais supprimées. 034 supprime des noms qui n'existent pas. Les policies permissives se combinent par OU, ce qui neutralise le filtrage par rôle. | 008:86-100 ; 034:195-275 ; 067:62-102 | CRITIQUE |
| R2 | **IDOR élève** : `lookupByNumeroId` charge n'importe quel élève du tenant par matricule | `espace-etudiant:347-362,409` | CRITIQUE |
| R3 | **RPC cross-tenant** : `fn_deliberer_annee` et `fn_valider_parcours_etudiant` sont `SECURITY DEFINER` avec un `p_tenant_id` fourni par le client, sans contrôle ; `seed_ecole_roles`/`fn_seed_sector_roles` accordées à `authenticated` | 123:105,150 ; 025 | CRITIQUE |
| R4 | Encaissement sans contrôle de rôle ni vérification d'appartenance de `etudiant_id` au tenant (écriture `supabaseAdmin`) | `api/ecole/paiements/route.ts:5-60` | ÉLEVÉE |
| R5 | ETUDIANT et PARENT voient le tableau de bord de l'établissement ; 15 pages sans garde ; `layout.tsx` ne contrôle que le secteur | `app/dashboard/page.tsx:53` ; `ecole/layout.tsx` | ÉLEVÉE |
| R6 | Paie calculée côté client puis persistée (net falsifiable) | `rh:1480-1500` | ÉLEVÉE |
| R7 | Rattachement parent par `ilike` non échappé ; filtres `.or()` construits avec la saisie brute | `espace-parent:304-305,319` ; `espace-etudiant:369` | ÉLEVÉE |
| R8 | XSS dans les impressions par `document.write` | `shared:141-197,345,379` ; `rh:1055-1345` | MOYENNE |
| R9 | `notifications_insert_service WITH CHECK (true)` + policy de lecture au niveau du tenant | 056 ; 067 | MOYENNE |
| R10 | Un élève peut se débloquer lui-même (protection uniquement côté interface) | `espace-etudiant:375-386` | MOYENNE |
| R11 | **Incohérence année / classe / inscription** : textes libres, aucune FK, « 2024-2025 » codé en dur | §4.3 | ÉLEVÉE (intégrité) |
| R12 | **Doublons de matricule** (`count+1`) ; **doublons de présences** (aucune contrainte UNIQUE) | `scolarite:89-91` ; 011 | ÉLEVÉE |
| R13 | **Erreurs de calcul** : coefficient de bulletin, rang sur tout l'établissement, KPI fabriqués, impayés sans montant dû | §5 B, G, H | ÉLEVÉE |
| R14 | **Écritures financières hors comptabilité** : paiement supprimé sans extourne, résultat ECO-001 non vérifié, paie incomplète, fausse charge 641, `journal_comptable` École | §5 H, I | ÉLEVÉE |
| R15 | **Suppressions et modifications non tracées** : aucune table École dans `global_audit_trail` ; cascades | 059 ; 008:49,61 | ÉLEVÉE |
| R16 | **Destruction massive** : B3, suspension de tous les élèves actifs | `direction:55,69-82` | ÉLEVÉE |
| R17 | **Compatibilité des catégories** : `creche` traité comme université dans les onglets, primaire sans notes ni classes, multi-cycle impossible | `scolarite:1060` ; `erp-sectors.ts:46-52` | ÉLEVÉE |
| R18 | **Régressions** : la Sidebar, `DashboardClient`, `plan-access`, la comptabilité et la RH globales sont partagés avec les autres secteurs ; toute modification doit être testée hors École | — | MOYENNE |
| R19 | Création de tenant par l'administration sans secteur ni pays (contournement de LOI-M) | `api/admin/tenant/create:44-51` | MOYENNE |
| R20 | `seed_ecam_congo.sql` : DELETE inconditionnel sur les tables École d'un tenant réel (P0A2, suspendu) | MASTER-REPAIR-REGISTER | ÉLEVÉE (opérationnel) |

**Rappel :** aucune protection n'est déclarée effective ici sans preuve. L'existence d'une policy dans une migration ne prouve pas son application en production.

### 9.2 NOT_TESTABLE

| # | Élément | Preuve manquante |
|---|---|---|
| N1 | Existence et schéma des 11 tables fantômes, et leur RLS | `information_schema.tables/columns`, `pg_policies` |
| N2 | Colonnes `paiements_scolaires.annee_scolaire`/`date_paiement`/`source`, `etudiants.email`, `teacher_hours.date_declaration`, `enseignants.user_id` | `information_schema.columns` |
| N3 | Triggers effectifs `trg_ps_source_label` (bloquerait **tout** encaissement), `trg_absence_notify` (bloquerait les absences dès qu'un `parent_links` existe), `trg_paiement_to_transaction` (double ligne de trésorerie) | `pg_trigger` |
| N4 | Policies réellement actives sur les tables École (034 et 067 appliquées ? `sel_*` présentes ?) | `pg_policies` |
| N5 | Privilèges EXECUTE sur `fn_deliberer_annee`, `fn_valider_parcours_etudiant`, `seed_ecole_roles`, `fn_audit_log` | `information_schema.routine_privileges` |
| N6 | Doublons existants dans `transactions` pour les paiements scolaires | requête d'agrégat |
| N7 | Élèves déjà suspendus à tort par B3 | `count(*) where statut='suspendu'` |
| N8 | Bucket `documents` et policies `storage.objects` | `storage.buckets`, `pg_policies` |
| N9 | Valeur par défaut réelle de `academic_settings.mentions` | `information_schema.columns.column_default` |
| N10 | Rendu visuel, mobile, liens 404 (`/cgu`, `/verify/...`) | exécution navigateur |
| N11 | Contenu de la vidéo EduNet | fichier vidéo ou captures |
| N12 | Pertinence pédagogique des séries et niveaux pour chaque pays (Congo : séries F/G/H ?) | référentiel officiel du ministère, à fournir |

---

## 10. Stratégie pour les trois catégories scolaires

### 10.1 Constat

| Élément | Existant | Limite |
|---|---|---|
| Typologie | `tenants.sous_type` ∈ {garderie, primaire, college, lycee, universite} + `creche` (onboarding) ; rang linéaire `ECOLE_NIVEAU` (0 à 4) ; règle « rang ≥ minSousType », donc cumulative | Valeur **unique** : un complexe multi-cycle est impossible ; `creche` donne le rang 4 dans `getTabsForSousType` ; le primaire n'a ni Notes ni Classes |
| Couplage plan / catégorie | L'offre Entrepreneur ne propose que crèche, primaire et collège ; Business et Compagnie que lycée et université (`onboarding/page.tsx:33-84`) | Un groupe scolaire au plan Compagnie ne peut pas choisir primaire |
| Niveaux | `NIVEAUX` = 6 cycles | Aucun niveau fin, aucune variante par pays |
| Évaluation | Notes sur 20 ; `MENTIONS` codées en dur ; `PERIODES` mélangeant trimestres et semestres ; `academic_settings.system_type` (classique, lmd, hybride) jamais lu | Pas de profil pédagogique effectif ; pas d'examens nationaux (CEPE, BEPC, BAC) |
| LMD | UE, semestres, parcours, délibérations (121-123) | Inopérant (§5 G) |
| Cloisonnement des données | Colonne `ecole_subtype` sur 13 tables | Écrite une fois, jamais lue |
| Gating | Client uniquement (Sidebar, onglets, garde de page LMD) | Pas de garde serveur ; `tenant_modules` ignoré |

**Conclusion.** L'architecture actuelle **peut porter un socle commun** :
- les tables élèves, classes, notes, présences et finances sont communes à tous les cycles ;
- la visibilité est déjà pilotée par configuration.

Mais le **modèle de catégorie** doit évoluer, d'une valeur unique et linéaire vers un **ensemble de cycles**. C'est une adaptation de 3 fonctions et d'une colonne, pas une refonte.

### 10.2 Proposition (à valider, D1 à D4)

1. **Cycles plutôt que sous-type.** `tenants.ecole_cycles` = sous-ensemble de {maternelle, primaire, collège, lycée, supérieur}.
   - Les trois catégories commerciales deviennent des **préréglages** :
     - catégorie 1 = {maternelle, primaire, collège} ;
     - catégorie 2 = {collège, lycée} ;
     - catégorie 3 = {supérieur}.
   - Le collège, présent dans deux catégories, est simplement un cycle partagé.
   - La règle de visibilité devient `cycles ∩ requis ≠ ∅` dans `Sidebar.tsx`, `getTabsForSousType` et `getNiveauxPourSousType`.
   - `sous_type` est conservé en repli de lecture.
2. **Référentiel de niveaux paramétrable.** Table de référence (pays, cycle, code CP1…Tle / L1…D3, ordre, examen terminal), chargée d'abord pour le Congo-Brazzaville, puis pour les autres pays CEMAC. `classes_ecole` et `etudiants` y pointent par FK.
3. **Profil pédagogique par cycle.** `academic_settings` devient une ligne par cycle :
   - type de période (trimestre ou semestre) ;
   - barème, coefficients, mentions ;
   - mode LMD (crédits, compensation).

   Il est branché sur un **moteur de calcul unique** utilisé par tous les cycles.
4. **Initialisation.** `TenantProfileFactory` + RPC de seed côté serveur : année active, réglages par cycle, séries (si lycée), matières types, grille de frais vide.
5. **Contrôle d'accès.**
   - Modules École par cycle dans `tenant_modules` ;
   - garde serveur cycle × module ;
   - plan et catégorie découplés à l'inscription, si D2 est validée ;
   - **aucune modification des règles d'accès** n'est faite pendant cet audit.
6. **Évolution par pays.** Clé `pays` sur le référentiel de niveaux et sur les préréglages de profil pédagogique. Aucune logique propre à un pays dans le code des pages.

**Une seule application, une seule rubrique École, une seule base de tables.** Les différences entre catégories relèvent de **données de configuration**.

---

## 11. Plan d'implémentation par lots

L'ordre proposé par la consigne a été réordonné selon les dépendances réelles :
- **la sécurité et l'inventaire de la base précèdent tout** ;
- **le socle année / classe / niveau précède les élèves** ;
- **le compteur transactionnel commun précède les matricules et les reçus** ;
- **la paie est sortie plus tôt**, car le risque fiscal est actif.

| Lot | Contenu | Dépend de | Type |
|---|---|---|---|
| **0** | Architecture, isolation, autorisations, fondations | — | 🐞 sécurité + fondations |
| **1** | Configuration de l'établissement, cycles, années scolaires | 0 | ✨ + 🐞 |
| **2** | Référentiel de niveaux, classes, matières par classe | 1 | ✨ |
| **3** | Inscriptions et dossier élève | 2, 0d | ✨ + 🐞 |
| **4** | Matières, affectations, évaluations, notes, bulletins | 2, 3 | ✨ + ♊ |
| **5** | Finances scolaires intégrées | 3, 0d | ✨ + 🐞 |
| **6** | Personnel et RH & Paie (sur le module global) | 0 (P0 fiscal), 4 pour les affectations | ♊ → réutilisation |
| **7** | Présences, cartes et QR | 3 | ✨ |
| **8** | Tableaux de bord par rôle, exports, rapports, UX transverse | 3 à 7 | 🎨 + 🐞 |
| **9** | Réseau, portail public, recrutement (si D10 le confirme) | 0, 8 | ✨ |

### Lot 0 — Fondations (bloquant)

- **0a. Inventaire de la base en lecture seule** : lever N1 à N9.
- **0b. Sécurité des données** (R1 à R5, R7, R10) :
  - consolider les policies par rôle ;
  - supprimer la recherche par matricule ;
  - contrôler le tenant dans les RPC `SECURITY DEFINER` + REVOKE ;
  - `api/ecole/paiements` : rôle et appartenance ;
  - gardes serveur sur le layout ou le proxy ;
  - sortir ETUDIANT et PARENT du tableau de bord global.
- **0c. Bugs destructeurs** :
  - désactiver `autoBlock` (B3) ;
  - extourne à la suppression d'un paiement ;
  - CHECK `teacher_hours` ;
  - échappement HTML des impressions ;
  - correction de l'encodage U+FFFD.
- **0d. Services communs** :
  - compteur transactionnel ;
  - helper `notify()` ;
  - `requirePermission` serveur ;
  - triggers `global_audit_trail` sur les tables École ;
  - route serveur d'invitation de comptes.

**Fichiers probables :** une nouvelle migration (policies, RPC, compteur, audit), `espace-etudiant`, `espace-parent`, `api/ecole/paiements/route.ts`, `ecole/layout.tsx`, `proxy.ts`, `app/dashboard/page.tsx`, `_lib/shared.tsx`, `direction/page.tsx`, `scolarite/page.tsx`, `rh/page.tsx`, `lib/api/*`.

**Risques :**
- couper un accès légitime (SCOLARITE, DAAC) ;
- corriger une colonne qui existe en production (d'où 0a) ;
- migrations non rejouables (application manuelle).

### Lot 1 — Établissement, cycles, années

- Étapes « responsable », « coordonnées » et « CGU » ajoutées **au parcours d'inscription existant** ;
- identité unifiée ;
- `ecole_cycles` ;
- sous-type modifiable ;
- correction `creche`/`garderie` ;
- année active unique pour tous les cycles ;
- seed à la création ;
- route admin passant par `TenantProfileFactory` (LOI-M).

**Risque :** reprise des tenants existants (rattrapage de `sous_type` vers les cycles).

### Lot 2 — Référentiel et classes

- Référentiel `niveaux_scolaires` ;
- `classes_ecole.annee_id`, `niveau_id`, `titulaire` ;
- table classe × matière ;
- création depuis le catalogue ou personnalisée ;
- contrôle de capacité ;
- fiche classe ;
- onglet Classes ouvert à tous les cycles.

**Risque :** rattrapage du texte de `classes_ecole.niveau` vers une FK.

### Lot 3 — Élèves

- `etudiants.classe_id` et `annee_id` (rattrapage depuis le texte) ;
- matricule via le compteur ;
- édition de la fiche ;
- inscription annuelle (réinscription, transfert) ;
- archivage plutôt que suppression ;
- documents via `storage-service` ;
- comptes parent et élève par invitation (`parent_links`, `user_id`) ;
- fiche 360 qui lit les autres modules sans copie ;
- export `exceljs`.

### Lot 4 — Pédagogie

- Système de notes unique (D5) ;
- affectations enseignant × classe × matière × année ;
- moteur de calcul paramétré par le profil pédagogique ;
- rang par classe ;
- bulletin PDF serveur archivé (`report_cards`) ;
- corrections LMD ;
- choix du registre de diplômes (D5).

### Lot 5 — Finances

- Modèle de frais (D6) ;
- grille par niveau et année ;
- échéancier, dû, solde ;
- reçu PDF serveur numéroté ;
- vérification ECO-001 ;
- impayés exacts ;
- retrait de `ecole/comptabilite`, des tables 029 et du trigger 023 (si N3/N6 confirment) ;
- dépenses via le module global.

### Lot 6 — Personnel et RH & Paie

- Lien `enseignants.employe_id` ;
- paie via `/api/paie/bulletins` ;
- contrats et congés globaux ;
- reprise de l'historique `paie_ecole` (D7) ;
- découpage de `rh/page.tsx`.

**Priorité de la paie :** sa partie « paie hors fiscalité » est P0. Elle peut démarrer juste après le Lot 0, en parallèle des lots 1 à 3.

### Lot 7 — Présences, cartes, QR

- Feuille d'appel par classe (modèle `presences`, contrainte UNIQUE) ;
- correction tracée ;
- notification parent via `notify()` ;
- carte d'élève PDF ;
- QR de vérification sur jeton opaque ;
- scan caméra (D9).

### Lot 8 — Tableaux de bord, exports, UX

- Vues par rôle (rebrancher `ecole-dashboard-client`) ;
- KPI exacts ;
- sous-menus par pilier ;
- dédoublonnage du menu ;
- tokens Oraforme (primary #F59E0B, danger #DC2626, success #16A34A, info #2563EB) ;
- responsive ;
- états chargement / erreur / vide ;
- toasts et confirmations ;
- rapports de direction.

### Lot 9 — Réseau et recrutement

Uniquement si D10 le confirme :
- ouverture contrôlée de `/jobs` et `/portail` dans le proxy ;
- correction du module jobs global ;
- offres taguées École ;
- agrégats de groupe via `parent_tenant_id`.

---

## 12. Tests à prévoir par lot

| Lot | Tests d'acceptation |
|---|---|
| 0 | **RLS SQL** par rôle × table × opération (DG, RAF, SCOLARITE, DAAC, RH_PAIE, FORMATEUR, ETUDIANT, PARENT) et cross-tenant. Parent A ne lit pas l'enfant B ; un élève ne lit pas un camarade. RPC appelée avec un tenant tiers → refus. `POST /api/ecole/paiements` : 403 pour un rôle non autorisé, refus pour un élève d'un autre tenant. B3 : un élève à jour n'est jamais suspendu. Suppression d'un paiement → extourne présente. Heures : déclarer → valider → payer. Test d'architecture « aucun U+FFFD dans `app/` ». Test d'architecture « aucune insertion dans `notifications` hors `notify()` ». Compteur : 100 inscriptions concurrentes → 100 matricules distincts. |
| 1 | Inscription par catégorie (1, 2, 3) et multi-cycle ; consentement CGU horodaté ; modification du pays répercutée dans `tenants` ; une seule année active ; seed présent après création ; tenant créé par l'admin avec secteur et pays. |
| 2 | Création de classe depuis le catalogue et personnalisée ; refus au-delà de la capacité ; renommer une classe ne détache pas ses élèves ; matières par classe. |
| 3 | Édition de la fiche élève ; réinscription annuelle ; archivage sans perte de notes ni de paiements ; documents visibles uniquement des rôles habilités ; invitation d'un parent → il ne voit que son enfant ; export. |
| 4 | Tests unitaires du moteur de calcul : moyenne pondérée, coefficients, rang par classe, mentions issues du profil, trimestre contre semestre, LMD (crédits, compensation). Bulletin PDF conforme. Délibération LMD aboutie. |
| 5 | Paiement partiel → solde exact ; échéance dépassée → impayé ; reçu numéroté unique et réimprimable ; une seule écriture ECO et une seule ligne de trésorerie par paiement ; annulation → extourne ; tests d'architecture LOI-K étendus (aucune écriture comptable depuis `app/dashboard/ecole`). |
| 6 | Paie d'un enseignant marié avec enfants (IRPP correct, calcul serveur) ; bulletin visible dans l'espace formateur ; présence dans la déclaration CNSS et IRPP ; pas de double paiement sur un mois ; extension de `paie-consommateurs-p0.test.ts`. |
| 7 | Appel d'une classe de 30 élèves ; doublon refusé ; correction tracée dans `global_audit_trail` ; notification parent reçue ; scan d'une carte → élève identifié → présence enregistrée ; QR d'un autre tenant → refus. |
| 8 | KPI comparés à un jeu de recette ; vue par rôle ; Playwright à 375, 768 et 1440 px ; mode sombre ; non-régression des tableaux de bord des autres secteurs. |
| 9 | Accès anonyme aux offres publiques uniquement ; aucune donnée d'élève exposée. |

**Préalable commun : un environnement de recette** (base distincte de la production, R-006). Les tests e2e existants créent des comptes en production (`tests/certifications/helpers/db.ts`) et ne doivent pas être étendus tels quels.

---

## 13. Décisions nécessitant une validation humaine

| # | Décision | Options |
|---|---|---|
| D1 | Modèle de catégorie | (a) `ecole_cycles` multi-valeurs + 3 préréglages (recommandé) ; (b) conserver le sous-type unique |
| D2 | Couplage plan / catégorie | Découpler (tout plan, toute catégorie) ou conserver l'offre actuelle |
| D3 | Référentiel de niveaux | Pays couverts en premier (Congo-Brazzaville seul ? CEMAC ?) ; source officielle des niveaux, séries et examens à fournir |
| D4 | Droits par rôle (matrice cible) | Que voient et font DG, RAF, SCOLARITE, DAAC, RH_PAIE, FORMATEUR, ETUDIANT, PARENT, DTI ? L'owner vaut-il DG ? Rôle « Direction école » distinct ? |
| D5 | Système de notes et registre de diplômes | `exams`/`exam_grades` contre `notes_etudiants` ; `diplomas`/`defenses` contre `ecole_*` |
| D6 | Modèle comptable des frais | (a) créance + règlements (accrual, 411) ; (b) comptant ECO-001 + état des créances ; base légale de l'exonération de TVA (non citée dans 143) |
| D7 | Reprise de l'historique | Sort des données de `paie_ecole`, `journal_comptable` École, `notes_etudiants`, des colonnes texte (classe, année) |
| D8 | Gating | Fonctions École soumises au plan ? Lesquelles ? Tarif (35 000 contre 15 000) |
| D9 | Nouvelle dépendance de scan QR (si `BarcodeDetector` est insuffisant) | Bibliothèque à choisir |
| D10 | Réseau, portail public, recrutement | Dans le périmètre ou non ; exposition publique acceptée ? |
| D11 | Canal d'accès à la base pour le Lot 0a | Lecture production (comment ?) ; création d'un environnement de recette |
| D12 | Suppression ou archivage des élèves et paiements | Politique de conservation (données de mineurs) |
| D13 | Vidéo EduNet | Fournir le fichier ou des captures pour valider la matrice §5 |

---

## 14. Fichiers consultés et références

### 14.1 École

- `app/dashboard/ecole/layout.tsx` ; `page.tsx` (:150, :158, :304-338, :361-382, :401, :438-458, :481-491, :508, :546, :558, :745-797)
- `direction/page.tsx` (:44-82, :291-297, :397, :476-577, :642, :662)
- `daac/page.tsx` (:47, :54-59)
- `scolarite/page.tsx` (:36-55, :75, :81-119, :156, :180, :212-300, :365, :379-441, :567-787, :811, :899-1069, :1101, :1158)
- `comptabilite/page.tsx` (:69, :76-90, :214, :315, :427-470, :604-608, :661) ; `tresorerie/page.tsx` ; `miaa/page.tsx`
- `rh/page.tsx` (:47, :224-270, :657-682, :917-932, :1028-1050, :1055-1345, :1433-1583, :1817-1982, :2096-2120) ; `rh/_components/CreateEmployeeWizard.tsx` (:149, :164, :177-178, :204-219) ; `ProfilDrawer.tsx`
- `espace-parent/page.tsx` (:51-57, :118-126, :280, :304-362, :380-459)
- `espace-etudiant/page.tsx` (:82-101, :262, :298-313, :338-409)
- `espace-formateur/page.tsx` (:48-57, :92, :114-163, :184-195, :337-342, :445-450, :543-579, :707-733)
- `parametres-academiques/page.tsx` (:485, :505-506) ; `annees-academiques/page.tsx` (:68-124) ; `semestres/page.tsx` (:62, :106-120, :225) ; `series/page.tsx` (:23-28, :103) ; `deliberations/page.tsx` (:84, :97-101, :130) ; `diplomes/page.tsx` (:105-107, :215) ; `soutenances/page.tsx` (:99-101) ; `theses`, `facultes`, `departements`, `parcours`, `unites-enseignement`
- `_lib/shared.tsx` (:69-197, :345, :379) ; `_lib/academic-sections.tsx` (:41-590, :751-898) ; `_lib/ecole-dashboard-client.tsx` (:147, :191, :419-422, :465)
- `components/ecole/{BulletinPDF,AttestationPDF,DiplomaePDF}.tsx`

### 14.2 API et transverses

- **API École et documents** : `app/api/ecole/paiements/route.ts` ; `app/api/agents/ecole/impayes/route.ts` ; `agents/securite.ts:188-207` ; `app/api/documents/{bulletin-scolaire,attestation,diploma,rapport-excel}/route.ts` ; `app/api/bi/insights/route.ts:33-34,214-233`
- **Autres API** : `app/api/sales/[id]/paiement/route.ts:69-98` ; `app/api/factures/route.ts:111` ; `app/api/factures/[id]/{route,pdf/route}.ts` ; `app/api/resto/receipt/[commandeId]` ; `app/api/hr/*` ; `app/api/paie/bulletins` ; `app/api/rh/paie/[id]/bulletin-pdf` ; `app/api/storage/*` ; `app/api/cron/run/route.ts:105-204` ; `app/api/admin/tenant/create/route.ts:40-61` ; `app/api/jobs/offre/route.ts:24` ; `app/api/miaa/analyze-file/route.ts`
- **Pages publiques et inscription** : `app/verify/[code]/page.tsx` ; `app/onboarding/{page,actions}.ts(x)` ; `app/register/page.tsx` ; `app/legal/cgu/page.tsx`
- **Pages métier et admin** : `app/dashboard/page.tsx:53,180` ; `app/dashboard/parametres/{page,conformite/page}.tsx` ; `app/dashboard/profil/actions.ts` ; `app/dashboard/{equipe,roles,tresorerie,depenses}` ; `app/dashboard/rh/{presences,portail,paie,employes/nouveau}` ; `app/dashboard/stocks/codes-barres/page.tsx` ; `app/dashboard/restaurant/page.tsx` ; `app/dashboard/groupe/*` ; `app/portail/*` ; `app/jobs/*` ; `app/admin/{layout,audit/page}.tsx`
- **Composants** : `components/dashboard/{Sidebar,DashboardClient,DashboardShell,ProfilCompletionPopup}.tsx` ; `components/ui/{ExcelImport,NotificationsPanel}.tsx` ; `components/{rh,resto,facture}/*PDF.tsx`
- **Bibliothèques** : `lib/erp-sectors.ts` (:43-205, :386-398) ; `lib/plan-access.ts` ; `lib/plans.ts` (:113-115, :219) ; `lib/modules.ts:262` ; `lib/admin-config.ts` ; `lib/tenant-guard.ts` ; `lib/api/require-tenant.ts` ; `lib/hooks/{useRoleGuard,usePermissions,useGeolocation}.ts` ; `lib/contexts/{TenantContext,PaysContext}.tsx` ; `lib/tenant/TenantProfileFactory.ts` ; `lib/storage/{storage-service,storage-provider}.ts` ; `lib/erp-core/compute/payments.ts` ; `lib/compta-sync-client.ts` ; `lib/accounting-engine.ts` ; `lib/receipts.ts` ; `lib/messaging.ts` ; `lib/email-templates.ts` ; `lib/workflow/actions.ts:62` ; `lib/fiscal/universal-tax-engine.ts` ; `lib/paie/calcul-paie.ts`
- **Divers** : `proxy.ts` (:6-30, :55-63, :105-155) ; `vercel.json` ; `package.json`

### 14.3 Migrations et tests

- **Migrations** : 001, 005, 008, 011, 014, 018, 021, 022, 023, 024, 025, 028, 029, 031, 032, 034, 037_enseignant_types, 037_staff_ecole_extended, 038, 039, 041, 042, 043, 044, 047, 054, 056, 058, 059, 060, 067, 072, 078, 084, 093, 095, 096, 100, 104, 107, 114, 118, 121, 122, 123, 126, 135, 138, 139, 143, 163, 168, 175, 178, 187 ; `CATCHUP_008_to_025.sql` ; `supabase/backfill_paie_comptabilite.sql`
- **Tests** : `lib/architecture/{loi-k-unique-writer,loi-n-permission-engine,paie-consommateurs-p0}.test.ts` (exécutés) ; `tests/certifications/c003-2-ecole-stability.spec.ts` et `helpers/db.ts` (lus, non exécutés) ; `supabase/tests/*.sql` (lus)
- **Documentation** : `docs/ORAFORME_ECOLE_AUDIT_REFERENCE_VIDEO.md`, `MASTER-A-Z-AUDIT-2026-09.md`, `MASTER-REPAIR-REGISTER.md`, `MIGRATION-MAP-AZ.md`, `TECH-DEBT-MIGRATION-CHAIN.md`, `BOI-010D-ETAT-MIGRATOIRE-PRODUCTION.md`, `LOI-K-UNIQUE-WRITER.md`, `LOI-M-TENANT-CREATOR.md`, `LOI-N-PERMISSION-ENGINE.md`, `LOI-O-REALTIME-MANAGER.md`, `C3-IRPP-SERVER-AUTHORITY-CLOSURE.md`, `C4-PLAN-GATING-CLOSURE.md`, `R006-ANO-P03-RECETTE-ENVIRONMENT.md`

---

## Verdict

**BLOCKED** pour le démarrage du développement fonctionnel (lots 1 à 9).

**Motifs :**
- risques critiques prouvés R1, R2 et R3 sur des données de mineurs ;
- schéma de production inconnu (N1 à N5) ;
- opérations destructrices actives (B3, suppression de paiement sans extourne, paie hors fiscalité) ;
- vidéo de référence non examinée.

**Déblocage :**
1. validation de ce rapport et des décisions D4, D11 et D13 ;
2. exécution du Lot 0.

L'architecture existante est suffisante pour accueillir les parcours EduNet **sans nouvelle application, sans seconde authentification et sans navigation parallèle**.

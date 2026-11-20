# ORAFORME — Audit de la rubrique École (référence vidéo)

| Champ | Valeur |
|---|---|
| Date | 2026-10-13 |
| Nature | Audit statique en lecture seule (code + migrations du dépôt) |
| Base auditée | branche de travail, HEAD `fb54a89` + modifications locales non commitées (10 fichiers École modifiés, voir §0) |
| Modifications effectuées | Aucune — ni code, ni SQL, ni données, ni permissions, ni commit |
| Accès base de production | **Non** — tout constat « table/colonne absente » est établi au regard des migrations du dépôt, pas de la base réelle |
| Verdict | **BLOCKED** pour le démarrage des lots fonctionnels — voir §11 |

Légende des statuts : ✅ opérationnelle · 🟡 partielle · 🔌 présente mais non reliée aux données · ❌ absente · ♊ dupliquée · 🔴 en erreur · ❔ invérifiable sans la base.

Légende des preuves : `fichier:ligne`. Les chemins `ecole/...` désignent `app/dashboard/ecole/...`. Les migrations sont désignées par leur numéro (`008` = `supabase/migrations/008_ecole.sql`).

---

## 0. Précautions préalables

- **Copie de travail non propre.** 236 fichiers modifiés non commités dans le dépôt, dont 10 fichiers École (`rh/page.tsx` +97/−23, et 9 fichiers avec une modification d'une ligne). L'audit porte sur la copie de travail. Ces modifications n'ont pas été touchées.
- **Texte corrompu dans le code commité.** `ecole/scolarite/page.tsx` (67 lignes) et `ecole/rh/page.tsx` (197 lignes au HEAD, 199 en local) contiennent le caractère de remplacement U+FFFD : « Libell� », « M�thode », « F�vrier », « Num�ro CNSS », jusque dans le HTML du bulletin de paie. Les accents s'affichent cassés à l'écran.
- **Chaîne de migrations non rejouable.** Le rejeu casse dès 031/032, puis 034, puis 068 (`docs/TECH-DEBT-MIGRATION-CHAIN.md`, R-006). Aucune migration École (008→143) n'a de statut APPLIED prouvé en production (`docs/BOI-010D-ETAT-MIGRATOIRE-PRODUCTION.md` ne couvre que 172–184). Des tables utilisées par le code ont manifestement été créées à la main dans le SQL Editor (§4.3).

---

## 1. Architecture actuelle

### 1.1 Couches

| Couche | Élément | Constat |
|---|---|---|
| Garde serveur | `ecole/layout.tsx` | Vérifie l'authentification et l'appartenance au secteur `ecole` (ou `ecole_role_name`). **Ne vérifie jamais le rôle.** Lecture `profiles` conforme à la règle `.order().limit(1)`. |
| Garde client | `lib/hooks/useRoleGuard.ts:42-57` | Redirection dans un `useEffect` : les données se chargent avant la redirection. |
| Proxy | `proxy.ts:61-63` | Restreint `espace-formateur`, `espace-etudiant`, `espace-parent` par rôle. |
| Menu | `lib/erp-sectors.ts:63-205` (`SECTOR_SPECIFIC.ecole`, 20 entrées, `roleFilter`, `minSousType`) rendu par `components/dashboard/Sidebar.tsx:649-685` | Liste **plate** dans le groupe « métier ». Les « directions » sont des pages à onglets internes, pas des sous-menus. |
| Sous-types | `garderie`, `primaire`, `college`, `lycee`, `universite` (`erp-sectors.ts:43`) | L'onboarding propose `creche` (`app/onboarding/page.tsx:33`), inconnu du code et affiché « École Primaire » (`ecole/page.tsx:321`). Le sous-type n'est modifiable nulle part après l'onboarding (`app/onboarding/actions.ts:109`). |
| Données | 47 tables, 2 RPC, 1 bucket (`avatars`) | Voir §4. |
| API serveur | `api/ecole/paiements` (POST), `api/agents/ecole/impayes` (cron), `api/documents/bulletin-scolaire`, `api/documents/attestation`, `api/documents/diploma`, `api/bi/insights?module=ecole` | La quasi-totalité des écritures École se fait **côté navigateur** (client Supabase + RLS). Seul l'encaissement passe par une route serveur. |
| Comptabilité | moteur `emit_accounting_event` (règle ECO-001, 143) + `writeComptaEntry` + inserts directs `journal_comptable`/`transactions` | 3 chemins d'écriture concurrents pour les flux École (§5, §6). |
| Plan / abonnement | `lib/plan-access.ts:59-61,96` | Modules École dans `ALWAYS_VISIBLE` : **aucun gating de plan**. Prix incohérents : 35 000 (`lib/plans.ts:114`) contre 15 000 (`lib/modules.ts:262`, `lib/admin-config.ts:13`). |

### 1.2 Rôles École

Rôles créés par la fonction `seed_ecole_roles` (`025_ecole_roles.sql`) : DIRECTION_GENERALE, RAF, SCOLARITE, RH_PAIE, FORMATEUR, ETUDIANT, PARENT, DTI, DAAC. Un trigger synchronise le cache `profiles.ecole_role_name` à partir de `dynamic_role_id`.

- Il n'y a pas de rôle « Direction école » distinct de DIRECTION_GENERALE.
- DTI n'a aucune page.
- `owner` n'est pas assimilé à DIRECTION_GENERALE (`lib/contexts/TenantContext.tsx:144`).

### 1.3 Correspondance avec l'architecture cible (Dashboard / Direction générale / Direction école / DAAC / RH & Paie)

| Pilier cible | Existant | Écart |
|---|---|---|
| Dashboard | `ecole/page.tsx` (844 l.) | Un seul tableau de bord, identique pour tous les rôles (§5.3). Une version par rôle (`_lib/ecole-dashboard-client.tsx`, 537 l.) existe mais n'est importée nulle part. |
| Direction générale | `ecole/direction/page.tsx` (8 onglets) | Opérations réelles, mais aucun rapport ni export. |
| Direction école | **pas de page dédiée** — fonctions dispersées entre `scolarite` (10 onglets), `parametres-academiques` et pages LMD | Pilier à structurer en réutilisant `scolarite`. |
| DAAC | `ecole/daac/page.tsx` (6 onglets) | Réutilise les sections de `scolarite` (doublon d'accès, pas de code). |
| RH & Paie | `ecole/rh/page.tsx` (2 171 l.) | Implémentation parallèle au module RH global (§7). |

---

## 2. Cartographie des routes et des composants

| Route (`/dashboard/ecole/...`) | Lignes | Garde de rôle | Tables principales | Notes |
|---|---|---|---|---|
| `/` (page.tsx) | 844 | **aucune** | etudiants, enseignants, classes_ecole, absences_etudiants, paiements_scolaires, notes_etudiants, notifications, planning_ecole | ETUDIANT et PARENT y atterrissent (`app/dashboard/page.tsx:53`). |
| `direction` | 725 | client `['DIRECTION_GENERALE']` (:642) | + bourses_etudiants*, partenaires_ecole*, annonces_ecole*, diplomas, defenses | `*` = table fantôme. |
| `daac` | 140 | client `['DIRECTION_GENERALE','DAAC']` | sessions_ecole, diplomas, defenses + sections académiques | |
| `scolarite` | 1 166 | **aucune** | etudiants, frais_scolaires, paiements_scolaires, notes_etudiants, absences_etudiants, classes_ecole, planning_ecole, subjects, exams… | Page cœur, 10 onglets filtrés par sous-type (:1055-1069). |
| `comptabilite` | 907 | client | journal_comptable, transactions | Comptabilité parallèle (§6). |
| `tresorerie` | 6 | — | — | Redirige vers `/dashboard/tresorerie` (conforme). Absente du menu. |
| `rh` (+ `_components/CreateEmployeeWizard.tsx` 677 l., `ProfilDrawer.tsx` 539 l.) | 2 171 | client `['DIRECTION_GENERALE','RAF','RH_PAIE']` (:2096) | employes, enseignants, staff_ecole, paie_ecole*, conges_ecole*, recrutements_ecole*, teacher_hours | God component. |
| `espace-parent` | 459 | client `['PARENT']` + proxy | etudiants, notes_etudiants, paiements_scolaires, absences_etudiants, notifications | |
| `espace-etudiant` | 526 | client + proxy | idem | IDOR (§6.1). |
| `espace-formateur` | 850 | proxy seulement | enseignants, teacher_hours, exams, exam_grades, cours_numeriques*, devoirs*, employes, bulletins_paie | |
| `parametres-academiques` | 617 | **aucune** | academic_settings | Paramètres jamais lus par un moteur. |
| `annees-academiques` | 311 | **aucune** | annees_academiques | Université uniquement. |
| `semestres`, `series`, `facultes`, `departements`, `parcours`, `unites-enseignement` | 261–393 | **aucune** | tables LMD 121/122 | Université (séries : lycée). |
| `deliberations` | 404 | **aucune** | deliberations_universite, RPC `fn_deliberer_annee` | |
| `diplomes`, `soutenances`, `theses` | 322–470 | **aucune** | ecole_diplomes, ecole_soutenances, ecole_theses | Doublon de diplomas/defenses. |
| `miaa` | 9 | — | — | Redirige vers `/dashboard/miaa?context=ecole`. |
| `/dashboard/bi/ecole` | 205 | plan | via `/api/bi/insights` | |

**Composants partagés :**

- `_lib/shared.tsx` (483 l.) : constantes `NIVEAUX`, `MENTIONS`, `DEFAULT_FRAIS`, `calcMoyenne`, `printBulletin`/`printReceipt`/`printAttestation`/`printDiploma` (impression par `document.write`).
- `_lib/academic-sections.tsx` (1 028 l.) : SectionMatieres, Sessions, Examens, Attestations, Diplômes, Soutenances. Utilisé par `scolarite`, `daac` et `direction`.
- `_lib/ecole-dashboard-client.tsx` : **code mort**.
- `components/ecole/BulletinPDF.tsx`, `AttestationPDF.tsx`, `DiplomaePDF.tsx` : rendu PDF. `BulletinPDF` est mort (sa route lit des tables fantômes).

**Liens morts ou trompeurs :**

- Les 20 liens du menu pointent tous vers une page existante.
- Raccourcis du tableau de bord : « Rapport rapide », « Générer un rapport », « Bulletins » et « Sauvegarde » mènent tous à `/ecole/direction` (`ecole/page.tsx:546,782-797`).
- Les raccourcis parent « Emploi du temps / Bulletins / Présences » mènent tous à la même page (`_lib/ecole-dashboard-client.tsx:419-422`).
- Le menu affiche « Semestres & Délibérations » (`erp-sectors.ts:139-145`) **et** « Délibérations » (`:178-183`).

**Pages gardées côté client uniquement :** 6 (direction, daac, comptabilite, rh, espace-etudiant, espace-parent).

**Pages sans aucune garde de rôle :** 15 (racine, scolarite, espace-formateur, et les 12 pages académiques ou LMD). Aucune page École n'utilise `usePermissions` (LOI-N).

---

## 3. Matrice vidéo / existant / écarts

| # | Parcours vidéo | Fonctionnalité | Existant Oraforme | Statut | Problèmes constatés | Réutilisable | Écart fonctionnel | Prio | Tests nécessaires |
|---|---|---|---|---|---|---|---|---|---|
| 1 | Création et configuration de l'établissement | **A** | Onboarding (`app/onboarding/actions.ts:99-114`) ; logo et infos dans les paramètres globaux `entreprise_config` (`app/dashboard/parametres/page.tsx:225-409`) ; `academic_settings` | 🟡 | Sous-type figé après onboarding ; `creche`/`garderie` incohérent ; repli « Mon École » codé en dur (`direction:662`, `daac:47`) | `entreprise_config`, upload logo global | Fiche établissement scolaire (coordonnées, photos, sous-type modifiable) | P2 | Onboarding par sous-type ; modification du sous-type ; affichage du nom |
| 1 | Années scolaires | **B** | `annees_academiques` (123) + page CRUD | 🟡 ♊ | Réservé au sous-type université (`annees-academiques:124`). Le sélecteur du tableau de bord est généré côté client (`ecole/page.tsx:330-338`). « 2024-2025 » codé en dur 11 fois. Direction et BI raisonnent en année civile. Aucune FK vers l'année ; plusieurs années « en cours » possibles. | Table + page CRUD | Année scolaire unique, active, référencée par classes, inscriptions, frais et notes, pour tous les sous-types | **P1** | Une seule année active ; bascule d'année ; filtres par année |
| 2 | Tableau de bord | **C** | `ecole/page.tsx` | 🟡 🔴 | Graphe sur 10 mois alimenté par le seul mois courant (:370, :438-450) ; série « prévisions » inexistante (:763) ; « taux de réussite » = moyenne × 5 (:458) ; libellés de mois figés (:158) ; « +N actifs ce mois » = total (:558) ; taux de présence calculé sur les inactifs (:401) ; top élèves tronqué à 200/500 (:372-374) ; aucun état d'erreur (:481-491) ; vue identique pour tous les rôles | `ecole-dashboard-client.tsx` (vues par rôle, à rebrancher), `lib/erp-core/compute/payments.ts` | Indicateurs justes, vues par rôle | **P1** | Indicateurs comparés à un jeu de données de recette |
| 2 | Actions rapides | C | Boutons du tableau de bord | 🔌 | 4 raccourcis mènent à `/ecole/direction` | — | Raccourcis réels | P2 | Navigation |
| 3 | Paramètres établissement, photos | A | `parametres-academiques` | 🔌 | `academic_settings` n'est lu par aucun moteur (mentions codées en dur, `shared:86`) ; aucune galerie photo | Page de paramètres | Brancher les paramètres sur le calcul | P2 | Une modification des mentions change le bulletin |
| 4 | Classes et catalogue de niveaux | **D** | `SectionClasses` (`scolarite:705-787`), `classes_ecole` | 🟡 | Niveaux = constante (`shared:69`) ; pas de modification ; suppression sans confirmation ni filtre tenant (:725) ; capacité `nb_places` jamais contrôlée ; `enseignant_id` (titulaire) jamais renseigné ; `serie`/`section` jamais écrits ; aucun lien classe→année | Table `classes_ecole`, section UI | Catalogue de niveaux par sous-type, classe rattachée à l'année, titulaire, capacité contrôlée | **P1** | CRUD classe ; refus au-delà de la capacité |
| 5 | Inscription et gestion des élèves | **E** | `SectionInscriptions` (`scolarite:88-300`), `etudiants` | 🟡 🔴 | **Collision de matricule** : `ETU-{année}-{count+1}` (:89-91) contre `UNIQUE(tenant_id, numero_id)` (008:30), échec silencieux ; pas de modification de la fiche ; suppression sans confirmation, en cascade sur notes, paiements et absences (:119) ; classe en texte libre (:283) ; pas de filtre par classe ; `limit(200)` sans pagination (:1101) ; ni réinscription, ni transfert ; libellé « étudiant » même en primaire | Formulaire complet (identité, parents, tuteur), recherche | Édition, réinscription annuelle, classe par FK, pagination | **P1** | Matricule unique sous concurrence ; suppression confirmée ; édition |
| 6 | Dossier individuel | **F** | Panneau flottant (`scolarite:219-279`) | 🟡 | 5 champs en lecture seule ; photo = URL saisie à la main ; aucun document téléversé ; responsable légal en colonnes texte ; `parent_links` (025:38) jamais utilisée | `ProfilDrawer.tsx` (présentationnel), `storage-service` | Fiche élève complète, documents, responsables légaux reliés à des comptes | P2 | Upload ; rattachement d'un parent |
| 6 | Carte d'élève, matricule, QR code | **G** | `numero_id` ; QR uniquement dans `api/documents/attestation` et `api/documents/diploma` | ❌ 🔴 | Pas de carte imprimable ; QR vers `/verify/attestation/{id}` et `/verify/diploma/{id}`, routes inexistantes (seul `app/verify/[code]` existe) ; ces routes API ne sont appelées par aucune interface et lisent `numero_etudiant` (colonne réelle : `numero_id`) et un embed `classes_ecole` sans FK | Générateur QR des routes documents, `app/verify/[code]` | Carte d'élève PDF avec QR vérifiable | P2 | Scan du QR qui mène à une page de vérification valide |
| 7 | Présences et historique | **H** | `SectionAbsences` (`scolarite:899-1050`), `absences_etudiants` | 🟡 🔴 | Absences saisies élève par élève uniquement ; pas d'appel par classe, pas de retard ; `demi_journee` inutilisé ; notification parent incompatible avec le schéma (champs `titre`, `etudiant_id`… contre `title`, `message`, `type` CHECK) alors que `notifie_parent: true` est enregistré (:919) ; trigger `fn_absence_to_notification` lisant `parent_user_id` (032:97) | Table, historique par élève | Feuille d'appel par classe et par date, historique par classe | **P1** | Appel d'une classe ; notification parent reçue |
| 8 | Gestion pédagogique et notes | **I** | Deux systèmes : `notes_etudiants` (`scolarite:567-700`) **et** `subjects`/`exams`/`exam_grades` (`academic-sections.tsx:41-590`) | ♊ 🟡 | Aucun pont entre les deux ; matière en texte libre dans le premier ; pas de matière par classe ; élèves retrouvés par égalité de texte (`acad:340-341`) ; rang calculé sur toute l'école ; coefficient du bulletin = celui de la 1re note (`shared:~166`) ; `report_cards` jamais utilisée ; erreurs ignorées. LMD : `deliberations:99` lit `libelle` au lieu de `intitule` (122:73) ; `credits_obtenus` et `moyenne` jamais renseignés, donc une délibération donne toujours 0 crédit | `subjects`/`exams`/`exam_grades` (le plus structuré), `calcMoyenne`, synthèse avec rang | Un seul système de notes, matières par classe, bulletin avec rang et appréciation | **P1** | Calcul de moyenne pondérée, rang par classe, bulletin |
| 9 | Encaissement des frais | **J** | `api/ecole/paiements` (POST), `frais_scolaires`, `paiements_scolaires`, `printReceipt` | 🟡 🔴 | Frais sans classe, niveau ni année (008:33-43) ; aucune notion de montant dû ni de solde ; statut forcé à `paye` (route:31) ; reçu numéroté `id.slice(0,8)`, non stocké ; suppression d'un paiement sans extourne comptable (`scolarite:438-441`) ; résultat de l'émission ECO-001 ignoré (route:40-57) ; `DEFAULT_FRAIS` codés en dur (`shared:108-117`) | Moteur ECO-001 + `fn_reverse_accounting_event`, `computeCollectionStatus` | Grille de frais par niveau et année, échéancier, solde, reçus numérotés | **P1** | Paiement partiel → solde ; annulation → extourne |
| 9 | Dépenses | J | `ecole/comptabilite:76-90` vers `journal_comptable` | ♊ | Doublon du module global `/dashboard/depenses`, sans partie double | Module global Dépenses | Utiliser le module global | P2 | Dépense École visible en comptabilité globale |
| 9 | Impayés | J | `direction:52-82`, agent `impayes` | 🔴 | **B3** : `.ilike('annee_scolaire')` sur une colonne absente (direction:55,74), donc tous les élèves sont comptés impayés et `autoBlock` peut **suspendre tous les élèves actifs**, sans confirmation ; l'agent cherche `bloque`, l'application écrit `suspendu` ; agent sans filtre tenant (`agents/securite.ts:188-207`) | — | Impayés = dû − payé, par échéance | **P0** | Un élève à jour n'est jamais suspendu |
| 10 | Gestion du personnel et affectations | **K** | `rh` : employes, enseignants, staff_ecole | 🟡 ♊ | Trois référentiels du personnel sans lien ; un seul enseignant par matière (`subjects.enseignant_id`) ; aucune affectation enseignant × classe × matière × année ; pas d'emploi du temps (`planning_ecole` = événements) ; onglets mal libellés (`rh:2101-2108`) | `subjects.enseignant_id`, `components/rh/EmployeeWizard/*` | Table d'affectation, emploi du temps | P1 | Affectation visible par le formateur |
| 10 | RH & Paie | **L** | `rh` : `paie_ecole`*, `conges_ecole`*, `recrutements_ecole`* | ♊ 🔴 | Paie calculée **côté client** et écrite directement (`rh:1480-1500`), hors du chemin serveur C3 ; `paie_ecole` absent des déclarations IRPP/CNSS ; écriture comptable incomplète (pas de 422/431/447) ; fausse charge 641 à l'embauche (`CreateEmployeeWizard:204-216`) ; double paiement possible ; heures enseignants : `'validated'` refusé par CHECK (025:13-14, rh:1930), donc validation et paiement des heures impossibles ; taux par défaut inventé de 5 000 (rh:1951) ; aucun contrat | `/api/paie/bulletins`, `universal-tax-engine`, `PayslipPDF`, `ContratPDF`, `contrats`, `conges` | Brancher l'École sur le module RH et Paie global | **P0/P1** | Paie École déclarée ; heures validées puis payées |
| 11 | Réseau d'établissements partenaires | **P** | `SectionPartenaires` (`direction:476-555`) sur `partenaires_ecole`* ; `107_enterprise_hierarchy` + `app/dashboard/groupe/*` | ❌ | Simple carnet de contacts sur une table fantôme ; la hiérarchie de groupe ne contient rien de propre à l'école | Hiérarchie `parent_tenant_id` | Réseau inter-écoles et agrégats de groupe | P3 | — |
| 12 | Portail public | **P** | `app/portail/` (client et candidat uniquement, `114_portails.sql:12`) | ❌ | Aucun portail École | Infrastructure des portails | Vitrine et préinscription en ligne | P3 | — |
| 12 | Recrutement scolaire | **P** | `app/api/jobs/*`, `app/jobs/[entreprise]/[poste]` (`offres_emploi`, générique) + `recrutements_ecole`* | ♊ 🔴 | Non relié à l'École ; `proxy.ts:6-24` ne liste ni `/jobs`, ni `/portail`, ni leurs API, donc **inaccessible aux visiteurs anonymes** ; `api/jobs/offre:24` lit `tenants.nom` et `secteur` (colonnes réelles : `nom_entreprise`, `secteur_activite`) ; `candidats`/`candidatures` fantômes (R-006) | Module jobs global | Offres École publiques | P3 | Candidat anonyme |
| — | Direction générale et rapports | **M** | `direction` (8 onglets) | 🟡 | CRUD réel, mais aucun rapport ni export ; suppressions sans tenant, confirmation ni gestion d'erreur (:297,497,577) ; aucun toast ; couleurs codées en dur hors palette (`#00b9a7`, `#ff7000`) ; formulaires `grid-cols-2` fixes | — | Rapports et exports PDF/Excel | P2 | Export |
| — | DAAC | **N** | `daac` | ✅ ♊ | Fonctionne, mais registres doubles des diplômes et soutenances (§7) ; KPI limités à 200 lignes | Sections académiques | — | P2 | — |
| — | Portail parent | **O** | `espace-parent` | 🟡 🔴 | Rattachement de l'enfant par `ilike` sur l'email ou le téléphone (:304-305) ; `parent_links` inutilisée ; onglet Alertes toujours vide (champs `titre`/`etudiant_id` inexistants) ; annonces jamais affichées ; aucune gestion d'erreur ; grille fixe en 4 colonnes | — | Rattachement par `parent_links`, bulletin, emploi du temps | **P0** (sécurité) / P2 | Un parent ne voit que son enfant |
| — | Espace étudiant | O | `espace-etudiant` | 🟡 🔴 | **IDOR** via le matricule (§6.1) ; `user_id` jamais renseigné ; repli sur `etudiants.email`, colonne non tracée | — | Rattachement par `user_id` | **P0** | Un élève ne voit pas un camarade |
| — | Espace formateur | O | `espace-formateur` | 🟡 🔴 | Déclaration d'heures cassée (colonnes absentes, :139, :707-712) avec toast de succès malgré l'échec ; notes : `exam_grades` insérés sans `tenant_id` NOT NULL (:579) ; examens de tout l'établissement visibles (:148) ; bulletins de paie lus dans `bulletins_paie` alors que l'École écrit dans `paie_ecole` | Cours et devoirs (filtrés par enseignant) | — | P1 | Déclaration d'heures, saisie de notes |
| — | Annuaire des écoles | P | — | ❌ | — | — | — | P3 | — |

---

## 4. Relations de données identifiées

### 4.1 Relations auditées

| Relation | FK en migration | Utilisée par le code | Verdict |
|---|---|---|---|
| établissement → année scolaire | `annees_academiques.tenant_id` (123) | université uniquement | 🟡 |
| année → classes | **aucune** (`classes_ecole.annee_scolaire` TEXT) | non | ❌ |
| classe → élèves inscrits | **aucune** (`etudiants.classe` TEXT) | égalité de texte (`acad:340-341`) | 🔴 fragile : renommer une classe détache ses élèves |
| classe → enseignant titulaire | `classes_ecole.enseignant_id` (018:25) | jamais renseignée | 🔌 |
| matière → enseignant | `subjects.enseignant_id` (024) | oui (`acad:47-67`) | ✅ |
| classe → matières | **aucune** | — | ❌ |
| élève → responsable légal | colonnes texte + `parent_links` (025:38) | colonnes texte uniquement | 🔌 |
| élève → présences | `absences_etudiants.etudiant_id` FK cascade (011) | oui | ✅ |
| élève → frais | **aucune** (frais sans cible) | — | ❌ |
| élève → paiements | `paiements_scolaires.etudiant_id` FK cascade (008:48) | oui | ✅ |
| paiement → frais | `paiements_scolaires.frais_id` (008:49) | facultatif, jamais rapproché | 🔌 |
| élève → reçus | aucune entité « reçu » | recalculé à l'impression | ❌ |
| élève → notes | `notes_etudiants.etudiant_id`, `exam_grades.etudiant_id` | oui, dans deux systèmes | ♊ |
| élève → bulletins | `report_cards` (024:64) | jamais utilisée | 🔌 |
| personnel → contrats | `contrats` (072, global) | pas côté École | ❌ |
| personnel → affectations | `subjects.enseignant_id` uniquement | partiel | 🟡 |
| personnel → paie | `paie_ecole.employe_id` polymorphe, sans FK (table fantôme) | oui, sur trois tables | 🔴 |
| `ecole_theses` / `ecole_soutenances` / `ecole_diplomes` → élève | `etudiant_id` **sans FK** (100) | nom en texte | 🔴 |

### 4.2 Concepts en doublon

- **Année** : `annees_academiques` (orpheline), 4 colonnes TEXT `annee_scolaire`/`annee_universitaire`, et `paiements_scolaires.annee` en INT.
- **Notes** : `notes_etudiants`, `exam_grades`, `semestres_etudiants.notes_ue` (JSONB), `report_cards` (inutilisée), plus les fantômes `bulletins_notes` et `notes_bulletin`.
- **Diplômes et soutenances** : `diplomas` + `defenses` (024) **et** `ecole_diplomes` + `ecole_soutenances` + `ecole_theses` (100). Les deux séries sont utilisées par des pages différentes.
- **Personnel** : `employes`, `enseignants` et `staff_ecole`. `paie_ecole` double `bulletins_paie`, `conges_ecole` double `conges`, `recrutements_ecole` double le recrutement global.
- **Trésorerie** : `ecole_wallets`, `ecole_wallet_movements`, `ecole_cheques`, `ecole_virements` (029). Elles ne sont jamais utilisées et doublonnent les tables globales de 043.
- **Matières** : `subjects.semestre` est en TEXT (« S1 »), `unites_enseignement.semestre` en INT.
- **Paramètres** : `academic_settings` est créée deux fois (028, puis 121 avec d'autres valeurs par défaut, sans effet grâce à IF NOT EXISTS).

### 4.3 Tables et colonnes fantômes (absentes de toute migration du dépôt)

**Tables :**

- `annonces_ecole`, `bourses_etudiants`, `partenaires_ecole` (direction) ;
- `paie_ecole`, `conges_ecole`, `recrutements_ecole` (rh) ;
- `cours_numeriques`, `devoirs` (espace-formateur) ;
- `bulletins_notes`, `notes_bulletin` (route bulletin-scolaire) ;
- `absences_ecole` (`app/dashboard/page.tsx:180`).

Elles n'apparaissent que dans la boucle RLS `ALTER TABLE IF EXISTS` de 067:62-70. `supabase/backfill_paie_comptabilite.sql` et `tests/validate_rls_wave4a.sql` suggèrent que certaines existent en production, avec un schéma et une RLS inconnus.

**Colonnes :**

| Colonne | Utilisée dans | Conséquence |
|---|---|---|
| `paiements_scolaires.annee_scolaire` | direction:55,74 | B3 |
| `paiements_scolaires.date_paiement` | `api/bi/insights:214` | KPI BI à 0 ou en erreur |
| `paiements_scolaires.source` | écrite par le trigger `trg_ps_source_label` (054:628-651) | Si le trigger est installé, **tout INSERT de paiement échoue** |
| `etudiants.email` | espace-etudiant ; policy 034 | Présente en production d'après TD-MIG-034, mais non tracée |
| `etudiants.numero_etudiant` | routes attestation/diploma | Colonne réelle : `numero_id` |
| `enseignants.user_id` | espace-formateur:115-120 | — |
| `employes.email` | espace-formateur:160 | Supprimée par 038 |
| `teacher_hours.date_declaration`, `periode`, `description` | rh, espace-formateur | — |
| `notifications.titre`, `etudiant_id`, `destinataire_role`… | plusieurs pages | Schéma réel : `title`, `message`, `user_id`, `type` CHECK |
| `parent_links.parent_user_id` | trigger 032:97,101 | Colonne réelle : `user_id` |
| `parcours_universite.libelle` | deliberations:99 | Colonne réelle : `intitule` |
| `tenants.nom`, `tenants.secteur` | `api/jobs/offre:24` | — |

### 4.4 Triggers et fonctions en jeu

| Table | Trigger / fonction | Constat |
|---|---|---|
| `paiements_scolaires` | `trg_paiement_to_transaction` → `sync_paiement_scolaire_to_transaction()` (023:85-117) | Jamais supprimé ; s'ajoute au moteur ECO-001, qui écrit aussi `transactions`. **Risque fort de double ligne de trésorerie**, malgré l'annonce QW-03 de 143 (❔ à vérifier en base). |
| `paiements_scolaires` | `trg_paiement_notify` (032) | S'ajoute aux deux inserts de notification côté client. |
| `paiements_scolaires` | `trg_ps_source_label` (054) | Colonne fantôme (voir ci-dessus). |
| `absences_etudiants` | `trg_absence_notify` (032) | Colonne `parent_user_id` erronée. |
| `ecole_wallet_movements` | `trg_wallet_movement_journal` (031) | Écrit directement dans `journal_entries`, en violation de LOI-K. Table inutilisée, donc dormant. |
| `attestations`, `diplomas` | `gen_attestation_ref`, `gen_diploma_number` (024) | Numérotation à partir de l'epoch modulo : risque de collision. |
| RPC | `fn_deliberer_annee`, `fn_valider_parcours_etudiant` (123:105, 123:150) | `SECURITY DEFINER`, `p_tenant_id` fourni par le client, sans contrôle de `get_my_tenant_id()` ni `REVOKE`. |
| RPC | `seed_ecole_roles`, `fn_seed_sector_roles` | Accordées à `authenticated`. |

---

## 5. Problèmes de fonctionnement confirmés

« Confirmé » signifie prouvé par la lecture du code et des migrations du dépôt. Les éléments marqués ❔ dépendent de l'état réel de la base.

### 5.1 Bloquants fonctionnels (P0)

1. **B3 — Suspension en masse des élèves.** `direction/page.tsx:55,74` filtre sur `paiements_scolaires.annee_scolaire`, colonne absente. La requête échoue en silence, la liste des élèves ayant payé est vide, et le bouton `autoBlock` (:69-82) suspend **tous** les élèves actifs.
   - Pas de confirmation.
   - Mise à jour par `.eq('id')` seul, en boucle, sans gestion d'erreur.
   - Le bouton porte l'icône `Unlock` alors qu'il bloque.
2. **Heures enseignants impossibles à valider ou à payer.** Le code écrit `statut: 'validated'` (`rh:1930`), alors que la contrainte CHECK n'accepte que `declare`, `valide` ou `paye` (025:13-14). La déclaration côté formateur échoue aussi (colonnes absentes) mais affiche un toast de succès.
3. **Collision de matricule** : `ETU-{année}-{count+1}` (`scolarite:89-91`) contre `UNIQUE(tenant_id, numero_id)`. Après une suppression ou deux inscriptions simultanées, l'inscription échoue sans message.
4. **Paie École hors circuit fiscal** : `paie_ecole` n'est lue par aucune déclaration IRPP ni CNSS. Les retenues prélevées ne sont jamais déclarées.
5. **Suppression d'un paiement sans extourne** (`scolarite:438-441`) : l'écriture ECO-001 et la ligne de trésorerie restent orphelines.
6. ❔ **Trigger `trg_ps_source_label`** : s'il est installé, il bloque tous les encaissements.

### 5.2 Erreurs fonctionnelles (P1)

7. Graphique des paiements faux, « taux de réussite » fabriqué, libellés de mois décalés, taux de présence biaisé, indicateurs tronqués (§3, ligne C).
8. Délibérations LMD : `libelle` au lieu de `intitule` (`deliberations:99`) ; `credits_obtenus` et `moyenne` jamais renseignés, donc aucune délibération n'aboutit.
9. Notifications (absences, paiements, heures, nouvel employé) incompatibles avec le schéma. Les échecs sont avalés par des `try/catch` qui ne capturent rien (supabase-js renvoie l'erreur sans la lever).
10. Insertion manuelle en trésorerie impossible dans `ecole/comptabilite:453-462` (`category`/`label` au lieu de `categorie`, `description` obligatoire manquante).
11. Comptabilité de l'École éclatée : Journal, Grand Livre, Bilan et Prévisions lisent uniquement `journal_comptable` (`comptabilite:69,214,315,661`). Les recettes ECO-001, qui sont dans `journal_entries`, n'y apparaissent pas.
12. Écriture comptable de paie incomplète (`rh:1505-1535`) et fausse charge 641 à la création d'un employé.
13. Agent impayés : il cherche `bloque` alors que l'application écrit `suspendu`, ne filtre pas par tenant et ne calcule aucun impayé.
14. Espace formateur : `exam_grades` inséré sans `tenant_id` (NOT NULL), onglet Paiements vide.
15. Routes `bulletin-scolaire`, `attestation` et `diploma` cassées (tables et colonnes fantômes, QR vers des routes inexistantes) et appelées par aucune interface.
16. Requêtes BI École sur `date_paiement`, colonne absente.
17. Texte corrompu (U+FFFD) dans `scolarite` et `rh`.
18. Recrutement inaccessible aux visiteurs anonymes (proxy).

### 5.3 Défauts UX

- **Erreurs** : aucun toast de succès ou d'erreur dans `scolarite`, `direction` et `academic-sections`. Les erreurs sont ignorées presque partout.
- **Confirmations** : pas de confirmation à la suppression d'un élève, d'une classe, d'une absence ou d'un paiement, ni avant la suspension en masse. Seules les pages LMD utilisent `confirm`.
- **Tableau de bord** : identique pour tous les rôles, ETUDIANT et PARENT compris.
- **Navigation** : pas de sous-menus par direction (liste plate + onglets). Onglets RH mal libellés et texte des onglets inactifs presque invisible (`rgba(255,255,255,0.5)` sur fond clair).
- **Exports** : pas de pagination (`limit(200)`), pas d'export élèves (seul `diplomes:215` exporte en CSV), pas de rapport de direction.
- **Fiches** : pas de fiche élève complète, pas de carte d'élève.
- **Mobile** : grilles KPI en `grid-cols-4` fixes (espaces parent et étudiant), formulaires en `grid-cols-2` fixes (direction), tableaux sans `overflow-x-auto`. Débordement probable à 375 px.
- **Couleurs** : codées en dur hors palette Oraforme (`#00b9a7`, `#ff7000`, `#101729`, `#FFFFFF`), ce qui casse le mode sombre. `#DC2626` est utilisé pour presque tous les statuts.

---

## 6. Risques liés aux permissions

### 6.1 Constats confirmés dans le dépôt

| # | Risque | Preuve | Gravité |
|---|---|---|---|
| R1 | **Le cloisonnement par rôle de la RLS est neutralisé.** 034 ajoute des policies par rôle sur `paiements_scolaires`, `frais_scolaires` et `notes_etudiants`, mais supprime des noms qui n'existent pas (`"…: select"`). Les policies d'origine `sel_*`/`ins_*`/`upd_*`/`del_*` (008:86-100) restent en place, et 067:62-102 ajoute `"<table>: tenant" FOR ALL` sur toutes les tables École. Les policies permissives se combinant par OU, **tout membre du tenant (ETUDIANT, PARENT, FORMATEUR) peut lire et modifier via l'API tous les élèves, notes, paiements et absences**. Il s'agit de données de mineurs. | 008, 034:195-275, 067 | **CRITIQUE** |
| R2 | **IDOR espace étudiant** : `lookupByNumeroId` charge n'importe quel élève du tenant à partir d'un matricule saisi librement (`espace-etudiant:347-362`) ; le bouton « Changer de compte » (:409) invite à le faire ; matricules séquentiels | code | **CRITIQUE** |
| R3 | **RPC cross-tenant** : `fn_deliberer_annee` et `fn_valider_parcours_etudiant` sont `SECURITY DEFINER` et prennent un `p_tenant_id` fourni par le client sans contrôle (123:105,150) ; `seed_ecole_roles` et `fn_seed_sector_roles` sont accordées à `authenticated` | 123, 025 | **CRITIQUE** |
| R4 | `POST /api/ecole/paiements` : pas de contrôle de rôle, et `etudiant_id`/`frais_id` ne sont pas vérifiés comme appartenant au tenant. L'écriture passe par `supabaseAdmin`, donc sans RLS. Tout membre peut créer un paiement « payé » et générer l'écriture ECO-001. | route.ts:5-60 | ÉLEVÉE |
| R5 | Rattachement parent→enfant par `ilike` non échappé sur l'email ou le téléphone (`espace-parent:304-305`) ; `parent_links` inutilisée ; filtres `.or()` construits avec la saisie brute (parent:319, étudiant:369) | code | ÉLEVÉE |
| R6 | Pas de garde de rôle serveur : `layout.tsx` ne contrôle que le secteur. 15 pages n'ont aucune garde, les 6 autres une garde client seulement. La sidebar ne fait que masquer des liens. | layout, useRoleGuard | ÉLEVÉE |
| R7 | ETUDIANT et PARENT voient le tableau de bord global de l'établissement (paiements, meilleurs élèves) | `app/dashboard/page.tsx:53`, `ecole/page.tsx` | ÉLEVÉE |
| R8 | Un étudiant peut se débloquer lui-même : `toggleBlock` et `code_deblocage` ne sont protégés que par l'interface ; la RLS UPDATE est au niveau du tenant | espace-etudiant:375-386 | MOYENNE |
| R9 | Paie calculée côté client et persistée directement : le net à payer peut être falsifié depuis les devtools (même faille que celle fermée par C3 pour `bulletins_paie`) | rh:1480-1500 | ÉLEVÉE |
| R10 | XSS dans les impressions par `document.write` (`printBulletin`, `printReceipt`, `printAttestation`, `printDiploma`, bulletin de paie RH) : noms, matières et nom de l'école injectés sans échappement dans une fenêtre de même origine | shared.tsx:141-197,345,379 ; rh:1055-1345 | MOYENNE |
| R11 | `notifications` : `notifications_insert_service WITH CHECK (true)` (056) permet à tout utilisateur connecté d'écrire une notification pour n'importe qui ; en lecture, la policy 067 au niveau du tenant expose les notifications de tous les membres | 056, 067 | MOYENNE |
| R12 | `staff_ecole` : la policy 037 compare `profiles.id = auth.uid()`, ce qui est toujours faux ; seule la policy 067 au niveau du tenant donne l'accès | 037 | FAIBLE |
| R13 | `api/documents/bulletin-scolaire` : pas de contrôle de rôle, un ID suffit (route par ailleurs cassée) | route | FAIBLE |
| R14 | `fn_get_my_ecole_role()` : `LIMIT 1` sans `ORDER BY` (034:35-39), contraire à la règle multi-tenant | 034 | FAIBLE |
| R15 | Mutations sans `tenant_id` explicite (direction:78,297,497,577 ; scolarite:439,725,811,959 ; acad:75,188,751,756,890,898 ; rh, espace-formateur) : la défense repose entièrement sur la RLS | code | FAIBLE (tant que la RLS du tenant tient) |

### 6.2 Points critiques du MASTER A→Z qui touchent aussi l'École

- Fuite RLS `tenants_select` : les profils de tous les tenants sont lisibles.
- Fuite RLS `journal_entries` : les écritures ECO-001 sont concernées.
- Le moteur de permissions (LOI-N) n'a aucune application côté serveur.
- `seed_ecam_congo.sql` contient un DELETE inconditionnel sur `etudiants`, `enseignants`, `staff_ecole` et `employes` (P0A2, suspendu).

### 6.3 Droits effectifs par rôle (déduits du code ; la RLS rend tout rôle équivalent au niveau données)

| Rôle | Accès UI prévu | Accès réel aux données (API directe) |
|---|---|---|
| owner / DIRECTION_GENERALE | toutes les pages | tout le tenant |
| RAF | rh, comptabilite (+ modules globaux) | tout le tenant |
| SCOLARITE | scolarite, pages académiques ; **pas** les vues admin des espaces parent et étudiant (proxy) | tout le tenant |
| DAAC | daac, pages académiques | tout le tenant |
| RH_PAIE | rh, espace-formateur | tout le tenant |
| FORMATEUR | espace-formateur (+ pages non gardées accessibles par URL) | tout le tenant, notes comprises |
| ETUDIANT | espace-etudiant + tableau de bord global | **tout le tenant** (R1, R2) |
| PARENT | espace-parent + tableau de bord global | **tout le tenant** (R1) |
| DTI | aucune page | tout le tenant |

---

## 7. Doublons et composants réutilisables

### 7.1 Doublons à résorber (ne pas en créer de nouveaux)

| Domaine | Version École | Version de référence à conserver |
|---|---|---|
| Paie | `paie_ecole` (fantôme) + calcul client | `bulletins_paie` + `/api/paie/bulletins` (autorité serveur C3) + trigger `trg_bulletins_paie` |
| Bulletin de paie | `buildBulletinHTML` (`rh:1055-1345`) | `components/rh/PayslipPDF.tsx`, `/api/rh/paie/[id]/bulletin-pdf` |
| Création d'un employé | `CreateEmployeeWizard.tsx` (insert client + fausse écriture) | `app/dashboard/rh/employes/nouveau` + `components/rh/EmployeeWizard/*` + `POST /api/hr/employees` |
| Congés | `conges_ecole` | `conges` |
| Recrutement | `recrutements_ecole` | module `rh/recrutement` + `offres_emploi` |
| Contrats | aucun | `contrats` (072) + `ContratPDF.tsx` |
| Comptabilité | `ecole/comptabilite` (`journal_comptable`) | comptabilité globale (`journal_entries` via le moteur) |
| Trésorerie | onglet Trésorerie de `ecole/comptabilite` + tables 029 | `/dashboard/tresorerie/*` (la redirection `ecole/tresorerie` est déjà conforme) |
| Dépenses | `ecole/comptabilite:76-90` | `/dashboard/depenses` |
| Diplômes et soutenances | `diplomas`/`defenses` **et** `ecole_diplomes`/`ecole_soutenances` | à arbitrer : `diplomas`/`defenses` ont les FK vers l'élève, `ecole_diplomes` a le `verification_code` utilisé par `app/verify/[code]` |
| Notes | `notes_etudiants` **et** `exams`/`exam_grades` | à arbitrer : `exams`/`exam_grades` est plus structuré (sessions, matières, enseignant, rang) |
| Personnel | `enseignants`, `staff_ecole`, `employes` | `employes` pour le RH ; `enseignants` à limiter au volet pédagogique, relié à `employes` |
| Menu | « Délibérations » ×2 ; RH et Compta core + École pour DG/RAF | un seul point d'entrée par fonction |
| Tableau de bord | `ecole/page.tsx` + `_lib/ecole-dashboard-client.tsx` (mort) + logique École de `components/dashboard/DashboardClient.tsx:434,573-574,623` (inatteignable) | conserver une seule implémentation |

### 7.2 Réutilisables tels quels

- **Comptabilité** : moteur comptable `emit_accounting_event` / `fn_reverse_accounting_event` (ECO-001 actif, ECO-002 en brouillon, prêt pour les remboursements).
- **Encaissements** : `lib/erp-core/compute/payments.ts` (`aggregatePaymentsByMode`, `computeCollectionStatus`, `computePaymentsTrend`), que l'École n'utilise pas aujourd'hui.
- **Sécurité** : `requireTenant(requiredRole)` (`lib/tenant-guard.ts`), `lib/api/require-automation`.
- **Paie** : `lib/fiscal/universal-tax-engine.ts`, `lib/paie/calcul-paie.ts`.
- **Composants RH** : `components/rh/*` (PayslipPDF, ContratPDF, EmployeePhotoUploader, EmployeeWizard).
- **École** :
  - `_lib/academic-sections.tsx` (matières avec enseignant, sessions, examens, saisie par lot, synthèse avec rang) ;
  - `ProfilDrawer.tsx` (présentationnel) ;
  - `_lib/ecole-dashboard-client.tsx` (vues par rôle, à rebrancher) ;
  - pages LMD (toasts et `confirm` déjà en place, bon modèle UX).
- **Vérification et documents** : `app/verify/[code]` + `fn_verifier_diplome` (vérification publique), générateur QR des routes documents, `storage-service`.
- **Navigation** : Sidebar et `SECTOR_SPECIFIC.ecole` (structure `roleFilter` / `minSousType` déjà en place).

---

## 8. Plan de réalisation par lots

Les lots sont ordonnés selon leurs dépendances. Type : 🐞 correction de bug · 🎨 amélioration UX · ✨ nouvelle fonctionnalité. Chaque lot qui touche au SQL suppose un canal de validation sur une base (voir Lot 0).

### Lot 0 — État réel de la base (prérequis, lecture seule)

- **Résultat attendu** : un inventaire signé de l'état de production pour le périmètre École.
- **Fonctionnalités** : toutes.
- **Actions** :
  - lister dans `information_schema.columns` les 47 tables + 11 tables fantômes ;
  - extraire `pg_policies` pour ces tables ;
  - extraire `pg_trigger` pour `paiements_scolaires`, `absences_etudiants` et `notifications` ;
  - lire `routine_privileges` sur les RPC 123 et 025 ;
  - rechercher dans `transactions` les doublons `source='paiements_scolaires'` / `'ecole'` ;
  - compter les élèves `suspendu` (impact passé de B3).
- **Fichiers** : aucun, ou un document `docs/` de résultat.
- **Dépendances** : canal de lecture production (R-006 : pas d'environnement de recette).
- **Risques** : aucun en lecture.
- **Validation** : chaque ❔ de ce rapport est tranché.

### Lot 1 — Sécurité des données École (🐞, P0)

- **Résultat attendu** : un PARENT, un ETUDIANT ou un FORMATEUR ne peut accéder qu'à ses propres données, y compris par appel API direct.
- **Fonctionnalités** : O, E, I, J, gardes de rôle.
- **Actions** :
  - consolider les policies École (supprimer les `sel_*`, les policies 067 au niveau du tenant et les policies 034 inopérantes, puis recréer par rôle) ;
  - relier parents et élèves par `parent_links` et `etudiants.user_id` ;
  - supprimer la recherche par matricule de l'espace étudiant ;
  - contrôler le tenant dans les RPC `SECURITY DEFINER` (+ `REVOKE`) ;
  - contrôler rôle et tenant dans `api/ecole/paiements` ;
  - ajouter des gardes de rôle sur les 15 pages non gardées et rediriger ETUDIANT/PARENT hors du tableau de bord global ;
  - échapper le HTML des impressions.
- **Fichiers probables** : nouvelle migration RLS, `espace-parent`, `espace-etudiant`, `api/ecole/paiements/route.ts`, `ecole/layout.tsx`, `_lib/shared.tsx`, `app/dashboard/page.tsx`, `lib/erp-sectors.ts`.
- **Dépendances** : Lot 0. Arbitrage de l'utilisateur sur les droits par rôle (la consigne de cet audit interdisait d'y toucher).
- **Risques** : couper un accès légitime (SCOLARITE, DAAC) ; rejeu de migrations impossible.
- **Tests d'acceptation** : jeux de tests RLS par rôle (`tests/validate_rls_*`) ; parent A ne lit pas l'enfant B ; un étudiant ne lit pas un camarade ; RPC appelée avec un tenant tiers → refus.
- **Validation** : rapport de tests RLS au vert, revue sécurité.

### Lot 2 — Bugs bloquants fonctionnels (🐞, P0)

- **Résultat attendu** : plus aucune opération qui casse ou détruit des données.
- **Actions** :
  - B3 : désactiver ou corriger `autoBlock` et le calcul des impayés, ajouter une confirmation ;
  - CHECK `teacher_hours` : aligner le code sur `valide`, corriger les colonnes de l'espace formateur ;
  - matricule : séquence côté base ou RPC ;
  - suppression d'un paiement → `fn_reverse_accounting_event`, et lecture du résultat d'émission ECO-001 ;
  - colonnes fantômes : `libelle`→`intitule`, `date_paiement`, `numero_etudiant`, notifications ;
  - `exam_grades.tenant_id` ;
  - correction de l'encodage U+FFFD ;
  - confirmations avant toute suppression ;
  - toasts d'erreur.
- **Fichiers** : `direction`, `rh`, `espace-formateur`, `scolarite`, `deliberations`, `api/bi/insights`, `academic-sections`.
- **Dépendances** : Lot 0 (schéma réel), Lot 1 pour les routes serveur.
- **Risques** : corriger une colonne qui existe réellement en production (d'où le Lot 0).
- **Tests** : tests unitaires des calculs ; E2E inscription, encaissement, annulation, déclaration et validation d'heures.
- **Validation** : aucun échec silencieux sur les parcours E, H, I, J, K.

### Lot 3 — Socle référentiel : année → classes → élèves (✨ + 🐞, P1)

- **Résultat attendu** : une année scolaire active pour tous les sous-types ; les classes rattachées à l'année ; l'élève relié à sa classe par FK ; réinscription annuelle.
- **Fonctionnalités** : B, D, E.
- **Actions** :
  - étendre `annees_academiques` à tous les sous-types (pas de nouvelle table) ;
  - ajouter `classes_ecole.annee_id` et `etudiants.classe_id` (backfill depuis le texte) ;
  - catalogue de niveaux par sous-type ;
  - contrôle de capacité ;
  - édition de la fiche élève ;
  - pagination et filtres par classe.
- **Fichiers** : migration, `scolarite`, `annees-academiques`, `_lib/shared.tsx`, `erp-sectors.ts`.
- **Dépendances** : Lots 0 à 2.
- **Risques** : backfill texte → FK sur des données réelles (noms de classes incohérents).
- **Tests** : une seule année active ; renommer une classe ne détache plus les élèves ; refus au-delà de la capacité.

### Lot 4 — Pédagogie unifiée : matières, affectations, notes, bulletins (✨ + ♊, P1)

- **Résultat attendu** : un seul système de notes, des matières par classe, une affectation enseignant × classe × matière × année, un bulletin avec rang et appréciation.
- **Fonctionnalités** : I, K (affectations), portail formateur.
- **Actions** :
  - choisir `subjects`/`exams`/`exam_grades` comme système unique et migrer `notes_etudiants` ;
  - relier les matières aux classes ;
  - utiliser `report_cards` ;
  - brancher `academic_settings` (mentions) ;
  - LMD : alimenter `credits_obtenus` et `moyenne` ;
  - arbitrer entre `diplomas`/`defenses` et `ecole_*`.
- **Dépendances** : Lot 3.
- **Risques** : migration de notes existantes.
- **Tests** : calcul de moyenne et de rang par classe ; une délibération aboutit.

### Lot 5 — Présences (✨, P1)

- **Résultat attendu** : feuille d'appel par classe et par date, retards, historique par élève et par classe, notification parent fonctionnelle.
- **Fonctionnalités** : H.
- **Dépendances** : Lot 3 (classe par FK), Lot 1 (`parent_links`).
- **Tests** : appel d'une classe de 30 élèves ; notification reçue par le parent relié.

### Lot 6 — Frais, encaissements, reçus, impayés (✨ + 🐞, P1)

- **Résultat attendu** : grille de frais par niveau et par année, montant dû par élève, échéancier, paiement partiel, solde, reçus numérotés et stockés, impayés exacts, comptabilité unique.
- **Fonctionnalités** : J.
- **Actions** :
  - colonnes de ciblage sur `frais_scolaires` ;
  - reçus séquentiels ;
  - réutiliser `computeCollectionStatus` ;
  - supprimer le trigger 023 si le Lot 0 confirme la double écriture ;
  - retirer la comptabilité parallèle `ecole/comptabilite` au profit du global (ou en faire une vue filtrée sur `journal_entries`) ;
  - corriger l'agent impayés.
- **Dépendances** : Lots 0, 2 et 3.
- **Risques** : LOI-K (writer unique) ; données comptables historiques dans `journal_comptable`.
- **Tests** : paiement partiel → solde correct ; annulation → extourne ; une seule ligne `transactions` par paiement.

### Lot 7 — RH & Paie École sur le module global (♊ → réutilisation, P0/P1)

- **Résultat attendu** : le personnel École dans `employes`, la paie par `/api/paie/bulletins`, les contrats par `contrats`, les congés par `conges` ; les IRPP et CNSS École déclarés.
- **Fonctionnalités** : K, L.
- **Actions** :
  - relier `enseignants` à `employes` ;
  - remplacer `paie_ecole` et le wizard École par les composants globaux ;
  - abandonner la fausse charge 641 ;
  - découper `rh/page.tsx` (2 171 l.).
- **Dépendances** : Lot 0 (schéma réel de `paie_ecole`), Lot 2.
- **Risques** : reprise de l'historique de `paie_ecole` ; double paiement pendant la transition.
- **Tests** : paie d'un enseignant marié avec enfants (IRPP correct) ; bulletin visible dans l'espace formateur ; déclaration CNSS préremplie.

### Lot 8 — Navigation, tableaux de bord par rôle, directions (🎨 + 🐞, P1/P2)

- **Résultat attendu** : sous-menus par pilier (Dashboard / Direction générale / Direction école / DAAC / RH & Paie), un tableau de bord par rôle aux indicateurs justes, des actions rapides réelles et des rapports exportables.
- **Fonctionnalités** : C, M, N.
- **Actions** :
  - rebrancher `ecole-dashboard-client.tsx` et supprimer la version morte de `DashboardClient` ;
  - corriger les KPI ;
  - dédoublonner le menu ;
  - aligner les couleurs sur les tokens Oraforme (primary #F59E0B, danger #DC2626, success #16A34A, info #2563EB) ;
  - rendre les grilles responsives ;
  - gérer erreurs, chargement et états vides ;
  - corriger le cas de l'owner sans `ecole_role_name` (`Sidebar.tsx:608-609`, suspicion).
- **Dépendances** : Lots 1, 3 et 6 (données justes).
- **Tests** : visuels à 375, 768 et 1440 px ; KPI comparés à un jeu de données de recette.

### Lot 9 — Fiche élève, documents, carte et QR (✨, P2)

- **Fonctionnalités** : F, G.
- **Actions** : fiche élève complète (réutiliser `ProfilDrawer`), upload de documents (`storage-service`), carte d'élève PDF avec QR vers une route de vérification existante (`app/verify/[code]`).
- **Dépendances** : Lots 1 et 3.
- **Tests** : le scan du QR mène à une page valide ; le document est accessible au seul rôle habilité.

### Lot 10 — Configuration de l'établissement (✨, P2)

- **Fonctionnalités** : A.
- **Actions** : fiche établissement (coordonnées, logo, photos) dans `entreprise_config` ; sous-type modifiable ; alignement `creche`/`garderie` ; gating de plan et prix cohérents.
- **Dépendances** : Lot 8.

### Lot 11 — Réseau, portail public, recrutement scolaire (✨, P3)

- **Fonctionnalités** : P.
- **Actions** :
  - agrégats de groupe par établissement (réutiliser `parent_tenant_id`) ;
  - portail public École (réutiliser l'infrastructure `app/portail`) ;
  - offres École dans le module jobs global ;
  - ouvrir `/jobs` et `/portail` dans `proxy.ts` ;
  - créer `partenaires_ecole` proprement ou la retirer.
- **Dépendances** : Lots 1, 8 et 10.

---

## 9. Tests nécessaires

| Niveau | Tests |
|---|---|
| RLS (SQL) | Pour chaque table École et chaque rôle (DG, RAF, SCOLARITE, DAAC, RH_PAIE, FORMATEUR, ETUDIANT, PARENT) : SELECT/INSERT/UPDATE/DELETE autorisés ou refusés. Cas cross-tenant. RPC `SECURITY DEFINER` appelées avec un tenant tiers. |
| API | `POST /api/ecole/paiements` : rôle non autorisé → 403 ; élève d'un autre tenant → refus ; montant ≤ 0 → 400 ; écriture ECO-001 présente ; annulation → extourne. Agent impayés : périmètre par tenant. |
| Unitaires | Moyenne pondérée, rang par classe, mentions issues de `academic_settings`, solde dû/payé, génération de matricule, calcul de paie via `universal-tax-engine`. |
| Architecture | Étendre `lib/architecture/loi-k-unique-writer.test.ts` (aucun insert direct dans `journal_comptable`/`journal_entries` depuis `app/dashboard/ecole`) et `paie-consommateurs-p0.test.ts` (aucune paie hors `/api/paie/bulletins`). Interdire les colonnes fantômes par un test de schéma. |
| E2E (Playwright) | Parcours de la vidéo 1→12 par rôle : configuration → année → classe → inscription → fiche → carte → appel → notes → bulletin → encaissement/reçu → personnel/affectation → portail parent. |
| UX | Captures à 375, 768 et 1440 px ; états de chargement, d'erreur et vides ; confirmations ; toasts ; mode sombre. |
| Non-régression | Tableau de bord École, BI École, trésorerie globale, comptabilité globale et module RH global inchangés pour les autres secteurs. |
| Encodage | Contrôle CI : aucun U+FFFD dans `app/`. |

---

## 10. Points impossibles à confirmer sans la base

1. Existence et schéma réels des 11 tables fantômes, et leur RLS.
2. Présence en production des colonnes `paiements_scolaires.annee_scolaire`, `date_paiement`, `source` ; `etudiants.email` ; `parent_links.parent_user_id` ; `teacher_hours.date_declaration`. Si certaines existent, les bugs correspondants (dont B3) changent de nature.
3. Présence effective des triggers `trg_ps_source_label` (bloquant), `trg_absence_notify` (bloquant si `parent_links` est non vide), `trg_paiement_to_transaction` (double écriture).
4. Liste réelle des policies sur les tables École : les `sel_*` de 008 existent-elles encore ? 034 et 067 ont-elles été appliquées ?
5. Privilèges EXECUTE réels sur `fn_deliberer_annee`, `fn_valider_parcours_etudiant`, `seed_ecole_roles`.
6. Doublons existants dans `transactions` pour les paiements scolaires.
7. Nombre d'élèves déjà suspendus à tort par `autoBlock`.
8. Comportement visuel réel (aucun parcours n'a été exécuté dans un navigateur pendant cet audit) et conformité à la vidéo plan par plan : la vidéo n'a pas été fournie sous forme de fichier, la correspondance s'appuie sur les 12 parcours décrits dans la consigne.
9. Suspicion `Sidebar.tsx:608-609` : un owner sans `ecole_role_name` perdrait l'accès aux modules RH, Compta et Trésorerie globaux.

---

## 11. Verdict

### **BLOCKED** pour le démarrage de l'implémentation des lots fonctionnels (Lots 3 à 11)

**Motifs :**

1. **Sécurité (R1, R2, R3).** Les données de mineurs (notes, absences, paiements) sont lisibles et modifiables par tout membre du tenant, parents et élèves compris. Un élève peut consulter le dossier d'un camarade par son matricule. Deux RPC acceptent un tenant arbitraire. Ajouter des fonctionnalités par-dessus élargirait la surface exposée.
2. **Schéma de référence inconnu.** 11 tables et une dizaine de colonnes utilisées par le code n'existent dans aucune migration, la chaîne n'est pas rejouable, et aucun environnement de recette n'est disponible (R-006). Développer les lots 3 à 7 sans connaître le schéma réel ferait corriger ou créer des structures à l'aveugle.
3. **Bugs destructeurs actifs.** B3 (suspension en masse), suppression de paiement sans extourne, paie hors déclarations fiscales.

**Conditions de déblocage :**

- **Lot 0** : inventaire en lecture seule de la base de production.
- **Lot 1** : sécurité, après arbitrage des droits par rôle par l'utilisateur.
- **Lot 2** : bugs bloquants.

Ces trois lots peuvent démarrer dès validation. Une fois validés, le verdict pour les lots 3 à 11 pourra passer à **GO_WITH_MINOR_ISSUES**. L'architecture existante (pages, sections académiques, moteur comptable, module RH global, Sidebar par secteur) est suffisamment riche pour être **réutilisée sans refonte**. L'essentiel du travail consiste à relier, dédoublonner et sécuriser l'existant, pas à le remplacer.

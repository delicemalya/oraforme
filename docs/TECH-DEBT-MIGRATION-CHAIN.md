# TECH-DEBT-MIGRATION-CHAIN — Dette technique de la chaîne de migrations historique

Documentation uniquement. Aucune migration historique modifiée. Ces tickets
sont séparés du travail C6 (`docs/DB-LOCAL-C6-HARNESS.md`) — ils concernent
l'intégrité de la chaîne `supabase/migrations/` dans son ensemble, découverte
par exécution réelle lors de `DB-LOCAL-RECOVERY-02.md` et complétée par
introspection production lors de `DB-LOCAL-C6-HARNESS`.

---

## TD-MIG-031-032

- **Migration** : `031_financial_triggers.sql`, `032_automation_engine.sql`.
- **Défaut** : les deux créent un trigger `AFTER UPDATE ON fiches_paie`
  (`031` ligne 159-161 : `DROP TRIGGER IF EXISTS trg_paie_to_transaction ON
  fiches_paie` puis `CREATE TRIGGER ... AFTER UPDATE ON fiches_paie` ; `032`
  ligne 214-216 : `trg_paie_notify` même table). `fiches_paie` n'est créée
  par aucune migration.
- **Preuve** : (1) `grep -rn "CREATE TABLE.*fiches_paie"` sur tout le dossier
  `supabase/migrations/` → 0 résultat. (2) Exécution réelle contre un
  Postgres local neuf (`DB-LOCAL-RECOVERY-02.md` §5, essai 1) :
  `ERROR: relation "fiches_paie" does not exist (SQLSTATE 42P01)`. (3)
  Introspection production (OpenAPI PostgREST, lecture seule, aujourd'hui) :
  `fiches_paie` **ABSENTE** du schéma réel — confirmé, ce n'est pas un objet
  qui existe en production hors version control.
- **Impact** : sur un replay séquentiel depuis zéro, `031` est le premier
  point de rupture de toute la chaîne — avant même `068` (candidatures), qui
  était jusqu'ici considérée comme le premier point de rupture connu.
- **Pourquoi ne pas le shim comme objet production** : à la différence de
  `candidatures`/`fiscal_declarations` (TD-MIG-068/TD-MIG-164), l'introspection
  production confirme que `fiches_paie` n'existe nulle part — créer une table
  locale de ce nom ne reproduirait aucune réalité de production, seulement
  une illusion de replay réussi pour une table fictive. La table de paie
  réelle, créée dès `007_paie.sql` et utilisée partout ailleurs dans
  l'application (`app/api/rh/paie/*`, `lib/paie/calcul-paie.ts`, etc.), est
  `bulletins_paie` — même sens métier ("fiche de paie" / "bulletin de paie"),
  ce qui suggère fortement une incohérence de nommage jamais corrigée dans
  `031`/`032`, pas une dépendance externe légitime.
- **Correction future proposée** (non appliquée ici) : remplacer
  `fiches_paie` par `bulletins_paie` dans les deux `CREATE TRIGGER`/
  `DROP TRIGGER` de `031` et `032`, après confirmation qu'aucun comportement
  de production ne dépend d'une table `fiches_paie` distincte créée hors
  migration (l'introspection ci-dessus l'exclut déjà, mais une revue de code
  dédiée devrait confirmer qu'aucun trigger de ce nom n'existe réellement en
  production avant toute modification).
- **Statut** : `OPEN` — non corrigé, non shim-é, écarté du replay local
  (`C:\oraforme-local-db-test\supabase\skipped-local-only\`).

## TD-MIG-034

- **Migration** : `034_role_hardening.sql`.
- **Défaut** : la policy `"notes_etudiants: student read own"` compare
  `e.email = (SELECT au.email FROM auth.users au WHERE au.id = auth.uid())`
  — `e` est un alias sur `etudiants`.
- **Preuve** : exécution réelle (`DB-LOCAL-RECOVERY-02.md` §5, essai 2) :
  `ERROR: column e.email does not exist (SQLSTATE 42703)`. **Correction
  importante apportée pendant `DB-LOCAL-C6-HARNESS`** : l'introspection
  production (lecture seule, aujourd'hui) montre en réalité
  `etudiants.email` **PRÉSENTE** en production (`email` ET `email_parent`
  coexistent). La conclusion initiale ("probable bug de 034") était donc
  **incorrecte** — corrigée ici plutôt que maintenue par commodité : c'est
  la MÊME classe de divergence que `candidatures`/`fiscal_declarations`
  (TD-MIG-068/164) : une colonne qui existe en production mais qu'aucune
  migration tracée n'ajoute (recherche exhaustive : aucun
  `ALTER TABLE etudiants ADD COLUMN email` trouvé, contrairement à
  `email_parent`, présente dès `008_ecole.sql`).
- **Impact** : sur un replay LOCAL depuis zéro (sans cette colonne), `034`
  casse — mais ce n'est pas une preuve que `034` est fausse en production.
- **Pourquoi ne pas le shim comme objet production (nuance)** : ici, à la
  différence de `TD-MIG-031-032`, un shim serait justifié SI l'objectif était
  de rejouer la chaîne complète (ce que cette mission ne fait plus — décision
  explicite de `DB-LOCAL-C6-HARNESS`). Non fait ici car hors périmètre (la
  table `etudiants`/`notes_etudiants` n'intervient pas dans la dépendance de
  184/185/186).
- **Correction future proposée** : aucune correction de contenu nécessaire
  pour `034` elle-même (la policy est valide contre le schéma réel) — le
  vrai correctif est de TRACER la colonne `etudiants.email` dans une
  migration (`ALTER TABLE etudiants ADD COLUMN IF NOT EXISTS email TEXT`),
  pour que la chaîne redevienne rejouable à partir de zéro.
- **Statut** : `OPEN` — non tracée par une migration, non corrigée.

## TD-MIG-068

- **Migration** : `068_entretiens_ia.sql`, ligne 7 :
  `ALTER TABLE entretiens ADD COLUMN IF NOT EXISTS candidature_id UUID
  REFERENCES candidatures(id) ON DELETE SET NULL;`
- **Défaut** : `candidatures` n'est créée par aucune migration tracée.
- **Preuve** : `grep -rn "CREATE TABLE.*candidatures"` → 0 résultat.
  Introspection production (aujourd'hui) : `candidatures` **EXISTE** en
  production (colonnes : `ats_stage, candidat_id, created_at, est_doublon,
  id, offre_id, rapport_ia, score_ia, statut, tenant_id`).
- **Impact** : sur un replay séquentiel, ce point de rupture n'a en fait
  jamais été atteint lors de `DB-LOCAL-RECOVERY-02` (la chaîne casse avant,
  à `031`) — mais il reste confirmé réel : avec `031`/`032` contournées, `068`
  casserait à son tour sans un shim.
- **Pourquoi ne pas le shim comme objet production** — nuance : ici le shim
  EST légitime (c'est un vrai objet de production, contrairement à
  `fiches_paie`), mais un shim minimal (id, tenant_id) ne reproduirait QUE ce
  qui est strictement nécessaire à la contrainte FK de `068` — PAS le schéma
  complet réel (`ats_stage`, `candidat_id`, `offre_id`, etc.), pour respecter
  la consigne "ne pas reproduire arbitrairement toute la production".
- **Correction future proposée** : ajouter une migration `CREATE TABLE IF
  NOT EXISTS candidatures (...)` avec le schéma réel complet (confirmé ci-
  dessus par introspection), positionnée avant `068` dans l'historique si la
  chaîne doit un jour redevenir rejouable depuis zéro.
- **Statut** : `OPEN` — shim minimal préparé et prêt (`DB-LOCAL-RECOVERY-02`),
  jamais exécuté (la chaîne n'atteint pas ce point).

## TD-MIG-164

- **Migration** : `164_fix_fiscal_declarations_rls_bypass.sql` —
  `CREATE POLICY "fiscal_declarations_tenant_isolation" ON
  fiscal_declarations FOR ALL USING (tenant_id = get_my_tenant_id()) ...`
- **Défaut** : `fiscal_declarations` n'est créée par aucune migration
  tracée.
- **Preuve** : `grep -rn "CREATE TABLE.*fiscal_declarations"` → 0 résultat.
  Introspection production (aujourd'hui) : `fiscal_declarations` **EXISTE**
  (colonnes : `created_at, date_depot, date_echeance, date_paiement, id,
  montant_base, montant_du, montant_paye, notes, pays, penalites,
  periode_annee, periode_mois, reference_depot, statut, tenant_id, type,
  updated_at`).
- **Impact** : identique à `TD-MIG-068` — jamais atteint dans
  `DB-LOCAL-RECOVERY-02` (la chaîne casse bien avant, à `031`), mais confirmé
  réel. Note aggravante déjà documentée par `164` elle-même : c'est le fix
  d'une faille de sécurité critique (accès `anon` total, sans authentification,
  avant `164`) — la table est sensible (déclarations fiscales).
- **Pourquoi ne pas le shim comme objet production** : même raisonnement que
  `TD-MIG-068` — un shim complet n'est pas nécessaire, seul un minimal
  (id, tenant_id) suffirait à faire passer `164`, mais ne reproduirait pas le
  schéma réel riche confirmé ci-dessus.
- **Correction future proposée** : identique à `TD-MIG-068` — tracer
  `fiscal_declarations` dans une migration `CREATE TABLE IF NOT EXISTS`.
- **Statut** : `OPEN` — shim minimal préparé, jamais exécuté.

## TD-MIG-1425-NAMING

- **Migration** : `142.5_fix_fn_ae_execute_event_country.sql`.
- **Défaut** : le préfixe de nom de fichier `142.5` contient un point — le
  CLI Supabase exige un préfixe entièrement numérique avant le premier `_`
  (pattern `"<timestamp>_name.sql"`).
- **Preuve** : exécution réelle, deux fois (`DB-LOCAL-RECOVERY-02.md` §4, et
  à nouveau `DB-LOCAL-RECOVERY-01` une première fois) :
  `Skipping migration 142.5_fix_fn_ae_execute_event_country.sql... (file
  name must match pattern "<timestamp>_name.sql")`.
- **Impact** : **critique, indépendamment du reste de la chaîne.** Cette
  migration corrige un bug qui faisait échouer SILENCIEUSEMENT TOUT appel à
  `emit_accounting_event()` depuis le déploiement de la migration 138 (son
  propre en-tête : *"Tous les emit_accounting_event() échouaient
  silencieusement depuis mig.138. Aucun journal_entries n'a été créé depuis
  le déploiement du moteur."*). Si un `supabase db push`/`db reset` piloté
  par le CLI était un jour exécuté contre un environnement qui ne possède
  QUE les migrations numérotées standard (sans ce correctif appliqué
  séparément, à la main, comme son propre en-tête l'indique — "Quick Win,
  pas de nouvelle migration métier"), le moteur comptable entier
  redeviendrait cassé. `DB-LOCAL-C6-HARNESS` a dû intégrer son contenu
  manuellement dans le socle (voir §7 de ce rapport) précisément pour cette
  raison — pas pour contourner le CLI, mais parce que c'est une dépendance
  réelle et vérifiée de VTE-001/002.
- **Pourquoi ne pas le shim comme objet production** : sans objet. Ce n'est
  pas une dépendance manquante — c'est un fichier dont le CONTENU est
  correct mais dont le NOM empêche le CLI de l'appliquer. Le "correctif"
  n'est pas un shim, c'est un renommage.
- **Correction future proposée** : renommer le fichier avec un préfixe
  numérique valide qui préserve sa position chronologique réelle (entre 142
  et 143), par exemple `1425_fix_fn_ae_execute_event_country.sql` (vérifié
  empiriquement trier correctement entre `142_...` et `143_...`) — **non
  fait dans cette mission** (modification d'une migration historique
  explicitement interdite).
- **Statut** : `OPEN` — contenu intégré manuellement dans le harness C6
  (`001_c6_baseline.sql`), fichier officiel non renommé.

## TD-MIG-CATCHUP-NAMING

- **Migration** : `CATCHUP_008_to_025.sql`.
- **Défaut** : même cause que `TD-MIG-1425-NAMING` — préfixe non numérique
  (`CATCHUP_...`).
- **Preuve** : exécution réelle, deux fois :
  `Skipping migration CATCHUP_008_to_025.sql... (file name must match
  pattern "<timestamp>_name.sql")`.
- **Impact** : moindre pour C6 (son contenu, analysé en détail dans
  `DB-LOCAL-C6-HARNESS.md` §8, ne fait PAS partie de la dépendance réelle de
  184/185/186 — `CATCHUP_REQUIRED_FOR_C6 = NO`, voir ce rapport). Reste un
  risque pour l'intégrité de la chaîne complète : son nom suggère qu'elle
  devait combler des lacunes des migrations `008` à `025` (elle recrée
  plusieurs tables `IF NOT EXISTS` et ajoute des colonnes `IF NOT EXISTS` —
  foncièrement idempotente par construction, donc son exclusion silencieuse
  par le CLI est moins dangereuse que celle de `142.5`, mais tout aussi
  invisible sans audit).
- **Pourquoi ne pas le shim comme objet production** : sans objet, même
  raisonnement que `TD-MIG-1425-NAMING`.
- **Correction future proposée** : renommer avec un préfixe numérique
  correspondant à sa position voulue (ex. après `025`, avant `026`) —
  **non fait ici.**
- **Statut** : `OPEN` — non nécessaire pour C6 (confirmé), reste un risque
  pour la chaîne complète.

---

## Synthèse

| Ticket | Catégorie | Shim légitime ? | Nécessaire pour C6 ? | Statut |
|---|---|---|---|---|
| TD-MIG-031-032 | Bug de contenu (nom de table incohérent) | **Non** — confirmé absent en prod | Non | OPEN |
| TD-MIG-034 | Colonne réelle non tracée | Oui, si besoin futur | Non | OPEN |
| TD-MIG-068 | Table réelle non tracée | Oui (minimal) | Non | OPEN |
| TD-MIG-164 | Table réelle non tracée | Oui (minimal) | Non | OPEN |
| TD-MIG-1425-NAMING | Nommage non conforme CLI | Sans objet | **Oui, critique** (intégré au harness) | OPEN |
| TD-MIG-CATCHUP-NAMING | Nommage non conforme CLI | Sans objet | Non (confirmé) | OPEN |

Aucun de ces tickets n'a été corrigé dans les migrations historiques. Un
septième point, découvert et déjà traité comme faisant partie intégrante du
harness C6 plutôt que comme un ticket séparé, est documenté dans
`docs/DB-LOCAL-C6-HARNESS.md` §7 : `transactions.fiscal_year` (et plusieurs
colonnes voisines) existent en production sans migration traçable — même
catégorie que TD-MIG-068/164, mais touchant le moteur comptable partagé par
tous les modules, pas seulement C6.

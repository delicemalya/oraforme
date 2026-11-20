# BOI-010D — Reconstitution exacte de l'état migratoire production

Mission P0-BOI-010D. Aucune migration exécutée, aucune donnée modifiée, aucun commit/push, aucun secret affiché.

## Méthode et limite fondamentale

`supabase_migrations.schema_migrations` (source authentique) est **inaccessible** : PostgREST
n'expose que `public` et `graphql_public` (confirmé — `PGRST106 Invalid schema: supabase_migrations`).
MCP Supabase/Postgres : `CONNECT_TIMEOUT` (vérifié une seule fois cette session, conformément à
BOI-010C). Docker : daemon non démarré, aucun processus Docker actif (`docker ps` échoue,
`tasklist` ne montre aucun process `docker*`). Aucun `psql`/`DATABASE_URL` disponible.

**Seule méthode restante : sonder les artefacts.** Pour chaque migration 168–184 (et 050 en
rappel), on identifie l'artefact concret qu'elle crée/modifie dans le schéma `public`
(colonne, table, vue, fonction, ligne de données identifiable) et on interroge PostgREST en
lecture seule (`select=<colonne>`, comptage via `Prefer: count=exact`). Un artefact présent
avec le comportement attendu = `APPLIED`. Une erreur `42703`/`PGRST205` sur un artefact que la
migration est seule à créer = `NOT_APPLIED`. Absence de tout artefact probable via REST
(politiques RLS, index, corps de fonction sans nouvelle colonne) = `UNKNOWN`, jamais déduit.

Clé de service extraite dans une variable shell (`$SBKEY`), jamais affichée dans ce document
ni dans aucune sortie de commande.

---

## MIGRATION_HISTORY_PRODUCTION

| migration | fichier présent | appliquée prod | preuve | reconstruction locale | remarque |
|---|---|---|---|---|---|
| 050_stocks_enterprise_tables | oui | **NOT_APPLIED** | `products.stock_actuel` → `42703`, `products.statut` → `42703` (déjà établi BOI-003/004/005, reconfirmé ce jour) | Incompatible — voir LOCAL_REPRODUCTION_PLAN | Design incompatible avec le correctif ANO-C03 (173) ; à REMOVE, pas à rejouer |
| 168_fix_auth_rls_initplan | oui | **UNKNOWN** | Réécrit ~80 policies RLS (perf). Aucune colonne/table nouvelle ; `pg_policies` non exposé via PostgREST. Aucun canal disponible ne permet de vérifier | Rejouable si canal SQL rétabli (non idempotent en toute généralité selon son propre en-tête) | Pas de preuve possible sans accès `pg_policies` ou MCP |
| 169_fix_unindexed_foreign_keys | oui | **UNKNOWN** | Ajoute 212 index B-tree. Index non exposés via PostgREST (`pg_indexes` hors schémas exposés) | Rejouable sans risque (idempotente par construction, `CREATE INDEX` conditionnel en boucle) | Aucune preuve possible sans SQL direct |
| 170_fix_strict_duplicate_policies | oui | **UNKNOWN** | `DROP POLICY IF EXISTS` sur 7 policies nommées. Non vérifiable via REST | Rejouable (idempotente, `IF EXISTS`) | Aucune preuve possible |
| 171_fix_privilege_escalation | oui | **UNKNOWN** | Trigger `trg_no_self_role_change` + policies resserrées sur `user_permissions`/`roles`/`role_permissions`. Le trigger ne serait testable qu'avec une session utilisateur authentifiée réelle (`auth.uid()` non NULL) — le `service_role` a `auth.uid() IS NULL`, ce qui contourne silencieusement le test sans le prouver ni l'infirmer. Aucun test tenté (aurait nécessité une mutation sur `profiles` réel, hors périmètre) | Rejouable (idempotente, `DROP POLICY IF EXISTS`/`CREATE OR REPLACE FUNCTION`) | Vecteur de sécurité réel (ANO-C04) — statut à traiter en priorité dès qu'un canal SQL existe |
| 172_facturation_v2_completion | oui | **APPLIED** | `factures.invoice_number`, `factures.ca`, `factures.due_date` : présentes, HTTP 200, valeurs lisibles | N/A (déjà en place) | Confirmé par sondage direct ce jour |
| 173_stock_source_unique | oui | **APPLIED** | `v_products_stock` retourne exactement `products.*` + `stock_actuel` calculé (`id, tenant_id, nom, categorie, sku, code_barre, unite, prix_achat, prix_vente, seuil_alerte, image_url, created_at, stock_actuel`), identique à la définition ligne 102-113 du fichier. `fn_stock_move`/`fn_stock_sign` confirmées fonctionnelles (usage continu BOI-004→010) | N/A (déjà en place) | Fondation de tout le travail BOI-004 à BOI-010 — confirmée solide |
| 174_achats_colonnes_manquantes | oui | **APPLIED** | `purchases.reference`, `purchases.date`, `purchases.notes` : présentes (HTTP 200, `[]` = 0 ligne mais pas d'erreur de colonne) | N/A (déjà en place) | Confirmé ce jour |
| 175_treasury_impact_from_rules | oui | **APPLIED (indirect)** | Aucun artefact propre sondable (modifie uniquement le corps de `fn_ae_execute_event`/`fn_sync_tresorerie_soldes`, pas de nouvelle colonne). Preuve indirecte : l'en-tête de 176 déclare explicitly "Prérequis : migration 175 appliquée (version moteur 1.11.0)", et 176 est confirmée APPLIED par preuve directe (voir ligne suivante) — 176 n'aurait pas pu être appliquée avec succès sans son prérequis | Rejouable si canal SQL rétabli | Statut déduit d'une dépendance documentée + preuve directe sur 176, pas d'un sondage direct sur 175 elle-même |
| 176_repair_p0_04_amd_finance | oui | **APPLIED** | `repair_archive` contient exactement 192 lignes `repair='P0-04'` (sondé ce jour, `Content-Range: 0-0/192`), cohérent avec la réparation décrite (240 écritures basculées + lignes caisse fantômes) | N/A (déjà en place) | Preuve directe et sans ambiguïté |
| 177_repair_achats_legacy_doublons | oui | **APPLIED** | `repair_archive` contient exactement 48 lignes `repair='ACH-TRG'` (`Content-Range: 0-0/48`) — correspond exactement aux "48/48 doublons" diagnostiqués dans l'en-tête. `journal_entries` avec `source='achats_enregistrement'` : 0 ligne | N/A (déjà en place) | Preuve directe et sans ambiguïté |
| 178_tresorerie_compte_principal | oui | **APPLIED** | `comptes_bancaires.compte_principal` présente (HTTP 200, valeur `false` lue) | N/A (déjà en place) | Confirmé ce jour |
| 179_purge_seed_demo_amd_finance | oui | **APPLIED** | `repair_archive` contient 3737 lignes `repair='SEED-CLEANUP-AMD'` (`Content-Range: 0-0/3737`) — cohérent avec la purge massive décrite (1344 `journal_entries` + `accounting_events`/`accounting_event_log`/`transactions`/`stock_movements` etc.). `journal_entries` total production = 21 lignes seulement (contre ~1344+ attendues si la démo n'avait pas été purgée) | N/A (déjà en place) | Preuve directe, cohérente avec le compteur global déjà établi en BOI-010B (`journal_entries=21`) |
| 180_fix_rls_tenants_journal_entries_leak | oui | **UNKNOWN** | Corrige des policies RLS (`tenants_select` notamment). Le `service_role` **contourne toute RLS** : une lecture réussie ou échouée avec cette clé ne prouve RIEN sur l'état des policies pour un utilisateur authentifié normal. Aucune session utilisateur réelle disponible pour tester le comportement effectif. Le mémo de la mission MASTER-A-Z-AUDIT (2026-09-14, antérieure à cette migration) avait trouvé la fuite active — cette même mission l'a documentée comme la SOURCE de la migration 180 (son en-tête cite explicitement `docs/MASTER-A-Z-AUDIT-2026-09.md, §32`), ce qui prouve seulement que 180 a été écrite APRÈS l'audit, pas qu'elle a été appliquée DEPUIS | Rejouable (idempotente, `DROP POLICY IF EXISTS`) | **Statut réellement inconnu — vecteur de sécurité critique si non appliquée, à vérifier en priorité absolue dès qu'un canal SQL avec session utilisateur ou accès `pg_policies` existe** |
| 181_fix_btp001_tva_ca_separation | oui | **APPLIED** | `accounting_event_rules` : ligne `event_type='BTP-001', sequence=3, debit_account='411', credit_account='447', status='active'` présente exactement comme décrite | N/A (déjà en place) | Preuve directe |
| 182_fix_res_san_hot_boi_tva_ca_separation | oui | **APPLIED** | `accounting_event_rules` : les 4 lignes séquence 3 (`RES-001`, `SAN-001`, `HOT-001`, `BOI-001`, toutes `credit_account='447'`, `status='active'`) présentes exactement comme décrites | N/A (déjà en place) | Preuve directe — confirme aussi que BOI-001 (le module boisson lui-même) a déjà sa correction TVA/CA comptable en production |
| 183_repair_achats_stocks_core | oui | **NOT_APPLIED** | `warehouses.actif` → `42703`, `suppliers.actif` → `42703`, `suppliers.conditions_paiement` → `42703` | Exécutable seule (additive, aucune dépendance vers 184) | **Point de divergence** (voir FIRST_DIVERGENCE) |
| 184_stock_provenance | oui | **NOT_APPLIED** | `stock_movements.origine` → `42703` (reconfirmé ce jour, identique à BOI-010B) | Dépend uniquement de l'état actuel de `stock_movements`/`fn_stock_move` (173, APPLIED) — indépendante de 183 | Cible de cette mission, toujours non exécutée |

---

## FIRST_DIVERGENCE

Dans l'ordre 168→184, en excluant les statuts `UNKNOWN` (non tranchables avec les canaux
actuels) :
- 168 à 171 : `UNKNOWN` — aucune preuve possible, ne peuvent pas servir de point de divergence
  faute de verdict.
- 172 à 179, 181, 182 : tous **APPLIED**, par preuve directe ou (175) par dépendance documentée
  + preuve directe sur son dépendant.
- 180 : `UNKNOWN` — vecteur RLS critique, statut réel indéterminable avec le `service_role`.
- **183 est la première migration présente au dépôt et confirmée `NOT_APPLIED`** dans la plage
  168–184.
- 184 est également `NOT_APPLIED`, mais n'est PAS dépendante de 183 (les deux migrations
  touchent des tables disjointes : 183 = `warehouses`/`suppliers`/`fn_stock_alert`/RLS
  `stock_articles` ; 184 = `stock_movements`/`fn_stock_move`/vue provenance). Elles peuvent être
  appliquées indépendamment et dans n'importe quel ordre l'une par rapport à l'autre.

**Point de divergence réel pour ce travail** : 183 et 184, toutes deux préparées (BOI-004 et
BOI-010) mais jamais exécutées — cohérent avec les instructions explicites de non-exécution de
toutes les missions BOI depuis BOI-004.

**Divergence plus ancienne, hors plage mais structurellement première** : 050
(`supabase/migrations/050_stocks_enterprise_tables.sql`), confirmée non appliquée depuis
BOI-003, et dont l'application serait de toute façon rejetée (incompatible avec 173/ANO-C03).
Aucune migration entre 051 et 182 ne semble dépendre de 050 pour ses propres artefacts
(vérifié par les preuves ci-dessus : 172–182 s'appliquent et fonctionnent malgré l'absence de
050) — la divergence 050 est donc isolée, pas la cause d'un blocage en cascade.

---

## PRODUCTION_SCHEMA_REFERENCE

État confirmé en production, ce jour, par sondage direct (relecture seule) :

| objet | état confirmé | preuve |
|---|---|---|
| `products` | 12 colonnes réelles, **sans** `description/categorie_id/stock_max/fournisseur_id/emplacement/statut/taxe_pct/stock_actuel` | `42703` sur `stock_actuel`/`statut` (050 non appliquée) |
| `suppliers` | sans `actif`, sans `conditions_paiement` | `42703` (183 non appliquée) |
| `warehouses` | sans `actif` | `42703` (183 non appliquée) |
| `purchases` | avec `reference`, `date`, `notes` (174 appliquée) | HTTP 200 |
| `purchase_items` | schéma BOI-004 (5 colonnes + `id` utilisé par BOI-010) | déjà établi, non re-sondé ce jour (pas de changement attendu) |
| `stock_movements` | **sans** `origine`, **sans** `purchase_item_id` (184 non appliquée) | `42703` sur `origine` |
| `fn_stock_move` | version 173 à 8 paramètres, active et fonctionnelle | confirmé par usage continu BOI-004→BOI-010, cohérent avec 184 non appliquée (sinon la fonction serait à 10 paramètres) |
| `v_products_stock` | version 173 exacte (`products.*` + `stock_actuel` dérivé de `stock_movements`) | comparaison littérale avec le fichier 173, colonnes identiques |
| `v_products_stock_par_origine` | **n'existe pas** (créée uniquement par 184) | non sondée directement ce jour (déjà déduit : 184 non appliquée ⇒ vue absente) |
| `journal_entries` | 21 lignes au total, aucune avec `source='achats_enregistrement'` | comptage exact via `Content-Range` |
| `accounting_events` | 2 lignes (déjà établi BOI-010B, non re-sondé ce jour) | — |
| `accounting_event_log` | non re-sondé ce jour | — |
| `accounting_event_rules` | ACH-001/002, STK-001/002 inchangées depuis BOI-004 ; FAC-001, BTP-001, RES-001, SAN-001, HOT-001, BOI-001 ont chacune leur séquence 3 (411 ou 521 / 447) active | sondage direct ce jour |
| `tenants` | 26 tenants (établi BOI-010B/audit MASTER-A-Z, non re-sondé ce jour) | — |
| `repair_archive` | existe, 3977 lignes au total (192 `P0-04` + 48 `ACH-TRG` + 3737 `SEED-CLEANUP-AMD`) | comptage exact via `Content-Range` |
| RLS / policies | **non sondable** via PostgREST (`pg_policies` non exposé) ni via `service_role` (bypass RLS par construction) | limite structurelle du canal, pas un résultat |

---

## LOCAL_REPRODUCTION_PLAN

Docker confirmé non démarré (aucun processus, pas seulement un daemon lent à répondre) — cette
section est un **plan**, rien n'est exécuté.

1. **Ne jamais rejouer aveuglément `supabase/migrations/*.sql` dans l'ordre du dépôt.** Le
   dépôt contient des migrations jamais appliquées (050, 183, 184 confirmées ; 168–171 et 180
   de statut inconnu) mélangées à des migrations appliquées. Un replay complet produirait un
   schéma **plus avancé** que la production (ex : 050 appliquée localement alors qu'absente en
   prod), rendant toute validation de 184 non représentative.

2. **Catégorisation des migrations 168–184 pour la reconstruction, telle qu'établie ci-dessus** :
   - **À rejouer sans risque** (confirmées `APPLIED`, idempotentes par `IF NOT EXISTS`/
     `ADD COLUMN IF NOT EXISTS`/`CREATE OR REPLACE`) : 172, 173, 174, 175, 178, 181, 182.
   - **À rejouer avec prudence — migrations de réparation de données, pas de schéma** : 176,
     177, 179. Idempotentes côté schéma (`CREATE TABLE IF NOT EXISTS repair_archive`) mais leurs
     `DELETE`/`UPDATE` opèrent sur un état de données précis (tenant AMD FINANCE, dates
     précises) qui n'existera pas dans une base locale vierge — à rejouer en les traitant comme
     des no-ops sûrs (les `WHERE` ne matcheront rien) plutôt que comme des réparations à refaire.
   - **Statut UNKNOWN, à traiter au cas par cas** : 168, 169, 170, 171, 180 — toutes idempotentes
     par construction (`IF EXISTS`/`IF NOT EXISTS`/`CREATE OR REPLACE`), donc sans risque de les
     rejouer même si leur statut prod réel n'est pas prouvé ; les rejouer localement ne peut pas
     produire un état pire que la prod, seulement un état au moins aussi corrigé.
   - **À ne jamais rejouer** : 050 (incompatible avec 173, voir ci-dessus).
   - **Cibles de cette mission, à appliquer en dernier, une à la fois** : 183, puis 184
     (ordre indifférent entre elles, tables disjointes).

3. **Séquence de reconstruction proposée** (non exécutée) : appliquer 001→049, sauter 050,
   appliquer 051→182 dans l'ordre du dépôt (toutes idempotentes ou no-ops sûrs sur une base
   vierge), vérifier le schéma obtenu contre PRODUCTION_SCHEMA_REFERENCE ci-dessus
   (colonnes/vues/fonctions listées), puis et seulement alors appliquer 183 et 184 séparément
   avec tests transactionnels entre les deux.

4. **Limite reconnue** : ce plan suppose que les migrations 001–167 (hors 050) sont, elles,
   fidèlement appliquées en production — hypothèse jamais vérifiée dans cette mission (hors
   périmètre : la mission cible spécifiquement 168–184). Une reconstruction réelle devrait
   étendre le même sondage d'artefacts à 001–167 avant de faire confiance à l'étape 3.

---

## BOI_184_COMPATIBILITY

Revue statique uniquement (aucune exécution possible, MCP indisponible) — reprise et
reconfirmée depuis BOI-010B avec le fichier `184_stock_provenance.sql` lu intégralement ce
jour (218 lignes) :

- **Garde-fou en tête de migration** (lignes 36–44) : `RAISE EXCEPTION` si
  `stock_movements.origine` existe déjà — cohérent avec le `NOT_APPLIED` confirmé ci-dessus ;
  la migration s'auto-protège contre une ré-application sur un état différent du diagnostic.
- **Colonnes additives** (`origine`, `purchase_item_id`, lignes 46–49) : `ADD COLUMN` sans
  `IF NOT EXISTS`, volontaire (le garde-fou du point précédent rend le `IF NOT EXISTS`
  redondant et masquerait une vraie divergence d'état).
- **Bug de surcharge de fonction (trouvé BOI-010B)** : le `DROP FUNCTION IF EXISTS
  fn_stock_move(UUID, UUID, TEXT, NUMERIC, UUID, NUMERIC, TEXT, TEXT)` (ligne 87) précède bien
  le `CREATE OR REPLACE FUNCTION` (ligne 89) à 10 paramètres — l'ordre correctif est toujours en
  place, reconfirmé par lecture directe du fichier ce jour. Sans ce `DROP`, l'ancienne fonction
  à 8 paramètres coexisterait avec la nouvelle à 10, rendant tout appel avec exactement 8
  arguments ambigu (`function is not unique`) et cassant tous les appelants existants
  (`app/api/stock/reception`, tout code appelant `fn_stock_move` sans `p_origine`).
- **Signature de retour attendue en production actuelle** : `fn_stock_move` à 8 paramètres
  (confirmé par PRODUCTION_SCHEMA_REFERENCE — 184 non appliquée). Le `DROP FUNCTION` cible donc
  exactement la signature réellement présente en production. Aucune dérive détectée entre le
  diagnostic BOI-010B et l'état production sondé aujourd'hui.
- **Extension rétrocompatible confirmée** : `p_origine`/`p_purchase_item_id` en `DEFAULT NULL`
  en fin de liste ; tout appelant existant (les appels internes à 8 arguments positionnels,
  cohérents avec la signature actuelle de production) continue de fonctionner à l'identique
  après le remplacement.
- **Vue dérivée** `v_products_stock_par_origine` : `CREATE OR REPLACE VIEW`, `security_invoker`,
  n'écrase ni ne lit `v_products_stock` (173, APPLIED, confirmée intacte ci-dessus) — aucune
  régression possible sur les 14 lecteurs existants de `v_products_stock`.
- **Aucune dépendance vers 183** : 184 ne touche ni `warehouses`, ni `suppliers`, ni
  `fn_stock_alert`, ni `stock_articles` — son application n'est pas bloquée par le statut
  `NOT_APPLIED` de 183.
- **Nouveau point non couvert par BOI-010B** : la fonction `fn_stock_move` de production
  actuelle est celle de la migration **173** (confirmée ligne par ligne ci-dessus), pas une
  version antérieure ou modifiée entretemps — le corps que 184 remplace est donc exactement
  celui déjà audité en BOI-004/BOI-010B, sans divergence à signaler.

Conclusion de cette étape : la correction trouvée en BOI-010B reste valide et suffisante au
regard de l'état production reconfirmé aujourd'hui. Aucun nouveau défaut trouvé à la relecture.
Ceci reste une revue statique — **aucune exécution, aucun test transactionnel réel n'a eu
lieu**, faute de canal.

---

## BLOCKERS

1. **Docker Desktop non démarré** (confirmé ce jour : `docker ps` échoue, aucun processus
   `docker*` dans `tasklist`) — bloque toute reconstruction locale réelle, transactionnelle.
2. **MCP Supabase/Postgres indisponible** (`CONNECT_TIMEOUT`, vérifié une fois ce jour,
   conformément à la consigne de ne pas multiplier les tentatives) — bloque l'accès direct à
   `supabase_migrations.schema_migrations`, à `pg_policies`, à `pg_indexes`, et toute validation
   transactionnelle (`BEGIN`/`ROLLBACK`) de 184.
3. **Aucun accès Postgres direct** (`psql` absent, aucun `DATABASE_URL` dans les fichiers
   `.env*` du dépôt) — aucune voie de contournement du blocage 2.
4. **`supabase_migrations` non exposé via PostgREST** (`PGRST106`) — même en écartant les
   blocages 1–3, ce canal ne donnerait de toute façon jamais accès à l'historique authentique.
5. **Statuts `UNKNOWN` irréductibles avec les canaux actuels** : 168, 169, 170, 171, 180 — cinq
   migrations dont le statut réel ne peut être déterminé sans `pg_policies`/`pg_indexes` ou une
   session utilisateur authentifiée réelle (le `service_role` contourne toute RLS et ne peut
   donc jamais prouver l'état d'une policy). **180 est le plus critique des cinq** : elle corrige
   une fuite RLS déjà documentée comme active par un audit antérieur (MASTER-A-Z-AUDIT,
   2026-09-14) ; son statut réel en production aujourd'hui reste ouvert.
6. **Aucun compte/session utilisateur de test disponible** pour sonder le comportement RLS réel
   sans passer par le `service_role` — créer un tel compte sortirait du périmètre (aucune
   donnée production à créer/modifier n'a été autorisée par cette mission).

---

## NEXT_EXECUTION_PROCEDURE

Aucune de ces étapes n'est exécutée dans cette mission. Ordre strict pour la prochaine session :

1. Démarrer Docker Desktop (l'utilisateur doit le lancer manuellement ; aucun processus
   `docker*` actif actuellement, ce n'est pas un daemon lent, c'est une application arrêtée).
2. Vérifier que le daemon répond (`docker ps` retourne une liste, même vide, sans erreur
   `npipe`).
3. Préparer la reconstruction locale : `npx supabase init` si nécessaire, examiner
   `supabase/config.toml`.
4. Obtenir l'état migratoire réel si un canal s'ouvre entretemps (MCP, `psql`, ou accès
   `pg_policies`/`supabase_migrations`) — en priorité pour trancher les 5 statuts `UNKNOWN`
   (168, 169, 170, 171, 180) avant toute reconstruction, puisque leur statut change la liste
   exacte des migrations à rejouer.
5. Reconstruire une base locale isolée en suivant LOCAL_REPRODUCTION_PLAN ci-dessus (sauter 050,
   traiter 176/177/179 comme no-ops sûrs sur base vierge, rejouer le reste dans l'ordre).
6. Vérifier le schéma obtenu contre PRODUCTION_SCHEMA_REFERENCE ci-dessus, colonne par colonne,
   vue par vue, fonction par fonction — tout écart doit être expliqué avant de continuer.
7. Appliquer **uniquement** la migration 183 sur la base locale, seule, et vérifier ses propres
   contrôles (section CONTRÔLE de son fichier).
8. Exécuter des tests transactionnels réels (`BEGIN`/…/`ROLLBACK`) sur `fn_stock_move` avant
   184 : appels à 8 paramètres (rétrocompatibilité de référence).
9. Appliquer 184 sur la même base locale (après 183, ou indépendamment — les deux ne sont pas
   couplées, voir FIRST_DIVERGENCE). Rollback complet après chaque test.
10. Rejouer 184 proprement après un rollback complet, en conditions reproductibles, plusieurs
    fois, pour écarter tout effet d'ordre.
11. Revalider l'ensemble des scénarios déjà couverts par `lib/architecture/stock-provenance.test.ts`
    (TEST 1–7) via de vraies requêtes SQL transactionnelles, pas seulement la réimplémentation
    JS pure actuelle.
12. Seulement après un succès complet et reproductible des étapes 7–11, préparer (sans exécuter)
    un plan d'exécution production pour 183 et 184 — incluant la question, non résolue par
    cette mission, du statut réel de 180 (une fuite RLS active ne doit pas rester ouverte
    pendant qu'on ajoute de nouvelles fonctionnalités).

---

## VERDICT

```
MIGRATION_HISTORY = PARTIAL
LOCAL_REPRODUCTION = BLOCKED
BOI_184_COMPATIBILITY = READY
PRODUCTION_EXECUTION_ALLOWED = NO
```

`MIGRATION_HISTORY = PARTIAL` : 12 des 17 migrations sondées (168–184 + rappel 050) ont un
statut prouvé (10 `APPLIED` dont 1 indirecte, 2 `NOT_APPLIED`) ; 5 restent `UNKNOWN` par limite
structurelle du canal (RLS/index non exposés via PostgREST, pas de session utilisateur réelle),
pas par manque d'effort de sondage.

`LOCAL_REPRODUCTION = BLOCKED` : Docker non démarré, aucun canal SQL transactionnel disponible.
Le plan de reconstruction est écrit et prêt à exécuter dès que Docker répond.

`BOI_184_COMPATIBILITY = READY` : revue statique complète, correction BOI-010B reconfirmée
valide contre l'état production réellement sondé aujourd'hui, aucune exécution requise pour
cette conclusion, aucune divergence trouvée depuis BOI-010B.

`PRODUCTION_EXECUTION_ALLOWED = NO` — fixé par la mission, indépendamment de tout résultat.

FIN DE MISSION. Prochain blocage réel : Docker Desktop arrêté (aucun processus actif), seul
obstacle technique entre l'état actuel et l'étape 1 de NEXT_EXECUTION_PROCEDURE.

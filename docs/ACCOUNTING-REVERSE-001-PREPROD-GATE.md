# ACCOUNTING-REVERSE-001 PREPROD GATE

Gate de pré-production, lecture seule. Migration 187 **non appliquée**,
aucune donnée production lue au-delà de comptages/schéma en lecture seule,
aucune écriture, aucun commit/push.

## 1. Migration 187

Relecture intégrale de `supabase/migrations/187_fix_accounting_reverse_event_type.sql` :

- **Syntaxe** : valide — `BEGIN;` / `CREATE OR REPLACE FUNCTION` /
  `COMMENT ON FUNCTION` / `DO $$ RAISE NOTICE $$` / `COMMIT;`. Aucune
  anomalie de ponctuation SQL.
- **`CREATE OR REPLACE FUNCTION`** : confirmé, une seule fonction
  remplacée.
- **Signature exacte** : `fn_reverse_accounting_event(p_event_id UUID,
  p_reason TEXT, p_created_by UUID DEFAULT NULL) RETURNS UUID` —
  **identique**, nom + types + ordre + défaut, à la signature de la
  migration 138 d'origine. Confirmé déterminant : Postgres identifie une
  fonction par (nom, types de paramètres) — une signature identique
  garantit un remplacement en place, **aucun risque de surcharge
  ambiguë** (contrairement au cas `fn_stock_move` de la migration 184, qui
  changeait le NOMBRE de paramètres et nécessitait un `DROP FUNCTION`
  explicite au préalable — non nécessaire ici).
- **Dépendances** : `accounting_events`, `accounting_event_log`,
  `journal_entries`, `accounting_event_extournes` — toutes déjà
  existantes (migration 138), aucune nouvelle dépendance introduite.
- **Compatibilité avec la fonction existante** : le corps est identique à
  celui de la migration 138, à l'exception d'une seule expression
  (`v_event.event_type || '-EXT'` au lieu de `'EXT-' || v_event.
  event_module || '-' || split_part(v_event.event_type, '-', 2)`) dans le
  `SELECT` qui alimente l'`INSERT INTO accounting_events` de l'extourne —
  vérifié ligne par ligne, aucune autre différence.
- **Absence de DROP destructif** : confirmé — aucun `DROP TABLE`, `DROP
  FUNCTION`, `DROP COLUMN` dans le bloc exécutable (le seul `DROP`
  apparaissant dans le fichier est à l'intérieur du bloc **commenté** de
  retour arrière, jamais exécuté).
- **Absence de changement de données** : confirmé — le bloc exécutable ne
  contient aucun `INSERT`/`UPDATE`/`DELETE` sur une table de données ;
  seuls `CREATE OR REPLACE FUNCTION` et `COMMENT ON FUNCTION` (métadonnées
  de schéma) et un `RAISE NOTICE` (sans effet persistant) s'exécutent.
- **Absence de changement de contraintes** : confirmé — aucun `ALTER
  TABLE`, aucune mention de `chk_ae_event_type` dans le code exécuté
  (seulement dans les commentaires explicatifs de l'en-tête/rollback,
  vérifié par le test statique dédié qui exclut les lignes `--`).
- **Absence de modification de 184/185/186** : confirmé — fichier
  indépendant, ne référence ni ne redéfinit aucun objet propre à ces trois
  migrations (`stock_movements.origine/purchase_item_id/
  reversed_movement_id`, `ventes.*`, `fn_create_vente_atomique`,
  `fn_stock_move`, les règles `VTE-001`/`VTE-002` : aucun n'apparaît dans
  le code exécuté de 187).
- **Idempotence de l'application** : confirmée — `CREATE OR REPLACE
  FUNCTION` et `COMMENT ON FUNCTION` sont par nature idempotents (ré-
  exécuter la migration produit exactement le même état final, sans
  erreur, sans doublon). Aucun garde-fou supplémentaire n'est nécessaire
  (contrairement à 184/185/186, qui modifient des données/schémas non
  intrinsèquement idempotents et ont donc besoin de leurs propres
  garde-fous `DO $$ ... RAISE EXCEPTION`).

## 2. Production schema compatibility

Introspection PostgREST en lecture seule (OpenAPI), comparée objet par
objet à ce que 187 lit/écrit :

| Objet | Colonnes utilisées par 187 | Présentes en production aujourd'hui |
|---|---|---|
| `accounting_events` | `tenant_id, event_type, event_module, source_module, source_table, source_id, montant_ht, montant_tva, montant_ttc, montant_net, libelle, date_event, fiscal_year, metadata, status, correction_of, created_by, reversed_by` | **Toutes présentes**, confirmé par la liste complète des colonnes réelles |
| `accounting_event_extournes` | `original_event_id, extourne_event_id, reason, created_by` | **Toutes présentes** |
| `accounting_event_log` | `event_id, journal_entry_ids, processed_at` (lecture seule, `SELECT *`) | **Toutes présentes** |
| `journal_entries` | `tenant_id, date_operation, libelle, debit_account, credit_account, montant, source, source_id, fiscal_year, piece_number` | **Toutes présentes** |
| `accounting_event_rules` | Non référencée par cette fonction (vérifié : aucune lecture/écriture) | Sans objet |

**RPC `fn_reverse_accounting_event` déjà exposée en production** avec la
signature : `p_event_id` (uuid, requis), `p_reason` (text, requis),
`p_created_by` (uuid, optionnel) — **identique** à la signature de 187.
Aucune divergence trouvée entre le harness et la production sur les
objets que ce correctif touche.

## 3. Production data state

Comptages réels, lecture seule, aujourd'hui :

| Mesure | Valeur réelle |
|---|---|
| `accounting_events` (total) | **2** |
| `status='processed'` | **2** |
| `status='reversed'` | **0** |
| `event_type LIKE 'EXT-%'` (ancien format, jamais réussi) | **0** |
| `event_type LIKE '%-EXT'` (nouveau format de 187) | **0** |
| `VTE-001` | **0** |
| `VTE-002` | **0** |
| `FAC-001` | **0** |
| `FAC-002` | **0** |
| `accounting_event_extournes` (total) | **0** |

Les 2 événements existants sont tous deux `ONG-001` (`source_table=
'ong_dons'`, créés le 2026-06-26) — aucun rapport avec FAC/VTE. Aucune
donnée n'a été modifiée pour obtenir ces comptages.

## 4. Existing reverse history

**Aucun historique de reverse à transformer.** `accounting_event_
extournes` est vide (0 ligne), `status='reversed'` n'existe sur aucun
événement, `event_type LIKE 'EXT-%'` ne matche rien — confirmé, par
construction (le défaut corrigé empêchait toute réussite depuis la
création de la fonction), qu'**aucune extourne n'a jamais existé en
production**, qu'elle soit au format correct ou incorrect. 187 n'a donc
aucun historique à migrer, convertir ou réconcilier — elle s'applique sur
un état "vierge" de ce point de vue précis.

Les 2 événements `ONG-001` `processed` deviennent, après application de
187, des candidats éligibles à une extourne **réellement fonctionnelle**
pour la première fois — ils ne l'étaient déjà en PRINCIPE avant (le statut
`processed` suffit à satisfier `fn_reverse_accounting_event`), mais toute
tentative échouait avant même d'écrire la moindre ligne. Ce n'est pas un
changement de données, mais un changement de CAPACITÉ sur des données déjà
existantes — noté explicitement en risque §6 (MEDIUM), pas ignoré.

## 5. Dependencies

Aucune dépendance manquante. Toutes les tables/colonnes lues ou écrites
par 187 existent déjà en production avec le schéma attendu (§2). La RPC
`fn_reverse_accounting_event` est déjà exposée avec la signature
compatible — aucun changement côté PostgREST/API n'est requis pour que 187
devienne effective dès son application (le remplacement de fonction est
transparent pour tout appelant existant).

## 6. Rollback

Documenté dans le fichier de migration lui-même (section `⛔ RETOUR
ARRIÈRE`, commentée, jamais exécutée) : réappliquer un `CREATE OR REPLACE
FUNCTION fn_reverse_accounting_event` avec le corps exact de la migration
138 (construction `'EXT-' || event_module || '-' || split_part(...)`).
**Non exécuté dans cette mission.**

Propriétés du rollback, vérifiées par lecture (pas supposées) :
- **Sûr sur les données** : comme 187 elle-même, un rollback par `CREATE
  OR REPLACE` ne touche aucune ligne existante — seules les écritures
  FUTURES seraient affectées (un reverse appelé après rollback
  recommencerait à échouer, comme avant 187).
- **Aucune donnée à "dé-transformer"** : confirmé par §4 — puisque 187
  n'a aucun historique à gérer, un rollback n'en aurait pas non plus.
- **Risque du rollback lui-même** : s'il est exécuté APRÈS que 187 ait
  permis de réelles extournes (lignes `accounting_event_extournes`,
  `status='reversed'`, événements `*-EXT`), le rollback ne les annule pas
  — ces lignes resteraient valides et cohérentes, mais tout NOUVEAU
  reverse échouerait de nouveau. Le rollback n'est donc jamais destructeur
  rétroactivement, seulement un retour à l'incapacité fonctionnelle
  antérieure.

## 7. Risks

| Risque | Classe | Justification |
|---|---|---|
| Signature incompatible / surcharge ambiguë | **NONE** | Signature strictement identique à l'originale, vérifié caractère par caractère ; confirmé compatible avec la RPC déjà exposée en production |
| Perte ou corruption de données existantes | **NONE** | Aucun DML dans le bloc exécutable ; aucune ligne `accounting_events`/`journal_entries` déjà existante n'est lue en écriture |
| Dépendance manquante en production | **NONE** | Toutes les colonnes/tables utilisées confirmées présentes par introspection réelle |
| Historique de reverse nécessitant une transformation | **NONE** | Confirmé vide (§3/§4) |
| Changement de contrainte (`chk_ae_event_type`) | **NONE** | Non modifiée, vérifié par relecture du code exécuté uniquement |
| Non-idempotence de l'application | **NONE** | `CREATE OR REPLACE`/`COMMENT ON` sont idempotents par nature |
| **Capacité nouvellement activée sur des événements déjà `processed` (2 × `ONG-001`)** | **MEDIUM** | Ces événements deviennent réellement reversibles pour la première fois après 187 — pas un défaut de la migration, mais un changement de comportement réel sur des données déjà en place, à anticiper (si une UI d'annulation existe pour ONG, son premier appel réussi aurait lieu après cette migration, pas avant) |
| Changement de comportement du caller `facturation/page.tsx` (bloque la suppression si le reverse échoue) | **LOW** | Comportement intentionnel du correctif déjà validé (`ACCOUNTING-REVERSE-001-FIX-VALIDATION.md`) ; impact réel nul aujourd'hui car 0 événement `FAC-001`/`FAC-002` `processed` n'existe |
| Appelants non testés pour les 50 autres `event_type` sans appelant réel connu | **LOW** | Démonstration structurelle (indépendante du nom du module) déjà établie, aucun appelant réel connu à ce jour pour ces modules |

Aucun risque `BLOCKER` ni `HIGH` identifié. Aucun risque inventé au-delà
de ce que les preuves ci-dessus soutiennent.

## 8. Final verdict

Tous les critères de `READY` sont satisfaits : migration cohérente,
compatible avec la production actuelle (schéma ET signature RPC),
aucune dépendance manquante, aucun historique nécessitant une
transformation, rollback compris et documenté, aucune écriture production
effectuée par cette gate elle-même.

---

```
ACCOUNTING_REVERSE_PREPROD=READY
PRODUCTION_DATA_MODIFIED=NO
MIGRATION_187_APPLIED=NO
ROLLBACK_READY=YES
NEXT_RECOMMENDED_MISSION=Exécution contrôlée de la migration 187 contre la production, avec autorisation explicite dédiée, suivie immédiatement des requêtes CONTRÔLE déjà écrites dans le fichier de migration (SELECT prosrc FROM pg_proc WHERE proname='fn_reverse_accounting_event' — attendu : contient "|| '-EXT'") et, si une donnée réelle processed existe à ce moment (ex. un des 2 événements ONG-001, ou un FAC/VTE futur), un test d'extourne réel non destructif sur une copie/transaction contrôlée avant tout usage en conditions réelles par un utilisateur final.
```

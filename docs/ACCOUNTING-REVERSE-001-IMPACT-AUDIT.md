# ACCOUNTING-REVERSE-001 — IMPACT AUDIT

Mission d'audit uniquement. Aucun code modifié, aucune migration créée,
aucune donnée modifiée, aucun commit/push. Les seules actions effectuées
sont des lectures (code, migrations) et des requêtes PostgREST en LECTURE
SEULE contre la production (comptages, zéro ligne modifiée).

## 1. Root cause

**Démontré par lecture directe du code réel, pas supposé.**

`supabase/migrations/138_accounting_engine_infrastructure.sql`, ligne 185 :
```sql
CONSTRAINT chk_ae_event_type CHECK (event_type ~ '^[A-Z]{2,10}-[0-9]{3}(-[A-Z0-9]+)?$')
```
Exige : un groupe de 2 à 10 lettres majuscules, un tiret, puis **exactement
3 chiffres** immédiatement après ce tiret (un éventuel 3ᵉ segment
alphanumérique est autorisé APRÈS ces 3 chiffres, pas avant).

Même fichier, `fn_reverse_accounting_event`, ligne 963 :
```sql
'EXT-' || v_event.event_module || '-' || split_part(v_event.event_type, '-', 2),
```
Pour un événement `event_type = 'VTE-001'` : `event_module` vaut `'VTE'`
(calculé et stocké à l'émission par `emit_accounting_event`, ligne ~871 :
`v_module := split_part(p_event_type, '-', 1)`), et
`split_part('VTE-001', '-', 2)` vaut `'001'`. La chaîne produite est donc
`'EXT-VTE-001'`.

**Confrontation avec la contrainte, caractère par caractère** :
`'EXT-VTE-001'` → le moteur regex tente de faire correspondre
`[A-Z]{2,10}` au début. Il ne peut capturer que `'EXT'` (3 lettres, le
caractère suivant est `'-'`, pas une lettre). Il attend ensuite
**`[0-9]{3}` immédiatement après le tiret** — mais le caractère suivant
est `'V'` (début de `'VTE'`), pas un chiffre. Aucun repli (backtracking)
sur `[A-Z]{2,10}` ne peut faire apparaître un chiffre à cette position :
le motif échoue structurellement, pour **n'importe quelle valeur** de
`event_module` substituée entre `'EXT-'` et le numéro — ce n'est donc pas
un défaut spécifique à `'VTE'`, c'est une propriété de la construction de
chaîne elle-même, indépendante du module.

**Confirmé par exécution PostgreSQL réelle** (`docs/C6-185-FIX-VALIDATION.md`
§5) : la toute première tentative d'extourne d'un événement `VTE-001`
échoue avec `ERROR: new row for relation "accounting_events" violates
check constraint "chk_ae_event_type"`, `DETAIL` citant littéralement
`'EXT-VTE-001'`.

**Confirmé par donnée de production réelle** (lecture seule, §4) : **zéro**
ligne `accounting_events` avec `event_type LIKE 'EXT-%'` existe en
production, et **zéro** ligne avec `status = 'reversed'` — cohérent avec
« cette fonction n'a jamais réussi à se compléter, pour aucun événement,
depuis sa création ».

## 2. Call sites

Recherche exhaustive (`grep -rl "fn_reverse_accounting_event"` sur
`app/`, `lib/`, `supabase/migrations/`, `scripts/`, tous les fichiers
`*.test.ts` du dépôt) :

| Fichier | Type | Fonction/contexte | `event_type` transmis | Portée |
|---|---|---|---|---|
| `app/dashboard/facturation/page.tsx:463` | **Route UI, code applicatif réel** | `reverseFactureEvents(facId)`, appelée par `del(id)` (ligne 527) — handler de suppression d'une facture, **directement branché sur un bouton de l'UI** | `FAC-001`, `FAC-002` (filtrés dynamiquement sur les événements `processed` de la facture) | **PRODUCTION, ATTEIGNABLE** — erreur non vérifiée (`await supabase.rpc(...)` sans lire `{error}`), échouerait silencieusement si un événement `processed` existait pour la facture supprimée |
| `app/api/sales/[id]/reverse/route.ts` | **Route API réelle (C6)** | `POST /api/sales/:id/reverse`, `requireRole('admin')` | `VTE-001`, `VTE-002` | **ATTEIGNABLE (admin uniquement)** — erreur gérée explicitement (statut `'reversed'` pré-filtré depuis C6-POST-REVIEW-FIX, mais la toute première tentative réelle échoue avant même d'atteindre cette logique, cf. §1) |
| `lib/architecture/sales-reverse.integration.test.ts` | Test mocké | Vérifie l'orchestration de la route ci-dessus | `VTE-001` (simulé) | Test, pas un appel réel |
| `lib/architecture/vente-canonique.test.ts` | Test statique | Vérifie la présence de l'appel dans le code source (grep de fichier) | — | Test, pas un appel réel |
| `lib/architecture/loi-k-unique-writer.test.ts` | Test statique (gouvernance) | Chaîne descriptive uniquement (`"Pour supprimer : supabase.rpc('fn_reverse_accounting_event', ...)"`) — documente la règle "LOI-K" (aucun DELETE/UPDATE direct sur `journal_entries`, le seul chemin autorisé est l'extourne) | — | Documentation-dans-le-code, pas un appel |
| `supabase/migrations/138_accounting_engine_infrastructure.sql` | Définition | Corps de la fonction elle-même | — | Définition |
| `supabase/migrations/139_accounting_rules_facturation.sql:185` | Commentaire | `"FAC-004 : Facture annulée... Gérée via fn_reverse_accounting_event() — pas de règle additionnelle nécessaire"` | `FAC-001`/`002` (implicite) | Intention de conception, confirme que `facturation/page.tsx` est l'implémentation réelle de cette intention |
| `supabase/migrations/141_accounting_rules_paie.sql:253` | Commentaire | `"DRAFT — ... À activer via fn_reverse_accounting_event() lors annulation bulletin"` | `PAI-001` (futur, `DRAFT`, règle non `active`) | **Jamais activé** — intention documentée, aucun appelant réel |
| `supabase/migrations/180_fix_rls_tenants_journal_entries_leak.sql:46` | Commentaire | Audit de sécurité RLS/SECURITY DEFINER, cite la fonction parmi 4 autres | — | Analyse de sécurité, pas un appel |
| `scripts/` | — | **Aucune occurrence** | — | — |

**Code mort/orphelin : aucun** — les deux seuls appels réels
(`facturation/page.tsx`, `sales/[id]/reverse/route.ts`) sont tous deux
branchés sur une action utilisateur réelle (suppression de facture ;
annulation de vente, réservée aux admins).

## 3. Event types

54 `event_type` distincts trouvés dans `accounting_event_rules` à travers
toutes les migrations (`grep` exhaustif de tous les littéraux conformes au
motif `[A-Z]{2,10}-[0-9]{3}` dans `supabase/migrations/*.sql`) :

```
ACH-001/002, AGR-001/002/003, BOI-001/002, BTP-001/002/003/004, CAB-001,
COM-001, ECO-001/002/003/004/005, FAC-001/002/003/005/006, HOT-001/002/004,
MOB-001, ONG-001/002, PAI-001/002/003/004/005, RES-001/002/003/004,
SAN-001/002/003/004/005, STK-001/002/003/004, TRE-001, TRP-001, TST-001,
VTE-001/002
```

- **Types valides contre `chk_ae_event_type` à l'ÉMISSION** : les 54, sans
  exception — la contrainte ne pose jamais problème à la création d'un
  événement normal (confirmé par construction : chaque littéral a été
  extrait par un motif identique à celui de la contrainte elle-même).
- **Types incompatibles AU REVERSE** : les 54, sans exception — la
  construction `'EXT-' + module + '-' + numéro` échoue de façon identique
  pour chacun (démonstration structurelle, §1 — pas une propriété d'un
  `event_type` particulier).
- **Types jamais utilisés par un appel réel de reverse** : 52 des 54 (tous
  sauf `FAC-001`/`FAC-002` et `VTE-001`/`VTE-002`).
- **Types réellement présents en production aujourd'hui** (lecture seule,
  §4) : confirmé **zéro** ligne `processed` pour `FAC-001`, `FAC-002`,
  `VTE-001`, `VTE-002` au moment de cet audit — les autres types n'ont pas
  été vérifiés individuellement (hors périmètre précis demandé, qui ciblait
  la combinaison reverse/production).

## 4. Production evidence

Canal PostgreSQL réel en ÉCRITURE : toujours indisponible (confirmé par
toutes les missions `DB-*` précédentes). Canal **PostgREST en LECTURE
SEULE** : disponible et utilisé ici, une seule fois par requête, aucune
donnée modifiée :

| Requête | Résultat réel |
|---|---|
| `accounting_events` où `event_type LIKE 'EXT-%'` | **0 ligne** (`Content-Range: */0`) |
| `accounting_events` où `status = 'reversed'` | **0 ligne** |
| `accounting_events` où `event_type='FAC-001' AND status='processed'` | **0 ligne** |
| `accounting_events` où `event_type='FAC-002' AND status='processed'` | **0 ligne** |
| `accounting_events` où `event_type='VTE-001' AND status='processed'` | **0 ligne** (cohérent : 184/185/186 non exécutées en production) |
| `accounting_events` où `event_type='VTE-002' AND status='processed'` | **0 ligne** |
| `factures` (total) | **6 lignes** |

**Interprétation précise, sans sur-dramatiser ni minimiser** : le point
d'entrée réel `app/dashboard/facturation/page.tsx::del()` EST atteignable
et s'exécuterait à chaque suppression de facture (6 factures existent
aujourd'hui) — mais puisqu'**aucun événement `FAC-001`/`FAC-002` n'est
actuellement au statut `processed`** pour ces factures, la boucle
`reverseFactureEvents()` itère sur un ensemble vide et n'a, à ce jour,
**jamais réellement invoqué** `fn_reverse_accounting_event` en production.
**Le défaut est donc RÉEL, ATTEIGNABLE et LATENT — pas encore DÉCLENCHÉ
contre une donnée réelle existante**, une nuance différente de « sans
impact actuel » (il suffit qu'une seule facture avec un événement
`processed` soit un jour supprimée pour que le défaut se matérialise, sans
aucun avertissement visible pour l'utilisateur — l'erreur n'est jamais lue
par le code appelant).

Aucune trace d'une tentative passée n'est récupérable depuis la base :
`fn_reverse_accounting_event` n'a pas de bloc `EXCEPTION` propre (contre-
exemple : `fn_ae_execute_event` EN a un) — un échec ne laisse donc aucune
marque sur l'événement original (`error_message`, `status` restent
inchangés). Seuls des logs serveur (non accessibles depuis cette session)
pourraient confirmer une tentative passée.

## 5. Modules impacted

| Module | REVERSE_SUPPORTED | REVERSE_USED | REVERSE_PROVEN | REVERSE_BROKEN | Note |
|---|---|---|---|---|---|
| FAC | OUI (migration 139, commentaire FAC-004 explicite) | **OUI** (`facturation/page.tsx`) | NON | **OUI** (structurel, §1) | Seul module avec un appel réel ET une intention de conception explicite |
| VTE (C6) | OUI (migration 186) | **OUI** (`sales/[id]/reverse/route.ts`) | NON | **OUI** (structurel, confirmé par exécution réelle §1) | Dispose en plus d'un reverse de stock indépendant, lui PROUVÉ (§6) |
| PAI | PARTIEL — `DRAFT`, jamais `active` (migration 141) | NON | NOT_TESTED | OUI (structurel, non ré-exécuté empiriquement) | Intention documentée, jamais câblée à un appelant réel |
| RES | PARTIEL — `DRAFT` (RES-003, migration 142) | NON | NOT_TESTED | OUI (structurel) | Idem PAI, pour l'annulation de commande |
| ACH | NON (aucune mention) | NON | NOT_TESTED | OUI (structurel) | — |
| STK | NON (aucune mention — l'idempotence de retour de stock de C6 est un mécanisme SÉPARÉ, §6) | NON | NOT_TESTED | OUI (structurel) | — |
| BOI | NON | NON | NOT_TESTED | OUI (structurel) | — |
| SAN | NON | NON | NOT_TESTED | OUI (structurel) | — |
| HOT | NON | NON | NOT_TESTED | OUI (structurel) | — |
| BTP | NON | NON | NOT_TESTED | OUI (structurel) | — |
| ONG | NON | NON | NOT_TESTED | OUI (structurel) | — |
| AGR, CAB, COM, ECO, MOB, TRE, TRP, TST | NON | NON | NOT_TESTED | OUI (structurel) | Aucune mention de reverse trouvée |

**`REVERSE_BROKEN=OUI` partout est une déduction LOGIQUE/STRUCTURELLE** (la
construction de chaîne ne dépend pas du nom du module — démonstration
valable pour les 54 types, §1/§3), **PAS une ré-exécution empirique
individuelle de chacun des 54 types contre PostgreSQL réel** — seuls
`VTE-001` (C6) et, par construction identique, le principe général, ont été
vérifiés par une exécution réelle. Aucun `NOT_TESTED` n'est requalifié en
`PASS` dans ce tableau.

## 6. Existing reverse mechanisms

Mécanismes **indépendants** de `fn_reverse_accounting_event`, trouvés par
recherche exhaustive :

| Mécanisme | Fichier/fonction | Module | Inverse | Accounting | Stock | Trésorerie | Idempotence | Preuve réelle |
|---|---|---|---|---|---|---|---|---|
| **Reverse stock C6** | `fn_stock_move(..., p_reversed_movement_id)`, migration 186 | VTE (C6) | Un mouvement `sortie` précis, via un mouvement `retour` lié | NON (n'écrit jamais dans `accounting_events`/`journal_entries`) | **OUI** | NON | **OUI, PROUVÉE** — contrainte UNIQUE `idx_stock_movements_reversed_movement`, 2ᵉ tentative rejetée en `23505` (`docs/C6-185-FIX-VALIDATION.md` §5) | **OUI, réelle** |
| `fn_replay_accounting_event` | Migration 138 (définie juste après `fn_reverse_accounting_event`) | Générique | Ré-exécute un événement déjà traité (pas une annulation — un rejeu) | OUI | Indirect | Indirect | Non auditée dans cette mission (hors périmètre explicite : la mission cible `fn_reverse_accounting_event`) | Non vérifiée ici |
| `updateStatut()` (factures) | `app/dashboard/facturation/page.tsx:534` | FAC | Change `factures.statut` seulement — **aucune écriture comptable touchée** | NON | NON | NON | N/A | N/A — ne prétend pas annuler la comptabilité |
| Vue `v_accounting_extourne_chain` | Migration 138 | Générique | Rapport en lecture seule (chaîne original→extourne) — **pas un mécanisme d'action** | Lecture seule | NON | NON | N/A | N/A |

**Aucun autre mécanisme d'« annulation de paiement » ou d'« annulation
d'achat » dédié n'a été trouvé** (recherche de `reverse`/`annul`/`extourne`
dans `app/`/`lib/` au-delà de ce qui précède) — confirmant que
`fn_reverse_accounting_event` reste, pour FAC et VTE, le SEUL mécanisme
comptable d'annulation réellement branché, malgré son défaut. Ne pas
corriger le reverse stock de C6 : il est indépendant, déjà prouvé, et ne
souffre d'aucun défaut lié à `chk_ae_event_type`.

## 7. Risk analysis / Correction options

Aucune option choisie. Trois options architecturales minimales,
présentées pour décision séparée :

### Option A — Assouplir `chk_ae_event_type` pour accepter le préfixe `EXT-`
- **Impact sur `event_type`** : la contrainte devient
  `^(EXT-)?[A-Z]{2,10}-[0-9]{3}(-[A-Z0-9]+)?$` (ou équivalent) — accepte un
  préfixe `EXT-` optionnel avant le motif existant.
- **Compatibilité `chk_ae_event_type`** : par définition, oui — c'est elle
  qu'on modifie.
- **Compatibilité `accounting_event_rules`** : aucun impact — les règles ne
  référencent jamais un `event_type` `EXT-*` (confirmé §3).
- **Rétrocompatibilité** : totale pour tout événement normal déjà émis (le
  motif existant reste un sous-ensemble valide).
- **Idempotence** : inchangée (gérée par `accounting_event_extournes.
  UNIQUE(original_event_id)`, indépendante de ce correctif).
- **Risque de régression** : faible — une seule ligne de contrainte
  modifiée, aucune logique applicative touchée.
- **Modules concernés** : tous (le correctif est au niveau de la
  contrainte, pas d'une règle).
- **Migrations nécessaires** : une seule (`ALTER TABLE accounting_events
  DROP CONSTRAINT chk_ae_event_type, ADD CONSTRAINT ... CHECK (...)`).
- **Tests PostgreSQL nécessaires** : extourne réelle d'un événement de
  CHAQUE famille testée dans ce dépôt pour confirmer le succès ;
  vérification qu'un `event_type` malformé (autre que `EXT-`) est toujours
  rejeté (non-régression de la protection existante).

### Option B — Changer la construction de l'identifiant d'extourne dans `fn_reverse_accounting_event`
- **Impact sur `event_type`** : nouvelle convention, ex.
  `v_event.event_type || '-EXT'` (`'VTE-001-EXT'`) — déjà conforme au motif
  EXISTANT (le groupe optionnel `(-[A-Z0-9]+)?` l'autorise tel quel, **sans
  toucher la contrainte**).
- **Compatibilité `chk_ae_event_type`** : oui, sans la modifier — vérifié
  par relecture du motif : `'VTE-001-EXT'` = `[A-Z]{2,10}`(`VTE`)
  `-`+`[0-9]{3}`(`001`)+`(-[A-Z0-9]+)?`(`-EXT`, lettres autorisées dans ce
  groupe) — correspond.
- **Compatibilité `accounting_event_rules`** : aucun impact.
- **Rétrocompatibilité** : totale.
- **Idempotence** : inchangée.
- **Risque de régression** : légèrement supérieur à l'option A — touche le
  CORPS de la fonction (une ligne), pas seulement une contrainte ; tout
  code qui parserait un `event_type` d'extourne en supposant le format
  `EXT-xxx-nnn` (recherché, aucun trouvé dans ce dépôt au-delà de la vue de
  rapport §6, qui ne filtre pas par préfixe) devrait être revérifié.
- **Modules concernés** : tous.
- **Migrations nécessaires** : une seule (`CREATE OR REPLACE FUNCTION
  fn_reverse_accounting_event` avec la ligne modifiée).
- **Tests PostgreSQL nécessaires** : identiques à l'option A.

### Option C — Les deux (contrainte assouplie ET convention clarifiée)
- Combine A+B : la contrainte accepte explicitement les deux affixes
  (préfixe OU suffixe `EXT`), la fonction utilise la forme la plus claire
  (`event_type || '-EXT'`, qui garde le type d'origine lisible en préfixe).
- **Risque de régression** : le plus faible des trois à moyen terme (la
  contrainte documente explicitement les DEUX formes légitimes, évitant
  qu'un futur correctif ponctuel ne re-casse le même point), mais demande
  de toucher deux objets au lieu d'un.
- **Modules concernés / migrations / tests** : union de A et B.

## 8. Correction criterion

**C — les deux**, justifié par le code réel :

- **(A) C'est un problème de FORMAT/SYNTAXE** : la contrainte
  `chk_ae_event_type` est syntaxiquement précise et n'a pas de défaut
  logique propre — elle fait exactement ce qu'elle annonce (valider un
  identifiant `MODULE-NNN[-SUFFIXE]`). Le défaut est que
  `fn_reverse_accounting_event` construit un identifiant qui ne respecte
  pas ce format qu'elle-même impose aux autres écritures. Une correction
  de format seul (Option A ou B) suffit à faire disparaître l'erreur.
- **(B) C'est aussi un problème de CONCEPTION** : la fonction a été écrite
  (migration 138) sans qu'aucun test réel contre la contrainte active
  n'ait jamais été exécuté — confirmé par l'absence totale de ligne
  `EXT-%`/`reversed` en production, malgré l'existence de FAC-001/002 dans
  le moteur depuis la même migration. La conception du nommage de
  l'extourne (`'EXT-' + module + '-' + numéro`) a été pensée indépendamment
  de la contrainte qui la contraint, sans vérification croisée au moment
  de l'écriture — un défaut de PROCESSUS de conception, pas seulement une
  faute de frappe isolée.

## 9. PostgreSQL tests required (avant toute correction)

1. Appliquer l'option choisie dans un harness isolé (jamais en production
   directement).
2. Extourner réellement un événement de CHAQUE famille présente dans ce
   dépôt qui a une intention de reverse documentée au minimum : `FAC-001`,
   `VTE-001` (déjà couvert par le harness C6 existant), puis au moins un
   type SANS intention documentée (ex. `STK-002`) pour confirmer que la
   correction n'est pas accidentellement spécifique aux seuls modules déjà
   connus.
3. Vérifier qu'un `event_type` réellement malformé (ni le motif normal, ni
   `EXT-`) est TOUJOURS rejeté après la correction (non-régression de la
   protection de `chk_ae_event_type`).
4. Vérifier l'idempotence réelle : extourner deux fois le même événement,
   confirmer le rejet par `accounting_event_extournes.UNIQUE
   (original_event_id)` (déjà prouvée indépendante de ce défaut, à
   reconfirmer après coup).
5. Revalider `app/dashboard/facturation/page.tsx::del()` avec un événement
   `FAC-001` réellement `processed` créé pour l'occasion (jamais testé
   jusqu'ici, §4) — confirmer qu'une extourne réelle est créée et que la
   facture peut être supprimée sans laisser d'`accounting_events`
   orphelins.

## 10. Final verdict

`READY_FOR_FIX` — toutes les informations nécessaires à une correction
sont réunies : cause racine démontrée par le code, inventaire complet des
appelants réels, preuve de production confirmant l'absence totale de
succès historique, options de correction précises et comparées, critère de
correction justifié. Rien ne bloque le démarrage d'une mission de
correction dédiée — seule l'autorisation explicite de modifier le code
manque, conformément au périmètre de CETTE mission (audit seul).

---

```
REVERSE_IMPACT_AUDIT=READY_FOR_FIX
ROOT_CAUSE=fn_reverse_accounting_event (migration 138) construit l'event_type d'une extourne comme 'EXT-' + event_module + '-' + numéro (ex. 'EXT-VTE-001'), qui viole structurellement chk_ae_event_type (exige des chiffres immédiatement après le premier groupe de lettres) — pour tout module, pas seulement VTE. Confirmé par code, par exécution PostgreSQL réelle (C6), et par absence totale de ligne EXT-%/reversed en production.
AFFECTED_MODULES=Tous les 54 event_type définis (structurellement) ; impact réel/atteignable confirmé pour FAC (app/dashboard/facturation/page.tsx, suppression de facture) et VTE/C6 (app/api/sales/[id]/reverse/route.ts) — les 2 seuls avec un appelant réel branché à une action utilisateur.
PRODUCTION_USAGE=Point d'entrée FAC atteignable à chaque suppression de facture (6 factures existent) mais jamais encore déclenché contre un événement réel (0 ligne FAC-001/002 processed actuellement) — défaut réel et latent, pas encore matérialisé contre une donnée existante. 0 ligne EXT-%, 0 ligne status=reversed dans toute la table accounting_events (lecture seule, confirmé aujourd'hui).
CORRECTION_OPTIONS=A) assouplir chk_ae_event_type pour accepter un préfixe EXT- ; B) changer fn_reverse_accounting_event pour produire un suffixe -EXT déjà conforme au motif existant, sans toucher la contrainte ; C) les deux combinés. Aucune choisie dans cette mission.
NEXT_RECOMMENDED_MISSION=ACCOUNTING-REVERSE-001-FIX (mission de correction dédiée, autorisation explicite de modifier migration 138 requise, en commençant par l'option B — risque le plus faible — puis les tests PostgreSQL réels listés en §9, dont une extourne réelle sur un type sans intention de reverse documentée pour prouver la généralité du correctif).
```

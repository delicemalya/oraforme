# R-004 — Closure Forensic (fermeture forensique de R-003)

**Statut : BLOQUANT AVANT P1.** Mission de vérification et de reconstruction du backlog. Aucune
nouvelle fonctionnalité, aucun P1, aucun nouveau module, aucune refactorisation générale n'a été
entamé. Aucun des problèmes nouvellement découverts n'a été corrigé — seulement documenté,
conformément à l'instruction explicite.

**Rapports précédents** : `docs/R003-POST-P0-FORENSIC-VALIDATION.md` (commit `02a1233`),
`docs/REPAIR-LOG.md`, `docs/MASTER-REPAIR-REGISTER.md` (nouveau, créé par cette mission — source de
vérité transversale du backlog).

**État de ce document au moment de sa rédaction** : les 4 blocs SQL demandés par la mission
(diagnostic triggers/`caisse_operations`, contrôle P0-02, contrôle P0-03, test sur tenants isolés
177/178/ACH-002) ont été remis à l'utilisateur pour exécution en production. **Leurs résultats ne
sont pas encore disponibles** au moment de la première version de ce fichier — les sections A, D et
E le signalent explicitement. Ce document sera mis à jour, sur la même branche, dès réception.

---

## A — SQL vérifié

### A.1 — Contrôles P0-02 (Grand Livre/Balance)

Requêtes déjà rédigées dans `docs/REPAIR-LOG.md:288-304` mais **jamais exécutées avant cette
mission** (constat déjà établi par R-003, non résolu depuis). Étendues par R-004 pour couvrir les
12 mois × 4 années (2024-2027), au lieu des seuls 5 mois auparavant en échec, conformément à la
demande explicite de la mission.

**Statut : EN ATTENTE.** Bloc SQL 2 remis à l'utilisateur — lecture seule (`information_schema.columns`,
comptage par mois/année, `pg_policies`). Aucune écriture.

### A.2 — Contrôles P0-03 (paie → comptabilité)

Requêtes déjà rédigées dans `docs/REPAIR-LOG.md:465-490`, jamais exécutées. Reprises à l'identique
(Bloc SQL 3) — inchangées depuis R-003, la fenêtre de test (« depuis le déploiement du 2026-09-04 »)
reste valide.

**Statut : EN ATTENTE.**

### A.3 — État réel des triggers legacy

Nouveau pour R-004 : re-vérification de `pg_trigger` sur `transactions`, `caisse_operations`,
`achats` (régression), `comptes_bancaires`, `caisses` — le diagnostic du 2026-09-02 sur
`transactions` n'avait jamais été refait, et celui sur `caisse_operations` n'avait **jamais été
fait du tout** (aucune mention dans les diagnostics précédents). Bloc SQL 1, lecture seule.

**Statut : EN ATTENTE.**

---

## B — Migration 177 : promesse vs réalité

**PROMESSE** (`docs/REPAIR-LOG.md:685`, diagnostic du 2026-09-02) : « le dépôt et la production
divergent (ANO-P04) : la migration 177 alignera le dépôt en supprimant ces deux triggers
[`trg_auto_journal_entry`, `trg_transaction_to_journal`], sans effet en production. »

**SQL RÉEL** (`supabase/migrations/177_repair_achats_legacy_doublons.sql`, relu intégralement,
133 lignes) : contient un garde-fou (`DO $$ ... RAISE EXCEPTION`), la création idempotente de
`repair_archive`, un `INSERT` d'archivage, un `DELETE`, et une requête de contrôle — **rien sur
`transactions`**. Le fichier tel qu'écrit et committé (`5e25f9d`) ne mentionne ni
`trg_auto_journal_entry` ni `trg_transaction_to_journal`, ni aucun `DROP TRIGGER`. Vérifié par
lecture complète du fichier, pas par un simple `grep` (le fichier entier a été relu ligne à ligne
pour cette mission).

**ÉTAT ACTUEL DE LA DB** : la seule source disponible est le diagnostic du 2026-09-02
(`REPAIR-LOG.md:685`) : « Seul `trg_update_account_balance` est actif. `trg_auto_journal_entry` et
`trg_transaction_to_journal` (…) n'existent pas en production. » Ce diagnostic a **2 jours** au
moment de cette mission et **n'a jamais été refait** — aucune preuve fraîche. Bloc SQL 1 remis à
l'utilisateur pour re-confirmation.

### Détermination demandée par la mission

- **Quels triggers existent réellement** — en attente du Bloc SQL 1.
- **Lesquels sont actifs** — en attente.
- **Lesquels sont legacy** — établi par lecture de code : `trg_auto_journal_entry` (migration 027,
  `fn_auto_journal_entry`, comptes devinés par mot-clé de catégorie, `571000`/`709000` par défaut,
  aucune garde d'idempotence visible dans le corps de la fonction) et `trg_transaction_to_journal`
  (migration 023, écrit dans le registre `journal_comptable`, pas `journal_entries`) sont tous deux
  antérieurs au moteur central (migration 138) — les deux sont legacy par construction.
- **Lesquels écrivent** — `trg_auto_journal_entry` écrit `journal_entries` ; `trg_transaction_to_journal`
  écrit `journal_comptable` (pas `journal_entries` directement, mais alimente le même registre
  visible dans l'UI « Journal OHADA ») ; `trg_update_account_balance` écrit `accounts.balance`
  (hors périmètre comptable stricto sensu).
- **Lesquels peuvent créer des doublons** — `trg_auto_journal_entry`, si actif : chaque `INSERT`
  dans `transactions` (dont ceux que le moteur central produit lui-même pour tout événement à
  impact trésorerie — FAC-002, PAI-002, RES-001, ECO-001, ACH-002, etc., cf.
  `fn_ae_has_treasury_impact`) déclencherait une écriture `journal_entries` supplémentaire, en plus
  de celle déjà produite par la règle du moteur pour le même événement. C'est le même schéma que le
  bug achats déjà corrigé, mais à un rayon d'action potentiellement bien plus large.
- **Ce qui se passe si la migration est rejouée** — les migrations 026 et 027 **créent** ces deux
  triggers (`CREATE TRIGGER`, pas de garde conditionnelle) ; comme aucune migration ultérieure du
  dépôt ne les `DROP`, un rejeu intégral (nouvel environnement de recette, disaster recovery,
  `supabase db reset`) les recréerait, réintroduisant le risque à l'échelle de tous les événements
  à impact trésorerie du moteur.

### Cause racine (établie, pas d'hypothèse)

Le ticket 177 a été scopé en session sur le seul défaut confirmé et chiffré au moment de son
écriture (les 48 doublons `achats_enregistrement`, avec diagnostic et garde-fous dédiés). La
promesse d'alignement du dépôt pour `trg_auto_journal_entry`/`trg_transaction_to_journal`,
formulée dans une session antérieure (diagnostic P0-04 du 2026-09-02), n'a pas été reprise dans le
périmètre du ticket au moment où il a été effectivement écrit et exécuté (2026-09-04) — un gap de
transmission entre le diagnostic qui a fait la promesse et l'implémentation qui l'a exécutée
partiellement.

**Aucune correction appliquée.** Conformément à l'instruction de la mission (« NE PAS appliquer de
correction avant d'avoir établi la cause racine »), et la cause racine étant établie mais l'état
réel de production restant à confirmer (Bloc SQL 1), aucune migration corrective n'a été écrite
dans cette session. Ticket ouvert : `R004-DB-TRIGGER-TRANSACTIONS` (voir `docs/REPAIR-LOG.md`).

---

## C — `caisse_operations` : audit des writers

### Writer A — `trg_caisse_operation`

`fn_caisse_operation_to_journal()`, définie et attachée en `AFTER INSERT ON caisse_operations`
(`supabase/migrations/046_erp_full_interconnection.sql:542-591`), jamais droppée par aucune
migration ultérieure (vérifié : `grep DROP TRIGGER.*trg_caisse_operation` sur tout
`supabase/migrations/` → 0 résultat, hors le `DROP TRIGGER IF EXISTS` de la ligne 589 qui précède
immédiatement sa propre re-création dans le même fichier — un pattern habituel du dépôt, pas une
suppression réelle).

Pour un `INSERT` de type `depense` : écrit une ligne `transactions`
(`source='caisse_operations', source_id=NEW.id, debit_account=NEW.compte_charge,
credit_account='571000'`) **et** une ligne `journal_entries` (mêmes `source`/`source_id`, mêmes
comptes). Garde d'idempotence : ligne 551-554, `IF EXISTS (SELECT 1 FROM journal_entries WHERE
source='caisse_operations' AND source_id=NEW.id...) THEN RETURN NEW`.

### Writer B — `writeComptaEntry()`

`lib/compta-sync-client.ts:133-175` (exemption officielle EXM-JE-003, `docs/LOI-K-UNIQUE-WRITER.md:100-104`,
qualifiée de dette technique). Appelée depuis `app/dashboard/tresorerie/caisses/page.tsx:97-105`,
**dans la même fonction `saveOp()`**, immédiatement après l'`INSERT` dans `caisse_operations`
(ligne 87) qui déclenche le Writer A. Écrit une ligne `journal_comptable` **et** une ligne
`journal_entries` — `source='caisse'`, **`source_id` NULL** (aucune référence à la ligne
`caisse_operations` créée), comptes fixés par la page elle-même :
`debitAccount: isDepense ? '658' : '571'`, `creditAccount: isDepense ? '571' : '521'`.

### Construction Writer A / Writer B → même opération ?

**Oui, pour toute opération de caisse créée via cette page précise** — le même clic utilisateur
déclenche les deux chemins, sans aucune garde partagée : la garde du Writer A ne voit que ses
propres lignes (`source='caisse_operations'`) et ne peut donc pas détecter que le Writer B a déjà
(ou va) écrire une ligne équivalente sous un `source` différent et sans `source_id`. **Divergence
supplémentaire relevée** : pour une dépense, le Writer A crédite `'571000'` (code à 6 chiffres,
hérité de la période pré-normalisation, migration 133) alors que le Writer B crédite `'571'` (code
normalisé à 3 chiffres) — même si les deux s'exécutent, ils produisent des écritures
comptablement équivalentes mais **techniquement non identiques**, ce qui casserait toute requête
d'agrégation qui suppose un code de compte canonique unique.

### Plusieurs autorités d'écriture existent-elles ?

**Oui, établi par lecture de code — pas une hypothèse.** Le nombre exact d'opérations réellement
touchées (le Writer A/B sont-ils tous deux actifs en production à ce jour ?) reste à confirmer par
le Bloc SQL 1.

### Cause racine

Absence de garde d'idempotence partagée entre le mécanisme trigger legacy (jamais retiré depuis la
migration 046) et l'exemption `writeComptaEntry()` (EXM-JE-003, dette technique documentée mais
non traitée) pour ce module précis. Contrairement au cas achats (où le trigger avait été
effectivement supprimé par la migration 147, laissant seulement des lignes orphelines historiques),
ici **les deux mécanismes coexistent activement dans le code du dépôt aujourd'hui** — un doublon
qui, si le trigger est actif en production, se reproduit à **chaque nouvelle opération**, pas
seulement sur un historique figé.

**Aucune correction appliquée.** Conformément à l'instruction de la mission. Ticket ouvert :
`R004-CAISSE-DUPLICATE-WRITER`.

---

## D — Migration 178 : vérification généralisée

### Ce qui est déjà `CLOSED` (incident historique, ne pas re-tester)

AMD FINANCE, 3 comptes bancaires triplés à 314 488 246 F, corrigé et vérifié le 2026-09-04 (contrôle
réel : BGFI/BOCEC → `principal=false·solde=0`, LCB → `principal=true·solde=314488246`).

### Ce que cette mission demande en plus — EN ATTENTE (Bloc SQL 4)

Le test sur tenants isolés construit explicitement 3 tenants séparés, chacun avec un nombre de
comptes différent, pour éviter de supposer qu'AMD FINANCE (3 comptes) représente tous les cas :

| Tenant de test | Comptes | Mouvements | Attendu après `fn_sync_tresorerie_soldes` |
|---|---|---|---|
| 1 compte | 1 (forcément principal) | entrée 50 000, sortie 5 000 | solde = 45 000 |
| 2 comptes | principal + secondaire + 1 caisse | entrée 100 000, sortie 30 000, transfert banque→caisse 20 000 | principal = 50 000, secondaire = 0, caisse = 20 000 |
| 3 comptes | principal + 2 secondaires | entrée 999 000, sortie 111 000 | principal = 888 000, les deux secondaires = 0 |

Chaque tenant reçoit un montant total distinct et sans rapport (45 000 / 50 000 / 888 000) pour
détecter immédiatement toute fuite de calcul entre tenants si les résultats se mélangeaient.

**Preuve mathématique visée** : `solde calculé = Σ mouvements réels du compte principal` — et non
`solde calculé = Σ mouvements × nombre de comptes` (le bug d'origine). Le test isolé, une fois
exécuté, apporte cette preuve pour 1, 2 et 3 comptes simultanément, sur des tenants qui n'ont
jamais existé avant cette session (`ROLLBACK` en fin de script, aucune trace laissée).

**Statut : PRODUCTION_PENDING** (le correctif historique reste `CLOSED` ; la généralisation suit
son propre ticket `R004-TREASURY-VERIFICATION`).

---

## E — ACH-002

**0 achat payé en production** (reconfirmé, `docs/REPAIR-LOG.md` §« Ticket triggers hérités
achats », section 8 du diagnostic du 2026-09-04 : « 48 achats total, 0 payé »).

**Statut obligatoire, conformément à l'instruction explicite : `NOT_TESTABLE — NO PRODUCTION
DATA`.** Aucune donnée n'a été écrite en production pour fabriquer artificiellement une
transaction — interdiction respectée.

Test isolé préparé (Bloc SQL 4, même script que D) sur le tenant « 2 comptes » : un achat de test
marqué `paye`, émission `ACH-002`, vérification qu'une seule ligne `journal_entries` (401) et une
seule ligne `transactions` sont produites, puis **ré-émission du même événement** (double clic /
retry réseau simulé) pour vérifier l'idempotence — même mécanisme de contrainte unique
(`uidx_ae_inflight`) que celui déjà vérifié pour ACH-001. Attendu : `1 opération = 1 événement =
1 écriture`, y compris après la ré-émission.

**Ce test ne lève pas le statut `NOT_TESTABLE`** — il prouve le mécanisme générique sur un tenant
jetable, pas le comportement avec un achat production réel. Le ticket `R004-ACH-002-UNTESTABLE`
reste ouvert jusqu'au premier achat effectivement payé en production.

---

## F — Rapprochement exhaustif des 72 anomalies

Détail complet dans `docs/MASTER-REPAIR-REGISTER.md` (Table 1). Méthode et correction
méthodologique importante, résumées ici :

**Erreur corrigée de R-003** : `docs/R003-POST-P0-FORENSIC-VALIDATION.md` §8 concluait que 5 des
72 anomalies seulement avaient un ticket. C'était une lecture incomplète — limitée à
`docs/REPAIR-LOG.md`, sans grep-er le dépôt (code + migrations) pour les citations `ANO-xxx`
directement dans les fichiers source. R-004 a fait ce grep exhaustif et trouvé **8 commits
supplémentaires**, tous mergés dans `main` le 2026-09-04 via la même PR #1 que P0-01→05, mais
**jamais documentés dans REPAIR-LOG.md** :

| Commit | Anomalies corrigées |
|---|---|
| `f0d43f2` | ANO-C01, C05, C06, C07, M26 |
| `92c8d4e` | ANO-C04 |
| `b8913a4` | ANO-C02 |
| `0ac4e95` + `857b451` | ANO-C03 |
| `0bcfa10` | ANO-M01 |
| `d3f9930`, `acb6d0c`, `61897f2`, `8bcaa76` | ANO-N16 (implicite), N20, P04, P05 |

Chaque correction a été vérifiée par lecture directe du fichier de migration/code cité (pas
seulement le message de commit), avec citation fichier:ligne dans le registre maître.

### Décompte final (72/72, aucune anomalie perdue)

| Statut final | Nombre |
|---|---:|
| VERIFIED | 4 (ANO-C07, ANO-C08, ANO-M04, ANO-P04) |
| CODE_FIXED | 11 |
| PRODUCTION_PENDING | 1 (ANO-C01) |
| OBSOLETE | 1 (ANO-N16) |
| **OPEN** | **55** |
| IN_PROGRESS / CLOSED / NOT_REPRODUCIBLE | 0 |
| **Total** | **72** ✓ |

**Conclusion inchangée malgré la correction** : même en tenant compte des 8 commits non
documentés, **55 des 72 anomalies (76 %) restent intégralement ouvertes**, sans aucun correctif —
le diagnostic central de R-003 (couverture très faible du backlog) reste valide, seul le détail des
7 anomalies critiques était sous-estimé.

**Aucune preuve de production chiffrée n'existe pour les 7 corrections critiques nouvellement
retrouvées** (ANO-C02, C03, C04, C05, C06, C09, C10) — toutes restent `CODE_FIXED`, jamais
`VERIFIED`, sauf ANO-C07 (suppression de fichier, fait binaire suffisant) et ANO-C08 (déjà établi
par R-003 avec table de contrôle chiffrée).

---

## G — Nouveau backlog

### Découvertes hors des 72 (Table 2 du registre maître)

NEW-01 (double écriture `caisse_operations`), NEW-02 (triggers `transactions` non droppés), NEW-03
(scission de schéma Mobile Money), NEW-04 (concurrence d'écriture `comptes_bancaires.solde`),
NEW-05 (UI Balance/Grand Livre/Bilan dupliquée) — toutes issues de R-003, reprises et approfondies
ici pour NEW-01/NEW-02 (cause racine désormais établie, voir §B/§C).

### Tickets créés par cette mission (Table 4 du registre maître)

`R004-DB-TRIGGER-TRANSACTIONS`, `R004-CAISSE-DUPLICATE-WRITER`, `R004-TREASURY-VERIFICATION`,
`R004-ACH-002-UNTESTABLE` — détail complet dans `docs/REPAIR-LOG.md`, tous `OPEN` ou
`NOT_TESTABLE`, aucun doublon avec les tickets existants (177 et 178 restent fermés pour leur
périmètre historique respectif ; les nouveaux tickets couvrent explicitement ce qui reste à
prouver ou à corriger au-delà).

### Total réel restant (§9 de la mission)

Voir le tableau de compteurs complet dans `docs/MASTER-REPAIR-REGISTER.md`. Synthèse :

- 72 anomalies originales
- 4 fermées avec preuve (`VERIFIED`) + 1 obsolète
- 12 corrigées mais non vérifiées en production (`CODE_FIXED` : 11 + `PRODUCTION_PENDING` : 1)
- 55 encore ouvertes (`OPEN`)
- 9 nouveaux problèmes découverts (5 `NEW-xx` + 4 tickets R004, dont 1 `NOT_TESTABLE`)
- **Total réel restant à traiter : 55 + 1 + 5 + 4 = 65 lignes actives dans le registre maître**

---

## H — Risques bloquants (avant tout P1)

1. **NEW-02 / R004-DB-TRIGGER-TRANSACTIONS** — si les migrations sont rejouées sur un nouvel
   environnement (recette, disaster recovery), le risque de double écriture comptable réapparaît à
   grande échelle. Bloquant pour toute création d'environnement de recette (qui dépend elle-même
   d'ANO-P03, encore `OPEN`).
2. **NEW-01 / R004-CAISSE-DUPLICATE-WRITER** — risque actif à chaque nouvelle opération de caisse
   si le trigger est confirmé actif (Bloc SQL 1 en attente).
3. **ANO-P03 (aucun environnement de recette)** — bloque la validation de la migration 168 (76
   policies RLS, jamais appliquée), et plus généralement toute vérification en profondeur qui ne
   doit pas toucher la production.
4. **7 anomalies critiques `CODE_FIXED` sans preuve de production** (ANO-C02, C03, C04, C05, C06,
   C09, C10) — code déployé, jamais vérifié en conditions réelles. Aucune n'est un blocage
   opérationnel connu à ce jour, mais aucune n'est confirmée sans risque non plus.
5. **55 anomalies `OPEN`** dont plusieurs de sécurité directe (ANO-M05 aucune validation d'entrée,
   ANO-M06 aucun header de sécurité, ANO-N01/N02 lecture anonyme, ANO-N09 page Sentry publique,
   ANO-M36 dépendance vulnérable) — aucune n'a été aggravée par cette mission, mais aucune n'a été
   réduite non plus.
6. **Migration 168** reste non appliquée, sans environnement pour la valider en toute sécurité.

**Aucun de ces risques n'a été corrigé par cette mission — documentation uniquement, conformément
à l'instruction explicite.**

---

## Conclusion

**STOP après ce rapport.** Aucun P1 n'est commencé. Aucun des problèmes nouvellement découverts
n'a été corrigé. Le registre maître (`docs/MASTER-REPAIR-REGISTER.md`) devient la référence
transversale du backlog ; `docs/REPAIR-LOG.md` reste le journal chronologique détaillé.

**En attente de l'ordre**, et des résultats des 4 blocs SQL remis à l'utilisateur (§A, D, E) pour
finaliser les statuts `PRODUCTION_PENDING` restants.

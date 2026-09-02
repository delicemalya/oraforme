# REPAIR LOG — Mission R-002

Journal des réparations P0. Un ticket par anomalie, fermé seulement quand les
preuves sont produites.

---

## P0-01 — DOCUMENTS FISCAUX INCORRECTS

**Statut :** RÉPARÉ — vérifié par tests, non déployé
**Date :** 2026-09-02
**Anomalies couvertes :** F1, F2, F3, F4, F6, F9 de `docs/MIGRATION-MAP-AZ.md` §2

### Anomalie

Six chaînes produisant un document opposable portaient des montants faux ou
incohérents avec le droit :

| Document | Défaut constaté |
|---|---|
| Déclaration DGI, ligne 9 | TUS fiscale liquidée à 4,5 %, taxe supprimée par la LF 2026 |
| Déclaration DGI, ligne 3 | `factures.tva` lu comme un **taux** et multiplié par le montant HT, alors que la colonne porte un **montant** depuis la migration 160 |
| Déclaration CNSS | Allocations familiales assises sur le plafond AT/MP de 600 000 F au lieu de leur plafond propre de 1 200 000 F |
| PDF CNSS fiscalité | En-tête « Taux salarié: 5,04 % · Patronal: 14,36 % », valeurs issues d'aucun calcul |
| Contrat de travail | Cotisation salariale à 5,04 % du brut, coût employeur × 1,1416, sans aucun plafond |
| Déclaration CNSS multi-pays | Le drapeau `support_declarations_cnss` n'était lu nulle part : le document se générait pour le Tchad, la Centrafrique et la Guinée équatoriale, où il vaut `false` |
| Patente | Barème détenu par le module de déclaration, en double : une table exportée et une cascade de conditions |

### Cause racine

**Chaque document détenait ses propres constantes fiscales au lieu de lire le
moteur canonique.** Les taux imprimés provenaient du même fichier que le calcul :
le document était cohérent avec lui-même et faux par rapport au droit, donc
invisible à toute relecture.

Trois réimplémentations indépendantes coexistaient, aucune dérivée de
`lib/countries/` : `lib/declarations/cnss-congo.ts` (7 constantes),
`lib/declarations/patente.ts` (barème en double), et les libellés écrits en dur
dans les cinq composants de rendu.

### Consommateurs identifiés

`app/api/declarations/cnss/{route,[id]/pdf,[id]/excel,preremplir}` ·
`app/api/declarations/{mensuelle,patente}` · `app/api/fiscalite/cnss/{route,pdf}` ·
`app/api/hr/contracts/[id]/pdf` · `app/dashboard/declarations/cnss` ·
`app/dashboard/rh/contrats` · `components/declarations/pdf/{DeclarationGlobaleCNSS,ListeNominativeCNSS}` ·
`components/declarations/{PatentePDF,DeclarationGeneralePDF}` · `components/rh/ContratPDF`

Les constantes exportées par `cnss-congo.ts` n'étaient importées nulle part
ailleurs : leur suppression n'a cassé aucun appelant.

### Dépendances

`lib/countries/CG.ts` (source), `lib/countries/types.ts` (contrat),
`lib/fiscal/universal-tax-engine.ts` (moteur). Aucune migration de base.

### Correction

**Source canonique enrichie, sans inventer aucune valeur.**

- `types.ts` : `TaxeAbrogee` (une taxe supprimée garde sa date et son taux
  d'origine, pour qu'une déclaration rectificative reste juste) et `ConfigPatente`.
- `CG.ts` : `taxes_abrogees` avec la TUS fiscale, abrogée au 2026-01-01 par la
  LF 2026 ; `patente`, barème déplacé depuis `lib/declarations/patente.ts`
  valeur pour valeur, avec sa source (Art. 122 CGI, LF 2026).

**Moteur : quatre accesseurs.**
`getTaxeAbrogee()` · `calculerTaxesAdditionnellesSurTVA()` · `getBaremePatente()` ·
`isPaysConfigure()` et `supporteDeclarationsCNSS()`.

**Documents : plus une seule constante.**

| Fichier | Correction |
|---|---|
| `lib/declarations/cnss-congo.ts` | Réécrit : délègue à `calculerChargesSociales()`, expose le détail par branche avec son plafond propre |
| `lib/declarations/declaration-generale.ts` | TUS par `getTaxeAbrogee()` ; TVA = somme des montants ; centimes par le moteur |
| `lib/declarations/patente.ts` | Lit le barème du pays ; les deux copies internes supprimées |
| `lib/declarations/export-cnss.ts` | En-têtes sans taux |
| `components/declarations/pdf/DeclarationGlobaleCNSS.tsx` | Tableau et plafonds rendus depuis `recap.branches` |
| `components/declarations/pdf/ListeNominativeCNSS.tsx` | Pied de page des plafonds construit depuis les branches |
| `components/declarations/PatentePDF.tsx` | Pourcentages des notes lus dans le barème |
| `components/declarations/DeclarationGeneralePDF.tsx` | Ligne 9 : libellé dérivé du taux réellement appliqué |
| `components/rh/ContratPDF.tsx` | Cotisations par `calculerChargesSociales()`, pays en paramètre |
| `app/dashboard/rh/contrats/page.tsx` | Idem, pays du tenant |
| `app/dashboard/declarations/cnss/page.tsx` | Lignes, légende et en-têtes depuis les branches |
| `app/api/fiscalite/cnss/pdf/route.ts` | Taux imprimés dérivés des montants liquidés |
| `app/api/fiscalite/cnss/route.ts` | Refus explicite `NOT_CONFIGURED` si le pays ne supporte pas la déclaration |

Aucune double source de vérité créée, aucun Core contourné, aucun `any` ajouté,
aucune exemption de test, aucun test désactivé.

### Tests

| Fichier | Contenu |
|---|---|
| `lib/declarations/cnss-congo.test.ts` | 18 cas : plafonds distincts AF et AT, montants par branche, égalité entre taux imprimé et taux appliqué, agrégat du récapitulatif |
| `lib/fiscal/taxes-abrogees.test.ts` | 8 cas : TUS à 4,5 % avant abrogation, 0 après, sur les 12 mois de 2026 ; code inconnu sans taux par défaut |
| `lib/architecture/documents-fiscaux.test.ts` | Scanner : aucun taux, pourcentage ou plafond écrit à la main dans une chaîne documentaire |

Le scanner contient ses propres cas de contrôle : il doit détecter les quatre
lignes réellement présentes dans le code avant correction. Un scanner affaibli
pour obtenir un succès échouerait sur ces cas.

`_selfTestCNSS()` a été conservé, ses attendus corrigés : ils consacraient le
défaut en exigeant 73 680 F d'AT/MP quel que soit le brut.

### Résultats

```
tsc --noEmit      0 erreur
eslint            0 erreur, 111 avertissements (préexistants)
vitest            562 tests, 562 passés, 26 fichiers
next build        exit 0
```

Suite avant P0-01 : 526 tests. Après : 562, soit 36 nouveaux.

### Preuves

| Contrôle | Avant | Après |
|---|---|---|
| Allocations familiales, brut 1 500 000 F | 60 180 F | **120 420 F** |
| Écart mensuel par salarié | — | **60 240 F** de sous-déclaration supprimés |
| Base AF vs base AT, brut 1 500 000 F | 600 000 / 600 000 | **1 200 000 / 600 000** |
| TUS fiscale, période 2026 | 4,5 % du brut | **0** |
| TUS fiscale, période 2025 | 4,5 % | 4,5 % (inchangé, à raison) |
| Valeurs fiscales en dur dans les documents | 33 | **0** |

### Régression

Aucune. Les 526 tests antérieurs passent tous. Le seul comportement modifié
volontairement est celui qui produisait les montants faux.

### Non couvert, et pourquoi

- **Périodicité du barème IRPP.** Écart de 1 à 50 sur les bulletins. La cause
  est établie à la ligne près mais la réponse est une règle de droit absente du
  dépôt. Trancher reviendrait à deviner. Reste bloqué (D3).
- **Second barème de patente** dans `lib/fiscalite-congo.ts`, 8 tranches et
  minimum de perception à 97 500 F, contradictoire avec l'Art. 122 retenu. Il
  n'alimente aucun document. Son retrait relève de l'arbitrage des moteurs
  concurrents (P0-05).
- **Cinq taux devinés** pour le Gabon, la Guinée équatoriale, la Centrafrique et
  le Tchad. `supporteDeclarationsCNSS()` bloque désormais la déclaration CNSS de
  ces pays ; le reste relève de P0-05.
- **Playwright.** Non exécuté : les tests de certification pointent sur la base
  de production et écrivent. Il n'existe pas d'environnement de recette
  (point 0.3 du plan). Exécuter ces tests aurait modifié des données réelles.
- **Vérification en base et en production.** La correction est du calcul, sans
  migration. Le contrôle en conditions réelles suppose la mise en ligne de la
  branche, qui n'est pas faite.

---

## P0-02 — GRAND LIVRE ET BALANCE (ERP Core comptabilité)

**Statut :** CODE PASS — non déployé, non vérifié en production
**Date :** 2026-09-02
**Anomalie couverte :** ANO-C09 de `docs/RESTART-AUDIT-AZ.md`

### Anomalie

Deux routes ERP Core injoignables en production.

```
GET /api/comptabilite/grand-livre   400    column journal_entries.reference does not exist
GET /api/comptabilite/balance       22008  date/time field value out of range
```

### Cause racine

**Bug 1 — Grand Livre.** Le contrat ERP Core nommait deux colonnes qui n'existent
dans aucune des 174 migrations : `reference` et `journal_type`.

La colonne réelle n'est pas non plus `reference_piece`. Trois candidates
existaient, la preuve départage :

| Colonne | Origine | Écrite par |
|---|---|---|
| `reference` | aucune migration | personne — n'existe pas |
| `reference_piece` | migration 027 | **personne** — colonne vide |
| `piece_number` | migration 065 | `emit_accounting_event` (138:735), writer unique |

`emit_accounting_event` est le seul writer de `journal_entries` sous LOI-K, et il
renseigne `piece_number`, y compris pour les extournes (138:951). L'écran Journal,
qui fonctionne, écrit la même colonne. Remplacer mécaniquement `reference` par
`reference_piece` aurait transformé une erreur 400 en colonne vide, c'est-à-dire
un défaut silencieux.

**Bug 2 — Balance.** La borne haute de période était construite en collant `-31`
au mois :

```ts
.lte('date_operation', `${year}-${monthStr}-31`)
```

Février, avril, juin, septembre et novembre n'ont pas de 31 : PostgreSQL rejette
la date. La Balance échouait donc **cinq mois sur douze**.

**Pourquoi c'est resté invisible.** Les deux routes n'ont aucun appelant. Les
pages `comptabilite/balance` et `comptabilite/grand-livre` lisent
`journal_entries` en direct et réimplémentent le calcul. Rien n'exerçait les
routes, et le `const db = supabaseAdmin as any` supprimait toute vérification de
colonne à la compilation (ANO-M28).

### Fichiers et lignes

| Fichier | Avant | Après |
|---|---|---|
| `lib/erp-core/compute/accounting.ts:29,31` | `reference`, `journal_type` dans `JournalLedgerRow` | `piece_number`, `journal_type` retirée |
| `lib/erp-core/compute/accounting.ts:97` | `GRAND_LIVRE_SELECT` avec 2 colonnes fantômes | sélecteur aligné sur le schéma réel |
| `lib/erp-core/compute/accounting.ts` | — | `periodeMensuelle()` ajoutée |
| `app/api/comptabilite/balance/route.ts:35-40` | `.lte(..., '-31')` | intervalle semi-ouvert `gte` / `lt` |

Aucune modification de `app/api/comptabilite/grand-livre/route.ts` : la route
était correcte, c'est le contrat qu'elle consomme qui nommait de fausses colonnes.

### Modification

`periodeMensuelle(annee, mois)` retourne `{ debut, fin_exclusive }`. Un
intervalle semi-ouvert n'a jamais besoin de connaître le dernier jour d'un mois :
il s'arrête au premier jour du suivant. Décembre bascule sur l'année suivante.
Aucun objet `Date` n'est construit, donc aucun décalage de fuseau. Un mois hors
bornes lève une `RangeError` que la route traduit en 400, au lieu de laisser
partir une requête invalide.

Aucune table créée, aucun calcul parallèle, aucun repli sur une ancienne logique,
aucune source comptable nouvelle. Les deux routes lisent `journal_entries` et
délèguent à ERP Core.

### Tests

| Fichier | Cas |
|---|---|
| `lib/erp-core/compute/accounting.test.ts` | 39 — période sur les 12 mois, bissextile, bascule de décembre, mois invalide ; Balance : comptes, débit, crédit, solde, équilibre, filtre de classe, mois vide, mois peuplé ; Grand Livre : regroupement, tri, référence de pièce, anomalies SYSCOHADA, filtres |
| `lib/architecture/erp-core-comptabilite.test.ts` | 27 — chaque colonne des deux sélecteurs existe dans `journal_entries`, `reference` et `journal_type` ne peuvent pas revenir, aucune borne `-31`, filtre tenant présent, session exigée, lecture seule, table unique, calcul délégué à ERP Core |

Les mois à 28, 29, 30 et 31 jours sont testés explicitement, ainsi que les cinq
mois qui échouaient.

Le test d'architecture rétablit une vérification là où le `as any` l'avait
supprimée : la liste des colonnes de `journal_entries` y est relevée migration par
migration.

### Résultats

```
tsc --noEmit      0 erreur
eslint            0 erreur, 111 avertissements (préexistants)
vitest            628 tests, 628 passés, 28 fichiers
next build        exit 0
```

Suite avant P0-02 : 562 tests. Après : 628, soit 66 nouveaux.

### Régressions

Aucune. Les 562 tests antérieurs passent. Aucun test n'a été modifié pour
obtenir un succès.

### Limites

- **Les deux routes n'ont toujours aucun appelant.** Réparer la cible était le
  préalable ; brancher les deux pages dessus est l'étape C3/C4 de
  `docs/MIGRATION-MAP-AZ.md`, explicitement ordonnée après celle-ci. La faire
  dans le même ticket reviendrait à modifier deux domaines à la fois.
- **Playwright non exécuté.** `tests/certifications/c005-erp-certification.spec.ts`
  exige `SUPABASE_SERVICE_ROLE_KEY` (ligne 37) et écrit dans la base pointée par
  `.env.local`, qui est la production. Il n'existe pas d'environnement de recette
  (point 0.3 du plan). Exécuter ces tests aurait modifié des données réelles.
  Contrainte non contournée.
- **Même défaut de date ailleurs.** `app/api/fiscalite/tva/route.ts:36-38`
  construit la même borne `-31`. La route appartient au domaine fiscal, hors
  périmètre de ce ticket. Signalée, non corrigée.
- **`reference_piece` conservée.** Colonne réelle mais jamais écrite. Son sort
  relève du nettoyage de schéma, pas de cette réparation.

### Production

Non vérifié. La correction est du code, sans migration : rien à exécuter dans
Supabase. Le contrôle réel suppose la mise en ligne de la branche.

Requête de contrôle, à exécuter dans Supabase pour confirmer les deux corrections
contre les données réelles. Elle reproduit exactement ce que fait la Balance,
sur les cinq mois qui échouaient, et lit la colonne de référence du Grand Livre.

```sql
-- 1. Les deux colonnes du contrat existent, les deux fantômes non
SELECT column_name
FROM   information_schema.columns
WHERE  table_schema = 'public' AND table_name = 'journal_entries'
  AND  column_name IN ('piece_number', 'reference_piece', 'reference', 'journal_type')
ORDER  BY column_name;

-- 2. La période semi-ouverte fonctionne sur les cinq mois qui échouaient
SELECT m.mois,
       count(*)                        AS ecritures,
       coalesce(sum(je.montant), 0)    AS total
FROM   (VALUES (2),(4),(6),(9),(11)) AS m(mois)
LEFT JOIN journal_entries je
       ON je.date_operation >= make_date(2026, m.mois, 1)
      AND je.date_operation <  make_date(2026, m.mois, 1) + INTERVAL '1 month'
GROUP  BY m.mois
ORDER  BY m.mois;
```

La première requête doit renvoyer `piece_number` et `reference_piece`, et
seulement elles. La seconde doit renvoyer cinq lignes sans erreur 22008.

---

## P0-03 — CHAÎNE PAIE → COMPTABILITÉ ROMPUE

**Statut :** CODE PASS — non déployé, non vérifié en production
**Date :** 2026-09-02
**Anomalie couverte :** §6.2 de `docs/RESTART-AUDIT-AZ.md` (classée P0 en §27)

### Anomalie

Depuis la migration 141, générer une paie depuis l'interface ne produit aucune
écriture comptable. `PROJECT_HEALTH.md:213` certifie pourtant « Paie — Argent
définitif ✅ ».

| Chemin | Constat |
|---|---|
| `POST /api/paie/bulletins` | Seule route appelée par `app/dashboard/rh/paie/page.tsx` (l.1512, l.1555). Upsert de `bulletins_paie`, **aucun appel à `emit_accounting_event`** |
| `PATCH /api/rh/paie/[id]` | Émetteur désigné par la migration 141. **Aucun appelant.** Passait le **net en `montant_ttc` sur PAI-001** |
| `POST /api/rh/paie` | Émettait PAI-001 **à la création**, statut `generee`, avant toute validation. **Aucun appelant.** En-tête : « écritures gérées par T9 (migration 136) », trigger supprimé depuis |
| Trigger `trg_bulletins_paie` | Supprimé par `141:262` ; sa recréation n'apparaît que dans le bloc de rollback commenté (`141:333`) |

### Cause racine

**La migration 141 a déplacé la responsabilité comptable du trigger vers les
routes, et a désigné une route que personne n'appelle.** L'interface, elle,
avait sa propre route d'écriture, créée pour contourner un problème RLS
multi-profils, qui ne connaissait pas le moteur.

Trois routes traduisaient chacune à leur manière un bulletin en événement.
Deux étaient fausses par rapport au contrat de la migration :

- **PAI-001 avec `montant_ttc = net`** (`[id]/route.ts:76`). Le module PAI est
  déclaré à impact de trésorerie (`fn_ae_has_treasury_impact`, `138:585`,
  reconduit en `148:75`). Tout événement PAI dont `montant_ttc > 0` crée une
  ligne `transactions` sous `UNIQUE (tenant_id, source, source_id)`
  (`023:82`). La validation consommait donc l'unicité, et le paiement PAI-002
  échouait ensuite en 23505. C'est la signature d'une partie des erreurs
  `transactions_source_unique` relevées en ANO-C08.
- **PAI-001 à la création** (`rh/paie/route.ts:118`). Un bulletin `generee` est
  modifiable ; le constater en charge avant validation fige des montants qui
  peuvent encore changer.

### Consommateurs identifiés

| Consommateur | Chemin | Effet |
|---|---|---|
| Page Paie (bouton « Enregistrer », génération unitaire, modal « Lancer la paie ») | `POST /api/paie/bulletins` | Bulletins écrits, **0 écriture comptable** |
| Balance, Grand Livre, Bilan, Journal | `journal_entries` | Aucune charge de personnel (661/664), aucune dette 421/431/447, aucune sortie 5xx pour la paie |
| Déclarations CNSS / IRPP | `bulletins_paie` | Non affectées : lisent les bulletins, pas la comptabilité |
| Admin APIs (`app/admin/apis/page.tsx:11-12`) | liste `/api/rh/paie` en `status: 'ok'` | Documentation, pas d'appel |

### Dépendances

- Migration 141 déjà appliquée : règles PAI-001 (4 séquences) et PAI-002
  (1 séquence) actives, trigger supprimé. Aucune migration nouvelle.
- `emit_accounting_event` est idempotent par `(tenant_id, event_type,
  source_table, source_id)` sur les statuts `pending/processing/processed`
  (`138:890`). Réémettre est sans effet ; un événement en `error` est réémis
  et retraité.
- D3 (moteur IRPP) reste **BLOCKED** (`docs/R001-FOUNDATION-DECISIONS.md`
  §D3.6). Ce ticket transporte les montants du bulletin tels qu'ils sont ; il
  ne recalcule rien.

### Correction

**Un contrat, trois routes, zéro paramètre en dur.**

`lib/paie/evenements-comptables.ts` (nouveau, fonctions pures) :

- `evenementsComptablesBulletin(tenantId, bulletin, datePaiement)` renvoie les
  événements dus dans le statut courant : `brouillon`/`generee`/`annule` →
  aucun ; `validee` → PAI-001 ; `payee` → PAI-001 puis PAI-002. Un bulletin
  payé réémet la constatation : si la validation n'était jamais passée par le
  moteur, le paiement la rattrape, et le moteur dédoublonne.
- PAI-001 : `montant_ht = brut`, **`montant_ttc = 0`**, `montant_net = net`,
  `metadata = {cnss_patronal, cnss_salarie, irpp, employe_nom, mois, annee}`,
  daté du **dernier jour du mois de paie** (charge rattachée au mois, pas au
  jour du clic).
- PAI-002 : `montant_ttc = net`, `metadata.mode_paiement` (défaut `virement`,
  comme la colonne), daté de `date_paiement` si le bulletin la porte, sinon de
  la date fournie par l'appelant. Le module ne lit pas l'horloge.
- `BULLETIN_COMPTABLE_SELECT` : sélecteur à passer après upsert/update, avec
  jointure `employes(nom)`. `depuisLignePostgrest()` aplatit la ligne.
- Brut ou net négatif, mois invalide, bulletin sans id : `RangeError`. Les
  statuts non comptables ne valident rien.

| Fichier | Avant | Après |
|---|---|---|
| `app/api/paie/bulletins/route.ts` | upsert / update, `{ ok: true }` | upsert / update `.select(BULLETIN_COMPTABLE_SELECT)`, puis émission par ligne ; un échec d'émission renvoie **500** « Bulletins enregistrés, écritures comptables non émises » plutôt que `ok: true` |
| `app/api/rh/paie/[id]/route.ts:65-113` | deux blocs `rpc` avec paramètres en dur, net en `montant_ttc` sur PAI-001 | contrat unique ; erreur rpc renvoyée en 500 au lieu d'être ignorée |
| `app/api/rh/paie/route.ts:116-141` | PAI-001 émis à la création | plus aucune émission ; en-tête corrigé |
| `lib/architecture/loi-k-unique-writer.test.ts:62` | `rh/paie/route.ts` émetteur autorisé | remplacé par `paie/bulletins/route.ts` |
| `docs/LOI-K-UNIQUE-WRITER.md` | PAI-001 décrit « D661/C421 (salaire net) · D646/C431 » | PAI-001 et PAI-002 décrits selon la migration 141 ; émetteurs paie mis à jour |

La garde tenant par ligne (403), le contournement RLS par `service_role` et le
double payload de la page (complet, puis minimal sur erreur de colonne) sont
inchangés. Aucune table créée, aucun trigger rétabli, aucune écriture directe
dans `journal_entries` ni `accounting_events`.

### Tests

| Fichier | Cas |
|---|---|
| `lib/paie/evenements-comptables.test.ts` | 47 — dernier jour des 12 mois, bissextile 2028 / non bissextile 2100, mois hors bornes ; statuts sans événement (6) ; PAI-001 : identité de source, `montant_ht = brut`, `montant_ttc = 0`, metadata des séquences 2-4, date de fin de mois, libellé, cas chiffré de la migration 141 (solde 421 = 954 640) ; PAI-002 : ordre, `montant_ttc = net`, `mode_paiement` et son défaut, priorité de `date_paiement`, même `source_id` ; NUMERIC en chaîne, nuls → 0, négatifs → erreur, id/tenant/mois/date invalides, jointure `employes` en objet, tableau ou absente |
| `lib/architecture/chaine-paie-comptabilite.test.ts` | 32 — chaque colonne du sélecteur existe dans `bulletins_paie` (relevé 007/046/077/118) ; la page n'écrit que par `/api/paie/bulletins` ; cette route appelle le moteur, relit avec le sélecteur après upsert **et** après update, ne renvoie pas `ok:true` sur échec, garde le 403 tenant, n'écrit ni `journal_entries` ni `accounting_events`, est déclarée dans LOI-K ; `[id]` sans paramètres en dur ; `rh/paie` sans émission ; `p_source_table: 'bulletins_paie'` écrit à un seul endroit ; le contrat reproduit les champs lus par les 5 séquences actives de la migration 141 ; PAI-001 sans `montant_ttc` ; trigger supprimé hors rollback |

### Résultats

```
tsc --noEmit      0 erreur
eslint            0 erreur, 111 avertissements (préexistants)
vitest            707 tests, 707 passés, 30 fichiers
next build        exit 0
```

Suite avant P0-03 : 628 tests. Après : 707, soit 79 nouveaux.

### Régressions

Aucune. Les 628 tests antérieurs passent. `loi-k-unique-writer.test.ts`
continue de passer avec la liste d'émetteurs mise à jour. Aucun test modifié
pour obtenir un succès.

### Non couvert, et pourquoi

- **IRPP et CNSS restent calculés dans le navigateur** (`page.tsx:17-21`,
  aggravant relevé en §6.2). D3 est BLOCKED : désigner un moteur serveur
  reviendrait à trancher la question de droit que `R001` refuse de trancher.
  Ce ticket comptabilise ce que le bulletin porte.
- **Annulation d'un bulletin validé** : PAI-005 (extourne) est en `draft`
  dans la migration 141. Un passage `validee → brouillon` par le sélecteur de
  la page ne produit aucune extourne. Signalé, hors périmètre.
- **Acompte non déduit de PAI-001** : PAI-003 est émis à la création de
  l'acompte ; le bulletin retient l'acompte dans `net` mais la dette 421 n'est
  pas ajustée par une séquence dédiée. Question de règle comptable, pas de
  branchement.
- **Rétroplay des bulletins déjà validés/payés sans événement** : ANO-C08,
  ticket distinct. Réenregistrer une paie depuis la page émet désormais ce qui
  manque, mais aucune campagne n'a été lancée.
- **Playwright non exécuté** : `c005-erp-certification.spec.ts` écrit dans la
  base pointée par `.env.local`, qui est la production. Son scénario ERP-2
  insère d'ailleurs ses écritures de paie **en direct** dans `journal_entries`
  (l.809-830) : il ne teste pas cette chaîne.
- **Production non vérifiable dans cette session** : le serveur MCP Postgres
  répond `ENOTFOUND` sur `postgres.mrzixapnaqsbqmagivvf`, les serveurs MCP
  Supabase ne se connectent pas.

### Production

Non vérifié. Aucune migration : rien à exécuter pour déployer. Requête de
contrôle après mise en ligne, à exécuter dans Supabase, pour mesurer l'écart
entre bulletins validés/payés et événements comptables, puis confirmer que les
nouveaux bulletins produisent bien 4 + 1 écritures.

```sql
-- 1. Bulletins validés ou payés sans aucun événement comptable (dette héritée)
SELECT b.statut, count(*) AS bulletins, coalesce(sum(b.net), 0) AS net_total
FROM   bulletins_paie b
WHERE  b.statut IN ('validee', 'payee')
  AND  NOT EXISTS (
         SELECT 1 FROM accounting_events e
         WHERE  e.source_table = 'bulletins_paie' AND e.source_id = b.id
       )
GROUP  BY b.statut;

-- 2. Événements PAI émis après la mise en ligne, par type et statut moteur
SELECT event_type, status, count(*), coalesce(sum(montant_ht), 0) AS ht, coalesce(sum(montant_ttc), 0) AS ttc
FROM   accounting_events
WHERE  event_type IN ('PAI-001', 'PAI-002')
  AND  created_at >= CURRENT_DATE
GROUP  BY event_type, status
ORDER  BY event_type, status;

-- 3. Pour chaque PAI-001 traité aujourd'hui : 4 écritures attendues au plus,
--    aucune ligne transactions (montant_ttc = 0)
SELECT e.id, e.libelle, l.entries_count, l.transaction_id
FROM   accounting_events e
JOIN   accounting_event_log l ON l.event_id = e.id
WHERE  e.event_type = 'PAI-001' AND e.created_at >= CURRENT_DATE
ORDER  BY e.created_at DESC
LIMIT  20;
```

La première requête chiffre la dette héritée (bulletins jamais comptabilisés
depuis la migration 141). La deuxième doit montrer les nouveaux événements en
`processed`. La troisième doit renvoyer `transaction_id` NULL sur tous les
PAI-001 : la sortie de trésorerie n'apparaît que sur PAI-002.

---

## P0-04 — ÉVÉNEMENTS COMPTABLES EN ERREUR ET TRÉSORERIE FANTÔME

**Statut :** EN COURS — migration 175 **appliquée en production le 2026-09-02** (contrôle : liste de modules absente du moteur, version 1.11.0) ; réparation des données en attente de décision
**Date :** 2026-09-02
**Anomalie couverte :** ANO-C08 de `docs/RESTART-AUDIT-AZ.md` (336 événements en `error`, 240 sans message, reprise à l'arrêt)

### Anomalie

Répartition relevée par l'audit : 192 × PAI-001, 96 × FAC-002, 48 × ACH-001,
tous créés le 2026-06-27 entre 16:36 et 17:06 UTC. 96 portent l'erreur 23505
`transactions_source_unique` ; 240 n'ont aucun message et `retry_count = 0`.

### Cause racine

**Deux causes, toutes deux établies par le code.**

**1. La ligne de trésorerie est décidée par module, pas par événement.**
`fn_ae_execute_event` crée une ligne `transactions` dès que
`fn_ae_has_treasury_impact(event_type)` est vrai, et cette fonction ne regarde
que le préfixe (`138:585`, reconduite en `146:94`, `147:101`, `148:75`). FAC-001
(facture émise, 411/706) hérite du module FAC et crée une **entrée de caisse
du TTC à l'émission**, avant tout encaissement. Le règlement FAC-002, seul
événement FAC qui touche 5xx, échoue ensuite sur `UNIQUE (tenant_id, source,
source_id)` (`023:82`) : ce sont les 96 erreurs 23505. Même mécanique pour
ACH-001 → ACH-002, SAN-001 → SAN-002, AGR-001 → AGR-002, et PAI-001 → PAI-002
dès que `montant_ttc > 0` (côté routes, corrigé en P0-03). Le document de
conception prévoyait l'inverse : « Trésorerie — géré par FAC-002 »
(`docs/plan-directeur/migration-139-facturation-fac.md:43`). Les 22 émetteurs
passent un `montant_ttc` sur des constatations (FAC-001, ACH-001, SAN-001,
AGR-001, STK-001/002) : le défaut est dans le moteur, pas dans les routes.

La synchronisation des soldes (`fn_sync_tresorerie_soldes`) suit la même
liste (`'TRE','MOB','FAC','SAN','RES','ECO'`) : jamais appelée pour PAI-002,
ACH-002, BOI, HOT, ONG, BTP, AGR, qui touchent pourtant 521/571.

**2. Les 240 événements sans message ne viennent pas du moteur.** Son
gestionnaire d'exception écrit toujours `SQLERRM || SQLSTATE` et incrémente
`retry_count` (`142.5:173-178`). Un statut `error` avec message nul et
`retry_count = 0` ne peut résulter que d'un UPDATE direct. Or 240 = 192 + 48,
soit exactement les PAI-001 et ACH-001 que `scripts/seed-demo-data.ts`
ré-émet dans ses sections K0 et K0b « pour bulletins/achats existants », avec
ce commentaire : *« events en statut 'error' après reset → ON CONFLICT ne
bloquera plus »* (`seed-demo-data.ts:475`). Le script cible **le tenant le
plus ancien de la base** (`getTenantId()`, `.order('created_at').limit(1)`)
et lit `.env.local`, qui pointe la production. La campagne du 27 juin est
l'exécution de ce script : 192 bulletins, 192 factures, 48 achats, 192
transactions, 96 mouvements de stock, 8 employés, 30 fournisseurs et 3
comptes bancaires de démonstration, sur un tenant de production. Les
originaux ont été basculés en `error` à la main pour contourner
`uidx_ae_inflight`, puis ré-émis.

Corollaire : les 339 474 246 FCFA « bloqués » de l'audit sont des montants de
démonstration. Le défaut n°1, lui, touche toute facture réelle émise avec un
TTC depuis la migration 139.

### Consommateurs identifiés

| Consommateur | Effet du défaut n°1 |
|---|---|
| `transactions` (journal de caisse), `fn_finance_kpis` (migration 150, CA de repli sur `transactions.type='entree'`), page Finance | Encaissement compté à l'émission de la facture ; règlement jamais enregistré |
| `PATCH /api/factures/[id]` statut `payee` | FAC-002 en `error` 23505, silencieusement (la route ne lit pas le retour du rpc) |
| `PATCH /api/achats` statut `paye`, `SAN-002`, `AGR-002` | Idem |
| `comptes_bancaires.solde`, `caisses.solde`, `mobile_money_wallets.solde_actuel` | Non resynchronisés après PAI-002, ACH-002, BOI, HOT, ONG, BTP, AGR |

### Correction — partie 1, moteur (écrite, non appliquée)

`supabase/migrations/175_treasury_impact_from_rules.sql` : `CREATE OR REPLACE`
de `fn_ae_execute_event`, corps identique à 142.5 hors bloc trésorerie.

- Pendant la boucle des règles, chaque séquence dont `account_resolver` vaut
  `treasury_debit` s'accumule en entrée, `treasury_credit` en sortie.
- La ligne `transactions` n'est créée que si une telle séquence a été
  appliquée, pour le solde (entrée − sortie), sens par le signe, rien si nul.
  FAC-001, ACH-001, SAN-001, AGR-001, PAI-001, STK-* n'en créent plus jamais,
  quel que soit leur `montant_ttc`.
- `fn_sync_tresorerie_soldes` est appelée dans ce même cas, sans liste.
- `accounting_event_log.rules_snapshot` porte `treasury_in` / `treasury_out`.
- Version moteur 1.11.0. `fn_ae_has_treasury_impact` et `fn_ae_is_income`
  restent définies, plus consultées par le moteur.

Aucune donnée modifiée par la migration. Aucune route touchée.

### Correction — partie 2, données (à faire après diagnostic)

Bloquée tant que la production n'a pas répondu à trois questions : quel est le
tenant le plus ancien (démo ou client réel), les 240 originaux ont-ils laissé
des écritures `journal_entries` (double comptabilisation), et combien de
lignes `transactions` fantômes ont été créées par des constatations sur des
tenants réels. Le SQL de diagnostic est remis à l'utilisateur ; la réparation
(suppression des lignes fantômes référencées par `accounting_event_log`, puis
`fn_ae_retry_errors` + `fn_ae_process_pending` sur les 96 FAC-002) sera écrite
sur ces chiffres, en bloc distinct, avec aperçu préalable.

### Tests

| Fichier | Cas |
|---|---|
| `lib/architecture/moteur-tresorerie-regles.test.ts` | 28 — la dernière définition du moteur est celle de 175 ; elle ne consulte plus `fn_ae_has_treasury_impact` ni `fn_ae_is_income` ; accumulation debit/credit ; ligne `transactions` conditionnée au solde de trésorerie ; sync des soldes sans liste ; garde-fous 142.5 conservés (CAS, pays, message d'erreur, `retry_count`) ; audit `treasury_in/out` ; catalogue : 7 constatations sans résolveur de trésorerie, 12 mouvements de caisse avec le bon résolveur ; la migration ne contient ni DELETE ni UPDATE hors moteur ; version 1.11.0 |

### Résultats

```
tsc --noEmit      0 erreur
vitest            735 tests, 735 passés, 31 fichiers
```

Suite avant P0-04 : 707 tests. Après : 735, soit 28 nouveaux.

### Non couvert, et pourquoi

- **Reprise automatique.** Aucun appel à `fn_ae_retry_errors` ni
  `fn_ae_process_pending` n'existe dans le code ni dans les crons Vercel. Le
  trigger traite les événements de façon synchrone, donc `pending` est rare ;
  une reprise automatique des `error` rejouerait aussi les vrais doublons.
  Reprise laissée manuelle, à documenter après la partie 2.
- **Les routes ignorent le retour de `emit_accounting_event`.** Un événement
  en `error` reste invisible de l'appelant. Traité route par route dans les
  tickets qui les touchent (P0-03 pour la paie) ; généralisation en P1.
- **Le script de démonstration reste exécutable contre la production.** Il
  lit `.env.local` et choisit le tenant le plus ancien. Verrou à poser en
  phase 0.1 (environnement de recette), hors périmètre.

### Production — diagnostic exécuté par l'utilisateur (2026-09-02)

| Question | Réponse |
|---|---|
| Tenant le plus ancien | `b93b7c3d-815b-4336-bbb2-ac24cda0edb2` · **AMD FINANCE** · créé le 2026-06-10 · 192 bulletins, 192 factures, 48 achats, 771 événements sur 26 tenants |
| Les 336 erreurs | Toutes sur ce tenant, toutes du 2026-06-27 : 48 × ACH-001 et 192 × PAI-001 `retry=0` **sans message**, 96 × FAC-002 `retry=1` `duplicate key … transactions_source_unique` |
| Les 240 sans message | **240 sur 240 ont un journal d'audit et des écritures** : traités, puis basculés à la main en `error`, puis ré-émis. Les écritures existent donc **deux fois** pour ces 192 bulletins et 48 achats |
| Lignes de caisse fantômes | 192 lignes `transactions` de type **sortie**, 628 344 885 F, créées par FAC-001 sur ce tenant. Aucune sur un autre tenant |
| Moteur | 142.5 appliquée (`ec.pays`). **Migration 148 non appliquée** : version 1.9.0, aucune règle BTP/AGR, `fn_ae_is_income('FAC-001') = false`, `fn_ae_has_treasury_impact('BTP-001') = false`. Seul trigger : `trg_process_accounting_event` |

Conséquences :

- Les 771 événements de la base sont tous sur le tenant de démonstration.
  Aucun tenant réel n'a encore émis d'événement comptable : le défaut n°1 n'a
  pas encore corrompu de trésorerie réelle, il le fera à la première facture
  réglée.
- La direction `sortie` sur FAC-001 confirme l'absence de 148 : une facture
  émise était comptée comme un **décaissement** du TTC.
- Les routes `app/api/btp/chantiers` et `app/api/agriculture/recoltes`
  émettent BTP-001/002 et AGR-001 sans qu'aucune règle n'existe en base : ces
  événements sont marqués `processed` avec zéro écriture. Migration 148 à
  appliquer, ticket distinct (migrations non appliquées, ANO-P04/§G).
- Réparation des données : uniquement sur `b93b7c3d`. Suppression des 192
  lignes de caisse fantômes et des écritures dupliquées des 240 originaux,
  puis rejeu des 96 FAC-002 après application de 175. Décision préalable de
  l'utilisateur : AMD FINANCE est-il un client réel ou un tenant de
  démonstration ?

### Décision de l'utilisateur et découverte supplémentaire (2026-09-02)

**AMD FINANCE est un client réel** (maison mère d'Oraforme), utilisé aussi pour
les tests, propriétaire des comptes super-admin. L'espace `/admin` est réservé
par liste d'e-mails (`proxy.ts:49`), pas par tenant : le tenant se comporte
comme tout autre, aucun code à changer. La réparation est donc chirurgicale et
réversible : `supabase/migrations/176_repair_p0_04_amd_finance.sql` archive
chaque ligne supprimée dans `repair_archive`, ne touche ni factures, ni
bulletins, ni achats, ni saisies directes, et refuse de s'exécuter si l'état
diffère du diagnostic.

**Nouvelle anomalie, hors audit — triggers hérités sur `transactions`.** Trois
triggers `AFTER INSERT ON transactions` n'ont jamais été supprimés :
`trg_auto_journal_entry` (`027:136`, fonction `fn_auto_journal_entry` sans
aucune garde) écrit une écriture `journal_entries` avec des comptes devinés par
mot-clé de catégorie (`571000/709000` par défaut) ; `trg_transaction_to_journal`
(`023:156`) écrit dans le registre legacy `journal_comptable` ;
`trg_update_account_balance` (`023:179`) touche `accounts`. Depuis la migration
138, le moteur insère lui-même dans `transactions` pour chaque mouvement de
caisse : **chaque règlement FAC-002, PAI-002, RES-001, ECO-001… produit alors
une seconde écriture de trésorerie**, et les soldes 521/571 recalculés depuis
`journal_entries` sont doublés. Cinq pages (`tresorerie/*`, `ecole/rh`)
insèrent dans `transactions` **et** appellent `writeComptaEntry` : trois
écritures pour une opération. Deux pages (`transport`, `ecole/comptabilite`)
n'ont que le trigger comme chemin comptable.

Présence en production à confirmer (`pg_trigger`). Le bloc 176 s'interrompt
tant que ces triggers existent ; leur neutralisation fera l'objet de la
migration 177 (garde : ignorer toute ligne `transactions` dont le couple
`(source, source_id)` correspond à un `accounting_events`).

### Diagnostic complémentaire (2026-09-02) — triggers et doublons

| Question | Réponse |
|---|---|
| Triggers sur `transactions` en production | **Seul `trg_update_account_balance` est actif.** `trg_auto_journal_entry` et `trg_transaction_to_journal` (migrations 023/027) n'existent pas en production ; aucune écriture `journal_entries` n'a `transactions.id` pour `source_id`. Le dépôt et la production divergent (ANO-P04) : la migration 177 alignera le dépôt en supprimant ces deux triggers, sans effet en production |
| Registre legacy `journal_comptable` | 4 lignes |
| Écritures d'AMD FINANCE par source | FAC-001 : 192 × (emises, tva, ca), une seule fois. **PAI-001 : 192 par séquence, pas 384 — pas de doublon** : les originaux ont été traités avant les règles 141, donc sans écriture. **ACH-001 : 48 `achats_enregistrement` + 48 `achats_fournisseurs`, 25 086 000 F chacun — doublon confirmé**, sous deux libellés de règle (les libellés en production ne sont pas ceux de la migration 147) |

Le bloc 176 a été resserré : une écriture d'origine n'est retirée que si sa
ré-émission a produit la sienne, intacte (table temporaire `tmp_originaux`) ;
garde supplémentaire : chaque original doit avoir une ré-émission traitée.
Attendu : 192 lignes de caisse et 48 écritures archivées, 96 FAC-002 traités.

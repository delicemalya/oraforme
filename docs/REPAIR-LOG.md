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

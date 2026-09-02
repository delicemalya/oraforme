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

# R-001 — FOUNDATION DECISIONS

**Date :** 2026-09-01 · **Commit :** `0971c4f` · **Mode :** DIAGNOSTIC — aucun code modifié, aucune migration, aucun changement de base.
**Rapports de référence :** `docs/RESTART-AUDIT-AZ.md`, `docs/MIGRATION-MAP-AZ.md`

---

## PRÉAMBULE — CE QUE JE PEUX ET NE PEUX PAS TRANCHER

Les quatre décisions ne sont pas de même nature, et il serait malhonnête de les présenter au même niveau de certitude.

| Décision | Nature | Puis-je trancher ? |
|---|---|---|
| **D1 — facture_lignes** | Architecture technique | **OUI** — les preuves internes suffisent |
| **D2 — stock** | Architecture technique | **OUI, sous réserve** — voir §D2 |
| **D3 — IRPP Congo** | **Question de droit fiscal** | **NON** — exige le texte du CGI congolais |
| **D4 — TVA Congo** | **Question de droit fiscal** | **NON** — exige le texte du CGI congolais |

Pour D3 et D4, je peux établir **pourquoi** les moteurs divergent, **ce que chaque source revendique**, et **quelles questions précises poser**. Je ne peux pas déterminer la règle applicable : je n'ai pas accès au Code Général des Impôts congolais ni à la Loi de Finances 2026. Conformément à votre règle absolue — *aucun « estimé », aucun choix par cohérence CEMAC* — je m'y refuse explicitement.

---

# D1 — FACTURE_LIGNES

## D1.1 État actuel

✅ **VÉRIFIÉ EN PRODUCTION — les lignes de facture ne sont stockées nulle part.**

| Emplacement candidat | État réel |
|---|---|
| Table `facture_lignes` | **N'EXISTE PAS** — `GET /rest/v1/facture_lignes` → `404 PGRST205` |
| Colonne `factures.items` (jsonb, NOT NULL) | **EXISTE mais VIDE sur les 198 factures** — 0 ligne stockée au total |

Mesure exacte sur les 198 factures de production :
```
items VIDE (null ou [])  : 198
items REMPLI             :   0
total de lignes stockées :   0
```

## D1.2 Qui écrit ?

**`factures.items` : PERSONNE.** ✅ VÉRIFIÉ — aucun `insert`/`update` de `factures` ne mentionne `items` dans `app/`, `components/`, `lib/`.

**`facture_lignes` : 4 sites, tous en échec** (la table n'existe pas) :
- `app/api/factures/route.ts:87` — insert **sans contrôle d'erreur** → perte silencieuse
- `app/dashboard/facturation/page.tsx:493` (édition), `:511` (création), `:588` (avoir) — erreur **affichée** à l'utilisateur (`:512`)

## D1.3 Qui lit ?

Deux chemins, tous deux construits selon le **même patron** : `facture_lignes` en source primaire, `items` en repli.

`app/api/factures/[id]/pdf/route.ts:70-77` :
```ts
lignes: (lignes ?? []).length > 0
  ? (lignes ?? [])                          // ← facture_lignes : PRIMAIRE
  : (facture.items ?? []).map((it: { description: string; prix_unitaire: number; quantite: number }) => ({
      description: it.description, price: it.prix_unitaire, quantity: it.quantite, ...
    })),                                     // ← items : REPLI LEGACY
```
`app/dashboard/factures/[id]/preview/page.tsx:110-119` : structure identique (`if (ls && ls.length > 0) … else if (f.items) …`).

**Ce patron est la réponse à la question posée.** Le code ne considère pas `items` comme une alternative de conception : il le traite comme un format hérité qu'il sait lire pour compatibilité. Les deux vocabulaires le confirment — `items` emploie `prix_unitaire`/`quantite` (français), les tables de lignes emploient `price`/`quantity`/`total` (anglais). Deux époques, pas deux options.

## D1.4 La preuve décisive : la migration existe et n'a été appliquée qu'à moitié

`supabase/migrations/010_facturation_v2.sql`, ligne 23 — le commentaire est explicite :

> `-- Lignes de facture (remplace le champ items JSONB)`

```sql
CREATE TABLE IF NOT EXISTS facture_lignes (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_id  UUID REFERENCES factures(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  price       NUMERIC(12,0) NOT NULL DEFAULT 0,
  quantity    INTEGER NOT NULL DEFAULT 1,
  total       NUMERIC(12,0) NOT NULL DEFAULT 0
);
```
La migration fournit aussi les 4 policies RLS (`:57-65`) et l'index `idx_fac_lignes_invoice` (`:74`).

**État d'application réel, vérifié objet par objet en production :**

| Objet de la migration 010 | Ligne | En production |
|---|---|---|
| `CREATE TABLE entreprise_config` | 34 | ✅ **EXISTE** (1 ligne) |
| `CREATE TABLE facture_lignes` | 24 | ❌ **ABSENTE** (404) |
| `ALTER TABLE factures ADD COLUMN invoice_number` | 7 | ❌ ABSENTE (400) |
| `… client_name, client_address, client_phone` | 8-10 | ❌ ABSENTES |
| `… date, due_date, subtotal, ca, footer_text, notes` | 11-16 | ❌ ABSENTES |

`entreprise_config` n'est créée par **aucune autre migration** (`grep` sur les 170 fichiers → seule la 010). Donc la migration 010 **a bien été exécutée — mais partiellement**, très probablement par copier-coller sélectif dans l'éditeur SQL Supabase. C'est l'illustration la plus nette de la cause racine CR-1.

## D1.5 Le précédent interne est unanime

| Table de lignes | Existe en production ? |
|---|---|
| `devis_lignes` | ✅ |
| `vente_lignes` | ✅ |
| `purchase_items` | ✅ |
| `his_lignes_facture` | ✅ |
| `htl_invoice_lines` | ✅ |
| `pharmacie_vente_lignes` | ✅ |
| **`facture_lignes`** | ❌ **la seule manquante** |

`devis_lignes` est le précédent le plus proche — même domaine, même migration d'origine, **schéma identique** (`id, devis_id FK, description, price, quantity, total`) — et il fonctionne : `app/dashboard/devis/page.tsx` y fait 8 opérations, dont un `delete`+`insert` transactionnel à l'édition (`:276-277`) et la duplication (`:357-361`).

## D1.6 Impact production

**Aucune facture n'a jamais été créée par l'interface.** ✅ VÉRIFIÉ :
- Les 198 factures appartiennent à 2 tenants (192 pour AMD FINANCE, `suspended`) et portent 54 noms de clients qui figurent **littéralement dans `scripts/seed-demo-data.ts:97-99`** (`Logistique Afrique`, `Import-Export Brazza`, `Sucraf Congo`…). Ce sont des **données de démonstration**.
- Dernière facture en base : **2026-06-29**. Aucune depuis, soit plus de 2 mois.
- Le code d'insertion (dashboard `:501-507` et route API `:60-79`) écrit **9 colonnes inexistantes** (`invoice_number`, `client_name`, `client_address`, `client_phone`, `date`, `due_date`, `subtotal`, `ca`, `notes`). PostgREST rejette l'INSERT entier dès qu'une colonne est inconnue → **la création de facture est impossible aujourd'hui, par les deux chemins.**
- Ce code et la migration 010 ont été écrits **dans le même commit, `f757c5e` du 2026-05-12**. La rupture date donc de la mise en production partielle de cette migration.

**Conséquence pour la décision : il n'y a aucune donnée à migrer.** Zéro ligne de facture existe, sous aucune forme.

## D1.7 Ce que JSONB coûterait ici

Je le documente pour l'exhaustivité, mais la question est déjà tranchée par D1.4 et D1.6.

| Besoin | Table relationnelle | `items` jsonb |
|---|---|---|
| Intégrité référentielle (`ON DELETE CASCADE`) | native | à la charge du code |
| RLS sur les lignes | policies déjà écrites (`010:57-65`) | héritée de `factures`, non granulaire |
| Agrégation analytique (top produits, marge par ligne) | SQL standard | `jsonb_array_elements` sur chaque ligne, non indexable simplement |
| Cohérence avec les 6 autres tables de lignes | totale | rupture de convention |
| Réconciliation ligne ↔ écriture comptable | FK possible | impossible sans identifiant stable de ligne |
| Édition partielle d'une ligne | `UPDATE … WHERE id` | réécriture du document entier (perte concurrente) |
| Contrainte `NOT NULL` sur `description` | native | aucune |

Le seul avantage réel de JSONB — figer le document tel qu'émis — n'est pas ce que le code cherche : `facturation/page.tsx:491-493` **supprime puis réinsère** les lignes à chaque édition, ce qui est un comportement de table relationnelle, pas d'archive immuable.

## D1.8 DÉCISION RECOMMANDÉE — **`facture_lignes` (table relationnelle)**

**Statut : READY.**

**Justification, par ordre de force probante :**
1. La migration `010:23` déclare textuellement l'intention : *« Lignes de facture (remplace le champ items JSONB) »*. La décision a déjà été prise par l'équipe ; elle n'a pas été exécutée.
2. Les deux chemins de lecture traitent `facture_lignes` comme primaire et `items` comme repli.
3. Six tables de lignes sur sept existent déjà. `facture_lignes` est un oubli d'exécution, pas un choix.
4. Aucun code n'écrit `items` : le format n'a jamais été adopté.
5. Coût de migration de données : **nul** — aucune ligne n'existe.

**Ce que je ne recommande pas :** aligner le code sur le schéma actuel (supprimer `facture_lignes` et écrire dans `items`). Cela demanderait de réécrire 6 fichiers, de rompre avec les 6 autres tables de lignes, de perdre la RLS granulaire déjà écrite, et de contredire l'intention documentée — pour un format que personne n'a jamais alimenté.

## D1.9 Plan de migration

**Le problème est plus large que `facture_lignes` : c'est la migration 010 entière qui doit être achevée.** Créer la table seule ne réparera pas la création de facture, puisque l'INSERT échouera toujours sur les 9 colonnes manquantes.

| Étape | Action | Vérification |
|---|---|---|
| 1 | En **recette** : exécuter la partie non appliquée de `010_facturation_v2.sql` (lignes 6-31, 56-65, 74-77) | `facture_lignes` répond 200 ; les 10 colonnes de `factures` répondent 200 |
| 2 | Arbitrer les doublons sémantiques introduits : `client_name` **vs** `client_nom` existant, `subtotal` **vs** `montant_ht` existant, `date` **vs** `created_at` | Décision documentée ; le code n'écrit qu'un seul des deux |
| 3 | Ajouter le contrôle d'erreur manquant à `app/api/factures/route.ts:87` | Une erreur d'insertion de lignes fait échouer la création, ou est remontée |
| 4 | Rejouer en recette : création, édition, avoir, PDF, conversion devis→facture | Les lignes apparaissent sur le PDF |
| 5 | Décider du sort de `factures.items` — **ne pas supprimer la colonne** : la garder `NOT NULL DEFAULT '[]'` et conserver le code de repli tant qu'aucune donnée héritée n'est certifiée absente | Le repli reste fonctionnel |
| 6 | Production : même exécution, après validation en recette | Idem étape 4 |

⚠️ **L'étape 2 est un point de vigilance, pas une formalité.** La migration 010 ajoute `client_name` alors que `client_nom` existe déjà et porte les données, et `subtotal` alors que `montant_ht` existe. L'appliquer telle quelle crée **quatre paires de colonnes redondantes**. Il faut décider laquelle fait foi **avant** d'exécuter, sinon on institutionnalise une nouvelle source de vérité double.

## D1.10 Tests nécessaires

| # | Test | Nature | Existe ? |
|---|---|---|---|
| 1 | Créer une facture à 3 lignes → 3 lignes en base, et le PDF les affiche | E2E | **non** |
| 2 | Éditer une facture → aucune ligne orpheline (`delete` + `insert`) | intégration | **non** |
| 3 | Supprimer une facture → cascade sur `facture_lignes` | intégration | **non** |
| 4 | `Σ(quantity × price) == factures.montant_ht` | invariant | **non** |
| 5 | Un utilisateur du tenant A ne lit pas les lignes du tenant B (RLS) | sécurité | **non** |
| 6 | Toute colonne écrite par le code existe en base | **test de schéma** — préviendrait toute la classe de bugs ANO-M16/M17/M19 | **non** |
| 7 | Une facture au format `items` hérité s'affiche toujours (non-régression du repli) | intégration | **non** |

Le **test 6** est le plus rentable : un test qui compare les colonnes écrites par le code au schéma réel aurait détecté cette anomalie le 2026-05-12.

---

# D4 — TVA CONGO

## D4.0 La question était mal posée — et c'est le résultat le plus utile

**18,9 % n'est pas un taux concurrent de 18 %. C'est un taux composé.** Le code le dit explicitement, à trois endroits indépendants :

`lib/countries/CG.ts:39-55` :
```ts
tva: {
  taux_normal: 0.18,
  taxes_additionnelles: [
    { code: 'CA', libelle: "Centime Additionnel (Contribution d'Appui)",
      taux: 0.05, base: 'tva_collectee' },     // ← 5 % DE LA TVA, pas du HT
  ],
  taux_effectif_sur_ht: 0.189,                 // ← 18 % × 1,05
```
`lib/fiscalite-congo.ts:120-123` : `taux_normal: 0.18` · `taux_ca: 0.05 // 5% des 18%` · `taux_effectif_ht: 0.189`.
`lib/accounting-engine.ts:329-343` : `TVA_RATE = 0.18`, `CA_RATE = 0.05`, et `htFromTTC(ttc) = ttc / (1 + TVA_RATE + TVA_RATE * CA_RATE)`.

**Aucune définition du dépôt n'assoit le CA sur le HT.** La preuve la plus forte est `lib/audit/engine.ts:291-294`, seul endroit qui traite 1,189 comme une **dérivée** et non comme une constante :
```ts
// Diviseur TVA dynamique selon le pays du tenant (ex. CG: 1 + 0.18 + 0.18*0.05 = 1.189)
const hisDivisor = 1 + paysCfg.tva.taux_normal * (1 + (taxeCA?.taux ?? 0))
```

**Conséquence : remplacer 18,9 par 18 serait une erreur.** Les deux valeurs s'appliquent à des grandeurs différentes — 0,18 est un taux d'assiette (HT → TVA), 0,189 un facteur de conversion agrégé (HT → TVA+CA). Le vrai défaut est ailleurs.

## D4.1 Le vrai défaut : le compte 4441 porte deux sémantiques incompatibles

✅ **VÉRIFIÉ** — j'ai relevé ce que chaque module passe à `p_montant_tva` (le montant écrit au compte 4441, « État — TVA collectée ») :

| Module | `p_montant_tva` | Contient le CA ? |
|---|---|---|
| **Facturation** `app/api/factures/route.ts:115` | `tva` | **NON** — le CA part dans `p_metadata.ca` (`:120`) |
| `app/api/factures/[id]/route.ts:89` | `tva` | NON |
| `app/api/resto/commandes/route.ts:94` | `fiscal.tva + fiscal.ca` | **OUI — fusion explicite** |
| `app/api/btp/chantiers/route.ts:66` | `montantHT * 0.189` | **OUI** |
| `app/api/btp/chantiers/route.ts:117` | `montantTTC - montantHT` (TTC = HT × 1,189) | **OUI** |
| `app/api/hotel/payments/route.ts:84` | dérivé de `TTC / 1.189` | **OUI** |
| `app/api/boisson/tournees/route.ts:96` | dérivé de `TTC / 1.189` | **OUI** |
| `app/api/sante/consultations/route.ts:159` · `sante/facturation/route.ts:101` | dérivé de `TTC / 1.189` | **OUI** |

**Le même compte 4441 reçoit donc, selon le module d'origine, soit la TVA seule, soit la TVA + le centime.** Ce n'est pas une divergence de taux : c'est une divergence de **définition de la grandeur stockée**. Aucun agrégat construit sur ce compte ne peut être juste.

La migration `146_accounting_rules_boisson.sql:184` documente la fusion sans la questionner : *« 4441=État, TVA collectée. Congo: TTC=HT×1.189 (TVA18%+CA0.9%) »*.

## D4.2 Conséquence chiffrée : la déclaration de TVA surestime de 5 %

La chaîne, vérifiée ligne à ligne :

1. `app/api/fiscalite/tva/route.ts:47` — `computeTVAFromJournal(allEntries, annee)` agrège le **crédit du compte 4441**.
2. `:59` — le résultat est passé à `calculerTVA(mp.tva_collectee, mp.tva_deductible, pays)`.
3. `lib/fiscalite/engine.ts:20` — `const ca_ht = tvaCollectee / tvaCfg.taux_normal` → divise par **0,18** un montant qui, pour les modules sectoriels, vaut déjà **18,9 %** du HT.
4. `:24` — `taxes['CA'] = tvaCollectee * 0.05` → **rajoute le centime une seconde fois**.
5. `:29` — `total_a_payer = Math.max(tva_nette, 0) + total_taxes_add`.

Sur 100 000 F HT passés par un module sectoriel :
```
écrit au 4441            : 18 900   (TVA 18 000 + CA 900)
ca_ht reconstitué        : 18 900 / 0,18 = 105 000   (au lieu de 100 000 → +5 %)
CA recalculé             : 18 900 × 0,05 = 945       (au lieu de 900)
total_a_payer            : 18 900 + 945 = 19 845     (au lieu de 18 900)
```
**Surestimation de 945 F sur 100 000 F de chiffre d'affaires, soit +5 % sur la TVA déclarée** — pour tout flux issu de l'Hôtel, la Santé, le BTP, la Boisson ou le Restaurant. Les flux issus de la Facturation, eux, sont corrects.

⛔ **Non exécuté** — ce calcul est déduit de la lecture du code, pas d'un appel réel à la route.

## D4.3 Autres constats

**Erreur arithmétique certaine** — `lib/fiscalite/pays.ts:54` : *« TVA 18% + Centime Additionnel 5% sur TVA = total 19.8% sur HT »*. **18 × 1,05 = 18,9**, pas 19,8. Chaîne d'affichage seulement, non consommée par un calcul : impact = désinformation de l'utilisateur.

**Omission franche du centime** (et non fusion) dans deux écrans : `app/dashboard/finance/page.tsx:1080-1081` (`round(entrees * 0.18)`) et `app/dashboard/cabinet/clients/[id]/page.tsx:211,815` (affiche « TVA 18% » sans ligne CA).

**Trois dénominations pour un même prélèvement** : « Centime Additionnel » (`CG.ts:44`), « Contribution d'Appui » (`pays.ts:18`), « Contribution Apprentissage » (`migrations/142:115`).

**Formulation fausse dans deux migrations** — `131_sante_tva_normalisation.sql:63` écrit *« 18.9 % du TTC »* ; c'est 18,9 % **du HT** (du TTC ce serait 15,896 %).

**La facturation client est la référence saine** : `app/api/factures/route.ts:55` → `calculerTVACongo(ht)` (`lib/fiscalite-congo.ts:309-318`, deux arrondis distincts : `tva = round(HT × 0,18)` puis `ca = round(tva × 0,05)`), et le PDF imprime **deux lignes** — `TVA (18 %)` et `CA (5 % de la TVA)` (`components/facture/FacturePDF.tsx:255,259`). La déclaration générale attend d'ailleurs cette structure : `lib/declarations/declaration-generale.ts:78-79` produit `l3_tva` **et** `l3_tva_centimes` séparément.

**Tests existants** — la décomposition est verrouillée par deux tests : `lib/fiscal/universal-tax-engine.test.ts:267-273` (100 000 HT → `tva_base` 18 000, CA 900, total 18 900) et `lib/scenarios/business-scenarios.test.ts:76-99`. **Aucun test ne couvre les 6 routes sectorielles ni la chaîne `/api/fiscalite/tva`.**

## D4.4 Statut : **BLOCKED**

Ce que les preuves établissent est solide : la structure (18 % + 5 % sur la TVA) est cohérente et testée, et le défaut est un **mélange de sémantiques au compte 4441** plus un **double comptage dans la déclaration**. Mais je ne peux pas clore la décision, car deux questions de droit conditionnent la solution.

**Questions à faire trancher par un fiscaliste ou la DGI Congo — je ne les trancherai pas :**

1. **Assiette du centime** — est-il assis sur la TVA **collectée brute** ou sur la **TVA nette due** (après imputation de la TVA déductible) ? `lib/fiscalite/engine.ts:24` retient la collectée ; `app/dashboard/finance/page.tsx:1115` affirme le contraire (« CA = 5 % × TVA nette »). Les deux ne peuvent être vrais, et l'écart n'est pas neutre.
2. **Le centime payé en amont est-il déductible ?** `lib/miaa-fiscal-academy.ts:95` applique 18,9 % aux achats pour calculer la TVA déductible. Si le CA amont n'est pas déductible, le taux applicable aux achats est 18 %, pas 18,9 %.
3. **Structure déclarative** — la DGI exige-t-elle deux lignes (principal / centimes), comme le suppose `declaration-generale.ts:78-79` ? Si oui, l'écriture fusionnée au 4441 est-elle recevable en contrôle, ou faut-il un sous-compte distinct pour le CA ?
4. **Arrondis** — deux arrondis successifs (TVA puis CA, méthode facturation) ou un seul sur le total (méthode ÷ 1,189) ? L'anomalie A007 déjà tracée dans `docs/F004-ESC01-CERTIFICATION.md:982` découle exactement de cette question.
5. **Taux réduit** — `fiscalite-congo.ts:313-315` applique aussi le CA de 5 % au taux réduit véhicules (5 % → effectif 5,25 %). Le centime s'applique-t-il aux opérations à taux réduit ?
6. **Article de référence** — les moteurs ne citent que « Art. confirmé LF 2026 ». Seul `lib/textes-fiscaux.ts:16` avance « Art. 277 à 344 CGI Congo » — et ce fichier est mort (0 importeur).

## D4.5 Ce qui peut avancer sans attendre le fiscaliste

Trois actions ne dépendent d'aucune réponse juridique :

| # | Action | Justification |
|---|---|---|
| 1 | **Décider de la sémantique du compte 4441** (TVA seule, avec le CA dans un sous-compte) et aligner les 6 routes sectorielles sur la facturation | Défaut interne de cohérence, indépendant du droit |
| 2 | **Corriger `lib/fiscalite/pays.ts:54`** — « 19.8 % » → 18,9 % | Erreur arithmétique certaine |
| 3 | **Lire `accounting_fiscal_params`** — la table contient **14 lignes en production** et n'est lue par aucun code (`grep` → 0). C'est le mécanisme de versionnement fiscal déjà en base, inactif. C'est là que la règle datée devra vivre. | Prérequis structurel à toute règle versionnée |

---

# D2 — STOCK

## D2.1 État actuel : quatre sources de vérité, pas deux

La question posée oppose `products.stock_actuel` à `stock_movements`. La réalité est plus large :

| # | Mécanisme | Porteur de la quantité | État vérifié |
|---|---|---|---|
| S1 | Colonne dénormalisée recalculée **côté client** | `products.stock_actuel` | **La colonne n'existe pas** — et **aucune migration du dépôt ne l'a jamais créée** (§D2.4) |
| S2 | Agrégation des mouvements | `stock_movements.quantite` | Table réelle, **96 lignes, 10 produits**. Fonction `get_product_stock()` présente en production. |
| S3 | Colonne maintenue par **trigger SQL** | `stock_articles.quantite` (resto), `pharmacie_medicaments.stock_actuel` | **Fonctionne** — seuls décréments atomiques du projet |
| S4 | Solde comptable classe 3 | `journal_entries`, comptes `31x` | Alimenté par STK-001/002 — mais voir §D2.5 |

Le module Stocks vise S1 → inopérant. Le Restaurant et la Pharmacie visent S3 → fonctionnent. Le bilan lit S4. **Trois quantités qui ne peuvent structurellement pas coïncider.**

## D2.2 La découverte décisive : la seule fonction correcte renvoie 0

✅ **VÉRIFIÉ EN PRODUCTION.** `get_product_stock()` existe et est appelée correctement par le code (`app/api/stock/move/route.ts:24` et `app/api/stock/[id]/route.ts:18`, tous deux avec `{ p_id }`). Résultat réel :

```
Fournitures bureau       get_product_stock = 0   |  réel : entrées 160, sorties 12  → solde 148
Matériel informatique    get_product_stock = 0   |  réel : entrées 125, sorties 60  → solde  65
Mobilier de bureau       get_product_stock = 0   |  réel : entrées 160, sorties 15  → solde 145
Consommables impression  get_product_stock = 0   |  réel : entrées 145, sorties 60  → solde  85
```

**Cause racine, à la ligne près** — `supabase/migrations/016_stock_full.sql:128-142` :
```sql
CREATE OR REPLACE FUNCTION get_product_stock(p_id UUID) RETURNS NUMERIC LANGUAGE sql STABLE AS $$
  SELECT COALESCE(SUM(CASE
    WHEN type = 'IN'         THEN  quantite
    WHEN type = 'OUT'        THEN -quantite
    WHEN type = 'ADJUSTMENT' THEN  quantite
    ELSE 0                                  -- ← 'reception' et 'sortie' tombent ici
  END), 0) FROM stock_movements WHERE product_id = p_id;
$$;
```
Or la distribution réelle des 96 mouvements, mesurée : **48 × `'reception'` + 48 × `'sortie'`**. Aucun `IN`, aucun `OUT`. **Les 96 lignes tombent toutes dans `ELSE 0`.**

Conséquences en chaîne :
- `GET /api/stock/[id]` répond `{ stock: 0 }` pour tout produit ;
- `POST /api/stock/move` (`:23-29`) refuse **toute** sortie pour stock insuffisant ;
- la règle comptable **STK-002 se déclenche sur `type === 'OUT'`** (`app/api/stock/move/route.ts:48`) — valeur que le CHECK actif n'autorise pas. **Aucun événement STK-002 ne peut donc être émis**, et le compte 311 du bilan ne bouge jamais.

## D2.3 Trois dialectes incompatibles pour `stock_movements.type`

| Vocabulaire | Origine | Employé par |
|---|---|---|
| `IN` · `OUT` · `TRANSFER` · `ADJUSTMENT` | CHECK d'origine `016_stock_full.sql:40` | `get_product_stock()`, `/api/stock/move:14`, règle STK-002 |
| `entree` · `sortie` · `ajustement` · `transfert` · `reception` · `retour` | CHECK remplacé par `050:312-317` et `051:67-72` | **les 96 lignes de production**, les 5 pages `app/dashboard/stocks/*`, le seed |
| filtres ad hoc | — | `mouvements/page.tsx:96`, `entrepots/page.tsx:85-87`, `valorisation/page.tsx:74` (un `ajustement` positif n'entre dans aucun CMP) |

Les deux routes API et les cinq pages UI se contredisent mutuellement.

## D2.4 `products.stock_actuel` n'a jamais existé — preuve documentaire

- `016_stock_full.sql:9-24` crée `products` avec **exactement les 12 colonnes observées** en production. Pas de `stock_actuel`.
- `050_stocks_enterprise_tables.sql:40-51` ajoute 11 colonnes à `products` — **`stock_actuel` n'y figure pas**, et cette section n'a de toute façon pas été appliquée.
- La colonne n'apparaît dans les 170 migrations que pour **une autre table** : `pharmacie_medicaments` (`061:268`, `091:289`).
- `050:358-361` déclare `CREATE TRIGGER trg_products_check_stock AFTER UPDATE OF stock_actuel ON products` — **sur une colonne jamais créée**. Le corps de `fn_check_stock_alerte()` est d'ailleurs vide (« le calcul se fait côté frontend », `RETURN NEW`).

**Aucun trigger, dans aucune migration, n'a jamais maintenu une quantité de stock sur `products`.** La colonne que 14 pages lisent et que 7 sites réécrivent est une pure fiction.

## D2.5 Couverture fonctionnelle réelle

| Domaine | Mécanisme | Fonctionne ? |
|---|---|---|
| **Ventes POS** (`commerce/page.tsx:179-186`) | **aucun** — insère `ventes` + `vente_lignes` et s'arrête | ❌ **le stock ne bouge jamais à la vente** |
| Achats (`purchases`/`purchase_items`) | `achats/page.tsx:189-208` | ❌ triple erreur : `stock_actuel`, `quantity`, et lecture de `item.quantity` (réel : `quantite`) |
| Réceptions | `/api/stock/reception` | ❌ écrit d'abord `stock_receptions` (inexistante) → 500 avant tout effet |
| Sorties · Inventaires | tables inexistantes | ❌ |
| Transferts | `stock_transferts` **existe** | ⚠️ en-tête écrit, mouvements non (`quantity`) |
| **Restaurant** | décrément par recette, côté serveur | ✅ **seul flux stock opérationnel bout en bout** (sans verrou) |
| **Pharmacie** | trigger SQL `trg_phvente_stock` (`061:362-372`) | ✅ atomique — mais concurrencé par l'update manuel de `sante/pharmacie/page.tsx:99` |
| Reporting (`/api/analytics/summary:52`) | lit `stock_articles.quantite_min` — **colonne inexistante** | ❌ tout le bloc stock du reporting renvoie 0 |
| `lib/erp-core/compute/stock.ts` | contrat `{quantite, quantite_min, prix_unitaire}` → cible `stock_articles`, **pas `products`** | ⚠️ code correct, appelant lui passe un tableau vide |

**Échecs silencieux les plus insidieux** — deux pages font `select('*')`, donc **aucune erreur** : `stocks/produits/page.tsx:81` → `totalValeur` = **NaN** et `getStatusStock` renvoie « OK » pour tout (car `undefined <= 0` est `false`) : **une rupture de stock s'affiche comme un stock sain**. Idem `commerce/catalogue/page.tsx:162`. Et `mouvements/page.tsx:66` lit `m.quantity` → entrées et sorties affichées à **0** alors que 96 mouvements existent.

## D2.6 Corrections nécessaires quelle que soit l'option

Ce ne sont pas des choix d'architecture :
1. `quantity` → `quantite` dans 6 writers et 6 readers.
2. Unifier le vocabulaire de `type` et réaligner `get_product_stock()`, `/api/stock/move` et STK-001/002.
3. Brancher les ventes POS sur le stock (`commerce/page.tsx:186`).

## D2.7 DÉCISION RECOMMANDÉE — **la quantité est dérivée de `stock_movements`**

**Statut : READY, sous réserve de la question 3 ci-dessous.**

| Critère | Option 1 — colonne + trigger | Option 2 — agrégation |
|---|---|---|
| Exactitude | correcte **si** le trigger est writer unique — or 7 sites recalculent côté client, et le précédent pharmacie montre que la cohabitation dérive (`sante/pharmacie/page.tsx:99` écrit à la main une colonne maintenue par trigger) | **exacte par construction** : la quantité *est* la somme des faits |
| Concurrence | résolue par verrou de ligne — mais contention sur la ligne produit | `INSERT` append-only, aucune contention. **Point faible réel** : l'anti-négatif exige un `SELECT … FOR UPDATE` explicite |
| Performance | O(1) | O(n) — **10 produits, 96 mouvements** : argument nul aujourd'hui, index `(tenant_id, product_id)` déjà présent (`016:81`) |
| **Inventaire à une date** | **impossible** — une colonne scalaire n'a pas d'historique | natif (`WHERE created_at <= :date`) |
| **Multi-entrepôt** | **impossible** — `products` n'a aucune dimension entrepôt | natif (`GROUP BY warehouse_id`) |
| Rapprochement avec le compte 311 | aucun lien | même modèle événementiel que `accounting_events` |

**Trois raisons factuelles, non esthétiques :**

1. **Deux fonctionnalités déjà écrites sont indécidables avec l'option 1** : le stock par entrepôt (`entrepots/page.tsx:83-88` et `transferts/page.tsx:107-121` l'agrègent déjà) et le stock à une date (CMP `valorisation/page.tsx:71-78`, séries `analytics/page.tsx:76-81`, stock de clôture au bilan SYSCOHADA). L'option 1 obligerait à **construire quand même** l'agrégation par-dessus — donc à maintenir deux vérités.
2. **Rien à perdre en production** : `products.stock_actuel` n'a jamais existé, il n'y a aucune donnée à préserver. Les 96 mouvements sont la **seule** donnée de stock existante. L'option 2 les rend immédiatement exploitables ; l'option 1 les recopie dans une colonne qui pourra ensuite diverger.
3. **Cohérence doctrinale** : le moteur comptable est déjà événementiel et la LOI-K impose déjà un writer unique. Faire de `stock_movements` le writer unique du stock étend une doctrine en place, au lieu d'en introduire une seconde.

**Mise en œuvre minimale** : une vue `v_products_stock` exposant une colonne nommée `stock_actuel` calculée — les 14 lecteurs ne changent qu'un nom de table — et une fonction `fn_stock_move(...)` devenant le **seul** point d'insertion, avec `SELECT … FOR UPDATE` sur le produit pour la contrainte anti-négatif. Les 7 writers client perdent leur bloc read-modify-write.

Si la volumétrie l'exige un jour, ajouter un **cache** maintenu par trigger — en le nommant explicitement cache, distinction absente du code actuel et cause de toutes les incohérences relevées.

## D2.8 Plan de migration

| Étape | Action | Vérification |
|---|---|---|
| 1 | Trancher le vocabulaire de `type` et corriger `get_product_stock()` en conséquence | `get_product_stock()` renvoie 148 pour « Fournitures bureau » |
| 2 | Corriger `quantity` → `quantite` (12 sites) | requêtes en 200 |
| 3 | Créer `v_products_stock` (ou fonction équivalente) | les 14 lecteurs affichent une quantité |
| 4 | Créer `fn_stock_move()` avec verrou, la rendre seul point d'écriture | test de concurrence : 2 sorties simultanées ne passent pas sous zéro |
| 5 | Retirer les 7 recalculs client ; révoquer l'`UPDATE` direct sur la quantité | aucun recalcul côté navigateur |
| 6 | Brancher le POS et réaligner STK-002 sur le vocabulaire retenu | une vente décrémente et émet STK-002 |

## D2.9 Tests nécessaires

| # | Test | Existe ? |
|---|---|---|
| 1 | `get_product_stock(p)` ≡ Σ(entrées) − Σ(sorties) pour les 10 produits réels | **non** |
| 2 | Deux sorties concurrentes ne rendent pas le stock négatif | **non** |
| 3 | Une vente POS décrémente le stock et émet STK-002 | **non** |
| 4 | Stock à une date passée = stock actuel − mouvements postérieurs | **non** |
| 5 | Chaque valeur de `type` écrite par le code est acceptée par le CHECK | **non** |
| 6 | Solde du compte 311 ≡ valorisation du stock physique | **non** |

## D2.10 Ce qui reste à vérifier avant exécution

⛔ Ces points exigent un accès SQL direct (MCP Supabase hors service) :
1. **Quelle version du CHECK sur `stock_movements.type` est active ?** La présence de `stock_transferts` fait pencher pour 050/051, et les données (`reception`/`sortie`) le confirment — mais ce n'est pas une lecture directe de la contrainte. `SELECT pg_get_constraintdef(oid) FROM pg_constraint WHERE conname='stock_movements_type_check'`
2. **Existe-t-il des triggers en production absents du dépôt ?** Les migrations 050/091 prouvent que base et dépôt ont divergé. `SELECT tgname, tgrelid::regclass FROM pg_trigger WHERE NOT tgisinternal`
3. **Le multi-entrepôt est-il une exigence produit ?** La production n'a qu'**un** entrepôt. Si le multi-entrepôt est abandonné, l'argument n°1 perd la moitié de sa force — l'inventaire à une date suffit toutefois à conclure de la même manière. **C'est la seule question qui pourrait faire réexaminer la recommandation ; elle vous appartient.**

---

# D3 — IRPP CONGO

## D3.0 Réponse mécanique : l'écart vient d'un facteur unique

**100 % de l'écart provient de la périodicité.** Les deux moteurs ont **exactement les mêmes bornes nominales et les mêmes taux**. L'un les lit comme mensuelles, l'autre comme annuelles divisées par 12.

| Facteur | Contribution | Preuve |
|---|---:|---|
| **(a) Barèmes différents** | **0 F (0 %)** | Bornes identiques : 38 666,67 × 12 = 464 000 ; 83 333,33 × 12 = 1 000 000 ; 250 000 × 12 = 3 000 000 ; 666 666,67 × 12 = 8 000 000 |
| **(b) Base mensuelle vs annuelle** | **+196 213 F (100 %)** | `calcul-paie.ts:30` « appliqué mensuellement » vs `congo-calculs.ts:86` « Barème annuel divisé par 12 » |
| **(c) Abattement** | **0 F** | Aucun des deux n'en applique |
| **(d) Quotient familial** | **0 F** | Célibataire 0 enfant → 1 part dans les deux |
| **(e) Combinaison** | non | facteur (b) seul et entier |

## D3.1 Décomposition pas à pas — 900 000 F brut, célibataire, 0 enfant

**Les deux moteurs entrent dans le barème avec la même base :**
```
Brut                900 000
− CNSS salarié       36 000   (4 % plafonné 1 200 000)
= Base IRPP         864 000   ← identique dans les deux chemins
```

**Chemin A — `calcul-paie.ts` (bornes lues MENSUELLES)**
| Tranche | Bornes | Base | Taux | Impôt |
|---|---|---:|---:|---:|
| T1 | 0 → 464 000 | 464 000 | 0 % | 0 |
| T2 | 464 000 → 1 000 000 | 400 000 | 1 % | **4 000** |
| T3-T5 | ≥ 1 000 000 | 0 | — | 0 |
| | | | **TOTAL** | **4 000** |

**Chemin B — `congo-calculs.ts` (mêmes bornes lues ANNUELLES ÷ 12)**
| Tranche | Bornes (annuel ÷ 12) | Base | Taux | Impôt |
|---|---|---:|---:|---:|
| T1 | 0 → 38 666,67 | 38 666,67 | 0 % | 0 |
| T2 | → 83 333,33 | 44 666,66 | 1 % | 446,67 |
| T3 | → 250 000 | 166 666,67 | 10 % | 16 666,67 |
| T4 | → 666 666,67 | 416 666,67 | 25 % | 104 166,67 |
| T5 | au-delà | 197 333,33 | 40 % | 78 933,33 |
| | | | **TOTAL** | **200 213** |

**Point de divergence isolé à la ligne près** : `calcul-paie.ts:110` compare 864 000 à `tranche.max = 464_000` ; `congo-calculs.ts:100-116` compare 864 000 à `38_666.67 / 83_333.33 / 250_000 / 666_666.67`. **93,3 % du delta vient du basculement de 614 000 F dans les tranches à 25 % et 40 %** — tranches que le chemin A réserve aux revenus mensuels de 3 M à 8 M.

## D3.2 Les neuf moteurs et leur résultat sur le même cas

| # | Moteur | Résultat | Consommateur réel |
|---|---|---:|---|
| 1 | `lib/paie/calcul-paie.ts` `calcIRPP` | **4 000** | `api/agents/rh/analyse` uniquement |
| 2 | `lib/fiscal/congo-calculs.ts` | **200 213** | **AUCUN** — 0 importeur applicatif |
| 3+4 | `universal-tax-engine` + `countries/CG.ts` | **4 000** | ✅ **`app/dashboard/rh/paie/page.tsx:151` — chemin de production des bulletins** |
| 5 | `fiscalite/engine.ts` | **4 000** | simulateur `fiscalite/irpp/page.tsx` |
| 6 | `lib/fiscalite-congo.ts` | **142 613/mois** (base annuelle, abattement 20 %, CNSS non déduite) | aucun pour l'IRPP |
| 7 | `app/api/fiscalite/irpp/route.ts` | pas de recalcul — agrège `bulletins_paie` | déclaration DGI |
| 8 | `PaysContext.tsx` | **4 000** | aucun consommateur trouvé |
| 9 | `lib/miaa/tools.ts` | **3 906** (CNSS 5,04 %, plafond 1,5 M) | assistant IA |

**Six moteurs sur neuf convergent vers ≈4 000. Ce n'est PAS un argument juridique** — une majorité arithmétique ne fait pas la loi. Je ne désigne aucun moteur comme correct.

**Fait notable :** le moteur qui produit 200 213 (`congo-calculs.ts`, 300 lignes) **n'a aucun importeur applicatif** — il est mort en production, tout en étant désigné « source de vérité CG » par `universal-tax-engine.test.ts:7`.

**Aggravant :** `lib/paie/calcul-paie.ts`, déclaré « INTOUCHABLE » par décision d'architecture (`docs/F004-ESC01-CERTIFICATION.md:838`) et couvert par un auto-test, **n'est plus sur le chemin de production de l'IRPP**. L'écran de paie importe de lui `calcPrimeAnciennete, fmtNum` (`:16`) mais calcule l'IRPP via `universal-tax-engine` (`:151`).

## D3.3 La découverte décisive : l'équipe a inversé sa décision en 24 heures

✅ **VÉRIFIÉ — historique git de `lib/countries/CG.ts` :**

```
df14230  2026-06-20  feat(fiscal): Universal Tax/Payroll Engines + 7 pays CEMAC
b7c0f6c  2026-06-21  fix: barème IRPP/ITS Congo officiel LF 2026 (Art. 114-116G)
                     — abattement 20%, montant fixe T1, méthode annuelle
c0574a0  2026-06-22  fix(CG): barème IRPP Art. 76 — mensuelle_directe,
                     5 tranches 0-464k→40%, abattement aucun
```

Diff réel du commit du 22 juin :
```diff
-    methode_base: 'annuelle_div12',
+    methode_base: 'mensuelle_directe',
+    // Pas d'abattement professionnel — Art. 76 CGI Congo
-      { min: 0, max: 615_000, taux: 0, montant_fixe: 4_200 },  // fixe 4 200 F/an/part
+      { min: 0, max: 464_000, taux: 0, montant_fixe: null },   // 0% exonéré
```

**En une journée, cinq paramètres ont été inversés** : l'article de référence (114-116G → 76), la périodicité (annuelle → mensuelle), les seuils (615 000 → 464 000), le traitement de T1 (montant fixe 4 200 → taux 0 %) et l'abattement (20 % → aucun).

**Et les deux versions cohabitent encore dans le fichier aujourd'hui :**

| | En-tête et notes (prose) | Code exécutable |
|---|---|---|
| Article | `:13` `Art. 114-116G CGI` · `:261` idem | `:83,124` `Art. 76 CGI` |
| Seuils | `:13` `615 000 / 1 500 000 / 3 500 000 / 5 000 000` | `:101-107` `464 000 / 1 000 000 / 3 000 000 / 8 000 000` |
| Méthode | `:15` `annuelle_div12 — moteur divise par 12` | `:84` `mensuelle_directe` |
| Abattement | `:14,263` `20 % sur (brut − CNSS)` | `:87-90` `type: 'aucun'` |
| Tranche 1 | `:14,262` `montant fixe 4 200 F/an/part` | `:102` `taux: 0, montant_fixe: null` |

Le fichier revendique par ailleurs `data_confidence: 'verified'` (`:254`) et `derniere_mise_a_jour: '2026-06-20'` (`:256`) — **une date antérieure aux deux commits qui ont modifié le barème.**

**C'est l'explication de fond des neuf moteurs divergents** : certains ont été écrits avant le 21 juin, d'autres entre le 21 et le 22, d'autres après. Aucun n'a été réaligné.

## D3.4 Autres contradictions internes relevées

- **`universal-tax-engine.test.ts`** déclare `congo-calculs.ts` « source de vérité CG » (`:7,34`) tout en asservissant ses assertions au comportement **opposé** (`:113` attend `(700 000 − 464 001) × 1 %`, soit ≈2 360 ; `congo-calculs` rendrait ≈55 000).
- **`congo-calculs.ts:85-86`** qualifie le même bloc de tranches de « mensuelles » **et** de « annuel divisé par 12 » — l'ambiguïté même est écrite dans le commentaire.
- **Le même article 76 est cité** pour justifier `abattement = 20 %` (`fiscalite-congo.ts:141,139`) **et** `abattement = 0 %` (`CG.ts:86`, `pays.ts:38`).
- **`CG.ts:221`** désigne `congo-calculs.ts` comme base légale de la TOL — **une référence circulaire vers du code, pas vers un texte de loi.**

## D3.5 Ce qui manque — et pourquoi je ne tranche pas

⛔ **Le dépôt ne contient aucun texte de loi.** Recherche d'un PDF ou d'une copie de la LF n°42-2025 : **aucun fichier**. Les mentions « LF 2026 confirmé », « Analyse vérifiée 238 pages » (`CG.ts:8`), « Données vérifiées et certifiées » (`fiscalite-congo.ts:3`) **ne sont adossées à aucune pièce présente**.

Conformément à votre règle absolue, je ne choisis pas de chiffre. **Questions à poser à un fiscaliste ou à la DGI Congo, par ordre de criticité :**

1. **Périodicité — la question qui vaut 100 % de l'écart.** Le barème de l'art. 76 CGI tel que modifié par la LF n°42-2025 énonce-t-il ses seuils (464 000 / 1 000 000 / 3 000 000 / 8 000 000) en base **mensuelle** ou **annuelle** ? Si annuelle, la retenue mensuelle se fait-elle par division par 12, ou par un barème mensuel distinct ?
2. **Article applicable** — le barème des retenues sur salaires relève-t-il de l'**art. 76** ou des **art. 114-116G** ? S'agit-il de deux barèmes coexistants (IRPP de rôle vs ITS retenu à la source) ?
3. **Barème chiffré 2026** — les seuils **615 000 / 1 500 000 / 3 500 000 / 5 000 000** cités dans `CG.ts:13` existent-ils dans un texte, et pour quelle assiette ?
4. **Abattement** — l'abattement de 20 % pour frais professionnels (« art. 116A ») est-il en vigueur en 2026 ? S'applique-t-il sur le **brut** ou sur **(brut − CNSS)** ? Plafond ou plancher ?
5. **Ordre des opérations** — brut → − CNSS → − abattement → ÷ parts → barème ? La CNSS salariale de 4 % est-elle déductible de l'assiette IRPP, et dans quelle limite ?
6. **Quotient familial** — applicable à la retenue à la source ? Plafonnement du nombre de parts ou de l'avantage par demi-part ?
7. **Tranche 1** — exonération à 0 %, ou **montant fixe de 4 200 F/an/part** ?
8. **Plancher** — le minimum de 1 200 F/an pour les salaires sous le SMIG est-il en vigueur, et sur quelle base ?
9. **SMIG 2026** — **90 000 F** (`calcul-paie.ts:27`, `CG.ts:35`) ou **70 400 F** (`docs/F004-ESC01-CERTIFICATION.md:968`) ?
10. **Mesure art. 15 LF 2026** — la prise en charge par l'État de l'IRPP des 25 000 premiers déclarants est-elle entrée en application ? (flags `actif: false` aujourd'hui)
11. **Cas de contrôle décisif** — pour un célibataire sans enfant à 900 000 F de brut mensuel imposable, quel montant exact d'IRPP retenir à la source en 2026 ? **Cette seule réponse départage 4 000, 200 213 et 142 613.**
12. **TOL** — quel article institue la retenue de 1 000 F/mois ?

## D3.6 Statut : **BLOCKED**

La question est entièrement caractérisée sur le plan technique — cause unique, isolée à la ligne, chiffrée à 100 %. Elle est **bloquée sur une réponse de droit** que ni le dépôt ni moi ne détenons.

**Ce qui peut avancer sans attendre le fiscaliste :**

| # | Action | Justification |
|---|---|---|
| 1 | **Réécrire l'en-tête et les notes de `CG.ts`** pour qu'ils décrivent le code | Défaut interne certain : le fichier se contredit lui-même |
| 2 | **Corriger `derniere_mise_a_jour`** (`:256`, `'2026-06-20'`, antérieure aux commits du 21 et 22) et retirer `data_confidence: 'verified'` tant que la question 1 n'est pas tranchée | Une donnée n'est pas « vérifiée » quand la doc et le code se contredisent |
| 3 | **Corriger `universal-tax-engine.test.ts:7,34`** — il désigne comme référence un module dont il contredit le comportement | Défaut interne certain |
| 4 | **Documenter que 8 moteurs coexistent** et geler l'ajout d'un neuvième | Prévention |
| 5 | **Préparer la lecture d'`accounting_fiscal_params`** (14 lignes en production, jamais lues) comme réceptacle du barème daté | Prérequis structurel commun avec D4 |

⚠️ **Ne pas « harmoniser sur 4 000 » au motif que six moteurs le produisent.** Si la réponse juridique est « seuils annuels », c'est le chemin majoritaire — **et donc les bulletins de paie de production** — qui est faux, et l'harmonisation aurait figé l'erreur.

---

# FOUNDATION DECISION MATRIX

| # | Décision | Statut | Recommandation | Motif du statut |
|---|---|---|---|---|
| **D1** | Lignes de facture : `facture_lignes` (relationnel) vs `factures.items` (jsonb) | **READY** | **`facture_lignes`** — exécuter la partie non appliquée de la migration 010 | Intention écrite dans la migration (`010:23` « remplace le champ items JSONB »), patron primaire/repli dans les 2 chemins de lecture, 6 précédents internes sur 7, **0 donnée à migrer** (198 factures, `items` vide partout). Preuves internes suffisantes ; aucune question ouverte. |
| **D2** | Stock : `products.stock_actuel` vs agrégation `stock_movements` | **READY** *(sous réserve d'une question produit)* | **Agrégation de `stock_movements`** | La colonne n'a **jamais existé** dans aucune migration ; 2 fonctionnalités déjà codées (multi-entrepôt, stock à une date) sont indécidables avec une colonne scalaire ; 96 mouvements sont la seule donnée réelle. **Réserve** : si le multi-entrepôt est abandonné, l'argument s'affaiblit de moitié — l'inventaire à une date suffit toutefois à conclure. |
| **D3** | Moteur IRPP Congo faisant foi | **BLOCKED** | *aucune — question de droit* | Cause mécanique **entièrement établie** (100 % = périodicité, isolée à la ligne, chiffrée tranche par tranche). Mais l'équipe a **inversé sa propre décision en 24 h** (commits `b7c0f6c` → `c0574a0`) et le dépôt **ne contient aucun texte de loi**. Trancher exigerait d'inventer une règle fiscale. |
| **D4** | TVA Congo : 18 % vs 18,9 % | **BLOCKED** | *partiellement — voir ci-dessous* | **La question était mal posée** : 18,9 % est le taux **composé** (18 % × 1,05), pas un concurrent. Le vrai défaut est établi — le compte 4441 porte **deux sémantiques** — mais 6 questions d'assiette relèvent du droit fiscal. |

## Ce qui peut avancer immédiatement, sans réponse juridique

| Action | Décision | Nature |
|---|---|---|
| Exécuter la migration 010 en recette, **après arbitrage des 4 paires de colonnes redondantes** (`client_name`/`client_nom`, `subtotal`/`montant_ht`…) | D1 | technique |
| Corriger `get_product_stock()` : les 96 lignes tombent dans `ELSE 0` | D2 | **bug prouvé** |
| Corriger `quantity` → `quantite` (12 sites) | D2 | **bug prouvé** |
| Brancher les ventes POS sur le stock (`commerce/page.tsx:186`) | D2 | trou fonctionnel |
| Aligner la sémantique du compte 4441 (TVA seule + sous-compte CA) sur le modèle de la facturation | D4 | cohérence interne |
| Corriger `lib/fiscalite/pays.ts:54` : « 19.8 % » → 18,9 % | D4 | **erreur arithmétique certaine** |
| Réécrire l'en-tête et les notes de `CG.ts` pour qu'ils décrivent le code | D3 | **le fichier se contredit** |
| Retirer `data_confidence: 'verified'` de `CG.ts:254` et corriger `derniere_mise_a_jour` | D3 | intégrité documentaire |
| Corriger `universal-tax-engine.test.ts:7,34,96` — désigne comme référence un module dont il contredit le comportement | D3 | **défaut interne** |
| Activer la lecture d'`accounting_fiscal_params` (**14 lignes en production, jamais lues**) | D3 + D4 | **prérequis structurel commun** |

## Les 3 questions à poser à un fiscaliste — par ordre de valeur

1. **Périodicité IRPP Congo** — les seuils de l'art. 76 (464 000 / 1 M / 3 M / 8 M) sont-ils mensuels ou annuels ? *Cette seule réponse vaut 100 % de l'écart ×50 et détermine si les bulletins de production sont justes ou faux.*
2. **Assiette du Centime Additionnel** — sur la TVA **collectée brute** ou sur la **TVA nette due** ? Le CA payé en amont est-il déductible ?
3. **Abattement professionnel de 20 %** — en vigueur en 2026 ? Sur le brut ou sur (brut − CNSS) ?

## Avertissement final

⚠️ **Ne pas « harmoniser sur la majorité ».** Six moteurs sur neuf produisent 4 000 F d'IRPP, et la facturation produit une TVA cohérente. Ce sont des majorités arithmétiques, **pas des arguments juridiques**. Si la réponse à la question 1 est « seuils annuels », alors le chemin majoritaire — donc les bulletins de paie réellement produits — est faux, et une harmonisation prématurée aurait figé l'erreur dans le socle.

---

*Document de décision. Aucune modification de code, aucune migration, aucun changement de base, aucun commit.*

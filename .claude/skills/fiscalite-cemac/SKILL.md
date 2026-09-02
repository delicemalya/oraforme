---
name: fiscalite-cemac
description: Utilise ce skill pour TOUT calcul fiscal, douanier ou financier dans le projet oraforme couvrant la zone CEMAC (Congo-Brazzaville, Cameroun, Gabon, Tchad, RCA, Guinée Équatoriale) et la RDC. Déclenche-le pour IS (Impôt sur les Sociétés), TVA, IRPP/IPR (impôt sur le revenu), CNSS/CNPS/INSESO (cotisations sociales), Patente, droits de douane, retenues à la source, pénalités fiscales, ou toute référence à une Loi de Finances annuelle. Couvre aussi les calculs financiers : trésorerie, ratios, conversion FCFA, déclarations fiscales multi-pays dans lib/fiscalite-{pays}.ts. Toujours consulter avant d'écrire ou modifier du code fiscal — ne jamais inventer un taux non sourcé.
---

# Fiscalité & Finance CEMAC + RDC — oraforme

## Principe directeur

Chaque pays de la zone garde sa **souveraineté fiscale totale** — l'harmonisation CEMAC porte sur la TVA (directive commune, taux proches de 18-19%) et le Tarif Extérieur Commun douanier, mais **chaque taux d'IS, IRPP, et chaque barème social est national**. Ne jamais supposer qu'un taux validé pour un pays s'applique à un autre.

**Avant tout calcul fiscal dans le code** : vérifier le pays exact du tenant (`lib/fiscalite-{pays}.ts`) — ne jamais utiliser un taux par défaut "CEMAC générique".

## Tableau comparatif — taux vérifiés par textes officiels (dernière vérification : juin 2026)

Chaque ligne a été confirmée directement par un texte de loi officiel (CGI national, Loi de Finances promulguée, ou DGI nationale) — pas par un blog tiers. Sources citées sous le tableau.

| Pays | IS | TVA standard | IRPP max | CNSS/CNPS patronal | CNSS/CNPS salarié |
|---|---|---|---|---|---|
| **Congo-Brazzaville** | 30% | 18% + CA 5% | 40% (barème 0/1/10/25/40%) | 20,29% + TUS 3% = 23,29% | 4% |
| **Cameroun** | 30% (minimum perception 2% CA, +10% CAC) | **17,5%** (taux réduit 10%, taux zéro 0%) | 35% (+10% CAC = 38,5% effectif) | CNPS 11,2% (pension 4,2% + alloc. fam. 7%) + accidents 1,75-5% + CFC 1% + FNE 1% | CNPS 4,2% (plafond 750 000 FCFA) |
| **Gabon** | 30% (35% pétrole/mines, minimum perception 1,1% CA) | 18% (taux réduit 10% et 5% sur liste de produits) | 35% | CNSS 20,1% (alloc. fam. 8%, retraite 5%, AT 3,5-5%, maladie 3,6%) + CNAMGS 1,5% | CNSS 2% + CNAMGS 1% |
| **Tchad** | 35% (25% établissements publics/assoc. sans but lucratif) | 18% (0% export) | **Réforme LF 2026** : suppression de la globalisation du revenu — imposition désormais distincte par catégorie (salaires, fonciers, BIC, BNC, agricoles). Retenue capitaux mobiliers réduite de 18% à 15% (LF 2026) | À confirmer CNPS Tchad | À confirmer |
| **RCA** | 30% (20% agriculture), minimum de perception **1,85%** CA (0,3% agricole) | 19% (seuil CA ≥ 30M FCFA) | **40%** — barème officiel 0% / 8% / 15% / 28% / 40% (tranches : 0-378k / 378k-1,68M / 1,68M-3,36M / 3,36M-5,04M / >5,04M FCFA) | À confirmer CNSS RCA | Cotisations CNSS déductibles de l'assiette IRPP (taux à confirmer) |
| **Guinée Équatoriale** | **25%** (réformé de 35%→25%, Ley General Tributaria n°1/2024 du 19/11/2024, en vigueur depuis le 06/12/2024) + surtaxe secteur hydrocarbures | 15% (taux réduit réformé de 6%→**5%**) | **25%** (réformé de 35%→25%), exonération 1ʳᵉ tranche relevée à **1 400 000 XAF** (depuis 1M) | INSESO 21,5% + WPF 1% = 22,5% | INSESO part salarié (à confirmer) |
| **RDC** | **30%** confirmé DGI (déclaration avant le 30/04 N+1), taxe minimale 1% CA si déficit | **16%** confirmé DGI (biens/services locaux et importations) | Barème progressif confirmé DGI, plafond **40%** sur tranche >43 200 000 FC. Réforme IS/IRPP en vigueur depuis le 01/01/2026 (Lois 23/052 et 23/053), remplace IBP/IPR cédulaires | INSS (à confirmer) | INSS (à confirmer) |

**⚠️ Correction majeure (juin 2026) :** la TVA Cameroun est de **17,5%** selon le texte officiel du CGI (article 142, confirmé par le projet de LF 2026) — le chiffre de "19,25%" largement répété sur les sites tiers correspond en réalité au taux + CAC déjà inclus, ce qui induisait en erreur sur le taux nominal applicable dans les calculs de facturation.

**⚠️ Correction majeure (juin 2026) :** la Guinée Équatoriale a adopté une réforme fiscale complète (Ley General Tributaria n°1/2024) qui a **fait baisser l'IS et l'IRPF de 35% à 25%** — toute donnée antérieure à décembre 2024 mentionnant "35%" pour ce pays est obsolète.

**Champs marqués "à confirmer" : ne jamais coder une valeur par défaut sans vérification.** Rechercher la source officielle (DGI nationale, CNSS/CNPS nationale, dernière Loi de Finances) avant implémentation.

### Sources officielles consultées pour cette mise à jour
- **Congo** : Loi n°42-2025 du 31/12/2025 (LF 2026), PDF intégral analysé pages 1-238
- **Cameroun** : Projet de Loi de Finances 2026 (dgb.cm), texte officiel articles du CGI cités intégralement
- **Gabon** : Loi n°041/2025 du 29/12/2025 (LF 2026) + CGI gabonais officiel (dgi.ga), extraits texte de loi via gouvernement.ga
- **Tchad** : Circulaire N°001/MFBEPCI/2026 du Ministère des Finances tchadien — instructions officielles d'application de la LF 2026 (Loi n°008/AN/SENAT/2025)
- **RCA** : Code Général des Impôts officiel, édition mise à jour 2023, publié par finances.gouv.cf
- **Guinée Équatoriale** : Ley General Tributaria n°1/2024, couverture presse officielle du Ministère des Finances (présentation Sipopo, 13/01/2025)
- **RDC** : Site officiel DGI (dgi.gouv.cd) — pages IS, IRPP, télédéclaration TVA

## Congo-Brazzaville — référence la plus détaillée (LF 2026, Loi n°42-2025 du 31/12/2025)

C'est le pays de référence d'oraforme (POLYVALON basé à Pointe-Noire). Données certifiées par analyse complète de la LF 2026 :

- **IS** : 30%, minimum de perception 1% du CA HT
- **TVA** : 18% + centimes additionnels (CA) 5% (soit 18,9% effectif sur le HT)
- **IRPP** : barème 0% / 1% / 10% / 25% / 40%, abattement forfaitaire 20% sur salaire brut
- **CNSS** : salarié 4%, patronal 20,29% (retraite 8% + AT ~5% + alloc. familiales 10% + pécule congé 0,29%)
- **TUS** (Taxe Unique sur les Salaires, patronal uniquement) : 3%
- **Patente** : barème dégressif 9,75% → 0,045% selon tranche de CA
- **Redevance informatique douanière** (Art. 44 LF 2026, nouveauté) : 2% import, 2% export, 1% régimes suspensifs
- **Mesures temporaires 2026** : IRPP pris en charge par l'État + 50% cotisations patronales prises en charge pour les 25 000 premiers déclarants enregistrés au programme

Fichier de référence projet : `lib/fiscalite-congo.ts`

## Cameroun (CGI, Projet de Loi de Finances 2026 — source officielle dgb.cm)

- **IS** : 30% taux de droit commun. Minimum de perception : **2% du CA + 10% CAC** (anciennement 5% pour le régime simplifié — disposition supprimée en LF 2026). Acompte mensuel versé au plus tard le 15 du mois suivant
- **IGS** (Impôt Général Synthétique) : régime forfaitaire unique remplaçant IRPP/IS/TVA/Patente pour TPE/PME — seuils **50M FCFA** (commerce/industrie/artisanat/agropastoral) ou **30M FCFA** (professions libérales). Acompte 2% du CA mensuel + 10% CAC
- **TVA** : **17,5%** taux général officiel (article 142 CGI) + 10% taux réduit (logements sociaux, prêts immobiliers 1ʳᵉ résidence) + 0% taux zéro. ⚠️ Ne pas confondre avec le taux "19,25%" très répandu en ligne, qui mélange taux + CAC dans un raccourci trompeur
- **IRPP** : barème jusqu'à 35% + CAC 10% = 38,5% effectif sur la dernière tranche. Abattement forfaitaire 500 000 FCFA + frais réels possibles
- **CNPS** : salarié 4,2% (plafond 750 000 FCFA) ; patronal 11,2% (pension 4,2% + allocations familiales 7%) + accidents travail 1,75-5% + CFC 1% + FNE 1%
- **Retenues à la source (RAS)** : 
  - AIB/précompte sur achats : 2% (régime réel), 5% (régime IGS)
  - Honoraires/commissions professions libérales : 5% + 10% CAC
  - Loyers (retenue par personnes morales/administrations) : 10%
  - Marchés publics < 5M FCFA : 5% + 10% CAC, sans considération du régime du prestataire
  - Numérique non-résident à présence économique significative (seuils : 50M FCFA de revenus OU 1000 utilisateurs au Cameroun) : 3% du CA brut, libératoire (option taux normal 30% possible, irrévocable 5 ans)
- **Crédit d'impôt R&D et innovation** : déduction majorée 150%
- **Crédit d'impôt emploi jeunes (<35 ans)** : exonération charges fiscales/patronales sur salaires pendant 3 ans + crédit d'impôt 20% des charges de formation
- **Taxe environnementale** (nouveauté CGI) : ciment 2500 FCFA/tonne, fer 5000 FCFA/tonne, carreaux/céramiques 10 000-15 000 FCFA/tonne, emballages non retournables 5-15 FCFA/unité, plastiques 5% valeur (plafond 1000 FCFA/unité)
- **Facturation électronique normalisée (FEN)** obligatoire pour la déductibilité TVA et le remboursement des crédits TVA

Fichier de référence projet : `lib/fiscalite-cameroun.ts`

## Gabon (Loi n°041/2025 du 29/12/2025 — LF 2026, + CGI officiel dgi.ga)

- **IS** : **30%** taux de droit commun confirmé (35% secteur pétrolier/minier selon CGI art. 15). Minimum de perception 1,1% du CA, plancher 600 000 FCFA (sauf 2 premières années d'activité)
- **TVA** : **18%** standard confirmé officiellement (CGI). Taux réduit **10%** sur liste précise : matériel de pêche, moteurs hors-bord, eau minérale locale, lessive, fer à béton, ordinateurs fixes/portables bureautiques, conserves légumes/fruits, eau/électricité compteurs sociaux, ciment. Logiciels importés taxés selon position tarifaire du support
- **IRPP** : barème 0% à 35%
- **IRVM** : 22% rémunérations administrateurs, 20% dividendes/revenus mobiliers
- **CNSS patronal** : 20,1% (alloc. familiales 8%, retraite 5%, accidents travail 3,5-5%, maladie/maternité 3,6%) + CNAMGS patronal 1,5%
- **CNSS salarié** : 2% + CNAMGS salarié 1%
- **Facturation électronique normalisée obligatoire** (LF 2026) pour tout assujetti IS/bénéfices professionnels/TVA/impôt synthétique libératoire — conditionne désormais la déductibilité des charges et le droit à récupération de la TVA (tolérance temporaire : document douane accepté)
- Retenue à la source sur loyers : **10%** (relevée de 5%, LF 2026) — due par le locataire personne morale ou IRPP/agence immobilière/État
- Prélèvement libératoire plus-values cession de titres par non-résident : **25%** (relevé de 20%, LF 2026)
- Amendes facturation électronique : jusqu'à 10M FCFA par facture en cas de récidive, cumulables avec rappels TVA et pénalités

Fichier de référence projet : `lib/fiscalite-gabon.ts`

## Tchad (Circulaire N°001/MFBEPCI/2026 — instructions officielles d'application LF 2026, Loi n°008/AN/SENAT/2025)

- **IS** : **35%** (article 129-145 CGI, confirmé), 25% pour établissements publics/associations/collectivités sans but lucratif
- **TVA** : **18%** sur opérations imposables, 0% exportations. Taux réduit 9% étendu en LF 2026 aux produits laitiers et viande produits localement
- **⚠️ RÉFORME MAJEURE IRPP (LF 2026)** : suppression du principe de **revenu brut global** — chaque catégorie de revenu (salaires, BIC, BNC, agricoles, fonciers, capitaux mobiliers) est désormais imposée **distinctement et séparément**, sans plus de compensation automatique entre catégories. Fin du mécanisme d'addition des revenus de sources diverses d'un même contribuable pour une base unique
- **Retenue sur capitaux mobiliers** : réduite de **18% à 15%** (LF 2026) pour les contribuables sans installation professionnelle au Tchad/CEMAC
- **Revenus fonciers et plus-values immobilières** : taux réduit de 20% à 15% ; **loyers** : taux réduit de 15% à 10%
- **TVA et numérique** : extension explicite aux commerce électronique et services numériques (cloud, hébergement, streaming, marketplaces, publicité en ligne) — TVA due si client établi/domicilié au Tchad ou service exploité sur le territoire. Autoliquidation si prestataire étranger non représenté
- **Facturation électronique normalisée (FEN)** obligatoire pour le remboursement des crédits de TVA — toute facture non conforme = rejet de la demande + remise en cause du crédit
- **Zones Économiques Spéciales (ZES)** : régime fiscal désormais intégré au CGI (auparavant par ordonnance), avantages conditionnés à l'immatriculation e-Tax et la facturation électronique
- **Industries créatives et culturelles** : exonération 10 ans pour entreprises créées à partir du 01/01/2026
- **Droits d'accise nouveaux/étendus** : tabac et succédanés 30% + 50 FCFA/paquet ; cosmétiques à l'hydroquinone 20% ; eaux gazeuses/boissons sucrées importées 50 FCFA/bouteille ; dattes importées 30% du poids net ; polypropylène 15% valeur sortie usine
- Cotisations sociales CNPS Tchad : taux à confirmer (non détaillés dans la circulaire 2026 consultée)

Fichier de référence projet : `lib/fiscalite-tchad.ts`

## République Centrafricaine (Code Général des Impôts officiel, finances.gouv.cf, édition mise à jour 2023)

- **IS / IRPP non-salariés** : **30%** (autres activités), **20%** taux réduit activités agricoles (article 81 CGI). Le montant ne peut être inférieur au minimum de perception
- **Minimum de perception (IRPP non-salariés)** : 1,85% du CA global (minimum absolu 1 850 000 FCFA) pour les autres activités ; 0,3% du CA (minimum 300 000 FCFA) pour les activités agricoles (article 82 CGI)
- **TVA** : **19%**, seuil d'assujettissement CA ≥ 30 000 000 FCFA
- **IRPP salariés — barème officiel exact (article 86 CGI)** :
  - 0 à 378 000 FCFA : **0%**
  - 378 001 à 1 680 000 FCFA : **8%**
  - 1 680 001 à 3 360 000 FCFA : **15%**
  - 3 360 001 à 5 040 000 FCFA : **28%**
  - Au-delà de 5 040 000 FCFA : **40%**
  - Abattement forfaitaire frais professionnels : 30% (articles 38-39 CGI)
- **Retenue capitaux mobiliers** : 15% du montant brut distribué (article 84)
- **Retenue ventes diamants/or/pierres précieuses** : 3% sur bordereaux d'achat (article 85)
- **Retenue prestataires étrangers non-résidents** : 15% sur CA (services rendus aux entreprises locales)
- **Régimes selon CA** : bénéfice réel simplifié (30M-100M FCFA HT) ; bénéfice réel (>100M FCFA HT) ; Impôt Global Unique IGU (petites entreprises, taux 8%)
- **Charte des investissements** : réduction possible de 25% de l'IS/IRPP et minimums associés pour entreprise conforme à la Charte
- **Pénalités officielles** : déclaration hors délai 1 000 000 FCFA ; insuffisance déclaration <10% du revenu = 25% des droits éludés (50% si >10%) ; manœuvre frauduleuse 100% ; taxation d'office 50% (100% si refus de contrôle)
- Cotisations CNSS RCA : déductibles de l'assiette IRPP, taux exact à confirmer

Fichier de référence projet : `lib/fiscalite-rca.ts`

## Guinée Équatoriale — ⚠️ RÉFORME FISCALE MAJEURE (Ley General Tributaria n°1/2024 du 19/11/2024, en vigueur depuis le 06/12/2024)

**Cette réforme remplace intégralement la loi fiscale de 2004. Toute donnée antérieure à décembre 2024 est obsolète.**

- **IS (Impuesto sobre Sociedades)** : réduit de **35% à 25%** sur bénéfices nets. Cuota Mínima Fiscal (taxe minimale) : 1,5% des revenus bruts, paiement fractionné en 2 semestres
- **IRPF (équivalent IRPP)** : réduit de **35% à 25%** (taux maximum). Décliné en plusieurs impôts séparés selon la nature du revenu (réforme structurelle similaire à l'ancien système cédulaire)
- **Impôt sur les bénéfices d'activité (indépendants/professions)** : réduit de 35% à 25%
- **Impôt sur le Revenu du Capital Mobilier** : réduit de **25% à 10%** pour résidents, de **25% à 15%** pour non-résidents (retenue à la source)
- **Impôt sur le Revenu du Capital Immobilier** : 10% sur loyers, 15% sur plus-values immobilières (sauf si soumis à l'IS)
- **Impôt sur Salaires et Traitements (ISS)** : taux maximum réduit de **35% à 25%**. Seuil d'exonération relevé de 1 000 000 à **1 400 000 XAF**
- **TVA (IVA)** : taux général maintenu à **15%**. Taux réduit abaissé de **6% à 5%** (produits alimentaires de base : viande, volaille, pain, riz, lait, aliments bébé, livres éducatifs). Taux zéro 0% (exportations, produits médicaux listés)
- **Nouveauté** : remboursement effectif des crédits de TVA désormais prévu par la loi (auparavant non remboursables en pratique)
- **Régime Spécial Activités Mineures (REAM)** : personnes physiques/familles avec revenus annuels ≤ 30 000 000 FCFA
- **Réduction droits de douane** : produits de première nécessité passés à un taux réduit de 5%, plus exonérations TVA élargies
- **Suppression de la majorité des exonérations fiscales historiques** — seules les exonérations explicitement listées dans la nouvelle loi restent valables
- **Autoliquidation et auto-paiement** introduits comme nouveau mécanisme déclaratif (simplification administrative)
- **Cotisations sociales INSESO** : patronal 21,5% + Fonds de Protection au Travail (WPF) 1% = 22,5% total patronal. Salaire minimum : 129 035 XAF (donnée 2025, à reconfirmer)
- Comptabilité OHADA obligatoire malgré le régime fiscal hispanophone hérité

Fichier de référence projet : `lib/fiscalite-guinee-equatoriale.ts` — **vérifier en priorité si ce fichier reflète encore les anciens taux 35%, à corriger immédiatement si c'est le cas**

## RDC — Réforme majeure 2026 confirmée par sources officielles (Lois n°23/052 et n°23/053 du 30/11/2023 + site officiel DGI)

**Changement structurel au 1er janvier 2026** : passage d'un système cédulaire (IBP, IPR séparés) à un système global avec deux impôts modernes — confirmé directement par le site officiel de la DGI (dgi.gouv.cd) :

- **IS** (remplace IBP) : **30%** confirmé officiellement par la DGI sur bénéfice net imposable. Taxe minimale **1% du CA** si déficit/bénéfice insuffisant (Loi 23/052, articles 4-20). Déclaration au plus tard le **30 avril** de l'année suivante. Report des pertes limité à 3 exercices. Plus-values : 20% (réévaluation libre) / 5% (réévaluation légale)
- **IRPP** (remplace IPR/IERE cédulaires) : impôt global confirmé par la DGI avec barème progressif. Tranche supérieure confirmée : **40%** au-delà de **43 200 000 FC**. Tranche immédiatement inférieure : 30% (21 600 001 à 43 200 000 FC). Regroupe désormais tous les revenus : salariaux, commerciaux, agricoles, mobiliers et fonciers (Loi 23/053, articles 2-25)
- **TVA** : **16%** confirmé officiellement par la DGI — biens et services consommés localement ET marchandises importées (taux historique inchangé depuis 2012)
- **Ancien régime IPR (cédulaire, en voie de remplacement)** : pour mémoire — 18% (personnes avec établissement en RDC), 30% (sans établissement), 90% (établissements bancaires/financiers sur prêts hors crédits agricoles/investissement) — ces taux relevaient du système d'avant le 01/01/2026, à vérifier s'ils subsistent en période transitoire
- **Facture normalisée obligatoire** depuis le 1er avril 2026 — conditionne le paiement effectif de la TVA (échéance 15 du mois suivant). Nombre de comptes actifs en forte hausse (4 925 → 6 968 entre janvier et mars 2026)
- **Comptabilité conforme aux normes OHADA révisées obligatoire** (RDC membre OHADA depuis 2012)
- Cotisations sociales INSS : taux à confirmer

⚠️ **Point d'attention critique pour oraforme** : si `lib/fiscalite-rdc.ts` contient encore une logique IBP/IPR cédulaire avec les anciens taux (18%/30%/90% par catégorie de bénéficiaire), il doit être migré vers le système IS (30% unique) / IRPP (barème global) — la réforme est **déjà en vigueur** à la date actuelle de juin 2026, ce n'est plus une réforme à venir.

Fichier de référence projet : `lib/fiscalite-rdc.ts`

## Douanes CEMAC — Tarif Extérieur Commun (TEC)

Commun aux 6 pays CEMAC (hors RDC, qui applique son propre tarif douanier) :
- Bande 0% : biens sociaux essentiels (riz, lait en poudre)
- Bande 5% : matières premières, biens d'équipement
- Bande 10% : intrants/produits intermédiaires
- Bande 20% : biens de consommation courante
- Bande 30% : biens de consommation finale/produits de luxe (alcools, tabacs avec droits d'accise additionnels)

Taxes douanières communautaires CEMAC (s'ajoutent au DD) :
- TVA à l'importation : taux national (voir tableau pays ci-dessus)
- TCI (Taxe Communautaire d'Intégration) : 1%
- TCD (Taxe de Coopération au Développement) : 0,4%
- Redevance statistique : 0,2%

Référence détaillée du module douanier complet : voir `lib/calculs-douane.ts` (module Import/Export oraforme).

## Règles transversales de codage fiscal

1. **Jamais de taux codé en dur sans commentaire de source** — chaque constante fiscale doit référencer : nom du texte légal, article, date de promulgation
2. **Toujours isoler par fichier `lib/fiscalite-{pays}.ts`** — ne jamais mutualiser une logique de calcul entre deux pays sans vérifier que les règles sont identiques (elles le sont rarement)
3. **Distinguer taux nominal vs taux effectif** — particulièrement Cameroun (IS 30%+CAC 10%) et IRPP avec centimes additionnels
4. **Toujours dater la donnée fiscale dans le commentaire de code** — les Lois de Finances changent chaque année, et un taux vérifié en 2026 doit être revérifié en 2027
5. **Avant d'écrire un module RH/paie multi-pays**, vérifier le pays exact car les cotisations sociales patronales varient de 20% (Gabon) à 23,3% (Congo) — un écart significatif sur le coût total employeur

## Quand rechercher avant de coder

Toujours rechercher une source à jour (DGI nationale, dernière Loi de Finances, CNSS/CNPS officielle) avant d'implémenter ou modifier un calcul fiscal si :
- Le taux n'apparaît pas dans ce skill avec une source claire
- La donnée date de plus d'un an (les Lois de Finances changent annuellement)
- Le champ est marqué "à confirmer" dans le tableau comparatif ci-dessus

## Limites de ce skill

Pour le droit comptable et des sociétés (plan de comptes, états financiers, formes juridiques) → voir skill `ohada-comptabilite`.
Pour le droit du travail, les contrats, la paie hors cotisations (préavis, licenciement, congés) → voir skill `droit-social-rh`.

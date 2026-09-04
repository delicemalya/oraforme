---
name: droit-social-rh
description: Utilise ce skill pour TOUT ce qui concerne le droit du travail et les ressources humaines dans le projet oraforme, couvrant la zone CEMAC (Congo-Brazzaville, Cameroun, Gabon, Tchad, RCA, Guinée Équatoriale) et la RDC. Déclenche-le pour contrats de travail (CDI/CDD), période d'essai, préavis, licenciement et indemnités, congés payés, durée légale du travail, heures supplémentaires, SMIG, bulletins de paie, et tout module RH/paie d'oraforme. Pour les cotisations sociales chiffrées (taux CNSS/CNPS) voir le skill fiscalite-cemac ; ce skill couvre le droit du travail lui-même (contrats, durées, procédures, indemnités).
---

# Droit Social & RH CEMAC + RDC — oraforme

## Principe directeur

Il n'existe **aucun Acte Uniforme OHADA sur le droit du travail** — chaque pays CEMAC + RDC garde son propre Code du Travail national. Les règles ci-dessous sont **nationales**, jamais "CEMAC génériques". Avant tout module RH multi-pays dans oraforme, toujours vérifier le pays exact du tenant.

Pour les taux de cotisations sociales (CNSS/CNPS, parts patronale/salariale) → voir le skill `fiscalite-cemac`. Ce skill-ci couvre le droit du travail substantiel : contrats, durées, procédures de rupture, indemnités.

## Tableau comparatif — éléments clés vérifiés par pays

| Pays | Durée légale travail | Congés payés | Période d'essai max | Préavis | SMIG |
|---|---|---|---|---|---|
| **Congo-Brazzaville** | 40h/semaine (8h/j) privé, 35h public | 26 jours ouvrables/an | 6 mois (Code du travail) | Variable selon ancienneté | 70 400 FCFA/mois (depuis 2025) |
| **Cameroun** | À confirmer (40h standard zone CEMAC) | 30 jours ouvrables/an minimum | À confirmer par catégorie | 15 jours minimum | 36 270 FCFA/mois (depuis 2014, à reconfirmer) |
| **Gabon** | À confirmer | 2,5 jours ouvrables/mois (= 30 jours/an) | Cadres 6 mois / techniciens-agents de maîtrise 3 mois / employés-ouvriers 1 mois (Art. 45 CT) | Variable, garanti minimum 2 mois si licenciement économique (Art. 67 CT) | À confirmer |
| **Tchad** | À confirmer | À confirmer | À confirmer | À confirmer | À confirmer |
| **RCA** | À confirmer | À confirmer | À confirmer | À confirmer | À confirmer |
| **Guinée Équatoriale** | À confirmer | À confirmer | À confirmer | À confirmer | À confirmer |
| **RDC** | 45h/semaine (à confirmer précisément) | À confirmer | Variable selon arrêté ministériel | Calculé selon ancienneté (Arrêté n°12/CAB.MIN/TPS/117/2005) — démission = moitié du préavis employeur | À confirmer |

**Champs "à confirmer" : ne jamais coder une valeur par défaut sans recherche de la source officielle (Code du Travail national, arrêté ministériel récent).** Les données ci-dessous pour le Tchad, la RCA et la Guinée Équatoriale n'ont pas encore été vérifiées via texte officiel — seul un sous-ensemble de pays a été confirmé en profondeur à ce stade (Congo, Cameroun partiel, Gabon, RDC partiel).

## Congo-Brazzaville (Code du Travail + obligations sociales des entreprises, fonction-publique.gouv.cg)

- **Durée légale** : 40h/semaine, 8h/jour (secteur privé) ; 35h (secteur public)
- **Repos hebdomadaire** : 1 jour (privé), 2 jours (public). Minimum légal : 24h consécutives
- **Travail de nuit** : 20h-5h, maximum 8h consécutives
- **Congés payés** : **26 jours ouvrables/an** de service effectif (sauf disposition conventionnelle plus favorable). Droit acquis après 1 an de présence. 26 jours assimilés à 1 mois de service effectif
- **Congé maternité** : 15 semaines payées
- **Période d'essai** : maximum **6 mois** (Code du travail)
- **Heures supplémentaires** : majoration 50% en semaine, 100% le dimanche
- **Licenciement** : doit reposer sur cause réelle et sérieuse (motif économique/technique : suppression/transformation substantielle du poste). Indemnités selon ancienneté
- **SMIG** : **70 400 FCFA/mois** depuis 2025
- **Travail des mineurs** : règles spécifiques en matière d'apprentissage (contrat écrit obligatoire, durée max 4 ans)
- **Contrat travailleur étranger** : obligatoirement écrit, quota de salariés étrangers réglementé
- **Obligations employeur CNSS** : immatriculation, déclaration de tout établissement/succursale avec adresse, signalement de changement d'activité/dénomination/localisation

Fichier de référence projet : `lib/droit-travail-congo.ts` (si existant), sinon à créer en miroir de `lib/fiscalite-congo.ts`

## Cameroun (Loi n°92/007 du 14/08/1992 portant Code du Travail)

- **Texte de référence** : Loi n°92/007 du 14 août 1992, modifiée par textes ultérieurs. Structure en Livres (Livre I : dispositions générales et champ d'application)
- **CDI** : forme normale et générale de la relation de travail, expresse ou tacite, sans terme prévu
- **CDD** : uniquement dans les cas limitativement énumérés par la loi
- **Congés payés** : **30 jours ouvrables/an minimum**. Jours fériés officiels (15 jours) s'ajoutent, non décomptés des congés
- **Préavis licenciement** : **15 jours minimum**, durée exacte fonction de l'ancienneté et de la catégorie professionnelle
- **Indemnité de licenciement (barème officiel, Art. 37 CT + Arrêté n°016/MTPS/SG/CJ du 26/05/1993)** :
  - 20% du salaire mensuel par année de service — 5 premières années
  - 25% — 6ᵉ à 10ᵉ année
  - 30% — 11ᵉ à 15ᵉ année
  - 35% — 16ᵉ à 20ᵉ année
  - 40% — après 21 ans de service
  - Condition : ancienneté minimum 2 années successives
- **Types de licenciement** : faute lourde (immédiat, sans préavis ni indemnité) ; faute simple (préavis + indemnité) ; motif économique (procédure spéciale, consultation représentants du personnel)
- **Contrat obligatoirement écrit et signé** : identité parties, poste, salaire, durée, lieu, horaires — tout contrat verbal n'a pas de valeur légale
- **SMIG** : 36 270 FCFA/mois depuis 2014 (décret n°2014-2343 du 05/08/2014) — **à reconfirmer, une revalorisation est en discussion**
- Inspection du travail rattachée au Ministère du Travail et de la Sécurité Sociale

Fichier de référence projet : `lib/droit-travail-cameroun.ts` (à créer)

## Gabon (Code du Travail, version consolidée droit-afrique.com)

- **CDD** : maximum 2 ans
- **Période d'essai (Art. 45 CT)**, plafonds légaux par catégorie :
  - Cadres : **6 mois maximum**
  - Techniciens et agents de maîtrise : **3 mois maximum**
  - Employés et ouvriers : **1 mois maximum**
  - Pour un CDD : durée d'essai souvent calculée à raison d'1 jour par semaine de contrat prévu, dans la limite des plafonds ci-dessus
  - Rupture pendant l'essai : possible à tout moment, sans préavis ni indemnité (sauf disposition conventionnelle plus favorable)
- **Congés payés** : **2,5 jours ouvrables par mois** travaillé (= 30 jours/an)
- **Préavis licenciement économique (Art. 50 + 67 CT)** : minimum garanti **2 mois**, quelle que soit la qualification professionnelle, + 6 mois d'allocations familiales avec dispense de la condition d'activité de service
- **Pendant le préavis** : 1 jour de liberté par semaine pour recherche d'emploi (pris globalement)
- **Procédure de licenciement (hors faute grave)** : entretien préalable obligatoire + notification écrite
- **Indemnités dues au salarié licencié (hors faute grave)** :
  - Indemnité de licenciement (calculée sur dernier salaire + ancienneté, minimum légal + conventions collectives)
  - Indemnité compensatrice de congés payés (congés acquis non pris)
  - Indemnité compensatrice de préavis (si dispense de travailler pendant le préavis)
- **CDD arrivé à terme** : seules indemnité de fin de contrat + indemnité congés payés sont dues
- **13ᵉ mois** : non obligatoire légalement (pratique répandue par convention collective/accord d'entreprise)
- **Déclaration CNSS obligatoire** par l'employeur
- Recours possibles : Inspection du Travail, Prud'hommes
- SMIG : à reconfirmer (révisé périodiquement par décret présidentiel)

Fichier de référence projet : `lib/droit-travail-gabon.ts` (à créer)

## Tchad — données à vérifier

Aucune source officielle du Code du Travail tchadien n'a encore été consultée en détail pour ce skill. **Ne pas coder de valeurs par défaut** (durée légale, congés, préavis, SMIG) sans recherche préalable d'une source officielle (Ministère du Travail tchadien, Code du Travail national).

Fichier de référence projet : `lib/droit-travail-tchad.ts` (à créer après recherche)

## République Centrafricaine — données à vérifier

Le Code Général des Impôts RCA a été consulté en détail (voir skill `fiscalite-cemac`), mais pas le Code du Travail centrafricain. Quelques éléments indirects glanés via le CGI (article 35, exonérations IRPP) :
- Indemnités de licenciement/départ volontaire dans le cadre d'un plan social : exonérées d'IRPP
- Primes/indemnités de départ à la retraite : exonérées dans la limite de 15% (minimum 1 000 000 FCFA)
- Pensions pour accident du travail : prises en charge spécifiquement

Pour la durée légale, les congés payés, le préavis exact et le SMIG : **rechercher le Code du Travail centrafricain avant tout codage**.

Fichier de référence projet : `lib/droit-travail-rca.ts` (à créer après recherche)

## Guinée Équatoriale — données à vérifier

Non consulté en détail pour ce skill. Avant tout codage RH pour ce pays, rechercher le Código del Trabajo équato-guinéen officiel. Note de contexte utile : le salaire minimum mentionné dans une source secondaire était de 129 035 XAF (2025) — **à vérifier via source officielle avant utilisation**.

Fichier de référence projet : `lib/droit-travail-guinee-equatoriale.ts` (à créer après recherche)

## RDC (Code du Travail + Arrêté Ministériel n°12/CAB.MIN/TPS/117/2005 du 26/10/2005)

- **Préavis** : durée fixée par arrêté ministériel selon l'ancienneté (barème précis à extraire de l'arrêté n°12/CAB.MIN/TPS/117/2005 — non encore détaillé dans les sources consultées)
- **Démission (préavis dû par le salarié)** : environ la **moitié** du préavis que l'employeur devrait respecter pour la même ancienneté (article 64 CT)
- **Licenciement avec motif grave pendant le préavis** : le salarié ne peut plus réclamer d'indemnité de préavis complémentaire
- **Licenciement sans préavis ou préavis non intégralement respecté** : l'employeur doit une indemnité égale à la rémunération + avantages dus pendant la période de préavis non effectuée
- **Licenciement abusif (sans motif valable) d'un CDI** : droit à réintégration ou, à défaut, dommages-intérêts fixés par le Tribunal du travail (nature des services, ancienneté, âge, droits acquis) — **plafond légal : 36 mois de la dernière rémunération**
- **Faute lourde** : licenciement possible sans indemnité de licenciement, sans indemnité compensatrice de préavis, ni indemnité compensatrice de congés payés
- **Licenciement collectif/massif** : interdit par principe (Art. 2 Arrêté ministériel sur les modalités de licenciement), sauf dérogations déterminées par ce même arrêté

Fichier de référence projet : `lib/droit-travail-rdc.ts` (à créer)

## Structure de contrat de travail recommandée pour oraforme (toutes juridictions)

Champs obligatoires communs identifiés à travers les pays vérifiés :
- Identité complète des parties (employeur + salarié)
- Nature du poste / fonction
- Salaire (montant + périodicité)
- Durée du contrat (CDI/CDD + terme si CDD)
- Lieu de travail
- Horaires de travail
- Date de début du contrat
- Mention de la période d'essai si applicable (durée selon catégorie et pays)
- Signature des deux parties — **un contrat verbal n'a de valeur légale dans aucun des pays vérifiés**

Le module contrat d'oraforme doit obligatoirement adapter les champs suivants au pays du tenant :
- Plafonds légaux de période d'essai (varient par catégorie professionnelle ET par pays)
- Barème d'indemnité de licenciement (le barème camerounais par tranches d'ancienneté ne s'applique pas ailleurs)
- Durée de préavis (varie significativement : Cameroun 15 jours minimum vs Gabon 2 mois minimum si motif économique)

## Règles transversales pour le code RH oraforme

1. **Jamais de barème de licenciement codé en dur partagé entre pays** — le barème camerounais (20%/25%/30%/35%/40% par tranche d'ancienneté) est spécifique au Cameroun, ne pas le réutiliser pour le Gabon ou le Congo
2. **Toujours vérifier le statut "confirmé" vs "à confirmer"** dans ce skill avant d'écrire une valeur par défaut dans le code — pour le Tchad, la RCA, et la Guinée Équatoriale, aucune donnée RH n'est encore confirmée par une source officielle
3. **Distinguer clairement, dans tout calcul d'indemnité** : indemnité de licenciement proprement dite vs indemnité compensatrice de préavis vs indemnité compensatrice de congés payés — ce sont trois éléments distincts, souvent confondus, qui ont des règles d'exonération fiscale différentes (voir skill `fiscalite-cemac` pour le traitement IRPP de chacun)
4. **Le SMIG est une donnée volatile** — toujours dater la valeur codée et prévoir une revalidation annuelle, certains chiffres collectés ici remontent à des décrets de plusieurs années (ex. Cameroun 2014)
5. **Le préavis dû par le salarié (démission) diffère souvent du préavis dû par l'employeur** (ex. RDC : moitié du préavis employeur) — ne pas coder un seul champ "préavis" symétrique par défaut

## Quand rechercher avant de coder

Rechercher une source officielle (Code du Travail national consolidé, arrêté ministériel récent, Ministère du Travail) avant d'implémenter tout calcul RH si :
- Le pays concerné est marqué "à vérifier" dans ce skill (Tchad, RCA, Guinée Équatoriale)
- La donnée codée concerne un SMIG, une durée de préavis, ou un barème d'indemnité non explicitement confirmé ci-dessus
- La donnée disponible ici date de plus de 2 ans (les Codes du Travail sont révisés moins fréquemment que les Lois de Finances, mais les décrets SMIG et arrêtés d'application changent régulièrement)

## Limites de ce skill

Pour les taux de cotisations sociales chiffrés (CNSS/CNPS/INSESO, parts patronale et salariale) et leur traitement fiscal (IRPP sur indemnités) → voir le skill `fiscalite-cemac`.
Pour le droit des sociétés (forme juridique de l'employeur, SARL/SA/SAS) et la comptabilisation des charges de personnel (classe 6 SYSCOHADA) → voir le skill `ohada-comptabilite`.

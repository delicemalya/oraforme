---
name: assurance-cima
description: Utilise ce skill pour concevoir ou développer tout module ou application d'assurance dans la zone CIMA (Conférence Interafricaine des Marchés d'Assurances — 14 pays dont Congo, Cameroun, Gabon, Tchad, RCA, Guinée Équatoriale) — fonctionnement type SUNU, NSIA, AXA, Allianz Afrique. Couvre les branches d'assurance vie et non-vie, souscription de contrats, gestion de sinistres, marge de solvabilité réglementaire, provisions techniques, réseau d'intermédiaires (agents, courtiers), réassurance, et bancassurance. Déclenche-le pour tout projet de plateforme assurantielle, de gestion de polices, ou de module assurance intégré à un ERP/SaaS en zone CEMAC/CIMA.
---

# Assurance — Zone CIMA (type SUNU, NSIA) — SaaS / Module ERP

## Cadre réglementaire — la CIMA en bref

La **CIMA** (Conférence Interafricaine des Marchés d'Assurances) est l'autorité de régulation unique pour 14 pays d'Afrique francophone, dont les 6 pays CEMAC déjà couverts par oraforme (Congo, Cameroun, Gabon, Tchad, RCA, Guinée Équatoriale). Toute société d'assurance opérant dans ces pays est régie par le **Code des assurances CIMA**, unique et identique dans tous les États membres — c'est un atout architectural majeur : une logique métier conforme CIMA fonctionne sans adaptation pays par pays, à la différence de la fiscalité (skill `fiscalite-cemac`) qui reste nationale.

L'organe de contrôle est la **CRCA** (Commission Régionale de Contrôle des Assurances), qui supervise la solvabilité et la conformité de toutes les sociétés agréées dans la zone.

## Les deux grandes familles de branches — structure centrale du modèle de données

Le Code CIMA distingue strictement deux catégories d'opérations, avec des règles de solvabilité et de gestion financière différentes (article 328 et suivants) :

```
BRANCHES NON-VIE (branches 1 à 18 du Code CIMA)
  — Couvrent un risque sur une période courte (généralement annuelle, renouvelable)
  — Provisionnement basé sur la sinistralité, pas d'épargne accumulée pour l'assuré

BRANCHES VIE ET CAPITALISATION (branches 20 à 23 du Code CIMA)
  — Engagements de long terme, avec accumulation de provisions mathématiques
  — Logique financière proche de l'épargne/investissement
```

**Une société d'assurance type SUNU ou NSIA opère souvent via des entités juridiques séparées pour le Vie et le Non-Vie** (ex: "SUNU Assurances Vie Cameroun" et "SUNU Assurances IARD Cameroun" sont deux sociétés distinctes) — c'est une contrainte structurelle du Code CIMA à respecter dans la modélisation multi-entité d'un SaaS assurantiel, pas un simple choix d'organisation.

### Répartition du marché non-vie par poids (donnée de référence zone CIMA)
```
Automobile : ~31% des primes non-vie (branche historiquement dominante)
Accidents corporels & maladie : ~27,5%
Incendie et autres dommages aux biens : ~17,5%
Responsabilité civile générale : part croissante (+157% sur 10 ans)
Transport : part marginale mais en croissance
```

## Capital social et conditions d'agrément — pour le module onboarding compagnie

Pour toute fonctionnalité de paramétrage ou d'onboarding d'une société d'assurance dans le SaaS :

```
Capital social minimum (sociétés agréées après le 1er juin 2016) :
  - Société anonyme d'assurance : 5 milliards FCFA
  - Société d'assurance mutuelle (fonds d'établissement) : 3 milliards FCFA
  - Société de microassurance (forme SA) : 500 millions FCFA
```

Ces seuils élevés expliquent pourquoi le marché CIMA est dominé par un nombre limité de grands groupes (SUNU, NSIA, AXA, Allianz, Saham/Sanlam représentent environ 53% du chiffre d'affaires de la zone) plutôt que par une multitude de petits acteurs — un SaaS visant ce secteur s'adresse donc à un nombre d'entités relativement restreint mais à fort volume de transactions chacune.

## Marge de solvabilité — calcul réglementaire pour modules de reporting prudentiel

La marge de solvabilité est l'indicateur prudentiel central que toute société d'assurance CIMA doit calculer et présenter à la CRCA. Deux méthodes de calcul coexistent selon la branche :

### Pour les branches non-vie (IARD) — méthode au choix entre deux approches

**Méthode 1 — basée sur les primes** :
```
Marge minimale = 20% du total des primes émises (nettes d'annulations)
                  × ratio (sinistres nets de réassurance / sinistres bruts)
Ce ratio ne peut jamais être inférieur à 50% (plancher réglementaire — limite la déduction
liée à la réassurance pour éviter une sous-capitalisation artificielle)
```

**Méthode 2 — basée sur la charge moyenne de sinistres** :
```
Basée sur le total des sinistres payés sur les 3 derniers exercices + provisions pour sinistres à payer,
avec le même mécanisme de ratio de réassurance et le même plancher de 50%
```

### Pour les branches vie et capitalisation
```
Marge minimale = 5% des provisions mathématiques (brutes de réassurance)
                  × ratio (provisions mathématiques après cession / provisions brutes)
Ce ratio ne peut jamais être inférieur à 85% (plancher réglementaire, plus strict qu'en non-vie
car l'engagement vie est de plus long terme)
```

### Pour une société opérant les deux familles de branches
```
Marge minimale totale = somme des deux marges calculées séparément
```

**Pour un module de reporting prudentiel dans un SaaS assurantiel** : le calcul de la marge de solvabilité disponible (les fonds propres et éléments assimilés admissibles) suit des règles de composition précises (fonds propres, emprunts subordonnés admis jusqu'à 50% de la marge, plus-values latentes sous conditions) — un module de calcul automatisé doit implémenter cette composition exacte plutôt qu'une approximation simplifiée, car c'est un chiffre soumis à contrôle réglementaire direct par la CRCA.

## Cycle de vie d'un contrat d'assurance — structure pour le module souscription

```
1. DEVIS / TARIFICATION
   - Évaluation du risque (questionnaire de risque, déclaration de l'assuré)
   - Calcul de la prime selon le barème tarifaire de la branche
   - Le Code CIMA impose une déclaration honnête du risque par l'assuré (article 7 et suivants) —
     toute omission ou fausse déclaration peut entraîner nullité ou réduction d'indemnité

2. SOUSCRIPTION
   - Émission de la police (contrat écrit obligatoire dans la langue officielle de l'État membre)
   - Prise d'effet (souvent différée de minuit le jour suivant le paiement de la première prime,
     sauf stipulation contraire)

3. VIE DU CONTRAT
   - Encaissement des primes (périodicité : annuelle, semestrielle, mensuelle selon contrat)
   - Avenants (toute modification doit être constatée par écrit)
   - Renouvellement (tacite ou non selon les conditions générales)

4. SINISTRE (voir section dédiée ci-dessous)

5. RÉSILIATION
   - À l'initiative de l'assureur ou de l'assuré, selon les motifs et délais de préavis prévus
   - Résiliation de plein droit en cas de non-paiement de prime après mise en demeure
     (délai de 45 jours minimum avant l'avis d'échéance, puis suspension de garantie)
```

## Module Sinistres — workflow de gestion

```
1. DÉCLARATION DU SINISTRE
   - Délai de déclaration (généralement court, 5 jours ouvrés usuels sauf vol/délai spécifique
     par branche — à vérifier dans les conditions générales du produit concerné)
   - Pièces justificatives requises (variable selon la branche : constat amiable pour auto,
     certificat médical pour santé/accidents corporels, etc.)

2. INSTRUCTION / EXPERTISE
   - Désignation d'un expert si nécessaire (dommages matériels significatifs)
   - Vérification de la garantie (le sinistre est-il couvert par les conditions du contrat ?)
   - Vérification de la prime (contrat à jour de paiement ?)

3. ÉVALUATION DE L'INDEMNITÉ
   - Calcul selon le type de garantie (valeur à neuf, valeur d'usage, capital fixe pour la vie)
   - Application des franchises contractuelles
   - Application du recours subrogatoire si un tiers responsable est identifié (l'assureur qui
     indemnise se substitue à l'assuré dans son recours contre le responsable)

4. RÈGLEMENT
   - Paiement de l'indemnité (mode : virement, chèque, Mobile Money — privilégier les rails
     locaux dominants en zone CEMAC pour l'expérience assuré)
   - Clôture du dossier sinistre

5. PROVISIONNEMENT (en parallèle, côté gestion technique de la compagnie)
   - Provision pour sinistres à payer (PSAP) dès la déclaration, ajustée à chaque étape
   - Cette provision alimente directement le calcul de la marge de solvabilité (voir ci-dessus)
```

**Point d'architecture clé** : un sinistre déclaré doit immédiatement générer une provision technique côté comptabilité de la compagnie, **avant même le règlement effectif** — le lien entre le module sinistres et le module provisions techniques/comptabilité doit être automatique, pas une saisie manuelle différée, sous peine de fausser la marge de solvabilité affichée à un instant donné.

## Réseau de distribution — agents, courtiers, bancassurance

Pour un SaaS visant à digitaliser le réseau de distribution d'une compagnie type SUNU/NSIA, trois canaux structurellement différents à modéliser :

```
AGENTS GÉNÉRAUX — mandataires exclusifs d'une compagnie, rémunérés à la commission
COURTIERS — indépendants, peuvent placer des contrats auprès de plusieurs compagnies,
            rémunérés à la commission par la compagnie qui porte le risque
BANCASSURANCE — distribution via le réseau d'une banque partenaire (SUNU l'a développée
                fortement au Cameroun, notamment avec Advans pour la microfinance)
```

Chaque canal nécessite un suivi de commission distinct et une traçabilité de l'apporteur d'affaires sur chaque contrat — essentiel pour le calcul de rémunération et pour la conformité (un contrat doit toujours être rattachable à l'intermédiaire qui l'a apporté).

## Réassurance — notion essentielle pour comprendre les calculs de marge

La réassurance (céder une partie du risque à un réassureur) impacte directement :
- Le calcul de la marge de solvabilité (les ratios de réassurance évoqués plus haut)
- Le résultat technique réel de la compagnie (primes cédées, sinistres récupérés auprès du réassureur)

Pour un module de gestion technique complet, chaque police et chaque sinistre doivent pouvoir porter une **quote-part cédée en réassurance**, avec calcul automatique de la part nette restant à la charge de la compagnie — cette donnée est structurellement nécessaire au calcul réglementaire de la marge, pas une fonctionnalité accessoire.

## États réglementaires à produire — pour modules de reporting CRCA

Le Code CIMA impose des états comptables et statistiques normalisés (articles 422 et suivants), parmi lesquels :
```
État C1 — compte technique par catégorie/branche (vie et non-vie séparément)
État C10 — paiements et provisions pour sinistres (vue pluriannuelle par exercice de survenance)
État C20/C21 — mouvements des polices, capitaux et rentes assurés (spécifique vie)
État C25 — participation des assurés aux résultats techniques et financiers
```

Un module de reporting réglementaire CIMA devrait viser, à terme, la génération automatisée de ces états directement depuis les données de gestion technique (polices, primes, sinistres) plutôt qu'une ressaisie manuelle — c'est un axe de valeur différenciant pour un SaaS visant ce secteur.

## Quand rechercher avant de coder

- Les délais précis de déclaration de sinistre, de carence, et de préavis de résiliation varient selon la branche et sont fixés par les conditions générales de chaque produit — ne jamais coder un délai universel sans le faire valider par un professionnel de l'assurance ou la documentation produit réelle
- Les barèmes tarifaires (calcul de prime selon le risque) sont propres à chaque compagnie et confidentiels — ce skill ne peut pas fournir de grille tarifaire, seulement la structure du calcul
- Le Code CIMA est amendé régulièrement par des règlements d'application (comme celui de 2016 sur le capital minimum) — vérifier qu'un seuil ou une règle citée ici n'a pas été mise à jour par un texte plus récent avant de l'implémenter en dur dans le code

## Limites de ce skill

Pour la fiscalité applicable aux primes d'assurance et aux indemnités versées (taxes sur les conventions d'assurance, le cas échéant selon le pays) → voir skill `fiscalite-cemac`.
Pour la comptabilisation des opérations d'assurance selon le plan comptable applicable → voir skill `ohada-comptabilite` (note : les compagnies d'assurance CIMA suivent un plan comptable spécifique distinct du SYSCOHADA général, propre au secteur — à rechercher spécifiquement si un module de comptabilité technique assurance est développé).
Pour le droit du travail des employés/agents d'une compagnie d'assurance → voir skill `droit-social-rh`.

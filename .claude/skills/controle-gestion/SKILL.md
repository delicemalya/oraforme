---
name: controle-gestion
description: Utilise ce skill pour tout module de contrôle de gestion dans oraforme — budgets, écarts budgétaires, coûts (de revient, marginal, complet, ABC), tableaux de bord de pilotage, indicateurs de performance (KPI), reporting de gestion, comptabilité analytique, seuils de rentabilité, et allocation de ressources. Distinct de la comptabilité générale SYSCOHADA (voir skill ohada-comptabilite) : le contrôle de gestion produit une information de pilotage interne, pas les états financiers légaux. Déclenche-le pour tout module Budget, BI analytique, simulateur de coûts, ou tableau de bord décisionnel dans oraforme.
---

# Contrôle de Gestion — oraforme

## Frontière avec les autres skills

Le contrôle de gestion **n'est pas** la comptabilité générale. Il faut bien distinguer :
- **Comptabilité générale** (skill `ohada-comptabilite`) : produit les états financiers légaux obligatoires (Bilan, Compte de résultat, TAFIRE), destinés à des tiers externes (administration fiscale, associés, banques)
- **Comptabilité analytique / Contrôle de gestion** (ce skill) : produit une information de pilotage interne, à la fréquence et au découpage choisis par l'entreprise (par produit, par centre de coût, par projet, par client), sans valeur légale propre

Dans oraforme, ces deux couches doivent rester **architecturalement séparées** dans le code : la comptabilité analytique se nourrit des écritures de la comptabilité générale (classe 6 et 7 SYSCOHADA notamment) mais ne doit jamais modifier ou contourner les écritures légales.

## Les méthodes de calcul de coûts — quand utiliser chacune

| Méthode | Principe | Cas d'usage typique oraforme |
|---|---|---|
| **Coût complet (full costing)** | Affecte toutes les charges (directes + indirectes) au produit/service | Tarification de vente, valorisation des stocks pour le bilan |
| **Coût marginal** | Coût de production d'une unité supplémentaire | Décision d'acceptation d'une commande exceptionnelle, prix plancher |
| **Coût variable (direct costing)** | Sépare charges variables/fixes, calcule la marge sur coût variable | Analyse de rentabilité produit, décision d'arrêt d'une activité |
| **Méthode ABC (Activity-Based Costing)** | Répartit les charges indirectes selon les activités consommées, via des "inducteurs de coût" | PME multi-activités où les clés de répartition uniques (ex: % du CA) faussent la rentabilité réelle par produit |
| **Coût standard / coût préétabli** | Coût théorique calculé a priori, comparé au coût réel (calcul d'écarts) | Module budgétaire, contrôle de production industrielle |

## Le triptyque Charges directes / Charges indirectes / Centres de coûts

Structure de base pour tout moteur de comptabilité analytique :

```
Charges directes : affectables sans ambiguïté à un objet de coût (produit, service, projet)
Charges indirectes : nécessitent une clé de répartition (ex: loyer, administration générale)
Centre de coût : unité organisationnelle homogène (atelier, service, agence) qui regroupe des charges
                avant répartition vers les objets de coût finaux
```

Dans un module ERP comme oraforme, chaque charge enregistrée en comptabilité générale (compte de classe 6) doit pouvoir être **taguée** avec :
- Un centre de coût (obligatoire si la charge n'est pas 100% directe)
- Un objet de coût final (produit, projet, client) si directement affectable
- Une clé de répartition si la charge est indirecte et doit être éclatée

## Gestion budgétaire — cycle complet

1. **Élaboration budgétaire** : construction du budget par centre de responsabilité, généralement annuelle avec révisions trimestrielles (budget glissant / rolling forecast)
2. **Engagement budgétaire** : réservation de crédit avant la dépense réelle (mécanisme à intégrer dans le module achats/dépenses d'oraforme pour éviter les dépassements non anticipés)
3. **Suivi des réalisations** : rapprochement périodique réalisé vs budgété
4. **Analyse des écarts** (voir section suivante)
5. **Actions correctives** : reforecast, réallocation entre centres, gel de dépenses

### Analyse des écarts budgétaires — formules de référence

**Écart global** = Coût réel − Coût budgété (standard)

**Décomposition classique pour les charges variables** :
- **Écart sur quantité (volume)** = (Quantité réelle − Quantité standard) × Prix standard
- **Écart sur prix/coût unitaire** = (Prix réel − Prix standard) × Quantité réelle

**Pour les charges fixes (centres de coûts)** :
- **Écart sur budget** = Charges fixes réelles − Charges fixes budgétées
- **Écart sur activité (imputation)** = lié à la différence entre activité réelle et activité normale prévue

**Convention de signe à respecter dans le code** : un écart est dit **favorable** quand il améliore le résultat (charge réelle < charge budgétée, ou produit réel > produit budgété), **défavorable** dans le cas contraire. Toujours afficher le sens de l'écart explicitement dans l'UI (couleur verte/rouge + libellé), jamais seulement un chiffre signé qui peut être mal interprété par l'utilisateur final.

## Seuil de rentabilité et structure de marge

```
Marge sur coût variable = Chiffre d'affaires − Charges variables
Taux de marge sur coût variable = Marge sur coût variable / Chiffre d'affaires

Seuil de rentabilité (point mort, en valeur) = Charges fixes / Taux de marge sur coût variable
Point mort (en date) = (Seuil de rentabilité / CA annuel) × 360 jours

Marge de sécurité = CA réel − Seuil de rentabilité
Indice de sécurité = Marge de sécurité / CA réel
```

Module recommandé pour oraforme : simulateur de seuil de rentabilité par activité/produit, permettant à l'utilisateur de faire varier charges fixes et taux de marge pour visualiser l'impact sur le point mort (cas d'usage naturel pour un widget interactif).

## Indicateurs de performance (KPI) — catégories pour tableaux de bord

| Catégorie | Exemples d'indicateurs | Fréquence de suivi recommandée |
|---|---|---|
| **Rentabilité** | Marge brute, marge nette, EBE/EBITDA, ROI, ROE | Mensuelle |
| **Activité** | CA par produit/zone/client, taux de croissance, panier moyen | Mensuelle/hebdomadaire |
| **Trésorerie** | BFR (Besoin en Fonds de Roulement), délai de rotation des stocks, DSO (délai de paiement clients), DPO (délai de paiement fournisseurs) | Hebdomadaire |
| **Productivité** | CA par employé, taux d'occupation, rendement machine | Mensuelle |
| **Qualité/Process** | Taux de rebut, taux de retour, délai de traitement commande | Selon activité |

### Formules clés BFR/trésorerie pour le module dashboard

```
BFR = Stocks + Créances clients − Dettes fournisseurs

DSO (Days Sales Outstanding) = (Créances clients / CA TTC) × 360
DPO (Days Payable Outstanding) = (Dettes fournisseurs / Achats TTC) × 360
Délai de rotation des stocks = (Stock moyen / Coût d'achat des marchandises vendues) × 360
```

Ces formules doivent utiliser les comptes SYSCOHADA correspondants (classe 3 pour stocks, 411 pour créances clients, 401 pour dettes fournisseurs) — toujours référencer le plan de comptes du skill `ohada-comptabilite` pour garantir la cohérence entre comptabilité générale et tableaux de bord analytiques.

## Reporting de gestion — bonnes pratiques pour oraforme

1. **Toujours dater et versionner chaque rapport de gestion** — un tableau de bord doit indiquer la date d'extraction des données et la période analysée sans ambiguïté
2. **Distinguer données provisoires (non clôturées) vs données définitives (après clôture comptable)** — afficher un badge "provisoire" sur tout dashboard alimenté par des écritures non validées
3. **Cohérence des devises** : tous les calculs de pilotage en zone CEMAC se font en FCFA (XAF), pas de conversion implicite
4. **Granularité configurable** : permettre à l'utilisateur de choisir le découpage analytique (par centre de coût, par produit, par projet) sans dupliquer la logique de calcul sous-jacente
5. **Drill-down obligatoire** : tout chiffre agrégé affiché dans un tableau de bord doit permettre de redescendre jusqu'aux écritures comptables sources (traçabilité)

## Quand rechercher avant de coder

- Avant d'implémenter un module de comptabilité analytique sectorielle spécifique (ex: coûts hospitaliers, coûts de la construction), rechercher les méthodes reconnues du secteur — les principes ci-dessus sont génériques et peuvent nécessiter une adaptation
- Avant de fixer des seuils de KPI "bons/mauvais" par défaut dans l'UI, vérifier qu'ils sont pertinents pour le secteur d'activité du tenant — un DSO de 60 jours peut être normal dans un secteur, alarmant dans un autre

## Limites de ce skill

Pour la comptabilité générale et les états financiers légaux SYSCOHADA → voir skill `ohada-comptabilite`.
Pour l'analyse financière externe (ratios de solvabilité, structure du bilan, financement) → voir skill `finance-entreprise`.
Pour la vérification/certification des comptes → voir skill `audit-comptable`.

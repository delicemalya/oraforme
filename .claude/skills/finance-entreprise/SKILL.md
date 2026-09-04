---
name: finance-entreprise
description: Utilise ce skill pour tout module de finance d'entreprise dans oraforme — analyse financière externe (ratios de solvabilité, liquidité, rentabilité, structure financière), Bilan et lecture financière, TAFIRE, modules de Business Intelligence avancée sur données financières, décisions de financement (emprunt, autofinancement, capital), évaluation d'entreprise, et plans de trésorerie prévisionnels. Distinct du contrôle de gestion interne (skill controle-gestion) : ici on analyse la santé financière globale de l'entreprise du point de vue d'un investisseur, banquier, ou dirigeant, à partir des états financiers déjà produits.
---

# Finance d'Entreprise — oraforme

## Frontière avec les autres skills

Ce skill s'appuie sur les **états financiers déjà produits** (Bilan, Compte de résultat, TAFIRE — voir skill `ohada-comptabilite`) pour en tirer une lecture financière externe : capacité de remboursement, solidité financière, rentabilité pour les actionnaires. C'est la perspective d'un analyste financier, d'un banquier, ou du dirigeant pilotant la structure financière globale — par opposition au contrôle de gestion (skill `controle-gestion`) qui pilote l'activité opérationnelle interne au jour le jour.

## Lecture du Bilan SYSCOHADA — retraitements pour l'analyse financière

Le Bilan comptable brut doit souvent être retraité pour l'analyse financière (Bilan fonctionnel ou Bilan financier) :

```
ACTIF (Bilan fonctionnel)                    PASSIF (Bilan fonctionnel)
─────────────────────────                    ──────────────────────────
Emplois stables                              Ressources stables
  Immobilisations brutes                        Capitaux propres
                                                 Amortissements/provisions (ajoutés ici)
                                                 Dettes financières (classe 16)

Actif circulant d'exploitation                Passif circulant d'exploitation
  Stocks, créances clients (411)                Dettes fournisseurs (401)
                                                 Dettes fiscales/sociales (44x, 43x)

Actif circulant hors exploitation             Passif circulant hors exploitation
  Créances diverses                              Dettes diverses

Trésorerie active (52x, 57x)                  Trésorerie passive (concours bancaires courants)
```

## Ratios financiers — formules de référence pour modules d'analyse

### Ratios de structure financière

```
Autonomie financière = Capitaux propres / Total des ressources stables
  → Seuil d'alerte usuel : < 20% signale une forte dépendance à l'endettement

Capacité de remboursement = Dettes financières / CAFA (Capacité d'Autofinancement)
  → Seuil d'alerte usuel : > 4-5 ans signale une capacité de remboursement tendue

Couverture des emplois stables = Ressources stables / Emplois stables
  → Doit être ≥ 1 (sinon, une partie des immobilisations est financée par du court terme,
    situation structurellement risquée)
```

### Ratios de liquidité

```
Liquidité générale = Actif circulant (incl. trésorerie) / Passif circulant
  → Doit être > 1 pour une situation de liquidité saine

Liquidité réduite = (Créances + Trésorerie) / Passif circulant
  → Exclut les stocks, plus prudent

Liquidité immédiate = Trésorerie active / Passif circulant
```

### Ratios de rentabilité

```
Rentabilité économique (ROA approché) = Résultat d'exploitation / Total actif
Rentabilité financière (ROE) = Résultat net / Capitaux propres
Taux de marge brute = Marge brute / Chiffre d'affaires
Taux de marge nette = Résultat net / Chiffre d'affaires
```

### Capacité d'Autofinancement (CAFA) — calcul SYSCOHADA

Deux méthodes, doivent donner le même résultat (à utiliser en contrôle croisé dans le code) :

**Méthode additive (à partir du résultat net)** :
```
CAFA = Résultat net
     + Dotations aux amortissements et provisions (charges calculées, classe 68)
     - Reprises sur amortissements et provisions (produits calculés, classe 78)
     - Plus-values de cession d'immobilisations
     + Moins-values de cession d'immobilisations
```

**Méthode soustractive (à partir de l'EBE)** :
```
CAFA = Excédent Brut d'Exploitation (EBE)
     + Produits encaissables (hors produits de cession)
     - Charges décaissables (hors charges calculées)
```

```
Autofinancement = CAFA − Dividendes distribués
```

La CAFA est une donnée centrale du TAFIRE OHADA — tout module de génération automatique du TAFIRE dans oraforme doit calculer la CAFA selon ces deux méthodes et alerter en cas d'écart (signe d'erreur dans les données sources).

## Le TAFIRE — structure pour module de génération automatique

Le TAFIRE (Tableau Financier des Ressources et des Emplois) est spécifique à l'espace OHADA — équivalent fonctionnel d'un tableau de flux de trésorerie, mais avec sa structure propre :

```
1. Détermination de la CAFA (voir formules ci-dessus)
2. Ressources de financement de l'exercice :
   - CAFA
   - Cessions d'immobilisations
   - Augmentation de capital
   - Nouveaux emprunts
3. Emplois de l'exercice :
   - Distribution de dividendes
   - Acquisitions d'immobilisations
   - Remboursement d'emprunts
4. Variation du Besoin en Fonds de Roulement (BFR)
5. Variation de la trésorerie nette
```

Un module TAFIRE automatisé dans oraforme doit pouvoir tracer chaque ligne jusqu'aux écritures comptables sources (classe 2 pour les mouvements d'immobilisations, classe 16 pour les emprunts, etc.) — cohérent avec l'exigence de drill-down du skill `controle-gestion`.

## Décisions de financement — éléments d'analyse pour modules de simulation

### Choix emprunt vs autofinancement vs augmentation de capital

| Critère | Emprunt | Autofinancement | Augmentation de capital |
|---|---|---|---|
| Coût | Intérêts (déductibles fiscalement) | Coût d'opportunité | Dilution du contrôle, dividendes futurs |
| Délai de mobilisation | Moyen (procédure bancaire) | Immédiat si trésorerie disponible | Long (formalisme AUSCGIE — assemblée générale, formalités) |
| Impact sur la structure financière | Augmente l'endettement, effet de levier possible | Neutre sur la structure | Renforce les capitaux propres |
| Risque | Charge fixe (remboursement) même si activité en baisse | Aucun risque de remboursement | Aucun risque de remboursement |

### Effet de levier financier — formule

```
Effet de levier = (Rentabilité économique − Coût de la dette) × (Dettes financières / Capitaux propres)

Si Rentabilité économique > Coût de la dette → effet de levier positif (l'endettement améliore le ROE)
Si Rentabilité économique < Coût de la dette → effet de levier négatif (l'endettement dégrade le ROE)
```

Module recommandé pour oraforme : simulateur d'effet de levier permettant de visualiser l'impact d'un nouvel emprunt sur le ROE prévisionnel, utile pour les PME CEMAC évaluant un crédit d'investissement.

## Plan de trésorerie prévisionnel — structure pour module de prévision

```
Pour chaque période (généralement mensuelle) :
  Solde de trésorerie début de période
  + Encaissements prévisionnels (ventes, apports, emprunts)
  − Décaissements prévisionnels (achats, salaires, charges sociales, impôts, remboursements)
  = Solde de trésorerie fin de période
```

Points d'attention pour un module CEMAC :
- Les délais de paiement clients/fournisseurs réels (souvent plus longs que les délais contractuels dans la zone) doivent être paramétrables par défaut avec des valeurs réalistes, pas optimistes
- Les échéances fiscales et sociales (acomptes IS, TVA mensuelle, CNSS) doivent être injectées automatiquement dans le prévisionnel à partir des paramètres du skill `fiscalite-cemac` — éviter une double saisie manuelle source d'erreurs
- Alerter visuellement (UI) tout mois où le solde prévisionnel devient négatif — c'est l'usage principal de cet outil pour un dirigeant de PME

## Évaluation d'entreprise — méthodes de référence (pour modules avancés)

| Méthode | Principe | Quand l'utiliser |
|---|---|---|
| **Patrimoniale (Actif Net Comptable Corrigé)** | Valeur = Actif réévalué − Dettes | Entreprises à forte composante d'actifs tangibles |
| **Rendement (DCF — Discounted Cash Flow)** | Valeur = somme des flux de trésorerie futurs actualisés | Entreprises avec visibilité sur les flux futurs |
| **Comparable (multiples de marché)** | Valeur = multiple sectoriel × indicateur (EBE, CA) | Quand des données de marché comparables existent — souvent limité en zone CEMAC par le manque de transactions publiques documentées |

Pour la zone CEMAC, la méthode patrimoniale et le DCF sont généralement plus praticables que les multiples de marché, faute de données comparables suffisantes et fiables. Tout module d'évaluation dans oraforme devrait privilégier ces deux approches et permettre une présentation croisée des résultats plutôt qu'un chiffre unique.

## Quand rechercher avant de coder

- Les seuils d'alerte donnés ci-dessus (autonomie financière, capacité de remboursement, liquidité) sont des repères généraux de gestion financière — pas des normes réglementaires strictes. Pour un module sectoriel spécifique (banque, assurance, secteur réglementé), rechercher les ratios prudentiels propres au secteur avant de coder des seuils par défaut
- Les taux d'actualisation pour un DCF doivent être déterminés au cas par cas (coût moyen pondéré du capital) — ne jamais coder une valeur par défaut universelle

## Limites de ce skill

Pour la production des états financiers eux-mêmes (Bilan, Compte de résultat, TAFIRE) selon les normes SYSCOHADA → voir skill `ohada-comptabilite`.
Pour le pilotage interne de l'activité (budgets, coûts, KPI opérationnels) → voir skill `controle-gestion`.
Pour la vérification et le contrôle de la fiabilité des données financières analysées → voir skill `audit-comptable`.

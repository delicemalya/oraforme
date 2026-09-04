---
name: ohada-comptabilite
description: Utilise ce skill pour TOUT ce qui concerne le droit OHADA et la comptabilité SYSCOHADA révisé dans le projet oraforme — plan de comptes, états financiers (Bilan, Compte de résultat, TAFIRE, Notes annexes), Actes Uniformes (AUDCIF, AUSCGIE, AUS, AUPCAP, AUDPSRVE), écritures comptables, amortissements, provisions, consolidation, et tout module ERP traitant de comptabilité générale ou de droit des sociétés dans l'espace OHADA (17 pays membres, zones CEMAC + UEMOA + Comores + RDC). Déclenche-le aussi pour : création/transformation de sociétés (SARL, SA, SAS, SNC, GIE), clôture d'exercice, audit comptable, normes de présentation des comptes, procédures collectives (redressement, liquidation), sûretés et recouvrement. Toujours consulter avant d'écrire ou modifier du code lié aux états financiers, au plan comptable, ou à la structure juridique des entreprises dans oraforme.
---

# OHADA & Comptabilité SYSCOHADA — oraforme

## Contexte d'application

Ce skill s'applique à tous les modules comptables d'oraforme pour les **17 pays membres de l'OHADA**, avec une attention particulière aux 7 pays CEMAC déjà intégrés : Congo-Brazzaville, Cameroun, Gabon, Tchad, RCA, Guinée Équatoriale, RDC (la RDC a adhéré à l'OHADA en 2012 et applique intégralement le SYSCOHADA révisé).

Référentiel comptable unique : **SYSCOHADA révisé**, entré en vigueur le 1er janvier 2018 (Acte Uniforme du 26 janvier 2017 portant révision de l'AUDCIF — Acte Uniforme relatif au Droit Comptable et à l'Information Financière).

## Les 9 Actes Uniformes OHADA — quand chacun s'applique

| Acte Uniforme | Sigle | Domaine | Pertinence oraforme |
|---|---|---|---|
| Droit Comptable et Information Financière | **AUDCIF** | Plan de comptes, états financiers | Module comptabilité — référentiel central |
| Droit des Sociétés Commerciales et GIE | **AUSCGIE** | Création, vie, transformation des sociétés | Module onboarding entreprise, paramétrage tenant |
| Droit Commercial Général | **AUDCG** | Statut du commerçant, bail commercial, vente commerciale | Module facturation, conditions de vente |
| Sûretés | **AUS** | Garanties (gage, hypothèque, cautionnement) | Module crédit/recouvrement |
| Procédures Collectives | **AUPCAP** | Redressement judiciaire, liquidation | Module alertes financières, scoring client |
| Procédures Simplifiées de Recouvrement et Voies d'Exécution | **AUPSRVE** | Injonction de payer, saisies | Module recouvrement créances |
| Arbitrage | **AUA** | Résolution de litiges | Hors périmètre ERP |
| Transport de Marchandises par Route | **AUTMR** | Contrats de transport | Module logistique/import-export |
| Coopératives | **AUSCOOP** | Sociétés coopératives | Si oraforme cible ce type d'entité |
| Droit du Travail (projet) | — | N'existe pas encore en Acte Uniforme — chaque pays garde son Code du travail national | Voir skill `droit-social-rh` |

**Important** : il n'existe pas d'Acte Uniforme OHADA sur le droit du travail ni sur la fiscalité — ces deux matières restent de compétence nationale dans chaque État membre. Ne jamais présenter une règle fiscale ou sociale comme "OHADA" : c'est toujours une règle du pays concerné (cf. skills `fiscalite-cemac` et `droit-social-rh`).

## Plan de comptes SYSCOHADA révisé — structure

8 classes, structure décimale à 2-3-4 chiffres minimum :

```
Classe 1 — Comptes de ressources durables (capitaux propres, emprunts, provisions)
Classe 2 — Comptes d'actif immobilisé (immobilisations corporelles/incorporelles/financières)
Classe 3 — Comptes de stocks
Classe 4 — Comptes de tiers (fournisseurs, clients, État, personnel, associés)
Classe 5 — Comptes de trésorerie (banques, caisse, valeurs mobilières de placement)
Classe 6 — Comptes de charges des activités ordinaires
Classe 7 — Comptes de produits des activités ordinaires
Classe 8 — Comptes des autres charges et produits (HAO — Hors Activités Ordinaires)
```

Comptes clés fréquemment utilisés dans oraforme :
- `401` Fournisseurs / `411` Clients
- `445` État, TVA (`4452` TVA déductible, `4434` TVA facturée, `4441` TVA due)
- `4491` Droits et taxes douaniers à payer
- `52x` Banques / `57x` Caisse
- `60x` Achats / `61x-62x` Services extérieurs / `66x` Charges de personnel
- `70x` Ventes / `75x` Autres produits

## Les 4 états financiers obligatoires (Article 8, AUDCIF)

1. **Bilan** — patrimoine à la date de clôture (actif / passif)
2. **Compte de résultat** — performance sur l'exercice (charges / produits, par nature)
3. **Tableau Financier des Ressources et des Emplois (TAFIRE)** — équivalent du tableau de flux de trésorerie, spécifique OHADA
4. **État annexé (Notes)** — informations complémentaires, méthodes comptables, engagements hors bilan

**Deux systèmes de présentation selon la taille de l'entreprise** :
- **Système Normal** : CA > seuil réglementaire (varie, ~100M FCFA selon le pays) → états complets, 4 documents
- **Système Minimal de Trésorerie (SMT)** : très petites entreprises → comptabilité simplifiée, état de recettes-dépenses

Quand oraforme génère ou affiche des états financiers, toujours déterminer d'abord le système applicable selon le CA du tenant.

## Règles comptables structurantes pour le code

### Amortissements
- Méthode linéaire par défaut, dégressif autorisé sous conditions fiscales nationales
- Durées usuelles SYSCOHADA (indicatives, à confirmer par les barèmes fiscaux locaux) :
  - Constructions : 20-50 ans
  - Matériel et outillage : 5-10 ans
  - Matériel de transport : 4-5 ans
  - Matériel informatique : 3-5 ans
  - Mobilier de bureau : 5-10 ans

### Provisions
- Provisions pour risques et charges (passif) vs provisions pour dépréciation (actif soustractif)
- Une provision répond à 3 critères cumulatifs : obligation actuelle, sortie de ressources probable, montant estimable de façon fiable

### Devise et conversion
- Comptabilité tenue en FCFA (XAF) pour la zone CEMAC — pas de conversion EUR/USD nécessaire sauf opérations en devises étrangères
- 1 EUR = 655,957 XAF (parité fixe garantie par le Trésor français)

### Clôture d'exercice
- Exercice comptable = année civile (1er janvier - 31 décembre) sauf dérogation statutaire
- Délai de dépôt des états financiers : généralement avant le 30 avril de l'année N+1 (à vérifier par pays, voir skill `fiscalite-cemac`)

## Droit des sociétés (AUSCGIE) — formes juridiques pour le module onboarding

| Forme | Capital minimum | Associés | Usage typique oraforme |
|---|---|---|---|
| **SARL** | 1 000 000 FCFA (réformé, anciennement variable) | 1 à 100 | PME, forme la plus courante |
| **SA** | 10 000 000 FCFA (sans appel public à l'épargne) | 1 minimum (SA unipersonnelle admise depuis la réforme 2014) | Grandes entreprises |
| **SAS** | Librement fixé par les statuts | 1 minimum | Introduite par la réforme 2014, flexibilité statutaire |
| **SNC** | Aucun minimum légal | 2 minimum | Rare, responsabilité illimitée solidaire |
| **GIE** | Aucun capital obligatoire | 2 minimum | Groupements économiques, pas de but lucratif propre |
| **Société Unipersonnelle (EURL-like)** | Selon forme (SARLU, SASU) | 1 | Auto-entrepreneurs structurés |

Pour le module onboarding, toujours capturer la forme juridique exacte car elle détermine :
- Le régime fiscal applicable (IS de droit commun vs régimes simplifiés)
- Les obligations de publication des comptes
- Le formalisme des décisions (AG, gérance, conseil d'administration)

## Procédures collectives (AUPCAP) — pour modules scoring/alertes

3 procédures distinctes à ne jamais confondre dans un module de scoring client/fournisseur :
1. **Conciliation** — préventive, confidentielle, avant cessation des paiements
2. **Redressement judiciaire** — entreprise en cessation des paiements mais viable, plan de continuation possible
3. **Liquidation des biens** — cessation d'activité, réalisation de l'actif pour payer les créanciers

Indicateur clé : la **cessation des paiements** (impossibilité de faire face au passif exigible avec l'actif disponible) déclenche l'obligation légale de déclaration dans un délai de 30 jours (variable selon pays).

## Comment appliquer ce skill au code oraforme

- Tout champ ou calcul touchant aux **états financiers** doit référencer le SYSCOHADA révisé, jamais un plan comptable français ou IFRS sans adaptation explicite
- Tout module **gestion comptable multi-clients (cabinet comptable)** doit gérer le système Normal/SMT par client selon son CA
- Toute génération de **numéro de compte** doit respecter la structure décimale SYSCOHADA (classe en 1er chiffre)
- Le module **onboarding entreprise** doit capturer la forme juridique AUSCGIE exacte pour calibrer les règles fiscales et de gouvernance en aval
- Toujours vérifier le pays du tenant avant d'appliquer un seuil chiffré (CA, capital minimum) — ces seuils peuvent varier légèrement selon les textes nationaux d'application

## Limites de ce skill

Ce skill couvre le droit comptable et des sociétés. Pour :
- Les taux d'impôts (IS, TVA, IRPP) → voir skill `fiscalite-cemac`
- Le droit du travail, les contrats, la paie → voir skill `droit-social-rh`
- Les douanes et droits d'importation → voir skill `fiscalite-cemac` (section douanes)

En cas de doute sur un taux ou un seuil chiffré récent, rechercher la source officielle (Acte Uniforme révisé, Journal Officiel national) avant de l'intégrer au code — les textes OHADA sont régulièrement mis à jour par des actes modificatifs.

---
name: sante-medicale
description: Utilise ce skill pour concevoir ou développer tout module ou application de gestion d'établissement de santé en zone CEMAC — dossier patient électronique, parcours de soins multi-spécialités (généraliste et spécialités), gestion de consultations, nomenclature d'actes médicaux, facturation et tiers payant (CMU/RAMU/CAMU), pharmacie/prescription, et intégration avec les régimes d'assurance maladie. Ce skill couvre l'architecture et la structuration logicielle d'un système de santé — PAS le conseil médical clinique. Toute question de diagnostic, de traitement, ou de conduite à tenir médicale doit être adressée à un professionnel de santé qualifié, jamais générée par ce skill comme s'il s'agissait d'un avis médical.
---

# Santé — Module Clinique Multi-Spécialités CEMAC — SaaS / ERP

## Avertissement de portée — à respecter strictement

Ce skill structure des **logiciels de gestion de santé** (dossier patient, parcours de soins, facturation, interopérabilité avec les régimes d'assurance maladie). Il ne transforme jamais Claude en source de diagnostic, de prescription, ou de décision clinique. Si une demande dérive vers "que dois-je prescrire pour X" ou "quel diagnostic pour ces symptômes", la réponse appropriée est de rediriger vers la structuration de l'outil (ex: comment le logiciel doit présenter l'aide à la décision, où le médecin saisit son propre diagnostic) — jamais de fournir le contenu médical à la place du professionnel. Toute application construite à partir de ce skill doit afficher clairement qu'elle est un outil de gestion, pas un substitut au jugement clinique du praticien.

## Cadre institutionnel — systèmes de couverture santé en zone CEMAC

### Congo-Brazzaville — RAMU/CAMU (référence la plus avancée pour oraforme)

Le Congo dispose d'un cadre légal détaillé et récent à intégrer en priorité :
- **RAMU** (Régime d'Assurance Maladie Universelle) institué par la **Loi n°37-2014 du 27 juin 2014**, modifiée par la **Loi n°12-2023 du 10 mai 2023**
- **CAMU** (Caisse d'Assurance Maladie Universelle), créée par la **Loi n°12-2015 du 31 août 2015**, chargée de gérer le RAMU depuis le **1er juillet 2023** — confirmé par la **Loi n°19-2023 du 27 mai 2023**
- Financement par cotisations : employeurs et travailleurs du secteur privé, travailleurs indépendants, État employeur et agents publics, titulaires de pensions
- **Disposition transitoire importante pour un module de facturation** : les organismes (assurances privées, mutuelles) assurant déjà une couverture médicale aux salariés ont pu continuer à le faire pendant 6 mois après le démarrage du RAMU — un module de facturation santé doit donc pouvoir gérer la coexistence de plusieurs payeurs (RAMU/CAMU, assurance privée CIMA, mutuelle, paiement direct patient) plutôt que de supposer un seul tiers-payant universel

### Cameroun — Couverture Santé Universelle (CSU)
- Lancement officiel de la phase 1 le 12 avril 2023 (région de l'Est, Mandjou/Bertoua)
- Déploiement progressif région par région, pas un système national instantané — un module multi-pays doit prévoir un statut "zone CSU active" ou "zone non encore couverte" par localisation du patient
- Objectif présidentiel annoncé : accès aux soins de qualité pour tous, démarche initiée dès 2017

### Principe commun à anticiper dans l'architecture
Quel que soit le pays, le modèle de **tiers-payant partiel** (le patient paie un "ticket modérateur", le reste étant pris en charge par le régime) revient systématiquement dans les régimes de couverture santé universelle de la région (cf. modèle ivoirien CMU à 70%/30%, structurellement proche). Le module de facturation santé doit donc nativement gérer :
```
Tarif conventionné de l'acte
  - Part prise en charge par le régime (ticket payeur)
  - Part restant à la charge du patient (ticket modérateur)
  = Vérification que la somme des deux égale le tarif conventionné
```

## Architecture du dossier patient électronique (DPE)

```
Patient
  ├── Identité (avec gestion des homonymes — essentiel dans des contextes où l'état civil
  │     peut comporter des variations orthographiques d'une consultation à l'autre)
  ├── Antécédents médicaux (chronique, chirurgicaux, familiaux)
  ├── Allergies (champ à criticité élevée — doit être visible immédiatement à l'écran de
  │     consultation, jamais enfoui dans un sous-menu)
  ├── Traitements en cours
  ├── Couverture(s) active(s) — RAMU/CSU, assurance privée CIMA, mutuelle, aucune (paiement direct)
  └── Historique de consultations (lié à chaque épisode de soins ci-dessous)
```

### Épisode de soins — structure centrale pour un parcours multi-spécialités

```
Épisode de soins (un motif de consultation, potentiellement multi-spécialités)
  ├── Consultation(s) liée(s)
  │     ├── Praticien (généraliste OU spécialiste — voir section dédiée)
  │     ├── Motif de consultation
  │     ├── Examen clinique (zone de saisie libre + champs structurés selon spécialité)
  │     ├── Diagnostic retenu (saisi par le praticien — jamais suggéré automatiquement
  │     │     comme une certitude par le logiciel)
  │     ├── Prescription(s) — médicaments, examens complémentaires, actes
  │     └── Compte-rendu
  ├── Examens complémentaires demandés (laboratoire, imagerie) et leurs résultats
  └── Orientation éventuelle vers un spécialiste (référencement interne ou externe)
```

## Gérer le "généraliste et spécialiste en tout" — modèle multi-spécialités dans le logiciel

La demande d'un système couvrant à la fois la médecine générale et l'ensemble des spécialités est une question d'**architecture logicielle multi-spécialités**, pas une question de contenu médical que le logiciel produirait lui-même. Voici comment structurer cela :

### Modèle de spécialités comme paramètre, pas comme logique métier figée
```
Spécialité (table de référence, paramétrable par l'établissement)
  ├── Médecine générale
  ├── Pédiatrie
  ├── Gynécologie-obstétrique
  ├── Cardiologie
  ├── Chirurgie générale
  ├── Dermatologie
  ├── Ophtalmologie
  ├── ORL
  ├── Psychiatrie
  ├── Dentisterie/odontostomatologie
  ├── Kinésithérapie
  └── ... (extensible — ne jamais coder une liste fermée en dur)
```

Chaque spécialité peut avoir :
- Ses propres **champs de consultation structurés** (ex: cardiologie → champs tension artérielle, fréquence cardiaque structurés dès la fiche ; gynécologie-obstétrique → suivi de grossesse avec champs DPA, terme, etc.)
- Sa propre **nomenclature d'actes** associée (voir section suivante)
- Ses propres **modèles de compte-rendu** (template configurable, pas un seul format universel pour toutes les spécialités)

**Le logiciel ne doit jamais prétendre "savoir" la médecine d'une spécialité à la place du praticien** — son rôle est de structurer la saisie, faciliter la traçabilité, et fluidifier le parcours administratif/financier. Toute fonctionnalité "d'aide à la décision" doit rester un outil d'aide à la documentation (rappels de bonnes pratiques administratives, alertes d'interactions médicamenteuses connues si une base de données pharmaceutique fiable est intégrée), jamais un générateur de diagnostic autonome.

### Parcours de soins coordonné multi-spécialités
```
Patient consulte le généraliste
  → Référencement vers spécialiste (interne à l'établissement ou externe)
  → Le dossier patient unique doit rester consultable par tous les praticiens autorisés,
    avec un fil chronologique unifié plutôt que des dossiers cloisonnés par spécialité
  → Retour d'information au généraliste (compte-rendu du spécialiste accessible)
```

C'est cette **continuité du dossier unique à travers les spécialités** qui constitue la vraie valeur ajoutée d'un système "généraliste et spécialiste en tout" — pas le fait que le logiciel génère du contenu médical pour chaque spécialité.

## Nomenclature des actes médicaux — pour le module facturation

À l'image du modèle CMU ivoirien (transposable conceptuellement aux régimes CEMAC) :
```
Acte médical
  ├── Code de l'acte (nomenclature nationale si elle existe, ou nomenclature interne
  │     de l'établissement en l'absence de nomenclature nationale unifiée)
  ├── Catégorie (consultation généraliste, consultation spécialiste, urgence, hospitalisation,
  │     acte technique, examen de laboratoire, acte d'imagerie)
  ├── Tarif conventionné (si couvert par un régime) et tarif libre (hors conventionnement)
  └── Taux de prise en charge par régime (variable — ex: 70% RAMU, autre taux assurance privée)
```

Catégories d'actes structurantes observées dans les régimes de la région (base de modélisation) :
- Consultations (généralistes et spécialistes, distinction tarifaire fréquente)
- Consultations et soins d'urgence médico-chirurgicale
- Hospitalisations médicales et chirurgicales (souvent en forfait journalier pour les CHU)
- Examens de laboratoire et d'imagerie
- Actes pharmaceutiques (médicaments listés/remboursables vs hors liste)

## Module Pharmacie / Prescription

```
Prescription
  ├── Médicament(s) prescrit(s) — nom, dosage, forme, durée de traitement
  ├── Lien vers le diagnostic/motif (traçabilité, jamais une prescription "flottante" sans
  │     justification clinique enregistrée)
  ├── Statut de remboursement (médicament listé dans le panier de soins du régime ou non)
  └── Délivrance (si le module couvre aussi la dispensation en pharmacie intégrée)
```

Pour une fonctionnalité d'**alerte d'interaction médicamenteuse**, ne jamais construire de base de données d'interactions par approximation interne — cette fonctionnalité nécessite une base pharmaceutique de référence reconnue (à rechercher et valider spécifiquement avant implémentation), car une alerte incorrecte ou une absence d'alerte sur une vraie interaction a des conséquences directes sur la sécurité du patient.

## Confidentialité et accès aux données — exigences structurantes

Le dossier patient électronique contient des données de santé, catégorie de donnée sensible par nature (cf. position du skill `memory_application_instructions` plus large de Claude sur les attributs sensibles, qui s'applique ici avec une intensité renforcée s'agissant de données médicales réelles de patients tiers) :
- **Accès strictement limité** aux praticiens en charge du patient et au personnel administratif autorisé pour la facturation — jamais un accès "tout le personnel voit tout"
- **Journalisation des accès** (qui a consulté quel dossier, quand) — standard attendu pour tout DPE, et souvent une exigence réglementaire explicite selon le pays
- **Séparation stricte entre données cliniques et données administratives/financières** dans les niveaux d'habilitation — un agent de facturation n'a pas besoin de voir le détail clinique pour facturer un acte codé

## Quand rechercher avant de coder

- L'état d'avancement réel du déploiement de la CSU camerounaise (zones couvertes à une date donnée) évolue — vérifier la couverture géographique actuelle avant de configurer un module supposant une couverture nationale uniforme
- Les nomenclatures d'actes médicaux officielles, si elles existent formellement dans le pays cible (Congo, Cameroun, Gabon, etc.), doivent être recherchées spécifiquement — ce skill donne la structure générique, pas une nomenclature officielle complète et à jour
- Toute intégration avec une base de données pharmaceutique (interactions, contre-indications) nécessite une source reconnue et à jour — à rechercher et valider avant toute implémentation, jamais construite par approximation

## Limites de ce skill

Pour la fiscalité applicable aux établissements de santé (IS, TVA sur actes médicaux — souvent exonérés ou taux réduit selon les pays, à vérifier) → voir skill `fiscalite-cemac`.
Pour la comptabilisation des opérations d'un établissement de santé → voir skill `ohada-comptabilite`.
Pour le droit du travail du personnel médical et paramédical → voir skill `droit-social-rh`.
Pour la dimension assurantielle d'une couverture santé privée complémentaire (produits d'assurance maladie CIMA) → voir skill `assurance-cima`.
Pour tout contenu médical clinique réel (diagnostic, traitement, conduite à tenir) → hors périmètre de ce skill et de Claude en général ; toujours renvoyer vers un professionnel de santé qualifié.

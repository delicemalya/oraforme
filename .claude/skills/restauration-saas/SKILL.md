---
name: restauration-saas
description: Utilise ce skill pour concevoir ou développer toute application/module de restauration complète — cuisine (KDS, recettes, fiches techniques), gestion de stock (inventaire, péremption, fournisseurs), menu (cartes, prix, variantes), clients (réservations, fidélité, avis), back-office admin (rôles, multi-établissement, reporting), QR code (menu digital, commande à table, paiement), et systèmes de liens (commande en ligne, livraison, intégrations tierces). S'applique aussi bien à un futur module oraforme qu'à un nouveau SaaS dédié restauration. Déclenche-le pour tout projet de POS (point de vente) restaurant, gestion de restaurant/bar/café, ou plateforme de commande digitale.
---

# Application de Restauration Complète (A à Z) — SaaS

## Vue d'ensemble du périmètre fonctionnel

Une application de restauration complète couvre 7 blocs interdépendants. Avant tout développement, situer la fonctionnalité demandée dans ce schéma pour éviter les angles morts d'architecture :

```
1. MENU (carte, prix, composition)
        ↓ alimente
2. CUISINE (KDS, fiches techniques, temps de préparation)
        ↓ consomme
3. STOCK (ingrédients, fournisseurs, péremption)
        ↓ valorise
4. VENTES (commande, paiement, table/livraison/à emporter)
        ↓ génère
5. CLIENTS (profil, fidélité, avis, réservation)
        ↓ piloté par
6. ADMIN (rôles, multi-établissement, reporting, paramétrage)
        ↓ exposé via
7. CANAUX D'ACCÈS (QR code, lien de commande, app mobile, bornes)
```

## 1. Module Menu — structure de données centrale

Le menu n'est pas une simple liste de plats : c'est la donnée pivot qui relie stock, cuisine et ventes.

```
Catégorie de menu (ex: Entrées, Plats, Boissons)
  └── Item de menu (ex: "Poulet braisé")
        ├── Prix de base
        ├── Variantes (taille, accompagnement) → chacune avec son propre prix delta
        ├── Options/suppléments (ex: +avocat +500 FCFA)
        ├── Fiche technique liée (recette → ingrédients → quantités)
        ├── Allergènes/régimes (végétarien, sans gluten, halal — pertinent zone CEMAC)
        ├── Disponibilité (horaires, jours, stock-dépendant)
        ├── Photo(s)
        └── Statut (actif, en rupture, archivé, saisonnier)
```

**Règle de cohérence critique** : un item de menu marqué "disponible" doit être automatiquement masqué ou marqué "rupture" si un ingrédient de sa fiche technique tombe à zéro en stock — c'est le lien menu↔stock qui évite les commandes impossibles à honorer. Ce contrôle doit être en temps réel, pas en batch nocturne.

### Gestion multi-carte
Un établissement a souvent plusieurs cartes actives simultanément : carte principale, carte du jour/suggestions, carte boissons, carte enfants, menu QR table vs menu livraison (prix parfois différents pour absorber les commissions de livraison). Le modèle de données doit supporter plusieurs "vues" du même catalogue d'items plutôt que de dupliquer les items.

## 2. Module Cuisine — KDS (Kitchen Display System) et fiches techniques

### Fiche technique (recette de production)
```
Item de menu
  └── Fiche technique
        ├── Liste d'ingrédients (lien vers le stock) + quantités exactes
        ├── Temps de préparation estimé
        ├── Étapes de préparation (pour formation/standardisation)
        ├── Poste de préparation assigné (grill, friture, dessert, bar)
        └── Coût matière calculé (somme des coûts ingrédients × quantités)
```

Le **coût matière calculé automatiquement** à partir de la fiche technique est essentiel pour le module de gestion (marge brute par plat = prix de vente − coût matière). Toute modification du prix d'achat d'un ingrédient en stock doit pouvoir recalculer le coût matière de tous les plats qui l'utilisent.

### KDS — flux de commande en cuisine
```
Commande reçue (table/livraison/à emporter)
  → Ticket éclaté par poste de préparation (grill reçoit son ticket, dessert reçoit le sien)
  → Statuts : En attente → En préparation → Prêt → Servi/Récupéré
  → Horodatage à chaque transition (mesure du temps de service réel)
  → Alerte si dépassement du temps cible par plat
```

**Point d'architecture important** : le KDS doit fonctionner même en cas de coupure réseau temporaire (fréquent en zone CEMAC) — prévoir un mode de fonctionnement local avec synchronisation différée plutôt qu'une dépendance stricte à une connexion permanente.

## 3. Module Stock — inventaire, péremption, fournisseurs

### Structure de l'inventaire
```
Ingrédient/Article de stock
  ├── Unité de mesure (kg, L, unité, carton)
  ├── Stock actuel (quantité)
  ├── Seuil d'alerte (déclenche notification de réapprovisionnement)
  ├── Coût d'achat unitaire (historique, pour calcul de coût matière)
  ├── Fournisseur(s) associé(s)
  ├── Date(s) de péremption (gestion par lot si applicable — FEFO : First Expired First Out)
  └── Emplacement de stockage (si plusieurs zones : congélateur, réserve sèche, bar)
```

### Mouvements de stock — traçabilité obligatoire
Chaque variation de stock doit être un **mouvement enregistré**, jamais une simple mise à jour silencieuse du solde :
```
Type de mouvement : Entrée (réception fournisseur) | Sortie (vente, via fiche technique)
                   | Perte (casse, péremption) | Ajustement (inventaire physique) | Transfert (entre emplacements)
Quantité, date, utilisateur responsable, motif (obligatoire pour Perte et Ajustement)
```

Cette traçabilité permet : le contrôle des pertes/casses (KPI restauration critique), la détection de vols ou d'erreurs de saisie, et la justification en cas d'audit ou de litige fournisseur.

### Gestion des fournisseurs
```
Fournisseur
  ├── Délai de livraison habituel
  ├── Conditions de paiement
  ├── Catalogue d'articles fournis + prix négociés
  └── Historique des commandes et litiges (retards, non-conformités)
```

Module recommandé : génération automatique de bons de commande fournisseur quand le stock d'un article atteint son seuil d'alerte, avec proposition de quantité basée sur la consommation moyenne historique.

## 4. Module Ventes — commande, paiement, canaux

### Types de commande à gérer distinctement
```
Sur place (à table) — nécessite gestion de table/salle
À emporter — nécessite estimation de temps de retrait
Livraison — nécessite gestion de zone de livraison + suivi coursier
```

### Gestion de salle (sur place)
```
Plan de salle (zones, tables, capacité)
  └── Table
        ├── Statut (libre, occupée, réservée, en nettoyage)
        ├── Commande(s) active(s) liée(s)
        └── Historique des passages (pour rotation/optimisation salle)
```

### Modes de paiement — adapter au contexte CEMAC
```
Espèces, carte bancaire, Mobile Money (Mobile Money MTN, Airtel Money, etc. — dominant en zone CEMAC)
```
Le module de paiement doit traiter le Mobile Money comme un mode de paiement de premier rang, pas comme une option secondaire ajoutée après coup — c'est souvent le mode dominant pour la clientèle finale en Afrique centrale.

### Calcul de l'addition
```
Sous-total articles
+ Suppléments/options sélectionnées
+ Service (si applicable, paramétrable par établissement)
+ TVA (voir skill fiscalite-cemac pour le taux exact du pays du tenant)
− Remises/promotions appliquées
= Total à payer
```

## 5. Module Clients — réservations, fidélité, avis

### Réservation
```
Réservation
  ├── Date/heure, nombre de couverts
  ├── Table(s) assignée(s) ou zone préférée
  ├── Statut (confirmée, en attente, annulée, no-show)
  └── Notes spéciales (allergies, occasion, demandes particulières)
```

### Programme de fidélité
```
Client
  ├── Points de fidélité cumulés
  ├── Historique de commandes (pour recommandations, segmentation)
  ├── Préférences déclarées (plats favoris, allergies)
  └── Niveau de fidélité (paliers avec avantages progressifs)
```

Règle de cohérence : les points de fidélité doivent être calculés sur le montant **après remises**, jamais sur le montant brut — sinon le programme peut devenir économiquement intenable en cumul avec des promotions.

### Avis clients
Lier systématiquement un avis à une commande réelle (pas un avis libre non vérifié) pour la crédibilité, et permettre une réponse publique du gérant — fonctionnalité attendue par défaut sur ce type de plateforme.

## 6. Module Admin — rôles, multi-établissement, reporting

### Modèle de rôles (RBAC) typique restauration
```
Propriétaire/Direction générale — accès total, tous établissements
Gérant d'établissement — accès total sur son établissement uniquement
Manager de salle — gestion commandes, tables, clients
Cuisinier/Chef de partie — accès KDS uniquement
Caissier — accès encaissement uniquement
Comptable — accès lecture rapports financiers, pas de modification opérationnelle
```

Pour une chaîne ou un groupe multi-établissement, chaque rôle doit être scopé par établissement — un manager de l'établissement A ne doit jamais voir ou modifier les données de l'établissement B, sauf rôle explicitement transverse (Direction générale).

### Reporting — KPI restauration de référence
```
Ticket moyen (par service midi/soir, par jour de semaine)
Taux d'occupation des tables / rotation par service
Ratio coût matière / chiffre d'affaires (food cost %) — cible usuelle 28-35% selon le type d'établissement
Plats les plus/moins vendus (analyse de carte — méthode "menu engineering")
Taux de perte/casse en stock
Délai moyen de préparation par poste cuisine
Taux de remplissage des réservations vs no-show
```

Le **food cost %** (coût matière / CA) est l'indicateur le plus suivi du secteur — tout dashboard de pilotage restauration doit l'afficher en priorité, calculé automatiquement à partir des fiches techniques et des prix d'achat réels en stock, pas sur une estimation théorique figée.

### Multi-établissement — architecture
Si le SaaS vise plusieurs restaurants (chaîne ou comptes indépendants), prévoir dès la conception :
- Isolation des données par établissement (tenant), à l'image du modèle multi-tenant déjà utilisé dans oraforme
- Catalogue de menu pouvant être partagé (chaîne avec carte identique) ou indépendant (établissements indépendants) — paramétrable, pas figé dans un sens unique
- Consolidation des rapports au niveau groupe pour la Direction générale, tout en gardant le détail par établissement

## 7. Canaux d'accès — QR code et liens de commande

### QR code — cas d'usage à distinguer
```
QR code "menu digital" — affiche la carte, pas de commande possible (simple consultation)
QR code "commande à table" — affiche la carte ET permet de commander, lié à un numéro de table précis
QR code "paiement" — génère une demande de paiement pour l'addition en cours
```

Chaque QR code doit encoder un identifiant unique (établissement + table le cas échéant), pas juste un lien générique vers le menu — c'est ce qui permet au système de savoir automatiquement où envoyer la commande sans ressaisie manuelle du numéro de table par le client.

### Système de liens de commande en ligne
```
Lien de commande public (ex: pour partage réseaux sociaux, bio Instagram)
  → Doit pointer vers une page de commande autonome, fonctionnant sans connaître le client au préalable
  → Doit permettre la création de compte client à la volée OU une commande "invité" sans compte
```

### Intégrations tierces à anticiper dans l'architecture
- Plateformes de livraison tierces (si l'écosystème local en compte — vérifier la présence effective de ce type de service dans la zone CEMAC, le marché diffère significativement de l'Europe/Amérique sur ce point)
- Passerelles de paiement Mobile Money (API des opérateurs locaux)
- Système de caisse physique existant (si l'établissement a déjà un POS, prévoir une voie d'intégration plutôt qu'un remplacement forcé)

## Choix d'architecture technique recommandés (cohérents avec l'écosystème oraforme)

- **Stack** : Next.js, TypeScript, Tailwind, Supabase — cohérent avec l'environnement de développement déjà en place
- **Temps réel** : Supabase Realtime pour la synchronisation KDS (cuisine) ↔ salle ↔ caisse, essentiel pour l'expérience utilisateur (un plat marqué "prêt" en cuisine doit apparaître instantanément en salle)
- **Mode offline-first partiel** : à prévoir au moins pour le KDS et la prise de commande en salle, étant donné le contexte réseau CEMAC
- **Multi-tenant** : réutiliser le modèle d'isolation par tenant déjà conçu pour oraforme plutôt que d'en inventer un nouveau

## Quand rechercher avant de coder

- Les réglementations d'hygiène alimentaire et de traçabilité varient par pays — rechercher les normes nationales (CEMAC/OHADA n'a pas d'Acte Uniforme spécifique à la restauration) avant d'imposer des contraintes réglementaires dans le produit
- Les commissions et modalités exactes des plateformes de livraison tierces, si elles existent dans le marché cible, changent fréquemment — vérifier avant toute intégration technique
- Les taux de TVA applicables à la restauration peuvent différer du taux standard dans certains pays (taux réduit fréquent sur la restauration dans plusieurs législations) — toujours vérifier via le skill `fiscalite-cemac` avant de figer un taux dans le module de facturation

## Limites de ce skill

Pour les calculs de TVA, IS, ou retenues à la source applicables aux revenus de l'établissement → voir skill `fiscalite-cemac`.
Pour la comptabilisation des écritures générées par les ventes (classe 7 SYSCOHADA) → voir skill `ohada-comptabilite`.
Pour la gestion RH du personnel de restauration (contrats, paie) → voir skill `droit-social-rh`.

---
name: juridique-ohada
description: Utilise ce skill pour les modules de recouvrement de créances et de contrats commerciaux dans oraforme — procédures de recouvrement (mise en demeure, injonction de payer, saisies), Actes Uniformes AUDCG (Droit Commercial Général) et AUPSRVE (Procédures Simplifiées de Recouvrement et Voies d'Exécution), conditions générales de vente, délais de paiement, clauses contractuelles commerciales, sûretés (AUS), et scoring de risque client lié au statut juridique. Distinct du droit des sociétés et de la comptabilité (skill ohada-comptabilite) : ce skill couvre la relation contractuelle et contentieuse avec les tiers (clients, fournisseurs), pas la structure interne de l'entreprise elle-même.
---

# Juridique OHADA — Recouvrement & Contrats Commerciaux — oraforme

## Frontière avec les autres skills

Ce skill couvre la dimension contractuelle et contentieuse de la relation avec les tiers — pas le droit des sociétés ni la comptabilité (skill `ohada-comptabilite`), ni le droit du travail (skill `droit-social-rh`). Il s'applique aux modules : facturation/conditions de vente, relances et recouvrement, scoring de risque client/fournisseur, gestion des garanties.

## Les deux Actes Uniformes centraux pour ce périmètre

| Acte Uniforme | Couvre | Application oraforme |
|---|---|---|
| **AUDCG** (Droit Commercial Général) | Statut du commerçant, vente commerciale, bail commercial, intermédiaires de commerce, Registre du Commerce et du Crédit Mobilier (RCCM) | Module facturation, CGV, validation du statut juridique d'un client/fournisseur |
| **AUPSRVE** (Procédures Simplifiées de Recouvrement et Voies d'Exécution) | Injonction de payer, saisies (saisie-attribution, saisie-vente, saisie conservatoire) | Module recouvrement de créances impayées |
| **AUS** (Sûretés) | Gage, hypothèque, cautionnement, réserve de propriété, droit de rétention | Module gestion des garanties clients/fournisseurs |

## Vente commerciale (AUDCG) — clauses essentielles pour le module facturation

Le contrat de vente commerciale OHADA repose sur des principes que tout module de facturation/CGV d'oraforme doit intégrer :

- **Formation du contrat** : accord sur la chose et le prix suffit en principe (formalisme allégé entre commerçants), mais conserver une trace écrite (bon de commande, facture acceptée) reste essentiel pour la preuve en cas de litige
- **Délai de livraison** : à défaut de stipulation contractuelle, livraison dans un délai raisonnable
- **Transfert des risques** : en principe au moment de la délivrance (remise matérielle), sauf clause contraire (incoterms si commerce international, voir skill `fiscalite-cemac` section douanes)
- **Garantie de conformité** : le vendeur garantit la conformité de la marchandise vendue
- **Clause de réserve de propriété** : permet au vendeur de rester propriétaire du bien jusqu'au paiement intégral — clause à proposer systématiquement dans le module CGV pour les ventes à crédit, car elle renforce significativement la position du créancier en cas de défaillance

### Délais de paiement — point d'attention pour le module facturation

L'AUDCG encadre les délais de paiement entre commerçants. Le module de facturation d'oraforme doit permettre de :
- Paramétrer un délai de paiement contractuel clair sur chaque facture (ex: 30, 45, 60 jours)
- Calculer automatiquement la date d'échéance à partir de la date de facture + délai convenu
- Déclencher des **pénalités de retard** si stipulées contractuellement (taux à définir par les parties, généralement indexé sur un taux légal ou conventionnel)
- Alimenter le KPI DSO du skill `controle-gestion` à partir de ces données

## Procédure de recouvrement — séquence AUPSRVE pour le module de recouvrement

La procédure de recouvrement de créances impayées suit une séquence structurée que le module oraforme doit refléter comme un workflow à états :

```
1. RELANCE AMIABLE
   - Relance simple (email, courrier) — pas d'effet juridique formel
   - Peut être automatisée dès J+X après échéance dépassée

2. MISE EN DEMEURE
   - Lettre formelle, avec accusé de réception recommandé
   - Fait courir les intérêts de retard à compter de sa réception (si pas de stipulation contractuelle antérieure)
   - Étape généralement obligatoire avant toute procédure judiciaire

3. INJONCTION DE PAYER (procédure simplifiée AUPSRVE)
   - Requête auprès du président de la juridiction compétente (créance certaine, liquide, exigible)
   - Le juge rend une ordonnance d'injonction de payer
   - Signification au débiteur, qui dispose d'un délai pour faire opposition (généralement 15 jours,
     à vérifier selon le pays d'application)
   - Sans opposition dans le délai → l'ordonnance devient exécutoire

4. VOIES D'EXÉCUTION (si le débiteur ne paie toujours pas après titre exécutoire)
   - Saisie-attribution (sur les comptes bancaires du débiteur)
   - Saisie-vente (sur les biens meubles)
   - Saisie conservatoire (mesure préventive si risque d'insolvabilité)
   - Saisie immobilière (procédure plus longue, sur les biens immeubles)
```

**Conditions de la créance pour engager l'injonction de payer** : la créance doit être **certaine** (non contestée dans son existence), **liquide** (montant déterminé) et **exigible** (échéance dépassée). Le module de recouvrement d'oraforme devrait vérifier ces trois critères avant de proposer le déclenchement d'une injonction de payer — une créance contestée ou encore non échue n'est pas éligible à cette procédure simplifiée.

## Module de scoring de risque client/fournisseur — éléments juridiques à intégrer

Au-delà des indicateurs purement financiers (retard de paiement historique, encours), le scoring de risque devrait intégrer des signaux juridiques :

- **Statut RCCM actif** : vérifier que l'entreprise cliente/fournisseur est bien immatriculée et active au Registre du Commerce et du Crédit Mobilier
- **Procédure collective en cours** (voir skill `ohada-comptabilite`, section AUPCAP) : une entreprise en redressement judiciaire ou en liquidation présente un risque de recouvrement fortement aggravé — toute commande/livraison à un client dans cette situation devrait déclencher une alerte bloquante, pas seulement informative
- **Historique de litiges/impayés** : traçabilité des incidents de paiement passés avec ce tiers
- **Garanties existantes** : présence ou absence de sûreté (caution, réserve de propriété, gage) sur les créances en cours avec ce tiers

## Sûretés (AUS) — typologie pour le module garanties

| Sûreté | Principe | Usage commercial typique |
|---|---|---|
| **Réserve de propriété** | Le vendeur reste propriétaire jusqu'au paiement complet | Ventes de marchandises à crédit — clause contractuelle simple à intégrer en CGV |
| **Cautionnement** | Un tiers (caution) garantit le paiement en cas de défaillance du débiteur | Garantie de paiement pour gros contrats ou nouveaux clients à risque |
| **Gage** | Remise d'un bien meuble en garantie | Financement avec nantissement de stock ou de matériel |
| **Hypothèque** | Garantie sur un bien immeuble, sans dépossession | Financements importants, crédits long terme |
| **Droit de rétention** | Le créancier retient un bien du débiteur jusqu'au paiement | Prestataire de service retenant un bien en réparation non payée |

Pour un module de gestion de garanties dans oraforme, chaque sûreté enregistrée doit être liée explicitement à la ou aux créances qu'elle garantit, avec son statut (active, levée, réalisée) et sa date de constitution — utile en cas de procédure collective du débiteur, où l'ordre de paiement des créanciers dépend largement de l'existence de sûretés.

## Registre du Commerce et du Crédit Mobilier (RCCM) — élément de fiabilisation des données tiers

Le module onboarding fournisseur/client d'oraforme devrait capturer et, si possible, permettre de vérifier :
- Numéro RCCM
- Forme juridique (cohérence avec le skill `ohada-comptabilite`, section AUSCGIE)
- Capital social déclaré
- Statut actif/radié si une vérification est possible auprès du registre national concerné

Cette donnée alimente à la fois la conformité documentaire (facturation légale) et le scoring de risque.

## Quand rechercher avant de coder

- Les délais précis de la procédure d'injonction de payer (délai d'opposition, délai de signification) **varient selon le pays d'application** au sein de l'espace OHADA pour certains aspects procéduraux locaux — vérifier le texte national d'application avant de coder un délai en dur dans un workflow automatisé
- Les modalités pratiques de saisie (compétence des huissiers, frais) sont précisées par des textes nationaux complémentaires à l'AUPSRVE — à rechercher pays par pays si le module de recouvrement doit générer des actes concrets

## Limites de ce skill

Pour le droit des sociétés (forme juridique de l'entreprise elle-même, gouvernance) et les procédures collectives (redressement, liquidation) → voir skill `ohada-comptabilite`.
Pour le droit du travail et les contrats de travail → voir skill `droit-social-rh`.
Pour la fiscalité applicable aux opérations commerciales (TVA sur ventes, retenues à la source) → voir skill `fiscalite-cemac`.

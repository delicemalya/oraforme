# BOI-009 — Arbitrage métier de la consommation par provenance

Mission P0-BOI-009, 2026-09-22. Suite de BOI-008 (`EXISTING_POLICY = AUCUNE`, `OPTIONS_VALIDATED` = FIFO / LIFO / choix manuel, PMP invalidé). Ce document **ne choisit rien** — il présente les conséquences factuelles de chaque option pour que le propriétaire du produit tranche. Aucun code, aucune migration, aucune donnée production.

Rappel du cadre déjà établi (BOI-006/007/008, non remis en cause ici) : la provenance est portée par `stock_movements` (une ligne = un mouvement, entrée ou sortie), jamais par `products`. Le stock actuel (`v_products_stock`) est aujourd'hui calculé `GROUP BY product_id` uniquement, **toutes localisations confondues** — cette granularité de base est reprise telle quelle dans les trois options ci-dessous, sauf mention contraire explicite.

---

## Scénario commun aux trois options

Produit X : 100 unités entrées le jour J (achat fournisseur), 100 unités entrées le jour J+5 (production locale). Puis, le jour J+10 : vente de 30 unités, suivie le jour J+12 d'une vente de 20 unités.

---

## Option 1 — FIFO (First In, First Out) par provenance

### Fonctionnement concret
À chaque vente, le système détermine automatiquement, parmi les origines disponibles pour ce produit, **laquelle a été constituée en premier** (date d'entrée la plus ancienne) et consomme sur celle-ci en priorité, jusqu'à épuisement, avant de basculer sur la suivante. Aucune saisie de l'utilisateur.

### Exemple avec les chiffres du scénario
L'achat (J) est antérieur à la production (J+5).
- Vente de 30 (J+10) : consommée entièrement sur `achat_fournisseur` (il en reste 100, largement suffisant).
- Vente de 20 (J+12) : consommée entièrement sur `achat_fournisseur` (il en restait 70, suffisant).

**Provenance consommée** : `achat_fournisseur` pour les deux ventes, en totalité.
**Stock restant** : achat = 50, production = 100.

### Impact première cession
**Aucune cession locale n'a lieu tant que l'achat n'est pas épuisé.** Avec ces chiffres précis, ni la vente de 30 ni celle de 20 ne touchent la production locale — donc aucun fait générateur potentiel n'est déclenché par ces deux ventes. La première cession locale n'arrivera que lorsque le solde `achat_fournisseur` atteindra zéro et qu'une vente ultérieure devra puiser dans `production_locale`.

### Impact traçabilité
Bonne : l'ordre de consommation est entièrement déductible de `created_at` des mouvements d'entrée. Aucune ambiguïté a posteriori sur « pourquoi cette origine a été choisie ».

### Impact utilisateur
**Nul.** Le vendeur ou le caissier ne voit et ne fait rien de différent — la logique est invisible, exécutée par le système.

### Impact POS
Aucun changement d'interface visible pour l'utilisateur. En coulisse, chaque vente doit interroger le solde par origine avant d'écrire le mouvement de sortie (coût de requête supplémentaire, faible).

### Impact comptabilité
Aucun changement de compte. La ventilation de la valorisation par origine (si demandée un jour) suit automatiquement la même logique.

### Risques
- **Le basculement d'une origine à l'autre est silencieux.** Le moment où le système commence, pour la première fois, à consommer `production_locale` est un événement fiscalement significatif (fait générateur potentiel) — un pur FIFO ne prévient personne que ce basculement a eu lieu, sauf à ajouter une alerte dédiée (non conçue ici).
- Si une vente doit traverser la frontière entre deux origines (ex. il ne reste que 10 en `achat_fournisseur` pour une vente de 30), la ligne de sortie devrait être scindée en deux mouvements distincts (10 sur une origine, 20 sur l'autre) — complexité d'écriture non triviale, à concevoir séparément.

### Conséquences opérationnelles
Aucune formation utilisateur nécessaire. Le comportement dépend entièrement de l'ordre chronologique réel des entrées — un décideur ne peut pas « choisir » quelle origine sort en premier, c'est mécaniquement déterminé par les dates d'entrée passées.

---

## Option 2 — LIFO (Last In, First Out) par provenance

### Fonctionnement concret
Symétrique de FIFO : consomme en priorité l'origine dont l'entrée est **la plus récente**.

### Exemple avec les chiffres du scénario
La production (J+5) est postérieure à l'achat (J).
- Vente de 30 (J+10) : consommée entièrement sur `production_locale` (il en reste 100). **Cette vente est la première cession locale.**
- Vente de 20 (J+12) : consommée entièrement sur `production_locale` (il en restait 70, suffisant).

**Provenance consommée** : `production_locale` pour les deux ventes, en totalité.
**Stock restant** : achat = 100, production = 50.

### Impact première cession
**Déclenchée immédiatement dès la première vente du scénario** (les 30 unités), puisque la production, entrée plus récemment, est consommée en priorité. Contrairement à FIFO, le fait générateur potentiel apparaît tout de suite plutôt que jamais (avec ces chiffres précis).

### Impact traçabilité
Identique à FIFO techniquement (déductible des dates), mais l'ordre de consommation résultant est moins intuitif à anticiper pour un non-spécialiste : « pourquoi la production entrée avant-hier part-elle avant l'achat entré il y a un mois ? » demande une explication à chaque audit.

### Impact utilisateur
Nul, comme pour FIFO — invisible pour le vendeur.

### Impact POS
Identique à FIFO : aucun changement d'interface, coût de requête équivalent.

### Impact comptabilité
Identique à FIFO : aucun changement de compte.

### Risques
- **Si la production locale est alimentée régulièrement** (nouvelles entrées fréquentes), le LIFO peut faire en sorte que le stock `achat_fournisseur`, plus ancien, **ne soit jamais consommé** tant qu'il arrive continuellement de la production plus récente — un stock d'achat qui stagne indéfiniment, invisible dans les ventes, alors qu'il continue d'occuper de l'espace et du capital immobilisé.
- Même risque de scission de ligne qu'en FIFO si une vente traverse une frontière d'origine.
- Le même problème de basculement silencieux qu'en FIFO existe pour la bascule inverse (de la production vers l'achat, une fois la production épuisée).

### Conséquences opérationnelles
Aucune formation utilisateur nécessaire. Comme pour FIFO, le résultat dépend mécaniquement des dates d'entrée passées, pas d'une décision prise au moment de la vente.

---

## Option 3 — Choix manuel de provenance

### Fonctionnement concret
À chaque sortie, la personne qui enregistre la vente (ou le système en amont, si la provenance est déjà connue par ailleurs) **déclare explicitement** quelle origine elle consomme. Aucun algorithme de tri chronologique.

### Exemple avec les chiffres du scénario
- Vente de 30 (J+10) : l'opérateur déclare `achat_fournisseur`.
- Vente de 20 (J+12) : l'opérateur déclare `production_locale`. **Cette vente est la première cession locale.**

**Provenance consommée** : 30 sur `achat_fournisseur`, 20 sur `production_locale` — c'est la seule des trois options qui peut reproduire **exactement** le scénario que BOI-007 avait posé comme exemple de départ.
**Stock restant** : achat = 70, production = 80.

### Impact première cession
Directe et fiable **si l'opérateur déclare correctement** — la détection par requête sur le grand livre fonctionne sans particularité. Mais la fiabilité de la donnée dépend entièrement de la rigueur de la saisie humaine, à chaque vente.

### Impact traçabilité
Excellente sur le principe (l'origine est un fait déclaré, jamais déduit) — mais **dépend de la discipline de saisie**. Une déclaration erronée n'est pas détectable automatiquement (contrairement à FIFO/LIFO, où le résultat est toujours mathématiquement cohérent avec les dates réelles).

### Impact utilisateur
**Le plus significatif des trois options.** Chaque vente d'un produit à origines multiples exige une étape de saisie supplémentaire — l'opérateur doit savoir, ou pouvoir déterminer, de quelle origine provient physiquement ce qu'il vend. Pour un produit vraiment fongible en rayon (une bouteille ne porte pas d'étiquette « achetée » ou « produite »), cette connaissance peut ne pas exister physiquement sur le terrain.

### Impact POS
**Changement d'interface réel et obligatoire** : le POS actuel (`commerce/page.tsx`) n'a aujourd'hui aucune notion d'origine (confirmé BOI-008) — il faudrait ajouter un écran ou un choix à la volée dès qu'un produit a plusieurs origines en stock simultanément.

### Impact comptabilité
Aucun changement de compte — identique aux deux autres options.

### Risques
- **Erreur ou négligence de saisie** : rien n'empêche techniquement un opérateur de déclarer une origine par défaut sans vérifier, ce qui fausserait silencieusement la détection de première cession (le risque inverse de FIFO/LIFO : ici l'erreur est humaine, pas algorithmique).
- Si le produit n'est physiquement pas distinguable par origine (pas d'étiquette, de zone de stockage séparée), l'opérateur n'a **aucun moyen réel** de savoir quoi déclarer — la déclaration devient une convention arbitraire plutôt qu'un fait vérifié, sauf si une séparation physique des stocks par origine est organisée en amont (question opérationnelle, pas technique).
- Nécessite un blocage explicite si l'opérateur déclare une origine dont le solde est insuffisant (comportement à définir).

### Conséquences opérationnelles
Nécessite une formation des équipes de vente/caisse. Nécessite, dans la plupart des cas réels, une **séparation physique ou visuelle du stock par origine** (rayonnage, étiquetage) pour que la déclaration soit fiable plutôt que devinée — une contrainte opérationnelle réelle, pas seulement informatique.

---

## Comportements transverses — comparaison factuelle

### Plusieurs entrepôts

Le système actuel ne calcule le stock que par produit, **toutes localisations confondues** (BOI-007) — aucune des trois options ne change ce fait de base à elle seule.

- **FIFO/LIFO** : un algorithme purement chronologique, s'il ignore l'entrepôt, pourrait désigner comme « à consommer » une unité physiquement située dans un autre dépôt que celui où la vente a réellement lieu — un résultat cohérent sur le papier mais impossible à exécuter physiquement. Rendre FIFO/LIFO correct par entrepôt demanderait d'ajouter la dimension entrepôt au tri chronologique (complexité supplémentaire, non conçue ici).
- **Choix manuel** : la personne qui vend connaît naturellement son propre entrepôt et son stock physique visible — ce problème ne se pose pas de la même façon, l'opérateur choisit parmi ce qu'il voit réellement devant lui.

### Transfert entre entrepôts

`stock_transferts` est aujourd'hui déconnecté de `stock_movements` (BOI-003/007/008) — un transfert ne produit aucun mouvement dans le grand livre actuellement, quelle que soit l'option retenue.

- **Si un jour reconnecté** : la provenance d'une unité ne change pas parce qu'elle change d'entrepôt — un mouvement transféré devrait préserver l'origine d'origine, pas en recevoir une nouvelle.
- **FIFO/LIFO** : risque spécifique — si un transfert crée un nouveau mouvement avec une nouvelle date, un algorithme purement chronologique pourrait considérer à tort le stock transféré comme « plus récent » que sa date réelle d'entrée en stock, faussant l'ordre de consommation.
- **Choix manuel** : non affecté par ce risque de distorsion de date, puisqu'aucun algorithme ne se fie à la chronologie.

### Retour

Un retour peut être un retour client (le stock revient) ou un retour fournisseur (le stock repart).

- **Retour client** : à quelle origine restituer l'unité revenue ? Ni FIFO, ni LIFO, ni le choix manuel ne répondent automatiquement à cette question — elle exige soit un lien explicite vers la vente d'origine (non conçu), soit une nouvelle déclaration. **C'est un point commun aux trois options, pas un différenciateur.**
- **Retour fournisseur** : par nature, ne peut concerner qu'un stock `achat_fournisseur` (ou `import_direct`) — jamais `production_locale`, puisqu'on ne « retourne » pas un produit qu'on a soi-même fabriqué. C'est la seule situation où une origine pourrait être déduite sans ambiguïté par la nature même de l'opération — mais cela resterait une forme d'inférence, à valider comme décision métier séparée, pour les trois options également.

### Ajustement d'inventaire

Un écart constaté lors d'un comptage physique n'indique, par nature, aucune origine — ce problème est **strictement identique pour FIFO, LIFO et le choix manuel**. Aucune des trois options ne le résout intrinsèquement ; c'est une question ouverte indépendante de ce choix (déjà signalée BOI-007/008).

### Provenance épuisée

- **FIFO** : une fois `achat_fournisseur` à zéro, toute vente suivante bascule automatiquement et silencieusement sur `production_locale` — transition mécanique, sans alerte native.
- **LIFO** : bascule symétrique une fois l'origine la plus récente épuisée.
- **Choix manuel** : si l'opérateur tente de déclarer une vente sur une origine dont le solde est insuffisant, le système peut **refuser explicitement** l'opération (comportement à définir, mais naturellement plus visible qu'un basculement automatique silencieux) — l'échec est un événement explicite, pas une transition invisible.

---

## Tableau de synthèse (faits, pas de recommandation)

| Critère | FIFO | LIFO | Choix manuel |
|---|---|---|---|
| Résultat sur le scénario (30+20) | 100 % sur achat, aucune 1ʳᵉ cession déclenchée | 100 % sur production, 1ʳᵉ cession dès la 1ʳᵉ vente | Réparti comme déclaré (ex. 30 achat / 20 production) |
| Intervention utilisateur | Aucune | Aucune | Obligatoire à chaque vente d'un produit mixte |
| Changement d'interface POS | Aucun | Aucun | Nécessaire |
| Fiabilité de la donnée | Garantie mathématiquement (dates réelles) | Garantie mathématiquement (dates réelles) | Dépend de la discipline de saisie humaine |
| Détection du basculement d'origine | Silencieuse | Silencieuse | Explicite (choix conscient à chaque fois) |
| Risque principal | Peut retarder indéfiniment la détection d'une 1ʳᵉ cession si l'achat est abondant | Peut laisser un stock d'achat ancien jamais consommé si la production est réalimentée en continu | Erreur ou négligence de déclaration ; suppose une séparation physique du stock par origine pour être fiable |
| Nécessite une formation | Non | Non | Oui |
| Nécessite une séparation physique du stock par origine | Non | Non | Généralement oui, pour que la déclaration soit fiable |

---

## État final obligatoire

```
BUSINESS_DECISION_REQUIRED = YES

DECISION_OPTIONS =
1. FIFO
2. LIFO
3. CHOIX_MANUEL

IMPLEMENTATION_ALLOWED = NO
```

Aucune option n'est présentée comme supérieure aux autres. Le choix dépend de faits opérationnels que seul le propriétaire du produit connaît : la production locale est-elle occasionnelle ou continue ? le stock est-il physiquement distinguable par origine sur le terrain ? l'équipe de vente peut-elle être formée à une saisie supplémentaire ? Ces réponses ne sont pas déductibles du code.

---

Aucun code modifié. Aucune migration créée. Aucune donnée production touchée. Aucun commit, aucun push.

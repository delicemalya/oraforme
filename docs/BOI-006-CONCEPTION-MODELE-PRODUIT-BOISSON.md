# BOI-006 — Conception minimale du modèle produit boisson

Mission P0-BOI-006, 2026-09-21. Mission de **conception uniquement**. Aucun code, aucune migration, aucun calcul fiscal, aucune règle `accounting_event_rules`, aucune donnée production. S'appuie sur l'état établi par BOI-003→BOI-005 (achats/stocks/produit réparés et `READY`) et sur la mécanique légale confirmée en BOI-004 (loi 42-2019 : redevable = producteur/importateur, fait générateur = première cession locale ou introduction douanière, régime différencié par catégorie).

---

## Étape 1 — Où stocker l'origine du produit

### Le cas qui tranche la question

La mission impose explicitement de représenter : *« Produit X acheté chez fournisseur + Produit X éventuellement produit localement »* — un **même SKU**, deux origines simultanées. `products` (BOI-005, 12 colonnes réelles, une ligne par SKU par tenant) ne peut par construction porter qu'**une seule valeur** par ligne. Si `origine` était une colonne de `products`, un même SKU acheté ET produit localement devrait forcément mentir sur l'une des deux provenances. **L'option A (directement sur products) est donc exclue par les faits, pas par préférence.**

### Comparaison B / C / D

- **B — sur `purchase_items`** : représente naturellement `achat_fournisseur` (chaque ligne d'achat a un fournisseur). Mais **aucune ligne d'achat n'existe pour une production locale** — il n'y a pas de « fournisseur soi-même ». Poser l'origine uniquement ici obligerait à inventer une entité miroir (« production_items ») pour le cas production — exactement le défaut de duplication d'entités que BOI-004 a corrigé (`purchase_orders` vs `purchases`). Rejeté seul.
- **C — sur `stock_movements`** : chaque unité de stock, qu'elle vienne d'un achat ou d'une production, entre dans le système par **exactement une ligne `stock_movements`** (type `reception` aujourd'hui pour les achats, un futur type `production` pour le local — aucun des deux n'est créé ici). C'est le seul point de passage obligé, déjà source unique du stock (BOI-003, ANO-C03). Porter l'origine ici couvre les deux cas sans nouvelle entité.
- **D — combinaison** : retenue, mais **pas comme duplication** — la valeur d'origine vit une seule fois (sur `stock_movements`, option C), et `purchase_items` n'ajoute qu'un **pointeur optionnel** (FK) vers la ligne d'achat quand l'origine est `achat_fournisseur`, pour la traçabilité — jamais une seconde copie de la valeur elle-même.

### Décision

**Origine = colonne sur `stock_movements`, renseignée obligatoirement sur les mouvements entrants, complétée par une FK optionnelle `stock_movements.purchase_item_id → purchase_items.id`** (remplace le rapprochement actuel par texte libre `reference`, qui n'est pas une contrainte réelle — un vrai gain de traçabilité, pas une invention).

Contraintes de la mission respectées :
- **Valeur obligatoire** : `NOT NULL` sur les types de mouvement entrants (`entree`, `reception`, futur `production`) — pas de `DEFAULT`.
- **Aucune valeur par défaut implicite, aucune inférence silencieuse** : chaque appelant de `fn_stock_move` pour un mouvement entrant devrait déclarer explicitement l'origine (paramètre obligatoire, pas de valeur par défaut) — non implémenté ici, conception seulement.
- **Compatible `products`** : aucune colonne ajoutée à `products`, aucune rupture du modèle `READY` de BOI-005.
- **Compatible multi-tenant** : `stock_movements.tenant_id` existe déjà, l'origine est scoping-neutre.
- **Compatible `purchases`/`purchase_items`** : renforcé, pas modifié en profondeur.
- **Compatible `stock_movements`** : additif uniquement (nouvelle colonne nullable au niveau schéma, contrainte applicative sur les types entrants).

---

## Étape 2 — Origine du produit vs origine du lot/stock

Question centrale de la mission, tranchée par le raisonnement de l'Étape 1 : **l'origine est une propriété de chaque entrée de stock (lot/mouvement), jamais une propriété permanente de `products`.** Un produit (le SKU, sa fiche catalogue) est une abstraction stable ; sa provenance physique varie à chaque réapprovisionnement. Confondre les deux reviendrait à réintroduire, sous un autre nom, l'erreur que migration 050 a commise (mélanger l'identité du produit avec des attributs qui varient dans le temps ou par lot — `stock_max`, `emplacement`, etc., déjà écartés en BOI-005 pour cette même raison structurelle).

**Conséquence directe** : `products` reste inchangé pour la dimension origine. Tout le travail se fait au niveau de l'entrée de stock.

---

## Étape 3 — Distinguer achat_fournisseur / import_direct

### Ce que `purchases` sait aujourd'hui

Schéma réel confirmé (BOI-004) : `purchases(id, tenant_id, supplier_id, montant_total, statut, created_at, reference, notes, date)`. `suppliers(id, tenant_id, nom, telephone, email, adresse, created_at)` — **aucun champ pays, aucun champ douane, aucun indicateur import/local.**

### Ce qui manque, précisément

La loi (Article 5, loi 42-2019, déjà établie en BOI-004) définit l'importation par **un événement douanier** — « l'introduction sur le territoire douanier » — pas par la nationalité du fournisseur. Un fournisseur étranger dont la marchandise est déjà dédouanée par un tiers n'est pas juridiquement un import pour l'acheteur local ; inversement, une entreprise peut elle-même importer directement sans que rien dans `suppliers` ne le révèle. **`purchases`/`suppliers` ne portent aujourd'hui aucune donnée permettant de représenter cet événement**, ni comme proxy (pays du fournisseur) ni comme fait précis (référence de déclaration douanière).

**Ce n'est pas un bug — c'est un concept absent.** Deux pistes possibles pour une future conception (non tranchées ici, volontairement) :
1. Un champ explicite sur `purchases` (`type_operation`: `'achat_local' | 'importation'`), saisi par l'utilisateur à la création — pas déduit.
2. Une référence à un document douanier, si la précision légale l'exige.

**Rien n'est créé automatiquement.** Ce point reste `NOT_DETERMINED` et bloque explicitement toute distinction `achat_fournisseur` vs `import_direct` pour l'instant — voir verdict final.

---

## Étape 4 — Catégorie fiscale boisson

Reprise strictement des trois catégories confirmées par BOI-004 (Article 8 loi 42-2019, texte primaire) :

- `boissons_alcoolisees` (Art. 8-c, 25%)
- `boissons_energisantes_soda` (Art. 8-b, 10% — l'anomalie « boissons sucrées » déjà documentée en BOI-004 reste non résolue, non traitée ici)
- `champagne` (Art. 8-f, 50%)

Toute autre valeur reste `NULL` / non déterminée. **Aucune catégorie supplémentaire n'est créée**, y compris pour les zones grises déjà identifiées (« autres produits soumis aux droits d'accises », catégorie d).

---

## Étape 5 — Où vit la catégorie fiscale

Contrairement à l'origine, la catégorie fiscale décrit **ce que le produit est légalement** (une bouteille de champagne reste du champagne, qu'elle soit achetée ou produite) — pas comment il est entré en stock. C'est une propriété stable du SKU, pas du lot.

**Décision : `products`, pas `stock_movements`.** Une colonne nouvelle et nullable (ex. `categorie_fiscale_boisson`), contrainte aux 3 valeurs de l'Étape 4 + `NULL`, jamais déduite du champ `categorie` texte libre existant (qui reste un champ d'affichage, sans rapport).

La mise en garde de la mission (« un produit peut changer de traitement juridique ») est respectée en gardant ce champ **modifiable explicitement** (édition manuelle, jamais recalculé automatiquement) — pas en le rendant dépendant du lot.

**Ne pas dupliquer la fiscalité** : ce champ ne porte qu'une **clé de classification**, jamais un taux. Le taux applicable reste entièrement dans le Fiscal Core, résolu au moment du calcul (non implémenté ici) à partir de cette clé — exactement le principe déjà établi pour `taxe_pct` (rejeté en BOI-005 pour la raison inverse : un taux figé par produit court-circuite le Fiscal Core).

---

## Étape 6 — Première cession : source de vérité

### Pourquoi un booléen `is_first_sale` est refusé

Un indicateur posé au moment de l'écriture suppose que l'écrivain sait, à cet instant précis, s'il s'agit réellement de la toute première sortie d'un lot d'origine `production_locale` — hypothèse fragile face à des ventes concurrentes, des corrections, ou un stock fongible partagé. La mission l'interdit explicitement sans démonstration, et aucune démonstration solide n'existe : ce serait un état caché, non vérifiable a posteriori, potentiellement faux dès la première anomalie d'écriture.

### Le vrai problème : le stock est aujourd'hui fongible, pas par origine

`v_products_stock` calcule un solde **unique par produit** (`SUM(fn_stock_sign(type) × quantite) GROUP BY product_id`, BOI-003). Il n'existe **aucune notion de lot ni de sous-solde par origine**. Concrètement : si un produit a 100 unités achetées + 100 produites, le système actuel ne sait dire que « 200 en stock » — il ne peut pas répondre à « les 20 vendues viennent-elles du lot acheté ou du lot produit ? ». **Ceci est la vraie limite à documenter, pas contournable par un simple champ.**

### Source de vérité proposée

Étendre exactement le même mécanisme déjà prouvé (BOI-003/004), sans nouvelle entité :
1. Le solde par produit devient **un solde par produit ET par origine** : `SUM(...) GROUP BY product_id, origine` — extension directe et minimale de la logique déjà existante de `v_products_stock`, pas une nouvelle table.
2. Une sortie (`type='sortie'`) doit **elle aussi déclarer explicitement** quelle origine elle consomme (même discipline « pas d'inférence silencieuse » que pour les entrées) — c'est la conséquence directe du refus d'inventer un défaut implicite pour un produit à origines mixtes.
3. « Première cession » devient une **fait dérivé, interrogeable dans le grand livre**, jamais stocké : *« existe-t-il, avant cette ligne, une autre ligne `stock_movements` de type `sortie` pour ce `product_id` et `origine='production_locale'` ? »* Si non → cette sortie est candidate au fait générateur. Résultat toujours recalculable depuis le grand livre, jamais un état qui peut driver.

---

## Étape 7 — Cas mixte testé

| Cas | Scénario | Comportement du modèle proposé |
|---|---|---|
| A | 100 achetées → vente de 20 | Solde `(produit, achat_fournisseur)` = 100 avant, 80 après. La sortie déclare `origine='achat_fournisseur'`. Aucun fait générateur (accise déjà acquittée en amont). |
| B | 100 produites → première cession de 20 | Solde `(produit, production_locale)` = 100 avant, 80 après. La sortie déclare `origine='production_locale'`. Requête « une sortie `production_locale` existe-t-elle déjà pour ce produit ? » → non → candidate au fait générateur. |
| C | 100 achetées + 100 produites, ventes mélangées | **Le modèle `products` seul ne suffit pas — confirmé explicitement**, comme demandé par la mission. Il faut le solde par origine (Étape 6) ET une déclaration explicite d'origine sur chaque sortie. Sans cette extension, une vente de 20 sur un stock mixte est **indéterminable** — ni le modèle actuel (un seul solde fongible), ni `products`, ne peuvent répondre. |

---

## Étape 8 — Interfaces futures Produit/Provenance → Fiscal Core → Accounting Core

Aucune implémentation. Contrat d'interface uniquement, pour qu'une future mission ne réinvente rien :

```
ENTRÉE (fournie explicitement, jamais devinée par le Fiscal Core) :
  - categorie_fiscale   (products.categorie_fiscale_boisson — une des 3 valeurs ou NULL)
  - origine             (stock_movements.origine de la ligne de sortie concernée)
  - is_first_cession     (booléen DÉRIVÉ par une requête sur le grand livre AVANT l'appel,
                          jamais calculé à l'intérieur du Fiscal Core)
  - montant / quantite   (déjà présents sur la ligne de sortie)
  - pays                 (déjà résolu via le tenant, routage existant lib/countries/*.ts)

SORTIE :
  - montant_accise (ou absence de montant si categorie_fiscale=NULL ou origine≠production_locale
                     ou is_first_cession=false)
```

Le Fiscal Core reste, comme aujourd'hui (`lib/fiscalite/engine-adapter.ts`), un pur routeur de calcul — « aucun taux, aucun barème, aucune règle fiscale » n'y est stocké, seulement appliqué à partir des entrées fournies. L'Accounting Core recevrait ce montant via un futur event_type dédié (non créé ici), avec un compte distinct de 4441/447, selon le principe déjà établi en BOI-001/BOI-002 (jamais fusionner accise et TVA/CA sur le même compte).

---

## Étape 9 — Compatibilité stocks vérifiée

- `fn_stock_move` : non modifiée. Une future extension additive (nouveau paramètre `p_origine`, obligatoire sur les types entrants) n'altère aucun appel existant tant qu'elle n'est pas implémentée.
- `v_products_stock` : non modifiée, non remplacée. Une future vue parallèle (solde par origine) s'ajoute, ne casse rien.
- `purchases` / `purchase_items` : aucune colonne changée par cette conception (l'Étape 1 ne fait qu'ajouter une FK optionnelle côté `stock_movements`, pas de modification de `purchase_items`).
- `stock_movements` : gagnerait, dans une future migration non exécutée ici, une colonne `origine` nullable et une FK nullable `purchase_item_id` — additif, sans risque puisque la table est à 0 ligne en production (confirmé BOI-004/005).
- **Aucune structure refusée par BOI-004/005 n'est recréée** : pas de `purchase_orders`, pas de `stock_receptions`, pas de `product_categories`, pas de `products.stock_actuel`, pas de `products.fournisseur_id`, pas de `products.taxe_pct`.

---

## Étape 10 — Comparaison d'architectures et décision

| Architecture | Avantages | Inconvénients | Risques | Impact migration | Cas mixte |
|---|---|---|---|---|---|
| **1. Origine sur `products`** | Simple à lire | Ne peut pas représenter deux origines pour un même SKU | Contradiction factuelle avec l'exigence de la mission | — | **Impossible** |
| **2. Origine sur `purchase_items` seul** | Couvre nativement achat_fournisseur | Aucune représentation possible de production_locale sans entité miroir | Recrée le défaut « entités parallèles » déjà corrigé en BOI-004 | Moyen (nouvelle table) | Non géré sans duplication |
| **3. Origine sur `stock_movements`, solde par origine, FK optionnelle vers `purchase_items`** (retenue) | Réutilise le mécanisme déjà prouvé (BOI-003/004) ; aucune nouvelle entité ; traçabilité renforcée (FK réelle au lieu du texte libre `reference`) | Exige que les sorties déclarent aussi l'origine consommée (discipline supplémentaire) | Si un écrivain omet l'origine sur une sortie d'un produit mixte, le calcul fiscal doit être **bloqué**, jamais deviné — friction opérationnelle assumée, pas une erreur silencieuse | Faible (colonnes nullable additives, 0 ligne actuellement) | **Géré**, explicitement démontré Étape 7 |

**Décision : Architecture 3.** Justifiée par les flux métier réellement observés (BOI-003/004 : `stock_movements` est déjà la source unique du stock, `fn_stock_move`/`v_products_stock` déjà le mécanisme éprouvé) et par la donnée réellement disponible (aucune des tables existantes ne porte de notion d'origine aujourd'hui — il n'y a pas de source alternative à réutiliser). Aucune préférence esthétique invoquée.

---

## État final obligatoire

```
BOI_DATA_MODEL = PARTIAL
```

Justification : la conception est cohérente et complète pour distinguer `production_locale` de `achat_fournisseur` (Étapes 1, 2, 5, 6, 7, 9, 10 toutes résolues avec une architecture unique justifiée). Mais **`import_direct` reste un concept non représentable avec les données actuellement disponibles** (Étape 3) — ce n'est pas un détail d'implémentation, c'est un vrai trou de conception : aucune table existante ne porte l'information nécessaire pour distinguer légalement un achat local d'une importation.

```
IMPLEMENTATION_ALLOWED = NO
```

### Ce qui manque précisément avant toute implémentation

1. **Import direct (Étape 3)** : décision produit/métier sur comment représenter l'événement douanier — champ explicite sur `purchases`, document douanier référencé, ou autre — actuellement `NOT_DETERMINED`, non tranché volontairement.
2. **Discipline opérationnelle de la déclaration d'origine sur les sorties (Étape 6)** : la conception exige que chaque sortie d'un produit à origines mixtes déclare explicitement quelle origine elle consomme — ceci suppose une décision métier (qui déclare cette origine, à quel moment du flux de vente) non validée ici, uniquement conçue.
3. **Aucune preuve d'exécution** : contrairement à BOI-004/BOI-005, cette mission n'a rien testé en base (aucune migration, aucun schéma modifié) — la conception est validée sur le papier et par cohérence avec l'existant, pas par une preuve live.

Une prochaine mission devrait résoudre le point 1 (décision métier explicite sur l'import) et le point 2 (workflow de déclaration d'origine à la vente) avant que l'implémentation (migration + code) ne soit autorisée.

---

Aucun code modifié. Aucune migration créée ni exécutée. Aucun calcul fiscal implémenté. Aucune donnée production touchée. Aucun commit, aucun push.

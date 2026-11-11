# BOI-008 — Décision métier sur la consommation des provenances

Mission P0-BOI-008, 2026-09-22. Suite de BOI-007 (`STOCK_PROVENANCE_DESIGN = READY`, `BOI_DATA_MODEL = PARTIAL`). Mission d'**audit et de comparaison uniquement** — aucun code, aucune migration, aucune donnée production, aucune accise, aucun taux.

**Note d'exécution** : MCP Supabase toujours déconnecté. Vérifications faites par lecture directe du code (`Read`/`Grep`) et, pour l'existence de deux tables, par requête PostgREST en lecture seule (même projet, même clé service_role qu'en BOI-005/006/007).

---

## 1. Audit des sorties actuelles — rien supposé, tout vérifié

| Flux | Fichier | Mécanisme réel de sortie de stock | Provenance sélectionnée ? |
|---|---|---|---|
| **POS (caisse commerce)** | `app/dashboard/commerce/page.tsx`, `handleConfirmVente()` (lignes 180-211) | Réel et fonctionnel : `ventes`/`vente_lignes` (tables réelles) puis, **pour chaque ligne du panier**, `supabase.rpc('fn_stock_move', { p_type: 'sortie', p_quantite: l.qte, ... })` | **Non — aucun paramètre d'origine, aucun choix, aucune notion de provenance dans l'appel** |
| **Page dédiée « Sorties »** | `app/dashboard/stocks/sorties/page.tsx` | **Cassée** : `handleCreate()` insère d'abord dans `stock_sorties` (ligne 174-188). Vérifié en direct via PostgREST (`GET /rest/v1/stock_sorties` → `PGRST205 : Could not find the table 'public.stock_sorties'`) — table jamais créée (même sort que `product_categories`/`purchase_orders`/`stock_receptions`, migration 050 jamais appliquée, déjà documenté BOI-003/004/005). **L'appel `fn_stock_move` (lignes 206-218), pourtant présent dans le code et théoriquement correct, n'est jamais atteint** : l'insertion précédente échoue et lève une exception avant. **Découverte nouvelle de cette mission**, non signalée par BOI-003/004/005 (ces audits portaient sur `products`, pas sur `stock_sorties`). | Sans objet — le chemin n'est jamais exécuté |
| **Commandes fournisseurs (achats)** | `app/dashboard/stocks/achats/page.tsx`, `app/api/stocks/purchases/route.ts` | Entrées, pas des sorties (réception, BOI-004) — hors périmètre de cette audit mais confirmé sans notion de provenance à la sortie puisqu'il n'y a pas de sortie ici |
| **Restaurant** | `app/api/resto/commandes/route.ts` (lignes 65-84) | **Système entièrement différent** : lecture puis `UPDATE stock_articles SET quantite = GREATEST(0, quantite - X)`. Ne passe ni par `stock_movements`, ni par `fn_stock_move`. `stock_articles` n'a aucune colonne susceptible de porter une origine (confirmé BOI-003/005) | Sans objet — hors du modèle `products`/`stock_movements` visé par BOI-006/007, système parallèle et déconnecté |
| **Boisson** | `app/api/boisson/tournees/**`, `app/api/boisson/commandes/**` | **Aucun lien à `products` ni à `stock_movements`** (confirmé BOI-001, reconfirmé BOI-005) — une tournée/commande boisson ne décrémente aucun stock aujourd'hui | Sans objet — le module boisson n'a pas encore de modèle produit/stock du tout |
| **Transferts** | `app/dashboard/stocks/transferts/page.tsx`, table `stock_transferts` | Déjà déconnecté de `stock_movements` (BOI-003, ticket H7, jamais réparé) — un transfert change `source_warehouse_id`/`destination_warehouse_id` dans sa propre table, sans jamais générer de ligne `stock_movements` | Sans objet — ne produit aucune sortie au sens du grand livre |
| **Ajustements** | — | Aucune page dédiée trouvée (confirmé BOI-003, reconfirmé ici). `fn_stock_move` accepte `p_type='ajustement'` comme capacité technique, mais **aucun appelant réel** dans le code | Sans objet — capacité inutilisée |

### Conclusion de l'audit

**Un seul chemin de sortie est aujourd'hui réellement fonctionnel et alimente le grand livre `stock_movements`** : le POS (`commerce/page.tsx`). La page dédiée « Sorties » est cassée (nouvelle découverte). Restaurant et boisson vivent hors du modèle `products`/`stock_movements`. Transferts et ajustements ne produisent aucune sortie exploitable aujourd'hui. **Aucun des chemins existants, fonctionnel ou non, ne sélectionne ou ne demande de provenance.**

---

## 2. Politique existante — réponse explicite

**Aucune politique réelle de consommation par provenance n'existe dans Oraforme, sous quelque forme que ce soit.**

Ni FIFO, ni LIFO, ni PMP, ni choix manuel, ni « premier disponible » : le seul appel qui décrémente réellement le stock (`fn_stock_move`, depuis le POS) prend un `product_id` et une `quantite`, un point c'est tout — il n'a **techniquement aucun moyen** de choisir entre deux origines puisque ce paramètre n'existe pas dans sa signature actuelle. Le sélecteur `METHODE_OPTIONS = ['CMP', 'FIFO', 'LIFO', 'PMP']` de `stocks/valorisation/page.tsx` (déjà signalé cosmétique en BOI-007) ne pilote aucune logique de sortie — il change seulement une étiquette d'affichage sur un calcul de coût moyen pondéré, une méthode de valorisation comptable, jamais un ordre de consommation physique.

**EXISTING_POLICY = AUCUNE.**

---

## 3. Comparaison des options — sans préférence

### A. FIFO par provenance
**Fonctionnement** : consommer automatiquement l'origine dont l'entrée est la plus ancienne, jusqu'à épuisement, avant de passer à la suivante.
- *Avantages* : cohérent avec la comptabilité matière classique ; déterministe ; pas d'intervention utilisateur.
- *Inconvénients* : c'est un **algorithme** à écrire, pas seulement un schéma ; une seule vente peut devoir être scindée en plusieurs lignes `stock_movements` si elle traverse une frontière d'origine (ex. vente de 90 alors qu'il ne reste que 70 en `achat_fournisseur`).
- *Impact stock* : nécessite de connaître, à l'instant de la vente, le solde restant par origine (Modèle D de BOI-007, pas encore implémenté).
- *Impact traçabilité* : bonne — l'ordre de consommation est déductible de `created_at`.
- *Impact première cession* : direct — la première sortie chronologique d'origine `production_locale` est mécaniquement la première consommée par la règle elle-même.
- *Impact comptabilité* : aucun changement de compte, seulement une meilleure ventilation de la valorisation par origine si demandé plus tard.
- *Impact POS* : le caissier n'a rien à choisir — invisible pour l'utilisateur, mais suppose une consultation du solde par origine avant chaque vente (coût de requête supplémentaire, faible).
- *Impact transferts* : nécessiterait, si `stock_transferts` était un jour reconnecté à `stock_movements`, de propager l'origine consommée par le transfert.
- *Impact utilisateurs* : aucun changement d'interface nécessaire côté vendeur.
- *Données nécessaires* : le solde par origine (BOI-007 §10, vue non encore créée).

### B. LIFO par provenance
**Fonctionnement** : consommer l'origine la plus récemment entrée en premier.
- *Avantages* : même mécanique que A, déterministe.
- *Inconvénients* : mêmes qu'A (scission possible) ; **contre-intuitif pour un produit périssable ou pour la logique fiscale visée** (consommer d'abord la production récente pourrait retarder indéfiniment la détection d'une « première cession » si de nouvelles unités produites arrivent régulièrement).
- *Impact stock/traçabilité/comptabilité/POS/transferts/utilisateurs* : identiques à A techniquement.
- *Impact première cession* : **plus complexe qu'en FIFO** — une entrée récente pourrait être vendue avant une entrée ancienne du même produit, retardant artificiellement la détection de la première cession réelle d'un stock de production plus ancien.
- *Données nécessaires* : identiques à A.

### C. PMP (coût moyen pondéré)
**Fonctionnement** : ne distingue pas physiquement les unités — calcule un coût moyen unique, sans traçer quelle unité précise part.
- *Avantages* : déjà partiellement présent dans `stocks/valorisation` pour la valorisation comptable (mais pas pour la consommation physique, voir §2).
- *Inconvénients* : **incompatible par nature avec la question posée.** Le PMP répond à « quelle est la valeur moyenne de ce qui sort », pas à « quelle origine légale/fiscale cette unité porte-t-elle ». Un produit d'origine `achat_fournisseur` et un produit d'origine `production_locale` n'ont pas le même traitement fiscal (BOI-004) — les moyenner reviendrait à effacer précisément la distinction que BOI-006/007 ont établie comme nécessaire.
- *Impact première cession* : **ne peut pas répondre à la question** — le PMP ne sait jamais « quelle origine » a été vendue, seulement « à quel coût moyen ».
- *Données nécessaires* : sans objet — cette option ne résout pas le problème posé, elle le contourne en fusionnant ce qui doit rester distinct.

### D. Choix manuel de provenance
**Fonctionnement** : à chaque sortie, l'utilisateur (vendeur, gestionnaire de stock) sélectionne explicitement quelle origine il consomme.
- *Avantages* : simple à implémenter au niveau données (un champ obligatoire sur la ligne de sortie, exactement la conception de BOI-007 §7) ; aucune ambiguïté possible, aucune scission automatique à gérer ; correspond exactement à la discipline « aucune inférence silencieuse » déjà appliquée dans tout cet engagement.
- *Inconvénients* : charge l'utilisateur d'une décision qu'il ne connaît pas forcément (un caissier au POS ne sait généralement pas si la bouteille qu'il scanne vient de l'achat ou de la production) — nécessite soit une interface dédiée, soit une présélection déjà connue du produit (rarement pertinent pour un produit vraiment mixte).
- *Impact stock* : trivial (un paramètre de plus dans `fn_stock_move`).
- *Impact traçabilité* : excellente — l'origine est un fait déclaré, jamais déduit.
- *Impact première cession* : direct, comme en A — la requête sur le grand livre (BOI-007 §8) fonctionne à l'identique.
- *Impact comptabilité* : aucun changement.
- *Impact POS* : **changement d'interface réel nécessaire** — le POS actuel n'a aucune notion d'origine, il faudrait ajouter une étape de sélection quand un produit a plusieurs origines en stock.
- *Impact utilisateurs* : le plus significatif des cinq options — nouvelle étape de saisie.
- *Données nécessaires* : identiques à A, sans le solde par origine servant à un algorithme automatique (puisque c'est l'utilisateur qui choisit).

### E. Provenance imposée par la commande
**Fonctionnement** : la provenance est déterminée en amont, au niveau de la commande/du canal de vente (ex. « tel client achète toujours du produit importé », « ce canal ne vend que de la production locale »), pas au moment de chaque ligne de sortie.
- *Avantages* : aucune saisie supplémentaire au moment de la vente si la règle est déjà connue en amont.
- *Inconvénients* : **suppose une segmentation commerciale qui n'existe pas aujourd'hui** dans Oraforme (aucune notion de canal de vente lié à une origine, ni de règle client) — introduirait un nouveau concept métier non demandé par cette mission ; fragile si un même canal vend en réalité un mélange des deux origines (le cas même que BOI-007 §3/CAS C a été conçu pour couvrir).
- *Impact stock/comptabilité* : identiques à D une fois la règle appliquée.
- *Impact première cession* : dépend entièrement de la fiabilité de la règle de segmentation — risque d'erreur si la règle ne reflète pas la réalité physique du stock.
- *Impact POS* : aucun changement d'interface si la règle est déjà déterminée par le canal, mais **le canal de vente devrait alors porter une donnée qui n'existe nulle part aujourd'hui**.
- *Données nécessaires* : une notion de canal/segment de vente lié à une origine — **absente du système actuel**, à concevoir séparément si retenue.

### F. Autre règle révélée par le code
**Aucune trouvée.** L'audit (§1) est exhaustif sur les flux demandés (ventes, POS, commandes, restaurant, boisson, transferts, ajustements) — rien d'autre n'existe.

---

## 4. Première cession — par politique, sans booléen ni donnée inventée

Le mécanisme de base (BOI-007 §8) reste identique quelle que soit la politique retenue : **une requête sur `stock_movements`**, jamais un flag stocké.

```
quantité produite   = SUM(quantite) WHERE product_id=X AND origine='production_locale' AND type IN ('entree','reception')
quantité déjà sortie = SUM(quantite) WHERE product_id=X AND origine='production_locale' AND type='sortie'
première sortie      = MIN(created_at) WHERE product_id=X AND origine='production_locale' AND type='sortie'
```

- **A (FIFO)** et **B (LIFO)** : la ligne de sortie porte déjà `origine='production_locale'` (assignée par l'algorithme) — la requête fonctionne sans adaptation.
- **C (PMP)** : **ne peut pas fonctionner** — si l'origine n'est jamais enregistrée sur la ligne de sortie (puisque le PMP ne la distingue pas), la requête ci-dessus n'a rien à trouver. Cette option **empêcherait structurellement** de répondre à la question posée par la mission.
- **D (choix manuel)** : identique à A/B, la requête fonctionne dès lors que l'utilisateur a rempli le champ.
- **E (imposée par la commande)** : fonctionne si la règle de segmentation est fiable ; sinon, le risque est que des ventes réellement mixtes soient mal étiquetées, ce qui fausserait la détection — pas un problème de la requête elle-même, mais de la fiabilité de la donnée en amont.

**Conclusion** : toutes les politiques sauf C (PMP) permettent la détection par requête pure, sans flag ni compteur — à condition que l'origine soit effectivement enregistrée sur la ligne de sortie, ce qui est acquis par construction pour A/B/D, et dépendant d'une règle externe pour E.

---

## 5. Cas mixte obligatoire — 100 achat + 100 production, ventes de 30 puis 20

| Politique | Vente de 30 | Vente de 20 | Soldes finaux |
|---|---|---|---|
| **A — FIFO** | Consomme l'origine la plus ancienne. Si l'achat (100) est entré avant la production (100) : 30 pris sur `achat_fournisseur` | 20 supplémentaires pris sur `achat_fournisseur` (reste 50) | achat = 50, production = 100 — **tant que l'achat n'est pas épuisé, la production locale n'est jamais entamée, donc jamais de première cession déclenchée par ces deux ventes** |
| **B — LIFO** | Consomme l'origine la plus récente. Si la production (100) est entrée après l'achat : 30 pris sur `production_locale` — **cette vente déclenche la première cession** | 20 supplémentaires pris sur `production_locale` (reste 50) | achat = 100, production = 50 — l'achat n'est jamais entamé tant que la production n'est pas épuisée |
| **C — PMP** | **Ne peut pas répondre** — la vente sort 30 unités « moyennes », sans indiquer de quelle origine | **Ne peut pas répondre** | **Indéterminable par construction** |
| **D — choix manuel** | L'utilisateur déclare, par exemple, 30 sur `achat_fournisseur` (comme dans l'exemple originel de BOI-007) | L'utilisateur déclare 20 sur `production_locale` | achat = 70, production = 80 — **résultat identique à celui démontré en BOI-007 §3, parce que c'est exactement le scénario que BOI-007 avait posé comme un choix déjà fait, pas comme une règle automatique** |
| **E — imposée par la commande** | Dépend de la règle de segmentation définie ailleurs — résultat non déterminable sans connaître cette règle | Idem | Dépend entièrement d'une donnée qui n'existe pas aujourd'hui |

**Point clé mis en évidence par ce tableau** : le scénario « 30 depuis l'achat, 20 depuis la production » que BOI-007 a utilisé pour démontrer le modèle de données **suppose déjà un choix D (manuel)** — ce n'est pas ce qu'un FIFO ou un LIFO produirait automatiquement. **Les quatre politiques donnent quatre résultats différents pour les mêmes deux ventes** — la preuve concrète qu'il s'agit bien d'une décision métier, pas d'un détail technique interchangeable.

---

## 6. Ce qui est déjà imposé, ce qui reste à décider

| Élément | Déjà imposé par le système | Décision métier | Décision comptable | Décision fiscale |
|---|---|---|---|---|
| `stock_movements` = source unique du stock | ✅ (BOI-003, ANO-C03) | — | — | — |
| Un seul chemin de sortie réellement fonctionnel (POS) aujourd'hui | ✅ (constat §1) | — | — | — |
| Le champ `origine` doit exister sur la ligne de sortie (structure) | ✅ (BOI-007, conception validée) | — | — | — |
| **Quelle politique (A/B/D/E) remplit ce champ** | ❌ | **✅ — c'est la décision de cette mission, non tranchée** | — | — |
| Interface POS à adapter pour la saisie (si D retenu) | ❌ | ✅ (conséquence du choix métier) | — | — |
| Rejeter C (PMP) comme incompatible avec la détection de première cession | Techniquement démontré (§4) — pas une préférence | — | — | — |
| Quel compte comptable pour une future accise, distinct de 4441/447 | ❌ non déterminé | — | Partiellement (déjà orienté par BOI-001/002 : jamais fusionner) | — |
| Le fait générateur est la première cession (pas la production elle-même) | — | — | — | ✅ déjà établi (loi 42-2019, BOI-004) |
| Quelle politique respecte le mieux la réalité physique du flux (FIFO vs manuel) | ❌ | **✅ — dépend de la réalité opérationnelle du métier boisson (tournées, dépôt), pas du code** | — | — |

**Aucun choix n'est fait ici parmi A/B/D/E** — conformément à l'instruction explicite de ne pas décider à la place du métier. Seul C (PMP) est écarté, non par préférence mais par démonstration technique qu'il rend la question posée indéterminable (§4, §5).

---

## 7. Impact sur les données nécessaires à BOI

Sans implémenter l'accise, la politique retenue déterminera :

- **Quel champ remplir, et quand** : si A/B (automatique), le champ `origine` sur `stock_movements` est rempli par un algorithme au moment de l'écriture ; si D (manuel), il est rempli par une saisie utilisateur explicite ; si E, par une règle de segmentation externe à concevoir.
- **Ce que le Fiscal Core recevra en entrée** (BOI-006 §8, inchangé par cette mission) : `origine` de la ligne de sortie concernée, `is_first_cession` dérivé par requête (§4) — la politique retenue ne change pas cette interface, elle détermine seulement **la fiabilité et la simplicité** avec lesquelles `origine` est effectivement renseigné.
- **Un prérequis dur** : quelle que soit la politique choisie, **le PMP (C) doit être exclu** pour tout flux destiné à un produit fiscalement sensible (boisson), car il rend structurellement impossible la détermination de la provenance consommée — donc impossible de calculer si une accise est due.
- **Aucune donnée fiscale n'est calculée ici** — uniquement la structure de ce qui alimentera un futur calcul.

---

## État final obligatoire

```
EXISTING_POLICY             = AUCUNE
BUSINESS_DECISION_REQUIRED  = YES
OPTIONS_VALIDATED           = A (FIFO), B (LIFO), D (choix manuel) — toutes trois techniquement viables et démontrées (§4, §5) ;
                               C (PMP) invalidée par démonstration technique (ne peut pas déterminer la provenance consommée) ;
                               E (imposée par la commande) viable en théorie mais dépend d'un concept absent du système (segmentation canal/origine)
BOI_IMPLEMENTATION_ALLOWED  = NO
```

### Pourquoi `BOI_IMPLEMENTATION_ALLOWED = NO`

Le tableau du §5 démontre, avec les chiffres mêmes que BOI-007 a posés comme cas de test, que **le résultat du calcul de stock par provenance dépend entièrement de la politique choisie** — trois politiques viables donnent trois répartitions différentes pour les deux mêmes ventes. Implémenter quoi que ce soit avant que cette décision soit prise reviendrait à figer arbitrairement un choix métier dans le code, exactement ce que cet engagement a refusé de faire à chaque étape précédente (BOI-002, BOI-006, BOI-007).

### Découverte notable de cette mission, hors provenance

La page `stocks/sorties/page.tsx` (sorties génériques hors POS) est **entièrement non fonctionnelle** — `stock_sorties`/`stock_sortie_items` n'existent pas en base (confirmé PostgREST, même défaut que migration 050 déjà documenté BOI-003/004/005, mais jamais signalé spécifiquement pour ces deux tables jusqu'ici). Hors périmètre strict de cette mission (aucune réparation demandée ni faite), mais à signaler pour une future mission de réparation du Core Stocks — le POS reste, pour l'instant, le seul chemin de sortie réellement exploitable.

---

Aucun code modifié. Aucune migration créée. Aucune donnée production modifiée. Aucune accise, aucun taux implémenté. Aucun commit, aucun push.

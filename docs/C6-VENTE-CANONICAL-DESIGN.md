# C6 — CANONICAL SALE ARCHITECTURE

Mission de conception uniquement. Aucun code, aucune migration, aucune donnée modifiée, aucun commit/push. Chaque affirmation est sourcée (fichier/ligne) ; tout ce qui ne peut pas être prouvé par le dépôt est marqué `NOT_DETERMINED`, jamais inventé.

---

## 1. CURRENT FLOW

### POS (`app/dashboard/commerce/page.tsx`)

```
Client clique "Encaisser"
  → INSERT ventes { tenant_id, total, mode_paiement, nb_articles, statut:'validee' }
  → INSERT vente_lignes (produit, quantité, prix — par ligne)
  → supabase.rpc('fn_stock_move', { p_type:'sortie', ... })  ← RPC DIRECT, contourne /api/stock/move
  → AUCUN appel emit_accounting_event. AUCUNE ligne journal_entries.
  → Trésorerie : rien n'est écrit (pas de ligne 521/571/transactions).
  → Fiscalité : rien n'est écrit (TVA jamais capturée en 4441).
```

**Confirmé par relecture directe aujourd'hui** : recherche exhaustive de `VTE-`/`COM-`/`POS-` dans tout le dépôt = 0 résultat ; aucun des 12 fichiers `accounting_rules_*` (139-148, 181-182) ne contient de règle pour une vente comptoir.

### stocks/sorties (`app/dashboard/stocks/sorties/page.tsx`) — **découverte non listée dans le brief**

Ce n'est pas un bypass identique à celui du POS. `stocks/sorties` écrit dans des tables **différentes** (`sorties`/`sortie_lignes`, pas `ventes`/`vente_lignes`), avec un champ `type_sortie` qui peut valoir `'vente'`, `'perte'`, `'don'`, etc. :

```
Client valide une sortie, type_sortie = 'vente'
  → INSERT sorties + sortie_lignes (product_id, quantite, prix_unitaire)
  → supabase.rpc('fn_stock_move', { p_type:'sortie', ... })  ← RPC DIRECT, même bypass que le POS
  → SI totalValeur > 0 ET type_sortie === 'vente' :
      writeComptaEntry({ debitAccount:'411', creditAccount:'701', montant: totalValeur, ... })
      ← écriture DIRECTE, hors moteur emit_accounting_event, hors accounting_events,
        hors accounting_event_rules, hors idempotence (uidx_ae_processed),
        hors possibilité de reverse via fn_reverse_accounting_event
  → Aucune ligne TVA (4441) n'est jamais créée — le montant total part intégralement en 701.
  → Aucune ligne de coût des marchandises (601/311) — contrairement au cas 'perte'/'don' de
    la même page, qui lui écrit bien 658/311.
  → 411 (Clients, créance) est débité, jamais 521 (caisse) — modèle "vente à crédit" implicite,
    mais sans aucun mécanisme pour constater l'encaissement ultérieur (pas de FAC-002 équivalent
    branché sur `sorties`).
```

**Ce n'est donc pas "zéro comptabilité" comme le POS — c'est une comptabilité partielle, via le writer legacy déjà signalé ailleurs comme dette active (`compta-sync-client.ts`/`writeComptaEntry`, EXM-JE-003), sans TVA, sans CA, sans coût des marchandises vendues, et avec une créance qui ne se solde jamais.**

### Divergences identifiées

| | POS | stocks/sorties (vente) |
|---|---|---|
| Table de vente | `ventes`/`vente_lignes` | `sorties`/`sortie_lignes` |
| Stock | RPC directe (bypass) | RPC directe (bypass, identique) |
| Comptabilité | Aucune | Partielle, hors moteur (`writeComptaEntry`) |
| TVA | Jamais | Jamais |
| Centime additionnel | Jamais | Jamais |
| Coût des marchandises vendues | Jamais | Jamais |
| Trésorerie | Jamais | 411 (créance), jamais 521 |
| Idempotence | Aucune | Aucune (pas de uidx_ae_processed, writer direct) |
| Reverse | Aucun | Aucun |

Les deux flux doivent converger vers un flux canonique commun — pas seulement pour le stock (déjà demandé par le brief), mais aussi côté comptable, puisque `stocks/sorties` a sa propre dette comptable distincte, pas identique à celle du POS.

---

## 2. ROOT CAUSE

Deux causes distinctes et cumulatives, déjà identifiées en partie dans le plan d'exécution C1-C4, reconfirmées ici :

1. **Bypass du point d'entrée stock** (`/api/stock/move`, qui émet correctement STK-002) par un appel RPC direct à `fn_stock_move` depuis le client — identique sur POS et stocks/sorties.
2. **Absence de règle de vente dans le catalogue `accounting_event_rules`** — aucune des 12 migrations `accounting_rules_*` n'en crée. Sans règle, même un appel `emit_accounting_event('XXX-001', ...)` ne produirait aucune écriture (le moteur traite l'événement comme `processed` sans lignes si aucune règle `active` ne correspond — mécanique déjà observée ailleurs dans le dépôt, ex. FAC-003/FAC-004 à l'état `DRAFT`, jamais déclenchées).

Pour `stocks/sorties`, une troisième cause s'ajoute : le développeur de cette page a contourné le moteur central en réutilisant le writer legacy (`writeComptaEntry`), probablement parce qu'aucune règle `accounting_event_rules` de vente n'existait au moment où cette page a été écrite — un symptôme de la cause 2, pas une cause indépendante.

---

## 3. EXISTING PRECEDENTS

| event_type | Modèle | Comptes exacts (preuve) | Fichier source |
|---|---|---|---|
| **FAC-001** (facture émise, crédit) | Créance d'abord, encaissement séparé | Seq1: 411/706 montant_ht · Seq2: 411/4441 montant_tva · Seq3: 411/447 metadata.ca | migration 139, lignes 259-261 (contrôle en commentaire, vérifié) |
| **FAC-002** (règlement facture) | Encaissement qui solde la créance | Seq1: 521/411 montant_ttc | migration 139, ligne 262 |
| **RES-001** (vente POS restaurant) | Caisse immédiate | Seq1: 521/706 montant_ht (resolver `treasury_debit`) · Seq2: 521/4441 montant_tva | migration 142, lignes 230-231 |
| **BOI-001** (encaissement tournée boisson) | Caisse immédiate, marchandise | Seq1: 521/701 montant_ht (resolver `treasury_debit`) · Seq2: 521/4441 montant_tva · Seq3 (ajoutée migration 182): 521/447 | migration 146 lignes 255-256, confirmé par sondage direct en mission d'exécution C1-C4 |
| **STK-001** (réception marchandises) | Entrée stock | Seq1: 311/401 montant_ht | migration 147, ligne 147 + contrôle ligne 316 |
| **STK-002** (sortie stock non facturée) | Coût, hors vente | Seq1: 601/311 montant_ht | migration 147, ligne 170. **Commentaire explicite de la règle elle-même (ligne 177) : "Ventes facturées gérées par FAC-001 (produits). STK-002 = sortie physique stock non facturée directement (conso interne, perte, usage)."** |
| **ACH-001/002** (achat fournisseur) | Charge, pas vente | ACH-001: 601/401 · ACH-002: 401/521 | déjà établi missions antérieures (BOI-004) |

**Constat déterminant** : aucune règle existante ne relie une VENTE à une sortie de coût (601/311). FAC-001 facture le produit (706, un compte de **service**, pas 701 marchandises — à noter, voir §4) mais ne touche jamais le stock. STK-002 touche le stock mais sa propre documentation exclut explicitement le cas d'une vente facturée. **Il n'existe donc aujourd'hui aucun précédent de "coût des marchandises vendues au moment de la vente"** — c'est un angle mort réel du catalogue, pas seulement celui du POS.

---

## 4. SALE EVENT

**A ou B ?** → **B, nouvel événement nécessaire.** Aucun événement existant (FAC-001, RES-001, BOI-001) ne peut être réutilisé tel quel pour le POS/stocks-sorties sans réécrire la sémantique d'un autre module (FAC-001 est lié au cycle facture ; RES-001 au module restaurant ; BOI-001 au module boisson). Mais **la structure et les comptes de BOI-001 sont intégralement réutilisables**, pas inventés — voir ci-dessous.

**Nom proposé** : `VTE-001` (vente comptoir — POS et sorties de type vente convergées). Nom conceptuel, pas codé. Suit exactement la convention existante (préfixe module à 3 lettres + séquence, cf. `chk_ae_event_type` : `^[A-Z]{2,10}-[0-9]{3}`).

| Champ conceptuel | Valeur | Justification |
|---|---|---|
| `source_table` | `ventes` (POS) ou `sorties` (sortie type vente) | Deux tables sources possibles pour le même event_type — déjà un précédent : STK-002 est déclenché depuis `/api/stock/move` quel que soit le module appelant |
| `source_id` | `ventes.id` / `sorties.id` | Clé de l'idempotence, voir §10 |
| `idempotence` | `(tenant_id, 'VTE-001', source_table, source_id)` | Index unique réel déjà existant pour TOUT event_type (`uidx_ae_processed`, migration 138, lignes 193-198) — pas une invention, le mécanisme générique s'applique automatiquement |
| `tenant_id` | Session serveur (`requireTenant()`), jamais le client | Cohérent avec C1-C4 |
| `montant_ht` | Somme des `quantite × prix_vente` des lignes **taxables** | Dérivé, pas déclaré par le client final — voir §5 |
| `montant_tva` | 18% du HT taxable, ou 0 si exonéré (§5) | Fiscal Core, pas de calcul local |
| `montant_ca` (centime additionnel) | 5% de la TVA, ou 0 si exonéré | Même règle que BOI-001/FAC-001 |
| `montant_ttc` | HT + TVA + CA | — |
| `moyen de paiement` | `ventes.mode_paiement` / `sorties.destinataire`+terme | Détermine le compte de contrepartie (§6) |
| `stock` | Une ligne `fn_stock_move` par ligne de vente, `type='sortie'` | Inchangé, fonction déjà correcte |
| `provenance` | `origine` optionnel par ligne (choix manuel, BOI-009/BOI-010) | Inchangé, mécanisme déjà existant |
| `metadata` | `{ vente_id/sortie_id, lignes: [...], caissier, ... }` | Pour traçabilité, pas pour le calcul fiscal |

---

## 5. ACCOUNTING

**Schéma attendu, déterminé à partir des précédents réels, rien d'inventé :**

| Séquence | Débit | Crédit | Montant | Précédent exact réutilisé |
|---|---|---|---|---|
| 1 — Revenu | 521 (résolu par `treasury_debit` si comptant) ou 411 (si crédit, §6) | **701** | montant_ht | BOI-001 seq1 (521/701) — précédent direct, même nature économique (vente de marchandises, pas de service) |
| 2 — TVA | idem | 4441 | montant_tva | RES-001/BOI-001/FAC-001 seq TVA — identique partout |
| 3 — Centime additionnel | idem | 447 | montant_ca | FAC-001 seq3 / BOI-001 seq3 (migration 182) — identique partout |
| 4 — Coût des marchandises vendues | 601 | 311 | somme(quantite × prix_achat) des lignes vendues | **Comptes réutilisés de STK-002 (601/311)**, mais sous l'identité du nouvel événement `VTE-001` — PAS sous `STK-002` lui-même, dont la documentation exclut explicitement ce cas (§3). Aucun compte inventé : 601 et 311 sont déjà la paire validée pour "coût qui sort du stock" |

**Pourquoi 701 et non 706** : FAC-001 utilise 706 (Services vendus) parce que `factures` peut facturer des services ou des produits indifféremment — un choix générique pour ce module. Le POS/les sorties vendent des **produits physiques** du catalogue (`products`, avec `prix_achat`/`prix_vente`) — exactement la même nature économique que BOI-001 (distributeur de boissons, marchandise physique). **701 est donc le compte correctement justifié par analogie directe avec BOI-001, pas 706.**

**Vente à crédit vs comptant** : voir §6 — le choix du compte de contrepartie (521 vs 411) dépend du mode de règlement, pas de la séquence 1 elle-même qui reste 701 au crédit dans les deux cas.

**NOT_DETERMINED** : le schéma exact des tables `ventes`/`vente_lignes`/`sorties`/`sortie_lignes` n'est défini dans **aucune migration versionnée** du dépôt (recherche `CREATE TABLE ventes`/`CREATE TABLE vente_lignes` = 0 résultat) — ces tables existent en production mais ont été créées hors du pipeline de migrations (cohérent avec le constat déjà établi ailleurs : la quasi-totalité des migrations réelles sont appliquées manuellement). Leur schéma complet n'est connu que par lecture du code applicatif (`commerce/page.tsx`, `stocks/sorties/page.tsx`), pas par une source de vérité versionnée. Toute implémentation future devra d'abord sonder ces deux tables en production (lecture seule) avant d'écrire la migration additive qui leur ajoutera les colonnes fiscales nécessaires (`montant_ht`/`montant_tva`/`montant_ca` par ligne ou par vente — absentes aujourd'hui, confirmé lors du plan d'exécution C1-C4).

---

## 6. FISCAL

**Réutilisation exclusive du Fiscal Core** (`lib/fiscal/universal-tax-engine.ts` via la même mécanique que BTP-001/RES-001/SAN-001/HOT-001/BOI-001 : TVA 18% Congo, Centime Additionnel 5% de la TVA — sourcé LF 2026, déjà validé dans ces 5 événements). Aucun nouveau calcul local — le "calcul" HT/TVA/CA d'une vente POS est de la même nature que celui déjà fait pour BOI-001 (vente comptant de marchandise), pas un nouveau besoin fiscal.

**Taux réduits** : aucun taux réduit n'est confirmé dans `lib/countries/CG.ts` pour un quelconque secteur — `NOT_DETERMINED`, ne pas en inventer un pour la vente comptoir.

**Cas exonérés** : le seul précédent réel et sourcé d'exonération TVA sur une vente est `lib/fiscalite/sante-exonerations.ts` (SAN-001) — basé sur la catégorie de prestation facturée (`consultation`, `hospitalisation`, `labo`), avec citation exacte de la loi (Art. 7-6° de la loi 12-97). Le mécanisme technique réel : la séquence TVA d'une règle `accounting_event_rules` porte une condition `[{"field":"montant_tva","op":">","value":"0"}]` (migration 140, ligne 122) — si l'appelant calcule et transmet `montant_tva = 0`, la séquence TVA ne produit simplement aucune ligne. **Ce mécanisme est directement réutilisable pour VTE-001** : si une ligne de vente est exonérée, l'appelant calcule `montant_tva=0`/`montant_ca=0` pour cette ligne avant l'émission, et la condition existante absorbe le cas sans rien inventer.

**NOT_DETERMINED** : quels produits/catégories du catalogue POS seraient exonérés. Le seul candidat de colonne produit-level (`products.taux_tva`) n'existe que dans la migration 050 — **jamais appliquée** (confirmé à de multiples reprises dans les missions BOI). Il n'existe donc aujourd'hui aucune donnée fiable permettant de savoir si un produit vendu au comptoir est exonéré. **Par défaut, toute vente POS doit être traitée comme pleinement taxable (18% + CA) jusqu'à preuve du contraire** — ne jamais inventer une exonération produit sans la même rigueur de preuve que `sante-exonerations.ts` (texte de loi, article, date).

**Représentation d'une vente sans fiscalité** (scénario 2) : `montant_tva=0` et `montant_ca=0` transmis à l'émission — la séquence 1 (701) reste la seule à produire une ligne, exactement comme une ligne SAN-001 exonérée aujourd'hui.

---

## 7. TREASURY

**Mécanismes existants pour caisse/banque/encaissement** : `comptes_bancaires`, `caisses`, `account_resolver='treasury_debit'` (déjà utilisé par RES-001/SAN-001/HOT-001/BOI-001 — résout dynamiquement le sous-compte 521/571 selon le moyen de paiement, confirmé fonctionnel en production). `transactions` (table de mouvements de caisse) alimentée par le moteur central pour tout `event_type` dont `fn_ae_has_treasury_impact()` renvoie vrai.

**A (comptant immédiate) ou B (créance puis paiement séparé) ?** → **Les deux coexistent déjà comme précédents réels, pas un choix arbitraire à faire** :
- **A — comptant** : RES-001/SAN-001/HOT-001/BOI-001 (521 direct). C'est le modèle **par défaut attendu pour le POS** : `ventes.mode_paiement` existe déjà (espèces/mobile money/carte, avec icônes dans `commerce/page.tsx`) — c'est un paiement immédiat par construction, exactement la même nature que BOI-001 (tournée boisson encaissée sur le moment).
- **B — crédit** : FAC-001 (411) puis FAC-002 (521/411 au règlement). C'est le modèle que `stocks/sorties` (type_sortie='vente', avec `destinataire`) tentait visiblement de suivre (débit 411), **mais sans jamais implémenter l'équivalent FAC-002** — c'est exactement le trou qui laisse la créance non soldée aujourd'hui.

**Conclusion non arbitraire** : le choix A/B doit dépendre du **moyen de paiement réel de la vente**, pas d'une règle fixe — une vente POS payée en espèces/mobile money/carte suit le modèle A (521 direct, `treasury_debit`) ; une vente avec `destinataire` et paiement différé (le cas que `stocks/sorties` visait) suit le modèle B (411, puis un second événement de règlement réutilisant la structure FAC-002 — pas un nouvel événement, le même `VTE-001` pourrait avoir une séquence 411/521 symétrique à FAC-002 déclenchée séparément, à concevoir dans une future mission de codage, pas ici).

---

## 8. STOCK

`fn_stock_move` (migration 173, en production, confirmée fonctionnelle) reste l'unique fonction d'écriture, inchangée. Le correctif structurel (hors périmètre de conception pure mais nécessaire à noter) : POS et stocks/sorties doivent appeler `/api/stock/move` au lieu du RPC direct, pour que :
- Le verrou anti-négatif (par produit ET par provenance si `origine` fourni) s'applique comme conçu.
- `purchase_item_id`/`origine` restent correctement transmis.
- Le futur `VTE-001` puisse s'émettre depuis le même point d'entrée serveur que le mouvement de stock, dans la même requête logique (pas deux appels réseau distincts non atomiques).

Pas de changement à `fn_stock_move` elle-même — elle gère déjà `quantité`/`tenant`/`produit`/`entrepôt`/`provenance`/`purchase_item_id`/`stock disponible` correctement (confirmé BOI-010/BOI-010D).

---

## 9. PROVENANCE

Le choix manuel de provenance (BOI-009 : jamais de bascule automatique entre origines, refus si la provenance désignée est insuffisante même si le stock global suffit) **doit être conservé intégralement**. `VTE-001` ne change rien à cette logique — chaque ligne de vente transmet son `origine` optionnel exactement comme `/api/stock/move` le fait déjà aujourd'hui pour toute sortie. Le `metadata` de l'événement comptable peut porter la répartition par provenance pour traçabilité, sans que cela influence le calcul comptable (701/4441/447/601/311 ne distinguent pas la provenance — seul `stock_movements.origine` le fait, déjà conçu ainsi en BOI-007).

---

## 10. IDEMPOTENCE

**Clé canonique, déjà existante pour tout event_type, pas à inventer** : `(tenant_id, event_type, source_table, source_id)`, protégée par `uidx_ae_processed` (statut `processed`) et `uidx_ae_inflight` (statuts `pending`/`processing`/`processed`, migration 138 lignes 190-198). Pour `VTE-001` : `(tenant_id, 'VTE-001', 'ventes', ventes.id)` ou `(tenant_id, 'VTE-001', 'sorties', sorties.id)` selon la source. Rejouer la même vente (même `source_id`) ne peut structurellement pas produire une deuxième écriture — le mécanisme est générique à `emit_accounting_event()`, aucune logique d'idempotence spécifique à écrire pour la vente.

Pour le stock : `fn_stock_move` n'a pas de clé d'idempotence par mouvement (chaque appel crée une ligne `stock_movements`) — l'idempotence du stock doit donc être assurée **côté appelant** (ne pas rappeler `fn_stock_move` deux fois pour la même vente), typiquement en vérifiant qu'aucun `stock_movements.reference = <numero de vente>` n'existe déjà avant d'émettre, à l'image du `reference` déjà utilisé par `/api/stocks/purchases`.

---

## 11. REVERSAL

**Mécanisme existant et réel** : `fn_reverse_accounting_event(p_event_id, p_reason, p_created_by)` (migration 138, lignes 911-980+) — inverse les lignes `journal_entries` (débit/crédit permutés), crée un nouvel `accounting_events` de type `EXT-<module>-<seq>`, protégé par une contrainte `UNIQUE(original_event_id)` sur `accounting_event_extournes` (empêche une double extourne). **Directement réutilisable pour `VTE-001`** sans aucune adaptation — c'est un mécanisme générique, pas spécifique à un module.

**Stock reverse** : `fn_stock_move` avec `type='entree'` (ou équivalent), sans origine imposée — déjà le mécanisme générique, pas de fonction de "retour" dédiée trouvée (`NOT_DETERMINED` s'il existe un type de mouvement `'retour'` dédié : la contrainte de type vue dans `/api/stock/move` autorise `'retour'` explicitement — **confirmé, PROVEN** : `['entree', 'sortie', 'reception', 'retour', 'ajustement', 'transfert']`, donc le type existe déjà dans la contrainte active, réutilisable).

**Fiscal reverse** : implicite dans `fn_reverse_accounting_event` — l'extourne inverse aussi les montants TVA/CA puisqu'elle inverse toutes les lignes `journal_entries` liées à l'événement d'origine, 4441/447 compris.

**Trésorerie reverse** : `NOT_DETERMINED` précisément — rien dans `fn_reverse_accounting_event` ne mentionne explicitement `transactions` (la table de mouvements de caisse). Si l'extourne crée bien des `journal_entries` inversées sur 521, `fn_sync_tresorerie_soldes` (déjà existant, appelé ailleurs pour tout événement à impact trésorerie) devrait recalculer le solde correctement par simple re-sommation — mais ceci n'est pas vérifié ligne à ligne dans cette mission de conception, à confirmer avant codage.

**Conclusion** : une vente annulée doit être traitée par `fn_reverse_accounting_event(event_id_VTE-001, raison)` + un mouvement de stock `type='retour'` + (vérification requise avant codage) confirmation que `fn_sync_tresorerie_soldes` reflète bien l'extourne. Aucun mécanisme à inventer — uniquement à vérifier plus précisément au moment du codage.

---

## 12. POS

```
AVANT (actuel) :
  commerce/page.tsx → INSERT ventes/vente_lignes → RPC directe fn_stock_move → (rien)

APRÈS (canonique, à concevoir pour codage futur, pas codé ici) :
  commerce/page.tsx → POST /api/sales (ou extension de /api/stock/move, à trancher
                       au codage) → serveur :
    1. Valide tenant (requireTenant), lignes, provenance par ligne
    2. Pour chaque ligne : fn_stock_move (type='sortie', origine transmise)
    3. Calcule HT/TVA/CA par ligne via le Fiscal Core (pas de calcul local)
    4. emit_accounting_event('VTE-001', ..., account_resolver='treasury_debit'
       si comptant, mode 411 si crédit)
    5. Retourne le détail (reçu) au client
```

Le bypass RPC direct disparaît : le client n'appelle plus jamais `fn_stock_move` lui-même.

---

## 13. STOCK OUTPUTS (stocks/sorties)

```
AVANT (actuel) :
  sorties/page.tsx → INSERT sorties/sortie_lignes → RPC directe fn_stock_move
                    → SI type_sortie='vente' : writeComptaEntry() legacy (411/701, pas de TVA)
                    → SI type_sortie IN ('perte','don') : writeComptaEntry() legacy (658/311)

APRÈS (canonique) :
  Pour type_sortie='vente' : même point d'entrée serveur que le POS (§12),
    avec source_table='sorties' au lieu de 'ventes' — SEULE différence, le
    reste du flux (stock, fiscal, comptabilité, trésorerie) est identique.
  Pour type_sortie IN ('perte','don') : HORS PÉRIMÈTRE de VTE-001 — ce n'est
    pas une vente, STK-002 (601/311, déjà correctement conçu pour "sortie non
    facturée") reste le bon véhicule, à condition de router aussi cette
    branche via /api/stock/move au lieu du RPC direct — un correctif de
    bypass, pas un changement de règle comptable.
```

```
POS  ─┐
      ├─→ SALE FLOW CANONIQUE (VTE-001, un seul point d'entrée serveur)
SORTIES (vente) ─┘

SORTIES (perte/don) ──→ reste sur STK-002, juste re-routé via /api/stock/move
```

---

## 14. PHARMACY BOUNDARY

**Non intégrée dans cette mission, conformément au mandat.** Observation structurelle, sans conception détaillée : la pharmacie (`pharmacie_medicaments`) n'utilise ni `stock_movements` ni `fn_stock_move` (confirmé dans les missions d'audit précédentes — écrit `stock_actuel` directement). Le flux canonique `VTE-001` conçu ici **est réutilisable en principe** pour une future vente de pharmacie, à condition que la pharmacie migre d'abord son modèle de données vers `products`/`stock_movements` — un chantier séparé et préalable, pas une adaptation de `VTE-001` lui-même. Rien de plus déterminé ici : `NOT_DETERMINED` pour toute spécificité fiscale pharmacie (l'exonération médicament de l'Annexe 3, déjà signalée `NOT_DETERMINED` dans `sante-exonerations.ts`, reste non résolue).

---

## 15. TEST MATRIX

| # | Scénario | Stock | Fiscal | Trésorerie | Comptabilité |
|---|---|---|---|---|---|
| 1 | Vente comptant taxable | `fn_stock_move` sortie, origine si fournie | HT×18% TVA, ×5% CA | 521 (resolver `treasury_debit`) | VTE-001 seq1-4 (701/4441/447/601-311) |
| 2 | Vente comptant exonérée | idem | `montant_tva=0`/`montant_ca=0` transmis | 521 | seq1 (701) + seq4 (601/311) seulement — seq2/3 absentes (condition `montant_tva>0`) |
| 3 | Vente à crédit taxable | idem | idem scénario 1 | 411 (créance), puis 521/411 au règlement séparé | VTE-001 seq1-4 avec 411 au lieu de 521 ; second événement de règlement (structure FAC-002) |
| 4 | TVA réduite | — | `NOT_DETERMINED` — aucun taux réduit confirmé dans CG.ts | — | — |
| 5 | Vente multi-lignes | `fn_stock_move` par ligne | HT/TVA/CA agrégés sur l'ensemble des lignes taxables de la vente | 1 seule écriture trésorerie pour le total | 1 seul `accounting_events` avec montants agrégés, `metadata` détaille les lignes |
| 6 | Plusieurs origines stock | `fn_stock_move` par ligne avec `origine` propre à chacune | inchangé | inchangé | inchangé — la provenance ne change aucun compte comptable (§9) |
| 7 | Vente annulée | `fn_stock_move` type `'retour'` | inversé via l'extourne | `NOT_DETERMINED` précisément sur `fn_sync_tresorerie_soldes` (§11) | `fn_reverse_accounting_event(event_id)` |
| 8 | Vente déjà traitée (idempotence) | Appelant doit vérifier `stock_movements.reference` avant rappel (§10) | — | — | `uidx_ae_processed` bloque une 2e écriture pour le même `source_id` |
| 9 | Stock insuffisant | `fn_stock_move` refuse (verrou existant, par provenance si fournie) — transaction annulée avant tout emit comptable | n/a | n/a | n/a (rien n'est émis si le stock échoue — ordre : stock avant comptabilité) |
| 10 | Tenant incorrect | `requireTenant()` refuse avant tout accès — même discipline que C1/C2/C4 | n/a | n/a | n/a |
| 11 | Paiement séparé | Identique scénario 3 | idem | 2e événement (règlement) | 2e set de lignes (521/411) |
| 12 | Vente sans paiement immédiat | Identique scénario 3/11 | idem | 411 seul jusqu'au règlement | VTE-001 seq1-4 avec 411, pas de ligne 521 avant règlement |

---

## 16. IMPLEMENTATION PLAN

Non exécuté — pour référence d'une future mission de codage uniquement :
1. Sonder en lecture seule le schéma réel de `ventes`/`vente_lignes`/`sorties`/`sortie_lignes` en production (aucune migration ne les documente, §5).
2. Migration additive : colonnes `montant_ht`/`montant_tva`/`montant_ca` par ligne (ou par vente), sur le modèle déjà posé pour `stock_movements.origine` (migration 184, additive, jamais invasive).
3. Nouvelle règle `accounting_event_rules` pour `VTE-001` (4 séquences, comptes 701/4441/447/601-311, resolver `treasury_debit` conditionnel au moyen de paiement) — migration modélisée sur 146 (BOI-001), pas inventée.
4. Nouveau point d'entrée serveur unique (POS + sorties/vente) appelant `/api/stock/move` puis `emit_accounting_event('VTE-001', ...)` dans la même requête.
5. Retrait du `writeComptaEntry()` legacy sur la branche `type_sortie==='vente'` de `stocks/sorties`.
6. Retrait des appels RPC directs à `fn_stock_move` sur POS et sorties.
7. Tests transactionnels (BEGIN/ROLLBACK) dès qu'un canal DB existe (C5 toujours bloqué).

---

## 17. EXIT CRITERIA

`C6_ARCHITECTURE_READY = YES` exige, tous simultanément :
- [x] Source de vérité du calcul comptable identifiée (comptes 701/4441/447/601/311, tous prouvés par précédent réel — §3-5)
- [x] Événement défini conceptuellement (`VTE-001`, structure complète — §4)
- [x] Règle comptable décrite (4 séquences, pas codées — §5)
- [x] Flux fiscal déterminé (Fiscal Core existant, mécanisme d'exonération identifié — §6)
- [x] Flux trésorerie déterminé (comptant vs crédit, les deux sur précédent réel — §7)
- [x] Flux stock déterminé (inchangé, juste re-routé — §8)
- [x] Provenance préservée (§9)
- [x] Idempotence identifiée (mécanisme générique déjà existant — §10)
- [x] Reverse identifié (mécanisme générique déjà existant, une zone `NOT_DETERMINED` précise sur la trésorerie — §11)
- [x] POS et stocks/sorties convergent vers un seul flux (§12-13)
- [~] Schéma exact de `ventes`/`vente_lignes`/`sorties`/`sortie_lignes` — **NOT_DETERMINED**, aucune migration ne le documente ; connu seulement par lecture de code applicatif

Le seul point réellement bloquant pour un passage direct au codage est l'absence de schéma versionné pour les tables sources — pas un manque de décision architecturale.

---

## VERDICT

```
C6_ARCHITECTURE_READY = PARTIAL
```

**PARTIAL, pas YES** : l'architecture comptable, fiscale, trésorerie, stock, provenance, idempotence et reverse est entièrement déterminée à partir de précédents réels et prouvés — aucune invention de compte ni de règle fiscale. Le seul point non résolu est documentaire, pas conceptuel : le schéma réel de `ventes`/`vente_lignes`/`sorties`/`sortie_lignes` n'existe dans aucune migration versionnée et devra être sondé en production (lecture seule) avant d'écrire la migration additive — une étape triviale mais non encore faite, qui empêche de déclarer `YES` sans réserve. Une seconde réserve mineure (`NOT_DETERMINED`) porte sur le comportement exact de `fn_sync_tresorerie_soldes` lors d'une extourne, à vérifier avant codage, pas avant conception.

**PARTIAL, pas BLOCKED** : aucun obstacle structurel ne bloque la conception elle-même — tout ce qui manque est vérifiable en lecture seule dès qu'un canal (même PostgREST) est disponible, sans attendre la levée du blocage C5/Docker.

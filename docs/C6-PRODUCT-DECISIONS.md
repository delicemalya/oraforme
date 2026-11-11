# C6 — DÉCISIONS PRODUIT (D1 / D2 / D3)

Mission de décision, lecture seule. Aucun code, aucune migration, aucune modification DB, aucun commit/push.

---

## 1. CONTEXTE

`DECISION_OPTION = A` déjà actée (`C6-ARCHITECTURE-ARBITRATION.md`) : modèle canonique `ventes`→`vente_lignes`, `sorties`/`sortie_lignes` non créées. Cette mission tranche les 3 décisions produit laissées ouvertes, à partir des conventions déjà réellement présentes dans le dépôt — pas d'invention.

---

## 2. D1 — GRANULARITÉ FISCALE

### Précédent déterminant, prouvé par introspection directe

```
factures        : id, tenant_id, client_nom, ..., montant_ht, tva, tva_montant, ca, total, ...
facture_lignes  : id, invoice_id, description, price, quantity, total
```

**`facture_lignes` ne porte AUCUNE colonne fiscale** — ni `tva`, ni `ca`, ni `montant_ht` par ligne. Toute la fiscalité d'une facture (`montant_ht`, `tva`, `tva_montant`, `ca`) est portée **exclusivement au niveau du document** (`factures`). C'est le précédent le plus directement comparable à `ventes`/`vente_lignes` (même structure : document parent + lignes commerciales enfants), et il tranche sans ambiguïté.

Confirmé également pour tous les autres événements de type "vente" existants (RES-001, SAN-001, HOT-001, BOI-001, FAC-001) : chacun reçoit `montant_ht`/`montant_tva`/`metadata.ca` comme **paramètres uniques de l'événement**, jamais une décomposition ligne par ligne recalculée par le moteur. Le calcul HT/TVA/CA est fait une fois, côté appelant, sur le total de la transaction.

### Comparaison

| | D1-A (vente uniquement) | D1-B (ligne uniquement) | D1-C (les deux, ligne=vérité) |
|---|---|---|---|
| Cohérence avec l'architecture actuelle | **Totale** — identique à `factures`/`facture_lignes` | Aucune — aucun précédent de ce type dans tout le dépôt | Partielle — invente une capacité (taux mixte par ligne) absente partout ailleurs |
| Duplication | Aucune | Aucune | Les totaux de vente seraient un agrégat dérivé — pas une 2e source si implémenté correctement, mais complexité pour un besoin non prouvé |
| Impact reporting | Simple — `commerce/analytics/page.tsx` lit déjà `ventes.total`, étendre à `montant_ht`/`montant_tva`/`montant_ca` sans toucher aux lignes | Nécessiterait de sommer les lignes à chaque lecture | Les deux lectures possibles, mais aucun rapport existant n'en a besoin |
| Impact reverse | `fn_reverse_accounting_event` inverse les lignes `journal_entries` liées à l'événement — un seul jeu de montants au niveau vente, cohérent avec FAC-001/RES-001/BOI-001 | Idem mais sans précédent de calcul | Idem, complexité inutile |
| Impact audit | Identique au contrôle déjà fait sur une facture | — | — |
| Multi-taux/exonération dans une même vente | **Techniquement impossible aujourd'hui, et ce n'est pas un recul** : `factures` elle-même ne le permet pas (1 seule `tva`/`ca` par facture, confirmé par le schéma) — une vente POS n'est pas moins capable que ce que le reste du système sait déjà faire | Supposerait une capacité qui n'existe nulle part ailleurs | Supposerait la même capacité, pour rien de prouvé |

**Vérification explicite demandée par la mission** : le modèle actuel ne permet PAS plusieurs traitements fiscaux dans un même document commercial — `factures` elle-même, le précédent le plus mûr du dépôt, n'a qu'une seule valeur `tva`/`ca` pour l'ensemble de ses lignes. Choisir D1-B ou D1-C créerait une capacité qu'aucun autre module n'a — une invention, pas une réutilisation.

```
DECISION = D1-A — montants fiscaux (montant_ht, montant_tva, montant_ca) au niveau `ventes` uniquement. `vente_lignes` reste purement commercial (produit, quantité, prix, sous-total), exactement comme `facture_lignes`.
JUSTIFICATION = Précédent direct et unanime : factures/facture_lignes (structure identique) + les 5 event_types de vente existants (FAC-001, RES-001, SAN-001, HOT-001, BOI-001) calculent tous HT/TVA/CA au niveau transaction, jamais par ligne.
PREUVE = Introspection PostgREST : facture_lignes = {id, invoice_id, description, price, quantity, total} — 0 colonne fiscale. factures = porte montant_ht/tva/tva_montant/ca.
IMPACT = Migration additive sur `ventes` uniquement (montant_ht, montant_tva, montant_ca) ; `vente_lignes` inchangée.
RISQUES = Si un besoin réel de taux mixte par produit apparaît plus tard (ex. produit exonéré + produit taxé dans le même panier), cette décision devra être révisée — mais ce besoin n'est prouvé par aucun code existant aujourd'hui (voir C6-design §6, NOT_DETERMINED sur l'exonération produit).
```

---

## 3. D2 — STOCKS/SORTIES, BRANCHE `vente`

### Analyse de la branche actuelle

`stocks/sorties/page.tsx`, pour `type_sortie='vente'`, collecte `destinataire` (client nommé) et `warehouse_id` (entrepôt explicite) — **un contexte d'usage différent du POS comptoir** (pas de client nommé, pas de sélection d'entrepôt dans `commerce/page.tsx`, qui est pensé pour une vente rapide au comptoir). Ce n'est pas un doublon du POS, c'est un second point d'entrée légitime vers le même fait économique (une vente), avec un contexte métier différent (vente à un client identifié, depuis un entrepôt précis — proche d'une vente de gros/B2B).

### Comparaison des options

| | A — devient une interface de création de `ventes` | B — redirection pure vers le POS | C — suppression/dépréciation | D — autre |
|---|---|---|---|---|
| Préserve le contexte `destinataire`/`warehouse_id` | **Oui** — ces champs deviennent des métadonnées de la vente créée | Non — le POS n'a ni l'un ni l'autre, perte de capacité | Non — perte totale | — |
| Convergence du modèle de données | **Totale** — écrit dans `ventes`/`vente_lignes`, émet `VTE-001` comme le POS | Totale, mais au prix de forcer l'utilisateur dans une UI non adaptée à son usage (vente à un client nommé) | Sans objet | — |
| Risque UX | Faible — même écran, même logique de formulaire, cible de persistance changée | Élevé — un utilisateur qui vendait à un client nommé depuis un entrepôt précis perd cette capacité | Élevé — capacité perdue sans remplacement | — |
| Cohérence avec "ne pas supprimer l'écran entier" (consigne explicite) | **Conforme** — seule la logique d'écriture de la branche change, pas l'écran | Conforme à l'écran global, mais vide la branche vente de sens propre | Non conforme si appliqué à toute la page ; conforme seulement si limité à la branche | — |

```
DECISION = A — la branche `type_sortie='vente'` devient une interface de création de `ventes`/`vente_lignes` (même UI, cible de persistance changée), pas une redirection vers le POS ni une suppression.
JUSTIFICATION = destinataire/warehouse_id représentent un contexte d'usage réel et distinct du POS comptoir (vente à un client nommé, depuis un entrepôt précis) — rediriger vers le POS supprimerait cette capacité sans aucune raison technique, puisque les deux écrans peuvent écrire dans le même modèle canonique.
PREUVE = Lecture directe de stocks/sorties/page.tsx : champs destinataire/warehouse_id absents de commerce/page.tsx (POS) ; absence de toute UI de sélection d'entrepôt ou de client nommé au comptoir.
IMPACT = Le formulaire existant (destinataire, warehouse_id, lignes produit/quantité/prix) est conservé ; au moment de la validation, il écrit dans ventes (avec destinataire éventuellement porté par la colonne notes déjà existante, ou une colonne dédiée à trancher au codage) + vente_lignes, puis appelle le même point d'entrée serveur que le POS (émission VTE-001). Le writer legacy writeComptaEntry() disparaît de cette branche.
RISQUES = destinataire n'a pas de colonne dédiée sur `ventes` aujourd'hui (seul `notes`, texte libre, existe) — décision de schéma à prendre au moment du codage, pas ici.
```

**Les 5 autres raisons (`consommation`, `transfert`, `perte`, `don`, `usage_interne`)** restent explicitement hors périmètre de cette décision — voir section 7. Elles ne doivent pas être redirigées vers `ventes` (ce ne sont pas des ventes) ; leur propre destination de persistance (recréer une table dédiée, ou s'appuyer directement sur `stock_movements` sans document parent) reste à trancher séparément, sans conflit avec la décision D2 ci-dessus puisque la bascule se fait uniquement sur la condition `type_sortie === 'vente'` dans le code, pas sur la page entière.

---

## 4. D3 — CRÉDIT POS V1

### Précédent déterminant, trouvé dans le code actuel (pas supposé)

`commerce/page.tsx` propose **déjà** `'credit'` comme mode de paiement sélectionnable au comptoir (`{ id: 'credit', label: 'Crédit', icon: '📒' }`, ligne 61 ; `MODE_ICONS` l'affiche aussi dans l'historique des ventes, ligne 280). **Le choix produit "le POS doit pouvoir vendre à crédit" est donc déjà pris et exposé dans l'interface existante** — il ne s'agit pas d'une fonctionnalité hypothétique à arbitrer, mais d'une option UI déjà vivante qui n'est aujourd'hui raccordée à rien côté comptabilité (cohérent avec l'absence totale d'émission comptable déjà documentée).

### Mécanisme réutilisable, déjà existant

```
FAC-001 (facture émise, crédit)  : séq1 411/706 (ou 701 pour une vente de marchandises) montant_ht
                                    séq2 411/4441 montant_tva
                                    séq3 411/447 metadata.ca
FAC-002 (règlement facture)      : séq1 521/411 montant_ttc (resolver treasury_debit)
```

Ce couple est **directement réutilisable sans modification** pour une vente POS à crédit : même structure, comptes déjà prouvés (701 au lieu de 706 pour une vente de marchandise, cohérent avec BOI-001 — voir C6-design §5). Aucun nouveau mécanisme de paiement à inventer.

### Comparaison

| | D3-A — V1 comptant uniquement | D3-B — V1 comptant + crédit |
|---|---|---|
| Cohérence avec l'UI existante | **Rupture** — l'option "Crédit" resterait sélectionnable sans jamais produire d'écriture cohérente (le compte résolu serait un 521 de caisse pour une vente qui n'a reçu aucun argent) | **Conforme** — l'option déjà exposée devient enfin fonctionnelle |
| Effort technique | Légèrement moindre (1 séquence de compte en moins à résoudre) | Réutilise FAC-001/FAC-002 tels quels — pas un nouveau système |
| Risque si non traité | Une vente marquée "Crédit" créerait une fausse entrée de caisse (521) pour un encaissement qui n'a pas eu lieu — **risque de trésorerie faussée, pas seulement une fonctionnalité manquante** | — |
| UI de recouvrement (lister les ventes à crédit impayées, marquer comme payée) | Sans objet en V1 | **Manquante** — aucun écran équivalent à la liste des factures impayées n'existe pour `ventes` ; à construire, c'est le seul vrai travail neuf |

```
DECISION = D3-B — le modèle de données et la règle comptable V1 doivent couvrir le comptant ET le crédit, en réutilisant FAC-001/FAC-002 sans modification de structure.
JUSTIFICATION = Le choix produit "vendre à crédit au comptoir" est déjà fait et exposé dans l'UI actuelle (option "Crédit" sélectionnable) — le laisser non raccordé créerait une incohérence comptable active (caisse créditée pour un encaissement fictif), pire qu'un simple report de fonctionnalité.
PREUVE = app/dashboard/commerce/page.tsx, ligne 61 (liste des modes de paiement) et ligne 280 (MODE_ICONS) — 'credit' déjà présent, pas une extension future supposée.
IMPACT = VTE-001 doit résoudre le compte de contrepartie de la séquence 1 selon mode_paiement : 521 (treasury_debit) si especes/mobile/carte, 411 si credit — même logique de résolution que l'account_resolver déjà utilisé par BOI-001/RES-001. Un second event_type (ou une seconde émission du même event_type, structure FAC-002) doit exister pour le règlement ultérieur d'une vente à crédit.
RISQUES = Aucune UI de recouvrement n'existe aujourd'hui pour lister/solder les ventes à crédit (équivalent du module factures impayées) — c'est un développement UI réel, pas seulement un branchement comptable ; à prévoir explicitement dans la mission de codage, pas dans cette mission de décision.
```

---

## 5. VTE-001 — PRÉ-DESIGN

Comparaison explicite avec les 3 précédents cités par la mission, intégrant D1/D2/D3 :

| | BOI-001 | FAC-001/002 | STK-002 | **VTE-001 (pré-design)** |
|---|---|---|---|---|
| Rôle | Vente comptant marchandise | Vente crédit (facture) | Coût de sortie stock **non facturée** | Vente marchandise, comptant **ou** crédit |
| Compte revenu | 701 | 706 | — | **701** (marchandise, comme BOI-001 — pas 706, voir C6-design §5) |
| TVA | 4441 | 4441 | — | 4441 |
| CA | 447 | 447 | — | 447 |
| Coût stock | — (jamais traité par BOI-001 lui-même) | — | 601/311 | **601/311, séquence propre à VTE-001** — PAS en réutilisant STK-002 (son rôle est explicitement la sortie non facturée, cf. C6-design §3 et sa propre documentation source) |
| Contrepartie | 521 (resolver `treasury_debit`) | 411 → puis 521 via FAC-002 | — | **521 (resolver) si comptant, 411 si crédit** (D3) |

**Conforme à la consigne explicite** : STK-002 n'est pas réutilisé comme événement de vente. La vente (`VTE-001`) et le coût des marchandises vendues restent deux faits comptables distincts portés par le même événement mais des séquences dédiées — pas par un emprunt de l'identité `STK-002`.

### Design conceptuel de la règle

| Champ | Valeur |
|---|---|
| `event_type` | `VTE-001` |
| `source_table` | `ventes` (unique — D2 fait écrire la branche sortie/vente dans cette même table, pas une table séparée) |
| `source_id` | `ventes.id` |
| `idempotence` | `(tenant_id, 'VTE-001', 'ventes', source_id)` — mécanisme générique déjà existant (`uidx_ae_processed`), aucune clé à inventer |
| `conditions` (par séquence) | Séq TVA/CA : `montant_tva > 0` / `montant_ca > 0` (même mécanisme que SAN-001, réutilisé, pas inventé) |
| Comptes | Séq1 : `{521 resolver ou 411}` / 701, montant_ht · Séq2 : idem / 4441, montant_tva · Séq3 : idem / 447, montant_ca · Séq4 : 601 / 311, coût (quantité × prix_achat agrégé sur les lignes) |
| `metadata` | `{ vente_id, lignes: [...], mode_paiement, destinataire? (D2), origine par ligne (traçabilité) }` |
| Fiscal data | `montant_ht`, `montant_tva`, `montant_ca`, `montant_ttc` — calculés une fois au niveau vente (D1-A), transmis par l'appelant, jamais recalculés par le moteur |
| Cash vs crédit | Détermine le compte débité en séquence 1-3 (521 résolu vs 411) — **pas** un event_type différent (D3) |
| Reverse | `fn_reverse_accounting_event(event_id)` — générique, déjà existant, aucune adaptation nécessaire |

Un second event conceptuel (pas un nouveau nom à inventer — structure FAC-002 reproduite) pour le règlement d'une vente à crédit : séq1 `521 (resolver) / 411`, montant_ttc, `source_table='ventes'`, déclenché par une action UI de recouvrement encore à construire (D3, risque noté).

---

## 6. ARCHITECTURE FINALE C6

```
POS (comptoir)  ──┐
                   ├──→ ventes + vente_lignes (D1-A : fiscalité au niveau vente)
SORTIES (vente) ──┘         │
                             ├──→ fn_stock_move (par ligne, origine conservée)
                             └──→ emit_accounting_event('VTE-001', ...)
                                     ├─ comptant → 521 (resolver) / 701, 4441, 447 + 601/311
                                     └─ crédit   → 411 / 701, 4441, 447 + 601/311
                                                     └─(plus tard, UI de recouvrement)→ 521/411 (structure FAC-002)

SORTIES (consommation/transfert/perte/don/usage_interne) ──→ HORS PÉRIMÈTRE C6, décision séparée
```

---

## 7. DÉCISIONS EXPLICITEMENT REPORTÉES

- Destination de persistance exacte pour `destinataire` (nouvelle colonne sur `ventes`, ou réutilisation de `notes`) — détail de codage, pas une décision produit bloquante.
- Les 5 raisons non-vente de `stocks/sorties` — table dédiée à recréer, ou usage direct de `stock_movements` sans document parent (hypothèse soulevée mais non tranchée ici, hors périmètre explicite de C6).
- UI de recouvrement des ventes à crédit (lister/solder) — développement réel non encore spécifié, signalé comme risque D3, pas conçu ici.
- Vérification `fn_sync_tresorerie_soldes` sur l'extourne (reportée depuis C6-design, toujours `NOT_DETERMINED`).

---

## 8. IMPACTS MIGRATION

1. `ventes` : ajout `montant_ht`, `montant_tva`, `montant_ca` (D1-A, niveau vente uniquement) ; éventuellement une colonne `destinataire`/`client_nom` (D2, décision de détail reportée).
2. `vente_lignes` : aucun changement nécessaire (D1-A exclut toute colonne fiscale par ligne).
3. Nouvelle règle `accounting_event_rules` pour `VTE-001`, 4 séquences (§5), modélisée sur BOI-001 (701/4441/447) + un ajout propre à VTE-001 pour 601/311 (pas un emprunt de STK-002).
4. Toujours aucune création de `sorties`/`sortie_lignes` (confirmé, hérité de la mission précédente).

---

## 9. IMPACTS CODE

1. Nouveau point d'entrée serveur unique (POS + branche sortie/vente) — calcul fiscal, résolution comptant/crédit, appel `fn_stock_move`, appel `emit_accounting_event`.
2. `stocks/sorties/page.tsx` : branche `type_sortie==='vente'` repointée vers ce point d'entrée (table `ventes`, pas `sorties`) ; les 5 autres branches inchangées dans leur UI mais toujours en attente d'une destination de persistance fonctionnelle (hors périmètre).
3. `commerce/page.tsx` : le mode "Crédit" déjà présent dans l'UI devient fonctionnel (D3-B) dès que le point d'entrée serveur résout correctement 411 vs 521.
4. `commerce/analytics/page.tsx` : à étendre pour exploiter `montant_ht`/`montant_tva`/`montant_ca` une fois disponibles (actuellement limité à `total`).
5. Retrait de `writeComptaEntry()` sur la branche `vente` de `stocks/sorties` (D2).

---

## 10. TESTS REQUIS

1. Vente comptant (`especes`/`mobile`/`carte`) → 4 séquences 521(resolver)/701/4441/447 + 601/311, exécution réelle dès qu'un canal DB existe.
2. Vente crédit → séquences 411/701/4441/447 + 601/311, puis un second événement 521/411 au règlement (test du mécanisme FAC-002 réutilisé sur `source_table='ventes'`).
3. Idempotence : rejouer le même `ventes.id` → aucune deuxième écriture (`uidx_ae_processed`).
4. Reverse : `fn_reverse_accounting_event` sur un `VTE-001` → lignes inversées, pas de double extourne possible.
5. Branche `stocks/sorties`(vente) après bascule → produit exactement les mêmes écritures qu'une vente POS équivalente avec les mêmes `destinataire`/`warehouse_id` portés en métadonnée.
6. Non-régression `commerce/analytics/page.tsx` après ajout des colonnes fiscales.

---

## 11. RISQUES

| Risque | Lié à | Sévérité |
|---|---|---|
| UI de recouvrement crédit manquante — le mode "Crédit" deviendrait comptablement correct à l'émission mais sans moyen de le solder tant que cette UI n'existe pas | D3 | Moyen — à spécifier avant codage, pas bloquant pour écrire la règle VTE-001 elle-même |
| `destinataire` sans colonne dédiée pourrait finir en texte libre peu exploitable pour du reporting | D2 | Faible |
| Les 5 raisons non-vente de `stocks/sorties` restent cassées après cette décision — risque de confusion si communiqué comme "stocks/sorties résolu" alors que seule la branche vente l'est | D2 | Moyen, communicationnel |

---

## 12. PRÉREQUIS D'IMPLÉMENTATION

1. Aucune décision produit supplémentaire n'est requise pour coder `VTE-001` et la bascule POS/sorties(vente) — D1/D2/D3 sont tranchées.
2. Spécifier (mission de conception UI, pas de code) l'écran de recouvrement des ventes à crédit avant de livrer D3-B en production — peut suivre dans une itération séparée sans bloquer l'émission comptable elle-même (une vente à crédit resterait "non soldée" visible en base, juste sans écran dédié au premier jet).
3. Canal DB transactionnel (C5, toujours bloqué) avant tout déploiement réel — pas avant l'écriture du code/de la migration.
4. Décision séparée (hors C6) sur les 5 raisons non-vente de `stocks/sorties`.

---

## VERDICT

```
C6_PRODUCT_DECISIONS = READY
```

Les trois décisions sont arbitrées par preuve directe, pas par invention :
- **D1-A** : précédent unanime (`factures`/`facture_lignes` + 5 event_types de vente existants).
- **D2-A** : préserve un usage réel distinct (client nommé/entrepôt) déjà présent dans le code, sans dupliquer de table.
- **D3-B** : le choix produit est déjà fait et visible dans l'UI actuelle (option "Crédit" existante) — le confirmer n'invente rien, l'ignorer aurait laissé une incohérence active.

`READY` ne signifie pas "prêt à déployer" : les prérequis de la section 12 (UI de recouvrement, canal DB) restent réels et doivent être levés avant mise en production — mais aucune décision métier ne reste floue pour démarrer la conception détaillée de la migration et de la règle `VTE-001`.

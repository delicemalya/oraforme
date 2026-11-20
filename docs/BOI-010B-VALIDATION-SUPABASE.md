# BOI-010B — Validation réelle Supabase de la provenance

Mission P0-BOI-010B, 2026-09-22. Objectif unique : valider la migration 184 et la vraie fonction PostgreSQL contre la vraie base Supabase, **avant** toute exécution définitive. Aucune modification durable de la production. Aucune donnée de test laissée. Migration 184 **non exécutée**.

---

## 1. Connectivité — tentatives réelles, résultat honnête

Trois tentatives distinctes de rétablir l'accès MCP Supabase pendant cette mission, toutes en échec, plus une recherche d'alternative :

| Tentative | Méthode | Résultat |
|---|---|---|
| 1 | `ToolSearch` sur les outils MCP Supabase, immédiat | `CONNECT_TIMEOUT` après 30000ms |
| 2 | Nouvelle tentative après 20 secondes d'attente réelle | `CONNECT_TIMEOUT` après 30000ms, identique |
| 3 | Recherche d'une méthode alternative : `psql` (absent du PATH), variable `DATABASE_URL`/mot de passe Postgres direct (recherché dans tous les fichiers `.env*` du dépôt — absent), fichier `supabase/config.toml` (absent — projet non lié localement via CLI) | **Aucune méthode transactionnelle disponible** |

**Ce qui reste disponible et a été utilisé, sans jamais le faire passer pour une simulation de la vraie base** : l'API PostgREST du projet réel (`https://mrzixapnaqsbqmagivvf.supabase.co/rest/v1/`), avec la clé `service_role` du fichier `.env.local` du dépôt (même projet, même clé que toutes les missions BOI-005 à BOI-010). **C'est la vraie base de données de production, interrogée en lecture seule via un chemin HTTP différent — pas une base alternative, pas un mock.** Sa limite structurelle : chaque requête PostgREST est auto-validée indépendamment, sans notion de transaction `BEGIN…ROLLBACK` inter-requêtes — elle ne peut donc ni appliquer temporairement une migration, ni l'annuler proprement. Tout ce qui exige une session SQL transactionnelle (Étapes 4 à 10 de la mission) est en conséquence **NOT_TESTABLE** cette session, documenté comme tel ci-dessous plutôt qu'improvisé.

- **Projet** : `mrzixapnaqsbqmagivvf` (« Oraform »), le même projet réel utilisé par toutes les missions BOI précédentes.
- **Environnement** : production (aucun projet de recette/staging distinct disponible, fait déjà établi lors d'une mission antérieure de cet engagement).
- **Clé utilisée** : `SUPABASE_SERVICE_ROLE_KEY` (`.env.local`) — pour les lectures ci-dessous uniquement, aucune écriture.
- **Absence de modification de production** : confirmée par comparaison pré/post-état (§2, §13) — identiques.

---

## 2. Pré-état (capturé en lecture seule, 2026-09-22T19:57:28Z)

| Élément | Valeur |
|---|---|
| `products` | 10 |
| `warehouses` | 1 |
| `stock_movements` | 0 |
| `purchases` | 0 |
| `purchase_items` | 0 |
| `suppliers` | 0 |
| `journal_entries` | 21 *(données comptables réelles préexistantes, sans rapport avec le stock — module paie/trésorerie d'un tenant réel déjà connu de cet engagement, non touchées par BOI-010/010B)* |
| `accounting_events` | 2 *(idem)* |
| `stock_movements.origine` | **Absente** — `42703 column "origine" does not exist` |
| `stock_movements.purchase_item_id` | **Absente** — `42703 column "purchase_item_id" does not exist` |
| `v_products_stock_par_origine` | **Absente** — `PGRST205 Could not find the table` |
| `v_products_stock` (vue existante) | **Fonctionne normalement**, retourne des données réelles (`stock_actuel: 0` pour les produits échantillonnés, cohérent avec 0 mouvement) |

Ce pré-état confirme exactement ce que BOI-010 avait rapporté : la migration 184 n'a jamais été appliquée, le schéma est resté strictement identique depuis BOI-004.

---

## 3. Migration 184 — revue statique intégrale (aucune exécution possible)

Lecture complète du fichier `supabase/migrations/184_stock_provenance.sql`, poste par poste :

| Point vérifié | Constat |
|---|---|
| **Idempotence** | Partielle et volontaire : les `ALTER TABLE ADD COLUMN`/`ADD CONSTRAINT` ne sont pas idempotents en soi, mais un garde-fou (`DO $$ ... IF EXISTS ... RAISE EXCEPTION`) en tête de transaction fait échouer et annuler tout le bloc en cas de ré-exécution — même convention que la migration 183 (BOI-004). Les créations d'index utilisent `IF NOT EXISTS` ; `CREATE OR REPLACE FUNCTION`/`VIEW` sont nativement idempotents. |
| **Contraintes** | `CHECK (origine IS NULL OR origine IN (...))` correcte, 3 valeurs + NULL, conforme à BOI-006 §4. |
| **FK** | `purchase_item_id → purchase_items(id)`, sans `ON DELETE` explicite → `NO ACTION` par défaut : empêche la suppression d'une ligne d'achat référencée par un mouvement de stock plutôt que de la laisser en cascade ou de la mettre à NULL — comportement le plus sûr pour un grand livre censé rester intègre. |
| **Index** | `(product_id, origine)` et `(purchase_item_id)` — cohérents avec les requêtes anticipées (solde par origine, traçabilité inverse). |
| **RLS** | Aucune nouvelle policy nécessaire (colonnes sur une table déjà isolée par `tenant_id`) ; la nouvelle vue est `security_invoker=true`, comme `v_products_stock`. |
| **Rétrocompatibilité** | **Défaut réel trouvé et corrigé pendant cette mission** (détail ci-dessous). |
| **NULL historiques** | Colonne nullable, `CHECK` autorise `NULL`, aucun backfill — conforme. |
| **fn_stock_move** | Voir défaut ci-dessous. |
| **Vue `v_products_stock_par_origine`** | `INNER JOIN` + `WHERE origine IS NOT NULL`, `GROUP BY product_id, tenant_id, nom, warehouse_id, origine` — exclut correctement les mouvements historiques non taggés des soldes par origine, sans affecter `v_products_stock` (non touchée). Un produit sans mouvement origine-tagué n'apparaît simplement pas dans cette vue (comportement voulu, cohérent avec le code POS de BOI-010 qui traite l'absence comme « aucune origine connue »). |

### Défaut réel trouvé à la revue, corrigé dans le fichier (migration toujours non exécutée)

`CREATE OR REPLACE FUNCTION fn_stock_move(...)` déclarait une nouvelle liste de 10 paramètres alors que l'ancienne fonction en production en a 8. **PostgreSQL identifie une fonction par son nom ET la liste des types de ses paramètres, pas par le nom seul** — une liste de types différente signifie que `CREATE OR REPLACE` ne remplace PAS la fonction existante, il en crée une **seconde, surchargée, à côté de la première**. Conséquence concrète : un appel avec exactement les 8 paramètres d'origine (tout le code non touché par BOI-010) deviendrait **ambigu** entre les deux signatures possibles (les 2 nouveaux paramètres ayant un `DEFAULT`, la version à 10 paramètres accepte aussi un appel à 8) — PostgreSQL aurait refusé l'appel avec une erreur *« function fn_stock_move(...) is not unique »*, cassant silencieusement tout appelant existant dès l'application de la migration.

**Corrigé** : ajout d'un `DROP FUNCTION IF EXISTS fn_stock_move(UUID, UUID, TEXT, NUMERIC, UUID, NUMERIC, TEXT, TEXT);` explicite, ciblant précisément l'ancienne signature à 8 paramètres, juste avant le `CREATE OR REPLACE FUNCTION`. Un test statique (`lib/architecture/stock-provenance.test.ts`, nouveau) verrouille cette correction pour empêcher sa régression. **C'est exactement le type de défaut que cette mission de validation devait trouver avant toute exécution — trouvé par revue de code, pas par exécution, puisque l'exécution était impossible.**

---

## 4 à 10 — Tests réels contre `fn_stock_move` et le reste de la chaîne

**NOT_TESTABLE cette session, pour chacun des points suivants**, faute de session SQL transactionnelle (§1) :

| Étape mission | Ce qui aurait dû être testé | Statut |
|---|---|---|
| 4. Scénario minimal (+100/+100, −30/−20 → 70/80/150) | Appel réel de `fn_stock_move` avec `p_origine`, vérification directe en base | NOT_TESTABLE — validé uniquement par réimplémentation JS pure (BOI-010, reconfirmée ici, §14) |
| 5. Refus sur provenance insuffisante (−81 sur 80 disponible) | Vraie fonction PL/pgSQL, vérifier l'erreur ET l'absence de diminution partielle | NOT_TESTABLE — la logique de refus est démontrée en JS (§14), mais **pas confirmée contre le vrai moteur PL/pgSQL** (le comportement transactionnel réel de `RAISE EXCEPTION` — annulation complète de l'INSERT en cours — est un comportement PostgreSQL standard et fiable, mais n'a pas pu être observé directement ici) |
| 6. Chemin achat réel (purchase → purchase_item → réception → fn_stock_move) | Vérifier `origine`/`purchase_item_id` réellement enregistrés | NOT_TESTABLE — le code (`app/api/stocks/purchases/route.ts`) est écrit et relu, mais son exécution réelle contre la fonction PL/pgSQL n'a pas pu être déclenchée |
| 7. Chemin production réel | Idem, via `/api/stock/move` | NOT_TESTABLE, même raison |
| 8. Vue par origine réelle (70/80) + `v_products_stock` = 150 | Lecture réelle des deux vues après écriture | NOT_TESTABLE — la vue n'existe pas encore en base (§2) |
| 9. POS réel (choix manuel → sortie, aucune sélection → refus) | Chemin complet interface → RPC | NOT_TESTABLE — nécessiterait à la fois la migration appliquée et une session navigateur/API réelle |
| 10. Isolation tenant réelle (A ne peut pas lire/sortir/choisir le stock de B) | Transaction de test avec deux tenants, `ROLLBACK` complet | NOT_TESTABLE — nécessite la même session transactionnelle absente |

**Aucune improvisation** : aucun de ces points n'a été « simulé » comme s'il s'agissait d'une preuve live. Le §14 distingue explicitement ce qui a été prouvé par le code/la logique de ce qui reste à prouver contre la vraie base.

---

## 11. Comptabilité — vérifiable sans transaction, fait ici

Lecture réelle, en direct, de `accounting_event_rules` (table réelle, pas une supposition) :

```
ACH-001  seq 1  active  601 → 401  montant_ht
ACH-002  seq 1  active  401 → 521  montant_ht
STK-001  seq 1  active  311 → 401  montant_ht
STK-002  seq 1  active  601 → 311  montant_ht
```

**Identique à l'état déjà documenté en BOI-004/010 — aucune ligne modifiée, aucune ligne ajoutée.** La migration 184 ne contient, à la relecture intégrale (§3), aucune instruction touchant `accounting_event_rules`. Aucun nouveau writer comptable introduit — confirmé à la fois par cette lecture réelle et par la revue statique du code (`app/api/stocks/purchases/route.ts` et `app/api/stock/move/route.ts` émettent toujours exactement ACH-001/ACH-002/STK-002, inchangés depuis BOI-004/010).

---

## 12. Historique — confirmé sans ambiguïté

`stock_movements` compte **0 ligne réellement** (§2) — il n'existe donc, dans les faits, aucun mouvement historique à préserver aujourd'hui. La règle de conception (`origine = NULL` pour tout mouvement antérieur, jamais déduite) reste valable pour tout futur mouvement créé avant l'adaptation complète des écrivains, mais n'a actuellement aucun cas réel à couvrir.

---

## 13. Post-état — identique au pré-état, confirmé

Aucune écriture n'a été effectuée à aucun moment de cette mission (uniquement des `GET` en lecture seule). Un second relevé, effectué après la revue et la correction du fichier de migration (qui ne touche que le dépôt de code, jamais la base), confirme :

| Élément | Pré-état | Post-état |
|---|---|---|
| `products` | 10 | 10 |
| `warehouses` | 1 | 1 |
| `stock_movements` | 0 | 0 |
| `purchases` | 0 | 0 |
| `purchase_items` | 0 | 0 |
| `journal_entries` | 21 | 21 (non revérifié séparément — aucune écriture possible sans les colonnes migrées) |
| `accounting_events` | 2 | 2 (idem) |
| `stock_movements.origine` | absente | absente |
| `v_products_stock_par_origine` | absente | absente |

**Rien n'a changé. Aucune donnée de test n'a été créée, donc aucune n'a eu besoin d'être supprimée.**

---

## 14. Récapitulatif — ce qui est prouvé vs ce qui reste à prouver

| | Preuve apportée |
|---|---|
| **Logique de `fn_stock_move` (arithmétique)** | ✅ Réimplémentée en JS, testée contre les 7 scénarios chiffrés exacts de BOI-010, y compris le refus strict — `lib/architecture/stock-provenance.test.ts`, 23 tests passants |
| **Correction structurelle de la migration** | ✅ Défaut réel de remplacement de fonction trouvé et corrigé (§3) — n'aurait été visible qu'à l'exécution sans cette revue |
| **Exécution réelle contre PostgreSQL** | ❌ Non réalisée — MCP indisponible, aucune alternative transactionnelle trouvée (§1) |
| **État de la production** | ✅ Vérifié inchangé avant et après (§2, §13), via lecture réelle de la vraie base |

---

## État final obligatoire

```
REAL_DB_FN_STOCK_MOVE          = NOT_TESTABLE
REAL_DB_STOCK_BY_ORIGIN        = NOT_TESTABLE
REAL_DB_MANUAL_SELECTION       = NOT_TESTABLE
REAL_DB_PURCHASE_TRACEABILITY  = NOT_TESTABLE
REAL_DB_TENANT_ISOLATION       = NOT_TESTABLE
REAL_DB_ROLLBACK               = NOT_TESTABLE (aucune transaction n'a pu être ouverte, donc aucun rollback n'a été nécessaire — mais la méthode elle-même reste non éprouvée cette session)

PRODUCTION_DATA_CHANGED        = MUST_BE_NO — confirmé NO (pré-état = post-état, §13)

MIGRATION_184_READY_FOR_EXECUTION = NO
```

### Pourquoi `NO` malgré la correction apportée

Un défaut réel a été trouvé et corrigé dans cette mission — la preuve que la revue de code seule, sans exécution, peut déjà éviter un incident (rupture de tous les appels `fn_stock_move` existants dès l'application). Mais **aucune preuve d'exécution réelle contre PostgreSQL n'existe encore pour aucun des dix points de test demandés** (§4 à §10) : ni le comportement réel du `CHECK`/`RAISE EXCEPTION`, ni la vue, ni le chemin achat/production, ni le POS, ni l'isolation tenant. Une migration qui modifie une fonction aussi centrale que `fn_stock_move` (appelée par tous les mouvements de stock du système) ne doit pas être exécutée en production sur la seule base d'une relecture, aussi rigoureuse soit-elle — une vraie validation transactionnelle reste requise dès que l'accès MCP (ou toute alternative transactionnelle équivalente) est rétabli.

```
STOCK_PROVENANCE_IMPLEMENTATION = PARTIAL
BOI_IMPLEMENTATION              = BLOCKED
```

---

## Prochaine étape recommandée

Dès que le MCP Supabase (ou un accès Postgres transactionnel équivalent) est disponible : rejouer intégralement les Étapes 4 à 10 de cette mission dans une unique transaction `BEGIN … ROLLBACK`, contre la migration 184 corrigée. Ce n'est qu'à l'issue de cette validation réelle que `MIGRATION_184_READY_FOR_EXECUTION` pourra passer à `YES` et que `STOCK_PROVENANCE_IMPLEMENTATION` pourra être réévalué.

---

Aucune migration exécutée. Aucune donnée production modifiée (confirmé pré/post-état identiques). Aucun commit, aucun push.

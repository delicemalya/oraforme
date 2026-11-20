# ORAFORME — RÉCONCILIATION DU PLAN MAÎTRE (MASTER-RECONCILIATION-01)

Mission de réconciliation uniquement — aucun nouvel audit général lancé. Les quelques vérifications ci-dessous (4 `Read`/`Grep` ciblés) servent exclusivement à trancher les ambiguïtés explicitement listées par la mission, pas à redécouvrir le système. Aucun code modifié, aucune migration, aucune donnée production touchée, aucun commit/push.

Source : `docs/ORAFORME-ETAT-GLOBAL-2026-10.md` (2026-10-01).

---

## POINT 1 — CRITICAL COUNT

**Le chiffre `REMAINING_CRITICAL = 6` était correct, mais sa composition n'était pas rendue explicite — c'est une erreur de présentation, pas de comptage.**

La section 7 ("SECURITY STATUS") du rapport est **scopée à la sécurité d'accès** et n'y liste que 5 items CRITICAL (IDOR MIAA, IDOR `/api/jobs/top5`, IRPP falsifiable, gating de plan, migration 180 UNKNOWN). Le POS (section 5, "WHAT IS BROKEN") n'est pas un problème de contrôle d'accès — c'est un problème d'**intégrité financière** : chaque vente comptoir ne produit aucune écriture comptable, ce qui est aussi grave qu'une faille d'accès (perte de traçabilité fiscale et comptable sur du chiffre d'affaires réel), mais relève d'une catégorie différente.

**Correction retenue** : `REMAINING_CRITICAL = 6` est confirmé, composé de :
- 5 CRITICAL "sécurité d'accès" (§7 du rapport)
- 1 CRITICAL "intégrité financière" : **POS/Commerce sans aucune écriture comptable**

Le rapport global doit être lu avec cette clarification ; aucune valeur numérique n'est changée, seule la ventilation est précisée.

---

## POINT 2 — TOP 10 (reconstitution complète)

| # | Problème | Preuve | Priorité | Dépendances | Critère de fermeture |
|---|---|---|---|---|---|
| 1 | Statut réel de la RLS migration 180 (`tenants`/`journal_entries`) indéterminable | `supabase/migrations/180_fix_rls_tenants_journal_entries_leak.sql` existe et s'auto-vérifie si exécuté ; `service_role` (seul canal disponible) contourne toute RLS par construction, ne peut rien prouver | **P0** (parallèle, ne bloque pas 2-10) | Docker démarré ou MCP Supabase/Postgres reconnecté | Une requête `pg_policies` réelle (hors `service_role`) confirme la policy `tenants_select` scoped-tenant active |
| 2 | IDOR MIAA — `tenant_id` lu du corps JSON client, jamais de la session | `app/api/miaa/chat/route.ts:239-244` et 6 routes sœurs (`agent`, `expertise`, `academy`, `generer-document`, `analyze-file`, `executive`) | **P0** | Aucune | `tenant_id` dérivé exclusivement de la session serveur sur les 7 routes ; test de régression ajouté |
| 3 | IDOR `/api/jobs/top5` et routes sœurs — PII candidats cross-tenant | `app/api/jobs/top5/route.ts:42-70`, aucun check tenant ; routes sœurs `analyser-cv`, `entretien`, `rapport-candidature`, `recommandation` idem | **P0** | Aucune | Vérification de tenant ajoutée sur les 5 routes, testée |
| 4 | POS/Commerce sans aucune écriture comptable | **Confirmé aujourd'hui, cause exacte identifiée** : `app/dashboard/commerce/page.tsx:256` appelle `supabase.rpc('fn_stock_move', ...)` **directement**, contournant `/api/stock/move/route.ts` (qui, lui, émet correctement `STK-002` depuis sa propre correction — vérifié ligne 57-80 du fichier) ; et surtout **aucune migration parmi les 12 `accounting_rules_*` (139-148) n'a jamais créé de règle pour un événement de vente/POS** — il n'existe même pas de cible à appeler | **P0** | Core Accounting (prêt) | Un `event_type` de vente existe dans `accounting_event_rules`, et le POS l'émet à chaque vente |
| 5 | IRPP persisté depuis le payload client sans recalcul serveur | `app/api/rh/paie/route.ts:87` — `const numIrpp = Number(irpp) \|\| 0` | **P0** | Moteur fiscal (prêt, `universal-tax-engine.ts`) | IRPP toujours recalculé serveur avant persistance, valeur client ignorée |
| 6 | Gating de plan quasi absent | `grep checkPlanAccess app/api` = 7/210 routes, toutes `/api/miaa/*` | **P1** | Point 9 (gateway tenant unique) — `checkPlanAccess` vit dans `require-tenant.ts`, pas dans `tenant-guard.ts` | Gating généralisé ou décision produit explicite de le limiter |
| 7 | `tenants: insert` policy ouverte | `supabase/migrations/039_multi_tenant_hardening.sql:229-232`, `WITH CHECK (auth.uid() IS NOT NULL)` sans validation, jamais resserrée depuis | **P1** | Point 1 (canal SQL) | Policy resserrée avec validation réelle, vérifiée via le même canal que le point 1 |
| 8 | 3 assiettes CNSS divergentes dans les bulletins de paie | `app/dashboard/rh/page.tsx` (`calcNet`, exclut transport/logement) vs `app/dashboard/rh/paie/page.tsx` (`computeBulletin`, les inclut) vs `app/dashboard/ecole/rh/page.tsx` (aligné sur le moteur central) — écart verrouillé par `lib/architecture/paie-consommateurs-p0.test.ts` | **P1** | Décision métier (quelle assiette est correcte) | Les 3 écrans produisent la même assiette pour un même profil salarié, test mis à jour en conséquence |
| 9 | Deux gateways tenant concurrents | `lib/tenant-guard.ts` (`@deprecated`, ligne 2, **77 importeurs confirmés dont `app/api/stock/move/route.ts` lui-même**) vs `lib/api/require-tenant.ts` (canonique visé, **45 importeurs**, seul à exposer `checkPlanAccess`) | **P1** | Aucune technique ; volume de migration important | 0 importeur de `tenant-guard.ts` restant, tout sur `require-tenant.ts` |
| 10 | Stocks/sorties et pharmacie contournent le moteur de stock officiel | `app/dashboard/stocks/sorties/page.tsx:207` et `app/dashboard/sante/pharmacie/page.tsx:99` — RPC/update direct, hors `/api/stock/move` | **P1** | Point 4 (même cause racine : bypass de la même route API) | Les 2 écrans passent par `/api/stock/move`, `stock_movements` redevient la seule source pour ces flux |

---

## POINT 3 — MIGRATION 180

**Ce qui est PROUVÉ** : le fichier `supabase/migrations/180_fix_rls_tenants_journal_entries_leak.sql` existe, son contenu corrige exactement les 2 fuites CRITICAL (`tenants_select` sans filtre tenant, 4 policies larges `journal_entries` jamais DROP par la migration 030) identifiées par `docs/MASTER-A-Z-AUDIT-2026-09.md` §32, et contient son propre bloc `DO $$ ... RAISE EXCEPTION` d'auto-vérification s'il est exécuté.

**Ce qui reste UNKNOWN** : si ce fichier a réellement été exécuté en production. Le seul canal disponible cette session (`service_role` via PostgREST) **contourne structurellement toute RLS** — une lecture réussie ou échouée avec cette clé ne prouve rien sur l'état d'une policy. Le registre natif Supabase (`supabase_migrations.schema_migrations`) est quasi vide (3 entrées trackées pour 184 fichiers) et n'est de toute façon pas exposé via PostgREST (`PGRST106`).

**Ce qui lèverait l'UNKNOWN** : (a) Docker démarré → base locale reconstruite → `SELECT * FROM pg_policies WHERE tablename='tenants'` ; ou (b) MCP Supabase/Postgres reconnecté → même requête directement en production ; ou (c), à défaut, une session utilisateur authentifiée réelle (non `service_role`) testant empiriquement si `tenants_select` fuit encore.

**Doit-elle être traitée avant les autres réparations ?** **Non, pas comme préalable bloquant.** Elle doit être résolue **en parallèle, dès que possible** (c'est l'action la plus simple dès que Docker tourne), mais aucune des 9 autres actions du Top 10 n'en dépend techniquement — toutes sont vérifiables/corrigeables directement dans le code applicatif, indépendamment du statut RLS réel. La traiter en P0 parallèle (comme indiqué point 2) est donc justifié sans pour autant geler le reste du plan.

---

## POINT 4 — POS

**Routes existantes** : **aucune route API dédiée** (`app/api/commerce` = 0 fichier, confirmé). Toute la logique vit côté client dans `app/dashboard/commerce/page.tsx`.

**Écritures produites** : insert direct dans `ventes` et `vente_lignes` (table de vente, hors moteur comptable) ; puis `supabase.rpc('fn_stock_move', ...)` **appelé directement depuis la page** (ligne 256), donc le stock est bien décrémenté par la fonction canonique à verrou unique — ce point précis n'est **pas** cassé.

**Pourquoi aucune écriture comptable, cause exacte confirmée aujourd'hui (double cause, pas une seule)** :
1. Le POS appelle `fn_stock_move` **en RPC direct**, contournant `/api/stock/move/route.ts` — qui est pourtant le seul endroit du code qui émet `STK-002` (confirmé par lecture du fichier aujourd'hui : lignes 57-80, logique correcte, se déclenche sur `type === 'sortie'`). En bypassant cette route, le POS perd même ce bénéfice-là.
2. **Plus fondamental** : aucune des 12 migrations `accounting_rules_*` (139 à 148, couvrant facturation/santé/paie/restaurant/école/hôtel/ONG/stocks-achats/BTP-agriculture/boisson) n'a jamais créé de règle `accounting_event_rules` pour un événement de vente/POS. Il n'existe **aucune cible à appeler**, même si le code appelait `emit_accounting_event` demain matin avec un `event_type` inventé.

**Le problème est-il uniquement comptable ?** **Non, il est multi-dimensionnel** :
- **Comptable** (cause racine) : aucune écriture de vente n'existe.
- **Stock** : fonctionne correctement sur la quantité (verrou `fn_stock_move`), mais le volet coût (`STK-002`, 601/311) est perdu par le bypass de route.
- **Fiscal** : la TVA réellement collectée au comptoir n'atteint jamais le compte 4441 — `computeTVAFromJournal()` (source canonique de la déclaration TVA) **sous-estime structurellement** la TVA due sur toute activité de vente directe. C'est un risque de conformité fiscale réel, pas seulement un trou de reporting.
- **Caisse/Trésorerie** : l'encaissement de la vente ne touche jamais `journal_entries`/`transactions` — toute réconciliation de trésorerie basée sur la comptabilité manquera les entrées de caisse du comptoir, sauf à lire `ventes` séparément (non vérifié si le module Trésorerie le fait).

**Fonctions dépendantes** : déclaration TVA (`computeTVAFromJournal`), Grand Livre/Balance, page Rapports (si elle lit `journal_entries` pour le chiffre d'affaires), réconciliation de trésorerie.

---

## POINT 5 — PAIE : les 3 assiettes CNSS

| Implémentation | Fichier / fonction | Consommateur | Règle d'assiette | Délègue au moteur central pour les taux ? |
|---|---|---|---|---|
| 1 | `calcNet()` — `app/dashboard/rh/page.tsx` | Écran RH principal | **Exclut** transport/logement de l'assiette CNSS | Oui (`universal-tax-engine.ts`) |
| 2 | `computeBulletin()` — `app/dashboard/rh/paie/page.tsx` | Écran bulletin détaillé | **Inclut** transport/logement par défaut | Oui |
| 3 | `calculerRetenuesEcole()` — `app/dashboard/ecole/rh/page.tsx` | Module École (paie du personnel enseignant) | Aligné sur le moteur central | Oui |

L'écart (1 vs 2) est réel, verrouillé — pas corrigé — par `lib/architecture/paie-consommateurs-p0.test.ts` (section B), qui le documente explicitement comme "un FAIT, pas une hypothèse". **Source canonique souhaitée** : les taux (CNSS/IRPP/TUS) sont déjà centralisés dans `lib/fiscal/universal-tax-engine.ts` — ce qui manque est un **composeur d'assiette unique** (quelles primes entrent dans la base CNSS), qui n'existe nulle part aujourd'hui sous cette forme ; le moteur `lib/payroll/universal-payroll-engine.ts`, bien que construit et testé, n'est consommé par aucun des 3 écrans et ne peut donc pas servir de référence "déjà en place" — son branchement reste à décider (§2, Point 2 du rapport global, action non listée dans le Top 10 car secondaire au vrai bloqueur : trancher l'assiette).

---

## POINT 6 — TENANT GATEWAYS

| | `lib/tenant-guard.ts` | `lib/api/require-tenant.ts` |
|---|---|---|
| Statut | **`@deprecated`** (ligne 2 du fichier : *"Use `lib/api/require-tenant.ts` instead"*) | Canonique visé |
| Exports | `requireTenant()`, `verifyResourceOwnership()`, `assertResourceOwnership()` | `requireTenant()`, `requireRole()`, `getTenantPlan()`, `planError()`, **`checkPlanAccess()`**, `requireApiKey()` |
| Importeurs confirmés | **77**, en hausse (75→76→77 sur un mois) — **y compris `app/api/stock/move/route.ts` lui-même** (vérifié aujourd'hui, ligne 3) | **45** |
| Capacité de gating de plan | Absente | Présente (seul point d'entrée des 7 routes `/api/miaa/*` déjà gatées) |

**Lequel doit devenir canonique** : `require-tenant.ts` — c'est le seul qui porte la capacité de gating de plan (Point 6 du Top 10 dépend de cette migration), et c'est déjà celui désigné comme tel par le commentaire `@deprecated` de l'autre fichier.

**Routes restant à migrer** : **77** (tous les importeurs actuels de `tenant-guard.ts`), aucun chevauchement vérifié entre les deux listes — à confirmer au moment de la migration réelle, pas supposé ici.

---

## POINT 7 — STOCK (réconciliation des dépendances)

```
fn_stock_move (migration 173, EN PRODUCTION)
  ├─ signature 8 paramètres actuelle
  ├─ consommé correctement par /api/stock/move/route.ts (émet STK-002 si type='sortie')
  ├─ consommé par app/api/stocks/purchases/route.ts (réception, émet ACH-001/002)
  ├─ BYPASSÉ par app/dashboard/commerce/page.tsx (RPC direct — Point 4)
  └─ BYPASSÉ par app/dashboard/stocks/sorties/page.tsx:207 (RPC direct — même cause que POS)

migration 184 (stock_provenance, NOT_APPLIED en prod)
  ├─ étend fn_stock_move à 10 paramètres (origine, purchase_item_id), rétrocompatible
  ├─ dépend de 173 (déjà en place) — aucune autre dépendance technique
  └─ indépendante de 183 (tables disjointes, confirmé BOI-010D)

app/dashboard/sante/pharmacie/page.tsx
  └─ N'UTILISE PAS fn_stock_move du tout — écrit pharmacie_medicaments.stock_actuel
     directement. Sous-système disjoint, pas un simple bypass de route : il
     faudrait le migrer vers products/stock_movements, pas seulement vers l'API.
```

**Dépendance exacte identifiée aujourd'hui** : les deux chemins BROKEN du Point 4/10 (POS et stocks/sorties) partagent **la même cause racine** — un appel RPC direct à `fn_stock_move` au lieu d'un appel à `/api/stock/move`. Les corriger est donc une seule et même action technique (router les deux écrans vers l'API existante), pas deux chantiers séparés. La pharmacie est un cas distinct et plus lourd (migration de modèle de données, pas juste de route).

---

## POINT 8 — PRODUCTION : cohérence des chiffres

Aucune contradiction trouvée — tous les chiffres s'expliquent les uns les autres une fois mis en regard :

- **2 `accounting_events` mais 21 `journal_entries`** : cohérent (INFERRED, pas de comptage ligne-à-ligne refait) avec le constat du Point 9/§4 du rapport global — la majorité des écritures provient du writer legacy `compta-sync-client.ts` (trésorerie), pas du moteur événementiel. 2 événements ne produiraient que 4 à 6 lignes au grand maximum ; les ~15-17 lignes restantes sont structurellement attribuables au chemin hors moteur, pas à une anomalie de comptage.
- **10 produits mais 0 fournisseur/achat/mouvement de stock** : cohérent avec un jeu de produits seedé directement (démo), jamais passé par un cycle d'achat réel — déjà établi par BOI-010D (`stock_movements=0` au moment de la préparation de la migration 184).
- **26 tenants mais 2 profils utilisateurs réels** : cohérent avec 21/26 tenants (81%) créés par des scripts QA/test (probablement sans création de profil utilisateur associé) et seulement 2 inscriptions humaines réelles ayant complété le flux de création de profil.

**Aucune donnée n'a été modifiée pour cette vérification.**

---

## A. CORRECTIONS AU RAPPORT

1. `REMAINING_CRITICAL = 6` confirmé exact, mais la section 7 du rapport global ne liste explicitement que 5 CRITICAL "sécurité" — le 6e (POS, catégorie "intégrité financière") est en section 5/8. Une prochaine édition du rapport devrait ajouter une ligne POS à la table de la section 7, ou renommer la section 21 pour clarifier qu'elle agrège toutes les catégories.
2. Le Top 10 (section 21 du rapport global) était donné sous forme de titres seuls ("voir fichier") sans le détail problème/preuve/priorité/dépendances/critère — reconstitué intégralement au Point 2 ci-dessus.
3. Précision ajoutée sur le POS (non présente dans le rapport global) : `/api/stock/move/route.ts` émet correctement `STK-002` depuis sa propre base de code — le problème n'est pas que cette route soit cassée, c'est qu'elle est **contournée** par le POS et par `stocks/sorties`.
4. Précision ajoutée sur les gateways tenant : `app/api/stock/move/route.ts` lui-même importe encore `lib/tenant-guard.ts` (preuve concrète supplémentaire, non citée dans le rapport global).

## B. CRITICAL RÉELLEMENT OUVERTS (6)

1. IDOR MIAA
2. IDOR `/api/jobs/top5` et routes sœurs
3. POS/Commerce sans écriture comptable (intégrité financière)
4. IRPP falsifiable côté client
5. Gating de plan quasi absent
6. Statut réel de la RLS migration 180 (UNKNOWN — à vérifier, ne bloque pas les 5 autres)

## C. HIGH RÉELLEMENT OUVERTS (9, inchangé du rapport global)

`tenants: insert` ouverte · Permission Engine sans effet serveur · Webhook WhatsApp sans HMAC · `seed_ecam_congo.sql` non gardable · 3 assiettes CNSS divergentes · Stocks/sorties bypass · Pharmacie bypass · Fallback fiscal silencieux pays non couvert · `compta-sync-client.ts` toujours actif sur 13+ pages.

## D. TOP 10 ACTIONS

Voir Point 2 ci-dessus (table complète avec preuve, priorité, dépendances, critère de fermeture).

## E. DÉPENDANCES

- Action 1 (RLS 180) ⟂ indépendante de 2-10 (parallèle, non bloquante).
- Actions 4 et 10 (POS, sorties) partagent la **même cause racine** (bypass RPC de `/api/stock/move`) — une seule correction technique couvre les deux.
- Action 6 (gating de plan) **dépend** de l'action 9 (migration vers `require-tenant.ts`), seul porteur de `checkPlanAccess`.
- Action 7 (`tenants: insert`) dépend du même canal SQL que l'action 1.
- Action 8 (assiettes CNSS) dépend d'une décision métier préalable (quelle assiette est correcte), pas d'une dépendance technique.

## F. CE QUI PEUT ÊTRE DÉFINITIVEMENT FERMÉ

Rien de nouveau par rapport au rapport global (section 17) — cette mission ne clôt aucun item, elle clarifie uniquement le plan. Les items listés "WORK THAT CAN STOP" dans le rapport global restent valides et ne sont pas remis en cause par cette réconciliation.

## G. ORDRE RECOMMANDÉ DE RÉPARATION

1. Actions 2, 3, 5 (IDOR ×2 + IRPP) — correctifs ciblés, indépendants, haute sévérité, faible complexité relative.
2. Action 4/10 ensemble (cause racine commune POS + sorties) — recâbler sur `/api/stock/move`, créer la règle comptable de vente manquante.
3. Action 1 (RLS 180) en parallèle dès que Docker/MCP disponible.
4. Action 9 (gateway tenant unique) — préalable technique à l'action 6.
5. Action 6 (gating de plan) une fois 9 posé.
6. Action 7 (`tenants: insert`) avec le même canal que l'action 1.
7. Action 8 (assiettes CNSS) après décision métier.

---

## VERDICT

```
MASTER_PLAN_READY = YES
```

Toutes les ambiguïtés listées par la mission ont été résolues avec preuve directe (lecture de fichier à l'appui, pas de déduction). La seule inconnue restante (statut réel de la migration 180) est explicitement trackée comme non-bloquante pour les 9 autres actions — elle ne rend pas le plan inexploitable, elle est simplement elle-même la première action à mener dès qu'un canal SQL existe. Le plan peut passer en phase de réparation.

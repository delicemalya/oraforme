# ORAFORME — PLAN D'EXÉCUTION DES 6 CRITICAL (MASTER-EXECUTION-PLAN-01)

Planification uniquement. Aucun code modifié, aucune migration créée, aucune DB touchée, aucun commit/push. Base : `docs/ORAFORME-ETAT-GLOBAL-2026-10.md` + `docs/ORAFORME-MASTER-RECONCILIATION-2026-10.md`, complétées par la lecture directe des fichiers exacts cités ci-dessous (nécessaire pour un plan précis, pas un nouvel audit).

---

## 1. EXECUTIVE SUMMARY

Les 6 CRITICAL se répartissent en deux familles indépendantes :
- **Sécurité d'accès** (#1 MIAA IDOR, #2 jobs/top5 IDOR, #3 IRPP falsifiable, #4 plan gating) — 4 correctifs localisés, chacun dans 1 à 7 fichiers, sans dépendance entre eux.
- **Intégrité système** (#5 RLS 180 — vérification, pas un correctif de code ; #6 POS — le seul chantier véritablement architectural).

Découverte nouvelle cette session (nécessaire au plan, pas dans les rapports précédents) : BOI-001 (migration 146) est **le précédent exact et directement réutilisable** pour la vente POS — mêmes comptes (521 trésorerie / 701 marchandises / 4441 TVA / 447 CA), même `account_resolver='treasury_debit'` pour router dynamiquement vers le bon sous-compte 521 selon `mode_paiement`. Aucun compte ni règle fiscale n'a besoin d'être inventé pour fermer le #6 — seulement reproduit.

Deuxième découverte : la table `ventes` (POS) ne stocke aujourd'hui **aucune ventilation HT/TVA/CA**, seulement `total` (présumé TTC) — un gap de modélisation à combler avant même d'émettre un événement comptable, documenté en Track B.

Troisième découverte : `app/api/rh/paie/route.ts` utilise un **troisième** gateway d'authentification (`hr/_auth.ts::hrAuth()`), distinct de `tenant-guard.ts` et `require-tenant.ts` — à noter pour Track D sans élargir le périmètre de cette mission.

---

## 2. CRITICAL INVENTORY

| ID | Problème | Fichier(s) racine | Complexité |
|---|---|---|---|
| C1 | IDOR MIAA | `app/api/miaa/{chat,agent,expertise,academy,generer-document,analyze-file,executive}/route.ts` | M |
| C2 | IDOR `/api/jobs/top5` + sœurs | `app/api/jobs/{top5,analyser-cv,entretien,rapport-candidature,recommandation}/route.ts` | S |
| C3 | IRPP falsifiable | `app/api/rh/paie/route.ts` | S |
| C4 | Plan gating quasi absent | `lib/api/require-tenant.ts`, `lib/plan-access.ts`, routes métier | L |
| C5 | RLS migration 180 — statut UNKNOWN | `supabase/migrations/180_fix_rls_tenants_journal_entries_leak.sql` | S (une fois le canal dispo) |
| C6 | POS sans comptabilité | `app/dashboard/commerce/page.tsx`, `app/api/stock/move/route.ts`, nouvelle règle `accounting_event_rules`, table `ventes` | XL |

---

## 3. DEPENDENCY GRAPH

```
C5 (RLS 180) ──────────────────────────────────── indépendant, parallèle à tout
C1 (MIAA)    ──────────────────────────────────── indépendant
C2 (jobs)    ──────────────────────────────────── indépendant
C3 (IRPP)    ──────────────────────────────────── indépendant
C4 (plan gating) ── dépend de : aucun gateway unique requis pour commencer
                      (checkPlanAccess vit déjà dans require-tenant.ts,
                       utilisable route par route sans attendre la migration
                       complète de tenant-guard.ts → require-tenant.ts)
C6 (POS) ── dépend de :
              - décision de modélisation sur `ventes` (HT/TVA/CA)
              - précédent BOI-001 (déjà disponible, aucune dépendance bloquante)
              - correction du bypass RPC (POS + stocks/sorties, même cause racine)
```

**Aucune dépendance bloquante entre les 6 CRITICAL.** Les 6 peuvent démarrer en parallèle dès cette mission. La seule séquence interne obligatoire est à l'intérieur de C6 (modéliser `ventes` avant d'émettre l'événement).

---

## 4. TRACK A — SECURITY (C1, C2, C3)

### C1 — MIAA IDOR

- **ROUTE EXACTE** : `app/api/miaa/chat/route.ts`, fonction `POST` (export principal), ligne 244.
- **ORIGINE DU `tenant_id`** : `const tenantId = tenantData?.tenant_id` — lu directement du corps JSON envoyé par le client (`tenantData` fait partie du payload `await req.json()`, ligne 235-242).
- **MANIÈRE ACTUELLE DE DÉTERMINER L'UTILISATEUR** : l'authentification (session valide) est vérifiée en amont par le proxy global (`proxy.ts`), mais celui-ci ne vérifie que "l'utilisateur est connecté", jamais "à quel tenant il appartient". Dans la route elle-même, **aucun appel à `requireTenant()` ou équivalent** n'a été trouvé dans les 280 premières lignes lues.
- **CONTRÔLE ABSENT** : rien ne vérifie que le `tenant_id` fourni correspond au tenant réel de l'utilisateur authentifié.
- **DONNÉES ACCESSIBLES** : toute la mémoire MIAA du tenant ciblé — `chargerMemoireMIAA(supabase, tenantId)` (ligne 278) charge des données financières/RH/stock via un client `service_role` (bypass RLS), donc même si RLS était parfaite, ce chemin la contournerait de toute façon.
- **SOLUTION CANONIQUE** : dériver `tenantId` **exclusivement** de la session serveur via `requireTenant()` (`lib/api/require-tenant.ts`), jamais du corps JSON. Le corps peut continuer à envoyer `tenantData.secteur`/`pays` (données non sensibles, utiles au routage d'agent) mais `tenant_id` doit être ignoré s'il est présent et remplacé par `ctx.tid`.
- **GATEWAY À UTILISER** : `lib/api/require-tenant.ts::requireTenant()` — c'est le gateway canonique visé (voir Track D), et le seul à exposer en même temps `checkPlanAccess` si MIAA doit rester gaté par plan (il l'est déjà partiellement, 7 routes MIAA sur 210).
- **TESTS NÉCESSAIRES** : (1) requête avec `tenantData.tenant_id` = tenant B alors que la session appartient au tenant A → la réponse doit refléter les données du tenant A, jamais B ; (2) requête sans `tenantData` du tout → doit fonctionner normalement (le serveur a toujours le tenant via la session) ; (3) répéter sur les 6 routes sœurs (`agent`, `expertise`, `academy`, `generer-document`, `analyze-file`, `executive`) — même pattern, même fix, un test paramétré par route.

```
BEFORE : tenantId = tenantData?.tenant_id  (client-controlled)
AFTER  : const ctx = await requireTenant(req); if (!ctx.ok) return ctx.error
         const tenantId = ctx.tid  (server-derived, jamais écrasé par le body)
FILES  : app/api/miaa/{chat,agent,expertise,academy,generer-document,analyze-file,executive}/route.ts
TESTS  : lib/architecture/miaa-tenant-isolation.test.ts (nouveau) — 7 routes × 2 scénarios
EXIT CRITERIA : grep 'tenantData?.tenant_id' sur app/api/miaa = 0 résultat utilisé pour une requête DB ;
                requireTenant() appelé avant tout accès mémoire/DB sur chaque route.
```

### C2 — `/api/jobs/top5` IDOR

- **ROUTE** : `app/api/jobs/top5/route.ts`, fonction `GET`, ligne 42.
- **DONNÉES EXPOSÉES** : nom, prénom, email, compétences, diplômes, langues, certifications, années d'expérience, niveau d'études, rapport d'analyse IA complet (`rapport_ia`) de **tous** les candidats d'une offre.
- **VECTEUR D'ÉNUMÉRATION** : `offreId` est un paramètre de requête GET libre (`req.nextUrl.searchParams.get('offreId')`) ; la requête `.from('offres_emploi').select(...).eq('id', offreId)` (ligne 46-50) **ne filtre jamais par tenant**. Un `offreId` valide d'un autre tenant, deviné ou obtenu ailleurs (UUID v4 pas trivialement devinable, mais suffit s'il fuite une seule fois — export, lien partagé, log), retourne les données complètes.
- **TENANT/SESSION ACTUEL** : **aucune vérification d'authentification ni de tenant dans tout le fichier** — ni `requireTenant`, ni `hrAuth`, ni aucun autre gateway. Seule protection : le fichier n'est pas listé dans `PUBLIC_API_PREFIXES` du proxy, donc une session valide est requise en amont — mais n'importe quelle session, de n'importe quel tenant.
- **CONTRÔLE MANQUANT** : filtre tenant sur `offres_emploi`.
- **SOLUTION** : ajouter `requireTenant()` en tête de `GET`, puis `.eq('id', offreId).eq('tenant_id', ctx.tid)` sur la requête `offres_emploi` (ligne 49-50). Si l'offre n'appartient pas au tenant, `maybeSingle()` retournera `null` → 404, comportement déjà géré (ligne 52).
- **MÊME CORRECTIF SUR LES ROUTES SŒURS** : `analyser-cv`, `entretien`, `rapport-candidature`, `recommandation` — à vérifier individuellement (non relues ligne à ligne dans cette mission, le pattern "0 check d'auth" était confirmé par l'agent sécurité pour ces 4 routes).

```
BEFORE : GET sans aucune vérification tenant sur offreId
AFTER  : const ctx = await requireTenant(req); if (!ctx.ok) return ctx.error
         .eq('id', offreId).eq('tenant_id', ctx.tid)
FILES  : app/api/jobs/{top5,analyser-cv,entretien,rapport-candidature,recommandation}/route.ts
TESTS  : requête avec offreId du tenant B, session du tenant A → 404, jamais les données
EXIT CRITERIA (mission) : tenant A ne peut jamais obtenir les données de tenant B — vérifié
                           par un test qui crée une offre tenant B, interroge en tant que A, attend 404.
```

### C3 — IRPP falsifiable

- **ROUTE** : `app/api/rh/paie/route.ts`, fonction `POST`, ligne 41.
- **DONNÉES FISCALES REÇUES DU CLIENT** : `brut, cnss_salarie, cnss_patronal, irpp, net, primes, heures_sup, taux_horaire` — toutes dans le `body` (ligne 46-51).
- **CALCUL ACTUELLEMENT FALSIFIABLE** : ligne 87, `const numIrpp = Number(irpp) || 0` — valeur du client directement persistée (ligne 104 : `irpp: numIrpp`) dans `bulletins_paie`, **aucun recalcul serveur**. Même défaut sur `cnss_salarie`/`cnss_patronal` (lignes 85-86).
- **MOTEUR CANONIQUE** : `lib/fiscal/universal-tax-engine.ts` (`calculerIRPP`, `calculerChargesSociales`) — déjà la source de vérité pour les taux CNSS/IRPP du Congo (et des 6 autres pays, à confiance moindre).
- **MANIÈRE CORRECTE DE RECALCULER CÔTÉ SERVEUR** : avant l'insert (ligne 94), appeler `calculerChargesSociales(numBrut, codePays, ...)` et `calculerIRPP(assietteImposable, codePays, situationFamiliale, ...)` avec les paramètres employé réels (lus depuis `employes`, pas depuis le body) ; utiliser exclusivement le résultat serveur pour `cnss_salarie`, `cnss_patronal`, `irpp`.
- **CHAMPS À IGNORER S'ILS VIENNENT DU CLIENT** : `cnss_salarie`, `cnss_patronal`, `irpp`. `net` doit aussi être recalculé (`numBrut - cnss_salarie_serveur - irpp_serveur + primes`), pas accepté du client (ligne 84 l'accepte actuellement : `Number(net) || numBrut`). `brut` et `primes` peuvent rester des entrées utilisateur légitimes (ce sont des données de saisie, pas des résultats de calcul fiscal).
- **NOTE DE PÉRIMÈTRE** : cette route utilise `hrAuth()` (`app/api/hr/_auth.ts`), pas `require-tenant.ts` ni `tenant-guard.ts` — un **troisième** gateway d'authentification existe dans le code, à prendre en compte dans Track D sans en faire un nouveau chantier séparé ici.

```
BEFORE : numIrpp = Number(irpp) || 0            (valeur client, persistée telle quelle)
AFTER  : const { cnssSalarie, cnssPatronal } = calculerChargesSociales(numBrut, codePays, emp)
         const irppServeur = calculerIRPP(assietteImposable(numBrut, cnssSalarie), codePays, emp)
         // irpp/cnss_salarie/cnss_patronal du body : jamais lus pour la persistance
FILES  : app/api/rh/paie/route.ts
TESTS  : POST avec irpp=0 falsifié dans le body alors que le calcul serveur attend irpp>0
         → le bulletin créé doit contenir l'IRPP recalculé, jamais 0.
EXIT CRITERIA : résultat du bulletin indépendant de toute valeur fiscale envoyée par le client
                (test de falsification : même brut, irpp client différent → même irpp persisté).
```

---

## 5. TRACK B — POS/ACCOUNTING (C6)

**Architecture canonique VENTE → STOCK → TVA → CA → TRÉSORERIE → COMPTABILITÉ**, construite sur le précédent BOI-001 (migration 146), vérifié ligne à ligne aujourd'hui — **aucun compte ni règle inventé** :

| Composant | Précédent réutilisé | Valeur exacte |
|---|---|---|
| Événement comptable | **Nouveau event_type dédié**, modélisé 1:1 sur BOI-001 | voir §A ci-dessous pour la justification |
| Séquence 1 — revenu | BOI-001 séq.1 | débit **521** (résolu dynamiquement), crédit **701** (ventes de marchandises), `montant_field=montant_ht`, `account_resolver=treasury_debit` |
| Séquence 2 — TVA | BOI-001 séq.2 | débit 521, crédit **4441**, `montant_field=montant_tva` |
| Séquence 3 — Centime Additionnel | BOI-001 séq.3 (ajoutée migration 182) | débit 521, crédit **447** |
| Résolution du sous-compte 521 | `account_resolver='treasury_debit'` déjà existant (migration 146/infra 138) | mappe `mode_paiement` → sous-compte trésorerie, mécanisme déjà prouvé en production |
| Créance ou paiement immédiat | BOI-001 est un encaissement **immédiat** (521, jamais 411) | Le POS est structurellement identique : vente comptoir, paiement immédiat — **paiement immédiat confirmé**, pas de créance |
| Stock | `fn_stock_move` (173, en prod) | déjà appelé par le POS — le problème n'est pas la fonction, c'est le **chemin d'appel** (voir §B) |
| Reversement/annulation | `fn_reverse_accounting_event` (infra 138), déjà utilisé par Facturation (139) et Paie (141) — **jamais par un flux de vente comptant** (RES/SAN/HOT/BOI n'ont aucun mécanisme de reversal aujourd'hui) | à répliquer pour le POS en suivant le modèle Facturation, pas un précédent "vente comptant" (il n'en existe aucun) |

### §A — Nouvel événement dédié, pas réutilisation de BOI-001 : pourquoi

BOI-001 est scopé au module boisson (`PATCH /api/boisson/tournees`, encaissement de tournée). Le POS/Commerce (`app/dashboard/commerce/page.tsx`) est un module **transverse**, utilisé par plusieurs secteurs (confirmé : c'est la page "Commerce" générique du dashboard, pas une page du module boisson). Faire émettre `BOI-001` par le POS confondrait deux sources d'activité distinctes dans le reporting sectoriel boisson (le `fn_ae_category`/`fn_ae_is_income` et toute analytique par `event_type` se tromperaient). **Décision retenue : créer un nouvel `event_type` (proposition : `COM-001`), structurellement identique à BOI-001 (même comptes, même resolver, même séquences), mais distinct dans son identifiant** — exactement le principe déjà appliqué pour RES-001/SAN-001/HOT-001/BOI-001 qui sont 4 événements distincts bien qu'architecturalement jumeaux.

### §B — Pourquoi aucune écriture n'est produite aujourd'hui (cause racine, confirmée par lecture directe aujourd'hui)

1. `app/dashboard/commerce/page.tsx` ligne 256 appelle `supabase.rpc('fn_stock_move', ...)` **directement**, contournant `app/api/stock/move/route.ts` — qui, lui, émet correctement `STK-002` (vérifié lignes 54-81 du fichier : le vieux bug "la contrainte n'autorise plus le type 'OUT'" est **déjà corrigé**, la route teste `type === 'sortie'`, qui est bien dans la contrainte actuelle). Le bypass fait perdre ce bénéfice.
2. **Même en corrigeant le bypass**, `STK-002` ne couvre que le **coût** de la marchandise vendue (601/311) — pas le **revenu** de la vente. Il n'existe **aucune** règle `accounting_event_rules` pour un événement de vente POS parmi les 12 migrations `accounting_rules_*` (139-148) — confirmé par recherche ciblée aujourd'hui. Il faut donc une règle **en plus** de corriger le bypass STK-002, pas à sa place.
3. **Gap de modélisation découvert aujourd'hui** : la table `ventes` ne stocke que `total` (confirmé par lecture de `commerce/page.tsx` ligne 49/240-241 : colonnes réelles = `id, created_at, total, mode_paiement, caissier_nom, nb_articles, statut`) — **aucune colonne `montant_ht`/`montant_tva`/`montant_ca`**. Avant même d'émettre l'événement, il faut décider : (a) calculer la ventilation HT/TVA/CA au moment de la vente à partir du prix de chaque article (plus précis, respecte la TVA par produit) et la stocker sur `vente_lignes`, ou (b) décomposer `total` globalement (18.9% TTC, comme SAN/HOT/BOI) au moment de l'émission. **(a) est recommandé** — plus exact si des produits exonérés coexistent avec des produits taxés dans le même panier (cf. SAN-001, exonérations déjà gérées ailleurs dans le système).

### Architecture cible complète

```
VENTE (commerce/page.tsx)
  → INSERT ventes + vente_lignes (ajouter montant_ht/montant_tva/montant_ca par ligne — décision (a) ci-dessus)
  → POST /api/stock/move (PAS de RPC direct) pour chaque ligne, type='sortie'
      → fn_stock_move (173, inchangé) décrémente stock_movements
      → émission STK-002 automatique (déjà fonctionnelle dans la route, actuellement inatteignable par bypass)
  → nouvelle route ou extension de la même action : emit_accounting_event('COM-001', ...)
      → séquence 1 : 521(resolved)/701, montant_ht agrégé du panier
      → séquence 2 : 521/4441, montant_tva agrégé
      → séquence 3 : 521/447, montant_ca agrégé
  → en cas d'annulation de vente : fn_reverse_accounting_event(event_id) sur COM-001,
    + mouvement de stock inverse via fn_stock_move (type='entree', origine=null — retour)
```

### stocks/sorties — même correction, même cause

`app/dashboard/stocks/sorties/page.tsx:207` appelle aussi `fn_stock_move` en RPC direct. **Correction identique** (router vers `/api/stock/move`) — pas un second chantier, la même modification de pattern appliquée à un second écran.

```
ID       : C6
PROBLÈME : POS/Commerce ne produit aucune écriture comptable ; stocks/sorties partage la même cause
ROOT CAUSE : (1) bypass RPC direct de fn_stock_move au lieu de /api/stock/move ;
             (2) aucune règle accounting_event_rules pour une vente POS ;
             (3) ventes/vente_lignes ne stockent pas la ventilation HT/TVA/CA nécessaire
FILES    : app/dashboard/commerce/page.tsx, app/dashboard/stocks/sorties/page.tsx,
           app/api/stock/move/route.ts (inchangé, juste atteint enfin),
           nouvelle migration accounting_rules_commerce.sql (modélisée sur 146),
           migration additive ventes/vente_lignes (colonnes HT/TVA/CA)
FUNCTIONS: fn_stock_move (inchangée), emit_accounting_event (nouvel event_type COM-001),
           fn_reverse_accounting_event (à brancher pour l'annulation)
TABLES   : ventes, vente_lignes (migration additive), stock_movements, accounting_events,
           accounting_event_rules (nouvelle règle), journal_entries
DEPENDENCIES : aucune dépendance externe bloquante ; dépendance interne : modéliser
           ventes/vente_lignes avant d'émettre l'événement (sinon montant_ht/tva inconnus)
FIX STRATEGY : router POS et sorties vers /api/stock/move ; ajouter colonnes HT/TVA/CA sur
           vente_lignes ; créer la règle COM-001 (3 séquences, copie exacte de BOI-001) ;
           appeler emit_accounting_event au moment de la validation de vente ; brancher
           fn_reverse_accounting_event sur l'annulation
TEST STRATEGY : test transactionnel (BEGIN/ROLLBACK) reproduisant une vente multi-produits
           (mix exonéré/taxé), vérifiant 3 lignes journal_entries exactes (701/4441/447),
           0 ligne orpheline, stock décrémenté une seule fois, annulation = reversal propre
PRODUCTION VALIDATION : aucune exécution en production dans cette mission — validation
           locale (Docker) requise avant tout déploiement, comme pour 183/184
EXIT CRITERIA : une vente réelle produit stock + fiscalité + comptabilité + trésorerie en une
           seule opération, sans double écriture, annulable proprement
COMPLEXITY : XL
```

---

## 6. TRACK C — PAYROLL (hors des 6 CRITICAL stricto sensu, mais C3 en dépend partiellement)

C3 (IRPP falsifiable) est corrigé indépendamment de l'unification des 3 assiettes CNSS (HIGH, pas CRITICAL — voir réconciliation). Ne pas bloquer C3 sur cette unification : **recalculer serveur avec l'assiette actuellement utilisée par `app/api/rh/paie` suffit pour fermer le CRITICAL** ; l'unification des 3 écrans (`rh/page.tsx`, `rh/paie/page.tsx`, `ecole/rh/page.tsx`) reste une action HIGH séparée, déjà tracée au Top 10 (action #8), à traiter après décision métier sur l'assiette correcte.

---

## 7. TRACK D — TENANT/PERMISSION (C4, support pour C1/C2)

- **Routes actuellement protégées par plan** : 7/210, toutes `/api/miaa/*`, via `checkPlanAccess()` (`lib/api/require-tenant.ts:116-127`).
- **Mécanisme exact** : `checkPlanAccess(tenantId, moduleId)` → `getTenantPlan(tenantId)` lit **`tenants.taille_entreprise`** (pas `tenant_modules`) → `canAccessByPlan(plan, moduleId)` (`lib/plan-access.ts`) → `planError('pme'|'grande')` si refusé.
- **Source de vérité du plan** : confirmée = colonne `tenants.taille_entreprise`, nomenclature `tpe/pme/grande`. Rappel (déjà documenté dans le rapport global §4/Point 1) : **deux autres nomenclatures incompatibles coexistent** côté onboarding/admin (`starter/pro/enterprise`, `starter/business/premium`) sans effet sur ce champ réel — à ne **pas** confondre avec `tenant_modules` (qui gère quels modules métier sont activés, un concept différent du plan tarifaire).
- **Gateway canonique** : `require-tenant.ts` (porte déjà `checkPlanAccess`) ; `tenant-guard.ts` (`@deprecated`, 77 importeurs dont `app/api/stock/move/route.ts`) n'a pas cette capacité.
- **Troisième gateway découvert** : `app/api/hr/_auth.ts::hrAuth()`, utilisé par `app/api/rh/paie/route.ts` (et probablement d'autres routes RH) — à cartographier précisément dans une future mission dédiée, pas dans ce plan.

**Stratégie de migration progressive (PAS de réécriture massive, comme demandé)** :

```
ÉTAPE 1 — Gateway canonique (déjà fait, require-tenant.ts existe et fonctionne)
ÉTAPE 2 — Router les routes critiques en premier :
            C1 (7 routes MIAA) et C2 (5 routes jobs) migrent vers require-tenant.ts
            DANS LE CADRE MÊME de leur correctif de sécurité (pas une étape séparée) —
            C1/C2 ferment donc aussi une partie de la dette gateway en passant.
ÉTAPE 3 — Routes métier à fort enjeu (achats, factures, paie, stock) : migrer
            progressivement de tenant-guard.ts vers require-tenant.ts, une route à la fois,
            chacune testée individuellement (pas un seul gros commit).
ÉTAPE 4 — Généraliser checkPlanAccess aux routes métier premium une fois Étape 3 avancée
            (dépend de savoir quelles routes sont réellement "premium" — décision produit,
            pas uniquement technique).
ÉTAPE 5 — Suppression de tenant-guard.ts seulement quand son compteur d'importeurs atteint 0.
```

```
EXIT CRITERIA (cette mission) : C1 et C2 fermés avec require-tenant.ts (pas tenant-guard.ts) —
   aucune route métier critique ne peut contourner le plan serveur, au sens où les routes
   qui DOIVENT être gatées (MIAA, jobs) le sont désormais réellement via le gateway qui
   porte cette capacité.
```

---

## 8. TRACK E — RLS/DB/BOI (C5)

**Statut** : UNKNOWN, confirmé, non deviné.

**Comment lever l'UNKNOWN** :
1. Démarrer Docker Desktop (aucun processus actif actuellement, confirmé par vérification directe lors d'une mission précédente — à revérifier au moment de l'exécution, pas supposé toujours vrai).
2. `npx supabase start` (ou reconnexion MCP Supabase/Postgres — les deux canaux ont échoué en `CONNECT_TIMEOUT` à plusieurs reprises cette session, sans garantie qu'ils restent indisponibles indéfiniment).
3. Une fois un canal SQL direct (non `service_role` PostgREST) disponible, exécuter en lecture seule :
   ```sql
   SELECT policyname, qual, with_check
   FROM pg_policies
   WHERE tablename = 'tenants' AND policyname = 'tenants_select';
   -- attendu si 180 appliquée : qual contient un filtre tenant (id = get_my_tenant_id() ou équivalent)
   -- attendu si NON appliquée : qual = 'auth.uid() IS NOT NULL' (la fuite d'origine)

   SELECT policyname FROM pg_policies WHERE tablename = 'journal_entries';
   -- attendu si 180 appliquée : les 4 anciennes policies larges (migration 026) absentes
   ```
4. Si 180 n'est pas appliquée : l'appliquer (hors périmètre de cette mission de planification — nécessite une mission d'exécution dédiée, avec les mêmes garde-fous que toute migration production).
5. Si elle est déjà appliquée : clore C5 avec preuve, aucune action supplémentaire.

**État attendu après validation** : soit confirmation `APPLIED` (clôture immédiate), soit confirmation `NOT_APPLIED` (nécessite l'exécution de la migration existante — **aucune nouvelle migration n'est nécessaire**, le fichier 180 existe déjà et est prêt).

**Une migration supplémentaire serait-elle nécessaire ?** Non — uniquement si la requête révèle un état de production différent de celui diagnostiqué en septembre (peu probable mais pas exclu), auquel cas une mission de diagnostic complémentaire serait nécessaire avant toute ré-application.

---

## 9. TRACK F — PHARMACY (hors CRITICAL, mentionné pour cohérence avec le rapport global)

La pharmacie (`app/dashboard/sante/pharmacie/page.tsx`) n'est pas un CRITICAL de cette mission (c'est un HIGH du rapport global). Elle n'est **pas** un simple bypass de route comme POS/sorties : elle écrit `pharmacie_medicaments.stock_actuel` directement, sans jamais passer par `fn_stock_move`/`stock_movements`. Sa correction nécessiterait une migration de modèle de données (faire pointer `pharmacie_medicaments` sur `products`/`stock_movements`), pas juste un changement d'appel API — **hors périmètre de cette mission**, à traiter après les 6 CRITICAL, dans l'ordre du Top 10 (action #10, groupée avec stocks/sorties pour la partie bypass, mais avec un chantier de migration de données séparé pour la partie modèle).

---

## 10. EXACT EXECUTION ORDER

**Tout démarre en parallèle — aucune dépendance bloquante entre tracks.**

| Track | Contenu | Peut démarrer | Bloque |
|---|---|---|---|
| A | C1, C2, C3 | Immédiatement | Rien |
| B | C6 (POS) | Immédiatement (décision de modélisation `ventes` à trancher en premier à l'intérieur du track) | Rien hors de lui-même |
| D | C4 (dans le cadre de A, pas séparément) | Immédiatement, porté par A | Rien |
| E | C5 | Dès que Docker/MCP disponible — indépendant du reste | Rien (si Docker reste indisponible, les 5 autres avancent sans attendre) |

À l'intérieur de Track B uniquement, un ordre interne existe : modéliser `ventes`/`vente_lignes` (HT/TVA/CA) **avant** de créer la règle `COM-001` **avant** de router POS/sorties vers `/api/stock/move` **avant** de brancher le reversal.

---

## 11. TEST STRATEGY

- C1/C2 : tests paramétrés cross-tenant (tenant A ne voit jamais les données de tenant B), un test par route, exécutés réellement (pas de grep statique).
- C3 : test de falsification explicite (valeur fiscale client ≠ valeur serveur attendue → le serveur gagne toujours).
- C4 : test que `checkPlanAccess` est bien invoqué sur les routes migrées (test d'exécution, pas de présence de texte).
- C5 : pas un test de code — une requête SQL réelle contre `pg_policies`.
- C6 : test transactionnel (`BEGIN`/`ROLLBACK`) simulant une vente complète multi-produits, vérifiant les 3 lignes `journal_entries`, le mouvement de stock unique, et l'annulation propre.

**Principe transversal (hérité de la réconciliation)** : aucun item ne doit être déclaré fermé sur la seule lecture d'un fichier — chaque fermeture doit citer une exécution réelle (test qui tourne, requête SQL exécutée).

## 12. PRODUCTION VALIDATION

Aucune validation en production dans cette mission (planification uniquement). Pour l'exécution future : C1/C2/C3/C4 sont des correctifs de code applicatif, validables en local puis déployés normalement (pas de migration DB requise pour eux). C6 nécessite une migration additive (`ventes`/`vente_lignes`) et une nouvelle règle `accounting_event_rules` — à valider en local (Docker) avant tout déploiement, suivant exactement le protocole déjà établi pour les migrations 183/184 (BOI-010D).

## 13. EXIT CRITERIA (global, cette mission de planification)

Ce document est considéré comme un plan d'exécution exploitable si, pour chacun des 6 CRITICAL, un futur exécutant peut commencer à corriger sans avoir à redécouvrir quoi que ce soit — c'est le cas ici : fichier, ligne, fonction, cause racine et stratégie de fix sont donnés pour les 6.

## 14. WHAT MUST NOT BE TOUCHED

- `fn_stock_move` (173) — ne pas la modifier, elle fonctionne ; le problème est le chemin d'appel, pas la fonction.
- `app/api/stock/move/route.ts` — son émission `STK-002` est déjà correcte, ne pas y toucher, juste s'assurer qu'elle est atteinte.
- Les règles `accounting_event_rules` existantes (139-148, 181, 182) — ne jamais les modifier pour faire de la place à `COM-001` ; `COM-001` est additif, une nouvelle règle, pas une modification d'une règle sectorielle existante.
- Le moteur `universal-tax-engine.ts` — source déjà canonique pour C3, ne pas en créer une copie.
- La migration 180 — ne pas la ré-exécuter "pour être sûr" tant que son statut réel n'est pas confirmé UNKNOWN→connu ; une double application accidentelle sur un état déjà corrigé n'est pas garantie sans risque si son idempotence n'a pas été revérifiée pour ce cas précis.

---

## VERDICT

```
EXECUTION_PLAN_READY = YES
```

**Première mission de réparation à exécuter** : **C2 (`/api/jobs/top5` et routes sœurs)**. Raison du choix : c'est le CRITICAL le plus simple (complexité S), le plus isolé (0 dépendance, 5 fichiers, un seul pattern de correctif identique sur chacun), le plus rapide à tester (un seul test cross-tenant par route), et il ferme une fuite de PII réelle dès aujourd'hui sans toucher à aucune autre partie du système. C1 (MIAA, complexité M, même famille de correctif) peut suivre immédiatement après avec le même gateway et le même type de test. C3 et C6 peuvent démarrer en parallèle dès que la mission d'exécution est ouverte — rien n'oblige à les séquencer derrière C2/C1.

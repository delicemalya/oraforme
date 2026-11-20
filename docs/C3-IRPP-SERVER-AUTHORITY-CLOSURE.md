# C3 — IRPP SERVER AUTHORITY

Mission C3. Code modifié uniquement pour ce Critical — POS, BOI, routes MIAA de plan-gating et migration globale de `tenant-guard.ts` non touchés. Aucun commit, aucun push.

## 1. CURRENT FLOW

Deux flux réels de persistance de bulletin trouvés (pas un seul) :

```
FLUX A — app/dashboard/rh/page.tsx (calcNet, assiette sans transport/logement)
  CLIENT → calcul local (universal-tax-engine.ts, côté navigateur)
         → POST /api/rh/paie { employe_id, brut, primes, heures_sup, taux_horaire,
                                cnss_salarie, cnss_patronal, irpp, net }
         → AVANT CE CORRECTIF : irpp/cnss_salarie/cnss_patronal/net du body
           persistés tels quels dans bulletins_paie, aucun recalcul serveur.

FLUX B — app/dashboard/rh/paie/page.tsx::computeBulletin() (assiette avec transport/logement)
  CLIENT → calcul local (même moteur universal-tax-engine.ts)
         → POST /api/paie/bulletins { bulletins: [{ ...gains, brut, cnss_salarie,
                                        cnss_patronal, irpp, net, ... }] }
         → AVANT CE CORRECTIF : upsert brut, exactement ce que le client envoie,
           aucune colonne fiscale recalculée.
```

`POST /api/paie/bulletins` est — selon le commentaire du fichier lui-même, confirmé par grep des appelants — **la route que l'interface appelle réellement** depuis `app/dashboard/rh/paie/page.tsx` (le flux B ci-dessus, plus volumineux que le flux A). Corriger uniquement `/api/rh/paie` aurait laissé la route réellement utilisée par l'écran principal de paie totalement ouverte — c'est exactement l'erreur que l'étape 9 de la mission demandait d'éviter.

Déclaration IRPP (`GET /api/fiscalite/irpp`) : lecture seule, agrège des `bulletins_paie` déjà persistés — devient correcte comme effet de bord de ce correctif, sans modification propre.

## 2. ROOT CAUSE

```
AVANT (les deux routes) :
  client calcule CNSS/IRPP/net avec le bon moteur (universal-tax-engine.ts)
  → résultat envoyé en JSON
  → serveur fait confiance au JSON et le persiste tel quel
```

Le calcul client était **correct**, pas le problème — le problème est qu'un client modifié (devtools, proxy, requête rejouée) peut soumettre n'importe quelle valeur finale sans jamais exécuter le moteur. Déplacer le même calcul côté serveur en continuant à lire `cnss_salarie`/`irpp`/`net` du body n'aurait rien résolu — c'est explicitement ce que la mission interdisait (section 3), et ce n'est pas ce qui a été fait.

## 3. CLIENT-CONTROLLED DATA

| Champ | Source actuelle (avant correctif) | Trust level (avant) | Trust level (après) |
|---|---|---|---|
| `brut` / gains bruts (`salaire_base`, primes, `heures_sup`, `taux_horaire`) | CLIENT | UNTRUSTED mais légitime (saisie RH du mois, pas reconstructible serveur) | **TRUSTED comme donnée métier brute** — `brut` est recalculé server-side à partir de ces gains sur le flux B (ignorant un `brut` directement falsifié) ; sur le flux A, `brut` est accepté tel quel (pas de gains décomposés transmis à cette route) |
| `cnss_salarie`, `cnss_patronal` | CLIENT | UNTRUSTED | **RECALCULÉ serveur, valeur client jamais lue** |
| `irpp` | CLIENT | UNTRUSTED | **RECALCULÉ serveur, valeur client jamais lue** |
| `net`, `total_retenues`, `tus_patronal`, `medecine_travail`, `cout_total_employeur` | CLIENT | UNTRUSTED | **RECALCULÉS serveur** (dérivés des champs ci-dessus + mutuelle/acompte/opposition/autres_retenues, légitimement client) |
| `situation` (matrimoniale), `nb_enfants` — s'ils étaient présents dans le body | CLIENT (jamais lus par la route, mais présents dans l'objet envoyé par `computeBulletin()`) | N/A (non lus avant non plus) | **Explicitement jamais lus depuis le body** — toujours DB |
| `nombreParts` | Absent du body sur les deux routes | N/A | N/A — `calculerIRPP()` accepte un `nombreParts` explicite en override (voir §4), mais aucune des deux routes ne le transmet, donc le moteur le calcule toujours lui-même depuis `situation`/`nombreEnfants` |

## 4. SERVER-AUTHORITATIVE DATA

| Champ | Source serveur |
|---|---|
| `situation_matrimoniale` | `employes.situation_matrimoniale` (colonne réelle, migration 038) — fallback `'celibataire'` si NULL, même défaut déjà utilisé partout ailleurs dans le code (pas une règle inventée) |
| `nb_enfants` | `employes.nb_enfants` (colonne réelle, `NOT NULL DEFAULT 0`, migration 038) |
| `nombreParts` | **Jamais lu, toujours calculé** par `calcNombreParts()` à l'intérieur de `calculerIRPP()` à partir des deux champs ci-dessus — aucune route ne transmet de `nombreParts` explicite, donc le chemin d'override documenté à l'intérieur du moteur (`input.nombreParts ?? calcNombreParts(...)`) n'est jamais activé par un client |
| Taux IRPP, tranches, abattement | Entièrement internes à `lib/countries/CG.ts` via `universal-tax-engine.ts` — **aucun paramètre d'entrée ne permet de les influencer**, falsification #4/#5 structurellement impossible, pas seulement filtrée |
| `brut` (flux B uniquement) | Recalculé à partir de `salaire_base + heures_sup×taux_horaire + primes...` (les gains bruts transmis par le client, légitimes) |

**Documentation du cas "non stocké"** (étape 5 de la mission) : les deux champs nécessaires au quotient familial (`situation_matrimoniale`, `nb_enfants`) **sont bien stockés** sur `employes` — aucune invention nécessaire, aucun remplacement silencieux par 1 part. Le seul endroit où un défaut à 1 part existe réellement est `lib/miaa/tools.ts::calculerSalaireNet()` (simulateur générique sans employé réel associé) — **confirmé non branché à ce jour** (0 appelant dans tout le dépôt, documenté explicitement dans son propre en-tête) ; non corrigé car non actif, mais signalé en risque résiduel (section 10).

## 5. CANONICAL ENGINE

`lib/fiscal/universal-tax-engine.ts` (`calculerChargesSociales`, `calculerIRPP`) reste l'unique moteur de taux. **Aucun nouveau moteur créé.** `universal-payroll-engine.ts`, `lib/fiscalite/engine.ts` et `lib/miaa/tools.ts` n'ont pas été touchés ni réintroduits.

Un seul point de consolidation a été fait, à l'intérieur du module déjà canonique pour l'assemblage de bulletin : `lib/paie/calcul-paie.ts` (qui délègue déjà intégralement à `universal-tax-engine.ts`, voir son propre en-tête). Une fonction `calculerChampsFiscauxDerives(brutImposable, situation, nombreEnfants)` y a été extraite — c'est exactement la portion CNSS+IRPP que `calculerPaie()` faisait déjà en interne (lignes 110-124 avant ce correctif), rendue réutilisable. `calculerPaie()` elle-même l'appelle désormais au lieu de dupliquer cette logique en ligne — **extraction de méthode, comportement strictement identique** (confirmé section 8). Les deux routes corrigées appellent cette même fonction, pour qu'elles ne puissent pas diverger entre elles.

## 6. CODE_CHANGES

| Fichier | Changement |
|---|---|
| `lib/paie/calcul-paie.ts` | Export de `TAUX_MEDECINE_NON_MIGRE` (déjà existant, local) ; nouvelle fonction exportée `calculerChampsFiscauxDerives()` ; `calculerPaie()` refactorée pour l'appeler (comportement inchangé, voir §8) |
| `app/api/rh/paie/route.ts` (POST) | `cnss_salarie`/`cnss_patronal`/`irpp`/`net` retirés de la destructuration du body ; `emp` fetch étendu à `situation_matrimoniale, nb_enfants` ; appel à `calculerChampsFiscauxDerives()` ; notification WhatsApp corrigée pour utiliser le net recalculé (`netCalcule`) au lieu du net client (`numNet`, bug trouvé en cours de correctif) |
| `app/api/paie/bulletins/route.ts` (POST) | Nouvelle fonction `recalculerBulletin()` (exportée pour test) : reconstruit `brut` depuis les gains, puis `cnss_salarie/cnss_patronal/tus_patronal/irpp/net/total_retenues/medecine_travail/cout_total_employeur` via `calculerChampsFiscauxDerives()` ; fetch batch de `employes.situation_matrimoniale/nb_enfants` pour tous les `employe_id` du tableau reçu, avec 404 explicite si un employé n'appartient pas au tenant ; chaque bulletin du tableau est recalculé avant l'upsert |

## 7. ATTACK_TESTS

`lib/architecture/irpp-server-authority.test.ts` — **8 tests, exécutés réellement** (pas de grep statique) contre `calculerChampsFiscauxDerives()` et `recalculerBulletin()` — la fonction réellement appelée par la route, pas une réimplémentation :

| Cas | Résultat |
|---|---|
| NORMAL | Déterministe, cnss > 0, irpp ≥ 0 |
| FALSIFICATION #1 (CNSS) | `recalculerBulletin({..., cnss_salarie: 1}, ...)` → cnss recalculé, jamais 1 |
| FALSIFICATION #2 (nombreParts/situation/enfants) | Bulletin avec `situation:'marie', nb_enfants:4, nombreParts:99` falsifiés, appelé avec l'autorité serveur réelle (`'celibataire', 0`) → résultat identique à célibataire/0, jamais à marié/4 enfants |
| FALSIFICATION #3 (brut/base imposable) | `brut:1` falsifié avec de vrais gains → brut reconstruit (580 000), jamais 1 ; `base_irpp`/`base_imposable`/`brut_imposable` injectés → sans effet (champs jamais lus) |
| FALSIFICATION #4 (taux IRPP) | `taux`/`tauxIRPP`/`taux_irpp` injectés → sans effet (aucun paramètre de taux dans la signature) |
| FALSIFICATION #5 (abattement) | `abattement` injecté → sans effet (aucun paramètre d'abattement dans la signature) |
| Cohérence net | `net` falsifié à 999999999 → recalculé = brut réel − cnss réel − irpp réel − mutuelle, jamais la valeur client |

**Portée du test, honnêtement déclarée** : fonctions pures (`@/lib/supabase-server` et `@/lib/api/require-tenant` mockés pour permettre l'import du fichier de route). Prouve que **le code serveur** ignore toute donnée fiscale du client — ne prouve pas le comportement de la route HTTP complète (auth réelle, fetch Supabase réel, upsert réel) en production. Voir section 9.

## 8. NON-REGRESSION

`calculerPaie()` a été refactorée (extraction de `calculerChampsFiscauxDerives()`) sans changer une seule formule — vérifié par l'exécution complète des suites qui verrouillent ses résultats numériques AVANT/APRÈS :

```
npx vitest run lib/fiscal lib/paie lib/scenarios lib/architecture/paie-consommateurs-p0.test.ts
→ 7 fichiers, 309 tests passés (cg-paie-2026.test.ts, universal-tax-engine.test.ts,
  universal-payroll-engine.test.ts, business-scenarios.test.ts inclus — tous
  verrouillent des montants exacts vérifiés sur cas réels, aucun n'a bougé)
```

Aucun résultat fiscal n'a changé pour un cas légitime. Le seul changement de comportement observable est que **les routes refusent désormais de persister une valeur fiscale falsifiée** — ce n'est pas une régression, c'est la fermeture du Critical.

## 9. PRODUCTION_VALIDATION

Aucun canal HTTP de production disponible pour un test non destructif cette session (même limitation que C1/C2 : MCP Supabase/Postgres en échec de connexion, Docker arrêté). Créer un vrai bulletin de test nécessiterait un employé et un tenant réels — hors périmètre d'une validation "non destructive" sans environnement dédié.

```
REAL_IRPP_ATTACK_TEST = NOT_TESTABLE
```

## 10. REMAINING_RISKS

| Risque | Catégorie | Statut |
|---|---|---|
| `lib/miaa/tools.ts::calculerSalaireNet()` — toujours 1 part par construction (pas de paramètre situation/enfants) | Latent, pas actif | Confirmé 0 appelant dans tout le dépôt (son propre en-tête le documente) ; non corrigé car non branché — à corriger avant tout câblage futur, pas avant |
| Les 3 assiettes divergentes (transport/logement inclus ou non selon l'écran) | HIGH déjà documenté (Top 10 action #8 du plan d'exécution), hors périmètre C3 | Ce correctif ne les unifie pas — il garantit seulement que, quelle que soit l'assiette que chaque écran assemble, le CNSS/IRPP qui en dérive n'est plus falsifiable à l'arrivée |
| `indemnites_non_imposables` jamais câblée à une saisie réelle sur `rh/paie/page.tsx` | Fonctionnel, pas sécurité | Traitée comme 0 (comportement actuel identique) — documentée explicitement dans le code et ce rapport, pas silencieusement ignorée |
| Aucun test d'exécution HTTP réelle (auth + DB + upsert) | Méthodologique | Même blocage d'infrastructure que tout le reste de cette série de missions (Docker/MCP indisponibles) |
| `app/api/hr/employees/route.ts::soumis_irpp` | Hors périmètre | Classification HR légitime (employé exonéré ou non), pas un résultat de calcul — à ne pas confondre avec les champs fermés ici |

---

## VERDICT

```
C3_CODE_FIX         = PASS
C3_STATIC_TEST       = PASS
C3_REAL_ATTACK_TEST  = NOT_TESTABLE
C3_FINAL_CLOSURE     = PENDING
```

`C3_CODE_FIX = PASS` : les deux routes qui persistent réellement un bulletin de paie (confirmées par recherche exhaustive — pas seulement la route nommée dans le rapport global) recalculent désormais `cnss_salarie`, `cnss_patronal`, `irpp`, `net` et les champs dérivés exclusivement côté serveur, à partir de `employes.situation_matrimoniale`/`nb_enfants` et des gains bruts transmis — jamais des valeurs fiscales finales du client. Le moteur canonique (`universal-tax-engine.ts`) n'a pas été dupliqué ; `calcul-paie.ts` a été consolidé, pas remplacé.

`C3_STATIC_TEST = PASS` — plus précisément un **test d'exécution réelle de fonctions pures** (8/8), exerçant le code effectivement appelé par les routes, pas une vérification d'absence de champ TypeScript. Suite complète : 50 fichiers, 1045 tests, 0 régression.

`C3_REAL_ATTACK_TEST = NOT_TESTABLE` : aucun canal HTTP/DB de production disponible cette session.

`C3_FINAL_CLOSURE = PENDING` — pas `PASS`, conformément à la règle explicite de la mission : la fermeture définitive exige une preuve d'exécution HTTP réelle contre une base de test, qui reste à produire dès qu'un environnement de validation (Docker ou accès direct) sera disponible.

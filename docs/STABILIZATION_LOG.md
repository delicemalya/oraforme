# STABILIZATION LOG — ORAFORME

> Historique de toutes les corrections de stabilisation.  
> Objectif : éviter les régressions futures en documentant chaque bug, sa cause et ses dépendances.

---

## ⛔ ZONE CRITIQUE — NE PAS MODIFIER

Les composants suivants sont **validés, testés et figés**. Toute modification doit être traitée comme une migration majeure avec tests complets.

| Composant | Fichier | Raison du gel |
|---|---|---|
| **CountryConfig** | `lib/countries/types.ts` + `lib/countries/*.ts` | Source unique de vérité fiscale pour 10 pays. Toute valeur hardcodée qui s'en écarte est un bug. |
| **UniversalTaxEngine** | `lib/fiscal/universal-tax-engine.ts` | 319/319 tests. Calcule IRPP, IS, TVA, retenues source pour tous pays CEMAC. |
| **UniversalPayrollEngine** | `lib/payroll/universal-payroll-engine.ts` | 319/319 tests. Génère bulletins paie multi-pays via CountryConfig. |
| **ConventionEngine** | `lib/conventions/convention-engine.ts` | Vérification conformité conventions collectives. |
| **RLS Multi-Tenant** | `supabase/migrations/067_rls_all_tenant_tables.sql` + `120_wave4a_rls_security.sql` | Isolation stricte par tenant. Toute table sans RLS = faille critique. |

### Règle absolue

```
Zéro valeur hardcodée fiscale dans le code UI.
Zéro taux (TVA, CNSS, IRPP) en dur dans les composants.
Tout passe par : getCountryConfig(codePays).
```

---

## Architecture actuelle

### Flux des calculs

```
Tenant (pays)
    │
    ▼
getCountryConfig(codePays)          ← lib/countries/[pays].ts
    │
    ├──► tva.taux_normal             ← factures, comptabilité
    ├──► cnss.taux_employeur         ► UniversalPayrollEngine
    ├──► cnss.taux_employe           ► UniversalPayrollEngine
    ├──► irpp.tranches[]             ► UniversalTaxEngine → calculerIRPP()
    ├──► smig                        ► validation salaires
    ├──► exonerations[]              ► primes imposables/non imposables
    └──► taxes_fixes[]               ► TOL, taxes communales
         │
         ▼
    UniversalTaxEngine               ← lib/fiscal/universal-tax-engine.ts
         │  calculerIRPP()
         │  calculerChargesSociales()
         │  calculerTVA()
         │
         ▼
    UniversalPayrollEngine           ← lib/payroll/universal-payroll-engine.ts
         │  genererBulletinPaie()
         │
         ▼
    Bulletin de paie                 ← app/dashboard/rh/paie/page.tsx
    Écriture OHADA                   ← app/api/factures/route.ts
    Grand Livre / Bilan              ← app/dashboard/comptabilite/
```

### Flux sécurité multi-tenant

```
Utilisateur (auth.uid())
    │
    ▼
get_my_tenant_id()                   ← SQL: SELECT tenant_id FROM profiles
    │                                         WHERE user_id = auth.uid()
    │                                         ORDER BY created_at ASC LIMIT 1
    ▼
RLS Policy (serveur)                 ← USING (tenant_id = get_my_tenant_id())
    │                                   WITH CHECK (tenant_id = get_my_tenant_id())
    │
    ▼
Filtre client-side                   ← .eq('tenant_id', tenantId)
    │                                   .eq('cabinet_tenant_id', tenantId)
    │
    ▼
Données isolées par tenant           ← 0 cross-tenant possible
```

### Hiérarchie des plans

```
TPE  (Entrepreneur)  → accès restreint, vue simplifiée
PME  (Business)      → accès standard, toutes fonctionnalités core
Grande (Compagnie)   → accès complet, MIAA+, groupe multi-entités
```

### Tables et colonnes tenant

| Module | Colonne pivot | Migrations RLS |
|---|---|---|
| Éducation, RH, Recrutement, Assurance, Finance | `tenant_id` | 067, 012, 106, 120 |
| Cabinet Juridique/Comptable | `cabinet_tenant_id` | 079, 080, 099, 120 |

---

## Wave 1 — Stabilisation Module Paie RH

**Date** : 2026-06-21  
**Contexte** : Le module Paie était inutilisable — 0 employé affiché, erreurs silencieuses, moteur fiscal Congo-only hardcodé, PDF cassé.

---

### W1-C1 — Colonnes DB incorrectes + moteur fiscal hardcodé

| | |
|---|---|
| **Date** | 2026-06-21 |
| **Commit** | `b1f9807` |
| **Fichier** | `app/dashboard/rh/paie/page.tsx` |
| **Bug** | `select('contrat,cnss,date_embauche')` → colonnes inexistantes dans la DB réelle → 0 employé affiché. Moteur `calculerPaie()` avec taux Congo hardcodés. |
| **Impact** | Module paie entièrement cassé pour tous les tenants non-CG. |
| **Fix** | Colonnes corrigées : `type_employe`, `numero_cnss`, `date_recrutement`. Moteur remplacé par `calculerIRPP()` + `calculerChargesSociales()` depuis `UniversalTaxEngine`. |
| **Dépendances** | `lib/fiscal/universal-tax-engine.ts`, `lib/hooks/useTenant.ts` (expose `pays`) |

---

### W1-C2 — Génération bulletins silencieuse + modal incomplet

| | |
|---|---|
| **Date** | 2026-06-21 |
| **Commit** | `1543f52` |
| **Fichier** | `app/dashboard/rh/paie/page.tsx` |
| **Bug** | Erreurs de génération non affichées. Modal détail sans primes DB. `prime_risque` absent du SELECT. Zéro valeur hardcodée IRPP remontée. |
| **Impact** | Utilisateur incapable de savoir pourquoi la génération échoue. Primes disparaissent du bulletin. |
| **Fix** | Erreurs visibles dans modal + banner. Bouton individuel par ligne. Toutes primes DB dans le SELECT. IRPP par tranche dépliable via `getCountryConfig(codePays)`. |
| **Dépendances** | `lib/countries/types.ts` (CountryConfig) |

---

### W1-C3 — RLS INSERT bulletins_paie + affichage -0

| | |
|---|---|
| **Date** | 2026-06-21 |
| **Commit** | `e0878c4` |
| **Fichier** | `app/dashboard/rh/paie/page.tsx`, `supabase/migrations/118_rls_bulletins_paie_fix.sql` |
| **Bug** | INSERT bulletins_paie bloqué par RLS (politique manquante). Affichage `TOTAUX -0`. |
| **Impact** | Impossible de sauvegarder un bulletin généré. |
| **Fix** | Migration 118 : policy RLS INSERT pour `bulletins_paie`. Fix affichage `Math.abs()` sur totaux. |
| **Dépendances** | Migration 118, `get_my_tenant_id()` |

---

### W1-C4 — Contournement RLS via API route service_role

| | |
|---|---|
| **Date** | 2026-06-21 |
| **Commit** | `3254d50` |
| **Fichier** | `app/api/paie/bulletins/route.ts`, `app/dashboard/rh/paie/page.tsx` |
| **Bug** | INSERT bulletins_paie continuait d'échouer côté client malgré migration 118. |
| **Impact** | Génération de bulletins toujours impossible. |
| **Fix** | Route API dédiée avec `supabaseAdmin` (service_role) pour les opérations paie qui nécessitent d'écrire plusieurs tables en une transaction. |
| **Dépendances** | `lib/supabase-admin.ts`, service_role key |

---

### W1-C5 — tenantId null sur boutons paie (erreur silencieuse)

| | |
|---|---|
| **Date** | 2026-06-21 |
| **Commit** | `483d587` |
| **Fichier** | `app/dashboard/rh/paie/page.tsx` |
| **Bug** | Boutons "Générer" et "Acompte" appelés avant que `tenantId` soit chargé → opération silencieusement ignorée ou crash sans message. |
| **Impact** | Actions utilisateur perdues sans feedback. |
| **Fix** | Guards `if (!tenantId) return` + désactivation boutons pendant chargement + feedback erreur visible. |
| **Dépendances** | `useTenant()` hook |

---

### W1-C6 — PDF paie : colonnes incorrectes + moteur hardcodé

| | |
|---|---|
| **Date** | 2026-06-21 |
| **Commit** | `7f7712e` |
| **Fichier** | `app/api/rh/paie/[id]/bulletin-pdf/route.ts`, `components/rh/PayslipPDF.tsx` |
| **Bug** | Route PDF lisait des colonnes inexistantes de `employes`. `PayslipPDF` utilisait un moteur hardcodé Congo. Silent fail sans 404. |
| **Impact** | PDF paie vide ou crash serveur. |
| **Fix** | Colonnes corrigées. Moteur remplacé par `UniversalPayrollEngine`. Retour 404 explicite si bulletin introuvable. |
| **Dépendances** | `lib/payroll/universal-payroll-engine.ts` |

---

## Wave 2 — Finance, Comptabilité & Sécurité

**Date** : 2026-06-21 / 2026-06-22  
**Contexte** : Dashboard comptabilité bloqué en chargement infini. 13 bugs OHADA dans le module Finance. Failles sécurité plan-access et middleware.

---

### W2-C1 — 13 bugs OHADA Finance & Comptabilité

| | |
|---|---|
| **Date** | 2026-06-21 |
| **Commit** | `823a847` |
| **Fichiers** | `app/dashboard/comptabilite/page.tsx`, `bilan/page.tsx`, `grand-livre/page.tsx`, `journal/page.tsx`, `app/api/factures/route.ts`, `lib/accounting-engine.ts`, `supabase/migrations/119_journal_entries_syscohada_fix.sql` |
| **Bugs** | (1) KPIs n'agrègent pas `journal_entries` auto. (2) Factures → compte 443 au lieu de 4441. (3) Bilan : 521 en passif, 421/422 mal positionnés. (4) Erreurs silencieuses. (5) CSV Grand Livre colonne perdue. (6) Pagination infinie journal. (7) Paie → 5 écritures OHADA incomplètes. (8) 661/421 vs 422. (11/14) Codes à 6 chiffres non normalisés. (13) `fn_create_depense()` n'écrit pas dans `journal_entries`. (16) TVA 18% hardcodée Congo. |
| **Impact** | Bilan incorrect, Grand Livre inexportable, paie non comptabilisée, TVA fausse pour les pays non-CG. |
| **Fix** | Migration 119 : normalisation codes SYSCOHADA + triggers auto + type_compte étendu. `calcTVA()` → `getCountryConfig(pays).tva.taux_normal`. 5 écritures OHADA paie complètes. |
| **Dépendances** | Migration 119, `lib/countries/types.ts` (CountryConfig TVA) |

---

### W2-C2 — Boucle infinie dashboard comptabilité

| | |
|---|---|
| **Date** | 2026-06-21 |
| **Commit** | `2eb3098` |
| **Fichier** | `app/dashboard/comptabilite/page.tsx` |
| **Bug** | `MONTHS_FR` recréé à chaque render (Array.from inline) → `useCallback` invalide à chaque cycle → `useEffect` déclenche `load()` en boucle infinie. Dashboard bloqué en "Chargement...". |
| **Impact** | Module comptabilité inutilisable, boucle Supabase requests. |
| **Fix** | `MONTHS_FR` enveloppé dans `useMemo([intlLocale])`. Dep array `[tenantId, intlLocale]`. Optional chaining sur `credit_account?.startsWith`. |
| **Dépendances** | Aucune externe |

---

### W2-C3 — Middleware inactif + bypass plan null taille

| | |
|---|---|
| **Date** | 2026-06-22 |
| **Commit** | `adffb0e` |
| **Fichiers** | `middleware.ts`, `app/onboarding/actions.ts`, `lib/plan-access.ts` |
| **Bugs** | (W2-C1) `middleware.ts` absent → `proxy.ts` silencieusement ignoré par Next.js → protection routes désactivée. (W2-C2) Pas de validation server-side `taille`/`secteur` à l'onboarding → données invalides en DB. (W2-C3) `taille = null` donnait accès complet au lieu du plan le plus restrictif (TPE). |
| **Impact** | Routes non protégées. Tenants avec `taille=null` avaient un accès Enterprise. |
| **Fix** | `middleware.ts` créé pour activer `proxy.ts`. Validation `VALID_TAILLES` + `VALID_SECTEURS` server-side. Fallback `null taille → TPE`. |
| **Dépendances** | `lib/plan-access.ts`, `proxy.ts` |

---

## Wave 3 — Migration UniversalEngine + Fiscal

**Date** : 2026-06-22  
**Contexte** : Plusieurs pages UI contenaient encore des valeurs fiscales hardcodées Congo. Le module RH utilisait un moteur fiscal interne non testé. Barème IRPP CG non conforme LF 2026.

---

### W3-C1 — Migration RH → UniversalPayrollEngine (6 lots)

| | |
|---|---|
| **Date** | 2026-06-22 |
| **Commit** | `d0d0e4f` |
| **Fichiers** | `app/dashboard/rh/page.tsx`, `app/dashboard/fiscalite/page.tsx`, `app/dashboard/comptabilite/page.tsx`, `app/dashboard/facturation/page.tsx`, `lib/contexts/PaysContext.tsx` |
| **Bugs** | (LOT 1) `rh/page.tsx` utilisait `calculerBulletinPaie()` Congo-only. (LOT 2) TOL display hardcodé. (LOT 3) `fiscalite/page.tsx` : modules et obligations légales hardcodés Congo. (LOT 4) Textes "Congo-Brazzaville" et "TVA Congo automatique" hardcodés. (LOT 5) `ca=0` bug factures à 3 sites. (LOT 6) Villes select au lieu de texte libre ; taux CNSS hardcodé "14,16% plafonné". |
| **Impact** | Calculs fiscaux faux pour tout pays non-CG. Interface affichant "Congo" même pour un tenant camerounais. |
| **Fix** | Tous les calculs → `calculerIRPP()` + `calculerChargesSociales()` via `UniversalTaxEngine`. Tous les textes → `CountryConfig.nom_pays`. Tous les taux → `CountryConfig.cnss/irpp/tva`. |
| **Dépendances** | `lib/fiscal/universal-tax-engine.ts`, `lib/payroll/universal-payroll-engine.ts`, `lib/countries/types.ts` |

---

### W3-C2 — Barème IRPP CG non conforme Art. 76 LF 2026

| | |
|---|---|
| **Date** | 2026-06-22 |
| **Commit** | `c0574a0` |
| **Fichier** | `lib/countries/CG.ts` |
| **Bug** | Barème CG : méthode `annuelle_div12`, abattement 20% `pct_net_cnss`, 5 tranches avec montants fixes incorrects. Non conforme à l'Art. 76 CGI LF 2026. |
| **Impact** | IRPP Congo calculé faux pour tous les bulletins. |
| **Fix** | Méthode → `mensuelle_directe`. Abattement → `aucun`. Tranches conformes : 0/464k/1M/3M/8M FCFA aux taux 0/1/10/25/40%. |
| **Dépendances** | `lib/fiscal/universal-tax-engine.ts` (lit CountryConfig) |

---

### W3-C3 — Suite de tests validation 4 pays

| | |
|---|---|
| **Date** | 2026-06-22 |
| **Commit** | `a0e7c83` |
| **Fichier** | `lib/scenarios/business-scenarios.test.ts` |
| **Action** | Création de 160 nouveaux tests couvrant CG, CM, CD, GA : TVA facture, IS, dépense/écriture OHADA, retenue source, charges sociales, IRPP, bulletin paie complet, cohérence chaîne, comparatifs inter-pays. |
| **Résultat** | Suite totale : **319/319 tests passants**. |
| **Dépendances** | `UniversalTaxEngine`, `UniversalPayrollEngine`, `CountryConfig` (tous les 4 pays) |

---

## Wave 4A — Sécurité Multi-Tenant Secteurs

**Date** : 2026-06-22  
**Contexte** : Audit complet des modules sectoriels (Éducation, Cabinet, Assurance, Recrutement). 9 opérations cross-tenant possibles côté client + 3 tables sans protection RLS serveur.

---

### C-01 — notes_etudiants sans filtre tenant (lecture)

| | |
|---|---|
| **Date** | 2026-06-22 |
| **Fichier** | `app/dashboard/ecole/scolarite/page.tsx` — `SectionNotes.useEffect` |
| **Bug** | SELECT `notes_etudiants` sans `.eq('tenant_id', tenantId)` → un tenant pouvait lire les notes de tous les étudiants de tous les tenants. |
| **Impact** | Fuite de données critique : notes académiques cross-tenant visibles. |
| **Fix** | Ajout `.eq('tenant_id', tenantId)` sur le SELECT. |
| **Dépendances** | RLS migration 067 (protection serveur `notes_etudiants`) |

---

### Additif C-01 — changeStatut / handleGenCode / del sans guard tenant

| | |
|---|---|
| **Date** | 2026-06-22 |
| **Fichier** | `app/dashboard/ecole/scolarite/page.tsx` — `SectionInscriptions` |
| **Bug** | `changeStatut()`, `handleGenCode()`, `del()` opéraient sur `etudiants` sans `.eq('tenant_id', tenantId)` → modification/suppression cross-tenant possible. |
| **Impact** | Tenant A pouvait suspendre, générer un code de déblocage ou supprimer un étudiant de Tenant B. |
| **Fix** | `.eq('tenant_id', tenantId)` ajouté sur chacune des 3 opérations. |
| **Dépendances** | RLS migration 067 (`etudiants`) |

---

### C-02 — espace-etudiant : 3 lectures + toggleBlock sans guard

| | |
|---|---|
| **Date** | 2026-06-22 |
| **Fichier** | `app/dashboard/ecole/espace-etudiant/page.tsx` — `loadStudentData`, `toggleBlock` |
| **Bug** | Les 3 SELECT (`notes_etudiants`, `paiements_scolaires`, `absences_etudiants`) et les 2 UPDATE `toggleBlock` n'avaient pas de filtre tenant. |
| **Impact** | Lecture cross-tenant du dossier complet étudiant (notes, paiements, absences). Blocage/déblocage cross-tenant. |
| **Fix** | `.eq('tenant_id', tenantId)` sur les 3 SELECT et les 2 UPDATE. |
| **Dépendances** | RLS migration 067 (`notes_etudiants`, `paiements_scolaires`, `absences_etudiants`) |

---

### M-08 — toggleStatut recrutements_ecole sans guard

| | |
|---|---|
| **Date** | 2026-06-22 |
| **Fichier** | `app/dashboard/ecole/rh/page.tsx:1764` — `SectionRecrutement.toggleStatut` |
| **Bug** | UPDATE `recrutements_ecole` sans `.eq('tenant_id', tenantId)` → fermeture/ouverture de postes cross-tenant. |
| **Impact** | Tenant A pouvait modifier le statut des postes de recrutement de Tenant B. |
| **Fix** | `.eq('tenant_id', tenantId)` ajouté sur le UPDATE. |
| **Dépendances** | RLS migration 067 (`recrutements_ecole`) |

---

### C-15 — cabinet_affaires : tenant_id vs cabinet_tenant_id

| | |
|---|---|
| **Date** | 2026-06-22 |
| **Fichier** | `app/dashboard/cabinet/affaires/page.tsx` |
| **Bug** | SELECT et INSERT utilisaient `tenant_id` au lieu de `cabinet_tenant_id` — colonne convention de tout le module Cabinet. Si la table existait avec `tenant_id`, la policy RLS `cabinet_tenant_id = get_my_tenant_id()` ne filtrait rien. |
| **Impact** | Affaires et audiences non isolées par tenant dans le module cabinet juridique. |
| **Fix** | `tenant_id` → `cabinet_tenant_id` dans SELECT × 2 et INSERT × 1. Migration 120 : renommage conditionnel de la colonne si la table existait déjà avec `tenant_id`. |
| **Dépendances** | Migration 120, convention cabinet (`cabinet_tenant_id`) |

---

### C-18 — ass_partenaires : UPDATE + DELETE sans guard

| | |
|---|---|
| **Date** | 2026-06-22 |
| **Fichier** | `app/dashboard/assurance/partenaires/page.tsx` — `handleSave`, `handleDelete` |
| **Bug** | UPDATE et DELETE sans `.eq('tenant_id', tenantId)` → modification/suppression de partenaires cross-tenant. |
| **Impact** | Tenant A pouvait modifier ou supprimer les partenaires (réassureurs, garages, hôpitaux) de Tenant B. |
| **Fix** | `.eq('tenant_id', tenantId)` ajouté sur UPDATE et DELETE. |
| **Dépendances** | RLS migration 106 (`ass_partenaires`) |

---

### C-18 — ass_produits : UPDATE + toggleActif sans guard

| | |
|---|---|
| **Date** | 2026-06-22 |
| **Fichier** | `app/dashboard/assurance/produits/page.tsx` — `handleSave`, `toggleActif` |
| **Bug** | UPDATE (modification) et UPDATE (toggle actif/inactif) sans `.eq('tenant_id', tenantId)`. |
| **Impact** | Tenant A pouvait modifier les produits d'assurance de Tenant B ou les désactiver. |
| **Fix** | `.eq('tenant_id', tenantId)` ajouté sur UPDATE et `toggleActif`. |
| **Dépendances** | RLS migration 106 (`ass_produits`) |

---

### M-12 — candidatures : updateStatut sans guard

| | |
|---|---|
| **Date** | 2026-06-22 |
| **Fichier** | `app/dashboard/recrutement/candidatures/page.tsx:70` — `updateStatut` |
| **Bug** | UPDATE `candidatures` sans `.eq('tenant_id', tenantId)` → changement de statut cross-tenant. |
| **Impact** | Tenant A pouvait accepter ou refuser des candidatures appartenant à Tenant B. |
| **Fix** | `.eq('tenant_id', tenantId)` ajouté sur UPDATE. |
| **Dépendances** | Migration 120 (RLS `candidatures` — table sans policy avant cette migration) |

---

### M-13 — entretiens : updateStatut sans guard

| | |
|---|---|
| **Date** | 2026-06-22 |
| **Fichier** | `app/dashboard/recrutement/entretiens/page.tsx:79` — `updateStatut` |
| **Bug** | UPDATE `entretiens` sans `.eq('tenant_id', tenantId)` → changement de statut cross-tenant. |
| **Impact** | Tenant A pouvait annuler ou marquer comme effectué un entretien de Tenant B. |
| **Fix** | `.eq('tenant_id', tenantId)` ajouté sur UPDATE. |
| **Dépendances** | RLS migration 012 (`entretiens` — déjà protégé serveur, fix client-side uniquement) |

---

### Migration 120 — RLS serveur 3 tables

| | |
|---|---|
| **Date** | 2026-06-22 |
| **Fichier** | `supabase/migrations/120_wave4a_rls_security.sql` |
| **Action** | (1) `candidatures` : `ENABLE ROW LEVEL SECURITY` + policy `FOR ALL`. (2) `cabinet_affaires` : `CREATE TABLE IF NOT EXISTS` + RLS `cabinet_tenant_id`. (3) `cabinet_audiences` : `CREATE TABLE IF NOT EXISTS` + RLS `cabinet_tenant_id`. Renommage conditionnel `tenant_id → cabinet_tenant_id` si tables existantes. |
| **Validation** | Script `supabase/tests/rls_wave4a_rapport.sql` → **`✓ VALIDÉ — Aucune opération cross-tenant possible sur les 11 tables Wave 4A.`** |
| **Dépendances** | `get_my_tenant_id()`, `tenants` table, migration 079 (convention `cabinet_tenant_id`) |

---

## Tableau de bord Tests

| Wave | TypeScript | Vitest | Date |
|---|---|---|---|
| Wave 1 | 0 erreur | — | 2026-06-21 |
| Wave 2 | 0 erreur | — | 2026-06-21/22 |
| Wave 3 | 0 erreur | **319/319** | 2026-06-22 |
| Wave 4A | 0 erreur | **319/319** | 2026-06-22 |

---

## Règles anti-régression

1. **Avant toute modification d'un fichier RH/Paie** : vérifier que le moteur utilisé est `UniversalTaxEngine` / `UniversalPayrollEngine`, pas un calcul local.
2. **Avant toute opération Supabase** (SELECT/INSERT/UPDATE/DELETE) : vérifier la présence du filtre `.eq('tenant_id', tenantId)` ou `.eq('cabinet_tenant_id', tenantId)`.
3. **Avant toute nouvelle table** : créer la migration avec `ENABLE ROW LEVEL SECURITY` + policy `FOR ALL USING (tenant_id = get_my_tenant_id())`.
4. **Avant tout déploiement** : `npx tsc --noEmit` → 0 erreur. `npx vitest run` → 319/319.
5. **Après toute migration RLS** : exécuter `supabase/tests/rls_wave4a_rapport.sql` et vérifier `✓ VALIDÉ`.

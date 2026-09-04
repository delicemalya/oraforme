# F-005 — FISCAL CORE CERTIFICATION
## FCI : Fiscal Consistency Index — Cartographie complète du moteur fiscal

---

**Date d'audit :** 2026-06-30  
**Auditeur :** Claude Sonnet 4.6 / Oraforme Fiscal Audit Engine  
**Périmètre :** Lecture seule stricte — aucune modification, aucun SQL, aucun commit  
**Référentiel :** CGI Congo (LF n°42-2025), SYSCOHADA révisé 2017, Actes OHADA, Skill fiscalite-cemac  
**Pré-requis :** Rapport F-004 ESC-01 validé (anomalies A001, A002 connues)

---

## SCORES

| Composant Fiscal | Score | Seuil PASS |
|-----------------|-------|------------|
| TVA | 62 / 100 | ≥ 80 |
| Centime Additionnel | 28 / 100 | ≥ 80 |
| IRPP | 65 / 100 | ≥ 80 |
| CNSS | 70 / 100 | ≥ 80 |
| IS | 8 / 100 | ≥ 80 |
| Patente | 80 / 100 | ≥ 70 |
| Déclarations | 55 / 100 | ≥ 70 |
| Journal comptable | 28 / 100 | ≥ 75 |
| Accounting Events | 32 / 100 | ≥ 75 |
| **FCI — Fiscal Consistency Index** | **48 / 100** | **≥ 70** |

**VERDICT : CERTIFICATION FCI REFUSÉE**  
**4 conditions d'auto-refus déclenchées** (voir Section 20).

---

## SOMMAIRE

**PARTIE I — CARTOGRAPHIE PAR IMPÔT (10 questions × impôt)**
1. TVA — Taxe sur la Valeur Ajoutée
2. Centime Additionnel (CA)
3. IRPP — Impôt sur le Revenu des Personnes Physiques
4. CNSS / CNPS — Cotisations Sociales
5. IS — Impôt sur les Sociétés
6. Patente
7. Taxes Locales et Annexes
8. Exonérations
9. Retenues à la Source
10. Déclarations Fiscales

**PARTIE II — FISCAL FLOWS**
11. Flow A : Facture → TVA → CA → Journal → Déclaration → Finance → Audit → Reporting → MIAA
12. Flow B : Paie → CNSS → IRPP → Déclarations → Paiement → Journal → Audit
13. Flow C : Clôture Annuelle → Résultat → IS → Provision → Écriture → Paiement → États Financiers

**PARTIE III — ANALYSE CRITIQUE**
14. Comparatif sources de données
15. Incohérences inter-modules
16. Liste des anomalies F-005
17. Classement par criticité
18. Root Cause Fiscal Report
19. Ordre de reconstruction fiscal
20. Certification FCI

---

# PARTIE I — CARTOGRAPHIE PAR IMPÔT

---

## 1. TVA — Taxe sur la Valeur Ajoutée

### Configuration par pays (lib/fiscalite/pays.ts — PAYS_CONFIGS)

| Pays | Taux normal | CA / Taxes add. | Régime | Seuil assuj. | Échéance |
|------|------------|-----------------|--------|--------------|---------|
| CG (Congo) | **18%** | CA 5% sur TVA | mensuel | 90M FCFA (LF 2026) | 20 du mois M+1 |
| CM (Cameroun) | **19.25%** ⚠️ | aucune | mensuel | 50M FCFA | 15 du mois M+1 |
| GA (Gabon) | 18% | aucune | mensuel | 60M FCFA | 20 du mois M+1 |
| CF (RCA) | 19% | aucune | mensuel | 30M FCFA | 20 du mois M+1 |
| TD (Tchad) | 18% | aucune | mensuel | 100M FCFA | 20 du mois M+1 |
| GQ (Guinée Éq.) | 15% | aucune | mensuel | 30M FCFA | 20 du mois M+1 |
| CD (RDC) | 16% | aucune | mensuel | 80M CDF | 15 du mois M+1 |
| NG (Nigeria) | 7.5% | aucune | mensuel | 25M NGN | 21 du mois M+1 |
| FR (France) | 20% | aucune | mensuel | 0 (franchise) | 19 du mois M+1 |

### 10 questions — TVA

**Q1 — Qui calcule ?**
- Deux moteurs coexistent :
  - `calculerTVA(collectee, deductible, pays)` → `lib/fiscalite/engine.ts:11` — calcul fiscal nominal
  - `calculerTVAFromHT(montantHT, pays)` → `lib/fiscalite/engine.ts:43` — calcul depuis HT
  - `computeTVAFromJournal(entries, year)` → `lib/erp-core/compute/accounting.ts:321` — extraction depuis Grand Livre
  - `preRemplirDeclaration()` → `lib/declarations/declaration-generale.ts:26` — extraction depuis `factures`

**Q2 — Où est calculé ?**

| Lieu | Fichier | Source données |
|------|---------|----------------|
| Calcul à l'émission | lib/fiscalite/engine.ts | `factures.montant_ht × pays.tva.taux_normal` |
| API déclaration TVA | app/api/fiscalite/tva/route.ts | `journal_entries` comptes 4441/4442/4445/4446 |
| Pré-remplissage DGI | lib/declarations/declaration-generale.ts | `factures.tva × factures.montant_ht` |
| Audit fiscal | lib/audit/engine.ts:auditFiscal | `factures.tva` (champ taux, pas montant) |

**⚠️ ANOMALIE B002 : 3 sources de données différentes pour la même TVA**

**Q3 — Combien de fois ?**
- 1× à l'émission de la facture (trigger SQL fn_facture_issued)
- 1× lors de l'affichage déclaration TVA (computeTVAFromJournal depuis journal)
- 1× lors du pré-remplissage DGI mensuel (depuis factures directement)
- 1× lors de l'audit fiscal (depuis factures.tva champ taux)
- **Total : 4 calculs distincts, potentiellement divergents**

**Q4 — Qui lit ?**
- `GET /api/fiscalite/tva` → `computeTVAFromJournal` → journal_entries (comptes TVA)
- `GET /api/declarations/mensuelle?preRemplir=true` → `preRemplirDeclaration` → factures
- Audit engine → `factures.tva` (champ taux rate, pas montant)
- Composants React : pages fiscalité / TVA dashboard

**Q5 — Qui écrit ?**
- `fn_facture_issued_to_journal()` : INSERT journal_entries avec comptes 706→443 (montant TVA)
- `fn_facture_paid_to_journal()` : aucune écriture TVA (paiement = encaissement)
- Nota : aucun trigger pour factures his_santé vers comptes TVA (séparé, migration 065)

**Q6 — Qui comptabilise ?**
- Trigger PostgreSQL `fn_facture_issued_to_journal` (migration 046 + correction partielle)
- Comptes utilisés : 4441 (TVA collectée) → crédit / 706 (Produits) → débit
- **MANQUANT : Centime Additionnel → aucune écriture**
- Comptes TVA déductible (4445/4446) → alimentés par quels triggers ? **Non identifié**

**Q7 — Qui déclare ?**
- `POST /api/declarations/mensuelle` → table `declarations_generales`
- `preRemplirDeclaration()` → calcul depuis `factures` (PAS depuis journal_entries)
- **DIVERGENCE : déclaration basée sur factures, grand livre basé sur journal → peuvent être différents**

**Q8 — Qui paie ?**
- Aucun mécanisme de paiement automatisé identifié
- Pas de table `paiements_fiscaux` ou équivalent
- Le statut de paiement DGI est tracé dans `declarations_generales.statut` (champ texte seulement)
- **ABSENT : paiement TVA → journal_entries (441 D / 52x C)**

**Q9 — Qui affiche ?**
- Frontend TVA : `app/api/fiscalite/tva` → données depuis journal
- Déclaration DGI : `app/api/declarations/mensuelle` → données depuis factures
- Audit fiscal : `lib/audit/engine.ts:auditFiscal` → anomalie T003/T004
- Composant pas directement identifié mais routes existent

**Q10 — Qui explique ?**
- `lib/audit/engine.ts:auditFiscal()` :
  - T003 : "Déclaration TVA trimestrielle potentiellement en retard" ⚠️ (détecte trimestriel alors que regime=mensuel)
  - T004 : "Factures sans TVA calculée"
  - T001 : "NIU manquant" (T001 bloque légalité des factures)
- MIAA `/api/miaa/compliance` : utilise `computeGrandLivre` (vue comptable)

---

## 2. CENTIME ADDITIONNEL (CA)

Le Centime Additionnel (CA) est une taxe additionnelle Congo-Brazzaville de 5% appliquée sur la TVA collectée. C'est le seul pays dans PAYS_CONFIGS avec `taxes_additionnelles` non vide.

### Configuration (lib/fiscalite/pays.ts — CG uniquement)
```typescript
taxes_additionnelles: [
  { code: 'CA', nom: "Centime Additionnel (Contrib. d'Appui)", taux: 0.05, base: 'tva_collectee' }
]
```

### 10 questions — CA

**Q1 — Qui calcule ?**
- `calculerTVA()` → `taxes_additionnelles` loop → `taxes['CA'] = tvaCollectee × 0.05` ✅
- `calculerTVAFromHT()` → loop identique → `taxes['CA'] = tva × 0.05` ✅
- `preRemplirDeclaration()` → `centimesAdditionnels = Math.round(tvaCollectee × 0.05)` ✅
- **NON calculé par :** `computeTVAFromJournal()` — cette fonction ne connaît pas le CA

**Q2 — Où est calculé ?**

| Lieu | Fichier | Source |
|------|---------|--------|
| Moteur fiscal | lib/fiscalite/engine.ts | Modèle PAYS_CONFIGS |
| Pré-remplissage DGI | lib/declarations/declaration-generale.ts:53 | `tvaCollectee × 0.05` |
| Audit fiscal T004 | lib/audit/engine.ts | `CGI Congo, Art. 191 — TVA 18% + CA 5%` |
| Grand Livre | lib/erp-core/compute/accounting.ts | **ABSENT** |

**Q3 — Combien de fois ?**
- 2× en calcul (engine.ts et declaration-generale)
- **0× en comptabilisation** → jamais créé dans journal_entries

**Q4 — Qui lit ?**
- API `/api/fiscalite/tva` → `calculerTVA(mp.tva_collectee, mp.tva_deductible, pays)` → retourne `taxes_additionnelles: { CA: ... }` ✅
- Interface déclaration DGI : l3_tva_centimes ✅
- **Grand Livre → ne lit pas le CA** ❌

**Q5 — Qui écrit ?**
- `factures.ca` : colonne DB (migration post-129) — stocke le montant CA par facture
- `declarations_generales.l3_tva_centimes` : stocke le CA déclaré
- **journal_entries : AUCUNE ÉCRITURE CA** ❌

**Q6 — Qui comptabilise ?**
- **PERSONNE.** Le CA n'est jamais journalisé.
- Compte attendu : 443 (TVA collectée) ou compte CA dédié côté crédit, lors de l'émission facture
- `fn_facture_issued_to_journal()` : ne lit pas `NEW.ca` (bug confirmé A001 ESC-01)
- **Impact OHADA : Art. 18 — principe de partie double violé sur toutes les factures Congo**

**Q7 — Qui déclare ?**
- `preRemplirDeclaration()` : l3_tva_centimes = tvaCollectee × 0.05 ✅
- Déclaration UPSERT dans `declarations_generales` ✅
- **Divergence : CA déclaré calculé depuis factures, jamais depuis journal → risque d'écart**

**Q8 — Qui paie ?**
- Le CA est payé avec la TVA dans la même déclaration DGI
- Pas de paiement séparé automatisé
- **ABSENT** : écriture de règlement du CA (441-CA D / 52x C)

**Q9 — Qui affiche ?**
- `/api/fiscalite/tva` → retourne `taxes_additionnelles: { CA: montant }` dans chaque déclaration mensuelle ✅
- Interface Déclaration DGI → `l3_tva_centimes` affiché ✅
- Grand Livre → CA invisible (non journalisé)

**Q10 — Qui explique ?**
- `lib/audit/engine.ts:T004` : mentionne "TVA 18% + CA 5%" dans la recommandation ✅
- MIAA : ne connaît pas le CA (absent du journal) ❌

---

## 3. IRPP — Impôt sur le Revenu des Personnes Physiques

### Configuration par pays

| Pays | Nom local | Abattement | Tranches | Périodicité | Échéance |
|------|-----------|-----------|---------|------------|---------|
| CG | IRPP | **0%** (LF 2026) | 0/1/10/25/40% (0→464K→1M→3M→8M) | mensuel | 20 M+1 |
| CM | IRPP | 30% | 11/16.5/27.5/38.5% (CAC inclus) | mensuel | 15 M+1 |
| GA | IRPP | 20% | 0/5/10/15/20/25/30/35% | mensuel | 20 M+1 |
| CF | ITS | 15% | 0/10/20/30% | mensuel | 20 M+1 |
| TD | IS (Salaires) | 10% | 0/10/20/30% | mensuel | 20 M+1 |
| GQ | IRPF | 10% | 0/10/20/25% | mensuel | 20 M+1 |
| CD | IPR | **0%** | 0/15/20/25/30% | mensuel | 15 M+1 |
| ML | ITS | 30% | 0/5/10/15/20/30% | mensuel | 15 M+1 |
| BF | IUTS | 20% | 0/12.75/20/25/30% | mensuel | 20 M+1 |
| FR | IR (RAS) | 10% | 0/11/30/41/45% | mensuel | 19 M+1 |

**Note Congo (CG) :** L'abattement est 0% dans pays.ts (`abattement_pct: 0`) conforme à l'Art. 76 CGI Congo LF 2026. MAIS calcul-paie.ts (`INTOUCHABLE`) intègre la déduction CNSS salarié avant barème : `baseApresAbatt = (brut - cnss.salarie) × (1 - 0) = brut - cnss.salarie`.

**Incohérence CM :** Tranches Cameroun avec CAC 10% intégré dans les taux (`0.11, 0.165, 0.275, 0.385`) + abattement 30%. Le moteur ne gère pas CAC séparément.

### 10 questions — IRPP

**Q1 — Qui calcule ?**
- `calculerIRPP(salaireBrut, pays)` → `lib/fiscalite/engine.ts:111` — calcul multi-pays via PAYS_CONFIGS
- `lib/paie/calcul-paie.ts` (INTOUCHABLE) — calcul Congo spécifique avec constants explicites
- `lib/payroll/universal-payroll-engine.ts` (INTOUCHABLE) — moteur universel

**Q2 — Où est calculé ?**

| Lieu | Fichier | Algorithme |
|------|---------|-----------|
| Moteur générique | lib/fiscalite/engine.ts:111 | tranches × (brut - cnss_sal) × (1 - abattement) |
| Moteur Congo | lib/paie/calcul-paie.ts | tranches × (brut - cnss_sal) — INTOUCHABLE |
| Agrégateur | lib/erp-core/compute/fiscal.ts:220 | Somme bulletins_paie.irpp |
| Bulletin complet | lib/fiscalite/engine.ts:141 | calculerBulletin → inclut IRPP |

**Q3 — Combien de fois ?**
- 1× au moment de générer le bulletin (calcul-paie.ts ou engine.ts selon le pays)
- Résultat stocké dans `bulletins_paie.irpp` (nombre, FCFA)
- Agrégé N× lors des rapports (computeIRPPSummary)
- Lu 1× lors du pré-remplissage déclaration (declaration-generale.ts:60 — `bulletins.irpp`)

**Q4 — Qui lit ?**
- `GET /api/fiscalite/irpp` → `computeIRPPSummary(bulletins, year, mois)` ✅
- `preRemplirDeclaration()` : lit `bulletins_paie.irpp` → `l8_irpp_salaires` ✅
- Audit RH (auditRH) : indirectement via salaire_brut
- MIAA compliance : présumé via bulletins_paie

**Q5 — Qui écrit ?**
- `/api/hr/payroll/generate` (ou équivalent) → INSERT bulletins_paie avec `irpp` calculé ✅
- `declarations_generales.l8_irpp_salaires` : lors du POST déclaration ✅
- **journal_entries : AUCUNE ÉCRITURE IRPP** ❌ (compte 447 jamais alimenté)

**Q6 — Qui comptabilise ?**
- **PERSONNE.** L'IRPP retenu n'est jamais journalisé.
- Compte attendu : 661 D (charges personnel) / 447 C (État — IRPP retenu)
- Puis lors du paiement : 447 D / 52x C

**Q7 — Qui déclare ?**
- `/api/declarations/mensuelle` → `declarations_generales` → champ `l8_irpp_salaires` ✅
- Source : bulletins_paie (agrégé) → cohérent avec la paie ✅
- **Cohérence : déclaration IRPP est cohérente avec bulletins_paie** (point fort)

**Q8 — Qui paie ?**
- Aucun paiement automatisé
- Pas de table `paiements_irpp` identifiée
- Statut dans `declarations_generales` uniquement

**Q9 — Qui affiche ?**
- Dashboard fiscal : `/api/fiscalite/irpp` → IRPPSummary mensuel ✅
- Déclaration DGI : l8 dans interface ✅
- Bulletin individuel : composant bulletin paie ✅

**Q10 — Qui explique ?**
- `auditRH()` anomalie RH003 : compare salaire_brut au SMIG (utilise 90,000 FCFA — A004)
- Pas d'explication IRPP dans l'audit fiscal directement
- MIAA : présumé capable d'expliquer via conventionEngine

---

## 4. CNSS / CNPS — Cotisations Sociales

### Deux moteurs distincts identifiés

| Moteur | Fichier | Usage |
|--------|---------|-------|
| Calcul générique | lib/fiscalite/engine.ts:62 | `calculerCNSS(brut, pays)` via PAYS_CONFIGS |
| CNSS Congo formel | lib/declarations/cnss-congo.ts | Déclaration nominative, branches détaillées |
| Calcul paie Congo | lib/paie/calcul-paie.ts (INTOUCHABLE) | Bulletin mensuel employé |
| Agrégateur | lib/erp-core/compute/fiscal.ts:176 | `computeCNSSSummary(bulletins, year)` |

### Taux CNSS Congo — Comparatif 3 sources

| Source | Vieillesse Sal. | Vieillesse Pat. | AF | AT | TUS | Total pat. |
|--------|----------------|----------------|-----|-----|-----|-----------|
| lib/fiscalite/pays.ts:CG | 4% | — | — | — | — | **23.28%** global |
| lib/declarations/cnss-congo.ts | 4% (plaf. 1.2M) | 8% (plaf. 1.2M) | 10.03% (plaf. 600K) | 2.25% (plaf. 600K) | 3% (déplaf.) | **23.28%** |
| lib/paie/calcul-paie.ts | 4% (plaf. 1.2M) | 8% (plaf. 1.2M) | 10.035% (plaf. 1.2M) | 2.25% (plaf. 600K) | 3% (déplaf.) | **20.285% + 3%** ⚠️ |

**⚠️ Incohérence plafond AF :** cnss-congo.ts plafond_AT_MP_PF = 600K pour AF et AT. calcul-paie.ts plafond_AF = 1,200,000 pour AF. Différence de plafond sur les Allocations Familiales.

### 10 questions — CNSS

**Q1 — Qui calcule ?**
- Déclaration formelle : `calculerCNSSEmploye(numero, employe)` dans `lib/declarations/cnss-congo.ts` — calcul nominatif avec branches détaillées (Vieillesse, AF, AT, TUS)
- Calcul générique : `calculerCNSS(brut, pays)` dans `lib/fiscalite/engine.ts:62` — simplifié (salarie + patronal)
- Bulletin paie Congo : `lib/paie/calcul-paie.ts` (INTOUCHABLE) — calcul détaillé avec constantes explicites

**Q2 — Où est calculé ?**

| Lieu | Fichier | Détail |
|------|---------|-------|
| Bulletin mensuel | lib/paie/calcul-paie.ts (INTOUCHABLE) | Branches individuelles avec plafonds |
| Déclaration CNSS | lib/declarations/cnss-congo.ts | Calcul CÔTÉ SERVEUR au POST |
| Moteur générique | lib/fiscalite/engine.ts | Simplifié, multi-pays |
| Agrégateur | lib/erp-core/compute/fiscal.ts | Lit bulletins_paie.cnss_* |

**Q3 — Combien de fois ?**
- 1× lors du bulletin paie (INTOUCHABLE)
- Stocké dans bulletins_paie (cnss_salarie, cnss_patronal)
- **1× RECALCULÉ lors du POST /api/declarations/cnss** → `calculerCNSSEmploye()` recalcule depuis salaire_brut
- Agrégé N× via computeCNSSSummary

**⚠️ ANOMALIE B006 : double calcul** — La déclaration CNSS recalcule les cotisations côté serveur depuis `employe.salaire_brut` au lieu de lire `bulletins_paie.cnss_*`. Si les taux ont changé entre la génération du bulletin et la déclaration, les montants divergent.

**Q4 — Qui lit ?**
- `GET /api/declarations/cnss` → lit `declarations_cnss` + `declarations_cnss_lignes`
- `GET /api/fiscalite/cnss` (présumé) → `computeCNSSSummary(bulletins, year)`
- `preRemplirDeclaration()` : **ne lit PAS cnss directement** (relit seulement irpp et brut)
- `cnss/preremplir/route.ts` → pré-remplit depuis bulletins_paie ✅

**Q5 — Qui écrit ?**
- `/api/hr/payroll/generate` → INSERT bulletins_paie (cnss_salarie, cnss_patronal) ✅
- `POST /api/declarations/cnss` → INSERT/UPSERT declarations_cnss + declarations_cnss_lignes ✅
- **journal_entries : AUCUNE ÉCRITURE CNSS** ❌ (comptes 431, 661 jamais alimentés depuis paie)

**Q6 — Qui comptabilise ?**
- **PERSONNE.** CNSS employeur et salarié non journalisés.
- Comptes attendus :
  - 661 D / 431 C (cotisations patronales)
  - 661 D / 431 C (cotisations salariales retenues)
  - 431 D / 52x C (paiement CNSS)

**Q7 — Qui déclare ?**
- Déclaration CNSS nominative : `POST /api/declarations/cnss` → table `declarations_cnss` ✅
- Export Excel : `lib/declarations/export-cnss.ts` ✅
- Export PDF : `/api/declarations/cnss/[id]/pdf` ✅
- **Déclaration CNSS est le module le plus complet des déclarations**

**Q8 — Qui paie ?**
- Champ `date_paiement` et `reference_depot` dans declarations_cnss ✅
- Pas de paiement automatisé vers journal_entries

**Q9 — Qui affiche ?**
- Module Déclarations CNSS : interface complète avec lignes nominatives ✅
- Dashboard RH : KPIs masse salariale ✅
- Bulletin individuel : cotisations détaillées ✅

**Q10 — Qui explique ?**
- `auditRH()` : RH002 (sans numéro CNSS), RH003 (sous SMIG)
- MIAA compliance : présumé via bulletins_paie

---

## 5. IS — IMPÔT SUR LES SOCIÉTÉS

**Constat immédiat :** L'IS est le trou noir du moteur fiscal Oraforme.

### État de l'implémentation IS par pays

| Pays | Taux IS | Dans PAYS_CONFIGS.taxes_annuelles | Moteur calculerIS | Déclare | Journalise |
|------|---------|----------------------------------|-------------------|---------|-----------|
| CG (Congo) | 30% | **ABSENT** ❌ | ❌ | ❌ | ❌ |
| CM (Cameroun) | 30% + CAC | notes_importantes uniquement | ❌ | ❌ | ❌ |
| GA (Gabon) | 35% | ✅ (code: 'IS') | ❌ | ❌ | ❌ |
| CD (RDC) | 30% | ✅ (code: 'IBP') | ❌ | ❌ | ❌ |
| AO (Angola) | 25% | ✅ (code: 'IRC') | ❌ | ❌ | ❌ |
| FR (France) | 25% | ✅ (code: 'IS') | ❌ | ❌ | ❌ |
| BE (Belgique) | 25% | ✅ (code: 'ISOC') | ❌ | ❌ | ❌ |
| CH (Suisse) | ~20% | ✅ (code: 'IS') | ❌ | ❌ | ❌ |

**⚠️ ANOMALIE B001 (CRITIQUE) : IS Congo absent de taxes_annuelles**  
Tous les autres pays avec IS l'ont dans taxes_annuelles. Congo-Brazzaville (pays principal d'Oraforme, 30% IS, LF 2026) n'a que Patente et TVTS. IS est invisible dans l'échéancier CG.

### 10 questions — IS

**Q1 — Qui calcule ?**
- **PERSONNE.** La fonction `calculerIS()` n'existe pas dans lib/fiscalite/engine.ts.
- `genererCompteResultat()` lit les comptes `695/691` dans journal_entries (ligne RS "Impôts sur le résultat") mais ces écritures n'existent jamais.

**Q2 — Où est calculé ?**
- **NULLE PART.** Pas de moteur IS dans tout le codebase.
- Référence IS = 30% dans : `lib/fiscalite/pays.ts:CM notes_importantes` ("IS 30% + CAC 10% sur IS = 33% effectif")
- Aucun fichier `lib/fiscalite/is*.ts`
- Aucun fichier `lib/declarations/is*.ts`

**Q3 — Combien de fois ?**
- **0 fois.** L'IS n'est jamais calculé.

**Q4 — Qui lit ?**
- `genererCompteResultat()` : ligne RS lit comptes 695/691 → retourne toujours 0 FCFA ❌
- `genererFluxTresorerie()` : pas de flux IS (section ZC — financement) ❌

**Q5 — Qui écrit ?**
- **PERSONNE.** Aucune écriture IS dans journal_entries.
- Aucun trigger, aucun cron, aucune route API.

**Q6 — Qui comptabilise ?**
- **PERSONNE.**
- Comptes attendus : 695 D (IS) / 441 C (État — IS dû) / puis 441 D / 52x C (paiement)

**Q7 — Qui déclare ?**
- **PERSONNE.** Pas de table `declarations_is`.
- `calculerEcheancier('CG')` → IS absent de l'échéancier Congo ❌
- Seul Gabon/RDC/Angola/France/Belgique/Suisse ont IS dans taxes_annuelles → IS apparaît dans leur échéancier

**Q8 — Qui paie ?**
- **PERSONNE.** Pas de mécanisme de paiement IS.

**Q9 — Qui affiche ?**
- Compte de Résultat → `genererCompteResultat()` → ligne RS = 0 pour tous les tenants ❌
- L'IS affiché dans les états financiers est toujours 0 — le résultat net est toujours le résultat AVANT IS

**Q10 — Qui explique ?**
- `lib/audit/engine.ts` : aucune anomalie IS dans auditFiscal ou auditOHADA ❌
- MIAA : ne peut pas expliquer un IS qui n'existe pas

---

## 6. PATENTE

La Patente est l'impôt professionnel annuel basé sur le Chiffre d'Affaires.

### Configuration Congo (lib/declarations/patente.ts — LF 2026)

```
Barème officiel LF 2026 — 10 tranches (Art. 122 CGI Congo) :
  ≤ 1M FCFA                           → forfait 10,000 FCFA
  1M → 20M                             → 9.75%
  20M → 40M                            → 0.65%
  40M → 100M                           → 0.45%
  100M → 300M                          → 0.20%
  300M → 500M                          → 0.45%  ← taux non dégressif (réévaluation LF 2026)
  500M → 1Mrd                          → 0.14%
  1Mrd → 3Mrd                          → 0.135%
  3Mrd → 20Mrd                         → 0.125%
  > 20Mrd                              → 0.045%

Centimes Additionnels Patente   : 5% sur patente liquidée
CAMU                            : 0.5% sur patente liquidée
Réduction sociétés pétrolières  : 50% (Art. 314 CGI)
Minimum de perception           : 10,000 FCFA (LF 2026, anciennement 50,000 FCFA)
```

### 10 questions — Patente

**Q1 — Qui calcule ?**
- `calculerPatente(caAnnuel, caExonere, estSocietePetroliere, creditN1)` → `lib/declarations/patente.ts:77`
- Recalcul côté serveur au POST `/api/declarations/patente` (source de vérité côté serveur ✅)

**Q2 — Où est calculé ?**
- Lib : `lib/declarations/patente.ts` — barème complet avec BAREME_PATENTE_CG
- API : `app/api/declarations/patente/route.ts:114` — recalcul serveur `calculerPatente()`

**Q3 — Combien de fois ?**
- 1× en front-end (présumé — calcul preview)
- 1× côté serveur (POST route) → résultat stocké dans declarations_patente ✅

**Q4 — Qui lit ?**
- `GET /api/declarations/patente?annee=2026` → `declarations_patente`
- PDF : `GET /api/declarations/patente/pdf`

**Q5 — Qui écrit ?**
- `POST /api/declarations/patente` → UPSERT `declarations_patente` ✅
- **journal_entries : AUCUNE ÉCRITURE Patente** ❌ (compte 641 — Impôts et taxes jamais alimenté)

**Q6 — Qui comptabilise ?**
- **PERSONNE.** La patente payée n'est jamais journalisée.
- Compte attendu : 641 D (Impôts, taxes, versements assimilés) / 441 C

**Q7 — Qui déclare ?**
- Via l'interface déclaration patente → POST route ✅
- Répartition par département Congo (DEPARTEMENTS_CG — 12 départements) ✅
- PDF export intégré ✅

**Q8 — Qui paie ?**
- Champs `date_depot`, `statut` dans declarations_patente
- Pas de paiement automatisé vers journal

**Q9 — Qui affiche ?**
- Interface déclaration patente : formulaire complet (Section A identité, Section B calcul, Section C répartition) ✅
- PDF généré avec `montantEnLettres()` ✅

**Q10 — Qui explique ?**
- `calculerEcheancier('CG')` → PATENTE echéance 31 janvier ✅
- Audit engine : pas de contrôle spécifique patente identifié ❌
- MIAA : présumé via fiscal engine context

---

## 7. TAXES LOCALES ET ANNEXES

### Inventaire par pays (PAYS_CONFIGS.taxes_annuelles)

| Pays | Taxe | Base | Taux/Montant | Échéance |
|------|------|------|-------------|---------|
| CG | Patente | CA | barème LF 2026 | 31/01 |
| CG | TVTS (véhicules) | par véhicule | 50,000 FCFA fixe | 31/03 |
| CM | Droit de Patente | CA | taux ? | 31/01 |
| GA | IS | résultat | 35% | 31/03 |
| CD | IBP | résultat | 30% | 31/03 |
| AO | IRC | résultat | 25% | 31/05 |
| FR | IS + CFE + CVAE | résultat/VA | 25%/fixe/0.5% | variable |
| BE | ISOC | résultat | 25% | 30/09 |
| CH | IS | résultat | ~20% | 31/03 |

**Absence notable :** Aucune taxe locale (taxe municipale, taxe de formation) configurée pour la zone CEMAC. La TVTS Congo est configurée mais sans moteur de calcul.

### 10 questions — Taxes Locales

**Q1 — Qui calcule ?** TVTS Congo : montant fixe 50,000 FCFA par véhicule (pas de calcul, juste un montant). Patente : `calculerPatente()`. IS (autres pays) : **non calculé**.

**Q2 — Où ?** Uniquement dans `calculerEcheancier()` → retourne les échéances. Pas de moteur de calcul local.

**Q3 — Combien de fois ?** 1× lors de l'affichage de l'échéancier. Pas de calcul récurrent automatisé.

**Q4/Q5/Q6 — Qui lit/écrit/comptabilise ?** Aucun mécanisme actif. `declarations_generales` ne couvre pas TVTS.

**Q7 — Qui déclare ?** Patente → déclaration dédiée. TVTS → pas de déclaration dédiée. IS autres pays → pas de déclaration dédiée.

**Q8-Q10 :** Pas de paiement, pas d'affichage séparé, pas d'explication dédiée.

---

## 8. EXONÉRATIONS

### Exonérations identifiées

| Type | Implémenté | Localisation |
|------|-----------|-------------|
| CA exonéré Patente | ✅ | declarations/patente.ts — champ ca_exonere |
| Réduction pétrolière Patente | ✅ | patente.ts:TAUX_REDUCTION_PETROLIERE = 50% |
| Seuil assujettissement TVA | ✅ | PAYS_CONFIGS.tva.seuil_assujettissement |
| Exonérations IRPP (indemnités) | ❌ | Non implémentées |
| Exonérations IS (agriculture) | ❌ | Non implémentées |
| Taux réduit TVA (produits sociaux) | ❌ | ConfigTVA.taux_reduit non utilisé |

**Q1-Q10 résumé :** Les exonérations fiscales générales (indemnités, agriculture, régimes spéciaux CEMAC) ne sont pas modélisées. Seules les exonérations patente ont une implémentation partielle.

---

## 9. RETENUES À LA SOURCE

### Retenues identifiées

| Type | Implémenté | Localisation |
|------|-----------|-------------|
| IRPP retenu à la source (bulletin) | ✅ Calcul | calculerIRPP(), bulletins_paie.irpp |
| IRPP → journal (compte 447) | ❌ Non journalisé | Trigger absent |
| CNSS salarié retenu | ✅ Calcul | bulletins_paie.cnss_salarie |
| CNSS salarié → journal (compte 431) | ❌ Non journalisé | Trigger absent |
| Retenues marché (AIB Cameroun 2/5%) | ❌ Absent | Non implémenté |
| Retenues dividendes | ❌ Absent | Non implémenté |
| Retenues honoraires/loyers | ❌ Absent | Non implémenté |
| WHT Nigeria | ❌ Absent | Non implémenté |

**Q6 — Qui comptabilise ?** PERSONNE pour IRPP et CNSS retenus.

---

## 10. DÉCLARATIONS FISCALES

### Inventaire des tables et APIs de déclarations

| Déclaration | Table DB | API | PDF | Pré-remplissage | Source données |
|-------------|----------|-----|-----|-----------------|----------------|
| DGI mensuelle (TVA+IRPP+TUS) | `declarations_generales` | POST /api/declarations/mensuelle | ✅ | ✅ preRemplirDeclaration | **factures + bulletins** |
| CNSS nominative | `declarations_cnss` + `declarations_cnss_lignes` | POST /api/declarations/cnss | ✅ | ✅ (cnss/preremplir) | bulletins_paie → recalcul |
| Patente annuelle | `declarations_patente` | POST /api/declarations/patente | ✅ | partiel (prefill config) | ca_annuel saisi manuellement |
| IS | ❌ inexistante | ❌ | ❌ | ❌ | — |
| TVTS | ❌ inexistante | ❌ | ❌ | ❌ | — |

### Statuts de déclaration

```typescript
// declarations_generales : statut non formalisé (champ libre)
// declarations_cnss.statut : 'brouillon'|'validee'|'deposee'|'payee'|'annulee'
// declarations_patente.statut : 'brouillon'|'complete'|'soumise'
// fiscal_declarations (types.ts FiscalDeclaration) :
//   StatutDeclaration = 'a_faire'|'en_cours'|'deposee'|'payee'|'en_retard'|'contestee'
// → 4 systèmes de statuts différents, non harmonisés ⚠️
```

### Liens déclarations ↔ Journal

| Déclaration | Écriture journal au dépôt | Écriture journal au paiement |
|-------------|--------------------------|------------------------------|
| TVA mensuelle | ❌ ABSENT | ❌ ABSENT |
| CNSS | ❌ ABSENT | ❌ ABSENT |
| Patente | ❌ ABSENT | ❌ ABSENT |
| IS | ❌ ABSENT (IS absent) | ❌ ABSENT |

**Résultat : Aucune déclaration ne génère d'écriture comptable automatique.**

---

# PARTIE II — FISCAL FLOWS

---

## 11. FLOW A — Facture → Fiscal → Journal → Reporting

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FLOW A : FACTURATION FISCALE (état réel vs état attendu)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

ÉTAT RÉEL ─────────────────────────────────────────────────────────────────────

┌──────────────────────────────────────────────────────────────────────────────┐
│  1. Création Facture                                                          │
│     POST /api/invoice/create                                                 │
│     → INSERT factures {                                                      │
│         montant_ht, tva (taux 18), tva_montant (18%), ca (5% CA),           │
│         total (HT + TVA + CA), statut='envoyee'                             │
│       }                                                                      │
├──────────────────────────────────────────────────────────────────────────────┤
│  2. TVA → Journal (TRIGGER fn_facture_issued_to_journal)                    │
│     ✅ Écriture 1 : 411000 D / 706000 C  (montant HT)                       │
│     ✅ Écriture 2 : 706000 D / 4441xx C  (montant TVA)                      │
│     ❌ Écriture 3 : manquante pour CA    (montant CA = tva × 0.05)         │
├──────────────────────────────────────────────────────────────────────────────┤
│  3. Centime Additionnel → Journal                                            │
│     ❌ ABSENT — factures.ca non lu par fn_facture_issued                    │
│     → Compte 443-CA jamais crédité                                          │
├──────────────────────────────────────────────────────────────────────────────┤
│  4. Accounting Event : statut='payee'                                        │
│     ✅ Écriture 4 : 5xx D / 411000 C  (total facture payée)                 │
│     ✅ INSERT transactions (entrée trésorerie)                               │
├──────────────────────────────────────────────────────────────────────────────┤
│  5. Grand Livre / TVA API                                                    │
│     GET /api/fiscalite/tva → computeTVAFromJournal(journal_entries)         │
│     → Lit comptes 4441/4442 (collectée) et 4445/4446 (déductible)          │
│     → TVA nette calculée = TVA collectée en journal - TVA déductible       │
│     ⚠️  CA non inclus (absent du journal)                                   │
├──────────────────────────────────────────────────────────────────────────────┤
│  6. Déclaration TVA (DGI mensuelle)                                         │
│     GET /api/declarations/mensuelle?preRemplir=true                         │
│     → preRemplirDeclaration() lit FACTURES (pas le journal)                 │
│     → tvaCollectee = Σ(factures.tva_rate × factures.montant_ht)            │
│     → centimesAdditionnels = tvaCollectee × 0.05                           │
│     ⚠️  SOURCE DIFFÉRENTE du Grand Livre (divergence possible)              │
├──────────────────────────────────────────────────────────────────────────────┤
│  7. Finance (Trésorerie)                                                     │
│     ✅ transactions alimentées à chaque paiement                             │
│     ⚠️  solde trésorerie correct mais IS non provisionnés                   │
├──────────────────────────────────────────────────────────────────────────────┤
│  8. Audit                                                                    │
│     auditFiscal() → T003 (TVA trimestriel ?), T004 (sans TVA)              │
│     ⚠️  Audit détecte mois [1,4,7,10] → trimestriel alors que mensuel       │
│     ⚠️  Audit lit factures.tva (taux, pas montant) → approximation          │
├──────────────────────────────────────────────────────────────────────────────┤
│  9. Reporting / BI                                                           │
│     Compte de Résultat → ligne TVA collectée depuis journal (4441) ✅       │
│     Bilan → dettes fiscales (441) → CA absent → sous-estimé ❌              │
├──────────────────────────────────────────────────────────────────────────────┤
│ 10. MIAA                                                                     │
│     computeGrandLivre → comptes TVA → MIAA peut expliquer TVA ✅            │
│     MIAA ne voit pas le CA (non journalisé) ❌                               │
└──────────────────────────────────────────────────────────────────────────────┘

ÉTAT ATTENDU (flow fiscal complet) ──────────────────────────────────────────

Créer facture
  ↓
  calculerTVAFromHT(montantHT, 'CG')
  → { ht, tva=HT×18%, ca=TVA×5%, ttc=HT+TVA+CA }
  ↓
  INSERT factures (montant_ht, tva_montant, ca, total=ttc, statut='envoyee')
  ↓
  [TRIGGER] fn_facture_issued_to_journal() AMÉLIORÉ
  ① journal_entries : 411 D / 706 C  (HT)
  ② journal_entries : 706 D / 4441 C (TVA 18%)
  ③ journal_entries : 706 D / 4441-CA C (CA 5%)    ← MANQUANT
  ↓
  statut → 'payee'
  [TRIGGER] fn_facture_paid_to_journal()
  ④ journal_entries : 5xx D / 411 C (total TTC)
  ⑤ INSERT transactions
  ↓
  Déclaration TVA mensuelle
  computeTVAFromJournal(journal, year, mois)
  → TVA = Σ crédit 4441 = TVA + CA ← cohérent si ③ présent
  ↓
  Déclaration DGI POST /mensuelle
  → l3_tva = Σ 4441 depuis journal  ← cohérent avec Grand Livre
  ↓
  Écriture paiement TVA (non automatisé — action manuelle)
  ⑥ journal_entries : 4441 D / 52x C (paiement TVA + CA)
  ↓
  Grand Livre 4441 soldé ✅
  ↓
  Bilan : dettes fiscales clôturées ✅
  ↓
  IS calculé en fin d'exercice (ABSENT actuellement)
```

---

## 12. FLOW B — Paie → Cotisations → Journal → Déclarations

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FLOW B : PAIE FISCALE (état réel vs état attendu)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

ÉTAT RÉEL ─────────────────────────────────────────────────────────────────────

┌──────────────────────────────────────────────────────────────────────────────┐
│  1. Génération Bulletin                                                       │
│     POST /api/hr/payroll/generate                                            │
│     lib/paie/calcul-paie.ts (INTOUCHABLE)                                   │
│     → brut, cnss_salarie (4%), cnss_patronal (20.285%), irpp (barème), net  │
│     → INSERT bulletins_paie { brut, cnss_salarie, cnss_patronal, irpp, net } │
├──────────────────────────────────────────────────────────────────────────────┤
│  2. CNSS → Journal                                                           │
│     ❌ ABSENT — aucun trigger sur bulletins_paie                             │
│     → Comptes 431 (CNSS), 661 (charges personnel) jamais alimentés          │
├──────────────────────────────────────────────────────────────────────────────┤
│  3. IRPP → Journal                                                           │
│     ❌ ABSENT — aucun trigger sur bulletins_paie                             │
│     → Compte 447 (IRPP retenu) jamais alimenté                              │
├──────────────────────────────────────────────────────────────────────────────┤
│  4. Déclaration CNSS                                                         │
│     POST /api/declarations/cnss                                              │
│     → calculerCNSSEmploye() RECALCULE (pas de lecture bulletins_paie.cnss)  │
│     ⚠️  Double calcul — risque divergence si taux changés entre générations  │
│     → UPSERT declarations_cnss + declarations_cnss_lignes ✅                │
│     → Export PDF/Excel disponibles ✅                                        │
├──────────────────────────────────────────────────────────────────────────────┤
│  5. Déclaration DGI mensuelle (IRPP + TUS)                                  │
│     preRemplirDeclaration()                                                  │
│     → l8_irpp_salaires = Σ(bulletins_paie.irpp) ✅                          │
│     → l9_tus = Σ(bulletins_paie.brut) × 0.045  ← ⚠️ TAUX ERRONÉ (4.5%)   │
│     (TUS Fiscale abolie LF 2026 — taux correct = 0% ou 3% CNSS seulement)  │
├──────────────────────────────────────────────────────────────────────────────┤
│  6. Paiement CNSS/IRPP                                                       │
│     Statuts tracés dans declarations_cnss.statut = 'payee'                 │
│     ❌ Aucune écriture journal (431 D / 52x C, 447 D / 52x C)               │
├──────────────────────────────────────────────────────────────────────────────┤
│  7. Audit                                                                    │
│     auditRH() → RH002 (sans CNSS), RH003 (sous SMIG 90K — valeur erronée)  │
│     ⚠️  SMIG audit = 90,000 FCFA (arrêté 2020) vs LF 2026 = 70,400 FCFA   │
└──────────────────────────────────────────────────────────────────────────────┘

ÉTAT ATTENDU (flow paie fiscal complet) ─────────────────────────────────────

Générer bulletin
  ↓
  calcul-paie.ts → { brut, cnss_salarie, cnss_patronal, irpp, net }
  ↓
  INSERT bulletins_paie (statut='generee')
  ↓
  Validation directeur → statut='validee'
  ↓
  [TRIGGER] fn_paie_to_journal() sur statut→'payee'  ← MANQUANT
  ① journal_entries : 661 D / 421 C   (net à payer salarié)
  ② journal_entries : 661 D / 431 C   (CNSS sal + pat)
  ③ journal_entries : 661 D / 447 C   (IRPP retenu)
  ↓
  Déclaration CNSS depuis bulletins_paie (pas de recalcul)
  computeCNSSSummary(bulletins) → chiffres bulletins = déclaration ✅
  ↓
  Déclaration DGI IRPP
  computeIRPPSummary(bulletins) → l8_irpp ✅
  TUS = 0 (supprimé LF 2026) ou CNSS TUS depuis bulletin = 3% sur brut
  ↓
  Paiement CNSS (avant le 15 M+1)
  ④ journal_entries : 431 D / 52x C   (paiement CNSS)
  ↓
  Paiement IRPP (avant le 20 M+1)
  ⑤ journal_entries : 447 D / 52x C   (paiement IRPP)
  ↓
  Grand Livre : 431 soldé, 447 soldé ✅
  Compte de Résultat : 661 (Charges de personnel) alimenté ✅
  Bilan : passif social (431, 447) soldé après paiements ✅
```

---

## 13. FLOW C — Clôture Annuelle → IS → États Financiers

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FLOW C : CLÔTURE ANNUELLE / IS (état réel vs état attendu)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

ÉTAT RÉEL ─────────────────────────────────────────────────────────────────────

┌──────────────────────────────────────────────────────────────────────────────┐
│  1. Résultat avant IS                                                         │
│     genererCompteResultat(ecritures, exercice)                               │
│     → resultatAO = Σ produits - Σ charges (sans 695/IRPP)                  │
│     ⚠️  Charges personnel = 0 (paie non journalisée)                         │
│     ⚠️  Stocks = 0 (stock non journalisé)                                    │
│     → resultatAvantIS = resultatAO + resultatHAO                            │
├──────────────────────────────────────────────────────────────────────────────┤
│  2. Calcul IS                                                                 │
│     ❌ ABSENT — calculerIS() n'existe pas                                    │
│     → Ligne RS (compte 695) = 0 toujours                                    │
│     → resultatNet = resultatAvantIS - 0 = resultatAvantIS (AVANT IS)        │
├──────────────────────────────────────────────────────────────────────────────┤
│  3. Provision IS trimestrielle                                                │
│     ❌ ABSENT — aucun cron/trigger                                            │
│     → Compte 695 (IS) toujours à 0                                          │
│     → Compte 441 (État — IS dû) toujours à 0                               │
├──────────────────────────────────────────────────────────────────────────────┤
│  4. Écriture IS                                                               │
│     ❌ ABSENT — aucune écriture journal IS                                    │
├──────────────────────────────────────────────────────────────────────────────┤
│  5. Paiement IS                                                               │
│     ❌ ABSENT — ni route API, ni interface, ni écriture                       │
├──────────────────────────────────────────────────────────────────────────────┤
│  6. États Financiers                                                          │
│     Bilan     : généré ✅ mais incomplet (sans IS, sans paie, sans stock)   │
│     CR        : généré ✅ mais IS = 0, Résultat Net = Résultat AVANT IS     │
│     Flux Tres.: généré ✅ mais IS absent de la section ZA (activités)       │
│     TAFIRE    : non implémenté ❌ (Tableau OHADA obligatoire)                │
├──────────────────────────────────────────────────────────────────────────────┤
│  7. Clôture exercice                                                          │
│     fiscal_years.statut = 'ouvert' → 'cloture' (action admin)              │
│     ⚠️  Pas de contrôles automatiques avant clôture (équilibre, IS, etc.)   │
└──────────────────────────────────────────────────────────────────────────────┘

ÉTAT ATTENDU (flow IS complet) ──────────────────────────────────────────────

Clôture d'exercice (31 décembre)
  ↓
  Résultat brut avant IS = Σ(journal_entries classes 6+8) - Σ(classes 7+8)
  ↓
  calculerIS(resultatBrut, 'CG')  ← FONCTION MANQUANTE
  → IS = resultatBrut × 30%
  → Minimum perception = max(IS, 1% du CA HT)
  ↓
  Provisions IS trimestrielles (avances)
  T1 (31 mars)  : ① journal_entries 695 D / 441 C  (IS Q1 estimé)
  T2 (30 juin)  : ② journal_entries 695 D / 441 C  (IS Q2 estimé)
  T3 (30 sept.) : ③ journal_entries 695 D / 441 C  (IS Q3 estimé)
  T4 (31 déc.)  : ④ journal_entries 695 D / 441 C  (IS Q4 régularisation)
  ↓
  Déclaration IS annuelle
  POST /api/declarations/is  ← ROUTE MANQUANTE
  → UPSERT declarations_is  ← TABLE MANQUANTE
  ↓
  Paiement IS (avant 30 avril N+1 pour Congo)
  ⑤ journal_entries : 441 D / 52x C  (paiement IS)
  ↓
  États Financiers corrects
  Compte de Résultat → ligne RS = IS réel ≠ 0 ✅
  resultatNet = resultatAvantIS - IS ✅
  Bilan → passif fiscal (441 IS) soldé ✅
  Flux trésorerie → décaissement IS en ZA ✅
  ↓
  Clôture exercice fiscal_years.statut = 'cloture'
  Contrôles d'intégrité : Bilan équilibré ? IS payé ? Liasses fiscales complètes ?
```

---

# PARTIE III — ANALYSE CRITIQUE

---

## 14. COMPARATIF SOURCES DE DONNÉES

### Divergence TVA

```
SOURCE 1 : factures.tva × factures.montant_ht
  Utilisé par : preRemplirDeclaration() → l3_tva
  → Calcul appliqué : factures.tva (taux entier ex. 18) / 100 × factures.montant_ht
  → CA calculé : l3_tva_centimes = l3_tva × 0.05

SOURCE 2 : journal_entries comptes 4441/4442
  Utilisé par : computeTVAFromJournal() → /api/fiscalite/tva
  → Agrégation : Σ crédit sur comptes ['4441','4442','441','441000']
  → CA : non inclus (absent du journal)

SOURCE 3 : factures.tva (champ = taux, pas montant)
  Utilisé par : auditFiscal() T004
  → Compare factures.tva à null pour détecter factures sans TVA
  → Utilisation du champ taux (18) comme indicateur, pas comme montant

→ RISQUE : decl DGI (Source 1) ≠ Grand Livre (Source 2) dans les cas de :
  - factures émises non journalisées (trigger en échec)
  - écritures manuelles journal sans facture correspondante
  - avoirs / notes de crédit
```

### Divergence CNSS

```
SOURCE A : bulletins_paie.cnss_salarie + bulletins_paie.cnss_patronal
  Utilisé par : computeCNSSSummary() → dashboard fiscal

SOURCE B : calculerCNSSEmploye(employe.salaire_brut) recalcul serveur
  Utilisé par : POST /api/declarations/cnss
  → Taux : PLAFOND_VIEILLESSE=1.2M, PLAFOND_AT_MP_PF=600K

→ RISQUE : Si salaire_brut modifié après génération bulletin, Source A ≠ Source B
```

### Divergence TUS

```
SOURCE X : calcul-paie.ts → TAUX_TUS = 0.03 (3% CNSS contribution)
SOURCE Y : declaration-generale.ts:70 → salaireBrut × 0.045 (4.5% TUS Fiscale abolie)

→ IMPACT : La déclaration DGI (l9_tus) inclut une taxe abolie par LF 2026
  → Surévaluation de la ligne TUS dans chaque déclaration mensuelle post-01/01/2026
```

---

## 15. INCOHÉRENCES INTER-MODULES

| # | Module A | Module B | Incohérence | Sévérité |
|---|---------|---------|-------------|---------|
| I-01 | calcul-paie.ts (TAUX_TUS=3%) | declaration-generale.ts (TUS=4.5%) | TUS fiscale abolie utilisée | **CRITIQUE** |
| I-02 | pays.ts:CG (TVA mensuelle) | audit/engine.ts (vérifie trimestriel [1,4,7,10]) | Périodicité contradictoire | **MAJEURE** |
| I-03 | computeTVAFromJournal (Grand Livre) | preRemplirDeclaration (factures) | Sources TVA divergentes | **MAJEURE** |
| I-04 | cnss-congo.ts (PLAFOND_AT_MP_PF=600K) | calcul-paie.ts (PLAFOND_AF=1.2M) | Plafond AF différent | **MAJEURE** |
| I-05 | audit/engine.ts (SMIG=90K) | fiscalite/pays.ts (SMIG=70.4K via skill) | SMIG Congo incohérent | **MAJEURE** |
| I-06 | pays.ts:CM (tva=0.1925) | skill fiscalite-cemac (TVA CM=17.5%) | Taux TVA Cameroun faux | **MAJEURE** |
| I-07 | declarations_cnss (recalcul) | bulletins_paie (calcul original) | Double calcul CNSS | **MODÉRÉE** |
| I-08 | pays.ts:CG (pas d'IS dans taxes_annuelles) | autres pays (IS dans taxes_annuelles) | IS Congo absent calendrier | **CRITIQUE** |
| I-09 | types.ts (FiscalDeclaration.StatutDeclaration) | declarations_cnss.statut | 2 systèmes de statuts | **MINEURE** |
| I-10 | genererCompteResultat (IS=0 toujours) | calcul-paie.ts (TUS/CNSS inclus bulletin) | Charges fiscales absentes CR | **CRITIQUE** |

---

## 16. LISTE DES ANOMALIES F-005

| Code | Impôt | Titre | Niveau | Fichier |
|------|-------|-------|--------|---------|
| **B001** | IS | IS absent de taxes_annuelles CG → absent calendrier fiscal Congo | **🔴 CRITIQUE** | lib/fiscalite/pays.ts:CG |
| **B002** | TVA | Deux sources TVA divergentes : factures (déclaration) ≠ journal (Grand Livre) | **🔴 CRITIQUE** | declaration-generale.ts vs accounting.ts |
| **B003** | TUS | TUS Fiscale 4.5% dans déclaration DGI alors qu'abolie par LF 2026 | **🔴 CRITIQUE** | lib/declarations/declaration-generale.ts:70 |
| **B004** | IRPP | IRPP calculé et déclaré mais jamais journalisé (compte 447 vide) | **🟠 MAJEURE** | Trigger absent bulletins_paie |
| **B005** | CNSS | CNSS calculée et déclarée mais jamais journalisée (comptes 431/661 vides) | **🟠 MAJEURE** | Trigger absent bulletins_paie |
| **B006** | CNSS | Déclaration CNSS recalcule depuis salaire_brut au lieu de lire bulletins_paie | **🟠 MAJEURE** | app/api/declarations/cnss/route.ts:78 |
| **B007** | TVA | auditFiscal vérifie TVA trimestrielle [1,4,7,10] alors que Congo = mensuel | **🟠 MAJEURE** | lib/audit/engine.ts:330 |
| **B008** | CNSS | Plafond AF incohérent : cnss-congo.ts=600K vs calcul-paie.ts=1.2M | **🟠 MAJEURE** | cnss-congo.ts vs calcul-paie.ts |
| **B009** | TVA | computeTVAFromJournal account '441' peut matcher sous-comptes 4410/4411 | **🟡 MODÉRÉE** | lib/erp-core/compute/accounting.ts:102 |
| **B010** | Décl. | 4 systèmes de statuts déclarations non harmonisés | **🟡 MODÉRÉE** | types.ts vs cnss vs patente vs generale |
| **B011** | Patente | Patente journalisée nulle part (compte 641 vide après paiement) | **🟡 MODÉRÉE** | Trigger absent |
| **B012** | IS | TAFIRE (Tableau OHADA) non implémenté — 4ème état financier obligatoire | **🟡 MODÉRÉE** | lib/syscohada/etats-financiers.ts |
| **B013** | TVA | Compte TVA déductible (4445/4446) : quel trigger les alimente ? Non identifié | **🟡 MODÉRÉE** | lib/erp-core/compute/accounting.ts |
| **B014** | IRPP | IRPP CM : CAC 10% intégré dans tranches — moteur ne décompose pas CAC/IRPP | **⚪ MINEURE** | lib/fiscalite/pays.ts:CM |
| **B015** | Exon. | Aucun framework d'exonérations fiscales générales (régimes spéciaux) | **⚪ MINEURE** | lib/fiscalite/ — absent |

**Rappel anomalies ESC-01 maintenant confirmées :**
- **A001** (CRITIQUE) : CA non journalisé — confirmé B002
- **A002** (CRITIQUE) : IS absent — confirmé B001 + aggravé (IS aussi absent de taxes_annuelles CG)
- **A003** (MAJEURE) : TVA CM 19.25% — confirmé I-06
- **A004** (MAJEURE) : SMIG 90K — confirmé I-05

---

## 17. CLASSEMENT PAR CRITICITÉ

### 🔴 CRITIQUE — Auto-refus FCI (3 anomalies + 2 héritées ESC-01)

| # | Code | Anomalie |
|---|------|---------|
| 1 | **B003** | TUS Fiscale 4.5% utilisée dans déclaration DGI alors qu'abolie par LF 2026 |
| 2 | **B001** | IS Congo absent de l'échéancier fiscal |
| 3 | **B002** | Déclaration TVA (factures) ≠ Grand Livre (journal) |
| 4 | **A001** | CA Congo non journalisé |
| 5 | **A002** | IS sans moteur de calcul |

### 🟠 MAJEURE — Bloque FCI PASS (5 anomalies + 3 héritées)

| # | Code | Anomalie |
|---|------|---------|
| 6 | B004 | IRPP jamais journalisé (compte 447) |
| 7 | B005 | CNSS jamais journalisée (comptes 431/661) |
| 8 | B006 | Déclaration CNSS recalcule au lieu de lire bulletins |
| 9 | B007 | Audit vérifie TVA trimestrielle alors que Congo = mensuel |
| 10 | B008 | Plafond AF incohérent entre cnss-congo et calcul-paie |
| 11 | A003 | TVA Cameroun 19.25% au lieu de 17.5% |
| 12 | A004 | SMIG Congo 90K vs 70.4K |
| 13 | A005 | Paie sans journal entries (flow B absent) |

### 🟡 MODÉRÉE — Backlog prioritaire

| # | Code | Anomalie |
|---|------|---------|
| 14 | B009 | account '441' peut matcher sous-comptes |
| 15 | B010 | Statuts déclarations non harmonisés |
| 16 | B011 | Patente non journalisée |
| 17 | B012 | TAFIRE non implémenté |
| 18 | B013 | TVA déductible : trigger source non identifié |

### ⚪ MINEURE

| # | Code | Anomalie |
|---|------|---------|
| 19 | B014 | IRPP CM CAC non décomposé |
| 20 | B015 | Framework exonérations absent |

---

## 18. ROOT CAUSE FISCAL REPORT

### RCF-001 : TUS Fiscale 4.5% dans déclaration mensuelle [→ B003 CRITIQUE]

**Cause racine :** La LF 2026 (Loi n°42-2025 du 31/12/2025) a supprimé la "TUS Fiscale" de 4.5% perçue par la DGI, distincte du "TUS CNSS" de 3% inclus dans les cotisations patronales. Le fichier `lib/declarations/declaration-generale.ts:70` contient `salaireBrut × 0.045` avec le commentaire "TUS = 4.5%". Le fichier `lib/paie/calcul-paie.ts` (INTOUCHABLE) mentionne explicitement "TUS Fiscale 4,5% supprimée" mais ce correctif n'a pas été propagé à declaration-generale.ts.

**Impact :** Chaque déclaration DGI mensuelle depuis le 01/01/2026 surdéclare la ligne TUS. Risque : les tenants Congo paient une taxe abolie. Montant : 4.5% × masse salariale sur chaque déclaration mensuelle.

**Chemin de correction :** Ligne 70 de `lib/declarations/declaration-generale.ts` → remplacer `salaireBrut * 0.045` par `0` (ou par le TUS CNSS 3% inclus dans bulletins_paie.cnss_patronal si la déclaration DGI doit l'inclure).

---

### RCF-002 : Deux sources TVA divergentes [→ B002 CRITIQUE]

**Cause racine :** Deux architectures de lecture TVA coexistent et ne se synchronisent pas :
1. `preRemplirDeclaration()` (créé pour la déclaration DGI) lit `factures` directement
2. `computeTVAFromJournal()` (créé pour le Grand Livre/reporting) lit `journal_entries`

La déclaration DGI devrait être basée sur le Grand Livre (journal_entries) pour respecter le principe de cohérence comptable OHADA. La TVA du Grand Livre est la TVA certifiée — la déclaration DGI doit en être une projection fidèle.

**Impact :** En cas de factures sans écritures journal correspondantes (bug trigger, migration partielle), la TVA déclarée à la DGI ≠ TVA dans le Grand Livre → risque de contrôle fiscal avec écart inexplicable.

---

### RCF-003 : IS Congo absent de l'échéancier [→ B001 CRITIQUE]

**Cause racine :** `PAYS_CONFIGS['CG'].taxes_annuelles` contient Patente et TVTS mais pas IS. Lors de l'implémentation du moteur fiscal, IS Congo a été omis de la configuration. `calculerEcheancier('CG')` ne retourne donc jamais d'échéance IS pour les tenants Congo. Conséquence : les entreprises congolaises utilisatrices d'Oraforme ne voient pas IS dans leur calendrier fiscal et risquent de manquer la date limite (30 avril N+1).

---

### RCF-004 : Plafond AF CNSS incohérent [→ B008 MAJEURE]

**Cause racine :** Deux valeurs pour le plafond des Allocations Familiales Congo :
- `lib/declarations/cnss-congo.ts` : `PLAFOND_AT_MP_PF = 600_000` — appliqué à AT ET AF ensemble
- `lib/paie/calcul-paie.ts` : `PLAFOND_AF = 1_200_000` — plafond AF = 1.2M (même que VID)

La LF 2026 Art. des modalités CNSS Congo indique que le plafond VID est 1.2M et le plafond AT est 600K. Les AF (Allocations Familiales) sont distinctes. La valeur dans cnss-congo.ts regroupe AT+MP+PF sous le même plafond 600K, sous-évaluant potentiellement les AF patronales.

---

## 19. ORDRE DE RECONSTRUCTION FISCAL

```
════════════════════════════════════════════════════════════════════════
SPRINT RF-1 — CORRECTIONS CRITIQUES (2-3 jours)
════════════════════════════════════════════════════════════════════════

RF-1.1 — Corriger TUS dans declaration-generale.ts [B003]
  Fichier : lib/declarations/declaration-generale.ts:70
  Action  : remplacer `salaireBrut * 0.045` par `0`
            (TUS Fiscale abolie LF 2026 — vérifier si la ligne doit disparaître)
  Impact  : Déclarations DGI mensuelles conformes LF 2026

RF-1.2 — Ajouter IS Congo dans taxes_annuelles [B001]
  Fichier : lib/fiscalite/pays.ts → CG.taxes_annuelles
  Action  : Ajouter { code: 'IS', nom: 'Impôt sur les Sociétés (30%)',
              base: 'résultat', taux: 0.30, echeance_mois: 4, echeance_jour: 30 }
  Impact  : calculerEcheancier('CG') inclut désormais l'IS — alerte avant le 30/04

RF-1.3 — Corriger fn_facture_issued_to_journal (CA Congo) [A001]
  Fichier : SQL Supabase Editor (CREATE OR REPLACE FUNCTION)
  Action  : Lire NEW.ca, INSERT journal_entries si NEW.ca > 0
  Impact  : Grand Livre TVA = Déclaration TVA (convergence sources B002 partielle)

RF-1.4 — Créer calculerIS() [A002]
  Fichier : lib/fiscalite/engine.ts
  Action  : function calculerIS(resultatBrut: number, pays: PaysFiscal): number
            → cfg.taxes_annuelles.find(t => t.code === 'IS')?.taux ?? 0
            → IS = Math.max(resultatBrut × taux, minimum_perception)
  Impact  : genererCompteResultat() peut calculer IS réel

════════════════════════════════════════════════════════════════════════
SPRINT RF-2 — CONVERGENCE SOURCES TVA (1-2 jours)
════════════════════════════════════════════════════════════════════════

RF-2.1 — Modifier preRemplirDeclaration() pour lire journal [B002]
  Fichier : lib/declarations/declaration-generale.ts
  Action  : Remplacer lecture `factures` par appel `computeTVAFromJournal()`
            → Source unique = journal_entries = Grand Livre = Déclaration DGI
  Impact  : Cohérence parfaite déclaration ↔ Grand Livre

RF-2.2 — Corriger plafond AF dans cnss-congo.ts [B008]
  Fichier : lib/declarations/cnss-congo.ts
  Action  : Vérifier art. CNSS LF 2026 sur plafond AF vs AT
            Corriger PLAFOND_AT_MP_PF ou ajouter PLAFOND_AF_SEPARÉ si nécessaire

════════════════════════════════════════════════════════════════════════
SPRINT RF-3 — JOURNALISATION FISCALE (3-5 jours)
════════════════════════════════════════════════════════════════════════

RF-3.1 — Créer fn_paie_to_journal() [A005/B004/B005]
  Trigger AFTER UPDATE ON bulletins_paie WHEN statut→'payee'
  ① 661 D / 421 C  (net à payer)
  ② 661 D / 431 C  (CNSS sal+pat)
  ③ 661 D / 447 C  (IRPP)
  Impact  : Bilan passif social + CR charges personnel alimentés

RF-3.2 — Créer fn_is_to_journal() + cron trimestriel [A002]
  Prérequis : RF-1.4 (calculerIS)
  Trigger/cron : calculerIS(resultatBrut, pays) → INSERT 695 D / 441 C

RF-3.3 — Lecture bulletins dans déclaration CNSS [B006]
  Fichier : app/api/declarations/cnss/route.ts:78
  Action  : Remplacer calculerCNSSEmploye() par lecture bulletins_paie.cnss_*
            (calculerCNSSEmploye pour preview seulement, pas pour persistance)

════════════════════════════════════════════════════════════════════════
SPRINT RF-4 — HARMONISATION (1-2 jours)
════════════════════════════════════════════════════════════════════════

RF-4.1 — Corriger audit trimestriel → mensuel [B007]
  Fichier : lib/audit/engine.ts:330
  Action  : Remplacer `moisTVA = [1,4,7,10]` par vérification `pays.tva.regime`
            → si 'mensuel' : vérifier chaque mois après le 20
            → si 'trimestriel' : [1,4,7,10] (Suisse uniquement)

RF-4.2 — Harmoniser statuts déclarations [B010]
  Action  : Adopter FiscalDeclaration.StatutDeclaration comme standard unique
            Migrer declarations_cnss.statut et declarations_patente.statut

RF-4.3 — Corriger TVA Cameroun 17.5% [A003]
  Fichier : lib/fiscalite/pays.ts:CM
  Action  : tva_normal: 0.175 + ajouter taxes_additionnelles CAC 10%
```

---

## 20. CERTIFICATION FCI

```
╔══════════════════════════════════════════════════════════════════════════════╗
║                                                                              ║
║        F-005 — FISCAL CORE CERTIFICATION — RAPPORT OFFICIEL                ║
║                                                                              ║
║  Projet    : Oraforme ERP — Module Fiscal CEMAC/OHADA                       ║
║  Date      : 2026-06-30                                                      ║
║  Périmètre : 10 impôts/taxes, 15 anomalies, 3 flows, 10 incohérences       ║
║                                                                              ║
╠══════════════════════════════════════════════════════════════════════════════╣
║                                                                              ║
║  SCORES FCI                                                                  ║
║  ──────────                                                                  ║
║  TVA              62 / 100   (taux CG correct, CG mensuel vs audit trim.)   ║
║  Centime Add.     28 / 100   (calculé, pas journalisé, pas en Grand Livre)  ║
║  IRPP             65 / 100   (calculé + déclaré, pas journalisé)            ║
║  CNSS             70 / 100   (déclaration complète, double calcul, pas GL)  ║
║  IS                8 / 100   (absent CG, absent moteur, 0 journalisé)       ║
║  Patente          80 / 100   (barème complet LF 2026, pas journalisée)      ║
║  Déclarations     55 / 100   (3 tables, pas IS, TUS erroné, sources diff.)  ║
║  Journal          28 / 100   (TVA partielle, CA absent, paie/IS/stock=0)    ║
║  Accounting Ev.   32 / 100   (2 events facture, 0 paie, 0 IS, 0 patente)   ║
║                                                                              ║
║  FCI GLOBAL  :  48 / 100                                                    ║
║                                                                              ║
╠══════════════════════════════════════════════════════════════════════════════╣
║                                                                              ║
║  ANOMALIES                                                                   ║
║  ─────────                                                                   ║
║  🔴 CRITIQUE  :  5  (B001, B002, B003, A001 hérité, A002 hérité)           ║
║  🟠 MAJEURE   :  8  (B004, B005, B006, B007, B008, A003, A004, A005)       ║
║  🟡 MODÉRÉE   :  5  (B009, B010, B011, B012, B013)                         ║
║  ⚪  MINEURE   :  2  (B014, B015)                                            ║
║  TOTAL        : 20                                                           ║
║                                                                              ║
╠══════════════════════════════════════════════════════════════════════════════╣
║                                                                              ║
║  CONDITIONS D'AUTO-REFUS DÉCLENCHÉES                                        ║
║  ─────────────────────────────────────                                       ║
║                                                                              ║
║  ❌  [1] TVA incorrecte                                                      ║
║       → CM : 19.25% au lieu de 17.5% (A003)                                ║
║       → Sources TVA déclaration ≠ Grand Livre (B002)                       ║
║                                                                              ║
║  ❌  [2] Centime Additionnel absent                                          ║
║       → Jamais journalisé (A001 / confirmé B002)                            ║
║       → Grand Livre TVA incomplet sur toutes les factures Congo             ║
║                                                                              ║
║  ❌  [3] IS absent                                                           ║
║       → Pas de moteur calculerIS() (A002)                                   ║
║       → IS absent de taxes_annuelles CG (B001)                             ║
║       → Résultat net affiché = résultat AVANT IS                           ║
║                                                                              ║
║  ❌  [4] Déclaration différente du Grand Livre                               ║
║       → preRemplirDeclaration lit factures                                  ║
║       → computeTVAFromJournal lit journal_entries                           ║
║       → En cas d'écart trigger, les deux divergent (B002)                  ║
║                                                                              ║
║  ❌  [5] Accounting Events incomplets                                        ║
║       → 2 events seulement (facture émise / payée)                         ║
║       → Paie, IS, Patente, CNSS, IRPP : 0 accounting events                ║
║                                                                              ║
╠══════════════════════════════════════════════════════════════════════════════╣
║                                                                              ║
║  VERDICT                                                                     ║
║  ───────                                                                     ║
║                                                                              ║
║           ❌  CERTIFICATION FCI REFUSÉE EN L'ÉTAT                            ║
║                                                                              ║
║  5 conditions d'auto-refus déclenchées sur les 9 possibles.                ║
║  FCI = 48 / 100 (seuil PASS = 70/100).                                     ║
║                                                                              ║
╠══════════════════════════════════════════════════════════════════════════════╣
║                                                                              ║
║  POINTS FORTS IDENTIFIÉS                                                    ║
║  ───────────────────────                                                    ║
║  ✅ Déclaration CNSS Congo : la plus complète du système                    ║
║     (nominatif, branches, plafonds, PDF, Excel, pré-remplissage)           ║
║  ✅ Patente Congo : barème complet LF 2026 (10 tranches), CA, CAMU         ║
║  ✅ Moteur fiscal multi-pays : 13 pays configurés (CEMAC + UEMOA + EU)     ║
║  ✅ TVA : calculerTVA() et calculerTVAFromHT() fonctionnels                 ║
║  ✅ IRPP : barème par pays, abattement, multi-tranches                      ║
║  ✅ Échéancier fiscal : calculerEcheancier() pour TVA + CNSS + taxes ann.   ║
║  ✅ Types fiscaux exhaustifs (FiscalDeclaration, TypeDeclaration, etc.)    ║
║  ✅ Architecture lib/erp-core/compute/ : séparation calcul/agrégation      ║
║  ✅ preRemplirDeclaration : pré-remplissage DGI depuis données ERP         ║
║  ✅ CA Centime Additionnel : modélisé dans TaxeAdditionnelle (code, taux)  ║
║                                                                              ║
╠══════════════════════════════════════════════════════════════════════════════╣
║                                                                              ║
║  CONDITIONS POUR RECERTIFICATION FCI                                        ║
║  ─────────────────────────────────                                           ║
║                                                                              ║
║  Pour FCI ≥ 50 (seuil minimum opérationnel) :                              ║
║  → RF-1.1 : Corriger TUS 4.5% → 0% dans declaration-generale.ts           ║
║  → RF-1.2 : Ajouter IS Congo dans taxes_annuelles                          ║
║  → RF-1.3 : Corriger fn_facture_issued (CA Congo journalisé)               ║
║  Estimé : 1-2 jours SQL + 1h TypeScript                                    ║
║                                                                              ║
║  Pour FCI ≥ 70 (seuil PASS) :                                              ║
║  → Sprint RF-1 complet (4 items) +                                          ║
║  → RF-2.1 : Unifier source TVA (journal = seule source)                    ║
║  → RF-3.1 : Créer fn_paie_to_journal (IRPP + CNSS journalisés)            ║
║  → RF-1.4 : Créer calculerIS() + fn_is_to_journal                         ║
║  Estimé : 5-7 jours de développement                                       ║
║                                                                              ║
║  Pour FCI ≥ 85 (certification GOLD) :                                      ║
║  → Sprint RF-1 + RF-2 + RF-3 + RF-4 complets                              ║
║  → TAFIRE implémenté                                                        ║
║  → Framework exonérations actif                                             ║
║  → Paiements fiscaux journalisés automatiquement                            ║
║  Estimé : 2-3 semaines                                                     ║
║                                                                              ║
╠══════════════════════════════════════════════════════════════════════════════╣
║                                                                              ║
║  RESSOURCES MOBILISÉES                                                      ║
║  ──────────────────────                                                     ║
║  Skills : fiscalite-cemac, ohada-comptabilite, droit-social-rh,            ║
║            audit-comptable                                                  ║
║  Fichiers audités : 18 fichiers TypeScript/SQL                              ║
║  Routes API analysées : 8 routes /api/declarations/*, /api/fiscalite/*     ║
║  Tables DB identifiées : declarations_generales, declarations_cnss,         ║
║    declarations_cnss_lignes, declarations_patente, fiscal_years,            ║
║    journal_entries (TVA comptes 4441/4442/4445/4446)                       ║
║                                                                              ║
╠══════════════════════════════════════════════════════════════════════════════╣
║                                                                              ║
║  RÉFÉRENCE DOCUMENT                                                          ║
║  ─────────────────                                                           ║
║  ID        : F-005-FCI-2026-06-30                                           ║
║  Révision  : v1.0 — Audit initial Fiscal Core                              ║
║  Validité  : 60 jours                                                       ║
║  Pré-requis satisfait : F-004 ESC-01 validé ✅                              ║
║  Prochaine étape : Sprints RF-1 + RF-2 → recertification FCI               ║
║                                                                              ║
╚══════════════════════════════════════════════════════════════════════════════╝
```

---

*Document généré par F-005 Fiscal Core Certification — Lecture seule*  
*Aucune modification de code, SQL, commit ou déploiement durant cet audit*  
*Sprints de correction : RF-1 (urgent) → RF-2 → RF-3 → RF-4*

# LOI-L — Unique Fiscal Calculator

**Version :** 1.0  
**Certification :** C-004.3  
**Date :** 2026-07-13  
**Auteur :** Oraforme Architecture Council

---

## Principe fondamental

> **FiscalCalculationEngine est l'unique autorité de calcul fiscal dans Oraforme.**

Aucun composant applicatif ne peut calculer TVA, IS, IRPP, CNSS ou Patente en multipliant directement par un taux codé en dur. Le seul chemin autorisé est :

```
Code applicatif
  ↓
  usePays().calculerTVA(montantHT)              ← UI React
  lib/fiscal/universal-tax-engine.ts            ← Serveur / API
  lib/fiscalite/engine.ts                       ← Déclarations fiscales
```

---

## Règles

### INTERDIT — Violation LOI-L

```typescript
// ❌ TVA calculée inline
const tva = montantHT * 0.18

// ❌ Taux Cameroun hardcodé
const tva = prix * 0.175

// ❌ IS calculé inline
const impot = benefice * 0.30

// ❌ CNSS calculé inline
const cnss = salaireBrut * 0.04
```

### AUTORISÉ — Chemin officiel

```typescript
// ✅ UI React — via PaysContext
const { calculerTVA } = usePays()
const { tva, ca, ttc, taux } = calculerTVA(montantHT)
// → retourne tva=18%, ca=5% (Congo), ttc=montantHT*1.23

// ✅ API / Serveur — universal-tax-engine
import { calculerTVA } from '@/lib/fiscal/universal-tax-engine'
const result = calculerTVA(montantHT, paysConfig)

// ✅ Déclarations fiscales — engine.ts
import { calculerTVA } from '@/lib/fiscalite/engine'
const tvaNet = calculerTVA(tvaCollectee, tvaDeductible, 'CG')
```

---

## Pays couverts

| Pays | TVA | IS | CNSS salarié | Source |
|---|---|---|---|---|
| Congo-Brazzaville | 18% + CA 5% | 30% | 4% | LF 2026 n°42-2025 |
| Cameroun | 17,5% | 30% | 4,2% | CGI art.142 |
| Gabon | 18% | 30% | 2% | LF 2026 n°041/2025 |
| Tchad | 18% | 35% | à confirmer | LF 2026 |
| RCA | 19% | 30% | à confirmer | CGI RCA 2023 |
| Guinée Équatoriale | 15% | 25% | à confirmer | Ley n°1/2024 |
| RDC | 16% | 30% | à confirmer | DGI + Lois 23/052-053 |

---

## Dettes techniques (KNOWN_FISCAL_DEBT)

### DET-L-001 — Cabinet API

**Fichier :** `app/api/cabinet/clients/[id]/factures/route.ts`  
**Violation :** `const tva = Math.round(ht * 0.18)` — TVA Congo 18% hardcodée  
**Migration :** Utiliser `calculerTVA(ht, 'CG')` depuis `universal-tax-engine`  
**Statut :** ⚠️ Dette technique — migration planifiée

### DET-L-002 — Cabinet Dashboard

**Fichier :** `app/dashboard/cabinet/clients/[id]/page.tsx`  
**Violation :** `ht * 0.18` (2 occurrences) — TVA hardcodée dans le module cabinet  
**Migration :** Utiliser `usePays().calculerTVA(ht)` ou passer le pays du client  
**Statut :** ⚠️ Dette technique — migration planifiée

### DET-L-003 — Finance Dashboard

**Fichier :** `app/dashboard/finance/page.tsx`  
**Violation :** `m.entrees * 0.18`, `m.sorties * 0.18` — estimation TVA inline  
**Migration :** Créer une fonction `estimerTVA(montant, pays)` dans universal-tax-engine  
**Statut :** ⚠️ Dette technique — migration planifiée

---

## Enforcement CI

### 1. Vitest — test d'architecture (bloc CI)

```bash
npx vitest run lib/architecture/loi-l-fiscal-calculator.test.ts
```

Échoue CI si un calcul TVA/IS/CNSS inline est ajouté hors des exemptions et hors des dettes connues.

### 2. ESLint — règle statique (feedback immédiat IDE)

Règle `loi-l/unique-fiscal-calculator: "error"` dans `eslint.config.mjs`.  
Détecte les multiplications par des taux TVA CEMAC dans les composants applicatifs.

### 3. Ajouter une exemption ou une dette (procédure)

Une nouvelle violation nécessite :
1. **Si autorisée** : Modifier `FISCAL_EXEMPT` dans le test + ajouter ignore ESLint
2. **Si dette** : Ajouter à `KNOWN_FISCAL_DEBT` avec un ID `DET-L-XXX` et un plan de migration
3. Documenter dans ce fichier

---

## Exemptions officielles

| Exemption | Raison |
|---|---|
| `lib/fiscal/**` | Universal Tax Engine — moteur officiel |
| `lib/fiscalite/**` | Engine de déclarations + pays configs |
| `lib/fiscalite-*.ts` | Modules pays (congo, cameroun, gabon…) |
| `lib/countries/**` | Configurations pays (taux officiels) |
| `lib/contexts/PaysContext.tsx` | Bridge UI ↔ fiscal engine |
| `lib/accounting-engine.ts` | Helper serveur comptable |
| `lib/audit/**` | Engine d'audit fiscal |
| `lib/miaa/**` | Agents IA (MIAA fiscal audit) |
| `app/api/agents/**` | Agents IA — scores/ratios, pas fiscal |
| `components/onboarding/**` | UI animations (delay: i * 0.18) |

---

## Historique

| Date | Action | Impact |
|---|---|---|
| 2026-07-13 | C-004.3 : LOI-L créée — ESLint + Vitest + documentation | CI bloquant activé |
| _(futur)_ | Migration DET-L-001/002/003 vers FiscalCalculationEngine | 0 dette fiscal inline |

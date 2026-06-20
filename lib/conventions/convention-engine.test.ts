/**
 * lib/conventions/convention-engine.test.ts
 * Tests unitaires — ConventionEngine Phase 2.1
 *
 * Groupes :
 *  1. Registre et lookup
 *  2. Salaire conventionnel (coefficient × SMIG)
 *  3. Primes conventionnelles
 *  4. Ancienneté conventionnelle vs légale
 *  5. Heures supplémentaires conventionnelles vs légales
 *  6. Conformité convention
 *  7. Résumé convention complet
 *  8. MIAA+ points d'entrée
 *  9. Multi-pays (CM vs CG)
 * 10. Cas limites
 */

import { describe, it, expect, beforeAll } from 'vitest'
import type { Convention } from './types'
import {
  getConvention,
  getConventionOrThrow,
  listConventions,
  getCategorie,
  getEchelon,
  getCoefficient,
  calculerSalaireConventionnel,
  calculerPrimeConventionnelle,
  calculerAncienneteConventionnelle,
  calculerHeuresSupConventionnelles,
  verifierConformiteConvention,
  genererResumeConvention,
  getMIAAAuditConvention,
  getMIAAContexteConvention,
  registerConvention,
  PILOTES,
} from './index'

// Import du module pour déclencher l'auto-enregistrement
import './index'

// ═══════════════════════════════════════════════════════════════════════════════
// 1. REGISTRE ET LOOKUP
// ═══════════════════════════════════════════════════════════════════════════════

describe('1 — Registre et lookup', () => {
  it('CG:COMMERCE enregistré au chargement', () => {
    const conv = getConvention('CG', 'COMMERCE')
    expect(conv).not.toBeNull()
    expect(conv?.code).toBe('CG_COMMERCE_PILOTE')
  })

  it('CG:BTP enregistré au chargement', () => {
    const conv = getConvention('CG', 'BTP')
    expect(conv).not.toBeNull()
    expect(conv?.code_secteur).toBe('BTP')
  })

  it('CM:COMMERCE enregistré au chargement', () => {
    const conv = getConvention('CM', 'COMMERCE')
    expect(conv).not.toBeNull()
    expect(conv?.code_pays).toBe('CM')
  })

  it('convention inexistante → null', () => {
    const conv = getConvention('GA', 'BANQUE')
    expect(conv).toBeNull()
  })

  it('getConventionOrThrow → erreur si introuvable', () => {
    expect(() => getConventionOrThrow('TD', 'MINES')).toThrow()
  })

  it('listConventions() → 3 conventions enregistrées', () => {
    const all = listConventions()
    expect(all.length).toBeGreaterThanOrEqual(3)
  })

  it('listConventions(CG) → 2 conventions CG uniquement', () => {
    const cg = listConventions('CG')
    expect(cg.length).toBe(2)
    expect(cg.every(c => c.code_pays === 'CG')).toBe(true)
  })

  it('getCategorie() → trouve catégorie III dans CG Commerce', () => {
    const conv = getConventionOrThrow('CG', 'COMMERCE')
    const cat  = getCategorie(conv, 'III')
    expect(cat).not.toBeNull()
    expect(cat?.libelle).toContain('III')
  })

  it('getEchelon() → trouve échelon B dans catégorie II', () => {
    const conv = getConventionOrThrow('CG', 'COMMERCE')
    const cat  = getCategorie(conv, 'II')!
    const ech  = getEchelon(cat, 'B')
    expect(ech).not.toBeNull()
    expect(ech?.coefficient).toBe(165)
  })

  it('getCoefficient() → Cat V Ech C = 700', () => {
    const coeff = getCoefficient(getConventionOrThrow('CG', 'COMMERCE'), 'V', 'C')
    expect(coeff).toBe(700)
  })

  it('getCoefficient() → catégorie inexistante = 0', () => {
    const coeff = getCoefficient(getConventionOrThrow('CG', 'COMMERCE'), 'X', 'A')
    expect(coeff).toBe(0)
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// 2. SALAIRE CONVENTIONNEL (coefficient × SMIG)
// ═══════════════════════════════════════════════════════════════════════════════

describe('2 — Salaire conventionnel', () => {
  it('Cat I Ech A = SMIG × 100/100 = 90 000 FCFA (CG)', () => {
    const r = calculerSalaireConventionnel({ codePays: 'CG', codeSecteur: 'COMMERCE', codeCategorie: 'I', codeEchelon: 'A' })
    expect(r.salaire_minimum).toBe(90_000)
    expect(r.coefficient).toBe(100)
    expect(r.smig_utilise).toBe(90_000)
    expect(r.methode).toBe('coefficient_smig')
  })

  it('Cat I Ech C = 90 000 × 120/100 = 108 000 FCFA', () => {
    const r = calculerSalaireConventionnel({ codePays: 'CG', codeSecteur: 'COMMERCE', codeCategorie: 'I', codeEchelon: 'C' })
    expect(r.salaire_minimum).toBe(108_000)
  })

  it('Cat III Ech A = 90 000 × 200/100 = 180 000 FCFA', () => {
    const r = calculerSalaireConventionnel({ codePays: 'CG', codeSecteur: 'COMMERCE', codeCategorie: 'III', codeEchelon: 'A' })
    expect(r.salaire_minimum).toBe(180_000)
    expect(r.coefficient).toBe(200)
  })

  it('Cat V Ech C = 90 000 × 700/100 = 630 000 FCFA', () => {
    const r = calculerSalaireConventionnel({ codePays: 'CG', codeSecteur: 'COMMERCE', codeCategorie: 'V', codeEchelon: 'C' })
    expect(r.salaire_minimum).toBe(630_000)
  })

  it('smig_override → utilise le SMIG fourni', () => {
    const r = calculerSalaireConventionnel({
      codePays: 'CG', codeSecteur: 'COMMERCE', codeCategorie: 'I', codeEchelon: 'A',
      smig_override: 100_000,
    })
    expect(r.salaire_minimum).toBe(100_000)
    expect(r.smig_utilise).toBe(100_000)
  })

  it('CM Commerce Cat I Ech A = 36 270 × 100/100 = 36 270 FCFA', () => {
    const r = calculerSalaireConventionnel({ codePays: 'CM', codeSecteur: 'COMMERCE', codeCategorie: 'I', codeEchelon: 'A' })
    expect(r.salaire_minimum).toBe(36_270)
    expect(r.smig_utilise).toBe(36_270)
  })

  it('BTP Ingénieur I1 Ech A = 90 000 × 420/100 = 378 000 FCFA', () => {
    const r = calculerSalaireConventionnel({ codePays: 'CG', codeSecteur: 'BTP', codeCategorie: 'I1', codeEchelon: 'A' })
    expect(r.salaire_minimum).toBe(378_000)
  })

  it('catégorie inexistante → erreur', () => {
    expect(() => calculerSalaireConventionnel({
      codePays: 'CG', codeSecteur: 'COMMERCE', codeCategorie: 'XII', codeEchelon: 'A',
    })).toThrow()
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// 3. PRIMES CONVENTIONNELLES
// ═══════════════════════════════════════════════════════════════════════════════

describe('3 — Primes conventionnelles', () => {
  it('prime fixe → montant direct', () => {
    const r = calculerPrimeConventionnelle({
      prime: PILOTES.CG_COMMERCE.primes_globales.find(p => p.code === 'P_TRANS_CONV')!,
      salaire_base: 300_000,
    })
    expect(r.montant).toBe(15_000)
    expect(r.type).toBe('fixe')
    expect(r.imposable).toBe(false)
    expect(r.obligatoire).toBe(true)
  })

  it('prime par_jour (panier) = 1 000 × 22 jours = 22 000 FCFA', () => {
    const panier = PILOTES.CG_COMMERCE.primes_globales.find(p => p.code === 'P_PANIER')!
    const r = calculerPrimeConventionnelle({ prime: panier, salaire_base: 200_000, jours_travailles: 22 })
    expect(r.montant).toBe(22_000)
    expect(r.base_calcul).toBe(22)
  })

  it('prime pct_salaire_base (risque BTP 15%) = 15% × 200 000 = 30 000 FCFA', () => {
    const conv = getConventionOrThrow('CG', 'BTP')
    const cat  = getCategorie(conv, 'O2')!
    const p    = cat.primes_specifiques.find(p => p.code === 'P_RISQUE')!
    const r = calculerPrimeConventionnelle({ prime: p, salaire_base: 200_000 })
    expect(r.montant).toBe(30_000)
    expect(r.type).toBe('pct_salaire_base')
  })

  it('prime pct_salaire_brut utilise salaire_brut si fourni', () => {
    const prime = { code: 'TEST', libelle: 'Test', type: 'pct_salaire_brut' as const, montant: 0.10, imposable: true, periodicite: 'mensuel' as const, obligatoire: false }
    const r = calculerPrimeConventionnelle({ prime, salaire_base: 300_000, salaire_brut: 400_000 })
    expect(r.montant).toBe(40_000)
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// 4. ANCIENNETÉ CONVENTIONNELLE VS LÉGALE
// ═══════════════════════════════════════════════════════════════════════════════

describe('4 — Ancienneté conventionnelle vs légale', () => {
  it('CG Commerce: ancienneté conventionnelle = légale (même règle)', () => {
    const r = calculerAncienneteConventionnelle({
      codePays: 'CG', codeSecteur: 'COMMERCE',
      salaire_base: 300_000, date_entree: '2020-06-01', periode: '2026-06',
    })
    expect(r.annees_completes).toBe(6)
    // 5%/3ans × 2 tranches = 10%
    expect(r.taux_applique).toBe(0.10)
    expect(r.montant_legal).toBe(r.montant_conventionnel)
  })

  it('CG BTP: ancienneté conventionnelle MEILLEURE (3%/an vs 5%/3ans)', () => {
    const r = calculerAncienneteConventionnelle({
      codePays: 'CG', codeSecteur: 'BTP',
      salaire_base: 400_000, date_entree: '2020-06-01', periode: '2026-06',
    })
    expect(r.annees_completes).toBe(6)
    // Conventionnel : 6 × 3% = 18%
    // Légal : 5%/3ans × 2 tranches = 10%
    expect(r.taux_applique).toBe(0.18)
    expect(r.montant_conventionnel).toBeGreaterThan(r.montant_legal)
    expect(r.montant_applique).toBe(r.montant_conventionnel)
    expect(r.regle_utilisee).toBe('conventionnel')
  })

  it('BTP: plafond conventionnel 30% (vs 25% légal) atteint après 10 ans', () => {
    const r = calculerAncienneteConventionnelle({
      codePays: 'CG', codeSecteur: 'BTP',
      salaire_base: 300_000, date_entree: '2015-01-01', periode: '2026-06',
    })
    expect(r.annees_completes).toBeGreaterThanOrEqual(11)
    expect(r.taux_applique).toBe(0.30)   // plafond conventionnel BTP
  })

  it('CM Commerce: ancienneté 5%/2ans (meilleure que Congo 5%/3ans)', () => {
    const r = calculerAncienneteConventionnelle({
      codePays: 'CM', codeSecteur: 'COMMERCE',
      salaire_base: 200_000, date_entree: '2022-06-01', periode: '2026-06',
    })
    expect(r.annees_completes).toBe(4)
    // CM : 5%/2ans × 2 tranches = 10%
    expect(r.taux_applique).toBe(0.10)
    expect(r.methode_convention).toBe('taux_par_tranche')
  })

  it('0 an ancienneté → prime nulle', () => {
    const r = calculerAncienneteConventionnelle({
      codePays: 'CG', codeSecteur: 'COMMERCE',
      salaire_base: 200_000, date_entree: '2026-01-01', periode: '2026-06',
    })
    expect(r.montant_applique).toBe(0)
    expect(r.taux_applique).toBe(0)
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// 5. HEURES SUPPLÉMENTAIRES CONVENTIONNELLES VS LÉGALES
// ═══════════════════════════════════════════════════════════════════════════════

describe('5 — Heures supplémentaires conventionnelles vs légales', () => {
  it('CG Commerce: HS conventionnelles = légales (mêmes taux)', () => {
    const r = calculerHeuresSupConventionnelles({
      codePays: 'CG', codeSecteur: 'COMMERCE',
      salaire_base: 400_000, heures_sup_mois: 10,
    })
    expect(r.montant_conventionnel).toBe(r.montant_legal)
  })

  it('CG BTP: HS conventionnelles MEILLEURES (+20% vs +15%)', () => {
    const r = calculerHeuresSupConventionnelles({
      codePays: 'CG', codeSecteur: 'BTP',
      salaire_base: 400_000, heures_sup_mois: 10,
      heures_standard_semaine: 40, semaines_par_mois: 4,
    })
    // Taux horaire = 400k / 160 = 2500 F/h
    // Légal: 10h × 2500 × 1.15 = 28750 (→ même tranche 40h puisque 10h < (48-40)×4=32h)
    // Convention: 10h × 2500 × 1.20 = 30000
    expect(r.montant_conventionnel).toBeGreaterThan(r.montant_legal)
    expect(r.regle_utilisee).toBe('conventionnel')
    expect(r.montant_applique).toBe(r.montant_conventionnel)
  })

  it('BTP: 0 HS → montant nul des deux côtés', () => {
    const r = calculerHeuresSupConventionnelles({
      codePays: 'CG', codeSecteur: 'BTP',
      salaire_base: 300_000, heures_sup_mois: 0,
    })
    expect(r.montant_applique).toBe(0)
  })

  it('taux horaire base retourné correctement', () => {
    const r = calculerHeuresSupConventionnelles({
      codePays: 'CG', codeSecteur: 'BTP',
      salaire_base: 520_000, heures_sup_mois: 5,
      heures_standard_semaine: 40, semaines_par_mois: 4,
    })
    // 520 000 / (40 × 4) = 520 000 / 160 = 3250 FCFA/h
    expect(r.taux_horaire_base).toBe(3_250)
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// 6. CONFORMITÉ CONVENTION
// ═══════════════════════════════════════════════════════════════════════════════

describe('6 — Conformité convention', () => {
  it('salaire au-dessus minimum → conforme', () => {
    const r = verifierConformiteConvention({
      codePays: 'CG', codeSecteur: 'COMMERCE',
      codeCategorie: 'I', codeEchelon: 'A',
      salaire_base: 100_000,   // > 90 000 minimum
    })
    expect(r.conforme).toBe(true)
    expect(r.ecart_salaire).toBe(10_000)
    expect(r.alertes.filter(a => a.severite === 'bloquant')).toHaveLength(0)
  })

  it('salaire exactement au minimum → conforme', () => {
    const r = verifierConformiteConvention({
      codePays: 'CG', codeSecteur: 'COMMERCE',
      codeCategorie: 'I', codeEchelon: 'A',
      salaire_base: 90_000,
    })
    expect(r.conforme).toBe(true)
    expect(r.ecart_salaire).toBe(0)
  })

  it('salaire sous minimum → non conforme avec alerte bloquante', () => {
    const r = verifierConformiteConvention({
      codePays: 'CG', codeSecteur: 'COMMERCE',
      codeCategorie: 'II', codeEchelon: 'A',   // min = 135 000
      salaire_base: 100_000,
    })
    expect(r.conforme).toBe(false)
    expect(r.ecart_salaire).toBeLessThan(0)
    const bloquants = r.alertes.filter(a => a.severite === 'bloquant')
    expect(bloquants.length).toBeGreaterThan(0)
    expect(r.recommandations.length).toBeGreaterThan(0)
  })

  it('salaire sous SMIG → alerte bloquante SMIG', () => {
    const r = verifierConformiteConvention({
      codePays: 'CG', codeSecteur: 'COMMERCE',
      codeCategorie: 'I', codeEchelon: 'A',
      salaire_base: 80_000,   // < SMIG 90 000
    })
    expect(r.conforme).toBe(false)
    const smigAlerte = r.alertes.find(a => a.code === 'SALAIRE_SOUS_SMIG')
    expect(smigAlerte).toBeDefined()
  })

  it('prime obligatoire manquante → avertissement', () => {
    const r = verifierConformiteConvention({
      codePays: 'CG', codeSecteur: 'COMMERCE',
      codeCategorie: 'I', codeEchelon: 'A',
      salaire_base: 100_000,
      primes_versees: [],   // aucune prime versée → P_TRANS_CONV manquante
    })
    const avertissements = r.alertes.filter(a => a.severite === 'avertissement')
    expect(avertissements.some(a => a.code === 'PRIME_OBLIGATOIRE_MANQUANTE')).toBe(true)
    expect(r.primes_manquantes.some(p => p.code === 'P_TRANS_CONV')).toBe(true)
  })

  it('prime obligatoire fournie → pas d\'alerte prime', () => {
    const r = verifierConformiteConvention({
      codePays: 'CG', codeSecteur: 'COMMERCE',
      codeCategorie: 'I', codeEchelon: 'A',
      salaire_base: 100_000,
      primes_versees: [{ code: 'P_TRANS_CONV', montant: 15_000 }],
    })
    expect(r.primes_manquantes.some(p => p.code === 'P_TRANS_CONV')).toBe(false)
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// 7. RÉSUMÉ CONVENTION COMPLET
// ═══════════════════════════════════════════════════════════════════════════════

describe('7 — Résumé convention complet', () => {
  it('résumé CG Commerce contient toutes les sections', () => {
    const r = genererResumeConvention({
      codePays: 'CG', codeSecteur: 'COMMERCE',
      codeCategorie: 'III', codeEchelon: 'B',
      employe_id: 'EMP001',
      salaire_base: 250_000,
      periode: '2026-06',
      date_entree: '2020-01-01',
    })
    expect(r.code_pays).toBe('CG')
    expect(r.code_secteur).toBe('COMMERCE')
    expect(r.employe_id).toBe('EMP001')
    expect(r.salaire_conventionnel.salaire_minimum).toBe(202_500)  // 90k × 225/100
    expect(r.anciennete).toBeDefined()
    expect(r.primes.length).toBeGreaterThan(0)
    expect(r.conformite).toBeDefined()
    expect(r.avantages_applicables.length).toBeGreaterThan(0)
    expect(r.genere_le).toBeTruthy()
  })

  it('résumé avec HS → section heures_sup présente', () => {
    const r = genererResumeConvention({
      codePays: 'CG', codeSecteur: 'BTP',
      codeCategorie: 'I1', codeEchelon: 'A',
      employe_id: 'EMP002',
      salaire_base: 400_000,
      periode: '2026-06',
      date_entree: '2022-01-01',
      heures_sup_mois: 15,
    })
    expect(r.heures_sup).toBeDefined()
    expect(r.heures_sup?.heures).toBe(15)
    expect(r.heures_sup?.regle_utilisee).toBe('conventionnel')  // BTP meilleur
  })

  it('résumé sans HS → section heures_sup absente', () => {
    const r = genererResumeConvention({
      codePays: 'CG', codeSecteur: 'COMMERCE',
      codeCategorie: 'I', codeEchelon: 'A',
      employe_id: 'EMP003',
      salaire_base: 100_000,
      periode: '2026-06',
      date_entree: '2025-01-01',
    })
    expect(r.heures_sup).toBeUndefined()
  })

  it('conformité intégrée dans le résumé', () => {
    const r = genererResumeConvention({
      codePays: 'CG', codeSecteur: 'COMMERCE',
      codeCategorie: 'IV', codeEchelon: 'A',   // min = 270 000
      employe_id: 'EMP004',
      salaire_base: 200_000,   // sous le minimum
      periode: '2026-06',
      date_entree: '2023-01-01',
    })
    expect(r.conformite.conforme).toBe(false)
    expect(r.conformite.ecart_salaire).toBeLessThan(0)
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// 8. MIAA+ POINTS D'ENTRÉE
// ═══════════════════════════════════════════════════════════════════════════════

describe('8 — MIAA+ points d\'entrée', () => {
  it('getMIAAAuditConvention : 100% conformes si salaires au-dessus minimum', () => {
    const audit = getMIAAAuditConvention('CG', 'COMMERCE', [
      { id: 'E1', codeCategorie: 'I',  codeEchelon: 'A', salaire_base: 100_000, primes: [{ code: 'P_TRANS_CONV', montant: 15_000 }] },
      { id: 'E2', codeCategorie: 'II', codeEchelon: 'A', salaire_base: 140_000, primes: [{ code: 'P_TRANS_CONV', montant: 15_000 }] },
    ])
    expect(audit.nb_employes).toBe(2)
    expect(audit.nb_conformes).toBe(2)
    expect(audit.taux_conformite_pct).toBe(100)
    expect(audit.masse_regularisation).toBe(0)
  })

  it('getMIAAAuditConvention : détecte non-conformité et calcule masse régularisation', () => {
    const audit = getMIAAAuditConvention('CG', 'COMMERCE', [
      { id: 'E1', codeCategorie: 'II', codeEchelon: 'A', salaire_base: 100_000 },  // min = 135 000 → écart 35 000
      { id: 'E2', codeCategorie: 'I',  codeEchelon: 'A', salaire_base: 100_000 },  // conforme
    ])
    expect(audit.nb_non_conformes).toBe(1)
    expect(audit.masse_regularisation).toBe(35_000)
    expect(audit.taux_conformite_pct).toBe(50)
  })

  it('getMIAAContexteConvention : grille simplifiée contient tous les échelons', () => {
    const ctx = getMIAAContexteConvention('CG', 'COMMERCE')
    expect(ctx.convention).toBe('CG_COMMERCE_PILOTE')
    // 5 catégories × 3 échelons = 15 lignes
    expect(ctx.grille_simplifiee.length).toBe(15)
    expect(ctx.primes_obligatoires.length).toBeGreaterThan(0)
    expect(ctx.primes_obligatoires[0].code).toBe('P_TRANS_CONV')
  })

  it('getMIAAContexteConvention : grille triée avec SMIG auto', () => {
    const ctx = getMIAAContexteConvention('CG', 'COMMERCE')
    const catIA = ctx.grille_simplifiee.find(g => g.categorie === 'I' && g.echelon === 'A')
    expect(catIA?.salaire_minimum).toBe(90_000)
  })

  it('getMIAAContexteConvention : CM utilise SMIG Cameroun', () => {
    const ctx = getMIAAContexteConvention('CM', 'COMMERCE')
    const catIA = ctx.grille_simplifiee.find(g => g.categorie === 'I' && g.echelon === 'A')
    expect(catIA?.salaire_minimum).toBe(36_270)
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// 9. MULTI-PAYS (CG vs CM)
// ═══════════════════════════════════════════════════════════════════════════════

describe('9 — Multi-pays CG vs CM', () => {
  it('CG et CM ont des SMIG différents → salaires minimums différents', () => {
    const rCG = calculerSalaireConventionnel({ codePays: 'CG', codeSecteur: 'COMMERCE', codeCategorie: 'I', codeEchelon: 'A' })
    const rCM = calculerSalaireConventionnel({ codePays: 'CM', codeSecteur: 'COMMERCE', codeCategorie: 'I', codeEchelon: 'A' })
    expect(rCG.smig_utilise).toBe(90_000)
    expect(rCM.smig_utilise).toBe(36_270)
    expect(rCG.salaire_minimum).toBeGreaterThan(rCM.salaire_minimum)
  })

  it('même code catégorie (I/A) → conventions pays différents', () => {
    const cg = getConventionOrThrow('CG', 'COMMERCE')
    const cm = getConventionOrThrow('CM', 'COMMERCE')
    expect(cg.code_pays).toBe('CG')
    expect(cm.code_pays).toBe('CM')
    expect(cg.data_confidence).toBe('pilote')
    expect(cm.data_confidence).toBe('pilote')
  })

  it('ancienneté CM (5%/2ans) > CG (5%/3ans) à 4 ans', () => {
    const rCG = calculerAncienneteConventionnelle({
      codePays: 'CG', codeSecteur: 'COMMERCE',
      salaire_base: 200_000, date_entree: '2022-06-01', periode: '2026-06',
    })
    const rCM = calculerAncienneteConventionnelle({
      codePays: 'CM', codeSecteur: 'COMMERCE',
      salaire_base: 200_000, date_entree: '2022-06-01', periode: '2026-06',
    })
    // CG: 4 ans → 1 tranche (3ans) × 5% = 5%
    // CM: 4 ans → 2 tranches (2ans) × 5% = 10%
    expect(rCM.taux_applique).toBeGreaterThan(rCG.taux_applique)
    expect(rCM.montant_conventionnel).toBeGreaterThan(rCG.montant_legal)
  })

  it('PILOTES.CG_COMMERCE et CG_BTP ont des codes secteur différents', () => {
    expect(PILOTES.CG_COMMERCE.code_secteur).toBe('COMMERCE')
    expect(PILOTES.CG_BTP.code_secteur).toBe('BTP')
    expect(PILOTES.CM_COMMERCE.code_pays).toBe('CM')
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// 10. CAS LIMITES
// ═══════════════════════════════════════════════════════════════════════════════

describe('10 — Cas limites', () => {
  it('ancienneté BTP plafond 30% → prochain_palier = 0', () => {
    const r = calculerAncienneteConventionnelle({
      codePays: 'CG', codeSecteur: 'BTP',
      salaire_base: 300_000, date_entree: '2010-01-01', periode: '2026-06',
    })
    expect(r.taux_applique).toBe(0.30)
    expect(r.prochain_palier_dans_ans).toBe(0)
  })

  it('0 HS dans BTP → pas de différence légal/conventionnel', () => {
    const r = calculerHeuresSupConventionnelles({
      codePays: 'CG', codeSecteur: 'BTP',
      salaire_base: 300_000, heures_sup_mois: 0,
    })
    expect(r.heures).toBe(0)
    expect(r.montant_applique).toBe(0)
    expect(r.montant_conventionnel).toBe(0)
  })

  it('audit vide → taux conformité 100% par défaut', () => {
    const audit = getMIAAAuditConvention('CG', 'COMMERCE', [])
    expect(audit.nb_employes).toBe(0)
    expect(audit.taux_conformite_pct).toBe(100)
    expect(audit.masse_regularisation).toBe(0)
  })

  it('prime par_unite → 0 si unites = 0', () => {
    const prime = { code: 'P_UNIT', libelle: 'Par unité', type: 'par_unite' as const, montant: 500, imposable: true, periodicite: 'mensuel' as const, obligatoire: false }
    const r = calculerPrimeConventionnelle({ prime, salaire_base: 200_000, unites: 0 })
    expect(r.montant).toBe(0)
  })

  it('registerConventions : ajouter puis retrouver une convention GA', () => {
    const testConv: Convention = {
      code: 'GA_BANQUE_TEST', code_pays: 'GA', code_secteur: 'BANQUE',
      libelle: 'Test Banque Gabon', description: 'Test', date_signature: 'PILOTE',
      date_entree_vigueur: '2026-01-01', parties_signataires: [],
      sous_secteurs: [], primes_globales: [], avantages: [],
      regle_anciennete: { methode: 'taux_annuel', taux_annuel: 0.03, plafond_pct: 0.25, base_calcul: 'salaire_base', plus_favorable_que_legal: false, base_legale: 'Test' },
      regle_heures_sup: { tranches: [{ seuil_heures_semaine: 40, majoration_pct: 0.15, description: '+15%' }], plus_favorable_que_legal: false, base_legale: 'Test' },
      grille_salariale: { code_pays: 'GA', code_secteur: 'BANQUE', annee_validite: 2026, coefficient_base: 100, calcul_depuis_coefficient: true, familles: [{ code: 'F1', libelle: 'F1', categories: [{ code: 'I', libelle: 'Cat I', niveau: 1, echelons: [{ code: 'A', libelle: 'Ech A', coefficient: 100, salaire_minimum_mensuel: 0 }], primes_specifiques: [] }] }] },
      notes: [], data_confidence: 'pilote',
    }
    registerConvention(testConv)
    const found = getConvention('GA', 'BANQUE')
    expect(found?.code).toBe('GA_BANQUE_TEST')
  })
})

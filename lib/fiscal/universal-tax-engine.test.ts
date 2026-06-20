/**
 * lib/fiscal/universal-tax-engine.test.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Tests unitaires du UniversalTaxEngine
 *
 * Stratégie de validation :
 *   ① Alignement arithmétique avec congo-calculs.ts (source de vérité CG)
 *   ② Cohérence multi-pays (CM, GA, CD, CF, TD, GQ)
 *   ③ Cas limites (brut=0, plafond CNSS, 5 tranches, quotient familial)
 *   ④ Mesures spéciales LF 2026 (prise en charge État)
 *   ⑤ TVA + IS + retenues à la source
 *
 * Run : npx vitest run lib/fiscal/universal-tax-engine.test.ts
 */

import { describe, it, expect } from 'vitest'
import {
  calculerIRPP,
  calculerChargesSociales,
  calculerTVA,
  calculerIS,
  calculerRetenueSource,
  calculerTaxeMinimale,
  genererResumeFiscalMensuel,
  getTauxCNSSSalarie,
  getTauxCNSSPatronal,
  isAssujettieTVA,
  getSMIG,
  getDataConfidence,
} from './universal-tax-engine'

// ═══════════════════════════════════════════════════════════════════════════════
// GROUPE 1 — CNSS CONGO (CG)
// Référence : congo-calculs.ts — calculerBulletinPaie()
// ═══════════════════════════════════════════════════════════════════════════════

describe('CG — Charges sociales CNSS', () => {

  it('VID salarié 4% plafonné à 1 200 000', () => {
    const res = calculerChargesSociales({ codePays: 'CG', salaireBrut: 800_000 })
    const vidSal = res.branches.find(b => b.code === 'VID_SAL')
    expect(vidSal).toBeDefined()
    expect(vidSal!.montant_salarie).toBe(32_000)           // 800k × 4%
    expect(res.total_salarie).toBe(32_000)
  })

  it('VID salarié plafonné sur base 1 200 000 (brut > plafond)', () => {
    const res = calculerChargesSociales({ codePays: 'CG', salaireBrut: 2_000_000 })
    const vidSal = res.branches.find(b => b.code === 'VID_SAL')
    expect(vidSal!.montant_salarie).toBe(48_000)           // 1 200 000 × 4%
    expect(vidSal!.base_calcul).toBe(1_200_000)
  })

  it('VID patronal 8% + AF 10,035% + AT 2,25% + TUS 3%', () => {
    const brut = 849_000
    const res  = calculerChargesSociales({ codePays: 'CG', salaireBrut: brut })

    const vidPat = res.branches.find(b => b.code === 'VID_PAT')
    const af     = res.branches.find(b => b.code === 'AF')
    const at     = res.branches.find(b => b.code === 'AT')
    const tus    = res.branches.find(b => b.code === 'TUS')

    expect(vidPat!.montant_patronal).toBe(Math.round(849_000 * 0.08))      // 67 920
    expect(af!.montant_patronal).toBe(Math.round(849_000 * 0.10035))       // 85 197
    expect(at!.montant_patronal).toBe(Math.round(600_000 * 0.0225))        // 13 500 (plafonné 600k)
    expect(tus!.montant_patronal).toBe(Math.round(849_000 * 0.03))         // 25 470 (déplafonné)
  })

  it('AT plafonné à 600 000 (brut 849 000)', () => {
    const res = calculerChargesSociales({ codePays: 'CG', salaireBrut: 849_000 })
    const at  = res.branches.find(b => b.code === 'AT')
    expect(at!.base_calcul).toBe(600_000)
    expect(at!.montant_patronal).toBe(13_500)
  })

  it('TUS déplafonné (brut 2 000 000)', () => {
    const res = calculerChargesSociales({ codePays: 'CG', salaireBrut: 2_000_000 })
    const tus = res.branches.find(b => b.code === 'TUS')
    expect(tus!.base_calcul).toBe(2_000_000)
    expect(tus!.montant_patronal).toBe(60_000)             // 2M × 3%
  })

  it('getTauxCNSSSalarie CG = 4%', () => {
    expect(getTauxCNSSSalarie('CG')).toBeCloseTo(0.04)
  })

  it('getTauxCNSSPatronal CG ≈ 23,285%', () => {
    const taux = getTauxCNSSPatronal('CG')
    expect(taux).toBeCloseTo(0.08 + 0.10035 + 0.0225 + 0.03, 3)   // 23.285%
  })

})

// ═══════════════════════════════════════════════════════════════════════════════
// GROUPE 2 — IRPP CONGO (CG)
// Référence arithmétique : congo-calculs.ts calculerIRPP()
// Méthode : annuelle_div12, quotient familial, abattement aucun
// ═══════════════════════════════════════════════════════════════════════════════

describe('CG — IRPP', () => {

  it('IRPP = 0 pour base < 464 000 FCFA/mois (T1 exonérée — seuil mensuel direct)', () => {
    const res = calculerIRPP({ codePays: 'CG', salaireBrut: 300_000, situation: 'celibataire', nombreEnfants: 0 })
    expect(res.irpp_net).toBe(0)
    expect(res.nombre_parts).toBe(1)
  })

  it('IRPP T2 seulement (brut 700 000 — entre T2Min=464k et T2Max=1M, taux 1%)', () => {
    const res = calculerIRPP({ codePays: 'CG', salaireBrut: 700_000, situation: 'celibataire', nombreEnfants: 0 })
    // mensuelle_directe — seuils appliqués directement (Art. 76 CGI LF 2026)
    // T1 (0%): 0 → 464 000 = 0
    // T2 (1%): 464 001 → 700 000 = 235 999 × 1% ≈ 2 360
    expect(res.irpp_net).toBe(Math.round((700_000 - 464_001) * 0.01))
  })

  it('IRPP T2+T3 (brut 1 500 000 — mensuelle_directe)', () => {
    const res = calculerIRPP({ codePays: 'CG', salaireBrut: 1_500_000, situation: 'celibataire', nombreEnfants: 0 })
    // T1 (0%): 0 → 464 000 = 0
    // T2 (1%): 464 001 → 1 000 000 = 535 999 × 1%
    // T3 (10%): 1 000 001 → 1 500 000 = 499 999 × 10%
    const expected = Math.round(
      (Math.min(1_500_000, 1_000_000) - 464_001) * 0.01 +
      (1_500_000 - 1_000_001) * 0.10,
    )
    expect(res.irpp_net).toBe(expected)
  })

  it('méthode_base = mensuelle_directe pour CG (seuils mensuels directs — Art. 76 CGI)', () => {
    const res = calculerIRPP({ codePays: 'CG', salaireBrut: 100_000, situation: 'celibataire', nombreEnfants: 0 })
    expect(res.methode_base).toBe('mensuelle_directe')
  })

  it('abattement = 0 pour CG (type: aucun)', () => {
    const res = calculerIRPP({ codePays: 'CG', salaireBrut: 500_000, situation: 'celibataire', nombreEnfants: 0 })
    expect(res.abattement_montant).toBe(0)
    expect(res.abattement_type).toBe('aucun')
    expect(res.base_apres_abattement).toBe(res.base_brut)
  })

  it('quotient familial : marié + 2 enfants = 3 parts', () => {
    const celibataire = calculerIRPP({ codePays: 'CG', salaireBrut: 500_000, situation: 'celibataire', nombreEnfants: 0 })
    const marie2      = calculerIRPP({ codePays: 'CG', salaireBrut: 500_000, situation: 'marie',       nombreEnfants: 2 })

    expect(celibataire.nombre_parts).toBe(1)              // 1 part
    expect(marie2.nombre_parts).toBe(3)                   // 1 + 1 (marié) + 2×0.5
    expect(marie2.irpp_net).toBeLessThan(celibataire.irpp_net)
  })

  it('IRPP marié 0 enfant = 2 parts', () => {
    const res = calculerIRPP({ codePays: 'CG', salaireBrut: 500_000, situation: 'marie', nombreEnfants: 0 })
    expect(res.nombre_parts).toBe(2)
  })

  it('Mesure LF 2026 : IRPP = 0 si appliquerMesuresSpeciales=true ET mesure actif', () => {
    // La mesure actif=false dans CG.ts → pas de réduction automatique
    // Test que la structure est correcte (réduction = 0 si actif=false)
    const res = calculerIRPP({
      codePays: 'CG', salaireBrut: 800_000,
      situation: 'celibataire', nombreEnfants: 0,
      appliquerMesuresSpeciales: true,
    })
    // actif=false dans CG.ts → reduction = 0
    expect(res.reduction_mesures_speciales).toBe(0)
    expect(res.irpp_net).toBe(res.irpp_total)
  })

  it('5 tranches présentes dans la config CG (brut 10M > T5Min=8M)', () => {
    const res = calculerIRPP({
      codePays: 'CG', salaireBrut: 10_000_000,  // mensuelle_directe → T5 atteint si brut > 8M
      situation: 'celibataire', nombreEnfants: 0,
    })
    // Toutes les tranches traversées : T1(0%) T2(1%) T3(10%) T4(25%) T5(40%)
    expect(res.tranches.length).toBe(5)
  })

})

// ═══════════════════════════════════════════════════════════════════════════════
// GROUPE 3 — IRPP CAMEROUN (CM)
// Abattement 30%, 4 tranches, CAC 10% sur IRPP
// ═══════════════════════════════════════════════════════════════════════════════

describe('CM — IRPP avec abattement + CAC', () => {

  it('abattement 30% appliqué sur base IRPP', () => {
    const base = 1_000_000
    const res  = calculerIRPP({ codePays: 'CM', salaireBrut: base, situation: 'celibataire', nombreEnfants: 0 })
    expect(res.abattement_montant).toBe(Math.round(base * 0.30))
    expect(res.base_apres_abattement).toBe(Math.round(base * 0.70))
  })

  it('CAC 10% ajouté sur IRPP calculé', () => {
    const res = calculerIRPP({ codePays: 'CM', salaireBrut: 2_000_000, situation: 'celibataire', nombreEnfants: 0 })
    expect(res.centimes_additionnels).toBe(Math.round(res.irpp_avant_centimes * 0.10))
    expect(res.irpp_total).toBe(res.irpp_avant_centimes + res.centimes_additionnels)
  })

  it('quotient familial inactif pour CM → 1 part fixe', () => {
    const cel  = calculerIRPP({ codePays: 'CM', salaireBrut: 500_000, situation: 'celibataire', nombreEnfants: 0 })
    const mar2 = calculerIRPP({ codePays: 'CM', salaireBrut: 500_000, situation: 'marie',       nombreEnfants: 3 })
    expect(cel.nombre_parts).toBe(1)
    expect(mar2.nombre_parts).toBe(1)   // QF inactif → toujours 1 part
  })

})

// ═══════════════════════════════════════════════════════════════════════════════
// GROUPE 4 — IRPP RDC (CD) — annuelle_div12 (LF N°25/060 du 29/12/2025)
// Barème ANNUEL en CDF · moteur annualise brut × 12 puis divise impôt / 12
// Seuil exonération = 524 160 CDF/an ≈ 43 680 CDF/mois
// ═══════════════════════════════════════════════════════════════════════════════

describe('CD — IRPP annuelle_div12 (IPR LF N°25/060)', () => {

  it('méthode_base = annuelle_div12 pour CD (barème annuel LF N°25/060)', () => {
    const res = calculerIRPP({ codePays: 'CD', salaireBrut: 1_000_000, situation: 'celibataire', nombreEnfants: 0 })
    expect(res.methode_base).toBe('annuelle_div12')
  })

  it('T1 (0%) exonéré: brut 40 000 CDF/mois (annuel 480 000 < seuil 524 160)', () => {
    const res = calculerIRPP({ codePays: 'CD', salaireBrut: 40_000, situation: 'celibataire', nombreEnfants: 0 })
    expect(res.irpp_net).toBe(0)
  })

  it('T2 (15%): brut 50 000 CDF/mois → annuel 600 000 → IPR = Math.round((600k-524 160)×15%/12) = 948', () => {
    const res = calculerIRPP({ codePays: 'CD', salaireBrut: 50_000, situation: 'celibataire', nombreEnfants: 0 })
    // annual = 600 000 ; T2 = (600 000 - 524 160) × 15% = 11 376 ; ÷12 = 948
    expect(res.irpp_net).toBe(948)
  })

  it('abattement aucun pour CD', () => {
    const res = calculerIRPP({ codePays: 'CD', salaireBrut: 600_000, situation: 'celibataire', nombreEnfants: 0 })
    expect(res.abattement_montant).toBe(0)
  })

})

// ═══════════════════════════════════════════════════════════════════════════════
// GROUPE 5 — CNSS CAMEROUN (CM)
// CNPS + Crédit Foncier + FNE — plusieurs branches avec plafond/sans plafond
// ═══════════════════════════════════════════════════════════════════════════════

describe('CM — Charges sociales CNPS', () => {

  it('CNPS salarié 4,2% plafonné 750 000', () => {
    const res    = calculerChargesSociales({ codePays: 'CM', salaireBrut: 1_000_000 })
    const cnpsSal = res.branches.find(b => b.code === 'CNPS_SAL')
    expect(cnpsSal!.montant_salarie).toBe(Math.round(750_000 * 0.042))  // plafonné
    expect(cnpsSal!.base_calcul).toBe(750_000)
  })

  it('CFC salarié 1% déplafonné', () => {
    const res  = calculerChargesSociales({ codePays: 'CM', salaireBrut: 2_000_000 })
    const cfcS = res.branches.find(b => b.code === 'CFC_SAL')
    expect(cfcS!.base_calcul).toBe(2_000_000)
    expect(cfcS!.montant_salarie).toBe(20_000)  // 2M × 1%
  })

})

// ═══════════════════════════════════════════════════════════════════════════════
// GROUPE 6 — TVA
// ═══════════════════════════════════════════════════════════════════════════════

describe('TVA multi-pays', () => {

  it('CG TVA 18% + CA 5% sur TVA = 18,9% effectif sur 100 000 HT', () => {
    const res = calculerTVA({ codePays: 'CG', montantHT: 100_000 })
    expect(res.tva_base).toBe(18_000)                                  // 100k × 18%
    expect(res.taxes_additionnelles[0].montant).toBe(900)              // 18 000 × 5%
    expect(res.tva_totale).toBe(18_900)
    expect(res.montant_ttc).toBe(118_900)
  })

  it('CM TVA 19,25% (taux officiel LF Cameroun — CAC intégré) = 19 250 sur 100 000 HT', () => {
    const res = calculerTVA({ codePays: 'CM', montantHT: 100_000 })
    expect(res.tva_base).toBe(19_250)                                  // 100k × 19,25%
    expect(res.taxes_additionnelles).toHaveLength(0)                   // CAC intégré dans taux_normal
    expect(res.tva_totale).toBe(19_250)
    expect(res.montant_ttc).toBe(119_250)
  })

  it('GA TVA 18% sans taxes additionnelles', () => {
    const res = calculerTVA({ codePays: 'GA', montantHT: 100_000 })
    expect(res.tva_base).toBe(18_000)
    expect(res.taxes_additionnelles).toHaveLength(0)
    expect(res.tva_totale).toBe(18_000)
  })

  it('CD TVA 16%', () => {
    const res = calculerTVA({ codePays: 'CD', montantHT: 100_000 })
    expect(res.tva_totale).toBe(16_000)
  })

  it('GQ TVA 15% (plus bas de la zone CEMAC)', () => {
    const res = calculerTVA({ codePays: 'GQ', montantHT: 100_000 })
    expect(res.tva_totale).toBe(15_000)
  })

  it('Taux zéro → TVA = 0, TTC = HT', () => {
    const res = calculerTVA({ codePays: 'CG', montantHT: 500_000, tauxZero: true })
    expect(res.tva_totale).toBe(0)
    expect(res.montant_ttc).toBe(500_000)
  })

  it('isAssujettieTVA — CG seuil 90M', () => {
    expect(isAssujettieTVA('CG', 89_999_999)).toBe(false)
    expect(isAssujettieTVA('CG', 90_000_000)).toBe(true)
  })

  it('isAssujettieTVA — CF seuil 30M (plus bas CEMAC)', () => {
    expect(isAssujettieTVA('CF', 29_999_999)).toBe(false)
    expect(isAssujettieTVA('CF', 30_000_000)).toBe(true)
  })

})

// ═══════════════════════════════════════════════════════════════════════════════
// GROUPE 7 — IS (Impôt sur les Sociétés)
// ═══════════════════════════════════════════════════════════════════════════════

describe('IS multi-pays', () => {

  it('CG IS 30% avec minimum 1% CA', () => {
    const res = calculerIS({ codePays: 'CG', beneficeNet: 5_000_000, chiffreAffairesHT: 100_000_000 })
    expect(res.is_au_taux_standard).toBe(1_500_000)   // 5M × 30%
    expect(res.is_minimum_ca).toBe(1_000_000)          // 100M × 1%
    expect(res.is_du).toBe(1_500_000)                  // max(1.5M, 1M)
  })

  it('CG IS minimum CA s\'applique si bénéfice faible', () => {
    const res = calculerIS({ codePays: 'CG', beneficeNet: 1_000_000, chiffreAffairesHT: 200_000_000 })
    // IS standard = 1M × 30% = 300k ; minimum CA = 200M × 1% = 2M → minimum s'applique
    expect(res.is_au_taux_standard).toBe(300_000)
    expect(res.is_minimum_ca).toBe(2_000_000)
    expect(res.is_du).toBe(2_000_000)
  })

  it('GA IS 35% · minimum 1,1% CA (Central Africa Tax Guide 2023)', () => {
    // benefice 500k × 35% = 175k ; CA 10M × 1,1% = 110k → max(175k, 110k) = 175k
    const res = calculerIS({ codePays: 'GA', beneficeNet: 500_000, chiffreAffairesHT: 10_000_000 })
    expect(res.is_au_taux_standard).toBe(175_000)   // 500k × 35%
    expect(res.is_minimum_ca).toBe(110_000)           // 10M × 1,1%
    expect(res.is_du).toBe(175_000)                   // max(175k, 110k) = 175k
  })

})

// ═══════════════════════════════════════════════════════════════════════════════
// GROUPE 8 — Retenues à la source
// ═══════════════════════════════════════════════════════════════════════════════

describe('Retenues à la source', () => {

  it('CG dividendes non résidents 20%', () => {
    const res = calculerRetenueSource({ codePays: 'CG', type: 'dividendes_non_residents', montantBrut: 1_000_000 })
    expect(res.taux).toBe(0.20)
    expect(res.retenue).toBe(200_000)
    expect(res.montant_net).toBe(800_000)
  })

  it('CG prestations non résidents 15%', () => {
    const res = calculerRetenueSource({ codePays: 'CG', type: 'prestations_non_residents', montantBrut: 500_000 })
    expect(res.retenue).toBe(75_000)   // 500k × 15%
  })

  it('CG honoraires résidents 5%', () => {
    const res = calculerRetenueSource({ codePays: 'CG', type: 'honoraires_residents', montantBrut: 200_000 })
    expect(res.retenue).toBe(10_000)   // 200k × 5%
  })

})

// ═══════════════════════════════════════════════════════════════════════════════
// GROUPE 9 — Résumé fiscal mensuel (chaîne complète)
// ═══════════════════════════════════════════════════════════════════════════════

describe('genererResumeFiscalMensuel — CG', () => {

  it('chaîne CNSS → IRPP → TOL → net pour brut 800 000, célibataire', () => {
    const res = genererResumeFiscalMensuel({
      codePays: 'CG', periode: '2026-06',
      salaireBrut: 800_000, situation: 'celibataire', nombreEnfants: 0,
    })

    // CNSS salarié
    expect(res.charges_sociales.total_salarie).toBe(32_000)   // 800k × 4%

    // base IRPP = 800k - 32k = 768 000
    expect(res.irpp.base_brut).toBe(768_000)

    // TOL 1 000 F
    expect(res.taxes_fixes).toHaveLength(1)
    expect(res.taxes_fixes[0].code).toBe('TOL')
    expect(res.taxes_fixes[0].montant).toBe(1_000)

    // total retenues = CNSS + IRPP + TOL
    expect(res.total_retenues_salariales).toBe(
      res.charges_sociales.total_salarie + res.irpp.irpp_net + 1_000,
    )

    // net = brut - retenues
    expect(res.net_theorique).toBe(800_000 - res.total_retenues_salariales)

    // data confidence verified
    expect(res.data_confidence).toBe('verified')
    expect(res.loi_reference).toContain('LF')
  })

  it('résumé CM : abattement 30% + CAC sur IRPP + pas de TOL', () => {
    const res = genererResumeFiscalMensuel({
      codePays: 'CM', periode: '2026-06',
      salaireBrut: 1_000_000, situation: 'celibataire', nombreEnfants: 0,
    })
    expect(res.irpp.abattement_montant).toBeGreaterThan(0)
    expect(res.irpp.centimes_additionnels).toBeGreaterThan(0)
    expect(res.taxes_fixes).toHaveLength(0)              // pas de TOL au Cameroun
    expect(res.data_confidence).toBe('to_verify')
  })

})

// ═══════════════════════════════════════════════════════════════════════════════
// GROUPE 10 — Utilitaires
// ═══════════════════════════════════════════════════════════════════════════════

describe('Utilitaires', () => {

  it('getSMIG CG = 90 000 FCFA', () => {
    const smig = getSMIG('CG')
    expect(smig.montant).toBe(90_000)
    expect(smig.devise).toBe('FCFA')
  })

  it('getSMIG GA = 150 000 FCFA', () => {
    expect(getSMIG('GA').montant).toBe(150_000)
  })

  it('getDataConfidence CG = verified', () => {
    const dc = getDataConfidence('CG')
    expect(dc.niveau).toBe('verified')
    expect(dc.loi_reference).toContain('LF')
  })

  it('getDataConfidence GA = to_verify (Central Africa Tax Guide 2023 partiel)', () => {
    expect(getDataConfidence('GA').niveau).toBe('to_verify')
  })

  it('getDataConfidence CD = to_verify', () => {
    expect(getDataConfidence('CD').niveau).toBe('to_verify')
  })

})

// ═══════════════════════════════════════════════════════════════════════════════
// GROUPE 11 — Cas limites
// ═══════════════════════════════════════════════════════════════════════════════

describe('Cas limites', () => {

  it('brut = 0 → IRPP = 0, CNSS = 0', () => {
    const irpp = calculerIRPP({ codePays: 'CG', salaireBrut: 0, situation: 'celibataire', nombreEnfants: 0 })
    const cnss = calculerChargesSociales({ codePays: 'CG', salaireBrut: 0 })
    expect(irpp.irpp_net).toBe(0)
    expect(cnss.total_salarie).toBe(0)
    expect(cnss.total_patronal_brut).toBe(0)
  })

  it('nombreEnfants négatif ignoré (traité comme 0)', () => {
    const normal = calculerIRPP({ codePays: 'CG', salaireBrut: 500_000, situation: 'celibataire', nombreEnfants: 0 })
    const negatif = calculerIRPP({ codePays: 'CG', salaireBrut: 500_000, situation: 'celibataire', nombreEnfants: -5 })
    expect(negatif.nombre_parts).toBe(normal.nombre_parts)
  })

  it('brut au plafond exact CG = 1 200 000 → CNSS salarié = 48 000', () => {
    const res = calculerChargesSociales({ codePays: 'CG', salaireBrut: 1_200_000 })
    expect(res.total_salarie).toBe(48_000)
  })

  it('brut = 1 200 001 → CNSS salarié reste 48 000 (plafond)', () => {
    const res = calculerChargesSociales({ codePays: 'CG', salaireBrut: 1_200_001 })
    const vidSal = res.branches.find(b => b.code === 'VID_SAL')
    expect(vidSal!.montant_salarie).toBe(48_000)
  })

  it('montant HT = 0 → TVA = 0', () => {
    const res = calculerTVA({ codePays: 'CG', montantHT: 0 })
    expect(res.tva_totale).toBe(0)
    expect(res.montant_ttc).toBe(0)
  })

})

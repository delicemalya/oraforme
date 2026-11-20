/**
 * lib/fiscal/universal-tax-engine.test.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Tests unitaires du UniversalTaxEngine
 *
 * Stratégie de validation :
 *   ① CG : règles CNSS/TUS/IRPP vérifiées contre documents réels ECAM Congo
 *      2024/2026 (Mission P0 paie 2026-09-17) — voir lib/fiscal/cg-paie-2026.test.ts
 *      pour les fixtures complètes. lib/fiscal/congo-calculs.ts est orphelin,
 *      non consommé, et n'est plus une référence (voir son en-tête).
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
// Référence : documents réels ECAM Congo (Mission P0 paie 2026-09-17)
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

  // PF 10,03% et TUS 5,475% — vérifiés exacts contre documents réels ECAM Congo
  // (CNSS_Cotisation_Fevrier_2026.docx, Model Declaration Mensuelle CNSS TUS
  // juin 2026, 20/20 salariés). Remplacent 10,035%/3%, non observés en 2026.
  // Mission P0 paie 2026-09-17 — voir lib/fiscal/cg-paie-2026.test.ts pour les
  // fixtures réelles complètes.
  it('VID patronal 8% + PF 10,03% + AT/MP 2,25% + TUS CNSS 5,475%', () => {
    const brut = 849_000
    const res  = calculerChargesSociales({ codePays: 'CG', salaireBrut: brut })

    const vidPat = res.branches.find(b => b.code === 'VID_PAT')
    const af     = res.branches.find(b => b.code === 'AF')
    const at     = res.branches.find(b => b.code === 'AT')
    const tus    = res.branches.find(b => b.code === 'TUS')

    expect(vidPat!.montant_patronal).toBe(Math.round(849_000 * 0.08))      // 67 920
    expect(af!.montant_patronal).toBe(Math.round(849_000 * 0.1003))        // 85 155
    expect(at!.montant_patronal).toBe(Math.round(600_000 * 0.0225))        // 13 500 (plafonné 600k — À confirmer, voir CG.ts)
    expect(tus!.montant_patronal).toBe(Math.round(849_000 * 0.05475))      // 46 483 (déplafonné)
  })

  it('AT plafonné à 600 000 (brut 849 000) — comportement actuel du code, plafond marqué À confirmer', () => {
    const res = calculerChargesSociales({ codePays: 'CG', salaireBrut: 849_000 })
    const at  = res.branches.find(b => b.code === 'AT')
    expect(at!.base_calcul).toBe(600_000)
    expect(at!.montant_patronal).toBe(13_500)
  })

  it('TUS CNSS 5,475% déplafonné (brut 2 000 000)', () => {
    const res = calculerChargesSociales({ codePays: 'CG', salaireBrut: 2_000_000 })
    const tus = res.branches.find(b => b.code === 'TUS')
    expect(tus!.base_calcul).toBe(2_000_000)
    expect(tus!.montant_patronal).toBe(109_500)             // 2M × 5,475%
  })

  it('aucune branche « TUS DGI » / 2,025% — non démontrée, non implémentée (Mission P0 paie 2026-09-17)', () => {
    const res = calculerChargesSociales({ codePays: 'CG', salaireBrut: 1_000_000 })
    expect(res.branches.find(b => b.taux_patronal === 0.02025)).toBeUndefined()
    expect(res.branches.filter(b => b.code.startsWith('TUS'))).toHaveLength(1)
  })

  it('getTauxCNSSSalarie CG = 4%', () => {
    expect(getTauxCNSSSalarie('CG')).toBeCloseTo(0.04)
  })

  it('getTauxCNSSPatronal CG ≈ 25,755%', () => {
    const taux = getTauxCNSSPatronal('CG')
    expect(taux).toBeCloseTo(0.08 + 0.1003 + 0.0225 + 0.05475, 3)   // 25,755%
  })

})

// ═══════════════════════════════════════════════════════════════════════════════
// GROUPE 2 — IRPP CONGO (CG)
// Méthode : annuelle_div12 (seuils annuels/part ÷12), quotient familial,
// abattement 20% sur (brut - CNSS salarié). Barème et abattement corrigés et
// vérifiés exacts contre 3 bulletins réels ECAM Congo janvier 2024 — Mission
// P0 paie 2026-09-17. Voir lib/fiscal/cg-paie-2026.test.ts pour ces fixtures
// réelles complètes (bulletins individuels, avec CNSS + abattement + parts).
// ═══════════════════════════════════════════════════════════════════════════════

describe('CG — IRPP', () => {

  it('méthode_base = annuelle_div12 pour CG (seuils ÷12, vérifié contre bulletins réels)', () => {
    const res = calculerIRPP({ codePays: 'CG', salaireBrut: 100_000, situation: 'celibataire', nombreEnfants: 0 })
    expect(res.methode_base).toBe('annuelle_div12')
  })

  it('abattement 20% sur (brut - CNSS salarié) — type pct_net_cnss', () => {
    const res = calculerIRPP({ codePays: 'CG', salaireBrut: 500_000, situation: 'celibataire', nombreEnfants: 0 })
    expect(res.abattement_type).toBe('pct_net_cnss')
    expect(res.abattement_montant).toBe(Math.round(500_000 * 0.20))   // 100 000
    expect(res.base_apres_abattement).toBe(500_000 - Math.round(500_000 * 0.20))   // 400 000
  })

  it('IRPP T1 seul (1%) — base après abattement sous le premier seuil/part (38 667)', () => {
    const res = calculerIRPP({ codePays: 'CG', salaireBrut: 40_000, situation: 'celibataire', nombreEnfants: 0 })
    // abattement 20% : base_apres = 40 000 - 8 000 = 32 000 (< 38 667 → tranche 1 seule, 1%)
    expect(res.irpp_net).toBe(Math.round(32_000 * 0.01))   // 320
  })

  it('IRPP traverse T1→T4 (base après abattement 800 000, 1 part)', () => {
    const res = calculerIRPP({ codePays: 'CG', salaireBrut: 1_000_000, situation: 'celibataire', nombreEnfants: 0 })
    // abattement 20% : base_apres = 800 000
    // T1 (1%) : 0 → 38 667  = 38 666,667 × 1%
    // T2 (10%): 38 667 → 83 333 = 44 666,667 × 10%
    // T3 (25%): 83 333 → 250 000 = 166 666,667 × 25%
    // T4 (40%): 250 000 → 800 000 = 550 000 × 40%
    const t1 = (464_000 / 12) * 0.01
    const t2 = (1_000_000 / 12 - 464_000 / 12) * 0.10
    const t3 = (3_000_000 / 12 - 1_000_000 / 12) * 0.25
    const t4 = (800_000 - 3_000_000 / 12) * 0.40
    expect(res.irpp_net).toBe(Math.round(t1 + t2 + t3 + t4))
    expect(res.tranches).toHaveLength(4)
  })

  it('nombreParts explicite prioritaire sur situation/nombreEnfants (rejoue un bulletin réel)', () => {
    const derive  = calculerIRPP({ codePays: 'CG', salaireBrut: 500_000, situation: 'celibataire', nombreEnfants: 1 })
    const force   = calculerIRPP({ codePays: 'CG', salaireBrut: 500_000, situation: 'celibataire', nombreEnfants: 1, nombreParts: 2 })
    expect(force.nombre_parts).toBe(2)
    expect(force.nombre_parts).not.toBe(derive.nombre_parts)
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

  it('4 tranches présentes dans la config CG (base élevée traverse T1→T4)', () => {
    const res = calculerIRPP({
      codePays: 'CG', salaireBrut: 10_000_000,
      situation: 'celibataire', nombreEnfants: 0,
    })
    // Toutes les tranches traversées : T1(1%) T2(10%) T3(25%) T4(40%) — pas de tranche 0%
    // (voir CG.ts : aucune tranche 0% observée dans les bulletins réels)
    expect(res.tranches.length).toBe(4)
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

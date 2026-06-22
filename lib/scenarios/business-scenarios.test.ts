/**
 * lib/scenarios/business-scenarios.test.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * VALIDATION MÉTIER COMPLÈTE — 4 pays réels
 *
 * Vérifie la cohérence de toute la chaîne :
 *   CountryConfig → UniversalTaxEngine → UniversalPayrollEngine → UI (résumés)
 *
 * Scénarios par pays :
 *   ▸ Créer employé + bulletin de paie
 *   ▸ Créer facture (TVA)
 *   ▸ Calculer IS entreprise
 *   ▸ Calculer dépense (TVA déductible / à reverser)
 *   ▸ Écriture comptable (fiscalité entreprise complète)
 *   ▸ Retenue à la source
 *   ▸ Résumé fiscal mensuel
 *
 * Pays : Congo-Brazzaville (CG) · Cameroun (CM) · RD Congo (CD) · Gabon (GA)
 */

import { describe, it, expect } from 'vitest'
import {
  calculerTVA,
  calculerIS,
  calculerIRPP,
  calculerChargesSociales,
  calculerRetenueSource,
  calculerFiscaliteEntreprise,
  genererResumeFiscalMensuel,
} from '../fiscal/universal-tax-engine'
import {
  genererBulletinPaie,
  type ProfilEmploye,
} from '../payroll/universal-payroll-engine'
import { getCountryConfig } from '../countries'

// ────────────────────────────────────────────────────────────────────────────
// Helpers fixtures
// ────────────────────────────────────────────────────────────────────────────

/** Employe universel sans primes, ancienneté < 3 ans → prime ancienneté = 0. */
function employe(
  codePays: 'CG' | 'CM' | 'CD' | 'GA',
  overrides: Partial<ProfilEmploye> = {},
): ProfilEmploye {
  return {
    id:                  `EMP-${codePays}-001`,
    nom:                 'Dupont',
    prenom:              'Alain',
    matricule:           `${codePays}001`,
    contexte:            { codePays },
    poste:               'Responsable Comptabilité',
    type_contrat:        'CDI',
    date_entree:         '2025-07-01',  // 11 mois → 0 tranche ancienneté tous pays
    situation_familiale: 'celibataire',
    nombre_enfants:      0,
    ...overrides,
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// ██████  CONGO-BRAZZAVILLE (CG)
// ═══════════════════════════════════════════════════════════════════════════════
//
// Référentiel fiscal LF 2026 :
//   TVA   18% + CA 5% sur TVA  → effectif 18,9% sur HT
//   IS    30%  + minimum 1% CA
//   IRPP  mensuelle_directe · 5 tranches · T1 exonéré ≤ 464k · taux 0/1/10/25/40%
//   CNSS  sal 4% VID (plaf. 1,2M) · pat VID 8% + AF 10,035% + AT 2,25% (plaf. 600k) + TUS 3%
//   TOL   1 000 FCFA/mois (taxe fixe mensuelle)

describe('CG — Congo-Brazzaville', () => {

  // ── TVA Facture ──────────────────────────────────────────────────────────────

  describe('TVA facture (HT = 1 000 000 FCFA)', () => {
    const r = calculerTVA({ codePays: 'CG', montantHT: 1_000_000 })

    it('TVA base 18% = 180 000', () => {
      expect(r.tva_base).toBe(180_000)
    })

    it('Centime Additionnel 5% sur TVA = 9 000', () => {
      expect(r.taxes_additionnelles).toHaveLength(1)
      expect(r.taxes_additionnelles[0].code).toBe('CA')
      expect(r.taxes_additionnelles[0].montant).toBe(9_000)
    })

    it('TVA totale = 189 000', () => {
      expect(r.tva_totale).toBe(189_000)
    })

    it('TTC = 1 189 000', () => {
      expect(r.montant_ttc).toBe(1_189_000)
    })

    it('taux effectif = 18,9% sur HT (depuis CountryConfig)', () => {
      expect(r.taux_effectif).toBe(0.189)
    })
  })

  // ── IS Entreprise ────────────────────────────────────────────────────────────

  describe('IS entreprise (bénéfice 2 000 000 / CA 10 000 000 FCFA)', () => {
    const r = calculerIS({ codePays: 'CG', beneficeNet: 2_000_000, chiffreAffairesHT: 10_000_000 })

    it('IS standard 30% = 600 000', () => {
      expect(r.is_au_taux_standard).toBe(600_000)
    })

    it('minimum de perception 1% CA = 100 000', () => {
      expect(r.is_minimum_ca).toBe(100_000)
    })

    it('IS dû = max(IS standard, minimum CA) = 600 000', () => {
      expect(r.is_du).toBe(600_000)
    })

    it('pas de taxes additionnelles IS Congo', () => {
      expect(r.taxes_additionnelles).toHaveLength(0)
    })

    it('IS total = 600 000', () => {
      expect(r.is_total).toBe(600_000)
    })
  })

  // ── Dépense / Écriture comptable (TVA nette à reverser) ─────────────────────

  describe('Écriture comptable — dépense + vente CG', () => {
    // Vente : CA HT 5M, TVA collectée = 5M × 18% = 900 000
    // Achat : HT 2M, TVA déductible = 2M × 18% = 360 000
    // TVA nette = 900 000 − 360 000 = 540 000 + CA 5% sur 900k = 45 000 → 585 000
    const r = calculerFiscaliteEntreprise({
      codePays:            'CG',
      chiffre_affaires_ht: 5_000_000,
      benefice_net:        1_500_000,
      tva_collectee:       900_000,
      tva_deductible:      360_000,
      retenues: [{ type: 'prestations_non_residents', montant: 1_000_000 }],
    })

    it('pays identifié = CG (CountryConfig)', () => {
      expect(r.codePays).toBe('CG')
      expect(r.nomPays).toBe('Congo-Brazzaville')
    })

    it('TVA nette à reverser = 540 000 (collectée − déductible)', () => {
      // tva_totale = (900k − 360k) + CA 5% sur 900k = 540k + 45k = 585k
      expect(r.tva.tva_totale).toBe(585_000)
    })

    it('IS dû sur bénéfice 1 500 000 = 450 000', () => {
      expect(r.is.is_du).toBe(450_000)
    })

    it('retenue prestataire non-résident 15% × 1M = 150 000', () => {
      expect(r.retenues_source[0].taux).toBe(0.15)
      expect(r.retenues_source[0].retenue).toBe(150_000)
    })
  })

  // ── Retenue à la source ──────────────────────────────────────────────────────

  describe('Retenue à la source — dividendes non-résidents', () => {
    const r = calculerRetenueSource({ codePays: 'CG', type: 'dividendes_non_residents', montantBrut: 500_000 })

    it('taux 20% (depuis CountryConfig.retenues_source)', () => {
      expect(r.taux).toBe(0.20)
    })

    it('retenue = 100 000', () => {
      expect(r.retenue).toBe(100_000)
    })

    it('montant net = 400 000', () => {
      expect(r.montant_net).toBe(400_000)
    })
  })

  // ── Charges sociales CNSS ────────────────────────────────────────────────────

  describe('Charges sociales — brut 800 000 FCFA', () => {
    const r = calculerChargesSociales({ codePays: 'CG', salaireBrut: 800_000 })

    it('CNSS salarié (VID 4% × 800k) = 32 000', () => {
      expect(r.total_salarie).toBe(32_000)
    })

    it('CNSS patronal = VID 8% + AF 10,035% + AT 2,25% (plaf. 600k) + TUS 3% = 181 780', () => {
      // VID 8% × 800k = 64 000
      // AF 10,035% × 800k = 80 280
      // AT 2,25% × 600k (plaf.) = 13 500
      // TUS 3% × 800k = 24 000
      // Total = 181 780
      expect(r.total_patronal_net).toBe(181_780)
    })

    it('5 branches déclarées dans CountryConfig', () => {
      expect(r.branches).toHaveLength(5)
    })

    it('AT plafonné à 600k (< 800k brut)', () => {
      const at = r.branches.find(b => b.code === 'AT')!
      expect(at.plafond_applique).toBe(600_000)
      expect(at.base_calcul).toBe(600_000)
      expect(at.montant_patronal).toBe(13_500)
    })

    it('TUS déplafonné (plafond null — LF 2026)', () => {
      const tus = r.branches.find(b => b.code === 'TUS')!
      expect(tus.plafond_applique).toBeNull()
      expect(tus.base_calcul).toBe(800_000)
    })
  })

  // ── IRPP mensuelle_directe ───────────────────────────────────────────────────

  describe('IRPP — base 768 000 FCFA (brut 800k − CNSS 32k)', () => {
    const r = calculerIRPP({ codePays: 'CG', salaireBrut: 768_000, situation: 'celibataire', nombreEnfants: 0 })

    it('abattement = 0 (aucun — Art. 76 CGI)', () => {
      expect(r.abattement_montant).toBe(0)
      expect(r.abattement_type).toBe('aucun')
    })

    it('méthode = mensuelle_directe', () => {
      expect(r.methode_base).toBe('mensuelle_directe')
    })

    it('1 part (célibataire)', () => {
      expect(r.nombre_parts).toBe(1)
    })

    it('T1 exonéré (0% ≤ 464 000) = 0', () => {
      const t1 = r.tranches[0]
      expect(t1.taux).toBe(0)
      expect(t1.impot_total).toBe(0)
    })

    it('T2 à 1% : (768 000 − 464 001) × 1% = 3 040', () => {
      // Math.round(303 999 × 0.01) = Math.round(3 039.99) = 3 040
      expect(r.irpp_net).toBe(3_040)
    })

    it('pas de centimes additionnels Congo', () => {
      expect(r.centimes_additionnels).toBe(0)
    })
  })

  // ── Bulletin de paie complet ─────────────────────────────────────────────────

  describe('Bulletin de paie — salaire 800 000 FCFA', () => {
    const b = genererBulletinPaie({
      periode:      '2026-06',
      employe:      employe('CG'),
      salaire_base: 800_000,
    })

    it('pays = CG (depuis CountryConfig)', () => {
      expect(b.pays.code).toBe('CG')
      expect(b.pays.devise).toBe('FCFA')
    })

    it('ancienneté = 0 (11 mois < 3 ans)', () => {
      expect(b.anciennete.prime_montant).toBe(0)
      expect(b.anciennete.annees_completes).toBe(0)
    })

    it('brut imposable = 800 000 (pas de primes)', () => {
      expect(b.bruts.salaire_brut_imposable).toBe(800_000)
      expect(b.bruts.salaire_brut_total).toBe(800_000)
    })

    it('CNSS salarié = 32 000', () => {
      expect(b.cotisations.total_salarie).toBe(32_000)
    })

    it('CNSS patronal = 181 780', () => {
      expect(b.cotisations.total_patronal_net).toBe(181_780)
    })

    it('IRPP = 3 040', () => {
      expect(b.irpp.irpp_net).toBe(3_040)
    })

    it('TOL = 1 000 FCFA (taxe fixe mensuelle)', () => {
      expect(b.taxes_fixes).toHaveLength(1)
      expect(b.taxes_fixes[0].code).toBe('TOL')
      expect(b.taxes_fixes[0].montant).toBe(1_000)
    })

    it('net à payer = 800k − 32k − 3 040 − 1 000 = 763 960', () => {
      expect(b.net_a_payer).toBe(763_960)
    })

    it('coût employeur = 800k + 181 780 = 981 780', () => {
      expect(b.cout_employeur).toBe(981_780)
    })
  })

  // ── Cohérence chaîne ─────────────────────────────────────────────────────────

  describe('Cohérence chaîne CG : CountryConfig → TaxEngine → PayrollEngine', () => {
    const brut = 800_000
    const b    = genererBulletinPaie({ periode: '2026-06', employe: employe('CG'), salaire_base: brut })
    const cs   = calculerChargesSociales({ codePays: 'CG', salaireBrut: brut })
    const irpp = calculerIRPP({ codePays: 'CG', salaireBrut: brut - cs.total_salarie, situation: 'celibataire', nombreEnfants: 0 })
    const cfg  = getCountryConfig('CG')

    it('bulletin.cnss_salarie == calculerChargesSociales.total_salarie', () => {
      expect(b.cotisations.total_salarie).toBe(cs.total_salarie)
    })

    it('bulletin.irpp == calculerIRPP(brut − cnss)', () => {
      expect(b.irpp.irpp_net).toBe(irpp.irpp_net)
    })

    it('bulletin.taxes_fixes vient de CountryConfig.taxes_fixes', () => {
      const tolConfig = cfg.taxes_fixes.find(t => t.code === 'TOL')!
      expect(tolConfig.montant).toBe(b.taxes_fixes[0].montant)
    })

    it('bulletin.net = brut − cnss − irpp − taxes_fixes', () => {
      const attendu = brut - cs.total_salarie - irpp.irpp_net - 1_000
      expect(b.net_a_payer).toBe(attendu)
    })

    it('résumé fiscal mensuel == bulletin (net identique)', () => {
      const r = genererResumeFiscalMensuel({
        codePays: 'CG', periode: '2026-06',
        salaireBrut: brut, situation: 'celibataire', nombreEnfants: 0,
      })
      expect(r.net_theorique).toBe(b.net_a_payer)
      expect(r.cout_employeur_mensuel).toBe(b.cout_employeur)
    })
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// ██████  CAMEROUN (CM)
// ═══════════════════════════════════════════════════════════════════════════════
//
// Référentiel fiscal :
//   TVA   19,25% (taux officiel — 17,5% + CAC 10% intégré dans taux_normal)
//   IS    30% + CAC IS 10% → effectif 33%
//   IRPP  annuelle_div12 · 4 tranches · abattement 30% · CAC 10% sur IRPP
//   CNSS  sal CNPS 4,2% (plaf. 750k) + CFC 1% · pat CNPS 11,2% + CFC 1,5% + FNE 1%

describe('CM — Cameroun', () => {

  // ── TVA Facture ──────────────────────────────────────────────────────────────

  describe('TVA facture (HT = 1 000 000 FCFA)', () => {
    const r = calculerTVA({ codePays: 'CM', montantHT: 1_000_000 })

    it('TVA 19,25% (CAC intégré dans taux_normal) = 192 500', () => {
      expect(r.tva_base).toBe(192_500)
    })

    it('pas de taxes additionnelles séparées (CAC déjà dans taux)', () => {
      expect(r.taxes_additionnelles).toHaveLength(0)
    })

    it('TVA totale = 192 500', () => {
      expect(r.tva_totale).toBe(192_500)
    })

    it('TTC = 1 192 500', () => {
      expect(r.montant_ttc).toBe(1_192_500)
    })
  })

  // ── IS Entreprise ────────────────────────────────────────────────────────────

  describe('IS entreprise (bénéfice 2 000 000 / CA 10 000 000 FCFA)', () => {
    const r = calculerIS({ codePays: 'CM', beneficeNet: 2_000_000, chiffreAffairesHT: 10_000_000 })

    it('IS standard 30% = 600 000', () => {
      expect(r.is_au_taux_standard).toBe(600_000)
    })

    it('pas de minimum de perception CA (non configuré CM)', () => {
      expect(r.is_minimum_ca).toBe(0)
    })

    it('IS dû = 600 000', () => {
      expect(r.is_du).toBe(600_000)
    })

    it('CAC IS 10% sur IS = 60 000', () => {
      expect(r.taxes_additionnelles).toHaveLength(1)
      expect(r.taxes_additionnelles[0].code).toBe('CAC_IS')
      expect(r.taxes_additionnelles[0].montant).toBe(60_000)
    })

    it('IS total (IS + CAC) = 660 000', () => {
      expect(r.is_total).toBe(660_000)
    })
  })

  // ── Retenue à la source ──────────────────────────────────────────────────────

  describe('Retenue à la source — dividendes non-résidents', () => {
    const r = calculerRetenueSource({ codePays: 'CM', type: 'dividendes_non_residents', montantBrut: 500_000 })

    it('taux 15% (inférieur CG 20%)', () => {
      expect(r.taux).toBe(0.15)
    })

    it('retenue = 75 000', () => {
      expect(r.retenue).toBe(75_000)
    })
  })

  // ── Charges sociales CNPS ────────────────────────────────────────────────────

  describe('Charges sociales — brut 600 000 FCFA', () => {
    const r = calculerChargesSociales({ codePays: 'CM', salaireBrut: 600_000 })

    it('CNPS sal 4,2% × 600k (< 750k plafond) + CFC 1% × 600k = 31 200', () => {
      // CNPS_SAL = Math.round(600k × 4.2%) = 25 200
      // CFC_SAL  = Math.round(600k × 1%)   = 6 000
      // Total = 31 200
      expect(r.total_salarie).toBe(31_200)
    })

    it('patronal CNPS 11,2% × 600k + CFC 1,5% + FNE 1% = 82 200', () => {
      // CNPS_PAT = Math.round(600k × 11.2%) = 67 200
      // CFC_PAT  = Math.round(600k × 1.5%)  = 9 000
      // FNE      = Math.round(600k × 1%)    = 6 000
      // Total = 82 200
      expect(r.total_patronal_net).toBe(82_200)
    })

    it('CNPS plafonné à 750k (brut 600k < plafond → base = 600k)', () => {
      const cnps = r.branches.find(b => b.code === 'CNPS_SAL')!
      expect(cnps.plafond_applique).toBe(750_000)
      expect(cnps.base_calcul).toBe(600_000)
    })
  })

  // ── IRPP avec abattement 30% + CAC ──────────────────────────────────────────

  describe('IRPP — base 568 800 FCFA (600k − 31 200 CNSS)', () => {
    const r = calculerIRPP({ codePays: 'CM', salaireBrut: 568_800, situation: 'celibataire', nombreEnfants: 0 })

    it('abattement 30% = 170 640', () => {
      expect(r.abattement_montant).toBe(170_640)
      expect(r.abattement_type).toBe('pct_net_cnss')
    })

    it('base après abattement = 398 160', () => {
      expect(r.base_apres_abattement).toBe(398_160)
    })

    it('méthode = annuelle_div12', () => {
      expect(r.methode_base).toBe('annuelle_div12')
    })

    it('IRPP avant CAC = 66 207', () => {
      expect(r.irpp_avant_centimes).toBe(66_207)
    })

    it('CAC 10% sur IRPP = 6 621', () => {
      expect(r.centimes_additionnels).toBe(6_621)
    })

    it('IRPP net = 72 828 (IRPP + CAC)', () => {
      expect(r.irpp_net).toBe(72_828)
    })

    it('quotient familial inactif pour CM → 1 part fixe', () => {
      expect(r.nombre_parts).toBe(1)
    })
  })

  // ── Bulletin de paie complet ─────────────────────────────────────────────────

  describe('Bulletin de paie — salaire 600 000 FCFA', () => {
    const b = genererBulletinPaie({
      periode:      '2026-06',
      employe:      employe('CM'),
      salaire_base: 600_000,
    })

    it('pays = CM (depuis CountryConfig)', () => {
      expect(b.pays.code).toBe('CM')
    })

    it('CNSS salarié = 31 200', () => {
      expect(b.cotisations.total_salarie).toBe(31_200)
    })

    it('CNSS patronal = 82 200', () => {
      expect(b.cotisations.total_patronal_net).toBe(82_200)
    })

    it('IRPP net = 72 828', () => {
      expect(b.irpp.irpp_net).toBe(72_828)
    })

    it('pas de taxes fixes CM', () => {
      expect(b.taxes_fixes).toHaveLength(0)
    })

    it('net à payer = 600k − 31 200 − 72 828 = 495 972', () => {
      expect(b.net_a_payer).toBe(495_972)
    })

    it('coût employeur = 600k + 82 200 = 682 200', () => {
      expect(b.cout_employeur).toBe(682_200)
    })
  })

  // ── Cohérence chaîne CM ──────────────────────────────────────────────────────

  describe('Cohérence chaîne CM : CountryConfig → TaxEngine → PayrollEngine', () => {
    const brut = 600_000
    const b    = genererBulletinPaie({ periode: '2026-06', employe: employe('CM'), salaire_base: brut })
    const cs   = calculerChargesSociales({ codePays: 'CM', salaireBrut: brut })
    const irpp = calculerIRPP({ codePays: 'CM', salaireBrut: brut - cs.total_salarie, situation: 'celibataire', nombreEnfants: 0 })

    it('bulletin.cnss == calculerChargesSociales', () => {
      expect(b.cotisations.total_salarie).toBe(cs.total_salarie)
      expect(b.cotisations.total_patronal_net).toBe(cs.total_patronal_net)
    })

    it('bulletin.irpp == calculerIRPP(brut − cnss)', () => {
      expect(b.irpp.irpp_net).toBe(irpp.irpp_net)
    })

    it('bulletin.irpp.abattement_type = pct_net_cnss (CountryConfig CM)', () => {
      expect(b.irpp.abattement_type).toBe('pct_net_cnss')
    })

    it('résumé fiscal mensuel net == bulletin net', () => {
      const r = genererResumeFiscalMensuel({
        codePays: 'CM', periode: '2026-06',
        salaireBrut: brut, situation: 'celibataire', nombreEnfants: 0,
      })
      expect(r.net_theorique).toBe(b.net_a_payer)
      expect(r.cout_employeur_mensuel).toBe(b.cout_employeur)
    })
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// ██████  RD CONGO (CD)
// ═══════════════════════════════════════════════════════════════════════════════
//
// Référentiel fiscal LF N°25/060 du 29/12/2025 :
//   TVA   16%
//   IS    IBP 30% + minimum taxe 1% CA
//   IPR   annuelle_div12 · 10 tranches · seuil exonération 524 160 CDF/an (≈ 43 680/mois)
//   INSS  sal 3,5% + pat 13%, déplafonné

describe('CD — RD Congo', () => {

  // ── TVA Facture ──────────────────────────────────────────────────────────────

  describe('TVA facture (HT = 1 000 000 CDF)', () => {
    const r = calculerTVA({ codePays: 'CD', montantHT: 1_000_000 })

    it('TVA 16% = 160 000 CDF', () => {
      expect(r.tva_base).toBe(160_000)
    })

    it('pas de taxes additionnelles RDC', () => {
      expect(r.taxes_additionnelles).toHaveLength(0)
    })

    it('TTC = 1 160 000 CDF', () => {
      expect(r.montant_ttc).toBe(1_160_000)
    })
  })

  // ── IS/IBP Entreprise ────────────────────────────────────────────────────────

  describe('IBP entreprise (bénéfice 2 000 000 / CA 10 000 000 CDF)', () => {
    const r = calculerIS({ codePays: 'CD', beneficeNet: 2_000_000, chiffreAffairesHT: 10_000_000 })

    it('IBP standard 30% = 600 000', () => {
      expect(r.is_au_taux_standard).toBe(600_000)
    })

    it('taxe minimale 1% CA = 100 000 (LF N°25/060)', () => {
      expect(r.is_minimum_ca).toBe(100_000)
    })

    it('IBP dû = max(600k, 100k) = 600 000', () => {
      expect(r.is_du).toBe(600_000)
    })

    it('IBP total = 600 000 (pas de taxes additionnelles)', () => {
      expect(r.is_total).toBe(600_000)
    })
  })

  // ── Retenue à la source ──────────────────────────────────────────────────────

  describe('Retenue à la source — prestations non-résidents RDC', () => {
    const r = calculerRetenueSource({ codePays: 'CD', type: 'prestations_non_residents', montantBrut: 500_000 })

    it('taux 14% (Code fiscal RDC)', () => {
      expect(r.taux).toBe(0.14)
    })

    it('retenue = 70 000 CDF', () => {
      expect(r.retenue).toBe(70_000)
    })

    it('montant net = 430 000 CDF', () => {
      expect(r.montant_net).toBe(430_000)
    })
  })

  // ── INSS (CNSS RDC) ──────────────────────────────────────────────────────────

  describe('INSS — brut 500 000 CDF', () => {
    const r = calculerChargesSociales({ codePays: 'CD', salaireBrut: 500_000 })

    it('INSS salarié 3,5% × 500k = 17 500 CDF', () => {
      expect(r.total_salarie).toBe(17_500)
    })

    it('INSS patronal 13% × 500k = 65 000 CDF', () => {
      expect(r.total_patronal_net).toBe(65_000)
    })

    it('INSS déplafonné (plafond null)', () => {
      const inss = r.branches.find(b => b.code === 'INSS_SAL')!
      expect(inss.plafond_applique).toBeNull()
      expect(inss.base_calcul).toBe(500_000)
    })

    it('2 branches INSS (salarié + patronal)', () => {
      expect(r.branches).toHaveLength(2)
    })
  })

  // ── IPR (IRPP RDC) — 10 tranches annuelles ──────────────────────────────────

  describe('IPR — base 482 500 CDF (500k − 17 500 INSS)', () => {
    const r = calculerIRPP({ codePays: 'CD', salaireBrut: 482_500, situation: 'celibataire', nombreEnfants: 0 })

    it('abattement = 0 (aucun)', () => {
      expect(r.abattement_montant).toBe(0)
    })

    it('méthode = annuelle_div12 (barème annuel LF N°25/060)', () => {
      expect(r.methode_base).toBe('annuelle_div12')
    })

    it('quotient familial inactif RDC → 1 part', () => {
      expect(r.nombre_parts).toBe(1)
    })

    it('T1 exonéré (0% ≤ 43 680 CDF/mois) → 0', () => {
      // Seuil annuel 524 160 / 12 = 43 680/mois
      const t1 = r.tranches[0]
      expect(t1.impot_total).toBe(0)
    })

    it('IPR net = 92 873 CDF (5 tranches actives)', () => {
      // T2 15%: (119k-43.68k)×0.15 = 75320×0.15 = 11298
      // T3 20%: (225k-119k)×0.20 = 106000×0.20 = 21200
      // T4 22,5%: (385k-225k)×0.225 = 160000×0.225 = 36000
      // T5 25%: (482.5k-385k)×0.25 = 97500×0.25 = 24375
      // Total = 92 873
      expect(r.irpp_net).toBe(92_873)
    })

    it('5 tranches actives (T1 traversée à 0%)', () => {
      expect(r.tranches.length).toBeGreaterThanOrEqual(5)
    })
  })

  // ── Bulletin de paie complet ─────────────────────────────────────────────────

  describe('Bulletin de paie — salaire 500 000 CDF', () => {
    const b = genererBulletinPaie({
      periode:      '2026-06',
      employe:      employe('CD'),
      salaire_base: 500_000,
    })

    it('pays = CD, devise = CDF', () => {
      expect(b.pays.code).toBe('CD')
      expect(b.pays.devise).toBe('CDF')
    })

    it('INSS salarié = 17 500', () => {
      expect(b.cotisations.total_salarie).toBe(17_500)
    })

    it('INSS patronal = 65 000', () => {
      expect(b.cotisations.total_patronal_net).toBe(65_000)
    })

    it('IPR = 92 873', () => {
      expect(b.irpp.irpp_net).toBe(92_873)
    })

    it('pas de taxes fixes RDC', () => {
      expect(b.taxes_fixes).toHaveLength(0)
    })

    it('net à payer = 500k − 17 500 − 92 873 = 389 627 CDF', () => {
      expect(b.net_a_payer).toBe(389_627)
    })

    it('coût employeur = 500k + 65k = 565 000 CDF', () => {
      expect(b.cout_employeur).toBe(565_000)
    })
  })

  // ── Cohérence chaîne CD ──────────────────────────────────────────────────────

  describe('Cohérence chaîne CD : CountryConfig → TaxEngine → PayrollEngine', () => {
    const brut = 500_000
    const b    = genererBulletinPaie({ periode: '2026-06', employe: employe('CD'), salaire_base: brut })
    const cs   = calculerChargesSociales({ codePays: 'CD', salaireBrut: brut })
    const ipr  = calculerIRPP({ codePays: 'CD', salaireBrut: brut - cs.total_salarie, situation: 'celibataire', nombreEnfants: 0 })

    it('bulletin.inss == calculerChargesSociales.total_salarie', () => {
      expect(b.cotisations.total_salarie).toBe(cs.total_salarie)
    })

    it('bulletin.ipr == calculerIRPP(brut − inss)', () => {
      expect(b.irpp.irpp_net).toBe(ipr.irpp_net)
    })

    it('résumé fiscal mensuel net == bulletin net', () => {
      const r = genererResumeFiscalMensuel({
        codePays: 'CD', periode: '2026-06',
        salaireBrut: brut, situation: 'celibataire', nombreEnfants: 0,
      })
      expect(r.net_theorique).toBe(b.net_a_payer)
    })
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// ██████  GABON (GA)
// ═══════════════════════════════════════════════════════════════════════════════
//
// Référentiel fiscal :
//   TVA   18% (normal) · 5% (réduit)
//   IS    35% + minimum 1,1% CA (minimum 600k FCFA)
//   IRPP  annuelle_div12 · 8 tranches · T1 exonéré ≤ 1,5M/an · abattement 20%
//   CNSS  sal 2,5% (plaf. 1,5M) · pat 20,1% (plaf. 1,5M)

describe('GA — Gabon', () => {

  // ── TVA Facture ──────────────────────────────────────────────────────────────

  describe('TVA facture (HT = 1 000 000 FCFA)', () => {
    const r = calculerTVA({ codePays: 'GA', montantHT: 1_000_000 })

    it('TVA 18% (taux normal) = 180 000', () => {
      expect(r.tva_base).toBe(180_000)
    })

    it('pas de taxes additionnelles Gabon', () => {
      expect(r.taxes_additionnelles).toHaveLength(0)
    })

    it('TTC = 1 180 000', () => {
      expect(r.montant_ttc).toBe(1_180_000)
    })
  })

  // ── IS Entreprise ────────────────────────────────────────────────────────────

  describe('IS entreprise (bénéfice 2 000 000 / CA 10 000 000 FCFA)', () => {
    const r = calculerIS({ codePays: 'GA', beneficeNet: 2_000_000, chiffreAffairesHT: 10_000_000 })

    it('IS standard 35% = 700 000', () => {
      expect(r.is_au_taux_standard).toBe(700_000)
    })

    it('minimum de perception 1,1% CA = 110 000', () => {
      expect(r.is_minimum_ca).toBe(110_000)
    })

    it('IS dû = max(700k, 110k) = 700 000', () => {
      expect(r.is_du).toBe(700_000)
    })

    it('IS total = 700 000 (pas de CAC Gabon)', () => {
      expect(r.is_total).toBe(700_000)
    })
  })

  // ── Retenue à la source ──────────────────────────────────────────────────────

  describe('Retenue à la source — dividendes non-résidents', () => {
    const r = calculerRetenueSource({ codePays: 'GA', type: 'dividendes_non_residents', montantBrut: 500_000 })

    it('taux 20%', () => {
      expect(r.taux).toBe(0.20)
    })

    it('retenue = 100 000', () => {
      expect(r.retenue).toBe(100_000)
    })
  })

  // ── CNSS Gabon ────────────────────────────────────────────────────────────────

  describe('Charges sociales — brut 500 000 FCFA', () => {
    const r = calculerChargesSociales({ codePays: 'GA', salaireBrut: 500_000 })

    it('CNSS salarié 2,5% × 500k = 12 500', () => {
      expect(r.total_salarie).toBe(12_500)
    })

    it('CNSS patronal 20,1% × 500k = 100 500', () => {
      // Math.round(500 000 × 0.201) = Math.round(100 500) = 100 500
      expect(r.total_patronal_net).toBe(100_500)
    })

    it('plafond CNSS = 1 500 000 (brut 500k < plafond → base = 500k)', () => {
      const sal = r.branches.find(b => b.code === 'CNSS_SAL')!
      expect(sal.plafond_applique).toBe(1_500_000)
      expect(sal.base_calcul).toBe(500_000)
    })
  })

  // ── IRPP 8 tranches + abattement 20% ────────────────────────────────────────

  describe('IRPP — base 487 500 FCFA (500k − 12 500 CNSS)', () => {
    const r = calculerIRPP({ codePays: 'GA', salaireBrut: 487_500, situation: 'celibataire', nombreEnfants: 0 })

    it('abattement 20% = 97 500', () => {
      expect(r.abattement_montant).toBe(97_500)
    })

    it('base après abattement = 390 000', () => {
      expect(r.base_apres_abattement).toBe(390_000)
    })

    it('méthode = annuelle_div12', () => {
      expect(r.methode_base).toBe('annuelle_div12')
    })

    it('T1 exonéré (0% ≤ 125 000/mois = 1 500 000/an) → impôt T1 = 0', () => {
      const t1 = r.tranches[0]
      expect(t1.taux).toBe(0)
      expect(t1.impot_total).toBe(0)
    })

    it('IRPP net = 37 500 FCFA (4 tranches actives T2→T5)', () => {
      // T2 5%: (160k-125k)×0.05 ≈ 1 750
      // T3 10%: (225k-160k)×0.10 ≈ 6 500
      // T4 15%: (300k-225k)×0.15 ≈ 11 250
      // T5 20%: (390k-300k)×0.20 ≈ 18 000
      // Total ≈ 37 500
      expect(r.irpp_net).toBe(37_500)
    })

    it('pas de centimes additionnels Gabon', () => {
      expect(r.centimes_additionnels).toBe(0)
    })
  })

  // ── Bulletin de paie complet ─────────────────────────────────────────────────

  describe('Bulletin de paie — salaire 500 000 FCFA', () => {
    const b = genererBulletinPaie({
      periode:      '2026-06',
      employe:      employe('GA'),
      salaire_base: 500_000,
    })

    it('pays = GA', () => {
      expect(b.pays.code).toBe('GA')
    })

    it('CNSS salarié = 12 500', () => {
      expect(b.cotisations.total_salarie).toBe(12_500)
    })

    it('CNSS patronal = 100 500', () => {
      expect(b.cotisations.total_patronal_net).toBe(100_500)
    })

    it('IRPP = 37 500', () => {
      expect(b.irpp.irpp_net).toBe(37_500)
    })

    it('pas de taxes fixes Gabon', () => {
      expect(b.taxes_fixes).toHaveLength(0)
    })

    it('net à payer = 500k − 12 500 − 37 500 = 450 000 FCFA', () => {
      expect(b.net_a_payer).toBe(450_000)
    })

    it('coût employeur = 500k + 100 500 = 600 500 FCFA', () => {
      expect(b.cout_employeur).toBe(600_500)
    })
  })

  // ── Cohérence chaîne GA ──────────────────────────────────────────────────────

  describe('Cohérence chaîne GA : CountryConfig → TaxEngine → PayrollEngine', () => {
    const brut = 500_000
    const b    = genererBulletinPaie({ periode: '2026-06', employe: employe('GA'), salaire_base: brut })
    const cs   = calculerChargesSociales({ codePays: 'GA', salaireBrut: brut })
    const irpp = calculerIRPP({ codePays: 'GA', salaireBrut: brut - cs.total_salarie, situation: 'celibataire', nombreEnfants: 0 })

    it('bulletin.cnss == calculerChargesSociales', () => {
      expect(b.cotisations.total_salarie).toBe(cs.total_salarie)
      expect(b.cotisations.total_patronal_net).toBe(cs.total_patronal_net)
    })

    it('bulletin.irpp == calculerIRPP(brut − cnss)', () => {
      expect(b.irpp.irpp_net).toBe(irpp.irpp_net)
    })

    it('résumé fiscal mensuel == bulletin', () => {
      const r = genererResumeFiscalMensuel({
        codePays: 'GA', periode: '2026-06',
        salaireBrut: brut, situation: 'celibataire', nombreEnfants: 0,
      })
      expect(r.net_theorique).toBe(b.net_a_payer)
      expect(r.cout_employeur_mensuel).toBe(b.cout_employeur)
    })
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// ██████  COHÉRENCE INTER-PAYS — Validation croisée
// ═══════════════════════════════════════════════════════════════════════════════

describe('Inter-pays — Cohérence et différenciateurs', () => {

  // ── IS : Gabon plus cher que les autres ──────────────────────────────────────

  describe('IS comparatif (même bénéfice 2M / CA 10M)', () => {
    const isCG = calculerIS({ codePays: 'CG', beneficeNet: 2_000_000, chiffreAffairesHT: 10_000_000 })
    const isCM = calculerIS({ codePays: 'CM', beneficeNet: 2_000_000, chiffreAffairesHT: 10_000_000 })
    const isCD = calculerIS({ codePays: 'CD', beneficeNet: 2_000_000, chiffreAffairesHT: 10_000_000 })
    const isGA = calculerIS({ codePays: 'GA', beneficeNet: 2_000_000, chiffreAffairesHT: 10_000_000 })

    it('IS total GA (700k) > IS total CG (600k) — taux 35% vs 30%', () => {
      expect(isGA.is_total).toBeGreaterThan(isCG.is_total)
    })

    it('IS total CM (660k) > IS total CG (600k) — CAC 10% Cameroun', () => {
      expect(isCM.is_total).toBeGreaterThan(isCG.is_total)
    })

    it('IS total CD = IS total CG = 600 000 (même taux 30%, pas de CAC)', () => {
      expect(isCD.is_total).toBe(isCG.is_total)
    })

    it('classement fiscal IS : GA > CM > CG = CD', () => {
      expect(isGA.is_total).toBe(700_000)
      expect(isCM.is_total).toBe(660_000)
      expect(isCG.is_total).toBe(600_000)
      expect(isCD.is_total).toBe(600_000)
    })
  })

  // ── TVA : différenciateurs entre pays ────────────────────────────────────────

  describe('TVA comparatif (même HT 1 000 000)', () => {
    const tvaCG = calculerTVA({ codePays: 'CG', montantHT: 1_000_000 })
    const tvaCM = calculerTVA({ codePays: 'CM', montantHT: 1_000_000 })
    const tvaCD = calculerTVA({ codePays: 'CD', montantHT: 1_000_000 })
    const tvaGA = calculerTVA({ codePays: 'GA', montantHT: 1_000_000 })

    it('TVA CM (192 500) > TVA CG (189 000) > TVA GA/CD', () => {
      expect(tvaCM.tva_totale).toBeGreaterThan(tvaCG.tva_totale)
      expect(tvaCG.tva_totale).toBeGreaterThan(tvaGA.tva_totale)
    })

    it('TVA GA = TVA CG (même taux 18%) hors CA', () => {
      // CG a un CA 5% en plus → tva_totale CG > tva_totale GA
      expect(tvaGA.tva_totale).toBe(180_000)
      expect(tvaCG.tva_totale).toBe(189_000)
    })

    it('TVA CD la plus basse = 160 000 (taux 16%)', () => {
      expect(tvaCD.tva_totale).toBe(160_000)
      expect(tvaCD.tva_totale).toBeLessThan(tvaGA.tva_totale)
    })

    it('TVA CM intègre CAC (taxes_additionnelles = 0)', () => {
      expect(tvaCM.taxes_additionnelles).toHaveLength(0)
    })

    it('TVA CG a un CA séparé (taxes_additionnelles = 1)', () => {
      expect(tvaCG.taxes_additionnelles).toHaveLength(1)
      expect(tvaCG.taxes_additionnelles[0].taux).toBe(0.05)
    })
  })

  // ── Coût employeur comparé ────────────────────────────────────────────────────

  describe('Coût employeur comparé (même salaire base 500 000)', () => {
    const bCG = genererBulletinPaie({ periode: '2026-06', employe: employe('CG'), salaire_base: 500_000 })
    const bCM = genererBulletinPaie({ periode: '2026-06', employe: employe('CM'), salaire_base: 500_000 })
    const bCD = genererBulletinPaie({ periode: '2026-06', employe: employe('CD'), salaire_base: 500_000 })
    const bGA = genererBulletinPaie({ periode: '2026-06', employe: employe('GA'), salaire_base: 500_000 })

    it('CG patronal 116 425 (5 branches ~23,3% effectif à 500k)', () => {
      // VID_PAT 8%×500k=40k + AF 10,035%×500k=50175 + AT 2,25%×500k=11250 + TUS 3%×500k=15k = 116 425
      expect(bCG.cotisations.total_patronal_net).toBe(116_425)
    })

    it('GA patronal 100 500 (20,1%×500k)', () => {
      expect(bGA.cotisations.total_patronal_net).toBe(100_500)
    })

    it('classement patronal à 500k : CG > GA > CM > CD', () => {
      // CG a 5 branches cumulées dépassant 20% effectif même à 500k
      expect(bCG.cotisations.total_patronal_net).toBeGreaterThan(bGA.cotisations.total_patronal_net)
      expect(bGA.cotisations.total_patronal_net).toBeGreaterThan(bCM.cotisations.total_patronal_net)
      expect(bCM.cotisations.total_patronal_net).toBeGreaterThan(bCD.cotisations.total_patronal_net)
    })

    it('net CG > net CM (CNSS + IRPP CG plus faibles à 500k)', () => {
      expect(bCG.net_a_payer).toBeGreaterThan(bCM.net_a_payer)
    })

    it('chaque pays a ses propres taxes fixes (CG=TOL, CM/CD/GA=rien)', () => {
      expect(bCG.taxes_fixes).toHaveLength(1)
      expect(bCM.taxes_fixes).toHaveLength(0)
      expect(bCD.taxes_fixes).toHaveLength(0)
      expect(bGA.taxes_fixes).toHaveLength(0)
    })
  })

  // ── CNSS salarié comparé ────────────────────────────────────────────────────────────

  describe('CNSS salarié comparé (même salaire brut 500 000)', () => {
    const cgS = calculerChargesSociales({ codePays: 'CG', salaireBrut: 500_000 })
    const cmS = calculerChargesSociales({ codePays: 'CM', salaireBrut: 500_000 })
    const cdS = calculerChargesSociales({ codePays: 'CD', salaireBrut: 500_000 })
    const gaS = calculerChargesSociales({ codePays: 'GA', salaireBrut: 500_000 })

    it('CNSS salarié CG = 20 000 (4% × 500k)', () => {
      expect(cgS.total_salarie).toBe(20_000)
    })

    it('CNSS salarié CM = 26 000 (CNPS 4.2% + CFC 1% × 500k)', () => {
      // CNPS_SAL: 4.2% × min(500k, 750k) = 21 000
      // CFC_SAL:  1% × 500k = 5 000
      expect(cmS.total_salarie).toBe(26_000)
    })

    it('INSS salarié CD = 17 500 (3,5% × 500k)', () => {
      expect(cdS.total_salarie).toBe(17_500)
    })

    it('CNSS salarié GA = 12 500 (2,5% × 500k)', () => {
      expect(gaS.total_salarie).toBe(12_500)
    })

    it('taux salarié du plus fort au plus faible : CM > CG > CD > GA', () => {
      expect(cmS.total_salarie).toBeGreaterThan(cgS.total_salarie)
      expect(cgS.total_salarie).toBeGreaterThan(cdS.total_salarie)
      expect(cdS.total_salarie).toBeGreaterThan(gaS.total_salarie)
    })
  })

  // ── Quotient familial CG vs CM/CD/GA ─────────────────────────────────────────

  describe('Quotient familial CG (actif) vs CM/CD/GA (inactif)', () => {
    const marie2CG = calculerIRPP({ codePays: 'CG', salaireBrut: 700_000, situation: 'marie', nombreEnfants: 2 })
    const marie2CM = calculerIRPP({ codePays: 'CM', salaireBrut: 700_000, situation: 'marie', nombreEnfants: 2 })

    it('CG marié 2 enfants = 3 parts (QF actif)', () => {
      expect(marie2CG.nombre_parts).toBe(3)
    })

    it('CM marié 2 enfants = 1 part (QF inactif)', () => {
      expect(marie2CM.nombre_parts).toBe(1)
    })

    it('IRPP CG marié 2 enfants < IRPP CG célibataire (même brut)', () => {
      const celCG = calculerIRPP({ codePays: 'CG', salaireBrut: 700_000, situation: 'celibataire', nombreEnfants: 0 })
      expect(marie2CG.irpp_net).toBeLessThan(celCG.irpp_net)
    })
  })

  // ── Fiscalité entreprise complète 4 pays ─────────────────────────────────────

  describe('Fiscalité entreprise complète (mêmes inputs 4 pays)', () => {
    const input = {
      chiffre_affaires_ht: 5_000_000,
      benefice_net:        2_000_000,
      tva_collectee:       900_000,
      tva_deductible:      400_000,
    }

    const feCG = calculerFiscaliteEntreprise({ codePays: 'CG', ...input })
    const feCM = calculerFiscaliteEntreprise({ codePays: 'CM', ...input })
    const feCD = calculerFiscaliteEntreprise({ codePays: 'CD', ...input })
    const feGA = calculerFiscaliteEntreprise({ codePays: 'GA', ...input })

    it('CG nomPays = Congo-Brazzaville', () => {
      expect(feCG.nomPays).toBe('Congo-Brazzaville')
    })

    it('CM nomPays = Cameroun', () => {
      expect(feCM.nomPays).toBe('Cameroun')
    })

    it('CD nomPays = RD Congo (Kinshasa)', () => {
      expect(feCD.nomPays).toBe('RD Congo (Kinshasa)')
    })

    it('GA nomPays = Gabon', () => {
      expect(feGA.nomPays).toBe('Gabon')
    })

    it('IS total GA > IS total CM > IS total CG = IS total CD', () => {
      expect(feGA.is.is_total).toBeGreaterThan(feCM.is.is_total)
      expect(feCM.is.is_total).toBeGreaterThan(feCG.is.is_total)
      expect(feCG.is.is_total).toBe(feCD.is.is_total)
    })

    it('loi_reference vient de CountryConfig (non-vide)', () => {
      expect(feCG.loi_reference).toBeTruthy()
      expect(feCM.loi_reference).toBeTruthy()
      expect(feCD.loi_reference).toBeTruthy()
      expect(feGA.loi_reference).toBeTruthy()
    })
  })
})

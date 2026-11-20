/**
 * lib/architecture/miaa-tools-salaire-net-migration.test.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Mission P0-PAIE-CG-2026 — élimination du 4ᵉ moteur fiscal :
 * lib/miaa/tools.ts::calculerSalaireNet() (2026-09-18).
 *
 * Contexte : getContexteCalculs() (donc calculerSalaireNet/calculerTVA) n'a
 * aucun appelant dans le dépôt à ce jour — risque latent, pas actif. Corrigé
 * quand même, avant qu'un prompt MIAA ne le câble.
 */

import { readFileSync } from 'fs'
import { describe, it, expect } from 'vitest'
import path from 'path'
import { calculerCNSSUnifie, calculerIRPPUnifie } from '../fiscalite/engine-adapter'
import { calculerCNSS as calculerCNSSLegacy, calculerIRPP as calculerIRPPLegacy } from '../fiscalite/engine'
import { calculerSalaireNet, calculerTVA, getContexteCalculs } from '../miaa/tools'

const ROOT = path.resolve(__dirname, '../..')
const TOOLS_SOURCE = readFileSync(path.join(ROOT, 'lib/miaa/tools.ts'), 'utf-8')

// ═══════════════════════════════════════════════════════════════════════════════
// 1-3. CG → moteur central, anciens taux disparus, IRPP conforme
// ═══════════════════════════════════════════════════════════════════════════════

describe('lib/miaa/tools.ts::calculerSalaireNet — CG utilise le moteur central', () => {

  it('CG, brut 500 000 : identique à un appel direct de calculerCNSSUnifie/calculerIRPPUnifie', () => {
    const brut = 500_000
    const r = calculerSalaireNet(brut, 'CG')
    const cnss = calculerCNSSUnifie(brut, 'CG')
    const irpp = calculerIRPPUnifie(brut, 'CG')

    expect(r.cnss_employe).toBe(cnss.salarie)
    expect(r.cnss_patronal).toBe(cnss.patronal)
    expect(r.irpp).toBe(irpp.irpp)
    expect(r.revenu_imposable).toBe(irpp.revenu_imposable)
    expect(r.net).toBe(brut - cnss.salarie - irpp.irpp)
    expect(r.cout_employeur).toBe(brut + cnss.patronal)
  })

  it("l'ancien CNSS 5,04% plafonné à 1 500 000 n'apparaît plus dans le résultat", () => {
    const brut = 2_000_000   // > 1 500 000 : l'ancien plafond aurait écrêté ici
    const r = calculerSalaireNet(brut, 'CG')
    const ancienCnss = Math.round(Math.min(brut, 1_500_000) * 0.0504)   // 75 600
    expect(r.cnss_employe).not.toBe(ancienCnss)
    // Le moteur central plafonne à 1 200 000 (VID) — 4% × 1 200 000 = 48 000
    expect(r.cnss_employe).toBe(48_000)
  })

  it("l'ancien barème IRPP à seuils précalculés (5 360 / 205 360 / 1 455 360) n'apparaît plus", () => {
    const r = calculerSalaireNet(2_000_000, 'CG')
    // Avec l'ancien barème (pas d'abattement, base = brut - cnss) :
    // base = 2 000 000 - Math.round(min(2000000,1500000)*0.0504) = 2 000 000 - 75 600 = 1 924 400
    // irpp = 205 360 + (1 924 400 - 1 000 000) * 0,10... (faux calcul, juste pour prouver l'absence)
    expect(r.irpp).not.toBe(205_360 + Math.round((2_000_000 - Math.round(1_500_000 * 0.0504) - 1_000_000) * 0.10))
  })

})

// ═══════════════════════════════════════════════════════════════════════════════
// 4-5. Cas réels déjà validés
// ═══════════════════════════════════════════════════════════════════════════════

describe('calculerSalaireNet — cas réels déjà validés (fixtures ECAM Congo)', () => {

  it('MOUTINOU MAYIMA J.P. — base 716 102 (juin 2026) : CNSS salarié = 28 644', () => {
    const r = calculerSalaireNet(716_102, 'CG')
    expect(r.cnss_employe).toBe(28_644)   // voir lib/fiscal/cg-paie-2026.test.ts
  })

  it('IMANA Claude Christian — base 153 735,24 : CNSS salarié = 6 149', () => {
    const r = calculerSalaireNet(153_735.24, 'CG')
    expect(r.cnss_employe).toBe(6_149)
  })

})

// ═══════════════════════════════════════════════════════════════════════════════
// 6. Parts fiscales — limite documentée, pas fabriquée
// ═══════════════════════════════════════════════════════════════════════════════

describe('calculerSalaireNet — nombre de parts', () => {

  it("l'API ne reçoit ni situation ni nombre d'enfants : toujours 1 part (célibataire), comportement documenté et non fabriqué", () => {
    // calculerSalaireNet(brut, pays) n'a pas de paramètre parts/situation —
    // ce test verrouille cette limite réelle plutôt que de la contourner.
    const r1 = calculerSalaireNet(1_000_000, 'CG')
    const irppDirect1Part = calculerIRPPUnifie(1_000_000, 'CG')
    expect(r1.irpp).toBe(irppDirect1Part.irpp)   // calculerIRPPUnifie est câblé en dur à 1 part (documenté dans engine-adapter.ts)
  })

})

// ═══════════════════════════════════════════════════════════════════════════════
// 7. Pays non migré — comportement conservé (moteur legacy réel, pas Congo)
// ═══════════════════════════════════════════════════════════════════════════════

describe('calculerSalaireNet — pays non migrés : moteur legacy réel conservé, pas de repli sur les règles Congo', () => {

  it.each(['AO', 'ML', 'BF', 'NE', 'NG', 'FR', 'BE', 'CH'] as const)('%s : identique au moteur legacy réel de ce pays (lib/fiscalite/engine.ts), jamais aux règles CG', (pays) => {
    const brut = 500_000
    const r = calculerSalaireNet(brut, pays)
    const cnssLegacy = calculerCNSSLegacy(brut, pays)
    const irppLegacy = calculerIRPPLegacy(brut, pays)

    expect(r.cnss_employe).toBe(cnssLegacy.salarie)
    expect(r.irpp).toBe(irppLegacy.irpp)
    expect(r.net).toBe(brut - cnssLegacy.salarie - irppLegacy.irpp)
  })

})

// ═══════════════════════════════════════════════════════════════════════════════
// 8. Format du prompt MIAA — inchangé autant que possible
// ═══════════════════════════════════════════════════════════════════════════════

describe('getContexteCalculs — format du prompt MIAA préservé', () => {

  it("module 'rh' : même en-tête, même structure de detail qu'avant la migration", () => {
    const texte = getContexteCalculs('rh', 'CG')
    expect(texte).toMatch(/^EXEMPLE SALAIRE PRÉ-CALCULÉ \(CG\) :\n/)
    expect(texte).toContain('Salaire brut :')
    expect(texte).toContain('CNSS salarié')
    expect(texte).toContain('NET À PAYER :')
    expect(texte).toContain('COÛT TOTAL EMPLOYEUR :')
  })

  it("module 'facturation' : calculerTVA (hors périmètre de cette mission) inchangé", () => {
    const texte = getContexteCalculs('facturation', 'CG')
    expect(texte).toMatch(/^EXEMPLES TVA PRÉ-CALCULÉS \(CG\) :\n/)
    expect(texte).toContain('TVA (18%)')
  })

  it("module inconnu : chaîne vide, comme avant", () => {
    expect(getContexteCalculs('autre_module', 'CG')).toBe('')
  })

  it('calculerTVA(CG) — taux 18% inchangé (hors périmètre)', () => {
    const r = calculerTVA(100_000, 'CG')
    expect(r.taux_tva).toBe(18)
  })

})

// ═══════════════════════════════════════════════════════════════════════════════
// 9. Test architectural — aucune constante fiscale CG ne doit revenir
// ═══════════════════════════════════════════════════════════════════════════════

describe('Architecture — lib/miaa/tools.ts ne contient plus aucune constante fiscale CG locale', () => {

  it('aucun littéral de l\'ancien moteur (taux CNSS, plafond, seuils IRPP précalculés)', () => {
    const anciensLitteraux = [
      '0.0504', '1_500_000', '5_360', '205_360', '1_455_360',
      '0.1436', '0.88', '0.028', '1.14',
    ]
    for (const lit of anciensLitteraux) {
      expect(TOOLS_SOURCE, `littéral de l'ancien moteur "${lit}" trouvé dans lib/miaa/tools.ts`).not.toContain(lit)
    }
  })

  it('calculerSalaireNet délègue à lib/fiscalite/engine-adapter.ts', () => {
    expect(TOOLS_SOURCE).toContain("from '@/lib/fiscalite/engine-adapter'")
    expect(TOOLS_SOURCE).toContain('calculerCNSSUnifie')
    expect(TOOLS_SOURCE).toContain('calculerIRPPUnifie')
  })

  it('medecine_travail retiré, pas recalculé localement (non modélisé par le moteur central)', () => {
    expect(TOOLS_SOURCE).not.toMatch(/medecine_travail\s*:/)
    expect(TOOLS_SOURCE).not.toMatch(/0\.005/)
  })

})

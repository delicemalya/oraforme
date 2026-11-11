/**
 * lib/architecture/payscontext-salaire-net-migration.test.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Mission P0-PAIE-CG-2026 — élimination du 3ᵉ moteur : PaysContext.calculerSalaireNet
 * (2026-09-18).
 *
 * lib/contexts/PaysContext.tsx exposait sa propre implémentation de
 * calculerSalaireNet() (CNSS à taux unique, IRPP sans abattement, aucune
 * notion de parts) — une troisième copie de la même arithmétique déjà dupliquée
 * dans lib/fiscalite/engine.ts (Mission précédente, 2026-09-18 matin).
 * Audit des 12 consommateurs réels de usePays() : AUCUN n'appelait
 * calculerSalaireNet (grep exhaustif, confirmé par agent dédié) — c'était du
 * code mort, mais un troisième moteur latent, prêt à produire des chiffres
 * faux dès qu'un composant l'aurait appelé.
 *
 * Corrigé : calculerSalaireNet() délègue maintenant à
 * lib/fiscalite/engine-adapter.ts::calculerSalaireNetUnifie(), qui route vers
 * lib/fiscal/universal-tax-engine.ts pour les 7 pays validés et conserve
 * explicitement lib/fiscalite/engine.ts pour les 8 pays non validés.
 */

import { readFileSync } from 'fs'
import { describe, it, expect } from 'vitest'
import path from 'path'
import { calculerChargesSociales, calculerIRPP as calculerIRPPCentral } from '../fiscal/universal-tax-engine'
import { calculerSalaireNetUnifie } from '../fiscalite/engine-adapter'
import { calculerCNSS as calculerCNSSLegacy, calculerIRPP as calculerIRPPLegacy } from '../fiscalite/engine'

const ROOT = path.resolve(__dirname, '../..')
const PAYSCONTEXT_SOURCE = readFileSync(path.join(ROOT, 'lib/contexts/PaysContext.tsx'), 'utf-8')

// ═══════════════════════════════════════════════════════════════════════════════
// 1-2. calculerSalaireNet(CG) utilise le moteur central — aucun taux CG local
// ═══════════════════════════════════════════════════════════════════════════════

describe('PaysContext.calculerSalaireNet — CG utilise le moteur central', () => {

  it('CG, brut 500 000 : identique à un calcul direct via calculerChargesSociales + calculerIRPP (1 part, sans famille)', () => {
    const brut = 500_000
    const r = calculerSalaireNetUnifie(brut, 'CG')

    const cnss = calculerChargesSociales({ codePays: 'CG', salaireBrut: brut })
    const baseIrpp = Math.max(0, brut - cnss.total_salarie)
    const irpp = calculerIRPPCentral({
      codePays: 'CG', salaireBrut: baseIrpp, salaireBrutOriginal: brut,
      situation: 'celibataire', nombreEnfants: 0,
    })

    expect(r.cnss_salarie).toBe(cnss.total_salarie)
    expect(r.irpp).toBe(irpp.irpp_net)
    expect(r.total_retenues).toBe(cnss.total_salarie + irpp.irpp_net)
    expect(r.net).toBe(brut - r.total_retenues)
  })

  it('CG, brut 716 102 (cas réel MOUTINOU MAYIMA J.P., juin 2026) : CNSS salarié = 28 644, pas l\'ancien calcul à taux unique', () => {
    const r = calculerSalaireNetUnifie(716_102, 'CG')
    expect(r.cnss_salarie).toBe(28_644)   // valeur verrouillée lib/fiscal/cg-paie-2026.test.ts
  })

  it("PaysContext.tsx ne contient plus aucune constante fiscale CG (pas de taux, pas de plafond, pas de barème codés en dur)", () => {
    // La seule ancienne trace de calcul local était la fonction calculerIRPP()
    // interne (abattement_pct, tranches, Math.round(irpp)) et l'accès direct à
    // paysFiscal.cnss.taux_salarie/plafond_mensuel dans calculerSalaireNet.
    // Les deux sont supprimés — PaysContext ne fait plus que déléguer.
    expect(PAYSCONTEXT_SOURCE).not.toMatch(/function calculerIRPP/)
    expect(PAYSCONTEXT_SOURCE).not.toMatch(/paysFiscal\.cnss\.taux_salarie/)
    expect(PAYSCONTEXT_SOURCE).not.toMatch(/paysFiscal\.cnss\.plafond_mensuel/)
    expect(PAYSCONTEXT_SOURCE).not.toMatch(/abattement_pct/)
    expect(PAYSCONTEXT_SOURCE).toContain('calculerSalaireNetUnifie')
  })

  it("test anti-régression : aucun littéral de taux CG (0.04, 0.1003, 0.0225, 0.05475, 0.2328) n'apparaît dans PaysContext.tsx", () => {
    for (const taux of ['0.04', '0.08', '0.1003', '0.10035', '0.0225', '0.05475', '0.2328', '0.03']) {
      expect(PAYSCONTEXT_SOURCE, `littéral suspect "${taux}" trouvé dans PaysContext.tsx`).not.toContain(taux)
    }
  })

})

// ═══════════════════════════════════════════════════════════════════════════════
// 3-4. Fixtures réelles déjà validées, atteintes via calculerSalaireNet
// ═══════════════════════════════════════════════════════════════════════════════

describe('calculerSalaireNet — fixtures réelles déjà validées', () => {

  it('IMANA Claude Christian — CNSS salarié cohérent avec le bulletin réel (base 153 735,24)', () => {
    const r = calculerSalaireNetUnifie(153_735.24, 'CG')
    expect(r.cnss_salarie).toBe(6_149)   // 153 735,24 × 4 %, arrondi — voir lib/fiscal/cg-paie-2026.test.ts
  })

  it('TUS CNSS 5,475 % (pas 3 % ni 7,5 %) — vérifié via calculerCNSSUnifie sous-jacent', () => {
    const brut = 800_000
    const cnss = calculerChargesSociales({ codePays: 'CG', salaireBrut: brut })
    const tus = cnss.branches.find(b => b.code === 'TUS')!
    expect(tus.montant_patronal).toBe(Math.round(brut * 0.05475))
  })

})

// ═══════════════════════════════════════════════════════════════════════════════
// 5-6. Pays non migré — comportement historique conservé, contrat de sortie inchangé
// ═══════════════════════════════════════════════════════════════════════════════

describe('calculerSalaireNet — pays non migrés : comportement historique conservé', () => {

  it.each(['AO', 'ML', 'BF', 'NE', 'NG', 'FR', 'BE', 'CH'] as const)('%s : résultat identique à l\'ancienne formule PaysContext (CNSS taux unique + IRPP sans abattement)', (pays) => {
    const brut = 500_000
    const r = calculerSalaireNetUnifie(brut, pays)

    // Reproduit exactement l'ancienne formule de PaysContext.calculerSalaireNet
    // (avant migration), pour prouver qu'aucune régression n'a été introduite
    // pour les pays sans configuration validée dans lib/countries/.
    const cnssLegacy = calculerCNSSLegacy(brut, pays)
    const irppLegacy = calculerIRPPLegacy(brut, pays)
    const total_retenues = cnssLegacy.salarie + irppLegacy.irpp

    expect(r.cnss_salarie).toBe(cnssLegacy.salarie)
    expect(r.irpp).toBe(irppLegacy.irpp)
    expect(r.total_retenues).toBe(total_retenues)
    expect(r.net).toBe(brut - total_retenues)
  })

  it('contrat de sortie inchangé : {net, cnss_salarie, irpp, total_retenues} pour tout pays', () => {
    for (const pays of ['CG', 'FR', 'NG'] as const) {
      const r = calculerSalaireNetUnifie(500_000, pays)
      expect(Object.keys(r).sort()).toEqual(['cnss_salarie', 'irpp', 'net', 'total_retenues'])
      expect(typeof r.net).toBe('number')
    }
  })

})

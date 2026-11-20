/**
 * lib/architecture/fiscalite-engine-migration.test.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Mission P0-PAIE-CG-2026 — élimination du second moteur fiscal (2026-09-18).
 *
 * Verrouille :
 *  1. lib/fiscalite/engine-adapter.ts route les 7 pays migrés (CG, CM, GA, CD,
 *     CF, TD, GQ) vers lib/fiscal/universal-tax-engine.ts — résultats
 *     identiques à un appel direct du moteur central.
 *  2. Les 8 pays non migrés (AO, ML, BF, NE, NG, FR, BE, CH) continuent de
 *     fonctionner via l'ancien moteur — aucune perte fonctionnelle.
 *  3. Le contrat de sortie de l'API CNSS et de la page IRPP est inchangé.
 *  4. Aucun consommateur de production n'importe les fonctions de calcul
 *     fiscal de lib/fiscalite/engine.ts directement — seul l'adaptateur le
 *     fait, pour le repli explicite sur les pays non migrés.
 */

import { readFileSync } from 'fs'
import { sync as globSync } from 'glob'
import { describe, it, expect } from 'vitest'
import path from 'path'
import {
  calculerCNSSUnifie, calculerIRPPUnifie, calculerCNSSAggregeUnifie,
  getConfigAffichageUnifie, paysMigreVersCentral,
} from '../fiscalite/engine-adapter'
import { calculerCNSS as calculerCNSSLegacy, calculerIRPP as calculerIRPPLegacy } from '../fiscalite/engine'
import { calculerChargesSociales, calculerIRPP as calculerIRPPCentral } from '../fiscal/universal-tax-engine'

const ROOT = path.resolve(__dirname, '../..')

// ═══════════════════════════════════════════════════════════════════════════════
// 1. Pays migrés — résultats identiques au moteur central
// ═══════════════════════════════════════════════════════════════════════════════

describe('engine-adapter — pays migrés (CG, CM, GA, CD, CF, TD, GQ) délèguent au moteur central', () => {

  it.each(['CG', 'CM', 'GA', 'CD', 'CF', 'TD', 'GQ'] as const)('%s : paysMigreVersCentral() = true', (pays) => {
    expect(paysMigreVersCentral(pays)).toBe(true)
  })

  it('CG, brut 716 102 (cas réel MOUTINOU MAYIMA J.P., juin 2026) : CNSS identique à un appel direct du moteur central', () => {
    const brut = 716_102
    const viaAdaptateur = calculerCNSSUnifie(brut, 'CG')
    const direct = calculerChargesSociales({ codePays: 'CG', salaireBrut: brut })
    expect(viaAdaptateur.salarie).toBe(direct.total_salarie)
    expect(viaAdaptateur.patronal).toBe(direct.total_patronal_net)
    expect(viaAdaptateur.salarie).toBe(28_644)     // valeur verrouillée lib/fiscal/cg-paie-2026.test.ts
    expect(viaAdaptateur.patronal).not.toBe(Math.round(brut * 0.2328))   // ancien taux fusionné, ne doit plus apparaître
  })

  it('CG, brut 500 000 : IRPP (1 part, sans famille) identique à un appel direct du moteur central', () => {
    const brut = 500_000
    const viaAdaptateur = calculerIRPPUnifie(brut, 'CG')
    const cnss = calculerChargesSociales({ codePays: 'CG', salaireBrut: brut })
    const baseIrpp = Math.max(0, brut - cnss.total_salarie)
    const direct = calculerIRPPCentral({
      codePays: 'CG', salaireBrut: baseIrpp, salaireBrutOriginal: brut,
      situation: 'celibataire', nombreEnfants: 0,
    })
    expect(viaAdaptateur.irpp).toBe(direct.irpp_net)
    expect(viaAdaptateur.abattement).toBe(direct.abattement_montant)
    expect(viaAdaptateur.abattement).toBeGreaterThan(0)   // abattement 20% désormais appliqué (ancien moteur : 0)
  })

  it("CG : la configuration d'affichage (barème, taux) vient de lib/countries/CG.ts, pas de lib/fiscalite/pays.ts", () => {
    const cfg = getConfigAffichageUnifie('CG')
    expect(cfg.cnss.taux_patronal).toBeCloseTo(0.08 + 0.1003 + 0.0225 + 0.05475, 4)   // 25,755% — pas 0.2328
    expect(cfg.irpp.abattement_pct).toBe(0.20)                                       // pas 0
    expect(cfg.irpp.tranches[0].taux).toBe(0.01)                                     // pas de tranche 0% en premier
  })

  it('CNSS agrégée (déclaration) : CM/GA/CD utilisent le moteur central, pas lib/fiscalite/pays.ts', () => {
    const employes = [{ salaire_brut: 500_000 }, { salaire_brut: 900_000 }]
    for (const pays of ['CM', 'GA', 'CD'] as const) {
      const viaAdaptateur = calculerCNSSAggregeUnifie(employes, pays)
      let attSalarie = 0, attPatronal = 0
      for (const e of employes) {
        const r = calculerChargesSociales({ codePays: pays, salaireBrut: e.salaire_brut })
        attSalarie += r.total_salarie
        attPatronal += r.total_patronal_net
      }
      expect(viaAdaptateur.cotisation_salarie).toBe(attSalarie)
      expect(viaAdaptateur.cotisation_patronale).toBe(attPatronal)
    }
  })

})

// ═══════════════════════════════════════════════════════════════════════════════
// 2. Pays NON migrés — aucune perte fonctionnelle (repli explicite sur l'ancien moteur)
// ═══════════════════════════════════════════════════════════════════════════════

describe("engine-adapter — pays non migrés (aucune config dans lib/countries/) : repli sur l'ancien moteur, pas de perte", () => {

  it.each(['AO', 'ML', 'BF', 'NE', 'NG', 'FR', 'BE', 'CH'] as const)('%s : paysMigreVersCentral() = false', (pays) => {
    expect(paysMigreVersCentral(pays)).toBe(false)
  })

  it('FR, brut 3 000 : le résultat de calculerCNSSUnifie/calculerIRPPUnifie est identique à un appel direct de l\'ancien moteur (rien perdu)', () => {
    const brut = 3_000
    expect(calculerCNSSUnifie(brut, 'FR')).toEqual(calculerCNSSLegacy(brut, 'FR'))
    expect(calculerIRPPUnifie(brut, 'FR')).toEqual(calculerIRPPLegacy(brut, 'FR'))
  })

  it('NG, ML, BF, NE, AO, BE, CH : simulateur toujours fonctionnel (aucune exception, contrat de sortie préservé)', () => {
    for (const pays of ['NG', 'ML', 'BF', 'NE', 'AO', 'BE', 'CH'] as const) {
      const cnss = calculerCNSSUnifie(500_000, pays)
      const irpp = calculerIRPPUnifie(500_000, pays)
      expect(typeof cnss.salarie).toBe('number')
      expect(typeof irpp.irpp).toBe('number')
      expect(cnss).toEqual(calculerCNSSLegacy(500_000, pays))
    }
  })

})

// ═══════════════════════════════════════════════════════════════════════════════
// 3. Architecture — zéro consommateur de production du second moteur
// ═══════════════════════════════════════════════════════════════════════════════

describe("Architecture — aucun consommateur de production n'importe lib/fiscalite/engine.ts pour calculer CNSS/IRPP", () => {

  // Seul l'adaptateur a le droit d'appeler ces fonctions (repli explicite,
  // documenté, sur les 8 pays non migrés). Tout autre import direct de
  // calculerCNSS/calculerIRPP/calculerCNSSAggrege depuis lib/fiscalite/engine
  // recrée le second moteur que cette mission élimine.
  const ADAPTER_FILE = 'lib/fiscalite/engine-adapter.ts'

  it('aucun fichier de production (hors adaptateur et tests) n\'importe calculerCNSS/calculerIRPP/calculerCNSSAggrege depuis lib/fiscalite/engine', () => {
    const files = globSync('{app,components,lib}/**/*.{ts,tsx}', { cwd: ROOT, absolute: false, windowsPathsNoEscape: true })
      .filter(f => !f.endsWith('.test.ts') && !f.endsWith('.test.tsx'))
      .filter(f => f.replace(/\\/g, '/') !== ADAPTER_FILE)
      .filter(f => !f.replace(/\\/g, '/').startsWith('lib/fiscalite/engine.ts'))

    const offenders: string[] = []
    const namedRe  = /\b(calculerCNSS|calculerCNSSAggrege|calculerIRPP)\b/

    for (const rel of files) {
      const abs = path.join(ROOT, rel)
      let content: string
      try { content = readFileSync(abs, 'utf-8') } catch { continue }
      // Ne retient que les fichiers qui importent réellement depuis .../fiscalite/engine
      const importMatch = content.match(/import\s*\{([^}]*)\}\s*from\s*['"]([^'"]*fiscalite\/engine)['"]/)
      if (!importMatch) continue
      const importedNames = importMatch[1]
      if (namedRe.test(importedNames)) offenders.push(`${rel} → { ${importedNames.trim()} }`)
    }

    expect(offenders, `Import direct de fonctions de calcul fiscal depuis lib/fiscalite/engine (doit passer par ${ADAPTER_FILE}) :\n${offenders.join('\n')}`).toEqual([])
  })

  it('lib/fiscalite/engine-adapter.ts est bien le seul point d\'entrée applicatif pour CNSS/IRPP multi-pays dans les 2 consommateurs migrés', () => {
    const irppPage = readFileSync(path.join(ROOT, 'app/dashboard/fiscalite/irpp/page.tsx'), 'utf-8')
    const cnssRoute = readFileSync(path.join(ROOT, 'app/api/fiscalite/cnss/route.ts'), 'utf-8')
    expect(irppPage).toContain("from '@/lib/fiscalite/engine-adapter'")
    expect(cnssRoute).toContain("from '@/lib/fiscalite/engine-adapter'")
    expect(irppPage).not.toMatch(/\bcalculerCNSS\(|\bcalculerIRPP\(/)
    expect(cnssRoute).not.toMatch(/calculerCNSSAggrege\(/)
  })

})

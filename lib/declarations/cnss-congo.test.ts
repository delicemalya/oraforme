/**
 * P0-01 — Déclaration CNSS Congo : les montants du document.
 *
 * Le défaut corrigé : les allocations familiales étaient assises sur le plafond
 * AT/MP de 600 000 F au lieu de leur propre plafond de 1 200 000 F. Pour un
 * salarié au-dessus du plafond, la déclaration sous-déclarait 60 240 F par mois.
 *
 * Ces attendus viennent de lib/countries/CG.ts, branche par branche. Si CG.ts
 * change, ce fichier doit changer avec lui — et c'est voulu : un montant porté
 * sur un document officiel ne doit jamais bouger sans que quelqu'un le voie.
 */

import { describe, it, expect } from 'vitest'
import {
  calculerCNSSEmploye,
  calculerDeclarationGlobale,
  _selfTestCNSS,
  fmtTaux,
  fmtPlafond,
} from './cnss-congo'

const emp = (brut: number) => calculerCNSSEmploye(1, { nom: 'Test', prenom: 'A', salaire_brut: brut })

describe('CNSS Congo — allocations familiales et accidents du travail ont des plafonds distincts', () => {
  it('sous les deux plafonds, les deux bases valent le brut ou leur propre plafond', () => {
    const c = emp(900_000)
    expect(c.base_allocations_familiales).toBe(900_000)   // plafond AF : 1 200 000
    expect(c.base_at_mp_pf).toBe(600_000)                 // plafond AT :   600 000
  })

  it('au-dessus des deux plafonds, chaque base est écrêtée à la sienne', () => {
    const c = emp(1_500_000)
    expect(c.base_allocations_familiales).toBe(1_200_000)
    expect(c.base_at_mp_pf).toBe(600_000)
  })

  it('les deux bases ne sont jamais confondues — c’est le défaut qui sous-déclarait', () => {
    const c = emp(1_500_000)
    expect(c.base_allocations_familiales).not.toBe(c.base_at_mp_pf)
  })

  it('allocations familiales à 1 500 000 F de brut : 120 420 F', () => {
    expect(emp(1_500_000).allocations_familiales).toBe(120_420)
  })

  it('l’écart avec l’ancien calcul est bien de 60 240 F par salarié et par mois', () => {
    const correct = emp(1_500_000).allocations_familiales
    const ancien  = Math.round(600_000 * 0.1003)   // ancienne base et ancien taux
    expect(correct - ancien).toBe(60_240)
  })
})

describe('CNSS Congo — les autres branches restent au barème', () => {
  it('vieillesse part salarié : 4 % plafonné à 1 200 000 F', () => {
    expect(emp(900_000).cotisation_employe).toBe(36_000)
    expect(emp(1_500_000).cotisation_employe).toBe(48_000)
  })

  it('vieillesse part patronale : 8 % plafonné à 1 200 000 F', () => {
    expect(emp(900_000).cotisation_vieillesse).toBe(72_000)
    expect(emp(1_500_000).cotisation_vieillesse).toBe(96_000)
  })

  it('accidents du travail : 2,25 % plafonné à 600 000 F', () => {
    expect(emp(900_000).accidents_travail).toBe(13_500)
    expect(emp(1_500_000).accidents_travail).toBe(13_500)
  })

  it('taxe unique sur les salaires CNSS : 3 % déplafonné', () => {
    expect(emp(900_000).cotisation_tus).toBe(27_000)
    expect(emp(1_500_000).cotisation_tus).toBe(45_000)
  })
})

describe('CNSS Congo — le taux imprimé est celui qui est appliqué', () => {
  const c = emp(1_500_000)

  it.each(c.branches.map(b => [b.code, b] as const))(
    'branche %s : montant = base × taux, à l’arrondi près',
    (_code, b) => {
      expect(b.montant_salarie).toBe(Math.round(b.base_totale * b.taux_salarie))
      expect(b.montant_patronal).toBe(Math.round(b.base_totale * b.taux_patronal))
    },
  )

  it('chaque branche porte son propre plafond, jamais celui d’une autre', () => {
    const parCode = Object.fromEntries(c.branches.map(b => [b.code, b.plafond_mensuel]))
    expect(parCode.AF).toBe(1_200_000)
    expect(parCode.AT).toBe(600_000)
    expect(parCode.TUS).toBeNull()
  })
})

describe('CNSS Congo — récapitulatif de la déclaration', () => {
  const employes = [emp(900_000), calculerCNSSEmploye(2, { nom: 'B', prenom: 'B', salaire_brut: 1_500_000 })]
  const recap = calculerDeclarationGlobale(employes)

  it('agrège les branches sans perdre libellé, taux ni plafond', () => {
    const af = recap.branches.find(b => b.code === 'AF')
    expect(af).toBeDefined()
    expect(af!.plafond_mensuel).toBe(1_200_000)
    expect(af!.montant_patronal).toBe(90_315 + 120_420)
    expect(af!.base_totale).toBe(900_000 + 1_200_000)
  })

  it('le total à verser est la somme des parts salariale et patronale', () => {
    expect(recap.total_a_verser).toBe(
      recap.total_cotisations_employes + recap.total_cotisations_patronales,
    )
  })

  it('les bases AF et AT sont totalisées séparément', () => {
    expect(recap.base_allocations_familiales_total).toBe(2_100_000)
    expect(recap.base_at_mp_pf_total).toBe(1_200_000)
  })
})

describe('CNSS Congo — mise en forme des taux et plafonds', () => {
  it('un taux se lit en pourcentage, sans arrondi trompeur', () => {
    expect(fmtTaux(0.10035)).toBe('10,035 %')
    expect(fmtTaux(0.04)).toBe('4 %')
  })

  it('une branche déplafonnée le dit, au lieu d’afficher un montant faux', () => {
    expect(fmtPlafond(null)).toBe('déplafonné')
    expect(fmtPlafond(1_200_000)).toContain('1')
  })
})

describe('CNSS Congo — auto-test interne du module', () => {
  it('passe sur les deux cas de contrôle', () => {
    expect(_selfTestCNSS()).toBe(true)
  })
})

/**
 * P0-01 — Une taxe abrogée vaut zéro à partir de sa date, pas avant.
 *
 * La déclaration générale liquidait la TUS fiscale à 4,5 % en dur, alors que la
 * LF 2026 l'a supprimée. Le taux ne peut pas être une constante : une
 * déclaration rectificative portant sur 2025 doit encore la liquider.
 */

import { describe, it, expect } from 'vitest'
import {
  getTaxeAbrogee,
  calculerTaxesAdditionnellesSurTVA,
} from './universal-tax-engine'

describe('TUS fiscale Congo — abrogée par la LF 2026', () => {
  it('vaut encore 4,5 % sur une période de 2025', () => {
    const r = getTaxeAbrogee('CG', 'TUS_FISCALE', '2025-11-01')
    expect(r).not.toBeNull()
    expect(r!.taux).toBe(0.045)
    expect(r!.abrogee).toBe(false)
  })

  it('vaut 0 dès le premier jour d’application', () => {
    const r = getTaxeAbrogee('CG', 'TUS_FISCALE', '2026-01-01')
    expect(r!.taux).toBe(0)
    expect(r!.abrogee).toBe(true)
  })

  it('vaut 0 sur toute période postérieure', () => {
    expect(getTaxeAbrogee('CG', 'TUS_FISCALE', '2026-09-01')!.taux).toBe(0)
    expect(getTaxeAbrogee('CG', 'TUS_FISCALE', '2030-03-01')!.taux).toBe(0)
  })

  it('porte sa base légale, pour que le document puisse la citer', () => {
    expect(getTaxeAbrogee('CG', 'TUS_FISCALE', '2026-01-01')!.base_legale).toContain('LF 2026')
  })

  it('un code inconnu ne rend pas un taux par défaut, mais rien', () => {
    expect(getTaxeAbrogee('CG', 'TAXE_IMAGINAIRE', '2026-01-01')).toBeNull()
  })

  it('sur 12 mois de 2026, le montant liquidé est nul quel que soit le brut', () => {
    for (let m = 1; m <= 12; m++) {
      const periode = `2026-${String(m).padStart(2, '0')}-01`
      const taux = getTaxeAbrogee('CG', 'TUS_FISCALE', periode)!.taux
      expect(Math.round(50_000_000 * taux)).toBe(0)
    }
  })
})

describe('Taxes additionnelles assises sur la TVA collectée', () => {
  it('Congo : centime additionnel de 5 % de la TVA, pas du hors taxe', () => {
    const r = calculerTaxesAdditionnellesSurTVA('CG', 1_000_000)
    expect(r.total).toBe(50_000)
    expect(r.detail).toHaveLength(1)
    expect(r.detail[0].code).toBe('CA')
  })

  it('une TVA nulle ne produit aucun centime', () => {
    expect(calculerTaxesAdditionnellesSurTVA('CG', 0).total).toBe(0)
  })
})

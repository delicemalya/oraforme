/**
 * Tests du contrat bulletin → moteur comptable (P0-03).
 *
 * Le contrat est celui de la migration 141 : PAI-001 à la validation avec
 * montant_ht = brut et metadata {cnss_patronal, cnss_salarie, irpp} ; PAI-002
 * au paiement avec montant_ttc = net et metadata {mode_paiement}.
 */

import { describe, it, expect } from 'vitest'
import {
  evenementsComptablesBulletin, dernierJourDuMois, montant, depuisLignePostgrest,
  type BulletinComptable,
} from './evenements-comptables'

const TENANT = '11111111-1111-1111-1111-111111111111'
const ID     = '22222222-2222-2222-2222-222222222222'

function bulletin(extra: Partial<BulletinComptable> = {}): BulletinComptable {
  return {
    id: ID, mois: 3, annee: 2026, statut: 'validee',
    brut: 1_000_000, net: 954_640,
    cnss_salarie: 40_000, cnss_patronal: 202_850, irpp: 5_360,
    mode_paiement: 'virement', employe_nom: 'Nzouzi Marie',
    ...extra,
  }
}

// ── dernierJourDuMois ─────────────────────────────────────────────────────────

describe('dernierJourDuMois', () => {
  it.each([
    [2026, 1, '2026-01-31'], [2026, 2, '2026-02-28'], [2026, 3, '2026-03-31'],
    [2026, 4, '2026-04-30'], [2026, 5, '2026-05-31'], [2026, 6, '2026-06-30'],
    [2026, 7, '2026-07-31'], [2026, 8, '2026-08-31'], [2026, 9, '2026-09-30'],
    [2026, 10, '2026-10-31'], [2026, 11, '2026-11-30'], [2026, 12, '2026-12-31'],
  ])('%i-%i → %s', (annee, mois, attendu) => {
    expect(dernierJourDuMois(annee, mois)).toBe(attendu)
  })

  it('février bissextile', () => {
    expect(dernierJourDuMois(2028, 2)).toBe('2028-02-29')
    expect(dernierJourDuMois(2100, 2)).toBe('2100-02-28')
  })

  it('mois hors bornes → RangeError', () => {
    expect(() => dernierJourDuMois(2026, 0)).toThrow(RangeError)
    expect(() => dernierJourDuMois(2026, 13)).toThrow(RangeError)
    expect(() => dernierJourDuMois(2026, 2.5)).toThrow(RangeError)
  })
})

// ── montant ───────────────────────────────────────────────────────────────────

describe('montant', () => {
  it('null, undefined, vide → 0, jamais NaN', () => {
    expect(montant(null)).toBe(0)
    expect(montant(undefined)).toBe(0)
    expect(montant('')).toBe(0)
    expect(montant('abc')).toBe(0)
  })
  it('les NUMERIC PostgREST arrivent en chaîne', () => {
    expect(montant('954640')).toBe(954_640)
    expect(montant('954640.00')).toBe(954_640)
    expect(montant(12)).toBe(12)
  })
})

// ── Statuts sans événement ────────────────────────────────────────────────────

describe('statuts sans fait comptable', () => {
  it.each(['brouillon', 'generee', 'annule', null, '', 'inconnu'])('statut %s → aucun événement', (statut) => {
    expect(evenementsComptablesBulletin(TENANT, bulletin({ statut }), '2026-04-02')).toEqual([])
  })
})

// ── PAI-001 ───────────────────────────────────────────────────────────────────

describe('PAI-001 — constatation à la validation', () => {
  const [ev, ...reste] = evenementsComptablesBulletin(TENANT, bulletin(), '2026-04-02')

  it('un seul événement pour un bulletin validé', () => {
    expect(reste).toEqual([])
    expect(ev.p_event_type).toBe('PAI-001')
  })

  it('identité de la source : paie / bulletins_paie / id du bulletin / tenant', () => {
    expect(ev.p_tenant_id).toBe(TENANT)
    expect(ev.p_source_module).toBe('paie')
    expect(ev.p_source_table).toBe('bulletins_paie')
    expect(ev.p_source_id).toBe(ID)
    expect(ev.p_event_version).toBe(1)
  })

  it('montant_ht = brut, montant_ttc = 0 : pas de trésorerie à la constatation', () => {
    expect(ev.p_montant_ht).toBe(1_000_000)
    expect(ev.p_montant_tva).toBe(0)
    expect(ev.p_montant_ttc).toBe(0)
    expect(ev.p_montant_net).toBe(954_640)
  })

  it('metadata porte les trois champs lus par les séquences 2, 3 et 4', () => {
    expect(ev.p_metadata).toMatchObject({
      cnss_patronal: 202_850, cnss_salarie: 40_000, irpp: 5_360,
      employe_nom: 'Nzouzi Marie', mois: 3, annee: 2026,
    })
  })

  it('daté du dernier jour du mois de paie, pas du jour de validation', () => {
    expect(ev.p_date_event).toBe('2026-03-31')
    expect(ev.p_fiscal_year).toBe(2026)
  })

  it('libellé lisible', () => {
    expect(ev.p_libelle).toBe('Bulletin paie Mar 2026 — Nzouzi Marie — constatation')
  })

  it('reproduit le cas de la migration 141 : solde 421 = 954 640', () => {
    // Séq 1 crédite 421 du brut ; séq 3 et 4 débitent 421 des retenues.
    const md = ev.p_metadata as { cnss_salarie: number; irpp: number }
    expect(ev.p_montant_ht - md.cnss_salarie - md.irpp).toBe(954_640)
  })
})

// ── PAI-002 ───────────────────────────────────────────────────────────────────

describe('PAI-002 — paiement du net', () => {
  const evs = evenementsComptablesBulletin(TENANT, bulletin({ statut: 'payee', mode_paiement: 'especes' }), '2026-04-02')

  it('un bulletin payé émet la constatation puis le paiement, dans cet ordre', () => {
    expect(evs.map(e => e.p_event_type)).toEqual(['PAI-001', 'PAI-002'])
  })

  it('montant_ttc = net, montant_ht = 0', () => {
    const p = evs[1]
    expect(p.p_montant_ttc).toBe(954_640)
    expect(p.p_montant_net).toBe(954_640)
    expect(p.p_montant_ht).toBe(0)
    expect(p.p_montant_tva).toBe(0)
  })

  it('mode_paiement transmis pour la résolution du compte de trésorerie', () => {
    expect(evs[1].p_metadata).toMatchObject({ mode_paiement: 'especes', mois: 3, annee: 2026 })
  })

  it('mode_paiement absent → virement, comme la colonne par défaut', () => {
    const [, p] = evenementsComptablesBulletin(TENANT, bulletin({ statut: 'payee', mode_paiement: null }), '2026-04-02')
    expect(p.p_metadata.mode_paiement).toBe('virement')
    const [, q] = evenementsComptablesBulletin(TENANT, bulletin({ statut: 'payee', mode_paiement: '  ' }), '2026-04-02')
    expect(q.p_metadata.mode_paiement).toBe('virement')
  })

  it('date : date_paiement du bulletin si présente, sinon celle fournie', () => {
    const [, avec] = evenementsComptablesBulletin(TENANT, bulletin({ statut: 'payee', date_paiement: '2026-03-28' }), '2026-04-02')
    expect(avec.p_date_event).toBe('2026-03-28')
    const [, sans] = evenementsComptablesBulletin(TENANT, bulletin({ statut: 'payee', date_paiement: null }), '2026-04-02')
    expect(sans.p_date_event).toBe('2026-04-02')
  })

  it('la constatation garde sa date de fin de mois même quand le paiement est daté', () => {
    const [c] = evenementsComptablesBulletin(TENANT, bulletin({ statut: 'payee', date_paiement: '2026-04-05' }), '2026-04-05')
    expect(c.p_date_event).toBe('2026-03-31')
  })

  it('même source_id pour les deux événements : le moteur dédoublonne par event_type', () => {
    expect(evs[0].p_source_id).toBe(evs[1].p_source_id)
    expect(evs[0].p_event_type).not.toBe(evs[1].p_event_type)
  })

  it('libellé', () => {
    expect(evs[1].p_libelle).toBe('Paiement salaire Mar 2026 — Nzouzi Marie')
  })
})

// ── Robustesse ────────────────────────────────────────────────────────────────

describe('robustesse', () => {
  it('valeurs NUMERIC en chaîne (PostgREST) acceptées', () => {
    const [c, p] = evenementsComptablesBulletin(TENANT, bulletin({
      statut: 'payee', brut: '1000000', net: '954640', cnss_salarie: '40000', cnss_patronal: '202850', irpp: '5360',
    }), '2026-04-02')
    expect(c.p_montant_ht).toBe(1_000_000)
    expect(p.p_montant_ttc).toBe(954_640)
    expect(c.p_metadata.cnss_patronal).toBe(202_850)
  })

  it('montants nuls → 0 ; le moteur saute alors les séquences concernées', () => {
    const [c] = evenementsComptablesBulletin(TENANT, bulletin({ cnss_patronal: null, irpp: null }), '2026-04-02')
    expect(c.p_metadata.cnss_patronal).toBe(0)
    expect(c.p_metadata.irpp).toBe(0)
  })

  it('nom d\'employé absent → "Employé"', () => {
    const [c] = evenementsComptablesBulletin(TENANT, bulletin({ employe_nom: null }), '2026-04-02')
    expect(c.p_libelle).toContain('Employé')
    expect(c.p_metadata.employe_nom).toBe('Employé')
  })

  it('brut ou net négatif → RangeError, le moteur refuserait une extourne déguisée', () => {
    expect(() => evenementsComptablesBulletin(TENANT, bulletin({ brut: -1 }), '2026-04-02')).toThrow(RangeError)
    expect(() => evenementsComptablesBulletin(TENANT, bulletin({ net: -1 }), '2026-04-02')).toThrow(RangeError)
  })

  it('bulletin sans id ou sans tenant → RangeError', () => {
    expect(() => evenementsComptablesBulletin(TENANT, bulletin({ id: '' }), '2026-04-02')).toThrow(RangeError)
    expect(() => evenementsComptablesBulletin('', bulletin(), '2026-04-02')).toThrow(RangeError)
  })

  it('mois invalide → RangeError', () => {
    expect(() => evenementsComptablesBulletin(TENANT, bulletin({ mois: 13 }), '2026-04-02')).toThrow(RangeError)
  })

  it('date de paiement fournie invalide → RangeError (uniquement si payee)', () => {
    expect(() => evenementsComptablesBulletin(TENANT, bulletin({ statut: 'payee', date_paiement: null }), 'hier')).toThrow(RangeError)
    expect(() => evenementsComptablesBulletin(TENANT, bulletin({ statut: 'validee' }), 'hier')).not.toThrow()
  })

  it('les statuts non comptables ne valident rien : pas d\'exception sur un brouillon incomplet', () => {
    expect(evenementsComptablesBulletin(TENANT, { id: '', mois: 0, annee: 0, statut: 'brouillon', brut: null, net: null, cnss_salarie: null, cnss_patronal: null, irpp: null }, 'x')).toEqual([])
  })
})

// ── depuisLignePostgrest ──────────────────────────────────────────────────────

describe('depuisLignePostgrest', () => {
  const base = {
    id: ID, mois: '3', annee: '2026', statut: 'validee',
    brut: '1000000', net: '954640', cnss_salarie: '40000', cnss_patronal: '202850', irpp: '5360',
    mode_paiement: 'virement', date_paiement: null,
  }

  it('jointure employes en objet', () => {
    const b = depuisLignePostgrest({ ...base, employes: { nom: 'Nzouzi Marie' } })
    expect(b.employe_nom).toBe('Nzouzi Marie')
    expect(b.mois).toBe(3)
    expect(b.annee).toBe(2026)
  })

  it('jointure employes en tableau', () => {
    const b = depuisLignePostgrest({ ...base, employes: [{ nom: 'Nzouzi Marie' }] })
    expect(b.employe_nom).toBe('Nzouzi Marie')
  })

  it('jointure absente → nom null, le contrat retombe sur "Employé"', () => {
    const b = depuisLignePostgrest({ ...base, employes: null })
    expect(b.employe_nom).toBeNull()
    const [c] = evenementsComptablesBulletin(TENANT, b, '2026-04-02')
    expect(c.p_metadata.employe_nom).toBe('Employé')
  })
})

/**
 * P0-02 — ERP Core comptabilité : Grand Livre et Balance.
 *
 * Deux routes étaient injoignables en production :
 *
 *   Grand Livre  400  column journal_entries.reference does not exist
 *   Balance      22008 date/time field value out of range
 *
 * Ces tests couvrent le calcul et la construction de période. La conformité du
 * contrat de colonnes au schéma réel est vérifiée dans
 * lib/architecture/erp-core-comptabilite.test.ts.
 */

import { describe, it, expect } from 'vitest'
import {
  periodeMensuelle,
  computeBalance,
  computeGrandLivre,
  type JournalLedgerRow,
} from './accounting'

// ── Période ───────────────────────────────────────────────────────────────────

describe('periodeMensuelle — un intervalle semi-ouvert n’a pas besoin du dernier jour', () => {
  const MOIS = [
    [1,  '2026-01-01', '2026-02-01', 'janvier'],
    [2,  '2026-02-01', '2026-03-01', 'février'],
    [3,  '2026-03-01', '2026-04-01', 'mars'],
    [4,  '2026-04-01', '2026-05-01', 'avril'],
    [5,  '2026-05-01', '2026-06-01', 'mai'],
    [6,  '2026-06-01', '2026-07-01', 'juin'],
    [7,  '2026-07-01', '2026-08-01', 'juillet'],
    [8,  '2026-08-01', '2026-09-01', 'août'],
    [9,  '2026-09-01', '2026-10-01', 'septembre'],
    [10, '2026-10-01', '2026-11-01', 'octobre'],
    [11, '2026-11-01', '2026-12-01', 'novembre'],
    [12, '2026-12-01', '2027-01-01', 'décembre'],
  ] as const

  it.each(MOIS)('mois %i (%s) : bornes correctes', (mois, debut, fin) => {
    const p = periodeMensuelle(2026, mois as number)
    expect(p.debut).toBe(debut)
    expect(p.fin_exclusive).toBe(fin)
  })

  it('aucune borne ne contient un 31 collé au mois', () => {
    for (let m = 1; m <= 12; m++) {
      const p = periodeMensuelle(2026, m)
      expect(p.fin_exclusive.endsWith('-31')).toBe(false)
      expect(p.debut.endsWith('-31')).toBe(false)
    }
  })

  it('les cinq mois qui n’ont pas de 31 produisent une date valide', () => {
    // février, avril, juin, septembre, novembre — les cinq qui échouaient
    for (const m of [2, 4, 6, 9, 11]) {
      const p = periodeMensuelle(2026, m)
      expect(Number.isNaN(Date.parse(p.debut))).toBe(false)
      expect(Number.isNaN(Date.parse(p.fin_exclusive))).toBe(false)
    }
  })

  it('décembre bascule sur l’année suivante', () => {
    expect(periodeMensuelle(2026, 12).fin_exclusive).toBe('2027-01-01')
  })

  it('février d’une année bissextile et d’une année commune ont la même borne', () => {
    // La borne ne dépend pas du nombre de jours : c'est tout l'intérêt.
    expect(periodeMensuelle(2024, 2).fin_exclusive).toBe('2024-03-01')
    expect(periodeMensuelle(2026, 2).fin_exclusive).toBe('2026-03-01')
  })

  it('le 29 février d’une bissextile tombe bien dans la période', () => {
    const p = periodeMensuelle(2024, 2)
    expect('2024-02-29' >= p.debut && '2024-02-29' < p.fin_exclusive).toBe(true)
  })

  it('le dernier jour de chaque mois est inclus, le premier du suivant exclu', () => {
    const derniers = ['2026-01-31', '2026-02-28', '2026-03-31', '2026-04-30']
    derniers.forEach((jour, i) => {
      const p = periodeMensuelle(2026, i + 1)
      expect(jour >= p.debut && jour < p.fin_exclusive).toBe(true)
      expect(p.fin_exclusive >= p.debut).toBe(true)
    })
  })

  it('un mois hors bornes est refusé, pas silencieusement corrigé', () => {
    expect(() => periodeMensuelle(2026, 0)).toThrow(RangeError)
    expect(() => periodeMensuelle(2026, 13)).toThrow(RangeError)
    expect(() => periodeMensuelle(2026, 1.5)).toThrow(RangeError)
  })
})

// ── Jeu d'écritures ───────────────────────────────────────────────────────────

const ecritures: JournalLedgerRow[] = [
  // Vente : client débité, produit crédité
  { id: 'e1', date_operation: '2026-02-10', libelle: 'Facture FAC-001',
    debit_account: '411', credit_account: '706', montant: 500_000,
    piece_number: 'FAC-2026-001', source: 'facturation' },
  // Encaissement
  { id: 'e2', date_operation: '2026-02-28', libelle: 'Règlement FAC-001',
    debit_account: '521', credit_account: '411', montant: 500_000,
    piece_number: 'REG-2026-001', source: 'tresorerie' },
  // Achat, autre mois
  { id: 'e3', date_operation: '2026-04-05', libelle: 'Achat fournitures',
    debit_account: '601', credit_account: '401', montant: 120_000,
    piece_number: 'ACH-2026-014', source: 'achats' },
]

// ── Balance ───────────────────────────────────────────────────────────────────

describe('computeBalance — totaux par compte', () => {
  const b = computeBalance(ecritures, null)

  it('un compte par numéro rencontré, au débit comme au crédit', () => {
    expect(b.lignes.map(l => l.numero).sort()).toEqual(['401', '411', '521', '601', '706'])
    expect(b.nb_comptes).toBe(5)
  })

  it('le compte client cumule son débit et son crédit', () => {
    const c411 = b.lignes.find(l => l.numero === '411')!
    expect(c411.total_debit).toBe(500_000)
    expect(c411.total_credit).toBe(500_000)
  })

  it('le solde est débiteur ou créditeur, jamais les deux', () => {
    for (const l of b.lignes) {
      expect(l.solde_debiteur === 0 || l.solde_crediteur === 0).toBe(true)
    }
  })

  it('un compte soldé ne porte aucun solde', () => {
    const c411 = b.lignes.find(l => l.numero === '411')!
    expect(c411.solde_debiteur).toBe(0)
    expect(c411.solde_crediteur).toBe(0)
  })

  it('la balance est équilibrée : total débit égale total crédit', () => {
    expect(b.total_debit).toBe(b.total_credit)
    expect(b.equilibre).toBe(true)
    expect(b.ecart).toBe(0)
  })

  it('compte le nombre d’écritures reçues', () => {
    expect(b.nb_ecritures).toBe(3)
  })

  it('le filtre de classe ne garde que la classe demandée', () => {
    const classe4 = computeBalance(ecritures, 4)
    expect(classe4.lignes.every(l => l.classe === 4)).toBe(true)
    expect(classe4.lignes.map(l => l.numero).sort()).toEqual(['401', '411'])
  })

  it('un mois sans écriture donne une balance vide et équilibrée', () => {
    const vide = computeBalance([], null)
    expect(vide.lignes).toEqual([])
    expect(vide.nb_comptes).toBe(0)
    expect(vide.nb_ecritures).toBe(0)
    expect(vide.total_debit).toBe(0)
    expect(vide.total_credit).toBe(0)
    expect(vide.equilibre).toBe(true)
  })

  it('un mois avec écritures donne exactement les comptes de ce mois', () => {
    // Ce que la route obtient après filtrage par période.
    const p = periodeMensuelle(2026, 2)
    const fevrier = ecritures.filter(
      e => e.date_operation! >= p.debut && e.date_operation! < p.fin_exclusive,
    )
    expect(fevrier).toHaveLength(2)
    const bf = computeBalance(fevrier, null)
    expect(bf.lignes.map(l => l.numero).sort()).toEqual(['411', '521', '706'])
    expect(bf.total_debit).toBe(1_000_000)
  })

  it('avril, mois de 30 jours, retourne bien son écriture', () => {
    const p = periodeMensuelle(2026, 4)
    const avril = ecritures.filter(
      e => e.date_operation! >= p.debut && e.date_operation! < p.fin_exclusive,
    )
    expect(avril.map(e => e.id)).toEqual(['e3'])
  })
})

// ── Grand Livre ───────────────────────────────────────────────────────────────

describe('computeGrandLivre — détail par compte', () => {
  const g = computeGrandLivre(ecritures, null, null, false)

  it('regroupe les mouvements par compte', () => {
    expect(g.comptes.map(c => c.numero)).toEqual(['401', '411', '521', '601', '706'])
    expect(g.nb_comptes).toBe(5)
    expect(g.nb_ecritures).toBe(3)
  })

  it('le compte client porte ses deux mouvements, sans doublon', () => {
    const c411 = g.comptes.find(c => c.numero === '411')!
    expect(c411.mouvements.map(m => m.id).sort()).toEqual(['e1', 'e2'])
    expect(c411.total_debit).toBe(500_000)
    expect(c411.total_credit).toBe(500_000)
    expect(c411.solde).toBe(0)
  })

  it('les mouvements sont classés par date', () => {
    const c411 = g.comptes.find(c => c.numero === '411')!
    const dates = c411.mouvements.map(m => m.date_operation)
    expect(dates).toEqual([...dates].sort())
  })

  it('la référence de pièce est portée jusqu’au mouvement affiché', () => {
    const c411 = g.comptes.find(c => c.numero === '411')!
    expect(c411.mouvements.map(m => m.piece_number)).toEqual(['FAC-2026-001', 'REG-2026-001'])
  })

  it('le solde d’un compte de charges est débiteur', () => {
    const c601 = g.comptes.find(c => c.numero === '601')!
    expect(c601.solde).toBe(120_000)
    expect(c601.anomalies).toEqual([])
  })

  it('un compte de charges au solde créditeur est signalé', () => {
    const inverse = computeGrandLivre(
      [{ id: 'x', date_operation: '2026-03-01', libelle: 'Écriture inversée',
         debit_account: '401', credit_account: '601', montant: 50_000 }],
      null, null, false,
    )
    const c601 = inverse.comptes.find(c => c.numero === '601')!
    expect(c601.anomalies.length).toBeGreaterThan(0)
    expect(inverse.total_anomalies).toBeGreaterThan(0)
  })

  it('une écriture sans libellé est signalée — SYSCOHADA Art. 17', () => {
    const sansLibelle = computeGrandLivre(
      [{ id: 'y', date_operation: '2026-03-01', libelle: '',
         debit_account: '521', credit_account: '411', montant: 10_000 }],
      null, null, false,
    )
    expect(sansLibelle.total_anomalies).toBeGreaterThan(0)
  })

  it('le filtre de compte ne garde que le préfixe demandé', () => {
    const filtre = computeGrandLivre(ecritures, '41', null, false)
    expect(filtre.comptes.map(c => c.numero)).toEqual(['411'])
  })

  it('le filtre de classe ne garde que la classe demandée', () => {
    const filtre = computeGrandLivre(ecritures, null, '6', false)
    expect(filtre.comptes.map(c => c.numero)).toEqual(['601'])
  })

  it('sans écriture, le grand livre est vide et ne lève rien', () => {
    const vide = computeGrandLivre([], null, null, false)
    expect(vide.comptes).toEqual([])
    expect(vide.nb_ecritures).toBe(0)
    expect(vide.total_anomalies).toBe(0)
  })
})

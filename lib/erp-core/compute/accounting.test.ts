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

import { readFileSync } from 'fs'
import path from 'path'
import { describe, it, expect } from 'vitest'
import {
  periodeMensuelle,
  computeBalance,
  computeGrandLivre,
  computeTVAFromJournal,
  type JournalLedgerRow,
  type JournalBalanceRow,
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

// ── computeTVAFromJournal — Mission P0-FISCAL-CG-2026 (2026-09-18) ────────────
//
// Fixtures A-I de la mission. Étiquetées RÉEL (dérivé d'un document réel
// consulté lors de l'audit préalable) ou SYNTHÉTIQUE (aucun document réel
// disponible pour ce cas — voir rapport de mission, section K). Aucun montant
// « réaliste » n'est inventé : les cas synthétiques utilisent des chiffres
// ronds pour rester lisibles.

function ecritureTVA(
  date: string,
  compte: '4441' | '4445',
  montant: number,
  sens: 'debit' | 'credit' = compte === '4441' ? 'credit' : 'debit',
): JournalBalanceRow {
  return sens === 'credit'
    ? { date_operation: date, debit_account: '411', credit_account: compte, montant }
    : { date_operation: date, debit_account: compte, credit_account: '401', montant }
}

describe('computeTVAFromJournal — cas A/B : vente 18% et opération 5% (SYNTHÉTIQUE)', () => {
  // Le journal ne porte qu'un montant déjà liquidé, jamais le taux qui l'a
  // produit (voir engine-adapter.ts::calculerTVAUnifie) : une vente à 18% et
  // une opération à 5% sont donc indiscernables à ce niveau — seul le montant
  // posté sur 4441 compte. Les deux cas exercent le même chemin de code ; ils
  // sont conservés séparément pour documenter cette limite plutôt que la
  // masquer.
  it('cas A — vente 18% : le montant crédité sur 4441 devient tva_collectee du mois', () => {
    const r = computeTVAFromJournal([ecritureTVA('2026-03-05', '4441', 18_000)], 2026)
    const mars = r.mensuel.find(m => m.mois === 3)!
    expect(mars.tva_collectee).toBe(18_000)
    expect(mars.tva_nette).toBe(18_000)
    expect(mars.a_payer).toBe(18_000)
  })

  it('cas B — opération à 5% : même chemin de code qu’une vente 18%, seul le montant diffère', () => {
    const r = computeTVAFromJournal([ecritureTVA('2026-03-05', '4441', 5_000)], 2026)
    const mars = r.mensuel.find(m => m.mois === 3)!
    expect(mars.tva_collectee).toBe(5_000)
  })
})

describe('computeTVAFromJournal — cas C : facture sans TVA (RÉEL — 6 factures Congo consultées lors de l’audit préalable, aucune n’a de ligne TVA)', () => {
  it('un mois sans aucune écriture sur 4441/4442/4445/4446 donne une déclaration à zéro, pas une erreur', () => {
    const r = computeTVAFromJournal(
      [{ date_operation: '2026-05-10', debit_account: '411', credit_account: '706', montant: 100_000 }],
      2026,
    )
    const mai = r.mensuel.find(m => m.mois === 5)!
    expect(mai.tva_collectee).toBe(0)
    expect(mai.tva_deductible).toBe(0)
    expect(mai.a_payer).toBe(0)
    expect(mai.credit_nouveau).toBe(0)
  })
})

describe('computeTVAFromJournal — cas E : achat avec TVA déductible (SYNTHÉTIQUE — voir fiabilité)', () => {
  it('un débit sur 4445 alimente tva_deductible mais deductible_fiabilite.fiable reste false', () => {
    const r = computeTVAFromJournal([ecritureTVA('2026-06-12', '4445', 9_000)], 2026)
    const juin = r.mensuel.find(m => m.mois === 6)!
    expect(juin.tva_deductible).toBe(9_000)
    expect(r.deductible_fiabilite.fiable).toBe(false)
    expect(r.deductible_fiabilite.raison).toMatch(/écriture manuelle/)
  })

  it('sans aucune écriture 4445/4446, la raison explique l’absence structurelle (pas juste « rien ce mois »)', () => {
    const r = computeTVAFromJournal([ecritureTVA('2026-06-12', '4441', 20_000)], 2026)
    expect(r.deductible_fiabilite.fiable).toBe(false)
    expect(r.deductible_fiabilite.raison).toMatch(/aucun champ TVA/)
  })
})

describe('computeTVAFromJournal — cas F/G : report de crédit d’un mois sur l’autre (SYNTHÉTIQUE)', () => {
  it('un mois en crédit (déductible > collectée) reporte le crédit au mois suivant', () => {
    const entries: JournalBalanceRow[] = [
      ecritureTVA('2026-01-15', '4441', 10_000),   // collectée janvier
      ecritureTVA('2026-01-15', '4445', 40_000),   // déductible janvier → nette = -30 000
      ecritureTVA('2026-02-15', '4441', 50_000),   // collectée février
    ]
    const r = computeTVAFromJournal(entries, 2026)
    const jan = r.mensuel.find(m => m.mois === 1)!
    const fev = r.mensuel.find(m => m.mois === 2)!

    expect(jan.tva_nette).toBe(-30_000)
    expect(jan.a_payer).toBe(0)
    expect(jan.credit_nouveau).toBe(30_000)

    expect(fev.credit_anterieur).toBe(30_000)
    expect(fev.tva_nette).toBe(50_000)
    // solde = 50 000 - 30 000 = 20 000 à payer, plus de crédit
    expect(fev.a_payer).toBe(20_000)
    expect(fev.credit_nouveau).toBe(0)
  })

  it('creditInitial reporte un crédit d’une période antérieure à `year` — jamais déduit automatiquement', () => {
    const sansReport = computeTVAFromJournal([ecritureTVA('2026-01-10', '4441', 10_000)], 2026)
    const avecReport = computeTVAFromJournal([ecritureTVA('2026-01-10', '4441', 10_000)], 2026, 4_000)

    expect(sansReport.mensuel[0].a_payer).toBe(10_000)
    expect(avecReport.mensuel[0].credit_anterieur).toBe(4_000)
    expect(avecReport.mensuel[0].a_payer).toBe(6_000)
  })
})

describe('computeTVAFromJournal — réconciliation source = calcul canonique (section L du rapport)', () => {
  const entries: JournalBalanceRow[] = [
    ecritureTVA('2026-03-05', '4441', 18_000),
    ecritureTVA('2026-03-20', '4441', 7_000),
    ecritureTVA('2026-03-20', '4445', 4_000),
    ecritureTVA('2026-04-02', '4441', 12_000),
  ]

  it('la somme des tva_collectee mensuels égale la somme brute des crédits 4441/4442 dans les écritures sources', () => {
    const r = computeTVAFromJournal(entries, 2026)
    const sommeCanonique = r.mensuel.reduce((s, m) => s + m.tva_collectee, 0)
    const sommeSource = entries
      .filter(e => e.credit_account === '4441' || e.credit_account === '4442')
      .reduce((s, e) => s + (e.montant ?? 0), 0)
    expect(sommeCanonique).toBe(sommeSource)
    expect(r.total_collectee).toBe(sommeCanonique)
  })

  it('écart documenté vs l’ancienne méthode (lib/fiscalite/engine.ts::calculerTVA, sans report de crédit)', () => {
    // Ancienne méthode : chaque mois calculé indépendamment, credit_tva = max(-nette, 0)
    // jamais réinjecté dans le mois suivant.
    const r = computeTVAFromJournal(entries, 2026)
    const mars = r.mensuel.find(m => m.mois === 3)!  // nette = 18000+7000-4000 = 21000
    const avril = r.mensuel.find(m => m.mois === 4)! // nette = 12000, sans crédit antérieur ici

    const ancienTotalAPayer = r.mensuel.reduce((s, m) => s + Math.max(0, m.tva_nette), 0)
    const nouveauTotalAPayer = r.total_a_payer

    // Dans ce jeu précis, aucun mois n'est en crédit : les deux méthodes
    // convergent — la divergence n'apparaît QUE quand un mois a une nette
    // négative (voir le test « report de crédit » ci-dessus, où l'ancienne
    // méthode aurait fait payer 50 000 en février au lieu de 20 000).
    expect(nouveauTotalAPayer).toBe(ancienTotalAPayer)
    expect(mars.tva_nette).toBe(21_000)
    expect(avril.tva_nette).toBe(12_000)
  })

  it('limite connue, non corrigée : un débit sur 4441 (ex. hypothèse d’avoir/annulation) n’est PAS déduit de tva_collectee', () => {
    // computeTVAFromJournal ne lit que le CRÉDIT de 4441/4442 (voir son code).
    // Si un avoir se journalise par un débit sur 4441, cette fonction ne le
    // voit pas — ni en plus, ni en moins. Aucun mécanisme d'annulation n'a
    // été inventé ici faute de preuve documentaire sur la façon réelle dont
    // un avoir Congo se journalise (aucun avoir réel trouvé lors de l'audit
    // préalable). Voir rapport de mission, section N.
    const withReversal = computeTVAFromJournal(
      [
        ecritureTVA('2026-07-01', '4441', 18_000),
        { date_operation: '2026-07-15', debit_account: '4441', credit_account: '411', montant: 18_000 },
      ],
      2026,
    )
    const juillet = withReversal.mensuel.find(m => m.mois === 7)!
    expect(juillet.tva_collectee).toBe(18_000)   // le débit de contrepartie est invisible ici
  })
})

describe('computeTVAFromJournal — isolation multi-tenant (section 7 du rapport)', () => {
  it('la fonction est pure sur les écritures reçues : deux jeux de tenants différents ne se mélangent jamais', () => {
    const tenantA: JournalBalanceRow[] = [ecritureTVA('2026-03-05', '4441', 18_000)]
    const tenantB: JournalBalanceRow[] = [ecritureTVA('2026-03-05', '4441', 99_000)]

    const rA = computeTVAFromJournal(tenantA, 2026)
    const rB = computeTVAFromJournal(tenantB, 2026)

    expect(rA.total_collectee).toBe(18_000)
    expect(rB.total_collectee).toBe(99_000)
    // Rejouer A ne change rien à B : aucun état partagé entre deux appels.
    expect(computeTVAFromJournal(tenantA, 2026).total_collectee).toBe(18_000)
  })

  it('les deux appelants réels filtrent tenant_id AVANT d’appeler computeTVAFromJournal (vérification statique)', () => {
    const root = path.resolve(__dirname, '../../..')
    const route = readFileSync(path.join(root, 'app/api/fiscalite/tva/route.ts'), 'utf-8')
    const decl  = readFileSync(path.join(root, 'lib/declarations/declaration-generale.ts'), 'utf-8')

    for (const src of [route, decl]) {
      const posJournal = src.indexOf(`.from('journal_entries')`)
      const posTenantFilter = src.indexOf(`.eq('tenant_id'`, posJournal)
      // Cherché après le filtre : l'import du nom en haut de fichier ne compte pas.
      const posCompute = src.indexOf('computeTVAFromJournal(', posTenantFilter)
      expect(posJournal).toBeGreaterThan(-1)
      expect(posTenantFilter).toBeGreaterThan(posJournal)
      expect(posCompute).toBeGreaterThan(posTenantFilter)
    }
  })
})

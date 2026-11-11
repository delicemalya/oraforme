/**
 * lib/fiscalite-congo.test.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Mission P0-FISCAL-CG-2026 — migration du dernier gros calculateur TVA actif
 * (2026-09-18). Ce fichier n'avait aucun test avant cette mission (confirmé
 * par recherche exhaustive — c'était le calculateur TVA le plus consommé
 * du dépôt, sans aucune couverture).
 *
 * Fixtures étiquetées RÉEL ou SYNTHÉTIQUE — voir rapport de mission, section
 * K. Aucun des 6 documents réels consultés lors de l'audit préalable ne
 * porte de ligne TVA fonctionnelle : il n'existe donc pas de montant réel de
 * TVA facturée à rejouer ici. Les montants ronds ci-dessous sont
 * SYNTHÉTIQUES, pas présentés comme réels.
 */

import { readFileSync } from 'fs'
import path from 'path'
import { describe, it, expect } from 'vitest'
import { calculerTVA, calculerTVACongo } from './fiscalite-congo'
import { calculerTVASurMontantUnifie } from './fiscalite/engine-adapter'

const ROOT = path.resolve(__dirname, '..')
const CONGO_SOURCE = readFileSync(path.join(ROOT, 'lib/fiscalite-congo.ts'), 'utf-8')

// ── Cas 18% (SYNTHÉTIQUE) ──────────────────────────────────────────────────

describe('calculerTVA — cas 18% (taux normal)', () => {
  it('100 000 FCFA HT : tva=18 000, ca=900, ttc=118 900 (SYNTHÉTIQUE)', () => {
    const r = calculerTVA(100_000)
    expect(r.tva).toBe(18_000)
    expect(r.ca).toBe(900)
    expect(r.ttc).toBe(118_900)
    expect(r.tauxApplique).toBe(0.18)
  })

  it('délègue bit à bit à calculerTVASurMontantUnifie(montantHT, \'CG\') — pas un recalcul parallèle', () => {
    for (const ht of [0, 1, 100_000, 1_234_567, 90_000_000]) {
      const local   = calculerTVA(ht)
      const central = calculerTVASurMontantUnifie(ht, 'CG')
      expect(local.tva).toBe(central.tva)
      expect(local.ca).toBe(central.ca)
      expect(local.ttc).toBe(central.ttc)
      expect(local.tauxApplique).toBe(central.taux)
    }
  })
})

// ── Cas 5% — taux réduit véhicules (SYNTHÉTIQUE, branche non migrée) ───────

describe('calculerTVA — cas 5% (taux réduit véhicules neufs import)', () => {
  it('1 000 000 FCFA HT : tva=50 000, ca=2 500, ttc=1 052 500 (SYNTHÉTIQUE)', () => {
    const r = calculerTVA(1_000_000, true)
    expect(r.tva).toBe(50_000)
    expect(r.ca).toBe(2_500)
    expect(r.ttc).toBe(1_052_500)
    expect(r.tauxApplique).toBe(0.05)
  })

  it('reste un calcul local : aucune configuration taux réduit dans le moteur central pour ce cas', () => {
    // Non une lacune de cette migration : lib/countries/CG.ts n'a pas de champ
    // taux_reduit_vehicules. Vérifié par recherche exhaustive : aucun
    // appelant réel ne passe tauxReduit=true à ce jour.
    const withReduit = calculerTVA(1_000_000, true)
    const withoutReduit = calculerTVA(1_000_000)
    expect(withReduit.tauxApplique).not.toBe(withoutReduit.tauxApplique)
  })
})

// ── Cas « sans TVA » ────────────────────────────────────────────────────────

describe('calculerTVA — cas sans TVA', () => {
  it('montant HT nul : tva/ca/ttc tous nuls, pas d’erreur', () => {
    const r = calculerTVA(0)
    expect(r.tva).toBe(0)
    expect(r.ca).toBe(0)
    expect(r.ttc).toBe(0)
  })
})

// ── calculerTVACongo — alias rétrocompatible ───────────────────────────────

describe('calculerTVACongo — forme complète (ht/tva/taux_tva/ca/taux_ca/ttc/detail)', () => {
  it('reprend exactement calculerTVA(montantHT) sans taux réduit', () => {
    const r = calculerTVACongo(250_000)
    const attendu = calculerTVA(250_000)
    expect(r.tva).toBe(attendu.tva)
    expect(r.ca).toBe(attendu.ca)
    expect(r.ttc).toBe(attendu.ttc)
    expect(r.taux_tva).toBe(18)
    expect(r.taux_ca).toBe(5)
    expect(r.ht).toBe(250_000)
    expect(r.detail).toContain('TVA (18%)')
  })
})

// ── Réconciliation facturation ↔ moteur central (section 7.4 de la mission) ─

describe('calculerTVACongo — même montant que le moteur central pour toute la facturation', () => {
  it.each([0, 100_000, 500_000, 12_345, 90_000_000])(
    'HT=%i : calculerTVACongo et calculerTVASurMontantUnifie(_, \'CG\') produisent le même tva/ca/ttc',
    (ht) => {
      const facturation = calculerTVACongo(ht)
      const central = calculerTVASurMontantUnifie(ht, 'CG')
      expect(facturation.tva).toBe(central.tva)
      expect(facturation.ca).toBe(central.ca)
      expect(facturation.ttc).toBe(central.ttc)
    },
  )
})

// ── Restaurant : même source de règles que la facturation générale (section 6) ─

describe('Restaurant — calculerTVACongo est déterministe sur les mêmes items (commande = reçu)', () => {
  it('un même panier calculé à la commande et au reçu donne exactement le même résultat', () => {
    // Reproduit app/api/resto/commandes/route.ts:17-18 et
    // app/api/resto/receipt/[commandeId]/route.ts:38-39 : les deux dérivent
    // sousTotal des mêmes items puis appellent calculerTVACongo(sousTotal).
    const items = [{ prix: 2_500, quantite: 3 }, { prix: 1_000, quantite: 2 }]
    const sousTotal = items.reduce((s, it) => s + it.prix * it.quantite, 0)

    const aLaCommande = calculerTVACongo(sousTotal)
    const auRecu       = calculerTVACongo(sousTotal)   // même fonction, mêmes items persistés
    expect(auRecu).toEqual(aLaCommande)
  })
})

// ── Architecture : plus aucun taux TVA codé en dur dans le chemin normal ───

describe('Architecture — aucun calcul TVA local dupliqué pour le chemin normal (18%)', () => {
  it('calculerTVA délègue au moteur central pour le chemin normal, pas de recalcul via C.tva.taux_normal', () => {
    const debutFonction = CONGO_SOURCE.indexOf('export function calculerTVA(')
    const finFonction   = CONGO_SOURCE.indexOf('\n}', CONGO_SOURCE.indexOf('return { tva: r.tva', debutFonction))
    const corps = CONGO_SOURCE.slice(debutFonction, finFonction)

    expect(corps).toContain('calculerTVASurMontantUnifie(montantHT')
    // Le chemin normal ne doit plus multiplier localement par C.tva.taux_normal.
    const aprèsBrancheReduite = corps.slice(corps.indexOf('const r = calculerTVASurMontantUnifie'))
    expect(aprèsBrancheReduite).not.toContain('taux_normal')
  })

  it('les 8 consommateurs réels de fiscalite-congo.ts n’ont pas de littéral 0.18/0.05 en parallèle', () => {
    const consommateurs = [
      'app/api/factures/route.ts',
      'app/api/resto/commandes/route.ts',
      'app/api/resto/receipt/[commandeId]/route.ts',
      'app/dashboard/devis/page.tsx',
      'app/dashboard/factures/[id]/preview/page.tsx',
      'app/dashboard/rapports/page.tsx',
      'app/dashboard/restaurant/page.tsx',
      'components/facture/FacturePDF.tsx',
    ]
    for (const rel of consommateurs) {
      const src = readFileSync(path.join(ROOT, rel), 'utf-8')
      expect(src, `${rel} doit importer calculerTVACongo`).toContain('calculerTVACongo')
      expect(src, `${rel} ne doit pas recalculer 18% localement`).not.toMatch(/\*\s*0\.18\b/)
      expect(src, `${rel} ne doit pas recalculer 5% localement`).not.toMatch(/\*\s*0\.05\b/)
    }
  })
})

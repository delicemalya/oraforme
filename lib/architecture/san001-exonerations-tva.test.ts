/**
 * lib/architecture/san001-exonerations-tva.test.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Mission P0-FISCAL-CG-2026 — SAN-001, correction TVA exonérations confirmées
 * (2026-09-18).
 *
 * Source : Loi n°12-97, Art. 7 point 6° — exonération TVA pour examens,
 * consultations, soins, hospitalisation, travaux d'analyse et de biologie
 * médicale, fournitures de prothèses. Vérifiée par mission documentaire
 * dédiée. Seules 3 catégories de `his_lignes_facture.categorie` ont une
 * correspondance directe et non ambiguë : 'consultation', 'hospitalisation',
 * 'labo'. 'pharmacie', 'imagerie', 'bloc', 'autre' restent NON DÉTERMINÉES et
 * doivent rester taxées comme avant — ces tests garantissent qu'aucune
 * exonération ne leur est attribuée par erreur.
 */

import { readFileSync } from 'fs'
import path from 'path'
import { describe, it, expect } from 'vitest'
import { estCategorieSanteExonereeTVA, SANTE_CATEGORIES_EXONEREES_TVA } from '../fiscalite/sante-exonerations'
import { decomposerTTCUnifie } from '../fiscalite/engine-adapter'

const ROOT = path.resolve(__dirname, '../..')

function sourceSansCommentaires(relPath: string): string {
  const src = readFileSync(path.join(ROOT, relPath), 'utf-8')
  return src.split('\n').filter(l => !l.trim().startsWith('//')).join('\n')
}

/** Reproduit exactement la logique d'agrégation de facturation/route.ts, pour la tester isolément. */
function agregerLignes(lignes: Array<{ montant_ligne: number; categorie: string }>) {
  let ht = 0, tva = 0, ca = 0
  for (const r of lignes) {
    if (estCategorieSanteExonereeTVA(r.categorie)) {
      ht += r.montant_ligne
    } else {
      const d = decomposerTTCUnifie(r.montant_ligne, 'CG')
      ht += d.ht; tva += d.tva; ca += d.ca
    }
  }
  return { ht, tva, ca }
}

// ── A/B/C — catégories confirmées exonérées ─────────────────────────────────

describe('estCategorieSanteExonereeTVA — catégories confirmées (Loi 12-97, Art.7-6°)', () => {
  it.each(['consultation', 'hospitalisation', 'labo'])('%s est exonérée', (cat) => {
    expect(estCategorieSanteExonereeTVA(cat)).toBe(true)
  })

  it('exactement 3 catégories confirmées, pas plus', () => {
    expect(SANTE_CATEGORIES_EXONEREES_TVA).toEqual(['consultation', 'hospitalisation', 'labo'])
  })
})

describe('A. Ligne "consultation" — TVA=0, CA=0, HT préservé', () => {
  it('100 000 FCFA de consultation : ht=100 000, tva=0, ca=0', () => {
    const r = agregerLignes([{ montant_ligne: 100_000, categorie: 'consultation' }])
    expect(r).toEqual({ ht: 100_000, tva: 0, ca: 0 })
  })
})

describe('B. Ligne "hospitalisation" — TVA=0, CA=0, HT préservé', () => {
  it('500 000 FCFA d’hospitalisation : ht=500 000, tva=0, ca=0', () => {
    const r = agregerLignes([{ montant_ligne: 500_000, categorie: 'hospitalisation' }])
    expect(r).toEqual({ ht: 500_000, tva: 0, ca: 0 })
  })
})

describe('C. Ligne "labo" — TVA=0, CA=0, HT préservé', () => {
  it('25 000 FCFA d’analyse labo : ht=25 000, tva=0, ca=0', () => {
    const r = agregerLignes([{ montant_ligne: 25_000, categorie: 'labo' }])
    expect(r).toEqual({ ht: 25_000, tva: 0, ca: 0 })
  })
})

// ── F. Catégories non déterminées — non-régression stricte ─────────────────

describe('F. Catégories NON DÉTERMINÉES — aucune exonération artificielle', () => {
  it.each(['pharmacie', 'imagerie', 'bloc', 'autre', 'inconnue'])('%s reste taxable (pas exonérée)', (cat) => {
    expect(estCategorieSanteExonereeTVA(cat)).toBe(false)
  })

  it('118 900 FCFA de pharmacie : décomposé normalement (tva=18 000, ca=900), comme avant la correction', () => {
    const r = agregerLignes([{ montant_ligne: 118_900, categorie: 'pharmacie' }])
    expect(r).toEqual({ ht: 100_000, tva: 18_000, ca: 900 })
  })

  it('imagerie/bloc/autre produisent le même résultat que decomposerTTCUnifie seul (aucun traitement spécial)', () => {
    for (const cat of ['imagerie', 'bloc', 'autre']) {
      const attendu = decomposerTTCUnifie(59_450, 'CG')
      const r = agregerLignes([{ montant_ligne: 59_450, categorie: cat }])
      expect(r).toEqual({ ht: attendu.ht, tva: attendu.tva, ca: attendu.ca })
    }
  })
})

// ── Facture mixte (exonéré + taxable sur la même facture) ──────────────────

describe('Facture mixte — consultation exonérée + pharmacie taxable sur la même facture', () => {
  it('consultation 100 000 (exonérée) + pharmacie 118 900 TTC (taxable) : totaux corrects, pas de fuite d’un côté vers l’autre', () => {
    const r = agregerLignes([
      { montant_ligne: 100_000, categorie: 'consultation' },
      { montant_ligne: 118_900, categorie: 'pharmacie' },
    ])
    // consultation : ht=100000, tva=0, ca=0 ; pharmacie : ht=100000, tva=18000, ca=900
    expect(r).toEqual({ ht: 200_000, tva: 18_000, ca: 900 })
  })

  it('ht+tva+ca reconstitue exactement le montant_total facturé, quelle que soit la répartition exonéré/taxable', () => {
    const lignes = [
      { montant_ligne: 100_000, categorie: 'consultation' },
      { montant_ligne: 250_000, categorie: 'hospitalisation' },
      { montant_ligne: 12_345, categorie: 'labo' },
      { montant_ligne: 59_450, categorie: 'pharmacie' },
      { montant_ligne: 30_000, categorie: 'autre' },
    ]
    const montantTotal = lignes.reduce((s, l) => s + l.montant_ligne, 0)
    const r = agregerLignes(lignes)
    expect(r.ht + r.tva + r.ca).toBe(montantTotal)
  })
})

// ── Isolation : fonction pure, aucun état partagé ───────────────────────────

describe('Isolation — agrégation pure, aucun effet de bord entre appels', () => {
  it('deux jeux de lignes indépendants (simulant deux tenants) ne s’influencent jamais', () => {
    const lignesA = [{ montant_ligne: 100_000, categorie: 'consultation' }]
    const lignesB = [{ montant_ligne: 200_000, categorie: 'pharmacie' }]
    const rA1 = agregerLignes(lignesA)
    const rB  = agregerLignes(lignesB)
    const rA2 = agregerLignes(lignesA)
    expect(rA1).toEqual(rA2)
    expect(rA1).not.toEqual(rB)
  })
})

// ── Vérification statique : catégorie non écrasable avant émission ─────────

describe('Architecture — la catégorie persistée est exactement celle utilisée pour le calcul fiscal', () => {
  it('consultations/route.ts : une seule constante ligneCategorie, utilisée pour l’insert ET le calcul', () => {
    const src = sourceSansCommentaires('app/api/sante/consultations/route.ts')
    expect(src).toContain("const ligneCategorie = 'consultation'")
    expect(src).toContain('categorie:     ligneCategorie')
    expect(src).toContain('estCategorieSanteExonereeTVA(ligneCategorie)')
  })

  it('facturation/route.ts : le calcul fiscal itère sur `rows` (déjà inséré), pas sur `lignes` (entrée brute)', () => {
    const src = sourceSansCommentaires('app/api/sante/facturation/route.ts')
    expect(src).toContain('for (const r of rows)')
    expect(src).toContain('estCategorieSanteExonereeTVA(r.categorie)')
    // Le calcul ne doit plus décomposer le total brut de la facture directement
    expect(src).not.toMatch(/decomposerTTCUnifie\(montant_total/)
  })

  it('les deux writers importent la même source d’exonération (aucune liste dupliquée)', () => {
    for (const rel of ['app/api/sante/consultations/route.ts', 'app/api/sante/facturation/route.ts']) {
      const src = readFileSync(path.join(ROOT, rel), 'utf-8')
      expect(src).toContain("from '@/lib/fiscalite/sante-exonerations'")
    }
  })
})

// ── Non-régression : autres event_types intacts ─────────────────────────────

describe('Non-régression — RES-001/HOT-001/BOI-001/BTP-001/FAC-001 non concernés par ce fichier', () => {
  it('lib/fiscalite/sante-exonerations.ts n’est importé que par les 2 writers santé', () => {
    // Refonte 2026-11 : routes resto/hotel/boisson/btp supprimées avec leurs secteurs.
    const consumers = [
      'app/api/factures/[id]/route.ts',
    ]
    for (const rel of consumers) {
      const src = readFileSync(path.join(ROOT, rel), 'utf-8')
      expect(src).not.toContain('sante-exonerations')
    }
  })
})

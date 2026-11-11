/**
 * Refonte 2026-11 — réduction du périmètre à 6 secteurs.
 *
 * Décision fondateur + partenaires : on garde entreprises, écoles, commerces
 * (boutique, boulangerie, grande distribution), cabinets, santé (clinique,
 * hôpital) et recrutement. Tout le reste est retiré du code.
 *
 * Ce test verrouille :
 *  1. la liste canonique des secteurs (lib/erp-sectors.ts, source unique) ;
 *  2. la normalisation des valeurs historiques de tenants.secteur_activite
 *     (aucun tenant existant ne se retrouve sans secteur) ;
 *  3. l'absence de réintroduction des secteurs retirés dans les registres
 *     et dans l'arborescence app/.
 */

import { existsSync, readFileSync } from 'fs'
import path from 'path'
import { describe, it, expect } from 'vitest'
import {
  SECTOR_IDS, SECTOR_SPECIFIC, SECTOR_LABELS,
  isSectorId, normalizeSecteur, sectorLabel,
} from '../erp-sectors'
import { SECTEUR_CONFIG, SECTOR_EXTRA_MODULES } from '../plans'

const ROOT = path.resolve(__dirname, '../..')

const SECTEURS_RETIRES = [
  'restaurant', 'supermarche', 'boisson', 'transport', 'transport_public',
  'hotel', 'btp', 'petrole', 'ong', 'banque', 'pharmacie', 'agriculture', 'assurance',
]

describe('Périmètre — 6 secteurs canoniques', () => {
  it('SECTOR_IDS contient exactement les 6 secteurs retenus', () => {
    expect([...SECTOR_IDS].sort()).toEqual(
      ['cabinet', 'commerce', 'ecole', 'entreprise', 'recrutement', 'sante'],
    )
  })

  it('chaque secteur a un libellé et une config d\'onboarding', () => {
    for (const id of SECTOR_IDS) {
      expect(SECTOR_LABELS[id]).toBeTruthy()
      expect(SECTEUR_CONFIG[id]?.label).toBeTruthy()
    }
  })

  it('aucun secteur retiré dans les registres de modules', () => {
    for (const s of SECTEURS_RETIRES) {
      expect(isSectorId(s)).toBe(false)
      expect(Object.keys(SECTOR_SPECIFIC)).not.toContain(s)
      expect(Object.keys(SECTOR_EXTRA_MODULES)).not.toContain(s)
      expect(Object.keys(SECTEUR_CONFIG)).not.toContain(s)
    }
  })
})

describe('normalizeSecteur — valeurs historiques de tenants.secteur_activite', () => {
  it('les secteurs actuels sont conservés tels quels', () => {
    for (const id of SECTOR_IDS) expect(normalizeSecteur(id)).toBe(id)
  })

  it('« autre » devient « entreprise »', () => {
    expect(normalizeSecteur('autre')).toBe('entreprise')
  })

  it('« supermarche » et « boutique » rejoignent « commerce »', () => {
    expect(normalizeSecteur('supermarche')).toBe('commerce')
    expect(normalizeSecteur('boutique')).toBe('commerce')
  })

  it('un secteur retiré retombe sur « entreprise » (socle ERP conservé)', () => {
    for (const s of SECTEURS_RETIRES.filter(x => x !== 'supermarche')) {
      expect(normalizeSecteur(s)).toBe('entreprise')
    }
  })

  it('valeur inconnue → entreprise ; vide → null', () => {
    expect(normalizeSecteur('inconnu')).toBe('entreprise')
    expect(normalizeSecteur(null)).toBeNull()
    expect(normalizeSecteur(undefined)).toBeNull()
    expect(normalizeSecteur('')).toBeNull()
  })

  it('sectorLabel accepte une valeur historique', () => {
    expect(sectorLabel('autre')).toBe('Entreprise & PME')
    expect(sectorLabel('hotel')).toBe('Entreprise & PME')
    expect(sectorLabel(null)).toBe('')
  })
})

describe('Arborescence — les modules retirés ne reviennent pas', () => {
  const dossiers = [
    'app/dashboard/restaurant', 'app/dashboard/pharmacie', 'app/dashboard/hotel',
    'app/dashboard/transport', 'app/dashboard/btp', 'app/dashboard/banque',
    'app/dashboard/agriculture', 'app/dashboard/petrole', 'app/dashboard/ong',
    'app/dashboard/boisson', 'app/dashboard/assurance',
    'app/api/resto', 'app/api/hotel', 'app/api/btp', 'app/api/banque',
    'app/api/agriculture', 'app/api/petrole', 'app/api/ong', 'app/api/boisson',
    'app/api/assurance', 'app/api/agents/restaurant', 'app/resto',
  ]

  it.each(dossiers)('%s n\'existe plus', (rel) => {
    expect(existsSync(path.join(ROOT, rel))).toBe(false)
  })

  it('vercel.json ne planifie plus de cron vers une route supprimée', () => {
    const vercel = readFileSync(path.join(ROOT, 'vercel.json'), 'utf-8')
    expect(vercel).not.toContain('/api/agents/restaurant')
  })

  it('l\'onboarding valide le secteur via le registre unique', () => {
    const src = readFileSync(path.join(ROOT, 'app/onboarding/actions.ts'), 'utf-8')
    expect(src).toContain('isSectorId(data.secteurActivite)')
    expect(src).not.toContain('VALID_SECTEURS')
  })
})

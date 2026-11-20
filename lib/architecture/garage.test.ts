/**
 * Secteur Garage (refonte 2026-11, migration 189).
 *
 * 1. Règles métier pures (lib/garage/ordres.ts) : cycle de vie d'un OR,
 *    totaux via le moteur fiscal central, prix HT déduit du prix TTC stock.
 * 2. Garde-fous statiques : toutes les routes /api/garage passent par la
 *    garde canonique et filtrent sur le tenant de session ; la migration
 *    active la RLS, verrouille l'OR et réserve la facturation au serveur.
 */

import { readFileSync, readdirSync, statSync } from 'fs'
import path from 'path'
import { describe, it, expect } from 'vitest'
import {
  peutPasserA, lignesModifiables, totauxOrdre, prixUnitaireHTDepuisTTC,
  normaliserImmatriculation, isStatutOrdre, STATUTS_ORDRE,
} from '../garage/ordres'
import { calculerTVASurMontantUnifie, decomposerTTCUnifie } from '../fiscalite/engine-adapter'
import { isSectorId, SECTOR_SPECIFIC } from '../erp-sectors'
import { SECTEUR_CONFIG } from '../plans'

const ROOT = path.resolve(__dirname, '../..')
const read = (rel: string) => readFileSync(path.join(ROOT, rel), 'utf-8')

function routesGarage(dir = 'app/api/garage'): string[] {
  return readdirSync(path.join(ROOT, dir)).flatMap(entry => {
    const rel = `${dir}/${entry}`
    if (statSync(path.join(ROOT, rel)).isDirectory()) return routesGarage(rel)
    return entry === 'route.ts' ? [rel] : []
  })
}

describe('Garage — cycle de vie d\'un ordre de réparation', () => {
  it('chemin nominal ouvert → en_cours → termine, puis facture → livre', () => {
    expect(peutPasserA('ouvert', 'en_cours')).toBe(true)
    expect(peutPasserA('en_cours', 'termine')).toBe(true)
    expect(peutPasserA('facture', 'livre')).toBe(true)
  })

  it('la facturation n\'est jamais une simple transition de statut', () => {
    for (const s of STATUTS_ORDRE) expect(peutPasserA(s, 'facture')).toBe(false)
  })

  it('un OR facturé, livré ou annulé ne revient pas en arrière', () => {
    expect(peutPasserA('facture', 'en_cours')).toBe(false)
    expect(peutPasserA('livre', 'facture')).toBe(false)
    expect(peutPasserA('annule', 'ouvert')).toBe(false)
    expect(peutPasserA('termine', 'annule')).toBe(false)
  })

  it('les lignes ne sont modifiables qu\'avant la fin des travaux', () => {
    expect(lignesModifiables('ouvert')).toBe(true)
    expect(lignesModifiables('en_cours')).toBe(true)
    for (const s of ['termine', 'facture', 'livre', 'annule'] as const) expect(lignesModifiables(s)).toBe(false)
  })

  it('isStatutOrdre rejette les valeurs inconnues', () => {
    expect(isStatutOrdre('termine')).toBe(true)
    expect(isStatutOrdre('paye')).toBe(false)
    expect(isStatutOrdre(null)).toBe(false)
  })
})

describe('Garage — montants (moteur fiscal central, aucun taux local)', () => {
  it('totaux = somme HT des lignes + TVA/CA du moteur central', () => {
    const lignes = [
      { quantite: 2,   prix_unitaire: 15_000 },  // pièces
      { quantite: 1.5, prix_unitaire: 10_000 },  // main-d'œuvre
    ]
    const t = totauxOrdre(lignes)
    expect(t.ht).toBe(45_000)
    const central = calculerTVASurMontantUnifie(45_000, 'CG')
    expect({ tva: t.tva, ca: t.ca, ttc: t.ttc }).toEqual({ tva: central.tva, ca: central.ca, ttc: central.ttc })
    expect(t.ttc).toBe(t.ht + t.tva + t.ca)
  })

  it('OR vide → totaux nuls', () => {
    expect(totauxOrdre([]).ttc).toBe(0)
  })

  it('le prix HT d\'une pièce est déduit du prix de vente TTC du stock', () => {
    expect(prixUnitaireHTDepuisTTC(118_900)).toBe(decomposerTTCUnifie(118_900, 'CG').ht)
    expect(prixUnitaireHTDepuisTTC(118_900)).toBe(100_000)
  })

  it('aucun taux codé en dur dans lib/garage', () => {
    const src = read('lib/garage/ordres.ts')
    expect(src).not.toMatch(/0\.18\b|0\.189|1\.189|0\.05\b/)
  })

  it('immatriculation normalisée (unicité par tenant)', () => {
    expect(normaliserImmatriculation('  ab-123   cd ')).toBe('AB-123 CD')
  })
})

describe('Garage — routes API (isolation tenant)', () => {
  const routes = routesGarage()

  it('6 routes garage présentes', () => {
    expect(routes.length).toBe(6)
  })

  it.each(routes)('%s utilise la garde canonique et filtre sur ctx.tid', (rel) => {
    const src = read(rel)
    expect(src).toContain("from '@/lib/api/require-tenant'")
    expect(src).not.toContain('@/lib/tenant-guard')
    expect(src).toContain('ctx.tid')
    expect(src).not.toMatch(/body\.tenant_id|searchParams\.get\('tenant_id'\)/)
  })

  it('aucune route garage n\'émet d\'écriture comptable hors de la fonction SQL atomique', () => {
    for (const rel of routes) expect(read(rel)).not.toContain('emit_accounting_event')
  })

  it('la facturation passe par fn_garage_facturer_ordre', () => {
    expect(read('app/api/garage/ordres/[id]/facturer/route.ts')).toContain("rpc('fn_garage_facturer_ordre'")
  })
})

describe('Garage — migration 189', () => {
  const sql = read('supabase/migrations/189_garage.sql')

  it('RLS activée sur les 3 tables garage', () => {
    for (const t of ['garage_vehicules', 'garage_ordres', 'garage_ordre_lignes']) {
      expect(sql).toContain(`ALTER TABLE public.${t}`)
      expect(sql).toMatch(new RegExp(`ALTER TABLE public\\.${t}\\s+ENABLE ROW LEVEL SECURITY`))
    }
    expect(sql.match(/tenant_id = get_my_tenant_id\(\)/g)?.length).toBeGreaterThanOrEqual(6)
  })

  it('facturation : verrou, idempotence, OR terminé exigé, contrôle du HT', () => {
    expect(sql).toContain('FOR UPDATE')
    expect(sql).toContain('IF v_ordre.facture_id IS NOT NULL THEN')
    expect(sql).toContain("IF v_ordre.statut <> 'termine' THEN")
    expect(sql).toContain('abs(v_ht_calc - p_montant_ht) > 1')
  })

  it('écritures FAC-001 et STK-002 vérifiées « processed », sinon tout est annulé', () => {
    expect(sql).toContain("p_event_type    => 'FAC-001'")
    expect(sql).toContain("p_event_type    => 'STK-002'")
    expect(sql.match(/IS DISTINCT FROM 'processed'/g)?.length).toBe(2)
  })

  it('prérequis : ajout au tableau via array_append (text[] || \'littéral\' est lu comme un tableau)', () => {
    expect(sql).not.toMatch(/v_manquants\s*\|\|\s*'/)
    expect(sql.match(/array_append\(v_manquants, '/g)?.length).toBe(7)
  })

  it('fonctions réservées au serveur (service_role), jamais anon/authenticated', () => {
    expect(sql).toMatch(/REVOKE ALL ON FUNCTION public\.fn_garage_facturer_ordre\([^)]*\) FROM PUBLIC, anon, authenticated/)
    expect(sql).toMatch(/REVOKE ALL ON FUNCTION public\.fn_garage_numero_ordre\(UUID\) FROM PUBLIC, anon, authenticated/)
  })
})

describe('Garage — secteur enregistré', () => {
  it('garage est un secteur canonique avec ses modules et sa config d\'onboarding', () => {
    expect(isSectorId('garage')).toBe(true)
    expect(SECTOR_SPECIFIC.garage?.map(m => m.href)).toContain('/dashboard/garage')
    expect(SECTEUR_CONFIG.garage.label).toBeTruthy()
  })
})

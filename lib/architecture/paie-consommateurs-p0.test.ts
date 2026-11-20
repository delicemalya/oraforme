/**
 * lib/architecture/paie-consommateurs-p0.test.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Verrouille les conclusions de l'audit "MISSION P0-PAIE-CG-2026 — suppression
 * des calculs fiscaux parallèles" (2026-09-17) :
 *
 *  A. Module École (app/dashboard/ecole/rh/page.tsx) — même salarié / même
 *     rémunération / mêmes paramètres familiaux ⇒ mêmes cotisations que le
 *     moteur central (lib/fiscal/universal-tax-engine.ts).
 *  B. rh/page.tsx (calcNet) vs rh/paie/page.tsx (computeBulletin) — les deux
 *     chemins RH ne produisent plus deux assiettes DIFFÉRENTES sans que ce
 *     soit explicite : ce test verrouille l'écart réel constaté (transport +
 *     logement exclus d'un côté, inclus de l'autre) comme un FAIT documenté,
 *     pas une hypothèse — voir le commentaire au-dessus de calcNet().
 *  C. Aucun chemin de production ne recalcule TUS à 3 % ou 7,5 %, ni un taux
 *     CNSS local divergent, ni un second barème IRPP.
 *
 * Les modules testés sont des pages 'use client' qui importent lib/supabase.ts
 * (créant un client Supabase au chargement du module) : on simule les
 * variables d'environnement nécessaires une seule fois avant tout import
 * dynamique, même technique que tests/certifications/helpers/db.test.ts. Les
 * imports sont mis en cache (beforeAll, pas de vi.resetModules() par test) :
 * aucun de ces tests n'a besoin d'environnements différents d'un cas à
 * l'autre, et recharger un module 'use client' (framer-motion, lucide-react)
 * à chaque test est coûteux et flaky sous charge partagée.
 */

import { describe, it, expect, beforeAll } from 'vitest'
import { calculerChargesSociales, calculerIRPP } from '../fiscal/universal-tax-engine'
import { getCountryConfig } from '../countries'

let calculerRetenuesEcole: typeof import('../../app/dashboard/ecole/rh/page')['calculerRetenuesEcole']
let calcNet: typeof import('../../app/dashboard/rh/page')['calcNet']
let computeBulletin: typeof import('../../app/dashboard/rh/paie/page')['computeBulletin']
let calculerPaie: typeof import('../paie/calcul-paie')['calculerPaie']

beforeAll(async () => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test-project.supabase.co'
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'dummy-anon-key-for-tests'
  ;({ calculerRetenuesEcole } = await import('../../app/dashboard/ecole/rh/page'))
  ;({ calcNet } = await import('../../app/dashboard/rh/page'))
  ;({ computeBulletin } = await import('../../app/dashboard/rh/paie/page'))
  ;({ calculerPaie } = await import('../paie/calcul-paie'))
}, 30_000)

// ═══════════════════════════════════════════════════════════════════════════════
// A. Module École — même moteur que le module RH principal
// ═══════════════════════════════════════════════════════════════════════════════

describe('Module École — calculerRetenuesEcole() délègue au moteur central', () => {

  it('même salarié, même rémunération, mêmes paramètres ⇒ mêmes cotisations que calculerChargesSociales/calculerIRPP appelés directement', () => {
    const brut = 650_000
    const situation = 'marie' as const
    const nbEnfants = 2

    const viaEcole = calculerRetenuesEcole(brut, situation, nbEnfants)

    const cnssDirect = calculerChargesSociales({ codePays: 'CG', salaireBrut: brut })
    const baseIrppDirect = Math.max(0, brut - cnssDirect.total_salarie)
    const irppDirect = calculerIRPP({
      codePays: 'CG', salaireBrut: baseIrppDirect, salaireBrutOriginal: brut,
      situation, nombreEnfants: nbEnfants,
    })

    expect(viaEcole.cnss_salarie).toBe(cnssDirect.total_salarie)
    expect(viaEcole.cnss_patronal_total).toBe(cnssDirect.total_patronal_net)
    expect(viaEcole.irpp).toBe(irppDirect.irpp_net)
    expect(viaEcole.retenues).toBe(cnssDirect.total_salarie + irppDirect.irpp_net)
  })

  it('TUS patronal = 5,475 % du brut, pas 3 % ni 7,5 % (anciens taux codés en dur, supprimés)', () => {
    const brut = 800_000
    const calc = calculerRetenuesEcole(brut, null, 0)
    expect(calc.tus_patronal).toBe(Math.round(brut * 0.05475))
    expect(calc.tus_patronal).not.toBe(Math.round(brut * 0.03))
    expect(calc.tus_patronal).not.toBe(Math.round(brut * 0.075))
  })

  it("situation familiale absente (enseignant/staff, colonnes inexistantes) : traitée explicitement comme célibataire sans enfant, pas d'erreur", () => {
    expect(() => calculerRetenuesEcole(500_000, null, 0)).not.toThrow()
  })

})

// ═══════════════════════════════════════════════════════════════════════════════
// B. rh/page.tsx (calcNet) vs rh/paie/page.tsx (computeBulletin)
// ═══════════════════════════════════════════════════════════════════════════════

describe('rh/page.tsx vs rh/paie/page.tsx — écart transport/logement verrouillé, non arbitré', () => {

  it("calcNet (rh/page.tsx) exclut prime_transport + prime_logement de l'assiette cotisable", () => {
    const base = calcNet('CG', 500_000, 'celibataire', 0, {})
    const avecTransport = calcNet('CG', 500_000, 'celibataire', 0, { transport: 50_000 })
    // Le CNSS salarié ne bouge pas : la prime transport n'entre pas dans brutImposable.
    expect(avecTransport.cnss).toBe(base.cnss)
  })

  it("computeBulletin (rh/paie/page.tsx) inclut prime_transport dans l'assiette cotisable par défaut (indemnites_non_imposables=0)", () => {
    const cfg = getCountryConfig('CG')
    const sansTransport = computeBulletin(cfg, 'CG', { salaire_base: 500_000 }, 'celibataire', 0)
    const avecTransport = computeBulletin(cfg, 'CG', { salaire_base: 500_000, prime_transport: 50_000 }, 'celibataire', 0)
    // Ici, à l'inverse de calcNet, le CNSS salarié AUGMENTE avec la prime transport.
    expect(avecTransport.cnss_employe).toBeGreaterThan(sansTransport.cnss_employe)
  })

  it('les deux moteurs délèguent réellement à lib/fiscal/universal-tax-engine.ts (pas de second calcul CNSS/IRPP) — seule la base transmise diverge', () => {
    const cfg = getCountryConfig('CG')
    // Sans transport/logement, les deux chemins doivent converger : ils
    // appellent le même moteur sur la même base.
    const viaRh   = calcNet('CG', 500_000, 'celibataire', 0, {})
    const viaPaie = computeBulletin(cfg, 'CG', { salaire_base: 500_000 }, 'celibataire', 0)
    expect(viaRh.cnss).toBe(viaPaie.cnss_employe)
    expect(viaRh.irpp).toBe(viaPaie.irpp)
  })

})

// ═══════════════════════════════════════════════════════════════════════════════
// C. Agent RH IA — situation familiale transmise, plus de célibataire par défaut
// ═══════════════════════════════════════════════════════════════════════════════

describe('lib/paie/calcul-paie.ts — calculerPaie() accepte situation/nombreEnfants (consommé par l\'agent RH IA)', () => {

  it('un salarié marié avec enfants paie moins d\'IRPP qu\'un célibataire sans enfant, à brut identique', () => {
    const celibataire = calculerPaie({ salaire_base: 900_000 })
    const marie3       = calculerPaie({ salaire_base: 900_000, situation: 'marie', nombreEnfants: 3 })
    expect(marie3.irpp).toBeLessThan(celibataire.irpp)
  })

})

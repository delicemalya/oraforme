/**
 * Attack test — CRITICAL #3 (IRPP falsifiable côté client)
 *
 * Teste le VRAI chemin de calcul, pas l'absence d'un champ TypeScript :
 * `calculerChampsFiscauxDerives()` (lib/paie/calcul-paie.ts) est le noyau
 * exact utilisé par les deux routes qui persistent un bulletin
 * (app/api/rh/paie, app/api/paie/bulletins) et par calculerPaie() elle-même.
 * `recalculerBulletin()` (app/api/paie/bulletins/route.ts) est la fonction
 * réellement exécutée par la route lors d'un POST — pas une réimplémentation.
 *
 * Portée : fonctions pures, aucune base de données. Elles démontrent que le
 * code SERVEUR ignore toute donnée fiscale transmise par le client et ne
 * calcule qu'à partir de (brut reconstruit depuis les gains + situation
 * familiale/nombre d'enfants fournis en paramètre — simulant la lecture
 * serveur de employes.situation_matrimoniale/nb_enfants). Ne prouve PAS que
 * la route HTTP complète (auth, fetch Supabase, upsert) se comporte ainsi en
 * production — voir docs/C3-IRPP-SERVER-AUTHORITY-CLOSURE.md, section 9.
 */

import { describe, it, expect, vi } from 'vitest'

// app/api/paie/bulletins/route.ts importe lib/supabase-server (service_role,
// clé/URL réelles requises) et lib/api/require-tenant — sans objet avec le
// vrai calcul (recalculerBulletin), seulement avec son exécution DB, hors
// périmètre de ce test. Même mock que lib/identity/__tests__/*.
vi.mock('@/lib/supabase-server', () => ({ supabaseAdmin: { from: vi.fn() } }))
vi.mock('@/lib/api/require-tenant', () => ({ requireTenant: vi.fn() }))

import { calculerChampsFiscauxDerives } from '../paie/calcul-paie'
import { recalculerBulletin } from '../../app/api/paie/bulletins/route'

const BRUT_NORMAL = 716_102 // cas réel vérifié Mission P0 paie 2026-09-17

describe('CRITICAL #3 — CAS NORMAL (référence)', () => {
  it('brut normal, célibataire, 0 enfant → résultat de référence reproductible', () => {
    const r1 = calculerChampsFiscauxDerives(BRUT_NORMAL, 'celibataire', 0)
    const r2 = calculerChampsFiscauxDerives(BRUT_NORMAL, 'celibataire', 0)
    expect(r1).toEqual(r2) // déterministe
    expect(r1.cnss_salarie).toBeGreaterThan(0)
    expect(r1.irpp).toBeGreaterThanOrEqual(0)
  })
})

describe('CRITICAL #3 — FALSIFICATION #1 : CNSS', () => {
  it('le résultat ne dépend que du brut imposable réel, jamais d\'un cnss "client"', () => {
    const reference = calculerChampsFiscauxDerives(BRUT_NORMAL, 'celibataire', 0)
    // La fonction serveur n'accepte même pas de paramètre cnss en entrée —
    // il est physiquement impossible de lui en injecter un. On vérifie que
    // deux appels avec le même brut produisent exactement le même cnss,
    // quoi que le "client" aurait pu prétendre vouloir.
    const memeAppel = calculerChampsFiscauxDerives(BRUT_NORMAL, 'celibataire', 0)
    expect(memeAppel.cnss_salarie).toBe(reference.cnss_salarie)
    expect(memeAppel.cnss_patronal).toBe(reference.cnss_patronal)

    // Sur le vrai chemin d'exécution (recalculerBulletin) : un cnss_salarie
    // falsifié dans l'objet "bulletin" envoyé par le client est écrasé.
    const bulletinFalsifie = { salaire_base: BRUT_NORMAL, cnss_salarie: 1 } // client prétend cnss=1 FCFA
    const recalcule = recalculerBulletin(bulletinFalsifie, 'celibataire', 0)
    expect(recalcule.cnss_salarie).toBe(reference.cnss_salarie)
    expect(recalcule.cnss_salarie).not.toBe(1)
  })
})

describe('CRITICAL #3 — FALSIFICATION #2 : nombreParts / situation / enfants', () => {
  it('le serveur utilise la situation/nombre d\'enfants AUTORITATIF (paramètre de fonction), jamais une valeur du bulletin', () => {
    const celibataire0 = calculerChampsFiscauxDerives(3_000_000, 'celibataire', 0)
    const marie4enfants = calculerChampsFiscauxDerives(3_000_000, 'marie', 4)
    // Plus de parts fiscales → IRPP strictement inférieur sur un brut identique.
    expect(marie4enfants.irpp).toBeLessThan(celibataire0.irpp)

    // Le vrai chemin (recalculerBulletin) ne lit AUCUN champ "nombreParts"/
    // "situation"/"nb_enfants" depuis l'objet bulletin — seulement les 2
    // paramètres explicites (simulant la lecture serveur de employes.*).
    const bulletinAvecFausseSituation = {
      salaire_base: 3_000_000,
      situation: 'marie',       // le client met ça dans l'objet qu'il envoie
      nb_enfants: 4,            // idem
      nombreParts: 99,          // et même une valeur de parts totalement inventée
    }
    // Appelé avec l'autorité serveur réelle = célibataire/0 enfant (ce que
    // l'employé a VRAIMENT dans son dossier RH) — le résultat doit être
    // celui de célibataire/0, pas celui que les champs du bulletin suggèrent.
    const recalcule = recalculerBulletin(bulletinAvecFausseSituation, 'celibataire', 0)
    expect(recalcule.irpp).toBe(celibataire0.irpp)
    expect(recalcule.irpp).not.toBe(marie4enfants.irpp)
  })
})

describe('CRITICAL #3 — FALSIFICATION #3 : brut imposable / base imposable', () => {
  it('recalculerBulletin reconstruit le brut depuis les gains, ignore un champ "brut" falsifié', () => {
    const gains = { salaire_base: 500_000, prime_transport: 50_000, prime_logement: 30_000 }
    const brutReel = 500_000 + 50_000 + 30_000 // 580 000 — ce que les gains donnent réellement

    const bulletinFalsifie = { ...gains, brut: 1 } // le client prétend que son brut est de 1 FCFA
    const recalcule = recalculerBulletin(bulletinFalsifie, 'celibataire', 0)

    expect(recalcule.brut).toBe(brutReel)
    expect(recalcule.brut).not.toBe(1)

    // Et donc le CNSS/IRPP qui en découlent sont ceux du vrai brut, pas de "1".
    const attendu = calculerChampsFiscauxDerives(brutReel, 'celibataire', 0)
    expect(recalcule.cnss_salarie).toBe(attendu.cnss_salarie)
    expect(recalcule.irpp).toBe(attendu.irpp)
  })

  it('un "base_irpp" ou "base_imposable" injecté dans le bulletin n\'a aucun effet (champ jamais lu)', () => {
    const gains = { salaire_base: 716_102 }
    const sain      = recalculerBulletin({ ...gains }, 'celibataire', 0)
    const falsifie  = recalculerBulletin({ ...gains, base_irpp: 1, base_imposable: 1, brut_imposable: 1 }, 'celibataire', 0)
    expect(falsifie.irpp).toBe(sain.irpp)
    expect(falsifie.cnss_salarie).toBe(sain.cnss_salarie)
  })
})

describe('CRITICAL #3 — FALSIFICATION #4 : taux IRPP', () => {
  it('aucun paramètre de taux n\'existe dans la signature — un champ "taux"/"tauxIRPP" injecté est sans effet', () => {
    const sain = calculerChampsFiscauxDerives(2_000_000, 'celibataire', 0)
    const bulletinAvecFauxTaux = { salaire_base: 2_000_000, taux: 0, tauxIRPP: 0, taux_irpp: 0.4 }
    const recalcule = recalculerBulletin(bulletinAvecFauxTaux, 'celibataire', 0)
    expect(recalcule.irpp).toBe(sain.irpp)
  })
})

describe('CRITICAL #3 — FALSIFICATION #5 : abattement', () => {
  it('aucun paramètre d\'abattement n\'existe dans la signature — un champ "abattement" injecté est sans effet', () => {
    const sain = calculerChampsFiscauxDerives(2_000_000, 'celibataire', 0)
    const bulletinAvecFauxAbattement = { salaire_base: 2_000_000, abattement: 999_999_999 }
    const recalcule = recalculerBulletin(bulletinAvecFauxAbattement, 'celibataire', 0)
    expect(recalcule.irpp).toBe(sain.irpp)
  })
})

describe('CRITICAL #3 — net et coût employeur recalculés en cohérence (pas seulement irpp isolé)', () => {
  it('net = brut réel - total des retenues réelles, jamais le "net" soumis par le client', () => {
    const gains = { salaire_base: 716_102, mutuelle: 5_000 }
    const recalcule = recalculerBulletin({ ...gains, net: 999_999_999 }, 'celibataire', 0)
    expect(recalcule.net).not.toBe(999_999_999)
    expect(recalcule.net).toBe(
      (recalcule.brut as number) - (recalcule.cnss_salarie as number) -
      (recalcule.irpp as number) - 5_000,
    )
  })
})

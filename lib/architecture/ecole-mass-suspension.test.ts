/**
 * LOT 0A — Neutralisation de la suspension en masse (École → Direction → « Bloquer auto impayés »).
 *
 * Avant : la colonne filtrée (`paiements_scolaires.annee_scolaire`) n'existe dans aucune migration ;
 * supabase-js renvoyait { data: null, error } sans lever, l'erreur était ignorée, donc TOUS les élèves
 * actifs étaient suspendus d'un clic, sans confirmation, avec régénération de leur code de déblocage.
 *
 * Tests isolés : aucune base, aucun réseau. La logique est testée via des doublures ; la page est
 * contrôlée statiquement pour qu'aucune suspension ne contourne ces garde-fous.
 */
import { readFileSync } from 'fs'
import path from 'path'
import { describe, it, expect, vi } from 'vitest'
import {
  computeUnpaidActifs,
  runMassSuspension,
  buildSuspensionConfirmMessage,
  type SuspensionCandidate,
  type PaidLookupResult,
} from '../../app/dashboard/ecole/_lib/mass-suspension'

const ELEVES: SuspensionCandidate[] = [
  { id: 'e1', statut: 'actif', code_deblocage: null },
  { id: 'e2', statut: 'actif', code_deblocage: 'EXIST1' },
  { id: 'e3', statut: 'actif', code_deblocage: null },
  { id: 'e4', statut: 'suspendu', code_deblocage: 'OLD999' },
  { id: 'e5', statut: 'diplome', code_deblocage: null },
]

const COLONNE_INEXISTANTE: PaidLookupResult = {
  data: null,
  error: { code: '42703', message: 'column paiements_scolaires.annee_scolaire does not exist' },
}

function setup(paid: PaidLookupResult, confirmAnswer: boolean, suspendError?: (id: string) => unknown) {
  const fetchPaid = vi.fn(async () => paid)
  const confirm = vi.fn(() => confirmAnswer)
  const suspend = vi.fn(async (id: string) => ({ error: suspendError?.(id) ?? null }))
  const generateCode = vi.fn(() => 'NEWCOD')
  return { fetchPaid, confirm, suspend, generateCode }
}

describe('computeUnpaidActifs', () => {
  it("renvoie null (inconnu) quand la lecture des paiements échoue — jamais « tous impayés »", () => {
    expect(computeUnpaidActifs(ELEVES, COLONNE_INEXISTANTE)).toBeNull()
  })

  it('renvoie null quand data est absent même sans erreur', () => {
    expect(computeUnpaidActifs(ELEVES, { data: null, error: null })).toBeNull()
  })

  it("critère inchangé : élèves actifs sans paiement trouvé", () => {
    const unpaid = computeUnpaidActifs(ELEVES, { data: [{ etudiant_id: 'e1' }], error: null })
    expect(unpaid?.map(e => e.id)).toEqual(['e2', 'e3'])
  })
})

describe('runMassSuspension', () => {
  it("n'écrit rien et ne demande rien quand la lecture des paiements échoue (cas de la colonne inexistante)", async () => {
    const d = setup(COLONNE_INEXISTANTE, true)
    const r = await runMassSuspension({ etudiants: ELEVES, annee: '2026', ...d })
    expect(r).toEqual({ status: 'lookup_error' })
    expect(d.confirm).not.toHaveBeenCalled()
    expect(d.suspend).not.toHaveBeenCalled()
    expect(d.generateCode).not.toHaveBeenCalled()
  })

  it("ne suspend personne sans confirmation explicite (clic simple puis refus)", async () => {
    const d = setup({ data: [], error: null }, false)
    const r = await runMassSuspension({ etudiants: ELEVES, annee: '2026', ...d })
    expect(r).toEqual({ status: 'cancelled', candidates: 3 })
    expect(d.confirm).toHaveBeenCalledTimes(1)
    expect(d.suspend).not.toHaveBeenCalled()
  })

  it('la confirmation annonce le nombre, le total et le critère, et alerte quand tous sont concernés', async () => {
    const d = setup({ data: [], error: null }, false)
    await runMassSuspension({ etudiants: ELEVES, annee: '2026', ...d })
    const msg = d.confirm.mock.calls[0][0] as string
    expect(msg).toContain('Suspendre 3 élève(s) actif(s) sur 3')
    expect(msg).toContain("aucun paiement enregistré pour l'année 2026")
    expect(msg).toContain('TOUS les élèves actifs')
  })

  it("pas d'alerte « tous » quand seule une partie est concernée", () => {
    expect(buildSuspensionConfirmMessage(2, 3, '2026')).not.toContain('TOUS')
  })

  it("après confirmation, ne suspend que les actifs sans paiement (pas tous par défaut)", async () => {
    const d = setup({ data: [{ etudiant_id: 'e1' }], error: null }, true)
    const r = await runMassSuspension({ etudiants: ELEVES, annee: '2026', ...d })
    expect(r).toEqual({ status: 'done', suspended: 2, failed: false, candidates: 2 })
    expect(d.suspend.mock.calls.map(c => c[0])).toEqual(['e2', 'e3'])
  })

  it('ne remplace jamais un code de déblocage existant', async () => {
    const d = setup({ data: [{ etudiant_id: 'e1' }], error: null }, true)
    await runMassSuspension({ etudiants: ELEVES, annee: '2026', ...d })
    expect(d.suspend).toHaveBeenCalledWith('e2', 'EXIST1')
    expect(d.suspend).toHaveBeenCalledWith('e3', 'NEWCOD')
    expect(d.generateCode).toHaveBeenCalledTimes(1)
  })

  it("ne touche jamais aux élèves non actifs (suspendus, diplômés)", async () => {
    const d = setup({ data: [], error: null }, true)
    await runMassSuspension({ etudiants: ELEVES, annee: '2026', ...d })
    const ids = d.suspend.mock.calls.map(c => c[0])
    expect(ids).not.toContain('e4')
    expect(ids).not.toContain('e5')
  })

  it("s'arrête à la première écriture en échec", async () => {
    const d = setup({ data: [], error: null }, true, id => (id === 'e2' ? { message: 'rls' } : null))
    const r = await runMassSuspension({ etudiants: ELEVES, annee: '2026', ...d })
    expect(r).toEqual({ status: 'done', suspended: 1, failed: true, candidates: 3 })
    expect(d.suspend).toHaveBeenCalledTimes(2)
  })

  it("rien à faire : aucun actif, ou tous à jour — ni confirmation ni écriture", async () => {
    const vide = setup({ data: [], error: null }, true)
    expect(await runMassSuspension({ etudiants: [ELEVES[3]], annee: '2026', ...vide })).toEqual({ status: 'nothing_to_do' })
    expect(vide.fetchPaid).not.toHaveBeenCalled()

    const aJour = setup({ data: [{ etudiant_id: 'e1' }, { etudiant_id: 'e2' }, { etudiant_id: 'e3' }], error: null }, true)
    expect(await runMassSuspension({ etudiants: ELEVES, annee: '2026', ...aJour })).toEqual({ status: 'nothing_to_do' })
    expect(aJour.confirm).not.toHaveBeenCalled()
    expect(aJour.suspend).not.toHaveBeenCalled()
  })
})

describe('direction/page.tsx — garde-fous câblés (contrôle statique)', () => {
  const src = readFileSync(path.resolve(__dirname, '../../app/dashboard/ecole/direction/page.tsx'), 'utf-8')

  it('autoBlock passe par runMassSuspension avec une confirmation explicite', () => {
    const body = src.slice(src.indexOf('async function autoBlock'), src.indexOf('const kpis'))
    expect(body).toContain('runMassSuspension(')
    expect(body).toContain('window.confirm(')
  })

  it("l'unique écriture « suspendu » de la page est celle injectée dans runMassSuspension", () => {
    const writes = src.match(/statut:\s*'suspendu'/g) ?? []
    expect(writes).toHaveLength(1)
    const body = src.slice(src.indexOf('async function autoBlock'), src.indexOf('const kpis'))
    expect(body).toMatch(/suspend:\s*async[\s\S]*statut:\s*'suspendu'/)
  })

  it('la lecture des paiements transmet son erreur (plus de `data ?? []` sur cette requête)', () => {
    const fetchBlock = src.slice(src.indexOf('const fetchPaid'), src.indexOf('useEffect('))
    expect(fetchBlock).toContain('return { data, error }')
  })

  it("le bouton est désactivé quand le nombre d'impayés est inconnu ou nul", () => {
    expect(src).toContain('disabled={blocking || !impayeCount || statsLoading}')
  })
})

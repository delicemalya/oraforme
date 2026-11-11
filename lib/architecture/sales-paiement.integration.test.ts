/**
 * Tests d'intégration mockés — POST /api/sales/:id/paiement (C6-POST-REVIEW-FIX, A2)
 *
 * Exécute RÉELLEMENT le handler de app/api/sales/[id]/paiement/route.ts
 * contre un faux client Supabase programmable — pas une base réelle. Prouve
 * que la route refuse VTE-002 tant que VTE-001 n'est pas confirmé
 * 'processed' en relisant accounting_events, et jamais en se fiant à
 * l'existence de la vente ou à un statut envoyé par le client.
 *
 * ⚠️ Ne prouve PAS le comportement réel de emit_accounting_event/
 * fn_ae_execute_event — simulées ici par des réponses programmées.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

const TID = 'tenant-a-11111111-1111-1111-1111-111111111111'
const VENTE_ID = 'vente-credit-1'

vi.mock('@/lib/api/require-tenant', () => ({
  requireTenant: vi.fn(async () => ({ ok: true, tid: TID, userId: 'u1', profileId: 'p1', role: 'membre' })),
}))

type Resp = { data?: unknown; error?: { message: string; code?: string } | null }

function makeSupabaseMock() {
  const queues: Record<string, Resp[]> = {}
  const rpcQueues: Record<string, Resp[]> = {}
  const rpcCalls: { fn: string; args: unknown }[] = []
  const calls: { table: string; op: string }[] = []

  function nextFor(table: string): Resp {
    const q = queues[table]
    if (!q || q.length === 0) throw new Error(`Aucune réponse programmée pour la table "${table}"`)
    return q.shift()!
  }

  function builder(table: string) {
    const state: { op: string } = { op: 'select' }
    const self: Record<string, unknown> = {
      select: (..._a: unknown[]) => self,
      eq:     (..._a: unknown[]) => self,
      update: (_payload: unknown) => { state.op = 'update'; return self },
      single:      () => resolve(),
      maybeSingle: () => resolve(),
      then: (onFulfilled: (v: Resp) => unknown, onRejected?: (e: unknown) => unknown) =>
        resolve().then(onFulfilled, onRejected),
    }
    function resolve(): Promise<Resp> {
      calls.push({ table, op: state.op })
      return Promise.resolve(nextFor(table))
    }
    return self
  }

  const supabaseAdmin = {
    from: (table: string) => builder(table),
    rpc: (fn: string, args: unknown) => {
      rpcCalls.push({ fn, args })
      const q = rpcQueues[fn]
      if (!q || q.length === 0) throw new Error(`Aucune réponse RPC programmée pour "${fn}"`)
      return Promise.resolve(q.shift()!)
    },
  }

  return {
    supabaseAdmin, rpcCalls, calls,
    queue: (table: string, resp: Resp) => { (queues[table] ??= []).push(resp) },
    queueRpc: (fn: string, resp: Resp) => { (rpcQueues[fn] ??= []).push(resp) },
  }
}

let mock: ReturnType<typeof makeSupabaseMock>

vi.mock('@/lib/supabase-server', () => ({
  get supabaseAdmin() { return mock.supabaseAdmin },
}))

beforeEach(() => { mock = makeSupabaseMock() })

function req(body: unknown = {}) {
  return new Request(`http://localhost/api/sales/${VENTE_ID}/paiement`, {
    method: 'POST', body: JSON.stringify(body),
  }) as unknown as import('next/server').NextRequest
}

const PARAMS = { params: Promise.resolve({ id: VENTE_ID }) }

describe('POST /api/sales/:id/paiement — A2 : VTE-001 doit être confirmé avant VTE-002', () => {
  it('VTE-001 absent → paiement refusé, aucune émission VTE-002', async () => {
    const { POST } = await import('../../app/api/sales/[id]/paiement/route')
    mock.queue('ventes', { data: { id: VENTE_ID, total: 10000, statut_paiement: 'du', mode_paiement: 'credit' } })
    mock.queue('accounting_events', { data: null }) // aucun VTE-001 trouvé

    const res = await POST(req(), PARAMS)

    expect(res.status).toBe(409)
    expect(mock.rpcCalls.length).toBe(0)
  })

  it('VTE-001 au statut "error" (échoué) → paiement refusé', async () => {
    const { POST } = await import('../../app/api/sales/[id]/paiement/route')
    mock.queue('ventes', { data: { id: VENTE_ID, total: 10000, statut_paiement: 'du', mode_paiement: 'credit' } })
    mock.queue('accounting_events', { data: { id: 'ev1', status: 'error' } })

    const res = await POST(req(), PARAMS)

    expect(res.status).toBe(409)
    expect(mock.rpcCalls.length).toBe(0)
  })

  it('VTE-001 "processed" → VTE-002 émis, confirmé "processed", règlement accepté', async () => {
    const { POST } = await import('../../app/api/sales/[id]/paiement/route')
    mock.queue('ventes', { data: { id: VENTE_ID, total: 10000, statut_paiement: 'du', mode_paiement: 'credit' } })
    mock.queue('accounting_events', { data: { id: 'ev1', status: 'processed' } }) // VTE-001
    mock.queueRpc('emit_accounting_event', { data: 'ev2', error: null })
    mock.queue('accounting_events', { data: { status: 'processed' } }) // relecture VTE-002
    mock.queue('ventes', { data: { id: VENTE_ID, statut_paiement: 'solde' } }) // update

    const res = await POST(req(), PARAMS)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.statut_paiement).toBe('solde')
    expect(mock.rpcCalls.find(c => c.fn === 'emit_accounting_event')!.args)
      .toMatchObject({ p_event_type: 'VTE-002', p_source_table: 'ventes' })
  })

  it('émission VTE-002 réussie mais statut final ≠ "processed" → statut_paiement NON mis à jour', async () => {
    const { POST } = await import('../../app/api/sales/[id]/paiement/route')
    mock.queue('ventes', { data: { id: VENTE_ID, total: 10000, statut_paiement: 'du', mode_paiement: 'credit' } })
    mock.queue('accounting_events', { data: { id: 'ev1', status: 'processed' } }) // VTE-001
    mock.queueRpc('emit_accounting_event', { data: 'ev2', error: null })
    mock.queue('accounting_events', { data: { status: 'error' } }) // VTE-002 a échoué en interne

    const res = await POST(req(), PARAMS)

    expect(res.status).toBe(409)
    // Aucun UPDATE ventes n'a été tenté.
    expect(mock.calls.some(c => c.table === 'ventes' && c.op === 'update')).toBe(false)
  })
})

describe('POST /api/sales/:id/paiement — idempotence du retry', () => {
  it('retry sur une vente déjà "solde" → 200 replay:true, aucun appel supplémentaire', async () => {
    const { POST } = await import('../../app/api/sales/[id]/paiement/route')
    mock.queue('ventes', { data: { id: VENTE_ID, total: 10000, statut_paiement: 'solde', mode_paiement: 'credit' } })

    const res = await POST(req(), PARAMS)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.replay).toBe(true)
    expect(mock.rpcCalls.length).toBe(0)
    expect(mock.calls.some(c => c.table === 'accounting_events')).toBe(false)
  })
})

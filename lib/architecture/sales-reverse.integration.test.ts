/**
 * Tests d'intégration mockés — POST /api/sales/:id/reverse (C6-POST-REVIEW-FIX, C1)
 *
 * Exécute RÉELLEMENT le handler de app/api/sales/[id]/reverse/route.ts
 * contre un faux client Supabase programmable — pas une base réelle. Prouve
 * qu'un second appel sur la même vente ne recrédite pas le stock et ne
 * retente pas une extourne comptable déjà faite, en traitant les signaux
 * d'idempotence (status='reversed', erreur 23505 sur reversed_movement_id)
 * comme des no-op déterministes plutôt que des échecs.
 *
 * ⚠️ Ne prouve PAS le comportement réel de la contrainte UNIQUE
 * idx_stock_movements_reversed_movement sous appels concurrents — propriété
 * de Postgres, pas de ce mock (NOT_TESTABLE sans canal DB réel, voir
 * docs/C6-POST-REVIEW-FIX.md).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

const TID = 'tenant-a-11111111-1111-1111-1111-111111111111'
const VENTE_ID = 'vente-1'

vi.mock('@/lib/api/require-tenant', () => ({
  requireRole: vi.fn(async () => ({ ok: true, tid: TID, userId: 'u1', profileId: 'p1', role: 'admin' })),
}))

type Resp = { data?: unknown; error?: { message: string; code?: string } | null }

function makeSupabaseMock() {
  const queues: Record<string, Resp[]> = {}
  const rpcQueues: Record<string, Resp[]> = {}
  const rpcCalls: { fn: string; args: unknown }[] = []

  function nextFor(table: string): Resp {
    const q = queues[table]
    if (!q || q.length === 0) throw new Error(`Aucune réponse programmée pour la table "${table}"`)
    return q.shift()!
  }

  function builder(table: string) {
    const self: Record<string, unknown> = {
      select: (..._a: unknown[]) => self,
      eq:     (..._a: unknown[]) => self,
      in:     (..._a: unknown[]) => self,
      maybeSingle: () => resolve(),
      then: (onFulfilled: (v: Resp) => unknown, onRejected?: (e: unknown) => unknown) =>
        resolve().then(onFulfilled, onRejected),
    }
    function resolve(): Promise<Resp> {
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
    supabaseAdmin, rpcCalls,
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
  return new Request(`http://localhost/api/sales/${VENTE_ID}/reverse`, {
    method: 'POST', body: JSON.stringify(body),
  }) as unknown as import('next/server').NextRequest
}

const PARAMS = { params: Promise.resolve({ id: VENTE_ID }) }
const MOUVEMENT = { id: 'mvt-1', product_id: 'prod-1', warehouse_id: null, quantite: 2, origine: null, purchase_item_id: null }

describe('POST /api/sales/:id/reverse — C1 : premier appel', () => {
  it('extourne VTE-001 et retourne le stock, succès déterministe', async () => {
    const { POST } = await import('../../app/api/sales/[id]/reverse/route')
    mock.queue('ventes', { data: { id: VENTE_ID } })
    mock.queue('accounting_events', { data: [{ id: 'ev-1', event_type: 'VTE-001', status: 'processed' }] })
    mock.queueRpc('fn_reverse_accounting_event', { error: null })
    mock.queue('stock_movements', { data: [MOUVEMENT] })
    mock.queueRpc('fn_stock_move', { error: null })

    const res = await POST(req(), PARAMS)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.reversed).toEqual(['VTE-001'])
    expect(body.alreadyReversed).toEqual([])
    expect(body.stockRetours).toEqual(['prod-1'])
    expect(body.stockDejaRetournes).toEqual([])

    const stockCall = mock.rpcCalls.find(c => c.fn === 'fn_stock_move')!.args as Record<string, unknown>
    expect(stockCall.p_reversed_movement_id).toBe('mvt-1')
    expect(stockCall.p_type).toBe('retour')
  })
})

describe('POST /api/sales/:id/reverse — C1 : second appel, idempotent', () => {
  it('VTE-001 déjà "reversed" → aucune ré-extourne ; stock déjà retourné (23505) → aucun second crédit, toujours 200', async () => {
    const { POST } = await import('../../app/api/sales/[id]/reverse/route')
    mock.queue('ventes', { data: { id: VENTE_ID } })
    // État après le premier appel : l'événement est déjà 'reversed'.
    mock.queue('accounting_events', { data: [{ id: 'ev-1', event_type: 'VTE-001', status: 'reversed' }] })
    // Le mouvement 'sortie' original n'est jamais supprimé — toujours retrouvé.
    mock.queue('stock_movements', { data: [MOUVEMENT] })
    // La contrainte UNIQUE sur reversed_movement_id rejette le second retour.
    mock.queueRpc('fn_stock_move', { error: { message: 'duplicate key value violates unique constraint', code: '23505' } })

    const res = await POST(req(), PARAMS)
    const body = await res.json()

    expect(res.status).toBe(200) // pas 207 — un no-op idempotent n'est pas une défaillance partielle
    expect(body.reversed).toEqual([])
    expect(body.alreadyReversed).toEqual(['VTE-001'])
    expect(body.stockRetours).toEqual([])
    expect(body.stockDejaRetournes).toEqual(['prod-1'])
    // Aucun appel à fn_reverse_accounting_event pour un événement déjà reversed.
    expect(mock.rpcCalls.some(c => c.fn === 'fn_reverse_accounting_event')).toBe(false)
  })
})

describe('POST /api/sales/:id/reverse — une vraie défaillance reste distincte d\'un no-op idempotent', () => {
  it('erreur autre que 23505 sur le retour de stock → 207, stockEchecs peuplé (pas stockDejaRetournes)', async () => {
    const { POST } = await import('../../app/api/sales/[id]/reverse/route')
    mock.queue('ventes', { data: { id: VENTE_ID } })
    mock.queue('accounting_events', { data: [{ id: 'ev-1', event_type: 'VTE-001', status: 'processed' }] })
    mock.queueRpc('fn_reverse_accounting_event', { error: null })
    mock.queue('stock_movements', { data: [MOUVEMENT] })
    mock.queueRpc('fn_stock_move', { error: { message: 'colonne inconnue', code: '42703' } })

    const res = await POST(req(), PARAMS)
    const body = await res.json()

    expect(res.status).toBe(207)
    expect(body.stockDejaRetournes).toEqual([])
    expect(body.warning).toMatch(/stock échoué/)
  })
})

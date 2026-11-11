/**
 * Tests d'intégration mockés — POST /api/sales (C6, puis C6-POST-REVIEW-FIX)
 *
 * Exécute RÉELLEMENT le handler de app/api/sales/route.ts (pas une
 * réimplémentation) contre un faux client Supabase programmable — pas une
 * base réelle. Depuis C6-POST-REVIEW-FIX (anomalie A1), vente + lignes +
 * stock + comptabilité sont orchestrées par UN SEUL appel RPC
 * (fn_create_vente_atomique, migration 186) — ces tests prouvent que la
 * route transmet les bons arguments à cet appel et traite correctement son
 * résultat (succès neuf, replay, échec), PAS le comportement réel de la
 * fonction PL/pgSQL elle-même (simulée ici par une réponse programmée).
 *
 * ⚠️ Ne prouve PAS : l'atomicité réelle de fn_create_vente_atomique (c'est
 * une propriété de Postgres, pas de ce mock — voir docs/C6-POST-REVIEW-FIX.md
 * pour ce qui reste NOT_TESTABLE sans canal DB réel), le comportement réel
 * de la contrainte UNIQUE sous concurrence, ni celui de fn_stock_move/
 * emit_accounting_event à l'intérieur de la fonction SQL.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

const TID = 'tenant-a-11111111-1111-1111-1111-111111111111'

vi.mock('@/lib/api/require-tenant', () => ({
  requireTenant: vi.fn(async () => ({ ok: true, tid: TID, userId: 'u1', profileId: 'p1', role: 'membre' })),
}))

// ── Faux client Supabase, programmable par table ────────────────────────────
type Resp = { data?: unknown; error?: { message: string; code?: string } | null }

function makeSupabaseMock() {
  const queues: Record<string, Resp[]> = {}
  const rpcQueues: Record<string, Resp[]> = {}
  const calls: { table: string; op: string; payload?: unknown }[] = []
  const rpcCalls: { fn: string; args: unknown }[] = []

  function nextFor(table: string): Resp {
    const q = queues[table]
    if (!q || q.length === 0) throw new Error(`Aucune réponse programmée pour la table "${table}"`)
    return q.shift()!
  }

  function builder(table: string) {
    const state: { op: string; payload?: unknown } = { op: 'select' }
    const self: Record<string, unknown> = {
      select: (..._a: unknown[]) => self,
      eq:     (..._a: unknown[]) => self,
      in:     (..._a: unknown[]) => self,
      order:  (..._a: unknown[]) => self,
      limit:  (..._a: unknown[]) => self,
      insert: (payload: unknown) => { state.op = 'insert'; state.payload = payload; return self },
      delete: () => { state.op = 'delete'; return self },
      update: (payload: unknown) => { state.op = 'update'; state.payload = payload; return self },
      single:     () => resolve(),
      maybeSingle: () => resolve(),
      then: (onFulfilled: (v: Resp) => unknown, onRejected?: (e: unknown) => unknown) =>
        resolve().then(onFulfilled, onRejected),
    }
    function resolve(): Promise<Resp> {
      calls.push({ table, op: state.op, payload: state.payload })
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
    supabaseAdmin,
    calls, rpcCalls,
    queue: (table: string, resp: Resp) => { (queues[table] ??= []).push(resp) },
    queueRpc: (fn: string, resp: Resp) => { (rpcQueues[fn] ??= []).push(resp) },
  }
}

let mock: ReturnType<typeof makeSupabaseMock>

vi.mock('@/lib/supabase-server', () => ({
  get supabaseAdmin() { return mock.supabaseAdmin },
}))

beforeEach(() => { mock = makeSupabaseMock() })

const PRODUIT = { id: 'prod-1', nom: 'Fournitures bureau', prix_vente: 40000, prix_achat: 25000 }

function req(body: unknown) {
  return new Request('http://localhost/api/sales', { method: 'POST', body: JSON.stringify(body) }) as unknown as import('next/server').NextRequest
}

describe('POST /api/sales — validations (avant tout accès DB)', () => {
  it('refuse un panier vide', async () => {
    const { POST } = await import('../../app/api/sales/route')
    const res = await POST(req({ lignes: [], mode_paiement: 'especes' }))
    expect(res.status).toBe(400)
  })

  it('refuse mode_paiement invalide', async () => {
    const { POST } = await import('../../app/api/sales/route')
    const res = await POST(req({ lignes: [{ produit_id: 'p', qte: 1 }], mode_paiement: 'cheque' }))
    expect(res.status).toBe(400)
  })

  it('refuse une vente à crédit sans destinataire', async () => {
    const { POST } = await import('../../app/api/sales/route')
    const res = await POST(req({ lignes: [{ produit_id: 'p', qte: 1 }], mode_paiement: 'credit' }))
    expect(res.status).toBe(400)
    expect((await res.json()).error).toMatch(/destinataire/)
  })

  it('refuse une origine inconnue', async () => {
    const { POST } = await import('../../app/api/sales/route')
    const res = await POST(req({ lignes: [{ produit_id: 'p', qte: 1, origine: 'vol' }], mode_paiement: 'especes' }))
    expect(res.status).toBe(400)
  })
})

describe('POST /api/sales — produit hors tenant : refus avant toute écriture', () => {
  it('404/403 si un produit du panier n\'appartient pas au tenant de session', async () => {
    const { POST } = await import('../../app/api/sales/route')
    mock.queue('products', { data: [] }) // aucun produit trouvé pour ce tenant

    const res = await POST(req({
      lignes: [{ produit_id: 'prod-tenant-b', qte: 1 }],
      mode_paiement: 'especes',
    }))

    expect(res.status).toBe(403)
    expect(mock.rpcCalls.length).toBe(0) // jamais atteint le point transactionnel
  })
})

describe('POST /api/sales — B1 : purchase_item_id doit appartenir au tenant appelant', () => {
  it('même tenant → accepté, le flux continue jusqu\'au RPC atomique', async () => {
    const { POST } = await import('../../app/api/sales/route')
    mock.queue('products', { data: [PRODUIT] })
    mock.queue('purchase_items', { data: [{ id: 'pi-1' }] }) // trouvé pour ce tenant
    mock.queueRpc('fn_create_vente_atomique', { data: [{ vente_id: 'vente-1', replay: false }], error: null })
    mock.queue('ventes', { data: { id: 'vente-1', vente_lignes: [] } })

    const res = await POST(req({
      lignes: [{ produit_id: 'prod-1', qte: 1, purchase_item_id: 'pi-1' }],
      mode_paiement: 'especes',
    }))

    expect(res.status).toBe(201)
    expect(mock.rpcCalls.some(c => c.fn === 'fn_create_vente_atomique')).toBe(true)
  })

  it('purchase_item_id d\'un autre tenant (ou inexistant) → 403, jamais atteint le RPC', async () => {
    const { POST } = await import('../../app/api/sales/route')
    mock.queue('products', { data: [PRODUIT] })
    // La requête scopée tenant ne retourne rien — indistinguable entre "autre
    // tenant" et "inexistant" : propriété de sécurité voulue, pas une lacune
    // de ce test (aucune fuite d'information sur l'existence de l'ID ailleurs).
    mock.queue('purchase_items', { data: [] })

    const res = await POST(req({
      lignes: [{ produit_id: 'prod-1', qte: 1, purchase_item_id: 'pi-autre-tenant' }],
      mode_paiement: 'especes',
    }))

    expect(res.status).toBe(403)
    expect(mock.rpcCalls.length).toBe(0)
  })
})

describe('POST /api/sales — A1 : point transactionnel unique (fn_create_vente_atomique)', () => {
  it('vente comptant, chemin complet : transmet les bons montants/metadata au RPC atomique', async () => {
    const { POST } = await import('../../app/api/sales/route')

    mock.queue('products', { data: [PRODUIT] })
    mock.queueRpc('fn_create_vente_atomique', { data: [{ vente_id: 'vente-1', replay: false }], error: null })
    mock.queue('ventes', { data: { id: 'vente-1', total: 40000, vente_lignes: [] } })

    const res = await POST(req({
      idempotency_key: 'k1',
      lignes: [{ produit_id: 'prod-1', qte: 1 }],
      mode_paiement: 'especes',
    }))

    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.replay).toBe(false)

    const rpc = mock.rpcCalls.find(c => c.fn === 'fn_create_vente_atomique')!.args as Record<string, unknown>
    expect(rpc.p_tenant_id).toBe(TID)
    expect(rpc.p_total_ttc).toBe(40000)
    expect(rpc.p_idempotency_key).toBe('k1')
    const lignesArg = rpc.p_lignes as Array<Record<string, unknown>>
    expect(lignesArg).toHaveLength(1)
    expect(lignesArg[0].produit_id).toBe('prod-1')
    expect(lignesArg[0].sous_total).toBe(40000)
    expect(rpc.p_cout_marchandises).toBe(25000) // qte(1) × prix_achat
  })

  it('idempotence : le RPC renvoie replay=true, aucun nouvel effet, 200', async () => {
    const { POST } = await import('../../app/api/sales/route')

    mock.queue('products', { data: [PRODUIT] })
    mock.queueRpc('fn_create_vente_atomique', { data: [{ vente_id: 'vente-1', replay: true }], error: null })
    mock.queue('ventes', { data: { id: 'vente-1', idempotency_key: 'k1', vente_lignes: [] } })

    const res = await POST(req({
      idempotency_key: 'k1',
      lignes: [{ produit_id: 'prod-1', qte: 1 }],
      mode_paiement: 'especes',
    }))

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.replay).toBe(true)
    expect(mock.rpcCalls.filter(c => c.fn === 'fn_create_vente_atomique').length).toBe(1) // un seul appel, pas de double tentative
  })

  it('échec du RPC (ex. stock insuffisant ou comptabilisation non aboutie) → 409, aucune lecture finale de ventes', async () => {
    const { POST } = await import('../../app/api/sales/route')

    mock.queue('products', { data: [PRODUIT] })
    mock.queueRpc('fn_create_vente_atomique', {
      data: null,
      error: { message: "Vente ... : comptabilisation VTE-001 non aboutie (statut=error)" },
    })

    const res = await POST(req({
      lignes: [{ produit_id: 'prod-1', qte: 5 }],
      mode_paiement: 'especes',
    }))

    expect(res.status).toBe(409)
    // Aucun appel séparé vers ventes/vente_lignes/fn_stock_move/emit_accounting_event
    // depuis TypeScript — toute la logique (et son éventuel rollback) vit
    // dans la fonction SQL, pas dans une compensation applicative ici.
    expect(mock.calls.some(c => c.table === 'ventes')).toBe(false)
    expect(mock.rpcCalls.some(c => c.fn === 'fn_stock_move')).toBe(false)
    expect(mock.rpcCalls.some(c => c.fn === 'emit_accounting_event')).toBe(false)
  })
})

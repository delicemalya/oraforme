// ── Outgoing Webhook Sender — HMAC-SHA256 signatures + retry logic ─────────

import { supabaseAdmin } from '@/lib/supabase-server'

export interface WebhookEndpoint {
  id: string
  tenant_id: string
  url: string
  secret: string
  events: string[]
  is_active: boolean
  headers: Record<string, string>
}

export interface WebhookDelivery {
  id: string
  endpoint_id: string
  tenant_id: string
  event: string
  payload: Record<string, unknown>
  status: 'pending' | 'delivered' | 'failed'
  attempts: number
  last_attempt_at: string | null
  next_retry_at: string | null
  response_status: number | null
  response_body: string | null
  error: string | null
}

// ── HMAC-SHA256 signature ─────────────────────────────────────────────────────

async function signPayload(secret: string, payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload))
  return 'sha256=' + Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('')
}

// ── Deliver a single webhook ──────────────────────────────────────────────────

export async function deliverWebhook(
  deliveryId: string,
): Promise<{ success: boolean; status?: number; error?: string }> {
  const { data: delivery } = await supabaseAdmin
    .from('webhook_deliveries')
    .select(`*, endpoint:webhook_endpoints(*)`)
    .eq('id', deliveryId)
    .single()

  if (!delivery) return { success: false, error: 'Delivery not found' }

  const endpoint = (delivery as { endpoint: WebhookEndpoint }).endpoint
  if (!endpoint?.is_active) {
    await supabaseAdmin
      .from('webhook_deliveries')
      .update({ status: 'failed', error: 'Endpoint inactive' })
      .eq('id', deliveryId)
    return { success: false, error: 'Endpoint inactive' }
  }

  const payload = JSON.stringify({
    id: deliveryId,
    event: delivery.event,
    created_at: new Date().toISOString(),
    data: delivery.payload,
  })

  const signature = endpoint.secret ? await signPayload(endpoint.secret, payload) : ''

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Oraforme-Event': delivery.event,
    'X-Oraforme-Delivery': deliveryId,
    'X-Oraforme-Signature': signature,
    ...(endpoint.headers ?? {}),
  }

  const attempts = (delivery.attempts ?? 0) + 1

  try {
    const res = await fetch(endpoint.url, {
      method: 'POST',
      headers,
      body: payload,
      signal: AbortSignal.timeout(10_000),
    })

    const responseBody = await res.text().catch(() => '')
    const success = res.status >= 200 && res.status < 300

    await supabaseAdmin
      .from('webhook_deliveries')
      .update({
        status: success ? 'delivered' : 'failed',
        attempts,
        last_attempt_at: new Date().toISOString(),
        next_retry_at: success ? null : computeNextRetry(attempts),
        response_status: res.status,
        response_body: responseBody.slice(0, 2000),
        error: success ? null : `HTTP ${res.status}`,
      })
      .eq('id', deliveryId)

    return { success, status: res.status }
  } catch (e) {
    const error = String(e)
    await supabaseAdmin
      .from('webhook_deliveries')
      .update({
        status: attempts >= MAX_ATTEMPTS ? 'failed' : 'pending',
        attempts,
        last_attempt_at: new Date().toISOString(),
        next_retry_at: attempts < MAX_ATTEMPTS ? computeNextRetry(attempts) : null,
        error,
      })
      .eq('id', deliveryId)

    return { success: false, error }
  }
}

const MAX_ATTEMPTS = 5

// Exponential backoff: 1min, 5min, 30min, 2h, 8h
function computeNextRetry(attempt: number): string {
  const delays = [60, 300, 1800, 7200, 28800]
  const delay = delays[Math.min(attempt - 1, delays.length - 1)] * 1000
  return new Date(Date.now() + delay).toISOString()
}

// ── Dispatch event to all matching endpoints ──────────────────────────────────

export async function dispatchWebhookEvent(
  tenantId: string,
  event: string,
  payload: Record<string, unknown>,
): Promise<void> {
  const { data: endpoints } = await supabaseAdmin
    .from('webhook_endpoints')
    .select('id, events')
    .eq('tenant_id', tenantId)
    .eq('is_active', true)

  if (!endpoints?.length) return

  const matching = endpoints.filter(ep => {
    const evts = ep.events as string[]
    return evts.includes(event) || evts.includes('*')
  })

  if (!matching.length) return

  // Create delivery records
  const rows = matching.map(ep => ({
    endpoint_id: ep.id,
    tenant_id: tenantId,
    event,
    payload,
    status: 'pending',
    attempts: 0,
    last_attempt_at: null,
    next_retry_at: new Date().toISOString(),
    response_status: null,
    response_body: null,
    error: null,
  }))

  const { data: deliveries } = await supabaseAdmin
    .from('webhook_deliveries')
    .insert(rows)
    .select('id')

  // Fire deliveries asynchronously
  for (const d of deliveries ?? []) {
    deliverWebhook(d.id).catch(() => {})
  }
}

// ── Process pending/retry deliveries (called by cron) ─────────────────────────

export async function processPendingWebhooks(): Promise<number> {
  const { data: deliveries } = await supabaseAdmin
    .from('webhook_deliveries')
    .select('id')
    .eq('status', 'pending')
    .lte('next_retry_at', new Date().toISOString())
    .lt('attempts', MAX_ATTEMPTS)
    .order('next_retry_at', { ascending: true })
    .limit(50)

  if (!deliveries?.length) return 0

  await Promise.allSettled(deliveries.map(d => deliverWebhook(d.id)))
  return deliveries.length
}

// ── Validate incoming webhook signature ──────────────────────────────────────

export async function verifyIncomingSignature(
  secret: string,
  payload: string,
  signature: string,
): Promise<boolean> {
  const expected = await signPayload(secret, payload)
  if (expected.length !== signature.length) return false
  // Constant-time comparison
  let diff = 0
  for (let i = 0; i < expected.length; i++) {
    diff |= expected.charCodeAt(i) ^ signature.charCodeAt(i)
  }
  return diff === 0
}

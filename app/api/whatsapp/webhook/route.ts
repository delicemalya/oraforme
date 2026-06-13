/**
 * GET  /api/whatsapp/webhook  — vérification webhook Meta (challenge)
 * POST /api/whatsapp/webhook  — réception des événements (messages entrants, statuts)
 *
 * Configuration Meta :
 *   Callback URL : https://votre-domaine.com/api/whatsapp/webhook
 *   Verify Token : valeur de webhook_secret dans whatsapp_config
 */

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabaseAdmin as any

// ── Challenge verification (Meta setup) ───────────────────────────────────────

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const mode      = searchParams.get('hub.mode')
  const token     = searchParams.get('hub.verify_token')
  const challenge = searchParams.get('hub.challenge')

  if (mode !== 'subscribe' || !token || !challenge) {
    return NextResponse.json({ error: 'Paramètres invalides' }, { status: 400 })
  }

  // Vérifie le webhook_secret contre tous les tenants actifs
  const supabase = db
  const { data } = await supabase
    .from('whatsapp_config')
    .select('id')
    .eq('webhook_secret', token)
    .eq('actif', true)
    .limit(1)

  if (!data || data.length === 0) {
    return NextResponse.json({ error: 'Token invalide' }, { status: 403 })
  }

  return new NextResponse(challenge, { status: 200 })
}

// ── Incoming events ────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'JSON invalide' }, { status: 400 })
  }

  const supabase = db

  try {
    const entry = (body.entry as Array<{
      changes?: Array<{
        value?: {
          messages?: Array<{ from: string; text?: { body: string }; id: string; timestamp: string }>
          statuses?: Array<{ id: string; status: string; recipient_id: string }>
          metadata?: { phone_number_id: string }
        }
      }>
    }>)?.[0]

    const changes = entry?.changes?.[0]?.value
    if (!changes) return NextResponse.json({ ok: true })

    const phoneNumberId = changes.metadata?.phone_number_id

    // Identifier le tenant via son phone_number_id
    let tenantId: string | null = null
    if (phoneNumberId) {
      const { data: cfgData } = await supabase
        .from('whatsapp_config')
        .select('tenant_id')
        .eq('phone_number_id', phoneNumberId)
        .eq('actif', true)
        .limit(1)
        .maybeSingle()
      tenantId = cfgData?.tenant_id ?? null
    }

    // Loguer les messages entrants
    if (changes.messages && tenantId) {
      for (const msg of changes.messages) {
        await supabase.from('whatsapp_logs').insert({
          tenant_id:    tenantId,
          to_phone:     msg.from,
          message_type: 'inbound',
          body:         msg.text?.body ?? '',
          status:       'received',
          whatsapp_id:  msg.id,
          context:      { timestamp: msg.timestamp, direction: 'inbound' },
        })
      }
    }

    // Mettre à jour les statuts (delivered, read, failed)
    if (changes.statuses && tenantId) {
      for (const stat of changes.statuses) {
        await supabase
          .from('whatsapp_logs')
          .update({ status: stat.status })
          .eq('tenant_id', tenantId)
          .eq('whatsapp_id', stat.id)
      }
    }
  } catch (err) {
    console.error('[WhatsApp Webhook] Error:', err)
  }

  // Meta exige toujours un 200
  return NextResponse.json({ ok: true })
}

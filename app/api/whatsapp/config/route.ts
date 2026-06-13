/**
 * GET  /api/whatsapp/config  — lecture config tenant (token masqué)
 * POST /api/whatsapp/config  — sauvegarde config tenant
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireTenant } from '@/lib/api/require-tenant'

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

function maskToken(token: string): string {
  if (!token || token.length < 8) return token
  return token.slice(0, 6) + '••••••••' + token.slice(-4)
}

export async function GET(req: NextRequest) {
  const tenantId = await requireTenant(req)
  if (!tenantId) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const supabase = adminClient()
  const { data, error } = await supabase
    .from('whatsapp_config')
    .select('phone_number_id,business_account_id,access_token,webhook_secret,from_phone,actif,updated_at')
    .eq('tenant_id', tenantId)
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ config: null })

  return NextResponse.json({
    config: {
      ...data,
      access_token:   maskToken(data.access_token ?? ''),
      webhook_secret: maskToken(data.webhook_secret ?? ''),
    },
  })
}

export async function POST(req: NextRequest) {
  const tenantId = await requireTenant(req)
  if (!tenantId) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const body = await req.json() as {
    phone_number_id?:     string
    business_account_id?: string
    access_token?:        string
    webhook_secret?:      string
    from_phone?:          string
    actif?:               boolean
  }

  const supabase = adminClient()

  const { data: existing } = await supabase
    .from('whatsapp_config')
    .select('id, access_token, webhook_secret')
    .eq('tenant_id', tenantId)
    .maybeSingle()

  const payload: Record<string, unknown> = {
    tenant_id:           tenantId,
    phone_number_id:     body.phone_number_id     ?? '',
    business_account_id: body.business_account_id ?? '',
    from_phone:          body.from_phone          ?? '',
    actif:               body.actif               ?? false,
  }

  // Ne pas écraser les tokens si l'utilisateur a envoyé des valeurs masquées
  if (body.access_token && !body.access_token.includes('••')) {
    payload.access_token = body.access_token
  } else if (existing?.access_token) {
    payload.access_token = existing.access_token
  } else {
    payload.access_token = ''
  }

  if (body.webhook_secret && !body.webhook_secret.includes('••')) {
    payload.webhook_secret = body.webhook_secret
  } else if (existing?.webhook_secret) {
    payload.webhook_secret = existing.webhook_secret
  } else {
    payload.webhook_secret = ''
  }

  let error
  if (existing) {
    ;({ error } = await supabase
      .from('whatsapp_config')
      .update(payload)
      .eq('tenant_id', tenantId))
  } else {
    ;({ error } = await supabase
      .from('whatsapp_config')
      .insert(payload))
  }

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

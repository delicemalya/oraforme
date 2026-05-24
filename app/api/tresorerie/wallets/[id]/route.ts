import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { tresoAuth } from '../../_auth'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await tresoAuth()
  if (!auth) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  const { id } = await params

  const { data, error } = await supabaseAdmin
    .from('mobile_money_wallets').select('*').eq('id', id).eq('tenant_id', auth.tenantId).maybeSingle()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data)  return NextResponse.json({ error: 'Introuvable' }, { status: 404 })
  return NextResponse.json({ data })
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await tresoAuth()
  if (!auth) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  const { id } = await params

  const { data: existing } = await supabaseAdmin
    .from('mobile_money_wallets').select('id').eq('id', id).eq('tenant_id', auth.tenantId).maybeSingle()
  if (!existing) return NextResponse.json({ error: 'Introuvable' }, { status: 404 })

  const body = await req.json()
  const { intitule, actif, numero } = body
  const updates: Record<string, unknown> = {}
  if (intitule !== undefined) updates.intitule = intitule
  if (actif    !== undefined) updates.actif    = actif
  if (numero   !== undefined) updates.numero   = numero

  const { data, error } = await supabaseAdmin
    .from('mobile_money_wallets').update(updates).eq('id', id).eq('tenant_id', auth.tenantId).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true, data })
}

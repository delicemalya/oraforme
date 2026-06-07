import { NextRequest, NextResponse } from 'next/server'
import { requireTenant } from '@/lib/tenant-guard'
import { supabaseAdmin } from '@/lib/supabase-admin'

type Ctx = { params: Promise<{ id: string }> }

export async function GET(req: NextRequest, { params }: Ctx) {
  const { ctx, error } = await requireTenant(req)
  if (error) return error
  const { id: clientId } = await params

  // Marquer les messages client comme lus
  await supabaseAdmin
    .from('cabinet_messages')
    .update({ lu: true, lu_at: new Date().toISOString() })
    .eq('client_id', clientId)
    .eq('cabinet_tenant_id', ctx.tenantId)
    .eq('expediteur', 'client')
    .eq('lu', false)

  const { data, error: dbErr } = await supabaseAdmin
    .from('cabinet_messages')
    .select('*')
    .eq('client_id', clientId)
    .eq('cabinet_tenant_id', ctx.tenantId)
    .order('created_at', { ascending: true })

  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

export async function POST(req: NextRequest, { params }: Ctx) {
  const { ctx, error } = await requireTenant(req)
  if (error) return error
  const { id: clientId } = await params
  const body = await req.json()

  const { data, error: dbErr } = await supabaseAdmin
    .from('cabinet_messages')
    .insert({
      cabinet_tenant_id: ctx.tenantId,
      client_id: clientId,
      expediteur: body.expediteur ?? 'cabinet',
      sujet: body.sujet ?? null,
      contenu: body.contenu,
      piece_jointe_url: body.piece_jointe_url ?? null,
    })
    .select('id')
    .single()

  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 })
  return NextResponse.json({ id: data.id }, { status: 201 })
}

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { tresoAuth } from '../../_auth'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await tresoAuth()
  if (!auth) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  const { id } = await params

  const { data, error } = await supabaseAdmin
    .from('cheques').select('*').eq('id', id).eq('tenant_id', auth.tenantId).maybeSingle()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data)  return NextResponse.json({ error: 'Introuvable' }, { status: 404 })
  return NextResponse.json({ data })
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await tresoAuth()
  if (!auth) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  const { id } = await params

  const { data: existing } = await supabaseAdmin
    .from('cheques').select('id, statut').eq('id', id).eq('tenant_id', auth.tenantId).maybeSingle()
  if (!existing) return NextResponse.json({ error: 'Introuvable' }, { status: 404 })

  const body = await req.json()
  const { statut, date_encaissement } = body

  const updates: Record<string, unknown> = {}
  if (statut) updates.statut = statut
  if (date_encaissement) updates.date_encaissement = date_encaissement
  if (statut === 'encaisse' && !date_encaissement) {
    updates.date_encaissement = new Date().toISOString().slice(0, 10)
  }

  const { data, error } = await supabaseAdmin
    .from('cheques').update(updates).eq('id', id).eq('tenant_id', auth.tenantId).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true, data })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await tresoAuth()
  if (!auth) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  const { id } = await params

  const { data: existing } = await supabaseAdmin
    .from('cheques').select('statut').eq('id', id).eq('tenant_id', auth.tenantId).maybeSingle()
  if (!existing) return NextResponse.json({ error: 'Introuvable' }, { status: 404 })
  if (existing.statut === 'encaisse') {
    return NextResponse.json({ error: 'Impossible de supprimer un chèque encaissé' }, { status: 400 })
  }

  const { error } = await supabaseAdmin
    .from('cheques').delete().eq('id', id).eq('tenant_id', auth.tenantId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}

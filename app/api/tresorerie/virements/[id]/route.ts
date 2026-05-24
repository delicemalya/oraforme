import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { tresoAuth } from '../../_auth'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await tresoAuth()
  if (!auth) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  const { id } = await params

  const { data, error } = await supabaseAdmin
    .from('virements').select('*').eq('id', id).eq('tenant_id', auth.tenantId).maybeSingle()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data)  return NextResponse.json({ error: 'Introuvable' }, { status: 404 })
  return NextResponse.json({ data })
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await tresoAuth()
  if (!auth) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  const { id } = await params

  // Verify ownership
  const { data: existing } = await supabaseAdmin
    .from('virements').select('id, statut').eq('id', id).eq('tenant_id', auth.tenantId).maybeSingle()
  if (!existing) return NextResponse.json({ error: 'Introuvable' }, { status: 404 })
  if (existing.statut === 'execute') {
    return NextResponse.json({ error: 'Virement déjà exécuté' }, { status: 400 })
  }

  const body = await req.json()
  const { statut, reference, date_virement } = body

  const updates: Record<string, unknown> = {}
  if (statut)         updates.statut         = statut
  if (reference)      updates.reference      = reference
  if (date_virement)  updates.date_virement  = date_virement
  if (statut === 'execute') updates.date_execution = new Date().toISOString()

  const { data, error } = await supabaseAdmin
    .from('virements').update(updates).eq('id', id).eq('tenant_id', auth.tenantId).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true, data })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await tresoAuth()
  if (!auth) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  const { id } = await params

  const { data: existing } = await supabaseAdmin
    .from('virements').select('statut').eq('id', id).eq('tenant_id', auth.tenantId).maybeSingle()
  if (!existing) return NextResponse.json({ error: 'Introuvable' }, { status: 404 })
  if (existing.statut === 'execute') {
    return NextResponse.json({ error: 'Impossible de supprimer un virement exécuté' }, { status: 400 })
  }

  const { error } = await supabaseAdmin
    .from('virements').delete().eq('id', id).eq('tenant_id', auth.tenantId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}

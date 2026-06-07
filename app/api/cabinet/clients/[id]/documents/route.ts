import { NextRequest, NextResponse } from 'next/server'
import { requireTenant } from '@/lib/tenant-guard'
import { supabaseAdmin } from '@/lib/supabase-admin'

type Ctx = { params: Promise<{ id: string }> }

export async function GET(req: NextRequest, { params }: Ctx) {
  const { ctx, error } = await requireTenant(req)
  if (error) return error
  const { id: clientId } = await params

  const { data, error: dbErr } = await supabaseAdmin
    .from('cabinet_documents')
    .select('*')
    .eq('client_id', clientId)
    .eq('cabinet_tenant_id', ctx.tenantId)
    .order('created_at', { ascending: false })

  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

export async function POST(req: NextRequest, { params }: Ctx) {
  const { ctx, error } = await requireTenant(req)
  if (error) return error
  const { id: clientId } = await params
  const body = await req.json()

  const { data, error: dbErr } = await supabaseAdmin
    .from('cabinet_documents')
    .insert({
      cabinet_tenant_id: ctx.tenantId,
      client_id: clientId,
      nom: body.nom,
      type_document: body.type_document ?? 'autre',
      description: body.description ?? null,
      fichier_url: body.fichier_url ?? null,
      mois: body.mois ?? null,
      annee: body.annee ?? null,
      statut: body.statut ?? 'brouillon',
      commentaire_cabinet: body.commentaire_cabinet ?? null,
    })
    .select('id')
    .single()

  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 })
  return NextResponse.json({ id: data.id }, { status: 201 })
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const { ctx, error } = await requireTenant(req)
  if (error) return error
  const { id: clientId } = await params
  const { docId, statut, commentaire_cabinet } = await req.json()

  const { error: dbErr } = await supabaseAdmin
    .from('cabinet_documents')
    .update({ statut, commentaire_cabinet })
    .eq('id', docId)
    .eq('client_id', clientId)
    .eq('cabinet_tenant_id', ctx.tenantId)

  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

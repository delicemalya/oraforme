import { NextRequest, NextResponse } from 'next/server'
import { requireTenant } from '@/lib/tenant-guard'
import { supabaseAdmin } from '@/lib/supabase-admin'

type Ctx = { params: Promise<{ id: string }> }

export async function GET(req: NextRequest, { params }: Ctx) {
  const { ctx, error } = await requireTenant(req)
  if (error) return error
  const { id: clientId } = await params

  const { data, error: dbErr } = await supabaseAdmin
    .from('cabinet_factures_honoraires')
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

  // Récupérer frais_oraforme du client
  const { data: client } = await supabaseAdmin
    .from('cabinet_clients')
    .select('frais_oraforme')
    .eq('id', clientId)
    .eq('cabinet_tenant_id', ctx.tenantId)
    .maybeSingle()

  const frais = client?.frais_oraforme ?? 5000
  const lignes: { description: string; montant: number }[] = body.lignes ?? []
  const ht  = lignes.reduce((s, l) => s + Number(l.montant), 0) + frais
  const tva = Math.round(ht * 0.18)
  const ca  = Math.round(tva * 0.05)
  const ttc = ht + tva + ca

  const now = new Date()
  const num = `HON-${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}-${String(Math.floor(Math.random()*9000)+1000)}`
  const echeance = new Date(now.getFullYear(), now.getMonth()+1, 15).toISOString().split('T')[0]

  const { data, error: dbErr } = await supabaseAdmin
    .from('cabinet_factures_honoraires')
    .insert({
      cabinet_tenant_id: ctx.tenantId,
      client_id: clientId,
      numero: num,
      date_facture: now.toISOString().split('T')[0],
      date_echeance: echeance,
      periode_debut: body.periode_debut ?? null,
      periode_fin: body.periode_fin ?? null,
      lignes, montant_ht: ht, tva, ca_additionnel: ca, montant_ttc: ttc,
      statut: 'brouillon',
      frais_oraforme_inclus: true,
      frais_oraforme_montant: frais,
      notes: body.notes ?? null,
    })
    .select('id, numero')
    .single()

  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 })
  return NextResponse.json({ id: data.id, numero: data.numero }, { status: 201 })
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const { ctx, error } = await requireTenant(req)
  if (error) return error
  const { id: clientId } = await params
  const { factureId, statut } = await req.json()

  const { error: dbErr } = await supabaseAdmin
    .from('cabinet_factures_honoraires')
    .update({ statut })
    .eq('id', factureId)
    .eq('client_id', clientId)
    .eq('cabinet_tenant_id', ctx.tenantId)

  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

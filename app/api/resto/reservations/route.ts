import { NextRequest, NextResponse } from 'next/server'
import { requireTenant } from '@/lib/tenant-guard'
import { supabaseAdmin } from '@/lib/supabase-server'

// GET /api/resto/reservations?date=YYYY-MM-DD&statut=
export async function GET(req: NextRequest) {
  const { ctx, error } = await requireTenant()
  if (error) return error

  const url    = new URL(req.url)
  const date   = url.searchParams.get('date') ?? new Date().toISOString().split('T')[0]
  const statut = url.searchParams.get('statut')

  let q = supabaseAdmin
    .from('resto_reservations')
    .select('*, resto_tables(numero, nom, capacite)')
    .eq('tenant_id', ctx.tenantId)
    .eq('date_resa', date)
    .order('heure_resa', { ascending: true })

  if (statut) q = q.eq('statut', statut)

  const { data, error: err } = await q
  if (err) return NextResponse.json({ error: err.message }, { status: 500 })

  return NextResponse.json({ reservations: data ?? [] })
}

// POST /api/resto/reservations
export async function POST(req: NextRequest) {
  const { ctx, error } = await requireTenant()
  if (error) return error

  const body = await req.json()
  const { date_resa, heure_resa, nb_personnes, client_nom, client_tel, client_email, table_id, notes, origine } = body

  if (!date_resa || !heure_resa || !client_nom)
    return NextResponse.json({ error: 'date_resa, heure_resa, client_nom requis' }, { status: 400 })

  const { data, error: err } = await supabaseAdmin
    .from('resto_reservations')
    .insert({
      tenant_id: ctx.tenantId,
      date_resa, heure_resa,
      nb_personnes: nb_personnes ?? 2,
      client_nom, client_tel: client_tel ?? null,
      client_email: client_email ?? null,
      table_id: table_id ?? null,
      notes: notes ?? null,
      origine: origine ?? 'telephone',
      statut: 'confirmee',
    })
    .select('*')
    .single()

  if (err) return NextResponse.json({ error: err.message }, { status: 500 })
  return NextResponse.json({ reservation: data }, { status: 201 })
}

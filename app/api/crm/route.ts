import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { requireTenant } from '@/lib/tenant-guard'

export const dynamic = 'force-dynamic'

/**
 * GET /api/crm — liste clients + scores + stats pipeline
 * POST /api/crm — créer client/prospect + scoring initial
 */
export async function GET(req: NextRequest) {
  const { ctx, error } = await requireTenant()
  if (error) return error

  const { searchParams } = new URL(req.url)
  const statut = searchParams.get('statut')
  const search = searchParams.get('q')
  const page   = Math.max(0, parseInt(searchParams.get('page') ?? '0'))
  const limit  = Math.min(200, parseInt(searchParams.get('limit') ?? '100'))

  let q = supabaseAdmin
    .from('clients')
    .select('*', { count: 'exact' })
    .eq('tenant_id', ctx.tenantId)
    .order('created_at', { ascending: false })
    .range(page * limit, (page + 1) * limit - 1)

  if (statut) q = q.eq('statut', statut)
  if (search)  q = q.or(`nom.ilike.%${search}%,entreprise.ilike.%${search}%,email.ilike.%${search}%`)

  const { data, error: dbErr, count } = await q
  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 })

  // KPIs pipeline
  const { data: opps } = await supabaseAdmin
    .from('crm_opportunites')
    .select('etape, montant_estime, probabilite')
    .eq('tenant_id', ctx.tenantId)

  const pipeline = (opps ?? []).reduce((acc, o) => {
    if (!acc[o.etape]) acc[o.etape] = { count: 0, montant: 0, pondere: 0 }
    acc[o.etape].count++
    acc[o.etape].montant += o.montant_estime ?? 0
    acc[o.etape].pondere += (o.montant_estime ?? 0) * (o.probabilite ?? 20) / 100
    return acc
  }, {} as Record<string, { count: number; montant: number; pondere: number }>)

  return NextResponse.json({
    data: data ?? [],
    total: count ?? 0,
    page,
    limit,
    pipeline,
  })
}

export async function POST(req: NextRequest) {
  const { ctx, error } = await requireTenant()
  if (error) return error

  const body = await req.json()
  const {
    nom, email, telephone, entreprise, secteur, ville,
    pays, nif, rccm, notes, statut = 'actif', tags,
  } = body

  if (!nom?.trim()) {
    return NextResponse.json({ error: 'Le nom du client est requis' }, { status: 400 })
  }

  const { data: client, error: insErr } = await supabaseAdmin
    .from('clients')
    .insert({
      tenant_id:  ctx.tenantId,
      nom:        nom.trim(),
      email:      email?.trim() || null,
      telephone:  telephone?.trim() || null,
      entreprise: entreprise?.trim() || null,
      secteur:    secteur?.trim() || null,
      ville:      ville?.trim() || null,
      pays:       pays?.trim() || 'Congo-Brazzaville',
      nif:        nif?.trim() || null,
      rccm:       rccm?.trim() || null,
      notes:      notes?.trim() || null,
      statut,
      type:       statut === 'prospect' ? 'prospect' : 'client',
      tags:       tags || null,
      score_risque: 50,
      ca_total:    0,
      impaye_total: 0,
      nb_factures: 0,
      nb_impayes:  0,
    })
    .select('id, nom, statut')
    .single()

  if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 })

  // Écrire une activité CRM si c'est un prospect
  if (statut === 'prospect') {
    await supabaseAdmin.from('crm_activites').insert({
      tenant_id:    ctx.tenantId,
      client_id:    client.id,
      type:         'note',
      titre:        `Prospect créé: ${nom.trim()}`,
      date_activite: new Date().toISOString(),
      fait:          true,
    })
  }

  return NextResponse.json({ id: client.id, nom: client.nom }, { status: 201 })
}

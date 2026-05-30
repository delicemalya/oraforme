import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { requireTenant } from '@/lib/tenant-guard'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const { ctx, error } = await requireTenant()
  if (error) return error

  const { searchParams } = new URL(req.url)
  const membre_id = searchParams.get('membre_id')
  const from      = searchParams.get('from')
  const to        = searchParams.get('to')

  let query = supabaseAdmin
    .from('banque_operations')
    .select('*, banque_membres(nom, prenom, numero_compte)', { count: 'exact' })
    .eq('tenant_id', ctx.tenantId)
    .order('date_operation', { ascending: false })
    .limit(200)

  if (membre_id) query = query.eq('membre_id', membre_id)
  if (from)      query = query.gte('date_operation', from)
  if (to)        query = query.lte('date_operation', to)

  const { data, error: dbErr, count } = await query
  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 })
  return NextResponse.json({ data: data ?? [], total: count ?? 0 })
}

export async function POST(req: NextRequest) {
  const { ctx, error } = await requireTenant()
  if (error) return error

  const body = await req.json()
  const { membre_id, type_operation, montant, description, reference, credit_id } = body

  if (!membre_id)      return NextResponse.json({ error: 'membre_id requis' }, { status: 400 })
  if (!type_operation) return NextResponse.json({ error: 'type_operation requis' }, { status: 400 })
  if (!montant || montant <= 0) return NextResponse.json({ error: 'Montant invalide' }, { status: 400 })

  const { data: membre } = await supabaseAdmin
    .from('banque_membres')
    .select('id, solde')
    .eq('id', membre_id)
    .eq('tenant_id', ctx.tenantId)
    .maybeSingle()

  if (!membre) return NextResponse.json({ error: 'Membre introuvable' }, { status: 404 })

  const solde_avant = membre.solde
  const delta       = ['depot','remboursement'].includes(type_operation) ? montant : -montant
  const solde_apres = solde_avant + delta

  if (['retrait','virement'].includes(type_operation) && solde_apres < 0)
    return NextResponse.json({ error: 'Solde insuffisant' }, { status: 400 })

  const [{ data: op }] = await Promise.all([
    supabaseAdmin.from('banque_operations').insert({
      tenant_id:      ctx.tenantId,
      membre_id,
      type_operation,
      montant,
      solde_avant,
      solde_apres,
      description: description || null,
      reference:   reference   || null,
      credit_id:   credit_id   || null,
    }).select('id').single(),
    supabaseAdmin.from('banque_membres').update({ solde: solde_apres }).eq('id', membre_id),
  ])

  return NextResponse.json({ id: op?.id, solde_apres }, { status: 201 })
}

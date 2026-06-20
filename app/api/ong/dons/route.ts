import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { requireTenant } from '@/lib/tenant-guard'

export const dynamic = 'force-dynamic'

export async function GET() {
  const { ctx, error } = await requireTenant()
  if (error) return error

  const { data, error: dbErr, count } = await supabaseAdmin
    .from('ong_dons')
    .select('*, ong_programmes(nom)', { count: 'exact' })
    .eq('tenant_id', ctx.tenantId)
    .order('date_reception', { ascending: false })
    .limit(200)

  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 })
  return NextResponse.json({ data: data ?? [], total: count ?? 0 })
}

export async function POST(req: NextRequest) {
  const { ctx, error } = await requireTenant()
  if (error) return error

  const body = await req.json()
  const { donateur, type_don = 'ponctuel', montant, date_reception, mode_paiement = 'virement', programme_id, notes } = body

  if (!donateur?.trim()) return NextResponse.json({ error: 'Donateur requis' }, { status: 400 })
  if (!montant || montant <= 0) return NextResponse.json({ error: 'Montant invalide' }, { status: 400 })

  const { data, error: insErr } = await supabaseAdmin
    .from('ong_dons')
    .insert({
      tenant_id:      ctx.tenantId,
      donateur:       donateur.trim(),
      type_don,
      montant,
      date_reception: date_reception || new Date().toISOString().split('T')[0],
      mode_paiement,
      programme_id:   programme_id   || null,
      notes:          notes          || null,
      recu_emis:      false,
    })
    .select('id')
    .single()

  if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 })

  // Écriture trésorerie automatique
  await supabaseAdmin.from('transactions').insert({
    tenant_id:     ctx.tenantId,
    type:          'entree',
    categorie:     'Don / Subvention',
    description:   `Don — ${donateur.trim()}`,
    montant,
    date:          date_reception || new Date().toISOString().split('T')[0],
    mode_paiement,
    source:        'ong',
    source_id:     data.id,
  })

  return NextResponse.json({ id: data.id }, { status: 201 })
}

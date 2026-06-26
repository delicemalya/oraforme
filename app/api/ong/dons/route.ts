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

  // Emit ONG-001 (fire-and-forget — P-003)
  // Dons: TVA=0 (dons non soumis à TVA en droit CEMAC). montant_ht = montant_ttc.
  const montantNum = Number(montant)

  await supabaseAdmin.rpc('emit_accounting_event', {
    p_tenant_id:     ctx.tenantId,
    p_event_type:    'ONG-001',
    p_source_module: 'ong',
    p_source_table:  'ong_dons',
    p_source_id:     data.id,
    p_montant_ht:    montantNum,
    p_montant_tva:   0,
    p_montant_ttc:   montantNum,
    p_libelle:       `Don — ${donateur.trim()}`,
    p_date_event:    date_reception || new Date().toISOString().split('T')[0],
    p_fiscal_year:   new Date().getFullYear(),
    p_metadata:      {
      mode_paiement: mode_paiement,
      donateur:      donateur.trim(),
      programme_id:  programme_id || null,
    },
  })

  return NextResponse.json({ id: data.id }, { status: 201 })
}

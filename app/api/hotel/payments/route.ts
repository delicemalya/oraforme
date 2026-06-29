import { NextRequest, NextResponse } from 'next/server'
import { requireTenant } from '@/lib/tenant-guard'
import { supabaseAdmin } from '@/lib/supabase-server'
import { aggregatePaymentsByMode } from '@/lib/erp-core/compute/payments'

export async function GET(req: NextRequest) {
  const { ctx, error } = await requireTenant()
  if (error) return error

  const url = new URL(req.url)
  const date = url.searchParams.get('date') ?? new Date().toISOString().split('T')[0]

  const { data, error: dbErr } = await supabaseAdmin
    .from('htl_payments')
    .select('*, htl_invoices(numero)')
    .eq('hotel_id', ctx.tenantId)
    .gte('created_at', date + 'T00:00:00')
    .lte('created_at', date + 'T23:59:59')
    .order('created_at', { ascending: false })

  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 })

  const rows = data ?? []
  const agg  = aggregatePaymentsByMode(rows)

  return NextResponse.json({ payments: rows, stats: {
    total_especes:  agg.especes,
    total_mobile:   agg.mobile_money,
    total_carte:    agg.carte,
    total_virement: agg.virement,
    total_jour:     agg.total,
    breakdown:      agg.breakdown,
  } })
}

export async function POST(req: NextRequest) {
  const { ctx, error } = await requireTenant()
  if (error) return error

  const { invoice_id, reservation_id, montant, mode_paiement, reference, notes } = await req.json()
  if (!montant || montant <= 0) return NextResponse.json({ error: 'montant invalide' }, { status: 400 })

  const { data, error: dbErr } = await supabaseAdmin
    .from('htl_payments')
    .insert({
      hotel_id: ctx.tenantId,
      invoice_id: invoice_id ?? null,
      reservation_id: reservation_id ?? null,
      montant: Number(montant),
      mode_paiement: mode_paiement ?? 'especes',
      reference: reference ?? null,
      notes: notes ?? null,
    })
    .select('id')
    .single()

  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 })

  // Marquer la facture comme payée si invoice_id
  if (invoice_id) {
    const { data: inv } = await supabaseAdmin
      .from('htl_invoices').select('montant_ttc').eq('id', invoice_id).maybeSingle()
    const { data: paidSum } = await supabaseAdmin
      .from('htl_payments').select('montant').eq('hotel_id', ctx.tenantId).eq('invoice_id', invoice_id)
    const totalPaid = (paidSum ?? []).reduce((s: number, p: { montant: number }) => s + p.montant, 0)
    if (inv && totalPaid >= inv.montant_ttc) {
      await supabaseAdmin.from('htl_invoices').update({ statut: 'payee' }).eq('id', invoice_id)
    }
  }

  // Emit HOT-001 (fire-and-forget — P-003)
  // Congo: TTC = HT × 1.189 (TVA 18% + CA 5%/TVA). montant collecté = TTC.
  const montantTTC = Number(montant)
  const montantHT  = Math.round(montantTTC / 1.189)
  const montantTVA = montantTTC - montantHT

  await supabaseAdmin.rpc('emit_accounting_event', {
    p_tenant_id:     ctx.tenantId,
    p_event_type:    'HOT-001',
    p_source_module: 'hotel',
    p_source_table:  'htl_payments',
    p_source_id:     data.id,
    p_montant_ht:    montantHT,
    p_montant_tva:   montantTVA,
    p_montant_ttc:   montantTTC,
    p_libelle:       `Encaissement ${mode_paiement ?? 'especes'} — Hôtel`,
    p_date_event:    new Date().toISOString().split('T')[0],
    p_fiscal_year:   new Date().getFullYear(),
    p_metadata:      {
      mode_paiement:  mode_paiement ?? 'especes',
      invoice_id:     invoice_id  ?? null,
      reservation_id: reservation_id ?? null,
    },
  })

  return NextResponse.json({ id: data.id }, { status: 201 })
}

import { NextRequest, NextResponse } from 'next/server'
import { requireTenant } from '@/lib/tenant-guard'
import { supabaseAdmin } from '@/lib/supabase-server'

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
  const total_especes      = rows.filter(p => p.mode_paiement === 'especes').reduce((s, p) => s + p.montant, 0)
  const total_mobile       = rows.filter(p => p.mode_paiement === 'mobile_money').reduce((s, p) => s + p.montant, 0)
  const total_carte        = rows.filter(p => p.mode_paiement === 'carte').reduce((s, p) => s + p.montant, 0)
  const total_virement     = rows.filter(p => p.mode_paiement === 'virement').reduce((s, p) => s + p.montant, 0)
  const total_jour         = rows.reduce((s, p) => s + p.montant, 0)

  return NextResponse.json({ payments: rows, stats: { total_especes, total_mobile, total_carte, total_virement, total_jour } })
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

  // Écriture comptable automatique SYSCOHADA (compte 512 Banque / 7011 Chambre)
  const libelle = `Encaissement ${mode_paiement ?? 'especes'} — Hôtel`
  const { data: entry } = await supabaseAdmin
    .from('htl_journal_entries')
    .insert({
      hotel_id: ctx.tenantId,
      numero_piece: `ENC-${Date.now()}`,
      libelle, source: 'encaissement', source_id: data.id,
      total_debit: Number(montant), total_credit: Number(montant),
    })
    .select('id').single()

  if (entry) {
    await supabaseAdmin.from('htl_journal_lines').insert([
      { hotel_id: ctx.tenantId, entry_id: entry.id, compte_pcg: mode_paiement === 'virement' || mode_paiement === 'carte' ? '512' : '571', libelle, debit: Number(montant), credit: 0 },
      { hotel_id: ctx.tenantId, entry_id: entry.id, compte_pcg: '7011', libelle: 'Produit hébergement', debit: 0, credit: Number(montant) },
    ])
  }

  return NextResponse.json({ id: data.id }, { status: 201 })
}

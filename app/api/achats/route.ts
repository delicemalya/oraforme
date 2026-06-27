import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { requireTenant } from '@/lib/tenant-guard'

export const dynamic = 'force-dynamic'

// ── POST /api/achats ─────────────────────────────────────────────────────────
// Crée un achat fournisseur + émet ACH-001 (601/401 HT SYSCOHADA)
export async function POST(req: NextRequest) {
  const { ctx, error } = await requireTenant()
  if (error) return error

  const body = await req.json()
  const { fournisseur_id, description, montant, date, cost_center_id } = body

  if (!description?.trim())  return NextResponse.json({ error: 'Description requise' }, { status: 400 })
  if (!montant || montant <= 0) return NextResponse.json({ error: 'Montant invalide' }, { status: 400 })

  const { data, error: insErr } = await supabaseAdmin
    .from('achats')
    .insert({
      tenant_id:      ctx.tenantId,
      fournisseur_id: fournisseur_id || null,
      description:    description.trim(),
      montant:        Number(montant),
      statut:         'impaye',
      date:           date || new Date().toISOString().split('T')[0],
      cost_center_id: cost_center_id || null,
    })
    .select('id')
    .single()

  if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 })

  const montantNum = Number(montant)
  const dateEvent  = date || new Date().toISOString().split('T')[0]

  // Emit ACH-001 — Facture fournisseur (601 Débit / 401 Crédit) — fire-and-forget P-003
  await supabaseAdmin.rpc('emit_accounting_event', {
    p_tenant_id:     ctx.tenantId,
    p_event_type:    'ACH-001',
    p_source_module: 'achats',
    p_source_table:  'achats',
    p_source_id:     data.id,
    p_montant_ht:    montantNum,
    p_montant_tva:   0,
    p_montant_ttc:   montantNum,
    p_libelle:       `Achat fournisseur — ${description.trim()}`,
    p_date_event:    dateEvent,
    p_fiscal_year:   new Date(dateEvent).getFullYear(),
    p_metadata:      {
      fournisseur_id: fournisseur_id || null,
      cost_center_id: cost_center_id || null,
    },
  })

  return NextResponse.json({ id: data.id }, { status: 201 })
}

// ── PATCH /api/achats ────────────────────────────────────────────────────────
// Marque un achat comme payé + émet ACH-002 (401 Débit / 521 Crédit treasury)
export async function PATCH(req: NextRequest) {
  const { ctx, error } = await requireTenant()
  if (error) return error

  const body = await req.json()
  const { id, mode_paiement = 'especes' } = body

  if (!id) return NextResponse.json({ error: 'id requis' }, { status: 400 })

  const { data: achat, error: fetchErr } = await supabaseAdmin
    .from('achats')
    .select('id, description, montant, fournisseur_id, statut')
    .eq('id', id)
    .eq('tenant_id', ctx.tenantId)
    .single()

  if (fetchErr || !achat) return NextResponse.json({ error: 'Achat introuvable' }, { status: 404 })
  if (achat.statut === 'paye') return NextResponse.json({ error: 'Déjà payé' }, { status: 409 })

  const datePayment = new Date().toISOString().split('T')[0]

  const { error: updErr } = await supabaseAdmin
    .from('achats')
    .update({ statut: 'paye', date_paiement: datePayment })
    .eq('id', id)
    .eq('tenant_id', ctx.tenantId)

  if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 })

  const montantNum = Number(achat.montant)

  // Emit ACH-002 — Règlement fournisseur (401 Débit / treasury_credit) — fire-and-forget P-003
  await supabaseAdmin.rpc('emit_accounting_event', {
    p_tenant_id:     ctx.tenantId,
    p_event_type:    'ACH-002',
    p_source_module: 'achats',
    p_source_table:  'achats',
    p_source_id:     achat.id,
    p_montant_ht:    montantNum,
    p_montant_tva:   0,
    p_montant_ttc:   montantNum,
    p_libelle:       `Règlement fournisseur — ${achat.description}`,
    p_date_event:    datePayment,
    p_fiscal_year:   new Date().getFullYear(),
    p_metadata:      {
      mode_paiement:  mode_paiement,
      fournisseur_id: achat.fournisseur_id || null,
    },
  })

  return NextResponse.json({ success: true })
}

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { requireTenant } from '@/lib/tenant-guard'

export const dynamic = 'force-dynamic'

// GET /api/factures/[id]
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { ctx, error } = await requireTenant()
  if (error) return error

  const { id } = await params

  const { data: facture, error: facErr } = await supabaseAdmin
    .from('factures')
    .select('*')
    .eq('id', id)
    .eq('tenant_id', ctx.tenantId)
    .maybeSingle()

  if (facErr) return NextResponse.json({ error: facErr.message }, { status: 500 })
  if (!facture) return NextResponse.json({ error: 'Facture introuvable' }, { status: 404 })

  const { data: lignes } = await supabaseAdmin
    .from('facture_lignes')
    .select('*')
    .eq('invoice_id', id)
    .order('id')

  return NextResponse.json({ facture, lignes: lignes ?? [] })
}

// PATCH /api/factures/[id] — mettre à jour statut ou marquer payée
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { ctx, error } = await requireTenant()
  if (error) return error

  const { id } = await params
  const body   = await req.json()

  // Vérifier que la facture appartient au tenant
  const { data: existing } = await supabaseAdmin
    .from('factures')
    .select('id, tenant_id, statut, subtotal, montant_ht, total, invoice_number, client_name, client_nom')
    .eq('id', id)
    .eq('tenant_id', ctx.tenantId)
    .maybeSingle()

  if (!existing) return NextResponse.json({ error: 'Facture introuvable' }, { status: 404 })

  const { statut, montant_paye, mode_paiement, reference, ...rest } = body
  const updatePayload: Record<string, unknown> = { ...rest }
  if (statut) updatePayload.statut = statut

  const { error: updErr } = await supabaseAdmin
    .from('factures')
    .update(updatePayload)
    .eq('id', id)
    .eq('tenant_id', ctx.tenantId)

  if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 })

  // Si la facture passe à "payée" → enregistrer le paiement dans paiements_factures
  // Les écritures OHADA (521/411) et transaction trésorerie sont gérées exclusivement
  // par fn_facture_paid_to_journal (migration 046) via AFTER UPDATE OF statut
  if (statut === 'payee' && existing.statut !== 'payee') {
    const today = new Date().toISOString().split('T')[0]

    if (montant_paye) {
      await supabaseAdmin.from('paiements_factures').insert({
        tenant_id:     ctx.tenantId,
        facture_id:    id,
        montant:       montant_paye,
        mode_paiement: mode_paiement ?? 'especes',
        date:          today,
        reference:     reference ?? null,
      })
    }
  }

  return NextResponse.json({ ok: true })
}

// DELETE /api/factures/[id]
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { ctx, error } = await requireTenant()
  if (error) return error

  const { id } = await params

  const { error: delErr } = await supabaseAdmin
    .from('factures')
    .delete()
    .eq('id', id)
    .eq('tenant_id', ctx.tenantId)

  if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

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
    .select('id, tenant_id, statut, subtotal, montant_ht, tva_montant, ca, total, invoice_number, client_name, client_nom')
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

  const today    = new Date().toISOString().split('T')[0]
  const fiscYear = new Date(today).getFullYear()
  const pieceNum = existing.invoice_number ?? `FAC-${id.slice(0, 8).toUpperCase()}`
  const clientNom = existing.client_name ?? existing.client_nom ?? ''

  // FAC-001 — Facture envoyée : émission comptable via moteur central (migration 139)
  // Remplace le trigger trg_facture_issued supprimé dans migration 139.
  if (statut === 'envoyee' && existing.statut !== 'envoyee') {
    const ht  = Number(existing.montant_ht ?? existing.subtotal ?? 0)
    const tva = Number(existing.tva_montant ?? 0)
    const ca  = Number(existing.ca ?? 0)
    const ttc = Number(existing.total ?? ht + tva + ca)

    await supabaseAdmin.rpc('emit_accounting_event', {
      p_tenant_id:     ctx.tenantId,
      p_event_type:    'FAC-001',
      p_source_module: 'facturation',
      p_source_table:  'factures',
      p_source_id:     id,
      p_montant_ht:    ht,
      p_montant_tva:   tva,
      p_montant_ttc:   ttc,
      p_libelle:       `Facture ${pieceNum} — ${clientNom}`,
      p_date_event:    today,
      p_fiscal_year:   fiscYear,
      p_metadata:      { piece_number: pieceNum, client_name: clientNom, ca, country_code: 'CG' },
    })
  }

  // FAC-002 — Facture payée : règlement via moteur central (migration 139)
  // Remplace le trigger trg_facture_paid supprimé dans migration 139.
  if (statut === 'payee' && existing.statut !== 'payee') {
    const ttc        = Number(existing.total ?? 0)
    const modePaie   = mode_paiement ?? 'virement'

    // Enregistrer le paiement
    if (montant_paye) {
      await supabaseAdmin.from('paiements_factures').insert({
        tenant_id:     ctx.tenantId,
        facture_id:    id,
        montant:       montant_paye,
        mode_paiement: modePaie,
        date:          today,
        reference:     reference ?? null,
      })
    }

    // Écriture comptable : Trésorerie (521/571x) / Clients (411)
    await supabaseAdmin.rpc('emit_accounting_event', {
      p_tenant_id:     ctx.tenantId,
      p_event_type:    'FAC-002',
      p_source_module: 'facturation',
      p_source_table:  'factures',
      p_source_id:     id,
      p_montant_ht:    0,
      p_montant_tva:   0,
      p_montant_ttc:   ttc,
      p_libelle:       `Reglement facture ${pieceNum} — ${clientNom}`,
      p_date_event:    today,
      p_fiscal_year:   fiscYear,
      p_metadata:      { piece_number: pieceNum, client_name: clientNom, mode_paiement: modePaie, country_code: 'CG' },
    })
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

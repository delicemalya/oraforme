import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { requireTenant } from '@/lib/tenant-guard'
import { calculerTVACongo } from '@/lib/fiscalite-congo'
import { createWhatsappService } from '@/lib/whatsapp-business'

export const dynamic = 'force-dynamic'

// GET /api/factures — liste des factures du tenant
export async function GET(req: NextRequest) {
  const { ctx, error } = await requireTenant()
  if (error) return error

  const { searchParams } = new URL(req.url)
  const statut   = searchParams.get('statut')
  const page     = Math.max(0, parseInt(searchParams.get('page') ?? '0'))
  const limit    = Math.min(200, parseInt(searchParams.get('limit') ?? '100'))

  let query = supabaseAdmin
    .from('factures')
    .select('*', { count: 'exact' })
    .eq('tenant_id', ctx.tenantId)
    .order('created_at', { ascending: false })
    .range(page * limit, (page + 1) * limit - 1)

  if (statut) query = query.eq('statut', statut)

  const { data, error: dbErr, count } = await query
  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 })

  return NextResponse.json({ data: data ?? [], total: count ?? 0, page, limit })
}

// POST /api/factures — créer une facture + émission d'événement comptable via moteur central
export async function POST(req: NextRequest) {
  const { ctx, error } = await requireTenant()
  if (error) return error

  const body = await req.json()
  const {
    invoice_number, client_name, client_address, client_phone, client_email,
    date, due_date, notes, statut = 'brouillon', lignes = [], type = 'facture',
  } = body

  if (!client_name?.trim()) {
    return NextResponse.json({ error: 'Nom du client requis' }, { status: 400 })
  }
  if (!lignes.length) {
    return NextResponse.json({ error: 'Au moins une ligne requise' }, { status: 400 })
  }

  const ht = lignes.reduce(
    (s: number, l: { price: number; quantity: number }) => s + l.price * l.quantity, 0
  )
  const { tva, ca, ttc } = calculerTVACongo(ht)

  // Créer la facture
  const { data: facture, error: facErr } = await supabaseAdmin
    .from('factures')
    .insert({
      tenant_id:      ctx.tenantId,
      invoice_number,
      client_name,
      client_nom:     client_name,
      client_address: client_address || null,
      client_phone:   client_phone   || null,
      client_email:   client_email   || null,
      date:           date ?? new Date().toISOString().split('T')[0],
      due_date:       due_date       || null,
      subtotal:       ht,
      montant_ht:     ht,
      tva,
      tva_montant:    tva,
      ca,
      total:          ttc,
      notes:          notes          || null,
      statut,
      type,
    })
    .select('id')
    .single()

  if (facErr) return NextResponse.json({ error: facErr.message }, { status: 500 })

  // Insérer les lignes
  if (facture?.id && lignes.length) {
    await supabaseAdmin.from('facture_lignes').insert(
      lignes
        .filter((l: { description: string }) => l.description)
        .map((l: { description: string; price: number; quantity: number }) => ({
          invoice_id:  facture.id,
          description: l.description,
          price:       l.price,
          quantity:    l.quantity,
          total:       l.price * l.quantity,
        }))
    )
  }

  // Moteur comptable central (migration 139) — FAC-001 si facture émise directement
  // Le trigger trg_facture_issued a été supprimé dans migration 139 — ce code le remplace.
  // Les brouillons et avoirs ne génèrent pas d'écriture comptable à la création.
  if (facture?.id && statut === 'envoyee' && type !== 'avoir') {
    const today    = date ?? new Date().toISOString().split('T')[0]
    const fiscYear = new Date(today).getFullYear()
    const pieceNum = invoice_number ?? `FAC-${facture.id.slice(0, 8).toUpperCase()}`

    await supabaseAdmin.rpc('emit_accounting_event', {
      p_tenant_id:     ctx.tenantId,
      p_event_type:    'FAC-001',
      p_source_module: 'facturation',
      p_source_table:  'factures',
      p_source_id:     facture.id,
      p_montant_ht:    ht,
      p_montant_tva:   tva,
      p_montant_ttc:   ttc,
      p_libelle:       `Facture ${pieceNum} — ${client_name}`,
      p_date_event:    today,
      p_fiscal_year:   fiscYear,
      p_metadata:      { piece_number: pieceNum, client_name, ca, country_code: 'CG' },
    })
  }

  // WhatsApp — notification automatique (non bloquant) si facture émise avec numéro client
  if (statut !== 'brouillon' && client_phone) {
    const wa = createWhatsappService(ctx.tenantId)
    const { data: cfgData } = await supabaseAdmin
      .from('entreprise_config')
      .select('nom')
      .eq('tenant_id', ctx.tenantId)
      .maybeSingle()
    wa.sendInvoice({
      to:            client_phone,
      toName:        client_name,
      invoiceNumber: invoice_number ?? `FAC-${facture.id.slice(0, 8).toUpperCase()}`,
      amount:        `${ttc.toLocaleString('fr-FR')} FCFA`,
      clientName:    client_name,
      dueDate:       due_date ?? undefined,
      companyName:   cfgData?.nom ?? 'Votre entreprise',
    }).catch(() => { /* WhatsApp non configuré — silencieux */ })
  }

  return NextResponse.json({ id: facture.id, ht, tva, ca, ttc })
}

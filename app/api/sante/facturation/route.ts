import { NextRequest, NextResponse } from 'next/server'
import { requireTenant } from '@/lib/tenant-guard'
import { supabaseAdmin } from '@/lib/supabase-server'

export async function GET(req: NextRequest) {
  const { ctx, error } = await requireTenant()
  if (error) return error

  const { searchParams } = new URL(req.url)
  const statut  = searchParams.get('statut')
  const from    = searchParams.get('from')
  const to      = searchParams.get('to')

  let query = supabaseAdmin
    .from('his_factures')
    .select('*, clinique_patients(nom, prenom, numero_dossier, telephone), his_lignes_facture(*)')
    .eq('tenant_id', ctx.tenantId)
    .order('date_facture', { ascending: false })
    .limit(200)

  if (statut) query = query.eq('statut', statut)
  if (from)   query = query.gte('date_facture', from)
  if (to)     query = query.lte('date_facture', to)

  const { data, error: dbError } = await query
  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 })

  const factures = data ?? []
  const stats = {
    count_total:    factures.length,
    count_attente:  factures.filter(f => f.statut === 'en_attente').length,
    count_partielle:factures.filter(f => f.statut === 'partielle').length,
    count_payee:    factures.filter(f => f.statut === 'payee').length,
    sum_total:      factures.reduce((s, f) => s + Number(f.montant_total), 0),
    sum_paye:       factures.reduce((s, f) => s + Number(f.montant_paye), 0),
    sum_impaye:     factures.filter(f => f.statut !== 'payee').reduce((s, f) => s + (Number(f.montant_total) - Number(f.montant_paye)), 0),
  }

  return NextResponse.json({ factures, stats })
}

export async function POST(req: NextRequest) {
  const { ctx, error } = await requireTenant()
  if (error) return error

  const body = await req.json()
  if (!body.patient_id) return NextResponse.json({ error: 'patient_id requis' }, { status: 400 })

  const lignes: Array<{description:string;quantite:number;prix_unitaire:number;categorie?:string}> = body.lignes ?? []
  const montant_total = lignes.reduce((s, l) => s + l.quantite * l.prix_unitaire, 0)

  const factPayload: Record<string, unknown> = {
    tenant_id:      ctx.tenantId,
    patient_id:     body.patient_id,
    montant_total,
    remise:         body.remise ?? 0,
    mode_paiement:  body.mode_paiement ?? null,
    notes:          body.notes ?? null,
  }
  if (body.consultation_id) factPayload.consultation_id = body.consultation_id
  if (body.sejour_id)       factPayload.sejour_id       = body.sejour_id
  if (body.date_echeance)   factPayload.date_echeance   = body.date_echeance

  const { data: facture, error: fErr } = await supabaseAdmin
    .from('his_factures')
    .insert(factPayload)
    .select('id, numero_facture')
    .single()

  if (fErr) return NextResponse.json({ error: fErr.message }, { status: 500 })

  if (lignes.length) {
    const rows = lignes.map(l => ({
      tenant_id:    ctx.tenantId,
      facture_id:   facture.id,
      description:  l.description,
      quantite:     l.quantite,
      prix_unitaire:l.prix_unitaire,
      montant_ligne: l.quantite * l.prix_unitaire,
      categorie:    l.categorie ?? 'autre',
    }))
    const { error: lErr } = await supabaseAdmin.from('his_lignes_facture').insert(rows)
    if (lErr) return NextResponse.json({ error: lErr.message }, { status: 500 })
  }

  return NextResponse.json({ id: facture.id, numero_facture: facture.numero_facture }, { status: 201 })
}

export async function PATCH(req: NextRequest) {
  const { ctx, error } = await requireTenant()
  if (error) return error

  const body = await req.json()
  const { id, ...rest } = body
  if (!id) return NextResponse.json({ error: 'id requis' }, { status: 400 })

  const update: Record<string, unknown> = {}
  if (rest.montant_paye !== undefined) update.montant_paye  = rest.montant_paye
  if (rest.mode_paiement)              update.mode_paiement = rest.mode_paiement
  if (rest.notes !== undefined)        update.notes         = rest.notes
  if (rest.statut)                     update.statut        = rest.statut

  // Auto-set statut based on payment
  if (rest.montant_paye !== undefined && !rest.statut) {
    const { data: existing } = await supabaseAdmin
      .from('his_factures')
      .select('montant_total')
      .eq('id', id)
      .eq('tenant_id', ctx.tenantId)
      .maybeSingle()

    if (existing) {
      const total = Number(existing.montant_total)
      const paid  = Number(rest.montant_paye)
      update.statut = paid >= total ? 'payee' : paid > 0 ? 'partielle' : 'en_attente'
    }
  }

  const { error: dbError } = await supabaseAdmin
    .from('his_factures')
    .update(update)
    .eq('id', id)
    .eq('tenant_id', ctx.tenantId)

  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

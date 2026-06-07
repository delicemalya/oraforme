import { NextRequest, NextResponse } from 'next/server'
import { requireTenant } from '@/lib/tenant-guard'
import { supabaseAdmin } from '@/lib/supabase-server'

export async function GET(req: NextRequest) {
  const { ctx, error } = await requireTenant()
  if (error) return error

  const url    = new URL(req.url)
  const statut = url.searchParams.get('statut')
  const annee  = Number(url.searchParams.get('annee') ?? new Date().getFullYear())

  let q = supabaseAdmin
    .from('cabinet_declarations_agenda')
    .select(`
      *, cabinet_clients(id, nom_entreprise, secteur_activite, pays)
    `)
    .eq('cabinet_tenant_id', ctx.tenantId)
    .eq('periode_annee', annee)
    .order('date_limite', { ascending: true })

  if (statut) q = q.eq('statut', statut)

  const { data, error: dbErr } = await q
  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 })

  const rows = data ?? []
  const now  = new Date()
  const stats = {
    total:     rows.length,
    a_faire:   rows.filter(r => r.statut === 'a_faire').length,
    en_cours:  rows.filter(r => r.statut === 'en_cours').length,
    soumises:  rows.filter(r => r.statut === 'soumise').length,
    retard:    rows.filter(r => new Date(r.date_limite) < now && r.statut !== 'payee' && r.statut !== 'annulee').length,
    urgentes:  rows.filter(r => {
      const j = Math.ceil((new Date(r.date_limite).getTime() - now.getTime()) / 86400000)
      return j >= 0 && j <= 7 && r.statut !== 'payee'
    }).length,
  }

  return NextResponse.json({ declarations: rows, stats })
}

export async function POST(req: NextRequest) {
  const { ctx, error } = await requireTenant()
  if (error) return error

  const body = await req.json()

  // Génération automatique de l'agenda
  if (body.action === 'generer_agenda') {
    const annee = body.annee ?? new Date().getFullYear()
    const { data, error: rpcErr } = await supabaseAdmin
      .rpc('generer_agenda_declarations', {
        p_cabinet_tenant_id: ctx.tenantId,
        p_annee: annee,
      })
    if (rpcErr) return NextResponse.json({ error: rpcErr.message }, { status: 500 })
    return NextResponse.json({ nb_genere: data })
  }

  // Création manuelle d'une déclaration
  const { data, error: dbErr } = await supabaseAdmin
    .from('cabinet_declarations_agenda')
    .insert({
      cabinet_tenant_id:  ctx.tenantId,
      client_id:          body.client_id,
      type_declaration:   body.type_declaration,
      periode_mois:       body.periode_mois ?? null,
      periode_annee:      body.periode_annee ?? new Date().getFullYear(),
      date_limite:        body.date_limite,
      montant_declare:    body.montant_declare ?? null,
      statut:             body.statut ?? 'a_faire',
      notes:              body.notes ?? null,
      alerte_j_avant:     body.alerte_j_avant ?? 7,
    })
    .select('id')
    .single()

  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 })
  return NextResponse.json({ id: data.id }, { status: 201 })
}

export async function PATCH(req: NextRequest) {
  const { ctx, error } = await requireTenant()
  if (error) return error

  const { id, statut, montant_declare, montant_paye, date_soumise, reference_externe, notes } = await req.json()

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (statut !== undefined)            patch.statut = statut
  if (montant_declare !== undefined)   patch.montant_declare = montant_declare
  if (montant_paye !== undefined)      patch.montant_paye = montant_paye
  if (date_soumise !== undefined)      patch.date_soumise = date_soumise
  if (reference_externe !== undefined) patch.reference_externe = reference_externe
  if (notes !== undefined)             patch.notes = notes

  const { error: dbErr } = await supabaseAdmin
    .from('cabinet_declarations_agenda')
    .update(patch)
    .eq('id', id)
    .eq('cabinet_tenant_id', ctx.tenantId)

  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

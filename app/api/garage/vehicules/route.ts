import { NextRequest, NextResponse } from 'next/server'
import { requireTenant } from '@/lib/api/require-tenant'
import { supabaseAdmin } from '@/lib/supabase-server'
import { CARBURANTS, normaliserImmatriculation } from '@/lib/garage/ordres'

// GET /api/garage/vehicules?q=… — liste des véhicules du tenant (recherche immat./propriétaire)
export async function GET(req: NextRequest) {
  const ctx = await requireTenant(req)
  if (!ctx.ok) return ctx.error

  const q = new URL(req.url).searchParams.get('q')?.trim()

  let query = supabaseAdmin
    .from('garage_vehicules')
    .select('*')
    .eq('tenant_id', ctx.tid)
    .order('created_at', { ascending: false })
    .limit(200)

  if (q) {
    const motif = `%${q.replace(/[%_,()]/g, ' ')}%`
    query = query.or(`immatriculation.ilike.${motif},proprietaire_nom.ilike.${motif},marque.ilike.${motif}`)
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data: data ?? [] })
}

// POST /api/garage/vehicules — enregistrer un véhicule
export async function POST(req: NextRequest) {
  const ctx = await requireTenant(req)
  if (!ctx.ok) return ctx.error

  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'Corps de requête invalide' }, { status: 400 })

  const immatriculation = typeof body.immatriculation === 'string' ? normaliserImmatriculation(body.immatriculation) : ''
  const proprietaire_nom = typeof body.proprietaire_nom === 'string' ? body.proprietaire_nom.trim() : ''
  if (!immatriculation) return NextResponse.json({ error: 'Immatriculation requise' }, { status: 400 })
  if (!proprietaire_nom) return NextResponse.json({ error: 'Nom du propriétaire requis' }, { status: 400 })
  if (body.carburant && !(CARBURANTS as readonly string[]).includes(body.carburant)) {
    return NextResponse.json({ error: 'Carburant invalide' }, { status: 400 })
  }

  // client_id : jamais fait confiance tel quel — doit appartenir au tenant.
  if (body.client_id) {
    const { data: client } = await supabaseAdmin
      .from('clients').select('id').eq('id', body.client_id).eq('tenant_id', ctx.tid).maybeSingle()
    if (!client) return NextResponse.json({ error: 'Client introuvable pour ce tenant' }, { status: 403 })
  }

  const { data, error } = await supabaseAdmin
    .from('garage_vehicules')
    .insert({
      tenant_id:              ctx.tid,
      client_id:              body.client_id ?? null,
      proprietaire_nom,
      proprietaire_telephone: body.proprietaire_telephone?.trim() || null,
      immatriculation,
      marque:                 body.marque?.trim() || null,
      modele:                 body.modele?.trim() || null,
      annee:                  body.annee ? Number(body.annee) : null,
      vin:                    body.vin?.trim() || null,
      couleur:                body.couleur?.trim() || null,
      carburant:              body.carburant || null,
      kilometrage:            body.kilometrage != null && body.kilometrage !== '' ? Number(body.kilometrage) : null,
      notes:                  body.notes?.trim() || null,
    })
    .select('*')
    .single()

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: `Un véhicule ${immatriculation} existe déjà` }, { status: 409 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ data }, { status: 201 })
}

import { NextRequest, NextResponse } from 'next/server'
import { requireTenant } from '@/lib/api/require-tenant'
import { supabaseAdmin } from '@/lib/supabase-server'
import { CARBURANTS, normaliserImmatriculation } from '@/lib/garage/ordres'

type Params = { params: Promise<{ id: string }> }

// GET /api/garage/vehicules/[id] — fiche véhicule + historique des OR
export async function GET(req: NextRequest, { params }: Params) {
  const ctx = await requireTenant(req)
  if (!ctx.ok) return ctx.error
  const { id } = await params

  const { data: vehicule } = await supabaseAdmin
    .from('garage_vehicules').select('*').eq('id', id).eq('tenant_id', ctx.tid).maybeSingle()
  if (!vehicule) return NextResponse.json({ error: 'Véhicule introuvable' }, { status: 404 })

  const { data: ordres } = await supabaseAdmin
    .from('garage_ordres')
    .select('id, numero, statut, date_entree, date_sortie, kilometrage_entree, symptomes, facture_id')
    .eq('vehicule_id', id).eq('tenant_id', ctx.tid)
    .order('date_entree', { ascending: false })

  return NextResponse.json({ data: { ...vehicule, ordres: ordres ?? [] } })
}

const CHAMPS_MODIFIABLES = [
  'proprietaire_nom', 'proprietaire_telephone', 'immatriculation', 'marque', 'modele',
  'annee', 'vin', 'couleur', 'carburant', 'kilometrage', 'notes',
] as const

// PATCH /api/garage/vehicules/[id]
export async function PATCH(req: NextRequest, { params }: Params) {
  const ctx = await requireTenant(req)
  if (!ctx.ok) return ctx.error
  const { id } = await params

  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'Corps de requête invalide' }, { status: 400 })

  const maj: Record<string, unknown> = { updated_at: new Date().toISOString() }
  for (const champ of CHAMPS_MODIFIABLES) {
    if (champ in body) maj[champ] = body[champ] === '' ? null : body[champ]
  }
  if (typeof maj.immatriculation === 'string') maj.immatriculation = normaliserImmatriculation(maj.immatriculation)
  if ('immatriculation' in maj && !maj.immatriculation) {
    return NextResponse.json({ error: 'Immatriculation requise' }, { status: 400 })
  }
  if ('proprietaire_nom' in maj && !maj.proprietaire_nom) {
    return NextResponse.json({ error: 'Nom du propriétaire requis' }, { status: 400 })
  }
  if (maj.carburant && !(CARBURANTS as readonly string[]).includes(maj.carburant as string)) {
    return NextResponse.json({ error: 'Carburant invalide' }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin
    .from('garage_vehicules').update(maj).eq('id', id).eq('tenant_id', ctx.tid).select('*').maybeSingle()

  if (error) {
    if (error.code === '23505') return NextResponse.json({ error: 'Immatriculation déjà utilisée' }, { status: 409 })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  if (!data) return NextResponse.json({ error: 'Véhicule introuvable' }, { status: 404 })
  return NextResponse.json({ data })
}

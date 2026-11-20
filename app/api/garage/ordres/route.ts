import { NextRequest, NextResponse } from 'next/server'
import { requireTenant } from '@/lib/api/require-tenant'
import { supabaseAdmin } from '@/lib/supabase-server'
import { isStatutOrdre } from '@/lib/garage/ordres'

// GET /api/garage/ordres?statut=… — ordres de réparation du tenant
export async function GET(req: NextRequest) {
  const ctx = await requireTenant(req)
  if (!ctx.ok) return ctx.error

  const statut = new URL(req.url).searchParams.get('statut')
  let query = supabaseAdmin
    .from('garage_ordres')
    .select('*, garage_vehicules(immatriculation, marque, modele, proprietaire_nom, proprietaire_telephone)')
    .eq('tenant_id', ctx.tid)
    .order('created_at', { ascending: false })
    .limit(200)

  if (statut) {
    if (!isStatutOrdre(statut)) return NextResponse.json({ error: 'Statut inconnu' }, { status: 400 })
    query = query.eq('statut', statut)
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data: data ?? [] })
}

// POST /api/garage/ordres — ouvrir un ordre de réparation
export async function POST(req: NextRequest) {
  const ctx = await requireTenant(req)
  if (!ctx.ok) return ctx.error

  const body = await req.json().catch(() => null)
  if (!body?.vehicule_id) return NextResponse.json({ error: 'vehicule_id requis' }, { status: 400 })

  const { data: vehicule } = await supabaseAdmin
    .from('garage_vehicules').select('id').eq('id', body.vehicule_id).eq('tenant_id', ctx.tid).maybeSingle()
  if (!vehicule) return NextResponse.json({ error: 'Véhicule introuvable pour ce tenant' }, { status: 403 })

  if (body.mecanicien_id) {
    const { data: meca } = await supabaseAdmin
      .from('employes').select('id').eq('id', body.mecanicien_id).eq('tenant_id', ctx.tid).maybeSingle()
    if (!meca) return NextResponse.json({ error: 'Mécanicien introuvable pour ce tenant' }, { status: 403 })
  }

  const km = body.kilometrage_entree != null && body.kilometrage_entree !== '' ? Number(body.kilometrage_entree) : null
  if (km != null && (!Number.isFinite(km) || km < 0)) {
    return NextResponse.json({ error: 'Kilométrage invalide' }, { status: 400 })
  }

  // Numéro séquentiel ; une collision (course rare) est rejouée une fois.
  for (let tentative = 0; tentative < 2; tentative++) {
    const { data: numero, error: numErr } = await supabaseAdmin.rpc('fn_garage_numero_ordre', { p_tenant_id: ctx.tid })
    if (numErr || !numero) return NextResponse.json({ error: numErr?.message ?? 'Numérotation impossible' }, { status: 500 })

    const { data, error } = await supabaseAdmin
      .from('garage_ordres')
      .insert({
        tenant_id:          ctx.tid,
        numero,
        vehicule_id:        body.vehicule_id,
        date_entree:        body.date_entree || new Date().toISOString().split('T')[0],
        date_sortie_prevue: body.date_sortie_prevue || null,
        kilometrage_entree: km,
        symptomes:          body.symptomes?.trim() || null,
        mecanicien_id:      body.mecanicien_id || null,
      })
      .select('*')
      .single()

    if (!error) {
      if (km != null) {
        await supabaseAdmin.from('garage_vehicules')
          .update({ kilometrage: km, updated_at: new Date().toISOString() })
          .eq('id', body.vehicule_id).eq('tenant_id', ctx.tid)
      }
      return NextResponse.json({ data }, { status: 201 })
    }
    if (error.code !== '23505') return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ error: 'Numéro d\'OR déjà pris, réessayez' }, { status: 409 })
}

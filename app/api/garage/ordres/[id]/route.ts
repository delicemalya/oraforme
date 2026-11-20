import { NextRequest, NextResponse } from 'next/server'
import { requireTenant } from '@/lib/api/require-tenant'
import { supabaseAdmin } from '@/lib/supabase-server'
import { isStatutOrdre, peutPasserA, totauxOrdre, type StatutOrdre } from '@/lib/garage/ordres'

type Params = { params: Promise<{ id: string }> }

// GET /api/garage/ordres/[id] — OR complet : véhicule, lignes, totaux
export async function GET(req: NextRequest, { params }: Params) {
  const ctx = await requireTenant(req)
  if (!ctx.ok) return ctx.error
  const { id } = await params

  const { data: ordre } = await supabaseAdmin
    .from('garage_ordres')
    .select('*, garage_vehicules(*), employes(id, nom, prenom)')
    .eq('id', id).eq('tenant_id', ctx.tid)
    .maybeSingle()
  if (!ordre) return NextResponse.json({ error: 'Ordre introuvable' }, { status: 404 })

  const { data: lignes } = await supabaseAdmin
    .from('garage_ordre_lignes')
    .select('*, products(nom, sku)')
    .eq('ordre_id', id).eq('tenant_id', ctx.tid)
    .order('created_at')

  return NextResponse.json({ data: { ...ordre, lignes: lignes ?? [], totaux: totauxOrdre(lignes ?? []) } })
}

// PATCH /api/garage/ordres/[id] — diagnostic, dates, mécanicien, transitions de statut
export async function PATCH(req: NextRequest, { params }: Params) {
  const ctx = await requireTenant(req)
  if (!ctx.ok) return ctx.error
  const { id } = await params

  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'Corps de requête invalide' }, { status: 400 })

  const { data: ordre } = await supabaseAdmin
    .from('garage_ordres').select('id, statut').eq('id', id).eq('tenant_id', ctx.tid).maybeSingle()
  if (!ordre) return NextResponse.json({ error: 'Ordre introuvable' }, { status: 404 })

  const maj: Record<string, unknown> = { updated_at: new Date().toISOString() }
  for (const champ of ['symptomes', 'diagnostic', 'date_sortie_prevue'] as const) {
    if (champ in body) maj[champ] = body[champ] === '' ? null : body[champ]
  }

  if ('mecanicien_id' in body) {
    if (body.mecanicien_id) {
      const { data: meca } = await supabaseAdmin
        .from('employes').select('id').eq('id', body.mecanicien_id).eq('tenant_id', ctx.tid).maybeSingle()
      if (!meca) return NextResponse.json({ error: 'Mécanicien introuvable pour ce tenant' }, { status: 403 })
    }
    maj.mecanicien_id = body.mecanicien_id || null
  }

  if ('statut' in body && body.statut !== ordre.statut) {
    if (!isStatutOrdre(body.statut)) return NextResponse.json({ error: 'Statut inconnu' }, { status: 400 })
    if (body.statut === 'facture') {
      return NextResponse.json(
        { error: 'La facturation passe par POST /api/garage/ordres/[id]/facturer' }, { status: 400 },
      )
    }
    if (!peutPasserA(ordre.statut as StatutOrdre, body.statut)) {
      return NextResponse.json({ error: `Transition ${ordre.statut} → ${body.statut} interdite` }, { status: 409 })
    }
    maj.statut = body.statut
    if (body.statut === 'livre') maj.date_sortie = new Date().toISOString().split('T')[0]
  }

  // Le filtre sur l'ancien statut évite d'écraser une facturation concurrente.
  const { data, error } = await supabaseAdmin
    .from('garage_ordres').update(maj)
    .eq('id', id).eq('tenant_id', ctx.tid).eq('statut', ordre.statut)
    .select('*').maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'L\'ordre a changé entre-temps, rechargez' }, { status: 409 })
  return NextResponse.json({ data })
}

import { NextRequest, NextResponse } from 'next/server'
import { requireTenant } from '@/lib/api/require-tenant'
import { supabaseAdmin } from '@/lib/supabase-server'

// POST /api/paie/bulletins
// Upsert bulletins_paie via service_role — bypasses RLS issues caused by
// multi-profile users (profiles.id mismatch vs auth.uid() in RLS USING clause)
export async function POST(req: NextRequest) {
  const ctx = await requireTenant(req)
  if (!ctx.ok) return ctx.error

  const body = await req.json()
  const { bulletins } = body as { bulletins: Record<string, unknown>[] }

  if (!Array.isArray(bulletins) || bulletins.length === 0) {
    return NextResponse.json({ error: 'bulletins requis' }, { status: 400 })
  }

  // Security: every row must belong to the authenticated tenant
  const foreign = bulletins.filter(b => b.tenant_id !== ctx.tid)
  if (foreign.length > 0) {
    return NextResponse.json({ error: 'tenant_id invalide' }, { status: 403 })
  }

  const { error } = await supabaseAdmin
    .from('bulletins_paie')
    .upsert(bulletins, { onConflict: 'employe_id,mois,annee' })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

// PATCH /api/paie/bulletins — update statut only
export async function PATCH(req: NextRequest) {
  const ctx = await requireTenant(req)
  if (!ctx.ok) return ctx.error

  const { employe_id, mois, annee, statut } = await req.json()
  if (!employe_id || !mois || !annee || !statut) {
    return NextResponse.json({ error: 'Paramètres manquants' }, { status: 400 })
  }

  const { error } = await supabaseAdmin
    .from('bulletins_paie')
    .update({ statut })
    .eq('tenant_id', ctx.tid)
    .eq('employe_id', employe_id)
    .eq('mois', mois)
    .eq('annee', annee)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

import { NextRequest, NextResponse } from 'next/server'
import { requireTenant } from '@/lib/tenant-guard'
import { supabaseAdmin } from '@/lib/supabase-server'

// GET /api/resto/formules
export async function GET(_req: NextRequest) {
  const { ctx, error } = await requireTenant()
  if (error) return error

  const { data: formules, error: err } = await supabaseAdmin
    .from('resto_formules')
    .select('*, resto_formule_items(*, resto_menu(nom, prix, emoji))')
    .eq('tenant_id', ctx.tenantId)
    .order('type_service', { ascending: true })
    .order('nom', { ascending: true })

  if (err) return NextResponse.json({ error: err.message }, { status: 500 })

  const { data: plats } = await supabaseAdmin
    .from('resto_menu')
    .select('id, nom, categorie, prix, emoji, disponible')
    .eq('tenant_id', ctx.tenantId)
    .eq('disponible', true)
    .order('categorie', { ascending: true })

  return NextResponse.json({ formules: formules ?? [], plats: plats ?? [] })
}

// POST /api/resto/formules — créer formule + items
export async function POST(req: NextRequest) {
  const { ctx, error } = await requireTenant()
  if (error) return error

  const { nom, description, prix, type_service, items } = await req.json()
  if (!nom || !prix) return NextResponse.json({ error: 'nom et prix requis' }, { status: 400 })

  const { data: formule, error: err } = await supabaseAdmin
    .from('resto_formules')
    .insert({ tenant_id: ctx.tenantId, nom, description: description ?? null, prix, type_service: type_service ?? 'midi', disponible: true })
    .select('id')
    .single()

  if (err) return NextResponse.json({ error: err.message }, { status: 500 })

  if (items?.length) {
    const rows = (items as { plat_id?: string; nom: string; type_item: string; obligatoire?: boolean }[])
      .map(it => ({
        tenant_id: ctx.tenantId,
        formule_id: formule.id,
        plat_id: it.plat_id ?? null,
        nom: it.nom,
        type_item: it.type_item,
        obligatoire: it.obligatoire ?? true,
      }))
    await supabaseAdmin.from('resto_formule_items').insert(rows)
  }

  return NextResponse.json({ id: formule.id }, { status: 201 })
}

// PATCH /api/resto/formules — toggle disponible ou update simple
export async function PATCH(req: NextRequest) {
  const { ctx, error } = await requireTenant()
  if (error) return error

  const { id, ...updates } = await req.json()
  if (!id) return NextResponse.json({ error: 'id requis' }, { status: 400 })

  const allowed: Record<string, unknown> = { updated_at: new Date().toISOString() }
  for (const k of ['nom', 'description', 'prix', 'type_service', 'disponible']) {
    if (k in updates) allowed[k] = updates[k]
  }

  const { data, error: err } = await supabaseAdmin
    .from('resto_formules')
    .update(allowed)
    .eq('id', id)
    .eq('tenant_id', ctx.tenantId)
    .select('*')
    .single()

  if (err) return NextResponse.json({ error: err.message }, { status: 500 })
  return NextResponse.json({ formule: data })
}

// DELETE /api/resto/formules?id=
export async function DELETE(req: NextRequest) {
  const { ctx, error } = await requireTenant()
  if (error) return error

  const id = new URL(req.url).searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id requis' }, { status: 400 })

  await supabaseAdmin.from('resto_formule_items').delete().eq('formule_id', id).eq('tenant_id', ctx.tenantId)
  await supabaseAdmin.from('resto_formules').delete().eq('id', id).eq('tenant_id', ctx.tenantId)

  return NextResponse.json({ ok: true })
}

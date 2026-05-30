import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { requireTenant } from '@/lib/tenant-guard'

export const dynamic = 'force-dynamic'

// GET /api/sante/medecins
export async function GET(req: NextRequest) {
  const { ctx, error } = await requireTenant()
  if (error) return error

  const { searchParams } = new URL(req.url)
  const actif = searchParams.get('actif') !== 'false'

  const { data, error: dbErr } = await supabaseAdmin
    .from('clinique_medecins')
    .select('*')
    .eq('tenant_id', ctx.tenantId)
    .eq('actif', actif)
    .order('nom', { ascending: true })

  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 })
  return NextResponse.json({ data: data ?? [] })
}

// POST /api/sante/medecins
export async function POST(req: NextRequest) {
  const { ctx, error } = await requireTenant()
  if (error) return error

  const body = await req.json()
  const { nom, prenom, specialite, telephone, email, numero_ordre } = body

  if (!nom?.trim() || !prenom?.trim()) {
    return NextResponse.json({ error: 'Nom et prénom obligatoires' }, { status: 400 })
  }
  if (!specialite?.trim()) {
    return NextResponse.json({ error: 'Spécialité obligatoire' }, { status: 400 })
  }

  const { data, error: insErr } = await supabaseAdmin
    .from('clinique_medecins')
    .insert({
      tenant_id:    ctx.tenantId,
      nom:          nom.trim(),
      prenom:       prenom.trim(),
      specialite:   specialite.trim(),
      telephone:    telephone     || null,
      email:        email         || null,
      numero_ordre: numero_ordre  || null,
      actif:        true,
    })
    .select('id')
    .single()

  if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 })
  return NextResponse.json({ id: data.id }, { status: 201 })
}

// PATCH /api/sante/medecins
export async function PATCH(req: NextRequest) {
  const { ctx, error } = await requireTenant()
  if (error) return error

  const body = await req.json()
  const { id, ...updates } = body

  if (!id) return NextResponse.json({ error: 'id requis' }, { status: 400 })

  const allowed = ['nom', 'prenom', 'specialite', 'telephone', 'email', 'numero_ordre', 'actif']
  const payload: Record<string, unknown> = {}
  for (const key of allowed) {
    if (key in updates) payload[key] = updates[key]
  }

  const { error: updErr } = await supabaseAdmin
    .from('clinique_medecins')
    .update(payload)
    .eq('id', id)
    .eq('tenant_id', ctx.tenantId)

  if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

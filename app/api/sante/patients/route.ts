import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { requireTenant } from '@/lib/tenant-guard'

export const dynamic = 'force-dynamic'

// GET /api/sante/patients
export async function GET(req: NextRequest) {
  const { ctx, error } = await requireTenant()
  if (error) return error

  const { searchParams } = new URL(req.url)
  const search = searchParams.get('q')
  const actif  = searchParams.get('actif') !== 'false'

  let query = supabaseAdmin
    .from('clinique_patients')
    .select('*', { count: 'exact' })
    .eq('tenant_id', ctx.tenantId)
    .eq('actif', actif)
    .order('created_at', { ascending: false })
    .limit(200)

  if (search) query = query.or(`nom.ilike.%${search}%,prenom.ilike.%${search}%,numero_dossier.ilike.%${search}%`)

  const { data, error: dbErr, count } = await query
  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 })

  return NextResponse.json({ data: data ?? [], total: count ?? 0 })
}

// POST /api/sante/patients
export async function POST(req: NextRequest) {
  const { ctx, error } = await requireTenant()
  if (error) return error

  const body = await req.json()
  const { nom, prenom, date_naissance, sexe, telephone, email, adresse,
          groupe_sanguin, antecedents, allergies, assurance, numero_assurance } = body

  if (!nom?.trim() || !prenom?.trim()) {
    return NextResponse.json({ error: 'Nom et prénom obligatoires' }, { status: 400 })
  }

  const { data, error: insErr } = await supabaseAdmin
    .from('clinique_patients')
    .insert({
      tenant_id:        ctx.tenantId,
      nom:              nom.trim(),
      prenom:           prenom.trim(),
      date_naissance:   date_naissance   || null,
      sexe:             sexe             || null,
      telephone:        telephone        || null,
      email:            email            || null,
      adresse:          adresse          || null,
      groupe_sanguin:   groupe_sanguin   || null,
      antecedents:      antecedents      || null,
      allergies:        allergies        || null,
      assurance:        assurance        || null,
      numero_assurance: numero_assurance || null,
      actif:            true,
    })
    .select('id, numero_dossier')
    .single()

  if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 })
  return NextResponse.json({ id: data.id, numero_dossier: data.numero_dossier }, { status: 201 })
}

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { createSupabaseServerClient } from '@/lib/supabase-client-server'

async function getProfile(req: NextRequest) {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabaseAdmin
    .from('profiles').select('tenant_id, role').eq('user_id', user.id).maybeSingle()
  if (!profile?.tenant_id) return null
  return profile
}

// GET /api/rapprochement?statut=all|non_rapproche|rapproche|ecart
export async function GET(req: NextRequest) {
  const profile = await getProfile(req)
  if (!profile) return NextResponse.json({ error: 'Non authentifié ou accès refusé' }, { status: 401 })

  const url = new URL(req.url)
  const statut = url.searchParams.get('statut') ?? 'all'

  let query = supabaseAdmin
    .from('rapprochement_bancaire')
    .select('*')
    .eq('tenant_id', profile.tenant_id)
    .order('date_releve', { ascending: false })

  if (statut !== 'all') {
    query = query.eq('statut', statut)
  }

  const { data, error } = await query.limit(300)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ data: data ?? [] })
}

// POST /api/rapprochement — create entry
export async function POST(req: NextRequest) {
  const profile = await getProfile(req)
  if (!profile) return NextResponse.json({ error: 'Non authentifié ou accès refusé' }, { status: 401 })

  const body = await req.json()
  const { date_releve, reference, montant, type, libelle, statut = 'non_rapproche', transaction_id } = body

  if (!date_releve || !reference || montant === undefined || !type) {
    return NextResponse.json({ error: 'Champs requis : date_releve, reference, montant, type' }, { status: 400 })
  }
  if (!['debit', 'credit'].includes(type)) {
    return NextResponse.json({ error: "type doit être 'debit' ou 'credit'" }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin
    .from('rapprochement_bancaire')
    .insert({
      tenant_id: profile.tenant_id,
      date_releve,
      reference,
      montant: Number(montant),
      type,
      libelle: libelle || null,
      statut,
      transaction_id: transaction_id || null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data }, { status: 201 })
}

// PATCH /api/rapprochement — update statut
export async function PATCH(req: NextRequest) {
  const profile = await getProfile(req)
  if (!profile) return NextResponse.json({ error: 'Non authentifié ou accès refusé' }, { status: 401 })

  const body = await req.json()
  const { id, statut } = body

  if (!id || !statut) return NextResponse.json({ error: 'id et statut requis' }, { status: 400 })
  if (!['non_rapproche', 'rapproche', 'ecart'].includes(statut)) {
    return NextResponse.json({ error: 'statut invalide' }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin
    .from('rapprochement_bancaire')
    .update({ statut })
    .eq('id', id)
    .eq('tenant_id', profile.tenant_id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

// DELETE /api/rapprochement?id=...
export async function DELETE(req: NextRequest) {
  const profile = await getProfile(req)
  if (!profile) return NextResponse.json({ error: 'Non authentifié ou accès refusé' }, { status: 401 })

  const id = new URL(req.url).searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id requis' }, { status: 400 })

  const { error } = await supabaseAdmin
    .from('rapprochement_bancaire')
    .delete()
    .eq('id', id)
    .eq('tenant_id', profile.tenant_id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}

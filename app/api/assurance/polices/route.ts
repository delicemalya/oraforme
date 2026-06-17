import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-client-server'

export async function GET(req: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: profile } = await supabase
      .from('profiles').select('tenant_id')
      .eq('user_id', user.id).order('created_at', { ascending: true }).limit(1).maybeSingle()
    if (!profile?.tenant_id) return NextResponse.json({ error: 'No tenant' }, { status: 403 })

    const { searchParams } = new URL(req.url)
    const statut      = searchParams.get('statut')
    const type_police = searchParams.get('type')
    const search      = searchParams.get('search')

    let query = supabase
      .from('ass_polices')
      .select('*, ass_agents(nom, prenom, type_agent), ass_produits(nom_produit)')
      .eq('tenant_id', profile.tenant_id)
      .order('created_at', { ascending: false })
      .limit(200)

    if (statut)      query = query.eq('statut', statut)
    if (type_police) query = query.eq('type_police', type_police)
    if (search)      query = query.ilike('assure_nom', `%${search}%`)

    const { data, error } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // KPIs aggregation
    const { data: kpis } = await supabase.rpc
      ? await supabase
          .from('ass_polices')
          .select('prime_montant, statut, type_police')
          .eq('tenant_id', profile.tenant_id)
      : { data: [] }

    const primes_emises = (kpis ?? []).reduce((s: number, p: { prime_montant: number }) => s + (p.prime_montant ?? 0), 0)
    const nb_actives    = (kpis ?? []).filter((p: { statut: string }) => p.statut === 'active').length

    return NextResponse.json({ data, kpis: { primes_emises, nb_actives, total: (kpis ?? []).length } })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: profile } = await supabase
      .from('profiles').select('tenant_id')
      .eq('user_id', user.id).order('created_at', { ascending: true }).limit(1).maybeSingle()
    if (!profile?.tenant_id) return NextResponse.json({ error: 'No tenant' }, { status: 403 })

    const body = await req.json()
    const { data, error } = await supabase
      .from('ass_polices')
      .insert({ ...body, tenant_id: profile.tenant_id })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Auto-create commission si agent_id présent
    if (data.agent_id && data.prime_montant > 0) {
      const { data: agent } = await supabase
        .from('ass_agents').select('taux_commission').eq('id', data.agent_id).single()
      if (agent) {
        const montant = (data.prime_montant * agent.taux_commission) / 100
        await supabase.from('ass_commissions').insert({
          tenant_id: profile.tenant_id,
          police_id: data.id,
          agent_id:  data.agent_id,
          montant,
          taux:      agent.taux_commission,
        })
      }
    }

    return NextResponse.json({ data }, { status: 201 })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

export async function PUT(req: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: profile } = await supabase
      .from('profiles').select('tenant_id')
      .eq('user_id', user.id).order('created_at', { ascending: true }).limit(1).maybeSingle()
    if (!profile?.tenant_id) return NextResponse.json({ error: 'No tenant' }, { status: 403 })

    const body = await req.json()
    const { id, ...updates } = body
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

    const { data, error } = await supabase
      .from('ass_polices')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id).eq('tenant_id', profile.tenant_id)
      .select().single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ data })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: profile } = await supabase
      .from('profiles').select('tenant_id')
      .eq('user_id', user.id).order('created_at', { ascending: true }).limit(1).maybeSingle()
    if (!profile?.tenant_id) return NextResponse.json({ error: 'No tenant' }, { status: 403 })

    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

    const { error } = await supabase
      .from('ass_polices').delete().eq('id', id).eq('tenant_id', profile.tenant_id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
